// Security audit 15 Nov 2026, money lane (tmp/1115-prod/sec-money.md): M1 replayed verify bodies, M3 doubled checkouts,
// M4 refunds and disputes, M7 creator codes on monthly charges, M8 subscriptions with no row of ours.
// Real route handlers, in-memory database, Razorpay client with no network (data/tests/billing_harness.mjs).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadBilling, resetWorld, hmac, TEST_ENV, subscriptionEntity, paymentEntity, signedWebhook, webhookEvent, DAY, FAR_ONE_TIME_UNTIL, iso,
} from './billing_harness.mjs';
import { amountMatchesPaymentRecord, resolveUserEntitlement } from '../../src/lib/payments/entitlements.js';

let db;
let b;
const sec = (ms) => Math.floor(ms / 1000);
const post = (handler, body) => handler.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const signIn = (id) => { globalThis.__mmSession = { user: { id } }; };
const cancelRequest = () => b.cancel.POST(new Request('http://localhost/api/billing/cancel', { method: 'POST' }));
const cancels = () => b.rz.calls.filter((c) => c[0] === 'subscriptions.cancel');

async function fire(name, parts, opts) {
  const { request } = signedWebhook(webhookEvent(name, parts), opts);
  const response = await b.webhook.POST(request);
  return { status: response.status, json: await response.json() };
}

/** A refund or dispute event the way Razorpay sends it: the refund (or dispute) entity plus the payment entity. */
async function fireMoneyBack(name, { refund = null, dispute = null, payment }) {
  const payload = { payment: { entity: payment } };
  if (refund) payload.refund = { entity: refund };
  if (dispute) payload.dispute = { entity: dispute };
  const event = { entity: 'event', account_id: 'acc_test', event: name, contains: Object.keys(payload), payload, created_at: sec(Date.now()) };
  const { request } = signedWebhook(event);
  const response = await b.webhook.POST(request);
  return { status: response.status, json: await response.json() };
}

beforeEach(async () => {
  b = await loadBilling();
  db = resetWorld();
  b.rz.invoices.clear(); b.rz.subscriptions.clear(); b.rz.payments.clear(); b.rz.calls.length = 0; b.rz.created.length = 0;
  b.rz.rejectCancel = null; b.rz.rejectCancelIds.clear(); b.rz.failNextInvoiceFetch = false;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_ENV.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
});

const verifyBody = (over = {}) => ({
  razorpay_subscription_id: 'sub_m1', razorpay_payment_id: 'pay_m1', userId: 'u1',
  razorpay_signature: hmac(`${over.razorpay_payment_id || 'pay_m1'}|sub_m1`, TEST_ENV.RAZORPAY_KEY_SECRET), ...over,
});

// ================================================================ M1: a replayed verify body never grants again

test('M1 probe: the first verify body replayed after the month ended and the cancel landed leaves the student on Free', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity());
  b.rz.subscriptions.set('sub_m1', subscriptionEntity());
  assert.equal((await post(b.verify, verifyBody())).status, 200, 'the honest first payment still turns Pro on');
  assert.equal(db.user('u1').isPremium, true);

  // Forty days on: the month paid for is over and the student cancelled; Razorpay sends subscription.cancelled.
  const paidAt = Date.now() - 40 * DAY;
  const ended = Date.now() - 8 * DAY;
  const row = db._payments.find((p) => p.subscriptionId === 'sub_m1');
  Object.assign(row, { createdAt: paidAt, accessUntil: iso(ended), rawPayment: paymentEntity({ created_at: sec(paidAt) }) });
  db.rawUser('u1').premium_until = iso(ended);
  const cancelledSub = subscriptionEntity({ status: 'cancelled', current_start: sec(paidAt), current_end: sec(ended) });
  b.rz.payments.set('pay_m1', paymentEntity({ created_at: sec(paidAt) }));
  b.rz.subscriptions.set('sub_m1', cancelledSub);
  await fire('subscription.cancelled', { subscription: cancelledSub });
  assert.deepEqual([db.user('u1').subscriptionStatus, db.user('u1').isPremium], ['cancelled', false]);

  // The replay. Before the fix: 200 and { status: 'active', premium_until: null }, which reads as Pro for ever.
  const beforeUser = JSON.stringify(db.rawUser('u1'));
  const beforeRow = JSON.stringify(db.payment('sub_m1'));
  const replay = await post(b.verify, verifyBody());
  assert.equal(replay.status, 409);
  const json = await replay.json();
  assert.equal(json.code, 'subscription_ended');
  assert.match(json.error, /Nothing was changed/);
  assert.equal(JSON.stringify(db.rawUser('u1')), beforeUser, 'the account row is untouched');
  assert.equal(JSON.stringify(db.payment('sub_m1')), beforeRow, 'the payment row is untouched');
  assert.equal(db.user('u1').isPremium, false);
});

