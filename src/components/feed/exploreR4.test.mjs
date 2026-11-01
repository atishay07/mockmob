// node --test src/components/feed/exploreR4.test.mjs
// Round 4, packet R4-explore: the rules and strings this packet adds (Explore singles, Saved, Practice, the chapter page's labels).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stableSingles, pickSingles, syllabusTitle } from './exploreModel.mjs';
import { groupByChapter, practiseHref } from '../../app/(app)/saved/savedModel.mjs';
import { weakestLine } from '../../app/(app)/dashboard/repairsLine.mjs';
import { defaultOption, unitsFor } from '../../../data/cuet_syllabus.js';
import { chapterPlace, chapterShort } from '../../../data/learn/words.js';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const q = (id, chapter, extra = {}) => ({ id, subject: 'accountancy', chapter, body: `Stem number ${id} about ${chapter}`, ...extra });
const ids = (list) => list.map((x) => x.id);

// ---- client-code#3: Explore's singles keep a stable order once shown ----------------------------------------------------------
test('R4 client-code#3: a later page only appends; the question a student is on never moves', () => {
  const page1 = [q(1, 'Partnership Fundamentals'), q(2, 'Partnership Fundamentals'), q(3, 'Goodwill Valuation')];
  const first = stableSingles(page1, [], { subject: 'accountancy' });
  assert.deepEqual(ids(first), [1, 3, 2], 'the first fill takes its 3 from different chapters where it can');
  const page2 = [...page1, q(4, 'Admission of Partner'), q(5, 'Accounting Ratios')];
  // pickSingles alone would now re-pick the first 3 as 1, 3, 4 and push 2 down: exactly the shift the review found
  assert.deepEqual(ids(pickSingles(page2, { subject: 'accountancy' })).slice(0, 3), [1, 3, 4]);
  const second = stableSingles(page2, first, { subject: 'accountancy' });
  assert.deepEqual(ids(second), [1, 3, 2, 4, 5], 'the shown ones keep their places; new ones follow');
  assert.deepEqual(ids(stableSingles([...page2, q(6, 'Cash Flow Statement')], second, { subject: 'accountancy' })), [1, 3, 2, 4, 5, 6]);
});

test('R4 client-code#3: previous may be ids, a dropped question leaves a gap-free list, an out-of-syllabus one never appears', () => {
  const rows = [q(1, 'Partnership Fundamentals'), q(2, 'Goodwill Valuation'), q(3, 'Accounting Equation'), q(4, 'Admission of Partner')];
  assert.deepEqual(ids(stableSingles(rows, [4, 1], { subject: 'accountancy' })), [4, 1, 2]);
  assert.deepEqual(ids(stableSingles(rows, [9, 4, 4], { subject: 'accountancy' })), [4, 1, 2], 'an unknown id and a repeat are ignored');
  assert.deepEqual(stableSingles([], [1, 2]), []);
  assert.deepEqual(stableSingles(null, null), []);
  // a row in the server's { questions: row } shape keeps its place the same way
  const wrapped = [{ questions: q(1, 'Partnership Fundamentals') }, { questions: q(2, 'Goodwill Valuation') }];
  assert.deepEqual(stableSingles(wrapped, [2], { subject: 'accountancy' }).map((x) => x.questions.id), [2, 1]);
});

test('R4 client-code#3 and #8: the page keeps the order in the page state and resets its top-up count on a new filter', () => {
  const page = read('./DiscoveryFeed.jsx');
  assert.match(page, /const singles = page\.singles;/);
  assert.match(page, /singles: \[\], nextOffset: 0/, 'the empty page has no singles');
  assert.match(page, /useEffect\(\(\) => \{ topUps\.current = 0; \}, \[filterKey\]\);/, 'a new subject, chapter or level starts a new count');
  assert.doesNotMatch(page, /useMemo\(\(\) => pickSingles/);
});

// ---- owner-eye#11 and first-timer#16: Saved --------------------------------------------------------------------------------
test('R4 owner-eye#11: Saved groups its questions by chapter, one heading and one "Practise this chapter" per group', () => {
  const saved = [
    q('a', 'Admission of Partner'),
    q('b', 'Goodwill Valuation'),
    q('c', 'Admission of Partner'),
    { id: 'd', subject: 'economics', chapter: null, body: 'Stem d' },
  ];
  const groups = groupByChapter(saved);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.title), ['Admission of a Partner', 'Goodwill: Nature and Valuation', 'Economics / Business Economics'], 'canonical titles, in order of first appearance');
  assert.deepEqual(groups.map((g) => ids(g.items)), [['a', 'c'], ['b'], ['d']]);
  assert.deepEqual(groups.map((g) => g.practise), ['Practise this chapter', 'Practise this chapter', 'Practise Economics / Business Economics']);
  assert.equal(groups[0].href, practiseHref(saved[0]));
  assert.match(groups[0].href, /^\/test\?subject=accountancy&mode=quick&count=10&chapter=Admission\+of\+Partner$/, 'the stored name goes in the link, the title only on screen');
  assert.deepEqual(groupByChapter([]), []);
  assert.deepEqual(groupByChapter(null), []);
});

