// Google Play purchases, server side: verify a purchase, grant it once, finish it with Google; take it back when Google
// voids it. No Next.js, Supabase or network imports: the store (database) and the google client are injected, so node:test
// drives every path (data/tests/play_billing.test.mjs) and the routes wire the real ones (playBillingDeps.js).
//
// Rules (owner decision 18 Oct 2026):
//   - The server decides what a purchase is worth: the product id maps to a grant (playProducts.js). A price, an amount or a
//     credit count sent by a client is never read.
//   - A purchase is granted only when Google itself says it is purchased (purchaseState 0), is for this package, is one
//     unit, and was made by this very account (obfuscatedExternalAccountId equals the hash of the signed-in user's id).
//   - The grant and its play_purchases row are one database transaction (mm_play_grant_purchase), unique on the purchase
//     token: a replay returns the same result and grants nothing twice; another account presenting the token is refused.
//   - After the grant the server acknowledges Pro (kept, never consumed) or consumes a credit pack (so it can be bought
//     again). If Google cannot be reached at that moment the grant stands, the answer says finished:false, and the next
//     replay finishes it.
import { getPlayProduct } from './playProducts.js';
import { TOKEN_PATTERN, playAccountHash, fail, logger, playFailure } from './playShared.js';
import { verifyPlaySubscription, handleSubscriptionNotification } from './playSubscriptions.js';

export { TOKEN_PATTERN, playAccountHash };

export const PLAY_FLAG = 'PLAY_BILLING_ENABLED';
/** The flag is off unless it is exactly 'true', like MOB_ENABLED. */
export const playBillingEnabled = (env = process.env) => env[PLAY_FLAG] === 'true';

const PURCHASE_STATE = Object.freeze({ purchased: 0, canceled: 1, pending: 2 });

/** One finishing step. Never throws: returns true when the purchase is now acknowledged (Pro) or consumed (pack). */
async function finishPurchase({ store, google, product, token, purchase, log }) {
  try {
    if (product.finish === 'consume') {
      if (Number(purchase?.consumptionState) !== 1) await google.consume(product.productId, token);
      await store.markFinished(token, { acknowledged: true, consumed: true });
    } else {
      if (Number(purchase?.acknowledgementState) !== 1) await google.acknowledge(product.productId, token);
      await store.markFinished(token, { acknowledged: true });
    }
    return true;
  } catch (error) {
    // The grant stands. Google refunds an unacknowledged purchase after three days, so the next replay must finish it.
    logger(log)('warn', `could not ${product.finish} ${product.productId}: ${error?.code || ''} ${error?.message || error}`);
    return false;
  }
}

function resultBody({ product, idempotent, granted, finished, orderId }) {
  const body = { ok: true, idempotent, productId: product.productId, kind: product.kind, finished, orderId: orderId || null };
  if (product.kind === 'pro') {
    body.pro = { isPremium: true, premiumUntil: granted?.premiumUntil || product.accessUntil, duplicate: Boolean(granted?.duplicatePro) };
  } else {
    body.credits = { granted: Number(granted?.credits ?? product.credits), balance: Number.isFinite(Number(granted?.balance)) ? Number(granted.balance) : null };
  }
  return body;
}

const GRANT_ERRORS = Object.freeze({
  purchase_already_used: [409, 'This purchase already belongs to another account.'],
  purchase_voided: [409, 'Google refunded this purchase, so it grants nothing.'],
  product_mismatch: [409, 'This purchase token belongs to a different product.'],
  user_not_found: [404, 'Account not found.'],
});

/**
 * Verify and grant one purchase for a signed-in user.
 * deps: { store, google, packageName, now?, log? }
 * input: { userId, productId, purchaseToken, orderId?, obfuscatedAccountId?, packageName? }
 * Returns { ok: true, ... } or { ok: false, status, code, message }.
 */
