'use client';

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  computeKurtosis,
  computeMean,
  computeSkewness,
  computeStd,
  histogramBins,
  normalPDF,
  percentPositiveDays,
} from '@/lib/stats';
import { decimal, pct, pctSigned } from '@/lib/format';

interface Props {
  returns: number[];
}

export default function ReturnsHistogram({ returns }: Props) {
  const computed = useMemo(() => {
    const bins = histogramBins(returns, 40);
    const mean = computeMean(returns);
    const std = computeStd(returns);
    const skew = computeSkewness(returns);
    const kurt = computeKurtosis(returns);
    const posPct = percentPositiveDays(returns);
    const total = returns.length;
    const binWidth = bins.length > 0 ? bins[0]!.bucketEnd - bins[0]!.bucketStart : 0;
    const data = bins.map((b) => ({
      x: b.bucketMid,
      count: b.count,
      // Scale normal PDF to expected count per bucket
      normal: normalPDF(b.bucketMid, mean, std) * total * binWidth,
      signed: b.signed,
    }));
    return { data, mean, std, skew, kurt, posPct };
  }, [returns]);

  if (computed.data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-ink-muted">
        Not enough data for a distribution.
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={computed.data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} opacity={0.5} />
          <XAxis
            dataKey="x"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => pct(v, 1)}
            stroke="var(--text-tertiary)"
            tick={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="var(--text-tertiary)"
            tick={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(245,241,234,0.04)' }}
            contentStyle={{
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 11,
              fontFamily: 'var(--font-geist-mono)',
              padding: '6px 10px',
            }}
            labelFormatter={(v: number) => `Return ≈ ${pctSigned(v, 1)}`}
            formatter={(value: number, name: string) => {
              if (name === 'count') return [decimal(value, 0), 'days'];
              return null;
            }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {computed.data.map((d, i) => (
              <Cell
                key={i}
                fill={d.signed === 'positive' ? 'rgba(111, 166, 111, 0.65)' : 'rgba(196, 107, 107, 0.65)'}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="normal"
            stroke="var(--text-tertiary)"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceLine
            x={computed.mean}
            stroke="var(--accent)"
            strokeWidth={1}
            label={{
              value: `μ = ${pct(computed.mean, 2)}`,
              position: 'insideTopRight',
              fill: 'var(--accent)',
              fontSize: 10,
              fontFamily: 'var(--font-geist-mono)',
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-2 grid grid-cols-3 gap-3 border-t border-rule pt-2">
        <Stat label="Skew" value={decimal(computed.skew)} />
        <Stat label="Excess Kurt" value={decimal(computed.kurt)} />
        <Stat label="Pos days" value={pct(computed.posPct, 1)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="font-mono text-sm tabular-nums text-ink">{value}</div>
    </div>
  );
}
