// Cohort time and changes (slice 5; spec tmp/mistake-lab-v4/SPEC.md 4.13): every line behind its gate, the student left out,
// the fallback to the committed snapshot when the nightly table is missing or stale, and the refresh over a fake client.
// The SQL itself (migration, refresh, parity with the paper trace) is data/tests/cohort_time_sql.test.mjs.
// Run: node --test data/tests/cohort_time.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMistakeLab, othersFor, timeLinesFor, slowFindingFor, LAB_RULES, LAB_COPY } from '../mistake_lab.js';
import { COHORT_TIME_RULES, isFresh, medianOf, ownContribution, tableSnapshot, timeRead } from '../cohort_time.js';
import { cohortForAttempt } from '../cohort_picks.js';
import { optionHash } from '../option_hash.js';
import { correctIndex } from '../recovery.js';
import { fixtureCohortTime } from '../cohort_time_preview.js';
import { readCohortWithTime, refreshCohortStats, describeCohortRun, statsMissing } from '../../src/lib/server/cohortStats.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const fixture = (name) => JSON.parse(read(`data/tests/fixtures/mistake_lab/${name}.json`));
const clone = (v) => JSON.parse(JSON.stringify(v));
const REPLAY = fixture('replay_full_input');
const COHORT = fixture('full_mock_cohort');
const NOW = Date.parse('2026-10-17T03:00:00Z');

// ---------- the gates, line by line ----------

// "4 of them" keeps its number with "of" (a no-break space) so a phone never ends a line on the number.
const plain = (lines) => lines.map((l) => l.replace(/ /g, ' '));
const time = (over = {}) => ({ right: { n: 34, medianMs: 51000 }, timed: 27, changed: 6, movedOff: 4, strike: { n: 30, struck: 9 }, ...over });

test('the three lines of the opened answer say what spec 4.13 says, with denominators', () => {
  assert.deepEqual(plain(timeLinesFor(time())), [
    'Students who got this right took a median of 51s (34 students).',
    '6 of 27 timed students changed their answer here. 4 of them moved off the key.',
    '9 of 30 students crossed out the key here.',
  ]);
});

test('median line: hidden under 30 timed right answers (student left out), shown at 30', () => {
  assert.equal(LAB_RULES.timeMedianMin, 30);
  assert.deepEqual(timeLinesFor(time({ right: { n: 29, medianMs: 51000 }, timed: 0, strike: { n: 0, struck: 0 } })), []);
  assert.equal(timeLinesFor(time({ right: { n: 30, medianMs: 51000 }, timed: 0, strike: { n: 0, struck: 0 } }))[0], 'Students who got this right took a median of 51s (30 students).');
  assert.deepEqual(timeLinesFor(time({ right: null, timed: 0, strike: { n: 0, struck: 0 } })), []);
  assert.match(timeLinesFor(time({ right: { n: 40, medianMs: 125000 }, timed: 0, strike: { n: 0, struck: 0 } }))[0], /a median of 2m 05s \(40 students\)/);
});

test('changes line: hidden under 20 timed students, shown at 20; the forms for none, one and many', () => {
  assert.equal(LAB_RULES.timeChangesMin, 20);
  const only = (over) => plain(timeLinesFor({ right: null, strike: { n: 0, struck: 0 }, ...over }));
  assert.deepEqual(only({ timed: 19, changed: 6, movedOff: 4 }), []);
  assert.deepEqual(only({ timed: 20, changed: 6, movedOff: 4 }), ['6 of 20 timed students changed their answer here. 4 of them moved off the key.']);
  assert.deepEqual(only({ timed: 20, changed: 0, movedOff: 0 }), ['None of the 20 timed students changed their answer here.']);
  assert.deepEqual(only({ timed: 24, changed: 1, movedOff: 1 }), ['1 of 24 timed students changed their answer here. That student moved off the key.']);
  assert.deepEqual(only({ timed: 24, changed: 1, movedOff: 0 }), ['1 of 24 timed students changed their answer here. None of them moved off the key.']);
  assert.deepEqual(only({ timed: 24, changed: 5, movedOff: 1 }), ['5 of 24 timed students changed their answer here. 1 of them moved off the key.']);
  assert.deepEqual(only({ timed: 24, changed: 5, movedOff: 0 }), ['5 of 24 timed students changed their answer here. None of them moved off the key.']);
});

