// One unbroken line to exam day (19 Nov 2026): the line's geometry, the days it draws, what it says it made, the pace to CUET,
// and the one key that keeps the line. Every figure is the server's (computeChain); nothing here promises marks.
// Run: node --test src/lib/streak/streakLine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeChain } from '../chain/chain.mjs';
import { countedLine, examWords, keepAction, paceLine, runLine, streakDays, streakMonth, streakWeek } from './streakCopy.mjs';
import { lineRuns, tipShare } from './streakLine.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const DAY = 86_400_000;
const T = '2026-11-19';
const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const run = (from, n, answered = 8) => Array.from({ length: n }, (_, i) => ({ day: add(from, i), answered }));
const chain = (daily, more = {}) => ({ ...computeChain({ daily, today: T, ...more }), rule: { answers: 5 } });
const BANNED = /\b(lost|lose|behind|hurry|at risk|missed|miss|break|broke|broken|fail|failed|failure|warning|guarantee|marks?|score)\b|!/i;

test('the line\'s days: 14 from the calendar carry the same looks as the week, oldest first, today last', () => {
  const c = chain([...run(add(T, -12), 12).filter((d) => d.day !== add(T, -5)), { day: T, answered: 2 }]);
  const week = streakWeek(c);
  const fourteen = streakDays(c, 14);
  assert.equal(fourteen.length, 14);
  assert.equal(fourteen.at(-1).day, T);
  assert.equal(fourteen.at(-1).look, 'today');
  assert.deepEqual(fourteen.slice(7).map((d) => d.look), week.map((d) => d.look));
  assert.equal(fourteen[0].look, 'none', 'the day before the run is a plain day');
  assert.equal(fourteen.find((d) => d.day === add(T, -5)).look, 'rested');
  assert.equal(fourteen[0].initial, fourteen[0].name.slice(0, 1));
  assert.equal(fourteen.at(-1).initial, 'Today');
  assert.match(fourteen[0].label, /^[A-Z][a-z]+day \d+ [A-Z][a-z]{2}: no practice$/);
  assert.deepEqual(streakDays(c, 7).map((d) => d.day), week.map((d) => d.day));
});

test('the month: days of this month from the 1st, Monday-first lead, days after today still to come', () => {
  const c = chain(run(add(T, -9), 9), { pauses: [add(T, 2)] });
  const m = streakMonth(c);
  assert.equal(m.title, 'November 2026');
  assert.equal(m.days[0].day, '2026-11-01');
  assert.equal(m.lead, 6, '1 November 2026 is a Sunday');
  assert.equal(m.days.length, 30);
  assert.equal(m.days.find((d) => d.day === add(T, 1)).look, 'ahead');
  assert.equal(m.days.find((d) => d.day === add(T, 2)).look, 'paused', 'a pause day set ahead shows');
  assert.equal(m.days.find((d) => d.today).look, 'today');
  assert.equal(m.days.find((d) => d.day === add(T, 1)).label, 'Friday 20: still to come');
});

test('the band: one per run of kept days, split by a pause day (a dashed rule) and by a row; a gap for a plain day', () => {
  const cells = ['none', 'done', 'rested', 'done', 'paused', 'done', 'today'].map((look, i) => ({ key: `d${i}`, look, x: i * 40, y: 0, w: 40, h: 40 }));
  const { bands, rules } = lineRuns(cells, { tip: 0.4 });
  assert.equal(bands.length, 2);
  assert.deepEqual([bands[0].x, bands[0].w], [40, 120], 'done, rested, done');
  assert.deepEqual(bands[0].fills.map((f) => f.kind), ['solid', 'rest', 'solid']);
  assert.equal(bands[1].x, 200);
  assert.equal(bands[1].w, 40 + 16, 'the tip reaches 40% into today');
  assert.deepEqual(bands[1].fills.map((f) => f.kind), ['solid', 'tip']);
  assert.deepEqual(rules, [{ x1: 160, x2: 200, y: 40 * 0.52 }]);
  // with no answers today, today is not part of the band; a counted today is solid
  assert.equal(lineRuns(cells, { tip: 0 }).bands[1].w, 40);
  // a month: the band breaks at the end of a row
  const wrap = ['done', 'done', 'done', 'done'].map((look, i) => ({ key: `w${i}`, look, x: (i % 2) * 40, y: i < 2 ? 0 : 46, w: 40, h: 40 }));
  assert.equal(lineRuns(wrap).bands.length, 2);
  // a pause rule leaves room for the day's name
  const named = lineRuns([{ key: 'p', look: 'paused', x: 0, y: 0, w: 60, h: 40, nameX: 20, nameW: 20 }]).rules;
  assert.deepEqual(named.map((r) => [r.x1, r.x2]), [[0, 16], [44, 60]]);
  // two pause days side by side: one rule from the first name to the second (the dashes run on evenly)
  const two = lineRuns([0, 1].map((i) => ({ key: `p${i}`, look: 'paused', x: i * 60, y: 0, w: 60, h: 40, nameX: i * 60 + 20, nameW: 20 }))).rules;
  assert.deepEqual(two.map((r) => [r.x1, r.x2]), [[0, 16], [44, 76], [104, 120]]);
  assert.equal(tipShare({ answered: 2, needed: 5 }), 0.4);
  assert.equal(tipShare({ answered: 9, needed: 5 }), 1);
  assert.equal(tipShare(null), 0);
});

