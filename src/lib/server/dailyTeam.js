// Playing for a college, server half (17 Nov 2026, lane daily). The rules are the pure model's (src/lib/daily/team.mjs); this
// file reads the rows they need and serves the college board. No new table: the college a five was played for is in each
// Daily Five row's metadata (`for`, written by POST /api/daily/check, src/lib/server/dailyFiveAccount.js), and the Sunday
// Mock's sittings are its tagged attempts. No 'server-only' and no alias imports: node:test drives the store with an
// in-memory database and the handler with fakes (src/lib/daily/team.test.mjs, data/tests/daily_team_1117.test.mjs).
//
//   GET /api/daily/board?day=<n>   public, rate-limited, cached: today's board, the week's, the last Sunday Mock's and
//                                  yesterday's trap. Colleges and counts only: never a user id, a seat or one student's score.
//
// The seat (seatOf): a four-digit number from the account id and a server secret (HMAC-SHA256), the same every time, shown
// only to its owner by GET /api/daily/me. It cannot be turned back into the account (it is a keyed hash, and many accounts
// share each number). It is never a key, a handle or a lookup anywhere: no route takes a seat, no board or share shows one.
import { createHmac } from 'node:crypto';
import { createTtlMemo } from '../../../data/ttl_memo.js';
import { DAILY_FIVE_SIZE, addDays, msUntilNextDay, todayDaily } from '../dailyFive.mjs';
import { DAILY_FIVE_CROWD_FLOOR, DAILY_FIVE_INTERACTION, dailySessionId } from '../dailyFiveAccount.mjs';
import { LAUNCH_WEEK, SUNDAY_TAG, isWeekKey, marksOf, sundayState, sundayWindow } from '../sundayMock.mjs';
import { SEAT_MAX, SEAT_MIN, accountTeam, dayBoard, mondayOf, sundayBoard, weekBoard } from '../daily/team.mjs';
import { parseDailyQuery } from './dailyFive.js';

const PAGE = 1000;
/** At most this many rows are read for one span (a week of a busy board is far under it). */
const MAX_ROWS = 60 * PAGE;
/** How far back a sitter's college is looked for, before their Sunday. */
const TEAM_LOOKBACK_DAYS = 120;
const LATE = JSON.stringify({ late: true });
const LETTERS = ['A', 'B', 'C', 'D'];
const iso = (ms) => new Date(ms).toISOString();
/** 12:00 am IST of a date key, as an instant. */
const istStart = (date) => Date.parse(`${date}T00:00:00+05:30`);

/** How long the board is kept per server before it is counted again (the same as how everyone did). */
export const BOARD_TTL_MS = 5 * 60 * 1000;
export const BOARD_LIMIT = Object.freeze({ route: '/api/daily/board', limit: 30, windowMs: 60 * 1000 });

/** The account's seat: 1000 to 9999, from its id and a secret. Null without either. */
export function seatOf(secret, userId) {
  if (typeof secret !== 'string' || secret.length < 16 || typeof userId !== 'string' || !userId) return null;
  const digest = createHmac('sha256', `mockmob-daily-seat-v1:${secret}`).update(userId).digest();
  return SEAT_MIN + (digest.readUInt32BE(0) % (SEAT_MAX - SEAT_MIN + 1));
}

class StoreError extends Error {
  constructor(code, cause) { super(code); this.code = code; this.cause = cause; }
}

/**
 * The reads. `db` is a function returning a Supabase client (service role). Every read of question_interactions names
 * interaction_type 'daily_five' (the table's (interaction_type, created_at) index, or the user index), so it never meets
 * another feature's rows.
 */
