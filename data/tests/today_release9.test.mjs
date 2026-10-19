// Website release 9, the Today packet (ledger audit of release 8, 18 Oct): the fixes the owner's approved Today still needed, each held
// by a test that would have caught it.
//   D28    the server and the first paint drew "Good evening" at any hour and no date
//   W-042  the lead landed 240 to 400 ms before This week, Road to CUET and Weak chapters
//   W-044  the phone cue sat behind the dock at 390 x 844
//   D27    a raised "Due today" tile inside the Road card; "Today already counts toward your week" twice; "4 of 4 study days" against
//          "5 of 5 days and a mock"; "See all 6 Why this?" read as one phrase
//   F18    the first-week rail did not read as a path, and its overline called a check day the day's step
//   LOW    the "Why this?" answer restated the card, and its counts disagreed with the record chip
// Run: node --test data/tests/today_release9.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { greeting, greetingAt } from '../../src/lib/today/greeting.mjs';
import { weekDays, weekCaption, weekMarks, dayReadout } from '../../src/lib/today/week.mjs';
import { buildMove } from '../../src/lib/today/move.mjs';
import { firstWeekPath, pathLeads, railCaption } from '../../src/lib/today/firstWeek.mjs';
import { coversCue, belowFold, CUE_FOLD, CUE_SCROLLED } from '../../src/lib/today/cue.mjs';
import { todayContext, todayAnswer } from '../../src/components/ai/askContexts.mjs';
import { normalizeContext } from '../../src/components/ai/askMobi.mjs';
import { openingFor, recordSource, sessionsLabel } from '../../src/components/ai/askSuggestions.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, '');
const NOW = Date.parse('2026-10-18T14:00:00Z'); // Sunday 18 Oct, 7:30 PM IST
const DAY = 86400000;
const subjectName = (id) => ({ accountancy: 'Accountancy', economics: 'Economics', english: 'English' })[id] || id;

// ---- D28: no time-of-day greeting before this device's clock is read ---------------------------------------------------------------

test('D28: an unknown hour gives no greeting at all; a known hour gives the same greeting as before', () => {
  for (const hour of [null, undefined, NaN, -1, 24, 18.5, '18']) assert.equal(greetingAt({ hour, name: 'Asha' }), null, String(hour));
  assert.equal(greetingAt({ hour: 2, name: 'Asha' }), 'Hello, Asha', '2:41 am is never "Good evening"');
  for (const hour of [0, 4, 5, 11, 12, 16, 17, 23]) assert.equal(greetingAt({ hour, name: 'Asha' }), greeting({ hour, name: 'Asha' }));
  assert.equal(greetingAt({ hour: 2, returning: true }), 'Welcome back');
});

test('D28: the server snapshot of the hour and the date is null, so the SSR HTML holds no greeting and no guessed date', () => {
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /useSyncExternalStore\(noSubscribe, hourNow, \(\) => null\)/);
  assert.match(page, /useSyncExternalStore\(noSubscribe, dayLine, \(\) => null\)/);
  assert.doesNotMatch(page, /hourNow, \(\) => \d/, 'no default hour (it was 18, "Good evening")');
  assert.match(page, /const hello = greetingAt\(\{ hour,/);
  assert.match(page, /\{hello \? <span className="today__in">\{hello\}<\/span> : <span className="sr-only">Today<\/span>\}/, 'the h1 is blank to the eye until the hour is known');
  assert.match(page, /\{day \? <time className="today__in">\{day\}<\/time> : ' '\}/);
  assert.match(page, /const word = hour != null && \(hour >= 17 \|\| hour < 4\)/, 'no "Tonight" from a missing hour either');
  // Reserved height: both lines keep one line's height while blank, so nothing below moves when the words arrive.
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.today__date \{ min-height: 1\.5em; line-height: 1\.5; \}/);
  assert.match(sheet, /\.today__hello \{ min-height: 1\.12em; \}/);
  assert.match(sheet, /\.today__in \{ animation: today-fade 180ms var\(--t-out\) both; \}/, 'the words fade in, inside the 150 to 350 ms band');
});

// ---- W-042: the first screen lands in one piece ----------------------------------------------------------------------------------

