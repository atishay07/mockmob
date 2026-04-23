/**
 * Minimal skeleton primitives. All use a single shimmer animation defined in globals.css.
 * Keep these presentational — no data dependency.
 */
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** A stack of shimmer lines — useful for list rows. */
export function SkeletonLines({ count = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** A glass card with skeleton content inside — matches .glass card shape. */
export function SkeletonCard({ className = '', lines = 3 }) {
  return (
    <div className={`glass p-6 ${className}`}>
      <Skeleton className="h-4 w-24 mb-4" />
      <SkeletonLines count={lines} />
    </div>
  );
}

/** Centered full-page spinner — use when a full page is waiting on data. */
export function PageSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-24 text-zinc-500">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-volt animate-pulse-slow shadow-[0_0_12px_var(--volt)]" />
        <span className="mono-label">{label}</span>
      </div>
    </div>
  );
}

/** Inline error surface used by data-fetching pages. */
export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="glass p-6 flex flex-col items-start gap-3">
      <div className="mono-label" style={{ color: '#f87171' }}>{'// Error'}</div>
      <div className="text-sm text-zinc-300">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="btn-outline sm">
          Retry
        </button>
      )}
    </div>
  );
}
