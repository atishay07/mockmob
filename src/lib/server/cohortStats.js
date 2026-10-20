// Server reads and the nightly refresh for the cohort table (data/cohort_time.js; spec tmp/mistake-lab-v4/SPEC.md 4.13).
// No 'server-only' on purpose, so node:test can load it with a fake client; it imports the Supabase client lazily.
//   readCohortWithTime   the cohort read the result route uses: the nightly table (picks, time, changes, strike-outs) while it
//                        is there and no older than 48 hours; otherwise the committed snapshot of other students' picks,
//                        exactly as before slice 5 (data/cohort_picks.js readCohort), with no time lines.
//   refreshCohortStats   asks the database to rebuild the table (public.refresh_question_option_stats). Never throws: the
//                        nightly cron that calls it (refresh-inventory) must not change its status code for this.
// The table holds aggregates about a question, no user id.
import { assertFullBankRead, isFullBankReadBlocked } from '../../../data/full_bank_guard.js';
import { cohortForAttempt, readCohort } from '../../../data/cohort_picks.js';
import { COHORT_TIME_RULES, isFresh, tableSnapshot } from '../../../data/cohort_time.js';

const COLUMNS = 'qid,key_hash,n_answered,option_picks,n_first_right,n_timed,n_timed_right,median_ms_right,q1_ms_right,q3_ms_right,right_secs,n_changed,n_moved_off_key,n_strike_basis,n_struck_key,first_answer_from,first_answer_to,counted_through,refreshed_at';
const BATCH = 120; // question ids per read; keeps the request URL short
const MAX_QUESTIONS = 3000;

/** A missing table or function (a database where the migration has not run) is "no table", not an error. */
export const statsMissing = (error) => /question_option_stats|refresh_question_option_stats|schema cache|does not exist|PGRST20[25]|42P01|42883/i.test(`${error?.code || ''} ${error?.message || ''}`);

const adminClient = async () => (await import('../supabase')).supabaseAdmin();

/** The newest refresh time of the table in ms, 0 for an empty table, null when the table is missing. Throws on any other failure. */
export async function newestStatsRefresh({ db } = {}) {
  const client = db || (await adminClient());
  const { data, error } = await client.from('question_option_stats').select('refreshed_at').order('refreshed_at', { ascending: false }).limit(1);
  if (error) { if (statsMissing(error)) return null; throw Object.assign(new Error('COHORT_STATS_UNAVAILABLE'), { cause: error }); }
  return data?.length ? Date.parse(data[0].refreshed_at) || 0 : 0;
}

/** The table's rows for these question ids. Throws on any failure (the caller falls back to the snapshot). */
export async function readStatRows(qids, { db } = {}) {
  const ids = [...new Set((qids || []).filter((q) => typeof q === 'string' && q))].slice(0, MAX_QUESTIONS);
  if (!ids.length) return [];
  const client = db || (await adminClient());
  const batches = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const out = [];
  for (let i = 0; i < batches.length; i += 4) {
    const results = await Promise.all(batches.slice(i, i + 4).map((part) => client.from('question_option_stats').select(COLUMNS).in('qid', part)));
    for (const r of results) {
      if (r.error) throw Object.assign(new Error('COHORT_STATS_UNAVAILABLE'), { cause: r.error });
      out.push(...(r.data || []));
    }
  }
  return out;
}

// Kept per database client (production has one; a test fake gets its own): the table's newest refresh for five minutes, and the rows
// of a question for thirty minutes, dropped whole whenever the table's newest refresh moves. The table holds aggregates about a
// question and no user id, so what is kept is the same for every student (egress F18). At most MAX_CACHED_QUESTIONS questions.
export const NEWEST_MEMO_MS = 5 * 60 * 1000;
export const ROWS_MEMO_MS = 30 * 60 * 1000;
export const MAX_CACHED_QUESTIONS = 2000;
const memos = new WeakMap();
const memoOf = (client) => {
  if (client === null || typeof client !== 'object') return { newest: null, version: null, rows: new Map() };
  if (!memos.has(client)) memos.set(client, { newest: null, version: null, rows: new Map() });
  return memos.get(client);
};
const clone = (value) => JSON.parse(JSON.stringify(value));

async function newestMemoised(client, at) {
  const memo = memoOf(client);
  if (memo.newest && at - memo.newest.at < NEWEST_MEMO_MS) return memo.newest.value;
  const value = await newestStatsRefresh({ db: client });
  memo.newest = { value, at };
  return value;
}

