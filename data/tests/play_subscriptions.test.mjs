// Google Play subscriptions (owner D135/D136, 19 Oct 2026: monthly Pro on Play is the subscription pro_monthly, base plan
// monthly). No network, no real Google, no real database: Google is a fake with the purchases.subscriptionsv2 response
// shape, and the store is an in-process Postgres (PGlite) running the real migrations, so every test below exercises the
// real mm_play_sync_subscription against the JavaScript core that calls it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PLAY_PRODUCTS, getPlayProduct, PLAY_SUBSCRIPTION_ID, PLAY_SUBSCRIPTION_BASE_PLAN } from '../../src/lib/payments/playProducts.js';
import { PlayApiError, createPlayClient, PLAY_API_BASE, DEFAULT_TOKEN_URI } from '../../src/lib/payments/playGoogle.js';
import { verifyPlayPurchase, handlePlayNotification, playAccountHash } from '../../src/lib/payments/playBilling.js';
import { readSubscription, subscriptionRecord, SUB_STATE, SUBSCRIPTION_NOTIFICATION } from '../../src/lib/payments/playSubscriptions.js';
import { handlePlayVerify, handlePlayRtdn } from '../../src/lib/server/playBillingHttp.js';
import { generateKeyPairSync } from 'node:crypto';

const file = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const GRANT_MIGRATION = file('supabase/migrations/0038_ai_credit_purchase_grant_rpc.sql');
const PLAY_MIGRATION = file('supabase/migrations/20261018190000_play_purchases.sql');
const SUBS_MIGRATION = file('supabase/migrations/20261019210000_play_subscriptions.sql');
const SUBS_UNDO = file('supabase/undo/20261019210000_play_subscriptions.undo.sql');
const quiet = () => {};
const DAY = 24 * 3600_000;
const iso = (ms) => new Date(ms).toISOString();
const T = (n) => `subtoken-${String(n).padStart(4, '0')}-abcdefghijklmnop`;
const PKG = 'in.mockmob.app';

// ---- the database ---------------------------------------------------------------------------------------------------
async function database() {
  const d = new PGlite();
  await d.exec(`create role anon;create role authenticated;create role service_role;
    create table public.users(id text primary key, is_premium boolean not null default false, subscription_status text not null default 'free', premium_until timestamptz, razorpay_subscription_id text);
    create table public.payments(id text primary key, user_id text references public.users(id), payment_id text, amount_paid int, status text, access_until timestamptz, plan_id text);
    create table public.ai_credit_wallets(user_id text primary key references public.users(id) on delete cascade, included_monthly_credits int default 50, included_credits_used int default 0 check(included_credits_used>=0), bonus_credits int default 0 check(bonus_credits>=0), period_start timestamptz, reset_at timestamptz, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.ai_credit_ledger(id uuid primary key default gen_random_uuid(), user_id text, amount int, reason text check (reason = any (array['monthly_grant','pack_purchase','admin_adjustment','ai_spend','expiry','ai_reserve','ai_release'])), feature text, reference text, metadata jsonb, expires_at timestamptz, created_at timestamptz default now(), wallet_source text, balance_after int, idempotency_key text);`);
  await d.exec(GRANT_MIGRATION);
  await d.exec(PLAY_MIGRATION);
  await d.exec(SUBS_MIGRATION);
  for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) await d.query('insert into public.users(id) values ($1)', [u]);
  return d;
}
const q = (d, sql, params) => d.query(sql, params).then((r) => r.rows);
const userRow = (d, id) => q(d, 'select is_premium, subscription_status, premium_until from public.users where id=$1', [id]).then((r) => r[0]);
const rowOf = (d, token) => q(d, 'select * from public.play_purchases where purchase_token=$1', [token]).then((r) => r[0] || null);
const ms = (v) => (v ? new Date(v).getTime() : null);

