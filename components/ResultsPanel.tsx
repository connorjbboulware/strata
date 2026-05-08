'use client';

import type { BacktestRequest, BenchmarkResult, StrategyResult } from '@/lib/types';
import EquityChart from '@/components/charts/EquityChart';
import MetricsGrid from '@/components/MetricsGrid';
import MetricsTable from '@/components/MetricsTable';
import MonthlyHeatmap from '@/components/charts/MonthlyHeatmap';
import ReturnsHistogram from '@/components/charts/ReturnsHistogram';
import RollingSharpe from '@/components/charts/RollingSharpe';
import { dailyReturnsFromEquity } from '@/lib/stats';

interface Props {
  results: StrategyResult[];
  benchmark: BenchmarkResult;
  warnings: string[];
  appendNext: boolean;
  inlineError: string | null;
  onAddForComparison: () => void;
  onRemoveStrategy: (idx: number) => void;
  onCancelComparison: () => void;
  onCopyShareLink: () => void;
  onDismissInlineError: () => void;
}

export default function ResultsPanel({
  results,
  benchmark,
  warnings,
  appendNext,
  inlineError,
  onAddForComparison,
  onRemoveStrategy,
  onCancelComparison,
  onCopyShareLink,
  onDismissInlineError,
}: Props) {
  const first = results[0]!;
  const dailyReturns = dailyReturnsFromEquity(first.equity_curve);
  const returns = dailyReturns.map((r) => r.return);
  const dates = dailyReturns.map((r) => r.date);

  const headerName =
    results.length === 1 ? first.name : `${first.name} + ${results.length - 1} more`;

  return (
    <section className="rounded-xl border border-rule bg-panel p-5 sm:p-7 lg:p-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-2xl text-ink sm:text-3xl">{headerName}</h2>
          <button
            type="button"
            onClick={onCopyShareLink}
            title="Copy share link"
            className="rounded-md border border-rule bg-panel px-2.5 py-1 text-[11px] font-mono text-ink-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            <span className="inline-flex items-center gap-1.5">
              <LinkIcon />
              Copy share link
            </span>
          </button>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
          vs {benchmark.symbol}
        </p>
      </header>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-md border border-accent/40 bg-[rgb(var(--accent-rgb)/0.05)] px-4 py-2.5 text-xs">
          <div className="flex items-start gap-2">
            <span className="text-accent">⚠</span>
            <ul className="flex-1 space-y-0.5 text-ink-muted">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {inlineError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-negative/40 bg-[rgb(var(--negative-rgb)/0.06)] px-4 py-2.5 text-xs">
          <span className="text-ink">{inlineError}</span>
          <button
            type="button"
            onClick={onDismissInlineError}
            aria-label="Dismiss"
            className="text-ink-faint transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {appendNext && results.length < 3 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-accent/40 bg-[rgb(var(--accent-rgb)/0.05)] px-4 py-2.5 text-xs">
          <span>
            <span className="font-medium text-accent">Comparison mode</span>
            <span className="text-ink-muted">
              {' '}
              — edit the form on the left and click Run to overlay another strategy.
            </span>
          </span>
          <button
            type="button"
            onClick={onCancelComparison}
            className="text-ink-faint transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      <EquityChart strategies={results} benchmark={benchmark} />

      <div className="mt-7">
        {results.length === 1 ? (
          <MetricsGrid
            metrics={first.metrics}
            benchmarkMetrics={benchmark.metrics}
            benchmarkSymbol={benchmark.symbol}
          />
        ) : (
          <MetricsTable
            results={results}
            benchmark={benchmark}
            onRemove={onRemoveStrategy}
          />
        )}

        {results.length < 3 && !appendNext && (
          <button
            type="button"
            onClick={onAddForComparison}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-rule bg-panel px-3 py-2 text-xs text-accent transition-colors hover:border-accent"
          >
            <span className="text-base leading-none">+</span>
            <span>Add for comparison</span>
          </button>
        )}
      </div>

      {/* Monthly heatmap — full panel width, centered */}
      <div className="mt-9">
        <h3 className="form-label mb-3">Monthly Returns</h3>
        <p className="mb-3 text-[11px] text-ink-faint">
          {results.length > 1 ? 'Detail charts show first strategy only.' : ''}
        </p>
        <div className="mx-auto max-w-[960px]">
          <MonthlyHeatmap monthlyReturns={first.monthly_returns} />
        </div>
      </div>

      {/* Histogram + rolling sharpe, 50/50 below */}
      <div className="mt-9 grid gap-7 lg:grid-cols-2">
        <div>
          <h3 className="form-label mb-3">Distribution of Daily Returns</h3>
          <ReturnsHistogram returns={returns} />
        </div>
        <div>
          <h3 className="form-label mb-3">Rolling 12-Month Sharpe</h3>
          <RollingSharpe dailyReturns={returns} dates={dates} />
        </div>
      </div>
    </section>
  );
}

function LinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
