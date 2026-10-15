// How other students answered the same question (spec tmp/mistake-lab-v4/SPEC.md 4.3). SERVER ONLY (node:crypto).
//
// The snapshot (data/cohort/question_picks.v1.json, built by scripts/cohort/build-question-picks.mjs from read-only
// production SQL) holds aggregates only: per question, how many students answered it (each student's FIRST answer,
// any mode) and how many chose each option, keyed by a hash of the option's normalised text. No user id is in it.
// Text, not position, is the key, so a shuffled NTA paper and a stored-order paper map to the same options, and
// "right" is the option whose text is today's key text (never the stored isCorrect).
//
// cohortForAttempt applies the truth guards for one student's paper and subtracts the student's own first answer:
//   - a question with any answer review on this paper is dropped;
//   - the snapshot's key text must be this paper's key text;
//   - every counted option text must be one of this paper's options (an edited option drops the question);
//   - two options of this paper with the same normalised text drop the question.
import { createHash } from 'node:crypto';
import { normalizeOptionComparable } from './option_compare.js';
import { correctIndex } from './recovery.js';
import { LAB_RULES } from './mistake_lab.js';

export const COHORT_SNAPSHOT_VERSION = 1;

/** The raw text of one option, as stored (string, or { text | label | value }). */
export function optionRawText(option) {
  return typeof option === 'string' ? option : option?.text ?? option?.label ?? option?.value ?? String(option ?? '');
}

/** sha256 of the option's comparable text, first 16 hex characters. */
export function optionHash(text) {
  return createHash('sha256').update(normalizeOptionComparable(optionRawText(text))).digest('hex').slice(0, 16);
}

let cached;
/** The committed snapshot, read once; null when it is missing or malformed. */
export async function loadCohortSnapshot() {
  if (cached !== undefined) return cached;
  try {
    const mod = await import('./cohort/question_picks.v1.json', { with: { type: 'json' } });
    const snap = mod.default;
    cached = snap && snap.version === COHORT_SNAPSHOT_VERSION && snap.questions && typeof snap.questions === 'object' ? snap : null;
  } catch {
    cached = null;
  }
  return cached;
}

const when = (a) => Number(a?.completedAt) || 0;

/**
 * The student's own first answer to each question (earliest completed attempt with an answer, ties by id), as the
 * snapshot counted it: only attempts completed at or before `cutoffMs`. qid -> option hash.
 */
export function ownFirstAnswers(attempts, cutoffMs) {
  const sorted = [...(attempts || [])].filter((a) => a && when(a) && when(a) <= cutoffMs)
    .sort((a, b) => when(a) - when(b) || String(a.id).localeCompare(String(b.id)));
  const out = new Map();
  for (const a of sorted) {
    const snap = new Map((a.questionsSnapshot || []).map((q) => [q?.id, q]));
    for (const d of a.details || []) {
      if (!d?.qid || out.has(d.qid) || !Number.isInteger(d.givenIndex)) continue;
      const option = snap.get(d.qid)?.options?.[d.givenIndex];
      if (option === undefined || option === null) continue;
      out.set(d.qid, optionHash(option));
    }
  }
  return out;
}

/**
 * The cohort read for one paper: { since, until, coverage: { compared, total }, byQid: { [qid]: { n, right, counts,
 * keyIndex } } }, with counts in this paper's served option order. Null without a snapshot.
 */
export function cohortForAttempt({ attempt, allAttempts = [], answerReviews = {}, snapshot = null } = {}) {
  if (!snapshot || !snapshot.questions || !attempt) return null;
  const questions = Array.isArray(attempt.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const cutoff = Date.parse(snapshot.builtAt) || Infinity;
  const others = [attempt, ...(allAttempts || []).filter((a) => a && a.id !== attempt.id)];
  const own = ownFirstAnswers(others, cutoff);
  const byQid = {};
  for (const q of questions) {
    const entry = snapshot.questions[q?.id];
    if (!entry || !entry.picks || answerReviews?.[q.id]) continue;
    const options = Array.isArray(q.options) ? q.options : [];
    const hashes = options.map(optionHash);
    if (!hashes.length || new Set(hashes).size !== hashes.length) continue;
    const keyIndex = correctIndex(q);
    if (!Number.isInteger(keyIndex) || keyIndex < 0 || hashes[keyIndex] !== entry.keyHash) continue;
    const at = new Map(hashes.map((h, i) => [h, i]));
    if (Object.keys(entry.picks).some((h) => !at.has(h))) continue;
    const counts = hashes.map((h) => Math.max(0, Number(entry.picks[h]) || 0));
    let n = counts.reduce((s, c) => s + c, 0);
    const mine = own.get(q.id);
    if (mine && at.has(mine) && counts[at.get(mine)] > 0) { counts[at.get(mine)] -= 1; n -= 1; }
    if (n <= 0) continue;
    byQid[q.id] = { n, right: counts[keyIndex], counts, keyIndex };
  }
  const compared = Object.values(byQid).filter((r) => r.n >= LAB_RULES.cohortMin).length;
  return { since: snapshot.since, until: snapshot.until, coverage: { compared, total: questions.length }, byQid };
}

/** The route's reader: the snapshot, then this paper's read. Null when there is no snapshot. */
export async function readCohort({ attempt, allAttempts, answerReviews }) {
  const snapshot = await loadCohortSnapshot();
  return snapshot ? cohortForAttempt({ attempt, allAttempts, answerReviews, snapshot }) : null;
}
