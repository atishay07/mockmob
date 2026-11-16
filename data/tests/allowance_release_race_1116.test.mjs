// The free first Full mock's release race (durable sessions, 16 Nov 2026; tmp/1115-prod/durable-sessions-ready.md, "Still to
// fix before LEARNING_SESSIONS_ENABLED=true").
//
// A durable start takes the free row (learning_allowances) before start_learning_session, and a start whose session then fails
// gives it back (releaseFirstFullMock). That release read recovery_sessions and then deleted the row, outside the start's
// users row lock. On a double tap (two starts, the same generation key, so the same session id) start A's session start could
// fail while start B's held the users lock and had not committed: A's read saw no session, A deleted the free row, B committed a
// free session, and the student could later start a second free first Full mock.
//
// The fix is supabase/migrations/20261116120000_release_unstarted_allowance.sql (NOT applied): one function that takes the same
// users row lock first and deletes the row only while no session has that id. What runs here: the REAL routes (POST /api/sessions,
// GET /api/practice/quote), the real start_learning_session and the real release function, on PGlite built from the repo's
// migrations in production's order (as data/tests/first_full_mock_1019.test.mjs builds it). PGlite has one connection, so
// Postgres's lock wait is played by the test: while B "holds the lock", A's release runs only after B has committed, which is
// what the row lock makes Postgres do; the lock itself is checked on the database (the users row's xmax inside a transaction).
// No network, no paid model, no production write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { walletWindow } from '../../src/services/credits/aiWalletState.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const RELEASE = 'release_unstarted_allowance';
const MIGRATION_PATH = 'supabase/migrations/20261116120000_release_unstarted_allowance.sql';
const UNDO_PATH = 'supabase/undo/20261116120000_release_unstarted_allowance.undo.sql';
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

// The review's open cases (16 Nov 2026, second pass): start_learning_session made under its lock with the free row, and its
// guarded new version (NOT applied). `start: 'own'` applies it on top of the chain.
const OWN_PATH = 'supabase/migrations/20261116130000_start_learning_session_own_allowance.sql';
const OWN_UNDO_PATH = 'supabase/undo/20261116130000_start_learning_session_own_allowance.undo.sql';

/** Production's shape (first_full_mock_1019's database()), with the release function applied unless `release` is false. */
async function database({ release = true, start = 'old' } = {}) {
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
  await d.exec(file('supabase/undo/20261018210000_one_credits_balance.undo.sql'));
  await d.exec(file('supabase/migrations/20261018210000_one_credits_balance.sql'));
  await d.exec(`alter table users add column if not exists name text, add column if not exists email text, add column if not exists image text,
      add column if not exists subjects text[], add column if not exists role text, add column if not exists subscription_status text,
      add column if not exists is_premium boolean default false, add column if not exists premium_until timestamptz,
      add column if not exists razorpay_subscription_id text, add column if not exists created_at timestamptz default now();
    alter table attempts add column if not exists selection_meta jsonb, add column if not exists completed_at timestamptz default now();`);
  if (release) await d.exec(file(MIGRATION_PATH));
  if (start === 'own') await d.exec(file(OWN_PATH));
  return d;
}
const rows = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const one = async (d, sql, params) => (await rows(d, sql, params))[0];
const W = walletWindow(new Date());

async function student(d, id, { balance = 100 } = {}) {
  await rows(d, 'insert into users(id,credit_balance,subjects) values($1,$2,$3)', [id, balance, ['english', 'accountancy']]);
  await rows(d, 'insert into ai_credit_wallets(user_id,included_monthly_credits,included_credits_used,bonus_credits,period_start,reset_at) values($1,50,50,0,$2,$3)',
    [id, W.periodStart, W.resetAt]);
}
const balanceOf = async (d, id) => (await one(d, 'select credit_balance b from users where id=$1', [id])).b;
const freeRows = (d, id) => rows(d, "select kind, reference from learning_allowances where user_id=$1 and kind like 'first\\_full\\_mock:%' order by kind", [id]);
const sessions = (d, id) => rows(d, 'select id from recovery_sessions where user_id=$1 order by id', [id]);

// ---- the stand-in Supabase client (first_full_mock_1019's, with the hooks this race needs) --------------------------------
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
      delete() { op = 'delete'; return query; },
      maybeSingle() { single = true; return query; },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    async function run() {
      try {
        await hooks.gate?.({ table, op, columns });
        const failure = hooks.fail?.({ table, op, columns });
        if (failure) return { data: null, error: failure };
        if (op === 'insert') {
          await hooks.beforeInsert?.({ table });
          const keys = Object.keys(row);
          await pg.query(`insert into public.${table}(${keys.map(column).join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map((k) => row[k]));
          return { data: null, error: null };
        }
        const filter = where.length ? ` where ${where.join(' and ')}` : '';
        if (op === 'delete') {
          if (!where.length) throw new Error('stand-in client: a delete needs a filter');
          await hooks.beforeDelete?.({ table });
          await pg.query(`delete from public.${table}${filter}`, params);
          return { data: null, error: null };
        }
        if (options.head && options.count) {
          const { rows: [r] } = await pg.query(`select count(*)::int n from public.${table}${filter}`, params);
          return { data: null, count: r.n, error: null };
        }
        const list = columns === '*' ? '*' : columns.split(',').map((c) => column(c.trim())).join(',');
        const { rows: found } = await pg.query(`select ${list} from public.${table}${filter}`, params);
        await hooks.afterRead?.({ table, columns });
        return { data: single ? (found[0] ?? null) : found, error: null };
      } catch (error) {
        return { data: null, error: { code: error.code, message: error.message } };
      }
    }
    return query;
  };
  const rpc = async (name, args = {}) => {
    try {
      await hooks.gate?.({ rpc: name });
      const answer = await hooks.beforeRpc?.(name, args);
      if (answer) return answer;
      const keys = Object.keys(args);
      const values = keys.map((k) => (args[k] && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
      const { rows: [r] } = await pg.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values);
      hooks.afterRpc?.(name, r.r);
      // A reply lost on the way back: the statement ran and committed, the caller sees an error.
      const lost = hooks.answerRpc?.(name, r.r);
      if (lost) return lost;
      return { data: r.r, error: null };
    } catch (error) {
      hooks.afterRpc?.(name, null, error);
      return { data: null, error: { code: error.code, message: error.message } };
    }
  };
  return { from, rpc };
}

// ---- the routes, with only the edges stood in (first_full_mock_1019's stubs) --------------------------------------------
const STUBS = {
  'src/lib/supabase.js': 'export const supabaseAdmin = () => globalThis.__ffr.client;',
  'src/lib/auth.ts': 'export async function auth() { return globalThis.__ffr.session; }',
  'src/lib/server/rateLimit.js': 'export async function checkPersistentRateLimit() { return { allowed: true }; }',
  'src/lib/server/inventory.js': 'export async function publicInventory() { return globalThis.__ffr.inventory; }',
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

const inventory = { state: 'available', checkedAt: '2026-11-16T00:00:00Z', subjectCounts: { english: 900, accountancy: 900 } };
process.env.PRACTICE_SESSION_SECRET = 'first-full-mock-release-test-secret-0123456789';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-service-role-key';
process.env.PERSISTENT_LIMITS_ENABLED = 'false';
delete process.env.LEARNING_SESSIONS_ENABLED;
delete process.env.FIRST_FULL_MOCK_ENABLED;
globalThis.__ffr = { client: null, session: null, inventory };

const { Database } = await import(pathToFileURL(path.join(ROOT, 'data', 'db.js')).href);
const quoteRoute = await import(pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'practice', 'quote', 'route.js')).href);
const sessionsRoute = await import(pathToFileURL(path.join(ROOT, 'src', 'app', 'api', 'sessions', 'route.js')).href);
const { resetOneBalanceProbe } = await import(pathToFileURL(path.join(ROOT, 'src', 'services', 'credits', 'aiWalletState.js')).href);
const { releaseFirstFullMock } = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'server', 'firstFullMock.js')).href);

Database.getQuestions = async (subject, count, opts = {}) => ({
  questions: Array.from({ length: count }, (_, i) => ({ id: `${subject}_q${i + 1}`, subject, chapter: 'Chapter 1', question: `Question ${i + 1}`,
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Option ${key}` })), correct_answer: 'B', correctIndex: 1 })),
  meta: { mode: opts.mode, requestedCount: count, finalCount: count, selectedCount: count, selectionStrategy: 'test_bank' },
});

