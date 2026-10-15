// Spring physics, the same as the app's. Flutter builds every MockMob spring with
// SpringDescription.withDurationAndBounce(duration, bounce) and runs it in a SpringSimulation
// until it is done (position within 0.001 of the end and speed under 0.001 per second). These
// functions reproduce that exactly, so a CSS linear() spring and a script-driven drag settle move
// the way the phone does. Pure: no DOM, no React. The token generator (src/lib/motion-tokens.mjs)
// samples them into motion-kit.css; useDragCommit runs them per frame with the finger's speed.

/** Flutter's default Tolerance: distance and velocity both 0.001. */
export const SPRING_TOLERANCE = 1e-3;

/** Mass, stiffness and damping ratio for a settle duration (ms) and a bounce (-1 to 1). */
export function springDescription(ms, bounce = 0) {
  const seconds = Math.max(1, ms) / 1000;
  const stiffness = (4 * Math.PI * Math.PI) / (seconds * seconds); // mass 1
  const zeta = bounce > 0 ? 1 - bounce : 1 / (bounce + 1);
  return { mass: 1, stiffness, zeta, omega: Math.sqrt(stiffness) };
}

/**
 * The state of a spring that starts at `from` with `velocity` (units per second) and heads to
 * `to`, `t` seconds in: { x, v }. Under-, critically and over-damped, like SpringSimulation.
 */
export function springState({ ms, bounce = 0 }, from, to, velocity, t) {
  const { zeta, omega } = springDescription(ms, bounce);
  const x0 = from - to;
  const v0 = velocity;
  if (Math.abs(zeta - 1) < 1e-9) {
    const c2 = v0 + omega * x0;
    const e = Math.exp(-omega * t);
    return { x: to + (x0 + c2 * t) * e, v: (c2 - omega * (x0 + c2 * t)) * e };
  }
  if (zeta < 1) {
    const a = zeta * omega;
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const c2 = (v0 + a * x0) / wd;
    const e = Math.exp(-a * t);
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const disp = e * (x0 * cos + c2 * sin);
    return { x: to + disp, v: -a * disp + e * (-x0 * wd * sin + c2 * wd * cos) };
  }
  const root = omega * Math.sqrt(zeta * zeta - 1);
  const r1 = -zeta * omega + root;
  const r2 = -zeta * omega - root;
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return { x: to + c1 * e1 + c2 * e2, v: c1 * r1 * e1 + c2 * r2 * e2 };
}

/** Position of a 0 to 1 spring at rest at the start, `t` seconds in. */
export function springPosition(spring, t) {
  return springState(spring, 0, 1, 0, t).x;
}

/**
 * How long (ms) the spring runs before Flutter calls it done: the first time after which the
 * position stays within `tolerance` of the end and the speed under `tolerance` per second.
 * Scale `tolerance` for distances in pixels (a drag) as the app does.
 */
export function springSettleMs(spring, { from = 0, to = 1, velocity = 0, tolerance = SPRING_TOLERANCE, step = 0.1, limitMs = 10000 } = {}) {
  let last = 0;
  const steps = Math.round(limitMs / step);
  for (let i = 1; i <= steps; i += 1) {
    const ms = i * step;
    const { x, v } = springState(spring, from, to, velocity, ms / 1000);
    if (Math.abs(x - to) >= tolerance || Math.abs(v) >= tolerance) last = ms;
  }
  return Math.max(1, Math.round(last));
}

/** The highest point a 0 to 1 spring reaches on its way (1 when it never overshoots: it ends there). */
export function springPeak(spring, settleMs = springSettleMs(spring)) {
  let peak = 1;
  const steps = Math.round(settleMs * 10);
  for (let i = 0; i <= steps; i += 1) peak = Math.max(peak, springPosition(spring, i / 10000));
  return peak;
}

