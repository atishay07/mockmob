// Weekly study rhythm. PURE: no I/O, no clock reads except through the `now` argument.
//
// A "study day" is a local calendar day (user's timezone, IST default) with at least one
// qualifying activity: a server-scored session with at least MIN_ANSWERED answered questions,
// or a completed Mistake Repair (one per acknowledged explained repair).
// Weeks run Monday to Sunday in the user's timezone. Nothing here deletes or lowers stored
// history: bestRun and milestones only ever come from what really happened.
//
// Known limits (documented on purpose):
//  - Goal history: a closed week uses the goal in force for it (latest history entry whose
//    effective week is on or before it; weeks before the first entry use the first entry).
//    The CURRENT week always uses the current stored goal. Without history rows (migration not
//    applied) every week uses the current goal.
//  - A week counts as paused only if paused_until covers its Sunday and the goal was not met;
//    the pause start is not stored, so a pause never retroactively hides a met week.
//  - first_hold ("It held") comes from the caller: `firstHoldAt` is the time of the student's earliest right
//    "Check it held" answer (ISO), null when there is none, or undefined when it could not be read. Undefined
//    leaves the id out of the list, so a failed read is never shown as a locked badge.
//  - run_weeks_3 is dated by the moment the third week of the first run of 3 weeks at goal reached its goal.

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const RETURNING_AFTER_DAYS = 3;
export const MIN_ANSWERED = 5;
export const HISTORY_WEEKS = 12;
/** Monday used as the effective week of a goal that predates goal history. */
export const BASE_WEEK = '2000-01-03';
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

const clampGoal = v => Math.min(7, Math.max(1, Math.trunc(Number(v)) || 4));

function cleanHistory(history) {
  const out = [];
  for (const h of history || []) {
    const w = h?.effectiveWeek;
    if (typeof w !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w)) continue;
    const d = Number(h.daysPerWeek);
    if (!Number.isInteger(d) || d < 1 || d > 7) continue;
    out.push({ effectiveWeek: weekStart(w), daysPerWeek: d });
  }
  return out.sort((a, b) => (a.effectiveWeek < b.effectiveWeek ? -1 : a.effectiveWeek > b.effectiveWeek ? 1 : 0));
}

/** Goal in force for a week: latest entry with effectiveWeek <= week, else the first entry, else `fallback`. */
export function goalForWeek(history, week, fallback = 4) {
  const h = cleanHistory(history);
  if (!h.length) return clampGoal(fallback);
  let g = h[0].daysPerWeek;
  for (const e of h) { if (e.effectiveWeek <= week) g = e.daysPerWeek; else break; }
  return g;
}

/**
 * Goal-history rows to upsert when a student saves `newGoal` during `currentWeek` (Monday key).
 * The change applies from the current week; closed weeks keep the goal they had. A goal that
 * predates history (previousGoal with no rows) is first stored as the BASE_WEEK baseline.
 */
