// Splits logo B into its parts for the home page's opening (LK74, SPEC-HOME-1104 decisions 1 and 6):
//
//   node scripts/brand/split-logo-letters.mjs
//
// The site draws logo B from src/components/brand/logoB.js, where the six letters are ONE merged outline. The opening
// (src/components/landing/OpeningMo.jsx, the app's "mo" opening, brand_opening.dart) unfolds the letters one by one, so
// it needs each letter on its own. This script cuts the merged outline into its subpaths, gives each subpath to the
// letter whose pen box holds the centre of its ink (letterX from the app's logo_geometry.g.dart:132-265; Mobi is index
// 5), and writes src/components/brand/logoLetters.mjs. Nothing is redrawn: every subpath is copied byte for byte.
//
// It also writes what the opening needs to place the parts, all in the logo's own units (1000 per em, y down) and as
// fractions of the drawn box (the word plus the volt dot, exactly Logo.jsx's viewBox, so the opening's last frame is
// the bar logo and the hand-off is a pure translate plus scale):
//   - each letter's ink box, its hinge (the edge it shares with the neighbour nearer the "mo") and its slot (its ink
//     plus the gap to that neighbour), which the unfold scales and slides by;
//   - the "mo" centre (the camera's first focus), Mobi's eyes (blink and ink origins) and the dot from Logo.jsx's
//     DOT_R and DOT_GAP (read from its source, so the two can never drift; opening.test.mjs checks them too).
// Run it again whenever logoB.js or Logo.jsx's dot changes.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'src', 'components', 'brand', 'logoLetters.mjs');
const { LOGO_B_LETTERS, LOGO_B_MOBI, LOGO_B_VIEWBOX } = await import(pathToFileURL(path.join(ROOT, 'src', 'components', 'brand', 'logoB.js')).href);

// The app's pen positions (logo_geometry.g.dart, LogoGeometry.letterX) and the word.
const WORD = 'mockmob';
const MOBI_INDEX = 5;
const LETTER_X = [0, 865, 1445, 1968, 2549, 3423.22, 3987.35];

