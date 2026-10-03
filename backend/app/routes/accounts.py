from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.services.query_service import (
    get_accounts_paginated,
    get_account_profile,
    get_account_transactions,
    get_account_network_graph,
    get_account_history
)

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])

@router.get("")
def list_accounts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    risk_level: Optional[str] = None,
    pattern: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("risk_score"),
    sort_order: str = Query("desc")
):
    return get_accounts_paginated(
        page=page,
        page_size=page_size,
        risk_level=risk_level,
        pattern=pattern,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order
    )

@router.get("/{account_id}")
def get_account(account_id: str):
    profile = get_account_profile(account_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Account not found")
    return profile

@router.get("/{account_id}/risk")
def get_account_risk(account_id: str):
    profile = get_account_profile(account_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Account not found")
    return profile.get("risk", {})

@router.get("/{account_id}/transactions")
def get_transactions(
    account_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    txn_type: Optional[str] = None,
    sort_order: str = Query("desc")
):
    return get_account_transactions(
        account_id=account_id,
        page=page,
        page_size=page_size,
        txn_type=txn_type,
        sort_order=sort_order
    )

@router.get("/{account_id}/network")
def get_network(
    account_id: str,
    max_cps: int = Query(25, ge=5, le=50)
):
    return get_account_network_graph(account_id=account_id, max_cps=max_cps)

@router.get("/{account_id}/history")
def get_history(
    account_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    txn_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    sort_order: str = Query("desc"),
    all_records: bool = Query(False)
):
    history = get_account_history(
        account_id=account_id,
        start_date=start_date,
        end_date=end_date,
        min_amount=min_amount,
        max_amount=max_amount,
        txn_type=txn_type,
        page=page,
        page_size=page_size,
        sort_order=sort_order,
        all_records=all_records
    )
    if history is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return history

