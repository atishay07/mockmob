import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { NTA_TOUCH_MARGIN_MS, ntaTouchedCount, refreshStaleNtaIndexes } from '../nta_index.js';
import { FIXTURE_SECRET } from './ntaEngineFixtures.mjs';
import { BUILT, OLD, PRODUCTION, fakeDb, indexRows, setup, sideTables } from './ntaIndexFakeDb.mjs';
import { FIXTURE_SECRET as SECRET2, makeBank } from './ntaEngineFixtures.mjs';
import { NTA_POOL_CACHE_MS, NTA_POOL_REVALIDATE_MAX_MS, buildNtaPaper, clearNtaPoolCache } from '../nta_pool.js';

// Egress item F2 (20 Oct 2026): the daily NTA index safety pass asks one head count before it reads a subject's drift.
const CLOCK = Date.parse('2026-10-14T12:00:00.000Z'); // a day after BUILT
const builtAt = Date.parse(BUILT);

function worldFor() {
  const { questions, indexed } = setup({ published: OLD });
  const db = fakeDb({ questions: questions.map((row) => ({ ...row })), nta_question_index: indexRows(indexed, 'chemistry'), ...sideTables });
  return { db, indexed };
}
const driftReads = (db) => db.calls.filter(([kind, table, columns]) => kind === 'select' && table === 'nta_question_index' && String(columns).includes('content_hash')).length;

test('F2: a subject with nothing written since its build is fresh without a drift read', async () => {
  const { db } = worldFor();
  let drift = 0;
  const touchedCalls = [];
  const out = await refreshStaleNtaIndexes(db, {
    secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK,
    touched: async (client, subject, at) => { touchedCalls.push([subject, at]); return 0; },
    drift: async () => { drift += 1; return { checked: 0, drifted: [] }; },
    rebuild: async () => { throw new Error('must not rebuild'); },
  });
  assert.equal(out.subjects[0].skipped, 'fresh');
  assert.equal(drift, 0, 'the drift read was skipped');
  assert.deepEqual(touchedCalls, [['chemistry', builtAt]]);
});

test('F2: a touched row (a vote or an edit), a count error and an unreadable count all run the drift read as before', async () => {
  for (const [name, touched] of [['touched', async () => 3], ['error', async () => null], ['throws', async () => { throw new Error('down'); }]]) {
    const { db } = worldFor();
    let drift = 0;
    let rebuilt = 0;
    const out = await refreshStaleNtaIndexes(db, {
      secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK, log: () => {}, touched,
      drift: async () => { drift += 1; return { checked: 5, drifted: name === 'touched' ? ['q1'] : [] }; },
      rebuild: async (client, subject) => { rebuilt += 1; return { subject, written: 1, indexed: 5, removed: 0 }; },
    });
    if (name === 'throws') { assert.equal(out.subjects[0].error, 'down', 'an error of the count itself is the old error path'); continue; }
    assert.equal(drift, 1, name);
    if (name === 'touched') { assert.equal(out.subjects[0].reason, 'content_changed'); assert.equal(rebuilt, 1); } else assert.equal(out.subjects[0].skipped, 'fresh');
  }
});

test('F2: max_age still rebuilds without asking the count', async () => {
  const { db } = worldFor();
  const never = async () => { throw new Error('the count must not be asked'); };
  const old = await refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => builtAt + 8 * 24 * 3_600_000, touched: never, drift: never,
    rebuild: async (client, subject) => ({ subject, written: 1, indexed: 1, removed: 0 }) });
  assert.equal(old.subjects[0].reason, 'max_age');
});

test('F2: ntaTouchedCount is a head count of the subject since the build minus the margin, and null on any error', async () => {
  const seen = [];
  const countDb = (result) => ({ from(table) {
    const q = { select(columns, opts) { seen.push({ table, columns, opts }); return q; }, eq(c, v) { seen.push({ eq: [c, v] }); return q; }, gte(c, v) { seen.push({ gte: [c, v] }); return q; }, then(res) { return Promise.resolve(result).then(res); } };
    return q;
  } });
  assert.equal(await ntaTouchedCount(countDb({ count: 0, error: null }), 'chemistry', builtAt), 0);
  assert.deepEqual(seen[0], { table: 'questions', columns: 'id', opts: { count: 'exact', head: true } });
  assert.deepEqual(seen[1], { eq: ['subject', 'chemistry'] });
  assert.deepEqual(seen[2], { gte: ['updated_at', new Date(builtAt - NTA_TOUCH_MARGIN_MS).toISOString()] });
  assert.equal(await ntaTouchedCount(countDb({ count: 4, error: null }), 'chemistry', builtAt), 4);
  assert.equal(await ntaTouchedCount(countDb({ count: null, error: { message: 'x' } }), 'chemistry', builtAt), null);
  assert.equal(await ntaTouchedCount(countDb({ count: null, error: null }), 'chemistry', builtAt), null);
  assert.equal(await ntaTouchedCount({ from() { throw new Error('boom'); } }, 'chemistry', builtAt), null);
  assert.equal(NTA_TOUCH_MARGIN_MS, 15 * 60 * 1000);
});

