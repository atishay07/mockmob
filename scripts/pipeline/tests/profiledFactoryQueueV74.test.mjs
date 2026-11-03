import test from 'node:test';
import assert from 'node:assert/strict';
import { currentRegistry } from '../../../data/evidence_registry.js';
import { RELEASE_POLICY_V7 } from '../lib/releaseEvidenceV7.mjs';
import { expectedReleaseBindingV74 } from '../lib/releaseEvidenceV74.mjs';
import { FACTORY_PROFILE_V74, createFactoryProfileV74, assertFactoryProfileV74 } from '../lib/factoryProfileV74.mjs';
import { assertPinnedProfiledQueueJob, reconstructProfiledOriginalBrief, routeQueueValidation, validationPathForQueueJob } from '../lib/profiledFactoryQueueV73.mjs';
import { ORIGINAL_AUTHOR_POLICY_V74 } from '../lib/originalAuthorPolicyV74.mjs';

const registry = currentRegistry();
function releasedManifest() {
  const binding = expectedReleaseBindingV74();
  return { cuet_fit_releases: { dual_blind: {
    state: 'released', topology: 'dual_blind', problems: [], fresh_false_accepts: [], regression_false_accepts: [],
    valid_survival: 0.9, valid_by_subject: Object.fromEntries(['accountancy','business_studies','economics','english'].map(subject=>[subject,{n:10,ok:9}])),
    release_policy: RELEASE_POLICY_V7, verifier_version: binding.verifier_version, prompt_hash: binding.prompt_hash,
    cuet_fit_contract: binding.cuet_fit_contract, effort_policy: binding.effort_policy, efforts: binding.efforts,
    validation_contract_hash: binding.validation_contract_hash, source_registry_version: registry.version,
    critical_false_accepts: 0, benchmark: { state: 'completed', payload_hash: 'a'.repeat(64) },
  } } };
}
function pinnedRow(profile) {
  return { id: 'v74-profiled-job-001', kind: 'original_practice', anchor_id: null, subject: 'economics', chapter: 'Consumer Behaviour', state: 'waiting',
    generation_brief: { validation_profile: profile, campaign_cap_usd: 4, campaign_denominator: 1,
      campaign_candidate_ids: ['v74-profiled-job-001'], family_id: 'fam-v74', topic: 'utility', format: 'conceptual_mcq',
      v73_worker_state: { repair_state: 'complete' } } };
}

test('V74 profile binds exact frozen validator/prompt/contract and current release; no release means no profile',()=>{
  const manifest = releasedManifest();
  const profile = createFactoryProfileV74({ campaignId: 'v74-runtime-campaign', manifest, registry });
  assert.equal(profile.profile_version, FACTORY_PROFILE_V74);
  assert.deepEqual(Object.fromEntries(Object.keys(expectedReleaseBindingV74()).map(key=>[key,profile[key]])), expectedReleaseBindingV74());
  assert.equal(profile.prompt_hash,'7683aa3e5de157e85178f2086ac47c8c6dc5ec7f01ffce3f76d6c575b018c44b');
  assert.equal(profile.validation_contract_hash,'e49ee5a979a01e649b294e726264e7d3611a1d32a19f4b624be35c9bd14fd661');
  assert.equal(assertFactoryProfileV74(profile,{manifest,registry}).profile_sha256,profile.profile_sha256);
  assert.throws(()=>createFactoryProfileV74({campaignId:'v74-no-release',manifest:{},registry}),/v74_current_release_required/);
  assert.throws(()=>assertFactoryProfileV74(profile,{manifest:{},registry}),/v74_current_release_required/);
});

test('current profiled queue routes V74 to its validator and reconstructs the same brief after restart',async()=>{
  const profile=createFactoryProfileV74({campaignId:'v74-runtime-campaign',manifest:releasedManifest(),registry});
  const row=pinnedRow(profile);
  assert.equal(validationPathForQueueJob(row),'v74');
  const restored=reconstructProfiledOriginalBrief(row,profile);
  assert.equal(restored.id,row.id);assert.equal(restored.topic,'utility');
  assert.equal('validation_profile' in restored,false);assert.equal('v73_worker_state' in restored,false);
  let v73=0,v74=0,legacy=0;
  const result=await routeQueueValidation(row,{id:row.id},{assertProfile:p=>assertFactoryProfileV74(p,{manifest:releasedManifest(),registry}),
    validateV73:async()=>{v73++;},validateV74:async(candidate,pinned)=>{v74++;assert.equal(pinned.profile_sha256,profile.profile_sha256);return 'v74-current-result';},
    validateLegacy:async()=>{legacy++;}});
  assert.equal(result,'v74-current-result');assert.deepEqual({v73,v74,legacy},{v73:0,v74:1,legacy:0});
  assert.equal(assertPinnedProfiledQueueJob(row,{assertProfile:p=>assertFactoryProfileV74(p,{manifest:releasedManifest(),registry})}).profile_version,FACTORY_PROFILE_V74);
});

test('V73 and legacy queue routes stay isolated; unknown pins fail closed without validator fallback',async()=>{
  assert.equal(validationPathForQueueJob({generation_brief:{topic:'legacy'}}),'legacy');
  const unknown={...pinnedRow({campaign_id:'c',profile_sha256:'b'.repeat(64),profile_version:'future-v9'})};
  assert.throws(()=>validationPathForQueueJob(unknown),/unknown_version/);
  const v73={...pinnedRow({campaign_id:'v73-campaign',profile_sha256:'c'.repeat(64),profile_version:'factory-validation-profile-v1'})};
  assert.equal(validationPathForQueueJob(v73),'v73');
  let legacy=0,v73calls=0;
  await assert.rejects(()=>routeQueueValidation(unknown,{}, {validateV74:async()=>{},validateV73:async()=>{v73calls++;},validateLegacy:async()=>{legacy++;}}),/unknown_version/);
  assert.deepEqual({legacy,v73calls},{legacy:0,v73calls:0});
});

test('no released V74 manifest blocks profile-pinned dispatch before transport calls',async()=>{
  let dispatches=0;
  const row=pinnedRow({ ...createFactoryProfileV74({campaignId:'v74-runtime-campaign',manifest:releasedManifest(),registry}) });
  await assert.rejects(()=>routeQueueValidation(row,{}, {assertProfile:p=>assertFactoryProfileV74(p,{manifest:{},registry}),
    validateV74:async()=>{dispatches++;return 'dispatched';},validateV73:async()=>{dispatches++;},validateLegacy:async()=>{dispatches++;}}),/v74_current_release_required/);
  assert.equal(dispatches,0);
  assert.equal(ORIGINAL_AUTHOR_POLICY_V74,'original-practice-source-explanations-v74');
});
