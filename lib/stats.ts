import type { EquityPoint } from './types';

// ---------------------------------------------------------------------------
// Daily returns from a cumulative equity curve
// ---------------------------------------------------------------------------

export interface DailyReturn {
  date: string;
  return: number;
}

export function dailyReturnsFromEquity(equity: EquityPoint[]): DailyReturn[] {
  const out: DailyReturn[] = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1]!.value;
    const curr = equity[i]!.value;
    if (prev > 0) {
      out.push({ date: equity[i]!.date, return: curr / prev - 1 });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mean / std / skew / kurtosis (excess) — sample formulas (ddof=1) where applicable
// ---------------------------------------------------------------------------

export function computeMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

export function computeStd(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = computeMean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) ** 2;
  return Math.sqrt(s / (arr.length - 1));
}

export function computeSkewness(arr: number[]): number {
  if (arr.length < 3) return 0;
  const m = computeMean(arr);
  const sd = computeStd(arr);
  if (sd < 1e-12) return 0;
  let s = 0;
  for (const v of arr) s += ((v - m) / sd) ** 3;
  return s / arr.length;
}

export function computeKurtosis(arr: number[]): number {
  if (arr.length < 4) return 0;
  const m = computeMean(arr);
  const sd = computeStd(arr);
  if (sd < 1e-12) return 0;
  let s = 0;
  for (const v of arr) s += ((v - m) / sd) ** 4;
  return s / arr.length - 3;
}

export function percentPositiveDays(returns: number[]): number {
  if (returns.length === 0) return 0;
  let pos = 0;
  for (const r of returns) if (r > 0) pos++;
  return pos / returns.length;
}

// ---------------------------------------------------------------------------
// Histogram bins, symmetric around 0
// ---------------------------------------------------------------------------

export interface HistogramBin {
  bucketStart: number;
  bucketEnd: number;
  bucketMid: number;
  count: number;
  signed: 'positive' | 'negative';
}

export function histogramBins(returns: number[], bucketCount = 40): HistogramBin[] {
  if (returns.length === 0) return [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of returns) {
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  const range = Math.max(Math.abs(lo), Math.abs(hi));
  const start = -range;
  const end = range;
  const step = (end - start) / bucketCount;
  if (step === 0) return [];

  const bins: HistogramBin[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bs = start + i * step;
    const be = bs + step;
    const mid = (bs + be) / 2;
    bins.push({
      bucketStart: bs,
      bucketEnd: be,
      bucketMid: mid,
      count: 0,
      signed: mid >= 0 ? 'positive' : 'negative',
    });
  }
  for (const r of returns) {
    let idx = Math.floor((r - start) / step);
    if (idx < 0) idx = 0;
    if (idx >= bucketCount) idx = bucketCount - 1;
    bins[idx]!.count++;
  }
  return bins;
}

// Normal distribution PDF, used to overlay on the histogram
export function normalPDF(x: number, mean: number, std: number): number {
  if (std < 1e-12) return 0;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

// ---------------------------------------------------------------------------
// Rolling 12-month Sharpe (window = 252 trading days), rf = 0
// ---------------------------------------------------------------------------

export interface RollingSharpePoint {
  date: string;
  value: number;
}

export function rollingSharpe(
  daily: number[],
  dates: string[],
  window = 252,
): RollingSharpePoint[] {
  const out: RollingSharpePoint[] = [];
  if (daily.length < window || daily.length !== dates.length) return out;

  // Sliding-window mean and (sum, sumSq) for std
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < window; i++) {
    sum += daily[i]!;
    sumSq += daily[i]! * daily[i]!;
  }
  const sqrtN = Math.sqrt(252);

  function emit(idx: number) {
    const mean = sum / window;
    const variance = (sumSq - window * mean * mean) / (window - 1);
    const sd = variance > 0 ? Math.sqrt(variance) : 0;
    if (sd > 1e-12) {
      out.push({ date: dates[idx]!, value: (sqrtN * mean) / sd });
    }
  }

  emit(window - 1);
  for (let i = window; i < daily.length; i++) {
    const incoming = daily[i]!;
    const outgoing = daily[i - window]!;
    sum += incoming - outgoing;
    sumSq += incoming * incoming - outgoing * outgoing;
    emit(i);
  }
  return out;
}
