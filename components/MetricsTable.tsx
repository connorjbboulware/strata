import type { BenchmarkResult, StrategyResult } from '@/lib/types';
import { decimal, decimalSigned, pct, pctSigned } from '@/lib/format';

// Strategy line / dot colors. Hex literals — NOT `var(--accent)` — because
// Lightweight Charts paints series colors directly onto a canvas, and canvas
// paint values can't resolve CSS custom properties. Recharts works with var()
// (it converts to inline style on the SVG), but LWC silently falls back to
// black when it can't parse "var(--accent)". The first colour mirrors
// `--accent` in `app/globals.css`; if you change the palette, change both.
const STRATEGY_COLORS = ['#c9785f', '#5e8a8a', '#8a6e8a'];

interface Props {
  results: StrategyResult[];
  benchmark: BenchmarkResult;
  onRemove?: (idx: number) => void;
}

function signedClass(v: number, raw: number): string {
  if (raw > 0) return 'text-positive';
  if (raw < 0) return 'text-negative';
  return 'text-ink';
}

export default function MetricsTable({ results, benchmark, onRemove }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule">
      <table className="w-full text-xs">
        <thead className="bg-[rgb(var(--bg-rgb)/0.4)] text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">Strategy</th>
            <th className="px-2 py-2.5 text-right font-medium">Total</th>
            <th className="px-2 py-2.5 text-right font-medium">CAGR</th>
            <th className="px-2 py-2.5 text-right font-medium">Vol</th>
            <th className="px-2 py-2.5 text-right font-medium">Sharpe</th>
            <th className="px-2 py-2.5 text-right font-medium">Sortino</th>
            <th className="px-2 py-2.5 text-right font-medium">Max DD</th>
            <th className="px-2 py-2.5 text-right font-medium">Alpha</th>
            <th className="px-2 py-2.5 text-right font-medium">Beta</th>
            <th className="w-8 px-2 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {results.map((r, i) => {
            const m = r.metrics;
            return (
              <tr key={`${r.name}-${i}`} className="border-t border-rule">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: STRATEGY_COLORS[i] ?? STRATEGY_COLORS[0] }}
                    />
                    <span className="font-sans text-ink">{r.name}</span>
                  </div>
                </td>
                <td className={`px-2 py-2.5 text-right ${signedClass(m.total_return, m.total_return)}`}>
                  {pct(m.total_return)}
                </td>
                <td className={`px-2 py-2.5 text-right ${signedClass(m.cagr, m.cagr)}`}>
                  {pct(m.cagr)}
                </td>
                <td className="px-2 py-2.5 text-right text-ink">{pct(m.volatility_annualized)}</td>
                <td className="px-2 py-2.5 text-right text-ink">{decimal(m.sharpe)}</td>
                <td className="px-2 py-2.5 text-right text-ink">{decimal(m.sortino)}</td>
                <td className="px-2 py-2.5 text-right text-negative">{pct(m.max_drawdown)}</td>
                <td className={`px-2 py-2.5 text-right ${signedClass(m.alpha_annualized, m.alpha_annualized)}`}>
                  {pctSigned(m.alpha_annualized)}
                </td>
                <td className="px-2 py-2.5 text-right text-ink">{decimal(m.beta)}</td>
                <td className="px-2 py-2.5 text-right">
                  {onRemove && results.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label={`Remove ${r.name}`}
                      className="text-ink-faint transition-colors hover:text-negative"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {/* Benchmark row */}
          <tr className="border-t border-rule bg-[rgb(var(--bg-rgb)/0.3)] text-ink-muted">
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-ink-faint" />
                <span className="font-sans">{benchmark.symbol}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-faint">benchmark</span>
              </div>
            </td>
            <td className="px-2 py-2.5 text-right">{pct(benchmark.metrics.total_return)}</td>
            <td className="px-2 py-2.5 text-right">{pct(benchmark.metrics.cagr)}</td>
            <td className="px-2 py-2.5 text-right">{pct(benchmark.metrics.volatility_annualized)}</td>
            <td className="px-2 py-2.5 text-right">{decimal(benchmark.metrics.sharpe)}</td>
            <td className="px-2 py-2.5 text-right">{decimal(benchmark.metrics.sortino)}</td>
            <td className="px-2 py-2.5 text-right">{pct(benchmark.metrics.max_drawdown)}</td>
            <td className="px-2 py-2.5 text-right text-ink-faint">—</td>
            <td className="px-2 py-2.5 text-right">{decimal(benchmark.metrics.beta)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export { STRATEGY_COLORS };
