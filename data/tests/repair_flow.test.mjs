import test from 'node:test';
import assert from 'node:assert/strict';
import { runRepair, REPAIR_BUDGET, isDeadReservation, mistakeId, PATTERN_BUDGET_MS } from '../../src/services/recovery/repairFlow.js';
import { buildRepairPrompt, MISTAKE_REPAIR_SCHEMA, MISTAKE_REPAIR_SCHEMA_V3 } from '../mistake_repair.js';

// Fakes only: no database, no wallet, no model. Every credit movement and every model call is recorded.
const T0 = Date.parse('2026-10-14T06:00:00Z');
const REQ = 'req_0123456789abcdef';
const user = { id: 'u1' };
const ROUTE = { provider: 'openai', model: 'gpt-6-luna' };
const FALLBACK = { provider: 'anthropic', model: 'claude-haiku-5-5', reasoningEffort: 'low' };
const config = { route: ROUTE, effort: { repair: 'low', secondOpinion: 'high' }, fallbackRoute: FALLBACK };

const passage = 'Maya read the notice twice before she signed. The clause on late fees was printed in the smallest type on the page.';
const snapshot = { id: 'q1', subject: 'english', chapter: 'Reading', question: 'Why did Maya read the notice twice?', passageText: passage, passageTitle: 'The Notice', options: [{ key: 'A', text: 'It was long' }, { key: 'B', text: 'The clause was hard to see' }, { key: 'C', text: 'She disliked it' }, { key: 'D', text: 'She was late' }], correctIndex: 1 };
const attempt = { id: 'a1', userId: 'u1', subject: 'english', questionsSnapshot: [snapshot], details: [{ qid: 'q1', isCorrect: false, givenIndex: 0 }] };
const live = { id: 'q1', status: 'live', verification_state: 'verified', options: snapshot.options.map(o => ({ ...o })), correct_answer: 'B', passage_text: passage };
// v3 is the default prompt. The v1 shape stays for the REPAIR_PROMPT_VERSION=1 rollback.
const good = {
  solved_index: 1, agrees_with_key: true, trap_type: 'not_in_passage',
  trap: 'The notice is long, so length looks like the reason.',
  why_wrong: 'The passage never says the length made her read it twice.',
  why_right: 'The passage names the late-fee clause printed in the smallest type.',
  contrast: 'If the question asked what the notice was like, option A would fit. It asks why she read it twice, so option B.',
  others: [{ index: 2, why: 'The passage never says she disliked the notice.' }, { index: 3, why: 'Nothing in the passage says she was late.' }],
  rule: 'Answer a why question with the reason the passage gives.',
  memory_hook: 'True about it is not why it happened.',
  another_way: 'Ask what the passage says caused the action. Here it is the tiny print, not the length.',
};
const goodV1 = { solved_index: 1, agrees_with_key: true, why_tempting: 'The notice is long, so length looks like the reason.', why_wrong: 'The passage names the clause printed in small type.', key_idea: 'Look for the reason the passage itself gives.', next_step: 'Underline the sentence that answers the question.' };
const usage = { provider: 'openai', model: 'gpt-6-luna', inputTokens: 300, outputTokens: 120 };
const okAI = (data = good, extra = {}) => ({ ok: true, data, usage, fallbackUsed: false, failure: null, ...extra });
const failedAI = (kind, extra = {}) => ({ ok: false, data: null, usage: null, fallbackUsed: false, failure: { stage: 'primary', provider: 'openai', model: 'gpt-6-luna', kind, status: null, code: null, ...extra } });

