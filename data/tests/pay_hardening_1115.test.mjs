// Payment hardening, 15 Nov 2026 (tmp/1115-prod/sec-money.md and the parent-pay lane's note):
//  1. Get Pro's own subscription carries Razorpay's expire_by, so an abandoned checkout does not stay open for ever.
//  2. A referral or creator code is read only from notes our server wrote, never from the payment's own (payer-set) notes.
//  3. /create-monthly-subscription, /verify-payment, /create-order and /create-subscription are under the same-origin rule.
// Real route handlers and the real proxy, in-memory database, Razorpay client with no network (data/tests/billing_harness.mjs).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBilling, resetWorld, TEST_ENV, subscriptionEntity, paymentEntity, signedWebhook, webhookEvent, hmac } from './billing_harness.mjs';
import { PARENT_LINK_LIFETIME_MS } from '../../src/lib/payments/parentPay.js';
import { referralAttributionFromCheckout } from '../../src/lib/payments/entitlements.js';
import { allowedWriteOrigin, ROOT_WRITE_PATHS } from '../../src/lib/server/sameOriginWrite.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sec = (ms) => Math.floor(ms / 1000);
let db;
let b;
let parent;

const post = (handler, body = {}) => handler.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const signIn = (id) => { globalThis.__mmSession = { user: { id } }; };
const getPro = async (id = 'u1') => { const res = await post(b.create, { userId: id, planId: 'pro_monthly_99' }); return { status: res.status, json: await res.json() }; };
const creates = () => b.rz.calls.filter((c) => c[0] === 'subscriptions.create');

let wrapped = false;
beforeEach(async () => {
  b = await loadBilling();
  parent ||= await import(pathToFileURL(resolve(root, 'src/app/api/billing/parent-link/route.js')).href);
  if (!wrapped) {
    // As Razorpay does: the new subscription echoes expire_by and has a hosted page, and can be fetched, still 'created'.
    const client = b.razorpay.getRazorpayClient();
    const baseCreate = client.subscriptions.create;
    client.subscriptions.create = async (payload) => {
      const sub = await baseCreate(payload);
      Object.assign(sub, { short_url: `https://rzp.io/i/${sub.id}`, ...(payload.expire_by ? { expire_by: payload.expire_by } : {}) });
      b.rz.subscriptions.set(sub.id, { ...sub });
      return sub;
    };
    wrapped = true;
  }
  db = resetWorld();
  b.rz.invoices.clear(); b.rz.subscriptions.clear(); b.rz.payments.clear(); b.rz.calls.length = 0; b.rz.created.length = 0;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_ENV.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
  delete process.env.PARENT_PAY_ENABLED;
});

// ================================================================ 1. expire_by on Get Pro's subscription

test('1: Get Pro\'s subscription stops taking its first payment within the day, the same expire_by the parent link uses', async () => {
  db.addUser('u1');
  signIn('u1');
  const before = Date.now();
  const res = await getPro();
  assert.equal(res.status, 200);
  const [, payload] = creates()[0];
  assert.ok(Number.isInteger(payload.expire_by), 'expire_by is set');
  assert.ok(payload.expire_by >= sec(before + PARENT_LINK_LIFETIME_MS) && payload.expire_by <= sec(Date.now() + PARENT_LINK_LIFETIME_MS));
  // The response shape the web page reads is unchanged.
  assert.deepEqual(Object.keys(res.json).sort(), ['keyId', 'plan', 'referral', 'subscription']);
});

test('1: a second Get Pro tap still hands back the open checkout, and a parent link hands back that same one', async () => {
  db.addUser('u1');
  signIn('u1');
  const first = await getPro();
  const second = await getPro();
  assert.equal(second.json.subscription.id, first.json.subscription.id);
  assert.equal(second.json.reused, true);
  const res = await post(parent, {});
  const link = await res.json();
  assert.equal(res.status, 200);
  assert.equal(link.url, `https://rzp.io/i/${first.json.subscription.id}`, 'one open checkout for the student and the parent');
  assert.equal(link.reused, true);
  assert.equal(creates().length, 1);
});

