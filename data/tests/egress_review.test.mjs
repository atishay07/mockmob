import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { attemptMemoKey, attemptMemoKeyFor, attemptMemoTake, memoisedAttempts, readAttemptRows, resetSlimState } from '../attempt_reads.js';
import { readAttemptQuestionIds, readExposedIds, resetAttemptQuestionIdsState } from '../attempt_question_ids.js';
import { replayExposures } from '../mistake_replay.js';
import { evidenceVerdicts, createVerdictCache, verdictCacheFor, VERDICT_CACHE_MAX } from '../evidence_verdicts.js';
import { currentEvidenceHashes } from '../question_reads.js';
import { createQuestionRowCache, questionRowCacheFor, QUESTION_ROW_CACHE_MAX_BYTES } from '../question_row_cache.js';
import { excludeHeldFamilies } from '../evidence_holds.js';
import { eligibilitySnapshot, publicationEligibility } from '../evidence_registry.js';
import { INVENTORY_COLUMNS } from '../inventory_count.js';
import { formatIdFor } from '../../src/lib/server/attemptSummary.js';
import { learningPlan } from '../learning_engine.js';
import { tonightCompletion, studyMilestones } from '../study_progress.js';
import { weakConcepts, weakChapters } from '../learning_weak.js';
import { computePrepOSInsights } from '../prepos_insights.js';
import { compassProjection } from '../compass_projection.js';
import { computeBests } from '../../src/lib/server/recap.js';
import { buildStudyRecord } from '../../src/lib/studyBadges.js';
import { sourceLabels } from '../../src/components/recovery/repairRun.js';
import { improvementEvidence } from '../recovery.js';
import { openAttemptsOnly } from '../../src/lib/server/answerHold.js';
import { richAttemptRows, leanDatabase, callFunction, tableRows, pgSupabase } from './helpers/lean_fixtures.mjs';
import { SECRET, buildBank, bytesOf, fakeDb, managedRows, rng, setFixtureSecret } from './helpers/egress_fixtures.mjs';

// Review of the egress branch (20 Oct 2026): the Recovery record's two big reads, the insights profile, one read per Ask Mobi message,
// the recovery-path exposure reads, the byte-bounded row cache and the inventory digest function. The database functions run for real in
// PGlite from the migrations; each consumer is run on the rows of the table (the "before") and on the rows of the function (the "after").
const restore = setFixtureSecret();
after(restore);

// The mapper of data/db.js (attemptOut), copied; egress_attempts.test.mjs pins the copy to the file.
const attemptOut = (r) => r && ({
  id: r.id, userId: r.user_id, subject: r.subject, score: r.score, correct: r.correct, wrong: r.wrong, unattempted: r.unattempted, total: r.total,
  details: r.details || [], questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {},
  mode: (r.selection_meta && r.selection_meta.mode) || null,
  formatId: formatIdFor({ subject: r.subject, total: r.total, questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {} }),
  completedAt: new Date(r.completed_at).getTime(),
});
const NOW = Date.UTC(2026, 9, 20, 10, 0, 0);
const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const bytes = (v) => JSON.stringify(v).length;

const ROWS = [...richAttemptRows(1, 'u1', 14, { mobPaperOn: [3] }), ...richAttemptRows(2, 'u2', 3), ...richAttemptRows(3, 'u3', 1)];
let pg;
test.before(async () => {
  pg = await leanDatabase(ROWS);
  await pg.exec(read('supabase/migrations/20261020150100_attempt_question_ids_fn.sql'));
});
test.after(async () => { await pg.close(); });

const before = async (user) => (await tableRows(pg, user)).map(attemptOut);
const lean = async (user, profile) => (await callFunction(pg, 'attempts_lean', { p_user_id: user, p_profile: profile })).map(attemptOut);
const subset = (small, big, label) => {
  // every key of `small` is in `big` with the same value: a consumer of the smaller profile cannot tell the bigger one by what it reads
  assert.equal(small.length, big.length, `${label}: count`);
  small.forEach((a, i) => {
    assert.deepEqual(a.details, big[i].details, `${label}: details`);
    for (const [key, value] of Object.entries(a.selectionMeta)) assert.deepEqual(big[i].selectionMeta[key], value, `${label}: meta ${key}`);
    a.questionsSnapshot.forEach((q, k) => { for (const [key, value] of Object.entries(q)) assert.deepEqual(big[i].questionsSnapshot[k][key], value, `${label}: ${key}`); });
  });
};

// ---- problem 3: the 'insights' profile ----------------------------------------------------------------------------------------------
test('insights: exactly the question keys the six routes read, the history meta, details whole; far smaller than summary', async () => {
  for (const user of ['u1', 'u2', 'u3', 'nobody']) {
    const full = await tableRows(pg, user);
    const rows = await callFunction(pg, 'attempts_lean', { p_user_id: user, p_profile: 'insights' });
    assert.deepEqual(rows.map((r) => r.id), full.map((r) => r.id), 'order');
    rows.forEach((r, i) => {
      assert.deepEqual(r.details, full[i].details);
      assert.deepEqual(r.questions_snapshot.map((q) => q.id), full[i].questions_snapshot.map((q) => q.id), 'positions and count');
      for (const q of r.questions_snapshot) assert.deepEqual(Object.keys(q).sort(), ['chapter', 'conceptId', 'difficulty', 'familyId', 'id', 'internalSubject', 'subject']);
      assert.deepEqual(Object.keys(r.selection_meta).sort(), Object.keys(full[i].selection_meta).filter((k) => ['mode', 'sessionId', 'scoringVersion', 'durationMinutes', 'tonight', 'mobPaper', 'contentEvidence', 'learningPurpose', 'recovery'].includes(k)).sort());
    });
  }
  const full = bytes(await tableRows(pg, 'u1'));
  const insights = bytes(await callFunction(pg, 'attempts_lean', { p_user_id: 'u1', p_profile: 'insights' }));
  const summary = bytes(await callFunction(pg, 'attempts_list_summary', { p_user_id: 'u1' }));
  const history = bytes(await callFunction(pg, 'attempts_lean', { p_user_id: 'u1', p_profile: 'history' }));
  assert.ok(insights < full * 0.1, `insights ${insights} vs full ${full}`);
  assert.ok(insights < summary * 0.5, `insights ${insights} vs summary ${summary}`);
  // The fixture's stems and options are short, so the gap to 'history' is smaller here (0.63 measured) than on a managed row, where the stem,
  // options and passage of every question are most of the row; the bar is what a fixture can show: clearly below history.
  assert.ok(insights < history * 0.75, `insights ${insights} vs history ${history}`);
});

