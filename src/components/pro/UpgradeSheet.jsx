"use client";

// The Upgrade sheet (owner D79 to D81): what Pro adds, said from the student's own record, the price as offer.js frames it,
// one lime key into the existing checkout (/pricing#plans) and Not now.
//
// A native modal <dialog>: the page behind is inert, Tab stays inside, Escape and a press on the scrim close it, and focus
// goes back to whatever opened it. Under 640 px it is a bottom sheet that rises (300 ms ease-out); from 640 px a centred
// dialog that settles in (220 ms). Reduced motion: a 150 ms fade, no movement. The sheet's key is the only lime in view
// (the page behind sits under the scrim).
import Link from 'next/link';
import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { CHECKOUT_HREF, benefitLines, keyLabel, sheetHead, sheetPrice } from '@/lib/proNudge.mjs';

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

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

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function UpgradeSheet({ open = false, trigger = 'generic', facts = {}, offer = null, onClose = () => {}, onGetPro = () => {}, returnFocus = null, linkFor = (href) => href }) {
  const dialog = useRef(null);
  const closing = useRef(false);
  const titleId = useId();
  const head = sheetHead(trigger);
  const lines = benefitLines(trigger, facts);
  const price = sheetPrice(offer);

  const finish = useCallback(() => {
    const el = dialog.current;
    if (el?.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
    onClose();
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
    const back = returnFocus;
    closing.current = false;
    el.dataset.state = 'open';
    if (!el.open) { try { el.showModal(); } catch { el.setAttribute('open', ''); } }
    el.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    animateIn(el);
    return () => { if (back?.isConnected && back.getClientRects().length) back.focus?.({ preventScroll: true }); };
  }, [open, returnFocus]);

  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return undefined;
    const onCancel = (event) => { event.preventDefault(); requestClose(); };
    const onNativeClose = () => { if (!closing.current) { closing.current = true; onClose(); } };
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

  if (!open) return null;

  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) requestClose();
  };

  return (
    <dialog ref={dialog} className="pn-sheet" aria-labelledby={titleId} data-trigger={trigger} onClick={onDialogClick}>
      <span className="pn-handle" aria-hidden="true" />
      <button type="button" className="pn-close mk-press" aria-label="Close" onClick={requestClose}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
      <div className="pn-body">
        <h2 id={titleId} className="pn-title">{head.title}</h2>
        <p className="pn-lede">{head.lede}</p>
        <ul className="pn-benefits" aria-label="What Pro adds">
          {lines.map((line) => (
            <li key={line.id} data-personal={line.personal || undefined}>
              <Check size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
        <div className="pn-foot">
          {price ? (
            <p className="pn-price"><b>{price.figure}</b> <span className="pn-price__cycle">{price.cycle}</span><span className="pn-price__terms">{price.terms}</span></p>
          ) : (
            <p className="pn-price"><span className="pn-price__terms">The price shows on the next page, before any payment.</span></p>
          )}
          <div className="pn-actions">
            <Link className="btn-volt pn-go mk-press" href={linkFor(CHECKOUT_HREF)} data-pro-checkout="" data-autofocus="" onClick={() => { onGetPro(); requestClose(); }}>{keyLabel(offer)}</Link>
            <button type="button" className="pn-later mk-press" onClick={requestClose}>Not now</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
