// Monthly Pro (Rs 99, Razorpay subscription): every webhook event, simulated with signed fake payloads.
// The real route runs against an in-memory database and a Razorpay client with no network.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadBilling, resetWorld, signedWebhook, webhookEvent, subscriptionEntity, paymentEntity, DAY, FAR_ONE_TIME_UNTIL, iso, hmac, TEST_ENV,
} from './billing_harness.mjs';

let db;
let b;
const sec = (ms) => Math.floor(ms / 1000);

beforeEach(async () => {
  b = await loadBilling();
  db = resetWorld();
  b.rz.invoices.clear(); b.rz.subscriptions.clear(); b.rz.payments.clear(); b.rz.calls.length = 0;
  b.rz.failNextInvoiceFetch = false;
  process.env.RAZORPAY_WEBHOOK_SECRET = TEST_ENV.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 = TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99;
});

async function fire(name, parts, opts) {
  const { request } = signedWebhook(webhookEvent(name, parts), opts);
  const response = await b.webhook.POST(request);
  return { status: response.status, json: await response.json() };
}

/** A free user with a monthly subscription record, paid or not. */
function seed({ paid = false, accessUntil = null, userRow = {}, subscriptionId = 'sub_m1', userId = 'u1', paymentId = 'pay_m1', amountPaid = 9900 } = {}) {
  db.addUser(userId, paid ? { subscription_status: 'active', is_premium: true, premium_until: accessUntil, razorpay_subscription_id: subscriptionId, ...userRow } : userRow);
  return db.addPayment({
    userId, subscriptionId, planId: 'pro_monthly_99', razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, amount: 9900,
    status: paid ? 'captured' : 'created', paymentId: paid ? paymentId : null, amountPaid: paid ? amountPaid : null, accessUntil: paid ? accessUntil : null,
  });
}

const inDays = (n) => Date.now() + n * DAY;

// ---------------------------------------------------------------- signature and plumbing

test('webhook is closed without its secret, and rejects a missing, wrong or tampered signature', async () => {
  seed();
  const sub = subscriptionEntity();
  const body = JSON.stringify(webhookEvent('subscription.charged', { subscription: sub, payment: paymentEntity() }));

  const missing = signedWebhook(body, { signature: '' });
  assert.equal((await b.webhook.POST(missing.request)).status, 401, 'no signature');
  const wrong = signedWebhook(body, { secret: 'not_the_secret' });
  assert.equal((await b.webhook.POST(wrong.request)).status, 401, 'signed with another secret');
  const tampered = signedWebhook(body, { signature: hmac(body.replace('9900', '1'), TEST_ENV.RAZORPAY_WEBHOOK_SECRET) });
  assert.equal((await b.webhook.POST(tampered.request)).status, 401, 'body changed after signing');
  const garbage = signedWebhook(body, { signature: 'zz' });
  assert.equal((await b.webhook.POST(garbage.request)).status, 401, 'non-hex signature');
  assert.equal(db.user('u1').isPremium, false, 'nothing was granted by any of them');

  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  const closed = signedWebhook(body, { secret: 'anything' });
  assert.equal((await b.webhook.POST(closed.request)).status, 503, 'no secret configured');
});

test('events we do not handle, and events for unknown subscriptions, are acknowledged and change nothing', async () => {
  seed();
  assert.deepEqual((await fire('subscription.updated', { subscription: subscriptionEntity() })).json, { ok: true, ignored: true });
  const unknown = await fire('subscription.charged', { subscription: subscriptionEntity({ id: 'sub_unknown', notes: {} }), payment: paymentEntity({ id: 'pay_x' }) });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.json.ignored, true);
  assert.equal(db.user('u1').isPremium, false);
});

// ---------------------------------------------------------------- first payment

test('subscription.authenticated and subscription.activated record state but never grant Pro by themselves', async () => {
  seed();
  await fire('subscription.authenticated', { subscription: subscriptionEntity({ status: 'authenticated' }) });
  assert.equal(db.payment('sub_m1').status, 'authenticated');
  await fire('subscription.activated', { subscription: subscriptionEntity({ status: 'active' }), payment: paymentEntity() });
  assert.equal(db.payment('sub_m1').status, 'active');
  assert.equal(db.user('u1').isPremium, false, 'access waits for a captured charge');
  assert.equal(db.user('u1').subscriptionStatus, 'free');
});

