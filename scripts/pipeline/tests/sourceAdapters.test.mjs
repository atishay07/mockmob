import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createEvidenceAdapters} from '../lib/sourceAdapters.mjs';
test('source adapters reject missing document identity before dispatch and invented supporting quotes',async()=>{
 const text='This is a software fixture excerpt, not an academic reference.';
 const hash=createHash('sha256').update(text).digest('hex');
 const registry={sources:{s:{state:'active',version:'1',reuse_permitted:true,supports:{p1:hash},facts:{p1:{text}}}}};
 const view={candidate_id:'fixture',content_hash:'hash',references:[{id:'s',version:'1',locator:'p1',support_hash:hash}]};
 let calls=0;
 const adapters=createEvidenceAdapters({registry,judge:async v=>{calls++;return {candidate_id:v.candidate_id,content_hash:v.content_hash,passed:true,supporting_spans:[{source_id:'s',locator:'p1',quote:'An invented claim.'}]};}});
 assert.equal((await adapters.source_support(view)).passed,false);assert.equal(calls,0);
 registry.sources.s.identity_sha256='software-fixture';registry.sources.s.extraction_checked=true;
 assert.equal((await adapters.source_support(view)).reason,'false_supporting_span');assert.equal(calls,1);
});
test('exam fit needs final-key-matched authentic examples; numerical routes cannot silently use a model solver',async()=>{
 const adapters=createEvidenceAdapters({registry:{sources:{},families:{}},judge:async()=>{throw new Error('must not dispatch');}});
 const view={candidate_id:'fixture',content_hash:'hash',subject:'economics',chapter:'Money & Banking',references:[]};
 assert.equal((await adapters.exam_fit(view)).reason,'verified_exam_spec_required');
 assert.equal((await adapters.independent_solver(view)).reason,'independent_solver_module_required');
});
