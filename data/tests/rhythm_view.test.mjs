import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRhythm } from '../../src/lib/server/rhythm.js';
import { buildWeek, buildRibbon, weekStatus, dayKeyNow, shortDate } from '../../src/lib/rhythmView.js';

const ist = (date, hhmm = '12:00') => Date.parse(`${date}T${hhmm}:00+05:30`);
const session = (date, id) => ({ id, at: ist(date), kind: 'session', answered: 10 });

test('week days say only what the record says', () => {
  const now = ist('2026-10-15', '13:00'); // Thursday
  const r = computeRhythm({ activities: [session('2026-10-13', 'a'), session('2026-10-15', 'b')], daysPerWeek: 4, now });
  const today = dayKeyNow('Asia/Kolkata', now);
  assert.equal(today, '2026-10-15');
  const week = buildWeek(r, today);
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((d) => d.state), ['missed', 'counted', 'missed', 'counted', 'ahead', 'ahead', 'ahead']);
  assert.equal(week[1].chip, 'Tue 13, counted');
  assert.equal(week[0].chip, 'Mon 12, no study day counted');
  assert.equal(week[3].isToday, true);
  assert.equal(week[4].chip, 'Fri 16, still ahead');
});

test('an open today is called not counted yet, never missed', () => {
  const now = ist('2026-10-15', '10:00');
  const r = computeRhythm({ activities: [session('2026-10-13', 'a')], daysPerWeek: 4, now });
  const week = buildWeek(r, '2026-10-15');
  assert.equal(week[3].state, 'open');
  assert.equal(week[3].chip, 'Today, Thu 15, not counted yet');
});

test('status line follows the real counts', () => {
  const now = ist('2026-10-15');
  const none = computeRhythm({ activities: [], daysPerWeek: 4, now });
  assert.equal(weekStatus(none), 'No study day counted yet this week.');
  const two = computeRhythm({ activities: [session('2026-10-12', 'a'), session('2026-10-13', 'b')], daysPerWeek: 4, now });
  assert.equal(weekStatus(two), '2 more study days to meet your weekly goal.');
  const met = computeRhythm({ activities: [session('2026-10-12', 'a'), session('2026-10-13', 'b')], daysPerWeek: 2, now });
  assert.equal(met.metThisWeek, true);
  assert.equal(weekStatus(met), 'Week met. 2 study days counted.');
  const back = computeRhythm({ activities: [session('2026-10-01', 'a')], daysPerWeek: 4, now });
  assert.equal(back.returning, true);
  assert.match(weekStatus(back), /^Welcome back/);
});

test('the ribbon ends with this week and never invents weeks', () => {
  const now = ist('2026-10-15');
  const r = computeRhythm({ activities: [session('2026-10-06', 'a'), session('2026-10-07', 'b'), session('2026-10-15', 'c')], daysPerWeek: 2, now: ist('2026-10-15', '13:00') });
  const ribbon = buildRibbon(r);
  assert.equal(ribbon.length, 2); // last week and this week; nothing before the first activity
  assert.equal(ribbon[0].met, true);
  assert.equal(ribbon[0].words, 'Week of 5 Oct: 2 of 2 study days, goal met');
  assert.equal(ribbon[1].current, true);
  assert.equal(ribbon[1].words, 'This week: 1 of 2 study days so far');
  assert.equal(ribbon[1].fill, 0.5);
  assert.equal(buildRibbon(computeRhythm({ activities: [], now })).length, 1);
});

test('date words', () => {
  assert.equal(shortDate('2026-10-06'), '6 Oct');
});