/** The production store (playBillingDeps.js playStore), over PGlite. */
function pgStore(d) {
  return {
    getByToken: (t) => rowOf(d, t),
    markFinished: async (t, { acknowledged, consumed }) => {
      await d.query('update public.play_purchases set acknowledged_at = case when $2 then now() else acknowledged_at end, consumed_at = case when $3 then now() else consumed_at end where purchase_token=$1', [t, Boolean(acknowledged), Boolean(consumed)]);
    },
    grant: async (g) => (await q(d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8) r', [g.userId, g.purchaseToken, g.orderId, g.productId, g.kind, g.credits, g.accessUntil, g.raw]))[0].r,
    revoke: async (r) => (await q(d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4) r', [r.purchaseToken, r.reason, r.orderId, r.raw]))[0].r,
    syncSubscription: async (x) => (await q(d, 'select public.mm_play_sync_subscription($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r', [
      x.userId || null, x.purchaseToken, x.productId, x.state, x.expiresAt || null, typeof x.autoRenewing === 'boolean' ? x.autoRenewing : null,
      x.linkedToken || null, x.orderId || null, x.basePlanId || null, x.raw || {}, x.reason || null,
    ]))[0].r,
  };
}

// ---- Google ---------------------------------------------------------------------------------------------------------
/** A SubscriptionPurchaseV2 as Google returns it. */
function subFor(user, { state = SUB_STATE.active, expiry = Date.now() + 30 * DAY, autoRenew = true, ack = false, linked, outOfApp, account = 'own', product = 'pro_monthly', order = 'GPA.3300-0000-0000-00001' } = {}) {
  const sub = {
    kind: 'androidpublisher#subscriptionPurchaseV2',
    regionCode: 'IN',
    startTime: iso(Date.now() - DAY),
    subscriptionState: state,
    acknowledgementState: ack ? 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' : 'ACKNOWLEDGEMENT_STATE_PENDING',
    lineItems: [{
      productId: product,
      expiryTime: iso(expiry),
      autoRenewingPlan: { autoRenewEnabled: autoRenew, recurringPrice: { currencyCode: 'INR', units: '149' } },
      offerDetails: { basePlanId: 'monthly' },
      latestSuccessfulOrderId: order,
    }],
    subscribeWithGoogleInfo: { emailAddress: 'student@example.com', givenName: 'A' }, // personal: must never be stored
    testPurchase: {},
  };
  if (account === 'own') sub.externalAccountIdentifiers = { obfuscatedExternalAccountId: playAccountHash(user) };
  else if (account) sub.externalAccountIdentifiers = { obfuscatedExternalAccountId: account };
  if (linked) sub.linkedPurchaseToken = linked;
  if (outOfApp) sub.outOfAppPurchaseContext = outOfApp;
  if (state === SUB_STATE.canceled || state === SUB_STATE.expired) sub.canceledStateContext = { userInitiatedCancellation: { cancelTime: iso(Date.now()) } };
  return sub;
}

function fakeGoogle() {
  const g = { subs: new Map(), calls: [], failAck: false, unreachable: false };
  g.getSubscriptionV2 = async (token) => {
    g.calls.push(['subget', token]);
    if (g.unreachable) throw new PlayApiError('play_unavailable', 'down');
    const s = g.subs.get(token);
    if (!s) throw new PlayApiError('purchase_not_found', 'no such purchase', 404);
    return structuredClone(s);
  };
  g.acknowledgeSubscription = async (productId, token) => {
    g.calls.push(['suback', productId, token]);
    if (g.failAck) throw new PlayApiError('play_unavailable', 'down');
    g.subs.get(token).acknowledgementState = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
    return {};
  };
  g.getProduct = async () => { throw new PlayApiError('purchase_not_found', 'none', 404); };
  g.count = (kind) => g.calls.filter((c) => c[0] === kind).length;
  return g;
}

async function world() {
  const d = await database();
  const store = pgStore(d);
  const google = fakeGoogle();
  const granted = [];
  const deps = { store, google, packageName: PKG, log: quiet, onGranted: async (x) => { granted.push(x); } };
  const verify = (userId, token, extra = {}) => verifyPlayPurchase(deps, { userId, productId: 'pro_monthly', purchaseToken: token, ...extra });
  const notify = (token, type) => handlePlayNotification(deps, { version: '1.0', packageName: PKG, eventTimeMillis: String(Date.now()), subscriptionNotification: { version: '1.0', notificationType: type, purchaseToken: token } });
  const set = (token, user, opts) => { google.subs.set(token, subFor(user, opts)); };
  return { d, store, google, deps, verify, notify, set, granted, close: () => d.close() };
}

// ---- the product ----------------------------------------------------------------------------------------------------
test('product map: pro_monthly is the Play subscription (base plan monthly), acknowledged, no price; pro_cuet_2027 is not sold on Play', () => {
  assert.equal(PLAY_SUBSCRIPTION_ID, 'pro_monthly');
  assert.equal(PLAY_SUBSCRIPTION_BASE_PLAN, 'monthly');
  const sub = getPlayProduct('pro_monthly');
  assert.equal(sub.kind, 'pro_sub');
  assert.equal(sub.finish, 'acknowledge', 'acknowledged, never consumed');
  assert.equal(sub.basePlanId, 'monthly');
  assert.equal(sub.accessUntil, undefined, 'a subscription runs to Google\'s expiryTime, never a fixed date');
  assert.deepEqual(Object.keys(sub).filter((k) => /price|amount|rupee|paise|inr/i.test(k)), [], 'no price in code: Play Console holds it');
  assert.equal(getPlayProduct('pro_cuet_2027').notSoldOnPlay, true);
  assert.equal(Object.values(PLAY_PRODUCTS).filter((p) => p.kind === 'pro_sub').length, 1);
});

test('Google\'s entitlement rules: ACTIVE, IN_GRACE_PERIOD and CANCELED give access until expiryTime; hold, pause, expiry and pending do not', () => {
  const now = Date.now();
  const at = (state, expiry) => readSubscription(subFor('u1', { state, expiry }), 'pro_monthly', now).entitled;
  assert.equal(at(SUB_STATE.active, now + DAY), true);
  assert.equal(at(SUB_STATE.grace, now + DAY), true, 'grace keeps access (Google extends expiryTime through it)');
  assert.equal(at(SUB_STATE.canceled, now + DAY), true, 'cancelled keeps access until the paid date');
  assert.equal(at(SUB_STATE.canceled, now - 1000), false, 'cancelled with the date gone: access ends');
  assert.equal(at(SUB_STATE.active, now - 1000), false, 'a date in the past never gives access');
  assert.equal(at(SUB_STATE.hold, now - DAY), false, 'account hold blocks access');
  assert.equal(at(SUB_STATE.paused, now + DAY), false, 'paused blocks access');
  assert.equal(at(SUB_STATE.expired, now - DAY), false);
  assert.equal(at(SUB_STATE.pending, now + DAY), false);
  assert.equal(readSubscription(subFor('u1', { product: 'other_sub' }), 'pro_monthly', now).entitled, false, 'another product\'s line item is not ours');
});

test('what is stored of Google\'s answer carries no name, email or account id', () => {
  const rec = subscriptionRecord(subFor('u1', { linked: T(99) }));
  const text = JSON.stringify(rec);
  assert.ok(!text.includes('student@example.com') && !text.includes(playAccountHash('u1')) && !text.includes(T(99)));
  assert.equal(rec.lineItems[0].basePlanId, 'monthly');
  assert.equal(rec.linkedPurchaseToken, true);
});

// ---- verify ---------------------------------------------------------------------------------------------------------
test('verify: Pro until Google\'s expiryTime, status active, recorded once, acknowledged after the grant; a replay changes nothing', async () => {
  const w = await world();
  try {
    const expiry = Date.now() + 30 * DAY;
    w.set(T(1), 'u1', { expiry });
    const r = await w.verify('u1', T(1), { obfuscatedAccountId: playAccountHash('u1') });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.kind, 'pro_sub');
    assert.equal(r.idempotent, false);
    assert.equal(r.finished, true);
    assert.equal(ms(r.pro.premiumUntil), expiry);
    assert.deepEqual(r.subscription, { productId: 'pro_monthly', state: 'active', active: true, autoRenewing: true, expiresAt: iso(expiry), inGracePeriod: false, onHold: false });
    const u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status, ms(u.premium_until)], [true, 'active', expiry]);
    const row = await rowOf(w.d, T(1));
    assert.equal(row.kind, 'pro_sub');
    assert.equal(row.sub_state, SUB_STATE.active);
    assert.equal(ms(row.access_until), expiry);
    assert.ok(row.acknowledged_at, 'noted as acknowledged');
    assert.ok(!JSON.stringify(row.raw).includes('student@example.com'), 'no personal data stored');
    assert.equal(w.google.count('suback'), 1, 'acknowledged once, by the server');
    assert.equal(w.granted.length, 1);

    const again = await w.verify('u1', T(1));
    assert.equal(again.ok, true);
    assert.equal(again.idempotent, true);
    assert.equal(ms(again.pro.premiumUntil), expiry, 'nothing granted twice: the same date');
    assert.equal(w.google.count('suback'), 1, 'not acknowledged twice');
    assert.equal(w.granted.length, 1, 'the paid side effect runs once');
    assert.equal((await q(w.d, 'select count(*)::int n from public.play_purchases'))[0].n, 1);
  } finally { await w.close(); }
});

