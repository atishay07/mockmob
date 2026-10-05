import test from 'node:test';
import assert from 'node:assert/strict';
import { answerReview, CIRCULAR_QUEUE_CORRECTION as receipt, sameQuestionContent } from '../answer_corrections.mjs';

const before = { id: receipt.questionId, question: receipt.body, options: receipt.options, correctIndex: 0 };
const current = { id: receipt.questionId, body: receipt.body, options: receipt.options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'D', status: 'live', verification_state: 'verified' };
test('owner-reported circular queue correction shows source-backed D and B stays wrong', () => {
  const review = answerReview(before, current, { givenIndex: 1 });
  assert.equal(review.state, 'corrected'); assert.equal(review.originalIndex, 0); assert.equal(review.currentIndex, 3);
  assert.equal(review.adjustment, 0); assert.equal(review.correctedMarks, -1);
  assert.match(review.explanation, /Reason explains the Assertion/); assert.ok(review.source.url.startsWith('https://opendsa-server.cs.vt.edu/'));
  assert.equal(before.correctIndex, 0); // the original scored snapshot is never rewritten
});
test('derived adjustments handle a formerly wrong pick, formerly right pick and blank', () => {
  assert.equal(answerReview(before, current, { givenIndex: 3 }).adjustment, 6);
  assert.equal(answerReview(before, current, { givenIndex: 0 }).adjustment, -6);
  assert.equal(answerReview(before, current, { givenIndex: null }).adjustment, 0);
  assert.equal(answerReview(before, current, { givenIndex: null }).chosenIndex, null);
});
test('legacy verified flag and model agreement never establish a new correction', () => {
  const unreceipted = { ...current, id: 'another-question' };
  assert.equal(answerReview({ ...before, id: 'another-question' }, unreceipted, { givenIndex: 3 }).state, 'key_changed_unverified');
  assert.equal(answerReview(before, { ...current, correct_answer: 'B' }, { givenIndex: 3 }).state, 'key_changed_unverified');
  assert.equal(answerReview(before, { ...current, status: 'pending' }, { givenIndex: 3 }).state, 'under_review');
});
test('changed question text, reordered options and withdrawn rows do not rescore old picks', () => {
  assert.equal(answerReview(before, { ...current, body: 'A different question' }, {}).state, 'content_changed');
  assert.equal(answerReview(before, { ...current, options: [...current.options].reverse() }, {}, { evidenceEligible: true }).state, 'content_changed');
  assert.equal(answerReview(before, null, {}).state, 'withdrawn');
  assert.equal(answerReview(before, { ...current, is_deleted: true }, {}).state, 'withdrawn');
  assert.equal(sameQuestionContent(before, { ...current, passage_text: 'new context' }), false);
});
test('unchanged questions need no correction; new trusted evidence allows other checked corrections', () => {
  assert.equal(answerReview({ ...before, correctIndex: 3 }, current, {}), null);
  const reviewed = answerReview({ ...before, id: 'q2' }, { ...current, id: 'q2', explanation: 'Checked explanation' }, { givenIndex: 3 }, { evidenceEligible: true });
  assert.equal(reviewed.state, 'corrected'); assert.equal(reviewed.explanation, 'Checked explanation'); assert.equal(reviewed.scoreState, 'derived_display_only');
});
