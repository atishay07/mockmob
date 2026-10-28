import test from 'node:test';
import assert from 'node:assert/strict';
import { factoryCurrentValidation } from '../factory_current_validation.mjs';
import { expectedReleaseBindingV74 } from '../../scripts/pipeline/lib/releaseEvidenceV74.mjs';
import { RELEASE_POLICY_V7, REQUIRED_SUBJECTS } from '../../scripts/pipeline/lib/releaseEvidenceV7.mjs';
import { publicationEligibility } from '../evidence_registry.js';

// Synthetic release rows test control plumbing; they never certify model quality.
const registry = { version: 58 };
function fixture() {
  const binding = expectedReleaseBindingV74();
  const release = { ...binding, state: 'released', problems: [], fresh_false_accepts: [], regression_false_accepts: [],
    valid_survival: .9, valid_by_subject: Object.fromEntries(REQUIRED_SUBJECTS.map(s => [s, { n: 10, ok: 9 }])),
    release_policy: RELEASE_POLICY_V7, source_registry_version: registry.version, critical_false_accepts: 0,
    benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) } };
  return { binding, manifest: { cuet_fit_releases: { dual_blind: release } } };
}

test('admin readiness binds the current verifier rather than a released legacy state', () => {
  assert.equal(factoryCurrentValidation({ state: 'released' }, registry).ready, false);
  const { binding, manifest } = fixture();
  const current = factoryCurrentValidation(manifest, registry);
  assert.equal(current.ready, true);
  assert.equal(current.verifier_version, binding.verifier_version);
  assert.equal(current.validation_contract_hash, binding.validation_contract_hash);
  const changed = structuredClone(manifest);
  changed.cuet_fit_releases.dual_blind.validation_contract_hash = '0'.repeat(64);
  assert.equal(factoryCurrentValidation(changed, registry).ready, false);
  assert.equal(factoryCurrentValidation(manifest, { version: 59 }).ready, false);
  const invalid = structuredClone(manifest);
  invalid.cuet_fit_releases.dual_blind.critical_false_accepts = 1;
  assert.equal(factoryCurrentValidation(invalid, registry).ready, false);
});

test('the student publication path rejects a stale signed-contract binding before content checks', () => {
  const { binding, manifest } = fixture();
  const q = { id: 'runtime-fixture', status: 'live', evidence: { record: { verifier_version: binding.verifier_version,
    validation_topology: 'dual_blind', validation_contract_hash: '0'.repeat(64),
    checks: { blind_solution: { evaluation_prompt: binding.prompt_hash } } } } };
  assert.deepEqual(publicationEligibility(q, { registry, manifest }), { eligible: false, reasons: ['current_cuet_contract_release_required'] });
  const unknown = structuredClone(q);
  unknown.evidence.record.verifier_version = 'cuet-fit-validator-v7.5';
  const matchingUnknown = structuredClone(manifest);
  matchingUnknown.cuet_fit_releases.dual_blind.verifier_version = unknown.evidence.record.verifier_version;
  assert.deepEqual(publicationEligibility(unknown, { registry, manifest: matchingUnknown }), { eligible: false, reasons: ['current_cuet_contract_release_required'] });
  const exact = structuredClone(q);
  exact.evidence.record.validation_contract_hash = binding.validation_contract_hash;
  // Matching the contract must continue into signature/content validation, never approve an unsigned row.
  const exactVerdict = publicationEligibility(exact, { registry, manifest });
  assert.equal(exactVerdict.eligible, false);
  assert.equal(exactVerdict.reasons.includes('current_cuet_contract_release_required'), false);
});
