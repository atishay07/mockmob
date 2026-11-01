// node --test src/components/feed/exploreModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIRST_SHOWN, firstShown, moreShown, normaliseStem, pickSingles, savedLabel, syllabusTitle } from './exploreModel.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('R2 ruling 11: 3 single questions under the covers, then more on demand', () => {
  assert.equal(FIRST_SHOWN, 3);
  assert.equal(firstShown(), 3);
  assert.equal(moreShown(3), 9);
  assert.equal(moreShown(0), 9, 'never fewer than the first 3');
});

test('R2 ruling 10: "Saved 2" in the head; never "Saved 0"', () => {
  assert.equal(savedLabel(2), 'Saved 2');
  assert.equal(savedLabel(0), 'Saved');
  assert.equal(savedLabel(null), 'Saved');
  assert.equal(savedLabel(1200), 'Saved 1,200');
  assert.equal(savedLabel(2, { spoken: true }), 'Saved questions, 2');
  assert.equal(savedLabel(0, { spoken: true }), 'Saved questions');
});

test('R2 ruling 11: the v2 Explore page has no slogan head, no right column and no /api/learning/summary call', () => {
  const page = read('./DiscoveryFeed.jsx');
  const v2 = page.slice(page.indexOf('  if (v2) {'), page.indexOf('<div className="ex-page">'));
  assert.ok(v2.length > 500);
  assert.doesNotMatch(v2, /One question\. One useful step\./, 'the slogan goes from the v2 page');
  assert.doesNotMatch(v2, /<ArenaHead/);
  assert.doesNotMatch(v2, /ex-aside|Answer first\. Then ask why\./, 'no right column');
  assert.doesNotMatch(page, /fetch\(`\/api\/learning\/summary/, 'the dead call is gone (the field never arrived)');
  assert.doesNotMatch(page, /refreshSummary|solvedTotal \?|summaryRequest/);
  assert.doesNotMatch(page, /ex-record/, 'and its line');
  assert.match(v2, /className="ex-saved"/, 'Saved sits in the head');
  assert.match(page, /fetch\('\/api\/bookmarks\?count=1'/, 'the count alone, not the saved rows');
  assert.match(v2, /Single questions/);
  assert.match(page, /stableSingles\(questions, reset \? \[\] : current\.singles/, 'R3 X1, R4 client-code#3: the singles are picked (and kept in order), not sliced from the raw page');
  assert.match(v2, /singles\.slice\(0, shown\)/);
  assert.match(v2, /chapterTitle=\{titleOf\(question\)\} closed \/>/, 'stems first, options on tap');
  // The covers come right after the head row, before the single questions.
  assert.ok(v2.indexOf('<ExploreCovers') < v2.indexOf('Single questions'));
  assert.ok(v2.indexOf('className="ex-top"') < v2.indexOf('<ExploreCovers'));
});

test('R2: /api/bookmarks?count=1 answers with the head count only', () => {
  const route = read('../../app/api/bookmarks/route.js');
  assert.match(route, /searchParams\.get\('count'\) === '1'\) \{\s*return NextResponse\.json\(\{ count: await getBookmarkCount\(session\.user\.id\) \}\);/);
  // The count branch is after the sign-in check.
  assert.ok(route.indexOf("searchParams.get('count')") > route.indexOf("{ error: 'Unauthorized' }"));
});

// ---- Round 3 (packet R3-explore): X1 singles, X2 the Saved count, X3 canonical chapter titles -------------------------------
const row = (id, chapter, body, extra = {}) => ({ id, subject: 'accountancy', chapter, body, ...extra });

test('R3 X1: a stem is compared without case, punctuation or spacing', () => {
  assert.equal(normaliseStem('Define  Partnership.'), 'define partnership');
  assert.equal(normaliseStem('DEFINE partnership'), normaliseStem('Define partnership?'));
  assert.equal(normaliseStem(null), '');
});

test('R3 X1: singles come only from the syllabus, never repeat a stem, and spread over 3 chapters first', () => {
  const rows = [
    row(1, 'Accounting Equation', 'Assets are 80000 and liabilities 30000. Equity?'),
    row(2, 'Partnership Fundamentals', 'Define partnership.'),
    row(3, 'Partnership Fundamentals', 'define  partnership'),
    row(4, 'Partnership Fundamentals', 'What is a partnership deed?'),
    row(5, 'Goodwill Valuation', 'Goodwill is valued at:'),
    row(6, 'Admission of Partner', 'On admission the revaluation account is credited with:'),
  ];
  const picked = pickSingles(rows, { subject: 'accountancy' });
  assert.deepEqual(picked.map((q) => q.id), [2, 5, 6, 4], 'chapter spread first (2, 5, 6), then the rest in order; 1 is out of syllabus, 3 repeats 2');
  assert.ok(!picked.some((q) => q.chapter === 'Accounting Equation'), 'Class 11 "Accounting Equation" is out');
  assert.equal(new Set(picked.slice(0, 3).map((q) => q.chapter)).size, 3);
  assert.equal(new Set(picked.map((q) => normaliseStem(q.body))).size, picked.length, 'no two with the same stem');
});

test('R3 X1: with fewer chapters than 3 the first 3 still fill from what there is; an empty or odd page gives []', () => {
  const rows = [row(1, 'Partnership Fundamentals', 'A?'), row(2, 'Partnership Fundamentals', 'B?'), row(3, 'Partnership Fundamentals', 'C?'), row(4, 'Goodwill Valuation', 'D?')];
  assert.deepEqual(pickSingles(rows, { subject: 'accountancy' }).map((q) => q.id), [1, 4, 2, 3]);
  assert.deepEqual(pickSingles([], { subject: 'accountancy' }), []);
  assert.deepEqual(pickSingles(null), []);
  assert.deepEqual(pickSingles([{ id: 1, chapter: 'Partnership Fundamentals', body: 'X' }], { subject: 'accountancy' }).map((q) => q.id), [1], 'a row without a subject takes the page\'s');
  assert.deepEqual(pickSingles([{ id: 1, subject: 'accountancy', chapter: 'Partnership Fundamentals', body: '' }], {}), [], 'no stem, no question');
});

test('R3 X3: a chapter prints as the syllabus title (the one the roadmap uses), else null', () => {
  assert.equal(syllabusTitle('accountancy', 'Goodwill Valuation'), 'Goodwill: Nature and Valuation');
  assert.equal(syllabusTitle('accountancy', 'Partnership Fundamentals'), 'Accounting for Partnership: Basic Concepts');
  assert.equal(syllabusTitle('accountancy', 'Accounting Equation'), null);
  assert.equal(syllabusTitle('', 'Goodwill Valuation'), null);
});

test('R3 X1/X3: the page and the Saved list use these, and Saved prints canonical titles', () => {
  const page = read('./DiscoveryFeed.jsx');
  assert.match(page, /syllabusTitle\(question\.subject \|\| filters\.subject, question\.chapter\)/);
  assert.doesNotMatch(page, /resolveChapter/, 'one rule for a chapter title');
  const saved = read('../../app/(app)/saved/savedModel.mjs');
  assert.match(saved, /syllabusTitle\(question\.subject, question\.chapter\)/, 'X3, R4: a Saved chapter group is headed by its canonical title');
  assert.match(read('../../app/(app)/saved/SavedPageClient.jsx'), /groupByChapter\(visible\)/);
});

test('R3 X2: the head says "Saved" alone for 0, and the preview gives a brand-new student 0 saved', () => {
  assert.equal(savedLabel(0), 'Saved');
  const preview = read('../../app/preview/arena/ArenaPreviewClient.jsx');
  assert.match(preview, /fixture\.get\('student'\) === 'new'; return json\(\{ questions: none \? \[\]/);
});

test('R3 X1: the preview feed carries syllabus chapters, repeated stems and one out-of-syllabus chapter to prove the rules', () => {
  // previewFixtures.js imports extension-less modules (webpack only), so the examples are read from its source.
  const src = read('../../app/preview/arena/previewFixtures.js');
  const block = src.slice(src.indexOf('const EXAMPLES = ['), src.indexOf('const SUBJECT_EXAMPLES'));
  const chapters = [...block.matchAll(/chapter: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(chapters.includes('Accounting Equation'), 'the out-of-syllabus chapter is there to be left out');
  const bodies = [...block.matchAll(/body: '([^']+)'/g)].map((m) => m[1]);
  assert.equal(chapters.length, 5, 'Accountancy draws on 5 examples: 2 shared and 3 of its own');
  const rows = Array.from({ length: 29 }, (_, i) => ({ id: i, subject: 'accountancy', chapter: chapters[i % 5], body: bodies[i % 5] }));
  const picked = pickSingles(rows, { subject: 'accountancy' });
  assert.equal(new Set(picked.slice(0, 3).map((q) => q.chapter)).size, 3, '3 different chapters');
  assert.ok(picked.every((q) => q.chapter !== 'Accounting Equation'));
  assert.equal(new Set(picked.map((q) => normaliseStem(q.body))).size, picked.length);
  assert.ok(picked.length >= 4, 'More questions has something to show');
});

// ---- Round 3 (packet R3-explore): X5 Practice and C3 the subject tile's count --------------------------------------------------
test('R3 X5: Practice for Pro has no "Included", no "Your access ... Unlimited", a one-line hero and no second summary on a phone', () => {
  const src = read('../../app/(app)/dashboard/DashboardPageClient.jsx');
  assert.doesNotMatch(src, /'Included/, 'no "Included" or "Included with access" text on a tile, the bar or the card');
  assert.doesNotMatch(src, /Your access/);
  assert.doesNotMatch(src, /amount=\{isPremium \? 'unlimited'/, 'no Unlimited pill');
  assert.match(src, /!\(isPremium && quote\.launchable\) && quote\.reason/, 'the server\'s "Included with your Pro access (valid until ...)" is not drawn for Pro');
  assert.match(src, /\{costLabel \? <div data-wide="" data-emph=""><dt>Cost<\/dt>/, 'a Pro session has no Cost row');
  assert.match(src, /\{isPremium \|\| \(costNudgeShown && !proEnded\) \? null : \(\s*<section className="pr-panel" aria-labelledby="pr-access">/, 'the Pro panel is for Free and ended Pro only, and waits while the card\'s cost line asks (R4: one Pro mention in view)');
  assert.match(src, /<h1 className="display-md">What are we practising\?<\/h1>/);
  assert.match(src, /<p className="sr-only">Pick a subject and a way to practise\./, 'the lede stays for screen readers');
  const css = read('../../app/(app)/dashboard/practice.css');
  assert.match(css, /\.pr-ticket__top, \.app-shell \.pr \.pr-ticket\.pr-summary > dl \{ display: none; \}/, 'the phone card does not repeat the bar');
  assert.match(css, /\.pr-ticket\.pr-summary \{ padding-bottom: 16px; \}/, 'R4: the bar lands against the card (the 30 px gap and the -31 px margin cancel), so the card keeps its ordinary padding: no dead band inside it');
});

test('R3 C3: the subject tile\'s "2 chapters" (the length of the static subject list, not the syllabus or Learn) is dropped', () => {
  const src = read('../../app/(app)/dashboard/DashboardPageClient.jsx');
  assert.doesNotMatch(src, /\{total\} \{total === 1 \? 'chapter' : 'chapters'\}/);
  assert.doesNotMatch(src, /Chapters reset to all \$\{total\}/, 'and the note after a subject switch does not quote it either');
  assert.match(src, /Chapters reset to all chapters for/);
});

// ---- Round 3 (packet R3-explore): X7 no hydration error with &l2=off -------------------------------------------------------------
test('R3 X7: the Learn v2 flag is the same on the server and in the first client render (the address is read after hydration)', () => {
  const flag = read('../learn2/flag.js');
  assert.match(flag, /useSyncExternalStore\(noSubscription, l2OffNow, \(\) => false\)/, 'server snapshot: not off');
  assert.match(flag, /useSyncExternalStore\(noSubscription, navN1Now, \(\) => false\)/, '&nav=n1 is read the same hydration-safe way');
  assert.doesNotMatch(flag, /useSearchParams/, 'no search-params read that can differ from the server');
  const page = read('./DiscoveryFeed.jsx');
  assert.match(page, /const v2 = useLearn2On\(\);/);
  assert.doesNotMatch(page, /get\('l2'\)/, 'the page never reads the flag itself');
  assert.doesNotMatch(page, /typeof window/, 'and never branches on window while rendering');
  const covers = read('../learn2/feed/ExploreCovers.jsx');
  assert.match(covers, /useL2Off\(\)/);
  assert.doesNotMatch(covers, /get\('l2'\)/);
});
