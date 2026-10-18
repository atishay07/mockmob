// Today, release 10: the taste pass (owner D89 to D90, 18 Oct 7:40 pm; docs/brain/OWNER-TASTE-PROFILE.md). Each test locks one
// critic finding that was fixed, so a later pass cannot quietly bring it back.
//   D15  one label per action: the Road row repeats the card's key, the week says "Counted at" once, never "Up next" again
//   D90  the swap choices say what they do, nudge on the first visits, and the swap moves with the tap
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayReadout, weekCaption, weekMarks } from '../../src/lib/today/week.mjs';
import { roadLayers, roadFigures } from '../../src/lib/today/road.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, '');

test('D90: the two choices say they swap the lead, carry a swap mark, and press in', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /<p className="tm__or-h" id="tm-or-h">Or make one of these your move<\/p>/);
  assert.match(move, /aria-labelledby="tm-or-h"/);
  assert.match(move, /<Repeat2 className="tm__choice-i" size=\{16\}/);
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tm__or-h \{[^}]*font-size: 12\.5px;[^}]*color: var\(--a-ink-3\)/);
  assert.match(sheet, /\.tm__choice:active \{[^}]*transform: scale\(0\.98\)/);
});

test('D90: the first-run nudge plays 1.2 s after landing until the first swap, at most 3 visits, storage guarded', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /SWAP_HINT_KEY = 'mm:today-swap-hint:v1'/);
  assert.match(move, /if \(seen >= 3\) return undefined;/);
  assert.match(move, /\}, 1200\);/);
  assert.match(move, /try \{ const v = window\.localStorage\.getItem\(SWAP_HINT_KEY\)/);
  assert.match(read('src/app/(app)/today/page.jsx'), /swapLearned\(\);/, 'a swap clears the hint for good');
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tm__or\[data-hint\] \.tm__choice \{ animation: tm-nudge 720ms[^}]*box-shadow: inset 0 0 0 1px var\(--a-line-strong\)/);
  assert.match(sheet, /@keyframes tm-nudge \{ 0%, 50%, 100% \{ transform: none; \} 25%, 75% \{ transform: translateY\(-3px\); \} \}/);
});

test('D90: the swap is direction-aware, has no blur, and the move that left sits in the tapped cell', () => {
  const sheet = css('src/components/today/today.css');
  const body = sheet.match(/\.app-shell \.tm__body \{[^}]*\}/)[0];
  assert.doesNotMatch(body, /filter/, 'no blur');
  assert.match(sheet, /\.tm__body\[data-out\] \{ opacity: 0; transform: translateX\(-20px\); transition-duration: 140ms;/);
  assert.match(sheet, /\.tm__body\[data-out\]\[data-dir='l'\] \{ transform: translateX\(20px\); \}/);
  assert.match(sheet, /\.tm__body\[data-in\] \{ transition: none; animation: tm-in-r 280ms cubic-bezier\(0\.2, 0\.9, 0\.25, 1\.1\) both; \}/);
  assert.match(sheet, /\.tm__choice\[data-arrived\] \{ animation: tm-cell-in 180ms ease both; \}/);
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /const dir = slot === 0 \? 'l' : 'r';/);
  assert.match(page, /if \(at >= 0 && marked\.length === 2 && at !== traded\.slot\) return \[marked\[1\], marked\[0\]\];/);
  assert.match(page, /if \(reducedMotion\(\)\) \{ put\(\); return; \}/, 'reduced motion swaps at once');
});

const RHYTHM = { weekStart: '2026-10-12', daysGoal: 4, studyDays: 3, studyDayDates: ['2026-10-15', '2026-10-17', '2026-10-18'], timeZone: 'Asia/Kolkata', metThisWeek: false };
const TODAY = '2026-10-18';
const dayKey = (at) => new Date((typeof at === 'number' ? at : Date.parse(at)) + 19800000).toISOString().slice(0, 10);

