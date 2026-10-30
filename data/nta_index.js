// Builds and refreshes nta_question_index (supabase/migrations/20261013190000_nta_question_index.sql).
// Shared by the build script (scripts/nta-index-build.mjs), every publish path (the authored-publish and
// republish scripts rebuild the subjects they touched; the factory paths note a touch and rebuild at most once
// per interval, see createNtaIndexTouchQueue) and the daily safety rebuild, which rides on the existing
// /api/internal/refresh-inventory cron (vercel.json has no room for a cron of its own) and is also served by
// /api/internal/rebuild-nta-index for a manual run. No 'server-only' import, so node:test can load it.
//
// A build reads ONE subject's live questions with their evidence (select only), keeps those whose signed
// evidence passes the NTA score checks (data/nta_engine.js ntaScoreIntegrity), and writes one signed slim
// row each. It writes only nta_question_index. The score bar is not applied here; the runtime does.
import { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } from './cuet_controls.js';
import { NTA_INDEX_VERSION, ntaIndexRound2, ntaScoreIntegrity, ntaScoreOf, signNtaIndex } from './nta_engine.js';
import { loadNtaPoolFull, loadNtaPoolFromIndex, attachPassages } from './nta_pool.js';
import { contentHash, contentHashMatches } from './content_evidence.js';
import { objectiveTagOf } from './nta_item_checks.js';
import { assertFullBankRead } from './full_bank_guard.js';
import { ntaIndexBuiltAt, ntaIndexFreshness, newestLiveQuestionAt } from './nta_index_freshness.js';

const UPSERT_CHUNK = 500;
const DELETE_CHUNK = 300;

/** Every NTA subject, as the ids questions.subject stores. */
export const NTA_INDEX_SUBJECTS = Object.freeze(CUET_PUBLIC_ALLOWED_SUBJECTS.map((subject) => toInternalSubjectId(subject)));

/**
 * Reads one subject (internal id) and returns its signed index rows. verifiedAt is the build time, or the
 * newest live question's time when that is later (clock skew between this machine and the database must not
 * leave a fresh build looking older than a question it already read). Questions published after this read
 * are newer than verifiedAt, so the pool treats the index as stale until the next build.
 */
export async function buildNtaIndexRows(db, subject, { secret, now = new Date(), pool: provided } = {}) {
  if (!secret) throw new Error('CUET_EVIDENCE_SIGNING_KEY is required to verify evidence and sign index rows');
  const newestAt = await newestLiveQuestionAt(db, subject);
  const verifiedAt = new Date(Math.max(now.getTime(), newestAt ?? 0)).toISOString();
  const pool = provided || await attachPassages(db, await loadNtaPoolFull(db, subject));
  const rows = [];
  const rejected = {};
  for (const row of pool) {
    const { score, source, luna, gemini } = ntaScoreOf(row);
    if (source !== 'evidence_judges' || score === null) { rejected.no_evidence_score = (rejected.no_evidence_score || 0) + 1; continue; }
    const reasons = ntaScoreIntegrity(row, { secret });
    if (reasons.length) { for (const reason of reasons) rejected[reason] = (rejected[reason] || 0) + 1; continue; }
    const entry = {
      question_id: row.id,
      subject,
      // Stored exactly as numeric(4,2) will hand them back, so the signed value is the read-back value.
      score: ntaIndexRound2(score),
      luna: ntaIndexRound2(luna),
      gemini: ntaIndexRound2(gemini),
      content_hash: contentHash(row),
      family_id: row.family_id || row.evidence?.record?.family_id || null,
      objective_tag: objectiveTagOf(row),
      index_version: NTA_INDEX_VERSION,
      verified_at: verifiedAt,
    };
    rows.push({ ...entry, signature: signNtaIndex(entry, secret) });
  }
  return { pool, rows, rejected, verifiedAt };
}

/** Upserts the rows and removes the subject's rows that no longer verify. Returns { written, removed }. */
export async function writeNtaIndexRows(db, subject, rows) {
  let written = 0;
  let removed = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await db.from('nta_question_index').upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict: 'question_id' });
    if (error) throw error;
    written += Math.min(UPSERT_CHUNK, rows.length - i);
  }
  const { data: existing, error } = await db.from('nta_question_index').select('question_id').eq('subject', subject);
  if (error) throw error;
  const keep = new Set(rows.map((row) => row.question_id));
  const stale = (existing || []).map((row) => row.question_id).filter((id) => !keep.has(id));
  for (let i = 0; i < stale.length; i += DELETE_CHUNK) {
    const { error: deleteError } = await db.from('nta_question_index').delete().in('question_id', stale.slice(i, i + DELETE_CHUNK));
    if (deleteError) throw deleteError;
    removed += Math.min(DELETE_CHUNK, stale.length - i);
  }
  return { written, removed };
}

