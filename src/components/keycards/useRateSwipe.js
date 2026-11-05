'use client';
// Swipe a turned Key card to rate it (LK137): the pointer half of rateSwipe.mjs. Used by the Learn run (RunPlayer) and Key cards
// Study (KeyCardPlayer); the rating keys and 1 / 2 / 3 stay exactly as they were, and this only adds a second way to press them.
//   const swipe = useRateSwipe({ enabled: turned && !busy, onRate: (rating) => rate(rating) });   // onRate returns true when saved
//   <div ref={swipe.ref} ...><SwipeLabels /> ...</div>                                              // swipe.intent lights the key
// The card follows the pointer through its inline translate and rotate (no React render per move); it carries
//   data-swipe        drag | commit | settle      (keycards.css: the spring home, the held card while the rating saves)
//   data-swipe-intent right | left | down          (which label shows; --swipe-p is how far, 0 to 1)
//   data-swipe-ready  once a release there would rate
//   data-swipe-down   while down is offered to a touch (touch-action: none); without it the page keeps its vertical scroll
// A committed card stays where it was let go until the rating is saved: the caller's flight takes it from there (it reads
// `swipePose(card)`); a rating that fails springs it home. Reduced motion: no gesture at all, the keys rate.
import { useCallback, useEffect, useRef, useState } from 'react';
import { tick } from '@/lib/haptics';
import { isMotionReduced } from '@/lib/motion';
import { releaseVelocity } from '@/lib/motion/dragPolicy';
import { SWIPE, applyPose, clearPose, clearSwipe, dragPose, lockAxis, releaseRating } from './rateSwipe.mjs';

export { swipePose, clearSwipe } from './rateSwipe.mjs';

const SETTLE_MS = 300;
const INTERACTIVE = 'button, a, input, textarea, select, label, [role="menu"], [role="menuitem"], .kc-menu, .kc-report';

function wholeInView(el) {
  try {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.height > 0 && r.top >= -1 && r.bottom <= vh + 1;
  } catch { return false; }
}

