'use client';

import { useState } from 'react';
import { PRESET_META, type PresetKey } from '@/lib/presets';

interface Props {
  onSelectPreset: (key: PresetKey) => void;
  disabled?: boolean;
}

const KEYS: PresetKey[] = ['mag7', 'sixty-forty', 'sectors'];

export default function EmptyState({ onSelectPreset, disabled }: Props) {
  // Brief copper-flash on the clicked card before the parent fires the submit,
  // so the user gets unambiguous feedback that the click registered.
  const [flashing, setFlashing] = useState<PresetKey | null>(null);

  function handleClick(k: PresetKey) {
    if (disabled || flashing) return;
    setFlashing(k);
    window.setTimeout(() => {
      onSelectPreset(k);
      // Don't reset flashing — the parent transitions to 'loading' which unmounts us.
    }, 200);
  }

  return (
    <div className="relative min-h-[480px] overflow-hidden rounded-xl border border-rule bg-panel">
      {/* Sedimentary strata band — bottom ~40%, fades top + bottom, sits behind content. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(180deg,' +
            'transparent 0%, transparent 12%,' +
            'rgba(58, 53, 48, 0.28) 12%, rgba(58, 53, 48, 0.28) 19%,' +    // deep slate
            'transparent 19%, transparent 23%,' +
            'rgba(74, 51, 40, 0.30) 23%, rgba(74, 51, 40, 0.30) 37%,' +    // umber
            'transparent 37%, transparent 40%,' +
            'rgba(94, 58, 47, 0.24) 40%, rgba(94, 58, 47, 0.24) 58%,' +    // burnt sienna
            'transparent 58%, transparent 62%,' +
            'rgba(122, 90, 61, 0.18) 62%, rgba(122, 90, 61, 0.18) 74%,' +  // ochre
            'transparent 74%, transparent 78%,' +
            'rgba(90, 77, 64, 0.22) 78%, rgba(90, 77, 64, 0.22) 92%,' +    // warm gray
            'transparent 92%, transparent 100%' +
            ')',
          maskImage:
            'linear-gradient(180deg, transparent 0%, black 28%, black 92%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 0%, black 28%, black 92%, transparent 100%)',
        }}
      />
      {/* Fine sediment grain — 1px horizontal lines at very low alpha, masked the same way. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[40%]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,' +
            'transparent 0px, transparent 3px,' +
            'rgba(245, 241, 234, 0.014) 3px, rgba(245, 241, 234, 0.014) 4px' +
            ')',
          maskImage:
            'linear-gradient(180deg, transparent 0%, black 28%, black 92%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg, transparent 0%, black 28%, black 92%, transparent 100%)',
        }}
      />

      {/* Content — sits above the strata band */}
      <div className="relative z-10 flex min-h-[480px] flex-col items-center justify-center gap-9 px-6 py-12 text-center">
        <div className="max-w-[560px]">
          <h2 className="font-serif text-[32px] leading-[1.15] text-ink">
            Backtest a portfolio strategy
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-ink-muted">
            Configure your own on the left, or start with a preset below. All metrics are
            computed from real adjusted-close price history — Sharpe, Sortino, alpha vs
            SPY, drawdown, the works.
          </p>
        </div>

        <ul className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          {KEYS.map((k) => {
            const meta = PRESET_META[k];
            const isFlashing = flashing === k;
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => handleClick(k)}
                  disabled={disabled || flashing != null}
                  className={`group relative flex h-full w-full flex-col items-start gap-1 rounded-lg border bg-panel px-4 py-3.5 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isFlashing
                      ? 'border-accent shadow-[0_0_0_1px_rgba(201,120,95,0.45)] bg-panel'
                      : 'border-rule hover:border-accent hover:bg-[rgb(var(--bg-elevated-rgb)/0.85)]'
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-3 text-sm text-ink">
                    <span>{meta.label}</span>
                    <span
                      className={`text-base leading-none transition-colors ${
                        isFlashing
                          ? 'text-accent'
                          : 'text-ink-faint group-hover:text-accent'
                      }`}
                    >
                      →
                    </span>
                  </span>
                  <span className="text-[11px] leading-snug text-ink-muted">
                    {meta.subtitle}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
