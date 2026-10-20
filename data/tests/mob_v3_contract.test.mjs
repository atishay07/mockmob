// SV-18: the Mob v3 contract. Real service responses for every Phase A route, from one fixed Chai Circle story on PGlite,
// written once to data/tests/fixtures/mob_v3/*.json (MOB_V3_WRITE_FIXTURE=1) and then compared byte for byte, with ids
// (uuids, memberIds) replaced by stable placeholders. The app builds and tests against these files; the differences from
// spec section 3 are listed in tmp/walk-1019/mob-v3/MOB-SERVER-A.md.
// Run: node --test data/tests/mob_v3_contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERRORS, errorBody } from '../../src/lib/mob/model.mjs';
import { MOB_NAMES } from '../../src/lib/mob/names.mjs';
import { foldCatalogJson } from '../../src/lib/mob/folds.mjs';
import { createMobService, memberIdFor } from '../../src/lib/server/mob/service.js';
// Formats (owner D167) add: game_open_race, run_start_race, answer_race(_skip, _out_of_order), answer_time_up, finish_race,
// game_get_race, podium_race, game_open_live_race, room_ticket_race, room_presence(_no_ticket), run_not_started,
// run_start_live_race, game_open_mock(_free), paper_start_mock, run_start_mock, game_get_mock, podium_mock(_closed),
// den_get_formats. Error fixtures are { status, body } as the route sends them.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const DIR = resolve(root, 'data/tests/fixtures/mob_v3');
const MIGRATIONS = ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime', '20261020100400_mob_v3_live', '20261020140000_mob_v3_formats', '20261020152000_mob_den_fix'];
const NOW = Date.parse('2026-10-22T08:35:00Z'); // Thursday 22 Oct, 2:05 PM IST
// 200 questions: the first 40 on Goodwill (the story's chapter games), the rest across two more units for the full mock.
const CHAPTERS = ['Goodwill', 'Cash Flow Statement', 'Ratios'];
const BANK = Array.from({ length: 200 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `${i < 40 ? 'Goodwill' : CHAPTERS[i % 3]} question ${i + 1}`, chapter: i < 40 ? 'Goodwill' : CHAPTERS[i % 3], explanation: `Why answer ${'ABCD'[i % 4]} is right for question ${i + 1}.`,
  options: ['A', 'B', 'C', 'D'].map((t) => ({ key: t, text: `Option ${t} of question ${i + 1}` })),
}));
const keyOf = (id) => BANK.find((q) => q.id === id).correctIndex;
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

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

