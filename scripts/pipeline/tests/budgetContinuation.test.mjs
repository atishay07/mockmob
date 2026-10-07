import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
const fresh=()=>new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mm-bounds-')),'ledger.sqlite'));
const proof={model:'gpt-6-luna',input_bound:1000,output_bound:1000,input_rate:1,output_rate:1,pricing_source:'https://provider.test/pricing',contract_hash:'a'.repeat(64),basis:'Persisted bounded text-only request, no unbounded tools',provider_request_id:'req-503'};
test('restart immediately recovers a dead local worker without stealing a living process lease',()=>{
 const l=fresh();try{const store=new FactoryStore(l,'test-ledger');l.db.prepare('INSERT INTO factory_worker VALUES(1,?,?)').run('2147483647:dead',Date.now()+300000);store.claim();
 const other=new FactoryStore(l,'test-ledger');assert.throws(()=>other.claim(),/already_running/);store.release();other.claim();other.release();}finally{l.close();}
});
test('a dead dispatch owner recovers as unresolved and never returns to the upload queue',()=>{
 const path=join(mkdtempSync(join(tmpdir(),'mm-dispatch-')),'ledger.sqlite'),l=new BudgetLedger(path);const id=l.reserve('gpt-6-luna',2000);
 l.db.prepare("UPDATE requests SET state='submitted',owner_pid=2147483647 WHERE id=?").run(id);
 l.db.prepare("INSERT INTO provider_batches(id,provider,reservation_id,state,request_json) VALUES('dead','openai',?,'dispatching','{}')").run(id);l.close();
 const recovered=new BudgetLedger(path);try{assert.equal(recovered.db.prepare("SELECT state FROM provider_batches WHERE id='dead'").get().state,'unresolved');assert.equal(recovered.snapshot().unbounded_unresolved,1);assert.throws(()=>recovered.reserve('extra',1),/usage_unresolved/);}finally{recovered.close();}
});
test('bounded missing usage stays unresolved and committed; unbounded and overrun holds still block',()=>{
 const l=fresh();try{const id=l.reserve('gpt-6-luna',2000);l.settle(id,null,{error:'503'});assert.throws(()=>l.reserve('other',1),/usage_unresolved/);
  assert.throws(()=>l.retainConservativeHold(id,{...proof,output_bound:999}),/bound_proof/);
  l.retainConservativeHold(id,proof);l.reserve('other',3);assert.equal(l.snapshot().committed_micro,2003);assert.equal(l.snapshot().unresolved,1);
  assert.throws(()=>l.reserve('other',50000000-2002),/exhausted/);l.settle(id,2100);assert.throws(()=>l.reserve('other',1),/usage_unresolved/);
 }finally{l.close();}
});
test('late usage shrinks only its own hold and cannot double settle',()=>{
 const l=fresh();try{const id=l.reserve('gpt-6-luna',2000);l.settle(id,null);l.retainConservativeHold(id,proof);l.reserve('other',100);l.settle(id,500,{usage:{input_tokens:200,output_tokens:300}});
 assert.equal(l.snapshot().committed_micro,600);assert.throws(()=>l.settle(id,0),/not_open/);}finally{l.close();}
});
test('independent workers serialize reservations under the lifetime cap while retaining a bounded hold',async()=>{
 const path=join(mkdtempSync(join(tmpdir(),'mm-concurrent-')),'ledger.sqlite'),l=new BudgetLedger(path,0.012);
 const id=l.reserve('gpt-6-luna',2000);l.settle(id,null);l.retainConservativeHold(id,proof);l.close();
 const run=()=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',`import{BudgetLedger}from'./scripts/pipeline/lib/budgetLedger.mjs';const l=new BudgetLedger(process.argv[1]);try{const id=l.reserve('worker',5000);l.db.prepare("UPDATE requests SET state='submitted' WHERE id=?").run(id);process.stdout.write('ok')}catch(e){process.stdout.write(e.message)}finally{l.close()}`,path],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',x=>output+=x);p.on('error',reject);p.on('exit',()=>resolve(output));});
 const results=await Promise.all(Array.from({length:4},run));assert.equal(results.filter(s=>s==='ok').length,2);
 const check=new BudgetLedger(path);try{assert.equal(check.snapshot().committed_micro,12000);assert.throws(()=>check.reserve('extra',1),/usage_unresolved|exhausted/);}finally{check.close();}
});
test('a lost real-time receipt with a persisted key cannot resubmit after restart',async()=>{
 const l=fresh();l.reconcileHistory({spent_usd:0,basis:'Explicit no historical fixture costs recorded',confirmed_at:new Date().toISOString()});let calls=0;
 const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5}}});
 const t=createFactoryTransport({ledger:l,prices,env:{OPENAI_API_KEY:'fixture'},fetchImpl:async()=>{calls++;return Response.json({error:{type:'server_error'}},{status:503});}});
 try{await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{batch:false,key:'frozen'}),/503/);
 await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{batch:false,key:'frozen'}),/do_not_resubmit/);assert.equal(calls,1);}finally{l.close();}
});
test('native cohort uploads once, preserves per-item reservations and reconciles accepted IDs idempotently',async()=>{
 const l=fresh();l.reconcileHistory({spent_usd:0,basis:'Explicit no historical fixture costs recorded',confirmed_at:new Date().toISOString()});let posts=0,keys=[];
 const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5,batch:{input_per_million:.05,output_per_million:.25}}}});
 const fetchImpl=async(url,init)=>{if(url.endsWith('/files')){keys=(await init.body.get('file').text()).trim().split('\n').map(s=>JSON.parse(s).custom_id);return Response.json({id:'file-input'});}
 if(url.endsWith('/batches')){posts++;return Response.json({id:'batch_cohort'});}if(url.endsWith('/batch_cohort'))return Response.json({status:'completed',output_file_id:'file-output'});
 return new Response(keys.map(k=>JSON.stringify({custom_id:k,response:{status_code:200,body:{output_text:'{"ok":true}',usage:{input_tokens:100,output_tokens:200}}}})).join('\n'));};
 const t=createFactoryTransport({ledger:l,prices,env:{OPENAI_API_KEY:'fixture'},fetchImpl,queueOpenAI:true});try{
 for(const key of ['one','two'])await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key}),BatchPending);
 assert.equal(posts,0);assert.equal((await t.flush()).requests,2);assert.equal(await t.flush(),null);for(const key of keys){await t.reconcile(key);await t.reconcile(key);}assert.equal(posts,1);assert.equal(l.snapshot().committed_micro,110);
 }finally{l.close();}
});
test('lost grouped acceptance recovers every matching ID from the saved file and metadata without reposting',async()=>{
 const l=fresh();l.reconcileHistory({spent_usd:0,basis:'Explicit fixture history',confirmed_at:new Date().toISOString()});let posts=0,keys=[],group;
 const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5,batch:{input_per_million:.05,output_per_million:.25}}}});
 const fetchImpl=async(url,init)=>{if(url.endsWith('/files')){keys=(await init.body.get('file').text()).trim().split('\n').map(s=>JSON.parse(s).custom_id);return Response.json({id:'file-accepted'});}
  if(url.endsWith('/batches')){posts++;group=JSON.parse(init.body).metadata.factory_group;throw Error('lost_response');}
  if(url.endsWith('/batch_accepted'))return Response.json({status:'completed',input_file_id:'file-accepted',metadata:{factory_group:group},output_file_id:'file-output'});
  return new Response(keys.map(k=>JSON.stringify({custom_id:k,response:{status_code:200,body:{usage:{input_tokens:100,output_tokens:200}}}})).join('\n'));
 };
 const t=createFactoryTransport({ledger:l,prices,env:{OPENAI_API_KEY:'fixture'},fetchImpl,queueOpenAI:true});try{
  for(const key of ['group-one','group-two'])await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key}),BatchPending);
  await assert.rejects(t.flush(),/lost_response/);assert.equal(l.snapshot().unresolved,2);assert.equal(l.snapshot().unbounded_unresolved,0);
  await t.attachAcceptedBatch('group-one','batch_accepted');await t.reconcile('group-two');assert.equal(l.snapshot().unresolved,0);assert.equal(posts,1);assert.equal(l.snapshot().committed_micro,110);
 }finally{l.close();}
});
test('Gemini grouped responses are mapped by opaque per-item IDs rather than response order',async()=>{
 const l=fresh();l.reconcileHistory({spent_usd:0,basis:'Explicit fixture history',confirmed_at:new Date().toISOString()});let posts=0,keys=[];
 const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gemini-3.8-flash':{provider_host:'generativelanguage.googleapis.com',max_input_tokens:32768,input_per_million:.75,output_per_million:3.75,batch:{input_per_million:.375,output_per_million:1.875}}}});
 const fetchImpl=async(url,init)=>{if(init.method==='POST'){posts++;keys=JSON.parse(init.body).batch.inputConfig.requests.requests.map(r=>r.metadata.key);return Response.json({name:'batches/grouped'});}return Response.json({state:'BATCH_STATE_SUCCEEDED',response:{inlinedResponses:keys.toReversed().map((key,i)=>({metadata:{key},response:{usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:30},candidates:[{content:{parts:[{text:JSON.stringify({id:key})}]},finishReason:'STOP'}]}}))}});};
 const t=createFactoryTransport({ledger:l,prices,env:{GEMINI_API_KEY:'fixture'},fetchImpl,queueGemini:true});try{
  for(const key of ['gemini-a','gemini-b'])await assert.rejects(t.generate('gemini',{generationConfig:{maxOutputTokens:1000}},{key}),BatchPending);
  await t.flush();for(const key of keys)assert.equal(JSON.parse((await t.reconcile(key)).candidates[0].content.parts[0].text).id,key);
  assert.equal(posts,1);assert.equal(l.snapshot().committed_micro,264);assert.equal(l.snapshot().unresolved,0);
 }finally{l.close();}
});

