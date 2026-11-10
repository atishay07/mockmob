"use client";

// The guide ("Show me around"), rebuilt 10 Nov 2026. One spotlight that sits on the stop's own key and dims the rest of the
// page, and one card beside it: Mobi, "1 of 5", the stop's name, one line, Back, Next and Skip. The stops and their words
// are src/lib/appTour.mjs; where the card stands is guidePlace.mjs; the shell (AppLayoutClient.jsx) only holds open and
// closed.
//
// It is a modal <dialog>, so the page behind is inert (no taps, no focus, hidden from a screen reader), Escape closes it, and
// focus stays inside the card. The dialog itself is the whole screen and transparent: the dimming is the spotlight's own
// shadow, so the lit key is the real key, not a picture of it. The page does not scroll while it is open.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PipActor } from '@/components/brand/PipActor';
import { GUIDE_RING_PAD, guideCardWidth, placeGuideCard } from './guidePlace.mjs';
import './app-guide.css';

// Mobi answers each stop with a small change of pose; he lands once and nods after that.
const POSES = ['greeting', 'pointing', 'encouraging', 'thinking', 'attentive', 'celebrating'];
const RING = 2;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

const onScreen = (node) => {
  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
};

/** The element a stop stands on: the first of its targets that is on screen (the sidebar's row on a desktop, the dock's key on a phone). */
function targetOf(step) {
  for (const id of [].concat(step.target)) {
    const node = [...document.querySelectorAll(`[data-tour="${id}"]`)].find(onScreen);
    if (!node) continue;
    // `group`: the ring goes round the whole sidebar group the row heads (You and the pages under it).
    return (step.group && node.closest('.arena-nav-group')) || node;
  }
  return null;
}

/** The band the card may use: below the top bar, above the dock. */
function safeBand() {
  const bar = document.querySelector('.arena-topbar');
  const dock = document.querySelector('.arena-bottomnav');
  const barBox = bar && onScreen(bar) ? bar.getBoundingClientRect() : null;
  const dockBox = dock && onScreen(dock) ? dock.getBoundingClientRect() : null;
  return { top: barBox ? Math.max(0, barBox.bottom) : 0, bottom: dockBox ? dockBox.top : window.innerHeight };
}

