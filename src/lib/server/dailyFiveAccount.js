// The Daily Five on the account, server half (15 Nov 2026, lane daily). The rules and the row shape are in the pure model
// (src/lib/dailyFiveAccount.mjs); the routes are thin (src/app/api/daily/me, /stats, /mob). No 'server-only' and no alias
// imports: node:test drives the store with an in-memory database and the handlers with a fake session
// (data/tests/daily_five_account_1115.test.mjs).
//
//   GET  /api/daily/me     signed in: today's record on the account (or null) and the days played
//   POST /api/daily/me     signed in, same origin, a persistent limit: save today's finished five (first run stands)
//   GET  /api/daily/stats  public: how everyone did on today's five, per question, from 30 signed-in students up; cached
//   GET  /api/daily/mob    signed in, a member of that Mob: who played today's five, in the den's order
import { CROSS_SITE_BODY } from './sameOriginWrite.js';
import { createTtlMemo } from '../../../data/ttl_memo.js';
import { msUntilNextDay, todayDaily } from '../dailyFive.mjs';
import {
  DAILY_FIVE_INTERACTION, DAILY_FIVE_RUN_DAYS, checkItems, checkSave, crowdShare, dailySessionId, memberStrip, playedDates, questionRef,
  recordFromRows, saveRows,
} from '../dailyFiveAccount.mjs';
import { openDailyToken, parseDailyQuery } from './dailyFive.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** How long a day's numbers are kept per server before they are counted again. */
export const CROWD_TTL_MS = 5 * 60 * 1000;

export const DAILY_LIMITS = Object.freeze({
  // The save: a student finishes one five a day; retries after a dropped connection stay far under this.
  save: { route: '/api/daily/me:save', limit: 20, windowMs: 60 * 60 * 1000 },
  read: { route: '/api/daily/me:read', limit: 120, windowMs: 10 * 60 * 1000 },
  mob: { route: '/api/daily/mob', limit: 120, windowMs: 10 * 60 * 1000 },
  // Public, per network: the Daily Five's own limit (30 a minute).
  stats: { route: '/api/daily/stats', limit: 30, windowMs: 60 * 1000 },
});

class StoreError extends Error {
  constructor(code, cause) { super(code); this.code = code; this.cause = cause; }
}

/**
 * The database side. `db` is a function returning a Supabase client (service role). Every read of question_interactions
 * names interaction_type 'daily_five' and flow_context null, so it never meets another feature's rows, and uses the table's
 * indexes (user_id with the flow and type, or question_id).
 */
