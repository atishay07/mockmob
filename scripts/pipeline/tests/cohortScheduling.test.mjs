import test from 'node:test';import assert from 'node:assert/strict';
import {cohortSchedule} from '../lib/cohortScheduling.mjs';
const args={usable:50,target:500,maximumInFlight:4,maximumCohorts:12,budget:{limit_micro:50000000,committed_micro:8000000,unbounded_unresolved:0}};
test('bounded receipt-only failures do not deadlock unrelated provider work or masquerade as finished',()=>{
 const r=cohortSchedule([{complete:true,provider_processing_complete:true,cost:{held_usd:.02},newly_published:0,approved_unique:40}],args);
 assert.equal(r.canRegister,true);assert.equal(r.active,0);assert.equal(r.receipt_only,1);assert.equal(r.complete,false);
 assert.equal(cohortSchedule([{complete:true,cost:{held_usd:.02},newly_published:40,approved_unique:40}],{...args,usable:500}).complete,false);
 assert.equal(cohortSchedule([{complete:true,provider_processing_complete:true,cost:{held_usd:.02},newly_published:40,approved_unique:40}],{...args,usable:500}).deliveryComplete,true);
});
test('four active cohorts, a reached content ceiling or an unbounded hold prevent expansion',()=>{
 assert.equal(cohortSchedule(Array.from({length:4},()=>({complete:false})),args).canRegister,false);
 assert.equal(cohortSchedule([],{...args,budget:{...args.budget,committed_micro:50000000}}).canRegister,false);
 assert.throws(()=>cohortSchedule([],{...args,budget:{...args.budget,unbounded_unresolved:1}}),/bounded/);
});
test('the usable target prevents more candidate registration but accepted work must still finish',()=>{
 assert.equal(cohortSchedule([{complete:false}],{...args,usable:500}).canRegister,false);
 assert.equal(cohortSchedule([{complete:false}],{...args,usable:500}).complete,false);
 assert.equal(cohortSchedule([{complete:true,cost:{held_usd:0},approved_unique:60,newly_published:60}],{...args,usable:500}).complete,true);
});
test('unused concurrency does not buy another cohort while accepted candidates can fill the gap',()=>{
 const reports=Array.from({length:3},()=>({complete:false,pending:100,approved_unique:0,newly_published:0,cost:{held_usd:.3}}));
 const result=cohortSchedule(reports,{...args,usable:413});assert.equal(result.pending_candidate_capacity,300);assert.equal(result.canRegister,false);assert.equal(result.deliveryComplete,false);
 assert.equal(cohortSchedule([{complete:false,pending:5,approved_unique:2,newly_published:0}],{...args,usable:490}).canRegister,true);
 assert.equal(cohortSchedule([{complete:false,pending:5,approved_unique:8,newly_published:0}],{...args,usable:490}).canRegister,false);
 assert.equal(cohortSchedule([{complete:true,pending:0,approved_unique:25,newly_published:0,cost:{held_usd:0}}],{...args,usable:490}).canRegister,false,'Publish settled approvals before buying another cohort');
});
test('terminal conservative receipt holds never supply fictitious delivery capacity',()=>{
 const result=cohortSchedule([{complete:false,provider_processing_complete:true,pending:0,approved_unique:40,newly_published:0,cost:{held_usd:.02}}],{...args,usable:480});
 assert.equal(result.pending_candidate_capacity,0);assert.equal(result.canRegister,true);assert.equal(result.complete,false);
});
