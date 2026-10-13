import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepairRecord, mistakeKey, parseLimit, repairIdFromOperationKey } from '../../src/lib/server/repairRecord.js';

const U = 'u1';
const open = { content: true, authenticatedJourney: true };
const att = (id, at, wrongIds, chapter = 'Ch1') => ({
  id, subject: 'english', completed_at: at,
  details: [...wrongIds.map(q => ({ qid: q, isCorrect: false, givenIndex: 1 })), { qid: 'ok', isCorrect: true, givenIndex: 0 }],
  questions_snapshot: [...wrongIds, 'ok'].map(q => ({ id: q, chapter, options: ['a', 'b'], correct: 0, explanation: 'SECRET' })),
});
const res = (a, q, at, req = 'r'.repeat(16), receipt = { repair: { key_idea: 'SECRET' } }) =>
  ({ operation_key: `repair:${mistakeKey(U, a, q)}:${req}`, updated_at: at, receipt });

test('maps a stored repair to a row, newest repair first, without keys or explanations', () => {
  const rows = buildRepairRecord({
    userId: U,
    reservations: [res('a1', 'q1', '2026-10-10T10:00:00Z'), res('a2', 'q2', '2026-10-11T10:00:00Z')],
    attempts: [att('a1', '2026-10-09T09:00:00Z', ['q1', 'q9']), att('a2', '2026-10-11T08:00:00Z', ['q2'], 'Ch2')],
  });
  assert.deepEqual(rows.map(r => r.attemptId), ['a2', 'a1']);
  assert.deepEqual(rows[0], { attemptId: 'a2', questionId: 'q2', chapter: 'Ch2', subject: 'english', foundAt: '2026-10-11T08:00:00.000Z', repairedAt: '2026-10-11T10:00:00.000Z', checkedState: 'not_available', retriedAt: null });
  assert.ok(!/SECRET|correct|options|explanation|key_idea/i.test(JSON.stringify(rows)));
});

test('checkedState follows the recovery gate', () => {
  const base = { userId: U, reservations: [res('a1', 'q1', '2026-10-10T10:00:00Z')], attempts: [att('a1', '2026-10-09T09:00:00Z', ['q1'])] };
  assert.equal(buildRepairRecord(base)[0].checkedState, 'not_available');
  assert.equal(buildRepairRecord({ ...base, gates: open })[0].checkedState, 'pending');
  const id = mistakeKey(U, 'a1', 'q1');
  assert.equal(buildRepairRecord({ ...base, gates: open, checks: new Map([[id, 'passed']]) })[0].checkedState, 'passed');
  assert.equal(buildRepairRecord({ ...base, gates: open, checks: new Map([[id, 'not_passed']]) })[0].checkedState, 'not_passed');
  assert.equal(buildRepairRecord({ ...base, checks: new Map([[id, 'passed']]) })[0].checkedState, 'not_available');
});

test('ignores other users, receipts without a repair, correct answers and bad keys', () => {
  const rows = buildRepairRecord({
    userId: U,
    reservations: [
      { operation_key: `repair:${mistakeKey('other', 'a1', 'q1')}:xxxxxxxxxxxxxxxx`, updated_at: '2026-10-10T10:00:00Z', receipt: { repair: {} } },
      res('a1', 'q3', '2026-10-10T10:00:00Z', 'r'.repeat(16), {}),
      res('a1', 'ok', '2026-10-10T10:00:00Z'),
      { operation_key: 'prepos:abc', updated_at: '2026-10-10T10:00:00Z', receipt: { repair: {} } },
    ],
    attempts: [att('a1', '2026-10-09T09:00:00Z', ['q1', 'q3'])],
  });
  assert.deepEqual(rows, []);
});

test('repeated receipts for one mistake give one row with the latest acknowledgment; limit applies', () => {
  const rows = buildRepairRecord({
    userId: U,
    reservations: [res('a1', 'q1', '2026-10-10T10:00:00Z', 'a'.repeat(16)), res('a1', 'q1', '2026-10-12T10:00:00Z', 'b'.repeat(16)), res('a1', 'q2', '2026-10-11T10:00:00Z')],
    attempts: [att('a1', '2026-10-09T09:00:00Z', ['q1', 'q2'])],
    limit: 1,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].questionId, 'q1');
  assert.equal(rows[0].repairedAt, '2026-10-12T10:00:00.000Z');
});

test('missing chapter is null; helpers parse input', () => {
  const a = att('a1', '2026-10-09T09:00:00Z', ['q1']);
  delete a.questions_snapshot[0].chapter;
  assert.equal(buildRepairRecord({ userId: U, reservations: [res('a1', 'q1', '2026-10-10T10:00:00Z')], attempts: [a] })[0].chapter, null);
  assert.equal(parseLimit(null), 50);
  assert.equal(parseLimit('500'), 100);
  assert.equal(parseLimit('0'), null);
  assert.equal(parseLimit('x'), null);
  assert.equal(repairIdFromOperationKey(`repair:${mistakeKey(U, 'a', 'q')}:r`), mistakeKey(U, 'a', 'q'));
  assert.equal(repairIdFromOperationKey('nope'), null);
});
