from datetime import date

import numpy as np
import pandas as pd
import pytest

from api.engine.backtest import run_strategy
from api.schemas import StrategyRequest


def _flat_growth_df(start: str, end: str, start_price: float, daily_rate: float) -> pd.DataFrame:
    """Synthesize a price DataFrame with constant daily compound rate."""
    idx = pd.bdate_range(start, end)
    n = len(idx)
    closes = start_price * (1 + daily_rate) ** np.arange(n)
    return pd.DataFrame(
        {
            "open": closes,
            "high": closes,
            "low": closes,
            "close": closes,
            "adj_close": closes,
            "volume": np.zeros(n, dtype="int64"),
        },
        index=pd.DatetimeIndex(idx, name="date"),
    )


def test_buy_and_hold_single_ticker_recovers_total_return():
    """1 ticker, 1% compound daily growth, no rebalance → equity must equal initial × growth."""
    daily_rate = 0.001  # 0.1% per business day
    prices = _flat_growth_df("2020-01-02", "2020-12-31", start_price=100.0, daily_rate=daily_rate)
    benchmark = _flat_growth_df("2020-01-02", "2020-12-31", start_price=100.0, daily_rate=0.0005)

    strategy = StrategyRequest(
        name="buy and hold",
        tickers=["TEST"],
        weights="equal",
        start_date=date(2020, 1, 2),
        end_date=date(2020, 12, 31),
        initial_capital=10_000.0,
        rebalance_frequency="none",
    )

    result = run_strategy(strategy, {"TEST": prices}, benchmark)

    n = len(prices)
    expected_final = 10_000.0 * (prices["adj_close"].iloc[-1] / prices["adj_close"].iloc[0])
    actual_final = result.equity_curve[-1].value

    assert actual_final == pytest.approx(expected_final, rel=1e-6)
    # Total return matches
    assert result.metrics.total_return == pytest.approx((1 + daily_rate) ** (n - 1) - 1, rel=1e-6)
    # Buy-and-hold of constantly-rising series → no drawdown
    assert result.metrics.max_drawdown == pytest.approx(0.0, abs=1e-9)
    # No rebalance dates emitted
    assert result.rebalance_dates == []


def test_two_ticker_equal_weight_no_rebalance_drifts_correctly():
    """Two assets, one rises 10%, one falls 10% — equity = (initial/2) × (1.1) + (initial/2) × (0.9)."""
    a = _flat_growth_df("2020-01-02", "2020-01-31", start_price=100.0, daily_rate=0.0)
    a.loc[a.index[-1], ["open", "high", "low", "close", "adj_close"]] = 110.0
    b = _flat_growth_df("2020-01-02", "2020-01-31", start_price=100.0, daily_rate=0.0)
    b.loc[b.index[-1], ["open", "high", "low", "close", "adj_close"]] = 90.0
    bench = _flat_growth_df("2020-01-02", "2020-01-31", start_price=100.0, daily_rate=0.0)

    strategy = StrategyRequest(
        name="ab",
        tickers=["A", "B"],
        weights="equal",
        start_date=date(2020, 1, 2),
        end_date=date(2020, 1, 31),
        initial_capital=10_000.0,
        rebalance_frequency="none",
    )

    result = run_strategy(strategy, {"A": a, "B": b}, bench)
    final = result.equity_curve[-1].value
    # 0.5 × 10000 × 1.10 + 0.5 × 10000 × 0.90 = 10000
    assert final == pytest.approx(10_000.0, rel=1e-6)


def test_rebalance_dates_emitted_for_monthly():
    prices = _flat_growth_df("2020-01-02", "2020-06-30", start_price=100.0, daily_rate=0.0005)
    bench = prices.copy()

    strategy = StrategyRequest(
        name="monthly rebal",
        tickers=["X"],
        weights="equal",
        start_date=date(2020, 1, 2),
        end_date=date(2020, 6, 30),
        initial_capital=10_000.0,
        rebalance_frequency="monthly",
    )
    result = run_strategy(strategy, {"X": prices}, bench)
    # Monthly rebalances in Feb, Mar, Apr, May, Jun → 5
    assert len(result.rebalance_dates) == 5
