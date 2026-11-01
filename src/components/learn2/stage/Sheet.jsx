'use client';
// Sheets over the study stage: a phone bottom sheet; from 768 px a 400 px dialog in the middle (StopSheet), or always a
// bottom sheet (`bottom`). Focus moves in and is kept inside, Escape and a tap outside close it, focus returns to the opener.
//   <Sheet title onClose bottom labelledBy>{children}</Sheet>
//   <StopSheet done of endLabel onEnd onKeepGoing />
//                                                    The one stop rule of the feed and the run (critic 2 row 9; A4 3.3.10; R2
//                                                    ruling 6): after at least one item Close and Escape open it. "5 of 20 done.
//                                                    It's all saved.", then Stop here (volt; shows the end, the run stays open
//                                                    to pick up today) and a quiet "Back to it" (R4: "Keep going" is only
//                                                    the end's key). Escape and the X go back to it.
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { stopSheetLine } from './endModel.mjs';

/** The stop sheet's quiet key (R4 ui-correctness#18): it closes the sheet; "Keep going" names only the end's new 10 minutes. */
export const BACK_TO_IT = 'Back to it';

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

export function StopSheet({ done = 0, of = 0, endLabel = 'Stop here', onEnd, onKeepGoing }) {
  // R2 ruling 6: one line, two keys. Stop here shows the end and the run stays open to pick up today (the server keeps a
  // stopped run open), so the old third key "Leave for now, pick up later today" is gone. The X closes the sheet: back to it.
  return (
    <Sheet title="Stop for now?" onClose={onKeepGoing} closeLabel={BACK_TO_IT}>
      <p className="st-drawer__line">{stopSheetLine(done, of)}</p>
      <div className="st-drawer__keys">
        <button type="button" className="kc-btn kc-btn--volt" onClick={onEnd} data-autofocus="">{endLabel}</button>
        <button type="button" className="st-textkey st-textkey--line" onClick={onKeepGoing}>{BACK_TO_IT}</button>
      </div>
    </Sheet>
  );
}
