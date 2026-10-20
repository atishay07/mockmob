// Mob hours (owner D173 item 1, approved D174; MOB-V4-BUILD.md item 2): the opt-in, the weekly aggregate and the `hours` object on
// the den. Migration 20261020150000_mob_hours on a real Postgres (PGlite) with its undo, the service and the route handler.
// One test per rule: opt-out hidden, zero-minute hidden, 3-minute cap, IST week boundary, "studying now" window, the daily-goal
// days, PATCH validation, the payload absent when the migration is missing, privacy of the payload.
// Run: node --test data/tests/mob_hours_1020.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MobError } from '../../src/lib/mob/model.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
import { handleMob } from '../../src/lib/server/mob/http.js';
import { HOURS_TARGET_PER_MEMBER, createHoursReader, hoursView, readHours } from '../../src/lib/server/mob/hours.js';
import { scoreSession, scorePracticeSubmission, submitMeta } from '../recovery.js';
import { readTrace } from '../paper_trace.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BEFORE = ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games',
  '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live', '20261020140000_mob_v3_formats'];
const HOURS = '20261020150000_mob_hours';
const hoursSql = read(`supabase/migrations/${HOURS}.sql`);
const hoursUndo = read(`supabase/undo/${HOURS}.undo.sql`);
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Thursday 22 Oct 2026, 2:05 PM IST. The IST week is Monday 19 Oct.
const NOW = Date.parse('2026-10-22T08:35:00Z');
const WEEK = '2026-10-19';
const MIN = 60_000;
const iso = (ms) => new Date(ms).toISOString();

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

// The real columns of public.recovery_sessions (20261001105920) and the daily goal column (20261020110000).
async function database({ hours = true, goals = true } = {}) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,12) g;");
  await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await db.exec(`create table public.recovery_sessions (id text primary key, user_id text not null references public.users(id), request_key text not null,
      subject text not null, mode text not null, state text not null check (state in ('active','submitted')), questions jsonb not null,
      selection_meta jsonb not null default '{}', events jsonb not null default '[]', created_at timestamptz not null, expires_at timestamptz not null,
      unique (user_id, request_key));`);
  if (goals) await db.exec('create table public.study_goals (user_id text primary key references public.users(id), daily_minutes smallint);');
  await db.exec(STUBS);
  for (const f of BEFORE) await db.exec(read(`supabase/migrations/${f}.sql`));
  if (hours) { await db.exec(hoursSql); await db.exec(hoursSql); } // idempotent
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
function serviceFor(db, { clock = { now: NOW }, v3 = true, cacheMs = 0, rpc = pgRpc(db) } = {}) {
  let seed = 1;
  return createMobService({
    rpc, now: () => clock.now, hoursCacheMs: cacheMs, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (s === 'accountancy' ? { ok: true, id: s, name: 'Accountancy' } : { ok: false }),
    loadUser: async () => ({ subjects: ['accountancy'], isPremium: false }),
    validChapter: () => true, pickQuestionIds: async () => [], loadQuestions: async () => [], sectionsFor: () => [], trapNameFor: async () => null,
    findAttempts: async () => [], startPractice: async () => ({}),
    v3Enabled: () => v3, billingOn: () => false, liveEnabled: () => false, formatsEnabled: () => false,
  });
}
const code = (c) => (e) => { assert.ok(e instanceof MobError, String(e)); assert.equal(e.code, c); return true; };
// u1 Riya (owner), u2 Aarav, u3 Kabir, u4 Zoya.
async function mobOf(svc, owner, others) {
  const mobId = (await svc.create(owner, { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'dart' })).mob.id;
  const inv = await svc.invite(owner, { mob: mobId });
  const names = ['Aarav', 'Kabir', 'Zoya', 'Meher'];
  for (const [i, u] of others.entries()) await svc.join(u, { code: inv.code, name: names[i], colour: 1 });
  return mobId;
}

// A session's events: each question {qid, secs, answer} is visited, answered a second in (answer null: only looked at) and left
// after `secs`; the paper ends after the last one. So the time on a question is exactly its `secs`.
function eventsOf(qs, extra = []) {
  let t = 0; let seq = 1; const ev = [];
  for (const q of qs) {
    ev.push({ seq: seq++, qid: q.qid, at: t, type: 'visit' });
    if (q.answer !== null && q.answer !== undefined) ev.push({ seq: seq++, qid: q.qid, at: t + 1000, type: 'answer', answer: q.answer });
    for (const x of q.inside || []) ev.push({ seq: seq++, qid: q.qid, ...x });
    t += q.secs * 1000;
  }
  ev.push({ seq: seq++, qid: qs.at(-1).qid, at: t, type: 'end', reason: 'submit' });
  return [...ev, ...extra];
}
let sid = 0;
async function addSession(db, user, startIso, qs, events = null) {
  sid += 1;
  await db.query(
    `insert into public.recovery_sessions (id, user_id, request_key, subject, mode, state, questions, events, created_at, expires_at)
     values ($1, $2, $1, 'accountancy', 'quick', 'submitted', '[]'::jsonb, $3::jsonb, $4::timestamptz, $4::timestamptz + interval '3 hours')`,
    [`s${sid}`, user, JSON.stringify(events || eventsOf(qs)), startIso]);
}
const hoursRaw = (db, user, mobId, { week = WEEK, now = NOW } = {}) => one(db, 'select public.mob_hours($1, $2::uuid, $3::date, $4::timestamptz) as r', [user, mobId, week, iso(now)]);
const share = (svc, user, mob, on = true) => svc.patchMe(user, { mob, share_study_time: on });
const hoursOf = async (svc, user, mob) => (await svc.view(user, { mobId: mob, sync: false })).mob.v3.hours;
const MON_10AM = '2026-10-19T04:30:00Z'; // Monday 10:00 IST

test('the switch is off for everyone by default, existing members included, and the migration is idempotent', async () => {
  const db = await database({ hours: false });
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2']);
  await db.exec(hoursSql); await db.exec(hoursSql);
  assert.deepEqual((await db.query('select user_id, share_study_time from mob_members order by user_id')).rows, [
    { user_id: 'u1', share_study_time: false }, { user_id: 'u2', share_study_time: false }]);
  const h = await hoursOf(svc, 'u1', mob);
  assert.deepEqual([h.me_sharing, h.target_minutes, h.total_minutes, h.members, h.top_member_id, h.studying_now], [false, 0, 0, [], null, []]);
});