test('verify: a pending payment is a 202 and records nothing; a pending purchase that was cancelled is refused', async () => {
  const w = await world();
  try {
    w.set(T(2), 'u1', { state: SUB_STATE.pending });
    const p = await w.verify('u1', T(2));
    assert.deepEqual([p.status, p.code, p.pending], [202, 'purchase_pending', true]);
    w.set(T(3), 'u1', { state: SUB_STATE.pendingCanceled });
    assert.equal((await w.verify('u1', T(3))).code, 'purchase_canceled');
    assert.equal((await q(w.d, 'select count(*)::int n from public.play_purchases'))[0].n, 0);
    assert.equal(w.google.count('suback'), 0, 'nothing acknowledged');
    assert.equal((await userRow(w.d, 'u1')).is_premium, false);
  } finally { await w.close(); }
});

test('verify: a purchase made by another account is refused (403); a token another account holds is refused (409); nothing is acknowledged', async () => {
  const w = await world();
  try {
    w.set(T(4), 'u1');
    const wrongHash = await w.verify('u2', T(4));
    assert.deepEqual([wrongHash.status, wrongHash.code], [403, 'account_mismatch']);
    assert.equal(w.google.count('suback'), 0);
    assert.equal((await w.verify('u2', T(4), { obfuscatedAccountId: playAccountHash('u1') })).code, 'account_mismatch', 'the app saying it is u1 changes nothing');
    assert.equal((await w.verify('u1', T(4))).ok, true);
    // u2 somehow presents u1's token: the row decides.
    w.google.subs.get(T(4)).externalAccountIdentifiers = { obfuscatedExternalAccountId: playAccountHash('u2') };
    const stolen = await w.verify('u2', T(4));
    assert.deepEqual([stolen.status, stolen.code], [409, 'purchase_already_used']);
    assert.equal((await userRow(w.d, 'u2')).is_premium, false);
    // A one-time product id with a subscription token, or the reverse, is refused.
    assert.equal((await verifyPlayPurchase(w.deps, { userId: 'u1', productId: 'pro_cuet_2027', purchaseToken: T(4) })).code, 'product_mismatch');
  } finally { await w.close(); }
});

test('verify: a resubscribe made in the Play Store (no account id) is bound only through the expired token the same account held', async () => {
  const w = await world();
  try {
    w.set(T(5), 'u1');
    await w.verify('u1', T(5));
    // A resubscribe after expiry, made outside the app: Google carries the expired token and its account ids.
    w.set(T(5), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - DAY });
    w.set(T(6), 'u1', { account: null, outOfApp: { expiredPurchaseToken: T(5) } });
    assert.equal((await w.verify('u2', T(6))).code, 'account_mismatch', 'another account cannot claim it');
    const mine = await w.verify('u1', T(6));
    assert.equal(mine.ok, true, JSON.stringify(mine));
    assert.equal((await rowOf(w.d, T(5))).superseded_by, T(6), 'the expired token is replaced');
    // Google's record of the expired subscription's account id also binds it.
    w.set(T(7), 'u3', { account: null, outOfApp: { expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: playAccountHash('u3') } } });
    assert.equal((await w.verify('u4', T(7))).code, 'account_mismatch');
    assert.equal((await w.verify('u3', T(7))).ok, true);
    // No account id and nothing to link: refused (Google refunds it after three days).
    w.set(T(8), 'u4', { account: null });
    assert.equal((await w.verify('u4', T(8))).code, 'account_mismatch');
  } finally { await w.close(); }
});

test('verify: when the acknowledge fails the grant stands (finished false) and the next verify acknowledges it', async () => {
  const w = await world();
  try {
    w.set(T(9), 'u1');
    w.google.failAck = true;
    const first = await w.verify('u1', T(9));
    assert.equal(first.ok, true);
    assert.equal(first.finished, false);
    assert.equal((await userRow(w.d, 'u1')).is_premium, true, 'Pro is on: the money was taken');
    assert.equal((await rowOf(w.d, T(9))).acknowledged_at, null);
    w.google.failAck = false;
    const second = await w.verify('u1', T(9));
    assert.equal(second.finished, true);
    assert.ok((await rowOf(w.d, T(9))).acknowledged_at);
  } finally { await w.close(); }
});

test('verify: Google unreachable or the token unknown grants nothing; a database failure is a 503', async () => {
  const w = await world();
  try {
    assert.equal((await w.verify('u1', T(10))).code, 'purchase_not_found');
    w.set(T(10), 'u1');
    w.google.unreachable = true;
    assert.deepEqual([(await w.verify('u1', T(10))).status, (await w.verify('u1', T(10))).code], [503, 'play_unavailable']);
    w.google.unreachable = false;
    const real = w.store.syncSubscription;
    w.store.syncSubscription = async () => { throw new Error('db down'); };
    assert.equal((await w.verify('u1', T(10))).code, 'grant_unavailable');
    assert.equal(w.google.count('suback'), 0, 'not acknowledged while unrecorded');
    w.store.syncSubscription = real;
    assert.equal((await w.verify('u1', T(10))).ok, true);
  } finally { await w.close(); }
});

test('verify: a subscription Google holds as on hold, paused or ended says so (409) with its dates, and Pro is off', async () => {
  const w = await world();
  try {
    w.set(T(11), 'u1');
    await w.verify('u1', T(11));
    w.set(T(11), 'u1', { state: SUB_STATE.hold, expiry: Date.now() - 1000, ack: true });
    const hold = await w.verify('u1', T(11));
    assert.deepEqual([hold.status, hold.code, hold.subscription.onHold, hold.pro.isPremium], [409, 'subscription_on_hold', true, false]);
    w.set(T(11), 'u1', { state: SUB_STATE.paused, ack: true });
    assert.equal((await w.verify('u1', T(11))).code, 'subscription_paused');
    w.set(T(11), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - DAY, ack: true });
    assert.equal((await w.verify('u1', T(11))).code, 'subscription_ended');
    assert.equal((await userRow(w.d, 'u1')).is_premium, false);
    // A token never granted that has ended is not recorded at all.
    w.set(T(12), 'u2', { state: SUB_STATE.expired, expiry: Date.now() - DAY });
    assert.equal((await w.verify('u2', T(12))).code, 'subscription_ended');
    assert.equal(await rowOf(w.d, T(12)), null);
  } finally { await w.close(); }
});

// ---- notifications --------------------------------------------------------------------------------------------------
test('RTDN RENEWED: Google is asked, premium_until moves to the new expiryTime', async () => {
  const w = await world();
  try {
    const first = Date.now() + 5 * 60_000; // a licence tester's month is five minutes
    w.set(T(20), 'u1', { expiry: first });
    await w.verify('u1', T(20));
    const next = first + 5 * 60_000;
    w.set(T(20), 'u1', { expiry: next, ack: true });
    const out = await w.notify(T(20), 2);
    assert.deepEqual([out.action, out.type, out.entitled], ['synced', 'RENEWED', true]);
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), next);
    assert.equal(ms((await rowOf(w.d, T(20))).access_until), next);
    assert.equal(w.google.count('suback'), 1, 'a renewal needs no acknowledge');
  } finally { await w.close(); }
});

