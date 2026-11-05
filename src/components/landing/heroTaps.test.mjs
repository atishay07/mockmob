// node --test src/components/landing/heroTaps.test.mjs
// The home hero's words that are not the headline (1104 "Desk Light", decisions 13, 18; round 3 R3-D3, LK99/LK100,
// 5 Nov 2026): Mobi's four bubble lines (from the sample's state only, never from taps; the first says his name), the
// one fact line (the live count, then the money; no middle dots) and the second beat's four facts with their number
// weight and desk objects. Word for word, plain, short enough for the bubble, and the bank count only ever live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESK_LINES, DESK_STATES, HERO_BEAT_LABEL, deskAct, deskLine, deskStateAfter, heroBankLine, heroBeat, heroFactLine, heroTrustSegments, heroTrustSentence } from './heroTaps.mjs';
import { BRAND_ICONS } from '../../../data/brand_icons.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the bubble has four lines, one per sample state, word for word; the first says his name (R3-D3)', () => {
  assert.deepEqual(DESK_STATES, ['load', 'right', 'miss', 'five']);
  // R3-D3 (owner LK99/LK100, 5 Nov 2026; brandloss B5): "Hi, I'm Mobi." is back before the sample line. Supersedes the
  // 4 Nov load line "Your first question. Go." (decision 13 is unchanged: lines change with the sample, never a tap).
  assert.deepEqual({ ...DESK_LINES }, {
    load: 'Hi, I’m Mobi. Your first question. Go.',
    right: 'Right. The why is under it.',
    miss: 'Close one. Read the why.',
    five: 'That’s five. Pick your subject next.',
  });
  assert.ok(DESK_LINES.load.startsWith('Hi, I’m Mobi. '), 'his name comes first, before the sample line');
  assert.equal(deskLine('nonsense'), DESK_LINES.load);
  assert.equal(deskLine(undefined), DESK_LINES.load);
});

