import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {readBankSnapshot} from '../lib/bankSnapshot.mjs';
import {contentHash} from '../../../data/content_evidence.js';
import {inspectBatch} from '../lib/batchInspection.mjs';
loadEnvFile('.env.local');loadEnvFile('.env.staging');
if(!process.argv.includes('--staging')||!process.argv.includes('--approved-production'))throw Error('explicit_staging_and_approved_production_required');
const root='artifacts/question-factory/continuation-500/',read=p=>JSON.parse(readFileSync(root+p)),path=root+'published-novelty-withholding.json';
const rows=read('approved-published.json'),review=inspectBatch(rows),duplicateIds=new Set(review.decisions.map(d=>d.id));
assert.equal(review.decisions.filter(d=>!d.duplicate_of&&d.reason!=='unsupported_conjunctive_antonym_explanation').length,0,'Unrelated evidence failures need a separate review');
const reasonFor=j=>review.decisions.find(d=>d.id===j.id)?.reason||'duplicate_passage_fact_atomic_group';
const groups=new Set(rows.filter(j=>duplicateIds.has(j.id)).map(j=>j.candidate.passage_group_id).filter(Boolean));
const affected=rows.filter(j=>duplicateIds.has(j.id)||groups.has(j.candidate.passage_group_id));
const journal=existsSync(path)?JSON.parse(readFileSync(path)):{at:new Date().toISOString(),reason:'duplicate_passage_fact_atomic_group',academic_wrong_key_alleged:false,paid_provider_calls:0,records:[]};
const save=()=>writeFileSync(path,JSON.stringify(journal,null,2)+'\n');
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),store=new FactoryStore(ledger,'data/pipeline-budget.sqlite');
try{
 ledger.assertHistoryReconciled();store.claim();
 if(affected.length){journal.completed=false;journal.latest_started_at=new Date().toISOString();save();}
 for(const environment of ['staging','production']){
  const url=environment==='staging'?process.env.STAGING_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(url,'https://'+(environment==='staging'?'onwkqxmjqjrhfbjjdydu':'isrxrxzjocewrdureyhp')+'.supabase.co');
  const db=createClient(url,environment==='staging'?process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:(u,i={})=>fetch(u,{...i,signal:AbortSignal.timeout(30000)})}});
  const bank=await readBankSnapshot(db);
  for(const j of affected){
   const row=bank.find(q=>q.id===j.id);assert.ok(row,'Existing publication required');assert.equal(contentHash(row),contentHash(j.candidate),'Content must remain exactly unchanged');
   let receipt=journal.records.find(r=>r.environment===environment&&r.id===j.id);
   if(receipt?.completed)continue;
   if(!receipt){receipt={environment,id:j.id,reason:reasonFor(j),cohort:j.cohort,group_id:j.candidate.passage_group_id||null,content_hash:contentHash(row),prior_status:row.status,prior_verification_state:row.verification_state,started_at:new Date().toISOString()};journal.records.push(receipt);save();}
   const {error}=await db.rpc('record_question_dispute',{p_id:'novelty-v2-'+j.id,p_question:j.id,p_hash:receipt.content_hash,p_receipt:{reason:reasonFor(j),duplicate_decisions:review.decisions.filter(d=>d.id===j.id),group_id:receipt.group_id,academic_wrong_key_alleged:false,paid_provider_calls:0}});if(error)throw error;
   const {data:held,error:heldError}=await db.from('questions').select('status,verification_state').eq('id',j.id).single();if(heldError)throw heldError;assert.equal(held.verification_state,'disputed');
   const {error:jobError}=await db.from('question_factory_jobs').update({state:'quarantined',stage:'complete'}).eq('id',j.id);if(jobError)throw jobError;
   receipt.completed=true;receipt.finished_at=new Date().toISOString();save();
  }
 }
 for(const j of affected){const current=store.get(j.id);assert.ok(current);if(current.state==='quarantined')continue;assert.equal(current.state,'published');
  store.set(j.id,{...current,state:'quarantined',publication_history:{previous_state:'published',retained_receipts:true,withholding:journal.records.filter(r=>r.id===j.id)},result:{...current.result,state:'quarantined',reasons:[...new Set([...(current.result?.reasons||[]),reasonFor(j)])]}});
 }
 journal.completed=true;journal.finished_at=new Date().toISOString();save();console.log(JSON.stringify({withheld_questions:affected.length,atomic_groups:groups.size,environment_count:2,paid_provider_calls:0,historical_receipts_preserved:true}));
}finally{store.release();ledger.close();}
