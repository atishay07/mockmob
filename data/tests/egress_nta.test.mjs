import test from 'node:test';
import assert from 'node:assert/strict';
import { NTA_TOUCH_MARGIN_MS, ntaTouchedCount, refreshStaleNtaIndexes } from '../nta_index.js';
import { FIXTURE_SECRET } from './ntaEngineFixtures.mjs';
import { BUILT, OLD, PRODUCTION, fakeDb, indexRows, setup, sideTables } from './ntaIndexFakeDb.mjs';

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

test('F2: the drift read of a fake database that cannot count still runs (the old behaviour)', async () => {
  const { db } = worldFor();
  const out = await refreshStaleNtaIndexes(db, { secret: FIXTURE_SECRET, env: PRODUCTION, subjects: ['chemistry'], now: () => CLOCK });
  assert.equal(out.subjects[0].skipped, 'fresh');
  assert.ok(driftReads(db) >= 1, 'the fake has no count, so the count is null and the drift read happened');
});
