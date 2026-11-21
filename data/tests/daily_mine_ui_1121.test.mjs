// "Your five" on /daily, the page half (lane daily-ui, 21 Nov 2026; spec tmp/1121-stories/DAILY-SPEC.md, contract
// tmp/1121-stories/daily/CONTRACT.md). The pure helpers (src/components/daily/dailyMineUi.mjs) and the page's wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DAILY_MINE_STORE, didLines, fedOf, keepFed, markFor, nextStep, noteFor, practiceHref, readMark, REVISE_HREF, PRACTICE_COUNT,
} from '../../src/components/daily/dailyMineUi.mjs';
import { MINE_COPY, acceptMine, mineLabel } from '../../src/lib/dailyFiveMine.mjs';
import { SUBJECT_PAGES } from '../../src/lib/subjectPages.mjs';
import { beginRun, clearPendingAnswer, dateOfDay, keepAnswer, keepCheck, readRecord } from '../../src/lib/dailyFive.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const DATE = '2026-11-21';
const USER = 'u-1';

test('a replaced question clears only the pending pick before the page reloads the five', () => {
  const begun = beginRun(readRecord(null), { date: DATE, startedAt: 0 });
  const checked = keepCheck(begun, { date: DATE, index: 0, check: { pick: 0, right: true, correct: 0 } });
  const pending = keepAnswer(checked, { date: DATE, index: 1, pick: 2 });
  assert.equal(clearPendingAnswer(pending, { date: DATE, index: 0 }), pending);
  const cleared = clearPendingAnswer(pending, { date: DATE, index: 1 });
  assert.deepEqual(cleared.run.picks, [0, null, null, null, null]);
  assert.deepEqual(cleared.run.checks, checked.run.checks);
  const page = read('src/components/daily/DailyFive.jsx');
  assert.match(page, /conflict\?\.error === 'changed'[^]*?clearPendingAnswer[^]*?setChecking\('idle'\)[^]*?load\(\)/);
});

test('the device note: one day, one student; the first fed of a place stands', () => {
  const mark = markFor({ date: DATE, userId: USER, personal: true });
  assert.deepEqual(mark, { v: 1, date: DATE, user: USER, personal: true, fed: {} });
  const raw = JSON.stringify(keepFed(keepFed(mark, 1, 'fixed'), 2, 'mistakes'));
  assert.deepEqual(readMark(raw, { date: DATE, userId: USER }).fed, { 1: 'fixed', 2: 'mistakes' });
  assert.equal(readMark(raw, { date: '2026-11-22', userId: USER }), null, 'another day');
  assert.equal(readMark(raw, { date: DATE, userId: 'u-2' }), null, 'another account');
  assert.equal(readMark('not json', { date: DATE, userId: USER }), null);
  const held = keepFed(mark, 3, 'mistakes');
  assert.equal(keepFed(held, 3, null), held, 'a retry answers null and changes nothing');
  assert.deepEqual(keepFed(mark, 4, 'weird').fed, { 4: null });
  assert.equal(keepFed(mark, 6, 'fixed'), mark, 'only places 1 to 5');
  assert.deepEqual(markFor({ date: DATE, userId: USER, personal: true }, held).fed, { 3: 'mistakes' }, 'a fresh note keeps the day');
  assert.equal(fedOf({ fed: 'fixed' }), 'fixed');
  assert.equal(fedOf({ fed: 'nope' }), null);
  assert.equal(fedOf(null), null);
  assert.equal(DAILY_MINE_STORE, 'mm:daily-mine:v1');
});

test('what today’s five did: only what fed holds, one honest line when nothing was fed', () => {
  const mark = (fed) => ({ v: 1, date: DATE, user: USER, personal: true, fed });
  assert.deepEqual(didLines(mark({ 1: 'fixed', 2: 'mistakes', 3: null, 4: null, 5: null })).lines, ['1 mistake fixed', '1 sent back to your mistakes']);
  assert.deepEqual(didLines(mark({ 1: null, 2: null, 3: null, 4: null, 5: null })).lines, ['Nothing sent back to your mistakes.']);
  // A reload lost places 4 and 5: nothing is claimed about them.
  assert.deepEqual(didLines(mark({ 1: null, 2: null, 3: null })).lines, []);
  assert.equal(didLines(mark({ 1: 'mistakes', 2: 'mistakes' })).counts.sent, 2);
  assert.deepEqual(didLines(null).lines, []);
});

