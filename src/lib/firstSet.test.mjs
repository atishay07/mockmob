// The first run to the first question (15 Nov 2026, lane W1-D: O1, F2, F4, ux-fresh U1, and the guide's first-set end).
// Run: node --test src/lib/firstSet.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FIRST_SET_COUNT, FIRST_SET_GUIDE_KEY, FIRST_SET_QUOTE_MS, FINISH_TO_PRACTICE, firstSetKey, firstSetLine, firstSetNote, firstSetOffer,
  launchPath, quoteExpired, quotePath, readFirstSetQuote, startPath,
} from './firstSet.mjs';
import { FIRST_SET_STOP, GUIDE_AUTO_PAGES, TOUR_LINE_WORDS, firstSetOrderOpen, firstSetTour, guideAutoStart, tourSteps } from './appTour.mjs';
import { answeredIn, blankPaper, creditsModalAllowed, emptyRecord, firstActionOpens, markFirstShown, noteOnboarded } from './proNudge.mjs';
import { buildPracticeQuote } from '../../data/practice_quote.js';
import { firstSetSubject, practiceAfter, previewFinish } from '../app/onboarding/firstRun.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const NOW = Date.UTC(2026, 10, 15, 6, 0, 0);
const inventory = { state: 'available', checkedAt: new Date(NOW).toISOString(), subjectCounts: { accountancy: 640, economics: 720 } };
const quote = ({ used = false, enabled = true, isPremium = false, balance = 50, count = 10, mode = 'quick', subject = 'accountancy' } = {}) => buildPracticeQuote({
  user: { id: 'u1', isPremium, creditBalance: balance }, subject, mode, count, inventory, allowance: { enabled, used }, token: 'tok-123456789012', now: NOW,
});

