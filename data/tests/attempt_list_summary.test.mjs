import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSummaryView, readAttemptListSummary, resetSummaryRpcState, slimQuestion, summaryAttempt, SUMMARY_RPC } from '../../src/lib/server/attemptListSummary.js';
import { formatIdFor } from '../../src/lib/server/attemptSummary.js';
import { rng } from './helpers/egress_fixtures.mjs';

// GET /api/attempts?view=summary (R10, 18 Oct 2026). Software fixtures shaped like the staging account that timed out:
// 25 attempts, 50-question papers, each snapshot question carrying about 22 KB of verification evidence (about 1.2 MB an attempt).
// What the app reads is the Flutter list parser (attempt.dart fromJson + SnapshotQuestion.fromJson + SelectionMeta.fromJson).

const SNAPSHOT_KEYS = ['aiScore', 'aiTier', 'anchorTier', 'authorId', 'body', 'chapter', 'concept', 'conceptId', 'correctAnswer', 'correctIndex', 'createdAt', 'difficulty', 'difficultyWeight', 'downvotes', 'explanation', 'familyId', 'id', 'internalSubject', 'options', 'orderIndex', 'passageGroupId', 'passageId', 'passageText', 'passageTitle', 'passageType', 'pyqAnchorId', 'qualityBand', 'qualityScore', 'question', 'questionType', 'score', 'source', 'sourceKind', 'status', 'subject', 'topic', 'uploadedBy', 'upvotes', 'userVote', 'verificationEvidence', 'verificationState'];

function row(seed, i, { questions = 50, evidenceChars = 22000 } = {}) {
  const rand = rng(seed * 1000 + i);
  const snapshot = Array.from({ length: questions }, (_, k) => {
    const id = `q-${seed}-${i}-${k}`;
    const stem = `A firm records the following ${id}. ${'Compute the ratio. '.repeat(8)}`;
    return {
      ...Object.fromEntries(SNAPSHOT_KEYS.map((key) => [key, null])),
      id, subject: 'accountancy', internalSubject: 'accountancy', chapter: ['Partnership', 'Ratios', 'Cash Flow'][k % 3], difficulty: ['easy', 'medium', 'hard'][k % 3],
      question: stem, body: stem, options: [{ key: 'A', text: 'one of the options' }, { key: 'B', text: 'two' }, { key: 'C', text: 'three' }, { key: 'D', text: 'four' }],
      passageText: k % 10 === 0 ? 'A passage that several questions share. '.repeat(20) : null,
      correctIndex: k % 4, correctAnswer: 'A', explanation: 'Because of the rule. '.repeat(15), source: 'bank', sourceKind: 'generated', aiScore: 0.91, qualityScore: 3, upvotes: 1, downvotes: 0,
      conceptId: `c${k % 7}`, familyId: `fam-${k}`, authorId: 'e0fec4ba-6d1e-4c3c-95a4-60dfab62ad67', verificationState: 'verified',
      verificationEvidence: { content_hash: `h${rand()}`, signature: 'x'.repeat(88), claims: 'y'.repeat(evidenceChars) },
    };
  });
  const details = snapshot.map((q, k) => ({ qid: q.id, givenIndex: k % 7 === 0 ? null : (k + i) % 4, isCorrect: k % 7 === 0 ? null : (k + i) % 4 === q.correctIndex, timeMs: 20000 + k * 100 }));
  const correct = details.filter((d) => d.isCorrect === true).length;
  const wrong = details.filter((d) => d.isCorrect === false).length;
  return {
    id: `a-${seed}-${String(i).padStart(3, '0')}`, user_id: 'u1', subject: 'accountancy', score: Math.round((correct / questions) * 100), correct, wrong, unattempted: questions - correct - wrong, total: questions,
    details, questions_snapshot: snapshot, completed_at: new Date(Date.UTC(2026, 9, 1, 8, 0, 0) + i * 3_600_000).toISOString(),
    selection_meta: {
      mode: i % 2 ? 'full' : 'quick', sessionId: `s-${i}`, scoringVersion: 'server_snapshot_v1', durationMinutes: 60,
      recovery: { version: 1, telemetry: 'self_reported', scoring: 'server', observed: { answerChanges: [{ qid: snapshot[snapshot.length - 1].id, markEffect: -1 }] }, timeline: [{ qid: snapshot[0].id, at: 1000, seq: 1, type: 'open', answer: null }, { qid: snapshot[0].id, at: 9000, seq: 2, type: 'answer', answer: 2 }], recommendation: 'x'.repeat(165) },
      selectionUsage: { padding: 'u'.repeat(430) }, validation: 'ok', answerIntegrity: { padding: 'i'.repeat(560) }, poolStats: { padding: 'p'.repeat(370) }, hardRejectReasons: ['r'.repeat(100)], contentEvidence: 'present',
    },
  };
}
const ROWS = Array.from({ length: 25 }, (_, i) => row(1, i));
const OLD = (r) => ({ // the mapper of data/db.js (attemptOut), the old list item
  id: r.id, userId: r.user_id, subject: r.subject, score: r.score, correct: r.correct, wrong: r.wrong, unattempted: r.unattempted, total: r.total,
  details: r.details || [], questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {}, mode: (r.selection_meta && r.selection_meta.mode) || null,
  formatId: formatIdFor({ subject: r.subject, total: r.total, questionsSnapshot: r.questions_snapshot || [], selectionMeta: r.selection_meta || {} }), completedAt: new Date(r.completed_at).getTime(),
});
const bytes = (v) => Buffer.byteLength(JSON.stringify(v));

