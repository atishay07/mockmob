import { canonicalJSON } from '../../../data/canonical_json.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { currentCuetCalibrationReadyVNext } from './currentCuetCalibrationGateVNext.mjs';
import { expectedReleaseBindingV75 } from './releaseEvidenceV75.mjs';

export const FACTORY_PROFILE_V75 = 'factory-validation-profile-v75-v1';
const sha = value => hashJSON(canonicalJSON(value));
const validCampaignId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{2,79}$/i.test(id);
const profileKeys = binding => ['profile_version', 'campaign_id', ...Object.keys(binding),
  'source_registry_version', 'source_registry_sha256', 'release_sha256', 'profile_sha256'].sort();
const releaseFor = (manifest, binding) => manifest?.cuet_fit_releases?.[binding.topology];

function baseProfile({ campaignId, binding, registry, release }) {
  return { profile_version: FACTORY_PROFILE_V75, campaign_id: campaignId, ...binding,
    source_registry_version: registry.version, source_registry_sha256: sha(registry), release_sha256: sha(release) };
}

export function createFactoryProfileV75({ campaignId, manifest, registry }) {
  const binding = expectedReleaseBindingV75(), release = releaseFor(manifest, binding);
  if (!validCampaignId(campaignId)) throw new Error('factory_campaign_id_required');
  if (!registry || typeof registry !== 'object' || !release ||
      !currentCuetCalibrationReadyVNext({ manifest, registry, binding })) throw new Error('v75_current_release_required');
  const profile = baseProfile({ campaignId, binding, registry, release });
  return { ...profile, profile_sha256: sha(profile) };
}

export function assertFactoryProfileV75(profile, { manifest, registry } = {}) {
  const binding = expectedReleaseBindingV75();
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('factory_validation_profile_required');
  if (profile.profile_version !== FACTORY_PROFILE_V75) throw new Error('factory_validation_profile_unknown_version');
  if (Object.keys(profile).sort().join('|') !== profileKeys(binding).join('|')) throw new Error('factory_validation_profile_unknown_or_missing_field');
  if (!validCampaignId(profile.campaign_id)) throw new Error('factory_campaign_id_required');
  if (!registry || typeof registry !== 'object') throw new Error('factory_validation_profile_registry_required');
  const release = releaseFor(manifest, binding);
  if (!release || !currentCuetCalibrationReadyVNext({ manifest, registry, binding })) throw new Error('v75_current_release_required');
  const expected = baseProfile({ campaignId: profile.campaign_id, binding, registry, release });
  for (const [key, value] of Object.entries(binding)) {
    if (canonicalJSON(profile[key]) !== canonicalJSON(value)) throw new Error(`factory_validation_profile_binding_mismatch:${key}`);
  }
  if (profile.source_registry_version !== expected.source_registry_version || profile.source_registry_sha256 !== expected.source_registry_sha256 ||
      profile.release_sha256 !== expected.release_sha256) throw new Error('factory_validation_profile_current_release_mismatch');
  if (profile.profile_sha256 !== sha(expected)) throw new Error('factory_validation_profile_hash_mismatch');
  return profile;
}