/** True when something inside the card scrolls (a long answer in the run's face): a touch there must keep its scroll. */
function scrollsInside(el) {
  try {
    for (const n of el.querySelectorAll('*')) {
      if (n.scrollHeight > n.clientHeight + 1 && n.clientHeight > 0 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return true;
    }
  } catch { /* treated as fitting */ }
  return false;
}

/** Keeps data-swipe-down (and the hook's downOk) true while the whole card is in view; returns the unbind. */
function watchDown(el, setDownOk) {
  let raf = 0;
  const check = () => {
    raf = 0;
    const ok = wholeInView(el) && !scrollsInside(el);
    if (ok) el.dataset.swipeDown = ''; else delete el.dataset.swipeDown;
    setDownOk(ok);
  };
  const soon = () => { if (!raf) raf = requestAnimationFrame(check); };
  el.dataset.swipeOn = '';
  check();
  const late = window.setTimeout(check, 400); // after the answer has opened
  window.addEventListener('resize', soon);
  document.addEventListener('scroll', soon, { capture: true, passive: true });
  return () => {
    window.clearTimeout(late);
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', soon);
    document.removeEventListener('scroll', soon, { capture: true });
    delete el.dataset.swipeDown;
    delete el.dataset.swipeOn;
  };
}

/**
 * Binds the gesture to one card element; returns the unbind. Outside the hook on purpose: it writes the element's own inline
 * transform and data attributes on every move, which is the point (no React render per move).
 */
function bindSwipe(el, { enabledRef, rateRef, setIntent }) {
  let g = null; // the gesture: { id, type, x, y, axis, width, samples, pose, ready }
  let settleTimer = 0;
  let suppressClick = false;
  let shown = null;

  const say = (next) => { if (next !== shown) { shown = next; setIntent(next); } };
  const home = () => {
    window.clearTimeout(settleTimer);
    el.dataset.swipe = 'settle';
    clearPose(el);
    el.style.setProperty('--swipe-p', '0');
    delete el.dataset.swipeIntent;
    delete el.dataset.swipeReady;
    delete el.dataset.swipePose;
    say(null);
    settleTimer = window.setTimeout(() => { if (el.dataset.swipe === 'settle') delete el.dataset.swipe; }, SETTLE_MS);
  };

  const down = (e) => {
    if (!enabledRef.current || g || el.dataset.swipe === 'commit') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target?.closest?.(INTERACTIVE)) return;
    const r = el.getBoundingClientRect();
    g = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, axis: null, width: r.width, samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }], pose: null, ready: false };
  };

  const move = (e) => {
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    g.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (g.samples.length > 40) g.samples.shift();
    if (!g.axis) {
      // A touch may drag down only while the card owns the touch (data-swipe-down); a mouse or pen always may.
      const allowDown = g.type !== 'touch' || el.dataset.swipeDown !== undefined;
      const axis = lockAxis(dx, dy, { slop: g.type === 'mouse' ? SWIPE.slopMouse : SWIPE.slopTouch, down: allowDown });
      if (!axis) return;
      if (axis === 'page' || !enabledRef.current) { g = null; return; }
      g.axis = axis;
      window.clearTimeout(settleTimer);
      el.dataset.swipe = 'drag';
      try { el.setPointerCapture(e.pointerId); } catch { /* capture is a nicety */ }
      try { window.getSelection()?.removeAllRanges(); } catch { /* no selection API */ }
    }
    if (e.cancelable) e.preventDefault();
    const pose = dragPose(g.axis, dx, dy, g.width);
    g.pose = pose;
    applyPose(el, pose);
    el.style.setProperty('--swipe-p', String(pose.progress));
    if (pose.intent) el.dataset.swipeIntent = pose.intent; else delete el.dataset.swipeIntent;
    if (pose.ready !== g.ready) {
      g.ready = pose.ready;
      if (pose.ready) { el.dataset.swipeReady = ''; tick(); } else delete el.dataset.swipeReady;
    }
    // The matching key lights from about a third of the way, so a small wobble never flickers it.
    say(pose.progress >= 0.35 ? pose.intent : null);
  };

  const up = (e) => {
    if (!g || g.id !== e.pointerId) return;
    const gesture = g;
    g = null;
    if (!gesture.axis) return;
    try { el.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    suppressClick = true;
    window.setTimeout(() => { suppressClick = false; }, 0);
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    const key = gesture.axis === 'y' ? 'y' : 'x';
    const velocity = releaseVelocity(gesture.samples.map((s) => ({ t: s.t, x: s[key] })), e.timeStamp);
    const rating = enabledRef.current ? releaseRating(gesture.axis, dx, dy, velocity, gesture.width) : null;
    if (!rating) { home(); return; }
    el.dataset.swipe = 'commit';
    el.dataset.swipePose = JSON.stringify(gesture.pose || dragPose(gesture.axis, dx, dy, gesture.width));
    say(gesture.pose?.intent || null);
    Promise.resolve()
      .then(() => rateRef.current?.(rating))
      .then((ok) => { if (ok === false && el.isConnected && el.dataset.swipe === 'commit') home(); else if (ok) say(null); })
      .catch(() => { if (el.isConnected) home(); });
  };

  const cancel = (e) => {
    if (!g || g.id !== e.pointerId) return;
    const had = Boolean(g.axis);
    g = null;
    if (had) home();
  };
  // A touch is captured to the element it landed on (the words inside the card); taking the capture to the card fires a
  // lostpointercapture on that child, which bubbles here. Only the card's own loss ends the drag.
  const lost = (e) => { if (e.target === el) cancel(e); };
  const click = (e) => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } };
  const drag = (e) => { if (g?.axis) e.preventDefault(); }; // no native image or text drag mid-swipe

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('lostpointercapture', lost);
  el.addEventListener('click', click, true);
  el.addEventListener('dragstart', drag);
  el.dataset.swipeable = '';
  return () => {
    window.clearTimeout(settleTimer);
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('lostpointercapture', lost);
    el.removeEventListener('click', click, true);
    el.removeEventListener('dragstart', drag);
    delete el.dataset.swipeable;
    say(null); // the next card's keys start unlit
    if (el.dataset.swipe !== 'commit') clearSwipe(el);
  };
}

export function useRateSwipe({ enabled = true, onRate } = {}) {
  const [el, setEl] = useState(null);
  const [live, setLive] = useState(false); // the gesture exists here (a client without reduced motion)
  const [intent, setIntent] = useState(null);
  const [downOk, setDownOk] = useState(true);
  const rateRef = useRef(onRate);
  const enabledRef = useRef(enabled);
  useEffect(() => { rateRef.current = onRate; }, [onRate]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  const ref = useCallback((node) => setEl(node || null), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion is read on the client only
    setLive(!isMotionReduced());
  }, []);

  // Down is offered to a touch only while the whole card is in view (then a touch on it is ours, not the page's scroll).
  useEffect(() => (el && live && enabled ? watchDown(el, setDownOk) : undefined), [el, live, enabled]);
  useEffect(() => (el && live ? bindSwipe(el, { enabledRef, rateRef, setIntent }) : undefined), [el, live]);

  return { ref, live: live && enabled, intent, downOk };
}
