// IA5: Practice (src/app/(app)/dashboard, explore, learn, CreditsRemainingModal).
// The prefill contract is byte-for-byte the old page's; every cost comes from plan_facts; the copy follows the
// glossary; and a tap before Start never spends or starts anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRACTICE_PATH, SESSION_LABEL, SESSION_ORDER, asideTitle, chaptersSummary, confirmText, effectiveCount, fineTuneHint, includedToday,
  launchHref, lengthNote, lockLine, lockedAlternative, parsePrefill, quoteExpired, quoteFor, quoteNote, rowCost, sameSetup, scopeLine,
  sessionLine, sessionRows, setupFromHref, startHref, startKeyLabel, startLabel, tonightParams, resolveSession, EMPTY_PICKS,
} from '../../src/app/(app)/dashboard/practiceModel.mjs';
import { PLAN_FACTS, confirmLine } from '../plan_facts.mjs';
import { TEST_MODES, resolveCount } from '../test_modes.js';
import { practiceHref } from '../next_step_rules.mjs';
import { CAVEAT_PATTERNS, retiredHits, studentStrings } from '../glossary.mjs';
import { buildPracticeQuote } from '../practice_quote.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const params = (query) => new URLSearchParams(query);

// ---------------------------------------------------------------------------------------------
// 1. The prefill contract: what the old page did, kept exactly

// The old page's own rules, copied from DashboardPageClient.jsx before the rebuild (the oracle).
const oldCount = (value) => { const requested = Number(value); return TEST_MODES.quick.countOptions.includes(requested) ? requested : 10; };
const oldMode = (value) => (['quick', 'full', 'smart', 'nta'].includes(value) ? value : 'quick');
const oldNtaScreen = (value) => (value === 'nta' ? 'nta' : 'mockmob');
function oldLaunchHref({ subject, count, mode, chapters, difficultyMode, isPremium, ntaScreen }) {
  const m = TEST_MODES[mode];
  const chapterParam = chapters.length > 0 ? `&chapters=${encodeURIComponent(chapters.join(','))}` : '';
  const difficultyParam = m.allowDifficultyOverride && isPremium && difficultyMode !== 'auto' ? `&difficulty=${encodeURIComponent(difficultyMode)}` : '';
  const modeParam = `&mode=${encodeURIComponent(m.id)}`;
  const interfaceParam = mode === 'nta' && ntaScreen === 'nta' ? '&interface=nta' : '';
  return `/test?subject=${subject}&count=${count}${modeParam}${chapterParam}${difficultyParam}${interfaceParam}`;
}

test('parsePrefill reads subject, mode, count, chapter and interface exactly as the old page did', () => {
  const links = [
    '', 'subject=accountancy', 'subject=accountancy&mode=quick&count=15&chapter=Partnership%20Fundamentals',
    'mode=full', 'mode=nta&interface=nta', 'mode=smart&count=5', 'mode=bogus&count=abc', 'count=20', 'count=25', 'count=0', 'count=-5',
    'subject=physics&mode=quick', 'mode=quick&count=10&tonightKey=k1&tonightMinutes=30', 'interface=mockmob', 'mode=nta&interface=NTA',
  ];
  for (const query of links) {
    const q = params(query);
    const got = parsePrefill(q);
    assert.equal(got.subject, q.get('subject') || null, query);
    assert.equal(got.chapter, q.get('chapter') || null, query);
    assert.equal(got.count, oldCount(q.get('count')), `count of "${query}"`);
    assert.equal(got.mode, q.get('mode') && ['quick', 'full', 'smart', 'nta'].includes(q.get('mode')) ? q.get('mode') : null, query);
    assert.equal(got.ntaScreen, oldNtaScreen(q.get('interface')), query);
    assert.equal(got.mode || 'quick', oldMode(q.get('mode')), `the page default for "${query}"`);
  }
});

test('parsePrefill takes a plain object or nothing, and never throws', () => {
  assert.deepEqual(parsePrefill(null), { subject: null, mode: null, count: 10, askedCount: null, chapter: null, ntaScreen: 'mockmob' });
  assert.equal(parsePrefill({ subject: 'economics', mode: 'full' }).subject, 'economics');
  assert.equal(parsePrefill(new Map([['mode', 'smart']])).mode, 'smart');
});

