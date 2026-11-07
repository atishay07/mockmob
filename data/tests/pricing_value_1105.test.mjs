// Round 3 pricing on the home page (SPEC-R3 R3-D7, R3-D8, R3-D9; owner LK107, LK109-LK112, 5 Nov 2026), refined in round 4
// (SPEC-R4 H7 and /pricing; owner LK130-LK134, 5 Nov 2026 11:40 pm): the numbers band folded into the one plan, the plan as a glass
// card on its stage under a big "Pro" (shared with /pricing, where the last section is now "Free or Pro"), the value at the
// student's own pace and the branded close band. Round 5 (owner, 6 Nov 2026: "There should be a slider for how many things a
// student can do") turned the four pace keys into one slider; its second take (owner, 6 Nov 2026: "a good direction, but it's a bit
// weird ... Full marks, 190, mistake lab 190, all but key cards ... How many key cards will you practice?" and "both should be
// equally visible"; docs/design-decisions/web-r5-value.md) made the block beside the Pro card a value plan: the price a day first,
// two questions in the student's own units (full mocks a week, Key cards a day), one answer line for each, no two sharing a
// number, and what else Pro holds without a number (src/lib/payments/receipt.mjs planValue). On /pricing, phones show Pro first:
// the two plans are one swipeable pair under a Pro | Free switch (src/components/pricing/PlanChoice.jsx).
// Round 4 removed the dated rival comparison (owner LK132: "how can you mention stuff like Preparoo ... we can't directly compare
// to them legally ... just remove this completely"); these tests now hold that it stays gone.
// These tests pin the owner's money rules, not the markup: every rupee figure is worked out from the offer
// (src/lib/payments/value.mjs), never typed; a monthly price and a one-time price never share a sentence; no rival is named;
// nothing says "cheapest".
// Source-level and pure, so no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_PACES, PACE, DEFAULT_PACE, MONTH_DAYS, QUESTIONS_PER_MOCK, aboutTenPaise, ceilTenPaise, paceWords, perDay, perMockTable, perQuestion, asLowAs, daysBetween, rupees } from '../../src/lib/payments/value.mjs';
import { CARD_PACE, CARD_PACES, SUBJECT_COUNT, USUAL_PRICES, cardMinutes, cardWords, cardsBank, mockPaces, planValue, usualWay, wholeMocks } from '../../src/lib/payments/receipt.mjs';
import { CREDIT_PACKS } from '../../src/services/credits/creditPacks.mjs';
import { keyCardsDemo } from '../../src/components/landing/keyCardsPicks.mjs';
import { heroPriceHook, heroFeatures } from '../../src/components/landing/heroTaps.mjs';
import { STRIP_OBJECTS } from '../../src/components/landing/stripObjects.mjs';
import { KEYCARD_RULES, cardMinutes as appCardMinutes } from '../keycards.js';
import { BRAND_ICONS } from '../brand_icons.mjs';
import { TEST_MODES } from '../test_modes.js';
import { PLAN_HOME, VALUE_COPY, paceWords as homePaceWords, cardWords as homeCardWords, pricingHead, planGroups, freeLine, proPlan, buildFaqs, buildTour } from '../../src/components/landing/homeCopy.mjs';
import { BANK_WORDS, KEY_CARDS_HEAD } from '../../src/components/landing/keyCardsCopy.mjs';
import { PLAN_COPY, planTerms, compareRows, choiceLine } from '../../src/components/pricing/planOffer.mjs';
import { REFERRAL_COPY, INVITE_FIELD_HREF, INVITE_ANCHOR } from '../../src/lib/referrals/friendInvite.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => existsSync(new URL(`../../${rel}`, import.meta.url));
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const monthly = (rupeesPerMonth = 99) => ({ purchasable: 'monthly', monthly: { rupees: rupeesPerMonth }, oneTime: { rupees: 99, expires: '31 July 2027' } });
const oneTime = (rupeesOnce = 99, expires = '31 July 2027') => ({ purchasable: 'one_time', monthly: { rupees: 99 }, oneTime: { rupees: rupeesOnce, expires } });
const READ_DAY = new Date(Date.UTC(2026, 10, 5)); // 5 Nov 2026, the day rounds 3 and 4 were built
const BUILD_DAY = new Date(Date.UTC(2026, 10, 6)); // 6 Nov 2026, the day of this round
// Days a reader may read the page on, to the end of the one-time term (the value card counts from the reader's own day).
const READ_DAYS = [READ_DAY, BUILD_DAY, new Date(Date.UTC(2026, 11, 31)), new Date(Date.UTC(2027, 2, 15)), new Date(Date.UTC(2027, 5, 1)), new Date(Date.UTC(2027, 6, 20)), new Date(Date.UTC(2027, 6, 29))];
// A Key cards bank as keyCardsDemo().bank gives it (the served decks on 6 Nov 2026: 16,458 cards in 14 subjects).
const BANK = Object.freeze({ cards: 16458, subjects: 14, taste: 5 });
const MIN = KEYCARD_RULES.minutesPerCard;
// Every value plan a reader can set: both offers, every reading day above, every mock pace and every Key cards pace.
const OFFER_DAYS = [[monthly(), BUILD_DAY], ...READ_DAYS.map((from) => [oneTime(), from])];
const everyPlan = () => OFFER_DAYS.flatMap(([offer, from]) => MOCK_PACES.flatMap((pace) => CARD_PACES.map((cards) => planValue(offer, { from, pace, cards, keyCards: BANK, minutesPerCard: MIN })))).filter(Boolean);
// The value card as it first draws (the sliders at their starts), with Key cards live.
const atStart = (offer, from = BUILD_DAY) => planValue(offer, { from, pace: PACE.start, cards: CARD_PACE.start, keyCards: BANK, minutesPerCard: MIN });

// The files that draw a price on the home page's #pricing, its close band and the shared plan card.
const PRICE_SOURCES = ['src/components/landing/HomePricing.jsx', 'src/components/landing/PlanValue.jsx', 'src/lib/payments/receipt.mjs',
  'src/components/landing/PlanCounts.jsx', 'src/components/landing/PlanFree.jsx', 'src/components/landing/CloseActions.jsx', 'src/components/pricing/PlanCard.jsx',
  'src/components/pricing/PlanStage.jsx', 'src/components/pricing/planOffer.mjs', 'src/components/landing/homeCopy.mjs', 'src/lib/payments/value.mjs', 'src/app/page.js'];
// The pricing pages and the pieces only they draw, and every sheet that styles a price (R4 review: the rival guard reads them all).
const PRICE_PAGES = ['src/app/pricing/page.js', 'src/app/pricing/ai-credits/page.js', 'src/components/ui/PricingCard.jsx', 'src/components/pricing/ProShowcase.jsx', 'src/components/pricing/PlanChoice.jsx'];
const PRICE_SHEETS = ['src/app/home-pricing.css', 'src/components/pricing/plan-stage.css', 'src/app/pricing/pro-page.css'];
// The CUET-prep platforms the round 3 comparison named, and their peers: a floor; the source walk and the "vs" rules are the guard.
const RIVALS = /preparoo|adda ?247|oswaal|testbook|physics ?wallah|career ?launcher|unacademy|vedantu|byju|embibe|\btoppr\b|aakash|educart|arihant/i;

