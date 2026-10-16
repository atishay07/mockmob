import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { answerReview } from '../answer_corrections.mjs';
import { publicationEligibility, sharedEligibilitySnapshot, eligibilitySnapshot } from '../evidence_registry.js';
import { excludeHeldFamilies } from '../evidence_holds.js';
import { familyOf } from '../repair_check.js';
import { planReviseCards } from '../repair_check.js';
import { repairEligibility } from '../mistake_repair.js';
import { isPassageLinkedQuestion } from '../nta_question_selector.js';
import { PRACTICE_QUESTION_COLUMNS } from '../practice_pick.js';
import { QUESTION_READ_SELECT, computeAnswerReviews, currentEvidenceHashes, readFullQuestionRows, readQuestionRows, reviewWithVerdict } from '../question_reads.js';
import { checkSessionAnswer } from '../../src/lib/server/sessionCheck.js';
import { buildBank, fakeDb, legacyRow, managedRows, rng, setFixtureSecret, bytesOf } from './helpers/egress_fixtures.mjs';

// Egress item 3 (16 Oct 2026): result, check, repair and recovery paths read question rows without the signed
// evidence record and read the full row only when the answer key changed. The "before" in each test is the code at
// commit 4db57fc5 (single `select('*')`), copied with the database as a parameter. Software fixtures; they do not
// establish academic reliability.
const restore = setFixtureSecret();
after(restore);
const eligible = (row) => publicationEligibility(row, sharedEligibilitySnapshot()).eligible;

const snapshotOf = (row) => ({
  id: row.id, subject: row.subject, chapter: row.chapter, body: row.body, question: row.question, options: row.options,
  correctIndex: row.correct_index, correctAnswer: row.correct_answer, explanation: row.explanation, passageText: row.passage_text || null,
  familyId: row.family_id, conceptId: row.concept_id, status: row.status, verificationEvidence: row.evidence?.record ?? null,
});

// ---- the world: students saw `seen` rows; the database now holds `now` rows --------------------------------------
function world(seed) {
  const rand = rng(seed);
  const legacy = Array.from({ length: 60 }, (_, n) => legacyRow(rand, n, { subject: 'physics' }))
    .map((r) => ({ ...r, status: 'live', is_deleted: false, verification_state: 'verified', exploration_state: 'active', score: 0 }));
  const managedThen = managedRows(rng(seed + 1), 1000, 21, { key: 0 });
  const managedNow = managedRows(rng(seed + 1), 1000, 21, { key: 2 }); // same ids and options, key moved and re-signed
  const seen = [...legacy, ...managedThen];
  const now = [];
  seen.forEach((row, i) => {
    const current = structuredClone(managedNow.find((m) => m.id === row.id) && i % 3 === 0 ? managedNow.find((m) => m.id === row.id) : row);
    const kind = i % 11;
    if (kind === 1) current.correct_index = (row.correct_index + 1) % 4;        // key changed (unverified for legacy rows)
    if (kind === 2) current.is_deleted = true;                                   // withdrawn
    if (kind === 3) current.verification_state = 'disputed';                     // under review
    if (kind === 4) current.body = `${row.body} (edited)`;                       // content changed
    if (kind === 5) { current.options = [...row.options].reverse(); current.correct_index = 3 - row.correct_index; } // same content, reordered
    if (kind === 6) current.status = 'pending';
    if (kind === 7) return;                                                    // row gone
    now.push(current);
  });
  return { seen, now };
}

// The code of src/services/recovery/answerReviews.js at 4db57fc5.
async function readAnswerReviewsBefore(attempt, db) {
  const snapshots = attempt.questionsSnapshot || [];
  if (!snapshots.length) return { answerReviews: {}, answerReviewState: 'ready' };
  const { data, error } = await db.from('questions').select('*').in('id', snapshots.map(q => q.id));
  if (error) return { answerReviews: {}, answerReviewState: 'unavailable' };
  const current = new Map((data || []).map(q => [q.id, q]));
  const details = new Map((attempt.details || []).map(d => [d.qid, d]));
  const answerReviews = {};
  const evidenceInputs = sharedEligibilitySnapshot();
  for (const q of snapshots) {
    const row = current.get(q.id);
    const review = answerReview(q, row, details.get(q.id), { evidenceEligible: !!row && publicationEligibility(row, evidenceInputs).eligible });
    if (review) answerReviews[q.id] = review;
  }
  return { answerReviews, answerReviewState: 'ready' };
}
const readAnswerReviewsAfter = (attempt, db) => computeAnswerReviews({
  attempt, readRows: (ids) => readQuestionRows(db, ids), readFullRows: (ids) => readFullQuestionRows(db, ids), eligible,
});

