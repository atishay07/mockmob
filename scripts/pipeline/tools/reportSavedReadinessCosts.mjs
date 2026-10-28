import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { bodyCandidateId } from '../lib/scopedAccounting.mjs';

// Read-only exact-ID accounting for the saved 100-item readiness campaigns.
// No BudgetLedger constructor is used: it can reconcile/modify the database on open.
const root = resolve('artifacts/question-factory');
const outputDir = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/execution');
const dbPath = resolve('data/pipeline-budget.sqlite');
const arms = ['baseline', 'improved'];
const usd = micro => Number((micro / 1e6).toFixed(6));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonHash = path => sha256(readFileSync(path));
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const countBy = (rows, fn) => Object.fromEntries([...new Set(rows.map(fn).filter(v => v !== null && v !== undefined && v !== ''))].sort().map(k => [k, rows.filter(r => fn(r) === k).length]));
const sum = (rows, fn) => rows.reduce((n, row) => n + (Number(fn(row)) || 0), 0);
const normal = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const failureCodes = row => [...new Set([row.author_failure, ...(row.result?.reasons || [])].filter(v => typeof v === 'string' && v.trim()))];

function usageTokens(receipt) {
  const u = receipt?.usage || {};
  const input = Number(u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount ?? 0) || 0;
  // Gemini thought tokens are part of output tokens; reasoning is reported as a subset below.
  const output = Number(u.output_tokens ?? u.completion_tokens ?? ((Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0))) || 0;
  const reasoning = Number(u.output_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? u.thoughtsTokenCount ?? 0) || 0;
  assert(reasoning <= output, 'reasoning_tokens_exceed_output_tokens');
  return { input, output, reasoning, present: Object.keys(u).length > 0 };
}

function readArm(arm) {
  const dir = join(root, `cuet-readiness-${arm}-100-2026-10-08`);
  const paths = Object.fromEntries(['campaign.json', 'all-candidates.json', 'batch-report.json', 'receipts.json', 'verification-profile.json'].map(name => [name, join(dir, name)]));
  const hashes = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, jsonHash(path)]));
  const campaign = JSON.parse(readFileSync(paths['campaign.json'], 'utf8'));
  const candidates = JSON.parse(readFileSync(paths['all-candidates.json'], 'utf8'));
  const batch = JSON.parse(readFileSync(paths['batch-report.json'], 'utf8'));
  const receiptExport = JSON.parse(readFileSync(paths['receipts.json'], 'utf8'));
  const profile = JSON.parse(readFileSync(paths['verification-profile.json'], 'utf8'));
  assert(campaign.denominator === 100 && campaign.jobs?.length === 100, `${arm}_campaign_not_fixed_100`);
  const ids = campaign.jobs.map(job => job.id);
  assert(ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === 100, `${arm}_campaign_ids_missing_or_duplicate`);
  assert(candidates.length === 100 && new Set(candidates.map(row => row.id)).size === 100, `${arm}_saved_candidate_denominator_mismatch`);
  const campaignIds = new Set(ids), candidateIds = new Set(candidates.map(row => row.id));
  assert(ids.every(id => candidateIds.has(id)) && candidates.every(row => campaignIds.has(row.id)), `${arm}_campaign_export_id_set_mismatch`);
  return { arm, dir, paths, hashes, campaign, candidates, batch, receiptExport, profile, ids, idSet: campaignIds };
}

function nativeIdentity(saved, providerColumn) {
  let request;
  try { request = JSON.parse(saved.request_json); } catch { return null; }
  const config = request?.config || {};
  const provider = config.provider || providerColumn || null;
  const bodyId = bodyCandidateId(provider, request.body);
  const configId = typeof config.candidate_id === 'string' && config.candidate_id !== 'undefined' ? config.candidate_id : null;
  return { config, provider, bodyId, configId, request };
}

function normalizeReceiptId(receipt) {
  return typeof receipt?.candidate_id === 'string' && receipt.candidate_id.trim() ? receipt.candidate_id.trim() : null;
}