test('RTDN CANCELED: Pro stays until the paid date, auto-renew off, status cancelled; then EXPIRED switches it off', async () => {
  const w = await world();
  try {
    const expiry = Date.now() + 12 * DAY;
    w.set(T(21), 'u1', { expiry });
    await w.verify('u1', T(21));
    w.set(T(21), 'u1', { state: SUB_STATE.canceled, expiry, autoRenew: false, ack: true });
    const out = await w.notify(T(21), 3);
    assert.equal(out.entitled, true);
    let u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status, ms(u.premium_until)], [true, 'cancelled', expiry]);
    assert.equal((await rowOf(w.d, T(21))).auto_renewing, false);
    // RESTARTED before expiry: back to renewing.
    w.set(T(21), 'u1', { expiry, ack: true });
    await w.notify(T(21), 7);
    assert.equal((await userRow(w.d, 'u1')).subscription_status, 'active');
    // EXPIRED.
    w.set(T(21), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, autoRenew: false, ack: true });
    const ended = await w.notify(T(21), 13);
    assert.equal(ended.isPremium, false);
    u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status], [false, 'cancelled']);
    assert.ok(ms(u.premium_until) <= Date.now(), 'the end date stays on record, in the past');
  } finally { await w.close(); }
});

test('RTDN IN_GRACE_PERIOD keeps Pro (past_due) through the extended expiryTime; ON_HOLD blocks it; RECOVERED brings it back', async () => {
  const w = await world();
  try {
    w.set(T(22), 'u1', { expiry: Date.now() + 1000 });
    await w.verify('u1', T(22));
    const graceEnd = Date.now() + 3 * DAY;
    w.set(T(22), 'u1', { state: SUB_STATE.grace, expiry: graceEnd, ack: true });
    await w.notify(T(22), 6);
    let u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status, ms(u.premium_until)], [true, 'past_due', graceEnd]);
    w.set(T(22), 'u1', { state: SUB_STATE.hold, expiry: Date.now() - 60_000, ack: true });
    const hold = await w.notify(T(22), 5);
    assert.deepEqual([hold.entitled, hold.isPremium], [false, false]);
    u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status], [false, 'past_due'], 'Google: block access during account hold');
    assert.ok(ms((await rowOf(w.d, T(22))).access_until) <= Date.now(), 'the row is out of force');
    const back = Date.now() + 30 * DAY;
    w.set(T(22), 'u1', { expiry: back, ack: true });
    await w.notify(T(22), 1);
    u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status, ms(u.premium_until)], [true, 'active', back]);
  } finally { await w.close(); }
});

test('RTDN PAUSED blocks Pro; RECOVERED (resumed) restores it', async () => {
  const w = await world();
  try {
    w.set(T(23), 'u1');
    await w.verify('u1', T(23));
    w.set(T(23), 'u1', { state: SUB_STATE.paused, expiry: Date.now() - 1000, ack: true });
    await w.notify(T(23), 10);
    assert.equal((await userRow(w.d, 'u1')).is_premium, false);
    w.set(T(23), 'u1', { ack: true });
    await w.notify(T(23), 1);
    assert.equal((await userRow(w.d, 'u1')).is_premium, true);
  } finally { await w.close(); }
});

test('RTDN REVOKED: Pro off at once and the date cleared; if Google has not caught up yet the push fails so Pub/Sub retries', async () => {
  const w = await world();
  try {
    w.set(T(24), 'u1');
    await w.verify('u1', T(24));
    // Google still says ACTIVE: never act on the payload alone, and never keep the revoke silently either.
    await assert.rejects(() => w.notify(T(24), 12), /retry/);
    assert.equal((await userRow(w.d, 'u1')).is_premium, true, 'nothing changed yet');
    w.set(T(24), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    const out = await w.notify(T(24), 12);
    assert.equal(out.isPremium, false);
    const u = await userRow(w.d, 'u1');
    assert.deepEqual([u.is_premium, u.subscription_status, u.premium_until], [false, 'cancelled', null]);
    assert.equal((await rowOf(w.d, T(24))).revoked.reason, 'revoked');
  } finally { await w.close(); }
});

test('expiry with Razorpay Pro still running keeps Pro to the Razorpay date; without it Pro goes off', async () => {
  const w = await world();
  try {
    const rzp = Date.now() + 20 * DAY;
    await w.d.query("insert into public.payments values ('p1','u1','pay_1',9900,'captured',$1,'pro_monthly_99')", [iso(rzp)]);
    w.set(T(25), 'u1', { expiry: Date.now() + 5 * DAY });
    const r = await w.verify('u1', T(25));
    assert.equal(ms(r.pro.premiumUntil), rzp, 'the later of the two');
    assert.equal(r.pro.duplicate, true, 'flagged: Pro was already paid for elsewhere through that date');
    w.set(T(25), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    const out = await w.notify(T(25), 13);
    assert.equal(out.isPremium, true, 'Razorpay Pro is not switched off by a Play expiry');
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), rzp);

    // A credit-pack payment is not Pro evidence.
    await w.d.query("insert into public.payments values ('p2','u2','pay_2',4900,'captured',$1,'credits_49_300')", [iso(rzp)]);
    w.set(T(26), 'u2');
    await w.verify('u2', T(26));
    w.set(T(26), 'u2', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    assert.equal((await w.notify(T(26), 13)).isPremium, false);
    assert.equal((await userRow(w.d, 'u2')).is_premium, false);
  } finally { await w.close(); }
});

test('a Razorpay or one-time revoke weighs a Play subscription in force as other paid access', async () => {
  const w = await world();
  try {
    // A one-time Play Pro voided while the subscription runs: Pro stays.
    await q(w.d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8)', ['u1', T(27), 'GPA.1', 'pro_cuet_2027', 'pro', null, '2027-07-31T18:29:59.999Z', {}]);
    w.set(T(28), 'u1');
    await w.verify('u1', T(28));
    const r = (await q(w.d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4) r', [T(27), 'voided', null, {}]))[0].r;
    assert.equal(r.revoked.keptForOtherPaidAccess, true);
    assert.equal((await userRow(w.d, 'u1')).is_premium, true);
    // Found on the staging dry-run: the refunded pass's 31 July 2027 date must not live on behind the monthly subscription.
    const subEnd = ms((await rowOf(w.d, T(28))).access_until);
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), subEnd, 'premium_until shrinks to the subscription date');
    w.set(T(28), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    await w.notify(T(28), 12);
    assert.equal((await userRow(w.d, 'u1')).is_premium, false, 'and a revoke of the subscription then switches Pro off');
    w.set(T(28), 'u1', { ack: true });
    await w.d.query("update public.play_purchases set revoked = null where purchase_token = $1", [T(28)]);
    await w.notify(T(28), 1);
    assert.equal((await userRow(w.d, 'u1')).is_premium, true, 'Google says it is back: Pro is back');
    // A subscription out of force is not evidence.
    w.set(T(28), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    await w.notify(T(28), 13);
    await q(w.d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8)', ['u1', T(29), 'GPA.2', 'pro_cuet_2027', 'pro', null, '2027-07-31T18:29:59.999Z', {}]);
    const r2 = (await q(w.d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4) r', [T(29), 'voided', null, {}]))[0].r;
    assert.equal(r2.revoked.proSwitchedOff, true);
  } finally { await w.close(); }
});

test('linkedPurchaseToken: the new token supersedes the old one; the old one\'s later EXPIRED never switches Pro off; nothing counts twice', async () => {
  const w = await world();
  try {
    const firstEnd = Date.now() + 10 * DAY;
    w.set(T(30), 'u1', { expiry: firstEnd });
    await w.verify('u1', T(30));
    // Re-subscribe (or a plan change) before expiry: a new token linked to the old.
    w.set(T(31), 'u1', { expiry: firstEnd, linked: T(30) });
    const r = await w.verify('u1', T(31));
    assert.equal(r.ok, true);
    assert.equal(w.google.count('suback'), 2, 'the new token is acknowledged too');
    const old = await rowOf(w.d, T(30));
    assert.equal(old.superseded_by, T(31));
    assert.ok(ms(old.access_until) <= Date.now(), 'the old row is out of force');
    assert.equal((await q(w.d, "select count(*)::int n from public.play_purchases where user_id='u1' and kind='pro_sub' and access_until > now()"))[0].n, 1, 'one row in force');
    // Google expires the old token: Pro stays (the new one runs).
    w.set(T(30), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    const out = await w.notify(T(30), 13);
    assert.equal(out.isPremium, true);
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), firstEnd);
    // Even a stale ACTIVE answer for the old token never makes it count again.
    w.set(T(30), 'u1', { expiry: Date.now() + 99 * DAY, ack: true });
    await w.notify(T(30), 2);
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), firstEnd, 'a replaced token grants nothing');
    // The old token cannot be moved to another account either.
    w.google.subs.get(T(30)).externalAccountIdentifiers = { obfuscatedExternalAccountId: playAccountHash('u2') };
    assert.equal((await w.verify('u2', T(30))).code, 'purchase_already_used');
    // Revoking the new one switches Pro off: the replaced token is not other paid access.
    w.set(T(31), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true, linked: T(30) });
    await w.notify(T(31), 12);
    assert.equal((await userRow(w.d, 'u1')).is_premium, false);
  } finally { await w.close(); }
});

