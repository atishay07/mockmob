import test from 'node:test';
import assert from 'node:assert/strict';
import { runRepair, mistakeId } from '../../src/services/recovery/repairFlow.js';
import { findStoredRepair, getSavedRepairs, getRepairedCounts, repairFromReceipt, savedRepairsForAttempt, repairedCounts } from '../../src/lib/server/repairSaved.js';
import { attemptedWhen, paperStamp, clockTime } from '../repair_paper.mjs';
import { RUN_COPY, earlierMissAt, sourceLabels, sourceLabel } from '../../src/components/recovery/repairRun.js';
import { repairLabel, REPAIR_COPY, REPAIR_LOADING } from '../repair_presentation.mjs';

// F17 (17 Oct 2026): a repaired mistake reopens its saved repair and never offers a paid one again; each mistake names the paper
// it came from and when it was attempted. The fake database returns what PostgREST returns: only the selected columns, jsonb as
// objects, timestamps as ISO strings with an offset, an empty array when nothing matches and { data: null, error } on failure.

const U = 'u1';
const id = (a, q) => mistakeId(U, a, q);
const repairBody = { version: 3, trap_type: 'not_in_passage', trap: 'It is long.', why_wrong: 'No.', why_right: 'Yes.', others: [], rule: 'Read.', model: 'gpt-6-luna', generatedAt: '2026-10-16T16:22:11.000Z' };
const row = (a, q, req, over = {}) => ({ operation_key: `repair:${id(a, q)}:${req}`, user_id: U, state: 'committed', action: 'score_recovery_repair', created_at: '2026-10-16T16:20:00.123456+00:00', updated_at: '2026-10-16T16:22:11.654321+00:00', receipt: { provider: 'openai', repair: repairBody, promptVersion: 3 }, ...over });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A query builder with the PostgREST surface the readers use. select() narrows the columns, like the real thing.
function fakeDb(rows, { fail = false } = {}) {
  const log = [];
  return {
    log,
    from(table) {
      const q = { table, filters: [], order: null, limit: null, cols: null, eq: [], like: null };
      const api = {
        select(cols) { q.cols = cols.split(',').map((c) => c.trim()); return api; },
        eq(c, v) { q.filters.push((r) => r[c] === v); q.eq.push([c, v]); return api; },
        in(c, vs) { q.filters.push((r) => vs.includes(r[c])); return api; },
        like(c, pat) { const re = new RegExp(`^${escapeRe(pat).replace(/%/g, '.*')}$`); q.filters.push((r) => re.test(r[c])); q.like = [c, pat]; return api; },
        not(c, op, v) { if (c === 'receipt->repair' && op === 'is' && v === null) q.filters.push((r) => r.receipt && r.receipt.repair != null); return api; },
        order(c, o) { q.order = [c, o?.ascending === false ? 'desc' : 'asc']; return api; },
        limit(n) { q.limit = n; return api; },
        then(res, rej) {
          log.push(q);
          if (fail) return Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }).then(res, rej);
          let out = rows.filter((r) => q.filters.every((f) => f(r)));
          if (q.order) {
            const [c, dir] = q.order;
            out = [...out].sort((a, b) => (Date.parse(a[c]) - Date.parse(b[c])) * (dir === 'desc' ? -1 : 1));
          }
          if (q.limit) out = out.slice(0, q.limit);
          out = out.map((r) => Object.fromEntries(q.cols.map((c) => [c, r[c]])));
          return Promise.resolve({ data: out, error: null }).then(res, rej);
        },
      };
      return api;
    },
  };
}

test('findStoredRepair: returns the saved repair, newest first, from the exact row shape PostgREST sends', async () => {
  const older = row('a1', 'q1', 'r'.repeat(16), { created_at: '2026-10-15T10:00:00.000000+00:00', receipt: { repair: { ...repairBody, rule: 'Older rule.' } } });
  const newer = row('a1', 'q1', 's'.repeat(16));
  const db = fakeDb([older, newer, row('a1', 'q2', 't'.repeat(16))]);
  const got = await findStoredRepair(db, U, id('a1', 'q1'));
  assert.equal(got.rule, 'Read.');
  const q = db.log[0];
  assert.deepEqual(q.eq, [['user_id', U], ['state', 'committed']]);
  assert.deepEqual(q.like, ['operation_key', `repair:${id('a1', 'q1')}:%`]);
  assert.deepEqual(q.cols, ['receipt', 'created_at']);
});

