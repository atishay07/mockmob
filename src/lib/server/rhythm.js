// Weekly study rhythm. PURE: no I/O, no clock reads except through the `now` argument.
//
// A "study day" is a local calendar day (user's timezone, IST default) with at least one
// qualifying activity: a server-scored session submitted, or a completed Mistake Repair.
// Weeks run Monday to Sunday in the user's timezone. Nothing here deletes or lowers stored
// history: bestRun and milestones only ever come from what really happened.
//
// Known limits (documented on purpose):
//  - The current goal is applied to every past week (goal history is not stored).
//  - A week counts as paused only if paused_until covers its Sunday and the goal was not met;
//    the pause start is not stored, so a pause never retroactively hides a met week.
//  - Fresh-check milestones are omitted: no server record of passed fresh checks is read here.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const RETURNING_AFTER_DAYS = 3;
const DAY_MS = 86400000;

const fmtCache = new Map();
function formatter(timeZone) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmtCache.set(timeZone, f);
  }
  return f;
}

/** 'YYYY-MM-DD' for the instant `ms` in `timeZone`. */
export function localDay(ms, timeZone = DEFAULT_TIMEZONE) {
  return formatter(timeZone).format(new Date(ms));
}

const dayNumber = key => Date.parse(`${key}T00:00:00Z`) / DAY_MS;
const dayKey = n => new Date(n * DAY_MS).toISOString().slice(0, 10);
/** Monday of the week containing a day key. */
export function weekStart(key) {
  const n = dayNumber(key);
  const weekday = (new Date(n * DAY_MS).getUTCDay() + 6) % 7; // Monday = 0
  return dayKey(n - weekday);
}
const addDays = (key, d) => dayKey(dayNumber(key) + d);

function toMs(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Date.parse(v);
  return NaN;
}

function normalise(activities) {
  const seen = new Set();
  const out = [];
  for (const raw of activities || []) {
    const e = raw && typeof raw === 'object' && !(raw instanceof Date) ? raw : { at: raw };
    const at = toMs(e.at);
    if (!Number.isFinite(at)) continue;
    if (e.id != null) { if (seen.has(e.id)) continue; seen.add(e.id); }
    out.push({ at, kind: e.kind === 'repair' ? 'repair' : 'session', fullMock: !!e.fullMock });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * @param {object} p
 * @param {Array<number|string|Date|{at,kind?:'session'|'repair',fullMock?:boolean,id?:string}>} p.activities
 * @param {number} [p.daysPerWeek=4]
 * @param {string|null} [p.pausedUntil]  'YYYY-MM-DD'
 * @param {string} [p.timeZone]
 * @param {number|string|Date} [p.now]
 */
export function computeRhythm({ activities = [], daysPerWeek = 4, pausedUntil = null, timeZone = DEFAULT_TIMEZONE, now = Date.now() } = {}) {
  const goal = Math.min(7, Math.max(1, Math.trunc(Number(daysPerWeek)) || 4));
  const nowMs = toMs(now);
  const events = normalise(activities).filter(e => e.at <= nowMs);
  const today = localDay(nowMs, timeZone);
  const thisWeek = weekStart(today);
  const paused = typeof pausedUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pausedUntil) ? pausedUntil : null;

  // week -> Map(day -> first activity ms)
  const weeks = new Map();
  for (const e of events) {
    const d = localDay(e.at, timeZone);
    const w = weekStart(d);
    if (!weeks.has(w)) weeks.set(w, new Map());
    const days = weeks.get(w);
    if (!days.has(d)) days.set(d, e.at);
  }
  const daysIn = w => weeks.get(w)?.size || 0;
  const metIn = w => daysIn(w) >= goal;
  const pausedWeek = w => !!paused && paused >= addDays(w, 6);

  // Streak counting back from last week; the current week counts only once met.
  let streak = 0;
  const currentMet = metIn(thisWeek);
  if (currentMet) streak++;
  const firstWeek = events.length ? weekStart(localDay(events[0].at, timeZone)) : null;
  if (firstWeek) {
    for (let w = addDays(thisWeek, -7); w >= firstWeek; w = addDays(w, -7)) {
      if (metIn(w)) streak++;
      else if (pausedWeek(w)) continue;
      else break;
    }
  }

  // Best run over all history, same rules, oldest to newest.
  let bestRun = 0, run = 0;
  if (firstWeek) {
    for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
      if (metIn(w)) { run++; bestRun = Math.max(bestRun, run); }
      else if (w === thisWeek || pausedWeek(w)) continue;
      else run = 0;
    }
  }

  const weekDays = [...(weeks.get(thisWeek)?.keys() || [])].sort();
  const last = events.length ? events[events.length - 1].at : null;
  const daysSince = last == null ? null : Math.max(0, Math.round(dayNumber(today) - dayNumber(localDay(last, timeZone))));

  return {
    timeZone,
    weekStart: thisWeek,
    studyDays: weekDays.length,
    studyDayDates: weekDays,
    daysGoal: goal,
    metThisWeek: currentMet,
    paused: !!paused && paused >= today,
    weeksMetStreak: streak,
    bestRun,
    lastActivityAt: last == null ? null : new Date(last).toISOString(),
    daysSinceLastActivity: daysSince,
    returning: daysSince != null && daysSince >= RETURNING_AFTER_DAYS,
    milestones: computeMilestones(events, weeks, goal),
  };
}

const MILESTONE_IDS = ['first_scored_session', 'first_full_mock', 'first_repair', 'repairs_5', 'repairs_10', 'repairs_25', 'sessions_10', 'first_week_met', 'weeks_met_4'];

function computeMilestones(events, weeks, goal) {
  const sessions = events.filter(e => e.kind === 'session');
  const repairs = events.filter(e => e.kind === 'repair');
  const iso = e => (e ? new Date(e.at).toISOString() : null);
  // Instant the goal-th distinct study day of a week was reached.
  const metAt = [];
  for (const days of weeks.values()) {
    if (days.size >= goal) metAt.push([...days.values()].sort((a, b) => a - b)[goal - 1]);
  }
  metAt.sort((a, b) => a - b);
  const at = {
    first_scored_session: iso(sessions[0]),
    first_full_mock: iso(sessions.find(e => e.fullMock)),
    first_repair: iso(repairs[0]),
    repairs_5: iso(repairs[4]),
    repairs_10: iso(repairs[9]),
    repairs_25: iso(repairs[24]),
    sessions_10: iso(sessions[9]),
    first_week_met: metAt.length >= 1 ? new Date(metAt[0]).toISOString() : null,
    weeks_met_4: metAt.length >= 4 ? new Date(metAt[3]).toISOString() : null,
  };
  return MILESTONE_IDS.map(id => ({ id, achievedAt: at[id] }));
}