test('1: an open checkout about to stop taking payments is not handed back; one with no expiry (made before) still is', async () => {
  db.addUser('u1');
  signIn('u1');
  await getPro();
  b.rz.subscriptions.set('sub_new_1', { ...b.rz.subscriptions.get('sub_new_1'), expire_by: sec(Date.now() + 5 * 60_000) });
  const next = await getPro();
  assert.equal(next.json.subscription.id, 'sub_new_2', 'a fresh checkout instead of one that closes in five minutes');
  assert.equal(next.json.reused, undefined);

  db = resetWorld();
  db.addUser('u1');
  signIn('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_legacy', planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, status: 'created', createdAt: Date.now() - 3600_000 });
  b.rz.subscriptions.set('sub_legacy', { id: 'sub_legacy', status: 'created', plan_id: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 });
  const legacy = await getPro();
  assert.equal(legacy.json.subscription.id, 'sub_legacy');
  assert.equal(legacy.json.reused, true);
});

// ================================================================ 2. referral attribution only from server-set data

test('2: payer-set notes on the payment, the stored payment or the invoice never name a referrer', () => {
  const forged = { creatorCode: 'evil10', creatorId: 'crt_evil', referralCodeAttempted: 'evil10', referralStatus: 'offer_attached', offerId: 'offer_evil' };
  const got = referralAttributionFromCheckout({
    paymentRecord: { amount: 9900, rawPayment: { notes: forged }, rawSubscription: { notes: { userId: 'u1', planId: 'pro_monthly_99' } } },
    payment: { notes: forged },
    invoice: { notes: forged },
    subscription: { notes: { userId: 'u1', planId: 'pro_monthly_99' } },
  });
  assert.deepEqual(got, { creatorCode: null, creatorId: null, offerId: null, referralCodeAttempted: null, referralStatus: null });
});

test('2: notes our server wrote on the order or the subscription, and our own row, still attribute', () => {
  const forged = { creatorCode: 'evil10', creatorId: 'crt_evil' };
  const fromOrder = referralAttributionFromCheckout({
    paymentRecord: { rawOrder: { notes: { creatorCode: 'asha10', creatorId: 'crt_asha', referralStatus: 'tracked_no_offer' } } },
    payment: { notes: forged },
  });
  assert.deepEqual([fromOrder.creatorCode, fromOrder.creatorId, fromOrder.referralStatus], ['asha10', 'crt_asha', 'tracked_no_offer']);
  const fromSubscription = referralAttributionFromCheckout({ subscription: { notes: { creatorCode: 'asha10', creatorId: 'crt_asha' } }, payment: { notes: forged } });
  assert.deepEqual([fromSubscription.creatorCode, fromSubscription.creatorId], ['asha10', 'crt_asha']);
  const fromRow = referralAttributionFromCheckout({ paymentRecord: { creatorCode: 'asha10', creatorId: 'crt_asha' }, payment: { notes: forged } });
  assert.deepEqual([fromRow.creatorCode, fromRow.creatorId], ['asha10', 'crt_asha']);
});

const forgedPayment = () => paymentEntity({ notes: { userId: 'u1', planId: 'pro_monthly_99', creatorCode: 'evil10', creatorId: 'crt_evil', referralStatus: 'tracked_no_offer' } });

test('2: /verify-payment with a payer-edited note grants Pro but credits no creator', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  signIn('u1');
  b.rz.payments.set('pay_m1', forgedPayment());
  b.rz.subscriptions.set('sub_m1', subscriptionEntity());
  const res = await post(b.verify, {
    razorpay_subscription_id: 'sub_m1', razorpay_payment_id: 'pay_m1', userId: 'u1',
    razorpay_signature: hmac('pay_m1|sub_m1', TEST_ENV.RAZORPAY_KEY_SECRET),
  });
  assert.equal(res.status, 200);
  assert.equal(db.user('u1').isPremium, true);
  const row = db.payment('sub_m1');
  assert.equal(row.status, 'captured');
  assert.equal(row.creatorId ?? null, null);
  assert.equal(row.creatorCode ?? null, null);
  assert.equal(row.referralCodeAttempted ?? null, null);
});

