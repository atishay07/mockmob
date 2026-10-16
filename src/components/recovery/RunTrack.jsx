"use client";
// The repair run as a track: one segment per mistake of this paper, drawn only from the real outcomes.
// A segment that completes fills from its left edge and the mistake on screen is lifted. Every
// segment already reached is a button (a 44 px target; the painted bar stays thin inside it) that
// shows that mistake again with no new call. The count above it is a live region, so the track is
// never the only carrier of progress. The same words and states as the app's RunTrack.
import { RUN_COPY, canGoTo, segmentLabel, stepIndex } from './repairRun';
import './repair-run.css';

export default function RunTrack({ segments, onGo, onFinish }) {
  const n = segments.length;
  const currentIndex = Math.max(0, segments.findIndex((s) => s.current));
  const hintId = 'rt-hint';

  function onKeyDown(event) {
    const dir = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (!dir || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const attr = document.activeElement?.getAttribute?.('data-i');
    const from = attr == null ? currentIndex : Number(attr);
    const to = stepIndex(segments, from, dir);
    if (to < 0) return;
    event.preventDefault();
    onGo(to, { keepFocus: true });
    // The step moves the page to that mistake; keep the keys where the student left them.
    requestAnimationFrame(() => document.querySelector(`.rt__seg[data-i="${to}"]`)?.focus({ preventScroll: true }));
  }

  return (
    // .rt and .rt__head are plain boxes with no role, so a layout may dissolve them (display: contents): one row on
    // wide screens, and on phones only the count line sticks while the track scrolls with the page (repair-run.css).
    <div className="rt">
      <div className="rt__head">
        <p className="rt__count" role="status" aria-live="polite">{RUN_COPY.progress(currentIndex + 1, n)}</p>
        {onFinish ? <button type="button" className="rt__finish" onClick={onFinish}>{RUN_COPY.finishForNow}</button> : null}
      </div>
      <div className="rt__group" role="group" aria-label={RUN_COPY.trackLabel} aria-describedby={hintId}>
      <ol className="rt__track" onKeyDown={onKeyDown}>
        {segments.map((s, i) => {
          const tappable = canGoTo(segments, i);
          return (
            <li key={s.id}>
              <button type="button" className="rt__seg" data-i={i} data-state={s.state} data-current={s.current || undefined}
                aria-label={segmentLabel(segments, i)} aria-current={s.current ? 'step' : undefined}
                aria-disabled={tappable ? undefined : true} tabIndex={tappable ? 0 : -1}
                title={tappable ? RUN_COPY.trackGo : undefined}
                onClick={() => { if (tappable && !s.current) onGo(i, { keepFocus: true }); }}>
                <i className="rt__bar" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      </div>
      <span id={hintId} className="rt-sr">{RUN_COPY.trackHint}</span>
    </div>
  );
}
