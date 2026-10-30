// The database side of a practice or full-mock start (data/db.js getQuestions): the queries the slim read
// (data/practice_pick.js) is built on, with their per-server pool cache. Lifted out of db.js, unchanged, so a
// test can run the real queries against an in-memory database and count the bytes of every read
// (data/tests/practice_source.test.mjs). No 'server-only' import, so node:test can load it.
import { readablePracticeQuestions } from './practice_library.js';
import { PRACTICE_LIGHT_SELECT, PRACTICE_POOL_CACHE_MS } from './practice_pick.js';
import { subjectCount, subjectToken, tokenUnchanged } from './subject_token.js';
import { readRowsCached } from './question_row_cache.js';

export const VISIBLE_QUESTION_FILTER = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';

export function isMissingPhase1VoteSchema(error) {
  return error?.code === '42703' ||
    error?.code === '42P01' ||
    /question_votes|score|upvotes|downvotes|schema cache|column .* does not exist/i.test(error?.message || '');
}

// Light subject pools for the slim session-start read, kept PRACTICE_POOL_CACHE_MS per server. A test passes its own.
export const PRACTICE_CACHES = { pools: new Map() };
// A pool is about 2 MB for the largest subject and a long-lived server keeps one per [subject, chapters, difficulty]: twelve bound it.
const MAX_CACHED_POOLS = 12;
// A pool older than this is read again whatever the check says.
export const POOL_REVALIDATE_MAX_MS = 24 * 60 * 60 * 1000;

/**
 * The `source` object selectPracticeQuestions works with. `hooks` are the per-student reads that stay in
 * data/db.js: attachPassages, recentIds, userProgress, weakConcepts.
 */
export function createPracticeSource({ db, subjectId, mode, opts = {}, targetCount, hooks, caches = PRACTICE_CACHES, clock = () => Date.now() }) {
  // Slim read (data/practice_pick.js): rank on the subject without its evidence records, then read
  // full rows only for the questions that decide the picks. The full read is the fallback, and the
  // behaviour PRACTICE_SLIM_READ=off keeps. Picks are identical either way (tests/practice_pick_parity).
  const poolSize = Math.max(60, targetCount * 6);
  const buildQuery = (columns, withScore, offset = null) => {
    let query = db
      .from('questions')
      .select(columns)
      .eq('subject', subjectId)
      .eq('is_deleted', false)
      .or(VISIBLE_QUESTION_FILTER);
    if (Array.isArray(opts.chapters) && opts.chapters.length > 0) query = query.in('chapter', opts.chapters);
    else if (opts.chapter) query = query.eq('chapter', opts.chapter);
    if (mode.allowDifficultyOverride && ['easy', 'medium', 'hard'].includes(opts.difficulty)) {
      query = query.eq('difficulty', opts.difficulty);
    }
    if (withScore) {
      query = query.gte('score', -2);
    }
    query = query.order('created_at', { ascending: false }).order('score', { ascending: false }).order('id');
    return offset === null ? query.limit(poolSize) : query.range(offset, offset + 999);
  };
  // Evidence precedence and freshness need the whole filtered subject pool;
  // a recent sample can hide older, fully verified inventory.
  const readPool = async (columns) => {
    const pool = [];
    for (let offset = 0; ; offset += 1000) {
      let { data, error } = await buildQuery(columns, true, offset);
      if (error && isMissingPhase1VoteSchema(error)) ({ data, error } = await buildQuery(columns, false, offset));
      if (error) throw error;
      pool.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return pool;
  };
  const readManagedIds = async () => {
    const ids = new Set();
    for (const column of ['evidence', 'provenance']) {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.from('questions').select('id').eq('subject', subjectId).eq('is_deleted', false)
          .not(column, 'is', null).order('id').range(offset, offset + 999);
        if (error) throw error;
        for (const row of data || []) ids.add(row.id);
        if (!data || data.length < 1000) break;
      }
    }
    return ids;
  };
  return {
    loadFullPool: () => readPool('*'),
    loadLightPool: async () => {
      const key = JSON.stringify([subjectId, opts.chapters || null, opts.chapter || null, mode.allowDifficultyOverride ? opts.difficulty || null : null]);
      const hit = caches.pools.get(key);
      const now = clock();
      if (hit && now - hit.at < PRACTICE_POOL_CACHE_MS) return hit.value;
      // Past the five minutes, a pool whose subject has not changed (no row written since it was read, no row added or removed) is
      // exactly what a new read would return: two head counts instead of the whole subject (egress F3). Anything else, an error
      // or a pool older than a day reads again, as before. The freshness bound for an edit, a withdrawal or a vote is unchanged.
      if (hit && hit.count !== null && hit.count !== undefined && now - hit.readAt < POOL_REVALIDATE_MAX_MS) {
        try {
          if (tokenUnchanged(await subjectToken(db, subjectId, hit.readAt), hit)) { hit.at = clock(); return hit.value; }
        } catch { /* read it again */ }
      }
      const readAt = clock();
      // The count is taken before the read, so a row that arrives or changes while the pool is read shows next time.
      let count = null;
      try { count = await subjectCount(db, subjectId); } catch { count = null; }
      const [rows, managedIds] = await Promise.all([readPool(PRACTICE_LIGHT_SELECT), readManagedIds()]);
      const value = { rows, managedIds };
      caches.pools.set(key, { at: clock(), readAt, count, value });
      while (caches.pools.size > MAX_CACHED_POOLS) caches.pools.delete(caches.pools.keys().next().value);
      return value;
    },
    loadFullRows: async (ids) => {
      const rows = [];
      for (let i = 0; i < ids.length; i += 100) {
        // The newest-N window of managed rows is the same rows for every student: a row whose updated_at has not moved is not read
        // again (data/question_row_cache.js; the verdicts are still computed fresh from the rows on every start).
        const { data, error } = await readRowsCached(db, ids.slice(i, i + 100));
        if (error) throw error;
        rows.push(...(data || []));
      }
      return rows;
    },
    attachPassages: hooks.attachPassages,
    readable: (rows) => readablePracticeQuestions(rows, db, { requireEvidence: opts.requireEvidence === true, syllabusOption: opts.syllabusOption || null }),
    recentIds: hooks.recentIds,
    userProgress: hooks.userProgress,
    weakConcepts: hooks.weakConcepts,
  };
}