test('D15: the readout for today never repeats the lead; a counted day says when, and what is left of the week, in one line', () => {
  const marks = weekMarks({ rhythm: RHYTHM, today: TODAY, weekdays: null, firstDay: '2026-09-01' });
  const at = Date.parse('2026-10-18T14:11:00Z'); // 7:41 PM IST
  const paper = { id: 'p1', subject: 'accountancy', mode: 'quick', total: 10, completedAt: at };
  const r = dayReadout({ mark: marks[6], index: 6, papers: [paper], repairs: [], dayKey, clockOf: () => '7:41 PM', subjectName: (s) => s, today: TODAY, goal: 4, done: 3 });
  assert.equal(r.note, 'Counted at 7:41 PM. 1 more study day meets your 4.');
  const two = dayReadout({ mark: marks[6], index: 6, papers: [], repairs: [], dayKey, today: TODAY, goal: 4, done: 2 });
  assert.equal(two.note, 'Counted as a study day. 2 more study days meet your 4.');
  const met = dayReadout({ mark: marks[6], index: 6, papers: [], repairs: [], dayKey, today: TODAY, goal: 4, done: 4, met: true });
  assert.equal(met.note, 'Counted as a study day.');
  for (const n of [r.note, two.note, met.note]) assert.doesNotMatch(n, /Up next|already counts/);
  assert.equal(weekCaption({ rhythm: RHYTHM, marks, today: TODAY, everSessions: 9 }), null, 'the caption does not say it a second time');
  const week = read('src/components/today/TodayWeek.jsx');
  assert.match(week, /\{caption \? null : <>\{readout\.note \? ' ' : ''\}<Link className="tm__inline tw__weeks" href="\/progress">Your weeks<\/Link><\/>\}/, '"Your weeks" ends the line');
});

test('D15: the Road row key is the lead card key and length', () => {
  const fig = roadFigures({ today: TODAY, plan: {}, goal: 4, taken: 0 });
  const move = { id: 'dayOne', title: 'Find your starting point', key: { label: 'Start now', minutes: 10, href: '/dashboard?mode=quick&count=10' }, choice: { title: 'Your starting point', value: '10 questions' } };
  const layers = roadLayers({ today: TODAY, rhythm: { ...RHYTHM, studyDayDates: [], studyDays: 0 }, weekdays: null, revise: null, move, fig, target: 14, taken: 0, firstDay: true });
  const row = layers.today.items[0];
  assert.deepEqual(row.key, { label: 'Start now', minutes: 10 });
  assert.equal(row.detail, '10 questions', 'the minutes are on the key, so the detail says what the session holds');
  const road = read('src/components/today/TodayRoad.jsx');
  assert.match(road, /\{i\.id === 'revise' \? 'Start Revise' : i\.key\?\.label \|\| 'Start'\}/);
  assert.doesNotMatch(road, /'Revise now'/);
});

// ---- The first-week rail (N1, #7, #4): names on wide screens, a tap says each mark's line, an early tick is explained ----------

import { firstWeekPath, markLine, railCaption, STEP_PROMISE } from '../../src/lib/today/firstWeek.mjs';

const NOW10 = Date.parse('2026-10-18T14:00:00Z');
const DAY10 = 86400000;
const pathOn = (day, o = {}) => firstWeekPath({
  now: NOW10, firstAt: day === 1 ? null : new Date(NOW10 - (day - 1) * DAY10).toISOString(), sessions: day === 1 ? 0 : 1,
  papers: day === 1 ? [] : [{ id: 'p1', subject: 'accountancy', mode: 'quick', correct: 5, wrong: 4, unattempted: 1, total: 10, completedAt: NOW10 - DAY10 }],
  repaired: day === 1 ? new Map() : new Map([['p1', 1]]), repairs: day === 1 ? 0 : 1, mocks: 0,
  revise: null, road: { onAccount: true, examDate: null, mockTarget: null }, weekdays: null,
  subjects: ['accountancy', 'economics'], facts: { sessions: 1, mocks: 0, subject: 'accountancy' }, firstSubject: 'accountancy', premium: false, length: 10, ...o,
});

test('first week: the caption says what the next step brings, and a step done before its day is explained', () => {
  const p1 = pathOn(1);
  assert.equal(railCaption(p1, true), 'Tomorrow: your first mistakes come back.');
  const early = pathOn(1, { road: { onAccount: true, examDate: '2027-05-08', mockTarget: null } });
  const plan = early.steps.find((s) => s.id === 'plan');
  assert.equal(plan.done, true);
  assert.equal(plan.early, true, 'done before its day');
  assert.equal(railCaption(early, true), 'Tomorrow: your first mistakes come back. Day 7 is done already: your plan is set.');
  for (const id of ['revise', 'aim', 'spread', 'mock', 'lab', 'plan']) assert.match(STEP_PROMISE[id], /^[a-z].*\.$/, id);
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /data-early=\{s\.early \|\| undefined\}/);
  assert.match(css('src/components/today/today.css'), /\.tm__step\[data-early\] \{ background: var\(--a-ink-3\); \}/);
});

