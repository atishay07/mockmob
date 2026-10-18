// W-098 (17 Oct 2026): every student-facing model call counts against the student's monthly cap (Rs 5 paid, Rs 1 free),
// and the repo's cap seed is the owner's number. No network, no database, no paid model.
//
//  1. Coverage: every place in src that calls a model is either known to pass the student and plan, or is on a short list of
//     user-less callers that are not student-facing. A new caller fails here until it is declared.
//  2. The real runtimeGuard.reserveRuntime, with a fake PostgREST client that returns the exact shapes the database returns
//     (jsonb result as the data object; a RAISE EXCEPTION as { code: 'P0001', message, details: null, hint: null }).
//  3. The plan the cap uses comes from the stored user, not from the session.
//  4. The migration seeds the owner's caps and cannot restore Rs 10.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPaidUser } from '../../src/services/credits/aiWalletState.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|jsx|mjs|ts)$/.test(name)) out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');

// ---- 1. Coverage -----------------------------------------------------------------------------------------------
// Callers of the router. The rule is per call site: a student-facing caller passes the student and plan.
const STUDENT_CALLERS = {
  'src/app/api/ai/rival/start/route.js': /generateAIResponse\(\{[^}]*\.\.\.spendUserFor\(dbUser\)/s,
  'src/app/api/ai/rival/submit/route.js': /generateAIResponse\(\{[^}]*\.\.\.spendUserFor\(/s,
  // Ask Mobi (the mentor chat route reaches the model only through these deps), and Mistake Repair through its deps.
  'src/services/prepos/replyDeps.js': /requestKey, tier, \.\.\.spendUserFor\(user\)/,
  'src/services/recovery/mistakeRepair.js': /spendUser: spendUserFor/,
};
// Not student-facing: the content-moderation worker (its route answers 503 and spends nothing), and the router itself.
const USER_LESS_BY_DESIGN = new Set(['src/lib/moderation/ai.js', 'src/services/ai/providers.js', 'src/services/ai/providerCore.js']);

test('every call to the model router in src passes the student and plan, or is a declared user-less caller', () => {
  const callers = walk(join(ROOT, 'src')).filter((p) => /\bgenerateAIResponse\s*\(/.test(readFileSync(p, 'utf8')) || /from '@\/services\/ai\/providers'/.test(readFileSync(p, 'utf8')));
  const found = callers.map(rel).sort();
  const declared = [...Object.keys(STUDENT_CALLERS), ...USER_LESS_BY_DESIGN].sort();
  assert.deepEqual(found.filter((f) => !declared.includes(f)), [], 'a new model caller must pass ...spendUserFor(user) or be declared user-less here');
  for (const [file, pattern] of Object.entries(STUDENT_CALLERS)) assert.match(read(file), pattern, file);
  // Mistake Repair builds its calls in repairFlow with the same student and plan (two calls: explanation and blind check).
  const flow = read('src/services/recovery/repairFlow.js');
  assert.equal((flow.match(/\.\.\.route, \.\.\.spend/g) || []).length, 2);
  assert.match(read('src/services/recovery/mistakeRepair.js'), /spendUser: spendUserFor/);
});

test('no other file in src, data/*.js or scripts a student can reach talks to a provider SDK or a provider host', () => {
  const hits = walk(join(ROOT, 'src')).filter((p) => /from 'openai'|@anthropic-ai\/sdk|api\.openai\.com|api\.anthropic\.com|generativelanguage/.test(readFileSync(p, 'utf8'))).map(rel);
  assert.deepEqual(hits.sort(), ['src/services/ai/providers.js'], 'only the guarded router creates provider clients');
});

test('the routes that never reach a model (mentor local, history, report, session, actions, context, credits, usage) import no router', () => {
  for (const r of ['actions/execute', 'context', 'credits', 'credits/order', 'credits/verify', 'mentor/history', 'mentor/local', 'mentor/report', 'mentor/session/new', 'usage']) {
    const src = read(`src/app/api/ai/${r}/route.js`);
    assert.doesNotMatch(src, /services\/ai\/providers|generateAIResponse|buildReplyDeps|runModelReply|repairMistake/, r);
  }
  // The moderation worker route is paused: it answers 503 and the legacy body is unreachable.
  assert.match(read('src/app/api/internal/moderation/process/route.js'), /paused_persistent_evidence_pipeline_required/);
});

// ---- 2. The guard call, with the shapes PostgREST returns ---------------------------------------------------------
async function loadGuard(rpc) {
  const dir = mkdtempSync(join(tmpdir(), 'mm-guard-'));
  try {
    const providerCore = pathToFileURL(join(ROOT, 'src/services/ai/providerCore.js')).href;
    const source = read('src/services/ai/runtimeGuard.js')
      .replace("import 'server-only';", '')
      .replace("import { supabaseAdmin } from '@/lib/supabase';", 'const supabaseAdmin = () => globalThis.__fakeSupabase;')
      .replace("from './providerCore';", `from '${providerCore}';`);
    const file = join(dir, 'runtimeGuard.mjs');
    writeFileSync(file, source);
    globalThis.__fakeSupabase = { rpc: rpc };
    return await import(`${pathToFileURL(file).href}?t=${Math.random()}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const MESSAGES = [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hello' }];
const KEY = 'rival:intro:battle_0123456789';

test('reserveRuntime sends the student id and plan as strings; a user-less call sends neither', async () => {
  const calls = [];
  const guard = await loadGuard(async (name, args) => { calls.push({ name, args }); return { data: { dispatch: true, reserved: 0.0016, inputRate: 0.1, outputRate: 0.5 }, error: null }; });
  const ok = await guard.reserveRuntime({ requestKey: KEY, provider: 'openai', model: 'gpt-6-luna', messages: MESSAGES, maxTokens: 900, userId: 42, userTier: 'paid' });
  assert.equal(ok.dispatch, true, 'the jsonb result comes back as the data object');
  assert.equal(calls[0].name, 'reserve_runtime_ai');
  assert.equal(calls[0].args.p_user_id, '42');
  assert.equal(calls[0].args.p_user_tier, 'paid');
  await guard.reserveRuntime({ requestKey: `${KEY}_2`, provider: 'openai', model: 'gpt-6-luna', messages: MESSAGES, maxTokens: 900, userId: 'u1', userTier: 'whatever' });
  assert.equal(calls[1].args.p_user_tier, 'free', 'an unknown plan is the free cap');
  await guard.reserveRuntime({ requestKey: `${KEY}_3`, provider: 'openai', model: 'gpt-6-luna', messages: MESSAGES, maxTokens: 900 });
  assert.ok(!('p_user_id' in calls[2].args) && !('p_user_tier' in calls[2].args));
});

test('a RAISE EXCEPTION from the database, as PostgREST returns it, becomes the right kind; nothing reaches the provider', async () => {
  const pg = (message) => ({ data: null, error: { code: 'P0001', message, details: null, hint: null } });
  const expected = {
    'runtime user limit reached': 'user_budget',
    'runtime budget exhausted': 'budget',
    'runtime model not allowed': 'model_not_allowed',
    'runtime funding unavailable': 'guard_paused',
    'verified model price required': 'price',
  };
  for (const [message, kind] of Object.entries(expected)) {
    const guard = await loadGuard(async () => pg(message));
    await assert.rejects(
      guard.reserveRuntime({ requestKey: KEY, provider: 'openai', model: 'gpt-6-luna', messages: MESSAGES, maxTokens: 900, userId: 'u1', userTier: 'free' }),
      (err) => err.kind === kind && err.message === 'runtime_ai_funding_or_verified_prices_unavailable',
      message,
    );
  }
});

test('a call with no stable request key is refused before the database is asked (so a key-less caller never dispatches)', async () => {
  let asked = 0;
  const guard = await loadGuard(async () => { asked += 1; return { data: { dispatch: true }, error: null }; });
  for (const requestKey of [null, undefined, '', 'short']) {
    await assert.rejects(guard.reserveRuntime({ requestKey, provider: 'openai', model: 'gpt-6-luna', messages: MESSAGES, maxTokens: 900, userId: 'u1', userTier: 'paid' }), /stable_request_key_required/);
  }
  assert.equal(asked, 0);
});

// ---- 3. The plan comes from the stored user ---------------------------------------------------------------------
test('the plan is read from the stored user: a paid user is paid, an expired or session-shaped user is the free cap', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const future = new Date(now + 20 * 86400000).toISOString();
  const past = new Date(now - 2 * 86400000).toISOString();
  assert.equal(isPaidUser({ id: 'u', subscriptionStatus: 'active', premiumUntil: future, isPremium: true }, now), true);
  assert.equal(isPaidUser({ id: 'u', subscriptionStatus: 'active', premiumUntil: past, isPremium: true }, now), false);
  assert.equal(isPaidUser({ id: 'u', subscriptionStatus: 'free', premiumUntil: null, isPremium: false }, now), false);
  // The session object carries no plan fields, so it can only ever give the stricter (free) cap, never a higher one.
  assert.equal(isPaidUser({ id: 'u', email: 'a@b.c', name: 'A' }, now), false);
  assert.match(read('src/services/prepos/replyDeps.js'), /userTier: isPaidUser\(user\) \? 'paid' : 'free'/);
  // The rival routes look the student up first; the submit route falls back to the session (free cap) only if that read fails.
  assert.match(read('src/app/api/ai/rival/start/route.js'), /spendUserFor\(dbUser\)/);
  assert.match(read('src/app/api/ai/rival/submit/route.js'), /spendUserFor\(dbUser \|\| session\.user\)/);
});

// ---- 4. The migration agrees with the owner's decision and with production --------------------------------------
test('the migration seeds Rs 5 for a paid student and Rs 1 for a free one (USD 0.0568 and 0.0114), never Rs 10', () => {
  const sql = read('supabase/migrations/20261017120000_runtime_ai_user_cap.sql');
  const seed = sql.match(/insert into public\.runtime_ai_budget\(id, monthly_cap_usd\) values\s*\(([\s\S]*?)\)\s*on conflict/)[1];
  assert.match(seed, /'student_user_paid', 0\.0568/);
  assert.match(seed, /'student_user_free', 0\.0114/);
  assert.doesNotMatch(sql, /0\.1136\)|monthly_cap_usd 0\.1136/, 'the Rs 10 value is gone from every line that sets it');
  assert.match(sql, /on conflict \(id\) do nothing/, 'a re-apply never overwrites a cap row that was changed with an UPDATE');
  // Nothing else in the migration chain writes a different per-user value.
  for (const f of readdirSync(join(ROOT, 'supabase/migrations')).filter((n) => /\.sql$/.test(n))) {
    const text = read(`supabase/migrations/${f}`);
    // A later migration may READ the cap row (reserve_runtime_ai selects it); only an insert or update of it is a write.
    const writes = /(insert\s+into\s+public\.runtime_ai_budget[^;]*student_user_paid|update\s+public\.runtime_ai_budget[^;]*student_user_paid)/i;
    if (writes.test(text) && f !== '20261017120000_runtime_ai_user_cap.sql') assert.fail(`${f} writes student_user_paid`);
  }
});
