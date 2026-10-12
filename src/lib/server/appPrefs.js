import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { computeRhythm } from './rhythm';

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

export const goalOut = row => ({ daysPerWeek: row?.days_per_week ?? 4, timezone: row?.timezone || 'Asia/Kolkata', pausedUntil: row?.paused_until || null });

export async function getGoal(userId) {
  const { data, error } = await supabaseAdmin().from('study_goals').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw fail('GOAL_UNAVAILABLE', error);
  return goalOut(data);
}

export async function saveGoal(userId, { daysPerWeek, pausedUntil }) {
  const row = { user_id: userId, days_per_week: daysPerWeek, paused_until: pausedUntil ?? null, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin().from('study_goals').upsert(row, { onConflict: 'user_id' }).select('*').single();
  if (error) throw fail('GOAL_UNAVAILABLE', error);
  return goalOut(data);
}

/**
 * Real activity for the rhythm: server-scored sessions submitted (attempts) and completed
 * Mistake Repairs (committed score_recovery_repair reservations holding a stored repair).
 * Reads only id/time columns, bounded to the last 26 weeks, plus the earliest few rows so
 * "first ..." and count milestones stay correct beyond the window.
 */
export async function loadActivity(userId, now = Date.now()) {
  const db = supabaseAdmin();
  const since = new Date(now - 26 * 7 * 86400000).toISOString();
  const sessions = () => db.from('attempts').select('id,completed_at').eq('user_id', userId).in('selection_meta->>scoringVersion', SERVER_SCORING);
  const repairs = () => db.from('ai_credit_reservations').select('id,updated_at').eq('user_id', userId).eq('state', 'committed').eq('action', 'score_recovery_repair').not('receipt->repair', 'is', null);
  const [recentS, earlyS, fullS, recentR, earlyR] = await Promise.all([
    sessions().gte('completed_at', since).order('completed_at', { ascending: false }).limit(1000),
    sessions().order('completed_at', { ascending: true }).limit(10),
    sessions().eq('selection_meta->>mode', 'full').order('completed_at', { ascending: true }).limit(1),
    repairs().gte('updated_at', since).order('updated_at', { ascending: false }).limit(1000),
    repairs().order('updated_at', { ascending: true }).limit(25),
  ]);
  for (const r of [recentS, earlyS, fullS, recentR, earlyR]) if (r.error) throw fail('ACTIVITY_UNAVAILABLE', r.error);
  const fullIds = new Set((fullS.data || []).map(r => r.id));
  const s = r => ({ id: `a:${r.id}`, at: r.completed_at, kind: 'session', fullMock: fullIds.has(r.id) });
  const rep = r => ({ id: `r:${r.id}`, at: r.updated_at, kind: 'repair' });
  return [...(recentS.data || []).map(s), ...(earlyS.data || []).map(s), ...(fullS.data || []).map(s), ...(recentR.data || []).map(rep), ...(earlyR.data || []).map(rep)];
}

export async function getRhythm(userId, now = Date.now()) {
  const tzQuery = supabaseAdmin().from('notification_prefs').select('timezone').eq('user_id', userId).maybeSingle();
  const [goal, activities, tzRes] = await Promise.all([getGoal(userId), loadActivity(userId, now), tzQuery]);
  if (tzRes.error) throw fail('PREFS_UNAVAILABLE', tzRes.error);
  // notification_prefs.timezone is the single source of truth (the only place a student sets it).
  const timeZone = tzRes.data?.timezone || goal.timezone || 'Asia/Kolkata';
  return computeRhythm({ activities, daysPerWeek: goal.daysPerWeek, pausedUntil: goal.pausedUntil, timeZone, now });
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