function harness(over = {}) {
  const calls = []; const logs = []; let t = T0;
  const deps = {
    now: () => t,
    loadAttempt: async () => over.attempt ?? attempt,
    loadQuestion: async () => ({ data: 'live' in over ? over.live : live, error: null }),
    evidenceEligible: () => false,
    findStored: async () => over.stored ?? null,
    findRepairTraps: async (userId) => { calls.push(['traps', userId]); return over.traps ? over.traps(userId) : []; },
    findOpenReservations: async () => over.open ?? [],
    gateOpen: () => over.gateOpen ?? true,
    reserve: async (a) => { calls.push(['reserve', a.operationKey]); return over.reserve ? over.reserve(a) : { ok: true, state: 'reserved', balance: 9 }; },
    markExecuting: async (k) => { calls.push(['executing', k]); return over.markExecuting ? over.markExecuting(k) : { ok: true }; },
    commit: async (k, receipt) => { calls.push(['commit', k, receipt]); return over.commit ? over.commit(k, receipt, calls.filter(c => c[0] === 'commit').length) : { ok: true }; },
    release: async (k, why) => { calls.push(['release', k, why]); return over.release ? over.release(k, why) : { ok: true }; },
    generate: async (p) => { calls.push(['generate', p.requestKey, p]); return over.generate ? over.generate(p, calls.filter(c => c[0] === 'generate').length) : okAI(); },
    withhold: async (args) => { calls.push(['withhold', args]); if (over.withhold) return over.withhold(args); },
    readWallet: async () => over.wallet ?? { total: 8, state: 'ok' },
    log: (line) => logs.push(line),
  };
  return { deps, calls, logs, tick: (ms) => { t += ms; }, run: (extra = {}) => runRepair({ user, attemptId: 'a1', questionId: 'q1', requestId: REQ, startedAt: T0, deps, config, ...extra }) };
}
const kinds = (calls) => calls.map(c => c[0]);
const releases = (calls) => calls.filter(c => c[0] === 'release').map(c => c[2]);
const OP = `repair:${mistakeId('u1', 'a1', 'q1')}:${REQ}`;

test('a reading question sends its passage to the repair prompt and the blind prompt, and the blind prompt never carries the key', async () => {
  const h = harness({ generate: async (p, n) => (n === 1 ? okAI({ ...good, solved_index: 2, agrees_with_key: false }) : okAI({ solved_index: 1 })) });
  await h.run();
  const [main, blind] = h.calls.filter(c => c[0] === 'generate').map(c => c[2]);
  assert.match(main.userMessage, /Maya read the notice twice/);
  assert.match(main.userMessage, /The Notice/);
  assert.match(blind.userMessage, /Maya read the notice twice/);
  assert.doesNotMatch(`${blind.systemPrompt}\n${blind.userMessage}`, /answer key|Student chose/);
});

test('an NTA paper with shuffled options is repaired instead of being refused as a changed key', async () => {
  const stored = ['Debit the asset', 'Credit the asset', 'Debit the capital', 'Credit the capital'];
  const order = [2, 0, 3, 1];
  const served = { id: 'q1', chapter: 'Journal', question: 'Which entry records the purchase?', options: order.map((i, p) => ({ key: 'ABCD'[p], text: stored[i] })), correctIndex: order.indexOf(1), optionOrder: order, optionsShuffled: true };
  const h = harness({
    attempt: { ...attempt, subject: 'accountancy', questionsSnapshot: [served] },
    live: { id: 'q1', status: 'live', verification_state: 'verified', options: stored.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: 'B' },
    generate: async () => okAI({ ...good, solved_index: order.indexOf(1) }),
  });
  const { http, body } = await h.run();
  assert.equal(http, 200);
  assert.equal(body.status, 'explained', 'was 409 key_changed before the fix');
  assert.equal(body.keyIndex, order.indexOf(1), 'the letters are the ones the student saw');
  const prompt = h.calls.find(c => c[0] === 'generate')[2];
  assert.match(prompt.systemPrompt, new RegExp(`answer key is option D \\(index ${order.indexOf(1)}\\)`));
});

