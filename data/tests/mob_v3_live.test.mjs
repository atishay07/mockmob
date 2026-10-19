// Mob v3 live rooms, Phase B server (MOB-BUILD-SPEC-V3 sections 2.4, 2.5, 3.2, 3.3, 4 and 6; SV-14 to SV-16): the pure
// rules in src/lib/mob/live.mjs, migration 20261020100400_mob_v3_live on a real Postgres (PGlite) with its undo, the
// room routes (ticket, start, cancel) through the service and the route handler, the 30-room cap, the room hours, the
// Pro and passed-mic rules for live, the session's authUid, and every broadcast checked for names, marks and answers.
// Run: node --test data/tests/mob_v3_live.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERRORS, MobError } from '../../src/lib/mob/model.mjs';
import { inLiveHours, startRight } from '../../src/lib/mob/starts.mjs';
import {
  BROADCASTS, BROADCAST_KEYS, COUNTDOWN_MS, DEFAULT_MAX_ROOMS, LIVE_JOIN_GRACE_S, LOBBY_MINUTES, TICKET_MAX_MINUTES, TICKET_TAIL_MINUTES,
  broadcastOk, maxRooms, presenceOk, roomTidy, ticketExpiry, topicFor,
} from '../../src/lib/mob/live.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
import { ACTIONS, LIMITS, handleMob } from '../../src/lib/server/mob/http.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BASE = ['20261017100000_mob.sql', '20261017190000_mob_fix_1017.sql'].map((f) => read(`supabase/migrations/${f}`)).join('\n');
const V3 = ['20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime'];
const LIVE = '20261020100400_mob_v3_live';
const v3Sql = V3.map((f) => read(`supabase/migrations/${f}.sql`)).join('\n');
const liveSql = read(`supabase/migrations/${LIVE}.sql`);
const liveUndo = read(`supabase/undo/${LIVE}.undo.sql`);
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Thursday 22 Oct 2026, 2:05 PM IST.
const NOW = Date.parse('2026-10-22T08:35:00Z');
const MIN = 60_000;
const ist = (hhmm) => Date.parse(`2026-10-22T${hhmm}:00+05:30`);
const UID = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

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

async function database({ users = 12, live = true } = {}) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(`create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,${users}) g;`);
  await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await db.exec(STUBS);
  await db.exec(BASE);
  await db.exec(v3Sql);
  if (live) { await db.exec(liveSql); await db.exec(liveSql); } // idempotent
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
const keyOf = (id) => BANK.find((q) => q.id === id).correctIndex;
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function serviceFor(db, { clock = { now: NOW }, premium = false, billing = false, live = true, rooms } = {}) {
  let seed = 1;
  return createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (s === 'accountancy' ? { ok: true, id: s, name: 'Accountancy' } : { ok: false }),
    loadUser: async (id) => ({ subjects: ['accountancy'], isPremium: typeof premium === 'function' ? premium(id) : premium }),
    validChapter: (_s, c) => c === 'Goodwill',
    pickQuestionIds: async (_s, { count = 10, key = null } = {}) => { const start = key ? hash(key) % 30 : 0; return Array.from({ length: count }, (_, i) => BANK[(start + i) % 40].id); },
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async () => null, findAttempts: async () => [], startPractice: async () => ({ id: 'practice_x' }),
    v3Enabled: () => true, billingOn: () => (typeof billing === 'function' ? billing() : billing), liveEnabled: () => (typeof live === 'function' ? live() : live),
    liveMaxRooms: () => (typeof rooms === 'function' ? rooms() : rooms),
  });
}
const code = (c) => (e) => { assert.ok(e instanceof MobError, String(e)); assert.equal(e.code, c); return true; };

/** A Mob of `size` with `owner` first; members are the next users. Returns the Mob id. */
async function mobOf(svc, owner, others) {
  const mobId = (await svc.create(owner, { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'dart' })).mob.id;
  const inv = await svc.invite(owner, { mob: mobId });
  const names = ['Aarav', 'Kabir', 'Zoya', 'Meher'];
  for (const [i, u] of others.entries()) await svc.join(u, { code: inv.code, name: names[i], colour: 1 });
  return mobId;
}
const sent = async (db) => (await db.query('select topic, event, payload from realtime.sent order by id')).rows;
const roomState = (db, id) => one(db, 'select room_state r from mob_games where id = $1::uuid', [id]);

// ---------------------------------------------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------------------------------------------

test('live.mjs: the cap reads MOB_LIVE_MAX_ROOMS (default 30, 0 turns new rooms off); the topic is mob-room:<id>', () => {
  assert.equal(DEFAULT_MAX_ROOMS, 30);
  for (const [raw, want] of [[undefined, 30], [null, 30], ['', 30], [' ', 30], ['30', 30], ['0', 0], ['12', 12], [' 7 ', 7], ['-1', 30], ['2.5', 30], ['abc', 30], ['501', 30], [5, 5]]) {
    assert.equal(maxRooms(raw), want, String(raw));
  }
  assert.equal(topicFor('abc'), 'mob-room:abc');
  assert.equal(COUNTDOWN_MS, 4000);
});

