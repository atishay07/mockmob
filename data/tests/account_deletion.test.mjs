import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  DELETION_STEPS, checkRunGuards, executeDeletion, formatPlan, parseGraceDays, planDeletion, processRequests, selectDueRequests,
} from '../../src/lib/server/accountDeletion.js';

const prefs = readFileSync(new URL('../../supabase/migrations/20261012121000_app_preferences_and_rhythm.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase/migrations/20261013120000_deletion_processor.sql', import.meta.url), 'utf8');

// Minimal fixture of the real schema: same names, same FK shapes (several without ON DELETE CASCADE).
const FIXTURE = `
create role anon; create role authenticated; create role service_role bypassrls;
create table public.users (id text primary key, name text not null, email text unique, username text unique,
  image text, subjects jsonb not null default '[]'::jsonb, role text not null default 'student',
  last_active_at timestamptz, credit_balance int not null default 100);
create table public.attempts (id text primary key, user_id text not null references public.users(id) on delete cascade, score int);
create table public.attempt_score_revisions (id bigint generated always as identity primary key, attempt_id text not null references public.attempts(id));
create table public.recovery_sessions (id text primary key, user_id text not null references public.users(id));
create table public.recovery_review_queue (user_id text not null references public.users(id), question_id text not null,
  attempt_id text not null references public.attempts(id), primary key (user_id, question_id, attempt_id));
create table public.study_runs (id text primary key, user_id text not null references public.users(id));
create table public.study_events (id bigint generated always as identity primary key, run_id text not null references public.study_runs(id), user_id text not null references public.users(id));
create table public.question_bookmarks (id bigint generated always as identity primary key, user_id text not null references public.users(id) on delete cascade, question_id text not null);
create table public.payments (id text primary key, user_id text not null references public.users(id) on delete cascade, amount int not null,
  raw_order jsonb not null default '{}', raw_payment jsonb not null default '{}', raw_subscription jsonb not null default '{}');
create table public.credit_transactions (id bigint generated always as identity primary key, user_id text not null references public.users(id) on delete cascade, amount int not null);
create table public.creators (id text primary key, user_id text references public.users(id) on delete set null, name text not null, email text, code text not null, notes text);
create table public.audit_logs (id bigserial primary key, actor_id text, actor_email text, ip_address text, action text not null, metadata jsonb not null default '{}');
create table public.questions (id text primary key, uploaded_by text, author_id text, question text not null);
`;

async function setup({ extra = '' } = {}) {
  const db = new PGlite();
  await db.exec(FIXTURE);
  await db.exec(prefs); // account_deletion_requests, push_devices, notification_prefs, study_goals
  await db.exec(migration);
  await db.exec(migration); // idempotent
  await db.exec(`
    insert into users (id, name, email, username) values
      ('u1','Asha Rao','asha@example.com','asha'), ('u2','Bo Lee','bo@example.com','bo');
    insert into attempts values ('a1','u1',70),('a2','u1',80),('a3','u2',50);
    insert into attempt_score_revisions (attempt_id) values ('a1'),('a2'),('a3');
    insert into recovery_sessions values ('r1','u1'),('r2','u2');
    insert into recovery_review_queue values ('u1','q1','a1'),('u2','q1','a3');
    insert into study_runs values ('s1','u1'),('s2','u2');
    insert into study_events (run_id, user_id) values ('s1','u1'),('s1','u1'),('s2','u2');
    insert into question_bookmarks (user_id, question_id) values ('u1','q1'),('u2','q1');
    insert into payments values
      ('p1','u1',49900,'{"id":"order_1","amount":49900,"notes":{"email":"asha@example.com"},"receipt":"r1"}',
        '{"id":"pay_1","status":"captured","email":"asha@example.com","contact":"+911234567890","vpa":"asha@upi","card":{"last4":"1111"},"method":"upi"}','{}'),
      ('p2','u2',9900,'{}','{"email":"bo@example.com"}','{}');
    insert into credit_transactions (user_id, amount) values ('u1',100),('u1',-10),('u2',5);
    insert into creators values ('c1','u1','Asha Creator','asha@example.com','ASHA10','met at fair');
    insert into audit_logs (actor_id, actor_email, ip_address, action, metadata) values
      ('u1','asha@example.com','1.2.3.4','login','{"email":"asha@example.com"}'), ('u2','bo@example.com','5.6.7.8','login','{}');
    insert into questions values ('q1','u1',null,'Q one'),('q2',null,'u1','Q two'),('q3','u2',null,'Q three');
    insert into push_devices (user_id, token) values ('u1','tok1'),('u2','tok2');
    insert into notification_prefs (user_id) values ('u1'),('u2');
    insert into study_goals (user_id) values ('u1'),('u2');
    insert into account_deletion_requests (user_id, requested_at, source) values ('u1', now() - interval '2 days', 'android'), ('u2', now(), 'web');
    ${extra}
  `);
  return db;
}

