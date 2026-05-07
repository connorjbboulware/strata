'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import type {
  BacktestRequest,
  RebalanceFrequency,
  StrategyRequest,
} from '@/lib/types';
import { buildPreset } from '@/lib/presets';

const TICKER_RE = /^[A-Z0-9]{1,10}$/;
// v2: bumped when default form shape changes — old entries become invisible
const STORAGE_KEY = 'strata:lastRequest:v2';

interface FormState {
  name: string;
  tickers: string[];
  tickerInput: string;
  weightsMode: 'equal' | 'custom';
  customPercents: number[];
  startDate: string;
  endDate: string;
  initialCapital: number;
  rebalance: RebalanceFrequency;
  benchmark: string;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoMinusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function requestToFormState(req: BacktestRequest, fallback: FormState): FormState {
  const s = req.strategies[0];
  if (!s) return fallback;
  const isCustom = Array.isArray(s.weights);
  return {
    name: s.name,
    tickers: s.tickers,
    tickerInput: '',
    weightsMode: isCustom ? 'custom' : 'equal',
    customPercents: isCustom ? (s.weights as number[]).map((w) => w * 100) : [],
    startDate: s.start_date,
    endDate: s.end_date,
    initialCapital: s.initial_capital,
    rebalance: s.rebalance_frequency,
    benchmark: req.benchmark,
  };
}

function defaultState(): FormState {
  // Mount with the Mag 7 demo so the form is meaningful out of the box.
  return requestToFormState(buildPreset('mag7'), {
    name: 'Magnificent 7',
    tickers: [],
    tickerInput: '',
    weightsMode: 'equal',
    customPercents: [],
    startDate: '2018-01-02',
    endDate: isoMinusDays(1),
    initialCapital: 10000,
    rebalance: 'monthly',
    benchmark: 'SPY',
  });
}

function loadFromStorage(): FormState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const req: BacktestRequest = JSON.parse(raw);
    return requestToFormState(req, defaultState());
  } catch {
    return null;
  }
}

interface Errors {
  name?: string;
  tickers?: string;
  weights?: string;
  dates?: string;
  capital?: string;
  benchmark?: string;
}

function validate(s: FormState): Errors {
  const e: Errors = {};
  if (!s.name.trim()) e.name = 'Name is required';
  if (s.tickers.length === 0) e.tickers = 'Add at least one ticker';
  else if (s.tickers.length > 10) e.tickers = 'Max 10 tickers';
  if (!s.startDate || !s.endDate) e.dates = 'Both dates required';
  else if (s.endDate <= s.startDate) e.dates = 'End must be after start';
  else if (s.endDate > isoToday()) e.dates = 'End cannot be in the future';
  if (
    !Number.isFinite(s.initialCapital) ||
    s.initialCapital < 100 ||
    s.initialCapital > 10_000_000
  )
    e.capital = '$100 to $10,000,000';
  if (s.weightsMode === 'custom') {
    if (s.customPercents.length !== s.tickers.length) {
      e.weights = 'Set a weight for each ticker';
    } else {
      const total = s.customPercents.reduce((a, b) => a + b, 0);
      if (Math.abs(total - 100) > 0.1)
        e.weights = `Total is ${total.toFixed(1)}% — must be 100%`;
      if (s.customPercents.some((w) => w < 0)) e.weights = 'Weights must be ≥ 0';
    }
  }
  const benchUp = s.benchmark.trim().toUpperCase();
  if (!TICKER_RE.test(benchUp)) e.benchmark = '1-10 alphanumeric chars';
  return e;
}

export interface StrategyFormHandle {
  /** Replace the form's state with the values from a preset / past request. */
  applyRequest: (req: BacktestRequest) => void;
}

interface Props {
  onSubmit: (req: BacktestRequest) => Promise<void> | void;
  loading: boolean;
}

