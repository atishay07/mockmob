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
