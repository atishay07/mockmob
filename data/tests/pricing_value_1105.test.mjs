// Round 3 pricing on the home page (SPEC-R3 R3-D7, R3-D8, R3-D9; owner LK107, LK109-LK112, 5 Nov 2026), refined in round 4
// (SPEC-R4 H7 and /pricing; owner LK130-LK134, 5 Nov 2026 11:40 pm): the numbers band folded into the one plan, the plan as a glass
// card on its stage under a big "Pro" (shared with /pricing, where the last section is now "Free or Pro"), the value at the
// student's own pace (5 / 7 / 14 / 21 Full mocks a week, with the catch: a question costs a few paise) and the branded close band.
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
import { MOCK_PACES, DEFAULT_PACE, MONTH_DAYS, QUESTIONS_PER_MOCK, ceilTenPaise, perDay, perMock, perMockTable, perQuestion, asLowAs, daysBetween, rupees } from '../../src/lib/payments/value.mjs';
import { TEST_MODES } from '../test_modes.js';
import { PLAN_HOME, VALUE_COPY, CUET_PAPERS, paceWords, pricingHead, planGroups, freeLine, proPlan } from '../../src/components/landing/homeCopy.mjs';
import { PLAN_COPY, planTerms, compareRows, choiceLine } from '../../src/components/pricing/planOffer.mjs';
import { REFERRAL_COPY, INVITE_FIELD_HREF, INVITE_ANCHOR } from '../../src/lib/referrals/friendInvite.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => existsSync(new URL(`../../${rel}`, import.meta.url));
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const monthly = (rupeesPerMonth = 99) => ({ purchasable: 'monthly', monthly: { rupees: rupeesPerMonth }, oneTime: { rupees: 99, expires: '31 July 2027' } });
const oneTime = (rupeesOnce = 99, expires = '31 July 2027') => ({ purchasable: 'one_time', monthly: { rupees: 99 }, oneTime: { rupees: rupeesOnce, expires } });
const READ_DAY = new Date(Date.UTC(2026, 10, 5)); // 5 Nov 2026, the day rounds 3 and 4 were built

// The files that draw a price on the home page's #pricing, its close band and the shared plan card.
const PRICE_SOURCES = ['src/components/landing/HomePricing.jsx', 'src/components/landing/PlanValue.jsx',
  'src/components/landing/PlanCounts.jsx', 'src/components/landing/PlanFree.jsx', 'src/components/landing/CloseActions.jsx', 'src/components/pricing/PlanCard.jsx',
  'src/components/pricing/PlanStage.jsx', 'src/components/pricing/planOffer.mjs', 'src/components/landing/homeCopy.mjs', 'src/lib/payments/value.mjs', 'src/app/page.js'];
// The pricing pages and the pieces only they draw, and every sheet that styles a price (R4 review: the rival guard reads them all).
const PRICE_PAGES = ['src/app/pricing/page.js', 'src/app/pricing/ai-credits/page.js', 'src/components/ui/PricingCard.jsx', 'src/components/pricing/ProShowcase.jsx'];
const PRICE_SHEETS = ['src/app/home-pricing.css', 'src/components/pricing/plan-stage.css', 'src/app/pricing/pro-page.css'];
// The CUET-prep platforms the round 3 comparison named, and their peers: a floor; the source walk and the "vs" rules are the guard.
const RIVALS = /preparoo|adda ?247|oswaal|testbook|physics ?wallah|career ?launcher|unacademy|vedantu|byju|embibe|\btoppr\b|aakash|educart|arihant/i;

