// The Daily Five's pure model (src/lib/dailyFive.mjs): the IST day, the deterministic five and their cycle, the share line,
// the run of days and the device record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_POOL_SIZE } from './demoSample.mjs';
import {
  DAILY_FIVE_CYCLE_DAYS, DAILY_FIVE_EPOCH, DAILY_FIVE_MAX, DAILY_FIVE_SIZE, DAILY_FIVE_SUBJECTS, DAILY_FIVE_URL,
  acceptDailyFive, addDays, beginRun, clockWords, cycleDays, cycleOrder, dailyFiveFor, dailyFiveUrl, dateOfDay, dayLabel,
  dayNumber, finishDay, formatClock, istDateKey, keepAnswer, msUntilNextDay, nextIndex, readRecord, resultOn, scoreRun,
  shareSquares, shareText, shortDate, streakLine, streakOf, todayDaily, untilWords,
  calendarWeekOf, countdownDays, countdownParts, leafOf, runStats, untilShort, weekOf,
} from './dailyFive.mjs';

// Two full public windows as the sample route serves them (30 each), stems unique so a question can be traced.
const windowOf = (slug, n = DEMO_POOL_SIZE) => ({
  slug,
  questions: Array.from({ length: n }, (_, i) => ({ q: `${slug} stem ${i}`, options: ['a', 'b', 'c', 'd'], correct: i % 4, why: `Because ${i}.`, chapter: `${slug} chapter ${i % 7}` })),
});
const WINDOWS = [windowOf('english'), windowOf('general-test')];
const stems = (five) => five.map((q) => q.q);

test('the pool is the public windows of English and the General Test: 60 questions, 12 days a cycle', () => {
  assert.deepEqual([...DAILY_FIVE_SUBJECTS], ['english', 'general-test']);
  assert.equal(DAILY_FIVE_SIZE, 5);
  assert.equal(DAILY_FIVE_MAX, 60);
  assert.equal(DAILY_FIVE_CYCLE_DAYS, 12);
  assert.equal(cycleDays(WINDOWS), 12);
  assert.ok(Object.isFrozen(DAILY_FIVE_SUBJECTS));
});

test('IST decides the day: a new five at 12:00 am IST (18:30 UTC), day 1 is the epoch', () => {
  const midnightIst = Date.UTC(2026, 10, 15, 18, 30); // 16 Nov 00:00 IST
  assert.equal(istDateKey(midnightIst - 1), '2026-11-15');
  assert.equal(istDateKey(midnightIst), '2026-11-16');
  assert.equal(istDateKey(Date.UTC(2026, 10, 14, 18, 29, 59)), '2026-11-14');
  assert.equal(istDateKey(Date.UTC(2026, 10, 14, 18, 30)), '2026-11-15');
  assert.equal(dayNumber(DAILY_FIVE_EPOCH), 1);
  assert.deepEqual(todayDaily(midnightIst - 1), { date: '2026-11-15', day: 1 });
  assert.deepEqual(todayDaily(midnightIst), { date: '2026-11-16', day: 2 });
  assert.equal(dayNumber('2027-01-01'), 48);
  assert.equal(dateOfDay(48), '2027-01-01');
  for (let d = 1; d < 800; d += 37) assert.equal(dayNumber(dateOfDay(d)), d);
  assert.equal(dayNumber('2026-02-30'), null, 'not a real date');
  assert.equal(dayNumber('15-11-2026'), null);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(todayDaily(Date.UTC(2020, 0, 1)), { date: DAILY_FIVE_EPOCH, day: 1 }, 'never before day 1');
});

test('the wait for the next five, in words, to IST midnight', () => {
  const midnightIst = Date.UTC(2026, 10, 15, 18, 30);
  assert.equal(msUntilNextDay(midnightIst - 1), 1);
  assert.equal(msUntilNextDay(midnightIst), 24 * 60 * 60 * 1000);
  assert.equal(msUntilNextDay(midnightIst - (7 * 60 + 12) * 60 * 1000), (7 * 60 + 12) * 60 * 1000);
  assert.equal(untilWords((7 * 60 + 12) * 60 * 1000), '7 hours and 12 minutes');
  assert.equal(untilWords((7 * 60 + 12) * 60 * 1000 + 59 * 1000), '7 hours and 12 minutes', 'never rounded up');
  assert.equal(untilWords(60 * 60 * 1000), '1 hour');
  assert.equal(untilWords(61 * 60 * 1000), '1 hour and 1 minute');
  assert.equal(untilWords(42 * 60 * 1000), '42 minutes');
  assert.equal(untilWords(59 * 1000), 'less than a minute');
  assert.equal(untilWords(-5), 'less than a minute');
});

