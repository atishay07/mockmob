// The gesture controller for the landing's held stories (LK69, ported from the bench in
// tmp/home-1104/scroll/prototype-one-gesture-v2.html, which gave exactly one step for 32 of 32 flick cells).
//
// One controller serves every story on the page (a ScrollStory registers itself; see ScrollStory.jsx):
//   touch   one finger, one step. The step is chosen at touchend from the NET travel (40 px, or a 12 px flick at
//           0.3 px/ms), never from speed, so a hard flick and a slow drag both move exactly one step.
//   wheel   one burst (notches, or a trackpad swipe and its inertia tail) moves one step.
//   keys    arrows, PageUp/Down and Space move one step per press.
//   lock    a gesture that starts within 420 ms (120 ms under reduced motion) of a step is swallowed whole.
//   clamp   a fling that carries the page across a story's first or last resting place from OUTSIDE is held there, so
//           a flick never runs through a story. Exits stay free.
//   settle  a native scroll that ends inside a hold (scrollbar, Home/End, find-in-page) goes to the nearest rest.
//   no glide: steps commit instantly. The stage's content moves with a 180-240 ms CSS transform (scroll-story.css).
//
// THE WINDOW RULE (design C's guard, LK47: "no glide"): the only non-passive listeners on the page, `touchmove` and
// `wheel`, exist ONLY while a held story is within one screen of the viewport (nearSet). Everywhere else scrolling is
// 100% native and no listener can cancel it. A source test (data/tests/one_gesture_source_1104.test.mjs) forbids
// `passive: false` anywhere but attach() below. Listeners that cannot cancel anything (touchstart, touchend,
// touchcancel, click, hashchange) are passive and stay attached while any story is mounted, so the controller always
// knows how many fingers are down and where a jump is going.
import * as bus from './scrollBus.mjs';
import { drawnAncestor, undrawn } from './undrawn.js';
import {
  SETTLE_QUIET_MS, SLOP, WHEEL_MIN_PX, WHEEL_QUIET_MS,
  claimTouch, commitDirection, insideHold, keyDirection, leanFor, lockMs, nearestStep, restY, velocity, wheelBurst, wheelPx,
} from './storyGesture.mjs';

const stories = new Set();   // every mounted story handle
const nearSet = new Set();   // handles within one screen of the viewport: the window in which gestures are owned
let attached = false;
let passiveOn = false;

let touches = 0;
let g = null;                // the touch gesture in progress
let wb = null;               // the wheel burst in progress
let keepY = null;            // where a clamp holds the page (until the reader touches, wheels or presses a key)
let keepStory = null;
let busyUntil = 0;           // the lock after a step
let lastY = 0;
let settleTimer = 0;
let unsubBus = null;
let resizeObserver = null;

const now = () => performance.now();
const put = (y) => window.scrollTo({ top: y, behavior: 'instant' });
const restOf = (s, k) => restY(s.top, s.hold, s.steps, k);

// ---------------------------------------------------------------- geometry, cached (hot paths read only scrollY)

/** Re-measure a story's top and hold. Never inside a gesture; never inside a section content-visibility has skipped. */
export function measure(s) {
  if (!s.track?.isConnected || !s.stage?.isConnected) { s.ok = false; return; }
  if (undrawn(s.track)) { s.ok = false; return; }
  const box = s.track.getBoundingClientRect();
  s.top = Math.round(box.top + window.scrollY);
  s.height = s.track.offsetHeight;
  s.hold = Math.max(0, s.height - s.stage.offsetHeight);
  s.ok = s.hold > 0 && s.steps > 1;
}
const measureNear = () => { for (const s of nearSet) measure(s); };

const holding = (y = window.scrollY) => {
  for (const s of nearSet) if (s.ok && insideHold(s.top, s.hold, y)) return s;
  return null;
};

// ---------------------------------------------------------------- the content's lean and its settle (transform only)

let leanFrame = 0;
let leanTo = null;
const settleLeanTimers = new WeakMap();

