// Local token verification and the auth user cache (16 Oct 2026, usage audit item 6).
//
// Drives the real @supabase/ssr and @supabase/supabase-js clients against a fake Supabase Auth
// server that signs real ES256 tokens and serves a real JWKS, so getClaims() runs its actual
// signature check. Every case counts the calls that reached the fake server: a verified token for
// a known account must cost zero auth/v1/user calls; everything else must be refused or asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { readCookieUser } from '../../src/lib/server/cookieSession.js';
import { checkSupabaseClaims, rowMatchesIdentity, verifyBearerIdentity } from '../../src/lib/server/verifiedIdentity.js';
import { createAuthUserCache } from '../../src/lib/server/authUserCache.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');
const b64url = (value) => Buffer.from(value).toString('base64url');
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const nowSec = () => Math.floor(Date.now() / 1000);

let projectSeq = 0;

// One fake project: its own host (so the shared JWKS cache never leaks between cases), its own
// signing key, and a log of every request that reached it.
async function makeProject({ jwksStatus = 200, userReply = null } = {}) {
  const ref = `proj${++projectSeq}x${crypto.randomBytes(3).toString('hex')}`;
  const url = `https://${ref}.supabase.co`;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const kid = `kid-${ref}`;
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig', key_ops: ['verify'] };
  const calls = [];

  const sign = (payload, { key = privateKey, header = {} } = {}) => {
    const h = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid, ...header }));
    const p = b64url(JSON.stringify(payload));
    const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key, dsaEncoding: 'ieee-p1363' });
    return `${h}.${p}.${sig.toString('base64url')}`;
  };
  const claims = (over = {}) => ({
    iss: `${url}/auth/v1`, aud: 'authenticated', role: 'authenticated', sub: 'sb-user-1',
    email: 'asha@example.com', exp: nowSec() + 3600, iat: nowSec(), session_id: 'sess-1', user_metadata: {}, ...over,
  });
  const fullUser = { id: 'sb-user-1', email: 'asha@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };

  const fetch = async (input, init = {}) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    calls.push(`${init.method || 'GET'} ${u.pathname}${u.search}`);
    if (u.pathname === '/auth/v1/.well-known/jwks.json') return jwksStatus === 200 ? json({ keys: [jwk] }) : json({ message: 'down' }, jwksStatus);
    if (u.pathname === '/auth/v1/user') return userReply ? userReply(init) : json(fullUser);
    if (u.pathname === '/auth/v1/token') return json({ code: 'x', msg: 'unexpected refresh' }, 500);
    return json({ message: 'not found' }, 404);
  };
  const userCalls = () => calls.filter((c) => c.includes('/auth/v1/user')).length;
  return { ref, url, kid, sign, claims, fetch, calls, userCalls, privateKey, fullUser, cookie: `sb-${ref}-auth-token` };
}