test('M1: the same payment replayed while Razorpay still calls the subscription active, after its month ended, grants nothing', async () => {
  const paidAt = Date.now() - 40 * DAY;
  const ended = Date.now() - 8 * DAY;
  db.addUser('u1', { subscription_status: 'past_due', premium_until: iso(ended), razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: iso(ended), createdAt: paidAt, rawPayment: paymentEntity({ created_at: sec(paidAt) }) });
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity({ created_at: sec(paidAt) }));
  // A renewal is failing: Razorpay holds the next, unpaid month as the current cycle.
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'pending', current_end: sec(Date.now() + 22 * DAY) }));
  const res = await post(b.verify, verifyBody());
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'payment_already_used');
  assert.equal(db.user('u1').isPremium, false, 'the unpaid month is not given away');
  assert.equal(db.user('u1').subscriptionStatus, 'past_due');
});

test('M1: a first payment older than the charge the row last recorded grants nothing (the renewal month is not paid twice)', async () => {
  const firstAt = Date.now() - 65 * DAY;
  const renewalAt = Date.now() - 35 * DAY;
  const lapsed = Date.now() - 3 * DAY;
  db.addUser('u1', { subscription_status: 'past_due', premium_until: iso(lapsed), razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m2', amountPaid: 9900, accessUntil: iso(lapsed), createdAt: firstAt, rawPayment: paymentEntity({ id: 'pay_m2', created_at: sec(renewalAt) }) });
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity({ created_at: sec(firstAt) }));
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'pending', current_end: sec(Date.now() + 27 * DAY) }));
  const res = await post(b.verify, verifyBody());
  assert.equal(res.status, 409);
  assert.equal(db.user('u1').isPremium, false);
  assert.equal(db.payment('sub_m1').paymentId, 'pay_m2', 'the row keeps its latest charge');
});

test('M1: the webhook granting first and the verify arriving second is still a success, and writes nothing more', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  signIn('u1');
  const sub = subscriptionEntity();
  await fire('subscription.charged', { subscription: sub, payment: paymentEntity() });
  assert.equal(db.user('u1').isPremium, true);
  const before = JSON.stringify(db.payment('sub_m1'));
  b.rz.payments.set('pay_m1', paymentEntity());
  b.rz.subscriptions.set('sub_m1', sub);
  const res = await post(b.verify, verifyBody());
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.alreadyApplied, true);
  assert.equal(json.user.isPremium, true);
  assert.equal(JSON.stringify(db.payment('sub_m1')), before);
});

test('M1: a renewal that arrives by webhook after the first verify still extends Pro', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity());
  b.rz.subscriptions.set('sub_m1', subscriptionEntity());
  assert.equal((await post(b.verify, verifyBody())).status, 200);
  const firstUntil = new Date(db.user('u1').premiumUntil).getTime();
  await fire('subscription.charged', { subscription: subscriptionEntity({ current_end: sec(firstUntil + 30 * DAY), paid_count: 2 }), payment: paymentEntity({ id: 'pay_m2', invoice_id: 'inv_m2', created_at: sec(firstUntil) }) });
  const user = db.user('u1');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
  assert.ok(new Date(user.premiumUntil).getTime() >= firstUntil + 30 * DAY);
});

test('M1: a verify whose paid-through date is already past is refused and writes nothing', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity({ created_at: sec(Date.now() - 45 * DAY) }));
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'active', current_end: sec(Date.now() - 12 * DAY) }));
  const res = await post(b.verify, verifyBody());
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, 'period_ended');
  assert.equal(db.user('u1').isPremium, false);
  assert.equal(db.user('u1').subscriptionStatus, 'free');
  assert.equal(db.payment('sub_m1').status, 'created');
});

