import test from 'node:test';
import assert from 'node:assert/strict';
import { formatIdFor as sharedFormatId } from '../../src/lib/server/attemptSummary.js';
import { buildRecap, computeBests, formatIdFor, findPreviousComparable, timingReliable, RECAP_TONE_DELTA_RATIO } from '../../src/lib/server/recap.js';

let n = 0;
const qs = (prefix, k) => Array.from({ length: k }, (_, i) => ({ id: `${prefix}${i}` }));
function att({ id, at, mode = 'full', subject = 'english', correct = 10, wrong = 0, total = 20, q = `q${++n}-`, meta = {}, version = 'server_practice_v1' } = {}) {
  return { id, subject, total, correct, wrong, unattempted: total - correct - wrong, completedAt: at, questionsSnapshot: qs(q, total),
    selectionMeta: { mode, scoringVersion: version, ...meta } };
}

test('exports the tone constant', () => assert.equal(RECAP_TONE_DELTA_RATIO, 0.10));

test('formatId needs mode and server scoring; counts and duration change it', () => {
  assert.equal(formatIdFor(att({ id: 'a', mode: null })), null);
  assert.equal(formatIdFor(att({ id: 'a', version: 'legacy' })), null);
  const f = formatIdFor(att({ id: 'a' }));
  assert.ok(f);
  assert.notEqual(f, formatIdFor(att({ id: 'b', total: 25 })));
  assert.notEqual(f, formatIdFor(att({ id: 'b', mode: 'nta' })));
  assert.notEqual(f, formatIdFor(att({ id: 'b', subject: 'economics' })));
  assert.equal(f, sharedFormatId(att({ id: 'z' }))); // same formula as the B4 summary
});

test('first_mock for the first full or nta in a subject; quick does not count', () => {
  const quick = att({ id: 'q', at: 1, mode: 'quick', total: 10 });
  const m1 = att({ id: 'm1', at: 2 });
  assert.equal(buildRecap(m1, [quick, m1], {}).tone, 'first_mock');
  const m2 = att({ id: 'm2', at: 3 });
  assert.notEqual(buildRecap(m2, [quick, m1, m2], {}).tone, 'first_mock');
  const other = att({ id: 'e', at: 1, subject: 'economics' });
  assert.equal(buildRecap(m1, [other, m1], {}).tone, 'first_mock');
  assert.equal(buildRecap(quick, [quick], {}).tone, 'default');
});

test('higher and lower need previousComparable and a 10 percent of max gap', () => {
  const prev = att({ id: 'p', at: 1, correct: 10 }); // 50 of 100
  const up = att({ id: 'u', at: 2, correct: 12 });   // 60: diff 10 = exactly 10%
  const flat = att({ id: 'f', at: 2, correct: 11 });  // 55: diff 5
  const down = att({ id: 'd', at: 2, correct: 8 });   // 40
  assert.equal(buildRecap(up, [prev, up], {}).tone, 'higher');
  assert.equal(buildRecap(flat, [prev, flat], {}).tone, 'default');
  assert.equal(buildRecap(down, [prev, down], {}).tone, 'lower');
  assert.deepEqual(buildRecap(up, [prev, up], {}).previousComparable, { marks: 50, max: 100, attemptId: 'p' });
});

test('wrong answers subtract and no comparable means no higher or lower', () => {
  const prev = att({ id: 'p', at: 1, correct: 10, wrong: 4 });
  assert.equal(findPreviousComparable(att({ id: 'c', at: 2 }), [prev]).marks, 46);
  const nta = att({ id: 'n', at: 2, mode: 'nta' });
  const r = buildRecap(nta, [prev, nta], {});
  assert.equal(r.previousComparable, null);
  assert.equal(r.tone, 'default'); // an earlier full mock exists in the subject
});

