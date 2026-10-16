// Builds the practice verdicts (supabase/migrations/20261016160000_practice_verdict_index.sql).
//
//   node --use-system-ca scripts/practice-verdict-build.mjs [--env .env.local] [--subject accountancy] [--out file.json]
//   node --use-system-ca scripts/practice-verdict-build.mjs --env .env.staging --write
//
// For every evidence-managed subject it reads the questions that carry an evidence or provenance record, WITHOUT
// the evidence (about 1.3 MB for the four factory subjects), keeps every stored verdict that still matches, and
// reads the evidence (select only) of just the questions that need a new one. Each verdict is publicationEligibility
// on the full row, signed with CUET_EVIDENCE_SIGNING_KEY and bound to the question's content, evidence signature,
// provenance and the registry shipped in data/ (data/practice_verdicts.js). Counts, bytes and timing go to --out.
//
// Default is a dry run: it reads the existing verdict table (if there is one yet) and writes nothing. --write upserts
// the new rows and removes rows of questions that are gone; it refuses the production project unless
// --allow-production is also given (after the migration is applied). The daily cron
// (/api/internal/refresh-inventory) runs the same refresh. No model is called.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const envPath = option('--env', '.env.local');
const write = flag('--write');
const out = option('--out', 'tmp/practice-verdict-dry-run.json');
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
if (!secret) throw new Error('CUET_EVIDENCE_SIGNING_KEY is required to verify evidence and sign verdicts');
process.env.CUET_EVIDENCE_SIGNING_KEY = secret;
const projectRef = new URL(url).hostname.split('.')[0];
if (write && projectRef === PRODUCTION_REF && !flag('--allow-production')) {
  throw new Error('Refusing to write the production verdicts without --allow-production (owner decision).');
}

const { PRACTICE_VERDICT_SUBJECTS, refreshPracticeVerdicts } = await import('../data/practice_verdicts.js');

const db = createClient(url, key, { auth: { persistSession: false } });
const report = { generatedAt: new Date().toISOString(), project: projectRef, write, subjects: [] };
for (const subject of PRACTICE_VERDICT_SUBJECTS) {
  if (onlySubject && subject !== onlySubject) continue;
  const started = Date.now();
  const result = await refreshPracticeVerdicts(db, subject, { secret, write });
  const summary = { ...result, ms: Date.now() - started };
  report.subjects.push(summary);
  console.log(subject.padEnd(18), summary.status === 'ok'
    ? `managed ${summary.managed} kept ${summary.kept} to build ${summary.rebuilt} (eligible ${summary.eligible}) evidence read ${(summary.evidenceBytes / 1e6).toFixed(2)} MB ${summary.ms} ms ${write ? `written ${summary.written} removed ${summary.removed}` : '(dry run)'}`
    : `${summary.status}: ${summary.reason || ''}`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(`wrote ${out}`);
