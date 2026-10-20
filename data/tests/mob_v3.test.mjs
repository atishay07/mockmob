// Mob v3 server, Phase A (docs/design-decisions/pass-1019pm/mob-v3/MOB-BUILD-SPEC-V3.md section 7.1): the pure rules,
// the four migrations on a real Postgres (PGlite) with their undo files, the service on top of them, the route handler,
// RLS denial, Realtime room auth on stubs, account deletion and the leak rule (F1).
// Run: node --test data/tests/mob_v3.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_RE, ERRORS, codeFromBytes, displayCode, normalizeCode } from '../../src/lib/mob/model.mjs';
import { MOB_NAMES, mobName, validNameKey } from '../../src/lib/mob/names.mjs';
import { FOLDS, FOLD_KEYS, STARTERS, earnedBy, mobShelf, parcelFor, ruleProgress } from '../../src/lib/mob/folds.mjs';
import { startRight, startsView, inLiveHours } from '../../src/lib/mob/starts.mjs';
import { assignMoments, checkWindow, gameTrap, ghostPace, marksFor, placeRuns, publicQuestion, tieFor, togetherLine } from '../../src/lib/mob/games.mjs';
import { questLabels, questTarget } from '../../src/lib/mob/quest.mjs';
import { computeMobChain } from '../../src/lib/mob/mobChain.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
import { ACTIONS, LIMITS, handleMob, limitMessage } from '../../src/lib/server/mob/http.js';
import { DELETION_STEPS } from '../../src/lib/server/accountDeletion.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const BASE = ['20261017100000_mob.sql', '20261017190000_mob_fix_1017.sql'].map((f) => read(`supabase/migrations/${f}`)).join('\n');
const V3 = ['20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live'];
const v3Sql = V3.map((f) => read(`supabase/migrations/${f}.sql`)).join('\n');
const v3Undo = [...V3].reverse().map((f) => read(`supabase/undo/${f}.undo.sql`)).join('\n');
const blocklist = JSON.parse(read('data/mob_name_blocklist.json'));

// Thursday 22 Oct 2026, 2:05 PM IST. The IST week is Monday 19 Oct.
const NOW = Date.parse('2026-10-22T08:35:00Z');
const WEEK = '2026-10-19';
const MIN = 60_000;
const HOUR = 60 * MIN;

// Realtime and auth stubs (PGlite has neither schema): realtime.messages with RLS, realtime.topic(), realtime.send()
// that records every payload, and auth.uid() from a setting.
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

async function database({ users = 8, attempts = true } = {}) {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(`create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,${users}) g;`);
  if (attempts) {
    await db.exec(`create table public.attempts (id text primary key, user_id text references public.users(id), subject text, score int, correct int, wrong int,
      unattempted int, total int, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  }
  await db.exec(STUBS);
  await db.exec(BASE);
  await db.exec(v3Sql);
  await db.exec(v3Sql); // idempotent
  return db;
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0]?.r;

const PG_ARRAYS = new Set(['p_picks', 'p_keys', 'p_days']);
function pgRpc(db) {
  return async (name, params) => {
    const keys = Object.keys(params);
    const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const values = keys.map((k) => {
      const v = params[k];
      if (PG_ARRAYS.has(k) && Array.isArray(v)) return `{${v.join(',')}}`;
      if (v && typeof v === 'object') return JSON.stringify(v);
      return v;
    });
    return (await db.query(`select public.${name}(${args}) as r`, values)).rows[0].r;
  };
}

// 40 bank questions. The key is i % 4; every explanation carries a marker the leak scan looks for.
const BANK = Array.from({ length: 40 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `Question ${i + 1} stem`, chapter: 'Goodwill', explanation: `EXPLAIN-q${i + 1}`,
  options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t}${i}` })),
}));
const keyOf = (id) => BANK.find((q) => q.id === id).correctIndex;
const wrongOf = (id) => (keyOf(id) + 1) % 4;
// Different keys draw different questions (a rematch gets new ones; a fix question is never one of the game's).
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function serviceFor(db, { clock = { now: NOW }, premium = false, billing = false, live = false, v3 = true } = {}) {
  let seed = 1;
  return createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'test-secret', blocklist,
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 97 + 13) % 256)),
    subjectInfo: (s) => (['accountancy', 'economics'].includes(s) ? { ok: true, id: s, name: s === 'accountancy' ? 'Accountancy' : 'Economics' } : { ok: false }),
    loadUser: async (id) => ({ subjects: ['accountancy', 'economics'], isPremium: typeof premium === 'function' ? premium(id) : premium }),
    validChapter: (subject, chapter) => subject === 'accountancy' && ['Goodwill', 'Cash Flow Statement'].includes(chapter),
    // Like the bank: never an excluded id (the Mob's open games and held papers), as many as it has.
    pickQuestionIds: async (_s, { count = 10, key = null, exclude = [] } = {}) => {
      const start = key ? hash(key) % 30 : 0;
      const skip = new Set(exclude);
      return Array.from({ length: BANK.length }, (_, i) => BANK[(start + i) % BANK.length].id).filter((id) => !skip.has(id)).slice(0, count);
    },
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async () => null,
    findAttempts: async () => [],
    startPractice: async (_u, input, server) => ({ id: `practice_${input.generationKey.slice(4, 12)}`, questions: server.mobPaper.questions }),
    v3Enabled: () => v3, billingOn: () => billing, liveEnabled: () => live,
  });
}
const code = (c) => (e) => e?.code === c;

// A Mob of four: u1 Riya (owner), u2 Aarav, u3 Kabir, u4 Zoya. Returns the Mob id.
async function chaiCircle(db, svc) {
  const made = await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'dart' });
  const mobId = made.mob.id;
  const inv = await svc.invite('u1', { mob: mobId });
  for (const [u, name] of [['u2', 'Aarav'], ['u3', 'Kabir'], ['u4', 'Zoya']]) await svc.join(u, { code: inv.code, name, colour: 1 });
  return mobId;
}

// ---------------------------------------------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------------------------------------------

test('SV-2 codes: new invites are 6 Crockford characters; 8-character codes still read; loose typing normalises', () => {
  assert.equal(codeFromBytes([0, 0, 0, 0], 6), '000000');
  assert.equal(codeFromBytes([255, 255, 255, 255], 6), 'ZZZZZZ');
  assert.equal(codeFromBytes([255, 255, 255, 255, 255]), 'ZZZZZZZZ', 'the old 8-character draw is unchanged');
  for (let i = 0; i < 300; i += 1) {
    const c = codeFromBytes(Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)), 6);
    assert.match(c, /^[0-9A-HJKMNP-TV-Z]{6}$/);
  }
  assert.equal(normalizeCode('k7p 2m9'), 'K7P2M9');
  assert.equal(normalizeCode('K7P-2MO'), 'K7P2M0', 'O reads as zero');
  assert.equal(normalizeCode('K7P2Mi'), 'K7P2M1');
  assert.equal(normalizeCode('k7p2ml'), 'K7P2M1');
  assert.equal(normalizeCode('7KQ2M9XR'), '7KQ2M9XR');
  for (const bad of ['K7P2M', 'K7P2M9X', 'K7P2M9XRR', 'K7P2MU', null]) assert.equal(normalizeCode(bad), null, String(bad));
  assert.match('K7P2M9', CODE_RE);
  assert.equal(displayCode('K7P2M9'), 'K7P 2M9');
  assert.equal(displayCode('7KQ2M9XR'), '7KQ2M9XR');
});

test('Mob names: a fixed list of 24 kind names, no "Night Owls", the subject when none is picked', () => {
  assert.equal(MOB_NAMES.length, 24);
  assert.equal(new Set(MOB_NAMES).size, 24);
  assert.ok(!MOB_NAMES.some((n) => /owl|night|midnight|late/i.test(n)));
  assert.deepEqual(mobName(0, 'Accountancy'), { key: 0, text: 'Chai Circle' });
  assert.deepEqual(mobName(null, 'Accountancy'), { key: null, text: 'Accountancy' });
  for (const bad of [-1, 24, 1.5, '3', null]) assert.equal(validNameKey(bad), false, String(bad));
});

test('the earn table: 4 starters, 8 earned by stated rules, nothing for sale, Kandil awake', () => {
  assert.deepEqual(STARTERS, ['dart', 'dogear', 'hexa', 'kandil']);
  assert.equal(FOLD_KEYS.length, 12);
  assert.equal(FOLDS.kandil.line, 'Keeps the desk lit for everyone.');
  assert.deepEqual(earnedBy({}), []);
  assert.deepEqual(earnedBy({ questsDone: 1, trapsFixed: 3, mobWeeks: 4, fullMocks: 1, cleanGames: 3, beatBest: 1, fixesHeld: 5, cameBack: 1 }).sort(),
    ['crane', 'cutting', 'hop', 'naav', 'patang', 'stamp', 'sticky', 'tally']);
  assert.deepEqual(ruleProgress('crane', { trapsFixed: 1 }), { have: 1, need: 3 });
  assert.deepEqual(ruleProgress('crane', { trapsFixed: 9 }), { have: 3, need: 3 }, 'have never passes need');
  assert.deepEqual(mobShelf(3), { items: ['den_stamp'], nextItem: { at: 4, item: 'desk_bell' } });
  assert.deepEqual(parcelFor({ mobOwnsHop: false, weeksIfStitched: 1 }), { kind: 'fold', fold: 'hop' });
  assert.deepEqual(parcelFor({ mobOwnsHop: true, weeksIfStitched: 4 }), { kind: 'fold', fold: 'stamp' });
  assert.deepEqual(parcelFor({ mobOwnsHop: true, weeksIfStitched: 8 }), { kind: 'item', item: 'brass_lamp' });
  assert.deepEqual(parcelFor({ mobOwnsHop: true, weeksIfStitched: 5 }), { kind: 'stitch' });
  assert.doesNotMatch(JSON.stringify(FOLDS), /₹|Rs|price|buy|per month|rare|random/i, 'no price, no rarity');
});