test('launchHref builds the /test link byte for byte as the old page did', () => {
  const subjects = ['accountancy', 'business_studies', 'general_test'];
  const chapterSets = [[], ['Partnership Fundamentals'], ['Money and Banking', 'Controlling & Planning']];
  for (const mode of ['quick', 'full', 'smart', 'nta']) {
    for (const subject of subjects) for (const chapters of chapterSets) for (const pro of [false, true]) for (const difficulty of ['auto', 'hard']) for (const ntaScreen of ['mockmob', 'nta']) {
      const count = effectiveCount(mode, 10);
      const want = oldLaunchHref({ subject, count, mode, chapters, difficultyMode: difficulty, isPremium: pro, ntaScreen });
      assert.equal(launchHref({ subject, count, mode, chapters, difficulty, pro, ntaScreen }), want, `${mode} ${subject} ${chapters.length} ${pro} ${difficulty} ${ntaScreen}`);
    }
  }
});

test('startHref adds the generation key and Tonight\'s move values after the launch link, in the old order', () => {
  const launch = { subject: 'accountancy', count: 10, mode: 'quick', chapters: ['A b'], difficulty: 'auto', pro: false, ntaScreen: 'mockmob' };
  const key = 'preview token/1';
  const plain = startHref(launch, { generationKey: key });
  assert.equal(plain, `${launchHref(launch)}&generationKey=${encodeURIComponent(key)}`);
  const tonight = tonightParams(params('mode=quick&tonightKey=k1&tonightMinutes=30&other=1'));
  assert.deepEqual([...tonight.keys()], ['tonightKey', 'tonightMinutes'], 'only the two values carry through');
  assert.equal(startHref(launch, { generationKey: key, tonight }), `${plain}&tonightKey=k1&tonightMinutes=30`);
  // The old page: `${launchHref}&generationKey=${...}${tonight.size ? `&${tonight}` : ''}`.
  assert.equal(tonightParams(params('x=1')).toString(), '');
});

test('every /dashboard link the data builders emit parses back to the session it names', () => {
  for (const spec of [
    { subject: 'accountancy', mode: 'quick', count: 10, chapter: 'Accounting Ratios' },
    { subject: 'economics', mode: 'full' },
    { subject: null, mode: 'quick', count: 15 },
    { subject: 'business_studies', mode: 'smart', count: 20 },
  ]) {
    const href = practiceHref(spec);
    assert.ok(href.startsWith(`${PRACTICE_PATH}?`), href);
    const want = setupFromHref(href);
    assert.equal(want.subject, spec.subject, href);
    assert.equal(want.mode, spec.mode, href);
    assert.equal(want.chapter, spec.chapter || null, href);
    if (spec.count) assert.equal(want.count, oldCount(spec.count), href);
  }
  assert.equal(setupFromHref('/dashboard').mode, null);
  assert.equal(setupFromHref('/dashboard?mode=nta&interface=nta').ntaScreen, 'nta');
});

test('a link that is not a practice link is never treated as one', () => {
  for (const href of ['/test?subject=accountancy', '/result/abc', '/review', '/dashboardx?mode=quick', '', null, undefined, 'https://example.com/dashboard?mode=full', '//evil.test/dashboard']) {
    assert.equal(setupFromHref(href), null, String(href));
  }
});

test('effectiveCount follows the mode: Full mock and NTA mode are fixed, the others snap to their own options', () => {
  assert.equal(effectiveCount('full', 5), 50);
  assert.equal(effectiveCount('nta', 15), 50);
  assert.equal(effectiveCount('quick', 15), 15);
  assert.equal(effectiveCount('quick', 25), 10);
  assert.equal(effectiveCount('smart', 5), 15, 'smart does not offer 5');
  assert.equal(effectiveCount('smart', 20), 20);
  for (const id of ['quick', 'full', 'smart', 'nta']) assert.equal(effectiveCount(id, 7), resolveCount(TEST_MODES[id], 7));
  assert.equal(effectiveCount('nope', 10), 10, 'an unknown mode reads as Quick practice');
});