test('opt-out hidden: a member who does not share never appears, and their time is never read', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2', 'u3']);
  await share(svc, 'u1', mob); // Riya shares, Aarav (u2) and Kabir (u3) do not
  await addSession(db, 'u1', MON_10AM, [{ qid: 'a', secs: 120, answer: 1 }, { qid: 'b', secs: 60, answer: 2 }]);
  await addSession(db, 'u2', MON_10AM, [{ qid: 'a', secs: 170, answer: 1 }, { qid: 'b', secs: 170, answer: 2 }]);
  const raw = await hoursRaw(db, 'u3', mob);
  assert.deepEqual(raw.rows.map((r) => r.user_id), ['u1'], 'the aggregate only ever returns sharing members');
  assert.equal(raw.sharing, 1);
  const h = await hoursOf(svc, 'u3', mob); // read by a member who does not share: they still see the Mob's figure
  assert.deepEqual(h.members.map((m) => [m.first_name, m.minutes]), [['Riya', 3]]);
  assert.equal(h.total_minutes, 3);
  assert.equal(h.target_minutes, HOURS_TARGET_PER_MEMBER);
  assert.equal(h.me_sharing, false);
  assert.ok(!JSON.stringify(h).includes('Aarav'), 'the non-sharing member is not in the payload at all');
  // Switching it off removes them again at once.
  await share(svc, 'u1', mob, false);
  const off = await hoursOf(svc, 'u3', mob);
  assert.deepEqual([off.members, off.total_minutes, off.target_minutes], [[], 0, 0]);
});

test('zero-minute hidden: under a minute, or only looked at, is not listed (but still counts toward the target)', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2', 'u3']);
  for (const u of ['u1', 'u2', 'u3']) await share(svc, u, mob);
  await addSession(db, 'u1', MON_10AM, [{ qid: 'a', secs: 59, answer: 0 }]); // 59 s: under a minute
  await addSession(db, 'u2', MON_10AM, [{ qid: 'a', secs: 170, answer: null }, { qid: 'b', secs: 170, answer: null }]); // looked, never answered
  await addSession(db, 'u3', MON_10AM, [{ qid: 'a', secs: 90, answer: 3 }]);
  const h = await hoursOf(svc, 'u1', mob);
  assert.deepEqual(h.members.map((m) => [m.first_name, m.minutes]), [['Kabir', 1]]);
  assert.equal(h.target_minutes, 3 * HOURS_TARGET_PER_MEMBER, 'all three share, so the target is for three');
  assert.equal(h.total_minutes, 1);
  assert.ok(!JSON.stringify(h.members).includes('Riya') && !JSON.stringify(h.members).includes('Aarav'));
});

test('cap: one answered question counts at most 180 seconds, in every session', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2']);
  await share(svc, 'u1', mob); await share(svc, 'u2', mob);
  // u1: one question left open for 10 minutes (counts 3) and one of 60 s (counts 1): 4 minutes.
  await addSession(db, 'u1', MON_10AM, [{ qid: 'a', secs: 600, answer: 1 }, { qid: 'b', secs: 60, answer: 2 }]);
  // u2: exactly 180 s and 181 s both count 3; two sessions add up (3 + 3 + 2 = 8).
  await addSession(db, 'u2', MON_10AM, [{ qid: 'a', secs: 180, answer: 0 }, { qid: 'b', secs: 181, answer: 0 }]);
  await addSession(db, 'u2', '2026-10-20T04:30:00Z', [{ qid: 'a', secs: 125, answer: 0 }]);
  const h = await hoursOf(svc, 'u1', mob);
  assert.deepEqual(h.members.map((m) => [m.first_name, m.minutes]), [['Aarav', 8], ['Riya', 4]], 'most minutes first');
  assert.equal(h.total_minutes, 12);
  // A 30-minute gap on a record with no away data is a break, not time on the question (data/paper_trace.js rule 4).
  await addSession(db, 'u1', '2026-10-21T04:30:00Z', null, [
    { seq: 1, qid: 'a', at: 0, type: 'visit' }, { seq: 2, qid: 'a', at: 1000, type: 'answer', answer: 1 },
    { seq: 3, qid: 'b', at: 40 * MIN, type: 'visit' }, { seq: 4, qid: 'b', at: 40 * MIN + 1000, type: 'answer', answer: 1 },
    { seq: 5, qid: 'b', at: 40 * MIN + 30_000, type: 'end', reason: 'submit' }]);
  assert.equal((await hoursOf(svc, 'u1', mob)).members.find((m) => m.first_name === 'Riya').minutes, 4, 'the 40-minute gap counts nothing (it would add 3 minutes if it did) and b is 30 s');
});

test('the time rule matches the result screens: time away, the submit sheet and unanswered questions are not counted', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', []);
  await share(svc, 'u1', mob);
  // a: 60 s on screen, then 100 s away (not counted), then 30 s back (counts); b: looked at for 100 s, never answered; c: 40 s then the
  // submit sheet open for 120 s (credited to nobody).
  const ev = [
    { seq: 1, qid: 'a', at: 0, type: 'visit' }, { seq: 2, qid: 'a', at: 5000, type: 'answer', answer: 2 },
    { seq: 3, qid: 'a', at: 60_000, type: 'away' }, { seq: 4, qid: 'a', at: 160_000, type: 'back' },
    { seq: 5, qid: 'b', at: 190_000, type: 'visit' },
    { seq: 6, qid: 'c', at: 290_000, type: 'visit' }, { seq: 7, qid: 'c', at: 295_000, type: 'answer', answer: 1 },
    { seq: 8, qid: 'c', at: 330_000, type: 'visit', via: 'sheet' },
    { seq: 9, qid: 'c', at: 450_000, type: 'end', reason: 'submit' }];
  await addSession(db, 'u1', MON_10AM, null, ev);
  const raw = await hoursRaw(db, 'u1', mob);
  // a = 60 + 30 = 90 s, c = 40 s: 130 s = 2 whole minutes.
  assert.equal(raw.rows[0].minutes, 2);
});

test('IST week boundary: Sunday 11:59 PM IST belongs to the week before, Monday 12:00 AM IST to the new week', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2', 'u3']);
  for (const u of ['u1', 'u2', 'u3']) await share(svc, u, mob);
  // The last answer lands at start + 1 s. A 2-minute question each.
  const at = (isoStart) => ({ qid: 'a', secs: 120, answer: 1, isoStart });
  // u1: answer at Sun 18 Oct 11:59:30 PM IST (2026-10-18T18:29:30Z): last week.
  await addSession(db, 'u1', '2026-10-18T18:29:29Z', [at()]);
  // u2: answer at Mon 19 Oct 12:00:30 AM IST: this week.
  await addSession(db, 'u2', '2026-10-18T18:30:29Z', [at()]);
  // u3: answer at Mon 26 Oct 12:00:30 AM IST: next week, and Sun 25 Oct 11:59 PM IST: this week (two sessions).
  await addSession(db, 'u3', '2026-10-25T18:30:29Z', [at()]);
  await addSession(db, 'u3', '2026-10-25T18:29:00Z', [at()]);
  const late = NOW + 4 * 24 * 60 * MIN; // Monday 26 Oct, so nothing is "studying now"
  const rows = (await hoursRaw(db, 'u1', mob, { now: late })).rows;
  assert.deepEqual(rows.map((r) => [r.user_id, r.minutes]), [['u2', 2], ['u3', 2]], 'u1 (Sunday night) is out; u3 has only the Sunday 25 Oct session');
  const next = (await hoursRaw(db, 'u1', mob, { week: '2026-10-26', now: late })).rows;
  assert.deepEqual(next.map((r) => [r.user_id, r.minutes]), [['u3', 2]]);
  const prev = (await hoursRaw(db, 'u1', mob, { week: '2026-10-12' })).rows;
  assert.deepEqual(prev.map((r) => [r.user_id, r.minutes]), [['u1', 2]]);
});