function aggregateCampaign(arm, requestRows, nativeRows) {
  const exportedById = new Map();
  for (const row of arm.receiptExport) {
    assert(typeof row.id === 'string' && row.id, `${arm.arm}_receipt_export_reservation_id_missing`);
    assert(!exportedById.has(row.id), `${arm.arm}_duplicate_exported_reservation_id:${row.id}`);
    const receipt = row.receipt || (row.receipt_json ? JSON.parse(row.receipt_json) : {});
    const candidateId = normalizeReceiptId(receipt);
    assert(!candidateId || arm.idSet.has(candidateId), `${arm.arm}_export_receipt_candidate_identity_conflict:${row.id}`);
    exportedById.set(row.id, { id: row.id, candidate_id: candidateId, state: row.state, reserved_micro: Number(row.reserved) || 0, actual_micro: Number(row.actual) || 0, receipt });
  }
  const exportSettledMicro = sum([...exportedById.values()].filter(r => r.state === 'settled'), r => r.actual_micro);
  const exportHeldMicro = sum([...exportedById.values()].filter(r => r.state !== 'settled'), r => Math.max(r.reserved_micro, r.actual_micro));
  const exportGrossMicro = exportSettledMicro + exportHeldMicro;
  assert(exportedById.size === arm.batch.cost?.requests, `${arm.arm}_receipt_export_request_count_mismatch`);
  assert(exportSettledMicro === Math.round(Number(arm.batch.cost.settled_usd) * 1e6), `${arm.arm}_saved_receipt_settled_cost_export_mismatch`);
  assert(exportHeldMicro === Math.round(Number(arm.batch.cost.held_usd) * 1e6), `${arm.arm}_saved_receipt_held_cost_export_mismatch`);
  assert(exportGrossMicro === Math.round(Number(arm.batch.cost.gross_usd) * 1e6), `${arm.arm}_saved_receipt_gross_cost_export_mismatch`);
  const selected = new Map();
  for (const meta of nativeRows) {
    const info = nativeIdentity(meta, meta.provider);
    if (!info) continue;
    const { config, provider, bodyId, configId, request } = info;
    const identities = [configId, bodyId].filter(Boolean);
    const hits = identities.filter(id => arm.idSet.has(id));
    if (!hits.length) continue;
    assert(new Set(identities).size === 1, `${arm.arm}_native_config_body_identity_conflict:${meta.reservation_id}`);
    const candidateId = hits[0];
    const row = requestRows.get(meta.reservation_id);
    assert(row, `${arm.arm}_native_request_without_reservation:${meta.reservation_id}`);
    const receipt = row.receipt_json ? JSON.parse(row.receipt_json) : {};
    const receiptId = normalizeReceiptId(receipt);
    assert(!receiptId || receiptId === candidateId, `${arm.arm}_receipt_candidate_identity_conflict:${meta.reservation_id}`);
    const stage = config.stage || receipt.stage || null;
    const requestProvider = provider || receipt.provider || null;
    const model = row.model || config.model || receipt.model || null;
    const executionMode = config.execution_mode || receipt.execution_mode || null;
    assert(stage && requestProvider && model, `${arm.arm}_request_attribution_incomplete:${meta.reservation_id}`);
    assert(executionMode, `${arm.arm}_execution_mode_missing:${meta.reservation_id}`);
    if (receipt.stage) assert(receipt.stage === stage, `${arm.arm}_receipt_stage_mismatch:${meta.reservation_id}`);
    if (receipt.provider) assert(receipt.provider === requestProvider, `${arm.arm}_receipt_provider_mismatch:${meta.reservation_id}`);
    const entry = { reservation_id: meta.reservation_id, candidate_id: candidateId, stage, provider: requestProvider, model, execution_mode: executionMode,
      execution_mode_attribution: config.execution_mode ? 'native_request_config' : receipt.execution_mode ? 'receipt' : 'unavailable',
      state: row.state, reserved_micro: row.reserved, actual_micro: row.actual || 0, receipt, usage: usageTokens(receipt), identity_source: bodyId && configId ? 'config+body' : bodyId ? 'body' : 'config' };
    const existing = selected.get(entry.reservation_id);
    if (existing) {
      assert(JSON.stringify([existing.candidate_id, existing.stage, existing.provider, existing.model, existing.execution_mode]) === JSON.stringify([entry.candidate_id, entry.stage, entry.provider, entry.model, entry.execution_mode]), `${arm.arm}_duplicate_reservation_metadata_conflict:${entry.reservation_id}`);
    } else selected.set(entry.reservation_id, entry);
  }

  // Include only receipt-attributed rows that lacked native config; never infer an ID from timing or totals.
  for (const [id, row] of requestRows) {
    if (selected.has(id) || !row.receipt_json) continue;
    let receipt;
    try { receipt = JSON.parse(row.receipt_json); } catch { continue; }
    const candidateId = normalizeReceiptId(receipt);
    if (!candidateId || !arm.idSet.has(candidateId)) continue;
    const stage = receipt.stage || null, provider = receipt.provider || null, model = row.model || receipt.model || null;
    assert(stage && provider && model, `${arm.arm}_receipt_only_attribution_incomplete:${id}`);
    selected.set(id, { reservation_id: id, candidate_id: candidateId, stage, provider, model, execution_mode: receipt.execution_mode || 'unknown_receipt_only',
      execution_mode_attribution: receipt.execution_mode ? 'receipt' : 'unavailable_in_receipt', state: row.state,
      reserved_micro: row.reserved, actual_micro: row.actual || 0, receipt, usage: usageTokens(receipt), identity_source: 'receipt_only' });
  }

  const byCandidate = new Map(arm.ids.map(id => [id, []]));
  for (const request of selected.values()) byCandidate.get(request.candidate_id)?.push(request);
  const exportedCost = arm.batch.cost || {};
  const settledMicro = sum([...selected.values()].filter(r => r.state === 'settled'), r => r.actual_micro);
  const heldMicro = sum([...selected.values()].filter(r => r.state !== 'settled'), r => Math.max(r.reserved_micro, r.actual_micro));
  const grossMicro = settledMicro + heldMicro;
  for (const [id, exported] of exportedById) {
    const current = selected.get(id);
    assert(current, `${arm.arm}_exported_reservation_not_attributed_from_native_or_receipt:${id}`);
    if (exported.candidate_id) assert(exported.candidate_id === current.candidate_id, `${arm.arm}_export_receipt_native_identity_conflict:${id}`);
    exported.candidate_id = current.candidate_id;
  }
  const currentById = new Map([...selected.values()].map(request => [request.reservation_id, request]));
  const newReservations = [...selected.values()].filter(request => !exportedById.has(request.reservation_id));
  const changedExported = [...exportedById.values()].map(exported => {
    const current = currentById.get(exported.id);
    const currentGross = current.state === 'settled' ? current.actual_micro : Math.max(current.reserved_micro, current.actual_micro);
    const exportGross = exported.state === 'settled' ? exported.actual_micro : Math.max(exported.reserved_micro, exported.actual_micro);
    return { id: exported.id, candidate_id: exported.candidate_id, export_state: exported.state, current_state: current.state,
      export_gross_micro: exportGross, current_gross_micro: currentGross, adjustment_micro: currentGross-exportGross,
      state_changed_since_export: exported.state !== current.state };
  });
  const exportedCostMicroBridge = exportGrossMicro + sum(changedExported, row => row.adjustment_micro) + sum(newReservations, request => request.state === 'settled' ? request.actual_micro : Math.max(request.reserved_micro, request.actual_micro));
  assert(grossMicro === exportedCostMicroBridge, `${arm.arm}_live_ledger_to_export_bridge_failed:${grossMicro}:${exportedCostMicroBridge}`);
  assert([...selected.values()].every(r => arm.idSet.has(r.candidate_id)), `${arm.arm}_out_of_scope_request_attributed`);

  const groups = new Map();
  for (const request of selected.values()) {
    const key = [request.stage, request.provider, request.model, request.execution_mode].join('|');
    const group = groups.get(key) || { stage: request.stage, provider: request.provider, model: request.model, execution_mode: request.execution_mode,
      reservations: 0, settled_requests: 0, held_requests: 0, failed_or_unsettled_requests: 0, settled_micro: 0, held_micro: 0, input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, usage_missing_requests: 0 };
    group.reservations++;
    if (request.state === 'settled') { group.settled_requests++; group.settled_micro += request.actual_micro; }
    else { group.held_requests++; group.held_micro += Math.max(request.reserved_micro, request.actual_micro); }
    if (request.state !== 'settled' || request.receipt?.error || request.receipt?.status === 'error' || request.receipt?.status === 'failed') group.failed_or_unsettled_requests++;
    if (request.usage.present) { group.input_tokens += request.usage.input; group.output_tokens += request.usage.output; group.reasoning_tokens += request.usage.reasoning; }
    else if (request.state === 'settled') group.usage_missing_requests++;
    groups.set(key, group);
  }
  const stageProviderMode = [...groups.values()].sort((a,b) => b.settled_micro+b.held_micro - a.settled_micro-a.held_micro || a.stage.localeCompare(b.stage));
  const stageProvider = new Map();
  for (const group of stageProviderMode) {
    const key = [group.stage, group.provider, group.model].join('|');
    const sumGroup = stageProvider.get(key) || { stage: group.stage, provider: group.provider, model: group.model, execution_modes: [], reservations: 0,
      settled_micro: 0, held_micro: 0, input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, usage_missing_requests: 0 };
    sumGroup.execution_modes.push({ mode: group.execution_mode, reservations: group.reservations, settled_usd: usd(group.settled_micro), held_usd: usd(group.held_micro) });
    for (const k of ['reservations','settled_micro','held_micro','input_tokens','output_tokens','reasoning_tokens','usage_missing_requests']) sumGroup[k] += group[k];
    stageProvider.set(key, sumGroup);
  }
  const candidates = arm.candidates.map(item => {
    const requests = byCandidate.get(item.id) || [];
    const candidateSettled = sum(requests.filter(r => r.state === 'settled'), r => r.actual_micro);
    const candidateHeld = sum(requests.filter(r => r.state !== 'settled'), r => Math.max(r.reserved_micro, r.actual_micro));
    return { id: item.id, state: item.state, result_state: item.result?.state || null, subject: item.subject, planned_format: item.format,
      actual_format: item.candidate?.question_type || null, planned_difficulty: item.difficulty, actual_difficulty: item.candidate?.difficulty || null,
      requested_answer_position: item.requested_answer_position || null, candidate_answer_position: item.candidate?.correct_answer || null,
      repair_count: item.repair_count || 0, exact_fingerprint: item.candidate ? sha256(JSON.stringify({ subject: item.candidate.subject || item.subject, body: normal(item.candidate.body),
        options: (item.candidate.options || []).map(option => normal(typeof option === 'string' ? option : option?.text)), answer: item.candidate.correct_answer || null })) : null,
      reservation_count: requests.length, settled_usd: usd(candidateSettled), held_usd: usd(candidateHeld), gross_usd: usd(candidateSettled + candidateHeld), failure_codes: failureCodes(item) };
  });
  const terminal = arm.candidates.filter(item => ['eligible','quarantined'].includes(item.state)).length;
  const eligible = arm.candidates.filter(item => item.state === 'eligible').length;
  const quarantined = arm.candidates.filter(item => item.state === 'quarantined').length;
  const fingerprintGroups = new Map();
  for (const item of candidates.filter(item => item.exact_fingerprint)) fingerprintGroups.set(item.exact_fingerprint, [...(fingerprintGroups.get(item.exact_fingerprint) || []), item.id]);
  const repairStage = [...selected.values()].filter(r => r.stage === 'repair');
  const inputTokens = sum([...selected.values()].filter(r => r.state === 'settled'), r => r.usage.input);
  const outputTokens = sum([...selected.values()].filter(r => r.state === 'settled'), r => r.usage.output);
  const reasoningTokens = sum([...selected.values()].filter(r => r.state === 'settled'), r => r.usage.reasoning);
  const noUsage = [...selected.values()].filter(r => r.state === 'settled' && !r.usage.present).length;
  const exactComplete = terminal === 100 && arm.batch.complete === true;
  return {
    arm: arm.arm, campaign_id: arm.campaign.id, verifier: arm.profile.verifier_version, topology: arm.profile.topology, execution_mode_source: 'persisted request config when present; receipt-only requests with missing mode are isolated as unknown, never inferred',
    denominator: 100, state_as_of: arm.batch.at || arm.batch.generated_at || null, complete_100_terminal: exactComplete,
    terminal_count: terminal, eligible_observed: eligible, final_eligible: exactComplete ? eligible : null, quarantined_terminal: quarantined,
    pending_or_nonterminal: 100-terminal, observed_eligible_rate_pct: Number((eligible / 100 * 100).toFixed(2)), final_yield_pct: exactComplete ? Number((eligible / 100 * 100).toFixed(2)) : null,
    repair_summary: { candidates_with_repairs: arm.candidates.filter(item => (item.repair_count || 0) > 0).length, repair_attempts: sum(arm.candidates, item => item.repair_count || 0),
      directly_attributed_repair_stage_requests: repairStage.length, directly_attributed_repair_stage_gross_usd: usd(sum(repairStage.filter(r => r.state === 'settled'), r => r.actual_micro) + sum(repairStage.filter(r => r.state !== 'settled'), r => Math.max(r.reserved_micro, r.actual_micro))),
      remaining_validation_rechecks_not_classified_as_initial: 'Requests on non-repair stages may include revalidation after a repair; no initial-versus-revalidation split is asserted without persisted attempt identifiers.' },
    spend: { settled_usd: usd(settledMicro), held_usd: usd(heldMicro), gross_committed_usd: usd(grossMicro), request_count: selected.size,
      held_request_count: [...selected.values()].filter(r => r.state !== 'settled').length, provider_failure_or_unsettled_count: stageProviderMode.reduce((n,r)=>n+r.failed_or_unsettled_requests,0),
      last_saved_export: { at: arm.batch.at || null, request_count: exportedById.size, settled_usd: usd(exportSettledMicro), held_usd: usd(exportHeldMicro), gross_committed_usd: usd(exportGrossMicro),
        reconciles_exactly_to_saved_receipts_and_batch_report: true },
      live_ledger_bridge: { current_read_at: new Date().toISOString(), new_reservations_since_export: newReservations.length,
        new_reservations_gross_usd: usd(sum(newReservations, request => request.state === 'settled' ? request.actual_micro : Math.max(request.reserved_micro, request.actual_micro))),
        exported_reservations_changed_since_export: changedExported.filter(row => row.state_changed_since_export || row.adjustment_micro !== 0).length,
        existing_reservation_adjustment_usd: Number((sum(changedExported, row => row.adjustment_micro) / 1e6).toFixed(6)),
        gross_delta_usd: Number(((grossMicro - exportGrossMicro) / 1e6).toFixed(6)),
        current_cost_bridges_exactly_from_saved_export: grossMicro === exportedCostMicroBridge },
      token_usage: { input_tokens: inputTokens, output_tokens: outputTokens, reasoning_tokens_subset_of_output: reasoningTokens, reasoning_not_added_as_separate_output: true, settled_requests_missing_usage: noUsage },
      stage_provider_execution_mode: stageProviderMode.map(group => ({ ...group, settled_usd: usd(group.settled_micro), held_usd: usd(group.held_micro), gross_committed_usd: usd(group.settled_micro + group.held_micro), reasoning_tokens_subset_of_output: true })),
      stage_provider_totals: [...stageProvider.values()].map(group => ({ ...group, settled_usd: usd(group.settled_micro), held_usd: usd(group.held_micro), gross_committed_usd: usd(group.settled_micro + group.held_micro), reasoning_tokens_subset_of_output: true })),
      saved_receipt_export_reconciles_exactly_to_batch_report: true, export_cost: exportedCost },
    composition: { planned_formats: countBy(arm.candidates, item => item.format), produced_candidate_formats: countBy(arm.candidates.filter(item => item.candidate), item => item.candidate.question_type || item.format),
      planned_difficulty: countBy(arm.candidates, item => item.difficulty), produced_candidate_difficulty: countBy(arm.candidates.filter(item => item.candidate), item => item.candidate.difficulty || item.difficulty),
      requested_answer_positions: countBy(arm.candidates, item => item.requested_answer_position), eligible_answer_positions: countBy(arm.candidates.filter(item => item.state === 'eligible'), item => item.candidate?.correct_answer),
      all_produced_candidate_answer_positions: countBy(arm.candidates.filter(item => item.candidate), item => item.candidate.correct_answer),
      ids_unique: new Set(arm.ids).size === 100, produced_ids: arm.candidates.filter(item => item.candidate).length,
      exact_candidate_fingerprint_count: fingerprintGroups.size, exact_fingerprint_duplicate_groups: [...fingerprintGroups.values()].filter(group => group.length > 1).map(ids => ({ ids, count: ids.length })),
      semantic_unique_truth: null, semantic_uniqueness_note: 'Exact normalized fingerprints are deterministic text/option/key checks; they do not establish semantic uniqueness.' },
    failures_by_code: countBy(arm.candidates.flatMap(item => failureCodes(item).map(code => ({ code }))), item => item.code),
    items: candidates,
    request_attribution: { identity_basis: 'Exact preregistered campaign IDs matched against persisted native request config candidate_id and parsed provider-body identity when available, with receipt candidate_id cross-check; reservation IDs deduplicated.',
      identity_source_counts: countBy([...selected.values()], r => r.identity_source), execution_mode_unknown_requests: [...selected.values()].filter(r => r.execution_mode === 'unknown_receipt_only').length,
      missing_execution_mode_handling: 'Receipt-only rows lacking a stored mode are explicitly placed in unknown_receipt_only; no mode is inferred from provider errors.',
      unmatched_native_requests_excluded: true, unknown_candidate_attribution_fails: true }
  };
}