test('live.mjs: server broadcasts carry only their own keys, never a name, a mark or an answer', () => {
  assert.deepEqual([...new Set(Object.values(BROADCASTS).flat())].sort(), [...BROADCAST_KEYS].sort());
  assert.equal(broadcastOk('room.start', { startsAt: '2026-10-22T08:35:04.000Z' }), true);
  assert.equal(broadcastOk('progress', { m: 'K7P2M9QXA1B2', q: 3, done: false }), true);
  assert.equal(broadcastOk('room.done', {}), true);
  assert.equal(broadcastOk('room.cancel', {}), true);
  assert.equal(broadcastOk('sticker', { m: 'K7P2M9QXA1B2', k: 'good_luck' }), true);
  for (const [event, payload] of [
    ['progress', { m: 'K7P2M9QXA1B2', q: 3, done: false, correct: true }], ['progress', { m: 'K7P2M9QXA1B2', q: 3, done: false, name: 'Riya' }],
    ['progress', { m: 'K7P2M9QXA1B2', q: 3, done: false, marks: 14 }], ['progress', { m: 'K7P2M9QXA1B2', q: 0, done: false }],
    ['progress', { m: 'Riya', q: 3, done: false }], ['progress', { m: 'K7P2M9QXA1B2', q: 3, done: 'no' }], ['progress', { m: 'K7P2M9QXA1B2', q: 3 }],
    ['room.start', { startsAt: 'soon' }], ['room.done', { winner: 'K7P2M9QXA1B2' }], ['pick', { m: 'K7P2M9QXA1B2' }], ['progress', null], ['progress', []],
  ]) assert.equal(broadcastOk(event, payload), false, `${event} ${JSON.stringify(payload)}`);
  // As delivered by Supabase Realtime (staging dry run, 20 Oct): its own message id rides along, and only that.
  const id = 'ec77ed32-9ad2-4480-ac62-72a6b719d683';
  assert.equal(broadcastOk('room.start', { id, startsAt: '2026-10-20T04:31:04+00:00' }, { delivered: true }), true);
  assert.equal(broadcastOk('progress', { m: 'D4RC726VNHAM', q: 5, id, done: true }, { delivered: true }), true);
  assert.equal(broadcastOk('room.done', { id }, { delivered: true }), true);
  assert.equal(broadcastOk('room.done', { id }), false, 'the SQL itself never sends an id');
  assert.equal(broadcastOk('room.done', { id: 'Riya' }, { delivered: true }), false, 'the transport id is a uuid, never a name');
  assert.equal(broadcastOk('progress', { m: 'D4RC726VNHAM', q: 5, id, done: true, marks: 9 }, { delivered: true }), false);
});

test('live.mjs: presence is exactly { m, st, v: 1 } from a member of the room; anything else is ignored', () => {
  const ids = ['K7P2M9QXA1B2', 'ABCDEFGHJKMN'];
  assert.equal(presenceOk({ m: 'K7P2M9QXA1B2', st: 'here', v: 1 }, ids), true);
  assert.equal(presenceOk({ m: 'ABCDEFGHJKMN', st: 'ready', v: 1 }, new Set(ids)), true);
  for (const p of [
    { m: 'ZZZZZZZZZZZZ', st: 'here', v: 1 }, { m: 'K7P2M9QXA1B2', st: 'online', v: 1 }, { m: 'K7P2M9QXA1B2', st: 'here', v: 2 },
    { m: 'K7P2M9QXA1B2', st: 'here', v: 1, name: 'Riya' }, { m: 'K7P2M9QXA1B2', st: 'here', v: 1, marks: 5 }, { m: 'K7P2M9QXA1B2', st: 'here' },
    { m: 'k7p2m9qxa1b2', st: 'here', v: 1 }, null, 'here', [],
  ]) assert.equal(presenceOk(p, ids), false, JSON.stringify(p));
});

test('live.mjs and the SQL keep the same numbers: 15-minute lobby, 30 s join grace, ticket 45 + 5 minutes', () => {
  assert.equal(LOBBY_MINUTES, 15);
  assert.equal(LIVE_JOIN_GRACE_S, 30);
  assert.equal(TICKET_MAX_MINUTES, 45);
  assert.equal(TICKET_TAIL_MINUTES, 5);
  assert.equal((liveSql.match(/interval '15 minutes'/g) || []).length, 2, 'tidy and the cap sweep use the lobby limit');
  assert.match(liveSql, /p_now \+ interval '45 minutes'\), p_now \+ interval '45 minutes'\) \+ interval '5 minutes'/);
  assert.match(read('supabase/migrations/20261020100100_mob_v3_games.sql'), /p_now <= gm\.room_starts_at \+ interval '30 seconds'/);
  assert.equal(roomTidy({ room_state: 'lobby', opened_at: NOW }, NOW + 15 * MIN - 1), null);
  assert.equal(roomTidy({ room_state: 'lobby', opened_at: new Date(NOW).toISOString() }, NOW + 15 * MIN), 'cancel');
  assert.equal(roomTidy({ room_state: 'running', opened_at: NOW, room_ends_at: NOW + 6 * MIN }, NOW + 6 * MIN - 1), null);
  assert.equal(roomTidy({ room_state: 'running', opened_at: NOW, room_ends_at: NOW + 6 * MIN }, NOW + 6 * MIN), 'done');
  for (const s of ['done', 'cancelled', null]) assert.equal(roomTidy({ room_state: s, opened_at: 0, room_ends_at: 0 }, NOW), null);
  assert.equal(ticketExpiry(NOW), NOW + 50 * MIN, 'a lobby ticket lives 50 minutes at most');
  assert.equal(ticketExpiry(NOW, new Date(NOW + 6 * MIN).toISOString()), NOW + 11 * MIN, 'a running room: its end plus 5 minutes');
});

