// node --test src/components/learn2/run/runMath.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { endAct, firstLine, minutesLeftLine, numberDetail, optionText, pipGroups, reinsertAt, stemParts, upNextLine } from './runMath.js';

const card = { type: 'card' };
const q = { type: 'question' };

test('up next names the next two groups', () => {
  assert.equal(upNextLine([card, card, card, q, card], 0), 'Up next: 2 cards, then a question');
  assert.equal(upNextLine([q, card], 0), 'Up next: a card');
  assert.equal(upNextLine([card], 0), null);
});

test('minutes left counts unfinished items with the 10 percent', () => {
  assert.equal(minutesLeftLine([card, card, q, q, q, q, q], 0), 'about 6 min left');
  assert.equal(minutesLeftLine([card, card], 0), 'under a minute left');
  assert.equal(minutesLeftLine([card], 1), null);
});

test('option text drops a repeated letter only', () => {
  assert.equal(optionText({ key: 'A', text: 'A Decrease in partners capital' }), 'Decrease in partners capital');
  assert.equal(optionText({ key: 'B', text: '(B) Not allowed' }), 'Not allowed');
  assert.equal(optionText({ key: 'A', text: 'Assets are revalued' }), 'Assets are revalued');
});

test('first line of an explanation', () => {
  assert.equal(firstLine('Goodwill is written off. Then the rest.'), 'Goodwill is written off.');
  assert.equal(firstLine(''), '');
});

test('reinsertion is clamped after the current item', () => {
  assert.equal(reinsertAt(10, 4, 7), 7);
  assert.equal(reinsertAt(10, 4, 2), 5);
  assert.equal(reinsertAt(6, 4, 9), 6);
  assert.equal(reinsertAt(10, 4, undefined), 7);
});

test('a stem with inline steps splits into lead, steps and the ask', () => {
  const body = 'Under the fixed capital method, a partner first introduces additional capital. Arrange the following steps in the order: (A) Record the share of profit. (B) Record the additional capital. (C) Confirm the credit balance. (D) Show the accounts on the liabilities side of the balance sheet. Choose the correct sequence.';
  const p = stemParts(body);
  assert.equal(p.lead, 'Under the fixed capital method, a partner first introduces additional capital. Arrange the following steps in the order:');
  assert.deepEqual(p.steps.map((s) => s.label), ['A', 'B', 'C', 'D']);
  assert.equal(p.steps[3].text, 'Show the accounts on the liabilities side of the balance sheet.');
  assert.equal(p.tail, 'Choose the correct sequence.');
  assert.equal(stemParts('Which is right? (A) one (B) two'), null);
  assert.equal(stemParts('What is goodwill?'), null);
  assert.equal(stemParts('Read (A) x (B) y (C) z, then pick (A) again.'), null);
  assert.deepEqual(stemParts('Order these: (i) one (ii) two (iii) three').steps.map((s) => s.label), ['i', 'ii', 'iii']);
});

test('pips group runs of one kind', () => {
  assert.deepEqual(pipGroups([card, card, q, card]), [{ type: 'card', from: 0, to: 1 }, { type: 'question', from: 2, to: 2 }, { type: 'card', from: 3, to: 3 }]);
  assert.equal(pipGroups(Array(41).fill(card)), null);
});

test('Mobi on the end matches the run', () => {
  assert.equal(endAct({ missed: 3, got: 10, right: 5, wrong: 0 }), 'think');
  assert.equal(endAct({ missed: 0, got: 16, right: 5, wrong: 0 }), 'nod');
  assert.equal(endAct({ missed: 1, got: 4, right: 1, wrong: 3 }), 'encourage');
});

test('the detail under each end number', () => {
  assert.equal(numberDetail({ text: '16 got it' }), '16 got it');
  assert.equal(numberDetail({ text: '2 of 2 fixed.' }), '2 of 2');
  assert.equal(numberDetail({ text: '1 of 2 fixed. 1 still open.' }), '1 of 2, 1 still open');
});

test('the detail also reads the newer line without a full stop', () => {
  assert.equal(numberDetail({ text: '2 of 2 fixed' }), '2 of 2');
  assert.equal(numberDetail({ text: '1 of 2 fixed, 1 still open' }), '1 of 2, 1 still open');
});
