// Today, pass 1017 (docs/design-decisions/pass-1017/TODAY-1017.md): the road arithmetic, the Up next move, the week
// caption, and the road's account columns (migration, undo, feature detection).
// Run: node --test data/tests/today_1017.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  roadFigures, sessionsUntil, suggestedMockTarget, stripColumns, boardsSpan, snapExamDay, parseRoadInput, roadOut, validOwnDate, cuetYear, mondayOf,
} from '../../src/lib/today/road.mjs';
import { buildMove, alternatives, openMistakes, repairMinutes, firstWeekDay, clock } from '../../src/lib/today/move.mjs';
import { weekMarks, weekCaption, dayList } from '../../src/lib/today/week.mjs';

const TODAY = '2026-10-17'; // a Saturday
const NOW = Date.parse('2026-10-17T15:00:00Z'); // 8:30 PM IST

test('road: the design doc figures for 17 Oct 2026 (28 weeks, 98 study days at 4, 14 mocks suggested with 7 taken)', () => {
  const r = roadFigures({ today: TODAY, plan: {}, goal: 4, taken: 7 });
  assert.equal(r.exam, '2027-05-01');
  assert.equal(r.own, false);
  assert.equal(r.weeks, 28);
  assert.equal(r.studyDays, 98);
  assert.equal(r.suggested, 14);
  assert.equal(r.phase, 'weeks');
  assert.equal(cuetYear('2027-05-02'), 2028);
});

test('road: an own date moves the count; a date past 30 June or before tomorrow is not believed', () => {
  assert.equal(roadFigures({ today: TODAY, plan: { examDate: '2027-05-08' }, goal: 4 }).weeks, 29);
  assert.equal(validOwnDate('2027-07-01', TODAY), null);
  assert.equal(validOwnDate(TODAY, TODAY), null);
  assert.equal(validOwnDate('2027-06-30', TODAY), '2027-06-30');
  assert.equal(roadFigures({ today: TODAY, plan: { examDate: '2027-07-09' }, goal: 4 }).exam, '2027-05-01');
});

test('road: sessions use board weeks at 2 and never exceed the goal', () => {
  assert.equal(sessionsUntil(TODAY, '2027-05-01', 1), 28);
  assert.equal(sessionsUntil(TODAY, '2027-05-01', 2), 56);
  assert.equal(sessionsUntil(TODAY, TODAY, 4), 0);
  assert.equal(suggestedMockTarget({ weeks: 4, taken: 0 }), 5);
  assert.equal(suggestedMockTarget({ weeks: 28, taken: 20 }), 21);
  assert.equal(suggestedMockTarget({ weeks: 400, taken: 0 }), 60);
});

test('road strip: one column a week from this Monday to the exam week, months named once, boards and registration marked', () => {
  const cols = stripColumns({ today: TODAY, exam: '2027-05-01', goal: 4, counted: 3 });
  assert.equal(cols[0].key, mondayOf(TODAY));
  assert.equal(cols[0].key, '2026-10-12');
  assert.equal(cols.at(-1).key, '2027-04-26');
  assert.equal(cols.length, 29);
  assert.equal(cols[0].counted, 3);
  assert.ok(cols.slice(1).every((c) => c.counted === 0));
  assert.equal(cols.filter((c) => c.registration).length, 1);
  const span = boardsSpan(cols);
  assert.ok(span && cols[span.first].key >= '2027-02-15' && cols[span.last].key < '2027-04-05');
  assert.ok(cols.filter((c) => c.boards).every((c) => c.planned === 2));
  assert.equal(cols.filter((c) => c.month === 'Jan').length, 1);
  const days = stripColumns({ today: '2027-04-20', exam: '2027-05-01', goal: 4, daysMode: true });
  assert.equal(days.length, 12);
  assert.equal(days.at(-1).exam, true);
});

test('road: a dragged date snaps to 1 May within two days and stays inside tomorrow to 30 June', () => {
  assert.equal(snapExamDay('2027-05-02', TODAY), '2027-05-01');
  assert.equal(snapExamDay('2027-05-08', TODAY), '2027-05-08');
  assert.equal(snapExamDay('2026-10-01', TODAY), '2026-10-18');
  assert.equal(snapExamDay('2027-09-01', TODAY), '2027-06-30');
});