test('bytes for 25 attempts before and after (printed)', () => {
  const before = bytes(ROWS.map(OLD));
  const after = bytes(ROWS.map(summaryAttempt));
  console.log(`attempts list, 25 attempts x 50 questions: before ${(before / 1e6).toFixed(2)} MB (${before} bytes), after ${(after / 1e3).toFixed(1)} KB (${after} bytes), ${(before / after).toFixed(0)}x smaller`);
  assert.ok(before > 25 * 1_000_000, 'the fixture is as heavy as the staging account (more than 1 MB an attempt)');
  assert.ok(after < before / 20);
  assert.ok(after < 25 * 60_000, 'a 50-question paper is well under 60 KB in the summary');
});

test('every field the app reads is present, the heavy fields are absent', () => {
  const item = summaryAttempt(ROWS[3]);
  const old = OLD(ROWS[3]);
  // Attempt.fromJson
  assert.deepEqual(Object.keys(item), ['id', 'userId', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'details', 'questionsSnapshot', 'selectionMeta', 'mode', 'formatId', 'completedAt']);
  for (const key of ['id', 'userId', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'mode', 'formatId', 'completedAt']) assert.deepEqual(item[key], old[key], key);
  // AnswerDetail.fromJson: all four fields, unchanged
  assert.deepEqual(item.details, old.details);
  // SnapshotQuestion.fromJson, minus the key and explanation
  assert.equal(item.questionsSnapshot.length, 50);
  item.questionsSnapshot.forEach((q, k) => {
    const o = ROWS[3].questions_snapshot[k];
    for (const key of ['id', 'subject', 'internalSubject', 'chapter', 'difficulty', 'question', 'options']) assert.deepEqual(q[key], o[key], key);
    assert.deepEqual(q.passageText, o.passageText ?? undefined);
    assert.equal(q.body, undefined, 'a body that only repeats the stem is not sent (the app prints a body only when it adds something)');
    for (const heavy of ['verificationEvidence', 'explanation', 'correctIndex', 'correctAnswer', 'aiScore', 'qualityScore', 'source', 'sourceKind', 'authorId', 'upvotes', 'conceptId', 'familyId', 'verificationState']) assert.equal(heavy in q, false, heavy);
  });
  // SelectionMeta.fromJson + the recovery the app reads
  assert.deepEqual(Object.keys(item.selectionMeta).sort(), ['durationMinutes', 'mode', 'recovery', 'scoringVersion', 'sessionId']);
  assert.deepEqual(item.selectionMeta.recovery, ROWS[3].selection_meta.recovery);
  for (const heavy of ['selectionUsage', 'answerIntegrity', 'poolStats', 'hardRejectReasons', 'validation', 'contentEvidence']) assert.equal(heavy in item.selectionMeta, false, heavy);
  assert.doesNotMatch(JSON.stringify(item), /verificationEvidence|explanation|correctIndex/);
});

