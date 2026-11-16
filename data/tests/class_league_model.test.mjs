// Class leagues' pure model (src/lib/classLeague/model.mjs) and the report email (reportAlert.js): codes, the name rule, who
// counts in a week, the figure and its floor of 5, the week logic riding on the Sunday Mock's own window, and the words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLASS_CODE_RE, CLASS_FLOOR, CLASS_FULL_MARKS, CLASS_NAME_MAX, CODE_ALPHABET, checkClassName, classCodeFromBytes, classFigure, displayClassCode,
  figureWeek, figureWords, membersAt, nextFigure, normalizeClassCode, pickSubjects, readPendingCode, rulerAt, weekAllowed, CLASS_COPY, JOIN_LINES,
} from '../../src/lib/classLeague/model.mjs';
import { classReportEmail, createClassReportAlert } from '../../src/lib/classLeague/reportAlert.js';
import { sundayWindow } from '../../src/lib/sundayMock.mjs';

const blocklist = JSON.parse(readFileSync(new URL('../mob_name_blocklist.json', import.meta.url), 'utf8'));
const IST = (s) => Date.parse(`${s}+05:30`);
const WEEK = '2026-11-22';
const ANSWERS = sundayWindow(WEEK).answersAt; // 11:05 PM IST
const sit = (userId, correct, wrong, at = IST('2026-11-22T12:00:00')) => ({ userId, correct, wrong, unattempted: 50 - correct - wrong, total: 50, completedAt: at });
const member = (userId, joined = IST('2026-11-20T10:00:00'), left = null) => ({ userId, joinedAt: joined, leftAt: left });

test('codes: six Crockford characters, unambiguous, read back the way a class types them', () => {
  assert.equal(CODE_ALPHABET.length, 32);
  assert.doesNotMatch(CODE_ALPHABET, /[ILOU]/);
  for (let i = 0; i < 200; i += 1) {
    const bytes = Uint8Array.from({ length: 4 }, (_, j) => (i * 37 + j * 101) % 256);
    assert.match(classCodeFromBytes(bytes), CLASS_CODE_RE);
  }
  assert.equal(normalizeClassCode('k7p 2m9'), 'K7P2M9');
  assert.equal(normalizeClassCode('K7P-2M9'), 'K7P2M9');
  assert.equal(normalizeClassCode('O1L2I3'), '011213', 'O reads as 0, I and L as 1');
  assert.equal(normalizeClassCode('K7P2M'), null);
  assert.equal(normalizeClassCode('K7P2M9X'), null);
  assert.equal(normalizeClassCode('K7P2MU'), null, 'U is not in the alphabet');
  assert.equal(normalizeClassCode(42), null);
  assert.equal(displayClassCode('K7P2M9'), 'K7P 2M9');
});

test('the name: 3 to 60 characters a class name uses, screened by the Mob\'s own list, no phone number or link', () => {
  for (const ok of ['XII-C Commerce, DPS Rohini', 'Batch 2027 (Morning)', "St. Mary's 12 B/Arts", 'Commerce & Humanities', '12th A', 'कक्षा बारहवीं वाणिज्य']) {
    assert.deepEqual(checkClassName(ok, blocklist), { ok: true, name: ok }, ok);
  }
  assert.equal(checkClassName('  XII   C  ', blocklist).name, 'XII C', 'spaces collapse');
  assert.equal(checkClassName('ab', blocklist).code, 'NAME_INVALID');
  assert.equal(checkClassName('a'.repeat(CLASS_NAME_MAX + 1), blocklist).code, 'NAME_INVALID');
  assert.equal(checkClassName('12345', blocklist).code, 'NAME_INVALID', 'a name needs a letter');
  assert.equal(checkClassName('<b>class</b>', blocklist).code, 'NAME_INVALID');
  assert.equal(checkClassName('Call 98765 43210', blocklist).code, 'NAME_REFUSED', 'no phone number');
  assert.equal(checkClassName('Join www.example', blocklist).code, 'NAME_REFUSED', 'no link');
  assert.equal(checkClassName('bestnotes.in batch', blocklist).code, 'NAME_REFUSED');
  assert.equal(checkClassName('Sexy Commerce', blocklist).code, 'NAME_REFUSED', 'the Mob list');
  assert.equal(checkClassName('MockMob Official', blocklist).code, 'NAME_REFUSED', 'no posing as MockMob');
  assert.equal(checkClassName('XII C, f u u u c k', blocklist).code, 'NAME_REFUSED', 'spaced out, the Mob\'s screen reads it across the spaces');
  assert.equal(checkClassName('Batch, fuuuck', blocklist).code, 'NAME_REFUSED', 'a stretched word after a comma');
});

