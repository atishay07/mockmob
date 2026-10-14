import { StatusIcon } from './Glyph';
import { Mascot } from '@/components/brand/Mascot';

// Loading, empty, error and offline: designed endings, never a dead screen.
//   loading  a skeleton the shape of what is coming (no fake progress, no invented stages)
//   empty    what this is for and the one next step
//   error    what failed, that nothing was lost, and the recovery action
//   offline  the same, named as a connection problem
// Mobi appears only at these human moments, in a small pool of lamp light.
// No eyebrows: the old `eyebrow` prop is accepted and ignored.

/** One shimmer block. Size it with classes or style; it reserves the space of what is coming. */
export function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** A stack of shimmer lines, for list rows. */
export function SkeletonLines({ count = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" style={i === count - 1 && count > 1 ? { width: '62%' } : undefined} />
      ))}
    </div>
  );
}

/** A card-shaped placeholder that matches the raised surface. */
export function SkeletonCard({ className = '', lines = 3, label = 'Loading' }) {
  return (
    <div className={`glass p-4 md:p-6 ${className}`} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-24 mb-3" />
      <SkeletonLines count={lines} />
    </div>
  );
}

/** A labelled loading region: a short line saying what is loading, over skeleton rows. */
export function LoadingState({ label = 'Loading', lines = 3, className = '' }) {
  return (
    <div className={`ui-loading ${className}`.trim()} role="status" aria-live="polite">
      <p className="ui-loading__label">{label}</p>
      <SkeletonLines count={lines} />
    </div>
  );
}

/** Centred wait for a whole page. Prefer a skeleton of the page where its shape is known. */
export function PageSpinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="pip-state"><Mascot pose="attentive" /></div>
        <span className="ui-loading__label">{label}</span>
      </div>
    </div>
  );
}

function StateActions({ primary, secondary }) {
  if (!primary && !secondary) return null;
  return (
    <div className="ui-state__actions">
      {primary ? (
        <button type="button" onClick={primary.onClick} className="ui-btn ui-btn--primary ui-btn--sm" disabled={primary.loading || undefined}
          data-loading={primary.loading ? 'true' : undefined} aria-busy={primary.loading || undefined}>
          {primary.loading ? <span className="ui-spinner" aria-hidden="true" /> : null}
          <span className="ui-btn__label">{primary.label}</span>
        </button>
      ) : null}
      {secondary ? (
        <button type="button" onClick={secondary.onClick} className="ui-btn ui-btn--quiet ui-btn--sm">
          <span className="ui-btn__label">{secondary.label}</span>
        </button>
      ) : null}
    </div>
  );
}

/** Something failed. Name the recovery; say the user's work is kept when it is. */
export function ErrorState({ message = 'Check your connection and try again.', onRetry, title = 'This did not load', mascot = false, retryLabel = 'Try again', secondary }) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      {mascot ? <div className="ui-state__art pip-state"><Mascot pose="encouraging" /></div> : <StatusIcon kind="error" size={20} />}
      <div>
        <b>{title}</b>
        <p>{message}</p>
        <StateActions primary={onRetry ? { label: retryLabel, onClick: onRetry } : null} secondary={secondary} />
      </div>
    </div>
  );
}

/** No connection. Never blames the student; the action retries when they are back. */
export function OfflineState({ title = 'You are offline', message = 'Nothing is lost. This page loads again when you are back online.', onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="ui-state ui-state--offline" role="status" aria-live="polite">
      <StatusIcon kind="warning" size={20} />
      <div>
        <b>{title}</b>
        <p>{message}</p>
        <StateActions primary={onRetry ? { label: retryLabel, onClick: onRetry } : null} />
      </div>
    </div>
  );
}

/** Nothing here yet: say what goes here and the one way to start. */
export function EmptyState({ eyebrow, title = 'Nothing here yet.', message = 'Your recorded activity will appear here when you start.', actionLabel, onAction, secondaryLabel, onSecondary, mascot = true }) {
  return (
    <div className="ui-state ui-state--empty">
      {mascot ? <div className="ui-state__art pip-state"><Mascot pose="attentive" /></div> : null}
      <b>{title}</b>
      <p>{message}</p>
      <StateActions
        primary={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : null}
        secondary={secondaryLabel && onSecondary ? { label: secondaryLabel, onClick: onSecondary } : null}
      />
    </div>
  );
}
