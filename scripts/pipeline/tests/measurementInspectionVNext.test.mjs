import test from 'node:test';
import assert from 'node:assert/strict';
import {measurementInspectionEligibility} from '../lib/measurementInspectionVNext.mjs';
import {publicationEligibility} from '../../../data/evidence_registry.js';
const profile={measurement_only:true,publication_policy:'never',verifier_version:'cuet-fit-validator-v7.2',topology:'dual_blind',prompt_hash:'frozen'};
const q={id:'candidate',evidence:{record:{verifier_version:profile.verifier_version,validation_topology:'dual_blind',checks:{blind_solution:{evaluation_prompt:'frozen'}}}}};
test('measurement inspection checks current signed evidence without treating an absent release as an academic defect',()=>{
 let checked=0,published=0;const registry={version:1};
 const eligible=measurementInspectionEligibility(profile,registry,['candidate'],{evaluate:(item,r)=>{assert.equal(r,registry);checked++;return {eligible:false,reasons:['untrusted_evidence']};},published:()=>{published++;return {eligible:false,reasons:['legacy_not_eligible']};}});
 assert.equal(eligible(q).reasons[0],'untrusted_evidence');assert.equal(checked,1);assert.equal(published,0);
 assert.equal(eligible({...q,id:'legacy'}).reasons[0],'legacy_not_eligible');assert.equal(published,1);
 assert.equal(eligible({...q,evidence:{record:{...q.evidence.record,verifier_version:'old'}}}).reasons[0],'measurement_inspection_contract_mismatch');assert.equal(checked,1);
});
test('measurement inspection cannot authorize a publishable profile or bypass the real signature/release checks',()=>{
 assert.throws(()=>measurementInspectionEligibility({...profile,publication_policy:'released_staging_only'},{},['candidate']),/fixed_scope_required/);
 assert.equal(measurementInspectionEligibility(profile,{},['candidate'])(q).eligible,false);
 assert.equal(publicationEligibility(q,{registry:{},manifest:{}}).eligible,false);
});
