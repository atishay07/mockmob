// `v3.fix` on the den (V4 Now card steps 2 and 3; docs/brain/APP-API-CONTRACT.md 2.14): the Fix it together step a member still has to
// take, from the Mob's real traps. The decision rules (src/lib/mob/denFix.mjs), the read on a real Postgres (PGlite) with the real Mob
// migrations and its undo, and the den through the service: ready after a game closes with a trap, check only when the trap's own
// Wednesday window is open, nothing once the member did their part or the Mob fixed it, and the card kept for the whole window even
// after the game has left the den's 7-day list.
// Run: node --test data/tests/mob_den_fix_1020.test.mjs
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMobService } from '../../src/lib/server/mob/service.js';
import { DEN_FIX_CANDIDATES, denFixView, fixStateOf } from '../../src/lib/mob/denFix.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BASE = ['20261017100000_mob.sql', '20261017190000_mob_fix_1017.sql'].map((f) => read(`supabase/migrations/${f}`)).join('\n');
const V3 = ['20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live'];
const v3Sql = V3.map((f) => read(`supabase/migrations/${f}.sql`)).join('\n');
const FIX = '20261020152000_mob_den_fix';
const fixSql = read(`supabase/migrations/${FIX}.sql`);
const fixUndo = read(`supabase/undo/${FIX}.undo.sql`);
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Thursday 22 Oct 2026, 2:05 PM IST.
const NOW = Date.parse('2026-10-22T08:35:00Z');
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// A game opened at NOW closes at NOW + 24 h; its check opens Wednesday 28 Oct 12:00 AM IST and closes Sunday 1 Nov 11:59:59 PM IST.
const CHECK_OPENS = Date.parse('2026-10-27T18:30:00.000Z');
const CHECK_CLOSES = Date.parse('2026-11-01T18:29:59.000Z');
const ID = '00000000-0000-4000-8000-0000000000a1';

const STUBS = `
create schema if not exists realtime;
create table if not exists realtime.messages (id bigint generated always as identity primary key, topic text, extension text, payload jsonb, event text, private boolean);
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql stable as $$ select current_setting('rt.topic', true) $$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean) returns void language sql as $$ select 1 $$;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('rt.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
`;

async function database({ fix = true } = {}) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,8) g;");
  await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await db.exec(STUBS);
  await db.exec(BASE);
  await db.exec(v3Sql);
  if (fix) { await db.exec(fixSql); await db.exec(fixSql); } // idempotent
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]?.r;
function pgRpc(db, { seen = null, fail = null } = {}) {
  return async (name, params) => {
    if (seen) seen.push(name);
    if (fail && fail.name === name) throw fail.error;
    const keys = Object.keys(params);
    const values = keys.map((k) => {
      const v = params[k];
      if (['p_picks', 'p_keys', 'p_days'].includes(k) && Array.isArray(v)) return `{${v.join(',')}}`;
      return v && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, values)).rows[0].r;
  };
}

