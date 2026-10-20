// Mob formats (owner D167, 20 Oct 2:05 pm; D168/D169): timed races, Full mock together, and the live-room fixes the 20 Oct
// reviews asked for before MOB_LIVE_ENABLED (L-55 presence, web-security #1 the close, #2 keys across games, #7 the
// Realtime check out of the API schema). Migration 20261020140000_mob_v3_formats on a real Postgres (PGlite) with its
// undo, the service and the route handler. One test per rule: timing abuse, answers held until close, ties, Free and Pro
// starts, live presence, room hours.
// Run: node --test data/tests/mob_v3_formats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERRORS, MobError } from '../../src/lib/mob/model.mjs';
import { inLiveHours, startRight, startsView } from '../../src/lib/mob/starts.mjs';
import { BROADCASTS, broadcastOk } from '../../src/lib/mob/live.mjs';
import { RACE_GRACE_MS, assignMoments, gameMs, mockTrap, placeRuns, racePool } from '../../src/lib/mob/games.mjs';
import { markSheet, sheetView } from '../../src/lib/mob/sheets.mjs';
import { attemptForClient, attemptHold } from '../../src/lib/mob/paperHold.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
import { ACTIONS, LIMITS, handleMob } from '../../src/lib/server/mob/http.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BEFORE = ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games',
  '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live'];
const FORMATS = '20261020140000_mob_v3_formats';
const formatsSql = read(`supabase/migrations/${FORMATS}.sql`);
const formatsUndo = read(`supabase/undo/${FORMATS}.undo.sql`);
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Thursday 22 Oct 2026, 2:05 PM IST.
const NOW = Date.parse('2026-10-22T08:35:00Z');
const MIN = 60_000;
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

async function database({ formats = true } = {}) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,12) g;");
  await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await db.exec(STUBS);
  for (const f of BEFORE) await db.exec(read(`supabase/migrations/${f}.sql`));
  if (formats) { await db.exec(formatsSql); await db.exec(formatsSql); } // idempotent
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
// 120 questions over 3 chapters (two syllabus units), keys cycling 0..3.
const CHAPTERS = ['Goodwill', 'Cash Flow Statement', 'Ratios'];
const BANK = Array.from({ length: 120 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, chapter: CHAPTERS[i % 3], explanation: `EXPLAIN-q${i + 1}`,
  options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })),
}));
const keyOf = (id) => BANK.find((q) => q.id === id).correctIndex;
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const SECTION = { Goodwill: { key: 'unit_1', label: 'Reconstitution of a Partnership firm' }, 'Cash Flow Statement': { key: 'unit_5', label: 'Analysis of Financial Statements' }, Ratios: { key: 'unit_5', label: 'Analysis of Financial Statements' } };

function serviceFor(db, { clock = { now: NOW }, premium = false, billing = false, live = true, formats = true, attempts = [], practice = [] } = {}) {
  let seed = 1;
  return createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (s === 'accountancy' ? { ok: true, id: s, name: 'Accountancy' } : { ok: false }),
    loadUser: async (id) => ({ subjects: ['accountancy'], isPremium: typeof premium === 'function' ? premium(id) : premium }),
    validChapter: (_s, c) => CHAPTERS.includes(c),
    // Like the bank: never an excluded id, as many as it has; a chapter narrows it.
    pickQuestionIds: async (_s, { count = 10, key = null, chapter = null, exclude = [] } = {}) => {
      const skip = new Set(exclude);
      const pool = BANK.filter((q) => !chapter || q.chapter === chapter);
      const start = key ? hash(key) % pool.length : 0;
      return Array.from({ length: pool.length }, (_, i) => pool[(start + i) % pool.length].id).filter((id) => !skip.has(id)).slice(0, count);
    },
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    sectionsFor: (_s, qs) => qs.map((q) => SECTION[q.chapter] || null),
    trapNameFor: async () => null,
    findAttempts: async (userIds, { gameId } = {}) => attempts.filter((a) => userIds.includes(a.userId) && (!gameId || a.selectionMeta?.mobPaper?.gameId === gameId)),
    startPractice: async (userId, input, server) => { practice.push({ userId, input, server }); return { sessionId: `s_${userId}`, mode: input.mode, count: server.mobPaper.questions.length }; },
    v3Enabled: () => true, billingOn: () => (typeof billing === 'function' ? billing() : billing), liveEnabled: () => (typeof live === 'function' ? live() : live),
    formatsEnabled: () => (typeof formats === 'function' ? formats() : formats),
  });
}
const code = (c) => (e) => { assert.ok(e instanceof MobError, String(e)); assert.equal(e.code, c); return true; };
async function mobOf(svc, owner, others) {
  const mobId = (await svc.create(owner, { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'dart' })).mob.id;
  const inv = await svc.invite(owner, { mob: mobId });
  const names = ['Aarav', 'Kabir', 'Zoya', 'Meher'];
  for (const [i, u] of others.entries()) await svc.join(u, { code: inv.code, name: names[i], colour: 1 });
  return mobId;
}
const idsOf = (db, id) => one(db, 'select question_ids r from mob_games where id = $1::uuid', [id]);
const sent = async (db) => (await db.query('select topic, event, payload from realtime.sent order by id')).rows;
const KEYISH = /correctIndex|explanation|EXPLAIN-|"correct":(true|false)/;

// ---------------------------------------------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------------------------------------------

