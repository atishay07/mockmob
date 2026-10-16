import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRhythm } from '../../src/lib/server/rhythm.js';
import { BADGE_DEFS, buildBadges, etagOf, deriveFromAttempts, scoredAttempts, SERVER_SCORING } from '../../src/lib/server/badges.js';

// Row shapes match what the store reads from production (read-only check, 16 Oct 2026): attempts.id is text,
// subject is the internal id (english, political_science, business_studies, accountancy ...), mode and
// scoringVersion are selection_meta->>mode and ->>scoringVersion (mode: quick|full|nta|smart|null;
// scoringVersion: server_practice_v1 or null for old device-scored rows), completed_at is timestamptz as
// PostgREST returns it. 1807 of 1815 production attempts have a null scoringVersion and never count.
const ist = (date, hhmm = '12:00') => Date.parse(`${date}T${hhmm}:00+05:30`);
const pg = ms => new Date(ms).toISOString().replace('Z', '+00:00');
let n = 0;
const row = (over = {}) => ({
  id: `att_${String(++n).padStart(4, '0')}`, subject: 'accountancy', correct: 7, wrong: 3, total: 10,
  completed_at: pg(ist('2026-10-05')), mode: 'quick', scoringVersion: 'server_practice_v1', ...over,
});
const byId = list => Object.fromEntries(list.badges.map(b => [b.id, b]));
const NOW = ist('2026-10-16', '10:00');
const rhythmOf = (activities, extra = {}) => computeRhythm({ activities, daysPerWeek: 1, now: NOW, ...extra });
const session = (date, over = {}) => ({ id: `a:${date}:${over.id || ''}`, at: ist(date), kind: 'session', answered: 10, ...over });

test('the list is always the 16 badges, in shelf order, with names and conditions', () => {
  const list = buildBadges({ rhythm: rhythmOf([], { firstHoldAt: null }), attemptRows: [], generatedAt: NOW });
  assert.equal(list.version, 1);
  assert.equal(list.total, 16);
  assert.equal(list.earnedCount, 0);
  assert.deepEqual(list.badges.map(b => b.id), BADGE_DEFS.map(d => d.id));
  assert.deepEqual([...new Set(list.badges.map(b => b.path))], ['papers', 'repairs', 'rhythm', 'best']);
  assert.equal(list.badges.find(b => b.id === 'first_hold').name, 'It held');
  assert.equal(list.badges.find(b => b.id === 'run_weeks_3').name, '3 weeks in a row');
  for (const b of list.badges) {
    assert.equal(b.earned, false);
    assert.equal(b.earnedAt, null);
    assert.equal(b.record, null);
    assert.ok(b.progress.current >= 0 && b.progress.current < b.progress.target, b.id);
    assert.ok(b.name && b.condition);
  }
  assert.deepEqual(list.unavailable, []);
  assert.equal(list.bestRunEndedWeek, null);
});

test('It held: dated by the first right check; a failed read is "unavailable", never locked', () => {
  const held = '2026-10-14T08:15:00.000Z';
  const ok = byId(buildBadges({ rhythm: rhythmOf([], { firstHoldAt: held }), attemptRows: [], generatedAt: NOW }));
  assert.equal(ok.first_hold.earned, true);
  assert.equal(ok.first_hold.earnedAt, held);
  assert.deepEqual(ok.first_hold.progress, { current: 1, target: 1 });

  const none = buildBadges({ rhythm: rhythmOf([], { firstHoldAt: null }), attemptRows: [], generatedAt: NOW });
  assert.equal(byId(none).first_hold.earned, false);
  assert.deepEqual(none.unavailable, []);

  const unread = buildBadges({ rhythm: rhythmOf([], { firstHoldAt: undefined }), attemptRows: [], generatedAt: NOW });
  assert.equal(byId(unread).first_hold.earned, false);
  assert.deepEqual(unread.unavailable, ['first_hold']);
});

