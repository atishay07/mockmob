// IA2: what Today reads from the record (src/lib/server/todayFacts.js). Every number is counted, never guessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTEMPT_LIMIT, REPAIR_WINDOW_DAYS, answeredFromEvents, buildMoveFacts, openSessionFacts, repairFacts, repairedSet, slimAttempts, weakChapterFacts } from '../../src/lib/server/todayFacts.js';
import { mistakeKey } from '../../src/lib/server/repairRecord.js';
import { nextMove } from '../next_step_rules.mjs';

const NOW = Date.parse('2026-10-15T14:30:00.000Z');
const DAY = 86_400_000;
const USER = 'user-1';
const attempt = (id, subject, daysAgo, answers, { mode = 'full', chapter = 'Partnership Fundamentals' } = {}) => ({
  id, subject, mode, completedAt: NOW - daysAgo * DAY,
  details: answers.map((isCorrect, i) => ({ qid: `${id}-q${i}`, isCorrect })),
  questionsSnapshot: answers.map((_, i) => ({ id: `${id}-q${i}`, chapter })),
});
const reservation = (attemptId, qid) => ({ operation_key: `repair:${mistakeKey(USER, attemptId, qid)}:req1`, updated_at: '2026-10-14T10:00:00.000Z', receipt: { repair: { ok: true } } });

