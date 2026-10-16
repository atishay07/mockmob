import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_STEPS, badgePaths, badgeRecords, bestsRows, buildStudyRecord, derivedProgress, deriveBadges, earnedLine,
  fastestRightAnswer, formatLines, fractionOf, mergeDerived, milestoneProgress, attemptCounts, recordLine, soFarLine,
  dayMonth, subjectName, longestRun, badgePathsFromApi, countEntries,
} from '../../src/lib/studyBadges.js';

// The same cases as the app's test/unit/rhythm/derived_badges_test.dart, so one input gives the
// same badges on the phone and on the website.
const day = (d) => Date.UTC(2026, 9, d, 6, 0, 0);
function att(id, { d = 1, subject = 'accountancy', mode = 'quick', correct = 7, wrong = 2, total = 10, formatId, scoring = 'server_practice_v1', details = [], recovery } = {}) {
  return {
    id, subject, score: 0, correct, wrong, unattempted: total - correct - wrong, total, details, questionsSnapshot: [],
    selectionMeta: { mode, scoringVersion: scoring, ...(recovery ? { recovery } : {}) },
    ...(formatId ? { formatId } : {}), completedAt: day(d),
  };
}

test('first NTA paper', () => {
  const got = deriveBadges([att('q', { d: 1 }), att('n', { d: 3, mode: 'nta' }), att('n2', { d: 5, mode: 'nta' })]);
  assert.equal(got.first_nta.attemptId, 'n');
  assert.equal(got.first_nta.at, day(3));
});

test('5 full mocks lands on the fifth, counting NTA; progress counts until then', () => {
  const four = [1, 2, 3, 4].map((i) => att(`m${i}`, { d: i, mode: i === 2 ? 'nta' : 'full', total: 50, correct: 30, wrong: 5 }));
  assert.equal('full_mocks_5' in deriveBadges(four), false);
  assert.equal(derivedProgress(four).full_mocks_5, 4);
  const five = [...four, att('m5', { d: 9, mode: 'full', total: 50, correct: 30, wrong: 5 })];
  assert.equal(deriveBadges(five).full_mocks_5.attemptId, 'm5');
  assert.equal('full_mocks_5' in derivedProgress(five), false);
});

test('clean set needs every answer right in 10 or more', () => {
  assert.equal('clean_set' in deriveBadges([att('s', { total: 8, correct: 8, wrong: 0 })]), false);
  assert.equal(deriveBadges([att('c', { total: 10, correct: 10, wrong: 0 })]).clean_set.attemptId, 'c');
});

test('four subjects lands on the attempt that makes four', () => {
  const list = [
    att('1', { d: 1, subject: 'english' }), att('2', { d: 2, subject: 'accountancy' }), att('3', { d: 3, subject: 'english' }),
    att('4', { d: 4, subject: 'economics' }), att('5', { d: 5, subject: 'business_studies' }),
  ];
  assert.equal(deriveBadges(list).four_subjects.attemptId, '5');
  assert.equal(derivedProgress(list.slice(0, 3)).four_subjects, 2);
});

test('a set with fewer than 5 answers does not count toward four subjects', () => {
  const list = ['english', 'accountancy', 'economics', 'physics'].map((s, i) => att(`s${i}`, { d: i + 1, subject: s, correct: 2, wrong: 1, total: 10 }));
  assert.equal('four_subjects' in deriveBadges(list), false);
});

test('new best needs a strictly higher mark on the same format, and names the mark it beat', () => {
  const list = [
    att('a', { d: 1, formatId: 'f1', correct: 6, wrong: 2 }),
    att('b', { d: 2, formatId: 'f1', correct: 6, wrong: 2 }),
    att('c', { d: 3, formatId: 'f2', correct: 9, wrong: 0 }),
    att('d', { d: 4, formatId: 'f1', correct: 7, wrong: 2 }),
  ];
  const got = deriveBadges(list);
  assert.equal(got.new_best.attemptId, 'd');
  assert.equal(got.new_best.before, 28);
});

