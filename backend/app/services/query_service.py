import os
import json
import sqlite3
import glob
import polars as pl
from app.config import settings
from app.db import get_db

PARQUET_PATH = os.path.join(settings.BASE_DIR, "cache", "transactions.parquet")

def _scan_baseline_transactions():
    if os.path.exists(PARQUET_PATH):
        return pl.scan_parquet(PARQUET_PATH)

    transaction_files = sorted(
        glob.glob(os.path.join(settings.DATA_DIR, "transactions_part_*.csv"))
    )
    if not transaction_files:
        return None

    return pl.concat([pl.scan_csv(path) for path in transaction_files])

def get_dashboard_summary():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Total accounts
        cursor.execute("SELECT COUNT(*) FROM accounts")
        total_accounts = cursor.fetchone()[0]
        
        # Suspicious accounts (risk_score >= settings.RISK_HIGH_THRESHOLD)
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE risk_score >= ?", (settings.RISK_HIGH_THRESHOLD,))
        suspicious_accounts = cursor.fetchone()[0]
        
        # Open alerts
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE status = 'NEW'")
        open_alerts = cursor.fetchone()[0]
        
        # High & Critical risk accounts
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE risk_score >= ?", (settings.RISK_CRITICAL_THRESHOLD,))
        critical_risk = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE risk_score >= ? AND risk_score < ?", (settings.RISK_HIGH_THRESHOLD, settings.RISK_CRITICAL_THRESHOLD))
        high_risk = cursor.fetchone()[0]
        
        # Confirmed investigations
        cursor.execute("SELECT COUNT(*) FROM accounts WHERE investigation_status = 'CONFIRMED'")
        confirmed_investigations = cursor.fetchone()[0]

        # Dynamic transactions count from SQLite
        cursor.execute("SELECT COUNT(*) FROM transactions")
        dynamic_txns_count = cursor.fetchone()[0]
        total_transactions_analyzed = 7424845 + dynamic_txns_count

        # Risk distribution
        cursor.execute("SELECT risk_level, COUNT(*) FROM accounts GROUP BY risk_level")
        risk_dist = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Fraud pattern breakdown
        cursor.execute("SELECT SUM(pattern_fan_in_out), SUM(pattern_pass_through), SUM(pattern_circular), SUM(pattern_shared_id) FROM accounts")
        row = cursor.fetchone()
        pattern_breakdown = {
            "Fan-in / Fan-out": row[0] or 0,
            "Pass-through Mule": row[1] or 0,
            "Circular / Reciprocal": row[2] or 0,
            "New Account / Cluster": row[3] or 0
        }
        
        # Recent Alerts (Top 8)
        cursor.execute("""
            SELECT alert_id, account_id, risk_score, severity, pattern, amount, detected_at, status, explanation
            FROM alerts
            ORDER BY risk_score DESC, detected_at DESC
            LIMIT 8
        """)
        recent_alerts = [dict(r) for r in cursor.fetchall()]
        
        # Top Suspicious Accounts (Top 8)
        cursor.execute("""
            SELECT account_id, risk_score, risk_level, primary_pattern, total_tx_count, credit_volume, debit_volume, pass_through_ratio, investigation_status
            FROM accounts
            ORDER BY risk_score DESC, (credit_volume + debit_volume) DESC
            LIMIT 8
        """)
        top_suspicious = [dict(r) for r in cursor.fetchall()]
        
        # Time-series summary (monthly volume)
        cursor.execute("""
            SELECT month, tx_count, total_volume, credit_volume, debit_volume
            FROM analytics_monthly
            ORDER BY month ASC
        """)
        timeline = [dict(r) for r in cursor.fetchall()]
        
        return {
            "kpis": {
                "total_accounts": total_accounts,
                "transactions_analyzed": total_transactions_analyzed,
                "suspicious_accounts": suspicious_accounts,
                "open_alerts": open_alerts,
                "critical_risk_accounts": critical_risk,
                "high_risk_accounts": high_risk,
                "confirmed_investigations": confirmed_investigations,
                "risk_high_threshold": settings.RISK_HIGH_THRESHOLD,
                "risk_critical_threshold": settings.RISK_CRITICAL_THRESHOLD,
                "fan_in_min_cps": settings.FAN_IN_MIN_CPS,
                "fan_out_min_cps": settings.FAN_OUT_MIN_CPS,
                "pass_through_min_ratio": settings.PASS_THROUGH_MIN_RATIO,
                "new_account_max_days": settings.NEW_ACCOUNT_MAX_DAYS
            },
            "risk_distribution": risk_dist,
            "pattern_breakdown": pattern_breakdown,
            "recent_alerts": recent_alerts,
            "top_suspicious_accounts": top_suspicious,
            "timeline": timeline
        }

