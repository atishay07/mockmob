import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {authorOriginal,validateFactoryCandidate,repairFactoryCandidate,publishFactoryQuestion,publishFactoryGroup} from '../lib/factoryCore.mjs';
import {createFactoryEvidence,FACTORY_VERIFIER_VERSION,sourceMaterial} from '../lib/factoryEvidence.mjs';
import {blindView,structureVerdict} from '../lib/evidencePipeline.mjs';
import {presentationLint} from '../../../data/question_presentation.mjs';
import {compactResults,validationContract} from '../lib/compactBenchmark.mjs';
import {FACTORY_POLICY,CALIBRATION_RELEASE,factoryCalibrationReady,inventoryFingerprint,hashJSON,provenanceReasons} from '../../../data/question_factory_policy.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {coverageSnapshot} from '../lib/focusedCoverage.mjs';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {inspectBatch,inspectAgainstInventory} from '../lib/batchInspection.mjs';
import {stopsFactory} from '../lib/factoryFailure.mjs';
import {originalQuoteIntegrity} from '../lib/generationIntegrity.mjs';
try{loadEnvFile('.env.local');}catch{}
const action=process.argv[2]||'report',dirIndex=process.argv.indexOf('--campaign-dir'),directory=dirIndex>=0?process.argv[dirIndex+1]:'artifacts/question-factory/execution-2026-10-07';
if(!directory||!resolve(directory).startsWith(resolve('artifacts/question-factory')+'/')&&!resolve(directory).startsWith(resolve('artifacts/question-factory')+'\\'))throw Error('local_factory_artifact_directory_required');
mkdirSync(directory,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const registry=read('data/source_registry.json'),campaign=read(`${directory}/campaign.json`),benchmark=read(`${directory}/benchmark.json`);
const ledgerPath=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite',ledger=new BudgetLedger(ledgerPath),store=new FactoryStore(ledger,ledgerPath);
const transport=createFactoryTransport({ledger,queueOpenAI:true,queueGemini:true,realtimeStages:action==='benchmark'?['blind_solution','independent_evaluation','explanation_support']:process.argv.includes('--realtime-luna')?['authoring','blind_solution','explanation_support','repair']:[]}),config={registry,ledger,transport};
const calibrationTransport={generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'calibration'})};
const waiting=e=>e instanceof BatchPending;
const fatal=e=>stopsFactory(e,ledger);
const log=v=>console.log(JSON.stringify(v));
const jobStage=state=>['eligible','quarantined','published'].includes(state)?'complete':state==='waiting_repair'?'repair':state==='repaired'?'revalidation':['generated','waiting_validation'].includes(state)?'validation':'authoring';
function contract(){if(benchmark.registration.contract_hash!==validationContract()||benchmark.registration.registry_version!==registry.version)throw Error('frozen_validation_contract_changed');}
function costRows(){const before=new Set(campaign.request_ids_before);return ledger.db.prepare('SELECT * FROM requests').all().filter(r=>!before.has(r.id)).map(r=>({...r,receipt:r.receipt_json?JSON.parse(r.receipt_json):null}));}
function costs(rows){return {settled_usd:rows.filter(r=>r.state==='settled').reduce((n,r)=>n+r.actual,0)/1e6,held_usd:rows.filter(r=>r.state!=='settled').reduce((n,r)=>n+Math.max(r.reserved,r.actual||0),0)/1e6,
 gross_usd:rows.reduce((n,r)=>n+Math.max(r.actual||0,r.state==='settled'?0:r.reserved),0)/1e6,requests:rows.length,unresolved:rows.filter(r=>r.state==='unresolved').length};}
