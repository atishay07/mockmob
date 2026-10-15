// Sign-in reliability (13 Oct 2026): the session-refresh proxy, the callback parser, the
// post-sign-in redirect and the transient-error rules. The proxy cases drive the real
// @supabase/ssr server client and a real NextRequest against a fake Supabase Auth server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest, NextResponse } from 'next/server.js';
import { createServerClient } from '@supabase/ssr';
import { refreshSupabaseSession, applyRefCapture } from '../../src/lib/server/sessionProxy.js';
import { safeNextPath, rememberNextPath, takeNextPath, postSignInPath, arenaHomePath, loginPathFor } from '../../src/lib/auth-redirect.js';
import { readCallbackParams } from '../../src/lib/auth-callback.js';
import { isTransientAuthError, isDeadSessionError, hasSupabaseSessionCookie } from '../../src/lib/supabase-auth-errors.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const SUPABASE_URL = 'https://abcdproject.supabase.co';
const ANON_KEY = 'anon-test-key';
const COOKIE = 'sb-abcdproject-auth-token';

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function jwt(payload) {
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.c2ln`;
}

function session({ expiresInSeconds, refreshToken = 'refresh-old', sub = 'user-1' }) {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return {
    access_token: jwt({ sub, email: 'student@example.com', exp, role: 'authenticated', aud: 'authenticated' }),
    refresh_token: refreshToken,
    token_type: 'bearer',
    expires_in: Math.max(0, expiresInSeconds),
    expires_at: exp,
    user: { id: sub, email: 'student@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
}

function sessionCookie(value) {
  return `${COOKIE}=base64-${b64url(JSON.stringify(value))}`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// A fake Supabase Auth server. `refresh` decides the /token?grant_type=refresh_token reply.
function fakeAuthServer({ refresh } = {}) {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push(`${init.method || 'GET'} ${url.pathname}${url.search}`);
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      return refresh();
    }
    if (url.pathname === '/auth/v1/user') {
      return json({ id: 'user-1', email: 'student@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} });
    }
    return json({ message: 'not found' }, 404);
  };
  return { fetch, calls };
}

function request(path, cookie) {
  return new NextRequest(`https://www.mockmob.in${path}`, cookie ? { headers: { cookie } } : {});
}

function run(req, server, extra = {}) {
  return refreshSupabaseSession(req, {
    NextResponse,
    createServerClient,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: ANON_KEY,
    clientOptions: { global: { fetch: server.fetch } },
    ...extra,
  });
}

function setCookies(response) {
  return response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
}

test('proxy: anonymous visitors never reach Supabase', async () => {
  let created = 0;
  const { response, outcome } = await refreshSupabaseSession(request('/'), {
    NextResponse,
    createServerClient: (...args) => { created += 1; return createServerClient(...args); },
    supabaseUrl: SUPABASE_URL,
    supabaseKey: ANON_KEY,
  });
  assert.equal(outcome, 'anonymous');
  assert.equal(created, 0);
  assert.deepEqual(setCookies(response), []);
});

test('proxy: an expired access token is refreshed and both request and response get the new cookies', async () => {
  const fresh = session({ expiresInSeconds: 3600, refreshToken: 'refresh-new' });
  const server = fakeAuthServer({ refresh: () => json(fresh) });
  const req = request('/dashboard', sessionCookie(session({ expiresInSeconds: -60 })));
  const { response, outcome } = await run(req, server);

  assert.equal(outcome, 'ok');
  assert.ok(server.calls.some((c) => c.startsWith('POST /auth/v1/token?grant_type=refresh_token')), server.calls.join(', '));
  const written = setCookies(response).find((c) => c.startsWith(`${COOKIE}=`));
  assert.ok(written, 'response must carry the refreshed session cookie');
  const value = written.split(';')[0].slice(COOKIE.length + 1);
  assert.match(Buffer.from(value.replace(/^base64-/, ''), 'base64url').toString(), /refresh-new/);
  assert.match(written, /Max-Age=\d{7,}/i, 'session cookie must be long-lived (persists across browser restarts)');
  // Server Components in this same request must read the fresh token, not the spent one.
  const forwarded = req.cookies.get(COOKIE)?.value || '';
  assert.match(Buffer.from(forwarded.replace(/^base64-/, ''), 'base64url').toString(), /refresh-new/);
  assert.match(response.headers.get('cache-control') || '', /no-store/, 'auth cookie responses must not be cached');
});

