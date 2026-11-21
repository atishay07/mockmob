// The streak, made worth using (21 Nov 2026, owner LK365): the head of Today on a phone, what the run made in the server's own
// counts, the finish line to CUET, today's five as the plain primary key, and the moment the number grows (once, about 400 ms,
// still under reduced motion). Run: node --test data/tests/streak_1121.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeChain } from '../../src/lib/chain/chain.mjs';
import {
  finishLine, grewFrom, keepAction, madeFigures, madeTitle, readSeen, seenKey, todayShort, writeSeen,
} from '../../src/lib/streak/streakCopy.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DAY = 86_400_000;
const T = '2026-11-21';
const add = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const run = (from, n, answered = 8) => Array.from({ length: n }, (_, i) => ({ day: add(from, i), answered }));
const chain = (daily, more = {}) => ({ ...computeChain({ daily, today: T, ...more }), rule: { answers: 5 } });
const BANNED = /\b(lost|lose|behind|hurry|at risk|missed|break|broke|fail|failed|warning|guarantee)\b|!|—/i;

test('what the run made: the server\'s own counts, questions first, the rest only above zero', () => {
  const c = chain([...run(add(T, -12), 12).filter((d) => d.day !== add(T, -5)), { day: T, answered: 6 }]);
  const figs = madeFigures(c);
  assert.equal(figs[0].key, 'answered');
  assert.equal(figs[0].n, c.run.answered, 'questions answered is run.answered');
  assert.equal(figs.find((f) => f.key === 'practised').n, c.practised);
  assert.equal(figs.find((f) => f.key === 'rested').n, c.rested);
  assert.equal(figs.some((f) => f.key === 'made_up'), false, 'nothing made up, so no zero tile');
  assert.equal(madeTitle(c.days), `What ${c.days} days made`);
  assert.equal(madeTitle(1), 'What 1 day made');
  assert.deepEqual(madeFigures(chain([])), [], 'no run, nothing to show');
  assert.equal(madeFigures({ days: 1, run: { answered: 1 }, practised: 1 })[0].label, 'question answered');
  for (const f of figs) assert.doesNotMatch(f.label, BANNED);
});

test('the finish line: days to CUET with the week, "About" for the expected window, nothing without a day ahead', () => {
  assert.equal(finishLine({ examDay: '2027-05-01', today: T }), 'About 161 days to CUET. Keep it to exam day.');
  assert.equal(finishLine({ examDay: '2027-05-01', today: T, own: true }), '161 days to CUET. Keep it to exam day.');
  assert.equal(finishLine({ examDay: add(T, 1), today: T, own: true }), '1 day to CUET. Keep it to exam day.');
  assert.equal(finishLine({ examDay: T, today: T }), null, 'exam day itself');
  assert.equal(finishLine({ examDay: add(T, -2), today: T }), null, 'after the exam');
  assert.equal(finishLine({ examDay: null, today: T }), null, 'no date known');
  assert.equal(finishLine({ examDay: 'soon', today: T }), null);
  assert.doesNotMatch(finishLine({ examDay: '2027-05-01', today: T }), BANNED);
});