test('SV-3 start rules: every row of 3.3', () => {
  const base = { billingOn: true, pro: false, mode: 'async', format: 'sprint', claimUsed: false, micsHeld: 0, liveOn: true, inLiveHours: true };
  const r = (over) => startRight({ ...base, ...over });
  assert.deepEqual(r({ mode: 'live', liveOn: false }), { ok: false, code: 'LIVE_OFF' });
  assert.deepEqual(r({ mode: 'live', inLiveHours: false }), { ok: false, code: 'LIVE_HOURS' });
  assert.deepEqual(r({ billingOn: false, mode: 'live' }), { ok: true, via: 'open' }, 'D133: billing off, anyone starts anything');
  assert.deepEqual(r({ billingOn: false, claimUsed: true }), { ok: true, via: 'open' });
  assert.deepEqual(r({ pro: true, mode: 'live', claimUsed: true }), { ok: true, via: 'pro' });
  for (const format of ['sprint', 'round', 'rematch']) assert.deepEqual(r({ format }), { ok: true, via: 'free_weekly' }, format);
  assert.deepEqual(r({ claimUsed: true, micsHeld: 1 }), { ok: true, via: 'mic' });
  assert.deepEqual(r({ mode: 'live', micsHeld: 1 }), { ok: true, via: 'mic' }, 'C-dec 2: a passed mic allows a live room');
  assert.deepEqual(r({ mode: 'live' }), { ok: false, code: 'START_FORMAT' }, 'Free weekly start is async only');
  assert.deepEqual(r({ mode: 'live', claimUsed: true }), { ok: false, code: 'START_PRO' });
  assert.deepEqual(r({ claimUsed: true }), { ok: false, code: 'START_USED' });
  assert.equal(startsView({ billingOn: false, pro: false, claimUsed: true, micsHeld: 0, liveOn: false }).can, true);
  assert.deepEqual(startsView({ billingOn: true, pro: false, claimUsed: false, micsHeld: 0, liveOn: true }),
    { billingOn: true, can: true, via: 'free_weekly', modes: ['async'], formats: ['sprint', 'round', 'race'], locked: ['mock'], freeLeft: 1, mics: 0 });
  assert.deepEqual(startsView({ billingOn: true, pro: false, claimUsed: true, micsHeld: 0, liveOn: true }),
    { billingOn: true, can: false, reason: 'used', modes: [], formats: [], locked: ['race', 'mock'], freeLeft: 0, mics: 0 });
  assert.deepEqual(startsView({ billingOn: true, pro: false, claimUsed: false, micsHeld: 0, liveOn: true, formatsOn: false }),
    { billingOn: true, can: true, via: 'free_weekly', modes: ['async'], formats: ['sprint', 'round'], locked: [], freeLeft: 1, mics: 0 }, 'MOB_FORMATS_ENABLED off');
  assert.equal(startsView({ billingOn: true, pro: true, claimUsed: false, micsHeld: 0, micsGiven: 1, liveOn: true }).micsToGive, 1);
  assert.equal(startsView({ billingOn: true, pro: false, claimUsed: false, micsHeld: 0, liveOn: true }).micsToGive, undefined, 'only Pro sees mics to give');
  // Live hours, IST: 6:00 AM to 11:00 PM.
  assert.equal(inLiveHours(Date.parse('2026-10-22T00:29:00Z')), false, '5:59 AM IST');
  assert.equal(inLiveHours(Date.parse('2026-10-22T00:30:00Z')), true, '6:00 AM IST');
  assert.equal(inLiveHours(Date.parse('2026-10-22T17:29:00Z')), true, '10:59 PM IST');
  assert.equal(inLiveHours(Date.parse('2026-10-22T17:30:00Z')), false, '11:00 PM IST');
});

test('SV-6 places: CUET marks, ties share a place, the floor past third, private marks get no place', () => {
  assert.equal(marksFor(4, 0), 20);
  assert.equal(marksFor(4, 1), 19);
  assert.equal(marksFor(3, 2), 13);
  const runs = [{ userId: 'riya', marks: 20 }, { userId: 'you', marks: 19 }, { userId: 'kabir', marks: 19 }, { userId: 'zoya', marks: 13 }];
  const placed = placeRuns(runs);
  assert.deepEqual(placed.map((r) => r.place), [1, 2, 2, 4]);
  const names = { riya: 'Riya', you: 'Aarav', kabir: 'Kabir', zoya: 'Zoya' };
  assert.deepEqual(tieFor(placed, 'you', (u) => names[u]), { place: 2, names: ['You', 'Kabir'], marks: 19 });
  assert.deepEqual(placeRuns([{ userId: 'a', marks: 5 }, { userId: 'b', marks: 5 }, { userId: 'c', marks: 5 }]).map((r) => r.place), [1, 1, 1], 'all tie: all first');
  assert.deepEqual(placeRuns([{ userId: 'a', marks: -2 }]).map((r) => r.place), [1], 'one run: first');
  const priv = placeRuns([{ userId: 'a', marks: 25, private: true }, { userId: 'b', marks: 10 }]);
  assert.deepEqual(priv.map((r) => r.place), [null, 1], 'a private run takes no place and pushes nobody down');
});

test('SV-9 moments: fixed kinds, each used once, never the trap question, never a skip fact', () => {
  const ans = (spec) => spec.map(([q, correct, ms]) => ({ q, correct, elapsedMs: ms, pick: correct === null ? -1 : 0 }));
  const runs = [
    { userId: 'riya', memberId: 'R', place: 1, finishedAt: '2026-10-22T08:40:00Z', right: 4, wrong: 0, answers: ans([[0, true, 20000], [1, true, 40000], [2, true, 60000], [3, null, 61000], [4, true, 90000]]) },
    { userId: 'you', memberId: 'Y', place: 2, finishedAt: '2026-10-22T09:00:00Z', right: 4, wrong: 1, answers: ans([[0, true, 30000], [1, true, 50000], [2, true, 70000], [3, false, 80000], [4, true, 100000]]) },
    { userId: 'kabir', memberId: 'K', place: 2, finishedAt: '2026-10-22T10:00:00Z', right: 4, wrong: 1, answers: ans([[0, true, 5000], [1, true, 30000], [2, true, 50000], [3, false, 60000], [4, true, 70000]]) },
    { userId: 'zoya', memberId: 'Z', place: 4, finishedAt: '2026-10-22T11:00:00Z', right: 3, wrong: 2, answers: ans([[0, true, 25000], [1, false, 50000], [2, true, 75000], [3, false, 90000], [4, true, 92000]]) },
  ];
  const moments = assignMoments(runs, { count: 5, trapQ: 3 });
  assert.equal(moments.length, 4);
  const kinds = moments.map((m) => m.kind).filter((k) => k !== 'finished_all');
  assert.equal(new Set(kinds).size, kinds.length, 'each kind once');
  for (const m of moments) {
    assert.notEqual(m.q, 3, 'never the trap question');
    if (m.kind === 'three_in_a_row') assert.ok(m.to < 4 || m.from > 4, 'a run of three never covers question 4');
    assert.doesNotMatch(JSON.stringify(m), /skip/);
  }
  assert.deepEqual(moments.find((m) => m.memberId === 'Z'), { memberId: 'Z', kind: 'fastest_right', q: 4, number: 5, seconds: 2 }, 'Zoya holds the fastest right answer, though fourth');
  assert.deepEqual(moments.find((m) => m.memberId === 'K'), { memberId: 'K', kind: 'quickest_finish', count: 5, seconds: 70 });
  assert.deepEqual(moments.find((m) => m.memberId === 'R'), { memberId: 'R', kind: 'three_in_a_row', from: 1, to: 3 });
  const wrongTrap = assignMoments([{ ...runs[2], answers: ans([[3, true, 1000], [0, true, 30000]]) }], { count: 5, trapQ: 3 });
  assert.notEqual(wrongTrap[0].q, 3);
});

test('the trap: 3 finished runs, a wrong option by 2 and by half; only "most", never a count', () => {
  const keys = [0, 1, 2, 3, 0];
  assert.equal(gameTrap([[0, 1, 2, 0, 0], [0, 1, 2, 0, 0]], keys), null, 'two runs');
  assert.deepEqual(gameTrap([[0, 1, 2, 0, 0], [0, 1, 2, 0, 0], [0, 1, 2, 0, 0], [0, 1, 2, -1, 0]], keys), { q: 3, number: 4, caught: 'most', optionIndex: 0 });
  assert.equal(gameTrap([[0, 1, 2, 0, 0], [0, 1, 2, 1, 0], [0, 1, 2, 2, 0], [0, 1, 2, -1, 0], [0, 1, 2, 3, 0]], keys), null, 'no option by 2 and half');
});

test('the Wednesday check: next Wednesday 12:00 AM IST at least 48 hours after close, until that Sunday 11:59 PM', () => {
  assert.deepEqual(checkWindow(Date.parse('2026-10-23T08:35:00Z')), { opensAt: '2026-10-27T18:30:00.000Z', closesAt: '2026-11-01T18:29:59.000Z' });
  // Closing on a Monday evening: Wednesday is only 30 hours away, so the next one.
  assert.equal(checkWindow(Date.parse('2026-10-26T12:30:00Z')).opensAt, '2026-11-03T18:30:00.000Z');
  // Closing Sunday 11:00 PM IST: Wednesday 12:00 AM is 49 hours later.
  assert.equal(checkWindow(Date.parse('2026-10-25T17:30:00Z')).opensAt, '2026-10-27T18:30:00.000Z');
});

test('R4 ghost pace: the nearest ghost at your index, ahead, behind and level', () => {
  const ghosts = [{ name: 'Kabir', arrivalsMs: [41000, 79000, 130000] }, { name: 'Riya', arrivalsMs: [20000, 50000, 70000] }];
  assert.deepEqual(ghostPace(75000, 1, ghosts), { name: 'Kabir', delta: 4, text: '4 s ahead of Kabir' });
  assert.deepEqual(ghostPace(83000, 1, ghosts), { name: 'Kabir', delta: -4, text: '4 s behind Kabir' });
  assert.equal(ghostPace(79400, 1, ghosts).text, 'Level with Kabir');
  assert.equal(ghostPace(1000, 9, ghosts), null);
});

test('a public question never carries the key or the explanation', () => {
  const out = publicQuestion(BANK[0], 0);
  assert.deepEqual(Object.keys(out).sort(), ['options', 'passage', 'q', 'stem']);
  assert.deepEqual(out.options, ['Option A0', 'Option B0', 'Option C0', 'Option D0']);
});

test('quest maths: 15 a member not stepped out, at least 15; labels by game, never by person', () => {
  assert.equal(questTarget(4), 60);
  assert.equal(questTarget(4, 1), 45);
  assert.equal(questTarget(1), 15);
  assert.equal(questTarget(2, 2), 15);
  const labels = questLabels([{ source: 'paper', source_id: WEEK, answered: 37 }, { source: 'game', source_id: 'g1', answered: 14 }, { source: 'game', source_id: 'g2', answered: 0 }],
    { games: new Map([['g1', { hostName: 'Riya', format: 'sprint', hostIsYou: false }]]) });
  assert.deepEqual(labels, [{ label: "This week's Mob paper", answered: 37 }, { label: "Riya's sprint", answered: 14 }]);
  assert.doesNotMatch(JSON.stringify(labels), /of you|\d+ of \d+/);
});

test('SV-13 the Mob chain: a stitch on done, a week pass at 4 (hold 1), a miss restarts with the best kept', () => {
  const w = (d, done = true) => ({ week_start: d, done_at: done ? `${d}T10:00:00Z` : null });
  assert.deepEqual(computeMobChain({ weeks: [], currentWeek: WEEK }).weeks, 0);
  const three = computeMobChain({ weeks: [w('2026-09-28'), w('2026-10-05'), w('2026-10-12')], currentWeek: WEEK });
  assert.equal(three.weeks, 3);
  assert.equal(three.stitchedThisWeek, false, 'the current week is open, never missed');
  assert.deepEqual(three.next, { at: 4, item: 'stamp' });
  const four = computeMobChain({ weeks: [w('2026-09-21'), w('2026-09-28'), w('2026-10-05'), w('2026-10-12')], currentWeek: '2026-10-26' });
  assert.equal(four.passes, 0, 'the pass earned at week 4 kept the missed week of 19 Oct');
  assert.equal(four.weeks, 4);
  assert.equal(four.history.find((h) => h.week === WEEK).state, 'pass');
  const restart = computeMobChain({ weeks: [w('2026-09-28'), w('2026-10-05')], currentWeek: '2026-10-26' });
  assert.equal(restart.weeks, 0);
  assert.equal(restart.best, 2, 'the best is kept');
  assert.equal(restart.restarted, true);
  const eight = computeMobChain({ weeks: Array.from({ length: 8 }, (_, i) => w(new Date(Date.parse('2026-08-31T00:00:00Z') + i * 7 * 86_400_000).toISOString().slice(0, 10))), currentWeek: '2026-10-26' });
  assert.equal(eight.passes, 1, 'at most 1 held');
  assert.equal(computeMobChain({ weeks: [], currentWeek: WEEK, storedBest: 6 }).best, 6, 'the stored best never drops');
});

