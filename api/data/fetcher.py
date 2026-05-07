from datetime import date
from typing import Dict, Iterable, List, Tuple

import pandas as pd

from .cache import bulk_get_cached, compute_missing_ranges, upsert_prices
from .yfinance_client import DataUnavailable, fetch_prices


def get_prices(
    symbols: Iterable[str], start: date, end: date
) -> Tuple[Dict[str, pd.DataFrame], List[str]]:
    """
    For each symbol: bulk cache lookup → backfill any missing ranges from yfinance →
    merge fresh rows into the cached DataFrame in memory (no second SELECT).

    Returns ({symbol: DataFrame indexed by DatetimeIndex with adj_close}, warnings).
    Symbols with no usable data are omitted from the dict and added to warnings.
    """
    syms = sorted({s.strip().upper() for s in symbols})
    cached_by_symbol = bulk_get_cached(syms, start, end)

    out: Dict[str, pd.DataFrame] = {}
    warnings: List[str] = []

    for symbol in syms:
        cached = cached_by_symbol.get(symbol, pd.DataFrame(columns=["date", "open", "high", "low", "close", "adj_close", "volume"]))
        missing = compute_missing_ranges(cached, start, end)

        if missing:
            fetched_parts: list[pd.DataFrame] = []
            for gap_start, gap_end in missing:
                try:
                    fresh = fetch_prices(symbol, gap_start, gap_end)
                    upsert_prices(symbol, fresh)
                    fetched_parts.append(fresh)
                except DataUnavailable as exc:
                    warnings.append(f"{symbol}: {exc}")
            if fetched_parts:
                cached = pd.concat([cached] + fetched_parts, ignore_index=True)
                cached = (
                    cached.drop_duplicates(subset=["date"], keep="last")
                    .sort_values("date")
                    .reset_index(drop=True)
                )

        if cached.empty:
            warnings.append(f"{symbol}: no data available in {start}..{end}")
            continue

        cached = cached.copy()
        cached["date"] = pd.to_datetime(cached["date"])
        cached = cached.set_index("date").sort_index()
        out[symbol] = cached

    return out, warnings
