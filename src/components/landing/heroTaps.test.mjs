// node --test src/components/landing/heroTaps.test.mjs
// The home hero's Mobi lines and the hero's two quiet lines (LK32, LK29, 1 Nov 2026; hero.md items 3 and 4): word for
// word, plain, short enough for the bubble, and the bank count is only ever the live one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HERO_KEY_LIFT_STEP, HERO_LINE_LOAD, HERO_TAP_COUNT, heroBankLine, heroTapLine, heroTapLines, heroTrustLine, heroTrustSegments, nextHeroStep } from './heroTaps.mjs';
import { HERO_LINES, HERO_SENTENCE } from './heroLines.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('six tap lines after the load line, word for word', () => {
  assert.equal(HERO_TAP_COUNT, 6);
  assert.deepEqual(heroTapLines(5765), [
    'Hi, I’m Mobi. Tap me.',
    'I find where your marks slip.',
    'One timed mock shows me the chapter.',
    '5,765 questions. A fresh mock every time.',
    'Okay, okay. Try five questions?',
    'Free to start. These five need no signup.',
    'That’s all my tips. Go on, try one.',
  ]);
  assert.equal(HERO_LINE_LOAD, heroTapLine(0));
  assert.equal(HERO_KEY_LIFT_STEP, 4, 'the key lifts on "Try five questions?"');
});

test('line 3 has a fallback without a number, and never shows a made-up or empty count', () => {
  for (const missing of [null, undefined, 0, -3, NaN, Infinity]) assert.equal(heroTapLine(3, missing), 'One big bank. A fresh mock every time.');
  assert.equal(heroTapLine(3, 123456), '1,23,456 questions. A fresh mock every time.', 'Indian grouping, as the bank line');
  assert.doesNotMatch(heroTapLines(null).join(' '), /\d/, 'no number at all without the live count');
});

test('the sixth line stays: later taps never move past it, and steps stop at six', () => {
  assert.equal(heroTapLine(7), heroTapLine(6));
  assert.equal(heroTapLine(99), heroTapLine(6));
  assert.equal(heroTapLine(-1), HERO_LINE_LOAD);
  let step = 0;
  for (let i = 0; i < 10; i += 1) step = nextHeroStep(step);
  assert.equal(step, 6);
});

test('every line is plain: sentence case, at most 44 characters, no hype, no percentages, no exclamation or emoji', () => {
  for (const line of [...heroTapLines(98765), ...heroTapLines(null)]) {
    assert.ok(line.length <= 44, `${line} is ${line.length} characters`);
    assert.match(line, /^[A-Z0-9]/, `${line} starts in sentence case`);
    assert.doesNotMatch(line, /[!→←%]|\p{Extended_Pictographic}/u, line);
    assert.doesNotMatch(line, /master|guarantee|unlimited|marks to recover|\bgain\b/i, line);
  }
});

test('the two quiet lines: reassurances on one line, the bank on one line, the count only when live', () => {
  assert.equal(heroTrustLine('Pro ₹99 a month'), 'Free to start · Pro ₹99 a month · Cancel anytime');
  assert.equal(heroTrustLine('Pro ₹499 once', { monthly: false }), 'Free to start · Pro ₹499 once · No auto-renewal');
  assert.equal(heroBankLine(5765), 'One bank of 5,765 questions. No cap on Pro.');
  assert.equal(heroBankLine(null), 'One live question bank. No cap on Pro.');
  assert.equal(heroBankLine(0), 'One live question bank. No cap on Pro.');
});

test('the count is the page\'s real inventory value (/api/stats bankSize), fetched once and shared, never hard-coded', () => {
  const stats = read('bankStats.js');
  assert.match(stats, /fetch\('\/api\/stats'\)/);
  assert.match(stats, /data\.state === 'available' && Number\.isFinite\(data\.bankSize\) && data\.bankSize > 0/);
  assert.match(stats, /pending \|\|= fetch/, 'one request per page view');
  const mobi = read('HeroMobi.jsx');
  assert.match(mobi, /loadBankSize\(\)\.then/);
  assert.match(mobi, /heroTapLine\(step, bank\)/);
  assert.match(read('QuestionBankLine.jsx'), /loadBankSize\(\)\.then/);
  // No number of questions is typed into the hero's sources.
  for (const file of ['HeroMobi.jsx', 'HeroRoom.jsx', 'heroTaps.mjs', 'QuestionBankLine.jsx', '../../app/page.js']) {
    assert.doesNotMatch(read(file), /\b\d{1,2},\d{3}\b|\b\d{4,6} questions/, file);
  }
});

test('R3 H1: the headline is static, so the reactions are only his own (no cycling line, no caret, no glance listener)', () => {
  assert.deepEqual([...HERO_LINES], ['CUET 2027.', 'One mock.', 'Know what to fix.']);
  assert.equal(HERO_SENTENCE, 'CUET 2027. One mock. Know what to fix.');
  const page = read('../../app/page.js');
  assert.ok(page.includes('{HERO_LINES[2]}'));
  assert.doesNotMatch(page, /HeroMorph|HeroLine|HeroType|HeroMelt|lp-morph|caret/);
  assert.doesNotMatch(read('HeroMobi.jsx'), /pip:glance|HERO_LINES/, 'his taps do not depend on the headline');
});

test('R3 H2: every trust segment is whole on its own, and the string is only the segments joined', () => {
  for (const monthly of [true, false]) {
    const parts = heroTrustSegments('Pro ₹99 once, through 31 July 2027', { monthly });
    assert.equal(parts.length, 3);
    assert.equal(parts[2], monthly ? 'Cancel anytime' : 'No auto-renewal');
    for (const part of parts) assert.doesNotMatch(part, / · |·/, 'a segment never contains the separator');
    assert.equal(heroTrustLine('Pro ₹99 once, through 31 July 2027', { monthly }), parts.join(' · '));
  }
  assert.match(read('../../app/hero-scene.css'), /.lp-trust-line__seg { white-space: nowrap; }/);
  assert.match(read('../../app/page.js'), /className="lp-trust-line__seg"/);
});