// ------------------------------------------------------------------------------------------------ computed, never typed
test('round 5: one slider of Full mocks a week, 5 to 21 in steps of one, starting at its floor; every per-mock figure is price / (n x 30/7) rounded up', () => {
  assert.deepEqual({ ...PACE }, { min: 5, max: 21, step: 1, start: 7 }, 'owner LK131: the lowest is 5, the top three a day; one a day first');
  assert.deepEqual([...MOCK_PACES], Array.from({ length: 17 }, (_, i) => 5 + i), 'every whole pace from 5 to 21');
  assert.equal(DEFAULT_PACE, 7, 'one a day first (final pass)');
  assert.ok(MOCK_PACES.includes(DEFAULT_PACE));
  assert.equal(MONTH_DAYS, 30);
  const table = perMockTable(monthly());
  assert.equal(table.length, MOCK_PACES.length, 'every slider value has its row');
  const at = (pace) => table.find((row) => row.pace === pace);
  assert.deepEqual([5, 7, 14, 21].map((pace) => at(pace).mocks), [21, 30, 60, 90]);
  assert.deepEqual([5, 7, 14, 21].map((pace) => at(pace).about), ['₹4.80', '₹3.30', '₹1.70', '₹1.10']);
  for (const row of table) {
    // The formula, in paise, gives the same figure the page prints: the true division, rounded up (aboutTenPaise).
    assert.equal(row.aboutPaise, ceilTenPaise(9900 / row.mocks), `pace ${row.pace}`);
    assert.equal(row.aboutPaise, aboutTenPaise(9900, row.mocks));
    assert.ok(row.aboutPaise >= 9900 / row.mocks, 'rounded up, never down');
    assert.equal(row.price, '₹99');
    assert.equal(row.pricePaise, 9900);
  }
  // A faster pace never makes a mock dearer.
  for (let i = 1; i < table.length; i += 1) assert.ok(table[i].aboutPaise <= table[i - 1].aboutPaise, `pace ${table[i].pace}`);
  // The owner's bar (LK131): even the lowest pace is under ₹10 a mock, and 5 a week is under ₹5 (spec R4-H7).
  assert.ok(table.every((row) => row.aboutPaise < 1000), 'every pace under ₹10 a mock');
  assert.ok(table[0].aboutPaise < 500, '5 a week is under ₹5 a mock');
  // The hero's "as low as" hook reads the slider's top pace, so the two can never disagree (R4-H2).
  assert.deepEqual(asLowAs(monthly()), table[table.length - 1]);
  assert.equal(asLowAs(monthly()).about, '₹1.10');
});

test('one rule for every "about": the true division rounded up, so a day and a mock at one a day always read the same figure', () => {
  // Second take: perMock rounded to the paisa first and could sit up to half a paisa under the day's figure (9900 / 247 days is
  // 40.08 paise: a day read "₹0.50", a mock at one a day "₹0.40"). Now both take aboutTenPaise of the true division.
  for (let days = 2; days <= 400; days += 1) {
    const from = new Date(Date.UTC(2027, 6, 31) - days * 86400000);
    const day = perDay(oneTime(), { from });
    const plan = planValue(oneTime(), { from, pace: 7 });
    assert.equal(day.perDay, plan.perMock.about, `${days} days`);
    assert.equal(plan.perDay.about, day.perDay);
    assert.ok(day.perDayPaise >= 9900 / days);
  }
  assert.equal(aboutTenPaise(9900, 30), 330, 'exact stays exact');
  assert.equal(aboutTenPaise(9900, 247), 50, '40.08 paise is about ₹0.50, never ₹0.40');
});

test('change the offer and every figure follows it: nothing on the page is a typed rupee amount', () => {
  const dearer = perMockTable(monthly(149));
  assert.deepEqual(dearer.map((row) => row.about), dearer.map((row) => rupees(ceilTenPaise(14900 / row.mocks))));
  assert.notDeepEqual(dearer.map((row) => row.about), perMockTable(monthly()).map((row) => row.about));
  assert.deepEqual([5, 7, 14, 21].map((pace) => dearer.find((row) => row.pace === pace).perQuestion.text), ['under 15 paise', 'under 10 paise', 'under 5 paise', 'under 4 paise']);
  // The value plan follows the offer too: a dearer month makes each thing dearer.
  assert.notEqual(planValue(monthly(149), { pace: 7 }).perQuestion.text, planValue(monthly(), { pace: 7 }).perQuestion.text);
  assert.equal(planValue(monthly(149), { pace: 7 }).price, '₹149');
  assert.equal(planValue(monthly(149), { pace: 7 }).perDay.about, '₹5');
  assert.equal(perDay(monthly()).perDay, '₹3.30', '₹99 a month is about ₹3.30 a day');
  assert.equal(perDay(monthly(149)).perDay, '₹5');
  assert.equal(pricingHead(monthly()).sub, '₹99 a month is about ₹3.30 a day.');
  assert.equal(pricingHead(monthly(149)).sub, '₹149 a month is about ₹5 a day.');
  // No typed rupee amount in any file that draws the plan or its value (comments aside).
  for (const rel of PRICE_SOURCES) {
    assert.doesNotMatch(stripComments(read(rel)), /₹\s?\d/, `${rel} types a rupee amount`);
  }
});

test('the per-question rule (R4-H7): "under N paise", N the next whole paisa above the exact figure', () => {
  assert.equal(QUESTIONS_PER_MOCK, TEST_MODES.full.fixedCount, 'the Full mock\'s own size, from the mode that builds it');
  assert.equal(QUESTIONS_PER_MOCK, 50);
  const table = perMockTable(monthly());
  assert.deepEqual([5, 7, 14, 21].map((pace) => table.find((row) => row.pace === pace).questions), [1050, 1500, 3000, 4500], 'whole mocks x 50');
  for (const row of table) {
    assert.equal(row.questions, Math.floor(row.mocks) * QUESTIONS_PER_MOCK, `${row.pace}: whole mocks only`);
    assert.ok(row.perQuestion.exactPaise < row.perQuestion.paise, `${row.pace}: "under" only when it is under`);
    assert.ok(row.perQuestion.paise - row.perQuestion.exactPaise <= 1, `${row.pace}: the next whole paisa, never a looser bound`);
    assert.equal(row.perQuestion.exactPaise, 9900 / row.questions);
  }
  // An exact figure is said as it is; a rupee or more is rupees, rounded up like a mock.
  assert.deepEqual(perQuestion(500, 100), { exactPaise: 5, paise: 5, under: false, text: '5 paise' });
  assert.equal(perQuestion(100, 100).text, '1 paisa');
  assert.equal(perQuestion(25000, 100).text, 'about ₹2.50');
  assert.equal(perQuestion(9900, 0), null);
});

test('round 5: every value is said plainly: full mocks so many a day when the week divides by 7, else a week; Key cards so many a day', () => {
  assert.equal(homePaceWords, paceWords, 'one wording, shared by the slider, the value card and the hero hook');
  assert.equal(homeCardWords, cardWords);
  assert.deepEqual([5, 6, 7, 13, 14, 20, 21].map((pace) => paceWords(pace).long),
    ['5 full mocks a week', '6 full mocks a week', '1 full mock a day', '13 full mocks a week', '2 full mocks a day', '20 full mocks a week', '3 full mocks a day']);
  assert.deepEqual([PACE.min, PACE.max].map((pace) => paceWords(pace).short), ['5 a week', '3 a day'], 'the slider\'s two ends');
  for (const pace of MOCK_PACES) {
    const { long, short } = paceWords(pace);
    assert.match(long, /^\d+ full mocks? a (day|week)$/, `${pace}: a number, what, and how often`);
    assert.doesNotMatch(`${long} ${short}`, /per paper|paper/i, 'the words the owner could not read are gone');
    assert.ok(short.length <= 9, `${pace}: an end label fits under a 360 px track`);
  }
  assert.deepEqual({ ...CARD_PACE }, { min: 12, max: 60, step: 6, start: 24 });
  assert.deepEqual([...CARD_PACES], [12, 18, 24, 30, 36, 42, 48, 54, 60]);
  assert.deepEqual(cardWords(20), { long: '20 Key cards a day', short: '20 a day' });
  const value = read('src/components/landing/PlanValue.jsx');
});