test('findStoredRepair: nothing saved is null; a newest committed row without a repair does not hide an older repair', async () => {
  assert.equal(await findStoredRepair(fakeDb([]), U, id('a1', 'q1')), null);
  const noRepair = row('a1', 'q1', 'x'.repeat(16), { created_at: '2026-10-17T10:00:00.000000+00:00', receipt: { provider: 'openai' } });
  const nullReceipt = row('a1', 'q1', 'y'.repeat(16), { created_at: '2026-10-17T11:00:00.000000+00:00', receipt: null });
  const saved = row('a1', 'q1', 'z'.repeat(16));
  const got = await findStoredRepair(fakeDb([noRepair, nullReceipt, saved]), U, id('a1', 'q1'));
  assert.equal(got.trap_type, 'not_in_passage');
  assert.equal(await findStoredRepair(fakeDb([noRepair, nullReceipt]), U, id('a1', 'q1')), null);
});

test('findStoredRepair: another student, an open reservation or another mistake is never a saved repair', async () => {
  const db = fakeDb([row('a1', 'q1', 'a'.repeat(16), { user_id: 'someone-else' }), row('a1', 'q1', 'b'.repeat(16), { state: 'executing' }), row('a1', 'q2', 'c'.repeat(16))]);
  assert.equal(await findStoredRepair(db, U, id('a1', 'q1')), null);
});

test('findStoredRepair: a failed read throws, it never reads as "nothing saved"', async () => {
  await assert.rejects(() => findStoredRepair(fakeDb([row('a1', 'q1', 'a'.repeat(16))], { fail: true }), U, id('a1', 'q1')), (e) => e.code === 'repair_lookup_unavailable');
});

test('repairFromReceipt accepts the object PostgREST sends and a JSON string, and nothing else', () => {
  assert.equal(repairFromReceipt({ repair: repairBody }).rule, 'Read.');
  assert.equal(repairFromReceipt(JSON.stringify({ repair: repairBody })).rule, 'Read.');
  for (const bad of [null, undefined, 'nope', {}, { repair: null }, { repair: 'x' }, { repair: [] }, 7]) assert.equal(repairFromReceipt(bad), null);
});

// ---- the paid route: a second request for the same mistake is the saved repair, free ----

const snapshot = { id: 'q1', subject: 'english', chapter: 'Reading', question: 'Why?', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }], correctIndex: 1 };
const attempt = { id: 'a1', userId: U, subject: 'english', questionsSnapshot: [snapshot], details: [{ qid: 'q1', isCorrect: false, givenIndex: 0 }] };
const live = { id: 'q1', status: 'live', verification_state: 'verified', options: snapshot.options.map((o) => ({ ...o })), correct_answer: 'B' };
const config = { route: { provider: 'openai', model: 'gpt-6-luna' }, effort: { repair: 'low', secondOpinion: 'high' }, fallbackRoute: null };
function flow(db, over = {}) {
  const calls = [];
  const deps = {
    now: () => Date.parse('2026-10-17T06:00:00Z'), loadAttempt: async () => attempt, loadQuestion: async () => ({ data: live, error: null }), evidenceEligible: () => false,
    findStored: (u, mid) => findStoredRepair(db, u, mid), findRepairTraps: async () => [], findOpenReservations: async () => [], gateOpen: () => true,
    reserve: async (a) => { calls.push(['reserve', a.operationKey]); return { ok: true, state: 'reserved', balance: 9 }; },
    markExecuting: async () => { calls.push(['executing']); return { ok: true }; }, commit: async () => ({ ok: true }), release: async () => ({ ok: true }),
    generate: async () => { calls.push(['generate']); return { ok: false, data: null, usage: null, failure: { kind: 'timeout' } }; },
    withhold: async () => {}, readWallet: async () => ({ total: 8, state: 'ok' }), log: () => {}, ...over,
  };
  return { calls, run: (requestId) => runRepair({ user: { id: U }, attemptId: 'a1', questionId: 'q1', requestId, startedAt: Date.parse('2026-10-17T06:00:00Z'), deps, config }) };
}

test('a second paid repair request for the same mistake returns the saved one without charging', async () => {
  const db = fakeDb([row('a1', 'q1', 'first_request_0001')]);
  const f = flow(db);
  const a = await f.run('second_request_0002');
  const b = await f.run('third_request_0003');
  for (const r of [a, b]) { assert.equal(r.http, 200); assert.equal(r.body.status, 'stored'); assert.equal(r.body.charged, 0); assert.equal(r.body.repair.rule, 'Read.'); }
  assert.deepEqual(f.calls, [], 'nothing reserved, no model call');
});

test('when the saved-repair lookup fails, nothing is reserved or charged and the student is told to try again', async () => {
  const f = flow(fakeDb([row('a1', 'q1', 'first_request_0001')], { fail: true }));
  const r = await f.run('second_request_0002');
  assert.equal(r.http, 503); assert.equal(r.body.error, 'repair_lookup_unavailable'); assert.equal(r.body.charged, 0);
  assert.match(r.body.message, /Nothing was charged/);
  assert.deepEqual(f.calls, [], 'a failed lookup must never reserve a credit');
});

