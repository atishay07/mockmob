// P11 (production pass, 15 Nov 2026): the privacy page says what the code does. Its cookie names and lifetimes come from the
// code's own constants, and the AI services it names are exactly the ones the code can call (src/services/ai/providers.js
// builds an OpenAI and an Anthropic client and nothing else; AGENTS.md: only gpt-6-luna and claude-haiku-5-5 may run).
//   node --test data/tests/privacy_facts_1115.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const load = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const PAGE = read('src/app/privacy/page.js');
// The words a reader sees: JSX comments out, apostrophe entities back.
const WORDS = PAGE.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/&apos;/g, '’');
const section = (title) => {
  const at = WORDS.indexOf(`<h2>${title}</h2>`);
  assert.ok(at >= 0, `section "${title}"`);
  return WORDS.slice(at, WORDS.indexOf('</section>', at));
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|mjs|jsx)$/.test(name) && !/\.test\./.test(name)) out.push(path);
  }
  return out;
}

test('the AI services the page names are exactly the ones the code can call', () => {
  const sdk = /from ['"](openai|@anthropic-ai\/sdk|@google\/generative-ai|groq-sdk|@mistralai\/[^'"]+|cohere-ai|together-ai)['"]/g;
  const used = new Set();
  for (const file of walk(join(ROOT, 'src'))) for (const [, pkg] of readFileSync(file, 'utf8').matchAll(sdk)) used.add(`${pkg} in ${relative(ROOT, file).replace(/\\/g, '/')}`);
  assert.deepEqual([...used].sort(), ['@anthropic-ai/sdk in src/services/ai/providers.js', 'openai in src/services/ai/providers.js']);
  const providers = read('src/services/ai/providers.js');
  assert.match(providers, /if \(provider === 'openai'\) return getOpenAIClient\(\);/);
  assert.match(providers, /if \(provider === 'anthropic'\) return getAnthropicClient\(\);/);
  const ai = section('Ask Mobi and AI services');
  assert.match(ai, /OpenAI or Anthropic/);
  const processors = section('Companies that process data for MockMob');
  assert.match(processors, /<b>OpenAI<\/b> and <b>Anthropic<\/b>/);
  assert.doesNotMatch(WORDS, /Gemini|DeepSeek|Kimi|Groq|Mistral/, 'no AI service the code does not call');
});

test('the processors the page lists are the services the code uses', () => {
  const processors = section('Companies that process data for MockMob');
  for (const name of ['Supabase', 'Vercel', 'Razorpay', 'Resend', 'OpenAI', 'Anthropic', 'Google']) assert.match(processors, new RegExp(`<b>${name}</b>`), name);
  // Each is there in the code: the database and sign-in, the login email, the website checkout, Google sign-in and Play.
  assert.match(read('package.json'), /"@supabase\/ssr"/);
  assert.match(read('package.json'), /"resend"/);
  assert.match(read('package.json'), /"razorpay"/);
  assert.match(read('vercel.json'), /"regions"/);
  assert.match(read('src/components/billing/RazorpayPaymentButton.jsx'), /prefill: \{ name: shownName\(user\.name, user\.email\) \|\| '', email: user\.email \|\| '' \}/, 'Razorpay gets the name and email the page says');
});

test('the cookies the page names are the code\'s cookies, with the code\'s lifetimes', async () => {
  const invite = await load('src/lib/referrals/friendInvite.mjs');
  const guest = await load('src/lib/server/guestMobi.js');
  const DAY = 24 * 60 * 60;
  const cookies = section('Cookies and your browser’s storage');
  assert.equal(guest.COOKIE_NAME, 'mm_gm');
  assert.equal(guest.COOKIE_MAX_AGE_S, 30 * DAY);
  assert.match(cookies, /a cookie called mm_gm\. It holds a random visitor id and how many questions you have asked, is sent only to Ask Mobi, and ends after 30 days\./);
  assert.match(guest.visitorCookieHeader({ id: 'x', count: 0, issuedAt: 0 }, 's', { now: 0 }), /Path=\/api\/mobi\/guest; Max-Age=2592000; HttpOnly/);
  assert.equal(invite.INVITE_COOKIE, 'mm_invite');
  assert.equal(invite.INVITE_COOKIE_MAX_AGE, 30 * DAY);
  assert.equal(invite.DEVICE_COOKIE, 'mm_dev');
  assert.equal(invite.DEVICE_COOKIE_MAX_AGE, 400 * DAY);
  assert.match(cookies, /mm_invite that remembers the invite for 30 days/);
  assert.match(cookies, /mm_dev that holds a random device id for up to 400 days/);
  const proxy = read('src/lib/server/sessionProxy.js');
  assert.match(proxy, /const REF_COOKIE = 'mm_ref';\nconst REF_COOKIE_MAX_AGE = 60 \* 60 \* 24 \* 30;/);
  assert.match(cookies, /mm_ref keeps that code for 30 days/);
  // Theme and Reduce motion live in the browser's storage (the layout's first script).
  assert.match(read('src/app/layout.js'), /localStorage\.getItem\('mm:theme:v1'\)[\s\S]*localStorage\.getItem\('mm:motion:v1'\)/);
  assert.match(cookies, /Day or Night theme and your Reduce motion choice are kept in your browser’s own storage/);
});

test('the abuse checks the page describes are the code\'s: keyed hashes for referrals, a hashed network for guest Ask Mobi', async () => {
  const guest = await load('src/lib/server/guestMobi.js');
  const abuse = section('Stopping abuse');
  const referrals = read('src/lib/server/referrals.js');
  assert.match(referrals, /createHmac\('sha256', secret\)/, 'keyed hashes');
  assert.match(referrals, /p_device_hash: hashFor\('device', deviceId, env\),\s*p_ip_hash: hashFor\('network', network, env\),/);
  assert.match(abuse, /a keyed hash of the device id and a keyed hash of your network address/);
  assert.match(read('src/lib/server/rateLimit.js'), /const persistentBucket = \(request, options\) => createHash\('sha256'\)/, 'the limiter keeps a hash');
  assert.equal(guest.GUEST_QUESTIONS, 3);
  assert.equal(guest.NETWORK_LIMIT, 12);
  assert.match(abuse, /to 3 questions for each visitor and 12 a day for each network\./);
  // A guest's question goes to the model without an account: no record context.
  assert.match(read('src/app/api/mobi/guest/route.js'), /provider: 'openai', model: LUNA_MODEL, systemPrompt, userMessage, context: null,/);
});

test('house style on the new sections: no exclamation marks, arrows or dashes, and no legal facts the owner has not given', () => {
  for (const title of ['Cookies and your browser’s storage', 'Stopping abuse', 'Ask Mobi and AI services', 'Companies that process data for MockMob']) {
    assert.doesNotMatch(section(title), /!|→|->|[–—]/, title);
  }
  assert.doesNotMatch(WORDS, /grievance officer|Pvt\.? Ltd|Private Limited|LLP|registered office/i, 'no invented entity, address or officer');
});
