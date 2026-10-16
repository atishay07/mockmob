// nta_question_index never goes stale: the pool falls back to the full read while an index is older than the
// subject's newest live question, the publish paths and the daily run (which rides on the inventory cron) rebuild it,
// and the daily run obeys the full-bank guard. No network: the database is an in-memory fake that sorts, limits, upserts and deletes like
// the real one, so the query shapes are checked too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildNtaPaper, clearNtaPoolCache, loadNtaPool, loadNtaPoolFromIndex } from '../nta_pool.js';
import { ntaIndexBuiltAt, ntaIndexFreshness, newestLiveQuestionAt } from '../nta_index_freshness.js';
import {
  NTA_INDEX_SUBJECTS, buildNtaIndexRows, rebuildNtaIndexForSubjects, rebuildNtaIndexSubject, refreshStaleNtaIndexes, writeNtaIndexRows,
} from '../nta_index.js';
import { FullBankReadBlocked } from '../full_bank_guard.js';
import { FIXTURE_SECRET, makeBank } from './ntaEngineFixtures.mjs';
import { BUILT, OLD, PRODUCTION, fakeDb, indexRows, setup, sideTables } from './ntaIndexFakeDb.mjs';

const read = (db) => db.calls.filter(([kind, table]) => kind === 'select' && table === 'questions');

test('an index older than the newest live question falls back to the full read, so the new question is in the pool', async () => {
  clearNtaPoolCache();
  const { questions, index, fresh } = setup();
  const db = fakeDb({ questions, nta_question_index: index, ...sideTables });
  const result = await buildNtaPaper(db, 'chemistry', { seed: 'stale', seenIds: new Set(), cache: false });
  assert.equal(result.pool.source, 'full');
  assert.equal(result.timings.poolSource, 'full');
  assert.equal(result.timings.indexStale, true);
  assert.equal(result.pool.indexStale.builtAt, BUILT);
  assert.equal(result.pool.indexStale.newestAt, fresh.created_at);
  assert.equal(result.pool.loaded, questions.length, 'every live question with a score source is read, the new one included');
  // The index read would have missed it.
  const viaIndex = await loadNtaPool(fakeDb({ questions, nta_question_index: index, ...sideTables }), 'chemistry', { source: 'index' });
  assert.equal(viaIndex.source, 'index');
  assert.equal(viaIndex.length, questions.length - 1);
  assert.equal(viaIndex.some((row) => row.id === fresh.id), false);
  assert.equal((await loadNtaPool(db, 'chemistry')).some((row) => row.id === fresh.id), true);
});

test('live_at alone also marks the index stale (a question moved to live later keeps its old created_at)', async () => {
  const { questions, index } = setup({ column: 'live_at' });
  const pool = await loadNtaPool(fakeDb({ questions, nta_question_index: index, ...sideTables }), 'chemistry');
  assert.equal(pool.source, 'full');
  assert.equal(pool.indexStale.newestAt, '2026-10-14T09:00:00.000Z');
});

test('a current index is still read slim: no evidence column, source index, nothing stale', async () => {
  clearNtaPoolCache();
  const { questions, index } = setup({ published: OLD });
  const db = fakeDb({ questions, nta_question_index: index, ...sideTables });
  const result = await buildNtaPaper(db, 'chemistry', { seed: 'fresh', seenIds: new Set(), cache: false });
  assert.equal(result.pool.source, 'index');
  assert.equal(result.timings.indexStale, false);
  assert.equal('indexStale' in result.pool, false);
  assert.ok(read(db).every(([, , columns]) => !columns.split(',').includes('evidence')), 'no evidence column read');
  // The check itself reads only the two timestamp columns, one row each.
  assert.deepEqual(read(db).filter(([, , columns]) => /^(created_at|live_at)$/.test(columns)).map(([, , columns]) => columns), ['created_at', 'live_at']);
});

test('a question published after the build, or in the same instant as it, decides by strict comparison', async () => {
  const same = setup({ published: BUILT });
  assert.equal((await loadNtaPool(fakeDb({ questions: same.questions, nta_question_index: same.index, ...sideTables }), 'chemistry')).source, 'index');
  const later = setup({ published: '2026-10-13T12:00:00.001Z' });
  assert.equal((await loadNtaPool(fakeDb({ questions: later.questions, nta_question_index: later.index, ...sideTables }), 'chemistry')).source, 'full');
});

