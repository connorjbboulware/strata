'use client';

import { useEffect, useState } from 'react';

export default function LoadingState() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 500);
    return () => clearInterval(id);
  }, []);

  let suffix = '';
  if (elapsedMs > 10_000) suffix = ' Backfilling cache — subsequent runs will be fast.';
  else if (elapsedMs > 3_000) suffix = ' Fetching market data — first run is slower.';

  return (
    <div
      className="flex min-h-[420px] flex-col gap-6 rounded-xl border border-rule bg-panel p-7"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Mimics the chart */}
      <div className="h-[300px] w-full animate-pulse rounded-md bg-rule/40" />
      {/* Mimics the metrics grid */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse bg-panel" />
        ))}
      </div>
      <p className="text-center text-sm text-ink-muted">
        Running your strategy…{suffix}
      </p>
    </div>
  );
}