// 40 bank questions; the key is i % 4.
const BANK = Array.from({ length: 40 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, chapter: 'Goodwill', explanation: `EXPLAIN-q${i + 1}`,
  options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })),
}));
const keyOf = (id) => BANK.find((q) => q.id === id).correctIndex;
const wrongOf = (id) => (keyOf(id) + 1) % 4;
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function serviceFor(db, { clock = { now: NOW }, rpc = pgRpc(db) } = {}) {
  let seed = 1;
  return createMobService({
    rpc, now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s === 'accountancy' ? 'Accountancy' : 'Economics' } : { ok: false }),
    loadUser: async () => ({ subjects: ['accountancy', 'economics'], isPremium: false }),
    validChapter: (subject, chapter) => subject === 'accountancy' && ['Goodwill', 'Cash Flow Statement'].includes(chapter),
    pickQuestionIds: async (_s, { count = 10, key = null, exclude = [] } = {}) => {
      const start = key ? hash(key) % 30 : 0;
      const skip = new Set(exclude);
      return Array.from({ length: BANK.length }, (_, i) => BANK[(start + i) % BANK.length].id).filter((id) => !skip.has(id)).slice(0, count);
    },
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async () => null, findAttempts: async () => [],
    startPractice: async (_u, input, server) => ({ id: `practice_${input.generationKey.slice(4, 12)}`, questions: server.mobPaper.questions }),
    v3Enabled: () => true, billingOn: () => false, liveEnabled: () => false,
  });
}
async function chaiCircle(svc, { members = 4 } = {}) {
  const mobId = (await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'dart' })).mob.id;
  if (members > 1) {
    const inv = await svc.invite('u1', { mob: mobId });
    for (const [u, name] of [['u2', 'Aarav'], ['u3', 'Kabir'], ['u4', 'Zoya']].slice(0, members - 1)) await svc.join(u, { code: inv.code, name, colour: 1 });
  }
  return mobId;
}
async function play(svc, clock, user, gameId, plan, gap = 5) {
  const run = await svc.v3.startRun(user, gameId);
  const ids = run.questions.map((q) => BANK.find((b) => b.question === q.stem).id);
  for (let q = 0; q < plan.length; q += 1) {
    clock.now += gap * 1000;
    await svc.v3.answer(user, gameId, { q, pick: plan[q] === 'r' ? keyOf(ids[q]) : plan[q] === 'w' ? wrongOf(ids[q]) : -1 });
  }
  return ids;
}
const denOf = async (svc, user, mobId) => (await svc.view(user, { mobId })).mob.v3;
// A game u1, u2 and u3 play with question 4 (index 3) wrong for all three: the trap. u4 does not play. Returns the game.
async function trappedGame(svc, clock, mobId) {
  const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
  for (const u of ['u1', 'u2', 'u3']) await play(svc, clock, u, g.id, ['r', 'r', 'r', 'w', 'r']);
  return g;
}
const answerFix = async (svc, db, user, game, stage) => {
  await svc.v3.fixStart(user, { game, q: 3, stage });
  const id = await one(db, 'select question_id r from mob_fix_checks where user_id=$1 and stage=$2 and game_id=$3::uuid', [user, stage, game]);
  return svc.v3.fixAnswer(user, { game, q: 3, stage, pick: keyOf(id) });
};

// ---------------------------------------------------------------------------------------------------------------
// The rules, pure
// ---------------------------------------------------------------------------------------------------------------

const row = (over = {}) => ({
  game_id: ID, q: 3, check_opens_at: new Date(CHECK_OPENS).toISOString(), check_closes_at: new Date(CHECK_CLOSES).toISOString(),
  now_answered: false, check_answered: false, ...over,
});

test('state of one trap: ready until the check opens, check while it is open and unanswered, nothing once done or over', () => {
  const at = (r, t) => fixStateOf(r, t);
  assert.equal(at(row(), NOW + DAY), 'ready', 'closed, fix not taken, the check is days away');
  assert.equal(at(row(), CHECK_OPENS - 1), 'ready', 'one millisecond before the check opens it is still ready, never check');
  assert.equal(at(row(), CHECK_OPENS), 'check', 'the moment it opens');
  assert.equal(at(row(), CHECK_CLOSES), 'check', 'to the last second of the window');
  assert.equal(at(row(), CHECK_CLOSES + 1), null, 'after the window nothing is asked');
  assert.equal(at(row({ now_answered: true }), NOW + DAY), null, 'fix taken, the check not open yet: wait');
  assert.equal(at(row({ now_answered: true }), CHECK_OPENS + MIN), 'check', 'fix taken, the check is open');
  assert.equal(at(row({ now_answered: true, check_answered: true }), CHECK_OPENS + MIN), null, 'both taken');
  assert.equal(at(row({ check_answered: true }), CHECK_OPENS + MIN), 'ready', 'the check taken but the fix not: the fix is still open until Sunday');
  assert.equal(at(row({ check_answered: true }), CHECK_CLOSES + 1), null);
  // a row the database could not have made says nothing
  for (const bad of [row({ check_opens_at: null }), row({ check_closes_at: 'soon' }), null, undefined, {}]) assert.equal(at(bad, NOW + DAY), null);
});

