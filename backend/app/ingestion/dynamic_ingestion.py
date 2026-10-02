import os
import sys
import re
import json
import time
import uuid
import datetime
import sqlite3
import pandas as pd
import polars as pl
from typing import Dict, List, Any, Tuple, Optional
from app.config import settings
from app.db import get_db

# Schema Mapping Dictionaries
FIELD_PATTERNS = {
    "account_id": [
        r"^account[_\s]?id$", r"^acct[_\s]?id$", r"^account$", r"^account[_\s]?number$", r"^acct$"
    ],
    "customer_id": [
        r"^customer[_\s]?id$", r"^cust[_\s]?id$", r"^customer$", r"^client[_\s]?id$", r"^cust$"
    ],
    "transaction_id": [
        r"^transaction[_\s]?id$", r"^txn[_\s]?id$", r"^tx[_\s]?id$", r"^reference$", r"^txnid$"
    ],
    "transaction_timestamp": [
        r"^transaction[_\s]?timestamp$", r"^timestamp$", r"^transaction[_\s]?time$",
        r"^transaction[_\s]?date$", r"^time$", r"^date[_\s]?time$", r"^datetime$"
    ],
    "amount": [
        r"^amount$", r"^transaction[_\s]?amount$", r"^txn[_\s]?amount$", r"^amt$",
        r"^value$", r"^amount[_\s]?inr$"
    ],
    "txn_type": [
        r"^txn[_\s]?type$", r"^transaction[_\s]?type$", r"^type$", r"^credit[_\s/]?debit$",
        r"^d[_\s/]?c$", r"^dr[_\s/]?cr$"
    ],
    "counterparty_id": [
        r"^counterparty[_\s]?id$", r"^counterparty$", r"^cp[_\s]?id$", r"^beneficiary$",
        r"^recipient$", r"^sender$", r"^counterparty[_\s]?account$"
    ],
    "channel": [
        r"^channel$", r"^payment[_\s]?channel$", r"^txn[_\s]?channel$", r"^mode$", r"^payment[_\s]?mode$"
    ],
    "mcc_code": [
        r"^mcc[_\s]?code$", r"^mcc$", r"^merchant[_\s]?category[_\s]?code$"
    ],
    "branch_code": [
        r"^branch[_\s]?code$", r"^branch$", r"^branch[_\s]?id$"
    ],
    "customer_pin": [
        r"^customer[_\s]?pin$", r"^pin$", r"^postal[_\s]?code$", r"^zip$", r"^residential[_\s]?pin$"
    ],
    "permanent_pin": [
        r"^permanent[_\s]?pin$"
    ],
    "date_of_birth": [
        r"^date[_\s]?of[_\s]?birth$", r"^dob$", r"^birth[_\s]?date$"
    ],
    "account_opening_date": [
        r"^account[_\s]?opening[_\s]?date$", r"^opening[_\s]?date$", r"^created[_\s]?date$"
    ],
    "avg_balance": [
        r"^avg[_\s]?balance$", r"^average[_\s]?balance$", r"^balance$", r"^account[_\s]?balance$"
    ],
    "account_status": [
        r"^account[_\s]?status$", r"^status$"
    ],
    "kyc_compliant": [
        r"^kyc[_\s]?compliant$", r"^kyc[_\s]?status$", r"^kyc$"
    ]
}

