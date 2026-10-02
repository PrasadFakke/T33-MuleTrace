from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings
from app.services.detection_engine import recalculate_detection_engine

router = APIRouter(prefix="/api/settings", tags=["Settings"])

class SettingsUpdate(BaseModel):
    fan_in_min_cps: int = 6
    fan_out_min_cps: int = 5
    pass_through_min_ratio: float = 0.85
    new_account_max_days: int = 90
    risk_critical_threshold: int = 80
    risk_high_threshold: int = 60

@router.get("")
def get_current_settings():
    return {
        "fan_in_min_cps": settings.FAN_IN_MIN_CPS,
        "fan_out_min_cps": settings.FAN_OUT_MIN_CPS,
        "pass_through_min_ratio": settings.PASS_THROUGH_MIN_RATIO,
        "pass_through_max_ratio": settings.PASS_THROUGH_MAX_RATIO,
        "pass_through_min_credit_vol": settings.PASS_THROUGH_MIN_CREDIT_VOL,
        "new_account_max_days": settings.NEW_ACCOUNT_MAX_DAYS,
        "risk_critical_threshold": settings.RISK_CRITICAL_THRESHOLD,
        "risk_high_threshold": settings.RISK_HIGH_THRESHOLD,
        "risk_medium_threshold": settings.RISK_MEDIUM_THRESHOLD,
        "max_network_hops": settings.CYCLE_PATH_MAX_HOPS
    }

@router.post("")
def update_settings(payload: SettingsUpdate):
    settings.FAN_IN_MIN_CPS = payload.fan_in_min_cps
    settings.FAN_OUT_MIN_CPS = payload.fan_out_min_cps
    settings.PASS_THROUGH_MIN_RATIO = payload.pass_through_min_ratio
    settings.NEW_ACCOUNT_MAX_DAYS = payload.new_account_max_days
    settings.RISK_CRITICAL_THRESHOLD = payload.risk_critical_threshold
    settings.RISK_HIGH_THRESHOLD = payload.risk_high_threshold
    
    # Persist to disk
    settings.save_to_disk()
    
    # Recalculate detection engine across all 40,038 accounts
    stats = recalculate_detection_engine()
    
    return {
        "success": True,
        "message": "Detection thresholds saved & all platform analytics recalculated successfully.",
        "stats": stats,
        "settings": get_current_settings()
    }

@router.post("/reset")
def reset_settings_to_defaults():
    settings.reset_defaults()
    stats = recalculate_detection_engine()
    return {
        "success": True,
        "message": "Detection thresholds reset to baseline AML defaults & pipeline recalculated.",
        "stats": stats,
        "settings": get_current_settings()
    }
