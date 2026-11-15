// SF-E security fixes, 15 Nov 2026 (tmp/1115-prod/sec-auth.md A1, A3, A4, A5, A7, A8, A9 and flow-first-run.md F5, F9, F10).
// The real email-login route, the real limiter, the real proxy and the real deletion route run here against in-memory fakes:
// a resolve hook maps the `@/` aliases and swaps the Supabase admin client, Resend, auth() and the deletion store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__mmSec.admin();',
  '@/lib/resend': 'export const resend = { emails: { send: (m) => globalThis.__mmSec.send(m) } };',
  '@/lib/auth': 'export const auth = (r) => globalThis.__mmSec.auth(r); export const authWithStatus = async (r) => ({ session: await globalThis.__mmSec.auth(r), transient: false });',
  '@/lib/server/appPrefs': 'export const requestDeletion = (...a) => globalThis.__mmSec.requestDeletion(...a);',
};
const EXTENSIONS = ['', '.js', '.ts', '.mjs'];
const withExtension = (path) => {
  for (const ext of EXTENSIONS) {
    const candidate = path + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true };
    if (specifier === 'next/server') return nextResolve('next/server.js', context);
    if (specifier.startsWith('@/')) {
      const file = withExtension(resolve(root, 'src', specifier.slice(2)));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const file = withExtension(resolve(dirname(fileURLToPath(context.parentURL)), specifier));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

let fresh = 0;
const load = (rel) => import(`${pathToFileURL(resolve(root, rel)).href}?t=${++fresh}`);

const ENV_KEYS = ['NODE_ENV', 'NEXT_PUBLIC_SITE_URL', 'RESEND_API_KEY', 'PERSISTENT_LIMITS_ENABLED', 'MOCKMOB_STAGING_APP', 'AUTH_EMAIL_DAILY_CEILING', 'VERCEL_URL'];

// A fake take_rate_limit / rate_limit_reset_at with real counting (the SQL in 20261002121000 and 20261017190000).
function harness({ rpcError = false, env = {} } = {}) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const realNow = Date.now;
  const state = { clock: realNow.call(Date), sent: [], buckets: new Map(), takes: [], errors: [], warns: [] };
  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 're_test_key_123';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.mockmob.in';
  delete process.env.MOCKMOB_STAGING_APP;
  delete process.env.PERSISTENT_LIMITS_ENABLED; // production does not set it (A1)
  delete process.env.AUTH_EMAIL_DAILY_CEILING;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  Date.now = () => state.clock;
  const realError = console.error;
  const realWarn = console.warn;
  console.error = (...a) => state.errors.push(a.map(String).join(' '));
  console.warn = (...a) => state.warns.push(a.map(String).join(' '));
  globalThis.__mmSec = {
    admin: () => ({
      rpc: async (name, args) => {
        if (name === 'take_rate_limit') {
          state.takes.push(args);
          if (rpcError) return { data: null, error: { code: 'XX000' } };
          const entry = state.buckets.get(args.p_bucket) || { count: 0, resetAt: state.clock + args.p_window_ms };
          if (entry.resetAt <= state.clock) { entry.count = 0; entry.resetAt = state.clock + args.p_window_ms; }
          entry.count += 1;
          state.buckets.set(args.p_bucket, entry);
          return { data: entry.count <= args.p_limit, error: null };
        }
        if (name === 'rate_limit_reset_at') {
          if (rpcError) return { data: null, error: { code: 'XX000' } };
          const entry = state.buckets.get(args.p_bucket);
          return { data: entry && entry.resetAt > state.clock ? new Date(entry.resetAt).toISOString() : null, error: null };
        }
        return { data: 0, error: null };
      },
      auth: { admin: { generateLink: async () => ({ data: { properties: { email_otp: '12345678', hashed_token: 'hash_abc', verification_type: 'magiclink' } }, error: null }) } },
    }),
    send: async (message) => { state.sent.push(message); return {}; },
  };
  return {
    state,
    advance: (ms) => { state.clock += ms; },
    restore() {
      Date.now = realNow;
      console.error = realError;
      console.warn = realWarn;
      delete globalThis.__mmSec;
      for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    },
  };
}

const post = (email, ip) => new Request('https://www.mockmob.in/api/auth/email-login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  body: JSON.stringify({ email }),
});

async function withRoute(options, fn) {
  const h = harness(options);
  try {
    const { POST } = await load('src/app/api/auth/email-login/route.js');
    await fn({ POST, ...h });
  } finally {
    h.restore();
  }
}

const sha = (parts) => createHash('sha256').update(parts.join(':')).digest('hex');