test('dates and the clock read plainly', () => {
  assert.equal(dayLabel('2026-11-15'), 'Sunday, 15 November');
  assert.equal(shortDate('2026-11-15'), '15 Nov');
  assert.equal(shortDate('2027-09-03'), '3 Sep');
  assert.equal(formatClock(102 * 1000), '1:42');
  assert.equal(formatClock(9 * 1000 + 999), '0:09');
  assert.equal(formatClock(3725 * 1000), '1:02:05');
  assert.equal(formatClock(-1), '0:00');
  assert.equal(clockWords(102 * 1000), '1 minute 42 seconds');
  assert.equal(clockWords(0), '0 seconds');
});

test('determinism: the same day gives the same five from the same windows, on any server, in any order of windows', () => {
  for (const day of [1, 2, 12, 13, 40, 365]) {
    const a = dailyFiveFor(day, WINDOWS);
    const b = dailyFiveFor(day, structuredClone([...WINDOWS].reverse()));
    assert.equal(a.length, 5);
    assert.deepEqual(a, b, `day ${day}`);
  }
  assert.notDeepEqual(stems(dailyFiveFor(1, WINDOWS)), stems(dailyFiveFor(2, WINDOWS)));
  assert.equal(dailyFiveFor(0, WINDOWS), null);
  assert.equal(dailyFiveFor(1.5, WINDOWS), null);
  assert.equal(dailyFiveFor(1, [windowOf('english', 4)]), null, 'too few to fill a five');
});

test('the cycle: all 60 once before any repeat, each day mixing the two subjects; the next cycle is a new order', () => {
  for (let cycle = 0; cycle < 4; cycle += 1) {
    const seen = new Set();
    for (let d = 1; d <= 12; d += 1) {
      const five = dailyFiveFor(cycle * 12 + d, WINDOWS);
      const counts = { english: 0, 'general-test': 0 };
      for (const q of five) {
        assert.ok(!seen.has(q.q), `cycle ${cycle} day ${d}: ${q.q} repeated inside a cycle`);
        seen.add(q.q);
        counts[q.subject] += 1;
      }
      assert.ok(counts.english >= 2 && counts['general-test'] >= 2, `day ${d} mixes the subjects: ${JSON.stringify(counts)}`);
    }
    assert.equal(seen.size, 60, `cycle ${cycle} shows every question`);
  }
  assert.notDeepEqual(stems(dailyFiveFor(13, WINDOWS)), stems(dailyFiveFor(1, WINDOWS)), 'day 13 is not day 1 again');
  assert.deepEqual(new Set(stems(cycleOrder(WINDOWS, 0))), new Set(stems(cycleOrder(WINDOWS, 1))));
});

test('only the windows given, only the Daily Five subjects: never a question from anywhere else', () => {
  const extra = windowOf('accountancy');
  const allowed = new Set([...WINDOWS.flatMap((w) => w.questions.map((q) => q.q))]);
  for (let d = 1; d <= 60; d += 1) {
    for (const q of dailyFiveFor(d, [...WINDOWS, extra])) assert.ok(allowed.has(q.q), q.q);
  }
  // A thin window (a subject with fewer than 30 today) still cycles through what it has.
  const thin = [windowOf('english', 30), windowOf('general-test', 12)];
  assert.equal(cycleDays(thin), 8);
  const seen = new Set();
  for (let d = 1; d <= 8; d += 1) for (const q of dailyFiveFor(d, thin)) { assert.ok(!seen.has(q.q)); seen.add(q.q); }
  assert.equal(seen.size, 40);
});

