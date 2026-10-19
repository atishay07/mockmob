// Google Play subscriptions, server side: monthly Pro on Play (owner D135/D136, 19 Oct 2026: subscription `pro_monthly`,
// base plan `monthly`, Rs 149 a month in Play Console; the web keeps its Rs 99 Razorpay monthly).
// No Next.js, Supabase or network imports: the store (database) and the Google client are injected, so node:test drives
// every path (data/tests/play_subscriptions.test.mjs) and the routes wire the real ones (playBillingDeps.js).
//
// Rules:
//   - Google decides. Every verify and every Real-time Developer Notification re-reads the subscription with
//     purchases.subscriptionsv2.get; a notification's own type is only a reason to ask, never the answer.
//   - Pro is on while Google's subscriptionState is ACTIVE, IN_GRACE_PERIOD or CANCELED and the line item's expiryTime is
//     still ahead (Google's entitlement rules: grace keeps access and Google extends expiryTime through it; account hold,
//     pause and expiry end it, and a revoke is reported as EXPIRED). The database keeps premium_until = expiryTime.
//   - One row per purchase token (play_purchases, kind 'pro_sub'), written by mm_play_sync_subscription in one transaction
//     with the user's plan columns. The function also weighs the student's other paid access (a Razorpay Pro payment, a
//     Play Pro still in force), so Play and Razorpay never switch each other off.
//   - A purchase is bound to the account whose hash Google holds (obfuscatedExternalAccountId). A new token that replaces
//     an old one (upgrade, resubscribe: linkedPurchaseToken, or outOfAppPurchaseContext.expiredPurchaseToken) supersedes
//     the old row, so one subscription is never counted twice; a token another account holds is refused.
//   - The server acknowledges a new subscription after the grant (Google refunds one that is not acknowledged within
//     three days; three minutes for licence testers). The app never acknowledges.
import { getPlayProduct } from './playProducts.js';
import { TOKEN_PATTERN, playAccountHash, fail, logger, playFailure } from './playShared.js';

export const SUB_STATE = Object.freeze({
  pending: 'SUBSCRIPTION_STATE_PENDING',
  active: 'SUBSCRIPTION_STATE_ACTIVE',
  paused: 'SUBSCRIPTION_STATE_PAUSED',
  grace: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  hold: 'SUBSCRIPTION_STATE_ON_HOLD',
  canceled: 'SUBSCRIPTION_STATE_CANCELED',
  expired: 'SUBSCRIPTION_STATE_EXPIRED',
  pendingCanceled: 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED',
});
/** The states in which Google says the student keeps access (until expiryTime). */
const ENTITLING = new Set([SUB_STATE.active, SUB_STATE.grace, SUB_STATE.canceled]);
const ACKNOWLEDGED = 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';

/** subscriptionNotification.notificationType, from Google's RTDN reference (accessed 19 Oct 2026). */
export const SUBSCRIPTION_NOTIFICATION = Object.freeze({
  1: 'RECOVERED', 2: 'RENEWED', 3: 'CANCELED', 4: 'PURCHASED', 5: 'ON_HOLD', 6: 'IN_GRACE_PERIOD', 7: 'RESTARTED',
  8: 'PRICE_CHANGE_CONFIRMED', 9: 'DEFERRED', 10: 'PAUSED', 11: 'PAUSE_SCHEDULE_CHANGED', 12: 'REVOKED', 13: 'EXPIRED',
  17: 'ITEMS_CHANGED', 18: 'CANCELLATION_SCHEDULED', 19: 'PRICE_CHANGE_UPDATED', 20: 'PENDING_PURCHASE_CANCELED',
  22: 'PRICE_STEP_UP_CONSENT_UPDATED',
});

const validToken = (t) => (typeof t === 'string' && TOKEN_PATTERN.test(t) ? t : null);
const shortState = (state) => (typeof state === 'string' && state.startsWith('SUBSCRIPTION_STATE_') ? state.slice('SUBSCRIPTION_STATE_'.length).toLowerCase() : 'unknown');

