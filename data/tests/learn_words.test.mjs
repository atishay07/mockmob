// Learn v2 round 3: the shared words (data/learn/words.js, R3-SPEC ruling W) and Free's one after-session headline and line
// (data/learn/allowance.js, ruling F). Pins the exact labels and the " · N min" format.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS, backLine, backStamp, chapterPlace, chapterShort, fixMistakes, missedWords, pileLabel, returnWords, reviseDue, reviseQuestions, wholeMinutes, withMinutes } from '../learn/words.js';
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
  assert.equal(reviseQuestions(5), 'Revise 5 questions');
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

test('R5 LK38: when a rated card comes back, in words', () => {
  assert.equal(returnWords(1), 'tomorrow');
  assert.equal(returnWords(1.49), 'tomorrow');
  assert.equal(returnWords(1.5), 'in 2 days');
  assert.equal(returnWords(3), 'in 3 days');
  assert.equal(returnWords(8), 'in 8 days');
  assert.equal(returnWords(13), 'in 13 days');
  assert.equal(returnWords(14), 'in 2 weeks');
  assert.equal(returnWords(20), 'in 3 weeks');
  assert.equal(returnWords(55), 'in 8 weeks');
  assert.equal(returnWords(56), 'in 2 months');
  assert.equal(returnWords(35), 'in 5 weeks');
  assert.equal(returnWords(95), 'in 3 months');
  assert.equal(returnWords(0), 'tomorrow', 'never "later today": FSRS gives at least a day');
  assert.equal(returnWords(null), 'tomorrow');
});

test('R5 LK38: the keys, the stamp and the coach line use one set of words', () => {
  assert.equal(WORDS.missedIt, 'Missed it');
  assert.equal(WORDS.coachRatings, 'How well did you know it? Missed it brings the card back soon. Got it, in a few days. Easy, much later.');
  assert.equal(backStamp(returnWords(1)), 'Back tomorrow');
  assert.equal(backStamp(returnWords(3)), 'Back in 3 days');
  assert.equal(backLine(returnWords(14)), 'back in 2 weeks');
  assert.equal(missedWords('tomorrow', true), 'in this session, then tomorrow');
  assert.equal(missedWords('tomorrow', false), 'tomorrow');
  assert.equal(WORDS.revise, 'Revise');
});
