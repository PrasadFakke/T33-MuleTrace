import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from typing import Optional
from app.config import settings
from app.ingestion.dynamic_ingestion import (
    process_upload_and_preview,
    commit_ingestion_batch,
    rollback_ingestion_batch,
    get_ingestion_history
)
from app.db import get_db

router = APIRouter(prefix="/api/ingestion", tags=["Data Ingestion & Dynamic Analysis"])

class CommitRequest(BaseModel):
    batch_id: str

@router.post("/upload")
async def upload_and_preview(file: UploadFile = File(...)):
    """
    Staging & Validation endpoint:
    Accepts CSV / XLSX file, saves to staging, detects schema, validates,
    runs deterministic entity resolution, and returns preview before committing.
    """
    filename = file.filename or "upload.csv"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    os.makedirs(settings.STAGING_DIR, exist_ok=True)

    # Save to staging directory
    temp_id = uuid.uuid4().hex[:8]
    staged_filename = f"{temp_id}_{filename}"
    staged_path = os.path.join(settings.STAGING_DIR, staged_filename)

    try:
        with open(staged_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Check file size limit
    size_mb = os.path.getsize(staged_path) / (1024 * 1024)
    if size_mb > settings.MAX_UPLOAD_SIZE_MB:
        try: os.remove(staged_path)
        except: pass
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum upload size limit ({size_mb:.1f} MB > {settings.MAX_UPLOAD_SIZE_MB} MB)"
        )

    # Process and generate preview
    result = process_upload_and_preview(staged_path, filename)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Validation failed"))

    return result

@router.post("/commit")
def commit_batch(payload: CommitRequest):
    """
    Atomic Commit & Fraud Re-Analysis:
    Inserts valid records into SQLite, re-analyzes affected accounts,
    recalculates risk scores, and updates alerts.
    """
    result = commit_ingestion_batch(payload.batch_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Commit failed"))
    return result

@router.post("/{batch_id}/rollback")
def rollback_batch(batch_id: str):
    """
    Batch Rollback Engine:
    Undoes records from the batch without affecting baseline data.
    """
    result = rollback_ingestion_batch(batch_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Rollback failed"))
    return result

@router.get("/history")
def get_history():
    """Returns ingestion batches history and audit trail."""
    return get_ingestion_history()

@router.get("/{batch_id}")
def get_batch(batch_id: str):
    """Returns detailed records for an ingestion batch."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ingestion_batches WHERE batch_id = ?", (batch_id,))
        b_row = cursor.fetchone()
        if not b_row:
            raise HTTPException(status_code=404, detail=f"Batch {batch_id} not found")

        cursor.execute("SELECT * FROM ingestion_records WHERE batch_id = ? LIMIT 50", (batch_id,))
        records = [dict(r) for r in cursor.fetchall()]

        return {
            "batch": dict(b_row),
            "records": records
        }