test('room hours: live opens from 6:00 AM to 11:00 PM IST only, every day; the 24-hour game stays open', () => {
  for (const [t, ok] of [['05:59', false], ['06:00', true], ['06:01', true], ['14:05', true], ['22:59', true], ['23:00', false], ['23:30', false], ['00:00', false], ['03:00', false]]) {
    assert.equal(inLiveHours(ist(t)), ok, t);
  }
  const base = { billingOn: false, pro: false, mode: 'live', format: 'sprint', claimUsed: false, micsHeld: 0, liveOn: true };
  assert.deepEqual(startRight({ ...base, inLiveHours: false }), { ok: false, code: 'LIVE_HOURS' });
  assert.deepEqual(startRight({ ...base, mode: 'async', inLiveHours: false }), { ok: true, via: 'open' }, 'an anytime game starts at any hour');
  assert.deepEqual(startRight({ ...base, pro: true, billingOn: true, inLiveHours: false }), { ok: false, code: 'LIVE_HOURS' }, 'Pro does not lift the hours');
});

test('Pro and passed-mic rules for live (3.3): billing off opens for all; on, live needs Pro or a passed mic', () => {
  const r = (o) => startRight({ billingOn: true, pro: false, mode: 'live', format: 'sprint', claimUsed: false, micsHeld: 0, liveOn: true, inLiveHours: true, ...o });
  assert.deepEqual(r({ billingOn: false }), { ok: true, via: 'open' });
  assert.deepEqual(r({ pro: true }), { ok: true, via: 'pro' });
  assert.deepEqual(r({ pro: true, claimUsed: true }), { ok: true, via: 'pro' });
  assert.deepEqual(r({ micsHeld: 1 }), { ok: true, via: 'mic' }, 'a passed mic allows a live room');
  assert.deepEqual(r({ micsHeld: 1, claimUsed: true }), { ok: true, via: 'mic' });
  assert.deepEqual(r({}), { ok: false, code: 'START_FORMAT' }, 'the Free weekly start is for anytime games');
  assert.deepEqual(r({ claimUsed: true }), { ok: false, code: 'START_PRO' });
  assert.deepEqual(r({ liveOn: false, pro: true }), { ok: false, code: 'LIVE_OFF' });
  for (const c of ['START_FORMAT', 'START_PRO', 'LIVE_OFF', 'LIVE_HOURS', 'LIVE_BUSY', 'ROOM_OPEN_ALREADY', 'NOT_LIVE', 'ROOM_NOT_HOST', 'ROOM_STARTED', 'ROOM_CLOSED']) {
    assert.ok(ERRORS[c], c);
    assert.doesNotMatch(ERRORS[c][1], /!|₹|\bRs\b|price|\bbuy\b|late night|midnight/i, c);
  }
  assert.deepEqual([ERRORS.LIVE_BUSY[0], ERRORS.ROOM_CLOSED[0], ERRORS.ROOM_NOT_HOST[0], ERRORS.LIVE_OFF[0]], [503, 409, 403, 409]);
});

// ---------------------------------------------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------------------------------------------

const fnDefs = async (db) => Object.fromEntries((await db.query(
  "select p.oid::regprocedure::text f, md5(replace(pg_get_functiondef(p.oid), chr(13), '')) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'mob_%' order by 1",
)).rows.map((r) => [r.f, r.h]));

test('migration 100400 applies twice; its undo restores the 100300 room functions byte for byte, twice', async () => {
  const db = await database({ live: false });
  try {
    const before = await fnDefs(db);
    const idx = async () => one(db, "select count(*)::int r from pg_indexes where indexname = 'mob_games_room_live_idx'");
    await db.exec(liveSql);
    await db.exec(liveSql);
    const during = await fnDefs(db);
    assert.ok(during['mob_live_open(text,uuid,text,text,text,jsonb,text,date,uuid,timestamp with time zone,integer,integer)']);
    assert.ok(during['mob_room_tidy(uuid,timestamp with time zone)']);
    assert.notEqual(during['mob_room_start(text,uuid,timestamp with time zone,timestamp with time zone)'], before['mob_room_start(text,uuid,timestamp with time zone,timestamp with time zone)']);
    assert.equal(await idx(), 1);
    await db.exec(liveUndo);
    await db.exec(liveUndo);
    assert.deepEqual(await fnDefs(db), before, 'every function is back as 20261020100300 left it');
    assert.equal(await idx(), 0);
  } finally { await db.close(); }
});