test('held wins over every other tone', () => {
  const prev = att({ id: 'p', at: 1, correct: 2 });
  const cur = att({ id: 'c', at: 2, correct: 15 });
  for (const state of ['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified']) {
    assert.equal(buildRecap(cur, [prev, cur], { x: { state } }).tone, 'held');
  }
  assert.equal(buildRecap(att({ id: 'f', at: 1 }), [], { x: { state: 'withdrawn' } }).tone, 'held');
  assert.equal(buildRecap(cur, [prev, cur], { x: { state: 'corrected' } }).tone, 'higher');
});

test('held when the answer review state is not ready (unavailable), even with no review entries', () => {
  const prev = att({ id: 'p', at: 1, correct: 2 });
  const cur = att({ id: 'c', at: 2, correct: 15 });
  assert.equal(buildRecap(cur, [prev, cur], {}, 'unavailable').tone, 'held');
  assert.equal(buildRecap(att({ id: 'f', at: 1 }), [], {}, 'unavailable').tone, 'held'); // not first_mock
  assert.equal(buildRecap(cur, [prev, cur], {}, 'ready').tone, 'higher');
  assert.equal(buildRecap(cur, [prev, cur], {}).tone, 'higher');
});

test('comparability: other format, later attempts, and repeated question sets are skipped', () => {
  const cur = att({ id: 'c', at: 10, q: 'same-' });
  const retakeOfCur = att({ id: 'r', at: 5, q: 'same-' });
  const fresh = att({ id: 'fresh', at: 3 });
  const otherFmt = att({ id: 'o', at: 8, total: 25 });
  const later = att({ id: 'l', at: 20 });
  const legacy = att({ id: 'g', at: 9, version: 'legacy' });
  const prev = findPreviousComparable(cur, [retakeOfCur, fresh, otherFmt, later, legacy, cur]);
  assert.equal(prev.attemptId, 'fresh');
  assert.equal(findPreviousComparable(cur, [retakeOfCur, cur]), null);
  const partial = att({ id: 'pt', at: 6, q: 'zz-' });
  partial.questionsSnapshot = [...cur.questionsSnapshot.slice(0, 4), ...partial.questionsSnapshot.slice(4)];
  assert.equal(findPreviousComparable(cur, [partial, cur]).attemptId, 'pt');
});

test('timingReliable needs self_reported telemetry and every question visited', () => {
  const a = att({ id: 'a', total: 2 });
  const tl = [{ qid: 'x0', at: 0 }, { qid: 'x1', at: 5 }, { qid: 'x1', at: 9 }];
  a.questionsSnapshot = [{ id: 'x0' }, { id: 'x1' }];
  a.selectionMeta.recovery = { telemetry: 'self_reported', timeline: tl };
  assert.equal(timingReliable(a), true);
  a.selectionMeta.recovery = { telemetry: 'inconsistent', timeline: tl };
  assert.equal(timingReliable(a), false);
  a.selectionMeta.recovery = { telemetry: 'self_reported', timeline: [{ qid: 'x0', at: 0 }, { qid: 'x0', at: 3 }] };
  assert.equal(timingReliable(a), false);
  a.selectionMeta.recovery = undefined;
  assert.equal(timingReliable(a), false);
});

test('bests: best and latest per format, retakes excluded, no attempts no entry', () => {
  const a1 = att({ id: 'a1', at: 1, correct: 12 });
  const a2 = att({ id: 'a2', at: 2, correct: 8 });
  const retake = att({ id: 'a3', at: 3, correct: 20 });
  retake.questionsSnapshot = a2.questionsSnapshot;
  const quick = att({ id: 'k', at: 4, mode: 'quick', total: 10, correct: 5 });
  const legacy = att({ id: 'g', at: 5, version: 'x' });
  const out = computeBests([a2, retake, a1, quick, legacy]);
  const full = out.find(b => b.mode === 'full');
  assert.equal(full.attempts, 2);
  assert.deepEqual(full.best, { marks: 60, max: 100, attemptId: 'a1', completedAt: 1 });
  assert.deepEqual(full.latest, { marks: 40, max: 100, attemptId: 'a2', completedAt: 2 });
  assert.equal(out.length, 2);
  assert.deepEqual(computeBests([]), []);
});