export function planGoalHistoryWrites({ history = [], previousGoal = null, newGoal, currentWeek }) {
  const rows = [];
  const base = cleanHistory(history);
  if (!base.length && previousGoal != null) rows.push({ effectiveWeek: BASE_WEEK, daysPerWeek: clampGoal(previousGoal) });
  const inForce = goalForWeek([...base, ...rows], currentWeek, 0);
  const has = base.length + rows.length > 0;
  if (!has || inForce !== newGoal) rows.push({ effectiveWeek: currentWeek, daysPerWeek: newGoal });
  return rows;
}

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
    const kind = e.kind === 'repair' ? 'repair' : 'session';
    // Floor: a server-scored session counts only with enough answered questions. Callers that
    // do not know the count (answered null/undefined) are trusted.
    if (kind === 'session' && e.answered != null && !(Number(e.answered) >= MIN_ANSWERED)) continue;
    out.push({ at, kind, fullMock: !!e.fullMock, mock: !!(e.fullMock || e.mock) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * @param {object} p
 * @param {Array<number|string|Date|{at,kind?:'session'|'repair',fullMock?:boolean,id?:string}>} p.activities
 * @param {number} [p.daysPerWeek=4]  current goal (used for the current week)
 * @param {Array<{effectiveWeek:string,daysPerWeek:number}>} [p.goalHistory]
 * @param {string|null} [p.pausedUntil]  'YYYY-MM-DD'
 * @param {string} [p.timeZone]
 * @param {number|string|Date} [p.now]
 * @param {string|null} [p.firstHoldAt]  earliest right "Check it held" answer (ISO); undefined = not read
 */
export function computeRhythm({ activities = [], daysPerWeek = 4, goalHistory = [], pausedUntil = null, timeZone = DEFAULT_TIMEZONE, now = Date.now(), firstHoldAt = undefined } = {}) {
  const goal = clampGoal(daysPerWeek);
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
  const goalOf = w => (w >= thisWeek ? goal : goalForWeek(goalHistory, w, goal));
  const metIn = w => daysIn(w) >= goalOf(w);
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

  // Best run over all history, same rules, oldest to newest. Also: the week the best run ended and the
  // instant the first run of 3 weeks at goal was complete (the goal-th study day of its third week).
  let bestRun = 0, run = 0, bestRunEndedWeek = null, run3At = null;
  const metInstant = w => [...weeks.get(w).values()].sort((a, b) => a - b)[goalOf(w) - 1];
  if (firstWeek) {
    for (let w = firstWeek; w <= thisWeek; w = addDays(w, 7)) {
      if (metIn(w)) {
        run++;
        if (run >= bestRun) { bestRun = run; bestRunEndedWeek = w; }
        if (run >= 3 && run3At == null) run3At = metInstant(w);
      }
      else if (w === thisWeek || pausedWeek(w)) continue;
      else run = 0;
    }
  }

  // Closed weeks, newest first, from the first week with any activity (never before it).
  const closed = w => ({ weekStart: w, studyDays: daysIn(w), goal: goalOf(w), met: metIn(w) });
  const history = [];
  if (firstWeek) {
    for (let i = 1; i <= HISTORY_WEEKS; i++) {
      const w = addDays(thisWeek, -7 * i);
      if (w < firstWeek) break;
      const c = closed(w);
      history.push({ ...c, paused: !c.met && pausedWeek(w) });
    }
  }
  const prev = addDays(thisWeek, -7);
  const lastClosedWeek = firstWeek && prev >= firstWeek ? (({ weekStart: id, studyDays, goal: g, met }) => ({ id, studyDays, goal: g, met }))(closed(prev)) : null;
  const inThisWeek = e => weekStart(localDay(e.at, timeZone)) === thisWeek;
  const repairsThisWeek = events.filter(e => e.kind === 'repair' && inThisWeek(e)).length;
  const mocksThisWeek = events.filter(e => e.kind === 'session' && e.mock && inThisWeek(e)).length;

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
    history,
    repairsThisWeek,
    mocksThisWeek,
    lastClosedWeek,
    bestRunEndedWeek,
    counts: countsOf(events, weeks, goalOf),
    milestones: computeMilestones(events, weeks, goalOf, { run3At, firstHoldAt }),
  };
}

/** Exact counts toward the countable badges, from the records read (never more than the badge needs is promised). */
function countsOf(events, weeks, goalOf) {
  let weeksMet = 0;
  for (const [w, days] of weeks) if (days.size >= goalOf(w)) weeksMet++;
  return {
    sessions: events.filter(e => e.kind === 'session').length,
    repairs: events.filter(e => e.kind === 'repair').length,
    weeksMet,
  };
}

const MILESTONE_IDS = ['first_scored_session', 'first_full_mock', 'first_repair', 'repairs_5', 'repairs_10', 'repairs_25', 'sessions_10', 'first_week_met', 'weeks_met_4'];

function computeMilestones(events, weeks, goalOf, { run3At = null, firstHoldAt } = {}) {
  const sessions = events.filter(e => e.kind === 'session');
  const repairs = events.filter(e => e.kind === 'repair');
  const iso = e => (e ? new Date(e.at).toISOString() : null);
  // Instant the goal-th distinct study day of a week was reached.
  const metAt = [];
  for (const [w, days] of weeks) {
    const goal = goalOf(w);
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
  const list = MILESTONE_IDS.map(id => ({ id, achievedAt: at[id] }));
  // New ids (app-you-1016): run_weeks_3 is always listed; first_hold only when its read succeeded.
  list.push({ id: 'run_weeks_3', achievedAt: run3At == null ? null : new Date(run3At).toISOString() });
  if (firstHoldAt !== undefined) {
    const t = firstHoldAt == null ? NaN : Date.parse(firstHoldAt);
    list.push({ id: 'first_hold', achievedAt: Number.isFinite(t) ? new Date(t).toISOString() : null });
  }
  return list;
}
