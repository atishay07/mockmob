// The nightly cohort table on a real Postgres (PGlite): the migration, the refresh function, the undo, and a parity check
// that the SQL's time, changes and strike-outs equal what data/cohort_time.js ownContribution computes from the same
// records with the paper trace (data/paper_trace.js). Run: node --test data/tests/cohort_time_sql.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optionHash } from '../option_hash.js';
import { correctIndex } from '../recovery.js';
import { ownContribution, medianOf } from '../cohort_time.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const migration = read('supabase/migrations/20261016120000_question_option_stats.sql');
const undo = read('supabase/undo/20261016120000_question_option_stats.undo.sql');
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

async function freshDb() {
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
