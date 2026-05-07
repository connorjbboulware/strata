from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env before importing modules that read env (config, db)
load_dotenv()

from .config import load_settings  # noqa: E402
from .db import close_pool, get_conn, init_schema, open_pool  # noqa: E402
from .routes import backtest as backtest_routes  # noqa: E402
from .routes import health as health_routes  # noqa: E402


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

app.include_router(health_routes.router)
app.include_router(backtest_routes.router)
