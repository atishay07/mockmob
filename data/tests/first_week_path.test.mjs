// The first week on Today (release 8; FEATURE-ADOPTION-2026-10-17 item 7, owner W-064 and F18): the chained path, its clock,
// what each step needs and when it is done, the lead it makes, and what it never replaces.
// Run: node --test data/tests/first_week_path.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_WEEK_STEPS, KEEPS_THE_LEAD, firstWeekClock, firstWeekPath, railLine, stepOfDay, withFirstWeek } from '../../src/lib/today/firstWeek.mjs';

const NOW = Date.parse('2026-10-18T14:00:00Z'); // Sunday 18 Oct, 7:30 PM IST
const DAY = 86400000;
const firstAtDay = (n) => new Date(NOW - (n - 1) * DAY).toISOString(); // the first scored session, so that today is day n
const subjectName = (id) => ({ accountancy: 'Accountancy', economics: 'Economics', english: 'English' })[id] || id;
const paper = (o = {}) => ({ id: 'p1', subject: 'accountancy', mode: 'quick', correct: 5, wrong: 4, unattempted: 1, total: 10, marks: 21, maxMarks: 50, completedAt: NOW - DAY, ...o });
const top = { subject: 'accountancy', chapter: 'Partnership Fundamentals', open: 30, sessions: 2, wrong: 5, skip: 1, n: 18 };
const recalled = { due: 4, dueTotal: 4, minutes: 5, recalled: true, answeredToday: 0, subjects: ['accountancy'] };
// A student who followed the path up to yesterday: the record `ctx(n)` has on day n, before day n's own step.
const ctx = (day, o = {}) => ({
  now: NOW, firstAt: firstAtDay(day), sessions: 1, papers: [paper()], repaired: new Map([['p1', 1]]), repairs: 1, mocks: 0,
  revise: recalled, road: { onAccount: true, examDate: null, mockTarget: null }, weekdays: null,
  subjects: ['accountancy', 'economics', 'english'], top, facts: { sessions: 1, mocks: 0, subject: 'accountancy' }, firstSubject: 'accountancy',
  premium: false, length: 10, subjectName, daysPerWeek: 4, ...o,
});
const state = (path, id) => path.steps.find((s) => s.id === id).state;

test('the path: seven steps, one a day, in the doc\'s order', () => {
  assert.deepEqual(FIRST_WEEK_STEPS.map((s) => [s.day, s.id]), [[1, 'start'], [2, 'revise'], [3, 'aim'], [4, 'spread'], [5, 'mock'], [6, 'lab'], [7, 'plan']]);
  assert.ok(FIRST_WEEK_STEPS.every((s, i) => s.day === i + 1 && s.name));
  assert.deepEqual([...KEEPS_THE_LEAD], ['resume', 'check', 'done', 'failed', 'returning']);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 0, 8, null].map(stepOfDay), ['start', 'revise', 'aim', 'spread', 'mock', 'lab', 'plan', null, null, null]);
});

test('clock: nothing saved is day 1; the first scored session starts the week; day 8 is past it; unknown is no day', () => {
  assert.deepEqual(firstWeekClock({ sessions: 0, now: NOW }), { day: 1, from: 'none' });
  for (const n of [1, 2, 3, 7]) assert.deepEqual(firstWeekClock({ sessions: 1, firstAt: firstAtDay(n), now: NOW }), { day: n, from: 'session' });
  assert.equal(firstWeekClock({ sessions: 4, firstAt: firstAtDay(8), now: NOW }).day, null);
  // Whole IST days: a session at 11:30 PM IST last night is day 2 this morning, never day 1 until the clock passes midnight.
  const lateLastNight = new Date(Date.parse('2026-10-17T18:00:00Z')).toISOString(); // 11:30 PM IST, 17 Oct
  assert.equal(firstWeekClock({ sessions: 1, firstAt: lateLastNight, now: Date.parse('2026-10-17T19:00:00Z') }).day, 2, 'after midnight IST it is the next day');
  assert.equal(firstWeekClock({ sessions: 1, firstAt: lateLastNight, now: Date.parse('2026-10-17T18:20:00Z') }).day, 1, 'at 11:50 PM IST it is still day 1');
  // Not known: no sessions read, or sessions but no scored-session mark and no complete list of papers.
  assert.equal(firstWeekClock({ now: NOW }).day, null);
  assert.equal(firstWeekClock({ sessions: null, firstAt: firstAtDay(2), now: NOW }).day, null);
  assert.equal(firstWeekClock({ sessions: 3, firstAt: null, papers: [paper()], now: NOW }).day, null);
  // The rhythm counts a session from 5 answers: without its mark the oldest paper is the start, when every session is in the list.
  const early = paper({ id: 'a', completedAt: NOW - 2 * DAY });
  assert.deepEqual(firstWeekClock({ sessions: 2, firstAt: null, papers: [paper(), early], now: NOW }), { day: 3, from: 'paper' });
});

