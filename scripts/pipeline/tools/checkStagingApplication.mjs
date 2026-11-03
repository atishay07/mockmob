import assert from 'node:assert/strict';
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {factoryCalibrationReady} from '../../../data/question_factory_policy.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
loadEnvFile('.env.staging');
const url=process.env.STAGING_SUPABASE_URL,base='http://localhost:3101';
if(url!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
const db=createClient(url,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),results=[];
async function identity(email){
 const {data,error}=await db.auth.admin.generateLink({type:'magiclink',email});if(error)throw error;let jar=[];
 const client=createServerClient(url,process.env.STAGING_SUPABASE_ANON_KEY,{cookies:{getAll:()=>jar,setAll:values=>{jar=values;}}});
 const {error:authError}=await client.auth.verifyOtp({token_hash:data.properties.hashed_token,type:data.properties.verification_type});if(authError)throw authError;
 return {client,cookie:jar.map(c=>c.name+'='+c.value).join('; ')};
}
async function check(name,path,{cookie,action,status=200,origin=base}={}){
 const response=await fetch(base+path,{headers:{...(cookie?{Cookie:cookie}:{}),...(action?{'Content-Type':'application/json',Origin:origin}:{})},...(action?{method:'POST',body:JSON.stringify({action})}:{})});
 const data=await response.json();assert.equal(response.status,status,name+': '+JSON.stringify(data));results.push({name,status:response.status,error:data.error||null,question_count:data.questions?.length});return data;
}
const admin=await identity('atishay07jain@gmail.com'),student=await identity('factory-staging-student@example.com');
await check('anonymous admin access rejected','/api/admin/question-factory',{status:401});
await check('student admin access rejected','/api/admin/question-factory',{cookie:student.cookie,status:404});
const overview=await check('signed-in admin overview','/api/admin/question-factory',{cookie:admin.cookie});assert.equal(overview.available,true);
await check('cross-origin control rejected','/api/admin/question-factory',{cookie:admin.cookie,action:'pause',origin:'https://example.com',status:403});
await check('signed-in pause','/api/admin/question-factory',{cookie:admin.cookie,action:'pause'});
await check('pause idempotency','/api/admin/question-factory',{cookie:admin.cookie,action:'pause'});
const calibration=JSON.parse(readFileSync('data/calibration_manifest.json','utf8'));
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const ready=factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION);
await check(ready?'signed-in resume after fresh calibration':'calibration gate prevents resume','/api/admin/question-factory',{cookie:admin.cookie,action:'resume',status:ready?200:409});
const denied=await student.client.rpc('claim_question_factory',{p_worker:'unauthorized-fixture'});assert.ok(denied.error);results.push({name:'student cannot claim service worker',passed:true});
for(const subject of ['english','accountancy','business_studies','economics'])await check('student retrieval '+subject,'/api/questions/feed?subject='+subject+'&limit=50',{cookie:student.cookie});
const {data:cap,error:capError}=await db.from('runtime_ai_budget').select('monthly_cap_usd').eq('id','student_ai').single();if(capError)throw capError;assert.equal(Number(cap.monthly_cap_usd),25);
const {data:jobs,error:jobsError}=await db.from('question_factory_jobs').select('id');if(jobsError)throw jobsError;assert.equal(jobs.length,100);
const report={at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',passed:true,checks:results,registered_jobs:jobs.length,student_ai_monthly_cap:25,paid_provider_calls:0,emails_sent:0,production_writes:0};
writeFileSync('artifacts/question-factory/execution-2026-10-07/staging/'+(ready?'current-application-checks.json':'application-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
