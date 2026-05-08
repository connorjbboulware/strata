import logging
from contextlib import asynccontextmanager

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Load .env before importing modules that read env (config, db)
load_dotenv()

from .config import load_settings  # noqa: E402
from .db import close_pool, get_conn, init_schema, open_pool  # noqa: E402
from .routes import backtest as backtest_routes  # noqa: E402
from .routes import health as health_routes  # noqa: E402

logger = logging.getLogger("strata.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    pool = open_pool(settings)
    if pool is not None:
        with get_conn() as conn:
            init_schema(conn)
    try:
        yield
    finally:
        close_pool()


app = FastAPI(title="Strata API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def retry_db_errors_on_get(request: Request, call_next):
    """
    Retry once on psycopg.OperationalError for read endpoints (GET only).

    The pool's `check_connection` covers the common case, but a transient
    network blip *during* a query can still surface here. Idempotent reads
    are safe to retry; POST /backtest is not (idempotency concern).
    """
    if request.method != "GET":
        return await call_next(request)
    try:
        return await call_next(request)
    except psycopg.OperationalError as exc:
        logger.warning(
            "psycopg.OperationalError on GET %s — retrying once: %s",
            request.url.path,
            exc,
        )
        return await call_next(request)


app.include_router(health_routes.router)
app.include_router(backtest_routes.router)
