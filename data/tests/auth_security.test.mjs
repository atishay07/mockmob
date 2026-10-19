// Behaviour tests for the auth review fixes (13 Oct 2026): H2 (unconfirmed passwords),
// M1 (email-code limits), L3 (link origin), L8 (app hint in the email), L9 (no next-auth).
// auth_reliability.test.mjs checks some of these by source text; this file runs them.
//
// The email-login route imports `@/...` aliases, `server-only`, Resend and the Supabase admin
// client. A resolve hook maps the aliases and swaps the two clients for in-memory fakes, so the
// real route and the real rate limiter run without a network or a database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8');

// ---------------------------------------------------------------------------------------
// Module hooks for the route under test.
// ---------------------------------------------------------------------------------------
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__mmAuthTest.admin();',
  '@/lib/resend': 'export const resend = { emails: { send: (m) => globalThis.__mmAuthTest.send(m) } };',
};
const EXTENSIONS = ['', '.js', '.ts', '.mjs'];

function withExtension(path) {
  for (const ext of EXTENSIONS) {
    const candidate = path + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

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
async function loadRoute() {
  fresh += 1;
  // A new query string gives a new module instance, so the route's in-memory buckets reset.
  return import(`${pathToFileURL(resolve(root, 'src/app/api/auth/email-login/route.js')).href}?t=${fresh}`);
}

const ENV_KEYS = ['NODE_ENV', 'NEXT_PUBLIC_SITE_URL', 'RESEND_API_KEY', 'PERSISTENT_LIMITS_ENABLED', 'MOCKMOB_STAGING_APP', 'AUTH_EMAIL_FROM'];

// Sets up the fakes. `persistent` simulates the take_rate_limit RPC with real counting.
function harness({ persistent = true, rpcError = false, generateLinkError = null, sendResult = {}, otpLength = 8 } = {}) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const realNow = Date.now;
  const state = { clock: realNow.call(Date), events: [], sent: [], buckets: new Map(), calls: [], clearFails: false };
  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 're_test_key_123';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.mockmob.in';
  delete process.env.MOCKMOB_STAGING_APP;
  if (persistent) process.env.PERSISTENT_LIMITS_ENABLED = 'true'; else delete process.env.PERSISTENT_LIMITS_ENABLED;
  Date.now = () => state.clock;
  globalThis.__mmAuthTest = {
    admin: () => ({
      rpc: async (name, args) => {
        state.events.push(`rpc:${name}`);
        if (name === 'take_rate_limit') {
          if (rpcError) return { data: null, error: { code: 'XX000' } };
          const entry = state.buckets.get(args.p_bucket) || { count: 0, resetAt: state.clock + args.p_window_ms };
          if (entry.resetAt <= state.clock) { entry.count = 0; entry.resetAt = state.clock + args.p_window_ms; }
          state.buckets.set(args.p_bucket, entry);
          if (entry.count >= args.p_limit) return { data: false, error: null };
          entry.count += 1;
          return { data: true, error: null };
        }
        if (name === 'auth_clear_unconfirmed_password' && state.clearFails) return { data: null, error: { code: '42883' } };
        return { data: 0, error: null };
      },
      auth: {
        admin: {
          generateLink: async (args) => {
            state.events.push('generateLink');
            state.calls.push(args);
            if (generateLinkError) return { data: null, error: generateLinkError };
            return { data: { properties: { email_otp: '1234567890'.slice(0, otpLength), hashed_token: 'hash_abc', verification_type: 'magiclink' } }, error: null };
          },
        },
      },
    }),
    send: async (message) => {
      state.events.push('send');
      state.sent.push(message);
      return sendResult;
    },
  };
  return {
    state,
    advance: (ms) => { state.clock += ms; },
    restore() {
      Date.now = realNow;
      delete globalThis.__mmAuthTest;
      for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    },
  };
}

function post(email, ip = '203.0.113.7', headers = {}, extra = {}) {
  return new Request('https://www.mockmob.in/api/auth/email-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
    body: JSON.stringify({ email, ...extra }),
  });
}

async function withRoute(options, fn) {
  const h = harness(options);
  try {
    const route = await loadRoute();
    await fn({ POST: route.POST, ...h });
  } finally {
    h.restore();
  }
}

