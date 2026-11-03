import { loadEnvFile } from 'node:process';
import { mkdirSync,writeFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only account checks. No model generation, uploads or batch submissions.
export async function providerPreflight({env=process.env,fetchImpl=fetch}={}) {
  const openai=env.CUET_FACTORY_OPENAI_KEY || env.OPENAI_API_KEY;
  const gemini=env.CUET_FACTORY_GEMINI_KEY || env.GEMINI_API_KEY;
  async function get(url,headers) {
    try {
      const response=await fetchImpl(url,{headers,redirect:'error',signal:AbortSignal.timeout(30000)});
      const body=await response.json();
      return {status:response.status,ok:response.ok,body};
    } catch {return {ok:false,status:null,error:'network_or_response_unavailable'};}
  }
  const checks=await Promise.all([
    openai?get('https://api.openai.com/v1/models/gpt-6-luna',{Authorization:`Bearer ${openai}`}):null,
    openai?get('https://api.openai.com/v1/batches?limit=1',{Authorization:`Bearer ${openai}`}):null,
    gemini?get('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash',{'x-goog-api-key':gemini}):null,
    gemini?get('https://generativelanguage.googleapis.com/v1beta/batches?pageSize=1',{'x-goog-api-key':gemini}):null
  ]);
  const status=result=>result?{http_status:result.status,accessible:result.ok,error_code:result.body?.error?.code || result.error || null,
    error_type:/API key not valid|API_KEY_INVALID/i.test(result.body?.error?.message || '')?'invalid_api_key':result.body?.error?.status || null}:{accessible:false,error_code:'key_missing'};
  const databaseUrl=env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const db=databaseUrl && env.SUPABASE_SERVICE_ROLE_KEY?await get(`${databaseUrl}/rest/v1/question_factory_control?select=id,paused,phase&limit=1`,{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`}):null;
  return {at:new Date().toISOString(),read_only:true,paid_generation_requests:0,api_generation_spend_usd:0,
    openai:{model:'gpt-6-luna',model_access:status(checks[0]),batch_list_access:status(checks[1])},
    gemini:{model:'gemini-3.8-flash',model_access:status(checks[2]),generation_methods:checks[2]?.ok?checks[2].body.supportedGenerationMethods || []:[],batch_list_access:status(checks[3])},
    database:{factory_control:status(db)},
    limitations:['Model lookup and batch-list access do not prove successful submission, quota, billing or completion.','The database check is read-only; no schema migration or control changes.']};
}
export function providerBlocker(report) {
  for(const provider of ['openai','gemini']) {
    const checks=report[provider];
    if(checks?.model_access?.error_type==='invalid_api_key' || checks?.batch_list_access?.error_type==='invalid_api_key')return `${provider}_invalid_api_key`;
    if(!checks?.model_access?.accessible || !checks?.batch_list_access?.accessible)return `${provider}_batch_access_unconfirmed`;
  }
  return null;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{loadEnvFile('.env.local');}catch{ /* inherited environment */ }
  const report=await providerPreflight(),path=resolve(process.argv[2] || 'artifacts/question-factory/provider-preflight.json');
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