test('start rules: a race is a free weekly start and a mic covers it; a full mock is Pro-only with billing on, never a mic', () => {
  const base = { billingOn: true, pro: false, mode: 'async', format: 'race', claimUsed: false, micsHeld: 0, liveOn: true, inLiveHours: true };
  const r = (over) => startRight({ ...base, ...over });
  assert.deepEqual(r({}), { ok: true, via: 'free_weekly' });
  assert.deepEqual(r({ claimUsed: true }), { ok: false, code: 'START_USED' });
  assert.deepEqual(r({ claimUsed: true, micsHeld: 1, mode: 'live' }), { ok: true, via: 'mic' }, 'a passed mic: a live race');
  assert.deepEqual(r({ format: 'mock' }), { ok: false, code: 'START_PRO' }, 'Free, billing on: the mock is locked');
  assert.deepEqual(r({ format: 'mock', micsHeld: 2, claimUsed: true }), { ok: false, code: 'START_PRO' }, 'a mic never opens a mock');
  assert.deepEqual(r({ format: 'mock', pro: true }), { ok: true, via: 'pro' });
  assert.deepEqual(r({ format: 'mock', billingOn: false }), { ok: true, via: 'open' }, 'billing off: everyone starts everything');
  const free = startsView({ billingOn: true, pro: false, claimUsed: false, micsHeld: 0, liveOn: true });
  assert.deepEqual([free.formats, free.locked], [['sprint', 'round', 'race'], ['mock']]);
  assert.deepEqual(startsView({ billingOn: true, pro: false, claimUsed: true, micsHeld: 0, liveOn: true }).locked, ['race', 'mock'], 'used: race and mock still drawn, locked');
  assert.deepEqual(startsView({ billingOn: true, pro: false, claimUsed: true, micsHeld: 1, liveOn: true }).formats, ['sprint', 'round', 'rematch', 'race']);
  assert.deepEqual(startsView({ billingOn: true, pro: true, claimUsed: true, micsHeld: 0, liveOn: true }).locked, []);
  assert.deepEqual(startsView({ billingOn: false, pro: false, claimUsed: true, micsHeld: 0, liveOn: false }).formats, ['sprint', 'round', 'rematch', 'race', 'mock']);
  assert.deepEqual(startsView({ billingOn: false, pro: false, claimUsed: true, micsHeld: 0, liveOn: false, formatsOn: false }).formats, ['sprint', 'round', 'rematch'], 'MOB_FORMATS_ENABLED off');
});

test('room hours: a live race opens from 6:00 AM to 11:00 PM IST only', () => {
  for (const [at, ok] of [['00:29', false], ['00:30', true], ['12:00', true], ['17:29', true], ['17:30', false], ['23:59', false]]) {
    const t = Date.parse(`2026-10-22T${at}:00Z`);
    assert.equal(inLiveHours(t), ok, at);
    assert.deepEqual(startRight({ billingOn: false, pro: false, mode: 'live', format: 'race', claimUsed: false, micsHeld: 0, liveOn: true, inLiveHours: inLiveHours(t) }), ok ? { ok: true, via: 'open' } : { ok: false, code: 'LIVE_HOURS' }, at);
  }
});

test('race numbers: 6 a minute (4 at least), a 2 s network grace, the playing time per format', () => {
  assert.deepEqual(racePool(5), { want: 30, least: 20 });
  assert.deepEqual(racePool(10), { want: 60, least: 40 });
  assert.equal(RACE_GRACE_MS, 2000);
  assert.equal(gameMs({ format: 'race', minutes: 5, count: 30 }), 5 * MIN);
  assert.equal(gameMs({ format: 'mock', minutes: 60, count: 50 }), 60 * MIN);
  assert.equal(gameMs({ format: 'sprint', count: 5, secondsPerQuestion: 60 }), 5 * MIN);
  // The SQL keeps the same numbers.
  assert.match(formatsSql, /when p_format = 'race' then p_minutes \* 60 when p_format = 'mock' then coalesce\(p_minutes, 60\) \* 60/);
  assert.match(formatsSql, /interval '2 seconds'/);
});

test('ties: equal marks share a place; "most answered" goes to one race run alone, a tie gives it to nobody', () => {
  const placed = placeRuns([{ userId: 'a', marks: 23 }, { userId: 'b', marks: 23 }, { userId: 'c', marks: 30 }, { userId: 'd', marks: 4 }]);
  assert.deepEqual(placed.map((r) => r.place), [2, 2, 1, 4]);
  const run = (userId, answered, right, wrong, place) => ({ userId, memberId: userId.toUpperCase().padEnd(12, 'X'), place, finishedAt: '2026-10-22T09:00:00Z', right, wrong,
    answers: Array.from({ length: answered }, (_, q) => ({ q, correct: q < right, pick: 0, elapsedMs: (q + 1) * 9000 })) });
  const tie = assignMoments([run('a', 12, 10, 2, 1), run('b', 12, 9, 3, 2)], { count: 30, format: 'race', minutes: 5 });
  assert.ok(!tie.some((m) => m.kind === 'most_answered'), 'a tie at the top: nobody');
  const solo = assignMoments([run('a', 14, 10, 4, 1), run('b', 12, 12, 0, 2)], { count: 30, format: 'race', minutes: 5 });
  assert.deepEqual(solo.find((m) => m.kind === 'most_answered'), { memberId: 'AXXXXXXXXXXX', kind: 'most_answered', count: 14, minutes: 5 });
  assert.ok(!solo.some((m) => m.kind === 'quickest_finish'), 'a race has no finish line');
  assert.equal(solo.find((m) => m.memberId === 'BXXXXXXXXXXX').kind, 'all_right', 'every answered one right');
  // A private run holds "most answered" unshown: nobody else is named for it (L-10).
  const priv = assignMoments([{ ...run('a', 20, 10, 10, null), private: true }, run('b', 12, 12, 0, 1)], { count: 30, format: 'race', minutes: 5 });
  assert.ok(!priv.some((m) => m.kind === 'most_answered'));
  assert.deepEqual(priv.find((m) => m.memberId === 'AXXXXXXXXXXX'), { memberId: 'AXXXXXXXXXXX', kind: 'raced', count: null, minutes: 5 });
});

test('mock trap: the most-missed question (2 or more, half or more), wrong picks break a tie, never a count', () => {
  const keys = [0, 1, 2, 3, 0];
  assert.equal(mockTrap([[0, 1, 2, 3, 0]], keys), null, 'one sitter is not together');
  assert.deepEqual(mockTrap([[0, 0, 2, -1, 0], [0, 0, 2, 3, 1], [0, 2, 2, 1, 0]], keys), { q: 1, number: 2, caught: 'most', optionIndex: 0 }, 'q1: three missed');
  assert.deepEqual(mockTrap([[0, 1, 1, -1, 0], [0, 1, 2, -1, 0]], keys), { q: 3, number: 4, caught: 'most', optionIndex: -1 }, 'two blanks beat one wrong');
  assert.deepEqual(mockTrap([[0, 1, 1, -1, 0], [0, 1, 1, 0, 0]], keys), { q: 2, number: 3, caught: 'most', optionIndex: 1 }, 'tie on missed: more wrong picks');
  assert.equal(mockTrap([[0, 1, 2, 3, 0], [0, 1, 2, 3, 0]], keys), null, 'nothing missed');
});

