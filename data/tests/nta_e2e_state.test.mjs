// NTA session state end to end, through the website's real route handlers (see nta_e2e_harness.mjs):
//   the clock         a device-held session keeps its start and deadline when the saved draft is gone;
//   marks for review  saved with a durable session like answers, restored on resume, never in the score;
//   option layout     the engine's option order and remapped key stored with the session.
// One promoted subject is enough: these are properties of the session handlers, not of a subject.
// Needs the read-only fixtures: node --use-system-ca scripts/nta-fixture-export.mjs
// Run: npm run test:nta-e2e
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './nta_e2e_harness.mjs';
import { openPractice } from '../practice_ticket.js';
import { progressFromEvents } from '../session_draft.js';
import { plainOptionTexts } from '../option_text.js';

const SKIP = !h.fixturesAvailable() ? 'fixtures missing: run node --use-system-ca scripts/nta-fixture-export.mjs' : false;
const SUBJECT = 'physics';
const table = (name) => h.fake.table(name);

async function atOffset(offsetMs, fn) {
  const real = Date.now;
  Date.now = () => real.call(Date) + offsetMs;
  try { return await fn(); } finally { Date.now = real; }
}
async function setup({ durable, students = [{ id: 'prem' }, { id: 'other' }] }) {
  h.configure({ signingKey: h.TEST_SECRET, durable });
  return h.loadSubject(SUBJECT, { mode: 'promoted', students });
}
const startBody = (label) => ({ subject: SUBJECT, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: h.generationKey(label) });
const attemptsRoute = { route: 'attempts', path: '/api/attempts' };

test('clock: a device-held session keeps its start and deadline when the saved draft is gone', { skip: SKIP, timeout: 240000 }, async (t) => {
  await setup({ durable: false });
  const body = startBody('clock');
  const first = await h.call('POST', body, 'prem');
  assert.equal(first.status, 200, JSON.stringify(first.body).slice(0, 300));
  const receipt = first.body.meta.startReceipt;
  const secret = process.env.PRACTICE_SESSION_SECRET;

  await t.test('the first start hands the runner the server start receipt, and no answer key', () => {
    assert.match(receipt, /^[0-9a-z]+-[0-9a-f]{32}$/);
    assert.doesNotMatch(JSON.stringify(first.body), /correct_?answer|correctIndex|ntaOptionLayout/i);
  });
  await t.test('same key, draft gone, ten minutes in: same session, same start, same deadline, a clock that has run ten minutes', async () => {
    const resumed = await atOffset(10 * 60000, () => h.call('POST', { ...body, startReceipt: receipt }, 'prem'));
    assert.equal(resumed.status, 200, JSON.stringify(resumed.body).slice(0, 300));
    assert.equal(resumed.body.id, first.body.id);
    assert.equal(resumed.body.startedAt, first.body.startedAt);
    assert.equal(resumed.body.expiresAt, first.body.expiresAt, 'the deadline must not move');
    assert.equal(Date.parse(resumed.body.expiresAt) - Date.parse(resumed.body.startedAt), 3600000, 'the duration is the official 60 minutes');
    const remaining = Date.parse(resumed.body.expiresAt) - resumed.body.serverNow;
    assert.ok(remaining > 49 * 60000 && remaining < 50 * 60000 + 5000, `remaining ${remaining}`);
    assert.equal(resumed.body.meta.startReceipt, receipt);
    const snapshot = openPractice(resumed.body.meta.sessionTicket, secret, 'prem', Date.now() + 10 * 60000);
    assert.equal(snapshot.created_at, first.body.startedAt, 'the sealed ticket must carry the original start');
    assert.equal(snapshot.expires_at, first.body.expiresAt);
  });
  await t.test('a reload at 59 minutes has about one minute left, and the resumed ticket is scored inside the original window', async () => {
    const late = await atOffset(59 * 60000, () => h.call('POST', { ...body, startReceipt: receipt }, 'prem'));
    assert.equal(late.status, 200);
    const left = Date.parse(late.body.expiresAt) - late.body.serverNow;
    assert.ok(left > 0 && left <= 61000, `left ${left}`);
    const submitted = await atOffset(59 * 60000, () => h.call('POST', { sessionId: late.body.id, sessionTicket: late.body.meta.sessionTicket, answers: {}, events: [] }, 'prem', attemptsRoute));
    assert.equal(submitted.status, 200, JSON.stringify(submitted.body).slice(0, 200));
  });
});