// ------------------------------------------------------------------------------------------------ the value plan (second take)
test('second take: two questions in the student\'s own units, one answer line each, and no two lines ever share a number', () => {
  // The owner: "Full marks, 190, mistake lab 190, all but key cards". A mock's Lab read and chapter review are one sitting with
  // it, so they are said once, in words, on the mocks line; the questions are the mocks' own and sit on the same line.
  const plans = everyPlan();
  assert.equal(plans.length, OFFER_DAYS.length * MOCK_PACES.length * CARD_PACES.length, `every setting on every reading day: ${plans.length}`);
  for (const v of plans) {
    assert.equal(v.mocks, wholeMocks(v.pace, v.days), 'whole mocks, never rounded up');
    assert.equal(v.questions, v.mocks * QUESTIONS_PER_MOCK);
    assert.equal(v.cards.count, v.cards.perDay * v.days, 'the student\'s own Key cards a day, over the days the price pays for');
    assert.notEqual(v.mocks, v.cards.count, `${v.pace} a week, ${v.cards.perDay} cards: the two counted lines never match`);
    assert.ok(v.cards.count > v.mocks * 3, 'at most 3 full mocks a day, at least 10 Key cards: the lines cannot meet');
  }
  // The top of both sliders: the hero hook's figure, and the most cards.
  const top = planValue(oneTime(), { from: BUILD_DAY, pace: PACE.max, cards: CARD_PACE.max, keyCards: BANK, minutesPerCard: MIN });
  assert.deepEqual([top.mocks, top.questions, top.perMock.about, top.perQuestion.text, top.cards.count, top.cards.minutes], [801, 40050, '₹0.20', 'under 1 paisa', 16020, 15]);
  // Only a real, positive bank draws a Key cards question and line.
  for (const bad of [null, {}, { cards: 0, subjects: 14 }, { cards: 12.5, subjects: 3 }, { cards: '16458', subjects: 0 }, { cards: -3, subjects: 2 }]) {
    assert.equal(cardsBank(bad), null, JSON.stringify(bad));
    assert.equal(planValue(monthly(), { pace: 7, keyCards: bad }).cards, null);
  }
  // The real decks the home page reads (keyCardsPicks.mjs, at build): the card names exactly their cards.
  const real = keyCardsDemo({ log: () => {} })?.bank;
  if (real) {
    const live = planValue(oneTime(), { from: BUILD_DAY, keyCards: real, minutesPerCard: MIN });
    assert.deepEqual(live.cards.bank, { cards: real.cards, subjects: real.subjects });
  }
});

test('second take: the hero\'s "as low as" hook and the value card\'s top pace say the same per-mock figure on every reading day', () => {
  for (const [offer, from] of OFFER_DAYS) {
    const hook = heroPriceHook(offer, { from });
    const v = planValue(offer, { from, pace: PACE.max });
    if (!hook || !v) { assert.equal(hook, null); assert.equal(v, null); continue; }
    // Owner, 7 Nov 2026: from a rupee up the hook says the nearest whole rupee ("About ₹1"); under it, the card's own figure.
    const want = hook.lead === 'About' ? `₹${Math.round(Number(v.perMock.about.slice(1)))}` : v.perMock.about;
    assert.equal(hook.figure, want, `${offer.purchasable} ${from.toISOString().slice(0, 10)}`);
    assert.equal(hook.at, `at ${paceWords(PACE.max).long}`);
  }
});

test('second take: Key cards figures come from the bank, the student\'s own plan and the app\'s own 15 seconds a card', () => {
  assert.equal(MIN, 0.25, 'data/keycards.js: 15 seconds per card');
  for (const cards of CARD_PACES) assert.equal(cardMinutes(cards, MIN), appCardMinutes(cards), `${cards} a day: the app's own rounding`);
  assert.equal(cardMinutes(20, null), null, 'no rate, no minutes');
  // Pro has no daily cap on Key cards (reviews are uncapped and new cards only counted), so a day's number is the student's.
  const server = stripComments(read('src/lib/server/keycards.js'));
  assert.match(server, /p_review_limit: me\.isPro \? null : KEYCARD_RULES\.free\.reviewsPerDay, p_new_limit: me\.isPro \? PRO_NEW_COUNT_ONLY/);
  // The claims: Pro opens every card; a rated card comes back on its schedule (so the count is of cards turned, never learnt).
  assert.match(BANK_WORDS.free(5), /Pro every card\.$/);
  assert.match(KEY_CARDS_HEAD.h2, /comes back on time/);
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.doesNotMatch(stripComments(read('src/lib/payments/receipt.mjs')), /keycards\.js|ts-fsrs/, 'the browser module never pulls the scheduler in');
});

test('second take: the days left are counted from the reader\'s own day, so the card never overstates the mocks left', () => {
  // The home page is built once per release (static), so the server's day goes stale; the client recounts from its own day.
  let last = planValue(oneTime(), { from: READ_DAY, pace: 7 });
  for (const from of READ_DAYS.slice(1)) {
    const v = planValue(oneTime(), { from, pace: 7 });
    assert.ok(v.days < last.days && v.mocks <= last.mocks, `${from.toISOString().slice(0, 10)}: fewer days, never more mocks`);
    assert.ok(v.perDay.aboutPaise >= last.perDay.aboutPaise, 'a day never gets cheaper as the term runs down');
    last = v;
  }
  // Near the end a pace may fill no whole mock; the slider then starts at the first pace that does, and after the end nothing shows.
  assert.deepEqual(mockPaces(oneTime(), { from: new Date(Date.UTC(2027, 6, 30)) }), MOCK_PACES.filter((pace) => pace >= 7), 'one day left: one a day or more');
  assert.equal(planValue(oneTime(), { from: new Date(Date.UTC(2027, 6, 30)), pace: 5 }), null, 'one day at 5 a week is 0.7 of a mock');
  assert.deepEqual(mockPaces(oneTime(), { from: new Date(Date.UTC(2027, 6, 31)) }), []);
  assert.equal(planValue(oneTime(99, '1 November 2026'), { from: READ_DAY }), null, 'an expired one-time offer gives no figure');
  assert.equal(planValue(oneTime(), {}), null, 'without a date, no one-time figure (the page passes its build date)');
  const value = read('src/components/landing/PlanValue.jsx');
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.match(home, /const terms = \{ purchasable: offer\.purchasable, monthly: \{ rupees: offer\.monthly\?\.rupees \}, oneTime: \{ rupees: offer\.oneTime\?\.rupees, expires: offer\.oneTime\?\.expires \} \};/, 'only what the figures need reaches the browser, no plan ids');
});