// ------------------------------------------------------------------------------------------------ computed, never typed
test('R4-H7: the paces are 5 / 7 / 14 / 21 Full mocks a week, one a day first, and every figure is price / (n x 30/7) rounded up', () => {
  assert.deepEqual([...MOCK_PACES], [5, 7, 14, 21], 'owner LK131: the lowest is 5 (one a week in each of five papers), the top three a day');
  assert.equal(DEFAULT_PACE, 7, 'one a day is selected first');
  assert.ok(MOCK_PACES.includes(DEFAULT_PACE));
  assert.equal(MONTH_DAYS, 30);
  const table = perMockTable(monthly());
  assert.deepEqual(table.map((row) => row.mocks), [21, 30, 60, 90]);
  assert.deepEqual(table.map((row) => row.about), ['₹4.80', '₹3.30', '₹1.70', '₹1.10']);
  for (const row of table) {
    // The formula, in paise, gives the same figure the page prints.
    assert.equal(row.aboutPaise, ceilTenPaise(9900 / row.mocks), `pace ${row.pace}`);
    assert.ok(row.aboutPaise >= row.exactPaise, 'rounded up, never down');
    assert.equal(row.price, '₹99');
  }
  // The owner's bar (LK131): even the lowest pace is under ₹10 a mock, and 5 a week is under ₹5 (spec R4-H7).
  assert.ok(table.every((row) => row.aboutPaise < 1000), 'every pace under ₹10 a mock');
  assert.ok(table[0].aboutPaise < 500, '5 a week is under ₹5 a mock');
  // The hero's "as low as" hook reads the control's top pace, so the two can never disagree (R4-H2).
  assert.deepEqual(asLowAs(monthly()), table[table.length - 1]);
  assert.equal(asLowAs(monthly()).about, '₹1.10');
});

test('change the offer and every figure follows it: nothing on the page is a typed rupee amount', () => {
  const dearer = perMockTable(monthly(149));
  assert.deepEqual(dearer.map((row) => row.about), dearer.map((row) => rupees(ceilTenPaise(Math.round(14900 / row.mocks)))));
  assert.notDeepEqual(dearer.map((row) => row.about), perMockTable(monthly()).map((row) => row.about));
  assert.deepEqual(dearer.map((row) => row.perQuestion.text), ['under 15 paise', 'under 10 paise', 'under 5 paise', 'under 4 paise']);
  assert.equal(perDay(monthly()).perDay, '₹3.30', '₹99 a month is about ₹3.30 a day');
  assert.equal(perDay(monthly(149)).perDay, '₹5');
  assert.equal(pricingHead(monthly()).sub, '₹99 a month is about ₹3.30 a day.');
  assert.equal(pricingHead(monthly(149)).sub, '₹149 a month is about ₹5 a day.');
  // No typed rupee amount in any file that draws the plan or its value (comments aside).
  for (const rel of PRICE_SOURCES) {
    assert.doesNotMatch(stripComments(read(rel)), /₹\s?\d/, `${rel} types a rupee amount`);
  }
});