const armsData = arms.map(readArm);
const originalHashes = Object.fromEntries(armsData.map(arm => [arm.arm, arm.hashes]));
const db = new DatabaseSync(dbPath, { readOnly: true });
db.exec('PRAGMA busy_timeout=8000; BEGIN');
let reports;
try {
  const requestRows = new Map(db.prepare('SELECT id,model,reserved,actual,state,receipt_json,created_at FROM requests').all().map(row => [row.id, row]));
  const nativeRows = [
    ...db.prepare('SELECT reservation_id,provider,request_json FROM provider_requests').all(),
    ...db.prepare('SELECT reservation_id,provider,request_json FROM provider_batches').all()
  ];
  reports = armsData.map(arm => aggregateCampaign(arm, requestRows, nativeRows));
  db.exec('ROLLBACK');
} catch (error) { try { db.exec('ROLLBACK'); } catch {} db.close(); throw error; }
db.close();

const endHashes = Object.fromEntries(armsData.map(arm => [arm.arm, Object.fromEntries(Object.entries(arm.paths).map(([name, path]) => [name, jsonHash(path)]))]));
assert(JSON.stringify(originalHashes) === JSON.stringify(endHashes), 'campaign_export_changed_during_read_retry_after_snapshot_stable');

for (const report of reports) {
  assert(report.denominator === 100 && report.composition.ids_unique, `${report.arm}_denominator_invariant_failed`);
  assert(report.spend.saved_receipt_export_reconciles_exactly_to_batch_report, `${report.arm}_cost_export_reconciliation_missing`);
  assert(report.items.length === 100 && report.items.every(item => typeof item.id === 'string'), `${report.arm}_per_item_attribution_missing`);
}
const baseline = reports.find(report => report.arm === 'baseline');
const improved = reports.find(report => report.arm === 'improved');
const baselineMarginalBound = baseline.complete_100_terminal && baseline.final_eligible > 0 ? Number((baseline.spend.gross_committed_usd / baseline.final_eligible * 10000).toFixed(2)) : null;
const improvedMarginalBound = improved.complete_100_terminal && improved.final_eligible > 0 ? Number((improved.spend.gross_committed_usd / improved.final_eligible * 10000).toFixed(2)) : null;
const comparison = {
  title: 'Read-only saved 100-item CUET readiness campaign cost comparison', generated_at: new Date().toISOString(),
  database: relative(process.cwd(), dbPath), database_access: 'SQLite opened readOnly:true under a read transaction; no ledger writes or provider calls.',
  source_scope: armsData.map(arm => ({ arm: arm.arm, campaign_id: arm.campaign.id, files: Object.fromEntries(Object.entries(arm.paths).map(([name, path]) => [name, { path: relative(process.cwd(), path), sha256: arm.hashes[name] }])) })),
  comparison_status: { fixed_denominator_each_arm: 100, baseline_completed_terminal_100: baseline.complete_100_terminal, improved_terminal_100: improved.terminal_count === 100,
    baseline_current_eligible: baseline.eligible_observed, improved_current_eligible: improved.eligible_observed, improved_final_eligible: improved.final_eligible,
    improved_final_yield_pct: improved.final_yield_pct, final_arm_comparison_ready: baseline.complete_100_terminal && improved.complete_100_terminal,
    improved_forecast_usd: improved.complete_100_terminal && improved.final_eligible > 0 ? Number((improved.spend.gross_committed_usd / improved.final_eligible * 10000).toFixed(2)) : null,
    withheld_reason: improved.complete_100_terminal ? null : 'Improved arm has fewer than 100 terminal candidates; final yield and any 10,000-item marginal estimate remain null.' },
  conditional_marginal_10000: { baseline_usd: baselineMarginalBound, improved_usd: improvedMarginalBound,
    method: 'Completed-arm gross committed spend (settled actuals plus maximum reserved amounts for unsettled holds) divided by terminal machine-eligible count, multiplied by 10,000.',
    status: 'Conditional upper bound from this observed completed cohort only; not a settled invoice, guarantee, or approved spend. Holds are included at their committed maximum; reasoning tokens are already inside output-token usage and are not billed twice.',
    unchanged_mix_and_yield_assumption: true },
  arms: reports,
  limitations: ['A/B comparison is descriptive until both fixed 100-item denominators are terminal and their exact request/receipt totals reconcile.', 'Machine eligibility is not ground truth or CUET release evidence.',
    'Per-item exact fingerprint hashes do not establish semantic uniqueness.', 'Post-repair validations are not classified as initial without explicit persisted attempt identifiers.', 'Provider usage receipts and bounded holds are not invoices.']
};

