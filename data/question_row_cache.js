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
// one caller mutating a row never changes another's. The cache is bounded by BYTES (a managed row is 35 KB and a legacy one 2 KB, so a
// row count says nothing about memory or about what fits: 20 MB), by a row count that only guards against a flood of tiny rows, and by
// TTL; the least recently used rows go first. The default cache of a database client is the client's own (a WeakMap), so test fakes
// never share rows and production, which has one client, shares them. A long walk down one student's history does NOT go through this
// cache (the Recovery record keeps small verdicts instead: data/evidence_verdicts.js), so it cannot evict the window of managed rows
// that practice and Mob starts share.
export const QUESTION_ROW_CACHE_MAX_BYTES = 20 * 1024 * 1024;
export const QUESTION_ROW_CACHE_MAX = 1500;
export const QUESTION_ROW_CACHE_TTL_MS = 60 * 60 * 1000;
const STAMP_CHUNK = 200;
// Rows are PostgREST JSON, so the stored text is an exact copy (and, unlike structuredClone, copes with a proxied test row).

export function createQuestionRowCache({ now = Date.now, max = QUESTION_ROW_CACHE_MAX, maxBytes = QUESTION_ROW_CACHE_MAX_BYTES, ttlMs = QUESTION_ROW_CACHE_TTL_MS } = {}) {
  const map = new Map(); // key -> { stamp, json, size, at }; the rows are kept as JSON text, which is also how their size is known
  let bytes = 0;
  const drop = (key) => { const entry = map.get(key); if (entry) { bytes -= entry.size; map.delete(key); } };
  return {
    /** The cached row when its stamp equals `stamp` and it is not too old; otherwise null (and the entry is dropped). */
    get(key, stamp) {
      const entry = map.get(key);
      if (!entry) return null;
      if (now() - entry.at >= ttlMs || entry.stamp !== stamp) { drop(key); return null; }
      map.delete(key); map.set(key, entry); // most recently used last
      return JSON.parse(entry.json);
    },
    set(key, stamp, row) {
      drop(key);
      const json = JSON.stringify(row);
      if (json.length > maxBytes) return; // a row bigger than the whole budget is never kept
      map.set(key, { stamp, json, size: json.length, at: now() });
      bytes += json.length;
      while ((map.size > max || bytes > maxBytes) && map.size) drop(map.keys().next().value);
    },
    clear() { map.clear(); bytes = 0; },
    get size() { return map.size; },
    get bytes() { return bytes; },
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
      if (hit) have.set(id, hit); else misses.push(id); // a hit is already this caller's own copy (parsed from the stored text)
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