test('mark sheet: sections in paper order, CUET marks, the runner seconds only when every question has them', () => {
  const sections = [SECTION.Goodwill, SECTION.Ratios, SECTION.Goodwill, null];
  const sheet = markSheet({ sections, picks: [0, 2, -1, 3], keys: [0, 1, 2, 3], seconds: [30, 40, -1, 20] });
  assert.deepEqual(sheet.sections, [
    { key: 'unit_1', label: 'Reconstitution of a Partnership firm', of: 2, marks: 5, right: 1, wrong: 0, skipped: 1, timeMs: null },
    { key: 'unit_5', label: 'Analysis of Financial Statements', of: 1, marks: -1, right: 0, wrong: 1, skipped: 0, timeMs: 40000 },
    { key: 'other', label: 'Other questions', of: 1, marks: 5, right: 1, wrong: 0, skipped: 0, timeMs: 20000 },
  ]);
  const view = sheetView({ marks: 9, right_n: 2, wrong_n: 1, skipped_n: 1, sheet: { ...sheet, timeMs: 1_234_000 } }, { memberId: 'M', name: 'Riya', colour: 3, fold: 'dart', you: false });
  assert.deepEqual([view.marks, view.of, view.accuracy, view.timeMs, view.private], [9, 250, 67, 1_234_000, false]);
  assert.equal(view.sections[0].accuracy, 100);
  const hidden = sheetView({ marks: 9, right_n: 2, wrong_n: 1, skipped_n: 1, sheet }, { memberId: 'M', name: 'Riya', colour: 3, fold: 'dart', you: false }, { hidden: true });
  assert.deepEqual([hidden.marks, hidden.right, hidden.sections, hidden.private], [null, null, null, true]);
});

test('L-55 the broadcast contract: presence is { m, st } from the server only; progress q reaches 60', () => {
  assert.deepEqual(BROADCASTS.presence, ['m', 'st']);
  assert.equal(broadcastOk('presence', { m: 'K7P2M9QXA1B2', st: 'ready' }), true);
  assert.equal(broadcastOk('presence', { m: 'K7P2M9QXA1B2', st: 'left' }), true);
  for (const bad of [{ m: 'K7P2M9QXA1B2', st: 'hello there' }, { m: 'K7P2M9QXA1B2', st: 'here', name: 'Riya' }, { m: 'Riya', st: 'here' }, { m: 'K7P2M9QXA1B2' }]) {
    assert.equal(broadcastOk('presence', bad), false, JSON.stringify(bad));
  }
  assert.equal(broadcastOk('progress', { m: 'K7P2M9QXA1B2', q: 47, done: false }), true);
  assert.equal(broadcastOk('progress', { m: 'K7P2M9QXA1B2', q: 61, done: false }), false);
});

test('the held result of a Mob full mock: kind mock, held until the game closes, then open', () => {
  const closes = '2026-10-23T08:35:00.000Z';
  const attempt = { id: 'a1', correct: 30, details: [{ qid: 'q1', givenIndex: 0, isCorrect: true }], questionsSnapshot: [{ id: 'q1', correctIndex: 0 }],
    selectionMeta: { mode: 'full', mobPaper: { mobId: 'm1', weekStart: '2026-10-19', gameId: 'g1', holdUntil: closes } } };
  const hold = attemptHold(attempt, NOW);
  assert.equal(hold.kind, 'mock');
  assert.equal(hold.until, closes);
  assert.equal(hold.gameId, 'g1');
  assert.match(hold.line, /^This Mob full mock stays open for your Mob until/);
  const held = attemptForClient(attempt, NOW);
  assert.deepEqual([held.details, held.questionsSnapshot, held.selectionMeta.mobPaper.gameId], [[], [], 'g1']);
  assert.equal(attemptForClient(attempt, Date.parse(closes)), attempt, 'open at the close');
});

// ---------------------------------------------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------------------------------------------

const fnDefs = async (db) => Object.fromEntries((await db.query(
  "select p.oid::regprocedure::text f, md5(replace(pg_get_functiondef(p.oid), chr(13), '')) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public', 'mob_private') and p.proname like 'mob_%' order by 1",
)).rows.map((r) => [r.f, r.h]));
const checks = async (db) => (await db.query(
  "select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where conrelid in ('public.mob_games'::regclass, 'public.mob_game_answers'::regclass, 'public.mob_room_tickets'::regclass) and contype = 'c' order by 1, 2",
)).rows;
const policies = async (db) => (await db.query("select policyname, cmd, qual, with_check from pg_policies where schemaname = 'realtime' order by 1")).rows;
const columns = async (db) => (await db.query("select table_name, column_name from information_schema.columns where table_name in ('mob_games','mob_game_runs','mob_room_tickets') order by 1, 2")).rows;

test('migration 140000 applies twice; its undo restores functions, checks, columns and policies exactly, twice', async () => {
  const db = await database({ formats: false });
  try {
    const before = { f: await fnDefs(db), c: await checks(db), p: await policies(db), col: await columns(db) };
    await db.exec(formatsSql);
    await db.exec(formatsSql);
    const during = await fnDefs(db);
    for (const f of ['mob_game_open_v2(text,uuid,text,text,text,text,jsonb,text,date,uuid,timestamp with time zone,integer,smallint)', 'mob_mock_record(text,uuid,text,jsonb,jsonb,timestamp with time zone,timestamp with time zone)', 'mob_room_presence(text,uuid,text,timestamp with time zone)', 'mob_private.mob_room_ok(text)']) assert.ok(during[f], f);
    assert.notEqual(during['mob_run_start(text,uuid,timestamp with time zone)'], before.f['mob_run_start(text,uuid,timestamp with time zone)']);
    assert.deepEqual((await policies(db)).map((p) => p.policyname), ['mob_room_receive'], 'L-55: no insert policy left');
    assert.match((await policies(db))[0].qual, /mob_private\.mob_room_ok/);
    await db.exec(formatsUndo);
    await db.exec(formatsUndo);
    assert.deepEqual(await fnDefs(db), before.f, 'every function back as 20261020100400 left it');
    assert.deepEqual(await checks(db), before.c, 'the checks back under their names');
    assert.deepEqual(await policies(db), before.p, 'receive and presence back as 100300 made them');
    assert.deepEqual(await columns(db), before.col);
    assert.equal(await one(db, "select count(*)::int r from pg_namespace where nspname = 'mob_private'"), 0);
    await db.exec(formatsSql); // and again after the undo
  } finally { await db.close(); }
});