test('what the line made: the run\'s own answers, said only with a run and real work in it', () => {
  const c = chain([...run(add(T, -4), 4, 12), { day: T, answered: 3 }]);
  assert.equal(runLine(c), `${4 * 12 + 3} questions answered in this streak.`);
  assert.equal(runLine({ days: 1, run: { answered: 1 } }), '1 question answered in this streak.');
  assert.equal(runLine({ days: 0, run: { answered: 0 } }), null);
  assert.equal(runLine({ days: 2, run: { answered: 0 } }), null, 'a run of repairs only has no questions to name');
  assert.equal(runLine({ days: 3, run: { answered: 1250 } }), '1,250 questions answered in this streak.');
});

test('the pace to CUET: from 3 days, only with an exam day ahead, today counted once, never zero or negative', () => {
  const c = chain([...run(add(T, -4), 4), { day: T, answered: 2 }]);
  const exam = '2027-05-01';
  const between = Math.round((Date.parse(`${exam}T00:00:00Z`) - Date.parse(`${T}T00:00:00Z`)) / DAY);
  assert.equal(paceLine(c, { examDay: exam }), `At 5 questions a day, that is ${between * 5} more before CUET (expected Sat 1 May 2027).`);
  const done = chain([...run(add(T, -4), 4), { day: T, answered: 6 }]);
  assert.match(paceLine(done, { examDay: exam, own: true }), new RegExp(`that is ${(between - 1) * 5} more before CUET \\(Sat`), 'today already counts');
  assert.equal(paceLine(chain(run(add(T, -2), 2)), { examDay: exam }), null, 'under 3 days in a row');
  assert.equal(paceLine(c, { examDay: null }), null, 'no exam day, no pace');
  assert.equal(paceLine(c, { examDay: T }), null, 'the exam is today');
  assert.equal(paceLine(c, { examDay: add(T, -3) }), null, 'the exam has passed');
  assert.equal(paceLine(c, { examDay: add(T, 1) }), 'At 5 questions a day, that is 5 more before CUET (expected Fri 20 Nov 2026).', 'today still to do');
  assert.equal(paceLine(done, { examDay: add(T, 1) }), null,'today counts and the exam is tomorrow: nothing more to say');
  assert.equal(examWords('2027-05-08'), 'Sat 8 May 2027');
  for (const line of [runLine(c), paceLine(c, { examDay: exam }), countedLine(done)]) assert.doesNotMatch(line, BANNED, line);
});

test('the one key: a Daily Five while it is still to play, else today\'s practice set; the make-up\'s own count; none once today counts', () => {
  const open = chain([...run(add(T, -4), 4), { day: T, answered: 2 }]);
  assert.deepEqual(keepAction(open, { daily: 'open' }), { kind: 'daily', label: 'Do today’s Daily Five', href: '/daily' });
  assert.equal(keepAction(open, { daily: 'begun' }).label, 'Finish today’s Daily Five');
  assert.deepEqual(keepAction(open, { daily: 'played' }), { kind: 'practice', label: 'Start 10 practice questions', href: '/dashboard?mode=quick&count=10' });
  assert.equal(keepAction(open, { daily: null }).kind, 'practice', 'unknown is never guessed as open');
  const makeUp = chain([...run(add(T, -3), 2), { day: T, answered: 4 }]);
  assert.ok(makeUp.makeUp);
  assert.deepEqual(keepAction(makeUp, { daily: 'open' }), { kind: 'practice', label: 'Answer 6 more: start 10 questions', href: '/dashboard?mode=quick&count=10' }, 'a Daily Five holds 5, the make-up needs 10');
  assert.equal(keepAction(chain([...run(add(T, -4), 4), { day: T, answered: 6 }]), { daily: 'open' }), null);
  assert.equal(keepAction(chain(run(add(T, -4), 4), { pauses: [T] }), { daily: 'open' }), null, 'a pause day needs nothing');
  // The key's start paths are the product's own: the Daily Five row's address and Practice's first-set address.
  assert.match(read('../../components/daily/DailyFiveRow.jsx'), /href=\{DAILY_FIVE_PATH\}/);
  assert.match(read('../firstSet.mjs'), /FIRST_SET_HREF = `\/dashboard\?mode=quick&count=\$\{FIRST_SET_COUNT\}`/);
});

test('where the work ends: "Today counts. 13 days in a row." only once today counts', () => {
  assert.equal(countedLine({ days: 13, today: { done: true } }), 'Today counts. 13 days in a row.');
  assert.equal(countedLine({ days: 1, today: { done: true } }), 'Today counts. 1 day in a row.');
  assert.equal(countedLine({ days: 13, today: { done: false } }), null);
});

test('the drawing: the home headlines\' highlighter, no pen, no loop; one observer; the swipe once and still under reduced motion', () => {
  const line = read('../../components/streak/StreakLine.jsx');
  assert.match(line, /doodlePath\('highlight'/);
  assert.doesNotMatch(line, /Doodle\.jsx|from '@\/components\/doodle\/Doodle'/);
  assert.doesNotMatch(line, /\b(pen|pencil|nib|spark)\b/i);
  assert.match(line, /new ResizeObserver/);
  assert.doesNotMatch(line, /addEventListener\('scroll'/);
  assert.match(line, /aria-hidden="true" focusable="false"/);
  assert.match(line, /<ol ref=\{rowRef\} className="stk-band__row" aria-label=\{label\}>/);
  const css = read('../../components/streak/streak-line.css');
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /animation: stk-swipe 520ms cubic-bezier\(0\.33, 1, 0\.68, 1\) both/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.stk-band__fill\[data-swipe\] \{ animation: none; \}/);
  assert.match(css, /html\[data-motion='reduced'\] \.stk-band__fill\[data-swipe\] \{ animation: none; \}/);
});