test('migration 100400 security: every new or replaced function is security invoker, service role only, with a search_path', async () => {
  const db = await database();
  try {
    const rows = (await db.query(`select p.oid::regprocedure::text sig, p.prosecdef d, coalesce(array_to_string(p.proacl, ','), '') acl, array_to_string(p.proconfig, ',') cfg
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('mob_live_open', 'mob_room_tidy', 'mob_room_ticket', 'mob_room_start', 'mob_room_cancel')`)).rows;
    assert.equal(rows.length, 5);
    for (const r of rows) {
      assert.equal(r.d, false, r.sig);
      assert.match(r.acl, /service_role=X/, r.sig);
      assert.doesNotMatch(r.acl, /authenticated=X|anon=X|(^|[{,])=X/, r.sig);
      assert.match(r.cfg, /search_path=public/, r.sig);
    }
    assert.equal((liveSql.match(/security definer/g) || []).length, 0);
    // SV-14 static scan of the new send sites.
    for (const m of liveSql.matchAll(/mob_room_send\([^,]+,\s*'([^']+)',\s*([^;]+)\);/g)) {
      const keys = [...m[2].matchAll(/'([A-Za-z]+)'\s*,/g)].map((x) => x[1]);
      for (const k of keys) assert.ok(BROADCASTS[m[1]].includes(k), `${m[1]}: ${k}`);
    }
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// The service: open, cap, ticket, start, cancel, tidy, the live run
// ---------------------------------------------------------------------------------------------------------------

test('SV-16 the 30-room cap: room 31 gives LIVE_BUSY, claims nothing, and a closed or stale room frees its seat', async () => {
  const db = await database({ users: 12 });
  const clock = { now: NOW };
  let rooms = 2;
  try {
    const svc = serviceFor(db, { clock, rooms: () => rooms });
    const a = await mobOf(svc, 'u1', ['u2']);
    const b = await mobOf(svc, 'u3', ['u4']);
    const c = await mobOf(svc, 'u5', ['u6']);
    const ga = (await svc.v3.openGame('u1', { mob: a, format: 'sprint', mode: 'live' })).game;
    assert.equal(ga.room.state, 'lobby');
    await svc.v3.openGame('u3', { mob: b, format: 'sprint', mode: 'live' });
    await assert.rejects(svc.v3.openGame('u5', { mob: c, format: 'sprint', mode: 'live' }), code('LIVE_BUSY'));
    assert.equal(await one(db, 'select count(*)::int r from mob_games where mob_id = $1::uuid', [c]), 0, 'the refused room was not created');
    // An anytime game is never capped.
    await svc.v3.openGame('u5', { mob: c, format: 'sprint' });
    // A Mob with its own room open hears that first, even at the cap.
    await assert.rejects(svc.v3.openGame('u2', { mob: a, format: 'sprint', mode: 'live' }), code('ROOM_OPEN_ALREADY'));
    // Cancel frees a seat.
    await svc.v3.roomCancel('u1', ga.id);
    const gc = (await svc.v3.openGame('u5', { mob: c, format: 'sprint', mode: 'live' })).game;
    // A lobby nobody starts for 15 minutes frees its seat at the next live open, and says room.cancel.
    clock.now += 15 * MIN;
    const ga2 = (await svc.v3.openGame('u1', { mob: a, format: 'round', count: 10, mode: 'live' })).game;
    assert.equal(await roomState(db, gc.id), 'cancelled');
    assert.ok((await sent(db)).some((s) => s.event === 'room.cancel' && s.topic === topicFor(gc.id)));
    // A running room past its end frees its seat too (room.done).
    await svc.v3.roomStart('u1', ga2.id);
    clock.now += 10 * 60_000 + 60_000 + COUNTDOWN_MS; // 10 questions x 60 s + 60 s grace
    rooms = 1;
    await svc.v3.openGame('u5', { mob: c, format: 'sprint', mode: 'live' }).catch(() => null);
    assert.equal(await roomState(db, ga2.id), 'done');
    // MOB_LIVE_MAX_ROOMS=0: every live open is busy (the quota fallback drill, 7.4).
    rooms = 0;
    const d = await mobOf(svc, 'u7', ['u8']);
    await assert.rejects(svc.v3.openGame('u7', { mob: d, format: 'sprint', mode: 'live' }), code('LIVE_BUSY'));
    rooms = undefined;
    assert.equal((await svc.v3.openGame('u7', { mob: d, format: 'sprint', mode: 'live' })).game.mode, 'live', 'unset means 30');
  } finally { await db.close(); }
});

test('the cap counts across MockMob under one lock: two opens racing for the last seat give one room', async () => {
  const db = await database({ users: 12 });
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock, rooms: 1 });
    const a = await mobOf(svc, 'u1', ['u2']);
    const b = await mobOf(svc, 'u3', ['u4']);
    const both = await Promise.allSettled([svc.v3.openGame('u1', { mob: a, format: 'sprint', mode: 'live' }), svc.v3.openGame('u3', { mob: b, format: 'sprint', mode: 'live' })]);
    assert.deepEqual(both.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(both.find((x) => x.status === 'rejected').reason.code, 'LIVE_BUSY');
    assert.equal(await one(db, "select count(*)::int r from mob_games where room_state in ('lobby','running')"), 1);
    assert.match(liveSql, /pg_advisory_xact_lock\(hashtext\('mob:live-rooms'\)\)/);
  } finally { await db.close(); }
});

test('Pro and the passed mic on the server: a busy refusal keeps the mic, a live open by mic uses it, the Free start stays', async () => {
  const db = await database({ users: 12 });
  const clock = { now: NOW };
  let rooms = 0;
  const pros = new Set(['u1']);
  try {
    const svc = serviceFor(db, { clock, billing: true, premium: (u) => pros.has(u), rooms: () => rooms });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    await assert.rejects(svc.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'live' }), code('START_FORMAT'), 'Free, unused start: live needs Pro or a mic');
    await svc.v3.mic('u1', { mob: mobId, to: memberIdFor('test-secret', mobId, 'u2') });
    await assert.rejects(svc.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'live' }), code('LIVE_BUSY'));
    assert.equal(await one(db, "select count(*)::int r from mob_mics where receiver_id = 'u2' and used_game_id is null"), 1, 'the mic is still there');
    rooms = 30;
    const g = (await svc.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    assert.equal(await one(db, 'select started_via r from mob_games where id = $1::uuid', [g.id]), 'mic');
    assert.equal(await one(db, "select count(*)::int r from mob_mics where receiver_id = 'u2' and used_game_id is null"), 0, 'the mic is used');
    assert.equal(await one(db, "select count(*)::int r from mob_start_claims where user_id = 'u2'"), 0, 'the Free weekly start is untouched');
    // Joining a room is never gated: a Free member with no start and no mic takes a ticket.
    assert.equal((await svc.v3.roomTicket('u3', UID(3), g.id)).room.state, 'lobby');
    await svc.v3.roomCancel('u2', g.id);
    const p = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    assert.equal(await one(db, 'select started_via r from mob_games where id = $1::uuid', [p.id]), 'pro');
    // Outside the hours, even Pro gets LIVE_HOURS; the game can still start anytime.
    await svc.v3.roomCancel('u1', p.id);
    clock.now = ist('23:05');
    await assert.rejects(svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' }), code('LIVE_HOURS'));
    clock.now = ist('05:59');
    await assert.rejects(svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' }), code('LIVE_HOURS'));
    clock.now = ist('06:00');
    assert.equal((await svc.v3.openGame('u1', { mob: mobId, format: 'round', count: 10, mode: 'live' })).game.room.state, 'lobby');
  } finally { await db.close(); }
});

test('ticket: needs the session authUid and membership; a live game only; lobby tickets last 50 minutes, running ones end + 5', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    await mobOf(svc, 'u5', ['u6']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    for (const bad of [null, undefined, '', 'not-a-uuid', 42]) await assert.rejects(svc.v3.roomTicket('u2', bad, g.id), code('UNAUTHENTICATED'));
    await assert.rejects(svc.v3.roomTicket('u6', UID(6), g.id), code('GAME_NOT_FOUND'), 'not your Mob');
    await assert.rejects(svc.v3.roomTicket('u2', UID(2), 'nope'), code('GAME_NOT_FOUND'));
    const t = await svc.v3.roomTicket('u2', UID(2), g.id);
    assert.deepEqual(Object.keys(t).sort(), ['expiresAt', 'memberId', 'room', 'serverNow', 'topic']);
    assert.equal(t.topic, `mob-room:${g.id}`);
    assert.equal(t.memberId, memberIdFor('test-secret', mobId, 'u2'));
    assert.deepEqual(t.room, { state: 'lobby', startsAt: null, hostMemberId: memberIdFor('test-secret', mobId, 'u1') });
    assert.equal(t.expiresAt, new Date(NOW + 50 * MIN).toISOString());
    assert.equal(await one(db, 'select auth_uid::text r from mob_room_tickets where user_id = $1', ['u2']), UID(2), 'the ticket is for the Supabase identity');
    assert.doesNotMatch(JSON.stringify(t), /u2|Aarav|Riya|EXPLAIN|correct/, 'no user id, no name, nothing of the paper');
    // An anytime game has no room.
    const a = (await svc.v3.openGame('u2', { mob: mobId, format: 'sprint' })).game;
    await assert.rejects(svc.v3.roomTicket('u2', UID(2), a.id), code('NOT_LIVE'));
    // Running: the ticket ends with the room plus 5 minutes.
    await svc.v3.roomStart('u1', g.id);
    clock.now += 60_000;
    const t2 = await svc.v3.roomTicket('u3', UID(3), g.id);
    assert.equal(t2.room.state, 'running');
    assert.equal(t2.room.startsAt, new Date(NOW + COUNTDOWN_MS).toISOString());
    assert.equal(t2.expiresAt, new Date(NOW + COUNTDOWN_MS + (5 * 60 + 60) * 1000 + 5 * MIN).toISOString());
    // Re-issuing after a revoke opens it again for a member (a ticket is per room and identity).
    await db.query("update mob_room_tickets set revoked_at = now() where user_id = 'u3'");
    await svc.v3.roomTicket('u3', UID(3), g.id);
    assert.equal(await one(db, "select (revoked_at is null) r from mob_room_tickets where user_id = 'u3'"), true);
    // Past the room's end: the first read closes it and the ticket is refused with the honest sentence.
    clock.now = NOW + COUNTDOWN_MS + 6 * MIN;
    await assert.rejects(svc.v3.roomTicket('u2', UID(2), g.id), code('ROOM_CLOSED'));
    assert.equal(await roomState(db, g.id), 'done');
    // After the 24 hours: GAME_CLOSED.
    clock.now = NOW + 25 * 60 * MIN;
    await assert.rejects(svc.v3.roomTicket('u2', UID(2), g.id), code('GAME_CLOSED'));
  } finally { await db.close(); }
});

