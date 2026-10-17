// The replay as one slot per question (REVIEW-RESULT-1018 section 6, packets P-RR0 and P-RR3): the layout rule, the
// per-question seconds, the real events and the cut rule (the owner's 58-second paper, D17).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOT_RULES, replayView, slotLayout } from '../replay.js';

test('slots are sized to the paper: 10 at 358 px is one row of 10, 50 is two rows of 25, never 10-minute rows', () => {
  assert.deepEqual(slotLayout(10, 358, SLOT_RULES.minSlotPhone), { perRow: 10, rows: 1 });
  assert.deepEqual(slotLayout(50, 358, SLOT_RULES.minSlotPhone), { perRow: 25, rows: 2 });
  assert.deepEqual(slotLayout(50, 556, SLOT_RULES.minSlotWide), { perRow: 25, rows: 2 });
  assert.deepEqual(slotLayout(50, 1000, SLOT_RULES.minSlotWide), { perRow: 50, rows: 1 });
  // Balanced rows: 26 questions that need two rows are 13 and 13, never 25 and 1.
  assert.deepEqual(slotLayout(26, 358, SLOT_RULES.minSlotPhone), { perRow: 13, rows: 2 });
});

// A 4-question paper over 6 minutes, with a visit split at the 10-minute row edge style join, time away and a change.
const replay = {
  rowSec: 600, recordSec: 360, durationSec: 480, total: 4,
  end: { at: 360, reason: 'submit' },
  opened: [{ n: 1, at: 0, result: 'right' }, { n: 2, at: 60, result: 'wrong' }, { n: 3, at: 200, result: 'blank' }, { n: 4, at: 230, result: 'right' }],
  facts: ['You opened all 4 questions.'],
  rows: [{ bars: [
    { n: 1, from: 0, to: 60, result: 'right', picks: [{ at: 40, option: 2, change: false }], away: [] },
    { n: 2, from: 60, to: 200, result: 'wrong', picks: [{ at: 100, option: 0, change: false }, { at: 180, option: 1, change: true }], away: [{ from: 120, to: 150 }] },
    { n: 3, from: 200, to: 230, result: 'blank', picks: [], away: [] },
    { n: 4, from: 230, to: 300, result: 'right', picks: [{ at: 290, option: 3, change: false }], away: [] },
    { n: 2, from: 300, to: 360, result: 'wrong', picks: [], away: [] },
  ] }],
};

test('perQuestion: seconds across visits less time away; they sum to the time on questions', () => {
  const v = replayView(replay);
  assert.deepEqual(v.perQuestion.map((q) => [q.n, q.sec, q.result, q.changed, q.visits]), [
    [1, 60, 'right', false, 1], [2, 170, 'wrong', true, 2], [3, 30, 'blank', false, 1], [4, 70, 'right', false, 1],
  ]);
  const onQuestions = replay.rows[0].bars.reduce((s, b) => s + (b.to - b.from), 0) - v.awaySec;
  assert.equal(v.perQuestion.reduce((s, q) => s + q.sec, 0), onQuestions);
  assert.equal(v.perQuestion.reduce((s, q) => s + q.sec, 0) + v.awaySec, replay.recordSec);
  assert.equal(v.answered, 3);
  assert.deepEqual([v.awaySec, v.awayCount], [30, 1]);
});

test('events are the real ones only: picks, the change, the return visit, the submit', () => {
  const v = replayView(replay);
  assert.deepEqual(v.events.map((e) => [e.at, e.n, e.kind]), [[40, 1, 'pick'], [100, 2, 'pick'], [180, 2, 'change'], [290, 4, 'pick'], [300, 2, 'back'], [360, null, 'end']]);
  const change = v.events.find((e) => e.kind === 'change');
  assert.deepEqual([change.from, change.to], [0, 1]);
  assert.equal(v.cut, null);
});

test('the cut rule: under 2 minutes, fewer than 3 answer events, or no record draws no replay', () => {
  // The owner's paper: submitted after 58 seconds.
  const short = { ...replay, recordSec: 58, end: { at: 58, reason: 'submit' }, rows: [{ bars: [{ n: 1, from: 0, to: 30, result: 'right', picks: [{ at: 20, option: 0, change: false }] }, { n: 2, from: 30, to: 58, result: 'right', picks: [{ at: 50, option: 1, change: false }] }] }] };
  assert.deepEqual(replayView(short).cut, { reason: 'short' });
  const few = { ...replay, rows: [{ bars: [{ n: 1, from: 0, to: 300, result: 'right', picks: [{ at: 20, option: 0, change: false }] }] }] };
  assert.deepEqual(replayView(few).cut, { reason: 'few' });
  assert.deepEqual(replayView(null, { total: 10 }).cut, { reason: 'none' });
});

test('a question never visited still has its slot', () => {
  const v = replayView({ ...replay, total: 5 }, { total: 5 });
  assert.equal(v.perQuestion.length, 5);
  assert.deepEqual(v.perQuestion[4], { n: 5, sec: 0, result: 'blank', changed: false, visits: 0 });
});
