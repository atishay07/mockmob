// Plan facts: every number a student reads about credits, costs and plans comes from here.
//
// Web IA plan 4.4 (15 Oct 2026). Pages never type a credit number or a price themselves: they read
// this module, the wallet (live balances) and publicOffer() (src/lib/payments/offer.js, the price).
// Each fact carries its source. "production" facts were read on 15 Oct 2026 with read-only SELECT
// queries on the production database (project isrxrxzjocewrdureyhp); "code" facts are constants in
// this repository that a test keeps in step (data/tests/plan_facts.test.mjs).
//
// Pure data, no imports: safe in client components, server routes and node tests.

export const PLAN_FACTS_CHECKED = '2026-10-15';

const fact = (value, source, note = null) => Object.freeze({ value, source, ...(note ? { note } : {}) });

export const PLAN_FACTS = Object.freeze({
  practiceCredits: Object.freeze({
    // users.credit_balance column default is 100 (information_schema.columns, production).
    startingBalance: fact(100, 'production: users.credit_balance default 100; migrations 0011 and 0027'),
    // public.spend_credits CASE p_action: attempt 10, attempt_full 50 (production function body).
    // A Quick practice costs 10 whatever its length (5, 10, 15 or 20 questions): data/test_modes.js.
    quickCost: fact(10, 'production: spend_credits attempt = 10; code: TEST_MODES.quick.creditCost'),
    fullMockCost: fact(50, 'production: spend_credits attempt_full = 50; code: TEST_MODES.full.creditCost'),
    // Smart practice and NTA mode never call spend_credits: they come with Pro.
    proOnlyModes: fact(['smart', 'nta'], 'code: data/test_modes.js premium modes; migration 0036'),
    // No recurring grant reaches a student today (production, 15 Oct 2026):
    //   grant_daily_login_credits returns FALSE (no credit since 25 Apr 2026, 3 legacy rows),
    //   apply_question_vote never sets v_credits_added, so a vote adds nothing (0 vote grants ever),
    //   grant_contribution_credits (15) is called only by moderate_question_with_credit, which no app
    //   route calls: 0 'contribute' grants ever. Copy must not promise credits for any of these.
    grants: Object.freeze({
      dailyLogin: fact(0, 'production: grant_daily_login_credits body is RETURN FALSE'),
      vote: fact(0, 'production: apply_question_vote never sets v_credits_added; 0 vote:* transactions'),
      contribution: fact(0, 'production: 0 contribute transactions; grant_contribution_credits (15) has no caller in src',
        'The database could grant 15 on an approved upload, but no route calls it. Say no reward is promised.'),
      signUpBonus: fact(0, 'production: no sign-up grant function; the 100 is the column default'),
    }),
  }),
  aiCredits: Object.freeze({
    // ai_credit_wallets.included_monthly_credits in production: 810 wallets at 10, 69 at 50.
    freeMonthly: fact(10, 'production: ai_credit_wallets 10 for free accounts; code: AI_FREE_MONTHLY_CREDITS'),
    proMonthly: fact(50, 'production: ai_credit_wallets 50 for Pro; code: AI_PRO_INCLUDED_MONTHLY_CREDITS'),
    // The allowance renews on the first of each IST calendar month (walletWindow).
    renews: fact('first of each month, India time', 'code: src/services/credits/aiWalletState.js walletWindow'),
    // ai_credit_reservations: score_recovery_repair amount 1 (6 committed, 6 released).
    repairCost: fact(1, 'production: ai_credit_reservations score_recovery_repair amount 1; code: REPAIR_CREDIT_COST'),
    // ai_credit_reservations: prepos_revision amount 1; the chat route passes creditCost 1 for every model reply.
    askMobiReplyCost: fact(1, 'production: ai_credit_reservations prepos_* amount 1; code: mentor chat route creditCost 1'),
    // Questions about the student's own record are answered from the record, with no model and no credit.
    recordQuestionsFree: fact(true, 'code: src/services/prepos/modelReply.js (record replies are not charged)'),
    // A stored explanation (already prepared for this question) is shown again at no charge.
    storedRepairFree: fact(true, 'code: repair flow status stored, charged 0'),
    // "Explain it another way" comes inside the same repair call at no extra credit (Repair v3 spec D.4).
    explainAgainFree: fact(true, 'spec: mockmob-next/tmp/repair-v3/SPEC.md D.4'),
    topUpsOnSale: fact(false, 'code: RELEASE_GATES.aiCommerce false (CAPABILITIES.aiTopUps paused)'),
  }),
  marking: Object.freeze({
    right: fact(5, 'code: data/recovery.js rawScore = correct * 5 - wrong'),
    wrong: fact(-1, 'code: data/recovery.js rawScore = correct * 5 - wrong'),
    blank: fact(0, 'code: data/recovery.js (a blank scores 0)'),
  }),
  sessions: Object.freeze({
    quickCounts: fact([5, 10, 15, 20], 'code: TEST_MODES.quick.countOptions'),
    quickMinutesPerQuestion: fact(1, 'code: TEST_MODES.quick.durationPerQuestionSec 60'),
    fullQuestions: fact(50, 'code: TEST_MODES.full (50 questions)'),
    fullMinutes: fact(60, 'code: TEST_MODES.full.fixedDurationSec 3600'),
    ntaQuestions: fact(50, 'code: MODE_CAPABILITIES.nta (50 questions, 60 minutes)'),
    ntaMinutes: fact(60, 'code: MODE_CAPABILITIES.nta'),
    sampleQuestions: fact(5, 'code: landing sample (DemoDrill) asks 5'),
  }),
  pro: Object.freeze({
    // The price is NOT here: it is publicOffer() (one-time until monthly billing opens).
    includes: fact(['Practice without credits', 'NTA mode', 'Smart practice', '50 AI credits a month', 'Your gap to each college'],
      'code: MODE_CAPABILITIES, AI_PRO_INCLUDED_MONTHLY_CREDITS, /api/compass/pro'),
  }),
  subjects: Object.freeze({
    count: fact(15, 'code: data/cuet_controls.js CUET_PUBLIC_ALLOWED_SUBJECTS'),
  }),
  env: Object.freeze({
    // Names only; values are never read. These cannot be read from the database, so they stay
    // unverified here. Pages must read their own runtime switches, never this record.
    monthlyBillingPlanId: fact('unverified', 'RAZORPAY_PLAN_ID_PRO_MONTHLY_99: not readable by SQL. production payments has 0 pro_monthly_99 rows (15 Oct)',
      'publicOffer() decides at runtime. Keep "Monthly Pro opens soon" to at most one line.'),
    studyFlags: fact('unverified', 'STUDY_CONTENT_ENABLED, STUDY_RECALL_ENABLED, STUDY_GUIDED_PLAN_ENABLED: not readable by SQL. Last study_runs row 4 Oct 2026',
      'Concepts shows only when the page receives studyEnabled from the server.'),
  }),
});

