// Sends the welcome and day-2 emails (rules in ./studentMailModel.mjs). Plain module: the store (database) and the mail
// transport are passed in, so node tests drive every path with in-memory fakes. Nothing here throws: every outcome is
// { sent, reason }, and anything uncertain ends unsent.
//
// The order of one send, each step stopping it:
//   1 the switch (EMAILS_ENABLED), a secret for the unsubscribe link, a mail provider, the two tables (migration applied)
//   2 the student unsubscribed, or this email was already sent (read first, so a wasted slot of the cap is rare)
//   3 sign-in codes near their own daily ceiling
//   4 a slot of today's cap (atomic; given back when step 5 finds the email already claimed)
//   5 the claim: one row per student per email, written before the send (the primary key refuses a second)
//   6 the send, with the provider's idempotency key; its result is recorded, and a failed send is never retried
import {
  DAY2_HOURS, EMAIL_KINDS, dayTwoWindow, emailDailyCeiling, emailSecret, emailsDailyCap, emailsEnabled, idempotencyKey,
  isEmailAddress, istDay, pickDayTwo, signInRoom, unsubscribeHeaders, unsubscribeUrl,
} from './studentMailModel.mjs';
import { buildStudentEmail } from './studentMailWords.mjs';

export const DEFAULT_FROM = 'MockMob <support@mockmob.in>';
/** Gap between two day-2 sends: the provider's API allows a few requests a second, and sign-in codes need that room. */
export const DAY2_SPACING_MS = 1000;
/** The day-2 job stops starting new sends after this long (the route's limit is 60 s). */
export const DAY2_BUDGET_MS = 45_000;
export const DAY2_CANDIDATES_MAX = 500;

const STOPS_RUN = new Set(['cap', 'sign_in_busy', 'off', 'no_secret', 'no_provider', 'not_set_up']);

const shortReason = (error) => String(error?.name || error?.code || error?.statusCode || 'error').slice(0, 60);

/**
 * One email to one student.
 *   kind: 'welcome' | 'day2'; user: { id, email }; state: the day-2 state (studentMailModel dayTwoState, with subjectName)
 *   deps: { store, mail: { configured(), send(message, { idempotencyKey }) }, origin, from }
 * -> { sent: true } | { sent: false, reason }
 */
export async function sendStudentEmail({ kind, user, state = {}, deps, env = process.env, now = Date.now() }) {
  if (!emailsEnabled(env)) return { sent: false, reason: 'off' };
  if (!EMAIL_KINDS.includes(kind)) return { sent: false, reason: 'unknown_kind' };
  if (!user || typeof user.id !== 'string' || !user.id || !isEmailAddress(user.email)) return { sent: false, reason: 'no_address' };
  const secret = emailSecret(env);
  if (!secret) return { sent: false, reason: 'no_secret' };
  const { store, mail } = deps || {};
  let configured = false;
  try { configured = Boolean(mail?.configured?.()); } catch { configured = false; }
  if (!configured) return { sent: false, reason: 'no_provider' };

  const day = istDay(now);
  let claimed = false;
  try {
    if (!(await store.ready())) return { sent: false, reason: 'not_set_up' };
    if (await store.optedOut(user.id)) return { sent: false, reason: 'unsubscribed' };
    if (await store.wasSent(user.id, kind)) return { sent: false, reason: 'already_sent' };

    const cap = emailsDailyCap(env);
    const room = signInRoom({ use: await store.signInUse(), ceiling: emailDailyCeiling(env), cap, now });
    if (!room.open) return { sent: false, reason: 'sign_in_busy' };
    if (cap < 1 || !(await store.takeDailySlot(day, cap))) return { sent: false, reason: 'cap' };

    claimed = await store.claim(user.id, kind, now);
    if (!claimed) {
      try { await store.giveBackDailySlot(day); } catch { /* the count stays one high for today; never a second email */ }
      return { sent: false, reason: 'already_sent' };
    }
  } catch {
    return { sent: false, reason: 'store_error' };
  }

  // From here the email is claimed: whatever happens, it is never sent again.
  let message;
  let unsubscribe;
  try {
    unsubscribe = unsubscribeUrl(deps.origin, user.id, secret);
    if (!unsubscribe) throw new Error('no_unsubscribe');
    message = buildStudentEmail({ kind, state, origin: deps.origin, unsubscribe });
  } catch (error) {
    await settle(() => store.markFailed(user.id, kind, `build:${shortReason(error)}`, now));
    return { sent: false, reason: 'build_failed' };
  }
  let result;
  try {
    result = await mail.send({
      from: deps.from || DEFAULT_FROM,
      to: user.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: unsubscribeHeaders(unsubscribe),
    }, { idempotencyKey: idempotencyKey(kind, user.id) });
  } catch (error) {
    // Unknown whether the provider took it: recorded as uncertain, never retried.
    await settle(() => store.markFailed(user.id, kind, `uncertain:${shortReason(error)}`, now));
    return { sent: false, reason: 'send_uncertain' };
  }
  if (result?.error) {
    await settle(() => store.markFailed(user.id, kind, `provider:${shortReason(result.error)}`, now));
    return { sent: false, reason: 'send_failed' };
  }
  await settle(() => store.markSent(user.id, kind, result?.data?.id || null, now));
  return { sent: true };
}

