import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { canCollect, normalizeBatch, POLICY_VERSION, EVENT_NAMES } from '../../src/lib/server/usage.js';

test('migration, constraints, dedupe, purge', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon;create role authenticated;create role service_role;');
    await db.exec('create table public.users(id text primary key);');
    await db.exec("insert into public.users values('u1')");
    const sql = readFileSync(new URL('../../supabase/migrations/20261012120000_usage_consent_and_events.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql); // idempotent
    await assert.rejects(db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','minor',true,'x')"), /usage_consent_adult_only|check/);
    await assert.rejects(db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','unknown',true,'x')"), /check/);
    await db.query("insert into usage_consent(user_id,age_band,analytics_allowed,policy_version) values('u1','adult',true,'x')");
    const ins = id => db.query("insert into usage_events(event_id,user_id,name,platform,occurred_at) values($1,'u1','app_opened','android',now()) on conflict (event_id) do nothing", [id]);
    await ins('e1'); await ins('e1'); await ins('e2');
    assert.equal((await db.query('select count(*)::int n from usage_events')).rows[0].n, 2);
    await assert.rejects(db.query("insert into usage_events(event_id,user_id,name,platform,occurred_at) values('p','u1','x','ios',now())"), /check/);
    await assert.rejects(db.query("insert into usage_events(event_id,user_id,name,platform,occurred_at,props) values('big','u1','x','web',now(),$1)", [JSON.stringify({ a: 'x'.repeat(1100) })]), /check/);
    const rpc = (rows) => db.query('select insert_usage_events($1, $2::jsonb) n', ['u1', JSON.stringify(rows)]);
    const row = id => ({ event_id: id, name: 'app_opened', platform: 'android', app_version: '1', occurred_at: new Date().toISOString(), props: { screen: 'home' } });
    await db.exec("delete from usage_events");
    assert.equal(Number((await rpc([row('r1'), row('r2')])).rows[0].n), 2);
    assert.equal(Number((await rpc([row('r1')])).rows[0].n), 0);
    await db.exec("update usage_consent set analytics_allowed=false, withdrawn_at=now() where user_id='u1'");
    assert.equal(Number((await rpc([row('r3')])).rows[0].n), 0);
    await db.exec("update usage_consent set analytics_allowed=true, withdrawn_at=null where user_id='u1'");
    await db.exec("delete from usage_events");
    await ins('e1'); await ins('e2');
    await db.exec("update usage_events set received_at = now() - interval '200 days' where event_id='e1'");
    assert.equal(Number((await db.query('select purge_usage_events() n')).rows[0].n), 1);
    assert.equal((await db.query('select count(*)::int n from usage_events')).rows[0].n, 1);
    await db.exec("delete from public.users where id='u1'");
    assert.equal((await db.query('select count(*)::int n from usage_events')).rows[0].n, 0);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from usage_events'), /permission denied/);
  } finally { await db.close(); }
});

const NOW = Date.UTC(2026, 9, 12, 12);
const ev = (o = {}) => ({ event_id: 'a1', name: 'app_opened', platform: 'android', occurred_at: new Date(NOW - 1000).toISOString(), props: { screen: 'home', minutes: 3 }, ...o });

test('canCollect', () => {
  assert.equal(POLICY_VERSION, '2026-10-12');
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'adult', withdrawn_at: null }), true);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'minor' }), false);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'unknown' }), false);
  assert.equal(canCollect({ analytics_allowed: true, age_band: 'adult', withdrawn_at: '2026-10-01' }), false);
  assert.equal(canCollect({ analytics_allowed: false, age_band: 'adult' }), false);
  assert.equal(canCollect(null), false);
  assert.equal(EVENT_NAMES.size, 19);
});

test('normalizeBatch edge cases', () => {
  const r = normalizeBatch([ev(), ev(), ev({ event_id: 'b' })], 'u1', NOW);
  assert.equal(r.rows.length, 2); assert.equal(r.dropped, 1);
  const bad = [
    ev({ event_id: undefined }), ev({ name: 'free_text_click' }), ev({ platform: 'ios' }),
    ev({ occurred_at: new Date(NOW + 6 * 60000).toISOString() }),
    ev({ occurred_at: new Date(NOW - 8 * 86400000).toISOString() }),
    ev({ props: { email: 'a@b.c' } }), ev({ props: { subject: 'x'.repeat(65) } }),
    ev({ props: { minutes: '3' } }), ev({ props: { subject: { a: 1 } } }), ev({ occurred_at: 'nope' }),
  ].map((e, i) => (e.event_id === undefined ? e : { ...e, event_id: 'x' + i }));
  const out = normalizeBatch(bad, 'u1', NOW);
  assert.equal(out.rows.length, 0); assert.equal(out.dropped, bad.length);
  assert.ok(normalizeBatch(Array.from({ length: 51 }, (_, i) => ev({ event_id: 'k' + i })), 'u1', NOW).error);
  assert.equal(normalizeBatch(Array.from({ length: 50 }, (_, i) => ev({ event_id: 'k' + i })), 'u1', NOW).rows.length, 50);
  assert.ok(normalizeBatch('x', 'u1').error);
  assert.equal(normalizeBatch([ev({ occurred_at: new Date(NOW + 4 * 60000).toISOString() })], 'u1', NOW).rows.length, 1);
});
