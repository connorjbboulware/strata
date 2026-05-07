"""
Pure pandas/numpy metric calculations.

All daily_returns inputs are decimal (0.01 == 1%). All annualised outputs are decimal.
Trading-day default is 252.
"""

from datetime import date
from typing import Tuple

import numpy as np
import pandas as pd


def total_return(equity: pd.Series) -> float:
    if len(equity) < 2:
        return 0.0
    return float(equity.iloc[-1] / equity.iloc[0] - 1.0)


def cagr(equity: pd.Series, start_date: date, end_date: date) -> float:
    if len(equity) < 2:
        return 0.0
    years = (end_date - start_date).days / 365.25
    if years <= 0:
        return 0.0
    ratio = float(equity.iloc[-1] / equity.iloc[0])
    if ratio <= 0:
        return -1.0
    return ratio ** (1.0 / years) - 1.0


def annualized_volatility(daily_returns: pd.Series, trading_days: int = 252) -> float:
    if len(daily_returns) < 2:
        return 0.0
    sd = float(daily_returns.std(ddof=1))
    return sd * np.sqrt(trading_days)


def sharpe(daily_returns: pd.Series, rf: float = 0.0, trading_days: int = 252) -> float:
    """sqrt(N) · mean(excess) / std(excess), with rf annualised, simple-divided to daily."""
    if len(daily_returns) < 2:
        return 0.0
    daily_rf = rf / trading_days
    excess = daily_returns - daily_rf
    sd = float(excess.std(ddof=1))
    # Guard against fp residuals from constant-input std (e.g. 1e-18)
    if not np.isfinite(sd) or sd < 1e-12:
        return 0.0
    return float(np.sqrt(trading_days) * excess.mean() / sd)


def sortino(daily_returns: pd.Series, rf: float = 0.0, trading_days: int = 252) -> float:
    """
    Canonical Sortino (Sortino 1980): denominator is the RMS of (excess clipped at 0)
    averaged over ALL observations — positives contribute zero, not "skipped".

      DD = sqrt( mean_i( min(excess_i, 0)^2 ) )    over all N observations
      S  = sqrt(trading_days) · mean(excess) / DD
    """
    if len(daily_returns) < 2:
        return 0.0
    daily_rf = rf / trading_days
    excess = (daily_returns - daily_rf).to_numpy()
    downside = np.minimum(excess, 0.0)  # positives → 0, kept in the mean
    dd = float(np.sqrt(np.mean(np.square(downside))))
    if dd < 1e-12:
        return 0.0
    return float(np.sqrt(trading_days) * excess.mean() / dd)


def drawdown_series(equity: pd.Series) -> pd.Series:
    """Decimal drawdown series: equity / running_peak - 1 (always ≤ 0)."""
    cummax = equity.cummax()
    return equity / cummax - 1.0


def max_drawdown(equity: pd.Series) -> Tuple[float, pd.Timestamp]:
    """Returns (worst_drawdown_decimal, date_of_worst_drawdown)."""
    if len(equity) == 0:
        return 0.0, pd.NaT  # type: ignore[return-value]
    dd = drawdown_series(equity)
    idx = dd.idxmin()
    return float(dd.loc[idx]), idx


def calmar(cagr_value: float, max_dd_value: float) -> float:
    """CAGR divided by absolute max drawdown. Zero when max_dd is non-negative."""
    if max_dd_value >= 0:
        return 0.0
    return cagr_value / abs(max_dd_value)


def alpha_beta_r2(
    strategy_daily: pd.Series,
    benchmark_daily: pd.Series,
    rf: float = 0.0,
    trading_days: int = 252,
) -> Tuple[float, float, float]:
    """
    OLS of (strategy_excess) on (benchmark_excess), with intercept.

      excess_t = α + β · benchmark_excess_t + ε_t

    Beta = slope. R² = 1 − SS_res / SS_tot. Alpha is the intercept,
    annualised geometrically: (1 + α_daily) ** trading_days − 1.
    Returns (alpha_annualised, beta, r_squared).
    """
    df = pd.concat([strategy_daily, benchmark_daily], axis=1, join="inner").dropna()
    if len(df) < 2:
        return 0.0, 0.0, 0.0

    daily_rf = rf / trading_days
    y = df.iloc[:, 0].to_numpy() - daily_rf
    x = df.iloc[:, 1].to_numpy() - daily_rf

    # Design matrix [1, x] for OLS y = a + b*x
    X = np.column_stack([np.ones_like(x), x])
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    intercept = float(coef[0])
    slope = float(coef[1])

    y_pred = X @ coef
    ss_res = float(np.sum(np.square(y - y_pred)))
    ss_tot = float(np.sum(np.square(y - y.mean())))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    # Linear annualisation: α_annual = α_daily · trading_days. CAPM convention,
    # matches Bloomberg's default. (Geometric (1+α)^252 − 1 is also defensible
    # but compounds the regression-noise bias more aggressively at high N.)
    alpha_ann = intercept * trading_days
    return alpha_ann, slope, r2