test('clock: a receipt cannot restart, extend or move a session', { skip: SKIP, timeout: 240000 }, async (t) => {
  await setup({ durable: false });
  const body = startBody('receipt');
  const first = await h.call('POST', body, 'prem');
  assert.equal(first.status, 200);
  const receipt = first.body.meta.startReceipt;

  await t.test('a tampered receipt, another key and another student are all refused', async () => {
    const tampered = `${(Date.now() + 3000000).toString(36)}-${receipt.split('-')[1]}`;
    for (const bad of [tampered, 'nonsense', `${receipt}0`]) {
      const result = await h.call('POST', { ...body, startReceipt: bad }, 'prem');
      assert.equal(result.status, 422);
      assert.equal(result.body.error, 'INVALID_START_RECEIPT');
      assert.equal(result.body.questions, undefined);
    }
    const otherKey = await h.call('POST', { ...body, generationKey: h.generationKey('other-key'), startReceipt: receipt }, 'prem');
    assert.equal(otherKey.body.error, 'INVALID_START_RECEIPT');
    const otherStudent = await h.call('POST', { ...body, startReceipt: receipt }, 'other');
    assert.equal(otherStudent.body.error, 'INVALID_START_RECEIPT');
  });
  await t.test('inside the two minute upload grace the session still opens (the runner submits at once); past it nothing restarts', async () => {
    const graced = await atOffset(61 * 60000, () => h.call('POST', { ...body, startReceipt: receipt }, 'prem'));
    assert.equal(graced.status, 200);
    assert.ok(graced.body.serverNow > Date.parse(graced.body.expiresAt));
    const over = await atOffset(63 * 60000, () => h.call('POST', { ...body, startReceipt: receipt }, 'prem'));
    assert.equal(over.status, 422);
    assert.equal(over.body.error, 'SESSION_EXPIRED');
    assert.equal(over.body.questions, undefined);
    assert.equal(over.body.meta, undefined);
  });
  await t.test('a start without a receipt is a new session from now: a first start, or a new key', async () => {
    const fresh = await h.call('POST', startBody('fresh'), 'prem');
    assert.equal(fresh.status, 200);
    assert.ok(Math.abs(Date.parse(fresh.body.startedAt) - Date.now()) < 15000);
    assert.notEqual(fresh.body.id, first.body.id);
  });
  await t.test('a durable session ignores the receipt: its start is already on the server', async () => {
    await setup({ durable: true });
    const durableBody = startBody('durable-receipt');
    const durable = await h.call('POST', durableBody, 'prem');
    assert.equal(durable.status, 200);
    assert.equal(durable.body.meta.startReceipt, undefined);
    const again = await atOffset(5 * 60000, () => h.call('POST', { ...durableBody, startReceipt: 'ignored' }, 'prem'));
    assert.equal(again.status, 200);
    assert.equal(again.body.startedAt, durable.body.startedAt);
    assert.equal(again.body.expiresAt, durable.body.expiresAt);
  });
});

