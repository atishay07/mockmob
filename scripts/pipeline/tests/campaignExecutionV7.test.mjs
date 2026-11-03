import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationPolicy,executionPolicy,assertPublicationPolicy,assertCampaignBudget,maximumRequestMicro} from '../lib/campaignExecutionV7.mjs';
test('unreleased measurement needs explicit staging and is permanently nonpublishing',()=>{
 const p=registrationPolicy({measurementOnly:true,staging:true,capUsd:4});
 assert.equal(p.publication_policy,'never');
 assert.equal(executionPolicy(p,{measurementOnly:true,staging:true}),true);
 assert.throws(()=>executionPolicy(p,{measurementOnly:true,staging:true,publish:true}),/cannot_publish/);
 assert.throws(()=>executionPolicy(p,{staging:true}),/explicit_measurement/);
 assert.throws(()=>assertPublicationPolicy(p),/cannot_publish/);
 assert.throws(()=>registrationPolicy({measurementOnly:true}),/separate_staging/);
});
test('measurement does not release or downgrade registered production campaigns',()=>{
 assert.throws(()=>registrationPolicy({staging:true}),/release_required/);
 assert.throws(()=>executionPolicy({},{measurementOnly:true,staging:true}),/mode_cannot_change/);
 assert.throws(()=>executionPolicy({},{staging:true}),/calibration_required/);
 assert.equal(executionPolicy({},{staging:true,releaseAvailable:true}),true);
 const qualified=registrationPolicy({staging:true,releaseAvailable:true});
 assert.doesNotThrow(()=>assertPublicationPolicy(qualified));
});
test('phase cap counts holds and reserves conservative next-call maximum',()=>{
 const prices={models:{'gpt-6-luna':{max_input_tokens:40000,input_per_million:.1,output_per_million:.5,batch:{input_per_million:.05,output_per_million:.25}}}};
 const bound=maximumRequestMicro('openai',{max_output_tokens:8000},prices);
 assert.equal(bound,8000);
 assert.equal(maximumRequestMicro('openai',{max_output_tokens:8000},prices,{batch:true}),4000);
 assert.doesNotThrow(()=>assertCampaignBudget(3992000,bound,4));
 assert.throws(()=>assertCampaignBudget(3992001,bound,4),/campaign_budget_exhausted/);
 assert.throws(()=>assertCampaignBudget(0,0,4),/bound_required/);
 assert.throws(()=>registrationPolicy({staging:true,measurementOnly:true,capUsd:51}),/bounded_campaign/);
});
