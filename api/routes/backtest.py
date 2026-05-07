from fastapi import APIRouter, HTTPException

from ..config import load_settings
from ..data.fetcher import get_prices
from ..data.yfinance_client import DataUnavailable
from ..engine.backtest import run_benchmark, run_strategy
from ..schemas import BacktestRequest, BacktestResponse

router = APIRouter()


@router.post("/api/backtest", response_model=BacktestResponse)
def post_backtest(req: BacktestRequest) -> BacktestResponse:
    settings = load_settings()
    rf = settings.risk_free_rate
    trading_days = settings.trading_days_per_year

    # Global date range across all strategies
    start = min(s.start_date for s in req.strategies)
    end = max(s.end_date for s in req.strategies)

    tickers: set[str] = {req.benchmark}
    for s in req.strategies:
        tickers.update(s.tickers)

    try:
        prices, warnings = get_prices(tickers, start, end)
    except DataUnavailable as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="failed to fetch price data")

    if req.benchmark not in prices:
        raise HTTPException(
            status_code=400, detail=f"benchmark data unavailable: {req.benchmark}"
        )
    benchmark_prices = prices[req.benchmark]

    results = []
    for strategy in req.strategies:
        missing = [t for t in strategy.tickers if t not in prices]
        if missing:
            raise HTTPException(
                status_code=400, detail=f"missing data for tickers: {missing}"
            )
        strategy_prices = {sym: prices[sym] for sym in strategy.tickers}
        try:
            result = run_strategy(strategy, strategy_prices, benchmark_prices, rf, trading_days)
            results.append(result)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    initial_capital = req.strategies[0].initial_capital
    try:
        bench = run_benchmark(
            req.benchmark, benchmark_prices, start, end, initial_capital, rf, trading_days
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return BacktestResponse(
        results=results, benchmark=bench, warnings=warnings, version="1"
    )
