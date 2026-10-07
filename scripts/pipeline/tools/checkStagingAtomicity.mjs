import assert from 'node:assert/strict';
import {loadEnvFile} from 'node:process';
import {writeFileSync,readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
loadEnvFile('.env.staging');
if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const prefix='staging-storage-contract-20261007',ids=[prefix+'-one',prefix+'-a',prefix+'-b'],gid=prefix+'-passage';
const {data:control,error:readError}=await db.from('question_factory_control').select('*').eq('id',1).single();if(readError)throw readError;
const checked=async promise=>{const {data,error}=await promise;if(error)throw error;return data;};
const count=async table=>(await checked(db.from(table).select('id').in('id',ids))).length;
const report={at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',software_fixtures:true,academic_publications:0,production_writes:0,checks:[]};
const author=JSON.parse(readFileSync('.cache/factory-staging-auth.json')).admin.id;
const row=id=>({id,author_id:author,subject:'economics',chapter:'Consumer Behaviour',body:'Disposable storage contract fixture '+id,options:['one','two','three','four'],correct_answer:'A',explanation:'A software fixture, excluded from academic output.',difficulty:'easy',family_id:prefix,provenance:{kind:'original_practice'},status:'live',verification_state:'verified',exploration_state:'active',evidence:{record:{policy_version:'cuet-llm-v3',state:'published'},signature:'software-fixture-not-academic-evidence'}});
try{
 await checked(db.from('question_factory_control').update({paused:false,phase:'1000',publication_enabled:true}).eq('id',1));
 await checked(db.from('question_factory_jobs').upsert(ids.map((id,i)=>({id,subject:'economics',chapter:'Consumer Behaviour',kind:'original_practice',state:'eligible',...(i?{passage_group_id:gid}:{})}))));
 const one=row(ids[0]);for(let i=0;i<2;i++)await checked(db.rpc('publish_factory_question',{p_row:one,p_fingerprint:prefix+'-fp',p_job:ids[0]}));assert.equal(await count('questions'),1);report.checks.push('single publication idempotent');
 const children=ids.slice(1).map((id,i)=>({...row(id),passage_group_id:gid,passage_id:gid,passage_text:'Disposable complete software fixture passage.',order_index:i}));
 const group={id:gid,subject:'economics',chapter:'Consumer Behaviour',passage_text:children[0].passage_text,title:'Storage contract fixture',passage_type:'reading_comprehension',status:'live',discoverable:false,source:'software-fixture'};
 const alone=await db.rpc('publish_factory_question',{p_row:children[0],p_fingerprint:prefix+'-a-fp',p_job:ids[1]});assert.ok(alone.error);report.checks.push('single passage child rejected');
 const failed=await db.rpc('publish_factory_passage_group',{p_group:group,p_rows:children,p_fingerprints:[prefix+'-fp',prefix+'-b-fp'],p_jobs:ids.slice(1)});assert.ok(failed.error);assert.equal(await count('questions'),1);
 const {data:groups}=await db.from('passage_groups').select('id').eq('id',gid);assert.equal(groups.length,0);report.checks.push('failed group rolls back passage and children');
 for(let i=0;i<2;i++)await checked(db.rpc('publish_factory_passage_group',{p_group:group,p_rows:children,p_fingerprints:[prefix+'-a-fp',prefix+'-b-fp'],p_jobs:ids.slice(1)}));assert.equal(await count('questions'),3);report.checks.push('complete group publishes atomically and idempotently');
 await checked(db.rpc('record_question_dispute',{p_id:prefix+'-dispute',p_question:ids[1],p_hash:'fixture-content-hash',p_receipt:{software_fixture:true,independent_key:'B'}}));
 const disputed=await checked(db.from('questions').select('status,verification_state,exploration_state').eq('id',ids[1]).single());assert.deepEqual(disputed,{status:'pending',verification_state:'disputed',exploration_state:'pending_review'});report.checks.push('dispute immediately invalidates availability');report.passed=true;
}finally{
 // Only the three explicitly named disposable fixtures in this separate staging project.
 await checked(db.from('question_content_disputes').delete().eq('id',prefix+'-dispute'));
 await checked(db.from('question_factory_publications').delete().in('question_id',ids));
 await checked(db.from('questions').delete().in('id',ids));
 await checked(db.from('passage_groups').delete().eq('id',gid));
 await checked(db.from('question_factory_jobs').delete().in('id',ids));
 await checked(db.from('question_factory_control').update({paused:control.paused,phase:control.phase,publication_enabled:control.publication_enabled}).eq('id',1));
 report.fixture_rows_remaining=await count('questions');writeFileSync('artifacts/question-factory/execution-2026-10-07/staging/storage-contract-checks.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