test('migration 140000 shape: a race needs 5 or 10 minutes, a mock 60 and never live, a question game none (a null never slips through)', async () => {
  const db = await database();
  try {
    const svc = serviceFor(db);
    const mobId = await mobOf(svc, 'u1', []);
    const ids = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => `q${i + 1}`));
    const open = (format, mode, n, minutes) => db.query(`select public.mob_game_open_v2('u1', $1::uuid, $2, $3, 'accountancy', null, $4::jsonb, 'open', '2026-10-19', null, now(), 9, $5::smallint) r`, [mobId, format, mode, ids(n), minutes]);
    for (const [format, mode, n, minutes] of [['race', 'async', 30, null], ['race', 'async', 30, 7], ['mock', 'async', 50, null], ['mock', 'live', 50, 60], ['round', 'async', 61, null]]) {
      await assert.rejects(open(format, mode, n, minutes), /check constraint/, `${format} ${mode} ${n} ${minutes}`);
    }
    for (const [format, mode, n, minutes] of [['race', 'async', 30, 5], ['race', 'live', 60, 10], ['mock', 'async', 50, 60], ['sprint', 'async', 5, null]]) {
      assert.equal((await open(format, mode, n, minutes)).rows[0].r.status, 'ok', `${format} ${mode}`);
    }
    await assert.rejects(db.query("update mob_games set minutes = 5 where format = 'sprint'"), /check constraint/, 'a sprint has no minutes');
  } finally { await db.close(); }
});

test('migration 140000 security: new and replaced functions are security invoker, service role only; the one Realtime check is out of the API schema', async () => {
  const db = await database();
  try {
    const rows = (await db.query(`select n.nspname s, p.oid::regprocedure::text sig, p.prosecdef d, coalesce(array_to_string(p.proacl, ','), '') acl, coalesce(array_to_string(p.proconfig, ','), '') cfg
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname in ('mob_game_secs','mob_run_seal','mob_game_open_v2','mob_live_open_v2','mob_run_start','mob_game_answer',
      'mob_mock_begin','mob_mock_record','mob_game_json','mob_game_settle','mob_room_start','mob_room_roster','mob_room_presence','mob_room_ok')`)).rows;
    for (const r of rows) {
      if (r.sig.endsWith('mob_room_ok(text)') || r.sig === 'mob_room_ok(text)') continue;
      assert.equal(r.d, false, r.sig);
      assert.match(r.acl, /service_role=X/, r.sig);
      assert.doesNotMatch(r.acl, /authenticated=X|anon=X|(^|[{,])=X/, r.sig);
      assert.match(r.cfg, /search_path=public/, r.sig);
    }
    const ok = rows.filter((r) => r.sig.includes('mob_room_ok'));
    const pub = ok.find((r) => r.s === 'public'); const priv = ok.find((r) => r.s === 'mob_private');
    assert.doesNotMatch(pub.acl, /authenticated=X/, 'web-security #7: public.mob_room_ok is not callable by a signed-in student any more');
    assert.equal(priv.d, true);
    assert.match(priv.acl, /authenticated=X/);
    assert.match(priv.cfg, /search_path=""/);
    assert.equal((formatsSql.match(/security definer/g) || []).length, 1);
    for (const m of formatsSql.matchAll(/mob_room_send\([^,]+,\s*'([^']+)',\s*([^;]+)\);/g)) {
      const keys = [...m[2].matchAll(/'([A-Za-z]+)'\s*,/g)].map((x) => x[1]);
      for (const k of keys) assert.ok(BROADCASTS[m[1]].includes(k), `${m[1]}: ${k}`);
    }
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------------------------------------------

test('race: one frozen pool, the same order for all, served one question at a time; CUET marks; the clock is the server\'s', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    await assert.rejects(svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 7 }), code('MINUTES_INVALID'));
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 })).game;
    assert.deepEqual([g.format, g.minutes, g.count, g.secondsPerQuestion, g.title], ['race', 5, 30, null, 'Your race']);
    const pool = await idsOf(db, g.id);
    assert.equal(pool.length, 30);
    const a = await svc.v3.startRun('u2', g.id);
    assert.deepEqual(a.questions.map((q) => q.q), [0], 'only the first question at the start');
    assert.equal(a.run.minutes, 5);
    assert.equal(a.run.startedAt, new Date(NOW).toISOString(), 'the server starts the clock at /run');
    assert.equal(a.run.endsAt, new Date(NOW + 5 * MIN).toISOString());
    assert.doesNotMatch(JSON.stringify(a), KEYISH);
    // Out of order: the next question only.
    await assert.rejects(svc.v3.answer('u2', g.id, { q: 3, pick: 0 }), code('Q_INVALID'));
    clock.now += 12_000;
    const r1 = await svc.v3.answer('u2', g.id, { q: 0, pick: keyOf(pool[0]) });
    assert.deepEqual([r1.correct, r1.delta, r1.marks, r1.elapsedMs, r1.answered, r1.finished], [true, 5, 5, 12_000, 1, false]);
    assert.equal(r1.next.q, 1);
    assert.equal(r1.next.stem, BANK.find((q) => q.id === pool[1]).question, 'the next in the pool order');
    assert.doesNotMatch(JSON.stringify(r1.next), KEYISH);
    clock.now += 9000;
    const r2 = await svc.v3.answer('u2', g.id, { q: 1, pick: (keyOf(pool[1]) + 1) % 4 });
    assert.deepEqual([r2.correct, r2.delta, r2.marks], [false, -1, 4]);
    clock.now += 3000;
    const r3 = await svc.v3.answer('u2', g.id, { q: 2, pick: -1 });
    assert.deepEqual([r3.correct, r3.delta, r3.marks, r3.answered, r3.next.q], [null, 0, 4, 3, 3], 'a skip moves on, 0 marks');
    // A retry of an answered question returns the stored result; a resume serves the answered ones and the next only.
    assert.equal((await svc.v3.answer('u2', g.id, { q: 1, pick: keyOf(pool[1]) })).correct, false);
    const resume = await svc.v3.startRun('u2', g.id);
    assert.deepEqual(resume.questions.map((q) => q.q), [0, 1, 2, 3]);
    // Another member gets the same pool in the same order.
    const b = await svc.v3.startRun('u3', g.id);
    assert.equal(b.questions[0].stem, a.questions[0].stem);
    // Finish now: answered = right + wrong; the unserved pool is not skips.
    const fin = await svc.v3.finish('u2', g.id);
    assert.deepEqual(fin.run, { finished: true, marks: 4, answered: 2, right: 1, wrong: 1, skipped: 1 });
    assert.equal(await one(db, "select count(*)::int r from mob_game_answers where user_id = 'u2'"), 3, 'no skip rows for the unserved 27');
  } finally { await db.close(); }
});