test('start and cancel: host only, lobby only; start lands 4 s ahead and says only startsAt; cancel keeps the 24-hour game', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    await assert.rejects(svc.v3.roomStart('u2', g.id), code('ROOM_NOT_HOST'));
    await assert.rejects(svc.v3.roomCancel('u2', g.id), code('ROOM_NOT_HOST'));
    const s = await svc.v3.roomStart('u1', g.id);
    assert.deepEqual(s, { startsAt: new Date(NOW + 4000).toISOString(), serverNow: new Date(NOW).toISOString() });
    await assert.rejects(svc.v3.roomStart('u1', g.id), code('ROOM_STARTED'));
    await assert.rejects(svc.v3.roomCancel('u1', g.id), code('ROOM_STARTED'));
    const ev = (await sent(db)).filter((x) => x.topic === topicFor(g.id));
    assert.deepEqual(ev.map((x) => x.event), ['room.start']);
    assert.deepEqual(Object.keys(ev[0].payload), ['startsAt']);
    assert.equal(Date.parse(ev[0].payload.startsAt), NOW + 4000);

    // An anytime game: start and cancel are NOT_LIVE, and the SQL itself refuses (100300 let null reach the update).
    const a = (await svc.v3.openGame('u2', { mob: mobId, format: 'sprint' })).game;
    await assert.rejects(svc.v3.roomStart('u2', a.id), code('NOT_LIVE'));
    await assert.rejects(svc.v3.roomCancel('u2', a.id), code('NOT_LIVE'));
    assert.equal(await one(db, "select mob_room_start('u2', $1::uuid, now(), now()) r", [a.id]), 'not_live');
    assert.equal(await one(db, "select mob_room_cancel('u2', $1::uuid) r", [a.id]), 'not_live');
    assert.equal(await roomState(db, a.id), null, 'an anytime game never gets a room');

    // Cancel: the room closes, the game stays open for its 24 hours and plays as an anytime game.
    clock.now += 7 * MIN; // the first room is done by now
    await svc.v3.getGame('u2', g.id);
    assert.equal(await roomState(db, g.id), 'done');
    const c = (await svc.v3.openGame('u3', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    const closesAt = c.closesAt;
    assert.deepEqual(await svc.v3.roomCancel('u3', c.id), { ok: true });
    await assert.rejects(svc.v3.roomCancel('u3', c.id), code('ROOM_CLOSED'));
    await assert.rejects(svc.v3.roomStart('u3', c.id), code('ROOM_CLOSED'));
    await assert.rejects(svc.v3.roomTicket('u2', UID(2), c.id), code('ROOM_CLOSED'));
    const after = (await svc.v3.getGame('u2', c.id)).game;
    assert.equal(after.room.state, 'cancelled');
    assert.equal(after.closesAt, closesAt);
    assert.equal(after.closed, false);
    const run = await svc.v3.startRun('u2', c.id);
    assert.equal(run.run.live, false, 'after a cancel the game is played anytime');
    assert.ok((await sent(db)).some((x) => x.topic === topicFor(c.id) && x.event === 'room.cancel' && Object.keys(x.payload).length === 0));

    // A lobby nobody started for 15 minutes cannot be started (another Mob: this one has 3 games open).
    await assert.rejects(svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' }), code('GAMES_OPEN_LIMIT'));
    const other = await mobOf(svc, 'u5', ['u6']);
    const d = (await svc.v3.openGame('u5', { mob: other, format: 'sprint', mode: 'live' })).game;
    clock.now += 15 * MIN - 1000;
    assert.equal((await svc.v3.roomTicket('u6', UID(6), d.id)).room.state, 'lobby', 'still open a second before 15 minutes');
    clock.now += 1000;
    await assert.rejects(svc.v3.roomStart('u5', d.id), code('ROOM_CLOSED'));
    assert.equal(await roomState(db, d.id), 'cancelled');
  } finally { await db.close(); }
});

test('SV-16 the live run: within 30 s of the start it is live from startsAt, later it is anytime; the last finish says room.done', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3', 'u4']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    for (const [u, n] of [['u1', 1], ['u2', 2], ['u3', 3]]) await svc.v3.roomTicket(u, UID(n), g.id);
    const { startsAt } = await svc.v3.roomStart('u1', g.id);
    clock.now = Date.parse(startsAt);
    const r1 = await svc.v3.startRun('u1', g.id);
    clock.now = Date.parse(startsAt) + 30_000;
    const r2 = await svc.v3.startRun('u2', g.id);
    clock.now = Date.parse(startsAt) + 31_000;
    const r4 = await svc.v3.startRun('u4', g.id);
    assert.deepEqual([r1.run.live, r2.run.live, r4.run.live], [true, true, false]);
    assert.equal(r2.run.startedAt, startsAt, 'a live run starts at the room start');
    assert.equal(r4.run.startedAt, new Date(clock.now).toISOString());
    assert.ok(r1.questions.every((q) => !('correctIndex' in q) && !('explanation' in q)));
    // The room shows who is playing live, with how far, and no marks.
    clock.now += 10_000;
    const qs = await one(db, 'select question_ids r from mob_games where id = $1::uuid', [g.id]);
    await svc.v3.answer('u1', g.id, { q: 0, pick: keyOf(qs[0]) });
    await svc.v3.answer('u2', g.id, { q: 0, pick: (keyOf(qs[0]) + 1) % 4 });
    await svc.v3.answer('u4', g.id, { q: 0, pick: keyOf(qs[0]) });
    const view = (await svc.v3.getGame('u3', g.id)).game;
    assert.deepEqual(view.runs.map((r) => [r.finished, r.answered, 'marks' in r]), [[false, 1, false], [false, 1, false]]);
    // Progress goes out only for live runs; finishing both live runs makes the room done.
    for (let q = 1; q < 5; q += 1) { clock.now += 5000; await svc.v3.answer('u1', g.id, { q, pick: -1 }); }
    assert.equal(await roomState(db, g.id), 'running', 'one live run is still going');
    await svc.v3.finish('u2', g.id);
    assert.equal(await roomState(db, g.id), 'done');
    const ev = (await sent(db)).filter((x) => x.topic === topicFor(g.id));
    assert.deepEqual(ev.map((x) => x.event), ['room.start', 'progress', 'progress', 'progress', 'progress', 'progress', 'progress', 'progress', 'room.done']);
    const ids = new Set(['u1', 'u2'].map((u) => memberIdFor('test-secret', mobId, u)));
    for (const x of ev) {
      assert.ok(broadcastOk(x.event, x.payload), `${x.event} ${JSON.stringify(x.payload)}`);
      if (x.payload.m) assert.ok(ids.has(x.payload.m), 'only live runners move on the ruler');
    }
    assert.deepEqual(ev.filter((x) => x.event === 'progress').map((x) => [x.payload.q, x.payload.done]), [[1, false], [1, false], [2, false], [3, false], [4, false], [5, true], [5, true]]);
    assert.doesNotMatch(JSON.stringify(ev), /Riya|Aarav|Kabir|Zoya|u1|u2|correct|pick|marks|EXPLAIN|Option/);
  } finally { await db.close(); }
});