async function rebuildOnce(db, subject, { secret, now } = {}) {
  const built = await buildNtaIndexRows(db, subject, { secret, now });
  const { written, removed } = await writeNtaIndexRows(db, subject, built.rows);
  return { subject, loaded: built.pool.length, indexed: built.rows.length, rejected: built.rejected, written, removed, verifiedAt: built.verifiedAt };
}

// One rebuild per subject at a time in this process. A caller that arrives while one is running gets ONE
// follow-up run, not the running one: the running build may have read the subject before the caller's change
// landed. Any number of callers share the same follow-up. (Another process, say the cron and an owner's
// script at the same moment, is safe too, only wasteful: the write is an upsert by question id and the prune
// removes only rows that no longer verify, so two builds of the same bank write the same rows.)
const flights = new Map(); // subject -> { current: Promise, next: Promise | null }

function startFlight(db, subject, options) {
  const flight = { next: null };
  flight.current = rebuildOnce(db, subject, options).finally(() => {
    if (flights.get(subject) === flight && !flight.next) flights.delete(subject);
  });
  flights.set(subject, flight);
  return flight.current;
}

/** Builds and writes one subject. Safe to call twice at once (see above). */
export function rebuildNtaIndexSubject(db, subject, options = {}) {
  const flight = flights.get(subject);
  if (!flight) return startFlight(db, subject, options);
  if (!flight.next) flight.next = flight.current.then(() => {}, () => {}).then(() => startFlight(db, subject, options));
  return flight.next;
}

/**
 * Right after a publish: rebuild the index rows of the subjects it touched (internal ids). Never throws, so a
 * publish that already succeeded is not reported as failed; returns what happened per subject. A missing
 * table (migration not applied yet) or a missing signing key skips the rebuild; the pool then reads in full
 * (missing table) or falls back to the full read while the index is older than the newest question.
 */
export async function rebuildNtaIndexForSubjects(db, subjects, { secret, now, log = console.warn } = {}) {
  const wanted = [...new Set((subjects || []).map((subject) => toInternalSubjectId(subject)).filter(Boolean))];
  if (!wanted.length) return { status: 'nothing_to_do', subjects: [] };
  if (!secret) return { status: 'skipped', reason: 'no_signing_key', subjects: wanted.map((subject) => ({ subject, skipped: 'no_signing_key' })) };
  const results = [];
  for (const subject of wanted) {
    try {
      const { tableMissing } = await ntaIndexBuiltAt(db, subject);
      if (tableMissing) { results.push({ subject, skipped: 'index_table_missing' }); continue; }
      results.push(await rebuildNtaIndexSubject(db, subject, { secret, now }));
    } catch (error) {
      log(`[nta-index] rebuild of ${subject} failed: ${error?.message || error}`);
      results.push({ subject, error: String(error?.message || error) });
    }
  }
  const failed = results.some((result) => result.error);
  const skipped = results.length > 0 && results.every((result) => result.skipped);
  return { status: failed ? 'failed' : skipped ? 'skipped' : 'rebuilt', subjects: results };
}

export const NTA_INDEX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Margin before the index's build time: a late-committing transaction carries an older now(), and clocks differ (egress F2). */
export const NTA_TOUCH_MARGIN_MS = 15 * 60 * 1000;

/**
 * How many questions of the subject were inserted or updated since the index was built (a head count, no body). Content can only
 * change through an UPDATE, and every UPDATE bumps questions.updated_at (trigger trg_questions_updated_at), so 0 means no indexed
 * question's content can differ from what was scored: the drift read would find nothing. Returns null when it cannot be counted
 * (then the caller reads the drift as before).
 */
export async function ntaTouchedCount(db, subject, builtAt) {
  try {
    const { count, error } = await db.from('questions').select('id', { count: 'exact', head: true }).eq('subject', subject)
      .gte('updated_at', new Date(builtAt - NTA_TOUCH_MARGIN_MS).toISOString());
    return error || !Number.isInteger(count) ? null : count;
  } catch { return null; }
}

/**
 * Questions of the subject that are in the index but whose content is no longer the content that was scored
 * (an edited stem, option or key). At runtime such a row is refused by the content-hash check, so the question
 * quietly leaves NTA papers until the next rebuild. Reads what a student's NTA start reads on the index path
 * (the index rows, the questions without evidence, about 0.3 MB, and the passage groups they point at),
 * never the evidence column.
 * Returns { checked, drifted: [question ids] }.
 */