/** The parts of a SubscriptionPurchaseV2 the server uses, for one subscription product. */
export function readSubscription(sub, productId, nowMs) {
  const items = Array.isArray(sub?.lineItems) ? sub.lineItems : [];
  const item = items.find((i) => i?.productId === productId) || null;
  const expiryMs = item?.expiryTime ? Date.parse(item.expiryTime) : NaN;
  const state = typeof sub?.subscriptionState === 'string' ? sub.subscriptionState : null;
  const outOfApp = sub?.outOfAppPurchaseContext || null;
  return {
    item,
    state,
    expiresAt: Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null,
    entitled: Boolean(item) && ENTITLING.has(state) && Number.isFinite(expiryMs) && expiryMs > nowMs,
    autoRenewing: item?.autoRenewingPlan ? item.autoRenewingPlan.autoRenewEnabled === true : null,
    basePlanId: typeof item?.offerDetails?.basePlanId === 'string' ? item.offerDetails.basePlanId : null,
    orderId: typeof item?.latestSuccessfulOrderId === 'string' && item.latestSuccessfulOrderId ? item.latestSuccessfulOrderId
      : (typeof sub?.latestOrderId === 'string' && sub.latestOrderId ? sub.latestOrderId : null),
    linkedToken: validToken(sub?.linkedPurchaseToken),
    expiredToken: validToken(outOfApp?.expiredPurchaseToken),
    accountId: sub?.externalAccountIdentifiers?.obfuscatedExternalAccountId || null,
    expiredAccountId: outOfApp?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId || null,
    acknowledged: sub?.acknowledgementState === ACKNOWLEDGED,
    test: Boolean(sub?.testPurchase),
  };
}

/** What is stored of Google's answer: no names, emails or account ids (subscribeWithGoogleInfo, externalAccountIdentifiers). */
export function subscriptionRecord(sub, extra = {}) {
  const items = Array.isArray(sub?.lineItems) ? sub.lineItems : [];
  const canceled = sub?.canceledStateContext && typeof sub.canceledStateContext === 'object' ? Object.keys(sub.canceledStateContext)[0] || null : null;
  return {
    subscriptionState: sub?.subscriptionState || null,
    startTime: sub?.startTime || null,
    regionCode: sub?.regionCode || null,
    acknowledgementState: sub?.acknowledgementState || null,
    linkedPurchaseToken: sub?.linkedPurchaseToken ? true : false,
    testPurchase: Boolean(sub?.testPurchase),
    canceledReason: canceled,
    lineItems: items.map((i) => ({
      productId: i?.productId || null,
      expiryTime: i?.expiryTime || null,
      autoRenewEnabled: i?.autoRenewingPlan ? i.autoRenewingPlan.autoRenewEnabled === true : null,
      basePlanId: i?.offerDetails?.basePlanId || null,
      offerId: i?.offerDetails?.offerId || null,
      latestSuccessfulOrderId: i?.latestSuccessfulOrderId || null,
    })),
    ...extra,
  };
}

/** What the app is told about the subscription (all it needs for its words and its Manage subscription key). */
export function subscriptionSummary(product, r) {
  return {
    productId: product.productId,
    state: shortState(r.state),
    active: r.entitled,
    autoRenewing: r.autoRenewing,
    expiresAt: r.expiresAt,
    inGracePeriod: r.state === SUB_STATE.grace,
    onHold: r.state === SUB_STATE.hold,
  };
}

const SYNC_ERRORS = Object.freeze({
  purchase_already_used: [409, 'This purchase already belongs to another account.'],
  purchase_voided: [409, 'Google refunded this purchase, so it grants nothing.'],
  product_mismatch: [409, 'This purchase token belongs to a different product.'],
  user_not_found: [404, 'Account not found.'],
});