test('race timing abuse: an answer after the end plus 2 s is refused and the run sealed; time never passes the minutes; the client sends no time', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 })).game;
    const pool = await idsOf(db, g.id);
    await svc.v3.startRun('u2', g.id);
    // A client-sent time is ignored: only q and pick are read.
    clock.now += 20_000;
    const r = await svc.v3.answer('u2', g.id, { q: 0, pick: keyOf(pool[0]), elapsedMs: 1, at: NOW });
    assert.equal(r.elapsedMs, 20_000);
    // Inside the 2 s grace: counted, with the time capped at 5:00.
    clock.now = NOW + 5 * MIN + 1500;
    const late = await svc.v3.answer('u2', g.id, { q: 1, pick: keyOf(pool[1]) });
    assert.equal(late.elapsedMs, 5 * MIN, 'the time never passes the minutes');
    assert.deepEqual([late.next, late.finished, late.marks], [null, true, 10], 'no question after the end; the race is over');
    await assert.rejects(svc.v3.answer('u2', g.id, { q: 2, pick: keyOf(pool[2]) }), code('RUN_DONE'));
    // Past the grace on another run: refused and sealed.
    const g3 = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 })).game;
    const p3 = await idsOf(db, g3.id);
    clock.now = NOW + 10 * MIN;
    await svc.v3.startRun('u2', g3.id);
    clock.now += 30_000;
    await svc.v3.answer('u2', g3.id, { q: 0, pick: keyOf(p3[0]) });
    clock.now += 5 * MIN - 30_000 + 2500;
    await assert.rejects(svc.v3.answer('u2', g3.id, { q: 1, pick: keyOf(p3[1]) }), (e) => code('RUN_EXPIRED')(e) && e.extra.detail.run.finished === true && e.extra.detail.run.marks === 5);
    await assert.rejects(svc.v3.startRun('u2', g3.id), code('RUN_DONE'));
    // A second /run cannot restart the clock.
    const g2 = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 })).game;
    const s1 = await svc.v3.startRun('u2', g2.id);
    clock.now += 60_000;
    const s2 = await svc.v3.startRun('u2', g2.id);
    assert.equal(s2.run.startedAt, s1.run.startedAt, 'resume keeps the first start');
  } finally { await db.close(); }
});

test('race ghosts: per-answer server times, variable length, answered; no picks, no right or wrong', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 })).game;
    const pool = await idsOf(db, g.id);
    await svc.v3.startRun('u1', g.id);
    for (let q = 0; q < 7; q += 1) { clock.now += 10_000 + q * 1000; await svc.v3.answer('u1', g.id, { q, pick: q === 3 ? -1 : keyOf(pool[q]) }); }
    await svc.v3.finish('u1', g.id);
    const view = (await svc.v3.getGame('u2', g.id)).game;
    assert.equal(view.ghosts.length, 1);
    const ghost = view.ghosts[0];
    assert.deepEqual([ghost.arrivalsMs.length, ghost.answered, ghost.finishedMs], [7, 7, 91_000]);
    assert.deepEqual(ghost.arrivalsMs.slice(0, 3), [10_000, 21_000, 33_000]);
    assert.doesNotMatch(JSON.stringify(view), KEYISH);
    const run = await svc.v3.startRun('u2', g.id);
    assert.equal(run.ghosts[0].answered, 7);
  } finally { await db.close(); }
});

test('race podium: places by CUET marks with shared places, answered per place, the together line over answered questions', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 10 })).game;
    assert.equal(g.count, 60);
    const pool = await idsOf(db, g.id);
    const play = async (u, plan) => {
      await svc.v3.startRun(u, g.id);
      for (const [q, p] of plan.entries()) { clock.now += 8000; await svc.v3.answer(u, g.id, { q, pick: p === 'r' ? keyOf(pool[q]) : p === 'w' ? (keyOf(pool[q]) + 1) % 4 : -1 }); }
      await svc.v3.finish(u, g.id);
    };
    await play('u1', ['r', 'r', 'r', 'r', 'w']); // 19
    await play('u2', ['r', 'r', 'r', 'r', 'w']); // 19, tie
    await play('u3', ['r', 'r', 'r', 's']); // 15
    const p = await svc.v3.podium('u2', g.id);
    assert.deepEqual(p.places.map((x) => [x.name, x.marks, x.place, x.answered]), [['Riya', 19, 1, 5], ['Aarav', 19, 1, 5], ['Kabir', 15, 3, 3]]);
    assert.deepEqual(p.tie, { place: 1, names: ['You', 'Riya'], marks: 19 });
    assert.deepEqual(p.headline, { kind: 'together', right: 11, of: 13 });
    assert.deepEqual([p.format, p.minutes, p.soFar, p.trap], ['race', 10, true, null]);
    assert.ok(p.moments.every((m) => ['most_answered', 'all_right', 'fastest_right', 'three_in_a_row', 'no_minus', 'raced'].includes(m.kind)));
    assert.doesNotMatch(JSON.stringify(p), KEYISH);
  } finally { await db.close(); }
});