test('success: reserve, execute, generate, commit once; the receipt names the provider and model that ran', async () => {
  const h = harness({ generate: async () => okAI(good, { usage: { provider: 'anthropic', model: 'claude-haiku-5-5', inputTokens: 310, outputTokens: 140 }, fallbackUsed: true, fallbackReason: 'quota' }) });
  const { http, body } = await h.run();
  assert.equal(http, 200);
  assert.equal(body.status, 'explained');
  assert.equal(body.charged, 1);
  assert.equal(body.repair.model, 'claude-haiku-5-5');
  assert.deepEqual(body.wallet, { total: 8, state: 'ok' });
  assert.deepEqual(kinds(h.calls), ['reserve', 'executing', 'generate', 'commit', 'traps']);
  const receipt = h.calls.find(c => c[0] === 'commit')[2];
  assert.equal(receipt.provider, 'anthropic');
  assert.equal(receipt.model, 'claude-haiku-5-5');
  assert.equal(receipt.fallbackUsed, true);
  assert.equal(receipt.fallbackReason, 'quota');
  assert.equal(receipt.inputTokens, 310);
  assert.equal(h.logs.length, 1, 'a good repair logs only its interpret line');
  assert.deepEqual(JSON.parse(h.logs[0]), { route: 'repair', stage: 'interpret', kind: 'explained', dropped: [] });
});

test('the model work is given a deadline, per-call caps and the Haiku fallback route; the blind check gets its own caps', async () => {
  const h = harness({ generate: async (p, n) => (n === 1 ? okAI({ ...good, solved_index: 3, agrees_with_key: false }) : okAI({ solved_index: 1 })) });
  await h.run();
  const [main, blind] = h.calls.filter(c => c[0] === 'generate').map(c => c[2]);
  assert.equal(main.deadlineAt, T0 + 45_000);
  assert.equal(main.callTimeoutMs, 25_000);
  assert.deepEqual(main.fallbackRoute, FALLBACK);
  assert.equal(main.reasoningEffort, 'low');
  assert.equal(blind.deadlineAt, T0 + 78_000);
  assert.equal(blind.callTimeoutMs, 30_000);
  assert.equal(blind.reasoningEffort, 'high', 'blind-check timing is unchanged (owner decision D3)');
  assert.equal(blind.fallbackRoute, undefined);
  assert.equal(blind.requestKey, `${OP}:blind`);
});

test('the whole repair, blind check included, cannot run past about 85 s (the route allows 90)', () => {
  const SDK_HARD_STOP_GRACE = 3_000;
  assert.ok(REPAIR_BUDGET.totalMs + SDK_HARD_STOP_GRACE <= 85_000, 'worst case: the last call is stopped 3 s after its deadline');
  assert.ok(REPAIR_BUDGET.mainMs < REPAIR_BUDGET.totalMs);
  assert.ok(REPAIR_BUDGET.callMs < REPAIR_BUDGET.mainMs, 'room for a fallback call after a slow primary');
  assert.ok(REPAIR_BUDGET.deadAfterMs > 90_000, 'a reservation older than any function can live');
});

test('a timeout releases the credit and says so; nothing is charged', async () => {
  const h = harness({ generate: async () => failedAI('timeout') });
  const { http, body } = await h.run();
  assert.equal(http, 504);
  assert.equal(body.error, 'provider_timeout');
  assert.equal(body.charged, 0);
  assert.equal(body.message, 'This one took too long. You were not charged.');
  assert.deepEqual(releases(h.calls), ['provider_timeout']);
  assert.ok(!kinds(h.calls).includes('commit'));
});

test('a generate call that never returns is stopped at the deadline and the credit is released', async () => {
  const h = harness({ generate: () => new Promise(() => {}) });
  const budget = { ...REPAIR_BUDGET, totalMs: 40, mainMs: 30, hardStopSlackMs: 10 };
  const started = Date.now();
  const { http, body } = await runRepair({ user, attemptId: 'a1', questionId: 'q1', requestId: REQ, startedAt: T0, deps: { ...h.deps, now: () => T0 }, config: { ...config, budget } });
  assert.ok(Date.now() - started < 2000, 'returned promptly instead of hanging');
  assert.equal(http, 504);
  assert.equal(body.error, 'provider_timeout');
  assert.deepEqual(releases(h.calls), ['provider_timeout']);
});