test('insights: the profiles nest as the memo rule assumes (plan in record, insights, history; record and insights in history)', async () => {
  for (const user of ['u1', 'u2', 'u3']) {
    const [plan, record, insights, history] = [await lean(user, 'plan'), await lean(user, 'record'), await lean(user, 'insights'), await lean(user, 'history')];
    subset(plan, record, `${user} plan in record`);
    subset(plan, insights, `${user} plan in insights`);
    subset(plan, history, `${user} plan in history`);
    subset(record, history, `${user} record in history`);
    subset(insights, history, `${user} insights in history`);
  }
});

test('insights: Insights, Compass, bests, the study record, analytics and the standing builders are identical from the insights rows', async () => {
  for (const user of ['u1', 'u2', 'u3', 'nobody']) {
    const a = await before(user);
    const b = await lean(user, 'insights');
    for (const options of [{}, { limit: 60 }]) {
      const slice = (rows) => (options.limit ? rows.slice(0, options.limit) : rows);
      assert.deepEqual(computePrepOSInsights(slice(b), { now: NOW }), computePrepOSInsights(slice(a), { now: NOW }), `${user} prepos insights`);
      const insights = computePrepOSInsights(slice(a), { now: NOW });
      assert.deepEqual(compassProjection(slice(b), { rankedChapters: insights.chapters?.ranked || [] }), compassProjection(slice(a), { rankedChapters: insights.chapters?.ranked || [] }), `${user} compass`);
    }
    assert.deepEqual(computeBests(b), computeBests(a), `${user} bests`);
    assert.deepEqual(buildStudyRecord(b, computeBests(b)), buildStudyRecord(a, computeBests(a)), `${user} study record`);
    // analytics: the chapter accuracy and the subject totals read id, chapter, details, subject, score, correct, total, scoring version
    const chapters = (rows) => rows.flatMap((x) => x.questionsSnapshot.map((q) => [x.subject, q.chapter, q.id, x.details.find((d) => d.qid === q.id)?.isCorrect === true]));
    assert.deepEqual(chapters(b), chapters(a), `${user} analytics chapters`);
    assert.deepEqual(b.map((x) => [x.id, x.subject, x.score, x.correct, x.total, x.selectionMeta.scoringVersion, x.formatId, x.completedAt]), a.map((x) => [x.id, x.subject, x.score, x.correct, x.total, x.selectionMeta.scoringVersion, x.formatId, x.completedAt]));
  }
});

test('insights: the routes ask for it, with the summary function as the only fallback and never as a source of the plan', () => {
  for (const file of ['src/app/api/prepos/insights/route.js', 'src/app/api/compass/pro/route.js', 'src/services/mobi/standing.js', 'src/app/api/me/bests/route.js', 'src/app/api/me/study-record/route.js', 'src/app/api/analytics/route.js']) {
    const src = read(file);
    assert.match(src, /slim: 'insights'/, file);
    assert.doesNotMatch(src, /slim: 'summary'/, file);
  }
  const reads = read('data/attempt_reads.js');
  assert.match(reads, /insights: Object\.freeze\(\[lean\('insights'\), listSummary\]\)/);
  assert.match(reads, /insights_strict: Object\.freeze\(\[lean\('insights'\)\]\)/);
  assert.match(reads, /record: Object\.freeze\(\[lean\('record'\)\]\)/);
  // the summary function lacks conceptId and familyId, so no profile that needs them may be served from an 'insights' read
  const { SLIM_SUPERSETS } = { SLIM_SUPERSETS: null };
  assert.equal(SLIM_SUPERSETS, null);
  const supersets = reads.slice(reads.indexOf('export const SLIM_SUPERSETS'), reads.indexOf('const memoPrefix'));
  assert.ok(!/'insights'\]|'insights',/.test(supersets.replace("insights: Object.freeze(['insights_strict'", '')), 'no profile lists the stopgap profile as a supplier');
});

// ---- problem 4: one read per Ask Mobi message ---------------------------------------------------------------------------------------
const getAttempts = (db, memo, userId, options = {}) => {
  const key = attemptMemoKeyFor(memo, userId, options);
  return memoisedAttempts(memo, key, async () => (await readAttemptRows(db, userId, options)).map(attemptOut), { take: attemptMemoTake(key, { userId, ...options }) });
};
const heavy = (db) => db.calls.filter((c) => c.kind === 'rpc' || c.kind === 'table');

