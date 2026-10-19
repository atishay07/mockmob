// The first full mock in each subject is free (CTO decision, 19 Oct 2026; data/first_full_mock.js holds the rule).
//
// What runs here: the pure rule, the charge and the quote (unit); then the REAL routes, GET /api/practice/quote and
// POST /api/sessions (src/lib/server/practiceSessions.js startPractice, data/db.js Database), over an in-process Postgres
// (PGlite) built from the repo's migrations in production's order, so spend_credits, start_learning_session and
// learning_allowances (its primary key is the lock) are production's exact bodies (release 10, one credits balance).
// Only the edges are stand-ins: the Supabase client (a thin translation of the query shapes these routes use onto PGlite),
// sign-in, the rate limit, the inventory count and the question bank. No network, no paid model, no production write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import {
  FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_REASON, FIRST_FULL_MOCK_STATE, FULL_PAPER_MODES,
  firstFullMockApplies, firstFullMockIsFree, firstFullMockKind, firstFullMockState, fullSampleKind,
} from '../first_full_mock.js';
import { practiceCharge } from '../practice_charge.js';
import { buildPracticeQuote } from '../practice_quote.js';
import { allowancePeriod } from '../learning_engine.js';
import { practiceId } from '../practice_ticket.js';
import { walletWindow } from '../../src/services/credits/aiWalletState.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const S = FIRST_FULL_MOCK_STATE;

// ---------------------------------------------------------------------------------------------------------------------
// The rule (pure)
// ---------------------------------------------------------------------------------------------------------------------
test('the rule: Free, Full mock, not a Mob paper; one row per subject, kept for ever; the words are the agreed ones', () => {
  assert.equal(firstFullMockApplies({ isPremium: false, modeId: 'full' }), true);
  assert.equal(firstFullMockApplies({ isPremium: true, modeId: 'full' }), false, 'Pro pays nothing already');
  assert.equal(firstFullMockApplies({ isPremium: false, modeId: 'full', mobPaper: { mobId: 'm' } }), false, 'a Mob paper is free already');
  for (const mode of ['quick', 'smart', 'nta']) assert.equal(firstFullMockApplies({ isPremium: false, modeId: mode }), false, mode);
  assert.deepEqual([...FULL_PAPER_MODES].sort(), ['full', 'nta'], 'a saved Full mock or NTA paper is a full paper (MOCK_MODES)');
  assert.equal(firstFullMockKind('english'), 'first_full_mock:english');
  assert.equal(firstFullMockKind('gat'), 'first_full_mock:gat');
  for (const bad of ['', 'English', 'a b', 'x;drop', null, undefined, 42]) assert.equal(firstFullMockKind(bad), null, String(bad));
  assert.equal(fullSampleKind('english'), 'full_sample:english');
  assert.equal(allowancePeriod('first_full_mock:english', Date.parse('2026-10-19T00:00:00Z')), 'ever', 'once per subject, ever');
  assert.equal(allowancePeriod('first_full_mock:english', Date.parse('2027-06-01T00:00:00Z')), 'ever');
  assert.equal(FIRST_FULL_MOCK_REASON, 'first_full_mock_free');
  assert.equal(FIRST_FULL_MOCK_COPY.price, 'Free: your first full mock in this subject is on us.');
  assert.equal(FIRST_FULL_MOCK_COPY.plan, 'Your first full mock in every subject is free.');
  assert.equal(FIRST_FULL_MOCK_COPY.short, 'Free');
  assert.equal(FIRST_FULL_MOCK_COPY.reason, 'No credits are charged for this one. Your next full mock in this subject costs 50 credits.');
});

test('the state: the free row decides first (mine on its own replay), then a full sample, then saved full papers; unknown is never free', () => {
  assert.equal(firstFullMockState({ fullPapers: 0, claim: null }), S.available);
  assert.equal(firstFullMockState({ fullPapers: 2, claim: null }), S.used, 'a saved Full mock or NTA paper in the subject');
  assert.equal(firstFullMockState({ fullPapers: 0, claim: { reference: 'att_1' } }), S.used, 'the quote has no session: held means used');
  assert.equal(firstFullMockState({ fullPapers: 0, claim: { reference: 'att_1' } }, { sessionId: 'att_1' }), S.mine, 'its own replay');
  assert.equal(firstFullMockState({ fullPapers: 1, claim: { reference: 'att_1' } }, { sessionId: 'att_1' }), S.mine, 'even after a paper was saved');
  assert.equal(firstFullMockState({ fullPapers: 0, claim: { reference: 'att_1' } }, { sessionId: 'att_2' }), S.used, 'another start');
  assert.equal(firstFullMockState({ fullPapers: 0, claim: null, sample: true }), S.used, 'the full sample was the free full mock');
  assert.equal(firstFullMockState({ fullPapers: null, claim: null }), S.unknown, 'the papers could not be read');
  assert.equal(firstFullMockState({ fullPapers: 0, claim: undefined }), S.unknown, 'the free row could not be read');
  assert.equal(firstFullMockState(null), S.unknown);
  assert.equal(firstFullMockIsFree(S.available), true);
  assert.equal(firstFullMockIsFree(S.mine), true);
  for (const s of [S.used, S.unknown, null, undefined, 'free']) assert.equal(firstFullMockIsFree(s), false, String(s));
});

test('practiceCharge: available takes the free row and keeps attempt_full only as the fallback; mine charges nothing; used, unknown, Pro and Mob as before', () => {
  const full = (over = {}) => practiceCharge({ isPremium: false, modeId: 'full', creditAction: 'attempt_full', count: 50, subject: 'english', ...over });
  assert.deepEqual(full({ firstFullMock: S.available }), { creditAction: 'attempt_full', quota: 'first_full_mock:english', firstFullMock: true });
  assert.deepEqual(full({ firstFullMock: S.mine }), { creditAction: null, quota: null, firstFullMock: true });
  assert.deepEqual(full({ firstFullMock: S.used }), { creditAction: 'attempt_full', quota: null }, 'charged exactly as today');
  assert.deepEqual(full({ firstFullMock: S.unknown }), { creditAction: 'attempt_full', quota: null });
  assert.deepEqual(full({}), { creditAction: 'attempt_full', quota: null }, 'a caller that read nothing is charged as before');
  assert.deepEqual(full({ isPremium: true, firstFullMock: S.available }), { creditAction: null, quota: null }, 'Pro unchanged');
  assert.deepEqual(full({ mobPaper: { mobId: 'm' }, firstFullMock: S.available }), { creditAction: null, quota: null }, 'Mob unchanged');
  // Quick practice never reads the rule: the per-question prices and today's included set are exactly as before.
  assert.deepEqual(practiceCharge({ modeId: 'quick', creditAction: 'attempt_10', count: 10, subject: 'english', firstFullMock: S.available }), { creditAction: 'attempt_10', quota: 'daily_practice' });
  assert.deepEqual(practiceCharge({ modeId: 'quick', creditAction: 'attempt_15', count: 15, subject: 'english', firstFullMock: S.available }), { creditAction: 'attempt_15', quota: null });
  // The full sample (durable sessions only) is the same one free full mock: while the rule's row is free it takes that row;
  // once the free full mock is used, a full-sample start is charged; unknown leaves the sample exactly as before.
  assert.deepEqual(full({ purpose: 'full_sample', firstFullMock: S.available }), { creditAction: 'attempt_full', quota: 'first_full_mock:english', firstFullMock: true });
  assert.deepEqual(full({ purpose: 'full_sample', firstFullMock: S.used }), { creditAction: 'attempt_full', quota: null });
  assert.deepEqual(full({ purpose: 'full_sample', firstFullMock: S.unknown }), { creditAction: 'attempt_full', quota: 'full_sample:english' });
});