test('device-scored attempts never count', () => {
  assert.deepEqual(deriveBadges([att('x', { mode: 'nta', scoring: 'device_v0' })]), {});
});

test('attempts are dated by their own time, whatever order the list is in', () => {
  const got = deriveBadges([att('late', { d: 9, mode: 'nta' }), att('early', { d: 2, mode: 'nta' })]);
  assert.equal(got.first_nta.attemptId, 'early');
});

test('the sixteen badges: the two server-event ids show locked until the server dates them', () => {
  const merged = mergeDerived([{ id: 'first_scored_session', achievedAt: null }], {});
  const paths = badgePaths(merged, { bestRun: 0, weeksMetStreak: 0 });
  assert.equal(paths.reduce((n, p) => n + p.total, 0), 16);
  assert.equal(BADGE_STEPS.length, 16);
  const hold = paths.flatMap((p) => p.steps).find((s) => s.id === 'first_hold');
  assert.notEqual(hold.status, 'earned');
  assert.match(hold.condition, /fresh question/);
  const dated = badgePaths([...merged, { id: 'first_hold', achievedAt: day(5) }], null).flatMap((p) => p.steps).find((s) => s.id === 'first_hold');
  assert.equal(dated.status, 'earned');
  assert.equal(dated.earnedAt, day(5));
});

test('3 weeks in a row is earned, undated, only when the server best run proves it', () => {
  const find = (rhythm, list = []) => badgePaths(mergeDerived(list, {}), rhythm).flatMap((p) => p.steps).find((s) => s.id === 'run_weeks_3');
  assert.equal(find({ bestRun: 2, weeksMetStreak: 2 }).status === 'earned', false);
  const proven = find({ bestRun: 3, weeksMetStreak: 0 });
  assert.equal(proven.status, 'earned');
  assert.equal(proven.undated, true);
  assert.equal(proven.earnedAt, null);
  const dated = find({ bestRun: 3 }, [{ id: 'run_weeks_3', achievedAt: day(7) }]);
  assert.equal(dated.undated, false);
  assert.equal(dated.earnedAt, day(7));
});

test('the server date wins over the derived one; ISO strings from the server are read', () => {
  const server = [{ id: 'clean_set', achievedAt: '2026-09-01T00:00:00.000Z' }];
  const merged = mergeDerived(server, { clean_set: { id: 'clean_set', at: day(1), attemptId: 'a' } });
  assert.equal(merged.find((m) => m.id === 'clean_set').achievedAt, Date.parse('2026-09-01T00:00:00.000Z'));
  const fromAttempt = mergeDerived([{ id: 'clean_set', achievedAt: null }], { clean_set: { id: 'clean_set', at: day(1), attemptId: 'a' } });
  assert.equal(fromAttempt.find((m) => m.id === 'clean_set').achievedAt, day(1));
});

test('best work is not a sequence: every badge not earned is next; the other paths have one next', () => {
  const paths = badgePaths(mergeDerived([], {}), null);
  const best = paths.find((p) => p.id === 'best');
  assert.ok(best.steps.every((s) => s.status === 'next'));
  for (const p of paths.filter((x) => x.id !== 'best')) assert.equal(p.steps.filter((s) => s.status === 'next').length, 1);
});

test('the count line and the so-far lines', () => {
  const paths = badgePaths(mergeDerived([{ id: 'first_scored_session', achievedAt: '2026-10-01T00:00:00Z' }], {}), null);
  assert.equal(earnedLine(paths), '1 of 16 earned');
  assert.equal(earnedLine(badgePaths(mergeDerived([], {}), null)), 'None earned yet');
  const entries = countEntries({ sessions_10: 6, four_subjects: 2, repairs_5: 2 });
  assert.equal(soFarLine('sessions_10', entries), '6 of 10 so far');
  assert.equal(soFarLine('four_subjects', entries), '2 of 4 subjects');
  assert.equal(soFarLine('repairs_5', entries), null); // repairs are counted only when the server sends the count
  assert.equal(fractionOf('sessions_10', entries), 0.6);
  assert.equal(fractionOf('first_repair', entries), null);
  assert.equal(soFarLine('repairs_5', countEntries({ repairs_5: { current: 2, target: 5 } })), '2 of 5 so far');
});

