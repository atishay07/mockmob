import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openCheck, answerCheck, checkStatus } from '../../src/services/recovery/repairCheck.js';
import { createCheckStore } from '../../src/services/recovery/repairCheckStore.js';
import { mistakeId } from '../../src/services/recovery/repairFlow.js';
import { optionTextHashes, orderFromHashes } from '../repair_check.js';
import { fakeDb } from './fake_check_db.mjs';

// The repair check over the REAL store and a fake database (data/tests/fake_check_db.mjs): the offer, the seen rows, the
// receipts and the reads are all the production code, so what one repair does to the next one is observed, not assumed.
const fx = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/repair4/pool_goodwill.json', import.meta.url)), 'utf8'));
const user = { id: 'u1' };
const NOW = Date.parse('2026-10-16T20:00:00Z');
const RULE = 'Super profit is average profit minus normal profit.';
const REQ = 'req_0123456789abcdef';

const mistake2 = {
  ...fx.mistake, id: 'q_mistake2', family_id: 'fam_mistake2', concept_id: 'gw_other', concept: 'Goodwill on admission', topic: 'Goodwill',
  question: 'Which account is credited when a new partner brings in his share of goodwill in cash on admission to the firm?',
  options: [{ key: 'A', text: 'Old partners capital accounts' }, { key: 'B', text: 'Realisation account' }, { key: 'C', text: 'Bank loan account' }, { key: 'D', text: 'Debtors control account' }],
  correct_answer: 'A', explanation: 'The old partners are compensated.',
};
const snapshotOf = (q) => ({ id: q.id, subject: q.subject, chapter: q.chapter, question: q.question, options: q.options.map((o) => ({ ...o })), correctIndex: 0, familyId: q.family_id });
const attemptOf = (id, q) => ({ id, userId: 'u1', subject: 'accountancy', completedAt: Date.parse('2026-10-14T10:00:00Z'), questionsSnapshot: [snapshotOf(q)], details: [{ qid: q.id, isCorrect: false, givenIndex: 1 }] });
const attempts = { a1: attemptOf('a1', fx.mistake), a2: attemptOf('a2', mistake2) };
const ID1 = mistakeId('u1', 'a1', 'q_mistake');
const ID2 = mistakeId('u1', 'a2', 'q_mistake2');

function world(over = {}) {
  const questions = [fx.mistake, mistake2, ...fx.candidates].map((q) => ({ is_deleted: false, score: 0, ...JSON.parse(JSON.stringify(q)) }));
  const tables = {
    questions,
    ai_credit_reservations: [
      { user_id: 'u1', state: 'committed', action: 'score_recovery_repair', operation_key: `repair:${ID1}:${REQ}`, receipt: { repair: { rule: RULE } } },
      { user_id: 'u1', state: 'committed', action: 'score_recovery_repair', operation_key: `repair:${ID2}:${REQ}`, receipt: { repair: { rule: RULE } } },
    ],
    user_question_progress: [{ user_id: 'u1', question_id: 'q_seen' }],
    question_interactions: [],
    attempts: [],
    ...(over.tables || {}),
  };
  const db = fakeDb(tables, over.db);
  const progress = [];
  const store = createCheckStore({
    db,
    recordProgress: async (args) => { if (over.progressFails) throw new Error('db'); progress.push(args); },
    readable: async (rows) => rows.filter((r) => r.status === 'live' && r.verification_state !== 'disputed'),
  });
  const deps = {
    ...store,
    now: () => NOW,
    loadAttempt: async (id) => attempts[id] ?? null,
    loadQuestion: async (id) => ({ data: questions.find((q) => q.id === id) ?? null, error: null }),
  };
  const receipt = (id) => tables.ai_credit_reservations.find((r) => r.operation_key.startsWith(`repair:${id}:`)).receipt;
  const open = (attemptId, questionId) => openCheck({ user, attemptId, questionId, deps });
  const answer = (attemptId, questionId, checkQuestionId, pick, requestId = REQ) => answerCheck({ user, attemptId, questionId, checkQuestionId, pick, requestId, deps });
  return { tables, db, store, deps, progress, receipt, open, answer, row: (id) => questions.find((q) => q.id === id) };
}
const seenRows = (w, questionId) => w.tables.question_interactions.filter((r) => r.question_id === questionId && r.interaction_type === 'seen');
const writes = (w) => ({ interactions: w.tables.question_interactions.length, receipts: JSON.stringify(w.tables.ai_credit_reservations), progress: w.progress.length });

