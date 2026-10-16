// The database side of a practice or full-mock start (data/db.js getQuestions): the queries the slim read
// (data/practice_pick.js) is built on, with their per-server caches. Lifted out of db.js so a test can run
// the real queries against an in-memory database and count the bytes of every read
// (data/tests/practice_verdicts.test.mjs). No 'server-only' import, so node:test can load it.
import { readablePracticeQuestions } from './practice_library.js';
import { attachManagedStubs, PRACTICE_PICK_SELECT, PRACTICE_PLAIN_SELECT, PRACTICE_POOL_CACHE_MS } from './practice_pick.js';
import { practiceVerdictBasis, readManagedStubs, readPracticeVerdictRows, trustedPracticeVerdicts } from './practice_verdicts.js';

export const VISIBLE_QUESTION_FILTER = 'status.eq.live,and(verification_state.eq.verified,exploration_state.eq.active)';

export function isMissingPhase1VoteSchema(error) {
  return error?.code === '42703' ||
    error?.code === '42P01' ||
    /question_votes|score|upvotes|downvotes|schema cache|column .* does not exist/i.test(error?.message || '');
}

// Light subject pools for the slim session-start read, kept PRACTICE_POOL_CACHE_MS per server, and the stored
// practice verdicts (data/practice_verdicts.js) per subject and basis, kept as long. A test passes its own pair.
export const PRACTICE_CACHES = { pools: new Map(), verdicts: new Map() };
const MAX_CACHED = 40;
const remember = (map, key, value, now) => {
  map.set(key, { at: now, value });
  while (map.size > MAX_CACHED) map.delete(map.keys().next().value);
  return value;
};

/**
 * The `source` object selectPracticeQuestions works with. `hooks` are the three per-student reads that stay in
 * data/db.js (recentIds, userProgress, weakConcepts) and attachPassages; everything else is built here.
 */
export function createPracticeSource({ db, subjectId, mode, opts = {}, targetCount, hooks, caches = PRACTICE_CACHES, env = process.env, clock = () => Date.now() }) {
  // Slim read: rank on the subject without its evidence records, then read full rows only for the questions that
  // decide the picks. The full read is the fallback, and the behaviour PRACTICE_SLIM_READ=off keeps.
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
  // The stored verdict rows of this subject, read at most once per PRACTICE_POOL_CACHE_MS per server (a missing table
  // is cached as "none" too). Trust is decided per question in trustedPracticeVerdicts, never here.
  const readVerdictRows = async (basis) => {
    const key = JSON.stringify([subjectId, basis]);
    const hit = caches.verdicts.get(key);
    if (hit && clock() - hit.at < PRACTICE_POOL_CACHE_MS) return hit.value;
    const { rows } = await readPracticeVerdictRows(db, subjectId, basis);
    return remember(caches.verdicts, key, rows, clock());
  };
  return {
    loadFullPool: () => readPool('*'),
    loadLightPool: async () => {
      const key = JSON.stringify([subjectId, opts.chapters || null, opts.chapter || null, mode.allowDifficultyOverride ? opts.difficulty || null : null]);
      const hit = caches.pools.get(key);
      if (hit && clock() - hit.at < PRACTICE_POOL_CACHE_MS) return hit.value;
      // One scan of the evidence-managed rows (their stubs, evidence signature and provenance) replaces the
      // two paged id scans and the three json-path columns that used to ride on every row.
      const [rows, managedRows] = await Promise.all([readPool(PRACTICE_PLAIN_SELECT), readManagedStubs(db, subjectId)]);
      return remember(caches.pools, key, attachManagedStubs(rows, managedRows), clock());
    },
    loadFullRows: async (ids) => {
      const rows = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await db.from('questions').select('*').in('id', ids.slice(i, i + 100));
        if (error) throw error;
        rows.push(...(data || []));
      }
      return rows;
    },
    // Fresh plain columns (and stubs) of decided picks, instead of their evidence records (PRACTICE_SLIM_RECORD).
    loadLightRows: async (ids) => {
      const rows = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await db.from('questions').select(PRACTICE_PICK_SELECT).in('id', ids.slice(i, i + 100));
        if (error) throw error;
        rows.push(...(data || []));
      }
      return rows;
    },
    attachPassages: hooks.attachPassages,
    readable: (rows, known) => readablePracticeQuestions(rows, db, { requireEvidence: opts.requireEvidence === true, known }),
    loadVerdicts: async (managedRows) => {
      const secret = env.CUET_EVIDENCE_SIGNING_KEY;
      const basis = secret ? practiceVerdictBasis() : null;
      if (!basis) return new Map();
      return trustedPracticeVerdicts({ rows: managedRows, verdictRows: await readVerdictRows(basis), subject: subjectId, basis, secret, now: clock(), env });
    },
    recentIds: hooks.recentIds,
    userProgress: hooks.userProgress,
    weakConcepts: hooks.weakConcepts,
  };
}
