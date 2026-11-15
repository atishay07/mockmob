// The badge family's drawing (lane "badges", 16 Nov 2026). PURE data: no React, no DOM, so the page's SVG (BadgeStamp.jsx)
// and the share picture's canvas (badgeShare.js) draw the very same marks, and a test can hold them.
//
// Every badge is a mark pressed onto the student's desk paper, and each of the four paths has its own silhouette, so the
// paths are told apart by shape, never by colour alone:
//   papers   a sheet with a folded corner (the answer sheet on the desk)
//   repairs  a strip of mending tape with torn ends (the tape that mends the torn page in the Mistake Lab art)
//   rhythm   a calendar page with two rings (the Today calendar)
//   best     a scalloped seal (the seal pressed on a certificate)
// Inside each, the badge's own mark: a numeral for a count, or a small drawn sign (a clock for the exam-day rehearsal, an
// answer sheet's bubbles for the first full mock, two ticks for "It held", a closed week ring, three days in a row, a tick,
// four squares, three rising bars). All in one 64 x 64 box.

export const BOX = 64;

const r2 = (n) => Math.round(n * 100) / 100;

/** The seal's scalloped edge: `n` bumps whose valleys sit on radius `valley` and whose tops reach `peak`. Starts at the top, clockwise. */
export function scallopPath(cx = 32, cy = 32, n = 16, valley = 26.2, peak = 29) {
  const half = Math.PI / n;
  const chord = 2 * valley * Math.sin(half);
  const sag = peak - valley * Math.cos(half);
  const radius = (chord * chord / 4 + sag * sag) / (2 * sag);
  const at = (k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
    return [r2(cx + valley * Math.cos(a)), r2(cy + valley * Math.sin(a))];
  };
  const [x0, y0] = at(0);
  let d = `M${x0} ${y0}`;
  for (let k = 1; k <= n; k++) {
    const [x, y] = at(k);
    d += `A${r2(radius)} ${r2(radius)} 0 0 1 ${x} ${y}`;
  }
  return `${d}Z`;
}

/**
 * The four silhouettes. `outline` is the shape itself (also the line the progress runs along, clockwise from the top left);
 * `extras` are the parts drawn a shade lighter on an earned mark (the folded corner, the calendar's head and rings);
 * `rule` is the stamp's inner rule (stroked); `rotate` turns the whole mark; `glyph` is where the mark's sign sits.
 */
export const SHAPES = {
  papers: {
    outline: 'M16 5H39L51 17V56Q51 59 48 59H16Q13 59 13 56V8Q13 5 16 5Z',
    extras: ['M39 5V14Q39 17 42 17H51Z'],
    rule: 'M20 10.5H37L45.5 19V52Q45.5 53.5 44 53.5H20Q18.5 53.5 18.5 52V12Q18.5 10.5 20 10.5Z',
    rotate: 0,
    glyph: { x: 32, y: 36.5, scale: 0.92 },
  },
  repairs: {
    outline: 'M6 18H58L54 21.5L58 25L54 28.5L58 32L54 35.5L58 39L54 42.5L58 46H6L10 42.5L6 39L10 35.5L6 32L10 28.5L6 25L10 21.5Z',
    extras: [],
    rule: 'M14.5 22.5H49.5M14.5 41.5H49.5',
    rotate: -10,
    glyph: { x: 32, y: 32, scale: 0.86 },
  },
  rhythm: {
    outline: 'M16 13H48Q54 13 54 19V52Q54 58 48 58H16Q10 58 10 52V19Q10 13 16 13Z',
    extras: [
      'M16 13H48Q54 13 54 19V25H10V19Q10 13 16 13Z',
      'M24 6Q26.5 6 26.5 8.5V16.5Q26.5 19 24 19Q21.5 19 21.5 16.5V8.5Q21.5 6 24 6Z',
      'M40 6Q42.5 6 42.5 8.5V16.5Q42.5 19 40 19Q37.5 19 37.5 16.5V8.5Q37.5 6 40 6Z',
    ],
    rule: 'M14.5 29.5H49.5',
    rotate: 0,
    glyph: { x: 32, y: 42, scale: 0.88 },
  },
  best: {
    outline: scallopPath(),
    extras: [],
    rule: 'M32 11.5A20.5 20.5 0 1 1 31.99 11.5Z',
    rotate: 0,
    glyph: { x: 32, y: 32, scale: 1 },
  },
};

