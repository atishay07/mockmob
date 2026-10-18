// Google Play in-app purchases, server side (owner decision 18 Oct 2026). No network, no real Google, no real database:
// Google is a fake with the androidpublisher response shapes, the store is an in-memory fake for the logic tests and an
// in-process Postgres (PGlite) running the real migrations for the grant and revoke functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, createVerify, createSign } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PLAY_PRODUCTS, getPlayProduct, PLAY_GAPS } from '../../src/lib/payments/playProducts.js';
import { PAYMENT_PLANS } from '../../src/lib/payments/plans.js';
import { CREDIT_PACKS, LEGACY_AI_PACKS } from '../../src/services/credits/creditPacks.mjs';
import {
  createPlayClient, parseServiceAccount, signServiceAccountJwt, PlayApiError, PLAY_SCOPE, PLAY_API_BASE, DEFAULT_TOKEN_URI, b64url,
} from '../../src/lib/payments/playGoogle.js';
import {
  verifyPlayPurchase, handlePlayNotification, decodePubSubMessage, playAccountHash, playBillingEnabled,
} from '../../src/lib/payments/playBilling.js';
import { verifyPubSubOidc, authenticatePush, createCertSource } from '../../src/lib/payments/playRtdn.js';
import { handlePlayVerify, handlePlayRtdn } from '../../src/lib/server/playBillingHttp.js';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const MIGRATION = file('supabase/migrations/20261018190000_play_purchases.sql');
const UNDO = file('supabase/undo/20261018190000_play_purchases.undo.sql');
const GRANT_MIGRATION = file('supabase/migrations/0038_ai_credit_purchase_grant_rpc.sql');
const quiet = () => {};

// ---- test keys: generated here, never a real secret ------------------------------------------------------------------
const { privateKey: SA_PRIVATE, publicKey: SA_PUBLIC } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SA_PEM = SA_PRIVATE.export({ type: 'pkcs8', format: 'pem' });
const SERVICE_ACCOUNT = { type: 'service_account', client_email: 'play-billing@mockmob-test.iam.gserviceaccount.com', private_key: SA_PEM, token_uri: DEFAULT_TOKEN_URI };

// ---- the products ---------------------------------------------------------------------------------------------------
test('the product map: web ids, server-decided grants, no price anywhere', () => {
  assert.deepEqual(Object.keys(PLAY_PRODUCTS), ['pro_cuet_2027', 'credits_10_50', 'credits_29_150', 'credits_49_300', 'ai_credits_prepos_10_50', 'ai_credits_prepos_20_150', 'ai_credits_prepos_50_400']);
  const pro = getPlayProduct('pro_cuet_2027');
  assert.equal(pro.kind, 'pro');
  assert.equal(pro.finish, 'acknowledge', 'Pro is acknowledged, never consumed');
  assert.equal(pro.accessUntil, PAYMENT_PLANS.pro_cuet_2027.accessUntil, 'the same date the web grants');
  assert.equal(pro.accessUntil, '2027-07-31T18:29:59.999Z', 'Pro until 31 July 2027 India time');
  for (const [id, credits] of [['credits_10_50', 50], ['credits_29_150', 150], ['credits_49_300', 300], ['ai_credits_prepos_10_50', 50], ['ai_credits_prepos_20_150', 150], ['ai_credits_prepos_50_400', 400]]) {
    assert.equal(getPlayProduct(id).finish, 'consume');
    assert.equal(getPlayProduct(id).kind, 'ai_credits', `${id}: ONE credits balance, granted as bonus credits through the AI purchase path`);
    assert.equal(getPlayProduct(id).credits, credits);
  }
  assert.equal(getPlayProduct('practice_credits_19_100'), null, 'no separate practice products');
  assert.equal(getPlayProduct('practice_credits_49_300'), null);
  assert.equal(getPlayProduct('ai_credits_prepos_10_50').legacy, true);
  assert.equal(getPlayProduct('credits_10_50').legacy, undefined);
  for (const p of Object.values(PLAY_PRODUCTS)) {
    assert.deepEqual(Object.keys(p).filter((k) => /price|amount|rupee|paise|inr/i.test(k)), [], `${p.productId} carries no price`);
  }
  assert.equal(getPlayProduct('pro_monthly_99'), null, 'the monthly subscription is a listed gap, not a product');
  assert.equal(getPlayProduct('__proto__'), null);
  assert.equal(getPlayProduct(undefined), null);
  assert.ok(PLAY_GAPS.includes('pro_monthly_99'));
});

test('every pack the web catalogue holds, current and earlier, maps to a Play product granting the same credits (one catalogue)', () => {
  // Release 10: the one catalogue is src/services/credits/creditPacks.mjs (the wallet, order/verify/webhook routes and this map).
  for (const p of CREDIT_PACKS) {
    const play = getPlayProduct(p.playProductId);
    assert.ok(play && !play.legacy, `${p.playProductId} is mapped`);
    assert.equal(play.credits, p.credits, `${p.playProductId} grants what the web grants`);
  }
  for (const p of LEGACY_AI_PACKS) {
    const play = getPlayProduct(p.planId);
    assert.ok(play?.legacy, `${p.planId} is mapped as earlier`);
    assert.equal(play.credits, p.credits);
  }
  assert.equal(Object.values(PLAY_PRODUCTS).filter((p) => p.legacy).length, LEGACY_AI_PACKS.length, 'no earlier pack the web did not sell');
  assert.equal(Object.values(PLAY_PRODUCTS).filter((p) => p.kind === 'ai_credits' && !p.legacy).length, CREDIT_PACKS.length, 'no pack the web does not sell');
});

// ---- Google auth ----------------------------------------------------------------------------------------------------
test('the service account JWT is a well-formed RS256 assertion that verifies with the public key', () => {
  const parsed = parseServiceAccount(JSON.stringify(SERVICE_ACCOUNT));
  const jwt = signServiceAccountJwt({ ...parsed, nowSec: 1_760_000_000 });
  const [h, c, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.deepEqual(claims, { iss: SERVICE_ACCOUNT.client_email, scope: PLAY_SCOPE, aud: DEFAULT_TOKEN_URI, iat: 1_760_000_000, exp: 1_760_003_600 });
  assert.equal(PLAY_SCOPE, 'https://www.googleapis.com/auth/androidpublisher');
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).end().verify(SA_PUBLIC, Buffer.from(s, 'base64url')), 'the signature is valid');
  assert.ok(!jwt.includes('='), 'base64url, no padding');
});

test('the service account env value: raw JSON, base64 JSON, escaped newlines; nothing else', () => {
  const raw = JSON.stringify(SERVICE_ACCOUNT);
  assert.equal(parseServiceAccount(raw).clientEmail, SERVICE_ACCOUNT.client_email);
  assert.equal(parseServiceAccount(Buffer.from(raw).toString('base64')).clientEmail, SERVICE_ACCOUNT.client_email);
  const escaped = JSON.stringify({ ...SERVICE_ACCOUNT, private_key: SA_PEM.replace(/\n/g, '\\n') });
  assert.ok(parseServiceAccount(escaped).privateKey.includes('\n'), 'literal \\n becomes a newline');
  for (const bad of [undefined, '', 'not json', '{}', JSON.stringify({ client_email: 'a@b' }), JSON.stringify({ client_email: 'a@b', private_key: 'nope' })]) {
    assert.throws(() => parseServiceAccount(bad), (e) => e instanceof PlayApiError && e.code === 'play_not_configured');
  }
});

function fakeGoogleNetwork({ tokenLifetime = 3600, productStatus = 200, productBody = { purchaseState: 0 }, onProduct } = {}) {
  const calls = [];
  let issued = 0;
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if (String(url) === DEFAULT_TOKEN_URI) {
      issued += 1;
      return new Response(JSON.stringify({ access_token: `tok${issued}`, expires_in: tokenLifetime, token_type: 'Bearer' }), { status: 200 });
    }
    const forced = onProduct?.(calls.at(-1), issued);
    if (forced) return forced;
    return new Response(JSON.stringify(productBody), { status: productStatus });
  };
  return { fetch, calls, issued: () => issued };
}

