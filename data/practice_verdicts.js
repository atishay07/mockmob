// Stored verdicts for the practice start (data/practice_pick.js, data/db.js getQuestions).
//
// Why: a practice start has to know which evidence-managed questions are eligible. That is a
// function of the question's signed evidence record (about 35 KB each) and of the source registry
// and calibration shipped with the deployment. Reading the record for every candidate the start
// looks at cost 0.4-3 MB per start. publication eligibility is deterministic, so the verdict is
// computed once, signed, and stored in practice_verdict_index (supabase/migrations/
// 20261016160000_practice_verdict_index.sql); the start then reads a 40-60 KB verdict list instead.
//
// The same idea as nta_question_index (data/nta_index.js), with one difference that matters: the NTA
// index trusts a row while its subject's index is newer than the subject's newest question. This one
// binds every verdict to the exact inputs it was computed from, so no freshness window is needed and
// a question that changes simply stops matching its verdict:
//   input_hash  the question's content columns (counters such as votes, score and exposure are not
//               part of it), the evidence record's signature and the provenance record. A different
//               signature is a different record (the HMAC covers the whole record).
//   basis       the verdict logic version, the source registry file and the calibration manifest.
//   signature   HMAC (CUET_EVIDENCE_SIGNING_KEY) over question id, subject, verdict, expiry,
//               input_hash and basis, so a row nobody with the key wrote is never believed.
//   expires_at  the evidence record's expiry; an eligible verdict past it is not believed.
// Anything that does not check out is "no verdict", and the start reads that question's evidence as
// it always did. Holds, answer integrity and the score floor are not verdict inputs: the start still
// applies them to the live row (data/practice_library.js).
//
// No 'server-only' import, so node:test and the scripts can load it.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { canonicalJSON } from './canonical_json.mjs';
import { publicationEligibility, sharedEligibilitySnapshot } from './evidence_registry.js';
import { PRACTICE_QUESTION_COLUMNS, PRACTICE_MANAGED_FILTER, PRACTICE_MANAGED_STUBS } from './practice_pick.js';
import { FACTORY_SUBJECTS } from './question_factory_policy.mjs';

// The verdict is a function of this code. data/tests/practice_verdicts.test.mjs hashes these files (line endings
// normalised) and fails when the hash is not the one in PRACTICE_VERDICT_LOGIC_VERSION: change the code, then
// bump the version here (new number, the printed hash), and every stored verdict becomes 'no verdict' until the
// next refresh rebuilds it, so a stale verdict can never outlive the rule that produced it.
export const PRACTICE_VERDICT_LOGIC_FILES = Object.freeze(['content_evidence.js', 'canonical_json.mjs', 'question_presentation.mjs', 'question_factory_policy.mjs', 'question_factory_scope.json', 'evidence_registry.js']);
export const PRACTICE_VERDICT_LOGIC_VERSION = 'practice-verdict-1.271cc779';

// Columns of the question row that publication eligibility does not read for an evidence-managed
// question (the test records the properties it does read and fails if one of these is among them,
// apart from `score`, which the start filters on the live row). Everything else in the practice
// column list is part of input_hash, so a column added later is covered until someone lists it here.
export const PRACTICE_VERDICT_VOLATILE_COLUMNS = Object.freeze([
  'upvotes', 'downvotes', 'score', 'updated_at', 'exposure_budget', 'exposure_used', 'momentum_score',
  'quality_band', 'quality_score', 'ai_tier', 'ai_score', 'recommended_difficulty', 'difficulty_weight',
  'validation_confidence', 'validated_at', 'settled_at', 'live_at', 'order_index', 'exploration_lane', 'exploration_state',
]);
const VOLATILE = new Set(PRACTICE_VERDICT_VOLATILE_COLUMNS);
export const PRACTICE_VERDICT_HASH_COLUMNS = Object.freeze(PRACTICE_QUESTION_COLUMNS.filter((column) => !VOLATILE.has(column)));

// What the start reads back per verdict. The subject and basis are the query's filters.
export const PRACTICE_VERDICT_COLUMNS = 'question_id,eligible,expires_at,input_hash,signature';
export const PRACTICE_VERDICT_TABLE = 'practice_verdict_index';
// Evidence-managed subjects (the factory's); a managed question elsewhere simply has no verdict.
export const PRACTICE_VERDICT_SUBJECTS = Object.freeze([...FACTORY_SUBJECTS]);

