from datetime import date as _date
from typing import Literal, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class PoolStats(BaseModel):
    size: int
    available: int
    requests_waiting: int


class HealthResponse(BaseModel):
    status: Literal["ok"]
    ts: str
    db: Literal["ok", "down"]
    pool: PoolStats | None = None


# ---------------------------------------------------------------------------
# Backtest request
# ---------------------------------------------------------------------------

WeightSpec = Union[Literal["equal"], list[float]]


class StrategyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    tickers: list[str] = Field(min_length=1, max_length=10)
    weights: WeightSpec
    start_date: _date
    end_date: _date
    initial_capital: float = Field(ge=100.0, le=10_000_000.0)
    rebalance_frequency: Literal["none", "monthly", "quarterly", "yearly"]

    @field_validator("tickers")
    @classmethod
    def _normalize_tickers(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for raw in v:
            t = raw.strip().upper()
            if not (1 <= len(t) <= 10):
                raise ValueError(f"ticker {raw!r} must be 1-10 chars after stripping")
            if not all(c.isalnum() for c in t):
                raise ValueError(f"ticker {raw!r} must be alphanumeric only")
            out.append(t)
        if len(set(out)) != len(out):
            raise ValueError("tickers must be unique")
        return out

    @model_validator(mode="after")
    def _validate_dates_and_weights(self) -> "StrategyRequest":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be strictly after start_date")
        if self.end_date > _date.today():
            raise ValueError("end_date must not be in the future")
        if isinstance(self.weights, list):
            if len(self.weights) != len(self.tickers):
                raise ValueError("weights length must match tickers length")
            if any(w < 0 for w in self.weights):
                raise ValueError("weights must be non-negative")
            total = sum(self.weights)
            if abs(total - 1.0) > 1e-3:
                raise ValueError(f"weights must sum to 1.0 ± 0.001 (got {total:.6f})")
        return self


class BacktestRequest(BaseModel):
    strategies: list[StrategyRequest] = Field(min_length=1, max_length=3)
    benchmark: str = "SPY"

    @field_validator("benchmark")
    @classmethod
    def _normalize_benchmark(cls, v: str) -> str:
        t = v.strip().upper()
        if not (1 <= len(t) <= 10) or not all(c.isalnum() for c in t):
            raise ValueError(f"benchmark {v!r} must be 1-10 alphanumeric chars")
        return t


# ---------------------------------------------------------------------------
# Backtest response
# ---------------------------------------------------------------------------

class EquityPoint(BaseModel):
    date: str
    value: float


class DrawdownPoint(BaseModel):
    date: str
    drawdown: float


class MonthlyReturn(BaseModel):
    """`return` is a Python keyword, so we store as `return_` and serialize as `return`."""

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)
    month: str
    return_: float = Field(alias="return")


class Metrics(BaseModel):
    total_return: float
    cagr: float
    volatility_annualized: float
    sharpe: float
    sortino: float
    max_drawdown: float
    max_drawdown_date: str
    calmar: float
    alpha_annualized: float
    beta: float
    r_squared: float


class StrategyResult(BaseModel):
    name: str
    equity_curve: list[EquityPoint]
    drawdown_series: list[DrawdownPoint]
    monthly_returns: list[MonthlyReturn]
    metrics: Metrics
    rebalance_dates: list[str]


class BenchmarkResult(BaseModel):
    symbol: str
    equity_curve: list[EquityPoint]
    metrics: Metrics


class BacktestResponse(BaseModel):
    results: list[StrategyResult]
    benchmark: BenchmarkResult
    warnings: list[str]
    version: str = "1"