test('crossed-out key line: hidden under 20 students with strike data, shown at 20', () => {
  assert.equal(LAB_RULES.timeStrikeMin, 20);
  const only = (strike) => timeLinesFor({ right: null, timed: 0, strike });
  assert.deepEqual(only({ n: 19, struck: 9 }), []);
  assert.deepEqual(only({ n: 20, struck: 9 }), ['9 of 20 students crossed out the key here.']);
  assert.deepEqual(only({ n: 20, struck: 1 }), ['1 of 20 students crossed out the key here.']);
  assert.deepEqual(only({ n: 20, struck: 0 }), ['None of the 20 students crossed out the key here.']);
});

test('no time numbers, no lines: the opened answer is exactly what slice 1 gave', () => {
  assert.deepEqual(timeLinesFor(undefined), []);
  assert.deepEqual(timeLinesFor(null), []);
  const read1 = { n: 20, right: 15, counts: [3, 15, 1, 1], keyIndex: 1 };
  const without = othersFor(read1, { givenIndex: 0, outcome: 'wrong' });
  assert.equal('lines' in without, false);
  const withTime = othersFor({ ...read1, time: time() }, { givenIndex: 0, outcome: 'wrong' });
  assert.equal(withTime.lines.length, 3);
  assert.equal(withTime.line, without.line, 'the picks line is unchanged');
});

// ---------- the ledger finding ----------

const rowOf = (number, ms, outcome = 'wrong', over = {}) => ({ qid: `q${number}`, number, ms, outcome, held: false, brk: false, ...over });
const cohortOf = (rows, right) => ({ byQid: Object.fromEntries(rows.map((r) => [r.qid, { n: 40, time: { right } }])) });

test('ledger finding: 5 questions each with 15 or more timed right answers and more than twice the median', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7].map((n) => rowOf(n, 100000, n <= 3 ? 'right' : 'wrong'));
  const finding = slowFindingFor(cohortOf(rows, { n: 15, medianMs: 40000 }), rows);
  assert.equal(finding.line, 'On 7 questions you took over twice as long as the students who got them right. You got 3 of the 7 right.');
  assert.deepEqual(finding.numbers, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(finding.fine, 'Each of the 7 has 15 or more students who got it right and were timed.');
  assert.equal(slowFindingFor(cohortOf(rows.slice(0, 5), { n: 15, medianMs: 40000 }), rows.slice(0, 5)).line, 'On 5 questions you took over twice as long as the students who got them right. You got 3 of the 5 right.');
  assert.match(slowFindingFor(cohortOf(rows.map((r) => ({ ...r, outcome: 'wrong' })), { n: 15, medianMs: 40000 }), rows.map((r) => ({ ...r, outcome: 'wrong' }))).line, /You got none of the 7 right\.$/);
  assert.match(slowFindingFor(cohortOf(rows.map((r) => ({ ...r, outcome: 'right' })), { n: 15, medianMs: 40000 }), rows.map((r) => ({ ...r, outcome: 'right' }))).line, /You got all 7 right\.$/);
});

test('ledger finding: hidden under 5 questions, under 15 right answers on a question, at exactly twice, for held or break questions', () => {
  const rows = [1, 2, 3, 4, 5].map((n) => rowOf(n, 100000));
  assert.ok(slowFindingFor(cohortOf(rows, { n: 15, medianMs: 40000 }), rows));
  assert.equal(slowFindingFor(cohortOf(rows.slice(0, 4), { n: 15, medianMs: 40000 }), rows.slice(0, 4)), null, 'four is under the gate');
  assert.equal(slowFindingFor(cohortOf(rows, { n: 14, medianMs: 40000 }), rows), null, '14 right answers is under 15');
  assert.equal(slowFindingFor(cohortOf(rows, { n: 15, medianMs: 50000 }), rows), null, 'exactly twice is not over twice');
  assert.equal(slowFindingFor(cohortOf(rows, { n: 15, medianMs: 50000 - 1 }), rows)?.questions, 5, 'a hair over twice counts');
  const held = rows.map((r, i) => (i === 0 ? { ...r, held: true } : r));
  assert.equal(slowFindingFor(cohortOf(held, { n: 15, medianMs: 40000 }), held), null, 'a held question is left out');
  const broke = rows.map((r, i) => (i === 0 ? { ...r, brk: true } : r));
  assert.equal(slowFindingFor(cohortOf(broke, { n: 15, medianMs: 40000 }), broke), null, 'a question with a break is not timed');
  const quick = rows.map((r, i) => (i === 0 ? { ...r, ms: 1500 } : r));
  assert.equal(slowFindingFor(cohortOf(quick, { n: 15, medianMs: 40 }), quick), null, 'under 2 seconds is not timed');
  assert.equal(slowFindingFor({ byQid: {} }, rows), null);
  assert.equal(slowFindingFor(null, rows), null);
});

