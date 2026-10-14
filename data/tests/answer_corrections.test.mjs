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
test('changed question text, edited options and withdrawn rows do not rescore old picks', () => {
  assert.equal(answerReview(before, { ...current, body: 'A different question' }, {}).state, 'content_changed');
  // Options that were edited (not merely reordered: that case is covered by the shuffled-snapshot tests below) are a content change.
  assert.equal(answerReview(before, { ...current, options: [...current.options].reverse().map((o, i) => (i === 0 ? { ...o, text: 'An edited option' } : o)) }, {}, { evidenceEligible: true }).state, 'content_changed');
  assert.equal(answerReview(before, null, {}).state, 'withdrawn');
  assert.equal(answerReview(before, { ...current, is_deleted: true }, {}).state, 'withdrawn');
  assert.equal(sameQuestionContent(before, { ...current, passage_text: 'new context' }), false);
});
test('unchanged questions need no correction; new trusted evidence allows other checked corrections', () => {
  assert.equal(answerReview({ ...before, correctIndex: 3 }, current, {}), null);
  const reviewed = answerReview({ ...before, id: 'q2' }, { ...current, id: 'q2', explanation: 'Checked explanation' }, { givenIndex: 3 }, { evidenceEligible: true });
  assert.equal(reviewed.state, 'corrected'); assert.equal(reviewed.explanation, 'Checked explanation'); assert.equal(reviewed.scoreState, 'derived_display_only');
});

// ---- NTA shuffled snapshots (audit 14 Oct 2026, readAnswerReviews) ----
// The attempt snapshot holds the options in SERVED order with the key remapped; the live row holds the
// STORED order and may still carry the letter prefixes the served text dropped.
const stored = ['Debit the asset', 'Credit the asset', 'Debit the capital', 'Credit the capital'];
const order = [2, 0, 3, 1]; // served position i shows stored option order[i]
const storedKey = 1;
const servedKey = order.indexOf(storedKey);
const snapshotOf = (over = {}) => ({ id: 'n1', question: 'Which entry records the purchase?', options: order.map((i, p) => ({ key: 'ABCD'[p], text: stored[i] })), correctIndex: servedKey, correctAnswer: 'ABCD'[servedKey], optionOrder: order, optionsShuffled: true, ...over });
const liveOf = (over = {}) => ({ id: 'n1', question: 'Which entry records the purchase?', options: stored.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'ABCD'[storedKey], status: 'live', verification_state: 'verified', ...over });

test('a shuffled NTA snapshot against its own unchanged live row needs no correction (it used to read content_changed)', () => {
  assert.equal(answerReview(snapshotOf(), liveOf(), { givenIndex: 0 }), null);
  const prefixed = liveOf({ options: stored.map((text, i) => ({ key: 'ABCD'[i], text: `${'ABCD'[i]}. ${text}` })) });
  assert.equal(answerReview(snapshotOf(), prefixed, { givenIndex: 0 }), null, 'stored letter prefixes are not a content change');
});

test('a really changed key on a shuffled snapshot is reported in the SERVED order the student saw', () => {
  // The live key moves to stored option 3 ("Credit the capital"), which was served at position 2.
  const changed = liveOf({ correct_answer: 'D' });
  const unverified = answerReview(snapshotOf(), changed, { givenIndex: 0 });
  assert.equal(unverified.state, 'key_changed_unverified');
  assert.equal(unverified.originalIndex, servedKey);
  assert.equal(unverified.currentIndex, order.indexOf(3), 'mapped back to served position');
  const corrected = answerReview(snapshotOf(), changed, { givenIndex: order.indexOf(3) }, { evidenceEligible: true });
  assert.equal(corrected.state, 'corrected');
  assert.equal(corrected.currentIndex, order.indexOf(3));
  assert.equal(corrected.correctedMarks, 5, 'a student who picked the corrected option is scored against served positions');
  assert.equal(corrected.originalMarks, -1);
});

test('reordered live options that keep the same key option do not rescore anything; a reorder that moves the key does', () => {
  const reversed = [...before.options].reverse().map((text, i) => ({ key: 'ABCD'[i], text }));
  assert.equal(answerReview(before, { ...current, options: reversed, correct_answer: 'D' }, {}, { evidenceEligible: true }), null, 'same option is still the key');
  const moved = answerReview(before, { ...current, options: reversed, correct_answer: 'A' }, { givenIndex: 3 }, { evidenceEligible: true });
  assert.equal(moved.state, 'corrected');
  assert.equal(moved.currentIndex, 3, 'live letter A now names the option the snapshot served at position 3');
});

test('changed option text, changed question text and a different option count are still content changes', () => {
  assert.equal(answerReview(snapshotOf(), liveOf({ options: stored.map((text, i) => ({ key: 'ABCD'[i], text: i === 0 ? 'Something else' : text })) }), {}).state, 'content_changed');
  assert.equal(answerReview(snapshotOf(), liveOf({ question: 'A different question?' }), {}).state, 'content_changed');
  assert.equal(answerReview(snapshotOf(), liveOf({ options: stored.slice(0, 3).map((text, i) => ({ key: 'ABC'[i], text })) }), {}).state, 'content_changed');
});
