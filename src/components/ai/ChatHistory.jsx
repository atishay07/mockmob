"use client";

// History (16 Nov 2026): the saved exchanges the page used to list as "Your recent questions" (mentorHistory.mjs, GET
// /api/ai/mentor/history), opened from the History key in the page's head. On a phone it is a sheet over the chat; on a wide
// screen a quiet column to the right of the chat, away from the app's own rail. A row opens that exchange in the thread, read
// as it was. Nothing here deletes anything.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clockStamp } from './askDoors.mjs';
import { CHAT_COPY, savedCost } from './chatCopy.mjs';

function Rows({ rows, current, onOpen }) {
  if (rows === null) return <p className="ahs-quiet" role="status">{CHAT_COPY.historyReading}</p>;
  if (!rows.length) return <p className="ahs-quiet">{CHAT_COPY.historyEmpty}</p>;
  return (
    <ul className="ahs-list">
      {rows.map((row) => (
        <li key={row.id}>
          <button type="button" className="ahs-row" aria-current={current === row.id ? 'true' : undefined} onClick={() => onOpen(row)}>
            <b>{row.ask}</b>
            <span>{[savedCost(row), clockStamp(row.at) ? `${clockStamp(row.at)}.` : null].filter(Boolean).join(' ')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The column beside the chat on a wide screen. */
export function HistoryColumn({ rows, current = null, onOpen, onClose }) {
  return (
    <aside className="ahs ahs--column" aria-label={CHAT_COPY.historyTitle}>
      <header className="ahs-head">
        <h2>{CHAT_COPY.historyTitle}</h2>
        <button type="button" className="ahs-close" onClick={onClose} aria-label={CHAT_COPY.historyClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <Rows rows={rows} current={current} onOpen={onOpen} />
    </aside>
  );
}

/** The sheet on a phone. It closes with its key, a tap outside or Escape, and gives focus back to the key that opened it. */
export function HistorySheet({ rows, current = null, onOpen, onClose }) {
  const sheet = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement;
    sheet.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); return; }
      if (event.key !== 'Tab') return;
      const controls = [...(sheet.current?.querySelectorAll('button:not(:disabled)') || [])];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  if (typeof document === 'undefined') return null;
  // Drawn at the top of the page (a portal), so the sheet covers the dock as the app's other sheets do.
  return createPortal(
    <div className="ahs-layer">
      <button type="button" className="ahs-scrim" tabIndex={-1} aria-label={CHAT_COPY.historyClose} onClick={onClose} />
      <section className="ahs ahs--sheet" role="dialog" aria-modal="true" aria-label={CHAT_COPY.historyTitle} tabIndex={-1} ref={sheet}>
        <header className="ahs-head">
          <h2>{CHAT_COPY.historyTitle}</h2>
          <button type="button" className="ahs-close" onClick={onClose} aria-label={CHAT_COPY.historyClose}><X size={20} aria-hidden="true" /></button>
        </header>
        <Rows rows={rows} current={current} onOpen={onOpen} />
      </section>
    </div>,
    document.body,
  );
}
