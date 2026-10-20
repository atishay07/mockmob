import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createQuestionRowCache, questionRowCacheFor, readRowsCached } from '../question_row_cache.js';
import { ANSWER_REVIEW_COLUMNS, ANSWER_REVIEW_SELECT, QUESTION_READ_SELECT, computeAnswerReviews, currentEvidenceHashes, readFullQuestionRows, readQuestionRows } from '../question_reads.js';
import { createPracticeSource } from '../practice_source.js';
import { getMode } from '../test_modes.js';
import { publicationEligibility, eligibilitySnapshot } from '../evidence_registry.js';
import { evidenceSignature } from '../content_evidence.js';
import { ALL_COLUMNS, SECRET, buildBank, fakeDb, managedRows, rng, setFixtureSecret } from './helpers/egress_fixtures.mjs';

// Egress item F4 (20 Oct 2026): raw question rows kept while their updated_at is unchanged; verdicts always computed fresh.
const restore = setFixtureSecret();
after(restore);
const STAMP = '2026-09-01T00:00:00.000Z';

const bankWithStamps = (seed = 5) => buildBank(seed, { legacy: 40, managed: 14 }).map((row, i) => ({ ...row, updated_at: `${STAMP.slice(0, 19)}.${String(i % 1000).padStart(3, '0')}Z` }));
const fullReads = (db) => db.calls.filter((c) => c.table === 'questions' && c.select === '*');
const stampReads = (db) => db.calls.filter((c) => c.table === 'questions' && c.select === 'id,updated_at');
const sorted = (rows) => [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));

test('the first read is a stamp plus the full rows; the second read of the same ids is the stamp only, with the same rows', async () => {
  const bank = bankWithStamps();
  const db = fakeDb({ questions: bank }, { strict: false });
  const cache = createQuestionRowCache();
  const ids = bank.filter((r) => r.subject === 'accountancy').slice(0, 25).map((r) => r.id);
  const direct = (await fakeDb({ questions: bank }, { strict: false }).from('questions').select('*').in('id', ids)).data;
  const first = await readRowsCached(db, ids, { cache });
  assert.equal(first.error, null);
  assert.deepEqual(sorted(first.data), sorted(direct), 'the same rows a plain select(*) returns');
  assert.equal(stampReads(db).length, 1);
  assert.equal(fullReads(db).length, 1);
  const bytesFirst = db.calls.reduce((n, c) => n + c.bytes, 0);
  db.calls.length = 0;
  const second = await readRowsCached(db, ids, { cache });
  assert.deepEqual(sorted(second.data), sorted(direct));
  assert.equal(fullReads(db).length, 0, 'no full read');
  assert.equal(stampReads(db).length, 1);
  const bytesSecond = db.calls.reduce((n, c) => n + c.bytes, 0);
  assert.ok(bytesSecond < bytesFirst * 0.02, `${bytesSecond} B against ${bytesFirst} B`);
});

test('a changed updated_at refetches only that row, and a deleted row disappears', async () => {
  const bank = bankWithStamps(6);
  const ids = bank.slice(0, 12).map((r) => r.id);
  const cache = createQuestionRowCache();
  const db = fakeDb({ questions: bank }, { strict: false });
  await readRowsCached(db, ids, { cache });
  db.calls.length = 0;
  const target = bank[3];
  target.explanation = 'The correct answer is C here.';
  target.updated_at = '2026-10-20T10:00:00.000Z';
  const second = await readRowsCached(db, ids, { cache });
  assert.equal(second.data.find((r) => r.id === target.id).explanation, 'The correct answer is C here.');
  const full = fullReads(db);
  assert.equal(full.length, 1);
  assert.equal(full[0].rows, 1, 'only the changed row was read in full');
  bank.splice(5, 1);
  db.calls.length = 0;
  const third = await readRowsCached(db, ids, { cache });
  assert.ok(!third.data.some((r) => r.id === ids[5]), 'a deleted row is absent, as from a plain select');
  assert.equal(fullReads(db).length, 0);
});

