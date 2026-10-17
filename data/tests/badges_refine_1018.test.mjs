import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BADGE_STEPS, badgePathsFromApi, countEntries } from '../../src/lib/studyBadges.js';
import {
  MATCH_MS, RECENT_MS, SEEN_PREFIX, actionFor, countLeft, detailOf, earnedByAttempt, earnedShelf, ghostLine, headLine, isSeen, markSeen,
  momentWords, nextOnPath, paperLine, pickNext, shortDay, toMs, unseen, whenLine,
} from '../../src/lib/badgeShelf.js';

// BADGES-REFINE-1018: the pure parts of the badge shelf, the detail sheet and the "Badge earned" row.
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const NOW = Date.parse('2026-10-18T10:00:00.000Z');
const iso = (back) => new Date(NOW - back).toISOString();
const DAY = 86400000;
const apiBadge = (step, extra = {}) => ({ id: step.id, path: step.path, name: step.name, condition: step.condition, earned: false, earnedAt: null, progress: { current: 0, target: 1 }, record: null, ...extra });
function body(map = {}, rest = {}) {
  return { version: 1, total: 16, bestRunEndedWeek: null, unavailable: [], badges: BADGE_STEPS.map((s) => apiBadge(s, map[s.id] || {})), ...rest };
}
const earnedAt = (back, extra = {}) => ({ earned: true, earnedAt: iso(back), progress: { current: 1, target: 1 }, ...extra });
const board = (map, rest) => badgePathsFromApi(body(map, rest));
const stepsOf = (paths) => paths.flatMap((p) => p.steps);

const SOME = {
  first_scored_session: earnedAt(45 * DAY),
  first_full_mock: earnedAt(18 * DAY),
  first_nta: earnedAt(20 * DAY, { record: { attemptId: 'nta1', subject: 'business_studies', mode: 'nta', correct: 30, wrong: 6, total: 50, marks: 144, maxMarks: 250 } }),
  first_repair: earnedAt(25 * DAY),
  new_best: earnedAt(12 * DAY, { record: { attemptId: 'fm2', subject: 'accountancy', mode: 'full', correct: 34, wrong: 5, total: 50, marks: 165, maxMarks: 250, before: 126 } }),
  first_week_met: earnedAt(8 * DAY),
  repairs_5: { progress: { current: 3, target: 5 } },
  repairs_10: { progress: { current: 3, target: 10 } },
  sessions_10: { progress: { current: 7, target: 10 } },
  full_mocks_5: { progress: { current: 3, target: 5 } },
  four_subjects: { progress: { current: 3, target: 4 } },
  weeks_met_4: { progress: { current: 1, target: 4 } },
  run_weeks_3: { progress: { current: 1, target: 3 } },
};

// ---------------------------------------------------------------------------------------------
// Words and times

test('toMs reads a number, a numeric string and an ISO string, and nothing else', () => {
  assert.equal(toMs(1700000000000), 1700000000000);
  assert.equal(toMs('1700000000000'), 1700000000000);
  assert.equal(toMs('2026-10-17T15:42:00.000Z'), Date.parse('2026-10-17T15:42:00.000Z'));
  assert.equal(toMs(null), null);
  assert.equal(toMs(''), null);
  assert.equal(toMs('not a date'), null);
});

test('the date and 12-hour time are the student\'s own, in India time by default', () => {
  // 15:42 UTC on 17 Oct is 9:12 PM in India.
  const at = Date.parse('2026-10-17T15:42:00.000Z');
  assert.equal(whenLine(at, 'Asia/Kolkata'), 'Sat 17 Oct, 9:12 PM');
  assert.equal(whenLine(at), 'Sat 17 Oct, 9:12 PM');
  assert.equal(whenLine(at, 'UTC'), 'Sat 17 Oct, 3:42 PM');
  assert.equal(whenLine(at, 'Not/AZone'), 'Sat 17 Oct, 9:12 PM');
  assert.equal(whenLine(Date.parse('2026-10-17T18:30:00.000Z'), 'Asia/Kolkata'), 'Sun 18 Oct, 12:00 AM');
  assert.equal(whenLine(null), '');
  assert.equal(shortDay(at, 'Asia/Kolkata'), '17 Oct');
});

// ---------------------------------------------------------------------------------------------
// Counts