test('the token exchange posts the JWT bearer grant, then the access token is cached until a minute before it expires', async () => {
  const net = fakeGoogleNetwork();
  let nowMs = 1_760_000_000_000;
  const client = createPlayClient({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT) }, fetch: net.fetch, now: () => nowMs });
  await client.getProduct('pro_cuet_2027', 'tokentokentokentoken1');
  const exchange = net.calls[0];
  assert.equal(exchange.url, DEFAULT_TOKEN_URI);
  const form = new URLSearchParams(exchange.body);
  assert.equal(form.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(JSON.parse(Buffer.from(form.get('assertion').split('.')[1], 'base64url')).iat, 1_760_000_000);
  const product = net.calls[1];
  assert.equal(product.url, `${PLAY_API_BASE}/applications/in.mockmob.app/purchases/products/pro_cuet_2027/tokens/tokentokentokentoken1`, 'default package in.mockmob.app');
  assert.equal(product.headers.authorization, 'Bearer tok1');

  await client.getProduct('pro_cuet_2027', 'tokentokentokentoken1');
  assert.equal(net.issued(), 1, 'second call reuses the cached token');
  nowMs += 3600_000 - 61_000;
  await client.getProduct('pro_cuet_2027', 'tokentokentokentoken1');
  assert.equal(net.issued(), 1, 'still good with a minute to spare');
  nowMs += 2_000;
  await client.getProduct('pro_cuet_2027', 'tokentokentokentoken1');
  assert.equal(net.issued(), 2, 'refreshed inside the last minute');
  assert.equal(net.calls.at(-1).headers.authorization, 'Bearer tok2');
});

test('PLAY_PACKAGE_NAME overrides the package; acknowledge and consume use the :acknowledge and :consume endpoints', async () => {
  const net = fakeGoogleNetwork({ productBody: {} });
  const client = createPlayClient({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT), PLAY_PACKAGE_NAME: 'in.mockmob.test' }, fetch: net.fetch });
  await client.acknowledge('pro_cuet_2027', 'abc.def-ghi_jklmnopqrstu');
  await client.consume('ai_credits_prepos_10_50', 'abc.def-ghi_jklmnopqrstu');
  const [, ack, consume] = net.calls;
  assert.ok(ack.url.endsWith('/applications/in.mockmob.test/purchases/products/pro_cuet_2027/tokens/abc.def-ghi_jklmnopqrstu:acknowledge'));
  assert.equal(ack.method, 'POST');
  assert.ok(consume.url.endsWith('/products/ai_credits_prepos_10_50/tokens/abc.def-ghi_jklmnopqrstu:consume'));
});

test('a 401 from the API refreshes the token once; Google errors become stable codes', async () => {
  let n = 0;
  const net = fakeGoogleNetwork({ onProduct: (call, issued) => (call.headers.authorization === 'Bearer tok1' && n++ === 0 ? new Response('{}', { status: 401 }) : null), productBody: { purchaseState: 0 } });
  const client = createPlayClient({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT) }, fetch: net.fetch });
  assert.deepEqual(await client.getProduct('pro_cuet_2027', 'tokentokentokentoken1'), { purchaseState: 0 });
  assert.equal(net.issued(), 2, 'a fresh token after the 401');

  for (const [status, code] of [[404, 'purchase_not_found'], [410, 'purchase_not_found'], [400, 'purchase_invalid'], [403, 'play_forbidden'], [500, 'play_unavailable'], [429, 'play_unavailable']]) {
    const c = createPlayClient({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT) }, fetch: fakeGoogleNetwork({ productStatus: status, productBody: { error: { message: 'x' } } }).fetch });
    await assert.rejects(c.getProduct('pro_cuet_2027', 'tokentokentokentoken1'), (e) => e.code === code && e.status === status, `${status} -> ${code}`);
  }
  const offline = createPlayClient({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(SERVICE_ACCOUNT) }, fetch: async () => { throw new Error('ECONNRESET'); } });
  await assert.rejects(offline.getProduct('pro_cuet_2027', 'tokentokentokentoken1'), (e) => e.code === 'play_unavailable');
  const unset = createPlayClient({ env: {}, fetch: net.fetch });
  await assert.rejects(unset.getProduct('pro_cuet_2027', 'tokentokentokentoken1'), (e) => e.code === 'play_not_configured');
});

// ---- the billing core, with a fake Google and an in-memory store ------------------------------------------------------
const TOKEN = 'purchasetokenpurchasetoken0001';
const accountOf = playAccountHash;
const purchaseFor = (userId, productId = 'pro_cuet_2027', over = {}) => ({
  kind: 'androidpublisher#productPurchase', purchaseTimeMillis: '1760800000000', purchaseState: 0, consumptionState: 0, acknowledgementState: 0,
  orderId: 'GPA.3300-1234-5678-90123', productId, quantity: 1, obfuscatedExternalAccountId: accountOf(userId), purchaseType: 0, regionCode: 'IN', ...over,
});

function fakeGoogle() {
  const g = { products: new Map(), calls: [], failFinish: false, unreachable: false };
  g.getProduct = async (productId, token) => {
    g.calls.push(['get', productId, token]);
    if (g.unreachable) throw new PlayApiError('play_unavailable', 'down');
    const p = g.products.get(token);
    if (!p) throw new PlayApiError('purchase_not_found', 'no such purchase', 404);
    return { ...p };
  };
  g.acknowledge = async (productId, token) => { g.calls.push(['acknowledge', productId, token]); if (g.failFinish) throw new PlayApiError('play_unavailable', 'down'); g.products.get(token).acknowledgementState = 1; return {}; };
  g.consume = async (productId, token) => { g.calls.push(['consume', productId, token]); if (g.failFinish) throw new PlayApiError('play_unavailable', 'down'); Object.assign(g.products.get(token), { consumptionState: 1, acknowledgementState: 1 }); return {}; };
  g.count = (kind) => g.calls.filter((c) => c[0] === kind).length;
  return g;
}

/** The same rules as the SQL functions, in memory, so the logic tests can count calls. */
function fakeStore() {
  const rows = new Map();
  const s = { rows, grants: [], revokes: [], balances: new Map() };
  s.getByToken = async (token) => (rows.get(token) ? { ...rows.get(token) } : null);
  s.grant = async (g) => {
    s.grants.push(g);
    const prev = rows.get(g.purchaseToken);
    if (prev) {
      if (prev.state === 'voided') return { ok: false, error: 'purchase_voided' };
      if (prev.user_id !== g.userId) return { ok: false, error: 'purchase_already_used' };
      return { ok: true, idempotent: true, granted: prev.granted };
    }
    const granted = g.kind === 'pro'
      ? { kind: 'pro', accessUntil: g.accessUntil, premiumUntil: g.accessUntil, duplicatePro: false }
      : { kind: g.kind, credits: g.credits, balance: (s.balances.get(`${g.kind}:${g.userId}`) || 0) + g.credits };
    if (g.kind !== 'pro') s.balances.set(`${g.kind}:${g.userId}`, granted.balance);
    rows.set(g.purchaseToken, { purchase_token: g.purchaseToken, user_id: g.userId, product_id: g.productId, kind: g.kind, state: 'granted', order_id: g.orderId, granted, acknowledged_at: null, consumed_at: null });
    return { ok: true, idempotent: false, granted };
  };
  s.markFinished = async (token, { acknowledged, consumed }) => { const r = rows.get(token); if (acknowledged) r.acknowledged_at = 'now'; if (consumed) r.consumed_at = 'now'; };
  s.revoke = async (r) => {
    s.revokes.push(r);
    const row = rows.get(r.purchaseToken);
    if (!row) { rows.set(r.purchaseToken, { purchase_token: r.purchaseToken, state: 'voided', user_id: null }); return { ok: true, found: false, tombstone: true }; }
    if (row.state === 'voided') return { ok: true, found: true, idempotent: true, kind: row.kind };
    row.state = 'voided';
    return { ok: true, found: true, idempotent: false, kind: row.kind, revoked: { kind: row.kind } };
  };
  return s;
}

