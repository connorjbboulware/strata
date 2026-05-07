from datetime import date

import numpy as np
import pandas as pd
import pytest

from api.engine.metrics import (
    alpha_beta_r2,
    annualized_volatility,
    cagr,
    drawdown_series,
    max_drawdown,
    sharpe,
    sortino,
    total_return,
    calmar,
)


def test_total_return_simple():
    eq = pd.Series([100.0, 110.0, 121.0])
    assert total_return(eq) == pytest.approx(0.21, abs=1e-9)


def test_total_return_short_series_is_zero():
    assert total_return(pd.Series([100.0])) == 0.0


def test_cagr_one_year_geometric():
    eq = pd.Series([100.0, 110.0])
    cg = cagr(eq, date(2020, 1, 1), date(2021, 1, 1))
    # exactly one year (365 days) → ~10% but year fraction is 365/365.25
    assert 0.0995 < cg < 0.1005


def test_cagr_two_years_compounded():
    eq = pd.Series([100.0, 121.0])
    cg = cagr(eq, date(2020, 1, 1), date(2022, 1, 1))
    # should approximate 10% annualised over 2 years (1.21 ** 0.5 - 1 ≈ 0.10)
    assert 0.0995 < cg < 0.1005


def test_max_drawdown_classic():
    idx = pd.date_range("2020-01-01", periods=4)
    eq = pd.Series([100.0, 120.0, 80.0, 100.0], index=idx)
    dd_value, dd_date = max_drawdown(eq)
    # Trough at 80 from peak 120 → -1/3
    assert dd_value == pytest.approx(-1.0 / 3.0, abs=1e-9)
    assert dd_date == idx[2]


def test_drawdown_series_zero_at_peaks():
    eq = pd.Series([100.0, 110.0, 100.0, 120.0], index=pd.date_range("2020-01-01", periods=4))
    dd = drawdown_series(eq)
    assert dd.iloc[0] == 0.0
    assert dd.iloc[1] == 0.0  # new peak
    assert dd.iloc[2] == pytest.approx(-1.0 / 11.0, abs=1e-9)
    assert dd.iloc[3] == 0.0  # new peak


def test_annualized_vol_known_input():
    # Constant returns: σ ≈ 0 (fp residual is fine)
    rs = pd.Series([0.001] * 10)
    assert annualized_volatility(rs) == pytest.approx(0.0, abs=1e-12)
    # Alternating ±1% over 10 obs with sample std (ddof=1): daily σ = 0.01·√(n/(n-1)),
    # annualised = 0.01·√(252·n/(n-1)) = 0.01·√280 ≈ 0.1673
    rs2 = pd.Series([0.01, -0.01] * 5)
    expected = 0.01 * np.sqrt(252.0 * 10.0 / 9.0)
    assert annualized_volatility(rs2) == pytest.approx(expected, rel=1e-6)


def test_sharpe_handles_zero_variance():
    # All returns identical → std=0 → handled and returns 0
    rs = pd.Series([0.001] * 20)
    assert sharpe(rs, rf=0.0) == 0.0


def test_sortino_no_downside_returns_zero():
    rs = pd.Series([0.001] * 10)
    assert sortino(rs, rf=0.0) == 0.0


def test_calmar_zero_when_no_drawdown():
    assert calmar(0.10, 0.0) == 0.0
    assert calmar(0.10, -0.20) == pytest.approx(0.5, abs=1e-9)


def test_alpha_beta_self_regression():
    # A series regressed on itself: β=1, α=0, R²=1
    rs = pd.Series([0.01, -0.005, 0.002, 0.008, -0.01], index=pd.date_range("2020-01-01", periods=5))
    a, b, r2 = alpha_beta_r2(rs, rs, rf=0.0)
    assert b == pytest.approx(1.0, abs=1e-9)
    assert a == pytest.approx(0.0, abs=1e-6)
    assert r2 == pytest.approx(1.0, abs=1e-9)
