// The arithmetic of a sideways drag that commits, the same as the app's MmDragPolicy
// (lib/core/motion/drag_commit.dart). Pure, so it is tested without a gesture.

export const DRAG = Object.freeze({
  /** A drag claims the pointer only when it moves this many times further sideways than up or down. */
  claimRatio: 2.2,
  /** Resistance past an edge: a side that does not commit, or travel beyond maxTravelShare of the width. */
  resist: 0.35,
  /** Commit past this share of the width... */
  commitShare: 0.35,
  /** ...or on a release faster than this (px per second) toward a side that commits. */
  commitVelocity: 700,
  /** Travel beyond this share of the width rubber-bands. */
  maxTravelShare: 1,
  /** Flutter's touch slop (kTouchSlop) and its precise-pointer pan slop for a mouse. */
  touchSlop: 18,
  mouseSlop: 2,
  /** A pointer that has not moved for this long has stopped (Flutter's velocity tracker). */
  stoppedMs: 40,
  /** How far back the release speed looks. */
  velocityWindowMs: 100,
});

export const slopFor = (pointerType) => (pointerType === 'mouse' ? DRAG.mouseSlop : DRAG.touchSlop);

/** Whether a pointer that moved (dx, dy) since it landed is clearly a sideways drag. */
export function claims(dx, dy, { slop = DRAG.touchSlop, ratio = DRAG.claimRatio } = {}) {
  return Math.abs(dx) > slop && Math.abs(dx) > ratio * Math.abs(dy);
}

/** Whether the pointer should be left to a vertical scroll. */
export function yields(dx, dy, { slop = DRAG.touchSlop, ratio = DRAG.claimRatio } = {}) {
  return Math.abs(dy) > slop && Math.abs(dx) <= ratio * Math.abs(dy);
}

/**
 * Where the dragged thing sits for a finger that travelled `raw` px: 1:1 toward a side that commits
 * up to `maxTravel`, then `resist`; a side that does not commit gives only `resist` from the start.
 */
export function follow(raw, { left = true, right = true, maxTravel, resist = DRAG.resist }) {
  const allowed = raw >= 0 ? right : left;
  if (!allowed) return raw * resist;
  if (Math.abs(raw) <= maxTravel) return raw;
  return Math.sign(raw) * (maxTravel + (Math.abs(raw) - maxTravel) * resist);
}

/**
 * The side ('left' | 'right') a release at `offset` px moving at `velocity` px/s commits to, or
 * null to spring back. A fling against the offset never commits; a fast fling commits even when short.
 */
export function commits(offset, velocity, { distance, left = true, right = true, minVelocity = DRAG.commitVelocity }) {
  const side = (sign) => (sign > 0 ? (right ? 'right' : null) : (left ? 'left' : null));
  const fast = Math.abs(velocity) >= minVelocity;
  if (fast && (offset === 0 || Math.sign(velocity) === Math.sign(offset))) return side(Math.sign(velocity));
  if (Math.abs(offset) >= distance && !(fast && Math.sign(velocity) !== Math.sign(offset))) return side(Math.sign(offset));
  return null;
}

/**
 * Release speed in px/s from recent samples [{ t, x }] (t in ms), as a velocity tracker reads it:
 * a straight-line fit over the last 100 ms, and 0 when the pointer had stopped before letting go.
 */
export function releaseVelocity(samples, now = samples.length ? samples[samples.length - 1].t : 0) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (now - last.t > DRAG.stoppedMs) return 0;
  const recent = samples.filter((s) => last.t - s.t <= DRAG.velocityWindowMs);
  if (recent.length < 2) return 0;
  const n = recent.length;
  const mt = recent.reduce((a, s) => a + s.t, 0) / n;
  const mx = recent.reduce((a, s) => a + s.x, 0) / n;
  let num = 0;
  let den = 0;
  for (const s of recent) { num += (s.t - mt) * (s.x - mx); den += (s.t - mt) ** 2; }
  return den > 0 ? (num / den) * 1000 : 0;
}

/** How far a surface `width` px across sinks when pressed: at most 4 percent and about 8 px (the app's pressedScaleFor). */
export function pressScaleFor(width) {
  return 1 - Math.min(0.04, 8 / Math.max(width, 1));
}
