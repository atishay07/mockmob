// Result recap: tone, comparable previous attempt, format id and timing reliability. PURE (no I/O).
//
// formatId is the shared B4 formula from attemptSummary.js, so the recap, the attempts summary and
// /api/me/bests agree. Attempts scored on the device (no server scoringVersion) or with no recorded
// mode have a formatId but are not comparable (isComparable) and never feed recap or bests.
//
// Detectable vs not for "first unassisted exposure":
//  - Detectable: a retake of a paper, as question-id overlap with an earlier attempt in the same format
//    (RETAKE_OVERLAP_RATIO of the current questions or more).
//  - Not detectable: a student seeing the same questions in a different format (quick practice, repair,
//    study cards, bookmarks, the answer shown elsewhere); the same question appearing by chance in
//    adjacent mocks below the overlap ratio; an attempt where the student was helped outside the app.
import { MARKS } from '../../../data/session_recovery.js';
import { formatIdFor as sharedFormatId } from './attemptSummary.js';

export const RECAP_TONE_DELTA_RATIO = 0.10;
export const RETAKE_OVERLAP_RATIO = 0.8;
export const MOCK_MODES = Object.freeze(['full', 'nta']);
const HELD_STATES = new Set(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified']);
const SCORING_VERSIONS = new Set(['server_practice_v1', 'server_snapshot_v1']);

export function attemptMarks(a) {
  const total = Number.isFinite(a?.total) ? a.total : (a?.questionsSnapshot || []).length;
  const correct = Number.isFinite(a?.correct) ? a.correct : 0;
  const wrong = Number.isFinite(a?.wrong) ? a.wrong : 0;
  return { marks: correct * MARKS.right + wrong * MARKS.wrong, max: total * MARKS.right };
}

export function attemptMode(a) {
  const m = a?.selectionMeta?.mode;
  return typeof m === 'string' && m ? m : null;
}

export function isComparable(a) {
  return !!a?.subject && !!attemptMode(a) && SCORING_VERSIONS.has(a?.selectionMeta?.scoringVersion) && attemptMarks(a).max > 0;
}

// null when the attempt cannot be compared (device scoring or unknown mode).
export function formatIdFor(a) {
  return isComparable(a) ? sharedFormatId(a) : null;
}

const idsOf = (a) => new Set((a?.questionsSnapshot || []).map(q => q?.id).filter(Boolean));
const when = (a) => Number(a?.completedAt) || 0;
const isEarlier = (x, cur) => when(x) < when(cur) || (when(x) === when(cur) && String(x.id) < String(cur.id));

export function isRetake(a, earlier) {
  const mine = idsOf(a);
  if (!mine.size) return false;
  const prev = idsOf(earlier);
  let shared = 0;
  for (const id of mine) if (prev.has(id)) shared++;
  return shared / mine.size >= RETAKE_OVERLAP_RATIO;
}

// Most recent earlier attempt in the same format whose questions are not a repeat of this one.
export function findPreviousComparable(current, all) {
  const fid = formatIdFor(current);
  if (!fid) return null;
  const pool = (all || [])
    .filter(x => x && x.id !== current.id && formatIdFor(x) === fid && isEarlier(x, current) && !isRetake(current, x))
    .sort((a, b) => when(b) - when(a) || String(b.id).localeCompare(String(a.id)));
  const prev = pool[0];
  return prev ? { ...attemptMarks(prev), attemptId: prev.id } : null;
}

export function isFirstMockInSubject(current, all) {
  if (!MOCK_MODES.includes(attemptMode(current))) return false;
  return !(all || []).some(x => x && x.id !== current.id && x.subject === current.subject
    && MOCK_MODES.includes(attemptMode(x)) && isEarlier(x, current));
}

export function isHeld(answerReviews) {
  return Object.values(answerReviews || {}).some(r => r && HELD_STATES.has(r.state));
}

// Reliable only when the device telemetry was consistent and every question has a visit event.
export function timingReliable(a) {
  const rec = a?.selectionMeta?.recovery;
  if (rec?.telemetry !== 'self_reported' || !Array.isArray(rec.timeline)) return false;
  const seen = new Set(rec.timeline.filter(e => e && e.qid && Number.isFinite(e.at)).map(e => e.qid));
  const ids = idsOf(a);
  if (!ids.size || rec.timeline.length < 2) return false;
  for (const id of ids) if (!seen.has(id)) return false;
  return true;
}

export function toneFor({ held, firstMock, current, previousComparable }) {
  if (held) return 'held';
  if (firstMock) return 'first_mock';
  if (previousComparable) {
    const diff = current.marks - previousComparable.marks;
    if (Math.abs(diff) >= RECAP_TONE_DELTA_RATIO * current.max && current.max > 0) return diff > 0 ? 'higher' : 'lower';
  }
  return 'default';
}

// answerReviewState is 'ready' or 'unavailable' (the key checks could not load). Anything other than
// 'ready' is held: celebratory copy must not show on a result whose answers might be withdrawn or changed.
export function buildRecap(attempt, allAttempts, answerReviews, answerReviewState = 'ready') {
  const previousComparable = findPreviousComparable(attempt, allAttempts);
  const cur = attemptMarks(attempt);
  return {
    tone: toneFor({ held: answerReviewState !== 'ready' || isHeld(answerReviews),firstMock: isFirstMockInSubject(attempt, allAttempts), current: cur, previousComparable }),
    previousComparable,
    timingReliable: timingReliable(attempt),
    formatId: formatIdFor(attempt),
  };
}

// Per formatId best and latest, counting first-exposure attempts only (a retake of an earlier paper
// in the same format never counts).
export function computeBests(all) {
  const byFormat = new Map();
  const sorted = [...(all || [])].filter(Boolean).sort((a, b) => when(a) - when(b) || String(a.id).localeCompare(String(b.id)));
  const kept = new Map();
  for (const a of sorted) {
    const fid = formatIdFor(a);
    if (!fid) continue;
    const list = kept.get(fid) || [];
    if (list.some(x => isRetake(a, x))) continue;
    list.push(a);
    kept.set(fid, list);
  }
  for (const [fid, list] of kept) {
    const pick = (a) => ({ ...attemptMarks(a), attemptId: a.id, completedAt: when(a) });
    let best = list[0];
    for (const a of list) if (attemptMarks(a).marks > attemptMarks(best).marks) best = a;
    const latest = list[list.length - 1];
    byFormat.set(fid, { formatId: fid, subject: list[0].subject, mode: attemptMode(list[0]), attempts: list.length, best: pick(best), latest: pick(latest) });
  }
  return [...byFormat.values()].sort((a, b) => b.latest.completedAt - a.latest.completedAt);
}