test('subjects: only the creator\'s own, once each, in their order', () => {
  assert.deepEqual(pickSubjects(['economics', 'accountancy', 'physics'], ['accountancy', 'economics']), ['accountancy', 'economics']);
  assert.equal(pickSubjects(['physics'], ['accountancy']), null);
  assert.equal(pickSubjects([], ['accountancy']), null);
  assert.equal(pickSubjects('accountancy', ['accountancy']), null);
});

test('who counts in a week: the members open at that Sunday\'s 11:05 PM, so a later join or leave never moves it', () => {
  const rows = [
    member('a'),
    member('b', IST('2026-11-22T23:00:00')), // joined before 11:05 PM
    member('c', IST('2026-11-22T23:06:00')), // joined after: not this week
    member('d', IST('2026-11-20T10:00:00'), IST('2026-11-22T20:00:00')), // left before: not this week
    member('e', IST('2026-11-20T10:00:00'), IST('2026-11-23T09:00:00')), // left after: still this week
    { user_id: 'f', joined_at: '2026-11-19T00:00:00.000Z', left_at: null }, // the database's own spelling
  ];
  assert.deepEqual([...membersAt(rows, ANSWERS)].sort(), ['a', 'b', 'e', 'f']);
});

test('the figure: under 5 sitters it says nothing, not even how many; from 5 the mean of their marks', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((u) => member(u));
  const four = [sit('a', 40, 5), sit('b', 30, 10), sit('c', 20, 10), sit('d', 35, 0)];
  assert.deepEqual(classFigure({ week: WEEK, rows, sittings: four }), { enough: false }, 'no count under the floor');
  const five = [...four, sit('e', 25, 20)];
  // marks: 195, 140, 90, 175, 105 -> 705 / 5 = 141
  assert.deepEqual(classFigure({ week: WEEK, rows, sittings: five }), { enough: true, sat: 5, average: 141 });
  assert.equal(CLASS_FLOOR, 5);
  assert.equal(CLASS_FULL_MARKS, 250);
});

test('the figure counts only class members, one sitting each, finished inside the Sunday Mock\'s window (countsFor)', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map((u) => member(u)).concat(member('late-joiner', IST('2026-11-23T08:00:00')));
  const sittings = [
    sit('a', 40, 5), sit('a', 10, 40), // a second row for one student never counts twice
    sit('b', 30, 10), sit('c', 20, 10), sit('d', 35, 0),
    sit('e', 25, 20, IST('2026-11-22T23:30:00')), // finished after the last legal send: never counted
    sit('stranger', 50, 0), // not in the class
    sit('late-joiner', 50, 0), // joined after the figure opened
  ];
  assert.deepEqual(classFigure({ week: WEEK, rows, sittings }), { enough: false }, 'four count, so the floor holds');
  const fixed = sittings.map((s) => (s.userId === 'e' ? sit('e', 25, 20) : s));
  assert.deepEqual(classFigure({ week: WEEK, rows, sittings: fixed }), { enough: true, sat: 5, average: 141 });
});

test('the week: only after a Sunday\'s answers open, from the launch, and never before the class existed', () => {
  // Monday morning after the first Sunday: its figure.
  assert.equal(figureWeek(IST('2026-11-23T09:00:00'), IST('2026-11-18T10:00:00')), WEEK);
  // That Sunday at 10:30 PM: answers not open, so the Sunday before (before the launch): nothing.
  assert.equal(figureWeek(IST('2026-11-22T22:30:00'), IST('2026-11-18T10:00:00')), null);
  // 11:05 PM: open.
  assert.equal(figureWeek(ANSWERS, IST('2026-11-18T10:00:00')), WEEK);
  // A class started on the Monday after has no figure for that Sunday.
  assert.equal(figureWeek(IST('2026-11-24T09:00:00'), IST('2026-11-23T08:00:00')), null);
  // The next Sunday after 11:05 PM: the new week.
  assert.equal(figureWeek(IST('2026-11-29T23:10:00'), IST('2026-11-18T10:00:00')), '2026-11-29');
  assert.deepEqual(nextFigure(IST('2026-11-18T09:00:00')), { week: WEEK, at: ANSWERS });
  assert.equal(nextFigure(IST('2026-11-23T09:00:00')).week, '2026-11-29');
  assert.equal(nextFigure(IST('2026-11-10T09:00:00')).week, WEEK, 'never before the launch');
  assert.equal(weekAllowed(WEEK, ANSWERS - 1, null), false, 'never live');
  assert.equal(weekAllowed(WEEK, ANSWERS, IST('2026-11-18T10:00:00')), true);
  assert.equal(weekAllowed('2026-11-15', IST('2026-11-23T09:00:00'), null), false, 'before the launch');
  assert.equal(weekAllowed('2026-11-21', IST('2026-11-23T09:00:00'), null), false, 'not a Sunday');
});