test('progress counts scored sets and weeks at the goal, and drops a count the server has not confirmed', () => {
  const sets = Array.from({ length: 6 }, (_, i) => att(`s${i}`, { d: i + 1 }));
  const counts = attemptCounts([...sets, att('short', { correct: 1, wrong: 1, total: 10 }), att('dev', { scoring: 'device_v0' })]);
  assert.equal(counts.sessions_10, 6);
  const history = [{ met: true }, { met: false }, { met: true }];
  const p = milestoneProgress(counts, { history, metThisWeek: true, milestones: [] });
  assert.equal(p.sessions_10, 6);
  assert.equal(p.weeks_met_4, 3);
  // History that may not reach back to the first week is not counted.
  assert.equal('weeks_met_4' in milestoneProgress(counts, { history: new Array(12).fill({ met: true }), milestones: [] }), false);
  // A count at its target while the server has not dated the step is dropped, as is an earned step.
  assert.equal('sessions_10' in milestoneProgress({ sessions_10: 10 }, { history: [], milestones: [] }), false);
  assert.equal('sessions_10' in milestoneProgress({ sessions_10: 6 }, { history: [], milestones: [{ id: 'sessions_10', achievedAt: '2026-10-01T00:00:00Z' }] }), false);
});

test('records name the paper behind a derived badge and are never made up', () => {
  const a = att('p', { d: 12, mode: 'full', subject: 'accountancy', total: 50, correct: 31, wrong: 3, formatId: 'f' });
  const prior = att('o', { d: 3, mode: 'full', subject: 'accountancy', total: 50, correct: 28, wrong: 5, formatId: 'f' });
  const derived = deriveBadges([prior, a]);
  const records = badgeRecords(derived, [prior, a]);
  assert.equal(recordLine(records.new_best, 'Asia/Kolkata'), 'From your Accountancy full mock, 12 October: 152 of 250 (before: 135)');
  assert.deepEqual(badgeRecords(derived, []), {});
  assert.equal(recordLine(undefined), '');
});

test('fastest right answer ignores answers under 3 seconds and wrong answers', () => {
  const a = att('t', { details: [
    { qid: 'q1', isCorrect: true, timeMs: 2000 }, { qid: 'q2', isCorrect: false, timeMs: 4000 },
    { qid: 'q3', isCorrect: true, timeMs: 9200 }, { qid: 'q4', isCorrect: true, timeMs: 12000 },
  ] });
  const f = fastestRightAnswer([a]);
  assert.equal(f.seconds, 9);
  assert.equal(f.question, 3);
  assert.equal(f.attemptId, 't');
});

test('fastest: no timings, no claim; unusable or device-scored papers are skipped', () => {
  assert.equal(fastestRightAnswer([att('x')]), null);
  const timed = [{ qid: 'q1', isCorrect: true, timeMs: 5000 }];
  assert.equal(fastestRightAnswer([att('d', { details: timed, scoring: 'device_v0' })]), null);
  assert.equal(fastestRightAnswer([att('r', { details: timed, recovery: { telemetry: 'inconsistent' } })]), null);
  assert.equal(fastestRightAnswer([att('ok', { details: timed, recovery: { telemetry: 'self_reported' } })]).seconds, 5);
  assert.equal(fastestRightAnswer([att('old', { details: timed })]).seconds, 5);
});

test('fastest: the question number follows the paper when its questions are saved', () => {
  const a = att('t', { details: [{ qid: 'b', isCorrect: true, timeMs: 7000 }] });
  a.questionsSnapshot = [{ id: 'a' }, { id: 'b' }];
  assert.equal(fastestRightAnswer([a]).question, 2);
});