async function story() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users(id) select 'u'||g from generate_series(1,8) g;");
  await db.exec("create schema auth; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;");
  for (const f of MIGRATIONS) await db.exec(read(`supabase/migrations/${f}.sql`));
  const clock = { now: NOW };
  const flags = { billing: false, pro: new Set(['u1']) };
  let seed = 7;
  const svc = createMobService({
    rpc: pgRpc(db), now: () => clock.now, secret: 'contract-secret', blocklist: { contains: [], words: [] },
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (seed = (seed * 131 + 17) % 256)),
    subjectInfo: (s) => (s === 'accountancy' ? { ok: true, id: s, name: 'Accountancy' } : { ok: false }),
    loadUser: async (id) => ({ subjects: ['accountancy'], isPremium: flags.pro.has(id) }),
    validChapter: (_s, c) => c === 'Goodwill',
    // Fix questions: a fixed draw (their key carries a memberId, which changes with the Mob's random id).
    // Like the bank: never an excluded id; a chapter narrows the draw.
    pickQuestionIds: async (_s, { count = 10, key = null, exclude = [], chapter = null } = {}) => {
      const pool = chapter ? BANK.filter((q) => q.chapter === chapter) : BANK;
      const start = key?.startsWith('fix_') ? 30 : key ? hash(key) % 30 : 0;
      const skip = new Set(exclude);
      return Array.from({ length: pool.length }, (_, i) => pool[(start + i) % pool.length].id).filter((id) => !skip.has(id)).slice(0, count);
    },
    sectionsFor: (_s, qs) => qs.map((q) => ({ Goodwill: { key: 'unit_1', label: 'Reconstitution of a Partnership firm' }, 'Cash Flow Statement': { key: 'unit_5', label: 'Analysis of Financial Statements' }, Ratios: { key: 'unit_5', label: 'Analysis of Financial Statements' } })[q.chapter] || null),
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async () => null, findAttempts: async () => [],
    // The practice start's own response is today's SessionView; this echo shows what the Mob passes it for a full mock.
    startPractice: async (_u, input, server) => ({ id: 'practice_x', input, mobPaper: server?.mobPaper ? { ...server.mobPaper, questions: undefined, questionCount: server.mobPaper.questions.length } : null }),
    v3Enabled: () => true, billingOn: () => flags.billing, liveEnabled: () => true, formatsEnabled: () => true,
  });
  const out = {};
  // Chai Circle: Riya (owner, u1), Aarav (you, u2), Kabir (u3), Zoya (u4).
  const mobId = (await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 0, fold: 'kandil' })).mob.id;
  out['invite.json'] = await svc.invite('u1', { mob: mobId });
  out['lookup.json'] = await svc.lookup(out['invite.json'].code);
  for (const [u, name, fold] of [['u2', 'Aarav', 'dart'], ['u3', 'Kabir', 'hexa'], ['u4', 'Zoya', 'dogear']]) await svc.join(u, { code: out['invite.json'].code, name, colour: 1, fold });
  const ids = async (gameId) => (await db.query('select question_ids r from mob_games where id=$1::uuid', [gameId])).rows[0].r;
  const playAs = async (u, gameId, plan, gap) => {
    await svc.v3.startRun(u, gameId);
    const qs = await ids(gameId);
    const res = [];
    for (let q = 0; q < plan.length; q += 1) {
      clock.now += gap * 1000;
      res.push(await svc.v3.answer(u, gameId, { q, pick: plan[q] === 'r' ? keyOf(qs[q]) : plan[q] === 'w' ? (keyOf(qs[q]) + 1) % 4 : -1 }));
    }
    return res;
  };
  // A game that closes with a trap (yesterday's), then today's open sprint.
  clock.now = NOW - 26 * 3600_000;
  const closed = (await svc.v3.openGame('u1', { mob: mobId, format: 'sprint' })).game;
  await playAs('u1', closed.id, ['r', 'r', 'r', 's', 'r'], 20);
  await playAs('u2', closed.id, ['r', 'r', 'r', 'w', 'r'], 15);
  await playAs('u3', closed.id, ['r', 'r', 'r', 'w', 'r'], 10);
  await playAs('u4', closed.id, ['r', 'w', 'r', 'w', 'r'], 25);
  clock.now = NOW;
  out['game_open_201.json'] = await svc.v3.openGame('u3', { mob: mobId, format: 'sprint', chapter: 'Goodwill' });
  const open = out['game_open_201.json'].game;
  await playAs('u1', open.id, ['r', 'r', 'r', 'r', 's'], 30);
  await playAs('u3', open.id, ['r', 'r', 'w', 'r', 'r'], 33);
  out['run_start.json'] = await svc.v3.startRun('u2', open.id);
  const qs = await ids(open.id);
  clock.now += 41_000;
  out['answer_right.json'] = await svc.v3.answer('u2', open.id, { q: 0, pick: keyOf(qs[0]) });
  clock.now += 38_000;
  out['answer_wrong.json'] = await svc.v3.answer('u2', open.id, { q: 1, pick: (keyOf(qs[1]) + 1) % 4 });
  clock.now += 20_000;
  out['answer_skip.json'] = await svc.v3.answer('u2', open.id, { q: 2, pick: -1 });
  out['answer_retry.json'] = await svc.v3.answer('u2', open.id, { q: 2, pick: 1 });
  out['run_resume.json'] = await svc.v3.startRun('u2', open.id);
  clock.now += 30_000;
  await svc.v3.answer('u2', open.id, { q: 3, pick: keyOf(qs[3]) });
  out['finish.json'] = await svc.v3.finish('u2', open.id);
  out['game_get.json'] = await svc.v3.getGame('u2', open.id);
  out['podium_so_far.json'] = await svc.v3.podium('u2', open.id);
  out['podium_closed.json'] = await svc.v3.podium('u2', closed.id);
  out['review.json'] = await svc.v3.review('u2', closed.id);
  out['fix_start.json'] = await svc.v3.fixStart('u2', { game: closed.id, q: 3, stage: 'now' });
  const fixId = (await db.query("select question_id r from mob_fix_checks where user_id='u2'")).rows[0].r;
  out['fix_answer.json'] = await svc.v3.fixAnswer('u2', { game: closed.id, q: 3, stage: 'now', pick: keyOf(fixId) });
  await svc.v3.profile('u2', { fold: 'dart' });
  out['profile.json'] = await svc.v3.profile('u2', { fold: 'hexa' });
  out['shelf.json'] = await svc.v3.shelf('u2');
  out['chain.json'] = await svc.v3.chains.get('u2');
  out['den_get.json'] = await svc.view('u2', { mobId });
  out['sticker.json'] = await svc.v3.sticker('u2', { mob: mobId, kind: 'nice_one' });
  out['seen.json'] = await svc.v3.seen('u2', { keys: ['reveal:hop'] });
  // Starts with billing on: Free with a start, Free used, Pro, and a passed mic.
  flags.billing = true;
  out['starts_free.json'] = (await svc.view('u4', { mobId })).mob.v3.starts;
  out['starts_pro.json'] = (await svc.view('u1', { mobId })).mob.v3.starts;
  out['mic.json'] = await svc.v3.mic('u1', { mob: mobId, to: memberIdFor('contract-secret', mobId, 'u4') });
  out['starts_mic.json'] = (await svc.view('u4', { mobId })).mob.v3.starts;
  await db.query("insert into mob_start_claims (user_id, mob_id, week_start) values ('u2', $1::uuid, '2026-10-19')", [mobId]);
  out['starts_used.json'] = (await svc.view('u2', { mobId })).mob.v3.starts;
  // Phase B, live rooms (behind MOB_LIVE_ENABLED): Riya (Pro) opens a live sprint, Aarav takes a ticket, Riya starts the
  // room and plays one question live, and Aarav reads the running room.
  out['game_open_live.json'] = await svc.v3.openGame('u1', { mob: mobId, format: 'sprint', mode: 'live' });
  const live = out['game_open_live.json'].game;
  out['room_ticket.json'] = await svc.v3.roomTicket('u2', '6f1d2c3b-4a59-4e87-9d10-2b3c4d5e6f70', live.id);
  out['room_start.json'] = await svc.v3.roomStart('u1', live.id);
  clock.now += 4000;
  await svc.v3.startRun('u1', live.id);
  clock.now += 21_000;
  await svc.v3.answer('u1', live.id, { q: 0, pick: keyOf((await ids(live.id))[0]) });
  out['game_live_running.json'] = await svc.v3.getGame('u2', live.id);
  // ---- Formats (owner D167): a second Mob of Riya's, with a race, a live race and a full mock open together.
  const mob2 = (await svc.create('u1', { subject: 'accountancy', name: 'Riya', colour: 3, nameKey: 1, fold: 'kandil' })).mob.id;
  const inv2 = await svc.invite('u1', { mob: mob2 });
  for (const [u, name, fold] of [['u2', 'Aarav', 'dart'], ['u3', 'Kabir', 'hexa']]) await svc.join(u, { code: inv2.code, name, colour: 1, fold });
  const errorOf = async (p) => { try { await p; return null; } catch (e) { return { status: ERRORS[e.code][0], body: errorBody(e.code, { message: e.extra?.message, detail: e.extra?.detail }) }; } };
  // A 5-minute race (Kabir, Free: his weekly start in this Mob). Riya races first; Aarav races against her ghost.
  out['game_open_race.json'] = await svc.v3.openGame('u3', { mob: mob2, format: 'race', minutes: 5 });
  const race = out['game_open_race.json'].game;
  const rq = await ids(race.id);
  await svc.v3.startRun('u1', race.id);
  for (const [q, p] of ['r', 'r', 'w', 'r', 's', 'r'].entries()) { clock.now += 11_000; await svc.v3.answer('u1', race.id, { q, pick: p === 'r' ? keyOf(rq[q]) : p === 'w' ? (keyOf(rq[q]) + 1) % 4 : -1 }); }
  out['finish_race.json'] = await svc.v3.finish('u1', race.id);
  out['run_start_race.json'] = await svc.v3.startRun('u2', race.id);
  const raceStart = clock.now;
  clock.now += 9000;
  out['answer_race.json'] = await svc.v3.answer('u2', race.id, { q: 0, pick: keyOf(rq[0]) });
  clock.now += 7000;
  out['answer_race_skip.json'] = await svc.v3.answer('u2', race.id, { q: 1, pick: -1 });
  out['answer_race_out_of_order.json'] = await errorOf(svc.v3.answer('u2', race.id, { q: 5, pick: 0 }));
  out['game_get_race.json'] = await svc.v3.getGame('u2', race.id);
  clock.now += 8000;
  await svc.v3.answer('u2', race.id, { q: 2, pick: keyOf(rq[2]) });
  // Time up: 5 minutes after the start, plus the 2 s grace.
  clock.now = raceStart + 5 * 60_000 + 2500;
  out['answer_time_up.json'] = await errorOf(svc.v3.answer('u2', race.id, { q: 3, pick: keyOf(rq[3]) }));
  out['podium_race.json'] = await svc.v3.podium('u2', race.id);
  // A live race (Riya, Pro): the room, presence through the API (L-55), and Go.
  out['game_open_live_race.json'] = await svc.v3.openGame('u1', { mob: mob2, format: 'race', minutes: 10, mode: 'live' });
  const liveRace = out['game_open_live_race.json'].game;
  await svc.v3.roomTicket('u1', '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d', liveRace.id);
  await svc.v3.roomPresence('u1', liveRace.id, { st: 'here' });
  out['room_ticket_race.json'] = await svc.v3.roomTicket('u2', '6f1d2c3b-4a59-4e87-9d10-2b3c4d5e6f70', liveRace.id);
  out['room_presence.json'] = await svc.v3.roomPresence('u2', liveRace.id, { st: 'ready' });
  out['room_presence_no_ticket.json'] = await errorOf(svc.v3.roomPresence('u3', liveRace.id, { st: 'here' }));
  const go = await svc.v3.roomStart('u1', liveRace.id);
  out['run_not_started.json'] = await errorOf(svc.v3.startRun('u2', liveRace.id));
  clock.now = Date.parse(go.startsAt) + 500;
  out['run_start_live_race.json'] = await svc.v3.startRun('u2', liveRace.id);
  // Full mock together (Riya, Pro): 50 questions, the CUET pattern, 24 hours; sat in the practice runner.
  out['game_open_mock_free.json'] = await errorOf(svc.v3.openGame('u3', { mob: mob2, format: 'mock' }));
  out['game_open_mock.json'] = await svc.v3.openGame('u1', { mob: mob2, format: 'mock' });
  const mock = out['game_open_mock.json'].game;
  const mq = await ids(mock.id);
  out['paper_start_mock.json'] = await svc.startPaper('u2', { mob: mob2, game: mock.id });
  await svc.startPaper('u1', { mob: mob2, game: mock.id });
  out['run_start_mock.json'] = await errorOf(svc.v3.startRun('u2', mock.id));
  const handIn = (u, plan, at) => ({
    id: `attempt_${u}`, correct: plan.filter((x) => x === 'r').length, total: 50, completedAt: at,
    details: mq.map((qid, i) => ({ qid, givenIndex: plan[i] === 'r' ? keyOf(qid) : plan[i] === 'w' ? (keyOf(qid) + 1) % 4 : -1 })),
    selectionMeta: { mode: 'full', mobPaper: { mobId: mob2, weekStart: '2026-10-19', gameId: mock.id } },
  });
  clock.now += 48 * 60_000;
  await svc.recordFromAttempt('u1', handIn('u1', mq.map((_, i) => (i === 9 ? 'w' : i < 38 ? 'r' : i < 44 ? 'w' : 's')), clock.now));
  clock.now += 4 * 60_000;
  await svc.recordFromAttempt('u2', handIn('u2', mq.map((_, i) => (i === 9 ? 's' : i < 33 ? 'r' : i < 45 ? 'w' : 's')), clock.now));
  out['game_get_mock.json'] = await svc.v3.getGame('u2', mock.id);
  out['podium_mock.json'] = await svc.v3.podium('u2', mock.id);
  out['den_get_formats.json'] = await svc.view('u2', { mobId: mob2 });
  // After the close: the most-missed question is the trap, and Fix it together opens on it.
  clock.now = Date.parse(mock.closesAt) + 60_000;
  out['podium_mock_closed.json'] = await svc.v3.podium('u2', mock.id);
  // Fix it together on the den (v3.fix, additive; migration 20261020152000_mob_den_fix): Zoya (u4) never took yesterday's fix, so the den says
  // ready; Aarav (u2) took it, so he hears nothing until the trap's own Wednesday check opens, and then he is asked for the check.
  out['den_fix_ready.json'] = (await svc.view('u4', { mobId })).mob.v3.fix;
  assert.equal(Object.hasOwn((await svc.view('u2', { mobId })).mob.v3, 'fix'), false, 'Aarav did his part and the check is not open');
  clock.now = Date.parse(out['review.json'].trap.fix.check.opensAt) + 60_000;
  out['den_fix_check.json'] = (await svc.view('u2', { mobId })).mob.v3.fix;
  out['folds.json'] = foldCatalogJson();
  out['names.json'] = { names: [...MOB_NAMES] };
  out['errors_v3.json'] = Object.fromEntries(Object.keys(ERRORS).map((c) => [c, { status: ERRORS[c][0], body: errorBody(c) }]));
  await db.close();
  return out;
}

