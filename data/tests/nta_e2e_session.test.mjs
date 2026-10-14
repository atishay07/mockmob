// NTA mode end to end, one block per subject, through the website's real route handlers and server
// code (see data/tests/nta_e2e_harness.mjs): start, paper, timer, replay, answer protocol, submit
// scoring (+5 / -1 / 0), time-up, durable resume, and the refusals. Two data modes:
//   asis      production questions with their production scores (what a student gets today);
//   promoted  the same questions with synthetic signed scores (8 and 9) where production has none,
//             so the session path is exercised for every subject. Says nothing about quality.
//
// Needs the read-only fixtures: node --use-system-ca scripts/nta-fixture-export.mjs
// Run: npm run test:nta-e2e   (writes tmp/nta-e2e-report.json for the per-subject table)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as h from './nta_e2e_harness.mjs';
import { plainOptionTexts } from '../option_text.js';

const SKIP = !h.fixturesAvailable() ? 'fixtures missing: run node --use-system-ca scripts/nta-fixture-export.mjs' : false;
const PROD_KEY = h.productionSigningKey();
const SUBJECTS = [
  ['english', 'english'], ['general_test', 'gat'], ['accountancy', 'accountancy'], ['business_studies', 'business_studies'],
  ['economics', 'economics'], ['mathematics', 'mathematics'], ['physics', 'physics'], ['chemistry', 'chemistry'],
  ['biology', 'biology'], ['history', 'history'], ['political_science', 'political_science'], ['geography', 'geography'],
  ['psychology', 'psychology'], ['sociology', 'sociology'], ['computer_science', 'computer_science'],
];
const report = [];

// ---- helpers ----------------------------------------------------------------------------------
async function atOffset(offsetMs, fn) {
  const real = Date.now;
  Date.now = () => real.call(Date) + offsetMs;
  try { return await fn(); } finally { Date.now = real; }
}
function keyIndexOf(row) {
  const options = row.options.map((option, i) => (typeof option === 'string' ? { key: 'ABCD'[i], text: option } : { key: option.key || 'ABCD'[i], text: option.text }));
  const letter = String(row.correct_answer ?? '').trim();
  const byLetter = options.findIndex((option) => option.key === letter);
  const byText = options.findIndex((option) => option.text === letter);
  const fromIndex = Number.isInteger(row.correct_index) && row.correct_index >= 0 ? row.correct_index : null;
  // Old seed rows carry only correct_index; the server prefers it, as data/db.js resolveCorrectIndex does.
  return { fromLetter: byLetter >= 0 ? byLetter : byText >= 0 ? byText : (letter ? -1 : fromIndex ?? -1), fromIndex };
}
// The engine serves each paper's options in a per-session order and remaps the key (data/nta_item_checks.js
// ntaServedRow), so the key's index in the served paper is found by the text of the answer in the bank.
function servedKeyIndex(question, row) {
  const answerText = plainOptionTexts(row.options)[keyIndexOf(row).fromLetter];
  return plainOptionTexts(question.options).indexOf(answerText);
}
// The student's plan: i%5 = 0 and 3 right, 1 and 4 wrong, 2 left blank; question 5 is changed twice.
function plan(questions, rowsById) {
  const answers = {}; const events = []; let seq = 0; const expected = { correct: 0, wrong: 0, blank: 0, details: {} };
  const push = (qid, type, extra = {}) => { seq += 1; events.push({ seq, qid, type, at: seq * 2, ...extra }); };
  questions.forEach((question, i) => {
    const keyIdx = servedKeyIndex(question, rowsById.get(question.id));
    assert.ok(keyIdx >= 0, `the bank's answer is not among the served options of ${question.id}`);
    const kind = i % 5;
    push(question.id, 'visit');
    if (kind === 2) { expected.blank += 1; expected.details[question.id] = { givenIndex: null, isCorrect: null }; return; }
    const right = kind === 0 || kind === 3;
    const given = right ? keyIdx : (keyIdx + 1) % 4;
    if (i === 5) { push(question.id, 'answer', { answer: (keyIdx + 2) % 4 }); push(question.id, 'answer', { answer: null }); }
    push(question.id, 'answer', { answer: given });
    answers[question.id] = given;
    if (right) expected.correct += 1; else expected.wrong += 1;
    expected.details[question.id] = { givenIndex: given, isCorrect: right };
  });
  expected.raw = expected.correct * 5 - expected.wrong;
  expected.percent = Math.max(0, Math.round(expected.raw / (questions.length * 5) * 100));
  return { answers, events, expected };
}
const startBody = (extra = {}) => ({ subject: extra.subject, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: h.generationKey(extra.label || 'k'), ...extra.body });

