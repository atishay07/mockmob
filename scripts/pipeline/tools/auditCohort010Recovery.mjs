// Read-only recovery inventory for frozen legacy cohort 010. This tool never
// opens BudgetLedger (its constructor performs maintenance writes), never calls
// providers, and never claims the local or staging worker lease.
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validationContract } from '../lib/compactBenchmark.mjs';

const sourceDir = 'artifacts/question-factory/cost-native-cohort-010';
const outDir = 'artifacts/question-factory/cuet-readiness-2026-10-08/recovery';
const ledgerPath = process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite';
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const campaign = readJson(`${sourceDir}/campaign.json`);
const benchmark = readJson(`${sourceDir}/benchmark.json`);
const publishedBatchReport = readJson(`${sourceDir}/batch-report.json`);
const oldEligiblePath = `${sourceDir}/approved-records.json`;
const oldEligibleBytes = readFileSync(oldEligiblePath);
const recoveryJournalPath = 'artifacts/question-factory/cuet-readiness-2026-10-08/recovery/cohort-010-cache-only-recovery-dry-run.json';
const oldEligible = JSON.parse(oldEligibleBytes);
if (campaign.id !== 'cost-native-cohort-010' || campaign.denominator !== 100 || campaign.no_regeneration !== true) throw new Error('cohort010_frozen_registration_contract_mismatch');
if (oldEligible.length !== 76 || oldEligible.some(row => !['eligible', 'published'].includes(row.state))) throw new Error('legacy_machine_eligible_export_mismatch');
if (!benchmark.registration?.contract_hash) throw new Error('legacy_benchmark_registration_missing');

