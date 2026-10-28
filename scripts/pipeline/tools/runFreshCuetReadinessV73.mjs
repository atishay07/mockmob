// Prospective source-keyed v7.3 measurement. No generation, publication or bank writes.
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {createFactoryEvidenceV73,TOPOLOGIES} from '../lib/factoryEvidenceV73.mjs';
import {validateFactoryCandidateV73} from '../lib/verifyV73.mjs';
import {expectedReleaseBindingV73} from '../lib/releaseEvidenceV73.mjs';
import {REQUIRED_SUBJECTS} from '../lib/releaseEvidenceV7.mjs';
import {blindView,structureVerdict} from '../lib/evidencePipeline.mjs';
import {payloadHash} from '../lib/cuetFitBenchmark.mjs';
import {scopedAccounting,bodyCandidateId} from '../lib/scopedAccounting.mjs';
import {assertCampaignBudget,maximumRequestMicro,requestNeedsReservation} from '../lib/campaignExecutionV7.mjs';
import {saveAtomicArtifact,drainConcurrent} from '../lib/atomicArtifact.mjs';
import {presentationLint} from '../../../data/question_presentation.mjs';
import {provenanceReasons,hashJSON} from '../../../data/question_factory_policy.mjs';
import {effortsFor} from '../../../data/cuet_fit_evidence.mjs';
import {assertCustodySetV73,assertExecutionPlanV73,acceptedNativeRequestV73,reservePendingCostV73,inspectBlindCaptureV73,evaluationResumeActionV73,evaluationFailureStatusV73,providerOutcomeSummaryV73,validatePreflightManifestV73,assertReleaseEvidenceRoleV73,assertBenchmarkProvenanceV73,resumeTerminalFixtureHaikuV73,reportLedgerV73,retainedAcceptedEvaluationV73,FRESH_V73_PROVIDERS,FRESH_V73_PROVENANCE_NOTICE,providersForEvidenceRoleV73,haikuRoleForEvidenceV73} from '../lib/freshCuetReadinessV73Guards.mjs';

