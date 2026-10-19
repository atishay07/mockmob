// The test page's notice when a full mock that was quoted free did not start (release 11 verifier L1, data/first_full_mock.js):
// the server refused it (FIRST_FULL_MOCK_TAKEN or FIRST_FULL_MOCK_UNCHECKED) and charged nothing, and the page asks for a new
// quote so the price is on screen before the student starts again. PURE, so the words are held by a test.
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_REASON, FIRST_FULL_MOCK_REFUSAL_COPY, FIRST_FULL_MOCK_TAKEN, FIRST_FULL_MOCK_UNCHECKED } from '../../data/first_full_mock.js';
import { creditCount, haveLine } from './creditCopy.mjs';

const PRICE_IN_PRACTICE = 'Practice shows the price before you start.';

/** Is this start error the refusal of a full mock that was quoted free? */
export const isFirstMockRefusal = (error) => error?.message === FIRST_FULL_MOCK_TAKEN || error?.message === FIRST_FULL_MOCK_UNCHECKED;

/** The price as the new quote says it: "A full mock in English costs 50 credits. You have 135." */
export function notFreePriceLine(quote, subjectName = '') {
  const cost = Number(quote?.creditCost);
  if (!quote || typeof quote !== 'object' || quote.creditCost === null || quote.creditCost === undefined || !Number.isFinite(cost)) return PRICE_IN_PRACTICE;
  if (cost === 0) return quote.freeReason === FIRST_FULL_MOCK_REASON ? FIRST_FULL_MOCK_COPY.price : PRICE_IN_PRACTICE;
  return [`A full mock${subjectName ? ` in ${subjectName}` : ''} costs ${creditCount(cost)}.`, haveLine(quote.creditBalance)].filter(Boolean).join(' ');
}

/** The notice: { title, message, price, retry }. `retry` when trying the same start again may still find it free. */
export function firstMockNotice(error, quote, subjectName = '') {
  const unchecked = error?.message === FIRST_FULL_MOCK_UNCHECKED;
  const sent = typeof error?.body?.message === 'string' && error.body.message.trim() ? error.body.message.trim() : '';
  return {
    title: unchecked ? 'This full mock did not start' : 'This full mock is not free now',
    message: sent || (unchecked ? FIRST_FULL_MOCK_REFUSAL_COPY.unchecked : FIRST_FULL_MOCK_REFUSAL_COPY.taken),
    price: unchecked ? '' : notFreePriceLine(quote, subjectName),
    retry: unchecked,
  };
}