// The signs, drawn around (0, 0) in a box about 24 units wide. `stroke` parts are lines (round ends), `fill` parts are solid.
const GLYPHS = {
  clock: { stroke: ['M0 -9.5A9.5 9.5 0 1 1 -0.01 -9.5Z', 'M0 -5V0.5L4.5 3'] },
  bubbles: {
    fill: ['M-5 -10.2A3.2 3.2 0 1 1 -5.01 -10.2Z', 'M5 -3.2A3.2 3.2 0 1 1 4.99 -3.2Z', 'M-5 3.8A3.2 3.2 0 1 1 -5.01 3.8Z'],
    thin: ['M5 -9.6A2.6 2.6 0 1 1 4.99 -9.6Z', 'M-5 -2.6A2.6 2.6 0 1 1 -5.01 -2.6Z', 'M5 4.4A2.6 2.6 0 1 1 4.99 4.4Z'],
  },
  twoTicks: { stroke: ['M-11.5 0.5L-6.75 5.25L2.75 -4.75', 'M-1.75 5.25L8.75 -6'] },
  weekRing: { stroke: ['M0 -9.5A9.5 9.5 0 1 1 -0.01 -9.5Z', 'M-4.25 0.25L-1.25 3.25L4.5 -2.75'] },
  inARow: { stroke: ['M-9 0H9'], fill: ['M-9 -3.8A3.8 3.8 0 1 1 -9.01 -3.8Z', 'M0 -3.8A3.8 3.8 0 1 1 -0.01 -3.8Z', 'M9 -3.8A3.8 3.8 0 1 1 8.99 -3.8Z'] },
  tick: { stroke: ['M-9.5 0.5L-3 7L9.5 -6.5'] },
  fourSquares: { fill: ['M-9.5 -9.5H-1.5V-1.5H-9.5Z', 'M1.5 -9.5H9.5V-1.5H1.5Z', 'M-9.5 1.5H-1.5V9.5H-9.5Z', 'M1.5 1.5H9.5V9.5H1.5Z'] },
  rising: { fill: ['M-10.5 3H-5.5V10H-10.5Z', 'M-2.5 -3H2.5V10H-2.5Z', 'M5.5 -9.5H10.5V10H5.5Z'] },
};

/** Each badge's sign: a numeral (`text`) or a drawn sign (`glyph`). Every one of the sixteen has one. */
export const MARKS = {
  first_scored_session: { text: '1' },
  first_full_mock: { glyph: 'bubbles' },
  first_nta: { glyph: 'clock' },
  sessions_10: { text: '10' },
  full_mocks_5: { text: '5' },
  first_repair: { text: '1' },
  repairs_5: { text: '5' },
  repairs_10: { text: '10' },
  repairs_25: { text: '25' },
  first_hold: { glyph: 'twoTicks' },
  first_week_met: { glyph: 'weekRing' },
  weeks_met_4: { text: '4' },
  run_weeks_3: { glyph: 'inARow' },
  clean_set: { glyph: 'tick' },
  four_subjects: { glyph: 'fourSquares' },
  new_best: { glyph: 'rising' },
};

const PATH_OF = {
  first_scored_session: 'papers', first_full_mock: 'papers', first_nta: 'papers', sessions_10: 'papers', full_mocks_5: 'papers',
  first_repair: 'repairs', repairs_5: 'repairs', repairs_10: 'repairs', repairs_25: 'repairs', first_hold: 'repairs',
  first_week_met: 'rhythm', weeks_met_4: 'rhythm', run_weeks_3: 'rhythm',
  clean_set: 'best', four_subjects: 'best', new_best: 'best',
};

/** Numeral size in box units: one figure is larger than two. */
export const textSize = (text) => (String(text).length > 1 ? 21 : 26);

/**
 * Everything one badge's mark needs, or null for an id that is not one of the sixteen:
 * { id, path, shape: SHAPES[path], text?, glyph?: { stroke: [], fill: [], thin: [] } }.
 */
export function artFor(id) {
  const path = PATH_OF[id];
  const mark = MARKS[id];
  if (!path || !mark) return null;
  const g = mark.glyph ? GLYPHS[mark.glyph] : null;
  return {
    id, path, shape: SHAPES[path],
    ...(mark.text ? { text: mark.text } : {}),
    ...(g ? { glyph: { stroke: g.stroke || [], fill: g.fill || [], thin: g.thin || [] } } : {}),
  };
}

/** The drawn states. `unknown` (a badge the server could not read) is drawn as a blind mark, like `later`. */
export function drawnState(status) {
  return status === 'earned' ? 'earned' : status === 'next' ? 'next' : 'later';
}
