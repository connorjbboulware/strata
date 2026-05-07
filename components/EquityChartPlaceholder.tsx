'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EquityPoint } from '@/lib/types';
import { money, monthYearShort, shortDate } from '@/lib/format';

interface Props {
  strategyEquity: EquityPoint[];
  benchmarkEquity: EquityPoint[];
  benchmarkSymbol: string;
  strategyName: string;
}

const PADDING = { top: 16, right: 16, bottom: 36, left: 64 };
const DESKTOP_HEIGHT = 360;
const MOBILE_HEIGHT = 240;

interface ProcessedPoint {
  date: number;
  value: number;
  iso: string;
}

function toProcessed(points: EquityPoint[]): ProcessedPoint[] {
  return points.map((p) => ({
    date: Date.parse(`${p.date}T00:00:00Z`),
    value: p.value,
    iso: p.date,
  }));
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const range = max - min;
  const rawStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let step: number;
  if (normalized < 1.5) step = magnitude;
  else if (normalized < 3) step = 2 * magnitude;
  else if (normalized < 7) step = 5 * magnitude;
  else step = 10 * magnitude;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function dateTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(min + ((max - min) * i) / (count - 1));
  }
  return out;
}

export default function EquityChartPlaceholder({
  strategyEquity,
  benchmarkEquity,
  benchmarkSymbol,
  strategyName,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [height, setHeight] = useState(DESKTOP_HEIGHT);
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        setWidth(w);
        setHeight(w < 640 ? MOBILE_HEIGHT : DESKTOP_HEIGHT);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const strategy = useMemo(() => toProcessed(strategyEquity), [strategyEquity]);
  const benchmark = useMemo(() => toProcessed(benchmarkEquity), [benchmarkEquity]);

  const innerW = Math.max(0, width - PADDING.left - PADDING.right);
  const innerH = Math.max(0, height - PADDING.top - PADDING.bottom);

  const xMin = Math.min(
    strategy[0]?.date ?? Infinity,
    benchmark[0]?.date ?? Infinity,
  );
  const xMax = Math.max(
    strategy[strategy.length - 1]?.date ?? -Infinity,
    benchmark[benchmark.length - 1]?.date ?? -Infinity,
  );
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of strategy) {
    if (p.value < yMin) yMin = p.value;
    if (p.value > yMax) yMax = p.value;
  }
  for (const p of benchmark) {
    if (p.value < yMin) yMin = p.value;
    if (p.value > yMax) yMax = p.value;
  }
  const yPad = (yMax - yMin) * 0.05;
  yMin -= yPad;
  yMax += yPad;

  const xScale = (d: number) =>
    PADDING.left + ((d - xMin) / Math.max(xMax - xMin, 1)) * innerW;
  const yScale = (v: number) =>
    PADDING.top + (1 - (v - yMin) / Math.max(yMax - yMin, 1)) * innerH;

  function lineToPath(points: ProcessedPoint[]): string {
    if (points.length === 0) return '';
    let out = '';
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      out += (i === 0 ? 'M' : 'L') + xScale(p.date).toFixed(1) + ',' + yScale(p.value).toFixed(1);
      if (i < points.length - 1) out += ' ';
    }
    return out;
  }

  function areaPath(points: ProcessedPoint[]): string {
    if (points.length === 0) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const baseline = PADDING.top + innerH;
    let out = `M${xScale(first.date).toFixed(1)},${baseline.toFixed(1)} `;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      out += `L${xScale(p.date).toFixed(1)},${yScale(p.value).toFixed(1)} `;
    }
    out += `L${xScale(last.date).toFixed(1)},${baseline.toFixed(1)} Z`;
    return out;
  }

  const yTicks = useMemo(() => niceTicks(yMin, yMax, 5), [yMin, yMax]);
  const xTicks = useMemo(() => dateTicks(xMin, xMax, 5), [xMin, xMax]);

  // Use the strategy series as the primary date index for hover
  function findNearest(svgX: number): number {
    if (strategy.length === 0) return -1;
    const target =
      xMin + ((svgX - PADDING.left) / Math.max(innerW, 1)) * (xMax - xMin);
    let lo = 0;
    let hi = strategy.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strategy[mid]!.date < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(strategy[lo - 1]!.date - target) < Math.abs(strategy[lo]!.date - target)) {
      return lo - 1;
    }
    return lo;
  }

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = (e.currentTarget.ownerSVGElement || e.currentTarget).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = findNearest(x);
    if (idx < 0) return;
    setHover({ x: xScale(strategy[idx]!.date), idx });
  }

  const tooltipPoint = hover ? strategy[hover.idx] : null;
  const tooltipBench = hover
    ? benchmark.find((b) => b.iso === tooltipPoint?.iso) ?? null
    : null;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Equity curve for ${strategyName} versus ${benchmarkSymbol}`}
      >
        {/* y grid */}
        {yTicks.map((t) => (
          <line
            key={`y-${t}`}
            x1={PADDING.left}
            x2={width - PADDING.right}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.6}
          />
        ))}
        {/* y labels */}
        {yTicks.map((t) => (
          <text
            key={`yt-${t}`}
            x={PADDING.left - 10}
            y={yScale(t)}
            textAnchor="end"
            dominantBaseline="middle"
            fill="var(--text-tertiary)"
            fontSize={11}
            fontFamily="var(--font-geist-mono), ui-monospace, monospace"
          >
            {money(t)}
          </text>
        ))}
        {/* x labels */}
        {xTicks.map((t) => (
          <text
            key={`xt-${t}`}
            x={xScale(t)}
            y={height - PADDING.bottom + 18}
            textAnchor="middle"
            fill="var(--text-tertiary)"
            fontSize={11}
            fontFamily="var(--font-geist-mono), ui-monospace, monospace"
          >
            {monthYearShort(t)}
          </text>
        ))}

        {/* area under strategy */}
        <path d={areaPath(strategy)} fill="var(--accent)" fillOpacity={0.06} />

        {/* benchmark line */}
        <path
          d={lineToPath(benchmark)}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth={1.25}
          strokeOpacity={0.85}
        />

        {/* strategy line */}
        <path
          d={lineToPath(strategy)}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
        />

        {/* hover crosshair */}
        {hover && tooltipPoint && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={PADDING.top}
              y2={height - PADDING.bottom}
              stroke="var(--text-secondary)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <circle
              cx={hover.x}
              cy={yScale(tooltipPoint.value)}
              r={3.5}
              fill="var(--accent)"
            />
            {tooltipBench && (
              <circle
                cx={hover.x}
                cy={yScale(tooltipBench.value)}
                r={3}
                fill="var(--text-tertiary)"
              />
            )}
          </>
        )}

        {/* mouse capture */}
        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {/* tooltip overlay */}
      {hover && tooltipPoint && (
        <div
          className="pointer-events-none absolute rounded-md border border-rule bg-surface px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(hover.x + 12, width - 200),
            top: PADDING.top,
          }}
        >
          <div className="text-ink-faint font-mono text-[10px]">
            {shortDate(tooltipPoint.iso)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="text-ink-muted">{strategyName}</span>
            <span className="ml-auto font-mono tabular-nums text-ink">
              {money(tooltipPoint.value)}
            </span>
          </div>
          {tooltipBench && (
            <div className="mt-1 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-ink-faint" />
              <span className="text-ink-muted">{benchmarkSymbol}</span>
              <span className="ml-auto font-mono tabular-nums text-ink">
                {money(tooltipBench.value)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
