import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationEligibility} from '../evidence_registry.js';
import {contentHash,evidenceSignature,evaluateEvidence} from '../content_evidence.js';

// Software safety fixtures; these do not establish academic reliability.
function fixture(){
 const q={id:'snapshot-fixture',subject:'english',chapter:'Vocabulary',body:'Choose the meaning.',options:['a','b','c','d'],correct_answer:'A',explanation:'Fixture explanation',family_id:'fixture-family',status:'live'};
 const registry={version:'fixture-registry',secret:'software-fixture-secret',sources:{ref:{state:'active',version:1,reuse_permitted:true,supports:{p1:'support-hash'}}},families:{'fixture-family':{state:'active',version:1}}};
 const route={released:true,independent:true,split_disjoint:true,verifier_version:'fixture-verifier',source_registry_version:registry.version,valid_sample_size:3,valid_survival:1,critical_false_accepts:0,missing_categories:[],blind_answer_accuracy:{sample_size:3,luna_answered:1,gemini_answered:1}};
 const manifest={state:'released',routes:{conceptual:route}};
 const record={candidate_id:q.id,content_hash:contentHash(q),family_id:q.family_id,family_version:1,state:'published',route:'conceptual',verifier_version:'fixture-verifier',verified_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),sources:[{id:'ref',version:1,locator:'p1',support_hash:'support-hash'}],solved_key:'A',checks:{}};
 for(const stage of ['schema','dedupe','source_support','blind_solution','alternatives','explanation_support','exam_fit'])record.checks[stage]={passed:true,evidence_hash:'fixture-check',candidate_id:q.id,content_hash:record.content_hash};
 q.evidence={record,signature:evidenceSignature(record,registry.secret)};
 return {q,snapshot:{registry,manifest}};
}
test('request snapshot retains fresh item checks and content binding',()=>{
 const {q,snapshot}=fixture();assert.deepEqual(publicationEligibility(q,snapshot),evaluateEvidence(q,snapshot.registry));assert.equal(publicationEligibility(q,snapshot).eligible,true);
 assert.ok(publicationEligibility({...q,correct_answer:'B'},snapshot).reasons.includes('content_changed'));
 assert.equal(publicationEligibility({...q,verification_state:'disputed'},snapshot).eligible,false);
 assert.equal(publicationEligibility({...q,status:'quarantined'},snapshot).eligible,false);
 q.evidence.signature='bad-signature';assert.ok(publicationEligibility(q,snapshot).reasons.includes('untrusted_evidence'));
});
test('a subsequent current snapshot revokes sources and calibration without cached verdicts',()=>{
 const {q,snapshot}=fixture();assert.equal(publicationEligibility(q,snapshot).eligible,true);
 const revoked=structuredClone(snapshot);revoked.registry.sources.ref.state='inactive';assert.ok(publicationEligibility(q,revoked).reasons.includes('source_not_verified'));
 const changed=structuredClone(snapshot);changed.registry.version='changed';assert.deepEqual(publicationEligibility(q,changed).reasons,['route_calibration_required']);
 const unreleased=structuredClone(snapshot);unreleased.manifest.routes.conceptual.released=false;assert.deepEqual(publicationEligibility(q,unreleased).reasons,['route_calibration_required']);
});
test('snapshot sharing never caches expiry or bypasses the factory release predicate',()=>{
 const {q,snapshot}=fixture();assert.equal(publicationEligibility(q,snapshot).eligible,true);
 q.evidence.record.expires_at=new Date(Date.now()-1000).toISOString();q.evidence.signature=evidenceSignature(q.evidence.record,snapshot.registry.secret);
 assert.ok(publicationEligibility(q,snapshot).reasons.includes('stale_verification'));
 q.evidence.record.policy_version='cuet-llm-v3';assert.deepEqual(publicationEligibility(q,snapshot).reasons,['route_calibration_required']);
});
