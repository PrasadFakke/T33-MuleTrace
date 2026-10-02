from fastapi import APIRouter
from app.services.query_service import get_dashboard_summary

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_summary():
    return get_dashboard_summary()