test('M1: the entitlement rule never answers "active" without a future date', () => {
  const NOW = Date.parse('2026-11-15T06:30:00Z');
  const past = iso(NOW - 3 * DAY);
  const future = iso(NOW + 20 * DAY);
  // Before the fix both answered 'active' with no date.
  assert.deepEqual(resolveUserEntitlement({ ownStatus: 'active', ownAccessUntil: past, nowMs: NOW }), { subscriptionStatus: 'past_due', isPremium: false, premiumUntil: null, ownWins: true });
  assert.deepEqual(resolveUserEntitlement({ ownStatus: 'active', ownAccessUntil: null, nowMs: NOW }), { subscriptionStatus: 'free', isPremium: false, premiumUntil: null, ownWins: false });
  assert.deepEqual(resolveUserEntitlement({ ownStatus: 'active', ownAccessUntil: future, nowMs: NOW }), { subscriptionStatus: 'active', isPremium: true, premiumUntil: future, ownWins: true });
  // A one-time pass still makes another subscription's end read as active.
  assert.equal(resolveUserEntitlement({ ownStatus: 'cancelled', ownAccessUntil: past, otherAccessUntil: FAR_ONE_TIME_UNTIL, hasOtherPaid: true, nowMs: NOW }).subscriptionStatus, 'active');
});

test('M1: one-time 2027 passes keep verifying and keep their date', async () => {
  db.addUser('u9');
  db.addPayment({ userId: 'u9', orderId: 'order_once', planId: 'pro_cuet_2027', status: 'created', rawOrder: { amount: 9900 } });
  signIn('u9');
  b.rz.payments.set('pay_once', paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null }));
  const res = await post(b.verify, { razorpay_order_id: 'order_once', razorpay_payment_id: 'pay_once', userId: 'u9', razorpay_signature: hmac('order_once|pay_once', TEST_ENV.RAZORPAY_KEY_SECRET) });
  assert.equal(res.status, 200);
  assert.equal(db.user('u9').premiumUntil, FAR_ONE_TIME_UNTIL);
  assert.equal(db.user('u9').isPremium, true);
});

// ================================================================ M7: a creator code never lowers a monthly charge

test('M7: a monthly charge below Rs 99 is refused even when the checkout carried a creator code', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', amount: 9900, status: 'created', creatorCode: 'asha10', creatorId: 'c1', referralStatus: 'tracked_no_offer' });
  // Before the fix: any amount up to Rs 99 passed once a creator code was on the row.
  await fire('subscription.charged', { subscription: subscriptionEntity(), payment: paymentEntity({ amount: 990 }) });
  assert.equal(db.user('u1').isPremium, false);
  assert.equal(db.payment('sub_m1').status, 'failed');
  const record = { subscriptionId: 'sub_m1', amount: 9900, creatorCode: 'asha10' };
  assert.equal(amountMatchesPaymentRecord(paymentEntity({ amount: 990 }), record), false);
  assert.equal(amountMatchesPaymentRecord(paymentEntity({ amount: 990, notes: { offerId: 'offer_fake' } }), record), false, 'a note the payer sets is no offer');
  assert.equal(amountMatchesPaymentRecord(paymentEntity({ amount: 9900 }), record), true);
});

test('M7: the legacy Rs 69 subscription with a Razorpay offer still renews at its offer price', async () => {
  const until = Date.now() + 2 * DAY;
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: iso(until), razorpay_subscription_id: 'sub_old69' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_old69', planId: 'pro_monthly', amount: 6900, status: 'captured', paymentId: 'pay_old', amountPaid: 6800, accessUntil: iso(until), offerId: 'offer_legacy', creatorCode: 'asha10', rawSubscription: { offer_id: 'offer_legacy' } });
  await fire('subscription.charged', { subscription: subscriptionEntity({ id: 'sub_old69', plan_id: 'plan_legacy69', offer_id: 'offer_legacy', current_end: sec(until + 30 * DAY), paid_count: 8, notes: {} }), payment: paymentEntity({ id: 'pay_old8', amount: 6800, invoice_id: 'inv_old8' }) });
  const user = db.user('u1');
  assert.equal(user.isPremium, true);
  assert.ok(new Date(user.premiumUntil).getTime() >= until + 30 * DAY - 1000, 'the next month is granted');
  // And the plain legacy Rs 69 renewal without an offer.
  assert.equal(amountMatchesPaymentRecord(paymentEntity({ amount: 6900 }), { subscriptionId: 'sub_x', amount: 6900 }), true);
});