test('the den object: the newest game with something left, one-based question, ISO check time, and nothing to show is null', () => {
  const older = row({ game_id: '00000000-0000-4000-8000-0000000000a2', q: 0 });
  assert.deepEqual(denFixView([row()], NOW + DAY), { gameId: ID, question: 4, state: 'ready', checkOpensAt: '2026-10-27T18:30:00.000Z' });
  assert.deepEqual(denFixView([row()], CHECK_OPENS + HOUR), { gameId: ID, question: 4, state: 'check', checkOpensAt: '2026-10-27T18:30:00.000Z' });
  // newest first: the first row with something left wins; a finished newer game does not hide an older one
  assert.equal(denFixView([row(), older], NOW + DAY).gameId, ID);
  assert.equal(denFixView([row({ now_answered: true }), older], NOW + DAY).gameId, older.game_id);
  assert.equal(denFixView([row({ now_answered: true }), older], NOW + DAY).question, 1);
  assert.equal(denFixView([row({ now_answered: true, check_answered: true })], CHECK_OPENS + HOUR), null);
  assert.equal(denFixView([], NOW), null);
  assert.equal(denFixView(null, NOW), null);
  // a bad id or a bad index is skipped, not sent
  assert.equal(denFixView([row({ game_id: 'nope' }), row({ q: -1 }), row({ q: 1.5 }), row({ q: '3' })], NOW + DAY), null);
  assert.deepEqual(Object.keys(denFixView([row()], NOW + DAY)).sort(), ['checkOpensAt', 'gameId', 'question', 'state']);
  assert.equal(DEN_FIX_CANDIDATES, 5, 'the SQL limit and the constant are the same number');
  assert.match(fixSql, /limit 5\n/);
});

// ---------------------------------------------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------------------------------------------

test('the migration applies twice, reads only, is service role only, and its undo drops the function and the index twice', async () => {
  const db = await database();
  try {
    const mobId = await chaiCircle(serviceFor(db));
    assert.equal(await one(db, "select count(*)::int r from pg_proc where proname = 'mob_den_fix'"), 1);
    assert.equal(await one(db, "select count(*)::int r from pg_indexes where indexname = 'mob_traps_mob_idx'"), 1);
    assert.deepEqual(await one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mobId, 'u2', new Date(NOW).toISOString()]), [], 'no trap: an empty list');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select public.mob_den_fix($1::uuid, $2, now())', [mobId, 'u2']), /permission denied/, role);
      await db.exec('reset role');
    }
    // it writes nothing (stable, invoker): the Mob's rows are the same after calling it
    const before = await one(db, "select (select count(*) from mob_traps)::int + (select count(*) from mob_fix_checks)::int r");
    await db.query('select public.mob_den_fix($1::uuid, $2, now())', [mobId, 'u2']);
    assert.equal(await one(db, "select (select count(*) from mob_traps)::int + (select count(*) from mob_fix_checks)::int r"), before);
    assert.match(fixSql, /Applied to NOTHING by this change\./);
    assert.match(fixSql, /Undo: supabase\/undo\/20261020152000_mob_den_fix\.undo\.sql/);
    await db.exec(fixUndo); await db.exec(fixUndo);
    assert.equal(await one(db, "select count(*)::int r from pg_proc where proname = 'mob_den_fix'"), 0);
    assert.equal(await one(db, "select count(*)::int r from pg_indexes where indexname = 'mob_traps_mob_idx'"), 0);
    await db.exec(fixSql); // and it re-applies
    assert.equal(await one(db, "select count(*)::int r from pg_proc where proname = 'mob_den_fix'"), 1);
  } finally { await db.close(); }
});

