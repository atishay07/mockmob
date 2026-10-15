import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairRetryPolicy, repairBlocks, trapLabel, TRAP_LABELS, marksAtStake, foldedQuestionLine, repairMood } from '../repair_presentation.mjs';
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

test('repair v2 blocks: trap name from a fixed label map, unknown types read as other, v1 keeps its three blocks', () => {
  assert.equal(trapLabel('partly_true'), 'A partly true option');
  assert.equal(trapLabel('made_up_type'), TRAP_LABELS.other);
  assert.equal(trapLabel(undefined), TRAP_LABELS.other);
  assert.equal(trapLabel('__proto__'), TRAP_LABELS.other);
  for (const label of Object.values(TRAP_LABELS)) assert.doesNotMatch(label, /\byou\b|!/i, 'labels describe the option, never the student');
  const v2 = repairBlocks({ trap_type: 'look_alike_term', trap: 'B names a related term.', why_wrong: 'It describes a different process.', another_way: 'Think of the order of steps.', contrast: 'If it asked about X, B would fit.', rule: 'Match the term to its definition.', next_step: '' });
  assert.equal(v2.version, 2); assert.equal(v2.heading, 'A look-alike term'); assert.equal(v2.contrast, 'If it asked about X, B would fit.'); assert.equal(v2.nextStep, null);
  const v1 = repairBlocks({ why_tempting: 'It sounds familiar.', why_wrong: 'It applies to firms.', key_idea: 'Planning comes first.', next_step: 'Re-read the chapter summary.' });
  assert.deepEqual([v1.version, v1.heading, v1.anotherWay, v1.rule], [1, null, null, 'Planning comes first.']);
  assert.equal(repairBlocks({ rule: 'A rule', why_wrong: 'w' }), null, 'a v2 payload without the trap is incomplete');
  assert.equal(repairBlocks({ why_tempting: 't', why_wrong: 'w' }), null, 'a v1 payload without the idea is incomplete');
  assert.equal(repairBlocks(null), null);
});

test('the marks line is past tense, exact for CUET and hidden for an unknown scheme; the folded line leaves out unknowns', () => {
  assert.equal(marksAtStake('cuet').line, 'This answer cost 6 marks in this session: 5 not earned and 1 penalty.');
  assert.equal(marksAtStake('unknown'), null);
  assert.equal(marksAtStake(undefined), null);
  assert.equal(foldedQuestionLine({ number: 7, chosen: 'B', answer: 'C' }), 'Q7. Your pick B. Key C.');
  assert.equal(foldedQuestionLine({ chosen: 'B', answer: null }), 'Your pick B.');
});

test('Mobi reacts to the real outcome: success only for a server-acknowledged repair', () => {
  assert.equal(repairMood('loading'), 'think');
  assert.equal(repairMood('loading', { slow: true }), 'loading');
  assert.equal(repairMood('explained'), 'correct');
  assert.equal(repairMood('stored'), 'hello');
  assert.equal(repairMood('error'), 'oops');
  assert.equal(repairMood('error', { settledFor: 1400 }), 'encourage');
  assert.equal(repairMood('not_explained'), 'rest');
  assert.equal(repairMood('held_for_recheck'), 'rest');
  assert.equal(repairMood('idle'), null);
  const src = read('src/components/recovery/MistakeRepair.jsx');
  assert.match(src, /const mobi = nta \? null : <RepairMobi/, 'no Mobi in NTA');
});

test('Review remembers the last look: the first visit and an unchanged list animate nothing; storage failures are safe', async () => {
  const { reviewChanges } = await import('../../src/components/recovery/reviewChanges.js');
  const m = new Map(); const storage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.equal(reviewChanges([{ id: 'a', mistakes: 3 }], storage).changed, false, 'first visit is a baseline');
  const next = reviewChanges([{ id: 'b', mistakes: 2 }, { id: 'a', mistakes: 3 }], storage);
  assert.deepEqual([...next.fresh], ['b']); assert.equal(next.fromToReview, 3); assert.equal(next.changed, true);
  assert.equal(reviewChanges([{ id: 'b', mistakes: 2 }, { id: 'a', mistakes: 3 }], storage).changed, false, 'nothing changed, nothing moves');
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(reviewChanges([{ id: 'a', mistakes: 1 }], broken).changed, false);
  assert.equal(reviewChanges([{ id: 'a', mistakes: 1 }], null).changed, false);
});

// ---- Repair v3 presentation (build spec 15 Oct 2026, A.1 and A.8) ----
import { checkChip, REPAIR_COPY, REPAIR_LOADING, repairLoadingLine, recordLines } from '../repair_presentation.mjs';