// ================================================================ M8: no row of ours, attributed only from server-set notes

test('M8: a charge for a subscription with no row of ours is never attributed from the payment notes the payer can set', async () => {
  db.addUser('u2');
  // Before the fix: the payment's notes won and u2 got Pro.
  const sub = subscriptionEntity({ id: 'sub_orphan', notes: {} });
  const res = await fire('subscription.charged', { subscription: sub, payment: paymentEntity({ id: 'pay_orphan', notes: { userId: 'u2', planId: 'pro_monthly_99' } }) });
  assert.equal(res.json.ignored, true);
  assert.equal(db.user('u2').isPremium, false);
  assert.equal(db.payment('sub_orphan'), undefined, 'no row was made');
  const audit = db._audits.find((a) => a.action === 'billing.unattributed_subscription_payment');
  assert.equal(audit.metadata.paymentId, 'pay_orphan');
  assert.equal(audit.metadata.reason, 'no user in the subscription notes');
});

test('M8: server notes naming a one-time plan, or a Razorpay plan that is not ours, grant nothing and are recorded', async () => {
  db.addUser('u2');
  await fire('subscription.charged', { subscription: subscriptionEntity({ id: 'sub_once', notes: { userId: 'u2', planId: 'pro_cuet_2027' } }), payment: paymentEntity({ id: 'pay_once_x' }) });
  await fire('subscription.charged', { subscription: subscriptionEntity({ id: 'sub_other', plan_id: 'plan_someone_else', notes: { userId: 'u2', planId: 'pro_monthly_99' } }), payment: paymentEntity({ id: 'pay_other' }) });
  assert.equal(db.user('u2').isPremium, false);
  assert.deepEqual(db._audits.filter((a) => a.action === 'billing.unattributed_subscription_payment').map((a) => a.metadata.reason), ['not a known monthly plan', 'Razorpay plan does not match the configured plan']);
});

test('M8: server notes on our live plan still recover the lost row and grant the month', async () => {
  db.addUser('u1');
  const res = await fire('subscription.charged', { subscription: subscriptionEntity({ id: 'sub_lost' }), payment: paymentEntity({ id: 'pay_lost', notes: { userId: 'someone_else' } }) });
  assert.equal(res.status, 200);
  assert.equal(db.payment('sub_lost').userId, 'u1');
  assert.equal(db.user('u1').isPremium, true);
});

// ================================================================ M3: never a second subscription; cancel stops all of them

test('M3: a second tap on Get Pro while the first checkout is open hands back the same subscription', async () => {
  db.addUser('u1');
  signIn('u1');
  const first = await (await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' })).json();
  b.rz.subscriptions.set(first.subscription.id, { ...b.rz.created[0] });
  const second = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(second.status, 200);
  const json = await second.json();
  assert.equal(json.subscription.id, first.subscription.id, 'before the fix this was a second Rs 99 subscription');
  assert.equal(json.reused, true);
  assert.equal(b.rz.created.length, 1);
  assert.equal(db._payments.length, 1);
});

test('M3: a first payment still being confirmed is never doubled', async () => {
  db.addUser('u1');
  signIn('u1');
  const first = await (await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' })).json();
  b.rz.subscriptions.set(first.subscription.id, { ...b.rz.created[0], status: 'active' });
  const second = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(second.status, 409);
  const json = await second.json();
  assert.equal(json.code, 'subscription_open');
  assert.match(json.error, /being confirmed/);
  assert.equal(b.rz.created.length, 1);
});

test('M3: a checkout that can no longer be paid, or one older than a day, does not block a new one', async () => {
  db.addUser('u1');
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_gone', planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, status: 'created', createdAt: Date.now() - 3600_000 });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_stale', planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, status: 'created', createdAt: Date.now() - 3 * DAY });
  b.rz.subscriptions.set('sub_gone', subscriptionEntity({ id: 'sub_gone', status: 'expired' }));
  b.rz.subscriptions.set('sub_stale', subscriptionEntity({ id: 'sub_stale', status: 'created' }));
  signIn('u1');
  const res = await post(b.create, { userId: 'u1', planId: 'pro_monthly_99' });
  assert.equal(res.status, 200);
  assert.equal(b.rz.created.length, 1);
  assert.equal(b.rz.calls.filter((c) => c[0] === 'subscriptions.fetch' && c[1] === 'sub_stale').length, 0, 'a day-old checkout is not even asked about');
});