test('with no saved repair the paid path still runs (the lookup is not a gate on new repairs)', async () => {
  const f = flow(fakeDb([]));
  await f.run('first_request_0001');
  assert.equal(f.calls[0][0], 'reserve');
});

// ---- which wrong answers of a paper are saved ----

const paper = (idv, wrong, extra = []) => ({ id: idv, details: [...wrong.map((q) => ({ qid: q, isCorrect: false, givenIndex: 1 })), { qid: 'ok', isCorrect: true, givenIndex: 0 }, ...extra] });

test('savedRepairsForAttempt: only this student\'s wrong answers of this paper, with the latest acknowledgment', () => {
  const reservations = [
    row('a1', 'q1', 'a'.repeat(16), { updated_at: '2026-10-16T16:22:11.654321+00:00' }),
    row('a1', 'q1', 'b'.repeat(16), { updated_at: '2026-10-17T09:00:00.000000+00:00' }),
    row('a1', 'q3', 'c'.repeat(16)),
    row('a1', 'ok', 'd'.repeat(16)),
    row('a2', 'q2', 'e'.repeat(16)),
    row('a1', 'q2', 'f'.repeat(16), { receipt: { provider: 'openai' } }),
  ];
  const got = savedRepairsForAttempt({ userId: U, attempt: paper('a1', ['q1', 'q2', 'q3']), reservations });
  assert.deepEqual(Object.keys(got).sort(), ['q1', 'q3']);
  assert.equal(got.q1.repairedAt, '2026-10-17T09:00:00.000Z');
  assert.deepEqual(savedRepairsForAttempt({ userId: 'other', attempt: paper('a1', ['q1']), reservations }), {});
  assert.deepEqual(savedRepairsForAttempt({ userId: U, attempt: null, reservations }), {});
});

test('getSavedRepairs reads once, skips a paper with no wrong answers, and throws on a failed read', async () => {
  const db = fakeDb([row('a1', 'q1', 'a'.repeat(16))]);
  assert.deepEqual(Object.keys(await getSavedRepairs(db, U, paper('a1', ['q1', 'q2']))), ['q1']);
  assert.equal(db.log.length, 1);
  assert.deepEqual(db.log[0].eq, [['user_id', U], ['state', 'committed'], ['action', 'score_recovery_repair']]);
  const clean = fakeDb([row('a1', 'q1', 'a'.repeat(16))]);
  assert.deepEqual(await getSavedRepairs(clean, U, paper('a1', [])), {});
  assert.equal(clean.log.length, 0, 'a paper with no wrong answer needs no read');
  await assert.rejects(() => getSavedRepairs(fakeDb([], { fail: true }), U, paper('a1', ['q1'])), (e) => e.code === 'repair_lookup_unavailable');
});

test('repairedCounts and getRepairedCounts: wrong answers with a saved repair, per paper', async () => {
  const attempts = [paper('a1', ['q1', 'q2']), paper('a2', ['q9']), paper('a3', [])];
  const reservations = [row('a1', 'q1', 'a'.repeat(16)), row('a1', 'q2', 'b'.repeat(16)), row('a2', 'q8', 'c'.repeat(16))];
  assert.deepEqual(repairedCounts({ userId: U, attempts, reservations }), { a1: 2 });
  assert.deepEqual(await getRepairedCounts(fakeDb(reservations), U, attempts), { a1: 2 });
  await assert.rejects(() => getRepairedCounts(fakeDb([], { fail: true }), U, attempts));
  assert.deepEqual(await getRepairedCounts(fakeDb([], { fail: true }), U, [paper('a3', [])]), {}, 'nothing wrong, nothing read');
});

// ---- the paper stamp ----

const NOW = Date.parse('2026-10-17T08:30:00Z'); // 2:00 pm IST on 17 Oct
const ist = (s) => Date.parse(`${s}+05:30`);

