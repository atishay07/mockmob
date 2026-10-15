"use client";

// The Start sheet: start a session in two taps, from anywhere in the signed-in site.
//
// What it holds, top to bottom: the subject the sessions are for (the student's own subjects, with
// their lit objects), the next move with its real reason (the same plan Today shows), then Quick 10,
// Full mock, NTA mode and Choose your own. Every row prints its cost against the student's balance.
// Nothing is spent here: a row opens Practice set up for that session, and Practice shows the exact
// set and its cost again before Start.
//
// A native modal <dialog>: the page behind is inert, Tab cycles inside it, Escape and a press on the
// scrim close it, focus returns to the key that opened it. Under 1024 px it is a bottom sheet that
// rises on a spring and follows a swipe down; from 1024 px it is a panel that grows out of the
// sidebar's Start key. Reduced motion: a 150 ms fade, no movement. Glass on the sheet only, with a
// solid fill where backdrop-filter is missing.
import Link from 'next/link';
import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { X, Lock, Check, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreditMark } from '@/components/ui/Glyph';
import { PipActor } from '@/components/brand/PipActor';
import { RowArt, SubjectObject } from './StartArt';
import { balanceLine, dragOffset, dragOutcome, springEasing, subjectName } from './startModel.mjs';
import { useSubjectRail } from './useSubjectRail';

const SETTLE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const SPRING_FALLBACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const springs = new Map();

function spring(zeta) {
  if (springs.has(zeta)) return springs.get(zeta);
  let value = SPRING_FALLBACK;
  try {
    const curve = springEasing({ zeta });
    if (window.CSS?.supports?.('animation-timing-function', curve)) value = curve;
  } catch { /* Older engines keep the cubic spring. */ }
  springs.set(zeta, value);
  return value;
}

