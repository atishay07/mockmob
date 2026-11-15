// W3-A, F8 (15 Nov 2026): the sign-in email puts the code first and in the subject, the button second, and never calls a new
// account's code a "login". The real route runs against in-memory fakes (the same hooks as auth_security.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STUBS = {
  'server-only': 'export {};',
  '@/lib/supabase': 'export const supabaseAdmin = () => globalThis.__mmMailTest.admin();',
  '@/lib/resend': 'export const resend = { emails: { send: (m) => globalThis.__mmMailTest.send(m) } };',
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

const ENV_KEYS = ['NODE_ENV', 'NEXT_PUBLIC_SITE_URL', 'RESEND_API_KEY', 'PERSISTENT_LIMITS_ENABLED', 'MOCKMOB_STAGING_APP', 'AUTH_EMAIL_FROM'];
let fresh = 0;

async function sendOne({ verificationType = 'magiclink', client, email = 'asha@example.com' } = {}) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const sent = [];
  process.env.NODE_ENV = 'production';
  process.env.RESEND_API_KEY = 're_test_key_123';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.mockmob.in';
  delete process.env.PERSISTENT_LIMITS_ENABLED;
  delete process.env.MOCKMOB_STAGING_APP;
  delete process.env.AUTH_EMAIL_FROM;
  globalThis.__mmMailTest = {
    admin: () => ({
      rpc: async () => ({ data: 0, error: null }),
      auth: { admin: { generateLink: async () => ({ data: { properties: { email_otp: '48213907', hashed_token: 'hash_abc', verification_type: verificationType } }, error: null }) } },
    }),
    send: async (message) => { sent.push(message); return {}; },
  };
  try {
    fresh += 1;
    const { POST } = await import(`${pathToFileURL(resolve(root, 'src/app/api/auth/email-login/route.js')).href}?mail=${fresh}`);
    const res = await POST(new Request('https://www.mockmob.in/api/auth/email-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${fresh}` },
      body: JSON.stringify({ email, ...(client ? { client } : {}) }),
    }));
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    return sent[0];
  } finally {
    delete globalThis.__mmMailTest;
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

const visible = (html) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('F8: the subject carries the code, so it can be read from the notification; sender unchanged', async () => {
  const mail = await sendOne();
  assert.equal(mail.subject, 'Your MockMob code: 48213907');
  assert.equal(mail.from, 'MockMob <support@mockmob.in>');
  assert.equal(mail.to, 'asha@example.com');
});

test('F8: the code comes first and largest, the button second as "Signing in on this phone?"', async () => {
  const { html } = await sendOne();
  const code = html.indexOf('>48213907<');
  const second = html.indexOf('Signing in on this phone?');
  const button = html.indexOf('>Tap here to sign in</a>');
  assert.ok(code > 0 && second > code && button > second, 'code, then the question, then the button');
  const codeSize = Number(html.slice(0, code).match(/font-size:(\d+)px[^"]*"?[^>]*$/)?.[1]);
  const sizes = [...html.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
  assert.equal(codeSize, Math.max(...sizes), 'nothing in the email is larger than the code');
  assert.match(html, /href="https:\/\/www\.mockmob\.in\/auth\/callback\?token_hash=hash_abc&amp;type=magiclink"/);
  assert.match(html, /This code is one-time use\. If you did not request it, you can ignore this email\./, 'the footer stays');
});

test('F8: a new account is never told it is a "login"; an existing one keeps its login code', async () => {
  const fresh = await sendOne({ verificationType: 'signup' });
  assert.doesNotMatch(fresh.subject + visible(fresh.html) + fresh.text, /log ?in/i);
  assert.match(visible(fresh.html), /Your 8-digit sign-up code/);
  const back = await sendOne({ verificationType: 'magiclink' });
  assert.match(visible(back.html), /Your 8-digit login code/);
  assert.match(back.html, /type=magiclink/);
});

test('F8: plain light HTML that survives dark mode: black on white inline, a dark version only by media query', async () => {
  const { html } = await sendOne();
  assert.match(html, /<meta name="color-scheme" content="light dark" \/>/);
  assert.match(html, /<body class="em-page" style="margin:0;padding:0;background:#ffffff;">/);
  assert.match(html, /class="em-code" style="[^"]*color:#111311;/);
  assert.match(html, /@media \(prefers-color-scheme: dark\) \{[\s\S]*\.em-code \{ color:#ffffff !important; \}/);
  assert.doesNotMatch(html, /rgba\(|gradient|<img/i, 'no translucent colours, gradients or images for a client to mangle');
  assert.doesNotMatch(visible(html), /[!→]/);
});

test('F8: a plain-text part says the same, with the link spelled out', async () => {
  const { text } = await sendOne();
  assert.match(text, /^Your 8-digit login code: 48213907\nType it on the page where you asked for it\./, 'the code is the first line');
  assert.match(text, /Signing in on this phone\? Open this link:\nhttps:\/\/www\.mockmob\.in\/auth\/callback\?token_hash=hash_abc&type=magiclink\n/);
  assert.match(text, /Using the MockMob app\? Type this code in the app\. The link opens the website\./, 'text has a link, not a button');
  assert.doesNotMatch(text, /button/);
  assert.doesNotMatch(text, /<|&amp;/);
});

test('F8: the app keeps its own hint and its /app/login link', async () => {
  const { html, text } = await sendOne({ client: 'app' });
  assert.match(html, /href="https:\/\/www\.mockmob\.in\/app\/login\?token_hash=hash_abc&amp;type=magiclink"/);
  assert.match(html, /Tap the button on this phone to open the MockMob app, or type the code in the app\./);
  assert.match(text, /Open the link on this phone to open the MockMob app, or type the code in the app\./);
  assert.doesNotMatch(html, /The button opens the website\./);
});
