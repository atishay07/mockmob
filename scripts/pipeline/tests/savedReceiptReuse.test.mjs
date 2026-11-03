import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';

const body={model:'gpt-6-luna',max_output_tokens:100,messages:[{role:'user',content:'fixture prompt'}]};
const originalPricing={source_url:'https://provider.test/pricing-at-dispatch',expires_at:'2026-10-01T00:00:00.000Z',models:{
  'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:1000,input_per_million:.1,output_per_million:.5,
    batch:{input_per_million:.05,output_per_million:.25}}
}};
const changedPricing={source_url:'https://provider.test/new-pricing',expires_at:'2099-01-01T00:00:00.000Z',models:{
  'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:1000,input_per_million:90,output_per_million:900,
    batch:{input_per_million:45,output_per_million:450}}
}};
const response={id:'receipt-response-id',output_text:'{"ok":true}',usage:{input_tokens:100,output_tokens:50}};

function savedLedger(kind,{receipt=response,capMicro}={}) {
  const file=join(mkdtempSync(join(tmpdir(),'mm-saved-receipt-')),'ledger.sqlite');
  const ledger=new BudgetLedger(file,capMicro/1e6),key=`saved-${kind}-receipt`,batch=kind==='batch';
  const rates=batch?originalPricing.models['gpt-6-luna'].batch:originalPricing.models['gpt-6-luna'];
  const reserved=Math.ceil(1000*rates.input_per_million+100*rates.output_per_million);
  const config={provider:'openai',model:'gpt-6-luna',rates,reserved,pricing:originalPricing,toolCalls:0,
    execution_mode:batch?'batch':'realtime',key,stage:'fixture',purpose:'candidate'};
  const reservation=ledger.reserve(config.model,reserved);
  ledger.settle(reservation,null,{error:'receipt_reconciliation_fixture'});
  ledger.retainConservativeHold(reservation,{model:config.model,input_bound:1000,output_bound:100,
    input_rate:rates.input_per_million,output_rate:rates.output_per_million,pricing_source:originalPricing.source_url,
    contract_hash:'a'.repeat(64),basis:'Saved bounded text-only test request',provider_request_id:'provider-saved-id'});
  ledger.db.prepare('UPDATE requests SET actual=5 WHERE id=?').run(reservation);
  const requestJson=JSON.stringify({body,config});
  if(batch)ledger.db.prepare("INSERT INTO provider_batches(id,provider,provider_id,reservation_id,state,request_json,response_json) VALUES(?,'openai','batch_saved',?,'complete',?,?)")
    .run(key,reservation,requestJson,JSON.stringify(receipt));
  else ledger.db.prepare("INSERT INTO provider_requests(id,reservation_id,provider,state,request_json,response_json) VALUES(?,?,?,'complete',?,?)")
    .run(key,reservation,'openai',requestJson,JSON.stringify(receipt));
  ledger.setCache(`response-model:${key}`,config.model);
  ledger.setCache(`response:${key}`,receipt);
  return {ledger,key,reservation,batch,reserved};
}

for(const kind of ['realtime','batch']) test(`saved ${kind} full usage receipt settles once from original config without resubmission`,async()=>{
  const state=savedLedger(kind,{capMicro:kind==='batch'?75:150}),{ledger,key,reservation,batch,reserved}=state;
  let networkCalls=0;
  const transport=createFactoryTransport({ledger,prices:()=>changedPricing,env:{MOCK_AI:'true'},fetchImpl:async()=>{networkCalls++;throw Error('unexpected_network_call');}});
  try {
    assert.equal(ledger.snapshot().committed_micro,reserved);
    assert.throws(()=>ledger.reserve('at-cap',1),/exhausted/);
    const first=await transport.generate('openai',body,{key,batch,purpose:'candidate',stage:'fixture'});
    assert.deepEqual(first,response);
    const expected=Math.ceil(100*rates(kind).input_per_million+50*rates(kind).output_per_million);
    assert.equal(ledger.db.prepare('SELECT state,actual FROM requests WHERE id=?').get(reservation).state,'settled');
    assert.equal(ledger.db.prepare('SELECT actual FROM requests WHERE id=?').get(reservation).actual,expected);
    assert.equal(ledger.snapshot().committed_micro,expected);
    assert.deepEqual(await transport.generate('openai',body,{key,batch,purpose:'candidate',stage:'fixture'}),response);
    assert.equal(ledger.db.prepare('SELECT actual FROM requests WHERE id=?').get(reservation).actual,expected);
    assert.equal(networkCalls,0);
    const changed={...body,messages:[{role:'user',content:'changed prompt'}]};
    await assert.rejects(transport.generate('openai',changed,{key,batch,purpose:'candidate',stage:'fixture'}),/saved_request_content_mismatch/);
    assert.equal(ledger.db.prepare('SELECT actual FROM requests WHERE id=?').get(reservation).actual,expected);
    assert.equal(ledger.snapshot().committed_micro,expected);
  } finally {ledger.close();}
});

