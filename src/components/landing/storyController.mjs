// The gesture controller for the landing's held stories (LK69, ported from the bench in
// tmp/home-1104/scroll/prototype-one-gesture-v2.html, which gave exactly one step for 32 of 32 flick cells).
//
// One controller serves every story on the page (a ScrollStory registers itself; see ScrollStory.jsx):
//   touch   one finger, one step. The step is chosen at touchend from the NET travel (40 px, or a 12 px flick at
//           0.3 px/ms), never from speed, so a hard flick and a slow drag both move exactly one step.
//   wheel   one burst (notches, or a trackpad swipe and its inertia tail) moves one step.
//   keys    arrows, PageUp/Down and Space move one step per press.
//   lock    a gesture that starts within 420 ms (120 ms under reduced motion) of a step is swallowed whole.
//   clamp   a fling, or a finger's drag, that carries the page across a story's first or last resting place from
//           OUTSIDE is held there, so a flick or a long swipe never runs through a story. Exits stay free.
//   settle  a native scroll that ends inside a hold (scrollbar, Home/End, find-in-page) goes to the nearest rest.
//   no glide: steps commit instantly. The stage's content moves with a 180-240 ms CSS transform (scroll-story.css).
//
// FLOW (10 Nov 2026, owner LK190: held stories felt "very locked in" on phones, and a page that scrolls past them shows
// no features). A story whose handle says flow() (a touch screen, storyGesture.mjs FLOW_QUERY) never takes a touch: no
// finger is owned, nothing is cancelled and its track is never marked, so the browser pans the page under the finger
// everywhere. A mouse wheel or a key on such a device still moves one step, and a picked step (a tab, an arrow) is
// unchanged. A passage (handle.land off: the statement) has only the `settle`: it shows the step under the window's
// middle as the page passes (ScrollStory's observer) and a scroll that comes to REST inside it goes to the nearest rest.
//
// FLOW v2, the steered story (10 Nov 2026, owner LK192: with the step chosen by position alone a normal swipe "skips
// too much or too little"; a flick that runs on is expected; not held). In a story with slides (handle.land) the
// GESTURE chooses the step and the page follows it:
//   a swipe   released slower than FLOW_FLICK_V is exactly one step. The next step shows as soon as the page has gone
//             FLOW_COMMIT_PX under the finger (back inside FLOW_CANCEL_PX takes it back); when the finger lifts the
//             page is put on that step's rest and kept there while the momentum runs out, which nobody sees because
//             the stage is sticky. No lock follows and no gesture is refused: the next swipe steps at once.
//   a flick   (FLOW_FLICK_V or faster) is the reader's: the steps follow the page as it flies (ScrollStory shows them
//             a moment late so they do not strobe) and the scroll settles on the nearest rest, never behind the step
//             the swipe had shown.
//   arriving  a swipe that brings the story on lands on the step at the door it came by (the first from above, the
//             last from below), every time. A flick lands only on its first arrival from above (`landed`).
//   leaving   by the last step going down, or the first going up, is the browser's own scroll.
//   the hold  is a put per frame, measured to stay put on Chromium (Android Chrome, 6 Nov 2026). Where that is not
//             known (canHold: Safari, Firefox) nothing is put while the page still moves: the step is shown, and the
//             settle puts the page on its rest once the scroll has ended, or lets it go if the momentum left the story.
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
  FLOW_CANCEL_PX, FLOW_COMMIT_PX, FLOW_EDGE_PX, FLOW_FLICK_V, FLOW_PASS_MS, FLOW_STILL_MS, SETTLE_QUIET_MS, SLOP, WHEEL_MIN_PX, WHEEL_QUIET_MS,
  claimTouch, commitDirection, insideHold, keyDirection, leanFor, lockMs, nearestStep, pageVelocity, restY, velocity, wheelBurst, wheelPushes, wheelPx,
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
let keepDir = 0;             // how the clamped page came in: +1 from above, -1 from below (a finger may turn back out)
let governed = null;         // FLOW v2: the steered story whose step the reader's gesture decides right now (its observer stands by)
let aim = null;              // FLOW v2: { s, k, dir }: the step a settle inside s goes to (dir 0: exactly k; +1 or -1: k or further that way)
let lastFlick = false;       // FLOW v2: the last touch moved the page and left the glass as a flick (its momentum is the reader's)
let lastSwipe = false;       // FLOW v2: ... or as a normal swipe (its momentum lands on the step it chose)
let busyUntil = 0;           // the lock after a step
let lastRelease = -Infinity; // when the last finger left the glass (a fling's momentum runs on after it)
let lastY = 0;
let settleTimer = 0;
let unsubBus = null;
let unsubJump = null;
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

