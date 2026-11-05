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
//   onJump(fn)                      hear each declared jump as it is declared (the story controller drops any hold)
//   glideTo(y, { ms, done })        the reader's own way back to a place within three screens (R3-D4): a declared jump
//                                    for its whole length, ended by any input of the reader's (pageJump.mjs)
//
// The only module state is a few numbers; it is safe to import on every page (ObjectLife does).

const subs = new Set();
const holds = new Set();
const state = { y: 0, dy: 0, vh: 0, vw: 0, t: 0, resized: false, landed: false };
let listening = false;
let frame = 0;
let resizedFlag = false;
let landedFlag = false;      // a declared jump has just ended: one more frame, so whoever ignored the beats on the way can read where it landed

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
  const landed = landedFlag;
  landedFlag = false;
  state.landed = landed;
  // The subscribers first, then the jump's arrival check (5 Nov 2026, LK89). An instant jump arrives on its first frame:
  // checked first, it cleared jumping() before the story controller read it, so the controller took the arrival for a
  // fling across a near story and held the page on that story's edge. Now the landing frame still reads jumping(), and
  // the frame after it carries `landed`.
  if (state.dy || state.resized || landed) for (const fn of [...subs]) fn(state);
  // A subscriber may have moved the page (the story controller holding it on a rest). The next frame's dy is measured
  // from where the page was left, not from where it was read (LK90: a drag held on a rest moved back to the same y on
  // the next frame read as no move at all, so that frame skipped the subscribers and the page got past the hold).
  state.y = window.scrollY;
  jumpFrame(y);
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
    if (on) window.addEventListener(type, userTook, { passive: true });
    else window.removeEventListener(type, userTook);
  }
}

function armJump() {
  window.clearTimeout(jumpTimer);
  jumpTimer = window.setTimeout(clearJump, JUMP_QUIET_MS);
}

function jumpFrame(y) {
  if (jumpY === null) return;
  if (gliding) { armJump(); return; } // a glide's frames pass far from its end: it has not arrived until it ends
  if (Math.abs(y - jumpY) <= 3 || performance.now() - jumpAt > JUMP_MAX_MS) { clearJump(); return; }
  armJump();
}

// Whoever holds the page against a fling (the story controller) hears every declared jump the moment it is declared:
// a jump is the page's own move, so a hold left over from the tap that started it must not pull the page back.
const jumpWatchers = new Set();
export function onJump(fn) {
  jumpWatchers.add(fn);
  return () => jumpWatchers.delete(fn);
}

export function jump(y) {
  if (!canRun()) return;
  jumpY = Math.round(Number.isFinite(y) ? y : window.scrollY);
  jumpAt = performance.now();
  jumpInput(true);
  listen(true);
  armJump();
  for (const fn of [...jumpWatchers]) fn(jumpY);
}

export function clearJump() {
  if (jumpY === null && !jumpInputOn) return;
  const was = jumpY !== null;
  jumpY = null;
  window.clearTimeout(jumpTimer);
  jumpInput(false);
  if (!subs.size) { listen(false); return; }
  // The jump ended (it arrived, went quiet, or the reader took over): one frame for the subscribers, even if the page
  // did not move in it, so a story that ignored the beats on the way reads the one it landed on (ScrollStory).
  if (was) { landedFlag = true; wake(); }
}

export const jumping = () => jumpY !== null;

/** A programmatic move that is instant (never a glide) and declared: nav hash settles, the demo link. */
export function instantTo(y) {
  if (!canRun()) return;
  jump(y);
  window.scrollTo({ top: Math.round(y), behavior: 'instant' });
}

// ---- the reader's own way back (R3-D4, LK104, 5 Nov 2026) -------------------------------------------------------------
// The one glide on the landing. LK47 ("no glide") still holds for everything the page does on its own; this runs only
// when the reader asks for a place (the logo on the home page, the bottom bar's Top and Skip, the phone nav's Pricing
// pill, pageJump.mjs) and the place is within three screens. It is a declared jump for its whole length: no story clamps
// it and no beat steps a story on the way. Any touch, wheel, key or pointer press clears the jump, and with it the glide:
// the reader always wins. Each frame is an instant move ('instant', not 'auto', which inherits html's smooth scroll).

/** Preparoo's curve for the same move (850 ms, ease-in-out-cubic). */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

let glideFrame = 0;
let gliding = false;

/**
 * Glide to `target` (a y, or a function read every frame so a section that is drawn on the way cannot leave the end
 * short) over `ms`, then call `done`. The jump stays declared until the glide has ended; the reader's own input ends
 * both wherever the page is.
 */
export function glideTo(target, { ms = 850, ease = easeInOutCubic, done } = {}) {
  if (!canRun()) return;
  const end = () => Math.round(typeof target === 'function' ? target() : target);
  const from = window.scrollY;
  jump(end());
  window.cancelAnimationFrame(glideFrame);
  gliding = true;
  let t0 = 0;
  const tick = (t) => {
    glideFrame = 0;
    if (!gliding) return;
    if (!t0) t0 = t;
    const k = Math.min(1, Math.max(0, (t - t0) / ms));
    const to = end();
    jumpY = to;
    window.scrollTo({ top: Math.round(from + (to - from) * ease(k)), behavior: 'instant' });
    armJump();
    if (k < 1) { glideFrame = window.requestAnimationFrame(tick); return; }
    gliding = false; // the bus clears the jump on the frame that sees the page arrive
    done?.();
  };
  glideFrame = window.requestAnimationFrame(tick);
}

/** The reader touched, wheeled, pressed a key or a pointer: a glide stops where it is and the jump is over. */
function userTook() {
  if (gliding) { gliding = false; window.cancelAnimationFrame(glideFrame); glideFrame = 0; }
  clearJump();
}

export const isGliding = () => gliding;

/** The document y of an in-page anchor's target, as the browser would scroll to it (its scroll margin kept). */
export function anchorY(element) {
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  return Math.round(window.scrollY + element.getBoundingClientRect().top - margin);
}
