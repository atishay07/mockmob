// Class leagues end to end on PGlite: the real migration (supabase/migrations/20261116150000_class_leagues.sql) and its undo,
// the real store, service and route handler (src/lib/classLeague/), and the Sunday Mock's real store reading attempts
// (src/lib/server/sunday/store.js), through a PostgREST-shaped client (helpers/pgRest.mjs). Only the session, the clock, the
// limiter and the subject list are test doubles. Proves: the switch off answers 404 and reads nothing; the floor of 5 says
// nothing below it, not even a count; late papers and papers past the last legal send never count; a non-member gets
// nothing; a week is never live and a later join or leave never moves it; members are never listed; the code is one tap to
// join, with failed guesses limited; leave, close and report.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgRest } from './helpers/pgRest.mjs';
import { createClassStore } from '../../src/lib/classLeague/store.js';
import { createClassService } from '../../src/lib/classLeague/service.js';
import { handleClass, CLASS_LIMITS } from '../../src/lib/classLeague/http.js';
import { CLASS_MAX_MEMBERS } from '../../src/lib/classLeague/model.mjs';
import { createSundayStore } from '../../src/lib/server/sunday/store.js';
import { sundayTag, sundayWindow } from '../../src/lib/sundayMock.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATION = read('supabase/migrations/20261116150000_class_leagues.sql');
const UNDO = read('supabase/undo/20261116150000_class_leagues.undo.sql');
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));
const IST = (s) => Date.parse(`${s}+05:30`);
const WEEK = '2026-11-22';
const WIN = sundayWindow(WEEK);
const SUBJECTS = { accountancy: 'Accountancy', economics: 'Economics', english: 'English' };
const subjectInfo = (raw) => (typeof raw === 'string' && SUBJECTS[raw] ? { ok: true, id: raw, publicId: raw, name: SUBJECTS[raw] } : { ok: false });

async function database() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    create table public.users (id text primary key);
    create table public.attempts (
      id text primary key, user_id text not null, subject text not null, correct int, wrong int, unattempted int, total int,
      completed_at timestamptz, selection_meta jsonb, details jsonb
    );
  `);
  await pg.exec(MIGRATION);
  return pg;
}

/** A world on PGlite: the clock, the users and their subjects, a limiter that counts, and the route handler. */
async function world({ at = IST('2026-11-18T10:00:00'), users = {}, enabled = true } = {}) {
  const pg = await database();
  const clock = { t: at };
  const people = { creator: ['accountancy', 'economics'], ...users };
  for (let i = 1; i <= 12; i += 1) people[`s${i}`] ||= ['accountancy'];
  await pg.query(`insert into public.users (id) select unnest($1::text[])`, [Object.keys(people)]);
  const db = pgRest(pg);
  const reports = [];
  const service = createClassService({
    now: () => clock.t,
    store: createClassStore(db),
    sunday: createSundayStore(db),
    loadUser: async (id) => (people[id] ? { subjects: people[id] } : null),
    subjectInfo,
    randomBytes: (n) => randomBytes(n),
    blocklist,
    onReport: (info) => reports.push(info),
  });
  const counts = new Map();
  const keyOf = (request, o) => `${o.route}:${o.identityOnly ? '' : request.headers.get('x-ip') || 'ip0'}:${(o.keyParts || []).join(':')}`;
  const deps = {
    enabled: () => enabled,
    auth: async (request) => (request.headers.get('x-user') ? { user: { id: request.headers.get('x-user') } } : null),
    rateLimit: async (request, o) => {
      const k = keyOf(request, o);
      const n = counts.get(k) || 0;
      if (n >= o.limit) return { allowed: false, retryAfterSeconds: 600 };
      counts.set(k, n + 1);
      return { allowed: true };
    },
    giveBack: async (request, o) => { const k = keyOf(request, o); counts.set(k, Math.max(0, (counts.get(k) || 0) - 1)); },
    now: () => clock.t,
    service,
  };
  const call = async (action, { user = null, body, query = {}, method, ip } = {}) => {
    const qs = new URLSearchParams(query).toString();
    const m = method || ({ get: 'GET', lookup: 'GET', week: 'GET' }[action] || 'POST');
    const headers = { ...(user ? { 'x-user': user } : {}), ...(ip ? { 'x-ip': ip } : {}) };
    const res = await handleClass(deps, action, new Request(`https://www.mockmob.in/api/class${qs ? `?${qs}` : ''}`, { method: m, headers, ...(m === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }) }));
    const text = await res.text();
    return { status: res.status, text, data: JSON.parse(text) };
  };
  /** A sent Sunday Mock paper, as the practice engine saves it (the Sunday tag; `late` as data/late_paper.js marks one). */
  let n = 0;
  const sat = async (userId, { correct = 30, wrong = 10, subject = 'accountancy', week = WEEK, finished = IST('2026-11-22T12:00:00'), late = false } = {}) => {
    n += 1;
    const meta = { mobPaper: sundayTag(week), ...(late ? { late: true } : {}) };
    await pg.query(`insert into public.attempts (id, user_id, subject, correct, wrong, unattempted, total, completed_at, selection_meta, details)
      values ($1, $2, $3, $4, $5, $6, 50, $7, $8::jsonb, '[]'::jsonb)`, [`att${n}`, userId, subject, correct, wrong, 50 - correct - wrong, new Date(finished).toISOString(), JSON.stringify(meta)]);
  };
  return { pg, clock, call, sat, counts, reports, service, setEnabled: (v) => { enabled = v; } };
}