test('a row without a stamp is never stored; a stamp query error or a read error is returned like the query error', async () => {
  const bank = bankWithStamps(7).map((r) => ({ ...r, updated_at: null }));
  const cache = createQuestionRowCache();
  const db = fakeDb({ questions: bank }, { strict: false });
  const ids = bank.slice(0, 5).map((r) => r.id);
  await readRowsCached(db, ids, { cache });
  assert.equal(cache.size, 0);
  db.calls.length = 0;
  await readRowsCached(db, ids, { cache });
  assert.equal(fullReads(db).length, 1, 'read in full again');
  const down = (failAt) => ({ from: () => ({ select: (columns) => ({ in: async () => (columns === failAt ? { data: null, error: { message: 'down' } } : { data: columns === 'id,updated_at' ? ids.map((id) => ({ id, updated_at: STAMP })) : [], error: null }) }) }) });
  assert.deepEqual((await readRowsCached(down('id,updated_at'), ids, { cache: createQuestionRowCache() })), { data: null, error: { message: 'down' } });
  assert.deepEqual((await readRowsCached(down('*'), ids, { cache: createQuestionRowCache() })), { data: null, error: { message: 'down' } });
});

test('the cache holds raw rows only: an evidence record that expires is ineligible on the next call, though its row is cached', async () => {
  const [row] = managedRows(rng(3), 7000, 1, { padding: 200 });
  row.updated_at = STAMP;
  row.evidence.record.expires_at = new Date(Date.now() + 400).toISOString();
  row.evidence.signature = evidenceSignature(row.evidence.record, SECRET);
  const db = fakeDb({ questions: [row] }, { strict: false });
  const cache = createQuestionRowCache();
  const verdict = async () => { const { data } = await readRowsCached(db, [row.id], { cache }); return publicationEligibility(data[0], eligibilitySnapshot()); };
  assert.equal((await verdict()).eligible, true, 'eligible while the record is current');
  db.calls.length = 0;
  await new Promise((resolve) => setTimeout(resolve, 600));
  const late = await verdict();
  assert.equal(fullReads(db).length, 0, 'the second read came from the cache');
  assert.equal(late.eligible, false, 'the verdict was computed fresh from the cached row');
  assert.ok(late.reasons.includes('stale_verification'));
});

test('callers get their own copy: mutating a returned row does not reach the cache or another caller', async () => {
  const bank = bankWithStamps(8);
  const db = fakeDb({ questions: bank }, { strict: false });
  const cache = createQuestionRowCache();
  const ids = [bank[0].id];
  const first = await readRowsCached(db, ids, { cache });
  first.data[0].options.push('MUTATED'); first.data[0].explanation = 'MUTATED';
  const second = await readRowsCached(db, ids, { cache });
  assert.notEqual(second.data[0].explanation, 'MUTATED');
  second.data[0].options.push('MUTATED AGAIN');
  const third = await readRowsCached(db, ids, { cache });
  assert.ok(!third.data[0].options.includes('MUTATED AGAIN'));
  assert.deepEqual(third.data[0], bank[0]);
});

test('the cache is bounded (least recently used out), expires, and keeps different column lists apart', async () => {
  const bank = bankWithStamps(9);
  const db = fakeDb({ questions: bank }, { strict: false });
  let t = 1_000;
  const cache = createQuestionRowCache({ max: 3, ttlMs: 10_000, now: () => t });
  await readRowsCached(db, bank.slice(0, 6).map((r) => r.id), { cache });
  assert.equal(cache.size, 3);
  db.calls.length = 0;
  await readRowsCached(db, [bank[5].id], { cache });
  assert.equal(fullReads(db).length, 0, 'the newest are kept');
  await readRowsCached(db, [bank[0].id], { cache });
  assert.equal(fullReads(db).length, 1, 'the oldest was dropped');
  t += 10_001;
  db.calls.length = 0;
  await readRowsCached(db, [bank[5].id], { cache });
  assert.equal(fullReads(db).length, 1, 'expired after the TTL');
  db.calls.length = 0;
  await readRowsCached(db, [bank[5].id], { cache, name: 'other', select: 'id,subject,updated_at' });
  assert.equal(db.calls.filter((c) => c.select === 'id,subject,updated_at').length, 1, 'another name is another entry');
});

