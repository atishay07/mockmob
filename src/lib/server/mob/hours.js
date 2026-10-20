import { MobError } from '../../mob/model.mjs';
import { createMissingMemo } from './missing.js';

// Mob hours (D173 item 1, D174; MOB-V4-BUILD.md item 2): the den's "study time together" block. No 'server-only' and no '@/'
// imports, so node:test drives it (data/tests/mob_hours_1020.test.mjs). The numbers come from the database
// (public.mob_hours_head and public.mob_hours_rows, migration 20261020151000_mob_hours; mob_hours is the same in one call) that
// already hold only members who SHARE their study time and have at least a minute this week; this file only names them, shapes the
// payload and caches the heavy read for a minute. User ids never leave the server: members are
// addressed by memberId.
//
// The contract (docs/brain/APP-API-CONTRACT.md, "Mob hours"), the optional `hours` object on the den's `v3` block:
//   hours: { week_start, target_minutes, total_minutes, me_sharing, members: [{ member_id, first_name, minutes, goal_days }],
//            top_member_id, studying_now: [{ member_id, first_name, since }] }
// Absent when the database has not shipped it (migration missing, any read failure): the app then hides every hours element.
// A Mob where nobody shares still gets `hours` (target 0, total 0, members []) so the app can offer the switch.
export const HOURS_TARGET_PER_MEMBER = 150; // minutes a week for each member who shares
export const HOURS_CACHE_MS = 60_000; // the heavy part of the read is shared per Mob and week for this long
export const HOURS_CAP_SECONDS = 180; // one answered question counts at most 3 minutes (the database applies it)

const HEAD_FN = 'mob_hours_head';
const ROWS_FN = 'mob_hours_rows';
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const whole = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);

/**
 * raw: what public.mob_hours returns (here assembled from the head and the rows) { week_start, sharing, me_sharing, rows: [{ user_id, minutes, goal_days }],
 *      studying: [{ user_id, since }] }, or null (the caller is not in the Mob).
 * members: Map user id -> { memberId, name } (the Mob's current members); only these can appear.
 * Returns the `hours` object, or null when there is nothing true to say.
 */
export function hoursView(raw, members) {
  if (!raw || typeof raw !== 'object' || !(members instanceof Map)) return null;
  const week = String(raw.week_start || '').slice(0, 10);
  if (!WEEK_RE.test(week)) return null;
  const named = (userId) => members.get(userId) || null;
  const rows = (Array.isArray(raw.rows) ? raw.rows : [])
    .map((r) => ({ m: named(r?.user_id), minutes: whole(r?.minutes), goalDays: Math.min(7, whole(r?.goal_days)) }))
    // Never a member with 0 minutes, never one the Mob no longer has.
    .filter((r) => r.m && r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const list = rows.map((r) => ({ member_id: r.m.memberId, first_name: r.m.name, minutes: r.minutes, goal_days: r.goalDays }));
  // One crown, never a rank below it: nobody is crowned for a week with one sharer or a tie at the top.
  const top = rows.length >= 2 && rows[0].minutes > rows[1].minutes ? rows[0].m.memberId : null;
  const studying = [];
  for (const s of Array.isArray(raw.studying) ? raw.studying : []) {
    const m = named(s?.user_id);
    const at = Date.parse(s?.since);
    if (m && Number.isFinite(at)) studying.push({ member_id: m.memberId, first_name: m.name, since: new Date(at).toISOString() });
  }
  return {
    week_start: week,
    target_minutes: HOURS_TARGET_PER_MEMBER * whole(raw.sharing),
    total_minutes: list.reduce((n, r) => n + r.minutes, 0),
    me_sharing: raw.me_sharing === true,
    members: list,
    top_member_id: top,
    studying_now: studying,
  };
}

/**
 * Reads the den's hours with the heavy part cached. Two RPCs: `mob_hours_head` (cheap, every call: is the caller in the Mob, their own
 * switch, who shares) and `mob_hours_rows` (the week's aggregate over every sharing member's attempts, so it is the one that costs).
 * The rows are the same for every viewer of a Mob, so they are kept in this process for `ttlMs` (default 60 s) under the key
 * Mob + week + the set of sharers: a member switching sharing on or off changes the set and so the key, on every server instance at
 * once, with nothing to invalidate; "studying now" and the minutes lag by at most one TTL, which a calm weekly figure can bear.
 * A request already running for a key is shared by the callers that arrive meanwhile. ttlMs 0 turns the cache off.
 * `now` is the service clock (ms).
 */
export function createHoursReader({ ttlMs = HOURS_CACHE_MS, now = Date.now, max = 200 } = {}) {
  const cache = new Map(); // key -> { at, promise }
  const missingFns = createMissingMemo({ now }); // a function whose migration is not applied is asked again only after five minutes
  const remember = (key, promise) => {
    if (cache.size >= max) {
      const t = now();
      for (const [k, v] of cache) if (t - v.at >= ttlMs) cache.delete(k);
      while (cache.size >= max) cache.delete(cache.keys().next().value); // oldest first (Map keeps insertion order)
    }
    cache.set(key, { at: now(), promise });
    promise.catch(() => { if (cache.get(key)?.promise === promise) cache.delete(key); });
  };
  /**
   * The den's hours or null. `read` is the service's one-call helper. A missing function (the migration is not applied) means "not
   * shipped": null and nothing logged, and the function is not asked for again for five minutes (a den read would otherwise make two
   * calls that always fail). Any other failure (a timeout, a cast error, a renamed column) also gives null so the den
   * goes on without hours, but it is logged first, with a code and no user or Mob id, so it shows in the function logs.
   */
  async function readHours(read, { userId, mobId, week, nowIso, members }) {
    if (missingFns.skip(HEAD_FN) || missingFns.skip(ROWS_FN)) return null;
    // One call, one name: a MIGRATION answer is remembered against the function that gave it.
    const ask = async (name, params) => {
      try { return await read(name, params); } catch (e) {
        if (e instanceof MobError && e.code === 'MIGRATION') missingFns.miss(name);
        throw e;
      }
    };
    try {
      const head = await ask(HEAD_FN, { p_user_id: userId, p_mob_id: mobId });
      if (!head || typeof head !== 'object') return null;
      const sharers = (Array.isArray(head.sharers) ? head.sharers : []).map(String).sort();
      const key = `${mobId}|${week}|${sharers.join(',')}`;
      let hit = ttlMs > 0 ? cache.get(key) : null;
      if (hit && now() - hit.at >= ttlMs) { cache.delete(key); hit = null; }
      if (!hit) {
        const promise = Promise.resolve(ask(ROWS_FN, { p_mob_id: mobId, p_week: week, p_now: nowIso }));
        hit = { promise };
        if (ttlMs > 0) remember(key, promise);
      }
      const rows = await hit.promise;
      return hoursView({ week_start: week, sharing: sharers.length, me_sharing: head.me_sharing, rows: rows?.rows, studying: rows?.studying }, members);
    } catch (e) {
      if (!(e instanceof MobError && e.code === 'MIGRATION')) {
        // The codes only (a MobError code, then the database's own, e.g. UNAVAILABLE/57014 for a timeout): never a message, which can quote data.
        console.warn('mob_hours_failed', [e?.code, e?.extra?.cause?.code].filter((c) => typeof c === 'string').join('/') || 'error');
      }
      return null;
    }
  }
  return { readHours, size: () => cache.size };
}

/** One read with no cache (dry runs and tests). */
export const readHours = (read, args) => createHoursReader({ ttlMs: 0 }).readHours(read, args);