test('RTDN for a token never verified: waits for verify; a replacement of a known token is bound to its owner and acknowledged by the server', async () => {
  const w = await world();
  try {
    w.set(T(40), 'u1');
    const wait = await w.notify(T(40), 4);
    assert.equal(wait.action, 'awaiting_verify');
    assert.equal(await rowOf(w.d, T(40)), null, 'only verify binds a new purchase to an account');
    await w.verify('u1', T(40));
    // A resubscribe from the Play Store: no account id, linked to u1's token. The student may never open the app.
    w.set(T(41), 'u1', { account: null, linked: T(40) });
    const bound = await w.notify(T(41), 4);
    assert.deepEqual([bound.action, bound.boundThrough, bound.finished], ['synced', 'linked_token', true]);
    assert.equal((await rowOf(w.d, T(41))).user_id, 'u1');
    // The same, but Google's account id is someone else's: left alone.
    w.set(T(42), 'u1', { account: playAccountHash('u2'), linked: T(41) });
    assert.equal((await w.notify(T(42), 4)).reason, 'account_mismatch');
    assert.equal(await rowOf(w.d, T(42)), null);
  } finally { await w.close(); }
});

test('RTDN: every subscription notification type asks Google and follows its answer; Google down answers 5xx for a retry', async () => {
  const w = await world();
  try {
    w.set(T(50), 'u1');
    await w.verify('u1', T(50));
    for (const type of Object.keys(SUBSCRIPTION_NOTIFICATION).map(Number)) {
      if (type === 12) continue; // REVOKED: its own test
      const before = w.google.count('subget');
      const out = await w.notify(T(50), type);
      assert.equal(out.action, 'synced', `type ${type}`);
      assert.equal(out.type, SUBSCRIPTION_NOTIFICATION[type]);
      assert.equal(w.google.count('subget'), before + 1, `type ${type} re-read Google`);
      assert.equal((await userRow(w.d, 'u1')).is_premium, true, `type ${type}: Google says active, so Pro stays`);
    }
    assert.equal((await w.notify(T(50), 999)).type, 'TYPE_999', 'an unknown type is still checked with Google');
    w.google.unreachable = true;
    await assert.rejects(() => w.notify(T(50), 2), (e) => e.code === 'play_unavailable');
    w.google.unreachable = false;
    // A token Google has forgotten (60 days after expiry) that we hold: it has ended.
    w.google.subs.delete(T(50));
    const gone = await w.notify(T(50), 13);
    assert.equal(gone.entitled, false);
    assert.equal((await userRow(w.d, 'u1')).is_premium, false);
    assert.equal((await w.notify(T(51), 13)).reason, 'not_found', 'one we never held is ignored');
    assert.equal((await w.notify('short', 2)).reason, 'bad_token');
  } finally { await w.close(); }
});