test('F2: against a database that counts, an untouched subject costs no drift read, a touched one does (the real head count, end to end)', async () => {
  const { db } = worldFor();
  const quiet = await refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK });
  assert.equal(quiet.subjects[0].skipped, 'fresh');
  assert.equal(driftReads(db), 0, 'the head count said nothing was written since the build');
  assert.ok(db.calls.some(([kind, table, , head]) => kind === 'select' && table === 'questions' && head === 'head'), 'one head count ran');
  // a write since the build (a vote, an edit) makes the count non-zero and the old drift read runs
  const touched = worldFor();
  touched.db.tables.questions[0].updated_at = new Date(CLOCK - 3600_000).toISOString();
  const out = await refreshStaleNtaIndexes(touched.db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK });
  assert.equal(out.subjects[0].skipped, 'fresh', 'a vote changes no content, so the drift read finds nothing and the subject is still fresh');
  assert.ok(driftReads(touched.db) >= 1, 'but it was read');
});

// ---- F13: the NTA pool kept behind a subject token --------------------------------------------------------------------
function poolWorld() {
  const questions = makeBank('chemistry').map((row) => ({ ...row, created_at: OLD, live_at: OLD, updated_at: OLD }));
  const db = fakeDb({ questions, nta_question_index: indexRows(questions, 'chemistry', BUILT), ...sideTables });
  return { db, questions };
}
const indexRowReads = (db) => db.calls.filter(([kind, table, columns]) => kind === 'select' && table === 'nta_question_index' && String(columns).includes('content_hash')).length;
const slimReads = (db) => db.calls.filter(([kind, table, columns, head]) => kind === 'select' && table === 'questions' && head !== 'head' && String(columns).includes('options')).length;
const ids = (result) => result.rows.map((q) => q.id);

test('F13: an NTA pool older than five minutes whose subject and index are unchanged is reused (head counts and one small select), the paper is the same', async () => {
  clearNtaPoolCache();
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-14T12:00:00.000Z') });
  try {
    const { db, questions } = poolWorld();
    const build = () => buildNtaPaper(db, 'chemistry', { seed: 'f13', seenIds: new Set() });
    const first = await build();
    assert.equal(indexRowReads(db), 1);
    const firstSlim = slimReads(db);
    assert.ok(firstSlim >= 1);
    mock.timers.tick(NTA_POOL_CACHE_MS - 1000);
    await build();
    assert.equal(indexRowReads(db), 1, 'inside five minutes: from memory');
    db.calls.length = 0;
    mock.timers.tick(NTA_POOL_CACHE_MS);
    const second = await build();
    assert.equal(indexRowReads(db), 0, 'after five minutes, unchanged: the index rows are not read again');
    assert.equal(slimReads(db), 0, 'nor the question rows');
    assert.equal(db.calls.filter(([, , , head]) => head === 'head').length, 2, 'two head counts');
    assert.deepEqual(JSON.stringify(ids(second)), JSON.stringify(ids(first)), 'the same paper');
    assert.equal(second.status, first.status);
    assert.ok(ids(first).length > 10);
    // a write since the read (a vote, an edit) reads the pool again
    questions[0].updated_at = new Date(Date.now() + 1000).toISOString();
    db.tables.questions[0].updated_at = questions[0].updated_at;
    mock.timers.tick(NTA_POOL_CACHE_MS + 1000);
    db.calls.length = 0;
    await build();
    assert.equal(indexRowReads(db), 1, 'a touched row reads the pool again');
    // a pool older than an hour is read again whatever the check says
    mock.timers.tick(NTA_POOL_CACHE_MS + 1000);
    await build();
    db.calls.length = 0;
    mock.timers.tick(NTA_POOL_REVALIDATE_MAX_MS + 1000);
    await build();
    assert.equal(indexRowReads(db), 1, 'older than an hour');
    // a removed question (hard delete) changes the count
    db.tables.questions.pop();
    mock.timers.tick(NTA_POOL_CACHE_MS + 1000);
    db.calls.length = 0;
    await build();
    assert.equal(indexRowReads(db), 1, 'a row removed');
    // a new index build (the max verified_at moved) reads the pool again
    db.tables.nta_question_index.forEach((row) => { row.verified_at = new Date(Date.now()).toISOString(); });
    mock.timers.tick(NTA_POOL_CACHE_MS + 1000);
    db.calls.length = 0;
    await build();
    assert.equal(indexRowReads(db), 1, 'a new index build');
  } finally {
    mock.timers.reset();
    clearNtaPoolCache();
  }
  assert.ok(SECRET2);
});
