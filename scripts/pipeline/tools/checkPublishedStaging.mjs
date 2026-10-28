import assert from 'node:assert/strict';import {loadEnvFile} from 'node:process';import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';import {createServerClient} from '@supabase/ssr';
import {contentHash} from '../../../data/content_evidence.js';
loadEnvFile('.env.staging');const url=process.env.STAGING_SUPABASE_URL,base='http://localhost:3101';if(url!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
const dir='artifacts/question-factory/execution-2026-10-07',read=p=>JSON.parse(readFileSync(dir+'/'+p));
const report=read('batch-report.json'),all=read('all-100.json');assert.equal(report.complete,true);assert.equal(report.cost.held_usd,0);assert.ok(report.newly_published>0);
const db=createClient(url,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),checks=[];
async function login(email){const {data,error}=await db.auth.admin.generateLink({type:'magiclink',email});if(error)throw error;let jar=[];const client=createServerClient(url,process.env.STAGING_SUPABASE_ANON_KEY,{cookies:{getAll:()=>jar,setAll:v=>{jar=v;}}});const {error:e}=await client.auth.verifyOtp({token_hash:data.properties.hashed_token,type:data.properties.verification_type});if(e)throw e;return jar.map(c=>c.name+'='+c.value).join('; ');}
const student=await login('factory-staging-student@example.com'),admin=await login('atishay07jain@gmail.com');
async function get(path,cookie,status=200){const r=await fetch(base+path,{headers:{Cookie:cookie}}),data=await r.json();assert.equal(r.status,status,path+':'+JSON.stringify(data));return data;}
const overview=await get('/api/admin/question-factory',admin);assert.equal(overview.counts.total,report.newly_published);checks.push({name:'signed-in admin actual publication count',count:overview.counts.total});
await get('/api/admin/question-factory',student,404);
const expected=new Set(all.filter(j=>j.state==='published').map(j=>j.id)),rejected=new Set(all.filter(j=>j.state==='quarantined').map(j=>j.id)),received=new Set();
for(const subject of ['english','accountancy','business_studies','economics']){
 const feed=await get('/api/questions/feed?subject='+subject+'&limit=50',student),actual=feed.questions||[];
 assert.equal(actual.length,all.filter(j=>j.subject===subject&&j.state==='published').length);assert.ok(actual.every(q=>expected.has(q.id)&&!rejected.has(q.id)));actual.forEach(q=>received.add(q.id));
 for(const q of actual){const registered=all.find(j=>j.id===q.id).candidate;
  assert.equal(q.correct_answer,registered.correct_answer);assert.equal(q.explanation,registered.explanation);
  assert.deepEqual(q.options.map(o=>o.key),['A','B','C','D']);assert.deepEqual(q.options.map(o=>o.text),registered.options);
  if(registered.route==='passage')assert.equal(q.passage_text,registered.passage_text,'Student receives the complete validated passage');
 }
 const groups=actual.filter(q=>q.passage_group_id);assert.ok(groups.every(q=>q.passage_text?.trim()));
 checks.push({name:'student retrieval '+subject,count:actual.length,passage_children:groups.length,rejected_received:0});
 const quote=await get('/api/practice/quote?subject='+subject+'&mode=quick&count=10',student);checks.push({name:'student practice quote '+subject,state:quote.state,reason:quote.reasonCode||null});
}
assert.equal(received.size,expected.size);const {count,error}=await db.from('questions').select('id',{count:'exact',head:true}).in('id',[...rejected]);if(error)throw error;assert.equal(count,0);
// Exercise the actual student filter with a real approved row, preserving its
// content, publication receipt and every provider receipt. This is explicitly an
// availability test in separate staging, not a claim that its key is disputed.
const selected=all.find(j=>j.state==='published'&&!j.candidate.passage_group_id),testId='staging-availability-test-'+selected.id;
const {data:original,error:originalError}=await db.from('questions').select('*').eq('id',selected.id).single();if(originalError)throw originalError;
let held;
try{
 const {error:disputeError}=await db.rpc('record_question_dispute',{p_id:testId,p_question:selected.id,p_hash:contentHash(original),p_receipt:{scope:'separate_staging_availability_test',academic_error_alleged:false,paid_provider_calls:0}});if(disputeError)throw disputeError;
 const {data,error:heldError}=await db.from('questions').select('updated_at,status,verification_state').eq('id',selected.id).single();if(heldError)throw heldError;held=data;
 const feed=await get('/api/questions/feed?subject='+selected.subject+'&limit=50',student);assert.ok(!feed.questions.some(q=>q.id===selected.id));checks.push({name:'dispute immediately excludes real approved row from student feed',question_id:selected.id,academic_error_alleged:false});
}finally{
 if(held){const {data,error:restoreError}=await db.from('questions').update({status:original.status,verification_state:original.verification_state,exploration_state:original.exploration_state}).eq('id',selected.id).eq('updated_at',held.updated_at).eq('verification_state','disputed').select('id');if(restoreError||data.length!==1)throw Error('staging_test_restore_conflict');}
 const {error:closeError}=await db.from('question_content_disputes').update({state:'resolved_staging_test',resolved_at:new Date().toISOString()}).eq('id',testId);if(closeError)throw closeError;
}
const restored=await get('/api/questions/feed?subject='+selected.subject+'&limit=50',student);assert.ok(restored.questions.some(q=>q.id===selected.id));checks.push({name:'unchanged verified row restored; test dispute receipt retained',question_id:selected.id});
const proof={at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',passed:true,checks,newly_published:expected.size,unique_retrieved:received.size,rejected_stored_as_questions:0,paid_provider_calls:0,production_writes:0};
writeFileSync(dir+'/staging/published-application-checks.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