export function createDailyStore({ db, now = Date.now }) {
  const qi = () => db().from('question_interactions');
  const mine = (userId) => qi().select('question_id,metadata,session_id,created_at').eq('user_id', userId).is('flow_context', null).eq('interaction_type', DAILY_FIVE_INTERACTION);

  async function record(userId, date) {
    const { data, error } = await mine(userId).eq('session_id', dailySessionId(date)).limit(10);
    if (error) throw new StoreError('READ_FAILED', error);
    return recordFromRows(data || [], date);
  }

  async function played(userId) {
    const since = new Date(now() - (DAILY_FIVE_RUN_DAYS + 1) * DAY_MS).toISOString();
    const { data, error } = await qi().select('session_id').eq('user_id', userId).is('flow_context', null).eq('interaction_type', DAILY_FIVE_INTERACTION)
      .eq('metadata->>n', '1').gte('created_at', since).order('created_at', { ascending: false }).limit(DAILY_FIVE_RUN_DAYS + 5);
    if (error) throw new StoreError('READ_FAILED', error);
    return playedDates(data || []);
  }

  /** All five rows in one statement, ON CONFLICT (id) DO NOTHING; then the stored record, whichever run it was. */
  async function save(userId, { date, day, items, picks, ms }) {
    const rows = saveRows({ userId, date, day, items, picks, ms, at: new Date(now()).toISOString() });
    const { error } = await qi().upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new StoreError(error.code === '23503' ? 'QUESTION_GONE' : 'WRITE_FAILED', error);
    const stored = await record(userId, date);
    if (!stored) throw new StoreError('UNCONFIRMED');
    return stored;
  }

  /** Per question of the day: how many signed-in students saved an answer, and how many were right. Head counts only. */
  async function crowd(date, ids) {
    const count = async (id, right) => {
      let q = qi().select('id', { count: 'exact', head: true }).eq('question_id', id).eq('interaction_type', DAILY_FIVE_INTERACTION).eq('session_id', dailySessionId(date));
      if (right) q = q.eq('metadata->>right', 'true');
      const { count: n, error } = await q;
      if (error) throw new StoreError('READ_FAILED', error);
      return Number(n) || 0;
    };
    return Promise.all(ids.map(async (id) => {
      const [total, right] = await Promise.all([count(id, false), count(id, true)]);
      return { total, right };
    }));
  }

  /**
   * The Mob's strip, or null when the student is not a member of that Mob. Membership is the den's own rule (mob_state reads
   * the same table): a row in mob_members; a removed member has no row, so they are neither let in nor listed. The members
   * come in the den's order (joined_at, then user id).
   */
  async function mobStrip(userId, mobId, date) {
    const client = db();
    const me = await client.from('mob_members').select('mob_id').eq('mob_id', mobId).eq('user_id', userId).maybeSingle();
    if (me.error) throw new StoreError('READ_FAILED', me.error);
    if (!me.data) return null;
    const { data: members, error } = await client.from('mob_members').select('user_id,display_name,colour,show_score,joined_at').eq('mob_id', mobId)
      .order('joined_at', { ascending: true }).order('user_id', { ascending: true }).limit(12);
    if (error) throw new StoreError('READ_FAILED', error);
    const ids = (members || []).map((m) => m.user_id);
    if (!ids.length) return [];
    const { data: rows, error: rowsError } = await client.from('question_interactions').select('user_id,metadata').in('user_id', ids).is('flow_context', null)
      .eq('interaction_type', DAILY_FIVE_INTERACTION).eq('session_id', dailySessionId(date)).limit(ids.length * 5 + 5);
    if (rowsError) throw new StoreError('READ_FAILED', rowsError);
    return memberStrip(members, rows || [], { userId, date });
  }

  return { record, played, save, crowd, mobStrip };
}

/**
 * The four handlers. deps: {
 *   auth(request) -> session | null      the signed-in student (session.user.id)
 *   rateLimit(request, opts) -> { allowed, retryAfterSeconds? }   checkPersistentRateLimit
 *   originOk(request) -> boolean          the same-origin rule every API write follows (src/lib/server/sameOriginWrite.js)
 *   store                                 createDailyStore
 *   key                                   the token key (dailyTokenKey), or null
 *   five({ day, date }) -> [{ id, q, options, ... }] | null   today's five with ids (createDailyFive.five), for the stats
 *   mobEnabled() -> boolean               MOB_ENABLED
 *   now() -> ms
 * }
 */