test('day 1: nothing saved, the regular first move leads and the rail marks day 1', () => {
  const p = firstWeekPath(ctx(1, { sessions: 0, papers: [], repaired: new Map(), repairs: 0, firstAt: null, revise: { due: 0, dueTotal: 0, recalled: false }, facts: { sessions: 0, mocks: 0, subject: null } }));
  assert.equal(p.day, 1);
  assert.equal(p.move, null, 'the starting set is the regular first move (dayOne)');
  assert.equal(state(p, 'start'), 'today');
  assert.deepEqual(p.steps.slice(1).map((s) => s.state), ['ahead', 'ahead', 'ahead', 'ahead', 'ahead', 'ahead']);
  assert.equal(`${p.done} of ${p.total}`, '0 of 7');
});

test('day 1: the set is saved, so Find is done only once a Repair is made or nothing is left to repair', () => {
  const found = firstWeekPath(ctx(1, { repaired: new Map(), repairs: 0 }));
  assert.equal(state(found, 'start'), 'today', 'a set with open mistakes and no Repair yet is not "fixed"');
  assert.equal(found.move, null, 'the regular lead (Repair) is already right');
  const fixed = firstWeekPath(ctx(1));
  assert.equal(state(fixed, 'start'), 'done');
  const clean = firstWeekPath(ctx(1, { papers: [paper({ wrong: 0 })], repaired: new Map(), repairs: 0 }));
  assert.equal(state(clean, 'start'), 'done', 'a clean first set has nothing to fix');
  // A repair on an older paper counts too; a read that failed is unknown, never done.
  assert.equal(state(firstWeekPath(ctx(1, { repaired: new Map(), repairs: 2 })), 'start'), 'done');
  assert.equal(state(firstWeekPath(ctx(1, { repaired: null, repairs: null })), 'start'), 'today');
});

test('day 2: Revise leads while it is due and not yet recalled', () => {
  const p = firstWeekPath(ctx(2, { revise: { due: 5, dueTotal: 5, minutes: 5, recalled: false, answeredToday: 0, subjects: ['accountancy'] } }));
  assert.equal(p.move.id, 'revise');
  assert.equal(p.move.overline, 'Day 2 of your first week');
  assert.equal(p.move.firstWeek, 2);
  assert.equal(p.move.step, 'revise');
  assert.equal(p.move.number, 5);
  assert.equal(p.move.key.href, '/review/revise');
  assert.equal(p.step, 'revise');
  assert.equal(state(p, 'revise'), 'today');
});

test('day 2: nothing due, or already recalled, or the read failed: no lead, and no tick the data cannot back', () => {
  const none = firstWeekPath(ctx(2, { revise: { due: 0, dueTotal: 0, recalled: false } }));
  assert.equal(none.move, null);
  assert.equal(state(none, 'revise'), 'today');
  const did = firstWeekPath(ctx(2, { revise: { due: 3, dueTotal: 3, recalled: true } }));
  assert.equal(did.move, null, 'the step is done, so the regular lead stays');
  assert.equal(state(did, 'revise'), 'done');
  const unread = firstWeekPath(ctx(2, { revise: null }));
  assert.equal(unread.move, null);
  assert.equal(state(unread, 'revise'), 'today');
  const unknown = firstWeekPath(ctx(2, { revise: { due: 3, dueTotal: 3, recalled: null } }));
  assert.equal(unknown.move, null, 'recalled unknown: never led, never ticked');
  assert.notEqual(state(unknown, 'revise'), 'done');
});

