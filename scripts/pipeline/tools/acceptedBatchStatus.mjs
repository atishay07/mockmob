import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
loadEnvFile('.env.local');
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
try{
 const rows=ledger.db.prepare("SELECT provider,provider_id,count(*) requests FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL GROUP BY provider,provider_id").all();
 for(const row of rows){
  const url=row.provider==='openai'?'https://api.openai.com/v1/batches/'+row.provider_id:'https://generativelanguage.googleapis.com/v1beta/'+row.provider_id;
  const headers=row.provider==='openai'?{Authorization:'Bearer '+(process.env.CUET_FACTORY_OPENAI_KEY||process.env.OPENAI_API_KEY)}:{'x-goog-api-key':process.env.CUET_FACTORY_GEMINI_KEY||process.env.GEMINI_API_KEY};
  const response=await fetch(url,{headers});if(!response.ok)throw Error('batch_status_http_'+response.status);
  const b=await response.json();console.log(JSON.stringify({...row,status:b.status||b.metadata?.state,counts:b.request_counts,created_at:b.created_at,output_file_available:!!b.output_file_id,error_file_available:!!b.error_file_id}));
 }
}finally{ledger.close();}