test('wiring: the full-row reads of the practice start, the result page checks and the Recovery record go through the cache', async () => {
  const bank = bankWithStamps(10);
  const db = fakeDb({ questions: bank, recovery_family_holds: [] }, { strict: false });
  const ids = bank.filter((r) => r.family_id || r.evidence).slice(0, 20).map((r) => r.id);
  // readFullQuestionRows (result checks, Recovery)
  await readFullQuestionRows(db, ids);
  db.calls.length = 0;
  const again = await readFullQuestionRows(db, ids);
  assert.equal(fullReads(db).length, 0);
  assert.equal(again.data.length, ids.length);
  // currentEvidenceHashes (GET /api/recovery): a repeat costs stamps (and the holds lookup), no full rows
  await currentEvidenceHashes(db, ids);
  db.calls.length = 0;
  await currentEvidenceHashes(db, ids);
  assert.equal(fullReads(db).length, 0);
  // the practice source's loadFullRows
  const source = createPracticeSource({ db, subjectId: 'accountancy', mode: getMode('quick'), opts: {}, targetCount: 10, hooks: {} });
  await source.loadFullRows(ids);
  db.calls.length = 0;
  const rows = await source.loadFullRows(ids);
  assert.equal(fullReads(db).length, 0);
  assert.equal(rows.length, ids.length);
  assert.equal(questionRowCacheFor(db), questionRowCacheFor(db), 'one cache per client');
  assert.notEqual(questionRowCacheFor(db), questionRowCacheFor({}), 'another client has its own');
});

test('F6: the result page review reads twelve real columns, through the cache; a second open reads the stamp only', async () => {
  for (const column of ANSWER_REVIEW_COLUMNS) assert.ok(ALL_COLUMNS.includes(column), column);
  assert.equal(new Set(ANSWER_REVIEW_COLUMNS).size, ANSWER_REVIEW_COLUMNS.length);
  const bank = bankWithStamps(12);
  const db = fakeDb({ questions: bank }, { strict: true });
  const snapshots = bank.filter((r) => r.status === 'live').slice(0, 30).map((r) => ({ id: r.id, question: r.question, body: r.body, options: r.options, correctIndex: r.correct_index, passageText: r.passage_text }));
  const attempt = { questionsSnapshot: snapshots, details: snapshots.map((q) => ({ qid: q.id, givenIndex: 0, isCorrect: false })) };
  const eligible = (row) => publicationEligibility(row, eligibilitySnapshot()).eligible;
  const run = () => computeAnswerReviews({ attempt, readRows: (ids) => readQuestionRows(db, ids), readFullRows: (ids) => readFullQuestionRows(db, ids), eligible });
  const first = await run();
  const reviewReads = () => db.calls.filter((c) => c.select === ANSWER_REVIEW_SELECT);
  const firstBytes = db.calls.filter((c) => c.select === ANSWER_REVIEW_SELECT).reduce((n, c) => n + c.bytes, 0);
  const lightBytes = (await fakeDb({ questions: bank }, { strict: false }).from('questions').select(QUESTION_READ_SELECT).in('id', snapshots.map((q) => q.id))).data.length;
  assert.ok(lightBytes > 0 && reviewReads().length === 1);
  db.calls.length = 0;
  const second = await run();
  assert.deepEqual(second, first, 'the same reviews');
  assert.equal(reviewReads().length, 0, 'no rows read on the second open');
  assert.ok(firstBytes > 0);
});
