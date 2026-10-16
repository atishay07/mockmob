import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRhythm, localDay, weekStart, goalForWeek, planGoalHistoryWrites, MIN_ANSWERED, BASE_WEEK } from '../../src/lib/server/rhythm.js';

// 2026-10-12 is a Monday. IST = UTC+5:30, so Monday 00:10 IST is Sunday 18:40 UTC.
const ist = (date, hhmm = '12:00') => Date.parse(`${date}T${hhmm}:00+05:30`);
const ids = r => Object.fromEntries(r.milestones.map(m => [m.id, m.achievedAt]));

test('week boundary: Sunday 23:30 IST and Monday 00:10 IST are different weeks', () => {
  const sun = ist('2026-10-11', '23:30');
  const mon = ist('2026-10-12', '00:10');
  assert.equal(localDay(sun), '2026-10-11');
  assert.equal(localDay(mon), '2026-10-12');
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
  assert.equal(weekStart('2026-10-12'), '2026-10-12');
  const now = ist('2026-10-12', '10:00');
  const onlySunday = computeRhythm({ activities: [sun], daysPerWeek: 1, now });
  assert.equal(onlySunday.studyDays, 0);
  assert.equal(onlySunday.metThisWeek, false);
  assert.equal(onlySunday.weeksMetStreak, 1); // last week met the 1-day goal
  const both = computeRhythm({ activities: [sun, mon], daysPerWeek: 1, now });
  assert.equal(both.studyDays, 1);
  assert.deepEqual(both.studyDayDates, ['2026-10-12']);
  assert.equal(both.weeksMetStreak, 2);
});

test('several activities on one day are one study day', () => {
  const r = computeRhythm({ activities: [ist('2026-10-13', '09:00'), ist('2026-10-13', '21:00'), ist('2026-10-14')], daysPerWeek: 3, now: ist('2026-10-15') });
  assert.equal(r.studyDays, 2);
  assert.equal(r.metThisWeek, false);
});

test('streak of 3, a missed week, then current week met', () => {
  const acts = ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-12'].map(d => ist(d));
  const r = computeRhythm({ activities: acts, daysPerWeek: 1, now: ist('2026-10-14') });
  assert.equal(r.metThisWeek, true);
  assert.equal(r.weeksMetStreak, 1);
  assert.equal(r.bestRun, 3);
});

test('current week counts only once met; an unmet current week does not break the run', () => {
  const acts = ['2026-09-28', '2026-10-05'].map(d => ist(d));
  const r = computeRhythm({ activities: acts, daysPerWeek: 1, now: ist('2026-10-14') });
  assert.equal(r.metThisWeek, false);
  assert.equal(r.weeksMetStreak, 2);
  assert.equal(r.bestRun, 2);
});

test('a paused week neither breaks nor extends the run', () => {
  const acts = ['2026-09-21', '2026-09-28'].map(d => ist(d));
  const base = { activities: acts, daysPerWeek: 1, now: ist('2026-10-14') };
  assert.equal(computeRhythm(base).weeksMetStreak, 0);
  const paused = computeRhythm({ ...base, pausedUntil: '2026-10-11' });
  assert.equal(paused.weeksMetStreak, 2);
  const resumed = computeRhythm({ ...base, pausedUntil: '2026-10-11', activities: [...acts, ist('2026-10-12')] });
  assert.equal(resumed.weeksMetStreak, 3);
  assert.equal(resumed.bestRun, 3);
  assert.equal(computeRhythm({ ...base, pausedUntil: '2026-10-20' }).paused, true);
});

test('empty history is calm and complete', () => {
  const r = computeRhythm({ activities: [], now: ist('2026-10-14') });
  assert.equal(r.studyDays, 0);
  assert.equal(r.daysGoal, 4);
  assert.equal(r.weeksMetStreak, 0);
  assert.equal(r.bestRun, 0);
  assert.equal(r.lastActivityAt, null);
  assert.equal(r.daysSinceLastActivity, null);
  assert.equal(r.returning, false);
  assert.ok(r.milestones.every(m => m.achievedAt === null));
});

test('returning flag at 3 days and not at 2', () => {
  const last = ist('2026-10-10', '20:00');
  assert.equal(computeRhythm({ activities: [last], now: ist('2026-10-12', '08:00') }).returning, false);
  const r = computeRhythm({ activities: [last], now: ist('2026-10-13', '08:00') });
  assert.equal(r.daysSinceLastActivity, 3);
  assert.equal(r.returning, true);
  assert.equal(r.lastActivityAt, new Date(last).toISOString());
});