async function parallel(rows,fn){let index=0,failure;await Promise.allSettled(Array.from({length:4},async()=>{while(!failure){const row=rows[index++];if(!row)return;try{await fn(row);store.claim();}catch(e){failure=e;}}}));if(failure)throw failure;}
async function prefetch(candidate,tr){const adapters=createFactoryEvidence({...config,transport:tr});let pending=false;
 // Free checks still run in the validator, which supplies the targeted repair
 // reasons. Do not purchase two predictions for an already malformed item.
 if(!structureVerdict(candidate).passed||presentationLint(candidate).length||provenanceReasons(candidate,registry).length)return true;
 for(const stage of ['source_support','presentation_quality','blind_solution','independent_evaluation'])try{
  const verdict=await adapters[stage](blindView(candidate,candidate.source_refs));
  // Source support and the blind key reuse one Luna evaluation. A known
  // mandatory failure needs repair/quarantine before buying another challenge.
  if(verdict.passed!==true||stage==='blind_solution'&&verdict.solved_key!==candidate.correct_answer)return true;
 }catch(e){if(waiting(e))pending=true;else if(fatal(e))throw e;else return true;}
 return !pending;
}
function manifest(){return read('data/calibration_manifest.json');}
function releaseRequired(){contract();if(!factoryCalibrationReady(manifest(),registry,FACTORY_VERIFIER_VERSION))throw Error('fresh_benchmark_and_regression_release_required');}
async function reconcile(){const rows=ledger.db.prepare("SELECT id,provider_id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all();
 let settled=0;for(const row of rows){try{if(await transport.reconcile(row.id))settled++;}catch(e){log({receipt_pending:row.id,reason:e.message});if(fatal(e))throw e;}}
 log({receipt_checks:rows.length,settled,budget:ledger.snapshot()});
}
function regressionFixtures(){const baseline=read('artifacts/question-factory/quality-uplift/baseline100.json'),audit=read('artifacts/question-factory/quality-uplift/AUDIT-48.json');
 return audit.items.filter(q=>q.verdict!=='approve').map(f=>{const original=baseline.jobs.find(j=>j.id===f.id).candidate,anchor=registry.examples.find(a=>a.id===original.provenance.anchor_id);
 return {id:'v6-regression-'+original.id,expected_valid:false,category:'known_audit_defect',candidate:{...original,id:'v6-regression-'+original.id,provenance:{...original.provenance,source_pack_version:anchor.source_pack_version}},audit:f};});
}
async function runBenchmark(){contract();const fixtures=benchmark.fixtures.map(f=>({...f,...(store.get(f.id)||{})})),regressions=regressionFixtures().map(f=>({...f,...(store.get(f.id)||{})}));
 await parallel([...fixtures,...regressions],async f=>{
  if(['eligible','quarantined'].includes(f.state))return;
  try{
   if(f.expected_valid&&!await prefetch(f.candidate,calibrationTransport)){f.state='waiting';store.set(f.id,f);return;}
   f.result=await validateFactoryCandidate(f.candidate,{...config,transport:calibrationTransport});f.state=f.result.state;
  }catch(e){if(waiting(e)){f.state='waiting';f.pending=e.batchId;}else if(fatal(e))throw e;else{f.state='quarantined';f.result={state:f.state,reasons:[e.message]};}}
  store.set(f.id,f);
 });
 await transport.flush();const result=compactResults(fixtures,benchmark.registration),done=regressions.filter(f=>['eligible','quarantined'].includes(f.state));
 const regression={verifier_version:FACTORY_VERIFIER_VERSION,source_registry_version:registry.version,sample_size:done.length,false_accepts:done.filter(f=>f.state==='eligible').length,pending:regressions.length-done.length,observations:regressions};
 const released=result.released&&done.length>=18&&regression.false_accepts===0;
 const output={...result,version:FACTORY_POLICY,verifier_version:FACTORY_VERIFIER_VERSION,source_registry_version:registry.version,state:released?'released':'paused',
  validation_contract:benchmark.registration.contract_hash,benchmark:{...benchmark.registration,state:result.complete?'completed':'pending'},release_policy:CALIBRATION_RELEASE,quality_regression:regression,at:new Date().toISOString(),
  observations:fixtures,cost:costs(costRows().filter(r=>r.receipt?.purpose==='calibration'||ledger.db.prepare('SELECT request_json FROM provider_batches WHERE reservation_id=?').get(r.id)?.request_json.includes('"purpose":"calibration"')))};
 save(`${directory}/benchmark-results.json`,output);save('data/calibration_manifest.json',output);log({benchmark:output.state,complete:result.complete,valid_survival:result.valid_survival,false_accepts:result.critical_false_accepts,regression_completed:done.length,regression_false_accepts:regression.false_accepts,cost:output.cost});
}
async function generate(){releaseRequired();await parallel(campaign.jobs,async original=>{
 const job=store.get(original.id)||original;if(job.candidate||job.state==='quarantined')return;
 try{job.candidate=await authorOriginal(job,config);job.state='generated';}
 catch(e){if(waiting(e)){job.state='waiting_authoring';job.pending=e.batchId;}else if(fatal(e))throw e;else{job.candidate=e.candidate||null;job.state=job.candidate?'generated':'quarantined';job.author_failure=e.message;job.result={state:'quarantined',reasons:[e.message]};}}
 store.set(job.id,job);
 });await transport.flush();report();}
async function validate(){releaseRequired();await parallel(campaign.jobs,async original=>{
 const job=store.get(original.id)||original;if(!job.candidate||['eligible','quarantined','published'].includes(job.state))return;
 const quoteIntegrity=originalQuoteIntegrity(job.candidate,registry);
 if(!quoteIntegrity.passed){job.state='quarantined';job.result={state:'quarantined',reasons:[quoteIntegrity.reason],author_quote_integrity:quoteIntegrity};store.set(job.id,job);return;}
 try{
  if(job.state==='waiting_repair'){
   job.candidate=await repairFactoryCandidate(job.candidate,job.first_result.reasons.concat(job.first_result.failure_details||[]),config);job.repair_count=1;job.state='repaired';store.set(job.id,job);
  }
  if(!await prefetch(job.candidate,transport)){job.state='waiting_validation';store.set(job.id,job);return;}
  const result=await validateFactoryCandidate(job.candidate,config);job.result=result;
  if(result.state==='quarantined'&&!job.repair_count){job.first_result=result;job.state='waiting_repair';job.repair_count=1;store.set(job.id,job);
   job.candidate=await repairFactoryCandidate(job.candidate,result.reasons.concat(result.failure_details||[]),config);job.state='repaired';store.set(job.id,job);return;
  }
  job.state=result.state;if(result.question)job.candidate=result.question;
 }catch(e){if(waiting(e)){job.pending=e.batchId;if(job.state!=='waiting_repair')job.state='waiting_validation';}else if(fatal(e))throw e;else{job.state='quarantined';job.result={state:'quarantined',reasons:[e.message]};}}
 store.set(job.id,job);
 });await transport.flush();report();}
function report(){const rows=campaign.jobs.map(j=>store.get(j.id)||j),receipts=costRows(),ids=new Set(campaign.jobs.map(j=>j.id)),metadata=new Map(ledger.db.prepare("SELECT reservation_id,json_extract(request_json,'$.config.candidate_id') AS candidate_id,json_extract(request_json,'$.config.purpose') AS purpose FROM provider_batches UNION ALL SELECT reservation_id,json_extract(request_json,'$.config.candidate_id'),json_extract(request_json,'$.config.purpose') FROM provider_requests").all().map(r=>[r.reservation_id,r])),batchReceipts=receipts.filter(r=>{
 const config=metadata.get(r.id)||{};
 return (r.receipt?.purpose||config.purpose)==='candidate'&&ids.has(r.receipt?.candidate_id||config.candidate_id);
 });
 const seen=new Map();for(const job of rows){if(!['eligible','published'].includes(job.state))continue;const fingerprint=inventoryFingerprint(job.candidate);if(seen.has(fingerprint)){job.state='quarantined';job.result={...job.result,state:'quarantined',reasons:['duplicate_of:'+seen.get(fingerprint)]};store.set(job.id,job);}else seen.set(fingerprint,job.id);}
 // A failed sibling withholds the whole passage group; no partial passage enters retrieval.
 for(const group of Object.values(registry.passage_groups||{}).filter(g=>g.kind==='original_practice')){const siblings=rows.filter(j=>group.candidate_ids.includes(j.id));
  if(siblings.some(j=>j.state==='quarantined'))for(const job of siblings.filter(j=>j.state==='eligible')){job.state='quarantined';job.result={...job.result,state:'quarantined',reasons:['passage_group_sibling_rejected']};store.set(job.id,job);}}
 const approved=rows.filter(j=>['eligible','published'].includes(j.state)),finished=rows.every(j=>['eligible','quarantined','published'].includes(j.state));
 const count=key=>Object.fromEntries([...new Set(approved.map(j=>j.candidate[key]))].map(k=>[k,approved.filter(j=>j.candidate[key]===k).length]));
 const contentCost=costs(batchReceipts),gross=costs(receipts),price=approved.length?contentCost.gross_usd/approved.length:null;
 const ideaPairs=[];for(let i=0;i<approved.length;i++)for(let k=i+1;k<approved.length;k++){
  const a=approved[i],b=approved[k];if(a.subject!==b.subject||a.chapter!==b.chapter)continue;
  const words=q=>new Set((q.body||'').toLowerCase().replace(/\d+(?:[.,]\d+)*/g,'#').match(/[a-z#]+/g)||[]),x=words(a.candidate),y=words(b.candidate),overlap=[...x].filter(w=>y.has(w)).length/Math.max(x.size,y.size);
  if(overlap>.68||a.candidate.concept_id===b.candidate.concept_id)ideaPairs.push({a:a.id,b:b.id,similarity:overlap,concept:a.candidate.concept_id});
 }
 const report={id:campaign.id,denominator:100,complete:finished,approved_unique:approved.length,rejected:rows.filter(j=>j.state==='quarantined').length,pending:rows.filter(j=>!['eligible','quarantined','published'].includes(j.state)).length,
  newly_published:rows.filter(j=>j.state==='published').length,cost:contentCost,gross_campaign_with_benchmark:gross,cost_per_approved_usd:price,
  conditional_10000_forecast_usd:price?price*10000:null,forecast_basis:'Gross batch cost includes rejected candidates, repair, all validator and reasoning usage; benchmark preparation is separately additive. Conditional on unchanged mix and yield, not a promise.',
  conditional_lifetime_to_10000_usd:price?ledger.snapshot().committed_micro/1e6+Math.max(0,10000-approved.length)*price:null,
  budget_scenarios:[50,60,70].map(cap=>({cap_usd:cap,authorized:cap===50,additional_approved_affordable:price?Math.max(0,Math.floor((cap-ledger.snapshot().committed_micro/1e6)/price)):null})),
  lifetime:ledger.snapshot(),costs_by_stage:factoryCostReport(ledger),baseline_2026_provisional_for_2027:true,accountancy_branch:campaign.branch,answer_positions:count('correct_answer'),formats:count('question_type'),difficulty:count('difficulty'),duplicate_ideas_for_inspection:ideaPairs,
  invoice_status:'Provider response usage receipts; no provider invoice obtained. Held usage is not settled.',at:new Date().toISOString()};
 for(const job of rows){job.item_cost=costs(receipts.filter(r=>(r.receipt?.candidate_id||metadata.get(r.id)?.candidate_id)===job.id));job.supporting_excerpts=sourceMaterial(registry,job.candidate?.source_refs||job.source_refs||[]);}
 save(`${directory}/all-100.json`,rows);save(`${directory}/approved.json`,approved.map(j=>j.candidate));save(`${directory}/approved-records.json`,approved);save(`${directory}/rejected.json`,rows.filter(j=>j.state==='quarantined'));save(`${directory}/receipts.json`,receipts);save(`${directory}/batch-report.json`,report);
 const columns=['id','subject','chapter','topic','format','difficulty','state','key','body','options','explanation','sources','supporting_excerpts','validation_results','rejection_reasons','settled_usd','held_usd','gross_usd'];
 const csvCell=value=>'"'+String(typeof value==='object'?JSON.stringify(value):value??'').replaceAll('"','""')+'"';
 const csvRows=rows.map(j=>{const q=j.candidate||{};return [j.id,j.subject,q.chapter||j.chapter,q.topic||j.topic,q.question_type||j.format,q.difficulty||j.difficulty,j.state,q.correct_answer,q.body,q.options,q.explanation,q.source_refs,j.supporting_excerpts,q.evidence?.record||j.result,j.result?.reasons||[],j.item_cost.settled_usd,j.item_cost.held_usd,j.item_cost.gross_usd];});
 writeFileSync(`${directory}/all-100.csv`,[columns,...csvRows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n');
 log({complete:finished,approved:approved.length,rejected:report.rejected,pending:report.pending,cost:contentCost,budget:ledger.snapshot()});return report;
}
async function publish(){releaseRequired();if(!process.argv.includes('--staging'))throw Error('explicit_staging_target_required');
 if(!existsSync('.env.staging'))throw Error('staging_credentials_required');loadEnvFile('.env.staging');
 const url=process.env.STAGING_SUPABASE_URL,key=process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;if(url!=='https://onwkqxmjqjrhfbjjdydu.supabase.co'||!key)throw Error('separate_staging_identity_required');
 const db=createClient(url,key,{auth:{persistSession:false}}),r=report();if(!r.complete||r.cost.held_usd)throw Error('complete_settled_batch_required');
 const identities=read('.cache/factory-staging-auth.json');process.env.CUET_CONTENT_AUTHOR_ID=identities.admin.id;
 if(!existsSync(`${directory}/batch-inspection.json`))throw Error('batch_inspection_required');
 const inspection=read(`${directory}/batch-inspection.json`);if(inspection.content_hash!==hashJSON(read(`${directory}/all-100.json`).map(j=>({id:j.id,candidate:j.candidate,result:j.result})))||inspection.ready!==true)throw Error('current_batch_inspection_required');
 const jobs=campaign.jobs.map(j=>store.get(j.id)||j);for(const j of jobs){const {error}=await db.from('question_factory_jobs').upsert({id:j.id,subject:j.subject,chapter:j.candidate?.chapter||j.chapter,anchor_id:null,kind:j.kind,generation_brief:j,state:j.state,stage:jobStage(j.state),candidate:j.candidate,result:j.result,passage_group_id:j.passage_group_id||null});if(error)throw Error('staging_job_import:'+error.code);}
 const {error}=await db.from('question_factory_control').update({paused:false,phase:'1000',publication_enabled:true,worker_id:store.identity,lease_until:new Date(Date.now()+300000).toISOString(),snapshot:{budget:ledger.snapshot(),at:new Date().toISOString(),historical_reconciled:true,batch:r,costs:factoryCostReport(ledger),forecast_usd:r.conditional_10000_forecast_usd,cost_per_published_usd:r.cost_per_approved_usd,pilot:{target:100,total:100,generated:jobs.filter(j=>j.candidate).length,eligible:r.approved_unique,quarantined:r.rejected,complete:r.complete,cost_per_eligible_usd:r.cost_per_approved_usd}}}).eq('id',1);if(error)throw Error('staging_control:'+error.code);
 const groups=new Set();for(const j of jobs.filter(j=>['eligible','published'].includes(j.state))){if(j.passage_group_id){if(groups.has(j.passage_group_id))continue;const siblings=jobs.filter(x=>x.passage_group_id===j.passage_group_id);await publishFactoryGroup(siblings.map(x=>x.candidate),db,registry);siblings.forEach(x=>{x.state='published';store.set(x.id,x);});groups.add(j.passage_group_id);}else{await publishFactoryQuestion(j.candidate,j.id,db);j.state='published';store.set(j.id,j);}}
 const inventory=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id');save(`${directory}/staging-retrieval.json`,inventory);save(`${directory}/coverage-after.json`,detailedCoverage(inventory,registry,{heldFamilies:holds.map(h=>h.family_id)}));save(`${directory}/publication.json`,{at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',newly_published:inventory.filter(q=>campaign.jobs.some(j=>j.id===q.id)).length,production_writes:0});report();
}
async function inspectCampaign(){
 const r=report();if(!r.complete||r.cost.held_usd)throw Error('complete_settled_batch_required');
 const db=await stagingWorkerDatabase(),inventory=await readBankSnapshot(db);
 let rows=campaign.jobs.map(j=>store.get(j.id)||j),inspection=inspectAgainstInventory(rows,inventory);
 for(const decision of inspection.decisions){const j=rows.find(j=>j.id===decision.id);if(j.state==='published')throw Error('published_content_dispute_required');
  j.state='quarantined';j.result={...j.result,state:'quarantined',reasons:[decision.reason],inspection:decision};store.set(j.id,j);
 }
 if(inspection.decisions.length){report();rows=campaign.jobs.map(j=>store.get(j.id)||j);const applied=inspection.decisions;inspection={...inspectAgainstInventory(rows,inventory),applied_decisions:applied};}
 save(`${directory}/batch-inspection.json`,{...inspection,at:new Date().toISOString(),review_requirement:'Automatic evidence and duplicate guards; uncertainty is withheld. No routine human approval.'});
 log({inspection_ready:inspection.ready,approved:inspection.approved,withheld:inspection.applied_decisions?.length||0});return inspection;
}
async function stagingWorkerDatabase(){
 if(!process.argv.includes('--staging'))throw Error('explicit_staging_target_required');loadEnvFile('.env.staging');
 if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
 return createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
}
async function syncWorker(db){
 const {data:claimed,error:claimError}=await db.rpc('claim_question_factory',{p_worker:store.identity});
 if(claimError||!claimed)throw Error('factory_bound_worker_required');
 const jobs=campaign.jobs.map(j=>store.get(j.id)||j),r=report();
 const remoteJobs=jobs.map(j=>({id:j.id,subject:j.subject,chapter:j.candidate?.chapter||j.chapter,kind:j.kind,anchor_id:null,generation_brief:j,state:j.state||'queued',stage:jobStage(j.state),attempt:j.repair_count||0,candidate:j.candidate||null,result:j.result||null,passage_group_id:j.passage_group_id||null,updated_at:new Date().toISOString()}));
 for(let offset=0;offset<remoteJobs.length;offset+=25){const {error:jobError}=await db.from('question_factory_jobs').upsert(remoteJobs.slice(offset,offset+25));if(jobError)throw Error('factory_job_sync:'+jobError.code);}
 const benchmarkState=manifest().state,snapshot={at:new Date().toISOString(),worker_id:store.identity,budget:ledger.snapshot(),historical_reconciled:true,
  forecast_usd:r.conditional_10000_forecast_usd,cost_per_published_usd:r.cost_per_approved_usd,costs:factoryCostReport(ledger),
  blocker:benchmarkState!=='released'?'fresh_benchmark_pending':r.pending?'registered_batch_pending':null,
  pilot:{target:100,total:100,generated:jobs.filter(j=>j.candidate).length,eligible:r.approved_unique,quarantined:r.rejected,complete:r.complete,cost_per_eligible_usd:r.cost_per_approved_usd},batch:r};
 const {error}=await db.from('question_factory_control').update({snapshot,pilot_target:100,updated_at:new Date().toISOString()}).eq('id',1).eq('worker_id',store.identity);
 if(error)throw Error('factory_snapshot_write:'+error.code);return snapshot;
}
export async function runFocusedWorker({once=false}={}){
 const db=await stagingWorkerDatabase();let stopped=false;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{store.claim();do{
  await reconcile();await syncWorker(db);
  const {data:control,error}=await db.from('question_factory_control').select('paused,publication_enabled').eq('id',1).single();if(error)throw Error('factory_control_unavailable');
  if(!control.paused&&factoryCalibrationReady(manifest(),registry,FACTORY_VERIFIER_VERSION)){
   try{await generate();await validate();}catch(e){
    if(fatal(e))throw e;
    ledger.assertHistoryReconciled();
    log({worker_stage_error:e.message,continuation:'Full conservative holds retained; saved request IDs are never resubmitted.'});
   }
   await syncWorker(db);
   const current=report();
   if(current.complete&&!current.cost.held_usd){await inspectCampaign();if(control.publication_enabled&&current.newly_published<current.approved_unique)await publish();}
  }
  if(once||stopped)break;await new Promise(r=>setTimeout(r,30000));
 }while(!stopped);}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store.release();ledger.close();}
}
async function main(){if(action==='worker')return runFocusedWorker({once:process.argv.includes('--once')});
 try{store.claim();if(action==='reconcile')await reconcile();else if(action==='benchmark')await runBenchmark();else if(action==='generate')await generate();else if(action==='validate')await validate();else if(action==='report')report();else if(action==='inspect')await inspectCampaign();else if(action==='publish')await publish();else throw Error('unknown_action');}
 finally{store.release();ledger.close();}
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))await main();
