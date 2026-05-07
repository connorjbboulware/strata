import { z } from 'zod';

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const PoolStatsSchema = z.object({
  size: z.number(),
  available: z.number(),
  requests_waiting: z.number(),
});
export type PoolStats = z.infer<typeof PoolStatsSchema>;

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  ts: z.string(),
  db: z.enum(['ok', 'down']),
  pool: PoolStatsSchema.nullable().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// ---------------------------------------------------------------------------
// Backtest request
// ---------------------------------------------------------------------------

export const RebalanceFrequencySchema = z.enum(['none', 'monthly', 'quarterly', 'yearly']);
export type RebalanceFrequency = z.infer<typeof RebalanceFrequencySchema>;

export const WeightsSchema = z.union([z.literal('equal'), z.array(z.number())]);
export type Weights = z.infer<typeof WeightsSchema>;

export const StrategyRequestSchema = z.object({
  name: z.string().min(1).max(80),
  tickers: z.array(z.string()).min(1).max(10),
  weights: WeightsSchema,
  start_date: z.string(),
  end_date: z.string(),
  initial_capital: z.number().min(100).max(10_000_000),
  rebalance_frequency: RebalanceFrequencySchema,
});
export type StrategyRequest = z.infer<typeof StrategyRequestSchema>;

export const BacktestRequestSchema = z.object({
  strategies: z.array(StrategyRequestSchema).min(1).max(3),
  benchmark: z.string(),
});
export type BacktestRequest = z.infer<typeof BacktestRequestSchema>;

// ---------------------------------------------------------------------------
// Backtest response
// ---------------------------------------------------------------------------

export const EquityPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});
export type EquityPoint = z.infer<typeof EquityPointSchema>;

export const DrawdownPointSchema = z.object({
  date: z.string(),
  drawdown: z.number(),
});
export type DrawdownPoint = z.infer<typeof DrawdownPointSchema>;

export const MonthlyReturnSchema = z.object({
  month: z.string(),
  return: z.number(),
});
export type MonthlyReturn = z.infer<typeof MonthlyReturnSchema>;

export const MetricsSchema = z.object({
  total_return: z.number(),
  cagr: z.number(),
  volatility_annualized: z.number(),
  sharpe: z.number(),
  sortino: z.number(),
  max_drawdown: z.number(),
  max_drawdown_date: z.string(),
  calmar: z.number(),
  alpha_annualized: z.number(),
  beta: z.number(),
  r_squared: z.number(),
});
export type Metrics = z.infer<typeof MetricsSchema>;

export const StrategyResultSchema = z.object({
  name: z.string(),
  equity_curve: z.array(EquityPointSchema),
  drawdown_series: z.array(DrawdownPointSchema),
  monthly_returns: z.array(MonthlyReturnSchema),
  metrics: MetricsSchema,
  rebalance_dates: z.array(z.string()),
});
export type StrategyResult = z.infer<typeof StrategyResultSchema>;

export const BenchmarkResultSchema = z.object({
  symbol: z.string(),
  equity_curve: z.array(EquityPointSchema),
  metrics: MetricsSchema,
});
export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

export const BacktestResponseSchema = z.object({
  results: z.array(StrategyResultSchema),
  benchmark: BenchmarkResultSchema,
  warnings: z.array(z.string()),
  version: z.string(),
});
export type BacktestResponse = z.infer<typeof BacktestResponseSchema>;
