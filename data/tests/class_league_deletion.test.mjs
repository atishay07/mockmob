// Account deletion and class leagues, on PGlite with the real deletion processor (supabase/migrations/20261013120000) and the
// real class migration (20261116150000): the steps in src/lib/server/accountDeletion.js delete a student's memberships, close
// a class they started with no record of who started it, never touch a stored weekly figure, and on a database without the
// class tables (production until the owner applies the SQL) skip both steps without reading them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { DELETION_STEPS, executeDeletion, planDeletion } from '../../src/lib/server/accountDeletion.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const PREFS = read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql');
const PROCESSOR = read('supabase/migrations/20261013120000_deletion_processor.sql');
const CLASSES = read('supabase/migrations/20261116150000_class_leagues.sql');
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

async function setup({ classes = true } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.users (id text primary key, name text not null, email text unique, username text unique,
      image text, subjects jsonb not null default '[]'::jsonb, role text not null default 'student', last_active_at timestamptz);
    insert into public.users (id, name, email, username) values ('u1', 'Asha', 'a@example.com', 'asha'), ('u2', 'Bo', 'b@example.com', 'bo'), ('u3', 'Cy', 'c@example.com', 'cy');
  `);
  await db.exec(PREFS);
  await db.exec(PROCESSOR);
  if (classes) {
    await db.exec(CLASSES);
    await db.exec(`
      insert into public.class_leagues (id, code, name, subjects, created_by) values (${`'${A}'`}, 'K7P2M9', 'XII-C Commerce', '{accountancy}', 'u1'),
        (${`'${B}'`}, 'K7P2M8', 'Batch B', '{accountancy}', 'u2');
      insert into public.class_league_members (league_id, user_id) values (${`'${A}'`}, 'u1'), (${`'${A}'`}, 'u3'), (${`'${B}'`}, 'u2');
      insert into public.class_league_weeks (league_id, week, subject, sat, average) values (${`'${A}'`}, '2026-11-22', 'accountancy', 31, 142);
    `);
  }
  await db.exec(`insert into account_deletion_requests (user_id, requested_at, source) values ('u1', now() - interval '2 days', 'web')`);
  return db;
}

const adapter = (db) => ({
  async listPendingRequests() { return (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where status='pending'")).rows; },
  async getUser(id) { return (await db.query('select id, email from users where id=$1', [id])).rows[0] || null; },
  async run(request, steps, apply) {
    return (await db.query('select public.account_deletion_run($1::bigint, $2, $3::jsonb, $4) as r', [request.id, request.user_id, JSON.stringify(steps), !!apply])).rows[0].r;
  },
  authLog: [],
});
const req = async (db) => (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where user_id='u1'")).rows[0];

test('the steps are listed: memberships deleted, a started class anonymised and closed, children before users', () => {
  const tables = DELETION_STEPS.map((s) => s.table);
  const members = DELETION_STEPS.find((s) => s.table === 'class_league_members');
  const leagues = DELETION_STEPS.find((s) => s.table === 'class_leagues');
  assert.equal(members.action, 'delete');
  assert.deepEqual(members.match, [{ column: 'user_id' }]);
  assert.equal(leagues.action, 'anonymise');
  assert.deepEqual(leagues.match, [{ column: 'created_by' }]);
  assert.deepEqual(leagues.set, [{ column: 'created_by', value: 'null' }, { column: 'closed_at', value: 'now' }]);
  assert.ok(tables.indexOf('class_league_members') < tables.indexOf('users') && tables.indexOf('class_leagues') < tables.indexOf('users'));
  assert.equal(tables.includes('class_league_weeks'), false, 'the stored figures hold no user');
});

test('without the class tables (production before the SQL) both steps are skipped and the deletion completes', async () => {
  const db = await setup({ classes: false });
  try {
    const plan = await planDeletion(adapter(db), await req(db));
    for (const t of ['class_league_members', 'class_leagues']) assert.equal(plan.steps.find((s) => s.table === t).present, false, `${t} absent`);
    assert.equal(plan.blocked, false);
    await executeDeletion({ adapter: adapter(db), request: await req(db), deleteAuthUser: async () => ({ deleted: true, ids: [] }) });
    assert.equal((await db.query("select status from account_deletion_requests where user_id='u1'")).rows[0].status, 'completed');
  } finally { await db.close(); }
});

test('with them: the student\'s memberships go, their class closes with no creator, others and the stored figure stay', async () => {
  const db = await setup();
  try {
    const plan = await planDeletion(adapter(db), await req(db));
    assert.equal(plan.blocked, false, 'class_league_members is classified, so it does not block');
    assert.equal(plan.steps.find((s) => s.table === 'class_league_members').rows, 1);
    assert.equal(plan.steps.find((s) => s.table === 'class_leagues').rows, 1);
    await executeDeletion({ adapter: adapter(db), request: await req(db), deleteAuthUser: async () => ({ deleted: true, ids: [] }) });
    assert.equal(Number((await db.query("select count(*) n from class_league_members where user_id = 'u1'")).rows[0].n), 0);
    const a = (await db.query(`select created_by, closed_at from class_leagues where id = '${A}'`)).rows[0];
    assert.equal(a.created_by, null);
    assert.notEqual(a.closed_at, null, 'the class closes by itself');
    const b = (await db.query(`select created_by, closed_at from class_leagues where id = '${B}'`)).rows[0];
    assert.deepEqual([b.created_by, b.closed_at], ['u2', null], 'another student\'s class is untouched');
    assert.equal(Number((await db.query("select count(*) n from class_league_members where user_id in ('u2','u3')")).rows[0].n), 2);
    assert.deepEqual((await db.query('select sat, average from class_league_weeks')).rows, [{ sat: 31, average: 142 }], 'the stored figure is as seen');
  } finally { await db.close(); }
});