test('subscription.charged with a captured Rs 99 payment turns Pro on to the paid-through date', async () => {
  seed();
  const sub = subscriptionEntity();
  const res = await fire('subscription.charged', { subscription: sub, payment: paymentEntity() });
  assert.equal(res.status, 200);
  const user = db.user('u1');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
  assert.equal(user.razorpaySubscriptionId, 'sub_m1');
  assert.ok(new Date(user.premiumUntil) >= new Date(sec(sub.current_end) * 1000), 'at least the end of the paid cycle');
  const record = db.payment('sub_m1');
  assert.equal(record.status, 'captured');
  assert.equal(record.paymentId, 'pay_m1');
  assert.equal(record.amountPaid, 9900);
  assert.equal(record.accessUntil, user.premiumUntil);
});

test('the same webhook delivered twice is processed once', async () => {
  seed();
  const parts = { subscription: subscriptionEntity(), payment: paymentEntity() };
  const first = signedWebhook(webhookEvent('subscription.charged', parts), { id: 'evt_dupe' });
  const second = signedWebhook(webhookEvent('subscription.charged', parts), { id: 'evt_dupe' });
  assert.equal((await (await b.webhook.POST(first.request)).json()).ok, true);
  const before = JSON.stringify(db.payment('sub_m1'));
  const again = await (await b.webhook.POST(second.request)).json();
  assert.equal(again.deduped, true);
  assert.equal(JSON.stringify(db.payment('sub_m1')), before);
});

test('payment.captured after subscription.charged for the same payment leaves the same result', async () => {
  seed();
  const sub = subscriptionEntity();
  await fire('subscription.charged', { subscription: sub, payment: paymentEntity() });
  const afterCharged = { user: db.user('u1'), record: db.payment('sub_m1') };
  b.rz.invoices.set('inv_m1', { id: 'inv_m1', subscription_id: 'sub_m1', billing_end: sec(sub.current_end) });
  b.rz.subscriptions.set('sub_m1', sub);
  await fire('payment.captured', { payment: paymentEntity() });
  assert.deepEqual(db.user('u1'), afterCharged.user);
  assert.equal(db.payment('sub_m1').accessUntil, afterCharged.record.accessUntil);
});

test('payment.captured alone finds its subscription through the invoice', async () => {
  seed();
  const sub = subscriptionEntity();
  b.rz.invoices.set('inv_m1', { id: 'inv_m1', subscription_id: 'sub_m1', billing_end: sec(sub.current_end) });
  b.rz.subscriptions.set('sub_m1', sub);
  const res = await fire('payment.captured', { payment: paymentEntity() });
  assert.equal(res.status, 200);
  assert.equal(db.user('u1').isPremium, true);
  assert.deepEqual(b.rz.calls.map((c) => c[0]), ['invoices.fetch', 'subscriptions.fetch']);
});

test('a Razorpay outage while handling an event returns 500, and the retry of the same event succeeds', async () => {
  seed();
  const sub = subscriptionEntity();
  b.rz.invoices.set('inv_m1', { id: 'inv_m1', subscription_id: 'sub_m1' });
  b.rz.subscriptions.set('sub_m1', sub);
  b.rz.failNextInvoiceFetch = true;
  const parts = { payment: paymentEntity() };
  const first = signedWebhook(webhookEvent('payment.captured', parts), { id: 'evt_retry' });
  assert.equal((await b.webhook.POST(first.request)).status, 500);
  assert.equal(db.user('u1').isPremium, false);
  const retry = signedWebhook(webhookEvent('payment.captured', parts), { id: 'evt_retry' });
  assert.equal((await b.webhook.POST(retry.request)).status, 200);
  assert.equal(db.user('u1').isPremium, true);
});

test('a charge for a subscription we have no record of is recovered from its notes, and refused when the notes do not match the plan', async () => {
  db.addUser('u1');
  const sub = subscriptionEntity({ id: 'sub_lost' });
  const ok = await fire('subscription.charged', { subscription: sub, payment: paymentEntity({ id: 'pay_lost' }) });
  assert.equal(ok.status, 200);
  assert.equal(db.payment('sub_lost').planId, 'pro_monthly_99');
  assert.equal(db.user('u1').isPremium, true);

  db.addUser('u2');
  const bad = subscriptionEntity({ id: 'sub_bad', notes: { userId: 'u2', planId: 'pro_monthly_99' } });
  const tooMuch = await fire('subscription.charged', { subscription: bad, payment: paymentEntity({ id: 'pay_bad', amount: 29900 }) });
  assert.equal(tooMuch.json.ignored, true);
  assert.equal(db.user('u2').isPremium, false);
});