mkdirSync(outputDir, { recursive: true });
const jsonPath = join(outputDir, 'saved-readiness-cost-comparison.json');
const markdownPath = join(outputDir, 'saved-readiness-cost-comparison.md');
writeFileSync(jsonPath, JSON.stringify(comparison, null, 2) + '\n');
const fmt = report => `$${Number(report.spend.gross_committed_usd).toFixed(6)} gross ($${report.spend.settled_usd.toFixed(6)} settled + $${report.spend.held_usd.toFixed(6)} held)`;
const md = [
  '# Saved readiness campaign cost comparison', '',
  `Captured ${comparison.generated_at}. Read-only SQLite transaction; no provider calls, ledger writes, or publication. Campaign IDs and per-request identity were reconciled against the saved 100-item exports.`, '',
  '## Status', '',
  `- Baseline: ${baseline.eligible_observed}/100 eligible and ${baseline.terminal_count}/100 terminal. Current read-only ledger cost: ${fmt(baseline)}. Its saved export at ${baseline.spend.last_saved_export.at} reconciles exactly.`,
  `- Improved: ${improved.eligible_observed} eligible in the saved outcome snapshot at ${improved.state_as_of}; ${improved.terminal_count}/100 terminal, with ${improved.pending_or_nonterminal} nonterminal. Current read-only ledger cost: ${fmt(improved)}; the last saved export at ${improved.spend.last_saved_export.at} was ${improved.spend.last_saved_export.request_count} requests / $${improved.spend.last_saved_export.gross_committed_usd.toFixed(6)} gross. The bridge attributes ${improved.spend.live_ledger_bridge.new_reservations_since_export} new reservations and $${improved.spend.live_ledger_bridge.gross_delta_usd.toFixed(6)} subsequent gross cost.`,
  `- Final improved yield, A/B final comparison, and improved forecast: ${improved.complete_100_terminal ? 'available after reconciliation' : '**withheld until all 100 are terminal**'}.`, '',
  '## Exact scoped spend', '',
  '| Arm | Stage | Provider | Model | Execution mode | Requests | Settled | Held | Gross committed | Input tokens | Output tokens | Reasoning subset |',
  '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
  ...reports.flatMap(report => report.spend.stage_provider_execution_mode.map(row => `| ${report.arm} | ${row.stage} | ${row.provider} | ${row.model} | ${row.execution_mode} | ${row.reservations} | $${row.settled_usd.toFixed(6)} | $${row.held_usd.toFixed(6)} | $${row.gross_committed_usd.toFixed(6)} | ${row.input_tokens} | ${row.output_tokens} | ${row.reasoning_tokens} |`)),
  '', 'Reasoning tokens are a subset of output tokens, not an additional cost category. Unsettled request holds are preserved at their maximum reserved/actual amount. Each saved receipt export reconciles request count and settled/held/gross totals exactly to its saved batch cost report. The current ledger view is bridged from that export through exact-ID new requests and any changed reservation settlements. Requests whose receipt lacks execution mode are isolated in an explicit unknown mode bucket; no mode is inferred.', '',
  '## Denominator, repairs, and forecast', '',
  `Both arms retain a fixed denominator of 100. Baseline repairs: ${baseline.repair_summary.repair_attempts} attempts across ${baseline.repair_summary.candidates_with_repairs} items; directly attributed repair-stage gross cost $${baseline.repair_summary.directly_attributed_repair_stage_gross_usd.toFixed(6)}. Improved repairs: ${improved.repair_summary.repair_attempts} attempts across ${improved.repair_summary.candidates_with_repairs} items; directly attributed repair-stage gross cost $${improved.repair_summary.directly_attributed_repair_stage_gross_usd.toFixed(6)}. Other stages may include post-repair revalidation and are not mislabeled as initial-only spend.`,
  `Baseline 10,000-item conditional upper-bound: ${baselineMarginalBound === null ? 'not available' : `$${baselineMarginalBound.toFixed(2)}`}, computed from baseline gross committed spend including holds divided by completed eligible count. It is conditional on unchanged mix/yield and is not a settled invoice.`,
  `Improved-arm 10,000-item estimate: ${improvedMarginalBound === null ? 'null until 100/100 terminal' : `$${improvedMarginalBound.toFixed(2)}`}.`, '',
  'Format, difficulty, requested/actual answer positions, all 100 item states, exact fingerprints, and failure-code counts are in the JSON. Fingerprints are text-level diagnostics, not semantic uniqueness proof.', '',
  'No publishing, release, or quality claim follows from machine eligibility.'
].join('\n');
writeFileSync(markdownPath, md + '\n');
console.log(JSON.stringify({ result: 'PASS', json: relative(process.cwd(), jsonPath), markdown: relative(process.cwd(), markdownPath), comparison_status: comparison.comparison_status,
  arms: reports.map(report => ({ arm: report.arm, terminal: report.terminal_count, observed_eligible: report.eligible_observed, final_eligible: report.final_eligible, gross_usd: report.spend.gross_committed_usd, requests: report.spend.request_count })),
  baseline_conditional_10000_upper_bound_usd: baselineMarginalBound, improved_10000_usd: comparison.conditional_marginal_10000.improved_usd }, null, 2));
