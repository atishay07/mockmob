// The nightly cohort table on a real Postgres (PGlite): the migration, the refresh function (v1, then the v2 rewrite that
// replaces it), the undos, a parity check that the SQL's time, changes and strike-outs equal what data/cohort_time.js
// ownContribution computes from the same records with the paper trace (data/paper_trace.js), a v1-against-v2 equality
// check, and a production-sized load that v2 must finish quickly. Run: node --test data/tests/cohort_time_sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionHash } from '../option_hash.js';
import { correctIndex } from '../recovery.js';
import { ownContribution, medianOf } from '../cohort_time.js';
import { buildVolume } from './cohort_volume_fixture.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const migration = read('supabase/migrations/20261016120000_question_option_stats.sql'); // v1: the table and the first refresh
const migrationV2 = read('supabase/migrations/20261016130000_question_option_stats_refresh_v2.sql'); // the fast refresh
const undo = read('supabase/undo/20261016120000_question_option_stats.undo.sql');
const undoV2 = read('supabase/undo/20261016130000_question_option_stats_refresh_v2.undo.sql');
const FIX = 'data/tests/fixtures/mistake_lab/';
const fixture = (name) => JSON.parse(read(`${FIX}${name}.json`));
const clone = (v) => JSON.parse(JSON.stringify(v));

const SCHEMA = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create table public.questions (id text primary key, body text, question text, options jsonb, correct_index int, correct_answer text,
    status text default 'live', is_deleted boolean default false, verification_state text default 'verified');
  create table public.attempts (id text primary key, user_id text not null, subject text default 'x', score int default 0, correct int default 0,
    wrong int default 0, unattempted int default 0, total int default 0, details jsonb not null, questions_snapshot jsonb not null,
    completed_at timestamptz not null, selection_meta jsonb not null default '{}');