test('W-042: the lead holds for the rhythm, the road, the study days and the record, under the same 1.5 s cap', () => {
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /const holdForPage = !waitedOut && \(\[data\.rhythm, data\.road, data\.goal, insights\]\.some\(\(r\) => r\.status === 'loading'\) \|\| Boolean\(userId && !premium && dailySet === 'unknown'\)\s*\|\| Boolean\(userId && !premium && mockSubject && mockLeads && firstFullState === 'unknown'\)\)/, 'the price line waits for the allowance read too (and a mock lead for its free-first-mock read), under the same cap');
  assert.match(page, /window\.setTimeout\(\(\) => setWaitedOut\(true\), 1500\)/, 'capped at 1.5 s, the same clock as holdForStep');
  assert.match(page, /const phase = holdForStep \|\| holdForPage \? 'loading' :/);
  // The glance column and Weak chapters wait on `landing`, which follows the lead's phase: they release together.
  assert.match(page, /const landing = phase === 'loading' \|\|/);
  assert.match(page, /<TodayWeek\s+hold=\{landing\}/);
  assert.match(page, /<TodayRoad\s+hold=\{landing\}/);
  assert.match(page, /<TodayWeak [^>]*hold=\{landing\}/);
});

// ---- W-044: the cue leads below the card and never covers a control -----------------------------------------------------------

test('W-044 (release 10): the cue is a 40 px glass circle centred above the dock, clear of it, out of the flow', () => {
  const arena = css('src/app/(app)/arena.css');
  const dock = arena.match(/@media \(max-width: 1023px\) \{\s*html \.app-shell \.arena-dock \{([^}]*)\}/);
  assert.ok(dock, 'the phone dock rule');
  const bottom = Number(dock[1].match(/bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/)[1]);
  const height = Number(dock[1].match(/height: (\d+)px/)[1]);
  const sheet = css('src/components/today/today.css');
  const cue = sheet.match(/\.app-shell \.tcue \{([^}]*)\}/)[1];
  assert.match(cue, /position: fixed/, 'out of the flow: no dead band between the card and This week');
  assert.match(cue, /left: 50%;[^}]*transform: translateX\(-50%\)/, 'centred above the dock (release 10), not in the right cell swap corner');
  const above = Number(cue.match(/bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/)[1]);
  assert.ok(above >= bottom + height + 8, 'its bottom edge is at least 8 px above the top of the dock');
  assert.doesNotMatch(cue, /margin: -/, 'no negative margins pulling it over the card');
  assert.match(sheet, /@media \(min-width: 1024px\) \{ \.app-shell \.tcue \{ bottom: calc\(16px \+ env\(safe-area-inset-bottom\)\); \} \}/, 'no dock from 1024 px');
  const key = sheet.match(/\.app-shell \.tcue__key \{([^}]*)\}/)[1];
  assert.match(key, /min-height: 40px/);
  assert.match(key, /min-width: 40px/);
  assert.match(sheet, /\.app-shell \.tcue__key::before \{ content: ''; position: absolute; inset: -2px;/, 'its tap area reaches 44 px');
  assert.doesNotMatch(key, /accent|volt|glow/);
  const comp = read('src/components/today/TodayCue.jsx');
  assert.match(comp, /Your week and road/);
  assert.match(comp, /setTimeout\(\(\) => setWide\(false\), 2400\)/, 'the words fold to the circle after 2.4 s');
  assert.match(comp, /const KEEP_CLEAR = '\.tm \.tm__key, \.tm \.tm__why';/, 'only the key and the reason are off-limits; the footer may pass under the glass');
  assert.match(comp, /if \(window\.scrollY >= CUE_SCROLLED\) setScrolled\(true\);/, 'the first scroll of 24 px steps it away');
});

test('W-044 (release 10): coversCue says when a key sits under the centred circle; belowFold says when it shows', () => {
  const size = { height: 844, width: 390 };
  assert.equal(coversCue({ top: 700, bottom: 756, left: 16, right: 374 }, size), true, 'a full-width key in the band');
  assert.equal(coversCue({ top: 500, bottom: 560, left: 16, right: 374 }, size), false, 'a key above the band');
  assert.equal(coversCue({ top: 700, bottom: 756, left: 16, right: 150 }, size), false, 'a left word clear of the centre');
  assert.equal(coversCue({ top: 700, bottom: 756, left: 16, right: 150 }, { ...size, half: 90 }), true, 'the wide pill reaches further');
  assert.equal(coversCue(null, size), false);
  assert.equal(belowFold(878, 844), true, 'the week at 878 px on a 390 x 844 phone: shown');
  assert.equal(belowFold(748, 844), false, 'the week within 96 px of the bottom: seen');
  assert.equal(CUE_FOLD, 96);
  assert.equal(CUE_SCROLLED, 24);
});

