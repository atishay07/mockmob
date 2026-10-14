import { useId } from 'react';
import { StatusIcon } from './Glyph';
import { WaitingMobi, FailedMobi, RefusedMobi, EmptyMobi } from './StateMobi';

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
        <WaitingMobi />
        <span className="mono-label" role="status">{label}</span>
      </div>
    </div>
  );
}

/** Inline error surface used by data-fetching pages. */
export function ErrorState({ message = 'Check your connection and try again.', onRetry, title = 'This did not load', mascot = false }) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      {mascot ? <FailedMobi /> : <StatusIcon kind="error" size={20} />}
      <div>
        <b>{title}</b>
        <p>{message}</p>
        {onRetry ? <button type="button" onClick={onRetry} className="ui-state__action">Try again</button> : null}
      </div>
    </div>
  );
}

/**
 * A settled answer that retrying would not change (a refusal, a limit): what happened, why, and the
 * ways forward. Not an error, so no red and no "Try again". `actions` are links or buttons, the first
 * one primary (give it ui-state__action--primary).
 */
export function NoticeState({ title, message, actions = null, mascot = true, headingLevel = 2 }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const titleId = useId();
  return (
    <section className="ui-state ui-state--notice" role="status" aria-labelledby={titleId}>
      {mascot ? <RefusedMobi /> : null}
      <div>
        <Heading id={titleId} className="ui-state__title">{title}</Heading>
        <p>{message}</p>
        {actions ? <div className="ui-state__actions">{actions}</div> : null}
      </div>
    </section>
  );
}

export function EmptyState({
  eyebrow = '',
  title = 'Nothing here yet.',
  message = 'Your recorded activity will appear here when you start.',
  actionLabel,
  onAction,
  mascot = true,
  mobiAct = 'read',
}) {
  return (
    <div className="ui-state ui-state--empty">
      {mascot && <EmptyMobi act={mobiAct} />}
      {eyebrow && !eyebrow.startsWith('//') ? <span className="ui-state__eyebrow">{eyebrow}</span> : null}
      <b>{title}</b>
      <p>{message}</p>
      {actionLabel && onAction ? <button type="button" onClick={onAction} className="ui-state__action ui-state__action--primary">{actionLabel}</button> : null}
    </div>
  );
}