const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const PAGE = 1000;
const UPSERT_CHUNK = 500;
const DELETE_CHUNK = 300;
const EVIDENCE_CHUNK = 40;
export const PRACTICE_VERDICT_RENEW_MS = 36 * 60 * 60 * 1000;

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const isoOrNull = (value) => {
  const at = Date.parse(value);
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
};

// ---------------------------------------------------------------------------------------------
// basis: the logic version plus the registry and calibration files shipped with this deployment.
// Hashed from the raw bytes (about 5 MB) once per server instance; a changed size or modification
// time reads them again, as the shared eligibility snapshot does. A failed read is not remembered.
// ---------------------------------------------------------------------------------------------
const REGISTRY_FILES = [new URL('./source_registry.json', import.meta.url), new URL('./calibration_manifest.json', import.meta.url)];
let basisCache = null;

export function practiceVerdictBasis() {
  try {
    const stamp = REGISTRY_FILES.map((file) => { const s = statSync(file); return `${s.size}:${s.mtimeMs}`; }).join('|');
    if (basisCache?.stamp === stamp) return basisCache.basis;
    const digests = REGISTRY_FILES.map((file) => sha256(readFileSync(file)));
    const basis = sha256(JSON.stringify([PRACTICE_VERDICT_LOGIC_VERSION, ...digests])).slice(0, 16);
    basisCache = { stamp, basis };
    return basis;
  } catch {
    return null;
  }
}

/** Fingerprint of everything a verdict is a function of on the question side. */
export function practiceInputHash(row, evidenceSignature, provenance) {
  const fields = {};
  for (const column of PRACTICE_VERDICT_HASH_COLUMNS) fields[column] = row?.[column] === undefined ? null : row[column];
  return sha256(canonicalJSON({ fields, evidence_signature: evidenceSignature ?? null, provenance: provenance ?? null })).slice(0, 32);
}

/** The fields the signature covers. */
export function practiceVerdictSignedBody(verdict) {
  return {
    question_id: verdict.question_id,
    subject: verdict.subject,
    eligible: verdict.eligible === true,
    expires_at: isoOrNull(verdict.expires_at),
    input_hash: verdict.input_hash,
    basis: verdict.basis,
  };
}

export function signPracticeVerdict(verdict, secret) {
  return createHmac('sha256', secret).update(canonicalJSON(practiceVerdictSignedBody(verdict))).digest('hex').slice(0, 32);
}

function signatureMatches(verdict, secret) {
  const expected = Buffer.from(signPracticeVerdict(verdict, secret));
  const actual = Buffer.from(String(verdict.signature || ''));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------------------------

/** The subject's evidence-managed questions, small: the stubs the start ranks with, the evidence signature and the provenance. One scan. */
export async function readManagedStubs(db, subject) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.from('questions').select(PRACTICE_MANAGED_STUBS).eq('subject', subject).eq('is_deleted', false)
      .or(PRACTICE_MANAGED_FILTER).order('id').range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** The subject's verdict rows for this basis. A missing table is "no verdicts", not an error. */
export async function readPracticeVerdictRows(db, subject, basis) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.from(PRACTICE_VERDICT_TABLE).select(PRACTICE_VERDICT_COLUMNS).eq('subject', subject).eq('basis', basis)
      .order('question_id').range(offset, offset + PAGE - 1);
    if (error) {
      if (MISSING_TABLE.has(error.code)) return { rows: [], tableMissing: true };
      throw error;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, tableMissing: false };
}

/**
 * Which of the evidence-managed rows have a verdict worth believing: Map(id -> { eligible, expires_at }).
 * `rows` are light rows with ev_sig and ev_prov (data/practice_pick.js attachManagedStubs), after
 * passage text was attached. Nothing here is a guess: a row without a matching, signed, current
 * verdict is left out, and the caller reads its evidence.
 */
export function trustedPracticeVerdicts({ rows, verdictRows, subject, basis, secret, now = Date.now(), env = process.env }) {
  const trusted = new Map();
  if (!secret || !basis || env.MOCK_AI === 'true' || !rows?.length || !verdictRows?.length) return trusted;
  const byId = new Map(verdictRows.map((verdict) => [verdict.question_id, verdict]));
  for (const row of rows) {
    const verdict = byId.get(row.id);
    if (!verdict) continue;
    const candidate = { ...verdict, subject, basis };
    if (!signatureMatches(candidate, secret)) continue;
    if (candidate.input_hash !== practiceInputHash(row, row.ev_sig, row.ev_prov)) continue;
    if (verdict.eligible === true) {
      const expires = Date.parse(verdict.expires_at);
      if (!(expires > now)) continue; // the record's own expiry; the evidence read decides
    }
    trusted.set(row.id, { eligible: verdict.eligible === true, expires_at: isoOrNull(verdict.expires_at) });
  }
  return trusted;
}