test('W-044 (release 9 audit intent, kept in release 10): the cue never blinks while scrolling and never covers the key or the reason', () => {
  // Release 9 put the cue in the flow so it could not cover a control or blink; release 10 (taste, W-044 "barely seen") pins a glass
  // circle above the dock instead. Both intents hold: it steps away for good on the first 24 px scroll (kept for the visit, so it
  // cannot come back and blink), it steps away while the card's key or reason is under it, and once away it takes no tap or focus.
  const cue = read('src/components/today/TodayCue.jsx');
  assert.doesNotMatch(cue, /setScrolled\(false\)/, 'scrolled is kept for the visit');
  assert.match(cue, /const away = seen \|\| covered \|\| scrolled;/);
  assert.match(cue, /const hidden = away \|\| !ready;/, 'faded out means out of the tab order and the reading order too');
  assert.match(cue, /tabIndex=\{hidden \? -1 : 0\} aria-hidden=\{hidden \|\| undefined\}/);
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.app-shell \.tcue\[data-seen\] \.tcue__key/, 'the key takes no tap once faded');
});

// ---- D27: the Road card -------------------------------------------------------------------------------------------------------

test('D27: the tapped Road stop is an ink underline, not a raised tile inside the outlined card', () => {
  const sheet = css('src/components/today/today.css');
  const sel = sheet.match(/\.app-shell \.trd__sel::before \{([^}]*)\}/)[1];
  assert.match(sel, /height: 2px/);
  assert.match(sel, /bottom: 0/);
  assert.doesNotMatch(sel, /raised|box-shadow|inset: 0/, 'no fill, no border: no card in a card');
});

test('D27: "Today already counts toward your week" is This week\'s line only', () => {
  const road = read('src/components/today/TodayRoad.jsx').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  assert.doesNotMatch(road, /already counts/, 'Road to CUET no longer repeats it');
  assert.match(read('src/lib/today/week.mjs'), /Counted at \$\{first\}\./, 'This week says it once, as "Counted at" (release 10)');
  assert.match(road, /i\.id === 'session' && i\.done\) \? day\.left/, 'the road says what is left today instead');
});

test('D27: one count of the week\'s study days, in one wording, in This week and in Road to CUET', () => {
  assert.deepEqual(weekDays({ studyDays: 4, daysGoal: 4 }), { done: 4, total: 4, text: '4 of 4 study days' });
  assert.deepEqual(weekDays({ studyDays: 0, daysGoal: 1 }), { done: 0, total: 1, text: '0 of 1 study day' });
  assert.equal(weekDays({ studyDays: 3, daysGoal: null }), null, 'unknown goal: no count, never "3 of 0"');
  assert.equal(weekDays({ daysGoal: 4 }), null, 'unknown days: never 0');
  assert.equal(weekDays(null), null);
  const week = read('src/components/today/TodayWeek.jsx');
  assert.match(week, /const count = weekDays\(r\)/);
  assert.match(week, /<b>\{count\.done\}<\/b><span className="tg__of">of \{count\.total\}<\/span>/);
  const road = read('src/components/today/TodayRoad.jsx');
  assert.match(road, /const weekCount = weekDays\(rhythmNow\)/);
  assert.match(road, /figure: weekCount \? weekCount\.done : '\?', of: weekCount \? `of \$\{weekCount\.total\}` : ''/);
  assert.doesNotMatch(road.replace(/^\s*\/\/.*$/gm, ''), /days and a mock|days and mocks/, 'the mock is never folded into the days');
  assert.match(road, /`and \$\{mocksItem\.done\} of \$\{mocksItem\.total\} full \$\{mocksItem\.total === 1 \? 'mock' : 'mocks'\}`/, 'the week\'s mock is its own line');
  assert.match(road, /<Stretch done=\{weekCount \? Math\.min\(weekCount\.done, weekCount\.total\) : 0\} total=\{weekCount \? weekCount\.total : 0\} order=\{1\} \/>/, 'the stretch draws the same days');
});