test('memo: a profile whose keys are a subset reuses the bigger read, and a whole list serves its newest N', async () => {
  resetSlimState();
  const db = pgSupabase(pg);
  const memo = new Map();
  const strict = await getAttempts(db, memo, 'u1', { slim: 'insights_strict' });
  assert.equal(strict.length, 14);
  const plan = await getAttempts(db, memo, 'u1', { slim: 'plan' });
  const newest = await getAttempts(db, memo, 'u1', { slim: 'insights_strict', limit: 5 });
  const planNewest = await getAttempts(db, memo, 'u1', { slim: 'plan', limit: 3 });
  assert.equal(heavy(db).length, 1, 'one database read for four asks');
  assert.deepEqual(newest.map((a) => a.id), strict.slice(0, 5).map((a) => a.id));
  assert.deepEqual(planNewest.map((a) => a.id), strict.slice(0, 3).map((a) => a.id));
  assert.deepEqual(plan.map((a) => a.id), strict.map((a) => a.id));
  // the plan builders give the same answer from the bigger rows (the plan profile is a subset of them)
  const exact = await lean('u1', 'plan');
  const concepts = [...new Set(exact.flatMap((x) => x.questionsSnapshot.map((q) => q.conceptId)))];
  const planOf = (attempts) => learningPlan({ episodes: [], activeSession: null, attempts, subject: 'economics', minutes: 25, now: NOW, availableConcepts: concepts });
  assert.deepEqual(planOf(plan), planOf(exact));
  assert.deepEqual(tonightCompletion(plan), tonightCompletion(exact));
  assert.deepEqual(studyMilestones(plan, []), studyMilestones(exact, []));
  assert.deepEqual(weakConcepts(plan), weakConcepts(exact));
  assert.deepEqual(weakChapters(plan), weakChapters(exact));
  // the copies are the caller's own
  plan[0].subject = 'changed';
  assert.notEqual((await getAttempts(db, memo, 'u1', { slim: 'plan' }))[0].subject, 'changed');
});

test('memo: nothing is served from a smaller list, another student, the stopgap profile or a profile that is not a superset', async () => {
  resetSlimState();
  const db = pgSupabase(pg);
  const memo = new Map();
  await getAttempts(db, memo, 'u1', { slim: 'insights_strict', limit: 5 });
  await getAttempts(db, memo, 'u1', { slim: 'plan', limit: 9 });
  assert.equal(heavy(db).length, 2, 'five rows cannot serve nine');
  await getAttempts(db, memo, 'u1', { slim: 'plan' });
  assert.equal(heavy(db).length, 3, 'five or nine rows cannot serve the whole list');
  await getAttempts(db, memo, 'u2', { slim: 'plan' });
  assert.equal(heavy(db).length, 4, 'another student');
  await getAttempts(db, memo, 'u1', { slim: 'history' });
  assert.equal(heavy(db).length, 5, 'a bigger profile is never served from a smaller one');
  await getAttempts(db, memo, 'u1', { slim: 'record' });
  await getAttempts(db, memo, 'u1', { slim: 'insights', limit: 4 });
  assert.equal(heavy(db).length, 5, 'record and insights come from the history read');
  // 'insights' may have been read through the summary function, which lacks the concept keys: a plan is never served from it
  const stopgap = new Map();
  const dbStop = pgSupabase(pg, { failFn: { attempts_lean: { code: 'PGRST202', message: 'missing' } } });
  const viaSummary = await getAttempts(dbStop, stopgap, 'u1', { slim: 'insights' });
  assert.ok(viaSummary.length && viaSummary[0].questionsSnapshot.every((q) => !('conceptId' in q)), 'the summary function carries no conceptId');
  const fresh = pgSupabase(pg);
  await getAttempts(fresh, stopgap, 'u1', { slim: 'plan' });
  assert.equal(heavy(fresh).length, 1, 'the plan reads its own rows');
  assert.equal(attemptMemoKeyFor(stopgap, 'u1', { slim: 'plan' }), attemptMemoKey('u1', { slim: 'plan' }) , 'the plan key is its own once read');
  // the old rules stay: the keys of the old shapes are unchanged, and a full read in the memo still serves a slim one
  assert.equal(attemptMemoKey('u1', { limit: 60 }), 'u1|*|60');
  assert.equal(attemptMemoKey('u1', { slim: 'plan', limit: 60 }), 'u1|*|60|slim:plan');
  const full = new Map([[attemptMemoKey('u1'), Promise.resolve([])]]);
  assert.equal(attemptMemoKeyFor(full, 'u1', { slim: 'plan' }), attemptMemoKey('u1'));
  assert.equal(attemptMemoTake(attemptMemoKey('u1'), { userId: 'u1', slim: 'plan' }), null);
  assert.equal(attemptMemoTake(attemptMemoKey('u1', { slim: 'plan' }), { userId: 'u1', slim: 'plan' }), null);
});

test('chat: one read of the attempts serves the record, the context and the plan; the free Tonight pack keeps the history profile', () => {
  const route = read('src/app/api/ai/mentor/chat/route.js');
  assert.match(route, /const attemptsMemo = new Map\(\);/);
  assert.match(route, /getAttempts\(userId, \{ slim: 'insights_strict', memo: attemptsMemo \}\)\)\.slice\(0, 60\)/);
  assert.match(route, /getAttempts\(userId, \{ limit: 60, slim: 'history', memo: attemptsMemo \}\)/, 'only the tonight path reads options and keys');
  assert.match(route, /attempts = openAttemptsOnly\(newest\);/, 'the newest 60 are cut before the hold filter, as the limit always did');
  assert.match(route, /getStudentAIContext\(\{ user: dbUser, options: \{ memo: attemptsMemo \} \}\)/);
  assert.doesNotMatch(route, /limit: 60, slim: 'history'\)\)/, 'the separate second read is gone');
  const context = read('src/services/ai/getStudentAIContext.js');
  assert.match(context, /options\.memo instanceof Map \? options\.memo : new Map\(\)/);
  assert.match(context, /getAttempts\(userId, \{ memo: attemptsMemo, slim: 'insights_strict' \}\)/);
  assert.doesNotMatch(context, /Database\.getAttempts\(userId, \{ memo: attemptsMemo \}\)/);
  // standing reads the same rows (a chapter and a difficulty), learningRecord its plan from the memo
  assert.match(read('src/lib/server/learning.js'), /getAttempts\(userId, \{ memo, slim: 'plan' \}\)/);
});

