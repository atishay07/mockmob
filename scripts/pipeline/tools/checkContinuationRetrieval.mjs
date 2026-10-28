import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';import {createServerClient} from '@supabase/ssr';import {readAllRows} from '../lib/bankSnapshot.mjs';
import {contentHash} from '../../../data/content_evidence.js';import {hashJSON} from '../../../data/question_factory_policy.mjs';import {validationContract} from '../lib/compactBenchmark.mjs';
loadEnvFile('.env.local');const staging=process.argv.includes('--staging'),production=process.argv.includes('--approved-production');
if(staging===production)throw Error('one_explicit_environment_required');if(staging)loadEnvFile('.env.staging');
const baseIndex=process.argv.indexOf('--base'),base=baseIndex>=0?process.argv[baseIndex+1]:staging?'http://localhost:3101':null;
if(!base||!(new URL(base).protocol===('http:')&&new URL(base).hostname==='localhost'||new URL(base).protocol==='https:'))throw Error('explicit_application_base_required');
const url=staging?process.env.STAGING_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,key=staging?process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY,anon=staging?process.env.STAGING_SUPABASE_ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(url!=='https://'+(staging?'onwkqxmjqjrhfbjjdydu':'isrxrxzjocewrdureyhp')+'.supabase.co')throw Error('environment_identity_mismatch');
const boundedFetch=(url,init={},timeoutMs=30000)=>fetch(url,{...init,signal:AbortSignal.timeout(timeoutMs)});
const db=createClient(url,key,{auth:{persistSession:false},global:{fetch:boundedFetch}}),root='artifacts/question-factory/continuation-500/',all=JSON.parse(readFileSync(root+'all-candidates.json'));
console.log(JSON.stringify({check_environment:staging?'staging':'production',stage:'read_actual_publications'}));
const publications=await readAllRows(db,'question_factory_publications','question_id','question_id'),published=new Set(publications.map(p=>p.question_id));
const expected=new Map(all.filter(j=>published.has(j.id)&&j.state==='published').map(j=>[j.id,j.candidate])),rejected=new Set(all.filter(j=>j.state==='quarantined').map(j=>j.id));
if(!expected.size)throw Error('no_real_published_candidates');
async function login(email){const {data,error}=await db.auth.admin.generateLink({type:'magiclink',email});if(error)throw error;let jar=[];const c=createServerClient(url,anon,{global:{fetch:boundedFetch},cookies:{getAll:()=>jar,setAll:v=>{jar=v;}}});const {error:e}=await c.auth.verifyOtp({token_hash:data.properties.hashed_token,type:data.properties.verification_type});if(e)throw e;return jar.map(c=>c.name+'='+c.value).join('; ');}
// generateLink does not send email or grant a new role. Reuse existing identities.
const owner=staging?null:await db.auth.admin.getUserById(process.env.CUET_CONTENT_AUTHOR_ID);
if(production&&(owner.error||!owner.data.user?.email))throw Error('existing_production_owner_required');
const admin=await login(staging?'atishay07jain@gmail.com':owner.data.user.email),student=staging?await login('factory-staging-student@example.com'):null;
console.log(JSON.stringify({stage:'existing_sessions_established',emails_sent:0}));
// The production admin inventory traverses the complete retained bank. The
// observed deployed HTTP 200 took 30.5 seconds; student requests keep 30 seconds.
async function request(path,{cookie=student,action,status=200,origin=base}={}){const r=await boundedFetch(base+path,{headers:{...(cookie?{Cookie:cookie}:{}),...(action?{Origin:origin,'Content-Type':'application/json'}:{})},...(action?{method:'POST',body:JSON.stringify({action})}:{})},path.startsWith('/api/admin/question-factory')?90000:30000);const data=await r.json();assert.equal(r.status,status,path+':'+JSON.stringify(data));return data;}
const checks=[];await request('/api/admin/question-factory',{cookie:null,status:401});const overview=await request('/api/admin/question-factory',{cookie:admin});assert.equal(overview.available,true);assert.equal(overview.counts.total,publications.length);if(staging)assert.equal(overview.counts.usable_factory,expected.size);checks.push({name:'authenticated admin publication history and current usable count',count:overview.counts.total,usable_factory:overview.counts.usable_factory});
if(staging){await request('/api/admin/question-factory',{status:404});await request('/api/admin/question-factory',{cookie:admin,action:'pause',origin:'https://example.com',status:403});
 await request('/api/admin/question-factory',{cookie:admin,action:'release_1000'});await request('/api/admin/question-factory',{cookie:admin,action:'release_1000'});checks.push({name:'funded 1000 checkpoint release and replay, completed original pilot retained',passed:true});
 await request('/api/admin/question-factory',{cookie:admin,action:'release_10000',status:409});checks.push({name:'unfunded ten-thousand checkpoint rejected',passed:true});}