// ---------------------------------------------------------------------------------------------------------------
// The migrations
// ---------------------------------------------------------------------------------------------------------------

const schemaDump = async (db) => ({
  tables: (await db.query("select table_name t from information_schema.tables where table_schema='public' order by 1")).rows.map((r) => r.t),
  columns: (await db.query("select table_name||'.'||column_name c from information_schema.columns where table_schema='public' order by 1")).rows.map((r) => r.c),
  functions: (await db.query("select p.oid::regprocedure::text||':'||md5(replace(p.prosrc, chr(13), '')) f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1")).rows.map((r) => r.f),
  constraints: (await db.query("select conrelid::regclass::text||'.'||conname c from pg_constraint where connamespace='public'::regnamespace order by 1")).rows.map((r) => r.c),
  triggers: (await db.query('select tgname t from pg_trigger where not tgisinternal order by 1')).rows.map((r) => r.t),
  policies: (await db.query('select schemaname||policyname p from pg_policies order by 1')).rows.map((r) => r.p),
});

test('SV-1 the four migrations apply twice, undo in reverse twice, and the schema returns to the pre-v3 state', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec("create table public.users (id text primary key); insert into public.users values ('u1'),('u2');");
    await db.exec(STUBS);
    await db.exec(BASE);
    const before = await schemaDump(db);
    await db.exec(v3Sql);
    await db.exec(v3Sql);
    const during = await schemaDump(db);
    for (const t of ['mob_profiles', 'fold_unlocks', 'mob_reactions', 'mob_seen', 'mob_step_outs', 'mob_games', 'mob_game_runs', 'mob_game_answers',
      'mob_start_claims', 'mob_mics', 'mob_quest_ticks', 'mob_weeks', 'mob_traps', 'mob_fix_checks', 'chain_prefs', 'chain_pauses', 'mob_chain_best', 'mob_room_tickets']) {
      assert.ok(during.tables.includes(t), t);
    }
    assert.ok(during.policies.includes('realtimemob_room_receive') && during.policies.includes('realtimemob_room_presence'));
    await db.exec(v3Undo);
    await db.exec(v3Undo);
    const after = await schemaDump(db);
    assert.deepEqual(after.tables, before.tables);
    assert.deepEqual(after.columns, before.columns);
    assert.deepEqual(after.functions, before.functions, 'every replaced function is back byte for byte');
    assert.deepEqual(after.triggers, before.triggers);
    assert.deepEqual(after.policies, before.policies);
    assert.deepEqual(after.constraints.filter((c) => !c.endsWith('mob_invites_code_check')), before.constraints.filter((c) => !c.endsWith('mob_invites_code_check')));
    assert.ok(after.constraints.includes('mob_invites.mob_invites_code_check'), 'the 8-character check is back');
    await db.exec(v3Sql); // and forward again
  } finally { await db.close(); }
});

test('SV-1 the 8-character check is found by its definition (staging names it mob_invites_code_check1) and comes back under that name', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec("create table public.users (id text primary key);");
    await db.exec(STUBS);
    await db.exec(BASE);
    await db.exec('alter table public.mob_invites rename constraint mob_invites_code_check to mob_invites_code_check1');
    await db.exec(v3Sql);
    const checks = async () => (await db.query("select conname c from pg_constraint where conrelid='public.mob_invites'::regclass and contype='c' order by 1")).rows.map((r) => r.c);
    assert.ok(!(await checks()).includes('mob_invites_code_check1'), 'dropped, so 6-character codes fit');
    assert.ok((await checks()).includes('mob_invites_code_len'));
    await db.exec(v3Undo);
    await db.exec(v3Undo);
    assert.ok((await checks()).includes('mob_invites_code_check1'), 'back under its own name');
    assert.ok(!(await checks()).includes('mob_invites_code_check'));
    assert.equal((await db.query("select count(*)::int n from mob_data_moves where key like 'v3_%'")).rows[0].n, 0);
  } finally { await db.close(); }
});

test('SV-1 old 8-character codes still look up, join and expire; 6-character codes work beside them', async () => {
  const db = await database();
  try {
    const old = serviceFor(db, { v3: false });
    const mob = (await old.create('u1', { subject: 'accountancy', name: 'Riya', colour: 0 })).mob.id;
    const inv8 = await old.invite('u1', { mob });
    assert.match(inv8.code, /^[0-9A-HJKMNP-TV-Z]{8}$/, 'with v3 off, invites stay 8 characters');
    assert.equal(inv8.display, undefined, 'and the old shape is unchanged');
    const svc = serviceFor(db);
    assert.equal((await svc.lookup(inv8.code)).valid, true);
    await svc.join('u2', { code: inv8.code.toLowerCase(), name: 'Aarav', colour: 1 });
    const inv6 = await svc.invite('u1', { mob });
    assert.match(inv6.code, /^[0-9A-HJKMNP-TV-Z]{6}$/);
    assert.equal(inv6.display, `${inv6.code.slice(0, 3)} ${inv6.code.slice(3)}`);
    const look = await svc.lookup(`${inv6.code.slice(0, 3)}-${inv6.code.slice(3)}`);
    assert.equal(look.status, 'valid');
    assert.equal(look.name, 'Accountancy', 'no name key: the subject');
    assert.doesNotMatch(JSON.stringify(look), /Riya|Aarav/, 'the public preview names no member');
    await svc.join('u3', { code: inv6.code, name: 'Kabir', colour: 2 });
    await db.exec("insert into mob_invites (code, mob_id, expires_at, max_uses) select 'ABCDEFGH', id, now() - interval '1 minute', 3 from mobs limit 1");
    await assert.rejects(svc.join('u4', { code: 'ABCDEFGH', name: 'Zoya', colour: 1 }), code('INVITE_EXPIRED'));
  } finally { await db.close(); }
});