function world(over = {}) {
  const store = fakeStore();
  const google = fakeGoogle();
  const deps = { store, google, packageName: 'in.mockmob.app', now: () => Date.parse('2026-10-20T00:00:00Z'), log: quiet, ...over };
  const verify = (input) => verifyPlayPurchase(deps, { productId: 'pro_cuet_2027', purchaseToken: TOKEN, ...input });
  return { store, google, deps, verify };
}

test('happy path, Pro: purchased, bound to the account, granted until the web date, acknowledged and not consumed', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1'));
  const r = await w.verify({ userId: 'u1', obfuscatedAccountId: accountOf('u1') });
  assert.equal(r.ok, true);
  assert.equal(r.idempotent, false);
  assert.equal(r.kind, 'pro');
  assert.deepEqual(r.pro, { isPremium: true, premiumUntil: '2027-07-31T18:29:59.999Z', duplicate: false });
  assert.equal(r.finished, true);
  assert.equal(w.store.grants.length, 1);
  assert.equal(w.store.grants[0].accessUntil, PAYMENT_PLANS.pro_cuet_2027.accessUntil);
  assert.equal(w.store.grants[0].orderId, 'GPA.3300-1234-5678-90123');
  assert.equal(w.google.count('acknowledge'), 1, 'Pro is acknowledged');
  assert.equal(w.google.count('consume'), 0, 'and never consumed');
  assert.ok(w.store.rows.get(TOKEN).acknowledged_at);
});

test('happy path, credit pack: granted into the held credits, then consumed so it can be bought again', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1', 'credits_29_150'));
  const r = await w.verify({ userId: 'u1', productId: 'credits_29_150' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.credits, { granted: 150, balance: 150 });
  assert.equal(w.google.count('consume'), 1);
  assert.equal(w.google.count('acknowledge'), 0, 'consume acknowledges by itself');
  assert.ok(w.store.rows.get(TOKEN).consumed_at);
});

test('every credit pack, new and earlier, grants its credits as bonus credits and is consumed', async () => {
  for (const [productId, credits] of [['credits_10_50', 50], ['credits_29_150', 150], ['credits_49_300', 300], ['ai_credits_prepos_10_50', 50], ['ai_credits_prepos_20_150', 150], ['ai_credits_prepos_50_400', 400]]) {
    const w = world();
    w.google.products.set(TOKEN, purchaseFor('u1', productId));
    const r = await w.verify({ userId: 'u1', productId });
    assert.equal(r.ok, true, productId);
    assert.deepEqual(r.credits, { granted: credits, balance: credits });
    assert.equal(w.store.grants[0].kind, 'ai_credits');
    assert.equal(w.store.grants[0].credits, credits);
    assert.equal(w.google.count('consume'), 1);
  }
});

test('a client price, amount or credit count is never read: the server grants what the product id maps to', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1', 'credits_10_50'));
  const r = await handlePlayVerify({
    enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), rateLimit: async () => ({ allowed: true }), billing: w.deps,
  }, new Request('http://x/api/billing/play/verify', {
    method: 'POST',
    body: JSON.stringify({ productId: 'credits_10_50', purchaseToken: TOKEN, credits: 99999, amount: 1, price: 0, priceAmountMicros: 1, accessUntil: '2099-01-01T00:00:00Z', plan: 'pro_cuet_2027', kind: 'pro', userId: 'someone-else' }),
  }));
  assert.equal(r.status, 200);
  assert.equal(w.store.grants[0].credits, 50);
  assert.equal(w.store.grants[0].kind, 'ai_credits');
  assert.equal(w.store.grants[0].userId, 'u1', 'the caller, never a userId from the body');
  assert.equal(w.store.grants[0].accessUntil, null);
  const src = file('src/lib/server/playBillingHttp.js') + file('src/lib/payments/playBilling.js');
  assert.doesNotMatch(src, /\bb\.(amount|price|credits|accessUntil|plan|kind|userId)\b|\binput\.(amount|price|credits|accessUntil|plan|kind)\b/);
});

test('wrong package, unknown product and bad token are refused before Google is asked', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1'));
  assert.equal((await w.verify({ userId: 'u1', packageName: 'com.other.app' })).code, 'wrong_package');
  assert.equal((await w.verify({ userId: 'u1', productId: 'pro_monthly_99' })).code, 'unknown_product');
  assert.equal((await w.verify({ userId: 'u1', productId: 'pro_cuet_2026' })).code, 'unknown_product');
  assert.equal((await w.verify({ userId: 'u1', purchaseToken: 'short' })).code, 'bad_token');
  assert.equal((await w.verify({ userId: 'u1', purchaseToken: '../../etc/passwd/xxxxxxxxxx' })).code, 'bad_token');
  assert.equal((await w.verify({ userId: null })).code, 'unauthenticated');
  assert.equal(w.google.calls.length, 0);
  assert.equal(w.store.grants.length, 0);
  // The right package passes.
  assert.equal((await w.verify({ userId: 'u1', packageName: 'in.mockmob.app' })).ok, true);
});

test('a pending purchase grants nothing and says to wait (202); a cancelled one is refused; nothing is acknowledged', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1', 'pro_cuet_2027', { purchaseState: 2 }));
  const pending = await w.verify({ userId: 'u1' });
  assert.deepEqual([pending.ok, pending.status, pending.code, pending.pending], [false, 202, 'purchase_pending', true]);
  w.google.products.set(TOKEN, purchaseFor('u1', 'pro_cuet_2027', { purchaseState: 1 }));
  const cancelled = await w.verify({ userId: 'u1' });
  assert.deepEqual([cancelled.ok, cancelled.status, cancelled.code], [false, 409, 'purchase_canceled']);
  w.google.products.set(TOKEN, purchaseFor('u1', 'pro_cuet_2027', { purchaseState: undefined }));
  assert.equal((await w.verify({ userId: 'u1' })).ok, false, 'a response with no purchaseState is not "purchased"');
  assert.equal(w.store.grants.length, 0);
  assert.equal(w.google.count('acknowledge') + w.google.count('consume'), 0);
});

test('the purchase must have been made by the signed-in account (Google obfuscated account id)', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u2'));
  const other = await w.verify({ userId: 'u1' });
  assert.deepEqual([other.ok, other.status, other.code], [false, 403, 'account_mismatch']);
  w.google.products.set(TOKEN, purchaseFor('u1', 'pro_cuet_2027', { obfuscatedExternalAccountId: undefined }));
  assert.equal((await w.verify({ userId: 'u1' })).code, 'account_mismatch', 'a purchase with no account binding is refused');
  w.google.products.set(TOKEN, purchaseFor('u1'));
  assert.equal((await w.verify({ userId: 'u1', obfuscatedAccountId: accountOf('u2') })).code, 'account_mismatch', 'the id the app sends must be the caller\'s own');
  assert.equal(w.store.grants.length, 0);
  assert.equal(w.google.count('acknowledge'), 0, 'a mismatched purchase is left unacknowledged: Google refunds it');
});

test('the account id is the lowercase hex SHA-256 of the user id (64 characters)', () => {
  assert.equal(playAccountHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.match(playAccountHash('3f2a9e1c-0000-4000-8000-000000000001'), /^[0-9a-f]{64}$/);
});

test('a token already used by another account is refused and grants nothing', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1'));
  assert.equal((await w.verify({ userId: 'u1' })).ok, true);
  const calls = w.google.calls.length;
  const thief = await w.verify({ userId: 'u2', obfuscatedAccountId: accountOf('u2') });
  assert.deepEqual([thief.ok, thief.status, thief.code], [false, 409, 'purchase_already_used']);
  assert.equal(w.store.grants.length, 1, 'only u1 was ever granted');
  assert.equal(w.google.calls.length, calls, 'answered from our own record without asking Google');
  // Even with Google's record rewritten to the thief's hash, the stored owner wins.
  w.google.products.set(TOKEN, purchaseFor('u2'));
  assert.equal((await w.verify({ userId: 'u2' })).code, 'purchase_already_used');
});

