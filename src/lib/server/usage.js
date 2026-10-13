// Pure helpers for optional, adult-only, first-party usage data. No I/O here.
export const POLICY_VERSION = '2026-10-12';
export const CONSENT_LABEL = 'Allow usage data to improve MockMob';
export const AGE_BANDS = ['adult', 'minor', 'unknown'];
export const MAX_BATCH = 50;
export const EVENT_NAMES = new Set(['session_started', 'session_submitted', 'result_opened', 'recap_opened', 'recap_skipped', 'next_move_impression', 'next_move_reason_opened', 'next_move_started', 'next_move_dismissed', 'repair_started', 'repair_completed', 'fresh_check_completed', 'reminder_permission_result', 'notification_opened', 'goal_set', 'weekly_goal_met', 'finish_for_now', 'app_link_opened', 'app_opened']);
export const PROP_KEYS = { subject: 'string', mode: 'string', state: 'string', action_type: 'string', minutes: 'number', count: 'number', outcome: 'string', source: 'string', screen: 'string', variant: 'string' };
const PLATFORMS = new Set(['android', 'web']);
const MAX_STR = 64;
const PAST_MS = 7 * 24 * 3600 * 1000;
const FUTURE_MS = 5 * 60 * 1000;

export function canCollect(row) {
  return !!row && row.analytics_allowed === true && row.age_band === 'adult' && !row.withdrawn_at;
}

export function validateProps(props) {
  if (props === undefined || props === null) return {};
  if (typeof props !== 'object' || Array.isArray(props)) return null;
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    const type = PROP_KEYS[k];
    if (!type) return null;
    if (type === 'string' && (typeof v !== 'string' || v.length > MAX_STR)) return null;
    if (type === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) return null;
    out[k] = v;
  }
  return Buffer.byteLength(JSON.stringify(out)) <= 1024 ? out : null;
}

export function normalizeEvent(e, userId, now = Date.now()) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (typeof e.event_id !== 'string' || !e.event_id || e.event_id.length > 64) return null;
  if (!EVENT_NAMES.has(e.name) || !PLATFORMS.has(e.platform)) return null;
  const t = typeof e.occurred_at === 'string' || typeof e.occurred_at === 'number' ? new Date(e.occurred_at).getTime() : NaN;
  if (!Number.isFinite(t) || t < now - PAST_MS || t > now + FUTURE_MS) return null;
  const props = validateProps(e.props);
  if (!props) return null;
  let appVersion = null;
  if (e.app_version != null) { if (typeof e.app_version !== 'string' || e.app_version.length > 32) return null; appVersion = e.app_version; }
  return { event_id: e.event_id, user_id: userId, name: e.name, platform: e.platform, app_version: appVersion, occurred_at: new Date(t).toISOString(), props };
}

// Returns { rows, dropped } or { error } when the batch itself is unusable.
export function normalizeBatch(events, userId, now = Date.now()) {
  if (!Array.isArray(events)) return { error: 'events must be an array' };
  if (events.length > MAX_BATCH) return { error: `At most ${MAX_BATCH} events per request` };
  const seen = new Set();
  const rows = [];
  for (const e of events) {
    const row = normalizeEvent(e, userId, now);
    if (!row || seen.has(row.event_id)) continue;
    seen.add(row.event_id); rows.push(row);
  }
  return { rows, dropped: events.length - rows.length };
}
