// The Sunday Mock's pure model (src/lib/sundayMock.mjs): the IST window, who may start, what counts, the 30-sitter floor,
// the claim row, the words; and the answer hold it rides on (src/lib/mob/paperHold.mjs, kind 'sunday').
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINISH_GRACE_MS, PAPER_COUNT, SHARE_FLOOR, SUNDAY_COPY, SUNDAY_TAG, claimPeriod, claimReference, countsFor, dateLabel, isSundayTag,
  isWeekKey, marksOf, opensLine, parseClaim, satLine, sendAllowed, shareLine, startRefusal, startRefusalCopy, subjectState,
  sundayHoldCopy, sundayOf, sundayPaperHref, sundayState, sundayStats, sundayTag, sundayWeekOf, sundayWindow, timeLabel, windowLine,
} from './sundayMock.mjs';
import { attemptForClient, attemptHold, isHeld } from './mob/paperHold.mjs';

const IST = (s) => Date.parse(`${s}+05:30`);
const MIN = 60_000;

test('the week is the coming Sunday in IST, whatever the server clock zone', () => {
  assert.equal(sundayOf(IST('2026-11-16T00:00:00')), '2026-11-22'); // Monday
  assert.equal(sundayOf(IST('2026-11-21T23:59:59')), '2026-11-22'); // Saturday night
  assert.equal(sundayOf(IST('2026-11-22T00:00:00')), '2026-11-22'); // Sunday morning
  assert.equal(sundayOf(IST('2026-11-22T23:59:59')), '2026-11-22'); // Sunday night
  assert.equal(sundayOf(IST('2026-11-23T00:00:00')), '2026-11-29'); // the next Monday
  // 7:00 PM UTC on Saturday is already 12:30 AM IST on Sunday.
  assert.equal(sundayOf(Date.parse('2026-11-21T19:00:00Z')), '2026-11-22');
  assert.equal(isWeekKey('2026-11-22'), true);
  assert.equal(isWeekKey('2026-11-23'), false, 'a Monday is never a Sunday Mock week');
  assert.equal(isWeekKey('2026-11-22x'), false);
});

test('the window opens at 10:00 AM and takes its last first start at 9:59 PM IST', () => {
  const at = (s) => sundayState(IST(s));
  assert.equal(at('2026-11-21T10:00:00').phase, 'before');
  assert.equal(at('2026-11-22T09:59:59.999').phase, 'before');
  assert.equal(at('2026-11-22T10:00:00').phase, 'open');
  assert.equal(at('2026-11-22T21:59:59.999').phase, 'open');
  assert.equal(at('2026-11-22T22:00:00').phase, 'closed');
  assert.equal(at('2026-11-22T23:30:00').phase, 'closed');
  assert.equal(at('2026-11-23T08:00:00').phase, 'before');
  assert.equal(at('2026-11-23T08:00:00').week, '2026-11-29');
  assert.equal(at('2026-11-23T08:00:00').previous, '2026-11-22');
  assert.equal(startRefusal(at('2026-11-22T09:59:59')), 'NOT_OPEN');
  assert.equal(startRefusal(at('2026-11-22T10:00:00')), null);
  assert.equal(startRefusal(at('2026-11-22T21:59:59')), null);
  assert.equal(startRefusal(at('2026-11-22T22:00:00')), 'CLOSED');
  assert.equal(startRefusal(at('2026-11-21T12:00:00')), 'NOT_OPEN');
  assert.equal(startRefusal(null), 'NOT_OPEN');
  const win = sundayWindow('2026-11-22');
  assert.equal(new Date(win.opensAt).toISOString(), '2026-11-22T04:30:00.000Z');
  assert.equal(new Date(win.closesAt).toISOString(), '2026-11-22T16:30:00.000Z');
  assert.equal(new Date(win.answersAt).toISOString(), '2026-11-22T17:35:00.000Z', 'the answers open at 11:05 PM IST');
  assert.equal(win.answersAt, win.closesAt + 65 * MIN, 'the last start, its 60 minutes and 5 more');
  assert.equal(win.lastFinishAt, win.closesAt + 60 * MIN + FINISH_GRACE_MS);
  assert.ok(win.lastFinishAt < win.answersAt, 'every send that can count is in before the answers open');
  // Starts end at 10:00 PM; the answers open at 11:05 PM, not a minute before.
  for (const [s, open] of [['2026-11-22T22:59:00', false], ['2026-11-22T23:04:59', false], ['2026-11-22T23:05:00', true]]) {
    const st = at(s);
    assert.equal(st.phase, 'closed');
    assert.equal(startRefusal(st), 'CLOSED');
    assert.equal(st.answersOpen, open, s);
  }
  assert.equal(at('2026-11-22T21:59:59').answersOpen, false);
});