test('road input: only sent fields, bounded, nulls clear', () => {
  assert.deepEqual(parseRoadInput({ examDate: '2027-05-08' }, TODAY), { ok: true, patch: { exam_date: '2027-05-08' } });
  assert.deepEqual(parseRoadInput({ mockTarget: 14, examDate: null }, TODAY), { ok: true, patch: { exam_date: null, mock_target: 14 } });
  for (const bad of [null, [], {}, { examDate: '2027-02-30' }, { examDate: '2027-07-01' }, { mockTarget: 0 }, { mockTarget: 61 }, { mockTarget: 1.5 }, { mockTarget: '14' }]) {
    assert.equal(parseRoadInput(bad, TODAY).ok, false, JSON.stringify(bad));
  }
  assert.deepEqual(roadOut({ exam_date: '2027-05-08', mock_target: 14 }), { examDate: '2027-05-08', mockTarget: 14 });
  assert.deepEqual(roadOut(null), { examDate: null, mockTarget: null });
});

test('road migration: additive, idempotent, service-role only, with an undo outside migrations', () => {
  const up = readFileSync(new URL('../../supabase/migrations/20261017150000_study_road_fields.sql', import.meta.url), 'utf8');
  const undo = readFileSync(new URL('../../supabase/undo/20261017150000_study_road_fields.undo.sql', import.meta.url), 'utf8');
  assert.match(up, /add column if not exists exam_date date;/);
  assert.match(up, /add column if not exists mock_target smallint;/);
  const code = up.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.doesNotMatch(code, /\bgrant\b|\bdrop\b|\bdelete\b|\bupdate public/i);
  assert.match(undo, /drop column if exists exam_date/);
  assert.match(undo, /drop column if exists mock_target/);
});

test('road server: a missing column reads as not on the account, a save is refused, other errors throw', async () => {
  globalThis.__noop = true;
  const src = readFileSync(new URL('../../src/lib/server/studyRoad.js', import.meta.url), 'utf8');
  assert.match(src, /42703/);
  assert.match(src, /PGRST204/);
  assert.match(src, /ROAD_NOT_ON_ACCOUNT/);
});

// ---- Up next ----
const subjectName = (id) => ({ accountancy: 'Accountancy', economics: 'Economics' })[id] || id;
const paper = (over = {}) => ({ id: 'p7', subject: 'accountancy', mode: 'full', correct: 38, wrong: 4, unattempted: 8, total: 50, marks: 186, maxMarks: 250, completedAt: Date.parse('2026-10-11T13:00:00Z'), ...over });
const rhythm = (over = {}) => ({ weekStart: '2026-10-12', studyDays: 3, studyDayDates: ['2026-10-12', '2026-10-13', '2026-10-15'], daysGoal: 4, metThisWeek: false, paused: false, returning: false, daysSinceLastActivity: 2, counts: { sessions: 9, repairs: 3 }, milestones: [{ id: 'first_scored_session', achievedAt: '2026-09-01T10:00:00Z' }], lastClosedWeek: null, ...over });
const plan = (over = {}) => ({ primary: { kind: 'ordinary_practice', title: 'Start 10 practice questions', href: '/dashboard?mode=quick&count=10', reason: 'x', facts: [] }, alternatives: [], minutes: 10, tonight: { state: 'ready' }, ...over });
const facts = (over = {}) => ({ sessions: 9, mocks: 7, timedMocks: 3, subject: 'accountancy', ...over });
const base = (over = {}) => ({ plan: plan(), papers: [paper(), paper({ id: 'p6' }), paper({ id: 'p5' })], rhythm: rhythm(), revise: { due: 0 }, facts: facts(), repaired: new Map(), subjectName, now: NOW, ...over });

