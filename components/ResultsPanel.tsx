import type { BenchmarkResult, StrategyResult } from '@/lib/types';
import EquityChart from '@/components/charts/EquityChart';
import MetricsGrid from '@/components/MetricsGrid';
import MonthlyHeatmap from '@/components/charts/MonthlyHeatmap';
import ReturnsHistogram from '@/components/charts/ReturnsHistogram';
import RollingSharpe from '@/components/charts/RollingSharpe';
import { dailyReturnsFromEquity } from '@/lib/stats';

interface Props {
  result: StrategyResult;
  benchmark: BenchmarkResult;
  warnings: string[];
}

export default function ResultsPanel({ result, benchmark, warnings }: Props) {
  const dailyReturns = dailyReturnsFromEquity(result.equity_curve);
  const returns = dailyReturns.map((r) => r.return);
  const dates = dailyReturns.map((r) => r.date);

  return (
    <section className="rounded-xl border border-rule bg-panel p-5 sm:p-7 lg:p-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-3xl text-ink">{result.name}</h2>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
          vs {benchmark.symbol}
        </p>
      </header>

      <EquityChart result={result} benchmark={benchmark} />

      <div className="mt-7">
        <MetricsGrid
          metrics={result.metrics}
          benchmarkMetrics={benchmark.metrics}
          benchmarkSymbol={benchmark.symbol}
        />
      </div>

      <div className="mt-8 grid gap-7 lg:grid-cols-2">
        <div>
          <h3 className="form-label mb-3">Monthly Returns</h3>
          <MonthlyHeatmap monthlyReturns={result.monthly_returns} />
        </div>
        <div className="flex flex-col gap-7">
          <div>
            <h3 className="form-label mb-3">Distribution of Daily Returns</h3>
            <ReturnsHistogram returns={returns} />
          </div>
          <div>
            <h3 className="form-label mb-3">Rolling 12-Month Sharpe</h3>
            <RollingSharpe dailyReturns={returns} dates={dates} />
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="mt-6 space-y-1 text-xs text-ink-muted">
          {warnings.map((w, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-ink-faint">⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