test('the share line: date, score, time, squares and the link; no subject, chapter or question', () => {
  const text = shareText({ date: '2026-11-15', score: 4, ms: 102 * 1000, marks: [true, true, false, true, true] });
  assert.equal(text, `MockMob Daily Five · 15 Nov · 4/5 · 1:42\n■■□■■\n${DAILY_FIVE_URL}`);
  assert.equal(DAILY_FIVE_URL, 'https://www.mockmob.in/daily');
  assert.equal(shareSquares([false, false, false, false, false]), '□□□□□');
  assert.doesNotMatch(text, /english|general|chapter|stem|[\u{1F300}-\u{1FAFF}]/iu, 'no spoilers and no emoji');
});

test('the run of days: today counts once played, a run that ended yesterday is alive, a gap ends it', () => {
  const today = '2026-11-20';
  assert.deepEqual(streakOf([], today), { count: 0, playedToday: false, alive: false });
  assert.deepEqual(streakOf(['2026-11-18', '2026-11-19', '2026-11-20'], today), { count: 3, playedToday: true, alive: true });
  assert.deepEqual(streakOf(['2026-11-18', '2026-11-19'], today), { count: 2, playedToday: false, alive: true });
  assert.deepEqual(streakOf(['2026-11-17', '2026-11-18'], today), { count: 0, playedToday: false, alive: false }, 'a missed day ends it');
  assert.deepEqual(streakOf(['2026-11-15', '2026-11-17', '2026-11-19', '2026-11-20', '2026-11-20'], today), { count: 2, playedToday: true, alive: true });
  assert.equal(streakOf(['2026-11-21'], today).count, 0, 'a date ahead of today does not count');
  assert.equal(streakOf(['2026-12-31', '2027-01-01'], '2027-01-01').count, 2, 'across a year');
  assert.deepEqual(streakLine({ count: 3, playedToday: true }), { head: 'Day 3 in a row', more: null });
  assert.deepEqual(streakLine({ count: 1, playedToday: true }), { head: 'Day 1', more: 'Play tomorrow to make it 2 in a row.' });
  assert.equal(streakLine({ count: 0, playedToday: false }), null);
  assert.deepEqual(streakLine({ count: 4, playedToday: false }), { head: '4 days in a row', more: 'Play today to make it 5.' });
});

test('the page accepts the route\'s answer whole: a real day, five questions from the Daily Five subjects, each with its token', () => {
  const five = dailyFiveFor(3, WINDOWS);
  const token = (i) => `d1.${'a'.repeat(16)}.${'b'.repeat(40)}${i}.${'c'.repeat(22)}`;
  const body = { day: 3, date: dateOfDay(3), questions: five.map((q, i) => ({ ...q, id: 'leak', token: token(i) })) };
  const ok = acceptDailyFive(body);
  assert.equal(ok.day, 3);
  assert.equal(ok.questions.length, 5);
  assert.deepEqual(Object.keys(ok.questions[0]), ['slug', 'subject', 'q', 'options', 'chapter', 'token'], 'extra fields are dropped, a key or a reason sent anyway too');
  assert.ok(['English', 'General Test'].includes(ok.questions[0].subject));
  const bad = (change) => acceptDailyFive({ ...body, ...change });
  function bad0(edit) { return bad({ questions: body.questions.map((q, i) => (i ? q : edit(q))) }); }
  assert.equal(bad0((q) => ({ ...q, token: undefined })), null, 'no token: nothing to check an answer with');
  assert.equal(bad({ date: '2026-11-16' }), null, 'the date must be the day\'s');
  assert.equal(bad({ day: 0, date: dateOfDay(0) }), null);
  assert.equal(bad({ questions: body.questions.slice(0, 4) }), null);
  assert.equal(bad({ questions: body.questions.map((q, i) => (i ? q : { ...q, subject: 'accountancy' })) }), null, 'only a Daily Five subject');
  assert.equal(bad({ questions: body.questions.map((q, i) => (i ? q : { ...q, options: ['a', 'b', 'c'] })) }), null);
  assert.equal(acceptDailyFive(null), null);
  assert.equal(dailyFiveUrl(3), '/api/daily?day=3');
});

