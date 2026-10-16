// Reads a student's per-question progress for the practice picker (data/db.js, data/practice_pick.js).
// No 'server-only' import and no client of its own: the caller passes one, so node:test can load this.
//
// Why chunks: PostgREST receives `.in('question_id', ids)` as part of the URL. A subject's pool can hold
// thousands of ids (Accountancy is the largest), and a request URL past a few kilobytes is refused by the
// gateway. The old single query then came back as an error, which the caller treated as "no progress", so
// a student with a long history got picks that ignored it (above roughly 700 ids). Reading in chunks of
// PROGRESS_ID_CHUNK keeps every URL short (100 ids is about 4 KB) and gives the same rows the single query
// would have returned: one row per (user, question) at most, so a chunk never reaches the 1000-row cap.
//
// Failure handling matches what the callers always did, but is visible now: a chunk that errors is
// skipped (those ids count as "no progress"), the result carries `incomplete = true` and `failedChunks`,
// and one log line says so. A missing table (older environments) stays quiet and returns an empty map.

export const PROGRESS_ID_CHUNK = 100;
export const PROGRESS_CONCURRENCY = 4;
const PAGE = 1000;
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

function chunksOf(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

// Runs the jobs with at most `limit` in flight; results keep the order of the jobs.
async function inBatches(jobs, limit) {
  const results = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const at = next++;
      results[at] = await jobs[at]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
  return results;
}

/**
 * This student's progress rows for the given question ids: Map(question_id -> { question_id, attempt_count,
 * correct_count, last_attempted_at }). Duplicate ids are read once. The Map has `incomplete` (true when a
 * chunk failed) and `failedChunks` (how many); `incomplete` is false on a clean read.
 */
export async function readUserProgress(db, userId, questionIds, { chunk = PROGRESS_ID_CHUNK, concurrency = PROGRESS_CONCURRENCY, warn = console.warn } = {}) {
  const progress = new Map();
  progress.incomplete = false;
  progress.failedChunks = 0;
  if (!userId || !Array.isArray(questionIds) || questionIds.length === 0) return progress;
  const ids = [...new Set(questionIds.filter((id) => id !== null && id !== undefined))];
  const results = await inBatches(chunksOf(ids, chunk).map((part) => async () => {
    try {
      return await db
        .from('user_question_progress')
        .select('question_id, attempt_count, correct_count, last_attempted_at')
        .eq('user_id', userId)
        .in('question_id', part);
    } catch (error) {
      return { data: null, error };
    }
  }), concurrency);
  let firstError = null;
  for (const { data, error } of results) {
    if (error) {
      progress.failedChunks += 1;
      firstError ||= error;
      continue;
    }
    for (const row of data || []) progress.set(row.question_id, row);
  }
  if (progress.failedChunks) {
    progress.incomplete = true;
    // Schema may not be present in older envs: degrade without noise.
    if (!MISSING_TABLE.has(firstError?.code)) {
      warn(`[practice-progress] ${progress.failedChunks} of ${Math.ceil(ids.length / chunk)} progress reads failed (${firstError?.message || firstError?.code || 'unknown error'}); those questions count as unseen for this pick.`);
    }
  }
  return progress;
}

/**
 * Per-concept attempt totals for one student and subject: Map(concept_id -> { attempts, correct }).
 * Pages through the student's progress rows for the subject (the default response cap is 1000 rows, so one
 * query silently dropped everything past it) and looks the concepts up in id chunks. Returns an empty map
 * when anything fails, as before; `incomplete` is true then, and one line is logged.
 */
export async function readConceptBuckets(db, userId, subjectId, { chunk = PROGRESS_ID_CHUNK, concurrency = PROGRESS_CONCURRENCY, warn = console.warn } = {}) {
  const buckets = new Map();
  buckets.incomplete = false;
  if (!userId) return buckets;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('user_question_progress')
      .select('question_id, attempt_count, correct_count')
      .eq('user_id', userId)
      .eq('subject', subjectId)
      .gt('attempt_count', 0)
      .order('question_id')
      .range(from, from + PAGE - 1);
    if (error) {
      buckets.incomplete = true;
      if (!MISSING_TABLE.has(error.code)) warn(`[practice-progress] weak-concept progress read failed (${error.message || error.code}); weak topics are not used for this pick.`);
      return buckets;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  if (!rows.length) return buckets;
  const results = await inBatches(chunksOf([...new Set(rows.map((row) => row.question_id))], chunk).map((part) => async () => {
    try {
      return await db.from('questions').select('id, concept_id').in('id', part);
    } catch (error) {
      return { data: null, error };
    }
  }), concurrency);
  const conceptByQid = new Map();
  for (const { data, error } of results) {
    if (error) {
      warn(`[practice-progress] concept lookup failed (${error.message || error.code}); weak topics are not used for this pick.`);
      return Object.assign(new Map(), { incomplete: true });
    }
    for (const row of data || []) conceptByQid.set(row.id, row.concept_id);
  }
  for (const row of rows) {
    const concept = conceptByQid.get(row.question_id);
    if (!concept) continue;
    const bucket = buckets.get(concept) || { attempts: 0, correct: 0 };
    bucket.attempts += row.attempt_count || 0;
    bucket.correct += row.correct_count || 0;
    buckets.set(concept, bucket);
  }
  return buckets;
}
