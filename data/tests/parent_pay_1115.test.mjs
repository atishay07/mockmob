// "Ask a parent to pay" (lane F-B, 15 Nov 2026): the student's monthly Pro checkout as Razorpay's own hosted link
// (short_url), paid by a parent who is not signed in, and granted by the existing webhook to the student who made it.
// Real route handlers, in-memory database, Razorpay client with no network (data/tests/billing_harness.mjs).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadBilling, resetWorld, TEST_ENV, subscriptionEntity, paymentEntity, signedWebhook, webhookEvent, DAY, FAR_ONE_TIME_UNTIL, iso } from './billing_harness.mjs';
import {
  PARENT_LINK_LIFETIME_MS, PARENT_LINK_LIMIT, PARENT_PAY_DEFAULT, hostedLinkOf, linkExpiresAt, parentPayEnabled,
  parentPayOffered, shareableOpenCheckout,
} from '../../src/lib/payments/parentPay.js';
import { publicOffer } from '../../src/lib/payments/offer.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sec = (ms) => Math.floor(ms / 1000);
let db;
let b;
let parent;

const post = (handler, body = {}) => handler.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const signIn = (id) => { globalThis.__mmSession = { user: { id } }; };
const ask = async (body = {}) => { const res = await post(parent, body); return { status: res.status, json: await res.json() }; };
const getPro = async (id = 'u1') => { const res = await post(b.create, { userId: id, planId: 'pro_monthly_99' }); return { status: res.status, json: await res.json() }; };
const creates = () => b.rz.calls.filter((c) => c[0] === 'subscriptions.create');

async function fire(name, parts) {
  const { request } = signedWebhook(webhookEvent(name, parts));
  const response = await b.webhook.POST(request);
  return { status: response.status, json: await response.json() };
}