// The dot, from Logo.jsx's own constants.
const logoSrc = readFileSync(path.join(ROOT, 'src', 'components', 'Logo.jsx'), 'utf8');
const num = (name) => {
  const m = logoSrc.match(new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?);`));
  if (!m) throw new Error(`Logo.jsx has no ${name}`);
  return Number(m[1]);
};
const DOT_R = num('DOT_R');
const DOT_GAP = num('DOT_GAP');

const quadAt = (a, b, c, t) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c;
const quadRoot = (a, b, c) => (a - 2 * b + c === 0 ? -1 : (a - b) / (a - 2 * b + c));
const cubicAt = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
/** Where a cubic's derivative is 0 inside (0, 1). */
function cubicRoots(a, b, c, d) {
  const A = -a + 3 * b - 3 * c + d;
  const B = 2 * (a - 2 * b + c);
  const C = b - a;
  const roots = [];
  if (Math.abs(A) < 1e-12) { if (Math.abs(B) > 1e-12) roots.push(-C / B); } else {
    const disc = B * B - 4 * A * C;
    if (disc >= 0) roots.push((-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A));
  }
  return roots.filter((t) => t > 0 && t < 1);
}

/** Splits an absolute SVG path (M L H V Q C Z) into subpaths and measures each one's ink box (curve extremes included). */
function subpaths(d) {
  const out = [];
  for (const sub of d.match(/M[^M]*/g)) {
    const tokens = sub.match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
    let cmd = '';
    let x = 0;
    let y = 0;
    const xs = [];
    const ys = [];
    for (let i = 0; i < tokens.length;) {
      if (/[A-Z]/i.test(tokens[i])) { cmd = tokens[i]; i += 1; if (cmd === 'Z') continue; }
      const n = (k) => Number(tokens[i + k]);
      if (cmd === 'M' || cmd === 'L') { x = n(0); y = n(1); i += 2; } else if (cmd === 'H') { x = n(0); i += 1; } else if (cmd === 'V') { y = n(0); i += 1; } else if (cmd === 'Q') {
        // A curve's ink can pass its end points: add its extremes (where the derivative is 0) too.
        for (const t of [quadRoot(x, n(0), n(2)), quadRoot(y, n(1), n(3))]) if (t > 0 && t < 1) { xs.push(quadAt(x, n(0), n(2), t)); ys.push(quadAt(y, n(1), n(3), t)); }
        x = n(2); y = n(3); i += 4;
      } else if (cmd === 'C') {
        for (const t of [...cubicRoots(x, n(0), n(2), n(4)), ...cubicRoots(y, n(1), n(3), n(5))]) { xs.push(cubicAt(x, n(0), n(2), n(4), t)); ys.push(cubicAt(y, n(1), n(3), n(5), t)); }
        x = n(4); y = n(5); i += 6;
      } else throw new Error(`unexpected path command ${cmd}`);
      xs.push(x);
      ys.push(y);
    }
    out.push({ d: sub.trim(), box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  return out;
}

const r2 = (v) => Math.round(v * 100) / 100;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const union = (boxes) => [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))];

// 1. The letters.
const parts = subpaths(LOGO_B_LETTERS);
const letters = [];
for (let i = 0; i < WORD.length; i += 1) {
  if (i === MOBI_INDEX) continue;
  const lo = LETTER_X[i];
  const hi = i + 1 < LETTER_X.length ? LETTER_X[i + 1] : Infinity;
  const mine = parts.filter((p) => { const cx = (p.box[0] + p.box[2]) / 2; return cx >= lo && cx < hi; });
  if (!mine.length) throw new Error(`no outline for letter ${i} (${WORD[i]})`);
  letters.push({ char: WORD[i], index: i, x: lo, d: mine.map((p) => p.d).join(''), ink: union(mine.map((p) => p.box)).map(r2) });
}
const used = letters.reduce((n, l) => n + l.d.match(/M/g).length, 0);
if (used !== parts.length) throw new Error(`${parts.length - used} subpaths were not given to a letter`);
if (letters.map((l) => l.d).join('') !== parts.map((p) => p.d).join('')) throw new Error('the letters do not rebuild the merged outline in order');

// 2. Mobi: his ink (the small body, the master the composed word draws) and his eyes.
const mobiInk = subpaths(LOGO_B_MOBI.small.body)[0].box.map(r2);
const fullEyes = subpaths(LOGO_B_MOBI.full.eyes);
if (fullEyes.length !== 3) throw new Error('the full master should hold a left eye and a ring (outer and hole)');
const [eyeLeftFull, ringOuter, ringHole] = fullEyes;
const smallEyes = subpaths(LOGO_B_MOBI.small.eyes);
const eyesBox = union([...fullEyes, ...smallEyes].map((p) => p.box));
const visorBox = subpaths(LOGO_B_MOBI.small.visor)[0].box;

// 3. The drawn box: logo B plus the dot (Logo.jsx's VIEWBOX).
const [VB_X, VB_Y, VB_W, VB_H] = LOGO_B_VIEWBOX.split(' ').map(Number);
const BOX = { x: VB_X, y: VB_Y, w: r2(VB_W + DOT_GAP + DOT_R * 2), h: VB_H };
const dot = { r: DOT_R, gap: DOT_GAP, cx: r2(VB_X + VB_W + DOT_GAP + DOT_R), cy: -DOT_R };
const fx = (x) => r5((x - BOX.x) / BOX.w);
const fy = (y) => r5((y - BOX.y) / BOX.h);

// 4. The unfold (brand_opening.dart poseAt): "mock" opens leftwards from the m of "mo", nearest first; the b opens
// rightwards from Mobi. A letter scales about its hinge and rides on its neighbour's moving edge, so each one's slide is
// the sum of the slots between it and the "mo" times what is still folded: nested slides, one per slot.
const inkLeft = (i) => (i === MOBI_INDEX ? mobiInk[0] : letters.find((l) => l.index === i).ink[0]);
const inkRight = (i) => (i === MOBI_INDEX ? mobiInk[2] : letters.find((l) => l.index === i).ink[2]);
const unfold = [];
for (let i = MOBI_INDEX - 2, k = 0; i >= 0; i -= 1, k += 1) {
  const hinge = inkLeft(i + 1);
  unfold.push({ index: i, side: 'left', k, hinge: fx(hinge), slot: r5((hinge - inkLeft(i)) / BOX.w) });
}
for (let j = MOBI_INDEX + 1, k = 0; j < WORD.length; j += 1, k += 1) {
  const hinge = inkRight(j - 1);
  unfold.push({ index: j, side: 'right', k, hinge: fx(hinge), slot: r5((inkRight(j) - hinge) / BOX.w) });
}

// 5. The camera's first focus: the "mo" (the m before Mobi, and Mobi), its centre as an offset from the box centre.
const mLetter = letters.find((l) => l.index === MOBI_INDEX - 1);
const moBox = union([mLetter.ink, mobiInk]);
const mo = {
  ink: moBox.map(r2),
  dx: r5(((moBox[0] + moBox[2]) / 2 - (BOX.x + BOX.w / 2)) / BOX.w),
  dy: r5(((moBox[1] + moBox[3]) / 2 - (BOX.y + BOX.h / 2)) / BOX.h),
  width: r5((moBox[2] - moBox[0]) / BOX.w),
};

const js = (v) => JSON.stringify(v);
const file = `// GENERATED by scripts/brand/split-logo-letters.mjs from src/components/brand/logoB.js and Logo.jsx's dot. Never edit by hand.
// Logo B cut into its letters for the home page's opening (OpeningMo.jsx, the app's "mo" opening). Every outline is a
// byte-for-byte copy of a subpath of LOGO_B_LETTERS (Cabinet Grotesk Black, ITF Free Font License 2.0, unaltered), in
// word coordinates (font units, y down, baseline 0), so the parts drop into the same viewBox as the bar logo.
// Fractions (hinge, slot, eye origins, mo offsets) are of LOGO_OPEN_BOX, the word plus the dot (Logo.jsx's viewBox).

export const LOGO_WORD = ${js(WORD)};
export const LOGO_MOBI_INDEX = ${MOBI_INDEX};
/** Pen x of each letter (logo_geometry.g.dart LogoGeometry.letterX). */
export const LOGO_LETTER_X = Object.freeze(${js(LETTER_X)});

/** The drawn box: logo B and its volt dot, exactly Logo.jsx's viewBox. */
export const LOGO_OPEN_BOX = Object.freeze(${js(BOX)});
export const LOGO_OPEN_VIEWBOX = ${js(`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`)};

/** The small volt dot after the b (Logo.jsx DOT_R and DOT_GAP). */
export const LOGO_DOT = Object.freeze(${js(dot)});

/** The six letters (Mobi is index 5): outline, pen x and ink box [left, top, right, bottom]. */
export const LOGO_LETTER_PARTS = Object.freeze([
${letters.map((l) => `  Object.freeze({ char: ${js(l.char)}, index: ${l.index}, x: ${l.x}, ink: ${js(l.ink)}, d: ${js(l.d)} }),`).join('\n')}
]);

/** Mobi's ink box (the small master's body) and his eyes. The full master's right eye is an empty answer bubble
 * (ring = outer oval plus hole, even-odd); \`inked\` is its outer oval alone, which the opening scales up from its
 * centre so the bubble fills in. */
export const LOGO_MOBI_PARTS = Object.freeze({
  ink: ${js(mobiInk)},
  eyeLeftFull: ${js(eyeLeftFull.d)},
  eyeRightRing: ${js(ringOuter.d + ringHole.d)},
  eyeRightInked: ${js(ringOuter.d)},
  inkOrigin: Object.freeze([${fx((ringOuter.box[0] + ringOuter.box[2]) / 2)}, ${fy((ringOuter.box[1] + ringOuter.box[3]) / 2)}]),
  eyesOrigin: Object.freeze([${fx((eyesBox[0] + eyesBox[2]) / 2)}, ${fy((eyesBox[1] + eyesBox[3]) / 2)}]),
  visorWidth: ${r5((visorBox[2] - visorBox[0]) / BOX.w)},
});

/** The dot's centre, for its scale-in. */
export const LOGO_DOT_ORIGIN = Object.freeze([${fx(dot.cx)}, ${fy(dot.cy)}]);

/** The "mo": its ink box, its centre's offset from the box centre (fractions of the box) and its share of the width. */
export const LOGO_MO = Object.freeze(${js(mo)});

/** The unfold, nearest the "mo" first on each side: k is the order out from the "mo", hinge the edge (fraction of the
 * box) the letter opens about, slot the width (fraction of the box) it takes when open. */
export const LOGO_UNFOLD = Object.freeze([
${unfold.map((u) => `  Object.freeze(${js(u)}),`).join('\n')}
]);
`;
writeFileSync(OUT, file);
console.log(`wrote ${path.relative(ROOT, OUT)}: ${letters.length} letters from ${parts.length} subpaths, box ${BOX.w} x ${BOX.h}`);
