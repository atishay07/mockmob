// What starting a practice session costs: a credit action and a daily allowance kind, or neither. PURE, so the rule is
// tested in data/tests/mob.test.mjs without a database (src/lib/server/practiceSessions.js calls it on both start paths).
//
// A Mob paper (SOCIAL-SPEC section 15) is free of credits for every member: no credit action and no daily
// allowance. Who may start one (a free student gets one weekly Mob paper a week, Pro has no such limit) is decided by
// the Mob service before this is ever asked, and `mobPaper` can only come from the server, never from a request body.
const FREE_SAMPLE_SUBJECTS = ['english', 'accountancy', 'economics', 'business_studies'];

/** { creditAction: string | null, quota: string | null } */
export function practiceCharge({ isPremium = false, mobPaper = null, modeId, creditAction = null, count, purpose = null, subject }) {
  if (mobPaper) return { creditAction: null, quota: null };
  if (isPremium) return { creditAction: null, quota: null };
  let quota = null;
  if (modeId === 'quick' && count === 10) quota = 'daily_practice';
  if (purpose === 'baseline' && modeId === 'quick' && count === 5 && FREE_SAMPLE_SUBJECTS.includes(subject)) quota = `baseline:${subject}`;
  if (purpose === 'full_sample' && modeId === 'full' && FREE_SAMPLE_SUBJECTS.includes(subject)) quota = `full_sample:${subject}`;
  return { creditAction: creditAction || null, quota };
}

// Before release 9 every Quick set was charged under the flat action 'attempt' (10 credits). A device-held start that was
// paid on the old code and is restarted after the deploy (same generationKey, so the same `practice_<id>` reference) would send
// 'attempt_N' for that reference; spend_credits finds the older row, sees a different action and raises "credit reference
// already used for a different transaction", so a student who already paid could not resume. The fallback asks again with the
// legacy action ONLY after that exact refusal: the reference then already exists, so the second call can only be recognised
// as the same spend (same user, 'attempt', -10) and return true, or raise again. It can never charge a second time.
export const LEGACY_QUICK_ACTION = 'attempt';
const REFERENCE_CONFLICT = /credit reference already used/i;

export async function spendWithLegacyFallback(spend, userId, action, reference) {
  try {
    return await spend(userId, action, reference);
  } catch (error) {
    if (typeof action === 'string' && /^attempt_(5|10|15|20)$/.test(action) && REFERENCE_CONFLICT.test(String(error?.message || ''))) {
      return spend(userId, LEGACY_QUICK_ACTION, reference);
    }
    throw error;
  }
}
