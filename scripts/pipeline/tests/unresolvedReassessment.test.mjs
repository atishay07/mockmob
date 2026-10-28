import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contentHash} from '../../../data/content_evidence.js';
import {unresolvedReassessmentDecision} from '../lib/unresolvedReassessment.mjs';
const fixture=()=>{
 const q={id:'q',body:'Original stem',options:['one','two','three','four'],correct_answer:'A',explanation:'Explanation'};
 const profile={verifier:'v',contract:'contract',content_hashes:[['q',contentHash(q)]]},latest={id:'q',state:'provider_error',error:'provider_request_unresolved_do_not_resubmit',content_hash:contentHash(q),verifier:'v'};
 const saved={body:{model:'gpt-6-luna',input:'printed input',max_output_tokens:10},config:{candidate_id:'reassessment:contract:q',key:'key',reserved:130,model:'gpt-6-luna',provider:'openai',rates:{input_per_million:0.1,cache_write_per_million:0.125,output_per_million:0.5},pricing:{models:{'gpt-6-luna':{max_input_tokens:1000}}},stage:'blind_solution'}};
 const proof={input_bound:1000,output_bound:10,input_rate:0.125,output_rate:0.5,tool_calls:0,tool_rate:0,model:'gpt-6-luna',pricing_source:'official',basis:'Bound at dispatch',provider_request_id:'unconfirmed-client-key:key',contract_hash:createHash('sha256').update(JSON.stringify(saved)).digest('hex')};
 const r={id:'reservation',model:'gpt-6-luna',reserved:130,actual:null,state:'unresolved',provider_state:'unresolved',provider_key:'key',provider:'openai',request_json:JSON.stringify(saved),response_json:null,maximum_micro:130,proof_json:JSON.stringify(proof)};
 return {q,profile,latest,r};
};
test('lost independent validation is quarantined with its complete hold, without claiming an academic defect or approval',()=>{
 const {q,profile,latest,r}=fixture(),before=JSON.stringify(r),out=unresolvedReassessmentDecision(q,latest,profile,[r]);
 assert.equal(out.state,'quarantined');assert.equal(out.result.independent_validation_complete,false);assert.equal(out.result.academic_defect_proven,false);
 assert.equal(out.new_evidence,null);assert.equal(out.unresolved_requests[0].maximum_micro,130);assert.equal(JSON.stringify(r),before);
});
test('changed content, native identity, missing proof, response availability and overrun refuse finalization',()=>{
 const {q,profile,latest,r}=fixture();assert.throws(()=>unresolvedReassessmentDecision({...q,body:'edited'},latest,profile,[r]),/content_changed/);
 for(const change of [{maximum_micro:0},{actual:131},{response_json:'{}'},{proof_json:null},{provider_key:'different'}])assert.throws(()=>unresolvedReassessmentDecision(q,latest,profile,[{...r,...change}]),/bound_or_identity_invalid/);
 assert.throws(()=>unresolvedReassessmentDecision(q,latest,profile,[]),/native_record_required/);
 assert.equal(unresolvedReassessmentDecision(q,{...latest,state:'eligible'},profile,[r]),null);
});
