import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { computeRhythm, localDay, weekStart, planGoalHistoryWrites, DEFAULT_TIMEZONE } from './rhythm';
import { maskToStore, weekdaysOut } from '@/lib/studyWeekdays.mjs';
import { isGoalMinutes } from '@/../data/goal_minutes';

export const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Colombo', 'Asia/Karachi', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
export const CHANNEL_KEYS = ['check_due', 'weekly_plan', 'study_window', 'result_ready'];
export const DEFAULT_CHANNELS = { check_due: true, weekly_plan: true, study_window: false, result_ready: true };
export const DELETION_PROMISE = 'We delete your account and study records within 30 days. Payment records required by law are kept.';
const SERVER_SCORING = ['server_snapshot_v1', 'server_practice_v1'];

const hhmm = t => String(t || '').slice(0, 5);
const fail = (msg, cause) => Object.assign(new Error(msg), { cause });

export function prefsOut(row) {
  return {
    timezone: row?.timezone || 'Asia/Kolkata',
    quietStart: hhmm(row?.quiet_start) || '23:00',
    quietEnd: hhmm(row?.quiet_end) || '07:00',
    channels: { ...DEFAULT_CHANNELS, ...(row?.channels || {}) },
    studyWindow: row?.study_window ?? null,
    weeklyCap: row?.weekly_cap ?? 5,
  };
}

export async function getNotificationPrefs(userId) {
  const { data, error } = await supabaseAdmin().from('notification_prefs').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail('PREFS_UNAVAILABLE', error);
  return prefsOut(data);
}

