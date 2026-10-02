import json
import sqlite3
import time
from typing import Dict, Any, Optional
from app.config import settings
from app.db import get_db

def recalculate_detection_engine(custom_settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Dynamically recalculates fraud pattern detections, explainable risk scores,
    and alert queues across all 40,038 accounts based on configurable thresholds.
    """
    t0 = time.time()
    
    # Retrieve current active parameters
    fan_in_min_cps = int(custom_settings.get("fan_in_min_cps", settings.FAN_IN_MIN_CPS) if custom_settings else settings.FAN_IN_MIN_CPS)
    fan_out_min_cps = int(custom_settings.get("fan_out_min_cps", settings.FAN_OUT_MIN_CPS) if custom_settings else settings.FAN_OUT_MIN_CPS)
    pt_min_ratio = float(custom_settings.get("pass_through_min_ratio", settings.PASS_THROUGH_MIN_RATIO) if custom_settings else settings.PASS_THROUGH_MIN_RATIO)
    pt_max_ratio = float(custom_settings.get("pass_through_max_ratio", settings.PASS_THROUGH_MAX_RATIO) if custom_settings else settings.PASS_THROUGH_MAX_RATIO)
    new_acct_days = int(custom_settings.get("new_account_max_days", settings.NEW_ACCOUNT_MAX_DAYS) if custom_settings else settings.NEW_ACCOUNT_MAX_DAYS)
    risk_crit_thresh = int(custom_settings.get("risk_critical_threshold", settings.RISK_CRITICAL_THRESHOLD) if custom_settings else settings.RISK_CRITICAL_THRESHOLD)
    risk_high_thresh = int(custom_settings.get("risk_high_threshold", settings.RISK_HIGH_THRESHOLD) if custom_settings else settings.RISK_HIGH_THRESHOLD)
    risk_med_thresh = int(custom_settings.get("risk_medium_threshold", settings.RISK_MEDIUM_THRESHOLD) if custom_settings else settings.RISK_MEDIUM_THRESHOLD)

    # Scaling brackets for Fan-In / Fan-Out
    high_in = int(round(fan_in_min_cps * 1.33))
    high_out = int(round(fan_out_min_cps * 1.33))
    mod_in = max(2, int(round(fan_in_min_cps * 0.55)))
    mod_out = max(2, int(round(fan_out_min_cps * 0.55)))

    with get_db() as conn:
        cursor = conn.cursor()

        # Query all accounts with pre-indexed metrics
        cursor.execute("""
            SELECT account_id, total_tx_count, credit_volume, debit_volume, 
                   unique_incoming_cps, unique_outgoing_cps, reciprocal_cp_count,
                   avg_balance, account_age_days, pass_through_ratio,
                   velocity_score, balance_behavior_score,
                   kyc_weak, pin_cluster_size, customer_accounts_count,
                   investigation_status
            FROM accounts
        """)
        accounts = cursor.fetchall()

        # Retrieve existing alerts
        cursor.execute("SELECT alert_id, account_id, status FROM alerts")
        existing_alerts = {r[1]: (r[0], r[2]) for r in cursor.fetchall()}

        # Find max alert ID sequence number
        max_alert_num = 1
        for aid, _ in existing_alerts.values():
            if aid.startswith("ALT-"):
                try:
                    num = int(aid.split("-")[1])
                    if num > max_alert_num:
                        max_alert_num = num
                except:
                    pass
        next_alert_num = max_alert_num + 1

        acct_updates = []
        risk_updates = []
        alerts_to_update = []
        alerts_to_insert = []
        alerts_to_delete = []

        total_crit = 0
        total_high = 0
        total_fan = 0
        total_pt = 0
        total_cycle = 0
        total_shared = 0

        for r in accounts:
            (acct_id, tx_count, cred_vol, deb_vol, in_cps, out_cps, recip_cps,
             avg_bal, age_days, pt_ratio, vel_score, bal_score,
             kyc_weak, pin_cluster, cust_accts, inv_status) = r

            evidence_reasons = []

            # 1. Pattern: Fan-In -> Fan-Out
            fan_in_out_flag = (in_cps >= fan_in_min_cps and out_cps >= fan_out_min_cps) or \
                              (in_cps >= mod_in and out_cps >= mod_out and tx_count >= 50)
            fan_score = 0.0
            if in_cps >= high_in and out_cps >= high_out:
                fan_score = 25.0
                evidence_reasons.append(f"High Fan-In/Fan-Out: Received from {in_cps} unique counterparties and sent to {out_cps} counterparties")
            elif in_cps >= fan_in_min_cps and out_cps >= fan_out_min_cps:
                fan_score = 18.0
                evidence_reasons.append(f"Elevated Fan-In/Fan-Out: {in_cps} incoming counterparties, {out_cps} outgoing counterparties")
            elif in_cps >= mod_in and out_cps >= mod_out:
                fan_score = 10.0

            # 2. Pattern: Pass-Through / Rapid Transit
            pt_flag = False
            pt_score = 0.0
            retained_ratio = (avg_bal / cred_vol) if cred_vol > 50000 else 1.0

            if cred_vol >= 100000 and (pt_min_ratio + 0.03) <= pt_ratio <= (pt_max_ratio - 0.03):
                pt_flag = True
                if retained_ratio <= 0.05:
                    pt_score = 25.0
                    evidence_reasons.append(f"Critical Pass-Through: {pt_ratio*100:.1f}% of ₹{cred_vol:,.0f} inflow dispersed; retained balance ratio is only {retained_ratio*100:.1f}%")
                elif retained_ratio <= 0.15:
                    pt_score = 20.0
                    evidence_reasons.append(f"High Pass-Through: {pt_ratio*100:.1f}% of incoming funds dispersed (₹{deb_vol:,.0f} outgoing)")
                else:
                    pt_score = 14.0
            elif cred_vol >= 50000 and pt_min_ratio <= pt_ratio <= pt_max_ratio:
                pt_score = 12.0
                if retained_ratio <= 0.10:
                    pt_flag = True
                    evidence_reasons.append(f"Rapid Transit: Inflow of ₹{cred_vol:,.0f} closely matched by outflow of ₹{deb_vol:,.0f}")

            # 3. Pattern: Circular / Reciprocal Network Flow
            cycle_flag = False
            cycle_score = 0.0
            if recip_cps >= 8:
                cycle_flag = True
                cycle_score = 15.0
                evidence_reasons.append(f"Suspicious Reciprocal Network: Loop flows with {recip_cps} bidirectional counterparties")
            elif recip_cps >= 4:
                cycle_score = 10.0
                if tx_count >= 40:
                    cycle_flag = True
                    evidence_reasons.append(f"Bidirectional Bipartite Loops: {recip_cps} counterparties have reciprocal credit & debit flows")
            elif recip_cps >= 2:
                cycle_score = 5.0

            # 4. Pattern: New Account / Demographic Cluster
            is_new_account = (age_days <= new_acct_days)
            shared_id_flag = False
            shared_id_score = 0.0
            if is_new_account and tx_count >= 25 and (pin_cluster >= 15 or cust_accts > 1 or kyc_weak):
                shared_id_flag = True
                shared_id_score = 15.0
                detail = []
                if pin_cluster >= 15: detail.append(f"PIN cluster of {pin_cluster} accounts")
                if cust_accts > 1: detail.append(f"linked to multi-account customer ({cust_accts} accounts)")
                if kyc_weak: detail.append("incomplete PAN & Aadhaar KYC")
                evidence_reasons.append(f"New Account Ring Indicator: Opened {age_days}d ago with high activity; " + ", ".join(detail))
            elif is_new_account and tx_count >= 30:
                shared_id_score = 8.0
                evidence_reasons.append(f"High Velocity on New Account: {tx_count} transactions within {age_days} days of account opening")
            elif cust_accts > 1 and tx_count >= 50:
                shared_id_score = 6.0

            # Composite Normalized Risk Score (0 - 100)
            raw_risk = fan_score + pt_score + cycle_score + shared_id_score + vel_score + bal_score
            risk_score = min(100, int(round(raw_risk)))

            # Severity / Risk Level Classification
            if risk_score >= risk_crit_thresh:
                risk_level = "CRITICAL"
                severity = "CRITICAL"
                total_crit += 1
            elif risk_score >= risk_high_thresh:
                risk_level = "HIGH"
                severity = "HIGH"
                total_high += 1
            elif risk_score >= risk_med_thresh:
                risk_level = "MEDIUM"
                severity = "MEDIUM"
            else:
                risk_level = "LOW"
                severity = "LOW"

            if fan_in_out_flag: total_fan += 1
            if pt_flag: total_pt += 1
            if cycle_flag: total_cycle += 1
            if shared_id_flag: total_shared += 1

            # Primary Pattern determination
            active_patterns = []
            if fan_in_out_flag: active_patterns.append("Fan-in / Fan-out")
            if pt_flag: active_patterns.append("Pass-through Mule")
            if cycle_flag: active_patterns.append("Circular / Reciprocal")
            if shared_id_flag: active_patterns.append("New Account / Cluster")
            primary_pattern = active_patterns[0] if active_patterns else "General Behavioral Anomaly"

            # Auto-explanation fallback
            if risk_score >= risk_high_thresh and not evidence_reasons:
                evidence_reasons.append(f"Disproportionate transaction turnover relative to account tenure ({tx_count} transactions)")

            # Preserve manual analyst statuses (CONFIRMED, UNDER_REVIEW, CLEARED)
            new_inv_status = inv_status
            if inv_status in ("NEW", "UNFLAGGED"):
                new_inv_status = "NEW" if risk_score >= risk_high_thresh else "UNFLAGGED"

            acct_updates.append((
                risk_score, risk_level, primary_pattern,
                1 if fan_in_out_flag else 0, 1 if pt_flag else 0,
                1 if cycle_flag else 0, 1 if shared_id_flag else 0,
                new_inv_status, acct_id
            ))

            risk_updates.append((
                risk_score, risk_level, fan_score, pt_score, cycle_score, shared_id_score,
                json.dumps(evidence_reasons), acct_id
            ))

            # Alert Queue synchronization
            suspicious_amt = max(cred_vol, deb_vol)
            summary_exp = "; ".join(evidence_reasons[:2]) if evidence_reasons else "Elevated risk profile detected across behavioral indicators."

            if risk_score >= risk_high_thresh:
                if acct_id in existing_alerts:
                    alerts_to_update.append((
                        risk_score, severity, primary_pattern, suspicious_amt, summary_exp, acct_id
                    ))
                else:
                    new_alert_id = f"ALT-{next_alert_num:05d}"
                    next_alert_num += 1
                    alerts_to_insert.append((
                        new_alert_id, acct_id, risk_score, severity, primary_pattern,
                        "2025-07-11 12:00:00", suspicious_amt, summary_exp, "NEW"
                    ))
            else:
                # If risk dropped below threshold and alert was still 'NEW', prune it from active queue
                if acct_id in existing_alerts and existing_alerts[acct_id][1] == "NEW":
                    alerts_to_delete.append(acct_id)

        # Batch execute updates in single SQLite transaction
        cursor.executemany("""
            UPDATE accounts 
            SET risk_score = ?, risk_level = ?, primary_pattern = ?,
                pattern_fan_in_out = ?, pattern_pass_through = ?,
                pattern_circular = ?, pattern_shared_id = ?,
                investigation_status = ?
            WHERE account_id = ?
        """, acct_updates)

        cursor.executemany("""
            UPDATE risk_scores
            SET risk_score = ?, risk_level = ?, fan_in_out_score = ?,
                pass_through_score = ?, cycle_score = ?, shared_identifier_score = ?,
                evidence_reasons = ?
            WHERE account_id = ?
        """, risk_updates)

        if alerts_to_update:
            cursor.executemany("""
                UPDATE alerts
                SET risk_score = ?, severity = ?, pattern = ?, amount = ?, explanation = ?
                WHERE account_id = ?
            """, alerts_to_update)

        if alerts_to_insert:
            cursor.executemany("""
                INSERT INTO alerts (alert_id, account_id, risk_score, severity, pattern, detected_at, amount, explanation, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, alerts_to_insert)

        if alerts_to_delete:
            cursor.executemany("DELETE FROM alerts WHERE account_id = ? AND status = 'NEW'", [(aid,) for aid in alerts_to_delete])

        conn.commit()

        # Query updated open alerts count
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE status = 'NEW'")
        open_alerts_count = cursor.fetchone()[0]

    elapsed = time.time() - t0
    return {
        "success": True,
        "elapsed_seconds": round(elapsed, 3),
        "total_accounts": len(accounts),
        "suspicious_accounts": total_crit + total_high,
        "critical_risk_accounts": total_crit,
        "high_risk_accounts": total_high,
        "open_alerts": open_alerts_count,
        "active_alerts_total": len(existing_alerts) - len(alerts_to_delete) + len(alerts_to_insert),
        "pattern_breakdown": {
            "Fan-in / Fan-out": total_fan,
            "Pass-through Mule": total_pt,
            "Circular / Reciprocal": total_cycle,
            "New Account / Cluster": total_shared
        }
    }
