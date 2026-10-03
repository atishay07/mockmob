import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {verifyBatch,requiredStages,calibrate} from '../lib/evidencePipeline.mjs';

// Software fixtures, NOT an independently keyed academic certification.
function config(){
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mockmob-evidence-')),'ledger.sqlite'));
 const candidate={id:'test-easy',subject:'economics',chapter:'Money & Banking',body:'Which option describes money?',options:['Medium of exchange','Only shares','Only bonds','Only property'],correct_answer:'A',explanation:'A means of exchanging goods and services.',family_id:'test-family',route:'conceptual',source_refs:[{id:'test-source',version:'1',locator:'p1',support_hash:'support'}]};
 const registry={sources:{'test-source':{state:'active',version:'1',reuse_permitted:true,supports:{p1:'support'}}},families:{'test-family':{state:'active',version:'1'}}};
 const calls=[];
 const adapters=Object.fromEntries(requiredStages(candidate.route).map(stage=>[stage,async view=>{
  calls.push({stage,view});
  return {candidate_id:view.candidate_id,content_hash:view.content_hash,passed:true,...(stage==='blind_solution'?{solved_key:'A'}:{})};
 }]));
 return {candidate,calls,ledger,registry,adapters,version:'software-fixture',secret:'test-only'};
}
test('blind checks never receive generator key or explanation; cached verdicts preserve exact IDs',async()=>{
 const c=config();try{
  const first=await verifyBatch([c.candidate],c);assert.equal(first[0].state,'eligible');
  for(const call of c.calls){assert.equal(call.view.correct_answer,undefined);assert.equal(call.view.explanation,undefined);assert.equal(call.view.evidence,undefined);if(call.stage!=='explanation_support')assert.equal(call.view.proposed_explanation,undefined);}
  const count=c.calls.length;await verifyBatch([c.candidate],c);assert.equal(c.calls.length,count);
  c.adapters.blind_solution=async view=>({candidate_id:'swapped',content_hash:view.content_hash,passed:true,solved_key:'A'});
  const second=await verifyBatch([{...c.candidate,id:'other'}],c);assert.equal(second[0].state,'quarantined');assert.match(second[0].reasons[0],/unmatched_verdict/);
 }finally{c.ledger.close();}
});
test('duplicate stems stop before paid stages and one failed targeted repair stays quarantined',async()=>{
 const c=config();try{
  const duplicate=await verifyBatch([c.candidate,{...c.candidate,id:'copy'}],c);
  assert.equal(duplicate[1].reasons[0],'duplicate_before_paid_checks');
  let repairs=0;c.adapters.alternatives=async view=>({candidate_id:view.candidate_id,content_hash:view.content_hash,passed:false});
  c.adapters.repair=async ({candidate})=>{repairs++;return {...candidate,body:candidate.body+' Please choose.'};};
  const candidate={...c.candidate,id:'repair'};
  const result=await verifyBatch([candidate],c);assert.equal(result[0].state,'quarantined');assert.equal(result[0].repair_attempted,true);
  await verifyBatch([candidate],c);assert.equal(repairs,1);
 }finally{c.ledger.close();}
});
test('empty or family/source-overlapping academic benchmarks cannot release',async()=>{
 const empty=await calibrate([],async()=>({state:'eligible'}));assert.equal(empty.released,false);
 const f={id:'fixture',valid:true,category:'valid_easy',split:'held_out',question:{family_id:'family'},provenance:{independently_keyed:true,source_id:'source',key_locator:'p1'}};
 const overlap=await calibrate([f],async()=>({state:'eligible'}),[f]);assert.equal(overlap.split_disjoint,false);assert.equal(overlap.released,false);
});