`;

/** Both migrations in order: the refresh function is v2's. */
async function freshDb() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(migration);
  await db.exec(migrationV2);
  return db;
}

/** Only the first migration: the refresh function is v1's (the equality tests then switch it to v2). */
async function freshDbV1() {
  const db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(migration);
  return db;
}

/** Make the live questions of a paper (stored as the paper served them). */
async function addQuestions(db, attempt, over = {}) {
  for (const q of attempt.questionsSnapshot) {
    await db.query(
      'insert into public.questions (id, question, options, correct_index, status) values ($1,$2,$3,$4,$5) on conflict (id) do nothing',
      [q.id, q.question, JSON.stringify(q.options), correctIndex(q), over.status || 'live'],
    );
  }
}

/** Scale every clock of a record by f (order is kept; seq keeps ties in order). */
function scaled(rec, f) {
  const r = clone(rec);
  const at = (e) => { e.at = Math.round(e.at * f); return e; };
  r.timeline.forEach(at);
  (r.marks || []).forEach(at);
  (r.presence || []).forEach(at);
  (r.strikes || []).forEach(at);
  if (r.end) at(r.end);
  (r.observed?.answerChanges || []).forEach(at);
  return r;
}

/** n copies of a paper for n students, each with its own pace. */
function crowd(source, prefix, n, { when = Date.now() - 86_400_000, mutate = null } = {}) {
  const out = [];
  for (let j = 0; j < n; j++) {
    const a = clone(source.attempt);
    a.id = `${prefix}-${j}`;
    a.userId = `${prefix}-user-${j}`;
    a.completedAt = when - j * 60_000;
    a.selectionMeta.recovery = scaled(a.selectionMeta.recovery, 0.7 + 0.05 * j);
    if (mutate) mutate(a, j);
    out.push(a);
  }
  return out;
}

async function addAttempt(db, a) {
  await db.query(
    'insert into public.attempts (id, user_id, details, questions_snapshot, completed_at, selection_meta) values ($1,$2,$3,$4,$5,$6)',
    [a.id, a.userId, JSON.stringify(a.details), JSON.stringify(a.questionsSnapshot), new Date(a.completedAt).toISOString(), JSON.stringify(a.selectionMeta)],
  );
}

const answered = (attempt) => attempt.details.filter((d) => Number.isInteger(d.givenIndex)).length; // blank questions have no first answer
const refresh = async (db) => (await db.query('select public.refresh_question_option_stats() as r')).rows[0].r;
const rowsOf = async (db) => (await db.query('select * from public.question_option_stats order by qid')).rows;

test('the migration is additive and idempotent, service role only, and the undo removes both objects', async () => {
  const db = await freshDb();
  await db.exec(migration);
  const cols = (await db.query("select column_name from information_schema.columns where table_name='question_option_stats'")).rows.map((r) => r.column_name);
  for (const c of cols) assert.doesNotMatch(c, /user|student|attempt/i, `no identity column: ${c}`);
  assert.ok(cols.includes('right_secs') && cols.includes('counted_through') && cols.includes('refreshed_at'));
  const rls = (await db.query("select relrowsecurity r from pg_class where relname='question_option_stats'")).rows[0].r;
  assert.equal(rls, true);
  const priv = async (role, p) => (await db.query(`select has_table_privilege('${role}','public.question_option_stats','${p}') p`)).rows[0].p;
  assert.equal(await priv('anon', 'select'), false);
  assert.equal(await priv('authenticated', 'select'), false);
  assert.equal(await priv('service_role', 'select'), true);
  const fn = async (role) => (await db.query(`select has_function_privilege('${role}','public.refresh_question_option_stats()','execute') p`)).rows[0].p;
  assert.equal(await fn('anon'), false);
  assert.equal(await fn('authenticated'), false);
  assert.equal(await fn('service_role'), true);
  await db.exec(undo);
  assert.equal((await db.query("select count(*)::int n from pg_class where relname='question_option_stats'")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from pg_proc where proname='refresh_question_option_stats'")).rows[0].n, 0);
  await db.exec(undo);
  await db.exec(migration);
  await db.exec(migrationV2);
  await db.close();
});

test('the v2 undo restores the v1 function and leaves the table and its rows alone; v2 and its undo can be re-run', async () => {
  const db = await freshDbV1();
  const defOf = async () => (await db.query("select replace(pg_get_functiondef('public.refresh_question_option_stats()'::regprocedure), chr(13), '') d")).rows[0].d;
  const v1Def = await defOf();
  await db.exec(migrationV2);
  await db.exec(migrationV2);
  const v2Def = await defOf();
  assert.notEqual(v2Def, v1Def);
  assert.match(v2Def, /enable_nestloop/);
  assert.match(v2Def, /statement_timeout/);
  assert.match(v2Def, /search_path/);
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  for (const a of crowd(full, 'u', 10)) await addAttempt(db, a);
  await refresh(db);
  const before = await rowsOf(db);
  assert.ok(before.length > 0);
  await db.exec(undoV2);
  assert.equal(await defOf(), v1Def, 'the undo puts the v1 body back');
  assert.deepEqual(await rowsOf(db), before, 'the table is untouched');
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query(`select has_function_privilege('${role}','public.refresh_question_option_stats()','execute') p`)).rows[0].p, false);
  }
  assert.equal((await db.query("select has_function_privilege('service_role','public.refresh_question_option_stats()','execute') p")).rows[0].p, true);
  await db.exec(undoV2);
  await db.exec(migrationV2);
  assert.equal(await defOf(), v2Def, 'v2 can be applied again after its undo');
  await db.close();
});

test('the refresh counts first answers only and keeps no row under 10 students', async () => {
  const db = await freshDb();
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  for (const a of crowd(full, 'f', 9)) await addAttempt(db, a);
  assert.deepEqual(await refresh(db).then((r) => r.questions), 0, '9 students is under the gate');
  const tenth = crowd(full, 'f', 10)[9];
  await addAttempt(db, tenth);
  const r = await refresh(db);
  assert.equal(r.questions, answered(full.attempt));
  const rows = await rowsOf(db);
  assert.ok(rows.every((x) => x.n_answered === 10));
  // A later attempt by the same student never replaces or adds to the first answer.
  const again = clone(tenth);
  again.id = 'f-9-again';
  again.completedAt += 3_600_000;
  again.details = again.details.map((d) => ({ ...d, givenIndex: (d.givenIndex + 1) % 4 }));
  await addAttempt(db, again);
  await refresh(db);
  const after = await rowsOf(db);
  assert.deepEqual(after.map((x) => [x.qid, x.n_answered, x.option_picks]), rows.map((x) => [x.qid, x.n_answered, x.option_picks]));
  await db.close();
});

test('refresh is idempotent: the same data gives the same numbers, only refreshed_at moves', async () => {
  const db = await freshDb();
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  for (const a of crowd(full, 'f', 12)) await addAttempt(db, a);
  await refresh(db);
  const strip = (rows) => rows.map(({ refreshed_at, counted_through, ...rest }) => rest);
  const one = await rowsOf(db);
  await refresh(db);
  const two = await rowsOf(db);
  assert.deepEqual(strip(two), strip(one));
  assert.ok(new Date(two[0].refreshed_at) >= new Date(one[0].refreshed_at));
  assert.equal((await db.query('select count(*)::int n from public.question_option_stats')).rows[0].n, answered(full.attempt));
  await db.close();
});

test('truth guards: a question that is not live, a moved key and an edited option have no row; answers after the cutoff are not counted', async () => {
  const db = await freshDb();
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  for (const a of crowd(full, 'f', 12)) await addAttempt(db, a);
  await db.query("update public.questions set status='draft' where id='q1'");
  await db.query("update public.questions set verification_state='disputed' where id='q2'");
  await db.query('update public.questions set correct_index = (correct_index + 1) % 4 where id=$1', ['q3']);
  const edited = JSON.parse((await db.query("select options::text o from public.questions where id='q4'")).rows[0].o);
  edited[0] = 'an edited option';
  await db.query("update public.questions set options=$1 where id='q4'", [JSON.stringify(edited)]);
  await db.query("update public.questions set question='the question was reworded' where id='q5'");
  await refresh(db);
  const ids = (await rowsOf(db)).map((r) => r.qid);
  for (const gone of ['q1', 'q2', 'q3', 'q4', 'q5']) assert.ok(!ids.includes(gone), gone);
  assert.ok(ids.includes('q6'));
  // An attempt completed in the last five minutes is after the cutoff: not counted.
  const late = crowd(full, 'late', 1, { when: Date.now() - 60_000 })[0];
  await addAttempt(db, late);
  await refresh(db);
  assert.equal((await rowsOf(db)).find((r) => r.qid === 'q6').n_answered, 12);
  // A question that stops passing a guard loses its row on the next refresh.
  await db.query("update public.questions set status='draft' where id='q6'");
  const r = await refresh(db);
  assert.ok(r.removed >= 1);
  assert.ok(!(await rowsOf(db)).some((x) => x.qid === 'q6'));
  await db.close();
});

// ---- parity: the SQL equals data/cohort_time.js over the same records, on every kind of paper we have ---------------
const PAPERS = ['replay_full_input', 'replay_time_up_input', 'replay_nta_input', 'replay_bst_input', 'replay_english_input'];

function expected(attempts, qid) {
  const q0 = attempts[0].questionsSnapshot.find((q) => q.id === qid);
  const keyHash = optionHash(q0.options[correctIndex(q0)]);
  const rows = attempts.map((a) => ownContribution(a, qid, keyHash)).filter(Boolean);
  const timed = rows.filter((r) => r.timed);
  const right = timed.filter((r) => r.right);
  const wrong = timed.filter((r) => !r.right);
  const basis = rows.filter((r) => r.strikeBasis);
  return {
    n_timed: timed.length,
    n_timed_right: right.length,
    median_ms_right: right.length ? Math.round(medianOf(right.map((r) => r.ms))) : null,
    n_timed_wrong: wrong.length,
    right_secs: right.map((r) => Math.round(r.ms / 1000)).sort((a, b) => a - b),
    n_changed: timed.filter((r) => r.changed).length,
    n_moved_off_key: timed.filter((r) => r.changed && r.offKey).length,
    n_strike_basis: basis.length,
    n_struck_key: basis.filter((r) => r.keyStruck).length,
  };
}

for (const name of PAPERS) {
  test(`parity with the paper trace: ${name}`, async () => {
    const db = await freshDb();
    const input = fixture(name);
    await addQuestions(db, input.attempt);
    const attempts = crowd(input, 'p', 12, {
      // Some students lose their away data (a long gap then counts as a break), some do not carry a client record.
      mutate: (a, j) => {
        if (j % 5 === 4) delete a.selectionMeta.client;
      },
    });
    for (const a of attempts) await addAttempt(db, a);
    const result = await refresh(db);
    assert.ok(result.questions > 0, `${name}: some question has a row`);
    const rows = await rowsOf(db);
    let timedQuestions = 0;
    let changedQuestions = 0;
    let struckQuestions = 0;
    for (const row of rows) {
      const want = expected(attempts, row.qid);
      assert.equal(row.n_timed, want.n_timed, `${name} ${row.qid} n_timed`);
      assert.equal(row.n_timed_right, want.n_timed_right, `${name} ${row.qid} n_timed_right`);
      assert.equal(row.n_timed_wrong, want.n_timed_wrong, `${name} ${row.qid} n_timed_wrong`);
      assert.equal(row.median_ms_right, want.median_ms_right, `${name} ${row.qid} median`);
      assert.deepEqual(row.right_secs, want.right_secs, `${name} ${row.qid} right_secs`);
      assert.equal(row.n_changed, want.n_changed, `${name} ${row.qid} n_changed`);
      assert.equal(row.n_moved_off_key, want.n_moved_off_key, `${name} ${row.qid} n_moved_off_key`);
      assert.equal(row.n_strike_basis, want.n_strike_basis, `${name} ${row.qid} n_strike_basis`);
      assert.equal(row.n_struck_key, want.n_struck_key, `${name} ${row.qid} n_struck_key`);
      if (row.n_timed > 0) timedQuestions++;
      if (row.n_changed > 0) changedQuestions++;
      if (row.n_struck_key > 0) struckQuestions++;
    }
    assert.ok(timedQuestions >= 10, `${name}: ${timedQuestions} questions with time`);
    if (name === 'replay_full_input') {
      assert.ok(changedQuestions >= 1, 'the full paper has changed answers');
      assert.ok(struckQuestions >= 1, 'the full paper has a crossed-out key');
    }
    await db.close();
  });
}

test('records that cannot be timed give picks but no time: no end event, an inconsistent record, a browser-scored attempt', async () => {
  const db = await freshDb();
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  const crowdA = crowd(full, 'c', 12, {
    mutate: (a, j) => {
      if (j === 0) delete a.selectionMeta.recovery.end; // an old record: the last question's time is unknown
      if (j === 1) a.selectionMeta.recovery.telemetry = 'inconsistent';
      if (j === 2) a.selectionMeta.scoringVersion = 'device_v1';
    },
  });
  for (const a of crowdA) await addAttempt(db, a);
  await refresh(db);
  const q = (await rowsOf(db)).find((r) => r.qid === 'q6');
  assert.equal(q.n_answered, 12, 'all twelve students answered');
  assert.equal(q.n_timed <= 9, true, 'three of them cannot be timed');
  await db.close();
});

test('a gap of over 30 minutes on a record with no away data is a break: the question is not timed', async () => {
  const db = await freshDb();
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  const withBreak = (a) => {
    const r = a.selectionMeta.recovery;
    // Q2 (visited at 50 s, answered at 80 s) is left open for 45 minutes before the next visit.
    const shift = 45 * 60 * 1000;
    const from = r.timeline.find((e) => e.qid === 'q3' && e.type === 'visit').at;
    for (const list of [r.timeline, r.marks || [], r.presence || [], r.strikes || []]) for (const e of list) if (e.at >= from) e.at += shift;
    r.end.at += shift;
  };
  const noAway = crowd(full, 'n', 12, { mutate: (a) => { delete a.selectionMeta.recovery.presence; withBreak(a); } });
  for (const a of noAway) await addAttempt(db, a);
  await refresh(db);
  const row = (await rowsOf(db)).find((r) => r.qid === 'q2');
  const want = expected(noAway, 'q2');
  assert.equal(row.n_timed, want.n_timed);
  assert.equal(want.n_timed, 0, 'the 45-minute gap makes Q2 unreliable on every record');
  await db.close();
});

// ---- v1 against v2: the rewrite returns exactly the same table ------------------------------------------------------
const stripClock = ({ refreshed_at, counted_through, ...rest }) => rest;

/** Load with v1 in place, refresh, switch the function to v2, refresh again: the two tables and summaries must be identical. */
async function assertSameTable(db, label) {
  const one = await refresh(db);
  const tableOne = (await rowsOf(db)).map(stripClock);
  await db.query('delete from public.question_option_stats'); // v2 must rebuild every row itself, not lean on v1's
  await db.exec(migrationV2);
  const two = await refresh(db);
  const tableTwo = (await rowsOf(db)).map(stripClock);
  assert.ok(tableOne.length > 0, `${label}: some question has a row`);
  assert.deepEqual(stripClock(two), stripClock(one), `${label}: the returned summary`);
  assert.deepEqual(tableTwo, tableOne, `${label}: the table, row by row and column by column`);
  return tableOne;
}

for (const name of PAPERS) {
  test(`v1 and v2 give identical table contents: ${name}`, async () => {
    const db = await freshDbV1();
    const input = fixture(name);
    await addQuestions(db, input.attempt);
    const mutate = (a2, j) => {
      if (j % 5 === 4) delete a2.selectionMeta.client;
      if (j % 6 === 5) delete a2.selectionMeta.recovery.presence;
    };
    for (const a of crowd(input, 'p', 12, { mutate })) await addAttempt(db, a);
    const rows = await assertSameTable(db, name);
    assert.ok(rows.some((r) => r.n_timed > 0), 'the comparison covers timed questions');
    await db.close();
  });
}

test('v1 and v2 give identical table contents: guards, untimed records, breaks and quirks of the stored data', async () => {
  const db = await freshDbV1();
  const full = fixture('replay_full_input');
  await addQuestions(db, full.attempt);
  const crowdA = crowd(full, 'g', 16, {
    mutate: (a, j) => {
      if (j === 0) delete a.selectionMeta.recovery.end;
      if (j === 1) a.selectionMeta.recovery.telemetry = 'inconsistent';
      if (j === 2) a.selectionMeta.scoringVersion = 'device_v1';
      if (j === 3) delete a.selectionMeta.recovery.presence;
      if (j === 4) a.selectionMeta.recovery.strikes = [];
      if (j === 5) {
        // a later duplicate of a question in the snapshot never wins
        const dup = clone(a.questionsSnapshot[0]);
        dup.options = ['x', 'y', 'z', 'w'];
        a.questionsSnapshot.push(dup);
      }
      if (j === 6) a.details[3].givenIndex = -1; // negative reads from the end, as the stored expression always did
      if (j === 7) a.details[4].givenIndex = 9; // no such option: not an answer
      if (j === 8) a.details[5].givenIndex = null;
      if (j === 9) a.questionsSnapshot[6].options = a.questionsSnapshot[6].options.map((o) => ({ text: `  ${o.toUpperCase()} ` }));
      if (j === 10) {
        delete a.questionsSnapshot[7].correctIndex;
        a.questionsSnapshot[7].correctAnswer = 'B';
      }
      if (j === 11) a.selectionMeta.recovery.observed = null;
    },
  });
  for (const a of crowdA) await addAttempt(db, a);
  // The same students, later: never replace a first answer.
  for (const a of crowd(full, 'g', 6, { when: Date.now() - 3_600_000 })) {
    a.id += '-again';
    await addAttempt(db, a);
  }
  await db.query("update public.questions set status='draft' where id='q1'");
  await db.query("update public.questions set verification_state='disputed' where id='q2'");
  await db.query('update public.questions set correct_index = (correct_index + 1) % 4 where id=$1', ['q3']);
  await db.query("update public.questions set question='the question was reworded' where id='q5'");
  const rows = await assertSameTable(db, 'quirks');
  assert.ok(!rows.some((r) => ['q1', 'q2', 'q3', 'q5'].includes(r.qid)));
  for (const col of ['n_timed_right', 'n_changed', 'n_struck_key']) assert.ok(rows.some((r) => r[col] > 0), `the fixtures exercise ${col}`);
  await db.close();
});

// ---- production size ---------------------------------------------------------------------------------------------------
async function loadVolume(db, v) {
  await db.query(
    'insert into public.questions (id, question, options, correct_index, status) select id, question, options, correct_index, status from jsonb_to_recordset($1::jsonb) x(id text, question text, options jsonb, correct_index int, status text)',
    [JSON.stringify(v.questions)],
  );
  for (let i = 0; i < v.attempts.length; i += 200) {
    await db.query(
      'insert into public.attempts (id, user_id, details, questions_snapshot, completed_at, selection_meta) select id, user_id, details, questions_snapshot, completed_at, selection_meta from jsonb_to_recordset($1::jsonb) x(id text, user_id text, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb)',
      [JSON.stringify(v.attempts.slice(i, i + 200))],
    );
  }
}

async function timedRefresh(db) {
  const t0 = performance.now();
  const r = await refresh(db);
  return { ms: Math.round(performance.now() - t0), r };
}

test('v1 and v2 give identical table contents on a synthetic load (a tenth of production size, where v1 still finishes)', { timeout: 300_000 }, async () => {
  const db = await freshDbV1();
  await loadVolume(db, buildVolume({ attempts: 180, users: 45, captured: 30 }));
  const t0 = performance.now();
  const one = await refresh(db);
  const v1ms = Math.round(performance.now() - t0);
  const tableOne = (await rowsOf(db)).map(stripClock);
  await db.query('delete from public.question_option_stats');
  await db.exec(migrationV2);
  const { ms: v2ms, r: two } = await timedRefresh(db);
  const tableTwo = (await rowsOf(db)).map(stripClock);
  console.log(`# cohort refresh at 180 attempts / ${one.answers} first answers: v1 ${v1ms} ms, v2 ${v2ms} ms`);
  assert.ok(tableOne.length >= 100, 'most of the 120 questions have a row');
  for (const col of ['n_timed_right', 'n_timed_wrong', 'n_changed', 'n_moved_off_key', 'n_strike_basis', 'n_struck_key']) {
    assert.ok(tableOne.some((r) => r[col] > 0), `the load exercises ${col}`);
  }
  assert.deepEqual(stripClock(two), stripClock(one));
  assert.deepEqual(tableTwo, tableOne);
  await db.close();
});

