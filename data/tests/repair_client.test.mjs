import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairRetryPolicy } from '../repair_presentation.mjs';
import { repairFailureForKind, composeFailureMessage, WALLET_UNAVAILABLE } from '../repair_failures.js';
import {
  REPAIR_CLIENT_TIMEOUT_MS, REPAIR_TIMEOUT_MESSAGE, REPAIR_UNCONFIRMED_MESSAGE, REPAIR_NETWORK_MESSAGE,
  requestRepair, planRepairFailure,
} from '../repair_client.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const OCT = new Date('2026-10-14T06:00:00Z');

// Every failure the server can send for a repair it did not deliver, built from the server's own copy.
function serverFailures() {
  const modelKinds = { timeout: 'provider_timeout', quota: 'provider_unavailable', budget: 'budget_reached', guard_paused: 'paused', unknown: 'unusable_output' };
  const out = Object.entries(modelKinds).map(([kind, code]) => {
    const f = repairFailureForKind(kind, { now: OCT });
    assert.equal(f.error, code);
    return { code, http: f.http, body: { ok: false, error: f.error, charged: 0, message: composeFailureMessage(f.message, true) } };
  });
  out.push({ code: 'wallet_unavailable', http: WALLET_UNAVAILABLE.http, body: { ok: false, error: 'wallet_unavailable', charged: 0, message: WALLET_UNAVAILABLE.message } });
  out.push({ code: 'could_not_start', http: 503, body: { ok: false, error: 'could_not_start', charged: 0, message: composeFailureMessage('The repair could not start.', true) } });
  out.push({ code: 'operation_released', http: 409, body: { ok: false, error: 'operation_released', charged: 0, message: 'That attempt did not go through and nothing was charged. Try again.' } });
  return out;
}

test('after any failure body with charged: 0 the next attempt uses a fresh request id', () => {
  for (const { code, http, body } of serverFailures()) {
    assert.equal(repairRetryPolicy(http, body.error, body).resetRequest, true, code);
    assert.equal(planRepairFailure({ kind: 'response', res: { ok: false, status: http }, body }).resetRequest, true, code);
  }
  // Without charged: 0 nothing is known to be released, so the id stays (a repeat can never double charge).
  assert.equal(repairRetryPolicy(409, 'in_progress', { ok: false, error: 'in_progress', message: 'Still being prepared.' }).resetRequest, false);
  assert.equal(repairRetryPolicy(402, 'insufficient_ai_credits', { ok: false, balance: 0 }).resetRequest, false);
  assert.equal(repairRetryPolicy(502, undefined, null).resetRequest, false);
  assert.equal(repairRetryPolicy(502, undefined).resetRequest, false);
});

test('the retry policy still treats the existing codes as before', () => {
  assert.deepEqual(repairRetryPolicy(409, 'operation_released'), { resetRequest: true, canRetry: true });
  assert.deepEqual(repairRetryPolicy(409, 'in_progress'), { resetRequest: false, canRetry: true });
  assert.deepEqual(repairRetryPolicy(409, 'conflict'), { resetRequest: false, canRetry: false });
  assert.deepEqual(repairRetryPolicy(402, 'insufficient_ai_credits'), { resetRequest: false, canRetry: false });
  assert.deepEqual(repairRetryPolicy(502, 'unusable_output', { charged: 0 }), { resetRequest: true, canRetry: true });
});

test('timeouts, an unavailable service or wallet and a bad output can be retried; a used-up budget or a pause cannot', () => {
  for (const { code, http, body } of serverFailures()) {
    const expected = !['budget_reached', 'paused'].includes(code);
    assert.equal(repairRetryPolicy(http, body.error, body).canRetry, expected, code);
  }
});

test('each failure shows the server message, never a generic error when the server sent one', () => {
  for (const { code, http, body } of serverFailures()) {
    const plan = planRepairFailure({ kind: 'response', res: { ok: false, status: http }, body });
    assert.equal(plan.message, body.message, code);
    assert.equal(plan.status, 'error', code);
  }
  const budget = serverFailures().find((f) => f.code === 'budget_reached');
  assert.match(planRepairFailure({ kind: 'response', res: { status: 503 }, body: budget.body }).message, /^Repairs are paused until 1 November\./);
  assert.match(planRepairFailure({ kind: 'response', res: { status: 504 }, body: serverFailures().find((f) => f.code === 'provider_timeout').body }).message, /You were not charged\.$/);
});

test('in_progress waits instead of failing, and a body with no message falls back to a calm line', () => {
  const waiting = planRepairFailure({ kind: 'response', res: { status: 409 }, body: { ok: false, error: 'in_progress', message: 'This repair is still being prepared. Nothing extra is charged.' } });
  assert.deepEqual(waiting, { status: 'waiting', message: 'This repair is still being prepared. Nothing extra is charged.', canRetry: true, resetRequest: false });
  // No JSON at all (a gateway page): honest and generic, same request id, and no claim about the credit.
  const noBody = planRepairFailure({ kind: 'response', res: { status: 502 }, body: null });
  assert.deepEqual(noBody, { status: 'error', message: REPAIR_UNCONFIRMED_MESSAGE, canRetry: true, resetRequest: false });
  assert.doesNotMatch(REPAIR_UNCONFIRMED_MESSAGE, /same request/);
  // A blank server message is not shown; a timeout code with no message still says it took too long.
  assert.equal(planRepairFailure({ kind: 'response', res: { status: 503 }, body: { error: 'wallet_unavailable', charged: 0, message: '   ' } }).message, REPAIR_UNCONFIRMED_MESSAGE);
  assert.equal(planRepairFailure({ kind: 'response', res: { status: 504 }, body: { error: 'provider_timeout', charged: 0 } }).message, REPAIR_TIMEOUT_MESSAGE);
});