// ---------------------------------------------------------------------------------------------------------------------
// A1: the database limiter in production whatever PERSISTENT_LIMITS_ENABLED says; the inbox cap by inbox alone; one
// site-wide daily ceiling; the in-memory limits when the database is down.
// ---------------------------------------------------------------------------------------------------------------------
test('A1: in production every sign-in email limit is the database limiter with PERSISTENT_LIMITS_ENABLED unset', async () => {
  await withRoute({}, async ({ POST, state }) => {
    assert.equal((await POST(post('a@example.com', '198.51.100.1'))).status, 200);
    assert.equal(state.takes.length, 4, 'network, address and inbox, inbox, site');
    const buckets = state.takes.map((t) => t.p_bucket);
    assert.equal(buckets[2], sha(['/api/auth/email-login#email', '', 'a@example.com']), 'the inbox bucket has no IP in it');
    assert.equal(buckets[3], sha(['/api/auth/email-login#site', '', 'all']), 'one site-wide bucket');
    assert.deepEqual(state.takes.map((t) => t.p_limit), [60, 5, 15, 2000]);
    assert.equal(state.takes[3].p_window_ms, 24 * 60 * 60 * 1000);
  });
});

test('A1: the per-inbox cap is one bucket for every address', async () => {
  await withRoute({}, async ({ POST, state }) => {
    for (let i = 0; i < 15; i += 1) assert.equal((await POST(post('target@example.com', `203.0.113.${i + 1}`))).status, 200, `address ${i}`);
    const inbox = state.buckets.get(sha(['/api/auth/email-login#email', '', 'target@example.com']));
    assert.equal(inbox.count, 15);
    assert.equal((await POST(post('target@example.com', '203.0.113.200'))).status, 429, 'the sixteenth mail to one inbox is refused from a new address');
    assert.equal(state.sent.length, 15);
  });
});

test('A1: with the limit database down the in-memory limits still cap one inbox across addresses (no IP in the memory key)', async () => {
  await withRoute({ rpcError: true }, async ({ POST, state }) => {
    for (let i = 0; i < 15; i += 1) assert.equal((await POST(post('victim@example.com', `192.0.2.${i + 1}`))).status, 200, `address ${i}`);
    const refused = await POST(post('victim@example.com', '192.0.2.200'));
    assert.equal(refused.status, 429);
    assert.equal((await refused.json()).code, 'rate_limited');
    assert.equal(state.sent.length, 15);
    assert.ok(state.warns.some((w) => /persistent limiter unavailable/.test(w)), 'the fallback is logged');
  });
});

test('A1: the site-wide daily ceiling refuses with a plain message, keeps Google, and logs one error line', async () => {
  await withRoute({ env: { AUTH_EMAIL_DAILY_CEILING: '3' } }, async ({ POST, state, advance }) => {
    for (let i = 0; i < 3; i += 1) assert.equal((await POST(post(`s${i}@example.com`, `198.51.100.${10 + i}`))).status, 200);
    const busy = await POST(post('s3@example.com', '198.51.100.20'));
    assert.equal(busy.status, 429);
    const body = await busy.json();
    assert.equal(body.code, 'email_busy');
    assert.equal(body.scope, 'site');
    assert.equal(body.message, 'Email sign-in is busy right now. Google sign-in still works, or try again later.');
    assert.ok(Number(busy.headers.get('retry-after')) > 23 * 60 * 60, 'the wait is the rest of the day window');
    assert.equal(state.sent.length, 3);
    const lines = state.errors.filter((e) => /daily ceiling of 3 sign-in emails/.test(e));
    assert.equal(lines.length, 1);
    await POST(post('s4@example.com', '198.51.100.21'));
    assert.equal(state.errors.filter((e) => /daily ceiling/.test(e)).length, 1, 'a flood does not fill the log');
    advance(6 * 60_000);
    await POST(post('s5@example.com', '198.51.100.22'));
    assert.equal(state.errors.filter((e) => /daily ceiling/.test(e)).length, 2, 'it is said again after 5 minutes');
  });
});