test('a body that adds to the stem is kept; null fields are left out; a question without a stem keeps its body', () => {
  assert.equal(slimQuestion({ id: 'q', question: 'Stem', body: 'More than the stem' }).body, 'More than the stem');
  assert.equal(slimQuestion({ id: 'q', question: 'Stem', body: ' Stem ' }).body, undefined);
  assert.equal(slimQuestion({ id: 'q', question: null, body: 'Only a body' }).body, 'Only a body');
  assert.deepEqual(Object.keys(slimQuestion({ id: 'q', subject: null, chapter: undefined, question: 'Q', options: ['a', 'b'] })), ['id', 'question', 'options']);
  assert.deepEqual(slimQuestion({ id: 'q', options: ['plain', { key: 'B', text: 'obj' }] }).options, ['plain', { key: 'B', text: 'obj' }]);
});

test('odd rows do not throw: no snapshot, no details, no meta, non-object meta', () => {
  const bare = { id: 'x', user_id: 'u1', subject: 's', score: 0, correct: 0, wrong: 0, unattempted: 0, total: 0, details: null, questions_snapshot: null, selection_meta: null, completed_at: '2026-10-01T00:00:00Z' };
  assert.deepEqual(summaryAttempt(bare), OLD(bare));
  assert.deepEqual(summaryAttempt({ ...bare, selection_meta: 'nope', details: 'nope', questions_snapshot: {} }).selectionMeta, {});
  assert.equal(summaryAttempt(null), null);
  assert.equal(summaryAttempt({ ...bare, selection_meta: { mode: 'quick' } }).mode, 'quick');
  assert.equal(summaryAttempt({ ...bare, selection_meta: { mode: 'quick' } }).formatId, 'quick:s:q0:historical_device');
});

test('only ?view=summary selects the summary; the route keeps the old response otherwise', () => {
  const req = (q) => ({ url: `https://www.mockmob.in/api/attempts${q}` });
  assert.equal(isSummaryView(req('?view=summary')), true);
  for (const q of ['', '?view=full', '?view=', '?view=Summary', '?views=summary', '?x=view=summary']) assert.equal(isSummaryView(req(q)), false, q);
  assert.equal(isSummaryView({ url: 'not a url' }), false);
  const source = readFileSync(new URL('../../src/app/api/attempts/route.js', import.meta.url), 'utf8');
  const summaryAt = source.indexOf('if (isSummaryView(request))');
  const fullAt = source.indexOf('const attempts = await Database.getAttempts(session.user.id);');
  assert.ok(summaryAt > 0 && fullAt > summaryAt, 'the summary branch comes before, and the old read is untouched');
  assert.ok(source.indexOf('finaliseExpiredSessionsForUser') < summaryAt, 'abandoned mocks are still finalised before either read');
  assert.ok(source.indexOf('forgetBadges(session.user.id)') < summaryAt, 'badges are still forgotten before either read');
  assert.match(source, /return NextResponse\.json\(attempts\);/);
});

// ---- the read: the table fallback and the database function ---------------------------------------------------
function fakeDb(rows, { rpc } = {}) {
  const calls = { table: [], rpc: 0 };
  const db = {
    calls,
    from(name) {
      assert.equal(name, 'attempts');
      const st = { select: null, user: null, orders: [], range: null };
      const q = {
        select(c) { st.select = c; calls.table.push(c); return q; },
        eq(k, v) { assert.equal(k, 'user_id'); st.user = v; return q; },
        order(c, o = { ascending: true }) { st.orders.push([c, o.ascending !== false]); return q; },
        range(a, b) { st.range = [a, b]; return q; },
        then(res, rej) {
          const list = rows.filter((r) => r.user_id === st.user).sort((a, b) => { for (const [c, asc] of st.orders) if (a[c] !== b[c]) return (a[c] < b[c] ? -1 : 1) * (asc ? 1 : -1); return 0; });
          return Promise.resolve({ data: structuredClone(list.slice(st.range[0], st.range[1] + 1)), error: null }).then(res, rej);
        },
      };
      return q;
    },
  };
  if (rpc) {
    db.rpc = (name, args) => {
      assert.equal(name, SUMMARY_RPC);
      calls.rpc += 1;
      const st = { orders: [], range: null };
      const q = {
        order(c, o = { ascending: true }) { st.orders.push([c, o.ascending !== false]); return q; },
        range(a, b) { st.range = [a, b]; return q; },
        then(res, rej) { return Promise.resolve(rpc(args, st)).then(res, rej); },
      };
      return q;
    };
  }
  return db;
}

