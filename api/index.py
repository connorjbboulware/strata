from datetime import datetime, timezone
import os
from typing import Literal

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="Strata API")


class HealthResponse(BaseModel):
    status: Literal["ok"]
    ts: str
    db: Literal["ok", "down"]


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    db: Literal["ok", "down"] = "down"
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        try:
            with psycopg.connect(db_url, connect_timeout=10) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            db = "ok"
        except Exception:
            db = "down"
    return HealthResponse(
        status="ok",
        ts=datetime.now(timezone.utc).isoformat(),
        db=db,
    )
