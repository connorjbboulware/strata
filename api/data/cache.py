from datetime import date, timedelta
from typing import Dict, Iterable, List, Tuple

import pandas as pd
from psycopg.rows import dict_row

from ..db import get_conn

# All NUMERIC columns are cast to float8 in SQL so psycopg returns native Python
# floats instead of Decimal — Decimal construction is the dominant cost on a 1761
# × 7-column response and pushes a single SELECT from ~150ms to ~2.5s.
_PRICE_COLS_SQL = (
    "dp.date, "
    "dp.open::float8 AS open, "
    "dp.high::float8 AS high, "
    "dp.low::float8 AS low, "
    "dp.close::float8 AS close, "
    "dp.adj_close::float8 AS adj_close, "
    "dp.volume"
)
_PRICE_COLS = ["date", "open", "high", "low", "close", "adj_close", "volume"]


def ensure_ticker(symbol: str) -> int:
    """Return ticker_id for symbol, inserting on first sight."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tickers (symbol)
                VALUES (%s)
                ON CONFLICT (symbol) DO UPDATE SET symbol = EXCLUDED.symbol
                RETURNING id
                """,
                (symbol,),
            )
            row = cur.fetchone()
            assert row is not None
            return int(row[0])


def get_cached(
    symbol: str, start: date, end: date
) -> Tuple[pd.DataFrame, List[Tuple[date, date]]]:
    """
    Single-symbol cache lookup. Returns (rows_in_range, missing_ranges).
    """
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT {_PRICE_COLS_SQL}
                FROM daily_prices dp
                JOIN tickers t ON t.id = dp.ticker_id
                WHERE t.symbol = %s AND dp.date BETWEEN %s AND %s
                ORDER BY dp.date
                """,
                (symbol, start, end),
            )
            rows = cur.fetchall()

    df = pd.DataFrame(rows, columns=_PRICE_COLS)
    if not df.empty:
        df["volume"] = df["volume"].astype("int64")
        df["date"] = pd.to_datetime(df["date"]).dt.date

    return df, compute_missing_ranges(df, start, end)


def bulk_get_cached(
    symbols: Iterable[str], start: date, end: date
) -> Dict[str, pd.DataFrame]:
    """
    Batched cache lookup for multiple symbols in a single round-trip.
    Returns {symbol: DataFrame}. Symbols with no cached rows are absent from the dict.
    """
    syms = sorted({s.strip().upper() for s in symbols})
    if not syms:
        return {}
    with get_conn() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT t.symbol AS symbol, {_PRICE_COLS_SQL}
                FROM daily_prices dp
                JOIN tickers t ON t.id = dp.ticker_id
                WHERE t.symbol = ANY(%s) AND dp.date BETWEEN %s AND %s
                ORDER BY t.symbol, dp.date
                """,
                (syms, start, end),
            )
            rows = cur.fetchall()

    if not rows:
        return {}

    df = pd.DataFrame(rows, columns=["symbol"] + _PRICE_COLS)
    df["volume"] = df["volume"].astype("int64")
    df["date"] = pd.to_datetime(df["date"]).dt.date

    return {
        sym: g.drop(columns=["symbol"]).reset_index(drop=True)
        for sym, g in df.groupby("symbol", sort=False)
    }


def compute_missing_ranges(
    df: pd.DataFrame, start: date, end: date
) -> List[Tuple[date, date]]:
    """Coarse heuristic: report only head and tail gaps. No internal-gap detection."""
    if df.empty:
        return [(start, end)]
    cached_min: date = df["date"].min()
    cached_max: date = df["date"].max()
    gaps: List[Tuple[date, date]] = []
    if start < cached_min:
        gaps.append((start, cached_min - timedelta(days=1)))
    if end > cached_max:
        gaps.append((cached_max + timedelta(days=1), end))
    return gaps


_CHUNK = 500
_ROW_PLACEHOLDER = "(%s, %s, %s, %s, %s, %s, %s, %s)"


def upsert_prices(symbol: str, df: pd.DataFrame) -> None:
    """
    Insert/update price rows in chunks of `_CHUNK` rows per statement.

    Per-row executemany over the Supabase transaction pooler is one round-trip per row
    (~100 ms each → minutes for 1750 rows). A multi-row INSERT pushes that to one
    round-trip per chunk, which is 500x faster end-to-end.
    """
    if df.empty:
        return
    ticker_id = ensure_ticker(symbol)
    rows = [
        (
            ticker_id,
            r["date"],
            float(r["open"]) if pd.notna(r["open"]) else None,
            float(r["high"]) if pd.notna(r["high"]) else None,
            float(r["low"]) if pd.notna(r["low"]) else None,
            float(r["close"]) if pd.notna(r["close"]) else None,
            float(r["adj_close"]) if pd.notna(r["adj_close"]) else None,
            int(r["volume"]) if pd.notna(r["volume"]) else None,
        )
        for _, r in df.iterrows()
    ]
    with get_conn() as conn:
        with conn.cursor() as cur:
            for i in range(0, len(rows), _CHUNK):
                chunk = rows[i : i + _CHUNK]
                placeholders = ",".join([_ROW_PLACEHOLDER] * len(chunk))
                params: list = [v for row in chunk for v in row]
                cur.execute(
                    f"""
                    INSERT INTO daily_prices
                      (ticker_id, date, open, high, low, close, adj_close, volume)
                    VALUES {placeholders}
                    ON CONFLICT (ticker_id, date) DO UPDATE SET
                      open      = EXCLUDED.open,
                      high      = EXCLUDED.high,
                      low       = EXCLUDED.low,
                      close     = EXCLUDED.close,
                      adj_close = EXCLUDED.adj_close,
                      volume    = EXCLUDED.volume
                    """,
                    params,
                )
            cur.execute(
                "UPDATE tickers SET last_refreshed_at = NOW() WHERE id = %s",
                (ticker_id,),
            )
        conn.commit()