test('a replay returns the same result and grants nothing twice', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1', 'ai_credits_prepos_10_50'));
  const first = await w.verify({ userId: 'u1', productId: 'ai_credits_prepos_10_50' });
  const callsAfterFirst = w.google.calls.length;
  const replay = await w.verify({ userId: 'u1', productId: 'ai_credits_prepos_10_50' });
  assert.equal(replay.ok, true);
  assert.equal(replay.idempotent, true);
  assert.deepEqual(replay.credits, first.credits, 'the same result');
  assert.equal(w.store.balances.get('ai_credits:u1'), 50, 'credited once');
  assert.equal(w.google.calls.length, callsAfterFirst, 'a finished replay needs no Google call');
  // Same token, another product id: refused.
  assert.equal((await w.verify({ userId: 'u1', productId: 'ai_credits_prepos_20_150' })).code, 'product_mismatch');
});

test('acknowledge vs consume when Google is down: the grant stands, finished is false, and the replay finishes it', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1'));
  w.google.failFinish = true;
  const first = await w.verify({ userId: 'u1' });
  assert.equal(first.ok, true, 'a paid purchase is never failed by a Google hiccup');
  assert.equal(first.finished, false);
  assert.equal(w.store.rows.get(TOKEN).acknowledged_at, null);
  w.google.failFinish = false;
  const replay = await w.verify({ userId: 'u1' });
  assert.equal(replay.idempotent, true);
  assert.equal(replay.finished, true);
  assert.equal(w.google.count('acknowledge'), 2, 'one failed try, one that worked');
  assert.equal(w.store.grants.length, 1);
  assert.equal(w.store.rows.get(TOKEN).user_id, 'u1');

  // A credit pack that is already consumed at Google is not consumed again.
  const t2 = 'purchasetokenpurchasetoken0002';
  w.google.products.set(t2, purchaseFor('u1', 'ai_credits_prepos_10_50', { consumptionState: 1, acknowledgementState: 1 }));
  const r2 = await w.verify({ userId: 'u1', productId: 'ai_credits_prepos_10_50', purchaseToken: t2 });
  assert.equal(r2.ok, true);
  assert.equal(w.google.count('consume'), 0);
  assert.ok(w.store.rows.get(t2).consumed_at);
});

test('Google errors: not found and unreachable grant nothing', async () => {
  const w = world();
  const missing = await w.verify({ userId: 'u1' });
  assert.deepEqual([missing.status, missing.code], [404, 'purchase_not_found']);
  w.google.unreachable = true;
  const down = await w.verify({ userId: 'u1' });
  assert.deepEqual([down.status, down.code], [503, 'play_unavailable']);
  assert.equal(w.store.grants.length, 0);
  const unconfigured = world();
  unconfigured.google.getProduct = async () => { throw new PlayApiError('play_not_configured', 'x'); };
  assert.equal((await unconfigured.verify({ userId: 'u1' })).code, 'play_not_configured');
});

test('quantity other than one, a mismatching product or order, and an ended pass are refused', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1', 'pro_cuet_2027', { quantity: 2 }));
  assert.equal((await w.verify({ userId: 'u1' })).code, 'unsupported_quantity');
  w.google.products.set(TOKEN, purchaseFor('u1', 'ai_credits_prepos_10_50'));
  assert.equal((await w.verify({ userId: 'u1' })).code, 'product_mismatch', 'Google says it is another product');
  w.google.products.set(TOKEN, purchaseFor('u1'));
  assert.equal((await w.verify({ userId: 'u1', orderId: 'GPA.0000-0000-0000-00000' })).code, 'order_mismatch');
  const late = world({ now: () => Date.parse('2027-08-01T00:00:00Z') });
  late.google.products.set(TOKEN, purchaseFor('u1'));
  const ended = await late.verify({ userId: 'u1' });
  assert.deepEqual([ended.status, ended.code], [409, 'product_expired']);
  assert.equal(late.google.calls.length, 0);
});

test('a database failure on the grant answers 503 with nothing acknowledged', async () => {
  const w = world();
  w.google.products.set(TOKEN, purchaseFor('u1'));
  w.store.grant = async () => { throw new Error('connection reset'); };
  const r = await w.verify({ userId: 'u1' });
  assert.deepEqual([r.ok, r.status, r.code], [false, 503, 'grant_unavailable']);
  assert.equal(w.google.count('acknowledge'), 0, 'not acknowledged, so Google would refund it if we never recover');
});

// ---- the verify route handler --------------------------------------------------------------------------------------
function httpWorld({ enabled = true, session = { user: { id: 'u1' } }, limiter = { allowed: true } } = {}) {
  const w = world();
  const spy = { auth: 0, limit: [], billing: w.deps };
  const deps = {
    enabled: () => enabled,
    auth: async () => { spy.auth += 1; return session; },
    rateLimit: async (_req, opts) => { spy.limit.push(opts); return limiter; },
    billing: w.deps,
  };
  const post = (body, init = {}) => handlePlayVerify(deps, new Request('http://x/api/billing/play/verify', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), ...init }));
  return { ...w, spy, deps, post };
}

test('verify route: flag off answers 404 for every method and reads nothing', async () => {
  const h = httpWorld({ enabled: false });
  for (const method of ['POST', 'GET', 'PUT', 'PATCH', 'DELETE']) {
    const res = await handlePlayVerify(h.deps, new Request('http://x/api/billing/play/verify', { method, ...(method === 'GET' ? {} : { body: '{}' }) }));
    assert.equal(res.status, 404, method);
  }
  assert.equal(h.spy.auth, 0);
  assert.equal(h.google.calls.length, 0);
  assert.equal(playBillingEnabled({}), false);
  assert.equal(playBillingEnabled({ PLAY_BILLING_ENABLED: '1' }), false);
  assert.equal(playBillingEnabled({ PLAY_BILLING_ENABLED: 'TRUE' }), false);
  assert.equal(playBillingEnabled({ PLAY_BILLING_ENABLED: 'true' }), true);
});

test('verify route: signed-out 401, wrong method 405, rate limited 429 (money limiter, per user), bad body 400', async () => {
  assert.equal((await httpWorld({ session: null }).post({ productId: 'pro_cuet_2027', purchaseToken: TOKEN })).status, 401);
  const h = httpWorld();
  assert.equal((await handlePlayVerify(h.deps, new Request('http://x/api/billing/play/verify'))).status, 405);
  assert.equal((await h.post('not json')).status, 400);
  assert.equal((await h.post('[1]')).status, 400);
  assert.equal((await h.post(JSON.stringify({ pad: 'x'.repeat(9000) }))).status, 400);
  const limited = httpWorld({ limiter: { allowed: false, retryAfterSeconds: 77 } });
  const res = await limited.post({ productId: 'pro_cuet_2027', purchaseToken: TOKEN });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '77');
  assert.equal(limited.google.calls.length, 0, 'limited before Google is asked');
  const opts = h.spy.limit[0];
  assert.equal(opts.route, '/api/billing/play/verify');
  assert.deepEqual(opts.keyParts, ['u1']);
  assert.equal(opts.fallback, undefined, 'fails closed: no in-memory fallback on a money route');
  const broken = httpWorld();
  broken.deps.rateLimit = async () => { throw new Error('db'); };
  assert.equal((await handlePlayVerify(broken.deps, new Request('http://x/v', { method: 'POST', body: '{}' }))).status, 429);
});

test('verify route: the response carries the entitlement, the error code and Cache-Control: no-store', async () => {
  const h = httpWorld();
  h.google.products.set(TOKEN, purchaseFor('u1'));
  const ok = await h.post({ productId: 'pro_cuet_2027', purchaseToken: TOKEN, obfuscatedExternalAccountId: accountOf('u1') });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  const body = await ok.json();
  assert.equal(body.ok, true);
  assert.equal(body.pro.premiumUntil, '2027-07-31T18:29:59.999Z');
  const refused = await h.post({ productId: 'pro_cuet_2027', purchaseToken: TOKEN, obfuscatedExternalAccountId: accountOf('u2') });
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).code, 'account_mismatch');
});