test('RLS: anon and authenticated are denied every new table and function (mob_room_ok is the one exception)', async () => {
  const db = await database();
  try {
    const tables = ['mob_profiles', 'fold_unlocks', 'mob_reactions', 'mob_seen', 'mob_step_outs', 'mob_games', 'mob_game_runs', 'mob_game_answers', 'mob_start_claims',
      'mob_mics', 'mob_quest_ticks', 'mob_weeks', 'mob_traps', 'mob_fix_checks', 'chain_prefs', 'chain_pauses', 'mob_chain_best', 'mob_room_tickets'];
    const fns = (await db.query("select p.oid::regprocedure::text sig, p.prosecdef d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'mob\\_%' or p.proname like 'chain\\_%')")).rows;
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const t of tables) await assert.rejects(db.query(`select * from public.${t}`), /permission denied/, `${role} ${t}`);
      await assert.rejects(db.query("select public.mob_game_json(gen_random_uuid(), 'u1', now())"), /permission denied/, `${role} game json`);
      await assert.rejects(db.query("select public.mob_game_picks_closed(gen_random_uuid(), now())"), /permission denied/, `${role} picks`);
      await assert.rejects(db.query("select public.chain_daily('u1', current_date)"), /permission denied/, `${role} chain`);
      await db.exec('reset role');
    }
    for (const { sig, d } of fns) {
      const acl = (await db.query('select proacl::text a from pg_proc where oid = $1::regprocedure', [sig])).rows[0].a || '';
      if (sig === 'mob_room_ok(text)') {
        assert.equal(d, true, 'the realtime check is the only security definer');
        assert.match(acl, /authenticated=X/);
        assert.doesNotMatch(acl, /(^|[{,])anon=X|(^|[{,])=X/);
        continue;
      }
      if (/^mob_room_revoke_on_/.test(sig)) { assert.equal(d, false, sig); assert.doesNotMatch(acl, /authenticated=X|anon=X|(^|[{,])=X/, sig); continue; }
      assert.equal(d, false, `${sig} is security invoker`);
      assert.doesNotMatch(acl, /(^|[{,])(anon|authenticated)=|(^|[{,])=X/, sig);
      assert.match(acl, /service_role=X/, sig);
    }
    for (const t of tables) assert.equal((await db.query('select relrowsecurity r from pg_class where relname=$1', [t])).rows[0].r, true, `${t} has RLS on`);
    assert.equal((await db.query("select count(*)::int n from pg_policies where schemaname='public' and tablename = any($1)", [tables])).rows[0].n, 0, 'no policy on any public mob table');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// The service on PGlite
// ---------------------------------------------------------------------------------------------------------------

// Plays one run: picks per question index ('r' right, 'w' wrong, 's' skip), seconds between answers.
async function play(svc, clock, user, gameId, plan, gap = 20) {
  const run = await svc.v3.startRun(user, gameId);
  const ids = run.questions.map((q) => BANK.find((b) => b.question === q.stem).id);
  const out = [];
  for (let q = 0; q < plan.length; q += 1) {
    clock.now += gap * 1000;
    const pick = plan[q] === 'r' ? keyOf(ids[q]) : plan[q] === 'w' ? wrongOf(ids[q]) : -1;
    out.push(await svc.v3.answer(user, gameId, { q, pick }));
  }
  return { run, ids, out };
}

test('SV-5, SV-6, SV-7, SV-8, SV-9: the Chai Circle game, server-graded, no leak before close, a podium with ties', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    const opened = await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'async' });
    const g = opened.game;
    assert.equal(g.count, 5);
    assert.equal(g.title, 'Your sprint');
    assert.equal(g.closesAt, new Date(NOW + 24 * HOUR).toISOString());
    assert.equal((await one(db, 'select started_via r from mob_games')), 'open', 'billing off: via open');

    // Riya 20 (4 right, skips q4), Aarav 19, Kabir 19, Zoya 13. The trap: question 4 (index 3), one wrong option, 3 of 4.
    const riya = await play(svc, clock, 'u1', g.id, ['r', 'r', 'r', 's', 'r']);
    assert.deepEqual(riya.out.map((a) => a.delta), [5, 5, 5, 0, 5]);
    assert.equal(riya.out[3].correct, null);
    assert.equal(riya.out.at(-1).marks, 20);
    assert.equal(riya.out.at(-1).finished, true);
    const aarav = await play(svc, clock, 'u2', g.id, ['r', 'r', 'r', 'w', 'r'], 15);
    assert.equal(aarav.out[3].delta, -1);
    assert.equal(aarav.out.at(-1).marks, 19);
    const kabir = await play(svc, clock, 'u3', g.id, ['r', 'r', 'r', 'w', 'r'], 10);
    const zoya = await play(svc, clock, 'u4', g.id, ['r', 'w', 'r', 'w', 'r'], 25);
    assert.equal(zoya.out.at(-1).marks, 13);

    // SV-5 a retry of the same question returns the stored result and changes nothing.
    const retry = await svc.v3.answer('u2', g.id, { q: 3, pick: keyOf(aarav.ids[3]) });
    assert.equal(retry.correct, false);
    assert.equal(retry.marks, 19);
    assert.equal(await one(db, "select marks r from mob_game_runs where user_id='u2'"), 19);
    // elapsed_ms is from server time only: Aarav answered every 15 s.
    assert.deepEqual(aarav.out.map((a) => a.elapsedMs), [15000, 30000, 45000, 60000, 75000]);

    // SV-7 before close: nothing carries a key, an explanation or another member's pick.
    const scan = (label, body) => {
      const s = JSON.stringify(body);
      assert.doesNotMatch(s, /correctIndex|explanation|EXPLAIN-/, label);
      return s;
    };
    const gv = await svc.v3.getGame('u2', g.id);
    assert.doesNotMatch(scan('game', gv), /"pick"/, 'the game view has no picks at all');
    assert.equal(gv.game.closed, false);
    for (const a of aarav.out) scan('answer', a);
    const podium = await svc.v3.podium('u2', g.id);
    assert.doesNotMatch(scan('podium', podium), /"pick"/);
    await assert.rejects(svc.v3.review('u2', g.id), (e) => e.code === 'REVIEW_NOT_YET' && e.extra.detail.opensAt === g.closesAt);
    const json = await one(db, "select mob_game_json($1::uuid,'u2',now()) r", [g.id]);
    assert.deepEqual(Object.keys(json.runs[0]).sort(), ['answered', 'arrivals', 'ended_at', 'finished_at', 'live', 'marks', 'right_n', 'skipped_n', 'started_at', 'user_id', 'wrong_n'].map((k) => (k === 'ended_at' ? 'ends_at' : k)).sort(), 'runs carry no picks');
    assert.ok(json.mine.every((m) => Number.isInteger(m.pick)), 'mine has your own picks');
    assert.equal(await one(db, "select mob_game_picks_closed($1::uuid, now()) r", [g.id]), null, 'every pick only after close');
    await assert.rejects(svc.v3.fixStart('u2', { game: g.id, q: 3, stage: 'now' }), code('FIX_NOT_YET'));

    // SV-6 the podium so far: 20, 19, 19, 13 gives 1, 2, 2, 4 (floor).
    assert.equal(podium.soFar, true);
    assert.deepEqual(podium.places.map((p) => [p.name, p.marks, p.place, Boolean(p.floor)]), [['Riya', 20, 1, false], ['Aarav', 19, 2, false], ['Kabir', 19, 2, false], ['Zoya', 13, 4, true]]);
    assert.deepEqual(podium.tie, { place: 2, names: ['You', 'Kabir'], marks: 19 });
    assert.deepEqual(podium.headline, { kind: 'together', right: 15, of: 20 });
    assert.equal(podium.trap, null, 'no trap before close');
    assert.equal(podium.moments.length, 4);

    // SV-8 ghosts are the finished runs of others, arrivals equal the stored elapsed_ms, no picks.
    const ghosts = (await svc.v3.getGame('u2', g.id)).game.ghosts;
    assert.deepEqual(ghosts.map((x) => x.name), ['Riya', 'Kabir', 'Zoya']);
    assert.deepEqual(ghosts[1].arrivalsMs, [10000, 20000, 30000, 40000, 50000]);
    assert.equal(ghosts[1].finishedMs, 50000);

    // F2: the den lists finished runs only, with times, and nothing about who has not played.
    const den = await svc.view('u2', { mobId });
    const denGame = den.mob.v3.games[0];
    assert.equal(denGame.runs.length, 4);
    assert.doesNotMatch(JSON.stringify(den.mob.v3), /not_played|notPlayed|"played"/);

    // After close: the trap ("most"), the review with your own picks only, the moments never on the trap question.
    clock.now = NOW + 24 * HOUR + MIN;
    const closedPodium = await svc.v3.podium('u2', g.id);
    assert.equal(closedPodium.soFar, false);
    assert.deepEqual(closedPodium.trap, { q: 3, number: 4, caught: 'most' });
    for (const m of closedPodium.moments) assert.notEqual(m.q, 3);
    const review = await svc.v3.review('u2', g.id);
    assert.equal(review.questions.length, 5);
    assert.deepEqual(review.questions.map((q) => q.correctIndex), aarav.ids.map(keyOf));
    assert.equal(review.questions[3].yourPick, wrongOf(aarav.ids[3]));
    assert.equal(review.questions[0].explanation, `EXPLAIN-${aarav.ids[0]}`);
    assert.deepEqual(review.trap.fix.check, { opensAt: '2026-10-27T18:30:00.000Z', closesAt: '2026-11-01T18:29:59.000Z', state: 'not_yet' });
    assert.doesNotMatch(JSON.stringify(review), /Riya|Kabir|Zoya/, 'no other member in the review');
    assert.equal(await one(db, 'select count(*)::int r from mob_traps'), 1, 'settled once');
    await svc.v3.podium('u3', g.id);
    assert.equal(await one(db, 'select count(*)::int r from mob_traps'), 1);

    // SV-5 expiry: a run past ends_at is refused with RUN_EXPIRED and the rest skipped.
    const g2 = (await svc.v3.openGame('u2', { mob: mobId, format: 'round', count: 10, mode: 'async' })).game;
    await svc.v3.startRun('u2', g2.id);
    clock.now += 10 * 60_000 + 61_000;
    await assert.rejects(svc.v3.answer('u2', g2.id, { q: 0, pick: 0 }), (e) => e.code === 'RUN_EXPIRED' && e.extra.detail.run.finished === true);
    assert.equal(await one(db, "select skipped_n::int r from mob_game_runs where game_id=$1::uuid and user_id='u2'", [g2.id]), 10);
    await assert.rejects(svc.v3.startRun('u2', g2.id), code('RUN_DONE'));
    await assert.rejects(svc.v3.answer('u2', g2.id, { q: 11, pick: 0 }), code('Q_INVALID'));
    await assert.rejects(svc.v3.answer('u3', g2.id, { q: 0, pick: 0 }), code('NO_RUN'));
  } finally { await db.close(); }
});

test('rematch, open limit, Finish now, private marks and the podium switch', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'async' })).game;
    const first = await play(svc, clock, 'u1', g.id, ['r', 'r', 'w', 'r', 'r']);
    const re = (await svc.v3.openGame('u1', { mob: mobId, format: 'rematch', rematchOf: g.id })).game;
    assert.equal(re.format, 'rematch');
    assert.equal(re.count, 5);
    assert.deepEqual(re.ghosts.map((x) => x.name), ['Riya'], 'your own earlier run races you on a rematch');
    const reIds = await one(db, 'select question_ids r from mob_games where id=$1::uuid', [re.id]);
    assert.notDeepEqual(reIds, first.ids, 'new questions');
    await svc.v3.openGame('u2', { mob: mobId, format: 'sprint' });
    await assert.rejects(svc.v3.openGame('u3', { mob: mobId, format: 'sprint' }), code('GAMES_OPEN_LIMIT'));
    await assert.rejects(svc.v3.openGame('u3', { mob: mobId, format: 'round', count: 7 }), code('LENGTH_INVALID'));
    await assert.rejects(svc.v3.openGame('u3', { mob: mobId, format: 'round', count: 10, chapter: 'Not a chapter' }), code('CHAPTER_INVALID'));
    // Finish now: the rest is skipped.
    await svc.v3.startRun('u2', g.id);
    clock.now += 30_000;
    await svc.v3.answer('u2', g.id, { q: 0, pick: keyOf(BANK[0].id) === 0 ? 0 : 0 });
    const fin = await svc.v3.finish('u2', g.id);
    assert.equal(fin.run.finished, true);
    assert.equal(await one(db, "select skipped_n::int r from mob_game_runs where game_id=$1::uuid and user_id='u2'", [g.id]), 4);
    // Private marks: Kabir keeps his marks private, so he has no place and nobody sees his marks.
    await svc.patchMe('u3', { mob: mobId, showScore: false });
    await play(svc, clock, 'u3', g.id, ['r', 'r', 'r', 'r', 'r']);
    const p = await svc.v3.podium('u1', g.id);
    const kabir = p.places.find((x) => x.name === 'Kabir');
    assert.equal(kabir.marks, null);
    assert.equal(kabir.private, true);
    assert.equal(kabir.place, undefined);
    assert.equal(p.places.find((x) => x.name === 'Riya').place, 1, 'a private 25 pushes nobody down');
    assert.equal((await svc.v3.podium('u3', g.id)).places.find((x) => x.you).marks, 25, 'your own marks are always yours');
    // The podium switch (owner only): no places, no tie.
    await assert.rejects(svc.v3.settings('u2', { mob: mobId, showPodium: false }), code('NOT_OWNER_SETTINGS'));
    await assert.rejects(svc.v3.settings('u1', { mob: mobId, nameKey: 30 }), code('NAME_KEY_INVALID'));
    const viewed = await svc.v3.settings('u1', { mob: mobId, showPodium: false, nameKey: 4 });
    assert.equal(viewed.mob.v3.showPodium, false);
    assert.deepEqual(viewed.mob.v3.name, { key: 4, text: 'Ledger Club' });
    const off = await svc.v3.podium('u1', g.id);
    assert.equal(off.showPodium, false);
    assert.ok(off.places.every((x) => x.place === undefined && x.floor === undefined));
    assert.equal(off.tie, null);
  } finally { await db.close(); }
});

