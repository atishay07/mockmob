export const REPAIR_OUTCOMES = ['explained', 'stored', 'held_for_recheck', 'not_explained', 'corrected_key'];
export function hasExplanation(status) { return status === 'explained' || status === 'stored'; }
export function repairRetryPolicy(httpStatus, error) {
  const resetRequest = error === 'operation_released';
  return { resetRequest, canRetry: resetRequest || error === 'in_progress' || ![401, 402, 409, 404, 422].includes(httpStatus) };
}
export function repairLabel(status) {
  if (hasExplanation(status)) return 'Explanation ready';
  if (status === 'held_for_recheck') return 'Held for review';
  if (status === 'not_explained') return 'No explanation';
  if (status === 'corrected_key') return 'Key corrected';
  return null;
}
export function repairProgress(mistakes, outcomes) {
  const explained = mistakes.filter(r => hasExplanation(outcomes[r.q.id])).length;
  const handled = new Set(mistakes.filter(r => REPAIR_OUTCOMES.includes(outcomes[r.q.id])).map(r => r.q.id));
  return { explained, held: handled.size - explained, handled, next: mistakes.find(r => !handled.has(r.q.id)) || null };
}

// Key Review: a question whose answer key our own checks could not reproduce. These errors from the
// repair route mean the same thing as a fresh dispute (the question is already being re-checked).
export const KEY_REVIEW_ERRORS = ['question_under_review'];
export function isKeyReview(status, error) { return status === 'held_for_recheck' || KEY_REVIEW_ERRORS.includes(error); }
const LETTERS = 'ABCDEFGH';
const letterOf = (i) => (Number.isInteger(i) && i >= 0 && i < LETTERS.length ? LETTERS[i] : null);
// Who said what, in plain rows. `agree` is only ever true against the key; never presented as proof.
export function keyReviewEvidence({ chosenIndex, keyIndex, dispute } = {}) {
  const rows = [
    { id: 'you', label: 'Your pick', letter: letterOf(chosenIndex) },
    { id: 'key', label: 'Answer key', letter: letterOf(keyIndex) },
  ];
  const first = letterOf(dispute?.ourIndex);
  const second = letterOf(dispute?.secondIndex);
  if (first) rows.push({ id: 'check1', label: 'Our first check', letter: first, agree: dispute.ourIndex === keyIndex });
  if (second) rows.push({ id: 'check2', label: 'Blind second check', letter: second, agree: dispute.secondIndex === keyIndex });
  return rows.filter(r => r.letter);
}