export async function ntaIndexDrift(db, subject) {
  const read = await loadNtaPoolFromIndex(db, subject, { checkFresh: false });
  if (!read) return { checked: 0, drifted: [] };
  // The build hashed each question with its passage attached (data/nta_pool.js attachPassages), so compare the same way.
  const rows = await attachPassages(db, read);
  return { checked: rows.length, drifted: rows.filter((row) => !contentHashMatches(row, row.nta_index.content_hash)).map((row) => row.id) };
}

/**
 * The daily safety rebuild. Production only (data/full_bank_guard.js; throws FullBankReadBlocked elsewhere
 * before any read). One subject at a time, reading as little as it can. A subject is rebuilt when
 *  - newer_questions: a live question is newer than the index (two one-row selects to find out);
 *  - content_changed: an indexed question's content no longer matches the row (a slim read, no evidence);
 *  - max_age: its index is older than maxAgeMs (default 7 days: re-verifies evidence that expired, drops rows
 *    that no longer verify, and picks up anything a path above did not report). Oldest first, so when a
 *    deadline stops the run, the next day continues with the oldest.
 * Otherwise the subject costs a few small selects and nothing is written, so running it twice in a row, or
 * twice a day, changes nothing the second time (the result says "fresh"). A subject with no index rows is
 * left alone (nothing to go stale; the first build is the owner's step). The run stops starting subjects after
 * deadlineMs and leaves the rest to the pool's full-read fallback and the next day.
 */
export async function refreshStaleNtaIndexes(db, { secret, env = process.env, log = console.warn, now = () => Date.now(), deadlineMs = 240000, maxAgeMs = NTA_INDEX_MAX_AGE_MS, subjects = NTA_INDEX_SUBJECTS, rebuild = rebuildNtaIndexSubject, drift = ntaIndexDrift, touched = ntaTouchedCount } = {}) {
  assertFullBankRead('the NTA index rebuild', { env, log });
  if (!secret) return { status: 'skipped', reason: 'no_signing_key', subjects: [] };
  const started = now();
  const results = [];
  const due = [];
  for (const subject of subjects) {
    try {
      const { builtAt, tableMissing } = await ntaIndexBuiltAt(db, subject);
      if (tableMissing) return { status: 'skipped', reason: 'index_table_missing', subjects: [] };
      if (builtAt === null) results.push({ subject, skipped: 'never_built' });
      else due.push({ subject, builtAt });
    } catch (error) {
      log(`[nta-index] daily check of ${subject} failed: ${error?.message || error}`);
      results.push({ subject, error: String(error?.message || error) });
    }
  }
  due.sort((a, b) => a.builtAt - b.builtAt);
  for (const { subject, builtAt } of due) {
    if (now() - started > deadlineMs) { results.push({ subject, skipped: 'out_of_time' }); continue; }
    try {
      let reason = null;
      let detail = {};
      if (now() - builtAt > maxAgeMs) {
        reason = 'max_age';
      } else {
        const freshness = await ntaIndexFreshness(db, subject, builtAt);
        if (freshness.stale) {
          reason = 'newer_questions';
          detail = { newestQuestionAt: freshness.newestAt };
        } else if (await touched(db, subject, builtAt) === 0) {
          // Nothing of this subject was written since the build, so no indexed content can have changed: the drift read (the
          // index rows and the questions without evidence, 0.3-0.5 MB) would find nothing. A vote or an edit makes the count
          // non-zero and the drift read runs as before; so does any error.
        } else {
          const found = await drift(db, subject);
          if (found.drifted.length) { reason = 'content_changed'; detail = { driftedQuestions: found.drifted.length }; }
        }
      }
      if (!reason) { results.push({ subject, skipped: 'fresh' }); continue; }
      results.push({ ...(await rebuild(db, subject, { secret })), reason, previouslyBuiltAt: new Date(builtAt).toISOString(), ...detail });
    } catch (error) {
      log(`[nta-index] daily rebuild of ${subject} failed: ${error?.message || error}`);
      results.push({ subject, error: String(error?.message || error) });
    }
  }
  const rebuilt = results.filter((result) => result.written !== undefined).length;
  return { status: results.some((result) => result.error) ? 'partial' : 'ok', rebuilt, subjects: results };
}

