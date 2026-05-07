import time
from datetime import date, timedelta

import pandas as pd
import yfinance as yf


class DataUnavailable(Exception):
    """Raised when a ticker has no data in the requested range."""


_EXPECTED_COLS = ("date", "open", "high", "low", "close", "adj_close", "volume")


def fetch_prices(symbol: str, start: date, end: date) -> pd.DataFrame:
    """
    Fetch daily OHLCV from yfinance for [start, end] inclusive.

    yfinance's `end` is exclusive, so we add a day. One retry on transient failure.
    Returns a DataFrame with columns: date, open, high, low, close, adj_close, volume.
    """
    end_exclusive = end + timedelta(days=1)
    last_err: Exception | None = None
    for attempt in range(2):
        try:
            df = yf.download(
                symbol,
                start=start.isoformat(),
                end=end_exclusive.isoformat(),
                progress=False,
                auto_adjust=False,  # we want both close AND adj_close
                threads=False,
                actions=False,
            )
            if df is None or df.empty:
                raise DataUnavailable(f"no data returned for {symbol}")

            # yfinance often returns multi-level cols even for a single ticker
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            df = df.reset_index()
            df.columns = [str(c).lower().replace(" ", "_") for c in df.columns]

            # Some yfinance versions return "adj close" or omit it under auto_adjust
            if "adj_close" not in df.columns and "close" in df.columns:
                # Fall back: treat close as already adjusted
                df["adj_close"] = df["close"]

            missing = [c for c in _EXPECTED_COLS if c not in df.columns]
            if missing:
                raise DataUnavailable(f"yfinance returned {symbol} without columns {missing}")

            df = df[list(_EXPECTED_COLS)].copy()
            df["date"] = pd.to_datetime(df["date"]).dt.date
            for col in ("open", "high", "low", "close", "adj_close"):
                df[col] = df[col].astype(float)
            df["volume"] = df["volume"].fillna(0).astype("int64")
            return df
        except DataUnavailable:
            raise
        except Exception as exc:
            last_err = exc
            if attempt == 0:
                time.sleep(0.5)
                continue
            raise DataUnavailable(f"yfinance error for {symbol}: {exc}") from exc

    raise DataUnavailable(f"yfinance failure for {symbol}: {last_err}")
