import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openCheck, VERIFY_BATCH } from '../../src/services/recovery/repairCheck.js';
import { mistakeId } from '../../src/services/recovery/repairFlow.js';
import { createCheckStore } from '../../src/services/recovery/repairCheckStore.js';
import { createSubjectMemo } from '../subject_token.js';
import { practiceFakeDb } from './helpers/practice_fake_db.mjs';

// Egress item F10 (20 Oct 2026): the repair check verifies three candidates per read, and keeps a chapter's candidates five minutes.
const fx = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/pool_goodwill.json', import.meta.url)), 'utf8'));
const user = { id: 'u1' };
const MID = mistakeId('u1', 'a1', 'q_mistake');
const snapshot = { id: 'q_mistake', subject: 'accountancy', chapter: 'Partnership Accounts', question: fx.mistake.question, options: fx.mistake.options.map((o) => ({ ...o })), correctIndex: 0 };
const attempt = { id: 'a1', userId: 'u1', subject: 'accountancy', completedAt: Date.parse('2026-10-14T10:00:00Z'), questionsSnapshot: [snapshot], details: [{ qid: 'q_mistake', isCorrect: false, givenIndex: 1 }] };

function depsFor({ published, verifyBatch }) {
  const reads = [];
  const rows = new Map(fx.candidates.map((c) => [c.id, { ...c }]));
  let receipt = { repair: { rule: 'Super profit is average profit minus normal profit.', trap_type: 'wrong_rule' } };
  const deps = {
    verifyBatch,
    now: () => Date.parse('2026-10-16T20:00:00Z'),
    loadAttempt: async () => attempt,
    loadQuestion: async () => ({ data: { ...fx.mistake }, error: null }),
    findRepairReservation: async () => ({ operation_key: `repair:${MID}:req_0123456789abcdef`, receipt }),
    loadChapterCandidates: async () => [...rows.values()],
    loadSeen: async () => new Set(fx.seen),
    loadExcluded: async () => new Set(),
    verifyPublished: async (ids) => { reads.push(ids.length); return new Map(ids.filter((id) => published.has(id)).map((id) => [id, rows.get(id)])); },
    claimOffer: async ({ offer }) => { receipt = { ...receipt, offered: offer }; return { ok: true }; },
    recordSeen: async () => {},
    patchOffer: async () => {},
  };
  return { deps, reads };
}

test('F10: the first verified candidate in rank order is the same for any batch size, with fewer rows read for a small one', async () => {
  const all = fx.candidates.map((c) => c.id);
  const cases = [all, all.slice(2), all.slice(5), all.filter((_, i) => i % 2 === 0), all.slice(-1), []];
  for (const published of cases) {
    const results = [];
    const rowsRead = {};
    for (const verifyBatch of [1, 3, 12, undefined]) {
      const { deps, reads } = depsFor({ published: new Set(published), verifyBatch });
      const res = await openCheck({ user, attemptId: 'a1', questionId: 'q_mistake', deps });
      results.push(JSON.stringify(res));
      rowsRead[String(verifyBatch)] = reads.reduce((n, x) => n + x, 0);
    }
    assert.equal(new Set(results).size, 1, `identical response for every batch size (${published.length} verifiable)`);
    assert.ok(rowsRead['3'] <= rowsRead['12'] && rowsRead.undefined === rowsRead['3'], 'the default is the batch of three');
  }
  assert.equal(VERIFY_BATCH, 3);
  const { deps, reads } = depsFor({ published: new Set(all), verifyBatch: undefined });
  await openCheck({ user, attemptId: 'a1', questionId: 'q_mistake', deps });
  assert.ok(reads[0] <= 3, 'the first read asks for at most three rows');
});

test('F10: the chapter memo serves the same rows inside five minutes, then two head counts, and reads again on any change', async () => {
  const MIN = 60_000;
  let t = Date.parse('2026-10-20T10:00:00.000Z');
  const rows = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, subject: 'accountancy', chapter: 'Goodwill', is_deleted: false, status: 'live', score: 0, created_at: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}T00:00:00Z`, updated_at: '2026-09-01T00:00:00.000Z' }));
  const db = practiceFakeDb({ questions: rows });
  const memo = createSubjectMemo({ now: () => t });
  let reads = 0;
  const read = async () => { reads += 1; return rows.map((r) => ({ ...r })); };
  const get = () => memo.get(db, 'k', 'accountancy', read);
  const first = await get();
  assert.equal(reads, 1);
  t += 4 * MIN;
  assert.deepEqual(await get(), first);
  assert.equal(reads, 1, 'inside five minutes');
  db.reset();
  t += 2 * MIN;
  assert.deepEqual(await get(), first);
  assert.equal(reads, 1, 'unchanged: two head counts, no read');
  assert.equal(db.calls.filter((c) => c.head).length, 2);
  rows[3].updated_at = new Date(t).toISOString();
  t += 6 * MIN;
  await get();
  assert.equal(reads, 2, 'a touched row reads again');
  rows.push({ ...rows[0], id: 'q-new', updated_at: new Date(t).toISOString() });
  t += 6 * MIN;
  await get();
  assert.equal(reads, 3, 'an insert reads again');
  (await get()).push({ id: 'mutated' });
  assert.ok(!(await get()).some((r) => r.id === 'mutated'), 'each caller gets its own copy');
  const failing = { from: () => { throw new Error('down'); } };
  t += 6 * MIN;
  assert.equal((await memo.get(failing, 'k', 'accountancy', read)).length, rows.length, 'a failing check reads again');
});

test('F10: the check store uses the memo for the chapter candidates only, per client, and its rows are the same ones', async () => {
  const src = readFileSync(fileURLToPath(new URL('../../src/services/recovery/repairCheckStore.js', import.meta.url)), 'utf8');
  assert.match(src, /subjectMemoFor\(db, 'repair-check-chapters'\)\.get\(db, JSON\.stringify\(\[subject, chapter\]\), subject/);
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, subject: 'accountancy', chapter: 'Goodwill', is_deleted: false, status: 'live', score: 0, created_at: `2026-09-${String(1 + i).padStart(2, '0')}T00:00:00Z`, updated_at: '2026-09-01T00:00:00.000Z' }));
  const db = practiceFakeDb({ questions: rows });
  const store = createCheckStore({ db });
  const one = await store.loadChapterCandidates({ subject: 'accountancy', chapter: 'Goodwill' });
  db.reset();
  const two = await store.loadChapterCandidates({ subject: 'accountancy', chapter: 'Goodwill' });
  assert.deepEqual(two, one);
  assert.equal(db.calls.length, 0, 'the second open of the same chapter reads nothing');
  assert.deepEqual(one.map((r) => r.id).sort(), rows.map((r) => r.id).sort());
});