test('lengthNote says what the page set instead, and only when a link asked for a length the mode lacks', () => {
  assert.equal(lengthNote('smart', 5), 'Smart practice starts at 10 questions. You asked for 5, so this is set to 15.');
  assert.equal(lengthNote('quick', 25), 'Quick practice goes up to 20 questions. You asked for 25, so this is set to 10.');
  assert.match(lengthNote('smart', 12), /comes in 10, 15 or 20 questions\. You asked for 12, so this is set to 15\./);
  assert.equal(lengthNote('quick', 10), null);
  assert.equal(lengthNote('smart', 15), null);
  assert.equal(lengthNote('full', 5), null, 'Full mock has no length to adjust');
  assert.equal(lengthNote('nta', 5), null);
  assert.equal(lengthNote('quick', null), null);
  assert.equal(lengthNote('quick', NaN), null);
});

// ---------------------------------------------------------------------------------------------
// 2. The session rows: one name, one line and one cost, from plan_facts

test('the rows come in the plan\'s order with the glossary\'s names', () => {
  assert.deepEqual(SESSION_ORDER, ['quick', 'full', 'nta', 'smart']);
  const rows = sessionRows({ pro: false, isLocked: (id) => id === 'nta' || id === 'smart' });
  assert.deepEqual(rows.map((r) => r.label), ['Quick practice', 'Full mock', 'NTA mode', 'Smart practice']);
  assert.deepEqual(rows.map((r) => r.locked), [false, false, true, true]);
  assert.deepEqual(rows.map((r) => r.tag), [null, null, 'Pro', 'Pro']);
});

test('each row shows its cost from plan_facts, and a Pro student sees Included with Pro', () => {
  const free = sessionRows({ pro: false, isLocked: (id) => id === 'nta' || id === 'smart' });
  assert.equal(free[0].cost, `${PLAN_FACTS.practiceCredits.quickCost.value} practice credits`);
  assert.equal(free[1].cost, `${PLAN_FACTS.practiceCredits.fullMockCost.value} practice credits`);
  assert.equal(free[2].cost, 'Comes with Pro');
  assert.equal(free[3].cost, 'Comes with Pro');
  const pro = sessionRows({ pro: true, isLocked: (id) => id === 'nta' || id === 'smart' });
  assert.deepEqual(pro.map((r) => r.cost), Array(4).fill('Included with Pro'));
  assert.deepEqual(pro.map((r) => r.locked), [false, false, false, false], 'Pro unlocks every row');
  assert.equal(rowCost('quick'), '10 practice credits');
  assert.equal(rowCost('nta'), 'Comes with Pro');
});

test('the lines carry the real numbers and a locked row names the way forward', () => {
  assert.equal(sessionLine('quick'), '5 to 20 questions, your pick.');
  assert.equal(sessionLine('full'), '50 questions, 60 minutes, timed like the exam.');
  assert.equal(sessionLine('nta'), '50 questions, 60 minutes, on the exam-day screen.');
  assert.match(sessionLine('smart'), /^Leans toward the chapters you miss\. 10 to 20 questions\.$/);
  assert.equal(lockLine('nta'), 'Comes with Pro. A full mock is open to you now.');
  assert.equal(lockLine('smart'), 'Comes with Pro. Quick practice is open to you now.');
  assert.equal(lockLine('quick'), null);
  assert.equal(lockedAlternative('nta'), 'full');
  assert.equal(lockedAlternative('smart'), 'quick');
  assert.equal(lockedAlternative('full'), null);
});

// ---------------------------------------------------------------------------------------------
// 3. The confirm line