test('quota, a rate limit, a 5xx or a rejected parameter all read as "not available right now", released', async () => {
  for (const kind of ['quota', 'rate_limit', 'server', 'bad_request', 'network']) {
    const h = harness({ generate: async () => failedAI(kind) });
    const { http, body } = await h.run();
    assert.equal(http, 503, kind);
    assert.equal(body.error, 'provider_unavailable', kind);
    assert.equal(body.charged, 0);
    assert.match(body.message, /aren’t available right now\. Try again in a little while\. You were not charged\.$/);
    assert.deepEqual(releases(h.calls), ['provider_unavailable']);
  }
});

test('the monthly student-AI budget has its own code and names the day it returns', async () => {
  const h = harness({ generate: async () => failedAI('budget') });
  const { http, body } = await h.run();
  assert.equal(http, 503);
  assert.equal(body.error, 'budget_reached');
  assert.equal(body.message, 'Repairs are paused until 1 November. You were not charged.');
  assert.deepEqual(releases(h.calls), ['budget_reached']);
});

test('a paused runtime guard is `paused`; the real gate pause never reserves anything', async () => {
  const guard = harness({ generate: async () => failedAI('guard_paused') });
  const a = await guard.run();
  assert.equal(a.body.error, 'paused'); assert.equal(a.http, 503); assert.match(a.body.message, /You were not charged\.$/);
  const gate = harness({ gateOpen: false });
  const b = await gate.run();
  assert.equal(b.http, 503); assert.equal(b.body.error, 'paused'); assert.equal(b.body.charged, 0);
  assert.deepEqual(kinds(gate.calls), [], 'nothing reserved, nothing called');
});

test('unreadable output and unclassified failures keep the code the app already knows, and release', async () => {
  for (const ai of [failedAI('unknown'), { ok: false, data: null, usage: null, failure: null }]) {
    const h = harness({ generate: async () => ai });
    const { http, body } = await h.run();
    assert.equal(http, 502); assert.equal(body.error, 'unusable_output'); assert.deepEqual(releases(h.calls), ['unusable_output']);
  }
  const short = harness({ generate: async () => okAI({ ...good, rule: '' }) });
  assert.equal((await short.run()).body.error, 'unusable_output');
  assert.deepEqual(releases(short.calls), ['unusable_output']);
  const thrown = harness({ generate: async () => { throw new Error('boom'); } });
  const t = await thrown.run();
  assert.equal(t.body.error, 'provider_error'); assert.deepEqual(releases(thrown.calls), ['provider_error']);
});

test('one log line per failed repair: stage, code, provider status, model, elapsed ms; no student data, no keys', async () => {
  const h = harness({ generate: async () => failedAI('quota', { status: 429, code: 'insufficient_quota' }) });
  h.deps.now = (() => { let n = T0; return () => (n += 1500); })();
  await h.run();
  assert.equal(h.logs.length, 1);
  const line = JSON.parse(h.logs[0]);
  assert.equal(line.route, 'repair');
  assert.equal(line.code, 'provider_unavailable');
  assert.equal(line.kind, 'quota');
  assert.equal(line.providerStatus, 429);
  assert.equal(line.providerCode, 'insufficient_quota');
  assert.equal(line.model, 'gpt-6-luna');
  assert.equal(line.released, true);
  assert.equal(typeof line.ms, 'number'); assert.ok(line.ms > 0);
  const text = h.logs[0];
  for (const secret of ['u1', 'q1', 'a1', REQ, passage, 'Maya', 'sk-']) assert.ok(!text.includes(secret), `the log line must not contain ${secret}`);
});

test('a failed release is told honestly: the credit is held, not "not charged"', async () => {
  const h = harness({ generate: async () => failedAI('timeout'), release: async () => { throw new Error('db down'); } });
  const { body } = await h.run();
  assert.equal(body.error, 'provider_timeout');
  assert.doesNotMatch(body.message, /You were not charged/);
  assert.match(body.message, /held briefly and returns automatically/);
  assert.equal(JSON.parse(h.logs[0]).released, false);
});

