// How a committed swipe leaves (the app's M24): the row keeps the finger's speed and carries on off the
// screen on the lift spring (300 ms, bounce 0), so it never hangs and then drops as an ease-in would.
// Pure: no DOM, no React. useSwipeCommit plays the frames with element.animate; the caller then folds
// the gap (fold.js, 200 ms on ease-out).
import { springState } from './spring.js';
import { springs } from './tokens.g.js';

export const SWIPE_RELEASE = Object.freeze({
  spring: springs.lift, // 300 ms, bounce 0
  travelShare: 1.4, // aims past the edge, so the row is gone before the spring slows
  frameMs: 1000 / 60,
  maxMs: 360, // never longer than the app's leave, even from a slow release
  fadeFrom: 0.35, // the row starts to fade once it is a third of the way out
});

/**
 * The frames of a swipe that commits: dx is where the finger let go (px), velocity the release speed
 * (px/s, sign = direction), width the row's width, dir 'left' or 'right'. Returns
 * { frames: [{ x, opacity }], duration } with one frame per 60 Hz tick, ending off the row's edge.
 * A release that moved the other way, or stopped, starts from rest: the spring still carries it out.
 */
export function swipeReleaseFrames({ dx = 0, velocity = 0, width = 320, dir = 'left' } = {}) {
  const sign = dir === 'right' ? 1 : -1;
  const edge = Math.max(1, width);
  const target = sign * edge * SWIPE_RELEASE.travelShare;
  const v0 = Math.sign(velocity) === sign ? velocity : 0;
  const { spring, frameMs, maxMs, fadeFrom } = SWIPE_RELEASE;
  const frames = [];
  let t = 0;
  for (;;) {
    const { x } = springState(spring, dx, target, v0, t / 1000);
    const out = Math.min(1, Math.abs(x) / edge);
    const opacity = out <= fadeFrom ? 1 : Math.max(0, 1 - (out - fadeFrom) / (1 - fadeFrom));
    frames.push({ x: Math.round(x * 10) / 10, opacity: Math.round(opacity * 1000) / 1000 });
    if (out >= 1 || t >= maxMs) break;
    t += frameMs;
  }
  const last = frames[frames.length - 1];
  if (last.opacity > 0) frames.push({ x: last.x, opacity: 0 });
  return { frames, duration: Math.max(frameMs, Math.round((frames.length - 1) * frameMs)) };
}

/** How a removal plays: a fling keeps its speed on the lift spring; a tap (no gesture) folds on ease-out. */
export function removalCurve({ gesture }) {
  return gesture ? { kind: 'spring', spring: SWIPE_RELEASE.spring } : { kind: 'ease-out', duration: 200 };
}