test('counts left carry their denominator and their unit, and are never invented', () => {
  const entries = { full_mocks_5: { current: 3, target: 5 }, repairs_10: { current: 9, target: 10 }, four_subjects: { current: 3, target: 4 }, weeks_met_4: { current: 1, target: 4 }, run_weeks_3: { current: 2, target: 3 } };
  assert.deepEqual(countLeft('full_mocks_5', entries), { current: 3, target: 5, left: 2, fraction: 0.6, so: '3 of 5 full mocks', short: '3 of 5', more: '2 more full mocks' });
  assert.equal(countLeft('repairs_10', entries).more, '1 more repair');
  assert.equal(countLeft('four_subjects', entries).more, '1 more subject');
  assert.equal(countLeft('weeks_met_4', entries).more, '3 more weeks at your goal');
  assert.equal(countLeft('run_weeks_3', entries).more, '1 more week in a row');
  // Unknown is never zero: no entry, no line.
  assert.equal(countLeft('repairs_5', entries), null);
  assert.equal(countLeft('first_repair', { first_repair: { current: 0, target: 1 } }), null);
  assert.equal(countLeft('sessions_10', { sessions_10: { current: 10, target: 10 } }), null);
  assert.equal(countLeft('sessions_10', null), null);
});

// ---------------------------------------------------------------------------------------------
// The shelf

test('the head counts earned over all sixteen', () => {
  assert.equal(headLine(board(SOME).paths), 'Badges, 6 of 16');
  assert.equal(headLine(board({}).paths), 'Badges, 0 of 16');
  const all = Object.fromEntries(BADGE_STEPS.map((s) => [s.id, earnedAt(DAY)]));
  assert.equal(headLine(board(all).paths), 'Badges, 16 of 16');
});

test('the shelf is the earned badges, newest first', () => {
  const got = earnedShelf(board(SOME).paths).map((x) => x.step.id);
  // By date, newest first: week met (8 days back), new best (12), full mock (18), NTA (20), repair (25), first set (45).
  assert.deepEqual(got, ['first_week_met', 'new_best', 'first_full_mock', 'first_nta', 'first_repair', 'first_scored_session']);
  assert.equal(earnedShelf(board({}).paths).length, 0);
});

test('an earned badge with no date goes last on the shelf and is never given a made-up date', () => {
  const paths = board({ first_scored_session: earnedAt(5 * DAY) }, { bestRunEndedWeek: null }).paths;
  const run = paths.find((p) => p.id === 'rhythm').steps.find((s) => s.id === 'run_weeks_3');
  run.status = 'earned'; run.earnedAt = null; run.undated = true;
  const got = earnedShelf(paths).map((x) => x.step.id);
  assert.deepEqual(got, ['first_scored_session', 'run_weeks_3']);
});

test('the ghost is the one closest to done where a count exists', () => {
  const b = board(SOME);
  const entries = countEntries(b.progress);
  const pick = pickNext(b.paths, entries);
  // four_subjects 3 of 4 (75 percent) beats sessions_10 7 of 10 (70 percent), full mocks 3 of 5 and repairs_5 3 of 5.
  assert.equal(pick.step.id, 'four_subjects');
  assert.equal(pick.path.id, 'best');
  assert.equal(ghostLine(pick.step, pick.path, entries), 'Your best work: 3 of 4. 1 more subject.');
});

test('the ghost line for repairs reads like the brief', () => {
  const b = board({ ...SOME, four_subjects: {}, sessions_10: {}, full_mocks_5: {}, repairs_5: earnedAt(DAY), repairs_10: { progress: { current: 7, target: 10 } } });
  const entries = countEntries(b.progress);
  const pick = pickNext(b.paths, entries);
  assert.equal(pick.step.id, 'repairs_10');
  assert.equal(ghostLine(pick.step, pick.path, entries), 'Repairs: 7 of 10. 3 more repairs.');
});

test('a student with nothing earned is shown the first set, not a count of zero', () => {
  const b = board({});
  const entries = countEntries(b.progress);
  const pick = pickNext(b.paths, entries);
  assert.equal(pick.step.id, 'first_scored_session');
  assert.equal(ghostLine(pick.step, pick.path, entries), 'Papers. Lands when a set with 5 or more answers is scored.');
});

test('with every badge earned there is no ghost; a badge the server could not read is never picked', () => {
  const all = Object.fromEntries(BADGE_STEPS.map((s) => [s.id, earnedAt(DAY)]));
  assert.equal(pickNext(board(all).paths, {}), null);
  const unreadable = board({ ...all, first_hold: {} }, { unavailable: ['first_hold'] });
  assert.equal(pickNext(unreadable.paths, {}), null);
  assert.equal(headLine(unreadable.paths), 'Badges, 15 of 16');
});