test('ignores invalid and future activity and de-duplicates by id', () => {
  const now = ist('2026-10-14');
  const r = computeRhythm({ activities: ['nope', null, ist('2026-10-20'), { id: 'a:1', at: ist('2026-10-13') }, { id: 'a:1', at: ist('2026-10-13') }], now });
  assert.equal(r.studyDays, 1);
  assert.equal(ids(r).first_scored_session, new Date(ist('2026-10-13')).toISOString());
});

test('milestones with first-achieved dates', () => {
  const acts = [];
  // 10 sessions on 10 consecutive days from 2026-09-01, the first being a full mock.
  for (let i = 0; i < 10; i++) acts.push({ id: `a:${i}`, at: ist(`2026-09-${String(i + 1).padStart(2, '0')}`), kind: 'session', fullMock: i === 0 });
  // 25 repairs, one per day from 2026-09-15.
  for (let i = 0; i < 25; i++) acts.push({ id: `r:${i}`, at: ist(new Date(Date.parse('2026-09-15T00:00:00Z') + i * 86400000).toISOString().slice(0, 10)), kind: 'repair' });
  const r = computeRhythm({ activities: acts, daysPerWeek: 4, now: ist('2026-10-20') });
  const m = ids(r);
  const d = s => new Date(ist(s)).toISOString();
  assert.equal(m.first_scored_session, d('2026-09-01'));
  assert.equal(m.first_full_mock, d('2026-09-01'));
  assert.equal(m.sessions_10, d('2026-09-10'));
  assert.equal(m.first_repair, d('2026-09-15'));
  assert.equal(m.repairs_5, d('2026-09-19'));
  assert.equal(m.repairs_10, d('2026-09-24'));
  assert.equal(m.repairs_25, d('2026-10-09'));
  // Week of 2026-08-31 has study days Sep 1..6 => the 4th day (Sep 4) met the goal.
  assert.equal(m.first_week_met, d('2026-09-04'));
  assert.ok(m.weeks_met_4);
  assert.equal(r.milestones.length, 10); // + run_weeks_3 (first_hold only when its read is passed)
  assert.ok(!('fresh_check' in m));
});

test('milestones never regress when history grows or the goal is lowered', () => {
  const acts = [ist('2026-09-01'), ist('2026-09-02')];
  const high = ids(computeRhythm({ activities: acts, daysPerWeek: 5, now: ist('2026-10-01') }));
  const low = ids(computeRhythm({ activities: acts, daysPerWeek: 2, now: ist('2026-10-01') }));
  assert.equal(high.first_week_met, null);
  assert.equal(low.first_week_met, new Date(ist('2026-09-02')).toISOString());
  assert.equal(low.first_scored_session, high.first_scored_session);
});

// ---- B2: study-day floor, goal history, closed-week history ----

test('floor: a session needs 5 answered questions; repairs and unknown counts are unaffected', () => {
  assert.equal(MIN_ANSWERED, 5);
  const now = ist('2026-10-15');
  const s = (d, answered) => ({ id: `a:${d}:${answered}`, at: ist(d), kind: 'session', answered });
  const r = computeRhythm({ activities: [s('2026-10-12', 4), s('2026-10-13', 5), s('2026-10-14', 0)], daysPerWeek: 3, now });
  assert.deepEqual(r.studyDayDates, ['2026-10-13']);
  const rep = computeRhythm({ activities: [{ id: 'r:1', at: ist('2026-10-12'), kind: 'repair' }, { at: ist('2026-10-14') }], daysPerWeek: 3, now });
  assert.equal(rep.studyDays, 2);
  const none = computeRhythm({ activities: [s('2026-10-12', 4)], now });
  assert.equal(none.lastActivityAt, null);
  assert.ok(none.milestones.every(m => m.achievedAt === null));
  assert.equal(none.history.length, 0);
});

test('floor: a below-floor session does not give first_scored_session or sessions_10', () => {
  const acts = [{ id: 'a:0', at: ist('2026-09-01'), kind: 'session', answered: 2 }];
  for (let i = 1; i <= 10; i++) acts.push({ id: `a:${i}`, at: ist(`2026-09-${String(i + 1).padStart(2, '0')}`), kind: 'session', answered: 5 });
  const m = ids(computeRhythm({ activities: acts, now: ist('2026-10-01') }));
  assert.equal(m.first_scored_session, new Date(ist('2026-09-02')).toISOString());
  assert.equal(m.sessions_10, new Date(ist('2026-09-11')).toISOString());
});