test('final pass: what students usually pay, against Pro\'s own price a month, for the student\'s own subject count', () => {
  // The typical prices are the owner's own low estimates, in paise, never typed as rupees in a source, never a named platform.
  assert.deepEqual({ ...USUAL_PRICES }, { mockSeriesPaise: 50000, mockSeriesHighPaise: 100000, revisionPaise: 25000 });
  assert.deepEqual({ ...SUBJECT_COUNT }, { min: 1, max: 5, start: 5 }, 'owner, 7 Nov 2026: five first, as 99% of students take five');
  assert.equal(usualWay(monthly()).subjects, 5, 'the card opens on five subjects');
  const u = usualWay(monthly(), 4);
  assert.deepEqual([u.subjects, u.totalPaise, u.total, u.pro, u.kind], [4, 300000, '₹3,000', '₹99', 'monthly']);
  assert.deepEqual(u.lines.map((l) => [l.key, l.perSubject, l.totalPaise]), [['mocks', '₹500', 200000], ['revision', '₹250', 100000]]);
  assert.deepEqual([1, 2, 3, 5].map((s) => usualWay(monthly(), s).total), ['₹750', '₹1,500', '₹2,250', '₹3,750']);
  for (let s = 1; s <= 5; s += 1) {
    const w = usualWay(monthly(), s);
    assert.equal(w.share, 9900 / w.totalPaise, 'the bars are drawn to the true share');
    assert.equal(w.totalPaise, s * 75000);
  }
  assert.equal(usualWay(monthly(), 9).subjects, 5, 'at most five CUET subjects');
  assert.equal(usualWay(monthly(), 0).subjects, 1);
  assert.equal(usualWay(monthly(149), 4).pro, '₹149', 'Pro\'s price follows the offer');
  assert.equal(usualWay(oneTime(), 4).kind, 'once');
  assert.equal(usualWay({}, 4), null);
  // The words: Pro is always "a month" (never multiplied), the usual prices always "typical".
  assert.equal(VALUE_COPY.title, 'What students usually pay, and what you pay');
  assert.equal(VALUE_COPY.ask, 'How many CUET subjects are you taking?');
  assert.deepEqual(u.lines.map((l) => [VALUE_COPY.lines[l.key].name, VALUE_COPY.each(l)]), [['Mock test series', '₹500 a subject for 10 to 30 papers, typical'], ['Revision cards or books', '₹250 a subject, typical']]);
  assert.equal(VALUE_COPY.proPrice(u), '₹99 a month');
  assert.equal(VALUE_COPY.proPrice(usualWay(oneTime(), 4)), '₹99 once');
  assert.equal(VALUE_COPY.proLine({ keyCards: true }), 'Every subject, unlimited mocks, Mistake Lab, Key cards and Ask Mobi.');
  assert.equal(VALUE_COPY.proLine(), 'Every subject, unlimited mocks, Mistake Lab, Ask Mobi.');
  // Owner, 7 Nov 2026 (later that day): the punch line under the bars comes back, word for word as before.
  assert.deepEqual({ ...VALUE_COPY.punch(usualWay(monthly(), 5)) }, { usual: '₹3,750 the usual way.', pro: '₹99 a month here.' });
  assert.deepEqual({ ...VALUE_COPY.punch(u) }, { usual: '₹3,000 the usual way.', pro: '₹99 a month here.' });
  assert.equal(VALUE_COPY.punch(usualWay(oneTime(), 5)).pro, '₹99 once here.', 'a one-time price is said once, never a month');
  assert.equal(VALUE_COPY.footnote(), 'Typical prices: ₹500 a subject for a CUET mock series (₹500-1,000 is common) and ₹250 a subject for revision cards or a revision book. Yours may differ.');
  assert.equal(VALUE_COPY.live(u), '4 subjects: ₹3,000 the usual way, ₹99 a month on MockMob Pro.');
  for (const text of [VALUE_COPY.title, VALUE_COPY.ask, VALUE_COPY.footnote(), VALUE_COPY.live(u)]) {
    assert.doesNotMatch(text, /\d+ months|×|x \d|cheapest|[·•!]/, text);
  }
  for (const key of ['mocks', 'revision']) assert.ok(BRAND_ICONS[VALUE_COPY.lines[key].icon], key);
  const value = read('src/components/landing/PlanValue.jsx');
  assert.match(value, /aria-pressed=\{count === u\.subjects\}/, 'five large steps, native buttons');
  assert.match(value, /style=\{\{ '--w': u\.share \}\}/, 'Pro\'s bar at its true share');
  assert.match(value, /<\/div>\s*<p className="lp-usual__punch"><span>\{punch\.usual\}<\/span> <b>\{punch\.pro\}<\/b><\/p>\s*<p className="lp-usual__note">/, 'the punch line right under the bars, then the footnote');
  assert.match(read('src/app/home-pricing.css'), /\.lp \.lp-usual__step \{\s*min-height: 44px;/);
  assert.match(stripComments(read('src/components/landing/HomePricing.jsx')), /const value = newOffer \? null : usualWay\(terms\);/);
});

// ------------------------------------------------------------------------------------------------ owner, 7 Nov 2026 (the 95% pass)
test('7 Nov: the pricing head is centred at every width and its rate is one designed pill, built from parts that say the sub exactly', () => {
  const m = pricingHead(monthly());
  assert.equal(m.h2, 'Start free. Go Pro for unlimited mocks.', 'the headline\'s words are unchanged');
  assert.deepEqual(m.rate.map((p) => [p.text, p.figure, p.accent]), [['₹99', true, false], [' a month is about ', false, false], ['₹3.30', true, true], [' a day.', false, false]]);
  assert.equal(m.rateText, m.sub, 'the pill says the sub, word for word');
  assert.equal(m.note, null);
  assert.equal(pricingHead(monthly(149)).rate[2].text, '₹5', 'the day\'s figure follows the offer');
  const o = pricingHead(oneTime());
  // R8 PRICE-06 (LK175): the monthly line is said once, inside the card, so the head is the headline and the pill only.
  assert.equal(o.sub, '₹99 once covers Pro through 31 July 2027.', 'one-time: the pill alone');
  assert.equal(o.note, null);
  assert.equal(o.rateText, o.sub);
  assert.deepEqual(o.rate.filter((p) => p.figure).map((p) => p.text), ['₹99']);
  for (const head of [m, o]) assert.equal(head.rate.filter((p) => p.accent).length, 1, 'one accent in the pill');
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.match(home, /<p className="lp-price__rate">\s*<span className="lp-sr">\{head\.rateText\}<\/span>\s*<span aria-hidden="true">/, 'a screen reader hears the sentence once, whole');
  assert.match(home, /\{head\.note \? <p className="lp-price__soon">\{head\.note\}<\/p> : null\}/);
  assert.ok(home.indexOf('{seat}') < home.indexOf('<Reveal className="lp-head lp-price__head">'), 'Mobi\'s seat above the head');
  const css = stripComments(read('src/app/home-pricing.css'));
  assert.match(css, /\n\.lp \.lp-price__head \{[^}]*justify-items: center; text-align: center;/, 'centred at every width, outside any media query');
  assert.match(css, /\.lp \.lp-price__head \.lp-h2 \{[^}]*text-wrap: balance;/);
  assert.match(css, /\.lp \.lp-price__rate \{[^}]*padding: 8px 16px; border: 1px solid var\(--line-strong\); border-radius: 999px;/, 'a hairline pill');
  assert.match(css, /\.lp \.lp-price__fig \{[^}]*font-family: var\(--font-display\); font-weight: 800;/, 'the figures in the display face');
  assert.match(css, /\.lp \.lp-price__fig--accent \{ color: var\(--brand-word\); \}/, 'the day\'s figure in the one accent');
  // Mobi's seat as the head's eyebrow, in the flow and centred, his line a speech bubble (brand-pip.css; page.js passes the classes).
  const pip = stripComments(read('src/app/brand-pip.css'));
  assert.match(pip, /\.pip-seat\.pip-seat--eyebrow \{[^}]*margin: 0 0 12px;/);
  assert.match(pip, /\.pip-seat\.pip-seat--center \{ margin-inline: auto; justify-content: center; \}/);
  assert.ok(pip.indexOf('.pip-seat.pip-seat--center {') > pip.indexOf('.pip-seat.pip-seat--eyebrow {'), 'centring wins over the eyebrow\'s margin');
  assert.doesNotMatch((pip.match(/[^{}]*pip-seat--eyebrow[^{}]*\{[^}]*\}/g) || []).join('\n'), /(^|[\s;{])height:\s*0(px)?\s*[;}]/, 'never collapsed to nothing');
  assert.match(pip, /\.pip-seat\.pip-seat--eyebrow figcaption \{[^}]*border: 1px solid var\(--line-strong\);[^}]*background: var\(--paper-raised\);/, 'his line is a speech bubble');
  assert.match(pip, /\.pip-seat\.pip-seat--eyebrow figcaption::before \{[^}]*transform: rotate\(45deg\);/, 'with a tail pointing at him');
  assert.doesNotMatch((pip.match(/[^{}]*pip-seat--eyebrow[^{}]*\{[^}]*\}/g) || []).join('\n'), /gradient\(|backdrop-filter|box-shadow/, 'no glow, gradient or glass');
});

