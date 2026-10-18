// Website release 7, the verifier's defects (18 Oct 2026): H1 (Change plan's mock target follows the suggestion until the student picks
// one), M1 (one "Why this?" on the first repair), M2 (focus returns to Change plan's opener), M3 (collapsed weak-chapter links are not
// focusable), M5 (44 px targets), M6 (?q=N rows clear the sticky bar), M7 (a counted day's readout agrees with its mark), L4 (the kept
// length is kept for a day) and L5 (a failed Revise read is unknown, never counted).
// Run: node --test data/tests/today_release7_fixes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMove } from '../../src/lib/today/move.mjs';
import { keepLength, readLength } from '../../src/lib/today/lead.mjs';
import { dayReadout, weekMarks } from '../../src/lib/today/week.mjs';
import { mockChoices, roadFigures, roadLayers, targetFor } from '../../src/lib/today/road.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const NOW = Date.parse('2026-10-18T14:10:00Z');
const TODAY = '2026-10-18';
const DAY = 86400000;

// ---- H1 ---------------------------------------------------------------------------------------------------------------------

test('H1: with no pick, the target follows the suggestion when the date changes (Wed 12 May: 15, not 14)', () => {
  const expected = roadFigures({ today: TODAY, plan: { examDate: null }, goal: 4, taken: 0 });
  const own = roadFigures({ today: TODAY, plan: { examDate: '2027-05-12' }, goal: 4, taken: 0 });
  assert.equal(expected.suggested, 14);
  assert.equal(own.suggested, 15);
  // The sheet's sentence, tile, receipt and the road all read targetFor(held target, figures).
  assert.equal(targetFor(null, expected.suggested), 14);
  assert.equal(targetFor(null, own.suggested), 15, 'the stale 14 is gone');
  // A tile is highlighted for it, so "Your own number" is not.
  assert.ok(mockChoices({ weeks: own.weeks, taken: 0 }).some((c) => c.value === targetFor(null, own.suggested)));
  // The road, which holds no target, shows the same number as the sheet.
  assert.equal(targetFor(undefined, own.suggested), own.suggested);
});

test('H1: a picked target stays, whatever the date does', () => {
  const own = roadFigures({ today: TODAY, plan: { examDate: '2027-05-12' }, goal: 4, taken: 0 });
  assert.equal(targetFor(20, own.suggested), 20);
  assert.equal(targetFor(14, own.suggested), 14, "a held 14 is the student's, not the suggestion");
});

test('H1: Change plan and the road use the one rule, and the flow no longer seeds the target once', () => {
  const flow = read('src/components/today/TodayPlanFlow.jsx');
  const road = read('src/components/today/TodayRoad.jsx');
  assert.doesNotMatch(flow, /useState\(plan\.mockTarget \?\? fig\.suggested\)/);
  assert.match(flow, /const \{ suggested \} = fig;\n  const target = picked \?\? suggested;/);
  assert.match(flow, /useState\(plan\.mockTarget \?\? null\)/);
  assert.match(road, /const target = targetFor\(plan\.mockTarget, fig\.suggested\)/);
});

// ---- M1 ---------------------------------------------------------------------------------------------------------------------

test('M1: the first repair carries no "See why" link; "Why this?" is the only way to ask', () => {
  const rhythm = { weekStart: '2026-10-12', studyDayDates: ['2026-10-17'], studyDays: 1, daysGoal: 4, mocksThisWeek: 0, counts: { sessions: 2, repairs: 0 }, milestones: [], daysSinceLastActivity: 1, timeZone: 'Asia/Kolkata' };
  const papers = [{ id: 'p9', subject: 'accountancy', mode: 'full', correct: 27, wrong: 11, unattempted: 12, total: 50, marks: 124, maxMarks: 250, completedAt: NOW - DAY + 3600000, formatId: 'full:acc' }];
  const m = buildMove({ plan: {}, papers, rhythm, revise: { due: 0 }, facts: { sessions: 2, mocks: 0 }, repaired: new Map(), top: null, subjectName: (id) => id, now: NOW });
  assert.equal(m.id, 'firstRepair');
  assert.equal(m.link, undefined);
});

// ---- M2, M3, M5, M6 ---------------------------------------------------------------------------------------------------------

