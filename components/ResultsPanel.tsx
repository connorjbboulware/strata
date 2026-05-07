import type { BenchmarkResult, StrategyResult } from '@/lib/types';
import EquityChartPlaceholder from '@/components/EquityChartPlaceholder';
import MetricsGrid from '@/components/MetricsGrid';

interface Props {
  result: StrategyResult;
  benchmark: BenchmarkResult;
  warnings: string[];
}

export default function ResultsPanel({ result, benchmark, warnings }: Props) {
  return (
    <section className="rounded-xl border border-rule bg-panel p-5 sm:p-7 lg:p-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-3xl text-ink">{result.name}</h2>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
          vs {benchmark.symbol}
        </p>
      </header>

      <EquityChartPlaceholder
        strategyEquity={result.equity_curve}
        benchmarkEquity={benchmark.equity_curve}
        benchmarkSymbol={benchmark.symbol}
        strategyName={result.name}
      />

      <div className="mt-7">
        <MetricsGrid
          metrics={result.metrics}
          benchmarkMetrics={benchmark.metrics}
          benchmarkSymbol={benchmark.symbol}
        />
      </div>

      {warnings.length > 0 && (
        <ul className="mt-5 space-y-1 text-xs text-ink-muted">
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