/**
 * A CSS linear() easing that draws the spring over its settle time: at least `minStops` evenly
 * spaced stops (one per 12 ms on long springs), 4 decimals, the last one exactly 1. Use it with
 * the settle duration ({ easing, settleMs }).
 */
export function springLinear(spring, { minStops = 40 } = {}) {
  const settleMs = springSettleMs(spring);
  const stops = Math.max(minStops, Math.ceil(settleMs / 12) + 1);
  const values = [];
  for (let i = 0; i < stops; i += 1) {
    const t = (settleMs * i) / (stops - 1) / 1000;
    const x = i === stops - 1 ? 1 : springPosition(spring, t);
    values.push(i === 0 ? '0' : i === stops - 1 ? '1' : trim(x.toFixed(4)));
  }
  return { easing: `linear(${values.join(', ')})`, settleMs, stops };
}

/**
 * The app's release after a committed tap (MmPressSpring.releaseWithLift in pressable.dart): the
 * surface rises past rest to three quarters of its sink (at most 0.03) on the snappy spring, then
 * turns (at that peak, or after 180 ms) into the release spring down to 1, keeping its speed.
 * Returns the scale at `t` seconds and when it is done.
 */
export function pressLift({ pressedScale, snappy, release }) {
  const peak = 1 + Math.min(0.03, Math.max(0, (1 - pressedScale) * 0.75));
  const riseTo = peak + (peak - 1) * 0.5;
  const rise = (t) => springState(snappy, pressedScale, riseTo, 0, t);
  let turn = 0;
  while (turn < 0.18 && rise(turn).x < peak) turn += 0.004;
  const at = rise(turn);
  const settle = (t) => springState(release, at.x, 1, at.v, t);
  const scaleAt = (t) => (t < turn ? rise(t).x : settle(t - turn).x);
  let doneMs = 0;
  for (let i = 1; i <= 100000; i += 1) {
    const ms = i * 0.1;
    const s = settle(ms / 1000);
    if (Math.abs(s.x - 1) >= SPRING_TOLERANCE || Math.abs(s.v) >= SPRING_TOLERANCE) doneMs = ms;
  }
  return { peak, turnMs: turn * 1000, durationMs: Math.round(turn * 1000 + doneMs), scaleAt };
}

/**
 * The lift as a CSS easing in progress space (0 is pressedScale, 1 is rest), so a transition from
 * the pressed scale to 1 overshoots exactly as the app's surface does. Stops every 8 ms.
 */
export function pressLiftLinear(springs, pressedScale) {
  const lift = pressLift({ pressedScale, snappy: springs.snappy, release: springs.release });
  const stops = Math.max(40, Math.ceil(lift.durationMs / 8) + 1);
  const values = [];
  let peakProgress = 0;
  for (let i = 0; i < stops; i += 1) {
    const t = (lift.durationMs * i) / (stops - 1) / 1000;
    const p = i === stops - 1 ? 1 : (lift.scaleAt(t) - pressedScale) / (1 - pressedScale);
    peakProgress = Math.max(peakProgress, p);
    values.push(i === 0 ? '0' : i === stops - 1 ? '1' : trim(p.toFixed(4)));
  }
  return { easing: `linear(${values.join(', ')})`, durationMs: lift.durationMs, peakScale: pressedScale + (1 - pressedScale) * peakProgress };
}

/** A cubic-bezier played backwards (Flutter's Curve.flipped): what a reversed animation looks like drawn forwards. */
export function reverseCubic([x1, y1, x2, y2]) {
  const r = (n) => Number((1 - n).toFixed(6));
  return [r(x2), r(y2), r(x1), r(y1)];
}

function trim(text) {
  const n = Number(text);
  return Object.is(n, -0) ? '0' : String(n);
}

/** The stop values inside a linear() string, for tests and readers. */
export function linearStops(easing) {
  const inner = /^linear\((.*)\)$/.exec(String(easing).trim());
  return inner ? inner[1].split(',').map((s) => Number(s.trim())) : [];
}