test('A1: the ceiling reads AUTH_EMAIL_DAILY_CEILING, 2,000 when unset or not a positive number; options per environment', async () => {
  const { emailDailyCeiling, emailLimitOptions, emailLoginSiteLimit, EMAIL_LOGIN_LIMITS } = await import('../../src/lib/server/emailLoginPolicy.js');
  assert.equal(emailDailyCeiling({}), 2000);
  assert.equal(emailDailyCeiling({ AUTH_EMAIL_DAILY_CEILING: 'lots' }), 2000);
  assert.equal(emailDailyCeiling({ AUTH_EMAIL_DAILY_CEILING: '0' }), 2000);
  assert.equal(emailDailyCeiling({ AUTH_EMAIL_DAILY_CEILING: '800' }), 800);
  const prod = emailLimitOptions(EMAIL_LOGIN_LIMITS[2], 'a@b.in', { NODE_ENV: 'production' });
  assert.deepEqual(prod, { route: '/api/auth/email-login#email', limit: 15, windowMs: 3_600_000, identityOnly: true, keyParts: ['a@b.in'], persistent: true, fallback: 'memory' });
  assert.equal(emailLimitOptions(EMAIL_LOGIN_LIMITS[0], 'a@b.in', { NODE_ENV: 'development' }).persistent, false, 'a dev server keeps the switch');
  assert.deepEqual(emailLimitOptions(emailLoginSiteLimit({}), 'a@b.in', { NODE_ENV: 'production' }).keyParts, ['all']);
});

test('A1 cross-lane: Play purchase verification really fails closed in production (database limiter, no memory fallback)', async () => {
  const h = harness({ rpcError: true });
  try {
    const { checkPersistentRateLimit } = await load('src/lib/server/rateLimit.js');
    const { handlePlayVerify } = await load('src/lib/server/playBillingHttp.js');
    const deps = { enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), rateLimit: checkPersistentRateLimit, billing: {} };
    const res = await handlePlayVerify(deps, new Request('https://www.mockmob.in/api/billing/play/verify', { method: 'POST', body: '{}' }));
    assert.equal(res.status, 429, 'refused when the database cannot answer');
    assert.equal(h.state.takes.length, 1, 'the database was asked although PERSISTENT_LIMITS_ENABLED is unset');
    assert.equal(h.state.takes[0].p_bucket, sha(['/api/billing/play/verify', '', 'u1']));
  } finally { h.restore(); }
});

// ---------------------------------------------------------------------------------------------------------------------
// F5: each limit has its own honest reply, with the wait from the limiter.
// ---------------------------------------------------------------------------------------------------------------------
test('F5: the inbox limit says a code was already sent, with the real minutes left, and keeps the rate_limited code', async () => {
  await withRoute({}, async ({ POST, advance }) => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await POST(post('me@example.com', '198.51.100.40'))).status, 200);
      advance(61_000);
    }
    advance(10 * 60_000); // 15 minutes 5 seconds after the first: the hour has about 45 minutes left
    const res = await POST(post('me@example.com', '198.51.100.40'));
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, 'rate_limited');
    assert.equal(body.scope, 'email');
    assert.equal(body.message, 'We already sent a code to this email. Check your inbox and spam, or try again in 45 minutes.');
    assert.equal(res.headers.get('retry-after'), String(body.retryAfterSeconds));
  });
});

test('F5: the network limit says nothing was sent and does not use the code the card opens the field for', async () => {
  await withRoute({}, async ({ POST, state, advance }) => {
    for (let i = 0; i < 60; i += 1) assert.equal((await POST(post(`p${i}@example.com`, '198.51.100.50'))).status, 200);
    advance(30 * 60_000);
    const res = await POST(post('p60@example.com', '198.51.100.50'));
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.code, 'rate_limited_network');
    assert.equal(body.scope, 'network');
    assert.equal(body.message, 'Too many sign-in emails from this network just now. Try again in 30 minutes, or use Google.');
    assert.equal(state.sent.length, 60);
  });
});

test('F5: the replies, one by one (singular minute, the short resend wait in seconds)', async () => {
  const { emailLimitReply } = await import('../../src/lib/server/emailLoginPolicy.js');
  assert.equal(emailLimitReply('email', 45).message, 'A code was sent a moment ago. You can ask for a new one in 45 seconds.');
  assert.equal(emailLimitReply('email', 100).message, 'We already sent a code to this email. Check your inbox and spam, or try again in 2 minutes.');
  assert.equal(emailLimitReply('network', 50).message, 'Too many sign-in emails from this network just now. Try again in 1 minute, or use Google.');
  assert.equal(emailLimitReply('network', undefined).retryAfterSeconds, 60);
  for (const scope of ['email', 'network', 'site']) {
    const { message } = emailLimitReply(scope, 600);
    assert.doesNotMatch(message, /[!—→]/);
  }
});

