// Today's included 10-question set, said the way the server quote says it (release 9, verifier finding "a free set is priced at
// 10 credits"). On Free, one Quick set of 10 questions a day is included (allowance kind daily_practice, data/practice_quote.js
// allowanceKindFor) and the server charges 0 for it; every other count, and the set after the included one, is 1 credit a question.
// So a line that prices "a 10-question set" has to read the allowance the way the quote does, or it says "uses 10 practice
// credits" about a set that is free.
//
// Three states, one meaning everywhere (the dashboard's count options, Today, the Start sheet, the result and Review next moves):
//   'free'    the quote said the included set is available: print "Free: today's included set." (no number, no balance)
//   'priced'  the quote was read and the set is not free (the included set is used, or the allowance is off): print the price
//   'unknown' not read yet, or the read failed: print no number, say Practice shows the price before it starts
// Pure, no React. The default for a caller that never reads the allowance (the shared fixtures and the app port) is 'priced',
// the words as they were; every web surface passes the state it read (useDailySet).

import { practiceCreditCost } from '../../data/test_modes.js';

export const DAILY_SET = Object.freeze({ free: 'free', priced: 'priced', unknown: 'unknown' });
export const DAILY_SET_QUESTIONS = 10;
export const DAILY_FREE_LINE = 'Free: today’s included set.';
export const DAILY_FREE_SHORT = 'Free today';
export const PRICE_AT_START_LINE = 'Practice shows the price before it starts.';
export const PRICE_AT_START_SHORT = 'Price shown at start';

/** A state word from anywhere, narrowed to one of the three. Anything else is 'priced' (the words as they were). */
export function dailySetState(value) {
  return value === DAILY_SET.free || value === DAILY_SET.unknown ? value : DAILY_SET.priced;
}

/**
 * The state a server quote (GET /api/practice/quote for a Quick 10 set) proves.
 *   allowance.state 'available'        -> 'free'
 *   allowance.state 'unknown'          -> 'unknown' (the allowance read failed)
 *   allowance.state 'used'             -> 'priced'
 *   allowance null (key present)       -> 'priced' (the allowance is off, or the student is Pro: nothing is included)
 *   no allowance key / not a quote     -> 'unknown' (the quote was blocked before the allowance step, or it never came)
 */
export function dailySetFromQuote(quote) {
  if (!quote || typeof quote !== 'object') return DAILY_SET.unknown;
  const allowance = quote.allowance;
  if (allowance && typeof allowance === 'object') {
    if (allowance.state === 'available') return DAILY_SET.free;
    if (allowance.state === 'used') return DAILY_SET.priced;
    return DAILY_SET.unknown;
  }
  if (allowance === null && typeof quote.creditCost === 'number') return DAILY_SET.priced;
  return DAILY_SET.unknown;
}

/** Is this the set the allowance covers: a Quick set of exactly 10 questions? */
export function isDailySet(modeId, count) {
  return modeId === 'quick' && Number(count) === DAILY_SET_QUESTIONS;
}

/**
 * The small price under a Quick count option on Practice ("5 credits", "Free today"), or null for no hint. Pro has none; the
 * 10-question option follows the allowance: free says "Free today", an unread allowance says nothing (a number there could be
 * the very claim the quote contradicts), a priced set says its credits. Other counts are always 1 credit a question.
 */
export function countHint(modeId, count, { isPremium = false, dailySet = DAILY_SET.priced } = {}) {
  if (isPremium) return null;
  const cost = practiceCreditCost(modeId, count);
  if (!cost) return null;
  if (isDailySet(modeId, count)) {
    const daily = dailySetState(dailySet);
    if (daily === DAILY_SET.free) return DAILY_FREE_SHORT;
    if (daily === DAILY_SET.unknown) return null;
  }
  return `${cost} credits`;
}