test('RTDN voided subscription order: Google decides; still active keeps Pro, revoked switches it off and records the void', async () => {
  const w = await world();
  try {
    w.set(T(60), 'u1');
    await w.verify('u1', T(60));
    const voided = (token) => handlePlayNotification(w.deps, { version: '1.0', packageName: PKG, voidedPurchaseNotification: { purchaseToken: token, orderId: 'GPA.3300-0000-0000-00001..0', productType: 1, refundType: 1 } });
    const kept = await voided(T(60));
    assert.deepEqual([kept.action, kept.type, kept.isPremium], ['synced', 'VOIDED', true]);
    w.set(T(60), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    const off = await voided(T(60));
    assert.equal(off.isPremium, false);
    assert.equal((await rowOf(w.d, T(60))).revoked.reason, 'voided');
  } finally { await w.close(); }
});

// ---- SQL ------------------------------------------------------------------------------------------------------------
test('SQL: sync is idempotent per token and refuses another account, a voided token and a one-time row', async () => {
  const d = await database();
  try {
    const sync = (user, token, state, expiry, extra = {}) => q(d, 'select public.mm_play_sync_subscription($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r', [user, token, extra.product || 'pro_monthly', state, expiry, true, extra.linked || null, 'GPA.1', 'monthly', {}, extra.reason || null]).then((r) => r[0].r);
    const exp = iso(Date.now() + 9 * DAY);
    const a = await sync('u1', T(70), SUB_STATE.active, exp);
    assert.deepEqual([a.ok, a.recorded, a.idempotent, a.entitled, a.isPremium], [true, true, false, true, true]);
    const b = await sync('u1', T(70), SUB_STATE.active, exp);
    assert.equal(b.idempotent, true);
    assert.equal((await q(d, 'select count(*)::int n from public.play_purchases'))[0].n, 1);
    assert.equal((await sync('u2', T(70), SUB_STATE.active, exp)).error, 'purchase_already_used');
    assert.equal((await sync(null, T(71), SUB_STATE.active, exp)).error, 'unknown_purchase', 'a notification cannot create a row');
    assert.equal((await sync('u1', T(70), SUB_STATE.active, exp, { product: 'other' })).error, 'product_mismatch');
    await q(d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4)', [T(72), 'voided', null, {}]);
    assert.equal((await sync('u1', T(72), SUB_STATE.active, exp)).error, 'purchase_voided', 'a tombstone is never granted');
    await q(d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8)', ['u3', T(73), 'GPA.9', 'pro_cuet_2027', 'pro', null, '2027-07-31T18:29:59.999Z', {}]);
    assert.equal((await sync('u3', T(73), SUB_STATE.active, exp)).error, 'product_mismatch');
    assert.equal((await sync('u1', T(74), SUB_STATE.active, exp)).ok, true);
    assert.equal((await sync('nobody', T(75), SUB_STATE.active, exp)).error, 'user_not_found');
    assert.equal((await sync('u1', '', SUB_STATE.active, exp)).error, 'missing_field');
  } finally { await d.close(); }
});

test('SQL: Pro with no end date (an older grant outside Play) is never touched by a subscription', async () => {
  const d = await database();
  try {
    await d.query("update public.users set is_premium = true, subscription_status = 'active', premium_until = null where id = 'u5'");
    await q(d, 'select public.mm_play_sync_subscription($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', ['u5', T(80), 'pro_monthly', SUB_STATE.active, iso(Date.now() + DAY), true, null, null, 'monthly', {}, null]);
    await q(d, 'select public.mm_play_sync_subscription($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [null, T(80), 'pro_monthly', SUB_STATE.expired, iso(Date.now() - DAY), false, null, null, 'monthly', {}, 'revoked']);
    const u = await userRow(d, 'u5');
    assert.deepEqual([u.is_premium, u.premium_until], [true, null]);
  } finally { await d.close(); }
});

test('SQL privileges: sync is security definer with a pinned search_path, executable by service_role alone; RLS stays on', async () => {
  const d = await database();
  try {
    const fn = 'public.mm_play_sync_subscription(text,text,text,text,timestamptz,boolean,text,text,text,jsonb,text)';
    const g = await q(d, `select r.rolname, has_function_privilege(r.rolname, '${fn}', 'execute') ok from pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 1`);
    assert.deepEqual(g, [{ rolname: 'anon', ok: false }, { rolname: 'authenticated', ok: false }, { rolname: 'service_role', ok: true }]);
    assert.equal((await q(d, "select count(*)::int n from pg_proc where proname in ('mm_play_sync_subscription','mm_play_revoke_purchase') and prosecdef and proconfig::text like '%search_path=public, pg_temp%'"))[0].n, 2);
    assert.equal((await q(d, "select relrowsecurity r from pg_class where relname='play_purchases'"))[0].r, true);
    assert.equal((await q(d, "select count(*)::int n from pg_policies where tablename='play_purchases'"))[0].n, 0);
    const t = await q(d, "select has_table_privilege('anon','public.play_purchases','select') a, has_table_privilege('authenticated','public.play_purchases','select') b");
    assert.deepEqual(t, [{ a: false, b: false }]);
    await assert.rejects(() => d.query("insert into public.play_purchases (purchase_token, kind) values ('x', 'nonsense')"), /check/i, 'the kind check still holds');
  } finally { await d.close(); }
});

test('the migration is idempotent; the undo removes the subscription parts only while no subscription is recorded', async () => {
  const d = await database();
  try {
    await d.exec(SUBS_MIGRATION); // twice is fine
    await q(d, 'select public.mm_play_sync_subscription($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', ['u1', T(90), 'pro_monthly', SUB_STATE.active, iso(Date.now() + DAY), true, null, null, 'monthly', {}, null]);
    await d.exec(SUBS_UNDO);
    assert.equal((await q(d, "select count(*)::int n from pg_proc where proname = 'mm_play_sync_subscription'"))[0].n, 0, 'the function is gone');
    assert.equal((await q(d, "select count(*)::int n from information_schema.columns where table_name='play_purchases' and column_name='sub_state'"))[0].n, 1, 'columns kept while a subscription is recorded');
    assert.equal((await userRow(d, 'u1')).is_premium, true, 'what was granted stays');
    await d.exec("delete from public.play_purchases where kind = 'pro_sub'");
    await d.exec(SUBS_UNDO);
    assert.equal((await q(d, "select count(*)::int n from information_schema.columns where table_name='play_purchases' and column_name in ('sub_state','expiry_time','superseded_by')"))[0].n, 0, 'columns dropped');
    await assert.rejects(() => d.query("insert into public.play_purchases (purchase_token, kind) values ('y', 'pro_sub')"), /check/i, 'the kind check is back to one-time products');
    // The 18 Oct revoke still works after the undo.
    await q(d, 'select public.mm_play_grant_purchase($1,$2,$3,$4,$5,$6,$7,$8)', ['u2', T(91), 'GPA.1', 'pro_cuet_2027', 'pro', null, '2027-07-31T18:29:59.999Z', {}]);
    assert.equal((await q(d, 'select public.mm_play_revoke_purchase($1,$2,$3,$4) r', [T(91), 'voided', null, {}]))[0].r.revoked.proSwitchedOff, true);
    await d.exec(SUBS_MIGRATION); // and it comes back
    assert.equal((await q(d, 'select public.mm_play_sync_subscription($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r', ['u3', T(92), 'pro_monthly', SUB_STATE.active, iso(Date.now() + DAY), true, null, null, 'monthly', {}, null]))[0].r.ok, true);
  } finally { await d.close(); }
});

// ---- Google client --------------------------------------------------------------------------------------------------
test('the Google client calls subscriptionsv2.get and purchases.subscriptions.acknowledge', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const key = { type: 'service_account', client_email: 'sa@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: DEFAULT_TOKEN_URI };
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body });
    if (String(url) === DEFAULT_TOKEN_URI) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  const client = createPlayClient({ env: { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify(key) }, fetch });
  await client.getSubscriptionV2(T(1));
  await client.acknowledgeSubscription('pro_monthly', T(1));
  assert.equal(calls[1].url, `${PLAY_API_BASE}/applications/in.mockmob.app/purchases/subscriptionsv2/tokens/${T(1)}`);
  assert.equal(calls[1].method, 'GET');
  assert.equal(calls[2].url, `${PLAY_API_BASE}/applications/in.mockmob.app/purchases/subscriptions/pro_monthly/tokens/${T(1)}:acknowledge`);
  assert.equal(calls[2].method, 'POST');
});