test('SV-3 and SV-4 Free and Pro starts on the server: billing flag, the weekly start, races, rejoin, Pass the mic', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const pros = new Set(['u1']);
    // Billing off: a Free member opens a live game (via open) when live is on.
    const open = serviceFor(db, { clock, live: true, premium: (u) => pros.has(u) });
    const mobId = await chaiCircle(db, open);
    const liveGame = (await open.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    assert.equal(liveGame.room.state, 'lobby');
    assert.equal(await one(db, 'select started_via r from mob_games where id=$1::uuid', [liveGame.id]), 'open');
    await db.exec('delete from mob_games');
    // Billing on: the same call is START_FORMAT; an async sprint is the free weekly start; a second is START_USED.
    const on = serviceFor(db, { clock, live: true, billing: true, premium: (u) => pros.has(u) });
    await assert.rejects(on.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'live' }), code('START_FORMAT'));
    await on.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'async' });
    assert.equal(await one(db, "select started_via r from mob_games where created_by='u2'"), 'free_weekly');
    await assert.rejects(on.v3.openGame('u2', { mob: mobId, format: 'round', count: 10 }), code('START_USED'));
    await assert.rejects(on.v3.openGame('u2', { mob: mobId, format: 'sprint', mode: 'live' }), code('START_PRO'));
    const used = (await on.view('u2', { mobId })).mob.v3.starts;
    assert.deepEqual(used, { billingOn: true, can: false, reason: 'used', modes: [], formats: [], locked: [], freeLeft: 0, mics: 0 });
    // Two taps on one free start: one game (the claim is taken under the Mob lock).
    const both = await Promise.allSettled([on.v3.openGame('u3', { mob: mobId, format: 'sprint' }), on.v3.openGame('u3', { mob: mobId, format: 'sprint' })]);
    assert.deepEqual(both.map((x) => x.status).sort(), ['fulfilled', 'rejected']);
    assert.equal(both.find((x) => x.status === 'rejected').reason.code, 'START_USED');
    // Leaving and rejoining cannot refresh a free start.
    await db.exec('delete from mob_games');
    await on.leave('u3', { mob: mobId });
    const inv = await on.invite('u1', { mob: mobId });
    await on.join('u3', { code: inv.code, name: 'Kabir', colour: 2 });
    await assert.rejects(on.v3.openGame('u3', { mob: mobId, format: 'sprint' }), code('START_USED'));
    // Pro starts anything; Pass the mic: Pro gives, 2 a week, a mic is used once.
    const memberIdOf = (u) => memberIdFor('test-secret', mobId, u);
    await on.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' });
    assert.equal(await one(db, "select started_via r from mob_games where created_by='u1'"), 'pro');
    await db.exec('delete from mob_games');
    await assert.rejects(on.v3.mic('u2', { mob: mobId, to: memberIdOf('u3') }), code('START_PRO'), 'a Free giver');
    await assert.rejects(on.v3.mic('u1', { mob: mobId, to: memberIdOf('u1') }), code('MIC_SELF'));
    await assert.rejects(on.v3.mic('u1', { mob: mobId, to: 'ZZZZZZZZZZZZ' }), code('NOT_FOUND'));
    assert.deepEqual(await on.v3.mic('u1', { mob: mobId, to: memberIdOf('u3') }), { micsToGive: 1 });
    const withMic = (await on.view('u3', { mobId })).mob.v3.starts;
    assert.equal(withMic.via, 'mic');
    assert.deepEqual(withMic.micFrom, { memberId: memberIdOf('u1'), name: 'Riya' });
    assert.doesNotMatch(JSON.stringify(withMic), /pro|Pro|premium/, 'nobody is labelled with a plan');
    const both2 = await Promise.allSettled([on.v3.openGame('u3', { mob: mobId, format: 'sprint', mode: 'live' }), on.v3.openGame('u3', { mob: mobId, format: 'sprint' })]);
    assert.equal(both2.filter((x) => x.status === 'fulfilled').length, 1, 'a mic is used once');
    assert.deepEqual(await on.v3.mic('u1', { mob: mobId, to: memberIdOf('u4') }), { micsToGive: 0 });
    await assert.rejects(on.v3.mic('u1', { mob: mobId, to: memberIdOf('u2') }), code('MIC_LIMIT'));
    // Billing off: there is no mic to pass.
    await assert.rejects(open.v3.mic('u1', { mob: mobId, to: memberIdOf('u2') }), code('BILLING_OFF'));
    // Live outside 6 AM to 11 PM IST, and live off.
    const night = serviceFor(db, { clock: { now: Date.parse('2026-10-22T18:00:00Z') }, live: true });
    await assert.rejects(night.v3.openGame('u4', { mob: mobId, format: 'sprint', mode: 'live' }), code('LIVE_HOURS'));
    const liveOff = serviceFor(db, { clock });
    await assert.rejects(liveOff.v3.openGame('u4', { mob: mobId, format: 'sprint', mode: 'live' }), code('LIVE_OFF'));
    assert.deepEqual((await liveOff.view('u4', { mobId })).mob.v3.live, { enabled: false, hoursOk: true });
  } finally { await db.close(); }
});

test('SV-10, SV-11 the weekly quest: ticks with no user id, true past the goal, leave never lowers it, step-out, done once', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    let v = (await svc.view('u1', { mobId })).mob.v3.quest;
    assert.deepEqual([v.target, v.answered, v.done, v.sizedFor], [60, 0, false, 4]);
    assert.deepEqual(v.parcel, { kind: 'fold', fold: 'hop' });
    assert.deepEqual(Object.keys((await db.query('select * from mob_quest_ticks limit 0')).fields.reduce((o, f) => ({ ...o, [f.name]: 1 }), {})).sort(),
      ['answered', 'mob_id', 'source', 'source_id', 'source_key', 'week_start'], 'no user id column');
    // The weekly paper ticks too (answered = picks that are not blank).
    await db.query("select mob_paper_put($1::uuid, $2::date, 'accountancy', $3::jsonb)", [mobId, WEEK, JSON.stringify(BANK.slice(0, 10).map((q) => q.id))]);
    await db.query("select mob_record_sitting('u1',$1::uuid,$2::date,'s1',7,10,'{0,1,2,3,0,1,2,-1,-1,0}'::smallint[],$3::timestamptz)", [mobId, WEEK, new Date(clock.now).toISOString()]);
    v = (await svc.view('u1', { mobId })).mob.v3.quest;
    assert.equal(v.answered, 8);
    assert.deepEqual(v.bySource, [{ label: "This week's Mob paper", answered: 8 }]);
    // Three sprints by three members: 4 + 5 * 5 answered... fill to 70 with game answers.
    for (const [u, n] of [['u2', 5], ['u3', 5], ['u4', 5]]) {
      // 10-question rounds: three open at once never share a question (nor the held weekly paper's), so 30 of the 40.
      const g = (await svc.v3.openGame(u, { mob: mobId, format: 'round', count: 10 })).game;
      for (const p of ['u1', 'u2', 'u3', 'u4']) {
        await svc.v3.startRun(p, g.id);
        for (let q = 0; q < n; q += 1) { clock.now += 5000; await svc.v3.answer(p, g.id, { q, pick: 0 }); }
      }
    }
    v = (await svc.view('u1', { mobId })).mob.v3.quest;
    assert.equal(v.answered, 68);
    assert.equal(v.done, true);
    const doneAt = v.doneAt;
    assert.ok(doneAt);
    assert.deepEqual(v.bySource.map((x) => x.label).sort(), ["Aarav's round", "Kabir's round", "This week's Mob paper", "Zoya's round"], 'labels by game (its host), never who played');
    assert.doesNotMatch(JSON.stringify(v.bySource), /of you|\d+ of \d+/);
    await db.exec("update mob_games set closes_at = now() - interval '1 minute'"); // three are open: close them first
    const g4 = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
    await svc.v3.startRun('u1', g4.id);
    clock.now += 5000;
    await svc.v3.answer('u1', g4.id, { q: 0, pick: 1 });
    clock.now += 5000;
    await svc.v3.answer('u1', g4.id, { q: 1, pick: -1 });
    v = (await svc.view('u1', { mobId })).mob.v3.quest;
    assert.equal(v.answered, 69, 'a skip does not count');
    await svc.v3.answer('u1', g4.id, { q: 2, pick: 1 });
    v = (await svc.view('u1', { mobId })).mob.v3.quest;
    assert.deepEqual([v.answered, v.target, v.done], [70, 60, true], 'SV-11: 70 of 60, the true total');
    assert.equal(v.doneAt, doneAt, 'done_at is set once');
    // Leaving never lowers answered.
    await svc.leave('u4', { mob: mobId });
    v = (await svc.view('u1', { mobId })).mob.v3.quest;
    assert.equal(v.answered, 70);
    await assert.rejects(svc.v3.stepOut('u2', { mob: mobId, on: true }), code('STEP_OUT_DONE'));
    // A fresh Mob: step out shrinks the target without naming anyone.
    const other = (await svc.create('u5', { subject: 'economics', name: 'Meera', colour: 0 })).mob.id;
    const inv = await svc.invite('u5', { mob: other });
    await svc.join('u6', { code: inv.code, name: 'Isha', colour: 1 });
    await svc.join('u7', { code: inv.code, name: 'Tara', colour: 2 });
    const stepped = await svc.v3.stepOut('u6', { mob: other, on: true });
    assert.equal(stepped.mob.v3.quest.target, 30);
    assert.equal(stepped.mob.v3.quest.youSteppedOut, true);
    const seenByOther = (await svc.view('u5', { mobId: other })).mob.v3.quest;
    assert.equal(seenByOther.youSteppedOut, false);
    assert.doesNotMatch(JSON.stringify((await svc.view('u5', { mobId: other })).mob), /Isha[^"]*stepped|steppedOut":\[/);
    assert.equal((await svc.v3.stepOut('u6', { mob: other, on: false })).mob.v3.quest.target, 45);
  } finally { await db.close(); }
});

test('SV-17 unlocks: Hop from the first quest (members then, and a later joiner on a later quest), shelf counts, seat Folds', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    let shelf = await svc.v3.shelf('u2');
    assert.equal(shelf.folds.filter((f) => f.owned).length, 4, 'four starters');
    assert.deepEqual(shelf.folds.find((f) => f.key === 'crane'), { key: 'crane', owned: false, folds: 3, rule: 'mob_traps', have: 0, need: 3, finishes: { foil: { owned: false, rule: 'chain_30', have: 0, need: 30 } }, mob: 'Chai Circle' });
    assert.deepEqual(shelf.seat, null);
    await assert.rejects(svc.v3.profile('u2', { fold: 'hop' }), code('FOLD_LOCKED'));
    await assert.rejects(svc.v3.profile('u2', { fold: 'owl' }), code('FOLD_INVALID'));
    assert.deepEqual(await svc.v3.profile('u2', { fold: 'kandil' }), { fold: 'kandil', finish: 'plain' });
    // The quest: 60 answers.
    await db.query("insert into mob_quest_ticks values ($1::uuid, $2::date, 'paper', $2, 'k1', 60)", [mobId, WEEK]);
    const den = (await svc.view('u2', { mobId })).mob.v3;
    assert.equal(den.quest.done, true);
    assert.deepEqual(den.moments, [`quest_done:${mobId}:${WEEK}`, `stitch:${mobId}:${WEEK}`, 'reveal:hop']);
    assert.equal(await one(db, "select count(*)::int r from fold_unlocks where fold='hop'"), 1, 'granted to the viewer');
    await svc.view('u2', { mobId });
    assert.equal(await one(db, "select count(*)::int r from fold_unlocks where fold='hop' and user_id='u2'"), 1, 'exactly once');
    await svc.v3.seen('u2', { keys: den.moments });
    assert.deepEqual((await svc.view('u2', { mobId })).mob.v3.moments, []);
    assert.deepEqual(await svc.v3.profile('u2', { fold: 'hop' }), { fold: 'hop', finish: 'plain' });
    shelf = await svc.v3.shelf('u1');
    assert.equal(shelf.folds.find((f) => f.key === 'hop').owned, true, 'every member at that moment');
    // A member who joins later does not get Hop for a quest done before they joined.
    const inv = await svc.invite('u1', { mob: mobId });
    clock.now += HOUR;
    // The database stamps joined_at with its own clock: put the first quest before it.
    await db.exec("update mob_weeks set done_at = now() - interval '1 hour'");
    await svc.join('u5', { code: inv.code, name: 'Meera', colour: 4, fold: 'hexa' });
    assert.equal((await svc.v3.shelf('u5')).folds.find((f) => f.key === 'hop').owned, false);
    assert.equal((await svc.v3.shelf('u5')).seat.fold, 'hexa', 'joined as Hexa');
    // ... and does on the next quest done while a member.
    await db.query("insert into mob_quest_ticks values ($1::uuid, '2026-10-26', 'paper', '2026-10-26', 'k2', 75)", [mobId]);
    clock.now = Date.parse('2026-10-27T08:00:00Z');
    await svc.view('u5', { mobId });
    assert.equal((await svc.v3.shelf('u5')).folds.find((f) => f.key === 'hop').owned, true);
    // Folds are kept after leaving.
    await svc.leave('u2', { mob: mobId });
    assert.equal(await one(db, "select count(*)::int r from fold_unlocks where user_id='u2' and fold='hop'"), 1);
    // Tally: 3 games with no minus marks. Naav: a first full mock. Patang: beat your best. Cutting: back after 3 days.
    for (let i = 0; i < 3; i += 1) {
      const g = (await svc.v3.openGame('u3', { mob: mobId, format: 'sprint' })).game;
      await play(svc, clock, 'u3', g.id, ['r', 's', 'r', 's', 'r'], 5);
      await db.exec('update mob_games set closes_at = now() - interval \'1 minute\'');
    }
    await db.query("insert into attempts (id, user_id, subject, score, total, unattempted, completed_at, selection_meta) values ('a1','u3','accountancy',100,50,0,'2026-10-01T08:00:00Z','{\"mode\":\"full\"}'), ('a2','u3','accountancy',150,50,0,'2026-10-20T08:00:00Z','{\"mode\":\"nta\"}')");
    const s3 = await svc.v3.shelf('u3');
    for (const k of ['tally', 'naav', 'patang', 'cutting']) assert.equal(s3.folds.find((f) => f.key === k).owned, true, k);
    assert.equal(s3.folds.find((f) => f.key === 'sticky').have, 0);
    assert.equal(await one(db, "select count(*)::int r from fold_unlocks where user_id='u3' and fold='tally'"), 1);
    // The create path: a Fold you do not own is FOLD_LOCKED; the name key is checked.
    await assert.rejects(svc.create('u8', { subject: 'accountancy', name: 'Dev', colour: 0, fold: 'crane' }), code('FOLD_LOCKED'));
    await assert.rejects(svc.create('u8', { subject: 'accountancy', name: 'Dev', colour: 0, nameKey: 99 }), code('NAME_KEY_INVALID'));
  } finally { await db.close(); }
});

