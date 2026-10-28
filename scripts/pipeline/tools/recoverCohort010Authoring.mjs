// Explicit cache/receipt-only recovery for the frozen legacy cohort 010.
// Default mode writes only a local dry-run journal. --apply is a separate,
// guarded SQLite transaction and is not used while another campaign is live.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createFactoryTransport, responseJSON } from '../lib/factoryTransport.mjs';
import { validationContract } from '../lib/compactBenchmark.mjs';
import { FACTORY_VERIFIER_VERSION } from '../lib/factoryEvidence.mjs';
import { applyCohort010Recovery, assertNoLiveCohort010Leases, COHORT010_ALLOWLIST, COHORT010_CAMPAIGN_SHA256, COHORT010_LEGACY_EXPORT_SHA256, COHORT010_V62_CONTRACT_HASH, materializeCohort010Candidate, planCohort010Recovery, sha256 } from '../lib/cohort010Recovery.mjs';

const cohortDir = 'artifacts/question-factory/cost-native-cohort-010';
const outputDir = 'artifacts/question-factory/cuet-readiness-2026-10-08/recovery';
const campaignPath = `${cohortDir}/campaign.json`;
const ledgerPath = process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite';
const applyMode = process.argv.includes('--apply');
const ledger = new DatabaseSync(ledgerPath, { readOnly: !applyMode });
const campaignBytes = readFileSync(campaignPath);
const campaign = JSON.parse(campaignBytes);
const registration = JSON.parse(readFileSync(`${cohortDir}/benchmark.json`, 'utf8')).registration;
const registryBytes = readFileSync(`${cohortDir}/registry.json`);
const registry = JSON.parse(registryBytes);
const oldExportBytes = readFileSync(`${cohortDir}/approved-records.json`);
if (sha256(campaignBytes) !== COHORT010_CAMPAIGN_SHA256) throw new Error('cohort010_campaign_hash_mismatch');
if (sha256(oldExportBytes) !== COHORT010_LEGACY_EXPORT_SHA256) throw new Error('cohort010_legacy_export_hash_mismatch');
if (registration?.contract_hash !== COHORT010_V62_CONTRACT_HASH || validationContract() !== COHORT010_V62_CONTRACT_HASH) throw new Error('cohort010_legacy_contract_hash_mismatch');
if (registry.version !== campaign.registry_version) throw new Error('cohort010_frozen_registry_version_mismatch');
if (campaign.verifier !== FACTORY_VERIFIER_VERSION) throw new Error('cohort010_legacy_verifier_version_mismatch');

const hasTable = name => ledger.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
if (!hasTable('factory_candidates') || !hasTable('provider_batches') || !hasTable('requests')) throw new Error('cohort010_required_ledger_tables_missing');
const jobRows = ledger.prepare(`SELECT id,value FROM factory_candidates WHERE id IN (${COHORT010_ALLOWLIST.map(()=>'?').join(',')})`).all(...COHORT010_ALLOWLIST.map(x=>x.candidate_id));
const jobsById = new Map(jobRows.map(row => [row.id, JSON.parse(row.value)]));
const requestRows = ledger.prepare(`SELECT p.id AS request_key,p.provider,p.provider_id,p.state AS provider_state,p.request_json,p.response_json,
  r.id AS reservation_id,r.model,r.state AS request_state,r.actual,r.receipt_json
  FROM provider_batches p JOIN requests r ON r.id=p.reservation_id WHERE p.id IN (${COHORT010_ALLOWLIST.map(()=>'?').join(',')})`).all(...COHORT010_ALLOWLIST.map(x=>x.request_key));
const receiptsByKey = new Map(requestRows.map(row => {
  const saved = JSON.parse(row.request_json), config = saved.config || {};
  let ledgerReceipt = null; try { ledgerReceipt = row.receipt_json ? JSON.parse(row.receipt_json) : null; } catch { /* malformed receipt remains a hard failure below */ }
  const refusal = ledgerReceipt?.error || ledgerReceipt || {};
  return [row.request_key, { request_key: row.request_key, reservation_id: row.reservation_id, provider: row.provider, model: row.model,
    provider_id: row.provider_id, provider_state: row.provider_state, request_state: row.request_state,
    candidate_id: config.candidate_id || null, purpose: config.purpose || null, stage: config.stage || null,
    body: saved.body, body_sha256: sha256(JSON.stringify(saved.body)), response: row.response_json ? JSON.parse(row.response_json) : null,
    http_status: ledgerReceipt?.http_status || refusal.http_status || null, receipt_error: ledgerReceipt?.error || refusal, actual_micro: row.actual }];
}));