// ---- (a) only the offered question is accepted -------------------------------------------------------------------------------
test('(a) POST accepts only the question that was offered for that repair; any other id is invalid_pick and writes nothing', async () => {
  const w = world();
  // Before any GET nothing was offered, so nothing can be answered (not even a real bank question).
  const early = await w.answer('a1', 'q_mistake', 'q_concept', 0);
  assert.equal(early.http, 422);
  assert.equal(early.body.error, 'invalid_pick');
  const ready = await w.open('a1', 'q_mistake');
  const offered = ready.body.check.checkQuestionId;
  const before = writes(w);
  for (const other of ['q_topic', 'q_chapter', 'q_seen', 'q_mistake', 'q_invented', 'q_held']) {
    if (other === offered) continue;
    const r = await w.answer('a1', 'q_mistake', other, 0);
    assert.equal(r.http, 422, other);
    assert.equal(r.body.error, 'invalid_pick', other);
    assert.equal(r.body.charged, 0);
  }
  assert.deepEqual(writes(w), before, 'nothing was written by any refused id');
  assert.equal(w.receipt(ID1).check, undefined);
  // The offered one is accepted, and once answered only that id is replayed.
  const right = await w.answer('a1', 'q_mistake', offered, 0);
  assert.equal(right.http, 200);
  assert.equal(right.body.status, 'answered');
  const again = await w.answer('a1', 'q_mistake', offered, 3);
  assert.equal(again.body.replayed, true);
  const afterAnswer = await w.answer('a1', 'q_mistake', 'q_topic', 0);
  assert.equal(afterAnswer.http, 422);
  // The other repair's offer is its own: repair 1's question is not accepted for repair 2.
  const other = await w.open('a2', 'q_mistake2');
  const wrongRepair = await w.answer('a2', 'q_mistake2', offered, 0);
  assert.equal(wrongRepair.http, other.body.check.checkQuestionId === offered ? 200 : 422);
});

test('(a) the offer is stored once on the receipt: a reload shows the same question and writes no second record', async () => {
  const w = world();
  const first = await w.open('a1', 'q_mistake');
  const receiptAfterFirst = JSON.stringify(w.receipt(ID1));
  const again = await w.open('a1', 'q_mistake');
  assert.deepEqual(again.body, first.body);
  assert.equal(JSON.stringify(w.receipt(ID1)), receiptAfterFirst);
  const offer = w.receipt(ID1).offered;
  assert.equal(offer.checkQuestionId, first.body.check.checkQuestionId);
  assert.equal(offer.recorded, true);
  assert.deepEqual(offer.optionHashes, optionTextHashes(w.row(offer.checkQuestionId)));
  assert.equal(seenRows(w, offer.checkQuestionId).length, 1, 'one seen row, not one per reload');
  assert.deepEqual(w.receipt(ID1).repair, { rule: RULE }, 'the repair on the receipt is untouched');
});

test('(a) two GETs racing to offer end with one offer, and both show it', async () => {
  const w = world();
  const [a, b] = await Promise.all([w.open('a1', 'q_mistake'), w.open('a1', 'q_mistake')]);
  assert.equal(a.body.status, 'ready');
  assert.equal(a.body.check.checkQuestionId, b.body.check.checkQuestionId);
  assert.equal(w.receipt(ID1).offered.checkQuestionId, a.body.check.checkQuestionId);
  assert.ok(w.tables.question_interactions.every((r) => r.question_id === a.body.check.checkQuestionId), 'only the winning question was recorded as seen');
});

test('(a) an answer is never overwritten by a late offer, and a stale offer is replaced by a fresh question', async () => {
  const w = world();
  const first = await w.open('a1', 'q_mistake');
  const x = first.body.check.checkQuestionId;
  // The offered question is withdrawn (held): the next GET offers another one in its place, and the old one stays seen.
  w.row(x).status = 'pending';
  const second = await w.open('a1', 'q_mistake');
  assert.equal(second.body.status, 'ready');
  assert.notEqual(second.body.check.checkQuestionId, x);
  assert.equal(w.receipt(ID1).offered.checkQuestionId, second.body.check.checkQuestionId);
  assert.equal(seenRows(w, second.body.check.checkQuestionId).length, 1);
  // An answered repair keeps its answer: claimOffer reports "answered" and writes nothing.
  const done = await w.answer('a1', 'q_mistake', second.body.check.checkQuestionId, 0);
  assert.equal(done.body.status, 'answered');
  const late = await w.store.claimOffer({ operationKey: `repair:${ID1}:${REQ}`, userId: 'u1', offer: { checkQuestionId: 'late', optionHashes: [] }, replaces: null });
  assert.deepEqual(late, { ok: false, existing: null });
  assert.equal(w.receipt(ID1).offered.checkQuestionId, second.body.check.checkQuestionId);
});

