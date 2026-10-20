// How a student's attempts are read (Database.getAttempts in data/db.js), split out so node:test can load it.
// No 'server-only' import and no alias imports: the database is passed in.
//
// An attempt row is mostly its `questions_snapshot` (93% of the bytes of the table on 16 Oct 2026: 32 KB on
// average, up to 380 KB for a long paper) and ~15 routes read every attempt of a student on every request.
// getAttempts therefore takes two options that default to the old behaviour (every column, every attempt):
//  - `columns`: the attempts columns the caller reads. Fields of the mapped attempt that were not selected get
//    the same defaults as an empty column (details [], questionsSnapshot [], selectionMeta {}, mode null).
//  - `limit`: only the newest N attempts (the order is completed_at descending, then id, a total order, so the
//    first N rows are exactly what `slice(0, N)` of the full read returned).
// and a per-request memo so two reads of the same attempts in one request cost one.
export const ATTEMPT_COLUMN_NAMES = Object.freeze(['id', 'user_id', 'subject', 'score', 'correct', 'wrong', 'unattempted', 'total', 'details', 'questions_snapshot', 'completed_at', 'selection_meta']);
const PAGE = 1000;

/** The select string for a column list; '*' when none is given. Unknown names are refused (they would reach the URL). */
export function attemptSelect(columns) {
  if (columns === undefined || columns === null) return '*';
  const list = Array.isArray(columns) ? columns : String(columns).split(',').map((c) => c.trim()).filter(Boolean);
  if (!list.length) throw new Error('attempt_columns_required');
  for (const column of list) if (!ATTEMPT_COLUMN_NAMES.includes(column)) throw new Error('attempt_column_unknown');
  return [...new Set(list)].join(',');
}

export function attemptLimit(limit) {
  if (limit === undefined || limit === null) return null;
  const n = Math.trunc(Number(limit));
  if (!Number.isFinite(n) || n < 1) throw new Error('attempt_limit_invalid');
  return n;
}

// Slim reads (egress items A1, A3, A4, A5, A6, A7; 20 Oct 2026). The attempts table ships `questions_snapshot` (93% of the bytes),
// so a caller that reads only a few fields of it asks Postgres to do the reduction:
//   slim 'summary'  public.attempts_list_summary(p_user_id)            (applied on production 19 Oct)
//   slim 'plan'     public.attempts_lean(p_user_id, 'plan')            (migration 20261020150000, written, NOT applied)
//   slim 'history'  public.attempts_lean(p_user_id, 'history')         (same migration)
//   slim 'review'   attempts_lean(p_user_id, 'review'[, p_ids]), else attempts_list_summary: the ids and chapters of each
//                   question and its stem, for Review and the repair record (A6, A7)
// They return the same twelve columns as the table, so attemptOut maps them unchanged. A function that is not there (PostgREST
// PGRST202, Postgres 42883) is skipped, the next tier is tried, and the table read is the last tier; a missing function is not
// asked again for five minutes. Any other error, a statement timeout (57014) above all, goes back to the caller: reading the whole
// heavy table when the database is already under load would make it worse. The lean rows carry answer keys ('history'): they feed
// pure builders and never go into a response body.
const lean = (profile) => ({ fn: 'attempts_lean', args: (userId, ids) => ({ p_user_id: userId, p_profile: profile, ...(ids ? { p_ids: ids } : {}) }), filterIds: false });
const listSummary = { fn: 'attempts_list_summary', args: (userId) => ({ p_user_id: userId }), filterIds: true };
export const SLIM_PROFILES = Object.freeze({
  summary: Object.freeze([listSummary]),
  plan: Object.freeze([lean('plan')]),
  history: Object.freeze([lean('history')]),
  review: Object.freeze([lean('review'), listSummary]),
});
const SLIM_RETRY_MS = 5 * 60 * 1000;
const slimMissingAt = new Map(); // function name -> when it was last found missing

/** A function that is not there (PGRST202, 42883). Nothing else is "missing". */
export function slimFunctionMissing(error) {
  return error?.code === 'PGRST202' || error?.code === '42883';
}

export function slimProfile(slim) {
  if (slim === undefined || slim === null) return null;
  if (!Object.hasOwn(SLIM_PROFILES, slim)) throw new Error('attempt_slim_unknown');
  return slim;
}

/** Test hook: forget which functions were missing. */
export function resetSlimState() { slimMissingAt.clear(); }

async function readTier(db, userId, tier, { ids, max, now }) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const size = max === null ? PAGE : Math.min(PAGE, max - rows.length);
    let q = db.rpc(tier.fn, tier.args(userId, ids));
    if (ids && tier.filterIds) q = q.in('id', ids);
    const { data, error } = await q.order('completed_at', { ascending: false }).order('id').range(offset, offset + size - 1);
    if (error) {
      if (slimFunctionMissing(error)) { slimMissingAt.set(tier.fn, now()); return null; }
      throw error;
    }
    rows.push(...(data || []));
    if (!data || data.length < size || (max !== null && rows.length >= max)) break;
  }
  return rows;
}

/**
 * The raw rows of a slim read (newest first), or null when no function of the profile is there: the caller then reads the table.
 * `ids` limits the read to those attempts of the student; `limit` is the newest N. Throws every error that is not "missing".
 */
export async function readSlimRows(db, userId, slim, { ids, limit, now = Date.now } = {}) {
  if (!userId) throw new Error('attempt_owner_required');
  if (!slimProfile(slim) || typeof db.rpc !== 'function') return null;
  const max = attemptLimit(limit);
  if (ids && !ids.length) return [];
  for (const tier of SLIM_PROFILES[slim]) {
    const missedAt = slimMissingAt.get(tier.fn);
    if (missedAt !== undefined && now() - missedAt < SLIM_RETRY_MS) continue;
    const rows = await readTier(db, userId, tier, { ids, max, now });
    if (rows) return rows;
  }
  return null;
}

/** Raw rows, newest first (completed_at desc, id asc), paged by 1000. Throws the database error. */
export async function readAttemptRows(db, userId, { columns, limit, slim, now = Date.now } = {}) {
  if (!userId) throw new Error('attempt_owner_required');
  const select = attemptSelect(columns);
  const max = attemptLimit(limit);
  const viaFunction = await readSlimRows(db, userId, slim, { limit, now });
  if (viaFunction) return viaFunction;
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const size = max === null ? PAGE : Math.min(PAGE, max - rows.length);
    const { data, error } = await db.from('attempts').select(select).eq('user_id', userId)
      .order('completed_at', { ascending: false }).order('id').range(offset, offset + size - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < size || (max !== null && rows.length >= max)) break;
  }
  return rows;
}

/**
 * A per-request memo: pass the same Map to every read of one request. The first read stores a pristine copy and
 * every later read gets its own copy, so one consumer mutating its attempts never changes another's. The memo
 * holds the promise, so two reads started together (Promise.all) still cost one.
 */
export function memoisedAttempts(memo, key, load) {
  if (!(memo instanceof Map)) return load();
  if (!memo.has(key)) {
    const first = load();
    const stored = first.then((value) => structuredClone(value));
    stored.catch(() => memo.delete(key)); // a failed read is not remembered; this also marks the copy's rejection handled
    memo.set(key, stored);
    return first;
  }
  return memo.get(key).then((value) => structuredClone(value));
}

// A slim read never shares a memo entry with a full one (or with another profile): their rows differ.
export const attemptMemoKey = (userId, { columns, limit, slim } = {}) => `${userId}|${attemptSelect(columns)}|${attemptLimit(limit) ?? ''}${slimProfile(slim) ? `|slim:${slim}` : ''}`;