/** FLOW: this story never holds the page (a touch screen); it only settles a scroll that has come to rest inside it. */
const flowing = (s) => !!s && typeof s.flow === 'function' && s.flow() === true;
/** The story that holds the page at y: none while the story there flows. */
const gripping = (y = window.scrollY) => { const s = holding(y); return s && !flowing(s) ? s : null; };
/** FLOW: may this story still land a fling? Once per story, and only a story that asked to (a passage like the statement does not). */
const lands = (s) => s.land === true && !s.landed;
const gapOf = (s) => s.hold / Math.max(1, s.steps - 1);

/** FLOW v2: a story with slides on a touch screen. The gesture chooses its step (a passage, land off, only settles). */
const steered = (s) => flowing(s) && s.land === true;
/** FLOW v2: can the page be kept where it is put while a fling runs? Measured on Chromium; elsewhere only the settle puts. */
const canHold = () => touchPans();

/** FLOW v2: the controller is deciding this story's step (a finger on it, a swipe's momentum): its observer stands by. */
export const governs = (s) => !!s && governed === s;
/** FLOW v2: a flick's momentum may be running through this story: it shows the steps it passes a moment late. */
export const passing = (s) => steered(s) && lastFlick && touches === 0 && now() - lastRelease < FLOW_PASS_MS;

/** FLOW v2, a finger inside a steered story: the next step shows as soon as the page has gone FLOW_COMMIT_PX under it. */
function steer(gest, y) {
  const s = gest.flow;
  const travel = y - gest.pageY;
  const dir = travel >= FLOW_COMMIT_PX ? 1 : travel <= -FLOW_COMMIT_PX ? -1 : Math.abs(travel) <= FLOW_CANCEL_PX ? 0 : gest.flowDir;
  if (dir === gest.flowDir) return;
  gest.flowDir = dir;
  const goal = gest.k0 + dir;
  gest.flowOut = goal < 0 || goal > s.steps - 1; // no step that way: the finger is on its way out of the story
  governed = gest.flowOut ? null : s;
  if (!gest.flowOut && s.step() !== goal) s.show(goal);
}

/**
 * FLOW v2: step k is the one, and the page belongs on its rest. Where the page can be held it is put there now and kept
 * there while the momentum runs out (dir: the way that momentum points); elsewhere the settle puts it once it has stopped.
 */
function flowHold(s, k, dir, stop = false) {
  governed = s;
  aim = { s, k, dir: 0 };
  if (s.step() !== k) s.show(k);
  if (!canHold()) return;
  // Momentum that points out of the story (the last step going down, the first going up) has no pinned room to run in:
  // it is kept a little inside the edge, where a frame of it still moves nothing on screen, and stopped. The settle then
  // puts the page on the rest itself.
  const out = dir > 0 ? k >= s.steps - 1 : dir < 0 ? k <= 0 : false;
  keepStory = s;
  keepDir = dir || 1;
  keepY = restOf(s, k) - (out ? dir * Math.min(FLOW_EDGE_PX, Math.round(gapOf(s) / 4)) : 0);
  // A stop restyles the page, so only a flick's landing and momentum that points out get one: the rest runs out unseen.
  stoppedAt = stop || out ? null : keepY;
  if (Math.abs(window.scrollY - keepY) > 1) put(keepY);
}

