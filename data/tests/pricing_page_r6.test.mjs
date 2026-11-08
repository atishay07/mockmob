// /pricing, round 6 (owner, 7 Nov 2026): "after the screen where it's written 'Also in Pro', move the Free or Pro pricing section
// above the Free and Pro side-by-side. Below that, keep a more detailed value indicator than the homepage one ... and then we can
// have the comparison table"; "the default should be 5 only, because 99% of students are taking 5 subjects"; and the line he missed,
// "₹3,000 the usual way, ₹99 a month here". The value section is src/components/pricing/PricingValue.jsx, its words and figures
// src/components/pricing/pricingValueCopy.mjs.
// These tests pin the order of the page, the two controls' starts, the punch line, the owner's money rules (every figure from
// receipt.mjs and value.mjs, never typed; a monthly and a one-time price never share a sentence; nobody else named or set against
// MockMob) and the copy and interface rules. Source-level and pure, so no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOCK_PACES, PACE, paceWords, rupees } from '../../src/lib/payments/value.mjs';
import { SUBJECT_COUNT, USUAL_PRICES, planValue, usualWay } from '../../src/lib/payments/receipt.mjs';
import { BRAND_ICONS } from '../brand_icons.mjs';
import { PLAN_COPY } from '../../src/components/pricing/planOffer.mjs';
import { PLAN_HOME, PRO_MOBI_CREDITS, VALUE_COPY } from '../../src/components/landing/homeCopy.mjs';
import {
  PACE_STEPS, PRICING_VALUE as C, SUBJECT_STEPS, VALUE_START, paceFigures, paceStep, paceSteps, plainTerms, valueShown, valueTiles,
} from '../../src/components/pricing/pricingValueCopy.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const PAGE = 'src/app/pricing/page.js';
const COMPONENT = 'src/components/pricing/PricingValue.jsx';
const COPY = 'src/components/pricing/pricingValueCopy.mjs';
const SHEET = 'src/components/pricing/pricing-value.css';

const monthly = (rupeesAMonth = 99) => ({ purchasable: 'monthly', monthly: { rupees: rupeesAMonth }, oneTime: { rupees: 99, expires: '31 July 2027' } });
const oneTime = (rupeesOnce = 99, expires = '31 July 2027') => ({ purchasable: 'one_time', monthly: { rupees: 99 }, oneTime: { rupees: rupeesOnce, expires } });
// Days a reader may read the page on, to the end of the one-time term (one-time figures count the days left from the reader's day).
const DAYS = [new Date(Date.UTC(2026, 10, 7)), new Date(Date.UTC(2027, 0, 15)), new Date(Date.UTC(2027, 5, 1)), new Date(Date.UTC(2027, 6, 20)), new Date(Date.UTC(2027, 6, 29))];
const OFFER_DAYS = [[monthly(), DAYS[0]], [monthly(149), DAYS[0]], ...DAYS.map((from) => [oneTime(), from])];

// ------------------------------------------------------------------------------------------------ the order of the page
test('round 6: hero, what Pro unlocks, Also in Pro, then Free or Pro, then the value section, then the table, credits and questions', () => {
  const page = stripComments(read(PAGE));
  const at = (needle) => {
    const i = page.indexOf(needle);
    assert.ok(i > 0, `the page draws ${needle}`);
    return i;
  };
  const order = [
    'className="pro-hero"', 'id="pro-unlocks-h"', 'id="pro-also-h"', 'id="pro-choice-h"', '<PlanChoice ', 'id="plans"', 'id="plan-free"',
    '<PricingValue', 'id="compare"', 'Ask Mobi, on the same credits.', 'Questions people actually ask.',
  ].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'each section after the one before');
  // The choice is unchanged inside: Pro's stage keeps id="plans" (the dock, the hero key and the Upgrade sheet land on it).
  assert.match(page, /<PlanStage word=\{PRO_COPY\.words\.pro\} id="plans" className="pro-plan">/);
  assert.match(page, /<MobileDock note=\{terms\.dock\} label=\{PRO_COPY\.key\} href="#plans"/);
  assert.match(page, /<a className="mm-btn mm-btn--primary" href="#plans">\{PRO_COPY\.key\}<\/a>/);
  // JSON-LD stays.
  assert.match(page, /id="pricing-breadcrumb-json-ld"/);
  assert.match(page, /id="pricing-faq-json-ld"/);
});