// ---- the quote (pure) ---------------------------------------------------------------------------------------------
const inventory = { state: 'available', checkedAt: '2026-10-19T00:00:00Z', subjectCounts: { english: 900, accountancy: 900, economics: 900, gat: 900 } };
const freeUser = (creditBalance = 40) => ({ id: 'u1', isPremium: false, premiumUntil: null, creditBalance });
const proUser = { id: 'u2', isPremium: true, premiumUntil: '2027-07-31T18:29:59.000Z', creditBalance: 0 };
const quote = (over = {}) => buildPracticeQuote({ user: freeUser(), subject: 'english', mode: 'full', count: 50, inventory, token: 'tok-1234567890ab', now: 0, ...over });

test('the quote: a qualifying Full mock is 0 with freeReason, the allowance old app builds read, and a reason that is not the price line', () => {
  const q = quote({ firstFullMock: S.available });
  assert.equal(q.launchable, true, '40 credits is enough: the free one needs none');
  assert.equal(q.creditCost, 0);
  assert.equal(q.freeReason, 'first_full_mock_free');
  assert.equal(q.firstFullMock, 'available');
  assert.deepEqual(q.allowance, { kind: 'first_full_mock:english', state: 'available' });
  assert.equal(q.reason, FIRST_FULL_MOCK_COPY.reason);
  assert.notEqual(q.reason, FIRST_FULL_MOCK_COPY.price, 'the web card shows the price line in Cost; the reason under it says what follows');
  assert.equal(q.idempotencyToken, 'tok-1234567890ab');
  const gat = quote({ subject: 'general_test', firstFullMock: S.available });
  assert.equal(gat.allowance.kind, 'first_full_mock:gat', 'the stored id, the same one the start writes');
});

test('the quote: used and unknown are priced 50 exactly as today (blocked below 50), Pro has no rule fields, every Free quote carries the state', () => {
  for (const state of [S.used, S.unknown, null]) {
    const q = quote({ firstFullMock: state });
    assert.equal(q.creditCost, 50, String(state));
    assert.equal(q.launchable, false);
    assert.equal(q.reasonCode, 'insufficient_credits');
    assert.equal(q.reason, 'Full mock costs 50 credits and you have 40.');
    assert.equal(q.freeReason, undefined);
    assert.equal(q.allowance, null);
    const rich = quote({ firstFullMock: state, user: freeUser(120) });
    assert.equal(rich.launchable, true);
    assert.equal(rich.creditCost, 50);
    assert.equal(rich.reason, 'You are charged only after a complete set is built.');
  }
  assert.equal(quote({ firstFullMock: S.used }).firstFullMock, 'used');
  assert.equal(quote({ firstFullMock: S.unknown }).firstFullMock, 'unknown');
  assert.equal('firstFullMock' in quote({ firstFullMock: null }), false);
  assert.equal(quote({ firstFullMock: 'mine' }).creditCost, 50, "'mine' belongs to a start; a quote never takes it");
  const pro = quote({ user: proUser, firstFullMock: S.available });
  assert.equal(pro.creditCost, 0);
  assert.equal(pro.firstFullMock, undefined);
  assert.equal(pro.freeReason, undefined);
  assert.equal(pro.allowance, null);
  // A Quick set and a locked NTA quote still say whether the Full mock in this subject is free (the Practice tile reads it).
  const quick = quote({ mode: 'quick', count: 15, firstFullMock: S.available });
  assert.equal(quick.creditCost, 15, 'Quick prices never change');
  assert.equal(quick.firstFullMock, 'available');
  assert.equal(quick.freeReason, undefined);
  const nta = quote({ mode: 'nta', firstFullMock: S.available });
  assert.equal(nta.reasonCode, 'access_required');
  assert.equal(nta.firstFullMock, 'available');
  // The durable-only full sample, once the free full mock is used, is not a second free one.
  const sample = quote({ purpose: 'full_sample', firstFullMock: S.used, allowance: { enabled: true, used: false }, user: freeUser(120) });
  assert.equal(sample.creditCost, 50);
  assert.equal(sample.allowance, null);
  const sampleUnknown = quote({ purpose: 'full_sample', firstFullMock: S.unknown, allowance: { enabled: true, used: false } });
  assert.deepEqual(sampleUnknown.allowance, { kind: 'full_sample:english', state: 'available' }, 'unknown leaves the sample as before');
});

// The Android app (wt-v15-2/flutter_app at ab04b067, 1.0.15+7) reads the quote in lib/core/models/practice_quote.dart and
// decides the price in lib/features/practice/data/launch_flow.dart and model/practice_selection.dart. This is that logic,
// line for line, run on the quote this server sends: an old build sees 0 and starts with no purpose, and the server makes
// that start free.
const app = {
  freeByAllowance: (q) => Boolean(q.allowance && typeof q.allowance === 'object' && (q.allowance.state ?? 'unknown') === 'available'),
  effectiveCreditCost: (q) => (app.freeByAllowance(q) ? 0 : (Number.isInteger(q.creditCost) ? q.creditCost : 0)),
  quoteSpendsCredits: (q) => !app.freeByAllowance(q) && (Number.isInteger(q.creditCost) ? q.creditCost : 0) > 0,
  launchPurposeFor: (q) => {
    if (!app.freeByAllowance(q)) return null;
    const kind = q.allowance.kind ?? '';
    if (kind.startsWith('baseline:')) return 'baseline';
    if (kind.startsWith('full_sample:')) return 'full_sample';
    return null;
  },
};
test('the old app builds read 0: free by allowance, no credit wait, no purpose; a used one reads 50', () => {
  const q = JSON.parse(JSON.stringify(quote({ firstFullMock: S.available })));
  assert.equal(app.freeByAllowance(q), true);
  assert.equal(app.effectiveCreditCost(q), 0);
  assert.equal(app.quoteSpendsCredits(q), false);
  assert.equal(app.launchPurposeFor(q), null, 'the start the app sends is an ordinary Full mock, which the server makes free');
  const used = JSON.parse(JSON.stringify(quote({ firstFullMock: S.used, user: freeUser(120) })));
  assert.equal(app.effectiveCreditCost(used), 50);
  assert.equal(app.quoteSpendsCredits(used), true);
  const appModel = readFileSync(path.join(ROOT, '..', 'wt-v15-2', 'flutter_app', 'lib', 'core', 'models', 'practice_quote.dart'), 'utf8');
  assert.match(appModel, /creditCost: asInt\(j\['creditCost'\]\)/);
  assert.match(appModel, /bool get freeByAllowance => allowance != null && allowance!\.isAvailable;/);
});

