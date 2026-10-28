import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeBenchmark,benchmarkEvidence} from '../lib/factoryBenchmark.mjs';
import {officialCalibrationUnit} from '../lib/factoryCalibration.mjs';
function fixture(){
 const chapters={english:'Vocabulary',accountancy:'Partnership Fundamentals',business_studies:'Planning',economics:'Money & Banking'},examples=[],development=[],held_out=[];
 for(const [subject,chapter]of Object.entries(chapters))for(const split of ['development','held_out']){
  const a={id:`${subject}-${split}`,subject,chapter,body:`Identify the ${subject} ${split} principle.`,options:['First','Second','Third','Fourth'],correct_answer:'A',route:'conceptual',explanation:'Fixture explanation.',source_id:'paper-'+subject,key_locator:'key-'+split,final_key_matched:true,family_id:`family-${subject}-${split}`};examples.push(a);
  const f={id:a.id,split,valid:true,category:'valid_medium',question:{...a},provenance:{anchor_id:a.id,source_id:a.source_id,source_unit_id:officialCalibrationUnit(a),key_locator:a.key_locator,independently_keyed:true,final_answer:'A'}};(split==='development'?development:held_out).push(f);
 }
 const cache=new Map(),ledger={db:{prepare:sql=>({all:()=>sql.includes('FROM cache')?[...cache.values()].map(value=>({value:JSON.stringify(value)})):[]})},getCache:k=>cache.get(k),setCache:(k,v)=>cache.set(k,structuredClone(v))};
 return {registry:{version:1,examples},ledger,manifest:{split_policy:'authenticated_item_and_passage_disjoint_v1',development,held_out}};
}
test('freeze refuses previously observed anchors and shared passage units',()=>{
 const x=fixture();assert.throws(()=>freezeBenchmark(x.manifest,{...x,previousFixtures:[x.manifest.held_out[0]]}),/previously_observed/);
 const candidate={...x.manifest.held_out[0].question,id:'different-id'};assert.throws(()=>freezeBenchmark(x.manifest,{...x,previousJobs:[{candidate}]}),/previously_observed/);
});
test('only the ledger-bound frozen fixture can claim unseen evaluation',()=>{
 const x=fixture();const registration=freezeBenchmark(x.manifest,x);x.manifest.holdout_registration=registration;
 assert.equal(benchmarkEvidence(x.manifest,x).unseen_at_freeze,true);
 const changed=structuredClone(x.manifest);changed.held_out[0].question.body+=' altered';assert.equal(benchmarkEvidence(changed,x).unseen_at_freeze,false);
 const forged=structuredClone(x.manifest);forged.holdout_registration.frozen_at='invented';assert.equal(benchmarkEvidence(forged,x).unseen_at_freeze,false);
 assert.equal(benchmarkEvidence(x.manifest,{...x,registry:{...x.registry,version:2}}).unseen_at_freeze,false);
});
test('factory-authored valid explanation is evaluated later without rewriting the frozen official item',()=>{
 const x=fixture();x.manifest.holdout_registration=freezeBenchmark(x.manifest,x);x.manifest.held_out[0].question.explanation='A subsequently authored explanation.';
 assert.equal(benchmarkEvidence(x.manifest,x).unseen_at_freeze,true);
 x.manifest.held_out[0].valid=false;assert.equal(benchmarkEvidence(x.manifest,x).unseen_at_freeze,false);
});


test('a historical passage exceeding the current English word limit cannot be a positive release fixture',()=>{
 const x=fixture(),f=x.manifest.held_out.find(f=>f.question.subject==='english');
 f.question.passage_text=Array(301).fill('word').join(' ');x.registry.examples.find(a=>a.id===f.id).passage_text=f.question.passage_text;
 assert.throws(()=>freezeBenchmark(x.manifest,x),/current_passage_limit_required/);
});


test('a different payload cannot recycle previously frozen official holdout units',()=>{
 const x=fixture();freezeBenchmark(x.manifest,x);
 x.manifest.held_out[0].category='valid_difficult';
 assert.throws(()=>freezeBenchmark(x.manifest,x),/previously_observed/);
});