test('live race: nothing is served before Go; the run starts at the room start and ends minutes later; progress says how many are answered', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5, mode: 'live' })).game;
    assert.equal(g.room.state, 'lobby');
    const { startsAt } = await svc.v3.roomStart('u1', g.id);
    await assert.rejects(svc.v3.startRun('u2', g.id), (e) => code('RUN_NOT_STARTED')(e) && e.extra.detail.startsAt === startsAt);
    assert.equal(await one(db, 'select count(*)::int r from mob_game_runs'), 0, 'no run before Go');
    assert.equal(await one(db, 'select room_ends_at r from mob_games where id = $1::uuid', [g.id]).then((v) => new Date(v).toISOString()), new Date(Date.parse(startsAt) + 5 * MIN + 10_000).toISOString());
    clock.now = Date.parse(startsAt) + 1000;
    const run = await svc.v3.startRun('u2', g.id);
    assert.deepEqual([run.run.live, run.run.startedAt, run.run.endsAt], [true, startsAt, new Date(Date.parse(startsAt) + 5 * MIN).toISOString()]);
    const pool = await idsOf(db, g.id);
    clock.now += 5000;
    await svc.v3.answer('u2', g.id, { q: 0, pick: keyOf(pool[0]) });
    clock.now += 5000;
    await svc.v3.answer('u2', g.id, { q: 1, pick: -1 });
    const progress = (await sent(db)).filter((x) => x.event === 'progress');
    assert.deepEqual(progress.map((x) => x.payload.q), [1, 2]);
    for (const x of await sent(db)) assert.ok(broadcastOk(x.event, x.payload), `${x.event} ${JSON.stringify(x.payload)}`);
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Every game: the close (web-security #1) and keys across games (#2)
// ---------------------------------------------------------------------------------------------------------------

test('answers stay hidden until close: a run never ends after the close, an answer at the close is refused, open runs are sealed before the review', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
    const close = Date.parse(g.closesAt);
    await assert.rejects(svc.v3.review('u2', g.id), (e) => code('REVIEW_NOT_YET')(e) && e.extra.detail.opensAt === g.closesAt);
    // The 60-second window (web-security #1): start at close - 5 min; the run ends at the close, not a minute after.
    clock.now = close - 5 * MIN;
    const r = await svc.v3.startRun('u2', g.id);
    assert.equal(r.run.endsAt, g.closesAt);
    clock.now = close;
    await assert.rejects(svc.v3.answer('u2', g.id, { q: 0, pick: 0 }), code('RUN_EXPIRED'));
    // A run still open when someone reads the review is sealed first: nobody answers with the keys in view.
    const g2 = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 })).game;
    clock.now = Date.parse(g2.closesAt) - 5 * MIN;
    await svc.v3.startRun('u3', g2.id);
    clock.now = Date.parse(g2.closesAt) + 1;
    const review = await svc.v3.review('u1', g2.id);
    assert.equal(review.questions.length, 0, 'a race shows only the questions you were served');
    assert.ok(await one(db, "select finished_at is not null r from mob_game_runs where user_id = 'u3' and game_id = $1::uuid", [g2.id]), 'sealed at the settle');
    await assert.rejects(svc.v3.answer('u3', g2.id, { q: 0, pick: 0 }), code('RUN_DONE'));
  } finally { await db.close(); }
});

test('keys across games: a new game never draws an open game\'s questions; a review holds a key that sits in another open game', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    const a = (await svc.v3.openGame('u1', { mob: mobId, format: 'round', count: 20 })).game;
    const b = (await svc.v3.openGame('u2', { mob: mobId, format: 'round', count: 20 })).game;
    const [ia, ib] = [await idsOf(db, a.id), await idsOf(db, b.id)];
    assert.equal(ia.filter((id) => ib.includes(id)).length, 0, 'no shared question');
    // Force a shared question (an older game), close A, and read A's review while B is open.
    await db.query("update mob_games set question_ids = jsonb_set(question_ids, '{0}', to_jsonb($2::text)) where id = $1::uuid", [b.id, ia[3]]);
    await db.query("update mob_games set opened_at = opened_at - interval '25 hours', closes_at = closes_at - interval '25 hours' where id = $1::uuid", [a.id]);
    const review = await svc.v3.review('u1', a.id);
    const shared = review.questions[3];
    assert.deepEqual([shared.correctIndex, shared.explanation, shared.held], [null, null, true]);
    assert.equal(review.questions[4].correctIndex, keyOf(ia[4]), 'the others open');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Full mock together
// ---------------------------------------------------------------------------------------------------------------

let MOB = null; // the Mob of the test in progress (attempts carry its id in their tag)
const attemptFor = (userId, gameId, ids, plan, at, id = `att_${userId}`) => ({
  id, userId, correct: plan.filter((p) => p === 'r').length, total: ids.length, completedAt: at,
  details: ids.map((qid, i) => ({ qid, givenIndex: plan[i] === 'r' ? keyOf(qid) : plan[i] === 'w' ? (keyOf(qid) + 1) % 4 : -1 })),
  selectionMeta: { mode: 'full', mobPaper: { mobId: MOB, weekStart: '2026-10-19', gameId } },
});
const planOf = (pattern) => Array.from({ length: 50 }, (_, i) => pattern(i));

test('full mock: Pro starts it with billing on (Free sees it locked); one 50-question paper; never live; a race or round still Free', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock, billing: true, premium: (u) => u === 'u1' });
    const mobId = await mobOf(svc, 'u1', ['u2']);
    await assert.rejects(svc.v3.openGame('u2', { mob: mobId, format: 'mock' }), code('START_PRO'));
    assert.deepEqual((await svc.view('u2', { mobId })).mob.v3.starts.locked, ['mock']);
    await assert.rejects(svc.v3.openGame('u1', { mob: mobId, format: 'mock', mode: 'live' }), code('BODY_INVALID'));
    await assert.rejects(svc.v3.openGame('u1', { mob: mobId, format: 'mock', chapter: 'Goodwill' }), code('BODY_INVALID'));
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'mock' })).game;
    assert.deepEqual([g.format, g.mode, g.count, g.minutes, g.title, g.room], ['mock', 'async', 50, 60, 'Your full mock', null]);
    assert.equal(Date.parse(g.closesAt) - Date.parse(g.openedAt), 24 * 3600_000);
    await assert.rejects(svc.v3.startRun('u2', g.id), code('RUN_PAPER'), 'sat in the practice runner, not the game runner');
    // A Free member still starts a race with the weekly start.
    assert.equal((await svc.v3.openGame('u2', { mob: mobId, format: 'race', minutes: 5 })).game.format, 'race');
    await assert.rejects(svc.v3.openGame('u2', { mob: mobId, format: 'race', minutes: 10 }), code('START_USED'));
    // MOB_FORMATS_ENABLED off: neither format starts.
    const off = serviceFor(db, { clock, formats: false });
    await assert.rejects(off.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5 }), code('BODY_INVALID'));
  } finally { await db.close(); }
});