export async function verifyPlayPurchase(deps, input) {
  const { store, google, packageName } = deps;
  const now = (deps.now || Date.now)();
  const { userId, productId, purchaseToken } = input;
  if (!userId) return fail(401, 'unauthenticated', 'Sign in first.');

  const product = getPlayProduct(productId);
  if (!product) return fail(400, 'unknown_product', 'That product is not sold on Google Play.');
  // The monthly Pro subscription (owner D135/D136, 19 Oct 2026) has its own path: purchases.subscriptionsv2.
  if (product.kind === 'pro_sub') return verifyPlaySubscription(deps, { ...input, product });
  if (typeof purchaseToken !== 'string' || !TOKEN_PATTERN.test(purchaseToken)) return fail(400, 'bad_token', 'The purchase token is missing or malformed.');
  if (input.packageName !== undefined && input.packageName !== null && input.packageName !== packageName) {
    return fail(400, 'wrong_package', 'That purchase is for a different app.');
  }
  const expectedAccount = playAccountHash(userId);
  if (input.obfuscatedAccountId !== undefined && input.obfuscatedAccountId !== null && input.obfuscatedAccountId !== expectedAccount) {
    return fail(403, 'account_mismatch', 'This purchase was not made by the signed-in account.');
  }
  if (product.kind === 'pro' && Date.parse(product.accessUntil) <= now) {
    return fail(409, 'product_expired', 'This pass has ended and can no longer be bought.');
  }

  // A replay: answered from our own record, then finished with Google if that step was missed last time.
  const existing = await store.getByToken(purchaseToken);
  if (existing) {
    if (existing.state === 'voided') return fail(409, 'purchase_voided', GRANT_ERRORS.purchase_voided[1]);
    if (existing.user_id !== userId) return fail(409, 'purchase_already_used', GRANT_ERRORS.purchase_already_used[1]);
    if (existing.product_id !== product.productId) return fail(409, 'product_mismatch', GRANT_ERRORS.product_mismatch[1]);
    const done = product.finish === 'consume' ? Boolean(existing.consumed_at) : Boolean(existing.acknowledged_at);
    let finished = done;
    if (!done) {
      let purchase = null;
      try { purchase = await google.getProduct(product.productId, purchaseToken); } catch { purchase = null; }
      finished = purchase ? await finishPurchase({ store, google, product, token: purchaseToken, purchase, log: deps.log }) : false;
    }
    return resultBody({ product, idempotent: true, granted: existing.granted, finished, orderId: existing.order_id });
  }

  let purchase;
  try {
    purchase = await google.getProduct(product.productId, purchaseToken);
  } catch (error) {
    logger(deps.log)('warn', `products.get failed: ${error?.code || ''} ${error?.message || error}`);
    return playFailure(error);
  }
  if (!purchase || typeof purchase !== 'object') return fail(503, 'play_unavailable', 'Google Play gave an unreadable answer. Nothing was granted.');

  const state = purchase.purchaseState;
  if (state === PURCHASE_STATE.pending) {
    return fail(202, 'purchase_pending', 'The payment is still pending. Pro or the credits arrive as soon as it completes, and you will not be charged twice.', { pending: true });
  }
  if (state !== PURCHASE_STATE.purchased) return fail(409, 'purchase_canceled', 'This purchase was cancelled or refunded.');
  if (purchase.productId !== undefined && purchase.productId !== product.productId) return fail(400, 'product_mismatch', GRANT_ERRORS.product_mismatch[1]);
  if (purchase.quantity !== undefined && Number(purchase.quantity) !== 1) return fail(409, 'unsupported_quantity', 'Only a single unit can be bought.');
  if (purchase.obfuscatedExternalAccountId !== expectedAccount) {
    return fail(403, 'account_mismatch', 'This purchase was not made by the signed-in account.');
  }
  const orderId = typeof purchase.orderId === 'string' && purchase.orderId ? purchase.orderId : null;
  if (typeof input.orderId === 'string' && input.orderId && orderId && input.orderId !== orderId) {
    return fail(400, 'order_mismatch', 'The order id does not match the purchase.');
  }

  let granted;
  try {
    granted = await store.grant({
      userId, purchaseToken, orderId: orderId || (typeof input.orderId === 'string' ? input.orderId : null),
      productId: product.productId, kind: product.kind,
      credits: product.kind === 'ai_credits' ? product.credits : null,
      accessUntil: product.kind === 'pro' ? product.accessUntil : null,
      raw: purchase,
    });
  } catch (error) {
    logger(deps.log)('error', `grant failed for ${product.productId}: ${error?.message || error}`);
    return fail(503, 'grant_unavailable', 'The purchase could not be recorded just now. Nothing was lost: try again in a minute.');
  }
  if (!granted?.ok) {
    const [status, message] = GRANT_ERRORS[granted?.error] || [500, 'The purchase could not be recorded.'];
    return fail(status, granted?.error || 'grant_failed', message);
  }

  const finished = await finishPurchase({ store, google, product, token: purchaseToken, purchase, log: deps.log });
  if (deps.onGranted && !granted.idempotent) {
    try { await deps.onGranted({ userId, product }); } catch { /* a side effect never fails a paid purchase */ }
  }
  return resultBody({ product, idempotent: Boolean(granted.idempotent), granted: granted.granted, finished, orderId: orderId || null });
}