let wrapped = false;
beforeEach(async () => {
  b = await loadBilling();
  parent ||= await import(pathToFileURL(resolve(root, 'src/app/api/billing/parent-link/route.js')).href);
  if (!wrapped) {
    // Razorpay answers every subscriptions.create with the subscription's hosted page (short_url) and echoes expire_by; the
    // new subscription can then be fetched, still 'created', as Razorpay would.
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
  b.rz.rejectCancel = null; b.rz.rejectCancelIds.clear(); b.rz.failNextInvoiceFetch = false;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_ENV.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
  delete process.env.PARENT_PAY_ENABLED;
});

// ================================================================ the link

test('a signed-in Free student gets Razorpay\'s own hosted link for a new monthly checkout, made exactly as Get Pro makes one', async () => {
  db.addUser('u1', { name: 'Asha Verma', email: 'asha.v@example.test' });
  signIn('u1');
  const before = Date.now();
  const res = await ask();
  assert.equal(res.status, 200);
  assert.equal(res.json.url, 'https://rzp.io/i/sub_new_1', 'the subscription\'s short_url, untouched');
  assert.equal(res.json.amount, 9900);
  assert.equal(res.json.interval, 'month');
  assert.equal(res.json.firstName, 'Asha');
  assert.equal(res.json.reused, false);
  const expires = Date.parse(res.json.expiresAt);
  assert.ok(expires >= before + PARENT_LINK_LIFETIME_MS - 2000 && expires <= Date.now() + PARENT_LINK_LIFETIME_MS, 'it stops taking payments before the day ends');
  assert.ok(expires < before + 24 * 3600_000);

  // The same subscription Get Pro makes, plus only the link's expiry.
  const [, parentPayload] = creates()[0];
  db = resetWorld(); db.addUser('u1'); signIn('u1');
  await getPro();
  const [, getProPayload] = creates()[1];
  const { expire_by: expireBy, ...rest } = parentPayload;
  assert.ok(Number.isInteger(expireBy));
  assert.deepEqual(rest, getProPayload);
  assert.deepEqual(rest.notes, { kind: 'monthly_subscription', userId: 'u1', planId: 'pro_monthly_99' });
});

test('our row for the subscription names the student, the plan and the full price, all set by the server', async () => {
  db.addUser('u1');
  signIn('u1');
  await ask();
  const row = db.payment('sub_new_1');
  assert.deepEqual([row.userId, row.planId, row.amount, row.razorpayPlanId, row.status], ['u1', 'pro_monthly_99', 9900, TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, 'created']);
});

test('nothing in the request is read: not an account, a plan, an amount or a code', async () => {
  db.addUser('u1');
  db.addUser('u2');
  signIn('u1');
  const res = await ask({ userId: 'u2', planId: 'pro_cuet_2027', amount: 100, code: 'asha10', notes: { userId: 'u2' } });
  assert.equal(res.status, 200);
  const [, payload] = creates()[0];
  assert.equal(payload.plan_id, TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99);
  assert.deepEqual(payload.notes, { kind: 'monthly_subscription', userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(db._payments.length, 1);
  assert.equal(db._payments[0].userId, 'u1');
  assert.equal(db._payments[0].amount, 9900);
});

test('a second ask hands back the same link, and Get Pro then hands back that same checkout (one open checkout)', async () => {
  db.addUser('u1');
  signIn('u1');
  const first = await ask();
  const second = await ask();
  assert.equal(second.status, 200);
  assert.equal(second.json.url, first.json.url);
  assert.equal(second.json.reused, true);
  assert.equal(second.json.expiresAt, first.json.expiresAt);
  const pro = await getPro();
  assert.equal(pro.status, 200);
  assert.equal(pro.json.subscription.id, 'sub_new_1');
  assert.equal(pro.json.reused, true);
  assert.equal(creates().length, 1);
  assert.equal(db._payments.length, 1);
});

test('an open Get Pro checkout, whose link never expires, is not sent to a parent: a fresh expiring one is, and Get Pro moves to it', async () => {
  db.addUser('u1');
  signIn('u1');
  const pro = await getPro();
  assert.equal(pro.json.subscription.id, 'sub_new_1');
  assert.equal(b.rz.subscriptions.get('sub_new_1').expire_by, undefined);
  const res = await ask();
  assert.equal(res.status, 200);
  assert.equal(res.json.url, 'https://rzp.io/i/sub_new_2');
  assert.ok(res.json.expiresAt);
  // The next Get Pro tap hands back the newest open checkout, the parent's, so a parent and a student pay the same one.
  db._payments.find((p) => p.subscriptionId === 'sub_new_2').createdAt += 1;
  const again = await getPro();
  assert.equal(again.json.subscription.id, 'sub_new_2');
  assert.equal(creates().length, 2);
});

test('a link with under 15 minutes left is not handed out again; a fresh one is', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_old', planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, status: 'created', createdAt: Date.now() - 23.7 * 3600_000 });
  b.rz.subscriptions.set('sub_old', { id: 'sub_old', status: 'created', plan_id: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, short_url: 'https://rzp.io/i/old', expire_by: sec(Date.now() + 10 * 60_000) });
  signIn('u1');
  const res = await ask();
  assert.equal(res.status, 200);
  assert.equal(res.json.url, 'https://rzp.io/i/sub_new_1');
});

test('a payment already made on the open checkout is never doubled by a new link', async () => {
  db.addUser('u1');
  signIn('u1');
  await ask();
  b.rz.subscriptions.set('sub_new_1', { ...b.rz.subscriptions.get('sub_new_1'), status: 'authenticated' });
  const res = await ask();
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'subscription_open');
  assert.match(res.json.error, /being confirmed/);
  assert.equal(creates().length, 1);
});

test('refused, with nothing made at Razorpay: signed out, switched off, monthly not on sale, or already Pro', async () => {
  db.addUser('u1');
  assert.equal((await ask()).status, 401);

  signIn('u1');
  process.env.PARENT_PAY_ENABLED = 'false';
  const off = await ask();
  assert.deepEqual([off.status, off.json.code], [404, 'parent_pay_off']);
  delete process.env.PARENT_PAY_ENABLED;

  delete process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
  const closed = await ask();
  assert.deepEqual([closed.status, closed.json.code], [409, 'monthly_not_ready']);
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;

  db.addUser('u9', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  signIn('u9');
  const pro = await ask();
  assert.deepEqual([pro.status, pro.json.code], [409, 'already_active']);
  assert.match(pro.json.error, /^Pro access is already active on this account through 31 July 2027\.$/);

  assert.equal(creates().length, 0);
  assert.equal(db._payments.length, 0);
});

test('a link that is missing or not on a Razorpay host is never sent', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_odd', planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, status: 'created', createdAt: Date.now() - 3600_000 });
  b.rz.subscriptions.set('sub_odd', { id: 'sub_odd', status: 'created', plan_id: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, short_url: 'https://rzp.io.evil.example/i/x', expire_by: sec(Date.now() + 20 * 3600_000) });
  signIn('u1');
  const res = await ask();
  assert.deepEqual([res.status, res.json.code], [502, 'link_missing']);
  assert.equal(res.json.url, undefined);
});

test('Razorpay refusing the subscription writes nothing and says nothing was charged', async () => {
  db.addUser('u1');
  signIn('u1');
  const client = b.razorpay.getRazorpayClient();
  const create = client.subscriptions.create;
  client.subscriptions.create = async () => { throw { error: { description: 'The plan id is invalid' } }; };
  try {
    const res = await ask();
    assert.deepEqual([res.status, res.json.code], [400, 'razorpay_rejected']);
    assert.equal(res.json.error, 'Razorpay could not make the link just now. Try again in a minute. Nothing was charged.', 'Razorpay\'s own text is not shown to the student');
    assert.equal(db._payments.length, 0);
  } finally {
    client.subscriptions.create = create;
  }
});

// ================================================================ the grant: the existing webhook, no new code

test('a parent who is not signed in pays on the hosted page: subscription.charged grants Pro to the student who made the link', async () => {
  db.addUser('u1');
  db.addUser('u2');
  signIn('u1');
  await ask();
  globalThis.__mmSession = null; // the parent's phone has no session of ours, and the webhook never reads one
  const paidSub = subscriptionEntity({ id: 'sub_new_1', notes: { kind: 'monthly_subscription', userId: 'u1', planId: 'pro_monthly_99' } });
  b.rz.subscriptions.set('sub_new_1', paidSub);
  // Razorpay's hosted page lets the payer write notes: they name someone else, and are never read.
  const res = await fire('subscription.charged', { subscription: paidSub, payment: paymentEntity({ id: 'pay_parent', invoice_id: 'inv_parent', method: 'upi', notes: { userId: 'u2', planId: 'pro_cuet_2027' } }) });
  assert.equal(res.status, 200);
  // The student's next visit reads the same entitlement as every page (Database.getUserById, effectivePremiumFromRow).
  const user = await db.getUserById('u1');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
  assert.equal(user.razorpaySubscriptionId, 'sub_new_1', 'so Cancel in Account stops this plan');
  assert.ok(Date.parse(user.premiumUntil) > Date.now() + 25 * DAY);
  assert.equal((await db.getUserById('u2')).isPremium, false);
  const row = db.payment('sub_new_1');
  assert.deepEqual([row.status, row.paymentId, row.amountPaid], ['captured', 'pay_parent', 9900]);

  // Afterwards the student is told Pro is on, and no second checkout can start.
  signIn('u1');
  assert.equal((await ask()).json.code, 'already_active');
  assert.equal((await getPro()).json.code, 'already_active');
  assert.equal(creates().length, 1);
});

test('the same payment arriving only as payment.captured (through its invoice) grants it too, once', async () => {
  db.addUser('u1');
  signIn('u1');
  await ask();
  globalThis.__mmSession = null;
  b.rz.subscriptions.set('sub_new_1', subscriptionEntity({ id: 'sub_new_1' }));
  b.rz.invoices.set('inv_parent', { id: 'inv_parent', entity: 'invoice', subscription_id: 'sub_new_1' });
  const payment = paymentEntity({ id: 'pay_parent', invoice_id: 'inv_parent', order_id: 'order_parent' });
  await fire('payment.captured', { payment });
  assert.equal((await db.getUserById('u1')).isPremium, true);
  const until = db.user('u1').premiumUntil;
  await fire('subscription.charged', { subscription: subscriptionEntity({ id: 'sub_new_1' }), payment });
  assert.equal(db.user('u1').premiumUntil, until, 'the second event for the same payment changes nothing');
});

test('a hosted payment of the wrong amount grants nothing', async () => {
  db.addUser('u1');
  signIn('u1');
  await ask();
  const sub = subscriptionEntity({ id: 'sub_new_1' });
  b.rz.subscriptions.set('sub_new_1', sub);
  await fire('subscription.charged', { subscription: sub, payment: paymentEntity({ id: 'pay_low', invoice_id: 'inv_low', amount: 100 }) });
  assert.equal(db.user('u1').isPremium, false);
});

test('Get Pro\'s own route keeps its answers after the move to the shared checkout', async () => {
  db.addUser('u1');
  signIn('u1');
  const first = await getPro();
  assert.equal(first.status, 200);
  assert.deepEqual(Object.keys(first.json).sort(), ['keyId', 'plan', 'referral', 'subscription']);
  assert.deepEqual(first.json.subscription, { id: 'sub_new_1', status: 'created' });
  assert.equal(first.json.referral, null);
  assert.equal(creates()[0][1].expire_by, undefined, 'Get Pro\'s subscription is unchanged: no expiry');
  const second = await getPro();
  assert.deepEqual(Object.keys(second.json).sort(), ['keyId', 'plan', 'referral', 'reused', 'subscription']);
});

// ================================================================ the switch, the limiter and the link checks

test('PARENT_PAY_ENABLED: unset is the default, "true" is on, any other value is off; the key needs monthly Pro on sale', () => {
  assert.equal(parentPayEnabled({}), PARENT_PAY_DEFAULT);
  assert.equal(parentPayEnabled({ PARENT_PAY_ENABLED: '' }), PARENT_PAY_DEFAULT);
  assert.equal(parentPayEnabled({ PARENT_PAY_ENABLED: 'true' }), true);
  assert.equal(parentPayEnabled({ PARENT_PAY_ENABLED: 'false' }), false);
  assert.equal(parentPayEnabled({ PARENT_PAY_ENABLED: 'off' }), false);
  const monthly = { purchasable: 'monthly', monthly: { ready: true } };
  const once = { purchasable: 'one_time', monthly: { ready: false } };
  assert.equal(parentPayOffered(monthly, { PARENT_PAY_ENABLED: 'true' }), true);
  assert.equal(parentPayOffered(once, { PARENT_PAY_ENABLED: 'true' }), false);
  assert.equal(parentPayOffered(monthly, { PARENT_PAY_ENABLED: 'false' }), false);
  // The offer every page reads carries it, so the signed-in shell's Pro sheet knows without a second switch.
  const before = process.env.PARENT_PAY_ENABLED;
  try {
    process.env.PARENT_PAY_ENABLED = 'true';
    assert.equal(publicOffer().parentPay, true, 'monthly is on sale in this suite');
    process.env.PARENT_PAY_ENABLED = 'false';
    assert.equal(publicOffer().parentPay, false);
    process.env.PARENT_PAY_ENABLED = 'true';
    delete process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
    assert.equal(publicOffer().parentPay, false, 'never while monthly Pro is not on sale');
  } finally {
    process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
    if (before === undefined) delete process.env.PARENT_PAY_ENABLED; else process.env.PARENT_PAY_ENABLED = before;
  }
});

test('the limit is per student, kept in the database, with the in-memory limit only when the database cannot answer', () => {
  assert.equal(PARENT_LINK_LIMIT.persistent, true);
  assert.equal(PARENT_LINK_LIMIT.fallback, 'memory');
  assert.equal(PARENT_LINK_LIMIT.identityOnly, true);
  assert.ok(PARENT_LINK_LIMIT.limit > 0 && PARENT_LINK_LIMIT.limit <= 10);
  const src = readFileSync(resolve(root, 'src/app/api/billing/parent-link/route.js'), 'utf8');
  assert.match(src, /checkPersistentRateLimit\(request, \{ \.\.\.PARENT_LINK_LIMIT, keyParts: \[userId\] \}\)/);
  // The route reads no request body at all.
  assert.doesNotMatch(src, /request\.json\(|request\.text\(|formData\(/);
});

test('only an https link on a Razorpay host is passed on', () => {
  assert.equal(hostedLinkOf({ short_url: 'https://rzp.io/i/AbC12' }), 'https://rzp.io/i/AbC12');
  assert.equal(hostedLinkOf({ short_url: 'https://pages.razorpay.com/x' }), 'https://pages.razorpay.com/x');
  for (const bad of ['http://rzp.io/i/x', 'https://rzp.io.evil.example/i/x', 'https://evilrzp.io/i/x', 'https://user:pw@rzp.io/i/x', 'javascript:alert(1)', '', null]) {
    assert.equal(hostedLinkOf({ short_url: bad }), null, String(bad));
  }
  assert.equal(linkExpiresAt({ expire_by: 1763300000 }), new Date(1763300000 * 1000).toISOString());
  assert.equal(linkExpiresAt({}), null);
  const now = Date.now();
  assert.equal(shareableOpenCheckout({ expire_by: sec(now + 20 * 3600_000) }, { rowCreatedAt: now - 3600_000, reuseWindowMs: DAY, nowMs: now }), true);
  assert.equal(shareableOpenCheckout({}, { rowCreatedAt: now - 3600_000, reuseWindowMs: DAY, nowMs: now }), false, 'no expiry');
  assert.equal(shareableOpenCheckout({ expire_by: sec(now + 5 * DAY) }, { rowCreatedAt: now - 3600_000, reuseWindowMs: DAY, nowMs: now }), false, 'payable after its checkout stops being handed back');
  assert.equal(shareableOpenCheckout({ expire_by: sec(now + 60_000) }, { rowCreatedAt: now - 3600_000, reuseWindowMs: DAY, nowMs: now }), false, 'about to expire');
  assert.ok(iso(now));
});
