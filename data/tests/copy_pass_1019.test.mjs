// The copy pass over web release 11 (19 Oct 2026, D114 and R6): the lines it made true or rewrote, held as contracts.
//   1. The first full mock in each subject is free (C-dec 1): every line that says a full mock is 50 says so too, and the
//      screens that price one full mock (the Start sheet's Full row, Today's mock line) follow the server quote for its subject,
//      never saying free when it is used and never naming a number they have not read.
//   2. Review is called Your papers on its page too (D106), as in the navigation.
//   3. A fresh account's Today "Choose colleges" opens the Colleges page.
//   4. Sentences that point at one paper name it (a mock by its name, any other paper as "your practice set").
// Tour bodies and the help answer are held in their own files' tests (web_nav_a_1019, help_faq).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIRST_FULL_MOCK_COPY, FIRST_FULL_MOCK_REASON, firstFullMockFromQuote } from '../first_full_mock.js';
import { ONE_CREDIT_LINE, PRACTICE_PRICE_LINE } from '../../src/lib/creditCopy.mjs';
import { PRICE_AT_START_LINE, PRICE_AT_START_SHORT } from '../../src/lib/dailySet.mjs';
import { costLine, startRows } from '../../src/components/start/startModel.mjs';
import { priceLineOf } from '../../src/lib/today/priceLine.mjs';
import { forgetFirstFullMock, readFirstFullMock } from '../../src/lib/useFirstFullMock.js';
import { scopeOf, statsOf } from '../../src/components/review/reviewScope.mjs';
import { TOUR_STEPS_ALL } from '../../src/lib/appTour.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// ---- 1. the free first full mock -----------------------------------------------------------------------------------------

