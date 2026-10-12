import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRhythm, localDay, weekStart } from '../../src/lib/server/rhythm.js';

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
  assert.equal(r.milestones.length, 9);
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