def get_alerts_paginated(page=1, page_size=20, severity=None, pattern=None, status=None, search=None, sort_by="risk_score", sort_order="desc"):
    with get_db() as conn:
        cursor = conn.cursor()
        
        conditions = []
        params = []
        
        if severity and severity.upper() != "ALL":
            conditions.append("severity = ?")
            params.append(severity.upper())
        if pattern and pattern != "ALL":
            conditions.append("pattern LIKE ?")
            params.append(f"%{pattern}%")
        if status and status.upper() != "ALL":
            conditions.append("status = ?")
            params.append(status.upper())
        if search:
            conditions.append("(alert_id LIKE ? OR account_id LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
            
        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        
        # Total count
        cursor.execute(f"SELECT COUNT(*) FROM alerts {where_clause}", params)
        total = cursor.fetchone()[0]
        
        # Order and limit
        valid_sort_cols = {"risk_score", "amount", "detected_at", "alert_id", "severity", "status"}
        col = sort_by if sort_by in valid_sort_cols else "risk_score"
        order = "DESC" if sort_order.lower() == "desc" else "ASC"
        
        offset = (page - 1) * page_size
        query = f"""
            SELECT alert_id, account_id, risk_score, severity, pattern, detected_at, amount, explanation, status
            FROM alerts
            {where_clause}
            ORDER BY {col} {order}
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [page_size, offset])
        items = [dict(r) for r in cursor.fetchall()]
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }

def get_accounts_paginated(page=1, page_size=20, risk_level=None, pattern=None, status=None, search=None, sort_by="risk_score", sort_order="desc"):
    with get_db() as conn:
        cursor = conn.cursor()
        conditions = []
        params = []
        
        if risk_level and risk_level.upper() != "ALL":
            conditions.append("risk_level = ?")
            params.append(risk_level.upper())
        if pattern and pattern != "ALL":
            if pattern == "Fan-in / Fan-out":
                conditions.append("pattern_fan_in_out = 1")
            elif pattern == "Pass-through Mule":
                conditions.append("pattern_pass_through = 1")
            elif pattern == "Circular / Reciprocal":
                conditions.append("pattern_circular = 1")
            elif pattern == "New Account / Cluster":
                conditions.append("pattern_shared_id = 1")
        if status and status.upper() != "ALL":
            conditions.append("investigation_status = ?")
            params.append(status.upper())
        if search:
            conditions.append("(account_id LIKE ? OR customer_id LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
            
        where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        
        cursor.execute(f"SELECT COUNT(*) FROM accounts {where_clause}", params)
        total = cursor.fetchone()[0]
        
        valid_sort_cols = {"risk_score", "credit_volume", "debit_volume", "total_tx_count", "pass_through_ratio", "account_opening_date"}
        col = sort_by if sort_by in valid_sort_cols else "risk_score"
        order = "DESC" if sort_order.lower() == "desc" else "ASC"
        
        offset = (page - 1) * page_size
        query = f"""
            SELECT account_id, customer_id, account_status, product_family, account_opening_date,
                   account_age_days, branch_code, avg_balance, kyc_compliant, total_tx_count,
                   credit_volume, debit_volume, unique_incoming_cps, unique_outgoing_cps,
                   reciprocal_cp_count, pass_through_ratio, risk_score, risk_level,
                   primary_pattern, pattern_fan_in_out, pattern_pass_through, pattern_circular,
                   pattern_shared_id, investigation_status
            FROM accounts
            {where_clause}
            ORDER BY {col} {order}
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [page_size, offset])
        items = [dict(r) for r in cursor.fetchall()]
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }

def get_account_profile(account_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Account info
        cursor.execute("SELECT * FROM accounts WHERE account_id = ?", (account_id,))
        acct_row = cursor.fetchone()
        if not acct_row:
            return None
        acct_dict = dict(acct_row)
        
        # Customer info
        cust_id = acct_dict.get("customer_id")
        cust_dict = {}
        if cust_id:
            cursor.execute("SELECT * FROM customers WHERE customer_id = ?", (cust_id,))
            cust_row = cursor.fetchone()
            if cust_row:
                cust_dict = dict(cust_row)
                
        # Risk score breakdown
        cursor.execute("SELECT * FROM risk_scores WHERE account_id = ?", (account_id,))
        risk_row = cursor.fetchone()
        risk_dict = {}
        if risk_row:
            risk_dict = dict(risk_row)
            try:
                risk_dict["evidence_reasons"] = json.loads(risk_dict.get("evidence_reasons", "[]"))
            except:
                risk_dict["evidence_reasons"] = []
                
        # Alert info if any
        cursor.execute("SELECT * FROM alerts WHERE account_id = ? ORDER BY detected_at DESC LIMIT 1", (account_id,))
        alert_row = cursor.fetchone()
        alert_dict = dict(alert_row) if alert_row else None
        
        return {
            "account": acct_dict,
            "customer": cust_dict,
            "risk": risk_dict,
            "alert": alert_dict
        }

def get_account_transactions(account_id: str, page=1, page_size=50, txn_type=None, sort_order="desc"):
    """
    Unified Transaction Query:
    Checks newly ingested transactions in SQLite first, and combines with baseline Parquet records.
    """
    items = []

    # 1. Query dynamic transactions from SQLite
    with get_db() as conn:
        cursor = conn.cursor()
        conds = ["account_id = ?"]
        params = [account_id]
        if txn_type and txn_type.upper() in ["C", "D"]:
            conds.append("txn_type = ?")
            params.append(txn_type.upper())
            
        cursor.execute(f"""
            SELECT transaction_id, account_id, transaction_timestamp, mcc_code,
                   channel, amount, txn_type, counterparty_id
            FROM transactions
            WHERE {" AND ".join(conds)}
            ORDER BY transaction_timestamp {"DESC" if sort_order.lower() == "desc" else "ASC"}
        """, params)
        sqlite_txns = [dict(r) for r in cursor.fetchall()]
        items.extend(sqlite_txns)
        
    # 2. Query historical baseline transactions from Parquet cache or CSV scan
    baseline_scan = _scan_baseline_transactions()
    if baseline_scan is not None:
        try:
            lf = baseline_scan.filter(pl.col("account_id") == account_id)
            if txn_type and txn_type.upper() in ["C", "D"]:
                lf = lf.filter(pl.col("txn_type") == txn_type.upper())
            df = lf.sort("transaction_timestamp", descending=(sort_order.lower() == "desc")).collect()
            items.extend(df.to_dicts())
        except:
            pass

    # Sort combined
    reverse = (sort_order.lower() == "desc")
    items.sort(key=lambda x: str(x.get("transaction_timestamp", "")), reverse=reverse)
    total = len(items)
    
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_items = items[start_idx:end_idx]
    
    return {
        "items": paginated_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0
    }

CHANNEL_MODE_MAP = {
    "UPD": "UPI (Unified Payments)",
    "UPC": "UPI Collection",
    "IPM": "IMPS (Immediate Payment)",
    "RTD": "RTGS (Real Time Gross)",
    "RTG": "RTGS (Real Time Gross)",
    "NTD": "NEFT (National Electronic Transfer)",
    "CSD": "Cash Deposit",
    "ATW": "ATM Cash Withdrawal",
    "ATM": "ATM Transaction",
    "CHQ": "Cheque Clearance",
    "P2A": "AutoPay / Standing Mandate",
    "END": "Net Banking Transfer",
    "FTD": "Fund Transfer (Debit)",
    "FTC": "Fund Transfer (Credit)",
    "IAD": "Internet Banking",
    "SCW": "Self Cheque Withdrawal",
    "CCL": "Credit Card Clearance",
    "CHD": "Cheque Deposit",
    "MCR": "Mobile Banking Transfer",
    "RCD": "Recurring Deposit Settlement",
    "IFC": "Interbank Funds Credit",
    "ASD": "Automated Standing Debit",
    "PCA": "POS Card Settlement",
    "STD": "Standing Instruction",
    "CTC": "Corporate Transfer Clearing",
    "OCD": "Online Gateway Clearance",
    "ETD": "Electronic Fund Transfer",
    "STC": "Settlement Credit",
    "TPC": "Third-Party Credit",
    "TPD": "Third-Party Debit",
    "MAD": "Merchant Payment Debit",
    "MAC": "Merchant Payment Credit",
    "IFD": "Interbank Funds Debit",
    "OPI": "Online Payment Interface",
    "NWD": "Network Wire Transfer",
    "APD": "Aadhaar Payment Service",
    "SID": "Standing Instruction Debit"
}

def get_account_history(
    account_id: str,
    start_date=None,
    end_date=None,
    min_amount=None,
    max_amount=None,
    txn_type=None,
    page=1,
    page_size=25,
    sort_order="desc",
    all_records=False
):
    """
    Forensic Account History Query:
    Returns full filtered transaction history, dynamic summary analytics (inflow, outflow,
    net balance change, count, opening/closing balance), and date-wise flow visualization data.
    """
    # 1. Fetch Account and Customer profile info from SQLite
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT account_id, customer_id, account_status, avg_balance, daily_avg_balance,
                   monthly_avg_balance, account_opening_date, kyc_compliant, product_family
            FROM accounts
            WHERE account_id = ?
        """, (account_id,))
        acct_row = cursor.fetchone()
        if not acct_row:
            return None
        acct = dict(acct_row)

        cursor.execute("SELECT customer_id, date_of_birth FROM customers WHERE customer_id = ?", (acct.get("customer_id"),))
        cust_row = cursor.fetchone()
        cust = dict(cust_row) if cust_row else {}

        # Query dynamic transactions from SQLite for this account with filters
        conds = ["account_id = ?"]
        params = [account_id]
        if start_date:
            s_dt = start_date if "T" in start_date else f"{start_date}T00:00:00"
            conds.append("transaction_timestamp >= ?")
            params.append(s_dt)
        if end_date:
            e_dt = end_date if "T" in end_date else f"{end_date}T23:59:59"
            conds.append("transaction_timestamp <= ?")
            params.append(e_dt)
        if min_amount is not None:
            conds.append("amount >= ?")
            params.append(float(min_amount))
        if max_amount is not None:
            conds.append("amount <= ?")
            params.append(float(max_amount))
        if txn_type and txn_type.upper() in ["C", "D"]:
            conds.append("txn_type = ?")
            params.append(txn_type.upper())

        cursor.execute(f"""
            SELECT transaction_id, account_id, transaction_timestamp, mcc_code,
                   channel, amount, txn_type, counterparty_id
            FROM transactions
            WHERE {" AND ".join(conds)}
        """, params)
        raw_items = [dict(r) for r in cursor.fetchall()]

    # 2. Query historical baseline transactions from cache or CSV scan
    baseline_scan = _scan_baseline_transactions()
    if baseline_scan is not None:
        try:
            lf = baseline_scan.filter(pl.col("account_id") == account_id)
            if start_date:
                s_dt = start_date if "T" in start_date else f"{start_date}T00:00:00"
                lf = lf.filter(pl.col("transaction_timestamp") >= s_dt)
            if end_date:
                e_dt = end_date if "T" in end_date else f"{end_date}T23:59:59"
                lf = lf.filter(pl.col("transaction_timestamp") <= e_dt)
            if min_amount is not None:
                lf = lf.filter(pl.col("amount") >= float(min_amount))
            if max_amount is not None:
                lf = lf.filter(pl.col("amount") <= float(max_amount))
            if txn_type and txn_type.upper() in ["C", "D"]:
                lf = lf.filter(pl.col("txn_type") == txn_type.upper())

            base_df = lf.collect()
            raw_items.extend(base_df.to_dicts())
        except Exception as e:
            print(f"[Warning] Baseline history scan error: {e}")

    # De-duplicate by transaction_id
    seen_ids = set()
    unique_items = []
    for item in raw_items:
        tid = item.get("transaction_id")
        if tid not in seen_ids:
            seen_ids.add(tid)
            unique_items.append(item)

    # Chronological sort (ascending) to compute running balances and date flows accurately
    unique_items.sort(key=lambda x: str(x.get("transaction_timestamp", "")))

    total_inflow = 0.0
    total_outflow = 0.0
    opening_bal = float(acct.get("avg_balance") or 0.0)
    current_bal = opening_bal

    date_flow_map = {}

    enriched_items = []
    for item in unique_items:
        amt = float(item.get("amount") or 0.0)
        is_credit = (item.get("txn_type") == "C")
        if is_credit:
            total_inflow += amt
            current_bal += amt
        else:
            total_outflow += amt
            current_bal -= amt

        ch = item.get("channel", "N/A")
        payment_mode = CHANNEL_MODE_MAP.get(ch, f"{ch} Transfer")
        mcc = item.get("mcc_code")
        remarks = f"Channel: {ch}" + (f" | MCC: {mcc}" if mcc else "")

        enriched_item = {
            "transaction_id": item.get("transaction_id"),
            "account_id": item.get("account_id"),
            "transaction_timestamp": item.get("transaction_timestamp"),
            "mcc_code": mcc,
            "channel": ch,
            "payment_mode": payment_mode,
            "amount": amt,
            "txn_type": "C" if is_credit else "D",
            "type_label": "Inflow" if is_credit else "Outflow",
            "counterparty_id": item.get("counterparty_id", "N/A"),
            "counterparty_account": item.get("counterparty_id", "N/A"),
            "balance_after": round(current_bal, 2),
            "status": "COMPLETED",
            "remarks": remarks
        }
        enriched_items.append(enriched_item)

        # Date-wise flow visualization aggregation
        ts = str(item.get("transaction_timestamp", ""))
        d_key = ts.split("T")[0] if "T" in ts else ts.split(" ")[0]
        if d_key:
            if d_key not in date_flow_map:
                date_flow_map[d_key] = {"date": d_key, "inflow": 0.0, "outflow": 0.0, "count": 0}
            if is_credit:
                date_flow_map[d_key]["inflow"] += amt
            else:
                date_flow_map[d_key]["outflow"] += amt
            date_flow_map[d_key]["count"] += 1

    chart_data = sorted(date_flow_map.values(), key=lambda x: x["date"])
    for cd in chart_data:
        cd["inflow"] = round(cd["inflow"], 2)
        cd["outflow"] = round(cd["outflow"], 2)
        cd["net"] = round(cd["inflow"] - cd["outflow"], 2)

    total_count = len(enriched_items)
    net_change = round(total_inflow - total_outflow, 2)
    closing_bal = round(current_bal, 2)

    # Sort final transaction items according to requested sort_order
    is_desc = (sort_order.lower() == "desc")
    enriched_items.sort(key=lambda x: str(x.get("transaction_timestamp", "")), reverse=is_desc)

    summary = {
        "account_id": acct.get("account_id"),
        "customer_id": acct.get("customer_id") or "N/A",
        "account_holder_name": f"Customer {acct.get('customer_id')}" if acct.get("customer_id") else "N/A",
        "account_status": (acct.get("account_status") or "ACTIVE").upper(),
        "total_inflow": round(total_inflow, 2),
        "total_outflow": round(total_outflow, 2),
        "net_balance_change": net_change,
        "total_transactions": total_count,
        "opening_balance": round(opening_bal, 2),
        "closing_balance": closing_bal,
        "account_opening_date": acct.get("account_opening_date") or "N/A",
        "kyc_compliant": acct.get("kyc_compliant") or "N/A"
    }

    if all_records:
        return {
            "summary": summary,
            "chart_data": chart_data,
            "items": enriched_items,
            "total": total_count,
            "page": 1,
            "page_size": total_count,
            "total_pages": 1
        }

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_items = enriched_items[start_idx:end_idx]

    return {
        "summary": summary,
        "chart_data": chart_data,
        "items": paginated_items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if total_count > 0 else 0
    }

def get_account_network_graph(account_id: str, max_cps=25):
    """Build bipartite Account <-> Counterparty network graph with 2-hop bridging"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT account_id, risk_score, risk_level, primary_pattern FROM accounts WHERE account_id = ?", (account_id,))
        focal_acct = cursor.fetchone()
        if not focal_acct:
            return {"nodes": [], "edges": []}
            
        focal_info = dict(focal_acct)

        # 1. Fetch dynamic transactions for this account from SQLite
        cursor.execute("""
            SELECT transaction_id, account_id, transaction_timestamp, mcc_code,
                   channel, amount, txn_type, counterparty_id
            FROM transactions
            WHERE account_id = ?
        """, (account_id,))
        all_txns_list = [dict(r) for r in cursor.fetchall()]

    # Use the generated cache when available, or scan source CSVs on deployments
    # where generated cache files are not included.
    baseline_scan = _scan_baseline_transactions()
    if baseline_scan is not None:
        baseline_txns = baseline_scan.filter(pl.col("account_id") == account_id).collect()
        all_txns_list.extend(baseline_txns.to_dicts())

    if len(all_txns_list) == 0:
        return {
            "nodes": [{
                "id": account_id,
                "label": account_id,
                "type": "ACCOUNT",
                "is_focal": True,
                "risk_score": focal_info["risk_score"],
                "risk_level": focal_info["risk_level"]
            }],
            "edges": []
        }
        

    # Aggregate flows by counterparty using Python dict
    cp_aggs_dict = {}
    for t in all_txns_list:
        cp = t.get("counterparty_id")
        if not cp: continue
        if cp not in cp_aggs_dict:
            cp_aggs_dict[cp] = {"tx_count": 0, "total_amount": 0.0, "credit_count": 0, "debit_count": 0, "credit_amount": 0.0, "debit_amount": 0.0}
        
        amt = abs(t.get("amount") or 0.0)
        is_cred = (t.get("txn_type") == "C")
        cp_aggs_dict[cp]["tx_count"] += 1
        cp_aggs_dict[cp]["total_amount"] += amt
        if is_cred:
            cp_aggs_dict[cp]["credit_count"] += 1
            cp_aggs_dict[cp]["credit_amount"] += amt
        else:
            cp_aggs_dict[cp]["debit_count"] += 1
            cp_aggs_dict[cp]["debit_amount"] += amt

    # Sort counterparties by volume and limit to max_cps
    sorted_cps = sorted(cp_aggs_dict.items(), key=lambda x: x[1]["total_amount"], reverse=True)[:max_cps]
    
    nodes = []
    edges = []
    
    # 1. Focal account node
    nodes.append({
        "id": account_id,
        "label": f"Focal Account\n{account_id}",
        "type": "ACCOUNT",
        "is_focal": True,
        "risk_score": focal_info["risk_score"],
        "risk_level": focal_info["risk_level"],
        "pattern": focal_info["primary_pattern"]
    })
    
    top_cps = set()
    
    # 2. Counterparty nodes & edges to focal
    for cp_id, stat in sorted_cps:
        top_cps.add(cp_id)
        
        # Categorize CP
        sub_cat = "STANDARD"
        if "FOREIGN" in cp_id: sub_cat = "FOREIGN"
        elif "EMPL" in cp_id: sub_cat = "EMPLOYER"
        elif "BR" in cp_id: sub_cat = "BRANCH"
        else: sub_cat = "STANDARD"
        
        nodes.append({
            "id": cp_id,
            "label": cp_id,
            "type": "COUNTERPARTY",
            "category": sub_cat,
            "is_focal": False,
            "tx_count": stat["tx_count"],
            "total_amount": round(stat["total_amount"], 2),
            "is_reciprocal": (stat["credit_count"] > 0 and stat["debit_count"] > 0)
        })
        
        if stat["credit_count"] > 0:
            edges.append({
                "id": f"e_{cp_id}_{account_id}_C",
                "source": cp_id,
                "target": account_id,
                "type": "CREDIT",

                "amount": round(stat["credit_amount"], 2),
                "count": stat["credit_count"],
                "label": f"₹{stat['credit_amount']:,.0f} ({stat['credit_count']}x)"
            })
        # If Debit (money from Account to CP): Account -> CP
        if stat["debit_count"] > 0:
            edges.append({
                "id": f"e_{account_id}_{cp_id}_D",
                "source": account_id,
                "target": cp_id,
                "type": "DEBIT",
                "amount": round(stat["debit_amount"], 2),
                "count": stat["debit_count"],
                "label": f"₹{stat['debit_amount']:,.0f} ({stat['debit_count']}x)"
            })
            
    # 3. 2-Hop Bridging: Discover other accounts connected through these counterparties (limit to 6 secondary accounts)
    if top_cps:
        cp_list = list(top_cps)[:6]
        # Query secondary accounts from SQLite
        with get_db() as conn:
            c = conn.cursor()
            q = f"SELECT account_id, counterparty_id, amount, txn_type FROM transactions WHERE counterparty_id IN ({','.join(['?']*len(cp_list))}) AND account_id != ? LIMIT 10"
            c.execute(q, cp_list + [account_id])
            sec_rows = [dict(r) for r in c.fetchall()]

        # Complement with baseline transactions when available.
        if len(sec_rows) < 6 and baseline_scan is not None:
            baseline_sec = baseline_scan.filter(
                pl.col("counterparty_id").is_in(cp_list)
                & (pl.col("account_id") != account_id)
            ).group_by(["account_id", "counterparty_id"]).agg([
                pl.len().alias("count"),
                pl.col("amount").sum().alias("amount"),
                pl.col("txn_type").first().alias("txn_type")
            ]).sort("amount", descending=True).head(6).collect()
            for pr in baseline_sec.iter_rows(named=True):
                if not any(sr.get("account_id") == pr["account_id"] and sr.get("counterparty_id") == pr["counterparty_id"] for sr in sec_rows):
                    sec_rows.append(pr)

        sec_acct_ids = list(set(r["account_id"] for r in sec_rows if r.get("account_id")))

        if sec_acct_ids:
            with get_db() as conn:
                c = conn.cursor()
                q = f"SELECT account_id, risk_score, risk_level, primary_pattern FROM accounts WHERE account_id IN ({','.join(['?']*len(sec_acct_ids))})"
                c.execute(q, sec_acct_ids)
                sec_meta = {r["account_id"]: dict(r) for r in c.fetchall()}
                
            for r in sec_rows:
                sec_id = r["account_id"]
                cp_id = r["counterparty_id"]
                
                # Add node if not added yet
                if not any(n["id"] == sec_id for n in nodes):
                    m = sec_meta.get(sec_id, {"risk_score": 25, "risk_level": "LOW", "primary_pattern": "Peer Account"})
                    nodes.append({
                        "id": sec_id,
                        "label": f"Peer {sec_id}",
                        "type": "SECONDARY_ACCOUNT",
                        "is_focal": False,
                        "risk_score": m["risk_score"],
                        "risk_level": m["risk_level"],
                        "pattern": m.get("primary_pattern", "Peer Account")
                    })
                    
                # Add edge
                is_cred = (r["txn_type"] == "C")
                src = cp_id if is_cred else sec_id
                dst = sec_id if is_cred else cp_id
                edges.append({
                    "id": f"e_{src}_{dst}_sec",
                    "source": src,
                    "target": dst,
                    "type": "PEER_FLOW",
                    "amount": round(r["amount"] or 0.0, 2),
                    "count": 1,
                    "label": f"₹{r['amount']:,.0f}"
                })
                
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "connected_counterparties": len(top_cps),
            "focal_account": account_id
        }
    }

