// The kept profile (speed.md item 1, LK28): /api/auth/me starts at once, the last good answer draws the app on a hard load,
// and it is never shown for another student, after 7 days, or after sign-out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ME_CACHE_KEY, ME_CACHE_MAX_AGE_MS, clearCachedMe, readCachedMe, sessionUserIdFromCookies, writeCachedMe,
} from '../../src/lib/auth/meCache.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const NAME = 'sb-isrxrxzjocewrdureyhp-auth-token';
const b64url = (text) => Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sessionValue = (id, extra = {}) => `base64-${b64url(JSON.stringify({ access_token: 'a.b.c', user: { id, user_metadata: { name: 'Riyā' } }, ...extra }))}`;

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('the cookie user id: whole, chunked, JWT-only, and unreadable cookies', () => {
  assert.equal(sessionUserIdFromCookies([{ name: NAME, value: sessionValue('u-1') }]), 'u-1');
  const whole = sessionValue('u-2');
  const cut = Math.floor(whole.length / 2);
  // Chunks may arrive in any order; they join by index.
  assert.equal(sessionUserIdFromCookies([{ name: `${NAME}.1`, value: whole.slice(cut) }, { name: `${NAME}.0`, value: whole.slice(0, cut) }]), 'u-2');
  const jwt = `x.${b64url(JSON.stringify({ sub: 'u-3' }))}.y`;
  assert.equal(sessionUserIdFromCookies([{ name: NAME, value: `base64-${b64url(JSON.stringify({ access_token: jwt }))}` }]), 'u-3');
  assert.equal(sessionUserIdFromCookies([{ name: NAME, value: encodeURIComponent(JSON.stringify({ user: { id: 'u-4' } })) }]), 'u-4', 'an older plain JSON cookie');
  assert.equal(sessionUserIdFromCookies([{ name: NAME, value: 'base64-@@@' }]), null);
  assert.equal(sessionUserIdFromCookies([{ name: `${NAME}-code-verifier`, value: sessionValue('u-5') }]), null, 'the PKCE verifier is not a session');
  assert.equal(sessionUserIdFromCookies([{ name: NAME, value: '' }]), null);
  assert.equal(sessionUserIdFromCookies(null), null);
});

test('the kept profile is used only for the same student and for under 7 days', () => {
  const storage = memoryStorage();
  const me = { user: { id: 'u-1', name: 'Riya', creditBalance: 4 }, needsOnboarding: false };
  writeCachedMe(storage, me, 1000);
  assert.deepEqual(JSON.parse(storage.getItem(ME_CACHE_KEY)), { id: 'u-1', at: 1000, me });
  assert.deepEqual(readCachedMe(storage, 'u-1', 2000), me);
  assert.equal(readCachedMe(storage, 'u-2', 2000), null, 'another student never sees it');
  assert.equal(storage.getItem(ME_CACHE_KEY), null, 'and it is dropped');
  writeCachedMe(storage, me, 1000);
  assert.equal(readCachedMe(storage, 'u-1', 1000 + ME_CACHE_MAX_AGE_MS), null, '7 days old is too old');
  writeCachedMe(storage, me, 1000);
  clearCachedMe(storage);
  assert.equal(readCachedMe(storage, 'u-1', 2000), null, 'gone after sign-out');
  assert.equal(readCachedMe(null, 'u-1'), null, 'no storage, no profile');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  assert.equal(readCachedMe(broken, 'u-1'), null);
  assert.doesNotThrow(() => writeCachedMe(broken, me));
  assert.doesNotThrow(() => clearCachedMe(broken));
  storage.setItem(ME_CACHE_KEY, '{not json');
  assert.equal(readCachedMe(storage, 'u-1'), null);
});

test('the provider asks /api/auth/me at once, keeps the profile, and drops it on every way out', () => {
  const provider = read('src/components/AuthProvider.jsx');
  const check = provider.slice(provider.indexOf('const refreshPromise = (async () => {'), provider.indexOf('refreshPromiseRef.current = refreshPromise;'));
  // fetchMe starts before the Supabase client is awaited: the client read runs beside it.
  assert.ok(check.indexOf('let result = await fetchMe();') > 0);
  assert.ok(check.indexOf('const clientRead = (async () => {') < check.indexOf('let result = await fetchMe();'));
  assert.ok(check.indexOf('let session = await clientRead;') > check.indexOf('let result = await fetchMe();'), 'the client is awaited only when the server did not say ok');
  assert.match(check, /readCachedMe\(deviceStorage\(\), cookieId\)/, 'the kept profile must match the cookie user');
  assert.match(provider, /const applyUnauthenticated = useCallback\(\(\) => \{\s+if \(!mountedRef\.current\) return;\s+clearCachedMe\(deviceStorage\(\)\);/);
  assert.match(provider, /if \(keep\) writeCachedMe\(deviceStorage\(\), me\);/);
  const signOut = provider.slice(provider.indexOf('const signOut = useCallback'), provider.indexOf('const signOutOtherDevices'));
  assert.match(signOut, /clearCachedMe\(deviceStorage\(\)\)/);
});

test('/api/auth/me reads the wallet, the Play subscription and a pending deletion together', () => {
  const me = read('src/app/api/auth/me/route.js');
  assert.match(me, /await Promise\.all\(\[\s+getUnifiedWallet\(dbUser\)\.catch\(\(\) => null\),\s+Database\.getPlaySubscription\(dbUser\.id\)\.catch\(\(\) => null\),\s+pendingDeletionAt\(dbUser\.id, supabaseAdmin\(\)\),\s+\]\);/);
});
