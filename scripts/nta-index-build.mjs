// Builds the NTA pool index (supabase/migrations/20261013190000_nta_question_index.sql).
//
//   node --use-system-ca scripts/nta-index-build.mjs [--env .env.local] [--subject accountancy] [--out file.json]
//   node --use-system-ca scripts/nta-index-build.mjs --env .env.staging --write
//
// For every NTA subject it reads the live questions with their evidence records (select only), keeps
// those whose evidence passes the NTA score checks (data/nta_engine.js ntaScoreIntegrity: signed,
// names the question, unchanged content, not a mock run, both judges, both blind solvers on the key),
// and produces one signed slim row per question. The score bar is not applied here; the runtime does.
//
// Default is a dry run: nothing is written to any database; the rows' counts, sizes and timing go to
// --out (default tmp/nta-index-dry-run.json). --write upserts the rows into nta_question_index and
// removes that subject's rows that no longer verify; it refuses the production project unless
// --allow-production is also given (the owner's call, after the migration is applied).
// No model is called.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const envPath = option('--env', '.env.local');
const write = flag('--write');
const out = option('--out', 'tmp/nta-index-dry-run.json');
const onlySubject = option('--subject', null);
const PRODUCTION_REF = 'isrxrxzjocewrdureyhp';

function loadEnv(file) {
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}
const env = loadEnv(envPath);
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.STAGING_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
const secret = env.CUET_EVIDENCE_SIGNING_KEY || process.env.CUET_EVIDENCE_SIGNING_KEY || '';
if (!url || !key) throw new Error(`${envPath} has no Supabase URL or service-role key`);
if (!secret) throw new Error('CUET_EVIDENCE_SIGNING_KEY is required to verify evidence and sign index rows');
process.env.CUET_EVIDENCE_SIGNING_KEY = secret;
const projectRef = new URL(url).hostname.split('.')[0];
if (write && projectRef === PRODUCTION_REF && !flag('--allow-production')) {
  throw new Error('Refusing to write the production index without --allow-production (owner decision).');
}

const { CUET_PUBLIC_ALLOWED_SUBJECTS, toInternalSubjectId } = await import('../data/cuet_controls.js');
const { NTA_INDEX_VERSION, ntaScoreIntegrity, ntaScoreOf, signNtaIndex } = await import('../data/nta_engine.js');
const { loadNtaPoolFull, attachPassages, NTA_SLIM_COLUMNS } = await import('../data/nta_pool.js');
const { contentHash } = await import('../data/content_evidence.js');
const { objectiveTagOf } = await import('../data/nta_item_checks.js');

const db = createClient(url, key, { auth: { persistSession: false } });
const verifiedAt = new Date().toISOString();
const report = { generatedAt: verifiedAt, project: projectRef, write, indexVersion: NTA_INDEX_VERSION, subjects: [] };

for (const subject of CUET_PUBLIC_ALLOWED_SUBJECTS) {
  if (onlySubject && subject !== onlySubject) continue;
  const internal = toInternalSubjectId(subject);
  const started = Date.now();
  const pool = await attachPassages(db, await loadNtaPoolFull(db, internal));
  const fullMs = Date.now() - started;
  const rows = [];
  const rejected = {};
  for (const row of pool) {
    const { score, source, luna, gemini } = ntaScoreOf(row);
    if (source !== 'evidence_judges' || score === null) { rejected.no_evidence_score = (rejected.no_evidence_score || 0) + 1; continue; }
    const reasons = ntaScoreIntegrity(row, { secret });
    if (reasons.length) { for (const reason of reasons) rejected[reason] = (rejected[reason] || 0) + 1; continue; }
    const entry = {
      question_id: row.id,
      subject: internal,
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
  const fullBytes = Buffer.byteLength(JSON.stringify(pool));
  // What the runtime would read through the index: the slim rows plus the questions without evidence.
  const slimStarted = Date.now();
  let slimBytes = Buffer.byteLength(JSON.stringify(rows));
  const ids = rows.map((row) => row.question_id);
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from('questions').select(NTA_SLIM_COLUMNS).in('id', ids.slice(i, i + 300));
    if (error) throw error;
    slimBytes += Buffer.byteLength(JSON.stringify(data || []));
  }
  const slimMs = Date.now() - slimStarted;
  let written = 0;
  let removed = 0;
  if (write && rows.length) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from('nta_question_index').upsert(rows.slice(i, i + 500), { onConflict: 'question_id' });
      if (error) throw error;
      written += Math.min(500, rows.length - i);
    }
  }
  if (write) {
    const { data: existing, error } = await db.from('nta_question_index').select('question_id').eq('subject', internal);
    if (error) throw error;
    const keep = new Set(ids);
    const stale = (existing || []).map((row) => row.question_id).filter((id) => !keep.has(id));
    for (let i = 0; i < stale.length; i += 300) {
      const { error: deleteError } = await db.from('nta_question_index').delete().in('question_id', stale.slice(i, i + 300));
      if (deleteError) throw deleteError;
      removed += Math.min(300, stale.length - i);
    }
  }
  const summary = { subject, loaded: pool.length, indexed: rows.length, rejected, fullReadMs: fullMs, fullBytes, slimReadMs: slimMs, slimBytes, written, removed };
  report.subjects.push(summary);
  console.log(subject.padEnd(18), `loaded ${pool.length}`, `indexed ${rows.length}`, `full ${(fullBytes / 1e6).toFixed(2)} MB ${fullMs} ms`, `slim ${(slimBytes / 1e6).toFixed(2)} MB ${slimMs} ms`, write ? `written ${written} removed ${removed}` : '(dry run)');
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(`wrote ${out}`);