test('the device record: a run resumes and never restarts, an answer is never changed, a day finishes once', () => {
  const date = '2026-11-15';
  let rec = readRecord('not json');
  assert.deepEqual(rec, { played: [], last: null, run: null });
  rec = beginRun(rec, { date, startedAt: 1000 });
  assert.equal(rec.run.startedAt, 1000);
  assert.equal(beginRun(rec, { date, startedAt: 9999 }).run.startedAt, 1000, 'a reload keeps the clock');
  rec = keepAnswer(rec, { date, index: 0, pick: 2 });
  assert.deepEqual(keepAnswer(rec, { date, index: 0, pick: 1 }).run.picks[0], 2, 'the first answer stands');
  assert.equal(nextIndex(rec.run.picks), 1);
  for (let i = 1; i < 5; i += 1) rec = keepAnswer(rec, { date, index: i, pick: 0 });
  assert.equal(nextIndex(rec.run.picks), 5);
  const questions = dailyFiveFor(1, WINDOWS);
  const scored = scoreRun(rec.run.picks, questions);
  assert.equal(scored.score, scored.marks.filter(Boolean).length);
  assert.equal(scored.missed.length, 5 - scored.score);
  for (const m of scored.missed) assert.equal(m.answer, questions[m.n - 1].options[questions[m.n - 1].correct]);
  assert.equal(scoreRun([0, 0, 0, null, 0], questions), null);
  rec = finishDay(rec, { date, ...scored, ms: 90000 });
  assert.equal(rec.run, null);
  assert.deepEqual(rec.played, [date]);
  assert.equal(resultOn(rec, date).score, scored.score);
  const again = finishDay(rec, { date, score: 5, marks: [true, true, true, true, true], missed: [], ms: 1 });
  assert.equal(resultOn(again, date).score, scored.score, 'no second go for a better score');
  assert.equal(beginRun(rec, { date, startedAt: 5 }).run, null, 'a finished day cannot be begun again');
  const round = readRecord(JSON.stringify(rec));
  assert.deepEqual(round, rec, 'stored and read back unchanged');
  assert.equal(readRecord(JSON.stringify({ ...rec, last: { ...rec.last, score: 5 } })).last, null, 'a tampered score does not read');
  assert.equal(resultOn(rec, '2026-11-16'), null, 'tomorrow is a new day');
});

// ---------------------------------------------------------------------------------------------------------------------
// The look of the day (16 Nov 2026): the clock to 12:00 am IST, the calendar leaf, the run in numbers and the week strip.

test('the countdown is a clock of whole seconds to 12:00 am IST, never rounded up', () => {
  assert.deepEqual(countdownParts((7 * 3600 + 42 * 60 + 15) * 1000), { h: '07', m: '42', s: '15' });
  assert.deepEqual(countdownParts((7 * 3600 + 42 * 60 + 15) * 1000 + 999), { h: '07', m: '42', s: '15' }, 'never rounded up');
  assert.deepEqual(countdownParts(999), { h: '00', m: '00', s: '00' });
  assert.deepEqual(countdownParts(-5), { h: '00', m: '00', s: '00' });
  assert.deepEqual(countdownParts(undefined), { h: '00', m: '00', s: '00' });
  // One second after midnight IST (18:30:01 UTC) the clock reads 23:59:59; one second before, 00:00:01.
  const midnight = Date.UTC(2026, 10, 15, 18, 30, 0);
  assert.deepEqual(countdownParts(msUntilNextDay(midnight + 1000)), { h: '23', m: '59', s: '59' });
  assert.deepEqual(countdownParts(msUntilNextDay(midnight - 1000)), { h: '00', m: '00', s: '01' });
  assert.deepEqual(countdownParts(msUntilNextDay(midnight)), { h: '24', m: '00', s: '00' }, 'the instant the day turns, a whole day is left');
});

test('a short wait for a row: hours and minutes, never rounded up', () => {
  assert.equal(untilShort((7 * 60 + 42) * 60 * 1000 + 59 * 1000), '7 h 42 min');
  assert.equal(untilShort(60 * 60 * 1000), '1 h');
  assert.equal(untilShort(42 * 60 * 1000), '42 min');
  assert.equal(untilShort(59 * 1000), 'under a minute');
  assert.equal(untilShort(-1), 'under a minute');
});

test('the calendar leaf names the IST date: weekday, day and month, short', () => {
  assert.deepEqual(leafOf('2026-11-16'), { weekday: 'Mon', day: '16', month: 'Nov' });
  assert.deepEqual(leafOf('2027-01-03'), { weekday: 'Sun', day: '3', month: 'Jan' });
  assert.equal(leafOf('2026-02-30'), null);
  assert.equal(leafOf(null), null);
});

