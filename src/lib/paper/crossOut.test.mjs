// node --test src/lib/paper/crossOut.test.mjs
// Crossed-out options (18 Nov 2026, lane runner): add, bring back, the chosen-answer refusal, the stored entry, its cap, and
// clearing when the paper ends or another starts. The answer is never this module's to touch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CROSS_OUT_LIMITS, CROSS_OUT_PREFIX, CROSS_OUT_WORDS, NO_CROSS_OUTS, bringBack, crossOutKey, crossOutKeysToClear, crossedOn,
  isCrossedOut, parseCrossOut, serialiseCrossOut, toggleCrossOut,
} from './crossOut.mjs';

const FOUR = { optionCount: 4 };

test('crossing out adds the option; again brings it back; options stay in order, never twice', () => {
  let { state, outcome } = toggleCrossOut(NO_CROSS_OUTS, 'q1', 2, FOUR);
  assert.equal(outcome, 'crossed');
  assert.deepEqual(state, { q1: [2] });
  ({ state, outcome } = toggleCrossOut(state, 'q1', 0, FOUR));
  assert.equal(outcome, 'crossed');
  assert.deepEqual(crossedOn(state, 'q1'), [0, 2]);
  assert.equal(isCrossedOut(state, 'q1', 0), true);
  assert.equal(isCrossedOut(state, 'q2', 0), false);
  ({ state, outcome } = toggleCrossOut(state, 'q1', 2, FOUR));
  assert.equal(outcome, 'restored');
  assert.deepEqual(state, { q1: [0] });
  ({ state, outcome } = toggleCrossOut(state, 'q1', 0, FOUR));
  assert.deepEqual(state, {}, 'a question with nothing crossed out leaves the state');
});

test('never mutated: every change is a new object', () => {
  const before = Object.freeze({ q1: Object.freeze([1]) });
  const { state } = toggleCrossOut(before, 'q1', 3, FOUR);
  assert.deepEqual(before, { q1: [1] });
  assert.notEqual(state, before);
  assert.deepEqual(state, { q1: [1, 3] });
  const back = bringBack(state, 'q1', 1);
  assert.deepEqual(state, { q1: [1, 3] });
  assert.deepEqual(back, { q1: [3] });
});

test('the chosen answer is refused, and nothing changes: the answer is never this tool\'s to touch', () => {
  const start = { q1: [3] };
  const { state, outcome } = toggleCrossOut(start, 'q1', 1, { chosen: 1, optionCount: 4 });
  assert.equal(outcome, 'refused');
  assert.equal(state, start, 'the very same state');
  assert.equal(CROSS_OUT_WORDS.refused, 'That is your chosen answer. Choose another option first.');
  assert.equal(CROSS_OUT_WORDS.on, 'Tap an option to cross it out. Tap it again to bring it back.');
  // Another option of the same question is still crossed out; option 0 is not the chosen one.
  assert.equal(toggleCrossOut(start, 'q1', 0, { chosen: 1, optionCount: 4 }).outcome, 'crossed');
  // No answer yet (undefined) and the answer 0 are different things.
  assert.equal(toggleCrossOut({}, 'q1', 0, { chosen: undefined, optionCount: 4 }).outcome, 'crossed');
  assert.equal(toggleCrossOut({}, 'q1', 0, { chosen: 0, optionCount: 4 }).outcome, 'refused');
});

test('choosing a crossed-out option brings it back; choosing another changes nothing', () => {
  const state = { q1: [0, 2], q2: [1] };
  assert.deepEqual(bringBack(state, 'q1', 2), { q1: [0], q2: [1] });
  assert.equal(bringBack(state, 'q1', 3), state, 'not crossed out: the same state');
  assert.equal(bringBack(state, 'q9', 0), state);
  assert.deepEqual(bringBack({ q1: [2] }, 'q1', 2), {});
});

test('only an option the question has, on a real question (the server refuses any other index)', () => {
  for (const [qid, option, count] of [['q1', 4, 4], ['q1', -1, 4], ['q1', 1.5, 4], ['q1', '1', 4], ['', 0, 4], [null, 0, 4], ['q1', 0, 0], ['x'.repeat(200), 0, 4], ['q1', 5, 9]]) {
    const { state, outcome } = toggleCrossOut({}, qid, option, { optionCount: count });
    assert.equal(outcome, 'ignored', `${String(qid).slice(0, 8)} ${option} of ${count}`);
    assert.deepEqual(state, {});
  }
});

test('the cap: no more questions than any paper has', () => {
  let state = {};
  for (let i = 0; i < CROSS_OUT_LIMITS.questions; i += 1) state = toggleCrossOut(state, `q${i}`, 0, FOUR).state;
  assert.equal(Object.keys(state).length, CROSS_OUT_LIMITS.questions);
  const over = toggleCrossOut(state, 'one-more', 0, FOUR);
  assert.equal(over.outcome, 'ignored');
  assert.equal(over.state, state);
  // A question already in the state can still change.
  assert.equal(toggleCrossOut(state, 'q3', 1, FOUR).outcome, 'crossed');
  assert.equal(toggleCrossOut(state, 'q3', 0, FOUR).outcome, 'restored');
});