let fetchCalls = 0, transportCalls = [], rejectedAttempts = [];
const readOnlyLedgerFacade = { db: ledger,
  getCache(key) { const row = ledger.prepare('SELECT value FROM cache WHERE id=?').get(key); return row ? JSON.parse(row.value) : null; },
  assertHistoryReconciled() { throw new Error('recovery_must_not_prepare_or_dispatch_new_request'); } };
const nativeTransport = createFactoryTransport({ ledger: readOnlyLedgerFacade, env: {},
  prices: () => { throw new Error('recovery_must_not_read_pricing_for_saved_response'); },
  fetchImpl: async () => { fetchCalls++; throw new Error('recovery_network_call_blocked'); } });
const plan = await planCohort010Recovery({ campaign, campaignSha256: sha256(campaignBytes), registration, jobsById, receiptsByKey,
  materialize: async (job, allowed, prior) => {
    if (!COHORT010_ALLOWLIST.some(entry => entry.request_key === allowed.request_key && entry.candidate_id === job.id && entry.body_sha256 === prior.body_sha256)) {
      rejectedAttempts.push({ request_key: allowed.request_key, reason: 'recovery_unallowlisted_key_or_body_blocked' });
      throw new Error('recovery_unallowlisted_key_or_body_blocked');
    }
    if (prior.provider !== 'openai' || prior.model !== 'gpt-6-luna' || sha256(JSON.stringify(prior.body)) !== allowed.body_sha256) throw new Error('recovery_saved_request_content_mismatch');
    transportCalls.push({ request_key: allowed.request_key, body_sha256: allowed.body_sha256, cache_only: true });
    const raw = await nativeTransport.generate('openai', prior.body, { key: allowed.request_key, stage: 'authoring', batch: true, cacheOnly: true });
    return materializeCohort010Candidate(job, registry, responseJSON(raw));
  } });
if (fetchCalls !== 0) throw new Error('recovery_network_call_detected');
if (transportCalls.some(row => !COHORT010_ALLOWLIST.some(entry => entry.request_key === row.request_key && entry.body_sha256 === row.body_sha256))) throw new Error('recovery_unallowlisted_request_seen');
const now = new Date().toISOString();
const journal = { schema: 'cohort-010-cache-only-recovery-journal-v1', created_at: now, mode: applyMode ? 'apply' : 'dry-run',
  provider_calls: 0, fetch_calls: fetchCalls, leases_acquired: false,
  frozen: { campaign_sha256: sha256(campaignBytes), legacy_export_sha256: sha256(oldExportBytes), v62_contract_hash: registration.contract_hash },
  counts: { planned: plan.length, replay_saved_response: plan.filter(x=>x.action==='replay_saved_response').length,
    quarantine_saved_response_candidate: plan.filter(x=>x.action==='quarantine_saved_response_candidate').length,
    quarantine_typed_refusal: plan.filter(x=>x.action==='quarantine_typed_refusal').length,
    retain_pending: plan.filter(x=>x.action==='retain_pending').length, already_recovered: plan.filter(x=>x.action==='already_recovered').length },
  transport_calls: transportCalls, rejected_attempts: rejectedAttempts, actions: plan.map(({candidate,...rest})=>({ ...rest, ...(candidate ? { candidate } : {}) })) };

mkdirSync(outputDir, { recursive: true });
if (applyMode) {
  assertNoLiveCohort010Leases(ledger);
  const backupPath = `${outputDir}/cohort-010-local-jobs-before-apply-${now.replace(/[:.]/g,'-')}.json`;
  const backup = { created_at: now, campaign_sha256: sha256(campaignBytes), jobs: plan.map(action => ({ id: action.candidate_id, old: jobsById.get(action.candidate_id) })) };
  writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { flag: 'wx' });
  journal.backup_path = backupPath;
  journal.apply_result = applyCohort010Recovery(ledger, plan);
  const outputPath = `${outputDir}/cohort-010-cache-only-recovery-applied.json`;
  writeFileSync(outputPath, `${JSON.stringify(journal, null, 2)}\n`);
  console.log(JSON.stringify({ journal: outputPath, ...journal.counts, provider_calls: 0, leases_acquired: false, apply_result: journal.apply_result }));
} else {
  const outputPath = `${outputDir}/cohort-010-cache-only-recovery-dry-run.json`;
  writeFileSync(outputPath, `${JSON.stringify(journal, null, 2)}\n`);
  console.log(JSON.stringify({ journal: outputPath, ...journal.counts, provider_calls: 0, leases_acquired: false }));
}
ledger.close();