test('a wallet hiccup is not "paused": nothing was reserved and the app keeps its normal flow', async () => {
  const thrown = harness({ reserve: async () => { throw new Error('mm_ai_reserve_credits_failed'); } });
  const a = await thrown.run();
  assert.equal(a.http, 503); assert.equal(a.body.error, 'wallet_unavailable'); assert.match(a.body.message, /Nothing was charged/);
  assert.deepEqual(kinds(thrown.calls), ['reserve']);
  const rejected = harness({ reserve: async () => ({ ok: false, error: 'wallet_not_found' }) });
  assert.equal((await rejected.run()).body.error, 'wallet_unavailable');
  const broke = harness({ reserve: async () => ({ ok: false, error: 'insufficient_ai_credits', balance: 0 }) });
  const c = await broke.run();
  assert.equal(c.http, 402); assert.equal(c.body.error, 'insufficient_ai_credits');
});

test('a reservation for this operation that has expired is released and no longer answers "still being prepared"', async () => {
  const dead = { operation_key: OP, state: 'executing', created_at: new Date(T0 - 11 * 60_000).toISOString(), expires_at: new Date(T0 - 60_000).toISOString() };
  const h = harness({ open: [dead] });
  const { http, body } = await h.run();
  assert.equal(http, 409);
  assert.equal(body.error, 'operation_released', 'the app and the website already restart with a fresh requestId on this');
  assert.equal(body.charged, 0);
  assert.deepEqual(h.calls, [['release', OP, 'expired']], 'released, nothing reserved, no model called');
});

test('an open reservation older than any function can live is released at once, before its ten-minute expiry', async () => {
  const stale = { operation_key: OP, state: 'executing', created_at: new Date(T0 - 160_000).toISOString(), expires_at: new Date(T0 + 7 * 60_000).toISOString() };
  assert.equal(isDeadReservation(stale, T0), true);
  const h = harness({ open: [stale] });
  assert.equal((await h.run()).body.error, 'operation_released');
  assert.deepEqual(releases(h.calls), ['expired']);
});

test('a repair that may still be running blocks a second one for the same mistake (no double charge) and is left alone', async () => {
  const running = { operation_key: `repair:${mistakeId('u1', 'a1', 'q1')}:another_request_000001`, state: 'executing', created_at: new Date(T0 - 20_000).toISOString(), expires_at: new Date(T0 + 9 * 60_000).toISOString() };
  assert.equal(isDeadReservation(running, T0), false);
  const h = harness({ open: [running] });
  const { http, body } = await h.run();
  assert.equal(http, 409);
  assert.equal(body.error, 'in_progress');
  assert.deepEqual(h.calls, [], 'no release, no second reservation, no model call');
});

test('a dead reservation under another request id is released and the new repair carries on', async () => {
  const old = { operation_key: `repair:${mistakeId('u1', 'a1', 'q1')}:old_request_0000001`, state: 'executing', created_at: new Date(T0 - 900_000).toISOString(), expires_at: new Date(T0 - 300_000).toISOString() };
  const h = harness({ open: [old] });
  const { http, body } = await h.run();
  assert.equal(http, 200);
  assert.equal(body.status, 'explained');
  assert.deepEqual(kinds(h.calls), ['release', 'reserve', 'executing', 'generate', 'commit', 'traps']);
  assert.deepEqual(h.calls[0], ['release', old.operation_key, 'expired']);
});

test('if a dead reservation cannot be released, the repair does not start a second charge', async () => {
  const old = { operation_key: OP, state: 'executing', created_at: new Date(T0 - 900_000).toISOString(), expires_at: new Date(T0 - 300_000).toISOString() };
  const h = harness({ open: [old], release: async () => { throw new Error('db down'); } });
  const { body } = await h.run();
  assert.equal(body.error, 'in_progress');
  assert.ok(!kinds(h.calls).includes('reserve'));
});

test('a stored repair still reopens free, even with an open reservation or the gate closed', async () => {
  const h = harness({ stored: { ...good, model: 'gpt-6-luna' }, gateOpen: false, open: [{ operation_key: OP, state: 'executing', created_at: new Date(T0 - 1000).toISOString(), expires_at: new Date(T0 + 1000).toISOString() }] });
  const { http, body } = await h.run();
  assert.equal(http, 200); assert.equal(body.status, 'stored'); assert.equal(body.charged, 0);
  assert.deepEqual(kinds(h.calls), ['traps'], 'only the free pattern read; nothing reserved, no model call');
});

