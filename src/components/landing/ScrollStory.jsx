"use client";

// ScrollStory: a landing section that holds still while the reader's scroll walks it through its steps.
//
//   <ScrollStory steps={4} className="lc" beat="78svh" label="Mistake Lab, step by step" Content={Stage} {...stageProps} />
//   function Stage({ step, pinned, reduced, live, goTo, steps, ...stageProps }) { ... }
//
// The stage is position: sticky inside a taller track, so the browser does the holding. Each step has a
// resting place in the held scroll (the first at the start of the hold, the last at its end, the rest
// evenly between) and owns the band around it (one invisible "beat" per step); an IntersectionObserver
// on the beats picks the step whose beat crosses the middle of the window, so nothing runs per frame.
// One gesture, one step: while the stage holds the screen, a wheel gesture, a swipe or a scroll key
// moves exactly one step however fast it is (see "Gestures" below), and the page only moves on past
// the story from its first or last step. The track is also a named view timeline (--ss-track), which
// consumers use for compositor-only progress fills (see scroll-story.css). Elements marked data-ss-fit
// are scaled once per resize to fit their parent, so short phones and landscape keep the hold instead
// of clipping the screen, and the band left under elements marked data-ss-end is measured as
// --ss-slack (centring, exit gap).
// Every step's content stays in the DOM in reading order; focusing into a step brings it on stage, and
// the scrollbar, find-in-page and screen readers still move through the story by position.
// Reduced motion keeps the hold with calm, instant swaps. Without IntersectionObserver the steps stack.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/app/scroll-story.css';
import { drawnAncestor, settleUndrawn, undrawn } from './undrawn';

const reducedNow = () => {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'reduced') return true;
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// Gestures. A gesture is one wheel stroke (a notch, a burst of notches, or a trackpad swipe with its
// inertia tail: it lasts until the wheel has been quiet for QUIET_MS or turns the other way), one touch
// from finger down to finger up, or one key press with its repeats. While the stage holds the screen and
// the story has a step that way, the gesture's events are cancelled and it moves exactly one step: the
// page glides to that step's resting place in STEP_MS and nothing else moves the story until both the
// glide and the gesture are over (a gesture begun mid-glide is spent too). From the first or last step
// a new gesture in the way out is left alone, so the page carries on. A fling or a fast wheel that
// carries the page into a story from outside stops at its edge, on the first step coming from above
// and on the last coming from below; that gesture is then spent. Escape lets the page scroll freely
// through the story until it leaves it.
const QUIET_MS = 200;
const STEP_MS = 440;
const CALM_MS = 160;
const WHEEL_MIN = 12;
const SWIPE_MIN = 28;
const FLICK_MIN = 12;
const FLING_MS = 2500;
const KEYS = { ArrowDown: 1, PageDown: 1, ' ': 1, Spacebar: 1, ArrowUp: -1, PageUp: -1 };
const easeOut = (t) => 1 - (1 - t) ** 3;
// When the input happened, not when the handler ran: a busy main thread delivers a steady trackpad tail in
// late clumps, and measured by handler time those gaps would split one gesture into several.
const stamp = (event) => (event.timeStamp > 0 ? event.timeStamp : performance.now());
const typing = (node) => !!node?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], [role="spinbutton"], [role="listbox"], [role="menu"], [role="radiogroup"]');
const pressable = (node) => !!node?.closest?.('button, a[href], summary, label, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"]');
// A section held back by content-visibility is far off screen; reading geometry inside it would lay it out.
const skipped = (node) => {
  if (typeof node.checkVisibility !== 'function') return false;
  try { return !node.checkVisibility({ contentVisibilityAuto: true }); } catch { return false; }
};

// True when something inside the stage can still scroll that way itself: that gesture is its own.
function scrollsInside(node, stop, dir) {
  for (let el = node?.nodeType === 1 ? node : node?.parentElement; el && el !== stop; el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue;
    const overflow = getComputedStyle(el).overflowY;
    if (overflow !== 'auto' && overflow !== 'scroll') continue;
    if (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 1) return true;
  }
  return false;
}

