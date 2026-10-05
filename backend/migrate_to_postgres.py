"""
MuleTrace PostgreSQL Database Migration Script
-----------------------------------------------
Migrates all tables, schemas, and indexed data from SQLite (muletrace.db)
to any PostgreSQL database (Render PostgreSQL, Supabase, Neon, RDS, or Local Postgres).

Usage:
    python backend/migrate_to_postgres.py [DATABASE_URL]
    
Example:
    python backend/migrate_to_postgres.py "postgresql://user:pass@host:5432/dbname"
"""

import sys
import os
import sqlite3
import time

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("[Error] psycopg2-binary is required for PostgreSQL migration.")
    print("Please install it: pip install psycopg2-binary")
    sys.exit(1)

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "data", "muletrace.db")
if not os.path.exists(SQLITE_PATH):
    alt = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "muletrace.db")
    if os.path.exists(alt):
        SQLITE_PATH = alt
    elif os.path.exists("backend/data/muletrace.db"):
        SQLITE_PATH = "backend/data/muletrace.db"
    elif os.path.exists("data/muletrace.db"):
        SQLITE_PATH = "data/muletrace.db"

TABLES_ORDER = [
    "accounts",
    "customers",
    "customer_account_linkage",
    "risk_scores",
    "alerts",
    "counterparties",
    "account_counterparties",
    "transactions",
    "investigations",
    "ingestion_batches",
    "ingestion_records",
    "audit_logs",
    "analytics_monthly",
    "analytics_channels",
    "db_metadata"
]

def get_pg_type(sqlite_type: str) -> str:
    t = (sqlite_type or "").upper()
    if "INT" in t:
        return "BIGINT"
    if "REAL" in t or "FLOAT" in t or "DOUB" in t:
        return "DOUBLE PRECISION"
    if "TEXT" in t or "CHAR" in t or "CLOB" in t:
        return "TEXT"
    if "BLOB" in t:
        return "BYTEA"
    return "TEXT"

def migrate(pg_url: str):
    if not os.path.exists(SQLITE_PATH):
        print(f"[Error] SQLite database not found at {SQLITE_PATH}")
        sys.exit(1)

    print("=" * 60)
    print("MULETRACE SQLITE -> POSTGRESQL MIGRATION PIPELINE")
    print("=" * 60)
    print(f"Source SQLite DB: {SQLITE_PATH}")
    print(f"Target Postgres:   {pg_url.split('@')[-1] if '@' in pg_url else 'PostgreSQL'}")
    print()

    # Convert postgres:// to postgresql:// if needed
    if pg_url.startswith("postgres://"):
        pg_url = "postgresql://" + pg_url[11:]

    t0 = time.time()
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    pg_conn = psycopg2.connect(pg_url)
    pg_conn.autocommit = False

    sqlite_cur = sqlite_conn.cursor()
    pg_cur = pg_conn.cursor()

    # Find existing tables in SQLite
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    existing_tables = set(r[0] for r in sqlite_cur.fetchall())

    tables_to_migrate = [t for t in TABLES_ORDER if t in existing_tables]
    for t in existing_tables:
        if t not in tables_to_migrate and not t.startswith("sqlite_"):
            tables_to_migrate.append(t)

    print(f"Discovered {len(tables_to_migrate)} tables to migrate.")

    total_rows_migrated = 0

    for table in tables_to_migrate:
        t_tab = time.time()
        print(f"\n--- Migrating table: {table} ---")

        # 1. Fetch column info
        sqlite_cur.execute(f"PRAGMA table_info({table})")
        cols_info = sqlite_cur.fetchall()
        # cid, name, type, notnull, dflt_value, pk
        col_defs = []
        col_names = []
        for col in cols_info:
            col_name = col[1]
            pg_col_type = get_pg_type(col[2])
            col_names.append(col_name)
            col_defs.append(f'"{col_name}" {pg_col_type}')

        # 2. Drop and create table in PostgreSQL
        pg_cur.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE;')
        create_sql = f'CREATE TABLE "{table}" ({", ".join(col_defs)});'
        pg_cur.execute(create_sql)

        # 3. Read data from SQLite
        sqlite_cur.execute(f'SELECT {", ".join([f"`{c}`" for c in col_names])} FROM "{table}"')
        rows = sqlite_cur.fetchall()
        row_count = len(rows)

        # 4. Batch insert into PostgreSQL
        if row_count > 0:
            batch_size = 5000
            cols_clause = ", ".join([f'"{c}"' for c in col_names])
            insert_query = f'INSERT INTO "{table}" ({cols_clause}) VALUES %s'
            
            for i in range(0, row_count, batch_size):
                batch = rows[i:i + batch_size]
                execute_values(pg_cur, insert_query, batch, page_size=batch_size)

        pg_conn.commit()
        total_rows_migrated += row_count
        print(f"  Migrated {row_count:,} rows ({time.time() - t_tab:.2f}s)")

    # 5. Create performance indexes
    print("\nCreating PostgreSQL query indexes...")
    indexes = [
        ('accounts', 'account_id'),
        ('accounts', 'risk_score'),
        ('accounts', 'investigation_status'),
        ('alerts', 'alert_id'),
        ('alerts', 'account_id'),
        ('alerts', 'status'),
        ('transactions', 'account_id'),
        ('transactions', 'counterparty_id'),
        ('account_counterparties', 'account_id'),
        ('account_counterparties', 'counterparty_id'),
        ('customers', 'customer_id'),
        ('investigations', 'account_id')
    ]
    for tbl, col in indexes:
        if tbl in tables_to_migrate:
            try:
                pg_cur.execute(f'CREATE INDEX IF NOT EXISTS "idx_{tbl}_{col}" ON "{tbl}" ("{col}");')
            except Exception as e:
                print(f"  [Index Notice] {tbl}.{col}: {e}")
    pg_conn.commit()

    sqlite_conn.close()
    pg_cur.close()
    pg_conn.close()

    print("\n" + "=" * 60)
    print("MIGRATION COMPLETED SUCCESSFULLY!")
    print(f"Total Rows Migrated: {total_rows_migrated:,}")
    print(f"Time Taken:          {time.time() - t0:.2f} seconds")
    print("=" * 60)
    print("\nTo use PostgreSQL with your MuleTrace backend:")
    print("Set the environment variable:")
    print(f"DATABASE_URL={pg_url}")
    print()

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DATABASE_URL")
    if not url:
        print("Usage: python backend/migrate_to_postgres.py <DATABASE_URL>")
        print("Example: python backend/migrate_to_postgres.py postgresql://user:password@hostname:5432/muletrace")
        sys.exit(1)
    migrate(url)