test('the read: only this Mob, only a member, never a fixed trap or a closed window, newest game first, this member\'s own answers', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(svc);
    const g = await trappedGame(svc, clock, mobId);
    clock.now = NOW + 25 * HOUR;
    await svc.v3.review('u1', g.id); // settles: the trap row now exists
    const ask = (mob, user, at = clock.now) => one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mob, user, new Date(at).toISOString()]);
    const [t] = await ask(mobId, 'u4');
    // (the database prints its own zone offset; the instants are what count)
    assert.deepEqual({ ...t, check_opens_at: Date.parse(t.check_opens_at), check_closes_at: Date.parse(t.check_closes_at) },
      { game_id: g.id, q: 3, check_opens_at: CHECK_OPENS, check_closes_at: CHECK_CLOSES, now_answered: false, check_answered: false });
    // a member of another Mob (u5 has none) and a stranger get nothing
    assert.deepEqual(await ask(mobId, 'u5'), []);
    const other = (await svc.create('u5', { subject: 'accountancy', name: 'Meher', colour: 2, nameKey: 1, fold: 'dart' })).mob.id;
    assert.deepEqual(await ask(other, 'u5'), [], 'another Mob has no trap');
    assert.deepEqual(await ask(other, 'u4'), [], 'u4 is not in that Mob');
    assert.deepEqual(await ask(mobId, 'u5'), [], 'u5 is not in this Mob');
    // this member's own answers
    await answerFix(svc, db, 'u2', g.id, 'now');
    assert.deepEqual(await ask(mobId, 'u2'), [], 'u2 took the fix question and the check is days away: nothing is left, so nothing is listed');
    assert.equal((await ask(mobId, 'u2', CHECK_OPENS))[0].now_answered, true, 'the check is open: listed again, with the fix already answered');
    assert.equal((await ask(mobId, 'u2', CHECK_OPENS))[0].check_answered, false);
    assert.equal((await ask(mobId, 'u4'))[0].now_answered, false, 'another member\'s answer is not yours');
    // the window: listed to its last second, gone after
    assert.equal((await ask(mobId, 'u4', CHECK_CLOSES)).length, 1);
    assert.equal((await ask(mobId, 'u4', CHECK_CLOSES + 1000)).length, 0);
    // fixed together: not listed for anyone
    await db.query('update mob_traps set fixed_at = $1::timestamptz', [new Date(CHECK_OPENS + HOUR).toISOString()]);
    for (const u of ['u1', 'u2', 'u3', 'u4']) assert.deepEqual(await ask(mobId, u, CHECK_OPENS + 2 * HOUR), [], u);
    // newest game first, at most 5
    await db.query('update mob_traps set fixed_at = null');
    for (let i = 0; i < 6; i += 1) {
      await db.query("insert into mob_games (id, mob_id, created_by, started_via, format, mode, subject, question_ids, seconds_per_question, week_start, opened_at, closes_at) select gen_random_uuid(), mob_id, created_by, started_via, format, mode, subject, question_ids, seconds_per_question, week_start, opened_at + ($1 || ' hours')::interval, closes_at + ($1 || ' hours')::interval from mob_games where id = $2::uuid", [String(i + 1), g.id]);
    }
    await db.query("insert into mob_traps (game_id, q, question_id, mob_id, opened_at, check_opens_at, check_closes_at) select id, 1, 'q2', mob_id, closes_at, $1::timestamptz, $2::timestamptz from mob_games where id <> $3::uuid", [new Date(CHECK_OPENS).toISOString(), new Date(CHECK_CLOSES).toISOString(), g.id]);
    const list = await ask(mobId, 'u4', NOW + 3 * DAY); // (every copy has closed by then)
    assert.equal(list.length, 5);
    assert.ok(!list.some((x) => x.game_id === g.id), 'the oldest of seven is the one left out');
    const times = await db.query("select game_id::text id, opened_at from mob_traps order by opened_at desc limit 5");
    assert.deepEqual(list.map((x) => x.game_id), times.rows.map((x) => x.id));
  } finally { await db.close(); }
});

