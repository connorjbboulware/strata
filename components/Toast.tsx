'use client';

import { useEffect, useState } from 'react';

interface Props {
  message: string | null;
  /** Auto-dismiss after this many ms. Default 1500. */
  durationMs?: number;
  onDismiss?: () => void;
}

export default function Toast({ message, durationMs = 1500, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="rounded-md border border-accent/40 bg-panel px-4 py-2 font-mono text-xs text-ink shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        {message}
      </div>
    </div>
  );
}