test('day 3: a second set, aimed at the weakest chapter (smart practice on Pro, a plain set with no record)', () => {
  const free = firstWeekPath(ctx(3));
  assert.equal(free.move.id, 'weakest');
  assert.equal(free.move.overline, 'Day 3 of your first week');
  assert.equal(free.move.chapter, 'Partnership Fundamentals');
  assert.match(free.move.key.href, /^\/dashboard\?subject=accountancy&chapter=Partnership\+Fundamentals&mode=quick&count=10$/);
  const pro = firstWeekPath(ctx(3, { premium: true }));
  assert.equal(pro.move.id, 'smart');
  assert.equal(pro.move.key.href, '/dashboard?subject=accountancy&mode=smart');
  assert.match(pro.move.why, /Smart practice picks questions from the chapters where your Accountancy marks went, from 1 saved session\./);
  const noRecord = firstWeekPath(ctx(3, { top: null }));
  assert.equal(noRecord.move.id, 'practice');
  assert.equal(noRecord.move.key.href, '/dashboard?mode=quick&count=10');
  // Two saved sessions: the step is done, whatever they were aimed at.
  const two = firstWeekPath(ctx(3, { sessions: 2 }));
  assert.equal(two.move, null);
  assert.equal(state(two, 'aim'), 'done');
  assert.equal(firstWeekPath(ctx(3, { sessions: null })), null, 'unknown sessions: no day, so no path and no guess');
});

test('day 4: a first set in a subject not yet practised; one subject has nothing to spread to', () => {
  const p = firstWeekPath(ctx(4, { sessions: 2 }));
  assert.equal(p.move.id, 'another');
  assert.equal(p.move.overline, 'Day 4 of your first week');
  assert.equal(p.move.subject, 'economics');
  assert.equal(p.move.key.href, '/dashboard?subject=economics&mode=quick&count=10');
  assert.match(p.move.why, /^Economics is one of your subjects\./);
  assert.equal(p.move.label, 'questions in a second subject', 'short: a catalogue name would wrap to four lines beside the number');
  // Economics already practised: the lead goes to the next one not yet practised, and two subjects done ticks the step.
  const next = firstWeekPath(ctx(4, { sessions: 3, papers: [paper({ id: 'p2', subject: 'economics' }), paper()] }));
  assert.equal(state(next, 'spread'), 'done');
  assert.equal(next.move, null);
  const solo = firstWeekPath(ctx(4, { sessions: 2, subjects: ['accountancy'] }));
  assert.equal(state(solo, 'spread'), 'na');
  assert.equal(solo.move, null);
  assert.equal(`${solo.done} of ${solo.total}`, '3 of 6', 'a step that does not apply is not in the count');
  assert.equal(firstWeekPath(ctx(4, { sessions: 2, subjects: null })).move, null, 'subjects unread: no lead');
});

test('day 5: the first full mock leads until one is saved', () => {
  const p = firstWeekPath(ctx(5, { sessions: 3 }));
  assert.equal(p.move.id, 'firstMock');
  assert.equal(p.move.overline, 'Day 5 of your first week');
  assert.equal(p.move.number, 50);
  assert.equal(p.move.label, 'questions in 60 minutes');
  assert.equal(p.move.key.href, '/dashboard?subject=accountancy&mode=full');
  assert.equal(p.move.key.label, 'Start a timed mock');
  const done = firstWeekPath(ctx(5, { sessions: 4, mocks: 1, facts: { sessions: 4, mocks: 1, subject: 'accountancy' }, papers: [paper({ id: 'm1', mode: 'full', total: 50, wrong: 6 }), paper()] }));
  assert.equal(done.move, null);
  assert.equal(state(done, 'mock'), 'done');
  assert.equal(state(firstWeekPath(ctx(5, { mocks: null })), 'mock'), 'today');
});

