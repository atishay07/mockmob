// The welcome and day-2 emails, their routes and the one line in sign-in (15 Nov 2026). The rules themselves are proved in
// src/lib/email/studentMail.test.mjs; this file runs the real route handlers and the welcome hook against stubs, and checks
// the wiring in src/lib/auth.ts. Nothing here sends, signs in or reaches a database.
//   node --test data/tests/student_emails_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(resolve(root, rel), 'utf8').replace(/\r\n/g, '\n');
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__mmEmailTest.admin();',
  '@/lib/email/studentMailServer': 'export const optOutStudent = (id) => globalThis.__mmEmailTest.optOut(id); export const runDayTwoJob = () => globalThis.__mmEmailTest.run();',
};
function withExtension(path) {
  for (const ext of ['', '.js', '.ts', '.mjs']) {
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

const load = (rel) => import(pathToFileURL(resolve(root, rel)).href);
const { unsubscribeUrl, signInCeilingBucket } = await load('src/lib/email/studentMailModel.mjs');

async function withEnv(values, fn) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    delete globalThis.__mmEmailTest;
  }
}

// ------------------------------------------------------------------------------------------------------- the unsubscribe
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

test('unsubscribe GET changes nothing (mail scanners open links): it shows one button that posts the same signed address', async () => {
  const { GET } = await load('src/app/api/email/unsubscribe/route.js');
  await withEnv({ NEXTAUTH_SECRET: 'route-secret', EMAILS_ENABLED: undefined, NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.mockmob.in' }, async () => {
    globalThis.__mmEmailTest = { optOut: async () => assert.fail('a GET must never turn the emails off') };
    const url = unsubscribeUrl('https://www.mockmob.in', 'user-7', 'route-secret');
    for (let i = 0; i < 3; i += 1) {
      const res = await GET(new Request(url, { headers: { 'user-agent': 'link-scanner' } }));
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      const html = await res.text();
      assert.match(html, /Turn off these emails\?/);
      const { pathname, search } = new URL(url);
      assert.ok(html.includes(`<form method="post" action="${`${pathname}${search}`.replace(/&/g, '&amp;')}"`), 'the form posts the same signed address');
      assert.match(html, /<input type="hidden" name="page" value="1" \/>/);
      assert.equal((html.match(/<button type="submit"[^>]*>Turn off these emails<\/button>/g) || []).length, 1, 'one button');
      assert.equal((html.match(/class="em-btn"/g) || []).length, 1);
    }
    const forged = new URL(url);
    forged.searchParams.set('u', 'user-8');
    const bad = await GET(new Request(forged));
    assert.equal(bad.status, 400);
    const badHtml = await bad.text();
    assert.match(badHtml, /This link did not work/);
    assert.doesNotMatch(badHtml, /<form/, 'no button to post a forged link');
    assert.equal((await GET(new Request('https://www.mockmob.in/api/email/unsubscribe'))).status, 400);
  });
});

