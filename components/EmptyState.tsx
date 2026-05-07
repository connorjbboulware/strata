'use client';

import { PRESET_META, type PresetKey } from '@/lib/presets';

interface Props {
  onSelectPreset: (key: PresetKey) => void;
  disabled?: boolean;
}

export default function EmptyState({ onSelectPreset, disabled }: Props) {
  const keys: PresetKey[] = ['mag7', 'sixty-forty', 'sectors'];
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-7 rounded-xl border border-rule bg-panel p-8 text-center">
      <MiniStrata />
      <div>
        <h2 className="font-serif text-2xl text-ink">No backtest yet</h2>
        <p className="mt-2 max-w-md text-sm text-ink-muted">
          Configure a strategy on the left, or try one of these:
        </p>
      </div>

      <ul className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
        {keys.map((k) => {
          const meta = PRESET_META[k];
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onSelectPreset(k)}
                disabled={disabled}
                className="group flex h-full w-full flex-col items-start gap-1.5 rounded-lg border border-rule bg-surface px-4 py-3.5 text-left transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex w-full items-center justify-between text-sm text-ink">
                  {meta.label}
                  <span className="text-ink-faint transition-colors group-hover:text-accent">
                    →
                  </span>
                </span>
                <span className="text-[11px] text-ink-muted">{meta.subtitle}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Decorative version of the strata bands — small, layered, no animation. */
function MiniStrata() {
  return (
    <div
      className="h-16 w-32 rounded-md"
      aria-hidden="true"
      style={{
        backgroundImage: `linear-gradient(
          180deg,
          rgba(112, 128, 144, 0.10) 0%,
          rgba(112, 128, 144, 0.10) 18%,
          rgba(180, 130, 60, 0.14) 20%,
          rgba(180, 130, 60, 0.14) 38%,
          rgba(139, 90, 60, 0.20) 40%,
          rgba(139, 90, 60, 0.20) 60%,
          rgba(101, 67, 33, 0.22) 62%,
          rgba(101, 67, 33, 0.22) 82%,
          rgba(180, 130, 60, 0.14) 84%,
          rgba(180, 130, 60, 0.14) 100%
        )`,
      }}
    />
  );
}
