'use client';

import { useEffect } from 'react';

interface Props {
  onEnter: () => void;
  exiting: boolean;
}

export default function Splash({ onEnter, exiting }: Props) {
  // Enter / Space / any letter key — but NOT when a modifier (Cmd, Ctrl, Alt)
  // is held, so Cmd+R / Ctrl+T / etc. don't accidentally enter.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        (e.key.length === 1 && /[a-zA-Z]/.test(e.key))
      ) {
        e.preventDefault();
        onEnter();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onEnter]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Enter Strata"
      onClick={onEnter}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-surface transition-all duration-300 ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        cursor: 'pointer',
        transform: exiting ? 'scale(0.96)' : 'scale(1)',
      }}
    >
      <div className="splash-bands" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <h1
          className="splash-wordmark font-serif text-ink"
          style={{
            fontSize: 'clamp(6rem, 14vw, 11rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          Strata
        </h1>
        <p className="splash-tagline mt-8 max-w-[540px] text-base leading-relaxed text-ink-muted sm:text-lg">
          Compose portfolios. Test history. See the pattern.
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEnter();
          }}
          className="splash-link mt-16 inline-block font-mono text-sm uppercase tracking-[0.2em] text-accent transition-all hover:underline"
        >
          Enter →
        </button>
      </div>
    </div>
  );
}