test('studying now: sharing members with a practice answer in the last 10 minutes, since their first answer in that window', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2', 'u3', 'u4']);
  for (const u of ['u1', 'u2', 'u3']) await share(svc, u, mob); // u4 does not share
  const start = (minutesAgo) => iso(NOW - minutesAgo * MIN);
  // u1 answered a first question 8 min ago and another 3 min ago (one running session, still open).
  await db.query(
    `insert into public.recovery_sessions (id, user_id, request_key, subject, mode, state, questions, events, created_at, expires_at)
     values ('live1', 'u1', 'live1', 'accountancy', 'quick', 'active', '[]'::jsonb, $1::jsonb, $2::timestamptz, $2::timestamptz + interval '3 hours')`,
    [JSON.stringify([{ seq: 1, qid: 'a', at: 0, type: 'visit' }, { seq: 2, qid: 'a', at: 30_000, type: 'answer', answer: 0 },
      { seq: 3, qid: 'b', at: 60_000, type: 'visit' }, { seq: 4, qid: 'b', at: 5 * MIN, type: 'answer', answer: 2 }]), start(9)]);
  // u2 last answered 13 minutes ago: not now. u4 answered a minute ago but does not share: never shown.
  await addSession(db, 'u2', start(15), [{ qid: 'a', secs: 120, answer: 1 }, { qid: 'b', secs: 120, answer: 1 }]);
  await addSession(db, 'u4', start(2), [{ qid: 'a', secs: 60, answer: 1 }]);
  const h = await hoursOf(svc, 'u3', mob);
  const riya = memberIdFor('test-secret', mob, 'u1');
  assert.deepEqual(h.studying_now.map((s) => [s.member_id, s.first_name]), [[riya, 'Riya']]);
  assert.equal(h.studying_now[0].since, iso(NOW - 9 * MIN + 30_000), 'since the first answer inside the 10 minutes (8.5 minutes ago)');
  assert.ok(!JSON.stringify(h).includes('Zoya'), 'a member who does not share is never "studying now"');
  // Move the clock 20 minutes on: her last answer is then 24 minutes old, so she is no longer studying.
  const later = serviceFor(db, { clock: { now: NOW + 20 * MIN } });
  assert.deepEqual((await later.view('u3', { mobId: mob, sync: false })).mob.v3.hours.studying_now, []);
});

test('goal days: days of the week on which the capped minutes reached the member own daily goal (20 by default)', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2']);
  await share(svc, 'u1', mob); await share(svc, 'u2', mob);
  await db.exec("insert into public.study_goals (user_id, daily_minutes) values ('u1', 10)"); // u2 has no goal: 20 minutes
  const qs = (n) => Array.from({ length: n }, (_, i) => ({ qid: `q${i}`, secs: 300, answer: 0 })); // each counts 3 minutes
  // Mon 12 minutes, Tue 6, Wed 3 + 6 = 9 (two sessions), Thu 12, Fri 24.
  for (const u of ['u1', 'u2']) {
    await addSession(db, u, '2026-10-19T04:30:00Z', qs(4));
    await addSession(db, u, '2026-10-20T04:30:00Z', qs(2));
    await addSession(db, u, '2026-10-21T04:30:00Z', qs(1));
    await addSession(db, u, '2026-10-21T10:30:00Z', qs(2));
    await addSession(db, u, '2026-10-22T04:30:00Z', qs(4));
    await addSession(db, u, '2026-10-23T04:30:00Z', qs(8));
  }
  const by = Object.fromEntries((await hoursOf(svc, 'u1', mob)).members.map((m) => [m.first_name, m]));
  assert.deepEqual([by.Riya.minutes, by.Riya.goal_days], [63, 3], 'goal 10: Monday, Thursday and Friday');
  assert.deepEqual([by.Aarav.minutes, by.Aarav.goal_days], [63, 1], 'no goal set, so 20: Friday only');
});

test('PATCH share_study_time: boolean only, v3 only, a member of the Mob only, and the answer is the den', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2']);
  for (const bad of ['yes', 1, 0, null, {}, [], 'true']) {
    await assert.rejects(svc.patchMe('u1', { mob, share_study_time: bad }), code('BODY_INVALID'), JSON.stringify(bad));
  }
  await assert.rejects(svc.patchMe('u1', { mob }), code('BODY_INVALID'), 'nothing to change');
  await assert.rejects(svc.patchMe('u1', { mob, name: 'Rhea', share_study_time: 'yes' }), code('BODY_INVALID'), 'a bad switch refuses the whole body');
  assert.equal((await svc.view('u1', { mobId: mob, sync: false })).mob.you.name, 'Riya', 'and the name did not change');
  await assert.rejects(svc.patchMe('u9', { mob, share_study_time: true }), code('NOT_IN_MOB'));
  const out = await svc.patchMe('u2', { mob, share_study_time: true });
  assert.equal(out.mob.v3.hours.me_sharing, true);
  assert.equal(out.mob.v3.hours.target_minutes, HOURS_TARGET_PER_MEMBER);
  assert.equal((await hoursOf(svc, 'u1', mob)).me_sharing, false, 'one member\'s switch is not another\'s');
  // With another field in the same body both apply.
  const both = await svc.patchMe('u2', { mob, name: 'Aarya', share_study_time: false });
  assert.deepEqual([both.mob.you.name, both.mob.v3.hours.me_sharing], ['Aarya', false]);
  // The old fields keep working alone.
  assert.equal((await svc.patchMe('u2', { mob, nudgesMuted: true })).mob.you.name, 'Aarya');
  // v3 off: the switch is not available (the Mob answers like a Mob that is off for v3 features), the old fields are untouched.
  const off = serviceFor(db, { v3: false });
  await assert.rejects(off.patchMe('u2', { mob, share_study_time: true }), code('MOB_DISABLED'));
  assert.ok(!('v3' in (await off.view('u2', { mobId: mob, sync: false })).mob), 'v3 off: no v3 block, so no hours');
  // Through the route: 422 for a bad body, 200 and the den for a good one.
  const deps = { enabled: () => true, v3Enabled: () => true, auth: async () => ({ user: { id: 'u2' } }), rateLimit: async () => ({ allowed: true }), cors: () => ({}), service: svc };
  const patch = (body) => handleMob(deps, 'patchMe', new Request('http://localhost/api/mob/me', { method: 'PATCH', body: JSON.stringify(body) }));
  assert.equal((await patch({ mob, share_study_time: 'on' })).status, 422);
  const ok = await patch({ mob, share_study_time: true });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).mob.v3.hours.me_sharing, true);
  assert.match(read('src/app/api/mob/me/route.js'), /handleMob\(mobDeps\(\), 'patchMe'/);
});

