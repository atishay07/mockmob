"use client";

// What a tap on a badge opens (BADGES-REFINE-1018 section 2): a popover beside the medal on a desktop, a bottom
// sheet on a phone. One layer, never a modal page: Escape and a tap outside close it, focus moves in and goes
// back to the medal that opened it. The body is plain words from lib/badgeShelf.js detailOf(): the condition,
// when it was earned and the paper it came from, or the count so far, and the next step on the same path.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, X } from 'lucide-react';
import { Medal } from '@/components/Medal';

const CLOSE_MS = 160;
const POPOVER_W = 340;

const LayerContext = createContext(() => {});
/** The layer's own close (with its short exit and the focus return), for whatever is drawn inside it. */
export const useLayerClose = () => useContext(LayerContext);

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The layer itself. `anchor` is the medal (or row) that opened it: the popover stands beside it, and focus returns to it.
 * `wide` picks the popover; otherwise it is the sheet. Closing plays a short exit, then calls `onClosed`.
 */
export function BadgeLayer({ anchor, wide, label, onClose, children, tall = false, viewKey = '' }) {
  const panel = useRef(null);
  const [place, setPlace] = useState(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const close = useCallback((refocus = true) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced';
    window.setTimeout(() => {
      onCloseRef.current?.();
      if (refocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
    }, reduced ? 0 : CLOSE_MS);
  }, [anchor]);

  // The popover stands under the medal, or above it when there is no room below, kept inside the window.
  useLayoutEffect(() => {
    if (!wide) return undefined;
    const fit = () => {
      const el = panel.current;
      if (!el || !anchor?.isConnected) return;
      const a = anchor.getBoundingClientRect();
      const h = el.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const left = Math.max(12, Math.min(a.left + a.width / 2 - POPOVER_W / 2, vw - POPOVER_W - 12));
      const below = a.bottom + 8;
      const top = below + h > window.innerHeight - 12 && a.top - 8 - h > 12 ? a.top - 8 - h : below;
      setPlace({ left: Math.round(left + window.scrollX), top: Math.round(top + window.scrollY) });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [wide, anchor, children]);

  // The sheet holds the page still behind it.
  useEffect(() => {
    if (wide) return undefined;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = before; };
  }, [wide]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const first = panel.current?.querySelector('[data-first]') || panel.current?.querySelector(FOCUSABLE);
      first?.focus({ preventScroll: true });
    });
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key !== 'Tab') return;
      const list = [...(panel.current?.querySelectorAll(FOCUSABLE) || [])];
      if (!list.length) return;
      const at = list.indexOf(document.activeElement);
      event.preventDefault();
      list[(at + (event.shiftKey ? -1 : 1) + list.length) % list.length]?.focus();
    };
    const onPointer = (event) => {
      if (panel.current?.contains(event.target) || anchor?.contains(event.target)) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    if (wide) document.addEventListener('pointerdown', onPointer);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [anchor, close, wide]);

  // A new view in the same layer (all badges, then one badge) puts focus on its first control.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const frame = requestAnimationFrame(() => (panel.current?.querySelector('[data-first]') || panel.current?.querySelector(FOCUSABLE))?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [viewKey]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {wide ? null : <div className="sb-scrim" data-closing={closing ? '' : undefined} onClick={() => close(true)} aria-hidden="true" />}
      <div
        ref={panel}
        className="sb-layer"
        data-mode={wide ? 'popover' : 'sheet'}
        data-tall={tall ? 'true' : undefined}
        data-closing={closing ? '' : undefined}
        role="dialog"
        aria-modal={wide ? undefined : 'true'}
        aria-label={label}
        style={wide ? (place ? { left: place.left, top: place.top, width: POPOVER_W } : { visibility: 'hidden', width: POPOVER_W }) : undefined}
      >
        <LayerContext.Provider value={close}>{children}</LayerContext.Provider>
      </div>
    </>,
    document.body,
  );
}

/** The words of one badge (lib/badgeShelf.js detailOf), as the layer's body. */
export function BadgeDetailBody({ detail, onClose, onBack, backLabel }) {
  const d = detail;
  const status = d.earned ? 'earned' : d.unknown ? 'later' : 'next';
  return (
    <div className="sb-detail">
      <div className="sb-detail__top">
        <Medal id={d.id} status={status} size="xl" />
        <div className="sb-detail__title">
          <p className="sb-detail__path">{d.pathTitle}</p>
          <h3>{d.name}</h3>
        </div>
        <button type="button" className="sb-detail__close" onClick={onClose} aria-label="Close" data-first=""><X size={18} strokeWidth={2} aria-hidden="true" /></button>
      </div>

      <p className="sb-detail__condition">{d.condition}</p>

      {d.earned ? (
        <div className="sb-detail__block">
          <p className="sb-detail__strong">{d.earnedLine}</p>
          {d.paper ? (
            <>
              <p>{d.paper.from}</p>
              {d.paper.marks ? <p className="sb-detail__quiet">{d.paper.marks}</p> : null}
              <p><Link className="sb-link" href={`/result/${d.paper.attemptId}`}>Open that paper</Link></p>
            </>
          ) : null}
        </div>
      ) : d.unknown ? (
        <div className="sb-detail__block"><p>{d.unknownLine}</p></div>
      ) : (
        <div className="sb-detail__block">
          <p className="sb-detail__label">Not earned yet</p>
          {d.soFar ? <p className="sb-detail__strong">{d.soFar}</p> : null}
        </div>
      )}

      {d.next ? (
        <div className="sb-detail__block sb-detail__next">
          <p className="sb-detail__label">{d.next.kind === 'also' ? 'Also on this path' : `Next on ${d.pathTitle}`}</p>
          <p><b>{d.next.name}</b></p>
          <p>{d.next.more ? `${d.next.more}, ${d.next.short} so far.` : d.next.condition}</p>
        </div>
      ) : d.pathDone ? (
        <div className="sb-detail__block"><p>Every badge on {d.pathTitle} is earned.</p></div>
      ) : null}

      {!d.unknown && (d.next || !d.earned) ? <Link className="sb-btn" href={d.action.href}>{d.action.label}</Link> : null}
      {onBack ? <button type="button" className="sb-detail__back" onClick={onBack}><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />{backLabel}</button> : null}
    </div>
  );
}