def detect_column_mapping(columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """Maps uploaded column names to standardized internal field names."""
    mapping = {}
    unmapped = []

    for col in columns:
        clean_col = col.strip().lower()
        matched_field = None

        for field, patterns in FIELD_PATTERNS.items():
            for pat in patterns:
                if re.match(pat, clean_col):
                    matched_field = field
                    break
            if matched_field:
                break

        if matched_field and matched_field not in mapping.values():
            mapping[col] = matched_field
        else:
            unmapped.append(col)

    return mapping, unmapped

def normalize_timestamp(ts_val: Any) -> Optional[str]:
    """Parses various timestamp strings into standardized ISO format: YYYY-MM-DDTHH:MM:SS."""
    if ts_val is None or pd.isna(ts_val):
        return None
    s = str(ts_val).strip()
    if not s or s.upper() in ["NULL", "N/A", "NONE", "-"]:
        return None

    # Replace space with T if already in ISO-like format
    s = s.replace("/", "-")
    formats = [
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
        "%m-%d-%Y %H:%M:%S",
        "%m-%d-%Y"
    ]
    for fmt in formats:
        try:
            dt = datetime.datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%S")
        except ValueError:
            continue
    return s[:19]

def normalize_amount(amt_val: Any) -> Optional[float]:
    """Strips currency symbols, commas, and whitespace, returning float."""
    if amt_val is None or pd.isna(amt_val):
        return None
    if isinstance(amt_val, (int, float)):
        return float(amt_val)
    s = str(amt_val).strip()
    # Remove currency symbols and formatting
    s = re.sub(r"[₹$,\s]", "", s)
    try:
        return float(s)
    except ValueError:
        return None

def normalize_txn_type(type_val: Any) -> str:
    """Standardizes transaction type to 'C' (Credit) or 'D' (Debit)."""
    if type_val is None or pd.isna(type_val):
        return "D"
    s = str(type_val).strip().upper()
    if s in ["C", "CREDIT", "CR", "IN", "INCOMING", "RECEIVE", "DEPOSIT"]:
        return "C"
    return "D"

def normalize_id(id_val: Any, prefix: str = "") -> Optional[str]:
    """Strips spaces and normalizes standard ID strings."""
    if id_val is None or pd.isna(id_val):
        return None
    s = str(id_val).strip().upper()
    if not s or s in ["NULL", "N/A", "NONE", "-"]:
        return None
    if prefix and not s.startswith(prefix) and not "_" in s:
        # e.g. "12345" -> "ACCT_012345"
        try:
            return f"{prefix}_{int(s):06d}"
        except:
            return f"{prefix}_{s}"
    return s

# In-memory Staging Cache
_STAGING_BATCHES: Dict[str, Dict[str, Any]] = {}

def process_upload_and_preview(file_path: str, original_filename: str) -> Dict[str, Any]:
    """
    Staging & Validation pipeline:
    1. Reads uploaded CSV/XLSX.
    2. Detects schema mapping.
    3. Normalizes fields.
    4. Performs deterministic entity resolution (NEW vs EXISTING vs DUPLICATE vs CONFLICT).
    5. Returns human-readable preview before committing.
    """
    batch_id = f"BATCH-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    file_size_bytes = os.path.getsize(file_path)

    # 1. Read file into Pandas DataFrame with Excel support only when needed.
    try:
        lower_name = original_filename.lower()
        if lower_name.endswith((".xlsx", ".xls")):
            try:
                import openpyxl  # noqa: F401
                df = pd.read_excel(file_path)
            except ImportError:
                return {
                    "success": False,
                    "error": "Excel import requires the openpyxl package. Install it with: pip install openpyxl"
                }
        else:
            df = pd.read_csv(file_path)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to parse file: {str(e)}"
        }

    total_rows = len(df)
    if total_rows == 0:
        return {
            "success": False,
            "error": "The uploaded file is empty (0 rows)."
        }

    # 2. Detect schema
    mapping, unmapped = detect_column_mapping(list(df.columns))
    inv_mapping = {v: k for k, v in mapping.items()}

    # Required field verification: Must have at least account_id or customer_id or transaction_id
    if "account_id" not in inv_mapping and "customer_id" not in inv_mapping and "transaction_id" not in inv_mapping:
        return {
            "success": False,
            "error": "Schema mapping could not find required identifier columns (Account ID, Customer ID, or Transaction ID).",
            "detected_columns": list(df.columns),
            "unmapped_columns": unmapped
        }

    # 3. Load existing identifiers from SQLite for deterministic resolution
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM customers")
        existing_custs = {r[0] for r in cursor.fetchall()}

        cursor.execute("SELECT account_id, account_status FROM accounts")
        existing_accts = {r[0]: r[1] for r in cursor.fetchall()}

        cursor.execute("SELECT transaction_id FROM transactions")
        existing_txns = {r[0] for r in cursor.fetchall()}

    # 4. Process Rows
    valid_records = []
    invalid_records = []
    preview_samples = []

    seen_txns_in_batch = set()
    new_customers = set()
    existing_customers_matched = set()
    new_accounts = set()
    existing_accounts_matched = set()
    duplicates_count = 0
    conflicts_count = 0

    for idx, row in df.iterrows():
        # Map values
        rec = {}
        for orig_col, field_name in mapping.items():
            rec[field_name] = row[orig_col]

        # Normalization
        acct_id = normalize_id(rec.get("account_id"), "ACCT")
        cust_id = normalize_id(rec.get("customer_id"), "CUST")
        txn_id = normalize_id(rec.get("transaction_id"), "TXN")
        cp_id = normalize_id(rec.get("counterparty_id"), "CP")
        amt = normalize_amount(rec.get("amount"))
        txn_type = normalize_txn_type(rec.get("txn_type"))
        ts = normalize_timestamp(rec.get("transaction_timestamp"))
        channel = str(rec.get("channel", "UPC")).strip().upper() if rec.get("channel") else "UPC"
        try:
            mcc = int(float(rec.get("mcc_code", 5651)))
        except (ValueError, TypeError):
            mcc = 5651

        # Fallback generation if transaction file without explicit txn_id
        if not txn_id and acct_id and amt is not None:
            txn_id = f"TXN_UPL_{batch_id[-6:]}_{idx:05d}"

        # Status & Reason tracking
        row_status = "VALID"
        status_reasons = []

        # Customer Resolution
        if cust_id:
            if cust_id in existing_custs:
                existing_customers_matched.add(cust_id)
                status_reasons.append("Matched existing customer")
            else:
                new_customers.add(cust_id)
                status_reasons.append("New customer entity")

        # Account Resolution
        if acct_id:
            if acct_id in existing_accts:
                existing_accounts_matched.add(acct_id)
                status_reasons.append("Matched existing account")
                # Check conflict
                new_status = str(rec.get("account_status", "")).strip().lower()
                existing_status = str(existing_accts[acct_id]).strip().lower()
                if new_status and existing_status and new_status != existing_status:
                    conflicts_count += 1
                    row_status = "CONFLICT"
                    status_reasons.append(f"Status conflict: '{existing_status}' vs uploaded '{new_status}' (Kept: '{existing_status}')")
            else:
                new_accounts.add(acct_id)
                status_reasons.append("New account entity")

        # Transaction Resolution & Duplicate Check
        is_duplicate = False
        if txn_id:
            if txn_id in existing_txns or txn_id in seen_txns_in_batch:
                is_duplicate = True
                duplicates_count += 1
                row_status = "DUPLICATE"
                status_reasons.append(f"Duplicate transaction ID '{txn_id}' (Will skip)")
            else:
                seen_txns_in_batch.add(txn_id)

        # Validation Checks
        is_valid = True
        if amt is not None and amt <= 0:
            status_reasons.append("Non-positive transaction amount")
        if not acct_id and not cust_id:
            is_valid = False
            row_status = "INVALID"
            status_reasons.append("Missing both Account ID and Customer ID")

        # Numeric conversions
        try:
            branch_code = int(float(rec.get("branch_code", 4001)))
        except (ValueError, TypeError):
            branch_code = 4001

        try:
            cust_pin = int(float(rec.get("customer_pin", 400001)))
        except (ValueError, TypeError):
            cust_pin = 400001

        avg_bal = normalize_amount(rec.get("avg_balance"))
        if avg_bal is None:
            avg_bal = 10000.0

        # Package standardized item
        standardized_item = {
            "row_index": idx + 1,
            "account_id": acct_id,
            "customer_id": cust_id,
            "transaction_id": txn_id,
            "counterparty_id": cp_id or "CP_UPLOAD_DEFAULT",
            "amount": amt,
            "txn_type": txn_type,
            "transaction_timestamp": ts or datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "channel": channel,
            "mcc_code": mcc,
            "branch_code": branch_code,
            "customer_pin": cust_pin,
            "avg_balance": avg_bal,
            "is_duplicate": is_duplicate,
            "is_valid": is_valid,
            "row_status": row_status,
            "status_explanation": "; ".join(status_reasons)
        }

        if is_valid and not is_duplicate:
            valid_records.append(standardized_item)
        else:
            invalid_records.append(standardized_item)

        # Keep first 20 for UI preview table (fully aligned with frontend IngestionPreviewRow)
        if len(preview_samples) < 20:
            preview_samples.append({
                "row_num": idx + 1,
                "row_index": idx + 1,
                "account_id": acct_id or "—",
                "customer_id": cust_id or "—",
                "transaction_id": txn_id or "—",
                "timestamp": ts or "—",
                "amount": float(amt) if amt is not None else 0.0,
                "amount_formatted": f"₹{amt:,.2f}" if amt is not None else "—",
                "txn_type": txn_type,
                "counterparty": cp_id or "—",
                "counterparty_id": cp_id or "—",
                "account_status": "EXISTING" if (acct_id and acct_id in existing_accts) else "NEW",
                "customer_status": "EXISTING" if (cust_id and cust_id in existing_custs) else "NEW",
                "resolution": "; ".join(status_reasons) if status_reasons else row_status,
                "status": row_status,
                "explanation": "; ".join(status_reasons)
            })

    # Cache staging data in memory
    _STAGING_BATCHES[batch_id] = {
        "batch_id": batch_id,
        "filename": original_filename,
        "file_path": file_path,
        "total_rows": total_rows,
        "valid_count": len(valid_records),
        "invalid_count": len(invalid_records),
        "duplicate_count": duplicates_count,
        "conflict_count": conflicts_count,
        "new_customers": list(new_customers),
        "existing_customers": list(existing_customers_matched),
        "new_accounts": list(new_accounts),
        "existing_accounts": list(existing_accounts_matched),
        "valid_records": valid_records,
        "upload_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    # Record initial batch in DB as VALIDATING
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO ingestion_batches VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, (
            batch_id, original_filename, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_rows, len(valid_records), len(invalid_records), duplicates_count,
            conflicts_count, len(new_customers), len(existing_customers_matched),
            len(new_accounts), len(existing_accounts_matched),
            len(valid_records), "READY"
        ))
        cursor.execute("""
            INSERT INTO audit_logs (actor, action, batch_id, details, timestamp)
            VALUES ('ANALYST_04', 'VALIDATE_UPLOAD', ?, ?, ?)
        """, (batch_id, f"Validated {total_rows} rows from {original_filename}", datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
        conn.commit()

    return {
        "success": True,
        "batch_id": batch_id,
        "filename": original_filename,
        "file_size_formatted": f"{file_size_bytes / 1024:.1f} KB",
        "total_rows": total_rows,
        "valid_rows": len(valid_records),
        "invalid_rows": len(invalid_records),
        "duplicate_rows": duplicates_count,
        "conflict_rows": conflicts_count,
        "new_customers_count": len(new_customers),
        "existing_customers_count": len(existing_customers_matched),
        "new_accounts_count": len(new_accounts),
        "existing_accounts_count": len(existing_accounts_matched),
        "schema_mapping": mapping,
        "unmapped_columns": unmapped,
        "preview_samples": preview_samples
    }

def commit_ingestion_batch(batch_id: str) -> Dict[str, Any]:
    """
    Atomic Commit & Real-Time Fraud Engine Execution:
    1. Inserts valid records into SQLite within transaction.
    2. Updates counterparties and customer linkages.
    3. Triggers real-time fraud analysis on all affected accounts.
    4. Recalculates risk scores (0–100) and updates alerts table.
    5. Updates monthly and channel analytics.
    """
    batch_data = _STAGING_BATCHES.get(batch_id)
    if not batch_data:
        # Fallback check DB
        with get_db() as conn:
            c = conn.cursor()
            c.execute("SELECT status FROM ingestion_batches WHERE batch_id = ?", (batch_id,))
            row = c.fetchone()
            if not row:
                return {"success": False, "error": f"Batch {batch_id} not found."}
            if row[0] == "IMPORTED":
                return {"success": False, "error": f"Batch {batch_id} is already committed."}
        return {"success": False, "error": f"Staging cache expired for batch {batch_id}. Please re-upload the file."}

    valid_records = batch_data["valid_records"]
    affected_account_ids = set()

    with get_db() as conn:
        cursor = conn.cursor()
        try:
            now_iso = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

            # 1. Insert New Customers
            for cust_id in batch_data["new_customers"]:
                cursor.execute("""
                    INSERT OR IGNORE INTO customers (
                        customer_id, date_of_birth, relationship_start_date,
                        pan_available, aadhaar_available, passport_available,
                        mobile_banking_flag, internet_banking_flag, atm_card_flag,
                        demat_flag, credit_card_flag, fastag_flag, customer_pin,
                        permanent_pin, batch_id, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cust_id, "1995-01-01", now_iso[:10], "Y", "Y", "N",
                    "Y", "Y", "Y", "N", "N", "N", 400001, 400001, batch_id, now_iso
                ))
                cursor.execute("""
                    INSERT INTO ingestion_records (batch_id, entity_type, entity_id, action, status, details)
                    VALUES (?, 'CUSTOMER', ?, 'INSERT', 'SUCCESS', 'New customer entity created')
                """, (batch_id, cust_id))

            # 2. Insert New Accounts
            for acct_id in batch_data["new_accounts"]:
                # Match corresponding customer
                matching_cust = next((r["customer_id"] for r in valid_records if r["account_id"] == acct_id and r["customer_id"]), "CUST_DEFAULT")
                cursor.execute("""
                    INSERT OR IGNORE INTO accounts (
                        account_id, customer_id, account_status, product_code,
                        product_family, account_opening_date, account_age_days,
                        branch_code, branch_pin, avg_balance, daily_avg_balance,
                        monthly_avg_balance, kyc_compliant, total_tx_count,
                        credit_tx_count, debit_tx_count, credit_volume, debit_volume,
                        unique_incoming_cps, unique_outgoing_cps, reciprocal_cp_count,
                        pass_through_ratio, risk_score, risk_level, primary_pattern,
                        pattern_fan_in_out, pattern_pass_through, pattern_circular,
                        pattern_shared_id, investigation_status, analyst_notes,
                        batch_id, created_at
                    ) VALUES (
                        ?, ?, 'active', 100, 'S', ?, 1, 4001, 400001.0, 10000.0, 10000.0,
                        10000.0, 'Y', 0, 0, 0, 0.0, 0.0, 0, 0, 0, 0.0, 10, 'LOW',
                        'Standard Account', 0, 0, 0, 0, 'NEW', '', ?, ?
                    )
                """, (acct_id, matching_cust, now_iso[:10], batch_id, now_iso))

                # Linkage
                cursor.execute("""
                    INSERT OR IGNORE INTO customer_account_linkage (customer_id, account_id, batch_id, created_at)
                    VALUES (?, ?, ?, ?)
                """, (matching_cust, acct_id, batch_id, now_iso))

                cursor.execute("""
                    INSERT INTO ingestion_records (batch_id, entity_type, entity_id, action, status, details)
                    VALUES (?, 'ACCOUNT', ?, 'INSERT', 'SUCCESS', 'New account entity created')
                """, (batch_id, acct_id))

            # 3. Insert Transactions & Update Counterparties
            for r in valid_records:
                acct_id = r["account_id"]
                if acct_id:
                    affected_account_ids.add(acct_id)

                txn_id = r["transaction_id"]
                cursor.execute("""
                    INSERT OR IGNORE INTO transactions (
                        transaction_id, account_id, transaction_timestamp, mcc_code,
                        channel, amount, txn_type, counterparty_id, batch_id, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    txn_id, acct_id, r["transaction_timestamp"], r["mcc_code"],
                    r["channel"], r["amount"], r["txn_type"], r["counterparty_id"],
                    batch_id, now_iso
                ))

                # Counterparty
                cp_id = r["counterparty_id"]
                if cp_id:
                    sub_cat = "STANDARD"
                    if "FOREIGN" in cp_id: sub_cat = "FOREIGN"
                    elif "EMPL" in cp_id: sub_cat = "EMPLOYER"
                    elif "BR" in cp_id: sub_cat = "BRANCH"

                    cursor.execute("""
                        INSERT INTO counterparties (counterparty_id, category, first_seen, last_seen, total_volume, total_tx_count, unique_accounts_count, batch_id)
                        VALUES (?, ?, ?, ?, ?, 1, 1, ?)
                        ON CONFLICT(counterparty_id) DO UPDATE SET
                            total_volume = total_volume + excluded.total_volume,
                            total_tx_count = total_tx_count + 1,
                            last_seen = excluded.last_seen
                    """, (cp_id, sub_cat, r["transaction_timestamp"], r["transaction_timestamp"], r["amount"] or 0.0, batch_id))

            # Mark batch as IMPORTED
            cursor.execute("""
                UPDATE ingestion_batches SET status = 'IMPORTED' WHERE batch_id = ?
            """, (batch_id,))

            cursor.execute("""
                INSERT INTO audit_logs (actor, action, batch_id, details, timestamp)
                VALUES ('ANALYST_04', 'COMMIT_BATCH', ?, ?, ?)
            """, (batch_id, f"Committed {len(valid_records)} transactions across {len(affected_account_ids)} accounts", now_iso))

            conn.commit()

        except Exception as e:
            conn.rollback()
            return {"success": False, "error": f"Database commit failed: {str(e)}"}

    # 4. Trigger Real-Time Fraud Re-Analysis for all affected accounts
    reanalysis_results = reanalyze_fraud_for_accounts(list(affected_account_ids), batch_id)

    return {
        "success": True,
        "batch_id": batch_id,
        "message": f"Batch {batch_id} imported successfully.",
        "records_imported": len(valid_records),
        "new_customers_created": len(batch_data["new_customers"]),
        "new_accounts_created": len(batch_data["new_accounts"]),
        "affected_accounts_count": len(affected_account_ids),
        "fraud_reanalysis": reanalysis_results
    }

def reanalyze_fraud_for_accounts(account_ids: List[str], batch_id: str) -> Dict[str, Any]:
    """
    Executes real-time behavioral re-analysis across affected accounts:
    - Calculates flow volume, credit/debit counts, and pass-through ratio.
    - Evaluates the 4 MuleTrace fraud patterns.
    - Recalculates normalized risk score (0–100).
    - Generates human-readable evidence reasons.
    - Updates `accounts`, `risk_scores`, and `alerts` tables.
    """
    if not account_ids:
        return {"accounts_reanalyzed": 0, "new_alerts_generated": 0}

    new_alerts_generated = 0
    updated_scores = []

    with get_db() as conn:
        cursor = conn.cursor()

        for acct_id in account_ids:
            # Query all transactions for this account (combines baseline & newly uploaded)
            cursor.execute("""
                SELECT amount, txn_type, counterparty_id, transaction_timestamp
                FROM transactions
                WHERE account_id = ?
            """, (acct_id,))
            tx_rows = [dict(r) for r in cursor.fetchall()]

            # Fetch baseline transactions from Parquet cache if available
            parquet_path = os.path.join(settings.BASE_DIR, "cache", "transactions.parquet")
            if os.path.exists(parquet_path):
                try:
                    baseline_df = pl.scan_parquet(parquet_path).filter(pl.col("account_id") == acct_id).collect()
                    tx_rows.extend(baseline_df.select(["amount", "txn_type", "counterparty_id", "transaction_timestamp"]).to_dicts())
                except Exception:
                    pass

            # Account static info
            cursor.execute("""
                SELECT account_age_days, avg_balance, daily_avg_balance, branch_pin
                FROM accounts WHERE account_id = ?
            """, (acct_id,))
            acct_info = cursor.fetchone()
            if not acct_info:
                continue

            age_days = acct_info["account_age_days"] or 30
            avg_bal = acct_info["avg_balance"] or 1000.0

            # Aggregates
            total_tx = len(tx_rows)
            credits = [r for r in tx_rows if r["txn_type"] == "C"]
            debits = [r for r in tx_rows if r["txn_type"] == "D"]

            cred_vol = sum(r["amount"] or 0.0 for r in credits)
            deb_vol = sum(r["amount"] or 0.0 for r in debits)

            in_cps = len(set(r["counterparty_id"] for r in credits if r["counterparty_id"]))
            out_cps = len(set(r["counterparty_id"] for r in debits if r["counterparty_id"]))

            # Reciprocal counterparties
            all_in_cps = set(r["counterparty_id"] for r in credits if r["counterparty_id"])
            all_out_cps = set(r["counterparty_id"] for r in debits if r["counterparty_id"])
            recip_cps = len(all_in_cps.intersection(all_out_cps))

            pt_ratio = (deb_vol / cred_vol) if cred_vol > 1000 else 0.0

            # ----------------------------------------------------
            # Pattern Detection & Explainable Risk Scoring
            # ----------------------------------------------------
            evidence_reasons = []

            # 1. Fan-in / Fan-out
            fan_score = 0.0
            fan_flag = False
            if in_cps >= 15 and out_cps >= 15:
                fan_score = 25.0
                fan_flag = True
                evidence_reasons.append(f"High Fan-In/Fan-Out: Received from {in_cps} distinct counterparties and sent to {out_cps} counterparties")
            elif in_cps >= 8 and out_cps >= 8:
                fan_score = 15.0
                fan_flag = True
                evidence_reasons.append(f"Elevated Fan-In/Fan-Out: {in_cps} incoming counterparties, {out_cps} outgoing counterparties")
            elif in_cps >= 4 and out_cps >= 4:
                fan_score = 8.0

            # 2. Pass-Through
            pt_score = 0.0
            pt_flag = False
            retained_ratio = (avg_bal / cred_vol) if cred_vol > 20000 else 1.0

            if cred_vol >= 50000 and 0.85 <= pt_ratio <= 1.15:
                pt_flag = True
                if retained_ratio <= 0.08:
                    pt_score = 25.0
                    evidence_reasons.append(f"Critical Pass-Through: {pt_ratio*100:.1f}% of ₹{cred_vol:,.0f} inflow dispersed; retained balance ratio is only {retained_ratio*100:.1f}%")
                else:
                    pt_score = 18.0
                    evidence_reasons.append(f"High Pass-Through: {pt_ratio*100:.1f}% of incoming funds dispersed (₹{deb_vol:,.0f} outgoing)")
            elif cred_vol >= 20000 and 0.80 <= pt_ratio <= 1.20:
                pt_score = 12.0
                evidence_reasons.append(f"Rapid Transit: Inflow of ₹{cred_vol:,.0f} closely matched by outflow of ₹{deb_vol:,.0f}")

            # 3. Circular / Reciprocal Flow (Bipartite)
            cycle_score = 0.0
            cycle_flag = False
            if recip_cps >= 5:
                cycle_score = 15.0
                cycle_flag = True
                evidence_reasons.append(f"Suspicious Reciprocal Network: Loop flows with {recip_cps} bidirectional counterparties")
            elif recip_cps >= 2:
                cycle_score = 8.0
                evidence_reasons.append(f"Bidirectional Loops: {recip_cps} counterparties have reciprocal credit & debit flows")

            # 4. New Account / Shared Clusters
            shared_id_score = 0.0
            shared_id_flag = False
            if age_days <= 180 and total_tx >= 10:
                shared_id_score = 15.0
                shared_id_flag = True
                evidence_reasons.append(f"New Account Spike: {total_tx} transactions recorded within {age_days} days of opening")

            # Velocity Score
            vel_score = 10.0 if total_tx >= 40 else 5.0 if total_tx >= 15 else 0.0

            # Balance Behavior Score
            bal_score = 10.0 if avg_bal < 0 else 5.0 if (cred_vol >= 50000 and avg_bal < 3000) else 0.0

            # Composite Score (0–100)
            raw_risk = fan_score + pt_score + cycle_score + shared_id_score + vel_score + bal_score
            risk_score = min(100, int(round(raw_risk)))

            severity = "CRITICAL" if risk_score >= 80 else "HIGH" if risk_score >= 60 else "MEDIUM" if risk_score >= 30 else "LOW"

            # Primary pattern
            patterns = []
            if fan_flag: patterns.append("Fan-in / Fan-out")
            if pt_flag: patterns.append("Pass-through Mule")
            if cycle_flag: patterns.append("Circular / Reciprocal")
            if shared_id_flag: patterns.append("New Account / Cluster")
            primary_pattern = patterns[0] if patterns else "Standard Activity"

            if risk_score >= 60 and not evidence_reasons:
                evidence_reasons.append(f"Elevated transaction turnover relative to baseline ({total_tx} transactions)")

            # Update accounts table
            cursor.execute("""
                UPDATE accounts SET
                    total_tx_count = ?,
                    credit_tx_count = ?,
                    debit_tx_count = ?,
                    credit_volume = ?,
                    debit_volume = ?,
                    unique_incoming_cps = ?,
                    unique_outgoing_cps = ?,
                    reciprocal_cp_count = ?,
                    pass_through_ratio = ?,
                    risk_score = ?,
                    risk_level = ?,
                    primary_pattern = ?,
                    pattern_fan_in_out = ?,
                    pattern_pass_through = ?,
                    pattern_circular = ?,
                    pattern_shared_id = ?
                WHERE account_id = ?
            """, (
                total_tx, len(credits), len(debits), cred_vol, deb_vol,
                in_cps, out_cps, recip_cps, round(pt_ratio, 4),
                risk_score, severity, primary_pattern,
                1 if fan_flag else 0, 1 if pt_flag else 0, 1 if cycle_flag else 0, 1 if shared_id_flag else 0,
                acct_id
            ))

            # Update risk_scores table
            now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                INSERT OR REPLACE INTO risk_scores (
                    account_id, risk_score, risk_level, fan_in_out_score, pass_through_score,
                    cycle_score, shared_identifier_score, velocity_score, balance_behavior_score,
                    evidence_reasons, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                acct_id, risk_score, severity, fan_score, pt_score,
                cycle_score, shared_id_score, vel_score, bal_score,
                json.dumps(evidence_reasons), now_str
            ))

            # Auto-Alert Creation / Update if High or Critical
            if risk_score >= 60:
                alert_id = f"ALT-DYN-{acct_id}"
                summary_exp = "; ".join(evidence_reasons[:2]) if evidence_reasons else "Elevated risk profile detected across behavioral indicators."
                cursor.execute("""
                    INSERT INTO alerts (alert_id, account_id, risk_score, severity, pattern, detected_at, amount, explanation, status, batch_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?)
                    ON CONFLICT(alert_id) DO UPDATE SET
                        risk_score = excluded.risk_score,
                        severity = excluded.severity,
                        pattern = excluded.pattern,
                        amount = excluded.amount,
                        explanation = excluded.explanation,
                        detected_at = excluded.detected_at
                """, (
                    alert_id, acct_id, risk_score, severity, primary_pattern,
                    now_str, max(cred_vol, deb_vol), summary_exp, batch_id
                ))
                new_alerts_generated += 1

            updated_scores.append({
                "account_id": acct_id,
                "risk_score": risk_score,
                "severity": severity,
                "primary_pattern": primary_pattern,
                "reasons": evidence_reasons
            })

        conn.commit()

    return {
        "accounts_reanalyzed": len(account_ids),
        "new_alerts_generated": new_alerts_generated,
        "high_risk_accounts": len([s for s in updated_scores if s["risk_score"] >= 60]),
        "scores": updated_scores[:5]
    }

def rollback_ingestion_batch(batch_id: str) -> Dict[str, Any]:
    """
    Batch Rollback Engine:
    Safely undoes an ingestion batch without affecting baseline or unrelated records.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Check batch
        cursor.execute("SELECT status, filename FROM ingestion_batches WHERE batch_id = ?", (batch_id,))
        batch_row = cursor.fetchone()
        if not batch_row:
            return {"success": False, "error": f"Batch {batch_id} not found."}
        if batch_row[0] == "ROLLED_BACK":
            return {"success": False, "error": f"Batch {batch_id} is already rolled back."}

        # 1. Identify all affected accounts from this batch
        cursor.execute("SELECT DISTINCT account_id FROM transactions WHERE batch_id = ?", (batch_id,))
        tx_accts = {r[0] for r in cursor.fetchall() if r[0]}

        cursor.execute("SELECT account_id FROM accounts WHERE batch_id = ?", (batch_id,))
        new_accts = {r[0] for r in cursor.fetchall() if r[0]}

        # 2. Delete transactions from this batch
        cursor.execute("DELETE FROM transactions WHERE batch_id = ?", (batch_id,))
        txns_deleted = cursor.rowcount

        # 3. Delete alerts created by this batch
        cursor.execute("DELETE FROM alerts WHERE batch_id = ?", (batch_id,))
        alerts_deleted = cursor.rowcount

        # 4. Delete newly created accounts and customers from this batch
        cursor.execute("DELETE FROM accounts WHERE batch_id = ?", (batch_id,))
        cursor.execute("DELETE FROM customers WHERE batch_id = ?", (batch_id,))
        cursor.execute("DELETE FROM customer_account_linkage WHERE batch_id = ?", (batch_id,))
        cursor.execute("DELETE FROM counterparties WHERE batch_id = ?", (batch_id,))
        if new_accts:
            q_ph = ",".join(["?"] * len(new_accts))
            cursor.execute(f"DELETE FROM risk_scores WHERE account_id IN ({q_ph})", list(new_accts))

        # 5. Mark batch status
        cursor.execute("""
            UPDATE ingestion_batches SET status = 'ROLLED_BACK' WHERE batch_id = ?
        """, (batch_id,))

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO audit_logs (actor, action, batch_id, details, timestamp)
            VALUES ('ANALYST_04', 'ROLLBACK_BATCH', ?, ?, ?)
        """, (batch_id, f"Rolled back batch {batch_id}: deleted {txns_deleted} transactions", now_str))

        conn.commit()

    # 6. Re-analyze any remaining existing accounts that had transactions deleted
    remaining_affected = list(tx_accts - new_accts)
    if remaining_affected:
        reanalyze_fraud_for_accounts(remaining_affected, "ROLLBACK_RESTORE")

    return {
        "success": True,
        "batch_id": batch_id,
        "message": f"Batch {batch_id} successfully rolled back.",
        "transactions_removed": txns_deleted,
        "alerts_removed": alerts_deleted,
        "accounts_restored": len(remaining_affected)
    }

def get_ingestion_history() -> List[Dict[str, Any]]:
    """Returns history of all uploaded batches and their audit logs."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT batch_id, filename, upload_time, row_count, valid_count,
                   invalid_count, duplicate_count, conflict_count,
                   new_customers_count, new_accounts_count, new_transactions_count, status
            FROM ingestion_batches
            ORDER BY upload_time DESC
        """)
        return [dict(r) for r in cursor.fetchall()]
