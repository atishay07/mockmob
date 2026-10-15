// Slice 2 capture (spec tmp/mistake-lab-v4/SPEC.md 6): the server accepts end, away, back, strike and via on a visit,
// keeps marks, and stores the runner and how the session ended. Old payloads must score byte for byte as before:
// the golden file was frozen from the scorer at web/alive-1015 eeeaca20 (scripts/paper-trace/freeze-score-golden.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreSession, scorePracticeSubmission, clientMeta, endedByOf, submitMeta, lateTimeUpEnd, SESSION_EVENT_TYPES, VISIT_VIA, END_REASONS, MAX_EVENT_BYTES } from '../recovery.js';
import { readTrace, questionTraceLines } from '../paper_trace.js';
import { scoreExpiredSession } from '../../src/lib/server/sessionFinaliser.js';
import { progressFromEvents } from '../session_draft.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(HERE, 'fixtures', 'capture', 'score_session_golden_v1.json'), 'utf8'));

const qs = [
  { id: 'q1', correctIndex: 0, options: ['one', 'two', 'three', 'four'] },
  { id: 'q2', correctIndex: 1, options: ['a', 'b', 'c', 'd'] },
  { id: 'q3', correctIndex: 2, options: ['w', 'x', 'y', 'z'] },
];
const ev = (seq, qid, type, extra = {}) => ({ seq, qid, type, at: seq * 1000, ...extra });
const fullRecord = () => [
  ev(1, 'q1', 'visit'), ev(2, 'q1', 'strike', { option: 1, on: true }), ev(3, 'q1', 'answer', { answer: 0 }),
  ev(4, 'q1', 'mark', { marked: true }), ev(5, 'q1', 'away'), ev(6, 'q1', 'back'),
  ev(7, 'q2', 'visit', { via: 'next' }), ev(8, 'q2', 'answer', { answer: 3 }), ev(9, 'q1', 'visit', { via: 'palette' }),
  ev(10, 'q1', 'end', { reason: 'submit' }),
];

test('old payloads score byte for byte as they did before slice 2 (marks now kept beside them)', () => {
  assert.ok(golden.payloads.length >= 9);
  for (const p of golden.payloads) {
    const score = p.scorer === 'practice' ? scorePracticeSubmission : scoreSession;
    const now = score(p.questions, p.answers, p.events, p.durationMs ?? Infinity);
    const hasMarks = p.events.some((e) => e.type === 'mark');
    if (!hasMarks) assert.equal(JSON.stringify(now), JSON.stringify(p.output), p.name);
    else {
      assert.ok(Array.isArray(now.recovery.marks), `${p.name} keeps its marks`);
      const { marks, ...rest } = now.recovery;
      assert.equal(JSON.stringify({ ...now, recovery: rest }), JSON.stringify(p.output), p.name);
    }
  }
});

test('the new event types are accepted and kept beside the unchanged timeline', () => {
  const s = scoreSession(qs, { q1: 0, q2: 3 }, fullRecord(), 60000);
  assert.equal(s.rawScore, 4);
  assert.equal(s.recovery.telemetry, 'self_reported');
  assert.deepEqual(s.recovery.timeline.map((e) => e.type), ['visit', 'answer', 'visit', 'answer', 'visit']);
  assert.equal(s.recovery.timeline[2].via, 'next');
  assert.equal('via' in s.recovery.timeline[0], false, 'a visit without via stays exactly as before');
  assert.deepEqual(s.recovery.marks, [{ seq: 4, qid: 'q1', at: 4000, marked: true }]);
  assert.deepEqual(s.recovery.presence, [{ seq: 5, qid: 'q1', at: 5000, type: 'away' }, { seq: 6, qid: 'q1', at: 6000, type: 'back' }]);
  assert.deepEqual(s.recovery.strikes, [{ seq: 2, qid: 'q1', at: 2000, option: 1, on: true }]);
  assert.deepEqual(s.recovery.end, { seq: 10, qid: 'q1', at: 10000, reason: 'submit' });
  assert.deepEqual(s.recovery.observed.answerChanges, []);
  // Stored keys sit after the timeline and before the recommendation; absent ones are not written at all.
  assert.deepEqual(Object.keys(s.recovery), ['version', 'scoring', 'telemetry', 'observed', 'timeline', 'marks', 'presence', 'strikes', 'end', 'recommendation']);
});