test('full mock sitting: the practice runner in mode full, no credits, the same paper, held until close; the hand-in goes on the game', async () => {
  const db = await database();
  const clock = { now: NOW };
  const practice = [];
  const attempts = [];
  try {
    const svc = serviceFor(db, { clock, practice, attempts });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    MOB = mobId;
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'mock' })).game;
    const ids = await idsOf(db, g.id);
    const s = await svc.startPaper('u2', { mob: mobId, game: g.id });
    assert.deepEqual(s, { sessionId: 's_u2', mode: 'full', count: 50 });
    const call = practice.at(-1);
    assert.deepEqual([call.input.mode, call.input.count, call.input.subject], ['full', 50, 'accountancy']);
    assert.deepEqual(call.server.mobPaper.questions.map((q) => q.id), ids, 'the frozen paper, in order');
    assert.deepEqual([call.server.mobPaper.gameId, call.server.mobPaper.holdUntil, call.server.mobPaper.mobId], [g.id, g.closesAt, mobId]);
    assert.equal((await svc.v3.getGame('u2', g.id)).game.you.run, 'playing');
    await svc.startPaper('u3', { mob: mobId, game: g.id });
    assert.equal(practice.at(-1).server.mobPaper.questions[0].id, ids[0], 'the same for every member');
    // Hand-in through the finish hook: CUET marks, the sheet with sections, the server's time.
    clock.now += 40 * MIN;
    const plan2 = planOf((i) => (i < 30 ? 'r' : i < 40 ? 'w' : 's'));
    assert.equal(await svc.recordFromAttempt('u2', attemptFor('u2', g.id, ids, plan2, clock.now)), 'recorded');
    assert.equal(await svc.recordFromAttempt('u2', attemptFor('u2', g.id, ids, plan2, clock.now)), 'exists');
    const run = (await db.query("select marks, right_n, wrong_n, skipped_n, sheet, session_id from mob_game_runs where user_id = 'u2'")).rows[0];
    assert.deepEqual([run.marks, run.right_n, run.wrong_n, run.skipped_n, run.session_id], [140, 30, 10, 10, 'att_u2']);
    assert.equal(run.sheet.timeMs, 40 * MIN);
    assert.deepEqual(run.sheet.sections.map((x) => x.key), [...new Set(ids.map((id) => SECTION[BANK.find((q) => q.id === id).chapter].key))]);
    assert.equal(run.sheet.sections.reduce((n, x) => n + x.of, 0), 50);
    // The quest counts the answered 40.
    assert.equal((await svc.view('u1', { mobId })).mob.v3.quest.answered, 40);
    // The durable path: a hand-in found on the next read.
    attempts.push(attemptFor('u3', g.id, ids, planOf((i) => (i < 20 ? 'r' : 'w')), clock.now + 5 * MIN));
    clock.now += 10 * MIN;
    const view = (await svc.v3.getGame('u3', g.id)).game;
    assert.deepEqual([view.you.run, view.you.marks, view.you.resultId], ['finished', 70, 'att_u3']);
    // Too late to start: under 60 minutes left.
    clock.now = Date.parse(g.closesAt) - 59 * MIN;
    await assert.rejects(svc.startPaper('u1', { mob: mobId, game: g.id }), code('MOCK_TOO_LATE'));
    await assert.rejects(svc.startPaper('u2', { mob: mobId, game: g.id }), code('RUN_DONE'));
    // A hand-in at or after the close is late.
    assert.equal(await svc.recordFromAttempt('u1', attemptFor('u1', g.id, ids, plan2, Date.parse(g.closesAt))), 'late');
  } finally { await db.close(); }
});

test('full mock mark sheets: counts and sections so far, never which question; private sheets hidden; after close the most-missed question is Fix it together', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    MOB = mobId;
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'mock' })).game;
    const ids = await idsOf(db, g.id);
    await assert.rejects(svc.v3.podium('u2', g.id), code('PODIUM_NOT_YET'));
    for (const u of ['u1', 'u2', 'u3']) await svc.startPaper(u, { mob: mobId, game: g.id });
    clock.now += 50 * MIN;
    // Question 7 is missed by everyone; u3 keeps their marks private.
    await svc.recordFromAttempt('u1', attemptFor('u1', g.id, ids, planOf((i) => (i === 7 ? 'w' : i < 35 ? 'r' : 's')), clock.now));
    await svc.recordFromAttempt('u2', attemptFor('u2', g.id, ids, planOf((i) => (i === 7 ? 's' : i < 35 ? 'r' : 'w')), clock.now + 1000));
    await svc.recordFromAttempt('u3', attemptFor('u3', g.id, ids, planOf((i) => (i === 7 ? 'w' : 'r')), clock.now + 2000));
    await svc.patchMe('u3', { mob: mobId, showScore: false });
    const p = await svc.v3.podium('u2', g.id);
    assert.equal(p.soFar, true);
    assert.deepEqual(p.sheets.map((x) => [x.name, x.marks, x.of, x.right, x.wrong, x.skipped, x.private]), [
      ['Riya', 169, 250, 34, 1, 15, false], ['Aarav', 155, 250, 34, 15, 1, false], ['Kabir', null, 250, null, null, null, true]]);
    assert.ok(p.sheets[0].sections.length >= 2 && p.sheets[0].sections.every((x) => Number.isInteger(x.marks) && x.label));
    assert.equal(p.trap, null, 'no trap before close');
    assert.doesNotMatch(JSON.stringify(p), KEYISH);
    assert.doesNotMatch(JSON.stringify(p), /"q\d+"/, 'no question id');
    // After close: the most-missed question, Fix it together on it, and the review.
    clock.now = Date.parse(g.closesAt) + 1;
    const closed = await svc.v3.podium('u2', g.id);
    assert.deepEqual(closed.trap, { q: 7, number: 8, caught: 'most' });
    const fix = await svc.v3.fixStart('u2', { game: g.id, q: 7, stage: 'now' });
    assert.equal(fix.trap.correctIndex, keyOf(ids[7]));
    assert.ok(!ids.includes((await db.query("select question_id r from mob_fix_checks where user_id = 'u2'")).rows[0].r), 'a fresh question, not one of the paper');
    const review = await svc.v3.review('u2', g.id);
    assert.equal(review.questions.length, 50);
    assert.equal(review.questions[0].correctIndex, keyOf(ids[0]));
  } finally { await db.close(); }
});

test('full mock: a member who opened it and never handed it in leaves no run at the close; nobody is counted as not having played', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'mock' })).game;
    await svc.startPaper('u2', { mob: mobId, game: g.id });
    const den = (await svc.view('u1', { mobId })).mob.v3.games.find((x) => x.id === g.id);
    assert.deepEqual([den.format, den.minutes, den.runs, den.yourRun], ['mock', 60, [], 'none'], 'a playing member is not listed');
    clock.now = Date.parse(g.closesAt) + 1;
    await svc.v3.getGame('u1', g.id);
    assert.equal(await one(db, 'select count(*)::int r from mob_game_runs where game_id = $1::uuid', [g.id]), 0);
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Live presence (L-55)
// ---------------------------------------------------------------------------------------------------------------