test('migration missing: the payload has no hours key at all, and the switch says the Mob is unavailable', async () => {
  const db = await database({ hours: false });
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2']);
  const den = await svc.view('u1', { mobId: mob, sync: false });
  assert.ok(den.mob.v3, 'the rest of the den is there');
  assert.ok(!('hours' in den.mob.v3), 'hours is absent, not null or empty');
  assert.ok(!JSON.stringify(den).includes('"hours"'));
  await assert.rejects(svc.patchMe('u1', { mob, share_study_time: true }), code('MIGRATION'));
  // A combined body is all-or-nothing: the switch fails for the schema, so the name is not written either (the app retries it whole).
  await assert.rejects(svc.patchMe('u1', { mob, name: 'Rhea', share_study_time: true }), code('MIGRATION'));
  assert.equal((await svc.view('u1', { mobId: mob, sync: false })).mob.you.name, 'Riya', 'a failed combined body leaves the name unchanged');
  // After applying it the key appears; after the undo it is gone again, run twice.
  await db.exec(hoursSql);
  assert.ok('hours' in (await svc.view('u1', { mobId: mob, sync: false })).mob.v3);
  await db.exec(hoursUndo); await db.exec(hoursUndo);
  assert.ok(!('hours' in (await svc.view('u1', { mobId: mob, sync: false })).mob.v3));
  assert.equal(await one(db, "select count(*)::int r from information_schema.columns where table_name = 'mob_members' and column_name = 'share_study_time'"), 0);
  assert.equal(await one(db, "select count(*)::int r from pg_proc where proname like 'mob_hours%' or proname = 'mob_share_study_time_set'"), 0);
  // A read that fails for any other reason also leaves the key out and never breaks the den.
  const warn = mock.method(console, 'warn', () => {});
  try { assert.equal(await readHours(async () => { throw new Error('boom'); }, { userId: 'u1', mobId: mob, week: WEEK, nowIso: iso(NOW), members: new Map() }), null); } finally { warn.mock.restore(); }
});

test('tables that are missing read as zero, not as an error (no sessions table, no goal column)', async () => {
  const db = await database({ goals: false });
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', []);
  await share(svc, 'u1', mob);
  await addSession(db, 'u1', MON_10AM, [{ qid: 'a', secs: 150, answer: 1 }, { qid: 'b', secs: 150, answer: 1 }, { qid: 'c', secs: 150, answer: 1 }, { qid: 'd', secs: 150, answer: 1 },
    { qid: 'e', secs: 150, answer: 1 }, { qid: 'f', secs: 150, answer: 1 }, { qid: 'g', secs: 150, answer: 1 }, { qid: 'h', secs: 150, answer: 1 }]); // 20 minutes
  const h = await hoursOf(svc, 'u1', mob);
  assert.deepEqual([h.members[0].minutes, h.members[0].goal_days], [20, 1], 'no study_goals column: the 20-minute default');
  await db.exec('drop table public.recovery_sessions cascade');
  const none = await hoursOf(svc, 'u1', mob);
  assert.deepEqual([none.members, none.total_minutes, none.me_sharing, none.target_minutes], [[], 0, true, HOURS_TARGET_PER_MEMBER]);
});

test('the payload: exact shape, one crown, sorted, no user ids, and the count of rows is a few', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2', 'u3', 'u4']);
  for (const u of ['u1', 'u2', 'u3', 'u4']) await share(svc, u, mob);
  await addSession(db, 'u1', MON_10AM, [{ qid: 'a', secs: 180, answer: 1 }, { qid: 'b', secs: 180, answer: 1 }]);
  await addSession(db, 'u2', MON_10AM, [{ qid: 'a', secs: 180, answer: 1 }, { qid: 'b', secs: 180, answer: 1 }, { qid: 'c', secs: 180, answer: 1 }]);
  await addSession(db, 'u3', MON_10AM, [{ qid: 'a', secs: 180, answer: 1 }]);
  const h = await hoursOf(svc, 'u4', mob);
  assert.deepEqual(Object.keys(h).sort(), ['me_sharing', 'members', 'studying_now', 'target_minutes', 'top_member_id', 'total_minutes', 'week_start']);
  assert.equal(h.week_start, WEEK);
  assert.equal(h.target_minutes, 600);
  assert.deepEqual(h.members.map((m) => [m.first_name, m.minutes, Object.keys(m).sort().join()]), [
    ['Aarav', 9, 'first_name,goal_days,member_id,minutes'], ['Riya', 6, 'first_name,goal_days,member_id,minutes'], ['Kabir', 3, 'first_name,goal_days,member_id,minutes']]);
  assert.equal(h.total_minutes, 18);
  assert.equal(h.top_member_id, memberIdFor('test-secret', mob, 'u2'), 'the crown is the top member, nobody below is ranked');
  assert.ok(!h.members.some((m) => m.first_name === 'Zoya'), 'Zoya shares but has no minutes: not listed');
  for (const m of h.members) assert.match(m.member_id, /^[0-9A-Z]{12}$/);
  assert.ok(!/\bu[1-4]\b|user_id/.test(JSON.stringify(h)), 'no user id anywhere in the payload');
  const raw = await hoursRaw(db, 'u1', mob);
  assert.ok(raw.rows.length <= 4, 'one RPC, one row per sharing member');
});