// ---------- the student is left out ----------

const keyHashOf = (q) => optionHash(q.options[correctIndex(q)]);
const STATS = (over = {}) => ({
  nTimed: 30, nTimedRight: 3, medianMsRight: 20000, q1MsRight: 15000, q3MsRight: 25000, rightSecs: [10, 20, 30],
  nChanged: 5, nMovedOffKey: 3, nStrikeBasis: 28, nStruckKey: 6, ...over,
});

test('timeRead leaves the student\'s own timed right answer out of the median and every count', () => {
  const own = { timed: true, ms: 30000, right: true, changed: true, offKey: false, strikeBasis: true, keyStruck: true };
  const t = timeRead(STATS(), own);
  assert.deepEqual(t.right, { n: 2, medianMs: 15000 }, 'the median of 10s and 20s, not of 10, 20 and 30');
  assert.equal(t.timed, 29);
  assert.equal(t.changed, 4);
  assert.equal(t.movedOff, 3);
  assert.deepEqual(t.strike, { n: 27, struck: 5 });
  // Another student's numbers are untouched.
  const other = timeRead(STATS(), null);
  assert.deepEqual(other.right, { n: 3, medianMs: 20000 });
  assert.equal(other.timed, 30);
});

test('timeRead: a student who was wrong, or not timed, takes nothing out of the right-answer median', () => {
  const wrong = { timed: true, ms: 12000, right: false, changed: false, offKey: false, strikeBasis: false, keyStruck: false };
  const t = timeRead(STATS(), wrong);
  assert.deepEqual(t.right, { n: 3, medianMs: 20000 });
  assert.equal(t.timed, 29, 'a timed student is one fewer in the timed count');
  assert.equal(t.changed, 5);
  const untimed = { ...wrong, timed: false };
  assert.equal(timeRead(STATS(), untimed).timed, 30);
  assert.deepEqual(timeRead(STATS(), untimed).strike, { n: 28, struck: 6 }, 'strike data does not need a timed question');
});

test('timeRead: a student whose time is not among the stored times was not counted, so nothing of theirs is taken out', () => {
  const stranger = { timed: true, ms: 77000, right: true, changed: true, offKey: true, strikeBasis: true, keyStruck: true };
  const t = timeRead(STATS(), stranger);
  assert.deepEqual(t.right, { n: 3, medianMs: 20000 });
  assert.equal(t.timed, 30);
  assert.equal(t.changed, 5);
  assert.equal(t.movedOff, 3);
});

test('timeRead never goes below zero and a median needs at least one time left', () => {
  const own = { timed: true, ms: 10000, right: true, changed: true, offKey: true, strikeBasis: true, keyStruck: true };
  const t = timeRead(STATS({ nTimed: 1, nTimedRight: 1, rightSecs: [10], medianMsRight: 10000, nChanged: 1, nMovedOffKey: 1, nStrikeBasis: 1, nStruckKey: 1 }), own);
  assert.equal(t.right, null);
  assert.deepEqual([t.timed, t.changed, t.movedOff, t.strike.n, t.strike.struck], [0, 0, 0, 0, 0]);
  assert.equal(timeRead(null, own), null);
  assert.equal(medianOf([]), null);
  assert.equal(medianOf([3, 1, 2, 4]), 2.5);
});

