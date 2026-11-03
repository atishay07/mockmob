import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyRegisteredCampaign } from '../lib/parallelMeasurementRegistrationVNext.mjs';
import { assertPublicationPolicy } from '../lib/campaignExecutionV7.mjs';
import { qualifyCuetFitCampaignV76 } from '../tools/publishCuetFitCampaignV76.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');

test('frozen A/B worker stays byte-bound and measurement registrations remain non-publishable', () => {
  const registration = JSON.parse(readFileSync('artifacts/question-factory/cuet-readiness-2026-10-08/parallel-measurement-registration.json', 'utf8'));
  assert.equal(sha256(readFileSync('scripts/pipeline/tools/cuetFitFactory.mjs')), registration.worker_script_sha256);
  for (const arm of ['baseline', 'improved']) {
    const { profile } = verifyRegisteredCampaign(arm, { args: registration.worker_mode });
    assert.equal(profile.measurement_only, true);
    assert.equal(profile.publication_policy, 'never');
    assert.throws(() => assertPublicationPolicy(profile), /measurement_campaign_cannot_publish/);
  }
});

test('v76 rejects the frozen measurement profile before any staging dependency can be used', () => {
  const registration = JSON.parse(readFileSync('artifacts/question-factory/cuet-readiness-2026-10-08/parallel-measurement-registration.json', 'utf8'));
  const { campaign, profile } = verifyRegisteredCampaign('improved', { args: registration.worker_mode });
  assert.throws(() => qualifyCuetFitCampaignV76({ profile, campaign, report: {}, jobs: [], manifest: {}, registry: { version: profile.registry_version } }),
    /staging_profile_required/);
});