// The lean is an inline transform on the stage element and a data-lean flag on it: NOT a custom property. Setting a
// custom property on a story's root restyles every element under it (about 500 in the Lab: 50 ms at 4x CPU, measured
// 4 Nov 2026), while an inline transform or a data attribute on one element costs 0.2 ms.
const leanTransform = (px) => `translate3d(0, ${px.toFixed(1)}px, 0)`;

function lean(s, dy) {
  leanTo = [s, leanFor(dy, s.reduced())];
  if (leanFrame) return;
  leanFrame = window.requestAnimationFrame(() => {
    leanFrame = 0;
    const [story, px] = leanTo;
    window.clearTimeout(settleLeanTimers.get(story));
    story.stage.dataset.lean = 'drag';
    story.stage.style.transform = leanTransform(px);
  });
}

/** Let go of the lean: the content settles back over the stage's own transition (240 ms), then the attribute goes. */
function release(s) {
  window.cancelAnimationFrame(leanFrame);
  leanFrame = 0;
  if (!s.stage.dataset.lean) return;
  s.stage.dataset.lean = 'settle';
  s.stage.style.transform = leanTransform(0);
  window.clearTimeout(settleLeanTimers.get(s));
  settleLeanTimers.set(s, window.setTimeout(() => {
    if (s.stage.dataset.lean === 'settle') { delete s.stage.dataset.lean; s.stage.style.removeProperty('transform'); }
  }, 320));
}

/** A step from a wheel, a key or a pick has no finger to lean with: the content starts 10 px the other way and settles. */
function nudge(s, dir) {
  if (s.reduced()) return;
  window.clearTimeout(settleLeanTimers.get(s));
  s.stage.dataset.lean = 'drag';
  s.stage.style.transform = leanTransform(-dir * 10);
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => release(s)));
}

// ---------------------------------------------------------------- committing a step

/** Show step `next` now and put the page on its resting place (invisible: the stage is sticky). Returns true if it moved. */
function commit(s, goal, { source }) {
  const from = s.step();
  const next = Math.max(0, Math.min(s.steps - 1, goal));
  if (next === from) return false;
  s.show(next);
  keepY = null;
  if (s.ok) put(restOf(s, next));
  busyUntil = now() + lockMs(s.reduced());
  if (source !== 'touch') nudge(s, next > from ? 1 : -1);
  return true;
}

const canStep = (s, dir) => (dir > 0 ? s.step() < s.steps - 1 : s.step() > 0);

/** A picked step (a chip, an arrow, focus): instant, never a glide. */
export function goTo(s, next) {
  const clamped = Math.max(0, Math.min(s.steps - 1, next));
  if (!s.ok) measure(s);
  if (clamped === s.step()) { if (s.ok && Math.abs(window.scrollY - restOf(s, clamped)) > 1 && insideHold(s.top, s.hold, window.scrollY)) put(restOf(s, clamped)); return; }
  commit(s, clamped, { source: 'pick' });
}

// ---------------------------------------------------------------- inner scrollers stay native

function scrollsInside(target, dir, boundary) {
  for (let node = target; node && node !== boundary && node !== document.body; node = node.parentElement) {
    if (node.nodeType !== 1) continue;
    if (node.scrollHeight <= node.clientHeight + 1) continue;
    if (!/(auto|scroll)/.test(getComputedStyle(node).overflowY)) continue;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    if (dir > 0 ? !atBottom : !atTop) return true;
  }
  return false;
}

// ---------------------------------------------------------------- touch

function onTouchStart(e) {
  touches = e.touches.length;
  keepY = null;
  bus.clearJump();
  if (touches !== 1) { g = null; return; }
  const p = e.touches[0];
  g = { x: p.clientX, y: p.clientY, story: holding(), claim: undefined, dir: 0, samples: [{ t: e.timeStamp, y: p.clientY }], target: e.target };
}

