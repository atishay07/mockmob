// node --test src/components/daily/dailyStripCopy.test.mjs
// The home page's Daily Five and Sunday Mock block (dailyStripCopy.mjs, DailyFiveRow.jsx HomeBlock; 16 Nov 2026, 10:25 pm, the
// owner: "a very small subsection, not something important ... the visual hierarchy is not here"): the week rail, what each
// card says in each state (the state and its time first), that every figure is the product's own constant, that the block
// carries one volt key, where it stands on the page (low, never under the hero's sample again) and that the day's number is
// gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAILY_FIGURES, DAILY_LINE, STRIP_HEAD, SUNDAY_FIGURES, SUNDAY_LINE, SUNDAY_LINE_SHORT, dailyRow, omrLabel, sundayRow, waitWords,
} from './dailyStripCopy.mjs';
import { DAILY_FIVE_PATH, DAILY_FIVE_SIZE } from '../../lib/dailyFive.mjs';
import { PAPER_COUNT, PAPER_MINUTES } from '../../lib/sundayMock.mjs';
import { BRAND_STAMPS } from '../landing/homeCopy.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const HOUR = 60 * 60 * 1000;
const IST = (s) => Date.parse(`${s}+05:30`);

test('the Daily Five card: open, begun and played each lead with the state and its time', () => {
  const open = dailyRow({ waitMs: 5 * HOUR + 50 * 60 * 1000 });
  assert.equal(open.state, 'open');
  assert.equal(open.status, 'Open today');
  assert.equal(open.when, '5 h 50 min left');
  assert.equal(open.go, 'Play today’s five');
  assert.equal(open.href, DAILY_FIVE_PATH);
  const begun = dailyRow({ begun: true, at: 3, waitMs: HOUR });
  assert.deepEqual([begun.state, begun.status, begun.when, begun.go], ['begun', 'You are on question 3', '1 h left', 'Continue']);
  assert.equal(dailyRow({ begun: true, at: 9, waitMs: HOUR }).status, 'You have started', 'a question that is not one of the five is not named');
  const played = dailyRow({ result: { score: 4, clock: '1:32' }, streak: 3, waitMs: 2 * HOUR });
  assert.deepEqual([played.state, played.status, played.when, played.go], ['played', 'Done today, 4/5', '3 days in a row', 'See your result']);
  assert.equal(dailyRow({ result: { score: 5, clock: '0:58' }, streak: 1, waitMs: HOUR }).when, 'Next five in 1 h', 'a first day has no run to show');
  assert.equal(dailyRow({}).when, '', 'no clock read yet: no time is claimed');
  for (const row of [open, begun, played]) {
    assert.equal(row.line, DAILY_LINE, 'the sentence says what it is in every state');
    assert.equal(row.figures, DAILY_FIGURES);
  }
});

test('the Daily Five says what it is in one sentence and three true figures', () => {
  assert.match(DAILY_LINE, /^The same five for everyone today/);
  assert.match(DAILY_LINE, /from English and the General Test\.$/);
  assert.deepEqual(DAILY_FIGURES.map((f) => `${f.figure}${f.unit ? ` ${f.unit}` : ''}`), [`${DAILY_FIVE_SIZE} questions`, 'Free', 'No sign-up']);
});

test('the Sunday Mock card through a week: the wait, Saturday, Sunday morning, open, the close, the answers, the next one', () => {
  const at = (s) => sundayRow({ now: IST(s) });
  assert.deepEqual([at('2026-11-18T14:00:00').status, at('2026-11-18T14:00:00').when], ['Opens Sunday, 10:00 am', 'In 3 days']);
  assert.deepEqual([at('2026-11-16T09:00:00').status, at('2026-11-16T09:00:00').when], ['Opens Sunday, 10:00 am', 'In 6 days']);
  assert.deepEqual([at('2026-11-21T18:00:00').status, at('2026-11-21T18:00:00').when], ['Opens tomorrow, 10:00 am', 'In 16 h']);
  assert.equal(at('2026-11-21T09:00:00').when, 'In 25 h', 'Saturday counts in hours, never "In 1 day" beside "tomorrow"');
  assert.deepEqual([at('2026-11-22T08:00:00').status, at('2026-11-22T08:00:00').when], ['Opens today at 10:00 am', 'In 2 h']);
  const open = at('2026-11-22T11:00:00');
  assert.deepEqual([open.phase, open.status, open.when, open.open], ['open', 'Open now until 10:00 pm', '11 h left', true]);
  assert.deepEqual([open.go, open.href], ['Sit today’s paper', '/sunday'], 'while open, the key starts it');
  const closing = at('2026-11-22T22:30:00');
  assert.deepEqual([closing.phase, closing.status, closing.when, closing.open], ['closing', 'Closed for new starts', 'Answers at 11:05 pm', false]);
  const next = at('2026-11-22T23:30:00');
  assert.deepEqual([next.phase, next.status, next.when], ['next', 'Next one Sunday 29 Nov', 'In 6 days, at 10:00 am']);
  for (const row of [at('2026-11-18T14:00:00'), closing, next]) assert.deepEqual([row.go, row.href, row.open], ['See how Sunday works', '/sunday-mock', false]);
  // Before the launch week (never true again on the live clock): the first paper's date, never a Sunday that had none.
  const early = at('2026-11-12T12:00:00');
  assert.deepEqual([early.status, early.when, early.week], ['First one Sunday 22 Nov', 'In 9 days, at 10:00 am', '2026-11-22']);
  const unknown = sundayRow({});
  assert.deepEqual([unknown.phase, unknown.status, unknown.when, unknown.open], ['unknown', '', '', false]);
  assert.equal(waitWords(0), 'under a minute');
});

