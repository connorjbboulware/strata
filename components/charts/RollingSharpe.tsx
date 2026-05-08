'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { rollingSharpe } from '@/lib/stats';
import { decimal, monthYearShort, shortDate } from '@/lib/format';

interface Props {
  dailyReturns: number[];
  dates: string[];
}

export default function RollingSharpe({ dailyReturns, dates }: Props) {
  const data = useMemo(
    () =>
      rollingSharpe(dailyReturns, dates, 252).map((p) => ({
        date: p.date,
        sharpe: p.value,
      })),
    [dailyReturns, dates],
  );

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-ink-muted">
        Not enough data for a 12-month rolling Sharpe (need ≥ 252 trading days).
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} opacity={0.5} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => monthYearShort(v)}
          stroke="var(--text-tertiary)"
          tick={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
          tickLine={false}
          axisLine={false}
          minTickGap={50}
        />
        <YAxis
          stroke="var(--text-tertiary)"
          tick={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toFixed(1)}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-primary)',
            fontSize: 11,
            fontFamily: 'var(--font-geist-mono)',
            padding: '6px 10px',
          }}
          labelFormatter={(v: string) => shortDate(v)}
          formatter={(value: number) => [decimal(value, 2), 'Sharpe']}
        />
        <ReferenceLine y={0} stroke="var(--text-tertiary)" strokeDasharray="3 3" />
        <ReferenceLine
          y={1}
          stroke="var(--text-secondary)"
          strokeDasharray="3 3"
          label={{
            value: '1.0',
            position: 'insideTopRight',
            fill: 'var(--text-secondary)',
            fontSize: 10,
            fontFamily: 'var(--font-geist-mono)',
          }}
        />
        <Line
          type="monotone"
          dataKey="sharpe"
          stroke="var(--accent)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