test('questions that are not live or are deleted never make the index look stale', async () => {
  const { questions, index } = setup({ published: OLD });
  const noise = [
    { ...questions[0], id: 'hidden', status: 'pending', created_at: '2026-10-15T00:00:00.000Z', live_at: null },
    { ...questions[0], id: 'gone', is_deleted: true, created_at: '2026-10-15T00:00:00.000Z' },
    { ...questions[0], id: 'other', subject: 'physics', created_at: '2026-10-15T00:00:00.000Z' },
  ];
  const pool = await loadNtaPool(fakeDb({ questions: [...questions, ...noise], nta_question_index: index, ...sideTables }), 'chemistry');
  assert.equal(pool.source, 'index');
});

test('a failed freshness check reads the full pool (correct, if heavier); a spent read budget still surfaces', async () => {
  const { questions, index } = setup({ published: OLD });
  const failing = fakeDb({ questions, nta_question_index: index, ...sideTables }, { failOn: (table, op, columns) => table === 'questions' && columns === 'created_at' });
  const pool = await loadNtaPool(failing, 'chemistry');
  assert.equal(pool.source, 'full');
  assert.match(pool.indexStale.checkFailed, /boom/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadNtaPoolFromIndex(failing, 'chemistry', { signal: controller.signal }), (error) => error.message === 'boom');
});

test('freshness helpers: newest question, built-at, tables and columns that are missing', async () => {
  const { questions, index } = setup();
  const db = fakeDb({ questions, nta_question_index: index });
  assert.equal(await newestLiveQuestionAt(db, 'chemistry'), Date.parse('2026-10-14T09:00:00.000Z'));
  assert.equal(await newestLiveQuestionAt(db, 'physics'), null);
  assert.deepEqual(await ntaIndexBuiltAt(db, 'chemistry'), { builtAt: Date.parse(BUILT), tableMissing: false });
  assert.deepEqual(await ntaIndexBuiltAt(db, 'physics'), { builtAt: null, tableMissing: false });
  assert.deepEqual(await ntaIndexBuiltAt(fakeDb({}, { missing: ['nta_question_index'] }), 'chemistry'), { builtAt: null, tableMissing: true });
  assert.deepEqual(await ntaIndexFreshness(db, 'chemistry', null), { stale: false, builtAt: null, newestAt: null });
  assert.equal((await ntaIndexFreshness(db, 'chemistry', Date.parse(BUILT))).stale, true);
  assert.equal((await ntaIndexFreshness(db, 'chemistry', Date.parse('2026-10-14T09:00:00.000Z'))).stale, false);
  // An older schema without live_at: created_at decides.
  const noLiveAt = fakeDb({ questions }, { failOn: () => false });
  const original = noLiveAt.from;
  noLiveAt.from = (table) => {
    const query = original(table);
    const select = query.select;
    query.select = (value) => (value === 'live_at' ? Object.assign(query, { then: (resolve) => Promise.resolve({ data: null, error: { code: '42703', message: 'no column' } }).then(resolve) }) : select(value));
    return query;
  };
  assert.equal(await newestLiveQuestionAt(noLiveAt, 'chemistry'), Date.parse('2026-10-14T09:00:00.000Z'));
});

test('a rebuild reads one subject, signs the verified rows, drops rows that no longer verify, and leaves the index fresh', async () => {
  clearNtaPoolCache();
  const { questions, index, fresh } = setup();
  const other = makeBank('physics').slice(0, 3).map((row) => ({ ...row, created_at: OLD }));
  const stale = { ...index[0], question_id: 'no-longer-live' };
  const db = fakeDb({ questions: [...questions, ...other], nta_question_index: [...index, stale], ...sideTables });
  const now = new Date('2026-10-14T10:00:00.000Z');
  const result = await rebuildNtaIndexSubject(db, 'chemistry', { secret: FIXTURE_SECRET, now });
  assert.equal(result.indexed, questions.length);
  assert.equal(result.written, questions.length);
  assert.equal(result.removed, 1);
  assert.equal(result.verifiedAt, now.toISOString());
  assert.ok(db.tables.nta_question_index.some((row) => row.question_id === fresh.id), 'the new question is indexed');
  assert.equal(db.tables.nta_question_index.some((row) => row.question_id === 'no-longer-live'), false);
  assert.equal(db.tables.nta_question_index.some((row) => row.subject === 'physics'), false, 'another subject is not read or written');
  assert.ok(db.calls.filter(([kind, table, columns]) => kind === 'select' && table === 'questions' && columns.includes('evidence')).length > 0);
  // From here the pool reads the index again, and the new question is in it.
  const pool = await loadNtaPool(db, 'chemistry');
  assert.equal(pool.source, 'index');
  assert.equal(pool.some((row) => row.id === fresh.id), true);
  const paper = await buildNtaPaper(db, 'chemistry', { seed: 'after', seenIds: new Set(), cache: false });
  assert.equal(paper.pool.source, 'index');
});

