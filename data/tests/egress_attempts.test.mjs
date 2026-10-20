import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTEMPT_COLUMN_NAMES, attemptMemoKey, attemptSelect, memoisedAttempts, readAttemptRows } from '../attempt_reads.js';
import { computeBests } from '../../src/lib/server/recap.js';
import { formatIdFor } from '../../src/lib/server/attemptSummary.js';
import { replayExposures } from '../mistake_replay.js';
import { computePrepOSInsights } from '../prepos_insights.js';
import { rng, bytesOf } from './helpers/egress_fixtures.mjs';

// Egress item 5 (16 Oct 2026): Database.getAttempts takes `columns`, `limit` and a per-request memo. The "before"
// is the loop at commit 4db57fc5. Software fixtures shaped like production attempts (the real 12 columns; the
// real snapshot, details and selection_meta keys, checked read-only on 16 Oct 2026).

// The mapper of data/db.js (attemptOut), copied; the last test pins the copy to the file.
const attemptOut = (r) => r && ({
  id: r.id, userId: r.user_id, subject: r.subject, score: r.score, correct: r.correct, wrong: r.wrong, unattempted: r.unattempted, total: r.total,
  details: r.details || [], questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {},
  mode: (r.selection_meta && r.selection_meta.mode) || null,
  formatId: formatIdFor({ subject: r.subject, total: r.total, questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {} }),
  completedAt: new Date(r.completed_at).getTime(),
});

const SNAPSHOT_KEYS = ['aiScore', 'aiTier', 'anchorTier', 'authorId', 'body', 'chapter', 'concept', 'conceptId', 'correctAnswer', 'correctIndex', 'createdAt', 'difficulty', 'difficultyWeight', 'downvotes', 'explanation', 'familyId', 'id', 'internalSubject', 'options', 'orderIndex', 'passageGroupId', 'passageId', 'passageText', 'passageTitle', 'passageType', 'pyqAnchorId', 'qualityBand', 'qualityScore', 'question', 'questionType', 'score', 'source', 'sourceKind', 'status', 'subject', 'topic', 'uploadedBy', 'upvotes', 'userVote', 'verificationEvidence', 'verificationState'];

function attemptRows(seed, userId, count, { sameMinute = 0 } = {}) {
  const rand = rng(seed);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const total = 5 + Math.floor(rand() * 20);
    const snapshot = Array.from({ length: total }, (_, k) => {
      const id = `q-${seed}-${i}-${k}`;
      return { ...Object.fromEntries(SNAPSHOT_KEYS.map((key) => [key, null])), id, subject: 'accountancy', internalSubject: 'accountancy', chapter: ['Partnership', 'Ratios', 'Cash Flow'][k % 3],
        body: `Body ${id} `.repeat(6), question: `Body ${id}`, options: ['one', 'two', 'three', 'four'], correctIndex: k % 4, explanation: 'Because. '.repeat(12), familyId: k % 5 === 0 ? `fam-${k}` : null,
        conceptId: `c${k % 7}`, verificationEvidence: k === 1 ? { content_hash: 'h', family_id: 'fam-1', padding: 'x'.repeat(2000) } : null };
    });
    const details = snapshot.map((q, k) => ({ qid: q.id, givenIndex: k % 7 === 0 ? null : (k + i) % 4, isCorrect: (k + i) % 4 === q.correctIndex }));
    const correct = details.filter((d) => d.isCorrect).length;
    const at = new Date(Date.UTC(2026, 5, 1, 8, 0, 0) + (sameMinute && i % 2 ? 0 : i * 3_600_000));
    rows.push({ id: `a-${seed}-${String(i).padStart(4, '0')}`, user_id: userId, subject: ['accountancy', 'economics'][i % 2], score: correct * 5 - (total - correct), correct, wrong: total - correct, unattempted: 0, total,
      details, questions_snapshot: snapshot, completed_at: at.toISOString(),
      selection_meta: { mode: i % 3 === 0 ? 'full' : 'quick', scoringVersion: i % 4 === 0 ? 'historical_device' : 'server_snapshot_v1', durationMinutes: 60 } });
  }
  return rows;
}

