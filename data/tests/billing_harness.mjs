// Test harness for the real billing routes. No network and no database: the Razorpay client is
// the real SDK object with its network methods replaced, the database is an in-memory fake that
// mirrors data/db.js semantics (derived isPremium, partial payment patches, webhook claims), and
// webhooks are signed with the test secret exactly the way Razorpay signs them.
//
// Test keys only. Nothing here reads a real secret.
import crypto from 'node:crypto';
import { register, createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { effectivePremiumFromRow, refundRevocationMatchesPayment } from '../../src/lib/payments/entitlements.js';
import { claimWebhookEventWith } from '../../src/lib/server/webhookClaim.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TEST_ENV = {
  RAZORPAY_KEY_ID: 'rzp_test_harness',
  RAZORPAY_KEY_SECRET: 'harness_key_secret',
  RAZORPAY_WEBHOOK_SECRET: 'harness_webhook_secret',
  RAZORPAY_PLAN_ID_PRO_MONTHLY_99: 'plan_harness_monthly_99',
};
for (const [k, v] of Object.entries(TEST_ENV)) process.env[k] = v;

const ROOT_URL = pathToFileURL(`${root}/`).href;
const HOOKS = `
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
const ROOT = ${JSON.stringify(ROOT_URL)};
const STUBS = {
  'server-only': 'export {};',
  '@/../data/db': 'export const Database = new Proxy({}, { get: (_, k) => globalThis.__mmDb[k] });',
  '@/lib/auth': 'export async function auth() { return globalThis.__mmSession; }',
  '@/lib/server/rateLimit': 'export async function checkPersistentRateLimit() { return { allowed: true }; }',
  '@/lib/referrals/offers': 'export async function resolveCreatorCode() { return null; }',
  '@/services/credits/aiCreditWallet': 'export const getAICreditPack = () => null; export async function grantPurchasedAICredits() { return { ok: true }; }',
};
const ours = (url) => typeof url === 'string' && url.startsWith(ROOT) && !url.includes('/node_modules/');
const isFile = (url) => { try { return statSync(fileURLToPath(url)).isFile(); } catch { return false; } };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(STUBS, specifier)) return { url: 'stub:' + specifier, shortCircuit: true };
  if (specifier === 'next/server') return next('next/server.js', context);
  if (ours(context.parentURL) && (specifier.startsWith('@/') || specifier.startsWith('./') || specifier.startsWith('../'))) {
    const base = specifier.startsWith('@/') ? new URL('src/' + specifier.slice(2), ROOT).href : new URL(specifier, context.parentURL).href;
    for (const ext of ['', '.js', '.jsx', '.mjs']) if (isFile(base + ext)) return { url: base + ext, shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith('stub:')) return { format: 'module', source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, context);
}
`;

const toIso = (ms) => new Date(ms).toISOString();

