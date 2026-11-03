import test from 'node:test';
import assert from 'node:assert/strict';
import { RELEASE_POLICY_V7, REQUIRED_SUBJECTS } from '../lib/releaseEvidenceV7.mjs';
import { expectedReleaseBindingV713 } from '../lib/releaseEvidenceV713.mjs';
import { expectedReleaseBindingV76 } from '../lib/releaseEvidenceV76.mjs';
import { createFactoryProfileV713, assertFactoryProfileV713 } from '../lib/factoryProfileV713.mjs';
import { assertCuetFitPublicationQualificationV713, publicationPayloadHashV713 } from '../lib/cuetFitPublicationV713.mjs';

const registry = { version: 'synthetic-registry-v713' };
function releasedManifest(binding) {
  return { cuet_fit_releases: { dual_blind: {
    state: 'released', topology: 'dual_blind', problems: [], fresh_false_accepts: [], regression_false_accepts: [],
    valid_survival: 0.9,
    valid_by_subject: Object.fromEntries(REQUIRED_SUBJECTS.map(subject => [subject, { n: 10, ok: 9 }])),
    release_policy: RELEASE_POLICY_V7, ...binding, source_registry_version: registry.version,
    critical_false_accepts: 0, benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) },
  } } };
}

function publicationFixture() {
  const manifest = releasedManifest(expectedReleaseBindingV713());
  const profile = createFactoryProfileV713({ campaignId: 'offline-v713-publish', manifest, registry });
  const stages = ['blind_solution', 'independent_evaluation', 'explanation_support'];
  const job = { id: 'q-v713', state: 'eligible', candidate: { id: 'q-v713', subject: 'economics', chapter: 'Production & Costs',
    question_type: 'direct_concept', difficulty: 'medium', concept_id: 'concept-v713', body: 'A question body.', options: ['A', 'B', 'C', 'D'],
    correct_answer: 'A', evidence: { record: { candidate_id: 'q-v713', validation_topology: profile.topology,
      verifier_version: profile.verifier_version, validation_contract_hash: profile.validation_contract_hash,
      checks: Object.fromEntries(stages.map(stage => [stage, { prompt_version: profile.verifier_version,
        evaluation_prompt: profile.prompt_hash, validation_contract_hash: profile.validation_contract_hash }])) } } } };
  const jobs = [job], campaign = { id: profile.campaign_id, jobs: [{ id: job.id }], publication_policy: 'released_staging_only' };
  const report = { id: campaign.id, denominator: 1, approved_unique: 1, complete: true,
    publication_accounting: { ready: true }, cost: { held_usd: 0 }, jobs };
  const run = { execution_finished: true, receipt_complete: true, held_usd: 0, campaign_id: campaign.id,
    profile_sha256: profile.profile_sha256, candidate_payload_hash: publicationPayloadHashV713(jobs) };
  return { manifest, profile, job, jobs, campaign, report, run };
}

test('V713 profile accepts only its own current release binding and rejects V76 profiles', () => {
  const v713Manifest = releasedManifest(expectedReleaseBindingV713());
  const v713 = createFactoryProfileV713({ campaignId: 'offline-v713-profile', manifest: v713Manifest, registry });
  assert.equal(assertFactoryProfileV713(v713, { manifest: v713Manifest, registry }), v713);
  assert.throws(() => assertFactoryProfileV713({ ...v713, prompt_hash: 'old-prompt' }, { manifest: v713Manifest, registry }), /binding_mismatch:prompt_hash/);

  const v76Manifest = releasedManifest(expectedReleaseBindingV76());
  const v76 = { profile_version: 'factory-validation-profile-v76-v1', ...expectedReleaseBindingV76(), campaign_id: 'offline-v713-profile' };
  assert.ok(v76Manifest.cuet_fit_releases.dual_blind);
  assert.throws(() => assertFactoryProfileV713(v76, { manifest: v713Manifest, registry }), /unknown_version/);
});

test('V713 publication gate requires exact current prompt and contract receipts on every selected job', () => {
  const f = publicationFixture();
  assert.deepEqual(assertCuetFitPublicationQualificationV713({ ...f, registry, evidenceEligibility: () => ({ eligible: true }) }), f.jobs);

  f.job.candidate.evidence.record.checks.independent_evaluation.validation_contract_hash = 'stale-contract';
  f.run.candidate_payload_hash = publicationPayloadHashV713(f.jobs);
  assert.throws(() => assertCuetFitPublicationQualificationV713({ ...f, registry, evidenceEligibility: () => ({ eligible: true }) }),
    /publication_evidence_required:q-v713/);
});