test('unsubscribe POST: the page\'s button and RFC 8058 one-click both turn the emails off; a bad signature changes nothing', async () => {
  const { POST } = await load('src/app/api/email/unsubscribe/route.js');
  await withEnv({ NEXTAUTH_SECRET: 'route-secret', EMAILS_ENABLED: undefined, NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.mockmob.in' }, async () => {
    const off = [];
    globalThis.__mmEmailTest = { optOut: async (id) => { off.push(id); return true; } };
    const url = unsubscribeUrl('https://www.mockmob.in', 'user-7', 'route-secret');

    // The page's button: the page saying so.
    const fromPage = await POST(new Request(url, { method: 'POST', headers: FORM, body: 'page=1' }));
    assert.equal(fromPage.status, 200);
    assert.match(fromPage.headers.get('content-type'), /text\/html/);
    assert.match(await fromPage.text(), /These emails are off[\s\S]*Sign-in codes still come when you ask for one\./);
    assert.deepEqual(off, ['user-7'], 'works while the emails are switched off too');

    // RFC 8058: a mail app's own Unsubscribe button, urlencoded or multipart; 200 and no page.
    const oneClick = await POST(new Request(url, { method: 'POST', headers: FORM, body: 'List-Unsubscribe=One-Click' }));
    assert.equal(oneClick.status, 200);
    assert.deepEqual(await oneClick.json(), { ok: true });
    const form = new FormData();
    form.set('List-Unsubscribe', 'One-Click');
    const multipart = await POST(new Request(url, { method: 'POST', body: form }));
    assert.equal(multipart.status, 200);
    assert.deepEqual(await multipart.json(), { ok: true });
    assert.deepEqual(off, ['user-7', 'user-7', 'user-7']);

    // A forged address writes nothing, from the page or one-click.
    const forged = new URL(url);
    forged.searchParams.set('u', 'user-8');
    const badPage = await POST(new Request(forged, { method: 'POST', headers: FORM, body: 'page=1' }));
    assert.equal(badPage.status, 400);
    assert.match(await badPage.text(), /This link did not work/);
    const badClick = await POST(new Request(forged, { method: 'POST', headers: FORM, body: 'List-Unsubscribe=One-Click' }));
    assert.equal(badClick.status, 400);
    assert.deepEqual(await badClick.json(), { ok: false });
    assert.deepEqual(off, ['user-7', 'user-7', 'user-7']);

    // The database down: an error page whose Try again opens the signed link (the one-button page) again.
    globalThis.__mmEmailTest = { optOut: async () => { throw new Error('db down'); } };
    const quiet = console.warn;
    console.warn = () => {};
    try {
      const down = await POST(new Request(url, { method: 'POST', headers: FORM, body: 'page=1' }));
      assert.equal(down.status, 503);
      const page = await down.text();
      assert.match(page, /We could not turn these emails off just now/);
      const { pathname, search } = new URL(url);
      assert.ok(page.includes(`href="${`${pathname}${search}`.replace(/&/g, '&amp;')}"`), 'Try again opens the same signed link');
      const downClick = await POST(new Request(url, { method: 'POST', headers: FORM, body: 'List-Unsubscribe=One-Click' }));
      assert.equal(downClick.status, 503);
    } finally { console.warn = quiet; }
  });
});

// --------------------------------------------------------------------------------- the proxy's same-origin rule
const API_ROOT = resolve(root, 'src/app/api');
function apiWrites(dir = API_ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) apiWrites(path, out);
    else if (/^route\.(js|ts|mjs)$/.test(name)) {
      const src = readFileSync(path, 'utf8');
      const methods = ['POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => new RegExp(`export (async )?function ${m}\\b|export const ${m}\\b|export \\{[^}]*\\b${m}\\b[^}]*\\}`).test(src));
      const pathname = `/api/${relative(API_ROOT, dirname(path)).split(sep).filter((s) => !/^\(.*\)$/.test(s)).map((s) => (/^\[.*\]$/.test(s) ? 'x1' : s)).join('/')}`;
      for (const method of methods) out.push({ pathname, method });
    }
  }
  return out;
}

test('the same-origin rule exempts only the signed unsubscribe POST, by exact path; every other API write still needs our origin', async () => {
  const { allowedWriteOrigin, SIGNED_CROSS_SITE_POSTS } = await load('src/lib/server/sameOriginWrite.js');
  assert.deepEqual(SIGNED_CROSS_SITE_POSTS, ['/api/email/unsubscribe']);
  const prod = { NODE_ENV: 'production' };
  const check = (pathname, method = 'POST', origin = 'https://mail.example') => allowedWriteOrigin({ method, pathname, origin, host: 'www.mockmob.in', env: prod });
  assert.equal(check('/api/email/unsubscribe'), true, 'a mail app\'s one-click post');
  assert.equal(check('/api/email/unsubscribe', 'post'), true);
  for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal(check('/api/email/unsubscribe', method), false, method);
  for (const near of ['/api/email/unsubscribe/', '/api/email/unsubscribe/x', '/api/email/unsubscribed', '/api/email/unsubscribe.json', '/api/email//unsubscribe', '/api/email/day-two', '/api/email', '/api/email/unsubscribe%2F']) {
    assert.equal(check(near), false, near);
  }
  const writes = apiWrites();
  assert.ok(writes.length > 50, `found ${writes.length} API writes`);
  assert.ok(writes.some((w) => w.pathname === '/api/email/unsubscribe' && w.method === 'POST'));
  for (const { pathname, method } of writes) {
    const exempt = pathname === '/api/email/unsubscribe' && method === 'POST';
    assert.equal(check(pathname, method, 'https://evil.example'), exempt, `${method} ${pathname}`);
    assert.equal(check(pathname, method, 'https://www.mockmob.in'), true, `${method} ${pathname} from our own page`);
  }
});

