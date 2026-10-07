import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {publishFactoryQuestion,publishFactoryGroup} from '../lib/factoryCore.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {publicationEligibility} from '../../../data/evidence_registry.js';
loadEnvFile('.env.local');
const directory=process.argv[2];
if(!process.argv.includes('--approved-production')||!directory||!resolve(directory).startsWith(resolve('artifacts/question-factory')+'\\'))throw Error('explicit_approved_production_cohort_required');
if(process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://isrxrxzjocewrdureyhp.supabase.co')throw Error('production_target_mismatch');
const read=name=>JSON.parse(readFileSync(directory+'/'+name)),report=read('batch-report.json'),all=read('all-100.json'),inspection=read('batch-inspection.json'),registry=JSON.parse(readFileSync('data/source_registry.json'));
if(!report.complete||report.cost.held_usd||inspection.ready!==true||inspection.content_hash!==hashJSON(all.map(j=>({id:j.id,candidate:j.candidate,result:j.result}))))throw Error('complete_settled_inspected_cohort_required');
const approved=all.filter(j=>['eligible','published'].includes(j.state));
if(approved.some(j=>!publicationEligibility(j.candidate).eligible))throw Error('current_publication_evidence_required');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:owner,error:ownerError}=await db.from('users').select('id,role').eq('id',process.env.CUET_CONTENT_AUTHOR_ID).single();
if(ownerError||owner.role!=='admin')throw Error('existing_production_admin_required');
const {count:before,error:beforeError}=await db.from('question_factory_publications').select('question_id',{head:true,count:'exact'}).in('question_id',approved.map(j=>j.id));if(beforeError)throw beforeError;
const dir=directory+'/production';mkdirSync(dir,{recursive:true});
const receipts=[];let completed=false;
try{
 for(const j of all){const {error}=await db.from('question_factory_jobs').upsert({id:j.id,subject:j.subject,chapter:j.candidate?.chapter||j.chapter,kind:j.kind,anchor_id:null,generation_brief:j,state:['eligible','published'].includes(j.state)?'eligible':'quarantined',stage:'complete',candidate:j.candidate,result:j.result,passage_group_id:j.passage_group_id||null});if(error)throw error;}
 const {error}=await db.from('question_factory_control').update({paused:false,phase:'1000',publication_enabled:true,snapshot:{at:new Date().toISOString(),owner_approval:'Explicit deployment and continued bounded generation approved 7 October 2026',batch:report}}).eq('id',1);if(error)throw error;
 const groups=new Set();for(const j of approved){let receipt;if(j.candidate.passage_group_id){const gid=j.candidate.passage_group_id;if(groups.has(gid))continue;const siblings=approved.filter(x=>x.candidate.passage_group_id===gid);receipt=await publishFactoryGroup(siblings.map(x=>x.candidate),db,registry);groups.add(gid);}else receipt=await publishFactoryQuestion(j.candidate,j.id,db);receipts.push({id:j.id,receipt,at:new Date().toISOString()});writeFileSync(dir+'/publication-progress.json',JSON.stringify(receipts,null,2)+'\n');}
 const {data:stored,error:storedError}=await db.from('questions').select('*').in('id',approved.map(j=>j.id));if(storedError)throw storedError;
 if(stored.length!==approved.length||stored.some(q=>!publicationEligibility(q).eligible))throw Error('production_stored_evidence_invalid');
 const proof={at:new Date().toISOString(),project_ref:'isrxrxzjocewrdureyhp',cohort:report.campaign_id||directory,approved_unique:stored.length,newly_inserted:stored.length-before,previously_published:before,publication_receipts:receipts,current_stored_evidence_valid:true,student_retrieval_verified:false,paid_model_calls:0};writeFileSync(dir+'/publication.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));completed=true;
}finally{const {error}=await db.from('question_factory_control').update({paused:true,publication_enabled:false,updated_at:new Date().toISOString()}).eq('id',1);if(error)throw Error('production_pause_failed:'+error.code);if(!completed)console.error('Publication stopped; retained progress is safe to resume by job ID.');}
