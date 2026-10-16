import test from 'node:test';
import assert from 'node:assert/strict';
import { REVEAL_PARTS, REVEAL_AT, REVEAL_PART_MS, revealStage, rivalMobi, accuracyNote } from '../../src/components/ai/rivalReveal.mjs';
import { SPEC } from '../../src/components/brand/mobiActs.js';

test('the numbers come first: score, comparison, Mobi, next move', () => {
  assert.deepEqual(REVEAL_PARTS, ['score', 'comparison', 'mobi', 'next']);
  const starts = REVEAL_PARTS.map((part) => REVEAL_AT[part]);
  assert.deepEqual([...starts].sort((a, b) => a - b), starts);
  // Mobi never starts before the comparison has landed.
  assert.ok(REVEAL_AT.mobi >= REVEAL_AT.comparison + REVEAL_PART_MS);
  assert.ok(REVEAL_PART_MS >= 150 && REVEAL_PART_MS <= 350);
  // The whole screen is in place within about a second and a half.
  assert.ok(REVEAL_AT.next + REVEAL_PART_MS <= 1500);
});

test('the stage counts parts in order, and reduced motion shows everything at once', () => {
  assert.equal(revealStage(0), 1);
  assert.equal(revealStage(REVEAL_AT.comparison - 1), 1);
  assert.equal(revealStage(REVEAL_AT.comparison), 2);
  assert.equal(revealStage(REVEAL_AT.mobi), 3);
  assert.equal(revealStage(REVEAL_AT.next), 4);
  assert.equal(revealStage(0, { reduced: true }), 4);
});

test('a win cheers, a loss encourages, a draw tilts; each is a once act, never held', () => {
  assert.equal(rivalMobi('win').act, 'cheer');
  assert.equal(rivalMobi('loss').act, 'encourage');
  assert.equal(rivalMobi('tie').act, 'tilt');
  for (const outcome of ['win', 'loss', 'tie']) {
    const found = rivalMobi(outcome);
    assert.ok(SPEC[found.act].ms > 0 && !SPEC[found.act].held, outcome);
    assert.ok(found.label.startsWith('Mobi'), outcome);
  }
  assert.equal(rivalMobi('nonsense'), null);
  assert.equal(rivalMobi(undefined), null);
});

test('Celebrations: Quiet makes the win a nod, Off plays nothing; a loss or draw is never a celebration', () => {
  assert.equal(rivalMobi('win', { celebrations: 'quiet' }).act, 'nod');
  assert.equal(rivalMobi('win', { celebrations: 'off' }).act, 'idle');
  assert.equal(rivalMobi('loss', { celebrations: 'off' }).act, 'encourage');
  assert.equal(rivalMobi('tie', { celebrations: 'quiet' }).act, 'tilt');
});

test('the accuracy note gives the denominator and the skips, or nothing when counts are missing', () => {
  assert.equal(accuracyNote({ correct: 7, answered: 10, total: 10 }), '7 of 10 answered right');
  assert.equal(accuracyNote({ correct: 4, answered: 8, total: 10 }), '4 of 8 answered right, 2 skipped');
  assert.equal(accuracyNote({ correct: 0, answered: 0, total: 5 }), 'None answered, 5 skipped');
  assert.equal(accuracyNote({ accuracy: 70 }), null);
  assert.equal(accuracyNote({ correct: 9, answered: 3 }), null);
  assert.equal(accuracyNote(null), null);
});
