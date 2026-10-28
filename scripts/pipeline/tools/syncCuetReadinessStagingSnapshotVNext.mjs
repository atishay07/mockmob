import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnvFile } from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import { factoryCostReport } from '../lib/factoryCosts.mjs';
import {
  CUET_READINESS_BASELINE_ID,
  CUET_READINESS_IMPROVED_ID,
  CUET_READINESS_STAGING_PROJECT_REF,
  buildCuetReadinessStagingSnapshotVNext,
  buildStagingSnapshotUpdatePatchVNext,
  summarizeRegisteredCampaignVNext,
} from '../lib/cuetReadinessStagingSnapshotVNext.mjs';

const STAGING_URL = `https://${CUET_READINESS_STAGING_PROJECT_REF}.supabase.co`;
const EXECUTION_DIR = 'artifacts/question-factory/cuet-readiness-2026-10-08/execution';
const BANK_EXPORT = `${EXECUTION_DIR}/reassessment/snapshot-20261008T060712941Z/bank-reassessment-export.json`;
const EXPECTED = {
  [CUET_READINESS_BASELINE_ID]: { id: CUET_READINESS_BASELINE_ID, verifier: 'cuet-fit-validator-v7.1' },
  [CUET_READINESS_IMPROVED_ID]: { id: CUET_READINESS_IMPROVED_ID, verifier: 'cuet-fit-validator-v7.2' },
};
const CONTROL_KEYS = ['id', 'paused', 'phase', 'publication_enabled', 'worker_id', 'lease_until', 'pilot_target', 'updated_at'];

function parseArgs(argv) {
  let stagingRef = null;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--staging') stagingRef = argv[++i] ?? null;
    else if (argv[i] === '--apply') apply = true;
    else throw new Error(`unsupported_argument:${argv[i]}`);
  }
  if (stagingRef !== CUET_READINESS_STAGING_PROJECT_REF) throw new Error('exact_staging_project_flag_required');
  return { stagingRef, apply };
}

function readJson(path) { return JSON.parse(readFileSync(resolve(path), 'utf8')); }
function selectControl(row) {
  return Object.fromEntries(CONTROL_KEYS.filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]));
}