/** An in-memory stand-in for data/db.js covering what the billing routes call. */
export function createFakeDatabase() {
  const users = new Map();
  const payments = [];
  const events = new Map();
  const revocations = [];
  let seq = 0;

  const userOut = (row) => row && ({
    id: row.id,
    name: row.name || 'Student',
    email: row.email || `${row.id}@example.test`,
    subscriptionStatus: row.subscription_status || 'free',
    isPremium: effectivePremiumFromRow(row),
    premiumUntil: row.premium_until || null,
    razorpaySubscriptionId: row.razorpay_subscription_id || null,
  });
  const paid = (p) => Boolean(p.paymentId) && Number(p.amountPaid) > 0 && ['captured', 'completed', 'paid'].includes(p.status);
  const copy = (p) => p && JSON.parse(JSON.stringify(p));
  const patchPayment = (p, u) => {
    for (const key of ['paymentId', 'status', 'amountPaid', 'accessUntil', 'creatorCode', 'creatorId', 'offerId', 'referralCodeAttempted', 'referralStatus', 'rawOrder', 'rawPayment', 'rawSubscription']) {
      if (u[key] !== undefined) p[key] = u[key];
    }
  };

  const db = {
    _users: users,
    _payments: payments,
    _events: events,
    _revocations: revocations,
    addUser(id, row = {}) {
      users.set(id, { id, subscription_status: 'free', is_premium: false, premium_until: null, razorpay_subscription_id: null, ...row });
      return users.get(id);
    },
    addPayment(p) {
      // A paid subscription was created about one cycle before its paid-through date.
      const createdAt = p.createdAt ?? (p.accessUntil ? new Date(p.accessUntil).getTime() - 30 * 86400_000 : Date.now() - 3600_000);
      const row = { id: `payrec_${++seq}`, amount: 9900, currency: 'INR', status: 'created', amountPaid: null, accessUntil: null, paymentId: null, rawOrder: {}, rawSubscription: {}, rawPayment: {}, ...p, createdAt };
      payments.push(row);
      return row;
    },
    user: (id) => userOut(users.get(id)),
    rawUser: (id) => users.get(id),
    payment: (subscriptionId) => copy(payments.find((p) => p.subscriptionId === subscriptionId)),
    async getUserById(id) { return userOut(users.get(id)); },
    async updateUser(id, updates) {
      const row = users.get(id);
      if (!row) return null;
      if ('subscriptionStatus' in updates) row.subscription_status = updates.subscriptionStatus;
      if ('isPremium' in updates) row.is_premium = updates.isPremium;
      if ('premiumUntil' in updates) row.premium_until = updates.premiumUntil;
      if ('razorpaySubscriptionId' in updates) row.razorpay_subscription_id = updates.razorpaySubscriptionId;
      return userOut(row);
    },
    async createPayment(p) {
      const row = { id: `payrec_${++seq}`, currency: 'INR', status: 'created', createdAt: Date.now(), amountPaid: null, accessUntil: null, paymentId: null, rawOrder: {}, rawSubscription: {}, rawPayment: {}, ...p };
      payments.push(row);
      return copy(row);
    },
    async getPaymentBySubscriptionId(id) { return copy(payments.find((p) => p.subscriptionId === id)) || null; },
    async getPaymentByOrderId(id) { return copy(payments.find((p) => p.orderId === id)) || null; },
    async updatePaymentBySubscriptionId(id, u) { const p = payments.find((x) => x.subscriptionId === id); if (p) patchPayment(p, u); return copy(p) || null; },
    async updatePaymentByOrderId(id, u) { const p = payments.find((x) => x.orderId === id); if (p) patchPayment(p, u); return copy(p) || null; },
    async hasOtherPaidSubscriptionEvidence({ userId, excludingSubscriptionId = null, excludingPaymentId = null } = {}) {
      return payments.some((p) => p.userId === userId && paid(p) && p.subscriptionId !== excludingSubscriptionId && p.paymentId !== excludingPaymentId);
    },
    async getOtherPaidAccess({ userId, excludingSubscriptionId = null, excludingPaymentId = null } = {}) {
      let hasOtherPaid = false;
      let accessUntil = null;
      for (const p of payments) {
        if (p.userId !== userId || !paid(p)) continue;
        if (excludingSubscriptionId && p.subscriptionId === excludingSubscriptionId) continue;
        if (excludingPaymentId && p.paymentId === excludingPaymentId) continue;
        hasOtherPaid = true;
        if (p.accessUntil && (!accessUntil || new Date(p.accessUntil) > new Date(accessUntil))) accessUntil = toIso(new Date(p.accessUntil).getTime());
      }
      return { hasOtherPaid, accessUntil };
    },
    async hasRefundPremiumRevocation({ userId, subscriptionId = null, paymentId = null } = {}) {
      if (!userId || (!subscriptionId && !paymentId)) return false;
      return revocations.some((r) => r.userId === userId && refundRevocationMatchesPayment(r.metadata, { subscriptionId, paymentId }));
    },
    async getCreatorById() { return null; },
    async setPaymentEarning() {},
    // The real claim decision (src/lib/server/webhookClaim.js) over an in-memory table, so the lease behaves as in production.
    // db.clock() is the time the claim sees; a test moves it to expire a lease.
    clock: () => Date.now(),
    async claimWebhookEvent({ eventId, eventType, payload, provider = 'razorpay' }) {
      const matches = (row, filter) => {
        // the filter string from reclaimFilter(), evaluated here: noted or failed, or unprocessed with no live lease
        const cutoff = filter.split('claimed_at.lt.')[1].split(')')[0];
        return row.error_message != null || (row.processed_at == null && (row.claimed_at == null || row.claimed_at < cutoff));
      };
      return claimWebhookEventWith({
        insert: async (r) => {
          if (events.has(r.event_id)) return { error: { code: '23505' } };
          events.set(r.event_id, { eventId: r.event_id, eventType: r.event_type, payload: r.payload, processed_at: null, error_message: null, claimed_at: r.claimed_at });
          return { error: null };
        },
        read: async (id) => ({ data: events.get(id) || null, error: null }),
        reclaim: async (id, patch, filter) => {
          const row = events.get(id);
          if (!row || !matches(row, filter)) return { data: [], error: null };
          Object.assign(row, { eventType: patch.event_type, payload: patch.payload, processed_at: patch.processed_at, error_message: patch.error_message, claimed_at: patch.claimed_at });
          return { data: [{ event_id: id }], error: null };
        },
        legacy: async () => { throw new Error('legacy claim must not be used in the harness'); },
      }, { eventId, eventType, payload, provider }, { now: db.clock() });
    },
    async markWebhookEventProcessed(eventId, message = null) { const r = events.get(eventId); if (r) { r.processed_at = 'now'; r.error_message = message; } },
    async markWebhookEventFailed(eventId, message = null) { const r = events.get(eventId); if (r) { r.processed_at = null; r.error_message = message || 'unknown error'; } },
  };
  return db;
}

let cached = null;

