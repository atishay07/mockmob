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
  assert.equal(streakLine({ count: 3, playedToday: true }), 'Day 3 in a row');
  assert.equal(streakLine({ count: 1, playedToday: true }), 'Day 1. Play tomorrow to make it 2 in a row.');
  assert.equal(streakLine({ count: 0, playedToday: false }), null);
  assert.equal(streakLine({ count: 4, playedToday: false }), '4 days in a row. Play today to make it 5.');
});

test('the page accepts the route\'s answer whole: a real day, five questions from the Daily Five subjects', () => {
  const five = dailyFiveFor(3, WINDOWS);
  const body = { day: 3, date: dateOfDay(3), questions: five.map((q) => ({ ...q, id: 'leak' })) };
  const ok = acceptDailyFive(body);
  assert.equal(ok.day, 3);
  assert.equal(ok.questions.length, 5);
  assert.deepEqual(Object.keys(ok.questions[0]), ['slug', 'subject', 'q', 'options', 'correct', 'why', 'chapter'], 'extra fields are dropped');
  assert.ok(['English', 'General Test'].includes(ok.questions[0].subject));
  const bad = (change) => acceptDailyFive({ ...body, ...change });
  assert.equal(bad({ date: '2026-11-16' }), null, 'the date must be the day\'s');
  assert.equal(bad({ day: 0, date: dateOfDay(0) }), null);
  assert.equal(bad({ questions: body.questions.slice(0, 4) }), null);
  assert.equal(bad({ questions: body.questions.map((q, i) => (i ? q : { ...q, subject: 'accountancy' })) }), null, 'only a Daily Five subject');
  assert.equal(bad({ questions: body.questions.map((q, i) => (i ? q : { ...q, correct: 4 })) }), null);
  assert.equal(bad({ questions: body.questions.map((q, i) => (i ? q : { ...q, why: '' })) }), null);
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