test('2: a webhook charge with a payer-edited note credits no creator', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  const subscription = subscriptionEntity();
  b.rz.subscriptions.set('sub_m1', subscription);
  const { request } = signedWebhook(webhookEvent('subscription.charged', { subscription, payment: forgedPayment() }));
  const res = await b.webhook.POST(request);
  assert.equal(res.status, 200);
  assert.equal(db.user('u1').isPremium, true);
  const row = db.payment('sub_m1');
  assert.equal(row.creatorId ?? null, null);
  assert.equal(row.creatorCode ?? null, null);
});

// ================================================================ 3. the same-origin rule on the payment writes outside /api

test('3: the origin rule covers the payment writes outside /api, and leaves Razorpay\'s webhook alone', () => {
  const prod = { NODE_ENV: 'production' };
  const check = (pathname, origin, over = {}) => allowedWriteOrigin({ method: 'POST', pathname, origin, host: 'www.mockmob.in', env: prod, ...over });
  assert.deepEqual([...ROOT_WRITE_PATHS].sort(), ['/create-monthly-subscription', '/create-order', '/create-subscription', '/verify-payment']);
  for (const path of ROOT_WRITE_PATHS) {
    assert.equal(check(path, 'https://evil.example'), false, path);
    assert.equal(check(path, 'null'), false, `${path} from a sandboxed frame`);
    assert.equal(check(path, 'https://www.mockmob.in'), true, `${path} from our page`);
    assert.equal(check(path, null), true, `${path} with no Origin (a server call)`);
    assert.equal(check(path, 'https://localhost', { appOrigin: true }), true, `${path} from the app shell`);
    assert.equal(check(path, 'https://evil.example', { method: 'GET' }), true, 'reads are not this rule\'s business');
  }
  assert.equal(check('/webhook', 'https://evil.example'), true, 'the webhook is checked by its signature, not here');
  assert.equal(check('/verify-payment-x', 'https://evil.example'), true, 'exact paths only');
});

async function proxyCall(path, { method = 'POST', headers = {}, body = '{}' } = {}) {
  const { proxy } = await import(pathToFileURL(resolve(root, 'src/proxy.js')).href);
  const { NextRequest } = await import('next/server.js');
  const request = new NextRequest(`https://www.mockmob.in${path}`, { method, headers: { host: 'www.mockmob.in', 'content-type': 'application/json', ...headers }, body: method === 'GET' ? undefined : body });
  return proxy(request);
}
const passed = (res) => res.status === 200 && res.headers.get('x-middleware-next') === '1';

test('3: the proxy refuses a cross-site post to Get Pro\'s checkout and to /verify-payment, and lets our page, the app and Razorpay through', async () => {
  for (const path of ['/create-monthly-subscription', '/verify-payment', '/create-order', '/create-subscription']) {
    const refused = await proxyCall(path, { headers: { origin: 'https://evil.example', cookie: 'sb-x-auth-token=abc' } });
    assert.equal(refused.status, 403, path);
    assert.deepEqual(await refused.json(), { error: 'Forbidden', code: 'cross_site_request' });
    assert.equal(refused.headers.get('cache-control'), 'no-store');
    assert.ok(passed(await proxyCall(path, { headers: { origin: 'https://www.mockmob.in' } })), `${path} from our own page`);
    assert.ok(passed(await proxyCall(path)), `${path} with no Origin`);
    assert.ok(passed(await proxyCall(path, { headers: { origin: 'capacitor://localhost', authorization: 'Bearer token' } })), `${path} from the app shell`);
  }
  assert.ok(passed(await proxyCall('/webhook', { headers: { 'x-razorpay-signature': 'sig' } })), 'Razorpay\'s webhook');
  assert.ok(passed(await proxyCall('/webhook', { headers: { origin: 'https://evil.example', 'x-razorpay-signature': 'sig' } })), 'the webhook is not under the rule');
  assert.ok(passed(await proxyCall('/pricing', { method: 'GET', headers: { origin: 'https://evil.example' } })), 'pages are untouched');
});