const db = new DatabaseSync(ledgerPath, { readOnly: true });
let report;
try {
  db.exec('BEGIN');
  const jobs = campaign.jobs || [];
  const jobIds = jobs.map(j => j.id);
  const localRows = jobIds.length ? db.prepare(`SELECT id,value FROM factory_candidates WHERE id IN (${jobIds.map(()=>'?').join(',')})`).all(...jobIds) : [];
  const localMap = new Map(localRows.map(row => [row.id, JSON.parse(row.value)]));
  const stateCounts = {};
  const jobMetadata = jobs.map(job => {
    const stored = localMap.get(job.id) || job;
    const state = stored.state || 'queued';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
    return { candidate_id: job.id, local_state: state, has_saved_candidate: Boolean(stored.candidate), pending_key: stored.pending || null,
      saved_result_state: stored.result?.state || null, repair_count: stored.repair_count || 0 };
  });
  const ids = new Set(campaign.request_ids_before || []);
  const providerRows = db.prepare(`SELECT r.id AS reservation_id,r.model,r.reserved,r.actual,r.state AS request_state,r.created_at,r.receipt_json,
      p.id AS request_key,p.provider,p.provider_id,p.state AS provider_state,p.request_json
    FROM provider_batches p JOIN requests r ON r.id=p.reservation_id
    UNION ALL
    SELECT r.id AS reservation_id,r.model,r.reserved,r.actual,r.state AS request_state,r.created_at,r.receipt_json,
      p.id AS request_key,p.provider,NULL AS provider_id,p.state AS provider_state,p.request_json
    FROM provider_requests p JOIN requests r ON r.id=p.reservation_id`).all();
  const scoped = providerRows.flatMap(row => {
    let saved; try { saved = JSON.parse(row.request_json); } catch { return []; }
    const cfg = saved.config || {}, candidateId = cfg.candidate_id || null;
    const local = candidateId ? localMap.get(candidateId) : null;
    const belongs = candidateId ? jobIds.includes(candidateId) : jobMetadata.some(j => j.pending_key === row.request_key);
    if (!belongs || ids.has(row.reservation_id) || cfg.purpose !== 'candidate') return [];
    let receipt = null; try { receipt = row.receipt_json ? JSON.parse(row.receipt_json) : null; } catch { /* metadata only */ }
    const accepted = Boolean(row.provider_id);
    let disposition;
    if (row.provider_state === 'complete') disposition = 'provider_response_saved';
    else if (row.provider_state === 'rejected' && row.request_state === 'settled' && (receipt?.http_status >= 400 || receipt?.error)) disposition = 'terminal_preinference_or_typed_rejection';
    else if (accepted && ['submitted','unresolved'].includes(row.provider_state)) disposition = 'provider_accepted_pending_or_terminal_unknown';
    else if (row.provider_state === 'queued' || row.provider_state === 'dispatching' || !accepted) disposition = 'not_confirmed_provider_accepted';
    else disposition = 'terminal_or_other_saved_state';
    const committed = row.request_state === 'settled' ? (row.actual || 0) : Math.max(row.reserved || 0, row.actual || 0);
    return [{ candidate_id: candidateId || jobMetadata.find(j => j.pending_key === row.request_key)?.candidate_id || null,
      local_state: local?.state || null, request_key: row.request_key, provider: row.provider, model: row.model, stage: cfg.stage || null,
      provider_id: row.provider_id || null, provider_state: row.provider_state, request_state: row.request_state, provider_accepted: accepted,
      disposition, reservation_id: row.reservation_id, reserved_micro: row.reserved, actual_micro: row.actual, committed_micro: committed,
      created_at: row.created_at, http_status: receipt?.http_status || null, receipt_error: receipt?.error || null }];
  }).sort((a,b) => (a.candidate_id||'').localeCompare(b.candidate_id||'') || (a.stage||'').localeCompare(b.stage||'') || a.request_key.localeCompare(b.request_key));
  const pendingJobs = jobMetadata.filter(j => !['eligible','quarantined','published'].includes(j.local_state));
  const acceptedAuthoring = scoped.filter(r => r.stage === 'authoring' && r.provider_accepted);
  const currentPending = pendingJobs.map(job => {
    const row = acceptedAuthoring.find(r => r.request_key === job.pending_key);
    return { candidate_id: job.candidate_id, pending_key: job.pending_key, local_state: job.local_state,
      saved_request_found: Boolean(row), request_key_matches: row?.request_key === job.pending_key,
      provider: row?.provider || null, model: row?.model || null, provider_id: row?.provider_id || null,
      provider_state: row?.provider_state || null, request_state: row?.request_state || null,
      reservation_id: row?.reservation_id || null, disposition: row?.receipt_error?.code === 'credit_balance_exhausted'
        ? 'preinference_credit_refusal' : row?.disposition || 'no_saved_request',
      http_status: row?.http_status || null, receipt_error_code: row?.receipt_error?.code || null,
      committed_micro: row?.committed_micro ?? null,
      saved_body_sha256: row ? hash(JSON.stringify(JSON.parse(providerRows.find(p => p.request_key === row.request_key).request_json).body)) : null };
  });
  const currentCounts = Object.fromEntries([...new Set(currentPending.map(r=>r.disposition))].map(k=>[k,currentPending.filter(r=>r.disposition===k).length]));
  const allAuthoringByDisposition = Object.fromEntries([...new Set(acceptedAuthoring.map(r=>r.disposition))].map(k=>[k,acceptedAuthoring.filter(r=>r.disposition===k).length]));
  const keyMatches = currentPending.length === pendingJobs.length && currentPending.every(r=>r.request_key_matches);
  const pendingAttemptCounts = Object.fromEntries([...new Set(currentPending.map(r=>r.provider_id))].map(id=>[id,currentPending.filter(r=>r.provider_id===id).length]));
  const newRequestRows = db.prepare('SELECT id,model,reserved,actual,state,created_at,receipt_json FROM requests').all().filter(r=>!ids.has(r.id));
  const candidateReservationIds = new Set(scoped.map(r=>r.reservation_id));
  const cohortSpendRows = newRequestRows.filter(r=>candidateReservationIds.has(r.id));
  const sumMicro = rows => rows.reduce((sum,r)=>sum+(r.state==='settled'?(r.actual||0):Math.max(r.reserved||0,r.actual||0)),0);
  const spend = { request_count: cohortSpendRows.length, settled_micro: cohortSpendRows.filter(r=>r.state==='settled').reduce((n,r)=>n+(r.actual||0),0),
    held_micro: cohortSpendRows.filter(r=>r.state!=='settled').reduce((n,r)=>n+Math.max(r.reserved||0,r.actual||0),0), gross_committed_micro: sumMicro(cohortSpendRows),
    unresolved_count: cohortSpendRows.filter(r=>r.state==='unresolved').length };
  const legacyContractHash = benchmark.registration.contract_hash;
  const presentContractHash = validationContract();
  const recoveryJournal = existsSync(recoveryJournalPath) ? readJson(recoveryJournalPath) : null;
  report = { schema: 'cohort-010-offline-recovery-audit-v1', as_of: new Date().toISOString(), read_only: true, provider_calls: 0, leases_acquired: false,
    source: { directory: sourceDir, campaign_sha256: hash(readFileSync(`${sourceDir}/campaign.json`)), benchmark_registration_contract_hash: legacyContractHash,
      current_legacy_contract_hash: presentContractHash, legacy_contract_matches_current: legacyContractHash === presentContractHash,
      request_cutoff_count: ids.size, old_machine_eligible_export_sha256: hash(oldEligibleBytes), old_machine_eligible_count: oldEligible.length,
      saved_batch_report_as_of: publishedBatchReport.at || null, saved_batch_report_sha256: hash(readFileSync(`${sourceDir}/batch-report.json`)) },
    local_jobs: { denominator: jobs.length, state_counts: stateCounts, pending_count: pendingJobs.length, pending_candidates: pendingJobs,
      no_candidate_count: jobMetadata.filter(j=>!j.has_saved_candidate && !['quarantined','eligible','published'].includes(j.local_state)).length },
    provider_requests: { scoped_count: scoped.length, campaign_authoring_attempt_count: acceptedAuthoring.length,
      campaign_authoring_disposition_counts: allAuthoringByDisposition,
      current_pending: { count: currentPending.length, disposition_counts: currentCounts, by_provider_id: pendingAttemptCounts,
        every_pending_key_has_exact_saved_request: keyMatches, requests: currentPending } },
    recovery_dry_run: recoveryJournal ? { path: recoveryJournalPath, sha256: hash(readFileSync(recoveryJournalPath)), created_at: recoveryJournal.created_at,
      provider_calls: recoveryJournal.provider_calls, counts: recoveryJournal.counts,
      frozen_campaign_matches: recoveryJournal.frozen?.campaign_sha256 === hash(readFileSync(`${sourceDir}/campaign.json`)),
      v62_contract_matches: recoveryJournal.frozen?.v62_contract_hash === legacyContractHash } : null,
    ledger_cost: { basis: 'Native SQLite request rows after the campaign cutoff, joined by exact saved candidate/request metadata; nonsettled rows grossed at max(reserved,actual). Read-only snapshot.', ...spend,
      settled_usd: spend.settled_micro / 1e6, held_usd: spend.held_micro / 1e6, gross_committed_usd: spend.gross_committed_micro / 1e6 },
    recovery: { status: keyMatches && currentCounts.provider_response_saved === pendingJobs.length ? 'saved_responses_available_for_guarded_local_replay'
        : keyMatches && currentCounts.provider_response_saved > 0 ? 'partial_saved_response_recovery_only; remaining_requests_blocked'
        : 'blocked_saved_request_mapping_or_states_unresolved',
      cache_only_dry_run_command: 'node --use-system-ca scripts/pipeline/tools/recoverCohort010Authoring.mjs',
      guarded_apply_command_after_all_leases_are_released: 'node --use-system-ca scripts/pipeline/tools/recoverCohort010Authoring.mjs --apply',
      apply_guard: 'Apply checks factory_worker and factory_campaign_controller before creating a backup, repeats those checks inside BEGIN IMMEDIATE, then checks every job row hash and writes all selected job changes in one transaction. It does not claim either lease, call a provider, publish, or alter the campaign, request rows, benchmark, registry, or old export.',
      recovery_tool_evidence: 'The dry-run journal retains exact candidates and hashes from saved request bodies: only cache/receipt replay is allowed. The 3 typed credit refusals are quarantined with explicit pre-inference reasons. Any incomplete/malformed saved response remains pending with its terminal reason; deterministic candidate lint failures preserve the decoded candidate and quarantine reason. No regeneration key is created.',
      reason_no_worker_command: 'The legacy generate action is release-gated and processes all outstanding jobs; the worker additionally claims a staging lease, reconciles unrelated batches, syncs staging state, and can publish when staging control permits. Use the guarded local recovery tool instead.',
      replay_guarantee: 'Saved complete responses can only replay when provider, model, stable key, exact saved body digest, native request ID, and local pending key match. Submitted/unknown accepted requests are never resent. The 3 429 credit_balance_exhausted rows are pre-inference refusals, not missing inference results.',
      required_before_completion: ['Wait for A/B and comparison-controller leases to finish and release.',
        'Inspect the cache-only dry-run journal and refresh it if the saved ledger rows changed.',
        'Use the guarded local apply command only after the lease checks pass; it materializes five candidates, quarantines one deterministic presentation failure, and quarantines three typed pre-inference credit refusals.',
        'Reconcile local job state and verify frozen campaign, v6.2 contract, and 76-row export hashes after apply.'],
      caveats: ['If the eventual worker command is used, it claims both local and staging worker ownership, reconciles global provider batches, and writes staging snapshots; it is not an offline/local-only command.',
        'The 76-item export is the existing v6.2 machine-eligible snapshot. It has not been reassessed under CUET-fit/v7, is not a release claim, and its historical verifier contract must remain unchanged.'] } };
  db.exec('COMMIT');
} finally { db.close(); }

mkdirSync(outDir, { recursive: true });
const oldExportPath = `${outDir}/cohort-010-legacy-v6.2-machine-eligible.json`;
copyFileSync(oldEligiblePath, oldExportPath);
writeFileSync(`${outDir}/cohort-010-offline-recovery.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report: `${outDir}/cohort-010-offline-recovery.json`, old_v6_machine_eligible_export: oldExportPath,
  pending: report.local_jobs.pending_count, current_pending: report.provider_requests.current_pending.disposition_counts,
  campaign_authoring_attempts: report.provider_requests.campaign_authoring_attempt_count, spend_usd: report.ledger_cost.gross_committed_usd,
  current_legacy_contract_matches: report.source.legacy_contract_matches_current, provider_calls: 0, leases: false }));
