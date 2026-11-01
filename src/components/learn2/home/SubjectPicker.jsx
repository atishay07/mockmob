'use client';
// Learn home's phone subject picker (R3 ruling R1): one row with the subject's object, its name and a chevron; a tap opens the
// student's subjects as a bottom sheet. It replaces the sideways strip below 768 px (SubjectShelf keeps the tablet and desktop tabs).
// The sheet is a dialog: focus moves in and stays inside, Escape and a tap on the scrim close it, focus returns to the row. It is drawn
// in a portal on <body> (the page is a size container, which would pin a fixed sheet to the page, not the screen). The scrim is the
// page's own background colour at about 60%: tinted in Day, deep in Night, never a grey wash (R3 ruling L7). Motion: the sheet rises
// 240 ms, the scrim fades 200 ms; reduced motion lands at once.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';
import { SubjectObject } from '@/components/brand/SubjectObject';
import { displayTitle } from './homeModel.mjs';

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
/** "Economics / Business Economics" reads as "Economics" in a row (the whole name is the sheet row's label). */
const shortName = (name) => displayTitle(String(name || '').split(' / ')[0]);

function PickerSheet({ subjects, current, onPick, onClose }) {
  const ref = useRef(null);
  const title = useId();
  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement;
    const first = el?.querySelector('[aria-pressed="true"]') || el?.querySelector(FOCUSABLE) || el;
    try { first?.focus({ preventScroll: true }); } catch { /* an old browser */ }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !el) return;
      const all = [...el.querySelectorAll(FOCUSABLE)];
      if (!all.length) return;
      const a = all[0];
      const z = all[all.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      try { if (opener?.isConnected) opener.focus({ preventScroll: true }); } catch { /* gone */ }
    };
  }, [onClose]);
  return createPortal(
    <div className="lh-psheet">
      <div className="lh-psheet__scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="lh-psheet__panel" role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1}>
        <div className="lh-psheet__head">
          <h2 id={title}>Choose a subject</h2>
          <button type="button" className="lh-psheet__x" aria-label="Close" onClick={onClose}><X size={20} strokeWidth={2.2} aria-hidden="true" /></button>
        </div>
        <ul className="lh-psheet__list" aria-labelledby={title}>
          {subjects.map((s) => (
            <li key={s.id}>
              <button type="button" aria-pressed={s.id === current} className="lh-psheet__row" aria-label={displayTitle(s.name)} onClick={() => { onPick(s.id); onClose(); }}>
                <SubjectObject id={s.id} size={40} className="lh-psheet__obj" />
                <span className="lh-psheet__name">{shortName(s.name)}</span>
                {s.id === current ? <Check className="lh-psheet__check" size={20} strokeWidth={2.4} aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export default function SubjectPicker({ subjects, current, onPick, busy = false }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!subjects.length) return null;
  const now = subjects.find((s) => s.id === current) || subjects[0];
  const many = subjects.length > 1;
  return (
    <div className="lh-picker" data-busy={busy || undefined}>
      <button type="button" className="lh-picker__btn" aria-haspopup={many ? 'dialog' : undefined} aria-expanded={many ? open : undefined}
        aria-label={many ? `Subject: ${displayTitle(now.name)}. Change subject` : `Subject: ${displayTitle(now.name)}`} disabled={!many} onClick={() => setOpen(true)}>
        <SubjectObject id={now.id} size={40} className="lh-picker__obj" />
        <span className="lh-picker__name">{shortName(now.name)}</span>
        {many ? <ChevronDown className="lh-picker__chev" size={20} strokeWidth={2.2} aria-hidden="true" /> : null}
      </button>
      {open ? <PickerSheet subjects={subjects} current={now.id} onPick={onPick} onClose={close} /> : null}
    </div>
  );
}