// ---------------------------------------------------------------------------------------------
// The detail

test('the next badge on the same path, with its exact count left', () => {
  const b = board(SOME);
  const paths = b.paths;
  const next = nextOnPath(paths, 'first_repair');
  assert.equal(next.kind, 'next');
  assert.equal(next.step.id, 'repairs_5');
  const d = detailOf(paths, 'first_repair', { entries: countEntries(b.progress), records: b.records, zone: 'Asia/Kolkata' });
  assert.equal(d.next.name, '5 repairs');
  assert.equal(d.next.more, '2 more repairs');
  assert.equal(d.next.so, '3 of 5 repairs');
  assert.deepEqual(d.action, { label: 'Open your mistakes', href: '/review' });
});

test('on the best-work path nothing waits on another, so the other badge to earn is offered as "also"', () => {
  const b = board(SOME);
  const next = nextOnPath(b.paths, 'new_best');
  assert.equal(next.kind, 'also');
  assert.notEqual(next.step.id, 'new_best');
  assert.equal(next.step.status, 'next');
});

test('the last badge of a path has no next one', () => {
  const all = Object.fromEntries(BADGE_STEPS.map((s) => [s.id, earnedAt(DAY)]));
  const b = board(all);
  assert.equal(nextOnPath(b.paths, 'repairs_25'), null);
  const d = detailOf(b.paths, 'repairs_25', { zone: 'Asia/Kolkata' });
  assert.equal(d.next, null);
  assert.equal(d.pathDone, true);
});

