import type { Metrics } from '@/lib/types';
import { decimal, decimalSigned, pct, pctSigned } from '@/lib/format';

interface Props {
  metrics: Metrics;
  benchmarkMetrics: Metrics;
  benchmarkSymbol: string;
}

type Tone = 'positive' | 'negative' | 'neutral' | 'always-negative';

interface Cell {
  label: string;
  value: string;
  delta: string | null;
  /** Coloring for the value itself */
  valueTone: Tone;
  /** Coloring for the delta line */
  deltaTone: 'auto' | 'neutral';
}

function valueClass(tone: Tone, raw: number): string {
  if (tone === 'always-negative') return 'text-negative';
  if (tone === 'neutral') return 'text-ink';
  if (raw > 0) return 'text-positive';
  if (raw < 0) return 'text-negative';
  return 'text-ink';
}

function deltaClass(d: number, mode: 'auto' | 'neutral'): string {
  if (mode === 'neutral') return 'text-ink-faint';
  if (d > 0) return 'text-positive';
  if (d < 0) return 'text-negative';
  return 'text-ink-faint';
}

export default function MetricsGrid({ metrics, benchmarkMetrics, benchmarkSymbol }: Props) {
  const cells: Cell[] = [
    {
      label: 'Total Return',
      value: pct(metrics.total_return),
      delta: pctSigned(metrics.total_return - benchmarkMetrics.total_return),
      valueTone: 'positive', // signed coloring
      deltaTone: 'auto',
    },
    {
      label: 'CAGR',
      value: pct(metrics.cagr),
      delta: pctSigned(metrics.cagr - benchmarkMetrics.cagr),
      valueTone: 'positive',
      deltaTone: 'auto',
    },
    {
      label: 'Volatility',
      value: pct(metrics.volatility_annualized),
      delta: pctSigned(metrics.volatility_annualized - benchmarkMetrics.volatility_annualized),
      valueTone: 'neutral',
      deltaTone: 'neutral',
    },
    {
      label: 'Sharpe',
      value: decimal(metrics.sharpe),
      delta: decimalSigned(metrics.sharpe - benchmarkMetrics.sharpe),
      valueTone: 'neutral',
      deltaTone: 'auto',
    },
    {
      label: 'Sortino',
      value: decimal(metrics.sortino),
      delta: decimalSigned(metrics.sortino - benchmarkMetrics.sortino),
      valueTone: 'neutral',
      deltaTone: 'auto',
    },
    {
      label: 'Max Drawdown',
      value: pct(metrics.max_drawdown),
      delta: pctSigned(metrics.max_drawdown - benchmarkMetrics.max_drawdown),
      valueTone: 'always-negative',
      deltaTone: 'auto',
    },
    {
      label: 'Alpha',
      value: pctSigned(metrics.alpha_annualized),
      delta: null,
      valueTone: 'positive',
      deltaTone: 'auto',
    },
    {
      label: 'Beta',
      value: decimal(metrics.beta),
      delta: decimalSigned(metrics.beta - 1.0),
      valueTone: 'neutral',
      deltaTone: 'neutral',
    },
  ];

  // Map cell labels back to raw numbers for value coloring (matches order above)
  const rawValues: number[] = [
    metrics.total_return,
    metrics.cagr,
    metrics.volatility_annualized,
    metrics.sharpe,
    metrics.sortino,
    metrics.max_drawdown,
    metrics.alpha_annualized,
    metrics.beta,
  ];
  const deltaRaws: (number | null)[] = [
    metrics.total_return - benchmarkMetrics.total_return,
    metrics.cagr - benchmarkMetrics.cagr,
    metrics.volatility_annualized - benchmarkMetrics.volatility_annualized,
    metrics.sharpe - benchmarkMetrics.sharpe,
    metrics.sortino - benchmarkMetrics.sortino,
    metrics.max_drawdown - benchmarkMetrics.max_drawdown,
    null,
    metrics.beta - 1.0,
  ];

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-rule bg-rule">
      {cells.map((cell, i) => (
        <div key={cell.label} className="flex flex-col gap-1 bg-panel px-4 py-4">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            {cell.label}
          </dt>
          <dd
            className={`font-mono text-xl tabular-nums leading-tight ${valueClass(
              cell.valueTone,
              rawValues[i]!,
            )}`}
          >
            {cell.value}
          </dd>
          {cell.delta != null && deltaRaws[i] != null && (
            <span
              className={`text-[11px] font-mono tabular-nums ${deltaClass(
                deltaRaws[i]!,
                cell.deltaTone,
              )}`}
            >
              {cell.delta} vs {benchmarkSymbol}
            </span>
          )}
          {cell.delta == null && (
            <span className="text-[11px] font-mono text-ink-faint">
              vs {benchmarkSymbol}
            </span>
          )}
        </div>
      ))}
    </dl>
  );
}