test('chat: a message that goes to the model reads the attempts once, whatever the history length', async () => {
  resetSlimState();
  const db = pgSupabase(pg);
  const memo = new Map();
  // the record (all, then the newest 60), the context (all) and the plan (all), as the route and getStudentAIContext now ask
  const record = (await getAttempts(db, memo, 'u1', { slim: 'insights_strict', memo })).slice(0, 60);
  const context = await getAttempts(db, memo, 'u1', { slim: 'insights_strict', memo });
  const plan = await getAttempts(db, memo, 'u1', { slim: 'plan', memo });
  assert.equal(heavy(db).length, 1);
  assert.equal(record.length, 14);
  assert.deepEqual(openAttemptsOnly(record.slice(0, 60), NOW).map((a) => a.id), openAttemptsOnly((await before('u1')).slice(0, 60), NOW).map((a) => a.id), 'the hold filter gives the same papers as the table rows');
  assert.equal(context.length, plan.length);
  const oldWay = bytes(await tableRows(pg, 'u1')) * 2 + bytes((await tableRows(pg, 'u1')).slice(0, 60));
  assert.ok(db.calls[0].bytes < oldWay * 0.05, `${db.calls[0].bytes} B against ${oldWay} B`);
});

// ---- problem 6: the recovery-path exposure reads --------------------------------------------------------------------------------------
test('exposures: the ids and families from the function equal those the whole-row read produced', async () => {
  for (const user of ['u1', 'u2', 'u3', 'nobody']) {
    resetAttemptQuestionIdsState();
    const db = pgSupabase(pg);
    const snapshots = (await before(user)).flatMap((a) => a.questionsSnapshot);
    const old = replayExposures([{ questionsSnapshot: snapshots }]);
    const seen = await readExposedIds(db, { userId: user, readSnapshots: async () => { throw new Error('the table must not be read'); } });
    assert.deepEqual(new Set(seen.questionIds), new Set(old.excludeQuestionIds), `${user} ids`);
    assert.deepEqual(new Set(seen.familyIds), new Set(old.excludeFamilyIds), `${user} families`);
    assert.equal(seen.questionIds.length, new Set(seen.questionIds).size, 'no repeats');
    const learning = { ids: snapshots.map((q) => q.id), families: snapshots.map((q) => q.familyId).filter(Boolean) };
    assert.deepEqual(new Set(seen.questionIds), new Set(learning.ids));
    assert.deepEqual(new Set(seen.familyIds), new Set(learning.families), 'on papers that store familyId (every fixture) the learning episode set is the same; the evidence fallback is tested in egress_ids.test.mjs');
  }
  resetAttemptQuestionIdsState();
  const full = bytes(await tableRows(pg, 'u1'));
  const db = pgSupabase(pg);
  await readExposedIds(db, { userId: 'u1', readSnapshots: async () => [] });
  assert.ok(db.calls[0].bytes < full * 0.05, `${db.calls[0].bytes} B against ${full} B`);
});

test('exposures: a long history is paged, a missing function reads the snapshots as before, any other error is thrown', async () => {
  resetAttemptQuestionIdsState();
  const calls = [];
  const rows = Array.from({ length: 2500 }, (_, i) => ({ attempt_id: `a${i}`, question_ids: [`q${i}`, `q${i % 50}`], family_ids: [`f${i % 40}`] }));
  const paged = {
    rpc(fn, args) {
      const state = { range: null };
      const q = { order() { return q; }, range(a, b) { state.range = [a, b]; calls.push([a, b]); return q; }, then(res, rej) { return Promise.resolve({ data: rows.slice(state.range?.[0] ?? 0, (state.range?.[1] ?? 999) + 1), error: null }).then(res, rej); } };
      return q;
    },
  };
  const seen = await readExposedIds(paged, { userId: 'u1', readSnapshots: async () => { throw new Error('no'); } });
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]], 'three pages, so a history over 1000 papers is not cut short');
  assert.equal(seen.questionIds.length, 2500, 'every id');
  assert.equal(seen.familyIds.length, 40);
  // the limit callers keep their single unpaged call
  calls.length = 0;
  await readAttemptQuestionIds(paged, { userId: 'u1', limit: 3 });
  assert.deepEqual(calls, []);
  // the function is not applied: the snapshots are read, with the family as the old code took it
  resetAttemptQuestionIdsState();
  const missing = { rpc: () => ({ order() { return this; }, range() { return this; }, then(res, rej) { return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'missing' } }).then(res, rej); } }) };
  let tableReads = 0;
  const fallback = await readExposedIds(missing, { userId: 'u1', readSnapshots: async () => { tableReads += 1; return [{ id: 'a', familyId: 'fa' }, { id: 'b', evidence: { record: { family_id: 'fb' } } }, { id: 'a', familyId: 'fa' }, null, {}]; } });
  assert.equal(tableReads, 1);
  assert.deepEqual(fallback, { questionIds: ['a', 'b'], familyIds: ['fa', 'fb'] });
  resetAttemptQuestionIdsState();
  const failing = { rpc: () => ({ order() { return this; }, range() { return this; }, then(res, rej) { return Promise.resolve({ data: null, error: { code: '57014', message: 'timeout' } }).then(res, rej); } }) };
  await assert.rejects(readExposedIds(failing, { userId: 'u1', readSnapshots: async () => { throw new Error('the heavy read must not follow a timeout'); } }), (e) => e.code === '57014');
  resetAttemptQuestionIdsState();
});