function stored(qid, over = {}) {
  return {
    qid, key_hash: over.key_hash, n_answered: 40, option_picks: over.option_picks, n_first_right: 30, n_timed: 30, n_timed_right: 3,
    median_ms_right: 20000, q1_ms_right: 15000, q3_ms_right: 25000, right_secs: [10, 20, 30], n_changed: 5, n_moved_off_key: 3,
    n_strike_basis: 28, n_struck_key: 6, first_answer_from: '2026-05-01T00:00:00Z', first_answer_to: '2026-10-15T00:00:00Z',
    counted_through: '2026-10-16T21:25:00Z', refreshed_at: '2026-10-16T21:30:00Z', ...over,
  };
}

test("cohortForAttempt over the table subtracts the student's own first answer and own time exactly once", () => {
  const attempt = clone(REPLAY.attempt);
  const q = attempt.questionsSnapshot.find((x) => x.id === 'q8');
  const keyHash = keyHashOf(q);
  const wrongHash = optionHash(q.options.find((_, i) => i !== correctIndex(q)));
  const own = ownContribution(attempt, 'q8', keyHash);
  assert.deepEqual([own.timed, own.right, own.changed, own.ms], [true, true, true, 70000], 'Q8 of the fixture: timed, right, changed, 70 s');
  const row = stored('q8', {
    key_hash: keyHash, option_picks: { [keyHash]: 30, [wrongHash]: 10 }, n_first_right: 30,
    n_timed_right: 3, right_secs: [10, 70, 90], median_ms_right: 70000, n_timed: 30, n_changed: 5, n_moved_off_key: 3,
  });
  const snapshot = tableSnapshot([row]);
  assert.equal(snapshot.questions.q8.stats.nTimedRight, 3);
  const builtAt = Date.parse(snapshot.builtAt);
  const first = { ...clone(attempt), id: 'mine-first', completedAt: builtAt - 86_400_000 };
  const now = { ...clone(attempt), id: 'now', completedAt: builtAt + 1000 };
  // The student's first answer was before the table's cutoff, so the table counted it, and it comes out once.
  const res = cohortForAttempt({ attempt: now, allAttempts: [first], answerReviews: {}, snapshot }).byQid.q8;
  assert.equal(res.n, 39, 'one student fewer');
  assert.equal(res.right, 29);
  assert.deepEqual(res.time.right, { n: 2, medianMs: 50000 }, 'the median of 10 s and 90 s, not of 10, 70 and 90');
  assert.equal(res.time.timed, 29);
  assert.equal(res.time.changed, 4);
  assert.equal(res.time.movedOff, 3);
  // A paper finished after the cutoff was never counted, so with no earlier attempt nothing is taken out.
  const none = cohortForAttempt({ attempt: now, allAttempts: [], answerReviews: {}, snapshot }).byQid.q8;
  assert.equal(none.n, 40);
  assert.deepEqual(none.time.right, { n: 3, medianMs: 70000 });
  assert.equal(none.time.timed, 30);
  // An answer completed after the cutoff is not the one counted either.
  const late = { ...clone(attempt), id: 'late', completedAt: builtAt + 5000 };
  assert.equal(cohortForAttempt({ attempt: now, allAttempts: [late], answerReviews: {}, snapshot }).byQid.q8.n, 40);
});

// ---------- the table, its freshness, and the fallback ----------

test('a table is fresh for 48 hours after its newest refresh', () => {
  assert.equal(COHORT_TIME_RULES.staleMs, 48 * 3600 * 1000);
  assert.equal(isFresh(NOW - 47 * 3600 * 1000, NOW), true);
  assert.equal(isFresh(NOW - 48 * 3600 * 1000, NOW), true);
  assert.equal(isFresh(NOW - 48 * 3600 * 1000 - 1, NOW), false);
  assert.equal(isFresh(0, NOW), false);
  assert.equal(isFresh(NaN, NOW), false);
});

