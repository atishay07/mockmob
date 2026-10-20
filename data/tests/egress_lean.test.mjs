import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attemptMemoKey, readAttemptRows, resetSlimState, memoisedAttempts } from '../attempt_reads.js';
import { formatIdFor } from '../../src/lib/server/attemptSummary.js';
import { learningPlan } from '../learning_engine.js';
import { tonightCompletion, studyMilestones } from '../study_progress.js';
import { weakConcepts, weakChapters } from '../learning_weak.js';
import { computePrepOSInsights } from '../prepos_insights.js';
import { compassProjection } from '../compass_projection.js';
import { buildStanding } from '../mobi_standing.js';
import { computeBests, buildRecap } from '../../src/lib/server/recap.js';
import { buildStudyRecord } from '../../src/lib/studyBadges.js';
import { resultHistory } from '../mock_swot.js';
import { buildMissedBefore, sourceLabel } from '../../src/components/recovery/repairRun.js';
import { loadRuleSources, repairRulesFrom, readRuleBook } from '../../src/lib/server/ruleBook.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';
import { rulesBody, playbookBody } from '../../src/lib/server/playbook.js';
import { indexAtlas, buildTrapsMeet } from '../trap_atlas.js';
import { optionHash } from '../option_hash.js';
import { repairsFor, missesOf } from '../../src/app/(app)/dashboard/repairsLine.mjs';
import { fullMocksIn } from '../../src/lib/proNudge.mjs';
import { mocksSummary } from '../../src/components/profile/accountModel.mjs';
import { attemptForClient, attemptHold, heldAttemptView } from '../../src/lib/mob/paperHold.mjs';
import { summaryAttempt, marksItem, isMarksView, isSummaryView } from '../../src/lib/server/attemptListSummary.js';
import { loadReviewRecord } from '../../src/lib/server/review.js';
import { buildRepairRecord } from '../../src/lib/server/repairRecord.js';
import { richAttemptRows, leanDatabase, callFunction, tableRows, pgSupabase, reviewDb, SNAPSHOT_KEYS } from './helpers/lean_fixtures.mjs';

// Egress items A1, A3, A4, A5, A8 (20 Oct 2026): attempts read through database functions that reduce the snapshot. The functions run
// for real in PGlite from the unedited migrations; each consumer is run on the rows of the table (the "before") and on the rows
// of the function (the "after") and must give the identical answer.

// The mapper of data/db.js (attemptOut), copied; egress_attempts.test.mjs pins the copy to the file.
const attemptOut = (r) => r && ({
  id: r.id, userId: r.user_id, subject: r.subject, score: r.score, correct: r.correct, wrong: r.wrong, unattempted: r.unattempted, total: r.total,
  details: r.details || [], questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {},
  mode: (r.selection_meta && r.selection_meta.mode) || null,
  formatId: formatIdFor({ subject: r.subject, total: r.total, questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {} }),
  completedAt: new Date(r.completed_at).getTime(),
});

const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const ROWS = [...richAttemptRows(1, 'u1', 14, { mobPaperOn: [3] }), ...richAttemptRows(2, 'u2', 3), ...richAttemptRows(3, 'u3', 1)];
let pg;
test.before(async () => { pg = await leanDatabase(ROWS); });
test.after(async () => { await pg.close(); });

const before = async (user) => (await tableRows(pg, user)).map(attemptOut);
const lean = async (user, profile) => (await callFunction(pg, 'attempts_lean', { p_user_id: user, p_profile: profile })).map(attemptOut);
const summary = async (user) => (await callFunction(pg, 'attempts_list_summary', { p_user_id: user })).map(attemptOut);
const bytes = (v) => JSON.stringify(v).length;

