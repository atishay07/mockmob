// Today, Learn v2 round 4 (R4-SPEC, packet R4-today: owner-eye#5, first-timer#3, client-code#2, ui-correctness#8, ui-correctness#15,
// first-timer#15, and the home hero's bubble tail). Each test locks one fix so a later pass cannot quietly bring it back.
// Run: node --test data/tests/today_r4.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weekDays, weekMarks } from '../../src/lib/today/week.mjs';
import { coversCue, CUE_BOTTOM, CUE_SIZE } from '../../src/lib/today/cue.mjs';
import { chapterTitle } from '../../src/lib/today/chapterTitle.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('owner-eye#5: the swap row is off-limits to the cue, so a brand-new student on a 390 x 844 phone never has it drawn over the row', () => {
  const cue = read('src/components/today/TodayCue.jsx');
  assert.match(cue, /export const KEEP_CLEAR = '\.tm \.tm__key, \.tm \.tm__why, \.tm \.tm__or';/);
  // The first screen of the first-week card (390 x 844): the swap row's line and its two moves run from y 706 to 770; the cue's band is
  // 704 to 744 (92 px up, 40 px tall, 8 px of air), so the row is under it: the cue steps away and draws nothing.
  const view = { height: 844, width: 390, half: 20 };
  assert.ok(844 - CUE_BOTTOM - CUE_SIZE - 8 < 706, 'the row starts inside the cue band');
  assert.equal(coversCue({ top: 706, bottom: 770, left: 16, right: 374 }, view), true, 'the swap row covers the cue band');
  // Once the row sits above the band (a taller phone) the cue may show, and it may sit over the card's footer cells below.
  assert.equal(coversCue({ top: 560, bottom: 640, left: 16, right: 374 }, view), false, 'a row clear above the band does not hide the cue');
  // The wide label state (about 250 px) is measured too: the row spans the width, so it is covered either way.
  assert.equal(coversCue({ top: 706, bottom: 770, left: 16, right: 374 }, { ...view, half: 125 }), true);
});

test('owner-eye#5: the cue draws nothing until it has measured once, so it cannot flash over the row for a frame', () => {
  const cue = read('src/components/today/TodayCue.jsx');
  assert.match(cue, /const \[measured, setMeasured\] = useState\(false\);/);
  assert.match(cue, /setMeasured\(true\);/);
  assert.match(cue, /const hidden = away \|\| !ready \|\| !measured;/);
  assert.match(cue, /data-wait=\{ready && measured \? undefined : ''\}/);
});

test('first-timer#3: the coach line reads "Or start with one of these"', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /\{coach \? 'Or start with one of these' : 'Or make one of these your move'\}/);
  assert.doesNotMatch(move, /Tap one to swap it in as your move/);
});

