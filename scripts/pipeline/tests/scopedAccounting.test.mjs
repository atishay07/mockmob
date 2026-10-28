import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {bodyCandidateId,scopedAccounting} from '../lib/scopedAccounting.mjs';
import {requestNeedsReservation,assertCampaignBudget} from '../lib/campaignExecutionV7.mjs';
test('native dispatch attribution counts exact receipts, malformed legacy tags, holds and unrelated concurrent calls',async()=>{
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mm-scope-')),'ledger.sqlite'));
 ledger.reconcileHistory({spent_usd:0,basis:'Independent zero-history fixture only',confirmed_at:new Date().toISOString()});
 const pricing={source_url:'https://fixture.test/prices',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:1000,input_per_million:.1,output_per_million:.5}}};
 let calls=0;const transport=createFactoryTransport({ledger,prices:()=>pricing,env:{OPENAI_API_KEY:'fixture'},fetchImpl:async()=>{calls++;return Response.json({id:'fixture-response',output_text:'{}',usage:{input_tokens:100,output_tokens:50}});}});
 const body=id=>({model:'gpt-6-luna',max_output_tokens:100,input:[{role:'user',content:JSON.stringify({candidate_id:id})}]});
 try{
  await transport.generate('openai',body('one'),{key:'first',batch:false,candidate_id:'phase:one'});
  await transport.generate('openai',body('two'),{key:'second',batch:false,candidate_id:'phase:undefined'});
  await transport.generate('openai',body('unrelated'),{key:'third',batch:false,candidate_id:'other:unrelated'});
  const reservation=ledger.reserve('gpt-6-luna',150);
  ledger.db.prepare("INSERT INTO provider_requests VALUES(?,?,?,'dispatching',?,NULL)").run('held',reservation,'openai',JSON.stringify({body:body('one'),config:{provider:'openai',key:'held',candidate_id:'phase:one'}}));
  const all=scopedAccounting(ledger,'phase:');assert.equal(all.settled_micro,70);assert.equal(all.held_micro,150);assert.equal(all.committed_micro,220);assert.equal(all.receipt_complete,false);
  assert.equal(all.requests.find(r=>r.request_id==='second').candidate_id,'two');
  assert.equal(scopedAccounting(ledger,'phase:','two').committed_micro,35);
  assert.equal(scopedAccounting(ledger,'phase:','one').committed_micro,185);
  await transport.generate('openai',body('one'),{key:'first',batch:false,candidate_id:'phase:one'});assert.equal(calls,3);assert.equal(scopedAccounting(ledger,'phase:').committed_micro,220);
  assert.throws(()=>assertCampaignBudget(220,150,.000220),/campaign_budget_exhausted/);
  assert.equal(requestNeedsReservation(ledger,'first'),false);
  assert.equal(requestNeedsReservation(ledger,'held'),false);
  assert.equal(requestNeedsReservation(ledger,'new'),true);
  // A receipt replay at the exact phase cap requires no new reservation, yet
  // native transport still checks content and never permits a changed request.
  if(!requestNeedsReservation(ledger,'first'))await transport.generate('openai',body('one'),{key:'first',batch:false});
  assert.equal(calls,3);
  await assert.rejects(transport.generate('openai',body('changed'),{key:'first',batch:false}),/saved_request_content_mismatch/);
 }finally{ledger.close();}
});
test('receipt-only settled and bounded-hold orphan requests retain known scope without guessing unknown prefixes',()=>{
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mm-orphan-scope-')),'ledger.sqlite'));
 ledger.reconcileHistory({spent_usd:0,basis:'Independent zero-history fixture only',confirmed_at:new Date().toISOString()});
 try{
  const settled=ledger.reserve('gpt-6-luna',100);
  ledger.settle(settled,12,{candidate_id:'phase:orphan-settled',stage:'explanation_support',provider:'openai',idempotency_key:'orphan-settled'});
  const held=ledger.reserve('gpt-6-luna',750);
  ledger.settle(held,null,{candidate_id:'phase:orphan-held',stage:'blind_solution',provider:'gemini',idempotency_key:'orphan-held'});
  ledger.retainConservativeHold(held,{model:'gpt-6-luna',input_bound:750,output_bound:1,input_rate:1,output_rate:0,pricing_source:'https://fixture.test/prices',contract_hash:'a'.repeat(64),provider_request_id:'provider-held',basis:'Persisted bounded text-only request, no unbounded tools'});
  const unknown=ledger.reserve('gpt-6-luna',50);
  ledger.settle(unknown,5,{candidate_id:'other:unrelated',stage:'blind_solution',provider:'openai',idempotency_key:'other'});

  const all=scopedAccounting(ledger,'phase:');
  assert.equal(all.settled_micro,12);
  assert.equal(all.held_micro,750);
  assert.equal(all.committed_micro,762);
  assert.equal(all.receipt_complete,false);
  assert.deepEqual(all.requests.map(r=>r.candidate_id).sort(),['orphan-held','orphan-settled']);
  assert.equal(scopedAccounting(ledger,'phase:','orphan-settled').committed_micro,12);
  assert.equal(scopedAccounting(ledger,'phase:','orphan-held').committed_micro,750);
  assert.equal(scopedAccounting(ledger,'other:').committed_micro,5);
 }finally{ledger.close();}
});
test('scope queries select exact rows amid a large unrelated ledger',()=>{
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mm-large-scope-')),'ledger.sqlite'));
 ledger.reconcileHistory({spent_usd:0,basis:'Independent zero-history fixture only',confirmed_at:new Date().toISOString()});
 try{
  const insertRequest=ledger.db.prepare("INSERT INTO requests(id,model,reserved,actual,state,owner_pid,receipt_json) VALUES(?, 'fixture-model', ?, ?, 'settled', ?, ?)");
  const insertMetadata=ledger.db.prepare("INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,'complete',?,NULL)");
  ledger.db.exec('BEGIN IMMEDIATE');
  try {
   for(let i=0;i<4000;i++){
    const id=`unrelated-${i}`;
    insertRequest.run(id,10,3,process.pid,JSON.stringify({candidate_id:`other:${i}`}));
    insertMetadata.run(`key-${i}`,id,'openai',JSON.stringify({body:{input:[{role:'user',content:JSON.stringify({candidate_id:`body-${i}`})}]},config:{provider:'openai',key:`key-${i}`,candidate_id:`other:${i}`,stage:'fixture'}}));
   }
   ledger.db.exec('COMMIT');
  }catch(error){ledger.db.exec('ROLLBACK');throw error;}
  insertRequest.run('metadata-match',40,22,process.pid,null);
  insertMetadata.run('metadata-key','metadata-match','openai',JSON.stringify({body:{input:[{role:'user',content:'{"candidate_id":"meta"}'}]},config:{provider:'openai',key:'metadata-key',candidate_id:'phase:meta',stage:'fixture'}}));
  insertRequest.run('receipt-only-match',50,33,process.pid,JSON.stringify({candidate_id:'phase:orphan',stage:'fixture',provider:'openai',idempotency_key:'receipt-key'}));

  const scoped=scopedAccounting(ledger,'phase:');
  assert.equal(scoped.settled_micro,55);
  assert.equal(scoped.held_micro,0);
  assert.deepEqual(scoped.requests.map(r=>r.reservation_id).sort(),['metadata-match','receipt-only-match']);
  assert.deepEqual(scoped.requests.map(r=>r.candidate_id).sort(),['meta','orphan']);
 }finally{ledger.close();}
});
test('provider body identity never returns undefined as an attributed candidate',()=>{
 assert.equal(bodyCandidateId('gemini',{contents:[{parts:[{text:'{"candidate_id":"g"}'}]}]}),'g');
 assert.equal(bodyCandidateId('anthropic',{messages:[{content:'{"candidate_id":"a"}'}]}),'a');
 assert.equal(bodyCandidateId('openai',{}),null);
});
