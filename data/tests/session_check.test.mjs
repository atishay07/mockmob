import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { checkSessionAnswer, checkAllowed, resolveKey, applyCheckedAnswers, isCheckError, checkErrorBody } from '../../src/lib/server/sessionCheck.js';

const migration = readFileSync(new URL('../../supabase/migrations/20261013095000_session_check_log.sql', import.meta.url), 'utf8');
const NOW = Date.parse('2026-10-13T10:00:00Z');
const OPTS = ['A text', 'B text', 'C text', 'D text'];
const question = (over = {}) => ({ id: 'q1', body: 'What is it?', options: OPTS, correctIndex: 2, explanation: 'Because C.', ...over });
const currentRow = (over = {}) => ({ id: 'q1', status: 'live', verification_state: 'verified', is_deleted: false, body: 'What is it?', options: OPTS, correctIndex: 2, explanation: 'Because C.', ...over });
const session = (over = {}) => ({ id: 's1', user_id: 'u1', mode: 'quick', state: 'active', questions: [question()], selection_meta: {}, events: [],
  created_at: new Date(NOW - 60000).toISOString(), expires_at: new Date(NOW + 600000).toISOString(), ...over });

// Minimal supabase-js style fake: select/eq/maybeSingle and upsert(ignoreDuplicates).
function fakeDb({ sessions = [], questions = [currentRow()], log = [], failLog = false } = {}) {
  const tables = { recovery_sessions: sessions, questions, session_check_log: log };
  const keyOf = { recovery_sessions: ['id'], questions: ['id'], session_check_log: ['session_id', 'qid'] };
  return {
    log,
    from(name) {
      const rows = tables[name];
      const filters = [];
      const q = {
        select() { return q; },
        eq(k, v) { filters.push([k, v]); return q; },
        async maybeSingle() {
          if (failLog && name === 'session_check_log') return { data: null, error: { message: 'down' } };
          return { data: rows.find(r => filters.every(([k, v]) => r[k] === v)) || null, error: null };
        },
        async upsert(row, opts) {
          if (failLog) return { error: { message: 'down' } };
          const ks = opts.onConflict.split(',');
          if (!rows.some(r => ks.every(k => r[k] === row[k]))) rows.push({ ...row });
          return { error: null };
        },
      };
      return q;
    },
  };
}
const run = (db, over = {}) => checkSessionAnswer({ db, userId: 'u1', sessionId: 's1', qid: 'q1', answer: 2, now: NOW, ...over });
const rejects = (promise, status, code) => assert.rejects(promise, e => isCheckError(e) && e.status === status && e.code === code && typeof checkErrorBody(e).message === 'string');

test('quick and smart sessions are checked; result carries correctness, key and explanation', async () => {
  for (const mode of ['quick', 'smart']) {
    const db = fakeDb({ sessions: [session({ mode })] });
    assert.deepEqual(await run(db, { answer: 2 }), { correct: true, keyIndex: 2, explanation: 'Because C.' });
  }
  const db = fakeDb({ sessions: [session()] });
  assert.deepEqual(await run(db, { answer: 0 }), { correct: false, keyIndex: 2, explanation: 'Because C.' });
  assert.equal(db.log.length, 1);
  assert.equal(db.log[0].user_id, 'u1');
});

test('explanation is null when the question has none', async () => {
  const db = fakeDb({ sessions: [session({ questions: [question({ explanation: undefined })] })], questions: [currentRow({ explanation: undefined })] });
  assert.equal((await run(db)).explanation, null);
});

test('full and nta sessions are refused from the server row, before the key is read', async () => {
  for (const mode of ['full', 'nta', 'mystery']) {
    const db = fakeDb({ sessions: [session({ mode })] });
    await rejects(run(db, { mode: 'quick', checkAllowed: true }), 403, 'check_not_available');
    assert.equal(db.log.length, 0);
  }
  assert.equal(checkAllowed({ mode: 'full' }), false);
  assert.equal(checkAllowed({ mode: 'quick' }), true);
  assert.equal(checkAllowed(null), false);
});