test('the shared column list is every column but the two records, plus three json-path stubs', () => {
  assert.equal(QUESTION_READ_SELECT.startsWith(PRACTICE_QUESTION_COLUMNS.join(',')), true);
  assert.ok(!/(^|,)evidence(,|$)/.test(QUESTION_READ_SELECT) && !/(^|,)provenance(,|$)/.test(QUESTION_READ_SELECT));
  assert.ok(QUESTION_READ_SELECT.endsWith('ev_policy:evidence->record->>policy_version,ev_family:evidence->record->>family_id,prov_kind:provenance->>kind'));
});

test('result page: answer reviews are identical before and after, with the full row read only for changed keys', async () => {
  const states = new Set();
  let fullReads = 0, lightOnly = 0;
  for (const seed of [3, 4, 5, 6]) {
    const { seen, now } = world(seed);
    const snapshots = seen.map(snapshotOf);
    const details = snapshots.map((q, i) => ({ qid: q.id, givenIndex: i % 4, isCorrect: i % 4 === q.correctIndex }));
    const attempt = { questionsSnapshot: snapshots, details };
    const before = await readAnswerReviewsBefore(attempt, fakeDb({ questions: now }, { strict: false }));
    const db = fakeDb({ questions: now }); // strict: reading an unselected column (evidence, provenance) throws
    const after = await readAnswerReviewsAfter(attempt, db);
    assert.deepEqual(after, before, `seed ${seed}`);
    assert.deepEqual(Object.keys(after.answerReviews), Object.keys(before.answerReviews), 'same key order');
    for (const review of Object.values(after.answerReviews)) states.add(review.state);
    const full = db.calls.filter((c) => c.select === '*');
    fullReads += full.length; lightOnly += db.calls.length - full.length;
    const changed = Object.values(after.answerReviews).filter((r) => ['corrected', 'key_changed_unverified'].includes(r.state)).length;
    assert.ok(full.length === 0 || full[0].rows <= changed + 1, 'the full read covers only the changed keys');
  }
  // every state the page can show was exercised, including both verdicts of a changed key
  for (const state of ['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']) assert.ok(states.has(state), state);
  assert.ok(fullReads >= 1 && lightOnly >= 4);
});

test('result page: an attempt with no changed key never reads a signed record', async () => {
  const { seen } = world(11);
  const snapshots = seen.map(snapshotOf);
  const attempt = { questionsSnapshot: snapshots, details: [] };
  const db = fakeDb({ questions: seen });
  const after = await readAnswerReviewsAfter(attempt, db);
  assert.deepEqual(after, await readAnswerReviewsBefore(attempt, fakeDb({ questions: seen }, { strict: false })));
  assert.equal(db.calls.filter((c) => c.select === '*').length, 0);
});

test('result page: a failed read gives the same unavailable state', async () => {
  const broken = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'down' } }) }) }) };
  const attempt = { questionsSnapshot: [{ id: 'a' }], details: [] };
  assert.deepEqual(await computeAnswerReviews({ attempt, readRows: (ids) => readQuestionRows(broken, ids), readFullRows: async () => ({}), eligible }), { answerReviews: {}, answerReviewState: 'unavailable' });
  assert.deepEqual(await computeAnswerReviews({ attempt: { questionsSnapshot: [] }, readRows: async () => { throw new Error('not read'); }, readFullRows: async () => ({}), eligible }), { answerReviews: {}, answerReviewState: 'ready' });
});

// ---- one question: the session check and the repair paths ----------------------------------------------------------
test('reviewWithVerdict equals the old single full read for every kind of change (sync and async verdicts)', async () => {
  let compared = 0;
  for (const seed of [21, 22, 23]) {
    const { seen, now } = world(seed);
    for (const row of seen) {
      const snapshot = snapshotOf(row);
      const full = now.find((r) => r.id === row.id) ?? null;
      const lightRow = full ? (await fakeDb({ questions: [full] }).from('questions').select(QUESTION_READ_SELECT).eq('id', row.id).maybeSingle()).data : null;
      const before = answerReview(snapshot, full, null, { evidenceEligible: !!full && eligible(full) });
      for (const verdict of [(r) => eligible(r), async (r) => eligible(r)]) {
        const { review } = await reviewWithVerdict({ snapshot, current: lightRow, detail: null, eligible: verdict, loadFull: async () => full });
        assert.deepEqual(review, before, row.id);
        compared += 1;
      }
    }
  }
  assert.ok(compared > 200);
});