test('Fix it together: after close only, the Wednesday check, fixed when 2 pass, Crane at 3, quest ticks', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    const fixTrap = async () => {
      const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
      for (const u of ['u1', 'u2', 'u3']) await play(svc, clock, u, g.id, ['r', 'r', 'r', 'w', 'r'], 5);
      clock.now += 25 * HOUR;
      const r = await svc.v3.review('u1', g.id);
      assert.deepEqual([r.trap.q, r.trap.number, r.trap.caught], [3, 4, 'most']);
      const start = await svc.v3.fixStart('u2', { game: g.id, q: 3, stage: 'now' });
      assert.equal(start.trap.yourPick, wrongOf(BANK.find((b) => b.question === (r.questions[3].stem)).id));
      assert.equal(start.trap.correctIndex, r.questions[3].correctIndex);
      assert.equal(start.trap.why, r.questions[3].explanation);
      assert.doesNotMatch(JSON.stringify(start.question), /correctIndex|EXPLAIN/);
      const again = await svc.v3.fixStart('u2', { game: g.id, q: 3, stage: 'now' });
      assert.equal(again.question.stem, start.question.stem, 'the same fresh question on a repeat');
      const gameIds = await one(db, 'select question_ids r from mob_games where id=$1::uuid', [g.id]);
      const fixId = await one(db, "select question_id r from mob_fix_checks where user_id='u2' and stage='now' and game_id=$1::uuid", [g.id]);
      assert.ok(!gameIds.includes(fixId), 'never one of the game\'s own questions');
      const ans = await svc.v3.fixAnswer('u2', { game: g.id, q: 3, stage: 'now', pick: keyOf(fixId) });
      assert.equal(ans.correct, true);
      assert.equal(ans.correctIndex, keyOf(fixId));
      await assert.rejects(svc.v3.fixStart('u2', { game: g.id, q: 3, stage: 'check' }), (e) => e.code === 'FIX_NOT_YET' && Boolean(e.extra.detail.opensAt));
      await assert.rejects(svc.v3.fixStart('u2', { game: g.id, q: 2, stage: 'now' }), code('Q_INVALID'));
      const opens = Date.parse(r.trap.fix.check.opensAt);
      clock.now = opens + MIN;
      let last;
      for (const u of ['u1', 'u2']) {
        await svc.v3.fixStart(u, { game: g.id, q: 3, stage: 'check' });
        const id = await one(db, "select question_id r from mob_fix_checks where user_id=$1 and stage='check' and game_id=$2::uuid", [u, g.id]);
        last = await svc.v3.fixAnswer(u, { game: g.id, q: 3, stage: 'check', pick: keyOf(id) });
      }
      assert.equal(last.fixedTogether, true);
      return last;
    };
    await assert.rejects(svc.v3.fixStart('u1', { game: '00000000-0000-4000-8000-000000000000', q: 0, stage: 'now' }), code('GAME_NOT_FOUND'));
    const one1 = await fixTrap();
    assert.deepEqual(one1.fixed, { count: 1, of: 3 });
    await fixTrap();
    const three = await fixTrap();
    assert.deepEqual(three.fixed, { count: 3, of: 3 });
    for (const u of ['u1', 'u2', 'u3', 'u4']) assert.equal((await svc.v3.shelf(u)).folds.find((f) => f.key === 'crane').owned, true, `Crane for ${u}`);
    assert.ok(await one(db, "select sum(answered)::int r from mob_quest_ticks where source='fix'") >= 9, 'fix answers fill the quest');
    // Checks closed after Sunday 11:59 PM.
    clock.now += 7 * 24 * HOUR;
    const g = await one(db, 'select game_id::text r from mob_traps order by opened_at limit 1');
    await assert.rejects(svc.v3.fixStart('u4', { game: g, q: 3, stage: 'check' }), code('FIX_CLOSED'));
  } finally { await db.close(); }
});

