import test from 'node:test';
import assert from 'node:assert/strict';
import { applyViolation, readStoredStrikes, INTEGRITY_STRIKES } from '../exam_integrity.mjs';
import { isKeyReview, keyReviewEvidence } from '../repair_presentation.mjs';

test('two warnings, the third strike ends the session', () => {
  assert.deepEqual(applyViolation(0), { count: 1, phase: 'warning', remaining: 2 });
  assert.deepEqual(applyViolation(1), { count: 2, phase: 'warning', remaining: 1 });
  assert.deepEqual(applyViolation(2), { count: 3, phase: 'terminated', remaining: 0 });
  assert.equal(INTEGRITY_STRIKES, 3);
});
test('stored strikes are sanitised', () => {
  assert.equal(readStoredStrikes(null), 0);
  assert.equal(readStoredStrikes('abc'), 0);
  assert.equal(readStoredStrikes('2'), 2);
  assert.equal(readStoredStrikes('99'), 3);
});
test('key review covers fresh disputes and already-held questions only', () => {
  assert.equal(isKeyReview('held_for_recheck'), true);
  assert.equal(isKeyReview(null, 'question_under_review'), true);
  assert.equal(isKeyReview('explained'), false);
  assert.equal(isKeyReview(null, 'key_changed'), false);
});
test('evidence rows never call a model check proof; agreement is only against the key', () => {
  const rows = keyReviewEvidence({ chosenIndex: 0, keyIndex: 1, dispute: { ourIndex: 2, secondIndex: 2 } });
  assert.deepEqual(rows.map(r => [r.id, r.letter, r.agree]), [['you', 'A', undefined], ['key', 'B', undefined], ['check1', 'C', false], ['check2', 'C', false]]);
  assert.equal(keyReviewEvidence({ chosenIndex: 0, keyIndex: 1 }).length, 2);
});
