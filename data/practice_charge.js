// What starting a practice session costs: a credit action and a daily allowance kind, or neither. PURE, so the rule is
// tested in data/tests/mob.test.mjs without a database (src/lib/server/practiceSessions.js calls it on both start paths).
//
// A Mob paper (SOCIAL-SPEC section 15) is free of practice credits for every member: no credit action and no daily
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
