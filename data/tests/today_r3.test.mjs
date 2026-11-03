// Today, Learn v2 round 3 (R3-SPEC section 0: T1 to T5, Z and W on Today; 1 Nov 2026). Each test locks one ruling so a later pass
// cannot quietly bring it back. Run: node --test data/tests/today_r3.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstWeekPath, railCaption, markLine } from '../../src/lib/today/firstWeek.mjs';
import { weekDays, weekCaption, weekMarks } from '../../src/lib/today/week.mjs';
import { roadFigures, roadLayers, dueStop, goalStop, weekItemDetail } from '../../src/lib/today/road.mjs';
import { chapterTitle } from '../../src/lib/today/chapterTitle.mjs';
import { WEAK_EMPTY, WEAK_THIN, QUEUE_EMPTY, COLLEGES_EMPTY } from '../../src/lib/today/copy.mjs';
import { buildMove } from '../../src/lib/today/move.mjs';
import { choiceMoves, leadOf } from '../../src/lib/today/lead.mjs';
import { WORDS, reviseQuestions } from '../../data/learn/words.js';
import { hasZeroCount } from '../../data/learn/roadmap.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const NOW = Date.parse('2026-11-01T14:00:00Z');
const DAY = 86400000;
const subjectName = (id) => ({ accountancy: 'Accountancy', economics: 'Economics' })[id] || id;
const BARE_DUE = /(^|[^\d.,:])\d+\s+due\b/i; // "9 due", "8 due": never a bare count of due things (W)

// ---- T1: a student with no history ----------------------------------------------------------------------------------------

const fresh = (o = {}) => firstWeekPath({
  now: NOW, firstAt: null, sessions: 0, papers: [], repaired: new Map(), repairs: 0, mocks: 0, revise: null,
  road: { onAccount: true, examDate: '2027-05-08', mockTarget: 12 }, weekdays: [0, 2, 4, 6],
  subjects: ['accountancy', 'economics'], facts: { sessions: 0, mocks: 0 }, firstSubject: 'accountancy', premium: false, length: 10, subjectName, daysPerWeek: 4, ...o,
});

test('T1: a brand-new student has no caption under the rail, and day 7 is not ticked (a default plan is not a plan made)', () => {
  const p = fresh();
  assert.equal(p.day, 1);
  assert.equal(p.fresh, true);
  assert.equal(railCaption(p, true), '');
  assert.equal(railCaption(p, false), '');
  assert.ok(p.steps.every((s) => !s.done && s.state !== 'done'), 'no step is ticked before it happens');
  assert.equal(p.steps.find((s) => s.id === 'plan').early, false);
  assert.doesNotMatch(markLine(p, p.steps.find((s) => s.id === 'plan'), NOW), /Done/);
  // A plan the student makes on this page is a thing that happened.
  const made = fresh({ planSaved: true });
  assert.equal(made.steps.find((s) => s.id === 'plan').done, true);
});

test('T1: from the first saved session the path speaks again, and an earlier tick is still explained', () => {
  const p = firstWeekPath({
    now: NOW, firstAt: new Date(NOW - DAY).toISOString(), sessions: 1, papers: [{ id: 'p1', subject: 'accountancy', mode: 'quick', correct: 5, wrong: 4, unattempted: 1, total: 10, completedAt: NOW - DAY }],
    repaired: new Map([['p1', 1]]), repairs: 1, mocks: 0, revise: null, road: { onAccount: true, examDate: '2027-05-08', mockTarget: null }, weekdays: null,
    subjects: ['accountancy', 'economics'], facts: { sessions: 1, mocks: 0, subject: 'accountancy' }, firstSubject: 'accountancy', premium: false, length: 10, subjectName,
  });
  assert.equal(p.fresh, false);
  assert.match(railCaption(p, true), /^Tomorrow: .* Day 7 is done already: your plan is set\.$/);
});

test('T1: the card draws no caption element for a student with no history', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.match(move, /const caption = path\?\.day \? railCaption\(path, week\) : ''/);
  assert.match(move, /\{caption \|\| mark \? <p className="tm__path"/, 'an empty caption draws nothing');
});

// ---- Z: no zero leads ----------------------------------------------------------------------------------------------------