test('proxy: a valid session is left alone (no cookie rewrite)', async () => {
  const server = fakeAuthServer({ refresh: () => { throw new Error('must not refresh'); } });
  const { response, outcome } = await run(request('/today', sessionCookie(session({ expiresInSeconds: 3000 }))), server);
  assert.equal(outcome, 'ok');
  assert.deepEqual(setCookies(response).filter((c) => c.startsWith('sb-')), []);
});

test('proxy: a network failure during refresh keeps the student signed in', async () => {
  const server = fakeAuthServer({ refresh: () => { throw new TypeError('fetch failed'); } });
  const { response, outcome } = await run(request('/review', sessionCookie(session({ expiresInSeconds: -60 }))), server, { timeoutMs: 1500 });
  assert.ok(['transient', 'timeout'].includes(outcome), outcome);
  const cleared = setCookies(response).filter((c) => c.startsWith(`${COOKIE}=`));
  assert.deepEqual(cleared, [], 'cookies must not be deleted on a transient failure');
});

test('proxy: a Supabase 5xx during refresh keeps the cookies', async () => {
  const server = fakeAuthServer({ refresh: () => json({ message: 'upstream down' }, 503) });
  const { response, outcome } = await run(request('/review', sessionCookie(session({ expiresInSeconds: -60 }))), server, { timeoutMs: 1500 });
  assert.ok(['transient', 'timeout'].includes(outcome), outcome);
  assert.deepEqual(setCookies(response).filter((c) => c.startsWith(`${COOKIE}=`)), []);
});

test('proxy: a revoked refresh token signs out (cookies cleared)', async () => {
  const server = fakeAuthServer({
    refresh: () => json({ code: 'refresh_token_not_found', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400),
  });
  const { response, outcome } = await run(request('/review', sessionCookie(session({ expiresInSeconds: -60 }))), server);
  assert.equal(outcome, 'signed_out');
  const cleared = setCookies(response).find((c) => c.startsWith(`${COOKIE}=`));
  assert.ok(cleared && /Max-Age=0/i.test(cleared), 'dead session cookie is removed');
});

test('proxy: a hung Supabase call is cut off and the page still renders', async () => {
  const server = fakeAuthServer({ refresh: () => new Promise(() => {}) });
  const started = Date.now();
  const { response, outcome } = await run(request('/review', sessionCookie(session({ expiresInSeconds: -60 }))), server, { timeoutMs: 150 });
  assert.equal(outcome, 'timeout');
  assert.ok(Date.now() - started < 2000);
  assert.ok(response.headers.get('x-middleware-next'));
});

test('proxy: referral code capture on /pricing', () => {
  const req = request('/pricing?ref=Creator_1');
  const res = NextResponse.next();
  assert.equal(applyRefCapture(req, res, { secure: true }), true);
  assert.match(setCookies(res).join(';'), /mm_ref=creator_1/);
  assert.equal(applyRefCapture(request('/dashboard?ref=x'), NextResponse.next()), false);
  assert.equal(applyRefCapture(request('/pricing?ref=<script>'), NextResponse.next()), false);
});

test('proxy file: lives in src/, named export, matcher skips API routes and static assets', () => {
  assert.equal(existsSync(resolve(root, 'middleware.js')), false, 'root middleware.js is ignored when the app is in src/');
  assert.equal(existsSync(resolve(root, 'src/middleware.js')), false, 'middleware is deprecated in Next 16; use proxy');
  const src = read('src/proxy.js');
  assert.match(src, /export async function proxy\(request\)/);
  const matcher = src.match(/matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)*'([^']+)'/)?.[1];
  assert.ok(matcher, 'matcher constant found');
  const re = new RegExp(`^${matcher.replace(/\\\\/g, '\\')}$`);
  for (const path of ['/', '/dashboard', '/today', '/pricing', '/login', '/auth/callback', '/review/repair/a/b']) {
    assert.ok(re.test(path), `proxy must run on ${path}`);
  }
  for (const path of ['/api/auth/me', '/api/auth/email-login', '/_next/static/chunks/a.js', '/_next/image', '/logo.png', '/sw.js', '/robots.txt', '/sitemap.xml', '/.well-known/assetlinks.json', '/favicon.ico', '/fonts/x.woff2']) {
    assert.ok(!re.test(path), `proxy must skip ${path}`);
  }
});