test('the client gives up after 95 s with a calm message, keeping the same request id', () => {
  assert.equal(REPAIR_CLIENT_TIMEOUT_MS, 95_000);
  assert.equal(REPAIR_TIMEOUT_MESSAGE, 'This took too long. You were not charged.');
  assert.deepEqual(planRepairFailure({ kind: 'timeout' }), { status: 'error', message: 'This took too long. You were not charged.', canRetry: true, resetRequest: false });
  assert.deepEqual(planRepairFailure({ kind: 'network' }), { status: 'error', message: REPAIR_NETWORK_MESSAGE, canRetry: true, resetRequest: false });
  // The wait is longer than the route's own budget, so a slow but legitimate answer is never cut off.
  const route = read('src/app/api/recovery/repair/route.js');
  const maxSeconds = Number(/^export const maxDuration = (\d+);$/m.exec(route)[1]);
  assert.ok(REPAIR_CLIENT_TIMEOUT_MS > maxSeconds * 1000);
});

function clock() {
  let at = 0, id = 0;
  const jobs = new Map();
  return {
    schedule(fn, delay) { const key = ++id; jobs.set(key, { fn, at: at + delay, delay }); return key; },
    cancel(key) { jobs.delete(key); },
    advance(ms) { at += ms; for (const [key, job] of [...jobs]) if (job.at <= at) { jobs.delete(key); job.fn(); } },
    delays: () => [...jobs.values()].map((j) => j.delay),
    pending: () => jobs.size,
  };
}
// A fetch that never answers on its own and rejects with an AbortError when the request is aborted.
function hangingFetch(seen) {
  return (url, init) => new Promise((_, reject) => {
    seen.push({ url, init });
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
}
const flush = () => new Promise((r) => setImmediate(r));

test('requestRepair aborts a request that has not answered after 95 s', async () => {
  const t = clock(), seen = [];
  const pending = requestRepair(hangingFetch(seen), '/api/recovery/repair', { attemptId: 'a1', questionId: 'q1', requestId: 'r-1' }, { schedule: t.schedule, cancel: t.cancel });
  assert.deepEqual(t.delays(), [95_000]);
  t.advance(94_999); await flush();
  assert.equal(seen[0].init.signal.aborted, false);
  t.advance(1);
  assert.deepEqual(await pending, { kind: 'timeout' });
  assert.equal(seen[0].init.signal.aborted, true);
  assert.equal(seen[0].url, '/api/recovery/repair');
  assert.equal(seen[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(seen[0].init.body), { attemptId: 'a1', questionId: 'q1', requestId: 'r-1' });
  assert.equal(t.pending(), 0);
});

test('requestRepair also times out while the response body is still arriving', async () => {
  const t = clock();
  const fetchImpl = (url, init) => Promise.resolve({
    ok: true, status: 200,
    json: () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
  });
  const pending = requestRepair(fetchImpl, '/x', {}, { schedule: t.schedule, cancel: t.cancel });
  await flush(); t.advance(95_000);
  assert.deepEqual(await pending, { kind: 'timeout' });
});

test('requestRepair returns the answer and clears its timer; a dropped connection is not called a timeout', async () => {
  const t = clock();
  const res = { ok: false, status: 503, json: async () => ({ ok: false, error: 'wallet_unavailable', charged: 0, message: WALLET_UNAVAILABLE.message }) };
  const answered = await requestRepair(async () => res, '/x', {}, { schedule: t.schedule, cancel: t.cancel });
  assert.equal(answered.kind, 'response'); assert.equal(answered.res, res); assert.equal(answered.body.error, 'wallet_unavailable');
  assert.equal(t.pending(), 0);
  const notJson = await requestRepair(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } }), '/x', {}, { schedule: t.schedule, cancel: t.cancel });
  assert.equal(notJson.kind, 'response'); assert.equal(notJson.body, null);
  const dropped = await requestRepair(async () => { throw new TypeError('Failed to fetch'); }, '/x', {}, { schedule: t.schedule, cancel: t.cancel });
  assert.deepEqual(dropped, { kind: 'network' });
  assert.equal(t.pending(), 0);
});

test('the Mistake Repair component sends through requestRepair, resets the id after charged: 0 and shows the server message', () => {
  const src = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(src, /import \{ requestRepair, planRepairFailure \} from '@\/\.\.\/data\/repair_client\.mjs';/);
  assert.match(src, /requestRepair\(fetch, '\/api\/recovery\/repair', \{ attemptId, questionId, requestId: requestId\.current \}\)/);
  assert.match(src, /requestId\.current \?\?= newRequestId\(\);/);
  assert.match(src, /if \(failure\.resetRequest\) requestId\.current = null;/);
  assert.match(src, /setState\(\{ status: failure\.status, message: failure\.message, canRetry: failure\.canRetry \}\)/);
  assert.doesNotMatch(src, /body\?\.message \|\|/, 'a server message is never replaced by a generic line');
});
