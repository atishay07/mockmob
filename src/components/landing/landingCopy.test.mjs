// The landing's bolder copy (M-006, 18 Oct 2026; deck: docs/design-decisions/landing-copy-bolder-1018.md) stays inside the truth
// rules: no banned hype words or retired claims, and every bold promise still has the product behaviour that makes it true.
// Source-level, so no server is needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const PAGE = read('../../app/page.js');
const SOURCES = [
  ['src/app/page.js', PAGE],
  ...readdirSync(new URL('.', import.meta.url)).filter((f) => /\.(jsx|mjs)$/.test(f) && !f.endsWith('.test.mjs')).map((f) => [f, read(f)]),
];

test('no landing source carries a retired claim, a hype word or a guarantee', () => {
  const banned = /41 subjects|never repeats?|\bunlock|supercharg|revolutioni[sz]|\belevate|seamless|guarantee|#1\b|not affiliated/i;
  for (const [name, src] of SOURCES) assert.doesNotMatch(stripComments(src), banned, name);
});

test('the hero bank line keeps its two facts and says Pro has no cap', () => {
  const line = read('QuestionBankLine.jsx');
  assert.match(line, /SUBJECT_CLAIM\.long/);
  assert.match(line, /no fixed set to run out of, and no cap on Pro\./);
  assert.match(line, /built fresh from one live/);
});

test('"unlimited mocks" on Pro stays true only while the Pro list says unlimited', () => {
  assert.match(PAGE, /<h2 className="lp-h2">Start free\. Go Pro for unlimited mocks\.<\/h2>/);
  assert.match(PAGE, /'Unlimited Quick practice and Full mock'/, 'the Pro list still promises unlimited papers');
  assert.match(read('../../app/pricing/page.js'), /Unlimited Quick practice and Full mocks/);
});

test('"from the official key, or not at all" stays true: a disagreement gives no repair and no charge', () => {
  assert.match(read('LabCinema.jsx'), /Written from the official key, or not written at all\./);
  assert.match(read('FeatureTour.jsx'), /From the official key, or not at all\./);
  assert.match(read('../../../data/mistake_repair.js'), /A disagreement never produces an explanation[\s\S]{0,120}the student is not charged/);
});

test('the SWOT is promised free only while it uses no model and no credit', () => {
  assert.match(read('LabCinema.jsx'), /Free\. No credits\./);
  assert.match(read('../../../data/mock_swot.js'), /free: no model and no credit/);
});

test('the check panel promises fresh questions days apart, not that nothing ever repeats', () => {
  assert.match(read('MistakeLab.jsx'), /<p className="ml__eyebrow">Fresh questions, days apart<\/p>/);
});