test('next-auth is gone from the app source', () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(m?js|jsx|ts|tsx)$/.test(name)) files.push(full);
    }
  };
  walk(resolve(root, 'src'));
  const offenders = files.filter((file) => /from ['"]next-auth/.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
  assert.equal(existsSync(resolve(root, 'src/app/api/auth/[...nextauth]/route.js')), false);
});

test('safeNextPath accepts same-site paths only', () => {
  assert.equal(safeNextPath('/review?tab=mistakes#q3'), '/review?tab=mistakes#q3');
  assert.equal(safeNextPath('/test/abc'), '/test/abc');
  for (const bad of [
    'https://evil.example/', '//evil.example', '/\\evil.example', '\\\\evil', 'javascript:alert(1)',
    '/login', '/login?next=/x', '/signup', '/auth/callback?code=1', '/api/auth/me', '', '   ', null, undefined, 42,
    '/ok\nSet-Cookie:x', `/${'a'.repeat(600)}`, 'dashboard', '/%2F%2Fevil.example',
  ]) {
    const result = safeNextPath(bad);
    assert.ok(result === null || (result.startsWith('/') && !result.startsWith('//')), `unsafe: ${String(bad)} -> ${result}`);
    if (typeof bad === 'string' && /^(https?:|\/\/|\/\\|\\|javascript:)/.test(bad)) assert.equal(result, null, String(bad));
  }
  assert.equal(safeNextPath('/login'), null);
  assert.equal(safeNextPath('/auth/callback'), null);
});

function memoryStore() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

test('the return path is remembered briefly, read once and re-validated', () => {
  const store = memoryStore();
  assert.equal(rememberNextPath('/review', { store, now: 1000 }), '/review');
  assert.equal(takeNextPath({ store, now: 2000 }), '/review');
  assert.equal(takeNextPath({ store, now: 2000 }), null, 'cleared on read');

  rememberNextPath('/review', { store, now: 0 });
  assert.equal(takeNextPath({ store, now: 31 * 60 * 1000 }), null, 'expires after 30 minutes');

  store.setItem('mm_auth_next', JSON.stringify({ path: 'https://evil.example', at: 1 }));
  assert.equal(takeNextPath({ store, now: 2 }), null, 'tampered value rejected');

  rememberNextPath('/today', { store, now: 1 });
  rememberNextPath(null, { store, now: 2 });
  assert.equal(takeNextPath({ store, now: 3 }), null, 'a visit without ?next clears an old one');

  rememberNextPath('/today', { store, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: true, store, now: 2 }), '/onboarding');
  rememberNextPath('/today', { store, now: 1 });
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 2 }), '/today');
  assert.equal(postSignInPath({ needsOnboarding: false, store, now: 2 }), '/today', 'with nothing saved a signed-in student opens Today');
});

test('the arena front door follows the student state', () => {
  assert.equal(arenaHomePath({ needsOnboarding: true }), '/onboarding', 'no subjects yet: onboarding first');
  assert.equal(arenaHomePath({ needsOnboarding: false }), '/today');
  assert.equal(arenaHomePath(), '/today');
});

test('loginPathFor builds a safe login link', () => {
  assert.equal(loginPathFor('/review?x=1'), '/login?next=%2Freview%3Fx%3D1');
  assert.equal(loginPathFor('/dashboard'), '/login');
  assert.equal(loginPathFor('//evil.example'), '/login');
});

