// A short-lived, per-question ticket the feed hands out with each question. A signed-out visitor needs one to ask for the
// answer; it proves the question was served by the feed a moment ago, so the answer endpoint is not a free key lookup by id.
// Stateless: an HMAC over the question id and an expiry, no table.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const FEED_TICKET_TTL_MS = 2 * 60 * 60 * 1000;

function secretFrom(env) {
  return env.FEED_TICKET_SECRET || env.NEXTAUTH_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function mac(secret, questionId, expiresAt) {
  return createHmac('sha256', secret).update(`feed-ticket:v1:${questionId}:${expiresAt}`).digest('base64url').slice(0, 32);
}

/** `<expiresAt>.<mac>`, or null when the server has no secret to sign with (the caller then sends no ticket). */
export function signFeedTicket(questionId, { now = Date.now(), ttlMs = FEED_TICKET_TTL_MS, env = process.env } = {}) {
  const secret = secretFrom(env);
  if (!secret || typeof questionId !== 'string' || !questionId) return null;
  const expiresAt = now + ttlMs;
  return `${expiresAt}.${mac(secret, questionId, expiresAt)}`;
}

export function verifyFeedTicket(ticket, questionId, { now = Date.now(), env = process.env } = {}) {
  const secret = secretFrom(env);
  if (!secret || typeof ticket !== 'string' || ticket.length > 80 || typeof questionId !== 'string' || !questionId) return false;
  const [stamp, given, extra] = ticket.split('.');
  if (extra !== undefined || !/^\d{10,16}$/.test(stamp || '') || !given) return false;
  const expiresAt = Number(stamp);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt - now > FEED_TICKET_TTL_MS + 60_000) return false;
  const want = Buffer.from(mac(secret, questionId, expiresAt));
  const have = Buffer.from(given);
  return want.length === have.length && timingSafeEqual(want, have);
}