test('an end counts only as the last event; an end followed by more events is accepted and not stored', () => {
  const events = [ev(1, 'q1', 'visit'), ev(2, 'q1', 'end', { reason: 'submit' }), ev(3, 'q2', 'visit'), ev(4, 'q2', 'answer', { answer: 1 })];
  const s = scoreSession(qs, { q2: 1 }, events, 60000);
  assert.equal(s.recovery.end, undefined);
  assert.equal(s.recovery.telemetry, 'self_reported');
});

test('away and back need not pair up: a lone back or a repeated away is accepted', () => {
  const events = [ev(1, 'q1', 'back'), ev(2, 'q1', 'visit'), ev(3, 'q1', 'away'), ev(4, 'q1', 'away'), ev(5, 'q1', 'visit', { via: 'resume' })];
  const s = scoreSession(qs, {}, events, 60000);
  assert.equal(s.recovery.presence.length, 3);
});

test('garbage is still rejected: shapes, types, ranges, order, clock and size', () => {
  const bad = (events, pattern) => assert.throws(() => scoreSession(qs, {}, events, 60000), pattern);
  bad([null], /invalid_event_shape/);
  bad(['visit'], /invalid_event_shape/);
  bad([[1, 'q1']], /invalid_event_shape/);
  bad([ev(1, 'q1', 'teleport')], /invalid_event_sequence/);
  bad([ev(1, 'nope', 'away')], /invalid_event_sequence/);
  bad([ev(2, 'q1', 'visit'), ev(1, 'q1', 'away')], /invalid_event_sequence/);
  bad([ev(1, 'q1', 'away', { at: 70000 })], /invalid_event_sequence/);
  bad([ev(1, 'q1', 'visit', { at: 5000 }), ev(2, 'q1', 'back', { at: 4000 })], /invalid_event_sequence/);
  bad([ev(1, 'q1', 'visit', { via: 'teleport' })], /invalid_event_via/);
  bad([ev(1, 'q1', 'visit', { via: 3 })], /invalid_event_via/);
  bad([ev(1, 'q1', 'strike', { option: 4, on: true })], /invalid_event_strike/);
  bad([ev(1, 'q1', 'strike', { option: -1, on: true })], /invalid_event_strike/);
  bad([ev(1, 'q1', 'strike', { option: 1.5, on: true })], /invalid_event_strike/);
  bad([ev(1, 'q1', 'strike', { option: 1 })], /invalid_event_strike/);
  bad([ev(1, 'q1', 'strike', { option: 1, on: 'yes' })], /invalid_event_strike/);
  bad([ev(1, 'q1', 'end')], /invalid_event_end/);
  bad([ev(1, 'q1', 'end', { reason: 'quit' })], /invalid_event_end/);
  bad([ev(1, 'q1', 'visit', { note: 'x'.repeat(MAX_EVENT_BYTES) })], /invalid_event_size/);
  assert.throws(() => scoreSession(qs, {}, Array.from({ length: 5001 }, (_, i) => ev(i + 1, 'q1', 'visit')), Infinity), /invalid_events/);
});

test('a practice paper with a malformed new event keeps its score and marks the record invalid', () => {
  for (const e of [null, ev(1, 'q1', 'strike', { option: 9, on: true }), ev(1, 'q1', 'end', { reason: 'nope' })]) {
    const s = scorePracticeSubmission(qs, { q1: 0, q2: 0 }, [e], 60000);
    assert.equal(s.correct, 1);
    assert.equal(s.wrong, 1);
    assert.equal(s.recovery.telemetry, 'invalid');
  }
});

