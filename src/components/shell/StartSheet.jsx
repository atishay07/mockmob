"use client";

// The Start sheet (plan 2.1, 2.2; DOCK.md 6). IA1.
//
// At most 5 rows: the hero (Resume, or Tonight's move), Quick 10 with subject chips, Full mock, NTA
// mode (Pro tag), Repair the next mistake. A row opens a confirm line with a Start button, for
// example "10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice credits."
// Nothing is spent on the first tap, or on the second: Start goes to Practice set up for that
// session, where the existing confirm step charges. The hero opens with its confirm line showing, so
// the sheet has one primary at a time.
//
// A native modal <dialog>: the page behind is inert (focus stays in the sheet), Esc and a press on
// the scrim close it, and focus returns to the Start key that opened it. The key morphs into the
// sheet in 280 ms ease-out (plan 7); with reduced motion it fades in 150 ms. Glass on the sheet only,
// solid where backdrop-filter is missing.
//
// Props (the IA0 contract, extended):
//   onClose          () => void, after the sheet has closed (Esc, scrim, Close, or a row's Start)
//   rows             sheetRows() from ./shellModel.mjs (startActions() rows plus the chip subject)
//   footer           START_SHEET_FOOTER ({ label: 'Choose your own in Practice', href })
//   initialRow       the row to open with its confirm line (/start?row=quick), else the hero
//   returnFocusRef   the Start key that opened the sheet; it gets focus back on close
//   heroLoading      true while Tonight's move is being worked out (a placeholder keeps its place)
//   onSelectSubject  (subjectId) => void, the Quick 10 chips (the host passes the chosen subject
//                    back through sheetRows(), and Full mock follows it)
//   linkFor          (href) => href, so the development preview keeps links inside the preview
import Link from 'next/link';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { morphFrom } from './shellModel.mjs';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

function animateIn(el, key) {
  if (typeof el.animate !== 'function') return;
  if (reducedMotion()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' }); return; }
  const morph = morphFrom(key?.getBoundingClientRect?.(), el.getBoundingClientRect());
  if (!morph) { el.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE_OUT }); return; }
  el.animate([{ transform: morph.transform, opacity: 0.92 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: EASE_OUT });
  // The volt of the key gives way to the sheet over the first third, then the rows arrive.
  el.querySelector('.sh-sheet__volt')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, easing: 'ease-out' });
  el.querySelector('.sh-sheet__body')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, delay: 90, easing: EASE_OUT, fill: 'backwards' });
}

function animateOut(el, key) {
  if (typeof el.animate !== 'function' || reducedMotion()) return Promise.resolve();
  const morph = morphFrom(key?.getBoundingClientRect?.(), el.getBoundingClientRect());
  const to = morph ? { transform: morph.transform, opacity: 0 } : { transform: 'translateY(16px)', opacity: 0 };
  const run = el.animate([{ transform: 'none', opacity: 1 }, to], { duration: 200, easing: EASE_OUT, fill: 'forwards' });
  return run.finished.catch(() => {});
}

export default function StartSheet({ open = false, onClose = () => {}, rows = [], footer = null, initialRow = null, returnFocusRef = null,
  heroLoading = false, onSelectSubject = null, linkFor = (href) => href }) {
  const dialog = useRef(null);
  const closing = useRef(false);
  const keyRef = useRef(null); // the Start key this sheet grew from, kept for the closing morph
  const [active, setActive] = useState(initialRow ?? 'auto');
  const titleId = useId();
  const current = active === 'auto' ? (rows[0]?.hero ? rows[0].id : null) : active;

  // Opens as a modal when mounted open; the key it grew from gets focus back when it goes.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!open || !el) return undefined;
    const key = returnFocusRef?.current || null;
    keyRef.current = key;
    if (!el.open) {
      try { el.showModal(); } catch { el.setAttribute('open', ''); }
    }
    el.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    animateIn(el, key);
    return () => { key?.focus?.({ preventScroll: true }); };
  }, [open, returnFocusRef]);

  const finish = useCallback(() => {
    const el = dialog.current;
    if (el?.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    const el = dialog.current;
    if (!el || closing.current) return;
    closing.current = true;
    el.dataset.closing = 'true';
    animateOut(el, keyRef.current).then(finish);
  }, [finish]);

  // Esc: the dialog's cancel event, animated. A second fast Esc may close it natively: stay in step.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    const onCancel = (event) => { event.preventDefault(); requestClose(); };
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClose(); } };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    return () => { el.removeEventListener('cancel', onCancel); el.removeEventListener('close', onNativeClose); };
  }, [requestClose, onClose]);

  if (!open) return null;

  // A press on the scrim lands on the <dialog> itself, outside its box.
  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) requestClose();
  };
  // Following a link: close at once, the next page is the feedback.
  const closeNow = () => { closing.current = true; finish(); };

  return (
    <dialog ref={dialog} id="start-sheet" className="sh-sheet" aria-labelledby={titleId} onClick={onDialogClick}>
      <span className="sh-sheet__volt" aria-hidden="true" />
      <div className="sh-sheet__body">
        <div className="sh-sheet__head">
          <h2 id={titleId} className="sh-sheet__title">Start</h2>
          <button type="button" className="sh-sheet__close" aria-label="Close" onClick={requestClose}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
        <ul className="sh-sheet__rows">
          {heroLoading ? (
            <li className="sh-row sh-row--hero sh-row--loading" aria-busy="true"><span className="sr-only">Working out tonight&apos;s move</span></li>
          ) : null}
          {rows.map((row, index) => {
            const isOpen = current === row.id;
            const confirmId = `${titleId}-${row.id}`;
            const heroMove = row.hero && row.id === 'move';
            return (
              <li key={row.id} className={`sh-row${row.hero ? ' sh-row--hero' : ''}`} data-row={row.id} data-open={isOpen || undefined}>
                <button type="button" className="sh-row__head" aria-expanded={isOpen} aria-controls={confirmId}
                  data-autofocus={index === 0 ? '' : undefined} onClick={() => setActive(isOpen ? null : row.id)}>
                  <span className="sh-row__text">
                    {heroMove && row.detail ? <span className="sh-row__over">{row.detail}</span> : null}
                    <span className="sh-row__title">{row.label}{row.tag ? <span className="sh-tag">{row.tag}</span> : null}</span>
                    {!heroMove && row.detail ? <span className="sh-row__detail">{row.detail}</span> : null}
                  </span>
                  <ChevronDown className="sh-row__chev" size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <div id={confirmId} className="sh-row__confirm" hidden={!isOpen}>
                  {row.id === 'quick' && row.chips?.length > 1 ? (
                    <fieldset className="sh-chips">
                      <legend className="sr-only">Subject</legend>
                      {row.chips.map((chip) => (
                        <label key={chip.id} className="sh-chip-radio">
                          <input type="radio" name={`${titleId}-subject`} value={chip.id} checked={(row.subject || row.chips[0].id) === chip.id}
                            onChange={() => onSelectSubject?.(chip.id)} />
                          <span>{chip.label}</span>
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  {row.confirm ? <p className="sh-row__line">{row.subjectLabel ? `${row.subjectLabel}. ` : ''}{row.confirm}</p> : null}
                  <Link className="sh-row__go" href={linkFor(row.href)} onClick={closeNow}>{row.cta || 'Start'}</Link>
                </div>
              </li>
            );
          })}
        </ul>
        {footer ? <Link className="sh-sheet__foot" href={linkFor(footer.href)} onClick={closeNow}>{footer.label}</Link> : null}
      </div>
    </dialog>
  );
}