// A fake client with the one table, enough of the query builder for the reader and the refresh.
function fakeDb({ rows = [], missing = false, failRows = false, rpc = null } = {}) {
  const calls = [];
  const builder = (table) => {
    const state = { cols: null, ids: null, order: null, limit: null };
    const done = () => {
      calls.push({ table, ...state });
      if (missing) return { data: null, error: { code: '42P01', message: 'relation "public.question_option_stats" does not exist' } };
      if (state.ids && failRows) return { data: null, error: { code: 'XX000', message: 'boom' } };
      let data = rows;
      if (state.ids) data = rows.filter((r) => state.ids.includes(r.qid));
      if (state.order) data = [...data].sort((a, b) => Date.parse(b[state.order]) - Date.parse(a[state.order]));
      if (state.limit) data = data.slice(0, state.limit);
      return { data, error: null };
    };
    const api = {
      select(cols) { state.cols = cols; return api; },
      in(_col, ids) { state.ids = ids; return api; },
      order(col) { state.order = col; return api; },
      limit(n) { state.limit = n; return api; },
      then(res, rej) { return Promise.resolve(done()).then(res, rej); },
    };
    return api;
  };
  return { calls, from: builder, rpc: async (name) => { calls.push({ rpc: name }); return typeof rpc === 'function' ? rpc(name) : rpc || { data: { questions: 3 }, error: null }; } };
}

function paperAndRows(over = {}) {
  const attempt = clone(REPLAY.attempt);
  const rows = attempt.questionsSnapshot.slice(0, 8).map((q) => {
    const k = keyHashOf(q);
    const other = optionHash(q.options.find((_, i) => i !== correctIndex(q)));
    return stored(q.id, { key_hash: k, option_picks: { [k]: 25, [other]: 10 }, n_answered: 35, ...over });
  });
  return { attempt: { ...attempt, id: 'paper', completedAt: Date.parse('2026-10-16T22:00:00Z') }, rows };
}
const input = (attempt) => ({ attempt, allAttempts: [], answerReviews: {} });
const sentinel = { since: 'snapshot', until: 'snapshot', coverage: { compared: 0, total: 0 }, byQid: {} };

test('fresh table: the cohort is read from it, with time lines', async () => {
  const { attempt, rows } = paperAndRows();
  const db = fakeDb({ rows });
  const cohort = await readCohortWithTime(input(attempt), { db, now: Date.parse('2026-10-17T03:00:00Z'), staticRead: async () => sentinel });
  assert.notEqual(cohort, sentinel);
  assert.equal(cohort.since, '2026-05-01');
  assert.equal(cohort.until, '2026-10-15');
  assert.ok(Object.keys(cohort.byQid).length >= 6);
  const q = cohort.byQid.q6;
  assert.equal(q.n, 35);
  assert.deepEqual(q.time.right, { n: 3, medianMs: 20000 });
});

test('missing table: the committed snapshot is read exactly as before', async () => {
  const { attempt } = paperAndRows();
  const cohort = await readCohortWithTime(input(attempt), { db: fakeDb({ missing: true }), now: NOW, staticRead: async () => sentinel });
  assert.equal(cohort, sentinel);
});

test('stale table (older than 48 hours): the committed snapshot is read, no row is read from the table', async () => {
  const { attempt, rows } = paperAndRows();
  const db = fakeDb({ rows });
  const cohort = await readCohortWithTime(input(attempt), { db, now: Date.parse('2026-10-19T00:00:00Z'), staticRead: async () => sentinel });
  assert.equal(cohort, sentinel);
  assert.equal(db.calls.filter((c) => c.ids).length, 0, 'only the newest-refresh probe ran');
});

test('empty table, and a read that fails: the committed snapshot', async () => {
  const { attempt, rows } = paperAndRows();
  assert.equal(await readCohortWithTime(input(attempt), { db: fakeDb({ rows: [] }), now: NOW, staticRead: async () => sentinel }), sentinel);
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await readCohortWithTime(input(attempt), { db: fakeDb({ rows, failRows: true }), now: Date.parse('2026-10-17T03:00:00Z'), staticRead: async () => sentinel }), sentinel);
  } finally { console.warn = warn; }
});

test('fresh table with nothing for this paper is still the source: no question has a cohort, the older snapshot is not mixed in', async () => {
  const { attempt, rows } = paperAndRows();
  const elsewhere = rows.map((r) => ({ ...r, qid: `other-${r.qid}` }));
  const cohort = await readCohortWithTime(input(attempt), { db: fakeDb({ rows: elsewhere }), now: Date.parse('2026-10-17T03:00:00Z'), staticRead: async () => sentinel });
  assert.notEqual(cohort, sentinel);
  assert.deepEqual(cohort.byQid, {});
  assert.equal(cohort.coverage.compared, 0);
});

