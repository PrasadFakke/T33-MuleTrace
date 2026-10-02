import os
import sys
import sqlite3
import shutil
import polars as pl

def main():
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "EDA-Phase-1")
    OLD_DB_PATH = os.path.join(BASE_DIR, "muletrace.db")
    NEW_DB_DIR = os.path.join(BASE_DIR, "data")
    NEW_DB_PATH = os.path.join(NEW_DB_DIR, "muletrace.db")

    os.makedirs(NEW_DB_DIR, exist_ok=True)
    os.makedirs(os.path.join(NEW_DB_DIR, "staging"), exist_ok=True)

    if not os.path.exists(NEW_DB_PATH):
        if os.path.exists(OLD_DB_PATH):
            shutil.copy2(OLD_DB_PATH, NEW_DB_PATH)

    conn = sqlite3.connect(NEW_DB_PATH)
    cursor = conn.cursor()

    # 1. Add batch_id and created_at to accounts & customers & alerts if not present
    cursor.execute("PRAGMA table_info(accounts)")
    acct_cols = [r[1] for r in cursor.fetchall()]
    if "batch_id" not in acct_cols:
        cursor.execute("ALTER TABLE accounts ADD COLUMN batch_id TEXT DEFAULT 'INITIAL_DATASET'")
    if "created_at" not in acct_cols:
        cursor.execute("ALTER TABLE accounts ADD COLUMN created_at TEXT DEFAULT '2025-07-11T12:00:00'")

    cursor.execute("PRAGMA table_info(customers)")
    cust_cols = [r[1] for r in cursor.fetchall()]
    if "batch_id" not in cust_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN batch_id TEXT DEFAULT 'INITIAL_DATASET'")
    if "created_at" not in cust_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN created_at TEXT DEFAULT '2025-07-11T12:00:00'")

    cursor.execute("PRAGMA table_info(alerts)")
    alert_cols = [r[1] for r in cursor.fetchall()]
    if "batch_id" not in alert_cols:
        cursor.execute("ALTER TABLE alerts ADD COLUMN batch_id TEXT DEFAULT 'INITIAL_DATASET'")

    cursor.execute("PRAGMA table_info(risk_scores)")
    risk_cols = [r[1] for r in cursor.fetchall()]
    if "updated_at" not in risk_cols:
        cursor.execute("ALTER TABLE risk_scores ADD COLUMN updated_at TEXT DEFAULT '2025-07-11T12:00:00'")

    # 2. customer_account_linkage
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customer_account_linkage (
        customer_id TEXT,
        account_id TEXT,
        batch_id TEXT DEFAULT 'INITIAL_DATASET',
        created_at TEXT DEFAULT '2025-07-11T12:00:00',
        PRIMARY KEY (customer_id, account_id)
    )
    """)

    # Populate linkage if empty
    cursor.execute("SELECT COUNT(*) FROM customer_account_linkage")
    if cursor.fetchone()[0] == 0:
        linkage_file = os.path.join(DATA_DIR, "customer_account_linkage.csv")
        if os.path.exists(linkage_file):
            link_df = pl.read_csv(linkage_file)
            rows = [(r['customer_id'], r['account_id'], 'INITIAL_DATASET', '2025-07-11T12:00:00') for r in link_df.to_dicts()]
            cursor.executemany("INSERT OR IGNORE INTO customer_account_linkage VALUES (?,?,?,?)", rows)

    # 3. transactions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        account_id TEXT,
        transaction_timestamp TEXT,
        mcc_code INTEGER,
        channel TEXT,
        amount REAL,
        txn_type TEXT,
        counterparty_id TEXT,
        batch_id TEXT DEFAULT 'INITIAL_DATASET',
        created_at TEXT DEFAULT '2025-07-11T12:00:00'
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_txn_acct ON transactions(account_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_txn_cp ON transactions(counterparty_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_txn_time ON transactions(transaction_timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_txn_batch ON transactions(batch_id)")

    # 4. counterparties table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS counterparties (
        counterparty_id TEXT PRIMARY KEY,
        category TEXT,
        first_seen TEXT,
        last_seen TEXT,
        total_volume REAL,
        total_tx_count INTEGER,
        unique_accounts_count INTEGER,
        batch_id TEXT DEFAULT 'INITIAL_DATASET'
    )
    """)

    # 5. investigations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS investigations (
        account_id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'NEW',
        analyst_notes TEXT DEFAULT '',
        updated_at TEXT
    )
    """)

    # 6. ingestion_batches table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ingestion_batches (
        batch_id TEXT PRIMARY KEY,
        filename TEXT,
        upload_time TEXT,
        row_count INTEGER,
        valid_count INTEGER,
        invalid_count INTEGER,
        duplicate_count INTEGER,
        conflict_count INTEGER,
        new_customers_count INTEGER,
        existing_customers_count INTEGER,
        new_accounts_count INTEGER,
        existing_accounts_count INTEGER,
        new_transactions_count INTEGER,
        status TEXT
    )
    """)

    # 7. ingestion_records table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ingestion_records (
        record_id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id TEXT,
        entity_type TEXT,
        entity_id TEXT,
        action TEXT,
        status TEXT,
        details TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ingest_batch ON ingestion_records(batch_id)")

    # 8. audit_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT,
        action TEXT,
        batch_id TEXT,
        details TEXT,
        timestamp TEXT
    )
    """)

    # 9. db_metadata table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS db_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    cursor.execute("INSERT OR REPLACE INTO db_metadata VALUES ('initialized', '1')")
    cursor.execute("INSERT OR REPLACE INTO db_metadata VALUES ('schema_version', '2.0')")
    cursor.execute("INSERT OR REPLACE INTO db_metadata VALUES ('db_path', ?)", (NEW_DB_PATH,))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
