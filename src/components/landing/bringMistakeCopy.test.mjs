// The home page's "bring a mistake" example (bringMistakeCopy.mjs): its keys and its working are worked out here from the
// questions' own numbers, so the page can never show a wrong answer as right; the chapter it names is one MockMob's own
// list has; and its counts and claims match the code's constants.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRING_MISTAKE as W, BRING_MISTAKE_PATH, MISTAKE_CHECKS, PRACTICE_COUNT, bringMistakeWords } from './bringMistakeCopy.mjs';
import { mistakeChapters } from '../../services/mobi/mistakeChapters.mjs';
import { nextStep } from '../../services/mobi/bringMistake.mjs';
import { FIRST_SET_COUNT } from '../../lib/firstSet.mjs';
import { liveChapterRows } from '../../../data/cuet_syllabus.js';
import { getSubjectById } from '../../../data/subjects.js';

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

/** "3/5" -> [3, 5] */
const frac = (text) => text.split('/').map(Number);
/** a/b x c/d, as a fraction over `den` when it divides evenly. */
const times = ([a, b], [c, d]) => [a * c, b * d];
const same = ([a, b], [c, d]) => a * d === b * c;

test('the brought question: A and B 3 : 2, C for 1/5 gives 12 : 8 : 5, and the option marked right is that one', () => {
  assert.equal(admit(3, 2, 1, 5), '12 : 8 : 5');
  assert.equal(W.slip.options[W.slip.correct], '12 : 8 : 5');
  assert.notEqual(W.slip.chosen, W.slip.correct, 'the example is a mistake');
  assert.ok(W.read.why.label.includes(W.slip.options[W.slip.correct]));
  assert.ok(W.read.slip[1].startsWith(W.slip.options[W.slip.chosen]), 'the slip names the option the student chose');
});