test('callback params: PKCE code, email link, errors, junk', () => {
  assert.deepEqual(readCallbackParams('?code=0b4c7f3e-1d2a-4c55-9a7e-2f1b3c4d5e6f'), { kind: 'code', code: '0b4c7f3e-1d2a-4c55-9a7e-2f1b3c4d5e6f' });
  assert.deepEqual(readCallbackParams('?token_hash=pkce_abc123def456&type=magiclink'), { kind: 'token_hash', tokenHash: 'pkce_abc123def456', type: 'magiclink' });
  assert.equal(readCallbackParams('?token_hash=abc123def456&type=signup').kind, 'token_hash');
  assert.equal(readCallbackParams('?token_hash=abc123def456&type=recovery').kind, 'error', 'no password recovery flow exists');
  assert.equal(readCallbackParams('?token_hash=abc"<x>&type=email').kind, 'error');
  assert.equal(readCallbackParams('?code=<script>').kind, 'error');
  const denied = readCallbackParams('?error=access_denied&error_description=Call+0000+to+unlock');
  assert.equal(denied.kind, 'error');
  assert.doesNotMatch(denied.message, /0000/, 'URL text is never shown');
  assert.equal(readCallbackParams('', '#error=server_error&error_code=otp_expired&error_description=x').code, 'otp_expired');
  assert.deepEqual(readCallbackParams(''), { kind: 'none' });
});