test('one crown: nobody is crowned for a single sharer or a tie at the top; names only for members the Mob still has', () => {
  const members = new Map([['u1', { memberId: 'AAAAAAAAAAAA', name: 'Riya' }], ['u2', { memberId: 'BBBBBBBBBBBB', name: 'Aarav' }]]);
  const base = { week_start: '2026-10-19', sharing: 2, me_sharing: true, studying: [] };
  assert.equal(hoursView({ ...base, rows: [{ user_id: 'u1', minutes: 40, goal_days: 5 }] }, members).top_member_id, null, 'one sharer');
  assert.equal(hoursView({ ...base, rows: [{ user_id: 'u1', minutes: 40, goal_days: 1 }, { user_id: 'u2', minutes: 40, goal_days: 2 }] }, members).top_member_id, null, 'a tie');
  assert.equal(hoursView({ ...base, rows: [{ user_id: 'u1', minutes: 40, goal_days: 1 }, { user_id: 'u2', minutes: 41, goal_days: 2 }] }, members).top_member_id, 'BBBBBBBBBBBB');
  const odd = hoursView({ ...base, rows: [{ user_id: 'gone', minutes: 90, goal_days: 3 }, { user_id: 'u1', minutes: 0, goal_days: 0 }, { user_id: 'u2', minutes: 12, goal_days: 99 }],
    studying: [{ user_id: 'u2', since: '2026-10-22T08:30:00+00:00' }, { user_id: 'gone', since: '2026-10-22T08:31:00Z' }, { user_id: 'u1', since: 'not a time' }] }, members);
  assert.deepEqual(odd.members, [{ member_id: 'BBBBBBBBBBBB', first_name: 'Aarav', minutes: 12, goal_days: 7 }], 'a stranger and a zero are dropped, goal days stop at 7');
  assert.deepEqual(odd.studying_now, [{ member_id: 'BBBBBBBBBBBB', first_name: 'Aarav', since: '2026-10-22T08:30:00.000Z' }]);
  assert.equal(hoursView(null, members), null);
  assert.equal(hoursView({ ...base, week_start: 'x', rows: [] }, members), null);
});

test('the migration header, the undo and the route contract', () => {
  assert.match(hoursSql, /Applied to NOTHING by this change\.\n-- Undo: supabase\/undo\/20261020150000_mob_hours\.undo\.sql/);
  assert.match(hoursSql, /STAGING AND PRODUCTION DRY RUNS ARE NOT DONE/);
  assert.match(hoursSql, /share_study_time boolean not null default false/);
  assert.match(hoursSql, /180000/);
  assert.match(hoursUndo, /NOT a migration/);
  assert.match(hoursUndo, /drop column if exists share_study_time/);
  assert.match(read('docs/brain/APP-API-CONTRACT.md'), /share_study_time/);
  assert.match(read('src/lib/server/mob/games.js'), /readHours\(call/);
});

// ---------------------------------------------------------------------------------------------------------------------
// Reviewer fixes (20 Oct 2026): attempts as the primary source, "studying now" signals, the time rule against readTrace, the
// shared cache, the logged failures.
// ---------------------------------------------------------------------------------------------------------------------

// A finished paper exactly as src/lib/server/practiceSessions.js finishPractice writes it (the device-ticket path: no
// recovery_sessions row at all): selection_meta = { ...ticket meta, recovery: scorePracticeSubmission(...).recovery, ...submitMeta }.
// qs: [{ qid, secs, answer }] as eventsOf takes them (qids must be the paper's question ids).
async function addAttempt(db, user, id, completedIso, qs, { events = null, withSession = false } = {}) {
  const questions = [...new Set(qs.map((q) => q.qid))].map((qid) => ({ id: qid, correctIndex: 0, options: ['a', 'b', 'c', 'd'] }));
  const log = events || eventsOf(qs);
  const answers = {};
  for (const e of log) if (e.type === 'answer' && Number.isInteger(e.answer)) answers[e.qid] = e.answer;
  const result = scorePracticeSubmission(questions, answers, log, 3 * 60 * MIN);
  const selection = { mode: 'quick', learningPurpose: 'ordinary_practice', scoringVersion: 'server_practice_v1', scoringAuthority: 'server_snapshot',
    contentEvidence: 'legacy_bank', recovery: result.recovery, ...submitMeta({}, log) };
  await db.query(
    `insert into public.attempts (id, user_id, subject, score, correct, wrong, unattempted, total, details, questions_snapshot, completed_at, selection_meta)
     values ($1, $2, 'accountancy', $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::timestamptz, $11::jsonb)`,
    [id, user, result.score, result.correct, result.wrong, result.unattempted, result.total, JSON.stringify(result.details), JSON.stringify(questions), completedIso, JSON.stringify(selection)]);
  if (withSession) {
    await db.query(
      `insert into public.recovery_sessions (id, user_id, request_key, subject, mode, state, questions, events, created_at, expires_at)
       values ($1, $2, $1, 'accountancy', 'quick', 'submitted', '[]'::jsonb, $3::jsonb, $4::timestamptz, $4::timestamptz + interval '3 hours')`,
      [id, user, JSON.stringify(log), new Date(Date.parse(completedIso) - log.at(-1).at - 2000).toISOString()]);
  }
  return result;
}
const questionsOf = (n, secs = 150, answer = 1) => Array.from({ length: n }, (_, i) => ({ qid: `q${i}`, secs, answer }));

test('device-ticket practice (no recovery_sessions row) counts: the attempt is the source, and the den shows the member', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2']);
  await share(svc, 'u1', mob); await share(svc, 'u2', mob);
  // Riya: 40 minutes of Quick practice on Wednesday evening (16 questions of 150 s), submitted on a device-ticket paper. Aarav: nothing.
  await addAttempt(db, 'u1', 'tk1', '2026-10-21T14:30:00Z', questionsOf(16));
  assert.equal(await one(db, 'select count(*)::int r from public.recovery_sessions'), 0, 'there is no session row at all, as in production');
  const h = await hoursOf(svc, 'u2', mob);
  assert.deepEqual(h.members.map((m) => [m.first_name, m.minutes, m.goal_days]), [['Riya', 40, 1]]);
  assert.equal(h.total_minutes, 40);
  assert.equal(h.target_minutes, 2 * HOURS_TARGET_PER_MEMBER);
  // The cap and "answered only" apply to an attempt as to a session: a question left open 10 minutes counts 3, a looked-at one 0.
  await addAttempt(db, 'u1', 'tk2', '2026-10-22T04:30:00Z', [{ qid: 'q0', secs: 600, answer: 1 }, { qid: 'q1', secs: 60, answer: 2 }, { qid: 'q2', secs: 170, answer: null }]);
  assert.equal((await hoursOf(svc, 'u2', mob)).members[0].minutes, 44, '40 + 3 + 1');
  // A paper whose scorer found the events invalid keeps no timeline and so no minutes, and nothing breaks.
  const bad = [{ seq: 1, qid: 'q0', at: 9 * 60 * MIN, type: 'answer', answer: 1 }]; // past the paper's own duration
  const r = await addAttempt(db, 'u1', 'tk3', '2026-10-22T05:30:00Z', [{ qid: 'q0', secs: 60, answer: 1 }], { events: bad });
  assert.equal(r.recovery.telemetry, 'invalid');
  assert.equal((await hoursOf(svc, 'u2', mob)).members[0].minutes, 44);
  // Another week's attempt is not this week's.
  await addAttempt(db, 'u1', 'tk4', '2026-10-14T04:30:00Z', questionsOf(8));
  assert.equal((await hoursOf(svc, 'u2', mob)).members[0].minutes, 44);
  // A member who does not share is never read, attempts included.
  await addAttempt(db, 'u3', 'tk5', '2026-10-21T14:30:00Z', questionsOf(16));
  assert.deepEqual((await hoursRaw(db, 'u1', mob)).rows.map((x) => x.user_id), ['u1']);
});