// ---- (b) an offered question counts as seen -----------------------------------------------------------------------------------
test('(b) an offered but unanswered question is seen: not offered again by another repair, and fresh-content readers see it', async () => {
  const w = world();
  const one = await w.open('a1', 'q_mistake');
  const x = one.body.check.checkQuestionId;
  assert.equal(seenRows(w, x).length, 1, 'the seen row is written before the question is shown');
  assert.deepEqual(w.tables.question_interactions[0], { question_id: x, user_id: 'u1', interaction_type: 'seen', flow_context: 'review', session_id: ID1, metadata: { source: 'repair_check_offer' } });
  // Never answered. A second mistake in the same chapter, and then every other reader of "never seen".
  const two = await w.open('a2', 'q_mistake2');
  assert.equal(two.body.status, 'ready');
  assert.notEqual(two.body.check.checkQuestionId, x, 'a student cannot preview a question through one repair and be given it by another');
  const candidates = fx.candidates;
  const seen = await w.store.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: candidates.map((c) => c.id), attempt: attempts.a1, candidates });
  assert.equal(seen.has(x), true);
  assert.equal(seen.has(two.body.check.checkQuestionId), true);
  // The pool shrinks by what was previewed, and the status read (no writes) agrees.
  const status = await checkStatus({ user, attemptId: 'a1', questionId: 'q_mistake', deps: w.deps });
  assert.equal(status.status, 'ready');
});

// ---- (c) a failed progress write -----------------------------------------------------------------------------------------------
test('(c) a failed progress write does not put the answered question back in the fresh pool', async () => {
  const w = world({ progressFails: true });
  const one = await w.open('a1', 'q_mistake');
  const x = one.body.check.checkQuestionId;
  const done = await w.answer('a1', 'q_mistake', x, 0);
  assert.equal(done.http, 200);
  assert.equal(w.receipt(ID1).check.progressRecorded, false, 'the progress write failed');
  assert.equal(w.progress.length, 0);
  const two = await w.open('a2', 'q_mistake2');
  assert.notEqual(two.body.check.checkQuestionId, x, 'it is not offered again as fresh');
  const seen = await w.store.loadSeen({ userId: 'u1', subject: 'accountancy', candidateIds: fx.candidates.map((c) => c.id), attempt: attempts.a2, candidates: fx.candidates });
  assert.equal(seen.has(x), true);
});

test('(c) when the seen row cannot be written the question is not shown at all (and the next open retries it)', async () => {
  const w = world({ db: { errors: { question_interactions: { ops: ['insert'], error: { code: 'XX000', message: 'boom' } } } } });
  const failed = await w.open('a1', 'q_mistake');
  assert.equal(failed.http, 503);
  assert.equal(failed.body.reason, 'check_unavailable');
  assert.equal(JSON.stringify(failed.body).includes('"question"'), false, 'no question text leaves the server');
  // The offer is on the receipt but not recorded as seen; a POST for it is not accepted as an answer to something unseen? It is
  // the offered id, but the student never received it: marking is still safe (the key is not sent before an answer).
  assert.equal(w.receipt(ID1).offered.recorded, false);
  assert.equal(w.tables.question_interactions.length, 0);
});

// ---- (d) the pick is matched by option text hash -------------------------------------------------------------------------------
const reorder = (row, order) => {
  const options = order.map((i) => row.options[i]);
  const keyText = row.options.find((o) => o.key === row.correct_answer).text;
  // Re-keyed: letters follow the new positions, and the key letter follows the key text.
  const rekeyed = options.map((o, i) => ({ ...o, key: 'ABCD'[i] }));
  return { options: rekeyed, correct_answer: rekeyed.find((o) => o.text === keyText).key };
};

