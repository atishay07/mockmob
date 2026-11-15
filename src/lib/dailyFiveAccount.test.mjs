// The Daily Five on the account, the pure half (lane daily, 15 Nov 2026): the save request, the rows and the record read back,
// the run of days, the 30-student floor, the Mob strip, and the device record beside the account. Software fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_LETTERS, DAILY_FIVE_CROWD_FLOOR, DAILY_FIVE_INTERACTION, DAILY_FIVE_MAX_MS, acceptAccount, acceptCrowd, acceptStrip, checkItems, checkSave,
  crowdLine, crowdLineFor, crowdShare, dailyRowId, dailySessionId, dateOfSession, memberStrip, playedDates, questionRef, recordFromRows, runDays,
  runNote, saveRows,
} from './dailyFiveAccount.mjs';
import { adoptAccount, beginRun, dateOfDay, dropForeign, finishDay, keepAnswer, markSaved, readRecord, resultFor, resultOn, scoreRun } from './dailyFive.mjs';

const DATE = '2026-11-15';
const DAY = 1;
const token = (i) => `d1.${'a'.repeat(16)}.${'b'.repeat(40)}${i}.${'c'.repeat(22)}`;
const TOKENS = [0, 1, 2, 3, 4].map(token);
const body = (change = {}) => ({ day: DAY, date: DATE, tokens: TOKENS, answers: ['A', 'B', 'C', 'D', 'A'], ms: 102_000, ...change });
const ITEMS = [{ id: 'q1', correct: 0 }, { id: 'q2', correct: 1 }, { id: 'q3', correct: 3 }, { id: 'q4', correct: 3 }, { id: 'q5', correct: 2 }];
const FIVE = [0, 1, 2, 3, 4].map((i) => ({ subject: 'English', chapter: `Chapter ${i}`, q: `Stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: ITEMS[i].correct, why: `Reason ${i}.` }));

test('the save request: today\'s day and date, five distinct tokens, five answers A to D only; the time is clamped', () => {
  const ok = checkSave(body());
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.picks, [0, 1, 2, 3, 0]);
  assert.equal(ok.ms, 102_000);
  assert.equal(checkSave(body({ ms: 99 * 60 * 60 * 1000 })).ms, DAILY_FIVE_MAX_MS, 'a phone left open overnight is not a 99-hour five');
  assert.equal(checkSave(body({ ms: 'soon' })).ms, null);
  for (const [change, error] of [
    [{ day: 2 }, 'bad_day'], [{ date: '2026-11-16' }, 'bad_day'], [{ day: 0, date: dateOfDay(0) }, 'bad_day'],
    [{ tokens: TOKENS.slice(0, 4) }, 'bad_questions'], [{ tokens: [TOKENS[0], TOKENS[0], TOKENS[2], TOKENS[3], TOKENS[4]] }, 'bad_questions'],
    [{ tokens: TOKENS.map((t, i) => (i ? t : 'short')) }, 'bad_questions'], [{ tokens: TOKENS.map((t, i) => (i ? t : `${t}<script>`)) }, 'bad_questions'],
    [{ answers: ['A', 'B', 'C', 'D'] }, 'bad_answers'], [{ answers: ['A', 'B', 'C', 'D', 'E'] }, 'bad_answers'],
    [{ answers: ['a', 'B', 'C', 'D', 'A'] }, 'bad_answers'], [{ answers: [0, 1, 2, 3, 0] }, 'bad_answers'], [{ answers: ['A', 'B', 'C', 'D', null] }, 'bad_answers'],
  ]) assert.equal(checkSave(body(change)).error, error, JSON.stringify(change));
  assert.equal(checkSave(null).ok, false);
  assert.equal(checkSave([]).ok, false);
});

test('the opened tokens: today\'s, each in its own place, five distinct questions, a key from A to D', () => {
  const opened = ITEMS.map((x, i) => ({ date: DATE, n: i + 1, id: x.id, correct: x.correct }));
  assert.deepEqual(checkItems(opened, DATE), { ok: true, items: ITEMS });
  assert.equal(checkItems(opened.map((x, i) => (i ? x : null)), DATE).ok, false, 'a token that did not open');
  assert.equal(checkItems(opened.map((x) => ({ ...x, date: '2026-11-14' })), DATE).ok, false, 'yesterday\'s five');
  assert.equal(checkItems([opened[1], opened[0], ...opened.slice(2)], DATE).ok, false, 'a question moved to another place');
  assert.equal(checkItems(opened.map((x, i) => ({ ...x, id: i < 2 ? 'same' : x.id })), DATE).ok, false, 'one question twice');
  assert.equal(checkItems(opened.map((x, i) => (i ? x : { ...x, correct: 4 })), DATE).ok, false);
  assert.equal(checkItems(opened.slice(0, 4), DATE).ok, false);
});

test('the rows: one per question, keyed by day, student and place; scored against the server\'s key; read back whole or not at all', () => {
  const rows = saveRows({ userId: 'u1', date: DATE, day: DAY, items: ITEMS, picks: [0, 1, 2, 3, 0], ms: 102_000, at: '2026-11-15T10:00:00.000Z' });
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5].map((n) => dailyRowId(DATE, 'u1', n)));
  assert.ok(rows.every((r) => r.interaction_type === DAILY_FIVE_INTERACTION && r.flow_context === null && r.session_id === dailySessionId(DATE) && r.user_id === 'u1'));
  assert.deepEqual(rows.map((r) => r.question_id), ['q1', 'q2', 'q3', 'q4', 'q5']);
  assert.deepEqual(rows.map((r) => r.metadata.right), [true, true, false, true, false], 'the server\'s key decides');
  assert.deepEqual(rows.map((r) => r.metadata.pick), ['A', 'B', 'C', 'D', 'A']);
  const rec = recordFromRows(rows, DATE);
  assert.deepEqual(rec, { date: DATE, day: DAY, score: 3, ms: 102_000, marks: [true, true, false, true, false], picks: [0, 1, 2, 3, 0] });
  assert.equal(recordFromRows(rows.slice(0, 4), DATE), null, 'four rows are not a day');
  assert.equal(recordFromRows([...rows, rows[0]], DATE), null, 'a place twice is not a day');
  assert.equal(recordFromRows(rows.map((r, i) => (i ? r : { ...r, metadata: { ...r.metadata, pick: 'E' } })), DATE), null);
  assert.equal(recordFromRows(rows.map((r) => ({ ...r, metadata: { ...r.metadata, score: 5 } })), DATE).score, 3, 'the score is counted, never read');
  assert.equal(dateOfSession('daily:2026-11-15'), DATE);
  assert.equal(dateOfSession('daily:2026-02-30'), null);
  assert.equal(dateOfSession('att_123'), null);
  assert.deepEqual(playedDates([{ session_id: 'daily:2026-11-16' }, { session_id: 'daily:2026-11-15' }, { session_id: 'daily:2026-11-16' }, { session_id: 'x' }]), ['2026-11-15', '2026-11-16']);
  assert.ok(ANSWER_LETTERS.length === 4);
});

test('how everyone did: nothing under 30 students, then a whole percent; a line only about the question on screen', () => {
  assert.equal(DAILY_FIVE_CROWD_FLOOR, 30);
  assert.equal(crowdShare(29, 29), null, '29 is under the floor');
  assert.equal(crowdShare(30, 19), 63);
  assert.equal(crowdShare(30, 0), 0);
  assert.equal(crowdShare(1000, 1000), 100);
  assert.equal(crowdShare(30, 31), null, 'never more right than answered');
  assert.equal(crowdShare(null, 0), null);
  assert.equal(crowdLine(64), '64% got this right');
  assert.equal(crowdLine(null), null);
  const refs = FIVE.map(questionRef);
  assert.equal(new Set(refs).size, 5);
  assert.match(refs[0], /^[0-9a-f]{8}$/);
  assert.equal(questionRef({ q: ' Stem 0 ', options: ['a ', 'b', 'c', 'd'] }), refs[0], 'the page\'s trimmed text matches the server\'s');
  const crowd = acceptCrowd({ date: DATE, questions: FIVE.map((q, i) => ({ ref: refs[i], pct: [64, null, 88, 41, null][i] })) }, DATE);
  assert.equal(crowdLineFor(crowd, FIVE, 0), '64% got this right');
  assert.equal(crowdLineFor(crowd, FIVE, 1), null, 'under the floor: no line');
  const other = FIVE.map((q, i) => (i === 2 ? { ...q, q: 'A different question' } : q));
  assert.equal(crowdLineFor(crowd, other, 2), null, 'numbers about another question are never shown under this one');
  assert.equal(crowdLineFor(crowd, null, 0), null);
  assert.equal(acceptCrowd({ date: '2026-11-14', questions: crowd }, DATE), null, 'yesterday\'s numbers');
  assert.equal(acceptCrowd({ date: DATE, questions: crowd.slice(0, 4) }, DATE), null);
  assert.equal(acceptCrowd({ date: DATE, questions: FIVE.map(() => ({ ref: 'zz', pct: 1 })) }, DATE), null);
});

test('the account\'s answer, the run of days and the line under it', () => {
  const record = { date: DATE, day: DAY, score: 3, ms: 9000, marks: [true, true, false, true, false], picks: [0, 1, 2, 3, 0] };
  assert.deepEqual(acceptAccount({ day: DAY, date: DATE, record, played: ['2026-11-15', 'junk', '2026-11-14', '2026-11-15'] }), { day: DAY, date: DATE, record, played: ['2026-11-14', '2026-11-15'] });
  assert.deepEqual(acceptAccount({ day: DAY, date: DATE, record: null }).record, null);
  assert.equal(acceptAccount({ day: DAY, date: DATE, record: { ...record, score: 5 } }), null, 'a record whose score is not its marks');
  assert.equal(acceptAccount({ day: DAY, date: DATE, record: { ...record, date: '2026-11-14' } }), null);
  assert.equal(acceptAccount({ day: 2, date: DATE }), null);
  assert.deepEqual(runDays(['2026-11-13', '2026-11-14'], DATE, true), ['2026-11-13', '2026-11-14', DATE]);
  assert.deepEqual(runDays(['2026-11-14'], DATE, false), ['2026-11-14']);
  assert.equal(runNote('guest'), 'Your run is kept on this device.');
  assert.equal(runNote('saved'), 'Your run is kept on your account.');
  assert.match(runNote('saving'), /Saving/);
  assert.match(runNote('failed'), /isn’t on your account yet/);
  assert.match(runNote('device'), /this device only/);
  for (const s of ['guest', 'saved', 'saving', 'failed', 'device']) assert.doesNotMatch(runNote(s), /!|[\u{1F300}-\u{1FAFF}]/u);
});

test('the Mob strip: members only, in the den\'s order, never sorted by score; a private score shows as played; no user id leaves', () => {
  const members = [
    { user_id: 'u-riya', display_name: 'Riya', colour: 3, show_score: true },
    { user_id: 'u-me', display_name: 'Aarav', colour: 1, show_score: false },
    { user_id: 'u-kabir', display_name: 'Kabir', colour: 1, show_score: true },
    { user_id: 'u-zoya', display_name: 'Zoya', colour: 2, show_score: false },
  ];
  const rowsOf = (userId, picks) => saveRows({ userId, date: DATE, day: DAY, items: ITEMS, picks, at: 'x' });
  const rows = [...rowsOf('u-zoya', [0, 1, 3, 3, 2]), ...rowsOf('u-riya', [1, 1, 2, 3, 0]), ...rowsOf('u-me', [0, 1, 3, 3, 2]), ...rowsOf('u-stranger', [0, 1, 3, 3, 2])];
  const strip = memberStrip(members, rows, { userId: 'u-me', date: DATE });
  assert.deepEqual(strip.map((m) => m.name), ['Riya', 'Aarav', 'Kabir', 'Zoya'], 'the den\'s order, not the best score first');
  assert.deepEqual(strip[0], { name: 'Riya', colour: 3, you: false, state: 'marks', marks: [false, true, false, true, false] });
  assert.equal(strip[1].state, 'marks', 'your own squares, even with your score private to others');
  assert.equal(strip[1].you, true);
  assert.deepEqual(strip[2], { name: 'Kabir', colour: 1, you: false, state: 'not_yet' });
  assert.deepEqual(strip[3], { name: 'Zoya', colour: 2, you: false, state: 'played' }, 'kept to herself: played, no squares');
  assert.doesNotMatch(JSON.stringify(strip), /u-/, 'no user id');
  assert.equal(strip.length, 4, 'a row of someone outside the Mob is never listed');
  assert.deepEqual(acceptStrip({ date: DATE, members: strip }).members, strip);
  assert.equal(acceptStrip({ date: DATE, members: [{ name: 'X', state: 'marks', marks: [true] }] }), null);
  assert.equal(acceptStrip({ date: DATE, members: [{ name: '', state: 'not_yet' }] }), null);
});

test('the device beside the account: the account wins, another account\'s day is not this student\'s, a save is marked', () => {
  let rec = beginRun(readRecord(null), { date: DATE, startedAt: 1000 });
  for (let i = 0; i < 5; i += 1) rec = keepAnswer(rec, { date: DATE, index: i, pick: [0, 1, 2, 3, 0][i] });
  const scored = scoreRun(rec.run.picks, FIVE);
  assert.deepEqual(scored.picks, [0, 1, 2, 3, 0]);
  rec = finishDay(rec, { date: DATE, ...scored, ms: 9000, by: 'u-me' });
  assert.equal(resultOn(rec, DATE).by, 'u-me');
  assert.deepEqual(readRecord(JSON.stringify(rec)), rec, 'the new fields read back unchanged');
  assert.equal(resultFor(rec, DATE, null).score, 3, 'a guest on this device sees it, as before');
  assert.equal(resultFor(rec, DATE, 'u-me').score, 3);
  assert.equal(resultFor(rec, DATE, 'u-sister'), null, 'another account has not played its five here');
  const cleared = dropForeign(rec, DATE, 'u-sister');
  assert.equal(resultOn(cleared, DATE), null);
  assert.equal(beginRun(cleared, { date: DATE, startedAt: 5 }).run.startedAt, 5, 'so it can play its own');
  assert.equal(dropForeign(rec, DATE, 'u-me'), rec);
  const saved = markSaved(rec, DATE, 'u-me');
  assert.equal(resultOn(saved, DATE).saved, true);
  assert.equal(markSaved(rec, DATE, 'u-sister'), rec);
  // The account played on another phone: its record replaces this device's run and result.
  const account = { date: DATE, day: DAY, score: 2, ms: 50_000, marks: [true, false, false, true, false], picks: [0, 0, 0, 3, 0] };
  const fresh = beginRun(readRecord(null), { date: DATE, startedAt: 1 });
  const adopted = adoptAccount(fresh, account, { userId: 'u-me', questions: FIVE });
  assert.equal(adopted.run, null, 'the run on this device closes');
  assert.deepEqual(adopted.played, [DATE]);
  const last = resultOn(adopted, DATE);
  assert.equal(last.score, 2);
  assert.equal(last.saved, true);
  assert.deepEqual(last.missed.map((m) => m.n), [2, 3, 5]);
  assert.equal(last.missed[0].picked, 'a');
  assert.equal(last.missed[0].answer, 'b');
  assert.deepEqual(last.chapters, FIVE.map((q) => q.chapter));
  assert.deepEqual(adoptAccount(adopted, account, { userId: 'u-me', questions: FIVE }), adopted, 'adopting twice changes nothing');
  const withoutFive = adoptAccount(fresh, account, { userId: 'u-me' });
  assert.deepEqual(resultOn(withoutFive, DATE).missed, [], 'without the five the misses wait for them');
  assert.deepEqual(readRecord(JSON.stringify(adopted)), adopted);
});
