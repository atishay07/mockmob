// C-dec 2 item 1 (20 Oct): a Mob paper keeps its answers, explanations and per-question right or wrong on the server until
// the paper closes for the Mob. src/lib/mob/paperHold.mjs holds the rule; these tests drive it, the server helpers, the
// Review record and the per-answer check gate, and read the routes' sources to prove every path that can show a key goes
// through the hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextOpensAt } from '../../src/lib/mob/model.mjs';
import {
  attemptForClient, attemptHold, heldAttemptView, heldCompare, holdCopy, holdStamp, holdUntilFor, isHeld, mobTagOf, openAttemptsOnly, opensIn, opensLabel,
} from '../../src/lib/mob/paperHold.mjs';
import { HOLD_LOOKBACK_DAYS, openAttemptLoader, readHeldMobPapers, readHeldMobPapersSafe } from '../../src/lib/server/answerHold.js';
import { checkAllowed } from '../../src/lib/server/sessionCheck.js';
import { buildReviewRecord } from '../../src/lib/server/review.js';

const WEEK = '2026-10-19'; // Monday 19 Oct 2026; the paper closes Sunday 25 Oct, 11:59 PM IST
const OPENS = Date.parse('2026-10-26T00:00:00+05:30');
const TUESDAY = Date.parse('2026-10-20T10:00:00+05:30');
const DAY = 86_400_000;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const snapshot = [
  { id: 'q1', chapter: 'Goodwill', question: 'One', options: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: 'Because B.' },
  { id: 'q2', chapter: 'Ratios', question: 'Two', options: ['a', 'b', 'c', 'd'], correctIndex: 3, explanation: 'Because D.' },
];
const mobAttempt = (extra = {}) => ({
  id: 'att_mob', userId: 'u1', subject: 'accountancy', score: 50, correct: 1, wrong: 1, unattempted: 0, total: 2, mode: 'quick',
  formatId: 'quick:accountancy:q2:server_practice_v1', completedAt: TUESDAY,
  details: [{ qid: 'q1', givenIndex: 1, isCorrect: true, timeMs: 9000 }, { qid: 'q2', givenIndex: 0, isCorrect: false, timeMs: 12000 }],
  questionsSnapshot: snapshot,
  selectionMeta: { mode: 'quick', sessionId: 'att_mob', scoringVersion: 'server_practice_v1', recovery: { telemetry: 'self_reported' }, mobPaper: { mobId: 'm1', weekStart: WEEK, holdUntil: nextOpensAt(WEEK) }, ...extra },
});
const ordinary = { id: 'att_plain', userId: 'u1', subject: 'accountancy', correct: 1, wrong: 0, total: 1, details: [{ qid: 'q9', isCorrect: true }], questionsSnapshot: [{ id: 'q9', correctIndex: 0 }], selectionMeta: { mode: 'quick' } };

test('when a Mob paper opens: the weekly paper at Monday 12:00 AM IST, an extra paper at its own close', () => {
  assert.equal(holdUntilFor({ mobId: 'm1', weekStart: WEEK }), OPENS, 'weekly, no stamp: the next week opens');
  assert.equal(holdStamp({ weekStart: WEEK }), nextOpensAt(WEEK));
  const made = Date.parse('2026-10-21T18:30:00+05:30');
  const extraCloses = new Date(made + 7 * DAY).toISOString();
  assert.equal(holdStamp({ weekStart: WEEK, extraClosesAt: extraCloses }), extraCloses);
  assert.equal(holdUntilFor({ mobId: 'm1', weekStart: WEEK, extraId: 'x1', holdUntil: extraCloses }), made + 7 * DAY);
  assert.equal(holdUntilFor({ mobId: 'm1', weekStart: WEEK, extraId: 'x1' }), OPENS + 7 * DAY, 'an unstamped extra holds to the end of the next week, the latest it can close');
  assert.equal(holdUntilFor(null), null);
  assert.equal(holdUntilFor({ mobId: 'm1', weekStart: 'monday' }), null);
  assert.equal(mobTagOf({ selection_meta: { mobPaper: { mobId: 'm1', weekStart: WEEK } } }).mobId, 'm1', 'a raw attempts row');
  assert.equal(mobTagOf({ mobPaper: { mobId: 'm1', weekStart: WEEK } }).mobId, 'm1', 'a selected tag');
  assert.equal(mobTagOf(ordinary), null);
});