test('verified_at is never earlier than the newest question it read, whatever this machine clock says', async () => {
  const { questions } = setup({ published: '2026-10-20T00:00:00.000Z' });
  const db = fakeDb({ questions, nta_question_index: [], ...sideTables });
  const built = await buildNtaIndexRows(db, 'chemistry', { secret: FIXTURE_SECRET, now: new Date('2026-10-14T10:00:00.000Z') });
  assert.equal(built.verifiedAt, '2026-10-20T00:00:00.000Z');
  assert.ok(built.rows.every((row) => row.verified_at === '2026-10-20T00:00:00.000Z'));
  await assert.rejects(buildNtaIndexRows(db, 'chemistry', { secret: '' }), /CUET_EVIDENCE_SIGNING_KEY/);
  assert.deepEqual((await writeNtaIndexRows(db, 'chemistry', built.rows)).removed, 0);
});

test('after a publish: touched subjects are rebuilt (public or internal ids), and nothing throws', async () => {
  const { questions } = setup();
  const db = fakeDb({ questions, nta_question_index: [], ...sideTables });
  const out = await rebuildNtaIndexForSubjects(db, ['chemistry', 'chemistry'], { secret: FIXTURE_SECRET, now: new Date('2026-10-14T10:00:00.000Z') });
  assert.equal(out.status, 'rebuilt');
  assert.equal(out.subjects.length, 1, 'a subject is rebuilt once');
  assert.equal(out.subjects[0].indexed, questions.length);
  assert.deepEqual(await rebuildNtaIndexForSubjects(db, [], { secret: FIXTURE_SECRET }), { status: 'nothing_to_do', subjects: [] });
  assert.equal((await rebuildNtaIndexForSubjects(db, ['chemistry'], { secret: '' })).reason, 'no_signing_key');
  const missing = await rebuildNtaIndexForSubjects(fakeDb({ questions }, { missing: ['nta_question_index'] }), ['chemistry'], { secret: FIXTURE_SECRET });
  assert.deepEqual(missing, { status: 'skipped', subjects: [{ subject: 'chemistry', skipped: 'index_table_missing' }] });
  const lines = [];
  const broken = await rebuildNtaIndexForSubjects(fakeDb({ questions }, { failOn: (table, op) => table === 'nta_question_index' && op === 'upsert' }), ['chemistry'], { secret: FIXTURE_SECRET, log: (line) => lines.push(line) });
  assert.equal(broken.status, 'failed');
  assert.match(lines[0], /rebuild of chemistry failed/);
});

const CLOCK = Date.parse('2026-10-14T12:00:00.000Z'); // a day after BUILT

test('the daily run rebuilds only subjects whose index is older than their newest question, reading only those', async () => {
  const chemistry = setup();
  const physics = makeBank('physics').slice(0, 6).map((row) => ({ ...row, created_at: OLD, live_at: OLD }));
  const history = makeBank('history').slice(0, 6).map((row) => ({ ...row, created_at: OLD, live_at: OLD }));
  const db = fakeDb({
    questions: [...chemistry.questions, ...physics, ...history],
    nta_question_index: [...chemistry.index, ...indexRows(physics, 'physics')],
    ...sideTables,
  });
  const rebuilt = [];
  const rebuild = async (client, subject, options) => { rebuilt.push(subject); return rebuildNtaIndexSubject(client, subject, { ...options, now: new Date('2026-10-14T10:00:00.000Z') }); };
  const run = (subjects) => refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects, rebuild, now: () => CLOCK });
  const out = await run(['chemistry', 'physics', 'history', 'economics']);
  assert.deepEqual(rebuilt, ['chemistry']);
  const by = Object.fromEntries(out.subjects.map((subject) => [subject.subject, subject]));
  assert.deepEqual(Object.keys(by).sort(), ['chemistry', 'economics', 'history', 'physics']);
  assert.equal(by.chemistry.reason, 'newer_questions');
  assert.equal(by.physics.skipped, 'fresh');
  assert.equal(by.history.skipped, 'never_built');
  assert.equal(by.economics.skipped, 'never_built');
  assert.equal(out.status, 'ok');
  assert.equal(out.rebuilt, 1);
  assert.equal(by.chemistry.previouslyBuiltAt, BUILT);
  // Only chemistry's evidence column was read; the other subjects cost the small freshness selects (physics also a slim drift read).
  const evidenceReads = db.calls.filter(([kind, table, columns]) => kind === 'select' && table === 'questions' && columns.includes('evidence'));
  assert.ok(evidenceReads.length > 0);
  // Idempotent: a second run, and a third, find everything fresh and write nothing.
  rebuilt.length = 0;
  const writes = () => db.calls.filter(([kind]) => kind === 'upsert' || kind === 'delete').length;
  const before = writes();
  for (let i = 0; i < 2; i += 1) {
    const again = await run(['chemistry', 'physics']);
    assert.deepEqual(again.subjects.map((subject) => subject.skipped), ['fresh', 'fresh']);
  }
  assert.deepEqual(rebuilt, []);
  assert.equal(writes(), before, 'no write on a repeat');
});