// ---------------------------------------------------------------------------------------------------------------------
// The real routes over PGlite
// ---------------------------------------------------------------------------------------------------------------------
const MIGRATION = file('supabase/migrations/20261018210000_one_credits_balance.sql');
const UNDO = file('supabase/undo/20261018210000_one_credits_balance.undo.sql');
const CHAIN = [
  'supabase/migrations/0036_mode_aware_credits.sql',
  'supabase/migrations/20261001105920_score_recovery_foundations.sql',
  'supabase/migrations/20261002120000_connected_learning.sql',
  'supabase/migrations/20261002123000_answer_correction_history.sql',
  'db/migrations/2026_05_02_ai_overlay_credits_fix.sql',
  'supabase/migrations/20261002121000_runtime_ai_guard.sql',
  'supabase/migrations/20261002130000_prepos_credit_reservations.sql',
  'supabase/migrations/20261004120000_runtime_ai_monthly_cap.sql',
  'supabase/migrations/20261005090000_runtime_ai_price_gpt6_luna.sql',
  'supabase/migrations/20261014120000_runtime_ai_price_claude_haiku_5_5.sql',
  'supabase/migrations/20261017120000_runtime_ai_user_cap.sql',
  'supabase/migrations/20261018130000_free_ai_wallet_50.sql',
  'supabase/migrations/20261018170000_practice_credit_per_question.sql',
];
// Read-only from production (isrxrxzjocewrdureyhp, pg_proc, 19 Oct 2026): spend_credits knows attempt_full (50).
const PROD_SPEND_MD5 = 'a2d71600fffe756b05443f4f4ca72967';

async function database() {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table users(id text primary key,credit_balance int);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz);
    create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
    create table question_interactions(user_id text,question_id text);
    create table question_bookmarks(user_id text,question_id text);`);
  for (const rel of CHAIN) await d.exec(file(rel));
  await d.exec(UNDO);
  await d.exec(MIGRATION);
  // The columns the real Database reads on these two tables (production has them).
  await d.exec(`alter table users add column if not exists name text, add column if not exists email text, add column if not exists image text,
      add column if not exists subjects text[], add column if not exists role text, add column if not exists subscription_status text,
      add column if not exists is_premium boolean default false, add column if not exists premium_until timestamptz,
      add column if not exists razorpay_subscription_id text, add column if not exists created_at timestamptz default now();
    alter table attempts add column if not exists selection_meta jsonb, add column if not exists completed_at timestamptz default now();`);
  return d;
}
const rows = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const one = async (d, sql, params) => (await rows(d, sql, params))[0];
const W = walletWindow(new Date());

/** A student. `free` is this month's free credits left (0 by default, so the balance is the whole spendable total). */
async function student(d, id, { balance = 40, free = 0, premium = false } = {}) {
  await rows(d, 'insert into users(id,credit_balance,subjects,is_premium,premium_until,subscription_status) values($1,$2,$3,$4,$5,$6)',
    [id, balance, ['english', 'accountancy'], premium, premium ? '2027-07-31T18:29:59Z' : null, premium ? 'active' : null]);
  await rows(d, 'insert into ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values($1,50,$2,0,$3,$4)',
    [id, 50 - free, W.periodStart, W.resetAt]);
}
const balanceOf = async (d, id) => (await one(d, 'select credit_balance b from users where id=$1', [id])).b;
const spends = (d, id) => rows(d, "select reference, action, credit_delta, parts from credit_transactions where user_id=$1 and type='spend' order by reference", [id]);
const claims = (d, id) => rows(d, 'select kind, period, reference from learning_allowances where user_id=$1 order by kind', [id]);
const savePaper = (d, id, user, subject, mode) => rows(d, 'insert into attempts(id,user_id,subject,total,selection_meta) values($1,$2,$3,50,$4)', [id, user, subject, { mode }]);

// ---- the stand-in Supabase client: the query shapes these routes use, translated onto PGlite ----------------------------
function pgClient(pg, hooks = {}) {
  const column = (name) => {
    const json = /^(\w+)->>(\w+)$/.exec(name);
    if (json) return `"${json[1]}"->>'${json[2]}'`;
    if (!/^\w+$/.test(name)) throw new Error(`stand-in client: unsupported column ${name}`);
    return `"${name}"`;
  };
  const from = (table) => {
    const where = [];
    const params = [];
    let op = 'select'; let columns = '*'; let options = {}; let row = null; let single = false;
    const query = {
      select(cols = '*', opts = {}) { columns = cols; options = opts || {}; return query; },
      eq(name, value) { params.push(value); where.push(`${column(name)} = $${params.length}`); return query; },
      in(name, list) { params.push(list); where.push(`${column(name)} = any($${params.length})`); return query; },
      insert(value) { op = 'insert'; row = value; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    async function run() {
      try {
        const fail = hooks.fail?.({ table, op, columns, where });
        if (fail) return { data: null, error: fail };
        if (op === 'insert') {
          await hooks.beforeInsert?.(table, row);
          const keys = Object.keys(row);
          await pg.query(`insert into public.${table}(${keys.map(column).join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map((k) => row[k]));
          return { data: null, error: null };
        }
        const filter = where.length ? ` where ${where.join(' and ')}` : '';
        if (options.head && options.count) {
          const { rows: [r] } = await pg.query(`select count(*)::int n from public.${table}${filter}`, params);
          return { data: null, count: r.n, error: null };
        }
        const list = columns === '*' ? '*' : columns.split(',').map((c) => column(c.trim())).join(',');
        const { rows: found } = await pg.query(`select ${list} from public.${table}${filter}`, params);
        hooks.afterRead?.(table);
        return { data: single ? (found[0] ?? null) : found, error: null };
      } catch (error) {
        return { data: null, error: { code: error.code, message: error.message } };
      }
    }
    return query;
  };
  const rpc = async (name, args = {}) => {
    try {
      await hooks.beforeRpc?.(name, args);
      const keys = Object.keys(args);
      const values = keys.map((k) => (args[k] && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
      const { rows: [r] } = await pg.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values);
      return { data: r.r, error: null };
    } catch (error) {
      return { data: null, error: { code: error.code, message: error.message } };
    }
  };
  return { from, rpc };
}

