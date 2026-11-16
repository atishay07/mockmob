// The home page's "bring a mistake" example (bringMistakeCopy.mjs): its keys are worked out here from the questions' own
// numbers, so the page can never show a wrong answer as right; and its claims match the code's constants.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRING_MISTAKE as W, BRING_MISTAKE_PATH, bringMistakeWords } from './bringMistakeCopy.mjs';

const read = (rel) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Old partners share a : b; a new partner takes num/den of the whole from both in their old ratio. The new ratio, reduced. */
function admit(a, b, num, den) {
  const whole = (a + b) * den;
  const parts = [a * (den - num), b * (den - num), num * (a + b)];
  assert.equal(parts.reduce((x, y) => x + y, 0), whole);
  const g = parts.reduce(gcd);
  return parts.map((p) => p / g).join(' : ');
}

test('the pasted question: A and B 3 : 2, C for 1/5 gives 12 : 8 : 5, and the option marked right is that one', () => {
  assert.equal(admit(3, 2, 1, 5), '12 : 8 : 5');
  assert.equal(W.slip.options[W.slip.correct], '12 : 8 : 5');
  assert.notEqual(W.slip.chosen, W.slip.correct, 'the example is a mistake');
  assert.ok(W.read.rows[1][0].includes(W.slip.options[W.slip.correct]));
  assert.ok(W.read.rows[2][1].startsWith(W.slip.options[W.slip.chosen]), 'the slip names the option the student chose');
});

test('the check: P and Q 5 : 3, R for 1/5 gives 5 : 3 : 2, and the option marked right is that one', () => {
  assert.equal(admit(5, 3, 1, 5), '5 : 3 : 2');
  assert.equal(W.check.options[W.check.correct], '5 : 3 : 2');
  assert.ok(W.check.why.includes('5 : 3 : 2'));
});

test('each question has four different options and one key', () => {
  for (const q of [W.slip, W.check]) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4);
  }
});

test('the read has the app’s three parts, in its order', () => {
  assert.deepEqual(W.read.rows.map(([label]) => label.split(' ').slice(0, 2).join(' ')), ['What this', 'Why it', 'The likely']);
  const model = read('src/services/mobi/bringMistake.mjs');
  for (const word of ['tests', 'slip']) assert.ok(model.includes(word), `the app's model speaks of the ${word}`);
});

test('what the block states is what the code does: 1 credit, 50 free credits a month, the door in Ask Mobi', () => {
  const credits = Number(read('src/services/mobi/bringMistake.mjs').match(/export const MISTAKE_CREDITS = (\d+);/)[1]);
  const free = Number(read('src/services/credits/aiCreditWallet.js').match(/export const AI_FREE_MONTHLY_CREDITS = (\d+);/)[1]);
  assert.equal(credits, 1);
  assert.equal(free, 50);
  const typed = bringMistakeWords({ photo: false, credits, free });
  assert.equal(typed.price, 'One question uses 1 credit. Free gives you 50 credits a month.');
  assert.doesNotMatch(typed.sub, /photo/i, 'no photo is promised while the app reads none');
  const withPhoto = bringMistakeWords({ photo: true, credits, photoCredits: 2, free });
  assert.equal(withPhoto.price, 'A typed question uses 1 credit, a photo 2 credits. Free gives you 50 credits a month.');
  assert.match(withPhoto.sub, /^Take a photo of the question, or type it in\./);
  assert.equal(BRING_MISTAKE_PATH, '/mentor');
  assert.ok(W.honest.includes('can be wrong'));
  const all = JSON.stringify(W) + JSON.stringify(typed) + JSON.stringify(withPhoto);
  assert.doesNotMatch(all, /!|→|->/, 'no exclamation marks or arrows');
});

test('the three steps are the feature’s own, and every step but the last has its key', () => {
  assert.deepEqual(W.steps, ['Your question', 'Mobi’s read', 'Check']);
  assert.equal(W.next.length, W.steps.length - 1);
});