test('reviewWithVerdict never calls for the verdict unless the key changed', async () => {
  let calls = 0;
  const row = legacyRow(rng(5), 1, { subject: 'physics' });
  Object.assign(row, { status: 'live', is_deleted: false, verification_state: 'verified' });
  const snapshot = snapshotOf(row);
  const unchanged = await reviewWithVerdict({ snapshot, current: row, detail: null, eligible: () => { calls += 1; return true; }, loadFull: async () => { calls += 1; return row; } });
  assert.equal(unchanged.review, null);
  assert.equal(calls, 0);
  const moved = { ...row, correct_index: (row.correct_index + 1) % 4 };
  const changed = await reviewWithVerdict({ snapshot, current: moved, detail: null, eligible: () => { calls += 1; return true; }, loadFull: async () => { calls += 1; return moved; } });
  assert.equal(changed.review.state, 'corrected');
  assert.equal(calls, 2);
});

// A small session store around the real checkSessionAnswer, with strict question rows.
function sessionDb(questions) {
  const qdb = fakeDb({ questions });
  const log = [];
  return {
    log, qdb,
    from(name) {
      if (name === 'questions') return qdb.from(name);
      const rows = name === 'recovery_sessions' ? [SESSION] : log;
      const filters = [];
      const q = {
        select() { return q; }, eq(k, v) { filters.push([k, v]); return q; },
        async maybeSingle() { return { data: rows.find((r) => filters.every(([k, v]) => r[k] === v)) || null, error: null }; },
        async upsert(row) { if (!log.some((r) => r.session_id === row.session_id && r.qid === row.qid)) log.push({ ...row }); return { error: null }; },
      };
      return q;
    },
  };
}
const NOW = Date.parse('2026-10-16T10:00:00Z');
let SESSION;
const checkWith = async (rowSeen, rowNow, answer, deps = {}) => {
  const snapshot = snapshotOf(rowSeen);
  SESSION = { id: 's1', user_id: 'u1', mode: 'quick', state: 'active', questions: [snapshot], selection_meta: {}, expires_at: new Date(NOW + 600000).toISOString() };
  const db = sessionDb(rowNow ? [rowNow] : []);
  const result = await checkSessionAnswer({ db, userId: 'u1', sessionId: 's1', qid: rowSeen.id, answer, now: NOW, ...deps }).then((r) => ({ ok: r }), (e) => ({ err: [e.status, e.code] }));
  return { result, db };
};

test('session check: same outcome as the full read for every kind of change, and no signed record read when the key is unchanged', async () => {
  const { seen, now } = world(31);
  let fullReadsForUnchanged = 0, compared = 0;
  for (const row of seen) {
    const rowNow = now.find((r) => r.id === row.id) ?? null;
    // before: the old code read the full row and asked the verdict first
    const snapshot = snapshotOf(row);
    const evidenceEligible = rowNow ? !!eligible(rowNow) : false;
    const review = answerReview(snapshot, rowNow, null, { evidenceEligible });
    const expected = review === null ? { ok: { correct: true, keyIndex: row.correct_index, explanation: row.explanation || null } }
      : review.state === 'corrected' ? { ok: { correct: review.currentIndex === row.correct_index, keyIndex: review.currentIndex, explanation: review.explanation || null } } : { err: [409, 'question_under_review'] };
    const { result, db } = await checkWith(row, rowNow, row.correct_index, { eligible });
    assert.deepEqual(result, expected, row.id);
    compared += 1;
    if (review === null) fullReadsForUnchanged += db.qdb.calls.filter((c) => c.select === '*').length;
  }
  assert.ok(compared >= 80);
  assert.equal(fullReadsForUnchanged, 0);
});

