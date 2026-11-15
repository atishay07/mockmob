// Security fixes of 15 Nov 2026 (audit tmp/1115-prod/sec-social.md, lane SF-B) on a real Postgres (PGlite): the Mob
// migrations as production has them, plus the database limiter table (20261002121000_runtime_ai_guard) the fixes use.
//   S1  a member the owner removed cannot come back by any link that existed then; a fresh link lets them back in.
// Run: node --test data/tests/mob_sec_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pinDbClock } from './helpers/pgliteClock.mjs';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MobError } from '../../src/lib/mob/model.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
import { KEEP_OUT_MS, createKeepOut, keepOutBucket } from '../../src/lib/server/mob/keepOut.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BASE = ['20261017100000_mob.sql', '20261017190000_mob_fix_1017.sql'].map((f) => read(`supabase/migrations/${f}`)).join('\n');
const V3 = ['20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live'];
const v3Sql = V3.map((f) => read(`supabase/migrations/${f}.sql`)).join('\n');
const guard = read('supabase/migrations/20261002121000_runtime_ai_guard.sql');
const LIMITER = [guard.match(/create table public\.persistent_rate_limits[^;]+;/)[0], guard.match(/create function public\.take_rate_limit[\s\S]+?end \$\$;/)[0]].join('\n');
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Tuesday 17 Nov 2026, 1:30 PM IST.
const NOW = Date.parse('2026-11-17T08:00:00Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const STUBS = `
create schema if not exists realtime;
create table if not exists realtime.messages (id bigint generated always as identity primary key, topic text, extension text, payload jsonb, event text, private boolean);
alter table realtime.messages enable row level security;
create table if not exists realtime.sent (id bigint generated always as identity primary key, topic text, event text, payload jsonb);
create or replace function realtime.topic() returns text language sql stable as $$ select current_setting('rt.topic', true) $$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql as $$
  insert into realtime.sent (topic, event, payload) values (topic, event, payload) $$;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('rt.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
`;

async function database({ clock = { now: NOW }, limiter = true } = {}) {
  const db = pinDbClock(new PGlite(), clock);
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,9) g;");
  await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  if (limiter) await db.exec(LIMITER);
  await db.exec(STUBS);
  await db.exec(BASE);
  await db.exec(v3Sql);
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]?.r;
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const values = keys.map((k) => {
      const v = params[k];
      if (['p_picks', 'p_keys', 'p_days'].includes(k) && Array.isArray(v)) return `{${v.join(',')}}`;
      return v && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values)).rows[0].r;
  };
}

const BANK = Array.from({ length: 40 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, chapter: 'Goodwill', explanation: `EXPLAIN-q${i + 1}`,
  options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })),
}));
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function serviceFor(db, { clock = { now: NOW }, v3 = true, ...over } = {}) {
  let seed = 1;
  return createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (s === 'accountancy' ? { ok: true, id: s, name: 'Accountancy' } : { ok: false }),
    loadUser: async () => ({ subjects: ['accountancy'], isPremium: false }),
    validChapter: (_s, c) => c === 'Goodwill',
    pickQuestionIds: async (_s, { count = 10, key = null, exclude = [] } = {}) => {
      const start = key ? hash(key) % 30 : 0;
      const skip = new Set(exclude);
      return Array.from({ length: 40 }, (_, i) => BANK[(start + i) % 40].id).filter((id) => !skip.has(id)).slice(0, count);
    },
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async () => null, findAttempts: async () => [],
    startPractice: async (_u, input, server) => ({ id: `practice_${input.generationKey.slice(4, 12)}`, questions: server.mobPaper.questions }),
    v3Enabled: () => v3, billingOn: () => false, liveEnabled: () => false,
    ...over,
  });
}
const code = (c) => (e) => { assert.ok(e instanceof MobError, String(e)); assert.equal(e.code, c); return true; };
const names = async (svc, u, mob) => (await svc.view(u, { mobId: mob })).mob.members.map((m) => m.name).sort();
const memberOf = (mob, u) => memberIdFor('test-secret', mob, u);

// Riya (u1) owns the Mob; Asha (u2) and the Stranger (u3) join by one link, the way a class-group link spreads.
async function classLink(svc) {
  const mob = (await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 })).mob.id;
  const link = await svc.invite('u1', { mob });
  await svc.join('u2', { code: link.code, name: 'Asha', colour: 1 });
  await svc.join('u3', { code: link.code, name: 'Stranger', colour: 2 });
  return { mob, link };
}

// ---------------------------------------------------------------------------------------------------------------
// S1: removed means removed
// ---------------------------------------------------------------------------------------------------------------

test('S1 a removed member cannot rejoin by the old link (nor preview it), while others still join by it', async () => {
  const db = await database();
  try {
    const svc = serviceFor(db);
    const { mob, link } = await classLink(svc);
    await svc.remove('u1', { mob, memberId: memberOf(mob, 'u3') });
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya']);
    // The audit's repro: the same link posted again.
    await assert.rejects(svc.join('u3', { code: link.code, name: 'Stranger', colour: 2 }), code('INVITE_INVALID'));
    await assert.rejects(svc.join('u3', { code: link.code.toLowerCase(), name: 'Someone Else', colour: 5 }), code('INVITE_INVALID'), 'under any name');
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya'], 'still out');
    // Signed in, their preview of the old link reads like a bad code; the public preview is unchanged for everyone else.
    await assert.rejects(svc.lookup(link.code, { viewerId: 'u3' }), code('INVITE_INVALID'));
    assert.equal((await svc.lookup(link.code)).status, 'valid');
    assert.equal((await svc.lookup(link.code, { viewerId: 'u4' })).status, 'valid');
    // A friend with the same link still gets in.
    await svc.join('u4', { code: link.code, name: 'Kabir', colour: 3 });
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Kabir', 'Riya']);
    // No user id is stored for the mark: one HMAC-keyed limiter bucket, kept a day past the link's 7 days.
    const rows = (await db.query('select bucket, reset_at from persistent_rate_limits')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].bucket, keepOutBucket('test-secret', link.code, 'u3'));
    assert.doesNotMatch(rows[0].bucket, /u3|Stranger/);
    assert.equal(Date.parse(rows[0].reset_at), NOW + KEEP_OUT_MS);
    assert.ok(KEEP_OUT_MS >= 7 * DAY + DAY && KEEP_OUT_MS < 2_147_483_647);
  } finally { await db.close(); }
});

test('S1 the owner inviting them again with a fresh link lets them back in; an old 8-character link is covered too', async () => {
  const db = await database();
  try {
    const svc = serviceFor(db);
    const { mob, link } = await classLink(svc);
    await svc.remove('u1', { mob, memberId: memberOf(mob, 'u3') });
    const fresh = await svc.invite('u1', { mob });
    assert.notEqual(fresh.code, link.code);
    await svc.join('u3', { code: fresh.code, name: 'Stranger', colour: 2 });
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya', 'Stranger']);
    // Removed again: the second link is now one that existed at the removal.
    await svc.remove('u1', { mob, memberId: memberOf(mob, 'u3') });
    await assert.rejects(svc.join('u3', { code: fresh.code, name: 'Stranger', colour: 2 }), code('INVITE_INVALID'));
    // A Mob still on an old 8-character link (made before v3): the same rule.
    const old = serviceFor(db, { v3: false });
    const m2 = (await old.create('u5', { subject: 'accountancy', name: 'Meera', colour: 0 })).mob.id;
    const l8 = await old.invite('u5', { mob: m2 });
    assert.match(l8.code, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    await old.join('u6', { code: l8.code, name: 'Isha', colour: 1 });
    await old.remove('u5', { mob: m2, memberId: memberOf(m2, 'u6') });
    await assert.rejects(svc.join('u6', { code: l8.code, name: 'Isha', colour: 1 }), code('INVITE_INVALID'));
  } finally { await db.close(); }
});

test('S1 only the owner\'s removal marks: a member cannot mark anyone, removing yourself is refused, leaving is not removal', async () => {
  const db = await database();
  try {
    const svc = serviceFor(db);
    const { mob, link } = await classLink(svc);
    await assert.rejects(svc.remove('u2', { mob, memberId: memberOf(mob, 'u3') }), code('NOT_OWNER'));
    await assert.rejects(svc.remove('u1', { mob, memberId: memberOf(mob, 'u1') }), code('NOT_FOUND'));
    assert.equal(await one(db, 'select count(*)::int r from persistent_rate_limits'), 0, 'nothing marked');
    // Someone who leaves on their own can come back by the link.
    await svc.leave('u3', { mob });
    await svc.join('u3', { code: link.code, name: 'Stranger', colour: 2 });
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya', 'Stranger']);
  } finally { await db.close(); }
});

test('S1 the moderator\'s Remove (the /moderation list) keeps the member out the same way', async () => {
  const db = await database();
  try {
    const svc = serviceFor(db);
    const { mob, link } = await classLink(svc);
    assert.equal(await svc.removeByModerator(mob, 'u3'), 'removed');
    await assert.rejects(svc.join('u3', { code: link.code, name: 'Stranger', colour: 2 }), code('INVITE_INVALID'));
    assert.equal(await svc.removeByModerator(mob, 'u3'), 'not_found', 'already out');
    assert.equal(await svc.removeByModerator('not-a-mob', 'u3'), 'not_found');
    // deps.js routes the moderation Remove through this method.
    assert.match(read('src/lib/server/mob/deps.js'), /removeByModerator\(row\.mob_id, row\.reported_id\)/);
    assert.doesNotMatch(read('src/lib/server/mob/deps.js'), /rpc\('mob_remove'/);
  } finally { await db.close(); }
});

test('S1 a join that raced the removal (checked before the mark, joined after it) is undone', async () => {
  const db = await database();
  try {
    const real = createKeepOut({ rpc: pgRpc(db), secret: 'test-secret' });
    // The first read for u3 answers as it would have just before the owner's mark landed.
    let stale = 1;
    const keepOut = { mark: real.mark, has: async (c, u) => (u === 'u3' && stale-- > 0 ? false : real.has(c, u)) };
    const svc = serviceFor(db, { keepOut });
    const { mob, link } = await classLink(svc);
    stale = 1;
    await svc.remove('u1', { mob, memberId: memberOf(mob, 'u3') });
    await assert.rejects(svc.join('u3', { code: link.code, name: 'Stranger', colour: 2 }), code('INVITE_INVALID'));
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya'], 'taken straight back out');
  } finally { await db.close(); }
});

test('S1 a mark that cannot be read refuses the join (UNAVAILABLE); a database without the limiter table is no mark', async () => {
  const db = await database();
  try {
    const down = { mark: async () => {}, has: async () => { throw Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }); } };
    const svc = serviceFor(db);
    const { mob, link } = await classLink(svc);
    const broken = serviceFor(db, { keepOut: down });
    await assert.rejects(broken.join('u4', { code: link.code, name: 'Kabir', colour: 3 }), code('UNAVAILABLE'));
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya', 'Stranger'], 'nothing written');
  } finally { await db.close(); }
  // An environment that never had the limiter table: joining works as before (the mark has nowhere to live).
  const bare = await database({ limiter: false });
  try {
    const svc = serviceFor(bare);
    const { mob } = await classLink(svc);
    await svc.remove('u1', { mob, memberId: memberOf(mob, 'u3') });
    assert.deepEqual(await names(svc, 'u1', mob), ['Asha', 'Riya']);
  } finally { await bare.close(); }
});