// ---------------------------------------------------------------------------------------------
// Write side (scripts/practice-verdict-build.mjs, the daily cron)
// ---------------------------------------------------------------------------------------------

/** Passage text onto passage children, the one implementation the practice reader (data/db.js) and the build share. */
export async function attachPassageMetadata(db, rows, { warn = () => {} } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const groupIds = Array.from(new Set(list.map((row) => row.passage_group_id || row.group_id || null).filter(Boolean)));
  if (groupIds.length === 0) return list;
  const { data, error } = await db.from('passage_groups').select('id, subject, chapter, title, passage_text, passage_type, status, discoverable').in('id', groupIds);
  if (error) {
    if (error.code === '42P01' || error.code === '42703' || /passage_groups|schema cache|does not exist/i.test(error.message || '')) {
      warn(error);
      return list;
    }
    throw error;
  }
  const byId = new Map((data || []).filter((group) => group?.status === 'live' && group?.discoverable !== false).map((group) => [group.id, group]));
  return list.map((row) => {
    const group = byId.get(row.passage_group_id || row.group_id);
    if (!group) return row;
    return {
      ...row,
      passage_group_id: row.passage_group_id || group.id,
      passage_id: row.passage_id || group.id,
      passage_text: row.passage_text || group.passage_text,
      passage_title: row.passage_title || group.title,
      passage_type: row.passage_type || group.passage_type,
    };
  });
}

const MANAGED_BUILD_SELECT = [...PRACTICE_QUESTION_COLUMNS, 'ev_sig:evidence->>signature', 'ev_prov:provenance'].join(',');

async function readManagedForBuild(db, subject) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.from('questions').select(MANAGED_BUILD_SELECT).eq('subject', subject).eq('is_deleted', false)
      .or(PRACTICE_MANAGED_FILTER).order('id').range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function readExistingForBuild(db, subject) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.from(PRACTICE_VERDICT_TABLE).select('question_id,eligible,expires_at,input_hash,basis').eq('subject', subject)
      .order('question_id').range(offset, offset + PAGE - 1);
    if (error) {
      if (MISSING_TABLE.has(error.code)) return { rows: [], tableMissing: true };
      throw error;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return { rows, tableMissing: false };
}

/**
 * Brings one subject's verdicts up to date: reads its evidence-managed questions without their
 * evidence, keeps every verdict that still matches, and reads the evidence (select only) of just the
 * questions that need a new one: new, changed, a different basis, or an eligible verdict that
 * expires within renewWithinMs. Then upserts the new rows and removes rows of questions that are gone.
 * `write: false` is a dry run. Returns counts; never reads another subject.
 */
