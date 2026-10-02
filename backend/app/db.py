import sqlite3
import os
import shutil
from contextlib import contextmanager
from app.config import settings


_DB_INITIALIZED = False

def ensure_database_initialized():
    """Ensure database exists and is populated. Skips if already initialized."""
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

        
@contextmanager
def get_db():
    ensure_database_initialized()
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