function openConsistentLedgerRead(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  db.exec('PRAGMA query_only=ON; PRAGMA busy_timeout=10000; BEGIN DEFERRED');
  try {
    const ledger = { db };
    const budgetRow = db.prepare(`SELECT limit_micro,
      COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserved,COALESCE(actual,0)) END),0) committed_micro,
      COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE 0 END),0) settled_micro,
      COALESCE(SUM(CASE WHEN state<>'settled' THEN MAX(reserved,COALESCE(actual,0)) ELSE 0 END),0) held_micro,
      COUNT(*) requests,
      COALESCE(SUM(CASE WHEN state='unresolved' THEN 1 ELSE 0 END),0) unresolved
      FROM requests CROSS JOIN budget WHERE budget.id=1`).get();
    const unbounded = db.prepare(`SELECT COUNT(*) n FROM requests r LEFT JOIN conservative_holds h ON h.reservation_id=r.id
      WHERE r.state='unresolved' AND (h.reservation_id IS NULL OR h.maximum_micro<>r.reserved OR r.actual>r.reserved)`).get().n;
    const holdCount = db.prepare(`SELECT COUNT(*) n FROM requests r JOIN conservative_holds h ON h.reservation_id=r.id
      WHERE r.state='unresolved' AND h.maximum_micro=r.reserved AND (r.actual IS NULL OR r.actual<=r.reserved)`).get().n;
    const history = Boolean(db.prepare("SELECT 1 FROM ledger_metadata WHERE id='history'").get());
    const workerRow = db.prepare('SELECT owner,expires FROM factory_worker WHERE id=1').get();
    const globalWorkerPid = Number(workerRow?.owner?.split(':')[0]) || null;
    const activeMeasurementLeases = db.prepare("SELECT COUNT(*) n FROM factory_measurement_leases_vnext WHERE state='active'").get().n;
    const queuedBatches = db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state IN ('queued','dispatching')").get().n;
    const dispatchingRequests = db.prepare("SELECT (SELECT COUNT(*) FROM provider_requests WHERE state='dispatching') + (SELECT COUNT(*) FROM provider_batches WHERE state='dispatching') n").get().n;
    const budget = { ...budgetRow, unbounded_unresolved: unbounded, conservative_hold_count: holdCount };
    const costs = factoryCostReport(ledger);

    const campaigns = {};
    for (const [campaignId, expectation] of Object.entries(EXPECTED)) {
      const registration = readJson(`artifacts/question-factory/${campaignId}/campaign.json`);
      if (registration.id !== campaignId) throw new Error('registered_campaign_path_mismatch');
      const ids = registration.jobs.map(job => job.id);
      const saved = db.prepare(`SELECT id,value FROM factory_candidates WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
        .map(row => { const value = JSON.parse(row.value); return { id: row.id, state: value.state, candidate: Boolean(value.candidate) }; });
      campaigns[campaignId] = summarizeRegisteredCampaignVNext(registration, saved, expectation);
    }
    const reassessment = readJson(BANK_EXPORT);
    if (reassessment.schema !== 'cuet-bank-reassessment-export-v1' || reassessment.run?.verifier !== 'cuet-fit-validator-v7.2' ||
        reassessment.run?.topology !== 'dual_blind' || reassessment.scoped_cost?.cost_reconciled !== true) throw new Error('bank_reassessment_export_contract_mismatch');
    const bank = {
      id: 'bank-reassessment-662-2026-10-08',
      captured_at: reassessment.captured_at,
      complete: reassessment.run.complete,
      denominator: reassessment.run.denominator,
      terminal: reassessment.run.terminal,
      eligible: reassessment.run.eligible,
      rejected: reassessment.run.quarantined,
      pending: reassessment.run.pending,
      provider_errors: reassessment.run.provider_errors,
      verifier: reassessment.run.verifier,
      contract: reassessment.run.contract,
      publication: reassessment.run.publication,
      scoped_cost: reassessment.scoped_cost,
    };
    const at = new Date().toISOString();
    return {
      db,
      at,
      history,
      liveWorkAtRead: { globalWorkerPid, globalWorkerLeaseExpires: workerRow?.expires ?? null, activeMeasurementLeases, queuedBatches, dispatchingRequests },
      budget,
      costs,
      baseline: campaigns[CUET_READINESS_BASELINE_ID],
      comparison: campaigns[CUET_READINESS_IMPROVED_ID],
      bank,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
}

export async function syncCuetReadinessStagingSnapshotVNext(argv = process.argv.slice(2)) {
  const { stagingRef, apply } = parseArgs(argv);
  loadEnvFile('.env.local');
  loadEnvFile('.env.staging');
  const url = process.env.STAGING_SUPABASE_URL;
  if (url !== STAGING_URL || stagingRef !== CUET_READINESS_STAGING_PROJECT_REF) throw new Error('staging_project_identity_mismatch');
  if (!process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY) throw new Error('staging_service_role_required');

  const ledgerPath = resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite');
  const ledger = openConsistentLedgerRead(ledgerPath);
  let db = ledger.db;
  try {
    const client = createClient(url, process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: before, error: readError } = await client.from('question_factory_control').select('*').eq('id', 1).single();
    if (readError || !before) throw new Error('staging_control_read_failed');
    const snapshot = buildCuetReadinessStagingSnapshotVNext({
      projectRef: stagingRef,
      previousSnapshot: before.snapshot || {},
      budget: ledger.budget,
      costs: ledger.costs,
      baseline: ledger.baseline,
      comparison: ledger.comparison,
      bank: ledger.bank,
      historicalReconciled: ledger.history,
      at: ledger.at,
    });
    const patch = buildStagingSnapshotUpdatePatchVNext(snapshot, ledger.at);
    const controlsBefore = selectControl(before);
    const proof = {
      at: ledger.at,
      mode: apply ? 'apply_requested' : 'dry_run',
      project_ref: stagingRef,
      project_url: url,
      ledger_path: ledgerPath,
      source_snapshot_at: before.updated_at,
      cas_column: 'updated_at',
      row_before_all_columns: before,
      controls_before: controlsBefore,
      proposed_snapshot: snapshot,
      proposed_patch_keys: Object.keys(patch),
      budget: ledger.budget,
      campaign_counts: { baseline: ledger.baseline, comparison: ledger.comparison },
      bank_reassessment: ledger.bank,
      sqlite_snapshot_consistent: true,
      staging_writes: 0,
      production_writes: 0,
      question_or_student_or_payment_writes: 0,
      provider_calls: 0,
      live_work_at_read: ledger.liveWorkAtRead,
    };

    const historyPath = resolve(`${EXECUTION_DIR}/staging-snapshot-vnext-history.jsonl`);
    mkdirSync(resolve(EXECUTION_DIR), { recursive: true });
    appendFileSync(historyPath, `${JSON.stringify({ at: ledger.at, phase: 'before', operation_requested: apply ? 'apply' : 'dry_run', project_ref: stagingRef, row_before_all_columns: before })}\n`);
    if (apply) {
      const { data: updated, error: updateError } = await client.from('question_factory_control').update(patch)
        .eq('id', 1).eq('updated_at', before.updated_at).select('*').maybeSingle();
      if (updateError) throw new Error('staging_snapshot_cas_update_failed');
      if (!updated) {
        proof.mode = 'concurrent_update_skipped';
        appendFileSync(historyPath, `${JSON.stringify({ at: ledger.at, phase: 'after', outcome: proof.mode })}\n`);
      }
      else {
        const controlsAfter = selectControl(updated);
        const controlDeltas = Object.keys(controlsBefore).filter(key => !['id', 'updated_at'].includes(key) &&
          JSON.stringify(controlsBefore[key]) !== JSON.stringify(controlsAfter[key]));
        proof.mode = 'applied';
        proof.controls_after = controlsAfter;
        proof.control_deltas_observed = controlDeltas;
        proof.controls_written_by_sync = false;
        proof.row_after_all_columns = updated;
        proof.staging_writes = 1;
        appendFileSync(historyPath, `${JSON.stringify({ at: ledger.at, phase: 'after', outcome: proof.mode, row_after_all_columns: updated })}\n`);
      }
    }

    mkdirSync(resolve(EXECUTION_DIR), { recursive: true });
    writeFileSync(resolve(`${EXECUTION_DIR}/staging-snapshot-vnext-proof.json`), `${JSON.stringify(proof, null, 2)}\n`);
    return proof;
  } finally {
    try { db.exec('ROLLBACK'); } catch { /* transaction may already have been closed by the driver */ }
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const proof = await syncCuetReadinessStagingSnapshotVNext();
  console.log(JSON.stringify({
    mode: proof.mode,
    at: proof.at,
    project_ref: proof.project_ref,
    controls_before: proof.controls_before,
    budget: proof.budget,
    live_work_at_read: proof.live_work_at_read,
    campaign_counts: Object.fromEntries(Object.entries(proof.campaign_counts).map(([name, arm]) => [name, {
      id: arm.id, terminal: arm.terminal, eligible: arm.eligible, rejected: arm.rejected, pending: arm.pending, complete: arm.complete,
    }])),
    bank_reassessment: { id: proof.bank_reassessment.id, denominator: proof.bank_reassessment.denominator, eligible: proof.bank_reassessment.eligible, rejected: proof.bank_reassessment.rejected },
    proposed_patch_keys: proof.proposed_patch_keys,
    proof_path: `${EXECUTION_DIR}/staging-snapshot-vnext-proof.json`,
  }));
}
