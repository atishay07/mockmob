// NTA session state: what a session keeps so that a resume is exact.
//   marks for review   recorded as events like answers, accepted by the server's event validation, kept
//                      out of the scored timeline, and rebuilt on resume (progressFromEvents);
//   the clock          a signed start receipt for device-held sessions (practice_ticket.js);
//   the option layout  the engine's option order and remapped key stored with the session (ntaPaper.js).
// The route-level flows (real handlers, real fixtures) are in nta_e2e_session.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as h from './nta_e2e_harness.mjs'; // registers the '@/' and 'server-only' hooks ntaPaper.js needs
import { scoreSession, scorePracticeSubmission } from '../recovery.js';
import { progressFromEvents } from '../session_draft.js';
import { openStart, sealStart } from '../practice_ticket.js';

const { ntaOptionLayout } = await import(pathToFileURL(path.join(h.ROOT, 'src', 'lib', 'server', 'ntaPaper.js')).href);

const questions = [
  { id: 'q1', correctIndex: 0, options: ['one', 'two', 'three', 'four'] },
  { id: 'q2', correctIndex: 1, options: ['a', 'b', 'c', 'd'] },
  { id: 'q3', correctIndex: 2, options: ['w', 'x', 'y', 'z'] },
];
const ev = (seq, qid, type, extra = {}) => ({ seq, qid, type, at: seq * 10, ...extra });

// ---- marks for review ---------------------------------------------------------------------------
test('a mark for review is a valid session event and does not change the score', () => {
  const events = [ev(1, 'q1', 'visit'), ev(2, 'q1', 'mark', { marked: true }), ev(3, 'q1', 'answer', { answer: 0 }), ev(4, 'q2', 'visit')];
  const withMark = scoreSession(questions, { q1: 0 }, events, 1000);
  const without = scoreSession(questions, { q1: 0 }, events.filter((e) => e.type !== 'mark'), 1000);
  assert.equal(withMark.rawScore, without.rawScore);
  assert.equal(withMark.correct, 1);
  assert.equal(withMark.recovery.telemetry, 'self_reported');
});

test('marks stay out of the scored timeline, so they cannot split a question\'s time or look like answer changes', () => {
  const events = [ev(1, 'q1', 'visit'), ev(2, 'q1', 'answer', { answer: 0 }), ev(3, 'q1', 'mark', { marked: true }), ev(4, 'q1', 'mark', { marked: false }), ev(5, 'q2', 'visit')];
  const result = scoreSession(questions, { q1: 0 }, events, 1000);
  assert.deepEqual(result.recovery.timeline.map((e) => e.type), ['visit', 'answer', 'visit']);
  assert.deepEqual(result.recovery.observed.answerChanges, []);
});

test('a mark event is validated like every other event', () => {
  assert.throws(() => scoreSession(questions, {}, [ev(1, 'q1', 'mark', { marked: 'yes' })], 1000), /invalid_event_mark/);
  assert.throws(() => scoreSession(questions, {}, [ev(1, 'q1', 'mark')], 1000), /invalid_event_mark/);
  assert.throws(() => scoreSession(questions, {}, [ev(1, 'nope', 'mark', { marked: true })], 1000), /invalid_event_sequence/);
  assert.throws(() => scoreSession(questions, {}, [ev(1, 'q1', 'mark', { marked: true }), ev(1, 'q1', 'mark', { marked: false })], 1000), /invalid_event_sequence/);
  assert.throws(() => scoreSession(questions, {}, [ev(1, 'q1', 'mark', { marked: true, at: 5000 })], 1000), /invalid_event_sequence/);
});

test('a malformed mark never blocks a practice submission; the answers are still scored', () => {
  const result = scorePracticeSubmission(questions, { q1: 0, q2: 0 }, [ev(1, 'q1', 'mark', { marked: 'maybe' })], 1000);
  assert.equal(result.correct, 1);
  assert.equal(result.wrong, 1);
  assert.equal(result.recovery.telemetry, 'invalid');
});

