// scrollBus: the home page's one scroll reader (LK69, 4 Nov 2026).
//
// Before this, four things each ran their own scroll listener and their own rAF per scroll event (the object lean
// loop, Pip's gaze, Pip's one-Mobi check, the position band, the story's side check). Now there is one passive
// `scroll` listener, one rAF per frame and one read of scrollY and the window per frame, handed to whoever
// subscribed. Nothing here is non-passive and nothing here cancels a scroll.
//
//   const off = subscribe(({ y, dy, vh, vw, t, resized }) => { ... });   // once per frame, only when the page moved
//   hold('lab', true) / held()      a held story is on screen: loops that follow the scroll (the lean, Pip's gaze) sleep
//   jump(y) / instantTo(y)          a programmatic move (nav link, hash, demo link) declares its target, so a story's
//                                    edge clamp does not mistake the arrival for a fling and hold it at the first rest
//
// The only module state is a few numbers; it is safe to import on every page (ObjectLife does).

const subs = new Set();
const holds = new Set();
const state = { y: 0, dy: 0, vh: 0, vw: 0, t: 0, resized: false };
let listening = false;
let frame = 0;
let resizedFlag = false;

const canRun = () => typeof window !== 'undefined';

function run(t) {
  frame = 0;
  const y = window.scrollY;
  state.dy = y - state.y;
  state.y = y;
  state.vh = window.innerHeight;
  state.vw = window.innerWidth;
  state.t = t;
  state.resized = resizedFlag;
  resizedFlag = false;
  jumpFrame(y);
  if (!state.dy && !state.resized) return;
  for (const fn of [...subs]) fn(state);
}

const wake = () => { if (!frame) frame = window.requestAnimationFrame(run); };
const onResize = () => { resizedFlag = true; wake(); };

function listen(on) {
  if (!canRun() || on === listening) return;
  listening = on;
  if (on) {
    state.y = window.scrollY;
    state.vh = window.innerHeight;
    state.vw = window.innerWidth;
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
  } else {
    window.removeEventListener('scroll', wake);
    window.removeEventListener('resize', onResize);
    window.cancelAnimationFrame(frame);
    frame = 0;
  }
}

/** Subscribe to the per-frame read. Returns the unsubscribe. The listener is attached with the first subscriber. */
export function subscribe(fn) {
  subs.add(fn);
  listen(true);
  return () => {
    subs.delete(fn);
    if (!subs.size && jumpY === null) listen(false);
  };
}

/** The last read (or a fresh one when nobody is subscribed). */
export function read() {
  if (!canRun()) return state;
  if (!listening) { state.y = window.scrollY; state.vh = window.innerHeight; state.vw = window.innerWidth; }
  return state;
}

// ---- held stories: loops that follow the scroll sleep while one is on screen --------------------------------------

export function hold(id, on) {
  if (on) holds.add(id); else holds.delete(id);
}
export const held = () => holds.size > 0;

// ---- declared jumps -------------------------------------------------------------------------------------------------
// A story clamps a fling that carries the page across its first or last resting place from outside, so a flick never
// runs through a story. A link, a hash or the demo button that moves the page on purpose says where it is going first;
// until the page arrives (within 3 px), stops for 180 ms or the reader touches, wheels or presses a key, nothing is
// clamped.

const JUMP_QUIET_MS = 180;
const JUMP_MAX_MS = 4000;
const USER_INPUT = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
let jumpY = null;
let jumpAt = 0;
let jumpTimer = 0;
let jumpInputOn = false;

function jumpInput(on) {
  if (on === jumpInputOn || !canRun()) return;
  jumpInputOn = on;
  for (const type of USER_INPUT) {
    if (on) window.addEventListener(type, clearJump, { passive: true });
    else window.removeEventListener(type, clearJump);
  }
}

function armJump() {
  window.clearTimeout(jumpTimer);
  jumpTimer = window.setTimeout(clearJump, JUMP_QUIET_MS);
}

function jumpFrame(y) {
  if (jumpY === null) return;
  if (Math.abs(y - jumpY) <= 3 || performance.now() - jumpAt > JUMP_MAX_MS) { clearJump(); return; }
  armJump();
}

export function jump(y) {
  if (!canRun()) return;
  jumpY = Math.round(Number.isFinite(y) ? y : window.scrollY);
  jumpAt = performance.now();
  jumpInput(true);
  listen(true);
  armJump();
}

export function clearJump() {
  if (jumpY === null && !jumpInputOn) return;
  jumpY = null;
  window.clearTimeout(jumpTimer);
  jumpInput(false);
  if (!subs.size) listen(false);
}

export const jumping = () => jumpY !== null;

/** A programmatic move that is instant (never a glide) and declared: nav hash settles, the demo link. */
export function instantTo(y) {
  if (!canRun()) return;
  jump(y);
  window.scrollTo({ top: Math.round(y), behavior: 'instant' });
}

/** The document y of an in-page anchor's target, as the browser would scroll to it (its scroll margin kept). */
export function anchorY(element) {
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return Math.round(window.scrollY + element.getBoundingClientRect().top - margin);
}