test('an inconsistent record stores none of the new parts', () => {
  const s = scoreSession(qs, { q1: 1 }, fullRecord(), 60000);
  assert.equal(s.recovery.telemetry, 'inconsistent');
  for (const key of ['marks', 'presence', 'strikes', 'end']) assert.equal(key in s.recovery, false, key);
});

test('the in-progress save validates a batch of new events like any other (recordEvents calls scoreSession)', () => {
  assert.doesNotThrow(() => scoreSession(qs, {}, fullRecord().slice(0, 6), 7000));
  assert.throws(() => scoreSession(qs, {}, fullRecord(), 7000), /invalid_event_sequence/); // past the elapsed bound
});

test('a resume ignores the new event types (progressFromEvents)', () => {
  const p = progressFromEvents(fullRecord(), qs);
  assert.deepEqual(p.answers, { q1: 0, q2: 3 });
  assert.deepEqual(p.marked, { q1: true });
});

test('client meta is a description of the device: valid fields kept, malformed ones dropped, never fatal', () => {
  const now = Date.UTC(2026, 9, 16);
  assert.deepEqual(clientMeta({ client: { platform: 'android', appVersion: '1.0.6+7', startedAt: now - 1000 } }, now), { platform: 'android', appVersion: '1.0.6+7', startedAt: now - 1000 });
  assert.deepEqual(clientMeta({ client: { platform: 'web', appVersion: 'x y', startedAt: 12 } }, now), { platform: 'web' });
  assert.equal(clientMeta({ client: { platform: 'ios' } }, now), null);
  assert.equal(clientMeta({ client: 'web' }, now), null);
  assert.equal(clientMeta({}, now), null);
  assert.equal(clientMeta({ client: { platform: 'web', startedAt: now + 3 * 86400000 } }, now).startedAt, undefined);
});

test('endedBy comes from the final end event, else a reason the client named, else nothing', () => {
  assert.equal(endedByOf(fullRecord()), 'submit');
  assert.equal(endedByOf([ev(1, 'q1', 'visit')], { endedBy: 'time_up' }), 'time_up');
  assert.equal(endedByOf([ev(1, 'q1', 'visit')], { endedBy: 'closed' }), null);
  assert.equal(endedByOf([ev(1, 'q1', 'end', { reason: 'nta_strikes' }), ev(2, 'q1', 'visit')]), null);
  assert.deepEqual(submitMeta({ client: { platform: 'web' } }, fullRecord()), { client: { platform: 'web' }, endedBy: 'submit' });
  assert.deepEqual(submitMeta({}, []), {});
});

test('the deadline finaliser keeps a final end and how it ended', () => {
  const row = { id: 's1', subject: 'accountancy', questions: qs, created_at: '2026-10-16T06:00:00.000Z', expires_at: '2026-10-16T07:00:00.000Z',
    selection_meta: { mode: 'nta' }, events: [ev(1, 'q1', 'visit'), ev(2, 'q1', 'answer', { answer: 0 }), ev(3, 'q1', 'away'), ev(4, 'q1', 'end', { reason: 'time_up' })] };
  const out = scoreExpiredSession(row);
  assert.equal(out.selectionMeta.endedBy, 'time_up');
  assert.equal(out.selectionMeta.finalisedBy, 'server_deadline');
  assert.equal(out.selectionMeta.recovery.end.reason, 'time_up');
  const plain = scoreExpiredSession({ ...row, events: row.events.slice(0, 2) });
  assert.equal('endedBy' in plain.selectionMeta, false);
});

test('the accepted vocabulary is the spec section 6 list, with set and sheet for what was on screen', () => {
  assert.deepEqual([...SESSION_EVENT_TYPES], ['answer', 'visit', 'mark', 'strike', 'away', 'back', 'end']);
  assert.deepEqual([...VISIT_VIA], ['next', 'previous', 'palette', 'swipe', 'resume', 'set', 'sheet']);
  assert.deepEqual([...END_REASONS], ['submit', 'time_up', 'nta_strikes']);
});