test('progressFromEvents rebuilds answers, marks and visits; the latest event per question wins', () => {
  const events = [
    ev(1, 'q1', 'visit'),
    ev(2, 'q1', 'answer', { answer: 2 }), ev(3, 'q1', 'answer', { answer: null }),
    ev(4, 'q2', 'mark', { marked: true }), ev(5, 'q3', 'mark', { marked: true }), ev(6, 'q3', 'mark', { marked: false }),
    ev(7, 'q2', 'answer', { answer: 1 }),
    ev(8, 'gone', 'mark', { marked: true }),
  ];
  const progress = progressFromEvents(events, questions);
  assert.deepEqual(progress.answers, { q2: 1 }, 'a cleared answer must not come back');
  assert.deepEqual(progress.marked, { q2: true }, 'an unmarked question must not come back, nor a question not on the paper');
  assert.deepEqual([...progress.touched].sort(), ['q1', 'q2', 'q3']);
  assert.deepEqual(progressFromEvents(undefined, questions), { answers: {}, marked: {}, touched: [] });
  assert.deepEqual(progressFromEvents([null, {}, { qid: 'q1' }], questions).answers, {});
});

// ---- start receipt ------------------------------------------------------------------------------
const SECRET = 'receipt-test-practice-secret-0123456789abcdef';
test('a start receipt returns the signed start time to the same owner and session only', () => {
  const at = Date.parse('2026-10-13T10:00:00.000Z');
  const receipt = sealStart(SECRET, 'student', 'att_practice_1', at);
  assert.match(receipt, /^[0-9a-z]+-[0-9a-f]{32}$/);
  assert.equal(openStart(receipt, SECRET, 'student', 'att_practice_1'), at);
  assert.equal(openStart(receipt, SECRET, 'other', 'att_practice_1'), null, 'another student');
  assert.equal(openStart(receipt, SECRET, 'student', 'att_practice_2'), null, 'another paper or key');
  assert.equal(openStart(receipt, `${SECRET}x`, 'student', 'att_practice_1'), null, 'another secret');
});

test('a start receipt cannot be edited to move the start later', () => {
  const at = Date.parse('2026-10-13T10:00:00.000Z');
  const [time, mac] = sealStart(SECRET, 'student', 'att_practice_1', at).split('-');
  const later = (at + 3000000).toString(36);
  assert.equal(openStart(`${later}-${mac}`, SECRET, 'student', 'att_practice_1'), null);
  for (const junk of [undefined, null, '', 'abc', `${time}-`, `${time}-${'0'.repeat(32)}`, `${time}-${mac}0`, 12345, {}]) {
    assert.equal(openStart(junk, SECRET, 'student', 'att_practice_1'), null, String(junk));
  }
  assert.throws(() => sealStart(SECRET, 'student', 'x', NaN), /INVALID_START_RECEIPT/);
});

// ---- option layout ------------------------------------------------------------------------------
const served = (extra = {}, options) => ({
  id: 'n1', correctIndex: 2, correctAnswer: 'C',
  options: options || ['p', 'q', 'r', 's'].map((text, i) => ({ key: 'ABCD'[i], text })), ...extra,
});

test('an unshuffled paper stores the served key per question and says it was not shuffled', () => {
  const layout = ntaOptionLayout([served(), served({ id: 'n2', correctIndex: 0, correctAnswer: 'A' })], {});
  assert.equal(layout.shuffled, false);
  assert.deepEqual(layout.order, {});
  assert.deepEqual(layout.key, { n1: 'C', n2: 'A' });
});

test('a shuffled question keeps its option order and the remapped key (per question or per paper)', () => {
  const perQuestion = ntaOptionLayout([served({ optionOrder: [3, 0, 2, 1] })], {});
  assert.equal(perQuestion.shuffled, true);
  assert.deepEqual(perQuestion.order.n1, [3, 0, 2, 1]);
  assert.equal(perQuestion.key.n1, 'C');
  const perPaper = ntaOptionLayout([served({ option_order: undefined })], { ntaPaper: { optionOrder: { n1: [1, 0, 3, 2] } } });
  assert.deepEqual(perPaper.order.n1, [1, 0, 3, 2]);
});

test('a shuffle that is not a permutation, shows letters out of order or leaves the key behind is refused before a session exists', () => {
  const refusal = (question, reason) => assert.throws(() => ntaOptionLayout([question], {}), (error) => {
    assert.equal(error.message, 'INSUFFICIENT_PRACTICE_CONTENT');
    assert.equal(error.publicDetail.reason, reason);
    assert.match(error.publicMessage, /No credits were charged/);
    return true;
  });
  refusal(served({ optionOrder: [0, 0, 1, 2] }), 'option_order_invalid');
  refusal(served({ optionOrder: [0, 1, 2] }), 'option_order_invalid');
  refusal(served({ optionOrder: 'dcba' }), 'option_order_invalid');
  const original = ['p', 'q', 'r', 's'].map((text, i) => ({ key: 'ABCD'[i], text }));
  refusal(served({ optionOrder: [2, 0, 1, 3] }, [original[2], original[0], original[1], original[3]]), 'option_letters_not_in_order');
  // The engine moved the options and the letter but left correctIndex on the old position.
  refusal(served({ optionOrder: [1, 0, 2, 3], correctAnswer: 'A', correctIndex: 2 }), 'answer_key_not_remapped');
});