test('Z: This week leads with the goal while nothing is counted ("4 study days this week"), never "0 of 4"', () => {
  assert.deepEqual(weekDays({ studyDays: 0, daysGoal: 4 }), { done: 0, total: 4, figure: 4, of: '', unit: 'study days', text: '4 study days this week' });
  assert.equal(weekDays({ studyDays: 3, daysGoal: 4 }).text, '3 of 4 study days');
  const zero = weekDays({ studyDays: 0, daysGoal: 4 });
  assert.equal(hasZeroCount(`${zero.figure} ${zero.of} ${zero.unit} ${zero.text}`), false);
  // A last week with nothing counted leads with its goal too.
  const monday = { weekStart: '2026-10-26', studyDayDates: [], studyDays: 0, daysGoal: 4, lastClosedWeek: { studyDays: 0, goal: 4 }, metThisWeek: false };
  const marks = weekMarks({ rhythm: monday, today: '2026-10-26' });
  const cap = weekCaption({ rhythm: monday, marks, today: '2026-10-26', everSessions: 9 });
  assert.equal(cap.text, "Last week's goal was 4 study days.");
  assert.equal(hasZeroCount(cap.text), false);
});

const RHYTHM = { weekStart: '2026-10-26', studyDayDates: [], studyDays: 0, daysGoal: 4, mocksThisWeek: 0, counts: { sessions: 0 }, milestones: [], timeZone: 'Asia/Kolkata' };
const layersFor = (o = {}) => {
  const fig = roadFigures({ today: '2026-11-01', plan: {}, goal: 4, taken: 0 });
  return roadLayers({ today: '2026-11-01', rhythm: RHYTHM, weekdays: null, revise: null, move: null, fig, target: 13, taken: 0, firstDay: true, ...o });
};

test('Z: the road stops lead with their goal while nothing is counted: "1 session today", "4 study days this week", "13 full mocks"', () => {
  const l = layersFor();
  const due = dueStop(l.today);
  assert.deepEqual([due.figure, due.of, due.unit], [1, '', 'session today']);
  assert.equal(weekDays(RHYTHM).text, '4 study days this week');
  const goal = goalStop({ taken: 0, target: 13 });
  assert.deepEqual([goal.figure, goal.of, goal.unit], [13, '', 'full mocks']);
  for (const s of [due, goal]) assert.equal(hasZeroCount(`${s.figure} ${s.of} ${s.unit} ${s.aria || ''}`), false, JSON.stringify(s));
  // Once something is counted, the stop reads "1 of 2" as before.
  const done = dueStop({ ...l.today, done: 1, total: 2 });
  assert.deepEqual([done.figure, done.of, done.unit], [1, 'of 2', 'done']);
  assert.deepEqual(goalStop({ taken: 6, target: 13 }), { figure: 6, of: 'of 13', unit: 'full mocks' });
  assert.equal(goalStop({ taken: null, target: 13 }).unit, 'full mocks planned');
  assert.equal(goalStop({ taken: 0, target: 1 }).unit, 'full mock');
  assert.equal(weekItemDetail({ id: 'days', done: 0, total: 4 }), '4 this week');
  assert.equal(weekItemDetail({ id: 'mocks', done: 0, total: 1 }), '1 planned this week');
  assert.equal(weekItemDetail({ id: 'days', done: 2, total: 4 }), '2 of 4 this week');
  assert.equal(dueStop({ ...l.today, rest: true, items: [], total: 0 }).unit, 'nothing due');
});

test('Z and W: Revise with nothing asked yet reads "Revise 5 questions" (reviseQuestions), never "Revise 0 of 5 questions"', () => {
  assert.equal(reviseQuestions(5), 'Revise 5 questions');
  const l = layersFor({ revise: { due: 5, answeredToday: 0 }, firstDay: false, move: { id: 'practice', title: 'Practise a fresh set', key: { minutes: 10, href: '/dashboard' } } });
  const rev = l.today.items.find((i) => i.id === 'revise');
  assert.equal(rev.title, 'Revise 5 questions');
  assert.equal(rev.detail, '');
  assert.equal(hasZeroCount(`${rev.title} ${rev.detail}`), false);
  const part = layersFor({ revise: { due: 3, answeredToday: 2 }, firstDay: false }).today.items.find((i) => i.id === 'revise');
  assert.deepEqual([part.title, part.detail], ['Revise', '2 of 5 questions']);
  const dueDay = dueStop(l.today);
  assert.equal(dueDay.unit, 'to do today');
  assert.equal(hasZeroCount(`${dueDay.figure} ${dueDay.unit} ${dueDay.aria}`), false);
});