test('an attempt places each question on the IST day it was answered, from its submit time minus the paper clock', async () => {
  const db = await database();
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', []);
  await share(svc, 'u1', mob);
  await db.exec("insert into public.study_goals (user_id, daily_minutes) values ('u1', 10)");
  // 10 questions of 120 s, started Tuesday 23:50 IST (18:20 UTC): the first five (10 minutes) end by 00:00 on Tuesday, the other
  // five on Wednesday. Submitted 2 s after the end. Both days reach the 10-minute goal only if the split is right.
  await addAttempt(db, 'u1', 'mid1', iso(Date.parse('2026-10-20T18:20:00Z') + 20 * MIN + 2000), questionsOf(10, 120));
  const h = (await hoursOf(svc, 'u1', mob)).members[0];
  assert.deepEqual([h.minutes, h.goal_days], [20, 2]);
  // The same paper as a durable session (a row and its attempt, one id) is counted once, not twice.
  const db2 = await database();
  const svc2 = serviceFor(db2);
  const mob2 = await mobOf(svc2, 'u1', []);
  await share(svc2, 'u1', mob2);
  await addAttempt(db2, 'u1', 'dup1', '2026-10-21T14:30:00Z', questionsOf(8), { withSession: true });
  assert.equal(await one(db2, 'select count(*)::int r from public.recovery_sessions'), 1);
  assert.equal((await hoursOf(svc2, 'u1', mob2)).members[0].minutes, 20, '8 questions of 150 s = 20 minutes once');
  // A durable paper still running (a session, no attempt yet) counts from its events; once submitted, from its attempt.
  await addSession(db2, 'u1', '2026-10-22T04:30:00Z', questionsOf(4));
  assert.equal((await hoursOf(svc2, 'u1', mob2)).members[0].minutes, 30);
});

test('studying now: a paper just submitted and the per-answer check count; a ticket paper still running does not (documented)', async () => {
  const db = await database();
  await db.exec(read('supabase/migrations/20261013095000_session_check_log.sql'));
  const svc = serviceFor(db);
  const mob = await mobOf(svc, 'u1', ['u2', 'u3', 'u4']);
  for (const u of ['u1', 'u2', 'u3']) await share(svc, u, mob); // u4 does not share
  // u1 submitted a 7.5-minute paper 3 minutes ago: its answers fell 10.5, 8 and 5.5 minutes ago, so the first one inside the 10-minute
  // window is the second, 479 s ago.
  await addAttempt(db, 'u1', 'live-att', iso(NOW - 3 * MIN), questionsOf(3));
  // u2 made a per-answer check 2 minutes ago (the answer check log, B13) in a paper that has no row yet; u3 is mid-paper on a device
  // ticket with nothing stored anywhere; u4 checked an answer a minute ago but does not share.
  await db.query("insert into public.session_check_log (session_id, qid, user_id, answer, checked_at) values ('tick1', 'q0', 'u2', 1, $1), ('tick2', 'q0', 'u4', 1, $2)",
    [iso(NOW - 2 * MIN), iso(NOW - MIN)]);
  const h = await hoursOf(svc, 'u3', mob);
  const id = (u) => memberIdFor('test-secret', mob, u);
  assert.deepEqual(h.studying_now.map((s) => [s.member_id, s.first_name]), [[id('u1'), 'Riya'], [id('u2'), 'Aarav']]);
  assert.equal(h.studying_now[0].since, iso(NOW - 3 * MIN - 450_000 + 151_000), 'since the first answer inside the window');
  assert.equal(h.studying_now[1].since, iso(NOW - 2 * MIN));
  assert.ok(!h.studying_now.some((s) => s.first_name === 'Kabir' || s.first_name === 'Zoya'), 'a ticket paper still running and a non-sharer are not shown');
  // The check log is optional: without its table the rest still works.
  const db2 = await database();
  const svc2 = serviceFor(db2);
  const mob2 = await mobOf(svc2, 'u1', []);
  await share(svc2, 'u1', mob2);
  await addAttempt(db2, 'u1', 'live2', iso(NOW - 3 * MIN), questionsOf(3));
  assert.equal((await hoursOf(svc2, 'u1', mob2)).studying_now.length, 1);
  // The contract says what is and is not promised.
  assert.match(read('docs/brain/APP-API-CONTRACT.md'), /device-ticket/);
});

// ---- the time rule against data/paper_trace.js readTrace, on random records ----

function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// A random but valid event log (every event passes data/recovery.js checkEvent): ties on the clock, set visits before any focus, the
// sheet opened twice, marks and strikes between focus events, repeated away, a back with no away, ends in the middle, breaks over 30 min.
function randomLog(r) {
  const nq = 2 + Math.floor(r() * 5);
  const questions = Array.from({ length: nq }, (_, i) => ({ id: `q${i}`, correctIndex: 0, options: ['a', 'b', 'c', 'd'] }));
  const pick = (list) => list[Math.floor(r() * list.length)];
  const away = r() < 0.55;
  const n = 3 + Math.floor(r() * 45);
  const events = []; let at = Math.floor(r() * 3) * 1000; let seq = 0;
  for (let i = 0; i < n; i++) {
    const u = r();
    at += u < 0.3 ? 0 : u < 0.7 ? Math.floor(r() * 20_000) : u < 0.93 ? Math.floor(r() * 300_000) : pick([1_800_000, 1_800_001, 1_799_999, 1_800_000 + Math.floor(r() * 1_200_000)]);
    seq += r() < 0.15 ? 2 : 1;
    const qid = `q${Math.floor(r() * nq)}`;
    const k = r();
    if (k < 0.27) events.push({ seq, qid, at, type: 'visit', ...(r() < 0.4 ? { via: pick(['next', 'previous', 'palette', 'swipe', 'resume']) } : {}) });
    else if (k < 0.34) events.push({ seq, qid, at, type: 'visit', via: 'set' });
    else if (k < 0.41) events.push({ seq, qid, at, type: 'visit', via: 'sheet' });
    else if (k < 0.65) events.push({ seq, qid, at, type: 'answer', answer: r() < 0.2 ? null : Math.floor(r() * 4) });
    else if (k < 0.72) events.push({ seq, qid, at, type: 'mark', marked: r() < 0.5 });
    else if (k < 0.8) events.push({ seq, qid, at, type: 'strike', option: Math.floor(r() * 4), on: r() < 0.5 });
    else if (k < 0.9) events.push(away ? { seq, qid, at, type: pick(['away', 'away', 'back']) } : { seq, qid, at, type: 'visit' });
    else if (k < 0.93) events.push({ seq, qid, at, type: 'end', reason: pick(['submit', 'time_up', 'nta_strikes']) });
    else events.push({ seq, qid, at, type: 'answer', answer: Math.floor(r() * 4) });
  }
  if (r() < 0.6) events.push({ seq: seq + 1, qid: `q${Math.floor(r() * nq)}`, at: at + Math.floor(r() * 5000), type: 'end', reason: 'submit' });
  const answers = {};
  for (const e of events) {
    if (e.type !== 'answer') continue;
    if (e.answer === null) delete answers[e.qid]; else answers[e.qid] = e.answer;
  }
  return { questions, events, answers };
}