test('a charge that is not a captured Rs 99 payment never grants access', async () => {
  seed();
  const sub = subscriptionEntity();
  for (const payment of [paymentEntity({ amount: 100 }), paymentEntity({ status: 'authorized' }), paymentEntity({ currency: 'USD' }), null]) {
    await fire('subscription.charged', { subscription: sub, payment: payment || undefined });
    assert.equal(db.user('u1').isPremium, false);
  }
});

// ---------------------------------------------------------------- renewals

test('a renewal extends the paid-through date, keeps Pro active and keeps one payment row', async () => {
  const firstEnd = inDays(5);
  seed({ paid: true, accessUntil: iso(firstEnd) });
  const sub = subscriptionEntity({ current_end: sec(firstEnd + 30 * DAY), paid_count: 2 });
  await fire('subscription.charged', { subscription: sub, payment: paymentEntity({ id: 'pay_m2', invoice_id: 'inv_m2', created_at: sec(firstEnd) }) });
  const user = db.user('u1');
  assert.equal(user.subscriptionStatus, 'active');
  assert.equal(user.isPremium, true);
  assert.ok(new Date(user.premiumUntil).getTime() >= firstEnd + 30 * DAY, 'now covers the second month');
  const record = db.payment('sub_m1');
  assert.equal(record.paymentId, 'pay_m2');
  assert.equal(record.status, 'captured');
  assert.equal(db._payments.filter((p) => p.subscriptionId === 'sub_m1').length, 1);
});

test('a renewal never moves the paid-through date backwards', async () => {
  const farEnd = inDays(60);
  seed({ paid: true, accessUntil: iso(farEnd) });
  await fire('subscription.charged', { subscription: subscriptionEntity({ current_end: sec(inDays(10)) }), payment: paymentEntity({ id: 'pay_m9', created_at: sec(Date.now() - 40 * DAY) }) });
  assert.ok(new Date(db.user('u1').premiumUntil).getTime() >= farEnd);
});

// ---------------------------------------------------------------- failed and halted charges

test('payment.failed on a renewal keeps Pro to the paid date and shows past_due, without touching the paid record', async () => {
  const until = inDays(4);
  seed({ paid: true, accessUntil: iso(until) });
  const pending = subscriptionEntity({ status: 'pending' });
  const res = await fire('payment.failed', { subscription: pending, payment: paymentEntity({ id: 'pay_fail', status: 'failed' }) });
  assert.equal(res.status, 200);
  const user = db.user('u1');
  assert.equal(user.subscriptionStatus, 'past_due');
  assert.equal(user.isPremium, true, 'Pro runs to the end of the month already paid for');
  assert.equal(user.premiumUntil, iso(until));
  const record = db.payment('sub_m1');
  assert.equal(record.status, 'captured', 'the earlier payment is still the paid evidence');
  assert.equal(record.paymentId, 'pay_m1');
  assert.equal(record.amountPaid, 9900);
});

test('a late payment.failed from before the subscription recovered is ignored', async () => {
  seed({ paid: true, accessUntil: iso(inDays(20)) });
  await fire('payment.failed', { subscription: subscriptionEntity({ status: 'active' }), payment: paymentEntity({ id: 'pay_old_fail', status: 'failed' }) });
  assert.equal(db.user('u1').subscriptionStatus, 'active');
});

test('subscription.pending and subscription.halted keep Pro to the paid date; once the date has passed Pro is off', async () => {
  seed({ paid: true, accessUntil: iso(inDays(3)) });
  await fire('subscription.pending', { subscription: subscriptionEntity({ status: 'pending' }) });
  assert.equal(db.user('u1').subscriptionStatus, 'past_due');
  assert.equal(db.user('u1').isPremium, true);
  await fire('subscription.halted', { subscription: subscriptionEntity({ status: 'halted' }) });
  assert.equal(db.user('u1').subscriptionStatus, 'past_due');
  assert.equal(db.user('u1').isPremium, true);

  db = resetWorld();
  seed({ paid: true, accessUntil: iso(Date.now() - 10 * DAY) });
  await fire('subscription.halted', { subscription: subscriptionEntity({ status: 'halted', current_end: sec(Date.now() - 10 * DAY) }) });
  const user = db.user('u1');
  assert.equal(user.isPremium, false, 'the paid month is over');
  assert.equal(user.subscriptionStatus, 'past_due');
});

