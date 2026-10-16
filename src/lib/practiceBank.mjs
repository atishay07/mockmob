// Server-side only (the pricing page): the bank count a sentence may quote. Kept apart from paperCopy.mjs so the
// subject registry never enters the client bundles that import the copy.
import { resolveSubject } from '../../data/subject_registry.js';
import { toPublicSubjectId } from '../../data/cuet_controls.js';

/**
 * The questions a student can actually practise from: the stored per-subject counts, summed over the subjects Practice
 * offers (registry practice 'supported'). The stored bankSize also counts subjects Practice does not offer or has retired
 * (on 15 Oct 2026: 5,941 of 8,197), so a sentence about "the bank" a paper is built from must not quote that total.
 * Returns null when the counts are not known.
 */
export function practiceBankSize(inventory) {
  if (!inventory || inventory.state !== 'available' || !inventory.subjectCounts) return null;
  let total = 0;
  for (const [stored, count] of Object.entries(inventory.subjectCounts)) {
    const registry = resolveSubject(toPublicSubjectId(stored));
    if (registry.renamedFrom || registry.practice !== 'supported') continue;
    const n = Number(count);
    if (Number.isFinite(n) && n > 0) total += Math.trunc(n);
  }
  return total > 0 ? total : null;
}