test('Z: the Repairs and Revise tiles drop a zero instead of leading with it, and never say a bare "N due"', () => {
  const q = read('src/components/today/TodayQueue.jsx');
  assert.match(q, /\{open > 0 \? <span className="tq__n"><b>\{open\}<\/b><span>open \{open === 1 \? 'mistake' : 'mistakes'\}<\/span><\/span> : null\}/);
  assert.match(q, /\{due > 0 \? <span className="tq__n"><b>\{due\}<\/b><span>to revise today<\/span><\/span> : null\}/);
  assert.doesNotMatch(q, /<span>due today<\/span>/);
  assert.doesNotMatch(q.replace(/^\s*\/\/.*$/gm, ''), /\$\{due\} due today/);
});

// ---- W: one word for each thing -------------------------------------------------------------------------------------------

test('W: a waiting session\'s key is "Continue"; the card says "Up next" and "Welcome back", never "Pick up"', () => {
  const plan = { primary: { kind: 'resume_session', title: 'Resume your practice', href: '/test?sessionId=s1' } };
  const m = buildMove({ plan, papers: [], rhythm: null, revise: null, facts: { sessions: 3, mocks: 0 }, subjectName, now: NOW });
  assert.equal(m.id, 'resume');
  assert.equal(m.key.label, WORDS.continue);
  assert.equal(m.overline, 'Up next');
  assert.doesNotMatch(read('src/lib/today/move.mjs'), /Pick up/);
});

test('W: a key\'s length is " · N min" on the lead key and on the road row key', () => {
  const move = read('src/components/today/TodayMove.jsx');
  assert.equal((move.match(/<span className="tm__key-len">· \{lenChip\(minutes\)\}<\/span>/g) || []).length, 2);
  const road = read('src/components/today/TodayRoad.jsx');
  assert.match(road, /<span className="trd__go-len">· \{i\.id === 'revise' \? i\.minutes : i\.key\.minutes\} min<\/span>/);
});

test('W: the choice cells say "N questions", "N open mistakes" and never a bare "N due"', () => {
  const paper = { id: 'p9', subject: 'accountancy', mode: 'quick', correct: 5, wrong: 4, unattempted: 1, total: 10, completedAt: NOW - DAY };
  const pool = choiceMoves({ papers: [paper], revise: { due: 5, dueTotal: 8 }, facts: { mocks: 0 }, repaired: new Map(), top: null, subjectName, subjects: ['accountancy', 'economics'], now: NOW });
  const revise = pool.find((m) => m.id === 'revise');
  assert.equal(revise.choice.value, '5 of 8 questions today');
  const repair = pool.find((m) => m.id === 'repair');
  assert.match(repair.choice.value, /^\d+ open mistakes? from /);
  const one = leadOf({ id: 'revise', number: 1, label: 'mistake due back today', key: { minutes: 5 } }, { now: NOW });
  assert.equal(one.choice.value, '1 question, about 5 min');
  for (const m of [...pool, one]) assert.doesNotMatch(String(m.choice.value), BARE_DUE, m.id);
  for (const m of [...pool, one]) assert.equal(hasZeroCount(String(m.choice.value)), false, m.id);
});

// ---- T4: the three explainers keep their headings, one line of at most 90 characters each -------------------------------