test('personal bests rows: value first, each with its denominator or date', () => {
  const bests = [
    { formatId: 'quick:english:q20:server_practice_v1', subject: 'english', mode: 'quick', attempts: 2, best: { marks: 90, max: 100, attemptId: 'q', completedAt: day(8) }, latest: { marks: 80, max: 100, attemptId: 'q2', completedAt: day(9) } },
    { formatId: 'full:accountancy:q50:server_practice_v1', subject: 'accountancy', mode: 'full', attempts: 2, best: { marks: 142, max: 250, attemptId: 'm1', completedAt: day(12) }, latest: { marks: 130, max: 250, attemptId: 'm2', completedAt: day(14) } },
  ];
  const rhythm = { bestRun: 5, weeksMetStreak: 2, daysGoal: 4 };
  const fastest = { seconds: 9, subject: 'business_studies', question: 14, at: day(14), attemptId: 'm2' };
  const rows = bestsRows({ bests, fastest, rhythm, timeZone: 'Asia/Kolkata' });
  assert.deepEqual(rows.map((r) => [r.value, r.label, r.note]), [
    ['142 / 250', 'Best full mock', 'Accountancy, 12 October'],
    ['5 weeks', 'Longest run at your goal', 'Now: 2 weeks in a row. Goal: 4 study days a week.'],
    ['9 s', 'Fastest right answer', 'Business Studies, question 14, 14 October'],
  ]);
  assert.equal(rows[0].href, '/result/m1');
});