const create = (w, user = 'creator', body = { name: 'XII-C Commerce, DPS Rohini', subjects: ['accountancy', 'economics'] }) => w.call('create', { user, body });
async function classOf(w, size, { joinAt = null } = {}) {
  const made = await create(w);
  assert.equal(made.status, 201, made.text);
  const code = made.data.class.code;
  const before = w.clock.t;
  if (joinAt) w.clock.t = joinAt;
  for (let i = 1; i <= size; i += 1) assert.equal((await w.call('join', { user: `s${i}`, body: { code } })).status, 200);
  w.clock.t = before;
  return code;
}

// ------------------------------------------------------------------ the migration

test('the migration applies (twice over), keeps the browser roles out, and its undo removes it cleanly', async () => {
  const pg = await database();
  await pg.exec(MIGRATION); // idempotent
  for (const t of ['class_leagues', 'class_league_members']) {
    const rls = (await pg.query(`select relrowsecurity from pg_class where oid = 'public.${t}'::regclass`)).rows[0].relrowsecurity;
    assert.equal(rls, true, `${t}: RLS on`);
    for (const role of ['anon', 'authenticated']) for (const priv of ['select', 'insert', 'update', 'delete']) {
      assert.equal((await pg.query(`select has_table_privilege('${role}', 'public.${t}', '${priv}') ok`)).rows[0].ok, false, `${role} has no ${priv} on ${t}`);
    }
    assert.equal((await pg.query(`select has_table_privilege('service_role', 'public.${t}', 'insert') ok`)).rows[0].ok, true);
  }
  await pg.exec(`insert into public.users (id) values ('u1')`);
  await assert.rejects(pg.exec(`insert into public.class_leagues (code, name, subjects) values ('K7P2MU', 'Abc', '{accountancy}')`), /check/i, 'U is not a code character');
  await assert.rejects(pg.exec(`insert into public.class_leagues (code, name, subjects) values ('K7P2M9', 'Ab', '{accountancy}')`), /check/i, 'a name of 3 or more');
  await assert.rejects(pg.exec(`insert into public.class_leagues (code, name, subjects) values ('K7P2M9', 'Abc', '{}')`), /check/i, 'one subject at least');
  await pg.exec(`insert into public.class_leagues (id, code, name, subjects) values ('00000000-0000-0000-0000-00000000000a', 'K7P2M9', 'Abc', '{accountancy}'), ('00000000-0000-0000-0000-00000000000b', 'K7P2M8', 'Abd', '{accountancy}')`);
  await pg.exec(`insert into public.class_league_members (league_id, user_id) values ('00000000-0000-0000-0000-00000000000a', 'u1')`);
  await assert.rejects(pg.exec(`insert into public.class_league_members (league_id, user_id) values ('00000000-0000-0000-0000-00000000000b', 'u1')`), /unique|duplicate/i, 'one open class a student');
  await pg.exec(`update public.class_league_members set left_at = now() where user_id = 'u1'`);
  await pg.exec(`insert into public.class_league_members (league_id, user_id) values ('00000000-0000-0000-0000-00000000000b', 'u1')`); // free again
  await pg.exec(UNDO);
  const left = (await pg.query(`select count(*)::int n from pg_tables where schemaname = 'public' and tablename like 'class_league%'`)).rows[0].n;
  assert.equal(left, 0, 'the undo drops both tables');
  assert.equal((await pg.query(`select count(*)::int n from public.users`)).rows[0].n, 1, 'and nothing else');
  await pg.exec(MIGRATION); // and it applies again after the undo
  await pg.close();
});