/** Acknowledge with Google, then note it. Never throws: true when Google now holds it as acknowledged. */
async function acknowledge({ store, google, productId, token, log }) {
  try {
    await google.acknowledgeSubscription(productId, token);
  } catch (error) {
    // The grant stands. Google refunds an unacknowledged subscription after three days, so the next verify or
    // notification must acknowledge it.
    logger(log)('warn', `could not acknowledge ${productId}: ${error?.code || ''} ${error?.message || error}`);
    return false;
  }
  try { await store.markFinished(token, { acknowledged: true }); } catch { /* Google holds it as acknowledged; the note follows next time */ }
  return true;
}

/** Google already holds it as acknowledged: make our row say so too (quietly). */
async function noteAcknowledged(store, token, row) {
  if (row?.acknowledged_at) return;
  try { await store.markFinished(token, { acknowledged: true }); } catch { /* bookkeeping only */ }
}

/**
 * Does this subscription belong to the signed-in user? Google's account id must be the user's hash. A purchase without one
 * (a resubscribe made in the Play Store, outside the app) is the user's only when Google links it to a token this very
 * user already holds with us, or when Google's record of the expired subscription carries the user's hash.
 */
async function belongsTo(store, r, userId, existing) {
  const expected = playAccountHash(userId);
  if (r.accountId) return r.accountId === expected;
  if (r.expiredAccountId) return r.expiredAccountId === expected;
  if (existing?.user_id === userId) return true;
  for (const token of [r.linkedToken, r.expiredToken]) {
    if (!token) continue;
    const prev = await store.getByToken(token);
    if (prev?.user_id === userId && prev.kind === 'pro_sub') return true;
  }
  return false;
}

/**
 * Verify a subscription for a signed-in user, record it, and acknowledge it.
 * deps: { store, google, packageName, now?, log?, onGranted? }
 * input: { userId, product, purchaseToken, obfuscatedAccountId?, packageName? }
 */