test('personal bests: a set stands in before the first mock; nothing true means no row', () => {
  const set = { formatId: 'f', subject: 'english', mode: 'quick', attempts: 1, best: { marks: 40, max: 50, attemptId: 'q', completedAt: day(2) }, latest: { marks: 40, max: 50, attemptId: 'q', completedAt: day(2) } };
  const rows = bestsRows({ bests: [set], timeZone: 'Asia/Kolkata' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Best set');
  assert.deepEqual(bestsRows({}), []);
  const none = bestsRows({ rhythm: { bestRun: 0, weeksMetStreak: 0, daysGoal: 4 } });
  assert.equal(none[0].value, '0 weeks');
  assert.equal(none[0].note, 'Your first week at your goal starts the count.');
  assert.equal(longestRun({ bestRun: 1, weeksMetStreak: 3 }), 3);
});

test('per mock type lines keep best and latest apart', () => {
  const lines = formatLines([
    { formatId: 'a', subject: 'accountancy', mode: 'full', attempts: 2, best: { marks: 142, max: 250, attemptId: 'm1', completedAt: day(12) }, latest: { marks: 130, max: 250, attemptId: 'm2', completedAt: day(14) } },
    { formatId: 'b', subject: 'english', mode: 'nta', attempts: 1, best: { marks: 100, max: 250, attemptId: 'n1', completedAt: day(3) }, latest: { marks: 100, max: 250, attemptId: 'n1', completedAt: day(3) } },
  ], 'Asia/Kolkata');
  assert.equal(lines[0].title, 'Accountancy, full mock, 50 questions');
  assert.equal(lines[0].latest, '130 of 250');
  assert.equal(lines[1].latest, null);
});

test('words: subject names and dates in the student time zone', () => {
  assert.equal(subjectName('business'), 'Business Studies');
  assert.equal(subjectName('gat'), 'General Test');
  assert.equal(subjectName('some_new_subject'), 'Some New Subject');
  assert.equal(subjectName(''), 'Practice');
  // 23:30 UTC on the 11th is the 12th in India.
  assert.equal(dayMonth(Date.UTC(2026, 9, 11, 23, 30), 'Asia/Kolkata'), '12 October');
  assert.equal(dayMonth(Date.UTC(2026, 9, 11, 23, 30), 'UTC'), '11 October');
});

test('the study record the page needs is small and complete', () => {
  const list = [att('a', { d: 1, mode: 'nta', formatId: 'f' }), att('b', { d: 2, total: 10, correct: 10, wrong: 0 })];
  const rec = buildStudyRecord(list, []);
  assert.deepEqual(Object.keys(rec.derived).sort(), ['clean_set', 'first_nta']);
  assert.equal(rec.records.first_nta.mode, 'nta');
  assert.equal(rec.scoredAttempts, 2);
  assert.equal(rec.counts.sessions_10, 2);
});

// The server's own list (GET /api/me/badges, docs/design-decisions/badges-api-1016.md in wt-w2g).
const apiBadge = (id, extra = {}) => ({ id, path: 'papers', name: 'x', condition: 'y', earned: false, earnedAt: null, progress: { current: 0, target: 1 }, record: null, ...extra });
function apiBody(overrides = {}, rest = {}) {
  const earned = {
    first_scored_session: { earned: true, earnedAt: '2026-09-14T11:02:31.000Z', progress: { current: 1, target: 1 } },
    full_mocks_5: { progress: { current: 3, target: 5 } },
    repairs_5: { progress: { current: 2, target: 5 } },
    new_best: { earned: true, earnedAt: '2026-10-12T08:41:00.000Z', progress: { current: 1, target: 1 },
      record: { attemptId: 'a_123', subject: 'accountancy', mode: 'full', correct: 32, wrong: 8, total: 50, marks: 152, maxMarks: 250, before: 142 } },
    ...overrides,
  };
  return { version: 1, total: 16, bestRunEndedWeek: '2026-10-05', unavailable: [], badges: BADGE_STEPS.map((s) => apiBadge(s.id, earned[s.id] || {})), ...rest };
}

test('the server list gives the board: dates, counts and the paper, in the app words', () => {
  const got = badgePathsFromApi(apiBody());
  const steps = got.paths.flatMap((p) => p.steps);
  assert.equal(steps.length, 16);
  assert.equal(earnedLine(got.paths), '2 of 16 earned');
  assert.equal(steps.find((s) => s.id === 'first_scored_session').earnedAt, Date.parse('2026-09-14T11:02:31.000Z'));
  assert.equal(soFarLine('full_mocks_5', got.progress), '3 of 5 so far');
  assert.equal(soFarLine('repairs_5', got.progress), '2 of 5 so far');
  assert.equal(fractionOf('first_repair', got.progress), null);
  assert.equal(recordLine(got.records.new_best, 'Asia/Kolkata'), 'From your Accountancy full mock, 12 October: 152 of 250 (before: 142)');
  assert.equal(got.bestRunEndedWeek, '2026-10-05');
});

test('the server list: a badge it could not read is unknown, never next, never locked', () => {
  const got = badgePathsFromApi(apiBody({}, { unavailable: ['first_hold'] }));
  const repairs = got.paths.find((p) => p.id === 'repairs');
  const hold = repairs.steps.find((s) => s.id === 'first_hold');
  assert.equal(hold.status, 'unknown');
  assert.equal(repairs.steps.filter((s) => s.status === 'next').length, 1);
  assert.equal(repairs.earned, 0);
});

test('the server list: anything that is not the contract falls back to the papers', () => {
  assert.equal(badgePathsFromApi(null), null);
  assert.equal(badgePathsFromApi({ version: 2, badges: [] }), null);
  assert.equal(badgePathsFromApi({ version: 1, badges: [{ id: 'unrelated' }] }), null);
  assert.equal(badgePathsFromApi({ version: 1, badges: 'x' }), null);
});

test('the run date is said only while the longest run is over', () => {
  const rhythm = (now) => ({ bestRun: 5, weeksMetStreak: now, daysGoal: 4 });
  const noteOf = (r, week) => bestsRows({ rhythm: r, bestRunEndedWeek: week })[0].note;
  assert.equal(noteOf(rhythm(2), '2026-10-05'), 'Now: 2 weeks in a row. Goal: 4 study days a week. Ended the week of 5 October.');
  assert.equal(noteOf(rhythm(5), '2026-10-05'), 'Now: 5 weeks in a row. Goal: 4 study days a week.');
  assert.equal(noteOf(rhythm(2), null), 'Now: 2 weeks in a row. Goal: 4 study days a week.');
});