test('day 6: repair what the first mock found, until a Repair is saved on it', () => {
  const mock = paper({ id: 'm1', mode: 'full', total: 50, wrong: 6, completedAt: NOW - DAY });
  const input = (o = {}) => ctx(6, { sessions: 4, mocks: 1, papers: [mock, paper()], repaired: new Map([['p1', 1]]), ...o });
  const p = firstWeekPath(input());
  assert.equal(p.move.id, 'repair');
  assert.equal(p.move.title, 'Repair what your mock found');
  assert.equal(p.move.overline, 'Day 6 of your first week');
  assert.equal(p.move.number, 6);
  assert.equal(p.move.key.href, '/result/m1');
  assert.match(p.move.why, /^All six are from your Accountancy full mock on 17 Oct\./);
  const fixed = firstWeekPath(input({ repaired: new Map([['p1', 1], ['m1', 2]]) }));
  assert.equal(state(fixed, 'lab'), 'done');
  assert.equal(fixed.move, null);
  // No mock yet: nothing to repair from it (never led); a mock saved but not in the newest papers read is unknown.
  assert.equal(firstWeekPath(ctx(6, { mocks: 0 })).move, null);
  assert.equal(state(firstWeekPath(ctx(6, { mocks: 0 })), 'lab'), 'today');
  assert.equal(firstWeekPath(input({ papers: [paper()] })).move, null);
  // A clean mock has nothing to repair.
  assert.equal(firstWeekPath(input({ papers: [paper({ id: 'm1', mode: 'full', wrong: 0 })] })).move, null);
});

test('day 7: Change plan leads with its three taps as its number, and a saved plan ends it', () => {
  const p = firstWeekPath(ctx(7, { sessions: 4, mocks: 1 }));
  assert.equal(p.move.id, 'plan');
  assert.equal(p.move.title, 'Plan your weeks to CUET');
  assert.equal(p.move.overline, 'Day 7 of your first week');
  assert.equal(p.move.number, 3, 'release 10: the three taps, never a second 27 beside Road to CUET');
  assert.equal(p.move.label, 'taps to plan your 27 weeks');
  assert.equal(p.move.art, 'mobi');
  assert.equal(p.move.mobiAct, 'point');
  assert.equal(p.move.key.action, 'plan');
  assert.equal(p.move.key.label, 'Plan my weeks');
  assert.equal(p.move.key.minutes, null);
  assert.match(p.move.why, /It takes three taps/);
  // Her own date makes it "your date"; a saved date, a mock target or chosen study days make the step done.
  const own = firstWeekPath(ctx(7, { sessions: 4, mocks: 1, road: { onAccount: true, examDate: '2027-05-08', mockTarget: null }, planSaved: false }));
  assert.equal(state(own, 'plan'), 'done');
  assert.equal(own.move, null);
  for (const o of [{ road: { onAccount: true, examDate: null, mockTarget: 14 } }, { weekdays: [0, 2, 4] }, { planSaved: true }]) assert.equal(state(firstWeekPath(ctx(7, { sessions: 4, mocks: 1, ...o })), 'plan'), 'done', JSON.stringify(o));
  // Neither read known: not known whether a plan exists, so no lead.
  const blind = firstWeekPath(ctx(7, { sessions: 4, mocks: 1, road: null, weekdays: undefined }));
  assert.equal(blind.move, null);
  assert.equal(state(blind, 'plan'), 'today');
  // Before the migration (not on the account) the days step still saves, so the step still leads.
  assert.equal(firstWeekPath(ctx(7, { sessions: 4, mocks: 1, road: { onAccount: false, examDate: null, mockTarget: null } })).move.id, 'plan');
});

test('only today\'s step leads; a step passed stays quietly open and is never nagged', () => {
  // Day 4 with Revise never done: day 4's own step leads; Revise is an open mark, not a lead.
  const p = firstWeekPath(ctx(4, { sessions: 2, revise: { due: 5, dueTotal: 5, recalled: false } }));
  assert.equal(p.move.id, 'another');
  assert.equal(state(p, 'revise'), 'open');
  assert.equal(state(p, 'mock'), 'ahead');
  assert.equal(p.steps.filter((s) => s.state === 'today').length, 1);
});

