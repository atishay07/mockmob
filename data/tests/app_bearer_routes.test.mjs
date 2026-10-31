import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

// Every exported handler in these routes must take (request) and call auth(request).
const BEARER_ROUTES = {
  'src/app/api/learning/summary/route.js': ['GET'],
  'src/app/api/leaderboard/route.js': ['GET'],
  'src/app/api/users/[id]/route.js': ['GET', 'PATCH'],
  'src/app/api/bookmarks/route.js': ['GET', 'POST'],
  'src/app/api/questions/feed/route.js': ['GET'],
  'src/app/api/questions/explore/route.js': ['GET'],
  'src/app/api/questions/[id]/interact/route.js': ['POST'],
  'src/app/api/questions/[id]/vote/route.js': ['POST'],
  'src/app/api/ai/credits/route.js': ['GET'],
  'src/app/api/me/credits/route.js': ['GET'],
  'src/app/api/ai/mentor/history/route.js': ['GET'],
  'src/app/api/ai/usage/route.js': ['GET'],
};

// The Learn v2 routes (BUILD-1101 Part 2): each handler takes (request) and goes through learnHttp, whose first step after the
// flag is auth(request) (bearer for the app, then the cookie), so the app calls them as the website does.
const LEARN_ROUTES = {
  'src/app/api/learn/subject/route.js': ['GET'],
  'src/app/api/learn/runs/route.js': ['POST'],
  'src/app/api/learn/runs/preview/route.js': ['POST'],
  'src/app/api/learn/runs/[id]/route.js': ['GET'],
  'src/app/api/learn/runs/[id]/answer/route.js': ['POST'],
  'src/app/api/learn/runs/[id]/rate/route.js': ['POST'],
  'src/app/api/learn/runs/[id]/end/route.js': ['GET'],
  'src/app/api/learn/cards/route.js': ['GET'],
  'src/app/api/learn/shelves/route.js': ['GET'],
  'src/app/api/learn/search/route.js': ['GET'],
  'src/app/api/learn/covers/route.js': ['GET'],
};

for (const [file, methods] of Object.entries(LEARN_ROUTES)) {
  test(`${file} authenticates with auth(request) through learnHttp`, () => {
    const src = read(file);
    for (const m of methods) {
      assert.match(src, new RegExp('export async function ' + m + '[(]request'), m + ' must accept request');
    }
    assert.match(src, /\blearnHttp\(request,/, 'must call learnHttp(request, ...)');
    assert.doesNotMatch(src, /\bauth\(\s*\)/, 'must not call bare auth()');
  });
}

test('learnHttp authenticates with auth(request), never bare auth()', () => {
  const src = read('src/lib/server/learnHttp.js');
  assert.match(src, /\bauth\(request\)/);
  assert.doesNotMatch(src, /\bauth\(\s*\)/);
});

const COOKIE_ONLY_ROUTES = [
  'src/app/api/ai/credits/order/route.js',
  'src/app/api/ai/credits/verify/route.js',
  'src/app/api/billing/cancel/route.js',
  'src/app/api/billing/webhook/route.js',
];

for (const [file, methods] of Object.entries(BEARER_ROUTES)) {
  test(`${file} authenticates with auth(request)`, () => {
    const src = read(file);
    for (const m of methods) {
      assert.match(src, new RegExp('export async function ' + m + '[(]request'), m + ' must accept request');
    }
    assert.match(src, /\bauth\(request\)/, 'must call auth(request)');
    assert.doesNotMatch(src, /\bauth\(\s*\)/, 'must not call bare auth()');
  });
}

for (const file of COOKIE_ONLY_ROUTES) {
  test(`${file} stays cookie-only`, () => {
    const src = read(file);
    assert.doesNotMatch(src, /\bauth\(request\)/, 'payment routes must not accept bearer tokens');
    if (!file.includes('webhook')) assert.match(src, /does not sell in v1/);
  });
}

test('moderation queue requires a moderator or admin', () => {
  const src = read('src/app/api/questions/pending/route.js');
  assert.match(src, /auth\(request\)/);
  assert.match(src, /status: 401/);
  assert.match(src, /status: 403/);
});

test('the legacy generic billing webhook is retired: 410, no secret, no grant', () => {
  const src = read('src/app/api/billing/webhook/route.js');
  assert.match(src, /status: 410/);
  assert.doesNotMatch(src.split(/\r?\n/).filter((line) => !line.trim().startsWith('//')).join(' '), /timingSafeEqual|supabaseAdmin|is_premium/);
});

test('auth.ts has no demo provider or insecure fallbacks', () => {
  const src = read('src/lib/auth.ts');
  assert.doesNotMatch(src, /Credentials/);
  assert.doesNotMatch(src, /'mock'/);
  assert.doesNotMatch(src, /fallback_secret/);
});