test('(d) the pick maps by option text: a row re-ordered and re-keyed after the offer still marks the option the student chose', async () => {
  const w = world();
  const ready = await w.open('a1', 'q_mistake');
  const x = ready.body.check.checkQuestionId;
  const shown = ready.body.check.options;
  const keyText = 'Super profit and the normal rate of return';
  const picked = shown.find((o) => o.text === 'Sales and the purchase returns');
  const keyShown = shown.find((o) => o.text === keyText);
  Object.assign(w.row(x), reorder(w.row(x), [3, 2, 1, 0]));
  assert.equal(w.row(x).correct_answer, 'D', 'the key moved from the first place to the last, and was re-lettered');
  // The student's display position still means what was on screen.
  const wrong = await w.answer('a1', 'q_mistake', x, picked.index);
  assert.equal(wrong.http, 200);
  assert.equal(wrong.body.result.picked.text, 'Sales and the purchase returns');
  assert.equal(wrong.body.result.right, false);
  assert.equal(wrong.body.result.key.text, keyText);
  assert.deepEqual(wrong.body.result.options.map((o) => o.text), shown.map((o) => o.text), 'the answered options keep the order the student saw');
  assert.equal(w.progress[0].details[0].givenIndex, 1, 'progress is written in the stored order of the row as it stands now (Sales was moved to place 1)');
  // The same on a second world with the key option picked: right, by text.
  const w2 = world();
  const r2 = await w2.open('a1', 'q_mistake');
  Object.assign(w2.row(x), reorder(w2.row(x), [1, 3, 0, 2]));
  const right = await w2.answer('a1', 'q_mistake', x, r2.body.check.options.find((o) => o.text === keyText).index);
  assert.equal(right.body.result.right, true);
  assert.equal(right.body.result.picked.text, keyText);
  assert.equal(keyShown.text, keyText);
});

test('(d) a reload after the row was re-ordered still shows the options in the order first offered', async () => {
  const w = world();
  const first = await w.open('a1', 'q_mistake');
  const x = first.body.check.checkQuestionId;
  Object.assign(w.row(x), reorder(w.row(x), [2, 0, 3, 1]));
  const again = await w.open('a1', 'q_mistake');
  assert.deepEqual(again.body.check.options, first.body.check.options);
});

test('(d) an option whose text was edited, or duplicate option texts, cannot be mapped: the question is withdrawn, never mis-marked', async () => {
  const w = world();
  const ready = await w.open('a1', 'q_mistake');
  const x = ready.body.check.checkQuestionId;
  w.row(x).options = w.row(x).options.map((o, i) => (i === 2 ? { ...o, text: 'A different third option' } : o));
  const r = await w.answer('a1', 'q_mistake', x, 0);
  assert.equal(r.http, 409);
  assert.equal(r.body.error, 'check_changed');
  assert.equal(w.progress.length, 0);
  assert.equal(w.receipt(ID1).check, undefined);
  // Pure helpers.
  const row = fx.candidates[0];
  assert.deepEqual(orderFromHashes(row, optionTextHashes(row)), [0, 1, 2, 3]);
  assert.equal(orderFromHashes({ options: [{ text: 'same' }, { text: 'Same ' }, { text: 'c' }, { text: 'd' }] }, ['a', 'b', 'c', 'd']), null);
  assert.equal(orderFromHashes(row, optionTextHashes(row).slice(0, 3)), null);
  // Letters the bank prefixes, whitespace and case do not change a hash.
  const lettered = { options: ['A  Super profit and the normal rate of return', 'B  Drawings and the closing capital', 'C  Sales and the purchase returns', 'D  Reserves and the revaluation loss'] };
  assert.deepEqual(optionTextHashes(lettered), optionTextHashes(row));
});

