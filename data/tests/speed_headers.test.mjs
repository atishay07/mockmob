// Cache headers and request shape for the public reads (speed.md items 7 and 11, LK28).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('/api/stats: the CDN keeps the daily counts for an hour; the 503 is never cached', () => {
  const stats = read('src/app/api/stats/route.js');
  assert.match(stats, /'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'/);
  const unavailable = stats.slice(stats.indexOf("inventory?.state !== 'available'"), stats.indexOf('publicStatsView(inventory)'));
  assert.doesNotMatch(unavailable, /CDN-Cache-Control|s-maxage/);
  assert.doesNotMatch(stats.slice(stats.indexOf('} catch (error) {')), /s-maxage/);
});

test('/api/questions/feed: auth starts first, votes and bookmarks together, CDN cache only for a reader with no session', () => {
  const feed = read('src/app/api/questions/feed/route.js');
  assert.ok(feed.indexOf('const sessionRead = auth(request).catch(() => null);') < feed.indexOf('await buildQuery(true)'), 'who is reading starts before the question read');
  assert.equal((feed.match(/auth\(request\)/g) || []).length, 1);
  assert.match(feed, /userId \? await Promise\.all\(\[\s+Database\.getUserVotes\(userId, questionIds\),/);
  assert.match(feed, /const cacheable = !userId && signedOutReader\(request\);/);
  assert.match(feed, /if \(request\.headers\.get\('authorization'\)\) return false;/);
  assert.match(feed, /return !hasSupabaseSessionCookie\(cookies\);/);
  assert.match(feed, /'CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', Vary: 'Cookie, Authorization'/);
  assert.match(feed, /cacheable \? \{ headers: SIGNED_OUT_CACHE \} : undefined/);
  // A cached answer carries no per-user field.
  assert.match(feed, /userVote: voteMap\.get\(r\.id\) \|\| null,/);
  assert.match(feed, /\[new Map\(\), new Set\(\)\]/);
});

test('small server cuts: the summary reads the user beside its other reads; the published cards are built once per suspended set', () => {
  const summary = read('src/app/api/learning/summary/route.js');
  assert.match(summary, /await Promise\.all\(\[\s+Database\.getUserById\(session\.user\.id\),/);
  assert.doesNotMatch(summary, /const user = await Database\.getUserById/);
  const kc = read('src/lib/server/keycards.js');
  assert.match(kc, /if \(publishedMemo\.off === off && publishedMemo\.value\) return publishedMemo\.value;/);
  assert.match(kc, /publishedMemo = \{ off, value \};/);
  // The suspended set is a new Set only when it is re-read, so the memo follows every refresh.
  assert.match(kc, /reports = \{ at: now\(\), set: new Set\(rows\.map\(\(r\) => r\.card_id\)\) \};/);
});