test('round 6: the value section is drawn from the plain offer, skipped on the new offer or without a price, and its keys go to #plans and to sign-up', () => {
  const page = stripComments(read(PAGE));
  assert.match(page, /const valueTerms = plainTerms\(offer\);/);
  assert.match(page, /const showValue = valueShown\(valueTerms, \{ newOffer: newOfferReleased\(\) \}\);/);
  assert.match(page, /\{showValue \? \(\s*<PricingValue/);
  const tag = page.slice(page.indexOf('<PricingValue'), page.indexOf('/>', page.indexOf('<PricingValue')));
  assert.match(tag, /offer=\{valueTerms\}/);
  assert.match(tag, /keyCards=\{process\.env\.KEY_CARDS_ENABLED === 'true'\}/);
  assert.match(tag, /mob=\{Boolean\(mob\)\}/, 'hosting a Mob only while the Mob is live (mobRows)');
  assert.match(tag, /freeHref=\{FREE_PLAN\.ctaHref\}/, 'Start free goes where the Free card goes');
  assert.match(tag, /proHref="#plans"/);
  assert.match(tag, /actions=\{!isCurrentUserPremium\}/, 'a student on Pro is not asked to get Pro');
  assert.match(page, /ctaHref: '\/signup',/);
  // The skip rule.
  assert.equal(valueShown(plainTerms(monthly())), true);
  assert.equal(valueShown(plainTerms(oneTime())), true);
  assert.equal(valueShown(plainTerms(monthly()), { newOffer: true }), false, 'the new offer does not promise unlimited mocks');
  assert.equal(valueShown(plainTerms({ purchasable: 'monthly', monthly: { rupees: 0 }, oneTime: {} })), false, 'no price, no section');
  assert.deepEqual(plainTerms(monthly()), { purchasable: 'monthly', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } });
  // The section's own frame.
  const component = stripComments(read(COMPONENT));
  assert.match(component, /^"use client";/);
  assert.match(component, /<section className="pro-sec pro-val" id="value" aria-labelledby="pro-val-h" data-commerce="">/);
  assert.match(component, /<h2 className="pro-h2" id="pro-val-h">\{C\.title\}<\/h2>/);
  assert.match(component, /<a className="mm-btn mm-btn--primary" href=\{proHref\}>\{C\.getPro\}<\/a>/);
  assert.match(component, /<Link className="mm-btn mm-btn--secondary" href=\{freeHref\}>\{C\.startFree\}<\/Link>/);
  assert.equal(C.getPro, PLAN_COPY.key, 'D185: the key says Get Pro');
  assert.equal(C.startFree, PLAN_HOME.freeCta);
});

// ------------------------------------------------------------------------------------------------ the two controls
test('round 6: 5 CUET subjects first (owner: "99% of students are taking 5"), and one full mock a day first', () => {
  assert.deepEqual({ ...VALUE_START }, { subjects: 5, pace: 7 });
  assert.equal(VALUE_START.subjects, SUBJECT_COUNT.max, 'the most CUET UG allows');
  assert.equal(VALUE_START.pace, PACE.start);
  assert.deepEqual([...SUBJECT_STEPS], [1, 2, 3, 4, 5]);
  assert.deepEqual([...PACE_STEPS], [5, 7, 14, 21]);
  for (const pace of PACE_STEPS) assert.ok(MOCK_PACES.includes(pace), `${pace} is a pace value.mjs knows`);
  const component = stripComments(read(COMPONENT));
  assert.match(component, /useState\(VALUE_START\.subjects\)/);
  assert.match(component, /useState\(VALUE_START\.pace\)/);
  assert.match(component, /aria-pressed=\{count === u\.subjects\}/);
  assert.match(component, /aria-pressed=\{p === at\}/);
  assert.equal(C.askSubjects, 'How many CUET subjects are you taking?');
  assert.equal(C.askPace, 'Full mocks a week');
});

test('round 6: each pace key says its pace plainly, from value.mjs paceWords, never "per paper"', () => {
  assert.deepEqual(PACE_STEPS.map((pace) => paceStep(pace).sub), ['a week', '1 a day', '2 a day', '3 a day']);
  assert.deepEqual(PACE_STEPS.map((pace) => paceStep(pace).label), ['5', '7', '14', '21']);
  for (const pace of PACE_STEPS) {
    const step = paceStep(pace);
    assert.ok(paceWords(pace).short.endsWith(step.sub), `${pace}: the words are paceWords' own`);
    assert.ok(step.aria.startsWith(`${pace} full mocks a week`), `${pace}: the key's name starts with the number it shows (WCAG 2.5.3)`);
    if (step.sub !== 'a week') assert.ok(step.aria.includes(step.sub), `${pace}: the name also says "${step.sub}"`);
    assert.doesNotMatch(`${step.label} ${step.sub} ${step.aria}`, /paper/i);
  }
  // A one-time offer near its end keeps only the paces that still give a whole mock.
  const last = new Date(Date.UTC(2027, 6, 30));
  assert.deepEqual(paceSteps(oneTime(), { from: last }), [7, 14, 21], 'one day left: 5 a week gives no whole mock');
  assert.deepEqual(paceSteps(monthly()), [5, 7, 14, 21]);
});

// ------------------------------------------------------------------------------------------------ the receipt and the punch line
test('round 6: the punch line is back: "{the usual total} the usual way. {Pro\'s price} a month here."', () => {
  const u = usualWay(monthly(), VALUE_START.subjects);
  assert.deepEqual(C.punch(u), { usual: '₹3,750 the usual way.', rest: 'the usual way.', pro: '₹99 a month here.' }, 'at 5 subjects and ₹99');
  for (const [offer] of OFFER_DAYS) {
    for (const count of SUBJECT_STEPS) {
      const w = usualWay(offer, count);
      const punch = C.punch(w);
      assert.equal(punch.usual, `${w.total} ${punch.rest}`);
      assert.equal(w.totalPaise, count * (USUAL_PRICES.mockSeriesPaise + USUAL_PRICES.revisionPaise));
      assert.equal(punch.pro, offer.purchasable === 'monthly' ? `${rupees(offer.monthly.rupees * 100)} a month here.` : `${rupees(offer.oneTime.rupees * 100)} once here.`);
      assert.equal(punch.pro, VALUE_COPY.punch(w).pro, 'the same wording as the home card');
    }
  }
  const component = stripComments(read(COMPONENT));
  assert.match(component, /<p className="pro-val__punch">/);
  assert.match(component, /<b>\{punch\.pro\}<\/b>/, 'the Pro part in its own element (the brand word colour)');
  assert.match(read(SHEET), /\.pro-val \.pro-val__punch b \{ font-weight: 800; color: var\(--brand-word\); \}/);
  assert.match(read(SHEET), /\.pro-val \.pro-val__punch \{[^}]*font-family: var\(--font-display\);[^}]*font-size: clamp\(/, 'large, in the display face');
});

test('round 6: the receipt says the usual way per subject, its total and Pro\'s own price, every figure from receipt.mjs usualWay', () => {
  const u = usualWay(monthly(), 5);
  assert.deepEqual(u.lines.map((line) => C.each(line)), [`${rupees(USUAL_PRICES.mockSeriesPaise)} a subject for 10 to 30 papers, typical`, `${rupees(USUAL_PRICES.revisionPaise)} a subject, typical`]);
  assert.deepEqual(u.lines.map((line) => C.each(line)), u.lines.map((line) => VALUE_COPY.each(line)), 'the home card says the same');
  assert.equal(C.totalLabel(u), 'For 5 subjects');
  assert.equal(C.totalLabel(usualWay(monthly(), 1)), 'For 1 subject');
  assert.equal(C.proPrice(u), '₹99 a month');
  assert.equal(C.proPrice(usualWay(oneTime(), 5)), '₹99 once');
  assert.equal(C.alsoHead(u), 'Also in the same ₹99');
  assert.equal(C.footnote(), VALUE_COPY.footnote(), 'the typical prices, said the home card\'s way');
  for (const key of ['mocks', 'revision']) assert.ok(BRAND_ICONS[C.lines[key].icon], `${key}: a desk object`);
  const component = stripComments(read(COMPONENT));
  assert.match(component, /const u = usualWay\(offer, subjects\);/);
  assert.match(component, /style=\{\{ '--w': u\.share \}\}/, 'Pro\'s bar drawn to its true share');
  // The total rolls (280 ms ease-out), at once under reduced motion.
  assert.match(component, /function useRoll\(target, duration = 280\)/);
  assert.match(component, /document\.documentElement\.dataset\.motion === 'reduced'/);
  assert.match(component, /prefers-reduced-motion: reduce/);
});

// ------------------------------------------------------------------------------------------------ at your pace
test('round 6: a mock, a question and a day at the chosen pace are receipt.mjs planValue\'s own figures, for every offer, day and pace', () => {
  let seen = 0;
  for (const [offer, from] of OFFER_DAYS) {
    for (const pace of paceSteps(offer, { from })) {
      const v = planValue(offer, { from, pace });
      assert.ok(v, `${pace} gives a figure`);
      const [mock, question, day] = paceFigures(v);
      assert.equal(mock.value, v.perMock.about);
      assert.equal(mock.pre, v.perMock.exact ? '' : 'About', 'never "about" an exact figure');
      assert.equal(day.value, v.perDay.about);
      assert.equal(day.pre, v.perDay.exact ? '' : 'About');
      assert.equal(question.text, `${v.perQuestion.text} a question`, 'the question figure in value.mjs perQuestion\'s own words');
      assert.equal(mock.unit, 'a mock');
      assert.equal(day.unit, 'a day');
      assert.match(question.unit, /a question$/);
      assert.equal(C.paceMaths(v), `${paceWords(pace).long.replace(/^./, (c) => c.toUpperCase())}: ${v.mocks.toLocaleString('en-IN')} full mocks and ${v.questions.toLocaleString('en-IN')} questions ${offer.purchasable === 'monthly' ? `in ${v.days} days` : `by ${offer.oneTime.expires.replace(/ /g, ' ')}`}.`, 'R8 PRICE-17: the date never splits');
      seen += 1;
    }
  }
  assert.ok(seen >= 25, `every offer, day and pace: ${seen}`);
  // At the start on the monthly offer: one full mock a day.
  const start = paceFigures(planValue(monthly(), { pace: VALUE_START.pace }));
  assert.deepEqual(start.map((f) => f.text), ['₹3.30 a mock', 'under 7 paise a question', '₹3.30 a day']);
  // R8 PRICE-17: with the student's subjects, one a day's repeated figure becomes what Pro comes to a subject (three measures).
  const withSubjects = paceFigures(planValue(monthly(), { pace: VALUE_START.pace }), { subjects: 5 });
  assert.deepEqual(withSubjects.map((f) => f.text), ['₹3.30 a mock', 'under 7 paise a question', '₹19.80 a subject']);
  for (const [offer, from] of OFFER_DAYS) {
    for (const pace of paceSteps(offer, { from })) {
      for (const subjects of SUBJECT_STEPS) {
        const v = planValue(offer, { from, pace });
        const [mock, , third] = paceFigures(v, { subjects });
        if (v.mocks !== subjects) assert.notEqual(third.value, mock.value, `three different figures at ${pace} a week, ${subjects} subjects`);
      }
    }
  }
  assert.match(stripComments(read(COMPONENT)), /const figures = paceFigures\(v, \{ subjects: u\.subjects \}\);/);
  assert.equal(C.seriesLine, 'A test series stops at its last paper. Pro builds a new one every time you start.');
  const component = stripComments(read(COMPONENT));
  assert.match(component, /const v = at \? planValue\(offer, \{ from: day, pace: at \}\) : null;/);
});

test('a monthly price and a one-time price never share one sentence; the one-time lede says its own term', () => {
  const m = usualWay(monthly(), 5);
  const o = usualWay(oneTime(), 5);
  assert.equal(C.lede(m), 'Set your subjects and how often you sit a full mock. The usual way uses typical prices; Pro is ₹99 a month.');
  assert.equal(C.lede(o, { until: '31 July 2027' }), 'Set your subjects and how often you sit a full mock. The usual way uses typical prices; Pro is ₹99 once, through 31 July 2027.');
  for (const [offer, from] of OFFER_DAYS) {
    const u = usualWay(offer, 5);
    const v = planValue(offer, { from, pace: 7 });
    const said = [C.lede(u, { until: offer.oneTime.expires }), C.punch(u).pro, C.proPrice(u), C.liveSubjects(u), v ? C.paceMaths(v) : '', v ? C.livePace(v) : ''];
    for (const text of said) {
      if (offer.purchasable === 'monthly') assert.doesNotMatch(text, /\bonce\b/, text);
      else assert.doesNotMatch(text, /a month/, text);
    }
  }
});

// ------------------------------------------------------------------------------------------------ also in the same price
test('round 6: "Also in the same ₹99" lists what else Pro holds, in lines the site already ships, with Key cards and the Mob only while live', () => {
  const names = (opts) => valueTiles(opts).map((t) => t.name);
  assert.deepEqual(names(), ['Unlimited mocks', 'Mistake Lab', 'Smart practice', 'Ask Mobi', 'DU Compass', 'Exam-day screen']);
  assert.deepEqual(names({ keyCards: true, mob: true }), ['Unlimited mocks', 'Mistake Lab', 'Smart practice', 'Ask Mobi', 'Key cards', 'DU Compass', 'Exam-day screen', 'Host your Mob']);
  // Score Recovery only once it is live (its fresh checks "open soon" until recoveryReleased()); the page passes that switch.
  assert.deepEqual(names({ recovery: true }), ['Unlimited mocks', 'Mistake Lab', 'Score Recovery', 'Ask Mobi', 'DU Compass', 'Exam-day screen']);
  assert.ok(!names().includes('Score Recovery'));
  assert.match(stripComments(read(PAGE)), /recovery=\{recoveryReleased\(\)\}/);
  assert.ok(!names({ keyCards: false, mob: true }).includes('Key cards'));
  assert.ok(!names({ keyCards: true, mob: false }).includes('Host your Mob'));
  for (const tile of valueTiles({ keyCards: true, mob: true })) {
    assert.ok(tile.icon === 'bell' || BRAND_ICONS[tile.icon], `${tile.name}: a desk object`);
  }
  // Every line is shipped copy: each sentence (or clause) is found in the page or the module it cites.
  const shipped = [read(PAGE), read('src/components/landing/homeCopy.mjs'), read('src/components/landing/keyCardsCopy.mjs')].join('\n');
  const tiles = { ...Object.fromEntries(valueTiles({ keyCards: true, mob: true, recovery: true }).map((t) => [t.key, t.line])), ...Object.fromEntries(valueTiles({ keyCards: true, mob: true }).map((t) => [t.key, t.line])) };
  for (const key of ['mocks', 'lab', 'recovery', 'smart', 'compass', 'mob']) assert.ok(shipped.includes(tiles[key]), `${key}: "${tiles[key]}" is shipped copy`);
  assert.ok(shipped.includes('50 questions in 60 minutes, on the screen you will meet on the day'), 'nta');
  assert.equal(tiles.nta, 'NTA mode: 50 questions in 60 minutes, on the screen you will meet on the day.');
  assert.ok(shipped.includes('credits a month, all for Mobi') && shipped.includes('Ask about your own record and get one next step'), 'mobi');
  assert.equal(tiles.mobi, `${PRO_MOBI_CREDITS} credits a month, all for Mobi. Ask about your own record and get one next step.`);
  assert.ok(shipped.includes('Every Key card, with no daily review cap') && shipped.includes('Your rating sets when it comes back.'), 'keycards');
  // The grid always fills its rows (data-count drives the wide first tile).
  assert.match(stripComments(read(COMPONENT)), /data-count=\{tiles\.length\}/);
  const css = read(SHEET);
  assert.match(css, /\.pro-val \.pro-val__tiles \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'two columns on phones');
  assert.match(css, /\.pro-val \.pro-val__tiles \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/, 'three on desktop');
});

// ------------------------------------------------------------------------------------------------ money and copy rules
test('round 6: no rupee amount is typed in the value section, nobody else is named or set against MockMob, and no claim of the cheapest', () => {
  for (const rel of [COMPONENT, COPY, PAGE]) {
    const code = stripComments(read(rel));
    const typed = code.match(/₹\s?\d[\d,.]*/g) || [];
    assert.ok(typed.every((amount) => amount === '₹0'), `${rel} types a rupee amount: ${typed.join(', ')}`);
    assert.doesNotMatch(code, /preparoo|adda ?247|oswaal|testbook|physics ?wallah|career ?launcher|unacademy|vedantu|byju|embibe|\btoppr\b|aakash|educart|arihant|\bPW\b/i, rel);
    assert.doesNotMatch(code, /\bvs\.?\s|\bversus\b/i, `${rel}: a "vs"`);
    assert.doesNotMatch(code, /other (CUET )?(prep|platforms?|apps?|websites?|sites|test series|coaching)|elsewhere|compared? (with|to) other/i, `${rel}: a comparison with others`);
    assert.doesNotMatch(code, /cheapest|lowest price|best price|best value/i, rel);
  }
});

test('round 6: the value section\'s words follow the copy rules: no middle dots, no "!", no arrows, no hype, sentence case', () => {
  const words = [C.title, C.askSubjects, C.askPace, C.usualHead, C.proName, C.paceHead, C.seriesLine, C.getPro, C.startFree, C.footnote(), C.proLine({ keyCards: true }), C.barUsual, C.barPro];
  for (const [offer, from] of OFFER_DAYS) {
    for (const count of SUBJECT_STEPS) {
      const u = usualWay(offer, count);
      words.push(C.lede(u, { until: offer.oneTime.expires }), C.punch(u).usual, C.punch(u).pro, C.totalLabel(u), C.alsoHead(u), C.liveSubjects(u), ...u.lines.map((line) => C.each(line)));
    }
    for (const pace of paceSteps(offer, { from })) {
      const v = planValue(offer, { from, pace });
      words.push(C.paceMaths(v), C.livePace(v), ...paceFigures(v).map((f) => f.text), paceStep(pace).sub, paceStep(pace).aria);
    }
  }
  for (const tile of valueTiles({ keyCards: true, mob: true })) words.push(tile.name, tile.line);
  for (const text of words) {
    assert.doesNotMatch(text, /[·•!]|→|->|\bunlock|seamless|supercharge|game-?changer|journey|cheapest|amazing|incredible|insane|hurry|last chance/i, text);
    assert.doesNotMatch(text.replace(/\b(CUET|NTA|SWOT|DU)\b/g, ''), /\b[A-Z]{4,}\b/, `no capitals: ${text}`);
  }
  for (const rel of [COMPONENT, COPY, SHEET, PAGE]) assert.doesNotMatch(read(rel), /·/, `${rel}: no middle dot`);
});

// ------------------------------------------------------------------------------------------------ the interface
test('round 6: the value section\'s sheet: its own pro-val classes, 44 px keys and up, a visible focus ring, Day without a volt slab, no glow, glass or gradient, reduced motion', () => {
  const css = read(SHEET);
  const component = stripComments(read(COMPONENT));
  // Its own classes only: none of the home card's.
  assert.doesNotMatch(component, /className="lp-|lp-usual|lp-val/);
  assert.doesNotMatch(css, /\.lp-|\.lp /);
  for (const [, cls] of component.matchAll(/className="([^"]+)"/g)) {
    for (const name of cls.split(/\s+/)) assert.ok(/^(pro-val|pro-sec|pro-wrap|pro-h2|mm-btn)/.test(name), `class ${name}`);
  }
  // Keys: native buttons, at least 44 px.
  const heights = [...css.matchAll(/min-height: (\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(heights.length >= 2 && heights.every((h) => h >= 44), `every key at least 44 px: ${heights.join(', ')}`);
  assert.match(css, /\.pro-val \.pro-val__step:focus-visible \{ outline: 2px solid var\(--focus-ring, var\(--ink\)\); outline-offset: 2px; \}/);
  assert.match(css, /html\[data-theme='light'\] \.pro-val \.pro-val__step\[aria-pressed='true'\] \{\s*border-color: var\(--sel-rim\); background: var\(--paper-raised\);/, 'Day: raised paper with the ink rim');
  assert.match(css, /\.pro-val \.pro-val__card \{[^}]*border-radius: 28px; background: var\(--paper-raised\);/, 'a solid card');
  assert.doesNotMatch(stripComments(css), /gradient|backdrop-filter|blur\(|glow|text-shadow|transition: all/i, 'no glow, glass or gradient');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.pro-val \.pro-val__step, \.pro-val \.pro-val__fill \{ transition: none; \}/);
  assert.match(css, /:root\[data-motion='reduced'\] \.pro-val :is\(\.pro-val__step, \.pro-val__fill\) \{ transition: none; \}/);
  assert.match(css, /transition: width 280ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/, 'the bars glide 280 ms, ease-out');
  // The receipt and the pace sit side by side from 960 px; the figures side by side where the card has the full measure.
  assert.match(css, /@media \(min-width: 960px\) \{[\s\S]*\.pro-val \.pro-val__grid \{ grid-template-columns: minmax\(0, 1\.12fr\) minmax\(0, 1fr\);/);
  assert.match(css, /\.pro-val \.pro-val__figs \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  // A polite live line says the new figures.
  assert.match(component, /<p className="pro-val__sr" aria-live="polite">\{said\}<\/p>/);
  // Every key is a named native button.
  assert.equal((component.match(/<button key=\{[^}]+\} type="button" className="pro-val__step[^"]*" aria-pressed=/g) || []).length, 2);
});
