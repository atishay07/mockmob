import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {authorOriginal} from '../lib/factoryCore.mjs';
import {validationContract} from '../lib/compactBenchmark.mjs';

const directory='artifacts/question-factory/execution-2026-10-07';
const campaign=JSON.parse(readFileSync(directory+'/campaign.json','utf8'));
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const benchmark=JSON.parse(readFileSync(directory+'/benchmark.json','utf8'));
if(validationContract()!==benchmark.registration.contract_hash)throw Error('frozen_validation_contract_changed');
const sql=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
const transport={async generate(provider,body,{key}){
 const row=sql.prepare('SELECT request_json,response_json,state FROM provider_batches WHERE id=? UNION ALL SELECT request_json,response_json,state FROM provider_requests WHERE id=?').get(key,key);
 if(!row||row.state!=='complete'||JSON.parse(row.request_json).config.stage!=='authoring')throw Error('saved_completed_authoring_response_required');
 return JSON.parse(row.response_json);
}};
try{
 const items=[];for(const job of campaign.jobs){try{items.push({id:job.id,subject:job.subject,candidate:await authorOriginal(job,{registry,transport}),author_failure:null});}
  catch(error){if(!error.candidate)throw error;items.push({id:job.id,subject:job.subject,candidate:error.candidate,author_failure:error.message});}}
 writeFileSync(directory+'/original-candidates.json',JSON.stringify({at:new Date().toISOString(),denominator:100,paid_calls:0,basis:'Original full authoring drafts recovered only from their saved provider responses; completion retries preserve their original durable keys. Repairs are separately retained in final records and the ledger.',items},null,2)+'\n');
 console.log(JSON.stringify({original_candidates:items.length,paid_calls:0}));
}finally{sql.close();}