// A whole, non-negative count, or null when unknown (null, undefined, '' or not a number).
const n = (value) => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.trunc(Number(value))));
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Minutes a Quick practice of `count` questions takes. */
export function quickMinutes(count = 10) {
  return Math.max(1, Math.round((n(count) || 10) * PLAN_FACTS.sessions.quickMinutesPerQuestion.value));
}

/** "+5 right, -1 wrong." */
export function markingLine() {
  return `+${PLAN_FACTS.marking.right.value} right, ${PLAN_FACTS.marking.wrong.value} wrong.`;
}

/** Practice credits a session of this mode uses on the free plan, or 0 for Pro, or null when the mode needs Pro. */
export function sessionCost(mode, { pro = false } = {}) {
  if (mode === 'quick') return pro ? 0 : PLAN_FACTS.practiceCredits.quickCost.value;
  if (mode === 'full') return pro ? 0 : PLAN_FACTS.practiceCredits.fullMockCost.value;
  if (PLAN_FACTS.practiceCredits.proOnlyModes.value.includes(mode)) return pro ? 0 : null;
  return null;
}

/**
 * The cost line on a confirm step. Nothing is spent until Start.
 *   'Uses 10 of your 40 practice credits.' / 'Included with Pro.' / 'Comes with Pro.' /
 *   'Uses 10 practice credits. You have 4.' (not enough)
 */
