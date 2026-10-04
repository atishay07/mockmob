import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoPlayback } from '../demo_playback.mjs';
import { repairProgress, repairLabel, repairRetryPolicy } from '../repair_presentation.mjs';

function time() {
  let at = 0, id = 0;
  const jobs = new Map();
  return {
    now: () => at,
    schedule(fn, delay) { const key = ++id; jobs.set(key, { fn, at: at + delay }); return key; },
    cancel(key) { jobs.delete(key); },
    advance(ms) {
      const until = at + ms;
      for (;;) {
        const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        at = next[1].at; jobs.delete(next[0]); next[1].fn();
      }
      at = until;
    },
    pending: () => jobs.size,
  };
}

test('demo resumes at visible elapsed time after a long hidden period', () => {
  const t = time(), shown = [];
  const clock = createDemoPlayback([{ at: 0, value: 0 }, { at: 1000, value: 1 }, { at: 2000, value: 2 }], n => shown.push(n), t);
  clock.resume(); t.advance(400); clock.pause();
  t.advance(60000); assert.deepEqual(shown, [0]); assert.equal(t.pending(), 0);
  clock.resume(); t.advance(599); assert.deepEqual(shown, [0]);
  t.advance(1); assert.deepEqual(shown, [0, 1]);
  t.advance(1000); assert.deepEqual(shown, [0, 1, 2]); assert.equal(t.pending(), 0);
  clock.resume(); t.advance(60000); assert.deepEqual(shown, [0, 1, 2]);
});
test('repeated resume is idempotent and unmount cancels pending changes', () => {
  const t = time(), shown = [];
  const clock = createDemoPlayback([{ at: 100, value: 'answer' }], n => shown.push(n), t);
  clock.resume(); clock.resume(); assert.equal(t.pending(), 1);
  clock.dispose(); clock.resume(); t.advance(10000); assert.deepEqual(shown, []);
});
test('held and unexplained questions never count as explanations or repeat in the automatic queue', () => {
  const mistakes = [1, 2, 3, 4, 5].map(id => ({ q: { id }, number: id }));
  const progress = repairProgress(mistakes, { 1: 'explained', 2: 'stored', 3: 'held_for_recheck', 4: 'not_explained' });
  assert.equal(progress.explained, 2); assert.equal(progress.held, 2);
  assert.equal(progress.next.number, 5); assert.equal(progress.handled.size, 4);
  assert.equal(repairLabel('held_for_recheck'), 'Held for review');
  assert.equal(repairLabel('not_explained'), 'No explanation');
});
test('an unknown response stays eligible for retry and is never presented as repaired', () => {
  const progress = repairProgress([{ q: { id: 'q1' }, number: 1 }], { q1: 'unexpected' });
  assert.equal(progress.explained, 0); assert.equal(progress.handled.size, 0);
  assert.equal(progress.next.number, 1); assert.equal(repairLabel('unexpected'), null);
});
test('uncertain server failures keep the request identity; only a confirmed release permits a fresh retry', () => {
  assert.deepEqual(repairRetryPolicy(502, undefined), { resetRequest: false, canRetry: true });
  assert.deepEqual(repairRetryPolicy(409, 'operation_released'), { resetRequest: true, canRetry: true });
  assert.deepEqual(repairRetryPolicy(409, 'in_progress'), { resetRequest: false, canRetry: true });
  assert.deepEqual(repairRetryPolicy(409, 'conflict'), { resetRequest: false, canRetry: false });
  assert.deepEqual(repairRetryPolicy(402, 'insufficient_ai_credits'), { resetRequest: false, canRetry: false });
});
