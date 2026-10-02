import os
import sys
import time
import math
import json
import sqlite3
import polars as pl
import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "EDA-Phase-1")
DB_PATH = os.path.join(BASE_DIR, "muletrace.db")
CACHE_DIR = os.path.join(BASE_DIR, "cache")
os.makedirs(CACHE_DIR, exist_ok=True)
PARQUET_TXN_PATH = os.path.join(CACHE_DIR, "transactions.parquet")

def build_database():
    print("=" * 60)
    print("MULETRACE DATABASE GENERATOR & ANALYTICS PIPELINE")
    print("=" * 60)
    t0 = time.time()

    # 1. Load static tables
    print("\n[1/6] Ingesting static tables (Accounts, Customers, Linkage)...")
    accounts_df = pl.read_csv(os.path.join(DATA_DIR, "accounts.csv"))
    customers_df = pl.read_csv(os.path.join(DATA_DIR, "customers.csv"))
    linkage_df = pl.read_csv(os.path.join(DATA_DIR, "customer_account_linkage.csv"))

    # Join customer metadata onto account
    # Linkage: customer_id, account_id
    acct_meta = accounts_df.join(linkage_df, on="account_id", how="left").join(customers_df, on="customer_id", how="left")
    print(f"  Joined account metadata: {len(acct_meta)} rows")

    # Demographic clustering for Pattern 4: New Accounts & Shared Identifiers
    print("  Computing demographic clustering (PIN, branch, multi-account)...")
    pin_counts = acct_meta.group_by("customer_pin").len().rename({"len": "pin_cluster_size"})
    branch_counts = acct_meta.group_by("branch_code").len().rename({"len": "branch_cluster_size"})
    cust_acct_counts = linkage_df.group_by("customer_id").len().rename({"len": "customer_accounts_count"})

    acct_meta = acct_meta.join(pin_counts, on="customer_pin", how="left")
    acct_meta = acct_meta.join(branch_counts, on="branch_code", how="left")
    acct_meta = acct_meta.join(cust_acct_counts, on="customer_id", how="left")

    # 2. Process Transactions (7.4M records)
    print("\n[2/6] Scanning 7.4M transactions via Polars LazyFrame...")
    txn_files = [os.path.join(DATA_DIR, f"transactions_part_{i}.csv") for i in range(6)]
    lazy_txns = pl.concat([pl.scan_csv(f) for f in txn_files])

    # Convert timestamp and clean amounts
    cleaned_txns = lazy_txns.with_columns([
        pl.when(pl.col("amount") > 0).then(pl.col("amount")).otherwise(0.0).alias("pos_amount"),
        pl.col("transaction_timestamp").str.to_datetime("%Y-%m-%dT%H:%M:%S").alias("dt")
    ])

    # Account-level behavioral aggregates
    print("  Aggregating velocity, flow volumes, and counterparty metrics...")
    acct_aggs = cleaned_txns.group_by("account_id").agg([
        pl.len().alias("total_tx_count"),
        (pl.col("txn_type") == "C").sum().alias("credit_tx_count"),
        (pl.col("txn_type") == "D").sum().alias("debit_tx_count"),
        pl.col("pos_amount").filter(pl.col("txn_type") == "C").sum().alias("credit_volume"),
        pl.col("pos_amount").filter(pl.col("txn_type") == "D").sum().alias("debit_volume"),
        pl.col("counterparty_id").filter(pl.col("txn_type") == "C").n_unique().alias("unique_incoming_cps"),
        pl.col("counterparty_id").filter(pl.col("txn_type") == "D").n_unique().alias("unique_outgoing_cps"),
        pl.col("counterparty_id").n_unique().alias("total_unique_cps"),
        pl.col("counterparty_id").filter(pl.col("counterparty_id").str.starts_with("CP_FOREIGN_")).count().alias("foreign_tx_count"),
        pl.col("counterparty_id").filter(pl.col("counterparty_id").str.starts_with("CP_EMPL_")).count().alias("employer_tx_count"),
        pl.col("dt").min().alias("first_tx_dt"),
        pl.col("dt").max().alias("last_tx_dt"),
        pl.col("pos_amount").filter(pl.col("txn_type") == "C").max().alias("max_credit_amount"),
        pl.col("pos_amount").filter(pl.col("txn_type") == "D").max().alias("max_debit_amount")
    ]).collect()

    # Reciprocal counterparty flows (Pattern 2)
    print("  Analyzing reciprocal bipartite flows (Account <-> Counterparty)...")
    reciprocal_df = (
        cleaned_txns.group_by(["account_id", "counterparty_id"])
        .agg([
            (pl.col("txn_type") == "C").any().alias("has_c"),
            (pl.col("txn_type") == "D").any().alias("has_d")
        ])
        .filter(pl.col("has_c") & pl.col("has_d"))
        .group_by("account_id")
        .agg(pl.len().alias("reciprocal_cp_count"))
    ).collect()

    # 3. Cache transactions to fast Parquet for sub-second lookups
    if not os.path.exists(PARQUET_TXN_PATH):
        print("\n[3/6] Exporting transactions to indexed Parquet cache for instantaneous API lookups...")
        t_pq = time.time()
        # Collect with compact types
        all_txns = cleaned_txns.select([
            "transaction_id", "account_id", "transaction_timestamp",
            "mcc_code", "channel", "amount", "txn_type", "counterparty_id"
        ]).collect()
        all_txns.write_parquet(PARQUET_TXN_PATH, compression="zstd")
        print(f"  Exported {len(all_txns):,} transactions to Parquet in {time.time()-t_pq:.2f}s!")
    else:
        print("\n[3/6] Parquet transactions cache already exists, skipping export.")

    # 4. Merge All Features & Run Detection Engines
    print("\n[4/6] Running MuleTrace Detection Engines & Risk Scoring...")
    full_df = acct_meta.join(acct_aggs, on="account_id", how="left").join(reciprocal_df, on="account_id", how="left")

    # Fill nulls for accounts with zero transactions
    full_df = full_df.with_columns([
        pl.col("total_tx_count").fill_null(0),
        pl.col("credit_tx_count").fill_null(0),
        pl.col("debit_tx_count").fill_null(0),
        pl.col("credit_volume").fill_null(0.0),
        pl.col("debit_volume").fill_null(0.0),
        pl.col("unique_incoming_cps").fill_null(0),
        pl.col("unique_outgoing_cps").fill_null(0),
        pl.col("total_unique_cps").fill_null(0),
        pl.col("reciprocal_cp_count").fill_null(0),
        pl.col("foreign_tx_count").fill_null(0),
        pl.col("employer_tx_count").fill_null(0),
        pl.col("avg_balance").fill_null(0.0),
        pl.col("daily_avg_balance").fill_null(0.0),
        pl.col("monthly_avg_balance").fill_null(0.0),
    ])

    # Convert to Python dicts for granular pattern detection & explainable scoring
    records = full_df.to_dicts()
    
    accounts_rows = []
    alerts_rows = []
    risk_scores_rows = []
    
    alert_counter = 1
    # Reference date for dataset: 2025-07-11
    ref_date = pd.to_datetime("2025-07-11")

    for r in records:
        acct_id = r["account_id"]
        tx_count = r["total_tx_count"]
        cred_vol = r["credit_volume"]
        deb_vol = r["debit_volume"]
        in_cps = r["unique_incoming_cps"]
        out_cps = r["unique_outgoing_cps"]
        recip_cps = r["reciprocal_cp_count"]
        avg_bal = r["avg_balance"]
        daily_bal = r["daily_avg_balance"]
        
        # Account tenure
        opening_dt = pd.to_datetime(r["account_opening_date"]) if r["account_opening_date"] else ref_date
        account_age_days = max(1, (ref_date - opening_dt).days)
        is_new_account = account_age_days <= 180

        # Pass-through ratio
        pt_ratio = (deb_vol / cred_vol) if cred_vol > 1000 else 0.0

        # Velocity (tx per active day)
        if r["first_tx_dt"] and r["last_tx_dt"]:
            first_dt = pd.to_datetime(r["first_tx_dt"])
            last_dt = pd.to_datetime(r["last_tx_dt"])
            span_days = max(1, (last_dt - first_dt).days)
        else:
            span_days = max(1, account_age_days)
        tx_velocity = tx_count / span_days

        # ==========================================
        # DETECTION ENGINES
        # ==========================================
        evidence_reasons = []

        # 1. Pattern: Fan-In -> Fan-Out
        # Account receives from many counterparties and disperses to many counterparties
        fan_in_out_flag = (in_cps >= 15 and out_cps >= 15) or (in_cps >= 10 and out_cps >= 10 and tx_count >= 50)
        fan_score = 0.0
        if in_cps >= 20 and out_cps >= 20:
            fan_score = 25.0
            evidence_reasons.append(f"High Fan-In/Fan-Out: Received from {in_cps} unique counterparties and sent to {out_cps} counterparties")
        elif in_cps >= 12 and out_cps >= 12:
            fan_score = 18.0
            evidence_reasons.append(f"Elevated Fan-In/Fan-Out: {in_cps} incoming counterparties, {out_cps} outgoing counterparties")
        elif in_cps >= 8 and out_cps >= 8:
            fan_score = 10.0

        # 2. Pattern: Pass-Through / Mule Behavior
        # High inflow rapidly forwarded with negligible retained balance
        pt_flag = False
        pt_score = 0.0
        retained_ratio = (avg_bal / cred_vol) if cred_vol > 50000 else 1.0
        
        if cred_vol >= 100000 and 0.88 <= pt_ratio <= 1.12:
            pt_flag = True
            if retained_ratio <= 0.05:
                pt_score = 25.0
                evidence_reasons.append(f"Critical Pass-Through: {pt_ratio*100:.1f}% of ₹{cred_vol:,.0f} inflow dispersed; retained balance ratio is only {retained_ratio*100:.1f}%")
            elif retained_ratio <= 0.15:
                pt_score = 20.0
                evidence_reasons.append(f"High Pass-Through: {pt_ratio*100:.1f}% of incoming funds dispersed (₹{deb_vol:,.0f} outgoing)")
            else:
                pt_score = 14.0
        elif cred_vol >= 50000 and 0.85 <= pt_ratio <= 1.15:
            pt_score = 12.0
            if retained_ratio <= 0.10:
                pt_flag = True
                evidence_reasons.append(f"Rapid Transit: Inflow of ₹{cred_vol:,.0f} closely matched by outflow of ₹{deb_vol:,.0f}")

        # 3. Pattern: Circular / Reciprocal Flow (Bipartite)
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

        # 4. Pattern: New Account / Shared Identifiers
        shared_id_flag = False
        shared_id_score = 0.0
        pin_cluster = r.get("pin_cluster_size", 0) or 0
        cust_accts = r.get("customer_accounts_count", 1) or 1
        branch_cluster = r.get("branch_cluster_size", 0) or 0
        
        # Missing core KYC docs
        pan_missing = r.get("pan_available") in ["N", None]
        aadhaar_missing = r.get("aadhaar_available") in ["N", None]
        kyc_weak = pan_missing and aadhaar_missing

        if is_new_account and tx_count >= 25 and (pin_cluster >= 15 or cust_accts > 1 or kyc_weak):
            shared_id_flag = True
            shared_id_score = 15.0
            detail = []
            if pin_cluster >= 15: detail.append(f"PIN cluster of {pin_cluster} accounts")
            if cust_accts > 1: detail.append(f"linked to multi-account customer ({cust_accts} accounts)")
            if kyc_weak: detail.append("incomplete PAN & Aadhaar KYC")
            evidence_reasons.append(f"New Account Ring Indicator: Opened {account_age_days}d ago with high activity; " + ", ".join(detail))
        elif is_new_account and tx_count >= 30:
            shared_id_score = 8.0
            evidence_reasons.append(f"High Velocity on New Account: {tx_count} transactions within {account_age_days} days of account opening")
        elif cust_accts > 1 and tx_count >= 50:
            shared_id_score = 6.0

        # Velocity & Burst Score (0 to 10)
        vel_score = 0.0
        if tx_velocity >= 1.5 and tx_count >= 50:
            vel_score = 10.0
            evidence_reasons.append(f"High Velocity Burst: Averaging {tx_velocity:.2f} transactions/day across active window")
        elif tx_velocity >= 0.8 and tx_count >= 30:
            vel_score = 6.0

        # Balance Behavior Score (0 to 10)
        bal_score = 0.0
        if avg_bal < 0:
            bal_score = 10.0
            evidence_reasons.append(f"Negative Balance Operation: Average balance is ₹{avg_bal:,.2f} despite substantial transaction volume")
        elif cred_vol >= 100000 and avg_bal < 5000:
            bal_score = 7.0

        # Combine into Final Normalized Risk Score (0 - 100)
        raw_risk = fan_score + pt_score + cycle_score + shared_id_score + vel_score + bal_score
        risk_score = min(100, int(round(raw_risk)))

        # Severity level
        if risk_score >= 80:
            severity = "CRITICAL"
            risk_level = "CRITICAL"
        elif risk_score >= 60:
            severity = "HIGH"
            risk_level = "HIGH"
        elif risk_score >= 30:
            severity = "MEDIUM"
            risk_level = "MEDIUM"
        else:
            severity = "LOW"
            risk_level = "LOW"

        # Determine Primary Pattern Name
        active_patterns = []
        if fan_in_out_flag: active_patterns.append("Fan-in / Fan-out")
        if pt_flag: active_patterns.append("Pass-through Mule")
        if cycle_flag: active_patterns.append("Circular / Reciprocal")
        if shared_id_flag: active_patterns.append("New Account / Cluster")

        primary_pattern = active_patterns[0] if active_patterns else "General Behavioral Anomaly"

        # Ensure at least 1 reason if flagged high/critical
        if risk_score >= 60 and not evidence_reasons:
            evidence_reasons.append(f"Disproportionate transaction turnover relative to account tenure ({tx_count} transactions)")

        # Prepare accounts table row
        accounts_rows.append({
            "account_id": acct_id,
            "customer_id": r["customer_id"],
            "account_status": r["account_status"],
            "product_code": r["product_code"],
            "product_family": r["product_family"],
            "account_opening_date": r["account_opening_date"],
            "account_age_days": account_age_days,
            "branch_code": r["branch_code"],
            "branch_pin": r["branch_pin"],
            "avg_balance": avg_bal,
            "daily_avg_balance": daily_bal,
            "monthly_avg_balance": r["monthly_avg_balance"],
            "kyc_compliant": r["kyc_compliant"],
            "total_tx_count": tx_count,
            "credit_tx_count": r["credit_tx_count"],
            "debit_tx_count": r["debit_tx_count"],
            "credit_volume": cred_vol,
            "debit_volume": deb_vol,
            "unique_incoming_cps": in_cps,
            "unique_outgoing_cps": out_cps,
            "reciprocal_cp_count": recip_cps,
            "pass_through_ratio": round(pt_ratio, 4),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "primary_pattern": primary_pattern,
            "pattern_fan_in_out": 1 if fan_in_out_flag else 0,
            "pattern_pass_through": 1 if pt_flag else 0,
            "pattern_circular": 1 if cycle_flag else 0,
            "pattern_shared_id": 1 if shared_id_flag else 0,
            "investigation_status": "NEW" if risk_score >= 60 else "UNFLAGGED",
            "analyst_notes": ""
        })

        # Prepare risk scores breakdown
        risk_scores_rows.append({
            "account_id": acct_id,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "fan_in_out_score": fan_score,
            "pass_through_score": pt_score,
            "cycle_score": cycle_score,
            "shared_identifier_score": shared_id_score,
            "velocity_score": vel_score,
            "balance_behavior_score": bal_score,
            "evidence_reasons": json.dumps(evidence_reasons)
        })

        # Generate alert if HIGH or CRITICAL
        if risk_score >= 60:
            alert_id = f"ALT-{alert_counter:05d}"
            alert_counter += 1
            
            # Highlight total suspicious volume
            suspicious_amt = max(cred_vol, deb_vol)
            summary_exp = "; ".join(evidence_reasons[:2]) if evidence_reasons else "Elevated risk profile detected across behavioral indicators."

            alerts_rows.append({
                "alert_id": alert_id,
                "account_id": acct_id,
                "risk_score": risk_score,
                "severity": severity,
                "pattern": primary_pattern,
                "detected_at": "2025-07-11 12:00:00",
                "amount": round(suspicious_amt, 2),
                "explanation": summary_exp,
                "status": "NEW"
            })

    print(f"  Processed {len(accounts_rows):,} accounts.")
    print(f"  Generated {len(alerts_rows):,} high/critical alerts!")

    # 5. Build SQLite Database with optimized schema & indexes
    print("\n[5/6] Writing to SQLite database:", DB_PATH)
    if os.path.exists(DB_PATH):
        try: os.remove(DB_PATH)
        except: pass

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
    CREATE TABLE accounts (
        account_id TEXT PRIMARY KEY,
        customer_id TEXT,
        account_status TEXT,
        product_code INTEGER,
        product_family TEXT,
        account_opening_date TEXT,
        account_age_days INTEGER,
        branch_code INTEGER,
        branch_pin REAL,
        avg_balance REAL,
        daily_avg_balance REAL,
        monthly_avg_balance REAL,
        kyc_compliant TEXT,
        total_tx_count INTEGER,
        credit_tx_count INTEGER,
        debit_tx_count INTEGER,
        credit_volume REAL,
        debit_volume REAL,
        unique_incoming_cps INTEGER,
        unique_outgoing_cps INTEGER,
        reciprocal_cp_count INTEGER,
        pass_through_ratio REAL,
        risk_score INTEGER,
        risk_level TEXT,
        primary_pattern TEXT,
        pattern_fan_in_out INTEGER,
        pattern_pass_through INTEGER,
        pattern_circular INTEGER,
        pattern_shared_id INTEGER,
        investigation_status TEXT,
        analyst_notes TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE risk_scores (
        account_id TEXT PRIMARY KEY,
        risk_score INTEGER,
        risk_level TEXT,
        fan_in_out_score REAL,
        pass_through_score REAL,
        cycle_score REAL,
        shared_identifier_score REAL,
        velocity_score REAL,
        balance_behavior_score REAL,
        evidence_reasons TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE alerts (
        alert_id TEXT PRIMARY KEY,
        account_id TEXT,
        risk_score INTEGER,
        severity TEXT,
        pattern TEXT,
        detected_at TEXT,
        amount REAL,
        explanation TEXT,
        status TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE customers (
        customer_id TEXT PRIMARY KEY,
        date_of_birth TEXT,
        relationship_start_date TEXT,
        pan_available TEXT,
        aadhaar_available TEXT,
        passport_available TEXT,
        mobile_banking_flag TEXT,
        internet_banking_flag TEXT,
        atm_card_flag TEXT,
        demat_flag TEXT,
        credit_card_flag TEXT,
        fastag_flag TEXT,
        customer_pin INTEGER,
        permanent_pin INTEGER
    )
    """)

    # Populate customers
    print("  Inserting customers...")
    cust_list = customers_df.to_dicts()
    cursor.executemany("""
    INSERT INTO customers VALUES (
        :customer_id, :date_of_birth, :relationship_start_date, :pan_available,
        :aadhaar_available, :passport_available, :mobile_banking_flag,
        :internet_banking_flag, :atm_card_flag, :demat_flag, :credit_card_flag,
        :fastag_flag, :customer_pin, :permanent_pin
    )
    """, cust_list)

    # Populate accounts
    print("  Inserting accounts...")
    cursor.executemany("""
    INSERT INTO accounts VALUES (
        :account_id, :customer_id, :account_status, :product_code, :product_family,
        :account_opening_date, :account_age_days, :branch_code, :branch_pin,
        :avg_balance, :daily_avg_balance, :monthly_avg_balance, :kyc_compliant,
        :total_tx_count, :credit_tx_count, :debit_tx_count, :credit_volume,
        :debit_volume, :unique_incoming_cps, :unique_outgoing_cps, :reciprocal_cp_count,
        :pass_through_ratio, :risk_score, :risk_level, :primary_pattern,
        :pattern_fan_in_out, :pattern_pass_through, :pattern_circular, :pattern_shared_id,
        :investigation_status, :analyst_notes
    )
    """, accounts_rows)

    # Populate risk_scores
    print("  Inserting risk scores...")
    cursor.executemany("""
    INSERT INTO risk_scores VALUES (
        :account_id, :risk_score, :risk_level, :fan_in_out_score, :pass_through_score,
        :cycle_score, :shared_identifier_score, :velocity_score, :balance_behavior_score,
        :evidence_reasons
    )
    """, risk_scores_rows)

    # Populate alerts
    print("  Inserting alerts...")
    cursor.executemany("""
    INSERT INTO alerts VALUES (
        :alert_id, :account_id, :risk_score, :severity, :pattern, :detected_at,
        :amount, :explanation, :status
    )
    """, alerts_rows)

    # Create Indexes for lightning fast queries
    print("  Creating database indexes...")
    cursor.execute("CREATE INDEX idx_acct_risk ON accounts(risk_score DESC)")
    cursor.execute("CREATE INDEX idx_acct_status ON accounts(investigation_status)")
    cursor.execute("CREATE INDEX idx_alerts_risk ON alerts(risk_score DESC)")
    cursor.execute("CREATE INDEX idx_alerts_status ON alerts(status)")
    cursor.execute("CREATE INDEX idx_alerts_severity ON alerts(severity)")

    # 6. Precompute Analytics Summary
    print("\n[6/6] Precomputing high-level analytics for instant dashboard rendering...")
    # Time-series aggregates (Monthly transactions & volume across 5 years)
    ts_monthly = cleaned_txns.with_columns(
        pl.col("dt").dt.strftime("%Y-%m").alias("month")
    ).group_by("month").agg([
        pl.len().alias("tx_count"),
        pl.col("pos_amount").sum().alias("total_volume"),
        pl.col("pos_amount").filter(pl.col("txn_type") == "C").sum().alias("credit_volume"),
        pl.col("pos_amount").filter(pl.col("txn_type") == "D").sum().alias("debit_volume")
    ]).sort("month").collect()

    channel_stats = cleaned_txns.group_by("channel").agg([
        pl.len().alias("count"),
        pl.col("pos_amount").sum().alias("volume")
    ]).sort("count", descending=True).limit(10).collect()

    cursor.execute("""
    CREATE TABLE analytics_monthly (
        month TEXT PRIMARY KEY,
        tx_count INTEGER,
        total_volume REAL,
        credit_volume REAL,
        debit_volume REAL
    )
    """)
    cursor.executemany("INSERT INTO analytics_monthly VALUES (:month, :tx_count, :total_volume, :credit_volume, :debit_volume)", ts_monthly.to_dicts())

    cursor.execute("""
    CREATE TABLE analytics_channels (
        channel TEXT PRIMARY KEY,
        count INTEGER,
        volume REAL
    )
    """)
    cursor.executemany("INSERT INTO analytics_channels VALUES (:channel, :count, :volume)", channel_stats.to_dicts())

    conn.commit()
    conn.close()

    print("\n" + "=" * 60)
    print(f"DATABASE INITIALIZATION COMPLETED IN {time.time()-t0:.2f} SECONDS!")
    print(f"SQLite DB: {DB_PATH}")
    print(f"Parquet Cache: {PARQUET_TXN_PATH}")
    print("=" * 60)

if __name__ == "__main__":
    build_database()
