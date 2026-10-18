// Today, pass 1018 (docs/design-decisions/pass-1018/TODAY-1018.md, owner yes 18 Oct 3:30 am with D26): the lead card's
// stake and two choices, the tappable week's day readout, the weak chapters' recent misses, and Road to CUET in three
// layers (due today, due this week, the overall goal).
// Run: node --test data/tests/today_1018.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMove } from '../../src/lib/today/move.mjs';
import { leadOf, choiceMoves, pickChoices, kindOf, stakeOf, paperWhen, refit, pickKey } from '../../src/lib/today/lead.mjs';
import { fitMove } from '../../src/lib/today/move.mjs';
import { dayReadout, weekMarks, longDay } from '../../src/lib/today/week.mjs';
import { roadLayers, roadFigures, weekMockShare } from '../../src/lib/today/road.mjs';
import { computePrepOSInsights, recentMisses } from '../../data/prepos_insights.js';

const NOW = Date.parse('2026-10-18T14:10:00Z'); // Sunday 18 Oct 2026, 7:40 PM IST
const TODAY = '2026-10-18';
const DAY = 86400000;
const name = (id) => ({ accountancy: 'Accountancy', economics: 'Economics', business_studies: 'Business Studies', english: 'English' }[id] || id);
const paper = (id, over = {}) => ({ id, subject: 'accountancy', mode: 'full', correct: 27, wrong: 11, unattempted: 12, total: 50, marks: 124, maxMarks: 250, completedAt: NOW - DAY + 3600000, formatId: 'full:acc', ...over });
const top = { subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Admission of a partner', open: 45, wrong: 6, skip: 3, n: 21, sessions: 4 };
const rhythm = { weekStart: '2026-10-12', studyDayDates: ['2026-10-12', '2026-10-15', '2026-10-17'], studyDays: 3, daysGoal: 4, mocksThisWeek: 1, counts: { sessions: 9, repairs: 3 }, milestones: [], daysSinceLastActivity: 1, timeZone: 'Asia/Kolkata' };

test('lead: a repair move carries its title, kind and stake (6 marks a mistake, the record\'s arithmetic)', () => {
  const move = leadOf(buildMove({ plan: {}, papers: [paper('p9')], rhythm, revise: { due: 0 }, facts: { sessions: 9, mocks: 3 }, repaired: new Map([['p9', 7]]), top, subjectName: name, now: NOW }), { now: NOW });
  assert.equal(move.id, 'repair');
  assert.equal(move.title, 'Repair your last paper');
  assert.equal(move.kind, 'repair');
  assert.equal(move.number, 4);
  assert.deepEqual(move.stake, { value: 24, word: 'marks they cost you' });
  assert.deepEqual(move.choice, { title: 'Repair a mistake', value: '4 open from yesterday' });
  // A shorter length keeps the stake honest.
  const short = refit(fitMove(move, 10));
  assert.equal(short.number, 3);
  assert.equal(short.stake.value, 18);
});

test('lead: Revise counts 6 a mistake "then"; a chapter counts its open marks over its papers; others have none', () => {
  assert.deepEqual(stakeOf({ id: 'revise', number: 6 }), { value: 36, word: 'marks they cost you then' });
  assert.deepEqual(stakeOf({ id: 'weakest', number: 15, chapterOpen: 45, chapterSessions: 4 }), { value: 45, word: 'marks open there, over 4 papers' });
  assert.equal(stakeOf({ id: 'dayOne', number: 10 }), null);
  assert.equal(stakeOf({ id: 'mock', number: 50 }), null);
});

test('choices: two of a different kind from the lead, in the order Repair, Revise, weakest, mock, another', () => {
  const pool = choiceMoves({ papers: [paper('p9')], revise: { due: 6 }, facts: { mocks: 3 }, repaired: new Map([['p9', 7]]), top, subjectName: name, subjects: ['accountancy', 'economics', 'business_studies'], now: NOW });
  assert.deepEqual(pool.map((m) => m.id), ['repair', 'revise', 'weakest', 'another']); // a mock yesterday: no mock offered
  const lead = { id: 'repair', open: 4, number: 4 };
  const two = pickChoices(lead, pool);
  assert.deepEqual(two.map((m) => m.id), ['revise', 'weakest']);
  assert.deepEqual(two[0].choice, { title: 'Revise what is due', value: '6 due, about 10 min' });
  assert.deepEqual(two[1].choice, { title: 'Practise your weakest', value: 'Admission of a partner' });
  assert.equal(two[1].title, 'Practise your weakest chapter');
  assert.match(two[1].key.href, /chapter=Admission\+of\+a\+partner/);
});

test('choices: day one offers a full mock and another subject; a pick keeps the suggestion one tap away', () => {
  const pool = choiceMoves({ papers: [], revise: null, facts: { sessions: 0, mocks: 0 }, subjectName: name, subjects: ['accountancy', 'business_studies', 'economics', 'english'], firstSubject: 'accountancy', now: NOW });
  const rec = leadOf({ id: 'dayOne', number: 10, label: 'questions to your starting point', key: { minutes: 10 } }, { now: NOW });
  const two = pickChoices(rec, pool);
  assert.deepEqual(two.map((m) => m.id), ['mock', 'another']);
  assert.deepEqual(two[0].choice, { title: 'Full mock instead', value: '50 questions, 60 min' });
  assert.equal(two[1].choice.value, 'Business Studies, Economics, English');
  // The student picks the mock: the suggested move comes first in the pool and is offered, then the next kind.
  const picked = two[0];
  const again = pickChoices(picked, [{ ...rec, suggested: true }, ...pool]);
  assert.deepEqual(again.map((m) => m.id), ['dayOne', 'another']);
  assert.equal(again[0].suggested, true);
  assert.equal(pickKey('2026-10-18'), 'mm:today-pick:v1:2026-10-18');
});

test('choices: two moves of one kind are never side by side, and the lead is never its own choice', () => {
  const lead = { id: 'practice', chapter: 'X', number: 10 };
  const two = pickChoices(lead, [{ id: 'weakest' }, { id: 'smart' }, { id: 'revise' }, { id: 'mock' }]);
  assert.deepEqual(two.map((m) => m.id), ['revise', 'mock']);
  assert.equal(kindOf({ id: 'returning', open: 3 }), 'repair');
  assert.equal(kindOf({ id: 'returning' }), 'start');
  assert.deepEqual(pickChoices({ id: 'failed' }, [{ id: 'revise' }]), []);
});

test('paper when: today, yesterday, a weekday within the week, else the date', () => {
  assert.equal(paperWhen(NOW - 3600000, NOW), 'today');
  assert.equal(paperWhen(NOW - DAY, NOW), 'yesterday');
  assert.equal(paperWhen(NOW - 3 * DAY, NOW), 'Thursday');
  assert.equal(paperWhen(NOW - 15 * DAY, NOW), '3 Oct');
});

test('week: a tapped day reads what was saved, today reads the lead, a planned day and a rest day say so kindly', () => {
  const key = (at) => new Date((typeof at === 'number' ? at : Date.parse(at)) + 19800000).toISOString().slice(0, 10);
  const clk = () => '6:20 PM';
  const marks = weekMarks({ rhythm, today: TODAY, weekdays: [0, 2, 5, 6], firstDay: '2026-09-01' });
  const thu = dayReadout({ mark: marks[3], index: 3, papers: [paper('p8', { subject: 'economics', mode: 'quick', total: 15, marks: 41, maxMarks: 75, completedAt: Date.parse('2026-10-15T12:50:00Z') })], repairs: [], dayKey: key, clockOf: clk, subjectName: name, today: TODAY, goal: 4 });
  assert.equal(thu.title, 'Thursday 15 Oct');
  assert.deepEqual(thu.lines, [{ text: 'Economics practice, 15 questions, 41 of 75', at: '6:20 PM' }]);
  const sun = dayReadout({ mark: marks[6], index: 6, papers: [], repairs: [], dayKey: key, clockOf: clk, move: { id: 'weakest', title: 'Practise your weakest chapter', key: { minutes: 15 } }, today: TODAY, goal: 4 });
  assert.equal(sun.title, 'Today, Sunday 18 Oct, planned');
  assert.equal(sun.note, 'Nothing saved yet today.', 'release 10: the lead card says what is next; the readout says what the day holds');
  const wed = dayReadout({ mark: marks[2], index: 2, papers: [], repairs: [], dayKey: key, today: TODAY, goal: 4 });
  assert.equal(wed.note, 'No session saved that day. The week still counts any 4 days.');
  const tue = dayReadout({ mark: marks[1], index: 1, papers: [], repairs: [], dayKey: key, today: TODAY, goal: 4 });
  assert.equal(tue.note, 'A rest day in your plan. Anything you practise still counts.');
  const failed = dayReadout({ mark: marks[6], index: 6, papers: [], repairs: [], dayKey: key, failed: true, today: TODAY });
  assert.equal(failed.note, 'Your move shows here once it loads.');
  const reps = dayReadout({ mark: marks[5], index: 5, papers: [], repairs: [{ repairedAt: '2026-10-17T15:00:00Z' }, { repairedAt: '2026-10-17T15:10:00Z' }], dayKey: key, clockOf: clk, today: TODAY });
  assert.deepEqual(reps.lines, [{ text: 'Repair, 2 mistakes', at: '6:20 PM' }]);
  assert.equal(longDay('2026-10-12', 0), 'Monday 12 Oct');
});

test('weak chapters: each ranked chapter carries up to 3 recent misses, newest paper first, wrong before blank', () => {
  const misses = [
    { attemptId: 'a', qid: 'a1', position: 4, completedAt: 1, outcome: 'wrong' },
    { attemptId: 'b', qid: 'b9', position: 9, completedAt: 2, outcome: 'skip' },
    { attemptId: 'b', qid: 'b3', position: 3, completedAt: 2, outcome: 'wrong' },
    { attemptId: 'b', qid: 'b7', position: 7, completedAt: 2, outcome: 'wrong' },
  ];
  assert.deepEqual(recentMisses(misses).map((m) => m.qid), ['b3', 'b7', 'b9']);
  const attempt = (id, at, outcomes) => ({ id, subject: 'accountancy', completedAt: at, questionsSnapshot: outcomes.map((_, i) => ({ id: `${id}-${i}`, chapter: 'Goodwill' })), details: outcomes.map((o, i) => ({ qid: `${id}-${i}`, isCorrect: o === 'r' ? true : o === 'w' ? false : null })) });
  const i = computePrepOSInsights([attempt('p1', 1000, ['r', 'w', 'b']), attempt('p2', 2000, ['w', 'r', 'r'])], { now: 3000 });
  const ch = i.chapters.ranked[0];
  assert.equal(ch.chapter, 'Goodwill');
  assert.deepEqual(ch.recent.map((m) => [m.attemptId, m.position, m.outcome]), [['p2', 1, 'wrong'], ['p1', 2, 'wrong'], ['p1', 3, 'skip']]);
});

test('road layers: due today, due this week and the goal, each a count with its denominator', () => {
  const fig = roadFigures({ today: TODAY, plan: {}, goal: 4, taken: 3 });
  const r = roadLayers({ today: TODAY, rhythm, weekdays: [0, 2, 5, 6], revise: { due: 6, answeredToday: 0 }, move: { id: 'repair', title: 'Repair your last paper', key: { minutes: 12, href: '/result/p9' } }, fig, target: 14, taken: 3, lastMockDay: '2026-10-17' });
  assert.equal(r.today.done, 0);
  assert.equal(r.today.total, 2);
  assert.equal(r.today.left, 'Left: repair your last paper, about 12 min, and 6 Revise questions.');
  assert.deepEqual(r.week.items, [{ id: 'days', title: 'Study days', done: 3, total: 4 }, { id: 'mocks', title: 'Full mock', done: 1, total: 1 }]);
  assert.equal(r.week.done, 4);
  assert.equal(r.week.total, 5);
  assert.equal(r.week.line, 'Today is the last day of this week.');
  assert.equal(r.goal.count, 27);
  assert.equal(r.goal.unit, 'weeks');
  assert.equal(r.goal.studyDays, 94);
  assert.equal(r.goal.pace.strong, 'about one a fortnight gets you there.');
  assert.equal(r.goal.next.when, 'in 15 weeks');
});

test('road layers: a rest day has nothing due; a saved session counts; Revise counts what was asked today', () => {
  const fig = roadFigures({ today: '2026-10-13', plan: {}, goal: 4, taken: 3 });
  const rest = roadLayers({ today: '2026-10-13', rhythm: { ...rhythm, studyDayDates: ['2026-10-12'], studyDays: 1 }, weekdays: [0, 2, 5, 6], revise: { due: 0, answeredToday: 0 }, fig, target: 14, taken: 3 });
  assert.equal(rest.today.rest, true);
  assert.equal(rest.today.total, 0);
  assert.equal(rest.today.left, 'A rest day in your plan. Anything you practise still counts.');
  const done = roadLayers({ today: '2026-10-12', rhythm: { ...rhythm, studyDayDates: ['2026-10-12'], studyDays: 1 }, weekdays: [0, 2, 5, 6], revise: { due: 0, answeredToday: 6 }, fig, target: 14, taken: 3 });
  assert.equal(done.today.done, 2);
  assert.equal(done.today.total, 2);
  assert.equal(done.today.items[1].detail, '6 of 6 questions');
  assert.equal(done.today.left, 'Everything due today is done.');
  assert.equal(roadLayers({ today: TODAY, rhythm: null, fig }), null);
  // Day one: today is the first day of the plan even on a planned rest day, and no full mock is asked of the week.
  const first = roadLayers({ today: '2026-10-13', rhythm: { ...rhythm, studyDayDates: [], studyDays: 0 }, weekdays: [0, 2, 5, 6], revise: null, move: { id: 'dayOne', title: 'Find your starting point', key: { minutes: 10 } }, fig, target: 14, taken: 0, firstDay: true });
  assert.equal(first.today.total, 1);
  assert.equal(first.today.left, 'Left: find your starting point, about 10 min.');
  assert.deepEqual(first.week.items.map((i) => i.id), ['days']);
});

test('road layers: the week\'s share of the mock target, one a fortnight, never a debt', () => {
  // 11 left over 28 weeks is one every 3 weeks: due when the last mock was 3 or more weeks ago.
  assert.deepEqual(weekMockShare({ target: 14, taken: 3, thisWeek: 0, weeks: 27, weekStart: '2026-10-12', lastMockDay: '2026-10-07' }), { planned: 0, nextWeek: '2026-10-26' });
  assert.deepEqual(weekMockShare({ target: 14, taken: 3, thisWeek: 0, weeks: 27, weekStart: '2026-10-12', lastMockDay: '2026-09-17' }), { planned: 1, nextWeek: null });
  assert.deepEqual(weekMockShare({ target: 40, taken: 3, thisWeek: 0, weeks: 27, weekStart: '2026-10-12' }), { planned: 1, nextWeek: null });
  assert.deepEqual(weekMockShare({ target: 60, taken: 0, thisWeek: 0, weeks: 27, weekStart: '2026-10-12' }), { planned: 2, nextWeek: null });
  assert.deepEqual(weekMockShare({ target: 3, taken: 3, thisWeek: 0, weeks: 27, weekStart: '2026-10-12' }), { planned: 0, nextWeek: null });
  assert.deepEqual(weekMockShare({ target: 14, taken: null, weeks: 27 }), { planned: 0, nextWeek: null });
});

test('road layers: with Revise in the lead, today lists a plain study session and Revise once, never Revise twice', () => {
  const fig = roadFigures({ today: '2026-10-13', plan: {}, goal: 4, taken: 3 });
  const r = roadLayers({ today: '2026-10-13', rhythm: { ...rhythm, studyDayDates: [] }, weekdays: [1], revise: { due: 4, answeredToday: 0 }, move: { id: 'revise', title: 'Revise what came back', key: { minutes: 5, href: '/review/revise' } }, fig, target: 14, taken: 3 });
  assert.deepEqual(r.today.items.map((i) => [i.id, i.title, i.href]), [['session', 'A study session', '/dashboard'], ['revise', 'Revise', '/review/revise']]);
  assert.equal(r.today.left, 'Left: a study session, and 4 Revise questions.');
});
