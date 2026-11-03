import { StatusIcon } from './Glyph';

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
    <div className={`glass p-4 md:p-6 ${className}`}>
      <Skeleton className="h-4 w-24 mb-3" />
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
export function ErrorState({ message = 'Something went wrong.', onRetry, title = 'This did not load' }) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <StatusIcon kind="error" size={20} />
      <div>
        <b>{title}</b>
        <p>{message}</p>
        {onRetry ? <button type="button" onClick={onRetry} className="ui-state__action">Try again</button> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  eyebrow = '',
  title = 'Nothing here yet.',
  message = 'Once data starts flowing, it will show up here.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="ui-state ui-state--empty">
      {eyebrow && !eyebrow.startsWith('//') ? <span className="ui-state__eyebrow">{eyebrow}</span> : null}
      <b>{title}</b>
      <p>{message}</p>
      {actionLabel && onAction ? <button type="button" onClick={onAction} className="ui-state__action ui-state__action--primary">{actionLabel}</button> : null}
    </div>
  );
}
