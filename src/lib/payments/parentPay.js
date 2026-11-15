// "Ask a parent to pay" (lane F-B, 15 Nov 2026). Students are 16 and 17; many have no UPI or card of their own, and about half
// of past payment attempts died on a UPI timeout. The parent pays monthly Pro on Razorpay's own hosted page (the subscription's
// `short_url`) on their own phone, and the existing webhook grants Pro to the student whose account made the subscription (its
// notes and our payment row are written by our server only). We never build a payment page of our own for the parent.
// PURE: reads only the env it is given.

/** Unset PARENT_PAY_ENABLED means this. See the lane report for why. */
export const PARENT_PAY_DEFAULT = true;

/** The one plan a parent link sells. The client never names a plan, an amount or an account. */
export const PARENT_PAY_PLAN_ID = 'pro_monthly_99';

/**
 * Per student (the account id, not the address: phones change networks), kept in the database so every server instance shares
 * it; when the database cannot answer, the in-memory limit stands in for that call rather than locking the student out. Each
 * call costs at most one Razorpay create, and the open checkout is handed back for a day, so 8 in 10 minutes is plenty.
 */
export const PARENT_LINK_LIMIT = Object.freeze({
  route: '/api/billing/parent-link',
  limit: 8,
  windowMs: 10 * 60_000,
  identityOnly: true,
  persistent: true,
  fallback: 'memory',
});

/**
 * How long a parent link can be paid. A checkout is handed back only while it is under a day old (M3,
 * create-monthly-subscription), so a link must stop taking payments before that day ends: otherwise a parent who pays late
 * could pay one subscription while the student has started a second. Ten minutes short of the day, for clock skew between
 * Razorpay, Vercel and the database.
 */
export const PARENT_LINK_LIFETIME_MS = 24 * 60 * 60_000 - 10 * 60_000;

/** A link with less than this left is not handed out again; a fresh one is made. */
export const PARENT_LINK_MIN_LEFT_MS = 15 * 60_000;

/** PARENT_PAY_ENABLED: 'true' on, any other set value off, unset or empty the default. */
export function parentPayEnabled(env = process.env) {
  const value = env?.PARENT_PAY_ENABLED;
  if (value === undefined || value === null || String(value).trim() === '') return PARENT_PAY_DEFAULT;
  return String(value).trim() === 'true';
}

/** Whether a student may be offered the parent link with this offer: the switch is on and monthly Pro is what is on sale. */
export function parentPayOffered(offer, env = process.env) {
  return parentPayEnabled(env) && offer?.purchasable === 'monthly' && offer?.monthly?.ready === true;
}

const RAZORPAY_LINK_HOSTS = ['rzp.io', 'razorpay.com'];

/** Razorpay's own hosted page for this subscription, or null when it is missing or not on a Razorpay host. */
export function hostedLinkOf(subscription) {
  const raw = typeof subscription?.short_url === 'string' ? subscription.short_url.trim() : '';
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  return RAZORPAY_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) ? url.href : null;
}

/** When the subscription's link stops taking the first payment (Razorpay's expire_by, seconds), as ISO, or null. */
export function linkExpiresAt(subscription) {
  const seconds = Number(subscription?.expire_by);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/** The expire_by to create a parent link with (Unix seconds). */
export function parentLinkExpireBy(nowMs = Date.now()) {
  return Math.floor((nowMs + PARENT_LINK_LIFETIME_MS) / 1000);
}

/**
 * Whether an open checkout's link may be sent to a parent: it must stop taking payments inside the day its checkout is handed
 * back for (so no late payment can land on a subscription the student has already replaced), and still have a while to run.
 * A Get Pro checkout made before 15 Nov 2026 has no expiry, so its link is never sent out; a fresh, expiring one is made instead.
 */
export function shareableOpenCheckout(subscription, { rowCreatedAt, reuseWindowMs, nowMs = Date.now() } = {}) {
  const expiresMs = Number(subscription?.expire_by) * 1000;
  const createdMs = Number(rowCreatedAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= 0 || !Number.isFinite(createdMs) || createdMs <= 0) return false;
  if (expiresMs - nowMs < PARENT_LINK_MIN_LEFT_MS) return false;
  return expiresMs <= createdMs + reuseWindowMs;
}
