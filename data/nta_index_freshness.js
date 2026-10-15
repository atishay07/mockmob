// Is a subject's nta_question_index older than its newest live question? Cheap: small selects, no
// evidence column. Used by the pool read (data/nta_pool.js: a stale index falls back to the full read, so a
// question published after the last build is never dropped from NTA papers) and by the daily rebuild
// (data/nta_index.js). A question counts as newer when its created_at or live_at is later than the
// index's newest verified_at (builds stamp verified_at at or after the newest live question they read).
// No 'server-only' import, so node:test and the scripts can load it.

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const MISSING_COLUMN = '42703';

function newest(rows, column) {
  let best = null;
  for (const row of rows || []) {
    const at = Date.parse(row?.[column]);
    if (Number.isFinite(at) && (best === null || at > best)) best = at;
  }
  return best;
}

function withSignal(query, signal) {
  return signal && typeof query.abortSignal === 'function' ? query.abortSignal(signal) : query;
}

/** Newest created_at or live_at (ms) among the subject's live, undeleted questions; null when there are none. */
export async function newestLiveQuestionAt(db, subject, { signal } = {}) {
  let best = null;
  for (const column of ['created_at', 'live_at']) {
    const { data, error } = await withSignal(db.from('questions')
      .select(column)
      .eq('subject', subject)
      .eq('status', 'live')
      .eq('is_deleted', false)
      .order(column, { ascending: false, nullsFirst: false })
      .limit(1), signal);
    if (error) {
      // An older schema without live_at: created_at alone decides.
      if (error.code === MISSING_COLUMN && column !== 'created_at') continue;
      throw error;
    }
    const at = newest(data, column);
    if (at !== null && (best === null || at > best)) best = at;
  }
  return best;
}

/** Newest verified_at (ms) of a subject's index rows; null for no rows. tableMissing is true when the table is not there. */
export async function ntaIndexBuiltAt(db, subject, { signal } = {}) {
  const { data, error } = await withSignal(db.from('nta_question_index')
    .select('verified_at')
    .eq('subject', subject)
    .order('verified_at', { ascending: false })
    .limit(1), signal);
  if (error) {
    if (MISSING_TABLE.has(error.code)) return { builtAt: null, tableMissing: true };
    throw error;
  }
  return { builtAt: newest(data, 'verified_at'), tableMissing: false };
}

const iso = (ms) => (ms === null ? null : new Date(ms).toISOString());

/**
 * Compares an index built at `builtAtMs` with the subject's newest live question.
 * Returns { stale, builtAt, newestAt } (ISO strings). A subject with no index rows is not "stale": it has no
 * index to go out of date (the pool reads it in full, the daily rebuild leaves it to the first manual build).
 */
export async function ntaIndexFreshness(db, subject, builtAtMs, { signal } = {}) {
  if (builtAtMs === null || builtAtMs === undefined) return { stale: false, builtAt: null, newestAt: null };
  const newestAt = await newestLiveQuestionAt(db, subject, { signal });
  return { stale: newestAt !== null && newestAt > builtAtMs, builtAt: iso(builtAtMs), newestAt: iso(newestAt) };
}

/** Latest verified_at (ms) of index rows already in hand. */
export const builtAtOfRows = (rows) => newest(rows, 'verified_at');
