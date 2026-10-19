// The personal daily chain (MOB-BUILD-SPEC-V3 2.3 and 3.8; D133 "the two-streak humane system"). Pure and
// deterministic: computed from daily answered counts (IST days), exam pause days, held fixes and the clock. Nothing is
// stored but the student's own settings and a best that only rises (chain_prefs.best_days), so it is repairable.
//   A day counts with 5 or more answered questions (skips never count).
//   A missed day takes a rest pass if one is held (it applies itself), else a free make-up (10 answered on either of
//   the next two days, once in 14 days), else it is "open" while the make-up can still land, else missed.
//   Passes: one at day 3 (once), one at every 7th day, one for every 3rd held fix (all time); at most 2 held.
//   Pause days hold the chain and do not add. No warnings, no countdowns: a best run never drops.
import { CHAIN_MILESTONES } from '../mob/folds.mjs';

export const DAY_GOAL = 5;
export const MAKE_UP_GOAL = 10;
export const MAKE_UP_EVERY = 14;
export const PASS_MAX = 2;
export const PAUSE_MAX = 14;
const DAY_MS = 86_400_000;
const addDays = (key, d) => new Date(Date.parse(`${key}T00:00:00Z`) + d * DAY_MS).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

/** The CUET season of a day: 1 Aug to 31 Jul. Returns the season's first day. */
export function seasonStart(day) {
  const y = Number(day.slice(0, 4));
  return day.slice(5) >= '08-01' ? `${y}-08-01` : `${y - 1}-08-01`;
}

/**
 * daily: [{ day, answered }] (IST days); pauses: [day]; fixesHeld: [{ day, n }] (right "held" checks per IST day);
 * today: 'YYYY-MM-DD' (IST). Returns the walk: { states: Map(day -> state), chain, passes, best, practised, rested,
 * madeUp, paused, open: day | null, makeUpAvailable, lastMakeUp, valueAt: Map(day -> chain after that day), gifted }.
 */
export function walkChain({ daily = [], pauses = [], fixesHeld = [], today }) {
  const answered = new Map();
  for (const d of daily || []) if (d?.day) answered.set(String(d.day).slice(0, 10), (answered.get(String(d.day).slice(0, 10)) || 0) + Math.max(0, Number(d.answered) || 0));
  const paused = new Set((pauses || []).map((d) => String(d).slice(0, 10)));
  const fixes = [...(fixesHeld || [])].map((f) => ({ day: String(f.day).slice(0, 10), n: Math.max(0, Number(f.n) || 0) })).sort((a, b) => a.day.localeCompare(b.day));
  const a = (d) => answered.get(d) || 0;
  const states = new Map();
  const valueAt = new Map();
  let chain = 0; let passes = 0; let gifted = false; let lastMakeUp = null; let best = 0;
  let practised = 0; let rested = 0; let madeUp = 0; let pausedN = 0; let open = null; let creditedThirds = 0;
  const first = [...answered.keys()].filter((d) => a(d) >= DAY_GOAL && d < today).sort()[0];
  const makeUpOk = (d) => (lastMakeUp === null || diffDays(d, lastMakeUp) >= MAKE_UP_EVERY)
    && ((addDays(d, 1) <= today && a(addDays(d, 1)) >= MAKE_UP_GOAL) || (addDays(d, 2) <= today && a(addDays(d, 2)) >= MAKE_UP_GOAL));
  if (first) {
    for (let d = first; d < today; d = addDays(d, 1)) {
      let grew = false;
      if (paused.has(d)) { states.set(d, 'paused'); pausedN += 1; }
      else if (a(d) >= DAY_GOAL) { states.set(d, 'practised'); chain += 1; practised += 1; grew = true; }
      else if (passes > 0) { states.set(d, 'rested'); passes -= 1; chain += 1; rested += 1; grew = true; }
      else if (makeUpOk(d)) { states.set(d, 'made_up'); chain += 1; madeUp += 1; lastMakeUp = d; grew = true; }
      else if (addDays(d, 2) >= today) { states.set(d, 'open'); open = d; valueAt.set(d, chain); break; }
      else { states.set(d, 'missed'); chain = 0; practised = 0; rested = 0; madeUp = 0; pausedN = 0; }
      if (grew && chain === 3 && !gifted) { passes += 1; gifted = true; }
      if (grew && chain > 0 && chain % 7 === 0) passes += 1;
      const held = fixes.filter((f) => f.day <= d).reduce((s, f) => s + f.n, 0);
      const thirds = Math.floor(held / 3);
      if (thirds > creditedThirds) { passes += thirds - creditedThirds; creditedThirds = thirds; }
      passes = Math.min(passes, PASS_MAX);
      best = Math.max(best, chain);
      valueAt.set(d, chain);
    }
  }
  const makeUpAvailable = open !== null && (lastMakeUp === null || diffDays(open, lastMakeUp) >= MAKE_UP_EVERY);
  return { states, valueAt, chain, passes, best, practised, rested, madeUp, paused: pausedN, open, makeUpAvailable, lastMakeUp, gifted, answeredOn: a, pausedDays: paused };
}