test('a table that fails the key guard drops the question, as the snapshot does', async () => {
  const { attempt, rows } = paperAndRows();
  rows[0] = { ...rows[0], key_hash: '0123456789abcdef' };
  const cohort = await readCohortWithTime(input(attempt), { db: fakeDb({ rows }), now: Date.parse('2026-10-17T03:00:00Z'), staticRead: async () => sentinel });
  assert.equal(cohort.byQid[rows[0].qid], undefined);
  assert.ok(cohort.byQid[rows[1].qid]);
});

test('statsMissing recognises a database without the migration', () => {
  assert.equal(statsMissing({ code: '42P01', message: 'x' }), true);
  assert.equal(statsMissing({ message: 'Could not find the function public.refresh_question_option_stats in the schema cache' }), true);
  assert.equal(statsMissing({ message: 'connection reset' }), false);
});

// ---------- the nightly refresh over a fake client ----------

const PROD = { VERCEL_ENV: 'production' };

test('refresh: runs the database function once, reports a summary, and a second run gives the same answer', async () => {
  const summary = { questions: 120, answers: 4000, timed_answers: 900, questions_with_time: 40, removed: 2 };
  const db = fakeDb({ rpc: { data: summary, error: null } });
  const a = await refreshCohortStats({ db, env: PROD });
  const b = await refreshCohortStats({ db, env: PROD });
  const strip = ({ ms, ...rest }) => rest;
  assert.deepEqual(strip(a), strip(b));
  assert.deepEqual(strip(a), { status: 'ok', questions: 120, answers: 4000, timedAnswers: 900, withTime: 40, removed: 2 });
  assert.deepEqual(db.calls.map((c) => c.rpc), ['refresh_question_option_stats', 'refresh_question_option_stats']);
  assert.match(describeCohortRun(a), /wrote 120 questions \(4000 first answers, 900 timed, 40 questions with time, 2 removed\)/);
});

test('refresh never throws: a running refresh, a missing function, a failure, a thrown error and a slow database are each a status', async () => {
  assert.equal((await refreshCohortStats({ db: fakeDb({ rpc: { data: { skipped: 'refresh_running' }, error: null } }), env: PROD })).status, 'skipped');
  assert.equal((await refreshCohortStats({ db: fakeDb({ rpc: { data: null, error: { code: '42883', message: 'function public.refresh_question_option_stats() does not exist' } } }), env: PROD })).status, 'missing');
  const failed = await refreshCohortStats({ db: fakeDb({ rpc: { data: null, error: { message: 'canceling statement due to statement timeout' } } }), env: PROD });
  assert.equal(failed.status, 'failed');
  assert.match(describeCohortRun(failed), /failed: canceling statement/);
  const thrown = await refreshCohortStats({ db: { rpc: () => { throw new Error('network down'); } }, env: PROD });
  assert.equal(thrown.status, 'failed');
  const slow = await refreshCohortStats({ db: { rpc: () => new Promise(() => {}) }, env: PROD, budgetMs: 20 });
  assert.equal(slow.status, 'timeout');
  assert.match(describeCohortRun(slow), /did not answer within/);
});

test('refresh runs only on Vercel production: elsewhere it does not touch the database', async () => {
  const db = fakeDb();
  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const env of [{}, { VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }]) assert.equal((await refreshCohortStats({ db, env })).status, 'blocked');
  } finally { console.warn = warn; }
  assert.equal(db.calls.length, 0);
});

// ---------- the Lab with the table: lines in the opened answer and the ledger finding ----------

function labWith(state) {
  const attempt = { ...clone(REPLAY.attempt), id: 'fixture-attempt', completedAt: NOW - 3_600_000 };
  const answerReviews = clone(REPLAY.answerReviews || {});
  const cohort = state ? fixtureCohortTime(COHORT, attempt, answerReviews, state) : COHORT;
  return buildMistakeLab({ attempt, answerReviews, cohort });
}

