// What Today needs from the record to choose Tonight's move (web IA plan 5.2). PURE: no I/O and no
// clock reads except through `now`, so it is unit-tested (data/tests/today_facts.test.mjs).
//
// learningRecord() feeds it the student's attempts (Database.getAttempts), the open session row and the
// repair reservations it already reads, and returns the result as `moveFacts` on /api/learning/plan. The
// client adds what only it knows (the clock, the wallet, the sheet's subjects) and calls nextMove() in
// data/next_step_rules.mjs. Every number here is counted from the record; nothing is guessed.
//
// Shape (the same field names as the shared fixtures in data/fixtures/next_step/*.json):
//   attempts        [{ id, subject, mode, completedAt (ISO), wrong }] newest first, at most ATTEMPT_LIMIT
//   openSession     { subject, mode, answered, total, href } | null  (only when the server knows the total)
//   unopenedResult  null (the server keeps no "result opened" record yet)
//   repair          { attemptId, subject, mode, completedAt, open } | null  (newest attempt with unrepaired mistakes)
//   weakChapter     { subject, chapter, count, href, reason, source: 'record' } | null
//   capabilities    { mistakeRepair, freshCheck }
import { practiceHref, weakChapterFromSwot } from '../../../data/next_step_rules.mjs';
import { toPublicSubjectId } from '../../../data/cuet_controls.js';
import { isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { buildRepairRecord } from './repairRecord.js';

export const ATTEMPT_LIMIT = 12;
/** An attempt older than this no longer drives tonight's repair. */
export const REPAIR_WINDOW_DAYS = 30;
/** A chapter needs this many answered questions across the record before it can be called weak. */
export const WEAK_MIN_ANSWERED = 6;
export const WEAK_MIN_WRONG = 3;
/** Only the newest attempts speak for "weak now". */
export const WEAK_ATTEMPT_WINDOW = 10;
export const WEAK_PRACTICE_COUNT = 10;
const DAY_MS = 86_400_000;

const iso = (t) => { const n = typeof t === 'number' ? t : Date.parse(t); return Number.isFinite(n) ? new Date(n).toISOString() : null; };
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const details = (attempt) => (Array.isArray(attempt?.details) ? attempt.details : []);
const wrongCount = (attempt) => details(attempt).filter((d) => d && d.isCorrect === false).length;

/** The newest attempts, slim: what the rules read. mode may be null on an older attempt. */
export function slimAttempts(attempts, limit = ATTEMPT_LIMIT) {
  return (attempts || [])
    .map((a) => ({ id: a.id, subject: toPublicSubjectId(a.subject), mode: a.mode || a.selectionMeta?.mode || null, completedAt: iso(a.completedAt), wrong: wrongCount(a) }))
    .filter((a) => a.id && a.completedAt)
    .slice(0, limit);
}

/** The reservations a repaired mistake leaves behind, as the set of "attemptId|questionId" it covers. */
export function repairedSet({ userId, reservations, attempts }) {
  const rows = buildRepairRecord({
    userId,
    reservations: reservations || [],
    attempts: (attempts || []).map((a) => ({ id: a.id, subject: a.subject, completed_at: iso(a.completedAt), details: a.details, questions_snapshot: a.questionsSnapshot })),
    limit: 1000,
  });
  return new Set(rows.map((r) => `${r.attemptId}|${r.questionId}`));
}

/**
 * The newest attempt (within REPAIR_WINDOW_DAYS) that still has mistakes nobody repaired, or null.
 * `repaired` is repairedSet(); pass null when the repair record could not be read: then nothing is
 * claimed (an unknown record is not "no mistakes" and not "all open").
 */
export function repairFacts(attempts, repaired, now = Date.now()) {
  if (!repaired) return null;
  for (const a of attempts || []) {
    const at = typeof a.completedAt === 'number' ? a.completedAt : Date.parse(a.completedAt);
    if (!Number.isFinite(at)) continue;
    if (now - at > REPAIR_WINDOW_DAYS * DAY_MS) break; // newest first: the rest are older still
    const open = details(a).filter((d) => d && d.isCorrect === false && typeof d.qid === 'string' && !repaired.has(`${a.id}|${d.qid}`)).length;
    if (open > 0) return { attemptId: a.id, subject: toPublicSubjectId(a.subject), mode: a.mode || a.selectionMeta?.mode || null, completedAt: iso(at), open };
  }
  return null;
}

/**
 * The weakest chapter on record: the one with the most wrong answers across the newest attempts, once it
 * has enough answered questions to say so. The reason always carries its denominators.
 * `swot` (Repair v3 C.2) wins when it is ready and has a plan: IA9 passes it once that work is merged.
 */
export function weakChapterFacts(attempts, { swot = null } = {}) {
  const fromSwot = weakChapterFromSwot(swot);
  if (fromSwot) return fromSwot;
  const stats = new Map();
  for (const a of (attempts || []).slice(0, WEAK_ATTEMPT_WINDOW)) {
    const byQuestion = new Map((a.questionsSnapshot || []).map((q) => [q?.id, q]));
    for (const d of details(a)) {
      if (!d || (d.isCorrect !== true && d.isCorrect !== false)) continue; // a blank is not an answer
      const chapter = byQuestion.get(d.qid)?.chapter;
      if (typeof chapter !== 'string' || !chapter) continue;
      const key = `${a.subject}\u0000${chapter}`;
      const row = stats.get(key) || { internal: a.subject, chapter, answered: 0, wrong: 0, papers: new Set() };
      row.answered += 1;
      if (d.isCorrect === false) row.wrong += 1;
      row.papers.add(a.id);
      stats.set(key, row);
    }
  }
  const best = [...stats.values()]
    .filter((r) => r.answered >= WEAK_MIN_ANSWERED && r.wrong >= WEAK_MIN_WRONG && isValidTopSyllabusPair(r.internal, r.chapter))
    .sort((x, y) => y.wrong - x.wrong || y.wrong / y.answered - x.wrong / x.answered || x.chapter.localeCompare(y.chapter))[0];
  if (!best) return null;
  const subject = toPublicSubjectId(best.internal);
  return {
    subject,
    chapter: best.chapter,
    count: WEAK_PRACTICE_COUNT,
    href: practiceHref({ subject, mode: 'quick', count: WEAK_PRACTICE_COUNT, chapter: best.chapter }),
    reason: `${best.wrong} wrong of ${best.answered} answered, across ${plural(best.papers.size, 'paper')}.`,
    source: 'record',
  };
}

/** How many questions an open session has answered: the latest answer event per question that is not blank. */
export function answeredFromEvents(events) {
  const latest = new Map();
  for (const e of Array.isArray(events) ? events : []) {
    if (e?.type !== 'answer' || typeof e.qid !== 'string') continue;
    if (e.answer === null || e.answer === undefined) latest.delete(e.qid);
    else latest.set(e.qid, e.answer);
  }
  return latest.size;
}

/** The session the server holds open for this student, or null. The total comes from the session's own request. */
export function openSessionFacts(row, href) {
  if (!row || !href) return null;
  const total = Math.trunc(Number(row.selection_meta?.requestedCount));
  if (!Number.isFinite(total) || total <= 0) return null; // no total, no "23 of 50": say nothing
  return { subject: toPublicSubjectId(row.subject), mode: row.mode || row.selection_meta?.mode || null, answered: Math.min(answeredFromEvents(row.events), total), total, href };
}

/** The whole facts object. `repaired` is repairedSet() or null when the repair record was unreadable. */
export function buildMoveFacts({ userId, attempts, activeRow = null, activeHref = null, reservations = null, mistakeRepair = true, now = Date.now(), swot = null } = {}) {
  const repaired = reservations === null ? null : repairedSet({ userId, reservations, attempts });
  return {
    attempts: slimAttempts(attempts),
    openSession: openSessionFacts(activeRow, activeHref),
    unopenedResult: null,
    repair: repairFacts(attempts, repaired, now),
    weakChapter: weakChapterFacts(attempts, { swot }),
    capabilities: { mistakeRepair: Boolean(mistakeRepair), freshCheck: false },
  };
}