const action=process.argv[2]||'report',at=process.argv.indexOf('--study-dir');
if(at<0||!process.argv[at+1])throw Error('explicit_prospective_study_directory_required');
const dir=resolve(process.argv[at+1]),root=resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark'),rel=relative(root,dir);
if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('local_registered_benchmark_directory_required');
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),save=saveAtomicArtifact;
const frozen=read(dir+'/frozen.json'),overlay=read(dir+'/scratch-registry-overlay.json'),custody=read(dir+'/independent-key-custody.json');
const fixtureIds=frozen.fixtures?.map(f=>f.id)||[],positive=frozen.fixtures?.filter(f=>f.expected_valid===true)||[],defects=frozen.fixtures?.filter(f=>f.expected_valid===false)||[];
if(!frozen.id||!fixtureIds.length||fixtureIds.some(id=>typeof id!=='string'||!id)||new Set(fixtureIds).size!==fixtureIds.length||payloadHash(frozen.fixtures)!==frozen.payload_hash||JSON.stringify(frozen.contract_binding)!==JSON.stringify(expectedReleaseBindingV73()))throw Error('frozen_v73_contract_required');
if(fixtureIds.length!==frozen.denominator||positive.length!==frozen.valid_roots||defects.length!==frozen.controlled_defects)throw Error('registered_denominator_mismatch');
for(const subject of REQUIRED_SUBJECTS)if(!positive.some(f=>f.candidate?.subject===subject))throw Error('four_subject_positive_coverage_required');
assertReleaseEvidenceRoleV73(frozen.release_eligibility);
assertBenchmarkProvenanceV73(frozen.fixtures,frozen.release_eligibility.classification);
assertCustodySetV73({fixtureIds,positiveIds:positive.map(f=>f.id),custody});
const evidenceProviders=providersForEvidenceRoleV73(frozen.release_eligibility.classification);
const id=frozen.id,prefix=id+':',run=dir+'/run',planPath=run+'/execution-plan.json',resultPath=run+'/results.json';
const bindingFiles=['scripts/pipeline/tools/runFreshCuetReadinessV73.mjs','scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs','scripts/pipeline/lib/releaseEvidenceV73.mjs','scripts/pipeline/lib/releaseEvidenceV7.mjs','scripts/pipeline/lib/campaignExecutionV7.mjs','scripts/pipeline/lib/scopedAccounting.mjs','scripts/pipeline/lib/factoryTransport.mjs','scripts/pipeline/lib/budgetLedger.mjs','scripts/pipeline/lib/factoryEvidenceV73.mjs','scripts/pipeline/lib/verifyV73.mjs','scripts/pipeline/lib/evidencePipeline.mjs','scripts/pipeline/lib/atomicArtifact.mjs','scripts/pipeline/lib/cuetExemplarPolicyVNext.mjs','scripts/pipeline/lib/contractV73.mjs','scripts/pipeline/lib/cuetFitBenchmark.mjs','data/question_presentation.mjs','data/question_factory_policy.mjs','data/cuet_fit_evidence.mjs'];
const inputHashes=()=>({frozen:sha(dir+'/frozen.json'),overlay:sha(dir+'/scratch-registry-overlay.json'),custody:sha(dir+'/independent-key-custody.json'),source_registry:sha('data/source_registry.json'),prices:sha('data/pipeline-prices.json'),code:Object.fromEntries(bindingFiles.map(p=>[p,sha(p)]))});
const checkSources=registry=>{for(const f of frozen.fixtures)for(const r of f.candidate.source_refs||[]){const s=registry.sources?.[r.id];if(s?.state!=='active'||!s.reuse_permitted||s.version!==r.version||s.supports?.[r.locator]!==r.support_hash||hashJSON(s.facts?.[r.locator]?.text)!==r.support_hash)throw Error('registered_support_contract_changed:'+f.id);}};
if(action==='prepare'){
 mkdirSync(run,{recursive:true});
 if(existsSync(planPath)||existsSync(resultPath))throw Error('study_already_registered_resume_immutable_inputs');
 const base=read('data/source_registry.json'),registry={...base,sources:{...base.sources,...overlay.sources},families:{...base.families,...overlay.families},packs:{...base.packs,...overlay.packs}};
 checkSources(registry);
 const plan={id,registered_at:new Date().toISOString(),cap_usd:4,contract_binding:frozen.contract_binding,denominator:fixtureIds.length,valid_roots:positive.length,controlled_defects:defects.length,source_registry:registry,source_registry_hash:hashJSON(registry),input_hashes:inputHashes(),maximum_content_repairs:0,publication:'never',providers:evidenceProviders,topology:'dual_blind',haiku_role:haikuRoleForEvidenceV73(frozen.release_eligibility.classification),provenance_notice:FRESH_V73_PROVENANCE_NOTICE,regeneration:false};
 save(planPath,plan);console.log(JSON.stringify({registered:true,id,denominator:plan.denominator,paid_calls:0}));process.exit(0);
}
const plan=read(planPath);
const baseRegistry=read('data/source_registry.json'),expectedRegistry={...baseRegistry,sources:{...baseRegistry.sources,...overlay.sources},families:{...baseRegistry.families,...overlay.families},packs:{...baseRegistry.packs,...overlay.packs}};
assertExecutionPlanV73(plan,{id,binding:expectedReleaseBindingV73(),inputHashes:inputHashes(),registryHash:hashJSON(expectedRegistry),denominator:fixtureIds.length,validRoots:positive.length,controlledDefects:defects.length,classification:frozen.release_eligibility.classification});
if(plan.provenance_notice!==FRESH_V73_PROVENANCE_NOTICE)throw Error('benchmark_provenance_notice_changed');
checkSources(plan.source_registry);
const registry=plan.source_registry,providers=plan.providers;
const results=existsSync(resultPath)?read(resultPath):{benchmark:{id,payload_hash:frozen.payload_hash},verifier_version:frozen.verifier_version,contract_binding:plan.contract_binding,release_eligibility:frozen.release_eligibility,evaluations:{},topologies:{dual_blind:[]},started_at:null};
if(results.benchmark?.id!==id||results.benchmark?.payload_hash!==frozen.payload_hash||results.verifier_version!==frozen.verifier_version||JSON.stringify(results.contract_binding)!==JSON.stringify(plan.contract_binding)||JSON.stringify(results.release_eligibility)!==JSON.stringify(frozen.release_eligibility)||!results.evaluations||!results.topologies?.dual_blind)throw Error('saved_results_binding_or_schema_invalid');
const knownResultIds=new Set(fixtureIds);if(Object.keys(results.evaluations).some(fid=>!knownResultIds.has(fid))||new Set(results.topologies.dual_blind.map(r=>r.id)).size!==results.topologies.dual_blind.length||results.topologies.dual_blind.some(r=>!knownResultIds.has(r.id)))throw Error('saved_results_fixture_set_invalid');
function providerRaw(provider,body){return provider==='openai'?body.input.find(r=>r.role==='user')?.content:provider==='anthropic'?body.messages?.[0]?.content:body.contents?.[0]?.parts?.[0]?.text;}
async function preflight(){
 const failures=positive.map(f=>({id:f.id,reasons:[...structureVerdict(f.candidate).reasons,...presentationLint(f.candidate),...provenanceReasons(f.candidate,registry)]})).filter(f=>f.reasons.length);
 if(failures.length)throw Error('positive_fixture_local_failures:'+JSON.stringify(failures));
 const captures=[],limits=read('data/pipeline-prices.json').models;
 for(const f of frozen.fixtures)for(const provider of providers){
  const transport={generate:async(p,body,options)=>{const raw=providerRaw(p,body),model=p==='openai'?'gpt-6-luna':p==='anthropic'?'claude-haiku-5-5':'gemini-3.8-flash';captures.push(inspectBlindCaptureV73({fixtureId:f.id,provider:p,phase:options.stage,raw,body,inputLimitTokens:limits[model].max_input_tokens}));throw Error('offline_capture_complete');}};
  const adapters=createFactoryEvidenceV73({registry,ledger:{getCache:()=>null,setCache:()=>{throw Error('offline_cache_write');}},transport,calibrationPurpose:true,efforts:effortsFor(f.candidate)});
  try{await adapters.__evaluation(blindView({...f.candidate,correct_answer:'FRESH_BLIND_KEY_CANARY',explanation:'FRESH_BLIND_KEY_CANARY'},f.candidate.source_refs),provider);}catch(e){if(e.message!=='offline_capture_complete')throw e;}
 }
 const overBound=captures.filter(c=>c.bytes>c.provider_input_limit_tokens).map(c=>({fixture_id:c.fixture_id,provider:c.provider,bytes:c.bytes,provider_input_limit_tokens:c.provider_input_limit_tokens}));
 const pre={at:new Date().toISOString(),input_hashes:plan.input_hashes,contract_binding:plan.contract_binding,positive_local_failures:failures,captures:captures.length,expected:fixtureIds.length*providers.length,capture_manifest:captures,answers_hidden:true,maximum_bytes:Math.max(...captures.map(c=>c.bytes)),over_bound:overBound,paid_calls:0};
 validatePreflightManifestV73({manifest:captures,fixtureIds,providers,limits:Object.fromEntries(providers.map(p=>[p,limits[p==='openai'?'gpt-6-luna':p==='anthropic'?'claude-haiku-5-5':'gemini-3.8-flash'].max_input_tokens]))});
 save(run+'/preflight.json',pre);console.log(JSON.stringify(pre));
}
if(action==='preflight'){await preflight();process.exit(0);}
let ledger,native,pendingMaximum=0,stopping=false;
const stop=()=>{stopping=true;};
function costs(){return scopedAccounting(ledger,prefix);}
const transport={generate:async(provider,body,options)=>{
 const key=hashJSON({study:id,parent:options.key});
 if(acceptedNativeRequestV73(ledger.db,key))throw Object.assign(new Error('accepted_provider_request_exists_no_resubmit'),{nativeKey:key,dispatchState:'accepted'});
 if(!requestNeedsReservation(ledger,key))return native.generate(provider,body,{...options,key});
 if(stopping||existsSync(run+'/STOP_AFTER_REQUEST'))throw Object.assign(new Error('study_draining_stop'),{nativeKey:key,dispatchState:'guard_blocked'});
 const candidate=bodyCandidateId(provider,body);if(!fixtureIds.includes(candidate))throw Error('registered_study_candidate_required');
 const maximum=maximumRequestMicro(provider,body,read('data/pipeline-prices.json'));
 try{pendingMaximum=reservePendingCostV73({committedMicro:costs().committed_micro,pendingMicro:pendingMaximum,maximumMicro:maximum,capUsd:plan.cap_usd,assertBudget:assertCampaignBudget});}catch(e){e.nativeKey=key;e.dispatchState='guard_blocked';throw e;}
 try{return await native.generate(provider,body,{...options,key,batch:false,purpose:'calibration',candidate_id:prefix+candidate});}catch(e){e.nativeKey=key;e.dispatchState=acceptedNativeRequestV73(ledger.db,key)?'accepted':'guard_blocked';throw e;}finally{pendingMaximum-=maximum;}
}};
function summary(){
 const rows=results.topologies.dual_blind,cost=costs(),bySubject=Object.fromEntries(REQUIRED_SUBJECTS.map(subject=>{const valid=rows.filter(r=>r.expected_valid&&frozen.fixtures.find(f=>f.id===r.id)?.candidate.subject===subject);return[subject,{expected:positive.filter(f=>f.candidate.subject===subject).length,terminal:valid.length,eligible:valid.filter(r=>r.state==='eligible').length}];}));
 const haiku=providers.includes('anthropic')?positive.map(f=>({fixture:f,evaluation:results.evaluations[f.id]?.anthropic})):[],answered=haiku.filter(p=>p.evaluation?.status==='judged');
 const providerOutcomes=providerOutcomeSummaryV73({fixtureIds,positiveIds:positive.map(f=>f.id),evaluations:results.evaluations,providers});
 const providerStageErrors=fixtureIds.flatMap(fid=>providers.filter(provider=>results.evaluations[fid]?.[provider]?.status!=='judged').map(provider=>({id:fid,stage:'blinded_evaluation',provider,status:results.evaluations[fid]?.[provider]?.status||'missing',error:results.evaluations[fid]?.[provider]?.error||null})));
 const topologyStageErrors=rows.filter(r=>r.state==='error').map(r=>({id:r.id,stage:r.stage_error||'dual_blind_verification',reasons:r.reasons||[]}));
 return {at:new Date().toISOString(),id,denominator:fixtureIds.length,valid_roots:positive.length,controlled_defects:defects.length,terminal_topology:rows.length,eligible_valid:rows.filter(r=>r.expected_valid&&r.state==='eligible').length,controlled_false_accepts:rows.filter(r=>!r.expected_valid&&r.state==='eligible').map(r=>r.id),by_subject:bySubject,provider_outcomes:providerOutcomes,provider_errors:Object.values(providerOutcomes).reduce((n,p)=>n+p.counts.error,0),provider_stage_errors:providerStageErrors,stage_errors:[...providerStageErrors,...topologyStageErrors],execution_finished:rows.length===fixtureIds.length&&rows.every(r=>r.state!=='error'),release_evidence_complete:rows.length===fixtureIds.length&&rows.every(r=>r.state!=='error')&&fixtureIds.every(fid=>providers.every(p=>results.evaluations[fid]?.[p]?.status==='judged')),haiku:{role:plan.haiku_role,comparison_applicable:providers.includes('anthropic'),valid_denominator:haiku.length,observed:answered.length,comparison_complete:providers.includes('anthropic')?providerOutcomes.anthropic.complete&&rows.every(r=>r.state!=='error'):null,source_supported_unique_key_matches:answered.filter(({fixture,evaluation:e})=>e.solved_key===fixture.oracle.key&&e.single_defensible_answer===true&&e.source_support===true).length,cuet_fit_passes:answered.filter(p=>p.evaluation.exam_fit===true).length},settled_usd:cost.settled_micro/1e6,held_usd:cost.held_micro/1e6,gross_usd:cost.committed_micro/1e6,receipt_complete:cost.receipt_complete,publication_writes:0,release:false,provenance_notice:FRESH_V73_PROVENANCE_NOTICE,limitation:'Official source keys and blinded checks are measured evidence; correlated papers/paired controls and model agreement do not establish perfect accuracy.'};
}
try{
 if(!['report','execute'].includes(action))throw Error('unknown_study_action');
 if(action==='execute'&&!process.argv.includes('--approved'))throw Error('authorized_paid_execution_flag_required');
 if(action==='execute')await preflight();
 else{const pre=read(run+'/preflight.json');if(pre.over_bound.length||pre.positive_local_failures.length||JSON.stringify(pre.input_hashes)!==JSON.stringify(plan.input_hashes)||JSON.stringify(pre.contract_binding)!==JSON.stringify(plan.contract_binding)||pre.captures!==fixtureIds.length*providers.length)throw Error('current_offline_preflight_required');
  validatePreflightManifestV73({manifest:pre.capture_manifest,fixtureIds,providers,limits:Object.fromEntries(providers.map(p=>[p,p==='openai'?read('data/pipeline-prices.json').models['gpt-6-luna'].max_input_tokens:p==='anthropic'?read('data/pipeline-prices.json').models['claude-haiku-5-5'].max_input_tokens:read('data/pipeline-prices.json').models['gemini-3.8-flash'].max_input_tokens]))});}
 if(action==='report')ledger=reportLedgerV73(new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true}));
 else{try{loadEnvFile('.env.local');}catch{}ledger=new BudgetLedger('data/pipeline-budget.sqlite');ledger.assertHistoryReconciled();native=createFactoryTransport({ledger,realtimeStages:['blind_solution','independent_evaluation','explanation_support']});process.on('SIGINT',stop);process.on('SIGTERM',stop);}
 if(action==='execute'){
  results.started_at||=new Date().toISOString();
  await drainConcurrent(frozen.fixtures,async f=>{
   const existingIndex=results.topologies.dual_blind.findIndex(r=>r.id===f.id),existing=existingIndex>=0?results.topologies.dual_blind[existingIndex]:null;
   results.evaluations[f.id]||={};
   if(existing&&['eligible','quarantined'].includes(existing.state)){
    if(!providers.includes('anthropic'))return;
    const adapters=createFactoryEvidenceV73({registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,efforts:effortsFor(f.candidate)});
    const resumed=await resumeTerminalFixtureHaikuV73({verdict:existing,evaluations:results.evaluations[f.id],
     acceptedNativeRequest:key=>acceptedNativeRequestV73(ledger.db,key),
     evaluateProvider:provider=>adapters.__evaluation(blindView(f.candidate,f.candidate.source_refs),provider),
     validateTopology:()=>validateFactoryCandidateV73(f.candidate,{registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,seen:new Set()}),
     save:()=>save(resultPath,results)});
    if(resumed.handled){save(resultPath,results);save(run+'/summary.json',summary());console.log(JSON.stringify({case:f.id,...summary()}));return;}
   }
   if(existing&&!(existing.state==='error'&&existing.resume_safe===true))return;
   const adapters=createFactoryEvidenceV73({registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,efforts:effortsFor(f.candidate)});
   for(const provider of providers){
    const prior=results.evaluations[f.id][provider],accepted=Boolean(prior?.native_key&&acceptedNativeRequestV73(ledger.db,prior.native_key)),resume=evaluationResumeActionV73(prior,accepted,provider==='anthropic');
    if(resume==='reuse_saved_judgment'||resume==='keep_terminal_error')continue;
    const retained=retainedAcceptedEvaluationV73(prior,resume);
    if(retained){results.evaluations[f.id][provider]=retained;save(resultPath,results);continue;}
    if(resume==='stop_unknown_saved_state'){results.evaluations[f.id][provider]={status:'error',error:'unknown_saved_evaluation_state_requires_manual_reconciliation'};save(resultPath,results);continue;}
    try{results.evaluations[f.id][provider]={status:'judged',...await adapters.__evaluation(blindView(f.candidate,f.candidate.source_refs),provider)};}catch(e){const accepted=e.nativeKey&&acceptedNativeRequestV73(ledger.db,e.nativeKey);results.evaluations[f.id][provider]={status:evaluationFailureStatusV73(e,accepted),error:e.message,...(e.nativeKey?{native_key:e.nativeKey}:{})};if(/budget|pricing|credit|draining/.test(e.message))stopping=true;}
    save(resultPath,results);
   }
   const primaryFailure=FRESH_V73_PROVIDERS.slice(0,2).find(p=>results.evaluations[f.id]?.[p]?.status!=='judged');
   let verdict,resumeSafe=false;if(primaryFailure)verdict={state:'error',stage_error:`blind_evaluation:${primaryFailure}`,reasons:[results.evaluations[f.id][primaryFailure]?.error||'blind_evaluation_incomplete'],resume_safe:results.evaluations[f.id][primaryFailure]?.status==='guard_blocked'};
   else try{verdict=await validateFactoryCandidateV73(f.candidate,{registry,ledger,transport,topology:TOPOLOGIES.dual_blind,calibrationPurpose:true,seen:new Set()});}catch(e){resumeSafe=e.dispatchState==='guard_blocked'||(e.nativeKey&&!acceptedNativeRequestV73(ledger.db,e.nativeKey));verdict={state:'error',stage_error:'dual_blind_verification',reasons:[e.message],resume_safe:resumeSafe};if(/budget|pricing|credit|draining/.test(e.message))stopping=true;}
   const row={id:f.id,group:f.group,category:f.category,expected_valid:f.expected_valid,...verdict};if(existingIndex>=0)results.topologies.dual_blind[existingIndex]=row;else results.topologies.dual_blind.push(row);save(resultPath,results);save(run+'/summary.json',summary());console.log(JSON.stringify({case:f.id,...summary()}));
  },{concurrency:3,shouldStop:()=>stopping});
 }
 save(run+'/summary.json',summary());console.log(JSON.stringify(summary()));
}finally{ledger?.close();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