// ---- (e) the seen lookup is bounded ----------------------------------------------------------------------------------------------
function heavyUser() {
  const chapter = 'Partnership Accounts';
  const candidates = Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, subject: 'accountancy', chapter, family_id: `f${i % 150}` }));
  // A saved question and a question shown in a learning episode that belong to this chapter.
  candidates.push({ id: 'b3', subject: 'accountancy', chapter, family_id: 'fb3' }, { id: 'l7', subject: 'accountancy', chapter, family_id: 'fl7' });
  const interactions = [];
  // 60 candidates were viewed 40 times each (append-only): 2,400 rows for the chapter, plus noise on other questions. Three more
  // (c250 to c252) are known only from their interactions, 40 views each (their progress write was skipped).
  for (let q = 0; q < 63; q += 1) for (let v = 0; v < 40; v += 1) interactions.push({ id: interactions.length, user_id: 'heavy', question_id: `c${q < 60 ? q : 250 + q - 60}`, interaction_type: 'seen' });
  for (let i = 0; i < 3000; i += 1) interactions.push({ id: interactions.length, user_id: 'heavy', question_id: `elsewhere${i % 500}`, interaction_type: 'seen' });
  const bigQuestion = (n, id) => ({ id: `${id}_${n}`, question: 'x'.repeat(600), options: Array.from({ length: 4 }, (_, k) => ({ key: 'ABCD'[k], text: 'y'.repeat(80) })), familyId: `fx${n}` });
  const attemptRows = Array.from({ length: 100 }, (_, a) => ({
    user_id: 'heavy', subject: 'accountancy', completed_at: 1_000_000 - a,
    details: Array.from({ length: 60 }, (__, n) => ({ qid: `old${a}_${n}`, isCorrect: n % 2 === 0, givenIndex: 0 })),
    questions_snapshot: Array.from({ length: 60 }, (__, n) => bigQuestion(n, `old${a}`)),
  }));
  return {
    candidates,
    tables: {
      user_question_progress: Array.from({ length: 460 }, (_, i) => ({ user_id: 'heavy', question_id: i < 50 ? `c${200 + i}` : i < 110 ? `c${i - 50}` : `p${i}` })),
      question_interactions: interactions,
      question_bookmarks: Array.from({ length: 50 }, (_, i) => ({ user_id: 'heavy', question_id: `b${i}` })),
      learning_question_exposure: Array.from({ length: 200 }, (_, i) => ({ user_id: 'heavy', question_id: `l${i}` })),
      // 6,000 rows; the one that matters to this chapter is the very last (a family of c120 and c270, in no other record).
      learning_family_exposure: Array.from({ length: 6000 }, (_, i) => ({ user_id: 'heavy', family_id: i < 5999 ? `other_family_${i}` : 'f120' })),
      attempts: attemptRows,
      recovery_sessions: Array.from({ length: 40 }, (_, s) => ({ user_id: 'heavy', subject: 'accountancy', created_at: 1000 - s, questions: Array.from({ length: 15 }, (__, n) => ({ id: `s${s}_${n}` })) })),
    },
  };
}

test('(e) the seen lookup of a heavy user: bounded reads, no snapshot flood, a complete answer', async () => {
  const { candidates, tables } = heavyUser();
  const db = fakeDb(tables);
  const store = createCheckStore({ db, recordProgress: async () => {} });
  const seen = await store.loadSeen({ userId: 'heavy', subject: 'accountancy', candidateIds: candidates.map((c) => c.id), attempt: { subject: 'accountancy', questionsSnapshot: [] }, candidates });
  // Complete: every source contributes, and a question viewed 40 times is found.
  for (const id of ['c0', 'c59', 'c200', 'c249', 'c250', 'c252', 'b3', 'l7', 'old0_5', 'old99_59', 's0_0', 's39_14']) assert.equal(seen.has(id), true, id);
  // The last of 6,000 family exposure rows is read (the old read stopped at 5,000 rows): its members are seen.
  assert.equal(seen.has('c120') && seen.has('c270'), true, 'family f120, met through the last exposure row');
  for (const id of ['c121', 'c271', 'c299']) assert.equal(seen.has(id), false, `${id} is in no record`);
  const reads = db.log.filter((l) => l.op === 'select');
  const rowsOf = (table) => reads.filter((l) => l.table === table).reduce((n, l) => n + (l.returned ?? 0), 0);
  const bytes = reads.reduce((n, l) => n + (l.bytes ?? 0), 0);
  const snapshotsRead = reads.filter((l) => l.table === 'attempts' && l.cols === 'questions_snapshot').reduce((n, l) => n + l.returned, 0);
  assert.equal(snapshotsRead, 5, 'full attempt snapshots are read for the newest 5 attempts only (was 100)');
  assert.ok(rowsOf('question_interactions') <= 130, `interactions: ${rowsOf('question_interactions')} rows read of 5,520 (only the questions nothing else showed to be seen)`);
  assert.ok(reads.filter((l) => l.table === 'question_interactions').every((l) => l.limit === 500));
  assert.ok(rowsOf('learning_family_exposure') <= 150, `family exposure is read for the chapter's families only: ${rowsOf('learning_family_exposure')} rows`);
  assert.ok(reads.length <= 30, `${reads.length} reads`);
  assert.ok(bytes < 700_000, `${bytes} bytes read`);
});
