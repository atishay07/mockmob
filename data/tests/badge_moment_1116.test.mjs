// Lane "badges" (16 Nov 2026): the badge family's drawing (src/lib/badgeArt.js) and what earning one says and when it is owed
// a moment (src/lib/badgeMoment.js). Pure modules; the components that draw them are held by the source checks at the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BADGE_PATHS, BADGE_STEPS, badgePathsFromApi, countEntries } from '../../src/lib/studyBadges.js';
import { MARKS, SHAPES, artFor, drawnState, scallopPath, textSize } from '../../src/lib/badgeArt.js';
import {
  NEEDS, PAPER_KEY, earnedSentence, freshEarned, markPaperLooked, mayBeOwed, momentOf, nextLine, shareFact, shareFileName, shareLine,
} from '../../src/lib/badgeMoment.js';
import { RECENT_MS, SEEN_PREFIX, dayYear, detailOf, markSeen } from '../../src/lib/badgeShelf.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-11-16T10:00:00.000Z');
const HOUR = 3600000;
const DAY = 24 * HOUR;
const iso = (back) => new Date(NOW - back).toISOString();
const apiBadge = (step, extra = {}) => ({ id: step.id, path: step.path, name: step.name, condition: step.condition, earned: false, earnedAt: null, progress: { current: 0, target: 1 }, record: null, ...extra });
const body = (map = {}, rest = {}) => ({ version: 1, total: 16, bestRunEndedWeek: null, unavailable: [], badges: BADGE_STEPS.map((s) => apiBadge(s, map[s.id] || {})), ...rest });
const earnedAt = (back, extra = {}) => ({ earned: true, earnedAt: iso(back), progress: { current: 1, target: 1 }, ...extra });
const board = (map, rest) => badgePathsFromApi(body(map, rest));
function memoryStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

// ---------------------------------------------------------------------------------------------
// The drawing

test('every one of the sixteen has a mark, and each path has its own silhouette', () => {
  for (const s of BADGE_STEPS) {
    const art = artFor(s.id);
    assert.ok(art, s.id);
    assert.equal(art.path, s.path, `${s.id} is drawn on its own path's silhouette`);
    assert.ok(art.text || art.glyph, `${s.id} has a sign`);
  }
  assert.deepEqual(Object.keys(MARKS).sort(), BADGE_STEPS.map((s) => s.id).sort());
  assert.deepEqual(Object.keys(SHAPES).sort(), BADGE_PATHS.map((p) => p.id).sort());
  const outlines = new Set(Object.values(SHAPES).map((s) => s.outline));
  assert.equal(outlines.size, 4, 'four different silhouettes: the paths are told apart by shape, not colour alone');
  assert.equal(artFor('not_a_badge'), null);
});

test('within a path no two badges share a sign', () => {
  for (const path of BADGE_PATHS) {
    const signs = BADGE_STEPS.filter((s) => s.path === path.id).map((s) => JSON.stringify(MARKS[s.id]));
    assert.equal(new Set(signs).size, signs.length, path.id);
  }
});

test('the marks stay inside their 64 unit box and the seal is a closed scalloped ring', () => {
  for (const shape of Object.values(SHAPES)) {
    const nums = shape.outline.match(/-?\d+(\.\d+)?/g).map(Number);
    for (const n of nums) assert.ok(n >= 0 && n <= 64, `${n} in ${shape.outline.slice(0, 30)}`);
  }
  const seal = scallopPath();
  assert.match(seal, /^M32 5\.8/);
  assert.equal((seal.match(/A/g) || []).length, 16);
  assert.match(seal, /Z$/);
  assert.equal(textSize('5'), 26);
  assert.equal(textSize('25'), 21);
});

test('three drawn states, and a badge the server could not read is drawn blind, never as next', () => {
  assert.equal(drawnState('earned'), 'earned');
  assert.equal(drawnState('next'), 'next');
  assert.equal(drawnState('later'), 'later');
  assert.equal(drawnState('unknown'), 'later');
});

