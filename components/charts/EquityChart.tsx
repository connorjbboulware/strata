'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  PriceScaleMode,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';

import type { BenchmarkResult, StrategyResult } from '@/lib/types';
import { money, pct, pctSigned, shortDate } from '@/lib/format';
import { STRATEGY_COLORS } from '@/components/MetricsTable';

interface Props {
  strategies: StrategyResult[];
  benchmark: BenchmarkResult;
}

type RangeKey = '1Y' | '3Y' | '5Y' | 'ALL';
const RANGES: RangeKey[] = ['1Y', '3Y', '5Y', 'ALL'];

interface TooltipState {
  date: string;
  strategyValues: (number | null)[];
  benchmarkValue: number | null;
  drawdownValue: number | null; // first strategy only
  x: number;
  y: number;
}

function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#000';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export default function EquityChart({ strategies, benchmark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const stratSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const benchSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ddSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [range, setRange] = useState<RangeKey>('ALL');
  const [logScale, setLogScale] = useState(false);
  const [chartHeight, setChartHeight] = useState(480);

  useEffect(() => {
    function measure() {
      setChartHeight(window.innerWidth < 640 ? 320 : 480);
    }
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || strategies.length === 0) return;
    const first = strategies[0]!;

    const tertiary = cssVar('--text-tertiary');
    const secondary = cssVar('--text-secondary');
    const border = cssVar('--border');
    const negative = cssVar('--negative');
    const negativeRgb = '196, 107, 107';
    const accentRgb = '201, 120, 95';

    const chart = createChart(container, {
      height: chartHeight,
      width: container.clientWidth,
      autoSize: false,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
        textColor: tertiary,
        fontFamily: 'var(--font-geist-mono)',
        attributionLogo: false,
        panes: {
          separatorColor: border,
          separatorHoverColor: secondary,
          enableResize: false,
        },
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: border, style: 0 },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: secondary,
          width: 1,
          style: 0,
          labelBackgroundColor: '#14110f',
        },
        horzLine: { visible: false, labelVisible: false },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // Strategy lines (1-3)
    const stratLines: ISeriesApi<'Line'>[] = strategies.map((s, i) =>
      chart.addSeries(
        LineSeries,
        {
          color: STRATEGY_COLORS[i] ?? STRATEGY_COLORS[0]!,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: 'custom', formatter: (v: number) => money(v), minMove: 1 },
        },
        0,
      ),
    );
    stratSeriesRef.current = stratLines;

    const benchmarkLine = chart.addSeries(
      LineSeries,
      {
        color: tertiary,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'custom', formatter: (v: number) => money(v), minMove: 1 },
      },
      0,
    );
    benchSeriesRef.current = benchmarkLine;

    // Drawdown pane: first strategy only
    const drawdownArea = chart.addSeries(
      AreaSeries,
      {
        topColor: `rgba(${negativeRgb}, 0.4)`,
        bottomColor: `rgba(${negativeRgb}, 0.0)`,
        lineColor: negative,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (v: number) => `${(v * 100).toFixed(1)}%`,
          minMove: 0.0001,
        },
      },
      1,
    );
    ddSeriesRef.current = drawdownArea;

    strategies.forEach((s, i) => {
      stratLines[i]!.setData(
        s.equity_curve.map((p) => ({ time: p.date as Time, value: p.value })),
      );
    });
    benchmarkLine.setData(
      benchmark.equity_curve.map((p) => ({ time: p.date as Time, value: p.value })),
    );
    drawdownArea.setData(
      first.drawdown_series.map((p) => ({ time: p.date as Time, value: p.drawdown })),
    );

    const panes = chart.panes();
    if (panes.length >= 2) {
      panes[0]!.setStretchFactor(7);
      panes[1]!.setStretchFactor(3);
    }

    if (panes.length >= 1) {
      try {
        // Watermark uses the first strategy's name (the "anchor" strategy)
        createTextWatermark(panes[0]!, {
          horzAlign: 'right',
          vertAlign: 'bottom',
          lines: [
            {
              text: first.name,
              color: `rgba(${accentRgb}, 0.18)`,
              fontSize: 28,
              fontFamily: 'var(--font-instrument-serif)',
              fontStyle: 'italic',
            },
          ],
        });
      } catch {
        /* plugin not available */
      }
    }

    try {
      const mddDate = first.metrics.max_drawdown_date;
      const mddVal = first.metrics.max_drawdown;
      if (mddDate) {
        const monthYear = new Date(mddDate + 'T00:00:00Z').toLocaleString('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
        createSeriesMarkers(drawdownArea, [
          {
            time: mddDate as Time,
            position: 'belowBar',
            color: cssVar('--accent'),
            shape: 'arrowUp',
            text: `MAX ${pct(mddVal, 1)} • ${monthYear}`,
            size: 1,
          },
        ]);
      }
    } catch {
      /* plugin not available */
    }

    function handleCrosshair(param: MouseEventParams) {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }
      const stratValues = stratLines.map((s) => {
        const v = param.seriesData.get(s) as { value: number } | undefined;
        return v?.value ?? null;
      });
      const bn = param.seriesData.get(benchmarkLine) as { value: number } | undefined;
      const dd = param.seriesData.get(drawdownArea) as { value: number } | undefined;
      setTooltip({
        date: String(param.time),
        strategyValues: stratValues,
        benchmarkValue: bn?.value ?? null,
        drawdownValue: dd?.value ?? null,
        x: param.point.x,
        y: param.point.y,
      });
    }
    chart.subscribeCrosshairMove(handleCrosshair);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        chart.applyOptions({ width: e.contentRect.width });
      }
    });
    ro.observe(container);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      stratSeriesRef.current = [];
      benchSeriesRef.current = null;
      ddSeriesRef.current = null;
    };
  }, [strategies, benchmark, chartHeight]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      rightPriceScale: {
        mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      },
    });
  }, [logScale]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || strategies.length === 0) return;
    const first = strategies[0]!;
    if (first.equity_curve.length === 0) return;
    const firstDate = first.equity_curve[0]!.date;
    const lastDate = first.equity_curve[first.equity_curve.length - 1]!.date;
    let fromDate = firstDate;
    if (range !== 'ALL') {
      const years = parseInt(range, 10);
      const last = new Date(lastDate + 'T00:00:00Z');
      last.setUTCFullYear(last.getUTCFullYear() - years);
      const candidate = last.toISOString().slice(0, 10);
      fromDate = candidate < firstDate ? firstDate : candidate;
    }
    try {
      chart.timeScale().setVisibleRange({ from: fromDate as Time, to: lastDate as Time });
    } catch {
      chart.timeScale().fitContent();
    }
  }, [range, strategies]);

  if (strategies.length === 0) return null;

  const initialStrategyValues = strategies.map((s) => s.equity_curve[0]?.value ?? 0);
  const initialBenchmark = benchmark.equity_curve[0]?.value ?? 0;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                range === r
                  ? 'border-accent text-ink'
                  : 'border-rule text-ink-muted hover:text-ink hover:border-accent/40'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLogScale((s) => !s)}
          title="Toggle linear / logarithmic Y axis"
          className={`rounded-md border px-2.5 py-1 text-[11px] font-mono transition-colors ${
            logScale
              ? 'border-accent text-ink'
              : 'border-rule text-ink-muted hover:text-accent'
          }`}
        >
          {logScale ? 'LOG' : 'LIN'}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: chartHeight }}
      />

      {tooltip && (
        <Tooltip
          tooltip={tooltip}
          strategies={strategies}
          initialStrategyValues={initialStrategyValues}
          initialBenchmark={initialBenchmark}
          benchmarkSymbol={benchmark.symbol}
          chartWidth={containerRef.current?.clientWidth ?? 0}
          chartHeight={chartHeight}
        />
      )}
    </div>
  );
}