test('exposures: the four recovery-path reads no longer ship whole snapshots', () => {
  assert.match(read('src/lib/server/recoverySessions.js'), /Database\.getAttemptExposures\(userId\)/);
  assert.doesNotMatch(read('src/lib/server/recoverySessions.js'), /columns: \['questions_snapshot'\]/);
  assert.match(read('src/lib/server/learning.js'), /Database\.getAttemptExposures\(userId\)/);
  assert.doesNotMatch(read('src/lib/server/learning.js'), /columns: \['questions_snapshot'\]/);
  assert.match(read('src/app/api/recovery/replay/route.js'), /Database\.getAttemptExposures\(session\.user\.id\)/);
  assert.doesNotMatch(read('src/app/api/recovery/replay/route.js'), /columns: \['questions_snapshot'\]/);
  assert.match(read('src/services/recovery/mistakeRepair.js'), /openAttemptsOnly\(await Database\.getAttempts\(userId, \{ slim: 'history' \}\)\)/);
  assert.doesNotMatch(read('src/services/recovery/mistakeRepair.js'), /openAttemptsOnly\(await Database\.getAttempts\(userId\)\)/);
  assert.match(read('data/db.js'), /async getAttemptExposures\(userId\) \{/);
  // the repair's trap line reads the same rows, through the same builders, as GET /api/me/traps
  assert.match(read('src/app/api/me/traps/route.js'), /openAttemptsOnly\(await Database\.getAttempts\(session\.user\.id, \{ slim: 'history' \}\)\)/);
});

// ---- problem 1: the Recovery record -------------------------------------------------------------------------------------------------
const STAMP = (i) => `2026-09-01T00:00:00.${String(i % 1000).padStart(3, '0')}Z`;
function bank(count, { padding = 3000, seed = 11 } = {}) {
  const rand = rng(seed);
  return managedRows(rand, 1000, count, { padding }).map((row, i) => ({ ...row, updated_at: STAMP(i) }));
}
// The code of data/question_reads.js currentEvidenceHashes before this change (and of the route before it).
async function hashesBefore(db, questionIds, { chunk = 300 } = {}) {
  const hashes = new Map();
  for (let i = 0; i < questionIds.length; i += chunk) {
    const { data, error } = await db.from('questions').select('*').in('id', questionIds.slice(i, i + chunk));
    if (error) return { hashes, unavailable: true };
    let unheld;
    try { unheld = await excludeHeldFamilies(data || [], db); } catch { return { hashes, unavailable: true }; }
    const snapshot = unheld.length ? eligibilitySnapshot() : undefined;
    for (const q of unheld) if (publicationEligibility(q, snapshot).eligible) hashes.set(q.id, q.evidence.record.content_hash);
  }
  return { hashes, unavailable: false };
}
const same = (a, b, label) => { assert.equal(a.unavailable, b.unavailable, label); assert.deepEqual([...a.hashes].sort(), [...b.hashes].sort(), label); };
const fullReads = (db) => db.calls.filter((c) => c.table === 'questions' && c.select === '*');
const stampReads = (db) => db.calls.filter((c) => c.table === 'questions' && c.select === 'id,updated_at');

test('verdicts: the same hashes as the whole-row read, cold and warm; a warm call reads stamps and the holds, no row', async () => {
  const rows = bank(60);
  const holds = rows.filter((r) => r.family_id).filter((_, i) => i % 9 === 0).map((r) => ({ family_id: r.family_id }));
  const ids = rows.map((r) => r.id);
  const reference = await hashesBefore(fakeDb({ questions: rows, recovery_family_holds: holds }, { strict: false }), ids);
  assert.ok(reference.hashes.size > 5 && reference.hashes.size < ids.length, 'some eligible, some not');
  const db = fakeDb({ questions: rows, recovery_family_holds: holds });
  const cache = createVerdictCache();
  const cold = await evidenceVerdicts(db, ids, { cache });
  same(cold, reference, 'cold');
  const coldBytes = db.calls.reduce((n, c) => n + c.bytes, 0);
  assert.equal(fullReads(db).reduce((n, c) => n + c.rows, 0), ids.length, 'every row read once');
  db.calls.length = 0;
  const warm = await evidenceVerdicts(db, ids, { cache });
  same(warm, reference, 'warm');
  assert.equal(fullReads(db).length, 0, 'no full row');
  assert.ok(stampReads(db).length >= 1);
  const warmBytes = db.calls.reduce((n, c) => n + c.bytes, 0);
  assert.ok(warmBytes < coldBytes * 0.03, `${warmBytes} B against ${coldBytes} B`);
  assert.ok(cache.size === ids.length);
});

test('verdicts: a changed row, a hold added later, a record that expires and a deleted row each give the fresh answer', async () => {
  const rows = bank(40, { seed: 12 });
  const holds = [];
  const ids = rows.map((r) => r.id);
  const db = fakeDb({ questions: rows, recovery_family_holds: holds }, { strict: false });
  const cache = createVerdictCache();
  await evidenceVerdicts(db, ids, { cache });
  const eligibleIds = [...(await hashesBefore(db, ids)).hashes.keys()];
  assert.ok(eligibleIds.length >= 5);
  // a hold appears: never cached, so the very next call drops that family
  const target = rows.find((r) => r.id === eligibleIds[0]);
  holds.push({ family_id: target.family_id });
  db.calls.length = 0;
  let next = await evidenceVerdicts(db, ids, { cache });
  same(next, await hashesBefore(db, ids), 'hold');
  assert.ok(!next.hashes.has(target.id));
  assert.equal(fullReads(db).filter((c) => c.rows > 0).length >= 0, true);
  holds.length = 0;
  // the question changes (the trigger bumps updated_at): only that row is read again, and its verdict is the new one
  const changed = rows.find((r) => r.id === eligibleIds[1]);
  changed.explanation = 'Changed after the evidence was signed.';
  changed.updated_at = '2026-10-20T10:00:00.000Z';
  db.calls.length = 0;
  next = await evidenceVerdicts(db, ids, { cache });
  // the reads of the call, taken before the reference read below (which reads every row through the same fake and would be counted)
  const changedReads = fullReads(db).map((c) => c.rows);
  same(next, await hashesBefore(db, ids), 'changed');
  assert.ok(!next.hashes.has(changed.id), 'content_changed');
  assert.deepEqual(changedReads, [1], 'only the changed row was read');
  // a record that expires: no row is read, and the verdict is the one a fresh read gives at that time
  const later = Date.now() + 2 * 3_600_000;
  const clock = mock.method(Date, 'now', () => later);
  try {
    db.calls.length = 0;
    const expired = await evidenceVerdicts(db, ids, { cache, now: () => later });
    assert.equal(expired.hashes.size, 0, 'every record has expired');
    assert.equal(fullReads(db).length, 0, 'decided from the cached expiry, no row read');
    same(expired, await hashesBefore(db, ids), 'expired');
  } finally { clock.mock.restore(); }
  // a deleted row disappears
  rows.splice(rows.findIndex((r) => r.id === eligibleIds[2]), 1);
  next = await evidenceVerdicts(db, ids, { cache });
  assert.ok(!next.hashes.has(eligibleIds[2]));
  same(next, await hashesBefore(db, ids), 'deleted');
});

test('verdicts: a different deploy, MOCK_AI, the TTL, a missing stamp or any read error never reuses or hides anything', async () => {
  const rows = bank(30, { seed: 13 });
  const ids = rows.map((r) => r.id);
  const db = fakeDb({ questions: rows, recovery_family_holds: [] }, { strict: false });
  const cache = createVerdictCache();
  const base = await evidenceVerdicts(db, ids, { cache });
  assert.ok(base.hashes.size > 3);
  // MOCK_AI turns publication off: a cached eligible verdict must not survive it
  process.env.MOCK_AI = 'true';
  try {
    db.calls.length = 0;
    const mocked = await evidenceVerdicts(db, ids, { cache });
    assert.equal(mocked.hashes.size, 0);
    assert.ok(fullReads(db).length >= 1, 'read again, not reused');
  } finally { delete process.env.MOCK_AI; }
  // a different registry or calibration (a different frozen snapshot object) is a different deploy
  const snapshot = { manifest: {}, registry: {} };
  const entry = { stamp: 's', snapshot, mock: false, key: 'k', eligible: true, hash: 'h', expiresAt: Date.now() + 1000, family: 'f' };
  const probe = createVerdictCache();
  probe.set('q1', entry);
  assert.ok(probe.get('q1', 's', { snapshot, mock: false, key: 'k' }));
  assert.equal(probe.get('q1', 's', { snapshot: { ...snapshot }, mock: false, key: 'k' }), null, 'another snapshot object');
  probe.set('q1', entry);
  assert.equal(probe.get('q1', 's', { snapshot, mock: true, key: 'k' }), null, 'MOCK_AI');
  probe.set('q1', entry);
  assert.equal(probe.get('q1', 's', { snapshot, mock: false, key: 'other' }), null, 'signing key');
  probe.set('q1', entry);
  assert.equal(probe.get('q1', 'other-stamp', { snapshot, mock: false, key: 'k' }), null, 'stamp');
  // TTL and bound
  let t = 0;
  const bounded = createVerdictCache({ now: () => t, ttlMs: 1000, max: 3 });
  for (const id of ['a', 'b', 'c', 'd']) bounded.set(id, entry);
  assert.equal(bounded.size, 3);
  assert.equal(bounded.get('a', 's', { snapshot, mock: false, key: 'k' }), null, 'the least recently used is out');
  t = 1001;
  assert.equal(bounded.get('b', 's', { snapshot, mock: false, key: 'k' }), null, 'expired');
  assert.ok(VERDICT_CACHE_MAX >= 1000);
  // errors pause the claims exactly as before
  const broken = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'down' } }) }) }) };
  assert.equal((await evidenceVerdicts(broken, ['a'])).unavailable, true);
  assert.equal((await evidenceVerdicts(broken, [])).unavailable, false);
  const holdsDown = fakeDb({ questions: rows, recovery_family_holds: [] }, { strict: false });
  const original = holdsDown.from.bind(holdsDown);
  holdsDown.from = (name) => (name === 'recovery_family_holds' ? { select: () => ({ in: async () => ({ data: null, error: { message: 'down' } }) }) } : original(name));
  assert.equal((await evidenceVerdicts(holdsDown, ids, { cache: createVerdictCache() })).unavailable, true, 'a failed holds lookup pauses the claims');
  // a stampless row is read each time and never stored
  const stampless = rows.map((r) => ({ ...r, updated_at: null }));
  const dbs = fakeDb({ questions: stampless, recovery_family_holds: [] }, { strict: false });
  const c2 = createVerdictCache();
  await evidenceVerdicts(dbs, ids, { cache: c2 });
  assert.equal(c2.size, 0);
});

