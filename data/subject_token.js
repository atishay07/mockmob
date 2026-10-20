// A cheap, exact "has this subject changed since I read it" check (egress items F3, F10, F11, F13; 20 Oct 2026). No 'server-only'
// and no alias imports: the database is passed in, so node:test can load it.
//
// Two head counts (no body) on the questions of one subject:
//   count    every row of the subject (inserts and hard deletes change it)
//   touched  rows inserted or updated since `readAtMs` minus a margin. Every UPDATE bumps questions.updated_at (trigger
//            trg_questions_updated_at, BEFORE UPDATE FOR EACH ROW, migration 0005) and an INSERT carries now() (the column is NOT NULL
//            DEFAULT now()), so a row's content, status or score cannot change without `touched` seeing it. The margin covers a
//            transaction that committed late (now() is its start time) and the clock difference between Vercel and Postgres.
// A cache entry read at T with count C is still exact while touched === 0 and count === C. Any error is thrown: the caller reads
// again, which is what it did before this check existed.
export const TOUCH_MARGIN_MS = 15 * 60 * 1000;

async function headCount(query) {
  const { count, error } = await query;
  if (error || !Number.isInteger(count)) throw new Error('SUBJECT_TOKEN_UNAVAILABLE');
  return count;
}

const head = (db, subject) => db.from('questions').select('id', { count: 'exact', head: true }).eq('subject', subject);

/** Just the row count of the subject (taken before a read, so what arrives during the read is seen next time). */
export const subjectCount = (db, subject) => headCount(head(db, subject));

export async function subjectToken(db, subject, readAtMs) {
  const [count, touched] = await Promise.all([
    subjectCount(db, subject),
    headCount(head(db, subject).gte('updated_at', new Date(readAtMs - TOUCH_MARGIN_MS).toISOString())),
  ]);
  return { count, touched };
}

/** True when an entry read at `readAt` with `count` rows is still exact: nothing was written and no row came or went. */
export const tokenUnchanged = (token, entry) => token.touched === 0 && token.count === entry.count;

/**
 * A bounded memo of something read for one subject, revalidated with the subject token (egress F10, F11). Per `key`:
 *  - younger than `ttlMs`: reused as is (the same freshness bound as the reads it replaces);
 *  - older, but younger than `maxAgeMs` and the token (and the optional `unchanged` check) says nothing changed: reused, and the
 *    bound starts again;
 *  - anything else, an error in the check included: `read()` runs again.
 * `capture(db)` runs BEFORE `read()` and its result is kept with the entry for `unchanged(db, entry)` (a holds token, an expiry);
 * a failing capture stores the entry as not revalidatable. `copy` makes each caller's value its own. The memo never holds per-user
 * data: callers key it by what was asked (a subject and a chapter), nothing else.
 */
export function createSubjectMemo({ ttlMs = 5 * 60 * 1000, maxAgeMs = 24 * 60 * 60 * 1000, max = 12, now = Date.now, copy = (v) => JSON.parse(JSON.stringify(v)) } = {}) {
  const entries = new Map();
  return {
    async get(db, key, subject, read, { capture = null, unchanged = null } = {}) {
      const at = now();
      const hit = entries.get(key);
      if (hit && at - hit.checkedAt < ttlMs) return copy(hit.value);
      if (hit && hit.count !== null && at - hit.readAt < maxAgeMs) {
        try {
          if (tokenUnchanged(await subjectToken(db, subject, hit.readAt), hit) && (!unchanged || await unchanged(db, hit, at))) { hit.checkedAt = now(); return copy(hit.value); }
        } catch { /* read it again */ }
      }
      const readAt = now();
      let count = null;
      let meta = null;
      try { count = await subjectCount(db, subject); meta = capture ? await capture(db) : null; } catch { count = null; }
      const value = await read();
      entries.delete(key);
      entries.set(key, { value: copy(value), checkedAt: now(), readAt, count, meta });
      while (entries.size > max) entries.delete(entries.keys().next().value);
      return value;
    },
    forget(key) { if (key === undefined) entries.clear(); else entries.delete(key); },
    get size() { return entries.size; },
  };
}

const perClient = new WeakMap();
/** One memo per database client: production has one client, so its memo is shared; a test fake gets its own. */
export function subjectMemoFor(db, name, options) {
  if (db === null || (typeof db !== 'object' && typeof db !== 'function')) return createSubjectMemo(options);
  let byName = perClient.get(db);
  if (!byName) { byName = new Map(); perClient.set(db, byName); }
  if (!byName.has(name)) byName.set(name, createSubjectMemo(options));
  return byName.get(name);
}
