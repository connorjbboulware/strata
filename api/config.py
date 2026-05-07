from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    database_url: str | None
    risk_free_rate: float
    trading_days_per_year: int


def load_settings() -> Settings:
    return Settings(
        database_url=os.environ.get("DATABASE_URL") or None,
        risk_free_rate=float(os.environ.get("RISK_FREE_RATE", "0.0")),
        trading_days_per_year=int(os.environ.get("TRADING_DAYS_PER_YEAR", "252")),
    )