// ---- RTDN ----------------------------------------------------------------------------------------------------------
const push = (notification, messageId = 'm-1') => ({ message: { data: Buffer.from(JSON.stringify(notification)).toString('base64'), messageId, publishTime: '2026-10-20T00:00:00Z' }, subscription: 'projects/x/subscriptions/y' });
const voidedFor = (token, over = {}) => ({ version: '1.0', packageName: 'in.mockmob.app', eventTimeMillis: '1760900000000', voidedPurchaseNotification: { purchaseToken: token, orderId: 'GPA.3300-1234-5678-90123', productType: 2, refundType: 1, ...over } });

function rtdnWorld({ env = { PLAY_RTDN_TOKEN: 'rtdn-secret-token' }, enabled = true } = {}) {
  const w = world();
  const events = new Map();
  const log = [];
  const deps = {
    enabled: () => enabled, env,
    billing: { store: w.store, packageName: 'in.mockmob.app', log: (...a) => log.push(a.join(' ')) },
    claimEvent: async ({ eventId }) => { if (events.has(eventId)) return events.get(eventId) === 'done' ? false : 'in_flight'; events.set(eventId, 'claimed'); return true; },
    markProcessed: async (id) => { events.set(id, 'done'); },
    markFailed: async (id) => { events.delete(id); },
  };
  const post = (body, { token = env.PLAY_RTDN_TOKEN, method = 'POST', headers = {} } = {}) =>
    handlePlayRtdn(deps, new Request(`http://x/api/billing/play/rtdn${token === null ? '' : `?token=${token}`}`, { method, headers, ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }));
  return { ...w, deps, post, events, log };
}

test('RTDN: a voided purchase revokes what was granted, once; the same push again is a duplicate', async () => {
  const r = rtdnWorld();
  r.google.products.set(TOKEN, purchaseFor('u1'));
  await r.verify({ userId: 'u1' });
  const res = await r.post(push(voidedFor(TOKEN)));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).action, 'revoked');
  assert.equal(r.store.rows.get(TOKEN).state, 'voided');
  const again = await r.post(push(voidedFor(TOKEN)));
  assert.equal((await again.json()).duplicate, true);
  assert.equal(r.store.revokes.length, 1, 'the duplicate push revoked nothing again');
  // A new message about the same purchase is idempotent in the store.
  const second = await r.post(push(voidedFor(TOKEN), 'm-2'));
  assert.equal((await second.json()).action, 'already_voided');
  // The voided token cannot be used again.
  assert.equal((await r.verify({ userId: 'u1' })).code, 'purchase_voided');
});

test('RTDN: a void that arrives before the purchase was verified leaves a tombstone; a test notification is logged', async () => {
  const r = rtdnWorld();
  const res = await r.post(push(voidedFor('neverseenpurchasetoken0000001'), 'm-3'));
  assert.equal((await res.json()).action, 'tombstone');
  const test1 = await r.post(push({ version: '1.0', packageName: 'in.mockmob.app', eventTimeMillis: '1', testNotification: { version: '1.0' } }, 'm-4'));
  assert.equal((await test1.json()).action, 'test');
  assert.ok(r.log.some((l) => /test notification/.test(l)), 'logged');
  assert.equal(r.store.revokes.length, 1, 'a test notification revokes nothing');
});

test('RTDN: another package, a subscription void and a purchased message are acknowledged and ignored; garbage is dropped with 200', async () => {
  const r = rtdnWorld();
  r.google.products.set(TOKEN, purchaseFor('u1'));
  await r.verify({ userId: 'u1' });
  const other = await r.post(push({ ...voidedFor(TOKEN), packageName: 'com.other.app' }, 'm-5'));
  assert.equal((await other.json()).reason, 'wrong_package');
  const sub = await r.post(push(voidedFor(TOKEN, { productType: 1 }), 'm-6'));
  assert.equal((await sub.json()).action, 'ignored');
  const bought = await r.post(push({ version: '1.0', packageName: 'in.mockmob.app', oneTimeProductNotification: { version: '1.0', notificationType: 1, purchaseToken: TOKEN, sku: 'pro_cuet_2027' } }, 'm-7'));
  assert.equal((await bought.json()).action, 'logged');
  assert.equal(r.store.rows.get(TOKEN).state, 'granted', 'none of these touched the purchase');
  const garbage = await r.post({ message: { data: '%%%not-base64-json%%%', messageId: 'm-8' } });
  assert.equal(garbage.status, 200);
  assert.equal((await r.post('not json')).status, 200);
  assert.equal(decodePubSubMessage({}), null);
  assert.equal(r.store.revokes.length, 0);
});

test('RTDN: a database failure answers 500 so Pub/Sub retries, and the retry is processed', async () => {
  const r = rtdnWorld();
  r.google.products.set(TOKEN, purchaseFor('u1'));
  await r.verify({ userId: 'u1' });
  const real = r.store.revoke;
  r.store.revoke = async () => { throw new Error('connection reset'); };
  const failed = await r.post(push(voidedFor(TOKEN), 'm-9'));
  assert.equal(failed.status, 500);
  r.store.revoke = real;
  const retry = await r.post(push(voidedFor(TOKEN), 'm-9'));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).action, 'revoked');
});

test('RTDN: flag off is 404; no token configured, a missing or wrong token is 401 and processes nothing', async () => {
  assert.equal((await rtdnWorld({ enabled: false }).post(push(voidedFor(TOKEN)))).status, 404);
  const closed = rtdnWorld({ env: {} });
  assert.equal((await closed.post(push(voidedFor(TOKEN)), { token: 'anything' })).status, 401, 'unset secret keeps the endpoint closed');
  const r = rtdnWorld();
  assert.equal((await r.post(push(voidedFor(TOKEN)), { token: null })).status, 401);
  assert.equal((await r.post(push(voidedFor(TOKEN)), { token: 'wrong' })).status, 401);
  assert.equal((await r.post(push(voidedFor(TOKEN)), { method: 'GET' })).status, 405);
  assert.equal(r.store.revokes.length, 0);
});

// ---- the Pub/Sub OIDC token ----------------------------------------------------------------------------------------
const { privateKey: OIDC_PRIVATE, publicKey: OIDC_PUBLIC } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: OTHER_PRIVATE } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const AUD = 'https://www.mockmob.in/api/billing/play/rtdn';
const oidc = (claims = {}, { key = OIDC_PRIVATE, kid = 'kid1', alg = 'RS256' } = {}) => {
  const input = `${b64url(JSON.stringify({ alg, kid, typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: 'https://accounts.google.com', aud: AUD, email: 'push@mockmob.iam.gserviceaccount.com', email_verified: true, iat: 1_760_000_000, exp: 1_760_003_600, ...claims }))}`;
  return `${input}.${b64url(createSign('RSA-SHA256').update(input).end().sign(key))}`;
};
// Google publishes X.509 certificates by key id. A real certificate needs a CA; the verifier accepts a public key PEM the
// same way (crypto.verify takes either), so the fake source serves the public key PEM.
const certs = async () => ({ kid1: OIDC_PUBLIC.export({ type: 'spki', format: 'pem' }) });
const nowMs = 1_760_000_100_000;

test('Pub/Sub OIDC: a Google-signed token for our audience passes; wrong audience, issuer, expiry, signature, key or email fail', async () => {
  const check = (token, opts = {}) => verifyPubSubOidc(token, { audience: AUD, certs, now: () => nowMs, ...opts });
  assert.equal(await check(oidc()), true);
  assert.equal(await check(oidc({ aud: 'https://evil.example' })), false, 'wrong audience');
  assert.equal(await check(oidc({ iss: 'https://evil.example' })), false, 'wrong issuer');
  assert.equal(await check(oidc({ exp: 1_760_000_000 })), false, 'expired');
  assert.equal(await check(oidc({ email_verified: false })), false);
  assert.equal(await check(oidc({}, { key: OTHER_PRIVATE })), false, 'signed by another key');
  assert.equal(await check(oidc({}, { kid: 'unknown' })), false, 'unknown key id');
  assert.equal(await check(oidc({}, { alg: 'none' })), false, 'only RS256');
  assert.equal(await check(oidc(), { email: 'push@mockmob.iam.gserviceaccount.com' }), true);
  assert.equal(await check(oidc(), { email: 'someone@else.example' }), false, 'the push service account is pinned');
  assert.equal(await check('not.a.jwt'), false);
  assert.equal(await check(''), false);
});

