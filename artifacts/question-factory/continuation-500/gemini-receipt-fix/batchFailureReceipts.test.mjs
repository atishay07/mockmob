import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {readCohortAccounting} from '../lib/cohortAccounting.mjs';
const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5,batch:{input_per_million:.05,output_per_million:.25}}}});
async function fixture(record,{status='completed',duplicate=false}={}){
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mm-error-file-')),'ledger.sqlite'));ledger.reconcileHistory({spent_usd:0,basis:'Isolated receipt contract fixture; no real spending',confirmed_at:new Date().toISOString()});let posts=0;
 const t=createFactoryTransport({ledger,prices,env:{OPENAI_API_KEY:'fixture'},queueOpenAI:true,fetchImpl:async(url)=>{
  if(url.endsWith('/files'))return Response.json({id:'file-input'});if(url.endsWith('/batches')){posts++;return Response.json({id:'batch_fixture'});}
  if(url.endsWith('/batch_fixture'))return Response.json({status,output_file_id:'file-success',error_file_id:'file-errors'});
  if(url.endsWith('/file-errors/content'))return new Response(JSON.stringify({custom_id:'bad',id:'batch_req_bad',...record}));
  return new Response(JSON.stringify({custom_id:duplicate?'bad':'good',response:{status_code:200,body:{output_text:'{}',usage:{input_tokens:100,output_tokens:200}}}}));
 }});
 for(const key of ['good','bad'])await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key}),BatchPending);await t.flush();return {ledger,t,posts:()=>posts};
}
test('success and typed pre-inference rejection collect separate output/error files exactly once',async()=>{
 const f=await fixture({response:{status_code:400,request_id:'req_bad',body:{error:{type:'invalid_request_error',message:'Invalid schema'}}}});
 try{await f.t.reconcile('good');await f.t.reconcile('bad');assert.equal(f.ledger.snapshot().committed_micro,55);assert.equal(f.ledger.snapshot().unresolved,0);assert.equal(f.ledger.db.prepare("SELECT state FROM provider_batches WHERE id='bad'").get().state,'rejected');await assert.rejects(f.t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key:'bad'}),/failed_receipt_retained/);assert.equal(f.posts(),1);assert.equal(await f.t.reconcile('bad'),null);}finally{f.ledger.close();}
});
test('a failed response with token usage charges that usage instead of zero',async()=>{
 const f=await fixture({response:{status_code:500,request_id:'req_failed',body:{error:{type:'server_error'},usage:{input_tokens:100,output_tokens:200}}}});
 try{await f.t.reconcile('good');await f.t.reconcile('bad');assert.equal(f.ledger.snapshot().committed_micro,110);assert.equal(f.ledger.snapshot().unresolved,0);const receipt=JSON.parse(f.ledger.db.prepare("SELECT receipt_json FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id='bad')").get().receipt_json);assert.equal(receipt.http_status,500);assert.equal(receipt.usage.output_tokens,200);}finally{f.ledger.close();}
});
test('unknown server failure keeps its full proven hold and permits only bounded continuation',async()=>{
 const f=await fixture({response:{status_code:503,request_id:'req_unknown',body:{error:{type:'server_error'}}}});
 try{await f.t.reconcile('good');await assert.rejects(f.t.reconcile('bad'),/failed_usage_missing/);assert.equal(f.ledger.snapshot().committed_micro,1944);assert.equal(f.ledger.snapshot().unresolved,1);assert.equal(f.ledger.snapshot().unbounded_unresolved,0);await assert.rejects(f.t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key:'bad'}),/submission_unresolved/);assert.equal(f.posts(),1);f.ledger.reserve('independent',1);}finally{f.ledger.close();}
});
test('explicit unexecuted batch expiry settles separately; duplicate identities never release a hold',async()=>{
 const f=await fixture({response:null,error:{code:'batch_expired',message:'This request could not be executed before the completion window expired.'}},{status:'expired'});
 try{await f.t.reconcile('good');await f.t.reconcile('bad');assert.equal(f.ledger.snapshot().committed_micro,55);}finally{f.ledger.close();}
 const d=await fixture({response:{status_code:400,body:{error:{type:'invalid_request_error'}}}},{duplicate:true});
 try{await assert.rejects(d.t.reconcile('bad'),/record_mismatch/);assert.equal(d.ledger.snapshot().committed_micro,3778);}finally{d.ledger.close();}
});

