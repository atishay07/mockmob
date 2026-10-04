export const REPAIR_OUTCOMES = ['explained', 'stored', 'held_for_recheck', 'not_explained'];
export function hasExplanation(status) { return status === 'explained' || status === 'stored'; }
export function repairRetryPolicy(httpStatus, error) {
  const resetRequest = error === 'operation_released';
  return { resetRequest, canRetry: resetRequest || error === 'in_progress' || ![401, 402, 409, 404, 422].includes(httpStatus) };
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