test('stickers: 8 preset kinds only, shown in the den; seen keys; the view keeps every old key for build 9', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    await assert.rejects(svc.v3.sticker('u2', { mob: mobId, kind: 'hello there' }), code('STICKER_INVALID'));
    assert.deepEqual(await svc.v3.sticker('u2', { mob: mobId, kind: 'again' }), { ok: true });
    const view = await svc.view('u1', { mobId });
    assert.deepEqual(view.mob.v3.reactions.map((r) => [r.memberId, r.kind]), [[memberIdFor('test-secret', mobId, 'u2'), 'again']]);
    const off = await serviceFor(db, { clock, v3: false }).view('u1', { mobId });
    assert.equal(off.mob.v3, undefined, 'v3 off: no v3 key');
    const { v3, ...old } = view.mob;
    assert.ok(v3);
    assert.deepEqual(Object.keys(old).sort(), Object.keys(off.mob).sort(), 'every old key is still there');
    await assert.rejects(svc.v3.seen('u1', { keys: [] }), code('BODY_INVALID'));
    // v3 lifts the one free paper a week across Mobs (C-dec 2 item 9).
    const second = (await svc.create('u5', { subject: 'economics', name: 'Meera', colour: 0 })).mob.id;
    const inv = await svc.invite('u5', { mob: second });
    await svc.join('u1', { code: inv.code, name: 'Riya', colour: 0 });
    await svc.startPaper('u1', { mob: mobId });
    await db.query("select mob_paper_put($1::uuid, $2::date, 'accountancy', $3::jsonb)", [mobId, WEEK, JSON.stringify(BANK.slice(0, 10).map((q) => q.id))]);
    const started = await svc.startPaper('u1', { mob: second });
    assert.ok(started.id, 'a second Mob paper this week starts for a Free member');
    assert.equal((await svc.view('u1', { mobId: second })).mob.week.paper.blocked, null);
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Realtime (Phase B schema, tested now): payloads, tickets, policies
// ---------------------------------------------------------------------------------------------------------------

test('SV-14 every realtime send carries only m, q, done, k or startsAt (static scan and a runtime spy)', async () => {
  const allowed = new Set(['m', 'q', 'done', 'k', 'startsAt']);
  for (const f of V3) {
    const sql = read(`supabase/migrations/${f}.sql`);
    for (const m of sql.matchAll(/(?:mob_room_send\([^,]+,\s*'[^']+',\s*|using\s+)jsonb_build_object\(([^)]*)\)/g)) {
      const keys = [...m[1].matchAll(/'([^']+)'\s*,/g)].map((x) => x[1]).filter((_, i) => i % 1 === 0);
      const pairs = m[1].split(',').map((s) => s.trim());
      for (let i = 0; i < pairs.length; i += 2) assert.ok(allowed.has(pairs[i].replace(/'/g, '')), `${f}: ${pairs[i]}`);
      assert.ok(keys.length > 0);
    }
  }
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock, live: true });
    const mobId = await chaiCircle(db, svc);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    await svc.v3.sticker('u2', { mob: mobId, game: g.id, kind: 'good_luck' });
    await db.query("select mob_room_start('u1', $1::uuid, $2::timestamptz, $3::timestamptz)", [g.id, new Date(clock.now + 4000).toISOString(), new Date(clock.now).toISOString()]);
    clock.now += 5000;
    const r = await svc.v3.startRun('u2', g.id);
    assert.equal(r.run.live, true);
    assert.equal(r.run.startedAt, new Date(NOW + 4000).toISOString(), 'a live run starts at the room start');
    await svc.v3.answer('u2', g.id, { q: 0, pick: 1 });
    await svc.v3.finish('u2', g.id);
    const sent = (await db.query('select event, payload from realtime.sent order by id')).rows;
    assert.deepEqual(sent.map((s) => s.event), ['sticker', 'room.start', 'progress', 'progress', 'room.done']);
    for (const s of sent) for (const k of Object.keys(s.payload)) assert.ok(allowed.has(k), `${s.event}: ${k}`);
    assert.doesNotMatch(JSON.stringify(sent), /Aarav|Riya|correct|pick|marks/);
  } finally { await db.close(); }
});

test('SV-15 room auth: a ticket passes, a non-member, an expired or a revoked ticket fails; clients send presence only', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock, live: true });
    const mobId = await chaiCircle(db, svc);
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' })).game;
    const uid = { u2: '11111111-1111-4111-8111-111111111111', u3: '22222222-2222-4222-8222-222222222222', u6: '33333333-3333-4333-8333-333333333333' };
    const ticket = (u) => one(db, 'select mob_room_ticket($1, $2::uuid, $3::uuid, $4, now()) r', [u, uid[u], g.id, memberIdFor('test-secret', mobId, u)]);
    assert.equal((await ticket('u2')).status, 'ok');
    assert.equal((await ticket('u3')).status, 'ok');
    assert.equal((await ticket('u6')).status, 'not_member');
    const ok = async (u, topic = `mob-room:${g.id}`) => {
      await db.exec(`set rt.uid = '${uid[u]}'; set rt.topic = '${topic}'; set role authenticated;`);
      try { return await one(db, 'select public.mob_room_ok($1) r', [topic]); } finally { await db.exec('reset role'); }
    };
    assert.equal(await ok('u2'), true);
    assert.equal(await ok('u6'), false, 'no ticket');
    assert.equal(await ok('u2', 'mob-room:00000000-0000-4000-8000-000000000000'), false, 'another room');
    // Presence insert allowed, broadcast refused.
    await db.exec(`set rt.uid = '${uid.u2}'; set rt.topic = 'mob-room:${g.id}'; set role authenticated;`);
    await db.query("insert into realtime.messages (topic, extension, payload) values ($1, 'presence', '{}')", [`mob-room:${g.id}`]);
    await assert.rejects(db.query("insert into realtime.messages (topic, extension, payload) values ($1, 'broadcast', '{}')", [`mob-room:${g.id}`]), /row-level security/);
    assert.equal((await db.query('select count(*)::int n from realtime.messages')).rows[0].n, 1, 'receives on the room');
    await db.exec('reset role');
    // Leaving revokes; blocking revokes; expiry fails.
    await svc.leave('u3', { mob: mobId });
    assert.equal(await ok('u3'), false, 'revoked on leave');
    await db.query("select mob_block('u2','u4')");
    assert.equal(await ok('u2'), false, 'revoked on block');
    await db.query("update mob_room_tickets set revoked_at = null, expires_at = now() - interval '1 second'");
    assert.equal(await ok('u2'), false, 'expired');
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------
// Routes, rate limits, account deletion, copy
// ---------------------------------------------------------------------------------------------------------------

const req = (method = 'GET', body) => new Request('http://localhost/api/mob', { method, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
const v3Actions = Object.keys(ACTIONS).filter((a) => ACTIONS[a][4]?.v3);

test('routes: v3 actions are 404 MOB_DISABLED until MOB_V3_ENABLED, 401 signed out, and old actions are untouched', async () => {
  assert.equal(v3Actions.length, 24, '20 Phase A actions and the 4 live room actions (Phase B, presence since L-55)');
  const deps = (over = {}) => ({ enabled: () => true, v3Enabled: () => false, auth: async () => ({ user: { id: 'u1' } }), rateLimit: async () => ({ allowed: true }), cors: () => ({}), service: { v3: new Proxy({}, { get: () => async () => ({ ok: true }) }), chains: {} }, ...over });
  for (const a of v3Actions) {
    const off = await handleMob(deps(), a, req(ACTIONS[a][0], ACTIONS[a][0] === 'GET' ? undefined : {}), { id: 'x' });
    assert.equal(off.status, 404, a);
    assert.equal((await off.json()).error.code, 'MOB_DISABLED');
    const anon = await handleMob(deps({ v3Enabled: () => true, auth: async () => null }), a, req(ACTIONS[a][0], ACTIONS[a][0] === 'GET' ? undefined : {}), { id: 'x' });
    assert.equal(anon.status, 401, a);
    const mobOff = await handleMob(deps({ enabled: () => false, v3Enabled: () => true }), a, req(ACTIONS[a][0]), { id: 'x' });
    assert.equal(mobOff.status, 404, a);
  }
  const fine = await handleMob(deps({ v3Enabled: () => true, service: { v3: { openGame: async () => ({ game: {} }) } } }), 'gameOpen', req('POST', {}));
  assert.equal(fine.status, 201);
  assert.equal(fine.headers.get('cache-control'), 'no-store');
  // Every route file wires its handler.
  const files = ['settings', 'profile', 'shelf', 'sticker', 'mic', 'step-out', 'seen', 'game', 'game/[id]', 'game/[id]/run', 'game/[id]/answer', 'game/[id]/finish',
    'game/[id]/podium', 'game/[id]/review', 'game/[id]/room/ticket', 'game/[id]/room/start', 'game/[id]/room/cancel', 'game/[id]/room/presence', 'fix/start', 'fix/answer'].map((f) => `src/app/api/mob/${f}/route.js`).concat(['src/app/api/me/chain/route.js', 'src/app/api/me/chain/pause/route.js']);
  const wired = new Set();
  for (const f of files) for (const m of read(f).matchAll(/handleMob\(mobDeps\(\), '(\w+)'/g)) wired.add(m[1]);
  assert.deepEqual([...wired].sort(), [...v3Actions].sort());
});

test('SV-19 rate limits: the 2.5 table, a 429 with the real wait, success-only ones give back on failure', async () => {
  const want = { gameOpen: [8, 86_400_000, true], run: [30, 3_600_000, undefined], answer: [150, 600_000, undefined], ticket: [20, 3_600_000, true], room: [20, 3_600_000, undefined],
    sticker: [30, 3_600_000, true], mic: [10, 86_400_000, true], fix: [40, 3_600_000, undefined], chainWrite: [20, 86_400_000, undefined] };
  for (const [name, [limit, windowMs, success]] of Object.entries(want)) {
    assert.deepEqual([LIMITS[name].limit, LIMITS[name].windowMs, LIMITS[name].success, LIMITS[name].by], [limit, windowMs, success, 'user'], name);
    const line = limitMessage(name, 'in 5 hours');
    assert.match(line, /in 5 hours\.$/, name);
    assert.doesNotMatch(line, /!|->|—/);
  }
  const given = [];
  const deps = {
    enabled: () => true, v3Enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), cors: () => ({}),
    rateLimit: async (_r, o) => ({ allowed: o.route !== '/api/mob:answer', retryAfterSeconds: 120 }), giveBack: async (_r, o) => { given.push(o.route); },
    service: { v3: { openGame: async () => { const { MobError } = await import('../../src/lib/mob/model.mjs'); throw new MobError('START_USED'); } } },
  };
  const res = await handleMob(deps, 'answer', req('POST', {}), { id: 'x' });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '120');
  assert.match((await res.json()).error.message, /You can answer again in 2 minutes\./);
  const refused = await handleMob(deps, 'gameOpen', req('POST', {}));
  assert.equal((await refused.json()).error.code, 'START_USED');
  assert.deepEqual(given, ['/api/mob:gameOpen'], 'a refused start gives its count back');
});

test('SV-20 account deletion clears every new table that holds the user', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.users (id text primary key, name text not null default 'x', email text unique, username text unique, image text,
        subjects jsonb not null default '[]'::jsonb, role text not null default 'student', last_active_at timestamptz);
      insert into users (id, email, username) values ('u1','a@x.test','a'),('u2','b@x.test','b'),('u3','c@x.test','c'),('u4','d@x.test','d');`);
    await db.exec(STUBS);
    await db.exec(read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql'));
    await db.exec(read('supabase/migrations/20261013120000_deletion_processor.sql'));
    await db.exec(BASE);
    await db.exec(v3Sql);
    const clock = { now: Date.now() };
    const svc = serviceFor(db, { clock, billing: true, live: true, premium: (u) => u === 'u1' });
    const mobId = await chaiCircle(db, svc);
    await svc.v3.profile('u1', { fold: 'hexa' });
    await db.query("select mob_fold_grant('u1','hop','plain','mob_quest',null)");
    await svc.v3.sticker('u1', { mob: mobId, kind: 'nice_one' });
    await svc.v3.seen('u1', { keys: ['reveal:hop'] });
    await svc.v3.stepOut('u1', { mob: mobId, on: true });
    await svc.v3.mic('u1', { mob: mobId, to: memberIdFor('test-secret', mobId, 'u2') });
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
    await svc.v3.startRun('u1', g.id);
    await svc.v3.answer('u1', g.id, { q: 0, pick: 0 });
    await db.query("insert into mob_start_claims (user_id, mob_id, week_start) values ('u1', $1::uuid, current_date)", [mobId]);
    await db.query("insert into mob_traps values ($1::uuid, 0, 'q1', $2::uuid, now(), now(), now() + interval '1 day', null)", [g.id, mobId]);
    await db.query("insert into mob_fix_checks (game_id, q, user_id, stage, question_id) values ($1::uuid, 0, 'u1', 'now', 'q2')", [g.id]);
    await db.query("insert into mob_room_tickets (game_id, auth_uid, user_id, member_id, expires_at) values ($1::uuid, gen_random_uuid(), 'u1', 'ABCDEFGHJKMN', now() + interval '1 hour')", [g.id]);
    await svc.v3.chains.patch('u1', { hidden: true });
    await svc.v3.chains.pauseSet('u1', { days: [new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)] });
    await db.exec("insert into account_deletion_requests (user_id, requested_at, source) values ('u1', now() - interval '2 days', 'web')");
    const id = (await db.query("select id from account_deletion_requests where user_id='u1'")).rows[0].id;
    const r = (await db.query('select public.account_deletion_run($1::bigint, $2, $3::jsonb, true) as r', [id, 'u1', JSON.stringify(DELETION_STEPS)])).rows[0].r;
    assert.deepEqual(r.unclassified, []);
    for (const [t, where] of [['mob_profiles', "user_id='u1'"], ['fold_unlocks', "user_id='u1'"], ['mob_reactions', "from_user='u1'"], ['mob_seen', "user_id='u1'"],
      ['mob_step_outs', "user_id='u1'"], ['mob_game_runs', "user_id='u1'"], ['mob_game_answers', "user_id='u1'"], ['mob_start_claims', "user_id='u1'"],
      ['mob_mics', "giver_id='u1' or receiver_id='u1'"], ['mob_fix_checks', "user_id='u1'"], ['chain_prefs', "user_id='u1'"], ['chain_pauses', "user_id='u1'"],
      ['mob_room_tickets', "user_id='u1'"], ['mob_games', "created_by='u1'"]]) {
      assert.equal(await one(db, `select count(*)::int r from ${t} where ${where}`), 0, t);
    }
    assert.equal(await one(db, 'select count(*)::int r from mob_games'), 1, 'the game stays with the Mob, with no host');
    assert.ok(await one(db, 'select count(*)::int r from mob_quest_ticks') >= 1, 'quest ticks have no user id and stay');
  } finally { await db.close(); }
});

test('copy lint C-1 to C-4 on every new sentence and the new server files', () => {
  const v3Codes = ['START_PRO', 'START_USED', 'START_FORMAT', 'GAMES_OPEN_LIMIT', 'ROOM_OPEN_ALREADY', 'LIVE_OFF', 'LIVE_HOURS', 'LIVE_BUSY', 'GAME_NOT_FOUND', 'GAME_CLOSED', 'RUN_DONE',
    'RUN_EXPIRED', 'NO_RUN', 'Q_INVALID', 'PODIUM_NOT_YET', 'REVIEW_NOT_YET', 'NOT_LIVE', 'ROOM_NOT_HOST', 'ROOM_STARTED', 'STICKER_INVALID', 'MIC_LIMIT', 'MIC_SELF', 'BILLING_OFF',
    'NOT_OWNER_SETTINGS', 'NAME_KEY_INVALID', 'FOLD_INVALID', 'FOLD_LOCKED', 'STEP_OUT_DONE', 'FIX_NOT_YET', 'FIX_CLOSED', 'PAUSE_PAST', 'PAUSE_LIMIT'];
  const statuses = { START_PRO: 402, START_FORMAT: 402, LIVE_BUSY: 503, GAME_NOT_FOUND: 404, GAME_CLOSED: 410, RUN_EXPIRED: 410, FIX_CLOSED: 410, ROOM_NOT_HOST: 403, NOT_OWNER_SETTINGS: 403 };
  const lines = [...v3Codes.map((c) => { assert.ok(ERRORS[c], c); if (statuses[c]) assert.equal(ERRORS[c][0], statuses[c], c); return ERRORS[c][1]; }), ...MOB_NAMES, ...Object.values(FOLDS).map((f) => f.line)];
  const files = ['src/lib/mob/games.mjs', 'src/lib/mob/quest.mjs', 'src/lib/mob/starts.mjs', 'src/lib/mob/names.mjs', 'src/lib/server/mob/games.js'].map(read);
  for (const line of lines) {
    assert.doesNotMatch(line, /₹|\bRs\b|price|\bbuy\b|per month/i, `C-1 ${line}`);
    assert.doesNotMatch(line, /!/, `C-2 ${line}`);
    assert.doesNotMatch(line, /of you have not|still to play|one more can play|waiting on/i, `C-3 ${line}`);
    assert.doesNotMatch(line, /late night|all-nighter|night owl|up late|midnight|burn the/i, `C-4 ${line}`);
  }
  for (const f of files) {
    const strings = [...f.matchAll(/(['`])((?:(?!\1).){8,})\1/g)].map((m) => m[2]).filter((s) => /[a-z] [a-z]/i.test(s));
    for (const s of strings) assert.doesNotMatch(s, /₹|per month|of you have not|still to play|one more can play|night owl|all-nighter/i, s);
  }
});

