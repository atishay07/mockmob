// Today's bar in the streak block (18 Nov 2026, owner LK309): only the server's own figures, and no bar where there is nothing to fill.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countedKey, todayProgress } from './streakCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the bar is today\'s answers of the rule\'s number', () => {
  assert.deepEqual(todayProgress({ days: 3, today: { answered: 2, needed: 5 } }), { answered: 2, needed: 5 });
  assert.deepEqual(todayProgress({ days: 0, today: { answered: 0 }, rule: { answers: 5 } }), { answered: 0, needed: 5 });
  assert.deepEqual(todayProgress({ today: { answered: 9, needed: 5 } }), { answered: 5, needed: 5 }, 'never more than full');
  assert.deepEqual(todayProgress({ today: { answered: -2, needed: 5 } }), { answered: 0, needed: 5 });
});

test('no bar when today counts, on a pause day, or when no rule came', () => {
  assert.equal(todayProgress(null), null);
  assert.equal(todayProgress({ today: { done: true, answered: 5, needed: 5 } }), null);
  assert.equal(todayProgress({ today: { paused: true, answered: 0, needed: 5 } }), null);
  assert.equal(todayProgress({ today: { answered: 1 } }), null, 'no number is made up');
  assert.equal(todayProgress({ today: { answered: 1, needed: 500 } }), null, 'a rule too long to draw as segments is said in words only');
});

test('a day still open shows the make-up\'s own figures, the ones its line says in words', () => {
  const body = { today: { answered: 4, needed: 5 }, makeUp: { day: '2026-11-17', needed: 10, answeredToday: 4 } };
  assert.deepEqual(todayProgress(body), { answered: 4, needed: 10 });
  assert.deepEqual(todayProgress({ today: { paused: true }, makeUp: { day: '2026-11-17', needed: 10, answeredToday: 0 } }), { answered: 0, needed: 10 });
});

test('the block draws Mobi, the number, the week and the bar from the server\'s body, and its moment plays once a day', () => {
  assert.equal(countedKey('2026-11-18'), 'mm:streak-counted:2026-11-18:v1');
  const block = read('../../components/streak/TodayStreak.jsx');
  assert.match(block, /<StreakMobi lit=\{counted\} className="tsk__mobi" \/>/);
  assert.match(block, /<WeekStrip body=\{body\} \/>/);
  assert.match(block, /const progress = todayProgress\(body\);/);
  assert.match(block, /if \(seen \|\| prefs\.celebrations === 'off' \|\| prefs\.reduced\) return undefined;/, 'no moment under Celebrations Off or Reduce motion');
  assert.match(block, /\{body\.days > 0 \? \(/, 'never a zero as the lead');
  const css = read('../../components/streak/streak.css');
  assert.doesNotMatch(css.slice(css.indexOf('18 Nov 2026 (owner LK309)')), /infinite/, 'nothing loops');
});
