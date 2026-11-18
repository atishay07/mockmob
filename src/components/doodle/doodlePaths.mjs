// The pen's strokes, as plain geometry (18 Nov 2026, owner LK308: "circling the text in a fancy way, maybe drawing the line
// under it ... that kind of a doodle vibe ... while keeping it professional"). Doodle.jsx draws them; this file only makes
// the paths, so node --test can hold them (doodlePaths.test.mjs).
//
// Every mark is generated for the exact box of the words it marks (width and height in px, and the type size), never
// stretched from a template: a circle round "on time" and one round "open to you?" are both drawn by the same hand, at the
// same pen width, with the same wobble. The wobble comes from a small seeded generator, so one phrase always gets the
// same stroke (the server, a re-render and a resize agree) and two phrases never get the same one.

/** A small deterministic generator (mulberry32). */
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A steady seed from the marked words. */
export function seedOf(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const r1 = (n) => Math.round(n * 10) / 10;

/** A smooth open curve through points (Catmull-Rom, as cubic Béziers). */
export function through(points) {
  if (points.length < 2) return '';
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

/** The pen's width for a type size: about a twentieth of it, never hair-thin, never a marker. */
export const penWidth = (fs) => Math.max(1.75, Math.min(4.5, fs * 0.052));

// ---------------------------------------------------------------- the marks. Each returns { strokes: [d, ...] } in the
// order the pen makes them, or { fill: d } for the highlighter. (0, 0) is the top left of the words' box.

/** A loop round the words: a little more than one turn, starting upper left, clockwise, closing past its own start. */
function circle(w, h, fs, rand) {
  const cx = w / 2 + (rand() - 0.5) * fs * 0.04;
  const cy = h / 2 + fs * 0.03;
  const rx = w / 2 + fs * 0.3;
  const ry = h / 2 + fs * 0.1;
  const a0 = (-150 + (rand() - 0.5) * 16) * (Math.PI / 180);
  const turn = (1.13 + rand() * 0.05) * Math.PI * 2;
  const p1 = rand() * 6.28; const p2 = rand() * 6.28;
  const tilt = (-2.5 + (rand() - 0.5) * 2) * (Math.PI / 180);
  const steps = 30;
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const a = a0 + turn * u;
    // The hand drifts outward as it comes round, so the stroke's end passes outside its start instead of landing on it.
    const k = 0.97 + 0.085 * u + 0.022 * Math.sin(2 * a + p1) + 0.014 * Math.sin(3 * a + p2);
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return { strokes: [through(pts)] };
}

/** One line under the words, drawn left to right with the small sag and lift of a quick hand. */
function underline(w, h, fs, rand) {
  const y = h - fs * 0.04;
  const x0 = -fs * 0.04; const x1 = w + fs * 0.06;
  const sag = fs * (0.035 + rand() * 0.025);
  const lift = fs * (0.02 + rand() * 0.03);
  const n = 6;
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    pts.push([x0 + (x1 - x0) * u, y + Math.sin(u * Math.PI) * sag - u * lift + (rand() - 0.5) * fs * 0.012]);
  }
  return { strokes: [through(pts)] };
}

/** Two lines: out, and a shorter one back under it. */
function double(w, h, fs, rand) {
  const first = underline(w, h, fs, rand).strokes[0];
  const y = h + fs * 0.075;
  const x0 = w + fs * 0.02; const x1 = w * (0.12 + rand() * 0.12);
  const n = 5;
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    pts.push([x0 + (x1 - x0) * u, y - Math.sin(u * Math.PI) * fs * 0.03 + u * fs * 0.025 + (rand() - 0.5) * fs * 0.012]);
  }
  return { strokes: [first, through(pts)] };
}

