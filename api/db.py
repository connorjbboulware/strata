from contextlib import contextmanager
from typing import Iterator, Optional

from psycopg import Connection
from psycopg_pool import ConnectionPool

from .config import Settings

_pool: Optional[ConnectionPool] = None


def open_pool(settings: Settings) -> Optional[ConnectionPool]:
    """Open a module-scope connection pool. No-op if DATABASE_URL is unset."""
    global _pool
    if _pool is not None:
        return _pool
    if not settings.database_url:
        return None
    _pool = ConnectionPool(
        conninfo=settings.database_url,
        min_size=1,
        max_size=5,
        timeout=10.0,
        kwargs={"connect_timeout": 10},
        open=False,
    )
    _pool.open(wait=True, timeout=15.0)
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_pool() -> Optional[ConnectionPool]:
    return _pool


@contextmanager
def get_conn() -> Iterator[Connection]:
    if _pool is None:
        raise RuntimeError("Connection pool not initialized — open_pool() first")
    with _pool.connection() as conn:
        yield conn


def init_schema(conn: Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS tickers (
                id SERIAL PRIMARY KEY,
                symbol VARCHAR(20) UNIQUE NOT NULL,
                last_refreshed_at TIMESTAMPTZ
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS daily_prices (
                ticker_id INTEGER NOT NULL REFERENCES tickers(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                open NUMERIC(14, 4),
                high NUMERIC(14, 4),
                low NUMERIC(14, 4),
                close NUMERIC(14, 4),
                adj_close NUMERIC(14, 4),
                volume BIGINT,
                PRIMARY KEY (ticker_id, date)
            )
            """
        )
    conn.commit()
