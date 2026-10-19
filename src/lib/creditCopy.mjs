// The credit name and the one way a spend line is written (audit findings 12 and 13).
// One credits balance (owner, 18 Oct 2026, D78): one name, "credits", for everything. ONE_CREDIT_LINE says what a credit
// buys. The `pool` arguments are kept for older callers and no longer change the words.
// Every spend line names its total: "This repair uses 1 credit. You have 9."
// Pure, no React, so the words can be held by a test. Plain sentence case: no "!", no em dash, no middle dot.

import { TEST_MODES, practiceCreditCost } from '../../data/test_modes.js';
import { FIRST_FULL_MOCK_ON } from '../../data/first_full_mock.js';

// The free first full mock (C-dec 1), said only while its switch is on (FIRST_FULL_MOCK_ENABLED, data/first_full_mock.js).
const FIRST_ONE_FREE = FIRST_FULL_MOCK_ON ? ', and your first one in each subject is free' : '';

export const CREDITS = 'Credits';
/** What deeper AI analysis costs (a mock autopsy, a trap drill, a plan, a rival analysis): CREDIT_COSTS in
 *  src/services/usage/getDailyUsage.js; data/tests/release10_verifier_1019.test.mjs holds the two together. */
export const DEEP_AI_CREDITS = 3;
/** What one credit buys, said one way everywhere (release 10 verifier M3: deeper analysis is 3, never "1 reply"). Since 19 Oct
 *  (C-dec 1, data/first_full_mock.js) it says the first full mock in each subject is free wherever it says a full mock is 50,
 *  while the rule's switch is on. Each price names its unit, "50 credits" (release 11 verifier L6). */
export const ONE_CREDIT_LINE = `1 credit buys 1 practice question or 1 chat reply. A full mock costs ${practiceCreditCost('full', TEST_MODES.full.fixedCount)} credits${FIRST_ONE_FREE}. Deeper analysis costs ${DEEP_AI_CREDITS} credits. The cost shows before you start.`;
// Kept for older imports: both names are now the one name.
export const PRACTICE_CREDITS = CREDITS;
export const AI_CREDITS = CREDITS;
export const POOL_NAMES = Object.freeze({ practice: CREDITS, ai: CREDITS });
export const POOL_USE = Object.freeze({ practice: ONE_CREDIT_LINE, ai: ONE_CREDIT_LINE });

const whole = (n) => (typeof n === 'number' || (typeof n === 'string' && n.trim() !== '')) && Number.isFinite(Number(n)) ? Math.max(0, Math.trunc(Number(n))) : null;
const fmt = (n) => n.toLocaleString('en-IN');

/** "1 credit", "3 credits". An unknown count has no number to write. `pool` is kept for older callers. */
export function creditCount(n, pool = 'ai') {
  const v = whole(n);
  const noun = 'credit';
  return v === null ? `${noun}s` : `${fmt(v)} ${noun}${v === 1 ? '' : 's'}`;
}

/** "You have 9." Null when the balance is not known: unknown is never written as 0. */
export function haveLine(balance) {
  const v = whole(balance);
  return v === null ? null : `You have ${fmt(v)}.`;
}

/** Before a spend: "This repair uses 3 AI credits. You have 9." */
export function usesLine({ what = 'This', verb = 'uses', cost, pool = 'ai', balance = null }) {
  const head = `${what} ${verb} ${creditCount(cost, pool)}.`;
  const have = haveLine(balance);
  return have ? `${head} ${have}` : head;
}

/** After a spend: "1 AI credit used. You have 8." */
export function usedLine({ cost, pool = 'ai', balance = null }) {
  const head = `${creditCount(cost, pool)} used.`;
  const have = haveLine(balance);
  return have ? `${head} ${have}` : head;
}

/** "Credits: 9" style label for a balance chip or aria-label, or "AI credits unavailable". */
export function balanceLabel(balance, pool = 'ai') {
  const v = whole(balance);
  return v === null ? `${POOL_NAMES[pool]} unavailable` : `${POOL_NAMES[pool]}: ${fmt(v)}`;
}

// The practice price, said one way everywhere (owner D65, 18 Oct): Quick practice is 1 practice credit a question, a full mock
// is a fixed 50. The numbers come from data/test_modes.js, so the words, the quote and the database price move together.
const SET = 10;
export const PRACTICE_PRICE = Object.freeze({
  perQuestion: TEST_MODES.quick.creditPerQuestion,
  set: practiceCreditCost('quick', SET),
  setQuestions: SET,
  full: practiceCreditCost('full', TEST_MODES.full.fixedCount),
});
/** "A practice question costs 1 credit, so a 10-question set is 10 credits. A full mock costs 50 credits, and your first one in
 *  each subject is free." (one credits balance, D78; the free first full mock, C-dec 1, 19 Oct; full sentences, R6) */
export const PRACTICE_PRICE_LINE = `A practice question costs ${PRACTICE_PRICE.perQuestion} credit, so a ${PRACTICE_PRICE.setQuestions}-question set is ${PRACTICE_PRICE.set} credits. A full mock costs ${PRACTICE_PRICE.full} credits${FIRST_ONE_FREE}.`;
/** The same, for a place that already says "practice credits" before it: "1 a question. A 10-question set is 10, a full mock 50." */
export const PRACTICE_PRICE_TAIL = `${PRACTICE_PRICE.perQuestion} a question. A ${PRACTICE_PRICE.setQuestions}-question set is ${PRACTICE_PRICE.set}, a full mock ${PRACTICE_PRICE.full}.`;

/**
 * The most Quick-practice questions a practice-credit balance buys: sets come in 5, 10, 15 or 20 questions, so it is a whole
 * number of the smallest set. 37 credits buy 35 questions, never 37; under 5 credits buy none (0).
 */
export function quickQuestionsFor(balance) {
  const have = whole(balance) ?? 0;
  const step = Math.min(...TEST_MODES.quick.countOptions);
  return Math.floor(have / (TEST_MODES.quick.creditPerQuestion * step)) * step;
}
