// Reading the pre-existing library is distinct from publishing new certified content.
// Never use this compatibility policy in a publisher or the recovery pilot.
export function legacyPracticeVisible(row) {
  if (!row || row.is_deleted || row.verification_state === 'disputed' || ['quarantined', 'invalid', 'rejected'].includes(row.status)) return false;
  if (row.evidence) return false; // Evidence-managed items always use their full gate.
  return row.status === 'live' || (row.verification_state === 'verified' && row.exploration_state === 'active');
}