/** A wavy line under the words. */
function squiggle(w, h, fs, rand) {
  const y = h + fs * 0.01;
  const x0 = -fs * 0.02; const x1 = w + fs * 0.04;
  const wave = fs * 0.36;
  const amp = fs * 0.05;
  const half = Math.max(4, Math.round((x1 - x0) / (wave / 2)));
  const pts = [];
  for (let i = 0; i <= half; i += 1) {
    const u = i / half;
    pts.push([x0 + (x1 - x0) * u, y + (i % 2 ? -amp : amp) * (0.85 + rand() * 0.3) - u * fs * 0.03]);
  }
  return { strokes: [through(pts)] };
}

/** A line through the words. */
function strike(w, h, fs, rand) {
  const y = h * 0.54;
  const pts = [[-fs * 0.08, y + fs * 0.05], [w * 0.5, y + (rand() - 0.5) * fs * 0.04], [w + fs * 0.1, y - fs * 0.06]];
  return { strokes: [through(pts)] };
}

/** Three short strokes off the words' upper right corner: the pen's "this". */
function spark(w, h, fs, rand) {
  const ox = w + fs * 0.1; const oy = fs * 0.12;
  const strokes = [];
  for (const deg of [-78, -42, -8]) {
    const a = (deg + (rand() - 0.5) * 8) * (Math.PI / 180);
    const from = fs * 0.1; const to = fs * (0.3 + rand() * 0.06);
    strokes.push(through([[ox + Math.cos(a) * from, oy + Math.sin(a) * from], [ox + Math.cos(a) * to, oy + Math.sin(a) * to]]));
  }
  return { strokes };
}

/** A tick, made in the box. */
function tick(w, h, fs, rand) {
  const s = Math.min(w, h);
  const j = () => (rand() - 0.5) * s * 0.04;
  return { strokes: [through([[s * 0.14 + j(), h * 0.56 + j()], [s * 0.4 + j(), h * 0.8 + j()], [w - s * 0.08 + j(), h * 0.16 + j()]])] };
}

/** A cross, made in the box: two strokes. */
function cross(w, h, fs, rand) {
  const s = Math.min(w, h);
  const j = () => (rand() - 0.5) * s * 0.05;
  return { strokes: [
    through([[s * 0.16 + j(), h * 0.18 + j()], [w - s * 0.16 + j(), h * 0.84 + j()]]),
    through([[w - s * 0.14 + j(), h * 0.16 + j()], [s * 0.18 + j(), h * 0.86 + j()]]),
  ] };
}

/** The highlighter: one filled swipe behind the words, its ends cut on the slant, its long edges a little uneven. */
function highlight(w, h, fs, rand) {
  const top = h * 0.14; const bottom = h * 0.9;
  const x0 = -fs * 0.14; const x1 = w + fs * 0.16;
  const slant = fs * 0.07;
  const n = 5;
  const upper = []; const lower = [];
  for (let i = 0; i <= n; i += 1) {
    const u = i / n;
    upper.push([x0 + slant + (x1 - x0) * u, top + (rand() - 0.5) * fs * 0.05 - u * fs * 0.02]);
    lower.push([x1 - slant - (x1 - x0) * u, bottom + (rand() - 0.5) * fs * 0.05 - (1 - u) * fs * 0.02]);
  }
  const a = through(upper);
  const b = through(lower).replace(/^M/, 'L');
  return { fill: `${a}${b}Z` };
}

export const MARKS = Object.freeze({ circle, underline, double, squiggle, strike, spark, tick, cross, highlight });

/** How long each mark takes to draw, ms: a loop is slower than a line. */
export const DRAW_MS = Object.freeze({ circle: 640, underline: 380, double: 560, squiggle: 620, strike: 300, spark: 300, tick: 320, cross: 360, highlight: 460 });

/**
 * The mark for a box.
 * @returns {{ strokes?: string[], fill?: string, pen: number }}
 */
export function doodlePath(mark, { width, height, fontSize, seed = 1 }) {
  const make = MARKS[mark];
  if (!make || !(width > 0) || !(height > 0)) return { strokes: [], pen: 0 };
  const fs = fontSize > 0 ? fontSize : height / 1.2;
  return { ...make(width, height, fs, seeded(seed)), pen: penWidth(fs) };
}