test('the run in numbers: days played, the run now, the best run', () => {
  assert.deepEqual(runStats([], '2026-11-20'), { played: 0, current: 0, best: 0 });
  assert.deepEqual(runStats(['2026-11-20'], '2026-11-20'), { played: 1, current: 1, best: 1 });
  // 15, 16, 17 in a row, a gap, then 19 and 20.
  const days = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20'];
  assert.deepEqual(runStats(days, '2026-11-20'), { played: 5, current: 2, best: 3 });
  assert.deepEqual(runStats(days, '2026-11-21'), { played: 5, current: 2, best: 3 }, 'yesterday keeps the run alive today');
  assert.deepEqual(runStats(days, '2026-11-22'), { played: 5, current: 0, best: 3 }, 'a missed day ends the run, the best stands');
  assert.deepEqual(runStats([...days, '2026-11-20', 'junk', '2026-12-25'], '2026-11-20'), { played: 5, current: 2, best: 3 }, 'repeats, junk and days after today do not count');
  assert.deepEqual(runStats(days, 'not a date'), { played: 0, current: 0, best: 0 });
});

test('the week strip is the seven days that end today, oldest first, and never shows a miss before the Daily Five began', () => {
  const week = weekOf(['2026-11-15', '2026-11-16'], '2026-11-16');
  assert.equal(week.length, 7);
  assert.deepEqual(week.map((d) => d.date), ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
  assert.deepEqual(week.map((d) => d.letter).join(''), 'TWTFSSM');
  assert.equal(week[6].name, 'Monday');
  assert.deepEqual(week.map((d) => d.played), [false, false, false, false, false, true, true]);
  assert.deepEqual(week.map((d) => Boolean(d.today)), [false, false, false, false, false, false, true]);
  assert.deepEqual(week.map((d) => Boolean(d.before)), [true, true, true, true, true, false, false], `days before ${DAILY_FIVE_EPOCH} had no five`);
  assert.ok(weekOf([], '2026-12-01').every((d) => !d.before && !d.played));
  assert.deepEqual(weekOf([], 'junk'), []);
});

test('the home page\'s week is Monday to Sunday of today\'s week, from the same record; a day ahead is never played', () => {
  // Wednesday 18 Nov 2026: Monday 16 to Sunday 22.
  const week = calendarWeekOf(['2026-11-16', '2026-11-18', '2026-11-21'], '2026-11-18');
  assert.deepEqual(week.map((d) => d.date), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  assert.deepEqual(week.map((d) => d.short), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(week.map((d) => d.day), ['16', '17', '18', '19', '20', '21', '22']);
  assert.deepEqual(week.map((d) => d.played), [true, false, true, false, false, false, false], 'a date after today in the record is not a tick');
  assert.deepEqual(week.map((d) => Boolean(d.today)), [false, false, true, false, false, false, false]);
  assert.deepEqual(week.map((d) => d.ahead), [false, false, false, true, true, true, true]);
  // A Sunday is the last day of its own week, and a Monday the first.
  assert.equal(calendarWeekOf([], '2026-11-22')[6].today, true);
  assert.equal(calendarWeekOf([], '2026-11-22')[0].date, '2026-11-16');
  assert.equal(calendarWeekOf([], '2026-11-23')[0].date, '2026-11-23');
  // Across a month's end: "1" for 1 December, no leading zero.
  assert.deepEqual(calendarWeekOf([], '2026-12-02').map((d) => d.day), ['30', '1', '2', '3', '4', '5', '6']);
  // The days before the Daily Five began are marked, as on the week strip.
  assert.deepEqual(calendarWeekOf([], '2026-11-12').map((d) => Boolean(d.before)), [true, true, true, true, true, true, false]);
  assert.deepEqual(calendarWeekOf([], 'junk'), []);
});

test('a wait of days reads as days, hours, minutes and seconds', () => {
  assert.deepEqual(countdownDays(((5 * 24 + 8) * 3600 + 41 * 60 + 12) * 1000 + 900), { d: '5', h: '08', m: '41', s: '12' });
  assert.deepEqual(countdownDays((23 * 3600 + 59 * 60 + 59) * 1000), { d: '0', h: '23', m: '59', s: '59' });
  assert.deepEqual(countdownDays(-1), { d: '0', h: '00', m: '00', s: '00' });
});