test('an earned badge says when, and names the paper it came from with the way to open it', () => {
  const b = board(SOME);
  const d = detailOf(b.paths, 'new_best', { entries: countEntries(b.progress), records: b.records, zone: 'Asia/Kolkata' });
  assert.equal(d.earned, true);
  assert.match(d.earnedLine, /^Earned [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/);
  assert.equal(d.paper.attemptId, 'fm2');
  assert.match(d.paper.from, /^From Accountancy full mock, [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/);
  assert.equal(d.paper.marks, '165 of 250 marks, 126 before');
  assert.equal(d.soFar, '');
});

test('a badge with no paper on record shows no paper line (no source is made up)', () => {
  const b = board(SOME);
  const d = detailOf(b.paths, 'first_repair', { entries: countEntries(b.progress), records: b.records, zone: 'Asia/Kolkata' });
  assert.equal(d.paper, null);
  assert.equal(paperLine(null, 'Asia/Kolkata'), null);
  assert.equal(paperLine({ subject: 'accountancy', mode: 'full', at: 1 }, 'Asia/Kolkata'), null);
});

test('a badge not earned shows its condition, its count so far with the denominator, and the action', () => {
  const b = board(SOME);
  const d = detailOf(b.paths, 'full_mocks_5', { entries: countEntries(b.progress), records: b.records, zone: 'Asia/Kolkata' });
  assert.equal(d.earned, false);
  assert.equal(d.condition, 'Lands with your 5th scored full mock or NTA paper.');
  assert.equal(d.soFar, '3 of 5 full mocks');
  assert.deepEqual(d.action, { label: 'Choose practice', href: '/dashboard' });
  assert.equal(d.earnedLine, '');
});

test('with no exact count the sheet says it is not earned yet, never "0 of" something', () => {
  const b = board(SOME);
  const d = detailOf(b.paths, 'first_hold', { entries: countEntries(b.progress), records: b.records, zone: 'Asia/Kolkata' });
  assert.equal(d.soFar, 'Not earned yet');
  assert.doesNotMatch(JSON.stringify(d), /0 of/);
});

test('a badge the server could not read says so and is not called not earned', () => {
  const b = board({ ...SOME }, { unavailable: ['first_hold'] });
  const d = detailOf(b.paths, 'first_hold', { entries: countEntries(b.progress), records: b.records, zone: 'Asia/Kolkata' });
  assert.equal(d.unknown, true);
  assert.equal(d.unknownLine, 'This one could not be checked just now.');
  assert.equal(d.soFar, '');
});

test('an earned badge that is proven but undated says so, with no made-up date', () => {
  const paths = board({ first_scored_session: earnedAt(5 * DAY) }).paths;
  const run = paths.find((p) => p.id === 'rhythm').steps.find((s) => s.id === 'run_weeks_3');
  run.status = 'earned'; run.earnedAt = null; run.undated = true;
  assert.equal(detailOf(paths, 'run_weeks_3', {}).earnedLine, 'Earned. The date is not recorded yet.');
});

test('every path has an action key, including the weeks path', () => {
  assert.equal(actionFor('papers').label, 'Choose practice');
  assert.equal(actionFor('repairs').label, 'Open your mistakes');
  assert.equal(actionFor('best').label, 'Choose practice');
  assert.deepEqual(actionFor('rhythm'), { label: 'Choose practice', href: '/dashboard' });
});

// ---------------------------------------------------------------------------------------------
// The earned moment

const ATTEMPT = { id: 'att-1', completedAt: iso(30 * 60 * 1000) };

test('a badge dated at this paper is earned by it; one dated far from it is not', () => {
  const at = Date.parse(ATTEMPT.completedAt);
  const b = board({
    first_scored_session: earnedAt(NOW - at),
    first_week_met: { earned: true, earnedAt: new Date(at + 60 * 1000).toISOString(), progress: { current: 1, target: 1 } },
    first_full_mock: earnedAt(10 * DAY),
  });
  const got = earnedByAttempt(b.paths, b.records, ATTEMPT, NOW).map((s) => s.id);
  assert.deepEqual(got.sort(), ['first_scored_session', 'first_week_met']);
});

test('a record that names the paper ties the badge to it', () => {
  const at = Date.parse(ATTEMPT.completedAt);
  const b = board({ new_best: { earned: true, earnedAt: new Date(at).toISOString(), progress: { current: 1, target: 1 }, record: { attemptId: 'att-1', subject: 'accountancy', mode: 'full', correct: 30, wrong: 5, total: 50, marks: 145, maxMarks: 250, before: 120 } } });
  assert.deepEqual(earnedByAttempt(b.paths, b.records, ATTEMPT, NOW).map((s) => s.id), ['new_best']);
  // The same badge, another paper's record: not this result's.
  const other = board({ new_best: { earned: true, earnedAt: new Date(at - 5 * DAY).toISOString(), progress: { current: 1, target: 1 }, record: { attemptId: 'older', subject: 'accountancy', mode: 'full', correct: 30, wrong: 5, total: 50, marks: 145, maxMarks: 250 } } });
  assert.deepEqual(earnedByAttempt(other.paths, other.records, ATTEMPT, NOW), []);
});

test('a repair is dated by the repair, not the set: only a record could tie it to a paper', () => {
  const at = Date.parse(ATTEMPT.completedAt);
  const b = board({ first_repair: { earned: true, earnedAt: new Date(at + 30 * 1000).toISOString(), progress: { current: 1, target: 1 } } });
  assert.deepEqual(earnedByAttempt(b.paths, b.records, ATTEMPT, NOW), []);
});

test('the window is two minutes either way, and the moment passes after three days', () => {
  assert.equal(MATCH_MS, 120000);
  const at = Date.parse(ATTEMPT.completedAt);
  const edge = board({ first_scored_session: { earned: true, earnedAt: new Date(at + MATCH_MS).toISOString(), progress: { current: 1, target: 1 } } });
  assert.equal(earnedByAttempt(edge.paths, edge.records, ATTEMPT, NOW).length, 1);
  const past = board({ first_scored_session: { earned: true, earnedAt: new Date(at + MATCH_MS + 1).toISOString(), progress: { current: 1, target: 1 } } });
  assert.equal(earnedByAttempt(past.paths, past.records, ATTEMPT, NOW).length, 0);
  const old = { id: 'old', completedAt: new Date(NOW - RECENT_MS - 1000).toISOString() };
  const oldBoard = board({ first_scored_session: { earned: true, earnedAt: old.completedAt, progress: { current: 1, target: 1 } } });
  assert.equal(earnedByAttempt(oldBoard.paths, oldBoard.records, old, NOW).length, 0);
});

test('nothing unearned or undated is ever announced', () => {
  const b = board({ first_scored_session: {} });
  assert.deepEqual(earnedByAttempt(b.paths, b.records, ATTEMPT, NOW), []);
  assert.deepEqual(earnedByAttempt(b.paths, b.records, { completedAt: ATTEMPT.completedAt }, NOW), []);
});

function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, dump: () => Object.fromEntries(m) };
}

