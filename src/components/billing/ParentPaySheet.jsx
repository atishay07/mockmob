'use client';

// "Ask a parent to pay" (lane F-B, 15 Nov 2026): the small sheet that makes the student's link and sends it. It asks the server
// for Razorpay's own hosted link for the student's monthly checkout (/api/billing/parent-link), then offers WhatsApp (the volt
// key) and Copy link. States: making the link, the link, failed (with a retry when one can help), already Pro, and a payment
// being confirmed. Nothing here ever says Pro is on: the webhook turns it on after the parent pays, and the next visit shows it.
//
// A native modal <dialog>, like the Upgrade sheet: the page behind is inert, Tab stays inside, Escape and a press on the scrim
// close it, focus goes back to the key that opened it. Under 640 px a bottom sheet that rises (300 ms ease-out), from 640 px a
// centred dialog (220 ms). Reduced motion: a 150 ms fade. Its words and decisions: parentPayModel.mjs.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Loader2, ShieldCheck, X } from 'lucide-react';
import { PARENT_PAY_COPY as COPY, linkUntil, parentMessage, previewParentReply, sheetStateFor, whatsappHref } from './parentPayModel.mjs';
import './parent-pay.css';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

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
 * @param {object} props
 * @param {boolean} props.open
 * @param {(kind: string) => void} props.onClose  called once the sheet has closed, with the state it closed in ('pro' means the
 *   account turned out to have Pro, so the page behind may refresh)
 * @param {HTMLElement|null} props.returnFocus
 * @param {number} props.rupees  the offer's monthly price, shown until the server's own amount arrives
 * @param {string} props.goClass  the page's own volt key class (the same key as Get Pro beside it)
 * @param {string|null} props.fixture  development previews only: a parentPayModel previewParentReply kind instead of the server
 */
