// Swipe a turned Key card to rate it (owner LK137, 5 Nov 2026: "Got It to the right, Easy down, and Missed left"). The arithmetic
// only (no React, no DOM), so node tests it; useRateSwipe.js runs it on a real pointer and the keys stay exactly as they were.
//   right   Got it (3)        left   Missed it (1)        down   Easy (4)        up   nothing (the page scrolls)
//   lock    the first 8 px (6 with a mouse) decide the axis: further sideways than down is a sideways drag; further down than
//           sideways is the Easy drag, when down is allowed; anything else is left to the page (a touch scroll)
//   follow  the card follows the finger 1:1 on its axis, a quarter of the other axis, and leans up to 10 degrees on a sideways drag
//   commit  past the commit distance (sideways: 30% of the card's width, kept between 72 and 120 px; down: 96 px), or on a fling
//           of 650 px/s or more in that direction after at least 32 px; otherwise it springs home
//   down    with a touch, down is offered only while the whole card is in view (then the card owns the touch; else the page keeps
//           its vertical scroll and only left and right rate); a mouse or pen always has all three
//   words   a mouse or pen press on the card's words is the browser's, never a swipe: on a laptop a student drags across the answer to
//           select or copy a line, and that must not rate the card (review, 6 Nov; a rating has no undo). The words reach 12 px past
//           each text block's box, so a selection begun just before the first letter is the browser's too. A mouse grabs the card
//           by its head, its margins and its empty space (the cursor says which: grab there, the text cursor on the words). A touch
//           never selects by dragging, so it swipes from anywhere on the card.
// Reduced motion turns the gesture off entirely: the keys rate (useRateSwipe.js).

export const SWIPE = Object.freeze({
  slopTouch: 8, slopMouse: 6,
  sideShare: 0.3, sideMin: 72, sideMax: 120,
  down: 96,
  flingVelocity: 650, flingMin: 32,
  cross: 0.25, upResist: 0.2,
  leanPerPx: 0.06, leanMax: 10,
  wordReach: 12,
});

/**
 * True when the point (x, y) is on the card's words: inside one of the text blocks' `rects` (DOMRect-like: left, right, top,
 * bottom), widened by `reach` px each side and half of it above and below.
 */
export function onWords(x, y, rects, reach = SWIPE.wordReach) {
  for (const r of rects || []) {
    if (!r || !(r.right > r.left) || !(r.bottom > r.top)) continue;
    if (x >= r.left - reach && x <= r.right + reach && y >= r.top - reach / 2 && y <= r.bottom + reach / 2) return true;
  }
  return false;
}

/** Whether a press may start a swipe: never on a key or the menu, never a mouse's other buttons, never a mouse or pen on the words. */
export function pressStartsSwipe({ pointer = 'touch', button = 0, onKey = false, words = false } = {}) {
  if (onKey) return false;
  if (pointer === 'mouse' && button !== 0) return false;
  if (pointer !== 'touch' && words) return false;
  return true;
}

/** The rating each way commits: right Got it, left Missed it, down Easy (the RATINGS of kinds.js: 1 Missed, 3 Got it, 4 Easy). */
export const SWIPE_RATINGS = Object.freeze({ right: 3, left: 1, down: 4 });
export const SWIPE_WORDS = Object.freeze({ right: 'Got it', left: 'Missed it', down: 'Easy' });

/** The hint said once, before a first drag: the three ways, or the two when down is not offered. */
export function swipeHint({ down = true, touch = false } = {}) {
  const verb = touch ? 'Swipe' : 'Drag';
  return down
    ? `${verb} the card: right for Got it, left for Missed it, down for Easy.`
    : `${verb} the card: right for Got it, left for Missed it.`;
}

/** How far a drag on `axis` ('x' | 'y') must travel to commit, for a card `width` px wide. */
export function commitDistance(axis, width = 360) {
  if (axis === 'y') return SWIPE.down;
  return Math.min(SWIPE.sideMax, Math.max(SWIPE.sideMin, Math.round((Number(width) || 360) * SWIPE.sideShare)));
}

/**
 * The axis a pointer that moved (dx, dy) claims: 'x' (left or right), 'y' (down, for Easy), 'page' (leave it to the page: an
 * upward move, or a downward one when down is not offered), or null while it is still inside the slop.
 */
export function lockAxis(dx, dy, { slop = SWIPE.slopTouch, down = true } = {}) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;
  if (ax >= ay) return 'x';
  if (dy > 0 && down) return 'y';
  return 'page';
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 10) / 10;

