// The overlap swap of the app's MmOverlapSwitcher (lib/core/motion/motion.dart), as pure math for
// SwapKey. When content changes key, the new layer fades in over the old on glide; the old layer
// holds at full strength until the new one is half visible, then fades in 90 ms, and the two never
// add up to less than 0.7, so the ground never flashes through. Variants only add a transform:
//   fade  opacity only (the default)
//   rise  the new layer also rises 14 px from 0.97 on emphasized, over 360 ms
//   axis  a shared-axis step: the new layer comes 28 px from the side `dir` points to on glide over
//         300 ms, and the old one drifts 22 percent of that the other way
// Reduced motion: a 120 ms fade, nothing travels.

import { curves, durations, numbers } from './tokens.g.js';

/** A CSS cubic-bezier evaluated at progress x (0 to 1), solved to 1e-6 like Flutter's Cubic. */
export function cubicAt([x1, y1, x2, y2], x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bez = (a, b, t) => 3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t;
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 60; i += 1) {
    t = (lo + hi) / 2;
    const at = bez(x1, x2, t);
    if (Math.abs(at - x) < 1e-7) break;
    if (at < x) lo = t; else hi = t;
  }
  return bez(y1, y2, t);
}

export const glide = (v) => cubicAt(curves.glide, v);
export const emphasized = (v) => cubicAt(curves.emphasized, v);

export const SWAP = Object.freeze({
  release: numbers.overlapRelease,
  floor: numbers.overlapFloor,
  outMs: durations.fadeThroughOut,
  fadeMs: durations.fadeThroughIn,
  riseMs: durations.enter,
  axisMs: durations.glide,
  reducedMs: durations.reducedFade,
  rise: numbers.enterRise,
  fromScale: numbers.enterScale,
  axisTravel: numbers.axisTravel,
  recedeShare: numbers.recedeShare,
});

/** What a swap does: { kind, inMs, outMs, dir, travel }. `dir` 1 forward (from the right), -1 back. */
export function swapSpec(variant = 'fade', { dir = 1, travel, reduced = false, inMs } = {}) {
  const kind = reduced ? 'fade' : (variant === 'rise' || variant === 'axis' ? variant : 'fade');
  const sign = dir < 0 ? -1 : 1;
  const base = kind === 'rise' ? SWAP.riseMs : kind === 'axis' ? SWAP.axisMs : SWAP.fadeMs;
  return {
    kind,
    dir: sign,
    travel: kind === 'rise' ? (travel ?? SWAP.rise) : kind === 'axis' ? (travel ?? SWAP.axisTravel) : 0,
    inMs: reduced ? SWAP.reducedMs : (inMs ?? base),
    outMs: SWAP.outMs,
  };
}

/** The incoming layer's opacity when its own clock is at v (0 to 1, linear in time). */
export const incomingOpacity = (v) => glide(Math.min(1, Math.max(0, v)));

/** The incoming layer's transform at v: { x, y, scale }. */
export function incomingTransform(spec, v) {
  const t = Math.min(1, Math.max(0, v));
  if (spec.kind === 'rise') {
    const e = emphasized(t);
    return { x: 0, y: spec.travel * (1 - e), scale: SWAP.fromScale + (1 - SWAP.fromScale) * e };
  }
  if (spec.kind === 'axis') return { x: spec.dir * spec.travel * (1 - glide(t)), y: 0, scale: 1 };
  return { x: 0, y: 0, scale: 1 };
}

/** How far the outgoing layer has drifted while the incoming clock is at v (axis only). */
export function outgoingDrift(spec, v) {
  if (spec.kind !== 'axis') return 0;
  return -spec.dir * spec.travel * SWAP.recedeShare * glide(Math.min(1, Math.max(0, v)));
}

/**
 * The outgoing layer's opacity: its own fade is at `own`; it held at `heldFrom` when it started
 * leaving; the incoming layer shows at `incoming`. Never above where it held, and never letting the
 * sum of the two fall under the floor (0.7).
 */
export function outgoingOpacity(own, incoming, heldFrom = 1) {
  return Math.min(1, Math.max(0, Math.max(own, Math.min(heldFrom, SWAP.floor - incoming))));
}

/** When (ms into the swap) the incoming layer reaches the release opacity (0.5). */
export function releaseMs(spec) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (incomingOpacity(mid) < SWAP.release) lo = mid; else hi = mid;
  }
  return hi * spec.inMs;
}

/** Where a layer that is mid-arrival is, `elapsedMs` into its own swap: { opacity, x, y, scale }. */
export function arrivalAt(spec, elapsedMs) {
  const v = spec.inMs > 0 ? elapsedMs / spec.inMs : 1;
  return { opacity: incomingOpacity(v), ...incomingTransform(spec, v) };
}

export const transformOf = ({ x = 0, y = 0, scale = 1 }) => `translate3d(${round(x)}px, ${round(y)}px, 0) scale(${round(scale, 5)})`;

function round(n, places = 3) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

/**
 * Web Animations keyframes for the outgoing layer of a swap described by `spec` (the incoming
 * layer's swap), sampled so the overlap rule holds frame by frame. `held` is where the layer was
 * when it started leaving ({ opacity, x, y, scale }). Returns { keyframes, durationMs }.
 */
export function outgoingKeyframes(spec, held = {}, { samples = 36 } = {}) {
  const heldFrom = held.opacity ?? 1;
  const at = releaseMs(spec);
  const durationMs = Math.max(spec.inMs, at + spec.outMs);
  const keyframes = [];
  for (let i = 0; i <= samples; i += 1) {
    const ms = (durationMs * i) / samples;
    const incoming = incomingOpacity(ms / spec.inMs);
    const own = ms <= at ? heldFrom : heldFrom * Math.max(0, 1 - (ms - at) / spec.outMs);
    const drift = outgoingDrift(spec, ms / spec.inMs);
    keyframes.push({
      offset: i / samples,
      opacity: round(outgoingOpacity(own, incoming, heldFrom), 4),
      transform: transformOf({ x: (held.x ?? 0) + drift, y: held.y ?? 0, scale: held.scale ?? 1 }),
    });
  }
  return { keyframes, durationMs };
}

/** Web Animations keyframes for the incoming layer: { keyframes, durationMs }, linear between samples. */
export function incomingKeyframes(spec, { samples = 36 } = {}) {
  const keyframes = [];
  for (let i = 0; i <= samples; i += 1) {
    const v = i / samples;
    const { x, y, scale } = incomingTransform(spec, v);
    keyframes.push({ offset: v, opacity: round(incomingOpacity(v), 4), transform: transformOf({ x, y, scale }) });
  }
  return { keyframes, durationMs: spec.inMs };
}