function quietly(fn) {
  return async () => {
    const realError = console.error;
    const errors = [];
    console.error = (...a) => errors.push(a.map(String).join(' '));
    try { return await fn(errors); } finally { console.error = realError; }
  };
}

// ---------------------------------------------------------------------------------------
// M1, L3, L8, H2 ordering: the real route.
// ---------------------------------------------------------------------------------------
test('email-login: sends one mail with a pinned link, the app hint and the real code length', async () => {
  for (const otpLength of [6, 8]) {
    await withRoute({ otpLength }, async ({ POST, state }) => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://evil.example';
      const res = await POST(post('Student@Example.com ', '198.51.100.1', { host: 'evil.example' }));
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
      assert.equal(state.sent.length, 1);
      const mail = state.sent[0];
      assert.equal(mail.to, 'student@example.com', 'email trimmed and lower-cased');
      assert.equal(state.calls[0].email, 'student@example.com');
      assert.equal(state.calls[0].options.redirectTo, 'https://www.mockmob.in/auth/callback', 'a bad NEXT_PUBLIC_SITE_URL falls back to the real site');
      assert.match(mail.html, /href="https:\/\/www\.mockmob\.in\/auth\/callback\?token_hash=hash_abc&amp;type=magiclink"/);
      assert.doesNotMatch(mail.html, /evil\.example/);
      assert.match(mail.html, /Using the MockMob app\? Type this code in the app\./);
      assert.match(mail.html, new RegExp(`Your ${otpLength}-digit login code`));
      assert.match(mail.html, new RegExp(`>${'1234567890'.slice(0, otpLength)}<`));
    });
  }
});

test('email-login (20 Oct, I2): a code asked for in the app gets a button on /app/login, which the app claims', async () => {
  await withRoute({}, async ({ POST, state }) => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const res = await POST(post('app@example.com', '198.51.100.9', {}, { client: 'app' }));
    assert.equal(res.status, 200);
    const mail = state.sent[0];
    assert.match(mail.html, /href="https:\/\/www\.mockmob\.in\/app\/login\?token_hash=hash_abc&amp;type=magiclink"/);
    assert.doesNotMatch(mail.html, /\/auth\/callback\?/);
    assert.match(mail.html, /Tap the button on this phone to open the MockMob app, or type the code in the app\./);
    assert.doesNotMatch(mail.html, /The button opens the website\./);
  });
  await withRoute({}, async ({ POST, state }) => {
    const res = await POST(post('web@example.com', '198.51.100.10', {}, { client: 'web' }));
    assert.equal(res.status, 200);
    assert.match(state.sent[0].html, /href="https:\/\/www\.mockmob\.in\/auth\/callback\?token_hash=/, 'website sign-ins keep the callback the app never claims');
  });
});

test('email-login: any password on an unconfirmed account is cleared before the code is minted', async () => {
  await withRoute({}, async ({ POST, state }) => {
    const res = await POST(post('new@example.com', '198.51.100.2'));
    assert.equal(res.status, 200);
    const order = state.events.filter((e) => e === 'rpc:auth_clear_unconfirmed_password' || e === 'generateLink' || e === 'send');
    assert.deepEqual(order, ['rpc:auth_clear_unconfirmed_password', 'generateLink', 'send']);
  });
});

test('email-login: a failing password-clear never blocks sign-in', quietly(async (errors) => {
  await withRoute({}, async ({ POST, state }) => {
    state.clearFails = true;
    const res = await POST(post('x@example.com', '198.51.100.3'));
    assert.equal(res.status, 200);
    assert.equal(state.sent.length, 1);
  });
  assert.ok(errors.some((e) => /clearing an unconfirmed password failed/.test(e)));
}));

test('email-login: rejects bad input before touching anything', async () => {
  await withRoute({}, async ({ POST, state }) => {
    const raw = (body) => new Request('https://www.mockmob.in/api/auth/email-login', { method: 'POST', body, headers: { 'x-forwarded-for': '198.51.100.4' } });
    for (const body of [{}, { email: 'nope' }, { email: 42 }, { email: 'a@b' }]) {
      assert.equal((await POST(raw(JSON.stringify(body)))).status, 400);
    }
    assert.equal((await POST(raw('{not json'))).status, 400);
    assert.deepEqual(state.events, []);
  });
});

