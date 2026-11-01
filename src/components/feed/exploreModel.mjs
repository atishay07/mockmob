// Pure rules of Learn v2's Explore page (R2 ruling 11, LK24, LK26; R3 X1 to X3), held by exploreModel.test.mjs. No React here.
import { resolveChapter } from '../../../data/cuet_syllabus.js';

/** How many single questions show under the covers before "More questions" (R2 ruling 11: 3, not 12). */
export const FIRST_SHOWN = 3;
/** How many more each press of "More questions" shows. */
export const MORE_STEP = 6;

export const firstShown = () => FIRST_SHOWN;
export const moreShown = (n) => Math.max(FIRST_SHOWN, Number(n) || 0) + MORE_STEP;

/**
 * The head's Saved key: "Saved 2" drawn as the word and the number; a zero or an unknown count draws the word alone (never
 * "Saved 0"). `spoken` gives its screen-reader name ("Saved questions, 2").
 */
export function savedLabel(count, { spoken = false } = {}) {
  const n = Number(count);
  const has = Number.isFinite(n) && n > 0;
  if (spoken) return has ? `Saved questions, ${n.toLocaleString('en-IN')}` : 'Saved questions';
  return has ? `Saved ${n.toLocaleString('en-IN')}` : 'Saved';
}

/**
 * A chapter as the roadmap and the covers print it ("Goodwill: Nature and Valuation", never the stored "Goodwill Valuation"):
 * the syllabus title, cleaned the way Learn cleans it ("/" becomes "and"). Null for a chapter that is not in the syllabus or is
 * retired.
 */
export function syllabusTitle(subject, name) {
  if (!subject || !name) return null;
  const hit = resolveChapter(subject, name);
  if (!hit || hit.retired || !hit.title) return null;
  return String(hit.title).replace(/\s*\/\s*/g, ' and ').replace(/\s+/g, ' ').trim();
}

/** A stem without case, punctuation or spacing, so "Define partnership." and "define  partnership" are one question (X1). */
export const normaliseStem = (body) => String(body ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The singles Explore draws (R3 X1): only questions of a chapter in the student's CUET syllabus (a retired or unknown chapter
 * such as Class 11's "Accounting Equation" is out), no two with the same stem, the first `FIRST_SHOWN` from different chapters
 * where the page allows, then the rest in the server's order. `subject` fills in for a row that carries none.
 */
export function pickSingles(questions, { subject = '' } = {}) {
  const seen = new Set();
  const eligible = [];
  for (const q of Array.isArray(questions) ? questions : []) {
    const row = q?.questions ?? q;
    if (!row) continue;
    if (!syllabusTitle(row.subject || subject, row.chapter)) continue;
    const stem = normaliseStem(row.body ?? row.question);
    if (!stem || seen.has(stem)) continue;
    seen.add(stem);
    eligible.push(q);
  }
  const chapterOf = (q) => String((q?.questions ?? q).chapter || '');
  const first = [];
  const used = new Set();
  for (const q of eligible) {
    if (first.length >= FIRST_SHOWN) break;
    if (used.has(chapterOf(q))) continue;
    used.add(chapterOf(q));
    first.push(q);
  }
  for (const q of eligible) {
    if (first.length >= FIRST_SHOWN) break;
    if (!first.includes(q)) first.push(q);
  }
  return [...first, ...eligible.filter((q) => !first.includes(q))];
}