// ---- the routes, with only the edges stood in ---------------------------------------------------------------------
const STUBS = {
  'src/lib/supabase.js': 'export const supabaseAdmin = () => globalThis.__ffm.client;',
  'src/lib/auth.ts': 'export async function auth() { return globalThis.__ffm.session; }',
  'src/lib/server/rateLimit.js': 'export async function checkPersistentRateLimit() { return { allowed: true }; }',
  'src/lib/server/inventory.js': 'export async function publicInventory() { return globalThis.__ffm.inventory; }',
  // The real file says exactly this (pinned below); the stand-in only avoids loading the recovery pathway machinery.
  'src/lib/server/learning.js': "export const durableLearningEnabled = () => process.env.LEARNING_SESSIONS_ENABLED === 'true'; export async function episodeCheckQuestion() { return null; }",
  'src/lib/server/recoverySessions.js': "export async function startSession() { throw new Error('NOT_IN_THIS_TEST'); } export async function finishSession() { throw new Error('NOT_IN_THIS_TEST'); } export async function recordEvents() { return { ok: true }; }",
  'src/lib/server/mobileCors.js': 'export const mobileOptions = () => ({});',
  'src/lib/server/funnelOnceStore.js': 'export const countStepOnce = () => {};',
  'src/lib/server/funnelOnce.js': 'export const funnelStepsForSession = () => [];',
  'src/lib/server/badgesStore.js': 'export const forgetBadges = () => {};',
};
const EXTENSIONS = ['', '.js', '.mjs', '.jsx', '.ts', '/index.js'];
const probe = (base) => {
  for (const ext of EXTENSIONS) { const f = base + ext; if (existsSync(f) && statSync(f).isFile()) return f; }
  return null;
};
const ours = (url) => typeof url === 'string' && url.startsWith(pathToFileURL(ROOT).href) && !url.includes('/node_modules/');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    let found = null;
    if (specifier.startsWith('@/')) found = probe(path.join(ROOT, 'src', specifier.slice(2)));
    else if (/^\.\.?\//.test(specifier) && ours(context.parentURL)) found = probe(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (found) {
      const rel = path.relative(ROOT, found).split(path.sep).join('/');
      if (Object.hasOwn(STUBS, rel)) return { url: `data:text/javascript,${encodeURIComponent(STUBS[rel])}`, shortCircuit: true };
      return { url: pathToFileURL(found).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

process.env.PRACTICE_SESSION_SECRET = 'first-full-mock-test-secret-0123456789abcdef';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-service-role-key';
process.env.PERSISTENT_LIMITS_ENABLED = 'false';
delete process.env.LEARNING_SESSIONS_ENABLED;
globalThis.__ffm = { client: null, session: null, inventory };

const { Database } = await import(pathToFileURL(path.join(ROOT, 'data', 'db.js')).href);
const quoteRoute = await import(pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'practice', 'quote', 'route.js')).href);
const sessionsRoute = await import(pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'sessions', 'route.js')).href);
const { resetOneBalanceProbe } = await import(pathToFileURL(path.join(ROOT, 'src', 'services', 'credits', 'aiWalletState.js')).href);