test('email-login: failures answer 500 with fixed copy and never mail a code', quietly(async () => {
  await withRoute({ generateLinkError: { message: 'secret internal detail' } }, async ({ POST, state }) => {
    const res = await POST(post('a@example.com', '198.51.100.5'));
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(await res.json()), /secret internal detail/);
    assert.equal(state.sent.length, 0);
  });
  await withRoute({ sendResult: { error: { statusCode: 500, message: 'resend internals' } } }, async ({ POST }) => {
    const res = await POST(post('a@example.com', '198.51.100.6'));
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(await res.json()), /resend internals/);
  });
  await withRoute({}, async ({ POST, state }) => {
    process.env.RESEND_API_KEY = 're_xxxxxxxxx';
    const res = await POST(post('a@example.com', '198.51.100.7'));
    assert.equal(res.status, 500);
    assert.equal(state.events.includes('generateLink'), false, 'no code minted when mail cannot be sent');
  });
}));

test('email-login limit: one address and one email gets 5 an hour, one minute apart', async () => {
  await withRoute({}, async ({ POST, state, advance }) => {
    assert.equal((await POST(post('a@example.com', '198.51.100.20'))).status, 200);
    const tooSoon = await POST(post('a@example.com', '198.51.100.20'));
    assert.equal(tooSoon.status, 429);
    const body = await tooSoon.json();
    assert.equal(body.code, 'rate_limited');
    assert.ok(body.retryAfterSeconds >= 1 && body.retryAfterSeconds <= 60);
    assert.equal(tooSoon.headers.get('retry-after'), String(body.retryAfterSeconds));
    for (let i = 2; i <= 5; i += 1) {
      advance(61_000);
      assert.equal((await POST(post('a@example.com', '198.51.100.20'))).status, 200, `request ${i}`);
    }
    advance(61_000);
    assert.equal((await POST(post('a@example.com', '198.51.100.20'))).status, 429, 'sixth within the hour is refused');
    assert.equal(state.sent.length, 5);
  });
});

test('email-login limit: one address mailing many inboxes stops at 20 an hour', async () => {
  await withRoute({}, async ({ POST, state }) => {
    for (let i = 0; i < 20; i += 1) {
      assert.equal((await POST(post(`victim${i}@example.com`, '198.51.100.30'))).status, 200, `inbox ${i}`);
    }
    assert.equal((await POST(post('victim20@example.com', '198.51.100.30'))).status, 429);
    assert.equal(state.sent.length, 20);
    assert.equal((await POST(post('victim20@example.com', '198.51.100.31'))).status, 200, 'another address is unaffected');
  });
});

test('email-login limit: one inbox is capped at 15 an hour across addresses, and one address cannot lock the student out', async () => {
  await withRoute({}, async ({ POST, state, advance }) => {
    // One attacker address burns its own 5 and no more of the inbox's budget.
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await POST(post('target@example.com', '198.51.100.40'))).status, 200);
      advance(61_000);
    }
    assert.equal((await POST(post('target@example.com', '198.51.100.40'))).status, 429);
    // The student on another address can still sign in.
    assert.equal((await POST(post('target@example.com', '198.51.100.41'))).status, 200);
    assert.equal(state.sent.length, 6);
    // Nine more addresses reach the inbox cap of 15.
    for (let i = 0; i < 9; i += 1) {
      assert.equal((await POST(post('target@example.com', `198.51.100.${50 + i}`))).status, 200, `address ${i}`);
    }
    assert.equal(state.sent.length, 15);
    assert.equal((await POST(post('target@example.com', '198.51.100.99'))).status, 429, 'sixteenth mail to one inbox is refused');
    assert.equal(state.sent.length, 15);
  });
});

test('email-login limit: the hourly window reopens', async () => {
  await withRoute({}, async ({ POST, advance }) => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await POST(post('again@example.com', '198.51.100.60'))).status, 200);
      advance(61_000);
    }
    assert.equal((await POST(post('again@example.com', '198.51.100.60'))).status, 429);
    advance(60 * 60 * 1000);
    assert.equal((await POST(post('again@example.com', '198.51.100.60'))).status, 200);
  });
});

test('email-login limit: if the limiter database errors, requests are refused and nothing is mailed', async () => {
  await withRoute({ rpcError: true }, async ({ POST, state }) => {
    assert.equal((await POST(post('a@example.com', '198.51.100.70'))).status, 429);
    assert.equal(state.sent.length, 0);
    assert.equal(state.events.includes('generateLink'), false);
  });
});