test('Pub/Sub OIDC: when the audience is configured the OIDC check is required on top of the token', async () => {
  const env = { PLAY_RTDN_TOKEN: 'rtdn-secret-token', PLAY_RTDN_OIDC_AUDIENCE: AUD };
  const mk = (headers, token = 'rtdn-secret-token') => new Request(`http://x/rtdn?token=${token}`, { method: 'POST', headers });
  assert.deepEqual(await authenticatePush(mk({ authorization: `Bearer ${oidc()}` }), { env, certs, now: () => nowMs }), { ok: true });
  assert.equal((await authenticatePush(mk({}), { env, certs, now: () => nowMs })).reason, 'bad_oidc');
  assert.equal((await authenticatePush(mk({ authorization: `Bearer ${oidc({}, { key: OTHER_PRIVATE })}` }), { env, certs, now: () => nowMs })).reason, 'bad_oidc');
  assert.equal((await authenticatePush(mk({ authorization: `Bearer ${oidc()}` }, 'wrong'), { env, certs, now: () => nowMs })).reason, 'bad_token');
  // Without the audience env var only the token is checked.
  assert.deepEqual(await authenticatePush(mk({}), { env: { PLAY_RTDN_TOKEN: 'rtdn-secret-token' }, certs, now: () => nowMs }), { ok: true });
});

test('Google certificates are fetched once an hour', async () => {
  let fetched = 0;
  let t = 0;
  const source = createCertSource({ fetch: async () => { fetched += 1; return new Response(JSON.stringify({ kid1: 'pem' })); }, now: () => t });
  await source(); await source();
  assert.equal(fetched, 1);
  t += 3_600_001;
  await source();
  assert.equal(fetched, 2);
});

// ---- the SQL: grant and revoke on the real migrations ---------------------------------------------------------------
async function database() {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table public.users(id text primary key, is_premium boolean not null default false, subscription_status text not null default 'free', premium_until timestamptz, razorpay_subscription_id text);
    create table public.payments(id text primary key, user_id text references public.users(id), payment_id text, amount_paid int, status text, access_until timestamptz, plan_id text);
    create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int default 50, included_credits_used int default 0 check(included_credits_used>=0), bonus_credits int default 0 check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any (array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry','ai_reserve','ai_release'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text, balance_after int, idempotency_key text);`);
  await d.exec(GRANT_MIGRATION);
  await d.exec(MIGRATION);
  for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) await d.query('insert into public.users(id) values ($1)', [u]);
  return d;
}
const q = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const grant = (d, user, token, product, extra = {}) => {
  const pro = product === 'pro_cuet_2027';
  const kind = pro ? 'pro' : 'ai_credits';
  return q(d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8) r', [user, token, extra.order ?? `GPA.${token}`, product, kind, pro ? null : extra.credits ?? 50, pro ? extra.until ?? '2027-07-31T18:29:59.999Z' : null, { purchaseState: 0 }]).then((r) => r[0].r);
};
const revoke = (d, token, reason = 'voided') => q(d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4) r', [token, reason, null, {}]).then((r) => r[0].r);
const userRow = (d, id) => q(d, 'select is_premium, subscription_status, premium_until from public.users where id=$1', [id]).then((r) => r[0]);

test('SQL grant, Pro: the user row says Pro until the web date; the row, the grant and a replay agree', async () => {
  const d = await database();
  try {
    const r = await grant(d, 'u1', 'tok-pro-0000000000001', 'pro_cuet_2027');
    assert.equal(r.ok, true);
    assert.equal(r.idempotent, false);
    assert.equal(r.granted.kind, 'pro');
    assert.equal(r.granted.duplicatePro, false);
    const u = await userRow(d, 'u1');
    assert.equal(u.is_premium, true);
    assert.equal(u.subscription_status, 'active');
    assert.equal(new Date(u.premium_until).toISOString(), '2027-07-31T18:29:59.999Z');
    const rows = await q(d, 'select * from public.play_purchases');
    assert.equal(rows.length, 1);
    assert.deepEqual([rows[0].user_id, rows[0].product_id, rows[0].kind, rows[0].state], ['u1', 'pro_cuet_2027', 'pro', 'granted']);
    assert.equal(rows[0].acknowledged_at, null);

    const replay = await grant(d, 'u1', 'tok-pro-0000000000001', 'pro_cuet_2027');
    assert.equal(replay.ok, true);
    assert.equal(replay.idempotent, true);
    assert.deepEqual(replay.granted, r.granted, 'the same result');
    assert.equal((await q(d, 'select count(*)::int n from public.play_purchases'))[0].n, 1);

    assert.equal((await grant(d, 'u2', 'tok-pro-0000000000001', 'pro_cuet_2027')).error, 'purchase_already_used');
    assert.equal((await userRow(d, 'u2')).is_premium, false, 'the second account got nothing');
    assert.equal((await grant(d, 'u1', 'tok-pro-0000000000001', 'ai_credits_prepos_10_50')).error, 'product_mismatch');
    assert.equal((await grant(d, 'nobody', 'tok-pro-0000000000002', 'pro_cuet_2027')).error, 'user_not_found');
    assert.equal((await q(d, "select count(*)::int n from public.play_purchases where purchase_token='tok-pro-0000000000002'"))[0].n, 0);
  } finally { await d.close(); }
});

test('SQL grant, Pro: access is never shortened, and a double purchase is flagged', async () => {
  const d = await database();
  try {
    await d.query("update public.users set is_premium=true, subscription_status='active', premium_until='2028-01-01T00:00:00Z' where id='u1'");
    const r = await grant(d, 'u1', 'tok-pro-0000000000003', 'pro_cuet_2027');
    assert.equal(r.granted.duplicatePro, true, 'already Pro beyond the pass end: flagged for a refund');
    assert.equal(new Date((await userRow(d, 'u1')).premium_until).toISOString(), '2028-01-01T00:00:00.000Z', 'not shortened');
    // A user on an earlier end date is extended.
    await d.query("update public.users set is_premium=true, subscription_status='active', premium_until=now() + interval '10 days' where id='u2'");
    const r2 = await grant(d, 'u2', 'tok-pro-0000000000004', 'pro_cuet_2027');
    assert.equal(r2.granted.duplicatePro, false);
    assert.equal(new Date((await userRow(d, 'u2')).premium_until).toISOString(), '2027-07-31T18:29:59.999Z');
  } finally { await d.close(); }
});

test('SQL grant, credit pack: the existing atomic grant runs once; a replay and another account add nothing', async () => {
  const d = await database();
  try {
    const r = await grant(d, 'u1', 'tok-pack-000000000001', 'credits_29_150', { credits: 150 });
    assert.equal(r.ok, true);
    assert.equal(r.granted.credits, 150);
    assert.equal(r.granted.balance, 160, '10 included (new-wallet default of the grant function) + 150 bonus');
    const wallet = (await q(d, "select bonus_credits b from public.ai_credit_wallets where user_id='u1'"))[0];
    assert.equal(wallet.b, 150);
    const ledger = await q(d, "select amount, reason, feature, idempotency_key from public.ai_credit_ledger where user_id='u1'");
    assert.deepEqual(ledger, [{ amount: 150, reason: 'pack_purchase', feature: 'ai_credit_purchase', idempotency_key: 'play:tok-pack-000000000001' }]);
    await grant(d, 'u1', 'tok-pack-000000000001', 'credits_29_150', { credits: 150 });
    assert.equal((await grant(d, 'u2', 'tok-pack-000000000001', 'credits_29_150', { credits: 150 })).error, 'purchase_already_used');
    assert.equal((await q(d, "select bonus_credits b from public.ai_credit_wallets where user_id='u1'"))[0].b, 150, 'credited once');
    assert.equal((await q(d, 'select count(*)::int n from public.ai_credit_ledger'))[0].n, 1);
    assert.equal((await grant(d, 'u3', 'tok-pack-000000000002', 'ai_credits_prepos_10_50', { credits: 0 })).error, 'invalid_amount');
  } finally { await d.close(); }
});