test('M3: cancel stops every subscription of the student that may still charge, and says how many', async () => {
  const until = iso(Date.now() + 12 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_b' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_a', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_a', amountPaid: 9900, accessUntil: until });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_b', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_b', amountPaid: 9900, accessUntil: until });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_abandoned', planId: 'pro_monthly_99', status: 'created' });
  b.rz.subscriptions.set('sub_a', subscriptionEntity({ id: 'sub_a', status: 'active' }));
  b.rz.subscriptions.set('sub_abandoned', subscriptionEntity({ id: 'sub_abandoned', status: 'created' }));
  signIn('u1');
  const res = await cancelRequest();
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.stopped, 2);
  assert.match(json.message, /^Renewals are cancelled for 2 monthly plans\. Pro stays active until /);
  // Before the fix only sub_b (the account's current one) was cancelled.
  assert.deepEqual(cancels().map((c) => c[1]).sort(), ['sub_a', 'sub_b']);
  assert.ok(cancels().every((c) => c[2] === true), 'both at the end of the paid month');
  assert.equal(db.user('u1').subscriptionStatus, 'cancelled');
});

test('M3: when a second subscription cannot be stopped the student is told, and a second tap tries it again', async () => {
  const until = iso(Date.now() + 12 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_b' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_a', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_a', amountPaid: 9900, accessUntil: until });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_b', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_b', amountPaid: 9900, accessUntil: until });
  b.rz.subscriptions.set('sub_a', subscriptionEntity({ id: 'sub_a', status: 'active' }));
  b.rz.rejectCancelIds.add('sub_a');
  signIn('u1');
  const res = await cancelRequest();
  assert.equal(res.status, 502);
  assert.match((await res.json()).error, /cancelled for 1 of your monthly plans, but one more could not be confirmed/);
  assert.equal(db.user('u1').subscriptionStatus, 'cancelled', 'the current one is off');
  b.rz.rejectCancelIds.clear();
  const again = await cancelRequest();
  assert.equal(again.status, 200);
  assert.equal((await again.json()).stopped, 1);
  assert.deepEqual(cancels().map((c) => c[1]), ['sub_b', 'sub_a', 'sub_a'], 'the current one is not sent twice');
});

// ================================================================ M4: refunds and disputes

const refundEntity = (over = {}) => ({ id: 'rfnd_1', entity: 'refund', amount: 9900, currency: 'INR', payment_id: 'pay_m1', status: 'processed', ...over });

test('M4: a full refund of the payment that pays for this month ends Pro now and cancels the subscription', async () => {
  const until = iso(Date.now() + 20 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: until });
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'active' }));
  // Before the fix: { ok: true, ignored: true } and Pro stayed to its date.
  const res = await fireMoneyBack('refund.processed', { refund: refundEntity(), payment: paymentEntity({ status: 'refunded', amount_refunded: 9900, refund_status: 'full' }) });
  assert.equal(res.status, 200);
  assert.equal(res.json.result, 'access_ended');
  const user = db.user('u1');
  assert.deepEqual([user.isPremium, user.subscriptionStatus, user.premiumUntil, user.razorpaySubscriptionId], [false, 'cancelled', null, null]);
  assert.deepEqual(cancels(), [['subscriptions.cancel', 'sub_m1', false]], 'cancelled at once, so no further charge');
  assert.equal(db.payment('sub_m1').status, 'cancelled');
  assert.equal(db._audits.filter((a) => a.action === 'billing.refund_processed').length, 1);

  // The cancel Razorpay then sends, and a replay of the old verify body, change nothing.
  await fire('subscription.cancelled', { subscription: subscriptionEntity({ status: 'cancelled' }) });
  assert.equal(db.user('u1').isPremium, false);
  signIn('u1');
  b.rz.payments.set('pay_m1', paymentEntity());
  const replay = await post(b.verify, verifyBody());
  assert.equal(replay.status, 409);
  assert.equal(db.user('u1').isPremium, false);
});