test('the Lab with every gate met: lines in the opened answers and the ledger finding', () => {
  const lab = labWith('pass');
  const withLines = Object.values(lab.byQuestion).filter((b) => b.others?.lines?.length);
  assert.ok(withLines.length >= 20, `${withLines.length} questions carry lines`);
  const all = withLines.flatMap((b) => b.others.lines);
  assert.ok(all.some((l) => /^Students who got this right took a median of /.test(l)));
  assert.ok(all.some((l) => /timed students changed their answer here/.test(l)));
  assert.ok(all.some((l) => /crossed out the key here/.test(l)));
  assert.match(lab.cohort.slow.line, /^On 7 questions you took over twice as long as the students who got them right\. You got \d of the 7 right\.$/);
  assert.equal(lab.cohort.slow.numbers.length, 7);
  assert.ok(lab.cohort.fine.includes('Each of the 7 has 15 or more students who got it right and were timed.'));
});

test('the Lab one short of every gate: no line and no finding appear, and the picks lines are still there', () => {
  const lab = labWith('gated');
  assert.equal(Object.values(lab.byQuestion).filter((b) => b.others?.lines).length, 0);
  assert.equal(lab.cohort.slow, undefined);
  assert.ok(Object.values(lab.byQuestion).some((b) => b.others?.line));
});

test('the Lab without the table\'s time: byte for byte the contract slice 2 committed', () => {
  const lab = labWith(null);
  const contract = fixture('contract_replay_v1');
  assert.deepEqual(lab.cohort, contract.cohort);
  assert.deepEqual(lab.byQuestion, contract.byQuestion);
});

test('the ledger finding needs a record that ended: an old record with the same cohort shows none', () => {
  const attempt = { ...clone(REPLAY.attempt), id: 'fixture-attempt', completedAt: NOW - 3_600_000 };
  const answerReviews = clone(REPLAY.answerReviews || {});
  const cohort = fixtureCohortTime(COHORT, attempt, answerReviews, 'pass');
  assert.ok(buildMistakeLab({ attempt, answerReviews, cohort }).cohort.slow);
  const old = clone(attempt);
  delete old.selectionMeta.recovery.end;
  assert.equal(buildMistakeLab({ attempt: old, answerReviews, cohort }).cohort.slow, undefined);
});

// ---------- the wiring ----------

test('the cron limit holds: vercel.json is untouched and the refresh rides on the inventory route', () => {
  const config = JSON.parse(read('vercel.json'));
  // No cron was added for the cohort table (the plan's limit): the inventory cron is still there and nothing mentions the cohort.
  assert.ok(config.crons.length <= 3, 'no new cron');
  assert.ok(config.crons.some((c) => c.path === '/api/internal/refresh-inventory'));
  assert.ok(config.crons.every((c) => !/cohort|option-stats/i.test(c.path)));
  const route = read('src/app/api/internal/refresh-inventory/route.js');
  assert.match(route, /refreshCohortStats/);
  // The refresh comes after the inventory, and the statuses the inventory gave are unchanged: 403, 409 and 503.
  assert.ok(route.indexOf('refreshInventorySnapshot()') < route.lastIndexOf('refreshCohortTable(startedAt)'));
  assert.match(route, /status: 403/);
  assert.match(route, /status: 409/);
  assert.match(route, /status: 503/);
  // The cohort refresh result is never turned into a status.
  assert.doesNotMatch(route, /cohortStats\.status\s*[!=]==?\s*'failed'[^;]*status:/);
});

test('the result route reads the cohort through the table reader, which falls back to the snapshot', () => {
  const route = read('src/app/api/attempts/[id]/route.js');
  assert.match(route, /readCohortWithTime/);
  assert.doesNotMatch(route, /from '@\/\.\.\/data\/cohort_picks'/);
});

test('the copy has no "!", em dash or cause words, and every sentence carries a denominator', () => {
  const T = LAB_COPY.cohort.time;
  const flat = JSON.stringify(T);
  assert.doesNotMatch(flat, /[!—·]/);
  assert.doesNotMatch(flat, /\b(because|therefore|so that)\b/i);
  for (const key of ['median', 'slow']) assert.match(T[key], /\{n\}|\{k\}/, key);
});