function fakeAttemptsDb(rows) {
  const calls = [];
  return {
    calls,
    from(name) {
      assert.equal(name, 'attempts');
      const state = { select: '*', user: null, orders: [], range: null };
      const q = {
        select(columns) { state.select = columns; return q; },
        eq(column, value) { assert.equal(column, 'user_id'); state.user = value; return q; },
        order(column, opts = { ascending: true }) { state.orders.push([column, opts.ascending !== false]); return q; },
        range(a, b) { state.range = [a, b]; return q; },
        then(resolve, reject) {
          let list = rows.filter((r) => r.user_id === state.user);
          list.sort((a, b) => { for (const [column, asc] of state.orders) { if (a[column] !== b[column]) return (a[column] < b[column] ? -1 : 1) * (asc ? 1 : -1); } return 0; });
          list = list.slice(state.range[0], state.range[1] + 1);
          const cols = state.select === '*' ? null : state.select.split(',');
          const data = list.map((r) => (cols ? Object.fromEntries(cols.map((c) => [c, structuredClone(r[c])])) : structuredClone(r)));
          calls.push({ select: state.select, rows: data.length, bytes: bytesOf(data) });
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
}

// The loop of Database.getAttempts at 4db57fc5.
async function getAttemptsBefore(db, userId) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('attempts').select('*').eq('user_id', userId).order('completed_at', { ascending: false }).order('id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows.map(attemptOut);
}
const getAttemptsAfter = async (db, userId, options) => (await readAttemptRows(db, userId, options)).map(attemptOut);

const ROWS = [...attemptRows(1, 'u1', 130), ...attemptRows(2, 'u2', 7), ...attemptRows(3, 'u3', 2300).map((r) => ({ ...r, details: [], questions_snapshot: [] })), ...attemptRows(4, 'u4', 150, { sameMinute: 1 })];

test('default read is the old read, over one student with more than 1000 attempts too', async () => {
  for (const user of ['u1', 'u2', 'u3', 'u4', 'nobody']) {
    assert.deepEqual(await getAttemptsAfter(fakeAttemptsDb(ROWS), user), await getAttemptsBefore(fakeAttemptsDb(ROWS), user), user);
  }
  assert.equal((await getAttemptsAfter(fakeAttemptsDb(ROWS), 'u3')).length, 2300);
  await assert.rejects(readAttemptRows(fakeAttemptsDb(ROWS), ''), /attempt_owner_required/);
});

test('limit N is exactly the first N attempts of the full read, including ties on completed_at', async () => {
  for (const user of ['u1', 'u3', 'u4']) {
    const full = await getAttemptsBefore(fakeAttemptsDb(ROWS), user);
    for (const limit of [1, 5, 60, 999, 1000, 1001, 1500, 5000]) {
      const db = fakeAttemptsDb(ROWS);
      assert.deepEqual(await getAttemptsAfter(db, user, { limit }), full.slice(0, limit), `${user} limit ${limit}`);
      assert.ok(db.calls.reduce((n, c) => n + c.rows, 0) <= Math.min(limit + 1000, full.length + 1000));
    }
  }
  assert.throws(() => attemptSelect(['nope']), /attempt_column_unknown/);
  await assert.rejects(readAttemptRows(fakeAttemptsDb(ROWS), 'u1', { limit: 0 }), /attempt_limit_invalid/);
});

test('column lists: known names only, one select string, no duplicates', () => {
  assert.equal(attemptSelect(undefined), '*');
  assert.equal(attemptSelect(['id', 'subject', 'id']), 'id,subject');
  assert.equal(attemptSelect('id, score'), 'id,score');
  assert.throws(() => attemptSelect([]), /attempt_columns_required/);
  assert.throws(() => attemptSelect(['id', 'details;drop table x']), /attempt_column_unknown/);
  assert.equal(ATTEMPT_COLUMN_NAMES.length, 12);
});

// ---- each narrowed consumer reads only what it is given ---------------------------------------------------------
const full = (user) => getAttemptsBefore(fakeAttemptsDb(ROWS), user);

test('learning summary: every field it reads is identical from the five-column read', async () => {
  const columns = ['subject', 'score', 'total', 'details', 'completed_at'];
  const before = await full('u1');
  const after = await getAttemptsAfter(fakeAttemptsDb(ROWS), 'u1', { columns });
  assert.equal(after.length, before.length);
  const used = (a) => ({ subject: a.subject, total: a.total, score: a.score, completedAt: a.completedAt, details: a.details });
  assert.deepEqual(after.map(used), before.map(used));
});

test('replay and learning-start exposures: identical from the snapshot-only read', async () => {
  const before = await full('u1');
  const after = await getAttemptsAfter(fakeAttemptsDb(ROWS), 'u1', { columns: ['questions_snapshot'] });
  assert.deepEqual(replayExposures(after), replayExposures(before));
  assert.deepEqual(after.flatMap((a) => a.questionsSnapshot || []), before.flatMap((a) => a.questionsSnapshot || []));
  const seenOf = (list) => { const seen = list.flatMap((a) => a.questionsSnapshot || []); return { ids: seen.map((q) => q.id), families: seen.map((q) => q.familyId).filter(Boolean) }; };
  assert.deepEqual(seenOf(after), seenOf(before));
});

test('mock autopsy action: the newest attempt id, subject and score, and the empty case, are identical', async () => {
  const before = await full('u1');
  const after = await getAttemptsAfter(fakeAttemptsDb(ROWS), 'u1', { columns: ['id', 'subject', 'score'], limit: 1 });
  assert.equal(after.length, 1);
  assert.deepEqual({ id: after[0].id, subject: after[0].subject, score: after[0].score }, { id: before[0].id, subject: before[0].subject, score: before[0].score });
  assert.equal((await getAttemptsAfter(fakeAttemptsDb(ROWS), 'nobody', { columns: ['id', 'subject', 'score'], limit: 1 })).length, 0);
});

test('best marks: computeBests is identical without the details column', async () => {
  const columns = ['id', 'user_id', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'questions_snapshot', 'completed_at', 'selection_meta'];
  for (const user of ['u1', 'u2', 'u4']) {
    const before = await full(user);
    const after = await getAttemptsAfter(fakeAttemptsDb(ROWS), user, { columns });
    assert.deepEqual(computeBests(after), computeBests(before), user);
  }
  assert.ok(computeBests(await full('u1')).length > 0, 'the fixture has comparable attempts');
});

test('insights, compass and mentor: the newest 60 are the same attempts, so the same insights', async () => {
  const before = (await full('u1')).slice(0, 60);
  const after = await getAttemptsAfter(fakeAttemptsDb(ROWS), 'u1', { limit: 60 });
  assert.deepEqual(after, before);
  const insights = (list) => { const { generatedAt, ...rest } = computePrepOSInsights(list, { subjectNames: {} }); return rest; };
  assert.deepEqual(insights(after), insights(before));
});

// ---- the per-request memo ---------------------------------------------------------------------------------------
test('memo: the second read of the same shape in one request costs nothing and is its own copy', async () => {
  const db = fakeAttemptsDb(ROWS);
  const memo = new Map();
  const load = (options) => memoisedAttempts(memo, attemptMemoKey('u1', options), async () => (await readAttemptRows(db, 'u1', options)).map(attemptOut));
  const first = await load({});
  first[0].details.push('mutated'); first.reverse();
  const second = await load({});
  assert.equal(db.calls.length, 1, 'one database read');
  assert.deepEqual(second, await getAttemptsBefore(fakeAttemptsDb(ROWS), 'u1'), 'the copy is not affected by what the first caller did');
  second[1].selectionMeta.x = 1;
  assert.deepEqual(await load({}), await getAttemptsBefore(fakeAttemptsDb(ROWS), 'u1'));
  await load({ limit: 60 });
  await load({ columns: ['id'] });
  assert.equal(db.calls.length, 3, 'another shape is another read');
  // started together (Promise.all) still costs one
  const db2 = fakeAttemptsDb(ROWS); const memo2 = new Map();
  await Promise.all([1, 2, 3].map(() => memoisedAttempts(memo2, 'k', async () => (await readAttemptRows(db2, 'u1')).map(attemptOut))));
  assert.equal(db2.calls.length, 1);
});

test('memo: no memo reads every time; a failed read is not remembered', async () => {
  const db = fakeAttemptsDb(ROWS);
  await memoisedAttempts(undefined, 'k', async () => readAttemptRows(db, 'u2'));
  await memoisedAttempts(undefined, 'k', async () => readAttemptRows(db, 'u2'));
  assert.equal(db.calls.length, 2);
  const memo = new Map(); let attempts = 0;
  const flaky = () => memoisedAttempts(memo, 'k', async () => { attempts += 1; if (attempts === 1) throw new Error('down'); return [1]; });
  await assert.rejects(flaky(), /down/);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(await flaky(), [1]);
  assert.equal(attempts, 2);
});

test('bytes: what each narrowed read moves, against select(*), over one student of 130 attempts', async () => {
  const sizes = {};
  const measure = async (name, options) => { const db = fakeAttemptsDb(ROWS); await readAttemptRows(db, 'u1', options); sizes[name] = db.calls.reduce((n, c) => n + c.bytes, 0); };
  await measure('full', {});
  await measure('limit60', { limit: 60 });
  await measure('summary', { columns: ['subject', 'score', 'total', 'details', 'completed_at'] });
  await measure('snapshots', { columns: ['questions_snapshot'] });
  await measure('autopsy', { columns: ['id', 'subject', 'score'], limit: 1 });
  await measure('bests', { columns: ['id', 'user_id', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'questions_snapshot', 'completed_at', 'selection_meta'] });
  assert.ok(sizes.limit60 < sizes.full * 0.5);
  assert.ok(sizes.summary < sizes.full * 0.2);
  assert.ok(sizes.autopsy < sizes.full * 0.01);
  assert.ok(sizes.bests < sizes.full);
  assert.ok(sizes.snapshots < sizes.full);
});

test('the copied mapper is the one in data/db.js', () => {
  const source = readFileSync(new URL('../db.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf('const attemptOut = (r) => r && ({');
  const body = source.slice(start, source.indexOf('});', start) + 3).replace(/\s+/g, ' ');
  for (const part of ["id: r.id,", "userId: r.user_id,", "details: r.details || [],", "questionsSnapshot: r.questions_snapshot || [],", "selectionMeta: r.selection_meta || {},", "mode: (r.selection_meta && r.selection_meta.mode) || null,", "formatId: formatIdFor({ subject: r.subject, total: r.total, questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {} }),", "completedAt: new Date(r.completed_at).getTime(),"]) {
    assert.ok(body.includes(part), part);
  }
  assert.match(source, /async getAttempts\(userId, \{ columns, limit, memo, slim \} = \{\}\)/);
});