// The question bank stands in: a complete, well-formed set of any size, so the start reaches the charge.
Database.getQuestions = async (subject, count, opts = {}) => ({
  questions: Array.from({ length: count }, (_, i) => ({ id: `${subject}_q${i + 1}`, subject, chapter: 'Chapter 1', question: `Question ${i + 1}`,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key}` })), correct_answer: 'B', correctIndex: 1 })),
  meta: { mode: opts.mode, requestedCount: count, finalCount: count, selectedCount: count, selectionStrategy: 'test_bank' },
});

async function routes(hooks = {}) {
  const d = await database();
  globalThis.__ffm.client = pgClient(d, hooks);
  resetOneBalanceProbe();
  return d;
}
const as = (userId) => { globalThis.__ffm.session = userId ? { user: { id: userId } } : null; };
async function getQuote(userId, { subject = 'english', mode = 'full', count = 50, purpose = null } = {}) {
  as(userId);
  const params = new URLSearchParams({ subject, mode, count: String(count), ...(purpose ? { purpose } : {}) });
  const res = await quoteRoute.GET(new Request(`http://localhost/api/practice/quote?${params}`));
  return { status: res.status, body: await res.json() };
}
async function start(userId, { key, subject = 'english', mode = 'full', count = 50, purpose = null, firstFree = false } = {}) {
  as(userId);
  // firstFree: the start Practice sends when its quote said this full mock is free (release 11 verifier L1).
  const body = { generationKey: key, subject, mode, count: String(count), experience: 'practice', ...(purpose ? { purpose } : {}), ...(firstFree ? { firstFree: '1' } : {}) };
  const res = await sessionsRoute.POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}
const key = (name) => `key_${name}_0123456789`;

test('the test database runs production\'s exact spend_credits (release 10, one balance), and this change adds no migration', async () => {
  const d = await database();
  try {
    const r = await one(d, "select md5(prosrc) m from pg_proc where proname='spend_credits'");
    assert.equal(r.m, PROD_SPEND_MD5);
    const learning = file('src/lib/server/learning.js');
    assert.match(learning, /export const durableLearningEnabled = \(\) => process\.env\.LEARNING_SESSIONS_ENABLED === 'true';/, 'the stand-in matches the real flag');
    // Mob v3 (20261020100000_mob_v3_core.sql) names 'first_full_mock' only as a Fold's earn source (Naav), not a mock rule.
    const migrations = readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter((f) => !/_mob_v3_/.test(f))
      .filter((f) => /first_full_mock|first_mock/.test(f) || /first_full_mock/.test(file(`supabase/migrations/${f}`)));
    assert.deepEqual(migrations, [], 'no migration: learning_allowances and attempts already exist on production');
    // The start path asks spend_credits only for actions production knows; the free start asks it nothing.
    assert.match(file('data/db.js'), /\['generate', 'attempt', \.\.\.PER_QUESTION_ACTIONS, 'attempt_full'\]\.includes\(action\)/);
  } finally { await d.close(); }
});

test('device-held start (production today): the first full mock is free, its replay is the same free paper, the next is 50, and the quote said so each time', async () => {
  const d = await routes();
  try {
    await student(d, 'stu', { balance: 40 });
    let q = await getQuote('stu');
    assert.equal(q.status, 200);
    assert.equal(q.body.creditCost, 0);
    assert.equal(q.body.launchable, true, 'free with 40 credits, which could never buy a 50-credit mock');
    assert.equal(q.body.freeReason, 'first_full_mock_free');
    assert.equal(q.body.firstFullMock, 'available');
    assert.deepEqual(q.body.allowance, { kind: 'first_full_mock:english', state: 'available' });

    const first = await start('stu', { key: key('e1') });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.meta.storage, 'device');
    const sessionId = first.body.meta.sessionId;
    assert.equal(await balanceOf(d, 'stu'), 40, 'the quote said 0 and the start charged 0');
    assert.deepEqual(await spends(d, 'stu'), []);
    assert.deepEqual(await claims(d, 'stu'), [{ kind: 'first_full_mock:english', period: 'ever', reference: sessionId }]);

    const replay = await start('stu', { key: key('e1') });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.meta.sessionId, sessionId, 'the same paper');
    assert.equal(await balanceOf(d, 'stu'), 40, 'a replay never charges');
    assert.equal((await claims(d, 'stu')).length, 1, 'and never takes a second free one');

    q = await getQuote('stu');
    assert.equal(q.body.firstFullMock, 'used');
    assert.equal(q.body.creditCost, 50);
    assert.equal(q.body.reasonCode, 'insufficient_credits');
    const second = await start('stu', { key: key('e2') });
    assert.equal(second.status, 402, 'the next full mock in English is charged, and 40 credits cannot pay 50');
    assert.equal(second.body.error, 'INSUFFICIENT_CREDITS');
    assert.equal(await balanceOf(d, 'stu'), 40);

    await rows(d, "update users set credit_balance=100 where id='stu'");
    q = await getQuote('stu');
    assert.equal(q.body.creditCost, 50);
    assert.equal(q.body.launchable, true);
    const paid = await start('stu', { key: key('e3') });
    assert.equal(paid.status, 200);
    assert.equal(await balanceOf(d, 'stu'), 50, 'charged exactly 50, as the quote said');
    const [spend] = await spends(d, 'stu');
    assert.deepEqual(spend, { reference: `practice_${paid.body.meta.sessionId}`, action: 'attempt_full', credit_delta: -50, parts: { included: 0, bonus: 0, balance: 50 } });

    q = await getQuote('stu', { subject: 'accountancy' });
    assert.equal(q.body.creditCost, 0, 'another subject is still free');
    const other = await start('stu', { key: key('a1'), subject: 'accountancy' });
    assert.equal(other.status, 200);
    assert.equal(await balanceOf(d, 'stu'), 50);
    assert.deepEqual((await claims(d, 'stu')).map((c) => c.kind), ['first_full_mock:accountancy', 'first_full_mock:english']);
  } finally { await d.close(); }
});

test('an abandoned free start counts as used: never finished, the next full mock in that subject is still 50', async () => {
  const d = await routes();
  try {
    await student(d, 'quitter', { balance: 100 });
    const free = await start('quitter', { key: key('q1') });
    assert.equal(free.status, 200);
    assert.equal(await balanceOf(d, 'quitter'), 100);
    // Walked away: no paper is saved, the row stays.
    assert.equal((await one(d, "select count(*)::int n from attempts where user_id='quitter'")).n, 0);
    for (const k of ['q2', 'q3']) {
      assert.equal((await getQuote('quitter')).body.creditCost, 50);
      assert.equal((await start('quitter', { key: key(k) })).status, 200);
    }
    assert.equal(await balanceOf(d, 'quitter'), 0, 'two more full mocks, 50 each: abandoning never earns another free one');
  } finally { await d.close(); }
});

test('two starts of the same subject\'s first mock at the same moment: exactly one is free, the other is refused and not charged', async () => {
  // Both starts read the facts before either writes the row (a gate holds the writes until both reads are in), so this is the
  // real race; learning_allowances' primary key lets one write win. The other start's own read said free, so it is refused with
  // FIRST_FULL_MOCK_TAKEN and charged nothing (release 11 verifier L1: never 50 without a warning); its student re-quotes.
  let reads = 0; let release; const bothRead = new Promise((r) => { release = r; });
  const d = await routes({
    afterRead: (table) => { if (table === 'learning_allowances' && ++reads === 2) release(); },
    beforeInsert: async (table) => { if (table === 'learning_allowances') await Promise.race([bothRead, new Promise((r) => setTimeout(r, 5000))]); },
  });
  try {
    await student(d, 'twin', { balance: 100 });
    const [a, b] = await Promise.all([start('twin', { key: key('t1') }), start('twin', { key: key('t2') })]);
    assert.equal(reads >= 2, true, 'both starts read the rule before either wrote');
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const [won, lost] = a.status === 200 ? [a, b] : [b, a];
    assert.equal(lost.body.error, 'FIRST_FULL_MOCK_TAKEN');
    assert.match(lost.body.message, /already started on another device or tab, so this one is not free\. It did not start, and nothing was charged\./);
    assert.equal((await claims(d, 'twin')).length, 1, 'one free row');
    assert.equal((await claims(d, 'twin'))[0].reference, won.body.meta.sessionId);
    assert.deepEqual(await spends(d, 'twin'), [], 'no charge at all');
    assert.equal(await balanceOf(d, 'twin'), 100);
    // The refused student's new quote says the price, and a start from it (no longer quoted free) is charged what it said.
    const q = await getQuote('twin');
    assert.equal(q.body.creditCost, 50);
    assert.equal(q.body.freeReason, undefined);
    assert.equal((await start('twin', { key: key('t3') })).status, 200);
    assert.equal(await balanceOf(d, 'twin'), 50);
  } finally { await d.close(); }
});

test('the same race with too few credits: one start is free, the other is refused, and nothing is charged', async () => {
  let reads = 0; let release; const bothRead = new Promise((r) => { release = r; });
  const d = await routes({
    afterRead: (table) => { if (table === 'learning_allowances' && ++reads === 2) release(); },
    beforeInsert: async (table) => { if (table === 'learning_allowances') await Promise.race([bothRead, new Promise((r) => setTimeout(r, 5000))]); },
  });
  try {
    await student(d, 'poor', { balance: 40 });
    const results = await Promise.all([start('poor', { key: key('p1') }), start('poor', { key: key('p2') })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], 'refused as taken before any price is asked');
    assert.equal(await balanceOf(d, 'poor'), 40);
    assert.equal((await claims(d, 'poor')).length, 1);
  } finally { await d.close(); }
});

test('Pro is unaffected: no rule fields on the quote, nothing written, nothing charged', async () => {
  const d = await routes();
  try {
    await student(d, 'pro', { balance: 0, premium: true });
    const q = await getQuote('pro');
    assert.equal(q.body.creditCost, 0);
    assert.equal(q.body.firstFullMock, undefined);
    assert.equal(q.body.freeReason, undefined);
    assert.match(q.body.reason, /^Included with your Pro access/);
    for (const k of ['x1', 'x2']) assert.equal((await start('pro', { key: key(k) })).status, 200);
    assert.deepEqual(await claims(d, 'pro'), []);
    assert.deepEqual(await spends(d, 'pro'), []);
  } finally { await d.close(); }
});

test('a student who already has a saved Full mock or NTA paper in the subject pays 50; General Test matches its old spelling', async () => {
  const d = await routes();
  try {
    await student(d, 'vet', { balance: 200 });
    await savePaper(d, 'old_full', 'vet', 'english', 'full');
    await savePaper(d, 'old_nta', 'vet', 'accountancy', 'nta');
    await savePaper(d, 'old_quick', 'vet', 'economics', 'quick');
    await savePaper(d, 'old_gat', 'vet', 'general_test', 'full'); // saved before General Test became 'gat'
    for (const subject of ['english', 'accountancy', 'general_test']) {
      const q = await getQuote('vet', { subject });
      assert.equal(q.body.firstFullMock, 'used', subject);
      assert.equal(q.body.creditCost, 50, subject);
    }
    assert.equal((await getQuote('vet', { subject: 'economics' })).body.creditCost, 0, 'a Quick set is not a full mock');
    assert.equal((await start('vet', { key: key('v1') })).status, 200);
    assert.equal(await balanceOf(d, 'vet'), 150);
    assert.equal((await start('vet', { key: key('v2'), subject: 'economics' })).status, 200);
    assert.equal(await balanceOf(d, 'vet'), 150, 'economics was free');
    assert.deepEqual((await claims(d, 'vet')).map((c) => c.kind), ['first_full_mock:economics']);
  } finally { await d.close(); }
});

test('unknown is never free: a failed read prices and charges 50, and writes no row', async () => {
  const d = await routes({ fail: ({ table, op }) => (table === 'attempts' && op === 'select' ? { code: '57014', message: 'canceling statement due to statement timeout' } : null) });
  try {
    await student(d, 'shaky', { balance: 100 });
    const q = await getQuote('shaky');
    assert.equal(q.body.firstFullMock, 'unknown');
    assert.equal(q.body.creditCost, 50);
    // getAttemptById reads attempts too; with that read failing the start cannot run, so open it for the start only.
    globalThis.__ffm.client = pgClient(d, { fail: ({ table, op, where }) => (table === 'attempts' && op === 'select' && where.some((w) => w.includes("'mode'")) ? { code: '57014', message: 'timeout' } : null) });
    assert.equal((await start('shaky', { key: key('s1') })).status, 200);
    assert.equal(await balanceOf(d, 'shaky'), 50, 'charged as before');
    assert.deepEqual(await claims(d, 'shaky'), []);
  } finally { await d.close(); }
});

test('a start paid before this rule shipped keeps its charge on replay and does not spend the free row', async () => {
  const d = await routes();
  try {
    await student(d, 'early', { balance: 100 });
    // The same paper, started and paid on the code before this rule: same generation key, so the same session id.
    const id = practiceId(process.env.PRACTICE_SESSION_SECRET, 'early', key('pre'), ['english', 'full', 50, [], '']);
    assert.equal((await one(d, 'select public.spend_credits($1,$2,$3) r', ['early', 'attempt_full', `practice_${id}`])).r, true);
    assert.equal(await balanceOf(d, 'early'), 50);
    const replay = await start('early', { key: key('pre') });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.meta.sessionId, id);
    assert.equal(await balanceOf(d, 'early'), 50, 'not charged twice');
    assert.deepEqual(await claims(d, 'early'), [], 'and the free one is still there for a new full mock');
    assert.equal((await getQuote('early')).body.creditCost, 0);
  } finally { await d.close(); }
});

