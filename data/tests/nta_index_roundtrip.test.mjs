// The index signature must survive a round trip through Postgres (16 Oct 2026 incident: every row built at
// 14:01 IST failed score_signature_invalid at runtime). The builder holds verified_at as a JS ISO string
// (ending in Z) and scores as JS numbers; PostgREST hands back timestamptz with a +00:00 offset and numeric(4,2)
// rounded to 2 decimals, so a signature over the raw JS values never matched what the runtime read.
// No network: an in-memory database whose column coercion follows nta_question_index's column types.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { canonicalJSON } from '../canonical_json.mjs';
import { NTA_INDEX_VERSION, ntaIndexSignedBody, ntaScoreIntegrity, signNtaIndex } from '../nta_engine.js';
import { buildNtaIndexRows, rebuildNtaIndexSubject } from '../nta_index.js';
import { loadNtaPoolFromIndex } from '../nta_pool.js';
import { FIXTURE_SECRET, makeBank } from './ntaEngineFixtures.mjs';
import { OLD, fakeDb, sideTables } from './ntaIndexFakeDb.mjs';

// What Postgres stores and PostgREST returns for each column type of nta_question_index.
function timestamptz(value) {
  return new Date(value).toISOString().replace('Z', '+00:00'); // PostgREST spells the offset out
}
function numeric42(value) {
  if (value === null || value === undefined) return null;
  const sign = value < 0 ? -1 : 1;
  return sign * Number((Math.round(Math.abs(value) * 100 + 1e-9) / 100).toFixed(2)); // numeric(4,2): half away from zero
}
const toPostgres = (row) => ({ ...row, score: numeric42(row.score), luna: numeric42(row.luna), gemini: numeric42(row.gemini), verified_at: timestamptz(row.verified_at) });

function postgrestShaped(db) {
  return {
    ...db,
    from(table) {
      const query = db.from(table);
      if (table !== 'nta_question_index') return query;
      const upsert = query.upsert.bind(query);
      query.upsert = (rows, options) => upsert(rows.map(toPostgres), options);
      return query;
    },
  };
}

// Judge scores with more than two decimals, as the factory records can hold.
const awkward = [8.333, 7.126, 9, 8.5, 6.995];
const bank = () => { let n = 0; return makeBank('chemistry', { scoreFor: () => awkward[n++ % awkward.length] })
    .map((row) => ({ ...row, created_at: OLD, live_at: OLD })); };
const BUILD_TIME = new Date('2026-10-16T08:31:49.324Z');

test('the signed body is one spelling for the builder instant and the Postgres instant, and for raw and rounded scores', () => {
  const built = { question_id: 'q', subject: 'chemistry', score: 8.125, luna: 8.333, gemini: 7.126, content_hash: 'h', index_version: NTA_INDEX_VERSION, verified_at: '2026-10-16T08:31:49.324Z' };
  const read = { ...built, score: 8.13, luna: 8.33, gemini: 7.13, verified_at: '2026-10-16T08:31:49.324+00:00' };
  assert.deepEqual(ntaIndexSignedBody(built), ntaIndexSignedBody(read));
  assert.equal(signNtaIndex(built, FIXTURE_SECRET), signNtaIndex(read, FIXTURE_SECRET));
  assert.equal(ntaIndexSignedBody(read).verified_at, '2026-10-16T08:31:49.324Z');
  assert.equal(ntaIndexSignedBody({ ...built, luna: null, gemini: null }).luna, null, 'null stays null');
  assert.equal(ntaIndexSignedBody({ ...built, luna: '8.30' }).luna, 8.3, 'a numeric that arrives as text is the same number');
});

