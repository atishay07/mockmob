// A late paper earns nothing that rewards or compares (bugs-core B8 follow-up, tmp/1115-prod/SESS-FOLLOWUP.md item 1, 15 Nov
// 2026). A modified client can stamp every event inside the time and send the paper up to 7 days later with looked-up answers,
// so a paper marked selection_meta.late keeps its result, Review and repairs and earns no badge or best, no study day, no
// chain day, no Fold, no Mob hours (migration 20261115210000, not applied: tested in mob_hours_1020.test.mjs), no funnel step
// and no "first". The result page says why in one quiet line (item 2).
// Run: node --test data/tests/late_paper_rewards_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { LATE_JSON, dailyWithoutLate, lateIds, readMockScores, unlockFactsWithoutLate } from '../../src/lib/server/latePapers.js';
import { createChainService } from '../../src/lib/server/chain.js';
import { funnelStepsForSession } from '../../src/lib/server/funnelOnce.js';
import { buildRecap } from '../../src/lib/server/recap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const DAY = 86_400_000;

// ---------------------------------------------------------------------------------------------------------------------
// The chain (chain_daily is applied SQL: the late papers come off in the service)
// ---------------------------------------------------------------------------------------------------------------------
test('dailyWithoutLate: each late paper\'s answered count comes off its IST day of arrival, never below 0', () => {
  const daily = [{ day: '2026-11-14', answered: 12 }, { day: '2026-11-15', answered: 7 }];
  const late = [
    { completed_at: '2026-11-14T18:29:59Z', total: 10, unattempted: 2 }, // 14 Nov, 11:59 PM IST: 8 answered
    { completed_at: '2026-11-14T18:30:00Z', total: 50, unattempted: 0 }, // 15 Nov, 12:00 AM IST: 50, more than the day holds
    { completed_at: 'junk', total: 9 },
  ];
  assert.deepEqual(dailyWithoutLate(daily, late), [{ day: '2026-11-14', answered: 4 }, { day: '2026-11-15', answered: 0 }]);
  assert.deepEqual(dailyWithoutLate(daily, []), daily);
  assert.deepEqual(dailyWithoutLate(daily, null), daily, 'a failed late read changes nothing');
  assert.notEqual(dailyWithoutLate(daily, [])[0], daily[0], 'copies');
  assert.deepEqual(dailyWithoutLate(null, late), []);
});