test('the migration headers say staging only and name their undo file', () => {
  for (const f of V3) {
    const sql = read(`supabase/migrations/${f}.sql`);
    assert.match(sql, /Applied to staging only by this change/, f);
    assert.match(sql, new RegExp(`supabase/undo/${f}\\.undo\\.sql`), f);
    assert.ok(readdirSync(resolve(root, 'supabase/undo')).includes(`${f}.undo.sql`), f);
    assert.equal((sql.match(/security definer/g) || []).length, f.endsWith('realtime') ? 2 : 0, `${f}: only mob_room_ok is security definer`);
  }
});

test('GET /api/mob capability flag: v3Available is true when v3 is on (Mob or no Mob), absent when off; old keys unchanged', async () => {
  const db = await database();
  try {
    const on = serviceFor(db, { v3: true });
    const off = serviceFor(db, { v3: false });
    assert.deepEqual(await on.view('nobody'), { mob: null, v3Available: true });
    assert.deepEqual(await off.view('nobody'), { mob: null });
    const mobId = await chaiCircle(db, on);
    const withMob = await on.view('u1', { mobId });
    assert.equal(withMob.v3Available, true);
    assert.ok(withMob.mob && withMob.mob.v3, 'the v3 block rides with the flag');
    const legacy = await off.view('u1', { mobId });
    assert.equal('v3Available' in legacy, false);
    assert.equal(legacy.mob.v3, undefined);
    assert.deepEqual(Object.keys(legacy).sort(), Object.keys(withMob).filter((k) => k !== 'v3Available').sort(), 'no other top-level key moves');
    const res = await handleMob({ enabled: () => true, v3Enabled: () => true, auth: async () => ({ user: { id: 'nobody' } }), rateLimit: async () => ({ allowed: true }), service: on }, 'get', new Request('https://x.test/api/mob'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { mob: null, v3Available: true }, 'the route passes the flag through');
  } finally { await db.close(); }
});

// L-10 (20 Oct): "Share my marks" off must not leak results through moments, the together line or ghosts.
test('L-10 a private run: only "finished", out of the together line and out of ghosts (pure rules)', () => {
  const ans = (spec) => spec.map(([q, correct, ms]) => ({ q, correct, elapsedMs: ms, pick: correct === null ? -1 : 0 }));
  const runs = [
    { userId: 'you', memberId: 'Y', place: 1, finishedAt: '2026-10-22T09:00:00Z', right: 3, wrong: 2, answers: ans([[0, true, 30000], [1, false, 50000], [2, true, 70000], [3, false, 80000], [4, true, 100000]]) },
    { userId: 'kabir', memberId: 'K', place: null, private: true, finishedAt: '2026-10-22T10:00:00Z', right: 5, wrong: 0, answers: ans([[0, true, 2000], [1, true, 4000], [2, true, 6000], [3, true, 8000], [4, true, 10000]]) },
  ];
  const moments = assignMoments(runs, { count: 5 });
  assert.deepEqual(moments.find((m) => m.memberId === 'K'), { memberId: 'K', kind: 'finished_all', count: 5 }, 'no "All 5 right", no "No minus marks", no fastest for a private run');
  const you = moments.find((m) => m.memberId === 'Y');
  assert.notEqual(you.kind, 'fastest_right', 'nobody else is named fastest when the private run truly was');
  assert.notEqual(you.kind, 'quickest_finish');
  assert.deepEqual(togetherLine(runs.map((r) => ({ userId: r.userId, right: r.right, private: r.private === true })), 5), { kind: 'together', right: 3, of: 5 }, 'the private 5 is not in the sum, and "of" stays true');
  assert.deepEqual(togetherLine([{ right: 3 }, { right: 4 }], 5), { kind: 'together', right: 7, of: 10 });
});

test('L-10 the service: 2 finishers, one private: podium, moments, together line and ghosts give nothing away', async () => {
  const db = await database();
  const clock = { now: NOW };
  try {
    const svc = serviceFor(db, { clock });
    const mobId = await chaiCircle(db, svc);
    await svc.patchMe('u3', { mob: mobId, showScore: false });
    const g = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'async' })).game;
    await play(svc, clock, 'u1', g.id, ['r', 'w', 'r', 'w', 'r']);
    await play(svc, clock, 'u3', g.id, ['r', 'r', 'r', 'r', 'r'], 2);
    const p = await svc.v3.podium('u1', g.id);
    const kabirId = memberIdFor('test-secret', mobId, 'u3');
    const kabir = p.places.find((x) => x.memberId === kabirId);
    assert.equal(kabir.marks, null);
    assert.equal(kabir.private, true);
    assert.deepEqual(p.moments.find((m) => m.memberId === kabirId), { memberId: kabirId, kind: 'finished_all', count: 5 });
    assert.deepEqual(p.headline, { kind: 'together', right: 3, of: 5 }, "Riya cannot subtract her own 3 to get Kabir's 5");
    const ghosts = (await svc.v3.getGame('u1', g.id)).game.ghosts;
    assert.equal(ghosts.some((x) => x.memberId === kabirId), false, "Kabir's pace is not replayed to anyone");
    const leak = JSON.stringify({ p, ghosts });
    assert.doesNotMatch(leak, /all_right|no_minus|fastest_right|quickest_finish|three_in_a_row/, 'no fact about the private run, and none borrowed from it');
    // Kabir's own view: his own facts and his own marks are his.
    const own = await svc.v3.podium('u3', g.id);
    assert.equal(own.places.find((x) => x.you).marks, 25);
    assert.equal(own.moments.find((m) => m.memberId === kabirId).kind, 'all_right');
    assert.deepEqual(own.headline, { kind: 'together', right: 8, of: 10 });
    // Sharing back on: Kabir is a ghost again and counts in the line.
    await svc.patchMe('u3', { mob: mobId, showScore: true });
    assert.equal((await svc.v3.getGame('u1', g.id)).game.ghosts.some((x) => x.memberId === kabirId), true);
    assert.deepEqual((await svc.v3.podium('u1', g.id)).headline, { kind: 'together', right: 8, of: 10 });
  } finally { await db.close(); }
});

// L-09 (20 Oct): blocking someone separates the two students in every Mob they share, in the same request.
test('L-09 leave and block separates you in every Mob you share; a report with block does the same', async () => {
  const db = await database();
  try {
    const svc = serviceFor(db, { premium: (id) => id === 'u1' });
    const x = await chaiCircle(db, svc); // u1 Riya owns X; u2 Aarav, u3 Kabir, u4 Zoya
    // Y: Aarav's own Mob, Riya joins it. Z: Riya's second Mob (Pro), Aarav joins it. W: Riya and Kabir only.
    const y = (await svc.create('u2', { subject: 'economics', name: 'Aarav', colour: 1 })).mob.id;
    await svc.join('u1', { code: (await svc.invite('u2', { mob: y })).code, name: 'Riya', colour: 3 });
    const z = (await svc.create('u1', { subject: 'economics', name: 'Riya', colour: 3 })).mob.id;
    await svc.join('u2', { code: (await svc.invite('u1', { mob: z })).code, name: 'Aarav', colour: 1 });
    const w = (await svc.create('u3', { subject: 'economics', name: 'Kabir', colour: 2 })).mob.id;
    await svc.join('u1', { code: (await svc.invite('u3', { mob: w })).code, name: 'Riya', colour: 3 });
    const inMob = async (mob, user) => Boolean(await one(db, 'select 1 r from mob_members where mob_id=$1::uuid and user_id=$2', [mob, user]));

    const out = await svc.leave('u1', { mob: x, block: memberIdFor('test-secret', x, 'u2') });
    assert.deepEqual(out, { left: true, separatedMobs: 2 });
    assert.equal(await inMob(x, 'u1'), false, 'Riya left the Mob she blocked from');
    assert.equal(await inMob(x, 'u2'), true, 'the others stay in X');
    assert.equal(await inMob(y, 'u1'), false, 'in Aarav\'s Mob, Riya leaves');
    assert.equal(await inMob(y, 'u2'), true);
    assert.equal(await inMob(z, 'u1'), true, 'in her own Mob, Riya stays the owner');
    assert.equal(await inMob(z, 'u2'), false, 'and Aarav is removed');
    assert.equal(await one(db, "select role r from mob_members where mob_id=$1::uuid and user_id='u1'", [z]), 'owner');
    assert.equal(await inMob(w, 'u1'), true, 'a Mob without Aarav is untouched');
    // Neither can come back into a Mob the other is in.
    await assert.rejects(svc.join('u2', { code: (await svc.invite('u1', { mob: z })).code, name: 'Aarav', colour: 1 }), code('INVITE_INVALID'));
    await assert.rejects(svc.join('u1', { code: (await svc.invite('u2', { mob: y })).code, name: 'Riya', colour: 3 }), code('INVITE_INVALID'));
    // Nothing shared is left between them.
    assert.equal(await one(db, "select count(*)::int r from mob_members a join mob_members b on a.mob_id=b.mob_id where a.user_id='u1' and b.user_id='u2'"), 0);

    // A report with block: Kabir reports Zoya in X and blocks her; they also share Zoya's Mob V.
    const v = (await svc.create('u4', { subject: 'economics', name: 'Zoya', colour: 1 })).mob.id;
    await svc.join('u3', { code: (await svc.invite('u4', { mob: v })).code, name: 'Kabir', colour: 2 });
    const rep = await svc.report('u3', { mob: x, memberId: memberIdFor('test-secret', x, 'u4'), reason: 'safety', block: true });
    assert.deepEqual(rep, { reported: true, left: true, separatedMobs: 1 });
    assert.equal(await inMob(x, 'u3'), false);
    assert.equal(await inMob(v, 'u3'), false);
    assert.equal(await inMob(w, 'u3'), true, 'Kabir keeps his own Mob W, where Zoya never was');
    // Leave without block separates nothing else.
    assert.deepEqual(await svc.leave('u1', { mob: w }), { left: true });
  } finally { await db.close(); }
});