test('attemptedWhen: relative inside the hour, today and yesterday with the time, then the date, 12-hour clock, India time', () => {
  assert.equal(attemptedWhen(NOW - 20_000, NOW), 'just now');
  assert.equal(attemptedWhen(NOW - 60_000, NOW), '1 minute ago');
  assert.equal(attemptedWhen(NOW - 12 * 60_000, NOW), '12 minutes ago');
  assert.equal(attemptedWhen(ist('2026-10-17T09:40:00'), NOW), 'today, 9:40 am');
  assert.equal(attemptedWhen(ist('2026-10-16T21:40:00'), NOW), 'yesterday, 9:40 pm');
  assert.equal(attemptedWhen(ist('2026-10-12T00:05:00'), NOW), '12 Oct, 12:05 am');
  assert.equal(attemptedWhen(ist('2026-10-12T12:30:00'), NOW), '12 Oct, 12:30 pm');
  assert.equal(attemptedWhen(ist('2025-12-31T23:59:00'), NOW), '31 Dec 2025, 11:59 pm');
  assert.equal(attemptedWhen(ist('2026-09-28T23:30:00'), NOW), '28 Sep, 11:30 pm', 'September is Sep, never Sept');
  assert.equal(attemptedWhen('2026-10-16T16:10:00.000Z', NOW), 'yesterday, 9:40 pm', 'an ISO string reads the same as its milliseconds');
  for (const bad of [null, undefined, '', 0, 'x', NaN]) assert.equal(attemptedWhen(bad, NOW), '');
  assert.equal(clockTime(ist('2026-10-16T21:40:00')), '9:40 pm');
});

test('attemptedWhen: the day boundary is India midnight, not the server\'s', () => {
  const late = Date.parse('2026-10-17T19:00:00Z'); // 12:30 am IST on 18 Oct
  assert.equal(attemptedWhen(ist('2026-10-17T21:50:00'), late), 'yesterday, 9:50 pm');
  assert.equal(attemptedWhen(ist('2026-10-18T00:10:00'), late), '20 minutes ago');
});

test('paperStamp: "Mock 3, Accountancy, 16 Oct, 9:40 pm"; a missing part is left out', () => {
  const at = ist('2026-10-16T21:40:00');
  const now = Date.parse('2026-10-20T08:00:00Z');
  assert.equal(paperStamp({ source: 'Mock 3', subject: 'Accountancy', at, now }), 'Mock 3, Accountancy, 16 Oct, 9:40 pm');
  assert.equal(paperStamp({ source: 'Mock 3', at, now }), 'Mock 3, 16 Oct, 9:40 pm');
  assert.equal(paperStamp({ source: 'Quick practice', subject: 'Accountancy', at: null, now }), 'Quick practice, Accountancy');
  assert.equal(paperStamp({}), '');
});

test('the earlier-miss line carries the source and the attempt time; the older line is unchanged', () => {
  const miss = { attemptId: 'x', source: 'Mock 2', completedAt: ist('2026-10-12T21:40:00') };
  assert.equal(earlierMissAt(miss, Date.parse('2026-10-17T08:30:00Z')), 'You also missed this question in Mock 2, 12 Oct, 9:40 pm.');
  assert.equal(earlierMissAt(null), null);
  assert.equal(RUN_COPY.missedBeforeAt('Mock 2', ''), 'You also missed this question in Mock 2.');
  assert.equal(RUN_COPY.missedBefore('Mock 2', '12 October'), 'You also missed this question in Mock 2 on 12 October.');
});

test('sourceLabels names every paper the way sourceLabel names one', () => {
  const att = (idv, subject, mode, at) => ({ id: idv, subject, completedAt: at, selectionMeta: mode ? { mode } : {} });
  const list = [att('a', 'accountancy', 'full', 10), att('b', 'accountancy', null, 20), att('c', 'accountancy', 'nta', 30), att('d', 'economics', 'full', 15), att('e', 'accountancy', 'full', 40)];
  const labels = sourceLabels(list);
  for (const a of list) assert.equal(labels.get(a.id), sourceLabel(list, a), a.id);
  assert.equal(labels.get('c'), 'Mock 2');
  assert.equal(labels.get('b'), 'Quick practice');
});

test('the saved-repair words: Repaired, a free open and the saved footer; none of it offers a credit', () => {
  assert.equal(repairLabel('stored'), 'Repaired');
  assert.equal(repairLabel('explained'), 'Explanation ready');
  assert.equal(REPAIR_COPY.openSaved, 'Open your saved repair');
  assert.equal(REPAIR_COPY.savedFree('16 Oct, 9:52 pm'), 'Repaired 16 Oct, 9:52 pm. Opening it is free.');
  assert.equal(REPAIR_COPY.savedFoot('yesterday, 9:52 pm'), 'Saved repair from yesterday, 9:52 pm. No credit used.');
  assert.equal(REPAIR_COPY.savedFoot(''), 'Saved repair. No credit used.');
  assert.equal(REPAIR_LOADING.opening(3), 'Opening your saved repair for Q3.');
  for (const t of [REPAIR_COPY.openSaved, REPAIR_COPY.savedFree('x'), REPAIR_COPY.savedFoot('x'), REPAIR_LOADING.opening(3), REPAIR_LOADING.openingSlow]) assert.doesNotMatch(t, /1 AI credit|uses 1|charged only/i);
});