test('SQL grant is atomic: when the credit grant fails the play_purchases row rolls back with it', async () => {
  const d = await database();
  try {
    await d.exec(`create or replace function public.mm_ai_grant_bonus_credits(p_user_id text, p_amount integer, p_reason text, p_reference text, p_idempotency_key text, p_metadata jsonb default '{}'::jsonb) returns jsonb language sql as $$ select jsonb_build_object('ok', false, 'error', 'wallet_not_found') $$;`);
    await assert.rejects(grant(d, 'u1', 'tok-pack-000000000003', 'ai_credits_prepos_10_50'), /play_credit_grant_failed/);
    assert.equal((await q(d, 'select count(*)::int n from public.play_purchases'))[0].n, 0, 'no row without its grant');
  } finally { await d.close(); }
});

test('SQL revoke, Pro: a void switches Pro off, once; a late verify of the voided token is refused', async () => {
  const d = await database();
  try {
    await grant(d, 'u1', 'tok-pro-0000000000010', 'pro_cuet_2027');
    const r = await revoke(d, 'tok-pro-0000000000010');
    assert.equal(r.ok, true);
    assert.equal(r.revoked.proSwitchedOff, true);
    assert.deepEqual(await userRow(d, 'u1'), { is_premium: false, subscription_status: 'cancelled', premium_until: null });
    const row = (await q(d, "select state, voided_at, revoked from public.play_purchases where purchase_token='tok-pro-0000000000010'"))[0];
    assert.equal(row.state, 'voided');
    assert.ok(row.voided_at);
    assert.equal(row.revoked.reason, 'voided');
    assert.equal((await revoke(d, 'tok-pro-0000000000010')).idempotent, true, 'a second void changes nothing');
    assert.equal((await grant(d, 'u1', 'tok-pro-0000000000010', 'pro_cuet_2027')).error, 'purchase_voided');
    assert.equal((await userRow(d, 'u1')).is_premium, false);

    // Voided before it was ever verified: a tombstone, then verify is refused.
    const early = await revoke(d, 'tok-pro-0000000000011');
    assert.deepEqual([early.ok, early.found, early.tombstone], [true, false, true]);
    assert.equal((await grant(d, 'u2', 'tok-pro-0000000000011', 'pro_cuet_2027')).error, 'purchase_voided');
    assert.equal((await userRow(d, 'u2')).is_premium, false);
  } finally { await d.close(); }
});

test('SQL revoke, Pro: other paid access keeps Pro (a captured web payment, or another Play Pro still in force)', async () => {
  const d = await database();
  try {
    await d.query("insert into public.payments values ('p1','u1','pay_1',9900,'captured','2027-07-31T18:29:59Z','pro_cuet_2027')");
    await grant(d, 'u1', 'tok-pro-0000000000020', 'pro_cuet_2027');
    const r = await revoke(d, 'tok-pro-0000000000020');
    assert.equal(r.revoked.keptForOtherPaidAccess, true);
    assert.equal((await userRow(d, 'u1')).is_premium, true, 'the web payment still holds Pro');

    await grant(d, 'u2', 'tok-pro-0000000000021', 'pro_cuet_2027');
    await grant(d, 'u2', 'tok-pro-0000000000022', 'pro_cuet_2027');
    const r2 = await revoke(d, 'tok-pro-0000000000021');
    assert.equal(r2.revoked.keptForOtherPaidAccess, true);
    assert.equal((await userRow(d, 'u2')).is_premium, true);
    await revoke(d, 'tok-pro-0000000000022');
    assert.equal((await userRow(d, 'u2')).is_premium, false, 'with the last one gone, Pro is off');
    // A failed or refunded web payment is not evidence.
    await d.query("insert into public.payments values ('p3','u3','pay_3',0,'cancelled',null)");
    await grant(d, 'u3', 'tok-pro-0000000000023', 'pro_cuet_2027');
    assert.equal((await revoke(d, 'tok-pro-0000000000023')).revoked.proSwitchedOff, true);
  } finally { await d.close(); }
});

test('SQL revoke, credit pack: purchased credits are clawed back, never below zero, and recorded', async () => {
  const d = await database();
  try {
    await grant(d, 'u1', 'tok-pack-000000000010', 'credits_10_50', { credits: 50 });
    const r = await revoke(d, 'tok-pack-000000000010');
    assert.deepEqual([r.revoked.clawedBack, r.revoked.shortfall], [50, 0]);
    assert.equal((await q(d, "select bonus_credits b from public.ai_credit_wallets where user_id='u1'"))[0].b, 0);
    const ledger = await q(d, "select amount, reason, feature from public.ai_credit_ledger where user_id='u1' order by created_at, amount");
    assert.deepEqual(ledger.map((l) => l.amount).sort((a, b) => a - b), [-50, 50]);
    assert.equal(ledger.find((l) => l.amount < 0).feature, 'play_refund');

    // 120 of 150 already spent: only the 30 left can be taken back, and the shortfall is recorded.
    await grant(d, 'u2', 'tok-pack-000000000011', 'credits_29_150', { credits: 150 });
    await d.query("update public.ai_credit_wallets set bonus_credits = 30 where user_id='u2'");
    const r2 = await revoke(d, 'tok-pack-000000000011');
    assert.deepEqual([r2.revoked.clawedBack, r2.revoked.shortfall], [30, 120]);
    assert.equal((await q(d, "select bonus_credits b from public.ai_credit_wallets where user_id='u2'"))[0].b, 0);

    // All spent: nothing to take, still voided, and no negative ledger row.
    await grant(d, 'u3', 'tok-pack-000000000012', 'credits_10_50', { credits: 50 });
    await d.query("update public.ai_credit_wallets set bonus_credits = 0 where user_id='u3'");
    const r3 = await revoke(d, 'tok-pack-000000000012');
    assert.deepEqual([r3.revoked.clawedBack, r3.revoked.shortfall], [0, 50]);
    assert.equal((await q(d, "select count(*)::int n from public.ai_credit_ledger where user_id='u3' and amount < 0"))[0].n, 0);
    assert.equal((await q(d, "select state from public.play_purchases where purchase_token='tok-pack-000000000012'"))[0].state, 'voided');
    assert.equal((await q(d, 'select count(*)::int n from public.ai_credit_wallets where bonus_credits < 0'))[0].n, 0);
  } finally { await d.close(); }
});

test('SQL privileges: server only. RLS on with no policy, no browser grant, functions executable by service_role alone', async () => {
  const d = await database();
  try {
    const rls = (await q(d, "select relrowsecurity r from pg_class where relname='play_purchases'"))[0].r;
    assert.equal(rls, true);
    assert.equal((await q(d, "select count(*)::int n from pg_policies where tablename='play_purchases'"))[0].n, 0);
    for (const fn of ['public.mm_play_grant_purchase(text,text,text,text,text,integer,timestamptz,jsonb)', 'public.mm_play_revoke_purchase(text,text,text,jsonb)']) {
      const g = await q(d, `select r.rolname, has_function_privilege(r.rolname, '${fn}', 'execute') ok from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`);
      assert.deepEqual(g, [{ rolname: 'anon', ok: false }, { rolname: 'authenticated', ok: false }, { rolname: 'service_role', ok: true }], fn);
    }
    const t = await q(d, `select r.rolname, has_table_privilege(r.rolname, 'public.play_purchases', 'select') s, has_table_privilege(r.rolname, 'public.play_purchases', 'insert') i from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`);
    assert.deepEqual(t, [{ rolname: 'anon', s: false, i: false }, { rolname: 'authenticated', s: false, i: false }, { rolname: 'service_role', s: true, i: true }]);
    assert.equal((await q(d, "select count(*)::int n from pg_proc where proname in ('mm_play_grant_purchase','mm_play_revoke_purchase') and prosecdef and proconfig::text like '%search_path=public, pg_temp%'"))[0].n, 2, 'security definer with a pinned search_path');
  } finally { await d.close(); }
});