test('verdicts: the history walk of a long history (500 questions) costs full rows once, then stamps, and never touches the shared row cache', async () => {
  const rows = bank(500, { padding: 2000, seed: 14 });
  const ids = rows.map((r) => r.id);
  const db = fakeDb({ questions: rows, recovery_family_holds: [] }, { strict: false });
  const first = await currentEvidenceHashes(db, ids);
  same(first, await hashesBefore(db, ids), '500 ids');
  assert.equal(questionRowCacheFor(db).size, 0, 'the shared full-row cache holds none of the walk');
  const firstBytes = db.calls.reduce((n, c) => n + c.bytes, 0);
  for (let call = 2; call <= 4; call += 1) {
    db.calls.length = 0;
    const again = await currentEvidenceHashes(db, ids);
    same(again, first, `call ${call}`);
    assert.equal(fullReads(db).length, 0, `call ${call}: no rows`);
    const stamps = db.calls.reduce((n, c) => n + c.bytes, 0);
    assert.ok(stamps < firstBytes * 0.03 && stamps < 60_000, `call ${call}: ${stamps} B`);
  }
  assert.equal(verdictCacheFor(db), verdictCacheFor(db), 'one cache per client');
  assert.notEqual(verdictCacheFor(db), verdictCacheFor({}), 'another client has its own');
});