export function createDailyHandlers(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const reply = (status, body, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
  const limited = (result) => reply(429, { error: 'rate_limited' }, result?.retryAfterSeconds ? { 'Retry-After': String(Math.ceil(result.retryAfterSeconds)) } : {});
  const userOf = async (request) => (await Promise.resolve(deps.auth(request)).catch(() => null))?.user?.id || null;
  const take = (request, name, userId, extra = {}) => Promise.resolve(deps.rateLimit(request, {
    ...DAILY_LIMITS[name], ...(userId ? { keyParts: [userId], identityOnly: true } : {}), fallback: 'memory', ...extra,
  })).catch(() => ({ allowed: false }));
  const crowdMemo = createTtlMemo({ ttlMs: CROWD_TTL_MS, max: 4, now });

  return {
    async getMe(request) {
      const userId = await userOf(request);
      if (!userId) return reply(401, { error: 'unauthorized' });
      const limit = await take(request, 'read', userId);
      if (!limit.allowed) return limited(limit);
      const today = todayDaily(now());
      try {
        const [record, played] = await Promise.all([deps.store.record(userId, today.date), deps.store.played(userId)]);
        return reply(200, { day: today.day, date: today.date, record, played });
      } catch {
        return reply(503, { error: 'unavailable' });
      }
    },

    async postMe(request) {
      if (!deps.originOk(request)) return reply(403, CROSS_SITE_BODY);
      const userId = await userOf(request);
      if (!userId) return reply(401, { error: 'unauthorized' });
      // Persistent: kept in the database across every server, whatever the site-wide switch says.
      const limit = await take(request, 'save', userId, { persistent: true });
      if (!limit.allowed) return limited(limit);
      const text = await request.text().catch(() => '');
      if (text.length > MAX_BODY) return reply(400, { error: 'bad_body' });
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      const checked = checkSave(body);
      if (!checked.ok) return reply(400, { error: checked.error });
      const today = todayDaily(now());
      // Only today: a five finished just before midnight and sent after it stays on the device.
      if (checked.day !== today.day || checked.date !== today.date) return reply(409, { error: 'not_today', day: today.day, date: today.date });
      if (!deps.key) return reply(503, { error: 'unavailable' });
      const items = checkItems(checked.tokens.map((t) => openDailyToken(deps.key, t)), today.date);
      if (!items.ok) return reply(400, { error: items.error });
      try {
        const record = await deps.store.save(userId, { date: today.date, day: today.day, items: items.items, picks: checked.picks, ms: checked.ms });
        const played = await deps.store.played(userId).catch(() => null);
        return reply(200, { day: today.day, date: today.date, record, ...(played ? { played } : {}) });
      } catch (error) {
        if (error?.code === 'QUESTION_GONE') return reply(409, { error: 'changed', day: today.day, date: today.date });
        return reply(503, { error: 'unavailable' });
      }
    },

    async getStats(request) {
      const query = parseDailyQuery(new URL(request.url).searchParams, now());
      if (!query.ok) return reply(400, { error: query.error, day: query.today.day, date: query.today.date });
      const limit = await take(request, 'stats', null);
      if (!limit.allowed) return limited(limit);
      try {
        const five = await deps.five(query);
        if (!five) return reply(503, { error: 'unavailable' });
        const counts = await crowdMemo.get(`${query.date}:${five.map((q) => q.id).join(',')}`, () => deps.store.crowd(query.date, five.map((q) => q.id)));
        const questions = five.map((q, i) => ({ ref: questionRef(q), pct: crowdShare(counts[i].total, counts[i].right) }));
        // The same for everyone: the CDN keeps it five minutes (never past the day's end), a browser one.
        const seconds = Math.max(1, Math.min(Math.floor(CROWD_TTL_MS / 1000), Math.floor(msUntilNextDay(now()) / 1000)));
        return reply(200, { day: query.day, date: query.date, questions }, { 'Cache-Control': `public, max-age=${Math.min(60, seconds)}`, 'CDN-Cache-Control': `public, s-maxage=${seconds}` });
      } catch {
        return reply(503, { error: 'unavailable' });
      }
    },

    async getMob(request) {
      if (!deps.mobEnabled()) return reply(404, { error: 'MOB_DISABLED' });
      const userId = await userOf(request);
      if (!userId) return reply(401, { error: 'unauthorized' });
      const limit = await take(request, 'mob', userId);
      if (!limit.allowed) return limited(limit);
      const mobId = new URL(request.url).searchParams.get('mob') || '';
      if (!UUID.test(mobId)) return reply(400, { error: 'bad_mob' });
      const today = todayDaily(now());
      try {
        const members = await deps.store.mobStrip(userId, mobId, today.date);
        if (!members) return reply(404, { error: 'NOT_IN_MOB' });
        return reply(200, { day: today.day, date: today.date, members });
      } catch {
        return reply(503, { error: 'unavailable' });
      }
    },
  };
}
