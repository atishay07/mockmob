// Versioned, staging-only publication entry for CUET-fit v7 campaigns.
// Usage: node --use-system-ca scripts/pipeline/tools/publishCuetFitCampaignV76.mjs <campaign-dir> --staging
import { loadEnvFile } from 'node:process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { currentRegistry } from '../../../data/evidence_registry.js';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { inspectBeforeBulkPublish, publishInspectedUnit, withheldJobPatch } from '../lib/publishTimeInspection.mjs';
import { publishFactoryQuestion, publishFactoryGroup } from '../lib/factoryCore.mjs';
import { readBankSnapshot } from '../lib/bankSnapshot.mjs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { readCohortAccounting } from '../lib/cohortAccounting.mjs';

import { assertCuetFitPublicationQualificationV76, stagingControlLifecycleV76 } from '../lib/cuetFitPublicationV76.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
const STAGING_URL = 'https://onwkqxmjqjrhfbjjdydu.supabase.co';

export function qualifyCuetFitCampaignV76(options) {
  if (options.campaign?.measurement_only === true || options.campaign?.publication_policy !== 'released_staging_only') {
    throw Error('cuet_fit_v76_staging_profile_required');
  }
  const jobs = assertCuetFitPublicationQualificationV76(options);
  const { profile } = options;
  return { jobs, releaseRecord: { validation_topology: profile.topology, verifier_version: profile.verifier_version,
    checks: { blind_solution: { evaluation_prompt: profile.prompt_hash } } } };
}

export async function publishCuetFitCampaignV76({ profile, campaign, report, run, jobs, manifest, registry, db,
  directory, readInventory, eligible, publishQuestion: publishOne = publishFactoryQuestion,
  publishGroup = publishFactoryGroup, authorId, prepareTarget, cleanupTarget, now } = {}) {
  const qualified = qualifyCuetFitCampaignV76({ profile, campaign, report, run, jobs, manifest, registry });
  if (!db || !directory || typeof readInventory !== 'function' || !authorId) throw Error('cuet_fit_v76_staging_dependencies_required');
  process.env.CUET_CONTENT_AUTHOR_ID = authorId;

  // Check the whole set before any queue/control writes, then re-check each atomic
  // unit against the current bank immediately before its publication call.
  const whole = await inspectBeforeBulkPublish({ rows: qualified.jobs, readInventory, registry, eligible, directory, now });
  const receipts = [], groups = new Set();
  if (typeof prepareTarget !== 'function' || typeof cleanupTarget !== 'function') throw Error('cuet_fit_v76_staging_lifecycle_required');
  try { await prepareTarget(qualified.jobs); for (const job of qualified.jobs) {
    const groupId = job.candidate.passage_group_id;
    if (groupId && groups.has(groupId)) continue;
    const unit = groupId ? qualified.jobs.filter(row => row.candidate.passage_group_id === groupId) : [job];
    const outcome = await publishInspectedUnit({ rows: unit, readInventory, registry, eligible,
      publish: rows => groupId ? publishGroup(rows.map(row => row.candidate), db, registry) : publishOne(job.candidate, job.id, db) });
    if (outcome.status !== 'published') {
      if (outcome.status === 'withheld') {
        for (const row of unit) {
          const patch = withheldJobPatch(row, outcome);
          const { error } = await db.from('question_factory_jobs').update(patch).eq('id', row.id);
          if (error) throw Error(`cuet_fit_v76_withhold_persist_failed:${error.code || 'unknown'}`);
        }
        throw Error(`cuet_fit_v76_publish_time_withheld:${unit.map(row => row.id).join(',')}`);
      }
      throw Error(`cuet_fit_v76_publish_time_inspection_failed:${outcome.error}`);
    }
    if (groupId) groups.add(groupId);
    receipts.push({ ids: unit.map(row => row.id), receipt: outcome.receipt, at: new Date().toISOString() });
    write(`${directory}/publication-progress-v76.json`, receipts);
  } } finally { await cleanupTarget(); }
  return { status: 'published', inspection: whole.record, receipts };
}

async function main() {
  const directory = process.argv[2];
  if (!process.argv.includes('--staging') || !directory ||
      !resolve(directory).startsWith(resolve('artifacts/question-factory') + '\\')) throw Error('explicit_cuet_fit_staging_campaign_required');
  if (!existsSync('.env.staging')) throw Error('staging_credentials_required');
  loadEnvFile('.env.staging');
  if (process.env.STAGING_SUPABASE_URL !== STAGING_URL || !process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) throw Error('wrong_staging_project');
  const campaign = read(`${directory}/campaign.json`), profile = read(`${directory}/verification-profile.json`);
  const run = read(`${directory}/publication-run-v76.json`);
  const report = read(`${directory}/batch-report.json`), allJobs = read(`${directory}/all-candidates.json`);
  const registry = currentRegistry(), manifest = read('data/calibration_manifest.json');
  const inspection = read(`${directory}/batch-inspection.json`);
  if (inspection.content_hash !== hashJSON(allJobs.map(job => ({ id: job.id, candidate: job.candidate, result: job.result }))) || inspection.ready !== true) {
    throw Error('cuet_fit_v76_saved_batch_inspection_required');
  }
  const approvedJobs = allJobs.filter(job => ['eligible', 'published'].includes(job.state));
  qualifyCuetFitCampaignV76({ profile, campaign, report, run, jobs: approvedJobs, manifest, registry });
  const ledger = new BudgetLedger(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite');
  let accounting;
  try { ledger.assertHistoryReconciled(); accounting = readCohortAccounting(ledger, allJobs); }
  finally { ledger.close(); }
  if (!accounting.ready || accounting.settled !== true) throw Error('cuet_fit_v76_live_accounting_not_ready');
  const db = createClient(STAGING_URL, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: owner, error: ownerError } = await db.from('users').select('id,role').eq('id', process.env.CUET_CONTENT_AUTHOR_ID).single();
  if (ownerError || owner?.role !== 'admin') throw Error('existing_staging_admin_required');

  const readInventory = () => readBankSnapshot(db);
  const control = await stagingControlLifecycleV76(db);
  const result = await publishCuetFitCampaignV76({ profile, campaign, report: { ...report, publication_accounting: accounting }, run, jobs: approvedJobs,
    manifest, registry, db, directory, readInventory, authorId: owner.id,
    prepareTarget: async qualifiedJobs => {
      for (const job of allJobs) {
        const { error } = await db.from('question_factory_jobs').upsert({ id: job.id, subject: job.subject,
          chapter: job.candidate?.chapter || job.chapter, anchor_id: null, kind: job.kind, generation_brief: job,
          state: job.state, stage: 'complete', candidate: job.candidate, result: job.result,
          passage_group_id: job.passage_group_id || null });
        if (error) throw Error(`cuet_fit_v76_staging_job_import:${error.code || 'unknown'}`);
      }
      await control.enable();
    },
    cleanupTarget: control.restore });
  write(`${directory}/publication-v76.json`, { at: new Date().toISOString(), staging: true,
    project_ref: 'onwkqxmjqjrhfbjjdydu', release_record: qualifyCuetFitCampaignV76({ profile, campaign, report: { ...report, publication_accounting: accounting }, run, jobs: approvedJobs, manifest, registry }).releaseRecord,
    receipts: result.receipts, production_writes: 0 });
  console.log(JSON.stringify({ status: result.status, published_units: result.receipts.length, staging: true, production_writes: 0 }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