export function createTeamStore({ db }) {
  const qi = () => db().from('question_interactions');
  const flat = (r) => ({ user: r.user_id, date: String(r.session_id || '').slice(6), n: Number(r.n), right: r.right === true || r.right === 'true', team: typeof r.team === 'string' ? r.team : null });

  /** One account's rows from `since` (a date key): [{ session_id, metadata: { n, for } }]. */
  async function accountRows(userId, since) {
    const { data, error } = await qi().select('session_id,n:metadata->n,team:metadata->for').eq('user_id', userId).is('flow_context', null)
      .eq('interaction_type', DAILY_FIVE_INTERACTION).gte('created_at', iso(istStart(since))).order('created_at', { ascending: false }).limit(2000);
    if (error) throw new StoreError('READ_FAILED', error);
    return (data || []).map((r) => ({ session_id: r.session_id, metadata: { n: Number(r.n), for: typeof r.team === 'string' ? r.team : undefined } }));
  }

  /** Every signed-in Daily Five row checked from `fromDate` to `toDate` (IST, both whole days), flat. */
  async function spanRows(fromDate, toDate) {
    const out = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await qi().select('id,user_id,session_id,n:metadata->n,right:metadata->right,team:metadata->for')
        .eq('interaction_type', DAILY_FIVE_INTERACTION).is('flow_context', null)
        .gte('created_at', iso(istStart(fromDate))).lt('created_at', iso(istStart(addDays(toDate, 1))))
        .order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new StoreError('READ_FAILED', error);
      for (const r of data || []) out.push(flat(r));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  /** The sent Sunday papers of a week, every subject, inside its window, late papers left out: [{ user, scored, max }]. */
  async function sundaySittings(week) {
    const win = sundayWindow(week);
    const out = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await db().from('attempts').select('id,user_id,correct,wrong,total')
        .contains('selection_meta', { mobPaper: { mobId: SUNDAY_TAG, weekStart: week } }).not('selection_meta', 'cs', LATE)
        .gte('completed_at', iso(win.opensAt)).lte('completed_at', iso(win.lastFinishAt))
        .order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new StoreError('READ_FAILED', error);
      for (const r of data || []) { const m = marksOf(r); out.push({ user: r.user_id, scored: m.scored, max: m.max }); }
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  /** Each of these students' college on `date` (their latest five on or before it): Map(user -> college). */
  async function teamsOn(userIds, date) {
    const out = new Map();
    const ids = [...new Set(userIds)];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await qi().select('user_id,session_id,n:metadata->n,team:metadata->for').in('user_id', chunk).is('flow_context', null)
        .eq('interaction_type', DAILY_FIVE_INTERACTION).gte('created_at', iso(istStart(addDays(date, -TEAM_LOOKBACK_DAYS))))
        .lt('created_at', iso(istStart(addDays(date, 1)))).limit(chunk.length * 5 * 40);
      if (error) throw new StoreError('READ_FAILED', error);
      const rows = new Map();
      for (const r of data || []) {
        if (!rows.has(r.user_id)) rows.set(r.user_id, []);
        rows.get(r.user_id).push({ session_id: r.session_id, metadata: { n: Number(r.n), for: typeof r.team === 'string' ? r.team : undefined } });
      }
      for (const [user, list] of rows) { const t = accountTeam(list, date); if (t) out.set(user, t.college); }
    }
    return out;
  }

  /** A day's picks per question: Map(question id -> { of, picks: [A, B, C, D counts], correct }). */
  async function picksOn(date) {
    const out = new Map();
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await qi().select('id,question_id,pick:metadata->pick,correct:metadata->correct')
        .eq('interaction_type', DAILY_FIVE_INTERACTION).eq('session_id', dailySessionId(date))
        .gte('created_at', iso(istStart(date))).lt('created_at', iso(istStart(addDays(date, 1))))
        .order('id', { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new StoreError('READ_FAILED', error);
      for (const r of data || []) {
        const p = LETTERS.indexOf(r.pick);
        if (p < 0 || !Number.isInteger(Number(r.correct))) continue;
        const e = out.get(r.question_id) || { of: 0, picks: [0, 0, 0, 0], correct: Number(r.correct) };
        e.of += 1;
        e.picks[p] += 1;
        out.set(r.question_id, e);
      }
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  return { accountRows, spanRows, sundaySittings, teamsOn, picksOn };
}

/**
 * Yesterday's trap: the most-picked wrong answer among yesterday's five, from DAILY_FIVE_CROWD_FLOOR signed-in answers to
 * that question up, or null. `five` is yesterday's five with ids ([{ id, q, options, correct }]); a question whose numbers
 * are not about it (a changed window) is left out.
 */
export function trapOf(picks, five, date, floor = DAILY_FIVE_CROWD_FLOOR) {
  let best = null;
  (Array.isArray(five) ? five : []).forEach((q) => {
    const e = picks instanceof Map ? picks.get(q?.id) : null;
    if (!e || e.of < floor || e.correct !== q.correct) return;
    e.picks.forEach((count, i) => {
      if (i === q.correct || count <= 0) return;
      const share = count / e.of;
      if (!best || share > best.share) best = { share, q, i, of: e.of };
    });
  });
  if (!best) return null;
  return { date, q: best.q.q, letter: LETTERS[best.i], wrong: best.q.options[best.i], right: best.q.options[best.q.correct], pct: Math.round(best.share * 100), of: best.of };
}

/**
 * The board's handler. deps: {
 *   rateLimit(request, opts)   checkPersistentRateLimit
 *   store                      createTeamStore
 *   five({ day, date })        a day's five with ids (createDailyFive.five), for yesterday's trap
 *   sundayOn() -> boolean      SUNDAY_MOCK_ENABLED
 *   now() -> ms
 * }
 */
export function createBoardHandler(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const reply = (status, body, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
  const memo = createTtlMemo({ ttlMs: BOARD_TTL_MS, max: 6, now });
  // A Sunday's board does not change once its answers are open: kept longer.
  const sundayMemo = createTtlMemo({ ttlMs: 30 * 60 * 1000, max: 3, now });

  async function sundayPart(t) {
    if (deps.sundayOn && !deps.sundayOn()) return null;
    const st = sundayState(t);
    // The board of the latest Sunday whose answers are open.
    const week = st.answersOpen ? st.week : st.previous;
    if (!isWeekKey(week) || week < LAUNCH_WEEK) {
      return { state: 'first', week: LAUNCH_WEEK, at: sundayWindow(LAUNCH_WEEK).answersAt };
    }
    return sundayMemo.get(week, async () => {
      const sittings = await deps.store.sundaySittings(week);
      const teams = await deps.store.teamsOn(sittings.map((s) => s.user), week);
      const board = sundayBoard(sittings, teams);
      return { state: 'ready', week, sitters: board.sitters, counted: board.counted, colleges: board.colleges };
    });
  }

  async function trapPart(today) {
    if (today.day <= 1 || !deps.five) return null;
    const date = addDays(today.date, -1);
    const five = await Promise.resolve(deps.five({ day: today.day - 1, date })).catch(() => null);
    if (!Array.isArray(five) || five.length !== DAILY_FIVE_SIZE) return null;
    return trapOf(await deps.store.picksOn(date), five, date);
  }

  return {
    async getBoard(request) {
      const t = now();
      const query = parseDailyQuery(new URL(request.url).searchParams, t);
      if (!query.ok) return reply(400, { error: query.error, day: query.today.day, date: query.today.date });
      const limit = await Promise.resolve(deps.rateLimit(request, { ...BOARD_LIMIT, fallback: 'memory' })).catch(() => ({ allowed: false }));
      if (!limit.allowed) return reply(429, { error: 'rate_limited' }, limit?.retryAfterSeconds ? { 'Retry-After': String(Math.ceil(limit.retryAfterSeconds)) } : {});
      try {
        const body = await memo.get(query.date, async () => {
          const from = mondayOf(query.date);
          const rows = await deps.store.spanRows(from, query.date);
          const day = dayBoard(rows, query.date);
          const week = weekBoard(rows, query.date);
          const [sunday, trap] = await Promise.all([sundayPart(t).catch(() => null), trapPart(todayDaily(t)).catch(() => null)]);
          return {
            day: query.day,
            date: query.date,
            today: { players: day.players, counted: day.counted, colleges: day.colleges },
            week: { from: week.from, to: week.to, players: week.players, colleges: week.colleges },
            sunday,
            trap,
          };
        });
        const seconds = Math.max(1, Math.min(Math.floor(BOARD_TTL_MS / 1000), Math.floor(msUntilNextDay(t) / 1000)));
        return reply(200, body, { 'Cache-Control': `public, max-age=${Math.min(60, seconds)}`, 'CDN-Cache-Control': `public, s-maxage=${seconds}` });
      } catch {
        return reply(503, { error: 'unavailable' });
      }
    },
  };
}

