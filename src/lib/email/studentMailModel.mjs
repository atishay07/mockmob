// The two emails that bring a new student back (15 Nov 2026): the welcome, once, when the account is made, and the day-2
// email, once, the evening after sign-up, only to a student who has answered nothing since their sign-up day. PURE: no I/O,
// no clock reads except through `now`, no environment reads except through `env`. The rules live here so node tests can
// prove them; src/lib/email/studentMail.mjs runs them against an injected store and mail transport.
//
//  - The switch: EMAILS_ENABLED. Unset or anything but "true" means nothing is ever sent.
//  - Never twice: a send is claimed in the database (email_sends, one row per student per email, primary key) before the
//    email is handed to the provider. A crash between the claim and the send leaves the email unsent for good: a missed
//    email is preferred to a double one.
//  - Sign-in codes first: these emails have their own daily cap (EMAILS_DAILY_CAP, default 40, per India calendar day) and
//    stop while sign-in emails are near their own daily ceiling (AUTH_EMAIL_DAILY_CEILING, src/lib/server/emailLoginPolicy.js).
//  - Unsubscribe: every email carries a signed link (HMAC-SHA256 with an existing server secret) and the RFC 8058 headers.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { emailDailyCeiling, emailLimitOptions, emailLoginSiteLimit } from '../server/emailLoginPolicy.js';

export const EMAIL_KINDS = Object.freeze(['welcome', 'day2']);
export const EMAILS_DAILY_CAP_DEFAULT = 40;
/** Room kept free for sign-in codes: these emails stop once fewer than this share of the sign-in ceiling (or the cap) is left. */
export const SIGN_IN_RESERVE_SHARE = 0.2;
export const IST_OFFSET_MS = 330 * 60_000; // India has one zone and no daylight saving
export const DAY_MS = 86_400_000;
/** The day-2 email only goes out between 5:00 pm and 9:00 pm India time, whoever calls the job and whenever. */
export const DAY2_HOURS = Object.freeze({ from: 17, to: 21 });
/** The daily cap's window: longer than any India day, so a day's bucket never resets before the day ends. */
export const DAILY_SLOT_WINDOW_MS = 26 * 60 * 60 * 1000;

/** True only when EMAILS_ENABLED is exactly "true". */
export function emailsEnabled(env = process.env) {
  return env?.EMAILS_ENABLED === 'true';
}

/** EMAILS_DAILY_CAP as a whole number from 0 (send none) to 1000; anything else is the default, 40. */
export function emailsDailyCap(env = process.env) {
  const raw = String(env?.EMAILS_DAILY_CAP ?? '').trim();
  if (!/^\d{1,4}$/.test(raw)) return EMAILS_DAILY_CAP_DEFAULT;
  const n = Number(raw);
  return n <= 1000 ? n : EMAILS_DAILY_CAP_DEFAULT;
}

/** The server secret the unsubscribe link is signed with (the same fallback the guest Ask Mobi cookie uses). */
export function emailSecret(env = process.env) {
  return String(env?.NEXTAUTH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY || '');
}