function sessionFor(project, accessToken, { expiresIn = 3600, refreshToken = 'refresh-1' } = {}) {
  const exp = nowSec() + expiresIn;
  return {
    access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer', expires_in: Math.max(0, expiresIn), expires_at: exp,
    user: { id: 'sb-user-1', email: 'asha@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
}

function cookieStore(project, session) {
  let jar = session ? [{ name: project.cookie, value: `base64-${b64url(JSON.stringify(session))}` }] : [];
  const writes = [];
  return { getAll: () => jar, set: (name, value, options) => { writes.push({ name, value, options }); jar = jar.filter((c) => c.name !== name); if (value) jar.push({ name, value }); }, writes };
}

const KNOWN = { id: 'sb-user-1', email: 'asha@example.com', name: 'Asha', subjects: [], role: 'student' };

function readWith(project, session, { known = async () => true, fetch = project.fetch, timeoutMs } = {}) {
  const store = cookieStore(project, session);
  return readCookieUser({
    cookieStore: store, createServerClient, supabaseUrl: project.url, supabaseKey: 'anon-test-key', timeoutMs,
    isKnownIdentity: known, clientOptions: { global: { fetch } },
  }).then((result) => ({ result, store }));
}

// ---------------------------------------------------------------- cookie path

test('valid token for a known account: verified locally, zero calls to auth/v1/user', async () => {
  const p = await makeProject();
  const { result } = await readWith(p, sessionFor(p, p.sign(p.claims())));
  assert.equal(result.transient, false);
  assert.equal(result.user?.id, 'sb-user-1');
  assert.equal(result.user?.verifiedBy, 'claims');
  assert.equal(p.userCalls(), 0);
  // The JWKS is fetched once, then served from memory.
  await readWith(p, sessionFor(p, p.sign(p.claims())));
  assert.equal(p.calls.filter((c) => c.includes('jwks.json')).length, 1);
  assert.equal(p.userCalls(), 0);
});

test('expired access token: refreshed through the refresh token, new cookies written, then verified locally', async () => {
  const p = await makeProject();
  const fresh = sessionFor(p, p.sign(p.claims({ session_id: 'sess-2' })), { refreshToken: 'refresh-2' });
  const fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') { p.calls.push('POST /auth/v1/token?refresh'); return json(fresh); }
    return p.fetch(input, init);
  };
  const expired = sessionFor(p, p.sign(p.claims({ exp: nowSec() - 60 })), { expiresIn: -60 });
  const { result, store } = await readWith(p, expired, { fetch });
  assert.equal(result.user?.id, 'sb-user-1');
  assert.equal(p.calls.filter((c) => c.includes('token?refresh')).length, 1, 'one refresh, exactly as getUser would have made');
  assert.equal(p.userCalls(), 0);
  const written = store.writes.find((w) => w.name === p.cookie && w.value);
  assert.ok(written, 'the rotated refresh token is written back');
  assert.match(Buffer.from(written.value.replace(/^base64-/, ''), 'base64url').toString(), /refresh-2/);
});

test('expired access token whose refresh token is dead: signed out, cookie cleared, nothing accepted', async () => {
  const p = await makeProject();
  const fetch = async (input, init) => {
    const u = new URL(typeof input === 'string' ? input : input.url);
    if (u.pathname === '/auth/v1/token') return json({ code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400);
    return p.fetch(input, init);
  };
  const expired = sessionFor(p, p.sign(p.claims({ exp: nowSec() - 60 })), { expiresIn: -60 });
  const { result, store } = await readWith(p, expired, { fetch });
  assert.equal(result.user, null);
  assert.equal(result.transient, false);
  assert.ok(store.writes.some((w) => w.name === p.cookie && !w.value), 'dead session cookie removed');
});

test('wrong issuer: refused, even with a good signature, and auth/v1/user is not consulted', async () => {
  const p = await makeProject();
  const { result } = await readWith(p, sessionFor(p, p.sign(p.claims({ iss: 'https://evil.supabase.co/auth/v1' }))));
  assert.deepEqual({ user: result.user, transient: result.transient }, { user: null, transient: false });
  assert.equal(p.userCalls(), 0);
});

test('wrong audience or role: refused', async () => {
  for (const over of [{ aud: 'anon' }, { aud: ['somebody-else'] }, { role: 'anon' }, { role: 'service_role' }]) {
    const p = await makeProject();
    const { result } = await readWith(p, sessionFor(p, p.sign(p.claims(over))));
    assert.equal(result.user, null, JSON.stringify(over));
    assert.equal(p.userCalls(), 0);
  }
});

test('tampered token: a changed payload under the old signature is refused', async () => {
  const p = await makeProject();
  const good = p.sign(p.claims({ sub: 'sb-user-1' }));
  const [h, , s] = good.split('.');
  const forged = `${h}.${b64url(JSON.stringify(p.claims({ sub: 'sb-admin-9', email: 'admin@example.com' })))}.${s}`;
  const { result } = await readWith(p, sessionFor(p, forged), { known: async () => true });
  assert.equal(result.user, null);
  assert.equal(result.transient, false);
  assert.equal(p.userCalls(), 0, 'a bad signature is never "double-checked" into acceptance');
});

test('token signed by a different key (right kid, wrong key): refused', async () => {
  const p = await makeProject();
  const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const { result } = await readWith(p, sessionFor(p, p.sign(p.claims(), { key: other.privateKey })));
  assert.equal(result.user, null);
  assert.equal(p.userCalls(), 0);
});

test('missing token: no cookie means signed out and no request leaves the server', async () => {
  const p = await makeProject();
  const { result } = await readWith(p, null);
  assert.deepEqual({ user: result.user, transient: result.transient }, { user: null, transient: false });
  assert.deepEqual(p.calls, []);
});

test('an account without a MockMob row yet takes the full path through auth/v1/user (email proof)', async () => {
  const p = await makeProject();
  const { result } = await readWith(p, sessionFor(p, p.sign(p.claims())), { known: async () => false });
  assert.equal(p.userCalls(), 1);
  assert.equal(result.user?.email_confirmed_at, '2026-01-01T00:00:00Z');
  assert.equal(result.user?.verifiedBy, undefined);
});

test('a failing row lookup never lets a token through locally', async () => {
  const p = await makeProject();
  const { result } = await readWith(p, sessionFor(p, p.sign(p.claims())), { known: async () => { throw new Error('db down'); } });
  assert.equal(p.userCalls(), 1);
  assert.equal(result.user?.verifiedBy, undefined);
});

test('no asymmetric key (legacy HS256 token, no kid): auth/v1/user decides', async () => {
  const p = await makeProject();
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const hs = `${h}.${b64url(JSON.stringify(p.claims()))}.c2ln`;
  const { result } = await readWith(p, sessionFor(p, hs));
  assert.ok(p.userCalls() >= 1, 'the server was asked');
  assert.equal(result.user?.id, 'sb-user-1');
  assert.equal(p.calls.some((c) => c.includes('jwks.json')), false);

  const rejecting = await makeProject({ userReply: () => json({ code: 'bad_jwt', msg: 'invalid JWT' }, 401) });
  const hs2 = `${h}.${b64url(JSON.stringify(rejecting.claims()))}.c2ln`;
  const denied = await readWith(rejecting, sessionFor(rejecting, hs2));
  assert.equal(denied.result.user, null, 'a forged legacy token is rejected by the server');
});

test('JWKS unreachable: falls back to auth/v1/user, and keeps the student signed in when that works', async () => {
  const p = await makeProject({ jwksStatus: 500 });
  const { result } = await readWith(p, sessionFor(p, p.sign(p.claims())));
  assert.equal(result.user?.id, 'sb-user-1');
  assert.ok(p.userCalls() >= 1);
});

test('JWKS and auth/v1/user both down: transient (503 upstream), never signed out', async () => {
  const p = await makeProject({ jwksStatus: 500, userReply: () => json({ msg: 'down' }, 503) });
  const { result, store } = await readWith(p, sessionFor(p, p.sign(p.claims())), { timeoutMs: 800 });
  assert.equal(result.user, null);
  assert.equal(result.transient, true);
  assert.deepEqual(store.writes.filter((w) => !w.value), []);
});

test('the stale marker still short-circuits before any Supabase call', async () => {
  const p = await makeProject();
  const result = await readCookieUser({
    cookieStore: cookieStore(p, sessionFor(p, p.sign(p.claims()))), createServerClient, supabaseUrl: p.url, supabaseKey: 'k',
    stale: true, isKnownIdentity: async () => true, clientOptions: { global: { fetch: p.fetch } },
  });
  assert.deepEqual(result, { user: null, transient: true });
  assert.deepEqual(p.calls, []);
});

test('without isKnownIdentity the read is exactly the old getUser read', async () => {
  const p = await makeProject();
  const store = cookieStore(p, sessionFor(p, p.sign(p.claims())));
  const result = await readCookieUser({ cookieStore: store, createServerClient, supabaseUrl: p.url, supabaseKey: 'k', clientOptions: { global: { fetch: p.fetch } } });
  assert.equal(result.user?.id, 'sb-user-1');
  assert.equal(p.userCalls(), 1);
  assert.equal(p.calls.some((c) => c.includes('jwks.json')), false);
});

// ---------------------------------------------------------------- claim rules (pure)

test('claim rules: each failure has its own reason', () => {
  const supabaseUrl = 'https://abc.supabase.co';
  const good = { iss: 'https://abc.supabase.co/auth/v1', aud: 'authenticated', role: 'authenticated', sub: 'u1', email: 'a@b.in', exp: nowSec() + 60 };
  assert.equal(checkSupabaseClaims(good, { supabaseUrl }).ok, true);
  assert.equal(checkSupabaseClaims({ ...good, aud: ['authenticated', 'x'] }, { supabaseUrl }).ok, true);
  const cases = [
    [{ iss: 'https://abc.supabase.co/auth/v1/' }, 'wrong_issuer'],
    [{ iss: 'https://abc.supabase.co' }, 'wrong_issuer'],
    [{ iss: undefined }, 'wrong_issuer'],
    [{ aud: 'anon' }, 'wrong_audience'],
    [{ aud: undefined }, 'wrong_audience'],
    [{ role: 'anon' }, 'wrong_role'],
    [{ exp: nowSec() - 1 }, 'expired'],
    [{ exp: undefined }, 'expired'],
    [{ exp: '9999999999' }, 'expired'],
    [{ sub: '' }, 'no_subject'],
    [{ sub: undefined }, 'no_subject'],
    [{ is_anonymous: true }, 'anonymous'],
  ];
  for (const [over, reason] of cases) assert.equal(checkSupabaseClaims({ ...good, ...over }, { supabaseUrl }).reason, reason, JSON.stringify(over));
  assert.equal(checkSupabaseClaims(null, { supabaseUrl }).reason, 'no_claims');
  assert.equal(checkSupabaseClaims(good, { supabaseUrl: '' }).reason, 'no_project_url');
  assert.equal(checkSupabaseClaims(good, { supabaseUrl, nowMs: (good.exp + 1) * 1000 }).reason, 'expired');
});

test('a row proves an identity only by id and email together', () => {
  const identity = { id: 'u1', email: 'Asha@Example.com' };
  assert.equal(rowMatchesIdentity({ id: 'u1', email: 'asha@example.com' }, identity), true);
  assert.equal(rowMatchesIdentity({ id: 'u2', email: 'asha@example.com' }, identity), false);
  assert.equal(rowMatchesIdentity({ id: 'u1', email: 'other@example.com' }, identity), false);
  assert.equal(rowMatchesIdentity({ id: 'u1', email: null }, identity), false);
  assert.equal(rowMatchesIdentity(null, identity), false);
});

// ---------------------------------------------------------------- bearer path (Android app)

function bearerClient(p) {
  return createClient(p.url, 'service-test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: p.fetch } });
}
const bearer = (p, token, known = async () => true) => verifyBearerIdentity({ token, supabase: bearerClient(p), supabaseUrl: p.url, isKnownIdentity: known });

test('bearer: valid token for a known account costs no auth/v1/user call', async () => {
  const p = await makeProject();
  const out = await bearer(p, p.sign(p.claims()));
  assert.equal(out.user?.id, 'sb-user-1');
  assert.equal(out.user?.verifiedBy, 'claims');
  assert.equal(p.userCalls(), 0);
});

test('bearer: expired, wrong-issuer, wrong-audience, tampered and missing tokens are all refused without a server round trip', async () => {
  const p = await makeProject();
  const good = p.sign(p.claims());
  const [h, , s] = good.split('.');
  const tampered = `${h}.${b64url(JSON.stringify(p.claims({ sub: 'sb-admin-9' })))}.${s}`;
  for (const [label, token] of [
    ['expired', p.sign(p.claims({ exp: nowSec() - 30 }))],
    ['wrong issuer', p.sign(p.claims({ iss: 'https://evil.supabase.co/auth/v1' }))],
    ['wrong audience', p.sign(p.claims({ aud: 'anon' }))],
    ['tampered', tampered],
    ['garbage', 'not.a.jwt'],
    ['empty', ''],
  ]) {
    const out = await bearer(p, token);
    assert.deepEqual({ user: out.user, transient: out.transient }, { user: null, transient: false }, label);
  }
  assert.equal(p.userCalls(), 0);
});

test('bearer: unknown account, missing key and unreachable JWKS ask auth/v1/user; a 401 there refuses', async () => {
  const p = await makeProject();
  assert.equal((await bearer(p, p.sign(p.claims()), async () => false)).user?.email_confirmed_at, '2026-01-01T00:00:00Z');
  assert.equal(p.userCalls(), 1);

  const down = await makeProject({ jwksStatus: 500 });
  assert.equal((await bearer(down, down.sign(down.claims()))).user?.id, 'sb-user-1');
  assert.ok(down.userCalls() >= 1);

  const refusing = await makeProject({ jwksStatus: 500, userReply: () => json({ code: 'bad_jwt', msg: 'invalid JWT' }, 401) });
  assert.equal((await bearer(refusing, refusing.sign(refusing.claims()))).user, null);

  const outage = await makeProject({ jwksStatus: 500, userReply: () => json({ msg: 'down' }, 503) });
  const t = await bearer(outage, outage.sign(outage.claims()));
  assert.deepEqual({ user: t.user, transient: t.transient }, { user: null, transient: true });
});

// ---------------------------------------------------------------- the auth user cache

function fakeRows() {
  const rows = new Map([['u1', { id: 'u1', name: 'Asha', email: 'a@x.in', subjects: [], role: 'student' }]]);
  let reads = 0;
  return { rows, reads: () => reads, fetchRow: async (id) => { reads += 1; await new Promise((r) => setImmediate(r)); const r = rows.get(id); return r ? { ...r } : null; } };
}

test('cache: many requests, one read; 30 s later, one more', async () => {
  let clock = 1_000;
  const cache = createAuthUserCache({ now: () => clock });
  const db = fakeRows();
  for (let i = 0; i < 10; i += 1) assert.equal((await cache.load('u1', db.fetchRow)).name, 'Asha');
  assert.equal(db.reads(), 1);
  clock += 29_000;
  await cache.load('u1', db.fetchRow);
  assert.equal(db.reads(), 1, 'still fresh at 29 s');
  clock += 2_000;
  await cache.load('u1', db.fetchRow);
  assert.equal(db.reads(), 2, 'expired after 30 s');
});

test('cache: simultaneous first requests share one read', async () => {
  const cache = createAuthUserCache();
  const db = fakeRows();
  await Promise.all(Array.from({ length: 8 }, () => cache.load('u1', db.fetchRow)));
  assert.equal(db.reads(), 1);
});

test('cache: a write forgets the row at once, and a read already in flight cannot put the old row back', async () => {
  const cache = createAuthUserCache();
  const db = fakeRows();
  await cache.load('u1', db.fetchRow);
  db.rows.get('u1').name = 'Asha K';
  assert.equal((await cache.load('u1', db.fetchRow)).name, 'Asha', 'stale until the write is announced');
  cache.invalidate('u1');
  assert.equal((await cache.load('u1', db.fetchRow)).name, 'Asha K');

  // A read that began before a write must not be stored after it.
  cache.clear();
  const slow = cache.load('u1', async (id) => { const old = { ...db.rows.get(id) }; await new Promise((r) => setTimeout(r, 20)); return old; });
  db.rows.get('u1').name = 'Asha Z';
  cache.invalidate('u1');
  await slow;
  assert.equal((await cache.load('u1', db.fetchRow)).name, 'Asha Z');
});

test('cache: no row is never cached, and admins and moderators are never kept', async () => {
  const cache = createAuthUserCache();
  const db = fakeRows();
  assert.equal(await cache.load('ghost', db.fetchRow), null);
  db.rows.set('ghost', { id: 'ghost', name: 'G', email: 'g@x.in', subjects: [], role: 'student' });
  assert.equal((await cache.load('ghost', db.fetchRow)).id, 'ghost', 'a row created a moment later is found');
  db.rows.set('boss', { id: 'boss', name: 'B', email: 'b@x.in', subjects: [], role: 'admin' });
  await cache.load('boss', db.fetchRow);
  await cache.load('boss', db.fetchRow);
  db.rows.get('boss').role = 'student';
  assert.equal((await cache.load('boss', db.fetchRow)).role, 'student', 'a demoted admin is seen at once');
});

test('cache: bounded size', async () => {
  const cache = createAuthUserCache({ maxEntries: 3 });
  const fetchRow = async (id) => ({ id, name: id, email: `${id}@x.in`, subjects: [], role: 'student' });
  for (const id of ['a', 'b', 'c', 'd', 'e']) await cache.load(id, fetchRow);
  assert.equal(cache.size(), 3);
});

// ---------------------------------------------------------------- the real Database wiring

const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const ROOT = ${JSON.stringify(pathToFileURL(`${root}/`).href)};
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__fakeSupabase;',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
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

// A tiny stand-in for the PostgREST builder: records every select list and applies updates.
function fakeSupabase(table) {
  const log = [];
  const client = {
    log,
    from(name) {
      assert.equal(name, 'users');
      const state = { op: 'select', columns: null, patch: null, id: null };
      const builder = {
        select(columns) { state.columns = columns; return builder; },
        update(patch) { state.op = 'update'; state.patch = patch; return builder; },
        insert(row) { state.op = 'insert'; state.patch = row; return builder; },
        eq(_col, id) { state.id = id; return builder; },
        async maybeSingle() { return run(); },
        async single() { return run(); },
      };
      const run = async () => {
        log.push({ op: state.op, columns: state.columns, id: state.id });
        if (state.op === 'update') Object.assign(table.get(state.id) || {}, state.patch);
        if (state.op === 'insert') table.set(state.patch.id, { ...state.patch, created_at: '2026-01-01T00:00:00Z' });
        const row = table.get(state.id ?? state.patch?.id);
        return { data: row ? { ...row } : null, error: null };
      };
      return builder;
    },
  };
  return client;
}

test('Database: auth reads are cached and column-limited; a premium or credit change shows at once', async () => {
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const table = new Map([['u1', {
    id: 'u1', name: 'Asha', email: 'a@x.in', image: null, subjects: ['english'], role: 'student',
    credit_balance: 40, subscription_status: 'free', is_premium: false, premium_until: null, razorpay_subscription_id: null, created_at: '2026-01-01T00:00:00Z',
  }]]);
  const sb = fakeSupabase(table);
  globalThis.__fakeSupabase = sb;
  const { Database } = await import(pathToFileURL(resolve(root, 'data/db.js')).href);

  // Ten authenticated requests: one users read, and it names its columns.
  for (let i = 0; i < 10; i += 1) assert.equal((await Database.getAuthUserById('u1')).name, 'Asha');
  assert.equal(sb.log.length, 1);
  assert.equal(sb.log[0].columns, 'id, name, email, image, subjects, role');
  const authRow = await Database.getAuthUserById('u1');
  assert.deepEqual(Object.keys(authRow).sort(), ['email', 'id', 'image', 'name', 'role', 'subjects']);

  // Entitlements come from getUserById, which always reads, with named columns and no select(*).
  assert.equal((await Database.getUserById('u1')).isPremium, false);
  const before = sb.log.length;
  table.get('u1').credit_balance = 30; // a credit RPC changes the balance behind this process
  assert.equal((await Database.getUserById('u1')).creditBalance, 30, 'credits are never cached');
  assert.equal(sb.log.length, before + 1);
  assert.ok(sb.log.every((l) => l.columns !== '*'), 'no select(*) on users');

  // A payment lands: updateUser flips premium and the very next reads agree.
  const until = new Date(Date.now() + 30 * 864e5).toISOString();
  await Database.updateUser('u1', { isPremium: true, subscriptionStatus: 'active', premiumUntil: until });
  assert.equal((await Database.getUserById('u1')).isPremium, true);
  const reads = sb.log.length;
  await Database.getAuthUserById('u1');
  assert.equal(sb.log.length, reads + 1, 'the write forgot the cached auth row');

  // A profile edit shows at once as well.
  await Database.updateUser('u1', { name: 'Asha K', subjects: ['english', 'economics'] });
  const after = await Database.getAuthUserById('u1');
  assert.equal(after.name, 'Asha K');
  assert.deepEqual(after.subjects, ['english', 'economics']);

  // A new row is found straight after creation.
  assert.equal(await Database.getAuthUserById('newbie'), null);
  await Database.createUser({ id: 'newbie', name: 'N', email: 'n@x.in' });
  assert.equal((await Database.getAuthUserById('newbie')).id, 'newbie');
});

// ---------------------------------------------------------------- wiring in the source

test('auth.ts wiring: claims fast path only for a known row; the old path, stale header and email proof stay', () => {
  const src = read('src/lib/auth.ts');
  assert.match(src, /isKnownIdentity/);
  assert.match(src, /verifyBearerIdentity/);
  assert.match(src, /rowMatchesIdentity/);
  assert.match(src, /hasConfirmedEmail\(supabaseUser\)/);
  assert.match(src, /AUTH_STALE_HEADER/);
  assert.doesNotMatch(src, /creditBalance/, 'the cached session carries no plan or credit field');
  const db = read('data/db.js');
  assert.match(db, /AUTH_USER_COLUMNS = 'id, name, email, image, subjects, role'/);
  assert.doesNotMatch(db, /from\('users'\)\.select\('\*'\)\.eq/);
  assert.match(db, /finally \{[^}]*invalidateAuthUser\(id\)/s);
  const proxy = read('src/lib/server/sessionProxy.js');
  assert.match(proxy, /supabase\.auth\.getClaims\(\)/, 'the proxy still refreshes through getClaims');
});
