// node --test src/components/feed/exploreModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIRST_SHOWN, firstShown, moreShown, savedLabel } from './exploreModel.mjs';

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
  assert.match(v2, /page\.questions\.slice\(0, shown\)/);
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