test('the migration is idempotent; the undo drops the functions, keeps a table that holds purchases, drops an empty one', async () => {
  const d = await database();
  try {
    await d.exec(MIGRATION);
    await grant(d, 'u1', 'tok-pro-0000000000030', 'pro_cuet_2027');
    await d.exec(UNDO);
    assert.equal((await q(d, "select count(*)::int n from pg_proc where proname like 'mm_play_%'"))[0].n, 0, 'functions gone');
    assert.equal((await q(d, 'select count(*)::int n from public.play_purchases'))[0].n, 1, 'the purchase record is kept');
    assert.equal((await userRow(d, 'u1')).is_premium, true, 'what was granted stays');
    await d.exec('delete from public.play_purchases');
    await d.exec(UNDO);
    assert.equal((await q(d, "select to_regclass('public.play_purchases') t"))[0].t, null, 'an empty table is dropped');
    await d.exec(UNDO); // runs clean again
    await d.exec(MIGRATION); // and the migration comes back
    assert.equal((await grant(d, 'u2', 'tok-pro-0000000000031', 'pro_cuet_2027')).ok, true);
  } finally { await d.close(); }
});

// ---- the whole path: the billing core against the real SQL --------------------------------------------------------
test('end to end on the real SQL: verify grants Pro, a replay is idempotent, a void switches it off', async () => {
  const d = await database();
  try {
    const store = {
      getByToken: async (t) => (await q(d, 'select * from public.play_purchases where purchase_token=$1', [t]))[0] || null,
      grant: async (g) => (await q(d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8) r', [g.userId, g.purchaseToken, g.orderId, g.productId, g.kind, g.credits, g.accessUntil, g.raw]))[0].r,
      markFinished: async (t, { acknowledged, consumed }) => { await d.query('update public.play_purchases set acknowledged_at = case when $2 then now() else acknowledged_at end, consumed_at = case when $3 then now() else consumed_at end where purchase_token=$1', [t, Boolean(acknowledged), Boolean(consumed)]); },
      revoke: async (r) => (await q(d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4) r', [r.purchaseToken, r.reason, r.orderId, r.raw]))[0].r,
    };
    const google = fakeGoogle();
    const deps = { store, google, packageName: 'in.mockmob.app', now: () => Date.parse('2026-10-20T00:00:00Z'), log: quiet };
    google.products.set(TOKEN, purchaseFor('u4'));
    const first = await verifyPlayPurchase(deps, { userId: 'u4', productId: 'pro_cuet_2027', purchaseToken: TOKEN });
    assert.equal(first.ok, true);
    assert.equal(first.finished, true);
    assert.equal((await userRow(d, 'u4')).is_premium, true);
    const replay = await verifyPlayPurchase(deps, { userId: 'u4', productId: 'pro_cuet_2027', purchaseToken: TOKEN });
    assert.equal(replay.idempotent, true);
    assert.equal(replay.pro.premiumUntil, first.pro.premiumUntil);
    const thief = await verifyPlayPurchase(deps, { userId: 'u5', productId: 'pro_cuet_2027', purchaseToken: TOKEN });
    assert.equal(thief.code, 'purchase_already_used');
    const out = await handlePlayNotification({ store, packageName: 'in.mockmob.app', log: quiet }, voidedFor(TOKEN));
    assert.equal(out.action, 'revoked');
    assert.equal((await userRow(d, 'u4')).is_premium, false);

    // A credit pack the same way.
    const t2 = 'purchasetokenpurchasetoken0009';
    google.products.set(t2, purchaseFor('u6', 'ai_credits_prepos_50_400'));
    const pack = await verifyPlayPurchase(deps, { userId: 'u6', productId: 'ai_credits_prepos_50_400', purchaseToken: t2 });
    assert.deepEqual(pack.credits, { granted: 400, balance: 410 });
    assert.ok((await store.getByToken(t2)).consumed_at);
    assert.equal((await handlePlayNotification({ store, packageName: 'in.mockmob.app', log: quiet }, voidedFor(t2))).revoked.clawedBack, 400);
  } finally { await d.close(); }
});

// ---- wiring --------------------------------------------------------------------------------------------------------
test('the routes exist, are behind the flag, and the money route is not cookie-only or trusting', () => {
  for (const rel of ['src/app/api/billing/play/verify/route.js', 'src/app/api/billing/play/rtdn/route.js']) {
    const src = file(rel);
    for (const m of ['POST', 'GET', 'PUT', 'PATCH', 'DELETE']) assert.match(src, new RegExp(`export const ${m} = handle;`), `${rel} answers ${m} (404 when off)`);
  }
  const deps = file('src/lib/server/playBillingDeps.js');
  assert.match(deps, /auth: \(request\) => auth\(request\)/, 'the app signs in with a bearer token');
  assert.match(deps, /rateLimit: checkPersistentRateLimit/);
  assert.match(deps, /provider: 'google_play'/, 'RTDN dedupe rides on webhook_events');
  const http = file('src/lib/server/playBillingHttp.js');
  assert.ok(http.indexOf('deps.enabled()') < http.indexOf('deps.auth('), 'the flag is checked before anything else');
});

test('the Play tables are server only in the account deletion plan and the test is wired into test:billing', async () => {
  const { DELETION_STEPS } = await import('../../src/lib/server/accountDeletion.js');
  const step = DELETION_STEPS.find((s) => s.table === 'play_purchases');
  assert.equal(step.action, 'anonymise');
  assert.notEqual(step.action, 'delete', 'a purchase record is kept for the books');
  const pkg = JSON.parse(file('package.json'));
  assert.match(pkg.scripts['test:billing'], /data\/tests\/play_billing\.test\.mjs/);
});

test('data/db.js counts a Play Pro purchase as other paid access', () => {
  const src = file('data/db.js');
  assert.match(src, /async getPlayProAccess\(userId\)/);
  assert.match(src, /razorpayEvidence \|\| \(await this\.getPlayProAccess\(userId\)\)\.hasPlayPro/);
  assert.match(src, /const play = await this\.getPlayProAccess\(userId\);/);
  assert.match(src, /\.from\('play_purchases'\)/);
});

test('SQL revoke, Pro: a captured CREDIT-PACK payment is not Pro evidence; a captured Pro payment is (release 10 verifier M1)', async () => {
  const d = await database();
  try {
    await d.query("insert into public.payments values ('pc1','u4','pay_c1',4900,'captured',null,'credits_49_300')");
    await d.query("insert into public.payments values ('pc2','u4','pay_c2',1000,'captured',null,'ai_credits_prepos_10_50')");
    await grant(d, 'u4', 'tok-pro-0000000000040', 'pro_cuet_2027');
    const r = await revoke(d, 'tok-pro-0000000000040');
    assert.deepEqual([r.revoked.proSwitchedOff, r.revoked.keptForOtherPaidAccess], [true, false]);
    assert.equal((await userRow(d, 'u4')).is_premium, false, 'credit packs bought credits, not Pro');

    await d.query("insert into public.payments values ('pp5','u5','pay_p5',6900,'captured',null,'pro_monthly')");
    await grant(d, 'u5', 'tok-pro-0000000000050', 'pro_cuet_2027');
    const r5 = await revoke(d, 'tok-pro-0000000000050');
    assert.equal(r5.revoked.keptForOtherPaidAccess, true);
    assert.equal((await userRow(d, 'u5')).is_premium, true, 'a captured Pro payment keeps Pro');
  } finally { await d.close(); }
});

test('data/db.js counts only Pro plan payments as Pro evidence (release 10 verifier M1)', () => {
  const src = file('data/db.js');
  assert.match(src, /export const isProPlanPayment = \(row\) => \/\^pro_\/\.test\(String\(row\?\.plan_id \|\| ''\)\);/);
  assert.equal(src.match(/\.like\('plan_id', 'pro%'\)/g)?.length, 2, 'both readers ask only for Pro plan payments');
  assert.match(src, /const razorpayEvidence = \(data \|\| \[\]\)\.filter\(isProPlanPayment\)\.some/);
  assert.match(src, /if \(!isProPlanPayment\(row\)\) continue;/);
});
