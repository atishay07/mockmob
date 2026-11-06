// What Pro's price covers at the student's own pace: the value receipt beside the Pro card on the home page's #pricing (owner,
// 6 Nov 2026: "There should be a slider for how many things a student can do, like if someone is attempting 1 mock, then
// repairs, then key cards and other stuff ... so many features other than mocks also do we have, which the Pro plan gives").
// One slider sets Full mocks a week (value.mjs PACE); the receipt counts what that pace comes to over the period the price pays
// for, lists the Key cards Pro opens, and ends on what one full mock costs with all of it included, and what a question costs.
// It never adds unlike things into one "in all" count (a mock and its own Lab read are one sitting, and a bank of cards is
// not something done): the close divides the price by full mocks and by questions only (orchestrator review, 6 Nov 2026).
//
// Truth (owner rule, hard): every count is computed here, never typed, from
//   - the offer and the period it pays for (value.mjs perMock: a 30-day month, or the days left to the one-time expiry);
//   - the Full mock's own size (value.mjs QUESTIONS_PER_MOCK, from data/test_modes.js);
//   - one stated per-mock rule, PER_MOCK: every Full mock brings one Mistake Lab read (the FAQ: "After every mock, the Lab
//     shows ... time on each question, every answer you changed ... and a SWOT") and one chapter review (Pro's own line,
//     "Full chapter review: every ranked chapter, pace and changed answers"; the tour: "free after every mock");
//   - the real Key cards bank (keyCardsPicks.mjs keyCardsDemo().bank: every served card; Pro opens every card), only while
//     Key cards are live.
// Mistake Repair and Ask Mobi run on monthly credits capped per student in the database, so they are never counted here.
// Whole mocks only (a part mock has no read), so no count is ever flattering; the price per thing is "under N paise" by
// value.mjs perQuestion's rule (N the next whole paisa above the exact figure).
// Pure: no clock (the caller passes the date), no React, so node --test pins every figure (data/tests/pricing_value_1105.test.mjs).
import { MOCK_PACES, QUESTIONS_PER_MOCK, perMock, perQuestion } from './value.mjs';

/** What one Full mock brings on Pro, one of each, in the receipt's order: the mock itself, its Lab read, its chapter review. */
export const PER_MOCK = Object.freeze(['mocks', 'lab', 'review']);

/** A Key cards bank as keyCardsDemo().bank gives it ({ cards, subjects }), or null unless both are real, positive counts. */
export function cardsBank(bank) {
  const cards = Number(bank?.cards);
  const subjects = Number(bank?.subjects);
  return Number.isInteger(cards) && cards > 0 && Number.isInteger(subjects) && subjects > 0 ? { cards, subjects } : null;
}

/**
 * The receipt at `pace` Full mocks a week, or null when the offer gives no figure (no period, an expired one-time offer, or not
 * one whole mock in it).
 * { kind, pace, days, until, price: '₹99', pricePaise, mocks, questions, perMock: { about, aboutPaise, exact },
 *   lines: [{ key: 'mocks' | 'lab' | 'review' | 'cards', count, subjects? }], each: perQuestion(price, questions) }
 */
export function proReceipt(offer, pace, { from, keyCards = null } = {}) {
  const m = perMock(offer, pace, { from });
  if (!m) return null;
  const mocks = Math.floor(m.mocks);
  if (!(mocks > 0)) return null;
  const bank = cardsBank(keyCards);
  const lines = [
    ...PER_MOCK.map((key) => ({ key, count: mocks })),
    ...(bank ? [{ key: 'cards', count: bank.cards, subjects: bank.subjects }] : []),
  ];
  const questions = mocks * QUESTIONS_PER_MOCK;
  return {
    kind: m.kind, pace, days: m.days, until: m.until, price: m.price, pricePaise: m.pricePaise,
    mocks, questions,
    perMock: { about: m.about, aboutPaise: m.aboutPaise, exact: m.exact },
    lines, each: perQuestion(m.pricePaise, questions),
  };
}

/** Every pace of the slider, worked out (the server hands these to the client, so the browser does no money maths). */
export const receiptTable = (offer, opts) => MOCK_PACES.map((pace) => proReceipt(offer, pace, opts)).filter(Boolean);