test('3 weeks in a row: dated by the third week reaching its goal; two weeks give 2 of 3', () => {
  // Goal 1 day a week. Weeks of 28 Sep, 5 Oct, 12 Oct are each met (a run of 3, third week met on Tuesday 13 Oct).
  const acts = [session('2026-09-29'), session('2026-10-06'), session('2026-10-13')];
  const r = rhythmOf(acts, { firstHoldAt: null });
  const b = byId(buildBadges({ rhythm: r, attemptRows: [], generatedAt: NOW }));
  assert.equal(b.run_weeks_3.earned, true);
  assert.equal(b.run_weeks_3.earnedAt, new Date(ist('2026-10-13')).toISOString());
  assert.equal(r.bestRun, 3);
  assert.equal(r.bestRunEndedWeek, '2026-10-12');

  const two = rhythmOf([session('2026-10-06'), session('2026-10-13')], { firstHoldAt: null });
  const t = byId(buildBadges({ rhythm: two, attemptRows: [], generatedAt: NOW }));
  assert.equal(t.run_weeks_3.earned, false);
  assert.deepEqual(t.run_weeks_3.progress, { current: 2, target: 3 });
  assert.equal(t.weeks_met_4.progress.current, 2);
});

test('3 weeks in a row: a missed week breaks the run, a paused week does not, and an earlier run still counts', () => {
  const broken = rhythmOf([session('2026-09-15'), session('2026-09-22'), session('2026-10-06'), session('2026-10-13')], { firstHoldAt: null });
  assert.equal(byId(buildBadges({ rhythm: broken, attemptRows: [], generatedAt: NOW })).run_weeks_3.earned, false);
  // week of 29 Sep is paused (pause covers its Sunday, goal not met): the run carries over it.
  const paused = rhythmOf([session('2026-09-22'), session('2026-10-06'), session('2026-10-13')], { pausedUntil: '2026-10-04', firstHoldAt: null });
  const p = byId(buildBadges({ rhythm: paused, attemptRows: [], generatedAt: NOW }));
  assert.equal(p.run_weeks_3.earned, true);
  assert.equal(p.run_weeks_3.earnedAt, new Date(ist('2026-10-13')).toISOString());
  // Earned never un-earns: after a long gap the badge keeps its date, and the best run keeps its end week.
  const later = computeRhythm({ activities: [session('2026-09-15'), session('2026-09-22'), session('2026-09-29')], daysPerWeek: 1, now: ist('2026-12-01'), firstHoldAt: null });
  const l = byId(buildBadges({ rhythm: later, attemptRows: [], generatedAt: ist('2026-12-01') }));
  assert.equal(l.run_weeks_3.earned, true);
  assert.equal(l.run_weeks_3.earnedAt, new Date(ist('2026-09-29')).toISOString());
  assert.equal(later.bestRunEndedWeek, '2026-09-28');
  assert.equal(later.weeksMetStreak, 0);
});

test('rhythm counts feed progress for sets, repairs and weeks at goal', () => {
  const acts = [];
  for (let i = 0; i < 7; i++) acts.push(session(`2026-10-${String(5 + i).padStart(2, '0')}`, { id: `s${i}` }));
  for (let i = 0; i < 3; i++) acts.push({ id: `r:${i}`, at: ist(`2026-10-1${i}`, '18:00'), kind: 'repair' });
  const b = byId(buildBadges({ rhythm: rhythmOf(acts, { firstHoldAt: null, daysPerWeek: 3 }), attemptRows: [], generatedAt: NOW }));
  assert.deepEqual(b.sessions_10.progress, { current: 7, target: 10 });
  assert.equal(b.first_repair.earned, true);
  assert.deepEqual(b.repairs_5.progress, { current: 3, target: 5 });
  assert.deepEqual(b.repairs_25.progress, { current: 3, target: 25 });
  assert.equal(b.first_week_met.earned, true);
});

test('attempt-derived: only server-scored rows count (old device-scored rows never earn anything)', () => {
  const rows = [
    row({ mode: 'nta', correct: 40, wrong: 5, total: 50, scoringVersion: null }),
    row({ mode: 'full', correct: 10, wrong: 10, total: 10, scoringVersion: null }),
    row({ mode: 'quick', correct: 5, wrong: 0, total: 5, scoringVersion: 'unknown_v9' }),
  ];
  assert.equal(scoredAttempts(rows).length, 0);
  assert.deepEqual(deriveFromAttempts(rows).earned, {});
  assert.ok(SERVER_SCORING.includes('server_snapshot_v1') && SERVER_SCORING.includes('server_practice_v1'));
});