console.log(JSON.stringify({stage:'authenticated_admin_verified',published:publications.length}));
const received=new Set(),groups=new Map();let pages=0;
for(const subject of ['english','accountancy','business_studies','economics']){
 let offset=0,count=0;
 for(;;){const data=await request('/api/questions/feed?subject='+subject+'&limit=50&offset='+offset);pages++;count+=(data.questions||[]).length;
  for(const q of data.questions||[]){assert.ok(!rejected.has(q.id),'Rejected question available: '+q.id);if(!expected.has(q.id))continue;const e=expected.get(q.id);received.add(q.id);
   assert.equal(q.correct_answer,e.correct_answer);assert.equal(q.explanation,e.explanation);assert.deepEqual(q.options.map(o=>o.key),['A','B','C','D']);assert.deepEqual(q.options.map(o=>o.text),e.options);
   if(e.passage_text){assert.equal(q.passage_text,e.passage_text);assert.ok(q.passage_text.split(/\s+/).length<=300);}
   if(e.passage_group_id){assert.equal(q.passage_group_id,e.passage_group_id);groups.set(q.passage_group_id,(groups.get(q.passage_group_id)||0)+1);}
  }
  if(!data.hasMore)break;assert.ok(data.nextOffset>offset,'Pagination must progress even if all raw rows were withheld');offset=data.nextOffset;
  if(pages%120===0){console.log(JSON.stringify({retrieval_pages:pages,verified_so_far:received.size,rate_limit_backoff_seconds:60}));await new Promise(r=>setTimeout(r,60000));}
 }
 checks.push({name:'actual paginated '+(staging?'signed-in student':'public student')+' feed '+subject,available:count,expected:[...expected.values()].filter(q=>q.subject===subject).length});
}
const missing=[...expected.keys()].filter(id=>!received.has(id));
for(const [id,n] of groups)assert.equal(n,[...expected.values()].filter(q=>q.passage_group_id===id).length,'Complete validated passage group: '+id);
for(let i=0,ids=[...rejected];i<ids.length;i+=100){const {data,error}=await db.from('questions').select('id,status,verification_state,is_deleted').in('id',ids.slice(i,i+100));if(error)throw error;assert.ok(data.every(q=>q.is_deleted||q.verification_state==='disputed'||['pending','quarantined','invalid','rejected'].includes(q.status)),'Rejected rows must remain unavailable; historical withheld publications are retained');}
const {data:cap,error}=await db.from('runtime_ai_budget').select('monthly_cap_usd').eq('id','student_ai').single();if(error)throw error;assert.equal(Number(cap.monthly_cap_usd),25);
const minimumIndex=process.argv.indexOf('--minimum'),minimum=minimumIndex>=0?Number(process.argv[minimumIndex+1]):50;
const expectedContentHash=hashJSON([...expected].sort(([a],[b])=>a.localeCompare(b)).map(([id,q])=>({id,content:contentHash(q),group:q.passage_group_id||null,evidence:q.evidence?.signature||null})));
const proof={at:new Date().toISOString(),environment:staging?'staging':'production',base,checks,expected_published:expected.size,expected_content_hash:expectedContentHash,validation_contract:validationContract(),unique_retrieved:received.size,missing_ids:missing,passed:missing.length===0&&received.size>=minimum,minimum_required:minimum,complete_passage_groups:groups.size,rejected_received:0,student_ai_monthly_cap:25,paid_provider_calls:0,emails_sent:0,production_writes:0};
writeFileSync(root+(staging?'staging':'production')+'-retrieval.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));assert.equal(proof.passed,true,'Current deployment must retrieve every published candidate and meet the required count');
