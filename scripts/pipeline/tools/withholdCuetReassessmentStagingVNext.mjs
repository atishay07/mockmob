import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { readBankSnapshot } from '../lib/bankSnapshot.mjs';
import { buildStagingWithholdingSelection, createEmptyStagingWithholdingJournal, preflightStagingRows, applyStagingWithholding } from '../lib/reassessmentWithholdingStagingVNext.mjs';

const args = new Set(process.argv.slice(2));
assert(args.has('--staging'), 'explicit_--staging_required');
assert(!args.has('--production'), 'production_mode_forbidden');
for (const arg of args) assert(['--staging', '--apply'].includes(arg), `unknown_argument:${arg}`);
if (existsSync('.env.local')) loadEnvFile('.env.local');
if (existsSync('.env.staging')) loadEnvFile('.env.staging');
const root = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution/reassessment/snapshot-20261008T060712941Z');
const exportBytes = readFileSync(resolve(root, 'bank-reassessment-export.json'));
const planBytes = readFileSync(resolve(root, 'dry-run-withholding-plan.json'));
const exportData = JSON.parse(exportBytes);
const planData = JSON.parse(planBytes);
const sourceHashes = {
  export_sha256: createHash('sha256').update(exportBytes).digest('hex'),
  plan_sha256: createHash('sha256').update(planBytes).digest('hex'),
};
const exportPath = resolve(root, 'staging-withholding-journal.json');
const url = process.env.STAGING_SUPABASE_URL;
assert.equal(url, 'https://onwkqxmjqjrhfbjjdydu.supabase.co', 'staging_project_url_mismatch');
assert.ok(process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, 'staging_service_role_key_required');
const db = createClient(url, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false }, global: { fetch: (u, init = {}) => fetch(u, { ...init, signal: AbortSignal.timeout(30000) }) } });
const adapter = {
  readBankSnapshot: () => readBankSnapshot(db),
  readJobs: async ids => {
    const { data, error } = await db.from('question_factory_jobs').select('id').in('id', ids);
    if (error) throw error;
    return data;
  },
  readQuestions: async ids => {
    const { data, error } = await db.from('questions').select('id,status,verification_state,exploration_state').in('id', ids);
    if (error) throw error;
    return data;
  },
  withholdQuestions: (ids, update) => db.from('questions').update(update).in('id', ids),
  recordDispute: args => db.rpc('record_question_dispute', args),
  readDispute: async id => {
    const { data, error } = await db.from('question_content_disputes').select('question_id,content_hash,receipt').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },
  quarantineJobs: (ids, update) => db.from('question_factory_jobs').update(update).in('id', ids),
};
const journal = existsSync(exportPath) ? JSON.parse(readFileSync(exportPath, 'utf8')) : createEmptyStagingWithholdingJournal();
const saveJournal = value => {
  const temp = `${exportPath}.tmp`;
  const fd = openSync(temp, 'w');
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, exportPath);
};

const selection = buildStagingWithholdingSelection(exportData, planData, sourceHashes);
const rows = await adapter.readBankSnapshot();
const preview = preflightStagingRows(selection, rows);
const jobRows = await adapter.readJobs(selection.ids);
assert.deepEqual(jobRows.map(row => row.id).sort(), selection.ids, 'staging_job_id_set_mismatch');
if (!args.has('--apply')) {
  console.log(JSON.stringify({ mode: 'dry_run', staging_project: 'onwkqxmjqjrhfbjjdydu', total_preflighted: selection.expected_total, extra_unchanged_rows: preview.extra_unchanged_count, withheld_questions: selection.ids.length, affected_passage_groups: preview.group_count, export_sha256: sourceHashes.export_sha256, plan_sha256: sourceHashes.plan_sha256, exact_export_ids_content_hashes_and_group_membership: true, writes: 0, command_to_apply: 'node scripts/pipeline/tools/withholdCuetReassessmentStagingVNext.mjs --staging --apply' }, null, 2));
} else {
  const result = await applyStagingWithholding({ exportData, planData, sourceHashes, db: adapter, journal, saveJournal });
  console.log(JSON.stringify({ mode: 'applied_staging_only', staging_project: 'onwkqxmjqjrhfbjjdydu', ...result, journal: exportPath }, null, 2));
}