test('the hold reads as a student would say it, in IST and 12-hour time', () => {
  assert.equal(opensLabel(OPENS), 'Sunday 25 Oct, 11:59 PM', 'midnight shows as the Sunday minute before it');
  assert.equal(opensLabel(Date.parse('2026-10-28T18:30:00+05:30')), 'Wednesday 28 Oct, 6:30 PM');
  const copy = holdCopy(OPENS, 'weekly');
  assert.equal(copy.title, 'The answers open on Sunday 25 Oct');
  assert.equal(copy.short, 'The answers open on Sunday 25 Oct, 11:59 PM.');
  assert.match(copy.line, /^This week's paper stays open for your Mob until Sunday 25 Oct, 11:59 PM, so its answers and explanations stay closed until then and nobody can pass them on\. Then you can see every answer, fix your mistakes and compare with your Mob\.$/);
  assert.match(holdCopy(OPENS, 'extra').line, /^This extra paper stays open/);
  assert.deepEqual([OPENS - TUESDAY, 30 * 3_600_000, 3 * 3_600_000 + 5, 3_600_000, 20 * 60_000, 30_000, 0].map((left) => opensIn(OPENS, OPENS - left)),
    ['in 5 days', 'in a day', 'in 3 hours', 'in an hour', 'in 20 minutes', 'in a minute', 'in a moment']);
  for (const text of Object.values(copy)) assert.doesNotMatch(text, /!|\p{Extended_Pictographic}/u, 'R6: no exclamation marks, no emoji');
});

test('attemptHold: held before the close, open from the close, never for an ordinary paper', () => {
  const a = mobAttempt();
  const hold = attemptHold(a, TUESDAY);
  assert.deepEqual({ ...hold, title: undefined, line: undefined, short: undefined }, { until: nextOpensAt(WEEK), kind: 'weekly', mobId: 'm1', weekStart: WEEK, title: undefined, line: undefined, short: undefined });
  assert.equal(isHeld(a, OPENS - 1), true, 'the last millisecond of Sunday is still held');
  assert.equal(isHeld(a, OPENS), false, 'open the moment the next week opens');
  assert.equal(attemptHold(ordinary, TUESDAY), null);
  assert.equal(attemptHold(mobAttempt({ mobPaper: { mobId: 'm1', weekStart: '2026-10-05' } }), TUESDAY), null, 'an old week is open');
  assert.deepEqual(openAttemptsOnly([a, ordinary], TUESDAY).map((x) => x.id), ['att_plain']);
  assert.deepEqual(openAttemptsOnly([a, ordinary], OPENS).map((x) => x.id), ['att_mob', 'att_plain']);
});

test('a held attempt carries the marks and nothing that gives an answer away, in a shape older apps read', () => {
  const view = attemptForClient(mobAttempt(), TUESDAY);
  const text = JSON.stringify(view);
  for (const leak of ['correctIndex', '"explanation"', 'isCorrect', 'givenIndex', 'Because', 'Goodwill', '"q1"', '"q2"', 'recovery']) assert.equal(text.includes(leak), false, leak);
  // The app's Attempt.fromJson (flutter_app/lib/core/models/attempt.dart): arrays, numbers and the time are present, so an
  // older build shows its marks-only result (no rows) instead of failing.
  assert.deepEqual(view.details, []);
  assert.deepEqual(view.questionsSnapshot, []);
  assert.deepEqual([view.id, view.subject, view.correct, view.wrong, view.unattempted, view.total, view.score, view.completedAt, view.mode, view.formatId],
    ['att_mob', 'accountancy', 1, 1, 0, 2, 50, TUESDAY, 'quick', 'quick:accountancy:q2:server_practice_v1']);
  assert.equal(view.selectionMeta.scoringVersion, 'server_practice_v1');
  assert.deepEqual(view.selectionMeta.mobPaper, { mobId: 'm1', weekStart: WEEK }, 'the Mob row on the result still finds its Mob');
  assert.equal(view.mobHold.until, nextOpensAt(WEEK));
  assert.equal(view.mobHold.title, 'The answers open on Sunday 25 Oct');
  assert.deepEqual(view.selectionMeta.mobHold, view.mobHold);
  // After the close it is the attempt itself, and an ordinary attempt is never touched.
  const after = mobAttempt();
  assert.equal(attemptForClient(after, OPENS), after);
  assert.equal(attemptForClient(ordinary, TUESDAY), ordinary);
  // A summary row (no tag left on it) is held from the hold read beside it.
  const row = heldAttemptView({ id: 'att_mob', subject: 'accountancy', correct: 1, wrong: 1, unattempted: 0, total: 2, details: [{ qid: 'q1', isCorrect: true }], questionsSnapshot: [{ id: 'q1' }], selectionMeta: { mode: 'quick' } }, attemptHold(mobAttempt(), TUESDAY));
  assert.deepEqual([row.details, row.questionsSnapshot, row.mobHold.kind], [[], [], 'weekly']);
});

test('the side-by-side while open: picks, split and time stay; keys, right and wrong and the trap wait', () => {
  const compare = {
    kind: 'weekly', week: WEEK, teaser: { split: 1, of: 2, text: 'Your Mob split on 1 of 2 questions.' },
    questions: [
      { number: 1, key: 'B', split: false, you: { picked: 'B', right: true, changed: 0, seconds: 9 }, others: [{ name: 'Asha', picked: 'B', right: true }], trap: null },
      { number: 2, key: 'D', split: true, you: { picked: 'A', right: false, changed: 1, seconds: 12 }, others: [{ name: 'Asha', picked: 'A', right: false }], trap: { option: 'A', count: 3, of: 3 } },
    ],
  };
  const hold = attemptHold(mobAttempt(), TUESDAY);
  const held = heldCompare(compare, hold);
  assert.equal(held.held, hold);
  assert.equal(held.teaser.text, 'Your Mob split on 1 of 2 questions.');
  assert.deepEqual(held.questions.map((q) => [q.key, q.trap, q.split, q.you.picked, q.you.right, q.you.seconds, q.others[0].picked, q.others[0].right]),
    [[null, null, false, 'B', null, 9, 'B', null], [null, null, true, 'A', null, 12, 'A', null]]);
  assert.equal(compare.questions[0].key, 'B', 'the input is not changed');
  assert.equal(heldCompare(compare, null), compare);
});

test('the server reads: held papers from one small read, and one-question routes see a held paper as not found', async () => {
  const calls = [];
  const rows = [
    { id: 'att_mob', completed_at: new Date(TUESDAY).toISOString(), mobPaper: { mobId: 'm1', weekStart: WEEK }, details: [{ qid: 'q1' }, { qid: 'q2' }] },
    { id: 'att_old', completed_at: '2026-10-08T10:00:00+05:30', mobPaper: { mobId: 'm1', weekStart: '2026-10-05' }, details: [{ qid: 'q7' }] },
  ];
  const db = {
    from(name) {
      const q = { name, filters: [] };
      calls.push(q);
      const chain = {
        select(c) { q.select = c; return chain; },
        eq(k, v) { q.filters.push(['eq', k, v]); return chain; },
        not(k, op, v) { q.filters.push(['not', k, op, v]); return chain; },
        gte(k, v) { q.filters.push(['gte', k, v]); return Promise.resolve({ data: rows, error: null }); },
      };
      return chain;
    },
  };
  const held = await readHeldMobPapers(db, 'u1', TUESDAY);
  assert.deepEqual([...held.byId.keys()], ['att_mob']);
  assert.deepEqual([...held.qids], ['q1', 'q2']);
  assert.equal(calls[0].name, 'attempts');
  assert.match(calls[0].select, /selection_meta->mobPaper/);
  assert.deepEqual(calls[0].filters, [['eq', 'user_id', 'u1'], ['not', 'selection_meta->mobPaper', 'is', null], ['gte', 'completed_at', new Date(TUESDAY - HOLD_LOOKBACK_DAYS * DAY).toISOString()]]);
  const failing = { from() { throw new Error('boom'); } };
  const warn = console.warn; console.warn = () => {};
  try { assert.deepEqual((await readHeldMobPapersSafe(failing, 'u1', TUESDAY)).failed, true); } finally { console.warn = warn; }
  const load = openAttemptLoader(async (id) => (id === 'att_mob' ? mobAttempt() : ordinary), () => TUESDAY);
  assert.equal(await load('att_mob'), null, 'repair, check it held and Ask Mobi about a question cannot open it');
  assert.equal((await load('att_plain')).id, 'att_plain');
  assert.equal((await openAttemptLoader(async () => mobAttempt(), () => OPENS)('att_mob')).id, 'att_mob', 'after the close they can');
});

test('the per-answer check never runs on a Mob paper', () => {
  assert.equal(checkAllowed({ mode: 'quick', selection_meta: { learningPurpose: 'ordinary_practice' } }), true);
  assert.equal(checkAllowed({ mode: 'quick', selection_meta: { learningPurpose: 'ordinary_practice', mobPaper: { mobId: 'm1', weekStart: WEEK } } }), false);
});

test('Review lists a held paper with its marks and when it opens, and none of its questions as mistakes', () => {
  const details = [{ qid: 'q1', isCorrect: true, givenIndex: 1 }, { qid: 'q2', isCorrect: false, givenIndex: 0 }];
  const slim = [
    { id: 'att_mob', subject: 'accountancy', correct: 1, wrong: 1, unattempted: 0, total: 2, completed_at: new Date(TUESDAY).toISOString(), mode: 'quick', mobPaper: { mobId: 'm1', weekStart: WEEK } },
  ];
  const heavy = new Map([['att_mob', { questions_snapshot: snapshot, details }]]);
  const open = buildReviewRecord({ userId: 'u1', slim, heavy, now: TUESDAY });
  assert.equal(open.items.length, 0, 'no mistake of a held paper');
  assert.deepEqual(open.papers[0].held, { until: nextOpensAt(WEEK), line: 'The answers open on Sunday 25 Oct, 11:59 PM.' });
  assert.deepEqual([open.papers[0].right, open.papers[0].wrong, open.papers[0].score], [1, 1, 4], 'the marks stay');
  const closed = buildReviewRecord({ userId: 'u1', slim, heavy, now: OPENS });
  assert.deepEqual(closed.items.map((i) => i.qid), ['q2'], 'after the close the miss is a mistake to fix');
  assert.equal(closed.papers[0].held, undefined);
});

test('every path that can show a key goes through the hold (route sources)', () => {
  const sessions = src('src/app/api/sessions/route.js');
  assert.match(sessions, /funnelKind === 'finish' \? attemptForClient\(result\) : result/, 'both finish paths answer with the held view');
  const detail = src('src/app/api/attempts/[id]/route.js');
  assert.ok(detail.indexOf('const hold = attemptHold(attempt);') > 0 && detail.indexOf('const hold = attemptHold(attempt);') < detail.indexOf('readAnswerReviews(attempt)'), 'held before any review, history, Lab or SWOT is built');
  const list = src('src/app/api/attempts/route.js');
  assert.match(list, /readHeldMobPapersSafe\(supabaseAdmin\(\), session\.user\.id/);
  assert.match(list, /attempts\.map\(\(a\) => attemptForClient\(a\)\)/);
  assert.match(src('src/services/recovery/mistakeRepair.js'), /loadAttempt: openAttemptLoader\(/);
  assert.match(src('src/services/recovery/repairCheckDeps.js'), /loadAttempt: openAttemptLoader\(/, 'check it held and Ask Mobi about a question');
  assert.match(src('src/app/api/recovery/replay/route.js'), /isHeld\(attempt\)/);
  for (const p of ['src/app/api/me/traps/route.js', 'src/app/api/me/rules/route.js', 'src/app/api/me/playbook/route.js', 'src/app/api/ai/mentor/chat/route.js', 'src/services/ai/getStudentAIContext.js']) {
    assert.match(src(p), /openAttemptsOnly\(/, p);
  }
  const revise = src('src/lib/server/revise.js');
  assert.match(revise, /usable: \(qid\) => !held\.has\(qid\)/, 'not seeded');
  assert.match(revise, /cards\.filter\(\(c\) => !held\.has\(c\.question_id\)\)/, 'not asked');
  assert.match(revise, /qids\.has\(questionId\)/, 'not graded');
  assert.match(src('src/lib/server/review.js'), /mobPaper:selection_meta->mobPaper/);
  assert.match(src('src/lib/server/practiceSessions.js'), /holdUntil: mobPaper\.holdUntil/, 'the stamp reaches selection_meta');
  const mob = src('src/lib/server/mob/service.js');
  assert.match(mob, /holdUntil: holdStamp\(\{ weekStart: state\.week \}\)/);
  assert.match(mob, /holdUntil: holdStamp\(\{ extraClosesAt: extra\.closes_at \}\)/);
  assert.match(mob, /trap: unlocked && !weekHeld \? trap : null/);
  assert.match(mob, /hold \? heldCompare\(out, hold\) : out/);
  const page = src('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.ok(page.includes('if (attempt?.mobHold && !error) return <HeldResult'), 'the website shows the held result before anything that reads the questions');
  assert.ok(page.indexOf('<HeldResult') < page.indexOf('if (!attempt || !analysis) return <ResultSkeleton />;'));
});
