from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.services.query_service import get_alerts_paginated
from app.db import get_db

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])

@router.get("")
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    severity: Optional[str] = None,
    pattern: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("risk_score"),
    sort_order: str = Query("desc")
):
    return get_alerts_paginated(
        page=page,
        page_size=page_size,
        severity=severity,
        pattern=pattern,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order
    )

@router.get("/{alert_id}")
def get_alert(alert_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alerts WHERE alert_id = ?", (alert_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        return dict(row)
