export default function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-6 rounded-xl border border-rule bg-panel p-10 text-center">
      <MiniStrata />
      <div>
        <h2 className="font-serif text-2xl text-ink">No backtest yet</h2>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          Configure a strategy on the left, then click Run.
        </p>
      </div>
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
