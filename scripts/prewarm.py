"""
Pre-warm the Postgres cache for the demo. Idempotent — re-running skips
already-cached symbols (the fetcher only hits yfinance for missing date ranges).

Run with:
    uv run python scripts/prewarm.py
"""
from __future__ import annotations

import sys
import time
from datetime import date, timedelta
from pathlib import Path

# Ensure repo root is on sys.path so `api.*` imports resolve when run via `uv run`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(".env")

from api.config import load_settings
from api.data.fetcher import get_prices
from api.db import close_pool, get_conn, init_schema, open_pool


TICKERS: list[str] = [
    # mega-cap tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    # broad-market index ETFs
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO",
    # bonds + alts
    "BND", "AGG", "TLT", "GLD", "SLV",
    # crypto
    "BTC-USD", "ETH-USD",
    # SPDR sector ETFs
    "XLK", "XLV", "XLF", "XLE", "XLY", "XLI", "XLP", "XLU", "XLB", "XLRE", "XLC",
]


def main() -> None:
    start = date(2010, 1, 1)
    end = date.today() - timedelta(days=1)
    n = len(TICKERS)

    print(f"Pre-warming cache: {n} tickers, {start} → {end}\n")

    pool = open_pool(load_settings())
    if pool is None:
        raise SystemExit("DATABASE_URL not set in .env — cannot connect to Postgres.")

    # init_schema is idempotent; skip if tables already exist (CREATE TABLE IF NOT EXISTS)
    with get_conn() as conn:
        init_schema(conn)

    t_total = time.perf_counter()
    fetched_count = 0
    cached_count = 0
    failed: list[str] = []
    total_rows = 0

    for i, symbol in enumerate(TICKERS, 1):
        t_sym = time.perf_counter()
        try:
            prices, warnings = get_prices([symbol], start, end)
            df = prices.get(symbol)
            elapsed = time.perf_counter() - t_sym
            rows = len(df) if df is not None else 0
            total_rows += rows
            # If yfinance was invoked, the call takes >2s; otherwise it's a pure cache read
            label = "cached" if elapsed < 1.5 else "fetched"
            if rows > 0:
                if elapsed < 1.5:
                    cached_count += 1
                else:
                    fetched_count += 1
                print(f"  [{i:>2}/{n}] {symbol:<8} {rows:>5} rows  [{label}]  ({elapsed:.1f}s)")
            else:
                failed.append(symbol)
                print(f"  [{i:>2}/{n}] {symbol:<8} <no data>     ({elapsed:.1f}s)")
            for w in warnings:
                print(f"       ⚠ {w}")
        except Exception as exc:  # noqa: BLE001
            failed.append(symbol)
            print(f"  [{i:>2}/{n}] {symbol:<8} ERROR: {type(exc).__name__}: {exc}")

    close_pool()

    elapsed_total = time.perf_counter() - t_total
    print()
    print("──────────────────────────────────────────")
    print(f"Tickers usable:    {n - len(failed)} / {n}")
    print(f"  cache hits:      {cached_count}")
    print(f"  yfinance pulls:  {fetched_count}")
    if failed:
        print(f"  failed:          {', '.join(failed)}")
    print(f"Total rows in cache: {total_rows:,}")
    print(f"Elapsed:           {elapsed_total:.1f}s")


if __name__ == "__main__":
    main()