// ------------------------------------------------------------------ the switch

test('switched off, every route answers 404 CLASS_OFF and nothing reads a session or a table', async () => {
  let reads = 0;
  const deps = {
    enabled: () => false,
    auth: async () => { reads += 1; return { user: { id: 'u' } }; },
    rateLimit: async () => { reads += 1; return { allowed: true }; },
    service: new Proxy({}, { get: () => () => { reads += 1; return {}; } }),
  };
  for (const [action, method] of [['get', 'GET'], ['create', 'POST'], ['lookup', 'GET'], ['join', 'POST'], ['leave', 'POST'], ['close', 'POST'], ['report', 'POST'], ['week', 'GET']]) {
    const res = await handleClass(deps, action, new Request('https://www.mockmob.in/api/class?code=K7P2M9', { method, ...(method === 'POST' ? { body: '{}' } : {}) }));
    assert.equal(res.status, 404, action);
    assert.equal((await res.json()).error.code, 'CLASS_OFF');
  }
  assert.equal(reads, 0, 'no session, limit or service touched');
  const route = read('src/lib/classLeague/flag.mjs');
  assert.match(route, /process\.env\.CLASS_LEAGUES_ENABLED === 'true'/, 'off unless exactly true');
});

test('the routes and the page are behind the switch: each route file goes through handleClass, the page through the flag', () => {
  for (const r of ['route.js', 'lookup/route.js', 'join/route.js', 'leave/route.js', 'close/route.js', 'report/route.js', 'week/route.js']) {
    const text = read(`src/app/api/class/${r}`);
    assert.match(text, /handleClass\(classDeps\(\), '/, r);
    assert.doesNotMatch(text, /supabase/i, `${r} reads nothing itself`);
  }
  assert.match(read('src/app/class/[code]/page.jsx'), /if \(!classLeaguesEnabled\(\)\) notFound\(\);/);
});

// ------------------------------------------------------------------ create, lookup, join

test('start a class: a code, the creator in it, the creator\'s own subjects, and one class at a time', async () => {
  const w = await world({ users: { nosub: [] } });
  const made = await create(w);
  assert.equal(made.status, 201);
  const c = made.data.class;
  assert.match(c.code, /^[0-9A-HJKMNP-TV-Z]{6}$/);
  assert.equal(c.url, `https://www.mockmob.in/class/${c.code}`);
  assert.equal(c.name, 'XII-C Commerce, DPS Rohini');
  assert.equal(c.members, 1);
  assert.equal(c.creator, true);
  assert.deepEqual(c.subjects.map((s) => s.id), ['accountancy', 'economics']);
  assert.equal(made.data.week, null, 'no Sunday has closed since it started');
  assert.equal(made.data.next.week, WEEK);
  assert.equal((await create(w)).data.error.code, 'ALREADY_IN_CLASS');
  assert.equal((await create(w, 's1', { name: 'ab', subjects: ['accountancy'] })).data.error.code, 'NAME_INVALID');
  assert.equal((await create(w, 's1', { name: 'Sexy batch', subjects: ['accountancy'] })).data.error.code, 'NAME_REFUSED');
  assert.equal((await create(w, 's1', { name: 'Batch A', subjects: ['economics'] })).data.error.code, 'SUBJECTS_INVALID', 'only your own subjects');
  assert.equal((await create(w, 'nosub', { name: 'Batch A', subjects: ['accountancy'] })).data.error.code, 'NO_SUBJECTS');
  // Failed starts gave their count back: s1 can still start 3 this week.
  assert.equal((await create(w, 's1', { name: 'Batch A', subjects: ['accountancy'] })).status, 201);
  await w.pg.close();
});

test('the public lookup gives the name and subjects, never a member count, and nothing for a closed or unknown code', async () => {
  const w = await world();
  const code = await classOf(w, 3);
  const out = await w.call('lookup', { query: { code: code.toLowerCase() } });
  assert.equal(out.status, 200);
  assert.deepEqual(out.data, { code, name: 'XII-C Commerce, DPS Rohini', subjects: ['Accountancy', 'Economics'] });
  assert.doesNotMatch(out.text, /members|creator|s1|s2|s3/, 'no count, no ids');
  assert.equal((await w.call('lookup', { user: 's1', query: { code } })).data.you, 'member');
  assert.equal((await w.call('lookup', { user: 's9', query: { code } })).data.you, 'none');
  assert.equal((await w.call('lookup', { query: { code: 'ZZZZZZ' } })).status, 404);
  assert.equal((await w.call('lookup', { query: { code: 'bad' } })).status, 404);
  assert.equal((await w.call('close', { user: 'creator' })).status, 200);
  assert.equal((await w.call('lookup', { query: { code } })).status, 404, 'a closed class shows nothing');
  await w.pg.close();
});

test('join: one tap with the code as typed, idempotent, one class at a time, a cap, and guessing is limited', async () => {
  const w = await world();
  const code = await classOf(w, 0);
  const first = await w.call('join', { user: 's1', body: { code: `${code.slice(0, 3).toLowerCase()} ${code.slice(3)}` } });
  assert.equal(first.status, 200);
  assert.equal(first.data.class.members, 2);
  assert.equal(first.data.class.creator, false);
  assert.equal((await w.call('join', { user: 's1', body: { code } })).status, 200, 'a second tap is not an error');
  // In another class: refused, with the class's name to say which.
  const other = await create(w, 's2', { name: 'Batch B', subjects: ['accountancy'] });
  const clash = await w.call('join', { user: 's2', body: { code } });
  assert.equal(clash.data.error.code, 'ALREADY_IN_CLASS');
  assert.equal(clash.data.error.detail.className, 'Batch B');
  assert.ok(other.data.class.code);
  // Ten codes that match nothing an hour, then a wait; a join that works gives its count back.
  for (let i = 0; i < CLASS_LIMITS.joinMiss.limit; i += 1) assert.equal((await w.call('join', { user: 's3', body: { code: i % 2 ? 'ZZZZZZ' : 'nope' } })).status, i % 2 ? 404 : 422);
  const limited = await w.call('join', { user: 's3', body: { code } });
  assert.equal(limited.status, 429);
  assert.match(limited.data.error.message, /a lot of codes that did not match/);
  assert.equal((await w.call('join', { user: 's4', body: { code } })).status, 200);
  assert.equal([...w.counts].filter(([k]) => k.includes('joinMiss') && k.endsWith(':s4')).every(([, n]) => n === 0), true, 'a good join is not a miss');
  // Full: the cap.
  await w.pg.query(`insert into public.users (id) select 'f' || g from generate_series(1, $1::int) g`, [CLASS_MAX_MEMBERS]);
  const league = (await w.pg.query(`select id from public.class_leagues where code = $1`, [code])).rows[0].id;
  await w.pg.query(`insert into public.class_league_members (league_id, user_id) select $1, 'f' || g from generate_series(1, $2::int) g`, [league, CLASS_MAX_MEMBERS - 3]);
  assert.equal((await w.call('join', { user: 's5', body: { code } })).data.error.code, 'CLASS_FULL');
  await w.pg.close();
});

// ------------------------------------------------------------------ the figure

test('the floor of 5: four sitters show nothing, not even the count; the fifth opens the count and the average', async () => {
  const w = await world();
  await classOf(w, 6);
  await w.sat('s1', { correct: 40, wrong: 5 }); // 195
  await w.sat('s2', { correct: 30, wrong: 10 }); // 140
  await w.sat('s3', { correct: 20, wrong: 10 }); // 90
  await w.sat('s4', { correct: 35, wrong: 0 }); // 175
  w.clock.t = IST('2026-11-23T09:00:00');
  const four = await w.call('get', { user: 's1' });
  const acc = four.data.week.figures.find((f) => f.subject === 'accountancy');
  assert.deepEqual(acc, { subject: 'accountancy', name: 'Accountancy', enough: false, you: { scored: 195, max: 250 } });
  assert.doesNotMatch(JSON.stringify(acc), /sat|average/, 'below the floor not even how many sat');
  const eco = four.data.week.figures.find((f) => f.subject === 'economics');
  assert.equal(eco.enough, false);
  assert.equal(eco.you, null, 'you did not sit Economics');

  // A fresh server (the figure is kept six hours per server) after a fifth paper: 705 / 5 = 141.
  const w2 = await world();
  await classOf(w2, 6);
  for (const [u, c, x] of [['s1', 40, 5], ['s2', 30, 10], ['s3', 20, 10], ['s4', 35, 0], ['s5', 25, 20]]) await w2.sat(u, { correct: c, wrong: x });
  w2.clock.t = IST('2026-11-23T09:00:00');
  const five = await w2.call('get', { user: 's6' });
  const fig = five.data.week.figures.find((f) => f.subject === 'accountancy');
  assert.deepEqual(fig, { subject: 'accountancy', name: 'Accountancy', enough: true, sat: 5, average: 141, you: null });
  // Members are never listed: no user id, no name, anywhere in the answer.
  assert.doesNotMatch(five.text, /"s\d+"|creator"\s*:\s*"|userId|user_id/);
  await w.pg.close();
  await w2.pg.close();
});

test('late papers and papers past the last legal send never count; a non-member\'s paper never counts', async () => {
  const w = await world({ users: { outsider: ['accountancy'] } });
  await classOf(w, 7);
  for (const u of ['s1', 's2', 's3', 's4']) await w.sat(u, { correct: 30, wrong: 10 });
  await w.sat('s5', { correct: 50, wrong: 0, late: true }); // a late paper (data/late_paper.js): never in a class figure
  await w.sat('s6', { correct: 50, wrong: 0, finished: WIN.lastFinishAt + 60_000 }); // after the last legal send
  await w.sat('outsider', { correct: 50, wrong: 0 });
  await w.sat('s7', { correct: 50, wrong: 0, week: '2026-11-29', finished: IST('2026-11-29T12:00:00') }); // another Sunday
  w.clock.t = IST('2026-11-23T09:00:00');
  const out = await w.call('get', { user: 's1' });
  assert.equal(out.data.week.figures.find((f) => f.subject === 'accountancy').enough, false, 'four count: the floor holds');
  await w.pg.close();
});

test('never live: nothing before 11:05 PM on the Sunday, and a later join or leave never moves a closed week', async () => {
  const w = await world();
  await classOf(w, 8);
  for (const [u, c] of [['s1', 40], ['s2', 30], ['s3', 20], ['s4', 35], ['s5', 25]]) await w.sat(u, { correct: c, wrong: 0 });
  w.clock.t = IST('2026-11-22T22:50:00');
  const live = await w.call('get', { user: 's1' });
  assert.equal(live.data.week, null, 'before the answers open there is no figure');
  assert.equal((await w.call('week', { user: 's1', query: { week: WEEK, subject: 'accountancy' } })).data.error.code, 'WEEK_INVALID');
  w.clock.t = WIN.answersAt;
  const open = (await w.call('week', { user: 's1', query: { week: WEEK, subject: 'accountancy' } })).data;
  assert.deepEqual(open.figure, { subject: 'accountancy', name: 'Accountancy', enough: true, sat: 5, average: 150, you: { scored: 200, max: 250 } });
  // A sixth sitter joins after the close, and one of the five leaves: on a fresh server the closed week reads the same.
  w.clock.t = IST('2026-11-23T10:00:00');
  await w.pg.query(`insert into public.users (id) values ('late')`);
  await w.sat('late', { correct: 50, wrong: 0 });
  const code = (await w.call('get', { user: 's1' })).data.class.code;
  assert.equal((await w.call('join', { user: 'late', body: { code } })).status, 200);
  assert.equal((await w.call('leave', { user: 's2' })).status, 200);
  const again = createClassService({
    now: () => w.clock.t, store: createClassStore(pgRest(w.pg)), sunday: createSundayStore(pgRest(w.pg)),
    loadUser: async () => ({ subjects: ['accountancy'] }), subjectInfo, randomBytes: () => new Uint8Array(4), blocklist,
  });
  assert.deepEqual((await again.week('late', { week: WEEK, subject: 'accountancy' })).figure, { subject: 'accountancy', name: 'Accountancy', enough: true, sat: 5, average: 150, you: { scored: 250, max: 250 } });
  await w.pg.close();
});

test('a non-member gets nothing: no class, no week, no report', async () => {
  const w = await world({ users: { outsider: ['accountancy'] } });
  await classOf(w, 5);
  for (const u of ['s1', 's2', 's3', 's4', 's5']) await w.sat(u, { correct: 30, wrong: 10 });
  w.clock.t = IST('2026-11-23T09:00:00');
  const status = await w.call('get', { user: 'outsider' });
  assert.equal(status.data.class, null);
  assert.equal(status.data.week, undefined);
  assert.deepEqual(status.data.subjects, [{ id: 'accountancy', name: 'Accountancy' }], 'only their own subjects, for the start form');
  assert.equal((await w.call('week', { user: 'outsider', query: { week: WEEK, subject: 'accountancy' } })).data.error.code, 'NOT_IN_CLASS');
  assert.equal((await w.call('report', { user: 'outsider', body: { reason: 'name' } })).data.error.code, 'NOT_IN_CLASS');
  assert.equal((await w.call('get')).status, 401, 'signed out');
  assert.equal((await w.call('week', { query: { week: WEEK, subject: 'accountancy' } })).status, 401);
  await w.pg.close();
});

// ------------------------------------------------------------------ leave, close, report

test('leave is one tap; the creator closes instead; closing ends it for everyone and frees every seat', async () => {
  const w = await world();
  const code = await classOf(w, 3);
  assert.equal((await w.call('leave', { user: 'creator' })).data.error.code, 'CREATOR_CLOSES');
  assert.equal((await w.call('close', { user: 's1' })).data.error.code, 'NOT_CREATOR');
  assert.deepEqual((await w.call('leave', { user: 's1' })).data, { left: true });
  assert.equal((await w.call('get', { user: 's1' })).data.class, null);
  assert.equal((await w.call('leave', { user: 's1' })).data.error.code, 'NOT_IN_CLASS');
  assert.equal((await w.call('get', { user: 'creator' })).data.class.members, 3);
  assert.deepEqual((await w.call('close', { user: 'creator' })).data, { closed: true });
  for (const u of ['creator', 's2', 's3']) assert.equal((await w.call('get', { user: u })).data.class, null, `${u} sees nothing`);
  assert.equal((await w.call('join', { user: 's1', body: { code } })).data.error.code, 'CLASS_NOT_FOUND', 'its code stops working');
  assert.equal((await create(w, 's2', { name: 'Batch B', subjects: ['accountancy'] })).status, 201, 'a freed seat can start another');
  await w.pg.close();
});

test('a report reaches support with the class\'s name and code, from a member or by its link', async () => {
  const w = await world();
  const code = await classOf(w, 2);
  assert.deepEqual((await w.call('report', { user: 's1', body: { reason: 'name' } })).data, { reported: true });
  assert.deepEqual((await w.call('report', { user: 's9', body: { reason: 'safety', code } })).data, { reported: true });
  assert.equal((await w.call('report', { user: 's1', body: { reason: 'other' } })).data.error.code, 'REASON_INVALID');
  assert.deepEqual(w.reports.map((r) => [r.code, r.name, r.members, r.reason]), [[code, 'XII-C Commerce, DPS Rohini', 3, 'name'], [code, 'XII-C Commerce, DPS Rohini', 3, 'safety']]);
  assert.ok(w.reports.every((r) => !JSON.stringify(r).includes('s1') && !JSON.stringify(r).includes('s9')), 'never the reporter');
  await w.pg.close();
});

// ------------------------------------------------------------------ review, 16 Nov 2026

test('a closed week\'s figure is stored once and never changes: not for a deleted member, a rescored paper or a new server', async () => {
  const w = await world();
  await classOf(w, 6);
  for (const [u, c] of [['s1', 40], ['s2', 30], ['s3', 20], ['s4', 35], ['s5', 25]]) await w.sat(u, { correct: c, wrong: 0 });
  w.clock.t = IST('2026-11-23T09:00:00');
  const first = (await w.call('week', { user: 's6', query: { week: WEEK, subject: 'accountancy' } })).data.figure;
  assert.deepEqual([first.enough, first.sat, first.average], [true, 5, 150]);
  assert.deepEqual((await w.pg.query(`select sat, average from public.class_league_weeks`)).rows, [{ sat: 5, average: 150 }], 'stored on first read');
  // An account deleted (its membership and its papers gone) and a paper rescored, then a fresh server reads it.
  await w.pg.query(`delete from public.class_league_members where user_id = 's1'`);
  await w.pg.query(`delete from public.attempts where user_id = 's1'`);
  await w.pg.query(`update public.attempts set correct = 50 where user_id = 's2'`);
  const fresh = createClassService({
    now: () => w.clock.t, store: createClassStore(pgRest(w.pg)), sunday: createSundayStore(pgRest(w.pg)),
    loadUser: async () => ({ subjects: ['accountancy'] }), subjectInfo, randomBytes: () => new Uint8Array(4), blocklist,
  });
  const again = (await fresh.week('s6', { week: WEEK, subject: 'accountancy' })).figure;
  assert.deepEqual([again.enough, again.sat, again.average], [true, 5, 150], 'the stored figure stands');
  // Under the floor, the stored row carries no count either.
  const st = (await w.call('get', { user: 's6' })).data.week.figures.find((f) => f.subject === 'economics');
  assert.deepEqual(st, { subject: 'economics', name: 'Economics', enough: false, you: null });
  const row = (await w.pg.query(`select sat, average from public.class_league_weeks where subject = 'economics'`)).rows[0];
  assert.deepEqual(row, { sat: null, average: null });
  await w.pg.close();
});

test('two first reads at once store one figure, and both answer it', async () => {
  const w = await world();
  await classOf(w, 6);
  for (const u of ['s1', 's2', 's3', 's4', 's5']) await w.sat(u, { correct: 30, wrong: 0 });
  w.clock.t = IST('2026-11-23T09:00:00');
  const [a, b] = await Promise.all([w.call('week', { user: 's1', query: { week: WEEK, subject: 'accountancy' } }), w.call('week', { user: 's2', query: { week: WEEK, subject: 'accountancy' } })]);
  assert.equal(a.data.figure.average, 150);
  assert.equal(b.data.figure.average, 150);
  assert.equal((await w.pg.query(`select count(*)::int n from public.class_league_weeks where subject = 'accountancy'`)).rows[0].n, 1);
  await w.pg.close();
});

test('/api/class/week answers only the latest figure week; your marks are that Sunday\'s, never another\'s', async () => {
  const w = await world();
  await classOf(w, 5);
  for (const u of ['s1', 's2', 's3', 's4', 's5']) await w.sat(u, { correct: 30, wrong: 0 });
  await w.sat('s1', { correct: 10, wrong: 0, week: '2026-11-29', finished: IST('2026-11-29T12:00:00') });
  w.clock.t = IST('2026-11-23T09:00:00');
  const mine = (await w.call('week', { user: 's1', query: { week: WEEK, subject: 'accountancy' } })).data.figure.you;
  assert.deepEqual(mine, { scored: 150, max: 250 }, 'the 22 Nov paper, not the 29 Nov one');
  w.clock.t = IST('2026-11-30T09:00:00');
  assert.equal((await w.call('week', { user: 's1', query: { week: WEEK, subject: 'accountancy' } })).data.error.code, 'WEEK_INVALID', 'an older Sunday');
  assert.equal((await w.call('week', { user: 's1', query: { week: '2026-11-29', subject: 'accountancy' } })).data.figure.you.scored, 50);
  await w.pg.close();
});

test('the 80-member cap holds when the last seats are taken at the same moment', async () => {
  const w = await world();
  const code = await classOf(w, 0);
  const league = (await w.pg.query(`select id from public.class_leagues where code = $1`, [code])).rows[0].id;
  await w.pg.query(`insert into public.users (id) select 'f' || g from generate_series(1, $1::int) g`, [CLASS_MAX_MEMBERS]);
  await w.pg.query(`insert into public.class_league_members (league_id, user_id) select $1, 'f' || g from generate_series(1, $2::int) g`, [league, CLASS_MAX_MEMBERS - 2]);
  const out = await Promise.all(['s1', 's2', 's3', 's4'].map((u) => w.call('join', { user: u, body: { code } })));
  assert.equal(out.filter((r) => r.status === 200).length, 1, 'one seat was left');
  assert.ok(out.filter((r) => r.status !== 200).every((r) => r.data.error.code === 'CLASS_FULL'));
  assert.equal((await w.pg.query(`select count(*)::int n from public.class_league_members where league_id = $1 and left_at is null`, [league])).rows[0].n, CLASS_MAX_MEMBERS);
  await w.pg.close();
});

test('the start and report limits are kept in the database (persistent), as the join and lookup limits are', () => {
  for (const name of ['create', 'report', 'joinNet', 'joinMiss', 'lookup', 'lookupUser']) assert.equal(CLASS_LIMITS[name].persistent, true, name);
});