test('paid full mocks take the one credits balance exactly as release 10 does (free credits first), the same as a direct spend', async () => {
  const d = await routes();
  try {
    await student(d, 'pay', { balance: 100, free: 50 });
    await student(d, 'twin_direct', { balance: 100, free: 50 });
    assert.equal((await start('pay', { key: key('f1') })).status, 200, 'the free one');
    const paid = await start('pay', { key: key('f2') });
    assert.equal(paid.status, 200);
    assert.equal((await one(d, 'select public.spend_credits($1,$2,$3) r', ['twin_direct', 'attempt_full', 'practice_direct_reference'])).r, true);
    const [viaStart] = await spends(d, 'pay');
    const [direct] = await spends(d, 'twin_direct');
    assert.deepEqual(viaStart.parts, { included: 50, bonus: 0, balance: 0 });
    assert.deepEqual(viaStart.parts, direct.parts);
    assert.equal(viaStart.action, direct.action);
    assert.equal(viaStart.credit_delta, direct.credit_delta);
    const wallets = await rows(d, "select user_id, included_credits_used, bonus_credits from ai_credit_wallets where user_id in ('pay','twin_direct') order by user_id");
    assert.deepEqual(wallets.map((w) => w.included_credits_used), [50, 50]);
    assert.deepEqual([await balanceOf(d, 'pay'), await balanceOf(d, 'twin_direct')], [100, 100]);
  } finally { await d.close(); }
});

test('Quick practice and its prices are untouched (the device path charges 1 a question as today)', async () => {
  const d = await routes();
  try {
    await student(d, 'quick', { balance: 100 });
    const q = await getQuote('quick', { mode: 'quick', count: 10 });
    assert.equal(q.body.creditCost, 10);
    assert.equal(q.body.firstFullMock, 'available', 'the quote still says the Full mock in this subject is free');
    assert.equal((await start('quick', { key: key('k10'), mode: 'quick', count: 10 })).status, 200);
    assert.equal(await balanceOf(d, 'quick'), 90);
    assert.deepEqual(await claims(d, 'quick'), []);
  } finally { await d.close(); }
});

