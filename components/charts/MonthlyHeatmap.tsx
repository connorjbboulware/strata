'use client';

import { useMemo, useState } from 'react';
import type { MonthlyReturn } from '@/lib/types';
import { pct, pctSigned } from '@/lib/format';

interface Props {
  monthlyReturns: MonthlyReturn[];
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAP = 0.10; // ±10% saturates the color

function cellColor(value: number | null): string {
  if (value == null) return 'rgb(var(--bg-elevated-rgb))';
  if (value === 0) return 'rgb(var(--bg-elevated-rgb))';
  const intensity = Math.min(Math.abs(value) / CAP, 1);
  // Fixed hue, vary lightness + alpha for punch
  const hue = value > 0 ? 142 : 6; // green / red
  const lightness = 14 + 28 * intensity; // 14% → 42%
  const alpha = 0.35 + 0.55 * intensity;
  return `hsla(${hue}, 38%, ${lightness}%, ${alpha})`;
}

interface YearRow {
  year: number;
  monthly: (number | null)[];
  annual: number | null;
}

export default function MonthlyHeatmap({ monthlyReturns }: Props) {
  const rows = useMemo<YearRow[]>(() => {
    const byYear = new Map<number, (number | null)[]>();
    for (const mr of monthlyReturns) {
      const m = /^(\d{4})-(\d{2})$/.exec(mr.month);
      if (!m) continue;
      const y = parseInt(m[1]!, 10);
      const mo = parseInt(m[2]!, 10) - 1;
      if (!byYear.has(y)) byYear.set(y, new Array(12).fill(null));
      byYear.get(y)![mo] = mr.return;
    }
    return Array.from(byYear.keys())
      .sort((a, b) => a - b)
      .map((year) => {
        const monthly = byYear.get(year)!;
        // Compound monthly returns into the annual figure
        let prod = 1;
        let any = false;
        for (const r of monthly) {
          if (r != null) {
            prod *= 1 + r;
            any = true;
          }
        }
        return { year, monthly, annual: any ? prod - 1 : null };
      });
  }, [monthlyReturns]);

  const [hover, setHover] = useState<{ year: number; month: number; value: number; isAnnual: boolean } | null>(null);

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex items-center gap-3 text-[10px] text-ink-faint">
        <span>−10%</span>
        <div className="flex h-2 flex-1 max-w-[180px] overflow-hidden rounded">
          {Array.from({ length: 21 }).map((_, i) => {
            const v = -CAP + (i / 20) * (2 * CAP);
            return <div key={i} className="flex-1" style={{ background: cellColor(v) }} />;
          })}
        </div>
        <span>+10%</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: '2px' }}>
          <thead>
            <tr>
              <th className="w-12" />
              {MONTH_LABELS.map((m) => (
                <th
                  key={m}
                  className="font-mono text-[10px] font-normal uppercase tracking-wide text-ink-faint"
                >
                  {m}
                </th>
              ))}
              <th
                className="border-l border-rule pl-2 font-mono text-[10px] font-normal uppercase tracking-wide text-ink-muted"
                style={{ minWidth: 56 }}
              >
                Year
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year}>
                <td className="pr-2 text-right font-mono text-[11px] text-ink-muted">
                  {row.year}
                </td>
                {row.monthly.map((v, mi) => (
                  <td
                    key={mi}
                    className="rounded text-center font-mono text-[10px] tabular-nums leading-none transition-colors"
                    style={{
                      background: cellColor(v),
                      color: v == null ? 'transparent' : v >= 0 ? 'var(--text-primary)' : 'var(--text-primary)',
                      height: 30,
                      minWidth: 44,
                    }}
                    onMouseEnter={() => v != null && setHover({ year: row.year, month: mi, value: v, isAnnual: false })}
                    onMouseLeave={() => setHover(null)}
                  >
                    {v == null ? '' : pctSigned(v, 1)}
                  </td>
                ))}
                <td
                  className="rounded border-l border-rule text-center font-mono text-[10px] font-medium tabular-nums leading-none"
                  style={{
                    background: cellColor(row.annual),
                    color: row.annual == null ? 'transparent' : 'var(--text-primary)',
                    height: 30,
                    minWidth: 56,
                  }}
                  onMouseEnter={() => row.annual != null && setHover({ year: row.year, month: -1, value: row.annual, isAnnual: true })}
                  onMouseLeave={() => setHover(null)}
                >
                  {row.annual == null ? '' : pctSigned(row.annual, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip below the table */}
      <div className="mt-3 h-6 font-mono text-[11px] text-ink-muted">
        {hover ? (
          <span>
            <span className="text-ink-faint">
              {hover.isAnnual
                ? `${hover.year} (full year)`
                : `${MONTH_LABELS[hover.month]} ${hover.year}`}
              :
            </span>{' '}
            <span className={hover.value >= 0 ? 'text-positive' : 'text-negative'}>
              {pctSigned(hover.value, 2)}
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">Hover a cell for the exact return.</span>
        )}
      </div>
    </div>
  );
}
