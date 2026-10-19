// 20 Oct: Account > Password on the website (a student who signed up with an email code adds a password). The rules, the
// server update against a fake Supabase, the route's checks and the page's honest states.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PASSWORD_COPY, PASSWORD_PROBLEMS, checkPassword, passwordProblem } from '../../src/lib/passwordRules.mjs';
import { PASSWORD_STATUS, passwordFailureFrom, setAccountPassword } from '../../src/lib/server/passwordSet.js';

const root = resolve(import.meta.dirname, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('rule matches the app: 8 characters at least, 72 bytes at most, never all spaces', () => {
  assert.equal(checkPassword('1234567').ok, false);
  assert.equal(checkPassword('1234567').code, 'too_short');
  assert.equal(checkPassword('12345678').ok, true);
  assert.equal(checkPassword('        ').code, 'too_short', 'eight spaces is not a password');
  assert.equal(checkPassword('a'.repeat(72)).ok, true);
  assert.equal(checkPassword('a'.repeat(73)).code, 'too_long');
  assert.equal(checkPassword('न'.repeat(25)).code, 'too_long', 'a Hindi letter is 3 bytes: 25 of them pass 72 bytes');
  assert.equal(checkPassword(undefined).code, 'invalid');
  assert.equal(checkPassword(12345678).code, 'invalid');
});

test('words: every problem has a plain line; no "!", no em dash, no middle dot, no emoji; none quotes a password', () => {
  for (const [code, line] of Object.entries(PASSWORD_PROBLEMS)) {
    assert.ok(line.length > 20, code);
    assert.doesNotMatch(line, /[!—·]/, code);
    assert.doesNotMatch(line, /\p{Extended_Pictographic}/u, code);
  }
  assert.equal(passwordProblem('nope'), PASSWORD_PROBLEMS.unknown);
  for (const text of [PASSWORD_COPY.lead, PASSWORD_COPY.idle, PASSWORD_COPY.savedFor('a@b.in'), PASSWORD_COPY.savedFor('')]) {
    assert.doesNotMatch(text, /[!—·]/);
  }
  assert.match(PASSWORD_COPY.savedFor('a@b.in'), /a@b\.in/);
  assert.match(PASSWORD_COPY.lead, /website still uses an email code or Google/, 'honest: the website has no password sign-in');
});

test('Supabase errors map to the app\'s failures (only code, name and status are read)', () => {
  const f = passwordFailureFrom;
  assert.equal(f({ code: 'weak_password', status: 422 }), 'weak_password');
  assert.equal(f({ name: 'AuthWeakPasswordError' }), 'weak_password');
  assert.equal(f({ code: 'same_password', status: 422 }), 'same_password');
  assert.equal(f({ code: 'reauthentication_needed', status: 401 }), 'reauth_required', 'reauth wins over the generic 401');
  assert.equal(f({ code: 'reauthentication_not_valid' }), 'reauth_required');
  assert.equal(f({ name: 'AuthSessionMissingError', status: 400 }), 'signed_out');
  assert.equal(f({ code: 'session_not_found' }), 'signed_out');
  assert.equal(f({ status: 401 }), 'signed_out');
  assert.equal(f({ status: 429 }), 'rate_limited');
  assert.equal(f({ code: 'over_request_rate_limit' }), 'rate_limited');
  assert.equal(f({ name: 'AuthRetryableFetchError', status: 0 }), 'unavailable');
  assert.equal(f({ status: 503 }), 'unavailable');
  assert.equal(f({ status: 400, code: 'something_else', message: 'hunter2 is bad' }), 'unknown');
  assert.equal(f(null), 'unknown');
  for (const code of new Set(['too_short', 'too_long', 'invalid', 'weak_password', 'same_password', 'reauth_required', 'signed_out', 'rate_limited', 'unavailable', 'unknown'])) {
    assert.ok(PASSWORD_STATUS[code], `a status for ${code}`);
    assert.ok(PASSWORD_PROBLEMS[code], `words for ${code}`);
  }
});

// A fake @supabase/ssr: records the updateUser call and can hand back new cookies.
function fakeServer({ result = { error: null }, throws = null, newCookies = null } = {}) {
  const calls = { update: [], clientOptions: null };
  const createServerClient = (url, key, options) => {
    calls.clientOptions = options;
    return {
      auth: {
        updateUser: async (attrs) => {
          calls.update.push(attrs);
          if (throws) throw throws;
          if (newCookies) options.cookies.setAll(newCookies);
          return { data: {}, ...result };
        },
      },
    };
  };
  const written = [];
  const cookieStore = { getAll: () => [{ name: 'sb-x-auth-token', value: 'tok', extra: 1 }], set: (...a) => written.push(a) };
  return { calls, written, args: { createServerClient, cookieStore, supabaseUrl: 'https://x.supabase.co', supabaseKey: 'anon' } };
}

test('server update: a good password goes to updateUser once, with the student\'s own cookies, and nothing else', async () => {
  const fake = fakeServer({ newCookies: [{ name: 'sb-x-auth-token', value: 'fresh', options: { path: '/' } }] });
  const out = await setAccountPassword({ password: 'correct horse 9', ...fake.args });
  assert.deepEqual(out, { ok: true });
  assert.deepEqual(fake.calls.update, [{ password: 'correct horse 9' }]);
  assert.deepEqual(fake.calls.clientOptions.cookies.getAll(), [{ name: 'sb-x-auth-token', value: 'tok' }], 'only name and value are handed over');
  assert.deepEqual(fake.written, [['sb-x-auth-token', 'fresh', { path: '/' }]], 'new tokens are written back');
});

test('server update: a short or oversize password never reaches Supabase', async () => {
  for (const password of ['short', '', 'x'.repeat(80), null, undefined, 12345678]) {
    const fake = fakeServer();
    const out = await setAccountPassword({ password, ...fake.args });
    assert.equal(out.ok, false);
    assert.equal(fake.calls.update.length, 0);
  }
});

test('server update: no session, a weak or reused password, reauth and an outage each get their own answer', async () => {
  const cases = [
    [{ error: { name: 'AuthSessionMissingError', status: 400 } }, 'signed_out'],
    [{ error: { code: 'weak_password', status: 422 } }, 'weak_password'],
    [{ error: { code: 'same_password', status: 422 } }, 'same_password'],
    [{ error: { code: 'reauthentication_needed', status: 401 } }, 'reauth_required'],
    [{ error: { status: 429 } }, 'rate_limited'],
    [{ error: { name: 'AuthRetryableFetchError', status: 502 } }, 'unavailable'],
  ];
  for (const [result, code] of cases) {
    const fake = fakeServer({ result });
    const out = await setAccountPassword({ password: 'correct horse 9', ...fake.args });
    assert.equal(out.ok, false);
    assert.equal(out.code, code);
  }
  const thrown = fakeServer({ throws: Object.assign(new Error('fetch failed'), { name: 'TypeError' }) });
  assert.equal((await setAccountPassword({ password: 'correct horse 9', ...thrown.args })).code, 'unavailable');
});

test('server update: a failed update never deletes the cookies on a temporary failure, and the result carries no password', async () => {
  const fake = fakeServer({ result: { error: { name: 'AuthRetryableFetchError', status: 503 } }, newCookies: [{ name: 'sb-x-auth-token', value: '', options: { maxAge: 0 } }] });
  const out = await setAccountPassword({ password: 'correct horse 9', ...fake.args });
  assert.equal(out.ok, false);
  assert.deepEqual(fake.written, [], 'a removal after a transient failure is dropped (the student stays signed in)');
  assert.doesNotMatch(JSON.stringify(out), /correct horse/);
});

test('route: session first, then the rate limit, then the rule; bearer and cross-site refused; the password is never logged', () => {
  const route = read('src/app/api/me/password/route.js');
  const auth = route.indexOf('authWithStatus(request)');
  const limit = route.indexOf('checkPersistentRateLimit(');
  const rule = route.indexOf('checkPassword(body');
  const set = route.indexOf('setAccountPassword({');
  assert.ok(auth > 0 && auth < limit && limit < rule && rule < set, 'order: session, limit, rule, update');
  assert.match(route, /keyParts: \[session\.user\.id\]/, 'limited per account');
  assert.match(route, /request\.headers\.get\('authorization'\)/, 'a bearer token is refused: this changes the browser session account');
  assert.match(route, /sameOrigin\(request\)/);
  assert.match(route, /includes\('application\/json'\)/);
  assert.match(route, /'Cache-Control': 'no-store'/);
  assert.match(route, /rateLimitHeaders\(limit\)/, 'a refused try carries Retry-After');
  // The one log line prints a code and a status, never the body or the password.
  const logs = route.split(/\r?\n/).filter((l) => /console\./.test(l));
  assert.equal(logs.length, 1);
  assert.match(logs[0], /result\.code.*result\.errorCode.*result\.status/);
  assert.doesNotMatch(logs[0], /body|password|request/);
  assert.doesNotMatch(read('src/lib/server/passwordSet.js'), /console\./, 'the server module never logs');
});

test('page: Password sits on the account page with its own anchor; one field, Show, the rule, Save password', () => {
  const page = read('src/app/(app)/profile/ProfilePageClient.jsx');
  assert.match(page, /<SetPasswordCard email=\{user\?\.email \|\| ''\} \/>/);
  const card = read('src/components/profile/SetPasswordCard.jsx');
  assert.match(card, /id="password"/);
  assert.match(card, /autoComplete="new-password"/);
  assert.match(card, /autoComplete="username"/, 'the password manager files it under the email');
  assert.match(card, /type=\{shown \? 'text' : 'password'\}/);
  assert.match(card, /aria-pressed=\{shown\}/);
  assert.match(card, /'\/api\/me\/password'/);
});

test('page: saved appears only after the server says yes; the field is cleared; a failure shows its own line', () => {
  const card = read('src/components/profile/SetPasswordCard.jsx');
  const post = card.indexOf('await postPassword(password)');
  const saved = card.indexOf('setSaved(true)');
  assert.ok(post > 0 && saved > post, 'setSaved(true) comes after the awaited request');
  assert.match(card, /if \(result\.ok\) \{\s*setPassword\(''\)/, 'the typed password is cleared on success');
  assert.match(card, /setProblem\(passwordProblem\(result\.code\)\)/);
  assert.match(card, /return \{ ok: false, code: 'offline' \}/, 'a network failure says it cannot tell if it saved');
  assert.match(card, /busyRef\.current/, 'no double submit');
  assert.doesNotMatch(card, /localStorage|sessionStorage|console\./, 'the page never stores or logs the password');
  assert.match(card, /disabled=\{busy \|\| !password\}/);
});

test('phone order: Password follows Your name and email', () => {
  const css = read('src/components/profile/account.css');
  assert.match(css, /#name \{ order: 7; \}/);
  assert.match(css, /#password \{ order: 8; \}/);
  assert.match(css, /#appearance \{ order: 9; \}/);
});