test('a passage set shown on one page and the submit sheet are visits in the stored timeline, with their via', () => {
  const events = [ev(1, 'q2', 'visit', { via: 'set' }), ev(2, 'q3', 'visit', { via: 'set' }), ev(3, 'q1', 'visit'),
    ev(4, 'q1', 'answer', { answer: 0 }), ev(5, 'q1', 'visit', { via: 'sheet' }), ev(6, 'q1', 'end', { reason: 'submit' })];
  const s = scoreSession(qs, { q1: 0 }, events, 60000);
  assert.equal(s.recovery.telemetry, 'self_reported');
  assert.deepEqual(s.recovery.timeline.map((e) => `${e.type}:${e.qid}${e.via ? `:${e.via}` : ''}`), ['visit:q2:set', 'visit:q3:set', 'visit:q1', 'answer:q1', 'visit:q1:sheet']);
  assert.equal(s.recovery.end.reason, 'submit');
});

// src/lib/server/recoverySessions.js finishSession: a submit landing after expires_at cannot store events, so a time-up
// end it carries is placed by the server, at the limit, only when every event before it is already stored.
test('a time-up that reached the server after the deadline keeps its end, at the limit, and nothing else', () => {
  const stored = [ev(1, 'q1', 'visit'), ev(2, 'q1', 'answer', { answer: 0 }), ev(3, 'q2', 'visit', { via: 'next' })];
  const sent = [...stored, { seq: 4, qid: 'q2', type: 'end', at: 59_400, reason: 'time_up' }];
  const opts = { durationMs: 60_000, questionIds: qs.map((q) => q.id) };
  const end = lateTimeUpEnd(stored, sent, opts);
  assert.deepEqual(end, { seq: 4, qid: 'q2', at: 60_000, type: 'end', reason: 'time_up' });
  const s = scoreSession(qs, { q1: 0 }, [...stored, end], 60_000);
  assert.deepEqual(s.recovery.end, { seq: 4, qid: 'q2', at: 60_000, reason: 'time_up' });
  assert.deepEqual(submitMeta({}, [...stored, end]), { endedBy: 'time_up' });
  const trace = readTrace(s.recovery);
  assert.deepEqual(questionTraceLines(trace, 'q2'), ['Time ran out at 1:00 with this question open.']);
  assert.equal(trace.dwell.get('q2'), 60_000 - 3000, 'the last question runs to the limit, never past it');
  // Anything that would add, drop or change an event is refused: the paper is never extended.
  const no = (s2, why) => assert.equal(lateTimeUpEnd(stored, s2, opts), null, why);
  no([...stored, ev(4, 'q2', 'answer', { answer: 1 }), { seq: 5, qid: 'q2', type: 'end', at: 60_000, reason: 'time_up' }], 'an answer after the last save');
  no([...stored, { seq: 4, qid: 'q2', type: 'end', at: 30_000, reason: 'submit' }], 'a plain submit after the deadline');
  no([...stored, { seq: 4, qid: 'q9', type: 'end', at: 60_000, reason: 'time_up' }], 'a question not on the paper');
  no([...stored, { seq: 7, qid: 'q2', type: 'end', at: 60_000, reason: 'time_up' }], 'a seq gap');
  no([stored[0], ev(2, 'q1', 'answer', { answer: 3 }), stored[2], { seq: 4, qid: 'q2', type: 'end', at: 60_000, reason: 'time_up' }], 'a stored event that differs');
  no(stored, 'no end at all');
  assert.equal(lateTimeUpEnd([...stored, { seq: 4, qid: 'q2', type: 'end', at: 60_000, reason: 'time_up' }], [...stored, { seq: 4, qid: 'q2', type: 'end', at: 60_000, reason: 'time_up' }], opts), null, 'an end already stored');
  assert.equal(lateTimeUpEnd(stored, sent, { durationMs: NaN, questionIds: opts.questionIds }), null);
  assert.equal(lateTimeUpEnd(null, sent, opts), null);
});
