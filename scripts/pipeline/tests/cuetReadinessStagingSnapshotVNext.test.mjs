import test from 'node:test';
import assert from 'node:assert/strict';
import { factoryLifetimeEconomics } from '../../../data/factory_inventory.mjs';
import {
  CUET_READINESS_STAGING_PROJECT_REF,
  buildCuetReadinessStagingSnapshotVNext,
  buildStagingSnapshotUpdatePatchVNext,
  summarizeRegisteredCampaignVNext,
} from '../lib/cuetReadinessStagingSnapshotVNext.mjs';
import { syncCuetReadinessStagingSnapshotVNext } from '../tools/syncCuetReadinessStagingSnapshotVNext.mjs';

const campaign = (id, verifier, states) => ({
  id, verifier, topology: 'dual_blind', denominator: 100, measurement_only: true, publication_policy: 'never',
  jobs: Array.from({ length: 100 }, (_, index) => ({ id: `${id}-${index}` })),
});
const saved = (registration, eligible, rejected, pending) => registration.jobs.map((job, index) => {
  if (index < eligible) return { id: job.id, state: 'eligible', candidate: { body: 'present' } };
  if (index < eligible + rejected) return { id: job.id, state: 'quarantined', candidate: { body: 'present' } };
  if (index < eligible + rejected + pending) return { id: job.id, state: 'generated', candidate: { body: 'present' } };
  return null;
}).filter(Boolean);

function inputs({ comparisonEligible = 38, comparisonRejected = 12, comparisonPending = 50 } = {}) {
  const a = campaign('cuet-readiness-baseline-100-2026-10-08', 'cuet-fit-validator-v7.1');
  const b = campaign('cuet-readiness-improved-100-2026-10-08', 'cuet-fit-validator-v7.2');
  const baseline = summarizeRegisteredCampaignVNext(a, saved(a, 70, 30, 0), { id: a.id, verifier: a.verifier });
  const comparison = summarizeRegisteredCampaignVNext(b, saved(b, comparisonEligible, comparisonRejected, comparisonPending), { id: b.id, verifier: b.verifier });
  return {
    projectRef: CUET_READINESS_STAGING_PROJECT_REF,
    previousSnapshot: { at: '2026-10-07T20:06:00Z', pilot: { generated: 100, eligible: 62, quarantined: 38 }, forecast_usd: 19.9, cost_per_published_usd: 0.0021, costs: { stages: [] }, marker: 'preserve-me' },
    budget: { limit_micro: 50_000_000, committed_micro: 31_560_000, held_micro: 366_370, settled_micro: 31_193_630, requests: 12_800, unresolved: 27, unbounded_unresolved: 0, conservative_hold_count: 27 },
    costs: { basis: 'settled receipts plus conservative holds', stages: [{ stage: 'independent_evaluation', held_usd: 0.36637, settled_usd: 2.5 }] },
    baseline, comparison,
    bank: { complete: true, denominator: 662, terminal: 662, eligible: 536, rejected: 126, pending: 0, publication: 'never', verifier: 'cuet-fit-validator-v7.2' },
    historicalReconciled: true,
    at: '2026-10-08T06:18:00.000Z',
  };
}

test('partial comparison and unreleased calibration never inherit stale cost forecasts', () => {
  const i = inputs();
  const snapshot = buildCuetReadinessStagingSnapshotVNext(i);
  assert.equal(snapshot.cuet_readiness.comparison.terminal, 50);
  assert.equal(snapshot.cuet_readiness.comparison.pending, 50);
  assert.equal(snapshot.cuet_readiness.point_forecast, null);
  assert.equal(snapshot.forecast_usd, null);
  assert.equal(snapshot.cost_per_published_usd, null);
  assert.deepEqual(factoryLifetimeEconomics(snapshot, 666), { forecast: null, affordable: null, shortfall: null });
});