function Tooltip({
  tooltip,
  strategies,
  initialStrategyValues,
  initialBenchmark,
  benchmarkSymbol,
  chartWidth,
  chartHeight,
}: {
  tooltip: TooltipState;
  strategies: StrategyResult[];
  initialStrategyValues: number[];
  initialBenchmark: number;
  benchmarkSymbol: string;
  chartWidth: number;
  chartHeight: number;
}) {
  const TOOLTIP_W = 260;
  const left = Math.min(
    Math.max(tooltip.x + 14, 8),
    Math.max(8, chartWidth - TOOLTIP_W - 8),
  );
  const top = Math.min(
    Math.max(tooltip.y - 16, 8),
    Math.max(8, chartHeight - 50 - 28 * strategies.length),
  );

  const stratReturns = tooltip.strategyValues.map((v, i) => {
    const init = initialStrategyValues[i] ?? 0;
    return v != null && init > 0 ? v / init - 1 : null;
  });
  const benchReturn =
    tooltip.benchmarkValue != null && initialBenchmark > 0
      ? tooltip.benchmarkValue / initialBenchmark - 1
      : null;

  return (
    <div
      className="pointer-events-none absolute z-30 rounded-md border border-accent/40 bg-panel px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      style={{ left, top, width: TOOLTIP_W }}
    >
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-ink-faint">
        {shortDate(tooltip.date)}
      </div>
      {strategies.map((s, i) => (
        <Row
          key={s.name + i}
          color={STRATEGY_COLORS[i] ?? STRATEGY_COLORS[0]!}
          label={s.name}
          value={tooltip.strategyValues[i] ?? null}
          delta={stratReturns[i] ?? null}
        />
      ))}
      <Row
        color="var(--text-tertiary)"
        label={benchmarkSymbol}
        value={tooltip.benchmarkValue}
        delta={benchReturn}
      />
      {tooltip.drawdownValue != null && (
        <div className="mt-1.5 flex items-baseline justify-between border-t border-rule pt-1.5">
          <span className="text-[10px] uppercase tracking-wide text-ink-muted">
            Drawdown
          </span>
          <span className="font-mono text-xs tabular-nums text-negative">
            {pct(tooltip.drawdownValue, 1)}
          </span>
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  label,
  value,
  delta,
}: {
  color: string;
  label: string;
  value: number | null;
  delta: number | null;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span className="flex-1 truncate text-ink-muted">{label}</span>
      <span className="font-mono tabular-nums text-ink">
        {value != null ? money(value) : '—'}
      </span>
      {delta != null && (
        <span
          className={`w-14 text-right font-mono text-[10px] tabular-nums ${
            delta > 0 ? 'text-positive' : delta < 0 ? 'text-negative' : 'text-ink-faint'
          }`}
        >
          {pctSigned(delta, 1)}
        </span>
      )}
    </div>
  );
}