test('D27: a returning card keeps "See all 6 mistakes", in the footer, apart from "Why this?" in the reason', () => {
  const base = { plan: { primary: { kind: 'ordinary_practice', title: 'x', href: '/dashboard', reason: 'x', facts: [] }, tonight: { state: 'ready' } }, revise: { due: 0 }, facts: { sessions: 9, mocks: 2, subject: 'accountancy' }, subjectName, now: NOW };
  const last = { id: 'p1', subject: 'accountancy', mode: 'full', correct: 30, wrong: 6, unattempted: 14, total: 50, marks: 144, maxMarks: 250, completedAt: NOW - 9 * DAY };
  const m = buildMove({ ...base, papers: [last], repaired: new Map(), rhythm: { weekStart: '2026-10-12', studyDays: 0, studyDayDates: [], daysGoal: 4, daysSinceLastActivity: 9, counts: { sessions: 9, repairs: 2 } } });
  assert.equal(m.id, 'returning');
  assert.equal(m.link.label, 'See all 6 mistakes', 'nothing is cut, and it says what it lists');
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /\{m\.link && !askContext \? <> <Link className="tm__inline" href=\{m\.link\.href\}>/, 'in the reason only when there is no "Why this?"');
  assert.match(move, /<div className="tm__more" data-split=\{moved && alternatives\.length \? '' : undefined\}>\s*\{moved \? <Link className="tm__all" href=\{m\.link\.href\}>\{m\.link\.label\}<\/Link> : null\}/, 'it shares the footer row with More ways to practise');
  assert.doesNotMatch(move.match(/<div className="tm__value">[\s\S]*?<\/div>/)[0], /m\.link/, 'never on the value line, where it wrapped at 390 px');
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tm__more \.tm__all \{[^}]*min-height: 50px/, 'a full-height target');
});

// ---- F18: the first-week path reads as a path, and a check day is never called the day's step --------------------------------

const firstAtDay = (n) => new Date(NOW - (n - 1) * DAY).toISOString();
const paper = (o = {}) => ({ id: 'p1', subject: 'accountancy', mode: 'quick', correct: 5, wrong: 4, unattempted: 1, total: 10, marks: 21, maxMarks: 50, completedAt: NOW - DAY, ...o });
const top = { subject: 'accountancy', chapter: 'Partnership Fundamentals', open: 30, sessions: 2, wrong: 5, skip: 1, n: 18 };
const ctx = (day, o = {}) => ({
  now: NOW, firstAt: firstAtDay(day), sessions: 1, papers: [paper()], repaired: new Map([['p1', 1]]), repairs: 1, mocks: 0,
  revise: { due: 4, dueTotal: 4, minutes: 5, recalled: true, answeredToday: 0, subjects: ['accountancy'] }, road: { onAccount: true, examDate: null, mockTarget: null }, weekdays: null,
  subjects: ['accountancy', 'economics', 'english'], top, facts: { sessions: 1, mocks: 0, subject: 'accountancy' }, firstSubject: 'accountancy',
  premium: false, length: 10, subjectName, daysPerWeek: 4, ...o,
});

test('F18: the overline says the day only when the card shows the day\'s step', () => {
  const p3 = firstWeekPath(ctx(3));
  assert.equal(p3.step, 'aim');
  assert.equal(pathLeads(p3, p3.move), true, 'the day 3 step leads: "Day 3 of your first week"');
  assert.equal(pathLeads(p3, { id: 'check', title: 'Check it held: Goodwill' }), false, 'a check day is not the day\'s step');
  for (const id of ['resume', 'returning', 'done', 'failed']) assert.equal(pathLeads(p3, { id }), false, id);
  assert.equal(pathLeads(p3, p3.move, { picked: true }), false, 'the student\'s pick');
  assert.equal(pathLeads(p3, { id: 'revise' }), false, 'a regular move that leads instead of the step');
  // Day 1's step (find, then fix) is led by the regular move itself.
  const p1 = firstWeekPath(ctx(1, { sessions: 0, papers: [], repaired: new Map(), repairs: 0, firstAt: null, revise: null }));
  assert.equal(pathLeads(p1, { id: 'dayOne' }), true);
  assert.equal(pathLeads(p1, { id: 'check' }), false);
  assert.equal(pathLeads(null, { id: 'dayOne' }), false);
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /const week = pathLeads\(path, m, \{ picked \}\)/);
  assert.match(move, /: week \? `Day \$\{path\.day\} of your first week` : 'Up next'/, 'otherwise it is "Up next"');
});

