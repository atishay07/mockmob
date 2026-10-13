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
  'src/app/api/users/[id]/route.js': ['GET', 'PATCH'],
  'src/app/api/bookmarks/route.js': ['GET', 'POST'],
  'src/app/api/questions/feed/route.js': ['GET'],
  'src/app/api/questions/explore/route.js': ['GET'],
  'src/app/api/questions/[id]/interact/route.js': ['POST'],
  'src/app/api/questions/[id]/vote/route.js': ['POST'],
  'src/app/api/ai/credits/route.js': ['GET'],
  'src/app/api/ai/mentor/history/route.js': ['GET'],
  'src/app/api/ai/usage/route.js': ['GET'],
};

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

test('billing webhook compares the secret in constant time', () => {
  const src = read('src/app/api/billing/webhook/route.js');
  assert.match(src, /timingSafeEqual/);
  assert.doesNotMatch(src, /provided !== secret/);
});

test('auth.ts has no demo provider or insecure fallbacks', () => {
  const src = read('src/lib/auth.ts');
  assert.doesNotMatch(src, /Credentials/);
  assert.doesNotMatch(src, /'mock'/);
  assert.doesNotMatch(src, /fallback_secret/);
});