test('table fallback: all attempts, newest first, ties by id, past 1000 rows', async () => {
  const many = Array.from({ length: 1203 }, (_, i) => ({ ...row(2, 0, { questions: 3, evidenceChars: 10 }), id: `m-${String(i).padStart(4, '0')}`, completed_at: new Date(Date.UTC(2026, 9, 1) + Math.floor(i / 2) * 60_000).toISOString() }));
  const out = await readAttemptListSummary(fakeDb(many), 'u1');
  assert.equal(out.length, 1203);
  const expected = [...many].sort((a, b) => (a.completed_at < b.completed_at ? 1 : a.completed_at > b.completed_at ? -1 : a.id < b.id ? -1 : 1)).map((r) => r.id);
  assert.deepEqual(out.map((a) => a.id), expected);
  assert.deepEqual(await readAttemptListSummary(fakeDb(many), 'nobody'), []);
  await assert.rejects(readAttemptListSummary(fakeDb(many), ''), /attempt_owner_required/);
});

test('the database function is used when it exists; a missing function falls back to the table, then is retried later', async () => {
  resetSummaryRpcState();
  const slimInDb = (r) => ({ ...r, questions_snapshot: r.questions_snapshot.map((q) => ({ id: q.id, subject: q.subject, internalSubject: q.internalSubject, chapter: q.chapter, difficulty: q.difficulty, question: q.question, body: null, options: q.options, passageText: q.passageText })), selection_meta: { mode: r.selection_meta.mode, sessionId: r.selection_meta.sessionId, scoringVersion: r.selection_meta.scoringVersion, durationMinutes: r.selection_meta.durationMinutes, recovery: r.selection_meta.recovery } });
  const sorted = [...ROWS].sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1));
  const viaRpc = fakeDb(ROWS, { rpc: (args, st) => ({ data: sorted.filter((r) => r.user_id === args.p_user_id).slice(st.range[0], st.range[1] + 1).map(slimInDb), error: null }) });
  const a = await readAttemptListSummary(viaRpc, 'u1');
  assert.equal(viaRpc.calls.rpc, 1);
  assert.deepEqual(viaRpc.calls.table, [], 'the heavy table is never read');
  const viaTable = await readAttemptListSummary(fakeDb(ROWS), 'u1');
  assert.deepEqual(a, viaTable, 'a row from the function and a row from the table give the identical list item');

  const t = 1_000_000;
  const missing = fakeDb(ROWS, { rpc: () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.attempts_list_summary(p_user_id) in the schema cache' } }) });
  assert.deepEqual(await readAttemptListSummary(missing, 'u1', { now: () => t }), viaTable);
  await readAttemptListSummary(missing, 'u1', { now: () => t + 1000 });
  assert.equal(missing.calls.rpc, 1, 'a missing function is not asked again for five minutes');
  await readAttemptListSummary(missing, 'u1', { now: () => t + 6 * 60_000 });
  assert.equal(missing.calls.rpc, 2);

  resetSummaryRpcState();
  const warn = console.warn;
  console.warn = () => {};
  try {
    const failing = fakeDb(ROWS, { rpc: () => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }) });
    assert.deepEqual(await readAttemptListSummary(failing, 'u1'), viaTable, 'any other failure still answers from the table');
  } finally { console.warn = warn; }
  resetSummaryRpcState();
});

test('the migration and its undo exist, are server-only, and the function returns the table columns in order', () => {
  const up = readFileSync(new URL('../../supabase/migrations/20261018230100_attempts_list_summary_fn.sql', import.meta.url), 'utf8');
  const down = readFileSync(new URL('../../supabase/undo/20261018230100_attempts_list_summary_fn.undo.sql', import.meta.url), 'utf8');
  assert.match(up, /create or replace function public\.attempts_list_summary\(p_user_id text\)/);
  assert.match(up, /revoke all on function public\.attempts_list_summary\(text\) from public, anon, authenticated;/);
  assert.match(up, /grant execute on function public\.attempts_list_summary\(text\) to service_role;/);
  assert.match(up, /security invoker/);
  const declared = [...up.match(/returns table \(([\s\S]*?)\n \)/)[1].matchAll(/^\s+(\w+) /gm)].map((m) => m[1]);
  assert.deepEqual(declared, ['id', 'user_id', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'details', 'questions_snapshot', 'completed_at', 'selection_meta']);
  assert.match(down, /drop function if exists public\.attempts_list_summary\(text\);/);
});