const Q = (slug, chapter, kind) => ({ slug, chapter, why: { kind, subject: 'X', chapter } });

test('one next step: Revise while something is open, else ten more on the weak chapter', () => {
  const five = [Q('economics', 'National Income Accounting', 'missed'), Q('accountancy', 'Accounting Ratios', 'missed'), Q('business-studies', 'Principles of Management', 'weak'), Q('accountancy', 'Admission of a Partner', 'weak'), Q('economics', 'Non-Competitive Markets', 'subject')];
  const revise = nextStep({ counts: { fixed: 1, sent: 1 }, marks: [true, false, true, true, true], questions: five });
  assert.equal(revise.kind, 'revise');
  assert.equal(revise.href, REVISE_HREF);
  assert.equal(revise.href, '/review/revise');
  // fed lost to a reload, but a miss is on the board: still Revise.
  assert.equal(nextStep({ counts: { fixed: 0, sent: 0 }, marks: [true, false, true, true, true], questions: five }).kind, 'revise');
  const more = nextStep({ counts: { fixed: 1, sent: 0 }, marks: [true, true, true, true, true], questions: five });
  assert.equal(more.kind, 'practice');
  assert.equal(more.label, `Practise ${PRACTICE_COUNT} on Principles of Management`);
  assert.equal(more.href, '/dashboard?subject=business_studies&chapter=Principles+of+Management&mode=quick&count=10');
  assert.equal(PRACTICE_COUNT, 10);
  // No weak place: the first place's chapter.
  assert.equal(nextStep({ counts: {}, marks: [true, true, true, true, true], questions: [Q('economics', 'Money and Banking', 'subject')] }).label, 'Practise 10 on Money and Banking');
});

test('practiceHref links with the id Practice uses for every subject page (subjectPages.mjs publicId)', () => {
  for (const page of SUBJECT_PAGES) {
    const href = practiceHref(page.slug, 'Some chapter');
    assert.equal(new URLSearchParams(href.split('?')[1]).get('subject'), page.publicId, page.slug);
  }
  assert.equal(practiceHref('Not a slug!', 'x'), '/dashboard?mode=quick&count=10');
});

test('the line under the rules, by who is looking; plain words only', () => {
  assert.equal(noteFor({ signedIn: false, mine: null }), MINE_COPY.guest);
  assert.equal(noteFor({ signedIn: false, mine: null }), 'Sign up and your five come from your own subjects and mistakes.');
  assert.equal(noteFor({ signedIn: true, mine: null }), null, 'not known yet: the room is held');
  const lines = [
    noteFor({ signedIn: true, mine: { personal: true, mix: { missed: 2, weak: 2, subject: 1 } } }),
    ...['no_subjects', 'shared_started', 'thin_bank', 'off', 'unavailable'].map((reason) => noteFor({ signedIn: true, mine: { personal: false, reason } })),
  ];
  for (const line of lines) {
    assert.ok(line && line.length <= 90, line);
    assert.doesNotMatch(line, /[—–!]|[\u{1F300}-\u{1FAFF}]/u, line);
  }
  assert.match(lines[0], /comes back in a later five/);
});

