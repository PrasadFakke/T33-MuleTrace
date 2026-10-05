import sqlite3
import os
import shutil
from contextlib import contextmanager
from app.config import settings


_DB_INITIALIZED = False

DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[11:]

_PG_POOL = None

def get_pg_pool():
    global _PG_POOL
    if _PG_POOL is None and DATABASE_URL:
        try:
            import psycopg2.pool
            _PG_POOL = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=15,
                dsn=DATABASE_URL
            )
        except Exception as e:
            print(f"[PostgreSQL Pool Warning] Failed to initialize connection pool: {e}")
            _PG_POOL = None
    return _PG_POOL


class PostgresRowWrapper(dict):
    """Wrapper to support both dict-key access (row['account_id']) and index access (row[0]) like sqlite3.Row"""
    def __init__(self, d):
        super().__init__(d)
        self._values = list(d.values())
        
    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return super().__getitem__(key)


class PostgresCursorWrapper:
    """Wrapper that translates SQLite '?' placeholders to PostgreSQL '%s' and wraps fetched rows"""
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, params=None):
        pg_query = query.replace('?', '%s')
        if params is not None:
            return self._cursor.execute(pg_query, params)
        return self._cursor.execute(pg_query)

    def executemany(self, query, params_list):
        pg_query = query.replace('?', '%s')
        return self._cursor.executemany(pg_query, params_list)

    def fetchone(self):
        row = self._cursor.fetchone()
        return PostgresRowWrapper(row) if row is not None else None

    def fetchall(self):
        return [PostgresRowWrapper(r) for r in self._cursor.fetchall()]

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class PostgresConnWrapper:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        from psycopg2.extras import RealDictCursor
        return PostgresCursorWrapper(self._conn.cursor(cursor_factory=RealDictCursor))

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    def execute(self, query, params=None):
        cur = self.cursor()
        cur.execute(query, params)
        return cur

    def close(self):
        # We don't close pooled connection here, pool.putconn handles it
        pass

    def __getattr__(self, name):
        return getattr(self._conn, name)


def ensure_database_initialized():
    """Ensure database exists and is populated. Skips if already initialized or using PostgreSQL."""
    if DATABASE_URL:
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            conn = psycopg2.connect(DATABASE_URL)
            needs_init = False
            try:
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts'")
                if not cur.fetchone():
                    needs_init = True
                cur.close()
            finally:
                conn.close()

            if needs_init:
                print("[PostgreSQL] Tables not found. Initializing PostgreSQL schema and data...")
                try:
                    from migrate_to_postgres import migrate
                except ImportError:
                    from backend.migrate_to_postgres import migrate
                migrate(DATABASE_URL)
        except Exception as e:
            print(f"[PostgreSQL Init Notice] {e}")
        return

    global _DB_INITIALIZED
    if _DB_INITIALIZED and os.path.exists(settings.DB_PATH):
        return

    os.makedirs(settings.DATA_STORAGE_DIR, exist_ok=True)
    os.makedirs(settings.STAGING_DIR, exist_ok=True)
    
    if os.path.exists(settings.DB_PATH):
        # Check if initialized
        try:
            conn = sqlite3.connect(settings.DB_PATH)
            c = conn.cursor()
            c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='db_metadata'")
            if c.fetchone():
                c.execute("PRAGMA journal_mode = WAL;")
                c.execute("PRAGMA busy_timeout = 30000;")
                conn.close()
                _DB_INITIALIZED = True
                return
            conn.close()
        except:
            pass

    # If old DB exists at backend/muletrace.db, migrate it
    old_db = os.path.join(settings.BASE_DIR, "muletrace.db")
    if os.path.exists(old_db) and not os.path.exists(settings.DB_PATH):
        shutil.copy2(old_db, settings.DB_PATH)
        from app.ingestion.init_dynamic_db import main as upgrade_schema
        upgrade_schema()
        return

    # Otherwise initialize from scratch
    if not os.path.exists(settings.DB_PATH):
        try:
            from app.ingestion.build_db import build_database
            build_database()
        except Exception as e:
            print(f"[Warning] Full dataset build skipped ({e}), initializing empty schema.")
        from app.ingestion.init_dynamic_db import main as upgrade_schema
        upgrade_schema()

    # Enable WAL mode for high concurrency
    try:
        conn = sqlite3.connect(settings.DB_PATH, timeout=30.0)
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA busy_timeout = 30000;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.close()
    except Exception:
        pass


@contextmanager
def get_db():
    if DATABASE_URL:
        pool = get_pg_pool()
        if pool:
            conn = pool.getconn()
            try:
                yield PostgresConnWrapper(conn)
            finally:
                pool.putconn(conn)
        else:
            import psycopg2
            conn = psycopg2.connect(DATABASE_URL)
            try:
                yield PostgresConnWrapper(conn)
            finally:
                conn.close()
    else:
        ensure_database_initialized()
        conn = sqlite3.connect(settings.DB_PATH, timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 30000;")
        try:
            yield conn
        finally:
            conn.close()


