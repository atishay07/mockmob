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

/** Raw rows, newest first (completed_at desc, id asc), paged by 1000. Throws the database error. */
export async function readAttemptRows(db, userId, { columns, limit } = {}) {
  if (!userId) throw new Error('attempt_owner_required');
  const select = attemptSelect(columns);
  const max = attemptLimit(limit);
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

export const attemptMemoKey = (userId, { columns, limit } = {}) => `${userId}|${attemptSelect(columns)}|${attemptLimit(limit) ?? ''}`;