test('it goes away after day 7 and when every step that applies is done', () => {
  assert.equal(firstWeekPath(ctx(8, { sessions: 4 })), null);
  assert.equal(firstWeekPath({}), null);
  assert.equal(firstWeekPath({ now: NOW }), null, 'nothing known');
  const all = ctx(6, {
    sessions: 5, mocks: 1, papers: [paper({ id: 'm1', mode: 'full', wrong: 6 }), paper({ id: 'e1', subject: 'economics' })],
    repaired: new Map([['m1', 3], ['e1', 1]]), repairs: 4, planSaved: true,
  });
  assert.equal(firstWeekPath(all), null, 'seven of seven: the path is gone');
  // One subject and everything else done: six of six.
  assert.equal(firstWeekPath({ ...all, subjects: ['accountancy'] }), null);
  // One step short: it stays, and counts honestly.
  const short = firstWeekPath({ ...all, planSaved: false });
  assert.equal(`${short.done} of ${short.total}`, '6 of 7');
});

test('what it never replaces: a session waiting, a check, the finished-for-today card, a failed read', () => {
  const stepped = firstWeekPath(ctx(2, { revise: { due: 5, dueTotal: 5, recalled: false } })).move;
  const regular = (id) => ({ id });
  for (const id of KEEPS_THE_LEAD) assert.equal(withFirstWeek(regular(id), stepped).id, id, id);
  for (const id of ['repair', 'firstRepair', 'revise', 'practice', 'smart', 'firstMock', 'dayOne']) assert.equal(withFirstWeek(regular(id), stepped), stepped, id);
  assert.equal(withFirstWeek(null, stepped), null, 'still loading stays loading');
  assert.equal(withFirstWeek(regular('repair'), null).id, 'repair', 'no step to lead with');
  assert.equal(withFirstWeek(undefined, null), null);
});

test('the rail says it in words for a screen reader: counts with their denominators', () => {
  const p = firstWeekPath(ctx(3));
  assert.equal(railLine(p), 'Your first week, day 3. 2 of 7 steps done: Find and fix, Revise. Today: Weak chapters.');
  assert.equal(railLine(firstWeekPath(ctx(1, { sessions: 0, papers: [], repaired: new Map(), repairs: 0, firstAt: null, revise: null }))), 'Your first week, day 1. 0 of 7 steps done. Today: Find and fix.');
  assert.equal(railLine(null), '');
});

test('the copy: sentence case, no exclamation marks, no arrows, nothing free that is not, no streak or shame', () => {
  const leads = [
    firstWeekPath(ctx(2, { revise: { due: 5, dueTotal: 5, recalled: false } })).move,
    firstWeekPath(ctx(3)).move, firstWeekPath(ctx(3, { premium: true })).move, firstWeekPath(ctx(3, { top: null })).move,
    firstWeekPath(ctx(4, { sessions: 2 })).move, firstWeekPath(ctx(5, { sessions: 3 })).move,
    firstWeekPath(ctx(6, { sessions: 4, mocks: 1, papers: [paper({ id: 'm1', mode: 'full', wrong: 6 })] })).move,
    firstWeekPath(ctx(7, { sessions: 4, mocks: 1 })).move,
  ];
  assert.equal(leads.length, 8);
  for (const m of leads) {
    assert.ok(m, 'every step makes a lead');
    const text = [m.title, m.label, m.why, m.key.label, m.choice?.title, m.choice?.value].join(' | ');
    assert.doesNotMatch(text, /!|→|->|streak|miss(ed)? (a|your) day|you.?re behind|falling behind|behind schedule|lazy|hurry/i, text);
  }
  // Repair is never described as free here: its price line is the lead card's own ("Each repair uses 1 credit").
  const lab = leads[6];
  assert.doesNotMatch(`${lab.why} ${lab.title}`, /\bfree\b/i);
  assert.equal(lab.aiEach, 1);
});
