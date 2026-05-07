from datetime import datetime, timezone

from fastapi import APIRouter

from ..db import get_conn, get_pool
from ..schemas import HealthResponse, PoolStats

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    db: str = "down"
    pool_stats: PoolStats | None = None

    pool = get_pool()
    if pool is not None:
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            db = "ok"
        except Exception:
            db = "down"

        # psycopg_pool exposes runtime stats via .get_stats()
        try:
            stats = pool.get_stats()
            pool_stats = PoolStats(
                size=int(stats.get("pool_size", 0)),
                available=int(stats.get("pool_available", 0)),
                requests_waiting=int(stats.get("requests_waiting", 0)),
            )
        except Exception:
            pool_stats = None

    return HealthResponse(
        status="ok",
        ts=datetime.now(timezone.utc).isoformat(),
        db=db,  # type: ignore[arg-type]
        pool=pool_stats,
    )