test('slimAttempts keeps the newest, with public subject ids and an ISO time', () => {
  const rows = Array.from({ length: ATTEMPT_LIMIT + 3 }, (_, i) => attempt(`a${i}`, 'gat', i, [true, false]));
  const slim = slimAttempts(rows);
  assert.equal(slim.length, ATTEMPT_LIMIT);
  assert.equal(slim[0].subject, 'general_test');
  assert.equal(slim[0].wrong, 1);
  assert.match(slim[0].completedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(slimAttempts([{ id: 'x', subject: 'economics', completedAt: 'not a date' }]), []);
});

test('repair: the newest attempt with unrepaired mistakes, counted from the record', () => {
  const rows = [attempt('a1', 'accountancy', 2, [false, false, true, false, null]), attempt('a0', 'economics', 5, [false])];
  const repaired = repairedSet({ userId: USER, reservations: [reservation('a1', 'a1-q1')], attempts: rows });
  assert.ok(repaired.has('a1|a1-q1'));
  const r = repairFacts(rows, repaired, NOW);
  assert.equal(r.attemptId, 'a1');
  assert.equal(r.open, 2, '3 wrong, 1 repaired, the blank is not a mistake');
  assert.equal(r.subject, 'accountancy');
  assert.equal(r.mode, 'full');
});

test('repair: all repaired falls through to an older attempt, and nothing open is null', () => {
  const rows = [attempt('a1', 'accountancy', 2, [false]), attempt('a0', 'economics', 5, [false, false])];
  const repaired = repairedSet({ userId: USER, reservations: [reservation('a1', 'a1-q0')], attempts: rows });
  assert.equal(repairFacts(rows, repaired, NOW).attemptId, 'a0');
  const allDone = repairedSet({ userId: USER, reservations: [reservation('a1', 'a1-q0'), reservation('a0', 'a0-q0'), reservation('a0', 'a0-q1')], attempts: rows });
  assert.equal(repairFacts(rows, allDone, NOW), null);
});

test('repair: an unreadable repair record claims nothing, and old attempts do not drive tonight', () => {
  const rows = [attempt('a1', 'accountancy', 2, [false])];
  assert.equal(repairFacts(rows, null, NOW), null);
  assert.equal(repairFacts([attempt('old', 'accountancy', REPAIR_WINDOW_DAYS + 1, [false])], new Set(), NOW), null);
});

test('weak chapter: the most wrong answers across the newest papers, with its denominators', () => {
  const rows = [
    attempt('a1', 'accountancy', 1, [false, false, true, false], { chapter: 'Partnership Fundamentals' }),
    attempt('a2', 'accountancy', 3, [false, true, true], { chapter: 'Partnership Fundamentals' }),
    attempt('a3', 'accountancy', 4, [true, true, true, false], { chapter: 'Goodwill Valuation' }),
  ];
  const w = weakChapterFacts(rows);
  assert.equal(w.chapter, 'Partnership Fundamentals');
  assert.equal(w.subject, 'accountancy');
  assert.equal(w.reason, '4 wrong of 7 answered, across 2 papers.');
  assert.equal(w.href, '/dashboard?subject=accountancy&mode=quick&count=10&chapter=Partnership+Fundamentals');
  assert.equal(w.source, 'record');
});

test('weak chapter: thin data says nothing, a chapter the bank does not know is never offered', () => {
  assert.equal(weakChapterFacts([attempt('a1', 'accountancy', 1, [false, false, false])]), null, '3 answered is too thin');
  assert.equal(weakChapterFacts([attempt('a1', 'accountancy', 1, [false, false, false, true, true, true], { chapter: 'Made Up Chapter' })]), null);
  assert.equal(weakChapterFacts([attempt('a1', 'accountancy', 1, [false, false, true, true, true, true])]), null, '6 answered but only 2 wrong');
});

test('weak chapter: a ready SWOT plan[0] wins over the record', () => {
  const swot = { state: 'ready', plan: [{ practice: { subject: 'economics', chapter: 'Money and Banking', count: 10 }, href: '/dashboard?subject=economics&mode=quick&count=10&chapter=Money+and+Banking', reason: '12 marks lost here.' }] };
  assert.equal(weakChapterFacts([attempt('a1', 'accountancy', 1, [false, false, false, true, true, true])], { swot }).source, 'swot');
});

test('open session: the total is the session\'s own request, answered is the latest non-blank answer per question', () => {
  const events = [{ type: 'answer', qid: 'q1', answer: 0 }, { type: 'answer', qid: 'q2', answer: 2 }, { type: 'answer', qid: 'q2', answer: null }, { type: 'mark', qid: 'q3', marked: true }, { type: 'answer', qid: 'q4', answer: 1 }];
  assert.equal(answeredFromEvents(events), 2);
  const row = { subject: 'accountancy', mode: 'full', selection_meta: { requestedCount: 50 }, events };
  assert.deepEqual(openSessionFacts(row, '/test?sessionId=s1'), { subject: 'accountancy', mode: 'full', answered: 2, total: 50, href: '/test?sessionId=s1' });
  assert.equal(openSessionFacts({ ...row, selection_meta: {} }, '/test?sessionId=s1'), null, 'no total, no "23 of 50"');
  assert.equal(openSessionFacts(null, '/test'), null);
});

test('the facts drive the same moves as the shared fixtures', () => {
  const rows = [attempt('att-7', 'accountancy', 2, [false, false, false, false, true], { mode: 'full' })];
  const facts = buildMoveFacts({ userId: USER, attempts: rows, reservations: [], now: NOW });
  assert.equal(facts.unopenedResult, null);
  assert.equal(facts.capabilities.freshCheck, false);
  const move = nextMove({ now: NOW, plan: 'free', practiceCredits: 40, aiCredits: 10, subjects: ['accountancy'], ...facts });
  assert.equal(move.id, 'repair');
  assert.match(move.title, /^Repair 4 mistakes from .* mock, about 15 minutes$/);
  assert.equal(move.primary.href, '/result/att-7');
  // The repair record could not be read: the move falls to the next rule, never to a wrong repair.
  const unknown = buildMoveFacts({ userId: USER, attempts: rows, reservations: null, now: NOW });
  assert.equal(unknown.repair, null);
});

test('a student with no attempts gets empty facts and the first move', () => {
  const facts = buildMoveFacts({ userId: USER, attempts: [], reservations: [], now: NOW });
  assert.deepEqual({ ...facts, capabilities: null }, { attempts: [], openSession: null, unopenedResult: null, repair: null, weakChapter: null, capabilities: null });
  assert.equal(nextMove({ now: NOW, subjects: ['accountancy'], ...facts }).id, 'first');
});
