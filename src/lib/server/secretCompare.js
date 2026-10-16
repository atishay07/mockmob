import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of two secrets. Same rule the cron routes use (refresh-inventory,
 * rebuild-nta-index, finalise-sessions): an empty or missing value never matches, so a route
 * whose secret is unset stays closed.
 */
export function sameSecret(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** True when the request carries the INTERNAL_API_SECRET in x-internal-secret. Closed when the env var is unset. */
export function hasInternalSecret(request) {
  const internal = process.env.INTERNAL_API_SECRET;
  return Boolean(internal) && sameSecret(request.headers.get('x-internal-secret'), internal);
}