export function costLine(mode, { pro = false, balance = null } = {}) {
  const cost = sessionCost(mode, { pro });
  if (cost === null) return 'Comes with Pro.';
  if (pro) return 'Included with Pro.';
  const have = n(balance);
  if (have === null) return `Uses ${plural(cost, 'practice credit')}.`;
  if (have < cost) return `Uses ${plural(cost, 'practice credit')}. You have ${have}.`;
  return `Uses ${cost} of your ${plural(have, 'practice credit')}.`;
}

/** The whole confirm line for a session, for example "10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice credits." */
export function confirmLine({ mode = 'quick', count = 10, pro = false, balance = null } = {}) {
  const what = mode === 'quick'
    ? `${plural(n(count) || 10, 'question')}, about ${quickMinutes(count)} minutes.`
    : `${PLAN_FACTS.sessions.fullQuestions.value} questions, ${PLAN_FACTS.sessions.fullMinutes.value} minutes.`;
  return `${what} ${markingLine()} ${costLine(mode, { pro, balance })}`;
}

/** The repair cost line: "1 AI credit each. You have 10." */
export function repairCostLine({ aiBalance = null } = {}) {
  const cost = PLAN_FACTS.aiCredits.repairCost.value;
  const have = n(aiBalance);
  return `${plural(cost, 'AI credit')} each.${have === null ? '' : ` You have ${have}.`}`;
}

/** Labelled credit lines for the desktop rail footer and the phone chip ("40 practice credits", "9 AI credits"). */
export function creditLines({ practiceBalance = null, aiRemaining = null, pro = false } = {}) {
  const lines = [];
  if (!pro && n(practiceBalance) !== null) lines.push({ id: 'practice', label: plural(n(practiceBalance), 'practice credit') });
  if (n(aiRemaining) !== null) lines.push({ id: 'ai', label: plural(n(aiRemaining), 'AI credit') });
  return lines;
}

/**
 * The popover under the phone credits chip: plain labelled sentences.
 * `resetAt` is the wallet's reset time (ISO); the date is shown in India time.
 */
export function creditPopoverLines({ practiceBalance = null, aiRemaining = null, aiAllowance = null, resetAt = null, pro = false } = {}, { locale = 'en-IN' } = {}) {
  const lines = [];
  if (pro) lines.push({ id: 'practice', text: 'Practice comes with Pro: mocks and practice use no credits.' });
  else if (n(practiceBalance) !== null) lines.push({ id: 'practice', text: `Practice credits ${n(practiceBalance)}: pay for mocks and practice.` });
  if (n(aiRemaining) !== null) {
    const allowance = n(aiAllowance) ?? (pro ? PLAN_FACTS.aiCredits.proMonthly.value : PLAN_FACTS.aiCredits.freeMonthly.value);
    const reset = resetAt ? new Date(resetAt) : null;
    const renew = reset && !Number.isNaN(reset.getTime())
      ? ` Renews ${reset.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}.`
      : '';
    lines.push({ id: 'ai', text: `AI credits ${n(aiRemaining)} of ${allowance} this month: pay for Mistake Repair and Ask Mobi.${renew}` });
  }
  return lines;
}

/** The free plan, as plain sentences for pricing and sign-up (plan 4.4). */
export function freePlanLines() {
  const p = PLAN_FACTS;
  return [
    `Start with ${p.practiceCredits.startingBalance.value} practice credits. A ${PLAN_FACTS.sessions.quickCounts.value[1]}-question practice uses ${p.practiceCredits.quickCost.value}, a full mock uses ${p.practiceCredits.fullMockCost.value}.`,
    `${p.aiCredits.freeMonthly.value} AI credits every month. One Mistake Repair uses ${p.aiCredits.repairCost.value}.`,
    `All ${p.subjects.count.value} subjects, answer explanations, the Cutoff calculator and Combo planner.`,
  ];
}

/** What Pro adds, as plain items (the price comes from publicOffer()). */
export function proPlanLines() {
  return [...PLAN_FACTS.pro.includes.value];
}

/** The one true line about contribution rewards (plan 6, truth fixes). */
export function contributionRewardLine() {
  return PLAN_FACTS.practiceCredits.grants.contribution.value > 0
    ? `An approved question adds ${PLAN_FACTS.practiceCredits.grants.contribution.value} practice credits.`
    : 'No credit reward is promised for a submission.';
}