test('the confirm line is the plan\'s: the length, the marking, and what it uses of what you have', () => {
  assert.equal(confirmText({ mode: 'quick', count: 10, balance: 40 }), '10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice credits.');
  assert.equal(confirmText({ mode: 'quick', count: 10, balance: 40 }), confirmLine({ mode: 'quick', count: 10, balance: 40 }));
  assert.equal(confirmText({ mode: 'quick', count: 5, balance: 40 }), '5 questions, about 5 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice credits.', 'a quick practice costs 10 whatever its length');
  assert.equal(confirmText({ mode: 'full', balance: 40 }), '50 questions, 60 minutes. +5 right, -1 wrong. Uses 50 practice credits. You have 40.', 'a balance below the cost says what you have');
  assert.equal(confirmText({ mode: 'full', balance: 60 }), '50 questions, 60 minutes. +5 right, -1 wrong. Uses 50 of your 60 practice credits.');
  assert.equal(confirmText({ mode: 'quick', count: 10, balance: 4 }), '10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 practice credits. You have 4.');
  assert.equal(confirmText({ mode: 'quick', count: 10 }), '10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 practice credits.', 'an unknown balance is never shown as 0');
  assert.equal(confirmText({ mode: 'quick', count: 10, pro: true }), '10 questions, about 10 minutes. +5 right, -1 wrong. Included with Pro.');
  assert.equal(confirmText({ mode: 'nta', pro: true }), '50 questions, 60 minutes. +5 right, -1 wrong. Included with Pro.');
  assert.equal(confirmText({ mode: 'smart', count: 15, pro: true }), '15 questions, about 15 minutes. +5 right, -1 wrong. Included with Pro.');
  assert.equal(confirmText({ mode: 'smart', count: 15, pro: true, minutes: 14 }), '15 questions, about 14 minutes. +5 right, -1 wrong. Included with Pro.', 'the server estimate wins when there is one');
});

test('today\'s included set says so instead of a credit price, for a free student only', () => {
  assert.equal(confirmText({ mode: 'quick', count: 10, balance: 40, freeToday: true }), '10 questions, about 10 minutes. +5 right, -1 wrong. Free today, no credits used.');
  assert.equal(confirmText({ mode: 'quick', count: 10, pro: true, freeToday: true }), '10 questions, about 10 minutes. +5 right, -1 wrong. Included with Pro.');
});

test('the title, the scope and the fine-tune hint say what narrows a set', () => {
  assert.equal(asideTitle({ mode: 'quick', subjectName: 'Accountancy' }), 'Quick practice in Accountancy');
  assert.equal(asideTitle({ mode: 'nta' }), 'NTA mode');
  assert.equal(scopeLine({}), '');
  assert.equal(scopeLine({ chapters: ['Partnership Fundamentals'] }), 'Partnership Fundamentals only.');
  assert.equal(scopeLine({ chapters: ['A', 'B'] }), 'Chapters: A and B.');
  assert.equal(scopeLine({ chapters: ['A', 'B', 'C', 'D'] }), 'Chapters: A, B and 2 more.');
  assert.equal(scopeLine({ difficulty: 'hard' }), 'Hard questions only.');
  assert.equal(scopeLine({ chapters: ['A'], difficulty: 'easy' }), 'A only. Easy questions only.');
  assert.equal(chaptersSummary([]), '');
  assert.equal(fineTuneHint({}), 'Optional. Balanced mix, all chapters.');
  assert.equal(fineTuneHint({ difficulty: 'hard', chapters: ['A', 'B'] }), 'Hard only, 2 chapters.');
  assert.equal(fineTuneHint({ chapters: ['A'] }), 'Balanced mix, 1 chapter.');
});

test('the Start key says what happens, in every state', () => {
  assert.equal(startKeyLabel({ mode: 'quick' }), 'Start quick practice');
  assert.equal(startKeyLabel({ mode: 'full' }), 'Start full mock');
  assert.equal(startKeyLabel({ mode: 'nta' }), 'Start NTA mode');
  assert.equal(startKeyLabel({ mode: 'smart' }), 'Start smart practice');
  assert.equal(startKeyLabel({ mode: 'quick', checking: true }), 'Checking');
  assert.equal(startKeyLabel({ mode: 'quick', launching: true, checking: true }), 'Starting');
  assert.equal(startKeyLabel({ mode: 'quick', available: false }), 'Not available');
  assert.equal(startLabel('nope'), 'Start quick practice');
});

// ---------------------------------------------------------------------------------------------
// 4. The server quote stays the authority

