"use client";

// Report a problem with a question (T4, 15 Nov 2026), in the product's own sheet: the Upgrade sheet's frame
// (src/components/pro/UpgradeSheet.jsx, pro-nudge.css): a native modal <dialog>, a bottom sheet under 640 px that rises in
// 300 ms, a centred dialog from 640 px; the page behind is inert, Tab stays inside, Escape, Cancel and a press on the scrim
// close it, and focus goes back to the row's report link. Reduced motion: a 150 ms fade.
//
// Inside: what looks wrong as five radio rows, an optional short note (needed for Something else), one volt key "Send
// report". The sheet says thanks only after the server has said yes; a failure keeps the chosen reason and the note and
// says what to do. With the phone's keyboard open the sheet sits on top of it (the visual viewport's foot, as Ask Mobi's
// sheet does), its key stays in view, and the note scrolls into view inside the sheet.
// Words and the request: reportModel.mjs.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { NOTE_MAX, REPORT_COPY, REPORT_REASONS, checkReport, reportErrorLine, sentLine } from './reportModel.mjs';
import '@/components/pro/pro-nudge.css';
import './result-1115.css';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked, [tabindex]:not([tabindex="-1"])';

function reducedMotion() {
  try { return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
function phone() {
  try { return window.matchMedia('(max-width: 639px)').matches; } catch { return true; }
}
function animateIn(el) {
  if (typeof el.animate !== 'function') return;
  if (reducedMotion()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' }); return; }
  if (phone()) el.animate([{ transform: 'translate3d(0, 100%, 0)' }, { transform: 'translate3d(0, 0, 0)' }], { duration: 300, easing: EASE });
  else el.animate([{ opacity: 0, transform: 'translate3d(0, 8px, 0) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
}
function animateOut(el) {
  if (typeof el.animate !== 'function') return Promise.resolve();
  if (reducedMotion()) return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
  const frames = phone()
    ? [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(0, 100%, 0)' }]
    : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0, 6px, 0) scale(0.97)' }];
  return el.animate(frames, { duration: phone() ? 220 : 160, easing: EASE, fill: 'forwards' }).finished.catch(() => {});
}

/**
 * target   { qid, number, chapter } of the question being reported, or null when the sheet is closed
 * onSend   async ({ reason, note }) => the route's JSON body; throws what src/lib/fetcher.js throws
 * onSent   (qid) once the server has said yes
 * onClose  () when the sheet has gone
 */
export default function ReportSheet({ target = null, onSend, onSent, onClose }) {
  const open = Boolean(target);
  const dialog = useRef(null);
  const noteRef = useRef(null);
  const closing = useRef(false);
  const titleId = useId();
  const noteId = useId();
  const errorId = useId();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState('form'); // form | sending | sent
  const [problem, setProblem] = useState(null); // { field, line } | { field: 'send', line }
  const [sent, setSent] = useState(null);
  // A new question starts a fresh form: the page mounts the sheet with key={qid}.

  const finish = useCallback(() => {
    const el = dialog.current;
    if (el?.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
    onClose?.();
  }, [onClose]);

  const requestClose = useCallback(() => {
    const el = dialog.current;
    if (!el || closing.current) return;
    closing.current = true;
    el.dataset.state = 'closing';
    animateOut(el).then(finish);
  }, [finish]);

  useLayoutEffect(() => {
    const el = dialog.current;
    if (!open || !el) return undefined;
    const back = document.activeElement;
    closing.current = false;
    el.dataset.state = 'open';
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    el.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    animateIn(el);
    return () => { if (back?.isConnected && back.getClientRects().length) back.focus?.({ preventScroll: true }); };
  }, [open, target?.qid]);

  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return undefined;
    const onCancel = (event) => { event.preventDefault(); requestClose(); };
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClose?.(); } };
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    el.addEventListener('keydown', onKeyDown);
    return () => { el.removeEventListener('cancel', onCancel); el.removeEventListener('close', onNativeClose); el.removeEventListener('keydown', onKeyDown); };
  }, [open, requestClose, onClose]);

  // The phone's keyboard: the sheet sits on the visual viewport's foot and never grows past it (Ask Mobi's sheet does the same).
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!open || !el) return undefined;
    const vv = window.visualViewport;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
      el.style.setProperty('--rs-kb', `${kb}px`);
      el.style.setProperty('--rs-vh', `${Math.round(height)}px`);
      el.toggleAttribute('data-keyboard', kb > 80);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { vv?.removeEventListener('resize', update); vv?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [open]);

  if (!open) return null;

  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) requestClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (phase === 'sending') return;
    const check = checkReport({ reason, note });
    if (!check.ok) {
      setProblem(check);
      requestAnimationFrame(() => (check.field === 'note' ? noteRef.current : dialog.current?.querySelector('input[type="radio"]'))?.focus({ preventScroll: false }));
      return;
    }
    setProblem(null);
    setPhase('sending');
    try {
      const body = await onSend({ reason, note });
      setSent(sentLine(body));
      setPhase('sent');
      onSent?.(target.qid);
      requestAnimationFrame(() => dialog.current?.querySelector('[data-done]')?.focus({ preventScroll: true }));
    } catch (error) {
      setProblem({ field: 'send', line: reportErrorLine(error) });
      setPhase('form');
    }
  };

  const busy = phase === 'sending';
  const needNote = reason === 'other';
  const where = [target.number ? `Q${target.number}` : null, target.chapter || null].filter(Boolean).join(', ');

  return (
    <dialog ref={dialog} className="pn-sheet rs-sheet" aria-labelledby={titleId} onClick={onDialogClick}>
      <span className="pn-handle" aria-hidden="true" />
      {phase === 'sent' ? (
        <div className="rs-done" role="status">
          <div className="pn-top">
            <p className="pn-feature">{where}</p>
            <button type="button" className="pn-close mk-press" aria-label="Close" onClick={requestClose}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
          </div>
          <h2 id={titleId} className="pn-title rs-title">{sent}</h2>
          <div className="rs-done__keys">
            <button type="button" className="btn-outline md rs-done__key mk-press" data-done="" onClick={requestClose}>{REPORT_COPY.done}</button>
          </div>
        </div>
      ) : (
        <form className="rs-form" onSubmit={submit} noValidate>
          <div className="pn-body rs-body">
            <div className="pn-top">
              <p className="pn-feature">{where}</p>
              <button type="button" className="pn-close mk-press" aria-label="Close" onClick={requestClose}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
            </div>
            <h2 id={titleId} className="pn-title rs-title">{REPORT_COPY.title}</h2>
            <div className="rs-reasons" role="radiogroup" aria-labelledby={titleId} aria-describedby={problem?.field === 'reason' ? errorId : undefined}>
              {REPORT_REASONS.map((r, i) => (
                <label key={r.id} className="rs-reason" data-on={reason === r.id || undefined}>
                  <input type="radio" name="rs-reason" value={r.id} checked={reason === r.id} disabled={busy}
                    onChange={() => { setReason(r.id); if (problem?.field === 'reason' || (problem?.field === 'note' && r.id !== 'other')) setProblem(null); }}
                    {...(i === 0 ? { 'data-autofocus': '' } : {})} />
                  <span className="rs-reason__dot" aria-hidden="true" />
                  <span className="rs-reason__label">{r.label}</span>
                </label>
              ))}
            </div>
            <label className="rs-note" htmlFor={noteId}>{needNote ? REPORT_COPY.noteLabelNeeded : REPORT_COPY.noteLabel}</label>
            <textarea ref={noteRef} id={noteId} className="rs-note__field" rows={2} maxLength={NOTE_MAX} value={note} readOnly={busy}
              placeholder={REPORT_COPY.notePlaceholder} aria-invalid={problem?.field === 'note' || undefined}
              aria-describedby={problem?.field === 'note' ? errorId : undefined}
              onChange={(event) => { setNote(event.target.value); if (problem?.field === 'note') setProblem(null); }}
              onFocus={(event) => { const field = event.currentTarget; window.setTimeout(() => field.scrollIntoView?.({ block: 'nearest' }), 320); }} />
            {problem ? <p id={errorId} className="rs-problem" role="alert">{problem.line}</p> : null}
          </div>
          <div className="pn-foot rs-foot">
            <div className="pn-actions">
              <button type="submit" className="btn-volt pn-go mk-press" aria-busy={busy || undefined} data-busy={busy || undefined}>{busy ? REPORT_COPY.sending : REPORT_COPY.send}</button>
              <button type="button" className="pn-later mk-press" onClick={requestClose}>{REPORT_COPY.cancel}</button>
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}