test('7 Nov: each Pro line marks its quantity or scope word like the counted numbers, on the home page and /pricing', () => {
  const textLines = (groups) => groups.flatMap((g) => g.lines).filter((l) => l.text);
  assert.deepEqual(Object.fromEntries(textLines(planGroups({ keyCards: true })).map((l) => [l.text, l.em])), {
    'Unlimited Quick practice and Full mock': 'Unlimited',
    'Smart practice and NTA mode': null,
    'Mistake Lab across all your mocks: every chapter, your pace and changed answers': 'every chapter',
    'Mistake Repair and Ask Mobi: 50 credits a month, all for Mobi': '50 credits a month',
    'Every Key card, with no daily review cap': 'Every Key card',
    'Unlimited saved questions': 'Unlimited',
    'Compass Pro: your practice mapped to your DU shortlist': null,
  });
  for (const line of [...textLines(planGroups()), ...textLines(planGroups({ newOffer: true }))]) {
    if (line.em) assert.ok(line.text.includes(line.em), `${line.text} holds ${line.em}`);
  }
  assert.ok(proPlan({ keyCards: true }).every((item) => typeof item === 'string'), 'the lists keep plain strings');
  const counts = stripComments(read('src/components/landing/PlanCounts.jsx'));
  assert.match(counts, /<b className="lp-count lp-count--word">\{line\.em\}<\/b>/, 'drawn like the counts');
  assert.match(counts, /: <WordLine line=\{line\} \/>/);
  assert.match(read('src/app/pricing/page.js'), /<PlanCounts groups=\{planGroups\(/, '/pricing draws the same lines, so it marks them too');
  assert.match(stripComments(read('src/components/pricing/plan-stage.css')), /\.plan-stage \.lp-count \{[^}]*font-family: var\(--font-display\);[^}]*color: var\(--brand-word\)/);
});

test('7 Nov: under Pro\'s price, everything that one price holds, as the features\' own desk objects and names', () => {
  assert.equal(VALUE_COPY.allIn(usualWay(monthly(), 5)), 'All in the same ₹99');
  assert.equal(VALUE_COPY.allIn(usualWay(monthly(149), 5)), 'All in the same ₹149', 'the price follows the offer');
  const all = ['Unlimited mocks', 'Mistake Lab', 'Score Recovery', 'Ask Mobi', 'Key cards', 'DU Compass'];
  assert.deepEqual(VALUE_COPY.features({ keyCards: true }).map((f) => f.name), all);
  assert.deepEqual(VALUE_COPY.features().map((f) => f.name), all.filter((name) => name !== 'Key cards'), 'Key cards only while they are live');
  // Each object is the hero strip's own for the same feature (heroFeatures), so a feature looks the same wherever it is named.
  const hero = Object.fromEntries(heroFeatures({ keyCards: true }).map((f) => [f.name, f.icon]));
  for (const f of VALUE_COPY.features({ keyCards: true })) {
    assert.ok(STRIP_OBJECTS[f.icon], `${f.icon} has a cut object`);
    assert.equal(hero[f.name], f.icon, `${f.name}: the hero's object`);
    if (f.em) assert.ok(f.name.includes(f.em));
  }
  assert.deepEqual(VALUE_COPY.features().filter((f) => f.em).map((f) => f.em), ['Unlimited']);
  const value = stripComments(read('src/components/landing/PlanValue.jsx'));
  assert.match(value, /VALUE_COPY\.features\(\{ keyCards \}\)\.map/);
  assert.match(value, /src=\{src\} srcSet=\{stripObjectSrcSet\(name\)\}/, 'the 3D objects, not line icons (owner LK160)');
  assert.match(value, /aria-labelledby=\{`\$\{id\}-all`\}/, 'the list is named by its label');
  assert.doesNotMatch(value, /lp-usual__pro-line/, 'the plain sentence gave way to the list');
  const css = stripComments(read('src/app/home-pricing.css'));
  assert.match(css, /\.lp \.lp-usual__feats \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'aligned columns, two on a phone');
  assert.match(css, /@container \(min-width: 25rem\) \{ \.lp \.lp-usual__feats \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \} \}/, 'three where the card has room');
});

test('a monthly price and a one-time price never share one sentence', () => {
  const sentences = (text) => String(text).split(/(?<=\.)\s+/);
  const plans = [...OFFER_DAYS.flatMap(([offer, from]) => [5, 7, 14, 21].map((pace) => planValue(offer, { from, pace, cards: 24, keyCards: BANK, minutesPerCard: MIN, credits: { packPaise: 4900, packCredits: 300, mockCredits: 50, freeCredits: 50 } })))].filter(Boolean);
  const lines = [
    pricingHead(monthly()).sub, pricingHead(oneTime()).sub,
    ...[1, 2, 3, 4, 5].flatMap((count) => [monthly(), oneTime()].map((o) => usualWay(o, count))).flatMap((u) => [VALUE_COPY.live(u), VALUE_COPY.proPrice(u), VALUE_COPY.usualTotal(u), `${VALUE_COPY.punch(u).usual} ${VALUE_COPY.punch(u).pro}`, VALUE_COPY.allIn(u)]),
    ...Object.values(planTerms(monthly())), ...Object.values(planTerms(oneTime())),
    pricingHead(monthly()).rateText, pricingHead(oneTime()).rateText, pricingHead(oneTime()).note,
  ].filter(Boolean);
  for (const line of lines) for (const sentence of sentences(line)) {
    assert.ok(!(/\bonce\b|one payment/i.test(sentence) && /a month|monthly/i.test(sentence)), sentence);
  }
  assert.equal(daysBetween(READ_DAY, new Date(Date.UTC(2027, 6, 31))), 268);
});

// ------------------------------------------------------------------------------------------------ the comparison is gone
test('R4-H7 (LK132): the rival comparison is gone with its table, its sources and its maths, and no rival is named on a pricing surface', () => {
  assert.ok(!exists('src/components/landing/PriceCompare.jsx'), 'the comparison component left');
  assert.ok(!exists('data/price_comparison_1105.mjs'), 'the dated rival table left');
  const value = read('src/lib/payments/value.mjs');
  assert.doesNotMatch(stripComments(value), /proToExam|monthsThrough/, 'the to-CUET totals only served the comparison');
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.doesNotMatch(home, /PriceCompare|PRICE_COMPARISON|proToExam|price_comparison/);
  assert.doesNotMatch(read('src/app/home-pricing.css'), /lp-cmp/);
  for (const rel of [...PRICE_SOURCES, ...PRICE_PAGES]) {
    assert.doesNotMatch(stripComments(read(rel)), RIVALS, `${rel} names another platform`);
    assert.doesNotMatch(stripComments(read(rel)), /\bPW\b/, `${rel} names another platform`);
    assert.doesNotMatch(stripComments(read(rel)), /5,?499|1,?168|549900|116800/, `${rel} keeps a rival price`);
  }
  // Nothing anywhere in the pricing sources claims to be the cheapest.
  for (const rel of [...PRICE_SOURCES, ...PRICE_PAGES, ...PRICE_SHEETS]) {
    assert.doesNotMatch(stripComments(read(rel)), /cheapest|lowest price|best price|best value/i, rel);
  }
});

// The names above are a floor, not the guard: a new rival, a rival's price or a comparison block must fail too (R4 review).
test('R4-H7 (LK132): no comparison with other platforms can come back: no rival in any rendered source, no "vs", no sources block, no typed price on /pricing but Free\'s ₹0', () => {
  // 1. Every rendered source (src/ and data/'s modules; tests and comments aside) is free of the CUET-prep names, so a rival
  //    cannot come back through a new file either. Research notes may name them in comments; pages never do.
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const rendered = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) { if (entry.name !== 'node_modules' && entry.name !== '__tests__' && !entry.name.startsWith('.')) walk(rel); }
      else if (/\.(m?js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) rendered.push(rel);
    }
  };
  walk('src');
  for (const name of readdirSync(join(root, 'data'))) if (/\.m?js$/.test(name)) rendered.push(`data/${name}`);
  assert.ok(rendered.length > 500, `the walk reached the sources: ${rendered.length}`);
  for (const rel of rendered) {
    const code = stripComments(read(rel));
    assert.doesNotMatch(code, RIVALS, `${rel} names another platform`);
    assert.doesNotMatch(code, /\bPW\b/, `${rel} names another platform`);
  }
  // 2. No pricing surface sets MockMob against anyone else: no "vs" or "versus", no "other prep / apps / platforms", no
  //    "elsewhere", no sources block or "prices as listed", and no comparison component or sheet class.
  for (const rel of [...PRICE_SOURCES, ...PRICE_PAGES]) {
    const code = stripComments(read(rel));
    assert.doesNotMatch(code, /\bvs\.?\s|\bversus\b/i, `${rel}: a "vs" comparison`);
    assert.doesNotMatch(code, /other (CUET )?(prep|platforms?|apps?|websites?|sites|test series|coaching)|elsewhere|compared? (with|to) other/i, `${rel}: a comparison with others`);
    assert.doesNotMatch(code, /\bsources?\s*:|prices? (checked|as listed)|as listed on|PriceCompare|PRICE_COMPARISON|price_comparison/i, `${rel}: a sources block or the comparison`);
  }
  for (const rel of PRICE_SHEETS) assert.doesNotMatch(stripComments(read(rel)), /\.lp-cmp\b|price-?compare|\.rival/i, rel);
  // 3. /pricing types one rupee amount only, Free's ₹0; every other figure comes from the offer, so no rival price can be typed in.
  for (const rel of PRICE_PAGES) {
    const typed = stripComments(read(rel)).match(/₹\s?\d[\d,.]*/g) || [];
    assert.ok(typed.every((amount) => amount === '₹0'), `${rel} types a rupee amount: ${typed.join(', ')}`);
  }
});