test('the Sunday Mock\'s figures are the rule\'s own numbers, and its sentence says it needs an account', () => {
  assert.deepEqual(SUNDAY_FIGURES.map((f) => `${f.figure}${f.unit ? ` ${f.unit}` : ''}`), [`${PAPER_COUNT} questions`, `${PAPER_MINUTES} minutes`, 'Free']);
  assert.match(SUNDAY_LINE, /^One full paper in each of your subjects, the same for everyone\./);
  assert.match(SUNDAY_LINE, /Sign up to sit it\.$/);
});

test('the five\'s bubbles in one sentence: today on this device, as it stands', () => {
  assert.equal(omrLabel(null), 'Today’s 5 questions, none answered on this device yet.');
  assert.equal(omrLabel([true, false, true, true, false]), 'Today on this device: 3 of 5 right.');
  assert.equal(omrLabel([true, null, null, null, null], 1), 'Today on this device: on question 2 of 5.');
  assert.equal(omrLabel([true, null, null, null, null], 9), 'Today’s 5 questions, none answered on this device yet.');
});

test('the head says the game in two beats; the Sunday card\'s short sentence keeps the account', () => {
  assert.equal(STRIP_HEAD.h2, 'Five a day. Play for your college.');
  assert.match(STRIP_HEAD.sub, /English and General Test/);
  assert.match(STRIP_HEAD.sub, /DU college/);
  // A guest's five is kept on the device alone: only a signed-in five counts for a college (review, 17 Nov 2026).
  assert.match(STRIP_HEAD.sub, /play signed in counts for/);
  assert.match(SUNDAY_LINE_SHORT, /^One full paper in each of your subjects\. Sign up to sit it\.$/);
});

