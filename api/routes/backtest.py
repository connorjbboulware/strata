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
        # Drop tickers with no data and surface them as warnings, instead of
        # blowing up the whole request — partial coverage is more useful than
        # a hard 400. If *every* ticker is invalid, then we 400.
        valid = [t for t in strategy.tickers if t in prices]
        missing = [t for t in strategy.tickers if t not in prices]
        if missing:
            warnings.append(
                f"{strategy.name}: dropped {missing} (no data in requested range)"
            )
        if not valid:
            raise HTTPException(
                status_code=400,
                detail=f"strategy '{strategy.name}' has no usable tickers",
            )

        if len(valid) < len(strategy.tickers):
            # Re-derive weights for the kept tickers so they still sum to 1.0
            if isinstance(strategy.weights, list):
                kept = [
                    w for t, w in zip(strategy.tickers, strategy.weights) if t in prices
                ]
                total = sum(kept)
                new_weights = (
                    [w / total for w in kept] if total > 0 else "equal"
                )
            else:
                new_weights = "equal"
            adjusted = strategy.model_copy(
                update={"tickers": valid, "weights": new_weights}
            )
        else:
            adjusted = strategy

        strategy_prices = {sym: prices[sym] for sym in adjusted.tickers}
        try:
            result = run_strategy(adjusted, strategy_prices, benchmark_prices, rf, trading_days)
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