// ---- the routes -----------------------------------------------------------------------------------------------------
test('verify route: the subscription answer carries its state; a 409 for an ended subscription carries the dates too', async () => {
  const w = await world();
  try {
    const deps = { enabled: () => true, auth: async () => ({ user: { id: 'u1' } }), rateLimit: async () => ({ allowed: true }), billing: w.deps };
    const post = (body) => handlePlayVerify(deps, new Request('http://x/api/billing/play/verify', { method: 'POST', body: JSON.stringify(body) }));
    w.set(T(100), 'u1');
    const ok = await post({ productId: 'pro_monthly', purchaseToken: T(100), price: 1, premiumUntil: '2099-01-01' });
    const body = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(body.subscription.state, 'active');
    assert.ok(ms(body.pro.premiumUntil) < Date.parse('2099-01-01'), 'a client date is never read');
    w.set(T(100), 'u1', { state: SUB_STATE.hold, expiry: Date.now() - 1000, ack: true });
    const held = await post({ productId: 'pro_monthly', purchaseToken: T(100) });
    const hb = await held.json();
    assert.deepEqual([held.status, hb.code, hb.subscription.onHold, hb.pro.isPremium], [409, 'subscription_on_hold', true, false]);
  } finally { await w.close(); }
});

test('RTDN route: a subscription notification is authenticated, processed once and answered 5xx when Google cannot be reached', async () => {
  const w = await world();
  try {
    const events = new Map();
    const deps = {
      enabled: () => true, env: { PLAY_RTDN_TOKEN: 'rtdn-secret' },
      billing: { store: w.store, google: w.google, packageName: PKG, log: quiet },
      claimEvent: async ({ eventId }) => { if (events.has(eventId)) return events.get(eventId) === 'done' ? false : 'in_flight'; events.set(eventId, 'claimed'); return true; },
      markProcessed: async (id) => { events.set(id, 'done'); },
      markFailed: async (id) => { events.delete(id); },
    };
    const push = (n, id) => handlePlayRtdn(deps, new Request('http://x/api/billing/play/rtdn?token=rtdn-secret', { method: 'POST', body: JSON.stringify({ message: { data: Buffer.from(JSON.stringify(n)).toString('base64'), messageId: id } }) }));
    const renewed = (t) => ({ version: '1.0', packageName: PKG, eventTimeMillis: '1', subscriptionNotification: { version: '1.0', notificationType: 2, purchaseToken: t } });
    w.set(T(110), 'u1');
    await w.verify('u1', T(110));
    const next = Date.now() + 40 * DAY;
    w.set(T(110), 'u1', { expiry: next, ack: true });
    const res = await push(renewed(T(110)), 'm1');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).action, 'synced');
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), next);
    assert.equal((await (await push(renewed(T(110)), 'm1')).json()).duplicate, true, 'the same message twice is processed once');
    w.google.unreachable = true;
    assert.equal((await push(renewed(T(110)), 'm2')).status, 500, 'Pub/Sub retries');
    w.google.unreachable = false;
    assert.equal((await push(renewed(T(110)), 'm2')).status, 200, 'and the retry is processed');
  } finally { await w.close(); }
});