// ---------------------------------------------------------------------------------------------------------------------
// Real-time Developer Notifications

const ONE_TIME = 2; // voidedPurchaseNotification.productType: 1 subscription, 2 one-time product

/** The notification inside a Pub/Sub push body, or null when it cannot be read. */
export function decodePubSubMessage(body) {
  try {
    const data = body?.message?.data;
    if (typeof data !== 'string' || !data) return null;
    const notification = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (!notification || typeof notification !== 'object') return null;
    return { messageId: String(body.message.messageId || ''), notification };
  } catch { return null; }
}

/**
 * Act on one decoded notification. deps: { store, google, packageName, log? } (google: subscriptions are re-read from Google).
 * Returns { action: 'revoked' | 'already_voided' | 'tombstone' | 'test' | 'logged' | 'ignored', ... }. Throws only when the
 * database could not be reached, so the push is answered 5xx and Pub/Sub retries.
 */
export async function handlePlayNotification(deps, notification) {
  const { store, packageName } = deps;
  const log = logger(deps.log);
  if (notification.packageName && notification.packageName !== packageName) {
    log('warn', `notification for another package (${String(notification.packageName).slice(0, 80)}) ignored`);
    return { action: 'ignored', reason: 'wrong_package' };
  }
  if (notification.testNotification) {
    log('info', `test notification received (version ${notification.testNotification.version || '?'})`);
    return { action: 'test' };
  }
  const voided = notification.voidedPurchaseNotification;
  if (voided) {
    // A voided subscription order: Google's own record of the subscription decides what stays (playSubscriptions.js).
    if (Number(voided.productType) !== ONE_TIME) return handleSubscriptionNotification(deps, { purchaseToken: voided.purchaseToken, voided, eventTimeMillis: notification.eventTimeMillis });
    const token = typeof voided.purchaseToken === 'string' ? voided.purchaseToken : '';
    if (!TOKEN_PATTERN.test(token)) return { action: 'ignored', reason: 'bad_token' };
    const result = await store.revoke({
      purchaseToken: token, orderId: voided.orderId || null,
      reason: Number(voided.refundType) === 2 ? 'partial_refund' : 'voided',
      raw: { voidedPurchaseNotification: voided, eventTimeMillis: notification.eventTimeMillis || null },
    });
    if (!result?.ok) throw new Error(`revoke failed: ${result?.error || 'unknown'}`);
    if (!result.found) return { action: 'tombstone' };
    return { action: result.idempotent ? 'already_voided' : 'revoked', kind: result.kind, revoked: result.revoked || null };
  }
  if (notification.subscriptionNotification) {
    const n = notification.subscriptionNotification;
    return handleSubscriptionNotification(deps, { purchaseToken: n.purchaseToken, notificationType: Number(n.notificationType) || null, eventTimeMillis: notification.eventTimeMillis });
  }
  if (notification.oneTimeProductNotification) {
    // 1 purchased, 2 a pending purchase was cancelled. Granting happens only through verify, which can bind the purchase
    // to a signed-in account; nothing is granted here.
    return { action: 'logged', type: Number(notification.oneTimeProductNotification.notificationType) || null };
  }
  return { action: 'ignored', reason: 'not_handled' };
}
