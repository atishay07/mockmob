import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {hostname} from 'node:os';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';

loadEnvFile('.env.staging');
assert.equal(process.env.STAGING_SUPABASE_URL,'https://onwkqxmjqjrhfbjjdydu.supabase.co');
const directory='artifacts/question-factory/execution-2026-10-07';
const campaign=JSON.parse(readFileSync(directory+'/campaign.json','utf8'));
const ledgerPath=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite';
const sql=new DatabaseSync(ledgerPath,{readOnly:true});
try {
  const lease=sql.prepare('SELECT owner,expires FROM factory_worker WHERE id=1').get();
  assert.ok(lease?.expires>Date.now());
  process.kill(Number(lease.owner.split(':')[0]),0);
  const ledgerId=sql.prepare("SELECT value FROM ledger_metadata WHERE id='ledger_identity'").get().value;
  const identity=createHash('sha256').update(`${hostname()}:${resolve(ledgerPath)}:${ledgerId}`).digest('hex');
  const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const {data:control,error}=await db.from('question_factory_control').select('worker_id,snapshot').eq('id',1).single();
  if(error)throw error;
  assert.equal(control.worker_id,identity);
  const authoring=sql.prepare("SELECT json_extract(request_json,'$.config.candidate_id') AS candidate_id,count(*) AS saved_requests,count(DISTINCT provider_id) AS accepted_ids,min(provider_id) AS provider_id FROM provider_batches WHERE json_extract(request_json,'$.config.stage')='authoring' GROUP BY candidate_id").all().filter(r=>campaign.jobs.some(j=>j.id===r.candidate_id));
  assert.equal(authoring.length,100);
  assert.ok(authoring.every(r=>r.saved_requests===1&&r.accepted_ids===1&&r.provider_id==='batch_6ac56ba712c48190844a05f35788a7d6'));
  const proof={at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',passed:true,worker_identity:identity,live_process:Number(lease.owner.split(':')[0]),accepted_generation_id:authoring[0].provider_id,unique_registered_candidates:100,saved_requests_per_candidate:1,duplicate_submissions:0,paid_requests_submitted_by_check:0,production_writes:0,scope:'Current live process after restart preserves the original accepted IDs. Concurrency and dead-lease recovery are separately tested.'};
  writeFileSync(directory+'/staging/worker-restart.json',JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify(proof));
} finally {sql.close();}