test('first week: a tapped mark says its own line; from 1024 px the marks carry names, not digits', () => {
  const p = pathOn(3);
  const spread = p.steps.find((s) => s.id === 'spread');
  assert.equal(markLine(p, spread, NOW10), 'Day 4: a second subject joins in. Comes up tomorrow.');
  const mock = p.steps.find((s) => s.id === 'mock');
  assert.match(markLine(p, mock, NOW10), /^Day 5: your first full mock\. Comes up (Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.$/);
  const start = p.steps.find((s) => s.id === 'start');
  assert.equal(markLine(p, start, NOW10), 'Day 1: ten questions find your starting point. Done.');
  assert.deepEqual(p.steps.map((s) => s.short), ['Start', 'Revise', 'Aim', 'Subject', 'Mock', 'Lab', 'Plan']);
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /@media \(min-width: 1024px\) \{\s*\.app-shell \.tm__rail \{ width: min\(100%, 392px\); \}\s*\.app-shell \.tm__step\[data-day\]::before \{ content: attr\(data-short\);/);
  assert.match(sheet, /\.tm__step-hit \{[^}]*width: 28px; height: 44px;/);
});

// ---- Road to CUET (#4, D6): the stops look openable; the goal readout is three plain lines with no disclaimer line -------------

import { goalLines, mockPace } from '../../src/lib/today/road.mjs';

test('Road: the overall goal reads as three lines, the NTA caveat folded into "expected"', () => {
  const g = { pace: mockPace({ target: 14, taken: 0, days: 196 }), studyDays: 94, goal: 4, own: false, next: { id: 'registration', day: '2027-02-01', when: 'in 15 weeks', title: 'CUET registration is expected to open' } };
  assert.deepEqual(goalLines({ goal: g, taken: 0 }), [
    '14 full mocks to go: about one a fortnight.',
    '94 study days at 4 a week; board-exam weeks ease to 2.',
    'Next: CUET registration expected Mon 1 Feb, in 15 weeks.',
  ]);
  assert.equal(goalLines({ goal: { ...g, goal: 2 }, taken: 0 })[1], '94 study days at 2 a week.', 'no easing to mention at 2 a week');
  assert.equal(goalLines({ goal: g, taken: null })[0], 'Your full mocks did not load.');
  const road = read('src/components/today/TodayRoad.jsx');
  assert.doesNotMatch(road, /NTA has not published|Board weeks count as 2/);
  assert.match(road, /<ChevronDown className="trd__chev" size=\{14\}/);
  assert.match(css('src/components/today/today.css'), /\.trd__stop\[aria-pressed='true'\] \.trd__chev \{ transform: rotate\(180deg\);/);
});

test('Weak chapters: the misses say they open (chevron, no bare "+"); rows after the first get a round Play key up to 600 px', () => {
  const weak = read('src/components/today/TodayWeak.jsx');
  assert.doesNotMatch(weak, /<Plus /);
  assert.match(weak, /<span className="twk__peek">\{missed\} of \{c\.n\} missed<ChevronDown className="twk__plus"/);
  assert.match(weak, /data-compact=\{i > 0 \|\| undefined\}/);
  assert.match(weak, /aria-label=\{`Practise \$\{c\.chapter\}`\}/, 'the round key keeps its name');
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.twk__open\[aria-expanded='true'\] \.twk__plus \{ transform: rotate\(180deg\); \}/);
  assert.match(sheet, /@media \(max-width: 600px\) \{[\s\S]*?li\[data-compact\] \.twk__practise \{ position: relative; justify-self: end; width: 40px;[\s\S]*?li\[data-compact\] \.twk__practise::after \{ content: ''; position: absolute; inset: -2px; \}/, 'a 44 px hit area');
});

test('More ways to practise: rows look pressable (picture, chevron, press) and the intro is bolder', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /lede=\{`Pick what fits \$\{when\}\. Each one opens straight in\.`\}/);
  assert.match(move, /<AltTile item=\{a\} \/>/);
  assert.match(move, /<ChevronRight className="tsh__chev" size=\{16\}/);
  assert.doesNotMatch(move, /Each one, and why it might be your next move/);
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tsh__row \{[^}]*grid-template-columns: 36px minmax\(0, 1fr\) 16px;[^}]*min-height: 64px;/);
  assert.match(sheet, /\.tsh__row:active \{ background: var\(--a-hover\);/);
});
