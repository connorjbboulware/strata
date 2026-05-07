interface Props {
  message: string;
  onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-xl border border-negative/30 bg-panel p-8 text-center">
      <AlertCircleIcon />
      <div>
        <h2 className="font-serif text-2xl text-ink">Something went wrong</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{message}</p>
      </div>
      <button type="button" onClick={onRetry} className="button-secondary">
        Try again
      </button>
    </div>
  );
}

function AlertCircleIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--negative)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <circle cx="12" cy="16" r="0.5" fill="var(--negative)" />
    </svg>
  );
}
