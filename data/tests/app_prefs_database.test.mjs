import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20261012121000_app_preferences_and_rhythm.sql', import.meta.url), 'utf8');

const historyMigration = readFileSync(new URL('../../supabase/migrations/20261013090000_study_goal_history.sql', import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec('create table public.users (id text primary key, name text not null default \'x\');');
  await db.exec("insert into public.users(id) values ('u1'),('u2');");
  await db.exec(migration);
  await db.exec(historyMigration);
  return db;
}

test('migration applies twice and defaults match the product choices', async () => {
  const db = await setup();
  try {
    await db.exec(migration); // idempotent
    await db.exec("insert into notification_prefs(user_id) values ('u1'); insert into study_goals(user_id) values ('u1');");
    const p = (await db.query("select timezone, quiet_start::text qs, quiet_end::text qe, weekly_cap, channels from notification_prefs")).rows[0];
    assert.equal(p.timezone, 'Asia/Kolkata');
    assert.equal(p.qs, '23:00:00');
    assert.equal(p.qe, '07:00:00');
    assert.equal(p.weekly_cap, 5);
    assert.deepEqual(p.channels, { check_due: true, weekly_plan: true, study_window: false, result_ready: true });
    const g = (await db.query('select days_per_week, timezone, paused_until from study_goals')).rows[0];
    assert.equal(g.days_per_week, 4);
    assert.equal(g.timezone, 'Asia/Kolkata');
    assert.equal(g.paused_until, null);
  } finally { await db.close(); }
});

test('constraints reject out-of-range values', async () => {
  const db = await setup();
  try {
    await assert.rejects(db.exec("insert into notification_prefs(user_id, weekly_cap) values ('u1', 15)"), /check/i);
    await assert.rejects(db.exec("insert into notification_prefs(user_id, weekly_cap) values ('u1', -1)"), /check/i);
    await assert.rejects(db.exec("insert into study_goals(user_id, days_per_week) values ('u1', 0)"), /check/i);
    await assert.rejects(db.exec("insert into study_goals(user_id, days_per_week) values ('u1', 8)"), /check/i);
    await assert.rejects(db.exec("insert into push_devices(user_id, platform, token) values ('u1', 'ios', 't')"), /check/i);
    await assert.rejects(db.exec("insert into account_deletion_requests(user_id, source) values ('u1', 'sms')"), /check/i);
    await assert.rejects(db.exec("insert into account_deletion_requests(user_id, status) values ('u1', 'done')"), /check/i);
    await assert.rejects(db.exec("insert into study_goals(user_id) values ('nobody')"), /foreign key/i);
  } finally { await db.close(); }
});

test('device token is unique and can be reassigned to the current user', async () => {
  const db = await setup();
  try {
    const upsert = (user, token) => db.query(
      `insert into push_devices(user_id, platform, token, app_version) values ($1,'android',$2,'1.0')
       on conflict (token) do update set user_id=excluded.user_id, app_version=excluded.app_version, last_seen_at=now(), revoked_at=null`, [user, token]);
    await upsert('u1', 'tok-aaaaaaaaaaaaaaaaaaaa');
    await assert.rejects(db.query("insert into push_devices(user_id, token) values ('u2','tok-aaaaaaaaaaaaaaaaaaaa')"), /unique|duplicate/i);
    await db.query("update push_devices set revoked_at = now() where token = 'tok-aaaaaaaaaaaaaaaaaaaa'");
    await upsert('u2', 'tok-aaaaaaaaaaaaaaaaaaaa');
    const rows = (await db.query('select user_id, revoked_at from push_devices')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, 'u2');
    assert.equal(rows[0].revoked_at, null);
  } finally { await db.close(); }
});

test('one pending deletion request per user; completed ones do not block a new request', async () => {
  const db = await setup();
  try {
    await db.exec("insert into account_deletion_requests(user_id, source) values ('u1','android')");
    await assert.rejects(db.exec("insert into account_deletion_requests(user_id, source) values ('u1','web')"), /unique|duplicate/i);
    await db.exec("insert into account_deletion_requests(user_id) values ('u2')"); // other users are independent
    await db.exec("update account_deletion_requests set status='cancelled' where user_id='u1'");
    await db.exec("insert into account_deletion_requests(user_id) values ('u1')");
    assert.equal((await db.query("select count(*)::int n from account_deletion_requests where user_id='u1'")).rows[0].n, 2);
  } finally { await db.close(); }
});

test('tables are service-role only: RLS on, client roles have no access', async () => {
  const db = await setup();
  try {
    const rls = (await db.query("select relname, relrowsecurity from pg_class where relname in ('notification_prefs','push_devices','study_goals','account_deletion_requests')")).rows;
    assert.equal(rls.length, 4);
    assert.ok(rls.every(r => r.relrowsecurity));
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from push_devices'), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from account_deletion_requests'), /permission denied/);
    await db.exec('reset role; set role service_role');
    await db.exec("insert into push_devices(user_id, token) values ('u1','svc-token-aaaaaaaaaaaa')");
  } finally { await db.close(); }
});

test('goal history: applies twice, backfills existing goals, enforces Monday and range, keyed by week', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec("create table public.users (id text primary key, name text not null default 'x'); insert into public.users(id) values ('u1'),('u2');");
    await db.exec(migration);
    await db.exec("insert into study_goals(user_id, days_per_week) values ('u1', 6);"); // legacy goal before history existed
    await db.exec(historyMigration);
    await db.exec(historyMigration); // idempotent, backfill does not duplicate
    const rows = (await db.query('select user_id, effective_week::text w, days_per_week d from study_goal_history')).rows;
    assert.deepEqual(rows, [{ user_id: 'u1', w: '2000-01-03', d: 6 }]);
    await db.exec("insert into study_goal_history(user_id, effective_week, days_per_week) values ('u1','2026-10-12',3)");
    await assert.rejects(db.exec("insert into study_goal_history(user_id, effective_week, days_per_week) values ('u1','2026-10-13',3)"), /check/i); // Tuesday
    await assert.rejects(db.exec("insert into study_goal_history(user_id, effective_week, days_per_week) values ('u1','2026-10-19',8)"), /check/i);
    await assert.rejects(db.exec("insert into study_goal_history(user_id, effective_week, days_per_week) values ('u1','2026-10-12',2)"), /unique|duplicate/i);
    await db.exec("insert into study_goal_history(user_id, effective_week, days_per_week) values ('u1','2026-10-12',2) on conflict (user_id, effective_week) do update set days_per_week = excluded.days_per_week");
    assert.equal((await db.query("select days_per_week d from study_goal_history where effective_week='2026-10-12'")).rows[0].d, 2);
    await assert.rejects(db.exec("insert into study_goal_history(user_id, effective_week, days_per_week) values ('nobody','2026-10-12',2)"), /foreign key/i);
    assert.ok((await db.query("select relrowsecurity r from pg_class where relname='study_goal_history'")).rows[0].r);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from study_goal_history'), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query('select count(*)::int n from study_goal_history')).rows[0].n, 2);
    await db.exec('reset role');
    await db.exec("delete from public.users where id = 'u1'");
    assert.equal((await db.query('select count(*)::int n from study_goal_history')).rows[0].n, 0); // cascade
  } finally { await db.close(); }
});