test('email-login limit: without persistent limits the per-address limits still hold', async () => {
  await withRoute({ persistent: false }, async ({ POST, state, advance }) => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await POST(post('local@example.com', '198.51.100.80'))).status, 200);
      advance(61_000);
    }
    assert.equal((await POST(post('local@example.com', '198.51.100.80'))).status, 429);
    assert.equal(state.sent.length, 5);
  });
});

test('email-login: the per-instance bucket map is pruned once it is large, keeping recent buckets', async () => {
  const { pruneLocalBuckets, MAX_LOCAL_BUCKETS } = await import('../../src/lib/server/emailLoginPolicy.js');
  const hour = 60 * 60 * 1000;
  const now = 10 * hour;
  const map = new Map();
  assert.equal(pruneLocalBuckets(map, now), 0);
  for (let i = 0; i < MAX_LOCAL_BUCKETS; i += 1) map.set(`old${i}`, { lastAt: now - 2 * hour, attempts: [now - 2 * hour] });
  assert.equal(pruneLocalBuckets(map, now), 0, 'not pruned at the limit');
  map.set('recent', { lastAt: now - 1000, attempts: [now - 1000] });
  map.set('edge', { lastAt: now - hour + 1, attempts: [now - hour + 1] });
  assert.equal(pruneLocalBuckets(map, now), MAX_LOCAL_BUCKETS);
  assert.deepEqual([...map.keys()].sort(), ['edge', 'recent']);
  const route = read('src/app/api/auth/email-login/route.js');
  assert.match(route, /pruneLocalBuckets\(rateBuckets, now\)/);
});

// ---------------------------------------------------------------------------------------
// H2: the migration, run on a real Postgres (PGlite).
// ---------------------------------------------------------------------------------------
const migration = read('supabase/migrations/20261013150000_auth_unconfirmed_passwords.sql');

