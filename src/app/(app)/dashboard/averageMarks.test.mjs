import test from 'node:test';
import assert from 'node:assert/strict';
import { averageMarksPercent, paperMarksPercent } from './averageMarks.mjs';

test('a paper below zero marks counts below zero, not as 0%', () => {
  // -3 marks of 50: 0 right, 3 wrong, 47 blank
  assert.equal(paperMarksPercent({ correct: 0, wrong: 3, total: 10, score: 0 }).toFixed(1), '-6.0');
  const rows = [{ correct: 5, wrong: 0, total: 10, score: 50 }, { correct: 0, wrong: 10, total: 10, score: 0 }];
  assert.equal(averageMarksPercent(rows), 15); // (50 + -20) / 2; the clamped scores would give 25
});

test('average of signed papers', () => {
  const rows = [{ correct: 10, wrong: 0, total: 10, score: 100 }, { correct: 0, wrong: 5, total: 10, score: 0 }];
  assert.equal(averageMarksPercent(rows), 45); // (100 + -10) / 2
});

test('falls back to stored score without counts, and empty is 0', () => {
  assert.equal(averageMarksPercent([{ score: 60 }, { score: 40 }]), 50);
  assert.equal(averageMarksPercent([]), 0);
});