test('each badge is shown once: the seen key holds the date it was seen with', () => {
  const at = Date.parse(ATTEMPT.completedAt);
  const b = board({ first_scored_session: earnedAt(NOW - at), first_full_mock: earnedAt(NOW - at) });
  const steps = earnedByAttempt(b.paths, b.records, ATTEMPT, NOW);
  assert.equal(steps.length, 2);
  const store = memoryStorage();
  assert.equal(unseen(store, steps).length, 2);
  markSeen(store, steps);
  assert.equal(store.getItem(`${SEEN_PREFIX}first_scored_session`), String(steps[0].earnedAt));
  assert.equal(unseen(store, steps).length, 0);
  assert.equal(isSeen(store, steps[0]), true);
});

test('a badge is shown again only if the server dates it differently', () => {
  const step = { id: 'new_best', earnedAt: 1000 };
  const store = memoryStorage({ [`${SEEN_PREFIX}new_best`]: '1000' });
  assert.equal(isSeen(store, step), true);
  assert.equal(isSeen(store, { ...step, earnedAt: 2000 }), false);
});

test('a blocked or missing storage never throws', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const steps = [{ id: 'new_best', earnedAt: 1 }];
  assert.equal(isSeen(blocked, steps[0]), false);
  assert.doesNotThrow(() => markSeen(blocked, steps));
  assert.equal(unseen(null, steps).length, 1);
});

test('one badge says "Badge earned" and its name; two say "2 badges earned" in one row', () => {
  assert.deepEqual(momentWords([{ name: 'First full mock' }]), { title: 'Badge earned', detail: 'First full mock', count: 1 });
  assert.deepEqual(momentWords([{ name: 'First scored set' }, { name: 'First full mock' }]), { title: '2 badges earned', detail: 'First scored set and First full mock', count: 2 });
  assert.equal(momentWords([{ name: 'a' }, { name: 'b' }, { name: 'c' }]).title, '3 badges earned');
  assert.equal(momentWords([]), null);
});

// ---------------------------------------------------------------------------------------------
// Where it lives (BADGES-REFINE-1018 acceptance, held in the source)

test('the badges are a section of Progress, not part of the week card', () => {
  const card = read('src/components/RhythmCard.jsx');
  assert.doesNotMatch(card, /import StudyBadges/);
  assert.doesNotMatch(card, /<StudyBadges/);
  const overview = read('src/components/RecoveryOverview.jsx');
  assert.match(overview, /import StudyBadges from '\.\/StudyBadges'/);
  assert.match(overview, /<StudyBadges /);
  // After the record, before the concept checks.
  assert.ok(overview.indexOf('id="ov-record"') < overview.indexOf('<StudyBadges '));
  assert.ok(overview.indexOf('<StudyBadges ') < overview.indexOf('id="ov-checks"'));
});

test('the shelf, the sheet and the earned row exist, and the result shows the row near the top', () => {
  const badges = read('src/components/StudyBadges.jsx');
  assert.match(badges, /headLine\(/);
  assert.match(badges, /earnedShelf\(/);
  assert.match(badges, /pickNext\(/);
  assert.match(badges, /All badges/);
  assert.match(read('src/components/BadgeDetail.jsx'), /Open that paper/);
  const result = read('src/app/(app)/result/[id]/ResultPageClient.jsx');
  assert.match(result, /<EarnedBadges /);
  assert.ok(result.indexOf('<ResultHero') < result.indexOf('<EarnedBadges '));
  assert.ok(result.indexOf('<EarnedBadges ') < result.indexOf('id="srl-title"'));
});

test('the earned row is never a modal and its motion is the specified one', () => {
  const row = read('src/components/EarnedBadges.jsx');
  assert.doesNotMatch(row, /role="dialog"|aria-modal|showModal/);
  const css = read('src/components/study-badges.css');
  assert.match(css, /600ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(css, /scale\(0\.85\)/);
  assert.match(css, /150ms/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('Progress rows carry their status as quiet text, not as pills', () => {
  const overview = read('src/components/RecoveryOverview.jsx');
  assert.doesNotMatch(overview, /pr-badge/);
  const css = read('src/components/recovery/overview.css');
  assert.match(css, /rv-session__state\[data-tone='open'\] \{ color: var\(--a-warn-text\)/);
  assert.match(css, /rv-session__state\[data-tone='clear'\] \{ color: var\(--a-ink-2\)/);
});
