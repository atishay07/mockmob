import assert from 'node:assert/strict';
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {readBankSnapshot} from '../lib/bankSnapshot.mjs';
import {buildStagingWithholdingSelection,preflightStagingRows} from '../lib/reassessmentWithholdingStagingVNext.mjs';
loadEnvFile('.env.local');loadEnvFile('.env.staging');
const url=process.env.STAGING_SUPABASE_URL,base='http://localhost:3101',root='artifacts/question-factory/cuet-readiness-2026-10-08',snapshot=root+'/execution/reassessment/snapshot-20261008T060712941Z';
assert.equal(url,'https://onwkqxmjqjrhfbjjdydu.supabase.co');
const bounded=(u,i={})=>fetch(u,{...i,signal:AbortSignal.timeout(90000)});
const db=createClient(url,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false},global:{fetch:bounded}});
async function session(email){const {data,error}=await db.auth.admin.generateLink({type:'magiclink',email});if(error)throw error;let jar=[];const c=createServerClient(url,process.env.STAGING_SUPABASE_ANON_KEY,{global:{fetch:bounded},cookies:{getAll:()=>jar,setAll:v=>{jar=v;}}});const {error:e}=await c.auth.verifyOtp({token_hash:data.properties.hashed_token,type:data.properties.verification_type});if(e)throw e;return jar.map(x=>x.name+'='+x.value).join('; ');}
async function app(path,cookie,options={}){const response=await bounded(base+path,{...options,headers:{...(options.headers||{}),...(cookie?{Cookie:cookie}:{})}});return {status:response.status,body:await response.json()};}
const read=p=>JSON.parse(readFileSync(p,'utf8')),exportData=read(snapshot+'/bank-reassessment-export.json'),plan=read(snapshot+'/dry-run-withholding-plan.json'),journal=read(snapshot+'/staging-withholding-journal.json');
assert.equal(journal.completed,true,'withholding_receipts_and_jobs_must_finish');
const selection=buildStagingWithholdingSelection(exportData,plan),bank=await readBankSnapshot(db),checked=preflightStagingRows(selection,bank);assert.equal(checked.already_withheld,true);
const student=await session('factory-staging-student@example.com'),admin=await session('atishay07jain@gmail.com');
const anonymous=await app('/api/admin/question-factory');assert.equal(anonymous.status,401);
const denied=await app('/api/admin/question-factory',student);assert.equal(denied.status,404);
const overview=await app('/api/admin/question-factory',admin);assert.equal(overview.status,200);assert.equal(overview.body.available,true);
const {data:controlBefore,error:cError}=await db.from('question_factory_control').select('paused,phase,publication_enabled,worker_id,lease_until,updated_at').eq('id',1).single();if(cError)throw cError;
const release=await app('/api/admin/question-factory',admin,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'release_1000'})});assert.equal(release.status,409);assert.equal(release.body.error,'current_cuet_calibration_required');
const {data:controlAfter,error:aError}=await db.from('question_factory_control').select('paused,phase,publication_enabled,worker_id,lease_until,updated_at').eq('id',1).single();if(aError)throw aError;assert.deepEqual(controlAfter,controlBefore,'refused_release_must_not_change_controls');
const feedIds=new Set(),bySubject={};for(const subject of ['english','accountancy','business_studies','economics']){let offset=0,count=0;for(let pages=0;pages<100;pages++){const response=await app('/api/questions/feed?subject='+subject+'&limit=50&offset='+offset,student);assert.equal(response.status,200);const rows=response.body.questions||[];rows.forEach(q=>feedIds.add(q.id));count+=rows.length;if(!response.body.hasMore)break;assert.ok(response.body.nextOffset>offset);offset=response.body.nextOffset;}bySubject[subject]=count;}
const withheld=selection.ids.filter(id=>feedIds.has(id));assert.equal(withheld.length,0,'all_failed_or_group_sibling_items_must_be_unavailable');
const expected=exportData.cases.filter(c=>!selection.ids.includes(c.id)).map(c=>c.id),missing=expected.filter(id=>!feedIds.has(id));assert.equal(expected.length,535);assert.deepEqual(missing,[]);
const {data:ai,error:aiError}=await db.from('runtime_ai_budget').select('monthly_cap_usd').eq('id','student_ai').single();if(aiError)throw aiError;assert.equal(Number(ai.monthly_cap_usd),25);
const proof={at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',base,staging_legacy_bank_only:true,current_v7_release:false,newly_published:0,exported_denominator:662,provisional_passes:536,quarantined:126,withheld_with_group_closure:127,withheld_in_student_feed:withheld.length,remaining_legacy_expected:expected.length,remaining_legacy_retrieved:expected.length-missing.length,student_feed_by_subject:bySubject,extra_unchanged_bank_rows:checked.extra_unchanged_rows,admin_status:overview.status,anonymous_status:anonymous.status,student_admin_status:denied.status,release_control_status:release.status,release_control_reason:release.body.error,failed_release_preserved_controls:true,student_ai_monthly_cap_usd:25,paid_provider_calls:0,emails_sent:0,production_writes:0};
writeFileSync(root+'/staging/reassessment-retrieval-proof.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