async function authDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      encrypted_password text,
      email_confirmed_at timestamptz,
      phone text,
      phone_confirmed_at timestamptz
    );
  `);
  await db.exec(migration);
  return db;
}

const pw = async (db, email) => (await db.query('select encrypted_password p from auth.users where email = $1', [email])).rows[0]?.p;
const cleared = async (db, email) => (await db.query('select public.auth_clear_unconfirmed_password($1) n', [email])).rows[0].n;

test('migration: applies twice, and only service_role may call the clearing function', async () => {
  const db = await authDb();
  try {
    await db.exec(migration);
    for (const [role, expected] of [['anon', false], ['authenticated', false], ['service_role', true]]) {
      const r = await db.query("select has_function_privilege($1, 'public.auth_clear_unconfirmed_password(text)', 'execute') ok", [role]);
      assert.equal(r.rows[0].ok, expected, role);
    }
    const t = await db.query("select has_function_privilege('anon', 'public.auth_drop_password_set_before_confirmation()', 'execute') a, has_function_privilege('authenticated', 'public.auth_drop_password_set_before_confirmation()', 'execute') b");
    assert.deepEqual(t.rows[0], { a: false, b: false });
  } finally { await db.close(); }
});

test('migration: an unconfirmed account loses an attacker-set password, a confirmed one keeps its own', async () => {
  const db = await authDb();
  try {
    await db.exec(`
      insert into auth.users(email, encrypted_password, email_confirmed_at) values
        ('victim@example.com', '$2a$10$attackerhash', null),
        ('Mixed.Case@Example.com', '$2a$10$attackerhash2', null),
        ('student@example.com', '$2a$10$studenthash', now()),
        ('nopass@example.com', '', null);
    `);
    assert.equal(await cleared(db, 'victim@example.com'), 1);
    assert.equal(await pw(db, 'victim@example.com'), '');
    assert.equal(await cleared(db, '  MIXED.case@example.com '), 1, 'case and spaces ignored');
    assert.equal(await pw(db, 'Mixed.Case@Example.com'), '');
    assert.equal(await cleared(db, 'student@example.com'), 0);
    assert.equal(await pw(db, 'student@example.com'), '$2a$10$studenthash', 'confirmed account untouched');
    assert.equal(await cleared(db, 'nopass@example.com'), 0);
    assert.equal(await cleared(db, ''), 0);
    assert.equal(await cleared(db, null), 0);
    assert.equal(await cleared(db, 'unknown@example.com'), 0);
  } finally { await db.close(); }
});

test('migration: confirming the email drops a password set before confirmation, and nothing else', async () => {
  const db = await authDb();
  try {
    await db.exec(`
      insert into auth.users(email, encrypted_password, email_confirmed_at) values
        ('victim@example.com', '$2a$10$attackerhash', null),
        ('google@example.com', '', null),
        ('student@example.com', '$2a$10$studenthash', now()),
        ('pwchange@example.com', '', null);
    `);
    // The real student confirms by code or Google: the attacker's password goes in the same update.
    await db.exec("update auth.users set email_confirmed_at = now() where email = 'victim@example.com'");
    assert.equal(await pw(db, 'victim@example.com'), '');
    // No password to drop: nothing breaks, confirmation still lands.
    await db.exec("update auth.users set email_confirmed_at = now() where email = 'google@example.com'");
    assert.equal((await db.query("select email_confirmed_at is not null c from auth.users where email = 'google@example.com'")).rows[0].c, true);
    // A confirmed student re-confirming or changing their password keeps it.
    await db.exec("update auth.users set email_confirmed_at = now() where email = 'student@example.com'");
    assert.equal(await pw(db, 'student@example.com'), '$2a$10$studenthash');
    await db.exec("update auth.users set encrypted_password = '$2a$10$newhash' where email = 'student@example.com'");
    assert.equal(await pw(db, 'student@example.com'), '$2a$10$newhash');
    // A password set after confirmation (the normal path) stays.
    await db.exec("update auth.users set email_confirmed_at = now() where email = 'pwchange@example.com'");
    await db.exec("update auth.users set encrypted_password = '$2a$10$later' where email = 'pwchange@example.com'");
    assert.equal(await pw(db, 'pwchange@example.com'), '$2a$10$later');
    // A confirmed phone does not make the email confirmed.
    await db.exec("insert into auth.users(email, encrypted_password, email_confirmed_at, phone_confirmed_at) values ('phone@example.com', '$2a$10$x', null, now())");
    assert.equal(await cleared(db, 'phone@example.com'), 1);
  } finally { await db.close(); }
});

// ---------------------------------------------------------------------------------------
// L9, M2, M3: leftovers and surfaces that cannot run here without a browser.
// ---------------------------------------------------------------------------------------
test('next-auth is absent from package.json, the lockfile and the route tree', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies?.['next-auth'], undefined);
  assert.equal(pkg.devDependencies?.['next-auth'], undefined);
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages?.['node_modules/next-auth'], undefined);
  assert.equal(lock.packages?.['']?.dependencies?.['next-auth'], undefined);
  assert.equal(existsSync(resolve(root, 'src/app/api/auth/[...nextauth]')), false);
});

test('the email link callback never spends the link on load and asks before switching accounts', () => {
  const page = read('src/app/auth/callback/AuthCallbackPageClient.jsx');
  const start = page.slice(page.indexOf('async function startAuth'), page.indexOf('async function finishEmailLink'));
  assert.ok(start.length > 100);
  assert.doesNotMatch(start, /verifyOtp/);
  assert.ok(start.indexOf('clearAuthQuery()') > 0 && start.indexOf('clearAuthQuery()') < start.indexOf("params.kind === 'token_hash'"), 'link removed from the address bar first');
  const finish = page.slice(page.indexOf('async function finishEmailLink'));
  assert.match(finish, /verifyOtp/);
  assert.match(page, /Stay signed in/);
});

test('sign-out of other devices uses the others scope and sits on the account page only', () => {
  const provider = read('src/components/AuthProvider.jsx');
  assert.match(provider, /signOut\(\{ scope: 'others' \}\)/);
  assert.equal((provider.match(/scope: 'others'/g) || []).length, 1);
  const body = read('src/components/auth/SignOutOtherDevices.jsx');
  assert.match(body, /disabled=\{busy\}/, 'double taps are blocked');
  assert.match(body, /busyRef/);
  assert.match(read('src/app/(app)/profile/ProfilePageClient.jsx'), /<SignOutOtherDevicesSection \/>/);
  // Ordinary sign-out stays local to the device.
  assert.doesNotMatch(provider, /scope: 'global'/);
});
