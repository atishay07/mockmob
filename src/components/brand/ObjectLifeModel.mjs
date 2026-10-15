// The numbers of a subject object's life on the website, the same as the app's ObjectLife
// (wt-phase2/flutter_app/lib/core/art/object_life.dart, core/motion/object_react.dart, scroll_effects.dart,
// springs.dart and art/emblem_sparkle.dart). Change one, change both. Pure functions, no DOM, so the tests
// can hold them to the app: node --test data/tests/brand_assets.test.mjs
//
// | What | Value |
// | --- | --- |
// | Alive by default | 96 px and up; smaller objects keep the still picture unless they opt in |
// | Float | 7.2 s, up 3% of the box and -1.2 deg at the top, about the foot, a phase per subject |
// | Tilt | up to 5 deg each way in a 909 px perspective, finger on the snappy spring, home on the smooth one |
// | Scroll lean | full at 28 px of scroll in one frame, 0.7 of the tilt, back to rest on the smooth spring |
// | Light | one band across the object's own pixels while it tilts, 0.22 of the diagonal, peak 0.24 Night, 0.32 Day |
// | Tap | 420 ms: 1 - 0.06a by 22%, 1 + 0.04a by 58%, rest by 100%, a 2a deg damped twist about the foot; a = 0.4 |
// | Sparkle | 560 ms: the subject light blooms behind, four glints leave the rim |

import { artBox } from '../../../data/subject_art.mjs';

export const LIFE = Object.freeze({
  minSize: 96,
  floatPeriodMs: 7200,
  floatRise: 0.03,
  floatLeanDeg: -1.2,
  tiltMaxDeg: 5,
  // The app's perspective entry is 0.0011 (1 / 909 px). The plan's 700 px would not match.
  perspectivePx: Math.round(1 / 0.0011),
  scrollShare: 0.7,
  fullLeanPx: 28,
  restTilt: 0.002,
  tapAmplitude: 0.4,
  heroTapAmplitude: 1,
  tapSlopPx: 18,
  tapTimeMs: 500,
  reactMs: 420,
  sparkleMs: 560,
  lightWidth: 0.22,
  lightNight: 0.24,
  lightDay: 0.32,
  lightClip: 0.06,
  flightMs: 420,
  flightBackMs: 340,
  parallaxObject: 0.05,
  parallaxPools: 0.12,
});

// ---------- Curves (shared/motion-tokens.json) ----------

/** A CSS cubic-bezier as a function of t (0 to 1), solved by Newton steps with a bisection fallback. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const EASE = Object.freeze({
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
  glide: cubicBezier(0.15, 0.5, 0.5, 1),
});

// ---------- Springs (Flutter's SpringDescription.withDurationAndBounce) ----------

/** mass 1, stiffness 4 pi^2 / T^2, damping ratio 1 - bounce (or 1 / (bounce + 1) when bounce <= 0). */
export function springOf(ms, bounce) {
  const T = ms / 1000;
  const k = (4 * Math.PI * Math.PI) / (T * T);
  const zeta = bounce > 0 ? 1 - bounce : 1 / (bounce + 1);
  return Object.freeze({ k, c: zeta * 2 * Math.sqrt(k) });
}

export const SPRINGS = Object.freeze({
  smooth: springOf(360, 0.12), // back to rest (cards, rows, an object let go)
  snappy: springOf(220, 0), // toward a finger
});

/**
 * Moves a spring state { x, v } toward `target` by `dtMs` (1 ms semi-implicit steps, so a long frame
 * stays stable). Returns true once it has come to rest, and then sits exactly on the target.
 */
export function stepSpring(state, spring, target, dtMs) {
  const steps = Math.max(1, Math.min(64, Math.round(dtMs)));
  const h = Math.min(dtMs, 64) / 1000 / steps;
  for (let i = 0; i < steps; i++) {
    const a = -spring.k * (state.x - target) - spring.c * state.v;
    state.v += a * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.x - target) < 1e-4 && Math.abs(state.v) < 1e-3) {
    state.x = target;
    state.v = 0;
    return true;
  }
  return false;
}

// ---------- Float ----------

/** The float's height at time t (ms) for a phase: 0 at rest, 1 at the top of the 7.2 s cycle. */
export function liftAt(tMs, phase = 0) {
  return (1 - Math.cos(2 * Math.PI * (tMs / LIFE.floatPeriodMs + phase))) / 2;
}

// ---------- Tilt and light ----------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Where a pointer is on the object, -1 to 1 on each axis (the touched side presses away). */
export function aimAt(px, py, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return { x: 0, y: 0 };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return { x: clamp((px - cx) / (rect.width / 2), -1, 1), y: clamp((py - cy) / (rect.height / 2), -1, 1) };
}

/** One frame of the scroll lean: half way to the frame's target (28 px of scroll leans it all the way). */
export function leanToward(lean, scrollDeltaPx) {
  const target = clamp(scrollDeltaPx / LIFE.fullLeanPx, -1, 1);
  return lean + (target - lean) * 0.5;
}

/** The tilt from the finger (or mouse) and the scroll lean, each axis -1 to 1. */
export function objectTilt(finger, lean = 0) {
  return { x: clamp(finger.x, -1, 1), y: clamp(finger.y - lean * LIFE.scrollShare, -1, 1) };
}

export const tiltSize = (t) => Math.hypot(t.x, t.y);

/**
 * The CSS transform for a tilt, or '' at rest. The app's perspective entry (+0.0011) sends +z away from
 * the eye, CSS perspective brings +z toward it, so the rotations here carry the opposite signs of the
 * app's matrix (rotateX(y) rotateY(-x)) to look the same: the side under the finger presses away.
 */
