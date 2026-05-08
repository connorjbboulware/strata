'use client';

import { useEffect, useRef, useState } from 'react';
import StrategyForm, { type StrategyFormHandle } from '@/components/StrategyForm';
import ResultsPanel from '@/components/ResultsPanel';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import Toast from '@/components/Toast';
import { ApiError, getHealth, runBacktest } from '@/lib/api';
import type {
  BacktestRequest,
  BenchmarkResult,
  StrategyResult,
} from '@/lib/types';
import { buildPreset, type PresetKey } from '@/lib/presets';
import { decodeHash, shareUrl, writeHash } from '@/lib/share';

const STORAGE_KEY = 'strata:lastRequest:v2';
type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Page() {
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<StrategyResult[]>([]);
  const [requests, setRequests] = useState<BacktestRequest[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [appendNext, setAppendNext] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'down'>('checking');
  const [toast, setToast] = useState<string | null>(null);
  const formRef = useRef<StrategyFormHandle>(null);
  const hashHydratedRef = useRef(false);

  // Health check
  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((r) => {
        if (cancelled) return;
        setApiStatus(r.status === 'ok' && r.db === 'ok' ? 'ok' : 'down');
      })
      .catch(() => {
        if (!cancelled) setApiStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate from URL hash on first mount
  useEffect(() => {
    if (hashHydratedRef.current) return;
    hashHydratedRef.current = true;
    if (typeof window === 'undefined') return;
    const hashRequests = decodeHash(window.location.hash);
    if (hashRequests && hashRequests.length > 0) {
      void replayRequests(hashRequests);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL hash whenever requests change
  useEffect(() => {
    if (!hashHydratedRef.current) return;
    writeHash(requests);
  }, [requests]);

  async function replayRequests(reqs: BacktestRequest[]) {
    for (let i = 0; i < reqs.length && i < 3; i++) {
      const req = reqs[i]!;
      formRef.current?.applyRequest(req);
      await runOne(req, { append: i > 0, replaceList: i === 0 });
    }
  }

  async function runOne(
    req: BacktestRequest,
    opts: { append: boolean; replaceList?: boolean },
  ) {
    const isAppend = opts.append && results.length > 0 && results.length < 3;
    const wasShowing = results.length > 0;
    setError(null);
    setInlineError(null);
    if (!wasShowing || opts.replaceList) {
      setStatus('loading');
    }
    try {
      const r = await runBacktest(req);
      if (isAppend && benchmark) {
        setResults((prev) => [...prev, ...r.results]);
        setRequests((prev) => [...prev, req]);
        // Keep existing benchmark; merge warnings (de-duplicate close-enough)
        setWarnings((prev) => Array.from(new Set([...prev, ...r.warnings])));
      } else {
        setResults(r.results);
        setRequests([req]);
        setBenchmark(r.benchmark);
        setWarnings(r.warnings);
      }
      setStatus('success');
      setAppendNext(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      if (isAppend && wasShowing) {
        // Don't blow away existing display; show inline error.
        setInlineError(`Couldn't add comparison: ${msg}`);
        setAppendNext(false);
        // Status stays 'success'
      } else {
        setError(msg);
        setStatus('error');
      }
    }
  }

  async function handleSubmit(req: BacktestRequest) {
    await runOne(req, { append: appendNext });
  }

  function handleSelectPreset(key: PresetKey) {
    const req = buildPreset(key);
    formRef.current?.applyRequest(req);
    void runOne(req, { append: false, replaceList: true });
  }

  function handleAddForComparison() {
    setAppendNext(true);
  }

  function handleCancelComparison() {
    setAppendNext(false);
  }

  function handleRemoveStrategy(idx: number) {
    setResults((prev) => prev.filter((_, i) => i !== idx));
    setRequests((prev) => prev.filter((_, i) => i !== idx));
    setInlineError(null);
  }

  function handleCopyShareLink() {
    const url = shareUrl(requests);
    if (!url) return;
    void (async () => {
      try {
        await navigator.clipboard.writeText(url);
        setToast('Link copied');
      } catch {
        setToast('Could not copy link');
      }
    })();
  }

  function handleRetry() {
    if (requests.length > 0) {
      const last = requests[requests.length - 1]!;
      void runOne(last, { append: false, replaceList: true });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <header className="flex items-center justify-between border-b border-rule px-5 py-4 sm:px-8">
        <h1 className="font-serif text-2xl tracking-tight text-ink">Strata</h1>
        <a
          href="https://github.com/connorjbboulware/strata"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-ink-faint hover:text-ink transition-colors"
        >
          <GitHubIcon />
        </a>
      </header>

      <main className="flex-1 px-5 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto grid max-w-[1400px] gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-rule bg-panel/40 p-5">
            <StrategyForm
              ref={formRef}
              onSubmit={handleSubmit}
              loading={status === 'loading'}
            />
          </aside>

          <section className="min-w-0">
            {status === 'idle' && <EmptyState onSelectPreset={handleSelectPreset} />}
            {status === 'loading' && <LoadingState />}
            {status === 'error' && (
              <ErrorState message={error ?? 'Unknown error'} onRetry={handleRetry} />
            )}
            {status === 'success' && results.length > 0 && benchmark && (
              <ResultsPanel
                results={results}
                benchmark={benchmark}
                warnings={warnings}
                appendNext={appendNext}
                inlineError={inlineError}
                onAddForComparison={handleAddForComparison}
                onRemoveStrategy={handleRemoveStrategy}
                onCancelComparison={handleCancelComparison}
                onCopyShareLink={handleCopyShareLink}
                onDismissInlineError={() => setInlineError(null)}
              />
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-rule px-5 py-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint sm:px-8">
        API: {apiStatus === 'checking' ? 'checking…' : apiStatus}
      </footer>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-.99-.01-1.94-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18a10.94 10.94 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}
