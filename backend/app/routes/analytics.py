from fastapi import APIRouter
from app.services.query_service import get_analytics_data

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("")
def get_analytics():
    return get_analytics_data()