const FREE = { id: 'u', isPremium: false, creditBalance: 40 };
const PRO = { id: 'u', isPremium: true, premiumUntil: '2027-07-31T18:29:59.000Z', creditBalance: 0 };
const INVENTORY = { state: 'available', checkedAt: '2026-10-15T10:00:00.000Z', subjectCounts: { accountancy: 640, economics: 720, english: 12 } };
const quote = (user, subject, mode, count, extra = {}) => buildPracticeQuote({ user, subject, mode, count, inventory: INVENTORY, allowance: { enabled: false, used: false }, token: 'tok', now: Date.parse('2026-10-15T10:00:00.000Z'), ...extra });

test('quoteFor matches a quote to the session on screen and to nothing else', () => {
  const q = quote(FREE, 'accountancy', 'quick', 10);
  assert.equal(quoteFor(q, { subject: 'accountancy', mode: 'quick', count: 10 }), q);
  assert.equal(quoteFor(q, { subject: 'accountancy', mode: 'quick', count: 15 }), null);
  assert.equal(quoteFor(q, { subject: 'economics', mode: 'quick', count: 10 }), null);
  assert.equal(quoteFor(q, { subject: 'accountancy', mode: 'full', count: 10 }), null);
  assert.equal(quoteFor(null, { subject: 'accountancy', mode: 'quick', count: 10 }), null);
});

test('quoteNote words each answer in the glossary\'s terms and keeps the server\'s reason where it has no better one', () => {
  const ok = quote(FREE, 'accountancy', 'quick', 10);
  assert.deepEqual(quoteNote(ok, { mode: 'quick' }), { tone: 'ok', text: 'Credits are used only after the full set is built. If it cannot be built, nothing is used.' });
  assert.deepEqual(quoteNote(quote(PRO, 'accountancy', 'quick', 10), { mode: 'quick', pro: true }), { tone: 'ok', text: '' });
  const included = quote(FREE, 'accountancy', 'quick', 10, { allowance: { enabled: true, used: false } });
  assert.equal(includedToday(included), true);
  assert.equal(quoteNote(included, { mode: 'quick' }).text, 'This uses today’s included 10-question set.');

  const locked = quote(FREE, 'accountancy', 'nta', 50);
  const lockedNote = quoteNote(locked, { mode: 'nta' });
  assert.equal(lockedNote.tone, 'locked');
  assert.equal(lockedNote.text, 'Comes with Pro. A full mock is open to you now.');
  assert.equal(lockedNote.href, '/pricing?reason=premium_mode');

  const poor = quote({ ...FREE, creditBalance: 4 }, 'accountancy', 'quick', 10);
  const poorNote = quoteNote(poor, { mode: 'quick' });
  assert.equal(poorNote.tone, 'blocked');
  assert.equal(poorNote.text, 'You need 6 more practice credits for this session.');
  assert.equal(poorNote.href, '/pricing?reason=credits');
  assert.equal(quoteNote(quote({ ...FREE, creditBalance: 49 }, 'accountancy', 'full', 50), { mode: 'full' }).text, 'You need 1 more practice credit for this session.');

  const thin = quote(FREE, 'english', 'quick', 20);
  assert.equal(quoteNote(thin, { mode: 'quick' }).text, thin.reason, 'the bank\'s own reason, with its numbers');
  const down = quote(FREE, 'accountancy', 'quick', 10, { inventory: { state: 'unavailable' } });
  assert.equal(quoteNote(down, { mode: 'quick' }).retry, true, 'an unreadable bank can be checked again');
  assert.equal(quoteNote(null), null);
});

test('a quote is good until it expires, and a missing quote is always expired', () => {
  const now = Date.parse('2026-10-15T10:00:30.000Z');
  const q = quote(FREE, 'accountancy', 'quick', 10);
  assert.equal(quoteExpired(q, now), false, 'inside its minute');
  assert.equal(quoteExpired(q, Date.parse('2026-10-15T10:01:01.000Z')), true);
  assert.equal(quoteExpired(null, now), true);
  assert.equal(quoteExpired({ expiresAt: 'nonsense' }, now), true);
});

