import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { PRACTICE_LIGHT_SELECT, PRACTICE_POOL_CACHE_MS, PRACTICE_QUESTION_COLUMNS, selectPracticeQuestions } from '../practice_pick.js';
import { POOL_REVALIDATE_MAX_MS, VISIBLE_QUESTION_FILTER, createPracticeSource } from '../practice_source.js';
import { getMode } from '../test_modes.js';
import { bytesOf, legacyRow, managedRows, rng, setFixtureSecret } from './helpers/egress_fixtures.mjs';
import { practiceFakeDb } from './helpers/practice_fake_db.mjs';

// Finding 2 of the 16 Oct 2026 production health audit: a practice or mock start must not copy the whole subject
// with its heaviest column. The slim read (data/practice_pick.js, A5 of 15 Oct) does that, but its own tests drive
// the picker with a hand-written source, so nothing pinned the queries data/db.js actually sends. This file runs
// the real queries (data/practice_source.js, the code getQuestions uses) against an in-memory database that
// projects columns like PostgREST and counts the bytes of every response.
// Rows are shaped like production: the 55 columns of public.questions, legacy rows of about 1 KB, and
// evidence-managed rows with a signed record of about 35 KB, in an Accountancy-sized subject (the largest).
// Software fixtures; they do not establish academic reliability.
const restore = setFixtureSecret();
after(restore);

const SUBJECT = 'accountancy';
// managedRows() makes seven kinds of record in turn: two valid ones and five ways to fail (stale, factory-looking,
// bad signature, content changed after signing, not visible). `invalid` is how many rows per 100 managed rows fail
// the publication gate; the default is a healthy bank, 40 is a bad day.
function subjectBank(seed = 21, { legacy = 700, managed = 150, invalid = 10 } = {}) {
  const rand = rng(seed);
  const rows = [];
  for (let n = 0; n < legacy; n += 1) rows.push(legacyRow(rand, n, { subject: SUBJECT }));
  const pool = managedRows(rand, 1000, managed * 8, { subject: SUBJECT });
  const valid = pool.filter((_, i) => i % 7 === 0 || i % 7 === 6);
  const broken = pool.filter((_, i) => [1, 2, 3, 4].includes(i % 7));
  const wrong = Math.round((managed * invalid) / 100);
  rows.push(...valid.slice(0, managed - wrong), ...broken.slice(0, wrong));
  // Other subjects must never be read by an Accountancy start.
  for (let n = 0; n < 200; n += 1) rows.push(legacyRow(rand, 5000 + n, { subject: 'physics' }));
  return rows;
}

const hooks = {
  attachPassages: async (rows) => rows,
  recentIds: async () => new Set(),
  userProgress: async () => new Map(),
  weakConcepts: async () => new Set(),
};
const noWarn = () => {};

async function start(bank, { mode = 'quick', count = 10, opts = {}, slim = true, caches = { pools: new Map() }, clock, failOn } = {}) {
  const db = practiceFakeDb({ questions: bank, recovery_family_holds: [] }, { failOn });
  const modeConfig = getMode(mode);
  const source = createPracticeSource({ db, subjectId: SUBJECT, mode: modeConfig, opts, targetCount: count, hooks, caches, clock });
  const stats = {};
  const result = await selectPracticeQuestions(source, { mode: modeConfig, targetCount: count, opts, stats, warn: noWarn }, { slim });
  return { result, db, stats, caches };
}

const isPoolRead = (call) => call.table === 'questions' && call.columns === PRACTICE_LIGHT_SELECT;
const isManagedScan = (call) => call.table === 'questions' && call.columns === 'id' && !call.head;
const isPickRead = (call) => call.table === 'questions' && call.filters.length === 1 && call.filters[0] === 'in:id';
const isWholeSubjectRead = (call) => call.table === 'questions' && call.columns === '*' && call.rows > 100;