test('a scored fresh check (episode) is refused even in quick mode', async () => {
  const db = fakeDb({ sessions: [session({ selection_meta: { episodeId: 'e1', learningPurpose: 'fresh_check' } })] });
  await rejects(run(db), 403, 'check_not_available');
});

test('a baseline diagnostic is refused with 403 check_not_available', async () => {
  const db = fakeDb({ sessions: [session({ selection_meta: { learningPurpose: 'baseline' } })] });
  await rejects(run(db), 403, 'check_not_available');
  assert.equal(checkAllowed({ mode: 'quick', selection_meta: { learningPurpose: 'baseline' } }), false);
  assert.equal(checkAllowed({ mode: 'quick', selection_meta: { learningPurpose: 'ordinary_practice' } }), true);
  assert.equal(checkAllowed({ mode: 'smart', selection_meta: {} }), true);
});

test('ownership: another user gets 404, unknown session 404, never the key', async () => {
  const db = fakeDb({ sessions: [session()] });
  await rejects(run(db, { userId: 'u2' }), 404, 'session_not_found');
  await rejects(run(db, { sessionId: 'nope' }), 404, 'session_not_found');
  assert.equal(db.log.length, 0);
});

test('invalid input is rejected without recording', async () => {
  const db = fakeDb({ sessions: [session()] });
  await rejects(run(db, { answer: 'C' }), 422, 'invalid_request');
  await rejects(run(db, { answer: -1 }), 422, 'invalid_request');
  await rejects(run(db, { answer: 4 }), 422, 'invalid_request');
  await rejects(run(db, { answer: 1.5 }), 422, 'invalid_request');
  await rejects(run(db, { qid: 42 }), 422, 'invalid_request');
  await rejects(run(db, { qid: 'other' }), 422, 'invalid_request');
  assert.equal(db.log.length, 0);
});

test('finality: a second check returns the first result, never the new answer', async () => {
  const db = fakeDb({ sessions: [session()] });
  const first = await run(db, { answer: 0 });
  assert.equal(first.correct, false);
  const second = await run(db, { answer: 2 }); // trying to change after seeing the key
  assert.deepEqual(second, first);
  assert.equal(db.log.length, 1);
  assert.equal(db.log[0].answer, 0);
});

test('finality survives expiry: a stored check can be re-read, a new check after expiry cannot be made', async () => {
  const db = fakeDb({ sessions: [session({ expires_at: new Date(NOW + 1000).toISOString() })] });
  const first = await run(db, { answer: 1 });
  assert.deepEqual(await run(db, { answer: 2, now: NOW + 5000 }), first);
  await rejects(run(db, { qid: 'q2', now: NOW + 5000 }), 422, 'invalid_request');
  const db2 = fakeDb({ sessions: [session({ expires_at: new Date(NOW - 1).toISOString() })] });
  await rejects(run(db2), 409, 'session_expired');
  assert.equal(db2.log.length, 0);
});

test('submitted sessions are closed', async () => {
  const db = fakeDb({ sessions: [session({ state: 'submitted' })] });
  await rejects(run(db), 409, 'session_closed');
});

test('corrected key: a verified current key replaces the snapshot key and its explanation', async () => {
  const db = fakeDb({ sessions: [session()], questions: [currentRow({ correctIndex: 3, explanation: 'Actually D.' })] });
  assert.deepEqual(await run(db, { answer: 3, eligible: () => true }), { correct: true, keyIndex: 3, explanation: 'Actually D.' });
  const unverified = fakeDb({ sessions: [session()], questions: [currentRow({ correctIndex: 3 })] });
  await rejects(run(unverified, { eligible: () => false }), 409, 'question_under_review');
  const verified = fakeDb({ sessions: [session()], questions: [currentRow({ correctIndex: 3, explanation: 'Actually D.' })] });
  assert.equal((await run(verified, { eligible: () => true, answer: 3 })).keyIndex, 3);
});