test('every bubble line is plain: sentence case, at most 44 characters, no hype, no numbers, no exclamation or emoji', () => {
  for (const line of Object.values(DESK_LINES)) {
    assert.ok(line.length <= 44, `${line} is ${line.length} characters`);
    assert.match(line, /^[A-Z]/, `${line} starts in sentence case`);
    assert.doesNotMatch(line, /[!→←%·]|\d|\p{Extended_Pictographic}/u, line);
    assert.doesNotMatch(line, /master|guarantee|unlimited|best|#1/i, line);
  }
});

test('the sample state after an answer: right, miss, and the fifth answer is always "five"', () => {
  assert.equal(deskStateAfter({ index: 0, correct: true }), 'right');
  assert.equal(deskStateAfter({ index: 3, correct: false }), 'miss');
  assert.equal(deskStateAfter({ index: 4, correct: true }), 'five');
  assert.equal(deskStateAfter({ index: 4, correct: false }), 'five');
  assert.equal(deskAct('right'), 'correct');
  assert.equal(deskAct('miss'), 'encourage');
  assert.equal(deskAct('five'), 'cheer');
  assert.equal(deskAct('load'), null);
});

test('the lines change only with the sample: DemoDrill sends the state, HeroMobi never sets it from a tap', () => {
  const drill = read('DemoDrill.jsx');
  assert.match(drill, /sendDemoState\(deskStateAfter\(\{ index, correct: optionIndex === question\.correct, total: DRILL\.length \}\), index \+ 1\);/);
  assert.match(drill, /sendDemoState\('load', 0\);/, 'a restart puts the load line back');
  const mobi = read('HeroMobi.jsx');
  assert.match(mobi, /window\.addEventListener\(DEMO_STATE_EVENT, onState\)/);
  // The one place the line's state is set is the sample's state handler.
  assert.equal((mobi.match(/setState\(/g) || []).length, 1);
  const onTapped = mobi.slice(mobi.indexOf('const onTapped'), mobi.indexOf('const line = deskLine'));
  assert.doesNotMatch(onTapped, /setState|setAct/, 'a tap changes neither the line nor the act he was given');
});

test('the reassurance sentences (kept for other surfaces): built from the live offer, no middle dots, the count only when live', () => {
  assert.equal(heroTrustSentence('Pro ₹99 a month'), 'Free to start. Pro ₹99 a month, cancel anytime.');
  assert.equal(heroTrustSentence('Pro ₹99 once, through 31 July 2027', { monthly: false }), 'Free to start. Pro ₹99 once, through 31 July 2027, no auto-renewal.');
  assert.equal(heroTrustSentence('', { monthly: false }), 'Free to start. No auto-renewal.');
  for (const monthly of [true, false]) assert.doesNotMatch(heroTrustSentence('Pro ₹99 a month', { monthly }), /·/);
  assert.deepEqual(heroTrustSegments('Pro ₹99 a month'), ['Free to start', 'Pro ₹99 a month', 'Cancel anytime']);
  assert.equal(heroBankLine(5765), 'One bank of 5,765 questions. No cap on Pro.');
  assert.equal(heroBankLine(123456), 'One bank of 1,23,456 questions. No cap on Pro.', 'Indian grouping');
  for (const missing of [null, undefined, 0, -3, NaN, Infinity]) assert.equal(heroBankLine(missing), 'One live question bank. No cap on Pro.');
});

test('R3-D3 (LK99): the two fact lines are one: the live count in ink weight, then the money from the live offer', () => {
  assert.deepEqual(heroFactLine('Pro ₹99 a month', { bankSize: 5765 }), { count: '5,765 questions.', rest: ' Free to start, Pro\u00a0₹99 a month.' });
  assert.deepEqual(heroFactLine('Pro ₹99 a month', { bankSize: 123456 }), { count: '1,23,456 questions.', rest: ' Free to start, Pro\u00a0₹99 a month.' }, 'Indian grouping');
  assert.equal(heroFactLine('Pro ₹99 once, through 31 July 2027', { bankSize: 5765 }).rest, ' Free to start, Pro\u00a0₹99 once, through 31 July 2027.');
  // Without a live count, the same money words alone: nothing a reader has read changes when the count arrives.
  for (const missing of [null, undefined, 0, -3, NaN, Infinity]) assert.deepEqual(heroFactLine('Pro ₹99 a month', { bankSize: missing }), { count: '', rest: 'Free to start, Pro\u00a0₹99 a month.' });
  assert.equal(heroFactLine('', {}).rest, 'Free to start.');
  for (const size of [null, 5765]) {
    const { count, rest } = heroFactLine('Pro ₹99 a month', { bankSize: size });
    const line = `${count}${rest}`;
    assert.doesNotMatch(line, /·|!|cheapest|unlimited/i, line);
    // One line on a 360 px phone: the monthly line is at most 48 characters (measured in Chrome: 297 px at 14 px).
    assert.ok(line.length <= 48, `${line} is ${line.length} characters`);
  }
  const page = read('../../app/page.js');
  const hero = page.slice(page.indexOf('<section className="lp-hero">'), page.indexOf('STATEMENT ('));
  assert.match(hero, /<QuestionBankLine variant="fact" price=\{priceLine\(OFFER\)\} className="lp-hero__fact" \/>/, 'one line, built from the live offer');
  assert.equal((hero.match(/<QuestionBankLine\b/g) || []).length, 1, 'one fact line, not two');
  assert.doesNotMatch(hero, /lp-trust-line|lp-hero__facts|lp-bank--short/, 'the two old lines are gone');
  const line = read('QuestionBankLine.jsx');
  assert.match(line, /if \(variant === 'fact'\) \{\n\s+const line = heroFactLine\(price, \{ bankSize: bank\?\.questions \?\? null \}\);/);
  assert.match(line, /<b className="lp-hero__count">\{line\.count\}<\/b>/, 'the count carries its weight');
});

test('R3-D3 (LK100): the second beat keeps its four facts (three without the DU index), now with number weight and a desk object each', () => {
  const beat = heroBeat(73);
  assert.deepEqual(beat.map((b) => b.href), ['#try-practice', '#du-eligibility', '#exam-experience', '#your-prep']);
  assert.deepEqual(beat.map((b) => b.figure), ['5', '73', '2', '60']);
  assert.deepEqual(beat.map((b) => b.unit), ['questions free', 'DU programmes', 'exam screens', 'minutes, 50 questions']);
  assert.deepEqual(beat.map((b) => b.icon), ['questions', 'compass', 'papers', 'today']);
  for (const b of beat) {
    assert.ok(BRAND_ICONS[b.icon], `${b.icon} is a desk object`);
    assert.deepEqual(Object.keys(b).sort(), ['figure', 'href', 'icon', 'line', 'unit'], 'only what the strip draws');
    assert.doesNotMatch(`${b.figure} ${b.unit} ${b.line}`, /·|!|%/);
    assert.ok(`${b.figure} ${b.unit} ${b.line}`.split(' ').length <= 12);
  }
  assert.equal(heroBeat(null).length, 3, 'no programme count without the DU index');
  assert.ok(!heroBeat(null).some((b) => /DU programmes/.test(b.unit)));
  assert.equal(HERO_BEAT_LABEL, 'Why MockMob');
  const page = read('../../app/page.js');
  assert.match(page, /const BEAT = heroBeat\(DU_FACTS\?\.programmes \?\? null\);/);
  assert.doesNotMatch(page, /className="lp-proof"|className="lp-beat"/, 'neither the old glass strip nor the hairline row');
});

test('the count is the page\'s real inventory value (/api/stats bankSize), fetched once and shared, never hard-coded', () => {
  const stats = read('bankStats.js');
  assert.match(stats, /fetch\('\/api\/stats'\)/);
  assert.match(stats, /pending \|\|= fetch/, 'one request per page view');
  assert.match(read('QuestionBankLine.jsx'), /heroBankLine\(bank\?\.questions \?\? null\)/);
  for (const file of ['HeroMobi.jsx', 'HeroRoom.jsx', 'heroTaps.mjs', 'QuestionBankLine.jsx', 'HeroBeatStrip.jsx', '../../app/page.js']) {
    assert.doesNotMatch(read(file), /\b\d{1,2},\d{3}\b|\b\d{4,6} questions/, file);
  }
});