async function chainDb() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users values ('u1'),('u2');");
  await db.exec(`create table public.attempts (id text primary key, user_id text, subject text, score int, correct int, wrong int, unattempted int, total int,
    details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  for (const f of ['20261017100000_mob', '20261017190000_mob_fix_1017', '20261020100000_mob_v3_core', '20261020100100_mob_v3_games', '20261020100200_mob_v3_chains']) {
    await db.exec(file(`supabase/migrations/${f}.sql`));
  }
  return db;
}
const pgRpc = (db) => async (name, params) => {
  const keys = Object.keys(params);
  return (await db.query(`select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`, keys.map((k) => params[k]))).rows[0].r;
};
// The late read the production wiring makes (readLatePapersSoft), on PGlite: the student's attempts whose selection_meta->>'late' is 'true'.
const lateOf = (db) => async (userId) => (await db.query(
  "select id, user_id, score, total, unattempted, completed_at, selection_meta->>'mode' as mode from attempts where user_id = $1 and selection_meta->>'late' = 'true'", [userId])).rows
  .map((r) => ({ ...r, completed_at: new Date(r.completed_at).toISOString() }));

test('the chain service: a late paper makes no chain day and stores no best; a failed late read shows the chain but stores nothing', async () => {
  const db = await chainDb();
  try {
    const now = Date.parse('2026-10-22T08:00:00Z');
    const add = (id, at, meta = {}) => db.query("insert into attempts (id, user_id, total, unattempted, completed_at, selection_meta) values ($1, 'u1', 5, 0, $2, $3)", [id, at, JSON.stringify(meta)]);
    // Yesterday on time; the day before, only a paper sent late that day (sat offline days before it).
    await add('x1', new Date(now - DAY).toISOString(), { mode: 'quick' });
    await add('x2', new Date(now - 2 * DAY).toISOString(), { mode: 'full', late: true, lateArrivedAt: new Date(now - 2 * DAY).toISOString() });
    const best = async () => (await db.query("select best_days r from chain_prefs where user_id='u1'")).rows[0]?.r ?? null;

    const counted = await createChainService({ rpc: pgRpc(db), now: () => now, latePapers: async () => null }).get('u1');
    assert.equal(counted.days, 2, 'the applied SQL alone counts the late paper\'s day');
    assert.equal(await best(), null, 'a failed late read stores no best');
    // A late read that throws is the same as a failed one: no crash, nothing stored.
    assert.equal((await createChainService({ rpc: pgRpc(db), now: () => now, latePapers: async () => { throw new Error('boom'); } }).get('u1')).days, 2);
    assert.equal(await best(), null);

    const svc = createChainService({ rpc: pgRpc(db), now: () => now, latePapers: lateOf(db) });
    const c = await svc.get('u1');
    assert.equal(c.days, 1, 'without the late paper the run is yesterday alone');
    assert.equal(await best(), 1, 'the best stored is the one earned on time');
    const { daily } = await svc.read('u1');
    assert.equal(daily.find((d) => d.day === '2026-10-20').answered, 0, 'the late paper\'s day reads 0 answered');
    // The same chain as a student who never sent the late paper.
    await db.query("delete from attempts where id = 'x2'");
    assert.deepEqual(await createChainService({ rpc: pgRpc(db), now: () => now }).get('u1'), c);
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------------------------------------
// The Folds (mob_unlock_facts is applied SQL: the late papers come off in games.js)
// ---------------------------------------------------------------------------------------------------------------------
test('unlock facts: a late mock is never the first full mock or a beaten best; on-time papers are unchanged', async () => {
  const db = await chainDb();
  try {
    const add = (id, subject, score, at, late = false) => db.query("insert into attempts (id, user_id, subject, score, total, completed_at, selection_meta) values ($1, 'u1', $2, $3, 50, $4, $5)",
      [id, subject, score, at, JSON.stringify({ mode: 'full', ...(late ? { late: true } : {}) })]);
    // One on-time English mock, then a late one that beats it.
    await add('m1', 'english', 100, '2026-10-01T10:00:00Z');
    await add('m2', 'english', 200, '2026-10-05T10:00:00Z', true);
    const facts = await pgRpc(db)('mob_unlock_facts', { p_user_id: 'u1' });
    assert.equal(facts.full_mocks, 2);
    assert.equal(facts.beat_best, true, 'the applied SQL counts the late paper');
    // readMockScores over a PostgREST-shaped stand-in that runs on PGlite.
    const mocks = (await db.query("select subject, score, completed_at, selection_meta->>'late' as late from attempts where user_id='u1' and selection_meta->>'mode' in ('full','nta') order by completed_at")).rows
      .map((r) => ({ ...r, completed_at: new Date(r.completed_at).toISOString() }));
    const late = await lateOf(db)('u1');
    const fixed = unlockFactsWithoutLate(facts, late, mocks);
    assert.equal(fixed.full_mocks, 1);
    assert.equal(fixed.beat_best, false, 'only the late paper beat the best');
    assert.deepEqual(fixed.mobs, facts.mobs, 'everything else is as the SQL said');
    // An on-time paper that beats the earlier best still earns it; the late one between them is not a "before".
    await add('m3', 'english', 150, '2026-10-09T10:00:00Z');
    const mocks2 = [...mocks, { subject: 'english', score: 150, completed_at: '2026-10-09T10:00:00.000Z', late: null }];
    assert.equal(unlockFactsWithoutLate(await pgRpc(db)('mob_unlock_facts', { p_user_id: 'u1' }), late, mocks2).beat_best, true);
    // Only late papers: no first full mock. No late mock: the facts are returned as they are. A failed mocks read: no beat_best.
    assert.equal(unlockFactsWithoutLate({ full_mocks: 1, beat_best: false }, [{ mode: 'full' }], []).full_mocks, 0);
    const same = { full_mocks: 3, beat_best: true };
    assert.equal(unlockFactsWithoutLate(same, [{ mode: 'quick' }], null), same);
    assert.equal(unlockFactsWithoutLate(same, [], null), same);
    assert.equal(unlockFactsWithoutLate(same, [{ mode: 'nta' }], null).beat_best, false);
  } finally { await db.close(); }
});

test('the Mob wiring: deps pass the soft late read and the mock scores; games.js corrects the facts and grants nothing on a failed read; the chain gets the same read', async () => {
  const deps = file('src/lib/server/mob/deps.js');
  assert.match(deps, /latePapers: \(userId\) => readLatePapersSoft\(supabaseAdmin\(\), \{ userId \}\)/);
  assert.match(deps, /mockScores: \(userId\) => readMockScores\(supabaseAdmin\(\), userId\)/);
  const games = file('src/lib/server/mob/games.js');
  assert.match(games, /createChainService\(\{ rpc: deps\.rpc, now, latePapers: deps\.latePapers \? latePapersOf : undefined, extraDays: deps\.extraDays \}\)/);
  assert.match(games, /const facts = unlockFactsWithoutLate\(counted, late, mocks\);/);
  assert.match(games, /if \(late === null \|\| chainLateUnread\) return \{ facts, unlocks: \[\.\.\.\(facts\?\.unlocks \|\| \[\]\)\], daily: days \};/);
  // The chain's own failed late read also holds every grant (review, 15 Nov): both callers pass it on.
  assert.equal((games.match(/checkUnlocks\(userId, \{ daily, chainBest: chain\.best, lateUnread \}\)/g) || []).length, 2);
  // readMockScores asks for the Full mock and NTA papers with their late flag.
  const calls = [];
  const db = { from(t) { const q = { select(c) { calls.push(['select', t, c]); return q; }, eq(k, v) { calls.push(['eq', k, v]); return q; }, in(k, v) { calls.push(['in', k, v]); return q; },
    order() { return q; }, limit() { return q; }, then(res, rej) { return Promise.resolve({ data: [{ subject: 'english' }], error: null }).then(res, rej); } }; return q; } };
  assert.deepEqual(await readMockScores(db, 'u1'), [{ subject: 'english' }]);
  assert.deepEqual(calls, [['select', 'attempts', 'subject,score,completed_at,late:selection_meta->>late'], ['eq', 'user_id', 'u1'], ['in', 'selection_meta->>mode', ['full', 'nta']]]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Study day, streak weeks and the server badges (attempt reads filtered in PostgREST), the web badges and bests (slim reads)
// ---------------------------------------------------------------------------------------------------------------------
test('the rhythm (study day, weeks, firsts) and the server badges read no late paper; the filter is exactly NOT selection_meta @> {"late":true}', async () => {
  assert.equal(LATE_JSON, '{"late":true}');
  const prefs = file('src/lib/server/appPrefs.js');
  assert.match(prefs, /const sessions = \(\) => db\.from\('attempts'\)\.select\(cols\)\.eq\('user_id', userId\)\.in\('selection_meta->>scoringVersion', SERVER_SCORING\)\.not\('selection_meta', 'cs', LATE_JSON\);/);
  const badges = file('src/lib/server/badgesStore.js');
  assert.match(badges, /\.in\('selection_meta->>scoringVersion', SERVER_SCORING\)\s*\n\s*\/\/[^\n]*\n\s*\.not\('selection_meta', 'cs', LATE_JSON\)/);
  // What PostgREST sends for .not('selection_meta', 'cs', '{"late":true}'), on Postgres: late papers out, every other paper in.
  const db = new PGlite();
  try {
    await db.exec(`create table attempts (id text primary key, selection_meta jsonb);
      insert into attempts values ('on', '{"scoringVersion":"server_practice_v1"}'), ('late', '{"scoringVersion":"server_practice_v1","late":true}'),
        ('text', '{"scoringVersion":"server_practice_v1","late":"true"}'), ('off', '{"scoringVersion":"server_practice_v1","late":false}');`);
    const ids = (await db.query('select id from attempts where not (selection_meta @> $1::jsonb) order by id', [LATE_JSON])).rows.map((r) => r.id);
    assert.deepEqual(ids, ['off', 'on', 'text']);
  } finally { await db.close(); }
});

test('the web badges, bests and fastest answer (study record) and /api/me/bests drop the late papers by id; a failed late read serves them as before', () => {
  assert.deepEqual([...lateIds([{ id: 'a' }, { id: 7 }, null, {}])], ['a', '7']);
  assert.equal(lateIds(null).size, 0);
  for (const rel of ['src/app/api/me/study-record/route.js', 'src/app/api/me/bests/route.js']) {
    const src = file(rel);
    assert.match(src, /readLatePapersSoft\(supabaseAdmin\(\), \{ userId: session\.user\.id \}\)/, rel);
    assert.match(src, /const skip = lateIds\(late\);\s*\n\s*const attempts = skip\.size \? all\.filter\(\(a\) => !skip\.has\(String\(a\.id\)\)\) : all;/, rel);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// The funnel, the result's tone, the result page
// ---------------------------------------------------------------------------------------------------------------------
test('a late finish counts no funnel step; an on-time one counts as before', () => {
  const result = { id: 'p1', mode: 'full', selectionMeta: { mode: 'full' } };
  assert.deepEqual(funnelStepsForSession({ kind: 'finish', result }), ['first_practice_finished', 'first_mock_finished']);
  assert.deepEqual(funnelStepsForSession({ kind: 'finish', result: { ...result, selectionMeta: { mode: 'full', late: true } } }), []);
});

test('the result\'s tone: a late paper is never a first mock or a jump on the last one; held still wins; on time unchanged', () => {
  const att = (id, at, correct, meta = {}) => ({ id, subject: 'english', total: 20, correct, wrong: 0, unattempted: 20 - correct, completedAt: at,
    questionsSnapshot: Array.from({ length: 20 }, (_, i) => ({ id: `${id}${i}` })), selectionMeta: { mode: 'full', scoringVersion: 'server_practice_v1', ...meta } });
  const first = att('m1', 1, 10);
  assert.equal(buildRecap(first, [first], {}).tone, 'first_mock');
  const firstLate = att('m1', 1, 10, { late: true });
  assert.equal(buildRecap(firstLate, [firstLate], {}).tone, 'default');
  const up = att('m2', 2, 18);
  assert.equal(buildRecap(up, [first, up], {}).tone, 'higher');
  const upLate = att('m2', 2, 18, { late: true });
  const r = buildRecap(upLate, [first, upLate], {});
  assert.equal(r.tone, 'default');
  assert.equal(r.previousComparable.attemptId, 'm1', 'the last paper is still named for the student');
  assert.equal(buildRecap(upLate, [first, upLate], {}, 'unavailable').tone, 'held');
});

test('the result page: one quiet line on a late paper, no earned-badge row, no "first action"; an on-time paper is unchanged', () => {
  const page = file('src/app/(app)/result/[id]/ResultPageClient.jsx');
  const line = /const LATE_PAPER_LINE = '([^']+)';/.exec(page)?.[1];
  assert.equal(line, 'This paper was sent after its time ended, so it is kept for your own practice. It does not count toward your week or your Mob.');
  // Plain words (brief rule 7): no exclamation, no arrows, short.
  assert.doesNotMatch(line, /[!→]/);
  assert.match(page, /const lateLine = attempt\.selectionMeta\?\.late === true \? LATE_PAPER_LINE : null;/);
  assert.match(page, /lateLine=\{lateLine\}/);
  assert.match(page, /\{lateLine \? null : <EarnedBadges attempt=\{attempt\} \/>\}/);
  assert.match(page, /&& attempt\?\.selectionMeta\?\.late !== true \? attempt\.id : null;/);
  const hero = file('src/components/result/ResultHero.jsx');
  assert.match(hero, /lateLine = null,/);
  assert.match(hero, /\{lateLine \? <p className="rh-receipt" data-late="">\{lateLine\}<\/p> : null\}/);
});