export async function verifyPlaySubscription(deps, input) {
  const { store, google, packageName } = deps;
  const now = (deps.now || Date.now)();
  const { userId, product, purchaseToken } = input;
  if (!userId) return fail(401, 'unauthenticated', 'Sign in first.');
  if (typeof purchaseToken !== 'string' || !TOKEN_PATTERN.test(purchaseToken)) return fail(400, 'bad_token', 'The purchase token is missing or malformed.');
  if (input.packageName !== undefined && input.packageName !== null && input.packageName !== packageName) {
    return fail(400, 'wrong_package', 'That purchase is for a different app.');
  }
  if (input.obfuscatedAccountId !== undefined && input.obfuscatedAccountId !== null && input.obfuscatedAccountId !== playAccountHash(userId)) {
    return fail(403, 'account_mismatch', 'This purchase was not made by the signed-in account.');
  }

  const existing = await store.getByToken(purchaseToken);
  if (existing) {
    if (existing.state === 'voided') return fail(409, 'purchase_voided', SYNC_ERRORS.purchase_voided[1]);
    if (existing.user_id !== userId) return fail(409, 'purchase_already_used', SYNC_ERRORS.purchase_already_used[1]);
    if (existing.kind !== 'pro_sub' || existing.product_id !== product.productId) return fail(409, 'product_mismatch', SYNC_ERRORS.product_mismatch[1]);
  }

  let sub;
  try {
    sub = await google.getSubscriptionV2(purchaseToken);
  } catch (error) {
    logger(deps.log)('warn', `subscriptionsv2.get failed: ${error?.code || ''} ${error?.message || error}`);
    return playFailure(error);
  }
  if (!sub || typeof sub !== 'object') return fail(503, 'play_unavailable', 'Google Play gave an unreadable answer. Nothing was granted.');

  const r = readSubscription(sub, product.productId, now);
  if (!r.item) return fail(400, 'product_mismatch', SYNC_ERRORS.product_mismatch[1]);
  if (r.state === SUB_STATE.pending) {
    return fail(202, 'purchase_pending', 'The payment is still pending. Pro starts as soon as it completes, and you will not be charged twice.', { pending: true });
  }
  if (r.state === SUB_STATE.pendingCanceled) return fail(409, 'purchase_canceled', 'This purchase was cancelled before it was paid.');
  if (!(await belongsTo(store, r, userId, existing))) {
    return fail(403, 'account_mismatch', 'This purchase was not made by the signed-in account.');
  }

  let synced;
  try {
    synced = await store.syncSubscription({
      userId, purchaseToken, productId: product.productId, state: r.state, expiresAt: r.expiresAt, autoRenewing: r.autoRenewing,
      linkedToken: r.linkedToken || r.expiredToken, orderId: r.orderId, basePlanId: r.basePlanId,
      raw: subscriptionRecord(sub, { via: 'verify' }), reason: null,
    });
  } catch (error) {
    logger(deps.log)('error', `subscription sync failed: ${error?.message || error}`);
    return fail(503, 'grant_unavailable', 'The purchase could not be recorded just now. Nothing was lost: try again in a minute.');
  }
  if (!synced?.ok) {
    const [status, message] = SYNC_ERRORS[synced?.error] || [500, 'The purchase could not be recorded.'];
    return fail(status, synced?.error || 'grant_failed', message);
  }

  const summary = subscriptionSummary(product, r);
  const pro = { isPremium: Boolean(synced.isPremium), premiumUntil: synced.premiumUntil || null, duplicate: Boolean(synced.duplicatePro) };
  if (!r.entitled) {
    // Google says the subscription does not give access now. The row and the plan are already in step with that.
    if (r.acknowledged) await noteAcknowledged(store, purchaseToken, existing);
    const [code, message] = r.state === SUB_STATE.hold
      ? ['subscription_on_hold', 'Google Play could not take the latest payment, so Pro is paused. Update the payment method in Google Play and Pro comes back.']
      : r.state === SUB_STATE.paused
        ? ['subscription_paused', 'This subscription is paused in Google Play. Resume it there to turn Pro back on.']
        : ['subscription_ended', 'This subscription has ended, so it does not include Pro any more.'];
    return fail(409, code, message, { subscription: summary, pro });
  }

  let finished = r.acknowledged;
  if (r.acknowledged) await noteAcknowledged(store, purchaseToken, existing);
  else finished = await acknowledge({ store, google, productId: product.productId, token: purchaseToken, log: deps.log });

  if (deps.onGranted && !existing) {
    try { await deps.onGranted({ userId, product }); } catch { /* a side effect never fails a paid purchase */ }
  }
  return {
    ok: true, idempotent: Boolean(existing), productId: product.productId, kind: product.kind, finished, orderId: r.orderId,
    pro, subscription: summary,
  };
}

const FINAL_SYNC_ERRORS = new Set(['purchase_voided', 'purchase_already_used', 'product_mismatch', 'user_not_found', 'unknown_purchase']);

/**
 * One subscription notification (or a voided subscription order). deps: { store, google, packageName, now?, log? }.
 * Returns { action: 'synced' | 'awaiting_verify' | 'logged' | 'ignored', ... }. Throws when Google or the database could not
 * be reached, or when Google has not caught up with a revoke yet, so the push is answered 5xx and Pub/Sub retries.
 */
