import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { readAttemptQuestionIds, resetAttemptQuestionIdsState } from '../attempt_question_ids.js';
import { loadPreviousNtaPaperIds, loadSeenQuestionIds } from '../nta_pool.js';
import { richAttemptRows } from './helpers/lean_fixtures.mjs';

// Egress items A9, F13, F14 (20 Oct 2026): the ids of a student's newest attempts through public.attempt_question_ids, run for real on
// PGlite from the unedited migration, against the old read of the snapshots.
const migration = readFileSync(new URL('../../supabase/migrations/20261020150100_attempt_question_ids_fn.sql', import.meta.url), 'utf8');
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const odd = [
  { id: 'odd-1', user_id: 'odd', subject: 'economics', completed_at: '2026-10-01T00:00:00Z', selection_meta: { mode: 'nta' }, snapshot: [{ id: 'a', familyId: 'fa' }, { id: '' }, { question: 'no id' }, 'text', null, { id: 'b' }] },
  { id: 'odd-2', user_id: 'odd', subject: 'economics', completed_at: '2026-10-02T00:00:00Z', selection_meta: {}, snapshot: [{ id: 'c', familyId: 'fc' }] },
  { id: 'odd-3', user_id: 'odd', subject: 'economics', completed_at: '2026-10-03T00:00:00Z', selection_meta: { mode: 'quick' }, snapshot: 'not an array' },
  { id: 'odd-4', user_id: 'odd', subject: 'accountancy', completed_at: '2026-10-04T00:00:00Z', selection_meta: { mode: 'nta' }, snapshot: [{ id: 'd' }] },
  { id: 'odd-5', user_id: 'odd', subject: 'economics', completed_at: '2026-10-05T00:00:00Z', selection_meta: { mode: 'nta' }, snapshot: [] },
];
let pg;
const rows = [...richAttemptRows(1, 'u1', 30), ...richAttemptRows(2, 'u2', 4)];
test('setup', async () => {
  pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create table public.attempts(id text primary key, user_id text, subject text, score integer, correct integer, wrong integer, unattempted integer, total integer, details jsonb, questions_snapshot jsonb, completed_at timestamptz, selection_meta jsonb);`);
  await pg.exec(migration);
  const put = (r) => pg.query('insert into public.attempts(id,user_id,subject,completed_at,selection_meta,questions_snapshot,details) values ($1,$2,$3,$4,$5,$6,$7)', [r.id, r.user_id, r.subject, r.completed_at, JSON.stringify(r.selection_meta), JSON.stringify(r.questions_snapshot ?? r.snapshot), '[]']);
  for (const r of rows) await put(r);
  for (const r of odd) await put(r);
});
after(async () => { await pg?.close(); });

const wire = (r) => ({ ...r, completed_at: r.completed_at instanceof Date ? r.completed_at.toISOString() : r.completed_at });
// A client whose rpc runs the function and whose from('attempts') is the old read, both over the same table.
function client({ withFunction = true, fail = null } = {}) {
  const calls = [];
  const db = {
    calls,
    from(table) {
      const q = { eqs: [], max: null };
      const b = {
        select() { return b; }, gt() { return b; }, order() { return b; },
        eq(column, value) { q.eqs.push([column, value]); return b; },
        limit(n) { q.max = n; return b; },
        abortSignal() { return b; },
        then(resolve, reject) {
          return (async () => {
            if (table !== 'attempts') return { data: [], error: null };
            const where = ['true']; const params = [];
            for (const [column, value] of q.eqs) {
              params.push(value);
              where.push(column === 'selection_meta->>mode' ? `selection_meta->>'mode' = $${params.length}` : `${column} = $${params.length}`);
            }
            const { rows: out } = await pg.query(`select questions_snapshot, selection_meta from public.attempts where ${where.join(' and ')} order by completed_at desc ${q.max ? `limit ${q.max}` : ''}`, params);
            calls.push({ kind: 'table', bytes: JSON.stringify(out).length });
            return { data: out, error: null };
          })().then(resolve, reject);
        },
      };
      return b;
    },
  };
  if (withFunction) {
    db.rpc = (fn, args) => {
      const b = { abortSignal() { return b; }, then(resolve, reject) {
        return (async () => {
          if (fail) { calls.push({ kind: 'rpc', error: fail.code }); return { data: null, error: fail }; }
          const { rows: out } = await pg.query('select * from public.attempt_question_ids($1,$2,$3,$4)', [args.p_user_id, args.p_subject, args.p_mode, args.p_limit]);
          calls.push({ kind: 'rpc', bytes: JSON.stringify(out).length });
          return { data: out, error: null };
        })().then(resolve, reject);
      } };
      assert.equal(fn, 'attempt_question_ids');
      return b;
    };
  }
  return db;
}

// the old loops, copied
const oldRecent = (list) => { const ids = new Set(); for (const row of list) for (const q of row.questions_snapshot || []) if (q && q.id) ids.add(q.id); return ids; };

test('the function gives the ids and family ids of each snapshot in order, skipping elements without an id, newest attempt first', async () => {
  const { rows: out } = await pg.query("select * from public.attempt_question_ids('odd')");
  assert.deepEqual(out.map((r) => r.attempt_id), ['odd-5', 'odd-4', 'odd-3', 'odd-2', 'odd-1']);
  assert.deepEqual(out.find((r) => r.attempt_id === 'odd-1').question_ids, ['a', 'b']);
  assert.deepEqual(out.find((r) => r.attempt_id === 'odd-1').family_ids, ['fa']);
  assert.deepEqual(out.find((r) => r.attempt_id === 'odd-3').question_ids, [], 'a snapshot that is not an array has no ids');
  const filtered = (await pg.query("select * from public.attempt_question_ids('odd', 'economics', 'nta', 1)")).rows;
  assert.deepEqual(filtered.map((r) => r.attempt_id), ['odd-5']);
  assert.equal((await pg.query("select * from public.attempt_question_ids('odd', 'economics', 'nta')")).rows.length, 2);
  assert.equal((await pg.query("select * from public.attempt_question_ids('nobody')")).rows.length, 0);
});

test('F14: the recency set of the newest N papers of the subject is the old set, for every N, from far fewer bytes', async () => {
  for (const user of ['u1', 'u2']) for (const subject of ['accountancy', 'economics']) for (const lastN of [3, 5, 8, 30]) {
    resetAttemptQuestionIdsState();
    const db = client();
    const via = await readAttemptQuestionIds(db, { userId: user, subject, limit: lastN });
    const old = await db.from('attempts').select('questions_snapshot').eq('user_id', user).eq('subject', subject).order('completed_at', { ascending: false }).limit(lastN);
    assert.deepEqual(new Set(via.rows.flatMap((r) => r.questionIds)), oldRecent(old.data), `${user} ${subject} ${lastN}`);
    assert.ok(via.rows.length <= lastN);
    const rpcBytes = db.calls.find((c) => c.kind === 'rpc').bytes;
    const tableBytes = db.calls.find((c) => c.kind === 'table').bytes;
    assert.ok(rpcBytes < tableBytes * 0.1, `${rpcBytes} vs ${tableBytes}`);
  }
  assert.ok(oldRecent((await client().from('attempts').select('x').eq('user_id', 'u1').eq('subject', 'accountancy').order('x').limit(5)).data).size > 20, 'the fixture has questions to be seen');
});

test('F13: the seen set and the previous NTA papers are the old sets; an NTA attempt only counts for the NTA lookup', async () => {
  for (const user of ['u1', 'odd', 'nobody']) for (const subject of ['accountancy', 'economics']) {
    resetAttemptQuestionIdsState();
    const withFn = await loadSeenQuestionIds(client(), user, subject);
    const without = await loadSeenQuestionIds(client({ withFunction: false }), user, subject);
    assert.deepEqual([...withFn].sort(), [...without].sort(), `seen ${user} ${subject}`);
    const nta = await loadPreviousNtaPaperIds(client(), user, subject);
    const ntaOld = await loadPreviousNtaPaperIds(client({ withFunction: false }), user, subject);
    assert.deepEqual([...nta].sort(), [...ntaOld].sort(), `nta ${user} ${subject}`);
    assert.equal(nta.lookupFailed, ntaOld.lookupFailed);
  }
  const odd = await loadPreviousNtaPaperIds(client(), 'odd', 'economics');
  assert.deepEqual([...odd].sort(), ['a', 'b'], 'only the NTA attempts of the subject');
  assert.deepEqual([...(await loadSeenQuestionIds(client(), 'odd', 'economics'))].sort(), ['a', 'b', 'c']);
});

test('a missing function falls back to the snapshots once and is not asked again for five minutes; any other error is the old error path', async () => {
  resetAttemptQuestionIdsState();
  let t = 1_000;
  const missing = client({ fail: { code: 'PGRST202', message: 'not found' } });
  assert.equal(await readAttemptQuestionIds(missing, { userId: 'u1', subject: 'accountancy', limit: 3, now: () => t }), null);
  assert.equal(await readAttemptQuestionIds(missing, { userId: 'u1', subject: 'accountancy', limit: 3, now: () => t }), null);
  assert.equal(missing.calls.length, 1, 'asked once inside five minutes');
  t += 5 * 60 * 1000 + 1;
  await readAttemptQuestionIds(missing, { userId: 'u1', subject: 'accountancy', limit: 3, now: () => t });
  assert.equal(missing.calls.length, 2, 'asked again after five minutes');
  resetAttemptQuestionIdsState();
  // the seen set with the function missing is the old one, from the table
  const seen = await loadSeenQuestionIds(client({ fail: { code: '42883', message: 'no function' } }), 'u1', 'accountancy');
  assert.deepEqual([...seen].sort(), [...(await loadSeenQuestionIds(client({ withFunction: false }), 'u1', 'accountancy'))].sort());
  // a timeout of the function is a failed lookup, exactly as a timeout of the old query was: nothing seen, marked failed, and no table read
  resetAttemptQuestionIdsState();
  const timing = client({ fail: { code: '57014', message: 'statement timeout' } });
  assert.equal((await loadSeenQuestionIds(timing, 'u1', 'accountancy')).size, 0);
  const previous = await loadPreviousNtaPaperIds(timing, 'u1', 'accountancy');
  assert.equal(previous.size, 0);
  assert.equal(previous.lookupFailed, true);
  assert.ok(!timing.calls.some((c) => c.kind === 'table'), 'no heavy fallback read after a timeout');
  resetAttemptQuestionIdsState();
});

test('wiring, and the migration is service_role only with an undo', async () => {
  assert.match(src('data/db.js'), /readAttemptQuestionIds\(supabaseAdmin\(\), \{ userId, subject: subjectId, limit: lastN \}\)/);
  assert.match(src('data/nta_pool.js'), /readAttemptQuestionIds\(db, \{ userId, subject, limit: 40, signal \}\)/);
  assert.match(src('data/nta_pool.js'), /readAttemptQuestionIds\(db, \{ userId, subject, mode: 'nta', limit: 40, signal \}\)/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.attempt_question_ids\(text, text, text, integer\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.attempt_question_ids\(text, text, text, integer\) to service_role;/);
  assert.match(migration, /set search_path to 'public', 'pg_temp'/);
  assert.ok(src('supabase/undo/20261020150100_attempt_question_ids_fn.undo.sql').includes('drop function if exists public.attempt_question_ids(text, text, text, integer);'));
  for (const role of ['anon', 'authenticated']) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(pg.query("select * from public.attempt_question_ids('u1')"), /permission denied/, role);
    await pg.exec('reset role');
  }
});