test('sameSetup tells whether the session on screen is the one a link asked for', () => {
  const have = { subject: 'accountancy', mode: 'quick', count: 10, chapters: ['Accounting Ratios'] };
  assert.equal(sameSetup(setupFromHref('/dashboard?subject=accountancy&mode=quick&count=10&chapter=Accounting%20Ratios'), have), true);
  assert.equal(sameSetup(setupFromHref('/dashboard?subject=economics&mode=quick&count=10'), have), false);
  assert.equal(sameSetup(setupFromHref('/dashboard?subject=accountancy&mode=full'), have), false);
  assert.equal(sameSetup(setupFromHref('/dashboard?subject=accountancy&mode=quick&count=15'), have), false);
  assert.equal(sameSetup(setupFromHref('/dashboard?subject=accountancy&mode=quick&count=10&chapter=Other'), have), false);
  assert.equal(sameSetup(setupFromHref('/dashboard?subject=accountancy&mode=full'), { ...have, mode: 'full', count: 50, chapters: [] }), true, 'a fixed-length mode needs no count');
  assert.equal(sameSetup(null, have), false);
});

// ---------------------------------------------------------------------------------------------
// 4b. The session on screen: the link decides until the student chooses

const MINE = ['accountancy', 'economics', 'business_studies', 'english'];
const CHAPTERS = (subject, names = ['Partnership Fundamentals', 'Accounting Equation']) => ({ subject, list: names.map((name) => ({ name })), failed: false });
const session = (query, picks = EMPTY_PICKS, chapters = null, mySubjectIds = MINE) => resolveSession({ prefill: parsePrefill(params(query)), picks, mySubjectIds, chapters });

test('a bare /dashboard opens Quick practice, 10 questions, in the first subject on the sheet', () => {
  const s = session('');
  assert.deepEqual([s.subjectId, s.modeId, s.count, s.difficulty, s.ntaScreen, s.chapterNames, s.chapterMissing], ['accountancy', 'quick', 10, 'auto', 'mockmob', [], false]);
  assert.equal(session('', EMPTY_PICKS, null, []).subjectId, null, 'no practice subject, no session');
});

test('a "Do these next" link opens the session it names', () => {
  const read = CHAPTERS('accountancy');
  const s = session('subject=accountancy&mode=quick&count=15&chapter=Partnership%20Fundamentals', EMPTY_PICKS, read);
  assert.deepEqual([s.subjectId, s.modeId, s.count, s.chapterNames], ['accountancy', 'quick', 15, ['Partnership Fundamentals']]);
  const full = session('subject=economics&mode=full', EMPTY_PICKS, CHAPTERS('economics'));
  assert.deepEqual([full.subjectId, full.modeId, full.count], ['economics', 'full', 50]);
  const nta = session('mode=nta&interface=nta');
  assert.deepEqual([nta.modeId, nta.count, nta.ntaScreen], ['nta', 50, 'nta']);
});

test('a linked subject that is not on the sheet falls back to the first one, and its chapter is not applied to another subject', () => {
  const s = session('subject=physics&mode=quick&chapter=Motion', EMPTY_PICKS, CHAPTERS('accountancy', ['Motion']));
  assert.equal(s.subjectId, 'accountancy');
  assert.equal(s.linkedChapter, null, 'the chapter belongs to the linked subject only');
  assert.deepEqual(s.chapterNames, []);
  assert.equal(s.chapterMissing, false);
});

test('a linked chapter counts once the chapter list is read, and a chapter that is not there is reported, not guessed', () => {
  const link = 'subject=accountancy&mode=quick&chapter=Accounting%20Ratios';
  const before = session(link);
  assert.deepEqual([before.chapterNames, before.chapterMissing, before.chaptersRead], [[], false, false], 'unread: wait, say nothing');
  const other = session(link, EMPTY_PICKS, CHAPTERS('economics', ['Accounting Ratios']));
  assert.deepEqual([other.chapterNames, other.chapterMissing, other.chaptersRead], [[], false, false], "another subject's list is not this one's");
  const missing = session(link, EMPTY_PICKS, CHAPTERS('accountancy'));
  assert.deepEqual([missing.chapterNames, missing.chapterMissing], [[], true]);
  const failed = session(link, EMPTY_PICKS, { subject: 'accountancy', list: [], failed: true });
  assert.deepEqual([failed.chapterNames, failed.chapterMissing], [[], false], 'a failed read is not a missing chapter');
  const found = session(link, EMPTY_PICKS, CHAPTERS('accountancy', ['Accounting Ratios']));
  assert.deepEqual([found.chapterNames, found.chapterMissing], [['Accounting Ratios'], false]);
});

