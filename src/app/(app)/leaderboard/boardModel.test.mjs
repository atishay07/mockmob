// Run: node --test "src/app/(app)/leaderboard/boardModel.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { boardRows, ordinal, yourPlace } from './boardModel.mjs';

test('rows say who is who and never pass a rival off as a student', () => {
  const rows = boardRows([
    { userId: 'r1', name: 'Rival A', isSynthetic: true, tests: 9, totalScore: 812.4 },
    { userId: 'me', name: '  ', tests: 3, totalScore: 1 },
    { userId: 's2', name: 'Asha', tests: null, totalScore: -5 },
    null, { name: 'no id' },
  ], 'me');
  assert.deepEqual(rows.map((r) => [r.place, r.name, r.kind, r.mocks, r.points]), [
    [1, 'Rival A', 'Practice rival', 9, 812],
    [2, 'A student', 'You', 3, 1],
    [3, 'Asha', 'Student', 0, 0],
  ]);
  assert.equal(yourPlace(rows), 'You are 2nd of 3 on this board, with 1 point.');
  assert.equal(yourPlace(boardRows([{ userId: 'x' }], 'me')), null);
  assert.deepEqual(boardRows(undefined, 'me'), []);
});

test('ordinals', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
});
