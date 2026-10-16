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
import { readFileSync } from 'node:fs';
import { normalizeOptionComparable } from './option_compare.js';
import { correctIndex } from './recovery.js';
import { LAB_RULES } from './mistake_lab.js';
import { ownContribution, timeRead } from './cohort_time.js';

export const COHORT_SNAPSHOT_VERSION = 1;

/** The raw text of one option, as stored (string, or { text | label | value }). */
export function optionRawText(option) {
  return typeof option === 'string' ? option : option?.text ?? option?.label ?? option?.value ?? String(option ?? '');
}

/**
 * The text an option is matched by: whitespace runs collapsed to one space, trimmed, lower-cased. The snapshot's SQL
 * (scripts/cohort/question_picks.sql) computes exactly this inside the database, so the export carries hashes, never
 * option text. A rarer difference (an unusual space character, an edited word) gives a different hash, and the
 * question is then dropped by the guards below: the counts are never mapped to the wrong option.
 */
export function optionKeyText(option) {
  return optionRawText(option).replace(/\s+/g, ' ').trim().toLowerCase();
}

/** sha256 of the option's key text, first 16 hex characters (the SQL export's own hash). */
export function optionHash(option) {
  return createHash('sha256').update(optionKeyText(option), 'utf8').digest('hex').slice(0, 16);
}

let cached;
/**
 * The committed snapshot, read once on first use (the same file-read pattern as data/evidence_registry.js, which the
 * result route already runs in production); null when it is missing or malformed.
 */
export async function loadCohortSnapshot() {
  if (cached !== undefined) return cached;
  try {
    const snap = JSON.parse(readFileSync(new URL('./cohort/question_picks.v1.json', import.meta.url), 'utf8'));
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
  return new Map([...ownFirstEntries(attempts, cutoffMs)].map(([qid, e]) => [qid, e.hash]));
}

/** The same, with the attempt each first answer was in: qid -> { hash, attempt }. */
export function ownFirstEntries(attempts, cutoffMs) {
  const sorted = [...(attempts || [])].filter((a) => a && when(a) && when(a) <= cutoffMs)
    .sort((a, b) => when(a) - when(b) || String(a.id).localeCompare(String(b.id)));
  const out = new Map();
  for (const a of sorted) {
    const snap = new Map((a.questionsSnapshot || []).map((q) => [q?.id, q]));
    for (const d of a.details || []) {
      if (!d?.qid || out.has(d.qid) || !Number.isInteger(d.givenIndex)) continue;
      const option = snap.get(d.qid)?.options?.[d.givenIndex];
      if (option === undefined || option === null) continue;
      out.set(d.qid, { hash: optionHash(option), attempt: a });
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
  const own = ownFirstEntries(others, cutoff);
  const byQid = {};
  for (const q of questions) {
    const entry = snapshot.questions[q?.id];
    if (!entry || !entry.picks || answerReviews?.[q.id]) continue;
    const options = Array.isArray(q.options) ? q.options : [];
    const hashes = options.map(optionHash);
    if (!hashes.length || new Set(hashes).size !== hashes.length) continue;
    // Two options that read the same once normalised (data/option_compare.js) cannot be told apart by a student.
    const comparable = options.map((o) => normalizeOptionComparable(optionRawText(o)));
    if (new Set(comparable).size !== comparable.length) continue;
    const keyIndex = correctIndex(q);
    if (!Number.isInteger(keyIndex) || keyIndex < 0 || hashes[keyIndex] !== entry.keyHash) continue;
    const at = new Map(hashes.map((h, i) => [h, i]));
    if (Object.keys(entry.picks).some((h) => !at.has(h))) continue;
    const counts = hashes.map((h) => Math.max(0, Number(entry.picks[h]) || 0));
    let n = counts.reduce((s, c) => s + c, 0);
    const mine = own.get(q.id);
    const ownCounted = !!mine && at.has(mine.hash) && counts[at.get(mine.hash)] > 0;
    if (ownCounted) { counts[at.get(mine.hash)] -= 1; n -= 1; }
    if (n <= 0) continue;
    byQid[q.id] = { n, right: counts[keyIndex], counts, keyIndex };
    // Slice 5: the nightly table also carries time, changes and strike-outs. Same student, same first answer, left out.
    if (entry.stats) {
      const time = timeRead(entry.stats, ownCounted ? ownContribution(mine.attempt, q.id, entry.keyHash) : null);
      if (time) byQid[q.id].time = time;
    }
  }
  const compared = Object.values(byQid).filter((r) => r.n >= LAB_RULES.cohortMin).length;
  return { since: snapshot.since, until: snapshot.until, coverage: { compared, total: questions.length }, byQid };
}

/** The route's reader: the snapshot, then this paper's read. Null when there is no snapshot. */
export async function readCohort({ attempt, allAttempts, answerReviews }) {
  const snapshot = await loadCohortSnapshot();
  return snapshot ? cohortForAttempt({ attempt, allAttempts, answerReviews, snapshot }) : null;
}