function onTouchMove(e) {
  if (!g) return;
  if (e.touches.length !== 1) { if (g.story) release(g.story); g = null; return; }
  const p = e.touches[0];
  const dx = p.clientX - g.x;
  const dy = p.clientY - g.y;
  g.samples.push({ t: e.timeStamp, y: p.clientY });
  if (g.samples.length > 10) g.samples.shift();
  if (g.claim === undefined) {
    if (!g.story) { g.claim = 'native'; return; }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) { if (e.cancelable) e.preventDefault(); return; }
    const dir = dy < 0 ? 1 : -1;
    g.claim = claimTouch({
      inStory: true, dx, dy, locked: now() < busyUntil, canStep: canStep(g.story, dir),
      scrollsInside: scrollsInside(g.target, dir, g.story.stage),
    });
    if (g.claim === 'own') g.dir = dir;
  }
  if (g.claim === 'native') return;
  if (e.cancelable) e.preventDefault();
  if (g.claim === 'own') lean(g.story, dy);
}

function onTouchEnd(e) {
  touches = e.touches ? e.touches.length : 0;
  const done = g;
  g = null;
  if (!done) { afterNativeTouch(); return; }
  if (done.claim === 'own') {
    const last = done.samples[done.samples.length - 1];
    const dy = last.y - done.y;
    const dir = commitDirection(dy, velocity(done.samples));
    const s = done.story;
    release(s);
    if (dir && canStep(s, dir)) commit(s, s.step() + dir, { source: 'touch' });
    return;
  }
  if (done.claim === 'spent') { if (done.story) release(done.story); return; }
  afterNativeTouch();
}

function onTouchCancel() {
  if (g?.story) release(g.story);
  g = null;
  touches = 0;
}

// A native touch ended with the page inside a hold: its momentum may not run through the steps. Hold the nearest rest.
function afterNativeTouch() {
  const s = holding();
  if (s) { keepStory = s; keepY = restOf(s, nearestStep(s.top, s.hold, s.steps, window.scrollY)); }
}

// ---------------------------------------------------------------- wheel and trackpad

function onWheel(e) {
  if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  bus.clearJump();
  const t = e.timeStamp > 0 ? e.timeStamp : now();
  const dir = e.deltaY > 0 ? 1 : -1;
  const next = wheelBurst(wb, { t, dir });
  if (next.fresh) {
    const s = holding();
    next.story = s;
    // A burst that starts inside the lock is swallowed whole: owned (so the page does not scroll) but never fired.
    next.fired = now() < busyUntil;
    next.own = !!s && (next.fired || (canStep(s, dir) && !scrollsInside(e.target, dir, s.stage)));
  } else {
    next.story = wb.story;
    next.own = wb.own;
  }
  wb = next;
  // A burst that is not the story's (it began outside a hold, or leaves it) leaves a clamp standing: the tail of a
  // wheel fling that arrives from outside is stopped at the first rest like any other fling. A burst the story owns
  // takes the page back.
  if (!wb.own) return;
  keepY = null;
  if (e.cancelable) e.preventDefault();
  wb.sum += wheelPx(e.deltaY, e.deltaMode);
  if (!wb.fired && now() >= busyUntil && wb.sum >= WHEEL_MIN_PX) {
    wb.fired = true;
    commit(wb.story, wb.story.step() + wb.dir, { source: 'wheel' });
  }
}

// ---------------------------------------------------------------- keys

const WIDGET = 'input, textarea, select, [contenteditable], [role="slider"], [role="tablist"], [role="radiogroup"], [role="listbox"], [role="menu"], [role="spinbutton"]';
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="tab"], [role="link"]';

function onKeyDown(e) {
  const dir = keyDirection(e.key);
  if (!dir || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest(WIDGET)) return;
  // Space presses a focused button or link: that is theirs, not a step.
  if ((e.key === ' ' || e.key === 'Spacebar') && target?.closest(PRESSABLE)) return;
  const s = holding();
  if (!s || (now() >= busyUntil && !canStep(s, dir))) return;
  keepY = null;
  bus.clearJump();
  e.preventDefault();
  if (!e.repeat && now() >= busyUntil) commit(s, s.step() + dir, { source: 'key' });
}

// ---------------------------------------------------------------- entry clamp and settle (from the shared scroll read)

