"use client";

// The guide (plan 3 step 10, D16): 4 stops (Today, Start, Practice, Review), skippable. It opens
// by itself once, at the first repair's ending, and never before the first question; You > Help
// replays it. It points at the place in whichever layout is showing (sidebar, rail or phone bar).
//
// The page behind is dimmed by one layer with a hole cut around the target (clip-path, so moving
// between stops is a transform-free shape change that reduced motion turns into a jump). The card
// is a modal dialog: focus moves into it, Tab stays inside, Esc closes it. No Mobi here: the page
// under the guide already has its one Mobi.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { GUIDE_STOPS, guideCardPlacement } from './shellModel.mjs';

function visibleTarget(name) {
  return [...document.querySelectorAll(`[data-tour="${name}"]`)].find((node) => {
    const rect = node.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    const style = window.getComputedStyle(node);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }) || null;
}

const PAD = 6;

export default function GuideTour({ open = false, startAt = 0, onClose = () => {} }) {
  const [step, setStep] = useState(() => Math.min(Math.max(0, Number(startAt) || 0), GUIDE_STOPS.length - 1));
  const [box, setBox] = useState(null);
  const card = useRef(null);
  const primary = useRef(null);
  const titleId = useId();
  const stop = GUIDE_STOPS[step];
  const last = step === GUIDE_STOPS.length - 1;

  // Measure the target after layout (and on resize or scroll). State is set from a frame callback.
  useLayoutEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = visibleTarget(stop.target);
        const r = node?.getBoundingClientRect() || null;
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const height = card.current?.getBoundingClientRect().height || 220;
        const hole = r ? { left: Math.max(0, r.left - PAD), top: Math.max(0, r.top - PAD), width: r.width + PAD * 2, height: r.height + PAD * 2 } : null;
        const placed = guideCardPlacement(hole ? { ...hole, right: hole.left + hole.width, bottom: hole.top + hole.height } : null, viewport, { width: 360, height });
        // The first placement lands without travel; later ones (the next stop, a resize) glide.
        setBox((prev) => ({ hole, viewport, card: placed, count: (prev?.count || 0) + 1 }));
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure); };
  }, [open, stop.target]);

  // Whatever had focus before the guide (You > Help's "Replay the guide") gets it back after.
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement;
    return () => { if (before && before !== document.body && before.isConnected) before.focus?.({ preventScroll: true }); };
  }, [open]);

  // Focus follows the step; Tab stays in the card; Esc closes.
  useEffect(() => {
    if (!open) return undefined;
    primary.current?.focus({ preventScroll: true });
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !card.current) return;
      const items = [...card.current.querySelectorAll('button:not([disabled])')];
      if (!items.length) return;
      const first = items[0];
      const end = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); end.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); first.focus(); }
      else if (!card.current.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, step, onClose]);

  if (!open) return null;
  const vp = box?.viewport || { width: 0, height: 0 };
  const h = box?.hole;
  const clip = h && vp.width
    ? `path(evenodd, 'M0 0H${vp.width}V${vp.height}H0Z M${h.left} ${h.top}H${h.left + h.width}V${h.top + h.height}H${h.left}Z')`
    : 'none';

  return (
    <div className="sh-guide" data-ready={box ? 'true' : undefined} data-moving={box?.count > 1 ? 'true' : undefined}>
      <div className="sh-guide__dim" style={{ clipPath: clip }} aria-hidden="true" />
      {h ? <div className="sh-guide__ring" aria-hidden="true" style={{ transform: `translate(${h.left}px, ${h.top}px)`, width: h.width, height: h.height }} /> : null}
      <div ref={card} className="sh-guide__card" role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={box ? { transform: `translate(${box.card.left}px, ${box.card.top}px)`, width: box.card.width } : { visibility: 'hidden' }}>
        <div className="sh-guide__top">
          <p className="sh-guide__count">{step + 1} of {GUIDE_STOPS.length}</p>
          <button type="button" className="sh-guide__close" aria-label="Skip the guide" onClick={onClose}><X size={18} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
        <h2 id={titleId} className="sh-guide__title">{stop.title}</h2>
        <p className="sh-guide__body">{stop.body}</p>
        <div className="sh-guide__actions">
          {step > 0 ? <button type="button" className="sh-guide__back" onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</button> : <button type="button" className="sh-guide__back" onClick={onClose}>Skip</button>}
          <button ref={primary} type="button" className="sh-guide__next" onClick={() => (last ? onClose() : setStep((s) => s + 1))}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
