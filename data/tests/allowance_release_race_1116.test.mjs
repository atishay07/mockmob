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

/** Production's shape (first_full_mock_1019's database()), with the release function applied unless `release` is false. */
async function database({ release = true } = {}) {
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
        if (op === 'insert') {
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
      const answer = await hooks.beforeRpc?.(name, args);
      if (answer) return answer;
      const keys = Object.keys(args);
      const values = keys.map((k) => (args[k] && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k]));
      const { rows: [r] } = await pg.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values);
      hooks.afterRpc?.(name, r.r);
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

test('a genuine failed start still gives the free row back (through the function), and the next start of that subject is the free one', async () => {
  await durable(async () => {
    let failing = true;
    const called = [];
    const d = await routes({
      beforeRpc: async (name) => {
        called.push(name);
        if (failing && name === 'start_learning_session') throw connectionReset();
        return null;
      },
    });
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