test('M4: the same refund delivered twice is recorded once', async () => {
  const until = iso(Date.now() + 20 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: until });
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'active' }));
  const parts = { refund: refundEntity(), payment: paymentEntity({ amount_refunded: 9900, refund_status: 'full' }) };
  await fireMoneyBack('refund.processed', parts);
  await fireMoneyBack('refund.processed', parts); // a new event id, the same refund
  assert.equal(db._audits.filter((a) => a.action === 'billing.refund_processed').length, 1);
  assert.equal(db._revocations.length, 1);
  assert.equal(cancels().length, 1, 'the second delivery finds the subscription already cancelled');
});

test('M4: a later renewal the family pays for still grants its month after an earlier refund', async () => {
  const until = iso(Date.now() + 20 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: until });
  b.rz.subscriptions.set('sub_m1', subscriptionEntity({ status: 'active' }));
  b.rz.rejectCancel = new Error('simulated refusal');
  // The cancel fails: the event fails and Razorpay retries it, but Pro is already off.
  const failed = await fireMoneyBack('refund.processed', { refund: refundEntity(), payment: paymentEntity({ amount_refunded: 9900, refund_status: 'full' }) });
  assert.equal(failed.status, 500);
  assert.equal(db.user('u1').isPremium, false);
  b.rz.rejectCancel = null;
  // Razorpay charged the next month anyway: that payment was not refunded, so it grants.
  await fire('subscription.charged', { subscription: subscriptionEntity({ current_end: sec(Date.now() + 30 * DAY) }), payment: paymentEntity({ id: 'pay_m2', invoice_id: 'inv_m2' }) });
  assert.equal(db.user('u1').isPremium, true);
});

test('M4: a partial refund, an earlier month\'s refund and a dispute are recorded and change no access', async () => {
  const until = iso(Date.now() + 20 * DAY);
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: until, razorpay_subscription_id: 'sub_m1' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m2', amountPaid: 9900, accessUntil: until });
  b.rz.invoices.set('inv_m1', { id: 'inv_m1', subscription_id: 'sub_m1' });

  const partial = await fireMoneyBack('refund.processed', { refund: refundEntity({ id: 'rfnd_p', amount: 2000, payment_id: 'pay_m2' }), payment: paymentEntity({ id: 'pay_m2', amount_refunded: 2000, refund_status: 'partial' }) });
  assert.equal(partial.json.result, 'partial_refund_recorded');
  const earlier = await fireMoneyBack('refund.processed', { refund: refundEntity({ id: 'rfnd_old' }), payment: paymentEntity({ id: 'pay_m1', invoice_id: 'inv_m1', amount_refunded: 9900, refund_status: 'full' }) });
  assert.equal(earlier.json.result, 'refund_recorded');
  const dispute = await fireMoneyBack('payment.dispute.created', { dispute: { id: 'disp_1', entity: 'dispute', payment_id: 'pay_m2', amount: 9900, status: 'open', reason_code: 'chargeback' }, payment: paymentEntity({ id: 'pay_m2' }) });
  assert.equal(dispute.json.result, 'dispute_recorded');

  const user = db.user('u1');
  assert.deepEqual([user.isPremium, user.subscriptionStatus, user.premiumUntil], [true, 'active', until]);
  assert.equal(cancels().length, 0);
  assert.deepEqual(db._audits.map((a) => [a.action, a.metadata.paymentId]), [
    ['billing.refund_processed', 'pay_m2'], ['billing.refund_processed', 'pay_m1'], ['billing.dispute', 'pay_m2'],
  ]);
});