// ---------------------------------------------------------------------------------------------
// The words

test('what each badge needs is plain words for every badge, with no lock, flame or cheer', () => {
  for (const s of BADGE_STEPS) {
    assert.ok(NEEDS[s.id], s.id);
    assert.doesNotMatch(NEEDS[s.id], /!|lock|unlock|streak|flame|fire|awesome|great job|congrat/i);
    assert.ok(NEEDS[s.id].length <= 70, `${s.id} is short`);
  }
});

test('the earned sentence names the paper only when the server record names it', () => {
  const rec = { attemptId: 'a1', subject: 'accountancy', mode: 'full', marks: 165, max: 250, before: 126 };
  assert.equal(earnedSentence('new_best', rec), '165 of 250 marks on your Accountancy full mock. Your best before was 126.');
  assert.equal(earnedSentence('clean_set', { attemptId: 'a2', subject: 'economics', mode: 'quick', marks: 50, max: 50 }), 'Every answer right: 10 of 10 in your Economics practice set.');
  assert.equal(earnedSentence('first_nta', { attemptId: 'a3', subject: 'business_studies', mode: 'nta', marks: 144, max: 250 }), 'You finished your first paper in NTA mode: Business Studies, 144 of 250 marks.');
  assert.equal(earnedSentence('full_mocks_5', { attemptId: 'a4', subject: 'accountancy', mode: 'full', marks: 150, max: 250 }), 'Your Accountancy full mock was your 5th full mock or NTA paper.');
  assert.equal(earnedSentence('four_subjects', { attemptId: 'a5', subject: 'english', mode: 'quick', marks: 41, max: 100 }), 'Your English practice set made it 4 subjects.');
  // No record: the badge's own fact, never a made-up paper.
  assert.equal(earnedSentence('new_best', null), 'You beat your own marks on the same kind of mock.');
  assert.equal(earnedSentence('new_best', { subject: 'accountancy' }), 'You beat your own marks on the same kind of mock.');
  assert.equal(earnedSentence('repairs_5'), 'You have finished 5 repairs.');
  for (const s of BADGE_STEPS) {
    const line = earnedSentence(s.id);
    assert.ok(line, s.id);
    assert.doesNotMatch(line, /!|rank|percentile|top \d|better than|students/i);
  }
});

test('what the next badge on the path needs: the exact count where there is one, the plain need where there is not', () => {
  const b = board({
    first_repair: earnedAt(20 * DAY), repairs_5: earnedAt(HOUR),
    repairs_10: { progress: { current: 5, target: 10 } }, repairs_25: { progress: { current: 5, target: 25 } },
    first_scored_session: earnedAt(30 * DAY),
    new_best: earnedAt(DAY), four_subjects: { progress: { current: 3, target: 4 } },
  });
  const entries = countEntries(b.progress);
  assert.equal(nextLine(b.paths, 'repairs_5', entries), 'Next: 10 repairs. 5 more repairs.');
  assert.equal(nextLine(b.paths, 'first_scored_session', entries), 'Next: First full mock. Finish a 50-question full mock.');
  // Your best work is not a sequence.
  assert.match(nextLine(b.paths, 'new_best', entries), /^Also to earn: (Clean set|Four subjects)\./);
  const all = board(Object.fromEntries(BADGE_STEPS.map((s) => [s.id, earnedAt(DAY)])));
  assert.equal(nextLine(all.paths, 'repairs_25', {}), 'You have every badge on this path.');
});

