// The rules of "one gesture, one step" as plain functions (LK69, L-027, L-028). No DOM here: storyController.mjs
// feeds these with touch, wheel and scroll readings, and oneGesture.test.mjs locks them without a browser.
//
// A held story rests at `steps` places in its hold: the first at the start, the last at the end, the rest evenly
// between. A step is chosen only by the gesture's NET travel, never its speed: that is what makes a hard flick and
// a slow drag give the same one step, however far the browser would have carried the page.

export const SLOP = 6;            // px of finger travel before a direction is chosen (under it the page waits)
export const COMMIT_PX = 40;      // net travel that commits a step at touchend
export const FLICK_PX = 12;       // a shorter flick still commits when it leaves the glass fast enough:
export const FLICK_V = 0.3;       //   at 0.3 px/ms or more over its last 80 ms, in the same direction
export const FLICK_WINDOW_MS = 80;
export const LEAN_K = 0.25;       // the content follows the finger by this share ...
export const LEAN_MAX = 28;       // ... at most this many px
export const LOCK_MS = 420;       // a gesture that starts inside this long after a step is swallowed whole
export const LOCK_REDUCED_MS = 120;
export const WHEEL_QUIET_MS = 160;// a wheel burst ends after this much quiet (or a change of direction)
export const WHEEL_MIN_PX = 12;   // travel in a burst before its one step fires
export const WHEEL_NOTCH_PX = 40; // an event this big that repeats its size is a mouse wheel's notch, not a trackpad's tail
export const WHEEL_PUSH_PX = 24;  // an event this big and half again the one before it is a new push
export const SETTLE_QUIET_MS = 150;
export const HOLD_SLACK = 2;      // px around a hold that still count as inside it

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** The resting place of step k (document px): the same formula the story's own goTo uses. */
export const restY = (top, hold, steps, k) => Math.round(top + (hold * k) / Math.max(1, steps - 1));

/** The step whose resting place is nearest to y. */
export const nearestStep = (top, hold, steps, y) => (hold > 0 ? clamp(Math.round(((y - top) * (steps - 1)) / hold), 0, steps - 1) : 0);

/** Is y inside a story's hold (from the first rest to the last, with a little slack)? */
export const insideHold = (top, hold, y) => y >= top - HOLD_SLACK && y <= top + hold + HOLD_SLACK;

export const lockMs = (reduced) => (reduced ? LOCK_REDUCED_MS : LOCK_MS);

/** Finger lean: 25% of the travel, at most 28 px, none under reduced motion. */
export const leanFor = (dy, reduced = false) => (reduced ? 0 : clamp(dy * LEAN_K, -LEAN_MAX, LEAN_MAX));

/** px/ms over the last 80 ms of [{ t, y }] samples (positive = moving down the screen). */
export function velocity(samples) {
  if (!samples || samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const from = samples.find((p) => last.t - p.t <= FLICK_WINDOW_MS) || samples[0];
  const dt = last.t - from.t;
  return dt > 0 ? (last.y - from.y) / dt : 0;
}

/**
 * What a finger does at touchend: the step direction (+1 forward = the finger moved up the screen, -1 back, 0 none).
 * `dy` is the net travel from the touch's start (negative = up), `v` the release velocity in px/ms (negative = up).
 * 40 px of net travel commits; so does a 12 px flick moving at 0.3 px/ms or more in the same direction. A drag that
 * went out and came back under 40 px commits nothing; one that came back past its start steps the other way.
 */
export function commitDirection(dy, v) {
  const dir = dy < 0 ? 1 : -1;
  const far = Math.abs(dy) >= COMMIT_PX;
  const flick = Math.abs(dy) >= FLICK_PX && -v * dir >= FLICK_V;
  return far || flick ? dir : 0;
}

/**
 * Who owns a touch once it has moved SLOP px, decided once per gesture:
 *   'native'  not in a story, sideways (chips, reels), an inner scroller, or the way out of the story: the browser's
 *   'spent'   inside the lock after a step: swallowed, never queued, never skipped ahead
 *   'own'     the story steps with it
 */
export function claimTouch({ inStory, dx, dy, locked, canStep, scrollsInside }) {
  if (!inStory) return 'native';
  if (Math.abs(dx) > Math.abs(dy)) return 'native';
  if (scrollsInside) return 'native';
  if (locked) return 'spent';
  return canStep ? 'own' : 'native';
}

/**
 * The wheel: one burst (a few notches, or a trackpad swipe with its long inertia tail) moves at most one step.
 * A burst starts after 160 ms of quiet or on a change of direction. Returns the burst the event belongs to.
 */
export function wheelBurst(burst, { t, dir }) {
  if (!burst || t - burst.last > WHEEL_QUIET_MS || dir !== burst.dir) return { dir, last: t, sum: 0, fired: false, fresh: true };
  return { ...burst, last: t, fresh: false };
}

/**
 * Inside a burst that has already stepped, once the step lock is over: is this event (px, the one before prevPx) a new
 * push rather than the fading momentum of the push that stepped? A mouse wheel still turning repeats its notch; a second
 * swipe on a trackpad rises. A trackpad's own momentum only falls, so it stays one gesture, one step (LK69).
 */
export function wheelPushes(prevPx, px) {
  if (!(prevPx > 0) || !(px > 0)) return false;
  if (px >= WHEEL_NOTCH_PX && Math.abs(px - prevPx) <= 1) return true;
  return px >= WHEEL_PUSH_PX && px > prevPx * 1.5;
}

/** A step key: arrows, PageUp/Down, Space. +1, -1 or 0. */
export const keyDirection = (key) => ({ ArrowDown: 1, PageDown: 1, ' ': 1, Spacebar: 1, ArrowUp: -1, PageUp: -1 }[key] || 0);

/** Wheel travel in px (line and page modes scaled like the browser's own). */
export const wheelPx = (deltaY, deltaMode) => Math.abs(deltaY) * (deltaMode ? 40 : 1);
