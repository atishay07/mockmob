// node --test src/components/landing/heroTaps.test.mjs
// The home hero's words that are not the headline (1104 "Desk Light", decisions 13, 18; round 3 R3-D3, LK99/LK100; round 4,
// owner LK121/LK122/LK124, 5 Nov 2026): Mobi's four bubble lines (from the sample's state only, never from taps; the first
// says his name), the features strip (the main features, each a link to its section) and the honest price hook (from the
// live offer at the pricing slider's top pace). Word for word, plain, short enough for the bubble, the money never typed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESK_END_STATES, DESK_LINES, DESK_NOTE, DESK_STATES, HERO_FEATURES_LABEL, deskAct, deskEndState, deskLine, deskStateAfter, heroBankLine, heroFactLine, heroFeatures, heroPriceHook, heroTrustSegments, heroTrustSentence } from './heroTaps.mjs';
import { MOCK_PACES, PACE, paceWords, perMock } from '../../lib/payments/value.mjs';
import { BRAND_ICONS } from '../../../data/brand_icons.mjs';
import { STRIP_OBJECTS } from './stripObjects.mjs';
import { resetDemoSignal, sendDemoState } from './demoSignal.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('the bubble has four lines, one per sample state, word for word; the first says his name (R3-D3)', () => {
  // R8 HERO-03, HERO-08 (8 Nov 2026): the fifth answer gets its own right or miss line, the end of the five a line for the
  // score, and the subject list, a loaded subject and a "Try 5 questions first" tap with the card on screen each a line.
  assert.deepEqual(DESK_STATES, ['load', 'right', 'miss', 'all', 'four', 'three', 'two', 'tough', 'pick', 'live', 'here']);
  // R3-D3 (brandloss B5): "Hi, I'm Mobi." comes first. Round 4 (owner LK122, 5 Nov 2026: "Your first question. Go. What kind
  // of English is this? ... think from a marketing angle"): complete, plain sentences that invite; no "Go.". Decision 13 is
  // unchanged: lines change with the sample, never a tap. The questions are original CUET-pattern questions (DemoDrill:
  // "Not authenticated PYQs"), so the bubble says "a CUET question", never "a real CUET paper question".
  assert.deepEqual({ ...DESK_LINES }, {
    load: 'Hi, I’m Mobi. Try this CUET question.',
    right: 'That’s right. The reason is just below.',
    miss: 'Not this time. The reason is just below.',
    all: 'Five of five. Ready for a full mock?',
    four: 'Four of five. Open the miss to see why.',
    three: 'Three of five. Open a miss to see why.',
    two: 'Two of five. Open a miss to see why.',
    tough: 'Every miss has a reason. Open one.',
    pick: 'Pick a subject. I’ll pull five more.',
    live: 'Your subject it is. Your move.',
    here: 'Here it is. Pick an answer.',
  });
  assert.equal(deskLine('live', { subject: 'Physics' }), 'Physics it is. Your move.');
  assert.equal(deskLine('live', { subject: 'Political Science' }), 'Political Science it is. Your move.');
  assert.ok(deskLine('live', { subject: 'Political Science' }).length <= 40, 'the longest subject still fits the bubble');
  assert.doesNotMatch(Object.values(DESK_LINES).join(' '), /sign up/i, 'Mobi never pushes sign-up; the card\'s key does');
  assert.doesNotMatch(Object.values(DESK_LINES).join(' '), /\bGo\.|the why\b|real CUET|previous year|PYQ/i);
  assert.equal(DESK_NOTE, 'Free, no sign-up. Every answer shows its reason.');
  assert.ok(DESK_LINES.load.startsWith('Hi, I’m Mobi. '), 'his name comes first, before the sample line');
  assert.equal(deskLine('nonsense'), DESK_LINES.load);
  assert.equal(deskLine(undefined), DESK_LINES.load);
});