def update_investigation_status(account_id: str, status: str, notes: str = ""):
    with get_db() as conn:
        cursor = conn.cursor()
        
        target_status = status.upper()
        if target_status in ("RESET", "REDO", "REVERT", "NEW"):
            cursor.execute("SELECT risk_score FROM accounts WHERE account_id = ?", (account_id,))
            row = cursor.fetchone()
            risk_score = row["risk_score"] if row else 0
            
            cursor.execute("SELECT 1 FROM alerts WHERE account_id = ?", (account_id,))
            has_alert = cursor.fetchone() is not None
            
            if risk_score >= settings.RISK_HIGH_THRESHOLD or has_alert:
                target_status = "NEW"
            else:
                target_status = "UNFLAGGED"
        
        cursor.execute("""
            UPDATE accounts
            SET investigation_status = ?, analyst_notes = ?
            WHERE account_id = ?
        """, (target_status, notes, account_id))
        
        cursor.execute("""
            UPDATE alerts
            SET status = ?
            WHERE account_id = ?
        """, (target_status, account_id))
        
        conn.commit()
        return target_status

def get_analytics_data():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Monthly trend
        cursor.execute("SELECT month, tx_count, total_volume, credit_volume, debit_volume FROM analytics_monthly ORDER BY month ASC")
        monthly = [dict(r) for r in cursor.fetchall()]
        
        # Channels
        cursor.execute("SELECT channel, count, volume FROM analytics_channels ORDER BY volume DESC")
        channels = [dict(r) for r in cursor.fetchall()]
        
        # Risk score distribution bins (0-10, 10-20, ... 90-100)
        cursor.execute("""
            SELECT 
                CASE 
                    WHEN risk_score < 20 THEN '0-20'
                    WHEN risk_score < 40 THEN '20-40'
                    WHEN risk_score < 60 THEN '40-60'
                    WHEN risk_score < 80 THEN '60-80'
                    ELSE '80-100'
                END as bucket,
                COUNT(*) as count
            FROM accounts
            GROUP BY bucket
            ORDER BY bucket ASC
        """)
        risk_bins = [dict(r) for r in cursor.fetchall()]
        
        # Pass-through ratio distribution for active accounts
        pt_min_pct = int(round(settings.PASS_THROUGH_MIN_RATIO * 100))
        pt_max_pct = int(round(settings.PASS_THROUGH_MAX_RATIO * 100))
        cursor.execute(f"""
            SELECT 
                CASE 
                    WHEN pass_through_ratio < 0.5 THEN '< 50%'
                    WHEN pass_through_ratio < {settings.PASS_THROUGH_MIN_RATIO} THEN '50% - {pt_min_pct}%'
                    WHEN pass_through_ratio <= {settings.PASS_THROUGH_MAX_RATIO} THEN '{pt_min_pct}% - {pt_max_pct}% (Mule Zone)'
                    WHEN pass_through_ratio <= 1.5 THEN '{pt_max_pct}% - 150%'
                    ELSE '> 150%'
                END as pt_bucket,
                COUNT(*) as count
            FROM accounts
            WHERE credit_volume > 20000
            GROUP BY pt_bucket
        """)
        pt_bins = [dict(r) for r in cursor.fetchall()]
        
        return {
            "monthly_volume": monthly,
            "channel_distribution": channels,
            "risk_score_distribution": risk_bins,
            "pass_through_distribution": pt_bins
        }