test('goal history: closed weeks keep the goal they were held to', () => {
  const acts = ['2026-09-14', '2026-09-15', '2026-09-21', '2026-09-22', '2026-09-28', '2026-09-29', '2026-10-05', '2026-10-06'].map(d => ist(d));
  const goalHistory = [{ effectiveWeek: BASE_WEEK, daysPerWeek: 2 }, { effectiveWeek: '2026-09-28', daysPerWeek: 4 }];
  const r = computeRhythm({ activities: acts, daysPerWeek: 4, goalHistory, now: ist('2026-10-14') });
  const byWeek = Object.fromEntries(r.history.map(h => [h.weekStart, h]));
  assert.deepEqual([byWeek['2026-09-14'].goal, byWeek['2026-09-14'].met], [2, true]);
  assert.deepEqual([byWeek['2026-09-21'].goal, byWeek['2026-09-21'].met], [2, true]);
  assert.deepEqual([byWeek['2026-09-28'].goal, byWeek['2026-09-28'].met], [4, false]);
  assert.deepEqual([byWeek['2026-10-05'].goal, byWeek['2026-10-05'].met], [4, false]);
  assert.equal(r.weeksMetStreak, 0);
  assert.equal(r.bestRun, 2);
  assert.equal(r.daysGoal, 4);
  // Without history the new goal would have erased the earlier met weeks.
  assert.equal(computeRhythm({ activities: acts, daysPerWeek: 4, now: ist('2026-10-14') }).bestRun, 0);
  assert.equal(ids(r).first_week_met, new Date(ist('2026-09-15')).toISOString());
});

test('goalForWeek and planGoalHistoryWrites', () => {
  const h = [{ effectiveWeek: '2026-09-28', daysPerWeek: 5 }, { effectiveWeek: BASE_WEEK, daysPerWeek: 3 }];
  assert.equal(goalForWeek(h, '2026-09-21'), 3);
  assert.equal(goalForWeek(h, '2026-09-28'), 5);
  assert.equal(goalForWeek(h, '2026-10-12'), 5);
  assert.equal(goalForWeek([{ effectiveWeek: '2026-09-28', daysPerWeek: 5 }], '2026-09-07'), 5);
  assert.equal(goalForWeek([], '2026-09-07', 6), 6);
  assert.equal(goalForWeek([{ effectiveWeek: 'bad', daysPerWeek: 2 }, { effectiveWeek: '2026-10-07', daysPerWeek: 9 }], '2026-10-12', 4), 4);
  const cw = '2026-10-12';
  assert.deepEqual(planGoalHistoryWrites({ history: h, previousGoal: 5, newGoal: 5, currentWeek: cw }), []);
  assert.deepEqual(planGoalHistoryWrites({ history: h, previousGoal: 5, newGoal: 2, currentWeek: cw }), [{ effectiveWeek: cw, daysPerWeek: 2 }]);
  assert.deepEqual(planGoalHistoryWrites({ history: [], previousGoal: 4, newGoal: 6, currentWeek: cw }), [{ effectiveWeek: BASE_WEEK, daysPerWeek: 4 }, { effectiveWeek: cw, daysPerWeek: 6 }]);
  assert.deepEqual(planGoalHistoryWrites({ history: [], previousGoal: 4, newGoal: 4, currentWeek: cw }), [{ effectiveWeek: BASE_WEEK, daysPerWeek: 4 }]);
  assert.deepEqual(planGoalHistoryWrites({ history: [], previousGoal: null, newGoal: 3, currentWeek: cw }), [{ effectiveWeek: cw, daysPerWeek: 3 }]);
  const again = [...h, { effectiveWeek: cw, daysPerWeek: 2 }];
  assert.deepEqual(planGoalHistoryWrites({ history: again, previousGoal: 2, newGoal: 5, currentWeek: cw }), [{ effectiveWeek: cw, daysPerWeek: 5 }]);
});