async function settle(fn) {
  try { await fn(); } catch { /* the claim row already stops a second send; the record of the outcome is best effort */ }
}

/** The welcome email for a newly created account: { id, email }. */
export function sendWelcome({ user, deps, env = process.env, now = Date.now() }) {
  return sendStudentEmail({ kind: 'welcome', user, deps, env, now });
}

/**
 * The day-2 job: yesterday's new accounts (India calendar), each one that answered nothing today gets one email whose action
 * comes from their own record. Runs only between 5:00 pm and 9:00 pm India time. Stops early at the cap, when sign-in codes
 * need the room, or when its time budget is spent. Returns counts only, never an address or an id.
 *   deps: as sendStudentEmail, plus sleep(ms) and clock() (ms, for the budget)
 */
export async function runDayTwo({ deps, env = process.env, now = Date.now() }) {
  if (!emailsEnabled(env)) return { enabled: false, sent: 0 };
  const window = dayTwoWindow(now);
  if (!window.inHours) return { enabled: true, skipped: 'outside_hours', hours: DAY2_HOURS, sent: 0 };
  const { store } = deps;
  const clock = deps.clock || (() => Date.now());
  const sleep = deps.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const started = clock();
  const reasons = {};
  const count = (reason) => { reasons[reason] = (reasons[reason] || 0) + 1; };
  let sent = 0;
  let picked = [];
  try {
    if (!(await store.ready())) return { enabled: true, skipped: 'not_set_up', sent: 0 };
    const users = await store.dayTwoCandidates({ from: window.startYesterday, to: window.startToday, limit: DAY2_CANDIDATES_MAX });
    const ids = users.map((u) => u.id);
    const filters = await store.dayTwoFilters(ids);
    picked = pickDayTwo({ users, ...filters });
  } catch {
    return { enabled: true, skipped: 'store_error', sent: 0 };
  }
  let stopped = null;
  for (const user of picked) {
    if (clock() - started > DAY2_BUDGET_MS) { stopped = 'time'; break; }
    let state;
    try {
      if (await store.answeredSince(user.id, window.startToday)) { count('came_back'); continue; }
      state = await store.dayTwoState(user);
    } catch {
      count('store_error');
      continue;
    }
    const result = await sendStudentEmail({ kind: 'day2', user, state, deps, env, now });
    if (result.sent) {
      sent += 1;
      await sleep(DAY2_SPACING_MS);
      continue;
    }
    count(result.reason);
    if (STOPS_RUN.has(result.reason)) { stopped = result.reason; break; }
  }
  return { enabled: true, day: window.yesterday, candidates: picked.length, sent, skipped: reasons, ...(stopped ? { stopped } : {}) };
}