/** FLOW v2: the page has left a story the gesture was deciding (momentum nothing held, a finger dragging on). */
function letGo(s, y) {
  governed = null;
  aim = null;
  const k = y > s.top + s.hold ? s.steps - 1 : 0;
  if (s.step() !== k) s.show(k);
}

// ---------------------------------------------------------------- touch screens: what the browser may pan (R5, LK161)

// Measured on Android Chrome (6 Nov 2026): a swipe that starts while the last fling still runs reaches the page
// uncancelable (Chrome treats touch listeners as passive during a fling), so no preventDefault could stop it and one
// swipe flew the page through 2-3 steps. While the page rests inside a hold, the held track says which step it is on
// (data-held: first, mid, last; scroll-story.css): on a touch screen the browser may then pan only the way out of the
// story (up from the first step, down from the last) and not at all between, whatever the page can cancel. Steps are
// the controller's alone.
let heldTrack = null;
let heldEdge = '';
function syncHeld(y = window.scrollY) {
  const s = gripping(y); // a flowing story is never marked: the browser pans through it both ways
  const edge = !s ? '' : s.steps < 2 ? 'both' : s.step() <= 0 ? 'first' : s.step() >= s.steps - 1 ? 'last' : 'mid';
  const track = s ? s.track : null;
  if (track === heldTrack && edge === heldEdge) return;
  if (heldTrack && heldTrack !== track) markHeld(heldTrack, '');
  if (track) markHeld(track, edge);
  heldTrack = track;
  heldEdge = edge;
}

// A fling that stopped a few px short of a story's edge leaves the page just outside it (8 px, measured): a touch on that
// story's track takes the page onto the edge's rest and is the story's, so it steps once instead of flying through.
// A touch fling put back on a story's edge keeps running underneath on Android Chrome (measured, 6 Nov 2026): the next
// swipe, a moment later, "boosts" it past every step, before any page rule can act. Making the root unscrollable for one
// frame ends the fling where the page stands (Chrome keeps the scroll position). Only where directional pans exist (the
// browsers that need it); never on a mouse or trackpad; one frame, so the page is never left frozen.
let flingStopped = 0;
let stoppedAt = null; // the clamp a fling was last stopped on: once per catch, never every frame (each stop costs a page restyle)
function stopFling() {
  if (typeof document === 'undefined' || !touchPans()) return;
  const html = document.documentElement;
  if (flingStopped || html.style.overflowY === 'hidden') return;
  const before = html.style.overflowY;
  html.style.overflowY = 'hidden';
  flingStopped = window.requestAnimationFrame(() => { html.style.overflowY = before; flingStopped = 0; });
}
let pans = null;
let panList = null;
function touchPans() {
  if (pans === null) pans = typeof CSS !== 'undefined' && !!CSS.supports?.('touch-action', 'pan-up') && typeof window.matchMedia === 'function';
  if (!pans) return false;
  panList ??= window.matchMedia('(pointer: coarse)'); // kept: asked inside gestures, and a tablet may gain or lose its mouse
  return panList.matches === true;
}