const StrategyForm = forwardRef<StrategyFormHandle, Props>(function StrategyForm(
  { onSubmit, loading },
  ref,
) {
  const [s, setS] = useState<FormState>(defaultState);
  const [touched, setTouched] = useState(false);

  // Hydrate from sessionStorage on mount (avoids SSR hydration mismatch).
  // Old-shape entries are ignored because STORAGE_KEY is versioned.
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) setS(saved);
  }, []);

  // Imperative handle so the parent can force-load a preset
  useImperativeHandle(
    ref,
    () => ({
      applyRequest: (req: BacktestRequest) => {
        setS((prev) => requestToFormState(req, prev));
        setTouched(false);
      },
    }),
    [],
  );

  // Keep customPercents synced to ticker length when in custom mode
  useEffect(() => {
    if (s.weightsMode !== 'custom') return;
    if (s.customPercents.length === s.tickers.length) return;
    const equal = s.tickers.length > 0 ? 100 / s.tickers.length : 0;
    setS((prev) => ({
      ...prev,
      customPercents: prev.tickers.map((_, i) => prev.customPercents[i] ?? equal),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.tickers.length, s.weightsMode]);

  const errors = validate(s);
  const valid = Object.keys(errors).length === 0;
  const customTotal = useMemo(
    () => s.customPercents.reduce((a, b) => a + b, 0),
    [s.customPercents],
  );

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function addTicker(raw: string): boolean {
    const t = raw.trim().toUpperCase();
    if (!TICKER_RE.test(t)) return false;
    if (s.tickers.includes(t)) return false;
    if (s.tickers.length >= 10) return false;
    setS((prev) => ({
      ...prev,
      tickers: [...prev.tickers, t],
      tickerInput: '',
    }));
    return true;
  }

  function removeTicker(idx: number) {
    setS((prev) => ({
      ...prev,
      tickers: prev.tickers.filter((_, i) => i !== idx),
      customPercents: prev.customPercents.filter((_, i) => i !== idx),
    }));
  }

  function handleTickerKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTicker(s.tickerInput);
    } else if (e.key === 'Backspace' && s.tickerInput === '' && s.tickers.length > 0) {
      e.preventDefault();
      removeTicker(s.tickers.length - 1);
    }
  }

  function applyPreset(kind: '1Y' | '3Y' | '5Y' | '10Y' | 'Max') {
    const end = isoMinusDays(1);
    let start: string;
    if (kind === 'Max') {
      start = '2010-01-04';
    } else {
      const years = parseInt(kind, 10);
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setFullYear(d.getFullYear() - years);
      start = d.toISOString().slice(0, 10);
    }
    setS((prev) => ({ ...prev, startDate: start, endDate: end }));
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid || loading) return;
    const pendingTickers =
      s.tickerInput.trim() && addTicker(s.tickerInput)
        ? [...s.tickers, s.tickerInput.trim().toUpperCase()]
        : s.tickers;
    const strategy: StrategyRequest = {
      name: s.name.trim(),
      tickers: pendingTickers,
      weights:
        s.weightsMode === 'equal'
          ? 'equal'
          : s.customPercents.map((p) => p / 100),
      start_date: s.startDate,
      end_date: s.endDate,
      initial_capital: s.initialCapital,
      rebalance_frequency: s.rebalance,
    };
    const req: BacktestRequest = {
      strategies: [strategy],
      benchmark: s.benchmark.trim().toUpperCase(),
    };
    void onSubmit(req);
  }

  const showError = (key: keyof Errors) =>
    touched && errors[key] ? (
      <p className="mt-1 text-[11px] text-negative">{errors[key]}</p>
    ) : null;

  return (
    <form onSubmit={handleSubmitForm} className="flex flex-col gap-5" noValidate>
      {/* Name */}
      <div>
        <label htmlFor="name" className="form-label">Strategy name</label>
        <input
          id="name"
          type="text"
          value={s.name}
          onChange={(e) => update('name', e.target.value)}
          maxLength={80}
          className="form-input mt-1.5"
        />
        {showError('name')}
      </div>

      {/* Tickers */}
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="ticker-input" className="form-label">Tickers</label>
          <span className="text-[11px] text-ink-faint font-mono">{s.tickers.length}/10</span>
        </div>
        <div
          className={`mt-1.5 flex flex-wrap items-center gap-1.5 min-h-[42px] rounded-lg border bg-panel px-2 py-1.5 transition-shadow ${
            touched && errors.tickers ? 'border-negative/60' : 'border-rule'
          } focus-within:ring-1 focus-within:ring-accent`}
        >
          {s.tickers.map((t, i) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-xs font-mono text-ink"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTicker(i)}
                aria-label={`Remove ${t}`}
                className="text-ink-faint hover:text-negative"
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="ticker-input"
            type="text"
            value={s.tickerInput}
            onChange={(e) => update('tickerInput', e.target.value.toUpperCase())}
            onKeyDown={handleTickerKey}
            onBlur={() => {
              if (s.tickerInput.trim()) addTicker(s.tickerInput);
            }}
            placeholder={s.tickers.length === 0 ? 'AAPL, MSFT, NVDA…' : ''}
            className="flex-1 min-w-[80px] bg-transparent text-sm font-mono text-ink placeholder:text-ink-faint outline-none"
          />
        </div>
        {showError('tickers')}
      </div>

      {/* Weights */}
      <div>
        <span className="form-label">Weights</span>
        <div role="radiogroup" className="mt-1.5 flex gap-2">
          {(['equal', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={s.weightsMode === mode}
              onClick={() => update('weightsMode', mode)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                s.weightsMode === mode
                  ? 'border-accent bg-accent/10 text-ink'
                  : 'border-rule bg-panel text-ink-muted hover:text-ink'
              }`}
            >
              {mode === 'equal' ? 'Equal' : 'Custom'}
            </button>
          ))}
        </div>

        {s.weightsMode === 'custom' && s.tickers.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {s.tickers.map((t, i) => (
              <div key={t} className="flex items-center gap-2">
                <span className="w-12 font-mono text-xs text-ink-muted">{t}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={s.customPercents[i] ?? 0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0;
                    setS((prev) => {
                      const next = [...prev.customPercents];
                      next[i] = v;
                      return { ...prev, customPercents: next };
                    });
                  }}
                  className="form-input flex-1 font-mono"
                />
                <span className="text-xs text-ink-faint">%</span>
              </div>
            ))}
            <p
              className={`mt-2 text-xs font-mono tabular-nums ${
                Math.abs(customTotal - 100) < 0.1
                  ? 'text-positive'
                  : 'text-ink-muted'
              }`}
            >
              Total: {customTotal.toFixed(1)}%{' '}
              {Math.abs(customTotal - 100) < 0.1 ? '✓' : '— must equal 100%'}
            </p>
          </div>
        )}
        {showError('weights')}
      </div>

      {/* Date range */}
      <div>
        <span className="form-label">Date range</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(['1Y', '3Y', '5Y', '10Y', 'Max'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-md border border-rule bg-panel px-2.5 py-1 text-[11px] font-mono text-ink-muted hover:text-ink hover:border-accent/40 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="Start date"
            value={s.startDate}
            max={s.endDate}
            onChange={(e) => update('startDate', e.target.value)}
            className="form-input font-mono"
          />
          <input
            type="date"
            aria-label="End date"
            value={s.endDate}
            min={s.startDate}
            max={isoToday()}
            onChange={(e) => update('endDate', e.target.value)}
            className="form-input font-mono"
          />
        </div>
        {showError('dates')}
      </div>

      {/* Capital */}
      <div>
        <label htmlFor="capital" className="form-label">Initial capital</label>
        <div className="relative mt-1.5">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint text-sm">$</span>
          <input
            id="capital"
            type="number"
            min={100}
            max={10_000_000}
            step={100}
            value={s.initialCapital}
            onChange={(e) =>
              update('initialCapital', parseFloat(e.target.value) || 0)
            }
            className="form-input pl-7 font-mono"
          />
        </div>
        {showError('capital')}
      </div>

      {/* Rebalance */}
      <div>
        <span className="form-label">Rebalance</span>
        <div role="radiogroup" className="mt-1.5 grid grid-cols-4 gap-1.5">
          {(['none', 'monthly', 'quarterly', 'yearly'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={s.rebalance === f}
              onClick={() => update('rebalance', f)}
              className={`rounded-md border px-1.5 py-2 text-[11px] uppercase tracking-wide transition-colors ${
                s.rebalance === f
                  ? 'border-accent bg-accent/10 text-ink'
                  : 'border-rule bg-panel text-ink-muted hover:text-ink'
              }`}
            >
              {f === 'none' ? 'None' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Benchmark */}
      <div>
        <label htmlFor="benchmark" className="form-label">Benchmark</label>
        <input
          id="benchmark"
          type="text"
          value={s.benchmark}
          onChange={(e) => update('benchmark', e.target.value.toUpperCase())}
          maxLength={10}
          className="form-input mt-1.5 font-mono"
        />
        {showError('benchmark')}
      </div>

      {/* Submit — sticky to viewport bottom so it's always reachable */}
      <div className="sticky bottom-0 z-20 -mx-5 -mb-5 mt-3 rounded-b-xl border-t border-rule bg-surface px-6 py-4">
        <button
          type="submit"
          disabled={loading || (!valid && touched)}
          className="button-primary"
        >
          {loading ? (
            <>
              <Spinner /> Running…
            </>
          ) : (
            'Run backtest'
          )}
        </button>
      </div>
    </form>
  );
});

export default StrategyForm;

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
