// Read-only deployment diagnosis. No RPCs, model calls, row writes or account records.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import { RELEASE_GATES } from '../../data/capabilities.js';
const report={checkedAt:new Date().toISOString(),readOnly:true,runtimeGateOpen:RELEASE_GATES.runtimeAi,providerKeyConfigured:Boolean(process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY),emergencyDisabled:process.env.PREPOS_MODEL_REPLIES_DISABLED==='true',tables:{}};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(url && key){
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})}});
  await Promise.all(['ai_credit_wallets','ai_credit_ledger','ai_credit_reservations','runtime_ai_requests','runtime_ai_prices'].map(async table=>{
    try {const {error}=await sb.from(table).select('*',{head:true}).limit(1);report.tables[table]={readable:!error,errorCode:error?.code || null};}
    catch {report.tables[table]={readable:false,errorCode:'transport_failure'};}
  }));
  try {
    const {data,error}=await sb.from('runtime_ai_budget').select('monthly_cap_usd,spent_usd,reserved_usd,paused').eq('id','student_ai').maybeSingle();
    report.tables.runtime_ai_budget={readable:!error,errorCode:error?.code || null};
    // Monthly cap (owner, 4 Oct 2026): spend is counted per IST month inside reserve_runtime_ai.
    report.fundingAvailable=Boolean(!error && data && !data.paused && Number(data.monthly_cap_usd)>0);report.monthlyCapUsd=data ? Number(data.monthly_cap_usd) : null;
  }catch {report.tables.runtime_ai_budget={readable:false,errorCode:'transport_failure'};report.fundingAvailable=false;}
  try {
    const {data,error}=await sb.from('runtime_ai_prices').select('provider,model,input_per_million,output_per_million,verified_at').limit(100);
    // Prices are valid 90 days in the database; warn from day 75.
    const pairs=[{provider:'openai',model:process.env.AI_LUNA_MODEL || 'gpt-6-luna'}];
    report.configuredPricesVerified=!error && pairs.every(p=>(data||[]).some(r=>r.provider===p.provider&&r.model===p.model&&Number(r.input_per_million)>0&&Number(r.output_per_million)>0&&Date.parse(r.verified_at)>Date.now()-75*86400000));
  }catch {report.configuredPricesVerified=false;}
} else report.connectionConfigured=false;
report.activationReady=Boolean(report.fundingAvailable && report.configuredPricesVerified && Object.values(report.tables).every(t=>t.readable)); // Live calls are proven separately by ai-live-smoke.mjs.
await fs.mkdir('artifacts/round6',{recursive:true});
await fs.writeFile('artifacts/round6/prepos-readiness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