/** Stable placeholders for ids that change per run: uuids and memberIds, numbered in order of first appearance. */
function normalise(all) {
  const map = new Map();
  const swap = (s, re, tag) => s.replace(re, (m) => { if (!map.has(m)) map.set(m, `${tag}-${[...map.keys()].filter((k) => map.get(k).startsWith(tag)).length + 1}`); return map.get(m); });
  const out = {};
  for (const [name, body] of Object.entries(all)) {
    let s = JSON.stringify(body, null, 2);
    s = swap(s, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, 'uuid');
    s = swap(s, /(?<="(?:memberId|hostMemberId|m)": ")[0-9A-Z]{12}(?=")/g, 'member');
    s = s.replace(/(quest_done|stitch):[^:"]+:/g, '$1:uuid-mob:');
    // A full mock's practice key is an HMAC of the game id (random per run).
    s = s.replace(/("generationKey": "mob_)[0-9a-f]{40}"/g, '$1HMAC"');
    // Sticker times come from the database clock.
    s = s.replace(/("at": ")[^"]+(",\s*"game")|("kind": "nice_one",\s*"at": ")[^"]+"/g, (m) => m.replace(/\d{4}-\d{2}-\d{2}T[^"]+/, 'DB-TIME'));
    out[name] = `${s}\n`;
  }
  return out;
}

let cached = null;
const fixtures = async () => (cached ||= normalise(await story()));

if (process.env.MOB_V3_WRITE_FIXTURE === '1') {
  mkdirSync(DIR, { recursive: true });
  for (const [name, text] of Object.entries(await fixtures())) writeFileSync(resolve(DIR, name), text);
}

test('the v3 contract fixtures are exactly what the routes return (ids normalised)', async () => {
  for (const [name, text] of Object.entries(await fixtures())) {
    const file = resolve(DIR, name);
    assert.ok(existsSync(file), `run once with MOB_V3_WRITE_FIXTURE=1 (${name})`);
    assert.equal(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), text, name);
  }
});

test('the shapes spec section 3 names are all there', async () => {
  const f = Object.fromEntries(Object.entries(await fixtures()).map(([k, v]) => [k, JSON.parse(v)]));
  const has = (obj, keys, label) => { for (const k of keys) assert.ok(Object.hasOwn(obj, k), `${label}: ${k}`); };
  const v3 = f['den_get.json'].mob.v3;
  has(v3, ['name', 'showPodium', 'youOwn', 'members', 'games', 'quest', 'mobChain', 'shelf', 'starts', 'chainChip', 'reactions', 'moments', 'live'], 'v3');
  has(v3.members[0], ['memberId', 'name', 'colour', 'fold', 'finish', 'you', 'owner'], 'member');
  has(v3.games[0], ['id', 'format', 'mode', 'count', 'chapter', 'subjectName', 'host', 'openedAt', 'closesAt', 'closed', 'room', 'runs', 'yourRun', 'podiumReady'], 'den game');
  has(v3.quest, ['week', 'target', 'answered', 'done', 'doneAt', 'sizedFor', 'youSteppedOut', 'bySource', 'parcel'], 'quest');
  has(v3.mobChain, ['weeks', 'best', 'passes', 'stitchedThisWeek', 'next'], 'mobChain');
  has(v3.starts, ['billingOn', 'can', 'via', 'modes', 'formats', 'freeLeft', 'mics', 'micsToGive'], 'starts');
  has(f['den_get.json'].mob, ['id', 'subject', 'plan', 'members', 'week', 'invite'], 'the old view');
  const game = f['game_get.json'].game;
  has(game, ['id', 'mobId', 'format', 'mode', 'count', 'secondsPerQuestion', 'subjectName', 'chapter', 'title', 'host', 'openedAt', 'closesAt', 'closed', 'serverNow', 'room', 'runs', 'you', 'ghosts', 'podiumReady'], 'game');
  has(game.ghosts[0], ['memberId', 'name', 'colour', 'fold', 'playedAt', 'arrivalsMs', 'finishedMs'], 'ghost');
  has(f['run_start.json'], ['run', 'questions', 'ghosts'], 'run');
  has(f['run_start.json'].run, ['startedAt', 'endsAt', 'serverNow', 'live', 'answers'], 'run.run');
  has(f['run_start.json'].questions[0], ['q', 'stem', 'options', 'passage'], 'question');
  has(f['answer_right.json'], ['correct', 'delta', 'marks', 'elapsedMs', 'answered', 'count', 'finished', 'serverNow'], 'answer');
  assert.deepEqual([f['answer_right.json'].delta, f['answer_wrong.json'].delta, f['answer_skip.json'].delta, f['answer_skip.json'].correct], [5, -1, 0, null]);
  assert.deepEqual(f['answer_retry.json'].correct, null, 'a retry returns the stored result');
  has(f['podium_so_far.json'], ['soFar', 'closesAt', 'showPodium', 'headline', 'places', 'tie', 'moments', 'trap'], 'podium');
  assert.equal(f['podium_so_far.json'].trap, null);
  assert.deepEqual(f['podium_closed.json'].trap, { q: 3, number: 4, caught: 'most' });
  has(f['review.json'].questions[0], ['q', 'stem', 'options', 'correctIndex', 'explanation', 'yourPick'], 'review question');
  has(f['review.json'].trap.fix, ['now', 'check', 'fixed'], 'review fix');
  has(f['fix_start.json'], ['question', 'trap'], 'fix start');
  has(f['fix_start.json'].trap, ['q', 'why', 'yourPick', 'correctIndex'], 'fix trap');
  has(f['fix_answer.json'], ['correct', 'correctIndex', 'explanation', 'fixedTogether', 'fixed'], 'fix answer');
  has(f['shelf.json'], ['seat', 'folds', 'mobItems'], 'shelf');
  has(f['chain.json'], ['hidden', 'days', 'practised', 'rested', 'madeUp', 'best', 'today', 'passes', 'week', 'calendar', 'milestones', 'makeUp', 'pause', 'notices', 'due'], 'chain');
  has(f['invite.json'], ['code', 'display', 'url', 'expiresAt'], 'invite');
  assert.match(f['invite.json'].code, /^[0-9A-HJKMNP-TV-Z]{6}$/);
  has(f['lookup.json'], ['status', 'subject', 'subjectName', 'name', 'size', 'seatsLeft'], 'lookup');
  assert.equal(f['lookup.json'].name, 'Chai Circle');
  assert.deepEqual(f['starts_used.json'], { billingOn: true, can: false, reason: 'used', modes: [], formats: [], locked: ['race', 'mock'], freeLeft: 0, mics: 0,
    mock: { costCredits: 50, sitCredits: 50, proRequiredToStart: true, canStart: false, proSitsFree: true } });
  assert.deepEqual([f['starts_pro.json'].mock.costCredits, f['starts_pro.json'].mock.canStart], [0, true], 'Pro starts and sits free');
  assert.deepEqual([f['starts_mic.json'].via, f['starts_mic.json'].mics, f['starts_mic.json'].micFrom.name], ['free_weekly', 1, 'Riya'], 'the free start is used first; the mic waits');
  assert.equal(f['starts_pro.json'].via, 'pro');
  // Formats (owner D167).
  const race = f['game_open_race.json'].game;
  assert.deepEqual([race.format, race.minutes, race.count, race.secondsPerQuestion], ['race', 5, 30, null]);
  assert.deepEqual(f['run_start_race.json'].questions.map((q) => q.q), [0], 'a race serves one question at a time');
  assert.equal(f['run_start_race.json'].run.minutes, 5);
  has(f['answer_race.json'], ['correct', 'delta', 'marks', 'elapsedMs', 'answered', 'count', 'finished', 'serverNow', 'endsAt', 'next'], 'race answer');
  assert.equal(f['answer_race.json'].next.q, 1);
  assert.equal(f['answer_race_out_of_order.json'].body.error.code, 'Q_INVALID');
  assert.deepEqual([f['answer_time_up.json'].status, f['answer_time_up.json'].body.error.code], [410, 'RUN_EXPIRED']);
  has(f['game_get_race.json'].game.ghosts[0], ['memberId', 'name', 'colour', 'fold', 'playedAt', 'arrivalsMs', 'finishedMs', 'answered'], 'race ghost');
  assert.deepEqual(f['finish_race.json'].run, { finished: true, marks: 19, answered: 5, right: 4, wrong: 1, skipped: 1 });
  has(f['podium_race.json'].places[0], ['memberId', 'name', 'marks', 'answered'], 'race place');
  assert.deepEqual(f['room_presence.json'].roster.map((r) => r.st).sort(), ['here', 'ready']);
  assert.equal(f['room_presence_no_ticket.json'].body.error.code, 'NO_TICKET');
  has(f['room_ticket_race.json'].room, ['state', 'startsAt', 'hostMemberId', 'roster'], 'ticket room');
  assert.equal(f['run_not_started.json'].body.error.code, 'RUN_NOT_STARTED');
  assert.ok(f['run_not_started.json'].body.error.detail.startsAt);
  assert.equal(f['run_start_live_race.json'].run.live, true);
  const mock = f['game_open_mock.json'].game;
  assert.deepEqual([mock.format, mock.mode, mock.count, mock.minutes, mock.room], ['mock', 'async', 50, 60, null]);
  // Full mock together's price (owner D174): only Pro starts it; Free pays 50 credits to sit it, charged as a solo Full mock.
  assert.deepEqual([f['game_open_mock_free.json'].status, f['game_open_mock_free.json'].body.error.code], [403, 'MOCK_PRO_REQUIRED']);
  assert.deepEqual(f['game_open_mock_free.json'].body.error.detail, { costCredits: 50, sitCredits: 50, proRequiredToStart: true, canStart: false, proSitsFree: true });
  assert.deepEqual(mock.price, { costCredits: 0, sitCredits: 50, proSitsFree: true }, 'the Pro host sits free');
  assert.deepEqual([f['paper_start_mock.json'].input.mode, f['paper_start_mock.json'].mobPaper.questionCount, f['paper_start_mock.json'].mobPaper.holdUntil], ['full', 50, mock.closesAt]);
  assert.equal(f['paper_start_mock.json'].mobPaper.creditAction, 'attempt_full', 'a Free member sits for the solo Full mock price');
  assert.equal(f['run_start_mock.json'].body.error.code, 'RUN_PAPER');
  has(f['game_get_mock.json'].game.you, ['run', 'marks', 'answered', 'resultId'], 'mock you');
  has(f['podium_mock.json'].sheets[0], ['memberId', 'name', 'colour', 'fold', 'you', 'private', 'marks', 'of', 'right', 'wrong', 'skipped', 'accuracy', 'timeMs', 'sections'], 'sheet');
  has(f['podium_mock.json'].sheets[0].sections[0], ['key', 'label', 'of', 'marks', 'right', 'wrong', 'skipped', 'accuracy', 'timeMs'], 'sheet section');
  assert.deepEqual(f['podium_mock_closed.json'].trap, { q: 38, number: 39, caught: 'most' }, 'the most-missed question (both missed; both picked wrong beats one blank)');
  const den2 = f['den_get_formats.json'].mob.v3;
  assert.deepEqual(den2.games.map((g) => [g.format, g.minutes]).sort(), [['mock', 60], ['race', 10], ['race', 5]]);
  assert.deepEqual(den2.starts.locked, ['mock']);
  assert.deepEqual(den2.starts.mock, { costCredits: 50, sitCredits: 50, proRequiredToStart: true, canStart: false, proSitsFree: true });
  assert.deepEqual(den2.games.find((g) => g.format === 'mock').price, { costCredits: 0, sitCredits: 50, proSitsFree: true }, 'u2 has started: nothing more to pay');
  has(f['game_get_mock.json'].game, ['price'], 'mock game');
  for (const name of ['game_open_race.json', 'run_start_race.json', 'answer_race.json', 'answer_race_skip.json', 'game_get_race.json', 'podium_race.json', 'run_start_live_race.json', 'game_open_mock.json', 'game_get_mock.json', 'podium_mock.json', 'room_presence.json', 'room_ticket_race.json']) {
    assert.doesNotMatch(JSON.stringify(f[name]), /correctIndex|explanation|Why answer/, name);
  }
  // F1: before close, no key or explanation anywhere in the open game's files.
  for (const name of ['game_open_201.json', 'game_get.json', 'run_start.json', 'run_resume.json', 'answer_right.json', 'answer_wrong.json', 'finish.json', 'podium_so_far.json']) {
    assert.doesNotMatch(JSON.stringify(f[name]), /correctIndex|explanation|Why answer/, name);
  }
});
