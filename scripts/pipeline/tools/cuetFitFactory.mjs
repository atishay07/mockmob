// CUET-fit campaign worker (profile cuet-fit-v7). The legacy focusedFactory.mjs and its frozen v6 contract are untouched and keep
// serving the registered cohorts. This worker runs fixed, preregistered campaigns under the anchored CUET-fit rubric and a
// topology that has a measured release in data/calibration_manifest.json. Every provider call goes through the persistent budget guard.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {basename,dirname,resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {FactoryStore} from '../lib/factoryStore.mjs';
import {claimCampaignMeasurementLease,parallelMeasurementStopRequested} from '../lib/campaignMeasurementLeaseVNext.mjs';
import {parallelMeasurementLeaseProfile,readParallelMeasurementRegistration,verifiedBaselineGlobalWorkerProof,verifyRegisteredCampaign} from '../lib/parallelMeasurementRegistrationVNext.mjs';
import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {authorOriginal,repairFactoryCandidate,publishFactoryQuestion,publishFactoryGroup} from '../lib/factoryCore.mjs';
import {sourceMaterial} from '../lib/factoryEvidence.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES,FACTORY_VERIFIER_VERSION_V7,V7_PROMPT_HASH} from '../lib/factoryEvidenceV7.mjs';
import {validateFactoryCandidateV7} from '../lib/verifyV7.mjs';
import {validationContractV7,MAX_WAVE_SIZE} from '../lib/contractV7.mjs';
import {cuetFitReleased,effortsFor,EFFORT_POLICY_ID} from '../../../data/cuet_fit_evidence.mjs';
import {tolerantQuoteIntegrity,normalizeOptionLabels,authoringAddendumV7} from '../lib/authorIntegrityV7.mjs';
import {blindView,structureVerdict} from '../lib/evidencePipeline.mjs';
import {presentationLint} from '../../../data/question_presentation.mjs';
import {inventoryFingerprint,hashJSON,provenanceReasons} from '../../../data/question_factory_policy.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {inspectAgainstInventory,BATCH_INSPECTION_CONTRACT} from '../lib/batchInspection.mjs';
import {stopsFactory} from '../lib/factoryFailure.mjs';
import {constrainedAuthoring} from '../lib/constrainedAuthoring.mjs';
import {campaignReceipts} from '../lib/campaignReceipts.mjs';
import {cohortAccounting} from '../lib/cohortAccounting.mjs';
import {boundedRowChunks} from '../lib/boundedStorage.mjs';
import {executionPolicy,assertPublicationPolicy,campaignCommittedMicro,assertCampaignBudget,maximumRequestMicro,requestNeedsReservation} from '../lib/campaignExecutionV7.mjs';
try{loadEnvFile('.env.local');}catch{}
const action=process.argv[2]||'report',dirIndex=process.argv.indexOf('--campaign-dir'),directory=dirIndex>=0?process.argv[dirIndex+1]:null;
if(!directory||!resolve(directory).startsWith(resolve('artifacts/question-factory')+'\\')&&!resolve(directory).startsWith(resolve('artifacts/question-factory')+'/'))throw Error('local_factory_artifact_directory_required');
mkdirSync(directory,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const registry=read('data/source_registry.json'),campaign=read(`${directory}/campaign.json`),profile=read(`${directory}/verification-profile.json`);
const parallelMeasurement=process.argv.includes('--parallel-measurement');
const parallelRegistration=parallelMeasurement?verifyRegisteredCampaign('improved',{directory,args:process.argv}):null;
if(parallelMeasurement&&(action!=='worker'||process.argv.includes('--publish')||!process.argv.includes('--realtime-all')))throw Error('parallel_measurement_worker_mode_required');
if(parallelMeasurement&&(JSON.stringify(parallelRegistration.campaign)!==JSON.stringify(campaign)||JSON.stringify(parallelRegistration.profile)!==JSON.stringify(profile)))throw Error('parallel_measurement_loaded_registration_mismatch');
const stopFileIndex=process.argv.indexOf('--stop-file'),stopFileArgument=stopFileIndex>=0?process.argv[stopFileIndex+1]:null;
const stopFile=parallelMeasurement&&stopFileArgument?resolve(stopFileArgument):null;
if(parallelMeasurement&&(!stopFile||dirname(stopFile)!==resolve(directory)||!/^STOP_AFTER_WAVE-[0-9a-f-]+\.json$/i.test(basename(stopFile))))throw Error('parallel_measurement_stop_file_required');
if(!parallelMeasurement&&stopFileIndex>=0)throw Error('stop_file_requires_parallel_measurement');
const parallelMaxWavesIndex=process.argv.indexOf('--max-waves'),parallelMaxWaves=parallelMaxWavesIndex>=0?Number(process.argv[parallelMaxWavesIndex+1]):null;
if(parallelMeasurement&&parallelMaxWaves!==readParallelMeasurementRegistration().maximum_wave_iterations)throw Error('parallel_measurement_wave_bound_mismatch');
const topology=TOPOLOGIES[profile.topology];if(!topology)throw Error('unknown_validation_topology');
const ledgerPath=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite',ledger=new BudgetLedger(ledgerPath),store=new FactoryStore(ledger,ledgerPath,{candidateIds:campaign.jobs.map(j=>j.id)});
const all=['authoring','blind_solution','independent_evaluation','explanation_support','repair'];
const realtimeStages=process.argv.includes('--realtime-all')?all:process.argv.includes('--realtime-checks')?all.slice(1):[];
// Luna stages run on the flex tier (half price, minutes of latency, standard-tier fallback on capacity refusal) unless --no-flex.
const nativeTransport=createFactoryTransport({ledger,queueOpenAI:true,queueGemini:true,realtimeStages,flexStages:process.argv.includes('--no-flex')?[]:['authoring','blind_solution','explanation_support','repair']});
let pendingMaximumMicro=0;
const transport={...nativeTransport,async generate(provider,body,options){
 if(parallelMeasurement)options={...options,batch:false};
 if(!requestNeedsReservation(ledger,options.key))return nativeTransport.generate(provider,body,options);
 const maximum=maximumRequestMicro(provider,body,read('data/pipeline-prices.json'),{batch:!parallelMeasurement&&provider!=='anthropic'&&!realtimeStages.includes(options.stage)});
 if(profile.cap_usd!==undefined)assertCampaignBudget(campaignCommittedMicro(ledger,campaign.jobs.map(j=>j.id))+pendingMaximumMicro,maximum,profile.cap_usd);
 pendingMaximumMicro+=maximum;
 try{return await nativeTransport.generate(provider,body,options);}finally{pendingMaximumMicro-=maximum;}
},async flush(){
 if(parallelMeasurement){const queued=ledger.db.prepare("SELECT COUNT(*) n FROM provider_batches WHERE state IN ('queued','dispatching')").get().n;if(queued)throw Error('parallel_measurement_provider_batch_work_pending');return;}
 return nativeTransport.flush();
}},config={registry,ledger,transport};
const waiting=e=>e instanceof BatchPending,fatal=e=>e.message==='campaign_budget_exhausted'||stopsFactory(e,ledger),log=v=>console.log(JSON.stringify(v));
const jobStage=state=>['eligible','quarantined','published'].includes(state)?'complete':state==='waiting_repair'?'repair':state==='repaired'?'revalidation':['generated','waiting_validation'].includes(state)?'validation':'authoring';
const manifest=()=>read('data/calibration_manifest.json');
// Waves: a campaign is worked a few candidates at a time (default 10, never more) so each wave sees the ideas approved by the previous one and a failing
// route stops early instead of spending on the whole denominator. Total candidates, repairs and costs stay in the same fixed denominator.
const WAVE_SIZE=Math.min(MAX_WAVE_SIZE,Math.max(1,Number(process.argv[process.argv.indexOf('--wave-size')+1])||MAX_WAVE_SIZE));
if(parallelMeasurement&&WAVE_SIZE!==10)throw Error('parallel_measurement_wave_size_mismatch');
const terminal=j=>['eligible','quarantined','published'].includes((store.get(j.id)||j).state);
const wave=()=>campaign.jobs.filter(j=>!terminal(j)).slice(0,WAVE_SIZE);
function refreshAvoidance(rows){const approved=campaign.jobs.map(j=>store.get(j.id)||j).filter(j=>['eligible','published'].includes(j.state)&&j.candidate);for(const job of rows){const same=approved.filter(a=>a.subject===job.subject&&a.chapter===job.chapter).map(a=>a.candidate.body).slice(-12);if(same.length)job.avoidance=[...new Set([...(job.avoidance||[]),...same])].slice(-40);}}
const releaseRecord=()=>({validation_topology:topology.id,verifier_version:FACTORY_VERIFIER_VERSION_V7,checks:{blind_solution:{evaluation_prompt:V7_PROMPT_HASH}}});
function contract(){if(profile.contract_hash!==validationContractV7()||profile.registry_version!==registry.version)throw Error('frozen_validation_contract_changed');}
function releaseRequired(){contract();executionPolicy(profile,{measurementOnly:process.argv.includes('--measurement-only'),staging:process.argv.includes('--staging'),publish:process.argv.includes('--publish'),releaseAvailable:cuetFitReleased(manifest(),registry,releaseRecord())});}
function costRows(){const before=new Set(campaign.request_ids_before);return ledger.db.prepare('SELECT * FROM requests').all().filter(r=>!before.has(r.id)).map(r=>({...r,receipt:r.receipt_json?JSON.parse(r.receipt_json):null}));}
function costs(rows){return {settled_usd:rows.filter(r=>r.state==='settled').reduce((n,r)=>n+r.actual,0)/1e6,held_usd:rows.filter(r=>r.state!=='settled').reduce((n,r)=>n+Math.max(r.reserved,r.actual||0),0)/1e6,
 gross_usd:rows.reduce((n,r)=>n+Math.max(r.actual||0,r.state==='settled'?0:r.reserved),0)/1e6,requests:rows.length,unresolved:rows.filter(r=>r.state==='unresolved').length};}
async function parallel(rows,fn){let index=0,failure;await Promise.allSettled(Array.from({length:4},async()=>{while(!failure){const row=rows[index++];if(!row)return;try{await fn(row);if(parallelMeasurement)store.refreshMeasurementLease();else store.claim();}catch(e){failure=e;}}}));if(failure)throw failure;}
async function prefetch(candidate,tr){const adapters=createFactoryEvidenceV7({...config,transport:tr,topology,efforts:effortsFor(candidate)});let pending=false;
 if(!structureVerdict(candidate).passed||presentationLint(candidate).length||provenanceReasons(candidate,registry).length)return true;
 for(const stage of ['source_support','presentation_quality','blind_solution',...(topology.secondary?['independent_evaluation']:[])])try{
  const verdict=await adapters[stage](blindView(candidate,candidate.source_refs));
  if(verdict.passed!==true||stage==='blind_solution'&&verdict.solved_key!==candidate.correct_answer)return true;
 }catch(e){if(waiting(e))pending=true;else if(fatal(e))throw e;else return true;}
 return !pending;
}
async function reconcile(){if(parallelMeasurement)return;const rows=ledger.db.prepare("SELECT id,provider_id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all();
 let settled=0;for(const row of rows){try{if(await transport.reconcile(row.id))settled++;}catch(e){log({receipt_pending:row.id,reason:e.message});if(fatal(e))throw e;}}
 log({receipt_checks:rows.length,settled,budget:ledger.snapshot()});
}
async function generate(rows=wave()){releaseRequired();refreshAvoidance(rows);await parallel(rows,async original=>{
 const job=store.get(original.id)||original;if(job.candidate||job.state==='quarantined')return;
 try{job.candidate=await authorOriginal(job,{...config,transport:constrainedAuthoring(authoringAddendumV7(transport,job),job)});job.state='generated';}
 catch(e){if(waiting(e)){job.state='waiting_authoring';job.pending=e.batchId;}else if(fatal(e))throw e;else{job.candidate=e.candidate||null;job.state=job.candidate?'generated':'quarantined';job.author_failure=e.message;if(!job.candidate)job.result={state:'quarantined',reasons:[e.message]};}}
 store.set(job.id,job);
 });await transport.flush();report();}
async function validate(rows=campaign.jobs){releaseRequired();await parallel(rows,async original=>{
 const job=store.get(original.id)||original;if(!job.candidate||['eligible','quarantined','published'].includes(job.state))return;
 // Cosmetic label prefixes are normalized before any paid check; the content hash is taken after this step.
 const labels=normalizeOptionLabels(job.candidate);if(labels.changed){job.candidate=labels.candidate;job.label_normalized=true;}
 const quoteIntegrity=tolerantQuoteIntegrity(job.candidate,registry);
 if(!quoteIntegrity.passed){job.state='quarantined';job.result={state:'quarantined',reasons:[quoteIntegrity.reason],author_quote_integrity:quoteIntegrity};store.set(job.id,job);return;}
 job.quote_methods=quoteIntegrity.methods;
 try{
  if(job.state==='waiting_repair'){
   job.candidate=normalizeOptionLabels(await repairFactoryCandidate(job.candidate,job.first_result.reasons.concat(job.first_result.failure_details||[]),config)).candidate;job.repair_count=1;job.state='repaired';store.set(job.id,job);
  }
  if(!await prefetch(job.candidate,transport)){job.state='waiting_validation';store.set(job.id,job);return;}
  const result=await validateFactoryCandidateV7(job.candidate,{...config,topology});job.result=result;
  if(result.state==='quarantined'&&!job.repair_count&&repairable(result)){job.first_result=result;job.state='waiting_repair';job.repair_count=1;store.set(job.id,job);
   job.candidate=normalizeOptionLabels(await repairFactoryCandidate(job.candidate,result.reasons.concat(result.failure_details||[]),config)).candidate;job.state='repaired';store.set(job.id,job);return;}
  job.state=result.state;if(result.question)job.candidate=result.question;
 }catch(e){if(waiting(e)){job.pending=e.batchId;if(job.state!=='waiting_repair')job.state='waiting_validation';}else if(fatal(e))throw e;else{job.state='quarantined';job.result={state:'quarantined',reasons:[e.message]};}}
 store.set(job.id,job);
 });await transport.flush();report();}
// One targeted repair is only worth buying for a defect a rewrite can remove; an unsupported syllabus or a wrong key is not repaired by polish.
const repairable=result=>Boolean(result.reasons?.some(r=>r.startsWith('failed:')||r==='blind_key_contradiction'||r==='independent_key_contradiction'));
function report(){const rows=campaign.jobs.map(j=>store.get(j.id)||j),ids=new Set(campaign.jobs.map(j=>j.id)),metadata=new Map(ledger.db.prepare("SELECT reservation_id,id AS provider_key,provider_id,json_extract(request_json,'$.config.candidate_id') AS candidate_id,json_extract(request_json,'$.config.purpose') AS purpose FROM provider_batches UNION ALL SELECT reservation_id,id,NULL,json_extract(request_json,'$.config.candidate_id'),json_extract(request_json,'$.config.purpose') FROM provider_requests").all().map(r=>[r.reservation_id,r]));
 const receipts=campaignReceipts(costRows(),metadata,{candidateIds:ids,calibrationIds:new Set()}),batchReceipts=receipts.filter(r=>{const c=metadata.get(r.id)||{};return (r.receipt?.purpose||c.purpose)==='candidate'&&ids.has(r.receipt?.candidate_id||c.candidate_id);});
 const seen=new Map();for(const job of rows){if(!['eligible','published'].includes(job.state))continue;const fingerprint=inventoryFingerprint(job.candidate);if(seen.has(fingerprint)){job.state='quarantined';job.result={...job.result,state:'quarantined',reasons:['duplicate_of:'+seen.get(fingerprint)]};store.set(job.id,job);}else seen.set(fingerprint,job.id);}
 for(const group of Object.values(registry.passage_groups||{}).filter(g=>g.kind==='original_practice')){const siblings=rows.filter(j=>group.candidate_ids.includes(j.id));
  if(siblings.some(j=>j.state==='quarantined'))for(const job of siblings.filter(j=>j.state==='eligible')){job.state='quarantined';job.result={...job.result,state:'quarantined',reasons:['passage_group_sibling_rejected']};store.set(job.id,job);}}
 const approved=rows.filter(j=>['eligible','published'].includes(j.state)),finished=rows.every(j=>['eligible','quarantined','published'].includes(j.state));
 const count=key=>Object.fromEntries([...new Set(approved.map(j=>j.candidate[key]))].map(k=>[k,approved.filter(j=>j.candidate[key]===k).length]));
 const accounting=cohortAccounting(batchReceipts.map(r=>({...r,...metadata.get(r.id),hold_maximum_micro:ledger.db.prepare('SELECT maximum_micro FROM conservative_holds WHERE reservation_id=?').get(r.id)?.maximum_micro})),{jobs:rows,budget:ledger.snapshot()});
 const contentCost=costs(batchReceipts),price=finished&&accounting.ready&&approved.length?contentCost.gross_usd/approved.length:null;
 const rejectionStages={};for(const j of rows.filter(j=>j.state==='quarantined')){const k=j.result?.failed_stage||(j.result?.reasons||[])[0]||'unknown';rejectionStages[k]=(rejectionStages[k]||0)+1;}
 const fitScores=approved.map(j=>j.candidate.evidence?.record?.cuet_fit?.score).filter(Number.isInteger),dist={};for(const s of fitScores)dist[s]=(dist[s]||0)+1;
 const report={id:campaign.id,profile:{contract:'cuet-fit-v7',topology:topology.id,verifier_version:FACTORY_VERIFIER_VERSION_V7,prompt_hash:V7_PROMPT_HASH},denominator:campaign.jobs.length,complete:finished,approved_unique:approved.length,rejected:rows.filter(j=>j.state==='quarantined').length,pending:rows.filter(j=>!['eligible','quarantined','published'].includes(j.state)).length,
  newly_published:rows.filter(j=>j.state==='published').length,measurement_only:profile.measurement_only===true,publication_policy:profile.publication_policy||'released_staging_only',cost:contentCost,publication_accounting:accounting,provider_processing_complete:finished&&accounting.ready,cost_per_approved_usd:price,
  conditional_10000_forecast_usd:price?price*10000:null,
  conditional_lifetime_to_10000_usd:price?ledger.snapshot().committed_micro/1e6+Math.max(0,10000-approved.length)*price:null,
  forecast_basis:'Gross batch cost includes rejected candidates, repair, every validator and reasoning usage. Conditional on unchanged mix and yield; not a promise and not authority to exceed USD 50.',
  budget_scenarios:[50,60,70].map(cap=>({cap_usd:cap,authorized:cap===50,additional_approved_affordable:price?Math.max(0,Math.floor((cap-ledger.snapshot().committed_micro/1e6)/price)):null})),
  rejection_by_stage:rejectionStages,cuet_fit_score_distribution:dist,label_normalized:rows.filter(j=>j.label_normalized).length,repaired:rows.filter(j=>j.repair_count>0).length,
  lifetime:ledger.snapshot(),costs_by_stage:factoryCostReport(ledger),answer_positions:count('correct_answer'),formats:count('question_type'),difficulty:count('difficulty'),
  invoice_status:'Provider response usage receipts; no provider invoice obtained. Held usage is not settled.',at:new Date().toISOString()};
 for(const job of rows){job.item_cost=costs(receipts.filter(r=>(r.receipt?.candidate_id||metadata.get(r.id)?.candidate_id)===job.id));job.supporting_excerpts=sourceMaterial(registry,job.candidate?.source_refs||job.source_refs||[]);}
 save(`${directory}/all-candidates.json`,rows);save(`${directory}/approved.json`,approved.map(j=>j.candidate));save(`${directory}/rejected.json`,rows.filter(j=>j.state==='quarantined'));save(`${directory}/receipts.json`,receipts);save(`${directory}/batch-report.json`,report);
 const columns=['id','subject','chapter','topic','format','difficulty','state','key','body','options','explanation','sources','cuet_fit','rejection_reasons','settled_usd','held_usd','gross_usd'];
 const cell=value=>'"'+String(typeof value==='object'?JSON.stringify(value):value??'').replaceAll('"','""')+'"';
 writeFileSync(`${directory}/all-candidates.csv`,[columns,...rows.map(j=>{const q=j.candidate||{};return [j.id,j.subject,q.chapter||j.chapter,q.topic||j.topic,q.question_type||j.format,q.difficulty||j.difficulty,j.state,q.correct_answer,q.body,q.options,q.explanation,q.source_refs,q.evidence?.record?.cuet_fit||null,j.result?.reasons||[],j.item_cost.settled_usd,j.item_cost.held_usd,j.item_cost.gross_usd];})].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n');
 log({complete:finished,approved:approved.length,rejected:report.rejected,pending:report.pending,cost:contentCost,budget:ledger.snapshot()});return report;
}
async function stagingWorkerDatabase(){
 if(!process.argv.includes('--staging'))throw Error('explicit_staging_target_required');loadEnvFile('.env.staging');
 if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
 return createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
}
async function inspectCampaign(){
 const r=report();if(!r.complete||r.cost.held_usd)throw Error('complete_settled_batch_required');
 const db=await stagingWorkerDatabase(),inventory=await readBankSnapshot(db);
 let rows=campaign.jobs.map(j=>store.get(j.id)||j),inspection=inspectAgainstInventory(rows,inventory,{registry});
 for(const decision of inspection.decisions){const j=rows.find(j=>j.id===decision.id);if(j.state==='published')throw Error('published_content_dispute_required');j.state='quarantined';j.result={...j.result,state:'quarantined',reasons:[decision.reason],inspection:decision};store.set(j.id,j);}
 if(inspection.decisions.length){report();rows=campaign.jobs.map(j=>store.get(j.id)||j);const applied=inspection.decisions;inspection={...inspectAgainstInventory(rows,inventory,{registry}),applied_decisions:applied};}
 save(`${directory}/batch-inspection.json`,{...inspection,at:new Date().toISOString(),review_requirement:'Automatic evidence and duplicate guards; uncertainty is withheld. No routine human approval.'});
 log({inspection_ready:inspection.ready,approved:inspection.approved,withheld:inspection.applied_decisions?.length||0});return inspection;
}
async function publish(){assertPublicationPolicy(profile);releaseRequired();const db=await stagingWorkerDatabase(),r=report();if(!r.complete||!r.publication_accounting.ready)throw Error('complete_bounded_terminal_batch_required');
 const identities=read('.cache/factory-staging-auth.json');process.env.CUET_CONTENT_AUTHOR_ID=identities.admin.id;
 if(!existsSync(`${directory}/batch-inspection.json`))throw Error('batch_inspection_required');
 const inspection=read(`${directory}/batch-inspection.json`);
 const jobs=campaign.jobs.map(j=>store.get(j.id)||j);
 if(inspection.contract!==BATCH_INSPECTION_CONTRACT||inspection.content_hash!==hashJSON(read(`${directory}/all-candidates.json`).map(j=>({id:j.id,candidate:j.candidate,result:j.result})))||inspection.ready!==true)throw Error('current_batch_inspection_required');
 for(const j of jobs){const {error}=await db.from('question_factory_jobs').upsert({id:j.id,subject:j.subject,chapter:j.candidate?.chapter||j.chapter,anchor_id:null,kind:j.kind,generation_brief:j,state:j.state,stage:jobStage(j.state),candidate:j.candidate,result:j.result,passage_group_id:j.passage_group_id||null});if(error)throw Error('staging_job_import:'+error.code);}
 const {error}=await db.from('question_factory_control').update({paused:false,phase:'1000',publication_enabled:true,worker_id:store.identity,lease_until:new Date(Date.now()+300000).toISOString()}).eq('id',1);if(error)throw Error('staging_control:'+error.code);
 const groups=new Set();for(const j of jobs.filter(j=>['eligible','published'].includes(j.state))){if(j.passage_group_id){if(groups.has(j.passage_group_id))continue;const siblings=jobs.filter(x=>x.passage_group_id===j.passage_group_id);await publishFactoryGroup(siblings.map(x=>x.candidate),db,registry);siblings.forEach(x=>{x.state='published';store.set(x.id,x);});groups.add(j.passage_group_id);}else{await publishFactoryQuestion(j.candidate,j.id,db);j.state='published';store.set(j.id,j);}}
 const inventory=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id');save(`${directory}/staging-retrieval.json`,inventory.filter(q=>campaign.jobs.some(j=>j.id===q.id)));save(`${directory}/coverage-after.json`,detailedCoverage(inventory,registry,{heldFamilies:holds.map(h=>h.family_id)}));save(`${directory}/publication.json`,{at:new Date().toISOString(),project_ref:'onwkqxmjqjrhfbjjdydu',newly_published:inventory.filter(q=>campaign.jobs.some(j=>j.id===q.id)).length,production_writes:0});report();
}
export async function runCuetFitWorker({once=false}={}){
 const db=parallelMeasurement?null:await stagingWorkerDatabase();let stopped=false,waveIterations=0;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  if(parallelMeasurement){
   const legacy=verifiedBaselineGlobalWorkerProof(ledger);
   const lease=claimCampaignMeasurementLease(ledger,{campaignId:campaign.id,candidateIds:parallelRegistration.candidateIds,
    profile:parallelMeasurementLeaseProfile(profile,parallelRegistration.registration),args:process.argv,publish:false,
    legacyGlobalScopeProof:legacy?.proof||null,verifyLegacyGlobalScopeProof:legacy?.verify||null});
   store.claimMeasurement(lease);
  }else store.claim();
  do{
  await reconcile();
  if(parallelMeasurement&&(stopped||parallelMeasurementStopRequested(stopFile))){log({parallel_measurement_stopped:stopped?'signal_before_wave':'stop_marker_before_wave'});stopped=true;break;}
  let control;if(parallelMeasurement)control={paused:false,publication_enabled:false};else{const result=await db.from('question_factory_control').select('paused,publication_enabled').eq('id',1).single();if(result.error)throw Error('factory_control_unavailable');control=result.data;}
  if(profile.measurement_only===true||!control.paused&&cuetFitReleased(manifest(),registry,releaseRecord())){
   releaseRequired();
   try{
    let weak=0;
    for(;waveIterations<(parallelMeasurement?parallelMaxWaves:200);){const rows=wave();if(!rows.length)break;waveIterations++;
     await generate(rows);await validate(rows);
     const done=rows.map(j=>store.get(j.id)||j).filter(terminal),ok=done.filter(j=>['eligible','published'].includes(j.state)).length;
     log({wave:rows.length,terminal:done.length,approved:ok});
     if(rows.some(j=>!terminal(j))){if(parallelMeasurement){log({parallel_measurement_stopped:'wave_not_terminal',pending_remains:true});stopped=true;}break;}
     weak=done.length&&ok/done.length<.4?weak+1:0;
     if(weak>=2){log({circuit_open:'two consecutive waves under 40% yield; remaining candidates untouched'});if(parallelMeasurement)stopped=true;break;}
     if(parallelMeasurement&&(stopped||parallelMeasurementStopRequested(stopFile))){log({parallel_measurement_stopped:stopped?'signal_after_wave':'stop_marker_after_wave',pending_remains:campaign.jobs.some(j=>!terminal(j))});stopped=true;break;}
    }
   }catch(e){if(fatal(e))throw e;ledger.assertHistoryReconciled();log({worker_stage_error:e.message,continuation:'Full conservative holds retained; saved request IDs are never resubmitted.'});if(parallelMeasurement)stopped=true;}
   const current=report();
   if(current.complete&&current.publication_accounting.ready&&!parallelMeasurement){await inspectCampaign();if(!profile.measurement_only&&control.publication_enabled&&process.argv.includes('--publish')&&current.newly_published<current.approved_unique)await publish();}
   if(parallelMeasurement&&(current.complete||waveIterations>=parallelMaxWaves)){log({parallel_measurement_stopped:current.complete?'campaign_complete':'maximum_wave_iterations'});stopped=true;}
  }
  if(once||stopped)break;await new Promise(r=>setTimeout(r,30000));
 }while(!stopped);}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store.release();ledger.close();}
}
async function main(){if(action==='worker')return runCuetFitWorker({once:process.argv.includes('--once')});
 try{store.claim();if(action==='reconcile')await reconcile();else if(action==='generate')await generate();else if(action==='validate')await validate();else if(action==='report')report();else if(action==='inspect')await inspectCampaign();else if(action==='publish')await publish();else throw Error('unknown_action');}
 finally{store.release();ledger.close();}
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))await main();