test('a later key correction applies to an already checked answer', async () => {
  const log = [];
  const db = fakeDb({ sessions: [session()], log });
  await run(db, { answer: 2 }); // correct at the time
  const db2 = fakeDb({ sessions: [session()], log, questions: [currentRow({ correctIndex: 3, explanation: 'Actually D.' })] });
  const again = await run(db2, { answer: 0, eligible: () => true });
  assert.deepEqual(again, { correct: false, keyIndex: 3, explanation: 'Actually D.' });
  assert.equal(log[0].answer, 2);
});

test('withdrawn, deleted, under review or edited questions give no verdict and lock nothing', async () => {
  const cases = [
    [],
    [currentRow({ is_deleted: true })],
    [currentRow({ status: 'quarantined' })],
    [currentRow({ verification_state: 'disputed' })],
    [currentRow({ options: ['A text', 'B text', 'C text', 'changed'] })],
  ];
  for (const questions of cases) {
    const db = fakeDb({ sessions: [session()], questions });
    await rejects(run(db), 409, 'question_under_review');
    assert.equal(db.log.length, 0);
  }
});

test('storage failure is a 503 and records nothing', async () => {
  const db = fakeDb({ sessions: [session()], failLog: true });
  await rejects(run(db), 503, 'unavailable');
});

test('ticket mode: needs a ticket owned by the caller; otherwise 404', async () => {
  const ticketRow = session({ id: 'att_practice_x', mode: 'smart' });
  const openTicket = (ticket, uid) => {
    if (ticket !== 'good') throw new Error('INVALID_PRACTICE_SESSION');
    if (uid !== 'u1') throw new Error('SESSION_NOT_FOUND');
    return ticketRow;
  };
  const common = { sessionId: 'att_practice_x', openTicket, attemptExists: async () => false };
  const db = fakeDb();
  await rejects(run(db, { sessionId: 'att_practice_x' }), 404, 'session_not_found'); // no ticket, no row
  await rejects(run(db, { ...common, sessionTicket: 'forged' }), 404, 'session_not_found');
  await rejects(run(db, { ...common, sessionTicket: 'good', userId: 'u2' }), 404, 'session_not_found');
  await rejects(run(db, { ...common, sessionTicket: 'good', sessionId: 'other' }), 404, 'session_not_found');
  const ok = await run(db, { ...common, sessionTicket: 'good', answer: 1 });
  assert.deepEqual(ok, { correct: false, keyIndex: 2, explanation: 'Because C.' });
  assert.deepEqual(await run(db, { ...common, sessionTicket: 'good', answer: 2 }), ok); // final
  await rejects(run(db, { ...common, sessionTicket: 'good', attemptExists: async () => true }), 409, 'session_closed');
});

test('ticket mode refuses a full-mode ticket', async () => {
  const openTicket = () => session({ id: 'att_practice_x', mode: 'full' });
  await rejects(run(fakeDb(), { sessionId: 'att_practice_x', sessionTicket: 't', openTicket, attemptExists: async () => false }), 403, 'check_not_available');
});

test('a ticket row id cannot be reached without its ticket even if a user guesses it', async () => {
  const db = fakeDb({ sessions: [session({ id: 'att_practice_x', user_id: 'u2' })] });
  await rejects(run(db, { sessionId: 'att_practice_x' }), 404, 'session_not_found');
});

test('resolveKey and applyCheckedAnswers are pure and strict', () => {
  assert.equal(resolveKey(question(), currentRow()).keyIndex, 2);
  assert.equal(resolveKey(question(), null).unavailable, true);
  assert.deepEqual(applyCheckedAnswers({ q1: 3, q2: 1 }, [{ qid: 'q1', answer: 0 }]), { q1: 0, q2: 1 });
  assert.deepEqual(applyCheckedAnswers(undefined, []), {});
});