test('the commit is retried once; if it still fails the credit is handed back instead of kept', async () => {
  const flaky = harness({ commit: async (k, r, n) => (n === 1 ? { ok: false, error: 'busy' } : { ok: true }) });
  const a = await flaky.run();
  assert.equal(a.body.charged, 1);
  assert.deepEqual(kinds(flaky.calls).filter(k => k === 'commit'), ['commit', 'commit']);
  assert.deepEqual(releases(flaky.calls), []);

  const dead = harness({ commit: async () => { throw new Error('db down'); } });
  const b = await dead.run();
  assert.equal(b.body.status, 'explained', 'the student still gets the repair they waited for');
  assert.equal(b.body.charged, 0);
  assert.deepEqual(releases(dead.calls), ['commit_failed'], 'and the credit is released, not left reserved');
  assert.equal(kinds(dead.calls).filter(k => k === 'commit').length, 2);
  assert.equal(JSON.parse(dead.logs.at(-1)).code, 'commit_failed');

  const landed = harness({ commit: async () => { throw new Error('response lost'); }, release: async () => ({ ok: false, error: 'already_committed' }) });
  assert.equal((await landed.run()).body.charged, 1, 'if the commit had in fact landed, the charge is reported as made');
});

test('markExecuting failing releases the credit', async () => {
  const h = harness({ markExecuting: async () => ({ ok: false }) });
  const { http, body } = await h.run();
  assert.equal(http, 503); assert.equal(body.error, 'could_not_start'); assert.deepEqual(releases(h.calls), ['could_not_start']);
  assert.ok(!kinds(h.calls).includes('generate'));
});

test('key dispute: a blind check that agrees with the key explains nothing and releases; one that confirms withholds the question', async () => {
  const disputed = okAI({ ...good, solved_index: 3, agrees_with_key: false });
  const agrees = harness({ generate: async (p, n) => (n === 1 ? disputed : okAI({ solved_index: 1 })) });
  const a = await agrees.run();
  assert.equal(a.body.status, 'not_explained'); assert.equal(a.body.charged, 0);
  assert.deepEqual(releases(agrees.calls), ['ai_inconsistent']);

  const confirms = harness({ generate: async (p, n) => (n === 1 ? disputed : okAI({ solved_index: 2 })) });
  const b = await confirms.run();
  assert.equal(b.body.status, 'held_for_recheck');
  assert.deepEqual(b.body.dispute, { ourIndex: 3, secondIndex: 2 });
  assert.deepEqual(releases(confirms.calls), ['ai_key_dispute']);
  assert.ok(kinds(confirms.calls).includes('withhold'));

  const unconfirmed = harness({ generate: async (p, n) => (n === 1 ? disputed : okAI({ solved_index: 2 })), withhold: async () => { throw new Error('quarantine_not_confirmed'); } });
  assert.equal((await unconfirmed.run()).body.error, 'quarantine_not_confirmed');
  assert.deepEqual(releases(unconfirmed.calls), ['quarantine_not_confirmed']);
});

test('a blind check that times out or fails never keeps the credit and never withholds the question', async () => {
  const h = harness({ generate: async (p, n) => (n === 1 ? okAI({ ...good, solved_index: 3, agrees_with_key: false }) : failedAI('timeout')) });
  const { http, body } = await h.run();
  assert.equal(http, 200); assert.equal(body.status, 'not_explained'); assert.equal(body.charged, 0);
  assert.deepEqual(releases(h.calls), ['ai_inconsistent']);
  assert.ok(!kinds(h.calls).includes('withhold'));
});

test('a bad request id and a withdrawn question never reserve anything', async () => {
  const h = harness();
  assert.equal((await h.run({ requestId: 'short' })).body.error, 'request_id_required');
  const missing = harness({ live: null });
  assert.equal((await missing.run()).body.error, 'question_withdrawn');
  assert.deepEqual(kinds(h.calls).concat(kinds(missing.calls)), []);
});