test('the proxy lets the signed unsubscribe POST through from a mail app\'s origin and still refuses other cross-site writes', async () => {
  const { proxy } = await load('src/proxy.js');
  const { NextRequest } = await import('next/server.js');
  const call = (path, method, origin) => proxy(new NextRequest(`https://www.mockmob.in${path}`, { method, headers: { host: 'www.mockmob.in', origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }));
  const through = await call('/api/email/unsubscribe?u=user-7&t=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'POST', 'https://mail.example');
  assert.equal(through.status, 200);
  assert.equal(through.headers.get('x-middleware-next'), '1', 'handed on to the route, which checks the signature');
  for (const [path, method] of [['/api/email/day-two', 'POST'], ['/api/me/delete', 'POST'], ['/api/email/unsubscribe', 'PUT'], ['/api/email/unsubscribe/', 'POST']]) {
    assert.equal((await call(path, method, 'https://mail.example')).status, 403, `${method} ${path}`);
  }
});

// ------------------------------------------------------------------------------------------------- account deletion
test('account deletion: the two email tables are classified, so a student who got an email can still be deleted', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { DELETION_STEPS, planDeletion, executeDeletion } = await load('src/lib/server/accountDeletion.js');
  assert.deepEqual(DELETION_STEPS.filter((s) => s.table.startsWith('email_')).map((s) => [s.table, s.action]), [['email_sends', 'delete'], ['email_optouts', 'delete']]);
  const tables = DELETION_STEPS.map((s) => s.table);
  assert.ok(tables.indexOf('email_sends') < tables.indexOf('users') && tables.indexOf('email_optouts') < tables.indexOf('users'));
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.users (id text primary key, name text not null, email text unique, username text unique,
        image text, subjects jsonb not null default '[]'::jsonb, role text not null default 'student',
        last_active_at timestamptz, credit_balance int not null default 100);`);
    await db.exec(read('supabase/migrations/20261012121000_app_preferences_and_rhythm.sql'));
    await db.exec(read('supabase/migrations/20261013120000_deletion_processor.sql'));
    await db.exec(read('supabase/migrations/20261115180000_student_emails.sql'));
    await db.exec(read('supabase/migrations/20261115180000_student_emails.sql')); // idempotent
    await db.exec(`insert into users (id, name, email) values ('u1','Asha','asha@example.com'), ('u2','Bo','bo@example.com');
      insert into email_sends (user_id, kind, sent_at) values ('u1','welcome', now()), ('u1','day2', null), ('u2','welcome', now());
      insert into email_optouts (user_id) values ('u1');
      insert into account_deletion_requests (user_id, requested_at, source) values ('u1', now() - interval '2 days', 'web');`);
    // The migration's own keys: never twice, and only the two kinds.
    await assert.rejects(db.exec("insert into email_sends (user_id, kind) values ('u2','welcome')"), /duplicate key/);
    await assert.rejects(db.exec("insert into email_sends (user_id, kind) values ('u2','weekly')"), /check constraint/);
    await assert.rejects(db.exec("insert into email_optouts (user_id) values ('nobody')"), /foreign key/);
    const adapter = {
      async listPendingRequests() { return (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where status='pending'")).rows; },
      async getUser(id) { return (await db.query('select id, email from users where id=$1', [id])).rows[0] || null; },
      async run(request, steps, apply) { return (await db.query('select public.account_deletion_run($1::bigint, $2, $3::jsonb, $4) as r', [request.id, request.user_id, JSON.stringify(steps), !!apply])).rows[0].r; },
    };
    const req = (await db.query("select id, user_id, requested_at::text requested_at, source, status from account_deletion_requests where user_id='u1'")).rows[0];
    const without = DELETION_STEPS.filter((s) => !s.table.startsWith('email_'));
    const blocked = await planDeletion({ ...adapter, run: (r, _steps, apply) => adapter.run(r, without, apply) }, req);
    assert.equal(blocked.blocked, true, 'without the two rows the deletion would be blocked');
    assert.deepEqual(blocked.unclassified.map((u) => u.table).sort(), ['email_optouts', 'email_sends']);
    const plan = await planDeletion(adapter, req);
    assert.equal(plan.blocked, false);
    assert.equal(plan.steps.find((s) => s.table === 'email_sends').rows, 2);
    await executeDeletion({ adapter, request: req, plan, deleteAuthUser: async () => ({ deleted: true, ids: [] }) });
    const n = async (sql) => Number((await db.query(sql)).rows[0].n);
    assert.equal(await n("select count(*) n from email_sends where user_id='u1'"), 0);
    assert.equal(await n("select count(*) n from email_optouts where user_id='u1'"), 0);
    assert.equal(await n("select count(*) n from email_sends where user_id='u2'"), 1, 'another student is untouched');
  } finally { await db.close(); }
});

test('unsubscribe: without a server secret no link verifies', async () => {
  const { GET } = await load('src/app/api/email/unsubscribe/route.js');
  await withEnv({ NEXTAUTH_SECRET: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    globalThis.__mmEmailTest = { optOut: async () => assert.fail('written') };
    const res = await GET(new Request(unsubscribeUrl('https://www.mockmob.in', 'user-7', 'any')));
    assert.equal(res.status, 400);
  });
});

// ------------------------------------------------------------------------------------------------------------ the cron
test('the day-2 cron route answers only Vercel cron (Bearer CRON_SECRET) or the internal secret', async () => {
  const { GET, POST } = await load('src/app/api/email/day-two/route.js');
  await withEnv({ CRON_SECRET: 'cron-123', INTERNAL_API_SECRET: 'internal-456' }, async () => {
    let runs = 0;
    globalThis.__mmEmailTest = { run: async () => { runs += 1; return { enabled: false, sent: 0 }; } };
    assert.equal((await GET(new Request('https://www.mockmob.in/api/email/day-two'))).status, 403);
    assert.equal((await GET(new Request('https://www.mockmob.in/api/email/day-two', { headers: { authorization: 'Bearer wrong' } }))).status, 403);
    assert.equal(runs, 0);
    const ok = await GET(new Request('https://www.mockmob.in/api/email/day-two', { headers: { authorization: 'Bearer cron-123' } }));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { enabled: false, sent: 0 });
    assert.equal((await POST(new Request('https://www.mockmob.in/api/email/day-two', { method: 'POST', headers: { 'x-internal-secret': 'internal-456' } }))).status, 200);
    assert.equal(runs, 2);
    globalThis.__mmEmailTest = { run: async () => { throw new Error('boom'); } };
    assert.equal((await GET(new Request('https://www.mockmob.in/api/email/day-two', { headers: { authorization: 'Bearer cron-123' } }))).status, 503);
  });
  await withEnv({ CRON_SECRET: undefined, INTERNAL_API_SECRET: undefined }, async () => {
    globalThis.__mmEmailTest = { run: async () => assert.fail('ran') };
    assert.equal((await GET(new Request('https://www.mockmob.in/api/email/day-two', { headers: { authorization: 'Bearer ' } }))).status, 403, 'unset secrets keep it closed');
  });
  const config = JSON.parse(read('vercel.json'));
  assert.ok(config.crons.some((c) => c.path === '/api/email/day-two' && c.schedule === '30 12 * * *'));
  assert.match(read('src/app/api/email/day-two/route.js'), /export const maxDuration = 60;/);
});

// ------------------------------------------------------------------------------------------------- the line in sign-in
test('the welcome hook: off unless EMAILS_ENABLED is "true"; never waits, never throws; the email module loads only later', async () => {
  const { scheduleWelcomeEmail } = await load('src/lib/email/welcome.js');
  const scheduled = [];
  const schedule = (task) => scheduled.push(task);
  const sends = [];
  const loader = () => Promise.resolve({ sendWelcomeEmail: async (user) => { sends.push(user); return { sent: true }; } });
  for (const value of [undefined, '', 'TRUE', '1', 'false']) {
    assert.equal(scheduleWelcomeEmail({ id: 'u1', email: 'a@b.in' }, { env: { EMAILS_ENABLED: value }, schedule, load: () => assert.fail('loaded') }), false);
  }
  assert.equal(scheduled.length, 0);
  const on = { EMAILS_ENABLED: 'true' };
  assert.equal(scheduleWelcomeEmail({ id: 'u1', email: '' }, { env: on, schedule, load: loader }), false);
  assert.equal(scheduleWelcomeEmail({ id: 'u1', email: ' Asha@Example.com ' }, { env: on, schedule, load: loader }), true);
  assert.equal(scheduled.length, 1);
  assert.equal(sends.length, 0, 'nothing is sent before the response');
  await scheduled[0]();
  assert.deepEqual(sends, [{ id: 'u1', email: 'asha@example.com' }]);
  // after() refused (outside a request): the task still runs, detached.
  assert.equal(scheduleWelcomeEmail({ id: 'u2', email: 'b@b.in' }, { env: on, schedule: () => { throw new Error('outside a request'); }, load: loader }), true);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(sends.at(-1), { id: 'u2', email: 'b@b.in' });
  // A module that fails to load or a send that throws never reaches the caller.
  const quiet = console.warn;
  console.warn = () => {};
  try {
    assert.equal(scheduleWelcomeEmail({ id: 'u3', email: 'c@b.in' }, { env: on, schedule, load: () => Promise.reject(new Error('no module')) }), true);
    await scheduled.at(-1)();
    assert.equal(scheduleWelcomeEmail({ id: 'u4', email: 'd@b.in' }, { env: on, schedule, load: () => Promise.resolve({ sendWelcomeEmail: async () => { throw new Error('boom'); } }) }), true);
    await scheduled.at(-1)();
  } finally { console.warn = quiet; }
  assert.equal(scheduleWelcomeEmail(null, { env: on, schedule, load: loader }), false);
  // Sign-in's static imports grow by this one file, which imports nothing but next/server.
  const imports = [...read('src/lib/email/welcome.js').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ['next/server']);
});

test('auth.ts: the welcome is scheduled once, inside onCreated (a new account row), before the funnel count, and not awaited', () => {
  const src = read('src/lib/auth.ts');
  assert.match(src, /^import \{ scheduleWelcomeEmail \} from '@\/lib\/email\/welcome';$/m);
  assert.equal((src.match(/scheduleWelcomeEmail\(/g) || []).length, 1);
  assert.match(src, /onCreated: async \(\) => \{\n\s+scheduleWelcomeEmail\(\{ id: supabaseUser\.id, email: supabaseUser\.email \}\);\n\s+let requestHeaders/);
  assert.doesNotMatch(src, /await scheduleWelcomeEmail/);
  assert.match(src, /await countSignup\(requestHeaders\);/, 'the funnel count is unchanged');
});

// --------------------------------------------------------------------------------- the sign-in ceiling the emails read
test('the sign-in ceiling bucket the emails read is the one the sign-in route counts in', async () => {
  const { checkPersistentRateLimit } = await load('src/lib/server/rateLimit.js');
  const { emailLimitOptions, emailLoginSiteLimit } = await load('src/lib/server/emailLoginPolicy.js');
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', AUTH_EMAIL_DAILY_CEILING: '300' }]) {
    await withEnv({ NODE_ENV: 'production', PERSISTENT_LIMITS_ENABLED: undefined }, async () => {
      const buckets = [];
      globalThis.__mmEmailTest = { admin: () => ({ rpc: async (name, args) => { buckets.push([name, args.p_bucket]); return { data: true, error: null }; } }) };
      const request = new Request('https://www.mockmob.in/api/auth/email-login', { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' } });
      await checkPersistentRateLimit(request, emailLimitOptions(emailLoginSiteLimit(env), 'asha@example.com', env));
      assert.deepEqual(buckets, [['take_rate_limit', signInCeilingBucket(env)]]);
    });
  }
});

// -------------------------------------------------------------------------------------------------------------- preview
test('the email preview is development only and sends nothing', async () => {
  const { GET, POST } = await load('src/app/preview/email/route.js');
  await withEnv({ NODE_ENV: 'production' }, async () => {
    assert.equal((await GET(new Request('http://127.0.0.1:3586/preview/email?kind=welcome'))).status, 404);
    assert.equal((await POST(new Request('http://127.0.0.1:3586/preview/email', { method: 'POST' }))).status, 404);
  });
  await withEnv({ NODE_ENV: 'development' }, async () => {
    const res = await GET(new Request('http://127.0.0.1:3586/preview/email?kind=day2&state=repair&n=4&subject=accountancy&theme=dark'));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /4 questions left to fix/);
    assert.match(html, /@media all/, 'the dark version is forced');
    const text = await (await GET(new Request('http://127.0.0.1:3586/preview/email?kind=welcome&part=text'))).text();
    assert.match(text, /^Subject: Welcome to MockMob\n/);
    assert.match(await (await GET(new Request('http://127.0.0.1:3586/preview/email'))).text(), /Student emails/);
    assert.match(await (await GET(new Request('http://127.0.0.1:3586/preview/email?kind=unsubscribe'))).text(), /<form method="post" action="\/preview\/email\?kind=unsubscribe&amp;state=done"/);
    assert.match(await (await POST(new Request('http://127.0.0.1:3586/preview/email', { method: 'POST' }))).text(), /These emails are off/);
  });
  assert.doesNotMatch(read('src/app/preview/email/route.js'), /resend|supabase|studentMailServer/, 'no sender or database in the preview');
});
