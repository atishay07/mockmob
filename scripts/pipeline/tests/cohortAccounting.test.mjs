import test from 'node:test';import assert from 'node:assert/strict';import {cohortAccounting,readCohortAccounting} from '../lib/cohortAccounting.mjs';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
const budget={limit_micro:50000000,committed_micro:8000000,unbounded_unresolved:0},jobs=[{id:'bad',state:'quarantined'},{id:'good',state:'eligible'}];
const failure=()=>({id:'hold',state:'unresolved',reserved:100,actual:null,hold_maximum_micro:100,candidate_id:'bad',provider_key:'key',provider_id:'batch_saved',receipt:{provider_batch_id:'batch_saved',provider_batch_status:'completed',provider_batch_record:{custom_id:'key',response:{status_code:503}}}});
test('a terminal failed quarantined item retains its hold while unaffected approved items can publish',()=>{
 const r=cohortAccounting([failure(),{id:'success',state:'settled'}],{jobs,budget});assert.equal(r.ready,true);assert.equal(r.settled,false);assert.deepEqual(r.bounded_terminal_failure_holds,['hold']);
});

test('publication readiness reads actual SQLite reservations and terminal receipts, preserving failed holds',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'mm-publication-hold-')),ledger=new BudgetLedger(join(directory,'ledger.sqlite'));
 try{
  ledger.reconcileHistory({spent_usd:0,basis:'Isolated contract fixture, no actual provider spending',confirmed_at:new Date().toISOString()});
  const transport=createFactoryTransport({ledger,env:{OPENAI_API_KEY:'fixture'},queueOpenAI:true,prices:()=>({source_url:'https://provider.test/pricing',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5,batch:{input_per_million:.05,output_per_million:.25}}}}),fetchImpl:async url=>{
   if(url.endsWith('/files'))return Response.json({id:'file-input'});if(url.endsWith('/batches'))return Response.json({id:'batch_fixture'});
   if(url.endsWith('/batch_fixture'))return Response.json({status:'completed',output_file_id:'file-success',error_file_id:'file-errors'});
   if(url.endsWith('/file-errors/content'))return new Response(JSON.stringify({custom_id:'bad',id:'req_bad',response:{status_code:503,body:{error:{type:'server_error'}}}}));
   return new Response(JSON.stringify({custom_id:'good',response:{status_code:200,body:{output_text:'{}',usage:{input_tokens:100,output_tokens:200}}}}));
  }});
  for(const id of ['good','bad'])await assert.rejects(transport.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000,input:[{role:'user',content:JSON.stringify({candidate_id:id})}]},{key:id}),BatchPending);
  await transport.flush();await transport.reconcile('good');await assert.rejects(transport.reconcile('bad'),/failed_usage_missing/);
  const before=ledger.snapshot().committed_micro,result=readCohortAccounting(ledger,jobs);assert.equal(result.ready,true);assert.equal(result.settled,false);assert.equal(result.bounded_terminal_failure_holds.length,1);assert.equal(ledger.snapshot().committed_micro,before);
  assert.equal(readCohortAccounting(ledger,jobs.map(j=>({...j,state:'eligible'}))).ready,false);
 }finally{ledger.close();assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true});}
});
test('accepted pending requests, unknown acceptance and invalid identities never permit publication',()=>{
 for(const change of [{state:'submitted'},{receipt:{}},{provider_key:'different'},{provider_id:'different'},{hold_maximum_micro:null}])assert.equal(cohortAccounting([{...failure(),...change}],{jobs,budget}).ready,false);
 const r=failure();r.receipt.provider_batch_status='in_progress';assert.equal(cohortAccounting([r],{jobs,budget}).ready,false);
});
test('an uncertain failed request on an approved item cannot be hidden behind another passing check',()=>{
 assert.equal(cohortAccounting([{...failure(),candidate_id:'good'}],{jobs,budget}).ready,false);
 assert.equal(cohortAccounting([{...failure(),actual:101}],{jobs,budget}).ready,false);
 assert.equal(cohortAccounting([failure()],{jobs,budget:{...budget,unbounded_unresolved:1}}).ready,false);
 assert.equal(cohortAccounting([failure()],{jobs,budget:{...budget,committed_micro:50000001}}).ready,false);
});

test('Gemini native errors require terminal batch state, exact metadata identity and quarantine',()=>{
 const r={...failure(),provider_id:'batches/saved',receipt:{provider:'gemini',provider_batch_id:'batches/saved',provider_batch_status:'BATCH_STATE_SUCCEEDED',provider_batch_record:{metadata:{key:'key'},error:{code:14}}}};
 assert.equal(cohortAccounting([r],{jobs,budget}).ready,true);assert.equal(cohortAccounting([r],{jobs,budget}).settled,false);
 for(const status of ['BATCH_STATE_PENDING','BATCH_STATE_RUNNING',null])assert.equal(cohortAccounting([{...r,receipt:{...r.receipt,provider_batch_status:status}}],{jobs,budget}).ready,false,status);
 for(const record of [{metadata:{key:'wrong'},error:{code:14}},{custom_id:'key',error:{code:14}},{metadata:{key:'key'},response:{}},{metadata:{key:'key'}}])assert.equal(cohortAccounting([{...r,receipt:{...r.receipt,provider_batch_record:record}}],{jobs,budget}).ready,false);
 assert.equal(cohortAccounting([{...r,provider_id:'batches/wrong'}],{jobs,budget}).ready,false);
 assert.equal(cohortAccounting([{...r,candidate_id:'good'}],{jobs,budget}).ready,false);
});