test('a halted subscription that later charges again turns Pro back on as active', async () => {
  seed({ paid: true, accessUntil: iso(Date.now() - 5 * DAY) });
  await fire('subscription.halted', { subscription: subscriptionEntity({ status: 'halted', current_end: sec(Date.now() - 5 * DAY) }) });
  assert.equal(db.user('u1').isPremium, false);
  await fire('subscription.charged', { subscription: subscriptionEntity({ current_end: sec(inDays(30)) }), payment: paymentEntity({ id: 'pay_back' }) });
  const user = db.user('u1');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
});

test('the very first payment failing leaves the student on Free and the record failed', async () => {
  seed();
  await fire('payment.failed', { subscription: subscriptionEntity({ status: 'created' }), payment: paymentEntity({ id: 'pay_first_fail', status: 'failed' }) });
  assert.equal(db.user('u1').isPremium, false);
  assert.equal(db.payment('sub_m1').status, 'failed');
  assert.equal(db.user('u1').razorpaySubscriptionId, null);
});

test('a first payment that fails and then succeeds in the same checkout ends up active', async () => {
  seed();
  await fire('payment.failed', { subscription: subscriptionEntity({ status: 'created' }), payment: paymentEntity({ id: 'pay_try1', status: 'failed' }) });
  await fire('subscription.charged', { subscription: subscriptionEntity(), payment: paymentEntity({ id: 'pay_try2' }) });
  const user = db.user('u1');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
  assert.equal(db.payment('sub_m1').status, 'captured');
});

test('subscription.paused keeps the paid month, and subscription.resumed only records the subscription', async () => {
  seed({ paid: true, accessUntil: iso(inDays(12)) });
  await fire('subscription.paused', { subscription: subscriptionEntity({ status: 'paused' }) });
  assert.equal(db.user('u1').isPremium, true);
  assert.equal(db.user('u1').subscriptionStatus, 'past_due');
  const resumed = subscriptionEntity({ status: 'active', notes: { userId: 'u1', planId: 'pro_monthly_99', seen: 'resumed' } });
  await fire('subscription.resumed', { subscription: resumed });
  assert.equal(db.payment('sub_m1').rawSubscription.notes.seen, 'resumed');
  assert.equal(db.payment('sub_m1').status, 'captured');
});

// ---------------------------------------------------------------- cancellation and completion

test('subscription.cancelled after a paid month keeps Pro to the paid date, then the date ends it', async () => {
  const until = inDays(9);
  seed({ paid: true, accessUntil: iso(until) });
  await fire('subscription.cancelled', { subscription: subscriptionEntity({ status: 'cancelled', current_end: sec(until) }) });
  let user = db.user('u1');
  assert.equal(user.subscriptionStatus, 'cancelled');
  assert.equal(user.isPremium, true);
  assert.ok(new Date(user.premiumUntil).getTime() >= until - 1000);
  assert.equal(db.payment('sub_m1').status, 'captured', 'the sale stays a sale');

  db = resetWorld();
  const lapsed = Date.now() - 3 * DAY;
  seed({ paid: true, accessUntil: iso(lapsed) });
  await fire('subscription.cancelled', { subscription: subscriptionEntity({ status: 'cancelled', current_end: sec(lapsed) }) });
  user = db.user('u1');
  assert.equal(user.isPremium, false);
  assert.equal(user.premiumUntil, null);
  assert.equal(user.subscriptionStatus, 'cancelled');
});

test('subscription.cancelled for a subscription that never paid marks it cancelled and grants nothing', async () => {
  seed();
  await fire('subscription.cancelled', { subscription: subscriptionEntity({ status: 'cancelled' }) });
  assert.equal(db.payment('sub_m1').status, 'cancelled');
  const user = db.user('u1');
  assert.equal(user.isPremium, false);
  assert.equal(user.razorpaySubscriptionId, null);
});

test('subscription.completed after the last cycle keeps the paid month and moves the account to Free status', async () => {
  const until = inDays(6);
  seed({ paid: true, accessUntil: iso(until) });
  await fire('subscription.completed', { subscription: subscriptionEntity({ status: 'completed', current_end: sec(until) }) });
  const user = db.user('u1');
  assert.equal(user.subscriptionStatus, 'free');
  assert.equal(user.isPremium, true, 'paid-through date still applies');
});

test('a charge event that arrives late for a subscription the student already cancelled does not switch renewals back on', async () => {
  seed({ paid: true, accessUntil: iso(inDays(10)), userRow: { subscription_status: 'cancelled' } });
  await fire('subscription.charged', { subscription: subscriptionEntity({ current_end: sec(inDays(10)) }), payment: paymentEntity({ id: 'pay_late' }) });
  const user = db.user('u1');
  assert.equal(user.subscriptionStatus, 'cancelled');
  assert.equal(user.isPremium, true);
});

