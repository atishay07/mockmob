// The attempt ledger: per-chapter counts for one paper and for the student's record in its subject.
// PURE (no I/O). Shared by the post-mock SWOT (data/mock_swot.js) and the "From your record" lines
// (data/mistake_insights.js), so the same chapter shows the same numbers everywhere.
//
// Definitions (spec tmp/repair-v3/SPEC.md B.2):
//   P (this paper), per chapter, after held questions are left out: n, right, wrong, blank,
//     answered = right + wrong, lost = 6 * wrong + 5 * blank (GAP), qs = 1-based numbers wrong or blank.
//   L (the record): this attempt plus the newest 59 earlier attempts in the same subject that were
//     scored on the server, completed at or before this one, in any mode, and are not a retake of
//     this paper. Per chapter: right, answered, papers (attempts with at least 1 answered question).
//   E (earlier only): L without this attempt.
// Earlier attempts count their stored answers as stored; only this paper leaves out held questions.
import { GAP } from './session_recovery.js';
import { attemptScoring } from './attempt_scoring.js';
import { correctIndex } from './recovery.js';
import { isRetake, timingReliable } from '../src/lib/server/recap.js';
import { dwellByQuestion } from './prepos_insights.js';

export const UNMAPPED_CHAPTER = 'Unmapped chapter';
export const RECORD_ATTEMPTS = 60; // this attempt plus 59 earlier
export const MOCK_MODES = Object.freeze(['full', 'nta']);
// Answer-review states whose questions are left out of every count of this paper.
export const EXCLUDED_REVIEW_STATES = Object.freeze(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']);
const EXCLUDED = new Set(EXCLUDED_REVIEW_STATES);

export const when = (a) => Number(a?.completedAt) || 0;
export const modeOf = (a) => a?.selectionMeta?.mode || a?.mode || null;
export const isMock = (a) => MOCK_MODES.includes(modeOf(a));

export function chapterOf(q) {
  const v = q?.chapter;
  const text = v == null ? '' : typeof v === 'object' ? (v.text ?? v.label ?? v.name ?? '') : String(v);
  return text.trim() || UNMAPPED_CHAPTER;
}

const outcomeOf = (d) => (d?.isCorrect === true ? 'right' : d?.isCorrect === false ? 'wrong' : 'blank');

/** The questions of this paper left out of every count: held, withdrawn or corrected keys. */
export function excludedQuestions(answerReviews) {
  const out = new Set();
  for (const [qid, review] of Object.entries(answerReviews || {})) if (review && EXCLUDED.has(review.state)) out.add(qid);
  return out;
}

/** One row per snapshot question, in served order, with its outcome and 1-based number. */
export function paperRows(attempt, excluded = new Set()) {
  const details = new Map((attempt?.details || []).map((d) => [d.qid, d]));
  return (attempt?.questionsSnapshot || []).map((q, index) => {
    const d = details.get(q.id) || null;
    const key = correctIndex(q);
    return {
      qid: q.id, number: index + 1, chapter: chapterOf(q), outcome: outcomeOf(d),
      givenIndex: Number.isInteger(d?.givenIndex) ? d.givenIndex : null,
      keyIndex: Number.isInteger(key) && key >= 0 ? key : null,
      options: Array.isArray(q.options) ? q.options.length : 0,
      excluded: excluded.has(q.id),
    };
  });
}

const emptyPaperChapter = (chapter) => ({ chapter, n: 0, right: 0, wrong: 0, blank: 0, answered: 0, lost: 0, qs: [] });

/** Per-chapter counts of one attempt's own stored answers (rows already filtered). */
export function chapterCounts(rows) {
  const out = new Map();
  for (const r of rows) {
    const c = out.get(r.chapter) || emptyPaperChapter(r.chapter);
    c.n++;
    if (r.outcome === 'right') c.right++;
    else if (r.outcome === 'wrong') { c.wrong++; c.lost += GAP.wrong; c.qs.push(r.number); }
    else { c.blank++; c.lost += GAP.blank; c.qs.push(r.number); }
    c.answered = c.right + c.wrong;
    out.set(r.chapter, c);
  }
  return out;
}

/** Earlier attempts that join this one in the record (newest first, at most 59). */
export function recordAttempts(attempt, allAttempts) {
  const cur = when(attempt);
  return (allAttempts || [])
    .filter((x) => x && x.id !== attempt.id && x.subject === attempt.subject && attemptScoring(x) === 'server'
      && when(x) <= cur && !isRetake(attempt, x))
    .sort((a, b) => when(b) - when(a) || String(b.id).localeCompare(String(a.id)))
    .slice(0, RECORD_ATTEMPTS - 1);
}

function addRecord(map, counts) {
  for (const c of counts.values()) {
    if (!c.answered) continue;
    const r = map.get(c.chapter) || { right: 0, answered: 0, papers: 0 };
    r.right += c.right;
    r.answered += c.answered;
    r.papers += 1;
    map.set(c.chapter, r);
  }
}

/**
 * The ledger for one attempt. `answerReviews` (the route's answer checks) leaves held questions out
 * of this paper's counts. Every number is a count of stored answers.
 */
export function buildLedger(attempt, allAttempts, { answerReviews = {} } = {}) {
  const excluded = excludedQuestions(answerReviews);
  const rows = paperRows(attempt, excluded);
  const counted = rows.filter((r) => !r.excluded);
  const paper = chapterCounts(counted);
  const totals = { n: counted.length, right: 0, wrong: 0, blank: 0, answered: 0, lost: 0 };
  for (const c of paper.values()) {
    totals.right += c.right; totals.wrong += c.wrong; totals.blank += c.blank; totals.lost += c.lost;
  }
  totals.answered = totals.right + totals.wrong;

  const earlierAttempts = recordAttempts(attempt, allAttempts);
  const earlier = new Map();
  let earlierPapers = 0;
  let earlierAnswers = 0;
  for (const x of earlierAttempts) {
    const counts = chapterCounts(paperRows(x));
    let answered = 0;
    for (const c of counts.values()) answered += c.answered;
    if (answered) { earlierPapers++; earlierAnswers += answered; }
    addRecord(earlier, counts);
  }
  const record = new Map([...earlier].map(([k, v]) => [k, { ...v }]));
  addRecord(record, paper);

  return {
    attemptId: attempt?.id ?? null,
    subject: attempt?.subject ?? null,
    rows,
    excluded,
    total: rows.length,
    counted: counted.length,
    held: rows.length - counted.length,
    paper,
    totals,
    record,
    earlier,
    earlierAttempts,
    earlierPapers,
    earlierAnswers,
  };
}

export const recordFor = (ledger, chapter) => ledger?.record.get(chapter) || { right: 0, answered: 0, papers: 0 };
export const earlierFor = (ledger, chapter) => ledger?.earlier.get(chapter) || { right: 0, answered: 0, papers: 0 };
export const paperFor = (ledger, chapter) => ledger?.paper.get(chapter) || emptyPaperChapter(chapter);

/**
 * Comparable mocks for repeated losses: Full or NTA, same subject, scored on the server, completed
 * at or before this one, newest first with this attempt included, retakes of this paper skipped.
 */
export function comparableMocks(attempt, allAttempts, limit = 3) {
  if (!attempt || !isMock(attempt) || attemptScoring(attempt) !== 'server') return [];
  const cur = when(attempt);
  const earlier = (allAttempts || [])
    .filter((x) => x && x.id !== attempt.id && x.subject === attempt.subject && isMock(x) && attemptScoring(x) === 'server'
      && when(x) <= cur && !isRetake(attempt, x))
    .sort((a, b) => when(b) - when(a) || String(b.id).localeCompare(String(a.id)));
  return [attempt, ...earlier].slice(0, Math.max(0, limit));
}

// ---------- Timing, answer changes and dates, shared by the SWOT and the record lines ----------

// A question needs at least this much recorded time to count as timed (a shorter dwell is a pass-through).
export const MIN_TIMED_MS = 2000;

/** Dwell per question (prepos dwellByQuestion: gaps over 30 minutes skipped), only when timing is reliable. */
export function paperDwell(attempt) {
  if (!timingReliable(attempt)) return null;
  return dwellByQuestion(attempt);
}

/** Device telemetry is usable for unopened questions and answer changes: self reported, 10 or more events, half the questions seen. */
export function telemetryRecorded(attempt) {
  const rec = attempt?.selectionMeta?.recovery;
  if (rec?.telemetry !== 'self_reported' || !Array.isArray(rec.timeline) || rec.timeline.length < 10) return false;
  const ids = (attempt?.questionsSnapshot || []).map((q) => q?.id).filter(Boolean);
  if (!ids.length) return false;
  const seen = openedQuestions(attempt);
  return ids.filter((id) => seen.has(id)).length * 2 >= ids.length;
}

export function openedQuestions(attempt) {
  const timeline = attempt?.selectionMeta?.recovery?.timeline;
  return new Set((Array.isArray(timeline) ? timeline : []).filter((e) => e && e.qid).map((e) => e.qid));
}

/** Answer changes per question, oldest first. Empty unless the device record matched the submitted answers. */
export function answerChangesByQuestion(attempt) {
  const rec = attempt?.selectionMeta?.recovery;
  const out = new Map();
  if (rec?.telemetry !== 'self_reported') return out;
  const list = Array.isArray(rec.observed?.answerChanges) ? rec.observed.answerChanges : [];
  for (const c of [...list].filter((c) => c && c.qid).sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))) {
    const arr = out.get(c.qid) || [];
    arr.push(c);
    out.set(c.qid, arr);
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MS = 330 * 60 * 1000;
/** "9 Oct", in India time. */
export function istDayMonth(ms) {
  const d = new Date(Number(ms) + IST_OFFSET_MS);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "41s" under a minute, otherwise "2m 05s". */
export function formatSeconds(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Q47, Q48, Q49 and Q50"; after 5 entries "Q3, Q8, Q12, Q20, Q33 and 4 more". */
export function questionList(numbers) {
  const qs = (numbers || []).map((n) => `Q${n}`);
  if (qs.length <= 1) return qs.join('');
  if (qs.length <= 5) return `${qs.slice(0, -1).join(', ')} and ${qs[qs.length - 1]}`;
  return `${qs.slice(0, 5).join(', ')} and ${qs.length - 5} more`;
}