test('T4: Weak chapters, Repairs and Revise, Your colleges each keep a heading and one line of at most 90 characters', () => {
  for (const line of [WEAK_EMPTY, WEAK_THIN, QUEUE_EMPTY, COLLEGES_EMPTY]) {
    assert.ok(line.length <= 90, `${line.length}: ${line}`);
    assert.doesNotMatch(line, /!|→/);
  }
  assert.match(read('src/components/today/TodayWeak.jsx'), /<h2 id="twk-h" className="tg__h">Weak chapters<\/h2>/);
  assert.match(read('src/components/today/TodayQueue.jsx'), /<h2 id="tq-h" className="tg__h">Repairs and Revise<\/h2>/);
  assert.match(read('src/components/today/TodayColleges.jsx'), /<h2 id="tc-h" className="tg__h">Your colleges<\/h2>/);
  assert.match(read('src/components/today/TodayWeak.jsx'), /\{view\.status === 'empty' \? WEAK_EMPTY : WEAK_THIN\}/);
  assert.match(read('src/components/today/TodayQueue.jsx'), /<p className="tq__empty">\{QUEUE_EMPTY\}<\/p>/);
  assert.match(read('src/components/today/TodayColleges.jsx'), /<p>\{COLLEGES_EMPTY\}<\/p>/);
});

// ---- T5: canonical syllabus titles ----------------------------------------------------------------------------------------

test('T5: a chapter is named as the syllabus (and the roadmap) names it', () => {
  assert.equal(chapterTitle('accountancy', 'Goodwill'), 'Goodwill: Nature and Valuation');
  assert.equal(chapterTitle('accountancy', 'Goodwill Valuation'), 'Goodwill: Nature and Valuation');
  assert.equal(chapterTitle('accountancy', 'Partnership Fundamentals'), 'Accounting for Partnership: Basic Concepts');
  assert.equal(chapterTitle('accountancy', 'Partnership'), 'Accounting for Partnership: Basic Concepts', 'an alias reads as its chapter');
  assert.equal(chapterTitle('accountancy', 'Admission of a partner'), 'Admission of a Partner');
  assert.equal(chapterTitle('accountancy', 'Not a chapter at all'), 'Not a chapter at all', 'an unknown name stays as stored');
  assert.equal(chapterTitle(null, 'Retirement/Death of a Partner'), 'Retirement and Death of a Partner');
  assert.equal(chapterTitle('accountancy', ''), '');
  const weak = read('src/components/today/TodayWeak.jsx');
  assert.match(weak, /<b>\{chapterTitle\(c\.subject, c\.chapter\)\}<\/b>/);
  assert.match(weak, /new URLSearchParams\(\{ subject: c\.subject, chapter: c\.chapter, mode: 'quick' \}\)/, 'links keep the stored name');
  assert.match(read('src/components/today/TodayPaper.jsx'), /chapter: chapterTitle\(top\.subject, top\.chapter\)/);
});

// ---- T3: a brand-new student sees the start card's key above the dock ---------------------------------------------------

test('T3: for a student with no saved session the Your colleges strip sits under the start card, not above it (both entries stay)', () => {
  const page = read('src/app/(app)/today/page.jsx');
  // R4 client-code#2: ONE strip is built, once the first-session fact is known, and placed in one slot.
  assert.equal((page.match(/<TodayCollegesStrip /g) || []).length, 1, 'one strip element in the page, never two copies');
  assert.match(page, /const strip = everSessions !== null \? <TodayCollegesStrip userId=\{userId\} hold=\{landing\} \/> : null;/, 'nothing is drawn while the first-session fact is unknown');
  assert.match(page, /const stripBelow = dayOne && !wideHead;/);
  assert.match(page, /\{stripBelow \? null : dayOne \? <div className="today__colleges-head">\{strip\}<\/div> : strip\}/, 'the header strip is for everyone else, and for the new student from 1100 px');
  assert.match(page, /\{stripBelow \? <div className="today__colleges">\{strip\}<\/div> : null\}/);
  assert.match(page, /<TodayColleges userId=\{userId\} subjects=\{user\?\.subjects \|\| \[\]\} hold=\{landing\} \/>/, 'the block at the end stays');
  const sheet = read('src/components/today/today.css');
  assert.match(sheet, /\.app-shell \.today-grid \.today__colleges \{ order: 2; \}\n\.app-shell \.today__colleges-head \{ display: none; \}/);
  assert.match(sheet, /@media \(min-width: 1100px\) \{\n  \.app-shell \.today__colleges-head \{ display: block; \}\n  \.app-shell \.today-grid \.today__colleges \{ display: none; \}/);
});