test('what the student chooses beats the link, and "All chapters" beats a linked chapter', () => {
  const read = CHAPTERS('accountancy');
  const link = 'subject=accountancy&mode=quick&count=15&chapter=Partnership%20Fundamentals';
  assert.equal(session(link, { ...EMPTY_PICKS, subject: 'economics' }, read).subjectId, 'economics');
  assert.equal(session(link, { ...EMPTY_PICKS, subject: 'physics' }, read).subjectId, 'accountancy', 'a pick must be one of theirs');
  assert.equal(session(link, { ...EMPTY_PICKS, mode: 'full' }, read).count, 50);
  assert.equal(session(link, { ...EMPTY_PICKS, count: 5 }, read).count, 5);
  assert.deepEqual(session(link, { ...EMPTY_PICKS, chapters: [] }, read).chapterNames, []);
  assert.equal(session(link, { ...EMPTY_PICKS, chapters: [] }, read).chapterMissing, false);
  assert.deepEqual(session(link, { ...EMPTY_PICKS, chapters: ['Accounting Equation'] }, read).chapterNames, ['Accounting Equation']);
  assert.equal(session('mode=nta', { ...EMPTY_PICKS, ntaScreen: 'nta' }).ntaScreen, 'nta');
});

test("the length snaps to what the mode offers, and keeps the student's Quick length across a mode change", () => {
  assert.equal(session('mode=smart&count=5').count, 15);
  assert.equal(session('mode=smart&count=20').count, 20);
  assert.equal(session('mode=quick&count=25').count, 10);
  const picked = { ...EMPTY_PICKS, count: 5 };
  assert.equal(session('', picked).count, 5);
  assert.equal(session('', { ...picked, mode: 'full' }).count, 50);
  assert.equal(session('', { ...picked, mode: 'quick' }).count, 5, 'back to Quick: the length they chose');
  assert.equal(session('', { ...picked, mode: 'smart' }).count, 15, 'Smart does not offer 5');
});

test('difficulty applies only where the mode lets a Pro student set it', () => {
  assert.equal(session('', { ...EMPTY_PICKS, difficulty: 'hard' }).difficulty, 'hard');
  assert.equal(session('mode=full', { ...EMPTY_PICKS, difficulty: 'hard' }).difficulty, 'hard');
  assert.equal(session('mode=nta', { ...EMPTY_PICKS, difficulty: 'hard' }).difficulty, 'auto');
  assert.equal(session('mode=smart', { ...EMPTY_PICKS, difficulty: 'hard' }).difficulty, 'auto');
  assert.equal(session('', EMPTY_PICKS).difficulty, 'auto');
});

// ---------------------------------------------------------------------------------------------
// 5. The words on the page, and what a tap can do

const FILES = [
  'src/app/(app)/dashboard/DashboardPageClient.jsx', 'src/app/(app)/dashboard/PracticeSections.jsx', 'src/app/(app)/dashboard/PracticeParts.jsx',
  'src/app/(app)/dashboard/practiceModel.mjs', 'src/app/(app)/dashboard/page.js', 'src/components/CreditsRemainingModal.jsx',
  'src/components/feed/DiscoveryFeed.jsx', 'src/app/(app)/explore/page.js', 'src/app/(app)/learn/page.jsx', 'src/app/(app)/learn/summary/page.jsx',
];

