// Chapter state (KEYCARDS-BUILD-SPEC.md 2d). PURE: no I/O, no clock of its own (`now` is passed in).
// A new read for the new screens (Key cards, GET /api/me/chapters). It does not replace the weak-chapter rules of
// prepos_insights, mock_swot, review_chapters, learning_weak or the analytics route; docs/brain/intel-1031/
// CHAPTER-STATE-ADOPTION.md lists which surfaces should move to it later.
//
// Counting:
//   - each question counts once, by its latest answer (user_question_progress.last_correct), so repeats cannot inflate it
//   - a row never answered (attempt_count 0, or no right/wrong recorded) is not counted
//   - aliases are resolved first; retired chapters and unknown names are skipped
// States (labels exactly as the student sees them):
//   none    n = 0 and no cards added      Not started
//   thin    n < 6 (cards added, or some)  Too few answers
//   weak    Wilson upper < 0.55           Needs work
//   strong  Wilson lower >= 0.65          Holding
//   mid     otherwise                     Getting there
// No percent is ever returned below n = 6, and none of the copy says "mastered", "mastery" or "marks to recover".
import { wilson } from './prepos_insights.js';
import { memoryShare } from './keycards.js';

export const CHAPTER_STATE_VERSION = 1;
export const STATE_LABELS = Object.freeze({ none: 'Not started', thin: 'Too few answers', weak: 'Needs work', mid: 'Getting there', strong: 'Holding' });
export const CHAPTER_RULES = Object.freeze({ minAnswers: 6, weakHigh: 55, strongLow: 65, fadingDays: 21 });
// When the answers could not be read in full (a failed page): the state is not known, which is not "Not started".
export const UNKNOWN_STATE = Object.freeze({ state: 'unknown', label: 'Could not load', fading: false });

const DAY = 86_400_000;
const time = (v) => { const t = v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };

/**
 * Tally the student's answers per chapter key. `progress` rows: { question_id, subject, chapter, attempt_count,
 * last_correct, last_attempted_at }. `resolveChapter(subject, name)` is the syllabus resolver. Returns
 * Map(key -> { n, right, lastAt }).
 */
export function tallyChapters(progress, resolveChapter) {
  const out = new Map();
  const seen = new Set();
  // Newest first, so a question that somehow appears twice counts by its latest answer.
  const rows = [...(progress || [])].sort((a, b) => (time(b?.last_attempted_at) ?? 0) - (time(a?.last_attempted_at) ?? 0));
  for (const row of rows) {
    if (!row?.question_id || seen.has(row.question_id)) continue;
    if (!(Number(row.attempt_count) > 0) || typeof row.last_correct !== 'boolean') continue;
    const resolved = typeof row.chapter === 'string' && row.chapter.trim() ? resolveChapter(row.subject, row.chapter.trim()) : null;
    if (!resolved || resolved.retired || !resolved.key) continue;
    seen.add(row.question_id);
    const t = out.get(resolved.key) || { n: 0, right: 0, lastAt: null };
    t.n += 1;
    if (row.last_correct) t.right += 1;
    const at = time(row.last_attempted_at);
    if (at !== null && (t.lastAt === null || at > t.lastAt)) t.lastAt = at;
    out.set(resolved.key, t);
  }
  return out;
}

/**
 * One chapter's state.
 *   n, right        distinct questions answered and latest answers right
 *   memory          memoryShare() of the chapter's cards, or null
 *   lastActivityAt  the newest answer or card review in the chapter (ms), or null
 * Returns { state, label, fading }.
 */
export function stateFor({ n = 0, right = 0, memory = null, lastActivityAt = null, now }) {
  const added = memory?.added || 0;
  let state;
  if (n === 0 && added === 0) state = 'none';
  else if (n < CHAPTER_RULES.minAnswers) state = 'thin';
  else {
    const w = wilson(right, n);
    if (w.high < CHAPTER_RULES.weakHigh) state = 'weak';
    else if (w.low >= CHAPTER_RULES.strongLow) state = 'strong';
    else state = 'mid';
  }
  let fading = false;
  if (state === 'strong') {
    const quiet = lastActivityAt === null || time(now) - lastActivityAt >= CHAPTER_RULES.fadingDays * DAY;
    const slipping = added > 0 && memory.holding * 2 < added;
    fading = quiet || slipping;
  }
  return { state, label: STATE_LABELS[state], fading };
}

/** The Pro reason line: "7 of 12 right on the latest try at each question. Cards: 14 of 20 holding". Null when nothing to say. */
export function reasonLine({ n = 0, right = 0, memory = null }) {
  const parts = [];
  if (n > 0) parts.push(`${right} of ${n} right on the latest try at each question`);
  if (memory?.added > 0) parts.push(`Cards: ${memory.holding} of ${memory.added} holding`);
  return parts.length ? parts.join('. ') : null;
}

/**
 * Chapter state for every chapter of the student's units.
 *   units           syllabus unitsFor(subject, { option }): [{ unit, chapters: [{ key, title, ... }] }]
 *   progress        user_question_progress rows of the subject
 *   resolveChapter  the syllabus resolver
 *   cardStates      the student's key_card_states rows
 *   cardsByChapter  Map(chapterKey -> published cards)
 *   marksLost       Map(chapterKey -> marks lost) from data/review_chapters.mjs chapterRows (0 when absent)
 *   available       Map(chapterKey -> { questions, cards })
 *   isPro           n, right, reason and memory are returned for Pro only
 *   progressUnknown the answers could not be read in full: every state is UNKNOWN_STATE (and n, right, reason null)
 */
export function chapterStates({ units = [], progress = [], resolveChapter, cardStates = [], cardsByChapter = new Map(), marksLost = new Map(), available = new Map(), isPro = false, now, progressUnknown = false }) {
  const tally = tallyChapters(progress, resolveChapter);
  const statesByCard = new Map((cardStates || []).map((s) => [s.card_id, s]));
  return units.map((u) => ({
    unit: u.unit,
    chapters: u.chapters.map((c) => {
      const t = tally.get(c.key) || { n: 0, right: 0, lastAt: null };
      const cards = cardsByChapter.get(c.key) || [];
      const mine = cards.map((card) => statesByCard.get(card.id)).filter(Boolean);
      const memory = cards.length ? memoryShare(mine, cards, now) : { holding: 0, added: 0, mustKnow: 0 };
      const reviewedAt = mine.map((s) => time(s.last_review_at)).filter((x) => x !== null);
      const lastActivityAt = [t.lastAt, ...reviewedAt].filter((x) => x !== null).reduce((a, b) => (a === null || b > a ? b : a), null);
      const s = progressUnknown ? UNKNOWN_STATE : stateFor({ n: t.n, right: t.right, memory: mine.length ? memory : null, lastActivityAt, now });
      const row = { key: c.key, title: c.title || c.name, state: s.state, label: s.label, fading: s.fading, marksLost: marksLost.get(c.key) || 0, available: available.get(c.key) || { questions: 0, cards: cards.length } };
      if (isPro && progressUnknown) Object.assign(row, { n: null, right: null, reason: null, memory });
      else if (isPro) Object.assign(row, { n: t.n, right: t.right, reason: reasonLine({ n: t.n, right: t.right, memory }), memory });
      return row;
    }),
  }));
}