test('the SQL time rule equals data/paper_trace.js readTrace on 200 random records (both from the scored record and from the raw session log)', { timeout: 180_000 }, async () => {
  const db = await database();
  const r = prng(20261020);
  const seen = { away: 0, sheet: 0, set: 0, brk: 0, tie: 0, midEnd: 0, mark: 0, strike: 0, noEnd: 0, ended: 0, answered: 0 };
  const dwellSql = async (sql, arg) => (await db.query(`select qid, ms::text as ms, answered_at::text as answered_at, last_at::text as last_at from public.mob_hours_dwell(${sql}) order by qid`, [JSON.stringify(arg)])).rows;
  let compared = 0;
  for (let i = 0; i < 200; i++) {
    const { questions, events, answers } = randomLog(r);
    const result = scoreSession(questions, answers, events, Infinity);
    const rec = result.recovery;
    assert.equal(rec.telemetry, 'self_reported', `record ${i} must be consistent`);
    const trace = readTrace(rec);
    const lastEnd = events.findLastIndex((e) => e.type === 'end');
    if (events.some((e) => e.type === 'away')) seen.away++;
    if (events.some((e) => e.via === 'sheet')) seen.sheet++;
    if (events.some((e) => e.via === 'set')) seen.set++;
    if (trace.breakSpans.length) seen.brk++;
    if (events.some((e, j) => j && e.at === events[j - 1].at)) seen.tie++;
    if (lastEnd >= 0 && lastEnd < events.length - 1) seen.midEnd++;
    if (rec.marks?.length) seen.mark++;
    if (rec.strikes?.length) seen.strike++;
    if (rec.end) seen.ended++; else seen.noEnd++;
    const answeredAt = new Map();
    for (const e of rec.timeline) if (e.type === 'answer' && Number.isInteger(e.answer)) answeredAt.set(e.qid, Math.max(answeredAt.get(e.qid) ?? -1, e.at));
    if (answeredAt.size) seen.answered++;
    for (const [label, rows] of [['record', await dwellSql('$1::jsonb', rec)], ['raw log', await dwellSql('public.mob_hours_rec_of_events($1::jsonb)', events)]]) {
      const qids = new Set([...rows.map((x) => x.qid), ...trace.dwell.keys()]);
      for (const qid of qids) {
        const row = rows.find((x) => x.qid === qid);
        assert.ok(row, `record ${i} (${label}): the SQL has a row for ${qid}`);
        assert.equal(Number(row.ms), trace.dwell.get(qid) ?? 0, `record ${i} (${label}) dwell of ${qid}\n${JSON.stringify(events)}`);
        assert.equal(row.answered_at === null ? null : Number(row.answered_at), answeredAt.get(qid) ?? null, `record ${i} (${label}) last answer of ${qid}`);
        assert.equal(Number(row.last_at), trace.lastAt, `record ${i} (${label}) last clock`);
        compared++;
      }
    }
  }
  // The generator really did hit every branch of the rule (a vacuous pass would prove nothing).
  for (const [k, min] of Object.entries({ away: 40, sheet: 30, set: 30, brk: 10, tie: 100, midEnd: 5, mark: 40, strike: 40, noEnd: 30, ended: 30, answered: 100 })) {
    assert.ok(seen[k] >= min, `the generator covered ${k} only ${seen[k]} times`);
  }
  assert.ok(compared > 1000);
  // Garbage in, nothing out: never an error.
  for (const junk of [null, 'x', 5, [], {}, { timeline: 'no' }, { timeline: [null, 4, 'a', { qid: 'a' }, { qid: 'a', at: 'x' }, { qid: '', at: 1 }], end: 7 }]) {
    assert.equal((await db.query('select * from public.mob_hours_dwell($1::jsonb)', [JSON.stringify(junk)])).rows.length, 0, JSON.stringify(junk));
  }
});

// ---- the shared cache ----

test('the heavy read is cached per Mob, week and set of sharers; a switch flip, the TTL and a failure all recompute', async () => {
  const calls = [];
  let sharers = ['u1', 'u2'];
  let boom = false;
  const read = async (name) => {
    calls.push(name);
    if (name === 'mob_hours_head') return { me_sharing: true, sharers };
    if (boom) throw new MobError('UNAVAILABLE', { cause: Object.assign(new Error('x'), { code: '57014' }) });
    return { sharing: sharers.length, rows: [{ user_id: 'u1', minutes: 5, goal_days: 1 }], studying: [] };
  };
  const members = new Map([['u1', { memberId: 'AAAAAAAAAAAA', name: 'Riya' }], ['u2', { memberId: 'BBBBBBBBBBBB', name: 'Aarav' }]]);
  const args = { userId: 'u1', mobId: 'm1', week: WEEK, nowIso: iso(NOW), members };
  const rowsCalls = () => calls.filter((c) => c === 'mob_hours_rows').length;
  const clock = { t: 1_000_000 };
  const reader = createHoursReader({ ttlMs: 60_000, now: () => clock.t });
  const a = await reader.readHours(read, args);
  const b = await reader.readHours(read, args);
  assert.deepEqual(a, b);
  assert.equal(rowsCalls(), 1, 'the second read within a minute reuses the aggregate');
  assert.equal(calls.filter((c) => c === 'mob_hours_head').length, 2, 'the cheap head is read every time (own switch, who shares)');
  assert.equal(a.members[0].minutes, 5);
  clock.t += 59_999; await reader.readHours(read, args); assert.equal(rowsCalls(), 1);
  clock.t += 2; await reader.readHours(read, args); assert.equal(rowsCalls(), 2, 'after the TTL it is read again');
  sharers = ['u1', 'u2', 'u3']; await reader.readHours(read, args); assert.equal(rowsCalls(), 3, 'a member switching sharing on changes the key: no waiting for the TTL');
  sharers = ['u2']; await reader.readHours(read, args); assert.equal(rowsCalls(), 4, 'and off');
  await reader.readHours(read, { ...args, mobId: 'm2' }); assert.equal(rowsCalls(), 5, 'another Mob is another entry');
  await reader.readHours(read, { ...args, week: '2026-10-26' }); assert.equal(rowsCalls(), 6, 'another week too');
  // Callers at the same moment share one query.
  clock.t += 120_000; sharers = ['u1', 'u2'];
  const before = rowsCalls();
  await Promise.all([reader.readHours(read, args), reader.readHours(read, args), reader.readHours(read, args)]);
  assert.equal(rowsCalls(), before + 1);
  // A failure is not remembered: the next read tries again (and logs).
  const warn = mock.method(console, 'warn', () => {});
  try {
    clock.t += 120_000; boom = true;
    assert.equal(await reader.readHours(read, args), null);
    boom = false;
    const again = await reader.readHours(read, args);
    assert.equal(again.members[0].minutes, 5, 'recovered at once');
    assert.equal(warn.mock.callCount(), 1);
  } finally { warn.mock.restore(); }
  // TTL 0 is no cache; the cache never grows past its cap.
  const none = createHoursReader({ ttlMs: 0 });
  const n0 = rowsCalls(); await none.readHours(read, args); await none.readHours(read, args); assert.equal(rowsCalls(), n0 + 2);
  assert.equal(none.size(), 0);
  const small = createHoursReader({ ttlMs: 60_000, now: () => clock.t, max: 3 });
  for (let i = 0; i < 10; i++) await small.readHours(read, { ...args, mobId: `m${i}` });
  assert.ok(small.size() <= 3);
});