// What moved the page last, shared by every story: passive listeners, attached once while a story is
// mounted. A story only stops a page that was carried in by a gesture (wheel, touch, scroll key), never
// one moved by a link, a button or Home/End.
const input = { kind: '', at: -Infinity, jump: -Infinity, touches: 0 };
let watchers = 0;
const now = () => performance.now();
const onInputWheel = (event) => { if (!event.ctrlKey) { input.kind = 'wheel'; input.at = now(); } };
const onInputTouch = (event) => {
  input.touches = event.touches.length;
  if (event.type === 'touchmove' || input.kind === 'touch') { input.kind = 'touch'; input.at = now(); }
};
const onInputKey = (event) => {
  if (event.key === 'Home' || event.key === 'End') input.jump = now();
  else if (KEYS[event.key] && !typing(event.target)) { input.kind = 'key'; input.at = now(); }
};
const onInputJump = () => { input.jump = now(); };
const INPUT_EVENTS = [['wheel', onInputWheel], ['touchstart', onInputTouch], ['touchmove', onInputTouch], ['touchend', onInputTouch], ['touchcancel', onInputTouch], ['keydown', onInputKey], ['click', onInputJump], ['hashchange', onInputJump]];
function watchInput(on) {
  watchers += on ? 1 : -1;
  if (on ? watchers !== 1 : watchers !== 0) return;
  for (const [type, handler] of INPUT_EVENTS) {
    if (on) window.addEventListener(type, handler, { capture: true, passive: true });
    else window.removeEventListener(type, handler, { capture: true });
  }
}
// Momentum. Past its first event the browser may stop letting a page cancel a scroll: a trackpad's inertia
// tail, a mouse wheel's smooth glide, a touch fling, a drag already under way, a scroll key's glide. Putting
// the page back on every frame of that scroll fights the compositor, and the held story shudders. So when a
// story has to hold the page against such a scroll, the page stops scrolling for a moment instead
// (overflow: hidden on the root, with the scrollbar's gutter kept so nothing reflows), which ends the
// momentum. Scrolling comes back once the input has been quiet for QUIET_MS with no finger down, or at once
// when a new touch or a gesture the story does not claim begins. The story's own glides still move the page.
const hush = { on: false, at: 0, timer: 0, overflow: '', gutter: '' };
function thawMomentum() {
  if (!hush.on) return;
  clearTimeout(hush.timer);
  const root = document.documentElement;
  root.style.overflow = hush.overflow;
  root.style.scrollbarGutter = hush.gutter;
  hush.on = false;
}
function hushMomentum() {
  hush.at = now();
  if (hush.on) return;
  const root = document.documentElement;
  hush.on = true;
  hush.overflow = root.style.overflow;
  hush.gutter = root.style.scrollbarGutter;
  if (window.innerWidth > root.clientWidth) root.style.scrollbarGutter = 'stable';
  root.style.overflow = 'hidden';
  const check = () => {
    const since = now() - Math.max(hush.at, input.at);
    if (input.touches > 0 || since < QUIET_MS) hush.timer = setTimeout(check, Math.max(16, QUIET_MS - since));
    else thawMomentum();
  };
  hush.timer = setTimeout(check, QUIET_MS);
}
const gestureCarried = (at) => input.at > input.jump && (
  (input.kind === 'touch' && (input.touches > 0 || at - input.at < FLING_MS))
  || (input.kind === 'wheel' && at - input.at < 600)
  || (input.kind === 'key' && at - input.at < 900));

function fitAll(stage) {
  for (const node of stage.querySelectorAll('[data-ss-fit]')) {
    const room = node.parentElement;
    if (!room) continue;
    node.style.removeProperty('--ss-fit');
    // Room: from the node's own top to the parent's content bottom (the node scales from its top
    // left and is laid out 1/fit wider, so it keeps the full width and rewraps a little shorter).
    const box = room.getBoundingClientRect();
    const padBottom = parseFloat(getComputedStyle(room).paddingBottom) || 0;
    const space = box.top + room.clientTop + room.clientHeight - padBottom - node.getBoundingClientRect().top;
    // The smallest scale: --ss-fit-min from CSS (per layout) wins over data-ss-fit, then 0.6.
    const min = parseFloat(getComputedStyle(node).getPropertyValue('--ss-fit-min')) || Number(node.dataset.ssFit) || 0.6;
    if (!(space > 0) || node.offsetHeight <= space + 1) continue;
    let fit = Math.max(min, space / node.offsetHeight);
    for (let pass = 0; pass < 3; pass += 1) {
      node.style.setProperty('--ss-fit', fit.toFixed(3));
      const drawn = node.offsetHeight * fit;
      if (Math.abs(drawn - space) < 4 || fit === min) break;
      fit = Math.max(min, Math.min(1, (fit * space) / drawn));
    }
    if (node.offsetHeight * fit > space + 1 && fit > min) node.style.setProperty('--ss-fit', Math.max(min, space / node.offsetHeight).toFixed(3));
  }
}