test('record: GET /api/recovery reads the record profile and the verdict cache; the delayed-check inputs are identical from its rows', async () => {
  const route = read('src/app/api/recovery/route.js');
  assert.match(route, /Database\.getAttempts\(session\.user\.id,\{memo,slim:'record'\}\)/);
  assert.match(route, /import \{ currentEvidenceHashes \} from '@\/\.\.\/data\/question_reads';/);
  assert.match(read('data/question_reads.js'), /export const currentEvidenceHashes = evidenceVerdicts;/);
  // the tables it still reads whole have no heavy column: three small ones and one 1 KB note
  assert.match(route, /from\('recovery_review_queue'\)\.select\('\*'\)/);
  const record = await lean('u1', 'record');
  const table = await before('u1');
  const inputs = (attempts, hashes) => {
    const kept = attempts.filter((a) => a.selectionMeta?.scoringVersion === 'server_snapshot_v1' && a.selectionMeta?.contentEvidence !== 'legacy_bank');
    const ids = [...new Set(kept.flatMap((a) => a.questionsSnapshot.filter((q) => q.verificationEvidence?.content_hash).map((q) => q.id)))];
    const concepts = {};
    for (const a of [...kept].sort((x, y) => x.completedAt - y.completedAt)) for (const q of a.questionsSnapshot) {
      const d = a.details.find((x) => x.qid === q.id);
      const concept = q.conceptId || `${a.subject}:${q.chapter}`;
      const current = hashes.get(q.id) && hashes.get(q.id) === q.verificationEvidence?.content_hash;
      (concepts[concept] ??= []).push({ questionId: q.id, familyId: q.familyId, at: a.completedAt, correct: d?.isCorrect === true, assisted: false, fresh: Boolean(current && q.conceptId && q.familyId) });
    }
    const papers = sourceLabels(attempts);
    return {
      ids,
      review: attempts.map((a) => [a.id, a.subject, a.completedAt, a.correct, a.total, a.selectionMeta?.scoringVersion || 'historical_device', (a.details || []).filter((d) => d.isCorrect !== true).length, papers.get(a.id) || 'Quick practice']),
      checks: Object.entries(concepts).map(([concept, list]) => ({ concept, ...improvementEvidence(list) })),
    };
  };
  const hashes = new Map(table.flatMap((a) => a.questionsSnapshot.filter((q) => q.verificationEvidence?.content_hash).map((q) => [q.id, q.verificationEvidence.content_hash])));
  assert.ok(hashes.size > 0);
  assert.deepEqual(inputs(record, hashes), inputs(table, hashes));
  const learn = (attempts) => learningPlan({ episodes: [], activeSession: null, attempts, subject: 'economics', minutes: 25, now: NOW, availableConcepts: [] });
  assert.deepEqual(learn(record), learn(await lean('u1', 'plan')), 'the plan inside the record is the same from the record rows');
  const full = bytes(await tableRows(pg, 'u1'));
  const lite = bytes(await callFunction(pg, 'attempts_lean', { p_user_id: 'u1', p_profile: 'record' }));
  assert.ok(lite < full * 0.1, `${lite} B against ${full} B`);
});

// ---- problem 2: the row cache is bounded by bytes ---------------------------------------------------------------------------------------
test('row cache: bounded by bytes, least recently used first; a row bigger than the budget is never kept; copies stay the caller\'s own', () => {
  const big = (id, n) => ({ id, notes: 'x'.repeat(n) });
  const cache = createQuestionRowCache({ maxBytes: 100_000, max: 1000 });
  for (let i = 0; i < 5; i += 1) cache.set(`k${i}`, 's', big(`q${i}`, 35_000));
  assert.equal(cache.size, 2, 'two 35 KB rows fit 100 KB');
  assert.ok(cache.bytes <= 100_000);
  assert.equal(cache.get('k0', 's'), null);
  assert.deepEqual(cache.get('k4', 's').id, 'q4');
  cache.set('k5', 's', big('q5', 35_000));
  assert.ok(cache.get('k4', 's'), 'the one read last stays');
  assert.equal(cache.get('k3', 's'), null);
  cache.set('huge', 's', big('h', 150_000));
  assert.equal(cache.get('huge', 's'), null, 'a row over the whole budget is not kept');
  const before = cache.bytes;
  cache.set('k5', 's', big('q5', 10));
  assert.ok(cache.bytes < before, 'a replaced row frees its bytes');
  const row = cache.get('k5', 's');
  row.id = 'mutated';
  assert.equal(cache.get('k5', 's').id, 'q5');
  cache.clear();
  assert.equal(cache.bytes, 0);
  // light rows: the byte budget, not a count of 300, decides what fits
  const light = createQuestionRowCache();
  for (let i = 0; i < 900; i += 1) light.set(`l${i}`, 's', big(`q${i}`, 2_000));
  assert.equal(light.size, 900, 'nine hundred 2 KB rows are 1.8 MB: all kept');
  assert.ok(QUESTION_ROW_CACHE_MAX_BYTES >= 16 * 1024 * 1024 && QUESTION_ROW_CACHE_MAX_BYTES <= 32 * 1024 * 1024);
});

test('row cache: a managed row is kept for a window of rows beyond 300, and the walk of 500 ids by the verdict path leaves it alone', async () => {
  const rows = bank(400, { padding: 30_000, seed: 15 });
  const db = fakeDb({ questions: rows, recovery_family_holds: [] }, { strict: false });
  const cache = createQuestionRowCache();
  const window = rows.slice(0, 300).map((r) => r.id);
  const { readRowsCached } = await import('../question_row_cache.js');
  await readRowsCached(db, window, { cache });
  assert.equal(cache.size, 300);
  const kept = cache.bytes;
  assert.ok(kept < QUESTION_ROW_CACHE_MAX_BYTES, `${kept} B of 300 managed rows`);
  // a student's history walk through the verdict path: the window is not evicted
  await evidenceVerdicts(db, rows.map((r) => r.id), { cache: createVerdictCache() });
  db.calls.length = 0;
  await readRowsCached(db, window, { cache });
  assert.equal(fullReads(db).length, 0, 'the shared window still hits');
});