test('leaving or a block revokes the room ticket at once (mob_room_ok goes false)', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3', 'u4']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    for (const [u, n] of [['u2', 2], ['u3', 3]]) await svc.v3.roomTicket(u, UID(n), g.id);
    const ok = async (n) => {
      await db.exec(`set rt.uid = '${UID(n)}'; set rt.topic = '${topicFor(g.id)}'; set role authenticated;`);
      try { return await one(db, 'select public.mob_room_ok($1) r', [topicFor(g.id)]); } finally { await db.exec('reset role'); }
    };
    assert.deepEqual([await ok(2), await ok(3), await ok(4)], [true, true, false]);
    await svc.leave('u3', { mob: mobId });
    assert.equal(await ok(3), false, 'revoked on leave');
    await db.query("select mob_block('u2','u4')");
    assert.equal(await ok(2), false, 'revoked on block');
    // The service refuses a ticket to someone no longer in the Mob.
    await assert.rejects(svc.v3.roomTicket('u3', UID(3), g.id), code('GAME_NOT_FOUND'));
  } finally { await db.close(); }
});

test('the den: a stale lobby is closed on the first read, never shown as joinable; live says enabled and the hours', async () => {
  const db = await database();
  const clock = { now: NOW };
  let live = true;
  try {
    const svc = serviceFor(db, { clock, live: () => live });
    const mobId = await mobOf(svc, 'u1', ['u2']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    let den = (await svc.view('u2', { mobId })).mob.v3;
    assert.deepEqual(den.games.find((x) => x.id === g.id).room, { state: 'lobby', startsAt: null });
    assert.deepEqual(den.live, { enabled: true, hoursOk: true });
    clock.now += 15 * MIN;
    den = (await svc.view('u2', { mobId })).mob.v3;
    assert.equal(den.games.find((x) => x.id === g.id).room.state, 'cancelled');
    clock.now = ist('23:10');
    live = false;
    den = (await svc.view('u2', { mobId })).mob.v3;
    assert.deepEqual(den.live, { enabled: false, hoursOk: false });
    assert.deepEqual(den.starts.modes, ['async'], 'with live off, only anytime games are offered');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Routes and the session
// ---------------------------------------------------------------------------------------------------------------

const req = (method = 'POST', body = {}) => new Request('http://localhost/api/mob/game/x/room/ticket', { method, body: JSON.stringify(body) });
const LIVE_ACTIONS = ['roomTicket', 'roomStart', 'roomCancel'];

test('routes: live actions are 404 with v3 off, 401 signed out, 409 LIVE_OFF before any limit, and pass the session authUid', async () => {
  for (const a of LIVE_ACTIONS) {
    assert.equal(ACTIONS[a][0], 'POST');
    assert.deepEqual(ACTIONS[a][4], { v3: true, live: true });
  }
  assert.deepEqual(ACTIONS.roomTicket[1], ['ticket']);
  assert.deepEqual(ACTIONS.roomStart[1], ['room']);
  assert.deepEqual(ACTIONS.roomCancel[1], ['room']);
  assert.deepEqual([LIMITS.ticket.limit, LIMITS.ticket.windowMs, LIMITS.ticket.success, LIMITS.room.limit, LIMITS.room.windowMs], [20, 3_600_000, true, 20, 3_600_000]);
  const limited = [];
  const calls = [];
  const deps = (over = {}) => ({
    enabled: () => true, v3Enabled: () => true, liveEnabled: () => true, cors: () => ({}),
    auth: async () => ({ user: { id: 'u1', supabaseId: UID(1), authUid: UID(1) } }),
    rateLimit: async (_r, o) => { limited.push(o.route); return { allowed: true }; },
    service: { v3: {
      roomTicket: async (...args) => { calls.push(['roomTicket', ...args]); return { topic: 'mob-room:g' }; },
      roomStart: async (...args) => { calls.push(['roomStart', ...args]); return { startsAt: 'x' }; },
      roomCancel: async (...args) => { calls.push(['roomCancel', ...args]); return { ok: true }; },
    } },
    ...over,
  });
  for (const a of LIVE_ACTIONS) {
    const v3off = await handleMob(deps({ v3Enabled: () => false }), a, req(), { id: 'g' });
    assert.equal(v3off.status, 404, a);
    const anon = await handleMob(deps({ auth: async () => null }), a, req(), { id: 'g' });
    assert.equal(anon.status, 401, a);
    limited.length = 0;
    const off = await handleMob(deps({ liveEnabled: () => false }), a, req(), { id: 'g' });
    assert.equal(off.status, 409, a);
    const body = await off.json();
    assert.equal(body.error.code, 'LIVE_OFF');
    assert.equal(body.error.message, 'Live rooms are not on yet. Start it for anytime in 24 hours.');
    assert.equal(off.headers.get('cache-control'), 'no-store');
    assert.deepEqual(limited, [], 'LIVE_OFF takes no rate-limit count');
    const missing = await handleMob(deps({ liveEnabled: undefined }), a, req(), { id: 'g' });
    assert.equal(missing.status, 409, 'no flag given: off');
    const fine = await handleMob(deps(), a, req(), { id: 'g' });
    assert.equal(fine.status, 200, a);
  }
  assert.deepEqual(calls, [['roomTicket', 'u1', UID(1), 'g'], ['roomStart', 'u1', 'g'], ['roomCancel', 'u1', 'g']]);
  // A body cannot smuggle an authUid; only the session gives one.
  calls.length = 0;
  await handleMob(deps({ auth: async () => ({ user: { id: 'u1' } }) }), 'roomTicket', req('POST', { authUid: UID(9) }), { id: 'g', authUid: UID(9) });
  assert.deepEqual(calls, [['roomTicket', 'u1', null, 'g']]);
  // A refused ticket gives its success-only count back.
  const given = [];
  const refused = await handleMob(deps({ giveBack: async (_r, o) => { given.push(o.route); }, service: { v3: { roomTicket: async () => { throw new MobError('ROOM_CLOSED'); } } } }), 'roomTicket', req(), { id: 'g' });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error.message, ERRORS.ROOM_CLOSED[1]);
  assert.deepEqual(given, ['/api/mob:ticket']);
});

test('the route files are wired, and the session carries authUid (the Supabase identity id) beside users.id', () => {
  for (const [dir, action] of [['ticket', 'roomTicket'], ['start', 'roomStart'], ['cancel', 'roomCancel']]) {
    const src = read(`src/app/api/mob/game/[id]/room/${dir}/route.js`);
    assert.match(src, new RegExp(`handleMob\\(mobDeps\\(\\), '${action}', request, \\{ id: \\(await params\\)\\.id \\}\\)`));
    assert.match(src, /export const runtime = 'nodejs'/);
    assert.doesNotMatch(src, /export const GET/);
  }
  const authTs = read('src/lib/auth.ts');
  assert.match(authTs, /authUid: supabaseId,/);
  assert.equal((authTs.match(/sessionFor\(/g) || []).length, 3, 'both the cookie and the Bearer paths build the session in one place');
  const deps = read('src/lib/server/mob/deps.js');
  assert.match(deps, /liveEnabled: mobLiveEnabled, auth:/, 'the route handler reads MOB_LIVE_ENABLED');
  assert.match(deps, /liveMaxRooms: mobLiveMaxRooms/);
  assert.match(deps, /process\.env\.MOB_LIVE_MAX_ROOMS/);
});