test('the read: five newer traps this member has finished never hide an older one that is still theirs (the member\'s state is filtered before the limit)', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(svc);
    const g = await trappedGame(svc, clock, mobId);
    clock.now = NOW + 25 * HOUR;
    await svc.v3.review('u1', g.id); // the real trap of the oldest game
    // six newer games, each with a trap; u4 has answered the fix question of the five newest
    for (let i = 0; i < 6; i += 1) {
      await db.query("insert into mob_games (id, mob_id, created_by, started_via, format, mode, subject, question_ids, seconds_per_question, week_start, opened_at, closes_at) select gen_random_uuid(), mob_id, created_by, started_via, format, mode, subject, question_ids, seconds_per_question, week_start, opened_at + ($1 || ' hours')::interval, closes_at + ($1 || ' hours')::interval from mob_games where id = $2::uuid", [String(i + 1), g.id]);
    }
    await db.query("insert into mob_traps (game_id, q, question_id, mob_id, opened_at, check_opens_at, check_closes_at) select id, 1, 'q2', mob_id, closes_at, $1::timestamptz, $2::timestamptz from mob_games where id <> $3::uuid", [new Date(CHECK_OPENS).toISOString(), new Date(CHECK_CLOSES).toISOString(), g.id]);
    const newest = (await db.query('select game_id::text id from mob_traps order by opened_at desc limit 5')).rows.map((r) => r.id);
    const unfinished = (await db.query('select game_id::text id from mob_traps where game_id::text <> all($1::text[]) order by opened_at desc', [newest])).rows.map((r) => r.id);
    assert.equal(unfinished.length, 2, 'the oldest copy and the real game');
    for (const id of newest) {
      await db.query("insert into mob_fix_checks (game_id, q, user_id, stage, question_id, correct, answered_at) values ($1::uuid, 1, 'u4', 'now', 'q2', true, $2::timestamptz)", [id, new Date(clock.now).toISOString()]);
    }
    const at = new Date(NOW + 3 * DAY).toISOString();
    const rows = await one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mobId, 'u4', at]);
    assert.deepEqual(rows.map((r) => r.game_id), unfinished, 'only what is still left for u4, newest first');
    assert.equal(denFixView(rows, NOW + 3 * DAY).gameId, unfinished[0], 'the card is the older trap that is still open for u4');
    // someone who finished nothing still sees the five newest (the limit is still 5)
    const fresh = await one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mobId, 'u3', at]);
    assert.deepEqual(fresh.map((r) => r.game_id), newest);
    // a member who has done every step has nothing listed at all, even with the check open
    for (const id of [...newest, ...unfinished]) {
      await db.query("insert into mob_fix_checks (game_id, q, user_id, stage, question_id, correct, answered_at) select t.game_id, t.q, 'u2', s.stage, 'q2', true, $2::timestamptz from mob_traps t, (values ('now'), ('check')) s(stage) where t.game_id = $1::uuid on conflict do nothing", [id, at]);
    }
    assert.deepEqual(await one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mobId, 'u2', new Date(CHECK_OPENS + HOUR).toISOString()]), []);
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// The den
// ---------------------------------------------------------------------------------------------------------------

test('the den: no fix while the game is open, ready after the close, check only from the trap\'s own Wednesday, none once you did your part or the Mob fixed it', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(svc);
    const g = await trappedGame(svc, clock, mobId);
    // open: nothing
    assert.equal(Object.hasOwn(await denOf(svc, 'u4', mobId), 'fix'), false, 'no trap before the close');
    // closed: the first read after the close makes the trap and already says ready (nobody opened the podium or the review)
    clock.now = NOW + 25 * HOUR;
    assert.equal(await one(db, 'select count(*)::int r from mob_traps'), 0);
    const ready = { gameId: g.id, question: 4, state: 'ready', checkOpensAt: '2026-10-27T18:30:00.000Z' };
    assert.deepEqual((await denOf(svc, 'u4', mobId)).fix, ready, 'u4 never played: the fix is still theirs');
    assert.equal(await one(db, 'select count(*)::int r from mob_traps'), 1, 'made once');
    for (const u of ['u1', 'u2', 'u3']) assert.deepEqual((await denOf(svc, u, mobId)).fix, ready, u);
    // u2 takes the fix question: nothing left for them until the check opens; the others still have it
    await answerFix(svc, db, 'u2', g.id, 'now');
    assert.equal(Object.hasOwn(await denOf(svc, 'u2', mobId), 'fix'), false);
    assert.deepEqual((await denOf(svc, 'u4', mobId)).fix, ready);
    // one millisecond before the check opens: still ready for u4, never check
    clock.now = CHECK_OPENS - 1;
    assert.equal((await denOf(svc, 'u4', mobId)).fix.state, 'ready');
    // the check opens: check for everyone who has not taken it, u2 included (their fix was the other step)
    clock.now = CHECK_OPENS;
    for (const u of ['u1', 'u2', 'u3', 'u4']) assert.deepEqual((await denOf(svc, u, mobId)).fix, { ...ready, state: 'check' }, u);
    // the card's own numbers are the Fix routes' numbers: game id and question - 1 start the check
    const card = (await denOf(svc, 'u4', mobId)).fix;
    const started = await svc.v3.fixStart('u4', { game: card.gameId, q: card.question - 1, stage: card.state });
    assert.equal(started.trap.number, card.question);
    await db.query("delete from mob_fix_checks where user_id = 'u4'"); // (u4 only looked: a started question is not an answer)
    // u2 passes the check: u2 is done; u1 passes it too: the Mob fixed it together, and the card goes for everyone
    await answerFix(svc, db, 'u2', g.id, 'check');
    assert.equal(Object.hasOwn(await denOf(svc, 'u2', mobId), 'fix'), false, 'both steps taken');
    assert.equal(denFixView((await one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mobId, 'u4', new Date(clock.now).toISOString()])), clock.now).state, 'check');
    const last = await answerFix(svc, db, 'u1', g.id, 'check');
    assert.equal(last.fixedTogether, true);
    for (const u of ['u1', 'u2', 'u3', 'u4']) assert.equal(Object.hasOwn(await denOf(svc, u, mobId), 'fix'), false, `${u}: fixed together`);
  } finally { await db.close(); }
});