test('attempt-derived: first NTA, clean set, 5th mock with its record', () => {
  const rows = [
    row({ mode: 'full', correct: 30, wrong: 10, total: 50, completed_at: pg(ist('2026-10-01')) }),
    row({ mode: 'nta', correct: 32, wrong: 8, total: 50, completed_at: pg(ist('2026-10-02')), subject: 'english' }),
    row({ mode: 'quick', correct: 10, wrong: 0, total: 10, completed_at: pg(ist('2026-10-03')) }),
    row({ mode: 'full', correct: 20, wrong: 5, total: 50, completed_at: pg(ist('2026-10-04')) }),
    row({ mode: 'full', correct: 25, wrong: 5, total: 50, completed_at: pg(ist('2026-10-05')) }),
    row({ mode: 'full', correct: 35, wrong: 5, total: 50, completed_at: pg(ist('2026-10-06')) }),
  ];
  const { earned, counts } = deriveFromAttempts(rows);
  assert.equal(earned.first_nta.at, new Date(ist('2026-10-02')).toISOString());
  assert.equal(earned.first_nta.record.subject, 'english');
  assert.equal(earned.clean_set.at, new Date(ist('2026-10-03')).toISOString());
  assert.equal(earned.clean_set.record.marks, 50);
  assert.equal(counts.mocks, 5);
  assert.equal(earned.full_mocks_5.at, new Date(ist('2026-10-06')).toISOString());
  assert.equal(earned.full_mocks_5.record.marks, 35 * 5 - 5);
  assert.equal(earned.full_mocks_5.record.maxMarks, 250);
  assert.equal(earned.clean_set.record.before, undefined);
});

test('attempt-derived: a clean set needs 10 or more questions; 9 of 9 does not count', () => {
  const rows = [row({ correct: 9, wrong: 0, total: 9 }), row({ correct: 4, wrong: 0, total: 5 })];
  assert.equal(deriveFromAttempts(rows).earned.clean_set, undefined);
});

test('attempt-derived: four subjects counts a subject only with 5 or more answered; progress is exact', () => {
  const at = d => pg(ist(`2026-10-${d}`));
  const rows = [
    row({ subject: 'accountancy', completed_at: at('01') }),
    row({ subject: 'English', completed_at: at('02') }),
    row({ subject: ' english ', completed_at: at('03') }),
    row({ subject: 'economics', correct: 2, wrong: 2, total: 10, completed_at: at('04') }), // 4 answered: no
    row({ subject: 'history', completed_at: at('05') }),
  ];
  const first = deriveFromAttempts(rows);
  assert.equal(first.counts.subjects, 3);
  assert.equal(first.earned.four_subjects, undefined);
  const list = byId(buildBadges({ rhythm: rhythmOf([], { firstHoldAt: null }), attemptRows: rows, generatedAt: NOW }));
  assert.deepEqual(list.four_subjects.progress, { current: 3, target: 4 });
  const more = [...rows, row({ subject: 'business_studies', completed_at: at('06') })];
  const done = deriveFromAttempts(more);
  assert.equal(done.earned.four_subjects.at, new Date(ist('2026-10-06')).toISOString());
  assert.equal(done.earned.four_subjects.record.subject, 'business_studies');
  const l2 = byId(buildBadges({ rhythm: rhythmOf([], { firstHoldAt: null }), attemptRows: more, generatedAt: NOW }));
  assert.deepEqual(l2.four_subjects.progress, { current: 4, target: 4 });
});