test('no retired name, caveat, em dash or exclamation mark in the Practice, stream or Concepts copy', () => {
  for (const rel of FILES) {
    const src = read(rel);
    assert.deepEqual(retiredHits(src, rel), [], `${rel} names something the glossary retired`);
    for (const text of studentStrings(src)) {
      for (const pattern of CAVEAT_PATTERNS) assert.ok(!pattern.test(text), `${rel}: "${text}"`);
      assert.ok(!/—/.test(text), `${rel} has an em dash in "${text}"`);
      assert.ok(!/[A-Za-z0-9.]!(s|$)/.test(text), `${rel} has an exclamation mark in "${text}"`);
    }
  }
  for (const label of Object.values(SESSION_LABEL)) assert.equal(retiredHits(`"${label}"`, 'x.js').length, 0);
});

test('the rebuilt page keeps none of the old copy and none of the old reads', () => {
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx') + read('src/app/(app)/dashboard/PracticeSections.jsx');
  for (const gone of ['Feed the bank', 'saved to Radar', 'Needs access', 'Meet the exam before exam day', 'Entering the arena', 'Free exam-screen preview']) {
    assert.ok(!page.includes(gone), `still says "${gone}"`);
  }
  for (const route of ['/api/leaderboard', '/api/questions/mine', '/api/learning/summary', '/api/attempts']) {
    assert.ok(!page.includes(route), `still reads ${route}`);
  }
  const stream = read('src/components/feed/DiscoveryFeed.jsx');
  assert.ok(!stream.includes('mono-label') && !stream.includes('↗') && !stream.includes('Explore ·'), 'the stream keeps no eyebrow, mono label or arrow');
  assert.match(stream, /Question stream/);
});

test('nothing but Start opens a session: one router.push on the page, and it carries the server token', () => {
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.equal((page.match(/router\.push\(/g) || []).length, 1, 'one navigation');
  assert.match(page, /router\.push\(startHref\(/, 'to the /test link built by startHref');
  assert.match(page, /generationKey: current\.idempotencyToken/, 'with the idempotency token from the server quote');
  assert.match(page, /if \(launchingRef\.current/, 'and it cannot run twice');
  assert.ok(!/['"`]\/test/.test(page), 'the page never types a /test link itself');
  const sections = read('src/app/(app)/dashboard/PracticeSections.jsx');
  assert.ok(!sections.includes('/test'), 'no link in the sections starts a session');
  assert.ok(!/\bfetch\(|apiGet\(|apiPost\(/.test(sections), 'the sections draw props and read nothing');
});

test('a prefilled link sets the page up and spends nothing: the page only reads the quote before Start', () => {
  const page = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  const fetches = page.match(/fetch\(`?[^)]*\)|apiGet\([^)]*\)/g) || [];
  for (const call of fetches) assert.ok(/practice\/quote|api\/stats|api\/subjects|api\/chapters/.test(call), `an unexpected read: ${call}`);
  assert.ok(!/apiPost|method: ['"]POST/.test(page), 'the page posts nothing');
  assert.ok(page.includes('cache: \'no-store\''), 'the quote is never cached');
});

test('Concepts shows only while the study flag is on, and the Practice page reads the same switch as the shell', () => {
  const page = read('src/app/(app)/dashboard/page.js');
  assert.match(page, /STUDY_CONTENT_ENABLED === 'true'/);
  const layout = read('src/app/(app)/layout.js');
  assert.match(layout, /STUDY_CONTENT_ENABLED==='true'|STUDY_CONTENT_ENABLED === 'true'/, 'the shell reads the same variable');
  const sections = read('src/app/(app)/dashboard/PracticeSections.jsx');
  assert.match(sections, /studyEnabled \? \[\{ id: 'concepts'/);
});

test('the credits sheet reads every number from plan_facts', () => {
  const src = read('src/components/CreditsRemainingModal.jsx');
  assert.match(src, /PLAN_FACTS\.practiceCredits\.quickCost\.value/);
  assert.match(src, /PLAN_FACTS\.practiceCredits\.fullMockCost\.value/);
  assert.match(src, /proPlanLines\(\)/);
  assert.ok(!/=\s*(10|50);/.test(src), 'no typed credit cost');
  for (const gone of ['Radar', 'credit gate', 'generate a mock', 'Unlimited mocks', 'Cancel anytime']) assert.ok(!src.includes(gone), `still says "${gone}"`);
});