test('one quote address and one runner address: what Practice asked and built before, character for character', () => {
  assert.equal(quotePath({ subject: 'accountancy', mode: 'quick', count: 10 }), '/api/practice/quote?subject=accountancy&mode=quick&count=10');
  assert.equal(quotePath({ subject: 'economics' }), '/api/practice/quote?subject=economics&mode=quick&count=10');
  // Practice's old template: /test?subject=${s}&count=${n}&mode=${m}${chapters}${difficulty}${interface}, then &generationKey= and the hand-over.
  const old = (s, n, m, ch, d, nta) => `/test?subject=${s}&count=${n}&mode=${encodeURIComponent(m)}${ch.length ? `&chapters=${encodeURIComponent(ch.join(','))}` : ''}${d ? `&difficulty=${encodeURIComponent(d)}` : ''}${nta ? '&interface=nta' : ''}`;
  for (const [s, n, m, ch, d, nta] of [['accountancy', 10, 'quick', [], '', false], ['economics', 15, 'quick', ['Money & Banking', 'Inflation'], 'hard', false], ['english', 10, 'nta', [], '', true]]) {
    assert.equal(launchPath({ subject: s, count: n, mode: m, chapters: ch, difficulty: d, ntaScreen: nta }), old(s, n, m, ch, d, nta));
  }
  const tonight = new URLSearchParams({ tonightKey: 'k1' });
  assert.equal(startPath('/test?subject=a&count=10&mode=quick', 'tok/1', tonight), '/test?subject=a&count=10&mode=quick&generationKey=tok%2F1&tonightKey=k1');
  assert.equal(startPath('/test?subject=a&count=10&mode=quick', 'tok', new URLSearchParams()), '/test?subject=a&count=10&mode=quick&generationKey=tok');
  // Practice builds with these builders; the firstFree hand-over is still set before the address is made.
  const practice = read('src/app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(practice, /const address = quotePath\(\{ subject: selSubj, mode: effectiveModeId, count: quoteCount \}\);/);
  assert.match(practice, /const launchHref = launchPath\(\{/);
  assert.match(practice, /if \(quoteFirstFree\) tonight\.set\('firstFree', '1'\);\s*const target = startPath\(launchHref, launchingKeyRef\.current, tonight\);/);
});

test('the first set is offered only on a quote that proves today’s included Quick 10 is free', () => {
  const free = firstSetOffer(quote(), { subject: 'accountancy', now: NOW });
  assert.deepEqual(free, {
    subject: 'accountancy', count: 10, minutes: 10, expiresAt: new Date(NOW + 60_000).toISOString(),
    href: '/test?subject=accountancy&count=10&mode=quick',
    path: '/test?subject=accountancy&count=10&mode=quick&generationKey=tok-123456789012',
  });
  assert.equal(firstSetOffer(quote({ used: true }), { subject: 'accountancy', now: NOW }), null, 'today’s set is used: priced, so Practice');
  assert.equal(firstSetOffer(quote({ used: true, balance: 0 }), { subject: 'accountancy', now: NOW }), null, 'blocked');
  assert.equal(firstSetOffer(quote({ used: null }), { subject: 'accountancy', now: NOW }), null, 'the allowance could not be read');
  assert.equal(firstSetOffer(quote({ enabled: false }), { subject: 'accountancy', now: NOW }), null, 'no allowance at all');
  assert.equal(firstSetOffer(quote({ isPremium: true }), { subject: 'accountancy', now: NOW }), null, 'Pro: nothing is "free today"');
  assert.equal(firstSetOffer(quote({ count: 5 }), { subject: 'accountancy', now: NOW }), null, 'another set');
  assert.equal(firstSetOffer(quote({ subject: 'physics' }), { subject: 'physics', now: NOW }), null, 'no questions: not launchable');
  assert.equal(firstSetOffer(quote(), { subject: 'economics', now: NOW }), null, 'a quote for another subject');
  assert.equal(firstSetOffer(quote(), { subject: 'accountancy', now: NOW + 60_000 }), null, 'a quote whose time is up');
  assert.equal(firstSetOffer(null), null);
  assert.equal(quoteExpired({ expiresAt: 'x' }, NOW), true);
  assert.equal(quoteExpired({ expiresAt: new Date(NOW + 1000).toISOString() }, NOW), false);
});

test('the quote is read with a short limit and never throws: slow, failed and odd answers are all "no offer"', async () => {
  assert.equal(FIRST_SET_QUOTE_MS, 2500);
  const ok = await readFirstSetQuote('accountancy', { fetcher: async (url) => { assert.equal(url, quotePath({ subject: 'accountancy' })); return { ok: true, json: async () => quote() }; } });
  assert.equal(ok.state, 'available');
  assert.equal(await readFirstSetQuote('accountancy', { fetcher: async () => ({ ok: false, json: async () => ({}) }) }), null);
  assert.equal(await readFirstSetQuote('accountancy', { fetcher: async () => { throw new TypeError('offline'); } }), null);
  assert.equal(await readFirstSetQuote('accountancy', { fetcher: async () => ({ ok: true, json: async () => ({ nope: 1 }) }) }), null);
  assert.equal(await readFirstSetQuote(null), null);
  const slow = await readFirstSetQuote('accountancy', { timeoutMs: 20, fetcher: () => new Promise(() => {}) });
  assert.equal(slow, null, 'too slow: the key stays "Finish and open Practice"');
});

test('the words: the key, the line under it, Practice’s first-set line, the guide’s last key', () => {
  assert.equal(firstSetKey('Accountancy'), 'Finish and start 10 Accountancy questions');
  assert.equal(firstSetKey(null), 'Finish and start 10 questions');
  assert.equal(FINISH_TO_PRACTICE, 'Finish and open Practice');
  assert.equal(firstSetNote(10), 'Free today. About 10 minutes. You can stop any time.');
  assert.equal(firstSetLine({ subjectName: 'Accountancy', minutes: 10, price: 'free' }), 'Your first set: 10 Accountancy questions, free today. About 10 minutes.');
  assert.equal(firstSetLine({ subjectName: 'Economics', minutes: 10, price: 'free', chapters: ['Money & Banking'] }), 'Your first set: 10 Economics questions from Money & Banking, free today. About 10 minutes.');
  assert.equal(firstSetLine({ subjectName: 'Economics', count: 15, minutes: 15, price: 15, chapters: ['A', 'B'] }), 'Your first set: 15 Economics questions from 2 chapters, 15 credits. About 15 minutes.');
  assert.equal(firstSetLine({ subjectName: 'Accountancy', minutes: 10 }), 'Your first set: 10 Accountancy questions. About 10 minutes.', 'price unknown: nothing said');
  assert.equal(firstSetLine({ mode: 'full', subjectName: 'Accountancy', minutes: 60, price: 50, chapters: ['A'] }), 'Your first set: the Accountancy full mock, 50 credits. About 60 minutes.');
  assert.equal(FIRST_SET_GUIDE_KEY, 'Start your first set');
  for (const line of [firstSetKey('Business Studies'), firstSetNote(10), firstSetLine({ subjectName: 'English', minutes: 10, price: 'free' }), FIRST_SET_STOP.body, FIRST_SET_GUIDE_KEY]) {
    assert.doesNotMatch(line, /[!—→]|guarantee|unlock/i, line);
  }
  // "About 10 minutes" is the Quick set's own clock: 60 seconds a question.
  assert.equal(quote().durationSec, FIRST_SET_COUNT * 60);
  // "You can stop any time": the runner's Leave keeps every answer, and Submit test is in the palette at every question.
  const runner = read('src/app/(app)/test/TestPageClient.jsx');
  assert.match(runner, /answers stay`\} \$\{placeNow\(\)\} until the timer ends\./, 'the Leave sheet keeps the answers until the timer ends (W1-A wording)');
  assert.match(runner, /className=\{`nta-submit-button/);
});

test('the guide for a student with no finished set: the same stops, Start last, its key starts the first set', () => {
  for (const mob of [false, true]) {
    const plain = tourSteps({ mob });
    const first = firstSetTour(plain);
    assert.equal(first.length, plain.length, 'no stop added or dropped');
    assert.deepEqual(first.map((s) => s.title).sort(), plain.map((s) => s.title).sort());
    assert.equal(first.at(-1), FIRST_SET_STOP);
    assert.deepEqual(first.slice(0, 2).map((s) => s.title), ['Today', 'Practice'], 'the two orders share their first stops');
    assert.equal(firstSetOrderOpen(plain, 0), true);
    assert.equal(firstSetOrderOpen(plain, 1), true);
    assert.equal(firstSetOrderOpen(plain, 2), false, 'settled before the orders part');
  }
  assert.deepEqual([...FIRST_SET_STOP.target], ['first-set', 'practice-start', 'nav-start']);
  assert.ok(FIRST_SET_STOP.body.split(/\s+/).length <= TOUR_LINE_WORDS);
  const guide = read('src/components/guide/AppGuide.jsx');
  assert.match(guide, /fetch\('\/api\/attempts\/summary\?limit=1'/);
  assert.match(guide, /if \(!order && !firstSetOrderOpen\(steps, next\)\) setOrder\(firstOrder \? 'first' : 'plain'\);/);
  assert.match(guide, /\[data-first-set="free"\]/, 'on Practice it presses the page’s own key, only when the set there is free');
  assert.match(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /startKey\('pr-first__go', false, 'first-set'\)/);
});

test('the guide never opens over the first paper or its result: it starts on the Practice or Today visit after', () => {
  const holds = { onboarded: true, seen: false, open: false, sheetOpen: false };
  for (const path of ['/test', '/test?subject=accountancy&count=10&mode=quick&generationKey=k', '/result/abc', '/onboarding?step=colleges']) {
    assert.equal(guideAutoStart({ ...holds, path }), 'no', path);
  }
  for (const path of GUIDE_AUTO_PAGES) assert.equal(guideAutoStart({ ...holds, path }), 'start', path);
  // And the shell draws no guide on the runner at all.
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /if \(status !== 'authenticated' \|\| chromeless \|\| tourOpen \|\| !user\?\.id\) return undefined;/);
  assert.match(shell, /\{!isTestRoute && tourOpen && <AppGuide /);
});

test('F4: no "What Pro adds" modal in the browser session where the first-result sheet showed', () => {
  const t0 = NOW;
  const onboarded = noteOnboarded(emptyRecord(), { now: t0, session: 's1' });
  assert.equal(creditsModalAllowed(onboarded, { session: 's1' }), true, 'the sheet has not shown');
  const shown = markFirstShown(onboarded, t0 + 600_000);
  assert.equal(creditsModalAllowed(shown, { session: 's1' }), false, 'the same session: one pitch is enough');
  assert.equal(creditsModalAllowed(shown, { session: 's2' }), true, 'a later session: as before');
  assert.equal(creditsModalAllowed(shown, { session: null }), true);
  assert.equal(creditsModalAllowed(null, { session: 's1' }), true);
  assert.match(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /if \(!user\?\.isPremium && creditsModalAllowed\(loadRecord\(user\.id\), \{ session: browserSession\(\) \}\)\) \{/);
});

test('U1: the first-session sheet never opens over a paper with nothing answered; every other rule as before', () => {
  const t0 = NOW;
  const record = noteOnboarded(emptyRecord(), { now: t0, session: 's1' });
  const user = { id: 'u1', isPremium: false };
  const at = t0 + 10 * 60_000;
  const base = { now: at, session: 's1', user, route: '/result/p1' };
  assert.equal(firstActionOpens(record, { ...base, action: { kind: 'paper', at } }), true, 'count unknown: as before');
  assert.equal(firstActionOpens(record, { ...base, action: { kind: 'paper', at, answered: 4 } }), true);
  assert.equal(firstActionOpens(record, { ...base, action: { kind: 'paper', at, answered: 0 } }), false, 'a blank paper');
  assert.equal(blankPaper({ answered: 0 }), true);
  assert.equal(blankPaper({ answered: null }), false);
  assert.equal(blankPaper({}), false);
  assert.equal(answeredIn({ correct: 0, wrong: 0, unattempted: 10 }), 0);
  assert.equal(answeredIn({ correct: 3, wrong: 2 }), 5);
  assert.equal(answeredIn({ id: 'x' }), null);
  const host = read('src/components/pro/ProNudgeHost.jsx');
  assert.match(host, /answeredIn\(\(Array\.isArray\(body\?\.items\) \? body\.items : \[\]\)\.find\(\(row\) => row\?\.id === paperId\)\)/);
  assert.match(host, /if \(blankPaper\(\{ answered \}\)\) return;\s*const latest = loadRecord\(userId\);/, 'checked before anything is marked');
});

test('the first run ends in the sampled subject when it was kept, else the first pick; the preview mirrors it', () => {
  assert.equal(firstSetSubject({ picks: ['accountancy', 'economics'], sampled: 'economics' }), 'economics');
  assert.equal(firstSetSubject({ picks: ['accountancy', 'economics'], sampled: 'physics' }), 'accountancy', 'the sample’s subject was unticked');
  assert.equal(firstSetSubject({ picks: [] }), null);
  assert.equal(practiceAfter({ picks: ['accountancy', 'economics'], sampled: 'economics' }), '/dashboard?subject=economics');
  assert.equal(practiceAfter({ picks: ['accountancy'], sampled: null }), '/dashboard');
  assert.equal(previewFinish('/test?subject=a&count=10&mode=quick&generationKey=k', '?view=onboarding&fresh=1&allowance=on&data=empty'), '/preview/arena?view=test&data=empty&allowance=on&subject=a&count=10&mode=quick&generationKey=k');
  assert.equal(previewFinish('/dashboard', '?view=onboarding&quote=fail'), '/preview/arena?view=dashboard&quote=fail');
  const page = read('src/app/onboarding/OnboardingPageClient.jsx');
  assert.match(page, /if \(offer\) \{\s*forgetDailySet\(user\?\.id\);[^\n]*\n\s*clearSample\(\);\s*\}/, 'the note ends with the first run');
  assert.match(page, /finish\('cheer', offer \? offer\.path : practiceAfter\(\{ picks, sampled \}\)\);/);
  assert.match(page, /firstOffer \? firstSetKey\(/);
  assert.match(page, /firstSetNote\(firstOffer\.minutes\)/);
});

test('the offline page installs from the signed-in shell, once, in production, quietly', () => {
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /if \(process\.env\.NODE_ENV !== 'production' \|\| status !== 'authenticated' \|\| swAsked\) return;\s*swAsked = true;/);
  assert.match(shell, /navigator\.serviceWorker\.register\('\/sw\.js', \{ scope: '\/', updateViaCache: 'none' \}\)\.catch\(\(\) => \{\}\)/);
});