test('move: day one is 10 questions to a starting point with Mobi, never a review of mistakes that do not exist', () => {
  const m = buildMove(base({ papers: [], facts: facts({ sessions: 0, mocks: 0 }), rhythm: rhythm({ counts: { sessions: 0, repairs: 0 }, studyDays: 0, milestones: [] }), firstSubject: 'accountancy' }));
  assert.equal(m.id, 'dayOne');
  assert.equal(m.number, 10);
  assert.equal(m.label, 'questions to your starting point');
  assert.match(m.why, /Ten CUET-style Accountancy questions, marked \+5 and −1/);
  assert.equal(m.art, 'mobi');
  assert.equal(m.pills.second, 'mock');
  assert.equal(m.key.label, 'Start now');
});

test('move: open mistakes on the newest paper are the move, with the paper and its date as the reason', () => {
  const m = buildMove(base());
  assert.equal(m.id, 'repair');
  assert.equal(m.number, 4);
  assert.equal(m.label, 'mistakes to repair');
  assert.match(m.why, /All four are from your Accountancy full mock on 11 Oct\./);
  assert.equal(m.key.minutes, 15);
  assert.equal(m.key.href, '/result/p7');
});

test('move: repaired mistakes are never offered again (F17)', () => {
  const m = buildMove(base({ repaired: new Map([['p7', 3]]) }));
  assert.equal(m.number, 1);
  assert.match(m.why, /1 open mistake from/);
  const none = buildMove(base({ repaired: new Map([['p7', 4]]) }));
  assert.equal(none.id, 'practice');
});

test('move: a first paper with mistakes and no Repair yet introduces Repair (first week, day 1)', () => {
  const r = rhythm({ counts: { sessions: 1, repairs: 0 }, milestones: [{ id: 'first_scored_session', achievedAt: '2026-10-17T10:00:00Z' }] });
  const m = buildMove(base({ papers: [paper()], rhythm: r, facts: facts({ sessions: 1, mocks: 1 }) }));
  assert.equal(m.id, 'firstRepair');
  assert.equal(m.overline, 'Day 1 of your first week');
  assert.match(m.why, /Repair shows why your answer went wrong/);
  assert.match(m.why, /From your one paper so far\.$/);
  assert.equal(m.pills.second, 'mock');
  const quick = buildMove(base({ papers: [paper({ mode: 'quick' })], rhythm: r, facts: facts({ sessions: 1, mocks: 0 }) }));
  assert.match(quick.why, /From your one paper so far; a full mock gives a fuller picture\.$/);
});

test('move: Revise due comes before ordinary repair once a repair has been made (Keep)', () => {
  const m = buildMove(base({ revise: { due: 6 } }));
  assert.equal(m.id, 'revise');
  assert.equal(m.number, 6);
  assert.equal(m.key.href, '/review/revise');
});

test('move: returning after 7 days starts with the 3 open mistakes, says how many are open, and greets', () => {
  const m = buildMove(base({ rhythm: rhythm({ daysSinceLastActivity: 8, returning: true }), papers: [paper({ wrong: 6, completedAt: Date.parse('2026-10-09T13:00:00Z') }), paper({ id: 'p6' }), paper({ id: 'p5' })] }));
  assert.equal(m.id, 'returning');
  assert.equal(m.number, 3);
  assert.equal(m.label, 'mistakes to repair first');
  assert.match(m.why, /Your last paper was your Accountancy full mock on 9 Oct\. Its six open mistakes are still here; start with three\./);
  assert.equal(m.key.minutes, 10);
  assert.equal(m.link.label, 'See all 6');
  assert.equal(m.art, 'mobi');
  const warm = buildMove(base({ rhythm: rhythm({ daysSinceLastActivity: 9 }), repaired: new Map([['p7', 4]]) }));
  assert.equal(warm.label, 'questions to warm up');
});

test('move: no timed mock after 3 sessions makes the first full mock the move (first week, days 5 to 7)', () => {
  const m = buildMove(base({ repaired: new Map([['p7', 4]]), facts: facts({ mocks: 0, timedMocks: 0, sessions: 4 }) }));
  assert.equal(m.id, 'firstMock');
  assert.equal(m.number, 50);
  assert.equal(m.label, 'questions in 60 minutes');
});

