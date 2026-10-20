// Friend referrals on the server (owner D165, 20 Oct 2026). The database decides and pays (mm_referral_attach,
// mm_referral_status, the attempts trigger; supabase/migrations/20261020130000_referrals.sql); this file turns a request into
// those calls and their answers into the API bodies. The RPC is injected (rpc(name, args) -> { data, error }), so node tests
// drive it with PGlite or a fake. No 'server-only' import for the same reason; only the route handlers import it.
//
// Privacy: the device id and the network are hashed here with a server secret (HMAC-SHA256, 32 hex characters) before the
// database sees them; the raw IP is never stored. Without a secret the hashes are left out (the checks that need them are
// skipped, the rest still hold).
import { createHmac, randomUUID } from 'node:crypto';
import {
  DEFAULT_MONTHLY_CAP, DEFAULT_REWARD, DEVICE_COOKIE, SOURCES, decodeInviteCookie, normaliseInviteCode, referralLink, referralsLive,
} from '../referrals/friendInvite.mjs';

const SECRET = (env) => env?.REFERRAL_HASH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY || null;

/** HMAC of one value, or null without a value or a secret. kind keeps device and network hashes apart. */
export function hashFor(kind, value, env = process.env) {
  const secret = SECRET(env);
  const v = typeof value === 'string' ? value.trim() : '';
  if (!secret || !v || v === 'unknown' || v.length > 200) return null;
  return createHmac('sha256', secret).update(`referral:${kind}:${v}`).digest('hex').slice(0, 32);
}

/** The network a request came from: the IPv4 address, or the /64 of an IPv6 one (phones rotate inside it). */
export function networkOf(headers) {
  const get = (name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]) || '';
  const ip = String(get('x-forwarded-for')).split(',')[0].trim() || String(get('x-real-ip')).trim();
  if (!ip) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip;
  if (ip.includes(':')) return ip.toLowerCase().split(':').slice(0, 4).join(':');
  return null;
}

/** A device id as sent: the web's mm_dev cookie, or the app's install id. A short random-looking token only. */
export function deviceIdOf(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null;
}

export const newDeviceId = () => randomUUID().replace(/-/g, '');

/**
 * What a claim sends to the database, from the request body and the pending-invite cookie. The body wins (the app, a code
 * typed at signup, or ?invite= on the email-link callback). linkAgeSeconds (the app) is turned into a server-clock time,
 * so a phone's wrong clock cannot move it. Null when there is no usable code.
 */
export function claimInput({ body = {}, cookieValue = null, now = Date.now() } = {}) {
  const fromCookie = decodeInviteCookie(cookieValue);
  const bodyCode = normaliseInviteCode(typeof body?.code === 'string' ? body.code : '');
  if (!bodyCode && !fromCookie) return null;
  const code = bodyCode || fromCookie.code;
  const source = bodyCode
    ? (SOURCES.includes(body?.source) ? body.source : 'link')
    : fromCookie.source;
  let clickedAt = null;
  const age = Number(body?.linkAgeSeconds);
  if (bodyCode && Number.isFinite(age) && age >= 0 && age <= 60 * 60 * 24 * 30) clickedAt = new Date(now - age * 1000).toISOString();
  else if (bodyCode && fromCookie && fromCookie.code === bodyCode) clickedAt = fromCookie.clickedAt;
  else if (!bodyCode) clickedAt = fromCookie.clickedAt;
  return { code, source, clickedAt, fromCookie: !bodyCode };
}

// The database's answers, said once. done: the pending invite is settled either way, so the cookie (or the app's stored code)
// is cleared; a transient failure keeps it for the next try.
const FINAL_ERRORS = new Set(['bad_code', 'unknown_code', 'self', 'already_referred', 'existing_account', 'user_not_found']);

export function claimOutcome(result) {
  if (!result || typeof result !== 'object') return { ok: false, done: false, state: null, reason: 'unavailable' };
  if (result.ok === true) return { ok: true, done: true, state: result.state || 'joined', reason: null, source: result.source || null };
  const reason = typeof result.error === 'string' ? result.error : 'unavailable';
  return { ok: false, done: FINAL_ERRORS.has(reason), state: null, reason };
}

/** Attach a new account to the invite it came with. Never throws. */
export async function claimReferral({ rpc, userId, input, deviceId = null, network = null, env = process.env }) {
  if (!referralsLive(env)) return { ok: false, done: false, state: null, reason: 'off' };
  if (!userId || !input?.code) return { ok: false, done: true, state: null, reason: 'bad_code' };
  try {
    const { data, error } = await rpc('mm_referral_attach', {
      p_referee_id: userId,
      p_code: input.code,
      p_source: input.source,
      p_clicked_at: input.clickedAt,
      p_device_hash: hashFor('device', deviceId, env),
      p_ip_hash: hashFor('network', network, env),
    });
    if (error) return { ok: false, done: false, state: null, reason: 'unavailable' };
    return claimOutcome(data);
  } catch {
    return { ok: false, done: false, state: null, reason: 'unavailable' };
  }
}

/** GET /api/referrals' body. live:false (and nothing else) while the switch is off or the database cannot answer. */
export function referralBody(status, { live = true, origin } = {}) {
  if (!live || !status || status.ok !== true || typeof status.code !== 'string') return { ok: true, live: false };
  const n = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : d);
  return {
    ok: true,
    live: true,
    code: status.code,
    link: referralLink(status.code, origin),
    reward: n(status.reward, DEFAULT_REWARD) || DEFAULT_REWARD,
    monthlyCap: n(status.monthlyCap, DEFAULT_MONTHLY_CAP),
    paused: status.paused === true,
    joined: n(status.joined),
    practised: n(status.practised),
    rewarded: n(status.rewarded),
    notCounted: n(status.notCounted),
    earned: n(status.earned),
    rewardedThisMonth: n(status.rewardedThisMonth),
    capReached: status.capReached === true,
    invited: status.invited && typeof status.invited === 'object'
      ? { state: String(status.invited.state || ''), rewarded: status.invited.rewarded === true }
      : null,
  };
}

/** Read one student's invite status (makes their code on first use). Never throws; null when it cannot be read. */
export async function readReferralStatus({ rpc, userId, deviceId = null, env = process.env }) {
  if (!referralsLive(env) || !userId) return null;
  try {
    const { data, error } = await rpc('mm_referral_status', { p_user_id: userId, p_device_hash: hashFor('device', deviceId, env) });
    if (error || !data || data.ok !== true) return null;
    return data;
  } catch {
    return null;
  }
}

export { DEVICE_COOKIE };
