// Learn v2 round 3: the shared words (data/learn/words.js, R3-SPEC ruling W) and Free's one after-session headline and line
// (data/learn/allowance.js, ruling F). Pins the exact labels and the " · N min" format.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS, chapterPlace, chapterShort, fixMistakes, pileLabel, reviseDue, reviseQuestions, wholeMinutes, withMinutes } from '../learn/words.js';
import { FREE_DONE_HEADLINE, FREE_DONE_LINE } from '../learn/allowance.js';

test('one word for each thing', () => {
  assert.equal(WORDS.turnOver, 'Turn over');
  assert.equal(WORDS.turnCue, 'Tap the card to turn it over');
  assert.equal(WORDS.pickHint, 'Pick the answer you think is right.');
  assert.equal(WORDS.reviseLater, 'Revise later');
  assert.equal(WORDS.skipKnown, 'Skip what you already know');
});

test('time is " · N min", rounded up, at least 1', () => {
  assert.equal(withMinutes(WORDS.continue, 6), 'Continue · 6 min');
  assert.equal(withMinutes(WORDS.keepGoing, 9.2), 'Keep going · 10 min');
  assert.equal(withMinutes(WORDS.quickRecap, 0.4), 'Quick recap · 1 min');
  assert.equal(wholeMinutes(null), 1);
});

test('mistakes, due cards, Today questions and the pile', () => {
  assert.equal(fixMistakes(3, 3), 'Fix 3 open mistakes · 3 min');
  assert.equal(fixMistakes(1, 1), 'Fix 1 open mistake · 1 min');
  assert.equal(reviseDue(9, 2.5), 'Revise 9 due cards · 3 min');
  assert.equal(reviseDue(1, 1), 'Revise 1 due card · 1 min');
  assert.equal(reviseQuestions(5), 'Revise · 5 questions');
  assert.equal(pileLabel(4), '4 to revise');
});

test('Free after the day\'s session: one headline and one true line', () => {
  assert.equal(FREE_DONE_HEADLINE, "That was today's free session.");
  assert.equal(FREE_DONE_LINE, 'Questions come back tomorrow. Your Key cards stay open.');
  assert.doesNotMatch(FREE_DONE_LINE, /Learn opens again/);
});

test('a chapter is named by its place in the roadmap, never by a bare NCERT number (R4 ruling N)', () => {
  assert.equal(chapterPlace({ n: 5, of: 14 }), 'Chapter 5 of 14');
  assert.equal(chapterShort({ n: 5, of: 14 }), 'Chapter 5');
  assert.equal(chapterPlace(null), '', 'no place, no label');
  assert.equal(chapterPlace({ n: 0, of: 14 }), '');
  assert.equal(chapterShort(undefined), '');
});