// Slack: the empty band between the held content's bottom (elements marked data-ss-end) and the stage's
// bottom. Written once per resize as --ss-slack, so consumers can centre short content in the held window
// (scroll-story.css) and the page after the story follows at the normal section gap, not a stage height.
// A page may give a story its expected slack in CSS before it is first drawn (landing.css), so the page's
// height is right from the start: the measure is taken with the slack at 0 (the centring translate moves the
// end markers) and always written, 0 included, so a measured 0 never falls back to that expectation.
function measureSlack(root, stage) {
  const ends = stage.querySelectorAll('[data-ss-end]');
  if (!ends.length) { root.style.removeProperty('--ss-slack'); return; }
  root.style.setProperty('--ss-slack', '0px');
  let bottom = -Infinity;
  for (const node of ends) {
    const rect = node.getBoundingClientRect();
    if (rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(bottom)) return;
  const box = stage.getBoundingClientRect();
  const padBottom = parseFloat(getComputedStyle(stage).paddingBottom) || 0;
  const slack = Math.max(0, Math.floor(box.bottom - padBottom - bottom));
  root.style.setProperty('--ss-slack', `${slack}px`);
}

export default function ScrollStory({ steps, className = '', beat, label, onStep, Content, ...rest }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const beatsRef = useRef([]);
  const crossing = useRef(new Set());
  const [pinned, setPinned] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [step, setStep] = useState(0);
  const [live, setLive] = useState(false);
  const stepRef = useRef(0);
  // True while the page glides to a step this story chose: the beats it passes on the way do not show.
  const steering = useRef(false);
  const story = useRef(null);
  const onStepRef = useRef(onStep);
  useEffect(() => { onStepRef.current = onStep; }, [onStep]);
  // A held story must not move under the reader: settle the page's height before a fast scroll reaches it
  // (undrawn.js; once per page, shared by every story).
  useEffect(() => { settleUndrawn(); }, []);

  useEffect(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduced(reducedNow());
      setPinned(typeof IntersectionObserver !== 'undefined');
    };
    sync();
    calm.addEventListener?.('change', sync);
    const watch = typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
    watch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => { calm.removeEventListener?.('change', sync); watch?.disconnect(); };
  }, []);

  // The beat crossing the middle of the window owns the step. With no beat crossing, the side the
  // reader comes from does: the beats cover the whole track, so the track then lies wholly on one
  // side of the middle. Still below it, the story waits on its first step; already above it, on its
  // last. So a story entered from above always opens on step one and one entered from below on its
  // last, even after a jump (a nav link, a fling, the top button) that no beat saw. A second observer,
  // a window three screens tall, settles this before the stage shows and, only while the story is that
  // near, a passive scroll listener re-checks once a frame when no beat is crossing (one rect read).
  useEffect(() => {
    if (!pinned) return undefined;
    const held = crossing.current;
    const track = trackRef.current;
    let frame = 0;
    let listening = false;
    const fromSide = () => {
      frame = 0;
      if (held.size > 0 || !track || steering.current) return;
      // A section not drawn yet is far off screen: its reserved box gives the side without laying it out.
      const box = drawnAncestor(track).getBoundingClientRect();
      setStep(box.top + box.bottom > window.innerHeight ? 0 : steps - 1);
    };
    const onScroll = () => { if (!frame && held.size === 0) frame = requestAnimationFrame(fromSide); };
    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      if (on) window.addEventListener('scroll', onScroll, { passive: true });
      else window.removeEventListener('scroll', onScroll);
    };
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const i = Number(entry.target.dataset.beat);
        if (entry.isIntersecting) { held.add(i); if (!steering.current) setStep(i); } else held.delete(i);
      }
      setLive(held.size > 0);
      fromSide();
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    beatsRef.current.slice(0, steps).forEach((node) => node && io.observe(node));
    const near = track ? new IntersectionObserver((entries) => {
      listen(entries[entries.length - 1].isIntersecting);
      fromSide();
    }, { rootMargin: '100% 0px 100% 0px', threshold: 0 }) : null;
    if (track) near.observe(track);
    return () => { io.disconnect(); near?.disconnect(); listen(false); cancelAnimationFrame(frame); held.clear(); };
  }, [pinned, steps]);

  useEffect(() => { stepRef.current = step; onStepRef.current?.(step); }, [step]);

  // Scale marked screens to their room once per resize (never per scroll frame).
  useEffect(() => {
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!pinned || !stage || !root || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    // Not while the section is undrawn (content-visibility): the observer below runs it once it is drawn.
    const run = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (undrawn(stage)) return; fitAll(stage); measureSlack(root, stage); }); };
    const observer = new ResizeObserver(run);
    observer.observe(stage);
    stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.parentElement && observer.observe(node.parentElement));
    // A fitted node changes its own width when it is scaled, so only unscaled end markers are watched.
    stage.querySelectorAll('[data-ss-end]:not([data-ss-fit])').forEach((node) => observer.observe(node));
    document.fonts?.ready.then(run).catch(() => {});
    run();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.querySelectorAll('[data-ss-fit]').forEach((node) => node.style.removeProperty('--ss-fit'));
      root.style.removeProperty('--ss-slack');
    };
  }, [pinned]);

  // Gestures (see the top of the file): one gesture, one step, while the stage holds the screen. The
  // listeners exist only while the story is within a screen of the window.
  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!pinned || !track || !stage || steps < 2) return undefined;
    let wheel = null; // the wheel gesture in progress: { dir, last, sum, own, done }
    let touch = null; // the touch in progress: { x, y, t, dir, decided, own, done, target }
    let pressed = null; // the key press in progress, with its repeats: { own }
    let busyUntil = 0; // the step's glide (or a calm swap) runs until then
    // While the gesture that owns the story lasts, the page stays at this point of the track (measured from the
    // track's top, so a section above that changes height under the reader moves the hold with it).
    let keep = null;
    let keptAt = 0;
    let keptSince = 0; // when the story last took the page: a link, a button or Home/End after that wins
    let keepTouch = false;
    let released = false; // Escape: the page scrolls freely until it leaves the story
    let prevS = null;
    let selfY = null; // the last scroll position this story set itself
    let glide = 0;
    let listening = false;

    // s: how far the page is into the track; hold: how far it can go with the stage held.
    // The stage (not the track, whose height is set exactly) is what waits while the story is undrawn.
    const locate = () => {
      if (skipped(stage)) return null;
      const box = track.getBoundingClientRect();
      return { s: -box.top, hold: Math.max(0, track.offsetHeight - stage.offsetHeight), top: window.scrollY + box.top };
    };
    const holding = (at) => at.s >= -1 && at.s <= at.hold + 1;
    const restOf = (n, at) => Math.round(at.top + (at.hold * n) / (steps - 1));
    const put = (y) => { selfY = Math.round(y); window.scrollTo({ top: y, behavior: 'instant' }); };

    const go = (n, { instant = false } = {}) => {
      const next = Math.max(0, Math.min(steps - 1, n));
      stepRef.current = next;
      setStep(next);
      const at = locate();
      if (!at) return;
      const target = restOf(next, at);
      const calm = instant || reducedNow();
      const t0 = now();
      busyUntil = t0 + (calm ? CALM_MS : STEP_MS);
      const goal = target - at.top;
      keep = goal;
      keptAt = t0;
      keptSince = t0;
      keepTouch = input.touches > 0;
      cancelAnimationFrame(glide);
      const from = window.scrollY - at.top;
      if (calm || Math.abs(target - window.scrollY) < 2) { steering.current = false; put(target); return; }
      steering.current = true;
      // The glide is planned along the track, not the page: if a section above settles its height mid-glide
      // (scroll anchoring then shifts the page), the glide still lands exactly on the step's resting place.
      const frame = () => {
        const t = Math.min(1, (now() - t0) / STEP_MS);
        const live = locate();
        const top = live && Math.abs(live.top - at.top) > 1 ? live.top : at.top; // real drift, not sub-pixel noise
        put(top + from + (goal - from) * easeOut(t));
        if (t < 1) glide = requestAnimationFrame(frame);
        else { glide = 0; steering.current = false; }
      };
      glide = requestAnimationFrame(frame);
    };
    const step = (dir) => {
      const next = stepRef.current + dir;
      if (next >= 0 && next < steps) go(next);
    };
    // Does a new gesture this way belong to the story? Only while the stage holds the screen and the
    // story has a step that way; mid-glide every gesture does (it is swallowed, never skipped ahead).
    const claims = (dir, target) => {
      if (released) return false;
      const at = locate();
      if (!at || !holding(at)) return false;
      if (target && stage.contains(target) && scrollsInside(target, stage, dir)) return false;
      if (now() < busyUntil) return true;
      return dir > 0 ? stepRef.current < steps - 1 : stepRef.current > 0;
    };
    // A gesture the story did not claim carried the page into the hold: stop it on step n's resting
    // place (the end it came in through), and that gesture is spent.
    const enter = (n, at, dir) => {
      const t = now();
      cancelAnimationFrame(glide);
      steering.current = false;
      stepRef.current = n;
      setStep(n);
      keep = restOf(n, at) - at.top;
      keptAt = t;
      keptSince = t;
      keepTouch = input.kind === 'touch';
      busyUntil = t + CALM_MS;
      put(at.top + keep);
      // Whatever carried the page in (a fling, a wheel's inertia) ends here, not a frame at a time.
      hushMomentum();
      if (input.kind === 'wheel') wheel = { dir, last: t, sum: 0, own: true, done: true };
      if (touch) Object.assign(touch, { decided: true, dir, own: true, done: true });
      if (input.kind === 'key') pressed = { own: true };
    };

    const onWheel = (event) => {
      if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const t = stamp(event);
      const dir = event.deltaY > 0 ? 1 : -1;
      if (!wheel || t - wheel.last > QUIET_MS || dir !== wheel.dir) {
        const own = claims(dir, event.target);
        // Begun while a step still glides: more of the same push, swallowed whole (never a queued step).
        wheel = { dir, last: t, sum: 0, own, done: own && t < busyUntil };
        if (!own) { keep = null; thawMomentum(); }
      }
      wheel.last = t;
      if (!wheel.own) return;
      if (event.cancelable) event.preventDefault();
      keptAt = now();
      wheel.sum += Math.abs(event.deltaY) * (event.deltaMode ? 40 : 1);
      if (!wheel.done && t >= busyUntil && wheel.sum >= WHEEL_MIN) { wheel.done = true; step(dir); }
    };

    const onTouchStart = (event) => {
      // A new touch has already stopped any fling: the page is free again for whatever this touch decides.
      thawMomentum();
      if (event.touches.length !== 1) { touch = null; return; }
      const p = event.touches[0];
      touch = { x: p.clientX, y: p.clientY, t: stamp(event), dir: 0, decided: false, own: false, done: false, target: event.target };
    };
    const onTouchMove = (event) => {
      if (!touch) return;
      if (event.touches.length !== 1) { touch = null; return; }
      const p = event.touches[0];
      const dx = touch.x - p.clientX;
      const dy = touch.y - p.clientY;
      const t = stamp(event);
      if (!touch.decided) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) {
          // Too short to read yet: while the stage holds the screen, the page waits for the direction.
          const at = event.cancelable && !released ? locate() : null;
          if (at && holding(at)) event.preventDefault();
          return;
        }
        touch.decided = true;
        touch.dir = dy > 0 ? 1 : -1;
        touch.own = Math.abs(dy) >= Math.abs(dx) && claims(touch.dir, touch.target);
        touch.done = touch.own && touch.t < busyUntil;
        if (!touch.own) keep = null;
      }
      if (!touch.own) return;
      if (event.cancelable) event.preventDefault();
      keptAt = now();
      if (!touch.done && t >= busyUntil && dy * touch.dir >= SWIPE_MIN) { touch.done = true; step(touch.dir); }
    };
    const onTouchEnd = (event) => {
      const t = stamp(event);
      if (touch?.own) {
        keptAt = now();
        const p = event.changedTouches[0];
        const dy = p ? touch.y - p.clientY : 0;
        // A quick flick shorter than a swipe still counts once.
        if (!touch.done && t >= busyUntil && dy * touch.dir >= FLICK_MIN && t - touch.t < 300) { touch.done = true; step(touch.dir); }
      }
      if (event.touches.length === 0) touch = null;
    };

    const onKey = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Escape') {
        const at = locate();
        if (at && holding(at)) { released = true; keep = null; thawMomentum(); }
        return;
      }
      let dir = KEYS[event.key];
      if (!dir || typing(event.target)) return;
      const space = event.key === ' ' || event.key === 'Spacebar';
      if (space && pressable(event.target)) return;
      if (space && event.shiftKey) dir = -1;
      if (event.repeat) { if (pressed?.own) event.preventDefault(); return; }
      pressed = { own: claims(dir, event.target) };
      if (!pressed.own) { keep = null; thawMomentum(); return; }
      event.preventDefault();
      keptAt = now();
      if (stamp(event) >= busyUntil) step(dir);
    };

    const onScroll = () => {
      const t = now();
      const at = locate();
      if (!at) { prevS = null; return; }
      const ours = selfY !== null && Math.abs(window.scrollY - selfY) < 1.5;
      if (released && !holding(at)) released = false;
      // Momentum the page could not cancel, arriving mid-glide: end it (the glide's next frame puts the page back).
      if (!ours && steering.current && input.jump < keptSince) hushMomentum();
      if (!ours && !steering.current && !released) {
        if (keep !== null && input.jump < keptSince && (t < busyUntil || t - keptAt < QUIET_MS || (keepTouch && input.touches > 0))) {
          // Momentum the gesture left behind (a fling, a wheel's glide) does not move the story: the page goes
          // back once and the momentum ends there (see Momentum above).
          if (Math.abs(at.s - keep) > 1.5) { keptAt = t; put(at.top + keep); hushMomentum(); }
        } else {
          keep = null;
          // A gesture this story did not claim carried the page into the held stretch (in from outside,
          // or on from resting exactly at an edge): stop it on the step it came to.
          if (prevS !== null && gestureCarried(t) && at.s > 1 && at.s < at.hold - 1) {
            const n = prevS <= 1 ? 0 : prevS >= at.hold - 1 ? steps - 1 : stepRef.current;
            enter(n, at, at.s > prevS ? 1 : -1);
          }
        }
      }
      prevS = window.scrollY - at.top;
    };

    const listen = (on) => {
      if (on === listening) return;
      listening = on;
      const how = on ? 'addEventListener' : 'removeEventListener';
      window[how]('wheel', onWheel, { passive: false });
      window[how]('touchstart', onTouchStart, { passive: true });
      window[how]('touchmove', onTouchMove, { passive: false });
      window[how]('touchend', onTouchEnd, { passive: true });
      window[how]('touchcancel', onTouchEnd, { passive: true });
      window[how]('keydown', onKey);
      window[how]('scroll', onScroll, { passive: true });
      if (on) { const at = locate(); prevS = at ? at.s : null; } else { wheel = null; touch = null; pressed = null; keep = null; }
    };
    const near = new IntersectionObserver((entries) => listen(entries[entries.length - 1].isIntersecting), { rootMargin: '100% 0px 100% 0px', threshold: 0 });
    near.observe(track);
    watchInput(true);
    story.current = { go };
    return () => {
      near.disconnect();
      listen(false);
      watchInput(false);
      thawMomentum();
      cancelAnimationFrame(glide);
      steering.current = false;
      story.current = null;
    };
  }, [pinned, steps]);

  // Brings step i on stage: the page glides to the step's resting place (keyboard and reduced motion jump).
  const goTo = useCallback((i, { instant = false } = {}) => {
    const n = Math.max(0, Math.min(steps - 1, i));
    if (pinned && story.current) { story.current.go(n, { instant }); return; }
    setStep(n);
  }, [pinned, steps]);

  // Focus moving into a step that is off stage brings that step on (keyboard reading order).
  const onFocus = useCallback((event) => {
    const host = event.target.closest?.('[data-ss-step]');
    if (!host) return;
    const i = Number(host.dataset.ssStep);
    if (Number.isFinite(i) && i !== step) goTo(i, { instant: true });
  }, [goTo, step]);

  const api = useMemo(() => ({ step, pinned, reduced, live, goTo, steps }), [step, pinned, reduced, live, goTo, steps]);

  return (
    <div
      ref={rootRef}
      className={`ss ${className}`.trim()}
      data-pinned={pinned ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
      data-live={live ? 'true' : 'false'}
      data-step={step}
      style={{ '--ss-steps': steps, '--ss-step': step, ...(beat ? { '--ss-beat': beat } : null) }}
    >
      <div className="ss__track" ref={trackRef}>
        <div className="ss__stage" ref={stageRef} onFocus={onFocus} role={label ? 'group' : undefined} aria-label={label}>
          <Content {...rest} {...api} />
        </div>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className="ss__beat" data-beat={i} data-edge={i === 0 ? 'first' : i === steps - 1 ? 'last' : undefined} style={{ '--i': i }} ref={(node) => { beatsRef.current[i] = node; }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
