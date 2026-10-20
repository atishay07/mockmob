// How the result, check, repair and recovery paths read `questions` rows without the signed evidence record.
// No 'server-only' import and no alias imports, so node:test can load it; the database is always passed in.
//
// Before 16 Oct 2026 these paths read `select('*')`. On the four evidence-managed subjects (Accountancy, English,
// Economics, Business Studies) every row carries a signed record of 23-69 KB (35 KB on average) plus provenance,
// about 70% of the bytes of the whole table, although the paths below only need it to learn one yes/no verdict
// in one rare case: the answer key changed since the student's session (data/answer_corrections.mjs answerReview
// reaches `evidenceEligible` only there).
//
// Now every one of these paths:
//  1. reads QUESTION_READ_SELECT: every column of public.questions except `evidence` and `provenance`, plus three
//     small json-path stubs (`ev_policy`, `ev_family`, `prov_kind`) that stand in for the parts of the record the
//     code outside the verdict reads (data/repair_check.js familyOf reads `ev_family`);
//  2. computes the result with evidenceEligible = false;
//  3. only when that result is `key_changed_unverified` (the one outcome the verdict can change) reads the full
//     row of the ids concerned and decides again with the real verdict.
// The outcome is identical to the old single full read, because answerReview returns the same value for either
// verdict in every state except that one. data/tests/egress_question_reads.test.mjs proves it over generated rows.
//
// Paths that need the verdict for EVERY row (data/db.js moderateQuestion, src/lib/server/learning.js
// validateCurrentPathway, src/services/recovery/repairCheckStore.js verifyPublished) keep reading full rows:
// the signature covers the whole record, so there is no cheaper exact way to check it.
import { PRACTICE_LIGHT_SELECT } from './practice_pick.js';
import { answerReview } from './answer_corrections.mjs';
import { excludeHeldFamilies } from './evidence_holds.js';
import { eligibilitySnapshot, publicationEligibility } from './evidence_registry.js';
import { readRowsCached } from './question_row_cache.js';

/** The one shared column list: every column except evidence and provenance, plus the json-path stubs. */
export const QUESTION_READ_SELECT = PRACTICE_LIGHT_SELECT;

// The result page's per-question review (answerReview, sameQuestionText, sameQuestionContent, correctIndexOf) reads these twelve columns of
// the current row and nothing else (egress F6, 20 Oct 2026); a strict fake in data/tests/egress_question_reads.test.mjs throws on any other.
export const ANSWER_REVIEW_COLUMNS = Object.freeze(['id', 'is_deleted', 'status', 'verification_state', 'options', 'correct_index', 'correct_answer', 'question', 'body', 'explanation', 'passage_text', 'validated_at']);
export const ANSWER_REVIEW_SELECT = ANSWER_REVIEW_COLUMNS.join(',');
// Through the stamp cache (data/question_row_cache.js): opening the same result again reads the stamp, not the rows.
export const readQuestionRows = (db, ids) => readRowsCached(db, ids, { select: ANSWER_REVIEW_SELECT, name: 'review' });
export const readQuestionRow = (db, id) => db.from('questions').select(QUESTION_READ_SELECT).eq('id', id).maybeSingle();
// The full rows come through the stamp cache (data/question_row_cache.js): a row whose updated_at has not moved is not read again.
// Verdicts are computed from the rows on every call.
export const readFullQuestionRows = (db, ids) => readRowsCached(db, ids);
// One row (the key check of one answer, a repair open) stays the plain read: a stamp query would be a second request for one row.
export const readFullQuestionRow = (db, id) => db.from('questions').select('*').eq('id', id).maybeSingle();

/** The one review state in which the evidence verdict changes the answer. */
export const needsKeyVerdict = (review) => review?.state === 'key_changed_unverified';

/**
 * Reviews for the questions of one attempt (the result page). `readRows(ids)` and `readFullRows(ids)` resolve to
 * { data, error }; `eligible(row)` is the evidence verdict of one full row. Returns the same
 * { answerReviews, answerReviewState } the old single full read returned.
 */
export async function computeAnswerReviews({ attempt, readRows, readFullRows, eligible }) {
  const snapshots = attempt.questionsSnapshot || [];
  if (!snapshots.length) return { answerReviews: {}, answerReviewState: 'ready' };
  const { data, error } = await readRows(snapshots.map(q => q.id));
  if (error) return { answerReviews: {}, answerReviewState: 'unavailable' };
  const current = new Map((data || []).map(q => [q.id, q]));
  const details = new Map((attempt.details || []).map(d => [d.qid, d]));
  const answerReviews = {};
  const wait = [];
  for (const q of snapshots) {
    const row = current.get(q.id);
    const review = answerReview(q, row, details.get(q.id), { evidenceEligible: false });
    if (needsKeyVerdict(review)) wait.push(q);
    else if (review) answerReviews[q.id] = review;
  }
  if (wait.length) {
    const full = await readFullRows([...new Set(wait.map(q => q.id))]);
    if (full.error) return { answerReviews: {}, answerReviewState: 'unavailable' };
    const fullById = new Map((full.data || []).map(q => [q.id, q]));
    for (const q of wait) {
      const row = fullById.get(q.id) ?? current.get(q.id);
      const review = answerReview(q, row, details.get(q.id), { evidenceEligible: !!row && !!eligible(row) });
      if (review) answerReviews[q.id] = review;
    }
  }
  // Same key order as before: the snapshot order.
  const ordered = {};
  for (const q of snapshots) if (answerReviews[q.id]) ordered[q.id] = answerReviews[q.id];
  return { answerReviews: ordered, answerReviewState: 'ready' };
}

/**
 * One answerReview for one question, with the verdict read only when it matters. `loadFull()` resolves to the
 * full row (or null); `eligible(row)` is the verdict. Returns { review, current } where `current` is the row the
 * review was decided on.
 */
export async function reviewWithVerdict({ snapshot, current, detail, loadFull, eligible }) {
  const first = answerReview(snapshot, current, detail, { evidenceEligible: false });
  if (!needsKeyVerdict(first) || !eligible) return { review: first, current };
  const full = (await loadFull()) ?? current;
  return { review: answerReview(snapshot, full, detail, { evidenceEligible: !!full && !!(await eligible(full)) }), current: full };
}

/**
 * The content hash of every question whose current evidence passes the publication gate, for the delayed-check
 * freshness test (src/app/api/recovery/route.js). Only the ids the caller will compare are read: a snapshot
 * without a stored content hash can never match. Returns { hashes: Map(id -> hash), unavailable }.
 */
export async function currentEvidenceHashes(db, questionIds, { chunk = 300 } = {}) {
  const hashes = new Map();
  for (let i = 0; i < questionIds.length; i += chunk) {
    const { data, error } = await readFullQuestionRows(db, questionIds.slice(i, i + chunk));
    if (error) return { hashes, unavailable: true };
    let unheld;
    try { unheld = await excludeHeldFamilies(data || [], db); } catch { return { hashes, unavailable: true }; }
    const snapshot = unheld.length ? eligibilitySnapshot() : undefined;
    for (const q of unheld) if (publicationEligibility(q, snapshot).eligible) hashes.set(q.id, q.evidence.record.content_hash);
  }
  return { hashes, unavailable: false };
}