test('the light select reads plain columns plus three json-path stubs, never the evidence or provenance record itself', () => {
  const parts = PRACTICE_LIGHT_SELECT.split(',');
  assert.ok(!parts.includes('evidence') && !parts.includes('provenance') && !parts.includes('*'));
  assert.ok(parts.filter((part) => part.includes('->')).length === 3);
  assert.equal(parts.filter((part) => !part.includes('->')).length, PRACTICE_QUESTION_COLUMNS.length);
});

test('a slim start sends the pool read in the light columns and reads full rows only by id, in batches of 100', async () => {
  const bank = subjectBank();
  const { db, stats, result } = await start(bank, { count: 20 });
  assert.ok(result.selected.length >= 14, `picked ${result.selected.length}`);
  assert.ok(stats.rounds >= 1, 'the slim path served this start');
  const pool = db.calls.filter(isPoolRead);
  assert.ok(pool.length >= 1);
  for (const call of pool) {
    for (const filter of ['eq:subject', 'eq:is_deleted', 'or:visible', 'gte:score']) assert.ok(call.filters.includes(filter), `pool read has ${filter}`);
    assert.ok(call.rows <= 1000);
  }
  assert.equal(VISIBLE_QUESTION_FILTER, 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)');
  const managed = db.calls.filter(isManagedScan);
  assert.ok(managed.length >= 2, 'one id scan for evidence and one for provenance');
  assert.ok(managed.every((call) => call.filters.some((f) => f.startsWith('not:'))));
  const picks = db.calls.filter(isPickRead);
  assert.ok(picks.length >= 1 && picks.every((call) => call.columns === '*' && call.rows <= 100));
  assert.equal(db.calls.filter(isWholeSubjectRead).length, 0, 'no start reads the whole subject with every column');
  const accounted = db.calls.filter((call) => isPoolRead(call) || isManagedScan(call) || isPickRead(call) || call.table === 'recovery_family_holds' || call.head);
  assert.equal(accounted.length, db.calls.length, 'every request is one of the known shapes');
  assert.equal(db.calls.filter((call) => call.head).length, 1, 'a read takes the subject row count first: one head count, no body (egress F3)');
  assert.ok(pool.every((call) => !JSON.stringify(call).includes('physics')));
});

test('the pool read carries no evidence: it is a small fraction of the subject\'s signed records', async () => {
  const bank = subjectBank();
  const { db } = await start(bank, { count: 10 });
  const evidenceBytes = bank.filter((row) => row.subject === SUBJECT && row.evidence && !row.is_deleted).reduce((sum, row) => sum + bytesOf(row.evidence), 0);
  const poolBytes = db.bytes(isPoolRead);
  assert.ok(evidenceBytes > 4_000_000, `the fixture subject carries ${evidenceBytes} bytes of evidence`);
  assert.ok(poolBytes < evidenceBytes * 0.3, `pool ${poolBytes} bytes against ${evidenceBytes} of evidence`);
});

test('before and after: same picks, same meta, a fraction of the bytes (measured through the real queries)', async () => {
  const lines = [];
  for (const [label, invalid, cases] of [
    ['healthy bank', 10, [['quick', 10, 0.45], ['quick', 20, 0.55], ['smart', 15, 0.5], ['full', 50, 0.8]]],
    ['bad day (40% of records fail the gate)', 40, [['quick', 10, 0.8], ['full', 50, 0.9]]],
  ]) {
    const bank = subjectBank(21, { invalid });
    for (const [mode, count, limit] of cases) {
      const before = await start(bank, { mode, count, slim: false });
      const after = await start(bank, { mode, count, slim: true });
      assert.deepEqual(after.result, before.result, `${label} ${mode} x${count}`);
      const beforeBytes = before.db.bytes((call) => call.table === 'questions');
      const afterBytes = after.db.bytes((call) => call.table === 'questions');
      const ratio = afterBytes / beforeBytes;
      lines.push(`${label}, ${mode} x${count}: before ${(beforeBytes / 1e6).toFixed(2)} MB in ${before.db.requests((c) => c.table === 'questions')} requests, after ${(afterBytes / 1e6).toFixed(2)} MB in ${after.db.requests((c) => c.table === 'questions')} requests (${(ratio * 100).toFixed(0)}%), full rows read ${after.stats.fullRowsRead}, rounds ${after.stats.rounds}`);
      assert.ok(before.db.calls.some(isWholeSubjectRead), 'the before run is the old whole-subject read');
      assert.ok(ratio < limit, `${label} ${mode} x${count}: ${ratio.toFixed(2)} >= ${limit}`);
    }
  }
  console.log(lines.map((line) => `  [bytes] ${line}`).join('\n'));
});