test('move: smart practice only for Pro in the first week; free accounts get aimed practice', () => {
  const week = rhythm({ counts: { sessions: 2, repairs: 1 }, milestones: [{ id: 'first_scored_session', achievedAt: '2026-10-14T10:00:00Z' }] });
  const input = base({ papers: [paper({ wrong: 0 }), paper({ id: 'p6' })], rhythm: week, facts: facts({ sessions: 2, mocks: 0, timedMocks: 0 }) });
  assert.equal(buildMove({ ...input, premium: true }).id, 'smart');
  assert.equal(buildMove({ ...input, premium: true }).overline, 'Day 4 of your first week');
  assert.equal(buildMove(input).id, 'practice');
});

test('move: done for today previews tomorrow and keeps one key', () => {
  const m = buildMove(base({ repaired: new Map([['p7', 4]]), plan: plan({ tonight: { state: 'recorded', sessionId: 's1', minutes: 20, completedAt: '2026-10-17T15:11:00Z', reviewMinutes: 0 } }) }));
  assert.equal(m.id, 'done');
  assert.equal(m.overline, 'Done for today');
  assert.match(m.why, /Saved at 8:41 PM\./);
  assert.equal(m.key.label, 'Practise more');
  assert.equal(m.key.href, '/dashboard?mode=quick&count=10');
  assert.equal(m.pills.second, 'open');
  assert.equal(m.pills.openHref, '/result/s1');
});

test('move: unknown is never zero; a failed plan with nothing known is the failed state; resume wins', () => {
  assert.equal(buildMove(base({ facts: null, rhythm: null, papers: null })), null);
  assert.deepEqual(buildMove(base({ plan: null, planFailed: true, facts: null, rhythm: null, papers: null })), { id: 'failed' });
  assert.equal(buildMove(base({ plan: plan({ primary: { kind: 'resume_session', title: 'Resume your practice', href: '/test?x=1' } }) })).id, 'resume');
});

test('move: ordinary practice names the chapter with the most marks open, from the record', () => {
  const m = buildMove(base({ repaired: new Map([['p7', 4]]), top: { subject: 'accountancy', chapter: 'Partnership Fundamentals', open: 30, sessions: 3 } }));
  assert.equal(m.id, 'practice');
  assert.equal(m.label, 'questions on Partnership Fundamentals');
  assert.match(m.why, /30 marks open in your record, over 3 sessions/);
  assert.match(m.key.href, /chapter=Partnership\+Fundamentals/);
});

test('move helpers', () => {
  assert.equal(openMistakes(paper(), new Map([['p7', 9]])), 0);
  assert.equal(openMistakes(null), null);
  assert.deepEqual([2, 3, 4, 6].map(repairMinutes), [10, 10, 15, 20]);
  assert.equal(firstWeekDay('2026-10-17T02:00:00Z', NOW), 1);
  assert.equal(firstWeekDay('2026-10-01T02:00:00Z', NOW), null);
  assert.equal(clock('2026-10-17T15:11:00Z'), '8:41 PM');
});

test('alternatives: each with a reason, never the move itself, the Mob only while unsat', () => {
  const move = buildMove(base());
  const alts = alternatives({ move, papers: base().papers, revise: { due: 2 }, facts: facts(), repaired: new Map(), mobUnsat: true, subjectName });
  assert.ok(alts.every((a) => a.title && a.reason && a.href));
  assert.ok(!alts.some((a) => a.id === 'repair'), 'the repair is the move');
  assert.ok(alts.some((a) => a.id === 'nta') && alts.some((a) => a.id === 'mob') && alts.some((a) => a.id === 'revise'));
  assert.ok(!alternatives({ move, papers: [], subjectName }).some((a) => a.id === 'mob'));
});

