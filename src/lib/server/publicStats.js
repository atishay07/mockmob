// What /api/stats may tell a visitor (decision: docs/brain/SUBJECT-COVERAGE-2026-10-17.md).
//
// The stored daily inventory counts every question in the bank: the 15 subjects Practice offers, the thin
// subjects MockMob only stores (13 languages and others), and the four papers CUET dropped in 2025. A visitor
// must never be told that total, or a "subjects" count made from it (the old landing figure came from counting every
// subject with a stored question). The public view keeps only the subjects Practice offers:
//   subjectCounts       the public subjects only (internal ids, 'gat' for the General Test)
//   bankSize            the questions in those subjects, the bank a paper is built from
//   publicSubjectCount  how many of them hold a question today, never more than PUBLIC_SUBJECT_COUNT
// The stored row itself is untouched: refresh-inventory, quotes and the pricing page read it directly.
import { CUET_ALLOWED_SUBJECTS } from '../../../data/cuet_controls.js';
import { coveredPublicSubjects } from '../../../data/subject_claim.js';

/** The visitor-safe view of a stored inventory. An unavailable inventory passes through unchanged. */
export function publicStatsView(inventory) {
  if (!inventory || inventory.state !== 'available') return inventory;
  const allowed = new Set(CUET_ALLOWED_SUBJECTS);
  const subjectCounts = {};
  let bankSize = 0;
  for (const [id, count] of Object.entries(inventory.subjectCounts || {})) {
    if (!allowed.has(id)) continue;
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) continue;
    subjectCounts[id] = Math.trunc(n);
    bankSize += Math.trunc(n);
  }
  // chapterCounts (per subject, per chapter) feed the public subject pages on the server; the visitor API stays as it was.
  const { chapterCounts: _chapters, ...rest } = inventory;
  return {
    ...rest,
    bankSize,
    subjectCounts,
    publicSubjectCount: coveredPublicSubjects(subjectCounts, CUET_ALLOWED_SUBJECTS),
  };
}