test('in the den: hours is read beside the other reads, cached for a minute, and a switch flip shows at once', async () => {
  const db = await database();
  const log = [];
  const rpc = async (name, params) => { log.push(name); return pgRpc(db)(name, params); };
  const clock = { now: NOW };
  const svc = serviceFor(db, { clock, cacheMs: null, rpc }); // null: the production default, 60 s
  const mob = await mobOf(svc, 'u1', ['u2']);
  await addSession(db, 'u1', MON_10AM, questionsOf(4, 120)); // 8 minutes
  await share(svc, 'u1', mob); // (this den read caches the aggregate for the Mob, so the session is added before it)
  log.length = 0;
  const first = await hoursOf(svc, 'u2', mob);
  assert.equal(first.members[0].minutes, 8);
  assert.ok(log.indexOf('mob_hours_head') >= 0 && log.indexOf('mob_hours_head') < log.indexOf('mob_quest_week'), `started before the serial reads: ${log.join(' ')}`);
  await addSession(db, 'u1', '2026-10-20T04:30:00Z', questionsOf(2, 120)); // 4 more minutes, not yet seen
  log.length = 0;
  assert.equal((await hoursOf(svc, 'u2', mob)).members[0].minutes, 8, 'within a minute the aggregate is reused');
  assert.equal(log.filter((n) => n === 'mob_hours_rows').length, 0);
  clock.now += 61_000;
  assert.equal((await hoursOf(svc, 'u2', mob)).members[0].minutes, 12, 'a minute on it is read again');
  // Aarav switches sharing on: the set of sharers changed, so the very next read recomputes (no stale "not sharing" for a minute).
  await addSession(db, 'u2', '2026-10-21T04:30:00Z', questionsOf(3, 120));
  await share(svc, 'u2', mob);
  const both = await hoursOf(svc, 'u1', mob);
  assert.deepEqual(both.members.map((m) => [m.first_name, m.minutes]), [['Riya', 12], ['Aarav', 6]]);
  assert.equal(both.me_sharing, true);
  // And off again, at once, for him and for everyone.
  await share(svc, 'u2', mob, false);
  assert.deepEqual((await hoursOf(svc, 'u1', mob)).members.map((m) => m.first_name), ['Riya']);
  assert.equal((await hoursOf(svc, 'u2', mob)).me_sharing, false);
});

// ---- failures are logged, a missing migration is not ----

test('a read failure leaves hours out and is logged with a code and no ids; a missing migration is silent', async () => {
  const members = new Map([['u1', { memberId: 'AAAAAAAAAAAA', name: 'Riya' }]]);
  const args = { userId: 'u1', mobId: '5b2d7a3c-1111-4222-8333-944455556666', week: WEEK, nowIso: iso(NOW), members };
  const warn = mock.method(console, 'warn', () => {});
  try {
    const silent = await readHours(async () => { throw new MobError('MIGRATION'); }, args);
    assert.equal(silent, null);
    assert.equal(warn.mock.callCount(), 0, 'migration not applied: nothing to log');
    const timeout = await readHours(async () => {
      throw new MobError('UNAVAILABLE', { cause: Object.assign(new Error('canceling statement for user u1 in mob 5b2d7a3c'), { code: '57014' }) });
    }, args);
    assert.equal(timeout, null);
    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(warn.mock.calls[0].arguments, ['mob_hours_failed', 'UNAVAILABLE/57014']);
    assert.equal(await readHours(async () => { throw new Error('cast error for user u1'); }, args), null);
    assert.deepEqual(warn.mock.calls[1].arguments, ['mob_hours_failed', 'error']);
    const logged = JSON.stringify(warn.mock.calls.map((c) => c.arguments));
    assert.ok(!/u1|5b2d7a3c|Riya/.test(logged), 'no user id, Mob id or name in the log');
    // Through the den: a database error under the function (not a missing function) logs and the den goes on.
    const db = await database();
    const svc = serviceFor(db, { rpc: async (name, params) => {
      if (name === 'mob_hours_rows') throw Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
      return pgRpc(db)(name, params);
    } });
    const mob = await mobOf(svc, 'u1', []);
    warn.mock.resetCalls();
    const den = await svc.view('u1', { mobId: mob, sync: false });
    assert.ok(den.mob.v3 && !('hours' in den.mob.v3));
    assert.deepEqual(warn.mock.calls.map((c) => c.arguments), [['mob_hours_failed', 'UNAVAILABLE/57014']]);
    // The same den with a missing function stays quiet.
    const quiet = serviceFor(db, { rpc: async (name, params) => {
      if (name.startsWith('mob_hours')) throw Object.assign(new Error('function public.mob_hours_head does not exist'), { code: '42883' });
      return pgRpc(db)(name, params);
    } });
    warn.mock.resetCalls();
    assert.ok(!('hours' in (await quiet.view('u1', { mobId: mob, sync: false })).mob.v3));
    assert.equal(warn.mock.callCount(), 0);
  } finally { warn.mock.restore(); }
});

test('the contract names what is left out: Mob rounds, and ticket papers still running', () => {
  const doc = read('docs/brain/APP-API-CONTRACT.md');
  assert.match(doc, /Mob rounds/);
  assert.match(doc, /OWNER DECISION/);
  assert.match(doc, /attempts\.selection_meta/);
});