test('the den keeps the card for the whole check window, after the game has left the den\'s 7-day list, and drops it after Sunday', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(svc);
    const g = await trappedGame(svc, clock, mobId);
    clock.now = NOW + 25 * HOUR;
    assert.equal((await denOf(svc, 'u4', mobId)).games.length, 1, 'the game is in the den\'s list while it is recent');
    // 8 days after the close: the game has left the den's list (closed 7 days ago), the Wednesday check is open until Sunday
    clock.now = Date.parse('2026-10-31T08:35:00Z');
    const den = await denOf(svc, 'u4', mobId);
    assert.equal(den.games.length, 0, 'the game is no longer in the den\'s games');
    assert.deepEqual(den.fix, { gameId: g.id, question: 4, state: 'check', checkOpensAt: '2026-10-27T18:30:00.000Z' });
    // and the Fix route still takes it: the card is a real way in
    const started = await svc.v3.fixStart('u4', { game: den.fix.gameId, q: den.fix.question - 1, stage: den.fix.state });
    assert.ok(started.question.stem);
    // after Sunday 11:59:59 PM IST: gone
    clock.now = CHECK_CLOSES;
    assert.equal(denFixView(await one(db, 'select public.mob_den_fix($1::uuid, $2, $3::timestamptz) as r', [mobId, 'u3', new Date(clock.now).toISOString()]), clock.now).state, 'check');
    clock.now = CHECK_CLOSES + 1000;
    assert.equal(Object.hasOwn(await denOf(svc, 'u3', mobId), 'fix'), false);
  } finally { await db.close(); }
});

test('the state over time for a member who has done nothing: ready, ready, ready, check, check, then none', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(svc);
    await trappedGame(svc, clock, mobId);
    const states = [];
    for (const at of [NOW + 25 * HOUR, NOW + 3 * DAY, CHECK_OPENS - MIN, CHECK_OPENS, CHECK_CLOSES - MIN, CHECK_CLOSES + MIN]) {
      clock.now = at;
      states.push((await denOf(svc, 'u4', mobId)).fix?.state ?? null);
    }
    assert.deepEqual(states, ['ready', 'ready', 'ready', 'check', 'check', null]);
  } finally { await db.close(); }
});