test('today\'s unit: "Do today\'s five" while the five are still to play, as the plain primary key', () => {
  const open = chain([...run(add(T, -3), 3), { day: T, answered: 2 }]);
  assert.equal(keepAction(open, { daily: 'open' }).label, 'Do today’s five');
  assert.equal(keepAction(open, { daily: 'begun' }).label, 'Finish today’s five');
  const useful = read('src/components/streak/StreakUseful.jsx');
  assert.match(useful, /className=\{`btn-volt md mk-press stk-keep/, 'the keep key is the volt primary');
  const sheet = read('src/components/streak/Streak.jsx');
  const keyAt = sheet.indexOf('<KeepKey body={body} className="stk-sheet__keep" />');
  assert.ok(keyAt > 0 && keyAt < sheet.indexOf('<MadeFigures') && keyAt < sheet.indexOf('<StreakMonth body'), 'the first key in the sheet');
  assert.ok(sheet.indexOf('<FinishLine') < keyAt, 'the finish line sits with the week, above the key');
});

test('the head of Today keeps a short status when the phone header carries the count', () => {
  const c = chain([...run(add(T, -3), 3), { day: T, answered: 2 }]);
  assert.equal(todayShort(c), '2 of 5 today');
  assert.equal(todayShort(chain([...run(add(T, -3), 3), { day: T, answered: 6 }])), 'Today counts');
  assert.equal(todayShort(chain([...run(add(T, -3), 2), { day: T, answered: 4 }])), '4 of 10 today', 'a make-up counts to its own 10');
  const block = read('src/components/streak/TodayStreak.jsx');
  assert.match(block, /function TodayHeadPill/);
  assert.match(block, /const headerHasCount = phone && hasStreakChip\(body\)/);
  assert.match(block, /if \(headerHasCount\) \{\s*return <p className="tsk-summary">/);
  assert.match(block, /\{!headerHasCount \? \(\s*<button type="button" className="tsk__head-btn"/);
  assert.match(block, /<KeepKey body=\{body\} \/>/);
  assert.match(block, /<>\{pill\}<section className="tsk" id="streak"/);
  assert.match(block, /<>\{pill\}<section className="tsk tsk--wait"/, 'the pill holds its place while the read is out');
  const css = read('src/components/streak/streak.css');
  assert.match(css, /\.app-shell \.today-grid :is\(\.tsk-pill, \.tsk-summary\) \{ order: 0;/);
  assert.match(css, /@media \(min-width: 1100px\) \{ \.app-shell \.tsk-pill \{ display: none; \} \}/);
  assert.match(css, /\.app-shell \.tsk-pill \{[^}]*height: 44px/, '44 px target');
});

test('the phone streak is an accessible header control between Ask Mobi and Wallet', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  const bar = shell.slice(shell.indexOf('<header className="arena-topbar">'), shell.indexOf('</header>'));
  assert.match(bar, /<ThemeToggle hint \/>[\s\S]*data-tour="nav-mentor-top"[\s\S]*<StreakChip [\s\S]*data-tour="credits-pill"[\s\S]*<AccountPopover /);
  assert.match(shell, /user\?\.id && !isTestRoute && !chipHiddenOn\(activePath, true\)/);
  const chip = read('src/components/streak/StreakChip.jsx');
  assert.match(chip, /!\(phone && page === '\/today'\)/);
  assert.match(chip, /aria-label=\{chipLabel\(body.days, done\)\} onClick=\{\(\) => openStreakSheet\(\)\}/);
  const css = read('src/components/streak/streak.css');
  assert.match(css, /\.stk-chip \{[^}]*min-width: 44px/);
  assert.match(css, /\.stk-chip:focus-visible \{ outline: 2px solid var\(--a-focus\)/);
});

test('the moment it grows: once per rise, from what this device last saw, never looping, still under reduced motion', () => {
  assert.equal(seenKey('u1'), 'mm:streak-seen:u1:v1');
  assert.deepEqual(readSeen(writeSeen(12, false)), { d: 12, t: false });
  assert.equal(readSeen('nonsense'), null);
  assert.equal(grewFrom(null, { days: 13, done: true }), null, 'first visit: nothing to step from');
  assert.equal(grewFrom({ d: 12, t: false }, { days: 13, done: true }), 12);
  assert.equal(grewFrom({ d: 13, t: true }, { days: 13, done: true }), null);
  assert.equal(grewFrom({ d: 30, t: true }, { days: 0, done: false }), null, 'a new run never steps down');
  const css = read('src/components/streak/streak.css');
  const tail = css.slice(css.indexOf('21 Nov 2026 (owner LK365'));
  assert.doesNotMatch(tail, /infinite/);
  assert.match(tail, /stk-tick-out 380ms/);
  assert.match(tail, /@media \(prefers-reduced-motion: reduce\) \{\s*\.stk-tick__old \{ display: none; \}/);
  assert.match(tail, /html\[data-motion='reduced'\] \.stk-tick__old \{ display: none; \}/);
  for (const f of ['StreakChip.jsx', 'TodayStreak.jsx', 'Streak.jsx']) assert.match(read(`src/components/streak/${f}`), /useStreakGrow\(/, f);
});

test('nothing under 14 px in the streak\'s own type', () => {
  const rules = [
    ['src/components/streak/streak-line.css', '.stk-band__name {'],
    ['src/components/streak/streak-line.css', '.stk-month__dow span {'],
    ['src/components/streak/streak-line.css', ".stk-band[data-names='date'] .stk-band__name {"],
    ['src/components/streak/streak.css', '.stk-hint {'],
    ['src/components/streak/streak.css', '.app-shell .tsk__rule {'],
    ['src/components/streak/streak.css', '.stk-cal__dow {'],
    ['src/components/streak/streak.css', '.stk-chip__unit {'],
    ['src/components/streak/streak.css', '.app-shell .tsk-pill {'],
    ['src/components/streak/streak.css', '.stk-fig__l {'],
  ];
  for (const [f, sel] of rules) {
    const css = read(f);
    const at = css.indexOf(sel);
    assert.ok(at >= 0, `${f} ${sel}`);
    const rule = css.slice(at, css.indexOf('}', at));
    const size = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(rule)?.[1] ?? /font:[^;]*?(\d+(?:\.\d+)?)px/.exec(rule)?.[1];
    assert.ok(size && Number(size) >= 14, `${f} ${sel} ${size}px`);
  }
  // A phone's "Today" in its ring keeps 14 px too.
  assert.match(read('src/components/streak/streak-line.css'), /\[data-today\] \.stk-band__name \{ font-size: 14px;/);
});
