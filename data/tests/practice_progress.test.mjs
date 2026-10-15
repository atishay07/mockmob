// A student's progress for the practice picker is read in id chunks (data/practice_progress.js). Before, one
// `.in('question_id', ids)` carried the whole pool; past roughly 700 ids the request URL was refused, the error
// was swallowed and the picker saw "no history" (Accountancy was the first to hit it). No network: an in-memory
// database that, like the gateway, refuses an `.in()` list whose URL would be too long.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROGRESS_CONCURRENCY, PROGRESS_ID_CHUNK, readConceptBuckets, readUserProgress } from '../practice_progress.js';

const URL_LIMIT = 8192; // a common gateway limit for the whole request line
const idOf = (n) => `q-${String(n).padStart(5, '0')}-0000-4000-8000-000000000000`; // 36 characters, like a uuid

function fakeDb({ progress = [], questions = [], failChunks = null, error = null, missing = false } = {}) {
  const log = { requests: [], inFlight: 0, maxInFlight: 0 };
  const from = (table) => {
    const filters = [];
    let columns = '*';
    let order = null;
    let range = null;
    let ids = null;
    const query = {
      select(value) { columns = value; return query; },
      eq(column, value) { filters.push((row) => row[column] === value); return query; },
      gt(column, value) { filters.push((row) => Number(row[column]) > value); return query; },
      in(column, values) { ids = values; filters.push((row) => values.includes(row[column])); return query; },
      order(column) { order = column; return query; },
      range(from_, to) { range = [from_, to]; return query; },
      then(resolve, reject) {
        log.requests.push({ table, ids: ids ? ids.length : null, range });
        log.inFlight += 1;
        log.maxInFlight = Math.max(log.maxInFlight, log.inFlight);
        const respond = async () => {
          await new Promise((done) => setTimeout(done, 2));
          log.inFlight -= 1;
          if (missing) return { data: null, error: { code: '42P01', message: 'relation does not exist' } };
          if (error && error(table, ids, log.requests.length)) return { data: null, error: { code: 'XX000', message: 'boom' } };
          if (ids && ids.join(',').length + 120 > URL_LIMIT) return { data: null, error: { code: 'PGRST000', message: 'URI too long' } };
          if (failChunks && ids && failChunks(ids)) return { data: null, error: { code: 'XX000', message: 'chunk refused' } };
          let rows = (table === 'questions' ? questions : progress).filter((row) => filters.every((filter) => filter(row)));
          if (order) rows = [...rows].sort((a, b) => (a[order] < b[order] ? -1 : a[order] > b[order] ? 1 : 0));
          if (range) rows = rows.slice(range[0], range[1] + 1);
          if (columns !== '*') {
            const keep = columns.split(',').map((value) => value.trim());
            rows = rows.map((row) => Object.fromEntries(keep.filter((key) => key in row).map((key) => [key, row[key]])));
          }
          return { data: rows, error: null };
        };
        return respond().then(resolve, reject);
      },
    };
    return query;
  };
  return { from, log };
}

const progressRows = (userId, count, { subject = 'accountancy', every = 1 } = {}) => Array.from({ length: count }, (_, i) => ({
  user_id: userId, question_id: idOf(i * every), subject, attempt_count: 2, correct_count: i % 2, last_attempted_at: '2026-10-01T00:00:00.000Z',
}));

test('a pool of 2,500 ids is read in short requests and returns every row the student has', async () => {
  const pool = Array.from({ length: 2500 }, (_, i) => idOf(i));
  const mine = progressRows('u1', 2500, { every: 1 }).filter((row, i) => i % 5 === 0); // 500 attempted questions
  const db = fakeDb({ progress: [...mine, ...progressRows('someone-else', 2500)] });
  const result = await readUserProgress(db, 'u1', pool, { warn: () => assert.fail('no failure expected') });
  assert.equal(result.size, mine.length, 'the whole history is there, not nothing');
  assert.equal(result.incomplete, false);
  assert.equal(result.failedChunks, 0);
  assert.deepEqual([...result.keys()].sort(), mine.map((row) => row.question_id).sort());
  assert.deepEqual(Object.keys(result.get(mine[0].question_id)).sort(), ['attempt_count', 'correct_count', 'last_attempted_at', 'question_id']);
  const reads = db.log.requests.filter((request) => request.table === 'user_question_progress');
  assert.equal(reads.length, Math.ceil(2500 / PROGRESS_ID_CHUNK));
  assert.ok(reads.every((request) => request.ids <= PROGRESS_ID_CHUNK));
  assert.ok(db.log.maxInFlight <= PROGRESS_CONCURRENCY && db.log.maxInFlight > 1, `bounded parallelism (saw ${db.log.maxInFlight})`);
});

test('the old shape (one request with every id) is refused by the fake gateway at 700 ids, and the chunked read returns all 700', async () => {
  const pool = Array.from({ length: 700 }, (_, i) => idOf(i));
  const db = fakeDb({ progress: progressRows('u1', 700) });
  const { error } = await db.from('user_question_progress').select('question_id').eq('user_id', 'u1').in('question_id', pool);
  assert.equal(error.message, 'URI too long');
  const result = await readUserProgress(db, 'u1', pool);
  assert.equal(result.size, 700);
});