test('the cron follows the full-bank guard: outside Vercel production it reads nothing', async () => {
  for (const env of [{}, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }]) {
    const db = fakeDb({});
    const lines = [];
    await assert.rejects(refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env, log: (line) => lines.push(line) }), FullBankReadBlocked);
    assert.equal(db.calls.length, 0, 'no read before the guard');
    assert.match(lines[0], /blocked: the NTA index rebuild/);
  }
});

test('the daily run skips cleanly without a signing key or before the migration, stops starting subjects when out of time, and reports a failing subject', async () => {
  assert.deepEqual(await refreshStaleNtaIndexes(fakeDb({}), { secret: '', env: PRODUCTION }), { status: 'skipped', reason: 'no_signing_key', subjects: [] });
  const noTable = fakeDb({}, { missing: ['nta_question_index'] });
  assert.deepEqual(await refreshStaleNtaIndexes(noTable, { secret: FIXTURE_SECRET, env: PRODUCTION }), { status: 'skipped', reason: 'index_table_missing', subjects: [] });
  const empty = await refreshStaleNtaIndexes(fakeDb({ nta_question_index: [] }), { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry', 'physics'] });
  assert.deepEqual(empty.subjects.map((subject) => subject.skipped), ['never_built', 'never_built'], 'a subject nobody built yet is left to the first manual build');
  const { questions, index } = setup();
  const lines = [];
  const failing = await refreshStaleNtaIndexes(fakeDb({ questions, nta_question_index: index, ...sideTables }), {
    secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK, log: (line) => lines.push(line), rebuild: async () => { throw new Error('write refused'); },
  });
  assert.equal(failing.status, 'partial');
  assert.match(lines[0], /daily rebuild of chemistry failed: write refused/);
  assert.ok(NTA_INDEX_SUBJECTS.includes('chemistry') && NTA_INDEX_SUBJECTS.includes('gat') && !NTA_INDEX_SUBJECTS.includes('general_test'), 'internal subject ids');
});

test('the cron route authenticates like the other internal routes and answers 409 outside production', () => {
  const route = readFileSync(new URL('../../src/app/api/internal/rebuild-nta-index/route.js', import.meta.url), 'utf8');
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /INTERNAL_API_SECRET/);
  assert.match(route, /x-internal-secret/);
  assert.ok(route.indexOf('authorised(request)') < route.indexOf('supabaseAdmin()'), 'the secret is checked before any database client exists');
  assert.match(route, /isFullBankReadBlocked\(error\)[\s\S]*status: 409/);
  assert.match(route, /refreshStaleNtaIndexes/);
  assert.match(route, /CUET_EVIDENCE_SIGNING_KEY/);
  assert.match(route, /export const GET = run;/);
  assert.match(route, /force/, 'a forced manual rebuild is available');
});

test('the inventory cron route runs the NTA index pass after the inventory refresh, behind the same secret and guard, and never turns an index problem into a failed inventory', () => {
  const route = readFileSync(new URL('../../src/app/api/internal/refresh-inventory/route.js', import.meta.url), 'utf8');
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /INTERNAL_API_SECRET/);
  assert.ok(route.indexOf('authorised(request)') < route.indexOf('refreshInventorySnapshot()'), 'the secret is checked first');
  assert.ok(route.indexOf('await refreshInventorySnapshot()') < route.indexOf('await refreshNtaIndex(startedAt)'));
  assert.match(route, /isFullBankReadBlocked\(error\)[\s\S]*status: 409/, 'not production: the inventory answers 409 and the index pass does not start');
  assert.match(route, /refreshStaleNtaIndexes\(supabaseAdmin\(\)/);
  assert.match(route, /CUET_EVIDENCE_SIGNING_KEY/);
  assert.match(route, /deadlineMs/, 'the pass has its own deadline inside the 300 s function');
  assert.match(route, /ntaIndex/, 'the outcome is in the response');
});