test('F18: one line under the rail names today\'s step and the next, so the seven marks read as a path', () => {
  const p3 = firstWeekPath(ctx(3));
  assert.equal(railCaption(p3, true), 'Tomorrow: a second subject joins in.', 'release 10: what the next step brings');
  assert.equal(railCaption(p3, false), 'Day 3 of 7: Weak chapters next.', 'a check leads; the step waits behind it, named');
  const p7 = firstWeekPath(ctx(7, { mocks: 1, facts: { sessions: 4, mocks: 1, subject: 'accountancy' }, sessions: 4, papers: [paper({ id: 'm1', mode: 'full' }), paper({ id: 'e1', subject: 'economics' })], repaired: new Map([['m1', 2], ['e1', 1]]), repairs: 3, road: { onAccount: true, examDate: null, mockTarget: null } }));
  assert.equal(p7.today, 'plan');
  assert.equal(railCaption(p7, true), 'The last step of your first week.');
  // One subject only: day 4's step does not apply, so the day says what is next.
  const p4 = firstWeekPath(ctx(4, { subjects: ['accountancy'], sessions: 2 }));
  assert.equal(railCaption(p4, false), 'Day 4 of 7. Tomorrow: your first full mock.');
  // Today's step done: it says so, and what comes next.
  const done3 = firstWeekPath(ctx(3, { sessions: 2 }));
  assert.equal(railCaption(done3, false), 'Day 3 of 7: Weak chapters, done. Tomorrow: a second subject joins in.');
  assert.equal(railCaption(null), '');
  for (const p of [p3, p7, p4, done3]) for (const leads of [true, false]) {
    const line = railCaption(p, leads);
    assert.doesNotMatch(line, /!|→|streak|missed|behind/i, line);
    assert.ok(line.length <= 80, `two short lines at most: ${line}`);
  }
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /const caption = path\?\.day \? railCaption\(path, week\) : ''/);
  assert.match(move, /\{caption \|\| mark \? <p className="tm__path" key=\{mark \|\| 'caption'\}>\{mark \? markLine\(path, path\.steps\.find\(\(s\) => s\.day === mark\)\) : caption\}<\/p> : null\}/, 'release 10: a tapped mark says its own line in its place');
  assert.match(move, /className="tm__step" data-state=\{s\.state\} data-day=\{s\.day\}/, 'each mark carries its day');
  const sheet = css('src/components/today/today.css');
  assert.match(sheet, /\.tm__step\[data-day\]::before \{ content: attr\(data-day\);/, 'the day number is drawn under its mark');
  assert.match(sheet, /\.tm__path \{[^}]*color: var\(--a-ink-2\)/);
  assert.doesNotMatch(sheet.match(/\.tm__path \{[^}]*\}/)[0], /accent|volt/, 'no volt: the key is the card\'s one');
});

// ---- The "Why this?" answer: what the card does not say, counted from the chip's own read ---------------------------------------

const LAST = Date.parse('2026-10-15T10:23:00Z'); // Thu 15 Oct, 3:53 PM IST
const INSIGHTS = {
  state: 'ready', sessions: 3, questions: 26,
  ledger: { net: 40, open: 120 },
  chapters: {
    ranked: [
      { chapter: 'Partnership Fundamentals', subjectName: 'Accountancy', subject: 'accountancy', right: 4, wrong: 6, skip: 0, n: 10, sessions: 3, open: 30, last: LAST, recent: [{ completedAt: LAST }] },
      { chapter: 'Goodwill', subjectName: 'Accountancy', subject: 'accountancy', right: 4, wrong: 4, skip: 1, n: 9, sessions: 2, open: 25, last: LAST - DAY, recent: [{ completedAt: LAST - DAY }] },
    ],
    thin: [],
  },
};
const reviseCard = { id: 'revise', number: 5, why: 'Revise brings back what you got wrong after 1, 3, 7 and 21 days. These five are due today, so the fix holds.' };

test('Why this?: the context names which mistakes come back, from the Revise read, and sends no plan facts', () => {
  const ctxt = todayContext({ move: reviseCard, revise: { due: 5, chapters: [{ chapter: 'Partnership Fundamentals', n: 3 }, { chapter: 'Goodwill', n: 2 }] } });
  // Release 10: Revise says why it comes first, then which mistakes come back; it names no chapter of its own.
  assert.deepEqual(ctxt.lines, ['Revise comes first because these 5 reach their 1, 3, 7 or 21-day mark today, and Revise asks each on its day.', "Today's 5: 3 from Partnership Fundamentals and 2 from Goodwill."]);
  assert.equal(ctxt.chapter, null);
  assert.equal(ctxt.focus, 'revise');
  // The chapters must account for the card's own count, or the line is left out (counts that agree).
  assert.deepEqual(todayContext({ move: reviseCard, revise: { chapters: [{ chapter: 'Goodwill', n: 2 }] } }).lines, ['Revise comes first because these 5 reach their 1, 3, 7 or 21-day mark today, and Revise asks each on its day.']);
  assert.match(todayContext({ move: { ...reviseCard, stake: { value: 30 } } }).lines[0], / They cost 30 marks the first time\.$/);
  assert.equal(todayContext({ move: { id: 'failed' } }), null);
  assert.equal(todayContext({ move: { id: 'weakest', why: 'x', chapter: 'Goodwill' } }).chapter, 'Goodwill');
  assert.match(read('src/components/ai/askContexts.mjs'), /export function todayContext\(\{ move = null, revise = null \} = \{\}\)/, 'no plan parameter: the plan\'s fact lines ("2 saved sessions") are not sent');
});

