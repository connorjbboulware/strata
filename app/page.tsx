'use client';

import { useEffect, useState } from 'react';
import { getHealth } from '@/lib/api';

type Status = 'checking' | 'ok' | 'down';

export default function Home() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((r) => {
        if (cancelled) return;
        setStatus(r.status === 'ok' && r.db === 'ok' ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface">
      <div className="strata-bands" aria-hidden="true" />

      <section className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6">
        <h1
          className="font-serif text-ink"
          style={{
            fontSize: 'clamp(4rem, 12vw, 9rem)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
          }}
        >
          Strata
        </h1>
        <p className="mt-10 max-w-xl text-center font-sans text-base text-ink-muted md:text-lg">
          Compose portfolios. Test history. See the pattern.
        </p>
      </section>

      <footer className="absolute inset-x-0 bottom-6 z-10 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        API: {status === 'checking' ? 'checking…' : status}
      </footer>
    </main>
  );
}
