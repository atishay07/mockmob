import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runtimeBindingV73 } from '../v73_runtime_contract.mjs';
import { factoryCurrentValidation } from '../factory_current_validation.mjs';
import { expectedReleaseBindingV73 } from '../../scripts/pipeline/lib/releaseEvidenceV73.mjs';
import { expectedReleaseBindingV74 } from '../../scripts/pipeline/lib/releaseEvidenceV74.mjs';
import { CALIBRATION_RELEASE, FACTORY_POLICY } from '../question_factory_policy.mjs';
import { FACTORY_VERIFIER_VERSION } from '../../scripts/pipeline/lib/factoryEvidence.mjs';

const root = process.cwd();
const metadataPath = resolve(root, 'data/cuet_v73_runtime_binding.json');
const baseReadText = path => readFileSync(path, 'utf8');
const changedMetadata = mutate => path => {
  if (path !== metadataPath) return baseReadText(path);
  const metadata = JSON.parse(baseReadText(path));
  mutate(metadata);
  return JSON.stringify(metadata);
};

test('unbundled runtime binding matches the frozen metadata and expected v7.3 release binding', () => {
  assert.deepEqual(runtimeBindingV73({ root }), expectedReleaseBindingV73());
});

test('runtime contract detects raw parent and additive source changes', () => {
  const tamper = suffix => path => path.endsWith(suffix) ? `${baseReadText(path)}\n// test-only tamper` : baseReadText(path);
  assert.throws(() => runtimeBindingV73({ root, readText: tamper('factoryEvidenceV7.mjs') }), /runtime_v73_parent_contract_changed/);
  assert.throws(() => runtimeBindingV73({ root, readText: tamper('verifyV73.mjs') }), /runtime_v73_additive_contract_changed/);
});

test('runtime contract rejects invalid metadata, missing metadata and duplicate bindings', () => {
  assert.throws(() => runtimeBindingV73({ root, readText: changedMetadata(metadata => { metadata.schema = 'unknown'; }) }), /runtime_v73_contract_metadata_invalid/);
  assert.throws(() => runtimeBindingV73({ root, readText: changedMetadata(metadata => { metadata.parent_files[1] = metadata.parent_files[0]; }) }), /runtime_v73_contract_metadata_invalid/);
  assert.throws(() => runtimeBindingV73({ root, readText: changedMetadata(metadata => { metadata.additive_files.pop(); }) }), /runtime_v73_contract_metadata_invalid/);
  const missing = path => {
    if (path === metadataPath) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    return baseReadText(path);
  };
  assert.throws(() => runtimeBindingV73({ root, readText: missing }), /ENOENT|missing/);
});

function legacyReadyFixture(registry) {
  const version = FACTORY_VERIFIER_VERSION;
  const accuracy = { sample_size: 1, luna_answered: 1, gemini_answered: 1 };
  const route = { released: true, independent: true, split_disjoint: true, verifier_version: version,
    source_registry_version: registry.version, valid_sample_size: 1, valid_survival: 1,
    critical_false_accepts: 0, missing_categories: [], blind_answer_accuracy: accuracy };
  return {
    state: 'released', version: FACTORY_POLICY, source_registry_version: registry.version,
    verifier_version: version, critical_false_accepts: 0, missing_categories: [],
    benchmark: { protocol: 'frozen-unobserved-cuET-v1', unseen_at_freeze: true, state: 'completed',
      payload_hash: 'a'.repeat(64), registry_version: registry.version, verifier_version: version },
    quality_regression: { verifier_version: version, source_registry_version: registry.version, sample_size: 18, false_accepts: 0 },
    routes: Object.fromEntries(['conceptual', 'numerical', 'passage'].map(name => [name, route])),
    by_subject: Object.fromEntries(['english', 'accountancy', 'business_studies', 'economics'].map(name => [name, accuracy])),
    release_policy: CALIBRATION_RELEASE, valid_survival: 0.9, abstention: { luna: 0, gemini: 0 },
  };
}

test('admin readiness fails closed with bounded reasons and never maps legacy readiness to the current v7.4 readiness', () => {
  const registry = { version: 58 };
  const manifest = legacyReadyFixture(registry);
  const unavailable = factoryCurrentValidation(manifest, registry, { readBinding: () => { throw new Error('ENOENT: private path'); } });
  assert.equal(unavailable.verifier_version, 'cuet-fit-validator-v7.4');
  assert.equal(unavailable.topology, 'dual_blind');
  assert.equal(unavailable.validation_contract_hash, null);
  assert.equal(unavailable.ready, false);
  assert.equal(unavailable.readiness_reason, 'runtime_v74_contract_unavailable');
  assert.equal(unavailable.legacy_ready, true);

  const knownFailure = factoryCurrentValidation({}, registry, { readBinding: () => { throw new Error('runtime_v73_parent_contract_changed'); } });
  assert.equal(knownFailure.ready, false);
  assert.equal(knownFailure.readiness_reason, 'runtime_v73_parent_contract_changed');
  assert.equal(knownFailure.legacy_ready, false);

  const current = factoryCurrentValidation({}, registry);
  assert.equal(current.verifier_version, expectedReleaseBindingV74().verifier_version);
  assert.equal(current.validation_contract_hash, expectedReleaseBindingV74().validation_contract_hash);
  assert.equal(current.ready, false);
  assert.equal(current.readiness_reason, 'v74_current_release_required');
});