test('F5: the card opens the code field only for the inbox limit', () => {
  const card = read('src/components/ui/SignupCard.jsx');
  const handler = card.slice(card.indexOf('const sendCode = async'), card.indexOf('const handleEmailSubmit'));
  const start = handler.indexOf('if (sendError) {');
  const errorPath = handler.slice(start, handler.indexOf('return;', start));
  assert.ok(start > 0 && errorPath.length > 50);
  assert.match(errorPath, /if \(sendError\.code === 'rate_limited'\) setOtpSent\(true\);/);
  assert.equal((errorPath.match(/setOtpSent\(true\)/g) || []).length, 1, 'no other error opens the field');
  const provider = read('src/components/AuthProvider.jsx');
  assert.match(provider, /code: data\?\.code \|\|/, 'the route\'s own code reaches the card');
});

// ---------------------------------------------------------------------------------------------------------------------
// A3: security headers on every route.
// ---------------------------------------------------------------------------------------------------------------------
async function configHeaders(nodeEnv) {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    const config = (await load('next.config.mjs')).default;
    return await config.headers();
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved;
  }
}

test('A3: every route gets the security headers in production, with these exact values', async () => {
  const rules = await configHeaders('production');
  const all = rules.find((r) => r.source === '/:path*');
  assert.ok(all, 'a rule for every path');
  const h = Object.fromEntries(all.headers.map(({ key, value }) => [key, value]));
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(h['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(h['Content-Security-Policy'], "frame-ancestors 'self'", 'the enforced policy is framing only');
  assert.equal(h['Permissions-Policy'], 'camera=(), microphone=(), geolocation=(), browsing-topics=(), fullscreen=(self "https://www.instagram.com")');
  assert.doesNotMatch(h['Permissions-Policy'], /payment/, 'Razorpay keeps the payment feature');
  assert.equal(h['Strict-Transport-Security'], undefined, 'HSTS stays as Vercel sends it');
  const csp = h['Content-Security-Policy-Report-Only'];
  for (const part of [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com/gsi/client",
    'frame-src https://api.razorpay.com https://checkout.razorpay.com https://www.instagram.com https://accounts.google.com',
    "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "media-src 'self' blob:",
  ]) assert.ok(csp.split('; ').includes(part), part);
  assert.match(csp, /connect-src 'self' https:\/\/[a-z0-9]+\.supabase\.co wss:\/\/[a-z0-9]+\.supabase\.co /);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/, 'ignored (and warned about) in a report-only policy');
  // The cache rules are still there and the dev server still gets none.
  assert.ok(rules.some((r) => r.source === '/sw.js'));
  // P14: the versioned hero film files are immutable for a year; the unversioned ones are not matched.
  const film = rules.find((r) => r.source.startsWith('/video/'));
  assert.deepEqual(film.headers, [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]);
  const pattern = new RegExp(`^${film.source.match(/\((.+)\)$/)[1]}$`);
  assert.ok(['hero-v5-1080.mp4', 'hero-v5-480.mp4', 'hero-v12-720.mp4'].every((f) => pattern.test(f)));
  assert.ok(['hero-480.mp4', 'hero-v5-poster.webp', 'hero-v5-720.mp4.map'].every((f) => !pattern.test(f)));
  assert.deepEqual(await configHeaders('development'), []);
});

test('A3: what we frame is what the report-only policy lists (Instagram embeds; Razorpay opens its own frames; the films are ours)', () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(m?js|jsx|tsx?)$/.test(name) && !/\.test\./.test(name)) files.push(full);
    }
  };
  walk(resolve(root, 'src'));
  const framing = files.filter((f) => /<iframe/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(root.length + 1).replace(/\\/g, '/'));
  assert.deepEqual(framing, ['src/components/landing/CreatorReels.jsx']);
  const social = read('src/lib/social.js');
  assert.match(social, /export const embedSrc = \(item\) => `\$\{permalink\(item\)\}embed`;/);
  assert.match(social, /export const permalink = \(item\) => `https:\/\/www\.instagram\.com\//, 'the embeds come from www.instagram.com');
});

// ---------------------------------------------------------------------------------------------------------------------
// A4: the same-origin rule for state-changing API requests, as a pure function and through the real proxy and route.
// ---------------------------------------------------------------------------------------------------------------------
test('A4: the origin rule (pure)', async () => {
  const { allowedWriteOrigin } = await import('../../src/lib/server/sameOriginWrite.js');
  const prod = { NODE_ENV: 'production' };
  const check = (over) => allowedWriteOrigin({ method: 'POST', pathname: '/api/me/delete', origin: 'https://evil.example', host: 'www.mockmob.in', env: prod, ...over });
  assert.equal(check({}), false, 'another site');
  assert.equal(check({ origin: 'null' }), false, 'a sandboxed frame or a file');
  assert.equal(check({ origin: 'not a url' }), false);
  assert.equal(check({ origin: 'https://www.mockmob.in.evil.example' }), false);
  assert.equal(check({ origin: null }), true, 'no Origin: the app, webhooks, cron, server calls');
  assert.equal(check({ origin: '' }), true);
  assert.equal(check({ origin: 'https://www.mockmob.in' }), true);
  assert.equal(check({ origin: 'https://mockmob.in' }), true, 'the apex is ours');
  assert.equal(check({ origin: 'http://mockmob.in' }), false, 'not over plain http from another host');
  assert.equal(check({ origin: 'https://mockmob-git-x.vercel.app', host: 'mockmob-git-x.vercel.app' }), true, 'a preview deployment, its own host');
  assert.equal(check({ origin: 'https://mockmob-abc.vercel.app', env: { ...prod, VERCEL_URL: 'mockmob-abc.vercel.app' } }), true);
  assert.equal(check({ origin: 'http://localhost:3000' }), false, 'localhost only in development');
  assert.equal(check({ origin: 'http://localhost:3000', host: 'www.mockmob.in', env: { NODE_ENV: 'development' } }), true);
  assert.equal(check({ origin: 'https://localhost', appOrigin: true }), true, 'the app shell origins');
  for (const method of ['PUT', 'PATCH', 'DELETE', 'delete']) assert.equal(check({ method }), false, method);
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(check({ method }), true, method);
  assert.equal(check({ pathname: '/dashboard' }), true, 'pages are not this rule\'s business');
});

async function proxyCall(path, { method = 'GET', headers = {}, body } = {}) {
  const { proxy, config } = await load('src/proxy.js');
  const { NextRequest } = await import('next/server.js');
  const request = new NextRequest(`https://www.mockmob.in${path}`, { method, headers: { host: 'www.mockmob.in', ...headers }, body });
  return { response: await proxy(request), config };
}
const passed = (res) => res.status === 200 && res.headers.get('x-middleware-next') === '1';

