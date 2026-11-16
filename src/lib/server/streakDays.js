// The daily streak's other days (17 Nov 2026, S2: one rule for "a day counts"). chain_daily (applied SQL) reads attempts, Mob
// game answers and fix checks; the rhythm already counted a whole Daily Five and a finished Mistake Repair as a study day, and the
// streak now does too, without new SQL: these rows are read here and merged in JS (src/lib/server/chain.js mergeStreakDays).
//   A Daily Five: all five places answered on the account ('daily_five' rows, session 'daily:YYYY-MM-DD', the same rows the
//   rhythm reads in appPrefs.js loadDailyFiveDays). Its day is the session's own IST day; it adds its 5 answers.
//   A repair: a committed score_recovery_repair reservation holding a stored repair (the rhythm's rule). Its day is the IST day
//   of updated_at, like the rhythm; it makes the day count but adds no answers, so it never makes a 10-answer make-up alone.
// No '@/' imports (node:test drives it with a fake client). A failed read gives [] for that source: the streak is never lost
// over its newest sources, it only counts less until the read works.
import { localDay } from './rhythm.js';

const DAY_KEY = /^daily:(\d{4}-\d{2}-\d{2})$/;

/** Whole Daily Fives from their rows: [{ day, answered: 5 }], one per day with all five places. */
export function dailyFiveStreakDays(rows = []) {
  const days = new Map();
  for (const r of rows || []) {
    const m = DAY_KEY.exec(String(r?.session_id || ''));
    const n = Number(r?.n);
    if (!m || !Number.isInteger(n) || n < 1 || n > 5) continue;
    if (!days.has(m[1])) days.set(m[1], new Set());
    days.get(m[1]).add(n);
  }
  return [...days].filter(([, places]) => places.size === 5).map(([day]) => ({ day, answered: 5, source: 'daily' }));
}

/** Finished repairs: [{ day, answered: 0, counts: true }], one per IST day. */
export function repairStreakDays(rows = []) {
  const days = new Set();
  for (const r of rows || []) {
    const ms = Date.parse(r?.updated_at);
    if (Number.isFinite(ms)) days.add(localDay(ms, 'Asia/Kolkata'));
  }
  return [...days].sort().map((day) => ({ day, answered: 0, counts: true, source: 'repair' }));
}

/**
 * db: a Supabase client (service role, on the server). fromDay: 'YYYY-MM-DD' (IST), the chain's own window.
 * Returns the extra days for the chain walk. Two bounded reads of short columns.
 */
export async function readStreakExtras(db, userId, fromDay) {
  const since = `${fromDay}T00:00:00+05:30`;
  let ok = true;
  const fives = async () => {
    try {
      const { data, error } = await db.from('question_interactions').select('session_id,n:metadata->>n').eq('user_id', userId).is('flow_context', null)
        .eq('interaction_type', 'daily_five').gte('created_at', since).order('created_at', { ascending: false }).limit(4000);
      if (error) { ok = false; return []; }
      return dailyFiveStreakDays(data || []);
    } catch { ok = false; return []; }
  };
  const repairs = async () => {
    try {
      const { data, error } = await db.from('ai_credit_reservations').select('updated_at').eq('user_id', userId).eq('state', 'committed')
        .eq('action', 'score_recovery_repair').not('receipt->repair', 'is', null).gte('updated_at', since).order('updated_at', { ascending: false }).limit(2000);
      if (error) { ok = false; return []; }
      return repairStreakDays(data || []);
    } catch { ok = false; return []; }
  };
  const [a, b] = await Promise.all([fives(), repairs()]);
  const out = [...a, ...b];
  Object.defineProperty(out, 'ok', { value: ok }); // false when a source failed (the reader below never keeps such a read)
  return out;
}

/**
 * The extra days with the past kept (17 Nov review, egress): the streak is read on Today, You and the top bar, and the whole
 * 730-day read of Daily Fives and repairs ran on each. Days before today do not change, so a whole read is kept per student for
 * `ttlMs` (10 minutes) within one IST day; between whole reads only today's rows are read (at most 5 Daily Five rows and a few
 * repairs). A read with a failed source is never kept. read(userId, fromDay) is readStreakExtras bound to the client.
 */
export function createStreakExtrasReader({ read, now = () => Date.now(), ttlMs = 10 * 60_000, max = 2000 }) {
  const kept = new Map();
  return async function extraDays(userId, fromDay) {
    const today = localDay(now(), 'Asia/Kolkata');
    const hit = kept.get(userId);
    if (hit && hit.today === today && hit.from === fromDay && now() - hit.at < ttlMs) {
      const fresh = await read(userId, today);
      return [...hit.past, ...fresh.filter((d) => d.day >= today)];
    }
    const all = await read(userId, fromDay);
    if (all.ok !== false) {
      if (kept.size >= max) kept.delete(kept.keys().next().value);
      kept.delete(userId);
      kept.set(userId, { today, from: fromDay, at: now(), past: all.filter((d) => d.day < today) });
    }
    return [...all];
  };
}
