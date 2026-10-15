import { useId } from 'react';
import { StatusIcon } from './Glyph';
import { WaitingMobi, FailedMobi, RefusedMobi, EmptyMobi } from './StateMobi';
import StateRoom from '@/components/scenes/StateRoom';
import { sceneForState } from '@/components/scenes/sceneModel.mjs';

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

/**
 * Inline error surface used by data-fetching pages. Pass `scene` ('unreachable') where the error takes
 * the page's place: Mobi then stands in the painted room with the loose cable and the repair tin (the
 * unplugged desk while the browser is offline) and shrugs once on the first failure of a run. Without
 * `scene` it stays the compact alert row, for errors inside a form or a list.
 */
export function ErrorState({ message = 'Check your connection and try again.', onRetry, title = 'This did not load', mascot = false, scene }) {
  if (sceneForState('error', scene)) {
    return (
      <div className="ui-state ui-state--error ui-state--scene" role="alert">
        <StateRoom kind="error" scene={scene} />
        <div className="ui-state__copy">
          <b>{title}</b>
          <p>{message}</p>
          {onRetry ? <button type="button" onClick={onRetry} className="ui-state__action ui-state__action--primary">Try again</button> : null}
        </div>
      </div>
    );
  }
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

/**
 * Nothing to show. Name a painted room with `scene` and Mobi rests in it (the app's rule: a room only
 * when the state names one):
 *   allClear    everything marked, nothing to repair (never for "nothing yet")
 *   nothingYet  work not started
 *   saved       a place where kept things will live
 *   noResults   a filter or a search that found nothing
 * Without `scene`, Mobi reads beside the words as before.
 */
export function EmptyState({
  eyebrow = '',
  title = 'Nothing here yet.',
  message = 'Your recorded activity will appear here when you start.',
  actionLabel,
  onAction,
  mascot = true,
  mobiAct = 'read',
  scene,
  compact = false,
}) {
  if (mascot && sceneForState('empty', scene)) {
    return (
      <div className="ui-state ui-state--empty ui-state--scene">
        <StateRoom kind="empty" scene={scene} compact={compact} />
        <div className="ui-state__copy">
          {eyebrow && !eyebrow.startsWith('//') ? <span className="ui-state__eyebrow">{eyebrow}</span> : null}
          <b>{title}</b>
          <p>{message}</p>
          {actionLabel && onAction ? <button type="button" onClick={onAction} className="ui-state__action ui-state__action--primary">{actionLabel}</button> : null}
        </div>
      </div>
    );
  }
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