// ------------------------------------------------------------------------------------------------ the choice line, by offer
test('R4 /pricing: "Free or Pro" says unlimited mocks only while Pro\'s list does; the new offer says what it gives', () => {
  assert.equal(choiceLine(), 'Start on Free, no card needed. Go Pro for unlimited mocks.');
  assert.ok(proPlan().includes('Unlimited Quick practice and Full mock'), 'the current offer: Full mocks unlimited on Pro');
  assert.equal(compareRows().find(([name]) => name === 'Full mocks')[2], 'Unlimited');
  const next = choiceLine({ newOffer: true });
  assert.doesNotMatch(next, /unlimited mocks/i, 'the new offer does not promise unlimited mocks');
  assert.match(next, /unlimited practice and reattempts/);
  assert.ok(proPlan({ newOffer: true }).includes('Unlimited available practice and reattempts'), 'the new offer\'s own promise');
  const pricing = stripComments(read('src/app/pricing/page.js'));
  assert.match(pricing, /choiceLine: choiceLine\(\{ newOffer: newOfferReleased\(\) \}\),/, 'the page reads the line for the offer on sale');
  assert.doesNotMatch(pricing, /choiceLine: '/, 'never a typed line that could outlive the offer');
  // The value card only for the current offer, where Full mocks are unlimited.
});

// ------------------------------------------------------------------------------------------------ the one plan, shared
test('R3-D7: the numbers band is gone; its true counts are lines of the plan card with a count-up at 40% in view', () => {
  const page = stripComments(read('src/app/page.js'));
  assert.doesNotMatch(page, /lp-sec--tight|LiveStatsBand/);
  assert.ok(!existsSync(new URL('../../src/components/landing/LiveStatsBand.jsx', import.meta.url)), 'the band component left with the band');
  assert.doesNotMatch(read('src/app/landing.css'), /\.lp-sec--tight|\.lp \.mm-figures/);
  const groups = planGroups();
  assert.deepEqual(groups.map((g) => g.label), ['Practise', 'Fix', 'Revise', 'Plan'], 'sentence-case group names, no caps (owner, 7 Nov 2026: Fix and Revise)');
  const counted = groups.flatMap((g) => g.lines).filter((line) => line.count).map((line) => line.count);
  assert.deepEqual(counted, ['bank', 'subjects'], 'the bank size and the subjects, from /api/stats');
  assert.deepEqual(groups.flatMap((g) => g.lines).filter((line) => line.text).map((line) => line.text).sort(), [...proPlan()].sort(), 'every Pro item, once');
  assert.equal(planGroups({ newOffer: true }).flatMap((g) => g.lines).filter((line) => line.text).length, proPlan({ newOffer: true }).length);
  const counts = read('src/components/landing/PlanCounts.jsx');
  assert.match(counts, /loadPublicStats\(\)/, 'the same /api/stats answer the hero reads');
  // R8 PRICE-01: the first counted line is watched (60% in view), and a known number keeps the placeholder until it is seen.
  assert.match(counts, /useSeenOnce\(ref, 0\.6\)/, 'counts once its first counted line is 60% in view');
  assert.match(counts, /ref=\{line === firstCount \? ref : undefined\}/, 'the observer is on the first counted line');
  assert.match(counts, /if \(!seen\) return <><span className="lp-count lp-count--wait" aria-hidden="true" \/>/, 'never a false 0 before the count starts');
  assert.match(counts, /<b className="lp-count" aria-hidden="true">[\s\S]*<span className="lp-sr">\{value\.real/, 'a screen reader hears the real number, never a counting one');
  assert.match(counts, /if \(state === 'failed' \|\| \(state === 'ready' && value == null\)\) return line\.fallback;/, 'no number when the count cannot load');
  const stats = read('src/components/landing/bankStats.js');
  assert.match(stats, /data\.publicSubjectCount/, 'the subject count is the public one (never the stored total)');
  const hook = read('src/components/landing/useCountUp.js');
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /if \(done \|\| reducedMotion\(\)\) return target;/);
});

test('R3-D8, R4: #pricing and /pricing draw one plan, through shared pieces, as a glass card on its stage under "Pro" with its seal strip', () => {
  const home = stripComments(read('src/components/landing/HomePricing.jsx'));
  assert.match(home, /<PlanStage word=\{PLAN_HOME\.backdrop\} className="lp-price__stage">/);
  assert.match(home, /<PlanCard offer=\{offer\} titleAs="h3" titleId="lp-plan-title" className="lp-plan plan-glass" head=\{<ProSealStrip label=\{PLAN_COPY\.label\} \/>\}>/);
  assert.equal(PLAN_HOME.backdrop, 'Pro');
  const stage = read('src/components/pricing/PlanStage.jsx');
  assert.match(stage, /<p className="plan-stage__word" aria-hidden="true">\{word\}<\/p>/, 'the word is decoration');
  assert.match(stage, /import '\.\/plan-stage\.css';/);
  assert.match(home, /<Link href="\/pricing#plans" className="mm-btn mm-btn--primary">\{PLAN_COPY\.key\}<\/Link>/, 'Get Pro goes to the one checkout on /pricing');
  assert.equal(PLAN_COPY.plan, 'One plan, everything in it');
  assert.equal(PLAN_COPY.key, 'Get Pro');
  assert.doesNotMatch(home, /RazorpayPaymentButton/, 'no checkout on the home page');
  // Free is one quiet line with Start free, for a guest only.
  assert.equal(freeLine(), 'Or start on Free: 50 credits a month, no card needed.');
  assert.equal(freeLine({ firstFullMock: 'Your first full mock in every subject is free.' }), 'Or start on Free: 50 credits a month, no card needed. Your first full mock in every subject is free.');
  assert.match(read('src/app/page.js'), /firstFullMock=\{FIRST_FULL_MOCK_ON \? FIRST_FULL_MOCK_COPY\.plan : null\}/, 'the rule’s own sentence, only while it is on');
  assert.match(read('src/components/landing/PlanFree.jsx'), /\{isAuthenticated \? null : <Link href="\/signup" className="lp-plan__freekey">\{cta\}<\/Link>\}/);
  // Branch: the unlimited-mocks value card only while the current offer is the one on sale.
  assert.match(home, /const bank = cardsBank\(keyCards\);/, 'the served bank only (no stand-in left from a screenshot pass)');
  // /pricing draws the same card on the same stage (R4, owner LK134: "refine it to how it is on the home page"), with its
  // grouped lines and the one checkout, as the last section's choice: Free under a quiet "Free", beside Pro.
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /import \{ PlanCard \} from '@\/components\/pricing\/PlanCard';/);
  assert.match(pricing, /import \{ PlanStage \} from '@\/components\/pricing\/PlanStage';/);
  assert.match(pricing, /import \{ PLAN_COPY, choiceLine, compareRows, planTerms \} from '@\/components\/pricing\/planOffer\.mjs';/);
  assert.match(pricing, /<PlanStage word=\{PRO_COPY\.words\.free\} id="plan-free" className="pro-choice__free plan-stage--quiet">\s*<PricingCard \{\.\.\.FREE_PLAN\} \/>/);
  assert.match(pricing, /<PlanStage word=\{PRO_COPY\.words\.pro\} id="plans" className="pro-plan">/);
  assert.match(pricing, /<PlanCounts groups=\{planGroups\(\{ newOffer: newOfferReleased\(\), keyCards: process\.env\.KEY_CARDS_ENABLED === 'true' \}\)\} \/>\s*<div className="pro-plan__go">\s*<RazorpayPaymentButton/);
  assert.match(pricing, /choice: 'Free or Pro',/);
  assert.equal((pricing.match(/<RazorpayPaymentButton/g) || []).length, 1, 'one checkout');
  assert.doesNotMatch(pricing, /Or start free\.|mm-plans__note/, 'the old Free section folded into the choice');
  // While the choice is on screen it carries both keys, so the phone's dock steps aside (R4 review: it covered Free's card).
  assert.match(pricing, /<section className="pro-sec pro-choice" aria-labelledby="pro-choice-h" data-dock-yield="">/);
  assert.match(read('src/components/MobileDock.jsx'), /querySelectorAll\('main :is\(\.mm-btn--primary, \.btn-volt, \[data-dock-yield\]\)'\)/);
  assert.doesNotMatch(pricing, /function planTerms|\['Smart practice', false, true\]/, 'nothing is copied back into the page');
  assert.equal(compareRows({ newOffer: true, recoveryRows: [['x', true, true]] }).length, 1, 'the new offer brings its own rows');
  assert.deepEqual(planTerms(monthly()), { renew: 'Renews every month. Cancel any time.', dock: '₹99 a month. Cancel any time.', soon: null });
});