test('the pool is kept for five minutes per server: a repeat start reads only the picked rows', async () => {
  const bank = subjectBank(7);
  let now = 1_000_000;
  const caches = { pools: new Map() };
  const first = await start(bank, { count: 10, caches, clock: () => now });
  assert.ok(first.db.requests(isPoolRead) >= 1);
  now += PRACTICE_POOL_CACHE_MS - 1;
  const second = await start(bank, { count: 10, caches, clock: () => now });
  assert.equal(second.db.requests(isPoolRead), 0);
  assert.equal(second.db.requests(isManagedScan), 0);
  assert.equal(second.db.requests((call) => call.head), 0, 'inside the five minutes nothing is asked');
  assert.deepEqual(second.result.selected.map((row) => row.id), first.result.selected.map((row) => row.id));
  assert.ok(second.db.bytes() < first.db.bytes() * 0.7, `${second.db.bytes()} vs ${first.db.bytes()}`);
  // Different chapters, or another difficulty, are separate pools.
  const chapter = await start(bank, { count: 10, caches, clock: () => now, opts: { chapter: 'Ratios' } });
  assert.ok(chapter.db.requests(isPoolRead) >= 1);
});

// Egress F3 (20 Oct 2026): after the five minutes, an unchanged subject is revalidated with two head counts instead of read again.
test('after five minutes an unchanged subject costs two head counts and no pool read; the picks are the ones a fresh read gives', async () => {
  const bank = subjectBank(7).map((row) => ({ ...row, updated_at: '2026-09-01T00:00:00.000Z' }));
  let now = Date.parse('2026-10-20T10:00:00.000Z');
  const caches = { pools: new Map() };
  const first = await start(bank, { count: 10, caches, clock: () => now });
  now += PRACTICE_POOL_CACHE_MS + 1000;
  const late = await start(bank, { count: 10, caches, clock: () => now });
  assert.equal(late.db.requests(isPoolRead), 0, 'no pool read');
  assert.equal(late.db.requests(isManagedScan), 0, 'no managed-id scan');
  const heads = late.db.calls.filter((call) => call.head);
  assert.equal(heads.length, 2);
  assert.ok(heads.every((call) => call.filters.includes('eq:subject') && call.bytes === 0));
  assert.ok(heads.some((call) => call.filters.includes('gte:updated_at')));
  // The picks equal those of a start with no cache at all (the old read), over the same bank.
  const uncached = await start(bank, { count: 10, clock: () => now });
  assert.deepEqual(late.result.selected.map((row) => row.id), uncached.result.selected.map((row) => row.id));
  assert.deepEqual(late.result.selected.map((row) => row.id), first.result.selected.map((row) => row.id));
  // and the entry is fresh again for five minutes
  const soon = await start(bank, { count: 10, caches, clock: () => now + 1000 });
  assert.equal(soon.db.requests((call) => call.head), 0);
});

