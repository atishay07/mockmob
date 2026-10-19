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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const DIR = resolve(root, 'data/tests/fixtures/mob_v3');
const MIGRATIONS = ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains', '20261020100300_mob_v3_realtime'];
const NOW = Date.parse('2026-10-22T08:35:00Z'); // Thursday 22 Oct, 2:05 PM IST
const BANK = Array.from({ length: 40 }, (_, i) => ({
  id: `q${i + 1}`, correctIndex: i % 4, question: `Goodwill question ${i + 1}`, chapter: 'Goodwill', explanation: `Why answer ${'ABCD'[i % 4]} is right for question ${i + 1}.`,
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
    pickQuestionIds: async (_s, { count = 10, key = null } = {}) => { const start = key?.startsWith('fix_') ? 30 : key ? hash(key) % 30 : 0; return Array.from({ length: count }, (_, i) => BANK[(start + i) % 40].id); },
    loadQuestions: async (ids) => ids.map((id) => BANK.find((q) => q.id === id)).filter(Boolean),
    trapNameFor: async () => null, findAttempts: async () => [], startPractice: async () => ({ id: 'practice_x' }),
    v3Enabled: () => true, billingOn: () => flags.billing, liveEnabled: () => true,
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
  assert.deepEqual(f['starts_used.json'], { billingOn: true, can: false, reason: 'used', modes: [], formats: [], freeLeft: 0, mics: 0 });
  assert.deepEqual([f['starts_mic.json'].via, f['starts_mic.json'].mics, f['starts_mic.json'].micFrom.name], ['free_weekly', 1, 'Riya'], 'the free start is used first; the mic waits');
  assert.equal(f['starts_pro.json'].via, 'pro');
  // F1: before close, no key or explanation anywhere in the open game's files.
  for (const name of ['game_open_201.json', 'game_get.json', 'run_start.json', 'run_resume.json', 'answer_right.json', 'answer_wrong.json', 'finish.json', 'podium_so_far.json']) {
    assert.doesNotMatch(JSON.stringify(f[name]), /correctIndex|explanation|Why answer/, name);
  }
});