// ---- the function itself ---------------------------------------------------------------------------------------
test('attempts_lean: same rows, same order, same positions and count in every snapshot; details whole; unknown profile raises', async () => {
  for (const user of ['u1', 'u2', 'u3', 'nobody']) {
    const full = await tableRows(pg, user);
    for (const profile of ['plan', 'history']) {
      const rows = await callFunction(pg, 'attempts_lean', { p_user_id: user, p_profile: profile });
      assert.deepEqual(rows.map((r) => r.id), full.map((r) => r.id), `${user}/${profile}: order`);
      rows.forEach((r, i) => {
        for (const col of ['user_id', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total']) assert.equal(r[col], full[i][col]);
        assert.equal(new Date(r.completed_at).getTime(), new Date(full[i].completed_at).getTime());
        assert.deepEqual(r.details, full[i].details, 'details are whole');
        assert.deepEqual(r.questions_snapshot.map((q) => q.id), full[i].questions_snapshot.map((q) => q.id), 'positions and count');
      });
    }
  }
  await assert.rejects(callFunction(pg, 'attempts_lean', { p_user_id: 'u1', p_profile: 'everything' }), /unknown profile/);
});

test('attempts_lean: a kept key is exactly the row\'s (present stays present, null stays null, absent stays absent)', async () => {
  const odd = { id: 'odd-1', user_id: 'odd', subject: 'economics', score: 1, correct: 1, wrong: 0, unattempted: 0, total: 3, details: [{ qid: 'a', givenIndex: 0, isCorrect: true }],
    questions_snapshot: [{ id: 'a', chapter: null, conceptId: 'c1', subject: 'economics', explanation: 'x', body: 'Same stem', question: 'Same stem', options: ['a', 'b'], correctIndex: 1 },
      { id: 'b', question: 'Only a stem' }, 'not-an-object'], completed_at: '2026-10-01T00:00:00Z', selection_meta: { mode: 'quick', junk: 1, tonight: null } };
  await pg.query('insert into public.attempts values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [odd.id, odd.user_id, odd.subject, odd.score, odd.correct, odd.wrong, odd.unattempted, odd.total, JSON.stringify(odd.details), JSON.stringify(odd.questions_snapshot), odd.completed_at, JSON.stringify(odd.selection_meta)]);
  try {
    const [plan] = await callFunction(pg, 'attempts_lean', { p_user_id: 'odd', p_profile: 'plan' });
    assert.deepEqual(plan.questions_snapshot, [{ id: 'a', chapter: null, conceptId: 'c1', subject: 'economics' }, { id: 'b' }, 'not-an-object']);
    assert.deepEqual(plan.selection_meta, { mode: 'quick', tonight: null });
    const [history] = await callFunction(pg, 'attempts_lean', { p_user_id: 'odd', p_profile: 'history' });
    assert.deepEqual(history.questions_snapshot[0], { id: 'a', chapter: null, conceptId: 'c1', subject: 'economics', question: 'Same stem', options: ['a', 'b'], correctIndex: 1 }, 'a body equal to the stem is not shipped twice');
    assert.deepEqual(history.questions_snapshot[1], { id: 'b', question: 'Only a stem' }, 'no key is invented');
    assert.ok(!('body' in history.questions_snapshot[1]));
  } finally { await pg.query("delete from public.attempts where user_id = 'odd'"); }
});

test('attempts_lean: only service_role may execute it', async () => {
  for (const role of ['anon', 'authenticated']) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(pg.query("select * from public.attempts_lean('u1','plan')"), /permission denied/, role);
    await pg.exec('reset role');
  }
  await pg.exec('set role service_role');
  // the role has no table grant in this fixture; the function is security invoker, so it is the table's grant that decides what it reads
  await pg.exec('reset role');
  const sql = readFileSync(new URL('../../supabase/migrations/20261020150000_attempts_lean_fn.sql', import.meta.url), 'utf8');
  assert.match(sql, /security invoker/);
  assert.match(sql, /revoke all on function public\.attempts_lean\(text, text, text\[\]\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.attempts_lean\(text, text, text\[\]\) to service_role;/);
  assert.match(sql, /set search_path to 'public', 'pg_temp'/);
  assert.ok(readFileSync(new URL('../../supabase/undo/20261020150000_attempts_lean_fn.undo.sql', import.meta.url), 'utf8').includes('drop function if exists public.attempts_lean(text, text, text[]);'));
});

test('bytes: the plan profile is under 5% of the table rows, history and summary far under', async () => {
  const full = bytes(await tableRows(pg, 'u1'));
  const plan = bytes(await callFunction(pg, 'attempts_lean', { p_user_id: 'u1', p_profile: 'plan' }));
  const history = bytes(await callFunction(pg, 'attempts_lean', { p_user_id: 'u1', p_profile: 'history' }));
  const sum = bytes(await callFunction(pg, 'attempts_list_summary', { p_user_id: 'u1' }));
  assert.ok(plan < full * 0.05, `plan ${plan} vs full ${full}`);
  assert.ok(history < full * 0.2, `history ${history} vs full ${full}`);
  assert.ok(sum < full * 0.3, `summary ${sum} vs full ${full}`);
  assert.ok(plan < history && history < sum);
});

// ---- A1: the plan --------------------------------------------------------------------------------------------------
test('A1: the learning plan, tonight, milestones, weak concepts and chapters are identical from the plan rows', async () => {
  for (const user of ['u1', 'u2', 'u3', 'nobody']) {
    const a = await before(user);
    const b = await lean(user, 'plan');
    assert.equal(b.length, a.length, 'ordinaryAttemptCount');
    const concepts = [...new Set(a.flatMap((x) => x.questionsSnapshot.map((q) => q.conceptId)))].slice(0, 6);
    for (const subject of ['economics', 'accountancy']) {
      for (const availableConcepts of [[], concepts]) {
        for (const minutes of [10, 25]) {
          const input = (attempts) => learningPlan({ episodes: [], activeSession: null, attempts, subject, minutes, now: NOW, availableConcepts });
          assert.deepEqual(input(b), input(a), `${user} ${subject} ${minutes} ${availableConcepts.length}`);
        }
      }
    }
    assert.deepEqual(tonightCompletion(b, NOW), tonightCompletion(a, NOW));
    assert.deepEqual(studyMilestones(b, []), studyMilestones(a, []));
    assert.deepEqual(weakConcepts(b), weakConcepts(a));
    assert.deepEqual(weakChapters(b), weakChapters(a));
  }
  assert.equal(tonightCompletion(await lean('u1', 'plan'), NOW).state, 'recorded', 'the fixture really carries a Tonight record');
  assert.ok(weakConcepts(await lean('u1', 'plan')).length > 3 && weakChapters(await lean('u1', 'plan')).length > 3);
});

// ---- A5 / A8: the summary function (already on production) ------------------------------------------------------------
const SUBJECT_NAMES = { accountancy: 'Accountancy', economics: 'Economics' };
test('A5: insights, compass and standing are identical from the summary rows (newest 60)', async () => {
  for (const user of ['u1', 'u2']) {
    const a = (await before(user)).slice(0, 60);
    const b = (await summary(user)).slice(0, 60);
    const strip = (x) => { const { generatedAt, ...rest } = x; return rest; };
    const ia = computePrepOSInsights(a, { now: NOW, subjectNames: SUBJECT_NAMES });
    const ib = computePrepOSInsights(b, { now: NOW, subjectNames: SUBJECT_NAMES });
    assert.deepEqual(strip(ib), strip(ia), user);
    assert.deepEqual(compassProjection(b, { subjectNames: SUBJECT_NAMES, rankedChapters: ib.chapters?.ranked || [] }), compassProjection(a, { subjectNames: SUBJECT_NAMES, rankedChapters: ia.chapters?.ranked || [] }));
    assert.deepEqual(buildStanding({ attempts: b, colleges: [], ranked: ib.chapters?.ranked || [], subjectNames: SUBJECT_NAMES }), buildStanding({ attempts: a, colleges: [], ranked: ia.chapters?.ranked || [], subjectNames: SUBJECT_NAMES }));
  }
  assert.ok(computePrepOSInsights(await summary('u1'), { now: NOW }).chapters.ranked.length > 0);
});

test('A8: best marks and the badge record are identical from the summary rows', async () => {
  for (const user of ['u1', 'u2', 'u3']) {
    const a = await before(user);
    const b = await summary(user);
    assert.deepEqual(computeBests(b), computeBests(a), user);
    assert.deepEqual(buildStudyRecord(b, computeBests(b)), buildStudyRecord(a, computeBests(a)), user);
  }
  assert.ok(computeBests(await summary('u1')).length > 0);
});

test('A8: analytics reads the same inputs from the summary rows (marks, details, chapter and id of each question, scoring version)', async () => {
  const used = (a) => ({ subject: a.subject, score: a.score, correct: a.correct, wrong: a.wrong, unattempted: a.unattempted, total: a.total, completedAt: a.completedAt, details: a.details,
    scoringVersion: a.selectionMeta.scoringVersion, snapshot: a.questionsSnapshot.map((q) => ({ id: q.id, chapter: q.chapter })) });
  for (const user of ['u1', 'u2', 'u3']) assert.deepEqual((await summary(user)).map(used), (await before(user)).map(used), user);
});

// ---- A3 / A4: the history profile --------------------------------------------------------------------------------------
const reservationsFor = (attempts, userId) => {
  const rows = [];
  for (const a of attempts) {
    for (const d of a.details) {
      if (d.isCorrect !== false || rows.length >= 12) continue;
      rows.push({ operation_key: `repair:${mistakeKey(userId, a.id, d.qid)}:req1`, updated_at: '2026-10-19T10:00:00Z',
        repair: { why_right: 'The right option follows the rule.', trap: 'A look-alike option.', why_wrong: 'It reverses the entries.', rule: `Check the side of the entry first (${rows.length % 3}).`, memory_hook: 'Debit the receiver.' } });
    }
  }
  return rows;
};
function fakeRulesDb(reservations, playbook = []) {
  const builder = (data) => { const b = { select: () => b, eq: () => b, not: () => b, like: () => b, order: () => b, limit: () => b, then: (res, rej) => Promise.resolve({ data, error: null }).then(res, rej) }; return b; };
  return { from: (t) => builder(t === 'ai_credit_reservations' ? reservations : playbook) };
}
const atlasFor = (attempts) => indexAtlas(attempts.flatMap((a) => a.questionsSnapshot.map((q) => ({ qid: q.id, option_hash: optionHash(q.options[(q.correctIndex + 1) % 4]), trap_type: 'extreme_word', repairs_agreeing: 1, repairs_disagreeing: 0 }))));

test('A3: the result page history (recap, missed before, ledger, insights, lab, rules, traps, SWOT) is identical from the history rows', async () => {
  const all = await before('u1');
  const slim = await lean('u1', 'history');
  const reviews = (attempt) => Object.fromEntries(attempt.details.map((d, i) => [d.qid, { state: i % 11 === 10 ? 'held' : 'ready', given: d.givenIndex, key: attempt.questionsSnapshot[i].correctIndex }]));
  let compared = 0;
  for (const target of [all[0], all[1], all[5], all.at(-1)]) {
    const reservations = reservationsFor(all, 'u1');
    const run = (rows) => resultHistory({
      attempt: target, answerReviews: reviews(target), answerReviewState: 'ready', loadAttempts: async () => rows, recapOf: buildRecap, missedBeforeOf: buildMissedBefore,
      cohortOf: null, labLoop: true, ruleSourcesOf: ({ allAttempts }) => loadRuleSources('u1', allAttempts, { db: fakeRulesDb(reservations) }),
      labSlice4: { atlasOf: async ({ attempt }) => atlasFor([attempt]), cardsOf: async () => null }, swotEnabled: true, now: NOW, warn: (part, e) => { throw new Error(`${part} failed: ${e?.message}`); },
    });
    const a = await run(all);
    const b = await run(slim);
    assert.deepEqual(b, a, `result of ${target.id}`);
    compared += 1;
    assert.ok(a.recap && a.lab && a.swot, 'the parts under test are really built');
  }
  assert.equal(compared, 4);
  assert.deepEqual(sourceLabel(slim, all[0]), sourceLabel(all, all[0]));
});

test('A4: the Rule book, the playbook, the rules page and Traps you meet are identical from the history rows', async () => {
  for (const user of ['u1', 'u2']) {
    const all = (await before(user)).filter((a) => !a.selectionMeta.mobPaper);
    const slim = (await lean(user, 'history')).filter((a) => !a.selectionMeta.mobPaper);
    const reservations = reservationsFor(all, user);
    const sources = async (rows) => loadRuleSources(user, rows, { db: fakeRulesDb(reservations) });
    const [sa, sb] = [await sources(all), await sources(slim)];
    assert.deepEqual(sb, sa, 'repairs and playbook sources');
    assert.ok(sa.repairs.length > 0);
    assert.deepEqual(rulesBody({ attempts: slim, sources: sb }), rulesBody({ attempts: all, sources: sa }));
    for (const subject of [undefined, 'economics', 'accountancy']) assert.deepEqual(playbookBody({ attempts: slim, sources: sb, subject }), playbookBody({ attempts: all, sources: sa, subject }));
    assert.deepEqual((await readRuleBook(user, slim, { db: fakeRulesDb(reservations) })).book, (await readRuleBook(user, all, { db: fakeRulesDb(reservations) })).book);
    const atlas = atlasFor(all);
    assert.deepEqual(buildTrapsMeet({ attempts: slim, atlas, skip: null }), buildTrapsMeet({ attempts: all, atlas, skip: null }));
    assert.deepEqual(repairRulesFrom({ userId: user, reservations, attempts: slim }), repairRulesFrom({ userId: user, reservations, attempts: all }));
  }
  const rows = (await before('u1')).filter((a) => !a.selectionMeta.mobPaper);
  assert.ok(buildTrapsMeet({ attempts: rows, atlas: atlasFor(rows) }).rows?.length > 0, 'the fixture really meets traps');
});

test('A5 chat: Mobi record answers (insights, standing) are identical from the history rows, and the tonight pack inputs too', async () => {
  const a = (await before('u1')).slice(0, 60);
  const b = (await lean('u1', 'history')).slice(0, 60);
  const strip = (x) => { const { generatedAt, ...rest } = x; return rest; };
  const ia = computePrepOSInsights(a, { now: NOW, subjectNames: SUBJECT_NAMES });
  assert.deepEqual(strip(computePrepOSInsights(b, { now: NOW, subjectNames: SUBJECT_NAMES })), strip(ia));
  assert.ok(ia.chapters.ranked.length > 0);
  assert.deepEqual(buildStanding({ attempts: b, colleges: [], ranked: ia.chapters.ranked, subjectNames: SUBJECT_NAMES }), buildStanding({ attempts: a, colleges: [], ranked: ia.chapters.ranked, subjectNames: SUBJECT_NAMES }));
});

test('A4/A5 chat: the held Mob paper keeps its tag in the history profile, so openAttemptsOnly still holds it', async () => {
  const { openAttemptsOnly } = await import('../../src/lib/mob/paperHold.mjs');
  const now = Date.UTC(2026, 9, 20, 10);
  const a = await before('u1');
  const b = await lean('u1', 'history');
  assert.ok(a.some((x) => x.selectionMeta.mobPaper), 'fixture has a held paper');
  assert.deepEqual(openAttemptsOnly(b, now).map((x) => x.id), openAttemptsOnly(a, now).map((x) => x.id));
  assert.equal(openAttemptsOnly(b, now).length, a.length - 1);
  const p = await lean('u1', 'plan');
  assert.equal(openAttemptsOnly(p, now).length, a.length - 1, 'and in the plan profile');
  // the summary function drops the tag: that is why the summary rows are never filtered through openAttemptsOnly
  assert.equal(openAttemptsOnly(await summary('u1'), now).length, a.length);
});

// ---- the read path: slim option, fallbacks, memo -----------------------------------------------------------------------
test('slim read: calls the function, pages like the table read, and maps like the table rows', async () => {
  resetSlimState();
  const db = pgSupabase(pg);
  const rows = await readAttemptRows(db, 'u1', { slim: 'plan' });
  assert.deepEqual(db.calls.map((c) => [c.kind, c.fn, c.args?.p_profile]), [['rpc', 'attempts_lean', 'plan']]);
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.map(attemptOut).map((a) => a.id), (await before('u1')).map((a) => a.id));
  const limited = await readAttemptRows(pgSupabase(pg), 'u1', { slim: 'history', limit: 5 });
  assert.deepEqual(limited.map((r) => r.id), (await before('u1')).slice(0, 5).map((a) => a.id));
  const viaSummary = pgSupabase(pg);
  await readAttemptRows(viaSummary, 'u1', { slim: 'summary', limit: 60 });
  assert.deepEqual(viaSummary.calls.map((c) => [c.kind, c.fn]), [['rpc', 'attempts_list_summary']]);
  assert.deepEqual(viaSummary.calls[0].args, { p_user_id: 'u1' });
  assert.equal(await readAttemptRows(pgSupabase(pg), 'nobody', { slim: 'plan' }).then((r) => r.length), 0);
});

test('slim read: a missing function falls back to the table read once and is not asked again for five minutes', async () => {
  resetSlimState();
  let t = 1_000_000;
  const now = () => t;
  for (const code of ['PGRST202', '42883']) {
    resetSlimState();
    const db = pgSupabase(pg, { failFn: { attempts_lean: { code, message: 'function not found' } } });
    const first = await readAttemptRows(db, 'u1', { slim: 'plan', now });
    assert.equal(first.length, 14);
    assert.deepEqual(db.calls.map((c) => c.kind), ['rpc', 'table'], 'asked once, then the table');
    await readAttemptRows(db, 'u1', { slim: 'plan', now });
    assert.deepEqual(db.calls.map((c) => c.kind), ['rpc', 'table', 'table'], 'not asked again inside five minutes');
    t += 5 * 60 * 1000 + 1;
    await readAttemptRows(db, 'u1', { slim: 'plan', now });
    assert.deepEqual(db.calls.slice(3).map((c) => c.kind), ['rpc', 'table'], 'asked again after five minutes');
    // the fallback is the old read: same rows as no slim at all
    assert.deepEqual(first, await readAttemptRows(pgSupabase(pg), 'u1'));
  }
});

test('slim read: any other error, a statement timeout above all, is thrown and never answered with the heavy read', async () => {
  resetSlimState();
  for (const error of [{ code: '57014', message: 'canceling statement due to statement timeout' }, { code: '22023', message: 'unknown profile' }, { code: 'XX000', message: 'boom' }]) {
    const db = pgSupabase(pg, { failFn: { attempts_lean: error } });
    await assert.rejects(readAttemptRows(db, 'u1', { slim: 'history' }), (e) => e.code === error.code);
    assert.deepEqual(db.calls.map((c) => c.kind), ['rpc'], `${error.code}: no table read`);
  }
  await assert.rejects(readAttemptRows(pgSupabase(pg), 'u1', { slim: 'everything' }), /attempt_slim_unknown/);
});

test('memo: a slim read never shares an entry with a full read or with another profile', async () => {
  const keys = [attemptMemoKey('u1'), attemptMemoKey('u1', { slim: 'plan' }), attemptMemoKey('u1', { slim: 'history' }), attemptMemoKey('u1', { slim: 'summary' }), attemptMemoKey('u1', { slim: 'plan', limit: 60 }), attemptMemoKey('u2', { slim: 'plan' })];
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(attemptMemoKey('u1', { limit: 60 }), 'u1|*|60', 'the old keys are unchanged');
  const db = pgSupabase(pg);
  const memo = new Map();
  const load = (options) => memoisedAttempts(memo, attemptMemoKey('u1', options), async () => (await readAttemptRows(db, 'u1', options)).map(attemptOut));
  const [fullRows, planRows] = [await load({}), await load({ slim: 'plan' })];
  assert.ok(bytes(planRows) < bytes(fullRows) * 0.1);
  await load({ slim: 'plan' });
  await load({});
  assert.equal(db.calls.length, 2, 'one read per shape');
});

test('sites: each narrowed route asks for the profile its builders were proved on', () => {
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const expect = [
    ['src/lib/server/learning.js', /getAttempts\(userId, \{ memo, slim: 'plan' \}\)/],
    ['src/app/api/prepos/insights/route.js', /limit: 60, slim: 'summary'/],
    ['src/app/api/compass/pro/route.js', /limit: 60, slim: 'summary'/],
    ['src/services/mobi/standing.js', /limit: 60, slim: 'summary'/],
    ['src/app/api/me/bests/route.js', /getAttempts\(session\.user\.id, \{ slim: 'summary' \}\)/],
    ['src/app/api/me/study-record/route.js', /getAttempts\(session\.user\.id, \{ slim: 'summary' \}\)/],
    ['src/app/api/analytics/route.js', /getAttempts\(userId, \{ slim: 'summary' \}\)/],
    ['src/app/api/ai/mentor/chat/route.js', /limit: 60, slim: 'history'/],
    ['src/app/api/me/rules/route.js', /slim: 'history'/],
    ['src/app/api/me/playbook/route.js', /getAttempts\(session\.user\.id, \{ slim: 'history' \}\)/],
    ['src/app/api/me/playbook/route.js', /getAttempts\(userId, \{ slim: 'history' \}\)/],
    ['src/app/api/me/traps/route.js', /slim: 'history'/],
    ['src/app/api/attempts/[id]/route.js', /loadAttempts: \(\) => Database\.getAttempts\(session\.user\.id, \{ memo, slim: 'history' \}\)/],
  ];
  for (const [file, pattern] of expect) assert.match(src(file), pattern, file);
  // the paper on screen is still read whole, and the default list response is untouched
  assert.match(src('src/app/api/attempts/[id]/route.js'), /Database\.getAttemptById\(id\)/);
  assert.match(src('src/app/api/attempts/route.js'), /const attempts = await Database\.getAttempts\(session\.user\.id\);/);
  assert.match(src('data/db.js'), /async getAttempts\(userId, \{ columns, limit, memo, slim \} = \{\}\)/);
  // 41 snapshot keys: the fixtures carry every one of them
  assert.equal(SNAPSHOT_KEYS.length, 41);
});

// ---- A8: the website's Start page and Profile ------------------------------------------------------------------------
test('A8: the Start page reads the same things from ?view=summary as from the full list', async () => {
  for (const user of ['u1', 'u2', 'u3']) {
    const rows = await before(user);
    const full = rows.map((a) => attemptForClient(a));
    // the route replaces the summary row of a held Mob paper by its marks-only view (readHeldMobPapersSafe), as the full path does
    const slim = (await callFunction(pg, 'attempts_list_summary', { p_user_id: user })).map(summaryAttempt).map((r, i) => (attemptHold(rows[i]) ? heldAttemptView(r, attemptHold(rows[i])) : r));
    const page = (list) => ({
      avg: list.length ? Math.round(list.reduce((sum, a) => sum + a.score, 0) / list.length) : 0,
      fullMocks: fullMocksIn(list),
      recent: list.slice(0, 5).map((a) => ({ id: a.id, subject: a.subject, score: a.score, correct: a.correct, total: a.total, completedAt: a.completedAt })),
      misses: list.map(missesOf),
      repairs: ['accountancy', 'economics'].map((subjectId) => repairsFor({ attempts: list, repairs: [{ attemptId: list[0]?.id, questionId: list[0]?.details?.[0]?.qid, subject: list[0]?.subject, repairedAt: 1 }], subjectId })),
      count: list.length,
    });
    assert.deepEqual(page(slim), page(full), user);
  }
  assert.ok(fullMocksIn((await before('u1'))) > 0);
});

test('A8: ?view=marks gives the Profile its count and average from about 100 bytes a paper', async () => {
  const db = pgSupabase(pg);
  const rows = (await readAttemptRows(db, 'u1', { columns: ['id', 'score', 'completed_at'] })).map(attemptOut);
  const marks = rows.map(marksItem);
  assert.deepEqual(mocksSummary(marks), mocksSummary(await before('u1')));
  assert.deepEqual(marks[0], { id: (await before('u1'))[0].id, score: (await before('u1'))[0].score, completedAt: (await before('u1'))[0].completedAt });
  assert.ok(db.calls[0].bytes / rows.length < 130, `${db.calls[0].bytes / rows.length} B a paper`);
  assert.ok(db.calls[0].bytes < bytes(await tableRows(pg, 'u1')) * 0.01);
  assert.equal(db.calls[0].select, 'id,score,completed_at');
  assert.equal(isMarksView({ url: 'https://x.test/api/attempts?view=marks' }), true);
  assert.equal(isMarksView({ url: 'https://x.test/api/attempts?view=summary' }), false);
  assert.equal(isMarksView({ url: 'https://x.test/api/attempts' }), false);
  assert.equal(isSummaryView({ url: 'https://x.test/api/attempts?view=summary' }), true);
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(src('src/app/(app)/dashboard/DashboardPageClient.jsx'), /apiGet\('\/api\/attempts\?view=summary'\)/);
  assert.match(src('src/app/(app)/profile/ProfilePageClient.jsx'), /apiGet\('\/api\/attempts\?view=marks'\)/);
  assert.doesNotMatch(src('src/app/(app)/dashboard/DashboardPageClient.jsx') + src('src/app/(app)/profile/ProfilePageClient.jsx'), /api\/attempts\?userId/);
  // the default list is unchanged for older clients
  assert.match(src('src/app/api/attempts/route.js'), /return NextResponse\.json\(attempts\.map\(\(a\) => attemptForClient\(a\)\)\);/);
});

// ---- A6 / A7: Review, the repair record and the credits history -------------------------------------------------------------
test('A6: the Review record is identical when the papers come from the review function, from the summary function, or from the table', async () => {
  const run = async (options) => { resetSlimState(); const db = reviewDb(pg, options); return { record: await loadReviewRecord('u1', { db, now: NOW }), db }; };
  const table = await run({ withRpc: false });
  const viaLean = await run({});
  const viaSummary = await run({ failFn: { attempts_lean: { code: 'PGRST202', message: 'not found' } } });
  assert.ok(table.record.items.length > 5, 'the fixture has mistakes to show');
  assert.deepEqual(viaLean.record, table.record);
  assert.deepEqual(viaSummary.record, table.record);
  const heavyCalls = (db) => db.calls.filter((c) => (c.kind === 'table' && c.select.includes('questions_snapshot')) || c.kind === 'rpc');
  assert.deepEqual(heavyCalls(viaLean.db).map((c) => [c.kind, c.fn, c.args.p_profile, c.args.p_ids.length > 0]), [['rpc', 'attempts_lean', 'review', true]], 'ONE call for all the papers with a miss');
  assert.deepEqual(heavyCalls(viaSummary.db).map((c) => [c.kind, c.fn]), [['rpc', 'attempts_lean'], ['rpc', 'attempts_list_summary']], 'the summary function when the lean one is not there');
  const bytesOf = (db) => heavyCalls(db).reduce((n, c) => n + (c.bytes || 0), 0);
  assert.ok(bytesOf(viaLean.db) < bytesOf(table.db) * 0.1, `${bytesOf(viaLean.db)} vs ${bytesOf(table.db)}`);
  assert.ok(bytesOf(viaSummary.db) < bytesOf(table.db) * 0.35);
  assert.ok(!viaLean.record.items.some((i) => i.paper === 'a-1-003'), 'a held Mob paper is read by neither');
});

test('A6: a failure of the review function that is not "missing" fails the record, never a heavy table read', async () => {
  resetSlimState();
  const db = reviewDb(pg, { failFn: { attempts_lean: { code: '57014', message: 'canceling statement due to statement timeout' } } });
  await assert.rejects(loadReviewRecord('u1', { db, now: NOW }), (e) => e.code === 'REVIEW_ATTEMPTS_UNAVAILABLE');
  assert.ok(!db.calls.some((c) => c.kind === 'table' && c.select.includes('questions_snapshot')));
});

test('A7: the repair record and the credits repair names are identical from the review function', async () => {
  const userId = 'u1';
  const all = await tableRows(pg, userId);
  const lean = await callFunction(pg, 'attempts_lean', { p_user_id: userId, p_profile: 'review' });
  const summary = await callFunction(pg, 'attempts_list_summary', { p_user_id: userId });
  const reservations = reservationsFor(await before(userId), userId).map((r) => ({ operation_key: r.operation_key, updated_at: r.updated_at, receipt: { repair: r.repair, check: { right: true, answeredAt: '2026-10-19T12:00:00Z' } } }));
  const a = buildRepairRecord({ userId, reservations, attempts: all.slice(0, 300), limit: 50 });
  assert.ok(a.length > 3);
  assert.deepEqual(buildRepairRecord({ userId, reservations, attempts: lean.slice(0, 300), limit: 50 }), a);
  assert.deepEqual(buildRepairRecord({ userId, reservations, attempts: summary.slice(0, 300), limit: 50 }), a);
  const { repairDetails } = await import('../../src/lib/server/credits.js');
  const ids = new Set(reservations.map((r) => /^repair:([0-9a-f]{24}):/.exec(r.operation_key)[1]));
  const d = repairDetails({ userId, ids, attempts: all.slice(0, 300) });
  assert.ok(d.size > 3);
  assert.deepEqual(repairDetails({ userId, ids, attempts: lean.slice(0, 300) }), d);
  assert.deepEqual(repairDetails({ userId, ids, attempts: summary.slice(0, 300) }), d);
  const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  assert.match(src('src/lib/server/repairRecord.js'), /readSlimRows\(db, userId, 'review', \{ limit: ATTEMPT_WINDOW \}\)/);
  assert.match(src('src/lib/server/credits.js'), /readSlimRows\(client, userId, 'review', \{ limit: REPAIR_WINDOW \}\)/);
});
