import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';

loadEnvFile('.env.staging');
if(!process.argv.includes('--staging')||process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('explicit_separate_staging_required');
const root='artifacts/question-factory/continuation-500/',path=root+'practice-launch-checks.json',base='http://localhost:3101';
const boundedFetch=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(60000)});
const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:boundedFetch}});
const {data:identity,error:identityError}=await db.from('users').select('id,email,role,credit_balance').eq('email','factory-staging-student@example.com').single();
if(identityError)throw identityError;assert.equal(identity.role,'student');
const {data:link,error:linkError}=await db.auth.admin.generateLink({type:'magiclink',email:identity.email});
if(linkError)throw linkError;assert.equal(link.user.id,identity.id);let jar=[];
const client=createServerClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_ANON_KEY,{global:{fetch:boundedFetch},cookies:{getAll:()=>jar,setAll:v=>{jar=v;}}});
const {error:loginError}=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:link.properties.verification_type});if(loginError)throw loginError;
const cookie=jar.map(c=>c.name+'='+c.value).join('; ');
const known=new Map(JSON.parse(readFileSync(root+'approved-published.json')).map(j=>[j.id,j.candidate]));
const state=existsSync(path)?JSON.parse(readFileSync(path)):{registered_at:new Date().toISOString(),environment:'separate_staging',student_id:identity.id,balance_before:identity.credit_balance,
  scope:'Actual disposable-staging practice sessions with synthetic unanswered submissions; no academic reliability or observed learner-gain claim.',
  checks:[{subject:'english',mode:'quick',count:10,purpose:'ordinary_practice'},...['english','accountancy','business_studies','economics'].map(subject=>({subject,mode:'full',count:50,purpose:'full_sample'}))].map(c=>({...c,generationKey:'factory_launch_20261007_'+c.subject+'_'+c.mode,state:'registered'})),paid_provider_calls:0,emails_sent:0,production_writes:0};
assert.equal(state.student_id,identity.id);
const save=()=>writeFileSync(path,JSON.stringify(state,null,2)+'\n');save();
const log=check=>console.log(JSON.stringify({subject:check.subject,mode:check.mode,state:check.state,http:check.launch_http,reason:check.reason,launch_replay_free:check.launch_replay_free,submission_replay_idempotent:check.submission_replay_idempotent}));
async function balance(){const {data,error}=await db.from('users').select('credit_balance').eq('id',identity.id).single();if(error)throw error;return data.credit_balance;}
async function request(method,body){const response=await boundedFetch(base+'/api/sessions',{method,headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();return{http:response.status,data};}
if(process.argv.includes('--provision-test-credits')&&!state.test_credit_fixture){
 // This named disposable staging identity has no monetary entitlement. Provision
 // only the credits needed to finish this frozen API check; retain every earlier
 // transaction and record the fixture separately from real payment evidence.
 const before=await balance(),fixture={at:new Date().toISOString(),before,added:160,state:'registered',scope:'Disposable staging test credits; no payment, entitlement, or production change'};
 state.test_credit_fixture=fixture;save();
 const {data,error}=await db.from('users').update({credit_balance:before+160}).eq('id',identity.id).eq('email',identity.email).eq('role','student').eq('credit_balance',before).select('id');
 if(error||data.length!==1)throw Error('test_credit_fixture_conflict');fixture.state='provisioned';save();
}
if(state.test_credit_fixture&&state.test_credit_fixture.state!=='provisioned')throw Error('test_credit_fixture_requires_reconciliation');
for(const check of state.checks){
 if(check.state==='passed')continue;
 if(check.state!=='registered'){
  (check.previous_attempts||=[]).push({at:state.updated_at,state:check.state,reason:check.reason,session_id:check.session_id,question_ids:check.question_ids});
  // The first quick submission succeeded; its initial assertion addressed a
  // non-existent response field. Retain that actual attempt and use one frozen
  // new test key for the corrected launch/submission/replay check.
  if(check.mode==='quick'&&!check.generationKey.endsWith('_compact')){
   const {data,error}=await db.from('attempts').select('id,correct,wrong,unattempted,total,score').eq('id',check.session_id).eq('user_id',identity.id).single();if(error)throw error;
   assert.equal(data.correct,0);assert.equal(data.wrong,0);assert.equal(data.unattempted,10);check.previous_attempts.at(-1).actual_submission=data;
   check.generationKey+='_compact';delete check.session_id;
  }
  delete check.reason;check.state='registered';save();
 }
 // Stable keys are saved before dispatch. A network interruption resumes the
 // same session instead of creating another charge or another question set.
 const input={experience:'practice',subject:check.subject,mode:check.mode,count:check.count,purpose:check.purpose,generationKey:check.generationKey};
 try{
  const start=await request('POST',input);
  check.launch_http=start.http;
  if(start.http!==200){check.state='launch_failed';check.reason=start.data.error;save();log(check);continue;}
  const session=start.data;check.session_id=session.id;check.question_ids=session.questions.map(q=>q.id);check.state='started';save();
  assert.equal(session.questions.length,check.count);assert.equal(new Set(check.question_ids).size,check.count);
  assert.equal(Date.parse(session.expiresAt)-Date.parse(session.startedAt),check.mode==='full'?3600000:600000);
  for(const q of session.questions){assert.ok(known.has(q.id),'Only actual new approved staging questions enter practice');assert.equal(q.options.length,4);assert.deepEqual(q.options.map(o=>o.key),['A','B','C','D']);assert.ok(!('correct_answer' in q),'No key in the timed-session response');const e=known.get(q.id);if(e.passage_text)assert.equal(q.passageText,e.passage_text);}
  const charged=await balance(),replay=await request('POST',input);assert.equal(replay.http,200);assert.equal(replay.data.id,session.id);assert.deepEqual(replay.data.questions,session.questions);assert.equal(await balance(),charged);
  check.launch_replay_free=true;
  const submitBody={sessionId:session.id,answers:{},events:[],...(session.meta?.sessionTicket?{sessionTicket:session.meta.sessionTicket}:{})};
  const submitted=await request('PATCH',submitBody);assert.equal(submitted.http,200,JSON.stringify(submitted.data));
  assert.equal(submitted.data.correct*5-submitted.data.wrong,0);assert.equal(submitted.data.correct,0);assert.equal(submitted.data.wrong,0);assert.equal(submitted.data.unattempted,check.count);
  const submittedReplay=await request('PATCH',submitBody);assert.equal(submittedReplay.http,200);assert.deepEqual(submittedReplay.data,submitted.data);assert.equal(await balance(),charged);
  check.submission_replay_idempotent=true;check.synthetic_unanswered_raw_score=0;check.state='passed';
 }catch(error){check.state='check_failed';check.reason=error.message;}
 state.updated_at=new Date().toISOString();save();log(check);
}
state.balance_after=await balance();state.staging_credits_spent=state.balance_before+(state.test_credit_fixture?.added||0)-state.balance_after;state.passed=state.checks.every(c=>c.state==='passed');state.updated_at=new Date().toISOString();save();
console.log(JSON.stringify({passed:state.passed,checks:state.checks.map(c=>({subject:c.subject,mode:c.mode,state:c.state,reason:c.reason})),staging_credits_spent:state.staging_credits_spent,production_writes:0,paid_provider_calls:0}));
assert.equal(state.passed,true,'All real staging launches and idempotent submissions must pass');