async function geminiFixture(bad,{duplicate=false,missing=false}={}){
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mm-gemini-error-')),'ledger.sqlite'));
 ledger.reconcileHistory({spent_usd:0,basis:'Isolated native error receipt fixture; no live provider spending',confirmed_at:new Date().toISOString()});
 let posts=0;
 const t=createFactoryTransport({ledger,queueGemini:true,env:{GEMINI_API_KEY:'fixture'},prices:()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gemini-3.8-flash':{provider_host:'generativelanguage.googleapis.com',max_input_tokens:32768,input_per_million:.75,output_per_million:3.75,batch:{input_per_million:.375,output_per_million:1.875}}}}),fetchImpl:async(url,init={})=>{
  if(init.method==='POST'){posts++;return Response.json({name:'batches/gemini_failure_fixture'});}
  return Response.json({metadata:{state:'BATCH_STATE_SUCCEEDED'},response:{inlinedResponses:[
   {metadata:{key:duplicate?'bad':'good'},response:{usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30}}},
   ...missing?[]:[{metadata:{key:'bad'},...bad}],
  ]}});
 }});
 for(const key of ['good','bad'])await assert.rejects(t.generate('gemini',{contents:[{parts:[{text:JSON.stringify({candidate_id:key})}]}],generationConfig:{maxOutputTokens:1000}},{key}),BatchPending);
 await t.flush();return {ledger,t,posts:()=>posts};
}

test('native Gemini service failures retain exact receipts, full holds and quarantine-only publication across restart',async()=>{
 const f=await geminiFixture({error:{code:14,message:'The service is currently unavailable.'}});
 let ledger=f.ledger;
 try{
  const reserved=ledger.db.prepare("SELECT reserved FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id='bad')").get().reserved;
  await f.t.reconcile('good');await assert.rejects(f.t.reconcile('bad'),/batch_failed_usage_missing/);
  const row=ledger.db.prepare("SELECT * FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id='bad')").get(),receipt=JSON.parse(row.receipt_json);
  assert.equal(receipt.provider,'gemini');assert.equal(receipt.provider_batch_id,'batches/gemini_failure_fixture');
  assert.equal(receipt.provider_batch_status,'BATCH_STATE_SUCCEEDED');assert.equal(receipt.provider_batch_record.metadata.key,'bad');assert.equal(receipt.provider_batch_record.error.code,14);
  assert.equal(row.actual,null);assert.equal(ledger.snapshot().committed_micro,reserved+132);assert.equal(ledger.snapshot().unbounded_unresolved,0);
  const jobs=[{id:'good',state:'eligible'},{id:'bad',state:'quarantined'}];
  assert.equal(readCohortAccounting(ledger,jobs).ready,true);assert.equal(readCohortAccounting(ledger,jobs).settled,false);
  assert.equal(readCohortAccounting(ledger,jobs.map(j=>({...j,state:'eligible'}))).ready,false);
  await assert.rejects(f.t.generate('gemini',{generationConfig:{maxOutputTokens:1000}},{key:'bad'}),/submission_unresolved/);assert.equal(f.posts(),1);
  const path=ledger.db.prepare('PRAGMA database_list').get().file;ledger.close();ledger=new BudgetLedger(path);
  assert.equal(readCohortAccounting(ledger,jobs).ready,true);assert.equal(ledger.snapshot().committed_micro,reserved+132);
  const remaining=ledger.snapshot().limit_micro-ledger.snapshot().committed_micro;
  ledger.reserve('unrelated_bounded',remaining);assert.throws(()=>ledger.reserve('over_cap',1),/budget_exhausted/);
 }finally{ledger.close();}
});

test('Gemini failed records with usage charge candidate and reasoning tokens instead of guessing zero',async()=>{
 const f=await geminiFixture({error:{code:14,message:'Service failure after token processing'},response:{usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30}}});
 try{
  await f.t.reconcile('good');const result=await f.t.reconcile('bad');assert.equal(result.failed,true);assert.equal(result.receipt_settled,true);
  assert.equal(f.ledger.snapshot().committed_micro,264);assert.equal(f.ledger.snapshot().unresolved,0);
  const r=f.ledger.db.prepare("SELECT actual,receipt_json FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id='bad')").get();assert.equal(r.actual,132);assert.equal(JSON.parse(r.receipt_json).usage.thoughtsTokenCount,30);
  await assert.rejects(f.t.generate('gemini',{generationConfig:{maxOutputTokens:1000}},{key:'bad'}),/failed_receipt_retained/);assert.equal(f.posts(),1);
 }finally{f.ledger.close();}
});

test('missing or duplicate Gemini record identities retain their maximum and block publication',async()=>{
 for(const options of [{missing:true},{duplicate:true}]){
  const f=await geminiFixture({error:{code:14}},options);
  try{
   const held=f.ledger.snapshot().committed_micro;await assert.rejects(f.t.reconcile('bad'),/record_mismatch/);
   assert.equal(f.ledger.snapshot().committed_micro,held);assert.equal(readCohortAccounting(f.ledger,[{id:'good',state:'eligible'},{id:'bad',state:'quarantined'}]).ready,false);assert.equal(f.posts(),1);
  }finally{f.ledger.close();}
 }
});
