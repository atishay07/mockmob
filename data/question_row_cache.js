// Raw question rows, read once and kept while they are exactly what the database holds (egress item F4, 20 Oct 2026).
// No 'server-only' and no alias imports: the database is passed in, so node:test can load it.
//
// A full `questions` row of an evidence-managed subject carries a 35 KB signed record, and the same rows are read again and
// again: the newest-N window of managed rows on every practice, full-mock and Mob start is the SAME rows for every student, a
// repair check reads the same candidate on open and on submit, the Saved list and the Recovery record read every row they list.
// This cache holds the RAW rows, never a verdict. Every verdict (evidence expiry through Date.now(), family holds, calibration,
// disputes) is still computed fresh from the row on every call, so a verdict from a cached row equals one from a fresh read.
//
// A hit needs the row's `updated_at` to equal the one a small stamp query just read from the database (id and updated_at, about 70
// bytes a row). Every UPDATE bumps updated_at (trigger trg_questions_updated_at, BEFORE UPDATE FOR EACH ROW) and an INSERT carries
// now(), so an equal stamp means an equal row. A row with no stamp is never stored. Callers get their own copy (structuredClone), so
// one caller mutating a row never changes another's. The cache is bounded (MAX rows, least recently used out; TTL), and the
// default cache of a database client is the client's own (a WeakMap), so test fakes never share rows and production, which has
// one client, shares them.
export const QUESTION_ROW_CACHE_MAX = 300;
export const QUESTION_ROW_CACHE_TTL_MS = 60 * 60 * 1000;
const STAMP_CHUNK = 200;
// Rows are PostgREST JSON, so a JSON round trip is an exact copy (and, unlike structuredClone, copes with a proxied test row).
const clone = (value) => JSON.parse(JSON.stringify(value));

export function createQuestionRowCache({ now = Date.now, max = QUESTION_ROW_CACHE_MAX, ttlMs = QUESTION_ROW_CACHE_TTL_MS } = {}) {
  const map = new Map(); // key -> { stamp, row, at }
  return {
    /** The cached row when its stamp equals `stamp` and it is not too old; otherwise null (and the entry is dropped). */
    get(key, stamp) {
      const entry = map.get(key);
      if (!entry) return null;
      if (now() - entry.at >= ttlMs || entry.stamp !== stamp) { map.delete(key); return null; }
      map.delete(key); map.set(key, entry); // most recently used last
      return entry.row;
    },
    set(key, stamp, row) {
      map.delete(key);
      map.set(key, { stamp, row: clone(row), at: now() });
      while (map.size > max) map.delete(map.keys().next().value);
    },
    clear() { map.clear(); },
    get size() { return map.size; },
  };
}

const perClient = new WeakMap();
/** The cache of one database client (created on first use). */
export function questionRowCacheFor(db) {
  if (db === null || (typeof db !== 'object' && typeof db !== 'function')) return createQuestionRowCache();
  let cache = perClient.get(db);
  if (!cache) { cache = createQuestionRowCache(); perClient.set(db, cache); }
  return cache;
}

/**
 * The rows of these question ids, like `db.from('questions').select(select).in('id', ids)` but reading only the rows that changed.
 * Resolves to { data, error } exactly like the query it replaces (rows in the stamp query's order; an id the database does not
 * return is absent). `name` keeps different column lists apart ('full' for select('*')).
 */
export async function readRowsCached(db, ids, { select = '*', name = 'full', cache = questionRowCacheFor(db), chunk = STAMP_CHUNK } = {}) {
  const unique = [...new Set(ids)];
  const data = [];
  for (let i = 0; i < unique.length; i += chunk) {
    const part = unique.slice(i, i + chunk);
    const stamp = await db.from('questions').select('id,updated_at').in('id', part);
    if (stamp.error) return { data: null, error: stamp.error };
    const stamps = new Map((stamp.data || []).map((row) => [row.id, row.updated_at ?? null]));
    const have = new Map();
    const misses = [];
    for (const [id, at] of stamps) {
      const hit = at ? cache.get(`${name}:${id}`, at) : null;
      if (hit) have.set(id, clone(hit)); else misses.push(id);
    }
    const read = new Map();
    if (misses.length) {
      const res = await db.from('questions').select(select).in('id', misses);
      if (res.error) return { data: null, error: res.error };
      for (const row of res.data || []) {
        read.set(row.id, row);
        const at = stamps.get(row.id);
        if (at) cache.set(`${name}:${row.id}`, at, row);
      }
    }
    for (const id of stamps.keys()) {
      if (have.has(id)) data.push(have.get(id));
      else if (read.has(id)) data.push(read.get(id));
    }
  }
  return { data, error: null };
}
