// The Daily Five on the account, server half (15 Nov 2026, lane daily). The rules and the row shape are in the pure model
// (src/lib/dailyFiveAccount.mjs); the routes are thin (src/app/api/daily/check, /me, /stats, /mob). No 'server-only' and no
// alias imports: node:test drives the store with an in-memory database and the handlers with a fake session
// (data/tests/daily_five_account_1115.test.mjs).
//
//   POST /api/daily/check  anyone, same origin, a limit: { token, pick } -> right or wrong, the right option and the reason.
//                          Signed in, the FIRST check of each question is recorded and stands (a retry or another tab gets
//                          it back). The account's five is built from those first checks alone: no route writes a pick.
//   GET  /api/daily/me     signed in: today's record on the account (or null), its review once all five are in, the days
//   GET  /api/daily/stats  public: how everyone did on today's five, per question, from 30 signed-in students up; cached
//   GET  /api/daily/mob    signed in, a member of that Mob: who played today's five, in the den's order
import { CROSS_SITE_BODY } from './sameOriginWrite.js';
import { createTtlMemo } from '../../../data/ttl_memo.js';
import { msUntilNextDay, todayDaily } from '../dailyFive.mjs';
import {
  DAILY_FIVE_INTERACTION, DAILY_FIVE_RUN_DAYS, checkAnswer, checkOpened, checkRequest, checkRow, crowdShare, dailyRowId, dailySessionId,
  memberStrip, playedDates, questionRef, recordFromRows, reviewFrom,
} from '../dailyFiveAccount.mjs';
import { openDailyToken, parseDailyQuery } from './dailyFive.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BODY = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** How long a day's numbers are kept per server before they are counted again. */
export const CROWD_TTL_MS = 5 * 60 * 1000;

