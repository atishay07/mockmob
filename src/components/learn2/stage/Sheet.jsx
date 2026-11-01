'use client';
// Sheets over the study stage: a phone bottom sheet; from 768 px a 400 px dialog in the middle (StopSheet), or always a
// bottom sheet (`bottom`). Focus moves in and is kept inside, Escape and a tap outside close it, focus returns to the opener.
//   <Sheet title onClose bottom labelledBy>{children}</Sheet>
//   <StopSheet done of detail endLabel onEnd onKeepGoing onLeave />
//                                                    The one stop rule of the feed and the run (critic 2 row 9; A4 3.3.10): after
//                                                    at least one item Close and Escape open it. It says what was done (done of
//                                                    of, then detail), then Stop here (volt; shows the end), Keep going (line),
//                                                    Leave for now, pick up later today (text). No guilt copy. Escape closes it only.
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Sheet({ title, onClose, bottom = false, children, closeLabel = 'Close' }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector('[data-autofocus]') || el?.querySelector(FOCUSABLE) || el;
    try { first?.focus({ preventScroll: true }); } catch { /* old browser */ }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose?.(); return; }
      if (e.key !== 'Tab' || !el) return;
      const all = [...el.querySelectorAll(FOCUSABLE)];
      if (!all.length) return;
      const a = all[0]; const z = all[all.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      try { if (opener?.isConnected) opener.focus({ preventScroll: true }); } catch { /* gone */ }
    };
  }, [onClose]);
  return (
    <>
      <div className="st-scrim" onClick={onClose} data-pager-ignore="" aria-hidden="true" />
      <div ref={ref} className={`st-drawer${bottom ? ' st-drawer--bottom' : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} tabIndex={-1} data-pager-ignore="">
        <div className="st-drawer__head">
          <h2 className="st-drawer__title" id={`${id}-t`}>{title}</h2>
          <button type="button" className="st-iconkey" aria-label={closeLabel} onClick={onClose}><X size={20} strokeWidth={2.2} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </>
  );
}

export function StopSheet({ done = 0, of = 0, detail = null, endLabel = 'End here, see how it went', onEnd, onKeepGoing, onLeave }) {
  return (
    <Sheet title="Stop for now?" onClose={onKeepGoing} closeLabel="Keep going">
      <p className="st-drawer__line">{of ? `${done} of ${of} done. ` : ''}{detail ? `${detail} ` : ''}Everything you did is saved.</p>
      <div className="st-drawer__keys">
        <button type="button" className="kc-btn kc-btn--volt" onClick={onEnd} data-autofocus="">{endLabel}</button>
        <button type="button" className="kc-btn kc-btn--line" onClick={onKeepGoing}>Keep going</button>
        {onLeave ? <button type="button" className="st-textkey" onClick={onLeave}>Leave for now, pick up later today</button> : null}
      </div>
    </Sheet>
  );
}
