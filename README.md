# strata
Web-based portfolio backtester. Strategy in, equity curve out.

## Methodology

Alpha is annualized linearly (α_daily × 252) per CAPM convention. Sharpe and volatility annualized by sqrt(252). Returns based on adjusted close (dividends and splits reinvested).