test('the words: plain, no rank, no exclamation, the floor said as the owner wrote it', () => {
  const all = [CLASS_COPY.what, ...CLASS_COPY.rules, ...JOIN_LINES.flat(), CLASS_COPY.floorLine].join(' ');
  assert.doesNotMatch(all, /!|rank(ed|ing)? \d|percentile|top \d|topper|leaderboard/i);
  assert.equal(CLASS_COPY.floorLine, 'Fewer than 5 sat it, so the average stays hidden.');
  const w = figureWords({ name: 'Accountancy', enough: true, sat: 31, average: 142, you: { scored: 168, max: 250 } });
  assert.deepEqual(w, { title: 'Accountancy', lines: ['31 of your class sat it', 'Class average 142 / 250'], you: 'You: 168 / 250' });
  assert.deepEqual(figureWords({ name: 'Economics', enough: false, you: null }).lines, ['Fewer than 5 sat it, so the average stays hidden.']);
  assert.equal(figureWords({ name: 'Economics', enough: false, you: null }).you, 'You did not sit it.');
  assert.equal(rulerAt(-12), 0);
  assert.equal(rulerAt(125), 0.5);
  assert.equal(rulerAt(400), 1);
});

test('the pending code survives sign-up on this device for a day, and nothing older or malformed', () => {
  const now = IST('2026-11-20T10:00:00');
  assert.equal(readPendingCode(JSON.stringify({ code: 'k7p2m9', at: now - 3_600_000 }), now), 'K7P2M9');
  assert.equal(readPendingCode(JSON.stringify({ code: 'K7P2M9', at: now - 2 * 86_400_000 }), now), null);
  assert.equal(readPendingCode(JSON.stringify({ code: 'nope', at: now }), now), null);
  assert.equal(readPendingCode('not json', now), null);
  assert.equal(readPendingCode(null, now), null);
});

test('a class report emails support the class\'s name and code, marks safety urgent, and never fails the report', async () => {
  const mail = classReportEmail({ code: 'K7P2M9', name: 'XII-C Commerce', members: 38, reason: 'safety', at: '2026-11-23T04:00:00.000Z' });
  assert.equal(mail.to, 'support@mockmob.in');
  assert.match(mail.subject, /^Urgent: class K7P2M9/);
  assert.match(mail.text, /Class: XII-C Commerce/);
  assert.match(mail.text, /Code: K7P2M9/);
  assert.match(mail.text, /Members now: 38/);
  assert.match(classReportEmail({ code: 'K7P2M9', name: 'X', reason: 'name', at: 0 }).subject, /^Class K7P2M9 reported: The class name is not okay/);
  const sent = [];
  const logs = [];
  const alert = createClassReportAlert({ enabled: () => true, take: async () => true, send: async (m) => { sent.push(m); return {}; }, log: (l) => logs.push(l) });
  assert.equal(await alert({ code: 'K7P2M9', name: 'X', reason: 'name', at: 0 }), 'sent');
  assert.equal(sent.length, 1);
  assert.equal(await createClassReportAlert({ enabled: () => false, take: async () => true, send: async () => ({}) })({ reason: 'name' }), 'off');
  assert.equal(await createClassReportAlert({ enabled: () => true, take: async () => false, send: async () => ({}), log: () => {} })({ reason: 'name' }), 'limited');
  assert.equal(await createClassReportAlert({ enabled: () => true, take: async () => true, send: async () => { throw new Error('down'); }, log: (l) => logs.push(l) })({ reason: 'safety', code: 'A', name: 'B', at: 0 }), 'failed');
});