export async function handleSubscriptionNotification(deps, { purchaseToken, notificationType = null, voided = null, eventTimeMillis = null }) {
  const { store, google } = deps;
  const log = logger(deps.log);
  const now = (deps.now || Date.now)();
  const type = voided ? 'VOIDED' : (SUBSCRIPTION_NOTIFICATION[notificationType] || `TYPE_${notificationType ?? 'unknown'}`);
  const token = validToken(purchaseToken);
  if (!token) return { action: 'ignored', reason: 'bad_token', type };
  const row = await store.getByToken(token);
  if (row && row.kind && row.kind !== 'pro_sub') return { action: 'ignored', reason: 'not_a_subscription', type };
  if (!google?.getSubscriptionV2) throw new Error('the Google Play client is not wired for subscriptions');

  let sub;
  try {
    sub = await google.getSubscriptionV2(token);
  } catch (error) {
    if (error?.code === 'purchase_not_found' && row) {
      // Google forgets a token 60 days after it expires: it has ended.
      sub = { subscriptionState: SUB_STATE.expired, lineItems: [{ productId: row.product_id, expiryTime: row.expiry_time || row.access_until || null }] };
    } else if (error?.code === 'purchase_not_found' || error?.code === 'purchase_invalid') {
      return { action: 'ignored', reason: 'not_found', type };
    } else {
      throw error;
    }
  }

  const productId = row?.product_id || (Array.isArray(sub?.lineItems) ? sub.lineItems.map((i) => i?.productId).find((id) => getPlayProduct(id)?.kind === 'pro_sub') : null);
  const product = getPlayProduct(productId);
  if (!product || product.kind !== 'pro_sub') return { action: 'ignored', reason: 'unknown_product', type };
  const r = readSubscription(sub, product.productId, now);

  // A revoke takes access away at once. If Google still shows the subscription in force, it has not caught up yet: answer
  // 5xx so Pub/Sub sends the notification again later, and act on Google's record then.
  if (type === 'REVOKED' && r.entitled) throw new Error('revoke notified but Google still shows the subscription in force; retry later');

  let bindTo = null;
  if (!row) {
    // A token we have never seen. Only verify can bind a purchase to a signed-in account, except a replacement (upgrade or
    // resubscribe, possibly made in the Play Store) of a token this server already holds, whose owner matches every
    // account id Google holds for it. Google wants such a resubscribe acknowledged even if the student never opens the app.
    for (const t of [r.linkedToken, r.expiredToken]) {
      if (!t) continue;
      const prev = await store.getByToken(t);
      if (prev?.user_id && prev.kind === 'pro_sub') { bindTo = prev.user_id; break; }
    }
    if (!bindTo) return { action: 'awaiting_verify', type, state: shortState(r.state) };
    const ids = [r.accountId, r.expiredAccountId].filter(Boolean);
    if (ids.length && !ids.includes(playAccountHash(bindTo))) {
      log('warn', `${type}: a replacement token whose account id is not its predecessor's owner; left for verify`);
      return { action: 'ignored', reason: 'account_mismatch', type };
    }
    if (!r.entitled) return { action: 'logged', type, state: shortState(r.state) };
  }

  const synced = await store.syncSubscription({
    userId: bindTo, purchaseToken: token, productId: product.productId, state: r.state, expiresAt: r.expiresAt,
    autoRenewing: r.autoRenewing, linkedToken: r.linkedToken || r.expiredToken, orderId: r.orderId, basePlanId: r.basePlanId,
    raw: subscriptionRecord(sub, { via: 'rtdn', notification: type, eventTimeMillis: eventTimeMillis || null, ...(voided ? { voidedOrderId: voided.orderId || null } : {}) }),
    reason: type === 'REVOKED' ? 'revoked' : (voided ? 'voided' : null),
  });
  if (!synced?.ok) {
    if (FINAL_SYNC_ERRORS.has(synced?.error)) return { action: 'ignored', reason: synced.error, type };
    throw new Error(`subscription sync failed: ${synced?.error || 'unknown'}`);
  }

  let finished = r.acknowledged;
  if (r.acknowledged) await noteAcknowledged(store, token, row);
  else if (r.entitled) finished = await acknowledge({ store, google, productId: product.productId, token, log: deps.log });

  return {
    action: 'synced', type, state: shortState(r.state), entitled: r.entitled, isPremium: Boolean(synced.isPremium),
    premiumUntil: synced.premiumUntil || null, finished, ...(bindTo ? { boundThrough: 'linked_token' } : {}),
  };
}