test('marks: saved with a durable session and restored on resume, never part of the score', { skip: SKIP, timeout: 240000 }, async (t) => {
  const rows = await setup({ durable: true });
  const bank = new Map(rows.map((row) => [row.id, row]));
  const body = startBody('marks');
  const started = await h.call('POST', body, 'prem');
  assert.equal(started.status, 200, JSON.stringify(started.body).slice(0, 300));
  const q = started.body.questions;
  const events = [
    { seq: 1, qid: q[0].id, type: 'visit', at: 10 },
    { seq: 2, qid: q[0].id, type: 'mark', marked: true, at: 20 },
    { seq: 3, qid: q[0].id, type: 'answer', answer: 0, at: 30 },
    { seq: 4, qid: q[1].id, type: 'visit', at: 40 },
    { seq: 5, qid: q[1].id, type: 'mark', marked: true, at: 50 },
    { seq: 6, qid: q[0].id, type: 'mark', marked: false, at: 60 },
    { seq: 7, qid: q[2].id, type: 'visit', at: 70 },
    { seq: 8, qid: q[2].id, type: 'mark', marked: true, at: 80 },
  ];
  await t.test('the events are accepted and stored in order', async () => {
    const put = await h.call('PUT', { sessionId: started.body.id, events }, 'prem');
    assert.equal(put.status, 200, JSON.stringify(put.body));
    assert.equal(put.body.acknowledgedSequence, 8);
    assert.deepEqual(table('recovery_sessions')[0].events, events);
  });
  await t.test('resuming by session id or by the same key returns them, and the runner state rebuilt from them has the marks', async () => {
    for (const request of [{ sessionId: started.body.id }, body]) {
      const resumed = await h.call('POST', request, 'prem');
      assert.equal(resumed.status, 200);
      assert.equal(resumed.body.id, started.body.id);
      assert.deepEqual(resumed.body.events, events);
      const progress = progressFromEvents(resumed.body.events, resumed.body.questions);
      assert.deepEqual(progress.marked, { [q[1].id]: true, [q[2].id]: true }, 'q0 was unmarked again; q1 and q2 stay marked');
      assert.deepEqual(progress.answers, { [q[0].id]: 0 });
      assert.equal(progress.touched.length, 3);
      assert.equal(resumed.body.expiresAt, started.body.expiresAt);
    }
    assert.equal((await h.call('POST', { sessionId: started.body.id }, 'other')).status, 404, 'another student cannot read the marks');
  });
  await t.test('a malformed mark, and a mark after the deadline, are refused and change nothing', async () => {
    const bad = await h.call('PUT', { sessionId: started.body.id, events: [...events, { seq: 9, qid: q[3].id, type: 'mark', marked: 'yes', at: 90 }] }, 'prem');
    assert.ok(bad.status >= 400, `status ${bad.status}`);
    const lateMark = await atOffset(61 * 60000, () => h.call('PUT', { sessionId: started.body.id, events: [...events, { seq: 9, qid: q[3].id, type: 'mark', marked: true, at: 90 }] }, 'prem'));
    assert.ok(lateMark.status >= 400, `status ${lateMark.status}`);
    assert.deepEqual(table('recovery_sessions')[0].events, events);
  });
  await t.test('the option layout and key are stored with the session, and a resume shows the same options in the same order', async () => {
    const layout = table('recovery_sessions')[0].selection_meta.ntaOptionLayout;
    assert.equal(layout.version, 1);
    assert.equal(Object.keys(layout.key).length, q.length);
    assert.equal(Object.keys(layout.order).length, q.length, 'the engine option order must reach the session for every question');
    assert.equal(layout.shuffled, true, 'a paper of this size has moved options');
    for (const question of table('recovery_sessions')[0].questions) {
      assert.equal(layout.key[question.id], question.options[question.correctIndex]?.key || 'ABCD'[question.correctIndex], `stored key for ${question.id}`);
      const order = layout.order[question.id];
      assert.deepEqual([...order].sort(), question.options.map((_, i) => i));
      // served position i shows the bank's option order[i], and the remapped key is still the bank's answer
      const bankTexts = plainOptionTexts(bank.get(question.id).options);
      const servedTexts = plainOptionTexts(question.options);
      servedTexts.forEach((text, i) => assert.equal(text, bankTexts[order[i]], `option ${i} of ${question.id}`));
    }
    const again = await h.call('POST', body, 'prem');
    assert.deepEqual(again.body.questions, started.body.questions, 'a resume must not reorder questions or options');
    assert.doesNotMatch(JSON.stringify(started.body), /ntaOptionLayout/, 'the layout carries the key and never reaches the browser');
  });
  await t.test('submitting with marks in the log scores as without them, and the stored timeline holds no marks', async () => {
    const done = await h.call('PATCH', { sessionId: started.body.id, answers: { [q[0].id]: 0 }, events }, 'prem');
    assert.equal(done.status, 200, JSON.stringify(done.body).slice(0, 300));
    assert.equal(done.body.correct + done.body.wrong, 1);
    assert.equal(done.body.unattempted, q.length - 1);
    const attempt = table('attempts')[0];
    assert.ok(attempt.selection_meta.recovery.timeline.length > 0);
    assert.ok(attempt.selection_meta.recovery.timeline.every((e) => e.type !== 'mark'));
    assert.ok(attempt.selection_meta.ntaOptionLayout.key[q[0].id]);
  });
});

test('marks: a device-held session accepts them in its submitted event log without spoiling the telemetry', { skip: SKIP, timeout: 240000 }, async () => {
  await setup({ durable: false });
  const first = await h.call('POST', startBody('ticketmarks'), 'prem');
  assert.equal(first.status, 200);
  const q = first.body.questions;
  const events = [
    { seq: 1, qid: q[0].id, type: 'visit', at: 10 }, { seq: 2, qid: q[0].id, type: 'mark', marked: true, at: 20 },
    { seq: 3, qid: q[0].id, type: 'answer', answer: 1, at: 30 },
  ];
  const done = await h.call('POST', { sessionId: first.body.id, sessionTicket: first.body.meta.sessionTicket, answers: { [q[0].id]: 1 }, events }, 'prem', attemptsRoute);
  assert.equal(done.status, 200, JSON.stringify(done.body).slice(0, 300));
  assert.equal(done.body.correct + done.body.wrong, 1);
  const attempt = table('attempts')[0];
  assert.equal(attempt.selection_meta.recovery.telemetry, 'self_reported', 'a valid mark must not turn the telemetry invalid');
  assert.deepEqual(attempt.selection_meta.recovery.timeline.map((e) => e.type), ['visit', 'answer']);
  assert.equal(attempt.selection_meta.ntaOptionLayout.version, 1);
  assert.equal(Object.keys(attempt.selection_meta.ntaOptionLayout.key).length, q.length);
});
