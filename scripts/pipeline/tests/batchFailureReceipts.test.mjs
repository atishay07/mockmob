import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
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
