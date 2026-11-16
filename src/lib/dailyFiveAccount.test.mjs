// The Daily Five on the account, the pure half (lane daily, 15 Nov 2026): the check request, the rows a check leaves and the
// record read back, the run of days, the 30-student floor, the Mob strip, and the device record beside the account.
// Software fixtures only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_LETTERS, DAILY_FIVE_CROWD_FLOOR, DAILY_FIVE_INTERACTION, DAILY_FIVE_MAX_MS, acceptAccount, acceptCheck, acceptCrowd, acceptStrip, checkAnswer,
  checkOpened, checkRequest, checkRow, crowdLine, crowdLineFor, crowdShare, dailyRowId, dailySessionId, dateOfSession, memberStrip, playedDates,
  questionRef, recordFromRows, reviewFrom, runDays, runNote,
} from './dailyFiveAccount.mjs';
import {
  adoptAccount, beginRun, dropForeign, finishDay, keepAnswer, keepCheck, markSaved, nextOpen, readRecord, resultFor, resultOn, scoreRun, withChecks,
} from './dailyFive.mjs';

const DATE = '2026-11-15';
const DAY = 1;
const TOKEN = `d1.${'a'.repeat(16)}.${'b'.repeat(40)}.${'c'.repeat(22)}`;
const ITEMS = [{ id: 'q1', correct: 0 }, { id: 'q2', correct: 1 }, { id: 'q3', correct: 3 }, { id: 'q4', correct: 3 }, { id: 'q5', correct: 2 }];
const FIVE = [0, 1, 2, 3, 4].map((i) => ({ subject: 'English', chapter: `Chapter ${i}`, q: `Stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: ITEMS[i].correct, why: `Reason ${i}.` }));
const rowsOf = (userId, picks, { ms = 102_000, at = '2026-11-15T10:00:00.000Z' } = {}) => ITEMS.map((x, i) => checkRow({ userId, date: DATE, day: DAY, n: i + 1, id: x.id, pick: picks[i], correct: x.correct, ms, at }));

test('the check request: a sealed token and one answer from A to D; the time is clamped and only the fifth keeps it', () => {
  assert.deepEqual(checkRequest({ token: TOKEN, pick: 'C' }), { ok: true, token: TOKEN, pick: 2, ms: null, team: null });
  // The college the page plays for (17 Nov 2026): one of the 67, or not asked; an unknown one is not refused, only ignored.
  assert.equal(checkRequest({ token: TOKEN, pick: 'C', for: 'hansraj-college' }).team, 'hansraj-college');
  assert.equal(checkRequest({ token: TOKEN, pick: 'C', for: 'not-a-college' }).team, null);
  assert.equal(checkRequest({ token: TOKEN, pick: 'C', for: { college: 'hansraj-college' } }).ok, true);
  assert.equal(checkRequest({ token: TOKEN, pick: 'A', ms: 99 * 60 * 60 * 1000 }).ms, DAILY_FIVE_MAX_MS, 'a phone left open overnight is not a 99-hour five');
  for (const [body, error] of [
    [{ token: TOKEN, pick: 'E' }, 'bad_answer'], [{ token: TOKEN, pick: 'a' }, 'bad_answer'], [{ token: TOKEN, pick: 0 }, 'bad_answer'], [{ token: TOKEN }, 'bad_answer'],
    [{ token: 'short', pick: 'A' }, 'bad_question'], [{ token: `${TOKEN}<script>`, pick: 'A' }, 'bad_question'], [{ pick: 'A' }, 'bad_question'],
    [null, 'bad_body'], [[], 'bad_body'],
  ]) assert.equal(checkRequest(body).error, error, JSON.stringify(body));
  const opened = { date: DATE, n: 3, id: 'q3', correct: 3, why: 'Because.' };
  assert.deepEqual(checkOpened(opened, DATE), { ok: true, item: { n: 3, id: 'q3', correct: 3, why: 'Because.' } });
  assert.equal(checkOpened(null, DATE).error, 'bad_question', 'a token that did not open');
  assert.equal(checkOpened({ ...opened, date: '2026-11-14' }, DATE).error, 'not_today', 'yesterday\'s five');
  for (const change of [{ n: 0 }, { n: 6 }, { id: '' }, { correct: 4 }, { correct: '1' }]) assert.equal(checkOpened({ ...opened, ...change }, DATE).ok, false, JSON.stringify(change));
});

test('a check\'s row: keyed by day, student and place; scored against the sealed key; the record only from all five, counted', () => {
  const rows = rowsOf('u1', [0, 1, 2, 3, 0]);
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5].map((n) => dailyRowId(DATE, 'u1', n)));
  assert.ok(rows.every((r) => r.interaction_type === DAILY_FIVE_INTERACTION && r.flow_context === null && r.session_id === dailySessionId(DATE) && r.user_id === 'u1'));
  assert.deepEqual(rows.map((r) => r.metadata.right), [true, true, false, true, false], 'the server\'s key decides');
  assert.deepEqual(rows.map((r) => 'ms' in r.metadata), [false, false, false, false, true], 'the time rides on the fifth answer only');
  assert.deepEqual(checkAnswer(rows[2]), { n: 3, pick: 2, right: false, correct: 3, team: null });
  // The college the server decided rides in the row's metadata as `for`, only when it is one of the 67.
  const played = checkRow({ userId: 'u1', date: DATE, day: DAY, n: 1, id: 'q1', pick: 0, correct: 0, at: '2026-11-15T10:00:00.000Z', team: 'miranda-house' });
  assert.equal(played.metadata.for, 'miranda-house');
  assert.equal(checkAnswer(played).team, 'miranda-house');
  assert.ok(!('for' in checkRow({ userId: 'u1', date: DATE, day: DAY, n: 1, id: 'q1', pick: 0, correct: 0, at: 'x', team: 'nowhere' }).metadata));
  assert.equal(checkAnswer({ metadata: { n: 1, pick: 'Z' } }), null);
  const rec = recordFromRows(rows, DATE);
  assert.deepEqual(rec, { date: DATE, day: DAY, score: 3, ms: 102_000, marks: [true, true, false, true, false], picks: [0, 1, 2, 3, 0] });
  assert.equal(recordFromRows(rows.slice(0, 4), DATE), null, 'four answers are not a five');
  assert.equal(recordFromRows([...rows, rows[0]], DATE), null, 'a place twice is not a day');
  assert.equal(recordFromRows(rows.map((r) => ({ ...r, metadata: { ...r.metadata, score: 5 } })), DATE).score, 3, 'the score is counted, never read');
  // Without the page's time, the span between the first and the last check.
  const untimed = rowsOf('u1', [0, 1, 2, 3, 0], { ms: null }).map((r, i) => ({ ...r, created_at: new Date(Date.parse('2026-11-15T10:00:00Z') + i * 20_000).toISOString() }));
  assert.equal(recordFromRows(untimed, DATE).ms, 80_000);
  assert.deepEqual(reviewFrom(rows, ITEMS.map((x, i) => ({ id: x.id, why: `Reason ${i}.` }))), ITEMS.map((x, i) => ({ correct: x.correct, why: `Reason ${i}.` })));
  assert.equal(dateOfSession('daily:2026-11-15'), DATE);
  assert.equal(dateOfSession('daily:2026-02-30'), null);
  const day = (date, ns) => ns.map((n) => ({ session_id: `daily:${date}`, metadata: { n } }));
  assert.deepEqual(playedDates([...day('2026-11-16', [1, 2, 3, 4, 5]), ...day('2026-11-15', [1, 2, 3, 4, 5]), ...day('2026-11-14', [1, 2, 3])]), ['2026-11-15', '2026-11-16'], 'a day counts with a whole five, not a first answer');
  assert.ok(ANSWER_LETTERS.length === 4);
});

test('the page reads a check\'s answer only when it adds up: its own place, a pick, the key, right exactly when they match', () => {
  assert.deepEqual(acceptCheck({ n: 2, pick: 1, right: true, correct: 1, why: ' Because. ', recorded: true }, 2), { pick: 1, right: true, correct: 1, why: 'Because.', recorded: true, team: null });
  assert.equal(acceptCheck({ n: 2, pick: 1, right: true, correct: 1, for: 'hindu-college' }, 2).team, 'hindu-college');
  assert.equal(acceptCheck({ n: 2, pick: 1, right: true, correct: 1 }, 3), null, 'another question\'s answer');
  assert.equal(acceptCheck({ n: 2, pick: 1, right: true, correct: 2 }, 2), null, 'right with another key');
  assert.equal(acceptCheck({ n: 2, pick: 4, right: false, correct: 1 }, 2), null);
  assert.equal(acceptCheck(null, 2), null);
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
  assert.deepEqual(acceptAccount({ day: DAY, date: DATE, record, played: ['2026-11-15', 'junk', '2026-11-14', '2026-11-15'] }), { day: DAY, date: DATE, record, review: null, played: ['2026-11-14', '2026-11-15'], team: null, seat: null });
  // The account's college and seat (17 Nov 2026): read only when they are real.
  const team = { college: 'hansraj-college', since: '2026-11-14', changedOn: null, last: DATE };
  assert.deepEqual(acceptAccount({ day: DAY, date: DATE, record: null, played: [], team, seat: 4127 }).team, team);
  assert.equal(acceptAccount({ day: DAY, date: DATE, record: null, played: [], team, seat: 4127 }).seat, 4127);
  assert.equal(acceptAccount({ day: DAY, date: DATE, record: null, team: { ...team, college: 'nowhere' }, seat: 12 }).team, null);
  assert.equal(acceptAccount({ day: DAY, date: DATE, record: null, team, seat: 12 }).seat, null, 'a seat is four digits');
  const review = ITEMS.map((x) => ({ correct: x.correct, why: 'Why.' }));
  assert.deepEqual(acceptAccount({ day: DAY, date: DATE, record, review, played: [] }).review, review);
  assert.equal(acceptAccount({ day: DAY, date: DATE, record: null, review, played: [] }).review, null, 'no keys without a whole five');
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
  const rows = [...rowsOf('u-zoya', [0, 1, 3, 3, 2]), ...rowsOf('u-riya', [1, 1, 2, 3, 0]), ...rowsOf('u-me', [0, 1, 3, 3, 2]), ...rowsOf('u-stranger', [0, 1, 3, 3, 2])];
  const strip = memberStrip(members, rows, { userId: 'u-me', date: DATE });
  assert.deepEqual(strip.map((m) => m.name), ['Riya', 'Aarav', 'Zoya'], 'the den\'s order, not the best score first; Kabir has not played and is not named (F2)');
  assert.deepEqual(strip[0], { name: 'Riya', colour: 3, you: false, state: 'marks', marks: [false, true, false, true, false] });
  assert.equal(strip[1].state, 'marks', 'your own squares, even with your score private to others');
  assert.equal(strip[1].you, true);
  assert.deepEqual(strip[2], { name: 'Zoya', colour: 2, you: false, state: 'played' }, 'kept to herself: played, no squares');
  assert.doesNotMatch(JSON.stringify(strip), /u-/, 'no user id');
  assert.equal(strip.length, 3, 'a row of someone outside the Mob is never listed');
  const nobody = memberStrip(members, [], { userId: 'u-me', date: DATE });
  assert.deepEqual(nobody.map((m) => [m.name, m.state]), [['Aarav', 'not_yet']], 'nobody else played: only your own row');
  assert.equal(acceptStrip({ date: DATE, members: [{ name: 'Kabir', you: false, state: 'not_yet' }] }), null, 'another member as not yet is refused (F2)');
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

test('the device keeps each pick before its check and each check beside it; the server\'s first pick stands; nothing scores without the checks', () => {
  const keyless = FIVE.map(({ correct: _c, why: _w, ...q }) => q);
  let rec = beginRun(readRecord(null), { date: DATE, startedAt: 1000 });
  rec = keepAnswer(rec, { date: DATE, index: 0, pick: 2 });
  assert.equal(nextOpen(rec.run), 0, 'picked, not yet checked: a reload checks it again');
  assert.deepEqual(readRecord(JSON.stringify(rec)).run.picks.slice(0, 1), [2], 'an offline pick survives a reload');
  // The server answers with the pick that stands (another tab picked B first).
  rec = keepCheck(rec, { date: DATE, index: 0, check: { pick: 1, right: false, correct: 0, why: 'Reason 0.', recorded: true } });
  assert.equal(rec.run.picks[0], 1, 'the first pick on the account replaces this device\'s');
  assert.equal(nextOpen(rec.run), 1);
  assert.equal(keepCheck(rec, { date: DATE, index: 1, check: { pick: 1, right: false, correct: 1, why: '' } }), rec, 'an answer that does not add up is not kept');
  assert.equal(scoreRun([1, 1, 3, 3, 2], keyless), null, 'the page cannot score without the server\'s answers');
  for (let i = 1; i < 5; i += 1) {
    rec = keepAnswer(rec, { date: DATE, index: i, pick: ITEMS[i].correct });
    rec = keepCheck(rec, { date: DATE, index: i, check: { pick: ITEMS[i].correct, right: true, correct: ITEMS[i].correct, why: `Reason ${i}.` } });
  }
  assert.equal(nextOpen(rec.run), 5);
  assert.deepEqual(readRecord(JSON.stringify(rec)), rec, 'the checks read back unchanged');
  const scored = scoreRun(rec.run.picks, withChecks(keyless, rec.run.checks));
  assert.deepEqual(scored.marks, [false, true, true, true, true]);
  assert.deepEqual(scored.review, ITEMS.map((x, i) => ({ correct: x.correct, why: `Reason ${i}.` })));
  const done = finishDay(rec, { date: DATE, ...scored, ms: 5000 });
  assert.deepEqual(resultOn(done, DATE).review, scored.review, 'the result keeps the keys for its list');
  assert.deepEqual(readRecord(JSON.stringify(done)), done);
});
