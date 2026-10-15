// Mobi's drawing as numbers: the web twin of mobi_geometry.dart, mobi_painter.dart (placement) and
// mobi_details.dart (eyes, hands, antenna, effects). `frameModel(rig, { px })` turns one rig into
// every transform, path and opacity the SVG needs for one frame; MobiFigure.jsx and MobiMarks.jsx
// write those onto the elements. No colours here: colours are CSS variables (Night and Day), so a
// theme change never needs a re-render. Pure, so it is tested without a browser
// (data/tests/mobi_rig.test.mjs).
//
// Units: design units in a 140 by 168 box, soles on y 162, up is negative.

import { Cubic } from './mobiRig.js';

const PI = Math.PI;
const EASE_IN_OUT = new Cubic([0.42, 0, 0.58, 1]);
const EASE_OUT_BACK = new Cubic([0.175, 0.885, 0.32, 1.275]);
const EASE_IN_CUBIC = new Cubic([0.55, 0.055, 0.675, 0.19]);
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clampN((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const f = (n) => Math.round(n * 1000) / 1000;
const deg = (rad) => f((rad * 180) / PI);

export const GEO = {
  width: 140, height: 168, ground: 162,
  top: [75, 30], right: [126, 84], bottom: [71, 142], left: [16, 79],
  pivot: [71, 136], bodyDrop: 4,
  visor: [70, 82], visorSize: [66, 34], visorRadius: 16,
  eyeSpread: 13.5, eyeDrop: 1.5, eyeSize: [7.6, 15], lookTravel: [9, 4.5],
  shoulderL: [35, 104], shoulderR: [108, 103], armLength: 23, armWidth: 9.6, handScale: 1.22,
  hipL: [62, 131], hipR: [81, 131], legWidth: 9.6,
  ankleL: [47, 142.5], ankleR: [96, 142.5], bootScale: 1.3,
  antennaBase: [90, 50], antennaTip: [104, 9], antennaBall: 5.8,
  cuff: { l: -7.9, t: -1.6, r: 7.5, b: 2.8 },
};

/** The paint box the face-grow legibility rule reads (rig table `paint`). */
export const PAINT = {
  lidFollow: { from: 0.45, k: 0.22 },
  legibility: { fullAt: 0.42, maxAt: 0.2, eyeGrow: 0.34, strokeGrow: 0.6, travelShrink: 0.22 },
};

/** 0 at a hero size, 1 at a 32 dp avatar: how much the small-size face boost applies at px per design unit. */
export function legibility(px, p = PAINT.legibility) {
  return clampN((p.fullAt - px) / (p.fullAt - p.maxAt), 0, 1);
}

// ---- The body outline: a rounded polygon whose sides bulge (soft, pillowy paper) ----------------------

function unit(v) { const d = Math.hypot(v[0], v[1]); return [v[0] / d, v[1] / d]; }

/** A rounded polygon path (SVG d) whose sides bulge outward by `bulge`: the Dart MobiGeo.pillow. */
export function pillow(pts, radii, bulge = 0) {
  const n = pts.length;
  const starts = [];
  const ends = [];
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const up = unit([prev[0] - p[0], prev[1] - p[1]]);
    const un = unit([next[0] - p[0], next[1] - p[1]]);
    starts.push([p[0] + up[0] * radii[i], p[1] + up[1] * radii[i]]);
    ends.push([p[0] + un[0] * radii[i], p[1] + un[1] * radii[i]]);
  }
  let d = `M${f(ends[0][0])} ${f(ends[0][1])}`;
  for (let k = 1; k <= n; k += 1) {
    const i = k % n;
    const a = ends[k - 1];
    const b = starts[i];
    if (bulge === 0) d += `L${f(b[0])} ${f(b[1])}`;
    else {
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const dd = [b[0] - a[0], b[1] - a[1]];
      const len = Math.hypot(dd[0], dd[1]);
      const normal = [dd[1] / len, -dd[0] / len];
      d += `Q${f(mid[0] + normal[0] * bulge)} ${f(mid[1] + normal[1] * bulge)} ${f(b[0])} ${f(b[1])}`;
    }
    d += `Q${pts[i][0]} ${pts[i][1]} ${f(ends[i][0])} ${f(ends[i][1])}`;
  }
  return `${d}Z`;
}

export const BODY_PATH = pillow([GEO.top, GEO.right, GEO.bottom, GEO.left], [9, 16, 13, 16], 6);

/** An elliptical arc as an SVG path: start angle and sweep in radians, clockwise on screen (as Flutter's drawArc). */
export function arcPath(cx, cy, rx, ry, start, sweep) {
  const p = (a) => `${f(cx + rx * Math.cos(a))} ${f(cy + ry * Math.sin(a))}`;
  return `M${p(start)}A${f(rx)} ${f(ry)} 0 ${Math.abs(sweep) > PI ? 1 : 0} ${sweep >= 0 ? 1 : 0} ${p(start + sweep)}`;
}

const CUFF = { cx: (GEO.cuff.l + GEO.cuff.r) / 2, cy: (GEO.cuff.t + GEO.cuff.b) / 2, rx: (GEO.cuff.r - GEO.cuff.l) / 2, ry: (GEO.cuff.b - GEO.cuff.t) / 2 };
export { CUFF };

// ---- The body transform ---------------------------------------------------------------------------------

export function bodyXf(r) {
  const [pvx, pvy] = GEO.pivot;
  const sx = 1 - r.squash * 0.7;
  const sy = 1 + r.squash;
  return {
    sx, sy,
    attr: `translate(${f(r.x + pvx)} ${f(r.y + pvy)}) rotate(${deg(r.tilt)}) scale(${f(sx)} ${f(sy)}) translate(${-pvx} ${-pvy + GEO.bodyDrop})`,
    map(o) {
      const x = (o[0] - pvx) * sx;
      const y = (o[1] + GEO.bodyDrop - pvy) * sy;
      const s = Math.sin(r.tilt);
      const k = Math.cos(r.tilt);
      return [pvx + r.x + x * k - y * s, pvy + r.y + x * s + y * k];
    },
  };
}

// ---- Limbs ---------------------------------------------------------------------------------------------

export function armModel(a, side) {
  const shoulder = side < 0 ? GEO.shoulderL : GEO.shoulderR;
  const dir = [side * Math.sin(a.angle), Math.cos(a.angle)];
  const len = GEO.armLength * a.reach;
  const wrist = [shoulder[0] + dir[0] * len, shoulder[1] + dir[1] * len];
  const outward = [dir[1] * side, -dir[0] * side];
  const ctrl = [(shoulder[0] + wrist[0]) / 2 + outward[0] * a.bend * 9, (shoulder[1] + wrist[1]) / 2 + outward[1] * a.bend * 9];
  const tangent = [wrist[0] - ctrl[0], wrist[1] - ctrl[1]];
  const theta = Math.atan2(-tangent[0], tangent[1]) + a.twist * side;
  const p = a.point;
  return {
    front: a.front >= 0.5,
    d: `M${f(shoulder[0])} ${f(shoulder[1])}Q${f(ctrl[0])} ${f(ctrl[1])} ${f(wrist[0])} ${f(wrist[1])}`,
    hand: `translate(${f(wrist[0])} ${f(wrist[1])}) rotate(${deg(theta)}) scale(${side} 1) scale(${GEO.handScale}) translate(0 -2.5)`,
    point: p,
    palm: { cx: 0, cy: f(8.6 - 1.4 * p), rx: f(7.8 - 1.2 * p), ry: f(8.8 - 2 * p) },
    finger: p > 0.02 ? { h: f(9 * p), creaseY: f(9.8 + 1.4 * p), creaseA: f(0.7 * p), rimH: f(Math.max(0, 9 * p - 0.8)) } : null,
    thumb: { transform: `translate(${f(-6.6 + 0.8 * p)} 5.2) rotate(${deg(0.55)})`, ry: f((9.6 - 2 * p) / 2) },
    palmRim: handRim(p),
  };
}

function handRim(p) {
  const cy = 8.6 - 1.4 * p;
  const rx = 7.8 - 1.2 * p - 0.9;
  const ry = 8.8 - 2 * p - 0.9;
  return arcPath(0, cy, rx, ry, PI, PI * 0.55);
}

export function legModel(hipPt, side, anklePt, b) {
  const end = [anklePt[0] + b.dx, anklePt[1] + b.dy];
  const mid = [(hipPt[0] + end[0]) / 2 + side * 1.5, (hipPt[1] + end[1]) / 2];
  const s = side * GEO.bootScale;
  return {
    frame: `translate(${f(anklePt[0] + b.dx)} ${f(anklePt[1] + b.dy)}) rotate(${deg(-b.rot * side)}) scale(${f(s)} ${GEO.bootScale})`,
    unframe: `scale(${f(1 / s)} ${f(1 / GEO.bootScale)}) rotate(${deg(b.rot * side)}) translate(${f(-(anklePt[0] + b.dx))} ${f(-(anklePt[1] + b.dy))})`,
    d: `M${f(hipPt[0])} ${f(hipPt[1])}Q${f(mid[0])} ${f(mid[1])} ${f(end[0])} ${f(end[1] + 5)}`,
  };
}

// ---- The face -----------------------------------------------------------------------------------------

function eyeModel(center, e, side, grow, stroke) {
  const [ew, eh] = GEO.eyeSize;
  const w = ew * grow;
  const fullH = eh * grow;
  const arc = smooth(0.4, 0.72, e.happy);
  const closing = 1 - 0.85 * smooth(0, 0.5, e.happy);
  const lift = smooth(0, 0.7, e.smile);
  const shut = 1 - smooth(0.05, 0.22, e.open);
  const lidLine = shut * (1 - arc);
  const [cx, cy] = center;
  const m = { lid: null, body: null, arc: null };
  if (lidLine > 0.01) {
    const y = cy + fullH * 0.16;
    m.lid = { d: `M${f(cx - w * 0.82)} ${f(y - 0.6 * grow)}Q${f(cx)} ${f(y + 4.6 * grow)} ${f(cx + w * 0.82)} ${f(y - 0.6 * grow)}`, a: f(lidLine), sw: f(2.9 * stroke) };
  }
  if (arc < 1 && shut < 1) {
    const h = Math.max(2.4 * stroke, fullH * clampN(e.open, 0, 1.2) * closing * (1 - 0.06 * lift));
    const rw = w * (1 + 0.5 * lift);
    const rect = { l: cx - rw / 2, r: cx + rw / 2, t: cy + (fullH - h) * 0.18 - h / 2, b: cy + (fullH - h) * 0.18 + h / 2, w: rw, h, cx };
    let clipLift = null;
    if (lift > 0.01) {
      const edge = rect.b - lift * h * 0.08;
      const ctrl = rect.b - lift * h * 0.5;
      clipLift = `M${f(rect.l - 3)} ${f(rect.t - 3)}L${f(rect.r + 3)} ${f(rect.t - 3)}L${f(rect.r + 3)} ${f(edge)}Q${f(rect.cx)} ${f(ctrl)} ${f(rect.l - 3)} ${f(edge)}Z`;
    }
    let clipLid = null;
    if (e.lid > 0.01 && Math.abs(e.slant) <= 0.01) {
      const y = rect.t + rect.h * clampN(e.lid, 0, 0.92);
      const sag = rect.h * 0.22 * e.lid;
      clipLid = `M${f(rect.l - 2)} ${f(y - sag)}Q${f(rect.cx)} ${f(y + sag)} ${f(rect.r + 2)} ${f(y - sag)}L${f(rect.r + 2)} ${f(rect.b + 2)}L${f(rect.l - 2)} ${f(rect.b + 2)}Z`;
    } else if (Math.abs(e.slant) > 0.01) {
      const s = clampN(e.slant, -1, 1);
      const base = rect.t + rect.h * clampN(e.lid, 0, 0.92);
      const outer = base + rect.h * 0.34 * s;
      const inner = base - rect.h * 0.04 * s;
      const yl = side < 0 ? outer : inner;
      const yr = side < 0 ? inner : outer;
      clipLid = `M${f(rect.l - 2)} ${f(yl)}Q${f(rect.cx)} ${f((yl + yr) / 2 + rect.h * 0.05 * e.lid)} ${f(rect.r + 2)} ${f(yr)}L${f(rect.r + 2)} ${f(rect.b + 2)}L${f(rect.l - 2)} ${f(rect.b + 2)}Z`;
    }
    const alpha = (1 - arc) * (1 - shut);
    m.body = {
      x: f(rect.l), y: f(rect.t), w: f(rect.w), h: f(h), rx: f(rect.w / 2), ry: f(Math.min(h / 2, fullH / 2)), a: f(alpha), clipLift, clipLid,
      catchlight: h > 6 && e.lid < 0.4 && e.slant < 0.5 && stroke < 1.3 && lift < 0.5
        ? { cx: f(rect.cx - w * 0.12), cy: f(rect.t + h * 0.24), rx: f(w * 0.17), ry: f(h * 0.08), a: f(0.9 * alpha) }
        : null,
    };
  }
  if (arc > 0) {
    m.arc = { d: `M${f(cx - w * 0.82)} ${f(cy + 3 * grow)}Q${f(cx)} ${f(cy - 7.5 * grow)} ${f(cx + w * 0.82)} ${f(cy + 3 * grow)}`, a: f(arc), sw: f(3.4 * stroke) };
  }
  return m;
}

function eyeGlowModel(center, e, grow) {
  const shown = (clampN(e.open, 0, 1.2) - 0.25 > 0 ? clampN(e.open, 0, 1.2) - 0.25 : 0)
    * (1 - smooth(0, 0.6, e.happy)) * (1 - smooth(0, 0.12, e.lid)) * (1 - smooth(0, 0.12, Math.abs(e.slant))) * (1 - smooth(0.05, 0.3, e.smile));
  if (shown <= 0.02) return null;
  const q = Math.round(0.2 * shown * 255);
  if (q <= 0) return null;
  return { cx: f(center[0]), cy: f(center[1]), rx: f(GEO.eyeSize[0] * 1.35 * grow), ry: f(GEO.eyeSize[1] * 0.85 * grow), a: f(q / 255) };
}

export function eyesModel(r, { px = 1 } = {}) {
  const legible = legibility(px);
  const [vx, vy] = GEO.visor;
  const travel = 1 - PAINT.legibility.travelShrink * legible;
  const base = [vx + r.lookX * GEO.lookTravel[0] * travel, vy + GEO.eyeDrop + r.lookY * GEO.lookTravel[1] * travel];
  const follow = PAINT.lidFollow.k * clampN(r.lookY - PAINT.lidFollow.from, 0, 1);
  const lidded = (e) => (follow > e.lid && Math.abs(e.slant) <= 0.01 ? { ...e, lid: follow } : e);
  const grow = 1 + PAINT.legibility.eyeGrow * legible;
  const stroke = 1 + PAINT.legibility.strokeGrow * legible;
  const l = [base[0] - GEO.eyeSpread, base[1]];
  const rr = [base[0] + GEO.eyeSpread, base[1]];
  return {
    glowL: eyeGlowModel(l, r.eyeL, grow), glowR: eyeGlowModel(rr, r.eyeR, grow),
    L: eyeModel(l, lidded(r.eyeL), -1, grow, stroke), R: eyeModel(rr, lidded(r.eyeR), 1, grow, stroke),
  };
}

// ---- The antenna ----------------------------------------------------------------------------------------

export function antennaModel(sway, glow) {
  const base = GEO.antennaBase;
  const rot = (o, a) => {
    const dx = o[0] - base[0];
    const dy = o[1] - base[1];
    const s = Math.sin(a);
    const k = Math.cos(a);
    return [base[0] + dx * k - dy * s, base[1] + dx * s + dy * k];
  };
  const tip = rot(GEO.antennaTip, sway);
  const c1 = rot([88, 26], sway * 0.35);
  const c2 = rot([92, 9], sway * 0.75);
  const g = clampN(glow, 0, 1);
  return {
    d: `M${base[0]} ${base[1]}C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(tip[0])} ${f(tip[1])}`,
    tip: [f(tip[0]), f(tip[1])],
    glow: glow > 0.01 ? g : 0,
    haloScale: f(GEO.antennaBall * (2.2 + 3.4 * g)),
    haloScaleDay: f(GEO.antennaBall * (2.2 + 4 * g)),
    litR: f(GEO.antennaBall + 1.2 + 1.6 * g),
  };
}

// ---- Effects ---------------------------------------------------------------------------------------------

const SPARKS = [[[20, 40], 7, 0], [[134, 44], 9, 0.12], [[124, 4], 5.5, 0.24], [[8, 78], 5, 0.34]];

export function sparkleModel(progress) {
  return SPARKS.map(([at, size, delay]) => {
    if (progress < 0) return null;
    const q = clampN((progress - delay) / 0.62, 0, 1);
    if (q <= 0 || q >= 1) return null;
    const s = size * Math.sin(PI * q);
    return { transform: `translate(${at[0]} ${at[1]}) rotate(${deg(0.6 * q)})`, d: `M0 ${f(-s)}Q0 0 ${f(s)} 0Q0 0 0 ${f(s)}Q0 0 ${f(-s)} 0Q0 0 0 ${f(-s)}Z` };
  });
}

const BUBBLES = [[-2.85, 76, 4.6], [-2.45, 90, 4.0], [-2.05, 74, 5.8], [-1.68, 94, 4.2], [-0.72, 78, 5.6], [-0.42, 92, 4.2], [-3.05, 88, 3.8], [-0.12, 84, 4.0]];

/** Volt confetti: each piece a bubble that grows, flies, then a ring that widens and fades. */
export function burstModel(progress, origin) {
  return BUBBLES.map(([angle, dist, radius], i) => {
    if (progress < 0) return null;
    const q = clampN((progress - i * 0.045) / 0.62, 0, 1);
    if (q <= 0 || q >= 1) return null;
    const travel = 1 - (1 - Math.min(q / 0.7, 1)) ** 3;
    const x = origin[0] + Math.cos(angle) * dist * travel;
    const y = origin[1] + Math.sin(angle) * dist * travel;
    if (q < 0.74) {
      const r = radius * (0.4 + 0.6 * smooth(0, 0.2, q));
      return { kind: 'bubble', x: f(x), y: f(y), r: f(r), hx: f(x - r * 0.32), hy: f(y - r * 0.32), hr: f(r * 0.28) };
    }
    const pop = (q - 0.74) / 0.26;
    const fade = (1 - pop) ** 0.7;
    const ringR = radius * (1 + pop * 1.4);
    return { kind: 'ring', x: f(x), y: f(y), r: f(ringR), wDay: f(2.6 * fade + 0.9), aDay: f(0.6 * fade), w: f(1.9 * fade + 0.4), a: f(fade) };
  });
}

/** The shockwaves a landing sends along the floor (celebrate's two landings). */
export function landRingsModel(progress, center) {
  return [[0.4, 0.4, 1], [0.69, 0.3, 0.55]].map(([start, length, scale]) => {
    if (progress < 0) return null;
    const q = (progress - start) / length;
    if (q <= 0 || q >= 1) return null;
    const out = 1 - (1 - q) ** 3;
    const fade = (1 - q) ** 1.4;
    const rx = (20 + 44 * out) * scale;
    const width = (2.8 * fade + 0.5) * (0.6 + 0.4 * scale);
    return { cx: f(center[0]), cy: f(center[1]), rx: f(rx), ry: f(rx * 0.16), w: f(width), wDay: f(width + 1.1), a: f(0.95 * fade), aDay: f(0.55 * fade) };
  });
}

const BUBBLE_AT = [122, 33];
const BUBBLE_R = 13;

/** The answer bubble beside the head (a right answer): pops in, inks its tick, shrinks away. */
export function answerBubbleModel(progress) {
  if (progress < 0 || progress > 1) return null;
  const r = BUBBLE_R;
  const inT = smooth(0, 0.045, progress);
  const popT = smooth(0, 0.18, progress);
  const outT = smooth(0.8, 1, progress);
  const alpha = clampN(inT * (1 - smooth(0.94, 1, progress)), 0, 1);
  if (alpha <= 0.01) return null;
  const lift = 9 * outT;
  const scale = (0.3 + 0.7 * EASE_OUT_BACK.transform(popT)) * (1 - EASE_IN_CUBIC.transform(outT) * 0.9);
  const tick = smooth(0.1, 0.3, progress);
  let tickD = null;
  if (tick > 0) {
    const pts = [[-r * 0.42, r * 0.04], [-r * 0.1, r * 0.38], [r * 0.46, -r * 0.34]];
    const first = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const second = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
    const len = tick * (first + second);
    if (len <= first) {
      const t = len / first;
      tickD = `M${f(pts[0][0])} ${f(pts[0][1])}L${f(lerp(pts[0][0], pts[1][0], t))} ${f(lerp(pts[0][1], pts[1][1], t))}`;
    } else {
      const t = (len - first) / second;
      tickD = `M${f(pts[0][0])} ${f(pts[0][1])}L${f(pts[1][0])} ${f(pts[1][1])}L${f(lerp(pts[1][0], pts[2][0], t))} ${f(lerp(pts[1][1], pts[2][1], t))}`;
    }
  }
  return { transform: `translate(${BUBBLE_AT[0]} ${f(BUBBLE_AT[1] - lift)}) scale(${f(scale)})`, a: f(alpha), tickD };
}

export const BUBBLE = { r: BUBBLE_R, tail: `M${f(-BUBBLE_R * 0.62)} ${f(BUBBLE_R * 0.62)}Q${f(-BUBBLE_R * 0.92)} ${f(BUBBLE_R * 1.2)} ${f(-BUBBLE_R * 1.55)} ${f(BUBBLE_R * 1.42)}Q${f(-BUBBLE_R * 0.78)} ${f(BUBBLE_R * 1.46)} ${f(-BUBBLE_R * 0.18)} ${f(BUBBLE_R * 0.98)}Z` };

/** The sleepy z's, rising from the top left of the head. */
export function zzzModel(progress, from) {
  return [0, 1].map((i) => {
    if (progress < 0) return null;
    const q = (progress + i * 0.5) % 1;
    const a = Math.min(1, Math.sin(PI * q) * 1.5);
    const s = 7 + 4.5 * q + 1.5 * i;
    const ox = from[0] + (-8 * q - i * 4);
    const oy = from[1] + -24 * q;
    return { d: `M${f(ox - s / 2)} ${f(oy - s / 2)}L${f(ox + s / 2)} ${f(oy - s / 2)}L${f(ox - s / 2)} ${f(oy + s / 2)}L${f(ox + s / 2)} ${f(oy + s / 2)}`, a: f(a) };
  });
}

/** A soft band of lamp light sweeping across the visor glass, left to right. */
export function glintModel(progress, tilt) {
  if (progress < 0 || progress > 1) return null;
  const [vx, vy] = GEO.visor;
  const left = vx - GEO.visorSize[0] / 2;
  const width = GEO.visorSize[0];
  const top = vy - GEO.visorSize[1] / 2;
  const bottom = top + GEO.visorSize[1];
  const x = left - 22 + (width + 44) * EASE_IN_OUT.transform(progress);
  const lean = 0.5 + 0.5 * clampN(Math.abs(tilt) / 0.06, 0, 1);
  const a = Math.sin(PI * progress) * lean;
  const band = (x0, w, alpha) => ({ d: `M${f(x0 + 7)} ${top}L${f(x0 + 7 + w)} ${top}L${f(x0 - 7 + w)} ${bottom}L${f(x0 - 7)} ${bottom}Z`, a: f(alpha) });
  return [band(x, 16, 0.14 * a), band(x + 14, 6, 0.1 * a)];
}

// ---- The whole frame -------------------------------------------------------------------------------------

/**
 * Every number the SVG needs for one rig. `px` is how many CSS pixels one design unit covers (the
 * face grows below 0.42, so every expression reads at 32 px). `head` frames only the head: no limbs,
 * boots, shadow or ground effects (used for small avatars).
 */
export function frameModel(r, { px = 1, head = false } = {}) {
  const body = bodyXf(r);
  const lift = Math.max(0, -r.y);
  const k = clampN(1 - lift / 70, 0.35, 1);
  const m = {
    body: body.attr,
    shadowK: f(k),
    shadowCx: f(71 + r.x * 0.6),
    antenna: antennaModel(r.antenna, r.glow),
    arms: { L: armModel(r.armL, -1), R: armModel(r.armR, 1) },
    legs: head ? null : {
      L: legModel(body.map(GEO.hipL), -1, GEO.ankleL, r.bootL),
      R: legModel(body.map(GEO.hipR), 1, GEO.ankleR, r.bootR),
    },
    eyes: eyesModel(r, { px }),
    glint: glintModel(r.glint, r.tilt),
    sheet: r.sheet > 0.01 ? { transform: `translate(71 ${f(116 + (1 - r.sheet) * 8)}) rotate(${deg(-0.06)}) scale(${f(1.3 * (0.6 + 0.4 * r.sheet))})` } : null,
    sparkle: sparkleModel(r.sparkle),
    bubble: answerBubbleModel(r.bubble),
    zzz: zzzModel(r.zzz, body.map([30, 28])),
    burst: head ? [null] : burstModel(r.burst, body.map([71, 86])),
    land: head ? [null, null] : landRingsModel(r.burst, [71 + r.x * 0.6, GEO.ground + 0.5]),
    boots: {
      L: { dx: r.bootL.dx, dy: r.bootL.dy, rot: r.bootL.rot },
      R: { dx: r.bootR.dx, dy: r.bootR.dy, rot: r.bootR.rot },
    },
  };
  return m;
}