test('transient errors never sign a student out; dead refresh tokens do', () => {
  assert.equal(isTransientAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }), true);
  assert.equal(isTransientAuthError({ status: 503, message: 'Service Unavailable' }), true);
  assert.equal(isTransientAuthError({ status: 429, message: 'rate limited' }), true);
  assert.equal(isTransientAuthError(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientAuthError({ name: 'AuthApiError', status: 400, code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' }), false);
  assert.equal(isTransientAuthError({ name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' }), false);
  assert.equal(isTransientAuthError(null), false);

  assert.equal(isDeadSessionError({ name: 'AuthApiError', status: 400, code: 'refresh_token_already_used', message: 'Invalid Refresh Token: Already Used' }), true);
  assert.equal(isDeadSessionError({ name: 'AuthApiError', status: 400, message: 'Invalid Refresh Token: Refresh Token Not Found' }), true);
  assert.equal(isDeadSessionError({ name: 'AuthRetryableFetchError', status: 0, message: 'refresh token request failed: fetch failed' }), false);

  assert.equal(hasSupabaseSessionCookie([{ name: COOKIE, value: 'x' }]), true);
  assert.equal(hasSupabaseSessionCookie([{ name: `${COOKIE}.0`, value: 'x' }]), true);
  assert.equal(hasSupabaseSessionCookie([{ name: `${COOKIE}-code-verifier`, value: 'x' }]), false);
  assert.equal(hasSupabaseSessionCookie([{ name: COOKIE, value: '' }]), false);
});

test('web auth wiring: 503 on transient, local sign-out, no reload on token refresh', () => {
  const me = read('src/app/api/auth/me/route.js');
  assert.match(me, /authWithStatus\(request\)/);
  assert.match(me, /status: 503/);
  const provider = read('src/components/AuthProvider.jsx');
  assert.match(provider, /signOut\(\{ scope: 'local' \}\)/);
  assert.doesNotMatch(provider, /auth\.signOut\(\)/, 'a bare signOut() is global and would sign the student out of the app too');
  assert.match(provider, /event === 'INITIAL_SESSION'/);
  assert.match(provider, /'TOKEN_REFRESHED'/);
  const layout = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(layout, /loginPathFor\(/);
  assert.doesNotMatch(layout, /router\.replace\('\/signup'\)/);
  const browser = read('src/lib/supabase-browser.js');
  assert.match(browser, /flowType: 'pkce'/);
});

// ---------------------------------------------------------------------------------------------
// Auth review fixes (13 Oct 2026): 429/500 on refresh, held cookie writes, stale server reads,
// confirmed-email identities, first-login race, email-login policy, email-link confirmation.

const STALE = 'x-mm-auth-stale';

function forwardedRequestHeader(response, name) {
  return response.headers.get(`x-middleware-request-${name}`);
}

for (const [status, body] of [[429, { code: 'over_request_rate_limit', msg: 'Request rate limit reached' }], [500, { code: 'unexpected_failure', msg: 'Unexpected failure' }]]) {
  test(`proxy: a Supabase ${status} on refresh keeps the cookies and marks server reads stale`, async () => {
    const server = fakeAuthServer({ refresh: () => json(body, status) });
    const { response, outcome } = await run(request('/pricing', sessionCookie(session({ expiresInSeconds: -60 }))), server, { timeoutMs: 1500 });
    assert.ok(['transient', 'timeout'].includes(outcome), outcome);
    assert.deepEqual(setCookies(response).filter((c) => c.startsWith(`${COOKIE}=`)), [], `a ${status} must not delete the session cookie`);
    assert.equal(forwardedRequestHeader(response, STALE), '1', 'server reads in this request must not refresh');
  });
}

test('proxy: a client cannot send the stale marker through; a good session clears it', async () => {
  const server = fakeAuthServer({ refresh: () => { throw new Error('must not refresh'); } });
  const req = new NextRequest('https://www.mockmob.in/today', { headers: { cookie: sessionCookie(session({ expiresInSeconds: 3000 })), [STALE]: '1' } });
  const { response, outcome } = await run(req, server);
  assert.equal(outcome, 'ok');
  assert.equal(forwardedRequestHeader(response, STALE), null);
  const anon = await run(new NextRequest('https://www.mockmob.in/', { headers: { [STALE]: '1' } }), server);
  assert.equal(anon.outcome, 'anonymous');
  assert.equal(forwardedRequestHeader(anon.response, STALE), null);
});

test('auth-safe fetch: only refresh-token grants are rewritten, other grants keep their status', async () => {
  const { createAuthSafeFetch } = await import('../../src/lib/supabase-auth-errors.js');
  const base = async () => json({ code: 'over_request_rate_limit' }, 429);
  const safe = createAuthSafeFetch(base);
  assert.equal((await safe(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: 'POST' })).status, 503);
  assert.equal((await safe(new Request(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: 'POST' }))).status, 503);
  assert.equal((await safe(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST' })).status, 429);
  assert.equal((await safe(`${SUPABASE_URL}/auth/v1/verify`, { method: 'POST' })).status, 429);
  const ok = createAuthSafeFetch(async () => json({ ok: true }));
  assert.equal((await ok(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`)).status, 200);
});

// The browser client, as src/lib/supabase-browser.js builds it, against the fake server.
async function browserClient({ refresh, wrap = true }) {
  const { createBrowserClient } = await import('@supabase/ssr');
  const { createAuthSafeFetch } = await import('../../src/lib/supabase-auth-errors.js');
  const server = fakeAuthServer({ refresh });
  let jar = [{ name: COOKIE, value: sessionCookie(session({ expiresInSeconds: -60 })).slice(COOKIE.length + 1) }];
  const client = createBrowserClient(SUPABASE_URL, ANON_KEY, {
    isSingleton: false,
    global: { fetch: wrap ? createAuthSafeFetch(server.fetch) : server.fetch },
    cookies: {
      getAll: () => jar,
      setAll: (items) => {
        for (const { name, value } of items) {
          jar = jar.filter((c) => c.name !== name);
          if (value) jar.push({ name, value });
        }
      },
    },
    auth: { flowType: 'pkce', detectSessionInUrl: false, autoRefreshToken: false },
  });
  const events = [];
  client.auth.onAuthStateChange((event) => events.push(event));
  return { client, events, jar: () => jar, server };
}

for (const status of [429, 500]) {
  test(`browser client: a ${status} on refresh keeps the session and sends no SIGNED_OUT`, async () => {
    const { client, events, jar } = await browserClient({ refresh: () => json({ code: 'x', msg: 'busy' }, status) });
    const { error } = await client.auth.refreshSession();
    assert.ok(error, 'the refresh did fail');
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(!events.includes('SIGNED_OUT'), events.join(','));
    assert.ok(jar().some((c) => c.name === COOKIE && c.value), 'session cookie kept');
  });
}

test('browser client control: without the wrapper the library signs out on a 429', async () => {
  const { client, events, jar } = await browserClient({ refresh: () => json({ code: 'over_request_rate_limit', msg: 'busy' }, 429), wrap: false });
  await client.auth.refreshSession();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(events.includes('SIGNED_OUT') || !jar().some((c) => c.name === COOKIE && c.value), 'if this fails, auth-js now keeps sessions on 429 and authSafeFetch may be dropped');
});

// /api/auth/me and auth() read the session through readCookieUser.
function cookieStore(initial) {
  let jar = [...initial];
  const writes = [];
  return {
    getAll: () => jar,
    set: (name, value, options) => {
      writes.push({ name, value, options });
      jar = jar.filter((c) => c.name !== name);
      if (value) jar.push({ name, value });
    },
    writes,
  };
}

async function readUser({ refresh, stale = false, user, timeoutMs } = {}) {
  const { readCookieUser } = await import('../../src/lib/server/cookieSession.js');
  const server = fakeAuthServer({ refresh });
  const base = server.fetch;
  const fetch = user ? async (input, init) => (String(input?.url ?? input).includes('/auth/v1/user') ? user() : base(input, init)) : base;
  const store = cookieStore([{ name: COOKIE, value: sessionCookie(session({ expiresInSeconds: -60 })).slice(COOKIE.length + 1) }]);
  const result = await readCookieUser({
    cookieStore: store,
    createServerClient,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: ANON_KEY,
    stale,
    timeoutMs,
    clientOptions: { global: { fetch } },
  });
  return { result, store, calls: server.calls };
}

for (const status of [429, 500, 503]) {
  test(`/api/auth/me path: a ${status} on refresh is transient (503) and deletes no cookie`, async () => {
    const started = Date.now();
    const { result, store } = await readUser({ refresh: () => json({ code: 'x', msg: 'busy' }, status), timeoutMs: 400 });
    assert.equal(result.user, null);
    assert.equal(result.transient, true);
    assert.ok(Date.now() - started < 2000, 'answers within the time budget, not after the library has retried for 30 s');
    // The library keeps retrying in the background; nothing it does later may touch cookies.
    await new Promise((r) => setTimeout(r, 900));
    assert.deepEqual(store.writes.filter((w) => !w.value), [], 'no cookie deletion on a transient failure');
  });
}

test('/api/auth/me path: a revoked refresh token is not transient and clears the cookie', async () => {
  const { result, store } = await readUser({
    refresh: () => json({ code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400),
  });
  assert.equal(result.transient, false);
  assert.ok(store.writes.some((w) => w.name === COOKIE && !w.value), 'dead session cookie removed');
});

test('/api/auth/me path: a refreshed session is written back', async () => {
  const fresh = session({ expiresInSeconds: 3600, refreshToken: 'refresh-new' });
  const { result, store } = await readUser({ refresh: () => json(fresh), user: () => json({ ...fresh.user, email_confirmed_at: '2026-01-01T00:00:00Z' }) });
  assert.equal(result.user?.id, 'user-1');
  const written = store.writes.find((w) => w.name === COOKIE && w.value);
  assert.ok(written, 'new token written');
  assert.match(Buffer.from(written.value.replace(/^base64-/, ''), 'base64url').toString(), /refresh-new/);
});

test('server reads marked stale by the proxy never call Supabase', async () => {
  const { result, calls } = await readUser({ refresh: () => { throw new Error('must not refresh'); }, stale: true });
  assert.deepEqual(result, { user: null, transient: true });
  assert.deepEqual(calls, []);
});

test('only identities with a confirmed email resolve to a MockMob account', async () => {
  const { hasConfirmedEmail } = await import('../../src/lib/server/cookieSession.js');
  assert.equal(hasConfirmedEmail({ email: 'a@b.in', email_confirmed_at: '2026-10-01T00:00:00Z' }), true);
  assert.equal(hasConfirmedEmail({ email: 'a@b.in', email_confirmed_at: null }), false);
  assert.equal(hasConfirmedEmail({ email: 'a@b.in', confirmed_at: '2026-10-01T00:00:00Z' }), false, 'a confirmed phone does not prove the email');
  assert.equal(hasConfirmedEmail({ email_confirmed_at: '2026-10-01T00:00:00Z' }), false);
  const authSrc = read('src/lib/auth.ts');
  assert.match(authSrc, /hasConfirmedEmail\(supabaseUser\)/);
  assert.match(authSrc, /AUTH_STALE_HEADER/);
});

test('first login: lookup by Supabase id first, and two simultaneous creates both get the row', async () => {
  const { ensureDbUser } = await import('../../src/lib/server/cookieSession.js');
  const rows = new Map();
  let creates = 0;
  const db = {
    getUserById: async (id) => rows.get(id) || null,
    getUserByEmail: async (email) => [...rows.values()].find((r) => r.email === email) || null,
    updateUser: async (id, patch) => ({ ...rows.get(id), ...patch }),
    createUser: async (row) => {
      creates += 1;
      await new Promise((r) => setTimeout(r, 5));
      if (rows.has(row.id)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      rows.set(row.id, { ...row });
      return rows.get(row.id);
    },
  };
  const identity = { id: 'sb-1', email: 'asha@example.com', name: 'Asha' };
  const [a, b] = await Promise.all([ensureDbUser(identity, db), ensureDbUser(identity, db)]);
  assert.equal(creates, 2);
  assert.equal(a.id, 'sb-1');
  assert.equal(b.id, 'sb-1');
  rows.set('legacy-9', { id: 'legacy-9', email: 'old@example.com', name: 'Old' });
  assert.equal((await ensureDbUser({ id: 'sb-2', email: 'old@example.com' }, db)).id, 'legacy-9', 'older rows still found by email');
  await assert.rejects(ensureDbUser({ id: 'sb-3', email: 'new@example.com' }, { ...db, createUser: async () => { throw Object.assign(new Error('boom'), { code: '500' }); } }));
});

test('email login: link origin is pinned in production; three rate limits', async () => {
  const { getSiteOrigin, EMAIL_LOGIN_LIMITS } = await import('../../src/lib/server/emailLoginPolicy.js');
  const req = { url: 'https://evil.example/api/auth/email-login' };
  assert.equal(getSiteOrigin(req, { NODE_ENV: 'production' }), 'https://www.mockmob.in');
  assert.equal(getSiteOrigin(req, { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://mockmob.in/' }), 'https://mockmob.in');
  assert.equal(getSiteOrigin(req, { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://evil.example' }), 'https://www.mockmob.in');
  assert.equal(getSiteOrigin({ url: 'http://localhost:3000/api/auth/email-login' }, { NODE_ENV: 'development' }), 'http://localhost:3000');
  assert.deepEqual(EMAIL_LOGIN_LIMITS.map(({ limit, identityOnly, perEmail }) => [limit, identityOnly, perEmail]), [[20, false, false], [5, false, true], [15, true, true]]);
  assert.equal(new Set(EMAIL_LOGIN_LIMITS.map((l) => l.route)).size, 3, 'separate buckets');
  const route = read('src/app/api/auth/email-login/route.js');
  const cleared = route.indexOf('await clearUnconfirmedPassword(email)');
  assert.ok(cleared > 0 && cleared < route.indexOf('generateLink({'), 'password cleared before the code is minted');
  assert.match(route, /Using the MockMob app\? Type this code in the app/);
  assert.doesNotMatch(route, /identityOnly:true/, 'the single per-email limit is gone');
  const sql = read('supabase/migrations/20261013150000_auth_unconfirmed_passwords.sql');
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /revoke all on function public\.auth_clear_unconfirmed_password\(text\) from public, anon, authenticated/);
  assert.match(sql, /email_confirmed_at is null/);
});

test('email links wait for a tap; sign-out of other devices exists on the web', () => {
  const page = read('src/app/auth/callback/AuthCallbackPageClient.jsx');
  const start = page.slice(page.indexOf('async function startAuth'), page.indexOf('async function finishEmailLink'));
  assert.doesNotMatch(start, /verifyOtp/, 'the email link must not be spent on page load');
  assert.match(page, /Continue to MockMob/);
  assert.match(page, /Switch to the account in this email\?/);
  const provider = read('src/components/AuthProvider.jsx');
  assert.match(provider, /signOut\(\{ scope: 'others' \}\)/);
  assert.match(read('src/app/(app)/profile/ProfilePageClient.jsx'), /<SignOutOtherDevicesSection \/>/);
  const browser = read('src/lib/supabase-browser.js');
  assert.match(browser, /global: \{ fetch: authSafeFetch \}/);
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies?.['next-auth'], undefined);
});
