import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OUT_OF_SCOPE_PREFIXES, ROUTE_MOVES, matchesRoute, moveForPath, nextRedirects, nextRewrites, placeForPath, routeMove } from '../route_moves.mjs';
import { appPageRoutes, resolvesHref } from './ia_helpers.mjs';

// Every row of plan section 2.4 (the "(new) Start" row is /start).
const PLAN_ROWS = [
  '/', '/today', '/dashboard', '/start', '/test', '/result/[id]', '/review', '/analytics', '/saved', '/mentor', '/recovery', '/explore',
  '/learn', '/learn/[id]', '/learn/summary', '/study/[id]', '/progress', '/profile', '/you', '/admission-compass', '/leaderboard', '/rival',
  '/upload', '/my-uploads', '/moderation', '/onboarding', '/login', '/signup', '/pricing', '/pricing/prepos', '/features', '/coming-soon',
  '/about', '/contact', '/cuet-2027', '/cuet-cutoff-calculator', '/cuet-subject-combination', '/cuet-mock-test-free',
  '/cuet-practice-tests-online', '/cuet-previous-year-questions', '/cuet/[subject]', '/privacy', '/terms', '/refunds', '/account-deletion',
  '/practice', '/ask',
];

test('route_moves covers every route in plan 2.4', () => {
  for (const from of PLAN_ROWS) assert.ok(routeMove(from), from);
  assert.equal(new Set(ROUTE_MOVES.map((m) => m.from)).size, ROUTE_MOVES.length, 'no duplicate rows');
});

test('every page in src/app has a move, apart from the out-of-scope prefixes', () => {
  for (const route of appPageRoutes()) {
    if (OUT_OF_SCOPE_PREFIXES.some((p) => route.startsWith(p.replace(/\/$/, '')))) continue;
    assert.ok(routeMove(route), `no move for ${route}`);
  }
});

test('the only new paths are /practice, /ask and /start (/you is built)', () => {
  const pages = appPageRoutes();
  const added = ROUTE_MOVES.filter((m) => !pages.some((p) => matchesRoute(p, m.from.replace(/\[.+?\]/g, 'x')) || p === m.from)).map((m) => m.from).sort();
  assert.deepEqual(added, ['/ask', '/practice', '/start']);
});

test('every redirect is a 308 to a place that resolves, and keeps the query (Next passes it through)', () => {
  for (const m of ROUTE_MOVES.filter((r) => r.action === 'redirect')) {
    assert.equal(m.status, 308, m.from);
    assert.ok(resolvesHref(m.to), `${m.from} -> ${m.to}`);
    assert.notEqual(moveForPath(m.to)?.action, 'redirect', `${m.from} must not redirect twice`);
  }
  const all = nextRedirects({ includePageLevel: true });
  assert.ok(all.every((r) => r.permanent === true && r.source.startsWith('/') && r.destination.startsWith('/')));
  assert.deepEqual(all.map((r) => r.source).sort(), ['/coming-soon', '/features', '/my-uploads', '/pricing/prepos', '/progress', '/recovery']);
  // next.config.mjs carries every one but /recovery, which the page decides (it opens again once the
  // old recovery episodes are released). /progress goes to You now that /you is built.
  assert.deepEqual(nextRedirects().map((r) => r.source).sort(), ['/coming-soon', '/features', '/my-uploads', '/pricing/prepos', '/progress']);
  assert.deepEqual(nextRedirects().find((r) => r.source === '/features'), { source: '/features', destination: '/#how-it-works', permanent: true });
});

test('next.config.mjs is built from route_moves: redirects and rewrites come from the data', async () => {
  const config = (await import('../../next.config.mjs')).default;
  const redirects = await config.redirects();
  const rewrites = await config.rewrites();
  for (const r of nextRedirects()) assert.ok(redirects.some((x) => x.source === r.source && x.destination === r.destination && x.permanent === true), r.source);
  assert.ok(!redirects.some((x) => x.source === '/recovery'), '/recovery is decided by its page');
  for (const r of nextRewrites()) assert.ok(rewrites.some((x) => x.source === r.source && x.destination === r.destination), r.source);
  assert.ok(rewrites.some((x) => x.source === '/.well-known/assetlinks.json'), 'the Android asset links rewrite stays');
});

test('every page-level redirect page exists and redirects to the same place', () => {
  const page = readFileSync(new URL('../../src/app/(app)/recovery/page.jsx', import.meta.url), 'utf8');
  assert.match(page, /permanentRedirect\(REVIEW_HREF\)/);
  assert.equal(routeMove('/recovery').to, '/review');
});

test('SEO redirects are exactly the three public ones (plan 9.1)', () => {
  assert.deepEqual(ROUTE_MOVES.filter((m) => m.seo).map((m) => m.from).sort(), ['/coming-soon', '/features', '/pricing/prepos']);
});

test('rewrites: /practice, /ask and /start serve existing pages', () => {
  const rewrites = nextRewrites();
  assert.deepEqual(rewrites.map((r) => r.source).sort(), ['/ask', '/practice', '/start']);
  const pages = appPageRoutes();
  for (const r of rewrites) assert.ok(pages.some((p) => matchesRoute(p, r.destination.split('?')[0])), r.destination);
});

test('the Do these next prefill keeps working: /dashboard stays a kept Practice page', () => {
  const m = routeMove('/dashboard');
  assert.equal(m.action, 'keep');
  assert.equal(placeForPath('/dashboard?subject=accountancy&mode=quick&count=10&chapter=Accounting%20Ratios'), 'practice');
});

test('places follow the app (ActionRouter): result over Review, analytics in Review, profile in You', () => {
  assert.equal(placeForPath('/result/abc'), 'review');
  assert.equal(placeForPath('/analytics'), 'review');
  assert.equal(placeForPath('/mentor'), 'review');
  assert.equal(placeForPath('/saved'), 'review');
  assert.equal(placeForPath('/explore'), 'practice');
  assert.equal(placeForPath('/learn/123'), 'practice');
  assert.equal(placeForPath('/profile'), 'you');
  assert.equal(placeForPath('/admission-compass'), 'you');
  assert.equal(placeForPath('/test'), 'focus');
  assert.equal(placeForPath('/cuet/accountancy'), 'footer');
});

test('NTA and Repair v3 routes are never moved', () => {
  assert.equal(routeMove('/test').action, 'unchanged');
  assert.equal(routeMove('/result/[id]').action, 'unchanged');
  assert.equal(routeMove('/result/[id]').owner, 'Repair v3');
});

test('the sitemap lists no moved page: every entry is a page, none is a redirect or rewrite source', async () => {
  const { publicRoutes } = await import('../../src/lib/seo.js');
  const moved = new Set(ROUTE_MOVES.filter((m) => m.action === 'redirect' || m.action === 'rewrite').map((m) => m.from));
  for (const route of publicRoutes.filter((r) => r.sitemap !== false)) {
    assert.ok(!moved.has(route.path), `${route.path} moved, so it leaves the sitemap`);
    assert.ok(resolvesHref(route.path), route.path);
  }
});