test('snapshot keeps the full $50 cap, unresolved holds, and historical pilot while exposing current baseline', () => {
  const snapshot = buildCuetReadinessStagingSnapshotVNext(inputs());
  assert.equal(snapshot.budget.limit_micro, 50_000_000);
  assert.equal(snapshot.budget.held_micro, 366_370);
  assert.equal(snapshot.budget.conservative_hold_count, 27);
  assert.equal(snapshot.pilot.eligible, 70);
  assert.equal(snapshot.pilot.quarantined, 30);
  assert.equal(snapshot.pilot.publication_policy, 'never');
  assert.equal(snapshot.batch.newly_published, 0);
  assert.deepEqual(snapshot.historical_pilot, { generated: 100, eligible: 62, quarantined: 38 });
  assert.deepEqual(snapshot.historical_snapshot, {
    captured_at: '2026-10-07T20:06:00Z',
    pilot: { generated: 100, eligible: 62, quarantined: 38 },
    batch: null,
    forecast_usd: 19.9,
    cost_per_published_usd: 0.0021,
    costs: { stages: [] },
  });
  assert.equal(snapshot.marker, 'preserve-me');
});

test('staging update patch contains only snapshot and timestamp, preserving all controls by omission', () => {
  const patch = buildStagingSnapshotUpdatePatchVNext({ at: 'new' }, 'new');
  assert.deepEqual(patch, { snapshot: { at: 'new' }, updated_at: 'new' });
  assert.equal('paused' in patch, false);
  assert.equal('phase' in patch, false);
  assert.equal('publication_enabled' in patch, false);
  assert.equal('worker_id' in patch, false);
  assert.equal('lease_until' in patch, false);
});

test('refuses the wrong project, a changed cap, and a 99-item baseline', () => {
  assert.throws(() => buildCuetReadinessStagingSnapshotVNext({ ...inputs(), projectRef: 'isrxrxzjocewrdureyhp' }), /staging_project_identity_mismatch/);
  const capped = inputs(); capped.budget.limit_micro = 49_000_000;
  assert.throws(() => buildCuetReadinessStagingSnapshotVNext(capped), /authorized_content_cap_required/);
  const missing = inputs(); missing.baseline.terminal = 99;
  assert.throws(() => buildCuetReadinessStagingSnapshotVNext(missing), /completed_baseline_evidence_required/);
});

test('CLI requires the explicit exact staging identity before reading credentials or connecting', async () => {
  await assert.rejects(syncCuetReadinessStagingSnapshotVNext(['--staging', 'isrxrxzjocewrdureyhp']), /exact_staging_project_flag_required/);
  await assert.rejects(syncCuetReadinessStagingSnapshotVNext([]), /exact_staging_project_flag_required/);
});

test('campaign state summary counts durable eligibility and quarantine, keeping generated as pending', () => {
  const b = campaign('cuet-readiness-improved-100-2026-10-08', 'cuet-fit-validator-v7.2');
  const rows = saved(b, 39, 15, 5);
  const summary = summarizeRegisteredCampaignVNext(b, rows, { id: b.id, verifier: b.verifier });
  assert.deepEqual({ terminal: summary.terminal, eligible: summary.eligible, rejected: summary.rejected, pending: summary.pending }, { terminal: 54, eligible: 39, rejected: 15, pending: 46 });
  assert.equal(summary.generated, 59);
});

test('live paid work does not alter the metadata-only patch or remove held cost projections', () => {
  const i = inputs();
  const snapshot = buildCuetReadinessStagingSnapshotVNext(i);
  const patch = buildStagingSnapshotUpdatePatchVNext(snapshot, i.at);
  assert.deepEqual(patch, { snapshot, updated_at: i.at });
  assert.equal(snapshot.budget.held_micro, 366_370);
  assert.equal(snapshot.budget.conservative_hold_count, 27);
  assert.equal(snapshot.costs.stages[0].held_usd, 0.36637);
  assert.equal(snapshot.cuet_readiness.comparison.pending, 50);
  assert.equal(snapshot.blocker, 'current_cuet_calibration_below_release_threshold');
  assert.equal(snapshot.forecast_usd, null);
  assert.equal(snapshot.cost_per_published_usd, null);
  assert.equal(snapshot.batch.newly_published, 0);
  assert.equal('worker_id' in patch, false);
  assert.equal('lease_until' in patch, false);
  assert.deepEqual(factoryLifetimeEconomics(snapshot, 662), { forecast: null, affordable: null, shortfall: null });
});
