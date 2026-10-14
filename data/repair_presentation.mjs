export const REPAIR_OUTCOMES = ['explained', 'stored', 'held_for_recheck', 'not_explained'];
export function hasExplanation(status) { return status === 'explained' || status === 'stored'; }
// Failures where trying the same repair again cannot help: this month's student-AI budget is used up, or
// PrepOS paid features are switched off. The server's message says so; the screen offers no retry button.
const NO_RETRY_ERRORS = ['budget_reached', 'paused'];
// `body` is the parsed failure body. `charged: 0` means the server released the credit and the request id,
// so the next attempt needs a fresh id (a released id only answers `operation_released`).
export function repairRetryPolicy(httpStatus, error, body = null) {
  const resetRequest = error === 'operation_released' || body?.charged === 0;
  const canRetry = !NO_RETRY_ERRORS.includes(error) && (resetRequest || error === 'in_progress' || ![401, 402, 409, 404, 422].includes(httpStatus));
  return { resetRequest, canRetry };
}
export function repairLabel(status) {
  if (hasExplanation(status)) return 'Explanation ready';
  if (status === 'held_for_recheck') return 'Held for review';
  if (status === 'not_explained') return 'No explanation';
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