test('repair and check logic over a strict light row equals the full row (family, passage, key, revise card)', async () => {
  const { seen, now } = world(42);
  for (const full of now) {
    const light = (await fakeDb({ questions: [full] }).from('questions').select(QUESTION_READ_SELECT).eq('id', full.id).maybeSingle()).data;
    // familyOf reads the record first and `ev_family` second, so it is the one reader allowed to see `evidence` missing.
    const lenient = (await fakeDb({ questions: [full] }, { strict: false }).from('questions').select(QUESTION_READ_SELECT).eq('id', full.id).maybeSingle()).data;
    assert.equal(familyOf(lenient), familyOf(full), 'family from ev_family equals the record family');
    assert.equal(isPassageLinkedQuestion(light), isPassageLinkedQuestion(full));
    const seenRow = seen.find((r) => r.id === full.id);
    const attempt = { userId: 'u1', questionsSnapshot: [snapshotOf(seenRow)], details: [{ qid: full.id, isCorrect: false, givenIndex: (seenRow.correct_index + 1) % 4 }] };
    assert.deepEqual(repairEligibility({ attempt, questionId: full.id, userId: 'u1', current: light }), repairEligibility({ attempt, questionId: full.id, userId: 'u1', current: full }));
    assert.deepEqual(planReviseCards({ mistake: light, checkRow: light, right: false, nowMs: NOW }), planReviseCards({ mistake: full, checkRow: full, right: false, nowMs: NOW }));
  }
});

// ---- the delayed-check freshness read (GET /api/recovery) ---------------------------------------------------------
// The code of src/app/api/recovery/route.js at 4db57fc5.
async function hashesBefore(db, questionIds) {
  const currentQuestions = new Map(); let evidenceUnavailable = false;
  for (let i = 0; i < questionIds.length; i += 300) {
    const { data, error } = await db.from('questions').select('*').in('id', questionIds.slice(i, i + 300));
    if (error) { evidenceUnavailable = true; break; }
    let unheld; try { unheld = await excludeHeldFamilies(data || [], db); } catch { evidenceUnavailable = true; break; }
    const snapshot = unheld.length ? eligibilitySnapshot() : undefined;
    for (const q of unheld) if (publicationEligibility(q, snapshot).eligible) currentQuestions.set(q.id, q.evidence.record.content_hash);
  }
  return { currentQuestions, evidenceUnavailable };
}

test('recovery: the per-question freshness flags are identical, reading only questions that kept a content hash', async () => {
  const { seen, now } = world(51);
  const holds = now.filter((r) => r.family_id).filter((_, i) => i % 9 === 0).map((r) => ({ family_id: r.family_id }));
  const snaps = seen.map(snapshotOf);
  // legacy (non-managed) snapshots carry no stored hash, as in production
  const flags = (q, map, unavailable) => !unavailable && map.get(q.id) && map.get(q.id) === q.verificationEvidence?.content_hash;
  const allIds = [...new Set(snaps.map((q) => q.id))];
  const before = await hashesBefore(fakeDb({ questions: now, recovery_family_holds: holds }, { strict: false }), allIds);
  const wantedIds = [...new Set(snaps.filter((q) => q.verificationEvidence?.content_hash).map((q) => q.id))];
  const db = fakeDb({ questions: now, recovery_family_holds: holds });
  const after = await currentEvidenceHashes(db, wantedIds);
  assert.equal(after.unavailable, before.evidenceUnavailable);
  for (const q of snaps) assert.equal(Boolean(flags(q, after.hashes, after.unavailable)), Boolean(flags(q, before.currentQuestions, before.evidenceUnavailable)), q.id);
  assert.ok(snaps.some((q) => flags(q, before.currentQuestions, false)), 'some check is still fresh');
  assert.ok(wantedIds.length < allIds.length, 'questions without a stored hash are not read');
  const questionCalls = db.calls.filter((c) => c.table === 'questions');
  assert.equal(questionCalls.reduce((n, c) => n + c.rows, 0), wantedIds.length === 0 ? 0 : now.filter((r) => wantedIds.includes(r.id)).length);
});

test('recovery: a failed read pauses the claims, as before', async () => {
  const broken = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'down' } }) }) }) };
  assert.equal((await currentEvidenceHashes(broken, ['a'])).unavailable, true);
  assert.equal((await currentEvidenceHashes(broken, [])).unavailable, false);
});

test('bytes: a result page of managed questions reads the signed records only for changed keys', async () => {
  const { seen, now } = world(61);
  const attempt = { questionsSnapshot: seen.map(snapshotOf), details: [] };
  const before = fakeDb({ questions: now }, { strict: false });
  await readAnswerReviewsBefore(attempt, before);
  const after = fakeDb({ questions: now });
  await readAnswerReviewsAfter(attempt, after);
  const sum = (db) => db.calls.reduce((n, c) => n + c.bytes, 0);
  assert.ok(sum(after) < sum(before) * 0.5, `${sum(after)} vs ${sum(before)}`);
  assert.ok(bytesOf(now) > 0);
});