test('v2 refreshes production-sized data (1,800 attempts, 35,000 answers, 300 captured records) far inside the 120 s limit, in linear time', { timeout: 300_000 }, async () => {
  const db = await freshDb();
  const small = buildVolume({ attempts: 360, users: 90, captured: 60 });
  await loadVolume(db, small);
  const s = await timedRefresh(db);
  await db.query('delete from public.attempts');
  await db.query('delete from public.questions');

  const v = buildVolume({ attempts: 1800, users: 450, captured: 300 });
  const answers = v.attempts.reduce((n, a) => n + a.details.length, 0);
  assert.ok(answers >= 34_000 && answers <= 37_000, `${answers} answers in details`);
  assert.equal(v.attempts.filter((a) => a.selection_meta.recovery).length, 300);
  await loadVolume(db, v);
  const big = await timedRefresh(db);
  console.log(`# cohort refresh v2 at ${v.attempts.length} attempts / ${answers} answers: ${big.ms} ms (${small.attempts.length} attempts: ${s.ms} ms); ${big.r.questions} questions, ${big.r.timed_answers} timed answers`);
  assert.ok(big.ms < 30_000, `v2 took ${big.ms} ms (limit 120000, target under 10000 on the real server)`);
  assert.ok(big.ms < Math.max(10 * s.ms, 3000), `not linear: ${big.ms} ms for 5x the data of ${s.ms} ms`);
  assert.equal(big.r.questions, 120);
  assert.ok(big.r.answers > 20_000 && big.r.timed_answers > 3_000, JSON.stringify(big.r));
  assert.equal(big.r.questions_with_time, 120);
  const rows = await rowsOf(db);
  assert.equal(rows.length, 120);
  assert.ok(rows.every((r) => r.n_answered >= 10 && r.n_timed <= r.n_answered));
  // Idempotent at size too: the second refresh writes the same numbers.
  const again = await timedRefresh(db);
  assert.deepEqual((await rowsOf(db)).map(stripClock), rows.map(stripClock));
  assert.ok(again.ms < 30_000);
  await db.close();
});
