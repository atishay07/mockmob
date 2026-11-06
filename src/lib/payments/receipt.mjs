// The value plan beside the Pro card on the home page's #pricing: everything Pro's price covers at the student's own pace.
// Round 5, second take (owner, 6 Nov 2026: "the slider implementation that you have done is a good direction, but it's a bit
// weird ... Full marks, 190, mistake lab 190, all but key cards ... How many key cards will you practice? ... think of something
// and improvise this also"; research and decisions in docs/design-decisions/web-r5-value.md).
// Two inputs in the student's own units: Full mocks a week (value.mjs PACE, 5 to 21; the hero's "as low as" hook reads the top)
// and Key cards a day (CARD_PACE, 12 to 60, only while Key cards are live). Every output is a different number: the whole Full
// mocks the pace gives (each brings its own Mistake Lab read and chapter review, said once in words and never counted again),
// their questions, and the Key cards the plan turns. The price frames: a day (the price over the days it pays for), then a mock
// and a question at the student's pace. Unlike things are never added into one count.
//
// Truth (owner rule, hard): every figure is computed here, never typed, from
//   - the offer and the period it pays for (value.mjs perDay: a 30-day month, or the days left to the one-time expiry from
//     `from`, the day the reader reads it: PlanValue.jsx passes the reader's own date once it is on screen);
//   - the Full mock's own size (value.mjs QUESTIONS_PER_MOCK, from data/test_modes.js);
//   - the student's own plan (the two inputs), said on the page as "If you keep that pace ...";
//   - the real Key cards bank (keyCardsPicks.mjs keyCardsDemo().bank: every served card; Pro opens every card), only while live;
//   - Key cards' own time per card (data/keycards.js KEYCARD_RULES.minutesPerCard, 15 seconds), passed in by the server.
// Pro has no daily cap on Key cards (reviews are uncapped and new cards are only counted: src/lib/server/keycards.js review), so
// so many a day is the student's own choice; a day's turns include the cards that come back on their schedule, so the count is
// of cards turned, never of cards learnt. Mistake Repair and Ask Mobi run on monthly credits capped per student in the
// database, so they are never counted here. Whole mocks only (a part mock has no Lab read), so no count is ever flattering, and
// every "about" is the true division rounded UP to the next 10 paise (value.mjs aboutTenPaise), the same rule as the hero hook.
// Pure: no clock (the caller passes the date), no React, so node --test pins every figure (data/tests/pricing_value_1105.test.mjs).
import { MOCK_PACES, PACE, QUESTIONS_PER_MOCK, aboutTenPaise, perDay, perQuestion, rupees } from './value.mjs';

/** Key cards a day: from 12 to 60 (15 minutes at Key cards' own 15 seconds a card), in steps of 6; 24 (about 6 minutes) first.
 *  Steps of 6, not 5: on a 30-day month a multiple of 5 cards a day can turn exactly as many cards as the mocks hold questions
 *  (35 a day at 5 mocks a week: 1,050 and 1,050), and no two lines may share a number. */
export const CARD_PACE = Object.freeze({ min: 12, max: 60, step: 6, start: 24 });
/** Every value the Key cards slider can take, lowest first. */
export const CARD_PACES = Object.freeze(Array.from({ length: (CARD_PACE.max - CARD_PACE.min) / CARD_PACE.step + 1 }, (_, i) => CARD_PACE.min + i * CARD_PACE.step));

/** A Key cards pace said plainly: `long` for a screen reader ("20 Key cards a day"), `short` on the slider ("20 a day"). */
export const cardWords = (perDayCards) => ({ long: `${perDayCards} Key cards a day`, short: `${perDayCards} a day` });

/** Minutes a day of Key cards, rounded up as the app rounds them (data/keycards.js cardMinutes), or null without a rate. */
export function cardMinutes(perDayCards, minutesPerCard) {
  const rate = Number(minutesPerCard);
  return perDayCards > 0 && rate > 0 ? Math.ceil(perDayCards * rate - 1e-9) : null;
}

/** A Key cards bank as keyCardsDemo().bank gives it ({ cards, subjects }), or null unless both are real, positive counts. */
export function cardsBank(bank) {
  const cards = Number(bank?.cards);
  const subjects = Number(bank?.subjects);
  return Number.isInteger(cards) && cards > 0 && Number.isInteger(subjects) && subjects > 0 ? { cards, subjects } : null;
}

/** Whole Full mocks a pace (mocks a week) gives over a number of days: never rounded up (a part mock has no read). */
export const wholeMocks = (pace, days) => Math.floor((pace * days) / 7 + 1e-9);

/** { about: '₹0.40', aboutPaise: 40, exact: false }: price / count, rounded up; `exact` when nothing was rounded. */
function share(pricePaise, count) {
  const aboutPaise = aboutTenPaise(pricePaise, count);
  return { about: rupees(aboutPaise), aboutPaise, exact: Math.abs(pricePaise / count - aboutPaise) < 1e-9 };
}

/**
 * What the price covers at the student's own plan, or null when the offer gives no figure (no period, an expired one-time offer,
 * or not one whole mock at that pace in what is left of it).
 *   pace   Full mocks a week (value.mjs MOCK_PACES)
 *   cards  Key cards a day (CARD_PACES); ignored unless `keyCards` is a real bank
 * { kind: 'monthly' | 'once', days, until, price: '₹99', pricePaise,
 *   perDay: { about, aboutPaise, exact },
 *   pace, mocks, questions, perMock: { about, aboutPaise, exact }, perQuestion: value.mjs perQuestion,
 *   cards: { perDay, count, minutes, bank: { cards, subjects } } | null, mobi: { credits } | null }
 */
export function planValue(offer, { from, pace = PACE.start, cards = CARD_PACE.start, keyCards = null, minutesPerCard = null, mobiCredits = null } = {}) {
  const day = perDay(offer, { from });
  if (!day || !Number.isFinite(pace) || pace <= 0) return null;
  const mocks = wholeMocks(pace, day.days);
  if (!(mocks > 0)) return null;
  const pricePaise = day.rupees * 100;
  const questions = mocks * QUESTIONS_PER_MOCK;
  const bank = cardsBank(keyCards);
  const perDayCards = bank && Number.isInteger(cards) && cards > 0 ? cards : null;
  return {
    kind: day.kind, days: day.days, until: day.until, price: rupees(pricePaise), pricePaise,
    perDay: share(pricePaise, day.days),
    pace, mocks, questions,
    perMock: share(pricePaise, mocks),
    perQuestion: perQuestion(pricePaise, questions),
    cards: perDayCards ? { perDay: perDayCards, count: perDayCards * day.days, minutes: cardMinutes(perDayCards, minutesPerCard), bank } : null,
    // Pro's monthly credits for Mistake Repair and Ask Mobi (src/services/credits/aiCreditWallet.js AI_PRO_INCLUDED_MONTHLY_CREDITS,
    // passed in by the server): a fixed grant a month, never counted as unlimited; null when not passed.
    mobi: Number.isInteger(mobiCredits) && mobiCredits > 0 ? { credits: mobiCredits } : null,
  };
}

/** The mock paces the slider offers for this offer on this day: every pace that fills at least one whole mock, lowest first. */
export const mockPaces = (offer, { from } = {}) => MOCK_PACES.filter((pace) => planValue(offer, { from, pace }) !== null);