test('client-code#2: one colleges strip, mounted only once the first-session fact is known, in one slot (no layout shift on load)', () => {
  const page = read('src/app/(app)/today/page.jsx');
  assert.equal((page.match(/<TodayCollegesStrip /g) || []).length, 1);
  assert.match(page, /const strip = everSessions !== null \? /);
  assert.match(page, /useSyncExternalStore\(subscribeWide, wideNow, \(\) => false\)/, 'the slot follows the 1100 px query; the server snapshot is the phone slot');
  assert.match(page, /const WIDE_HEAD = '\(min-width: 1100px\)';/);
  const sheet = read('src/components/today/today.css');
  assert.match(sheet, /\.app-shell \.today__colleges-head \{ display: none; \}/);
  assert.match(sheet, /@media \(min-width: 1100px\) \{\n  \.app-shell \.today__colleges-head \{ display: block; \}/);
});

test('ui-correctness#8: a count of mistakes never says "missed" or "misses" on Today (W); Last paper says "questions you lost"', () => {
  const weak = read('src/components/today/TodayWeak.jsx');
  assert.match(weak, /\{missed\} of \{c\.n\} wrong or blank/);
  assert.doesNotMatch(weak, /of \{c\.n\} missed/);
  const paper = read('src/components/today/TodayPaper.jsx');
  assert.match(paper, /Biggest leak: <b>\{l\.value\.chapter\}<\/b>, \{l\.value\.here\} of the \{l\.value\.misses\} \{l\.value\.misses === 1 \? 'question' : 'questions'\} you lost \(\{l\.value\.wrong\} wrong, \{l\.value\.blank\} blank\)\./);
  assert.doesNotMatch(paper, /'miss' : 'misses'/);
  const lead = read('src/lib/today/lead.mjs');
  assert.match(lead, /questions wrong or blank\. Marked/);
  assert.doesNotMatch(lead, /questions missed/);
});

test('ui-correctness#8: a stored chapter name reads as its canonical title; the preview record stores "Accounting Ratios"', () => {
  assert.equal(chapterTitle('accountancy', 'Accounting Ratios'), 'Accounting Ratios');
  assert.equal(chapterTitle('accountancy', 'Goodwill'), 'Goodwill: Nature and Valuation');
  const record = read('src/app/preview/arena/previewRecord.js');
  assert.doesNotMatch(record, /chapter: 'Ratios'/, 'the fixture names the chapter the way the syllabus does');
  assert.match(record, /chapter: 'Accounting Ratios'/);
});

const RHYTHM = { weekStart: '2026-10-26', studyDayDates: [], daysGoal: 4, studyDays: 0 };
const marksOf = (extra) => weekMarks({ rhythm: RHYTHM, today: '2026-11-01', weekdays: [0, 2, 4, 5], firstDay: '2026-11-01', ...extra });

test('ui-correctness#15: a student with no saved session has today as a planned first day (empty ring), never a rest day', () => {
  // Sunday (index 6) is not one of the chosen days, so it was a rest day before.
  assert.equal(marksOf({}).find((m) => m.today).state, 'rest');
  const fresh = marksOf({ fresh: true });
  assert.equal(fresh.find((m) => m.today).state, 'planned');
  // Only today changes: the days before the first session stay a dash, the rest of a chosen week is unchanged.
  const plain = marksOf({});
  assert.deepEqual(fresh.filter((m) => !m.today), plain.filter((m) => !m.today));
  // A counted day always wins.
  const counted = weekMarks({ rhythm: { ...RHYTHM, studyDayDates: ['2026-11-01'] }, today: '2026-11-01', weekdays: [0, 2, 4, 5], firstDay: '2026-11-01', fresh: true });
  assert.equal(counted.find((m) => m.today).state, 'counted');
  const week = read('src/components/today/TodayWeek.jsx');
  assert.match(week, /fresh: everSessions === 0/);
});

test('first-timer#15: the This week header carries "4 study days", not "This week" twice; the sentence form keeps "this week"', () => {
  assert.deepEqual(weekDays({ studyDays: 0, daysGoal: 4 }), { done: 0, total: 4, figure: 4, of: '', unit: 'study days', text: '4 study days this week' });
  assert.equal(weekDays({ studyDays: 1, daysGoal: 4 }).unit, 'study days');
  assert.equal(weekDays({ studyDays: 0, daysGoal: 1 }).unit, 'study day');
  assert.equal(weekDays({ studyDays: 2, daysGoal: 4 }).text, '2 of 4 study days');
});

// Updated 4 Nov 2026 (SPEC-HOME-1104 P2, Desk Light): the bubble sits on the floor to Mobi's right, so instead of a
// rotated tail its own corner points at him: the bottom-left corner is the sharp one (16 16 16 4).
test('hero: the desk bubble points at Mobi with its sharp bottom-left corner, sitting to his right on the floor', () => {
  const css = read('src/app/hero-scene.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const bubble = css.match(/\.lp-desk__bubble \{[^}]*\}/)?.[0] || '';
  assert.match(bubble, /border-radius: 16px 16px 16px 4px;/, 'the corner nearest him is the sharp one');
  assert.match(bubble, /left: calc\(30px \+ var\(--bubble-x, 98px\)\);/, 'to his right (he stands 30 px in)');
  assert.doesNotMatch(css, /\.lp-desk__bubble::after/, 'no separate tail shape');
});