test('no trap, no card: a game with no shared wrong answer, or too few sitters, never makes one; "check" is never sent without a trap', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(svc);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
    for (const u of ['u1', 'u2', 'u3']) await play(svc, clock, u, g.id, ['r', 'r', 'r', 'r', 'r']);
    const two = (await svc.v3.openGame('u2', { mob: mobId, format: 'sprint' })).game;
    for (const u of ['u1', 'u2']) await play(svc, clock, u, two.id, ['w', 'w', 'w', 'w', 'w']);
    for (const at of [NOW + 25 * HOUR, CHECK_OPENS + HOUR]) {
      clock.now = at;
      for (const u of ['u1', 'u2', 'u3', 'u4']) assert.equal(Object.hasOwn(await denOf(svc, u, mobId), 'fix'), false, `${u} at ${new Date(at).toISOString()}`);
    }
    assert.equal(await one(db, 'select count(*)::int r from mob_traps'), 0);
  } finally { await db.close(); }
});

test('the read is one small call a den, none for a Mob of one, and the object holds only the four keys', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const seen = [];
    const svc = serviceFor(db, { clock, rpc: pgRpc(db, { seen }) });
    const solo = await chaiCircle(svc, { members: 1 });
    seen.length = 0;
    await denOf(svc, 'u1', solo);
    assert.equal(seen.filter((n) => n === 'mob_den_fix').length, 0, 'a Mob of one has no trap and no read');
    const svc2 = serviceFor(db, { clock, rpc: pgRpc(db, { seen }) });
    const mobId = (await svc2.create('u2', { subject: 'accountancy', name: 'Aarav', colour: 1, nameKey: 2, fold: 'dart' })).mob.id;
    const inv = await svc2.invite('u2', { mob: mobId });
    for (const [u, name] of [['u3', 'Kabir'], ['u4', 'Zoya']]) await svc2.join(u, { code: inv.code, name, colour: 1 });
    const g = (await svc2.v3.openGame('u2', { mob: mobId, format: 'sprint' })).game;
    for (const u of ['u2', 'u3', 'u4']) await play(svc2, clock, u, g.id, ['r', 'r', 'r', 'w', 'r']);
    clock.now = NOW + 25 * HOUR;
    seen.length = 0;
    const v3 = await denOf(svc2, 'u3', mobId);
    assert.equal(seen.filter((n) => n === 'mob_den_fix').length, 1, 'one read a den');
    assert.deepEqual(Object.keys(v3.fix).sort(), ['checkOpensAt', 'gameId', 'question', 'state']);
    assert.ok(JSON.stringify(v3.fix).length < 160, JSON.stringify(v3.fix));
    // nothing about anyone else: no user id, no name, no pick in the object
    assert.doesNotMatch(JSON.stringify(v3.fix), /u[1-8]\b|Aarav|Kabir|Zoya|pick|correct/);
    // the same two members read the same card, differing only in their own state: nothing in it names who took which step
    assert.deepEqual((await denOf(svc2, 'u4', mobId)).fix, v3.fix);
  } finally { await db.close(); }
});

test('without the migration the den has no fix and nothing is logged; any other failure is logged with codes only and the den still loads', async () => {
  const warn = mock.method(console, 'warn', () => {});
  const clock = { now: NOW };
  try {
    // 1. the function is missing (code first, migration later): no key, no log
    let db = await database({ fix: false });
    try {
      const svc = serviceFor(db, { clock });
      const mobId = await chaiCircle(svc);
      await trappedGame(svc, clock, mobId);
      clock.now = NOW + 25 * HOUR;
      const v3 = await denOf(svc, 'u4', mobId);
      assert.equal(Object.hasOwn(v3, 'fix'), false);
      assert.ok(v3.members.length === 4 && v3.quest, 'the rest of the den is whole');
      assert.equal(warn.mock.calls.filter((c) => /mob_den_fix_failed/.test(String(c.arguments[0]))).length, 0);
    } finally { await db.close(); }
    // 2. a timeout: no key, logged once with its code and no message, ids or names
    clock.now = NOW;
    db = await database();
    try {
      const error = Object.assign(new Error('canceling statement due to statement timeout for mob 1234 u4'), { code: '57014' });
      const svc = serviceFor(db, { clock, rpc: pgRpc(db, { fail: { name: 'mob_den_fix', error } }) });
      const mobId = await chaiCircle(svc);
      await trappedGame(svc, clock, mobId);
      clock.now = NOW + 25 * HOUR;
      warn.mock.resetCalls(); // setting the Mob up read the den too, and each read failed the same way
      const v3 = await denOf(svc, 'u4', mobId);
      assert.equal(Object.hasOwn(v3, 'fix'), false);
      assert.ok(v3.members.length === 4 && v3.quest, 'the rest of the den is whole');
      const logged = warn.mock.calls.filter((c) => /mob_den_fix_failed/.test(String(c.arguments[0])));
      assert.equal(logged.length, 1);
      assert.deepEqual(logged[0].arguments, ['mob_den_fix_failed', 'UNAVAILABLE/57014']);
    } finally { await db.close(); }
  } finally { warn.mock.restore(); }
});