// ---- Repair v3 wiring (build spec 15 Oct 2026, A.2, A.3, A.6, A.7) ----
test('v3: one call with maxTokens 1400 and the v3 schema; the user message names the subject, never the student', async () => {
  const h = harness();
  const { http, body } = await h.run();
  assert.equal(http, 200); assert.equal(body.status, 'explained');
  const gen = h.calls.filter(c => c[0] === 'generate');
  assert.equal(gen.length, 1, 'one model call: "another way" comes in the same response');
  const p = gen[0][2];
  assert.equal(p.maxTokens, 1400);
  assert.equal(p.responseSchema, MISTAKE_REPAIR_SCHEMA_V3);
  assert.match(p.userMessage, /^Subject: English\nChapter: Reading\n/);
  assert.match(p.systemPrompt, /tutor for CUET UG English\. A student chose option A \(index 0\)/);
  for (const secret of ['u1', 'a1', REQ]) assert.ok(!`${p.systemPrompt}\n${p.userMessage}`.includes(secret), secret);
});

test('v3: the receipt carries promptVersion, subject, chapter and the trap type; the stored repair has no aliases, the response has them', async () => {
  const h = harness();
  const { body } = await h.run();
  const receipt = h.calls.find(c => c[0] === 'commit')[2];
  assert.equal(receipt.promptVersion, 3);
  assert.equal(receipt.subject, 'english');
  assert.equal(receipt.chapter, 'Reading');
  assert.equal(receipt.repair.version, 3);
  assert.equal(receipt.repair.trap_type, 'not_in_passage');
  assert.equal(receipt.repair.why_right, good.why_right);
  assert.deepEqual(receipt.repair.others.map(o => o.index), [2, 3]);
  assert.ok(!('why_tempting' in receipt.repair) && !('key_idea' in receipt.repair), 'aliases are never stored');
  assert.equal(body.repair.version, 3);
  assert.equal(body.repair.why_tempting, good.trap, 'older app builds read why_tempting');
  assert.equal(body.repair.key_idea, good.rule, 'older app builds read key_idea');
  assert.ok(!('next_step' in body.repair), 'the model no longer writes a next step');
  assert.equal(body.pattern, null, 'no earlier typed repairs: no pattern line');
});

const OTHER = (n) => `repair:${mistakeId('u1', 'a1', `other${n}`)}:req_${String(n).padStart(16, '0')}`;
test('v3: the pattern line is read after the commit, counting this repair once', async () => {
  const rows = [
    { operation_key: OTHER(1), trap: 'not_in_passage', subject: 'english', chapter: 'Reading' },
    { operation_key: OTHER(2), trap: 'look_alike_term', subject: 'english', chapter: 'Reading' },
    { operation_key: `repair:${mistakeId('u1', 'a1', 'q1')}:old_request_0000001`, trap: 'not_in_passage', subject: 'english', chapter: 'Reading' },
  ];
  const h = harness({ traps: async () => rows });
  const { body } = await h.run();
  assert.deepEqual(body.pattern, { line: '2 of your 3 repaired mistakes in Reading had the same trap: not in the passage.', scope: 'chapter', k: 2, n: 3, trapType: 'not_in_passage' });
  assert.deepEqual(h.calls.find(c => c[0] === 'traps'), ['traps', 'u1']);
  assert.ok(kinds(h.calls).indexOf('traps') > kinds(h.calls).indexOf('commit'), 'read after the commit');
});

test('v3: a failing or slow pattern read gives pattern null and the repair still arrives', async () => {
  const failing = harness({ traps: async () => { throw new Error('db down'); } });
  const a = await failing.run();
  assert.equal(a.body.status, 'explained'); assert.equal(a.body.pattern, null); assert.equal(a.body.charged, 1);
  const slow = harness({ traps: () => new Promise(() => {}) });
  const started = Date.now();
  const b = await slow.run();
  assert.equal(b.body.status, 'explained'); assert.equal(b.body.pattern, null);
  assert.ok(Date.now() - started < PATTERN_BUDGET_MS + 1000, 'stopped at the 1.5 s cap');
  assert.equal(PATTERN_BUDGET_MS, 1500);
  const noCommit = harness({ commit: async () => ({ ok: false }), traps: async () => [] });
  const c = await noCommit.run();
  assert.equal(c.body.pattern, null); assert.ok(!kinds(noCommit.calls).includes('traps'), 'no pattern for a repair that was not stored');
});