test('a paper started by 10:00 PM keeps its 60 minutes; a send past them and the grace is refused and never counted', () => {
  const start = IST('2026-11-22T21:59:00');
  assert.equal(sendAllowed(start, start + 60 * MIN), true);
  assert.equal(sendAllowed(start, start + 60 * MIN + FINISH_GRACE_MS), true);
  assert.equal(sendAllowed(start, start + 60 * MIN + FINISH_GRACE_MS + 1), false);
  assert.equal(sendAllowed(NaN, start), false);
  const win = sundayWindow('2026-11-22');
  assert.equal(countsFor('2026-11-22', win.opensAt - 1), false);
  assert.equal(countsFor('2026-11-22', win.opensAt), true);
  assert.equal(countsFor('2026-11-22', win.lastFinishAt), true);
  assert.equal(countsFor('2026-11-22', win.lastFinishAt + 1), false);
  assert.equal(countsFor('2026-11-29', IST('2026-11-22T12:00:00')), false, 'another week never counts');
  assert.equal(countsFor('not-a-week', win.opensAt), false);
});

test('the tag holds the answers until 11:05 PM, as a Mob paper is held, with its own words', () => {
  const tag = sundayTag('2026-11-22');
  assert.deepEqual(tag, { mobId: SUNDAY_TAG, weekStart: '2026-11-22', holdUntil: '2026-11-22T17:35:00.000Z' });
  assert.equal(isSundayTag(tag), true);
  assert.equal(isSundayTag({ mobId: '6f0a0a2c-1111-4111-8111-111111111111', weekStart: '2026-11-16' }), false);
  assert.equal(isSundayTag({ mobId: SUNDAY_TAG, weekStart: '2026-11-23' }), false);
  const attempt = { id: 'a1', userId: 'u1', subject: 'accountancy', score: 160, correct: 34, wrong: 10, unattempted: 6, total: 50,
    details: [{ qid: 'q1', givenIndex: 1, isCorrect: true }], questionsSnapshot: [{ id: 'q1', correctIndex: 1, explanation: 'x' }],
    selectionMeta: { mode: 'full', mobPaper: tag }, completedAt: IST('2026-11-22T11:00:00') };
  const during = attemptHold(attempt, IST('2026-11-22T21:59:59'));
  assert.equal(during.kind, 'sunday');
  assert.equal(during.until, '2026-11-22T17:35:00.000Z');
  assert.equal(during.title, 'The answers open at 11:05 PM');
  assert.match(during.line, /started by 10:00 PM are still being sat until 11:00 PM, so the answers and explanations stay closed until 11:05 PM/);
  assert.doesNotMatch(during.line, /Mob/);
  // The boundary minutes: still held at 10:59 PM and 11:04 PM, open at 11:05 PM.
  assert.equal(isHeld(attempt, IST('2026-11-22T22:00:00')), true);
  assert.equal(isHeld(attempt, IST('2026-11-22T22:59:00')), true);
  assert.equal(isHeld(attempt, IST('2026-11-22T23:04:59')), true);
  assert.equal(isHeld(attempt, IST('2026-11-22T23:05:00')), false);
  assert.match(SUNDAY_COPY.held, /open at 11:05 PM, once every paper started by 10:00 PM is in/);
  const view = attemptForClient(attempt, IST('2026-11-22T21:00:00'));
  assert.deepEqual(view.details, []);
  assert.deepEqual(view.questionsSnapshot, []);
  assert.equal(view.correct, 34);
  assert.equal(view.mobHold.kind, 'sunday');
  assert.equal(attemptForClient(attempt, IST('2026-11-22T23:05:00')), attempt);
  // A tag carrying another stamp still opens at that Sunday's 11:05 PM: the window decides, never the stamp.
  const stretched = { ...attempt, selectionMeta: { mobPaper: { ...tag, holdUntil: '2026-12-31T00:00:00.000Z' } } };
  assert.equal(isHeld(stretched, IST('2026-11-22T23:05:01')), false);
  const early = { ...attempt, selectionMeta: { mobPaper: { ...tag, holdUntil: '2026-11-22T10:00:00.000Z' } } };
  assert.equal(isHeld(early, IST('2026-11-22T22:30:00')), true);
  assert.equal(sundayWeekOf(attempt), '2026-11-22');
  assert.equal(sundayWeekOf({ selectionMeta: { mobPaper: { mobId: 'x', weekStart: '2026-11-16' } } }), null);
});