test('attempt-derived: new best is the first attempt strictly above an earlier one of the same format', () => {
  const at = d => pg(ist(`2026-10-${d}`));
  const rows = [
    row({ mode: 'full', subject: 'economics', correct: 28, wrong: 8, total: 50, completed_at: at('01') }), // 132
    row({ mode: 'full', subject: 'economics', correct: 28, wrong: 8, total: 50, completed_at: at('02') }), // equal: no
    row({ mode: 'full', subject: 'english', correct: 45, wrong: 0, total: 50, completed_at: at('03') }), // other format
    row({ mode: 'full', subject: 'economics', correct: 30, wrong: 9, total: 50, completed_at: at('04') }), // 141: beats 132
    row({ mode: 'full', subject: 'economics', correct: 31, wrong: 9, total: 50, completed_at: at('05') }), // later best, same badge
  ];
  const { earned } = deriveFromAttempts(rows);
  assert.equal(earned.new_best.at, new Date(ist('2026-10-04')).toISOString());
  assert.equal(earned.new_best.record.before, 132);
  assert.equal(earned.new_best.record.marks, 141);
  const notYet = deriveFromAttempts(rows.slice(0, 3));
  assert.equal(notYet.earned.new_best, undefined);
});

test('attempt order does not matter: rows are sorted by their own date, ties by id', () => {
  const a = row({ mode: 'nta', completed_at: pg(ist('2026-10-03')) });
  const b = row({ mode: 'nta', completed_at: pg(ist('2026-10-02')) });
  const { earned } = deriveFromAttempts([a, b]);
  assert.equal(earned.first_nta.record.attemptId, b.id);
  assert.deepEqual(deriveFromAttempts([b, a]).earned.first_nta.record.attemptId, b.id);
});

test('rows with no valid date or id are ignored; a bad number never throws', () => {
  const rows = [row({ completed_at: 'not a date', mode: 'nta' }), row({ id: '', mode: 'nta' }), null, row({ correct: null, wrong: 'x', total: undefined, mode: 'nta' })];
  const { earned } = deriveFromAttempts(rows);
  assert.equal(earned.first_nta.record.marks, 0);
  assert.equal(scoredAttempts(rows).length, 1);
});

test('progress never reaches its target unless the badge is earned, and earned means current equals target', () => {
  const rows = [];
  for (let i = 1; i <= 6; i++) rows.push(row({ mode: 'full', correct: 20 + i, wrong: 2, total: 50, completed_at: pg(ist(`2026-10-0${i}`)) }));
  const acts = [];
  for (let i = 0; i < 12; i++) acts.push({ id: `a${i}`, at: ist(`2026-10-${String(1 + i).padStart(2, '0')}`), kind: 'session', answered: 9, fullMock: i === 0 });
  const list = buildBadges({ rhythm: rhythmOf(acts, { firstHoldAt: null, daysPerWeek: 5 }), attemptRows: rows, generatedAt: NOW });
  for (const b of list.badges) {
    assert.equal(b.progress.current === b.progress.target, b.earned, b.id);
    assert.equal(b.earned, b.earnedAt != null, b.id);
    assert.ok(b.progress.current <= b.progress.target, b.id);
  }
  assert.equal(byId(list).full_mocks_5.earned, true);
  assert.equal(byId(list).sessions_10.earned, true);
  assert.equal(list.earnedCount, list.badges.filter(b => b.earned).length);
});

test('the response carries no answers, keys or question text', () => {
  const rows = [row({ mode: 'nta', correct: 10, wrong: 0, total: 10, details: [{ qid: 'q1', isCorrect: true }], questions_snapshot: [{ id: 'q1' }] })];
  const json = JSON.stringify(buildBadges({ rhythm: rhythmOf([], { firstHoldAt: null }), attemptRows: rows, generatedAt: NOW }));
  assert.ok(!/details|questions_snapshot|qid|explanation|answer/i.test(json.replace(/"condition":"[^"]*"/g, '')));
});

test('the ETag ignores generatedAt but changes when a badge is earned', () => {
  const r0 = rhythmOf([], { firstHoldAt: null });
  const a = buildBadges({ rhythm: r0, attemptRows: [], generatedAt: NOW });
  const b = buildBadges({ rhythm: r0, attemptRows: [], generatedAt: NOW + 60000 });
  assert.equal(etagOf(a), etagOf(b));
  assert.match(etagOf(a), /^W\/"[A-Za-z0-9_-]{22}"$/);
  const c = buildBadges({ rhythm: rhythmOf([], { firstHoldAt: '2026-10-14T08:15:00.000Z' }), attemptRows: [], generatedAt: NOW });
  assert.notEqual(etagOf(a), etagOf(c));
});