// ---- This week ----
test('week: 3 of 4 with Sat planned reads "Tonight makes 4."; misses are never drawn as misses', () => {
  const r = rhythm();
  const marks = weekMarks({ rhythm: r, today: TODAY, weekdays: [0, 1, 3, 5], firstDay: '2026-09-01' });
  assert.deepEqual(marks.map((m) => m.state), ['counted', 'counted', 'rest', 'counted', 'rest', 'planned', 'rest']);
  assert.equal(marks[5].today, true);
  const c = weekCaption({ rhythm: r, marks, today: TODAY, everSessions: 9 });
  assert.equal(`${c.text} ${c.strong}`, 'Mon, Tue and Thu counted. Tonight makes 4.');
});

test('week: day one, goal met, returning, Monday after a week, paused', () => {
  const fresh = rhythm({ studyDays: 0, studyDayDates: [], counts: { sessions: 0, repairs: 0 }, milestones: [] });
  const freshMarks = weekMarks({ rhythm: fresh, today: TODAY, firstDay: TODAY });
  assert.equal(freshMarks.filter((m) => m.state === 'before').length, 5);
  assert.equal(weekCaption({ rhythm: fresh, marks: freshMarks, today: TODAY, everSessions: 0 }).strong, 'Tonight counts.');
  const met = rhythm({ studyDays: 4, metThisWeek: true, studyDayDates: ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-17'] });
  const metC = weekCaption({ rhythm: met, marks: weekMarks({ rhythm: met, today: TODAY }), today: TODAY, everSessions: 9 });
  assert.equal(metC.text, 'Goal met: 4 of 4 study days.');
  assert.equal(metC.met, true);
  const back = rhythm({ studyDays: 0, studyDayDates: [], returning: true });
  assert.equal(weekCaption({ rhythm: back, marks: weekMarks({ rhythm: back, today: TODAY }), today: TODAY, everSessions: 9 }).text, 'A new week.');
  const monday = rhythm({ studyDays: 0, studyDayDates: [], weekStart: '2026-10-19', lastClosedWeek: { id: '2026-10-12', studyDays: 4, goal: 4, met: true } });
  assert.equal(weekCaption({ rhythm: monday, marks: weekMarks({ rhythm: monday, today: '2026-10-19' }), today: '2026-10-19', everSessions: 9 }).text, 'Last week: 4 of 4.');
  assert.equal(weekCaption({ rhythm: rhythm({ paused: true }), marks: [], today: TODAY, pausedUntil: '2026-10-18' }).text, 'Paused until Sun 18 Oct.');
  assert.equal(dayList(['Mon']), 'Mon');
});

// ---- Greeting and length ----
import { greeting, greetName } from '../../src/lib/today/greeting.mjs';
import { fitMove } from '../../src/lib/today/move.mjs';

test('greeting: time of day, welcome back, and never a handle (acceptance 11)', () => {
  assert.equal(greeting({ hour: 9, name: 'Asha Rao' }), 'Good morning, Asha');
  assert.equal(greeting({ hour: 14, name: 'Asha' }), 'Good afternoon, Asha');
  assert.equal(greeting({ hour: 0, name: 'Asha' }), 'Good evening, Asha');
  assert.equal(greeting({ hour: 20, name: 'Asha', returning: true }), 'Welcome back, Asha');
  assert.equal(greeting({ hour: 0, name: 'app-e2e-student' }), 'Good evening');
  assert.equal(greetName('asha', 'asha@example.com'), '');
  assert.equal(greetName('Student42'), '');
});

test('change length: practice sets its count, a repair takes as many as fit, never more than are open', () => {
  const practice = buildMove(base({ repaired: new Map([['p7', 4]]) }));
  assert.equal(fitMove(practice, 20).number, 20);
  assert.equal(fitMove(practice, 20).key.label, 'Start 20 questions');
  assert.match(fitMove(practice, 20).key.href, /count=20/);
  assert.equal(fitMove(practice, 30).review, 10);
  const repair = buildMove(base({ papers: [paper({ wrong: 8 }), paper({ id: 'p6' }), paper({ id: 'p5' })] }));
  assert.equal(repair.number, 8);
  assert.equal(fitMove(repair, 10).number, 3);
  assert.equal(fitMove(repair, 10).label, 'mistakes to repair first');
  assert.equal(fitMove(repair, 30).number, 8);
  assert.equal(fitMove(repair, 30).key.minutes, 30);
});
