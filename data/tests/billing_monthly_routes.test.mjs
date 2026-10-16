// Monthly Pro routes: starting a subscription, verifying the first payment, and cancelling renewal.
// Real route handlers, in-memory database, Razorpay client with no network.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadBilling, resetWorld, hmac, TEST_ENV, subscriptionEntity, paymentEntity, DAY, FAR_ONE_TIME_UNTIL, iso } from './billing_harness.mjs';

let db;
let b;
const post = (handler, body) => handler.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const signIn = (id) => { globalThis.__mmSession = { user: { id } }; };

beforeEach(async () => {
  b = await loadBilling();
  db = resetWorld();
  b.rz.subscriptions.clear(); b.rz.payments.clear(); b.rz.calls.length = 0; b.rz.created.length = 0; b.rz.rejectCancel = null;
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
});

// ---------------------------------------------------------------- create-monthly-subscription

test('checkout creation: signed out is refused, and nothing is sold until the Razorpay plan ID exists', async () => {
  db.addUser('u1');
  assert.equal((await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' })).status, 401);
  signIn('u1');
  delete process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
  const closed = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(closed.status, 409);
  assert.equal((await closed.json()).code, 'monthly_not_ready');
  assert.equal(b.rz.created.length, 0, 'no subscription was created at Razorpay');
});

test('checkout creation: another user, a wrong plan or a wrong amount is refused', async () => {
  db.addUser('u1'); db.addUser('u2');
  signIn('u1');
  assert.equal((await post(b.create, { userId: 'u2', planId: 'pro_monthly_99' })).status, 403);
  assert.equal((await post(b.create, { userId: 'u1', planId: 'pro_monthly' })).status, 409, 'the old Rs 69 plan is never sold');
  assert.equal((await post(b.create, { userId: 'u1', planId: 'pro_cuet_2027' })).status, 409, 'one-time plans do not go through the subscription route');
  assert.equal((await post(b.create, { userId: 'u1', planId: 'pro_monthly_99', amount: 1 })).status, 400);
  assert.equal(b.rz.created.length, 0);
});

test('checkout creation: a free student gets a Rs 99 monthly subscription on the configured plan, recorded as created', async () => {
  db.addUser('u1');
  signIn('u1');
  const res = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99', amount: 9900 });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.keyId, TEST_ENV.RAZORPAY_KEY_ID);
  assert.equal(json.plan.amount, 9900);
  const [call] = b.rz.calls.filter((c) => c[0] === 'subscriptions.create');
  assert.equal(call[1].plan_id, TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99);
  assert.equal(call[1].total_count, 24);
  assert.equal(call[1].notes.userId, 'u1');
  assert.equal(call[1].notes.planId, 'pro_monthly_99');
  const record = db.payment(json.subscription.id);
  assert.equal(record.status, 'created');
  assert.equal(record.amount, 9900);
  assert.equal(db.user('u1').isPremium, false, 'creating a checkout grants nothing');
});

test('checkout creation: a one-time Pro holder is told their access stands, with the date, and no subscription is made', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  signIn('u1');
  const res = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.code, 'already_active');
  assert.match(json.error, /through 31 July 2027/, 'the end date, in India time');
  assert.equal(b.rz.created.length, 0);
});

test('checkout creation: a student whose earlier monthly plan is still open at Razorpay is not given a second one', async () => {
  db.addUser('u1', { subscription_status: 'past_due', razorpay_subscription_id: 'sub_old', premium_until: iso(Date.now() - 2 * DAY) });
  signIn('u1');
  b.rz.subscriptions.set('sub_old', subscriptionEntity({ id: 'sub_old', status: 'pending' }));
  const blocked = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'subscription_open');
  assert.equal(b.rz.created.length, 0);

  b.rz.subscriptions.set('sub_old', subscriptionEntity({ id: 'sub_old', status: 'halted' }));
  assert.equal((await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' })).status, 200, 'a halted plan no longer charges, so a new one may start');
});

// ---------------------------------------------------------------- verify-payment (subscription)

function seedCheckout() {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
}
const verifyBody = (over = {}) => ({
  razorpay_subscription_id: 'sub_m1', razorpay_payment_id: 'pay_m1', userId: 'u1',
  razorpay_signature: hmac('pay_m1|sub_m1', TEST_ENV.RAZORPAY_KEY_SECRET), ...over,
});

test('verify: a valid signature and a captured Rs 99 payment turn Pro on and attach the subscription to the account', async () => {
  seedCheckout(); signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity());
  b.rz.subscriptions.set('sub_m1', subscriptionEntity());
  const res = await post(b.verify, verifyBody());
  assert.equal(res.status, 200);
  const user = db.user('u1');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
  assert.equal(user.razorpaySubscriptionId, 'sub_m1');
  assert.equal(db.payment('sub_m1').status, 'captured');
});