test('repair v3 blocks: why the key is right, the other options in served order, the hook and the second explanation', () => {
  const v3 = repairBlocks({
    version: 3, trap_type: 'look_alike_term', trap: 'B sounds like the key.', why_wrong: 'It is a noun.', why_right: 'D is the verb.',
    contrast: 'If it said X, B would fit.', others: [{ index: 2, why: 'C is about disease.' }, { index: 0, why: 'A is too strong.' }, { index: 9, why: 'out of range' }, { index: 0, why: 'a duplicate' }, { index: 1, why: '' }],
    rule: 'Use the verb after will.', memory_hook: 'Affect is the Action.', another_way: 'Think push and result.',
    why_tempting: 'B sounds like the key.', key_idea: 'Use the verb after will.',
  });
  assert.equal(v3.version, 3);
  assert.equal(v3.heading, 'A look-alike term');
  assert.equal(v3.right, 'D is the verb.');
  assert.deepEqual(v3.others, [{ letter: 'A', why: 'A is too strong.' }, { letter: 'C', why: 'C is about disease.' }]);
  assert.equal(v3.hook, 'Affect is the Action.');
  assert.equal(v3.anotherWay, 'Think push and result.');
  assert.equal(v3.nextStep, null, 'the model next step is gone; the real practice action replaces it');
  const bare = repairBlocks({ trap: 'B sounds like the key.', why_wrong: 'It is a noun.', why_right: 'D is the verb.', rule: 'Use the verb.' });
  assert.deepEqual([bare.version, bare.contrast, bare.hook, bare.anotherWay, bare.others], [3, null, null, null, []]);
  assert.equal(repairBlocks({ trap: 't', why_wrong: 'w', why_right: 'r' }), null, 'no rule: incomplete');
  assert.equal(repairBlocks({ why_wrong: 'w', why_right: 'r', rule: 'x' }), null, 'no trap: incomplete');
  // An older app payload shape (aliases only) still reads as v3 when why_right is there.
  assert.equal(repairBlocks({ why_tempting: 't', why_wrong: 'w', why_right: 'r', key_idea: 'k' }).rule, 'k');
});

test('the chip says "explained from", never "checked against"; the loading line follows real elapsed time', () => {
  assert.equal(checkChip('D'), 'Explained from the answer key (D).');
  assert.equal(checkChip(null), 'Explained from the answer key.');
  assert.equal(REPAIR_LOADING.slowAfterMs, 8000);
  assert.equal(REPAIR_LOADING.longAfterMs, 45000);
  assert.equal(repairLoadingLine(0, 7), 'Writing the repair for Q7.');
  assert.equal(repairLoadingLine(7999, 7), 'Writing the repair for Q7.');
  assert.equal(repairLoadingLine(8000, 7), 'Still writing. You are charged only if it arrives.');
  assert.equal(repairLoadingLine(45000, 7), 'Taking longer than usual. Still trying.');
  assert.equal(repairLoadingLine(0), 'Writing the repair.');
});

test('"From your record" shows the server lines in order, then the pattern line; nothing else is written', () => {
  const insights = { lines: [{ kind: 'change', text: 'You first chose C here, then changed to B.' }, { kind: 'time', text: '' }, null, { kind: 'chapter', text: 'Correct Word Usage so far: 7 right of 12 answered across 3 papers, this one included.' }] };
  assert.deepEqual(recordLines(insights, { line: '2 of your 3 repaired mistakes in X had the same trap: a look-alike term.' }), [
    'You first chose C here, then changed to B.', 'Correct Word Usage so far: 7 right of 12 answered across 3 papers, this one included.', '2 of your 3 repaired mistakes in X had the same trap: a look-alike term.',
  ]);
  assert.deepEqual(recordLines(null, null), []);
  assert.deepEqual(recordLines({ lines: 'x' }, { line: '  ' }), []);
});

test('every client string for the repair is sentence case and plain: no "!", no dash, no middle dot', () => {
  const lines = [checkChip('D'), REPAIR_LOADING.slow, REPAIR_LOADING.long, REPAIR_LOADING.writing(7)];
  for (const v of Object.values(REPAIR_COPY)) lines.push(typeof v === 'function' ? v('D') : v);
  lines.push(REPAIR_COPY.otherOptionsCount(2), REPAIR_COPY.practise(null), REPAIR_COPY.whyRight(null), REPAIR_COPY.whyLooked(null));
  for (const line of lines) {
    assert.doesNotMatch(line, /[!—–·]/, line);
    assert.match(line, /^[A-Z0-9]/, `sentence case: ${line}`);
  }
  assert.equal(REPAIR_COPY.practise('Correct Word Usage'), 'Practise 5 on Correct Word Usage');
  assert.equal(REPAIR_COPY.otherOptionsCount(2), 'The other options (2)');
});