for (const mode of ['asis', 'promoted']) {
  for (const [subject, internal] of SUBJECTS) {
    test(`NTA ${mode} / ${subject}`, { skip: SKIP || (mode === 'asis' && !PROD_KEY ? 'production signing key not in .env.local' : false), timeout: 240000 }, async (t) => {
      const rec = { mode, subject, passed: [], failed: [], notes: [] };
      report.push(rec);
      const step = (name, fn) => t.test(name, async () => {
        try { await fn(); rec.passed.push(name); } catch (error) { rec.failed.push({ name, error: String(error.message).slice(0, 300) }); throw error; }
      });
      const signingKey = mode === 'asis' ? PROD_KEY : h.TEST_SECRET;
      h.configure({ signingKey });
      // 'late' is a second premium student for the time-up sessions: they test the clock, so they start as a student's
      // first paper. Since the CUET-fit gate (engine r5) a thin subject such as General Test serves a first paper but can
      // refuse a later one for the same student (the 'next paper' step records that).
      const rows = await h.loadSubject(internal, { mode, students: [{ id: 'prem' }, { id: 'free', premium: false, credits: 100 }, { id: 'other' }, { id: 'late' }] });
      const fake = h.fake;
      const rowsById = new Map(rows.map((row) => [row.id, row]));
      const key = h.generationKey(`${mode}${subject}`);
      const started = Date.now();
      const res = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: key }, 'prem');
      rec.startMs = Date.now() - started;
      rec.http = res.status;

      // ---------------- refused ----------------
      if (res.status !== 200) {
        rec.outcome = 'refused';
        rec.message = res.body.message;
        rec.reason = res.body.detail?.reason;
        await step('refusal is a clean 422 with a sentence for the student and the reason', () => {
          assert.equal(res.status, 422, JSON.stringify(res.body).slice(0, 300));
          assert.equal(res.body.error, 'INSUFFICIENT_PRACTICE_CONTENT');
          assert.equal(typeof res.body.message, 'string');
          assert.ok(res.body.message.length > 40, 'message too short to help a student');
          assert.match(res.body.message, /Full Mock|Practice|try again/i, 'refusal offers no next step');
          assert.ok(res.body.detail?.reason, 'no reason in the detail');
          // No leaked error: a stack property or frame, a TypeError, undefined. (Not the bare word "stack": Computer Science has a chapter "Stack".)
          assert.doesNotMatch(JSON.stringify(res.body), /"stack"|\bat (?:\S+ \()?(?:file:|node:|[A-Za-z]:\\)|TypeError|undefined|\[object/i);
          assert.equal(res.body.questions, undefined);
          assert.equal(res.body.meta?.sessionTicket, undefined);
        });
        await step('a refusal creates no session, no attempt, no write and no charge', () => {
          assert.equal(fake.table('recovery_sessions').length, 0);
          assert.equal(fake.table('attempts').length, 0);
          assert.equal(fake.store.calls.write, 0, JSON.stringify(fake.store.calls.writes));
          assert.equal(fake.table('users').find((user) => user.id === 'prem').credit_balance, 0);
        });
        await step('a refusal repeats identically and is not cached into a start', async () => {
          const again = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: h.generationKey('again') }, 'prem');
          assert.equal(again.status, 422);
          assert.equal(again.body.message, res.body.message);
        });
        await step('free student is told NTA mode is Premium, with no engine work leaked', async () => {
          const free = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('free') }, 'free');
          assert.equal(free.status, 402);
          assert.equal(free.body.error, 'PREMIUM_REQUIRED');
        });
        return;
      }

      // ---------------- served ----------------
      rec.outcome = 'served';
      const paper = res.body;
      const questions = paper.questions;
      const ntaPaper = paper.meta?.ntaPaper;
      rec.paperStatus = ntaPaper?.status;
      rec.questions = questions.length;
      rec.deviations = ntaPaper?.items?.length ?? 0;
      rec.summary = ntaPaper?.summary;
      const ticket = paper.meta?.sessionTicket;

      await step('paper: 45-50 unique live questions, 4 labelled options each, exact means 50', () => {
        assert.ok(questions.length >= 45 && questions.length <= 50, `${questions.length} questions`);
        assert.ok(['exact', 'closest'].includes(ntaPaper.status));
        if (ntaPaper.status === 'exact') assert.equal(questions.length, 50);
        assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
        for (const q of questions) {
          const row = rowsById.get(q.id);
          assert.ok(row, `question ${q.id} is not in the bank`);
          assert.equal(row.status, 'live');
          assert.equal(row.is_deleted, false);
          assert.equal(q.options.length, 4, `question ${q.id} has ${q.options.length} options`);
          assert.deepEqual(q.options.map((o) => o.key), ['A', 'B', 'C', 'D']);
          assert.ok(q.options.every((o) => typeof o.text === 'string' && o.text.trim().length > 0), `blank option in ${q.id}`);
          assert.equal(new Set(q.options.map((o) => o.text.trim().toLowerCase())).size, 4, `repeated option text in ${q.id}`);
          assert.ok(String(q.question || q.body || '').trim().length > 10, `empty stem in ${q.id}`);
          assert.ok(q.chapter, `no chapter on ${q.id}`);
        }
      });
      await step('paper: what the runner shows for each option is never blank, and a letter stored in front of every option is not shown twice', () => {
        for (const q of questions) {
          const shown = plainOptionTexts(q.options);
          assert.equal(shown.length, 4);
          assert.ok(shown.every((text) => text.trim().length > 0), `blank displayed option in ${q.id}`);
          assert.equal(new Set(shown.map((text) => text.trim().toLowerCase())).size, 4, `displayed options collide in ${q.id}`);
          const stored = q.options.map((o) => o.text);
          const prefixed = stored.every((text, i) => new RegExp(String.raw`^\s*${'ABCD'[i]}(?:\s*[.):]\s*|\s{2,})\S`).test(text));
          if (prefixed) assert.ok(shown.every((text, i) => text.length < stored[i].length), `letter still shown in ${q.id}`);
          else assert.deepEqual(shown, stored, `display changed a plain option in ${q.id}`);
        }
      });
      await step('paper: the answer key, explanation and evidence never reach the browser', () => {
        const text = JSON.stringify(paper);
        assert.doesNotMatch(text, /correct_?answer|correctIndex|"explanation"|solved_key|"evidence"|"signature"|verificationEvidence|isCorrect/i);
        assert.ok(ticket && ticket.startsWith('p2.'), 'no sealed session ticket');
        assert.ok(ticket.length < 500000);
      });
      await step('paper: the sealed snapshot holds the right key for every served question', async () => {
        const { openPractice } = await import(new URL('../practice_ticket.js', import.meta.url).href);
        const snapshot = openPractice(ticket, process.env.PRACTICE_SESSION_SECRET, 'prem');
        assert.equal(snapshot.questions.length, questions.length);
        assert.deepEqual(snapshot.questions.map((q) => q.id), questions.map((q) => q.id));
        for (const q of snapshot.questions) {
          const { fromLetter, fromIndex } = keyIndexOf(rowsById.get(q.id));
          assert.ok(fromLetter >= 0, `no key for ${q.id}`);
          if (fromIndex !== null) assert.equal(fromIndex, fromLetter, `correct_index and correct_answer disagree for ${q.id}`);
          // Options are served in a per-session order with the key remapped: the snapshot key must point at the bank's answer text.
          const bankAnswer = plainOptionTexts(rowsById.get(q.id).options)[fromLetter];
          assert.equal(plainOptionTexts(q.options)[q.correctIndex], bankAnswer, `snapshot key differs from the bank for ${q.id}`);
          assert.equal(snapshot.selection_meta.ntaOptionLayout.key[q.id], 'ABCD'[q.correctIndex], `stored key letter for ${q.id}`);
        }
      });
      await step('paper: passage sets are whole, contiguous and carry visible passage text', () => {
        const groups = new Map();
        questions.forEach((q, i) => { if (q.passageGroupId || q.passageText) groups.set(q.passageGroupId || q.passageText, [...(groups.get(q.passageGroupId || q.passageText) || []), i]); });
        for (const [group, positions] of groups) {
          assert.deepEqual(positions, Array.from({ length: positions.length }, (_, k) => positions[0] + k), `passage ${String(group).slice(0, 8)} is split`);
          for (const position of positions) assert.ok(String(questions[position].passageText || '').trim().length > 80, `passage text missing on Q${position + 1}`);
          assert.ok(positions.length >= 3, `passage ${String(group).slice(0, 8)} has only ${positions.length} question(s)`);
        }
        rec.passageSets = groups.size;
      });
      await step('paper: a closest paper lists its differences; an exact paper lists none', () => {
        if (ntaPaper.status === 'closest') { assert.ok(ntaPaper.items.length > 0); assert.ok(ntaPaper.summary.length > 20); } else assert.equal(ntaPaper.items.length, 0);
      });
      await step('timer: 60 minutes from start, server clock inside the window', () => {
        assert.equal(Date.parse(paper.expiresAt) - Date.parse(paper.startedAt), 3600000);
        assert.ok(paper.serverNow >= Date.parse(paper.startedAt) && paper.serverNow <= Date.parse(paper.expiresAt));
        assert.ok(Math.abs(Date.parse(paper.startedAt) - Date.now()) < 15000);
        assert.equal(paper.meta.mode, 'nta');
      });
      await step('start charges nothing and records no attempt', () => {
        assert.equal(fake.table('users').find((user) => user.id === 'prem').credit_balance, 0);
        assert.equal(fake.table('attempts').length, 0);
      });
      await step('replay: the same key returns the same session id and the same paper in the same order', async () => {
        const again = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: key }, 'prem');
        assert.equal(again.status, 200);
        assert.equal(again.body.id, paper.id);
        assert.deepEqual(again.body.questions.map((q) => q.id), questions.map((q) => q.id));
        rec.replayTimerRestarted = again.body.expiresAt !== paper.expiresAt;
      });
      await step('a different key gives a fresh session; the paper favours unseen questions', async () => {
        const other = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('fresh') }, 'prem');
        assert.equal(other.status, 200);
        assert.notEqual(other.body.id, paper.id);
      });
      await step('variants: each paper variant starts as asked, an unknown variant falls back to the default', async () => {
        const { engine } = await h.app();
        const bp = engine.getNtaBlueprint(subject);
        rec.variants = bp.variants.map((variant) => variant.id);
        for (const variant of bp.variants) {
          const result = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', variant: variant.id, generationKey: h.generationKey(`v${variant.id}`) }, 'prem');
          assert.ok([200, 422].includes(result.status), `variant ${variant.id}: ${result.status}`);
          if (result.status === 200) assert.equal(result.body.meta.ntaPaper.variant, variant.id);
          rec.notes.push(`variant ${variant.id}: ${result.status === 200 ? `${result.body.questions.length} questions` : `refused (${result.body.detail?.reason})`}`);
        }
        const unknown = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', variant: 'zzz', generationKey: h.generationKey('vzzz') }, 'prem');
        assert.ok([200, 422].includes(unknown.status));
        if (unknown.status === 200) assert.equal(unknown.body.meta.ntaPaper.variant, bp.variants.find((variant) => variant.default).id);
        const junk = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', variant: '../../x;drop', generationKey: h.generationKey('vjunk') }, 'prem');
        assert.ok([200, 422].includes(junk.status), 'a malformed variant must not break the start');
      });
      await step('NTA mode rejects a difficulty override and a wrong mode id', async () => {
        const hard = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', difficulty: 'hard', generationKey: h.generationKey('hard') }, 'prem');
        assert.equal(hard.status, 422);
        assert.equal(hard.body.error, 'DIFFICULTY_NOT_ALLOWED');
      });
      await step('access: signed-out 401, free student 402 and no session, count is forced to 50', async () => {
        const anon = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('anon') }, null);
        assert.equal(anon.status, 401);
        const free = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('free') }, 'free');
        assert.equal(free.status, 402);
        assert.equal(fake.table('users').find((user) => user.id === 'free').credit_balance, 100);
        const small = await h.call('POST', { subject, mode: 'nta', count: 5, experience: 'practice', generationKey: h.generationKey('count5') }, 'prem');
        assert.equal(small.status, 200);
        assert.ok(small.body.questions.length >= 45);
      });

      const { answers, events, expected } = plan(questions, rowsById);
      await step('submit: another student cannot submit this session; a tampered ticket is refused', async () => {
        const stolen = await h.call('POST', { sessionId: paper.id, sessionTicket: ticket, answers: {}, events: [] }, 'other', { route: 'attempts', path: '/api/attempts' });
        assert.ok(stolen.status >= 400 && stolen.status < 500, `status ${stolen.status}`);
        assert.equal(fake.table('attempts').length, 0);
        const flipped = ticket.slice(0, -4) + (ticket.endsWith('AAAA') ? 'BBBB' : 'AAAA');
        const bad = await h.call('POST', { sessionId: paper.id, sessionTicket: flipped, answers: {}, events: [] }, 'prem', { route: 'attempts', path: '/api/attempts' });
        assert.equal(bad.status, 422);
        assert.equal(bad.body.error, 'INVALID_PRACTICE_SESSION');
        assert.equal(fake.table('attempts').length, 0);
      });
      await step('submit: answers for questions that are not on the paper are refused', async () => {
        const bad = await h.call('POST', { sessionId: paper.id, sessionTicket: ticket, answers: { 'not-a-question': 0 }, events: [] }, 'prem', { route: 'attempts', path: '/api/attempts' });
        assert.equal(bad.status, 422);
        assert.equal(fake.table('attempts').length, 0);
        const outOfRange = await h.call('POST', { sessionId: paper.id, sessionTicket: ticket, answers: { [questions[0].id]: 9 }, events: [] }, 'prem', { route: 'attempts', path: '/api/attempts' });
        assert.equal(outOfRange.status, 422);
        assert.equal(fake.table('attempts').length, 0);
      });
      let attempt;
      await step('submit: +5 right, -1 wrong, 0 blank; score, counts and per-question details are exact', async () => {
        const submitted = await h.call('POST', { sessionId: paper.id, sessionTicket: ticket, answers, events }, 'prem', { route: 'attempts', path: '/api/attempts' });
        assert.equal(submitted.status, 200, JSON.stringify(submitted.body).slice(0, 300));
        attempt = submitted.body;
        assert.equal(attempt.id, paper.id);
        assert.equal(attempt.correct, expected.correct);
        assert.equal(attempt.wrong, expected.wrong);
        assert.equal(attempt.unattempted, expected.blank);
        assert.equal(attempt.total, questions.length);
        assert.equal(attempt.correct * 5 - attempt.wrong, expected.raw);
        assert.equal(attempt.score, expected.percent);
        assert.equal(attempt.details.length, questions.length);
        for (const detail of attempt.details) {
          assert.equal(detail.givenIndex, expected.details[detail.qid].givenIndex, `given index for ${detail.qid}`);
          assert.equal(detail.isCorrect, expected.details[detail.qid].isCorrect, `verdict for ${detail.qid}`);
        }
        rec.sampleScore = { correct: attempt.correct, wrong: attempt.wrong, blank: attempt.unattempted, raw: expected.raw, percent: attempt.score };
      });
      await step('submit: the attempt, its snapshot and the per-question progress are stored once', () => {
        const stored = fake.table('attempts');
        assert.equal(stored.length, 1);
        assert.equal(stored[0].user_id, 'prem');
        assert.equal(stored[0].subject, internal);
        assert.equal(stored[0].questions_snapshot.length, questions.length);
        assert.equal(stored[0].selection_meta.ntaPaper.status, ntaPaper.status);
        assert.equal(stored[0].selection_meta.scoringVersion, 'server_practice_v1');
        assert.equal(fake.table('user_question_progress').length, questions.length);
        assert.equal(fake.table('user_question_progress').filter((row) => row.attempt_count > 0).length, expected.correct + expected.wrong);
      });
      await step('submit: a second submit (double click, retry) returns the same attempt and stores nothing more', async () => {
        const again = await h.call('POST', { sessionId: paper.id, sessionTicket: ticket, answers: {}, events: [] }, 'prem', { route: 'attempts', path: '/api/attempts' });
        assert.equal(again.status, 200);
        assert.equal(again.body.score, attempt.score);
        assert.equal(fake.table('attempts').length, 1);
        const restart = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: key }, 'prem');
        assert.equal(restart.status, 422, 'a submitted session must not restart under the same key');
        assert.equal(restart.body.error, 'SESSION_ALREADY_SUBMITTED');
      });
      await step('next paper after a submit prefers questions the student has not seen', async () => {
        const next = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('next') }, 'prem');
        if (next.status !== 200) { rec.notes.push(`second paper after a submit: ${next.status} ${next.body.error}`); return; }
        const seen = new Set(questions.map((q) => q.id));
        const overlap = next.body.questions.filter((q) => seen.has(q.id)).length;
        rec.secondPaperOverlap = overlap;
        rec.secondPaperSeenUsed = next.body.meta.ntaPaper.seenUsed;
        assert.equal(overlap, next.body.meta.ntaPaper.seenUsed, 'overlap does not match the engine\'s own seen count');
      });

      // time-up on a ticket session: the deadline is 60 minutes; the server allows a 2 minute upload grace.
      const late = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('late') }, 'late');
      await step('time-up: a submit 61 minutes in (inside the grace) is scored; 63 minutes in is refused', async () => {
        assert.equal(late.status, 200, JSON.stringify(late.body).slice(0, 300));
        const lateAnswers = { [late.body.questions[0].id]: 0 };
        const refused = await atOffset(63 * 60000, () => h.call('POST', { sessionId: late.body.id, sessionTicket: late.body.meta.sessionTicket, answers: lateAnswers, events: [] }, 'late', { route: 'attempts', path: '/api/attempts' }));
        assert.equal(refused.status, 422);
        assert.equal(refused.body.error, 'SESSION_EXPIRED');
        const before = fake.table('attempts').length;
        const graced = await atOffset(61 * 60000, () => h.call('POST', { sessionId: late.body.id, sessionTicket: late.body.meta.sessionTicket, answers: lateAnswers, events: [] }, 'late', { route: 'attempts', path: '/api/attempts' }));
        assert.equal(graced.status, 200);
        assert.equal(graced.body.correct + graced.body.wrong, 1);
        assert.equal(fake.table('attempts').length, before + 1);
        rec.ticketGraceCountsLateAnswers = true;
      });

      // Durable sessions (LEARNING_SESSIONS_ENABLED=true): the server keeps the session and its events.
      h.configure({ signingKey, durable: true });
      await h.loadSubject(internal, { mode, students: [{ id: 'prem' }, { id: 'other' }, { id: 'late' }] });
      const dkey = h.generationKey(`d${subject}`);
      const durable = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: dkey }, 'prem');
      await step('durable: the session is stored server side with no ticket and the same paper rules', () => {
        assert.equal(durable.status, 200, JSON.stringify(durable.body).slice(0, 300));
        assert.equal(durable.body.meta.sessionTicket, undefined);
        assert.equal(fake.table('recovery_sessions').length, 1);
        assert.equal(Date.parse(durable.body.expiresAt) - Date.parse(durable.body.startedAt), 3600000);
        assert.ok(['exact', 'closest'].includes(durable.body.meta.ntaPaper.status));
        if (durable.body.meta.ntaPaper.status !== ntaPaper.status) rec.notes.push(`paper status depends on the key: ${ntaPaper.status} for one key, ${durable.body.meta.ntaPaper.status} for another`);
      });
      const dq = durable.body.questions;
      const dplan = plan(dq, rowsById);
      await step('durable resume: reload with the same key or the session id returns the same session and the saved answers', async () => {
        const half = dplan.events.slice(0, Math.floor(dplan.events.length / 2));
        const put = await h.call('PUT', { sessionId: durable.body.id, events: half }, 'prem');
        assert.equal(put.status, 200, JSON.stringify(put.body));
        assert.equal(put.body.acknowledgedSequence, half.at(-1).seq);
        const sameKey = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', includeMeta: '1', generationKey: dkey }, 'prem');
        assert.equal(sameKey.status, 200);
        assert.equal(sameKey.body.id, durable.body.id);
        assert.equal(sameKey.body.expiresAt, durable.body.expiresAt, 'the timer must not restart on reload');
        assert.deepEqual(sameKey.body.questions.map((q) => q.id), dq.map((q) => q.id));
        const byId = await h.call('POST', { sessionId: durable.body.id }, 'prem');
        assert.equal(byId.status, 200);
        assert.equal(byId.body.expiresAt, durable.body.expiresAt);
        assert.deepEqual(byId.body.events, half);
        const stolen = await h.call('POST', { sessionId: durable.body.id }, 'other');
        assert.equal(stolen.status, 404);
      });
      await step('durable: events are idempotent and ordered; a gap or a forged sequence is refused', async () => {
        const again = await h.call('PUT', { sessionId: durable.body.id, events: dplan.events.slice(0, 4) }, 'prem');
        assert.equal(again.status, 200);
        const gap = await h.call('PUT', { sessionId: durable.body.id, events: [{ seq: 9999, qid: dq[0].id, type: 'visit', at: 99999 }] }, 'prem');
        assert.ok(gap.status >= 400, `a gap was accepted: ${gap.status}`);
        const rest = await h.call('PUT', { sessionId: durable.body.id, events: dplan.events }, 'prem');
        assert.equal(rest.status, 200);
        assert.equal(rest.body.acknowledgedSequence, dplan.events.at(-1).seq);
      });
      await step('durable submit: scored from the saved answers; same +5 / -1 / 0 result', async () => {
        const done = await h.call('PATCH', { sessionId: durable.body.id, answers: dplan.answers, events: dplan.events }, 'prem');
        assert.equal(done.status, 200, JSON.stringify(done.body).slice(0, 300));
        assert.equal(done.body.correct, dplan.expected.correct);
        assert.equal(done.body.wrong, dplan.expected.wrong);
        assert.equal(done.body.unattempted, dplan.expected.blank);
        assert.equal(done.body.score, dplan.expected.percent);
        assert.equal(fake.table('attempts').length, 1);
        const second = await h.call('PATCH', { sessionId: durable.body.id, answers: {}, events: [] }, 'prem');
        assert.equal(second.status, 200);
        assert.equal(second.body.score, dplan.expected.percent);
        assert.equal(fake.table('attempts').length, 1);
      });
      const dlate = await h.call('POST', { subject, mode: 'nta', count: 50, experience: 'practice', generationKey: h.generationKey('dlate') }, 'late');
      await step('durable time-up: after the deadline only answers already saved count; late body answers do not', async () => {
        assert.equal(dlate.status, 200, JSON.stringify(dlate.body).slice(0, 300));
        const lq = dlate.body.questions;
        const saved = [{ seq: 1, qid: lq[0].id, type: 'visit', at: 1 }, { seq: 2, qid: lq[0].id, type: 'answer', answer: 0, at: 2 }];
        assert.equal((await h.call('PUT', { sessionId: dlate.body.id, events: saved }, 'late')).status, 200);
        const lateBody = { sessionId: dlate.body.id, answers: { [lq[0].id]: 0, [lq[1].id]: 0, [lq[2].id]: 0 }, events: [] };
        const refused = await atOffset(63 * 60000, () => h.call('PATCH', lateBody, 'late'));
        assert.equal(refused.status, 422);
        assert.equal(refused.body.error, 'SESSION_EXPIRED');
        const lateEvent = [{ seq: 3, qid: lq[1].id, type: 'answer', answer: 0, at: 3 }];
        const noSave = await atOffset(61 * 60000, () => h.call('PUT', { sessionId: dlate.body.id, events: lateEvent }, 'late'));
        assert.ok(noSave.status >= 400, 'an event after the deadline was acknowledged');
        const graced = await atOffset(61 * 60000, () => h.call('PATCH', lateBody, 'late'));
        assert.equal(graced.status, 200, JSON.stringify(graced.body).slice(0, 200));
        assert.equal(graced.body.correct + graced.body.wrong, 1, 'a late answer outside the saved events was counted');
      });
    });
  }
}

test.after(() => {
  if (!report.length) return;
  fs.mkdirSync(path.join(h.ROOT, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(h.ROOT, 'tmp', 'nta-e2e-report.json'), JSON.stringify(report, null, 2));
});