function pgliteAdapter(db, authLog = []) {
  return {
    async listPendingRequests() { return (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where status='pending'")).rows; },
    async getUser(id) { return (await db.query('select id, email from users where id=$1', [id])).rows[0] || null; },
    async run(request, steps, apply) {
      const r = await db.query('select public.account_deletion_run($1::bigint, $2, $3::jsonb, $4) as r', [request.id, request.user_id, JSON.stringify(steps), !!apply]);
      return r.rows[0].r;
    },
    authLog,
  };
}

const count = async (db, sql) => Number((await db.query(sql)).rows[0].n);
const request = async (db, user) => (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where user_id=$1", [user])).rows[0];

test('dry run plans every table with counts and changes nothing', async () => {
  const db = await setup();
  try {
    const adapter = pgliteAdapter(db);
    const plan = await planDeletion(adapter, await request(db, 'u1'));
    const row = (t) => plan.steps.find((s) => s.table === t);
    assert.equal(row('attempts').rows, 2);
    assert.equal(row('attempts').action, 'delete');
    assert.equal(row('attempt_score_revisions').rows, 2, 'child rows found through the parent attempt');
    assert.equal(row('study_events').rows, 2);
    assert.equal(row('payments').action, 'anonymise');
    assert.equal(row('payments').rows, 1);
    assert.equal(row('credit_transactions').action, 'keep');
    assert.equal(row('credit_transactions').rows, 2);
    assert.equal(row('questions').rows, 2, 'author_id or uploaded_by');
    assert.equal(row('users').rows, 1);
    assert.equal(row('mentor_sessions').present, false, 'absent tables are reported, not fatal');
    assert.equal(plan.blocked, false);
    assert.deepEqual(plan.totals, { delete: plan.totals.delete, anonymise: plan.totals.anonymise, keep: 2 });
    assert.match(formatPlan(plan), /attempts\s+2/);
    // nothing changed
    assert.equal(await count(db, "select count(*) n from attempts where user_id='u1'"), 2);
    assert.equal((await db.query("select name from users where id='u1'")).rows[0].name, 'Asha Rao');
    assert.equal((await request(db, 'u1')).status, 'pending');
  } finally { await db.close(); }
});

test('apply deletes personal data, keeps financial rows minimised and completes the request', async () => {
  const db = await setup();
  try {
    const adapter = pgliteAdapter(db);
    const req = await request(db, 'u1');
    const auth = [];
    const out = await executeDeletion({ adapter, request: req, deleteAuthUser: async (x) => { auth.push(x); return { deleted: true, ids: ['auth-1'] }; } });
    assert.deepEqual(auth, [{ userId: 'u1', email: 'asha@example.com' }], 'auth user resolved from the email before it is scrubbed');
    assert.equal(out.auth.deleted, true);

    // deleted, including FK chains that have no cascade
    for (const t of ['attempts', 'recovery_sessions', 'recovery_review_queue', 'study_runs', 'study_events', 'question_bookmarks', 'push_devices', 'notification_prefs', 'study_goals']) {
      assert.equal(await count(db, `select count(*) n from ${t} where user_id='u1'`), 0, t);
    }
    assert.equal(await count(db, "select count(*) n from attempt_score_revisions where attempt_id in ('a1','a2')"), 0);

    // kept, payments cut to non-personal fields
    const pay = (await db.query("select amount, raw_order, raw_payment from payments where id='p1'")).rows[0];
    assert.equal(pay.amount, 49900);
    assert.deepEqual(pay.raw_order, { id: 'order_1', amount: 49900, receipt: 'r1' });
    assert.deepEqual(pay.raw_payment, { id: 'pay_1', status: 'captured', method: 'upi' });
    assert.equal(await count(db, "select count(*) n from credit_transactions where user_id='u1'"), 2);

    // creators detached, audit trail kept without the person, questions kept without the author
    const c = (await db.query("select user_id, email, notes, name, code from creators where id='c1'")).rows[0];
    assert.deepEqual(c, { user_id: null, email: null, notes: null, name: 'Asha Creator', code: 'ASHA10' });
    const al = (await db.query("select actor_id, actor_email, ip_address, metadata from audit_logs where action='login' and actor_email is null")).rows;
    assert.equal(al.length, 1);
    assert.match(al[0].actor_id, /^deleted:/);
    assert.equal(al[0].ip_address, null);
    assert.deepEqual(al[0].metadata, {});
    assert.equal(await count(db, "select count(*) n from questions where uploaded_by is null and author_id is null and id in ('q1','q2')"), 2);

    // users row is an anonymised tombstone (payments still reference it)
    const u = (await db.query("select name, email, username, image, subjects, deleted_at from users where id='u1'")).rows[0];
    assert.equal(u.name, 'Deleted user');
    assert.match(u.email, /^deleted\+[0-9a-f]{32}@deleted\.invalid$/);
    assert.match(u.username, /^deleted_[0-9a-f]{12}$/);
    assert.equal(u.image, null);
    assert.deepEqual(u.subjects, []);
    assert.ok(u.deleted_at);

    // request completed
    const done = (await db.query("select status, completed_at from account_deletion_requests where user_id='u1'")).rows[0];
    assert.equal(done.status, 'completed');
    assert.ok(done.completed_at);
  } finally { await db.close(); }
});

test('other users are untouched', async () => {
  const db = await setup();
  try {
    await executeDeletion({ adapter: pgliteAdapter(db), request: await request(db, 'u1'), deleteAuthUser: async () => ({ deleted: false }) });
    assert.equal(await count(db, "select count(*) n from attempts where user_id='u2'"), 1);
    assert.equal(await count(db, "select count(*) n from attempt_score_revisions where attempt_id='a3'"), 1);
    assert.equal(await count(db, "select count(*) n from study_events where user_id='u2'"), 1);
    assert.equal((await db.query("select raw_payment from payments where id='p2'")).rows[0].raw_payment.email, 'bo@example.com');
    assert.equal((await db.query("select name, email from users where id='u2'")).rows[0].name, 'Bo Lee');
    assert.equal(await count(db, "select count(*) n from questions where uploaded_by='u2'"), 1);
    assert.equal((await db.query("select status from account_deletion_requests where user_id='u2'")).rows[0].status, 'pending');
  } finally { await db.close(); }
});

test('applying twice is safe: the second run is refused and changes nothing', async () => {
  const db = await setup();
  try {
    const adapter = pgliteAdapter(db);
    const req = await request(db, 'u1');
    await executeDeletion({ adapter, request: req });
    await assert.rejects(executeDeletion({ adapter, request: req }), /deletion_request_not_pending/);
  } finally { await db.close(); }
});

test('a failure rolls the whole user back and leaves the request pending', async () => {
  // study_runs is deleted after study_events; a stray child row makes the chain violate an FK mid-way.
  const db = await setup({ extra: "create table public.study_stray (run_id text references public.study_runs(id)); insert into public.study_stray values ('s1');" });
  try {
    const adapter = pgliteAdapter(db);
    const req = await request(db, 'u1');
    await assert.rejects(executeDeletion({ adapter, request: req }), /foreign key|violates/i);
    assert.equal(await count(db, "select count(*) n from attempts where user_id='u1'"), 2, 'earlier deletes were rolled back');
    assert.equal(await count(db, "select count(*) n from study_events where user_id='u1'"), 2);
    assert.equal((await db.query("select name from users where id='u1'")).rows[0].name, 'Asha Rao');
    assert.equal((await request(db, 'u1')).status, 'pending');
  } finally { await db.close(); }
});

test('unclassified tables holding user data block the plan and the apply', async () => {
  const db = await setup({ extra: "create table public.new_feature (id int, user_id text); insert into public.new_feature values (1,'u1');" });
  try {
    const adapter = pgliteAdapter(db);
    const req = await request(db, 'u1');
    const plan = await planDeletion(adapter, req);
    assert.equal(plan.blocked, true);
    assert.deepEqual(plan.unclassified, [{ table: 'new_feature', rows: 1 }]);
    assert.match(formatPlan(plan), /BLOCKED.*new_feature/);
    await assert.rejects(executeDeletion({ adapter, request: req, plan }), (e) => e.code === 'unclassified_user_data');
    // the database function refuses on its own too, even if a caller skipped the planner
    await assert.rejects(adapter.run(req, DELETION_STEPS, true), /unclassified_user_data/);
    assert.equal(await count(db, "select count(*) n from attempts where user_id='u1'"), 2);
    // another user with no rows in that table is not blocked
    assert.equal((await planDeletion(adapter, await request(db, 'u2'))).blocked, false);
  } finally { await db.close(); }
});

test('the function is service-role only', async () => {
  const db = await setup();
  try {
    const grants = (await db.query(`select r.rolname, has_function_privilege(r.rolname, 'public.account_deletion_run(bigint,text,jsonb,boolean)', 'execute') as ok
      from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`)).rows;
    assert.deepEqual(grants, [{ rolname: 'anon', ok: false }, { rolname: 'authenticated', ok: false }, { rolname: 'service_role', ok: true }]);
  } finally { await db.close(); }
});

test('every step targets a table once, deletes before parents, and users goes last', () => {
  const tables = DELETION_STEPS.map((s) => s.table);
  assert.equal(new Set(tables).size, tables.length);
  assert.equal(tables.at(-1), 'users');
  const idx = (t) => tables.indexOf(t);
  assert.ok(idx('study_events') < idx('study_runs'));
  assert.ok(idx('recovery_review_queue') < idx('attempts'));
  assert.ok(idx('attempt_score_revisions') < idx('attempts'));
  assert.ok(idx('mentor_messages') < idx('mentor_sessions'));
  assert.ok(idx('rival_battle_answers') < idx('rival_battles'));
  for (const money of ['payments', 'credit_transactions', 'ai_credit_ledger']) {
    assert.notEqual(DELETION_STEPS.find((s) => s.table === money).action, 'delete', `${money} must not be deleted`);
  }
  assert.ok(['attempts', 'question_votes', 'usage_events', 'push_devices'].every((t) => DELETION_STEPS.find((s) => s.table === t).action === 'delete'));
});

test('due requests honour the grace period and order oldest first', () => {
  const now = Date.parse('2026-10-12T00:00:00Z');
  const rows = [
    { id: 3, status: 'pending', requested_at: '2026-10-11T00:00:00Z' },
    { id: 1, status: 'pending', requested_at: '2026-09-01T00:00:00Z' },
    { id: 2, status: 'completed', requested_at: '2026-08-01T00:00:00Z' },
    { id: 4, status: 'pending', requested_at: '2026-10-12T00:00:00Z' },
  ];
  assert.deepEqual(selectDueRequests(rows, { now }).map((r) => r.id), [1, 3, 4], 'default grace 0 includes brand-new requests');
  assert.deepEqual(selectDueRequests(rows, { now, graceDays: 7 }).map((r) => r.id), [1]);
  assert.equal(parseGraceDays(undefined), 0);
  assert.equal(parseGraceDays('30'), 30);
  assert.throws(() => parseGraceDays('-1'), /Grace/);
  assert.throws(() => parseGraceDays('abc'), /Grace/);
});

test('run guards: explicit matching target, then --apply plus a dated confirmation', () => {
  const env = { MOCKMOB_STAGING_SUPABASE_URL: 'https://stg.supabase.co', MOCKMOB_PRODUCTION_SUPABASE_URL: 'https://prod.supabase.co/' };
  const now = new Date(2026, 9, 12, 10, 0, 0);
  const base = { env, now };
  assert.equal(checkRunGuards({ ...base, configuredUrl: 'https://stg.supabase.co' }).code, 'target_required');
  assert.equal(checkRunGuards({ ...base, target: 'prod', configuredUrl: 'https://stg.supabase.co' }).code, 'target_required');
  assert.equal(checkRunGuards({ ...base, target: 'staging', configuredUrl: 'https://prod.supabase.co' }).code, 'target_mismatch');
  assert.equal(checkRunGuards({ ...base, target: 'production', configuredUrl: 'https://stg.supabase.co' }).code, 'target_mismatch');
  assert.equal(checkRunGuards({ ...base, target: 'staging', configuredUrl: undefined }).code, 'url_unset');
  assert.equal(checkRunGuards({ env: {}, now, target: 'staging', configuredUrl: 'https://stg.supabase.co' }).code, 'target_url_unset');
  assert.deepEqual(checkRunGuards({ ...base, target: 'staging', configuredUrl: 'https://STG.supabase.co/' }), { ok: true, apply: false });
  assert.deepEqual(checkRunGuards({ ...base, target: 'production', configuredUrl: 'https://prod.supabase.co' }), { ok: true, apply: false });
  // apply
  const apply = { ...base, target: 'staging', configuredUrl: 'https://stg.supabase.co', apply: true };
  assert.equal(checkRunGuards(apply).code, 'confirm_required');
  assert.equal(checkRunGuards({ ...apply, env: { ...env, MOCKMOB_DELETION_CONFIRM: '2026-10-11' } }).code, 'confirm_required');
  assert.equal(checkRunGuards({ ...apply, env: { ...env, MOCKMOB_DELETION_CONFIRM: 'yes' } }).code, 'confirm_required');
  assert.deepEqual(checkRunGuards({ ...apply, env: { ...env, MOCKMOB_DELETION_CONFIRM: '2026-10-12' } }), { ok: true, apply: true });
  // a wrong target still wins over a correct confirmation
  assert.equal(checkRunGuards({ ...apply, configuredUrl: 'https://prod.supabase.co', env: { ...env, MOCKMOB_DELETION_CONFIRM: '2026-10-12' } }).code, 'target_mismatch');
});

test('an apply run aborts on the first failed request; a dry run keeps going', async () => {
  const db = await setup({ extra: "create table public.study_stray (run_id text references public.study_runs(id)); insert into public.study_stray values ('s1');" });
  try {
    const adapter = pgliteAdapter(db);
    const due = selectDueRequests(await adapter.listPendingRequests()); // u1 (older, fails) then u2
    assert.equal(due.length, 2);
    const authCalls = [];
    const deleteAuthUser = async (x) => { authCalls.push(x.userId); return { deleted: true, ids: ['a'] }; };
    const run = await processRequests({ adapter, due, apply: true, deleteAuthUser });
    assert.equal(run.aborted, true);
    assert.equal(run.failed, 1);
    assert.equal(run.skipped, 1);
    assert.deepEqual(authCalls, ['u1'], 'second user login is never touched');
    assert.equal((await request(db, 'u2')).status, 'pending');
    assert.equal(await count(db, "select count(*) n from attempts where user_id='u2'"), 1);

    const dry = await processRequests({ adapter, due, apply: false });
    assert.equal(dry.aborted, false);
    assert.equal(dry.results.length, 2);
  } finally { await db.close(); }
});