/** The next pass the days can bring: { kind: 'days', at }. */
function nextPass(days, gifted) {
  if (!gifted && days < 3) return { kind: 'days', at: 3 };
  return { kind: 'days', at: (Math.floor(days / 7) + 1) * 7 };
}

const monthStart = (day) => `${day.slice(0, 7)}-01`;
const prevMonthStart = (day) => {
  const y = Number(day.slice(0, 4)); const m = Number(day.slice(5, 7));
  return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
};
const nextMonthStart = (day) => {
  const y = Number(day.slice(0, 4)); const m = Number(day.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
};

/**
 * The GET /api/me/chain body (3.8). input: walkChain's input plus { hidden, storedBest, seen: Set(keys) }.
 * Every number is computed here; the app only formats.
 */
export function computeChain({ daily = [], pauses = [], fixesHeld = [], today, hidden = false, storedBest = 0, seen = new Set() }) {
  const w = walkChain({ daily, pauses, fixesHeld, today });
  const answeredToday = w.answeredOn(today);
  const todayDone = answeredToday >= DAY_GOAL;
  const days = w.chain + (todayDone ? 1 : 0);
  const best = Math.max(w.best, days, Math.max(0, Number(storedBest) || 0));
  const stateOf = (d) => {
    if (d === today) return todayDone ? 'practised' : 'today';
    if (d > today) return w.pausedDays.has(d) ? 'paused' : 'none';
    return w.states.get(d) || (w.pausedDays.has(d) ? 'paused' : 'none');
  };
  const week = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    const s = stateOf(d);
    week.push(d === today && !todayDone ? { day: d, state: 'today', answered: answeredToday } : { day: d, state: s });
  }
  const calendar = [];
  const end = nextMonthStart(today);
  for (let d = prevMonthStart(today); d < end; d = addDays(d, 1)) {
    const s = stateOf(d);
    calendar.push({ day: d, state: s === 'today' ? 'none' : s });
  }
  const milestones = CHAIN_MILESTONES.map((m) => (best >= m.at ? { at: m.at, reward: m.reward, done: true } : { at: m.at, reward: m.reward, done: false, left: m.at - days }));
  const nextM = CHAIN_MILESTONES.find((m) => days < m.at) || null;
  const due = CHAIN_MILESTONES.filter((m) => days >= m.at && !seen.has(`chain:${m.at}`)).map((m) => `chain:${m.at}`);
  const notices = [];
  for (const [d, s] of w.states) {
    if ((s === 'rested' || s === 'made_up') && diffDays(today, d) <= 14 && !seen.has(`rest:${d}`)) notices.push({ key: `rest:${d}`, kind: s, day: d, days: w.valueAt.get(d) });
  }
  const season = seasonStart(today);
  const pauseDays = [...w.pausedDays].filter((d) => d > today).sort();
  const usedThisSeason = [...w.pausedDays].filter((d) => seasonStart(d) === season).length;
  return {
    hidden: Boolean(hidden), days, practised: w.practised + (todayDone ? 1 : 0), rested: w.rested, madeUp: w.madeUp, best,
    today: { answered: answeredToday, needed: DAY_GOAL, done: todayDone },
    passes: { held: w.passes, max: PASS_MAX, next: nextPass(days, w.gifted) },
    week, calendar, milestones,
    next: nextM ? { at: nextM.at, reward: nextM.reward, left: nextM.at - days } : null,
    makeUp: w.open && w.makeUpAvailable ? { day: w.open, needed: MAKE_UP_GOAL, answeredToday } : null,
    pause: { days: pauseDays, usedThisSeason, max: PAUSE_MAX },
    notices, due,
  };
}

/** Pause days a student may set: after today, at most PAUSE_MAX in a season (counting days already set). */
export function checkPause({ days, today, existing = [] }) {
  const list = [...new Set((days || []).map((d) => String(d)))];
  if (!list.length || list.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)))) return { ok: false, code: 'BODY_INVALID' };
  if (list.some((d) => d <= today)) return { ok: false, code: 'PAUSE_PAST' };
  const all = new Set([...(existing || []).map(String), ...list]);
  const bySeason = new Map();
  for (const d of all) bySeason.set(seasonStart(d), (bySeason.get(seasonStart(d)) || 0) + 1);
  if ([...bySeason.values()].some((n) => n > PAUSE_MAX)) return { ok: false, code: 'PAUSE_LIMIT' };
  return { ok: true, days: list.sort() };
}

/** Came back after RETURNING_AFTER_DAYS or more days away (Cutting): a day with practice 3+ days after the last one. */
export function cameBack(daily = [], gap = 3) {
  const active = [...new Set((daily || []).filter((d) => Number(d.answered) > 0).map((d) => String(d.day).slice(0, 10)))].sort();
  for (let i = 1; i < active.length; i += 1) if (diffDays(active[i], active[i - 1]) >= gap) return true;
  return false;
}

/** The chain chip for the den: { hidden, days, todayDone }. */
export const chainChip = (c) => ({ hidden: Boolean(c.hidden), days: c.days, todayDone: c.today.done });