test('A4: the proxy refuses a cross-site form post to /api/me/delete and every cross-site write under /api', async () => {
  const { response } = await proxyCall('/api/me/delete', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'text/plain', cookie: 'sb-x-auth-token=abc' }, body: 'source=web' });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Forbidden', code: 'cross_site_request' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  for (const [path, method] of [['/api/me/goal', 'PUT'], ['/api/users/u1', 'PATCH'], ['/api/me/password', 'POST'], ['/api/sessions', 'DELETE']]) {
    assert.equal((await proxyCall(path, { method, headers: { origin: 'https://evil.example' }, body: method === 'DELETE' ? undefined : '{}' })).response.status, 403, path);
  }
  assert.ok(passed((await proxyCall('/api/me/delete', { method: 'POST', headers: { origin: 'https://www.mockmob.in', 'content-type': 'application/json' }, body: '{}' })).response), 'our own page');
});

test('A4: webhooks, the app\'s bearer routes and cron are untouched', async () => {
  const { config } = await proxyCall('/api/auth/me');
  // They send no Origin, and the API matcher needs one, so the proxy never runs for them.
  assert.deepEqual(config.matcher[1], { source: '/api/:path*', has: [{ type: 'header', key: 'origin' }] });
  assert.match(config.matcher[0], /^\/\(\(\?!api\//, 'pages keep their own matcher, with /api excluded');
  // And if one ever reached it, it passes.
  for (const [path, method, headers] of [
    ['/api/billing/webhook', 'POST', { 'x-razorpay-signature': 'sig', 'content-type': 'application/json' }],
    ['/api/billing/play/rtdn?token=t', 'POST', { 'content-type': 'application/json' }],
    ['/api/mobile/attempts', 'POST', { authorization: 'Bearer token', 'content-type': 'application/json' }],
    ['/api/me/delete', 'POST', { authorization: 'Bearer token' }],
    ['/api/internal/finalise-sessions', 'GET', { authorization: 'Bearer cron' }],
  ]) {
    const { response } = await proxyCall(path, { method, headers, body: method === 'GET' ? undefined : '{}' });
    assert.ok(passed(response), path);
  }
  // The Capacitor shell's WebView sends its fixed origin (mobileCors.js), which CORS already trusts.
  for (const origin of ['https://localhost', 'capacitor://localhost']) {
    const { response } = await proxyCall('/api/sessions', { method: 'PUT', headers: { origin, authorization: 'Bearer token' }, body: '{}' });
    assert.ok(passed(response), origin);
  }
  // A cross-site read is not this rule's business (CORS decides what a page may read).
  assert.ok(passed((await proxyCall('/api/stats', { headers: { origin: 'https://evil.example' } })).response));
});

test('A4: /api/me/delete needs a JSON body from a browser session; the app\'s bearer call needs none', async () => {
  const calls = { auth: 0, deletion: [] };
  globalThis.__mmSec = {
    auth: async () => { calls.auth += 1; return { user: { id: 'u1' } }; },
    requestDeletion: async (id, source) => { calls.deletion.push([id, source]); return { status: 'pending', requestedAt: '2026-11-15T00:00:00.000Z' }; },
  };
  try {
    const { POST } = await load('src/app/api/me/delete/route.js');
    const req = (headers, body) => new Request('https://www.mockmob.in/api/me/delete', { method: 'POST', headers, body });
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', '']) {
      const res = await POST(req(type ? { 'content-type': type } : {}, 'source=web'));
      assert.equal(res.status, 415, type || 'no type');
    }
    assert.equal(calls.auth, 0, 'refused before the session is read');
    assert.deepEqual(calls.deletion, []);
    assert.equal((await POST(req({ 'content-type': 'application/json' }, JSON.stringify({ source: 'web' })))).status, 200);
    assert.equal((await POST(req({ authorization: 'Bearer t' }))).status, 200, 'the app may send no body');
    assert.deepEqual(calls.deletion, [['u1', 'web'], ['u1', 'android']]);
  } finally { delete globalThis.__mmSec; }
});

// ---------------------------------------------------------------------------------------------------------------------
// A5: a password needs a sign-in on this session within 15 minutes.
// ---------------------------------------------------------------------------------------------------------------------
test('A5: signedInRecently reads the session\'s own amr; a refresh or an old sign-in is not enough', async () => {
  const { signedInRecently, RECENT_SIGN_IN_MS } = await import('../../src/lib/server/passwordSet.js');
  const now = Date.UTC(2026, 10, 15, 10, 0, 0);
  const at = (minutesAgo) => Math.floor((now - minutesAgo * 60_000) / 1000);
  assert.equal(RECENT_SIGN_IN_MS, 15 * 60_000);
  assert.equal(signedInRecently({ amr: [{ method: 'otp', timestamp: at(2) }] }, now), true);
  assert.equal(signedInRecently({ amr: [{ method: 'oauth', timestamp: at(14) }] }, now), true);
  assert.equal(signedInRecently({ amr: [{ method: 'magiclink', timestamp: at(16) }] }, now), false, 'older than 15 minutes');
  assert.equal(signedInRecently({ amr: [{ method: 'token_refresh', timestamp: at(1) }] }, now), false, 'a refresh is not a sign-in');
  assert.equal(signedInRecently({ amr: [{ method: 'anonymous', timestamp: at(1) }] }, now), false);
  assert.equal(signedInRecently({ amr: [{ method: 'otp', timestamp: at(400) }, { method: 'oauth', timestamp: at(3) }] }, now), true, 'the newest sign-in counts');
  assert.equal(signedInRecently({ amr: [{ method: 'otp', timestamp: at(-5) }] }, now), false, 'a stamp from the future is refused');
  assert.equal(signedInRecently({}, now), false);
  assert.equal(signedInRecently(null, now), false);
});

function passwordServer({ claims, claimsError = null }) {
  const calls = { update: 0, options: null };
  const createServerClient = (url, key, options) => {
    calls.options = options;
    return {
      auth: {
        getClaims: async () => (claimsError ? { data: null, error: claimsError } : { data: claims ? { claims } : null, error: null }),
        updateUser: async () => { calls.update += 1; return { data: {}, error: null }; },
      },
    };
  };
  return { calls, args: { createServerClient, cookieStore: { getAll: () => [], set: () => {} }, supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon' } };
}

test('A5: a session that signed in long ago gets reauth_required (401) and the password is not changed', async () => {
  const { setAccountPassword, PASSWORD_STATUS } = await import('../../src/lib/server/passwordSet.js');
  const now = Date.UTC(2026, 10, 15, 10, 0, 0);
  const old = passwordServer({ claims: { sub: 'u1', amr: [{ method: 'otp', timestamp: Math.floor(now / 1000) - 3600 }] } });
  const out = await setAccountPassword({ password: 'correct horse 9', ...old.args, nowMs: () => now });
  assert.equal(out.ok, false);
  assert.equal(out.code, 'reauth_required');
  assert.equal(PASSWORD_STATUS.reauth_required, 401);
  assert.equal(old.calls.update, 0);
  const fresh = passwordServer({ claims: { sub: 'u1', amr: [{ method: 'oauth', timestamp: Math.floor(now / 1000) - 120 }] } });
  assert.deepEqual(await setAccountPassword({ password: 'correct horse 9', ...fresh.args, nowMs: () => now }), { ok: true });
  assert.equal(fresh.calls.update, 1);
  const none = passwordServer({ claims: null });
  assert.equal((await setAccountPassword({ password: 'correct horse 9', ...none.args, nowMs: () => now })).code, 'signed_out');
  const down = passwordServer({ claimsError: { name: 'AuthRetryableFetchError', status: 503 } });
  assert.equal((await setAccountPassword({ password: 'correct horse 9', ...down.args, nowMs: () => now })).code, 'unavailable');
  assert.equal(none.calls.update + down.calls.update, 0);
});

// ---------------------------------------------------------------------------------------------------------------------
// A7: Secure session cookies in production, never on http://localhost; all four clients use the same options.
// ---------------------------------------------------------------------------------------------------------------------
test('A7: the cookie options', async () => {
  const { supabaseCookieOptions } = await import('../../src/lib/supabaseCookieOptions.js');
  assert.deepEqual(supabaseCookieOptions({ location: null, env: { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.mockmob.in' } }), { secure: true });
  assert.deepEqual(supabaseCookieOptions({ location: null, env: { NODE_ENV: 'production' } }), { secure: true });
  assert.deepEqual(supabaseCookieOptions({ location: null, env: { NODE_ENV: 'development' } }), { secure: false });
  assert.deepEqual(supabaseCookieOptions({ location: null, env: { NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' } }), { secure: false });
  assert.deepEqual(supabaseCookieOptions({ location: null, env: { NODE_ENV: 'production', MOCKMOB_STAGING_APP: '1' } }), { secure: false });
  assert.deepEqual(supabaseCookieOptions({ location: { protocol: 'https:' } }), { secure: true });
  assert.deepEqual(supabaseCookieOptions({ location: { protocol: 'http:' } }), { secure: false });
});

test('A7: the password and server-read clients pass Secure in production; the proxy and browser clients use the same helper', async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { setAccountPassword } = await import('../../src/lib/server/passwordSet.js');
    const fake = passwordServer({ claims: { sub: 'u1', amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }] } });
    await setAccountPassword({ password: 'correct horse 9', ...fake.args });
    assert.equal(fake.calls.options.cookieOptions.secure, true);
    const { readCookieUser } = await import('../../src/lib/server/cookieSession.js');
    let seen = null;
    await readCookieUser({
      cookieStore: { getAll: () => [], set: () => {} },
      createServerClient: (u, k, options) => { seen = options; return { auth: { getUser: async () => ({ data: { user: null }, error: null }) } }; },
      supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon',
    });
    assert.equal(seen.cookieOptions.secure, true);
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved;
  }
  assert.match(read('src/proxy.js'), /clientOptions: \{ cookieOptions: supabaseCookieOptions\(\) \}/);
  assert.match(read('src/lib/supabase-browser.js'), /cookieOptions: supabaseCookieOptions\(\),/);
});

// ---------------------------------------------------------------------------------------------------------------------
// A8: the dead preview-passcode gate is gone.
// ---------------------------------------------------------------------------------------------------------------------
test('A8: no coming-soon page, no unlock route, and nothing points at them', () => {
  assert.equal(existsSync(resolve(root, 'src/app/coming-soon')), false);
  assert.equal(existsSync(resolve(root, 'src/app/api/coming-soon')), false);
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(m?js|jsx|tsx?)$/.test(name)) files.push(full);
    }
  };
  walk(resolve(root, 'src'));
  const offenders = files.filter((f) => /['"`]\/(api\/)?coming-soon|ComingSoonClient|mockmob_preview_access/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});

// ---------------------------------------------------------------------------------------------------------------------
// A9, F9, F10: the sign-in screens.
// ---------------------------------------------------------------------------------------------------------------------
test('A9: the emailed link names the account it signed into before MockMob opens, with "Not you? Sign out"', () => {
  const page = read('src/app/auth/callback/AuthCallbackPageClient.jsx');
  const finish = page.slice(page.indexOf('async function finishEmailLink'), page.indexOf('// Waits for the session'));
  assert.ok(finish.indexOf('verifyOtp') < finish.indexOf('onSignedIn(email)'), 'shown once the link is spent and its account is known');
  assert.match(finish, /data\?\.user\?\.email/);
  assert.match(finish, /Promise\.all\(\[loadProfileDestination\(supabase\), sleep\(NAME_HOLD_MS\)\]\)/, 'it stays long enough to read');
  assert.match(page, /message=\{`Signing you in as \$\{signingInAs\}`\}/);
  assert.match(page, /'Not you\? Sign out'/);
  assert.match(page, /signOut\(\{ scope: 'local' \}\)/, 'only this browser\'s new session ends');
  const open = page.slice(page.indexOf('const open = useCallback'), page.indexOf('const follow = useCallback'));
  assert.match(open, /leftRef\.current\) return;/, 'after "Not you?" MockMob never opens');
});

test('F9: the Google key is ready again when the page comes back from the back-forward cache', () => {
  const card = read('src/components/ui/SignupCard.jsx');
  assert.match(card, /const reset = \(event\) => \{ if \(event\.persisted\) setGoogleLoading\(false\); \};/);
  assert.match(card, /window\.addEventListener\('pageshow', reset\);/);
  assert.match(card, /return \(\) => window\.removeEventListener\('pageshow', reset\);/);
});

function memoryStore() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
}

test('F10: a failed sign-up callback goes back to sign-up with its reason, and the typed email comes back once', async () => {
  const { rememberAuthStart, readAuthStart, markAuthStartFailed, takeFailedAuthEmail, forgetAuthStart } = await import('../../src/lib/auth-redirect.js');
  const { callbackBackKey, callbackCopyFor, readCallbackParams } = await import('../../src/lib/auth-callback.js');
  const store = memoryStore();
  const now = 1_000_000;
  rememberAuthStart('signup', ' new@student.in ', { store, now });
  assert.deepEqual(readAuthStart({ store, now }), { mode: 'signup', email: 'new@student.in', failed: false });
  assert.equal(takeFailedAuthEmail('signup', { store, now }), '', 'nothing is filled back in without a failure');
  assert.equal(markAuthStartFailed({ store, now: now + 1000 }).mode, 'signup');
  assert.equal(takeFailedAuthEmail('login', { store, now: now + 2000 }), '', 'only on the card it came from');
  assert.equal(takeFailedAuthEmail('signup', { store, now: now + 2000 }), 'new@student.in');
  assert.equal(takeFailedAuthEmail('signup', { store, now: now + 3000 }), '', 'once');
  rememberAuthStart('signup', 'not an email', { store, now });
  assert.equal(readAuthStart({ store, now }).email, null);
  assert.equal(readAuthStart({ store, now: now + 31 * 60_000 }), null, 'kept for 30 minutes');
  rememberAuthStart('admin', 'a@b.in', { store, now });
  assert.equal(readAuthStart({ store, now }).mode, 'signup', 'an unknown card is not saved');
  forgetAuthStart({ store });
  assert.equal(readAuthStart({ store, now }), null);
  store.setItem('mm_auth_from', '{not json');
  assert.equal(readAuthStart({ store, now }), null);

  assert.deepEqual(callbackBackKey('signup'), { href: '/signup', label: 'Back to sign-up' });
  assert.deepEqual(callbackBackKey('login'), { href: '/login', label: 'Back to login' });
  assert.deepEqual(callbackBackKey(undefined), { href: '/login', label: 'Back to login' });
  const cancelled = readCallbackParams('?error=access_denied').message;
  assert.equal(callbackCopyFor(cancelled, 'signup'), 'Google sign-in was cancelled. Go back to sign-up to try again, or use the email code.');
  assert.equal(callbackCopyFor(cancelled, 'login'), cancelled);
  assert.doesNotMatch(callbackCopyFor('You are signed in, but your profile did not load yet. Check your connection, then go back to login.', 'signup'), /login/);

  const page = read('src/app/auth/callback/AuthCallbackPageClient.jsx');
  assert.match(page, /error=\{callbackCopyFor\(error, backMode\)\}/);
  assert.match(page, /actionHref=\{back\.href\}/);
  assert.match(page, /setBackMode\(markAuthStartFailed\(\)\?\.mode \|\| 'login'\)/);
  assert.match(page, /forgetAuthStart\(\);\s+window\.location\.replace\(destination\);/, 'a finished sign-in forgets where it started');
  const card = read('src/components/ui/SignupCard.jsx');
  assert.match(card, /rememberAuthStart\(mode, email\);/, 'Google start');
  assert.match(card, /rememberAuthStart\(mode, cleanEmail\);/, 'email code start');
  assert.match(card, /const kept = takeFailedAuthEmail\(mode\);/);
});