test('serialise and read back the same paper\'s marks; nothing to keep is no entry', () => {
  const state = { q1: [0, 2], q7: [3] };
  const text = serialiseCrossOut(state);
  assert.equal(typeof text, 'string');
  assert.deepEqual(JSON.parse(text), { v: 1, q: { q1: [0, 2], q7: [3] } });
  assert.deepEqual(parseCrossOut(text), state);
  assert.equal(serialiseCrossOut({}), null);
  assert.equal(serialiseCrossOut(null), null);
  assert.equal(serialiseCrossOut({ q1: [] }), null);
  assert.ok(text.length < CROSS_OUT_LIMITS.bytes);
  // A full paper with every option but one crossed out is far under the byte cap.
  const full = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`3f2a1c9e-1b2c-4d5e-8f90-${String(i).padStart(12, '0')}`, [0, 1, 2]]));
  assert.ok(serialiseCrossOut(full).length < CROSS_OUT_LIMITS.bytes);
  assert.deepEqual(parseCrossOut(serialiseCrossOut(full)), full);
});

test('serialising keeps within the cap and drops what is not a cross-out', () => {
  const messy = { q1: [2, 2, 0, 9, -1, 'x'], q2: 'nope', '': [1], q3: [] };
  assert.deepEqual(JSON.parse(serialiseCrossOut(messy)).q, { q1: [0, 2] });
  const many = Object.fromEntries(Array.from({ length: CROSS_OUT_LIMITS.questions + 40 }, (_, i) => [`q${i}`, [1]]));
  assert.equal(Object.keys(JSON.parse(serialiseCrossOut(many)).q).length, CROSS_OUT_LIMITS.questions);
});

test('reading back drops a broken entry, another paper\'s questions, options a question lacks, and its chosen answer', () => {
  for (const raw of [null, '', 'not json', '[]', '{"v":2,"q":{"q1":[1]}}', '{"v":1}', '{"v":1,"q":[]}', 'x'.repeat(CROSS_OUT_LIMITS.bytes + 1)]) {
    assert.equal(parseCrossOut(raw), NO_CROSS_OUTS, String(raw).slice(0, 20));
  }
  const raw = serialiseCrossOut({ q1: [0, 3], q2: [1, 2], gone: [0] });
  const questions = [{ id: 'q1', options: ['a', 'b', 'c'] }, { id: 'q2', options: ['a', 'b', 'c', 'd'] }];
  assert.deepEqual(parseCrossOut(raw, { questions }), { q1: [0], q2: [1, 2] }, 'q1 has no fourth option; "gone" is not on this paper');
  assert.deepEqual(parseCrossOut(raw, { questions, answers: { q2: 2 } }), { q1: [0], q2: [1] }, 'the chosen answer is never shown crossed out');
  assert.deepEqual(parseCrossOut(raw, { questions, answers: { q1: 0 } }), { q2: [1, 2] });
});

test('one entry per paper: its generation key, or the session a resume link names', () => {
  assert.equal(crossOutKey({ generationKey: 'abc-123456789' }), `${CROSS_OUT_PREFIX}g.abc-123456789`);
  assert.equal(crossOutKey({ generationKey: 'abc-123456789', sessionId: 's-1' }), `${CROSS_OUT_PREFIX}s.s-1`);
  assert.equal(crossOutKey({}), null);
  assert.equal(crossOutKey(), null);
  assert.ok(!crossOutKey({ generationKey: 'k' }).startsWith('mm:test:'), 'never the draft\'s keys');
});

test('cleared when another paper starts (every other paper\'s entry) and when the paper ends (all of them); nothing else is named', () => {
  const mine = crossOutKey({ generationKey: 'paper-two-0001' });
  const other = crossOutKey({ generationKey: 'paper-one-0001' });
  const keys = [mine, other, 'mm:postTest', 'mm:nta:started:x', 'mm:test:student-1:paper:g.paper-two-0001', `${CROSS_OUT_PREFIX}s.old`, null, 7];
  assert.deepEqual(crossOutKeysToClear(keys, { keep: mine }), [other, `${CROSS_OUT_PREFIX}s.old`]);
  assert.deepEqual(crossOutKeysToClear(keys), [mine, other, `${CROSS_OUT_PREFIX}s.old`]);
  assert.deepEqual(crossOutKeysToClear(null), []);
});

test('the module stands apart from the answers: it imports nothing, least of all the draft', () => {
  const source = readFileSync(new URL('./crossOut.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m, 'no imports at all');
  assert.doesNotMatch(source, /draft\.mjs|session_draft|localStorage|fetch\(|apiPost|\/api\//, 'no draft, no storage of the answers, no request');
});
