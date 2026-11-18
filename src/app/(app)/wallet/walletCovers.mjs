// Wallet, 19 Nov 2026 (lane arena-a): what the balance buys, as things. Each priced thing in "What credits buy" shows its
// desk object (the ones the pricing tiles use), its price, and how many of it the current balance covers: the balance over
// the listed price, rounded down. Pure. Hidden when the price is not a number of credits (Included on Pro) or is 0, or when
// the balance is unknown. A known balance of 0 covers 0: zero is said, never hidden as unknown.
import { quickQuestionsFor } from '../../../lib/creditCopy.mjs';

/** The desk object and the plural noun for each priced line (walletModel priceRows keys). */
export const COVER_THINGS = Object.freeze({
  reply: Object.freeze({ icon: 'bell', noun: 'written answers', one: 'written answer' }),
  repair: Object.freeze({ icon: 'mistakes', noun: 'mistake repairs', one: 'mistake repair' }),
  question: Object.freeze({ icon: 'questions', noun: 'practice questions', one: 'practice question' }),
  mock: Object.freeze({ icon: 'papers', noun: 'full mocks', one: 'full mock' }),
});

/** How many of a thing the balance covers, or null when that cannot be said truthfully. */
export function covers(balance, price) {
  if (balance === null || balance === undefined || !Number.isFinite(Number(balance)) || Number(balance) < 0) return null;
  if (price === null || price === undefined || !Number.isFinite(Number(price)) || Number(price) <= 0) return null;
  return Math.floor(Number(balance) / Number(price));
}

/**
 * "covers 108 written answers", or null. Practice questions come in sets of 5, 10, 15 or 20 (data/test_modes.js), so the
 * balance covers whole sets: 37 credits cover 35 questions, never 37 (creditCopy quickQuestionsFor, as the credits modal says).
 */
export function coversLine(key, balance, price) {
  let n = covers(balance, price);
  if (n !== null && key === 'question') n = quickQuestionsFor(balance);
  const thing = COVER_THINGS[key];
  if (n === null || !thing) return null;
  return `covers ${n.toLocaleString('en-IN')} ${n === 1 ? thing.one : thing.noun}`;
}

/** The numeric price behind each priced line, from the same prices the page lists (Pro's practice is Included: no number). */
export function linePrice(key, prices, pro) {
  if (key === 'reply') return prices.reply;
  if (key === 'repair') return prices.repair;
  if (key === 'question') return pro ? null : prices.question;
  if (key === 'mock') return pro ? null : prices.fullMock;
  return null;
}
