// Per-user monthly AI cap, the two-model allowlist, the two-call ladder and the Ask Mobi context cap (17 Oct 2026,
// docs/brain/AI-COST-PER-USER-2026-10-17.md). Fakes and an in-process Postgres only: no network, no paid model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  createProviderRuntime, classifyGuardMessage, isAllowedModel, ALLOWED_MODELS, MAX_PHYSICAL_CALLS, REASONING_HEADROOM, outputBound,
} from '../../src/services/ai/providerCore.js';
import { capContextBytes, MAX_CONTEXT_BYTES } from '../../src/services/ai/contextBudget.js';
import { runModelReply } from '../../src/services/prepos/modelReply.js';
import { runRepair, mistakeId } from '../../src/services/recovery/repairFlow.js';
import { repairFailureForKind, userLimitMessage, composeFailureMessage } from '../repair_failures.js';
import { repairRetryPolicy } from '../repair_presentation.mjs';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const MIGRATION = file('supabase/migrations/20261017120000_runtime_ai_user_cap.sql');
const UNDO = file('supabase/undo/20261017120000_runtime_ai_user_cap.undo.sql');

// ---- The database guard, on production-shaped tables ----------------------------------------------------------
async function guardDb() {
  const db = new PGlite(); const q = (s, p) => db.query(s, p).then((r) => r.rows);
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table public.users(id text primary key);
    create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int, included_credits_used int check(included_credits_used>=0), bonus_credits int check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any(array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text check (wallet_source = any(array['included','bonus','mixed','grant','adjustment','none'])), balance_after int, idempotency_key text);`);
  for (const f of ['20261002121000_runtime_ai_guard.sql', '20261002130000_prepos_credit_reservations.sql', '20261004120000_runtime_ai_monthly_cap.sql'])
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8'));
  await db.exec(`insert into public.runtime_ai_prices values ('openai','gpt-6-luna',0.1,0.5,'https://example.invalid/fixture',now()),('anthropic','claude-haiku-5-5',0.1,0.5,'https://example.invalid/fixture',now())
    on conflict (provider,model) do update set verified_at=now()`);
  return { db, q };
}
// 4,000 input bytes + 2,400 output tokens at USD 0.10 / 0.50 per million = USD 0.0016 a reservation.
const COST = 0.0016;
const reserveWith = (q) => (key, user = null, tier = null, provider = 'openai', model = 'gpt-6-luna') =>
  q('select reserve_runtime_ai($1,$2,$3,$4,$5,$6,$7) v', [key, provider, model, 4000, 2400, user, tier]);

test('per-user cap: free USD 0.0114, paid USD 0.0568, IST month, global check untouched, no-user calls unchanged', async () => {
  const { db, q } = await guardDb();
  try {
    await db.exec(MIGRATION);
    const caps = Object.fromEntries((await q("select id, monthly_cap_usd from runtime_ai_budget where id like 'student_user_%'")).map((r) => [r.id, Number(r.monthly_cap_usd)]));
    assert.deepEqual(caps, { student_user_paid: 0.0568, student_user_free: 0.0114 });
    assert.equal(Number((await q("select monthly_cap_usd from runtime_ai_budget where id='student_ai'"))[0].monthly_cap_usd), 25, 'the global cap is as it was');
    const reserve = reserveWith(q);

    // Free: 7 reservations of 0.0016 = 0.0112 fit under 0.0114; the 8th would make 0.0128.
    for (let i = 0; i < 7; i += 1) assert.equal((await reserve(`free_user_key_${i}`, 'u_free', 'free'))[0].v.dispatch, true, `free reservation ${i + 1} is under the cap`);
    await assert.rejects(reserve('free_user_key_7', 'u_free', 'free'), /runtime user limit reached/);
    assert.equal((await q("select count(*)::int n from runtime_ai_requests where request_key='free_user_key_7'"))[0].n, 0, 'a refused reservation leaves no row');
    // Another student is not affected, and neither is a call with no user.
    assert.equal((await reserve('other_user_key_0', 'u_other', 'free'))[0].v.dispatch, true);
    assert.equal((await reserve('script_call_key_0'))[0].v.dispatch, true, 'no user: only the global check applies');
    // An unknown tier is the free cap (the stricter one).
    await assert.rejects(reserve('free_user_key_8', 'u_free', 'whatever'), /runtime user limit reached/);
    // A retry of an existing key is idempotent and is not refused by the cap.
    assert.equal((await reserve('free_user_key_0', 'u_free', 'free'))[0].v.dispatch, false);

    // Real usage is booked as actual spend, which is far below the reservation: room opens up again.
    for (let i = 0; i < 7; i += 1) await q('select receipt_runtime_ai($1,$2,$3)', [`free_user_key_${i}`, 0.0002, { fixture: true }]);
    assert.equal((await reserve('free_user_key_9', 'u_free', 'free'))[0].v.dispatch, true, '7 x 0.0002 + 0.0016 is under 0.0114');

    // Paid (Rs 5 = USD 0.0568): 35 reservations = 0.056 fit; the 36th would make 0.0576.
    for (let i = 0; i < 35; i += 1) await reserve(`paid_user_key_${String(i).padStart(2, '0')}`, 'u_paid', 'paid');
    await assert.rejects(reserve('paid_user_key_35', 'u_paid', 'paid'), /runtime user limit reached/);

    // The cap is the IST month: last month's rows do not count.
    await q("update runtime_ai_requests set created_at = runtime_ai_month_start() - interval '1 day' where user_id in ('u_paid','u_free')");
    assert.equal((await reserve('paid_user_key_36', 'u_paid', 'paid'))[0].v.dispatch, true);
    assert.equal((await reserve('free_user_key_10', 'u_free', 'free'))[0].v.dispatch, true);

    // A cap is a row: changing it takes one UPDATE and no deploy.
    await q("update runtime_ai_budget set monthly_cap_usd=0.0001 where id='student_user_paid'");
    await assert.rejects(reserve('paid_user_key_37', 'u_paid', 'paid'), /runtime user limit reached/);
    await q("delete from runtime_ai_budget where id='student_user_free'");
    await assert.rejects(reserve('free_user_key_11', 'u_free', 'free'), /runtime funding unavailable/, 'a missing cap row fails closed');

    // The global monthly cap is still checked, and first.
    await q("update runtime_ai_budget set monthly_cap_usd=0.001 where id='student_ai'");
    await assert.rejects(reserve('late_user_key_0', 'u_other', 'free'), /runtime budget exhausted/);
    await assert.rejects(reserve('script_call_key_1'), /runtime budget exhausted/);

    await db.exec('set role authenticated');
    await assert.rejects(reserve('client_key_000001', 'u_free', 'free'), /permission denied/);
  } finally { await db.close(); }
});

test('model allowlist in the database: only openai gpt-6-luna and anthropic claude-haiku-5-5; other price rows stay', async () => {
  const { db, q } = await guardDb();
  try {
    await db.exec(MIGRATION);
    const reserve = reserveWith(q);
    const before = (await q('select count(*)::int n from runtime_ai_prices'))[0].n;
    assert.ok((await q("select count(*)::int n from runtime_ai_prices where model in ('gpt-4.1-mini','claude-sonnet-5-5','claude-haiku-4-5')"))[0].n >= 3, 'history rows exist');
    for (const [provider, model] of [['openai', 'gpt-4.1-mini'], ['openai', 'gpt-4o-mini'], ['anthropic', 'claude-sonnet-5-5'], ['anthropic', 'claude-haiku-4-5'], ['openai', 'claude-haiku-5-5'], ['anthropic', 'gpt-6-luna'], ['deepseek', 'deepseek-chat']]) {
      await assert.rejects(reserve(`model_check_${provider}_${model}`.replace(/[^a-z0-9_]/gi, '_'), 'u1', 'paid', provider, model), /runtime model not allowed/, `${provider}/${model}`);
      await assert.rejects(reserve(`model_check_nouser_${provider}_${model}`.replace(/[^a-z0-9_]/gi, '_'), null, null, provider, model), /runtime model not allowed/, `${provider}/${model} without a user`);
    }
    assert.equal((await reserve('model_ok_luna_000', 'u1', 'paid'))[0].v.dispatch, true);
    assert.equal((await reserve('model_ok_haiku_00', 'u1', 'paid', 'anthropic', 'claude-haiku-5-5'))[0].v.dispatch, true);
    assert.equal((await q('select count(*)::int n from runtime_ai_prices'))[0].n, before, 'no price row was removed');
    assert.equal((await q('select count(*)::int n from runtime_ai_requests'))[0].n, 2, 'refused models left no reservation');
  } finally { await db.close(); }
});

test('the old 5-argument call still works after the migration, and the undo restores the old function exactly', async () => {
  const { db, q } = await guardDb();
  try {
    await db.exec(MIGRATION);
    assert.equal((await q("select reserve_runtime_ai('five_arg_key_0001','openai','gpt-6-luna',4000,2400) v"))[0].v.dispatch, true);
    assert.equal((await q("select count(*)::int n from pg_proc where proname='reserve_runtime_ai'"))[0].n, 1, 'one function, so a 5-argument call is never ambiguous');
    await db.exec(UNDO);
    assert.equal((await q("select count(*)::int n from pg_proc where proname='reserve_runtime_ai' and pronargs=5"))[0].n, 1);
    assert.equal((await q("select count(*)::int n from pg_proc where proname='reserve_runtime_ai'"))[0].n, 1);
    assert.equal((await q("select count(*)::int n from information_schema.columns where table_name='runtime_ai_requests' and column_name='user_id'"))[0].n, 0);
    assert.equal((await q("select count(*)::int n from runtime_ai_budget where id like 'student_user_%'"))[0].n, 0);
    assert.equal((await q("select reserve_runtime_ai('five_arg_key_0002','openai','gpt-6-luna',4000,2400) v"))[0].v.dispatch, true);
    await db.exec(MIGRATION); // and it applies again
    assert.equal((await q("select count(*)::int n from runtime_ai_budget where id like 'student_user_%'"))[0].n, 2);
    await assert.rejects(q("select reserve_runtime_ai('model_after_redo_01','openai','gpt-4.1-mini',4000,2400,'u1','paid') v"), /model not allowed/);
  } finally { await db.close(); }
});

// ---- The provider ladder ---------------------------------------------------------------------------------------
const okOpenAI = (raw = '{"solved_index":2}') => ({ choices: [{ message: { content: raw } }], usage: { prompt_tokens: 100, completion_tokens: 50 } });
const okAnthropic = (raw = '{"solved_index":2}') => ({ content: [{ type: 'text', text: raw }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } });
const schema = { required: ['solved_index'], types: { solved_index: 'number' } };
class ApiError extends Error { constructor(status, code) { super('provider said no'); this.status = status; this.code = code; this.type = code; } }
function harness({ openai, anthropic, reserve } = {}) {
  const log = { reserve: [], openai: [], anthropic: [], lines: [] };
  const clients = {
    openai: openai ? { chat: { completions: { create: async (body) => { log.openai.push(body); return openai(body, log.openai.length); } } } } : null,
    anthropic: anthropic ? { messages: { create: async (body) => { log.anthropic.push(body); return anthropic(body, log.anthropic.length); } } } : null,
  };
  const runtime = createProviderRuntime({
    getClient: (p) => clients[p] ?? null,
    reserveRuntime: async (a) => { log.reserve.push(a); return reserve ? reserve(a, log.reserve.length) : { dispatch: true, inputRate: 0.1, outputRate: 0.5 }; },
    receiptRuntime: async () => {},
    log: (line) => log.lines.push(line),
  });
  return { ...runtime, log };
}
const HAIKU = { provider: 'anthropic', model: 'claude-haiku-5-5', reasoningEffort: 'low' };
const run = (h, extra = {}) => h.generateAIResponse({ requestKey: 'repair:abc:req_0123456789abcdef', tier: 'fast', systemPrompt: 'sys', userMessage: 'hello', responseSchema: schema, provider: 'openai', model: 'gpt-6-luna', reasoningEffort: 'low', ...extra });
const physical = (h) => h.log.openai.length + h.log.anthropic.length;

test('reasoning headroom at low effort is 1,000 (was 2,500): Repair v3 reserves 2,400 output tokens, smart Ask Mobi 1,900', async () => {
  assert.equal(REASONING_HEADROOM.low, 1000);
  assert.equal(REASONING_HEADROOM.none, 0);
  assert.equal(outputBound('gpt-6-luna', 1400, 'low'), 2400);
  assert.equal(outputBound('claude-haiku-5-5', 1400, 'low'), 2400);
  assert.equal(outputBound('gpt-6-luna', 900, 'low'), 1900);
  assert.equal(outputBound('gpt-6-luna', 950, 'none'), 950);
  const repair = harness({ openai: async () => okOpenAI() });
  await run(repair, { maxTokens: 1400 });
  assert.equal(repair.log.reserve[0].maxTokens, 2400);
  assert.equal(repair.log.openai[0].max_completion_tokens, 2400);
  const smart = harness({ openai: async () => okOpenAI() });
  await run(smart, { tier: 'smart' });
  assert.equal(smart.log.reserve[0].maxTokens, 1900);
});

test('at most 2 physical calls per charged action, whatever fails', async () => {
  assert.equal(MAX_PHYSICAL_CALLS, 2);
  const T = (n) => { throw Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' }); };
  const scenarios = {
    'invalid, invalid, (no third)': { openai: async () => okOpenAI('nope'), anthropic: async () => okAnthropic(), extra: { fallbackRoute: HAIKU } },
    'invalid then retry fails': { openai: async (b, n) => { if (n === 1) return okOpenAI('nope'); throw new ApiError(500, null); }, anthropic: async () => okAnthropic(), extra: { fallbackRoute: HAIKU } },
    'primary fails, haiku fails': { openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => { throw new ApiError(529, null); }, extra: { fallbackRoute: HAIKU } },
    'primary fails, no fallback route': { openai: async () => { throw new ApiError(500, null); }, extra: {} },
    'primary times out': { openai: async () => T(), anthropic: async () => okAnthropic('nope'), extra: { fallbackRoute: HAIKU } },
    'no anthropic client, same-provider help': { openai: async () => { throw new ApiError(500, null); }, extra: { fallbackRoute: HAIKU } },
  };
  for (const [name, s] of Object.entries(scenarios)) {
    const h = harness({ openai: s.openai, anthropic: s.anthropic });
    await run(h, s.extra);
    assert.ok(physical(h) <= 2, `${name}: ${physical(h)} physical calls`);
    assert.ok(h.log.reserve.length <= 2, `${name}: ${h.log.reserve.length} reservations`);
  }
  // The cross-provider fallback for Repair is kept: one failed Luna call, one Haiku call.
  const h = harness({ openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => okAnthropic() });
  const out = await run(h, { fallbackRoute: HAIKU });
  assert.equal(out.ok, true); assert.equal(out.fallbackUsed, true); assert.equal(physical(h), 2);
});

test('the user id and plan reach every reservation; with no user nothing is sent', async () => {
  const h = harness({ openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => okAnthropic() });
  await run(h, { fallbackRoute: HAIKU, userId: 'usr_1', userTier: 'paid' });
  assert.equal(h.log.reserve.length, 2);
  for (const r of h.log.reserve) { assert.equal(r.userId, 'usr_1'); assert.equal(r.userTier, 'paid'); }
  const none = harness({ openai: async () => okOpenAI() });
  await run(none);
  assert.ok(!('userId' in none.log.reserve[0]) && !('userTier' in none.log.reserve[0]));
});

test("a student's own limit stops the action: no provider call, no fallback, no retry, the kind is user_budget", async () => {
  assert.equal(classifyGuardMessage('runtime user limit reached'), 'user_budget');
  assert.equal(classifyGuardMessage('runtime budget exhausted'), 'budget');
  const h = harness({
    openai: async () => okOpenAI(), anthropic: async () => okAnthropic(),
    reserve: () => { throw Object.assign(new Error('runtime_ai_funding_or_verified_prices_unavailable'), { kind: 'user_budget' }); },
  });
  const out = await run(h, { fallbackRoute: HAIKU, userId: 'usr_1', userTier: 'free' });
  assert.equal(out.ok, false);
  assert.equal(out.data, null);
  assert.equal(out.failure.kind, 'user_budget');
  assert.equal(physical(h), 0, 'nothing was called');
  assert.equal(h.log.reserve.length, 1, 'and nothing else was tried');
});

test('only GPT-6 Luna and Claude Haiku 5.5 can be called: any other model is refused before any reservation or call, and logged', async () => {
  assert.deepEqual(ALLOWED_MODELS, { openai: ['gpt-6-luna'], anthropic: ['claude-haiku-5-5'] });
  assert.equal(isAllowedModel('openai', 'gpt-6-luna'), true);
  assert.equal(isAllowedModel('anthropic', 'claude-haiku-5-5'), true);
  for (const [p, m] of [['openai', 'gpt-4.1-mini'], ['openai', 'gpt-4o-mini'], ['openai', 'gpt-4o'], ['anthropic', 'claude-sonnet-5-5'], ['anthropic', 'claude-haiku-4-5'], ['deepseek', 'deepseek-chat'], ['openai', 'claude-haiku-5-5'], ['anthropic', 'gpt-6-luna'], ['openai', undefined], ['toString', 'x'], ['__proto__', 'x']])
    assert.equal(isAllowedModel(p, m), false, `${p}/${m}`);
  for (const [provider, model] of [['openai', 'gpt-4.1-mini'], ['anthropic', 'claude-sonnet-5-5'], ['anthropic', 'claude-haiku-4-5'], ['deepseek', 'deepseek-chat']]) {
    const h = harness({ openai: async () => okOpenAI(), anthropic: async () => okAnthropic() });
    const out = await run(h, { provider, model, fallbackRoute: HAIKU, userId: 'u1', userTier: 'paid' });
    assert.equal(out.ok, false, `${provider}/${model}`);
    assert.equal(out.failure.kind, 'model_not_allowed');
    assert.equal(physical(h), 0, 'nothing was called');
    assert.equal(h.log.reserve.length, 0, 'nothing was reserved');
    assert.ok(h.log.lines.some((l) => l.includes('model_not_allowed') && l.includes(model)), 'one log line names the refused model');
  }
  // A refused fallback route does not rescue it, and a good primary is not changed by a bad fallback route.
  const bad = harness({ openai: async () => { throw new ApiError(429, 'insufficient_quota'); }, anthropic: async () => okAnthropic() });
  const out = await run(bad, { fallbackRoute: { provider: 'anthropic', model: 'claude-sonnet-5-5', reasoningEffort: 'low' } });
  assert.equal(out.ok, false);
  assert.equal(bad.log.anthropic.length, 0);
  assert.equal(bad.log.openai.length, 1);
  // Both allowed models still work.
  const both = harness({ openai: async () => okOpenAI(), anthropic: async () => okAnthropic() });
  assert.equal((await run(both)).ok, true);
  assert.equal((await run(both, { provider: 'anthropic', model: 'claude-haiku-5-5', requestKey: 'repair:abc:req_0123456789abcdef2' })).ok, true);
  assert.equal(both.log.openai.length, 1); assert.equal(both.log.anthropic.length, 1);
});

test('an environment override to another model is refused and nothing is called (AI_LUNA_MODEL, in a fresh process)', () => {
  const core = pathToFileURL(fileURLToPath(new URL('../../src/services/ai/providerCore.js', import.meta.url))).href;
  const script = `
    import { createProviderRuntime, LUNA_MODEL, pickModelForTier } from ${JSON.stringify(core)};
    const calls = { reserve: 0, client: 0 }; const lines = [];
    const client = { chat: { completions: { create: async () => { calls.client += 1; return { choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }; } } } };
    const rt = createProviderRuntime({ getClient: () => client, reserveRuntime: async () => { calls.reserve += 1; return { dispatch: true, inputRate: 0.1, outputRate: 0.5 }; }, receiptRuntime: async () => {}, log: (l) => lines.push(l) });
    const out = await rt.generateAIResponse({ requestKey: 'ask:abc:req_0123456789abcdef', tier: 'fast', systemPrompt: 's', userMessage: 'u' });
    console.log(JSON.stringify({ luna: LUNA_MODEL, picked: pickModelForTier('fast'), ok: out.ok, kind: out.failure?.kind, calls, logged: lines.length }));
  `;
  const run = (env) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, ...env }, encoding: 'utf8' }).trim().split('\n').pop());
  const refused = run({ AI_LUNA_MODEL: 'gpt-4.1-mini' });
  assert.equal(refused.luna, 'gpt-4.1-mini');
  assert.equal(refused.ok, false);
  assert.equal(refused.kind, 'model_not_allowed');
  assert.deepEqual(refused.calls, { reserve: 0, client: 0 });
  assert.ok(refused.logged >= 1);
  const fine = run({ AI_LUNA_MODEL: '' });
  assert.equal(fine.luna, 'gpt-6-luna'); assert.equal(fine.ok, true); assert.deepEqual(fine.calls, { reserve: 1, client: 1 });
});

test('no code path names another model for a call: the repair and moderation routes use the allowed pair, and the deepseek client is gone', () => {
  const repair = file('src/services/recovery/mistakeRepair.js');
  assert.match(repair, /provider: 'openai', model: process\.env\.AI_REPAIR_MODEL \|\| 'gpt-6-luna'/, 'an override is allowed to be set, and is refused at call time');
  assert.match(repair, /'claude-haiku-5-5'/);
  const providers = file('src/services/ai/providers.js');
  assert.ok(!/deepseek/i.test(providers), 'no deepseek client');
  for (const rel of ['src/app/api/ai/mentor/chat/route.js', 'src/app/api/ai/rival/start/route.js', 'src/app/api/ai/rival/submit/route.js', 'src/lib/moderation/ai.js', 'src/services/prepos/replyDeps.js', 'src/services/recovery/repairFlow.js'])
    assert.ok(!/gpt-4\.1|gpt-4o|claude-sonnet|claude-haiku-4/.test(file(rel)), rel);
});

// ---- What the student sees, and what the flows pass on ----------------------------------------------------------
const OCT = new Date('2026-10-17T06:00:00Z');

test('the limit message is honest, carries the reset date, and is not retried by the client', () => {
  assert.equal(userLimitMessage(OCT), 'You’ve reached this month’s AI limit. It resets on 1 November.');
  assert.equal(userLimitMessage(new Date('2026-12-31T20:00:00Z')), 'You’ve reached this month’s AI limit. It resets on 1 February.', 'IST month, not UTC: 1:30 am on 1 Jan IST is already January, so the reset is 1 February');
  const f = repairFailureForKind('user_budget', { now: OCT });
  assert.equal(f.error, 'user_limit_reached');
  assert.equal(f.http, 429);
  assert.equal(composeFailureMessage(f.message, true), 'You’ve reached this month’s AI limit. It resets on 1 November. You were not charged.');
  assert.equal(repairRetryPolicy(429, 'user_limit_reached', { charged: 0 }).canRetry, false);
  assert.equal(repairFailureForKind('model_not_allowed').error, 'provider_unavailable');
});

test('Ask Mobi: a refused reservation releases the credit and answers with the limit message and the reset date', async () => {
  const calls = [];
  const deps = {
    now: () => OCT.getTime(),
    reserve: async () => { calls.push('reserve'); return { ok: true, state: 'reserved', balance: 9 }; },
    markExecuting: async () => { calls.push('executing'); return { ok: true }; },
    generate: async () => { calls.push('generate'); return { ok: false, data: null, failure: { kind: 'user_budget' } }; },
    sanitize: (d) => d,
    commit: async () => { calls.push('commit'); return { ok: true }; },
    release: async (k, why) => { calls.push(`release:${why}`); return { ok: true }; },
  };
  const out = await runModelReply({ user: { id: 'usr_1' }, message: 'hi', requestId: 'req_0123456789abcdef', gateOpen: true, deps });
  assert.deepEqual(calls, ['reserve', 'executing', 'generate', 'release:user_limit_reached']);
  assert.equal(out.charged, 0);
  assert.equal(out.http, 429);
  assert.equal(out.error, 'user_limit_reached');
  assert.match(out.message, /^You’ve reached this month’s AI limit\. It resets on 1 November\./);
  assert.match(out.message, /No credits were used\.$/);
});

test('Mistake Repair: the explanation and the blind key check both carry the student id and plan, and a refusal releases the credit', async () => {
  const passage = 'Maya read the notice twice before she signed.';
  const snapshot = { id: 'q1', subject: 'english', chapter: 'Reading', question: 'Why did Maya read the notice twice?', passageText: passage, options: [{ key: 'A', text: 'It was long' }, { key: 'B', text: 'The clause was hard to see' }, { key: 'C', text: 'She disliked it' }, { key: 'D', text: 'She was late' }], correctIndex: 1 };
  const attempt = { id: 'a1', userId: 'u1', subject: 'english', questionsSnapshot: [snapshot], details: [{ qid: 'q1', isCorrect: false, givenIndex: 0 }] };
  const live = { id: 'q1', status: 'live', verification_state: 'verified', options: snapshot.options.map((o) => ({ ...o })), correct_answer: 'B', passage_text: passage };
  const disputed = { solved_index: 2, agrees_with_key: false, trap_type: 'other', trap: 't', why_wrong: 'w', why_right: 'r', contrast: 'c', others: [], rule: 'rule', memory_hook: 'h', another_way: 'a' };
  const make = (generate) => {
    const calls = [];
    const deps = {
      now: () => OCT.getTime(), loadAttempt: async () => attempt, loadQuestion: async () => ({ data: live, error: null }), evidenceEligible: () => false,
      findStored: async () => null, findOpenReservations: async () => [], gateOpen: () => true,
      reserve: async () => ({ ok: true, state: 'reserved', balance: 9 }), markExecuting: async () => ({ ok: true }),
      commit: async () => ({ ok: true }), release: async (k, why) => { calls.push(['release', why]); return { ok: true }; },
      generate: async (p) => { calls.push(['generate', p.requestKey, p.userId, p.userTier]); return generate(p, calls.filter((c) => c[0] === 'generate').length); },
      withhold: async () => {}, readWallet: async () => ({ total: 8, state: 'ok' }), log: () => {},
      spendUser: (u) => ({ userId: u.id, userTier: 'paid' }),
    };
    return { calls, run: () => runRepair({ user: { id: 'u1' }, attemptId: 'a1', questionId: 'q1', requestId: 'req_0123456789abcdef', startedAt: OCT.getTime(), deps, config: { route: { provider: 'openai', model: 'gpt-6-luna' }, effort: { repair: 'low', secondOpinion: 'high' }, fallbackRoute: null } }) };
  };
  const usage = { provider: 'openai', model: 'gpt-6-luna', inputTokens: 1, outputTokens: 1 };
  const h = make(async (p, n) => (n === 1 ? { ok: true, data: disputed, usage, failure: null } : { ok: true, data: { solved_index: 1 }, usage, failure: null }));
  await h.run();
  const gens = h.calls.filter((c) => c[0] === 'generate');
  assert.equal(gens.length, 2, 'the explanation, then the blind check');
  assert.ok(gens[1][1].endsWith(':blind'));
  for (const g of gens) { assert.equal(g[2], 'u1'); assert.equal(g[3], 'paid'); }
  // The student's own limit ends the repair, releases the credit and says so.
  const limited = make(async () => ({ ok: false, data: null, usage: null, fallbackUsed: false, failure: { stage: 'primary', provider: 'openai', model: 'gpt-6-luna', kind: 'user_budget', status: null, code: null } }));
  const { http, body } = await limited.run();
  assert.equal(http, 429);
  assert.equal(body.error, 'user_limit_reached');
  assert.equal(body.charged, 0);
  assert.equal(body.message, 'You’ve reached this month’s AI limit. It resets on 1 November. You were not charged.');
  assert.deepEqual(limited.calls.filter((c) => c[0] === 'release').map((c) => c[1]), ['user_limit_reached']);
  assert.equal(mistakeId('u1', 'a1', 'q1').length, 24);
});

// ---- The Ask Mobi context cap ---------------------------------------------------------------------------------
const big = (n) => 'x'.repeat(n);
test('Ask Mobi context: about 12 KB, least relevant parts dropped first, the parts that answer the question never touched', () => {
  assert.equal(MAX_CONTEXT_BYTES, 12288);
  const ctx = {
    exam: 'CUET', contextVersion: 1, planType: 'paid', isPaid: true, displayName: 'Asha',
    recordInsights: { n: 40, accuracy: 61, topChapters: [{ chapter: 'Goodwill', n: 12 }] },
    sharedPlan: { primary: { title: 'Revise Goodwill', reason: 'weakest chapter' }, alternatives: [{ t: big(4000) }], sequence: [{ t: big(4000) }], study: { t: big(4000) }, pathwayState: 'ok' },
    admissionCompassSummary: { topRecommendations: [{ college: big(2500) }] }, aiConfidence: { evidence: [big(2500)] },
    mistakeDNA: { dominantPattern: [{ key: 'k', score: 40 }], pad: big(1500) }, weaknessSummary: { weakChapters: [{ chapter: 'A', accuracy: 30 }] },
    targetCourses: [big(2000)], generatedAt: 1, selectedSubjects: ['a', 'b'],
  };
  const original = Buffer.byteLength(JSON.stringify(ctx));
  assert.ok(original > 20_000, `fixture is ${original} bytes`);
  const capped = capContextBytes(ctx);
  assert.ok(capped.bytes <= MAX_CONTEXT_BYTES, `${capped.bytes} bytes`);
  assert.equal(capped.bytes, Buffer.byteLength(JSON.stringify(capped.context)));
  assert.equal(capped.originalBytes, original);
  assert.equal(capped.fits, true);
  // Dropped in the documented order, and only as many as needed.
  assert.deepEqual(capped.dropped.slice(0, 3), ['generatedAt', 'targetCourses', 'admissionCompassSummary']);
  assert.ok(!capped.dropped.includes('weaknessSummary') && !capped.dropped.includes('mistakeDNA') || capped.bytes < MAX_CONTEXT_BYTES);
  // The protected parts survive whole.
  for (const key of ['exam', 'planType', 'isPaid', 'recordInsights']) assert.deepEqual(capped.context[key], ctx[key], key);
  assert.deepEqual(capped.context.sharedPlan.primary, ctx.sharedPlan.primary);
  // The input object was not changed.
  assert.equal(Buffer.byteLength(JSON.stringify(ctx)), original);
  // A context already under the cap is returned as is.
  const small = { exam: 'CUET', recordInsights: { n: 1 } };
  const same = capContextBytes(small);
  assert.equal(same.context, small); assert.deepEqual(same.dropped, []);
  // Protected parts alone over the cap: everything droppable goes, the rest is still sent whole and `fits` says so.
  const heavy = capContextBytes({ exam: 'CUET', questionContext: { text: big(20_000) }, mistakeDNA: { pad: big(100) } });
  assert.equal(heavy.fits, false); assert.deepEqual(heavy.dropped, ['mistakeDNA']); assert.equal(heavy.context.questionContext.text.length, 20_000);
});

test('the mentor chat route caps the context it sends, and the repair and mentor calls pass the student on', () => {
  assert.match(file('src/app/api/ai/mentor/chat/route.js'), /context: capContextBytes\(\{/);
  const deps = file('src/services/prepos/replyDeps.js');
  assert.match(deps, /requestKey, tier, \.\.\.spendUserFor\(user\)/);
  assert.match(file('src/services/recovery/mistakeRepair.js'), /spendUser: spendUserFor/);
  const flow = file('src/services/recovery/repairFlow.js');
  assert.equal((flow.match(/\.\.\.route, \.\.\.spend/g) || []).length, 2, 'the explanation and the blind key check');
  assert.match(flow, /tier: 'fast', \.\.\.route, \.\.\.spend,/);
});

test('account deletion unlinks the student from the AI cost rows instead of deleting the cost record', () => {
  const step = DELETION_STEPS.find((s) => s.table === 'runtime_ai_requests');
  assert.equal(step.action, 'anonymise');
  assert.deepEqual(step.set, [{ column: 'user_id', value: 'null' }]);
  assert.deepEqual(step.match, [{ column: 'user_id' }]);
});

test('both rival routes pass the student and plan on, so the intro and the outro count against the monthly cap', () => {
  for (const rel of ['src/app/api/ai/rival/start/route.js', 'src/app/api/ai/rival/submit/route.js']) {
    const src = file(rel);
    assert.match(src, /import \{ spendUserFor \} from '@\/services\/prepos\/replyDeps'/, rel);
    assert.match(src, /generateAIResponse\(\{[^}]*\.\.\.spendUserFor\(/s, rel);
  }
});
