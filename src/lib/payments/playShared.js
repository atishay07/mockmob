// Small pieces both Play billing cores share (one-time products in playBilling.js, subscriptions in playSubscriptions.js).
// No Next.js, Supabase or network imports.
import { createHash } from 'node:crypto';

export const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{16,1024}$/;

/**
 * The value the app sets as the purchase's obfuscated account id (BillingFlowParams.setObfuscatedAccountId) and sends back:
 * the lowercase hex SHA-256 of the signed-in user's id, UTF-8. One way, no personal data, 64 characters (Google's limit).
 */
export const playAccountHash = (userId) => createHash('sha256').update(String(userId), 'utf8').digest('hex');

export const fail = (status, code, message, extra = {}) => ({ ok: false, status, code, message, ...extra });
export const logger = (log) => log || ((level, ...args) => console[level]?.('[play]', ...args));

/** A Google API error as the answer the app gets. Nothing was granted in any of these. */
export function playFailure(error) {
  switch (error?.code) {
    case 'purchase_not_found': return fail(404, 'purchase_not_found', 'Google Play has no such purchase.');
    case 'purchase_invalid': return fail(400, 'purchase_invalid', 'Google Play rejected that purchase token.');
    case 'play_not_configured': return fail(503, 'play_not_configured', 'Purchases are not available right now. Nothing was granted. Try again later.');
    default: return fail(503, 'play_unavailable', 'Google Play could not be reached. Nothing was granted. Try again in a minute.');
  }
}