// A class, not a data attribute: an attribute write restyled the whole story (40-80 ms at 4x CPU, measured); a class
// toggle is invalidated precisely (5-12 ms).
const HELD = ['held-first', 'held-mid', 'held-last', 'held-both'];
const markHeld = (track, edge) => { if (!track?.classList) return; track.classList.remove(...HELD); if (edge) track.classList.add(`held-${edge}`); };
const ADOPT_PX = 64;
function adoptEdge(target) {
  if (!target) return null;
  const y = window.scrollY;
  for (const s of nearSet) {
    if (!s.ok || s.steps < 2 || flowing(s) || typeof s.track?.contains !== 'function' || !s.track.contains(target)) continue;
    const end = s.top + s.hold;
    const k = y < s.top && s.top - y <= ADOPT_PX ? 0 : y > end && y - end <= ADOPT_PX ? s.steps - 1 : -1;
    if (k < 0) continue;
    put(restOf(s, k));
    if (s.step() !== k) s.show(k);
    syncHeld(restOf(s, k));
    return s;
  }
  return null;
}

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
  governed = null; // a step from a wheel, a key or a pick is its own decision: no swipe's choice outlives it
  aim = null;
  if (s.ok) put(restOf(s, next));
  // The held mark follows at rest (settle, 150 ms on): marked here it restyled the whole story inside the step's own
  // frame, ~90 ms at 4x CPU (measured, LK169).
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(settle, SETTLE_QUIET_MS);
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
  governed = null;
  aim = null;
  stoppedAt = null;
  bus.clearJump();
  if (touches !== 1) { g = null; return; }
  const p = e.touches[0];
  const story = gripping() ?? adoptEdge(e.target);
  const here = holding();
  const flow = steered(here) ? here : null;
  lastY = window.scrollY;
  // FLOW v2: from the moment a finger is on a steered story, the step it shows is the reader's, not the page position's.
  if (flow) governed = flow;
  // Outside a hold, the compositor can scroll before the first touchmove reaches the controller.
  g = { x: p.clientX, y: p.clientY, story, claim: story ? undefined : 'native', dir: 0, samples: [{ t: e.timeStamp, y: p.clientY }], target: e.target, pageY: lastY, pages: [{ t: now(), y: lastY }], flow, k0: flow ? flow.step() : 0, flowDir: 0, flowOut: false };
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
  lastRelease = now();
  const done = g;
  g = null;
  // FLOW v2: how the finger left, and only if the page moved under it. The finger's own speed over its last 80 ms, the
  // one the browser flings by. Where its samples are too far apart to give one (a browser may hand a scrolling page a
  // touchmove only every 200 ms), the page's travel under it, frame by frame: never both, because a page that starts
  // scrolling late catches up in a jump that reads faster than the finger ever moved (measured: 2 px/ms read as 3).
  const moved = !!done && Math.abs(window.scrollY - done.pageY) > 2;
  const finger = moved && e.timeStamp - done.samples[done.samples.length - 1].t <= FLOW_STILL_MS ? Math.abs(velocity(done.samples)) : 0;
  lastFlick = moved && (finger || Math.abs(pageVelocity(done.pages, now()))) >= FLOW_FLICK_V;
  lastSwipe = moved && !lastFlick;
  if (!done) { afterNativeTouch(null); return; }
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
  afterNativeTouch(done);
}

function onTouchCancel() {
  lastRelease = now();
  if (g?.story) release(g.story);
  g = null;
  touches = 0;
  governed = null;
  aim = null;
}

/** FLOW v2: a finger has left the glass with the page inside a steered story. */
function afterSwipe(s, done) {
  if (done && done.flow === s) {
    // The touch began inside the story, on step k0.
    const goal = done.flowDir && !done.flowOut ? done.k0 + done.flowDir : null;
    if (lastFlick) {
      // A flick: the momentum is the reader's. It never settles behind the step the swipe had shown.
      governed = null;
      aim = goal === null ? null : { s, k: goal, dir: done.flowDir };
    } else if (goal !== null) flowHold(s, goal, done.flowDir); // a swipe: exactly that one step
    else if (done.flowOut) { governed = null; aim = null; }    // on its way out by the story's own edge
    else aim = { s, k: done.k0, dir: 0 };                      // no swipe at all (a tap, a nudge): the step shown stays
    return;
  }
  // The finger began outside and brought the story on: a swipe lands on the step at the door it came by, every time; a
  // flick only on its first arrival from above.
  const began = done && typeof done.pageY === 'number' ? done.pageY : null;
  const door = began === null ? 0 : began < s.top ? 1 : began > s.top + s.hold ? -1 : 0;
  if (door && (lastSwipe || (lastFlick && door > 0 && lands(s)))) flowHold(s, door > 0 ? 0 : s.steps - 1, door, lastFlick);
  else { governed = null; aim = null; }
}

