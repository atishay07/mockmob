// Your colleges with their real 2026 closing marks (D126, owner H9: "where is that college section now?").
// Pure rules, no I/O, so Today's strip, the Colleges card on You and a test read the same numbers.
// The number is DU's published 2026 Round 1 unreserved cutoff for that college and course (roundOneCutoff over
// public/du/2026/offerings/<id>.json), never an estimate. A college DU published no Round 1 figure for has
// `cut: null` and is never ranked or named as "needed".
import { roundOneCutoff } from '../du/compassLine.mjs';
import { formatScore } from '../du/client.js';

/** The programme files a list needs, each once, in list order. */
export function programmesOf(colleges) {
  const seen = new Set();
  for (const c of colleges || []) if (c?.programmeId && !seen.has(c.programmeId)) seen.add(c.programmeId);
  return [...seen];
}

/**
 * Each college with its cutoff: `{ ...entry, cut: { cutoff, category } | null }`. `offerings` maps a programme id to its
 * file, or to null when that file did not load (the college then has no figure, and the rest still do).
 */
export function withCutoffs(colleges, offerings) {
  return (colleges || []).map((c) => {
    const file = offerings instanceof Map ? offerings.get(c.programmeId) : offerings?.[c.programmeId];
    return { ...c, cut: file ? roundOneCutoff(file, c, 'UR') : null };
  });
}

/** The college that needed the most (the app's rule, G7): the highest cutoff; on a tie, the higher one on the list. */
export function hardestOf(rows) {
  let best = null;
  for (const r of rows || []) {
    if (!r?.cut || typeof r.cut.cutoff !== 'number') continue;
    if (!best || r.cut.cutoff > best.cut.cutoff) best = r;
  }
  return best;
}

const picked = (n) => `${n} picked`;

/**
 * Today's one-line strip. `state` is 'loading' | 'error' | 'ready'. Returns { kind, label, line, figure } where `figure`
 * is the closing mark shown large (or null), and the whole strip opens Colleges.
 *   ready, some figures:  "Your colleges, 5 picked"  /  "Shri Ram College of Commerce needed 924.3 of 1000 last year"
 *   ready, no figure:     "Your colleges, 5 picked"  /  "Open them to see the score each one needed last year"
 *   ready, none picked:   "Your colleges"            /  "Choose your colleges"  (a fresh account)
 * "Last year" is the 2026 Round 1 cutoff: the students sit CUET in 2027.
 *   error:                "Your colleges"            /  "Your list did not load. Open Colleges to see it"
 */
export function stripView({ state, rows }) {
  if (state === 'loading') return { kind: 'loading', label: 'Your colleges', line: '', figure: null };
  if (state === 'error') return { kind: 'error', label: 'Your colleges', line: 'Your list did not load. Open Colleges to see it', sub: '', figure: null };
  const list = rows || [];
  if (!list.length) return { kind: 'empty', label: 'Your colleges', line: 'Choose your colleges', sub: 'See the score each one needed last year.', figure: null };
  const top = hardestOf(list);
  const label = `Your colleges, ${picked(list.length)}`;
  if (!top) return { kind: 'ready', label, line: 'Open them to see the score each one needed last year', sub: '', figure: null };
  return {
    kind: 'ready',
    label,
    line: `${top.college} needed ${formatScore(top.cut.cutoff)} of 1000 last year`,
    sub: '',
    figure: formatScore(top.cut.cutoff),
    college: top.college,
  };
}

/** The figure beside a college on You: "924.3", or null when DU published no Round 1 cutoff for it. */
export const cutoffFigure = (row) => (row?.cut && typeof row.cut.cutoff === 'number' ? formatScore(row.cut.cutoff) : null);
