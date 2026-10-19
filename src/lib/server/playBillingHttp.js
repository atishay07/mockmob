// The two Google Play billing routes as plain handlers, so node:test drives them with a fake session, limiter, store and
// Google client (data/tests/play_billing.test.mjs), the way src/lib/server/mob/http.js serves the Mob. The route files pass
// the production deps (playBillingDeps.js). No '@/' imports here.
//   - PLAY_BILLING_ENABLED not exactly 'true': both routes answer 404, every method, before anything else is read.
//   - verify: signed-in students only (cookie or the app's bearer token), persistent rate limit that fails closed, a body
//     read through a whitelist: a price, amount, credit count or plan sent by a client is never looked at.
//   - rtdn: Pub/Sub push, authenticated by the shared token (and the Google OIDC token when configured), processed once
//     per message id, 2xx for anything that is acknowledged (including messages it ignores), 5xx only so Pub/Sub retries.
import { createHash } from 'node:crypto';
import { verifyPlayPurchase, handlePlayNotification, decodePubSubMessage } from '../payments/playBilling.js';
import { authenticatePush } from '../payments/playRtdn.js';

const MIN = 60_000;
export const VERIFY_LIMIT = Object.freeze({ route: '/api/billing/play/verify', limit: 15, windowMs: 10 * MIN });
const MAX_VERIFY_BODY = 8 * 1024;
const MAX_PUSH_BODY = 64 * 1024;
const NO_STORE = Object.freeze({ 'Cache-Control': 'no-store' });

const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
const notFound = () => json({ error: 'Not found' }, 404);
const methodNotAllowed = () => json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });

async function readJson(request, max) {
  const text = await request.text().catch(() => '');
  if (text.length > max) return { error: 'too_large' };
  if (!text.trim()) return { value: {} };
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? { value } : { error: 'bad_body' };
  } catch { return { error: 'bad_body' }; }
}

const str = (v) => (typeof v === 'string' ? v : undefined);

/**
 * POST /api/billing/play/verify  body { productId, purchaseToken, orderId?, obfuscatedExternalAccountId?, packageName? }
 * productId pro_monthly is the monthly subscription (purchases.subscriptionsv2); every other id is a one-time product.
 * deps: { enabled(), auth(request), rateLimit(request, opts), billing: { store, google, packageName, now?, log?, onGranted? } }
 */
export async function handlePlayVerify(deps, request) {
  if (!deps.enabled()) return notFound();
  if (request.method !== 'POST') return methodNotAllowed();

  const session = await deps.auth(request).catch(() => null);
  const userId = session?.user?.id || null;
  if (!userId) return json({ error: 'Authentication required', code: 'unauthenticated' }, 401);

  // Money route: the persistent limiter, no in-memory fallback. A database that cannot answer refuses the call.
  const limited = await deps.rateLimit(request, { ...VERIFY_LIMIT, keyParts: [userId], identityOnly: true }).catch(() => ({ allowed: false }));
  if (!limited?.allowed) {
    return json({ error: 'Too many attempts. Wait a few minutes and try again.', code: 'rate_limited' }, 429, { 'Retry-After': String(limited?.retryAfterSeconds || 600) });
  }

  const body = await readJson(request, MAX_VERIFY_BODY);
  if (body.error) return json({ error: 'The request body is not valid.', code: body.error }, 400);
  const b = body.value;

  const result = await verifyPlayPurchase(deps.billing, {
    userId,
    productId: str(b.productId),
    purchaseToken: str(b.purchaseToken),
    orderId: str(b.orderId),
    obfuscatedAccountId: str(b.obfuscatedExternalAccountId) ?? str(b.obfuscatedAccountId),
    packageName: str(b.packageName),
  });
  if (result.ok) return json(result, 200);
  // A subscription Google holds but that gives no access now (ended, on hold, paused) says so, with its dates.
  const extra = { ...(result.pending ? { pending: true } : {}), ...(result.subscription ? { subscription: result.subscription } : {}), ...(result.pro ? { pro: result.pro } : {}) };
  return json({ ok: false, error: result.message, code: result.code, ...extra }, result.status);
}

/**
 * POST /api/billing/play/rtdn?token=...  (Pub/Sub push)
 * deps: { enabled(), env?, certs?, now?, claimEvent({ eventId, eventType, payload }), markProcessed(eventId, note?),
 *         markFailed(eventId, message), billing: { store, packageName, log? } }
 */
export async function handlePlayRtdn(deps, request) {
  if (!deps.enabled()) return notFound();
  if (request.method !== 'POST') return methodNotAllowed();
  const log = deps.billing?.log || ((level, ...args) => console[level]?.('[play-rtdn]', ...args));

  const authentic = await authenticatePush(request, { env: deps.env || process.env, certs: deps.certs, now: deps.now || Date.now });
  if (!authentic.ok) {
    log('warn', `push refused: ${authentic.reason}`);
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = await readJson(request, MAX_PUSH_BODY);
  if (body.error) { log('warn', `push body refused: ${body.error}`); return json({ ok: true, ignored: body.error }); }
  const decoded = decodePubSubMessage(body.value);
  if (!decoded) { log('warn', 'push carried no readable notification; acknowledged and dropped'); return json({ ok: true, ignored: 'unreadable' }); }

  const { notification } = decoded;
  // Pub/Sub's message id is the dedupe key; without one the notification's own content is.
  const eventId = `play:${decoded.messageId || createHash('sha256').update(JSON.stringify(notification)).digest('hex').slice(0, 32)}`;
  const eventType = notification.testNotification ? 'test'
    : notification.voidedPurchaseNotification ? 'voided'
      : notification.oneTimeProductNotification ? 'one_time_product'
        : notification.subscriptionNotification ? 'subscription' : 'unknown';

  const claim = await deps.claimEvent({ eventId, eventType, payload: notification });
  if (claim === false) return json({ ok: true, duplicate: true });
  if (claim === 'in_flight') return json({ error: 'Still processing' }, 503);

  try {
    const outcome = await handlePlayNotification(deps.billing, notification);
    await deps.markProcessed(eventId, outcome.action === 'ignored' ? `ignored: ${outcome.reason}` : null);
    return json({ ok: true, ...outcome });
  } catch (error) {
    log('error', `notification ${eventType} failed: ${error?.message || error}`);
    await deps.markFailed(eventId, String(error?.message || error).slice(0, 300)).catch(() => {});
    return json({ error: 'Could not process; retry' }, 500);
  }
}
