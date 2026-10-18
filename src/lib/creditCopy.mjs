// The two credit names and the one way a spend line is written (audit findings 12 and 13).
// Two names only, everywhere on the website: "Practice credits" (mocks and practice) and "AI credits" (Ask Mobi and
// repairs). Every spend line names its pool and its total: "This repair uses 3 AI credits. You have 9."
// Pure, no React, so the words can be held by a test. Plain sentence case: no "!", no em dash, no middle dot.

import { TEST_MODES, practiceCreditCost } from '../../data/test_modes.js';

export const PRACTICE_CREDITS = 'Practice credits';
export const AI_CREDITS = 'AI credits';
export const POOL_NAMES = Object.freeze({ practice: PRACTICE_CREDITS, ai: AI_CREDITS });
export const POOL_USE = Object.freeze({
  practice: 'Practice credits are for mocks and practice.',
  ai: 'AI credits are for Ask Mobi and repair explanations.',
});

const whole = (n) => (typeof n === 'number' || (typeof n === 'string' && n.trim() !== '')) && Number.isFinite(Number(n)) ? Math.max(0, Math.trunc(Number(n))) : null;
const fmt = (n) => n.toLocaleString('en-IN');

/** "1 AI credit", "3 AI credits", "10 practice credits". An unknown count has no number to write. */
export function creditCount(n, pool = 'ai') {
  const v = whole(n);
  const noun = pool === 'practice' ? 'practice credit' : 'AI credit';
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

/** "AI credits 9" style label for a balance chip or aria-label, or "AI credits unavailable". */
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
/** "Practice credits: 1 a question. A 10-question set is 10, a full mock 50." */
export const PRACTICE_PRICE_LINE = `${PRACTICE_CREDITS}: ${PRACTICE_PRICE.perQuestion} a question. A ${PRACTICE_PRICE.setQuestions}-question set is ${PRACTICE_PRICE.set}, a full mock ${PRACTICE_PRICE.full}.`;
/** The same, for a place that already says "practice credits" before it: "1 a question. A 10-question set is 10, a full mock 50." */
export const PRACTICE_PRICE_TAIL = `${PRACTICE_PRICE.perQuestion} a question. A ${PRACTICE_PRICE.setQuestions}-question set is ${PRACTICE_PRICE.set}, a full mock ${PRACTICE_PRICE.full}.`;