test('M4: a full refund of a one-time pass ends it, but never a pass or month paid for separately', async () => {
  db.addUser('u9', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u9', orderId: 'order_once', paymentId: 'pay_once', planId: 'pro_cuet_2027', status: 'captured', amountPaid: 9900, accessUntil: FAR_ONE_TIME_UNTIL });
  await fireMoneyBack('refund.processed', { refund: refundEntity({ payment_id: 'pay_once' }), payment: paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null, amount_refunded: 9900, refund_status: 'full' }) });
  assert.equal(db.user('u9').isPremium, false);

  db = resetWorld();
  const monthEnd = iso(Date.now() + 10 * DAY);
  db.addUser('u9', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u9', orderId: 'order_once', paymentId: 'pay_once', planId: 'pro_cuet_2027', status: 'captured', amountPaid: 9900, accessUntil: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u9', subscriptionId: 'sub_m9', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_m9', amountPaid: 9900, accessUntil: monthEnd });
  await fireMoneyBack('refund.processed', { refund: refundEntity({ payment_id: 'pay_once' }), payment: paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null, amount_refunded: 9900, refund_status: 'full' }) });
  const user = db.user('u9');
  assert.equal(user.isPremium, true, 'the monthly plan still pays for this month');
  assert.equal(new Date(user.premiumUntil).getTime(), new Date(monthEnd).getTime(), 'shrunk to the month, not the refunded pass date');
});

test('M4: a refunded credit pack takes back only the unspent credits, records the shortfall, and is never paid twice', async () => {
  globalThis.__mmPacks = { ai_pack_100: { key: 'ai_pack_100', credits: 100, amountPaise: 4900 } };
  db.addUser('u1');
  db.addPayment({ userId: 'u1', orderId: 'order_pack', paymentId: 'pay_pack', planId: 'ai_pack_100', amount: 4900, status: 'captured', amountPaid: 4900 });
  db._bonus.set('u1', 30); // 70 of the 100 already spent
  const parts = { refund: refundEntity({ payment_id: 'pay_pack', amount: 4900 }), payment: paymentEntity({ id: 'pay_pack', order_id: 'order_pack', invoice_id: null, amount: 4900, amount_refunded: 4900, refund_status: 'full' }) };
  const res = await fireMoneyBack('refund.processed', parts);
  assert.equal(res.json.result, 'credits_taken_back');
  assert.equal(db._bonus.get('u1'), 0, 'never below zero');
  assert.deepEqual([db._takeBacks[0].clawedBack, db._takeBacks[0].shortfall], [30, 70]);
  await fireMoneyBack('refund.processed', parts);
  assert.equal(db._takeBacks.length, 1, 'taken back once');
  // A late payment.captured for that order never marks it paid again or grants.
  await fire('payment.captured', { payment: paymentEntity({ id: 'pay_pack', order_id: 'order_pack', invoice_id: null, amount: 4900 }) });
  assert.equal(db._payments[0].status, 'cancelled');
  assert.equal(globalThis.__mmGrants.length, 0);
});

test('M4: without the take-back migration the credit refund is recorded as a manual step', async () => {
  globalThis.__mmPacks = { ai_pack_100: { key: 'ai_pack_100', credits: 100, amountPaise: 4900 } };
  db.addUser('u1');
  db.addPayment({ userId: 'u1', orderId: 'order_pack', paymentId: 'pay_pack', planId: 'ai_pack_100', amount: 4900, status: 'captured', amountPaid: 4900 });
  db.takeBackRpcMissing = true;
  const res = await fireMoneyBack('refund.processed', { refund: refundEntity({ payment_id: 'pay_pack', amount: 4900 }), payment: paymentEntity({ id: 'pay_pack', order_id: 'order_pack', invoice_id: null, amount: 4900, amount_refunded: 4900, refund_status: 'full' }) });
  assert.equal(res.status, 200);
  assert.equal(res.json.result, 'credits_manual');
  assert.equal(db._audits.find((a) => a.action === 'billing.refund_credits_manual').metadata.credits, 100);
});

test('M4: a refund for a payment with no row of ours is acknowledged and changes nothing', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  const res = await fireMoneyBack('refund.processed', { refund: refundEntity({ payment_id: 'pay_unknown' }), payment: paymentEntity({ id: 'pay_unknown', invoice_id: null, order_id: 'order_unknown' }) });
  assert.equal(res.status, 200);
  assert.equal(res.json.ignored, true);
  assert.equal(db.user('u1').isPremium, true);
});