// ---- problem 5: the inventory digest function --------------------------------------------------------------------------------------------
test('inventory digest: the real function over a real table; a vote above the floor keeps it, anything the count reads changes it', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.questions(id text primary key, subject text, chapter text, concept text, concept_id text, question text, body text, options jsonb, correct_index integer,
      correct_answer text, explanation text, passage_text text, family_id text, question_type text, status text, verification_state text, exploration_state text,
      score integer, is_deleted boolean not null default false, legacy_screening jsonb, evidence jsonb, provenance jsonb,
      upvotes integer default 0, downvotes integer default 0, updated_at timestamptz not null default now(), quality_score numeric, tags text[]);`);
  await db.exec(read('supabase/migrations/20261020160100_inventory_content_digest_fn.sql'));
  const insert = (id, over = {}) => db.query(`insert into public.questions(id, subject, chapter, question, body, options, correct_index, correct_answer, explanation, family_id, status, verification_state, exploration_state, score, is_deleted, evidence)
    values ($1,'accountancy','Partnership','Q','Q',$2,1,'B','Because',$3,$4,$5,$6,$7,$8,$9)`,
    [id, JSON.stringify(['a', 'b', 'c', 'd']), over.family ?? `f-${id}`, over.status ?? 'live', over.verification ?? 'verified', over.exploration ?? 'active', over.score ?? 0, over.deleted ?? false, JSON.stringify(over.evidence ?? { record: { content_hash: `h-${id}` }, signature: 's' })]);
  for (let i = 0; i < 20; i += 1) await insert(`q${i}`);
  await insert('hidden', { status: 'pending', verification: 'pending', exploration: 'pending_review' });
  await insert('gone', { deleted: true });
  const digest = async () => (await db.query('select public.inventory_content_digest() as d')).rows[0].d;
  const base = await digest();
  assert.match(base, /^[0-9a-f]{32}$/);
  assert.equal(await digest(), base, 'stable');
  // votes: counters, a score that stays above the floor, and the trigger-style updated_at bump
  await db.exec(`update public.questions set upvotes = 3, downvotes = 1, score = 2, updated_at = now() + interval '1 hour' where id = 'q3'`);
  await db.exec(`update public.questions set upvotes = 0, downvotes = 2, score = -2, updated_at = now() + interval '1 hour' where id = 'q4'`);
  await db.exec(`update public.questions set score = null where id = 'q5'`);
  assert.equal(await digest(), base, 'votes and a score that stays on the same side of the floor do not change what the count reads (null counts as 0)');
  await db.exec(`update public.questions set quality_score = 4, tags = array['x'] where id = 'q6'`);
  assert.equal(await digest(), base, 'a column the count does not read');
  // rows the count does not read
  await db.exec(`update public.questions set explanation = 'edited' where id = 'hidden'`);
  await db.exec(`update public.questions set explanation = 'edited' where id = 'gone'`);
  assert.equal(await digest(), base, 'a hidden or deleted row');
  // everything the count does read
  const changes = [
    [`explanation = 'edited'`, 'explanation'], [`correct_index = 2`, 'key'], [`options = '["a","b","c","e"]'::jsonb`, 'options'], [`score = -3`, 'score under the floor'],
    [`status = 'pending', verification_state = 'pending'`, 'leaves the visible set'], [`evidence = '{"record":{"content_hash":"x"},"signature":"s"}'::jsonb`, 'evidence'],
    [`family_id = 'other'`, 'family'], [`chapter = 'Ratios'`, 'chapter'], [`provenance = '{"kind":"factory"}'::jsonb`, 'provenance'], [`legacy_screening = '{"verdict":"x"}'::jsonb`, 'legacy screening'],
    [`passage_text = 'p'`, 'passage'], [`is_deleted = true`, 'deleted'], [`exploration_state = 'archived', status = 'pending'`, 'exploration'],
  ];
  for (const [set, name] of changes) {
    await db.exec('begin');
    await db.exec(`update public.questions set ${set} where id = 'q7'`);
    assert.notEqual(await digest(), base, name);
    await db.exec('rollback');
    assert.equal(await digest(), base, `${name}: rolled back`);
  }
  await db.exec('begin');
  await insert('q-new');
  assert.notEqual(await digest(), base, 'a new visible row');
  await db.exec('rollback');
  await db.exec('begin');
  await insert('q-new-hidden', { status: 'pending', verification: 'pending', exploration: 'pending_review' });
  assert.equal(await digest(), base, 'a new hidden row');
  await db.exec('rollback');
  // an empty table has a digest too
  await db.exec('begin');
  await db.exec('delete from public.questions');
  assert.match(await digest(), /^[0-9a-f]{32}$/);
  await db.exec('rollback');
  // only service_role may run it
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select public.inventory_content_digest()'), /permission denied/, role);
    await db.exec('reset role');
  }
  await db.close();
});

test('inventory digest: the SQL reads exactly the columns the count reads, and the undo drops it', () => {
  const sql = read('supabase/migrations/20261020160100_inventory_content_digest_fn.sql');
  const select = sql.slice(sql.indexOf('select\n      q.id'), sql.indexOf('from public.questions q'));
  const columns = [...select.matchAll(/q\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(columns)].sort(), [...INVENTORY_COLUMNS].sort(), 'the same 22 columns as INVENTORY_COLUMNS (score as its floor)');
  assert.match(select, /\(coalesce\(q\.score, 0\) >= -2\) as score_ok/);
  assert.match(sql, /where q\.is_deleted = false\n\s+and \(q\.status = 'live' or \(q\.verification_state = 'verified' and q\.exploration_state = 'active'\)\)/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /revoke all on function public\.inventory_content_digest\(\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.inventory_content_digest\(\) to service_role;/);
  assert.match(read('supabase/undo/20261020160100_inventory_content_digest_fn.undo.sql'), /drop function if exists public\.inventory_content_digest\(\);/);
  assert.match(read('data/practice_library.js'), /Number\(row\.score \?\? 0\) >= -2/, 'the floor the digest reduces score to is still the count\'s own');
});