async function pg() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec("create table public.users (id text primary key); insert into public.users values ('u1'),('u2');");
  await db.exec(migration);
  return db;
}

test('migration: idempotent, unique per session and question, first insert wins, cascades on user delete', async () => {
  const db = await pg();
  try {
    await db.exec(migration);
    await db.exec("insert into session_check_log(session_id,qid,user_id,answer) values ('s1','q1','u1',2)");
    await assert.rejects(db.exec("insert into session_check_log(session_id,qid,user_id,answer) values ('s1','q1','u1',1)"), /unique|duplicate/i);
    await db.exec("insert into session_check_log(session_id,qid,user_id,answer) values ('s1','q1','u1',1) on conflict (session_id,qid) do nothing");
    assert.equal((await db.query("select answer from session_check_log where session_id='s1' and qid='q1'")).rows[0].answer, 2);
    await db.exec("insert into session_check_log(session_id,qid,user_id,answer) values ('s1','q2','u1',0)");
    await assert.rejects(db.exec("insert into session_check_log(session_id,qid,user_id,answer) values ('s2','q1','u1',10)"), /check/i);
    await assert.rejects(db.exec("insert into session_check_log(session_id,qid,user_id,answer) values ('s2','q1','nobody',1)"), /foreign key/i);
    const at = (await db.query("select checked_at from session_check_log limit 1")).rows[0].checked_at;
    assert.ok(at instanceof Date);
    await db.exec("delete from public.users where id='u1'");
    assert.equal((await db.query('select count(*)::int n from session_check_log')).rows[0].n, 0);
  } finally { await db.close(); }
});

test('migration: row level security is on and clients have no table access', async () => {
  const db = await pg();
  try {
    const rls = (await db.query("select relrowsecurity from pg_class where relname='session_check_log'")).rows[0].relrowsecurity;
    assert.equal(rls, true);
    for (const role of ['anon', 'authenticated']) {
      const g = (await db.query("select has_table_privilege($1,'public.session_check_log','select') s, has_table_privilege($1,'public.session_check_log','insert') i", [role])).rows[0];
      assert.equal(g.s || g.i, false);
    }
    assert.equal((await db.query("select has_table_privilege('service_role','public.session_check_log','insert') i")).rows[0].i, true);
  } finally { await db.close(); }
});

test('route file shape: only POST and OPTIONS handlers, auth and 60 per minute limit', () => {
  const src = readFileSync(new URL('../../src/app/api/sessions/[id]/check/route.js', import.meta.url), 'utf8');
  const exportsList = [...src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map(m => m[1]).sort();
  assert.deepEqual(exportsList, ['OPTIONS', 'POST', 'dynamic']);
  assert.match(src, /auth\(request\)/);
  assert.match(src, /limit: 60/);
});

test('submit honours checked answers and fails closed only while checks are enabled', async () => {
  const { checkedAnswersForSubmit, applyCheckedAnswers } = await import('../../src/lib/server/sessionCheck.js');
  const rows = [{ qid: 'q1', answer: 2 }];
  const okDb = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: rows, error: null }) }) }) }) };
  const badDb = { from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: null, error: { code: '42P01' } }) }) }) }) };
  assert.deepEqual(await checkedAnswersForSubmit(okDb, 's1', 'u1', true), rows);
  assert.deepEqual(await checkedAnswersForSubmit(okDb, 's1', 'u1', false), rows);
  await assert.rejects(checkedAnswersForSubmit(badDb, 's1', 'u1', true), /SESSION_SUBMIT_FAILED/);
  assert.deepEqual(await checkedAnswersForSubmit(badDb, 's1', 'u1', false), []);
  // The checked answer replaces a different submitted answer for the same question.
  assert.deepEqual(applyCheckedAnswers({ q1: 0, q2: 1 }, rows), { q1: 2, q2: 1 });
});
