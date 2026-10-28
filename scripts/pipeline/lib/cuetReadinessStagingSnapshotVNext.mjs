export const CUET_READINESS_STAGING_PROJECT_REF = 'onwkqxmjqjrhfbjjdydu';
export const CUET_READINESS_BASELINE_ID = 'cuet-readiness-baseline-100-2026-10-08';
export const CUET_READINESS_IMPROVED_ID = 'cuet-readiness-improved-100-2026-10-08';

const assert = (condition, code) => { if (!condition) throw new Error(code); };

export function summarizeRegisteredCampaignVNext(registration, durableJobs, expected) {
  assert(registration?.id === expected.id, 'cuet_campaign_identity_mismatch');
  assert(registration.denominator === 100 && registration.jobs?.length === 100, 'cuet_campaign_denominator_mismatch');
  assert(registration.measurement_only === true && registration.publication_policy === 'never', 'cuet_campaign_publication_contract_mismatch');
  assert(registration.verifier === expected.verifier && registration.topology === 'dual_blind', 'cuet_campaign_verifier_contract_mismatch');
  assert(new Set(registration.jobs.map(job => job.id)).size === 100, 'cuet_campaign_duplicate_candidate_ids');

  const byId = new Map(durableJobs.map(job => [job.id, job]));
  const states = { eligible: 0, quarantined: 0, pending: 0, generated: 0 };
  let generated = 0;
  for (const job of registration.jobs) {
    const saved = byId.get(job.id);
    if (!saved) { states.pending++; continue; }
    if (saved.candidate) generated++;
    if (saved.state === 'eligible') states.eligible++;
    else if (saved.state === 'quarantined' || saved.state === 'rejected') states.quarantined++;
    else { states.pending++; if (saved.state === 'generated') states.generated++; }
  }
  assert(durableJobs.every(job => registration.jobs.some(roster => roster.id === job.id)), 'cuet_campaign_out_of_roster_job');
  const terminal = states.eligible + states.quarantined;
  return {
    id: registration.id,
    verifier: registration.verifier,
    topology: registration.topology,
    denominator: 100,
    terminal,
    eligible: states.eligible,
    rejected: states.quarantined,
    pending: 100 - terminal,
    complete: terminal === 100,
    generated,
    measurement_only: true,
    publication_policy: 'never',
    newly_published: 0,
  };
}

export function buildCuetReadinessStagingSnapshotVNext({
  projectRef,
  previousSnapshot = {},
  budget,
  costs,
  baseline,
  comparison,
  bank,
  historicalReconciled,
  at = new Date().toISOString(),
}) {
  assert(projectRef === CUET_READINESS_STAGING_PROJECT_REF, 'staging_project_identity_mismatch');
  assert(Number.isSafeInteger(budget?.limit_micro) && budget.limit_micro === 50_000_000, 'authorized_content_cap_required');
  assert(Number.isSafeInteger(budget?.committed_micro) && budget.committed_micro >= 0 && budget.committed_micro <= budget.limit_micro, 'content_budget_out_of_bounds');
  assert(Number.isSafeInteger(budget?.held_micro) && budget.held_micro >= 0 && budget.held_micro <= budget.committed_micro, 'current_hold_totals_required');
  assert(Number.isSafeInteger(budget?.unresolved) && Number.isSafeInteger(budget?.unbounded_unresolved) && budget.unbounded_unresolved === 0, 'unbounded_usage_hold_blocks_snapshot');
  assert(Number.isSafeInteger(budget?.conservative_hold_count) && budget.conservative_hold_count >= 0, 'native_hold_count_required');
  assert(historicalReconciled === true, 'historical_spend_reconciliation_required');
  assert(baseline?.id === CUET_READINESS_BASELINE_ID && baseline.complete && baseline.terminal === 100 && baseline.eligible === 70 && baseline.rejected === 30 && baseline.pending === 0, 'completed_baseline_evidence_required');
  assert(comparison?.id === CUET_READINESS_IMPROVED_ID && comparison.denominator === 100, 'registered_comparison_evidence_required');
  assert(bank?.complete === true && bank.denominator === 662 && bank.terminal === 662 && bank.eligible === 536 && bank.rejected === 126 && bank.publication === 'never', 'completed_bank_reassessment_required');
  assert(costs && Array.isArray(costs.stages), 'lifetime_cost_receipts_required');

  const history = previousSnapshot.historical_snapshot ?? {
    captured_at: previousSnapshot.at ?? null,
    pilot: previousSnapshot.pilot ?? null,
    batch: previousSnapshot.batch ?? null,
    forecast_usd: previousSnapshot.forecast_usd ?? null,
    cost_per_published_usd: previousSnapshot.cost_per_published_usd ?? null,
    costs: previousSnapshot.costs ?? null,
  };
  const pilot = {
    target: 100,
    total: 100,
    generated: baseline.generated,
    eligible: baseline.eligible,
    quarantined: baseline.rejected,
    complete: true,
    historical: false,
    measurement_only: true,
    publication_policy: 'never',
    cost_per_eligible_usd: null,
  };
  const batch = {
    complete: true,
    approved_unique: baseline.eligible,
    rejected: baseline.rejected,
    pending: 0,
    newly_published: 0,
    measurement_only: true,
    publication_policy: 'never',
    cost: baseline.cost ?? null,
  };

  return {
    ...previousSnapshot,
    at,
    historical_reconciled: true,
    budget,
    costs,
    blocker: 'current_cuet_calibration_below_release_threshold',
    forecast_usd: null,
    cost_per_published_usd: null,
    cost_measurement_cohort: null,
    achievable_published: null,
    shortfall_usd: null,
    historical_snapshot: history,
    historical_pilot: previousSnapshot.historical_pilot ?? previousSnapshot.pilot ?? null,
    historical_batch: previousSnapshot.historical_batch ?? previousSnapshot.batch ?? null,
    pilot,
    batch,
    cuet_readiness: {
      generated_at: at,
      publication: 'never',
      baseline,
      comparison,
      bank_reassessment: bank,
      point_forecast: null,
    },
  };
}

export function buildStagingSnapshotUpdatePatchVNext(snapshot, at) {
  return { snapshot, updated_at: at };
}