test('R4 owner-eye#11: a saved row is its stem (tap opens it) and one quiet Remove; the page says "Practise" once per group', () => {
  const page = read('../../app/(app)/saved/SavedPageClient.jsx');
  assert.doesNotMatch(page, /Practise \{question\.chapter/, 'no Practise key on a row');
  assert.match(page, /<h2 className="sv-ghead__t">\{group\.title\}<\/h2>/);
  assert.match(page, /\{group\.practise\}<\/Link>/);
  assert.match(page, /variant="saved" hideChapter/);
  assert.match(page, /\{pending \? 'Removing…' : 'Remove'\}/, 'the one quiet key on a row');
  assert.match(page, /onPractise\(href\)/, 'the right swipe still practises the chapter');
  const card = read('./QuestionCard.jsx');
  assert.doesNotMatch(card, /Try it again/, 'the stem opens the question; there is no separate "Try it again" key');
  assert.match(card, /className="ex-question__open" aria-expanded="false" onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(card, /savedList && !open/);
  const css = read('../../app/(app)/saved/saved.css');
  assert.match(css, /\.sv-gkey \{/);
  assert.doesNotMatch(css, /sv-act--go \{ flex: 1 1 auto/, 'no full-width lime key on a phone row');
});

// ---- ui-correctness#2: Practice reads the same chapters as Learn -----------------------------------------------------------
test('R4 ui-correctness#2: the preview serves Practice the syllabus chapters Learn plays (14 for Accountancy, with titles), not 5 examples', () => {
  const units = unitsFor('accountancy', { option: defaultOption('accountancy') });
  const chapters = units.flatMap((u) => u.chapters);
  assert.equal(chapters.length, 14, 'the count Learn shows until a student picks a Part 2 option');
  assert.equal(chapters[0].name, 'Partnership Fundamentals', 'the stored name is kept for the question query');
  assert.equal(chapters[0].title, 'Accounting for Partnership: Basic Concepts');
  assert.ok(!chapters.some((c) => /Computeri[sz]ed/.test(c.name)), 'Part 2 shows Analysis of Financial Statements until a student picks');
  const src = read('../../app/preview/arena/previewFixtures.js');
  assert.match(src, /unitsFor\('accountancy', \{ option: defaultOption\('accountancy'\) \}\)/);
  assert.match(src, /if \(subject === 'accountancy'\) return \{ grouped: true, units: accountancyUnits\(\) \};/);
  assert.doesNotMatch(src, /Original illustrative examples/, 'the 5-example unit is gone');
});

test('R4 ui-correctness#2: the Your papers line names the chapter by its syllabus title, counts first', () => {
  const insights = { state: 'ready', chapters: { ranked: [{ subject: 'accountancy', chapter: 'Partnership Fundamentals', wrong: 6, n: 10 }] } };
  const titleOf = (subject, chapter) => syllabusTitle(subject, chapter) || chapter;
  assert.equal(weakestLine(insights, titleOf), '6 wrong of 10 answered in Accounting for Partnership: Basic Concepts');
  assert.equal(weakestLine(insights), '6 wrong of 10 answered in Partnership Fundamentals', 'with no title rule the stored name is kept');
  assert.equal(weakestLine({ state: 'ready', chapters: { ranked: [{ wrong: 2, n: 5, chapter: '' }] } }), '2 wrong of 5 answered');
  assert.equal(weakestLine({ state: 'loading' }), null);
  assert.equal(weakestLine({ state: 'ready', chapters: { ranked: [] } }), null);
  assert.equal(weakestLine({ state: 'ready', chapters: { ranked: [{ chapter: 'X', wrong: 0, n: 0 }] } }), null, 'never "0 wrong of 0"');
  const repairs = read('../../app/(app)/dashboard/PracticeRepairs.jsx');
  assert.match(repairs, /weakestLine\(insights, chapterTitle\)/);
});

// ---- owner-eye#12, first-timer#10, ui-correctness#4: the goodwill question's true chapter ------------------------------------
test('R4 owner-eye#12: the incoming partner\'s goodwill question is tagged Admission of a Partner in the preview, never Basic Concepts', () => {
  const src = read('../../app/preview/arena/previewFixtures.js');
  const row = /\{ chapter: '([^']+)', body: 'Goodwill brought in by an incoming partner/.exec(src);
  assert.ok(row, 'the example is there');
  assert.equal(row[1], 'Admission of Partner');
  assert.equal(syllabusTitle('accountancy', row[1]), 'Admission of a Partner');
  // the preview's other stems about admission carry the same stored name, so one paper never splits a chapter in two
  assert.match(src, /const ADMISSION = \{ chapter: 'Admission of Partner'/);
  // and no stem about an incoming partner or admission is tagged Basic Concepts
  const bad = [...src.matchAll(/\{ chapter: '(Partnership Fundamentals)', body: '([^']*)'/g)].filter(([, , body]) => /incoming partner|admission|admitted/i.test(body));
  assert.deepEqual(bad, []);
});

// ---- owner-eye#7, ui-correctness#17, client-code#9: Practice -----------------------------------------------------------------
test('R4 client-code#9: Pro never draws the Cost row or the bar\'s cost slot, not even while the quote loads', () => {
  const src = read('../../app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(src, /: isPremium \? '' : 'Checking';/, 'the Cost row');
  assert.match(src, /: isPremium \? '' : \(modeBadge\(effectiveModeId\)\.text \|\| 'Checking'\);/, 'the bar\'s cost slot');
});

test('R4 owner-eye#7: on Free the Pro block waits while the cost line asks, and the card keeps its ordinary padding', () => {
  const src = read('../../app/(app)/dashboard/DashboardPageClient.jsx');
  assert.match(src, /isPremium \|\| \(costNudgeShown && !proEnded\) \? null : \(/);
  const css = read('../../app/(app)/dashboard/practice.css');
  assert.doesNotMatch(css, /pr-summary \{ padding-bottom: 48px; \}/, 'the 48 px reserved for an overlap that never happens is gone');
});

// ---- ruling N on the chapter page and the covers -----------------------------------------------------------------------------
test('R4 ruling N: the chapter page and the covers draw chapterPlace / chapterShort of `place`, never "Part 1, Ch 2"', () => {
  assert.equal(chapterPlace({ n: 5, of: 14 }), 'Chapter 5 of 14');
  assert.equal(chapterShort({ n: 5, of: 14 }), 'Chapter 5');
  assert.equal(chapterPlace(undefined), '');
  const page = read('../learn2/chapter/ChapterPage.jsx');
  assert.match(page, /chapterShort\(next\?\.place \|\| added\?\.place\)/, 'the next chapter pile');
  assert.match(page, /<Pile key=\{p\.id\} pile=\{p\} index=\{i\} minutes=\{minutes\}/);
  const model = read('../learn2/chapter/chapterModel.mjs');
  assert.match(model, /ref: chapterPlace\(chapter\.place\) \|\| null/);
  assert.doesNotMatch(model, /partShort\(chapter\.partTitle\), chapter\.ref/, 'the NCERT number is not a chapter label');
  const covers = read('../learn2/feed/ExploreCovers.jsx');
  assert.match(covers, /\{ref \? <span className="fxc-ref">\{ref\}<\/span> : null\}/, 'no place, no label (no empty row either)');
  assert.match(covers, /media\.kind === 'questions' \|\| media\.kind === 'cards'/);
});

test('R4 owner-eye#10: the covers\' height follows the fullest cover, with a floor, so the middle is not a fixed gap', () => {
  const css = read('../learn2/feed/covers.css');
  assert.match(css, /min-height: var\(--h\)/);
  assert.match(css, /\.fxc-media\[data-noref\] \{ grid-template-rows: minmax\(0, 1fr\); \}/);
  assert.doesNotMatch(css, /--h: 356px|--h: 368px|--h: 338px/, 'no fixed round-3 heights');
});