export async function refreshPracticeVerdicts(db, subject, {
  secret, now = Date.now(), write = true, attachPassages = (rows) => attachPassageMetadata(db, rows),
  renewWithinMs = PRACTICE_VERDICT_RENEW_MS, snapshot = sharedEligibilitySnapshot(),
} = {}) {
  if (!secret) return { subject, status: 'skipped', reason: 'no_signing_key' };
  if (process.env.CUET_EVIDENCE_SIGNING_KEY !== secret) throw new Error('the signing key passed in is not the one evidence is verified with (CUET_EVIDENCE_SIGNING_KEY)');
  const basis = practiceVerdictBasis();
  if (!basis) return { subject, status: 'skipped', reason: 'registry_unreadable' };
  const existing = await readExistingForBuild(db, subject);
  // A dry run may count what a first build would do before the migration is applied; a real run may not.
  if (existing.tableMissing && write) return { subject, status: 'skipped', reason: 'verdict_table_missing' };
  const managed = await attachPassages(await readManagedForBuild(db, subject));
  const current = new Map(existing.rows.map((row) => [row.question_id, row]));
  const due = [];
  let keep = 0;
  for (const row of managed) {
    const hash = practiceInputHash(row, row.ev_sig, row.ev_prov);
    const old = current.get(row.id);
    const stillGood = old && old.basis === basis && old.input_hash === hash
      && (old.eligible !== true || Date.parse(old.expires_at) > now + renewWithinMs);
    if (stillGood) keep += 1; else due.push({ row, hash });
  }
  const entries = [];
  let changedMeanwhile = 0;
  let evidenceBytes = 0;
  for (let i = 0; i < due.length; i += EVIDENCE_CHUNK) {
    const chunk = due.slice(i, i + EVIDENCE_CHUNK);
    const { data, error } = await db.from('questions').select('id,evidence').in('id', chunk.map((item) => item.row.id));
    if (error) throw error;
    const evidenceById = new Map((data || []).map((item) => [item.id, item.evidence ?? null]));
    evidenceBytes += Buffer.byteLength(JSON.stringify(data || []));
    for (const { row, hash } of chunk) {
      const evidence = evidenceById.get(row.id) ?? null;
      const signature = evidence?.signature === undefined || evidence?.signature === null ? null : String(evidence.signature);
      // The question changed between the two reads: leave it for the next run rather than sign a mixed picture.
      if (signature !== (row.ev_sig ?? null)) { changedMeanwhile += 1; continue; }
      const full = { ...row, evidence, provenance: row.ev_prov ?? null };
      delete full.ev_sig; delete full.ev_prov;
      const verdict = publicationEligibility(full, snapshot);
      const entry = {
        question_id: row.id,
        subject,
        eligible: verdict.eligible === true,
        expires_at: isoOrNull(evidence?.record?.expires_at),
        input_hash: hash,
        basis,
        verified_at: new Date(now).toISOString(),
      };
      entries.push({ ...entry, signature: signPracticeVerdict(entry, secret) });
    }
  }
  const managedIds = new Set(managed.map((row) => row.id));
  const stale = existing.rows.map((row) => row.question_id).filter((id) => !managedIds.has(id));
  let written = 0;
  let removed = 0;
  if (write) {
    for (let i = 0; i < entries.length; i += UPSERT_CHUNK) {
      const { error } = await db.from(PRACTICE_VERDICT_TABLE).upsert(entries.slice(i, i + UPSERT_CHUNK), { onConflict: 'question_id' });
      if (error) throw error;
      written += Math.min(UPSERT_CHUNK, entries.length - i);
    }
    for (let i = 0; i < stale.length; i += DELETE_CHUNK) {
      const { error } = await db.from(PRACTICE_VERDICT_TABLE).delete().in('question_id', stale.slice(i, i + DELETE_CHUNK));
      if (error) throw error;
      removed += Math.min(DELETE_CHUNK, stale.length - i);
    }
  }
  return {
    subject, status: 'ok', managed: managed.length, kept: keep, rebuilt: entries.length, eligible: entries.filter((entry) => entry.eligible).length,
    skippedChangedMeanwhile: changedMeanwhile, stale: stale.length, written, removed, evidenceBytes, dryRun: !write, basis,
  };
}

/** The daily pass: each evidence-managed subject in turn; one failing never stops the next. */
export async function refreshAllPracticeVerdicts(db, { secret, subjects = PRACTICE_VERDICT_SUBJECTS, write = true, log = console.warn, now = Date.now(), deadlineMs = 200000, clock = () => Date.now() } = {}) {
  if (!secret) return { status: 'skipped', reason: 'no_signing_key', subjects: [] };
  const started = clock();
  const results = [];
  for (const subject of subjects) {
    if (clock() - started > deadlineMs) { results.push({ subject, status: 'skipped', reason: 'out_of_time' }); continue; }
    try {
      const result = await refreshPracticeVerdicts(db, subject, { secret, write, now });
      results.push(result);
      if (result.reason === 'verdict_table_missing') return { status: 'skipped', reason: 'verdict_table_missing', subjects: [] };
    } catch (error) {
      log(`[practice-verdicts] refresh of ${subject} failed: ${error?.message || error}`);
      results.push({ subject, status: 'error', error: String(error?.message || error) });
    }
  }
  return { status: results.some((result) => result.status === 'error') ? 'partial' : 'ok', subjects: results };
}

/** One log line: counts only. */
export function describePracticeVerdictRun(result, { ms = null } = {}) {
  const took = ms === null ? '' : ` in ${ms} ms`;
  if (!result || result.status === 'skipped') return `[practice-verdicts] daily refresh skipped${took}: ${result?.reason || 'unknown'}`;
  const parts = (result.subjects || []).map((entry) => (entry.status === 'ok'
    ? `${entry.subject} kept ${entry.kept} rebuilt ${entry.rebuilt}${entry.stale ? ` removed ${entry.removed}` : ''}`
    : `${entry.subject} ${entry.status}${entry.error ? `: ${entry.error}` : entry.reason ? `: ${entry.reason}` : ''}`));
  return `[practice-verdicts] daily refresh ${result.status}${took}: ${parts.join(', ')}`;
}
