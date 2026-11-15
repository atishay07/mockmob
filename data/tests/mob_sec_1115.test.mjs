// Security fixes of 15 Nov 2026 (audit tmp/1115-prod/sec-social.md, lane SF-B) on a real Postgres (PGlite): the Mob
// migrations as production has them, plus the database limiter table (20261002121000_runtime_ai_guard) the fixes use.
//   S1  a member the owner removed cannot come back by any link that existed then; a fresh link lets them back in.
// Run: node --test data/tests/mob_sec_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pinDbClock } from './helpers/pgliteClock.mjs';
import { randomBytes } from 'node:crypto';
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

// ---------------------------------------------------------------------------------------------------------------
// S2: 40-bit codes, and database-backed limits on the ways into a Mob
// ---------------------------------------------------------------------------------------------------------------

test('S2 new invite codes are 8 characters (40 bits) with v3 on or off', async () => {
  const db = await database();
  try {
    for (const v3 of [true, false]) {
      const svc = serviceFor(db, { v3, randomBytes: (n) => randomBytes(n) }); // a seeded draw per service would repeat codes
      const owner = v3 ? 'u1' : 'u5';
      const mob = (await svc.create(owner, { subject: 'accountancy', name: 'Riya', colour: 0 })).mob.id;
      for (let i = 0; i < 3; i += 1) assert.match((await svc.invite(owner, { mob })).code, /^[0-9A-HJKMNP-TV-Z]{8}$/, `v3 ${v3}`);
    }
  } finally { await db.close(); }
});

test('S2 join, the public preview and invite creation use the database limiter per network and per signed-in student', async () => {
  const { ACTIONS, LIMITS, handleMob, limitMessage } = await import('../../src/lib/server/mob/http.js');
  const taken = [];
  const deps = (user) => ({
    enabled: () => true, auth: async () => (user ? { user: { id: user } } : null), cors: () => ({}),
    rateLimit: async (_r, opts) => { taken.push(opts); return { allowed: true }; },
    service: { join: async () => ({ ok: true }), lookup: async () => ({ ok: true }), invite: async () => ({ ok: true }) },
  });
  const req = (method) => new Request('http://localhost/api/mob', { method, ...(method === 'POST' ? { body: '{}' } : {}) });
  const run = async (action, user) => { taken.length = 0; await handleMob(deps(user), action, req(ACTIONS[action][0]), { code: 'K7P2M9QX' }); return taken.map((o) => ({ ...o })); };
  const shape = (o) => [o.route.split(':')[1], o.keyParts.length ? 'user' : 'ip', o.persistent === true, o.fallback];
  assert.deepEqual((await run('join', 'u1')).map(shape), [['join', 'user', true, 'memory'], ['joinNet', 'ip', true, 'memory'], ['write', 'user', false, undefined]]);
  assert.deepEqual((await run('invite', 'u1')).map(shape), [['invite', 'user', true, 'memory'], ['inviteNet', 'ip', true, 'memory'], ['write', 'user', false, undefined]]);
  assert.deepEqual((await run('lookup', 'u1')).map(shape), [['lookup', 'ip', true, 'memory'], ['lookupUser', 'user', true, 'memory']]);
  assert.deepEqual((await run('lookup', null)).map(shape), [['lookup', 'ip', true, 'memory']], 'signed out: per network only');
  // Numbers an honest student never meets.
  assert.deepEqual(['join', 'joinNet', 'invite', 'inviteNet', 'lookup', 'lookupUser'].map((n) => [n, LIMITS[n].limit, LIMITS[n].windowMs / 60_000]),
    [['join', 10, 60], ['joinNet', 120, 60], ['invite', 5, 1440], ['inviteNet', 100, 1440], ['lookup', 120, 10], ['lookupUser', 60, 60]]);
  for (const n of ['joinNet', 'inviteNet', 'lookupUser']) assert.match(limitMessage(n, 'in 25 minutes'), /in 25 minutes\.$/);
});

// ---------------------------------------------------------------------------------------------------------------
// S2: a Mob report alerts the support inbox (the sender is injected; nothing is ever sent)
// ---------------------------------------------------------------------------------------------------------------

