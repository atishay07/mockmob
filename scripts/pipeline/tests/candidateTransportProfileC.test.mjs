import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport,BatchPending} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/factoryTransportC.mjs';
import {C_TRANSPORT_PROFILE_VNEXT as policy,C_TRANSPORT_PROFILE_VNEXT_HASH as hash,createCandidateTransportProfileVNext} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/candidateTransportProfileC.mjs';

const prices=()=>({source_url:'https://provider.test/fixture-only',expires_at:'2099-01-01',models:{
  'gpt-6-luna':{provider_host:'api.openai.com',max_input_tokens:1000,input_per_million:.1,output_per_million:.5,flex:{input_per_million:.05,output_per_million:.25}},
  'gemini-3.8-flash':{provider_host:'generativelanguage.googleapis.com',max_input_tokens:1000,input_per_million:1,output_per_million:3,batch:{input_per_million:.5,output_per_million:1.5}}
}});
const env={OPENAI_API_KEY:'fixture',GEMINI_API_KEY:'fixture'},path=()=>join(mkdtempSync(join(tmpdir(),'mm-c-waves-')),'budget.sqlite');
const body=id=>({generationConfig:{maxOutputTokens:100},contents:[{parts:[{text:JSON.stringify({candidate_id:id})}]}]});
const wrapper=(ledger,ids,fetchImpl,priceSource=prices)=>createCandidateTransportProfileVNext({ledger,profileName:policy.policy_name,profileHash:hash,candidateIds:ids,phaseCapUsd:.1,fetchImpl,prices:priceSource,env});
const init=p=>{const l=new BudgetLedger(p);l.reconcileHistory({spent_usd:0,basis:'Isolated software test; no provider charges.',confirmed_at:new Date().toISOString()});return l;};

test('isolated C resumes saved receipts after restart without reposting accepted batches or completed requests',async()=>{
  const p=path(),ids=Array.from({length:23},(_,i)=>'candidate-'+i);let l=init(p),posted=[];
  let t=wrapper(l,ids,async(url,options)=>{assert.ok(url.endsWith(':batchGenerateContent'));const keys=JSON.parse(options.body).batch.inputConfig.requests.requests.map(r=>r.metadata.key);posted.push(keys);assert.ok(keys.length<=10);return Response.json({name:'batches/c-wave-'+posted.length});});
  for(let i=0;i<ids.length;i++)await assert.rejects(t.generate('gemini',body(ids[i]),{key:'key-'+String(i).padStart(2,'0'),stage:'independent_evaluation',candidate_id:ids[i]}),BatchPending);
  const first=await t.flush();assert.deepEqual(posted.map(x=>x.length),[10,10,3]);assert.equal(first.accepted_request_count,23);
  assert.equal(l.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state='submitted'").get().n,23);l.close();
  l=new BudgetLedger(p);let polls=0;
  t=wrapper(l,ids,async(url,options)=>{assert.equal(options?.method||'GET','GET');polls++;const number=Number(url.match(/c-wave-(\d+)$/)[1]);return Response.json({done:true,metadata:{state:'JOB_STATE_SUCCEEDED'},response:{inlinedResponses:posted[number-1].map(key=>({metadata:{key},response:{responseId:'response-'+key,usageMetadata:{promptTokenCount:10,candidatesTokenCount:4,thoughtsTokenCount:2},candidates:[{finishReason:'STOP',content:{parts:[{text:'{"valid":true}'}]}}]}}))}});},()=>{const changed=prices();changed.models['gemini-3.8-flash'].batch.input_per_million=99;return changed;});
  for(let i=0;i<ids.length;i++){const key='key-'+String(i).padStart(2,'0');await t.reconcile(key);assert.equal(l.db.prepare('SELECT state,actual FROM requests WHERE id=(SELECT reservation_id FROM provider_batches WHERE id=?)').get(key).actual,14);await t.generate('gemini',body(ids[i]),{key,stage:'independent_evaluation',candidate_id:ids[i]});}
  assert.equal(polls,3);assert.equal(l.snapshot().unresolved,0);assert.equal(posted.length,3,'replayed completed requests must use saved receipts, not provider submissions');l.close();
});

test('a foreign candidate late in the queue blocks every submission rather than consuming the earlier scoped chunks',async()=>{
  const l=init(path()),ids=Array.from({length:10},(_,i)=>'c-'+i);let calls=0;
  const fetchImpl=async()=>{calls++;throw Error('must_not_dispatch');},t=wrapper(l,ids,fetchImpl);
  for(let i=0;i<10;i++)await assert.rejects(t.generate('gemini',body(ids[i]),{key:'a-'+i,candidate_id:ids[i]}),BatchPending);
  const foreign=createFactoryTransport({ledger:l,fetchImpl,prices,env,queueGemini:true});
  await assert.rejects(foreign.generate('gemini',body('foreign'),{key:'z-foreign',candidate_id:'foreign'}),BatchPending);
  await assert.rejects(t.flush(),/queued_gemini_candidate_outside_profile/);assert.equal(calls,0);assert.equal(l.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state='queued'").get().n,11);l.close();
});

test('an interrupted later native submission retains its exact uncertain keys and never reposts accepted batches',async()=>{
  const p=path(),ids=Array.from({length:12},(_,i)=>'c-'+i);let l=init(p),posts=0;
  let t=wrapper(l,ids,async()=>{posts++;if(posts===2)throw Error('lost_response');return Response.json({name:'batches/c-accepted-first'});});
  for(let i=0;i<12;i++)await assert.rejects(t.generate('gemini',body(ids[i]),{key:'k-'+String(i).padStart(2,'0'),candidate_id:ids[i]}),BatchPending);
  await assert.rejects(t.flush(),/lost_response/);assert.equal(posts,2);assert.equal(l.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state='submitted'").get().n,10);assert.equal(l.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state='unresolved'").get().n,2);
  const held=l.snapshot().committed_micro;l.close();l=new BudgetLedger(p);
  t=wrapper(l,ids,async()=>{posts++;throw Error('must_not_repost');});await t.flush();assert.equal(posts,2);assert.equal(l.snapshot().committed_micro,held);assert.equal(l.snapshot().unbounded_unresolved,0);l.close();
});