test('every shared line that prices a full mock says the first one in each subject is free', () => {
  assert.match(ONE_CREDIT_LINE, /A full mock costs 50, and your first one in each subject is free\./);
  assert.match(PRACTICE_PRICE_LINE, /A full mock costs 50 credits, and your first one in each subject is free\./);
  const knowledge = read('src/components/ai/assistantKnowledge.js');
  assert.doesNotMatch(knowledge, /a full mock 50/, 'Ask Mobi no longer says a bare "a full mock 50"');
  assert.equal((knowledge.match(/your first full mock in each subject is free/g) || []).length, 2, 'the Credits guide entry and the instant credits answer');
  const pricing = read('src/app/pricing/page.js');
  assert.match(pricing, /3 a deeper analysis\. Your first Full mock in each subject is free'\]/, 'the Free plan’s Credits row');
  assert.match(pricing, /\['Full mock \(50 questions, 60 minutes\)', 'First one free in each subject, then 50 credits each', 'Unlimited'\]/);
  // The plan card says the price sentence once (it already carries the free first mock), not the rule a second time.
  assert.doesNotMatch(read('src/components/billing/PlanCard.jsx'), /FIRST_FULL_MOCK_COPY/);
});

test('the quote says the rule’s state: free when it prices the Full mock at 0 for the rule, used when given, else unknown', () => {
  assert.equal(firstFullMockFromQuote({ freeReason: FIRST_FULL_MOCK_REASON, creditCost: 0, firstFullMock: 'available' }), 'available');
  assert.equal(firstFullMockFromQuote({ firstFullMock: 'available' }), 'available');
  assert.equal(firstFullMockFromQuote({ firstFullMock: 'used', creditCost: 50 }), 'used');
  for (const quote of [null, undefined, {}, { firstFullMock: 'unknown' }, { firstFullMock: 'mine' }, { creditCost: 0 }, 'free']) {
    assert.equal(firstFullMockFromQuote(quote), 'unknown', JSON.stringify(quote));
  }
});

test('Start sheet, Full mock row: free says so with no number, unread names no number, used and unread-by-caller keep the price', () => {
  const free = costLine('full', { balance: 90, short: true, firstFullMock: 'available' });
  assert.deepEqual(free, { text: 'Your first one is free', tone: 'included' });
  assert.equal(FIRST_FULL_MOCK_COPY.tile, 'Your first one is free');
  assert.deepEqual(costLine('full', { balance: 90, firstFullMock: 'available' }), { text: FIRST_FULL_MOCK_COPY.price, tone: 'included' });
  assert.deepEqual(costLine('full', { balance: 90, short: true, firstFullMock: 'unknown' }), { text: PRICE_AT_START_SHORT, tone: 'cost' });
  assert.deepEqual(costLine('full', { balance: 90, firstFullMock: 'unknown' }), { text: PRICE_AT_START_LINE, tone: 'cost' });
  assert.deepEqual(costLine('full', { balance: 90, short: true, firstFullMock: 'used' }), { text: '50 of your 90 credits', tone: 'cost' });
  assert.deepEqual(costLine('full', { balance: 40, short: true, firstFullMock: 'used' }), { text: '50 credits. You have 40.', tone: 'short' });
  assert.deepEqual(costLine('full', { balance: 90, short: true }), { text: '50 of your 90 credits', tone: 'cost' }, 'a caller that never reads it: as before');
  assert.deepEqual(costLine('full', { pro: true, short: true, firstFullMock: 'available' }), { text: 'Included with Pro', tone: 'included' });
  // Only a full mock reads it.
  assert.deepEqual(costLine('quick', { balance: 90, short: true, count: 5, firstFullMock: 'available' }), { text: '5 of your 90 credits', tone: 'cost' });
});

test('Start sheet rows: the Full row follows the chosen subject’s state; a hero linked to another subject names no number', () => {
  const rows = (firstFullMock) => startRows({ subjects: ['economics', 'accountancy'], subject: 'economics', balance: 90, firstFullMock });
  assert.equal(rows('available').rows.find((r) => r.id === 'full').cost.text, 'Your first one is free');
  assert.equal(rows('used').rows.find((r) => r.id === 'full').cost.text, '50 of your 90 credits');
  const plan = (href) => ({ primary: { kind: 'ordinary_practice', title: 'A full mock', href } });
  const other = startRows({ plan: plan('/dashboard?subject=accountancy&mode=full'), subjects: ['economics', 'accountancy'], subject: 'economics', balance: 90, firstFullMock: 'available' });
  assert.equal(other.hero.cost.text, PRICE_AT_START_LINE, 'the read was for Economics, not Accountancy');
  const same = startRows({ plan: plan('/dashboard?subject=economics&mode=full'), subjects: ['economics', 'accountancy'], subject: 'economics', balance: 90, firstFullMock: 'available' });
  assert.equal(same.hero.cost.text, FIRST_FULL_MOCK_COPY.price);
  const wired = read('src/components/start/useStartSheet.js');
  assert.match(wired, /useFirstFullMock\(\{ userId: open \? userId : null, premium: pro, subject \}\)/);
});

test('Today, a mock move: free in its subject says so, unread or another subject names no number, used keeps the price', () => {
  const firstMock = { id: 'firstMock', kind: 'mock', number: 50, subject: 'economics', key: { href: '/dashboard?subject=economics&mode=full' } };
  const insteadMock = { id: 'mock', kind: 'mock', number: 50, subject: 'economics', key: { href: '/dashboard?subject=economics&mode=full' } };
  for (const m of [firstMock, insteadMock]) {
    assert.equal(priceLineOf(m, { balance: 90, firstFull: { subject: 'economics', state: 'available' } }), 'Free: your first full mock in this subject is on us.');
    assert.equal(priceLineOf(m, { balance: 90, firstFull: { subject: 'economics', state: 'unknown' } }), PRICE_AT_START_LINE);
    assert.equal(priceLineOf(m, { balance: 90, firstFull: { subject: 'accountancy', state: 'available' } }), PRICE_AT_START_LINE);
    assert.equal(priceLineOf(m, { balance: 90, firstFull: { subject: 'economics', state: 'used' } }), 'This mock uses 50 credits. You have 90.');
    assert.equal(priceLineOf(m, { balance: 90 }), 'This mock uses 50 credits. You have 90.', 'a caller that never reads it: as before');
    assert.equal(priceLineOf(m, { premium: true, firstFull: { subject: 'economics', state: 'available' } }), null, 'Pro: nothing printed');
  }
  // A practice set never reads it.
  const set = { id: 'practice', number: 20, subject: 'economics', key: { href: '/dashboard?mode=quick&count=20' } };
  assert.equal(priceLineOf(set, { balance: 90, firstFull: { subject: 'economics', state: 'available' } }), 'This set uses 20 credits. You have 90.');
  const page = read('src/app/(app)/today/page.jsx');
  assert.match(page, /useFirstFullMock\(\{ userId, premium, subject: mockSubject \}\)/);
});

test('the quote read is shared per student and subject for a minute, a failed read is never kept, and a start forgets it', async () => {
  forgetFirstFullMock();
  let calls = [];
  const fetcher = async (url) => { calls.push(url); return { ok: true, json: async () => ({ freeReason: FIRST_FULL_MOCK_REASON, firstFullMock: 'available' }) }; };
  const [a, b] = await Promise.all([readFirstFullMock('u1', 'economics', { fetcher }), readFirstFullMock('u1', 'economics', { fetcher })]);
  assert.deepEqual([a, b], ['available', 'available']);
  assert.equal(calls.length, 1, 'one request for both');
  assert.match(calls[0], /^\/api\/practice\/quote\?subject=economics&mode=full&count=50$/);
  assert.equal(await readFirstFullMock('u1', 'accountancy', { fetcher }), 'available');
  assert.equal(calls.length, 2, 'another subject is its own read');
  forgetFirstFullMock('u1');
  await readFirstFullMock('u1', 'economics', { fetcher });
  assert.equal(calls.length, 3, 'forgotten after a start');
  calls = [];
  const failing = async () => { calls.push(1); return { ok: false, json: async () => null }; };
  forgetFirstFullMock();
  assert.equal(await readFirstFullMock('u2', 'economics', { fetcher: failing }), 'unknown');
  assert.equal(await readFirstFullMock('u2', 'economics', { fetcher: failing }), 'unknown');
  assert.equal(calls.length, 2, 'a failed read is asked again');
  assert.equal(await readFirstFullMock(null, 'economics', { fetcher }), 'unknown');
  assert.equal(await readFirstFullMock('u1', null, { fetcher }), 'unknown');
  assert.match(read('src/app/(app)/dashboard/DashboardPageClient.jsx'), /forgetFirstFullMock\(user\?\.id\);/);
  forgetFirstFullMock();
});

// ---- 2. Your papers ---------------------------------------------------------------------------------------------------------

test('Review is called Your papers on its page, in every state, as in the navigation (D106)', () => {
  const page = read('src/components/review/ReviewPage.jsx');
  assert.match(page, /const PAGE_TITLE = 'Your papers';/);
  assert.doesNotMatch(page, /<h1[^>]*>Review<\/h1>/);
  assert.equal((page.match(/<h1 className="display-md rvw-title">\{PAGE_TITLE\}<\/h1>/g) || []).length, 5, 'loading, failed, empty, the 1017 page and its fallback');
  assert.match(page, /<h2 id="rvw-empty-h">Your first paper lands here<\/h2>/);
  const chapters = read('src/components/review/ReviewChapters.jsx');
  assert.match(chapters, /<h1 className="display-md rvw-title rv8-title">Your papers<\/h1>/);
  assert.match(chapters, /<h2 id="rv8-pp-h">Recent papers<\/h2><span>Newest first<\/span>/, 'the list under the page title is not a second "Your papers"');
});

// ---- 3. Choose colleges -------------------------------------------------------------------------------------------------------

test('a fresh account’s Today: Choose colleges opens the Colleges page, and the line promises only what the card shows', () => {
  const card = read('src/components/today/TodayColleges.jsx');
  assert.doesNotMatch(card, /profile#colleges/);
  assert.match(card, /Choose up to 8 colleges you are aiming for\. Your first choice shows here with its 2026 cutoff\.<\/p><Link className="tm__pill" href="\/admission-compass">/);
  assert.match(card, />Open in Colleges<\/Link>/, 'the page has one name (W-067)');
});

// ---- 4. one paper, named --------------------------------------------------------------------------------------------------

test('a sentence about one paper names it: a mock by its name, any other paper as your practice set', () => {
  const lose = (rows) => ({ rows, saved: [], savedLine: '', line: { text: '' } });
  const row = { id: 'ch1', subject: 'economics', lost: 15, wrong: 3, blank: 0, open: [1, 2, 3] };
  const quick = { id: 'p1', name: 'Quick practice', subject: 'economics', subjectName: 'Economics', kind: 'practice', score: 20, of: 50 };
  const one = scopeOf({ papers: [quick], lose: lose([row]) }, 'economics', 'Economics');
  assert.equal(one.line.text, 'Your practice set lost 15 marks: 3 wrong answers.');
  const mock = { id: 'm1', name: 'Mock 2', subject: 'economics', subjectName: 'Economics', kind: 'full mock', score: 120, of: 250 };
  assert.equal(scopeOf({ papers: [mock], lose: lose([row]) }, 'economics', 'Economics').line.text, 'Mock 2 lost 15 marks: 3 wrong answers.');
  const later = { ...quick, id: 'p2', score: 25 };
  const trend = statsOf(scopeOf({ papers: [later, quick], lose: lose([row]) }, 'economics', 'Economics'), 'Economics').trend;
  assert.deepEqual(trend, { dir: 'up', text: 'Up 5 marks on your previous practice set' });
  const same = statsOf(scopeOf({ papers: [{ ...quick, id: 'p3' }, quick], lose: lose([row]) }, 'economics', 'Economics'), 'Economics').trend;
  assert.deepEqual(same, { dir: 'same', text: 'The same marks as your previous practice set' });
  assert.match(read('data/review_chapters.mjs'), /'Your practice set'/);
});

// ---- the tour reads as sentences ---------------------------------------------------------------------------------------------

test('the tour’s stops read as full sentences, and Colleges promises what Today draws', () => {
  const words = TOUR_STEPS_ALL.flatMap((s) => [s.body, ...Object.values(s.bodies || {})]);
  for (const line of words) {
    assert.doesNotMatch(line, /^(Opens|Your study days|Which DU|Every paper you sit and)/, line);
    assert.doesNotMatch(line, /[!—·]/, line);
    assert.match(line, /[.?]$/, line);
  }
  const colleges = TOUR_STEPS_ALL.find((s) => s.title === 'Colleges');
  assert.match(colleges.body, /Your first choice of college shows on Today\.$/);
});