test('a moment says the name, the true sentence and the next need, and only for an earned badge', () => {
  const b = board({ repairs_5: earnedAt(HOUR), first_repair: earnedAt(DAY), repairs_10: { progress: { current: 5, target: 10 } } });
  const m = momentOf(b.paths, b.records, 'repairs_5', countEntries(b.progress));
  assert.deepEqual({ name: m.name, pathTitle: m.pathTitle, sentence: m.sentence, next: m.next }, { name: '5 repairs', pathTitle: 'Repairs', sentence: 'You have finished 5 repairs.', next: 'Next: 10 repairs. 5 more repairs.' });
  assert.equal(momentOf(b.paths, b.records, 'repairs_10', {}), null);
  assert.equal(momentOf(b.paths, b.records, 'nope', {}), null);
});

test('the share line and picture say the badge and the day, nothing about anyone else', () => {
  const line = shareLine({ id: 'repairs_5', name: '5 repairs' }, '16 Nov 2026');
  assert.equal(line, '5 repairs: a badge I earned on MockMob, 16 Nov 2026. For 5 repaired mistakes.');
  for (const s of BADGE_STEPS) {
    assert.ok(shareFact(s.id), s.id);
    assert.doesNotMatch(shareLine(s, '1 Jan 2027'), /rank|percentile|top|best in|students|!|#/i);
  }
  assert.equal(shareFileName({ name: '5 repairs' }), 'mockmob-badge-5-repairs.png');
  assert.equal(shareFileName({ name: 'Exam-day rehearsal' }), 'mockmob-badge-exam-day-rehearsal.png');
  assert.equal(dayYear(Date.parse('2026-11-16T20:00:00.000Z'), 'Asia/Kolkata'), '17 Nov 2026');
});

test('the badge sheet carries the count share for the mark edge and the day for the share picture', () => {
  const b = board({ first_scored_session: earnedAt(2 * DAY), sessions_10: { progress: { current: 7, target: 10 } }, full_mocks_5: { progress: { current: 0, target: 5 } } });
  const entries = countEntries(b.progress);
  assert.equal(detailOf(b.paths, 'sessions_10', { entries, zone: 'Asia/Kolkata' }).fraction, 0.7);
  assert.equal(detailOf(b.paths, 'full_mocks_5', { entries, zone: 'Asia/Kolkata' }).fraction, null, 'no edge drawn on a zero');
  assert.match(detailOf(b.paths, 'first_scored_session', { entries, zone: 'Asia/Kolkata' }).shortDate, /^\d{1,2} [A-Z][a-z]{2} 2026$/);
  assert.equal(detailOf(b.paths, 'sessions_10', { entries, zone: 'Asia/Kolkata' }).shortDate, '');
});

// ---------------------------------------------------------------------------------------------
// When a moment is owed

test('fresh: earned with a real date in the last three days and not seen here, oldest first', () => {
  const b = board({ repairs_5: earnedAt(2 * HOUR), first_week_met: earnedAt(26 * HOUR), first_repair: earnedAt(4 * DAY), new_best: earnedAt(RECENT_MS + 1000) });
  const store = memoryStorage();
  assert.deepEqual(freshEarned(b.paths, NOW, store).map((s) => s.id), ['first_week_met', 'repairs_5']);
  markSeen(store, freshEarned(b.paths, NOW, store));
  assert.deepEqual(freshEarned(b.paths, NOW, store), [], 'seen once, never replayed');
  assert.deepEqual(freshEarned(b.paths, NaN, memoryStorage()), []);
  // A badge the server lists unearned, or one proven but undated, is never announced.
  const undated = board({});
  const run = undated.paths.find((p) => p.id === 'rhythm').steps.find((s) => s.id === 'run_weeks_3');
  run.status = 'earned'; run.earnedAt = null; run.undated = true;
  assert.deepEqual(freshEarned(undated.paths, NOW, memoryStorage()), []);
});

test('Today asks the server only when a badge may be waiting on this device', () => {
  const store = memoryStorage();
  // Nothing recent: no read.
  assert.equal(mayBeOwed({ milestones: [{ id: 'first_repair', achievedAt: iso(9 * DAY) }], papers: [{ id: 'p1', completedAt: iso(8 * DAY) }], now: NOW, storage: store }), false);
  // A recent milestone not seen here: a read.
  assert.equal(mayBeOwed({ milestones: [{ id: 'repairs_5', achievedAt: iso(2 * HOUR) }], papers: [], now: NOW, storage: store }), true);
  // The same milestone, seen here with that date: no read.
  const seen = memoryStorage({ [`${SEEN_PREFIX}repairs_5`]: String(NOW - 2 * HOUR) });
  assert.equal(mayBeOwed({ milestones: [{ id: 'repairs_5', achievedAt: iso(2 * HOUR) }], papers: [], now: NOW, storage: seen }), false);
  // A recent paper whose result did not look here: a read; once its result looked, no read.
  assert.equal(mayBeOwed({ milestones: [], papers: [{ id: 'old', completedAt: iso(5 * DAY) }, { id: 'p9', completedAt: iso(HOUR) }], now: NOW, storage: store }), true);
  markPaperLooked(store, 'p9');
  assert.equal(store.getItem(PAPER_KEY), 'p9');
  assert.equal(mayBeOwed({ milestones: [], papers: [{ id: 'p9', completedAt: iso(HOUR) }], now: NOW, storage: store }), false);
  // A blocked storage never throws: it only means one more read.
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(mayBeOwed({ milestones: [], papers: [{ id: 'p9', completedAt: iso(HOUR) }], now: NOW, storage: blocked }), true);
  assert.doesNotThrow(() => markPaperLooked(blocked, 'p9'));
  assert.equal(mayBeOwed({ now: NaN }), false);
});

// ---------------------------------------------------------------------------------------------
// Where it lives (held in the source)

test('the moment is part of the page: never a modal, Close puts it away, the result mount is unchanged, Today mounts it under the lead', () => {
  const moment = read('src/components/BadgeMoment.jsx');
  assert.doesNotMatch(moment, /role="dialog"|aria-modal|showModal|createPortal/);
  assert.match(moment, /aria-label="Close"/);
  assert.match(moment, /api\('\/api\/me\/badges'\)/, 'Today reads the server list before anything is shown');
  assert.match(moment, /mayBeOwed\(/);
  const earned = read('src/components/EarnedBadges.jsx');
  assert.match(earned, /api\('\/api\/me\/badges', \{ cache: 'no-cache' \}\)/);
  assert.match(earned, /earnedByAttempt\(/);
  // The late-paper guard on the result page stays exactly as it was.
  assert.match(read('src/app/(app)/result/[id]/ResultPageClient.jsx'), /\{lateLine \? null : <EarnedBadges attempt=\{attempt\} \/>\}/);
  const today = read('src/app/(app)/today/page.jsx');
  assert.match(today, /<TodayBadgeMoment rhythm=\{data\.rhythm\} papers=\{data\.papers\} hold=\{landing\} \/>/);
  assert.ok(today.indexOf('<TodayMove') < today.indexOf('<TodayBadgeMoment'), 'under the lead card, so its key stays first');
  // Nothing in the Mob shows a badge (F2 is untouched).
  for (const f of ['src/components/mob/den/DenV3.jsx', 'src/components/mob/den/DenMoments.jsx']) assert.doesNotMatch(read(f), /BadgeMoment|BadgeStamp|EarnedBadges/);
});

test('the share key sits only on an earned badge, and the picture stays under 300 KB', () => {
  const detail = read('src/components/BadgeDetail.jsx');
  assert.match(detail, /\{d\.earned \? <ShareBadge detail=\{d\} \/> : null\}/);
  assert.match(detail, /error\?\.name === 'AbortError'/, 'closing the share sheet is not an error');
  const share = read('src/components/badgeShare.js').replace(/\/\/.*$/gm, '');
  assert.match(share, /export const MAX_BYTES = 300 \* 1024;/);
  assert.match(share, /png\.size <= MAX_BYTES/);
  assert.doesNotMatch(share, /rank|percentile/i);
});