function reducedMotion() {
  try {
    return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

function sheetLayout() {
  try { return window.matchMedia('(max-width: 1023px)').matches; } catch { return true; }
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked, [tabindex]:not([tabindex="-1"])';

function animateIn(el, key) {
  if (typeof el.animate !== 'function') return;
  if (reducedMotion()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    return;
  }
  if (sheetLayout()) {
    // Rises from the bar on a firm spring (the skirt under the sheet hides the small overshoot).
    el.animate([{ transform: 'translate3d(0, 100%, 0)' }, { transform: 'translate3d(0, 0, 0)' }], { duration: 420, easing: spring(0.8) });
  } else {
    // Grows out of the Start key: the origin sits level with the key, on the sheet's near edge.
    const k = key?.getBoundingClientRect?.();
    const box = el.getBoundingClientRect();
    if (k && box.height > 0) {
      const y = Math.min(Math.max(k.top + k.height / 2 - box.top, 0), box.height);
      el.style.transformOrigin = `0px ${Math.round(y)}px`;
    }
    el.animate([{ transform: 'translate3d(-14px, 0, 0) scale(0.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, easing: spring(0.72) });
  }
  // Then the contents arrive in reading order. The objects settle into their light by CSS
  // (start.css st-obj-in), so a new subject's objects settle the same way when they swap in.
  el.querySelectorAll('[data-rise]').forEach((node, i) => {
    node.animate([{ opacity: 0, transform: 'translate3d(0, 10px, 0)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 60 + i * 38, easing: SETTLE, fill: 'backwards' });
  });
}

function animateOut(el, fromDrag = null) {
  if (typeof el.animate !== 'function' || reducedMotion()) {
    if (typeof el.animate === 'function') return el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
    return Promise.resolve();
  }
  if (sheetLayout()) {
    const from = fromDrag === null ? 'translate3d(0, 0, 0)' : `translate3d(0, ${dragOffset(fromDrag)}px, 0)`;
    return el.animate([{ transform: from }, { transform: 'translate3d(0, 100%, 0)' }], { duration: fromDrag === null ? 240 : 200, easing: SETTLE, fill: 'forwards' }).finished.catch(() => {});
  }
  return el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate3d(-10px, 0, 0) scale(0.96)', opacity: 0 }], { duration: 180, easing: SETTLE, fill: 'forwards' }).finished.catch(() => {});
}

function CostLine({ cost }) {
  if (!cost) return null;
  const icon = cost.tone === 'locked' ? <Lock size={14} strokeWidth={2} aria-hidden="true" />
    : cost.tone === 'included' ? <Check size={14} strokeWidth={2.25} aria-hidden="true" />
      : <CreditMark kind="practice" size={15} />;
  return <span className="st-cost" data-tone={cost.tone}>{icon}<span>{cost.text}</span></span>;
}

export default function StartSheet({ open = false, onClose = () => {}, model, initialRow = null, returnFocus = null, linkFor = (href) => href }) {
  const dialog = useRef(null);
  const closing = useRef(false);
  const titleId = useId();
  const subjectsId = useId();
  const { hero = null, rows = [], choose = null, subjects = [], subject = null, pro = false, balance = null, planState = 'loading', selectSubject = () => {}, retry = () => {} } = model || {};
  const { railRef, edges: railEdges, step: railStep } = useSubjectRail(subject, open && subjects.length > 1);
  // Read once as the sheet opens, so a re-render never re-opens or re-animates it.
  const opening = useRef({ initialRow, returnFocus });
  useEffect(() => { opening.current = { initialRow, returnFocus }; }, [initialRow, returnFocus]);

  const finish = useCallback(() => {
    const el = dialog.current;
    if (el?.open) { try { el.close(); } catch { el.removeAttribute('open'); } }
    onClose();
  }, [onClose]);

  const requestClose = useCallback((fromDrag = null) => {
    const el = dialog.current;
    if (!el || closing.current) return;
    closing.current = true;
    el.dataset.state = 'closing';
    el.style.transform = '';
    animateOut(el, fromDrag).then(finish);
  }, [finish]);

  // Opens as a modal when mounted; the key it grew from gets focus back when it goes.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!open || !el) return undefined;
    const { initialRow: row, returnFocus: keyFor } = opening.current;
    const key = keyFor?.() || null;
    closing.current = false;
    el.dataset.state = 'open';
    if (!el.open) {
      try { el.showModal(); } catch { el.setAttribute('open', ''); }
    }
    const first = (row && el.querySelector(`[data-row="${row}"]`)) || el.querySelector('[data-autofocus]') || el.querySelector('.st-row');
    first?.focus({ preventScroll: true });
    if (row) first?.scrollIntoView?.({ block: 'nearest' });
    animateIn(el, key);
    return () => {
      const back = key?.isConnected && key.getClientRects().length ? key : opening.current.returnFocus?.();
      back?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Escape (the dialog's cancel event, animated), a native close, and Tab kept inside.
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
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !el.contains(active))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || !el.contains(active))) { event.preventDefault(); first.focus(); }
    };
    el.addEventListener('cancel', onCancel);
    el.addEventListener('close', onNativeClose);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('cancel', onCancel);
      el.removeEventListener('close', onNativeClose);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [open, requestClose, onClose]);

  // Swipe down to close (bottom sheet only). From the handle and header at any time; from the
  // contents only when they are scrolled to the top. Sideways drags (the subject chips) are left alone.
  useEffect(() => {
    const el = dialog.current;
    if (!el || !open) return undefined;
    const body = el.querySelector('.st-body');
    let g = null;
    const onStart = (event) => {
      if (!sheetLayout() || closing.current || event.touches.length !== 1) { g = null; return; }
      const t = event.touches[0];
      g = { x: t.clientX, y: t.clientY, dy: 0, dragging: false, grab: Boolean(event.target.closest?.('.st-grab')), samples: [] };
    };
    const onMove = (event) => {
      if (!g) return;
      const t = event.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (!g.dragging) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { g = null; return; }
        if (dy < -6) { g = null; return; }
        if (dy > 6 && (g.grab || (body?.scrollTop || 0) <= 0)) { g.dragging = true; el.dataset.drag = 'true'; } else return;
      }
      if (event.cancelable) event.preventDefault();
      g.dy = dy;
      g.samples.push({ y: t.clientY, t: event.timeStamp });
      if (g.samples.length > 5) g.samples.shift();
      el.style.transform = `translate3d(0, ${dragOffset(dy)}px, 0)`;
    };
    const onEnd = () => {
      const gesture = g;
      g = null;
      if (!gesture?.dragging) return;
      delete el.dataset.drag;
      const s = gesture.samples;
      const velocity = s.length > 1 ? (s[s.length - 1].y - s[0].y) / Math.max(1, s[s.length - 1].t - s[0].t) : 0;
      if (dragOutcome({ dy: gesture.dy, velocity, height: el.offsetHeight }) === 'close') { requestClose(gesture.dy); return; }
      el.style.transform = '';
      if (typeof el.animate === 'function' && !reducedMotion()) {
        el.animate([{ transform: `translate3d(0, ${dragOffset(gesture.dy)}px, 0)` }, { transform: 'translate3d(0, 0, 0)' }], { duration: 340, easing: spring(0.7) });
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [open, requestClose]);

  if (!open) return null;

  // A press on the scrim lands on the <dialog> itself, outside its box.
  const onDialogClick = (event) => {
    if (event.target !== dialog.current) return;
    const box = dialog.current.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) requestClose();
  };
  // Following a link: the sheet steps aside while the next page loads.
  const onFollow = () => requestClose();
  const balanceText = balanceLine({ pro, balance });
  const heroName = hero?.subject ? subjectName(hero.subject) : '';

  return (
    <dialog ref={dialog} id="start-sheet" className="st-sheet" aria-labelledby={titleId} onClick={onDialogClick}>
      <div className="st-grab">
        <span className="st-handle" aria-hidden="true" />
        <div className="st-head">
          <span className="st-mobi" aria-hidden="true"><PipActor pose="pointing" blink={1} motion="land-0" /></span>
          <div className="st-head__text">
            <h2 id={titleId} className="st-title">Start a session</h2>
            {balanceText ? <p className="st-balance">{pro ? <Check size={14} strokeWidth={2.25} aria-hidden="true" /> : <CreditMark kind="practice" size={15} />}{balanceText}</p> : null}
          </div>
          <button type="button" className="st-close mk-press" aria-label="Close" onClick={() => requestClose()}><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
      </div>

      <div className="st-body">
        {subjects.length > 1 ? (
          <fieldset className="st-subjects" data-rise>
            <legend id={subjectsId} className="st-label">Subject</legend>
            {/* The row scrolls with a finger, a wheel, a mouse drag, the arrow keys and the two arrows
                (useSubjectRail.js); the edges fade where more chips wait. */}
            <div className="st-rail" data-overflow={railEdges.overflow || undefined} data-at-start={railEdges.start || undefined} data-at-end={railEdges.end || undefined}>
              <div className="st-chips" ref={railRef}>
                {subjects.map((id) => (
                  <label key={id} className="st-chip mk-press" data-on={id === subject || undefined} data-subject={id}>
                    <input type="radio" name={`${titleId}-subject`} value={id} checked={id === subject} onChange={() => selectSubject(id)} />
                    <SubjectObject subject={id} size={36} lit={false} />
                    <span>{subjectName(id)}</span>
                  </label>
                ))}
              </div>
              {/* Mouse only: keyboard users move through the radio group, touch scrolls natively. */}
              <button type="button" className="st-rail__arrow st-rail__arrow--prev" tabIndex={-1} aria-hidden="true" onClick={() => railStep(-1)}>
                <span className="st-rail__disc"><ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" /></span>
              </button>
              <button type="button" className="st-rail__arrow st-rail__arrow--next" tabIndex={-1} aria-hidden="true" onClick={() => railStep(1)}>
                <span className="st-rail__disc"><ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" /></span>
              </button>
            </div>
          </fieldset>
        ) : null}

        {planState === 'loading' && !hero ? (
          <div className="st-hero st-hero--loading" data-rise role="status" aria-label="Working out your next move">
            <span className="st-skel st-skel--eyebrow skeleton" /><span className="st-skel st-skel--title skeleton" /><span className="st-skel st-skel--line skeleton" /><span className="st-skel st-skel--cta skeleton" />
          </div>
        ) : hero ? (
          <section className="st-hero" data-rise aria-labelledby={`${titleId}-move`} data-graphic={hero.graphic}>
            <div className="st-hero__text">
              <p className="st-hero__eyebrow">{hero.eyebrow}</p>
              <h3 id={`${titleId}-move`} className="st-hero__title">{hero.title}</h3>
              {hero.reason ? <p className="st-hero__reason">{hero.reason}</p> : null}
              <div className="st-hero__go">
                <Link className="st-cta mk-press" href={linkFor(hero.href)} onClick={onFollow} data-autofocus="" data-row="move">{hero.cta}</Link>
                <CostLine cost={hero.cost} />
              </div>
            </div>
            {/* With the subject row above, the chosen chip already names the subject and the object stands on
                its own; a student with one subject has no row, so the object keeps its name. */}
            <figure className="st-hero__art" aria-hidden="true">
              <RowArt key={hero.subject || hero.graphic} graphic={hero.graphic} subject={hero.subject} subjects={subjects} size={132} priority />
              {heroName && subjects.length < 2 ? <figcaption className="st-hero__caption">{heroName}</figcaption> : null}
            </figure>
          </section>
        ) : planState === 'failed' ? (
          <div className="st-miss" data-rise role="status">
            <p>Your next move could not be loaded. The sessions below still work.</p>
            <button type="button" className="st-miss__retry mk-press" onClick={retry}><RefreshCw size={15} strokeWidth={2} aria-hidden="true" />Try again</button>
          </div>
        ) : null}

        <h3 className="st-section" data-rise>{hero ? 'Or start something else' : 'Pick a session'}</h3>
        <ul className="st-rows">
          {[...rows, choose].filter(Boolean).map((row) => (
            <li key={row.id} data-rise>
              <Link className="st-row mk-press" href={linkFor(row.href)} onClick={onFollow} data-row={row.id}>
                <span className="st-row__art">
                  <RowArt key={row.graphic === 'subject' ? row.subject : row.graphic} graphic={row.graphic} subject={row.subject} subjects={row.subjects || subjects} size={56} />
                  {row.badge ? <span className="st-row__badge" aria-hidden="true">{row.badge}</span> : null}
                </span>
                <span className="st-row__text">
                  <span className="st-row__title">{row.title}{row.tag ? <span className="st-tag">{row.tag}</span> : null}</span>
                  <span className="st-row__detail">{row.detail}</span>
                  {row.cost ? <CostLine cost={row.cost} /> : <span className="st-cost" data-tone="open">Opens Practice</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="st-note" data-rise>Nothing is spent here. Practice shows the cost again before you start.</p>
      </div>
    </dialog>
  );
}