async function rowsMemoised(client, qids, newest, at) {
  const memo = memoOf(client);
  if (memo.version !== newest) { memo.rows.clear(); memo.version = newest; }
  const ids = [...new Set((qids || []).filter((q) => typeof q === 'string' && q))].slice(0, MAX_QUESTIONS);
  const out = [];
  const missing = [];
  for (const id of ids) {
    const hit = memo.rows.get(id);
    if (hit && at - hit.at < ROWS_MEMO_MS) out.push(...clone(hit.rows)); else missing.push(id);
  }
  if (missing.length) {
    const read = await readStatRows(missing, { db: client });
    const by = new Map(missing.map((id) => [id, []]));
    for (const row of read) by.get(row.qid)?.push(row);
    for (const [id, rows] of by) { memo.rows.delete(id); memo.rows.set(id, { rows: clone(rows), at }); }
    while (memo.rows.size > MAX_CACHED_QUESTIONS) memo.rows.delete(memo.rows.keys().next().value);
    out.push(...read);
  }
  return out;
}

/**
 * The route's cohort reader. Same arguments and result as data/cohort_picks.js readCohort ({ attempt, allAttempts,
 * answerReviews }), plus `time` on each question the table has numbers for. The table is used only while its newest
 * refresh is at most 48 hours old; a missing, empty or stale table, or any failed read, falls back to the committed
 * snapshot exactly as today.
 */
export async function readCohortWithTime(input, { db, now = Date.now(), staticRead = readCohort } = {}) {
  try {
    const client = db || (await adminClient());
    const clock = Date.now();
    const newest = await newestMemoised(client, clock);
    if (newest && isFresh(newest, now)) {
      const qids = (input?.attempt?.questionsSnapshot || []).map((q) => q?.id);
      const rows = await rowsMemoised(client, qids, newest, clock);
      // A fresh table is the source even when it has nothing for this paper: the snapshot is older than the table.
      const snapshot = tableSnapshot(rows) || { version: 1, builtAt: new Date(newest).toISOString(), since: null, until: null, source: 'table', questions: {} };
      return cohortForAttempt({ attempt: input.attempt, allAttempts: input.allAttempts, answerReviews: input.answerReviews, snapshot });
    }
  } catch (error) {
    console.warn(`[cohort] the cohort table could not be read, using the snapshot: ${error?.message || 'unknown error'}`);
  }
  return staticRead(input);
}

/**
 * Rebuild the table: one call to public.refresh_question_option_stats, within `budgetMs` (the database keeps running past
 * it, up to its own 120 s limit, and finishes the rebuild). Outside Vercel production it does nothing (the refresh reads
 * every attempt: data/full_bank_guard.js). Never throws. status: ok | skipped | timeout | blocked | missing | failed.
 */
export async function refreshCohortStats({ db, budgetMs = 120000, env = process.env } = {}) {
  const began = Date.now();
  const took = () => Date.now() - began;
  let timer;
  try {
    assertFullBankRead('the cohort table refresh', { env });
    const client = db || (await adminClient());
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ timedOut: true }), Math.max(0, budgetMs)); });
    const res = await Promise.race([Promise.resolve(client.rpc('refresh_question_option_stats')), timeout]);
    if (res?.timedOut) return { status: 'timeout', ms: took() };
    if (res?.error) return { status: statsMissing(res.error) ? 'missing' : 'failed', ms: took(), message: res.error.message };
    const data = res?.data;
    if (data?.skipped) return { status: 'skipped', reason: data.skipped, ms: took() };
    return { status: 'ok', ms: took(), questions: Number(data?.questions) || 0, answers: Number(data?.answers) || 0, timedAnswers: Number(data?.timed_answers) || 0, withTime: Number(data?.questions_with_time) || 0, removed: Number(data?.removed) || 0 };
  } catch (error) {
    if (isFullBankReadBlocked(error)) return { status: 'blocked', ms: took() };
    return { status: 'failed', ms: took(), message: error?.message || 'unknown error' };
  } finally {
    clearTimeout(timer);
  }
}

/** One log line for a refresh result. */
export function describeCohortRun(result) {
  const r = result || { status: 'failed' };
  if (r.status === 'ok') return `[cohort-stats] daily refresh wrote ${r.questions} questions (${r.answers} first answers, ${r.timedAnswers} timed, ${r.withTime} questions with time, ${r.removed} removed) in ${r.ms} ms`;
  if (r.status === 'skipped') return `[cohort-stats] daily refresh skipped: ${r.reason}`;
  if (r.status === 'timeout') return `[cohort-stats] daily refresh did not answer within ${r.ms} ms; the database finishes it on its own`;
  if (r.status === 'blocked') return '[cohort-stats] daily refresh runs only on Vercel production';
  if (r.status === 'missing') return '[cohort-stats] daily refresh skipped: the table is not in this database yet';
  return `[cohort-stats] daily refresh failed: ${r.message || 'unknown error'}`;
}

export { COHORT_TIME_RULES };