test('the old, unnormalised body is what failed: it differs the moment the row leaves Postgres', () => {
  const rawBody = (row) => ({ question_id: row.question_id, subject: row.subject, score: Number(row.score), luna: row.luna ?? null, gemini: row.gemini ?? null, content_hash: row.content_hash, index_version: row.index_version, verified_at: row.verified_at });
  const built = { question_id: 'q', subject: 'chemistry', score: 8.5, luna: 8, gemini: 9, content_hash: 'h', index_version: NTA_INDEX_VERSION, verified_at: '2026-10-16T08:31:49.324Z' };
  const read = toPostgres(built);
  const oldSign = (row) => createHmac('sha256', FIXTURE_SECRET).update(canonicalJSON(rawBody(row))).digest('hex');
  assert.notEqual(oldSign(built), oldSign(read), 'the previous scheme: verified_at Z versus +00:00 broke the signature');
  assert.equal(signNtaIndex(built, FIXTURE_SECRET), signNtaIndex(read, FIXTURE_SECRET), 'the canonical scheme agrees');
});

test('build, write, read back exactly as PostgREST returns it, and every row verifies at runtime', async () => {
  const db = postgrestShaped(fakeDb({ questions: bank(), nta_question_index: [], ...sideTables }));
  const built = await rebuildNtaIndexSubject(db, 'chemistry', { secret: FIXTURE_SECRET, now: BUILD_TIME });
  assert.ok(built.indexed > 0);
  const stored = db.tables.nta_question_index;
  assert.ok(stored.every((row) => row.verified_at.endsWith('+00:00')), 'the fake returns the Postgres spelling');
  assert.ok(stored.every((row) => Number.isInteger(Math.round(row.score * 100))), 'scores are stored with 2 decimals');
  assert.ok(stored.some((row) => row.luna === 8.33) && stored.some((row) => row.luna === 7.13), 'the awkward judge scores were rounded by the builder');
  const rows = await loadNtaPoolFromIndex(db, 'chemistry', { checkFresh: false });
  assert.equal(rows.length, stored.length);
  for (const row of rows) {
    assert.deepEqual(ntaScoreIntegrity(row, { secret: FIXTURE_SECRET }), [], `row ${row.id} verifies`);
  }
});

test('the builder stores exactly the rounded values it signed', async () => {
  const db = fakeDb({ questions: bank(), nta_question_index: [], ...sideTables });
  const { rows } = await buildNtaIndexRows(db, 'chemistry', { secret: FIXTURE_SECRET, now: BUILD_TIME });
  assert.ok(rows.length > 0);
  for (const row of rows) {
    for (const field of ['score', 'luna', 'gemini']) assert.equal(row[field], numeric42(row[field]), `${field} is already what numeric(4,2) returns`);
    assert.equal(row.signature, signNtaIndex(toPostgres(row), FIXTURE_SECRET));
  }
});

test('verification still accepts only correctly signed rows', async () => {
  const db = postgrestShaped(fakeDb({ questions: bank(), nta_question_index: [], ...sideTables }));
  await rebuildNtaIndexSubject(db, 'chemistry', { secret: FIXTURE_SECRET, now: BUILD_TIME });
  const [row] = await loadNtaPoolFromIndex(db, 'chemistry', { checkFresh: false });
  const check = (edit, secret = FIXTURE_SECRET) => ntaScoreIntegrity({ ...row, nta_index: { ...row.nta_index, ...edit } }, { secret });
  assert.deepEqual(check({}), []);
  assert.ok(check({ score: 9.5 }).includes('score_signature_invalid'), 'a changed score');
  assert.ok(check({ luna: 10 }).includes('score_signature_invalid'), 'a changed judge score');
  assert.ok(check({ verified_at: '2026-10-17T08:31:49.324+00:00' }).includes('score_signature_invalid'), 'a changed instant');
  assert.ok(check({ subject: 'physics' }).includes('score_signature_invalid'), 'a changed subject');
  assert.ok(check({ signature: 'f'.repeat(64) }).includes('score_signature_invalid'), 'a forged signature');
  assert.ok(check({}, 'another-key').includes('score_signature_invalid'), 'another signing key');
  assert.ok(check({ verified_at: 'not a date' }).includes('score_signature_invalid'), 'an unparseable instant fails closed, it does not throw');
});
