// The welcome and day-2 emails, their routes and the one line in sign-in (15 Nov 2026). The rules themselves are proved in
// src/lib/email/studentMail.test.mjs; this file runs the real route handlers and the welcome hook against stubs, and checks
// the wiring in src/lib/auth.ts. Nothing here sends, signs in or reaches a database.
//   node --test data/tests/student_emails_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve, dirname } from 'node:path';
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
test('unsubscribe: the signed link turns the emails off and says so; a bad signature changes nothing', async () => {
  const { GET, POST } = await load('src/app/api/email/unsubscribe/route.js');
  await withEnv({ NEXTAUTH_SECRET: 'route-secret', EMAILS_ENABLED: undefined, NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.mockmob.in' }, async () => {
    const off = [];
    globalThis.__mmEmailTest = { optOut: async (id) => { off.push(id); return true; } };
    const url = unsubscribeUrl('https://www.mockmob.in', 'user-7', 'route-secret');
    const ok = await GET(new Request(url));
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /text\/html/);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.match(await ok.text(), /These emails are off[\s\S]*Sign-in codes still come when you ask for one\./);
    assert.deepEqual(off, ['user-7'], 'works while the emails are switched off too');

    const forged = new URL(url);
    forged.searchParams.set('u', 'user-8');
    const bad = await GET(new Request(forged));
    assert.equal(bad.status, 400);
    assert.match(await bad.text(), /This link did not work/);
    const empty = await GET(new Request('https://www.mockmob.in/api/email/unsubscribe'));
    assert.equal(empty.status, 400);
    assert.deepEqual(off, ['user-7'], 'nothing written for a forged or empty link');

    // RFC 8058: the mail app posts List-Unsubscribe=One-Click to the same address.
    const oneClick = await POST(new Request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }));
    assert.equal(oneClick.status, 200);
    assert.deepEqual(await oneClick.json(), { ok: true });
    assert.deepEqual(off, ['user-7', 'user-7']);

    globalThis.__mmEmailTest = { optOut: async () => { throw new Error('db down'); } };
    const down = await GET(new Request(url));
    assert.equal(down.status, 503);
    const page = await down.text();
    assert.match(page, /We could not turn these emails off just now/);
    assert.ok(page.includes(`href="${url.replace(/&/g, '&amp;')}"`), 'Try again opens the same signed link');
  });
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
  const { GET } = await load('src/app/preview/email/route.js');
  await withEnv({ NODE_ENV: 'production' }, async () => {
    assert.equal((await GET(new Request('http://127.0.0.1:3586/preview/email?kind=welcome'))).status, 404);
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
  });
  assert.doesNotMatch(read('src/app/preview/email/route.js'), /resend|supabase|studentMailServer/, 'no sender or database in the preview');
});