test('S2 a new report emails support@mockmob.in once: ids, reason, time, where to review; no name, email or text; Urgent for safety', async () => {
  const { ALERT_LIMITS, ALERT_TO, createReportAlert, reportAlertEmail } = await import('../../src/lib/server/mob/reportAlert.js');
  const db = await database();
  try {
    const sent = [];
    const lines = [];
    const take = async (bucket, limit, windowMs) => (await db.query('select public.take_rate_limit($1, $2, $3) r', [bucket, limit, windowMs])).rows[0].r;
    const alert = createReportAlert({
      enabled: () => true, take, log: (l) => lines.push(l),
      findId: async ({ mobId, reporterId, reason }) => one(db, 'select max(id)::int r from mob_reports where mob_id = $1::uuid and reporter_id = $2 and reason = $3', [mobId, reporterId, reason]),
      send: async (msg) => { sent.push(msg); return { data: { id: 'x' } }; },
    });
    const jobs = [];
    const svc = serviceFor(db, { onReport: (info) => { const j = alert(info); jobs.push(j); return j; } });
    const { mob } = await classLink(svc);
    await svc.patchMe('u3', { mob, name: 'Stranger' });
    const out = await svc.report('u2', { mob, memberId: memberOf(mob, 'u3'), reason: 'safety' });
    assert.deepEqual(out, { reported: true, left: false }, 'the report answers as before');
    assert.deepEqual(await Promise.all(jobs), ['sent']);
    const reportId = await one(db, 'select max(id)::int r from mob_reports');
    assert.equal(sent[0].to, ALERT_TO);
    assert.match(sent[0].subject, /^Urgent: /);
    assert.match(sent[0].text, new RegExp(`Report: ${reportId}\n`));
    assert.match(sent[0].text, new RegExp(`Mob: ${mob}\n`));
    assert.match(sent[0].text, /Reason: I do not feel safe \(safety\)/);
    assert.match(sent[0].text, /Time: Tue 17 Nov, 1:30 PM IST \(2026-11-17T08:00:00\.000Z\)/);
    assert.match(sent[0].text, /\/moderation/);
    assert.doesNotMatch(JSON.stringify(sent), /Stranger|Asha|Riya|u1|u2|u3|@(?!mockmob\.in)/, 'no name, user id or student email');
    assert.deepEqual(Object.keys(sent[0]).sort(), ['subject', 'text', 'to']);
    // A name report is not urgent.
    assert.doesNotMatch(reportAlertEmail({ reportId: 9, mobId: mob, reason: 'name', at: NOW }).subject, /Urgent/);
    // Flood: 3 an hour per kind, site-wide in the database; the urgent ones are never used up by the others.
    for (let i = 0; i < 4; i += 1) await alert({ mobId: mob, reporterId: 'u2', reason: 'name', at: NOW });
    assert.equal(sent.filter((m) => !/^Urgent/.test(m.subject)).length, ALERT_LIMITS.routine.limit);
    assert.equal(await alert({ mobId: mob, reporterId: 'u2', reason: 'safety', at: NOW }), 'sent');
    assert.equal(await alert({ mobId: mob, reporterId: 'u2', reason: 'safety', at: NOW }), 'sent');
    assert.equal(await alert({ mobId: mob, reporterId: 'u2', reason: 'safety', at: NOW }), 'limited');
    assert.ok(lines.length >= 2 && lines.every((l) => !l.includes('\n')), 'one line each');
  } finally { await db.close(); }
});

test('S2 the alert is off without RESEND_API_KEY, never fails or slows the report, and deps.js wires it after the response', async () => {
  const { createReportAlert } = await import('../../src/lib/server/mob/reportAlert.js');
  let sends = 0;
  const off = createReportAlert({ enabled: () => false, take: async () => true, findId: async () => 1, send: async () => { sends += 1; } });
  assert.equal(await off({ mobId: 'm', reporterId: 'u', reason: 'safety', at: NOW }), 'off');
  const lines = [];
  const broken = createReportAlert({ enabled: () => true, take: async () => true, findId: async () => 1, send: async () => ({ error: { message: 'rejected' } }), log: (l) => lines.push(l) });
  assert.equal(await broken({ mobId: 'm', reporterId: 'u', reason: 'name', at: NOW }), 'failed');
  const down = createReportAlert({ enabled: () => true, take: async () => { throw new Error('db down'); }, findId: async () => 1, send: async () => { sends += 1; }, log: (l) => lines.push(l) });
  assert.equal(await down({ mobId: 'm', reporterId: 'u', reason: 'name', at: NOW }), 'failed', 'no limiter, no email');
  assert.equal(sends, 0);
  assert.equal(lines.length, 2);
  // The service never waits for it and never fails because of it.
  const db = await database();
  try {
    const svc = serviceFor(db, { onReport: () => new Promise(() => {}) });
    const { mob } = await classLink(svc);
    assert.deepEqual(await svc.report('u2', { mob, memberId: memberOf(mob, 'u3'), reason: 'name' }), { reported: true, left: false });
    const throws = serviceFor(db, { onReport: () => { throw new Error('boom'); } });
    assert.deepEqual(await throws.report('u2', { mob, memberId: memberOf(mob, 'u3'), reason: 'nudge' }), { reported: true, left: false });
    assert.equal(await one(db, 'select count(*)::int r from mob_reports'), 2);
  } finally { await db.close(); }
  const deps = read('src/lib/server/mob/deps.js');
  assert.match(deps, /onReport: onMobReport/);
  assert.match(deps, /after\(job\)/);
  assert.match(deps, /RESEND_API_KEY/);
});