function rates(kind) { return kind==='batch'?originalPricing.models['gpt-6-luna'].batch:originalPricing.models['gpt-6-luna']; }

test('a completed transport-added Flex request replays after restart without a second POST; changed content or bounds still reject',async()=>{
  const file=join(mkdtempSync(join(tmpdir(),'mm-flex-replay-')),'ledger.sqlite');let ledger=new BudgetLedger(file,.01),calls=0;
  ledger.reconcileHistory({spent_usd:0,basis:'Isolated software fixture; no real provider spending.',confirmed_at:new Date().toISOString()});
  const pricing=structuredClone(originalPricing);pricing.expires_at='2099-01-01';pricing.models['gpt-6-luna'].flex={input_per_million:.05,output_per_million:.25};
  const submitted={...response,service_tier:'flex'},opts={key:'saved-flex-key',batch:false,stage:'fixture'};
  const first=createFactoryTransport({ledger,prices:()=>pricing,env:{OPENAI_API_KEY:'fixture'},flexStages:['fixture'],fetchImpl:async(url,init)=>{calls++;assert.equal(JSON.parse(init.body).service_tier,'flex');return Response.json(submitted);}});
  await first.generate('openai',body,opts);const spent=ledger.snapshot().committed_micro;ledger.close();ledger=new BudgetLedger(file);
  const replay=createFactoryTransport({ledger,prices:()=>changedPricing,env:{MOCK_AI:'true'},fetchImpl:async()=>{calls++;throw Error('unexpected_repost');}});
  assert.deepEqual(await replay.generate('openai',body,{...opts,noFlex:true}),submitted);
  assert.equal(ledger.snapshot().committed_micro,spent);assert.equal(calls,1);
  for(const changed of [{...body,max_output_tokens:101},{...body,messages:[{role:'user',content:'different question'}]},{...body,service_tier:'standard'}])await assert.rejects(replay.generate('openai',changed,opts),/saved_request_content_mismatch/);
  assert.equal(calls,1);ledger.close();
});

test('complete-looking saved provider row without usage keeps its full hold and never dispatches',async()=>{
  const state=savedLedger('realtime',{receipt:{id:'receipt-without-usage',output_text:'{"ok":true}'},capMicro:150});
  const {ledger,key,reservation}=state;let networkCalls=0;
  const transport=createFactoryTransport({ledger,prices:()=>changedPricing,env:{MOCK_AI:'true'},fetchImpl:async()=>{networkCalls++;throw Error('unexpected_network_call');}});
  try {
    await assert.rejects(transport.generate('openai',body,{key,batch:false,purpose:'candidate',stage:'fixture'}),/saved_receipt_usage_missing/);
    const row=ledger.db.prepare('SELECT state,reserved,actual FROM requests WHERE id=?').get(reservation);
    assert.equal(row.state,'unresolved');assert.equal(row.reserved,150);assert.equal(row.actual,5);
    assert.equal(ledger.snapshot().committed_micro,150);
    assert.equal(networkCalls,0);
  } finally {ledger.close();}
});

test('rejected batch receipt without usage preserves its conservative hold',async()=>{
  const failure={error:{code:'service_error'},response:null};
  const state=savedLedger('batch',{receipt:failure,capMicro:75}),{ledger,key,reservation}=state;let networkCalls=0;
  ledger.db.prepare("UPDATE provider_batches SET state='rejected' WHERE id=?").run(key);
  const transport=createFactoryTransport({ledger,prices:()=>changedPricing,env:{MOCK_AI:'true'},fetchImpl:async()=>{networkCalls++;throw Error('unexpected_network_call');}});
  try {
    await assert.rejects(transport.generate('openai',body,{key,batch:true,purpose:'candidate',stage:'fixture'}),/provider_batch_request_failed_receipt_retained/);
    const row=ledger.db.prepare('SELECT state,reserved,actual FROM requests WHERE id=?').get(reservation);
    assert.equal(row.state,'unresolved');assert.equal(row.reserved,75);assert.equal(row.actual,5);
    assert.equal(ledger.snapshot().committed_micro,75);
    assert.equal(networkCalls,0);
  } finally {ledger.close();}
});