test('a touched row, an insert, a hard delete, a count error or a pool older than a day each read the pool again', async () => {
  const MIN = 60_000;
  const cases = [
    ['a row written since the read (a vote, an edit, a withdrawal)', (bank, at) => { const row = bank.find((r) => r.subject === SUBJECT && r.status === 'live'); row.score = 1; row.updated_at = new Date(at + MIN).toISOString(); }],
    ['a row inserted', (bank, at) => { bank.push({ ...bank.find((r) => r.subject === SUBJECT && r.status === 'live'), id: 'q-new-1', updated_at: new Date(at + MIN).toISOString() }); }],
    ['a row removed', (bank) => { bank.splice(bank.findIndex((r) => r.subject === SUBJECT), 1); }],
  ];
  for (const [name, change] of cases) {
    const bank = subjectBank(9, { legacy: 120, managed: 30 }).map((row) => ({ ...row, updated_at: '2026-09-01T00:00:00.000Z' }));
    const at = Date.parse('2026-10-20T10:00:00.000Z');
    let now = at;
    const caches = { pools: new Map() };
    await start(bank, { count: 10, caches, clock: () => now });
    change(bank, at);
    now = at + PRACTICE_POOL_CACHE_MS + 2 * MIN;
    const after = await start(bank, { count: 10, caches, clock: () => now });
    assert.ok(after.db.requests(isPoolRead) >= 1, name);
  }
  // an error in the check reads again, exactly as before the check existed
  const bank = subjectBank(9, { legacy: 120, managed: 30 }).map((row) => ({ ...row, updated_at: '2026-09-01T00:00:00.000Z' }));
  let now = Date.parse('2026-10-20T10:00:00.000Z');
  const caches = { pools: new Map() };
  await start(bank, { count: 10, caches, clock: () => now });
  now += PRACTICE_POOL_CACHE_MS + 1000;
  const failing = await start(bank, { count: 10, caches, clock: () => now, failOn: ({ columns, filters }) => (columns === 'id' && filters.includes('gte:updated_at') ? { code: 'XX000', message: 'down' } : null) });
  assert.ok(failing.db.requests(isPoolRead) >= 1, 'a count error');
  // older than a day: read again even though nothing changed
  const old = { pools: new Map() };
  let t = Date.parse('2026-10-20T10:00:00.000Z');
  await start(bank, { count: 10, caches: old, clock: () => t });
  t += POOL_REVALIDATE_MAX_MS + 1000;
  const aged = await start(bank, { count: 10, caches: old, clock: () => t });
  assert.ok(aged.db.requests(isPoolRead) >= 1);
  assert.equal(aged.db.calls.filter((call) => call.head && call.filters.includes('gte:updated_at')).length, 0, 'the day limit is checked before the revalidation counts');
});

test('a chapter-filtered pool is revalidated with the subject token like any other, and at most twelve pools are kept', async () => {
  const bank = subjectBank(11, { legacy: 120, managed: 30 }).map((row) => ({ ...row, updated_at: '2026-09-01T00:00:00.000Z' }));
  let now = Date.parse('2026-10-20T10:00:00.000Z');
  const caches = { pools: new Map() };
  await start(bank, { count: 10, caches, clock: () => now, opts: { chapter: 'Ratios' } });
  now += PRACTICE_POOL_CACHE_MS + 1000;
  const late = await start(bank, { count: 10, caches, clock: () => now, opts: { chapter: 'Ratios' } });
  assert.equal(late.db.requests(isPoolRead), 0);
  assert.equal(late.db.requests((call) => call.head), 2);
  for (let i = 0; i < 20; i += 1) await start(bank, { count: 10, caches, clock: () => now, opts: { chapters: [`Chapter ${i}`] } });
  assert.ok(caches.pools.size <= 12, `${caches.pools.size} pools kept`);
});

test('a database without the vote columns still serves the start: the pool read is repeated without the score filter', async () => {
  const bank = subjectBank(3, { legacy: 300, managed: 40 });
  const failOn = ({ columns, filters }) => (columns === PRACTICE_LIGHT_SELECT && filters.includes('gte:score')
    ? { code: '42703', message: 'column questions.score does not exist' } : null);
  const { db, result } = await start(bank, { count: 10, failOn });
  assert.ok(result.selected.length > 0);
  const reads = db.calls.filter(isPoolRead);
  assert.ok(reads.some((call) => call.error === '42703'));
  assert.ok(reads.some((call) => !call.error && !call.filters.includes('gte:score')));
});

test('a start on a subject with no matching rows reads nothing heavy', async () => {
  const { db, result } = await start(subjectBank(5, { legacy: 30, managed: 5 }), { count: 10, opts: { chapter: 'No Such Chapter' } });
  assert.deepEqual(result.selected, []);
  assert.equal(db.requests(isPickRead), 0);
  assert.ok(db.bytes() < 50_000);
});