test('a stale answer key is refused even when the engine reported no shuffle', () => {
  assert.throws(() => ntaOptionLayout([served({ correctAnswer: 'B', correctIndex: 2 })], {}), /INSUFFICIENT_PRACTICE_CONTENT/);
  assert.throws(() => ntaOptionLayout([served({ correctAnswer: 'B', correctIndex: 2 })], {}, 'INSUFFICIENT_VERIFIED_CONTENT'), /INSUFFICIENT_VERIFIED_CONTENT/);
});

test('answers written as option text or number are not misread as letters', () => {
  const layout = ntaOptionLayout([served({ correctAnswer: 'r' }), served({ id: 'n2', correctAnswer: '3', correctIndex: 2 })], {});
  assert.equal(layout.key.n1, 'C');
  assert.equal(layout.key.n2, 'C');
});

// ---- the engine's own served rows ---------------------------------------------------------------
const { ntaServedRow } = await import(pathToFileURL(path.join(h.ROOT, 'data', 'nta_item_checks.js')).href);
const stored = (extra = {}) => ({
  id: 'row-1', subject: 'physics', chapter: 'Optics', question: 'Which colour of visible light has the shortest wavelength?',
  options: [{ key: 'A', text: 'Red' }, { key: 'B', text: 'Green' }, { key: 'C', text: 'Violet' }, { key: 'D', text: 'Yellow' }],
  correct_answer: 'C', correct_index: 2, explanation: 'Violet has the shortest wavelength.', ...extra,
});
// What Database.getNtaPaper hands the session for a served row.
const asQuestion = (row) => ({ id: row.id, options: row.options, correctIndex: row.correct_index, correctAnswer: row.correct_answer,
  optionOrder: Array.isArray(row.nta_option_order) ? row.nta_option_order : null, optionsShuffled: row.nta_options_shuffled === true });

test('rows served by the engine become a layout whose key points at the same option text as in the bank', () => {
  let moved = 0;
  for (let n = 0; n < 40; n++) {
    const row = stored({ id: `row-${n}` });
    const { row: servedRow, shuffled } = ntaServedRow(row, `session-key-${n}`);
    const layout = ntaOptionLayout([asQuestion(servedRow)], {});
    const order = layout.order[row.id];
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
    assert.equal(servedRow.options[servedRow.correct_index].text, 'Violet', 'the remapped key must still point at the stored answer');
    assert.equal(order[servedRow.correct_index], 2, 'served position i shows stored option order[i]');
    assert.equal(layout.key[row.id], 'ABCD'[servedRow.correct_index]);
    assert.deepEqual(servedRow.options.map((o) => o.key), ['A', 'B', 'C', 'D']);
    assert.equal(layout.shuffled, order.some((original, position) => original !== position));
    if (shuffled) moved += 1;
  }
  assert.ok(moved > 20, `the engine moved the options of only ${moved} of 40 questions`);
});

test('the same session key serves the same order, so a resume or a replay matches what was scored', () => {
  const one = ntaOptionLayout([asQuestion(ntaServedRow(stored(), 'same-key').row)], {});
  const two = ntaOptionLayout([asQuestion(ntaServedRow(stored(), 'same-key').row)], {});
  assert.deepEqual(one, two);
});

test('options that name other options stay in place: the layout is the identity and says nothing was shuffled', () => {
  const pinned = stored({ id: 'pinned', options: [{ key: 'A', text: 'Red' }, { key: 'B', text: 'Green' }, { key: 'C', text: 'Violet' }, { key: 'D', text: 'All of the above' }], correct_answer: 'D', correct_index: 3 });
  const served = ntaServedRow(pinned, 'any-key');
  assert.equal(served.shuffled, false);
  const layout = ntaOptionLayout([asQuestion(served.row)], {});
  assert.deepEqual(layout.order.pinned, [0, 1, 2, 3]);
  assert.equal(layout.shuffled, false);
  assert.equal(layout.key.pinned, 'D');
});
