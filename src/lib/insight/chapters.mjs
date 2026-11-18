// Your chapters (Marks trend, lane insight 18 Nov 2026): every chapter of the student's subjects in book order, each with
// the state Learn and Key cards print. PURE: the caller reads the rows; this file only counts them.
//
// Where each figure comes from (nothing else feeds the map):
//   state, right of answered, last practised   user_question_progress (question_id, subject, chapter, attempt_count,
//                                              last_correct, last_attempted_at), counted by data/chapter_state.js:
//                                              each question once, by its latest answer; retired and unknown chapters
//                                              skipped; under CHAPTER_RULES.minAnswers answers is "Too few answers" and
//                                              no state ever carries a percentage
//   marks lost, papers                         the open attempts (details and questions_snapshot): 6 for a wrong answer
//                                              (5 not earned and the 1 penalty), 5 for a blank, from CUET's marking
//   the chapters, their order and names        data/cuet_syllabus.js unitsFor(subject, { option })
// Questions of a Mob paper still held for its Mob are left out of every count (their right and wrong stay hidden).
// Card reviews are not counted: a chapter with Key cards and no answer is "Not tried" here.
import { stateFor, tallyChapters } from '../../../data/chapter_state.js';
import { LOST, MAP_LABELS, STATE_ORDER } from './words.mjs';

const isWrong = (d) => d?.isCorrect === false && Number.isInteger(d?.givenIndex);

/**
 * Marks lost per chapter key across the papers: Map(key -> { lost, wrong, blank, papers }). A wrong answer is a pick that
 * was marked wrong (Review's rule, src/lib/server/review.js); anything else not right is a blank.
 */
export function chapterLosses(papers = [], resolveChapter) {
  const out = new Map();
  for (const a of papers || []) {
    const details = new Map((Array.isArray(a?.details) ? a.details : []).filter((d) => d && typeof d.qid === 'string').map((d) => [d.qid, d]));
    const asked = new Set();
    for (const q of Array.isArray(a?.questionsSnapshot) ? a.questionsSnapshot : []) {
      if (!q || typeof q.id !== 'string' || typeof q.chapter !== 'string' || !q.chapter.trim()) continue;
      const resolved = resolveChapter(a.subject, q.chapter.trim());
      if (!resolved || resolved.retired || !resolved.key) continue;
      const row = out.get(resolved.key) || { lost: 0, wrong: 0, blank: 0, papers: 0 };
      if (!asked.has(resolved.key)) { asked.add(resolved.key); row.papers += 1; }
      const d = details.get(q.id);
      if (d?.isCorrect !== true) {
        if (isWrong(d)) { row.wrong += 1; row.lost += LOST.wrong; } else { row.blank += 1; row.lost += LOST.blank; }
      }
      out.set(resolved.key, row);
    }
  }
  return out;
}

/** The counts of one subject's chapters by state. */
export function stateCounts(chapters = []) {
  const counts = Object.fromEntries(STATE_ORDER.map((s) => [s, 0]));
  for (const c of chapters) if (c.state in counts) counts[c.state] += 1;
  return counts;
}

/**
 * The map. Returns { state: 'ready', subjects: [{ id, name, total, tried, counts, chapters }] } or { state: 'error' } when
 * the answers could not be read in full (a state from part of them would be wrong, so none is shown).
 *   subjects        the subject ids to draw, in the student's order
 *   unitsFor        (subject, { option }) -> [{ unit, chapters: [{ key, name, title }] }] (the syllabus)
 *   resolveChapter  (subject, name) -> { key, retired } | null (the syllabus resolver)
 *   optionOf        (subject) -> the saved option or null (no option: every chapter)
 *   nameOf          (subject) -> the subject's name
 *   progress        user_question_progress rows (answered ones)
 *   heldQids        question ids of Mob papers still held
 *   papers          the open attempts (held papers already left out)
 * Each chapter: { key, name, title, unit, state, label, n, right, lastAt, lost, papers }. `name` is the name its questions
 * carry (Practice's chapter filter takes it), `title` the book's.
 */
export function buildChapters({ subjects = [], unitsFor, resolveChapter, optionOf = () => null, nameOf = (id) => id, progress = [], heldQids = new Set(), papers = [], now = Date.now(), incomplete = false } = {}) {
  if (incomplete) return { state: 'error' };
  const rows = (progress || []).filter((r) => r && !heldQids.has(r.question_id));
  const tally = tallyChapters(rows, resolveChapter);
  const losses = chapterLosses(papers, resolveChapter);
  const out = [];
  for (const id of subjects) {
    const units = unitsFor(id, { option: optionOf(id) || null }) || [];
    const chapters = units.flatMap((u) => (u.chapters || []).map((c) => {
      const t = tally.get(c.key) || { n: 0, right: 0, lastAt: null };
      // Answers only (no card memory): "Not tried" means no question of it answered, and fading is not said here.
      const { state } = stateFor({ n: t.n, right: t.right, memory: null, lastActivityAt: t.lastAt, now });
      const loss = losses.get(c.key) || null;
      return {
        key: c.key, name: c.name || c.title, title: c.title || c.name, unit: u.unit || null,
        state, label: MAP_LABELS[state], n: t.n, right: t.right, lastAt: t.lastAt,
        lost: loss ? loss.lost : 0, papers: loss ? loss.papers : 0,
      };
    }));
    if (!chapters.length) continue;
    out.push({ id, name: nameOf(id), total: chapters.length, tried: chapters.filter((c) => c.n > 0).length, counts: stateCounts(chapters), chapters });
  }
  return { state: 'ready', subjects: out };
}