test('a function that is not there is asked once, then not again for five minutes, per function; any other failure is asked every time', async () => {
  const warn = mock.method(console, 'warn', () => {});
  const clock = { now: NOW };
  try {
    const db = await database({ fix: false });
    try {
      const seen = [];
      const svc = serviceFor(db, { clock, rpc: pgRpc(db, { seen }) });
      const count = (name) => seen.filter((n) => n === name).length;
      const mobId = await chaiCircle(svc); // setting the Mob up reads the den a few times
      await denOf(svc, 'u2', mobId);
      assert.equal(count('mob_den_fix'), 1, 'the first den read of a Mob of two or more asks, learns the function is missing, and never asks again');
      assert.equal(count('mob_hours_head'), 1, 'the hours function is missing too: asked once in all those reads');
      assert.equal(count('mob_hours_rows'), 0);
      for (let i = 0; i < 4; i += 1) { clock.now += MIN; await denOf(svc, 'u2', mobId); }
      assert.equal(count('mob_den_fix'), 1, 'four more den reads inside five minutes: not asked');
      assert.equal(count('mob_hours_head'), 1, 'and neither is the hours function');
      clock.now += 5 * MIN; // five minutes after the first miss
      await denOf(svc, 'u2', mobId);
      assert.equal(count('mob_den_fix'), 2, 'five minutes later it is asked again, so a migration applied meanwhile is noticed');
      assert.equal(count('mob_hours_head'), 2);
      assert.equal(warn.mock.calls.filter((c) => /mob_(den_fix|hours)_failed/.test(String(c.arguments[0]))).length, 0, 'a missing function is never logged');
    } finally { await db.close(); }
    // any other failure is not remembered: asked on every den read, logged each time with its code
    const db3 = await database();
    try {
      const seen = [];
      const error = Object.assign(new Error('timeout'), { code: '57014' });
      const svc = serviceFor(db3, { clock: { now: NOW }, rpc: pgRpc(db3, { seen, fail: { name: 'mob_den_fix', error } }) });
      const mobId = await chaiCircle(svc);
      seen.length = 0;
      warn.mock.resetCalls();
      await denOf(svc, 'u2', mobId); await denOf(svc, 'u2', mobId);
      assert.equal(seen.filter((n) => n === 'mob_den_fix').length, 2);
      assert.equal(warn.mock.calls.filter((c) => /mob_den_fix_failed/.test(String(c.arguments[0]))).length, 2);
    } finally { await db3.close(); }
  } finally { warn.mock.restore(); }
});

test('the missing-function memo: skip, retry after the pause, forget on an answer, one name never hides another', async () => {
  const { createMissingMemo, MISSING_RETRY_MS } = await import('../../src/lib/server/mob/missing.js');
  assert.equal(MISSING_RETRY_MS, 5 * 60 * 1000);
  const clock = { now: 1000 };
  const memo = createMissingMemo({ now: () => clock.now });
  assert.equal(memo.skip('a'), false, 'never asked: ask');
  memo.miss('a');
  assert.equal(memo.skip('a'), true);
  assert.equal(memo.skip('b'), false, 'another function is unaffected');
  clock.now += MISSING_RETRY_MS - 1;
  assert.equal(memo.skip('a'), true, 'one millisecond short of the pause');
  clock.now += 1;
  assert.equal(memo.skip('a'), false, 'the pause is over: ask again');
  assert.equal(memo.size(), 0, 'and the old miss is forgotten');
  memo.miss('a'); memo.seen('a');
  assert.equal(memo.skip('a'), false, 'an answer clears the miss');
});