// ------------------------------------------------------------------------------------------------------------- the clock
/** 'YYYY-MM-DD' of the India calendar day holding the instant `ms`. */
export function istDay(ms) {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant (ms) an India calendar day starts. */
export function istDayStart(day) {
  return Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS;
}

/**
 * The day-2 run at `now`: today in India, yesterday (the sign-up day it serves), when each starts, and whether the hour is
 * inside DAY2_HOURS.
 */
export function dayTwoWindow(now) {
  const today = istDay(now);
  const startToday = istDayStart(today);
  const startYesterday = startToday - DAY_MS;
  const hour = new Date(now + IST_OFFSET_MS).getUTCHours();
  return {
    today,
    yesterday: istDay(startYesterday),
    startToday,
    startYesterday,
    hour,
    inHours: hour >= DAY2_HOURS.from && hour < DAY2_HOURS.to,
  };
}

// ------------------------------------------------------------------------------------------------- sign-in codes first
/**
 * The persistent_rate_limits bucket that counts sign-in emails against the site-wide ceiling, exactly as
 * src/lib/server/rateLimit.js names it (sha256 of route, no address for an identity-only limit, then the key parts).
 */
export function signInCeilingBucket(env = process.env) {
  const options = emailLimitOptions(emailLoginSiteLimit(env), '', env);
  return createHash('sha256').update([options.route, options.identityOnly ? '' : 'unknown', ...(options.keyParts || [])].join(':')).digest('hex');
}

/** This email's own daily bucket: one per India calendar day. */
export function dailySlotBucket(day) {
  return createHash('sha256').update(`student-email:day:${day}`).digest('hex');
}

/**
 * Whether sign-in codes leave room for these emails now. `use` is the sign-in bucket's row ({ count, resetAt }) or null when
 * it has none; a row whose window has passed counts as 0. Room means more than `reserve` sign-in emails are still left
 * under the ceiling, where reserve is the larger of the cap and a fifth of the ceiling.
 */
export function signInRoom({ use = null, ceiling, cap, now }) {
  const resetAt = Date.parse(use?.resetAt ?? use?.reset_at ?? '');
  const used = Number.isFinite(resetAt) && resetAt > now ? Math.max(0, Number(use?.count) || 0) : 0;
  const reserve = Math.max(cap, Math.ceil(ceiling * SIGN_IN_RESERVE_SHARE));
  return { used, ceiling, reserve, open: ceiling - used > reserve };
}

export { emailDailyCeiling };

// ------------------------------------------------------------------------------------------------------- unsubscribe
const ID_MAX = 200;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const unsubscribeKey = (secret) => createHmac('sha256', String(secret)).update('mm_unsub:v1').digest();

function validUserId(userId) {
  return typeof userId === 'string' && userId.length > 0 && userId.length <= ID_MAX && !/[\u0000-\u001f\u007f]/.test(userId);
}

/** The unsubscribe signature for one student: 32 URL-safe characters, or null without a secret or an id. */
export function unsubscribeToken(userId, secret) {
  if (!secret || !validUserId(userId)) return null;
  return createHmac('sha256', unsubscribeKey(secret)).update(`unsub:v1:${userId}`).digest('base64url').slice(0, 32);
}

/** True when `token` is this student's unsubscribe signature (constant time). */
export function verifyUnsubscribe(userId, token, secret) {
  if (!secret || !validUserId(userId) || typeof token !== 'string' || !TOKEN_RE.test(token)) return false;
  const expected = Buffer.from(unsubscribeToken(userId, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const UNSUBSCRIBE_PATH = '/api/email/unsubscribe';

/** The one-click unsubscribe address for one student, or null. */
export function unsubscribeUrl(origin, userId, secret) {
  const token = unsubscribeToken(userId, secret);
  if (!token || !origin) return null;
  return `${String(origin).replace(/\/+$/, '')}${UNSUBSCRIBE_PATH}?u=${encodeURIComponent(userId)}&t=${token}`;
}

/** RFC 8058 headers: a mail app's own Unsubscribe button posts to the same signed address. */
export function unsubscribeHeaders(url) {
  return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}

/** The provider's idempotency key for one email: a retried request inside the provider's window is not sent again. */
export function idempotencyKey(kind, userId) {
  return `student-email/${kind}/${createHash('sha256').update(String(userId)).digest('hex').slice(0, 32)}`;
}

// --------------------------------------------------------------------------------------------------------- the day-2 email
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmailAddress = (value) => typeof value === 'string' && value.length <= 320 && EMAIL_RE.test(value);

/**
 * Who of yesterday's new accounts may get the day-2 email, oldest sign-up first: a real address, not unsubscribed, not sent
 * one already, no pending account deletion. (Whether they answered anything today is checked one student at a time, just
 * before each send.)
 */
export function pickDayTwo({ users = [], optedOut = new Set(), sent = new Set(), pendingDeletion = new Set() }) {
  return [...users]
    .filter((u) => u && validUserId(u.id) && isEmailAddress(u.email) && !u.deleted_at)
    .filter((u) => !optedOut.has(u.id) && !sent.has(u.id) && !pendingDeletion.has(u.id))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

/**
 * True when anything was answered since `since` (ms): a submitted set with at least one question answered, a question's
 * progress row touched, or a mistake repaired. Looser than a study day (src/lib/server/rhythm.js counts a session only from 5
 * answered questions): any answer at all means the student came back, and the day-2 email is not sent.
 */
export function answeredSince({ attempts = [], progress = [], repairs = [] }, since) {
  const after = (v) => { const t = Date.parse(v); return Number.isFinite(t) && t >= since; };
  if (attempts.some((a) => after(a?.completed_at) && (Number(a?.correct) || 0) + (Number(a?.wrong) || 0) > 0)) return true;
  if (progress.some((p) => after(p?.last_attempted_at))) return true;
  return repairs.some((r) => after(r?.updated_at));
}

/**
 * The one action of the day-2 email, from the student's own record.
 *   attempts: their submitted sets [{ id, subject, completed_at, details: [{ qid, isCorrect }] }], any order
 *   isRepaired(attemptId, qid): true when that mistake already has a stored repair
 * -> { kind: 'first' }                                     no finished set: the first set
 *    { kind: 'repair', attemptId, subject, open, position } the newest set with questions still open (wrong or blank, not
 *                                                          repaired); position is the first one's number on the paper
 *    { kind: 'next', subject }                             sets finished and nothing open: today's set
 */
export function dayTwoState({ attempts = [], isRepaired = () => false } = {}) {
  const list = (Array.isArray(attempts) ? attempts : [])
    .filter((a) => a && typeof a.id === 'string' && a.id)
    .sort((a, b) => (Date.parse(b.completed_at) || 0) - (Date.parse(a.completed_at) || 0));
  if (!list.length) return { kind: 'first' };
  for (const a of list) {
    const open = [];
    (Array.isArray(a.details) ? a.details : []).forEach((d, index) => {
      if (d && typeof d.qid === 'string' && d.isCorrect !== true && !isRepaired(a.id, d.qid)) open.push(index + 1);
    });
    if (open.length) return { kind: 'repair', attemptId: a.id, subject: a.subject || null, open: open.length, position: open[0] };
  }
  return { kind: 'next', subject: list[0].subject || null };
}