export const DAILY_LIMITS = Object.freeze({
  // A check per answer: five a day, retries after a dropped connection, a reload's re-checks, a second tab. Far under these.
  checkUser: { route: '/api/daily/check:user', limit: 120, windowMs: 60 * 60 * 1000 },
  // Guests, per network address: Indian mobile data puts thousands of phones behind one carrier address, so this is set for
  // a crowd, not a person. A guest check reads no database (the key is in the sealed token), so a high ceiling costs little.
  checkNet: { route: '/api/daily/check:net', limit: 600, windowMs: 10 * 60 * 1000 },
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

  async function rows(userId, date) {
    const { data, error } = await qi().select('question_id,metadata,created_at').eq('user_id', userId).is('flow_context', null)
      .eq('interaction_type', DAILY_FIVE_INTERACTION).eq('session_id', dailySessionId(date)).limit(10);
    if (error) throw new StoreError('READ_FAILED', error);
    return data || [];
  }

  async function record(userId, date) {
    return recordFromRows(await rows(userId, date), date);
  }

  /** The days with a whole five (all five places checked), from the account. */
  async function played(userId) {
    const since = new Date(now() - (DAILY_FIVE_RUN_DAYS + 1) * DAY_MS).toISOString();
    const { data, error } = await qi().select('session_id,metadata').eq('user_id', userId).is('flow_context', null).eq('interaction_type', DAILY_FIVE_INTERACTION)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(DAILY_FIVE_RUN_DAYS * 5 + 10);
    if (error) throw new StoreError('READ_FAILED', error);
    return playedDates(data || []);
  }

  /**
   * One checked answer, INSERT ... ON CONFLICT (id) DO NOTHING; then the row that stands for that place, whichever check
   * wrote it. Answers { n, pick, right, correct, sameQuestion } from the stored row.
   */
  async function recordCheck(userId, { date, day, item, pick, ms }) {
    const row = checkRow({ userId, date, day, n: item.n, id: item.id, pick, correct: item.correct, ms, at: new Date(now()).toISOString() });
    const { error } = await qi().upsert([row], { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new StoreError(error.code === '23503' ? 'QUESTION_GONE' : 'WRITE_FAILED', error);
    const { data, error: readError } = await qi().select('question_id,metadata').eq('id', dailyRowId(date, userId, item.n)).eq('interaction_type', DAILY_FIVE_INTERACTION).limit(1);
    if (readError) throw new StoreError('READ_FAILED', readError);
    const stored = (data || [])[0];
    const answer = stored ? checkAnswer(stored) : null;
    if (!answer) throw new StoreError('UNCONFIRMED');
    return { ...answer, sameQuestion: stored.question_id === item.id };
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
    const { data: found, error: rowsError } = await client.from('question_interactions').select('user_id,metadata').in('user_id', ids).is('flow_context', null)
      .eq('interaction_type', DAILY_FIVE_INTERACTION).eq('session_id', dailySessionId(date)).limit(ids.length * 5 + 5);
    if (rowsError) throw new StoreError('READ_FAILED', rowsError);
    return memberStrip(members, found || [], { userId, date });
  }

  return { rows, record, played, recordCheck, crowd, mobStrip };
}

/**
 * The four handlers. deps: {
 *   auth(request) -> session | null      the signed-in student (session.user.id); none for a guest
 *   rateLimit(request, opts) -> { allowed, retryAfterSeconds? }   checkPersistentRateLimit
 *   originOk(request) -> boolean          the same-origin rule every API write follows (src/lib/server/sameOriginWrite.js)
 *   store                                 createDailyStore
 *   key                                   the token key (dailyTokenKey), or null
 *   five({ day, date }) -> [{ id, q, options, correct, why, ... }] | null   today's five with ids (createDailyFive.five)
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
    async postCheck(request) {
      if (!deps.originOk(request)) return reply(403, CROSS_SITE_BODY);
      // A sign-in lookup that failed for a moment (Supabase unreachable) must not make a signed-in student a guest: the
      // answer would arrive unrecorded and the account would miss that day's five. 503, and the page asks again.
      const status = deps.authStatus ? await Promise.resolve(deps.authStatus(request)).catch(() => ({ session: null, transient: true })) : null;
      if (status?.transient) return reply(503, { error: 'unavailable' });
      const userId = status ? (status.session?.user?.id || null) : await userOf(request);
      // Signed in: per student, kept in the database across every server. A guest: per network.
      const limit = userId ? await take(request, 'checkUser', userId, { persistent: true }) : await take(request, 'checkNet', null);
      if (!limit.allowed) return limited(limit);
      const text = await request.text().catch(() => '');
      if (text.length > MAX_BODY) return reply(400, { error: 'bad_body' });
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }
      const asked = checkRequest(body);
      if (!asked.ok) return reply(400, { error: asked.error });
      if (!deps.key) return reply(503, { error: 'unavailable' });
      const today = todayDaily(now());
      const opened = checkOpened(openDailyToken(deps.key, asked.token), today.date);
      // A question of another day (the page was left open past 12:00 am IST) is answered nowhere: the page loads today's.
      if (!opened.ok) return reply(opened.error === 'not_today' ? 409 : 400, { error: opened.error, day: today.day, date: today.date });
      const { item } = opened;
      if (!userId) {
        return reply(200, { n: item.n, pick: asked.pick, right: asked.pick === item.correct, correct: item.correct, why: item.why, recorded: false });
      }
      try {
        // Recorded before it is answered: the key never reaches a signed-in student whose first pick is not on the account.
        const stood = await deps.store.recordCheck(userId, { date: today.date, day: today.day, item, pick: asked.pick, ms: asked.ms });
        return reply(200, { n: item.n, pick: stood.pick, right: stood.right, correct: stood.correct, why: stood.sameQuestion ? item.why : '', recorded: true });
      } catch (error) {
        if (error?.code === 'QUESTION_GONE') return reply(409, { error: 'changed', day: today.day, date: today.date });
        return reply(503, { error: 'unavailable' });
      }
    },

    async getMe(request) {
      const userId = await userOf(request);
      if (!userId) return reply(401, { error: 'unauthorized' });
      const limit = await take(request, 'read', userId);
      if (!limit.allowed) return limited(limit);
      const today = todayDaily(now());
      try {
        const [found, played] = await Promise.all([deps.store.rows(userId, today.date), deps.store.played(userId)]);
        const record = recordFromRows(found, today.date);
        // The keys and reasons only with a whole five: the student has answered every question already.
        const review = record ? reviewFrom(found, await Promise.resolve(deps.five(today)).catch(() => null)) : null;
        return reply(200, { day: today.day, date: today.date, record, review, played });
      } catch {
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
