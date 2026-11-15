// M6 (security audit 15 Nov 2026): the referral device id comes from the server-set mm_dev cookie only. The real route
// handlers run with auth, Supabase and the rate limiter stubbed; the RPC arguments they send are checked.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { NextRequest } from 'next/server.js';
import { hashFor } from '../../src/lib/server/referrals.js';

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT_URL = pathToFileURL(`${root}/`).href;
const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const ROOT = ${JSON.stringify(ROOT_URL)};
const STUBS = {
  'server-only': 'export {};',
  '@/lib/auth': 'export async function auth() { return globalThis.__refSession; }',
  '@/lib/supabase': 'export function supabaseAdmin() { return { rpc: async (name, args) => { globalThis.__refRpc.push([name, args]); return { data: globalThis.__refAnswer(name), error: null }; } }; }',
  '@/lib/server/rateLimit': 'export function checkRateLimit() { return { allowed: true }; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (specifier === 'next/server') return next('next/server.js', context);
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const ENV = { REFERRALS_ENABLED: 'true', REFERRAL_HASH_SECRET: 'referral-test-secret' };
Object.assign(process.env, ENV);
const claim = await import(pathToFileURL(resolvePath(root, 'src/app/api/referrals/claim/route.js')).href);
const status = await import(pathToFileURL(resolvePath(root, 'src/app/api/referrals/route.js')).href);
const invite = await import(pathToFileURL(resolvePath(root, 'src/app/r/[code]/route.js')).href);
const { inviteLanding } = await import(pathToFileURL(resolvePath(root, 'src/lib/referrals/friendInvite.mjs')).href);

const COOKIE_DEVICE = 'cookiedevice0000000000000001';
const BODY_DEVICE = 'fresh-random-device-000000099';

beforeEach(() => {
  globalThis.__refSession = { user: { id: 'friend_1' } };
  globalThis.__refRpc = [];
  globalThis.__refAnswer = (name) => (name === 'mm_referral_attach' ? { ok: true, state: 'joined' } : { ok: true, code: 'ABCDEFG' });
});

const claimRequest = (body, cookie = null) => new NextRequest('http://localhost/api/referrals/claim', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': '49.36.1.2', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

test('a device sent in the claim body is ignored; the mm_dev cookie is what the database sees', async () => {
  const res = await claim.POST(claimRequest({ code: 'ABCDEFG', device: BODY_DEVICE }, `mm_dev=${COOKIE_DEVICE}`));
  assert.equal(res.status, 200);
  const [[name, args]] = globalThis.__refRpc;
  assert.equal(name, 'mm_referral_attach');
  // Before the fix the body device won, so every throwaway account could send a fresh one.
  assert.equal(args.p_device_hash, hashFor('device', COOKIE_DEVICE, ENV));
  assert.notEqual(args.p_device_hash, hashFor('device', BODY_DEVICE, ENV));
});

test('without the cookie a body device still does not count: no device hash at all', async () => {
  await claim.POST(claimRequest({ code: 'ABCDEFG', device: BODY_DEVICE }));
  assert.equal(globalThis.__refRpc[0][1].p_device_hash, null);
  assert.equal(globalThis.__refRpc[0][1].p_ip_hash, hashFor('network', '49.36.1.2', ENV), 'the network hold still applies');
});

test('the inviter\'s device comes from the cookie too: a ?device= is ignored, and a missing cookie is set by the server', async () => {
  globalThis.__refSession = { user: { id: 'inviter_1' } };
  const withCookie = new NextRequest(`http://localhost/api/referrals?device=${BODY_DEVICE}`, { headers: { cookie: `mm_dev=${COOKIE_DEVICE}` } });
  await status.GET(withCookie);
  assert.equal(globalThis.__refRpc[0][1].p_device_hash, hashFor('device', COOKIE_DEVICE, ENV));

  const noCookie = await status.GET(new NextRequest(`http://localhost/api/referrals?device=${BODY_DEVICE}`));
  assert.equal(globalThis.__refRpc[1][1].p_device_hash, null);
  assert.match(noCookie.headers.get('set-cookie') || '', /mm_dev=[A-Za-z0-9]{32}.*HttpOnly/i, 'the server sets its own device cookie');
});

// ================================================================ P1: Android goes to Play only once the listing is public

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const INSTAGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A146B) AppleWebKit/537.36 Instagram 350.0.0 Android';

test('P1: with PLAY_LISTING_PUBLIC unset an Android visitor gets web sign-up with the invite kept, like everyone else', async () => {
  delete process.env.PLAY_LISTING_PUBLIC;
  for (const ua of [ANDROID_CHROME, INSTAGRAM_ANDROID]) {
    assert.deepEqual(inviteLanding({ rawCode: 'k7p2m9x', userAgent: ua, live: true }), { code: 'K7P2M9X', to: 'signup', url: null });
    const res = await invite.GET(new NextRequest('http://localhost/r/k7p2m9x', { headers: { 'user-agent': ua } }), { params: Promise.resolve({ code: 'k7p2m9x' }) });
    assert.equal(res.status, 307);
    // Before the fix: https://play.google.com/store/apps/details?id=in.mockmob.app..., a listing that answers 404.
    assert.equal(res.headers.get('location'), 'http://localhost/signup?invite=1');
    assert.match(res.headers.get('set-cookie') || '', /mm_invite=/, 'the invite is kept for the web sign-up');
  }
  assert.equal(inviteLanding({ rawCode: 'K7P2M9X', userAgent: ANDROID_CHROME, live: true, env: { PLAY_LISTING_PUBLIC: '1' } }).to, 'signup', 'only the exact value opens it');
});

test('P1: with PLAY_LISTING_PUBLIC=true an Android visitor goes to the Play listing with the code in the referrer', async () => {
  process.env.PLAY_LISTING_PUBLIC = 'true';
  try {
    const res = await invite.GET(new NextRequest('http://localhost/r/k7p2m9x', { headers: { 'user-agent': ANDROID_CHROME } }), { params: Promise.resolve({ code: 'k7p2m9x' }) });
    assert.equal(res.status, 307);
    assert.match(res.headers.get('location'), /^https:\/\/play\.google\.com\/store\/apps\/details\?id=in\.mockmob\.app&referrer=invite%3DK7P2M9X$/);
    assert.match(res.headers.get('set-cookie') || '', /mm_invite=/);
  } finally {
    delete process.env.PLAY_LISTING_PUBLIC;
  }
});