/** Loads the real routes once. Returns the handlers plus the fakes tests drive. */
export async function loadBilling() {
  if (cached) return cached;
  register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);
  const url = (rel) => pathToFileURL(resolve(root, rel)).href;
  const [webhook, verify, cancel, create, razorpay, plans, legacyWebhook] = await Promise.all([
    import(url('src/app/webhook/route.js')),
    import(url('src/app/verify-payment/route.js')),
    import(url('src/app/api/billing/cancel/route.js')),
    import(url('src/app/create-monthly-subscription/route.js')),
    import(url('src/lib/payments/razorpay.js')),
    import(url('src/lib/payments/plans.js')),
    import(url('src/app/api/billing/webhook/route.js')),
  ]);

  // The real SDK object, with every network method replaced by a recording fake.
  const client = razorpay.getRazorpayClient();
  const rz = {
    calls: [],
    invoices: new Map(),
    subscriptions: new Map(),
    payments: new Map(),
    failNextInvoiceFetch: false,
    rejectCancel: null,
    created: [],
  };
  client.invoices.fetch = async (id) => {
    rz.calls.push(['invoices.fetch', id]);
    if (rz.failNextInvoiceFetch) { rz.failNextInvoiceFetch = false; throw new Error('simulated Razorpay outage'); }
    // Real renewal payments carry an invoice id. Unless a test registers one, it belongs to sub_m1.
    return rz.invoices.get(id) || { id, entity: 'invoice', subscription_id: 'sub_m1' };
  };
  client.subscriptions.fetch = async (id) => {
    rz.calls.push(['subscriptions.fetch', id]);
    if (!rz.subscriptions.has(id)) throw new Error(`no fake subscription ${id}`);
    return rz.subscriptions.get(id);
  };
  client.subscriptions.cancel = async (id, atCycleEnd) => {
    rz.calls.push(['subscriptions.cancel', id, atCycleEnd]);
    if (rz.rejectCancel) throw rz.rejectCancel;
    return { id, status: 'active', has_scheduled_changes: true };
  };
  client.subscriptions.create = async (payload) => {
    rz.calls.push(['subscriptions.create', payload]);
    const sub = { id: `sub_new_${rz.created.length + 1}`, status: 'created', plan_id: payload.plan_id, notes: payload.notes };
    rz.created.push(sub);
    return sub;
  };
  client.payments.fetch = async (id) => {
    rz.calls.push(['payments.fetch', id]);
    if (!rz.payments.has(id)) throw new Error(`no fake payment ${id}`);
    return rz.payments.get(id);
  };

  cached = { webhook, verify, cancel, create, razorpay, plans, legacyWebhook, rz };
  return cached;
}

export function resetWorld() {
  const db = createFakeDatabase();
  globalThis.__mmDb = db;
  globalThis.__mmSession = null;
  return db;
}

export const hmac = (body, secret) => crypto.createHmac('sha256', secret).update(body).digest('hex');

let eventCounter = 0;

/** A signed webhook request the way Razorpay sends it. */
export function signedWebhook(event, { id = `evt_${++eventCounter}_${Date.now()}`, secret = TEST_ENV.RAZORPAY_WEBHOOK_SECRET, signature, withEventId = true } = {}) {
  const body = typeof event === 'string' ? event : JSON.stringify(event);
  const headers = { 'content-type': 'application/json', 'x-razorpay-signature': signature === undefined ? hmac(body, secret) : signature };
  if (withEventId) headers['x-razorpay-event-id'] = id;
  return { request: new Request('http://localhost/webhook', { method: 'POST', headers, body }), id };
}

const sec = (ms) => Math.floor(ms / 1000);

export function subscriptionEntity(over = {}) {
  const now = Date.now();
  return {
    id: 'sub_m1', entity: 'subscription', plan_id: TEST_ENV.RAZORPAY_PLAN_ID_PRO_MONTHLY_99, status: 'active',
    current_start: sec(now), current_end: sec(now + 30 * 86400_000), total_count: 24, paid_count: 1, remaining_count: 23,
    notes: { kind: 'monthly_subscription', userId: 'u1', planId: 'pro_monthly_99' }, ...over,
  };
}

export function paymentEntity(over = {}) {
  return {
    id: 'pay_m1', entity: 'payment', amount: 9900, currency: 'INR', status: 'captured', method: 'upi',
    order_id: 'order_m1', invoice_id: 'inv_m1', created_at: sec(Date.now()), notes: {}, ...over,
  };
}

export function webhookEvent(name, { subscription = null, payment = null } = {}) {
  const payload = {};
  if (subscription) payload.subscription = { entity: subscription };
  if (payment) payload.payment = { entity: payment };
  return { entity: 'event', account_id: 'acc_test', event: name, contains: Object.keys(payload), payload, created_at: sec(Date.now()) };
}

export const DAY = 86400_000;
export const FAR_ONE_TIME_UNTIL = '2027-07-31T18:29:59.999Z';
export const iso = toIso;
