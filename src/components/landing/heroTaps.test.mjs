// node --test src/components/landing/heroTaps.test.mjs
// The home hero's words that are not the headline (1104 "Desk Light", decisions 13, 14, 18): Mobi's four bubble
// lines (from the sample's state only, never from taps), the two fact sentences (no middle dots) and the second
// beat's four sentence links. Word for word, plain, short enough for the bubble, and the bank count only ever live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESK_LINES, DESK_STATES, deskAct, deskLine, deskStateAfter, heroBankLine, heroBeat, heroTrustSegments, heroTrustSentence } from './heroTaps.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the bubble has four lines, one per sample state, word for word', () => {
  assert.deepEqual(DESK_STATES, ['load', 'right', 'miss', 'five']);
  assert.deepEqual({ ...DESK_LINES }, {
    load: 'Your first question. Go.',
    right: 'Right. The why is under it.',
    miss: 'Close one. Read the why.',
    five: 'That’s five. Pick your subject next.',
  });
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

test('the fact sentences: built from the live offer, no middle dots, the count only when live', () => {
  assert.equal(heroTrustSentence('Pro ₹99 a month'), 'Free to start. Pro ₹99 a month, cancel anytime.');
  assert.equal(heroTrustSentence('Pro ₹99 once, through 31 July 2027', { monthly: false }), 'Free to start. Pro ₹99 once, through 31 July 2027, no auto-renewal.');
  assert.equal(heroTrustSentence('', { monthly: false }), 'Free to start. No auto-renewal.');
  for (const monthly of [true, false]) assert.doesNotMatch(heroTrustSentence('Pro ₹99 a month', { monthly }), /·/);
  assert.deepEqual(heroTrustSegments('Pro ₹99 a month'), ['Free to start', 'Pro ₹99 a month', 'Cancel anytime']);
  assert.equal(heroBankLine(5765), 'One bank of 5,765 questions. No cap on Pro.');
  assert.equal(heroBankLine(123456), 'One bank of 1,23,456 questions. No cap on Pro.', 'Indian grouping');
  for (const missing of [null, undefined, 0, -3, NaN, Infinity]) assert.equal(heroBankLine(missing), 'One live question bank. No cap on Pro.');
  const page = read('../../app/page.js');
  assert.match(page, /heroTrustSentence\(priceLine\(OFFER\), \{ monthly: OFFER\.purchasable === 'monthly' \}\)/);
});

test('the second beat: four sentence links (three without the DU index), the facts unchanged, no big numbers', () => {
  const beat = heroBeat(73);
  assert.deepEqual(beat.map((b) => b.href), ['#try-practice', '#du-eligibility', '#exam-experience', '#your-prep']);
  assert.deepEqual(beat.map((b) => b.title), ['Five questions free', '73 DU programmes', 'Two exam screens', '60 minutes, 50 questions']);
  assert.equal(heroBeat(null).length, 3, 'no programme count without the DU index');
  for (const { title, line } of beat) {
    assert.doesNotMatch(`${title} ${line}`, /·|!|%/);
    assert.ok(`${title} ${line}`.split(' ').length <= 12);
  }
  const page = read('../../app/page.js');
  assert.match(page, /<nav className="lp-beat" aria-label="Why students pick MockMob">/);
  assert.match(page, /heroBeat\(DU_FACTS\?\.programmes \?\? null\)/);
  assert.doesNotMatch(page, /className="lp-proof"/, 'the glass stat strip is gone');
});

test('the count is the page\'s real inventory value (/api/stats bankSize), fetched once and shared, never hard-coded', () => {
  const stats = read('bankStats.js');
  assert.match(stats, /fetch\('\/api\/stats'\)/);
  assert.match(stats, /pending \|\|= fetch/, 'one request per page view');
  assert.match(read('QuestionBankLine.jsx'), /heroBankLine\(bank\?\.questions \?\? null\)/);
  for (const file of ['HeroMobi.jsx', 'HeroRoom.jsx', 'heroTaps.mjs', 'QuestionBankLine.jsx', '../../app/page.js']) {
    assert.doesNotMatch(read(file), /\b\d{1,2},\d{3}\b|\b\d{4,6} questions/, file);
  }
});
