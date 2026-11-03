import {loadEnvFile} from 'node:process';
import {writeFileSync} from 'node:fs';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
try{loadEnvFile('.env.local');}catch{}
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
try{
 const groups=ledger.db.prepare("SELECT provider,provider_id,count(*) AS items,min(created_at) AS saved_at FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL GROUP BY provider,provider_id").all(),results=[];
 for(const group of groups){
  const openai=group.provider==='openai',key=openai?process.env.CUET_FACTORY_OPENAI_KEY||process.env.OPENAI_API_KEY:process.env.CUET_FACTORY_GEMINI_KEY||process.env.GEMINI_API_KEY;
  const response=await fetch(openai?'https://api.openai.com/v1/batches/'+group.provider_id:'https://generativelanguage.googleapis.com/v1beta/'+group.provider_id,{headers:openai?{Authorization:'Bearer '+key}:{'x-goog-api-key':key},signal:AbortSignal.timeout(30000)});
  const data=await response.json();results.push({...group,http_status:response.status,status:data.status||data.metadata?.state||data.state,counts:data.request_counts||data.metadata?.batchStats||null,created_at:data.created_at,in_progress_at:data.in_progress_at,completed_at:data.completed_at});
 }
 const report={at:new Date().toISOString(),groups:results,budget:ledger.snapshot(),paid_requests_submitted:0};
 writeFileSync('artifacts/question-factory/execution-2026-10-07/provider-status.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{ledger.close();}