test('duplicates are read once, empty values are dropped, and nothing is asked for an empty list or without a user', async () => {
  const db = fakeDb({ progress: progressRows('u1', 5) });
  const ids = [idOf(0), idOf(0), idOf(1), null, undefined, idOf(1)];
  const result = await readUserProgress(db, 'u1', ids);
  assert.deepEqual([...result.keys()].sort(), [idOf(0), idOf(1)]);
  assert.deepEqual(db.log.requests.map((request) => request.ids), [2]);
  for (const [user, list] of [['u1', []], ['u1', null], ['', [idOf(0)]], [null, [idOf(0)]]]) {
    const quiet = fakeDb({ progress: progressRows('u1', 5) });
    const out = await readUserProgress(quiet, user, list);
    assert.equal(out.size, 0);
    assert.equal(out.incomplete, false);
    assert.equal(quiet.log.requests.length, 0);
  }
});

test('one failing chunk costs only its own ids, is flagged and logged once; a missing table stays quiet', async () => {
  const pool = Array.from({ length: 450 }, (_, i) => idOf(i));
  const lines = [];
  const poisoned = new Set(pool.slice(100, 200));
  const db = fakeDb({ progress: progressRows('u1', 450), failChunks: (ids) => ids.some((id) => poisoned.has(id)) });
  const result = await readUserProgress(db, 'u1', pool, { warn: (line) => lines.push(line) });
  assert.equal(result.size, 350, 'the other four chunks still count');
  assert.equal(result.incomplete, true);
  assert.equal(result.failedChunks, 1);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /1 of 5 progress reads failed \(chunk refused\)/);
  const quiet = [];
  const noTable = await readUserProgress(fakeDb({ missing: true }), 'u1', pool, { warn: (line) => quiet.push(line) });
  assert.equal(noTable.size, 0);
  assert.equal(noTable.incomplete, true);
  assert.deepEqual(quiet, [], 'older environments without the table degrade without noise, as before');
  // A client that throws instead of returning an error is handled the same way.
  const throwing = { from: () => { throw new Error('socket closed'); } };
  const thrown = await readUserProgress(throwing, 'u1', [idOf(1)], { warn: (line) => quiet.push(line) });
  assert.equal(thrown.size, 0);
  assert.equal(thrown.incomplete, true);
  assert.match(quiet[0], /socket closed/);
});

test('weak-concept buckets: more than 1,000 progress rows are all read, and concepts are looked up in chunks', async () => {
  const progress = progressRows('u1', 2300, { subject: 'accountancy' });
  const questions = progress.map((row, i) => ({ id: row.question_id, concept_id: `concept-${i % 7}` }));
  const db = fakeDb({ progress: [...progress, ...progressRows('u1', 50, { subject: 'economics' })], questions });
  const buckets = await readConceptBuckets(db, 'u1', 'accountancy');
  assert.equal(buckets.incomplete, false);
  assert.equal(buckets.size, 7);
  const attempts = [...buckets.values()].reduce((sum, bucket) => sum + bucket.attempts, 0);
  assert.equal(attempts, 2300 * 2, 'every row counted once, none lost past the first 1,000');
  const progressReads = db.log.requests.filter((request) => request.table === 'user_question_progress');
  assert.equal(progressReads.length, 3, 'three pages of 1,000');
  const conceptReads = db.log.requests.filter((request) => request.table === 'questions');
  assert.equal(conceptReads.length, Math.ceil(2300 / PROGRESS_ID_CHUNK));
  assert.ok(conceptReads.every((request) => request.ids <= PROGRESS_ID_CHUNK));
  // Questions without a concept are skipped, as before.
  const sparse = await readConceptBuckets(fakeDb({ progress: progressRows('u1', 3), questions: [{ id: idOf(0), concept_id: 'c' }, { id: idOf(1), concept_id: null }] }), 'u1', 'accountancy');
  assert.deepEqual([...sparse.entries()], [['c', { attempts: 2, correct: 0 }]]);
});

test('weak-concept buckets degrade to "no weak topics" with a flag and one line when a read fails', async () => {
  const lines = [];
  const first = await readConceptBuckets(fakeDb({ error: (table) => table === 'user_question_progress' }), 'u1', 'accountancy', { warn: (line) => lines.push(line) });
  assert.equal(first.size, 0);
  assert.equal(first.incomplete, true);
  assert.match(lines[0], /weak-concept progress read failed/);
  const second = await readConceptBuckets(fakeDb({ progress: progressRows('u1', 4), error: (table) => table === 'questions' }), 'u1', 'accountancy', { warn: (line) => lines.push(line) });
  assert.equal(second.size, 0);
  assert.equal(second.incomplete, true);
  assert.match(lines[1], /concept lookup failed/);
  const quiet = [];
  await readConceptBuckets(fakeDb({ missing: true }), 'u1', 'accountancy', { warn: (line) => quiet.push(line) });
  assert.deepEqual(quiet, []);
  assert.equal((await readConceptBuckets(fakeDb(), '', 'accountancy')).size, 0);
});

test('data/db.js uses the chunked readers for the practice picker, and no longer sends a whole pool in one in()', () => {
  const db = readFileSync(new URL('../db.js', import.meta.url), 'utf8');
  assert.match(db, /import \{ readUserProgress, readConceptBuckets \} from '\.\/practice_progress';/);
  const start = db.indexOf('async _userProgress(userId, questionIds)');
  const body = db.slice(start, db.indexOf('async getUserVotes('));
  assert.match(body, /readUserProgress\(supabaseAdmin\(\), userId, questionIds\)/);
  assert.match(body, /readConceptBuckets\(supabaseAdmin\(\), userId, subjectId\)/);
  assert.doesNotMatch(body, /\.in\(/, 'no direct in() with an unbounded list is left in either function');
});