// ---- wiring ---------------------------------------------------------------------------------------------------------
test('wiring: the store calls the sync function, RTDN gets the Google client, db.js counts subscriptions in force by date', () => {
  const deps = file('src/lib/server/playBillingDeps.js');
  assert.match(deps, /syncSubscription: \(x\) => rpc\('mm_play_sync_subscription'/);
  assert.match(deps, /billing: \{ store: playStore, google, packageName: google\.packageName\(\) \}/);
  const db = file('data/db.js');
  assert.match(db, /\.in\('kind', \['pro', 'pro_sub'\]\)/);
  assert.match(db, /\.gt\('access_until', new Date\(nowMs\)\.toISOString\(\)\)/, 'a row out of force is not paid access');
  assert.match(db, /async getPlaySubscription\(userId, nowMs = Date\.now\(\)\)/);
  assert.match(file('src/app/api/auth/me/route.js'), /playSubscription: playSubscription \|\| null/);
  const card = file('src/components/billing/PlanCard.jsx');
  assert.match(card, /https:\/\/play\.google\.com\/store\/account\/subscriptions\?sku=pro_monthly&package=in\.mockmob\.app/);
  assert.match(card, /Pro renews every month through Google Play\./);
  assert.doesNotMatch(card.slice(card.indexOf('playShown ? (')), /₹149/, 'the web card names no Play price');
  const pkg = JSON.parse(file('package.json'));
  assert.match(pkg.scripts['test:billing'], /data\/tests\/play_subscriptions\.test\.mjs/);
});

// ---- review fixes (19 Oct night) ------------------------------------------------------------------------------------
test('review: an unbacked premium_until never carries itself forward (hold, web 2027 pass, recover, Razorpay refund, cancel, expiry: Pro off)', async () => {
  const w = await world();
  try {
    const PASS = '2027-07-31T18:29:59.999Z';
    w.set(T(90), 'u1', { expiry: Date.now() + 10 * DAY });
    await w.verify('u1', T(90));
    // Account hold: Pro off, so the web lets the student buy the 2027 pass (verify-payment writes the payment and the date).
    w.set(T(90), 'u1', { state: SUB_STATE.hold, expiry: Date.now() - 1000, ack: true });
    await w.notify(T(90), 5);
    assert.equal((await userRow(w.d, 'u1')).is_premium, false);
    await w.d.query("insert into public.payments values ('pw','u1','pay_w',29900,'captured',$1,'pro_cuet_2027')", [PASS]);
    await w.d.query("update public.users set is_premium = true, subscription_status = 'active', premium_until = $1 where id = 'u1'", [PASS]);
    // RECOVERED: the pass is backed by its payment, so 2027 stands.
    const subEnd = Date.now() + 30 * DAY;
    w.set(T(90), 'u1', { expiry: subEnd, ack: true });
    await w.notify(T(90), 1);
    assert.equal(ms((await userRow(w.d, 'u1')).premium_until), ms(PASS));
    // A Razorpay refund of the pass, in the worst case (the route left users.premium_until at 2027).
    await w.d.query("update public.payments set status = 'cancelled', amount_paid = 0, access_until = null where id = 'pw'");
    w.set(T(90), 'u1', { state: SUB_STATE.canceled, expiry: subEnd, autoRenew: false, ack: true });
    await w.notify(T(90), 3);
    let u = await userRow(w.d, 'u1');
    assert.equal(u.is_premium, true, 'the subscription is paid to its date');
    assert.equal(ms(u.premium_until), subEnd, 'nothing backs 2027 any more, so the date is the subscription date');
    w.set(T(90), 'u1', { state: SUB_STATE.expired, expiry: Date.now() - 1000, autoRenew: false, ack: true });
    await w.notify(T(90), 13);
    u = await userRow(w.d, 'u1');
    assert.equal(u.is_premium, false, 'Pro is off when the subscription ends: no free Pro to 2027');
    assert.ok(ms(u.premium_until) < Date.now());
  } finally { await w.close(); }
});

test('review: a legacy Pro payment with no end date still backs a premium_until beyond the subscription', async () => {
  const w = await world();
  try {
    const far = Date.now() + 200 * DAY;
    await w.d.query("insert into public.payments values ('pl','u2','pay_l',29900,'captured',null,'pro_cuet_2026')");
    await w.d.query("update public.users set is_premium = true, subscription_status = 'active', premium_until = $1 where id = 'u2'", [iso(far)]);
    w.set(T(91), 'u2', { expiry: Date.now() + 5 * DAY });
    await w.verify('u2', T(91));
    w.set(T(91), 'u2', { state: SUB_STATE.expired, expiry: Date.now() - 1000, ack: true });
    await w.notify(T(91), 13);
    const u = await userRow(w.d, 'u2');
    assert.deepEqual([u.is_premium, ms(u.premium_until)], [true, far]);
  } finally { await w.close(); }
});

test('review: a Razorpay refund kept for other paid access lowers premium_until to that access (all four refund paths)', async () => {
  const { loadBilling, resetWorld, signedWebhook, webhookEvent, subscriptionEntity, paymentEntity, hmac, TEST_ENV } = await import('./billing_harness.mjs');
  const b = await loadBilling();
  const PASS = '2027-07-31T18:29:59.999Z';
  const playEnd = iso(Date.now() + 20 * DAY);
  const fire = async (name, parts) => (await b.webhook.POST(signedWebhook(webhookEvent(name, parts)).request)).status;
  const post = (handler, body) => handler.POST(new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const passHolder = (db) => {
    db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: PASS });
    db.addPayment({ userId: 'u1', orderId: 'order_once', planId: 'pro_cuet_2027', amount: 9900, status: 'captured', paymentId: 'pay_once', amountPaid: 9900, accessUntil: PASS, rawOrder: { amount: 9900 } });
    db._revocations.push({ userId: 'u1', metadata: { paymentId: 'pay_once' } });
  };
  const orderRow = (db) => db._payments.find((p) => p.orderId === 'order_once');

  // 1. webhook, one-time order, with a Play subscription in force: Pro stays, on the Play date, not 2027.
  let db = resetWorld();
  passHolder(db);
  db._play.push({ userId: 'u1', accessUntil: playEnd });
  assert.equal(await fire('payment.captured', { payment: paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null }) }), 200);
  assert.equal(orderRow(db).status, 'cancelled');
  assert.deepEqual([db.user('u1').isPremium, db.user('u1').premiumUntil], [true, playEnd]);

  // 2. verify-payment, one-time order: the same.
  db = resetWorld();
  passHolder(db);
  db._play.push({ userId: 'u1', accessUntil: playEnd });
  globalThis.__mmSession = { user: { id: 'u1' } };
  const res = await post(b.verify, { razorpay_order_id: 'order_once', razorpay_payment_id: 'pay_once', userId: 'u1', razorpay_signature: hmac('order_once|pay_once', TEST_ENV.RAZORPAY_KEY_SECRET) });
  assert.equal(res.status, 409);
  assert.equal(orderRow(db).status, 'cancelled');
  assert.deepEqual([db.user('u1').isPremium, db.user('u1').premiumUntil], [true, playEnd]);

  // 3. webhook, refunded monthly subscription, kept by Play: the Razorpay month's date goes, the Play date stays.
  const rzpEnd = iso(Date.now() + 25 * DAY);
  const playSoon = iso(Date.now() + 10 * DAY);
  const monthly = (db, extra = {}) => {
    db.addUser('u1', { subscription_status: 'active', is_premium: true, premium_until: rzpEnd, razorpay_subscription_id: 'sub_m1' });
    db.addPayment({ userId: 'u1', subscriptionId: 'sub_m1', planId: 'pro_monthly_99', amount: 9900, status: 'captured', paymentId: 'pay_m1', amountPaid: 9900, accessUntil: rzpEnd, ...extra });
    db._revocations.push({ userId: 'u1', metadata: { subscriptionId: 'sub_m1' } });
    db._play.push({ userId: 'u1', accessUntil: playSoon });
  };
  db = resetWorld();
  monthly(db, { razorpayPlanId: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99 });
  await fire('subscription.charged', { subscription: subscriptionEntity(), payment: paymentEntity() });
  assert.equal(db.payment('sub_m1').status, 'cancelled');
  assert.deepEqual([db.user('u1').isPremium, db.user('u1').premiumUntil], [true, playSoon]);

  // 4. verify-payment, refunded subscription: the same.
  db = resetWorld();
  monthly(db);
  globalThis.__mmSession = { user: { id: 'u1' } };
  await post(b.verify, { razorpay_subscription_id: 'sub_m1', razorpay_payment_id: 'pay_m1', userId: 'u1', razorpay_signature: hmac('pay_m1|sub_m1', TEST_ENV.RAZORPAY_KEY_SECRET) });
  assert.equal(db.payment('sub_m1').status, 'cancelled');
  assert.deepEqual([db.user('u1').isPremium, db.user('u1').premiumUntil], [true, playSoon]);

  // Never shortened behind a legacy payment with no end date, and never raised.
  db = resetWorld();
  passHolder(db);
  db.addPayment({ userId: 'u1', orderId: 'order_old', planId: 'pro_cuet_2026', amount: 9900, status: 'captured', paymentId: 'pay_old', amountPaid: 9900, accessUntil: null });
  await fire('payment.captured', { payment: paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null }) });
  assert.equal(db.user('u1').premiumUntil, PASS, 'access with no known end: nothing is shortened');
  db = resetWorld();
  passHolder(db);
  db._play.push({ userId: 'u1', accessUntil: '2028-01-01T00:00:00.000Z' });
  await fire('payment.captured', { payment: paymentEntity({ id: 'pay_once', order_id: 'order_once', invoice_id: null }) });
  assert.equal(db.user('u1').premiumUntil, PASS, 'a later other date never raises premium_until here');
  globalThis.__mmSession = null;
});