function onFrame({ y }) {
  if (touches === 0 && keepY === null && !bus.jumping()) {
    for (const s of nearSet) {
      if (!s.ok) continue;
      const end = s.top + s.hold;
      if (lastY < s.top - 1 && y >= s.top) { keepStory = s; keepY = restOf(s, 0); }
      else if (lastY > end + 1 && y <= end) { keepStory = s; keepY = restOf(s, s.steps - 1); }
    }
  }
  if (keepY !== null && touches === 0 && Math.abs(y - keepY) > 1) {
    put(keepY);
    if (keepStory && keepStory.step() !== nearestStep(keepStory.top, keepStory.hold, keepStory.steps, keepY)) keepStory.show(nearestStep(keepStory.top, keepStory.hold, keepStory.steps, keepY));
  }
  lastY = window.scrollY;
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(settle, SETTLE_QUIET_MS);
}

function settle() {
  keepY = null;
  keepStory = null;
  if (touches > 0 || (wb && now() - wb.last < WHEEL_QUIET_MS)) return;
  const y = window.scrollY;
  const s = holding(y);
  if (!s) return;
  const k = nearestStep(s.top, s.hold, s.steps, y);
  const target = restOf(s, k);
  if (Math.abs(y - target) > 1) put(target);
  const from = s.step();
  if (from !== k) { s.show(k); nudge(s, k > from ? 1 : -1); }
}

// ---------------------------------------------------------------- declared jumps: links and hashes

function declareAnchor(hash) {
  if (!hash || hash === '#') return;
  let id = hash.slice(1);
  try { id = decodeURIComponent(id); } catch { /* keep the raw id */ }
  const el = document.getElementById(id);
  if (el) bus.jump(bus.anchorY(drawnAncestor(el)));
}

function onClick(e) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const anchor = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!anchor || (anchor.target && anchor.target !== '_self')) return;
  let url;
  try { url = new URL(anchor.href, window.location.href); } catch { return; }
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return;
  declareAnchor(url.hash);
}
const onHashChange = () => declareAnchor(window.location.hash);

// ---------------------------------------------------------------- listeners

function passiveListeners(on) {
  if (on === passiveOn) return;
  passiveOn = on;
  const fn = on ? 'addEventListener' : 'removeEventListener';
  window[fn]('touchstart', onTouchStart, { passive: true });
  window[fn]('touchend', onTouchEnd, { passive: true });
  window[fn]('touchcancel', onTouchCancel, { passive: true });
  document[fn]('click', onClick, { capture: true, passive: true });
  window[fn]('hashchange', onHashChange, { passive: true });
  document[fn]('contentvisibilityautostatechange', measureNear, { capture: true, passive: true });
  if (on) {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measureNear);
      resizeObserver.observe(document.documentElement);
    }
  } else {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }
}

// The two non-passive listeners live here and only here: attached while a story is near, detached when none is.
function attach() {
  if (attached) return;
  attached = true;
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  lastY = window.scrollY;
  unsubBus = bus.subscribe(onFrame);
  document.documentElement.dataset.storyWindow = 'on';
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener('touchmove', onTouchMove, { passive: false });
  window.removeEventListener('wheel', onWheel, { passive: false });
  window.removeEventListener('keydown', onKeyDown);
  unsubBus?.();
  unsubBus = null;
  window.clearTimeout(settleTimer);
  keepY = null;
  keepStory = null;
  g = null;
  wb = null;
  delete document.documentElement.dataset.storyWindow;
}

// ---------------------------------------------------------------- registration (ScrollStory)

/**
 * Register a mounted story. `handle`: { id, root, stage, track, steps, step(), show(n), reduced() }.
 * Returns the unregister function.
 */
export function register(handle) {
  const s = Object.assign(handle, { top: 0, hold: 0, height: 0, ok: false });
  stories.add(s);
  passiveListeners(true);
  return () => {
    stories.delete(s);
    nearSet.delete(s);
    release(s);
    if (!nearSet.size) detach();
    if (!stories.size) passiveListeners(false);
  };
}

/** The story came within one screen of the viewport (or left it): gestures are owned only inside this window. */
export function near(s, on) {
  if (on) {
    nearSet.add(s);
    measure(s);
    attach();
  } else {
    nearSet.delete(s);
    if (!nearSet.size) detach();
  }
}

export const isAttached = () => attached;
