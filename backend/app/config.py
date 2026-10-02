from dataclasses import dataclass, asdict
import os
import json

@dataclass
class Settings:
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(os.path.dirname(BASE_DIR), "EDA-Phase-1")
    DB_PATH: str = os.path.join(BASE_DIR, "muletrace.db")
    CONFIG_PATH: str = os.path.join(BASE_DIR, "settings.json")
    
    # Detection Thresholds (Defaults requested by user)
    # Pattern 1: Fan-in / Fan-out
    FAN_IN_MIN_CPS: int = 6
    FAN_OUT_MIN_CPS: int = 5
    FAN_IN_OUT_RATIO_MIN: float = 0.6
    FAN_IN_OUT_RATIO_MAX: float = 1.6
    
    # Pattern 2: Bipartite Cycle / Reciprocal
    RECIPROCAL_MIN_OCCURRENCES: int = 2
    CYCLE_PATH_MAX_HOPS: int = 4
    
    # Pattern 3: Pass-through
    PASS_THROUGH_MIN_RATIO: float = 0.85  # 85% passed onward
    PASS_THROUGH_MAX_RATIO: float = 1.15  # Up to 115% (all money + existing small balance)
    PASS_THROUGH_MIN_CREDIT_VOL: float = 25000.0  # Min ₹25,000 inflow to trigger pass-through
    LOW_RETAINED_BALANCE_RATIO: float = 0.15  # Avg balance is <15% of total inflow
    
    # Pattern 4: New Accounts & Shared Identifiers
    NEW_ACCOUNT_MAX_DAYS: int = 90
    SHARED_PIN_MIN_ACCOUNTS: int = 8
    SHARED_BRANCH_MIN_ACCOUNTS: int = 15
    
    # Risk Score Weights & Thresholds
    RISK_CRITICAL_THRESHOLD: int = 80
    RISK_HIGH_THRESHOLD: int = 60
    RISK_MEDIUM_THRESHOLD: int = 30
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = 25
    MAX_PAGE_SIZE: int = 100

    def load_from_disk(self):
        """Loads persistent user thresholds from settings.json if present."""
        if os.path.exists(self.CONFIG_PATH):
            try:
                with open(self.CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for k, v in data.items():
                        if hasattr(self, k.upper()):
                            attr_name = k.upper()
                            orig_type = type(getattr(self, attr_name))
                            setattr(self, attr_name, orig_type(v))
            except Exception as e:
                print(f"[Settings] Error loading persistent settings: {e}")

    def save_to_disk(self):
        """Persists current user thresholds to settings.json."""
        try:
            payload = {
                "fan_in_min_cps": self.FAN_IN_MIN_CPS,
                "fan_out_min_cps": self.FAN_OUT_MIN_CPS,
                "pass_through_min_ratio": self.PASS_THROUGH_MIN_RATIO,
                "pass_through_max_ratio": self.PASS_THROUGH_MAX_RATIO,
                "pass_through_min_credit_vol": self.PASS_THROUGH_MIN_CREDIT_VOL,
                "new_account_max_days": self.NEW_ACCOUNT_MAX_DAYS,
                "risk_critical_threshold": self.RISK_CRITICAL_THRESHOLD,
                "risk_high_threshold": self.RISK_HIGH_THRESHOLD,
                "risk_medium_threshold": self.RISK_MEDIUM_THRESHOLD,
                "cycle_path_max_hops": self.CYCLE_PATH_MAX_HOPS
            }
            with open(self.CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            print(f"[Settings] Error saving settings: {e}")

    def reset_defaults(self):
        """Resets to standard default settings."""
        self.FAN_IN_MIN_CPS = 6
        self.FAN_OUT_MIN_CPS = 5
        self.PASS_THROUGH_MIN_RATIO = 0.85
        self.PASS_THROUGH_MAX_RATIO = 1.15
        self.NEW_ACCOUNT_MAX_DAYS = 90
        self.RISK_CRITICAL_THRESHOLD = 80
        self.RISK_HIGH_THRESHOLD = 60
        self.RISK_MEDIUM_THRESHOLD = 30
        self.save_to_disk()

settings = Settings()
settings.load_from_disk()