test('durable sessions: start_learning_session takes the free row under the user lock; the next and the parallel start pay; the full sample is the same free one', async () => {
  process.env.LEARNING_SESSIONS_ENABLED = 'true';
  let rpcs = 0; let release; const bothIn = new Promise((r) => { release = r; });
  let gate = false;
  const d = await routes({ beforeRpc: async (name) => { if (gate && name === 'start_learning_session') { if (++rpcs === 2) release(); await Promise.race([bothIn, new Promise((r) => setTimeout(r, 5000))]); } } });
  try {
    await student(d, 'dur', { balance: 100 });
    const q = await getQuote('dur');
    assert.equal(q.body.creditCost, 0);
    const first = await start('dur', { key: key('d1') });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(await balanceOf(d, 'dur'), 100);
    assert.deepEqual(await claims(d, 'dur'), [{ kind: 'first_full_mock:english', period: 'ever', reference: first.body.id }]);
    assert.equal((await start('dur', { key: key('d1') })).body.id, first.body.id, 'a replay returns the same session');
    assert.equal(await balanceOf(d, 'dur'), 100);
    assert.equal((await start('dur', { key: key('d2') })).status, 200);
    assert.equal(await balanceOf(d, 'dur'), 50, 'the next is 50');
    // The full sample after the free one is used: charged, not a second free paper.
    await rows(d, "update users set credit_balance=100 where id='dur'");
    const sampleQuote = await getQuote('dur', { purpose: 'full_sample' });
    assert.equal(sampleQuote.body.creditCost, 50);
    assert.equal((await start('dur', { key: key('d3'), purpose: 'full_sample' })).status, 200);
    assert.equal(await balanceOf(d, 'dur'), 50);
    assert.equal((await claims(d, 'dur')).some((c) => c.kind.startsWith('full_sample:')), false);

    // Two parallel first starts in another subject: both read 'available', start_learning_session lets one take the row.
    gate = true;
    await rows(d, "update users set credit_balance=100 where id='dur'");
    const [a, b] = await Promise.all([start('dur', { key: key('d4'), subject: 'accountancy' }), start('dur', { key: key('d5'), subject: 'accountancy' })]);
    gate = false;
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.equal(rpcs, 2);
    assert.equal(await balanceOf(d, 'dur'), 50, 'one free, one paid');
    assert.equal((await claims(d, 'dur')).filter((c) => c.kind === 'first_full_mock:accountancy').length, 1);

    // A full sample taken before this rule (a durable-only allowance) means that subject's free full mock was given.
    await student(d, 'sampled', { balance: 100 });
    await rows(d, "insert into learning_allowances values('sampled','full_sample:economics','cuet_2027','old_session',now())");
    assert.equal((await getQuote('sampled', { subject: 'economics' })).body.creditCost, 50);
    assert.equal((await start('sampled', { key: key('s1'), subject: 'economics' })).status, 200);
    assert.equal(await balanceOf(d, 'sampled'), 50);
  } finally {
    delete process.env.LEARNING_SESSIONS_ENABLED;
    await d.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Release 11 verifier L1: a quote said free, another device took the free one, and this start was charged 50 without a word
// ---------------------------------------------------------------------------------------------------------------------
test('L1: quoted free, then another device takes the free one: this start (firstFree=1) is refused, nothing charged; the new quote shows 50', async () => {
  const d = await routes();
  try {
    await student(d, 'two_devices', { balance: 120 });
    // The phone's Practice and the laptop's Practice both quote the English full mock free.
    for (const device of ['phone', 'laptop']) assert.equal((await getQuote('two_devices')).body.freeReason, 'first_full_mock_free', device);
    const phone = await start('two_devices', { key: key('phone'), firstFree: true });
    assert.equal(phone.status, 200);
    assert.equal(await balanceOf(d, 'two_devices'), 120, 'the phone took the free one');
    // The laptop starts from its (now stale) free quote: its own read says 'used', so it would have been charged 50.
    const laptop = await start('two_devices', { key: key('laptop'), firstFree: true });
    assert.equal(laptop.status, 409);
    assert.equal(laptop.body.error, 'FIRST_FULL_MOCK_TAKEN');
    assert.equal(laptop.body.detail.requote, true);
    assert.equal(await balanceOf(d, 'two_devices'), 120, 'nothing charged without a warning');
    assert.deepEqual(await spends(d, 'two_devices'), []);
    // Reloading the refused page (same key, same firstFree) is refused again, never charged.
    assert.equal((await start('two_devices', { key: key('laptop'), firstFree: true })).status, 409);
    assert.equal(await balanceOf(d, 'two_devices'), 120);
    // The re-quote shows the price; the start the student makes from it is charged exactly that.
    const q = await getQuote('two_devices');
    assert.deepEqual([q.body.creditCost, q.body.firstFullMock, q.body.freeReason], [50, 'used', undefined]);
    assert.equal((await start('two_devices', { key: key('laptop2') })).status, 200);
    assert.equal(await balanceOf(d, 'two_devices'), 70);
    // The phone's own replay of its free paper (same key, firstFree) stays free.
    const replay = await start('two_devices', { key: key('phone'), firstFree: true });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.meta.sessionId, phone.body.meta.sessionId);
    assert.equal(await balanceOf(d, 'two_devices'), 70);
  } finally { await d.close(); }
});

test('L1: a failed read on a start quoted free is refused as unchecked (503, nothing charged); the app\'s start without firstFree is priced as before', async () => {
  const d = await routes();
  try {
    await student(d, 'flaky', { balance: 100 });
    globalThis.__ffm.client = pgClient(d, { fail: ({ table, op, where }) => (table === 'attempts' && op === 'select' && where.some((w) => w.includes("'mode'")) ? { code: '57014', message: 'timeout' } : null) });
    const r = await start('flaky', { key: key('f1'), firstFree: true });
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'FIRST_FULL_MOCK_UNCHECKED');
    assert.match(r.body.message, /could not check that this full mock is still free/);
    assert.equal(await balanceOf(d, 'flaky'), 100);
    assert.deepEqual(await claims(d, 'flaky'), []);
    const app = await start('flaky', { key: key('f2') });
    assert.equal(app.status, 200, 'unknown is never free, as before, for a start that was not quoted free');
    assert.equal(await balanceOf(d, 'flaky'), 50);
  } finally { await d.close(); }
});

test('L1: the client side: Practice sends firstFree=1 only from a free quote, the test page passes it on and turns the refusal into a re-quoted price', async () => {
  const { firstMockNotice, isFirstMockRefusal, notFreePriceLine } = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'firstMockNotice.mjs')).href);
  const taken = Object.assign(new Error('FIRST_FULL_MOCK_TAKEN'), { status: 409, body: { error: 'FIRST_FULL_MOCK_TAKEN', message: 'Your free full mock in this subject was already started on another device or tab, so this one is not free. It did not start, and nothing was charged. Check the price, then start again.' } });
  assert.equal(isFirstMockRefusal(taken), true);
  assert.equal(isFirstMockRefusal(new Error('INSUFFICIENT_CREDITS')), false);
  const notice = firstMockNotice(taken, { creditCost: 50, creditBalance: 135, launchable: true }, 'English');
  assert.deepEqual(notice, { title: 'This full mock is not free now', message: taken.body.message, price: 'A full mock in English costs 50 credits. You have 135.', retry: false });
  assert.equal(notFreePriceLine(null, 'English'), 'Practice shows the price before you start.', 'a failed re-quote names no number');
  assert.equal(notFreePriceLine({ creditCost: 0, freeReason: 'first_full_mock_free' }), FIRST_FULL_MOCK_COPY.price);
  const unchecked = firstMockNotice(Object.assign(new Error('FIRST_FULL_MOCK_UNCHECKED'), { body: {} }), null);
  assert.deepEqual([unchecked.title, unchecked.retry, unchecked.price], ['This full mock did not start', true, '']);
  const practice = file('src/app/(app)/dashboard/DashboardPageClient.jsx').replace(/\r\n/g, '\n');
  assert.match(practice, /if \(quoteFirstFree\) tonight\.set\('firstFree', '1'\);\n\s+const target = `\$\{launchHref\}&generationKey=/);
  const runner = file('src/app/(app)/test/TestPageClient.jsx');
  assert.match(runner, /\['sessionId','episodeId','purpose','tonightKey','tonightMinutes','variant','firstFree'\]/);
  assert.match(runner, /if \(isFirstMockRefusal\(e\)\) \{[\s\S]{0,400}forgetFirstFullMock\(\);[\s\S]{0,400}apiGet\(`\/api\/practice\/quote\?\$\{new URLSearchParams\(\{ subject: subjectId, mode: 'full', count: '50' \}\)\}`\)/);
  assert.match(runner, /setNotFree\(firstMockNotice\(e, fresh, displayLabel\(subjectId\)\)\);/);
  assert.match(file('src/app/api/sessions/route.js'), /\/FIRST_FULL_MOCK_TAKEN\/\.test\(message\) \? 409 : \/FIRST_FULL_MOCK_UNCHECKED\/\.test\(message\) \? 503 :/);
});

// ---------------------------------------------------------------------------------------------------------------------
// Release 11 verifier L4: the kill switch C-dec 1 promised, FIRST_FULL_MOCK_ENABLED (ON when unset; "false" turns it off)
// ---------------------------------------------------------------------------------------------------------------------
test('L4: FIRST_FULL_MOCK_ENABLED=false: the server never grants the free mock; unset and anything else keep it on', async () => {
  const { firstFullMockEnabled } = await import('../first_full_mock.js');
  for (const [value, on] of [[undefined, true], ['', true], ['true', true], ['1', true], ['false', false], [' FALSE ', false]]) assert.equal(firstFullMockEnabled(value), on, String(value));
  const d = await routes();
  try {
    await student(d, 'switched', { balance: 100 });
    process.env.FIRST_FULL_MOCK_ENABLED = 'false';
    assert.equal(firstFullMockApplies({ isPremium: false, modeId: 'full' }), false);
    const q = await getQuote('switched');
    assert.deepEqual([q.body.creditCost, q.body.firstFullMock, q.body.freeReason, q.body.allowance], [50, undefined, undefined, null], 'priced as before the rule, with no rule fields');
    assert.equal((await getQuote('switched', { mode: 'quick', count: 10 })).body.firstFullMock, undefined, 'no quote carries the state');
    const quoted = await start('switched', { key: key('o1'), firstFree: true });
    assert.equal(quoted.status, 409, 'a page still holding a free quote is refused, never charged silently');
    assert.equal(quoted.body.detail.reason, 'off');
    assert.match(quoted.body.message, /^This full mock is not free any more\./);
    assert.equal(await balanceOf(d, 'switched'), 100);
    const paid = await start('switched', { key: key('o2') });
    assert.equal(paid.status, 200);
    assert.equal(await balanceOf(d, 'switched'), 50, 'charged 50 as before the rule');
    assert.deepEqual(await claims(d, 'switched'), [], 'no free row is written');
    // Back on: the free one is still there (the paid start was not it).
    delete process.env.FIRST_FULL_MOCK_ENABLED;
    assert.equal((await getQuote('switched')).body.freeReason, 'first_full_mock_free');
    assert.equal((await start('switched', { key: key('o3'), firstFree: true })).status, 200);
    assert.equal(await balanceOf(d, 'switched'), 50);
  } finally {
    delete process.env.FIRST_FULL_MOCK_ENABLED;
    await d.close();
  }
});

test('L4: FIRST_FULL_MOCK_ENABLED=false hides every "first full mock free" line; unset shows them; next.config passes the switch into the builds', async () => {
  const { execFileSync } = await import('node:child_process');
  const href = (rel) => JSON.stringify(pathToFileURL(path.join(ROOT, rel)).href);
  const probe = [
    `const { ONE_CREDIT_LINE, PRACTICE_PRICE_LINE } = await import(${href('src/lib/creditCopy.mjs')});`,
    `const { ONBOARDING_LEAD, pricingBankLine, pricingBankFaq } = await import(${href('src/lib/paperCopy.mjs')});`,
    `const { FIRST_FULL_MOCK_ON } = await import(${href('data/first_full_mock.js')});`,
    `const config = (await import(${href('next.config.mjs')})).default;`,
    'console.log(JSON.stringify({ on: FIRST_FULL_MOCK_ON, lines: [ONE_CREDIT_LINE, PRACTICE_PRICE_LINE, ONBOARDING_LEAD, pricingBankLine(9000), pricingBankFaq(9000).a], env: config.env }));',
  ].join('\n');
  const run = (value) => {
    const env = { ...process.env };
    if (value === undefined) delete env.FIRST_FULL_MOCK_ENABLED; else env.FIRST_FULL_MOCK_ENABLED = value;
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', probe], { env, cwd: ROOT, encoding: 'utf8' }).trim().split('\n').pop());
  };
  const free = /first (full mock|one)[^.]*free/i;
  const on = run(undefined);
  assert.equal(on.on, true);
  for (const line of on.lines) assert.match(line, free, line);
  assert.deepEqual(on.env, { FIRST_FULL_MOCK_ENABLED: '' });
  const off = run('false');
  assert.equal(off.on, false);
  for (const line of off.lines) assert.doesNotMatch(line, free, line);
  assert.deepEqual(off.lines.slice(0, 3), [
    '1 credit buys 1 practice question, or one Mobi job: a mistake fixed for good, or a doubt answered and tested on 2 real CUET questions. A full mock costs 50 credits. Everything Mobi reads from your record is free. The cost shows before you start.',
    'A practice question costs 1 credit, so a 10-question set is 10 credits. A full mock costs 50 credits.',
    'Pick up to 5. Every mock is built fresh from one live question bank. Each one uses credits on Free; on Pro there is no cap. Swap subjects any time.',
  ]);
  assert.deepEqual(off.env, { FIRST_FULL_MOCK_ENABLED: 'false' }, 'the build carries the switch to the browser');
  // The pages that import the app's own modules (pricing, the landing, Ask Mobi's guide) gate the same lines on the same switch,
  // and every surface that reads the rule's state stops reading it (null prices a full mock as before).
  const pricing = file('src/app/pricing/page.js');
  assert.match(pricing, /const FIRST_FREE_ITEMS = FIRST_FULL_MOCK_ON \? \[FIRST_FULL_MOCK_COPY\.planItem\] : \[\];/);
  assert.equal((pricing.match(/\.\.\.FIRST_FREE_ITEMS/g) || []).length, 2);
  assert.equal((pricing.match(/FIRST_FULL_MOCK_COPY\.planItem/g) || []).length, 1, 'only through the switch');
  assert.match(file('src/app/page.js'), /\.\.\.\(FIRST_FULL_MOCK_ON \? \[FIRST_FULL_MOCK_COPY\.planItem\] : \[\]\),/);
  assert.doesNotMatch(file('src/app/page.js'), /'Your first full mock in every subject is free'/);
  assert.match(file('src/components/ai/assistantKnowledge.js'), /const FIRST_FREE = FIRST_FULL_MOCK_ON \? ', and your first full mock in each subject is free' : '';/);
  const hook = file('src/lib/useFirstFullMock.js');
  assert.match(hook, /const key = FIRST_FULL_MOCK_ON && userId && subject && !premium/);
  assert.match(hook, /if \(!FIRST_FULL_MOCK_ON\) return \{ state: null, settled: true \};/);
  assert.match(file('src/app/(app)/today/page.jsx'), /firstFullRead\.state === null \? null :/);
  assert.match(file('src/app/api/practice/quote/route.js'), /const firstFullMock = firstFullMockEnabled\(\) && user\.isPremium !== true/);
});