test('Why this?: the answer leads with what the card does not say, and every count agrees with the record chip', () => {
  const ctxt = normalizeContext(todayContext({ move: reviseCard, revise: { due: 5, chapters: [{ chapter: 'Partnership Fundamentals', n: 3 }, { chapter: 'Goodwill', n: 2 }] } }));
  const first = openingFor({ context: ctxt, insights: INSIGHTS, status: 'ready' });
  assert.equal(first.ask, 'Why this step?');
  assert.equal(first.reply, "Revise comes first because these 5 reach their 1, 3, 7 or 21-day mark today, and Revise asks each on its day. Today's 5: 3 from Partnership Fundamentals and 2 from Goodwill. Next after this: Partnership Fundamentals, where 30 of your open marks are.", 'release 10: why now first; the weakest chapter only as what comes next');
  assert.ok(!first.reply.includes(reviseCard.why), 'the card\'s reason is not restated');
  assert.equal(first.source, recordSource(INSIGHTS), 'the source line is the chip\'s read');
  assert.equal(sessionsLabel(INSIGHTS, 'ready'), '3 sessions');
  for (const n of first.reply.match(/(\d+) sessions?/g) || []) assert.equal(n, '3 sessions', 'never "2 saved sessions" beside a "3 sessions" chip');
  // A chapter move names its own chapter; with none named, the chapter with the most marks open.
  const weak = openingFor({ context: normalizeContext(todayContext({ move: { id: 'weakest', why: 'Goodwill has 25 marks open.', chapter: 'Goodwill' } })), insights: INSIGHTS, status: 'ready' });
  assert.match(weak.reply, /^Goodwill: 4 wrong and 1 left blank, of 9 questions over 2 sessions\. The last miss there was on Wed 14 Oct\. Those 5 questions were worth 25 marks/);
  const other = openingFor({ context: normalizeContext(todayContext({ move: { id: 'repair', why: '4 open mistakes from Thursday.' } })), insights: INSIGHTS, status: 'ready' });
  assert.match(other.reply, /^Most of your open marks are in Partnership Fundamentals: 6 wrong/);
  // No record: the card's reason, never an invented count, and no record claimed.
  const none = openingFor({ context: normalizeContext(todayContext({ move: { id: 'dayOne', why: 'Ten questions.' } })), insights: { state: 'empty' }, status: 'empty' });
  assert.equal(none.reply, 'Ten questions.');
  assert.equal(none.source, 'From your plan');
  assert.equal(todayAnswer({ context: {}, insights: null }), null);
});

test('D27 (audit, release 10): This week says "counts" once, in the readout, with the count left', () => {
  const rhythm = { studyDays: 3, daysGoal: 4, metThisWeek: false, weekStart: '2026-10-12', paused: false, returning: false, weekdays: null, milestones: [] };
  const today = '2026-10-18';
  const marks = weekMarks({ rhythm: { ...rhythm, days: ['2026-10-12', '2026-10-14', '2026-10-18'], studyDayKeys: ['2026-10-12', '2026-10-14', '2026-10-18'] }, today });
  const todayMark = { ...(marks.find((m) => m.today) || { today: true, key: today, name: 'Sun' }), state: 'counted', today: true };
  // Release 10 (taste, D15): today's readout says it in one line, with what is left of the week; the caption adds nothing.
  const caption = weekCaption({ rhythm, marks: marks.map((m) => (m.today ? todayMark : m)), today, everSessions: 9 });
  assert.equal(caption, null);
  const readout = dayReadout({ mark: todayMark, index: 6, papers: [], repairs: [], dayKey: (at) => String(at).slice(0, 10), clockOf: () => '', subjectName, move: { id: 'revise', title: 'Revise what came back' }, failed: false, goal: 4, done: 3, today });
  assert.match(readout.note, /1 more study day meets your 4\./);
  assert.equal((readout.note.match(/counts|counted/gi) || []).length, 1, 'one clause says it counted');
});