/**
 * Where the card sits for a drag of (dx, dy) on `axis`, and what it would do if let go there:
 * { x, y, r, intent: 'right' | 'left' | 'down' | null, progress: 0 to 1, ready: progress reached 1 }.
 */
export function dragPose(axis, dx, dy, width = 360) {
  if (axis === 'x') {
    const x = dx;
    const y = dy * SWIPE.cross;
    const r = clamp(dx * SWIPE.leanPerPx, -SWIPE.leanMax, SWIPE.leanMax);
    const intent = dx > 0 ? 'right' : dx < 0 ? 'left' : null;
    const progress = clamp(Math.abs(dx) / commitDistance('x', width), 0, 1);
    return { x: round(x), y: round(y), r: round(r), intent, progress: round(progress * 100) / 100, ready: progress >= 1 };
  }
  if (axis === 'y') {
    const y = dy >= 0 ? dy : dy * SWIPE.upResist;
    const x = dx * SWIPE.cross;
    const intent = dy > 0 ? 'down' : null;
    const progress = clamp(Math.max(0, dy) / commitDistance('y', width), 0, 1);
    return { x: round(x), y: round(y), r: 0, intent, progress: round(progress * 100) / 100, ready: progress >= 1 };
  }
  return { x: 0, y: 0, r: 0, intent: null, progress: 0, ready: false };
}

/** The CSS transform of a pose (the leaving ghost's keyframes). */
export const poseTransform = (pose) => `translate3d(${pose?.x || 0}px, ${pose?.y || 0}px, 0) rotate(${pose?.r || 0}deg)`;

/**
 * Puts a pose on the live card through the individual `translate` and `rotate` properties, never `transform`: the card's own
 * entrance animations fill `transform` (keycards.css kc-in, kc-next), and a filled animation would override an inline transform.
 */
export function applyPose(el, pose) {
  if (!el?.style) return;
  el.style.translate = `${pose?.x || 0}px ${pose?.y || 0}px`;
  el.style.rotate = `${pose?.r || 0}deg`;
}

/** Takes the pose off the live card (it falls back to its stylesheet's translate, if any). */
export function clearPose(el) {
  if (!el?.style) return;
  el.style.translate = '';
  el.style.rotate = '';
}

/**
 * The rating a release commits to (1, 3 or 4), or null to spring home. `velocity` is px/s along the axis (positive right or
 * down). A fling against the drag never commits; a quick fling commits once it has travelled flingMin.
 */
export function releaseRating(axis, dx, dy, velocity = 0, width = 360) {
  if (axis === 'x') {
    const far = Math.abs(dx) >= commitDistance('x', width);
    const fling = Math.abs(velocity) >= SWIPE.flingVelocity && Math.abs(dx) >= SWIPE.flingMin && Math.sign(velocity) === Math.sign(dx);
    const against = Math.abs(velocity) >= SWIPE.flingVelocity && Math.sign(velocity) !== Math.sign(dx);
    if ((far && !against) || fling) return dx > 0 ? SWIPE_RATINGS.right : SWIPE_RATINGS.left;
    return null;
  }
  if (axis === 'y') {
    if (dy <= 0) return null;
    const far = dy >= commitDistance('y', width);
    const fling = velocity >= SWIPE.flingVelocity && dy >= SWIPE.flingMin;
    const against = velocity <= -SWIPE.flingVelocity;
    if ((far && !against) || fling) return SWIPE_RATINGS.down;
    return null;
  }
  return null;
}

/** The way a rating leaves after a swipe: the pose it was let go at, carried on off the stage in the same direction. */
export function swipeLeaveTo(pose, width = 360) {
  const p = pose || { x: 0, y: 0, r: 0 };
  const w = Math.max(240, Number(width) || 360);
  if (p.intent === 'down') return { x: round(p.x), y: round(p.y + w * 0.9), r: round(p.r) };
  const dir = p.intent === 'left' ? -1 : 1;
  return { x: round(p.x + dir * w * 1.1), y: round(p.y + 24), r: round(clamp(p.r * 1.6, -16, 16) || dir * 8) };
}

/** The pose a committed card was let go at (its flight starts there), or null. Reads the card's own data, nothing global. */
export function swipePose(el) {
  if (!el?.dataset || el.dataset.swipe !== 'commit') return null;
  try { return JSON.parse(el.dataset.swipePose || 'null'); } catch { return null; }
}

/** Clears a card's swipe state at once (its labels, its pose and the transform it was held at). */
export function clearSwipe(el) {
  if (!el?.style) return;
  clearPose(el);
  el.style.removeProperty('--swipe-p');
  for (const k of ['swipe', 'swipeIntent', 'swipeReady', 'swipePose']) delete el.dataset[k];
}