test('the working, one line a partner: every fraction is worked out from the question, and the shares make 12 : 8 : 5', () => {
  const [[a, aWork, aShare], [b, bWork, bShare], [c, cWork, cShare]] = W.read.why.lines;
  assert.deepEqual([a, b, c], ['A', 'B', 'C']);
  // C takes 1/5 of the whole; A and B share what is left (4/5) in their old 3 : 2.
  const cTakes = [1, 5];
  const left = [cTakes[1] - cTakes[0], cTakes[1]];
  const [aOf, aLeft] = aWork.match(/^(\d+\/\d+) of the (\d+\/\d+) left$/).slice(1).map(frac);
  const [bOf, bLeft] = bWork.match(/^(\d+\/\d+) of the (\d+\/\d+) left$/).slice(1).map(frac);
  assert.ok(same(aLeft, left) && same(bLeft, left), 'what is left is 4/5');
  assert.ok(same(aOf, [3, 5]) && same(bOf, [2, 5]), 'A and B keep their old 3 : 2 of it');
  assert.ok(same(frac(cWork.match(/(\d+\/\d+)$/)[1]), cTakes), 'C has its own 1/5');
  const shares = [times(aOf, aLeft), times(bOf, bLeft), cTakes];
  assert.deepEqual([aShare, bShare, cShare].map(frac).map((f, i) => same(f, shares[i])), [true, true, true]);
  assert.ok([aShare, bShare, cShare].every((s) => frac(s)[1] === 25), 'the shares are over one denominator, so the ratio reads off them');
  assert.equal([aShare, bShare, cShare].map((s) => frac(s)[0]).join(' : '), admit(3, 2, 1, 5));
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

test('the read has the app’s parts, in its order, and names a chapter MockMob’s own list has', () => {
  assert.deepEqual([W.read.tests[0], W.read.why.label.split(' ').slice(0, 2).join(' '), W.read.slip[0]], ['What this tests', 'Why it', 'The likely slip']);
  const model = read('src/services/mobi/bringMistake.mjs');
  for (const word of ['tests', 'slip', 'chapter']) assert.ok(model.includes(word), `the app's model speaks of the ${word}`);
  // The chapter, exactly as MockMob's CUET list spells it: Mobi names a chapter only from this list (mistakeChapters).
  assert.equal(W.read.chapter, 'Admission of Partner');
  assert.ok(mistakeChapters('accountancy').includes(W.read.chapter), 'the syllabus list has it');
  // ... and the practice list has it too (the static list GET /api/chapters falls back to, read as Practice reads it).
  const subject = getSubjectById('accountancy');
  assert.equal(subject.name, W.slip.subject);
  assert.ok(liveChapterRows('accountancy', subject.chapters.map((name) => ({ name }))).some((row) => row.name === W.read.chapter));
});

test('the counts are the app’s: 2 checks an answer, and the practice set its answer ends on', () => {
  const checks = Number(read('src/services/mobi/bringMistake.mjs').match(/data\.checks\.length !== (\d+)\) return null;/)[1]);
  assert.equal(MISTAKE_CHECKS, checks, 'every answer carries exactly this many checks');
  assert.equal(PRACTICE_COUNT, FIRST_SET_COUNT);
  assert.equal(W.practice.count, PRACTICE_COUNT);
  // The landing's last step is the app's own next step for this answer, word for word.
  const next = nextStep({ id: 'accountancy', name: 'Accountancy' }, W.read.chapter);
  assert.equal(next.chapter, W.read.chapter);
  assert.equal(`Practise ${W.practice.count} ${W.practice.what}`, next.label);
  assert.ok(W.practice.from.includes('question bank'));
  assert.equal(read('src/services/mobi/bringMistake.mjs').includes("bank: 'From MockMob’s own question bank.'"), true);
  // What you leave with: the same two numbers, and no other figure.
  const figures = W.value.items.filter((item) => item.figure !== undefined).map((item) => item.figure);
  assert.deepEqual(figures, [MISTAKE_CHECKS, PRACTICE_COUNT]);
  assert.equal(W.value.items.length, 4);
  assert.ok(W.check.after.includes(String(MISTAKE_CHECKS)));
  assert.ok(W.practice.why.includes(`${MISTAKE_CHECKS} checks`) && W.practice.why.includes(`These ${PRACTICE_COUNT}`));
});

test('what the block states is what the code does: 1 credit, 50 free credits a month, the door in Ask Mobi', () => {
  const credits = Number(read('src/services/mobi/mistakePrices.mjs').match(/export const MISTAKE_CREDITS = (\d+);/)[1]);
  const free = Number(read('src/services/credits/aiCreditWallet.js').match(/export const AI_FREE_MONTHLY_CREDITS = (\d+);/)[1]);
  assert.equal(credits, 1);
  assert.equal(free, 50);
  const typed = bringMistakeWords({ photo: false, credits, free });
  assert.equal(typed.price, 'One question uses 1 credit. Free gives you 50 credits a month.');
  assert.doesNotMatch(typed.sub, /photo/i, 'no photo is promised while the app reads none');
  assert.match(typed.sub, /^Bring it here: a question from your coaching sheet, your school paper or a book\. Type or paste it in\.$/);
  const withPhoto = bringMistakeWords({ photo: true, credits, photoCredits: 2, free });
  assert.equal(withPhoto.price, 'A typed question uses 1 credit, a photo 2 credits. Free gives you 50 credits a month.');
  assert.match(withPhoto.sub, /^Bring it here: a question from your coaching sheet, your school paper or a book\. Take a photo or type it in\.$/);
  assert.equal(BRING_MISTAKE_PATH, '/mentor');
  assert.ok(W.honest.includes('can be wrong'));
  const all = JSON.stringify(W) + JSON.stringify(typed) + JSON.stringify(withPhoto);
  assert.doesNotMatch(all, /!|→|->/, 'no exclamation marks or arrows');
  assert.doesNotMatch(all, /chatbot|ChatGPT|Gemini|Google/i, 'no other product is named');
});

test('the photo line shows only while Mobi reads photos', () => {
  const block = read('src/components/landing/BringMistakeBlock.jsx');
  assert.match(block, /\{photo \? <p className="bmk__photo">/);
  assert.match(W.slip.photo, /photo/i);
  for (const words of [W.slip.needs, W.value.items.map((i) => i.line).join(' '), W.honest]) assert.doesNotMatch(words, /photo/i);
});

test('the home page hands the block the app’s own switch and numbers', () => {
  const page = read('src/app/page.js');
  assert.match(page, /<BringMistakeBlock photo=\{MISTAKE_PHOTO_ON\} credits=\{MISTAKE_CREDITS\} photoCredits=\{MISTAKE_PHOTO_CREDITS\} \/>/);
  assert.match(page, /import \{ MISTAKE_PHOTO_ON \} from '@\/\.\.\/data\/mistake_photo\.mjs';/);
  const photoCredits = Number(read('src/services/mobi/mistakePrices.mjs').match(/export const MISTAKE_PHOTO_CREDITS = (\d+);/)[1]);
  assert.equal(photoCredits, 2);
  assert.match(read('data/mistake_photo.mjs'), /export const MISTAKE_PHOTO_ON = (true|false);/);
  assert.equal(bringMistakeWords().price, bringMistakeWords({ free: Number(read('src/services/credits/aiCreditWallet.js').match(/export const AI_FREE_MONTHLY_CREDITS = (\d+);/)[1]) }).price, 'the block’s default is the wallet’s grant');
  assert.doesNotMatch(page, /aiCreditWallet/, 'the home page does not load the server-only wallet for one number');
  assert.match(page, /from '@\/services\/mobi\/mistakePrices\.mjs';/, 'the prices come from the prompt-free module');
  assert.doesNotMatch(page, /services\/mobi\/bringMistake\.mjs/, 'the home page never carries the model prompt');
});

test('the four steps are the feature’s own, short enough for one row at 360 px, and every step but the last has its key', () => {
  assert.deepEqual(W.steps, ['Question', 'Read', 'Check', 'Practise']);
  assert.equal(W.next.length, W.steps.length - 1);
  assert.ok(W.steps.join('').length <= 28);
});