async function routes(hooks = {}, options = {}) {
  const d = await database(options);
  globalThis.__ffr.client = pgClient(d, hooks);
  resetOneBalanceProbe();
  return d;
}
const as = (userId) => { globalThis.__ffr.session = userId ? { user: { id: userId } } : null; };
async function getQuote(userId, { subject = 'english' } = {}) {
  as(userId);
  const params = new URLSearchParams({ subject, mode: 'full', count: '50' });
  const res = await quoteRoute.GET(new Request(`http://localhost/api/practice/quote?${params}`));
  return { status: res.status, body: await res.json() };
}
async function start(userId, { key, subject = 'english', firstFree = true } = {}) {
  as(userId);
  const body = { generationKey: key, subject, mode: 'full', count: '50', experience: 'practice', ...(firstFree ? { firstFree: '1' } : {}) };
  const res = await sessionsRoute.POST(new Request('http://localhost/api/sessions', { method: 'POST', body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
}
const key = (name) => `key_${name}_0123456789`;
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const within = (promise, ms = 5000) => Promise.race([promise, new Promise((r) => setTimeout(r, ms))]);
const connectionReset = () => Object.assign(new Error('connection reset'), { code: '08006' });

async function durable(run) {
  process.env.LEARNING_SESSIONS_ENABLED = 'true';
  try { await run(); } finally { delete process.env.LEARNING_SESSIONS_ENABLED; }
}

// ---------------------------------------------------------------------------------------------------------------------
// The function itself
// ---------------------------------------------------------------------------------------------------------------------
test('the migration: one security definer function, search_path pinned, only service_role may run it, idempotent; the undo drops it', async () => {
  const sql = file(MIGRATION_PATH);
  assert.match(sql, /^-- NOT APPLIED\./, 'marked not applied');
  const d = await database();
  try {
    await d.exec(sql); // a second apply is harmless
    const fn = await one(d, `select prosecdef, provolatile, proconfig from pg_proc where oid = to_regprocedure('public.${RELEASE}(text, text, text, text)')`);
    assert.equal(fn.prosecdef, true, 'security definer');
    assert.equal(fn.provolatile, 'v', 'volatile: each statement takes a fresh snapshot, so it sees the session the lock waited for');
    assert.deepEqual(fn.proconfig, ['search_path=""'], 'a fixed, empty search_path');
    // 'nobody' holds no grant of its own, so it can run the function only if PUBLIC can.
    await d.exec('create role nobody');
    for (const role of ['nobody', 'anon', 'authenticated']) {
      const r = await one(d, `select has_function_privilege('${role}', 'public.${RELEASE}(text, text, text, text)', 'execute') ok`);
      assert.equal(r.ok, false, `${role} cannot run it`);
    }
    assert.equal((await one(d, `select has_function_privilege('service_role', 'public.${RELEASE}(text, text, text, text)', 'execute') ok`)).ok, true);
    // The server's role runs it end to end (security definer: it needs no table grant of its own beyond what it has).
    await student(d, 'svc');
    await rows(d, "insert into learning_allowances(user_id,kind,period,reference) values('svc','first_full_mock:english','ever','svc_paper')");
    await d.exec('set role service_role');
    assert.equal((await one(d, `select public.${RELEASE}('svc','first_full_mock:english','ever','svc_paper') r`)).r, true);
    await d.exec('reset role');
    await d.exec('set role anon');
    await assert.rejects(d.query(`select public.${RELEASE}('svc','first_full_mock:english','ever','x')`), /permission denied/);
    await d.exec('reset role');
    await d.exec(file(UNDO_PATH));
    assert.equal((await one(d, `select to_regprocedure('public.${RELEASE}(text, text, text, text)') f`)).f, null, 'the undo drops it');
    await d.exec(file(UNDO_PATH)); // and runs twice
  } finally { await d.close(); }
});

test('the lock: the function takes the users row lock before it reads or deletes anything, the same row start_learning_session locks first', async () => {
  // Statement order in the two bodies: the users row is locked first in both, so they queue on one lock and cannot deadlock.
  const body = file(MIGRATION_PATH).split(/\$\$/)[1];
  const lockAt = body.search(/perform 1 from public\.users where id = p_user_id for update;/);
  assert.ok(lockAt > 0, 'it locks the users row');
  assert.ok(lockAt < body.search(/public\.recovery_sessions/) && lockAt < body.search(/delete from public\.learning_allowances/), 'before the read and the delete');
  const start = file('supabase/migrations/20261002120000_connected_learning.sql').split('create function public.start_learning_session')[1];
  assert.match(start, /^[^]*?begin\s+perform 1 from public\.users where id=p_row->>'user_id' for update;/, 'start_learning_session locks the same row first');
  // And on the database: inside one transaction, after the call the student's users row carries this transaction's lock.
  const d = await database();
  try {
    await student(d, 'locked');
    await student(d, 'bystander');
    await d.exec('begin');
    const xid = (await one(d, 'select (txid_current() % 4294967296)::text x')).x;
    const lockerOf = async (id) => (await one(d, 'select xmax::text x from users where id=$1', [id])).x;
    assert.notEqual(await lockerOf('locked'), xid, 'not locked by this transaction before the call');
    assert.equal((await one(d, `select public.${RELEASE}('locked','first_full_mock:english','ever','no_such_paper') r`)).r, false, 'nothing to give back');
    assert.equal(await lockerOf('locked'), xid, 'the row is locked by this transaction, even when nothing is released');
    assert.notEqual(await lockerOf('bystander'), xid, 'no other student is locked');
    await d.exec('rollback');
  } finally { await d.close(); }
});

test('the function: gives back only that student\'s row for that kind, period and session, and keeps it while the session exists', async () => {
  const d = await database();
  try {
    await student(d, 'me');
    await student(d, 'you');
    await rows(d, `insert into learning_allowances(user_id,kind,period,reference) values
      ('me','first_full_mock:english','ever','p1'),('me','first_full_mock:accountancy','ever','p1'),('you','first_full_mock:english','ever','p1'),
      ('me','first_full_mock:economics','ever','p2')`);
    const release = (u, kind, s, period = 'ever') => one(d, `select public.${RELEASE}($1,$2,$3,$4) r`, [u, kind, period, s]).then((r) => r.r);
    assert.equal(await release('me', 'first_full_mock:english', 'p9'), false, 'another session\'s row is not this one');
    assert.equal(await release('me', 'first_full_mock:english', 'p1', 'cuet_2027'), false, 'another period');
    assert.equal(await release('ghost', 'first_full_mock:english', 'p1'), false, 'no such student');
    for (const blank of [null, '']) assert.equal(await release(blank, 'first_full_mock:english', 'p1'), false);
    assert.equal(await release('me', 'first_full_mock:english', null), false);
    // A session with that id exists (the start did make it): kept.
    await rows(d, `insert into recovery_sessions(id,user_id,request_key,subject,mode,state,questions,created_at,expires_at)
      values('p2','me','k2','economics','full','active','[]',now(),now()+interval '1 hour')`);
    assert.equal(await release('me', 'first_full_mock:economics', 'p2'), false);
    assert.equal(await release('me', 'first_full_mock:english', 'p1'), true);
    assert.equal(await release('me', 'first_full_mock:english', 'p1'), false, 'twice is once');
    assert.deepEqual(await rows(d, 'select user_id, kind from learning_allowances order by user_id, kind'), [
      { user_id: 'me', kind: 'first_full_mock:accountancy' }, { user_id: 'me', kind: 'first_full_mock:economics' }, { user_id: 'you', kind: 'first_full_mock:english' },
    ]);
  } finally { await d.close(); }
});

// ---------------------------------------------------------------------------------------------------------------------
// The race, through the real routes
// ---------------------------------------------------------------------------------------------------------------------
test('the note\'s interleaving: a double tap, A\'s session start fails while B holds the lock; the free row stays with B\'s session, one free session, the next full mock is charged', async () => {
  await durable(async () => {
    // A is the first start to reach start_learning_session: its call fails (a connection error). B waits there, "holding the
    // lock", until A's release is running; then B commits. Before the fix the release read recovery_sessions while B had not
    // committed and deleted the row after; with the function the release waits on the users row lock, so it runs once B is in.
    let calls = 0;
    const bMayRun = deferred();
    const bCommitted = deferred();
    const releaseRunning = async () => { bMayRun.resolve(); await within(bCommitted.promise); };
    let throughFunction = 0;
    const d = await routes({
      beforeRpc: async (name) => {
        if (name === 'start_learning_session' && ++calls === 1) throw connectionReset();
        if (name === 'start_learning_session') await within(bMayRun.promise);
        if (name === RELEASE) { throughFunction += 1; await releaseRunning(); }
        return null;
      },
      afterRpc: (name) => { if (name === 'start_learning_session' && calls === 2) bCommitted.resolve(); },
      // The read-then-delete release (the code before the fix, and the fallback): B commits between the read and the delete.
      afterRead: async ({ table, columns }) => { if (table === 'recovery_sessions' && columns === 'id') await releaseRunning(); },
    });
    try {
      await student(d, 'tap', { balance: 100 });
      assert.equal((await getQuote('tap')).body.freeReason, 'first_full_mock_free');
      const [a, b] = await Promise.all([start('tap', { key: key('dbl') }), start('tap', { key: key('dbl') })]);
      const [won, lost] = a.status === 200 ? [a, b] : [b, a];
      assert.equal(won.status, 200, JSON.stringify(won.body).slice(0, 300));
      assert.deepEqual([lost.status, lost.body.error], [503, 'SESSION_CREATE_FAILED'], 'A failed, and was charged nothing');
      assert.deepEqual(await sessions(d, 'tap'), [{ id: won.body.id }], 'one session');
      assert.equal(await balanceOf(d, 'tap'), 100, 'and it was free');
      assert.deepEqual(await freeRows(d, 'tap'), [{ kind: 'first_full_mock:english', reference: won.body.id }], 'the free row stays with the session that started');
      assert.equal(throughFunction, 1, 'the release went through the function');
      // So the free first Full mock is used: the quote says 50, and another full mock in English is charged 50.
      const q = await getQuote('tap');
      assert.deepEqual([q.body.firstFullMock, q.body.creditCost, q.body.freeReason], ['used', 50, undefined]);
      assert.equal((await start('tap', { key: key('next'), firstFree: true })).status, 409, 'a page still quoting free is refused, not given a second free one');
      assert.equal((await start('tap', { key: key('next'), firstFree: false })).status, 200);
      assert.equal(await balanceOf(d, 'tap'), 50, 'charged 50: there is no second free first Full mock');
      // B's own replay is the same free paper.
      assert.equal((await start('tap', { key: key('dbl') })).body.id, won.body.id);
      assert.equal(await balanceOf(d, 'tap'), 50);
    } finally { await d.close(); }
  });
});

test('the other order: A\'s release runs before B reaches the lock; B\'s start puts the free row back on its session', async () => {
  await durable(async () => {
    // The lock cannot help here: A's release finds no session and gives the row back, and only then does B's start take the
    // users lock and commit a free session. B's start, once its session is made, checks the row and takes it again.
    // A's session start fails only once B holds the row too ('mine') and is on its way to its own session start; B then waits
    // there until A's request (its failure and its release) has finished.
    let calls = 0;
    const bOnItsWay = deferred();
    const aDone = deferred();
    const d = await routes({
      beforeRpc: async (name) => {
        if (name !== 'start_learning_session') return null;
        calls += 1;
        if (calls === 1) { await within(bOnItsWay.promise); throw connectionReset(); }
        if (calls === 2) { bOnItsWay.resolve(); await within(aDone.promise); }
        return null;
      },
    });
    try {
      await student(d, 'late', { balance: 100 });
      const pair = [start('late', { key: key('lt') }), start('late', { key: key('lt') })];
      Promise.race(pair).then(aDone.resolve); // B waits at its session start until A's request has finished
      const [a, b] = await Promise.all(pair);
      const [won, lost] = a.status === 200 ? [a, b] : [b, a];
      assert.equal(won.status, 200, JSON.stringify([a.body, b.body]).slice(0, 400));
      assert.equal(lost.status, 503);
      assert.deepEqual(await sessions(d, 'late'), [{ id: won.body.id }]);
      assert.equal(await balanceOf(d, 'late'), 100);
      assert.deepEqual(await freeRows(d, 'late'), [{ kind: 'first_full_mock:english', reference: won.body.id }], 'the free row is back with the free session');
      assert.equal((await getQuote('late')).body.creditCost, 50, 'so the next full mock in English is 50');
    } finally { await d.close(); }
  });
});

test('keepFirstFullMock: puts a missing free row back, leaves its own row and another session\'s row alone, and never writes on a failed read', async () => {
  const { keepFirstFullMock } = await import(pathToFileURL(path.join(ROOT, 'src', 'lib', 'server', 'firstFullMock.js')).href);
  const d = await database();
  try {
    await student(d, 'keep');
    const db = pgClient(d);
    assert.equal(await keepFirstFullMock(db, { userId: 'keep', subject: 'english', sessionId: 'mine1' }), 'claimed');
    assert.deepEqual(await freeRows(d, 'keep'), [{ kind: 'first_full_mock:english', reference: 'mine1' }]);
    assert.equal(await keepFirstFullMock(db, { userId: 'keep', subject: 'english', sessionId: 'mine1' }), 'mine');
    assert.equal(await keepFirstFullMock(db, { userId: 'keep', subject: 'english', sessionId: 'other1' }), 'taken');
    assert.deepEqual(await freeRows(d, 'keep'), [{ kind: 'first_full_mock:english', reference: 'mine1' }], 'unchanged');
    let wrote = false;
    const broken = pgClient(d, {
      fail: ({ op }) => (op === 'select' ? { code: '57014', message: 'canceling statement due to statement timeout' } : null),
      beforeInsert: async () => { wrote = true; },
    });
    assert.equal(await keepFirstFullMock(broken, { userId: 'keep', subject: 'accountancy', sessionId: 'a1' }), 'unknown');
    assert.equal(wrote, false, 'a row it could not read is never written');
    assert.equal(await keepFirstFullMock(null, { userId: 'keep', subject: 'english', sessionId: 'x' }), 'unknown');
    assert.equal(await keepFirstFullMock(db, { userId: 'keep', subject: 'English', sessionId: 'x' }), 'unknown');
    // Case 2: a session started paid (its `recovery:<id>` line is in the ledger) never takes the free row, and gives back one it holds.
    await rows(d, "insert into credit_transactions(user_id,amount,type,reference,action,credit_delta) values('keep',-50,'spend','recovery:paid1','attempt_full',-50)");
    assert.equal(await keepFirstFullMock(db, { userId: 'keep', subject: 'accountancy', sessionId: 'paid1' }), 'paid');
    assert.deepEqual(await freeRows(d, 'keep'), [{ kind: 'first_full_mock:english', reference: 'mine1' }], 'not taken');
    await rows(d, "insert into learning_allowances(user_id,kind,period,reference) values('keep','first_full_mock:accountancy','ever','paid1')");
    assert.equal(await keepFirstFullMock(db, { userId: 'keep', subject: 'accountancy', sessionId: 'paid1' }), 'paid');
    assert.deepEqual(await freeRows(d, 'keep'), [{ kind: 'first_full_mock:english', reference: 'mine1' }], 'given back');
    // A ledger it cannot read: unknown, nothing written or deleted.
    await rows(d, "insert into learning_allowances(user_id,kind,period,reference) values('keep','first_full_mock:accountancy','ever','paid1')");
    const noLedger = pgClient(d, { fail: ({ table }) => (table === 'credit_transactions' ? { code: '57014', message: 'timeout' } : null) });
    assert.equal(await keepFirstFullMock(noLedger, { userId: 'keep', subject: 'accountancy', sessionId: 'paid1' }), 'unknown');
    assert.equal(await keepFirstFullMock(noLedger, { userId: 'keep', subject: 'economics', sessionId: 'free9' }), 'unknown');
    assert.deepEqual(await freeRows(d, 'keep'), [{ kind: 'first_full_mock:accountancy', reference: 'paid1' }, { kind: 'first_full_mock:english', reference: 'mine1' }]);
  } finally { await d.close(); }
});

test('a genuine failed start still gives the free row back (through the function), and the next start of that subject is the free one', async () => {
  // With start_learning_session as production has it, and with its new version (supabase/migrations/20261116130000_...).
  for (const version of ['old', 'own']) await durable(async () => {
    let failing = true;
    const called = [];
    const d = await routes({
      beforeRpc: async (name) => {
        called.push(name);
        if (failing && name === 'start_learning_session') throw connectionReset();
        return null;
      },
    }, { start: version });
    try {
      await student(d, 'solo', { balance: 30 });
      const broken = await start('solo', { key: key('s1'), subject: 'accountancy' });
      assert.equal(broken.status >= 500, true, JSON.stringify(broken.body));
      assert.deepEqual(called, ['start_learning_session', RELEASE], 'given back through the function, once');
      assert.deepEqual(await freeRows(d, 'solo'), [], 'the free row is given back');
      assert.equal(await balanceOf(d, 'solo'), 30, 'nothing charged');
      assert.equal((await getQuote('solo', { subject: 'accountancy' })).body.freeReason, 'first_full_mock_free', 'the quote says free again');
      failing = false;
      const next = await start('solo', { key: key('s2'), subject: 'accountancy' });
      assert.equal(next.status, 200, JSON.stringify(next.body));
      assert.equal(await balanceOf(d, 'solo'), 30, 'free, with 30 credits that could never buy a 50-credit mock');
      assert.deepEqual(await freeRows(d, 'solo'), [{ kind: 'first_full_mock:accountancy', reference: next.body.id }]);
    } finally { await d.close(); }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Before the migration is applied (production today): the release does what it did before
// ---------------------------------------------------------------------------------------------------------------------
test('the fallback: without the function the release reads then deletes as before; PGRST202 falls back too; any other error keeps the row', async () => {
  await durable(async () => {
    let failing = true;
    const d = await routes({
      beforeRpc: async (name) => { if (failing && name === 'start_learning_session') throw connectionReset(); return null; },
    }, { release: false });
    try {
      assert.equal((await one(d, `select to_regprocedure('public.${RELEASE}(text, text, text, text)') f`)).f, null, 'production shape: no function');
      await student(d, 'old', { balance: 30 });
      const broken = await start('old', { key: key('o1') });
      assert.equal(broken.status >= 500, true);
      assert.deepEqual(await freeRows(d, 'old'), [], 'given back by the read and the delete (42883 from Postgres)');
      failing = false;
      const ok = await start('old', { key: key('o2') });
      assert.equal(ok.status, 200);
      // The fallback keeps the row while the session exists, as before.
      assert.equal(await releaseFirstFullMock(globalThis.__ffr.client, { userId: 'old', subject: 'english', sessionId: ok.body.id }), false);
      assert.equal((await freeRows(d, 'old')).length, 1);
    } finally { await d.close(); }
  });
  const d = await database({ release: false });
  try {
    await student(d, 'rest');
    const seed = () => rows(d, "insert into learning_allowances(user_id,kind,period,reference) values('rest','first_full_mock:english','ever','gone') on conflict do nothing");
    // PostgREST's answer for a function it does not know (production until the migration is applied).
    const notFound = { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${RELEASE}(p_kind, p_period, p_session_id, p_user_id) in the schema cache` } };
    await seed();
    assert.equal(await releaseFirstFullMock(pgClient(d, { beforeRpc: async () => notFound }), { userId: 'rest', subject: 'english', sessionId: 'gone' }), true);
    assert.deepEqual(await freeRows(d, 'rest'), []);
    // Any other failure of the call (a timeout, a dropped connection): unknown, so the row is kept, and nothing falls back.
    await seed();
    let fellBack = false;
    const flaky = pgClient(d, {
      beforeRpc: async () => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }),
      afterRead: async () => { fellBack = true; },
      beforeDelete: async () => { fellBack = true; },
    });
    assert.equal(await releaseFirstFullMock(flaky, { userId: 'rest', subject: 'english', sessionId: 'gone' }), false);
    assert.equal(fellBack, false);
    // A network failure (supabase-js answers it with an error that has no code), and a client that throws outright.
    const dropped = pgClient(d, { beforeRpc: async () => { throw new Error('TypeError: fetch failed'); } });
    assert.equal(await releaseFirstFullMock(dropped, { userId: 'rest', subject: 'english', sessionId: 'gone' }), false);
    assert.equal(await releaseFirstFullMock({ ...dropped, rpc: () => { throw new Error('fetch failed'); } }, { userId: 'rest', subject: 'english', sessionId: 'gone' }), false);
    assert.equal((await freeRows(d, 'rest')).length, 1, 'kept');
    // Nothing to release without the facts.
    for (const bad of [{ userId: '', subject: 'english', sessionId: 'gone' }, { userId: 'rest', subject: 'English', sessionId: 'gone' }, { userId: 'rest', subject: 'english', sessionId: '' }]) {
      assert.equal(await releaseFirstFullMock(pgClient(d), bad), false, JSON.stringify(bad));
    }
    assert.equal(await releaseFirstFullMock(null, { userId: 'rest', subject: 'english', sessionId: 'gone' }), false);
    assert.equal((await freeRows(d, 'rest')).length, 1);
  } finally { await d.close(); }
});

test('the device-held start (LEARNING_SESSIONS_ENABLED off, production today) never calls the release', async () => {
  const called = [];
  const d = await routes({ beforeRpc: async (name) => { called.push(name); return null; } });
  try {
    await student(d, 'device', { balance: 30 });
    const r = await start('device', { key: key('dv') });
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.storage, 'device');
    assert.equal(called.includes(RELEASE), false);
    assert.equal(called.includes('start_learning_session'), false);
    assert.equal(await balanceOf(d, 'device'), 30);
    assert.equal((await freeRows(d, 'device')).length, 1);
  } finally { await d.close(); }
});

// ---------------------------------------------------------------------------------------------------------------------
// The review's open cases (second pass, 16 Nov 2026; tmp/1116-race/CTO-NOTE.md)
// ---------------------------------------------------------------------------------------------------------------------
// Case 1: a free session could end up with no free row. A's release ran before B reached the users lock, B's session committed,
// and B's reply was lost (or its process died) before keepFirstFullMock; the retry went through the replay return, which never
// calls keep. The free start now names its row in start_learning_session (p_quota_kind, no credit action), so the row is found
// or taken again in the session's own transaction, under the users lock, with the function production has today.
// Case 2: keepFirstFullMock could tie the free row to a session a twin with the same key started paid; it now reads the ledger.

/**
 * Plays one interleaving of tagged starts. Every learning_allowances, recovery_sessions and credit_transactions call and every
 * rpc of a tagged start waits at a gate until the test lets that start through; the start then runs alone to its next gate or
 * its end. Each gated call is one statement (both functions run as one statement under the users lock), so the order of the
 * gates is the order Postgres sees them in. Reads of users and attempts are not gated: they decide nothing here. Untagged calls
 * (the setup, the quotes, the retry after) never wait. A killed start stays at its gate for good: a server process that died.
 */
function scheduler() {
  const who = new AsyncLocalStorage();
  const starts = new Map();
  let wake = [];
  const changed = () => { const w = wake; wake = []; for (const f of w) f(); };
  const quiet = async () => {
    while ([...starts.values()].some((s) => s.status === 'running')) await new Promise((r) => { wake.push(r); });
  };
  const GATED = new Set(['learning_allowances', 'recovery_sessions', 'credit_transactions']);
  const api = {
    tag: () => who.getStore(),
    async gate({ table, op, columns, rpc }) {
      const s = starts.get(who.getStore());
      if (!s || (!rpc && !GATED.has(table))) return;
      s.status = 'waiting';
      s.at = rpc || `${op} ${table}${op === 'select' ? ` ${columns}` : ''}`;
      await new Promise((resolve) => { s.open = resolve; changed(); });
    },
    launch(tag, run) {
      const s = { status: 'running', at: null, open: null, result: undefined };
      starts.set(tag, s);
      const end = (r) => { s.result = r; s.status = 'done'; changed(); };
      who.run(tag, run).then(end, end);
    },
    async step(tag) {
      await quiet();
      const s = starts.get(tag);
      assert.equal(s.status, 'waiting', `${tag} waits at a gate`);
      s.status = 'running';
      const open = s.open; s.open = null; open();
      await quiet();
    },
    /** Lets `tag` through until it waits at the gate `at` (an rpc name, or 'select learning_allowances reference', ...). */
    async until(tag, at) {
      await quiet();
      while (starts.get(tag).status === 'waiting' && starts.get(tag).at !== at) await api.step(tag);
      assert.deepEqual([starts.get(tag).status, starts.get(tag).at], ['waiting', at], `${tag} reached ${at}`);
    },
    async finish(tag) {
      await quiet();
      while (starts.get(tag).status === 'waiting') await api.step(tag);
      return starts.get(tag).result;
    },
    kill(tag) { starts.get(tag).status = 'dead'; },
    waiting: () => [...starts].filter(([, s]) => s.status === 'waiting').map(([t]) => t),
    at: (tag) => starts.get(tag).at,
    result: (tag) => starts.get(tag).result,
    quiet,
  };
  return api;
}

/**
 * The stand-in client's hooks for a scheduled run, read through `ctx` (its scheduler and each tag's plan), so one database
 * serves many runs. A plan per tag: P 'before' (the session call fails before it reaches the database) or 'lost' (it commits, the
 * reply is lost); L 'error' (the release call times out: the row is kept); R 'fail' (the rule's read fails: 'unknown').
 */
function scheduledHooks(ctx) {
  const mine = () => ctx.plan[ctx.sched?.tag()] || {};
  const timeout = { code: '57014', message: 'canceling statement due to statement timeout' };
  return {
    gate: (at) => ctx.sched?.gate(at),
    fail: ({ table, op, columns }) => (mine().R === 'fail' && table === 'learning_allowances' && op === 'select' && columns === 'kind,period,reference' ? timeout : null),
    beforeRpc: async (name) => {
      if (name === 'start_learning_session' && mine().P === 'before') throw connectionReset();
      if (name === RELEASE && mine().L === 'error') return { data: null, error: timeout };
      return null;
    },
    answerRpc: (name) => (name === 'start_learning_session' && mine().P === 'lost' ? { data: null, error: { code: '08006', message: 'connection reset' } } : null),
  };
}
const SESSION_CALL = 'start_learning_session';
const spendsOf = (d, id) => rows(d, 'select reference, action from credit_transactions where user_id=$1 order by reference', [id]);

/** Starts run under the scheduler; `starts` maps a tag to start()'s options for one student. */
function launchAll(sched, userId, starts) {
  for (const [tag, options] of Object.entries(starts)) sched.launch(tag, () => start(userId, options));
}

test('case 1: A\'s release runs before B reaches the lock, B\'s session commits and its reply is lost; the retry replays: one free session, its free row, the next full mock is 50', async () => {
  for (const version of ['old', 'own']) await durable(async () => {
    const ctx = { sched: scheduler(), plan: { A: { P: 'before' }, B: { P: 'lost' } } };
    const d = await routes(scheduledHooks(ctx), { start: version });
    try {
      await student(d, 'lost', { balance: 100 });
      launchAll(ctx.sched, 'lost', { A: { key: key('lost') }, B: { key: key('lost') } });
      await ctx.sched.until('A', SESSION_CALL); // A took the free row
      await ctx.sched.until('B', SESSION_CALL); // B read it as its own ('mine') and is on its way to the session call
      assert.equal((await ctx.sched.finish('A')).status, 503, 'A\'s session call failed; its release gave the row back');
      assert.deepEqual(await freeRows(d, 'lost'), [], 'the row is gone before B reaches the lock');
      const b = await ctx.sched.finish('B');
      assert.equal(b.status, 503, 'B\'s session committed, but B never heard');
      const retry = await start('lost', { key: key('lost') });
      assert.equal(retry.status, 200, version);
      assert.deepEqual(await sessions(d, 'lost'), [{ id: retry.body.id }], 'one session');
      assert.equal(await balanceOf(d, 'lost'), 100, 'free');
      assert.deepEqual(await freeRows(d, 'lost'), [{ kind: 'first_full_mock:english', reference: retry.body.id }], `${version}: the free row came back with the session`);
      const q = await getQuote('lost');
      assert.deepEqual([q.body.firstFullMock, q.body.creditCost], ['used', 50]);
      assert.equal((await start('lost', { key: key('lost2') })).status, 409, 'a page still quoting free is refused');
      assert.equal((await start('lost', { key: key('lost2'), firstFree: false })).status, 200);
      assert.equal(await balanceOf(d, 'lost'), 50, 'no second free first Full mock');
    } finally { await d.close(); }
  });
});

test('case 1: the same, but B\'s server process dies after its session commits, before it can keep the row', async () => {
  for (const version of ['old', 'own']) await durable(async () => {
    const ctx = { sched: scheduler(), plan: { A: { P: 'before' } } };
    const d = await routes(scheduledHooks(ctx), { start: version });
    try {
      await student(d, 'dies', { balance: 100 });
      launchAll(ctx.sched, 'dies', { A: { key: key('dies') }, B: { key: key('dies') } });
      await ctx.sched.until('A', SESSION_CALL);
      await ctx.sched.until('B', SESSION_CALL);
      await ctx.sched.finish('A');
      await ctx.sched.step('B'); // B's session commits
      assert.equal((await sessions(d, 'dies')).length, 1);
      ctx.sched.kill('B'); // and B's process is gone: nothing after its session call runs
      const retry = await start('dies', { key: key('dies') });
      assert.equal(retry.status, 200);
      assert.equal(await balanceOf(d, 'dies'), 100);
      assert.deepEqual(await freeRows(d, 'dies'), [{ kind: 'first_full_mock:english', reference: retry.body.id }], version);
      assert.equal((await getQuote('dies')).body.creditCost, 50);
    } finally { await d.close(); }
  });
});

/** A small seeded generator, so a failing run names its seed and replays exactly. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickOf = (rand, list) => list[Math.floor(rand() * list.length)];
const RUNS = 100; // per database version

/**
 * One random interleaving of two or three starts with the same generation key (a double or triple tap): each start's session
 * call may fail before the database or commit with its reply lost, its release may time out, its read of the rule may fail, and
 * one start may die at any gate. Then the student retries with the same key, alone. Returns what the invariant needs.
 */
async function oneRun(d, ctx, seed) {
  const rand = seeded(seed);
  const userId = `run${seed}`;
  await student(d, userId, { balance: 100 });
  const tags = ['A', 'B', 'C'].slice(0, rand() < 0.5 ? 2 : 3);
  const plan = Object.fromEntries(tags.map((t) => [t, {
    P: pickOf(rand, ['ok', 'before', 'before', 'lost', 'lost']), L: rand() < 0.2 ? 'error' : 'ok', R: rand() < 0.1 ? 'fail' : 'ok',
  }]));
  // A start may die at any gate, or (half the time) right after its session call: the moment case 1 needs.
  const dies = rand() < 0.5 ? { tag: pickOf(rand, tags), after: rand() < 0.5 ? 'call' : Math.floor(rand() * 8) } : null;
  ctx.sched = scheduler(); ctx.plan = plan;
  const sched = ctx.sched;
  launchAll(sched, userId, Object.fromEntries(tags.map((t) => [t, { key: key(`run${seed}`) }])));
  const passed = Object.fromEntries(tags.map((t) => [t, 0]));
  const called = new Set();
  for (;;) {
    await sched.quiet();
    const ready = sched.waiting();
    if (!ready.length) break;
    const t = pickOf(rand, ready);
    if (dies?.tag === t && (dies.after === 'call' ? called.has(t) : passed[t] >= dies.after)) { sched.kill(t); continue; }
    if (sched.at(t) === SESSION_CALL) called.add(t);
    passed[t] += 1;
    await sched.step(t);
  }
  ctx.sched = null; ctx.plan = {};
  const retry = await start(userId, { key: key(`run${seed}`) });
  const answers = tags.map((t) => sched.result(t)).filter(Boolean);
  return { userId, retry, answers, what: JSON.stringify({ seed, plan, dies, answers: answers.map((a) => a.status) }) };
}

test('case 1, every order: 200 random interleavings of two or three same-key starts (failures, lost replies, a dead process) leave one free session holding the one free row', async () => {
  for (const version of ['old', 'own']) await durable(async () => {
    const ctx = { sched: null, plan: {} };
    const d = await routes(scheduledHooks(ctx), { start: version });
    try {
      for (let seed = 1; seed <= RUNS; seed += 1) {
        const { userId, retry, answers, what } = await oneRun(d, ctx, seed);
        assert.equal(retry.status, 200, `${version} ${what} ${JSON.stringify(retry.body).slice(0, 200)}`);
        const id = retry.body.id;
        for (const a of answers) if (a.status === 200) assert.equal(a.body.id, id, what);
        assert.deepEqual(await sessions(d, userId), [{ id }], `${version} ${what}`);
        assert.equal(await balanceOf(d, userId), 100, `${version} ${what}: never charged`);
        assert.deepEqual(await freeRows(d, userId), [{ kind: 'first_full_mock:english', reference: id }], `${version} ${what}`);
      }
    } finally { await d.close(); }
  });
});

test('without the release function (production today) the same runs still never charge or make a second session; the release\'s own window stays open there', async (t) => {
  await durable(async () => {
    const ctx = { sched: null, plan: {} };
    const d = await routes(scheduledHooks(ctx), { release: false });
    try {
      let rowless = 0;
      for (let seed = 1; seed <= RUNS; seed += 1) {
        const { userId, retry, what } = await oneRun(d, ctx, seed);
        assert.equal(retry.status, 200, what);
        assert.deepEqual(await sessions(d, userId), [{ id: retry.body.id }], what);
        assert.equal(await balanceOf(d, userId), 100, what);
        if ((await freeRows(d, userId)).length !== 1) rowless += 1;
      }
      // The read-then-delete release can still delete the row between its read and a twin's commit (CTO-NOTE "The fix", 1).
      t.diagnostic(`fallback release: ${rowless} of ${RUNS} runs end with no free row (apply 20261116120000 before the switch)`);
    } finally { await d.close(); }
  });
});

test('case 2: keepFirstFullMock never ties the free row to a session a twin with the same key started paid', async () => {
  for (const version of ['old', 'own']) await durable(async () => {
    // S1 and S2 tap the free mock (key k); S1's session call fails and gives the row back. X (another tab, key k2) takes it. S3 (the
    // app, key k, no firstFree) reads 'used' and starts the session paid. X's call fails and gives the row back. S2's call then
    // finds S3's paid session; before this fix S2's keep took the empty row for it, and the student lost a free mock it paid for.
    const ctx = { sched: scheduler(), plan: { S1: { P: 'before' }, X: { P: 'before' } } };
    const d = await routes(scheduledHooks(ctx), { start: version });
    try {
      await student(d, 'twin', { balance: 100 });
      launchAll(ctx.sched, 'twin', { S1: { key: key('tw') }, S2: { key: key('tw') } });
      await ctx.sched.until('S1', SESSION_CALL);
      await ctx.sched.until('S2', SESSION_CALL);
      await ctx.sched.finish('S1');
      launchAll(ctx.sched, 'twin', { X: { key: key('tw2') } });
      await ctx.sched.until('X', SESSION_CALL);
      launchAll(ctx.sched, 'twin', { S3: { key: key('tw'), firstFree: false } });
      assert.equal((await ctx.sched.finish('S3')).status, 200);
      assert.deepEqual(await spendsOf(d, 'twin'), [{ reference: `recovery:${(await sessions(d, 'twin'))[0].id}`, action: 'attempt_full' }], 'S3 started it paid');
      assert.equal((await ctx.sched.finish('X')).status, 503);
      const s2 = await ctx.sched.finish('S2');
      assert.equal(s2.status, 200, 'S2 is answered with the session that exists');
      assert.deepEqual(await freeRows(d, 'twin'), [], `${version}: the paid session never receives the free row`);
      assert.equal(await balanceOf(d, 'twin'), 50);
      assert.equal((await getQuote('twin')).body.freeReason, 'first_full_mock_free', 'so the first Full mock is still free');
      const next = await start('twin', { key: key('tw3') });
      assert.equal(next.status, 200);
      assert.equal(await balanceOf(d, 'twin'), 50, 'and the next one is the free one');
      assert.deepEqual(await freeRows(d, 'twin'), [{ kind: 'first_full_mock:english', reference: next.body.id }]);
    } finally { await d.close(); }
  });
});

test('case 2: a free tap that took the row, whose twin\'s read failed and started the session paid, gives the row back', async () => {
  for (const version of ['old', 'own']) await durable(async () => {
    const ctx = { sched: scheduler(), plan: { P: { R: 'fail' } } };
    const d = await routes(scheduledHooks(ctx), { start: version });
    try {
      await student(d, 'gave', { balance: 100 });
      launchAll(ctx.sched, 'gave', { F: { key: key('gv') }, P: { key: key('gv'), firstFree: false } });
      await ctx.sched.until('F', SESSION_CALL); // F holds the free row
      assert.equal((await freeRows(d, 'gave')).length, 1);
      assert.equal((await ctx.sched.finish('P')).status, 200, 'P read "unknown" and was charged, as before');
      const f = await ctx.sched.finish('F');
      assert.equal(f.status, 200);
      assert.equal(await balanceOf(d, 'gave'), 50);
      assert.deepEqual(await freeRows(d, 'gave'), [], `${version}: the row F took is given back, not left on a paid session`);
      assert.equal((await getQuote('gave')).body.freeReason, 'first_full_mock_free');
    } finally { await d.close(); }
  });
});

test('another key in the moment between: the new function refuses the start that lost its row (409, nothing charged); the old one makes a second free session', async () => {
  for (const version of ['old', 'own']) await durable(async () => {
    // S1 and S2 tap (key k); S1 fails and gives the row back; X (another tab, key k2) takes it before S2 reaches the lock.
    const ctx = { sched: scheduler(), plan: { S1: { P: 'before' } } };
    const d = await routes(scheduledHooks(ctx), { start: version });
    try {
      await student(d, 'gap', { balance: 100 });
      launchAll(ctx.sched, 'gap', { S1: { key: key('gp') }, S2: { key: key('gp') } });
      await ctx.sched.until('S1', SESSION_CALL);
      await ctx.sched.until('S2', SESSION_CALL);
      await ctx.sched.finish('S1');
      launchAll(ctx.sched, 'gap', { X: { key: key('gp2') } });
      await ctx.sched.until('X', SESSION_CALL);
      const s2 = await ctx.sched.finish('S2');
      const x = await ctx.sched.finish('X');
      assert.equal(x.status, 200);
      assert.equal(await balanceOf(d, 'gap'), 100);
      assert.deepEqual(await freeRows(d, 'gap'), [{ kind: 'first_full_mock:english', reference: x.body.id }]);
      if (version === 'own') {
        assert.deepEqual([s2.status, s2.body.error, s2.body.detail?.requote], [409, 'FIRST_FULL_MOCK_TAKEN', true]);
        assert.deepEqual(await sessions(d, 'gap'), [{ id: x.body.id }], 'one free session');
      } else {
        // The gap this migration closes: with the old function S2's session is free with no row (open until it is applied).
        assert.equal(s2.status, 200);
        assert.equal((await sessions(d, 'gap')).length, 2);
      }
    } finally { await d.close(); }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The new start_learning_session itself (supabase/migrations/20261116130000_start_learning_session_own_allowance.sql)
// ---------------------------------------------------------------------------------------------------------------------
const SIG = 'public.start_learning_session(jsonb,text,text,text)';
const bodyMd5 = async (d) => (await one(d, `select md5(replace(prosrc, chr(13), '')) h from pg_proc where oid = to_regprocedure('${SIG}')`))?.h ?? null;

test('the new start_learning_session (NOT applied): guarded on the live body, same signature, invoker, search_path and grants, idempotent; the undo puts the original back', async () => {
  const sql = file(OWN_PATH);
  const undo = file(OWN_UNDO_PATH);
  assert.match(sql, /^-- NOT APPLIED\./);
  const d = await database();
  try {
    const original = await bodyMd5(d);
    assert.equal(original, '4c0c17b29dcc4477badd27c9a44db2da', 'the body 20261002120000_connected_learning.sql makes');
    await d.exec(sql);
    const own = await bodyMd5(d);
    assert.notEqual(own, original);
    assert.match(sql, new RegExp(`'${original}', '${own}'`), 'the guard knows the original and its own body');
    assert.match(undo, new RegExp(`'${own}', '${original}'`));
    await d.exec(sql); // a second apply is harmless
    const shape = () => one(d, `select prosecdef, proconfig, pg_get_function_arguments(oid) args, pg_get_function_result(oid) res from pg_proc where oid = to_regprocedure('${SIG}')`);
    const SHAPE = { prosecdef: false, proconfig: ['search_path=""'], args: 'p_row jsonb, p_credit_action text, p_quota_kind text, p_period text', res: 'jsonb' };
    assert.deepEqual(await shape(), SHAPE, 'security invoker as before, search_path empty, the same arguments and result');
    await d.exec('create role nobody');
    const may = async (role) => (await one(d, `select has_function_privilege('${role}', '${SIG}', 'execute') ok`)).ok;
    for (const role of ['nobody', 'anon', 'authenticated']) assert.equal(await may(role), false, `${role} cannot run it`);
    assert.equal(await may('service_role'), true);
    await d.exec(undo);
    assert.equal(await bodyMd5(d), original, 'the undo restores the original body exactly');
    assert.deepEqual(await shape(), SHAPE);
    for (const role of ['nobody', 'anon', 'authenticated']) assert.equal(await may(role), false);
    assert.equal(await may('service_role'), true);
    await d.exec(undo); // twice is harmless
    assert.equal(await bodyMd5(d), original);
    // A live body this was not written against: both refuse, and change nothing (one statement each).
    await d.exec(`create or replace function ${SIG.replace('(jsonb,text,text,text)', '(p_row jsonb,p_credit_action text,p_quota_kind text,p_period text)')} returns jsonb language plpgsql security invoker set search_path='' as $$ begin return null; end $$`);
    const edited = await bodyMd5(d);
    await assert.rejects(d.exec(sql), /not the version this migration replaces/);
    await assert.rejects(d.exec(undo), /neither the migration's version nor the original/);
    assert.equal(await bodyMd5(d), edited, 'left as it was');
    await d.exec(`drop function ${SIG}`);
    await assert.rejects(d.exec(sql), /is not there/);
    assert.equal(await bodyMd5(d), null, 'and never created from nothing');
  } finally { await d.close(); }
});

test('the new function: the row is found or taken with the session; a row held by another session refuses a free start and charges a paid one; other allowances unchanged', async () => {
  const d = await database({ start: 'own' });
  try {
    await student(d, 'fn', { balance: 100 });
    const now = Date.now();
    const row = (id, requestKey) => ({ id, user_id: 'fn', request_key: requestKey, subject: 'english', mode: 'full', state: 'active',
      questions: [{ id: `${id}_q1`, familyId: `${id}_f1` }], selection_meta: {}, created_at: new Date(now).toISOString(), expires_at: new Date(now + 3600000).toISOString() });
    const call = (r, credit, quota, period) => one(d, 'select public.start_learning_session($1::jsonb, $2, $3, $4) r', [JSON.stringify(r), credit, quota, period]).then((x) => x.r);
    const allowance = (kind, period) => rows(d, 'select reference from learning_allowances where user_id=$1 and kind=$2 and period=$3', ['fn', kind, period]);
    const FREE = 'first_full_mock:english';
    // No row: taken for this session in the same transaction.
    assert.equal((await call(row('s1', 'k1'), null, FREE, 'ever')).id, 's1');
    assert.deepEqual(await allowance(FREE, 'ever'), [{ reference: 's1' }]);
    // A row this session already holds (taken before the call): its own, free.
    await rows(d, "insert into learning_allowances(user_id,kind,period,reference) values('fn','first_full_mock:accountancy','ever','s2')");
    assert.equal((await call({ ...row('s2', 'k2'), subject: 'accountancy' }, null, 'first_full_mock:accountancy', 'ever')).id, 's2');
    assert.equal(await balanceOf(d, 'fn'), 100);
    // Held by another session, nothing to charge: refused, nothing written.
    await assert.rejects(call(row('s3', 'k3'), null, FREE, 'ever'), /allowance taken/);
    assert.deepEqual((await sessions(d, 'fn')).map((s) => s.id), ['s1', 's2']);
    assert.deepEqual(await rows(d, "select question_id from learning_question_exposure where reference='s3'"), []);
    assert.deepEqual(await allowance(FREE, 'ever'), [{ reference: 's1' }]);
    // Held by another session, with an action: charged, as before.
    assert.equal((await call(row('s4', 'k4'), 'attempt_full', FREE, 'ever')).id, 's4');
    assert.equal(await balanceOf(d, 'fn'), 50);
    // A replay returns the session and writes nothing.
    assert.equal((await call(row('s4', 'k4'), 'attempt_full', FREE, 'ever')).id, 's4');
    assert.equal(await balanceOf(d, 'fn'), 50);
    // The daily allowance, as the old function did it: free once, then charged.
    await rows(d, "update users set credit_balance=100 where id='fn'");
    const day = '2026-11-16';
    await call({ ...row('d1', 'kd1'), mode: 'quick' }, 'attempt_10', 'daily_practice', day);
    assert.equal(await balanceOf(d, 'fn'), 100, 'the first daily set is free');
    await call({ ...row('d2', 'kd2'), mode: 'quick' }, 'attempt_10', 'daily_practice', day);
    assert.equal(await balanceOf(d, 'fn'), 90, 'the second is charged');
    assert.deepEqual(await allowance('daily_practice', day), [{ reference: 'd1' }]);
  } finally { await d.close(); }
});

test('the switch off (LEARNING_SESSIONS_ENABLED unset): the device-held start is unchanged with the new function in the database', async () => {
  const called = [];
  const d = await routes({ beforeRpc: async (name) => { called.push(name); return null; } }, { start: 'own' });
  try {
    await student(d, 'off', { balance: 30 });
    const r = await start('off', { key: key('off') });
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.storage, 'device');
    assert.deepEqual(called.filter((n) => n === RELEASE || n === SESSION_CALL), []);
    assert.equal(await balanceOf(d, 'off'), 30);
    assert.deepEqual(await freeRows(d, 'off'), [{ kind: 'first_full_mock:english', reference: r.body.id }]);
  } finally { await d.close(); }
});