// ---------------------------------------------------------------- one-time holders and other subscriptions

test('a one-time Pro holder keeps access to the 2027 date through every monthly event', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u1', orderId: 'order_once', paymentId: 'pay_once', planId: 'pro_cuet_2027', status: 'captured', amountPaid: 9900, accessUntil: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });

  for (const [name, parts] of [
    ['payment.failed', { subscription: subscriptionEntity({ status: 'created' }), payment: paymentEntity({ id: 'pay_f', status: 'failed' }) }],
    ['subscription.halted', { subscription: subscriptionEntity({ status: 'halted' }) }],
    ['subscription.cancelled', { subscription: subscriptionEntity({ status: 'cancelled' }) }],
  ]) {
    await fire(name, parts);
    const user = db.user('u1');
    assert.equal(user.isPremium, true, `${name}: still Pro`);
    assert.equal(user.premiumUntil, FAR_ONE_TIME_UNTIL, `${name}: date untouched`);
    assert.equal(user.subscriptionStatus, 'active', `${name}: one-time status untouched`);
  }
});

test('a monthly charge on top of a one-time pass never shortens the pass', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u1', orderId: 'order_once', paymentId: 'pay_once', planId: 'pro_cuet_2027', status: 'captured', amountPaid: 9900, accessUntil: FAR_ONE_TIME_UNTIL });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', status: 'created' });
  await fire('subscription.charged', { subscription: subscriptionEntity(), payment: paymentEntity() });
  assert.equal(db.user('u1').premiumUntil, FAR_ONE_TIME_UNTIL);
  assert.equal(db.user('u1').isPremium, true);
});

test('an old subscription ending does not clobber a newer paid subscription', async () => {
  db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: iso(inDays(25)), razorpay_subscription_id: 'sub_new' });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_old', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_o', amountPaid: 9900, accessUntil: iso(Date.now() - 20 * DAY) });
  db.addPayment({ userId: 'u1', subscriptionId: 'sub_new', planId: 'pro_monthly_99', status: 'captured', paymentId: 'pay_n', amountPaid: 9900, accessUntil: iso(inDays(25)) });
  await fire('subscription.cancelled', { subscription: subscriptionEntity({ id: 'sub_old', status: 'cancelled', current_end: sec(Date.now() - 20 * DAY) }) });
  const user = db.user('u1');
  assert.equal(user.razorpaySubscriptionId, 'sub_new');
  assert.equal(user.isPremium, true);
  assert.equal(user.subscriptionStatus, 'active');
  assert.equal(user.premiumUntil, iso(inDays(25)).slice(0, 10) + user.premiumUntil.slice(10));
});

test('a refunded subscription stays revoked when a late charge event arrives', async () => {
  seed();
  db._revocations.push({ userId: 'u1', metadata: { subscriptionId: 'sub_m1' } });
  const res = await fire('subscription.charged', { subscription: subscriptionEntity(), payment: paymentEntity() });
  assert.equal(res.json.reason, 'refunded_subscription');
  assert.equal(db.user('u1').isPremium, false);
  assert.equal(db.payment('sub_m1').status, 'cancelled');
});

test('one-time access orders still grant to their fixed date through the same webhook', async () => {
  db.addUser('u9');
  db.addPayment({ userId: 'u9', orderId: 'order_once', planId: 'pro_cuet_2027', status: 'created', rawOrder: { amount: 9900 } });
  const payment = paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null });
  const res = await fire('payment.captured', { payment });
  assert.equal(res.status, 200);
  const user = db.user('u9');
  assert.equal(user.isPremium, true);
  assert.equal(user.premiumUntil, FAR_ONE_TIME_UNTIL);
  assert.equal(user.razorpaySubscriptionId, null);
});

test('an uncaptured or wrong-amount charge event never takes back a month that was already paid', async () => {
  const until = inDays(15);
  seed({ paid: true, accessUntil: iso(until) });
  for (const payment of [paymentEntity({ id: 'pay_odd1', status: 'authorized' }), paymentEntity({ id: 'pay_odd2', amount: 100 })]) {
    await fire('subscription.charged', { subscription: subscriptionEntity(), payment });
    const user = db.user('u1');
    assert.equal(user.isPremium, true);
    assert.equal(user.subscriptionStatus, 'active');
    assert.equal(user.premiumUntil, iso(until));
    const record = db.payment('sub_m1');
    assert.equal(record.status, 'captured');
    assert.equal(record.paymentId, 'pay_m1');
    assert.equal(record.amountPaid, 9900);
  }
});
