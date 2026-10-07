import { screeningMatches,isEvidenceManaged } from './question_factory_policy.mjs';
// Reading the pre-existing library is distinct from publishing new certified content.
// Never use this compatibility policy in a publisher or the recovery pilot.
export function legacyPracticeVisible(row) {
  if (!row || row.is_deleted || row.verification_state === 'disputed' || ['quarantined', 'invalid', 'rejected'].includes(row.status)) return false;
  if (isEvidenceManaged(row)) return false; // Evidence-managed items always use their full gate.
  // Legacy rows were readable before screening receipts existed. Preserve that
  // reading contract; an existing receipt must still match the current content.
  if (row.legacy_screening != null && !screeningMatches(row)) return false;
  return row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active');
}
