import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReassessmentExport,makeDryRunWithholdingPlan,selectLatestResults} from '../lib/cuetReassessmentExport.mjs';

const eligible=(id,hash,contract='6f27a6-contract')=>({id,verifier:'v7',contract,content_hash:hash,state:'eligible',body:`stem ${id}`,options:['A','B','C','D'],key:'B',explanation:`why ${id}`,
  new_evidence:{record:{cuet_fit:{score:8,pass:true}}},result:{question:{evidence:{record:{checks:{exam_fit:{provider:'model'}}}}}},at:'2026-10-08T00:00:00Z'});

test('latest JSONL row wins and only contract/hash-matching terminal results close the denominator',()=>{
 const profile={contract:'6f27a6-contract',verifier:'v7',topology:'dual_blind',denominator:2,content_hashes:[['a','ha'],['b','hb']]};
 const costs={settled_micro:12,held_micro:0,committed_micro:12,receipt_complete:true,requests:[{reservation_id:'ra',request_id:'ka',candidate_id:'a',model:'m',state:'settled',settled_micro:12,held_micro:0}]};
 const data=buildReassessmentExport({profile,bankItems:[{id:'a',state:'published',candidate:{id:'a',body:'legacy a'}},{id:'b',state:'published',candidate:{id:'b',body:'legacy b'}}],
   results:[{id:'a',state:'provider_error'},eligible('a','ha'),{...eligible('b','wrong-hash')}],scopedCost:costs,ledgerRows:[{id:'ra',reserved:12,actual:12,state:'settled'}]});
 assert.equal(data.run.status,'incomplete');assert.equal(data.run.terminal,1);assert.equal(data.run.pending,1);
 assert.equal(data.cases[0].assessment.state,'eligible');assert.equal(data.cases[0].cost.committed_micro,12);
 assert.equal(data.cases[0].legacy.published_in_legacy_snapshot,true);
 assert.equal(data.cases[1].assessment.matching_result,false);
 assert.equal(data.cases[1].assessment.eligible_under_unreleased_v7_contract,false);
 assert.equal(data.withholding_plan.decisions.find(d=>d.item_ids.includes('b')).action,'withhold_until_assessed');
 assert.equal(data.distinctions.v7_eligibility.includes('does not publish'),true);
});

test('dry-run withholding is atomic for passage groups and never labels unresolved groups eligible',()=>{
 const cases=[
  {id:'p1a',metadata:{passage_group_id:'p1'},assessment:{terminal:true,state:'eligible'}},
  {id:'p1b',metadata:{passage_group_id:'p1'},assessment:{terminal:true,state:'quarantined'}},
  {id:'p2a',metadata:{passage_group_id:'p2'},assessment:{terminal:true,state:'eligible'}},
  {id:'p2b',metadata:{passage_group_id:'p2'},assessment:{terminal:false,state:'provider_error'}},
  {id:'solo',metadata:{passage_group_id:null},assessment:{terminal:true,state:'eligible'}},
 ];
 const plan=makeDryRunWithholdingPlan(cases),p1=plan.decisions.find(d=>d.passage_group_id==='p1'),p2=plan.decisions.find(d=>d.passage_group_id==='p2');
 assert.equal(plan.mode,'dry_run_only');assert.equal(plan.publication_writes,0);
 assert.equal(p1.action,'withhold');assert.deepEqual(p1.would_withhold_ids,['p1a','p1b']);
 assert.equal('items' in p1,false);
 assert.equal(p2.action,'withhold_until_assessed');assert.deepEqual(p2.would_withhold_ids,['p2a','p2b']);
 assert.equal(plan.decisions.find(d=>d.item_ids.includes('solo')).action,'no_withhold');
 assert.deepEqual(selectLatestResults([{id:'x',state:'quarantined'},{id:'x',state:'eligible'}]).get('x').state,'eligible');
});
