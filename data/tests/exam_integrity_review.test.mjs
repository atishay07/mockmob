import test from 'node:test';
import assert from 'node:assert/strict';
import { applyViolation, readStoredStrikes, INTEGRITY_STRIKES, BRIEF_INTERRUPTION_MS, createIntegrityMonitor } from '../exam_integrity.mjs';
import { readFileSync } from 'node:fs';
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
test('fullscreen exit, blur and hidden coalesce; the third separate episode terminates once', () => {
  const warnings = []; let submits = 0;
  const monitor = createIntegrityMonitor({ onViolation: event => warnings.push(event), onTerminate: () => submits++ });
  assert.equal(monitor.violation('blur'), null); // permission/setup is not a strike
  monitor.enter(); monitor.violation('fullscreen'); monitor.violation('hidden'); monitor.violation('blur');
  assert.equal(monitor.count, 1); assert.equal(warnings.length, 1);
  monitor.enter(); monitor.violation('blur'); monitor.returned(); monitor.violation('hidden');
  assert.equal(monitor.count, 3); assert.equal(submits, 1);
  monitor.returned(); monitor.violation('blur'); assert.equal(submits, 1);
});
test('restored strikes continue and intentional submission cleanup does not add a strike', () => {
  let submits = 0;
  const monitor = createIntegrityMonitor({ count: 2, onTerminate: () => submits++ });
  monitor.enter(); monitor.violation('fullscreen'); assert.equal(submits, 1);
  const finished = createIntegrityMonitor({ count: 1 });
  finished.enter(); finished.stop(); assert.equal(finished.violation('fullscreen'), null); assert.equal(finished.count, 1);
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

// A fake clock for the brief-interruption rule: timers run when the test advances time.
function fakeClock() {
  let now = 0; let seq = 0; const timers = new Map();
  return {
    setTimer: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimer: (id) => { timers.delete(id); },
    advance(ms) { now += ms; for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } },
  };
}

test('W-023: a lost focus under 3 s is not a warning; one that lasts 3 s or more is', () => {
  assert.equal(BRIEF_INTERRUPTION_MS, 3000);
  const clock = fakeClock(); const warnings = [];
  const monitor = createIntegrityMonitor({ onViolation: (v) => warnings.push(v), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  monitor.enter();
  monitor.lostFocus(); clock.advance(2000); monitor.returned(); clock.advance(5000);
  assert.equal(monitor.count, 0, 'a 2 s blur adds no strike');
  monitor.lostFocus(); clock.advance(4000);
  assert.equal(monitor.count, 1, 'a 4 s blur adds one strike');
  assert.equal(warnings[0].reason, 'blur');
});

test('W-023: a real tab or app switch counts at once and cancels the pending blur, so it is never counted twice', () => {
  const clock = fakeClock();
  const monitor = createIntegrityMonitor({ setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  monitor.enter();
  monitor.lostFocus(); monitor.violation('hidden');
  assert.equal(monitor.count, 1, 'hidden counts immediately');
  assert.equal(monitor.pendingBlur, false);
  clock.advance(5000);
  assert.equal(monitor.count, 1, 'the blur that came with it does not add a second strike');
  monitor.returned(); monitor.violation('fullscreen');
  assert.equal(monitor.count, 2, 'a fullscreen exit counts immediately');
});

test('W-023: the timer re-checks real focus, three warnings end it, and no warning comes after the end', () => {
  const clock = fakeClock(); let submits = 0;
  const monitor = createIntegrityMonitor({ count: 2, onTerminate: () => submits++, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  monitor.enter();
  monitor.lostFocus(() => false); clock.advance(4000);
  assert.equal(monitor.count, 2, 'focus already back when the timer fired: no strike');
  monitor.lostFocus(); clock.advance(3000);
  assert.equal(monitor.count, 3); assert.equal(submits, 1);
  monitor.returned(); monitor.lostFocus(); clock.advance(4000); monitor.violation('hidden');
  assert.equal(monitor.count, 3); assert.equal(submits, 1);
});

test('W-018: the NTA entry dialog carries no proctoring or privacy filler line', () => {
  const guard = readFileSync(new URL('../../src/components/arena/ExamIntegrityGuard.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(guard, /server-verified|proctoring|privacy|screen ?capture|screenshot/i);
  assert.doesNotMatch(guard, /ei-fine/);
});