export function tiltTransform(t) {
  if (tiltSize(t) < LIFE.restTilt) return '';
  const r = (n) => Math.round(n * 1000) / 1000;
  return `perspective(${LIFE.perspectivePx}px) rotateX(${r(-t.y * LIFE.tiltMaxDeg)}deg) rotateY(${r(t.x * LIFE.tiltMaxDeg)}deg)`;
}

/** Where the light band crosses the object (0 top left to 1 bottom right), and its strength (0 to 1, times the theme's peak). */
export function sheenAt(t) {
  return {
    along: clamp(0.5 - 0.45 * t.y + 0.45 * t.x, 0, 1),
    strength: tiltSize(t) < LIFE.restTilt ? 0 : Math.min(1, tiltSize(t)),
  };
}

// ---------- Tap reaction (MmObjectReact) ----------

/** Scale at t (0 to 1): 1 - 0.06a by 22%, 1 + 0.04a by 58%, 1 at the end, eased between keys. */
export function tapScale(t, a = 1) {
  let k;
  if (t <= 0 || t >= 1) k = 1;
  else if (t < 0.22) k = 1 - 0.06 * EASE.out(t / 0.22);
  else if (t < 0.58) k = 0.94 + 0.1 * EASE.inOut((t - 0.22) / 0.36);
  else k = 1.04 - 0.04 * EASE.out((t - 0.58) / 0.42);
  return 1 + (k - 1) * a;
}

/** Turn in degrees at t, positive clockwise: one damped swing of 2a degrees. */
export function tapTurnDeg(t, a = 1) {
  if (t <= 0 || t >= 1) return 0;
  return 2 * a * Math.sin(t * 2 * Math.PI) * (1 - t);
}

/** Web Animations keyframes for the tap (sampled every 10 ms, linear between, exact to the app's curves). */
export function tapKeyframes(a = LIFE.tapAmplitude) {
  const n = Math.round(LIFE.reactMs / 10);
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const deg = Math.round(tapTurnDeg(t, a) * 1000) / 1000;
    const s = Math.round(tapScale(t, a) * 10000) / 10000;
    frames.push({ offset: t, transform: `rotate(${deg}deg) scale(${s})` });
  }
  return frames;
}

// ---------- Sparkle (EmblemSparkle) ----------

export const GLINT_ANGLES = Object.freeze([-0.95, -0.2, 2.35, 3.5]);

/** The bloom behind the object at v (0 to 1): radius as a share of the shortest side, and alpha. */
export function bloomAt(v) {
  if (v <= 0 || v >= 1) return { radius: 0, alpha: 0 };
  const strength = v < 0.25 ? EASE.out(v / 0.25) : 1 - EASE.glide((v - 0.25) / 0.75);
  return { radius: 0.42 + 0.2 * EASE.out(v), alpha: 0.55 * strength };
}

/** The four glints at v: centre offset and arm in shares of the half side, and alpha. */
export function glintsAt(v) {
  if (v <= 0 || v >= 1) return [];
  const out = [];
  GLINT_ANGLES.forEach((angle, i) => {
    const local = clamp((v - i * 0.06) / 0.76, 0, 1);
    if (local <= 0 || local >= 1) return;
    const dist = 0.78 + 0.32 * EASE.out(local);
    const arm = 0.09 * Math.sin(local * Math.PI);
    const alpha = clamp((1 - local) * (local < 0.2 ? local / 0.2 : 1), 0, 1);
    out.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, arm, alpha });
  });
  return out;
}

// ---------- Colours ----------

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => `#${c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
export const lerpHex = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
export const rgba = (h, alpha) => `rgba(${hex(h).join(', ')}, ${Math.round(clamp(alpha, 0, 1) * 1000) / 1000})`;

/** The sparkle's glow and glint colours for a subject light ({ night, day }) on Night or Day. */
export function sparkleColours(light, day = false) {
  const base = day ? (light?.day || '#F6E8CF') : (light?.night || '#3B2A10');
  return day
    ? { glow: lerpHex(base, '#FFFFFF', 0.2), glint: lerpHex(base, '#6B4A12', 0.55) }
    : { glow: lerpHex(base, '#FFE7B8', 0.45), glint: '#FFF4DA' };
}

// ---------- Where things sit in the square box (percent of the box) ----------

/**
 * The object's place in a square box, in percent: the picture, its centre, its foot, the two contact
 * shadow ellipses (occlusion and contact, from the app's object_art.dart) and how far up from the
 * picture's bottom the light must stop (6% of its height above the ground line).
 */
export function objectStage(art, { framed = true } = {}) {
  const box = artBox(art, 100, { framed });
  if (!box) return null;
  const foot = { x: box.x + box.width * art.footX, y: box.y + box.height * art.ground };
  const w = box.width * art.footWidth;
  return {
    box,
    centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    foot,
    occlusion: { cx: foot.x + 0.04 * w, cy: foot.y + 0.015 * w, rx: 0.64 * w, ry: 0.12 * w },
    contact: { cx: foot.x + 0.02 * w, cy: foot.y - 0.005 * w, rx: 0.47 * w, ry: 0.055 * w },
    lightStop: (1 - art.ground + LIFE.lightClip) * 100,
  };
}

/** Today hero parallax: the layer's offset in px for a box of `boxHeight` whose centre is at `centreY` in a viewport of `viewportHeight`. */
export function parallaxOffset(factor, boxHeight, centreY, viewportHeight) {
  if (!(viewportHeight > 0) || !(factor > 0)) return 0;
  const travel = boxHeight * factor;
  const position = clamp(centreY / viewportHeight - 0.5, -0.75, 0.75);
  return -travel / 2 - position * travel;
}