test('L-55 live presence: no client can write to a room channel; presence goes through the API with a ticket, broadcasts only { m, st } on a change, and drops after 45 s', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await mobOf(svc, 'u1', ['u2', 'u3']);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'race', minutes: 5, mode: 'live' })).game;
    const m2 = memberIdFor('test-secret', mobId, 'u2');
    await assert.rejects(svc.v3.roomPresence('u2', g.id, { st: 'here' }), code('NO_TICKET'), 'a ticket first');
    await svc.v3.roomTicket('u2', UID(2), g.id);
    await svc.v3.roomTicket('u3', UID(3), g.id);
    // A modified client tries to write anything on the channel: refused, presence and broadcast alike.
    await db.exec(`set rt.uid = '${UID(2)}'; set rt.topic = 'mob-room:${g.id}'; set role authenticated;`);
    for (const ext of ['presence', 'broadcast']) {
      await assert.rejects(db.query("insert into realtime.messages (topic, extension, payload) values ($1, $2, '{\"m\":\"x\",\"text\":\"hi\"}')", [`mob-room:${g.id}`, ext]), /row-level security/, ext);
    }
    await assert.rejects(db.query('select public.mob_room_ok($1)', [`mob-room:${g.id}`]), /permission denied/, 'public.mob_room_ok is not callable');
    await db.exec('reset role');
    await db.query("insert into realtime.messages (topic, extension, payload) values ($1, 'broadcast', '{}')", [`mob-room:${g.id}`]);
    await db.exec(`set rt.uid = '${UID(2)}'; set rt.topic = 'mob-room:${g.id}'; set role authenticated;`);
    assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n, 1, 'still receives the server\'s messages');
    await db.exec('reset role');
    // Through the API.
    for (const bad of [{}, { st: 'hello' }, { st: 'here', text: 'hi' }].slice(0, 2)) await assert.rejects(svc.v3.roomPresence('u2', g.id, bad), code('BODY_INVALID'));
    await db.query('delete from realtime.sent');
    const a = await svc.v3.roomPresence('u2', g.id, { st: 'here' });
    assert.deepEqual(a.roster, [{ memberId: m2, st: 'here' }]);
    clock.now += 20_000;
    await svc.v3.roomPresence('u2', g.id, { st: 'here' }); // heartbeat: no broadcast
    await svc.v3.roomPresence('u2', g.id, { st: 'ready' });
    const out = (await sent(db)).filter((x) => x.event === 'presence');
    assert.deepEqual(out.map((x) => x.payload), [{ m: m2, st: 'here' }, { m: m2, st: 'ready' }]);
    for (const x of out) assert.ok(broadcastOk('presence', x.payload));
    // The game view and the ticket carry the roster.
    assert.deepEqual((await svc.v3.getGame('u3', g.id)).game.room.roster, [{ memberId: m2, st: 'ready' }]);
    // Not heard from for 45 s: off the roster; heard again: back, and broadcast.
    clock.now += 46_000;
    assert.deepEqual((await svc.v3.roomTicket('u3', UID(3), g.id)).room.roster, []);
    await svc.v3.roomPresence('u2', g.id, { st: 'ready' });
    assert.equal((await sent(db)).filter((x) => x.event === 'presence').length, 3);
    // Leaving: broadcast left, off the roster; a member who left the Mob loses the ticket.
    const left = await svc.v3.roomPresence('u2', g.id, { st: 'left' });
    assert.deepEqual(left.roster, []);
    assert.deepEqual((await sent(db)).filter((x) => x.event === 'presence').at(-1).payload, { m: m2, st: 'left' });
    await svc.v3.roomPresence('u3', g.id, { st: 'here' });
    await svc.leave('u3', { mob: mobId });
    assert.deepEqual((await svc.v3.getGame('u1', g.id)).game.room.roster, [], 'revoked on leave');
    assert.doesNotMatch(JSON.stringify(await sent(db)), /Aarav|Kabir|Riya|"u\d"/, 'no names or user ids on the channel');
  } finally { await db.close(); }
});

test('routes: race and mock through the same game routes; room presence is 404 with v3 off, 409 LIVE_OFF, rate-limited', async () => {
  assert.ok(ACTIONS.roomPresence);
  assert.deepEqual(ACTIONS.roomPresence.slice(0, 2), ['POST', ['presence']]);
  assert.deepEqual(LIMITS.presence, { limit: 240, windowMs: 3600_000, by: 'user' });
  const req = (body) => new Request('http://localhost/api/mob', { method: 'POST', body: JSON.stringify(body) });
  const deps = (over = {}) => ({ enabled: () => true, v3Enabled: () => true, liveEnabled: () => true, auth: async () => ({ user: { id: 'u1' } }), rateLimit: async () => ({ allowed: true }), cors: () => ({}),
    service: { v3: { roomPresence: async (_u, id, b) => ({ ok: true, id, st: b.st }) } }, ...over });
  assert.equal((await handleMob(deps({ v3Enabled: () => false }), 'roomPresence', req({ st: 'here' }), { id: 'g' })).status, 404);
  const off = await handleMob(deps({ liveEnabled: () => false }), 'roomPresence', req({ st: 'here' }), { id: 'g' });
  assert.deepEqual([off.status, (await off.json()).error.code], [409, 'LIVE_OFF']);
  const ok = await handleMob(deps(), 'roomPresence', req({ st: 'ready' }), { id: 'g' });
  assert.deepEqual(await ok.json(), { ok: true, id: 'g', st: 'ready' });
  assert.match(read('src/app/api/mob/game/[id]/room/presence/route.js'), /handleMob\(mobDeps\(\), 'roomPresence'/);
  // New sentences: plain, no price, no night framing, and the codes the clients map.
  for (const c of ['MINUTES_INVALID', 'RUN_NOT_STARTED', 'RUN_PAPER', 'MOCK_TOO_LATE', 'NO_TICKET']) {
    assert.ok(ERRORS[c], c);
    assert.doesNotMatch(ERRORS[c][1], /₹|\bRs\b|price|!|night/i, c);
  }
  assert.match(read('src/lib/server/mob/deps.js'), /MOB_FORMATS_ENABLED === 'true'/);
});

test('the formats migration header says staging only and names its undo file', () => {
  assert.match(formatsSql, /Applied to staging only by this change\. Undo: supabase\/undo\/20261020140000_mob_v3_formats\.undo\.sql/);
  assert.match(formatsUndo, /NOT a migration/);
});