// A native touch ended with the page inside a hold: its momentum may not run through the steps. Hold the nearest rest.
function afterNativeTouch(done) {
  if (keepY !== null) return;
  const s = holding();
  if (!s) { governed = null; aim = null; return; }
  // FLOW: the page is settled once it has come to rest (a finger lifted without a fling makes no more scroll frames, so
  // the settle is asked for here as well). A steered story also takes the swipe's one step (v2).
  if (flowing(s)) {
    if (steered(s)) afterSwipe(s, done);
    s.landed = true;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, SETTLE_QUIET_MS);
    return;
  }
  keepStory = s;
  keepY = restOf(s, nearestStep(s.top, s.hold, s.steps, window.scrollY));
}

// ---------------------------------------------------------------- wheel and trackpad

function onWheel(e) {
  if (e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  bus.clearJump();
  const t = e.timeStamp > 0 ? e.timeStamp : now();
  const dir = e.deltaY > 0 ? 1 : -1;
  const px = wheelPx(e.deltaY, e.deltaMode);
  const next = wheelBurst(wb, { t, dir });
  if (next.fresh) {
    const s = holding();
    next.story = s;
    // A burst that starts inside the lock is swallowed whole: owned (so the page does not scroll) but never fired.
    next.fired = now() < busyUntil;
    if (next.fired) next.firedAt = t;
    next.own = !!s && (next.fired || (canStep(s, dir) && !scrollsInside(e.target, dir, s.stage)));
  } else {
    next.story = wb.story;
    next.own = wb.own;
    // A wheel still turning after its step (a mouse spun on and on), or a second push inside the burst: once the lock is
    // over it steps again, or, from the story's last rest, leaves it. Without this a mouse spun without a pause stood
    // still in a story until the hand stopped (6 Nov 2026, R5). A trackpad's falling momentum never re-arms.
    // The lock is measured on the events' own clock as well as the page's: a fast spin (30 notches 10 ms apart) is one
    // step however late its events are handled.
    if (next.own && next.fired && next.story && now() >= busyUntil && t - (next.firedAt ?? t) >= lockMs(next.story.reduced()) && wheelPushes(wb.px, px)) {
      if (canStep(next.story, dir) && !scrollsInside(e.target, dir, next.story.stage)) { next.fired = false; next.sum = 0; }
      else next.own = false;
    }
  }
  next.px = px;
  wb = next;
  // A burst that is not the story's (it began outside a hold, or leaves it) leaves a clamp standing: the tail of a
  // wheel fling that arrives from outside is stopped at the first rest like any other fling. A burst the story owns
  // takes the page back.
  if (!wb.own) {
    // The notch that would carry the page across a story's edge lands on the edge instead of overshooting it and being
    // put back a frame later (a 47-100 px kick at every story's door, R5). A notch can scroll more than its deltaY says
    // (Chrome at device scale 2 reports 50 for a 100 px notch), so look ahead twice the delta, at least 120 px: landing
    // on the edge a little early is invisible, overshooting it is not.
    const s = keepY === null && !bus.jumping() ? edgeAhead(window.scrollY, dir, Math.max(2 * px, 120)) : null;
    if (s) {
      if (e.cancelable) e.preventDefault();
      keepStory = s;
      keepDir = dir;
      keepY = restOf(s, dir > 0 ? 0 : s.steps - 1);
      put(keepY);
      catchWheel(s, t);
    }
    return;
  }
  keepY = null;
  if (e.cancelable) e.preventDefault();
  wb.sum += px;
  if (!wb.fired && now() >= busyUntil && wb.sum >= WHEEL_MIN_PX) {
    wb.fired = true;
    wb.firedAt = t;
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

// A finger that is scrolling the page natively (it began outside every hold, or is leaving one). When such a drag carries
// the page into another story's hold, that story holds it on the rest it came in by, finger down or not (5 Nov 2026,
// LK90: a fast 600 px swipe from above the statement dragged the page 240 px into its hold before the finger lifted,
// and the release then held the nearest rest, step 1 or 2: steps were skipped). The page is held only against going
// further in; a finger that turns back out is free. Inside a hold the stage is sticky, so the hold itself never shows.
const dragging = () => touches === 1 && g !== null && g.claim === 'native';

// Only a gesture is clamped: a finger's drag (above), the momentum of a touch that just ended, or a wheel burst still
// running. A scroll with no such gesture behind it (the scrollbar dragged, End, find-in-page, a script's instant jump) is the reader's or the
// page's own choice of place, so it is never pulled back to a story's edge; if it ends inside a hold, settle() takes it
// to the nearest rest.
const FLING_MS = 3000;
const wheelRunning = () => wb !== null && now() - wb.last < WHEEL_QUIET_MS * 2;
const flinging = () => now() - lastRelease < FLING_MS || wheelRunning();

// A wheel burst that began outside a story and has carried the page to its edge: the story takes the rest of the burst,
// so the wheel's next notches no longer scroll the page in only to be put back on the edge. Before this a mouse spun down
// the page shook 100 px at the Mistake Lab's door and could not get in while the wheel turned (6 Nov 2026, R5 feedback).
// The arrival counts as a step for the lock; a wheel still turning after it steps on (wheelPushes, in onWheel).
function catchWheel(s, t = wb.last) {
  wb = { ...wb, story: s, own: true, fired: true, firedAt: t };
  busyUntil = now() + lockMs(s.reduced());
}

/** The near story whose edge a wheel move of px from y (direction dir) would cross into, if any. */
function edgeAhead(y, dir, px) {
  for (const s of nearSet) {
    if (!s.ok || s.steps < 2) continue;
    const end = s.top + s.hold;
    if (dir > 0 && y < s.top && y + px >= s.top) return s;
    if (dir < 0 && y > end && y - px <= end) return s;
  }
  return null;
}

function onFrame({ y }) {
  const drag = dragging();
  // FLOW v2: where the page is under the finger, frame by frame (the swipe's travel and its speed are read from this).
  if (g && touches === 1) { g.pages.push({ t: now(), y }); if (g.pages.length > 12) g.pages.shift(); }
  if (drag && g.flow) steer(g, y);
  // FLOW v2: the page has left a story the gesture was deciding, with nothing holding it there: the reader is past it.
  if (governed && keepY === null && !(drag && g.flow === governed) && !insideHold(governed.top, governed.hold, y)) letGo(governed, y);
  if (keepY === null && !bus.jumping() && (drag || (touches === 0 && flinging()))) {
    for (const s of nearSet) {
      if (!s.ok || (drag && s === g.story)) continue;
      // FLOW: a passage is never caught. A steered story is: by the swipe that brings it on, and by its first flick from above.
      if (flowing(s)) {
        if (!steered(s)) continue;
        const endOf = s.top + s.hold;
        if (drag) {
          // A finger that began outside is inside now: the door's step is shown under it. Never a hold: the finger walks on.
          if (g.flow !== s && governed !== s && y >= s.top && y <= endOf) { governed = s; const k = g.pageY < s.top ? 0 : s.steps - 1; if (s.step() !== k) s.show(k); }
          continue;
        }
        const down = lastY < s.top && y >= s.top;
        const up = lastY > endOf && y <= endOf;
        if (!down && !up) continue;
        const swipe = lastSwipe && now() - lastRelease < FLING_MS; // a swipe's momentum lands on the door's step, every time
        if (!swipe && (!down || !lands(s))) continue;                // a flick (or a wheel) only on its first arrival from above
        s.landed = true;
        flowHold(s, down ? 0 : s.steps - 1, down ? 1 : -1, !swipe);
        break;
      }
      const end = s.top + s.hold;
      // Strictly outside before, inside now: a frame 1 px short of the edge (1735 for a top of 1736, measured) is still
      // outside, or a fling that paused there crossed uncaught and flew through every step (LK169).
      if (lastY < s.top && y >= s.top) { keepStory = s; keepY = restOf(s, 0); keepDir = 1; }
      else if (lastY > end && y <= end) { keepStory = s; keepY = restOf(s, s.steps - 1); keepDir = -1; }
      else continue;
      if (!drag && wheelRunning()) catchWheel(s);
      break;
    }
  }
  if (keepY !== null && drag && (keepDir > 0 ? y < keepY - 1 : y > keepY + 1)) { keepY = null; keepStory = null; }
  if (keepY !== null && (touches === 0 || drag) && Math.abs(y - keepY) > 1) {
    put(keepY);
    // The held mark waits for rest (settle): marking mid-fling changed the track's touch-action, and Chrome restyled the
    // whole story in the scroll handler, a 100 ms frame at 4x CPU on every catch (measured, LK169).
    if (touches === 0 && now() - lastRelease < FLING_MS && stoppedAt !== keepY) { stoppedAt = keepY; stopFling(); }
    if (keepStory && keepStory.step() !== nearestStep(keepStory.top, keepStory.hold, keepStory.steps, keepY)) keepStory.show(nearestStep(keepStory.top, keepStory.hold, keepStory.steps, keepY));
  }
  lastY = window.scrollY;
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(settle, SETTLE_QUIET_MS);
}

function settle() {
  if (dragging() && keepY !== null) return; // a finger still down keeps its hold (it may move again)
  keepY = null;
  stoppedAt = null; // the next catch may stop its own fling
  keepStory = null;
  if (touches > 0 || (wb && now() - wb.last < WHEEL_QUIET_MS)) return;
  const want = aim;
  governed = null;
  aim = null;
  const y = window.scrollY;
  const s = holding(y);
  if (!s) { syncHeld(y); return; }
  s.landed = true; // FLOW: the reader has come to rest inside this story, however they got here: it never lands a fling now
  let k = nearestStep(s.top, s.hold, s.steps, y);
  // FLOW v2: the step the gesture chose, not the rest its momentum happened to stop nearest to.
  if (want && want.s === s) k = want.dir > 0 ? Math.max(k, want.k) : want.dir < 0 ? Math.min(k, want.k) : want.k;
  const target = restOf(s, k);
  if (Math.abs(y - target) > 1) put(target);
  const from = s.step();
  if (from !== k) { s.show(k); nudge(s, k > from ? 1 : -1); }
  syncHeld(target);
}

// ---------------------------------------------------------------- declared jumps: links and hashes

// A declared jump (a link, a hash, the demo key, the bus's instantTo) is the page's own move: no hold from before it
// survives it, and the tap that started it is not a fling (5 Nov 2026, LK89). Before this, the tap's touchend counted
// as a fling for 3 s and a hold set at that touchend (afterNativeTouch) was never cleared, so a jump across a near
// story was put back on that story's edge, again after each correction: the page ended on the story's last step.
function standDown() {
  keepY = null;
  keepStory = null;
  governed = null;
  aim = null;
  lastRelease = -Infinity;
}

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
  standDown();
  // A link someone else has taken over (DemoJump) declares its own jump; this one would only race it.
  if (!e.defaultPrevented) declareAnchor(url.hash);
}
function onHashChange() {
  standDown();
  declareAnchor(window.location.hash);
}

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
    unsubJump = bus.onJump(standDown);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measureNear);
      resizeObserver.observe(document.documentElement);
      // The body too: on the landing <html> is one window tall, so its box never changes when the page's content
      // does. A story's --ss-slack (written a frame after its section is first drawn) moved the tracks below by up to
      // 200 px with nothing re-measuring, and the clamp then held the page 43 to 200 px off the first rest (5 Nov 2026,
      // LK90, measured at 1440 on the tour and the Recovery Lab).
      if (document.body) resizeObserver.observe(document.body);
    }
  } else {
    unsubJump?.();
    unsubJump = null;
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
  if (heldTrack) markHeld(heldTrack, '');
  heldTrack = null;
  heldEdge = '';
  keepY = null;
  keepStory = null;
  governed = null;
  aim = null;
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