test('history: last 12 closed weeks, newest first, never before the first activity week', () => {
  const now = ist('2026-10-14');
  const one = computeRhythm({ activities: [ist('2026-10-06')], daysPerWeek: 1, now });
  assert.deepEqual(one.history, [{ weekStart: '2026-10-05', studyDays: 1, goal: 1, met: true, paused: false }]);
  assert.deepEqual(one.lastClosedWeek, { id: '2026-10-05', studyDays: 1, goal: 1, met: true });
  const old = computeRhythm({ activities: [ist('2026-01-06')], daysPerWeek: 2, now });
  assert.equal(old.history.length, 12);
  assert.equal(old.history[0].weekStart, '2026-10-05');
  assert.equal(old.history[11].weekStart, '2026-07-20');
  assert.ok(old.history.every(h => h.met === false && h.studyDays === 0 && h.goal === 2));
  assert.equal(old.lastClosedWeek.id, '2026-10-05');
});

test('lastClosedWeek: null in the first week; id is the week start; boundary at Monday IST', () => {
  const first = computeRhythm({ activities: [ist('2026-10-12')], now: ist('2026-10-13') });
  assert.equal(first.lastClosedWeek, null);
  assert.deepEqual(first.history, []);
  const sun = ist('2026-10-11', '23:30');
  const before = computeRhythm({ activities: [sun], daysPerWeek: 1, now: ist('2026-10-11', '23:45') });
  assert.equal(before.lastClosedWeek, null);
  const after = computeRhythm({ activities: [sun], daysPerWeek: 1, now: ist('2026-10-12', '00:05') });
  assert.deepEqual(after.lastClosedWeek, { id: '2026-10-05', studyDays: 1, goal: 1, met: true });
  assert.equal(computeRhythm({ activities: [sun], daysPerWeek: 1, now: ist('2026-10-14') }).lastClosedWeek.id, '2026-10-05');
});

test('history marks paused weeks only when not met; a met week stays met', () => {
  const acts = [ist('2026-09-21'), ist('2026-09-28')];
  const r = computeRhythm({ activities: acts, daysPerWeek: 1, pausedUntil: '2026-10-11', now: ist('2026-10-14') });
  const h = Object.fromEntries(r.history.map(x => [x.weekStart, x]));
  assert.deepEqual([h['2026-09-21'].met, h['2026-09-21'].paused], [true, false]);
  assert.deepEqual([h['2026-10-05'].met, h['2026-10-05'].paused], [false, true]);
  const unpaused = computeRhythm({ activities: acts, daysPerWeek: 1, now: ist('2026-10-14') });
  assert.equal(unpaused.history[0].paused, false);
});

test('repairsThisWeek and mocksThisWeek count events in the current week only', () => {
  const now = ist('2026-10-15');
  const acts = [
    { id: 'r:1', at: ist('2026-10-12', '09:00'), kind: 'repair' },
    { id: 'r:2', at: ist('2026-10-12', '10:00'), kind: 'repair' },
    { id: 'r:old', at: ist('2026-10-11', '23:00'), kind: 'repair' },
    { id: 'a:full', at: ist('2026-10-13'), kind: 'session', answered: 30, fullMock: true, mock: true },
    { id: 'a:nta', at: ist('2026-10-14'), kind: 'session', answered: 20, mock: true },
    { id: 'a:quick', at: ist('2026-10-14'), kind: 'session', answered: 10 },
    { id: 'a:lowmock', at: ist('2026-10-14'), kind: 'session', answered: 1, mock: true },
    { id: 'a:oldmock', at: ist('2026-10-08'), kind: 'session', answered: 30, mock: true },
  ];
  const r = computeRhythm({ activities: acts, daysPerWeek: 4, now });
  assert.equal(r.repairsThisWeek, 2);
  assert.equal(r.mocksThisWeek, 2);
  assert.equal(r.studyDays, 3);
  const empty = computeRhythm({ now });
  assert.deepEqual([empty.repairsThisWeek, empty.mocksThisWeek, empty.lastClosedWeek, empty.history], [0, 0, null, []]);
});

test('existing fields keep their shape alongside the new ones', () => {
  const r = computeRhythm({ activities: [ist('2026-10-12')], now: ist('2026-10-13') });
  for (const k of ['timeZone', 'weekStart', 'studyDays', 'studyDayDates', 'daysGoal', 'metThisWeek', 'paused', 'weeksMetStreak', 'bestRun', 'lastActivityAt', 'daysSinceLastActivity', 'returning', 'milestones', 'history', 'repairsThisWeek', 'mocksThisWeek', 'lastClosedWeek']) assert.ok(k in r, k);
  assert.equal(r.timeZone, 'Asia/Kolkata');
});
