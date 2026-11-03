import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactoryProfileV73, assertFactoryProfileV73, pinNewJobsToFactoryProfileV73 } from '../lib/factoryProfileV73.mjs';
import { expectedReleaseBindingV73 } from '../lib/releaseEvidenceV73.mjs';
import { RELEASE_POLICY_V7 } from '../lib/releaseEvidenceV7.mjs';
import { evaluationCacheKeyV73 } from '../lib/contractV73.mjs';
import { v73RuntimeEvidenceCurrent } from '../../../data/v73_runtime_evidence.mjs';

const registry = { version: 58 };
const subjects = ['accountancy', 'business_studies', 'economics', 'english'];

function releasedManifest(sourceRegistry = registry) {
  const binding = expectedReleaseBindingV73();
  const release = {
    ...binding,
    state: 'released',
    problems: [],
    fresh_false_accepts: [],
    regression_false_accepts: [],
    valid_survival: 0.9,
    valid_by_subject: Object.fromEntries(subjects.map(subject => [subject, { ok: 9, n: 10 }])),
    release_policy: RELEASE_POLICY_V7,
    critical_false_accepts: 0,
    source_registry_version: sourceRegistry.version,
    benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) },
  };
  return { cuet_fit_releases: { [binding.topology]: release } };
}

test('profile binds exact v7.3 contract, source registry and current release', () => {
  const manifest = releasedManifest();
  const profile = createFactoryProfileV73({ campaignId: 'prospective-73', manifest, registry });
  assert.equal(assertFactoryProfileV73(profile, { manifest, registry }), profile);
  assert.throws(() => createFactoryProfileV73({ campaignId: 'prospective-73', manifest: {}, registry }), /v73_current_release_required/);
  assert.throws(() => assertFactoryProfileV73({ ...profile, extra: true }, { manifest, registry }), /unknown_or_missing_field/);
  assert.throws(() => assertFactoryProfileV73({ ...profile, profile_version: 'unknown' }, { manifest, registry }), /unknown_version/);
  assert.throws(() => assertFactoryProfileV73({ ...profile, validation_contract_hash: '0'.repeat(64) }, { manifest, registry }), /binding_mismatch/);
  assert.throws(() => assertFactoryProfileV73(profile, { manifest, registry: { version: 59 } }), /current_release_required/);
  const changed = structuredClone(manifest);
  changed.cuet_fit_releases.dual_blind.benchmark.payload_hash = 'b'.repeat(64);
  assert.throws(() => assertFactoryProfileV73(profile, { manifest: changed, registry }), /current_release_mismatch/);
});

test('pinning clones only unpinned new jobs and preserves their other fields', () => {
  const manifest = releasedManifest();
  const profile = createFactoryProfileV73({ campaignId: 'prospective-73', manifest, registry });
  const jobs = [{ id: 'new-job', subject: 'english', generation_brief: { source_refs: ['s1'] }, state: 'queued' }];
  const pinned = pinNewJobsToFactoryProfileV73(jobs, profile);
  assert.equal(jobs[0].generation_brief.validation_profile, undefined);
  assert.deepEqual(pinned[0].generation_brief.source_refs, ['s1']);
  assert.equal(pinned[0].generation_brief.validation_profile.profile_sha256, profile.profile_sha256);
  assert.notEqual(pinned[0].generation_brief.validation_profile, profile);
  assert.throws(() => pinNewJobsToFactoryProfileV73([pinned[0]], profile), /already_pinned/);
  assert.throws(() => pinNewJobsToFactoryProfileV73([{ id: 'old', candidate: {} }], profile), /new_jobs_only/);
});

test('student evidence rejects unknown v7 versions and requires the exact current v7.3 release', () => {
  const manifest = releasedManifest();
  const binding = expectedReleaseBindingV73();
  const record = { verifier_version: binding.verifier_version, validation_contract_hash: binding.validation_contract_hash };
  assert.equal(v73RuntimeEvidenceCurrent({ verifier_version: 'cuet-fit-validator-v7.4' }, { manifest, registry }), false);
  assert.equal(v73RuntimeEvidenceCurrent({ verifier_version: 'cuet-fit-validator-v7.2' }, { manifest: {}, registry }), true);
  assert.equal(v73RuntimeEvidenceCurrent(record, { manifest, registry }), true);
  assert.equal(v73RuntimeEvidenceCurrent(record, { manifest: {}, registry }), false);
  const changed = structuredClone(manifest);
  changed.cuet_fit_releases.dual_blind.validation_contract_hash = 'b'.repeat(64);
  assert.equal(v73RuntimeEvidenceCurrent(record, { manifest: changed, registry }), false);
});

test('evaluation cache identity separates validation-contract hashes', () => {
  const input = { candidate_id: 'x' };
  const base = { input, provider: 'openai', model: 'gpt-6-luna', effort: 'high', output: 7500, promptHash: 'p', policyVersion: 'cuet-llm-v3' };
  assert.notEqual(
    evaluationCacheKeyV73({ ...base, contractHash: 'a'.repeat(64) }),
    evaluationCacheKeyV73({ ...base, contractHash: 'b'.repeat(64) }),
  );
});