test('v3: a stored reopen returns the pattern; a failing pattern read gives null and the status stays stored', async () => {
  const stored = { version: 3, trap_type: 'not_in_passage', trap: good.trap, why_wrong: good.why_wrong, why_right: good.why_right, others: [], rule: good.rule, model: 'gpt-6-luna' };
  const rows = [
    { operation_key: OTHER(1), trap: 'not_in_passage', subject: 'english', chapter: 'Reading' },
    { operation_key: OTHER(2), trap: 'reversed', subject: 'english', chapter: 'Reading' },
  ];
  const h = harness({ stored, traps: async () => rows });
  const { body } = await h.run();
  assert.equal(body.status, 'stored'); assert.equal(body.charged, 0);
  assert.equal(body.pattern.line, '2 of your 3 repaired mistakes in Reading had the same trap: not in the passage.');
  assert.equal(body.repair.key_idea, good.rule);
  const broken = harness({ stored, traps: async () => { throw new Error('db down'); } });
  const r = await broken.run();
  assert.equal(r.http, 200); assert.equal(r.body.status, 'stored'); assert.equal(r.body.pattern, null);
  const v1Stored = harness({ stored: { ...goodV1, model: 'gpt-6-luna' } });
  const v1 = await v1Stored.run();
  assert.equal(v1.body.pattern, null); assert.ok(!kinds(v1Stored.calls).includes('traps'), 'a v1 repair has no trap type, so nothing is read');
  assert.equal(v1.body.repair.why_tempting, goodV1.why_tempting); assert.ok(!('version' in v1.body.repair), 'a v1 payload comes back as stored');
});

test('v3: the interpret line is logged for an unusable answer, with the reason, and the credit is released', async () => {
  const h = harness({ generate: async () => okAI({ ...good, trap: 'You rushed and picked the longest option here.' }) });
  const { http, body } = await h.run();
  assert.equal(http, 502); assert.equal(body.error, 'unusable_output'); assert.deepEqual(releases(h.calls), ['unusable_output']);
  assert.deepEqual(JSON.parse(h.logs[0]), { route: 'repair', stage: 'interpret', kind: 'unusable', reason: 'trap', dropped: [] });
  const dropped = harness({ generate: async () => okAI({ ...good, memory_hook: good.rule }) });
  await dropped.run();
  assert.deepEqual(JSON.parse(dropped.logs[0]).dropped, ['memory_hook']);
  for (const line of [...h.logs, ...dropped.logs]) for (const secret of ['u1', 'q1', 'a1', REQ, 'Maya', good.trap]) assert.ok(!line.includes(secret), secret);
});

test('REPAIR_PROMPT_VERSION=1 rollback: today\'s prompt, schema, interpreter and default token cap, and no interpret line', async () => {
  const h = harness({ generate: async () => okAI(goodV1) });
  const { http, body } = await h.run({ config: { ...config, promptVersion: 1 } });
  assert.equal(http, 200); assert.equal(body.status, 'explained');
  const p = h.calls.find(c => c[0] === 'generate')[2];
  const expected = buildRepairPrompt({ question: snapshot, chosenIndex: 0, keyIndex: 1, subject: 'english' });
  assert.equal(p.systemPrompt, expected.system);
  assert.equal(p.userMessage, expected.user);
  assert.equal(p.responseSchema, MISTAKE_REPAIR_SCHEMA);
  assert.ok(!('maxTokens' in p), 'the default token cap');
  assert.equal(body.repair.key_idea, goodV1.key_idea); assert.ok(!('version' in body.repair));
  assert.equal(body.pattern, null);
  assert.equal(h.logs.length, 0);
  assert.equal(h.calls.find(c => c[0] === 'commit')[2].promptVersion, 1);
});