test('verify: a wrong signature grants nothing, and never rewrites a subscription that already paid', async () => {
  seedCheckout(); signIn('u1');
  const bad = verifyBody({ razorpay_signature: hmac('pay_m1|sub_m1', 'wrong_secret') });
  assert.equal((await post(b.verify, bad)).status, 400);
  assert.equal(db.user('u1').isPremium, false);
  assert.equal(db.payment('sub_m1').status, 'failed', 'an unpaid checkout is marked failed');

  db = resetWorld();
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: iso(Date.now() + 10 * DAY), razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: iso(Date.now() + 10 * DAY) });
  signIn('u1');
  assert.equal((await post(b.verify, bad)).status, 400);
  assert.equal(db.payment('sub_m1').status, 'captured', 'paid evidence survives a forged call');
  assert.equal(db.user('u1').isPremium, true);
});

test('verify: another student cannot verify this subscription, and a wrong amount grants nothing', async () => {
  seedCheckout(); db.addUser('u2'); signIn('u2');
  assert.equal((await post(b.verify, verifyBody({ userId: 'u2' }))).status, 404);
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity({ amount: 100 }));
  b.rz.subscriptions.set('sub_m1', subscriptionEntity());
  assert.equal((await post(b.verify, verifyBody())).status, 400);
  assert.equal(db.user('u1').isPremium, false);
});

test('verify: a payment that is authorised but not captured yet is "being confirmed", not a failure, and writes nothing', async () => {
  seedCheckout(); signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity({ status: 'authorized' }));
  b.rz.subscriptions.set('sub_m1', subscriptionEntity());
  const res = await post(b.verify, verifyBody());
  assert.equal(res.status, 202);
  const json = await res.json();
  assert.equal(json.pending, true);
  assert.equal(db.payment('sub_m1').status, 'created', 'the record is untouched, so the webhook can still grant');
});

// ---------------------------------------------------------------- cancel renewal

function seedActiveSubscriber(userRow = {}) {
  const until = iso(Date.now() + 12 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_m1', ...userRow });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: until });
  return until;
}
const cancelRequest = () => b.cancel.POST(new Request('http://localhost/api/billing/cancel', { method: 'POST' }));

test('cancel: stops renewal at the end of the paid month, keeps Pro to that date and says so', async () => {
  const until = seedActiveSubscriber(); signIn('u1');
  const res = await cancelRequest();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.match(json.message, /Renewals are cancelled\. Pro stays active until /);
  assert.deepEqual(b.rz.calls.filter((c) => c[0] === 'subscriptions.cancel'), [['subscriptions.cancel', 'sub_m1', true]], 'cancel at cycle end');
  const user = db.user('u1');
  assert.equal(user.subscriptionStatus, 'cancelled', 'Account shows renewal off right away');
  assert.equal(user.isPremium, true);
  assert.equal(user.premiumUntil, until);
});

test('cancel: asking twice does not send a second cancel to Razorpay', async () => {
  seedActiveSubscriber(); signIn('u1');
  await cancelRequest();
  const again = await cancelRequest();
  assert.equal(again.status, 200);
  assert.equal((await again.json()).alreadyCancelled, true);
  assert.equal(b.rz.calls.filter((c) => c[0] === 'subscriptions.cancel').length, 1);
});

test('cancel: if Razorpay refuses, nothing changes on the account and the student is told', async () => {
  seedActiveSubscriber(); signIn('u1');
  b.rz.rejectCancel = new Error('Cannot cancel: already under processing');
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'active' }));
  const res = await cancelRequest();
  assert.equal(res.status, 502);
  assert.equal(db.user('u1').subscriptionStatus, 'active');
});

test('cancel: signed out, no subscription (one-time Pro) and a foreign subscription are all refused', async () => {
  assert.equal((await cancelRequest()).status, 401);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  signIn('u1');
  const none = await cancelRequest();
  assert.equal(none.status, 404);
  assert.equal((await none.json()).code, 'no_subscription');
  db.addUser('u3', { subscription_status: 'active', razorpay_subscription_id: 'sub_theirs', premium_until: iso(Date.now() + DAY) });
  db.addPayment({ userId: 'someone_else', subscriptionId: 'sub_theirs', planId: 'pro_monthly_99', status: 'captured', paymentId: 'p', amountPaid: 9900 });
  signIn('u3');
  assert.equal((await cancelRequest()).status, 404);
  assert.equal(b.rz.calls.filter((c) => c[0] === 'subscriptions.cancel').length, 0);
});
