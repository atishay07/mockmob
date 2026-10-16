// Mistake Repair: why a repair did not happen, in plain words for the student. Pure logic, no I/O.
//
// Every message says what happened to the credit. The server sorts a failed model call into a kind
// (src/services/ai/providerCore.js) and this file turns the kind into one HTTP status, one error code the app and
// the website can branch on, and one sentence. Codes the app already understood are unchanged
// (unusable_output, paused, in_progress, operation_released, could_not_start, ...). New ones sit beside them:
//   provider_timeout       504  the repair ran out of time
//   provider_unavailable   503  the model service is out of quota, rate limited, down or refusing the request
//   budget_reached         503  this month's student-AI budget is used up (shared with PrepOS replies)
//   user_limit_reached     429  this student's own monthly AI limit (a few rupees) is used up; resets on the 1st (IST)
//   wallet_unavailable     503  the credit wallet could not be reached, nothing was reserved

/** "1 November": the first day of the next calendar month in India (the monthly AI budget resets on the IST month). */
export function nextMonthStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value); // 1-12, so as a 0-based index it is already next month
  const next = new Date(Date.UTC(year, month, 1));
  return `1 ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' }).format(next)}`;
}

export const REPAIR_FAILURE_CODES = Object.freeze(['provider_timeout', 'provider_unavailable', 'budget_reached', 'user_limit_reached', 'wallet_unavailable', 'paused', 'unusable_output']);

/** The honest line for a student whose own monthly AI limit is used up. Shared by Mistake Repair and Ask Mobi. */
export function userLimitMessage(now = new Date()) {
  return `You’ve reached this month’s AI limit. It resets on ${nextMonthStart(now)}.`;
}

// Kinds that all mean "the model service could not do it right now".
const SERVICE_DOWN = new Set(['quota', 'rate_limit', 'server', 'network', 'auth', 'bad_request', 'price', 'provider_unavailable', 'model_not_allowed']);

/**
 * The failure to show for a failed model call. `kind` comes from providerCore ('timeout', 'quota', ...). The message
 * has no credit sentence yet: composeFailureMessage adds the one that is true.
 */
export function repairFailureForKind(kind, { now = new Date() } = {}) {
  if (kind === 'timeout') return { error: 'provider_timeout', http: 504, message: 'This one took too long.' };
  if (SERVICE_DOWN.has(kind)) return { error: 'provider_unavailable', http: 503, message: 'Repairs aren’t available right now. Try again in a little while.' };
  if (kind === 'user_budget') return { error: 'user_limit_reached', http: 429, message: userLimitMessage(now) };
  if (kind === 'budget') return { error: 'budget_reached', http: 503, message: `Repairs are paused until ${nextMonthStart(now)}.` };
  if (kind === 'guard_paused') return { error: 'paused', http: 503, message: 'PrepOS paid features are temporarily unavailable.' };
  return { error: 'unusable_output', http: 502, message: 'The repair could not be prepared reliably this time.' };
}

/** The credit sentence is only "not charged" once the release has actually happened. */
export function composeFailureMessage(message, restored) {
  return restored ? `${message} You were not charged.` : `${message} Your credit is held briefly and returns automatically.`;
}

export const WALLET_UNAVAILABLE = Object.freeze({ error: 'wallet_unavailable', http: 503, message: 'We couldn’t reach your credits. Nothing was charged. Try again.' });