test('M2: Change plan gives focus back to the button that opened it', () => {
  const road = read('src/components/today/TodayRoad.jsx');
  assert.match(road, /openerRef\.current = event\.currentTarget/);
  assert.match(road, /target\?\.focus\(/);
  assert.equal((road.match(/onClick=\{openFlow\}/g) || []).length, 2, 'the header button and the goal readout button');
});

test('M3: a collapsed weak-chapter row takes its links out of the tab order', () => {
  const css = read('src/components/today/today.css');
  assert.match(css, /\.twk__more:not\(\[data-open\]\) > div \{ visibility: hidden;/);
});

test('M5: every Today hit area named by the verifier is at least 44 px', () => {
  const css = read('src/components/today/today.css');
  assert.match(css, /\.trd__go \{ min-height: 44px/);
  assert.match(css, /\.twk__practise \{[^}]*min-height: 44px !important/);
  assert.match(css, /\.tpf__cal-m button \{ min-height: 44px/);
  assert.match(css, /a\.tm__inline \{ padding-block: 14px; \}/);
  assert.match(css, /\.trd__change \{ min-height: 44px/);
});

test('M6: a row opened by a jump clears the sticky part heading', () => {
  const css = read('src/components/result/result-parts.css');
  assert.match(css, /\.ap-body \.rp-q \{ scroll-margin-top: calc\(var\(--arena-topbar-h, 63px\) \+ 57px/);
});

// ---- M7 ---------------------------------------------------------------------------------------------------------------------

test('M7: a counted past day with nothing listed says it counts, never "No session saved that day"', () => {
  const rhythm = { weekStart: '2026-10-12', studyDayDates: ['2026-10-12', '2026-10-14'], studyDays: 2, daysGoal: 4 };
  const marks = weekMarks({ rhythm, today: TODAY, weekdays: [0, 2, 5, 6], firstDay: '2026-09-01' });
  const key = (at) => new Date((typeof at === 'number' ? at : Date.parse(at)) + 19800000).toISOString().slice(0, 10);
  const wed = dayReadout({ mark: marks[2], index: 2, papers: [], repairs: [], dayKey: key, today: TODAY, goal: 4 });
  assert.equal(marks[2].state, 'counted');
  assert.doesNotMatch(wed.note, /No session saved/);
  assert.equal(wed.note, 'Counted as a study day. The session is not listed here.');
  // A past planned day that was not counted still says so.
  const uncounted = weekMarks({ rhythm: { ...rhythm, studyDayDates: [] }, today: TODAY, weekdays: [0, 2, 5, 6], firstDay: '2026-09-01' });
  const sat = dayReadout({ mark: uncounted[2], index: 2, papers: [], repairs: [], dayKey: key, today: TODAY, goal: 4 });
  assert.match(sat.note, /No session saved that day/);
});

// ---- L4 ---------------------------------------------------------------------------------------------------------------------

test('L4: the kept length carries its day, so "for today" is true', () => {
  assert.equal(keepLength('2026-10-18', 20), '2026-10-18:20');
  assert.equal(readLength('2026-10-18:20', '2026-10-18'), 20);
  assert.equal(readLength('2026-10-18:20', '2026-10-19'), null, 'tomorrow it is gone');
  assert.equal(readLength('20', '2026-10-18'), null, "an old value with no day is not today's");
  assert.equal(readLength('2026-10-18:25', '2026-10-18'), null);
  assert.equal(readLength(null, '2026-10-18'), null);
});

// ---- L5 ---------------------------------------------------------------------------------------------------------------------

test('L5: Revise whose read failed is unknown, listed as unknown, never counted done and never "everything is done"', () => {
  const rhythm = { weekStart: '2026-10-12', studyDayDates: ['2026-10-18'], studyDays: 1, daysGoal: 4, mocksThisWeek: 0 };
  const fig = roadFigures({ today: TODAY, plan: {}, goal: 4, taken: 0 });
  const base = { today: TODAY, rhythm, weekdays: [0, 2, 5, 6], fig, target: 14, taken: 0 };
  const failed = roadLayers({ ...base, revise: null, reviseState: 'failed' }).today;
  assert.equal(failed.done, 1);
  assert.equal(failed.total, 1, 'Revise is not added to the total');
  assert.deepEqual(failed.unknown, [{ id: 'revise', title: 'Revise', detail: 'Did not load' }]);
  assert.doesNotMatch(failed.left, /Everything due today is done/);
  assert.match(failed.left, /Revise did not load/);
  // The same day with the read answered: Revise counts and "done" is true again.
  const ok = roadLayers({ ...base, revise: { due: 0, answeredToday: 3 } }).today;
  assert.equal(ok.total, 2);
  assert.equal(ok.left, 'Everything due today is done.');
  assert.deepEqual(ok.unknown, []);
  // Nothing else due and Revise unknown: not "a rest day, nothing due".
  const bare = roadLayers({ ...base, rhythm: { ...rhythm, studyDayDates: [] }, weekdays: [1], revise: null, reviseState: 'failed' }).today;
  assert.equal(bare.rest, false);
  assert.equal(bare.total, 0);
  assert.equal(bare.unknown.length, 1);
  // Still loading: unknown too, said as checking.
  assert.match(roadLayers({ ...base, revise: null, reviseState: 'loading' }).today.left, /Checking Revise/);
});