test('every bubble line is plain: sentence case, at most 40 characters, no hype, no numbers, no exclamation or emoji', () => {
  for (const line of Object.values(DESK_LINES)) {
    assert.ok(line.length <= 40, `${line} is ${line.length} characters`);
    assert.match(line, /^[A-Z]/, `${line} starts in sentence case`);
    assert.doesNotMatch(line, /[!→←%·]|\d|\p{Extended_Pictographic}/u, line);
    assert.doesNotMatch(line, /master|guarantee|unlimited|best|#1/i, line);
  }
});

test('the sample state after an answer: right or miss, the fifth too (R8 HERO-03); the end state follows the score', () => {
  assert.equal(deskStateAfter({ index: 0, correct: true }), 'right');
  assert.equal(deskStateAfter({ index: 3, correct: false }), 'miss');
  assert.equal(deskStateAfter({ index: 4, correct: true }), 'right');
  assert.equal(deskStateAfter({ index: 4, correct: false }), 'miss');
  assert.deepEqual([5, 4, 3, 2, 1, 0].map((score) => deskEndState(score)), ['all', 'four', 'three', 'two', 'tough', 'tough']);
  assert.deepEqual([...DESK_END_STATES], ['all', 'four', 'three', 'two', 'tough']);
  assert.equal(deskAct('right'), 'correct');
  assert.equal(deskAct('miss'), 'encourage');
  assert.equal(deskAct('all'), 'cheer');
  assert.equal(deskAct('four'), 'cheer');
  assert.equal(deskAct('tough'), 'encourage');
  assert.equal(deskAct('load'), null);
  assert.equal(deskAct('pick'), null);
});

test('the lines change only with the sample: DemoDrill sends the state, HeroMobi never sets it from a tap', () => {
  const drill = read('DemoDrill.jsx');
  assert.match(drill, /tellDesk\(deskStateAfter\(\{ correct: optionIndex === question\.correct \}\), index \+ 1\);/);
  assert.match(drill, /tellDesk\(deskEndState\(score, DRILL\.length\), DRILL\.length\);/, 'the end of the five answers the score');
  assert.match(drill, /sendDemoState\(state, count, undefined, \{ subject, restore \}\);/, 'every line goes out as the sample\'s state');
  assert.match(drill, /tellDesk\('load', 0\);/, 'a restart puts the load line back');
  const mobi = read('HeroMobi.jsx');
  assert.match(mobi, /window\.addEventListener\(DEMO_STATE_EVENT, onState\)/);
  // The one place the line's state is set is the sample's state handler.
  assert.equal((mobi.match(/setState\(/g) || []).length, 1);
  const onTapped = mobi.slice(mobi.indexOf('const onTapped'), mobi.indexOf('const line = deskLine'));
  assert.doesNotMatch(onTapped, /setState|setAct/, 'a tap changes neither the line nor the act he was given');
});

test('closing the subject list puts the line back without a new act (R8 revision): restore rides on the event', () => {
  const events = [];
  const target = { dispatchEvent: (event) => events.push(event.detail) };
  sendDemoState('miss', 2, target, { restore: true });
  sendDemoState('right', 3, target);
  assert.deepEqual(events, [{ state: 'miss', answered: 2, subject: null, restore: true }, { state: 'right', answered: 3, subject: null, restore: false }]);
  resetDemoSignal();
  const drill = read('DemoDrill.jsx');
  const close = drill.slice(drill.indexOf('function closeSubjects'), drill.indexOf('async function chooseSubject'));
  assert.match(close, /tellDesk\(state, count, subject, true\);/, 'the close is sent as a restore');
  const mobi = read('HeroMobi.jsx');
  const onState = mobi.slice(mobi.indexOf('const onState'), mobi.indexOf('window.addEventListener(DEMO_STATE_EVENT'));
  assert.ok(onState.indexOf('setState(next)') < onState.indexOf('if (event.detail?.restore) return;'), 'the line still comes back');
  assert.ok(onState.indexOf('if (event.detail?.restore) return;') < onState.indexOf('deskAct(next)'), 'but no act plays');
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

test('R3-D3 (LK99) then round 4 (LK121): the fact line builder is kept, and the hero no longer draws it', () => {
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
  // Round 4 (owner LK121, 5 Nov 2026: "5,700 questions, free to start, Pro, 99 a month: too much information just on the
  // top"): the hero draws no fact line at all; "Have an account? Log in" is the only line under the keys. The line's builder
  // stays for QuestionBankLine's fact variant.
  const page = read('../../app/page.js');
  const hero = page.slice(page.indexOf('<section className="lp-hero">'), page.indexOf('STATEMENT ('));
  assert.doesNotMatch(hero, /<QuestionBankLine\b|lp-hero__fact|lp-trust-line|lp-hero__facts|lp-bank--short/, 'no fact line in the hero');
  const line = read('QuestionBankLine.jsx');
  assert.match(line, /if \(variant === 'fact'\) \{\n\s+const line = heroFactLine\(price, \{ bankSize: bank\?\.questions \?\? null \}\);/);
  assert.match(line, /<b className="lp-hero__count">\{line\.count\}<\/b>/, 'the count carries its weight');
});

test('round 4 (owner LK124): the features strip names the main features, each a link to its own section on the page', () => {
  const all = heroFeatures({ compass: true, keyCards: true });
  assert.deepEqual(all.map((f) => f.name), ['Unlimited mocks', 'Mistake Lab', 'Score Recovery', 'DU Compass', 'Ask Mobi', 'Key cards']);
  assert.deepEqual(all.map((f) => f.href), ['#pricing', '#inside-the-lab', '#score-recovery-lab', '#compass', '#your-prep', '#key-cards']);
  for (const f of all) {
    assert.deepEqual(Object.keys(f).sort(), ['href', 'icon', 'line', 'name'], 'only what the strip draws');
    // Round 5 (LK160): its desk object, cut for the strip (stripObjects.mjs) from the brand's own library (Mobi is Mobi).
    assert.ok(STRIP_OBJECTS[f.icon], `${f.icon} has a strip object`);
    assert.ok(f.icon === 'mobi' || BRAND_ICONS[f.icon], `${f.icon} is one of the brand's desk objects`);
    assert.ok(f.line.length <= 28, `${f.line}: one line in a 3-across cell`);
    assert.doesNotMatch(`${f.name} ${f.line}`, /·|!|%|\d|guarantee|never repeats|best|#1/i, f.name);
  }
  // The USP, truthfully: unlimited is Pro's (L-041, owner memory 16 Oct).
  assert.match(all[0].line, /^On Pro/);
  // No Compass section: its link goes to the free DU calculator; no Key cards section: no Key cards cell.
  assert.equal(heroFeatures({ compass: false }).find((f) => f.name === 'DU Compass').href, '#du-eligibility');
  assert.ok(!heroFeatures({}).some((f) => f.name === 'Key cards'));
  assert.equal(HERO_FEATURES_LABEL, 'What MockMob gives you');
  const page = read('../../app/page.js');
  assert.match(page, /const FEATURES = heroFeatures\(\{ compass: SHOWCASE\.programmes\.length > 0, keyCards: Boolean\(KEY_CARDS\) \}\);/);
  // Every anchor it links to is drawn on the page (Compass and Key cards only when they are).
  for (const id of ['inside-the-lab', 'score-recovery-lab', 'your-prep', 'pricing', 'compass', 'du-eligibility', 'key-cards']) assert.match(page, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(page, /heroBeat\(|className="lp-proof"|className="lp-beat"/, 'the number strip and its facts are gone');
});

test('round 4 (owner LK124): the price hook is worked out from the live offer at the pricing slider\'s top pace, never typed', () => {
  const from = new Date(Date.UTC(2026, 10, 6));
  const monthly = { purchasable: 'monthly', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } };
  const once = { purchasable: 'one_time', monthly: { rupees: 99 }, oneTime: { rupees: 99, expires: '31 July 2027' } };
  const top = Math.max(...MOCK_PACES);
  const hook = heroPriceHook(monthly, { from });
  assert.equal(hook.pace, top, 'the slider\'s top value');
  assert.equal(hook.figure, '₹1', 'owner 7 Nov: the nearest whole rupee from a rupee up (₹1.10 reads About ₹1)');
  // Round 4 review (6 Nov): the best case never stands without its condition. The pace follows the unit in the same line
  // ("As low as ₹X a mock on Pro at 3 full mocks a day"), then the price that makes it, so it can be checked. Round 5 (owner,
  // 6 Nov: "21 also makes sense (3 a day)"): the pace is said in the slider's own words, the same words its top end shows.
  assert.equal(top, PACE.max);
  assert.equal(hook.at, `at ${paceWords(top).long}`, 'the pace right after the unit, in the slider’s words');
  assert.equal(hook.at, 'at 3 full mocks a day');
  assert.equal(hook.line, '₹99 a month.', 'the price that makes it');
  assert.equal(hook.lead, 'About');
  assert.equal(hook.unit, 'a mock on Pro');
  assert.equal(hook.href, '#pricing', 'a link to the slider that works it out');
  assert.equal(`${hook.lead} ${hook.figure} ${hook.unit} ${hook.at}. ${hook.line}`, 'About ₹1 a mock on Pro at 3 full mocks a day. ₹99 a month.');
  // A one-time offer says its own period, never "a month" (monthly and one-time never share a sentence).
  const oneTime = heroPriceHook(once, { from });
  assert.equal(oneTime.line, '₹99 once, to 31 July 2027.');
  assert.equal(oneTime.at, hook.at, 'the same pace either way');
  assert.doesNotMatch(`${oneTime.at} ${oneTime.line}`, /a month/);
  // The hook follows the slider's top value whatever it is: 21 a week (round 5's slider runs 5 to 21) reads ₹1.10 on the
  // monthly offer and ₹0.20 on the one-time offer to 31 July 2027 from 6 Nov 2026; 14 a week would read ₹1.70.
  assert.equal(perMock(monthly, 14, { from }).about, '₹1.70');
  assert.equal(perMock(monthly, 21, { from }).about, '₹1.10');
  assert.equal(oneTime.figure, '₹0.20');
  assert.equal(oneTime.lead, 'As low as', 'under a rupee the paise figure stays');
  assert.equal(heroPriceHook({}, { from }), null, 'nothing to work out: no hook');
  const page = read('../../app/page.js');
  assert.match(page, /const PRICE_HOOK = heroPriceHook\(OFFER, \{ from: BUILT \}\);/);
  assert.match(page, /<HeroBeatStrip items=\{FEATURES\} label=\{HERO_FEATURES_LABEL\} hook=\{PRICE_HOOK\} \/>/);
  const words = read('heroTaps.mjs').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(words, /₹\s?\d/, 'no rupee figure is typed in the hero\'s words');
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
