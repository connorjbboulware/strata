from datetime import date
from typing import Dict

import numpy as np
import pandas as pd

from ..schemas import (
    BenchmarkResult,
    DrawdownPoint,
    EquityPoint,
    Metrics,
    MonthlyReturn,
    StrategyRequest,
    StrategyResult,
)
from .metrics import (
    alpha_beta_r2,
    annualized_volatility,
    cagr,
    calmar,
    drawdown_series,
    max_drawdown,
    sharpe,
    sortino,
    total_return,
)
from .rebalance import generate_rebalance_dates


def _equity_points(eq: pd.Series) -> list[EquityPoint]:
    return [EquityPoint(date=ts.strftime("%Y-%m-%d"), value=float(v)) for ts, v in eq.items()]


def _drawdown_points(dd: pd.Series) -> list[DrawdownPoint]:
    return [
        DrawdownPoint(date=ts.strftime("%Y-%m-%d"), drawdown=float(v)) for ts, v in dd.items()
    ]


def _monthly_returns(eq: pd.Series) -> list[MonthlyReturn]:
    monthly = eq.resample("ME").last().pct_change().dropna()
    return [
        MonthlyReturn(month=ts.strftime("%Y-%m"), return_=float(v))  # serialized as "return"
        for ts, v in monthly.items()
    ]


def _build_metrics(
    equity: pd.Series,
    strategy_daily: pd.Series,
    benchmark_daily: pd.Series,
    start_date: date,
    end_date: date,
    rf: float,
    trading_days: int,
) -> Metrics:
    mdd_value, mdd_ts = max_drawdown(equity)
    cg = cagr(equity, start_date, end_date)
    alpha_ann, beta, r2 = alpha_beta_r2(strategy_daily, benchmark_daily, rf, trading_days)
    return Metrics(
        total_return=total_return(equity),
        cagr=cg,
        volatility_annualized=annualized_volatility(strategy_daily, trading_days),
        sharpe=sharpe(strategy_daily, rf, trading_days),
        sortino=sortino(strategy_daily, rf, trading_days),
        max_drawdown=mdd_value,
        max_drawdown_date=mdd_ts.strftime("%Y-%m-%d") if pd.notna(mdd_ts) else "",
        calmar=calmar(cg, mdd_value),
        alpha_annualized=alpha_ann,
        beta=beta,
        r_squared=r2,
    )


def run_strategy(
    strategy: StrategyRequest,
    prices: Dict[str, pd.DataFrame],
    benchmark_prices: pd.DataFrame,
    rf: float = 0.0,
    trading_days: int = 252,
) -> StrategyResult:
    """
    Walk forward through aligned adj_close prices applying daily returns to dollar holdings;
    on rebalance dates, reset holdings to target weights × current portfolio value.
    """
    # Build aligned adj_close matrix in ticker order
    closes = pd.DataFrame(
        {sym: prices[sym]["adj_close"] for sym in strategy.tickers if sym in prices}
    )
    if closes.shape[1] != len(strategy.tickers):
        missing = [s for s in strategy.tickers if s not in prices]
        raise ValueError(f"missing price data for tickers: {missing}")

    # Restrict to range and drop dates with any NaN across the basket
    start_ts = pd.Timestamp(strategy.start_date)
    end_ts = pd.Timestamp(strategy.end_date)
    closes = closes.loc[(closes.index >= start_ts) & (closes.index <= end_ts)].dropna()
    if len(closes) < 2:
        raise ValueError("insufficient overlapping price data for the requested range")

    # Target weights (in column order)
    n = len(strategy.tickers)
    if isinstance(strategy.weights, str) and strategy.weights == "equal":
        w_target = np.full(n, 1.0 / n)
    else:
        assert isinstance(strategy.weights, list)
        w_target_in = np.array(strategy.weights, dtype=float)
        w_target_in = w_target_in / w_target_in.sum()
        weight_map = dict(zip(strategy.tickers, w_target_in))
        w_target = np.array([weight_map[sym] for sym in closes.columns])

    # Rebalance schedule (on calendar of dates we actually have prices for)
    calendar = [ts.date() for ts in closes.index]
    rebalance_dates = generate_rebalance_dates(
        strategy.start_date, strategy.end_date, strategy.rebalance_frequency, calendar
    )
    rebalance_set = {pd.Timestamp(d) for d in rebalance_dates}

    # Walk-forward
    closes_arr = closes.to_numpy()
    n_days = closes_arr.shape[0]
    equity = np.empty(n_days)
    holdings = w_target * strategy.initial_capital
    equity[0] = float(holdings.sum())
    for i in range(1, n_days):
        ret = closes_arr[i] / closes_arr[i - 1] - 1.0
        holdings = holdings * (1.0 + ret)
        portfolio_value = float(holdings.sum())
        equity[i] = portfolio_value
        if closes.index[i] in rebalance_set:
            holdings = w_target * portfolio_value

    eq_series = pd.Series(equity, index=closes.index)
    dd_series = drawdown_series(eq_series)
    strategy_daily = eq_series.pct_change().dropna()

    # Benchmark daily returns over the same range (for alpha/beta/r²)
    bench_close = benchmark_prices["adj_close"]
    bench_close = bench_close.loc[
        (bench_close.index >= start_ts) & (bench_close.index <= end_ts)
    ].dropna()
    bench_daily = bench_close.pct_change().dropna()

    metrics = _build_metrics(
        eq_series, strategy_daily, bench_daily, strategy.start_date, strategy.end_date, rf, trading_days
    )

    return StrategyResult(
        name=strategy.name,
        equity_curve=_equity_points(eq_series),
        drawdown_series=_drawdown_points(dd_series),
        monthly_returns=_monthly_returns(eq_series),
        metrics=metrics,
        rebalance_dates=[d.isoformat() for d in rebalance_dates],
    )


def run_benchmark(
    symbol: str,
    benchmark_prices: pd.DataFrame,
    start_date: date,
    end_date: date,
    initial_capital: float,
    rf: float = 0.0,
    trading_days: int = 252,
) -> BenchmarkResult:
    """Buy-and-hold the benchmark ticker. Alpha/beta/R² vs itself are 0 / 1 / 1."""
    start_ts = pd.Timestamp(start_date)
    end_ts = pd.Timestamp(end_date)
    closes = benchmark_prices["adj_close"]
    closes = closes.loc[(closes.index >= start_ts) & (closes.index <= end_ts)].dropna()
    if len(closes) < 2:
        raise ValueError(f"insufficient benchmark data for {symbol}")

    eq = initial_capital * (closes / closes.iloc[0])
    daily = eq.pct_change().dropna()

    metrics = _build_metrics(eq, daily, daily, start_date, end_date, rf, trading_days)
    # Benchmark vs itself: clamp to ideal values
    metrics.alpha_annualized = 0.0
    metrics.beta = 1.0
    metrics.r_squared = 1.0

    return BenchmarkResult(symbol=symbol, equity_curve=_equity_points(eq), metrics=metrics)