test('a long-running worker refreshes pending batch status without reposting accepted IDs',async()=>{
 const l=fresh();l.reconcileHistory({spent_usd:0,basis:'Explicit fixture history',confirmed_at:new Date().toISOString()});let posts=0,gets=0,time=0,key;
 const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5,batch:{input_per_million:.05,output_per_million:.25}}}});
 const fetchImpl=async(url,init={})=>{
  if(url.endsWith('/files')){key=JSON.parse((await init.body.get('file').text()).trim()).custom_id;return Response.json({id:'file-input'});}
  if(url.endsWith('/batches')){posts++;return Response.json({id:'batch_refresh'});}
  if(url.endsWith('/batch_refresh')){gets++;return Response.json(time<15000?{status:'in_progress'}:{status:'completed',output_file_id:'file-output'});}
  return new Response(JSON.stringify({custom_id:key,response:{status_code:200,body:{usage:{input_tokens:100,output_tokens:200}}}}));
 };
 const t=createFactoryTransport({ledger:l,prices,env:{OPENAI_API_KEY:'fixture'},fetchImpl,queueOpenAI:true,now:()=>time});
 try{await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key:'refresh'}),BatchPending);await t.flush();
  assert.equal(await t.reconcile('refresh'),null);assert.equal(await t.reconcile('refresh'),null);assert.equal(gets,1);
  time=16000;assert.ok(await t.reconcile('refresh'));assert.equal(gets,2);assert.equal(posts,1);assert.equal(l.snapshot().committed_micro,55);
 }finally{l.close();}
});

test('a known pre-inference rejection is terminal and cannot repost or block unrelated work as uncertain usage',async()=>{
 const l=fresh();l.reconcileHistory({spent_usd:0,basis:'Explicit fixture history',confirmed_at:new Date().toISOString()});let posts=0;
 const prices=()=>({source_url:'https://provider.test',expires_at:'2099-01-01',models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:32768,input_per_million:.1,output_per_million:.5}}});
 const fetchImpl=async()=>{posts++;return Response.json({error:{type:'invalid_request_error',message:'Rejected request parameter before inference'}},{status:400});};
 const t=createFactoryTransport({ledger:l,prices,env:{OPENAI_API_KEY:'fixture'},fetchImpl});
 try{
  await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key:'known-rejection',batch:false}),/400/);
  await assert.rejects(t.generate('openai',{model:'gpt-6-luna',max_output_tokens:1000},{key:'known-rejection',batch:false}),/provider_request_rejected_before_inference/);
  assert.equal(posts,1);assert.equal(l.snapshot().unresolved,0);assert.equal(l.snapshot().committed_micro,0);l.assertHistoryReconciled();
 }finally{l.close();}
});
