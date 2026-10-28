import test from 'node:test';
import assert from 'node:assert/strict';
import { currentRegistry } from '../../../data/evidence_registry.js';
import { RELEASE_POLICY_V7 } from '../lib/releaseEvidenceV7.mjs';
import { expectedReleaseBindingV76 } from '../lib/releaseEvidenceV76.mjs';
import { FACTORY_PROFILE_V76, createFactoryProfileV76, assertFactoryProfileV76 } from '../lib/factoryProfileV76.mjs';

const registry = currentRegistry();
function releasedManifest() {
  const binding = expectedReleaseBindingV76();
  return { cuet_fit_releases: { dual_blind: { state: 'released', topology: 'dual_blind', problems: [],
    fresh_false_accepts: [], regression_false_accepts: [], valid_survival: .9,
    valid_by_subject: Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(s => [s, { n: 10, ok: 9 }])),
    release_policy: RELEASE_POLICY_V7, ...binding, source_registry_version: registry.version,
    critical_false_accepts: 0, benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) } } } };
}

test('v76 profile binds current release, source registry and exact current academic contract', () => {
  const manifest = releasedManifest(), profile = createFactoryProfileV76({ campaignId: 'offline-v76-profile', manifest, registry });
  assert.equal(profile.profile_version, FACTORY_PROFILE_V76);
  for (const [key, value] of Object.entries(expectedReleaseBindingV76())) assert.deepEqual(profile[key], value);
  assert.equal(assertFactoryProfileV76(profile, { manifest, registry }), profile);
  assert.throws(() => createFactoryProfileV76({ campaignId: 'offline-v76-profile', manifest: {}, registry }), /v76_current_release_required/);
  assert.throws(() => assertFactoryProfileV76(profile, { manifest: {}, registry }), /v76_current_release_required/);
});

test('unknown fields, old versions and changed bindings fail closed without profile fallback', () => {
  const manifest = releasedManifest(), profile = createFactoryProfileV76({ campaignId: 'offline-v76-profile', manifest, registry });
  assert.throws(() => assertFactoryProfileV76({ ...profile, profile_version: 'factory-validation-profile-v75-v1' }, { manifest, registry }), /unknown_version/);
  assert.throws(() => assertFactoryProfileV76({ ...profile, extra: true }, { manifest, registry }), /unknown_or_missing_field/);
  assert.throws(() => assertFactoryProfileV76({ ...profile, prompt_hash: 'b'.repeat(64) }, { manifest, registry }), /binding_mismatch:prompt_hash/);
  assert.throws(() => assertFactoryProfileV76({ ...profile, profile_sha256: 'b'.repeat(64) }, { manifest, registry }), /hash_mismatch/);
  const changed = structuredClone(manifest); changed.cuet_fit_releases.dual_blind.prompt_hash = 'old';
  assert.throws(() => assertFactoryProfileV76(profile, { manifest: changed, registry }), /v76_current_release_required/);
  assert.throws(() => assertFactoryProfileV76(profile, { manifest, registry: { ...registry, version: registry.version + '-changed' } }), /v76_current_release_required/);
});