test('the page plays a student’s own five, falls back quietly, and never swaps a five begun on the device', () => {
  const src = read('src/components/daily/DailyFive.jsx');
  assert.match(src, /import \{ DAILY_MINE_ROUTE, acceptMine, mineLabel, mixLine as mineMix \} from '@\/lib\/dailyFiveMine\.mjs';/);
  // The shared five are asked at once, as before; the student's own only once the account is known, and only signed in.
  const load = src.slice(src.indexOf('const load = useCallback'), src.indexOf('}, [applyAccount, authSettled]);'));
  assert.ok(load.indexOf('fetch(dailyFiveUrl(local.day)') < load.indexOf('await authSettled()'), 'the shared five first');
  assert.match(load, /if \(uid\) \{/);
  assert.match(load, /const got = await askMine\(controller\.signal\);/);
  assert.match(load, /if \(begun && !held\?\.personal\) chose = \{ personal: false, reason: 'shared_started' \};/);
  assert.match(load, /if \(chose\?\.personal && !own\) throw new Error\('mine_lost'\);/);
  assert.match(load, /const accepted = own \|\| await shared;/);
  assert.match(src, /cache: 'no-store'/);
  assert.match(src, /const MINE_MS = 5000;/);
  // The reason above the stem; the day's end only for a student's own five; one next-step key there.
  assert.ok(src.indexOf('<DailyWhy key=') < src.indexOf('<p key={index} className="mm-drill__q"'));
  assert.match(src, /\{personalResult \? <DailyEnd userId=\{userId\} live=\{justFinished\}/);
  assert.match(src, /\{status === 'loading' \|\| personalResult \? null : isAuthenticated/);
  // After a student's own five, Share is a quiet text link under the one next-step key, never a second big key (21 Nov critic).
  assert.match(src, /className=\{personalResult \? 'dly__share-link' : 'mm-btn mm-btn--primary'\}/);
  // The note holds its room in the loading card and the start card.
  const loading = src.slice(src.indexOf('// ---------- Loading and failed ----------'), src.indexOf('// ---------- Start ----------'));
  const start = src.slice(src.indexOf('// ---------- Start ----------'), src.indexOf('// ---------- Playing ----------'));
  assert.ok(loading.includes('{noteLine}') && start.includes('{noteLine}'));
  // Every check's fed is kept for a student's own five.
  assert.match(src, /keepFed\(held, at \+ 1, fedOf\(raw\)\)/);
});

test('the day’s end: the streak parts, the step from the figure read when the five began, one key', () => {
  const end = read('src/components/daily/DailyEnd.jsx');
  assert.match(end, /import \{ StreakMobi, StreakTick \} from '@\/components\/streak\/Streak';/);
  assert.match(end, /import \{ useStreak \} from '@\/components\/streak\/useStreak';/);
  assert.match(end, /<StreakLine days=\{streakWeek\(body\)\} progress=\{todayProgress\(body\)\} fresh=\{stepping\}/);
  assert.equal((end.match(/<Link /g) || []).length, 1, 'one next-step key');
  assert.match(end, /\{MINE_COPY\.doneHead\}/);
  const page = read('src/components/daily/DailyFive.jsx');
  assert.match(page, /if \(phase === 'playing' && personalNow\) loadStreak\(userId\);/);
  const css = read('src/components/daily/daily-mine.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /html\[data-motion='reduced'\]/);
  for (const sel of css.match(/^[^@/\s{}][^{]*\{/gm) || []) assert.match(sel, /^(\.mm\.lp|html\[data-motion='reduced'\] \.mm\.lp|@keyframes|from|to|\d+%)/, sel);
});

test('the preview fixture’s own five read as a personal five (the server’s shape)', () => {
  const src = read('src/app/preview/arena/previewDaily.js');
  for (const state of ['mine', 'two', 'done', 'shared', 'fail']) assert.ok(src.includes(`  ${state}`) || src.includes(`'${state}'`), state);
  // Rebuild the fixture body's shape from its source rows (the module itself imports through '@/').
  const day = 7;
  const body = {
    ok: true, personal: true, day, date: dateOfDay(day), mix: { missed: 2, weak: 2, subject: 1 },
    questions: [
      ['accountancy', 'Accountancy', 'Accounting Ratios', 'missed'], ['economics', 'Economics', 'National Income Accounting', 'missed'],
      ['accountancy', 'Accountancy', 'Admission of a Partner', 'weak'], ['business-studies', 'Business Studies', 'Principles of Management', 'weak'],
      ['economics', 'Economics', 'Non-Competitive Markets', 'subject'],
    ].map(([subject, name, chapter, kind], i) => {
      assert.ok(src.includes(`subject: '${subject}', name: '${name}', chapter: '${chapter}', kind: '${kind}'`), chapter);
      return { subject, q: `Q${i}?`, options: ['a', 'b', 'c', 'd'], chapter, token: `d1.pmine-${day}-${i + 1}.fixture-token-not-a-seal`, why: { kind, subject: name, chapter, ...(kind === 'missed' ? { since: '2026-11-14' } : {}) } };
    }),
  };
  const got = acceptMine(body);
  assert.equal(got.personal, true);
  assert.deepEqual(got.mix, { missed: 2, weak: 2, subject: 1 });
  assert.equal(mineLabel(got.questions[0].why), 'You missed this on 14 Nov');
  assert.equal(mineLabel(got.questions[3].why), 'Your weak chapter: Principles of Management');
  assert.equal(mineLabel(got.questions[4].why), 'New from Economics');
});