export default function AppGuide({ steps, opener = null, onClose }) {
  const [at, setAt] = useState(0);
  // spot: the ring's box and corner radius; card: where the card stands. null until the first measure.
  const [spot, setSpot] = useState(null);
  const [card, setCard] = useState(null);
  const [settled, setSettled] = useState(false);
  const dialog = useRef(null);
  const cardBox = useRef(null);
  const nextKey = useRef(null);
  const last = steps.length - 1;
  const index = Math.min(at, last);
  const step = steps[index];

  const measure = useCallback(() => {
    const panel = cardBox.current;
    if (!panel || !step) return;
    const screen = { width: window.innerWidth, height: window.innerHeight };
    const size = { width: guideCardWidth(screen.width), height: panel.offsetHeight };
    const safe = safeBand();
    const node = targetOf(step);
    if (!node) {
      // Nothing to point at (a key this screen does not draw): the page is dimmed and the card rests above the dock.
      setSpot(null);
      setCard({ left: Math.round((screen.width - size.width) / 2), top: Math.round(Math.min(screen.height - 16, safe.bottom - 8) - size.height), side: 'none', nub: 0, width: size.width });
      return;
    }
    // A row inside the sidebar's own scroller is brought into view first; a key in the dock or the bar is already there.
    node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    const rect = node.getBoundingClientRect();
    const out = GUIDE_RING_PAD + RING;
    const box = { left: Math.round(rect.left - out), top: Math.round(rect.top - out), width: Math.round(rect.width + out * 2), height: Math.round(rect.height + out * 2) };
    // The target's own corner, carried out to the ring. A key with square corners gets a soft one.
    const own = parseFloat(window.getComputedStyle(node).borderTopLeftRadius) || 0;
    const radius = Math.min((own > 0 ? Math.min(own, rect.height / 2) : 8) + out, box.height / 2);
    setSpot({ ...box, radius });
    setCard({ ...placeGuideCard({ target: box, card: size, screen, safe }), width: size.width });
  }, [step]);

  // Open as a modal dialog; give the page back as it was.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return undefined;
    if (!el.open) el.showModal();
    // The page behind does not scroll: a wheel or a drag on the dialog goes nowhere.
    const hold = (event) => event.preventDefault();
    el.addEventListener('wheel', hold, { passive: false });
    el.addEventListener('touchmove', hold, { passive: false });
    return () => {
      el.removeEventListener('wheel', hold);
      el.removeEventListener('touchmove', hold);
      if (el.open) el.close();
    };
  }, []);

  // Focus goes back to the key that opened it. The account sheet's row is gone by then, so its door (the person in the top
  // bar) takes it; a guide that started by itself hands focus to the page.
  useEffect(() => () => {
    const back = opener && opener.isConnected && onScreen(opener) ? opener : opener ? document.querySelector('.arena-acct__you') : document.getElementById('app-main');
    window.requestAnimationFrame(() => back?.focus?.({ preventScroll: true }));
  }, [opener]);

  // Where the key is on screen is read from the page itself, before the first paint and again whenever the stop changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the target's box is only known from the laid-out page
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    let frame = 0;
    const again = () => { if (!frame) frame = window.requestAnimationFrame(() => { frame = 0; measure(); }); };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, { passive: true });
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(again) : null;
    if (cardBox.current) watch?.observe(cardBox.current);
    // Late layout (a web font, the dock settling) is caught once more.
    const late = window.setTimeout(again, 320);
    return () => { window.removeEventListener('resize', again); window.removeEventListener('scroll', again); watch?.disconnect(); window.clearTimeout(late); window.cancelAnimationFrame(frame); };
  }, [measure]);
  // The first position is taken without travel; every later one glides.
  useEffect(() => {
    if (!card || settled) return undefined;
    // Focus moves into the card as soon as it is placed (a hidden key cannot take it). Opened by a key, it rests on Next, the
    // key a student wants. Started by itself, it rests on the card (no key is ringed before the student has touched anything)
    // and the first Tab or Enter reaches Next.
    (opener ? nextKey.current : cardBox.current)?.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [card, settled, opener]);

  const go = (by) => {
    const next = Math.min(last, Math.max(0, index + by));
    // Back hides on the first stop, so focus never rests on a key that is gone.
    if (next === 0) nextKey.current?.focus({ preventScroll: true });
    setAt(next);
  };
  const onward = () => (index === last ? onClose() : go(1));

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); if (index < last) go(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    else if (SCROLL_KEYS.has(event.key)) event.preventDefault();
    else if (event.key === 'Tab') {
      // Focus stays inside the card: Tab goes round its keys and never out to the page or the browser's own bar.
      const keys = [...(cardBox.current?.querySelectorAll('button') || [])].filter((key) => !key.hidden && key.tabIndex !== -1);
      if (!keys.length) return;
      event.preventDefault();
      const here = keys.indexOf(document.activeElement);
      const next = here < 0 ? keys.length - 1 : (here + (event.shiftKey ? -1 : 1) + keys.length) % keys.length;
      keys[next].focus({ preventScroll: true });
    } else if (event.key === 'Enter' && document.activeElement === cardBox.current) { event.preventDefault(); onward(); }
  };

  if (!step) return null;
  return (
    <dialog
      ref={dialog}
      className="gd"
      aria-labelledby="gd-title"
      aria-describedby="gd-line"
      data-settled={settled ? '' : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={onKeyDown}
    >
      {spot
        ? <div className="gd-spot" aria-hidden="true" style={{ width: spot.width, height: spot.height, borderRadius: spot.radius, transform: `translate3d(${spot.left}px, ${spot.top}px, 0)` }} />
        : <div className="gd-veil" aria-hidden="true" />}
      <div
        ref={cardBox}
        className="gd-card arena-tour-card"
        tabIndex={-1}
        data-side={card?.side || 'none'}
        data-placed={card ? '' : undefined}
        style={{ width: card?.width, transform: card ? `translate3d(${card.left}px, ${card.top}px, 0)` : undefined }}
      >
        <span className="gd-nub" aria-hidden="true" style={{ '--gd-nub': `${card?.nub || 0}px` }} />
        <div className="gd-card__in">
          <div className="gd-head">
            <span className="arena-tour-pip gd-pip"><PipActor pose={POSES[index] || 'greeting'} blink={index + 1} motion={index ? `nod-${index % 2}` : 'land-0'} /></span>
            <div className="gd-text">
              <div className="gd-top">
                <p className="gd-count">{index + 1} of {steps.length}</p>
                <span className="gd-dots" aria-hidden="true">
                  {steps.map((stop, i) => <i key={stop.title} data-on={i === index ? '' : undefined} data-done={i < index ? '' : undefined} />)}
                </span>
              </div>
              {/* A screen reader hears the stop's name and its line each time the stop changes. */}
              <div aria-live="polite" aria-atomic="true">
                <h2 id="gd-title" className="gd-title">{step.title}</h2>
                <p id="gd-line" className="gd-line">{step.body}</p>
              </div>
            </div>
          </div>
          <div className="gd-foot">
            <button type="button" className="gd-skip" hidden={index === last} onClick={onClose}>Skip</button>
            <span className="gd-foot__gap" />
            <button type="button" className="gd-back" data-off={index === 0 ? '' : undefined} tabIndex={index === 0 ? -1 : undefined} aria-hidden={index === 0 ? 'true' : undefined} onClick={() => go(-1)}>Back</button>
            <button type="button" ref={nextKey} className="btn-volt gd-next" onClick={onward}>{index === last ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