test('the claim row: one per student, Sunday and subject, holding the first start and the frozen paper', () => {
  assert.equal(claimPeriod('2026-11-22', 'accountancy'), '2026-11-22:accountancy');
  const ids = Array.from({ length: PAPER_COUNT }, (_, i) => `9b1f0000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const ref = claimReference({ startedAt: IST('2026-11-22T10:00:05'), ids });
  assert.deepEqual(parseClaim(ref), { startedAt: IST('2026-11-22T10:00:05'), ids });
  assert.throws(() => claimReference({ startedAt: 1, ids: ['a,b'] }));
  assert.throws(() => claimReference({ startedAt: 1, ids: [] }));
  assert.equal(parseClaim('v1:12:'), null);
  assert.equal(parseClaim('practice'), null);
  assert.equal(parseClaim(null), null);
});

test('the counts: one sitting a student, late sends left out, and the share per question only from 30 sitters', () => {
  const week = '2026-11-22';
  const at = IST('2026-11-22T12:00:00');
  const row = (u, right, extra = {}) => ({ userId: `u${u}`, completedAt: at, details: [{ qid: 'q1', isCorrect: right }, { qid: 'q2', isCorrect: !right }], ...extra });
  const rows29 = Array.from({ length: 29 }, (_, i) => row(i, i % 2 === 0));
  assert.deepEqual(sundayStats(rows29, { week }), { week, sat: 29, shares: null });
  // A late send and a second row for the same student do not make the floor.
  const late = row(99, true, { completedAt: sundayWindow(week).lastFinishAt + 1 });
  assert.deepEqual(sundayStats([...rows29, late, row(0, true)], { week }), { week, sat: 29, shares: null });
  const rows30 = [...rows29, row(29, true)];
  const stats = sundayStats(rows30, { week });
  assert.equal(stats.sat, 30);
  assert.equal(stats.shares.q1, Math.round((100 * 16) / 30));
  assert.equal(stats.shares.q2, Math.round((100 * 14) / 30));
  // A question fewer than 30 were served (a replaced one) has no share.
  const replaced = rows30.map((r, i) => (i < 5 ? { ...r, details: [...r.details, { qid: 'q3', isCorrect: true }] } : r));
  assert.equal('q3' in sundayStats(replaced, { week }).shares, false);
  assert.equal(SHARE_FLOOR, 30);
  assert.equal(sundayStats([], { week }).sat, 0);
});

test('marks, words and links say real things in 12-hour IST, with no rank, place or percentile anywhere', () => {
  assert.deepEqual(marksOf({ correct: 34, wrong: 10, total: 50 }), { scored: 160, max: 250 });
  assert.equal(timeLabel(IST('2026-11-22T10:00:00')), '10:00 AM');
  assert.equal(timeLabel(IST('2026-11-22T22:00:00')), '10:00 PM');
  assert.equal(timeLabel(IST('2026-11-22T00:05:00')), '12:05 AM');
  assert.equal(dateLabel('2026-11-22'), 'Sunday 22 Nov');
  assert.equal(windowLine('2026-11-29'), 'Sunday 29 Nov, 10:00 AM to 10:00 PM');
  assert.equal(opensLine(sundayState(IST('2026-11-21T09:00:00'))), 'Opens tomorrow at 10:00 AM');
  assert.equal(opensLine(sundayState(IST('2026-11-22T08:00:00'))), 'Opens today at 10:00 AM');
  assert.equal(opensLine(sundayState(IST('2026-11-17T08:00:00'))), 'Opens Sunday 22 Nov at 10:00 AM');
  assert.equal(satLine(1240), '1,240 students sat this paper.');
  assert.equal(satLine(1), '1 student sat this paper.');
  assert.equal(satLine(0), '');
  assert.equal(shareLine(64), '64% got it right');
  assert.equal(sundayPaperHref('2026-11-22', 'accountancy'), '/test?subject=accountancy&mode=full&count=50&sunday=1&generationKey=sunday-2026-11-22-accountancy');
  const words = [
    ...Object.values(SUNDAY_COPY), sundayHoldCopy(IST('2026-11-22T22:00:00')).line, satLine(40),
    ...['NOT_OPEN', 'CLOSED', 'NOT_YOUR_SUBJECT', 'PAPER_UNAVAILABLE', 'PAPER_EXPIRED', 'SUBJECT_NOT_SUPPORTED', 'X'].flatMap((c) => Object.values(startRefusalCopy(c, { week: '2026-11-22', next: '2026-11-29', opensAt: IST('2026-11-22T10:00:00'), closesAt: IST('2026-11-22T22:00:00'), subjectName: 'Accountancy' }))),
  ].join(' ');
  assert.doesNotMatch(words, /!|\brank|percentile|leaderboard|\bplace\b|top \d|undefined|NaN/i);
  assert.match(startRefusalCopy('CLOSED', { closesAt: IST('2026-11-22T22:00:00'), next: '2026-11-29', opensAt: IST('2026-11-22T10:00:00') }).message, /10:00 PM.*Sunday 29 Nov at 10:00 AM/);
});

test('a subject\'s state this week, from the student\'s own facts', () => {
  const open = sundayState(IST('2026-11-22T12:00:00'));
  const t = IST('2026-11-22T12:00:00');
  assert.equal(subjectState({ state: open, now: t }), 'open');
  assert.equal(subjectState({ state: sundayState(IST('2026-11-21T12:00:00')), now: t }), 'soon');
  assert.equal(subjectState({ state: sundayState(IST('2026-11-22T22:10:00')), now: IST('2026-11-22T22:10:00') }), 'closed');
  assert.equal(subjectState({ state: open, attempt: { id: 'a' }, now: t }), 'sat');
  assert.equal(subjectState({ state: open, claim: { startedAt: t - 30 * MIN }, now: t }), 'started');
  assert.equal(subjectState({ state: open, claim: { startedAt: t - 63 * MIN }, now: t }), 'unsent');
  // Started at 9:50 PM: still resumable after the close.
  const late = IST('2026-11-22T22:30:00');
  assert.equal(subjectState({ state: sundayState(late), claim: { startedAt: IST('2026-11-22T21:50:00') }, now: late }), 'started');
});

import { practiceLine, runnerProblem, subjectRow, todayCard } from './sundayMock.mjs';

/** A status as GET /api/sunday answers it, at an IST instant, with the subjects given. */
function statusAt(s, subjects, previous = null) {
  const st = sundayState(IST(s));
  return { week: st.week, phase: st.phase, dow: st.dow, serverNow: IST(s), opensAt: new Date(st.opensAt).toISOString(), closesAt: new Date(st.closesAt).toISOString(), next: st.next, subjects, previous };
}
const acc = (state, extra = {}) => ({ id: 'accountancy', name: 'Accountancy', state, ...extra });
const eco = (state, extra = {}) => ({ id: 'economics', name: 'Economics', state, ...extra });

test('Today\'s card: Saturday, Sunday morning, open, sat and waiting, closed, Monday; nothing midweek or without subjects', () => {
  const sat = todayCard(statusAt('2026-11-21T18:00:00', [acc('soon')]));
  assert.deepEqual(sat, { title: 'Sunday Mock tomorrow', line: '10:00 AM to 10:00 PM. One full paper in each of your subjects, the same for everyone. Free.', href: '/sunday' });
  assert.equal(todayCard(statusAt('2026-11-22T08:00:00', [acc('soon')])).title, 'Sunday Mock today');
  assert.equal(todayCard(statusAt('2026-11-18T12:00:00', [acc('soon')])), null, 'Wednesday says nothing');
  assert.equal(todayCard(statusAt('2026-11-22T11:00:00', [])), null);
  assert.equal(todayCard(null), null);
  const one = todayCard(statusAt('2026-11-22T11:00:00', [acc('open')]));
  assert.equal(one.key.label, 'Sit it');
  assert.equal(one.key.href, sundayPaperHref('2026-11-22', 'accountancy'));
  assert.match(one.line, /^Open until 10:00 PM\./);
  assert.deepEqual(todayCard(statusAt('2026-11-22T11:00:00', [acc('open'), eco('open')])).key, { label: 'Choose a subject', href: '/sunday' });
  const some = todayCard(statusAt('2026-11-22T14:00:00', [acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 } }), eco('open')]));
  assert.equal(some.line, 'Accountancy: 160/250. Economics is open until 10:00 PM.');
  assert.equal(some.key.label, 'Sit Economics');
  const running = todayCard(statusAt('2026-11-22T11:20:00', [acc('started', { resumeUntil: new Date(IST('2026-11-22T12:02:00')).toISOString() }), eco('open')]));
  assert.deepEqual(running.key.label, 'Resume');
  assert.match(running.line, /until 12:02 PM/);
  const waiting = todayCard(statusAt('2026-11-22T17:30:00', [acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 } })]));
  assert.deepEqual(waiting, { title: 'You sat the Sunday Mock', line: 'Accountancy: 160/250. The answers open at 11:05 PM.', href: '/result/a1' });
  // 10:00 to 11:05 PM: closed for new starts, the answers at 11:05 PM; a paper still running keeps Resume.
  for (const s of ['2026-11-22T22:30:00', '2026-11-22T22:59:00', '2026-11-22T23:04:00']) {
    const closing = todayCard(statusAt(s, [acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 } }), eco('closed')]));
    assert.deepEqual(closing, { title: 'You sat the Sunday Mock', line: 'Accountancy: 160/250. Closed for new starts. The answers open at 11:05 PM.', href: '/result/a1' });
  }
  const late = todayCard(statusAt('2026-11-22T22:30:00', [acc('started', { resumeUntil: new Date(IST('2026-11-22T22:52:00')).toISOString() })]));
  assert.equal(late.key.label, 'Resume');
  assert.equal(late.line, 'You started Accountancy. Your time runs until 10:52 PM. The answers open at 11:05 PM.');
  const closed = todayCard(statusAt('2026-11-22T23:05:00', [acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 }, sat: 1240 }), eco('closed')]));
  assert.equal(closed.line, 'Accountancy: 160/250. 1,240 students sat this paper. The answers are open now.');
  assert.equal(closed.href, '/result/a1');
  assert.match(waiting.line, /The answers open at 11:05 PM\.$/);
  const none = todayCard(statusAt('2026-11-22T22:30:00', [acc('closed')]));
  assert.equal(none.title, 'Next Sunday Mock');
  assert.match(none.line, /^Sunday 29 Nov, 10:00 AM to 10:00 PM\./);
  const monday = todayCard(statusAt('2026-11-23T08:30:00', [acc('soon')], { week: '2026-11-22', subjects: [acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 }, sat: 1240 })] }));
  assert.equal(monday.title, 'Your Sunday Mock');
  assert.equal(todayCard(statusAt('2026-11-23T08:30:00', [acc('soon')])), null, 'Monday without a sitting says nothing');
  assert.equal(todayCard(statusAt('2026-11-24T08:30:00', [acc('soon')], { week: '2026-11-22', subjects: [acc('sat', { resultId: 'a1', marks: { scored: 1, max: 250 } })] })), null, 'Tuesday says nothing');
});

test('Practice\'s chip shows only near the paper: Saturday, and Sunday until the last start (owner, 16 Nov 2026)', () => {
  const NB = ' ';
  const line = (at, subjects = [acc('soon')], now = IST(at)) => {
    const row = practiceLine(statusAt(at, subjects), now);
    return row ? `${row.title} ${row.line}` : null;
  };
  // Each day of the launch week, at noon IST: Monday to Friday nothing, Saturday the reminder, Sunday open.
  const week = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'].map((d) => line(`${d}T12:00:00`));
  assert.deepEqual(week, [null, null, null, null, null, `Sunday Mock is tomorrow, 10:00${NB}am to 10:00${NB}pm. Free.`, `Sunday Mock is open until 10:00${NB}pm.`]);
  // Saturday from its first minute (12:00 am IST) to its last.
  assert.match(line('2026-11-21T00:00:00'), /is tomorrow/);
  assert.equal(line('2026-11-20T23:59:00'), null, 'Friday night: not yet');
  assert.match(line('2026-11-21T23:59:00'), /is tomorrow/);
  // Sunday: before the open, the open, the last start, after it.
  assert.equal(line('2026-11-22T00:00:00'), `Sunday Mock opens today at 10:00${NB}am.`);
  assert.equal(line('2026-11-22T09:59:00'), `Sunday Mock opens today at 10:00${NB}am.`);
  assert.equal(line('2026-11-22T10:00:00'), `Sunday Mock is open until 10:00${NB}pm.`);
  assert.equal(line('2026-11-22T21:59:00'), `Sunday Mock is open until 10:00${NB}pm.`);
  assert.equal(line('2026-11-22T22:00:00'), null, 'from the last start: nothing');
  assert.equal(line('2026-11-22T23:30:00'), null);
  assert.equal(line('2026-11-23T00:00:00'), null, 'Monday: nothing');
  // Never before the launch week's own Saturday (the Saturday before the first paper is 21 Nov).
  assert.equal(line('2026-11-14T12:00:00'), null, 'the Saturday a week before the first paper');
  assert.equal(line('2026-11-15T11:00:00'), null, 'the Sunday before the launch week');
  // The next week runs the same way.
  assert.match(line('2026-11-28T08:00:00'), /is tomorrow/);
  assert.equal(line('2026-11-25T12:00:00'), null);
  // The clock is the one passed in, not the status's: a status read on Friday night turns into Saturday's line at midnight.
  assert.match(line('2026-11-20T23:59:00', [acc('soon')], IST('2026-11-21T00:01:00')), /is tomorrow/);
  // Without subjects, or without a status or a clock: nothing.
  assert.equal(line('2026-11-21T12:00:00', []), null);
  assert.equal(practiceLine(null, IST('2026-11-21T12:00:00')), null);
  assert.equal(practiceLine({ subjects: [acc('soon')] }), null, 'no serverNow and no clock passed');
  // Lower-case times, no exclamation marks.
  for (const at of ['2026-11-21T12:00:00', '2026-11-22T08:00:00', '2026-11-22T12:00:00']) assert.doesNotMatch(line(at), /AM|PM|!/);
});

test('the page\'s rows and the runner\'s refusals', () => {
  const s = statusAt('2026-11-22T12:00:00', []);
  assert.equal(subjectRow(s, acc('open')).key.label, 'Sit it');
  assert.equal(subjectRow(s, acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 } })).line, 'You sat it: 160/250. The answers open at 11:05 PM.');
  assert.equal(subjectRow(statusAt('2026-11-22T23:04:00', []), acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 } })).line, 'You sat it: 160/250. The answers open at 11:05 PM.');
  assert.equal(subjectRow(s, acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 } })).link.href, '/result/a1');
  assert.equal(subjectRow(statusAt('2026-11-22T23:05:00', []), acc('sat', { resultId: 'a1', marks: { scored: 160, max: 250 }, sat: 31 })).line, 'You sat it: 160/250. 31 students sat this paper.');
  assert.equal(subjectRow(s, acc('unsent')).key, undefined);
  assert.equal(subjectRow(statusAt('2026-11-22T23:00:00', []), acc('closed')).line, 'You did not sit it this week.');
  assert.equal(subjectRow(statusAt('2026-11-21T23:00:00', []), acc('soon')).line, 'Not open yet.');
  const p = runnerProblem(Object.assign(new Error('CLOSED'), { body: { error: 'CLOSED', detail: { week: '2026-11-22', next: '2026-11-29', opensAt: '2026-11-22T04:30:00.000Z', closesAt: '2026-11-22T16:30:00.000Z' } } }));
  assert.equal(p.title, 'This Sunday’s paper has closed');
  assert.equal(p.message, 'The last start was at 10:00 PM. The next one opens on Sunday 29 Nov at 10:00 AM.');
  assert.deepEqual(p.keys, [{ label: 'Back to Sunday Mock', href: '/sunday', primary: true }]);
  assert.match(runnerProblem(Object.assign(new Error('NOT_YOUR_SUBJECT'), { body: { detail: { subjectName: 'Economics' } } })).title, /^Economics is not one of your subjects/);
});

import { denStrip } from './sundayMock.mjs';

test('the den strip (rule F2): only members who sat, and your own row; another member\'s not-yet row is refused', () => {
  const den = (s, members) => ({ ...statusAt(s, []), available: true, subject: 'accountancy', subjectName: 'Accountancy', members });
  const riya = { name: 'Riya', colour: 3, you: false, sat: true, marks: { scored: 184, max: 250 } };
  const kabir = { name: 'Kabir', colour: 1, you: false, sat: true };
  const zoya = { name: 'Zoya', colour: 1, you: false, sat: false }; // must never be drawn
  const me = (sat) => ({ name: 'Aarav', colour: 1, you: true, sat, ...(sat ? { marks: { scored: 160, max: 250 } } : {}) });
  const open = denStrip(den('2026-11-22T15:00:00', [riya, me(false), kabir, zoya]));
  assert.deepEqual(open.rows.map((m) => m.name), ['Riya', 'Aarav', 'Kabir']);
  assert.equal(open.line, '2 of you have sat this week\'s Accountancy paper.');
  assert.doesNotMatch(open.line, /of 4|of 3|Zoya/);
  assert.equal(denStrip(den('2026-11-22T15:00:00', [me(false)])).line, 'This week\'s Accountancy paper is open until 10:00 PM.');
  assert.equal(denStrip(den('2026-11-22T15:00:00', [riya, me(false)])).line, '1 of you has sat this week\'s Accountancy paper.');
  const closed = denStrip(den('2026-11-22T23:30:00', [riya, me(true), kabir, zoya]));
  assert.deepEqual(closed.rows.map((m) => m.name), ['Riya', 'Aarav', 'Kabir']);
  assert.equal(closed.line, '3 of you sat it. The next one is on Sunday 29 Nov.');
  // After the close your own not-yet row goes too: only sitters remain.
  assert.deepEqual(denStrip(den('2026-11-22T23:30:00', [riya, me(false), zoya])).rows.map((m) => m.name), ['Riya']);
  assert.equal(denStrip(den('2026-11-22T23:30:00', [me(false)])).line, 'The next one is on Sunday 29 Nov.');
  const before = denStrip(den('2026-11-21T18:00:00', [riya]));
  assert.deepEqual(before.rows, []);
  assert.match(before.line, /^Opens tomorrow at 10:00 AM\./);
  assert.equal(denStrip(null), null);
  assert.equal(denStrip({ available: false }), null);
});