test('the catch (R4-H7): a Full mock is 50 questions, so a question is "under N paise", N the next whole paisa above the exact figure', () => {
  assert.equal(QUESTIONS_PER_MOCK, TEST_MODES.full.fixedCount, 'the Full mock\'s own size, from the mode that builds it');
  assert.equal(QUESTIONS_PER_MOCK, 50);
  const table = perMockTable(monthly());
  assert.deepEqual(table.map((row) => row.questions), [1050, 1500, 3000, 4500], 'whole mocks x 50');
  assert.deepEqual(table.map(VALUE_COPY.question), ['Under 10 paise a question.', 'Under 7 paise a question.', 'Under 4 paise a question.', 'Under 3 paise a question.']);
  for (const row of table) {
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

test('what each pace means is said plainly: 5 is one a week in each of five CUET papers, the rest so many a day', () => {
  assert.equal(CUET_PAPERS, 5);
  assert.deepEqual(MOCK_PACES.map((pace) => paceWords(pace).short), ['1 per paper', '1 a day', '2 a day', '3 a day']);
  assert.deepEqual(MOCK_PACES.map((pace) => paceWords(pace).long), ['one a week in each of five CUET papers', 'one a day', 'two a day', 'three a day']);
  for (const pace of MOCK_PACES) assert.ok(paceWords(pace).short.length <= 12, `${pace}: fits under the number on a 360 px phone`);
  const value = read('src/components/landing/PlanValue.jsx');
  assert.match(value, /<small>\{paceWords\(r\.pace\)\.short\}<\/small>/, 'under each number in the control');
});

test('the maths is shown and checks out: what the pace comes to, then the division to the paisa, "rounded up" only when it was', () => {
  const [five, seven] = perMockTable(monthly());
  // "At ...": the month at this pace, never a promise or a cap (R4 review: the sheet's 90 rings are the top pace's month).
  assert.equal(VALUE_COPY.count(five), 'At one a week in each of five CUET papers: 21 Full mocks in a 30-day month, 1,050 questions.');
  assert.equal(VALUE_COPY.math(five), '₹99 ÷ 21 = ₹4.71, rounded up to ₹4.80.');
  assert.equal(VALUE_COPY.count(seven), 'At one a day: 30 Full mocks in a 30-day month, 1,500 questions.');
  assert.equal(VALUE_COPY.math(seven), '₹99 ÷ 30 = ₹3.30.');
  for (const r of perMockTable(monthly())) {
    assert.equal(Math.round((99 / r.mocks) * 100), r.exactPaise, `₹99 ÷ ${r.mocks} on a calculator`);
  }
});

test('the one-time offer gets its own sentences: days to its expiry, never "a month"', () => {
  assert.equal(daysBetween(READ_DAY, new Date(Date.UTC(2027, 6, 31))), 268);
  const row = perMock(oneTime(), 7, { from: READ_DAY });
  assert.equal(row.kind, 'once');
  assert.equal(row.mocks, 268, 'one a day for 268 days');
  assert.equal(VALUE_COPY.count(row), 'At one a day, to 31 July 2027: 268 Full mocks, 13,400 questions.');
  assert.equal(VALUE_COPY.math(row), '₹99 ÷ 268 = ₹0.37, rounded up to ₹0.40.');
  assert.equal(perMock(oneTime(), 7), null, 'without a date, no one-time figure (the page passes its build date)');
  assert.equal(perDay(oneTime(99, '1 November 2026'), { from: READ_DAY }), null, 'an expired one-time offer gives no figure');
});

test('a monthly price and a one-time price never share one sentence', () => {
  const sentences = (text) => String(text).split(/(?<=\.)\s+/);
  const rows = [...perMockTable(monthly()), ...perMockTable(oneTime(), { from: READ_DAY })];
  const lines = [
    pricingHead(monthly()).sub, pricingHead(oneTime()).sub,
    ...rows.flatMap((row) => [VALUE_COPY.count(row), VALUE_COPY.math(row), VALUE_COPY.question(row)]),
    ...Object.values(planTerms(monthly())), ...Object.values(planTerms(oneTime())),
  ].filter(Boolean);
  for (const line of lines) for (const sentence of sentences(line)) {
    assert.ok(!(/\bonce\b|one payment/i.test(sentence) && /a month|monthly/i.test(sentence)), sentence);
  }
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
  // The per-mock maths (and its month sheet) only for the current offer, where Full mocks are unlimited.
  assert.match(stripComments(read('src/components/landing/HomePricing.jsx')), /const table = newOffer \? \[\] : perMockTable\(offer, \{ from \}\);/);
});

// ------------------------------------------------------------------------------------------------ the one plan, shared
test('R3-D7: the numbers band is gone; its true counts are lines of the plan card with a count-up at 40% in view', () => {
  const page = stripComments(read('src/app/page.js'));
  assert.doesNotMatch(page, /lp-sec--tight|LiveStatsBand/);
  assert.ok(!existsSync(new URL('../../src/components/landing/LiveStatsBand.jsx', import.meta.url)), 'the band component left with the band');
  assert.doesNotMatch(read('src/app/landing.css'), /\.lp-sec--tight|\.lp \.mm-figures/);
  const groups = planGroups();
  assert.deepEqual(groups.map((g) => g.label), ['Practise', 'Review', 'Plan'], 'sentence-case group names, no caps');
  const counted = groups.flatMap((g) => g.lines).filter((line) => line.count).map((line) => line.count);
  assert.deepEqual(counted, ['bank', 'subjects'], 'the bank size and the subjects, from /api/stats');
  assert.deepEqual(groups.flatMap((g) => g.lines).filter((line) => line.text).map((line) => line.text).sort(), [...proPlan()].sort(), 'every Pro item, once');
  assert.equal(planGroups({ newOffer: true }).flatMap((g) => g.lines).filter((line) => line.text).length, proPlan({ newOffer: true }).length);
  const counts = read('src/components/landing/PlanCounts.jsx');
  assert.match(counts, /loadPublicStats\(\)/, 'the same /api/stats answer the hero reads');
  assert.match(counts, /useSeenOnce\(ref, 0\.4\)/, 'counts once at 40% in view');
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
  // Branch: the unlimited-mocks maths only while the current offer is the one on sale.
  assert.match(home, /const table = newOffer \? \[\] : perMockTable\(offer, \{ from \}\);/);
  // /pricing draws the same card on the same stage (R4, owner LK134: "refine it to how it is on the home page"), with its
  // grouped lines and the one checkout, as the last section's choice: Free under a quiet "Free", beside Pro.
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /import \{ PlanCard \} from '@\/components\/pricing\/PlanCard';/);
  assert.match(pricing, /import \{ PlanStage \} from '@\/components\/pricing\/PlanStage';/);
  assert.match(pricing, /import \{ PLAN_COPY, choiceLine, compareRows, planTerms \} from '@\/components\/pricing\/planOffer\.mjs';/);
  assert.match(pricing, /<PlanStage word=\{PRO_COPY\.words\.free\} className="pro-choice__free plan-stage--quiet">\s*<PricingCard \{\.\.\.FREE_PLAN\} \/>/);
  assert.match(pricing, /<PlanStage word=\{PRO_COPY\.words\.pro\} id="plans" className="pro-plan">/);
  assert.match(pricing, /<PlanCounts groups=\{planGroups\(\{ newOffer: newOfferReleased\(\) \}\)\} \/>\s*<div className="pro-plan__go">\s*<RazorpayPaymentButton/);
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

test('the glass is the plan card\'s only, with a solid fallback; R4: the card sits lower and the word holds in Day; never volt', () => {
  const css = read('src/components/pricing/plan-stage.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const glass = [...css.matchAll(/([^{}]+)\{([^{}]*backdrop-filter:[^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
  assert.ok(glass.length >= 2);
  for (const [selector, body] of glass) {
    assert.match(selector, /\.plan-stage \.plan-glass\.pro-plan__card$/, `glass only on the plan card: ${selector}`);
    assert.match(body, /backdrop-filter: (none|blur\((8|15)px\) saturate\(1\.4\))/);
  }
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

test('the pace control is a real control: native radios in a fieldset, 44 px keys, a focus ring, and the R3-D1 Day selected state', () => {
  const value = read('src/components/landing/PlanValue.jsx');
  assert.match(value, /<fieldset className="lp-seg">\s*<legend className="lp-seg__legend">\{VALUE_COPY\.pace\}<\/legend>/);
  assert.match(value, /<input type="radio" name=\{`\$\{id\}-pace`\} value=\{r\.pace\} checked=\{r\.pace === pace\} onChange=\{\(\) => setPace\(r\.pace\)\} \/>/);
  assert.match(value, /<div className="lp-value__read" aria-live="polite">/, 'a screen reader hears the new figure and the catch once');
  assert.match(value, /<b aria-hidden="true">\{rupees\(shown\)\}<\/b><span className="lp-sr">\{row\.about\}<\/span>/);
  assert.match(value, /<p className="lp-value__catch">\{VALUE_COPY\.question\(row\)\}<\/p>/);
  assert.match(value, /if \(reduced\(\)\)/, 'reduced motion changes the figure at once');
  assert.equal(VALUE_COPY.pace, 'Full mocks a week');
  const css = read('src/app/home-pricing.css');
  const keyHeight = Number(/\.lp \.lp-seg__opt span \{[^}]*min-height: (\d+)px/.exec(css)?.[1]);
  assert.ok(keyHeight >= 44, `each key is at least 44 px tall: ${keyHeight}`);
  assert.match(css, /\.lp \.lp-seg__opt input:focus-visible \+ span \{ outline: 2px solid var\(--focus-ring/);
  assert.match(css, /\.lp \.lp-seg__opt input:checked \+ span \{ background: var\(--volt\); color: var\(--volt-ink\); \}/, 'Night: a volt fill carrying dark ink');
  assert.match(css, /html\[data-theme='light'\] \.lp \.lp-seg__opt input:checked \+ span \{ background: #fffdf8; color: var\(--ink\); box-shadow: inset 0 0 0 1\.5px #526700; \}/, 'Day: paper, a 1.5 px green rim, ink');
});

test('the month as an answer sheet: one ring per Full mock of the top pace, filled to this pace, monthly only, decoration only, still under reduced motion', () => {
  const value = read('src/components/landing/PlanValue.jsx');
  assert.match(value, /const SHEET_MAX = 90;/);
  assert.equal(perMockTable(monthly()).at(-1).mocks, 90, '21 a week fills the sheet in a 30-day month');
  assert.match(value, /const sheet = row\.kind === 'monthly' && Number\.isInteger\(top\.mocks\) && top\.mocks <= SHEET_MAX \? top\.mocks : 0;/, 'one-time periods draw no sheet');
  assert.match(value, /<div className="lp-sheet" aria-hidden="true">/, 'the count line says it in words');
  assert.match(value, /<MonthSheet total=\{sheet\} filled=\{Math\.floor\(row\.mocks\)\} \/>/);
  const css = stripComments(read('src/app/home-pricing.css'));
  assert.match(css, /\.lp \.lp-sheet i\[data-on\] \{ background: var\(--brand-word\); border-color: var\(--brand-word\); \}/, 'filled marks read the brand word colour');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.lp \.lp-seg__opt span, \.lp \.lp-sheet i \{ transition: none; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.lp :is\(\.lp-seg__opt span, \.lp-sheet i\) \{ transition: none; \}/);
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
  const rows = [...perMockTable(monthly()), ...perMockTable(oneTime(), { from: READ_DAY })];
  const words = [
    ...Object.values(PLAN_HOME), VALUE_COPY.title, VALUE_COPY.pace, VALUE_COPY.result, VALUE_COPY.about,
    ...rows.flatMap((row) => [VALUE_COPY.count(row), VALUE_COPY.math(row), VALUE_COPY.question(row)]),
    ...MOCK_PACES.flatMap((pace) => [paceWords(pace).short, paceWords(pace).long]),
    ...planGroups().flatMap((g) => [g.label, ...g.lines.map((line) => line.text || `${line.rest} ${line.fallback}`)]),
    REFERRAL_COPY.homeInviteAsk, REFERRAL_COPY.homeInviteLink, REFERRAL_COPY.homeInviteReward(),
  ];
  for (const text of words) {
    assert.doesNotMatch(text, /[·•!]|→|->|\bunlock|seamless|supercharge|game-?changer|journey|cheapest/i, text);
    assert.doesNotMatch(text.replace(/\b(CUET|NTA)\b/g, ''), /\b[A-Z]{4,}\b/, `no capitals: ${text}`);
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
