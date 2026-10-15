// Builds and refreshes nta_question_index (supabase/migrations/20261013190000_nta_question_index.sql).
// Shared by the build script (scripts/nta-index-build.mjs), the authored-publish script (rebuilds the
// subjects it just touched) and the daily cron (/api/internal/rebuild-nta-index, rebuilds only subjects whose
// index is older than their newest live question). No 'server-only' import, so node:test can load it.
//
// A build reads ONE subject's live questions with their evidence (select only), keeps those whose signed
// evidence passes the NTA score checks (data/nta_engine.js ntaScoreIntegrity), and writes one signed slim
// row each. It writes only nta_question_index. The score bar is not applied here; the runtime does.
import { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } from './cuet_controls.js';
import { NTA_INDEX_VERSION, ntaScoreIntegrity, ntaScoreOf, signNtaIndex } from './nta_engine.js';
import { loadNtaPoolFull, attachPassages } from './nta_pool.js';
import { contentHash } from './content_evidence.js';
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
      score,
      luna,
      gemini,
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

/** Builds and writes one subject. */
export async function rebuildNtaIndexSubject(db, subject, { secret, now } = {}) {
  const built = await buildNtaIndexRows(db, subject, { secret, now });
  const { written, removed } = await writeNtaIndexRows(db, subject, built.rows);
  return { subject, loaded: built.pool.length, indexed: built.rows.length, rejected: built.rejected, written, removed, verifiedAt: built.verifiedAt };
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

/**
 * The daily cron: rebuild every subject whose index is older than its newest live question. Production only
 * (data/full_bank_guard.js; throws FullBankReadBlocked elsewhere before any read). Reads one subject at a time,
 * and only a stale one: a fresh subject costs a few small selects. A subject with no index rows is left
 * alone (nothing to go stale; the first build is the owner's step). Stops starting subjects after
 * deadlineMs, so a slow run leaves the rest for the pool's full-read fallback and the next day.
 */
export async function refreshStaleNtaIndexes(db, { secret, env = process.env, log = console.warn, now = () => Date.now(), deadlineMs = 240000, subjects = NTA_INDEX_SUBJECTS, rebuild = rebuildNtaIndexSubject } = {}) {
  assertFullBankRead('the NTA index rebuild', { env, log });
  if (!secret) return { status: 'skipped', reason: 'no_signing_key', subjects: [] };
  const started = now();
  const results = [];
  for (const subject of subjects) {
    if (now() - started > deadlineMs) { results.push({ subject, skipped: 'out_of_time' }); continue; }
    try {
      const { builtAt, tableMissing } = await ntaIndexBuiltAt(db, subject);
      if (tableMissing) return { status: 'skipped', reason: 'index_table_missing', subjects: [] };
      if (builtAt === null) { results.push({ subject, skipped: 'never_built' }); continue; }
      const freshness = await ntaIndexFreshness(db, subject, builtAt);
      if (!freshness.stale) { results.push({ subject, skipped: 'fresh' }); continue; }
      results.push({ ...(await rebuild(db, subject, { secret })), previouslyBuiltAt: freshness.builtAt, newestQuestionAt: freshness.newestAt });
    } catch (error) {
      log(`[nta-index] cron rebuild of ${subject} failed: ${error?.message || error}`);
      results.push({ subject, error: String(error?.message || error) });
    }
  }
  const rebuilt = results.filter((result) => result.written !== undefined).length;
  return { status: results.some((result) => result.error) ? 'partial' : 'ok', rebuilt, subjects: results };
}
