// Explicit current-profile session. Merely importing this file never opens a ledger or dispatches.
import { readFileSync } from 'node:fs';
import { BudgetLedger } from './budgetLedger.mjs';
import { FactoryStore } from './factoryStore.mjs';
import { createFactoryTransportV713 } from './factoryTransportV713.mjs';
import { createCampaignGuardV713 } from './campaignGuardV713.mjs';
import { assertTrustedNetworkV713R3,providerTransportFaultV713R3 } from './trustedNetworkV713R3.mjs';
import { longFetch } from './longFetch.mjs';
import { archiveRefusedAttemptsV713R2,capacityRefusedV713R2 } from './providerAvailabilityV713R2.mjs';
import { saveAtomicArtifact } from './atomicArtifact.mjs';
import { hashJSON,inventoryFingerprint } from '../../../data/question_factory_policy.mjs';
import { FACTORY_VERIFIER_VERSION_V717,validationContractV717 } from './contractV717.mjs';
import { scorecardPromptHashV717 } from './scorecardReviewV717.mjs';
import { validateFactoryCandidateV717 } from './verifyV717.mjs';
import { createGenerationTransportV717 } from './generationPromptV717.mjs';
import { recordIdeaAllocations } from './ideaAllocation.mjs';
import { assertFullBodyPreflightV713 } from './preflightV713.mjs';
import { maximumRequestMicro } from './campaignExecutionV7.mjs';
import { bodyCandidateId } from './scopedAccounting.mjs';
import { authorOriginal } from './factoryCore.mjs';
import { assertExecutionFreezeV717,fileSha256V717 } from './executionFreezeV717.mjs';
import { assertQualifiedPilotV717 } from './qualifiedPilotV717.mjs';
// Registration binds real artifacts, not boolean claims: the execution freeze (every reachable module), and for a
// qualification the frozen case file and the separately held independent-answer custody file, both created after the freeze.
export function assertRegistrationV717(reg,registry,prices,preflight,{readFile=p=>readFileSync(p)}={}) {
 if (reg?.profile!==FACTORY_VERIFIER_VERSION_V717 || reg.contract_hash!==validationContractV717() || reg.prompt_hash!==scorecardPromptHashV717() || reg.registry_hash!==hashJSON(registry) || reg.pricing_hash!==hashJSON(prices)) throw Error('v717_registration_binding_invalid');
 if (!reg.id || !Array.isArray(reg.jobs) || !reg.jobs.length || new Set(reg.jobs.map(j=>j.id)).size!==reg.jobs.length || reg.jobs.some(j=>!j.id || (!j.candidate_hash && !j.author_body_hash))) throw Error('v717_fixed_jobs_required');
 if (!Number.isFinite(reg.cap_usd) || reg.cap_usd<=0 || reg.cap_usd>(reg.qualification?1:3) || reg.publication!=='never' || reg.max_repairs!==0) throw Error('v717_bounded_study_registration_required');
 if (reg.kind==='pilot') assertQualifiedPilotV717(reg.qualification_binding,{readFile});
 if (!Number.isFinite(reg.standard_full_bound_usd) || reg.standard_full_bound_usd<0 || reg.budget_stop_possible!==true || reg.input_byte_bound!==33024 || reg.full_retry_bounds!==true) throw Error('v717_conservative_cost_preregistration_required');
 if (reg.qualification && (reg.unseen_at_freeze!==true || !/^[a-f0-9]{64}$/.test(reg.independent_answer_custody_hash||''))) throw Error('v717_fresh_independent_custody_required');
 if (!(Date.parse(prices.expires_at)>Date.now()+600000)) throw Error('v717_pricing_expired_or_expiring');
 const freeze=assertExecutionFreezeV717(reg.execution_freeze?.path,reg.execution_freeze?.sha256,{readFile});
 if (reg.qualification) {
  if (!reg.cases?.path || fileSha256V717(reg.cases.path,readFile)!==reg.cases.sha256) throw Error('v717_frozen_cases_changed');
  if (!reg.custody?.path || fileSha256V717(reg.custody.path,readFile)!==reg.independent_answer_custody_hash) throw Error('v717_independent_custody_changed');
  const cases=JSON.parse(Buffer.from(readFile(reg.cases.path)).toString('utf8')),custody=JSON.parse(Buffer.from(readFile(reg.custody.path)).toString('utf8'));
  const ids=reg.jobs.map(j=>j.id).sort(),caseIds=(cases.cases||[]).map(c=>c.id).sort(),custodyIds=(custody.answers||[]).map(a=>a.id).sort();
  if (JSON.stringify(ids)!==JSON.stringify(caseIds) || JSON.stringify(ids)!==JSON.stringify(custodyIds)) throw Error('v717_case_custody_membership_mismatch');
  for (const job of reg.jobs) if (job.candidate_hash!==hashJSON(cases.cases.find(c=>c.id===job.id).candidate)) throw Error('v717_registered_candidate_not_frozen_case');
  if ((cases.cases||[]).some(c=>Object.keys(c).some(key=>['expected_valid','correct_key','defect','label','oracle'].includes(key)))) throw Error('v717_cases_file_leaks_custody');
  for (const artifact of [cases,custody]) if (!(Date.parse(artifact.created_at)>=Date.parse(freeze.created_at))) throw Error('v717_cases_or_custody_predate_freeze');
 }
 if (!preflight || reg.preflight_hash!==hashJSON(preflight)) throw Error('v717_sealed_preflight_required');
 // A validation-only study (fixed candidates, no authoring/repair) preregisters exactly the three review stages and their retries.
 if (reg.validation_only===true && reg.jobs.some(j=>!j.candidate_hash || j.author_body_hash)) throw Error('v717_validation_only_requires_fixed_candidates');
 assertFullBodyPreflightV713(preflight,{...reg,qualification:reg.qualification===true || reg.validation_only===true},{jobs:reg.jobs});
 const fullBound=preflight.requests.reduce((total,row)=>total+maximumRequestMicro(row.provider,row.body,prices),0)/1e6;
 if (Math.abs(reg.standard_full_bound_usd-fullBound)>0.000001) throw Error('v717_full_bound_not_reproducible');
}
export async function openCampaignSessionV717({registration,registry,prices,preflight,ledgerPath='data/pipeline-budget.sqlite',statePath,inventory,secret,readFile,
 network=assertTrustedNetworkV713R3,ledgerFactory=path=>new BudgetLedger(path),storeFactory=(ledger,path,options)=>new FactoryStore(ledger,path,options),
 nativeFactory=options=>createFactoryTransportV713(options),save=saveAtomicArtifact,stopRequested=()=>false}={}) {
 assertRegistrationV717(registration,registry,prices,preflight,readFile?{readFile}:{});
 if (!statePath || !Array.isArray(inventory) || !secret) throw Error('v717_durable_state_inventory_secret_required');
 const state=JSON.parse(readFileSync(statePath,'utf8'));
 if (state.registration_hash!==hashJSON(registration) || !Array.isArray(state.request_keys) || !state.cases || typeof state.cases!=='object') throw Error('v717_state_registration_changed');
 await network(); // DNS/TLS before writable ledger and any financial reservation.
 let ledger,store,claimed=false,closed=false,stopped=false,active=0;
 const persist=()=>{state.updated_at=new Date().toISOString();save(statePath,state);};
 try {
  ledger=ledgerFactory(ledgerPath);ledger.assertHistoryReconciled();
  store=storeFactory(ledger,ledgerPath,{candidateIds:registration.jobs.map(j=>j.id)});store.claim();claimed=true;
  // A Flex capacity refusal happens before inference (settled at zero); the same request then runs once at standard processing.
  const native=nativeFactory({ledger,prices:()=>prices,fetchImpl:longFetch,queueGemini:true,allowFlexFallback:true,realtimeStages:['blind_solution','explanation_support','authoring'],flexStages:['blind_solution','explanation_support','authoring']});
  const recovered=archiveRefusedAttemptsV713R2(native,{ledger,directory:statePath+'.refused-attempts'});
  const keys=new Set(state.request_keys),guard=createCampaignGuardV713({ledger,native:recovered,campaignId:registration.id,candidateIds:registration.jobs.map(j=>j.id),capUsd:registration.cap_usd,prices:()=>prices,keys,
   stopRequested:()=>closed||stopped||stopRequested(),onKey:key=>{state.request_keys.push(key);try{persist();}catch(error){stopped=true;throw error;}}});
  const author=createGenerationTransportV717(guard);
  const seen=new Set(inventory.map(inventoryFingerprint)),inflightIdeas=new Set();
  for (const result of Object.values(state.cases)) if (result.state==='eligible' && result.question) seen.add(inventoryFingerprint(result.question));
  // One ordering idea per registered source, shared across campaigns and restarts.
  recordIdeaAllocations(registration.jobs.filter(job=>job.author_body_hash),{campaignId:registration.id});
  const jobFor=id=>{const job=registration.jobs.find(j=>j.id===id);if(!job)throw Error('v717_candidate_outside_registration');return job;};
  async function recover() {
   for(const key of keys){const row=ledger.db.prepare('SELECT state,provider_id FROM provider_batches WHERE id=?').get(key);if(row?.provider_id && ['submitted','unresolved'].includes(row.state))await recovered.reconcile(key);}
  }
  const session={
   registration_hash:hashJSON(registration),cost:guard.cost,
   async generate(body,options={}) {
    if(closed||stopped)throw Error('v717_session_closed_or_stopped');
    const job=jobFor(bodyCandidateId('openai',body));
    const rawHash=hashJSON(body);
    if(![job.author_body_hash,job.author_retry_body_hash].includes(rawHash) || options.stage!=='authoring' || options.candidate_id && options.candidate_id!==job.id)throw Error('v717_author_body_not_registered');
    return author.generate('openai',body,options);
   },
   async validate(candidate,{passageGroup}={}) {
    if(closed||stopped)throw Error('v717_session_closed_or_stopped');
    const id=candidate.id||candidate.candidate_id||candidate.local_id,job=jobFor(id);
    if(hashJSON(candidate)!==(job.candidate_hash||state.cases[id]?.generated_candidate_hash))throw Error('v717_candidate_payload_not_registered');
    if(hashJSON(passageGroup||null)!==hashJSON(job.passage_group||null))throw Error('v717_passage_membership_not_registered');
    if(['eligible','quarantined','error','held'].includes(state.cases[id]?.state))return structuredClone(state.cases[id]);
    const fingerprint=inventoryFingerprint(candidate);
    if(inflightIdeas.has(fingerprint)) {state.cases[id]={...(state.cases[id]||{}),state:'quarantined',academic_sound:null,reasons:['duplicate_inflight_idea']};persist();return structuredClone(state.cases[id]);}
    inflightIdeas.add(fingerprint);
    state.cases[id]={...(state.cases[id]||{}),state:'validating',candidate_hash:job.candidate_hash};persist();
    try{
     const result=await validateFactoryCandidateV717(candidate,{registry,ledger,transport:guard,secret,seen,passageGroup,
      onBlindFrozen:proof=>{state.cases[id].blind_frozen=proof;persist();}});
     const {error:_staleError,pending_batch_id:_stalePending,...prior}=state.cases[id];
     state.cases[id]={...prior,...result};persist();return structuredClone(state.cases[id]);
    }catch(error){
     // Availability/budget/stop faults pause the study; an unresolved accepted request is held; anything else is a
     // deterministic incomplete review (state error), never an academic rejection and never silently retried.
     const message=String(error.message),availability=providerTransportFaultV713R3(error)||capacityRefusedV713R2(error)||/budget|input_bound|study_draining_stop|factory_worker|pricing|session_closed_or_stopped/.test(message);
     const next=error.batchId?'pending':/uncertain|unresolved/.test(message)?'held':availability?'paused':'error';
     state.cases[id]={...state.cases[id],state:next,pending_batch_id:error.batchId||null,error:message,academic_sound:null,...(next==='error'?{outcome:'review_incomplete'}:{})};persist();throw error;
    }finally{inflightIdeas.delete(fingerprint);}
   },
   recover,async flush(){if(closed||stopped)throw Error('v717_session_closed_or_stopped');await recovered.flush({candidateIds:registration.jobs.map(j=>registration.id+':'+j.id),maxRequests:10});await recover();},
   stop(){stopped=true;},
   close(){if(closed)return;if(active){stopped=true;throw Error('v717_drain_active_operations_before_close');}closed=true;try{persist();}finally{try{if(claimed)store.release();}finally{ledger.close();}}}
  };
  // Authoring outcome is recorded durably. A locally rejected draft (presentation/quote lint) is a generation failure that stays
  // in the denominator; availability faults pause; nothing accepted is re-sent (the guarded transport replays receipts by key).
  session.author=async function(id){
   const job=jobFor(id);if(!job.author_body_hash)throw Error('v717_registered_author_job_required');
   if(state.cases[id]?.generated_candidate)return structuredClone(state.cases[id].generated_candidate);
   if(['quarantined','error','held'].includes(state.cases[id]?.state))return null;
   let candidate;
   try{candidate={...await authorOriginal(job,{registry,transport:{generate:(provider,body,options)=>{if(provider!=='openai')throw Error('v717_author_provider_required');return session.generate(body,options);}}}),generator_version:FACTORY_VERIFIER_VERSION_V717};}
   catch(error){
    const message=String(error.message);
    if(/^author_presentation_lint:/.test(message)){state.cases[id]={...(state.cases[id]||{}),state:'quarantined',outcome:'author_rejected',academic_sound:null,reasons:[message],rejected_draft:error.candidate||null};persist();return null;}
    const availability=providerTransportFaultV713R3(error)||capacityRefusedV713R2(error)||/budget|input_bound|study_draining_stop|factory_worker|pricing|session_closed_or_stopped/.test(message);
    const next=error.batchId?'pending':/uncertain|unresolved/.test(message)?'held':availability?'paused':'error';
    state.cases[id]={...(state.cases[id]||{}),state:next,error:message,academic_sound:null,...(next==='error'?{outcome:'author_incomplete'}:{})};persist();throw error;
   }
   const {error:_staleError,...prior}=state.cases[id]||{};
   state.cases[id]={...prior,state:'authored',generated_candidate:candidate,generated_candidate_hash:hashJSON(candidate)};persist();return structuredClone(candidate);
  };
  // The contract is derived from source files; a mid-session edit must stop dispatch, never silently re-key requests.
  const assertPinned=()=>{if(validationContractV717()!==registration.contract_hash || scorecardPromptHashV717()!==registration.prompt_hash){stopped=true;throw Error('v717_contract_changed_during_session_study_draining_stop');}};
  for(const name of ['author','generate','validate','recover','flush']){const operation=session[name];session[name]=async function(...args){if(closed)throw Error('v717_session_closed');if(name!=='recover')assertPinned();active++;try{return await operation.apply(session,args);}finally{active--;}};}
  return session;
 }catch(error){try{if(claimed)store.release();}finally{ledger?.close();}throw error;}
}
