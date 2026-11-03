import test from 'node:test';
import assert from 'node:assert/strict';
import { cuetFitReleased } from '../../../data/cuet_fit_evidence.mjs';
import { expectedReleaseBinding, RELEASE_POLICY_V7, REQUIRED_SUBJECTS } from '../lib/releaseEvidenceV7.mjs';
import { buildCuetFitTopologyReleaseVNext, currentCuetCalibrationReadyVNext, releaseBenchmarkStateVNext } from '../lib/currentCuetCalibrationGateVNext.mjs';

const binding = expectedReleaseBinding();
const registry = { version: 58 };
function passingAssessment(overrides = {}) {
  return {
    state: 'released', topology: 'dual_blind', policy: structuredClone(RELEASE_POLICY_V7), problems: [],
    metrics: {
      fresh_false_accepts: [], regression_false_accepts: [], valid_survival: 0.9,
      valid_by_subject: Object.fromEntries(REQUIRED_SUBJECTS.map(subject => [subject, { n: 10, ok: 9 }])),
      fresh_defects: 10, regression_defects: 10, valid_items: 40,
    },
    ...overrides,
  };
}
function produce(assessment = passingAssessment(), overrides = {}) {
  return buildCuetFitTopologyReleaseVNext({
    assessment, resultFresh: { benchmark: { id: 'full-release-fixture-v7', payload_hash: 'a'.repeat(64) } },
    topology: 'dual_blind', tag: 'v7.1', freshName: 'v3', binding,
    sourceRegistryVersion: registry.version, at: '2026-10-08T00:00:00.000Z', ...overrides,
  });
}
const manifest = (release) => ({ state: 'released', cuet_fit_releases: { dual_blind: release } });

test('legacy released v6 manifest cannot unlock current CUET publication', () => {
  const old = { state: 'released', verifier_version: 'legacy-v6.2', benchmark: { state: 'completed' } };
  assert.equal(currentCuetCalibrationReadyVNext({ manifest: old, registry }), false);
});

test('exact current dual-blind binding passes the current release predicate', () => {
  const m = manifest(produce());
  assert.equal(currentCuetCalibrationReadyVNext({ manifest: m, registry }), true);
  assert.equal(cuetFitReleased(m, registry, {
    validation_topology: 'dual_blind', verifier_version: binding.verifier_version,
    checks: { blind_solution: { evaluation_prompt: binding.prompt_hash } },
  }), true);
});

test('stale validation hash, prompt, source version, or effort/provider policy fail closed', () => {
  const base = produce();
  const changes = [
    { validation_contract_hash: '0'.repeat(64) },
    { prompt_hash: 'old-prompt' },
    { source_registry_version: registry.version - 1 },
    { effort_policy: 'old-effort-policy' },
    { efforts: { ...structuredClone(binding.efforts), gemini: 'high' } },
    { topology: 'single_luna' },
    { benchmark: { id: 'full-release-fixture-v7', payload_hash: 'a'.repeat(64) } },
    { fresh_false_accepts: ['false-accept'] },
    { release_policy: { ...structuredClone(RELEASE_POLICY_V7), valid_survival_min: 0.8 } },
    { valid_by_subject: { ...base.valid_by_subject, english: { n: 10, ok: 6 } } },
  ];
  for (const change of changes) assert.equal(currentCuetCalibrationReadyVNext({ manifest: manifest({ ...base, ...change }), registry }), false);
});

test('actual release builder counts both false-accept lists and roundtrips to frozen/runtime predicates', () => {
  const release = produce();
  const m = manifest(release);
  assert.equal(release.critical_false_accepts, 0);
  assert.equal(release.benchmark.state, 'completed');
  assert.equal(cuetFitReleased(m, registry, {
    validation_topology: 'dual_blind', verifier_version: binding.verifier_version,
    checks: { blind_solution: { evaluation_prompt: binding.prompt_hash } },
  }), true);
  assert.equal(currentCuetCalibrationReadyVNext({ manifest: m, registry }), true);

  const failing = produce(passingAssessment({ state: 'paused', problems: ['fresh_defect_false_accepts_1'], metrics: {
    ...passingAssessment().metrics, fresh_false_accepts: ['fixture-false-accept'], regression_false_accepts: ['regression-false-accept'],
  } }));
  assert.equal(failing.critical_false_accepts, 2);
  assert.equal(failing.state, 'paused');
  assert.equal(failing.benchmark.state, 'pending');
  assert.equal(currentCuetCalibrationReadyVNext({ manifest: manifest(failing), registry }), false);
});

test('release builder fails closed if either false-accept list is missing', () => {
  const assessment = passingAssessment();
  delete assessment.metrics.regression_false_accepts;
  assert.throws(() => produce(assessment), /release_false_accept_metrics_required/);
});

test('release producer marks benchmark completed only after the assessment passed', () => {
  assert.equal(releaseBenchmarkStateVNext({ state: 'released', problems: [] }), 'completed');
  assert.equal(releaseBenchmarkStateVNext({ state: 'paused', problems: [] }), 'pending');
  assert.equal(releaseBenchmarkStateVNext({ state: 'released', problems: ['bad_binding'] }), 'pending');
  const incomplete = { ...produce(), benchmark: { id: 'id', payload_hash: 'a'.repeat(64), state: releaseBenchmarkStateVNext({ state: 'paused', problems: ['pending'] }) } };
  assert.equal(currentCuetCalibrationReadyVNext({ manifest: manifest(incomplete), registry }), false);
});