test('the block\'s college words are what the server counted; See all says its own words to a screen reader (review)', () => {
  const jsx = read('./DailyFiveRow.jsx');
  // A link's spoken name holds the words on it (WCAG 2.5.3), so "See all" works by voice too.
  for (const m of jsx.matchAll(/aria-label="([^"]+)"[^>]*>([^<{]+)</g)) assert.ok(m[1].toLowerCase().includes(m[2].trim().toLowerCase()), `${m[1]} / ${m[2]}`);
  assert.match(jsx, /aria-label="See all of the college board">See all</);
  // Today's row names the college today's five counted for (the account's), never a choice this phone made since.
  assert.match(jsx, /const counted = fromAccount && account\.team && account\.team\.last === today\.date/);
  assert.match(jsx, /\$\{counted \? ` for \$\{counted\}` : ''\}/);
  // The choice is kept with its account on a shared phone: both doors that know the student pass who it is.
  assert.match(jsx, /useTeamChoice\(\{ today: date, account: account\?\.team \|\| null, userId: /);
  const page = read('./DailyFive.jsx');
  assert.match(page, /useTeamChoice\(\{ today: today\?\.date \|\| null, account: accountReady \? account\.team : null, userId \}\)/);
  assert.equal((page.match(/shareText\(result, shareCollege\)/g) || []).length, 2, 'the share line names the college today counted for');
});

test('no exclamation marks, arrows, upper-case times, ranks or day numbers in any state', () => {
  const rows = [
    dailyRow({ waitMs: HOUR }), dailyRow({ begun: true, at: 2, waitMs: HOUR }), dailyRow({ result: { score: 3, clock: '2:00' }, streak: 2, waitMs: HOUR }),
    ...['2026-11-18T14:00:00', '2026-11-21T18:00:00', '2026-11-22T08:00:00', '2026-11-22T11:00:00', '2026-11-22T22:30:00', '2026-11-22T23:30:00'].map((s) => sundayRow({ now: IST(s) })),
  ];
  const all = JSON.stringify([STRIP_HEAD, ...rows, SUNDAY_LINE_SHORT, omrLabel(null), omrLabel([true, false, true, true, true])]);
  assert.doesNotMatch(all, /!|→|->|\bNo\. \d|\b(rank|percentile)\b/i);
  assert.doesNotMatch(all, /\d:\d{2} (AM|PM)/, 'times in lower case');
});

test('the block stands low on the home page, after the exam screen, and heads like every other product on it', () => {
  const page = read('../../app/page.js');
  const block = page.indexOf('id="daily-and-sunday"');
  assert.ok(block > page.indexOf('<ExamScreen />'), 'after the exam screen');
  assert.ok(block < page.indexOf('id="compass"'), 'before admissions');
  const sample = page.slice(page.indexOf('id="try"'), page.indexOf('<Statement'));
  assert.doesNotMatch(sample, /DailyFiveRow/, 'not under the sample');
  assert.equal((page.match(/<DailyFiveRow where="home" \/>/g) || []).length, 1);
  const section = page.slice(block, page.indexOf('</section>', block));
  assert.match(section, /<BrandStamp \{\.\.\.BRAND_STAMPS\.rhythm\} \/>\n\s*<h2 className="lp-h2" id="rhythm-title">/, 'a stamp right above a full-size h2');
  assert.deepEqual(BRAND_STAMPS.rhythm, { icon: 'today', name: 'Daily Five and Sunday Mock' });
  // The head's own size, not the old strip's smaller one.
  assert.doesNotMatch(read('./daily-row.css'), /lp-rhythm[^{]*\.lp-h2\s*\{[^}]*font-size/);
});

test('the block carries one volt key: the Sunday Mock\'s while its paper is open, else the Daily Five\'s', () => {
  const jsx = read('./DailyFiveRow.jsx');
  assert.match(jsx, /<Link href=\{daily\.href\} className="dwk-key" data-lead=\{!sunday\.open \? 'true' : 'false'\}>/);
  assert.match(jsx, /<Link href=\{sunday\.href\} className="dwk-key" data-lead=\{sunday\.open \? 'true' : 'false'\}>/);
  assert.equal((jsx.match(/className="dwk-key"/g) || []).length, 2);
  // Nothing in the block pulses, flashes or plays by itself.
  assert.doesNotMatch(read('./daily-row.css').split('---------- Today')[0], /@keyframes|animation:/);
});

test('the day’s number is shown nowhere: not on the block, not on Today’s row, not on /daily', () => {
  for (const file of ['./DailyFiveRow.jsx', './DailyFive.jsx']) assert.doesNotMatch(read(file), /No\. \{|`No\. \$\{/, file);
});

test('the admit card is ours: no ink band, no date slab; the edition by name, Playing for, the bubbles and the college board', () => {
  const jsx = read('./DailyFiveRow.jsx');
  for (const gone of ['CalendarDay', 'dwk-band', 'dwk-rail', 'df-day']) assert.doesNotMatch(jsx, new RegExp(gone), gone);
  assert.match(jsx, /editionName\(today\.date\)/);
  assert.match(jsx, /<PlayingFor team=\{team\} onOpen=\{\(\) => setSheet\(true\)\} \/>/);
  assert.match(jsx, /<CollegeBoard[\s\S]*?mode="preview"/);
  assert.match(jsx, /<CollegeSheet open=\{sheet\}/);
  const page = read('./DailyFive.jsx');
  for (const gone of ['<CalendarDay', 'DailyBoard']) assert.doesNotMatch(page, new RegExp(gone), gone);
  assert.match(page, /<section className="dly-board" id="board"/);
  assert.match(page, /\.\.\.\(teamRef\.current \? \{ for: teamRef\.current \} : \{\}\)/, 'every check carries the college');
  const css = read('./daily-row.css') + read('./daily-team.css');
  assert.doesNotMatch(css, /animation:\s*[a-z-]+ [^;]*infinite|@keyframes [a-z-]*pulse/i, 'nothing pulses or loops');
});