/** One line for the log: what the run did, per reason, and anything that failed. Counts only, no ids. */
export function describeNtaIndexRun(result, { ms = null } = {}) {
  const took = ms === null ? '' : ` in ${ms} ms`;
  if (!result || result.status === 'skipped') return `[nta-index] daily refresh skipped${took}: ${result?.reason || 'unknown'}`;
  const list = result.subjects || [];
  const tally = (pick) => list.filter(pick);
  const rebuilt = tally((entry) => entry.written !== undefined);
  const parts = [
    `rebuilt ${rebuilt.length}${rebuilt.length ? ` (${rebuilt.map((entry) => `${entry.subject} ${entry.reason || 'rebuilt'} ${entry.indexed} rows`).join(', ')})` : ''}`,
    `fresh ${tally((entry) => entry.skipped === 'fresh').length}`,
  ];
  const never = tally((entry) => entry.skipped === 'never_built');
  const late = tally((entry) => entry.skipped === 'out_of_time');
  const failed = tally((entry) => entry.error);
  if (never.length) parts.push(`never built ${never.length}`);
  if (late.length) parts.push(`left for tomorrow ${late.length} (${late.map((entry) => entry.subject).join(', ')})`);
  if (failed.length) parts.push(`FAILED ${failed.length} (${failed.map((entry) => `${entry.subject}: ${entry.error}`).join('; ')})`);
  return `[nta-index] daily refresh ${result.status}${took}: ${parts.join(', ')}`;
}

/**
 * Remembers which subjects a long-running publisher touched and rebuilds them at most once per minIntervalMs
 * each, so a worker that publishes one question at a time does not re-read a subject (3-6 MB with evidence)
 * for every question. touch() only records; flush() rebuilds what is due, or everything with { force: true }
 * (call that at the end of a batch). A subject that could not be rebuilt stays pending and is retried at the
 * next due flush; a missing key or table clears it (the pool falls back to the full read, the daily run
 * covers the rest). Never throws. NTA_INDEX_REBUILD=off switches the default queue off.
 */
export function createNtaIndexTouchQueue({ getSecret = () => process.env.CUET_EVIDENCE_SIGNING_KEY, minIntervalMs = 30 * 60 * 1000, now = () => Date.now(), log = console.warn, rebuild = rebuildNtaIndexForSubjects, enabled = () => process.env.NTA_INDEX_REBUILD !== 'off' } = {}) {
  const pending = new Map(); // subject -> the database the publish went to
  const lastRun = new Map(); // subject -> ms
  const run = async (force) => {
    if (!enabled()) { pending.clear(); return { status: 'skipped', reason: 'disabled', subjects: [] }; }
    const due = [...pending.keys()].filter((subject) => force || !lastRun.has(subject) || now() - lastRun.get(subject) >= minIntervalMs);
    if (!due.length) return { status: 'nothing_to_do', subjects: [] };
    const results = [];
    const byDb = new Map();
    for (const subject of due) byDb.set(pending.get(subject), [...(byDb.get(pending.get(subject)) || []), subject]);
    for (const [db, list] of byDb) {
      for (const subject of list) lastRun.set(subject, now());
      let outcome;
      try {
        outcome = await rebuild(db, list, { secret: getSecret(), log });
      } catch (error) {
        outcome = { status: 'failed', subjects: list.map((subject) => ({ subject, error: String(error?.message || error) })) };
      }
      for (const entry of outcome.subjects || []) {
        if (!entry.error) pending.delete(entry.subject);
        results.push(entry);
      }
      if (outcome.status === 'skipped') for (const subject of list) pending.delete(subject);
    }
    return { status: results.some((entry) => entry.error) ? 'failed' : 'rebuilt', subjects: results };
  };
  return {
    touch(db, subjects) {
      for (const subject of subjects || []) {
        const id = toInternalSubjectId(subject);
        if (id && db) pending.set(id, db);
      }
    },
    flush: ({ force = false } = {}) => run(force).catch((error) => { log(`[nta-index] flush failed: ${error?.message || error}`); return { status: 'failed', subjects: [] }; }),
    pendingSubjects: () => [...pending.keys()],
  };
}

const defaultQueue = createNtaIndexTouchQueue();

/** After a publish that went to `db`: note the subjects and rebuild any that are due (throttled). Never throws. */
export async function noteNtaIndexPublish(db, subjects) {
  defaultQueue.touch(db, subjects);
  return defaultQueue.flush();
}

/** At the end of a publishing batch: rebuild every noted subject now. Never throws. */
export function flushNtaIndexRebuilds({ force = true } = {}) {
  return defaultQueue.flush({ force });
}
