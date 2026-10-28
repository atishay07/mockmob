import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {BudgetLedger} from '../lib/budgetLedger.mjs';import {createFactoryTransport} from '../lib/factoryTransport.mjs';
function fixture(){const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mockmob-credit-')),'budget.sqlite'));
 ledger.reconcileHistory({spent_usd:0,basis:'Isolated software test ledger with no actual provider calls.',confirmed_at:new Date().toISOString()});return ledger;}
const prices={source_url:'https://fixture.invalid/prices',expires_at:'2099-01-01',web_search_per_call_usd:0.01,models:{'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:4096,input_per_million:0.1,output_per_million:0.5,batch:{input_per_million:0.05,output_per_million:0.25}},'gemini-3.8-flash':{provider_host:'generativelanguage.googleapis.com',max_input_tokens:4096,input_per_million:0.75,output_per_million:3.75,batch:{input_per_million:0.375,output_per_million:1.875}}}};
const body={model:'gpt-6-luna',max_output_tokens:100,input:[{role:'user',content:'Return JSON.'}]},env={OPENAI_API_KEY:'fixture',GEMINI_API_KEY:'fixture'};
const ok=()=>Response.json({id:'resp_ok',usage:{input_tokens:10,output_tokens:5},output_text:'{"ok":true}',status:'completed'});
const refused=(type,code,status=429)=>()=>Response.json({error:{type,code,message:'You have no credits remaining.'}},{status,headers:{'x-request-id':'req_1'}});
test('a credit-refused request can be sent again with the same key once credit returns, and costs nothing while refused',async()=>{
 const ledger=fixture();let mode='refuse',calls=0;
 const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async(...a)=>{calls++;return mode==='refuse'?refused('insufficient_quota','credit_balance_exhausted')():ok();}});
 try{
  await assert.rejects(transport.generate('openai',body,{batch:false,key:'k1'}),/provider_http_429/);
  assert.equal(ledger.db.prepare("SELECT state FROM provider_requests WHERE id='k1'").get().state,'credit_refused');
  assert.equal(ledger.snapshot().committed_micro,0);
  mode='ok';const payload=await transport.generate('openai',body,{batch:false,key:'k1'});
  assert.equal(payload.id,'resp_ok');assert.equal(ledger.db.prepare("SELECT state FROM provider_requests WHERE id='k1'").get().state,'complete');
  assert.equal(calls,2);
  await transport.generate('openai',body,{batch:false,key:'k1'});assert.equal(calls,2);// completed work is never repeated
 }finally{ledger.close();}
});
test('a schema rejection stays permanently rejected and an ordinary rate limit keeps its hold',async()=>{
 const ledger=fixture();
 const transport=createFactoryTransport({ledger,prices:()=>prices,env,fetchImpl:async()=>refused('invalid_request_error','invalid_json_schema',400)()});
 try{
  await assert.rejects(transport.generate('openai',body,{batch:false,key:'k2'}),/provider_http_400/);
  assert.equal(ledger.db.prepare("SELECT state FROM provider_requests WHERE id='k2'").get().state,'rejected');
  await assert.rejects(transport.generate('openai',body,{batch:false,key:'k2'}),/rejected_before_inference/);
 }finally{ledger.close();}
});

const flexPrices={...prices,models:{...prices.models,'gpt-6-luna':{...prices.models['gpt-6-luna'],flex:{input_per_million:0.05,output_per_million:0.25}}}};
const usage={input_tokens:1000,output_tokens:50};
test('flex requests are billed at the flex rate only when the provider reports flex, otherwise at standard',async()=>{
 for(const [tier,expected] of [['flex',Math.ceil(1000*0.05+50*0.25)],['default',Math.ceil(1000*0.1+50*0.5)]]){
  const ledger=fixture();let sent;
  const transport=createFactoryTransport({ledger,prices:()=>flexPrices,env,flexStages:['blind_solution'],realtimeStages:['blind_solution'],fetchImpl:async(url,init)=>{sent=JSON.parse(init.body);return Response.json({id:'r',service_tier:tier,usage,output_text:'{"ok":true}',status:'completed'});}});
  try{
   await transport.generate('openai',body,{key:'f-'+tier,stage:'blind_solution'});
   assert.equal(sent.service_tier,'flex');
   assert.equal(ledger.db.prepare("SELECT actual FROM requests WHERE model='gpt-6-luna'").get().actual,expected);
  }finally{ledger.close();}
 }
});
test('a flex capacity refusal costs nothing and the same request is repeated once at the standard tier',async()=>{
 const ledger=fixture();const tiers=[];
 const transport=createFactoryTransport({ledger,prices:()=>flexPrices,env,flexStages:['blind_solution'],realtimeStages:['blind_solution'],fetchImpl:async(url,init)=>{const b=JSON.parse(init.body);tiers.push(b.service_tier||'standard');
  return b.service_tier==='flex'?Response.json({error:{type:'requests',code:'resource_unavailable',message:'Resource Unavailable'}},{status:429}):Response.json({id:'r',service_tier:'default',usage,output_text:'{"ok":true}',status:'completed'});}});
 try{
  const payload=await transport.generate('openai',body,{key:'f2',stage:'blind_solution'});
  assert.equal(payload.id,'r');assert.deepEqual(tiers,['flex','standard']);
  const rows=ledger.db.prepare("SELECT state,actual FROM requests WHERE model='gpt-6-luna' ORDER BY rowid").all();
  assert.deepEqual(rows.map(r=>r.state),['settled','settled']);assert.equal(rows[0].actual,0);
 }finally{ledger.close();}
});
