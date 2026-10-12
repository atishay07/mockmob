import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { finaliseExpiredSessions, scoreExpiredSession, FINALISE_BATCH, FINALISE_MAX_FAILURES } from '../../src/lib/server/sessionFinaliser.js';

const sql = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const iso = offsetMs => new Date(Date.now() + offsetMs).toISOString();
const questions = ['q1', 'q2', 'q3', 'q4'].map(id => ({ id, chapter: 'Money', options: ['a', 'b', 'c', 'd'], correct_answer: 'A' }));

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table users(id text primary key,credit_balance int);
    create table questions(id text primary key,subject text,chapter text,body text,options jsonb,correct_answer text,explanation text);
    create table attempts(id text primary key,user_id text,subject text,score int,correct int,wrong int,unattempted int,total int,details jsonb,questions_snapshot jsonb);
    create table user_question_progress(user_id text,question_id text,subject text,chapter text,seen_count int default 0,attempt_count int default 0,correct_count int default 0,skip_count int default 0,last_selected_key text,last_correct boolean,last_seen_at timestamptz,last_attempted_at timestamptz,updated_at timestamptz,primary key(user_id,question_id));
    create table credit_transactions(user_id text,amount int,type text,reference text primary key,action text,credit_delta int);
    insert into users values('u1',100),('u2',100);`);
  await db.exec(sql('0036_mode_aware_credits.sql'));
  await db.exec(sql('20261001105920_score_recovery_foundations.sql'));
  await db.exec(sql('20261013094000_session_finaliser.sql'));
  await db.exec(sql('20261013094000_session_finaliser.sql')); // idempotent
  return db;
}

async function addSession(db, id, { user = 'u1', expiresInMs, state = 'active', events = [], meta = { contentEvidence: 'legacy_bank' }, qs = questions } = {}) {
  await db.query(`insert into recovery_sessions(id,user_id,request_key,subject,mode,state,questions,selection_meta,events,created_at,expires_at)
    values($1,$2,$3,'economics','full',$4,$5,$6,$7,$8,$9)`,
  [id, user, `key-${id}`, state, JSON.stringify(qs), JSON.stringify(meta), JSON.stringify(events), iso(expiresInMs - 3600000), iso(expiresInMs)]);
}

function store(db, hooks = {}) {
  return {
    async listDue(cutoff, limit, after) {
      hooks.afterList ||= async () => {};
      const { rows } = await db.query(`select id,user_id,subject,mode,questions,selection_meta,events,created_at,expires_at from recovery_sessions
        where state='active' and expires_at < $1 and ($3::timestamptz is null or expires_at >= $3::timestamptz) order by expires_at asc limit $2`, [cutoff, limit, after || null]);
      const mapped = rows.map(r => ({ ...r, created_at: r.created_at.toISOString(), expires_at: r.expires_at.toISOString() }));
      const hook = hooks.afterList; hooks.afterList = async () => {}; await hook(mapped);
      return mapped;
    },
    async quarantine(id, reason, max) {
      try { return (await db.query('select quarantine_recovery_session($1,$2,$3) as r', [id, reason, max])).rows[0].r; }
      catch (error) { throw new Error(error.message); }
    },
    async finalise(id, result) {
      try { return (await db.query('select finalise_expired_recovery_session($1,$2) as r', [id, JSON.stringify(result)])).rows[0].r; }
      catch (error) { throw new Error(error.message); }
    },
  };
}

const answer = (seq, qid, value, at) => ({ seq, qid, type: 'answer', answer: value, at });

test('expired durable session is finalised from acknowledged events with +5/-1 and is idempotent', async () => {
  const db = await setup();
  try {
    // q1 correct, q2 wrong, q3 answered then changed to correct, q4 never answered.
    const events = [answer(1, 'q1', 0, 1000), answer(2, 'q2', 1, 2000), answer(3, 'q3', 2, 3000), answer(4, 'q3', 0, 4000)];
    await addSession(db, 's1', { expiresInMs: -600000, events });
    const first = await finaliseExpiredSessions(store(db));
    assert.equal(first.finalised, 1);
    assert.equal(first.failed, 0);
    const attempt = (await db.query("select * from attempts where id='s1'")).rows[0];
    assert.equal(attempt.correct, 2);
    assert.equal(attempt.wrong, 1);
    assert.equal(attempt.unattempted, 1);
    assert.equal(attempt.score, Math.round((2 * 5 - 1) / 20 * 100));
    assert.equal(attempt.user_id, 'u1');
    assert.equal((await db.query("select state from recovery_sessions where id='s1'")).rows[0].state, 'submitted');
    assert.equal((await db.query('select count(*)::int n from user_question_progress')).rows[0].n, 4);
    assert.equal((await db.query('select count(*)::int n from recovery_review_queue')).rows[0].n, 2); // wrong + unanswered
    const meta = (await db.query("select selection_meta m from attempts where id='s1'")).rows[0].m;
    assert.equal(meta.finalisedBy, 'server_deadline');
    const second = await finaliseExpiredSessions(store(db));
    assert.equal(second.due, 0);
    assert.equal((await db.query('select count(*)::int n from attempts')).rows[0].n, 1);
    assert.equal((await db.query("select attempt_count from user_question_progress where question_id='q1'")).rows[0].attempt_count, 1);
  } finally { await db.close(); }
});

test('only the stored (acknowledged) events count; sessions inside the grace or submitted are untouched', async () => {
  const db = await setup();
  try {
    await addSession(db, 'inside-grace', { expiresInMs: -60000, events: [answer(1, 'q1', 0, 1000)] });
    await addSession(db, 'live', { expiresInMs: 600000, events: [answer(1, 'q1', 0, 1000)] });
    await addSession(db, 'done', { expiresInMs: -600000, state: 'submitted' });
    await addSession(db, 'silent', { expiresInMs: -600000, events: [] });
    const run = await finaliseExpiredSessions(store(db));
    assert.equal(run.due, 1);
    assert.equal(run.finalised, 1);
    const rows = (await db.query('select id,state from recovery_sessions order by id')).rows;
    assert.deepEqual(rows.map(r => [r.id, r.state]), [['done', 'submitted'], ['inside-grace', 'active'], ['live', 'active'], ['silent', 'submitted']]);
    const silent = (await db.query("select correct,wrong,unattempted,score from attempts where id='silent'")).rows[0];
    assert.deepEqual(silent, { correct: 0, wrong: 0, unattempted: 4, score: 0 });
    assert.equal((await db.query("select count(*)::int n from attempts where id in ('done','live','inside-grace')")).rows[0].n, 0);
    // The database refuses early finalisation even if the app clock were wrong.
    await assert.rejects(db.query("select finalise_expired_recovery_session('inside-grace',$1)", [JSON.stringify({ expected_event_count: 1, score: 0, correct: 0, wrong: 0, unattempted: 4, total: 4, details: [] })]), /not expired/);
  } finally { await db.close(); }
});

test('a concurrent submit that wins the race leaves exactly one attempt and one progress write', async () => {
  const db = await setup();
  try {
    const events = [answer(1, 'q1', 0, 1000), answer(2, 'q2', 0, 2000)];
    await addSession(db, 'race', { expiresInMs: -600000, events });
    const run = await finaliseExpiredSessions(store(db, {
      // The submit lands after the finaliser has listed the session but before it finalises.
      afterList: async () => {
        await db.query(`insert into attempts(id,user_id,subject,score,correct,wrong,unattempted,total,details,questions_snapshot) values('race','u1','economics',50,2,0,2,4,'[]','[]')`);
        await db.query("update recovery_sessions set state='submitted' where id='race'");
      },
    }));
    assert.equal(run.finalised, 0);
    assert.equal(run.alreadyDone, 1);
    assert.equal(run.failed, 0);
    assert.equal((await db.query("select count(*)::int n from attempts where id='race'")).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int n from user_question_progress')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('two finalisers racing on the same session create one attempt', async () => {
  const db = await setup();
  try {
    await addSession(db, 'twice', { expiresInMs: -600000, events: [answer(1, 'q1', 0, 1000)] });
    const [a, b] = await Promise.all([finaliseExpiredSessions(store(db)), finaliseExpiredSessions(store(db))]);
    assert.equal(a.finalised + b.finalised, 1);
    assert.equal(a.failed + b.failed, 0);
    assert.equal((await db.query("select attempt_count from user_question_progress where question_id='q1'")).rows[0].attempt_count, 1);
    assert.equal((await db.query("select count(*)::int n from attempts where id='twice'")).rows[0].n, 1);
  } finally { await db.close(); }
});

test('an attempt row that already exists is not duplicated and closes the session', async () => {
  const db = await setup();
  try {
    await addSession(db, 'orphan', { expiresInMs: -600000, events: [answer(1, 'q1', 0, 1000)] });
    await db.query(`insert into attempts(id,user_id,subject,score,correct,wrong,unattempted,total,details,questions_snapshot) values('orphan','u1','economics',25,1,0,3,4,'[]','[]')`);
    const run = await finaliseExpiredSessions(store(db));
    assert.equal(run.alreadyDone, 1);
    assert.equal((await db.query("select state from recovery_sessions where id='orphan'")).rows[0].state, 'submitted');
    assert.equal((await db.query("select score from attempts where id='orphan'")).rows[0].score, 25);
  } finally { await db.close(); }
});

test('an unscorable session is closed as unscorable, does not stop the rest and leaves the queue', async () => {
  const db = await setup();
  try {
    await addSession(db, 'bad', { expiresInMs: -900000, qs: [{ id: 'x', options: ['a'], correct_answer: 'Z' }] });
    for (let i = 0; i < 5; i++) await addSession(db, `s${i}`, { expiresInMs: -600000 + i });
    const run = await finaliseExpiredSessions(store(db));
    assert.equal(run.failed, 1);
    assert.equal(run.quarantined, 1);
    assert.equal(run.errors[0].code, 'unscorable');
    assert.equal(run.finalised, 5);
    const bad = (await db.query("select state,selection_meta m from recovery_sessions where id='bad'")).rows[0];
    assert.equal(bad.state, 'submitted');
    assert.equal(bad.m.finalisedBy, 'unscorable');
    assert.equal((await db.query("select count(*)::int n from attempts where id='bad'")).rows[0].n, 0);
    const next = await finaliseExpiredSessions(store(db));
    assert.equal(next.due, 0);
  } finally { await db.close(); }
});

test('batch is bounded per run and oldest first', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < FINALISE_BATCH + 10; i++) await addSession(db, `s${String(i).padStart(3, '0')}`, { expiresInMs: -600000 + i });
    const run = await finaliseExpiredSessions(store(db), { limit: 500 });
    assert.equal(run.due, FINALISE_BATCH);
    assert.equal(run.finalised, FINALISE_BATCH);
    assert.equal((await db.query("select state from recovery_sessions where id='s000'")).rows[0].state, 'submitted');
    assert.equal((await db.query("select state from recovery_sessions where id='s059'")).rows[0].state, 'active');
    assert.equal((await finaliseExpiredSessions(store(db))).finalised, 10);
  } finally { await db.close(); }
});

test('50 persistently failing sessions cannot starve newer ones and are closed after the retry bound', async () => {
  const db = await setup();
  try {
    for (let i = 0; i < FINALISE_BATCH; i++) await addSession(db, `p${String(i).padStart(3, '0')}`, { expiresInMs: -900000 + i });
    for (let i = 0; i < 5; i++) await addSession(db, `n${i}`, { expiresInMs: -600000 + i });
    const flaky = store(db);
    const real = flaky.finalise;
    flaky.finalise = async (id, result) => { if (id.startsWith('p')) throw new Error('boom'); return real(id, result); };
    const first = await finaliseExpiredSessions(flaky);
    assert.equal(first.finalised, 5); // newer sessions are scored in the same run
    assert.equal(first.failed, FINALISE_BATCH);
    assert.equal(first.quarantined, 0);
    assert.equal((await db.query("select state from recovery_sessions where id='p000'")).rows[0].state, 'active');
    for (let i = 1; i < FINALISE_MAX_FAILURES; i++) await finaliseExpiredSessions(flaky);
    const closed = (await db.query("select count(*)::int n from recovery_sessions where state='submitted' and selection_meta->>'finalisedBy'='unscorable'")).rows[0].n;
    assert.equal(closed, FINALISE_BATCH);
    assert.equal((await finaliseExpiredSessions(flaky)).due, 0);
  } finally { await db.close(); }
});

test('quarantine never touches live or in-grace sessions', async () => {
  const db = await setup();
  try {
    await addSession(db, 'live', { expiresInMs: 600000 });
    await assert.rejects(db.query("select quarantine_recovery_session('live','x',1)"), /not expired/);
    assert.equal((await db.query("select state from recovery_sessions where id='live'")).rows[0].state, 'active');
  } finally { await db.close(); }
});

test('scoring: telemetry that cannot be validated falls back to answers only; non-practice uses snapshot scoring', () => {
  const base = { subject: 'economics', questions, created_at: iso(-4000000), expires_at: iso(-3600000), selection_meta: { contentEvidence: 'legacy_bank' } };
  const late = scoreExpiredSession({ ...base, events: [answer(1, 'q1', 0, 99999999999)] });
  assert.equal(late.correct, 1);
  assert.equal(late.recovery.telemetry, 'invalid');
  assert.equal(late.expected_event_count, 1);
  const strict = scoreExpiredSession({ ...base, selection_meta: { contentEvidence: 'released_pathway' }, events: [answer(1, 'q1', 1, 500)] });
  assert.equal(strict.wrong, 1);
  assert.equal(strict.rawScore, -1);
  assert.equal(strict.score, 0);
  assert.equal(strict.selectionMeta.scoringVersion, 'server_snapshot_v1');
});

test('episode checks are reported through the hook only when a session is actually finalised', async () => {
  const db = await setup();
  try {
    await addSession(db, 'ep', { expiresInMs: -600000, qs: [questions[0]], meta: { episodeId: 'e1', itemId: 'i1', contentEvidence: 'released_pathway' }, events: [answer(1, 'q1', 0, 100)] });
    const seen = [];
    const run = await finaliseExpiredSessions(store(db), { onEpisodeCheck: async (row, result) => seen.push([row.id, result.correct]) });
    assert.equal(run.finalised, 1);
    assert.deepEqual(seen, [['ep', 1]]);
  } finally { await db.close(); }
});

test('deadline finalising honours checked answers and the per-student pass never throws', async () => {
  const { scoreExpiredSession: score, finaliseExpiredSessionsForUser } = await import('../../src/lib/server/sessionFinaliser.js');
  const now = Date.parse('2026-10-13T10:00:00Z');
  const q = (id, key) => ({ id, subject: 'english', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], correctIndex: key, correct_index: key, answer: key });
  const row = { id: 's1', user_id: 'u1', subject: 'english', questions: [q('q1', 0)], selection_meta: { contentEvidence: 'legacy_bank' },
    events: [{ seq: 1, qid: 'q1', type: 'answer', answer: 1, at: 1000 }], created_at: new Date(now - 3_600_000).toISOString(), expires_at: new Date(now - 600_000).toISOString() };
  const withoutCheck = score(row);
  const withCheck = score(row, [{ qid: 'q1', answer: 0 }]);
  assert.notEqual(withoutCheck.details?.[0]?.givenIndex, withCheck.details?.[0]?.givenIndex);
  assert.equal(withCheck.details?.[0]?.givenIndex, 0);
  const broken = { listDue: async () => { throw new Error('FINALISER_STORAGE_UNAVAILABLE'); } };
  assert.equal(await finaliseExpiredSessionsForUser(broken, { now }), null);
});