test('round 5 /pricing (owner: "Pro should be the first option"): Pro comes first, and on phones the two plans are one swipeable pair under a Pro | Free switch', () => {
  const pricing = stripComments(read('src/app/pricing/page.js'));
  assert.match(pricing, /import \{ PlanChoice \} from '@\/components\/pricing\/PlanChoice';/);
  // Pro's stage comes before Free's in the page, inside the choice, at every width.
  const choice = pricing.slice(pricing.indexOf('<PlanChoice '), pricing.indexOf('</PlanChoice>'));
  assert.match(choice, /^<PlanChoice label=\{PRO_COPY\.switchLabel\} options=\{\[\{ label: PRO_COPY\.words\.pro, controls: 'plans' \}, \{ label: PRO_COPY\.words\.free, controls: 'plan-free' \}\]\}>/);
  assert.ok(choice.indexOf('id="plans"') > 0 && choice.indexOf('id="plans"') < choice.indexOf('id="plan-free"'), 'Pro, then Free');
  assert.match(pricing, /switchLabel: 'Plans',/);
  const switcher = stripComments(read('src/components/pricing/PlanChoice.jsx'));
  assert.match(switcher, /^"use client";/);
  assert.match(switcher, /<div className="pro-switch" role="group" aria-label=\{label\} style=\{\{ '--on': shown \}\}>/);
  assert.match(switcher, /type="button" className="pro-switch__key"\s+aria-pressed=\{shown === index\} aria-controls=\{option\.controls\} onClick=\{\(\) => show\(index\)\} onKeyDown=\{\(event\) => onKey\(event, index\)\}>/);
  assert.match(switcher, /useState\(0\)/, 'Pro in view on arrival');
  assert.match(switcher, /event\.key !== 'ArrowLeft' && event\.key !== 'ArrowRight'/, 'the arrow keys move to the other plan');
  assert.match(switcher, /behavior: reduced\(\) \? 'auto' : 'smooth'/, 'at once under reduced motion');
  assert.match(switcher, /el\.addEventListener\('scroll', onMove, \{ passive: true \}\)/, 'the switch follows the swipe');
  assert.match(switcher, /<div className="pro-choice__grid" ref=\{rail\}>\{children\}<\/div>/);
  const css = stripComments(read('src/app/pricing/pro-page.css'));
  assert.match(css, /\.mm-pro \.pro-switch-row \{ display: none; \}/, 'no switch on tablets and desktops');
  const phone = css.slice(css.indexOf('@media (max-width: 759px) {\n  .mm-pro .pro-switch-row'));
  assert.match(phone, /\.mm-pro \.pro-choice__grid \{[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/, 'a swipeable rail');
  assert.match(phone, /\.mm-pro \.pro-choice__grid > \.plan-stage \{ flex: 0 0 min\(calc\(100% - 2\.75rem\), 36rem\); scroll-snap-align: start; scroll-snap-stop: always; \}/, 'the next card peeks');
  assert.match(phone, /\.mm-pro \.pro-switch__key \{[^}]*min-height: 44px;/, '44 px keys');
  assert.match(phone, /\.mm-pro \.pro-switch__key:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\); outline-offset: 3px; \}/, 'a visible focus ring');
  assert.match(phone, /html\[data-theme='light'\] \.mm-pro \.pro-switch::before \{[^}]*background: var\(--paper-raised\); border: 1px solid var\(--sel-rim\);/, 'Day: no volt slab on cream');
  assert.match(phone, /transition: transform 220ms cubic-bezier\(0\.23, 1, 0\.32, 1\);/);
  assert.match(css, /@media \(max-width: 759px\) and \(prefers-reduced-motion: reduce\) \{\s*\.mm-pro \.pro-switch::before, \.mm-pro \.pro-switch__key \{ transition: none; \}/);
  // R8 PRICE-10: tablets stack Pro first, like phones (no reordering under 960 px); desktops Free beside Pro on the left.
  assert.doesNotMatch(css, /\.mm-pro \.pro-choice__free \{ order: -1; \}/);
  assert.match(css, /@media \(min-width: 960px\) \{\s*\.mm-pro \.pro-choice__free \{ order: 0; grid-column: 1; grid-row: 1; \}\s*\.mm-pro \.pro-choice__grid > \.pro-plan \{ grid-column: 2; grid-row: 1; \}/);
  assert.doesNotMatch(css, /backdrop-filter|transition: all/);
});

test('the glass is the plan card\'s only, with a solid fallback; R4: the card sits lower and the word holds in Day; never volt', () => {
  const css = read('src/components/pricing/plan-stage.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const glass = [...css.matchAll(/([^{}]+)\{([^{}]*backdrop-filter:[^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
  assert.ok(glass.length >= 2);
  for (const [selector, body] of glass) {
    assert.match(selector, /\.plan-stage \.plan-glass\.pro-plan__card$/, `glass only on the plan card: ${selector}`);
    assert.match(body, /backdrop-filter: (none|blur\((8|15)px\) saturate\(1\.4\))/);
  }
  // R8 PRICE-05: the quiet word is drawn smaller and sits whole above its card (no glass on Free's card).
  assert.match(css, /\.plan-stage--quiet \.plan-stage__word \{ top: calc\(var\(--stage-word\) \* 0\.04\); font-size: calc\(var\(--stage-word\) \* 0\.74\); \}/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\) \{\s*\.plan-stage \.plan-glass\.pro-plan__card \{ background: var\(--paper-raised\); -webkit-backdrop-filter: none; backdrop-filter: none; \}/);
  assert.match(css, /\.plan-stage__word \{[^}]*color: var\(--price-word\)/);
  assert.doesNotMatch(css, /--price-word: [^;]*(d2f000|210, ?240|volt)/i);
  assert.doesNotMatch(css, /background-clip: text|text-shadow|@keyframes [\w-]*(sheen|shine|shimmer|glow|pulse)/i);
  // LK130: "make it a bit lower ... more of the Pro to be visible": the card starts at 64% of the word's size (R3: about 47%).
  const drop = Number(/\.plan-stage \{[^}]*padding-top: calc\(var\(--stage-word\) \* ([\d.]+)\)/.exec(css)?.[1]);
  assert.ok(drop >= 0.6, `the card starts low enough under the word: ${drop}`);
  // "In the light mode it's not properly visible": Day's word is ink at 66% (5.3:1 on the Day paper; Night's is 4.8:1).
  const dayAlpha = Number(/html\[data-theme='light'\] \.plan-stage \{[^}]*--price-word: rgba\(27, 25, 20, ([\d.]+)\)/.exec(css)?.[1]);
  assert.ok(dayAlpha >= 0.6, `Day word ink: ${dayAlpha}`);
  // The quiet "Free" beside it on /pricing stays well under Pro's ink in Day (R4 review: 0.3 read nearly as heavy as Pro's 0.66).
  const quietDay = Number(/html\[data-theme='light'\] \.plan-stage--quiet \{ --price-word: rgba\(27, 25, 20, ([\d.]+)\)/.exec(css)?.[1]);
  assert.ok(quietDay > 0 && quietDay <= dayAlpha / 3 + 0.001, `Day's quiet Free word: ${quietDay} against Pro's ${dayAlpha}`);
  // The page sheets carry no glass of their own.
  for (const rel of ['src/app/home-pricing.css', 'src/app/pricing/pro-page.css']) assert.doesNotMatch(stripComments(read(rel)), /backdrop-filter/, rel);
});

test('second take: the value card sits beside the plan card as its equal: level with its top, as tall, solid paper, and phones put it under the card', () => {
  const css = stripComments(read('src/app/home-pricing.css'));
  assert.match(css, /\.lp \.lp-val \{[^}]*border-radius: 28px; background: var\(--paper-raised\);/, 'the plan card\'s own corners, raised paper, no glass');
  assert.match(css, /@media \(min-width: 720px\) \{\s*\.lp \.lp-price__grid \{ --plan-word: 10rem; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); column-gap: 1\.5rem; align-items: start; \}/, 'two equal columns');
  assert.match(css, /\.lp \.lp-price__side \{ margin-top: calc\(var\(--plan-word\) \* 0\.64\); \}/, 'level with the card\'s top (the card starts at 64% of the word)');
  assert.match(css, /\.lp \.lp-price__side--full \{ align-self: stretch; display: flex; flex-direction: column; \}\s*\.lp \.lp-price__side--full \.lp-val \{ flex: 1 1 auto; \}/, 'with both questions, as tall as the card');
  assert.match(read('src/components/landing/HomePricing.jsx'), /<div className="lp-price__side lp-price__side--full">/, 'the feature stack fills the card with or without Key cards');
  // Owner, 7 Nov 2026: no empty bands when the card is stretched; the parts keep one steady gap and the footnote closes the card.
  assert.match(css, /\.lp \.lp-val \{\s*display: flex; flex-direction: column; gap: 1\.125rem;/, 'normal flow, one steady gap');
  assert.doesNotMatch(css.match(/\.lp \.lp-val \{[^}]*\}/)[0], /space-between|space-around|space-evenly/, 'the room never opens between the parts');
  assert.match(css, /\.lp \.lp-usual__note \{ margin: auto 0 0;/, 'the spare room goes above the footnote, the card\'s last line');
  const value = read('src/components/landing/PlanValue.jsx');
  assert.ok(value.lastIndexOf('lp-usual__note') > value.lastIndexOf('lp-usual__punch'), 'the footnote comes last of the visible parts');
  assert.match(css, /\.lp \.lp-price__stage,\s*\.lp \.lp-price__side \{ width: 100%; max-width: 30rem; margin-inline: auto; min-width: 0; \}/, 'phones: the card, then the value, one column');
  const home = read('src/components/landing/HomePricing.jsx');
  assert.ok(home.indexOf('<PlanStage') < home.indexOf('<PlanValue'), 'the card first in the page');
});

test('round 5: the questions are real sliders: labelled native ranges, 44 px tall, keyboard and screen reader ready, with a visible focus ring', () => {
  // Final pass: the card's one control is the subject count (five native buttons); the slider styles stay for reuse.
  const css = read('src/app/home-pricing.css');
  assert.match(css, /\.lp \.lp-val__range \{ --thumb: 28px; position: relative; height: 44px;/, 'a 44 px target');
  assert.match(css, /\.lp \.lp-val__range input \{[^}]*height: 44px;/);
  assert.match(css, /\.lp \.lp-val__range input:focus-visible::-webkit-slider-thumb \{ box-shadow: [^}]*var\(--focus-ring/, 'a visible focus ring (Chrome)');
  assert.match(css, /\.lp \.lp-val__range input:focus-visible::-moz-range-thumb \{ box-shadow: [^}]*var\(--focus-ring/, 'and Firefox');
  assert.match(css, /\.lp \.lp-val__fill \{[^}]*background: var\(--brand-word\);/, 'the one accent fills the track');
  assert.match(css, /::-webkit-slider-thumb \{[^}]*background: var\(--val-knob\);/, 'the knob is plain paper, so volt stays the key\'s and the fill\'s');
  assert.doesNotMatch(stripComments(css).match(/\.lp \.lp-val__(range|track|tick)[^{]*\{[^}]*\}/g).join(' '), /--volt\b|#d2f000|#9db400/i, 'no volt on the sliders but the fill (--brand-word)');
  assert.doesNotMatch(stripComments(css), /gradient\(|text-shadow|backdrop-filter|transition: all/, 'no gradient, glow or glass; never transition: all');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.lp \.lp-val__range input::-webkit-slider-thumb \{ transition: none; \}/);
});

// ------------------------------------------------------------------------------------------------ the close band
test('R3-D9: the final card keeps Sign up free and Log in, wears the answer sheet, and gives a guest one invite line only while invites are on', () => {
  const page = stripComments(read('src/app/page.js'));
  assert.match(page, /const INVITES_LIVE = referralsLive\(\);/, 'the server switch /signup reads');
  assert.match(page, /<CloseActions invites=\{INVITES_LIVE\} \/>/);
  assert.match(page, /<MascotSeat station="close" pose="celebrating"/, 'Mobi stays');
  const close = stripComments(read('src/components/landing/CloseActions.jsx'));
  assert.match(close, /\{invites && !isAuthenticated \? \(/, 'a guest, while invites are on');
  assert.match(close, /<Link href=\{INVITE_FIELD_HREF\} prefetch=\{false\}>\{REFERRAL_COPY\.homeInviteLink\}<\/Link>/);
  assert.doesNotMatch(close, /displayReferralCode|referralView|\/api\/referrals|referralLink\(/, 'never a code on a guest page');
  assert.equal(INVITE_FIELD_HREF, '/signup#invite-code');
  const field = read('src/components/referrals/InviteCodeField.jsx');
  assert.match(field, /id=\{INVITE_ANCHOR\}/, 'the sign-up page has the anchor');
  assert.match(field, /window\.location\.hash === `#\$\{INVITE_ANCHOR\}`\) setOpen\(true\)/, 'and the link opens the field');
  assert.equal(INVITE_ANCHOR, 'invite-code');
  const words = [REFERRAL_COPY.homeInviteAsk, REFERRAL_COPY.homeInviteLink, REFERRAL_COPY.homeInviteReward()].join(' ');
  assert.equal(words, 'Have a friend’s invite code? Add it when you sign up You both get 100 credits once you finish one practice.');
});

// ------------------------------------------------------------------------------------------------ copy rules on the new words
test('the new pricing words follow the copy rules: no middle dots, no "!", no hype, sentence case, and the section sub fits its budget', () => {
  const plans = OFFER_DAYS.flatMap(([offer, from]) => [5, 7, 13, 21].map((pace) => planValue(offer, { from, pace, cards: 42, keyCards: BANK, minutesPerCard: MIN }))).filter(Boolean);
  const words = [
    ...Object.values(PLAN_HOME), VALUE_COPY.ask,
    ...[1, 2, 3, 4, 5].flatMap((count) => [monthly(), oneTime()].map((o) => usualWay(o, count))).flatMap((u) => [VALUE_COPY.live(u), VALUE_COPY.proPrice(u), VALUE_COPY.usualTotal(u)]),
    VALUE_COPY.footnote(), VALUE_COPY.title, VALUE_COPY.proLine({ keyCards: true }),
    ...[monthly(), oneTime()].map((o) => usualWay(o, 5)).flatMap((u) => [VALUE_COPY.allIn(u), VALUE_COPY.punch(u).usual, VALUE_COPY.punch(u).pro]),
    ...VALUE_COPY.features({ keyCards: true }).map((f) => f.name),
    ...[monthly(), oneTime()].flatMap((o) => [...pricingHead(o).rate.map((p) => p.text), pricingHead(o).note]),
    ...MOCK_PACES.flatMap((pace) => [paceWords(pace).short, paceWords(pace).long]),
    ...CARD_PACES.flatMap((cards) => [cardWords(cards).short, cardWords(cards).long]),
    ...planGroups().flatMap((g) => [g.label, ...g.lines.map((line) => line.text || `${line.rest} ${line.fallback}`)]),
    REFERRAL_COPY.homeInviteAsk, REFERRAL_COPY.homeInviteLink, REFERRAL_COPY.homeInviteReward(), 'Plans',
  ].filter(Boolean);
  for (const text of words) {
    assert.doesNotMatch(text, /[·•!]|→|->|\bunlock|seamless|supercharge|game-?changer|journey|cheapest|amazing|incredible|insane/i, text);
    assert.doesNotMatch(text.replace(/\b(CUET|NTA|SWOT|DU)\b/g, ''), /\b[A-Z]{4,}\b/, `no capitals: ${text}`);
  }
  assert.ok(pricingHead(monthly()).sub.split(/\s+/).length <= 20);
});

test('every home source that the pricing section reaches is on the landing\'s file walk (so the landing-wide rules check it)', () => {
  const landing = readdirSync(new URL('../../src/components/landing/', import.meta.url));
  for (const f of ['HomePricing.jsx', 'PlanCounts.jsx', 'PlanFree.jsx', 'PlanValue.jsx', 'useCountUp.js']) assert.ok(landing.includes(f), f);
  assert.ok(!landing.includes('PriceCompare.jsx'));
  assert.match(read('src/app/page.js'), /import \{ HomePricing \} from '@\/components\/landing\/HomePricing';/);
  assert.match(read('src/components/landing/HomePricing.jsx'), /import '@\/app\/home-pricing\.css';/);
});