/** `patch` holds already-validated DB column values; omitted columns keep their stored value. */
export async function saveNotificationPrefs(userId, patch) {
  const row = { user_id: userId, ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin().from('notification_prefs').upsert(row, { onConflict: 'user_id' }).select('*').single();
  if (error) throw fail('PREFS_UNAVAILABLE', error);
  return prefsOut(data);
}

export async function registerDevice(userId, token, appVersion) {
  const { error } = await supabaseAdmin().from('push_devices').upsert(
    { user_id: userId, platform: 'android', token, app_version: appVersion || null, last_seen_at: new Date().toISOString(), revoked_at: null },
    { onConflict: 'token' });
  if (error) throw fail('DEVICE_UNAVAILABLE', error);
}

export async function revokeDevice(userId, token) {
  const { error } = await supabaseAdmin().from('push_devices').update({ revoked_at: new Date().toISOString() }).eq('token', token).eq('user_id', userId);
  if (error) throw fail('DEVICE_UNAVAILABLE', error);
}

// `weekdays`: the days the student chose (0 = Monday), or null when none are held or their count no longer
// matches the goal (src/lib/studyWeekdays.mjs). The mask column is read only if the row has it.
// `dailyMinutes`: the daily goal in minutes, a whole number from 5 to 999, or null when the student has not set one
// (supabase/migrations/20261020120000_study_goal_daily_minutes.sql). A row that lacks the column, or holds a value
// outside the range, reads as null: the app then keeps its own copy and the plan keeps its usual length.
export const goalOut = row => {
  const daysPerWeek = row?.days_per_week ?? 4;
  return { daysPerWeek, timezone: row?.timezone || 'Asia/Kolkata', pausedUntil: row?.paused_until || null, weekdays: weekdaysOut(row?.weekday_mask, daysPerWeek), dailyMinutes: isGoalMinutes(row?.daily_minutes) ? row.daily_minutes : null };
};

/** Postgres undefined_column, or PostgREST's "column not in the schema cache", for daily_minutes. */
export const missingMinutesColumn = (error) => Boolean(error) && (error.code === '42703' || error.code === 'PGRST204' || (/daily_minutes/.test(String(error.message || '')) && /does not exist|schema cache/.test(String(error.message || ''))));

export async function getGoal(userId) {
  const { data, error } = await supabaseAdmin().from('study_goals').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail('GOAL_UNAVAILABLE', error);
  return goalOut(data);
}

/**
 * The account's daily goal in minutes for the learning plan, or null (none set, the column not applied yet, or the
 * read failed: the plan then uses the usual length it always had, never an error).
 */
export async function getDailyMinutes(userId) {
  try {
    const { data, error } = await supabaseAdmin().from('study_goals').select('daily_minutes').eq('user_id', userId).maybeSingle();
    return !error && isGoalMinutes(data?.daily_minutes) ? data.daily_minutes : null;
  } catch { return null; }
}

const historyIn = rows => (rows || []).map(r => ({ effectiveWeek: r.effective_week, daysPerWeek: r.days_per_week }));

/** Goal history rows; an unavailable table (migration not applied) reads as no history. */
export async function loadGoalHistory(userId) {
  try {
    const { data, error } = await supabaseAdmin().from('study_goal_history').select('effective_week,days_per_week').eq('user_id', userId).order('effective_week', { ascending: true }).limit(500);
    return error ? [] : historyIn(data);
  } catch { return []; }
}

/**
 * A save of the daily minutes alone (a whole number from 5 to 999, or null to clear it): the days, the plan, the pause and the
 * history are left exactly as they are. A student with no goal row yet gets one at the default 4 days. Refused with
 * GOAL_MINUTES_NOT_ON_ACCOUNT before the daily_minutes column is applied, so the app keeps the goal on the phone.
 */
export async function saveDailyMinutes(userId, dailyMinutes) {
  const row = { user_id: userId, daily_minutes: dailyMinutes, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin().from('study_goals').upsert(row, { onConflict: 'user_id' }).select('*').single();
  if (missingMinutesColumn(error)) throw fail('GOAL_MINUTES_NOT_ON_ACCOUNT', error);
  if (error) throw fail('GOAL_UNAVAILABLE', error);
  return goalOut(data);
}

/**
 * `weekdays`: undefined keeps the stored plan while its count still matches the goal (and drops it when
 * it does not), null clears it, an array of validated weekdays (0 = Monday) replaces it. The plan and the
 * goal are written in one row, so the website and the app never see one without the other.
 * `dailyMinutes`: undefined keeps the stored daily goal, null clears it, a whole number from 5 to 999 replaces it.
 * Before the daily_minutes column is applied the days are still saved and the answer says `minutesOnAccount: false` and
 * holds `dailyMinutes: null` (saveDailyMinutes, the minutes alone, is refused instead: GOAL_MINUTES_NOT_ON_ACCOUNT).
 */
export async function saveGoal(userId, { daysPerWeek, pausedUntil, weekdays, dailyMinutes }) {
  const db = supabaseAdmin();
  const [prev, tzRes, history] = await Promise.all([
    db.from('study_goals').select('*').eq('user_id', userId).maybeSingle(),
    db.from('notification_prefs').select('timezone').eq('user_id', userId).maybeSingle(),
    loadGoalHistory(userId),
  ]);
  // History is written before the goal changes, so a past week can never be re-scored against a goal
  // it was not held to. A missing history table (before its migration) is tolerated; any other
  // history error stops the save so the student can retry without losing the baseline.
  const tz = tzRes.data?.timezone || prev.data?.timezone || DEFAULT_TIMEZONE;
  const currentWeek = weekStart(localDay(Date.now(), tz));
  const writes = planGoalHistoryWrites({ history, previousGoal: prev.data?.days_per_week ?? null, newGoal: daysPerWeek, currentWeek });
  if (writes.length) {
    const { error: historyError } = await db.from('study_goal_history').upsert(writes.map(w => ({ user_id: userId, effective_week: w.effectiveWeek, days_per_week: w.daysPerWeek })), { onConflict: 'user_id,effective_week' });
    if (historyError && historyError.code !== '42P01') throw fail('GOAL_UNAVAILABLE', historyError);
  }
  const row = { user_id: userId, days_per_week: daysPerWeek, paused_until: pausedUntil ?? null, updated_at: new Date().toISOString() };
  const mask = maskToStore({ weekdays, daysPerWeek, previousMask: prev.data?.weekday_mask });
  if (mask !== undefined) row.weekday_mask = mask;
  if (dailyMinutes !== undefined) row.daily_minutes = dailyMinutes;
  let { data, error } = await db.from('study_goals').upsert(row, { onConflict: 'user_id' }).select('*').single();
  let minutesOnAccount = true;
  if (dailyMinutes !== undefined && missingMinutesColumn(error)) {
    // The column is not applied yet: the days and the pause are still the student's to save.
    delete row.daily_minutes;
    minutesOnAccount = false;
    ({ data, error } = await db.from('study_goals').upsert(row, { onConflict: 'user_id' }).select('*').single());
  }
  if (error) throw fail('GOAL_UNAVAILABLE', error);
  return minutesOnAccount ? goalOut(data) : { ...goalOut(data), minutesOnAccount: false };
}

/**
 * Real activity for the rhythm: server-scored sessions submitted (attempts) and completed
 * Mistake Repairs (committed score_recovery_repair reservations holding a stored repair).
 * A session counts only with at least MIN_ANSWERED answered (correct + wrong) questions; that
 * floor is applied in computeRhythm from the `answered` field loaded here.
 * Reads only id/time/count columns, bounded to the last 26 weeks, plus the earliest few rows so
 * "first ..." and count milestones stay correct beyond the window (40 earliest sessions and 10
 * earliest full mocks are read so the floor can drop some and still leave 10 / 1).
 */
export async function loadActivity(userId, now = Date.now()) {
  const db = supabaseAdmin();
  const since = new Date(now - 26 * 7 * 86400000).toISOString();
  const cols = 'id,completed_at,correct,wrong,mode:selection_meta->>mode';
  const sessions = () => db.from('attempts').select(cols).eq('user_id', userId).in('selection_meta->>scoringVersion', SERVER_SCORING);
  const repairs = () => db.from('ai_credit_reservations').select('id,updated_at').eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair').not('receipt->repair', 'is', null);
  const [recentS, earlyS, fullS, recentR, earlyR] = await Promise.all([
    sessions().gte('completed_at', since).order('completed_at', { ascending: false }).limit(1000),
    sessions().order('completed_at', { ascending: true }).limit(40),
    sessions().eq('selection_meta->>mode', 'full').order('completed_at', { ascending: true }).limit(10),
    repairs().gte('updated_at', since).order('updated_at', { ascending: false }).limit(1000),
    repairs().order('updated_at', { ascending: true }).limit(25),
  ]);
  for (const r of [recentS, earlyS, fullS, recentR, earlyR]) if (r.error) throw fail('ACTIVITY_UNAVAILABLE', r.error);
  const s = r => ({ id: `a:${r.id}`, at: r.completed_at, kind: 'session', answered: (Number(r.correct) || 0) + (Number(r.wrong) || 0), fullMock: r.mode === 'full', mock: r.mode === 'full' || r.mode === 'nta' });
  const rep = r => ({ id: `r:${r.id}`, at: r.updated_at, kind: 'repair' });
  return [...(recentS.data || []).map(s), ...(earlyS.data || []).map(s), ...(fullS.data || []).map(s), ...(recentR.data || []).map(rep), ...(earlyR.data || []).map(rep)];
}

/**
 * "It held": the earliest right "Check it held" answer the student gave (the repair check stores its result on the
 * repair's committed reservation, receipt.check, with `right` and `answeredAt`; see repairCheck.js). One row, two
 * short columns. null = none yet; undefined = the read failed (the caller leaves the badge out rather than lock it).
 */
export async function loadFirstHold(userId) {
  try {
    const { data, error } = await supabaseAdmin().from('ai_credit_reservations').select('answered_at:receipt->check->>answeredAt')
      .eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair').eq('receipt->check->>right', 'true')
      .order('receipt->check->>answeredAt', { ascending: true }).limit(1);
    if (error) return undefined;
    return data?.[0]?.answered_at || null;
  } catch { return undefined; }
}

export async function getRhythm(userId, now = Date.now()) {
  const tzQuery = supabaseAdmin().from('notification_prefs').select('timezone').eq('user_id', userId).maybeSingle();
  const [goal, activities, tzRes, goalHistory, firstHoldAt] = await Promise.all([getGoal(userId), loadActivity(userId, now), tzQuery, loadGoalHistory(userId), loadFirstHold(userId)]);
  if (tzRes.error) throw fail('PREFS_UNAVAILABLE', tzRes.error);
  // notification_prefs.timezone is the single source of truth (the only place a student sets it).
  const timeZone = tzRes.data?.timezone || goal.timezone || 'Asia/Kolkata';
  return computeRhythm({ activities, daysPerWeek: goal.daysPerWeek, goalHistory, pausedUntil: goal.pausedUntil, timeZone, now, firstHoldAt });
}

/** Idempotent: one pending request per user (partial unique index). */
export async function requestDeletion(userId, source = 'android') {
  const db = supabaseAdmin();
  const pending = () => db.from('account_deletion_requests').select('requested_at').eq('user_id', userId).eq('status', 'pending').maybeSingle();
  let { data, error } = await pending();
  if (error) throw fail('DELETION_UNAVAILABLE', error);
  if (!data) {
    const ins = await db.from('account_deletion_requests').insert({ user_id: userId, source }).select('requested_at').single();
    if (ins.error && ins.error.code !== '23505') throw fail('DELETION_UNAVAILABLE', ins.error);
    data = ins.data;
    if (!data) { ({ data, error } = await pending()); if (error || !data) throw fail('DELETION_UNAVAILABLE', error); }
  }
  return { status: 'pending', requestedAt: data.requested_at, message: DELETION_PROMISE };
}