export default function ParentPaySheet({ open = false, onClose = () => {}, returnFocus = null, rupees = 99, goClass = 'btn-volt', fixture = null }) {
  const dialog = useRef(null);
  const closing = useRef(false);
  const request = useRef(0);
  const copyTimer = useRef(0);
  const linkField = useRef(null);
  const titleId = useId();
  const lineId = useId();
  const [state, setState] = useState({ kind: 'making' });
  const [copied, setCopied] = useState('idle');
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState({ kind: 'making' });
    setCopied('idle');
    let next;
    if (fixture) {
      const reply = previewParentReply(fixture);
      if (!reply) return;
      await new Promise((resolve) => { window.setTimeout(resolve, 700); });
      next = sheetStateFor(reply.status, reply.body);
    } else {
      try {
        const response = await fetch('/api/billing/parent-link', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
        next = sheetStateFor(response.status, await response.json().catch(() => null));
      } catch {
        next = sheetStateFor(0, null);
      }
    }
    if (request.current === id) setState(next);
  }, [fixture]);

  const finish = useCallback(() => {
    const el = dialog.current;
    if (el?.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
    onClose(stateRef.current.kind);
  }, [onClose]);

  const requestClose = useCallback(() => {
    const el = dialog.current;
    if (!el || closing.current) return;
    closing.current = true;
    request.current += 1;
    el.dataset.state = 'closing';
    animateOut(el).then(finish);
  }, [finish]);

  useLayoutEffect(() => {
    const el = dialog.current;
    if (!open || !el) return undefined;
    const back = returnFocus;
    closing.current = false;
    el.dataset.state = 'open';
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    el.querySelector('.pp-close')?.focus({ preventScroll: true });
    animateIn(el);
    return () => { if (back?.isConnected && back.getClientRects().length) back.focus?.({ preventScroll: true }); };
  }, [open, returnFocus]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(load, 0);
    return () => { window.clearTimeout(t); request.current += 1; };
  }, [open, load]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return undefined;
    const onCancel = (event) => { event.preventDefault(); requestClose(); };
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClose(stateRef.current.kind); } };
    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.getClientRects().length > 0 && !n.disabled);
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

  if (!open) return null;

  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) requestClose();
  };

  const copyLink = async () => {
    if (state.kind !== 'ready') return;
    window.clearTimeout(copyTimer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(state.url);
      setCopied('done');
      copyTimer.current = window.setTimeout(() => setCopied('idle'), 2500);
    } catch {
      setCopied('failed');
      try { linkField.current?.focus({ preventScroll: true }); linkField.current?.select(); } catch { /* nothing to select */ }
    }
  };

  const price = state.kind === 'ready' && state.rupees ? state.rupees : rupees;
  const until = state.kind === 'ready' ? linkUntil(state.expiresAt) : null;
  const title = state.kind === 'pro' ? COPY.proTitle : state.kind === 'held' ? COPY.heldTitle : state.kind === 'failed' ? COPY.failedTitle : COPY.title;
  const message = state.kind === 'ready'
    ? whatsappHref(parentMessage({ url: state.url, firstName: state.firstName, rupees: price, expiresAt: state.expiresAt }))
    : null;

  return (
    <dialog ref={dialog} className="pp-sheet" aria-labelledby={titleId} aria-describedby={lineId} data-kind={state.kind} onClick={onDialogClick}>
      <span className="pp-handle" aria-hidden="true" />
      <div className="pp-body">
        <div className="pp-top">
          <h2 id={titleId} className="pp-title">{title}</h2>
          <button type="button" className="pp-close" aria-label={COPY.close} onClick={requestClose}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>

        {state.kind === 'making' || state.kind === 'ready' ? (
          <>
            <p id={lineId} className="pp-line">{COPY.line(price)}</p>
            {state.kind === 'ready' ? (
              <input
                ref={linkField}
                className="pp-link"
                type="text"
                readOnly
                value={state.url}
                aria-label={COPY.linkLabel}
                onFocus={(event) => event.currentTarget.select()}
              />
            ) : (
              <span className="pp-link" data-pending="" aria-hidden="true">{COPY.making}</span>
            )}
            <p className="pp-until">{until ? COPY.until(until) : ''}</p>
          </>
        ) : (
          <>
            <p id={lineId} className="pp-msg" data-tone={state.kind === 'failed' ? 'bad' : 'good'} role={state.kind === 'failed' ? 'alert' : 'status'}>
              {state.kind === 'failed' ? <AlertCircle aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
              <span>{state.message}</span>
            </p>
          </>
        )}
        <p className="pp-sr" role="status" aria-live="polite">
          {state.kind === 'making' ? COPY.making : state.kind === 'ready' ? (copied === 'done' ? COPY.copied : copied === 'failed' ? COPY.copyFailed : '') : ''}
        </p>
        {state.kind === 'ready' && copied === 'failed' ? <p className="pp-msg" data-tone="bad"><AlertCircle aria-hidden="true" /><span>{COPY.copyFailed}</span></p> : null}
      </div>

      <div className="pp-foot">
        {state.kind === 'making' ? (
          <>
            <button type="button" className={`${goClass} pp-go`} disabled aria-disabled="true">
              <Loader2 className="pp-spin" aria-hidden="true" />{COPY.making}
            </button>
            <button type="button" className="pp-quiet" disabled><Copy aria-hidden="true" />{COPY.copy}</button>
          </>
        ) : state.kind === 'ready' ? (
          <>
            <a className={`${goClass} pp-go`} href={message} target="_blank" rel="noopener noreferrer">{COPY.whatsapp}</a>
            <button type="button" className="pp-quiet" onClick={copyLink} data-done={copied === 'done' ? '' : undefined}>
              {copied === 'done' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied === 'done' ? COPY.copied : COPY.copy}
            </button>
          </>
        ) : state.kind === 'failed' && state.retry ? (
          <>
            <button type="button" className={`${goClass} pp-go`} onClick={load}>{COPY.retry}</button>
            <button type="button" className="pp-quiet" onClick={requestClose}>{COPY.close}</button>
          </>
        ) : (
          <button type="button" className={`${goClass} pp-go`} onClick={requestClose}>{state.kind === 'pro' ? COPY.done : COPY.close}</button>
        )}
      </div>
    </dialog>
  );
}
