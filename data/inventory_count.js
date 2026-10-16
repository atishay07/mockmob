// The daily public inventory count (src/lib/server/inventory.js), split out so node:test can load it.
// No 'server-only' import and no alias imports: the database is passed in.
//
// Before 16 Oct 2026 the count read every non-deleted question with every column (`select('*')`,
// 43.9 MB of JSON on production). Two exact reductions, neither of which can change a count:
//  1. Only the columns the count reads. Every one of the 22 below is read by readablePracticeQuestions,
//     publicationEligibility (evaluateEvidence, presentationLint, provenanceReasons), the answer-integrity
//     check, legacyPracticeVisible (screeningMatches) and excludeHeldFamilies. The other 32 columns
//     (quality and exposure counters, timestamps, vote counts, tags, hashes ...) are read by none of them.
//     data/tests/inventory_count.test.mjs runs the count on rows that THROW when an unlisted column is read.
//  2. Only the rows that can be counted. A row that is neither `live` nor verified-and-active is dropped
//     by the count's own `visible` filter, so the database drops it first (same predicate).
// The signed evidence record (about 23.5 MB for the 666 evidence-managed rows) is still read for every row
// that carries one: its signature covers the whole record, so the count cannot be proved without it.
// Counting in SQL was considered and rejected: the answer-integrity check (regex claims, option
// similarity, NFKC comparisons) and the signature check (an HMAC with a key that lives only in the
// server environment) cannot be reproduced exactly in Postgres.
import { readablePracticeQuestions } from './practice_library.js';
import { eligibilitySnapshot, publicationEligibility } from './evidence_registry.js';

export const INVENTORY_COLUMNS = Object.freeze([
  'id', 'subject', 'chapter', 'concept', 'concept_id', 'question', 'body', 'options', 'correct_index', 'correct_answer',
  'explanation', 'passage_text', 'family_id', 'question_type', 'status', 'verification_state', 'exploration_state',
  'score', 'is_deleted', 'legacy_screening', 'evidence', 'provenance',
]);
export const INVENTORY_SELECT = INVENTORY_COLUMNS.join(',');
// The same predicate as `visible` below and as data/db.js VISIBLE_QUESTION_FILTER.
export const INVENTORY_VISIBLE_FILTER = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';
const PAGE = 1000;

export const isInventoryVisible = (q) => q.status === 'live' || (q.verification_state === 'verified' && q.exploration_state === 'active');

/** Every counted-candidate row, narrow columns, paged by id. Throws INVENTORY_UNAVAILABLE on any read error. */
export async function readInventoryRows(db) {
  const rows = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await db.from('questions').select(INVENTORY_SELECT).eq('is_deleted', false).or(INVENTORY_VISIBLE_FILTER)
      .order('id').range(start, start + PAGE - 1);
    if (error) throw new Error('INVENTORY_UNAVAILABLE');
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** The public aggregates from the rows. `now` is only for the timestamp. */
export async function countInventory(rows, db, { now = () => new Date() } = {}) {
  const visible = rows.filter(isInventoryVisible);
  const eligible = await readablePracticeQuestions(visible, db, { requireEvidence: false });
  const subjectCounts = {}, recoverySubjectCounts = {};
  const snapshot = eligible.length ? eligibilitySnapshot() : undefined;
  for (const q of eligible) {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    if (publicationEligibility(q, snapshot).eligible) recoverySubjectCounts[q.subject] = (recoverySubjectCounts[q.subject] || 0) + 1;
  }
  return { state: 'available', bankSize: eligible.length, subjectCounts, recoverySubjectCounts, recoveryEligible: Object.values(recoverySubjectCounts).reduce((a,b)=>a+b,0), checkedAt: now().toISOString(), note: 'Ordinary library counts use the same publication and family-hold policies as practice. A count does not establish a complete mock blueprint or recovery pathway.' };
}
