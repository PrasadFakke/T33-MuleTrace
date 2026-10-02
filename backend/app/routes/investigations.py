from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.query_service import update_investigation_status

router = APIRouter(prefix="/api/investigations", tags=["Investigations"])

class StatusUpdateRequest(BaseModel):
    status: str  # 'UNDER_REVIEW', 'CONFIRMED', 'CLEARED'
    analyst_notes: Optional[str] = ""

@router.post("/{account_id}/status")
def update_status(account_id: str, payload: StatusUpdateRequest):
    valid_statuses = {"NEW", "UNDER_REVIEW", "CONFIRMED", "CLEARED", "RESET", "REDO", "REVERT", "UNFLAGGED"}
    if payload.status.upper() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        
    resolved_status = update_investigation_status(
        account_id=account_id,
        status=payload.status,
        notes=payload.analyst_notes or ""
    )
    return {"success": True, "account_id": account_id, "new_status": resolved_status}
