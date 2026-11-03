import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
import {authorCandidate,validateFactoryCandidate,repairFactoryCandidate,factoryPassageGroup} from '../lib/factoryCore.mjs';
import {runFactoryCalibration} from '../lib/factoryCalibration.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
import {planFactoryJobs} from '../lib/factoryQueue.mjs';
import {readBankSnapshot} from '../lib/bankSnapshot.mjs';
import {factoryCalibrationReady,inventoryFingerprint} from '../../../data/question_factory_policy.mjs';

try{loadEnvFile('.env.local');}catch{}
const action=process.argv[2]||'calibrate',root=resolve('data/question-factory-runtime');
const campaign=process.argv[3] || null;
if(campaign && !/^[a-z0-9.-]+$/.test(campaign))throw new Error('invalid_campaign');
const artifactRoot=campaign?`artifacts/question-factory/${campaign}`:'artifacts/question-factory';
const jobTable=campaign?`factory_commission_jobs_${campaign.replaceAll(/[.-]/g,'_')}`:'factory_commission_jobs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
mkdirSync(artifactRoot,{recursive:true});
const path=resolve(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
const ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path);
const native=createFactoryTransport({ledger});
const transport={generate:(provider,body,options)=>native.generate(provider,body,{...options,batch:false})};
const registry=read('data/source_registry.json');
const config={registry,ledger,transport};
store.claim();const heartbeat=setInterval(()=>store.claim(),30000);
async function parallel(items,fn,width=6){
 let cursor=0,failure=null;
 await Promise.allSettled(Array.from({length:width},async()=>{for(;;){
  if(failure)return;const index=cursor++;if(index>=items.length)return;
  try{await fn(items[index],index);}catch(error){failure ||= error;return;}
 }}));
 // Never close the ledger while another guarded provider request is in flight.
 if(failure)throw failure;
}
function spend(){const costs=factoryCostReport(ledger);return {gross_usd:costs.stages.reduce((s,r)=>s+r.settled_usd,0),held_usd:costs.stages.reduce((s,r)=>s+r.held_usd,0),available_usd:(ledger.snapshot().limit_micro-ledger.snapshot().committed_micro)/1e6,costs};}
try{
 if(action==='calibrate'){
  const fixturePath=resolve(root,campaign?'commissioning-calibration-v3.2.json':'commissioning-calibration-v3.json'),fixtures=read(fixturePath);
  await parallel([...fixtures.development,...fixtures.held_out.filter(f=>f.valid)].filter(f=>f.question.explanation==='Explanation preparation pending.'),async f=>{
   const authored=await authorCandidate({id:f.id,subject:f.question.subject,chapter:f.question.chapter,anchor_id:f.provenance.anchor_id,kind:'authentic_pyq'},
     {...config,transport:{generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'calibration'})}});
   f.question.explanation=authored.explanation;save(fixturePath,fixtures);
   console.log(JSON.stringify({prepared:f.id}));
  });
  const result=await runFactoryCalibration(fixtures,{...config,concurrency:4,evaluateDevelopment:false,onObservation:row=>console.log(JSON.stringify(row))});
  save('data/calibration_manifest.json',result);save(`${artifactRoot}/commissioning-calibration-result.json`,result);
  console.log(JSON.stringify({state:result.state,by_subject:result.by_subject,routes:result.routes&&Object.fromEntries(Object.entries(result.routes).map(([k,v])=>[k,{valid_survival:v.valid_survival,critical_false_accepts:v.critical_false_accepts,missing:v.missing_categories,released:v.released}])),pending:result.pending?.length,budget:spend()}));
 }else if(action==='audit-regression'){
  if(!campaign)throw new Error('quality_campaign_required');
  const baseline=read(`${artifactRoot}/baseline100.json`),audit=read(`${artifactRoot}/AUDIT-48.json`),observations=[];
  await parallel(audit.items.filter(q=>q.verdict!=='approve'),async finding=>{
   const original=baseline.jobs.find(j=>j.id===finding.id).candidate;
   const candidate={...original,id:`quality-regression-${original.id}`,provenance:{...original.provenance,source_pack_version:registry.examples.find(a=>a.id===original.provenance.anchor_id).source_pack_version}};
   const result=await validateFactoryCandidate(candidate,{...config,transport:{generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'calibration'})}});
   observations.push({original_id:original.id,content_hash:finding.content_hash,audit_verdict:finding.verdict,state:result.state,reasons:result.reasons||[],failure_details:result.failure_details||[]});
   save(`${artifactRoot}/quality-regression-results.json`,{at:new Date().toISOString(),complete:observations.length,expected:18,observations,budget:spend()});
   console.log(JSON.stringify({quality_complete:observations.length,state:result.state,id:original.id}));
  },4);
  const falseAccepts=observations.filter(o=>o.state==='eligible').length,calibration=read('data/calibration_manifest.json');
  calibration.quality_regression={sample_size:observations.length,false_accepts:falseAccepts,observations};
  if(falseAccepts||observations.length!==18){calibration.state='paused';calibration.reason='audited_quality_defect_false_accept';for(const route of Object.values(calibration.routes||{}))route.released=false;}
  save('data/calibration_manifest.json',calibration);save(`${artifactRoot}/quality-regression-results.json`,{at:new Date().toISOString(),complete:observations.length,expected:18,false_accepts:falseAccepts,observations,budget:spend()});
  console.log(JSON.stringify({quality_regression:falseAccepts?'failed':'passed',false_accepts:falseAccepts,budget:spend()}));
 }else if(action==='generate100'){
  const calibration=read('data/calibration_manifest.json');
  if(!factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION))throw new Error('academic_calibration_not_released');
  if(campaign && (calibration.quality_regression?.sample_size!==18 || calibration.quality_regression.false_accepts!==0))throw new Error('audit_quality_regression_required');
  ledger.db.exec(`CREATE TABLE IF NOT EXISTS ${jobTable}(id TEXT PRIMARY KEY,value TEXT NOT NULL)`);
  const jobs=()=>ledger.db.prepare(`SELECT value FROM ${jobTable} ORDER BY rowid`).all().map(r=>JSON.parse(r.value));
  const write=job=>ledger.db.prepare(`INSERT INTO ${jobTable} VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value`).run(job.id,JSON.stringify({...job,updated_at:new Date().toISOString()}));
  let rows=jobs();
  if(!rows.length){
   const db=createClient(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
   const bank=await readBankSnapshot(db);store.inventory(bank,inventoryFingerprint);
   if(campaign){
    const prior=read('artifacts/question-factory/quality-uplift/baseline100.json');
    // Source extraction fixes cannot make an already imported original new.
    for(const j of prior.jobs.filter(j=>j.kind==='authentic_pyq')){
     const anchor=registry.examples.find(a=>a.id===j.anchor_id);if(anchor)store.remember(inventoryFingerprint(anchor),j.id);
    }
   }
   const inventory=new Set(ledger.db.prepare('SELECT fingerprint FROM factory_inventory').all().map(r=>r.fingerprint));
   save(`${artifactRoot}/commissioning100-baseline.json`,{at:new Date().toISOString(),version:FACTORY_VERIFIER_VERSION,budget:spend(),bank_rows:bank.length});
   const variants=['Use a different supported application or numerical value set; test the forward reasoning.','Test a reverse implication or inverse numerical calculation using the same supported skill.','Use a contrasting case that distinguishes the correct principle from its nearest distractor.','Test a different supported component or sequence within the same principle, preserving CUET format.','Use a complete short application with a different decision to be inferred from the same evidence.'];
   const counts=new Map();
   for(const job of planFactoryJobs(registry,[],[],{phase:'pilot',pilotTarget:100,inventory})){
    const index=counts.get(job.anchor_id)||0;counts.set(job.anchor_id,index+1);const guidance=registry.examples.find(a=>a.id===job.anchor_id)?.variant_briefs || [];
    write({...job,state:'queued',attempt:0,variant_index:index,variant_brief:guidance[index%guidance.length] || variants[index%variants.length],...(job.subject==='english'&&job.kind==='pyq_adapted'?{lexical_index:jobs().filter(j=>j.subject==='english').length}:{})});
   }
   rows=jobs();
   if(campaign){
    const lexemes=read(`${artifactRoot}/lexeme-job-sources.json`);
    for(const job of rows.filter(j=>j.subject==='english'&&j.kind==='pyq_adapted')){const target=lexemes[job.lexical_index];if(!target)throw new Error('distinct_lexical_target_required');write({...job,additional_source_refs:[target.ref],variant_brief:`Test the new lexical target '${target.word}' in its supplied exact sense, using the anchor's synonym or antonym skill. ${target.brief} Do not substitute the anchor's old target. Use four distinct word/short-phrase choices and only one equivalence/opposite. Quote the target explicitly in plain text. Keep the explanation within the supported sense.`});}
    rows=jobs();save(`${artifactRoot}/preregistered100.json`,{at:new Date().toISOString(),verifier:FACTORY_VERIFIER_VERSION,denominator:100,subject_targets:25,jobs:rows});
   }
  }
  // Recover individual verdicts from older group receipts that retained only the sibling hold.
  for(const job of rows.filter(j=>j.passage_group_id&&j.state==='quarantined'&&!j.validation_result&&j.result?.reasons?.includes('passage_sibling_quarantined'))){
   let result;try{result=await validateFactoryCandidate(job.candidate,config);}catch(error){
    if(/budget|unresolved|configuration|pricing|network|provider_http/.test(error.message))throw error;
    result={state:'quarantined',reasons:[error.message]};
   }
   write({...job,candidate:result.question||job.candidate,state:result.state,result,validation_result:result});
  }
  rows=jobs();
  await parallel(rows.filter(j=>!['eligible','quarantined'].includes(j.state)),async job=>{
   try{
    let saved=jobs().find(j=>j.id===job.id),candidate=saved.candidate;
    if(!candidate){candidate=await authorCandidate(job,config);write({...saved,candidate,state:'validating'});saved=jobs().find(j=>j.id===job.id);}
    if(saved.state==='repairing'){
     candidate=await repairFactoryCandidate(candidate,[...(saved.result?.reasons||[]),...(saved.result?.failure_details||[])],config);
     write({...saved,candidate,state:'validating',attempt:1});saved=jobs().find(j=>j.id===job.id);
    }
    let result;
    if(store.duplicate(inventoryFingerprint(candidate),job.id))result={state:'quarantined',reasons:['duplicate_existing_inventory']};
    else{store.remember(inventoryFingerprint(candidate),job.id);result=await validateFactoryCandidate(candidate,config);}
    if(result.state==='quarantined'&&saved.attempt===0&&job.kind!=='authentic_pyq'&&result.reasons.some(r=>/failed:|key_contradiction/.test(r))){
     write({...saved,candidate,state:'repairing',attempt:1,result});
     candidate=await repairFactoryCandidate(candidate,[...result.reasons,...(result.failure_details||[])],config);write({...saved,candidate,state:'validating',attempt:1});
     result=store.duplicate(inventoryFingerprint(candidate),job.id)?{state:'quarantined',reasons:['duplicate_existing_inventory']}:await validateFactoryCandidate(candidate,config);
     store.remember(inventoryFingerprint(candidate),job.id);
    }
    write({...jobs().find(j=>j.id===job.id),candidate:result.question||candidate,state:result.state,result});
   }catch(error){
    if(/budget|unresolved|configuration|pricing|network|provider_http/.test(error.message))throw error;
    write({...jobs().find(j=>j.id===job.id),state:'quarantined',result:{reasons:[error.message]}});
   }
   const all=jobs();console.log(JSON.stringify({complete:all.filter(j=>['eligible','quarantined'].includes(j.state)).length,total:all.length,eligible:all.filter(j=>j.state==='eligible').length}));
   save(`${artifactRoot}/commissioning100-progress.json`,{at:new Date().toISOString(),budget:spend(),jobs:all});
  });
  rows=jobs();
  // A defective explanation on an authenticated original can be repaired without changing its official question/key.
  for(const job of rows.filter(j=>j.state==='quarantined'&&j.kind==='authentic_pyq'&&j.attempt===0&&j.result?.reasons?.includes('failed:explanation_support'))){
   write({...job,state:'repairing',attempt:1});
   try{
    const candidate=await repairFactoryCandidate(job.candidate,[...job.result.reasons,...(job.result.failure_details||[])],config);
    const result=await validateFactoryCandidate(candidate,config);
    write({...job,attempt:1,candidate:result.question||candidate,state:result.state,result,...(job.passage_group_id?{validation_result:result}:{})});
   }catch(error){
    if(/budget|unresolved|configuration|pricing|network|provider_http/.test(error.message))throw error;
    write({...job,attempt:1,state:'quarantined',result:{...job.result,reasons:[...(job.result.reasons||[]),error.message]}});
   }
  }
  rows=jobs();
  // Recheck signed requirements against the current local policy. Provider responses reuse their versioned cache.
  for(const job of rows.filter(j=>j.state==='eligible')){
   const result=await validateFactoryCandidate(job.candidate,config);
   write({...job,candidate:result.question||job.candidate,state:result.state,result,...(job.passage_group_id?{validation_result:result}:{})});
  }
  rows=jobs();
  for(const id of new Set(rows.map(j=>j.passage_group_id).filter(Boolean))){const group=rows.filter(j=>j.passage_group_id===id);let reason;
   if(group.some(j=>j.state!=='eligible'))reason='passage_sibling_quarantined';
   else try{factoryPassageGroup(group.map(j=>j.candidate),registry);}catch(error){reason=error.message;}
   if(reason)for(const j of group)write({...j,validation_result:j.validation_result||j.result,state:'quarantined',result:{...j.result,reasons:[...new Set([...(j.result?.reasons||[]),reason])]}});
  }
  rows=jobs();const report={at:new Date().toISOString(),target:100,generated:rows.filter(j=>j.candidate).length,eligible:rows.filter(j=>j.state==='eligible').length,quarantined:rows.filter(j=>j.state==='quarantined').length,budget:spend(),jobs:rows,production_changes:0};
  save(`${artifactRoot}/commissioning100-results.json`,report);console.log(JSON.stringify({...report,jobs:undefined}));
  save(`${artifactRoot}/commissioning100-progress.json`,{at:report.at,budget:report.budget,jobs:rows});
 }else throw new Error('Use calibrate or generate100');
}finally{clearInterval(heartbeat);store.release();ledger.close();}
