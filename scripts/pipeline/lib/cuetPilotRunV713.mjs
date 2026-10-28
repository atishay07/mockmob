// Execution engine for the v7.5 measurement pilot. Mirrors campaign C's proven structure (fixed denominator, waves of ten with avoidance of
// earlier approvals, two consecutive waves under 40% yield stop the campaign, one targeted repair then one revalidation, no replacement)
// on the frozen v7.5 contract. Everything that reaches a provider goes through the guard below; the engine itself is provider-agnostic
// (author / validate / repair are injected) so that its rules can be tested with a fake transport.
import {existsSync,readFileSync} from 'node:fs';
import {hashJSON,inventoryFingerprint} from '../../../data/question_factory_policy.mjs';
import {saveAtomicArtifact,drainConcurrent} from './atomicArtifact.mjs';
import {assertCampaignBudget,maximumRequestMicro,requestNeedsReservation} from './campaignExecutionV7.mjs';
import {bodyCandidateId} from './scopedAccounting.mjs';
import {acceptedNativeRequestV73} from './freshCuetReadinessV73Guards.mjs';
import {stopsFactory} from './factoryFailure.mjs';
import {PILOT_CONTRACT,PILOT_DENOMINATOR,PILOT_PER_SUBJECT,PILOT_SUBJECTS,PILOT_WAVE_SIZE,PILOT_CAP_USD_MAX,WEAK_WAVE_YIELD,WEAK_WAVES_TO_STOP,SYSTEMIC_ERRORS_TO_STOP} from './cuetPilotV75Plan.mjs';

export const PILOT_STATE_CONTRACT='cuet-pilot-v75-state-v1';
export const PILOT_CONCURRENCY=4;
export const TERMINAL_STATES=Object.freeze(['eligible','quarantined']);
export const isTerminal=job=>TERMINAL_STATES.includes(job?.state);
// Luna Flex is preferred (billed lower, standard-tier fallback is built into the transport); Gemini is realtime so a wave is synchronous.
export const PILOT_TRANSPORT_PROFILE=Object.freeze({name:'cuet-pilot-v75-luna-realtime-flex-gemini-realtime-wave10-v1',waves:PILOT_WAVE_SIZE,
  providers:Object.freeze({openai:Object.freeze({model:'gpt-6-luna',mode:'realtime',flex:'preferred_with_standard_fallback'}),gemini:Object.freeze({model:'gemini-3.8-flash',mode:'realtime'})}),
  luna_flex_stages:Object.freeze(['authoring','blind_solution','explanation_support','repair']),tools:'disabled'});

// ---------------------------------------------------------------- registration

export function assertPilotRegistration(prereg,campaign){
  const fail=reason=>{throw Error('pilot_registration_invalid:'+reason);};
  if(prereg?.contract!==PILOT_CONTRACT||prereg.pilot_id!==campaign?.id)fail('contract_or_id');
  const jobs=campaign.jobs;
  if(!Array.isArray(jobs)||jobs.length!==PILOT_DENOMINATOR||prereg.denominator!==PILOT_DENOMINATOR||campaign.denominator!==PILOT_DENOMINATOR)fail('denominator_must_be_40');
  if(new Set(jobs.map(j=>j.id)).size!==PILOT_DENOMINATOR)fail('duplicate_ids');
  for(const subject of PILOT_SUBJECTS)if(jobs.filter(j=>j.subject===subject).length!==PILOT_PER_SUBJECT)fail('per_subject_must_be_10:'+subject);
  if(jobs.some(j=>!PILOT_SUBJECTS.includes(j.subject)))fail('unknown_subject');
  if(prereg.measurement_only!==true||prereg.publication_policy!=='never'||campaign.measurement_only!==true||campaign.publication_policy!=='never')fail('measurement_only_publication_never_required');
  if(prereg.topology!=='dual_blind')fail('topology_must_be_dual_blind');
  if(prereg.maximum_repairs_per_candidate!==1||campaign.maximum_repairs_per_candidate!==1)fail('one_repair_maximum_required');
  if(prereg.no_regeneration!==true||prereg.no_replacement_after_registration!==true)fail('no_replacement_required');
  if(prereg.waves?.size!==PILOT_WAVE_SIZE||prereg.waves?.weak_yield_below!==WEAK_WAVE_YIELD||prereg.waves?.consecutive_weak_waves_stop!==WEAK_WAVES_TO_STOP)fail('wave_rules_changed');
  if(!Number.isFinite(prereg.cap_usd)||prereg.cap_usd<=0||prereg.cap_usd>PILOT_CAP_USD_MAX)fail('cap_must_not_exceed_usd_3');
  if(jobs.some(j=>!Array.isArray(j.source_refs)||!j.source_refs.length||!/^[ABCD]$/.test(j.requested_answer_position||'')))fail('every_brief_needs_sources_and_requested_position');
  return true;
}
export function expectedFreshState(campaign){
  return {contract:PILOT_STATE_CONTRACT,campaign_id:campaign.id,created_at:new Date().toISOString(),updated_at:null,jobs:Object.fromEntries(campaign.jobs.map(j=>[j.id,{...j}])),
    waves:[],weak_waves:0,circuit_open:false,systemic_errors:0,request_keys:[],stop_reason:null,runs:[],tooling_changes:[]};
}
export function loadPilotState(path,campaign){
  if(!existsSync(path))return expectedFreshState(campaign);
  const state=JSON.parse(readFileSync(path,'utf8'));
  if(state.contract!==PILOT_STATE_CONTRACT||state.campaign_id!==campaign.id)throw Error('pilot_state_binding_mismatch');
  const ids=new Set(campaign.jobs.map(j=>j.id));
  if(Object.keys(state.jobs).length!==ids.size||Object.keys(state.jobs).some(id=>!ids.has(id)))throw Error('pilot_state_denominator_mismatch');
  return state;
}

// ---------------------------------------------------------------- spend accounting and the guard

// Committed campaign spend from the exact request keys this campaign issued (indexed lookups; the ledger can be very large).
export function createKeyedCost(db,keys){
  return {committedMicro(){
    const list=[...keys];let total=0;
    for(let i=0;i<list.length;i+=400){
      const chunk=list.slice(i,i+400),marks=chunk.map(()=>'?').join(',');
      const rows=db.prepare(`SELECT DISTINCT r.id,r.state,r.reserved,r.actual FROM requests r WHERE r.id IN
        (SELECT reservation_id FROM provider_requests WHERE id IN (${marks}) UNION SELECT reservation_id FROM provider_batches WHERE id IN (${marks}))`).all(...chunk,...chunk);
      total+=rows.reduce((n,r)=>n+(r.state==='settled'?(r.actual||0):Math.max(r.reserved,r.actual||0)),0);
    }
    return total;
  }};
}

// Every provider request: campaign scope, accepted-key refusal, persisted ledger reservation (inside the native transport, before the network call),
// campaign cap check against the exact committed spend plus this request's maximum. Never batch, never tools, never an unregistered candidate.
export function createPilotGuard({ledger,native,pilotId,candidateIds,capUsd,prices,keys,onKey=()=>{},stopRequested=()=>false}){
  if(!(capUsd>0)||capUsd>PILOT_CAP_USD_MAX)throw Error('pilot_cap_must_not_exceed_usd_3');
  const prefix=pilotId+':',scoped=new Set(candidateIds),cost=createKeyedCost(ledger.db,keys);
  const record=key=>{if(!keys.has(key)){keys.add(key);onKey(key);}};
  async function generate(provider,body,options={}){
    if(!['openai','gemini'].includes(provider))throw Error('pilot_provider_unsupported');
    if((body?.tools||[]).length||(options.toolCalls||0)!==0)throw Error('pilot_tools_disabled');
    if(!options.key)throw Error('pilot_idempotency_key_required');
    const id=bodyCandidateId(provider,body)||(typeof options.candidate_id==='string'?options.candidate_id.replace(prefix,''):null);
    if(!id||!scoped.has(id))throw Error('pilot_candidate_outside_campaign');
    const key=hashJSON({pilot:pilotId,parent:options.key});
    if(acceptedNativeRequestV73(ledger.db,key))throw Object.assign(new Error('accepted_provider_request_exists_no_resubmit'),{nativeKey:key,dispatchState:'accepted'});
    const call=()=>native.generate(provider,body,{...options,key,batch:false,purpose:'candidate',candidate_id:prefix+id}).catch(error=>{
      error.nativeKey=key;error.dispatchState=acceptedNativeRequestV73(ledger.db,key)?'accepted':'guard_blocked';throw error;});
    // A saved complete receipt or cached response replays without a new reservation or any network call.
    if(!requestNeedsReservation(ledger,key)){record(key);return call();}
    if(stopRequested())throw Object.assign(new Error('study_draining_stop'),{nativeKey:key,dispatchState:'guard_blocked'});
    try{assertCampaignBudget(cost.committedMicro(),maximumRequestMicro(provider,body,prices()),capUsd);}
    catch(error){error.nativeKey=key;error.dispatchState='guard_blocked';throw error;}
    record(key);
    return call();
  }
  return Object.freeze({generate,cost,profile:PILOT_TRANSPORT_PROFILE});
}

// ---------------------------------------------------------------- rules

// One targeted repair is only worth buying for a defect a rewrite can remove (a failed gate, a preparation-value finding or a key contradiction).
export const repairable=result=>Boolean(result?.reasons?.some(r=>String(r).startsWith('failed:')||r==='blind_key_contradiction'||r==='independent_key_contradiction'));
export const SYSTEMIC_ERROR_PATTERN=/provider_http_5\d\d|fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|UND_ERR|operation was aborted|timed out|TimeoutError/i;
export function isStopError(error,ledger){
  const message=String(error?.message||error);
  // An oversize request is a pipeline/preflight failure: pause without burning remaining candidates.
  if(/input_bound/.test(message))return true;
  return /study_draining_stop|campaign_budget_exhausted|budget_exhausted/.test(message)||stopsFactory(error,ledger);
}

// Free, deterministic closure applied at the end of each wave and again at export: a duplicate of an earlier approved item and a passage group
// with a rejected sibling are withheld. It never turns a rejection into an approval.
export function applyClosure(jobs,{save=()=>{}}={}){
  const seen=new Map();
  for(const job of jobs){
    if(job.state!=='eligible')continue;
    const fingerprint=inventoryFingerprint(job.candidate);
    if(seen.has(fingerprint)){withhold(job,'duplicate_of:'+seen.get(fingerprint));save(job);}else seen.set(fingerprint,job.id);
  }
  const groups=new Set(jobs.filter(j=>j.passage_group_id).map(j=>j.passage_group_id));
  for(const group of groups){
    const siblings=jobs.filter(j=>j.passage_group_id===group);
    if(siblings.some(j=>j.state==='quarantined'))for(const job of siblings.filter(j=>j.state==='eligible')){withhold(job,'passage_group_sibling_rejected');save(job);}
  }
}
function withhold(job,reason){job.state='quarantined';job.result={...(job.result||{}),state:'quarantined',reasons:[reason],withheld_after_eligible:true};}

// ---------------------------------------------------------------- engine

export async function runPilotV713({campaign,state,saveState,deps,log=()=>{},stopRequested=()=>false,ledger=null,concurrency=PILOT_CONCURRENCY}){
  const jobs=campaign.jobs.map(j=>state.jobs[j.id]);
  const checkpoint=()=>{state.updated_at=new Date().toISOString();saveState(state);};
  const quarantine=(job,reasons,result={})=>{
    delete job.pending_batch;job.state='quarantined';job.result={...result,state:'quarantined',reasons:reasons.length?reasons:['unspecified']};
    checkpoint();log({candidate:job.id,subject:job.subject,state:'quarantined',reasons:job.result.reasons.slice(0,3)});
  };
  const approvedBodies=job=>jobs.filter(a=>a.state==='eligible'&&a.candidate&&a.subject===job.subject&&a.chapter===job.chapter).map(a=>a.candidate.body).slice(-12);
  // Avoidance is sealed once, before the first authoring request of a job, so a resumed run derives the identical request key.
  const sealAvoidance=job=>{if(job.avoidance_sealed)return;const same=approvedBodies(job);if(same.length)job.avoidance=[...new Set([...(job.avoidance||[]),...same])].slice(-40);job.avoidance_sealed=true;checkpoint();};

  async function processJob(job){
    if(isTerminal(job))return;
    try{
      let pass=1;
      if(job.state==='repair_started')pass=0;                       // resumed inside the single repair
      else if(['repaired','revalidating'].includes(job.state))pass=2; // resumed after the repair
      if(!job.candidate&&pass===1){
        sealAvoidance(job);job.state='authoring';checkpoint();
        try{job.candidate=await deps.author(job);job.state='generated';job.author_note=null;}
        catch(error){
          if(isStopError(error,ledger))throw error;
          if(error?.code==='original_author_abstained'){quarantine(job,['original_author_abstained:'+String(error.message).slice(0,200)],{failed_stage:'authoring'});return;}
          if(error?.candidate&&typeof error.candidate==='object'&&error.candidate.body){job.candidate=error.candidate;job.author_failure=error.message;job.state='generated';}
          else{quarantine(job,[error.message],{failed_stage:'authoring',provider_error:SYSTEMIC_ERROR_PATTERN.test(error.message)});return;}
        }
        checkpoint();
      }
      if(!job.candidate){quarantine(job,['author_candidate_missing'],{failed_stage:'authoring'});return;}
      for(;pass<=2;){
        if(pass===0){
          // Repair entitlement is persisted (ledger.claimRepair) and the state is checkpointed before the call.
          const reasons=(job.first_result?.reasons||[]).concat(job.first_result?.failure_details||[]);
          try{job.candidate=await deps.repair(job.candidate,reasons,job);}
          catch(error){if(isStopError(error,ledger))throw error;quarantine(job,['repair_failed:'+error.message],{failed_stage:'repair',first_result:job.first_result});return;}
          job.state='repaired';checkpoint();pass=2;continue;
        }
        const prepared=deps.prepare(job.candidate);
        job.candidate=prepared.candidate;if(prepared.notes.length)job.normalization=[...new Set([...(job.normalization||[]),...prepared.notes])];
        if(!prepared.quote.passed){quarantine(job,[prepared.quote.reason||'author_evidence_quote_not_in_sources'],{failed_stage:'author_quote_integrity',author_quote_integrity:prepared.quote});return;}
        job.quote_methods=prepared.quote.methods;
        job.state=pass===1?'validating':'revalidating';checkpoint();
        const result=await deps.validate(job.candidate,job);
        if(result.state==='eligible'){job.candidate=result.question||job.candidate;job.result={state:'eligible',...(job.first_result?{first_result:job.first_result}:{})};job.state='eligible';delete job.pending_batch;checkpoint();log({candidate:job.id,subject:job.subject,state:'eligible',repaired:job.repair_count>0});return;}
        if(pass===1&&!job.repair_count&&repairable(result)){
          job.first_result=result;job.repair_count=1;job.state='repair_started';checkpoint();pass=0;continue;
        }
        quarantine(job,result.reasons||['validation_failed'],{...result,state:'quarantined',...(job.first_result?{first_result:job.first_result}:{})});return;
      }
    }catch(error){
      if(error?.message==='provider_batch_pending' && error.batchId){job.pending_batch=error.batchId;checkpoint();return;}
      if(isStopError(error,ledger)){job.last_stop=error.message;checkpoint();throw error;}
      quarantine(job,[error.message],{failed_stage:job.state,provider_error:SYSTEMIC_ERROR_PATTERN.test(error.message)});
    }
  }

  const waveCount=Math.ceil(jobs.length/PILOT_WAVE_SIZE);
  const run={started_at:new Date().toISOString(),pid:process.pid,outcome:null};state.runs.push(run);checkpoint();
  let status='complete';
  try{
    for(let w=0;w<waveCount;w++){
      const window=jobs.slice(w*PILOT_WAVE_SIZE,(w+1)*PILOT_WAVE_SIZE);
      if(window.every(isTerminal)&&state.waves[w])continue;
      if(state.circuit_open){status='circuit_open';break;}
      if(stopRequested()){status='signal';break;}
      const pending=window.filter(j=>!isTerminal(j));
      for(const job of pending)if(!job.candidate)sealAvoidance(job); // every job of the wave sees exactly what earlier waves approved
      log({wave:w+1,pending:pending.length});
      let failure=null;
      try{
        await drainConcurrent(pending,async job=>{
          await processJob(job);
          if(job.result?.provider_error===true&&job.state==='quarantined')state.systemic_errors++;
          else if(isTerminal(job))state.systemic_errors=0;
          if(state.systemic_errors>=SYSTEMIC_ERRORS_TO_STOP){state.stop_reason='systemic_provider_failure';checkpoint();throw Object.assign(new Error('systemic_provider_failure'),{systemic:true});}
        },{concurrency,shouldStop:()=>stopRequested()});
      }catch(error){failure=error;}
      if(failure){status=failure.systemic?'systemic_provider_failure':isStopError(failure,ledger)?(/budget|cap/.test(failure.message)?'budget_stop':'stopped'):'error';
        state.stop_reason=status;run.error=failure.message;checkpoint();if(status==='error')throw failure;break;}
      if(!window.every(isTerminal)){status=window.some(j=>j.pending_batch)?'pending':stopRequested()?'signal':'stopped';break;}
      applyClosure(jobs,{save:checkpoint});
      const ok=window.filter(j=>j.state==='eligible').length,done=window.length,yieldRate=done?ok/done:0;
      state.weak_waves=yieldRate<WEAK_WAVE_YIELD?state.weak_waves+1:0;
      state.waves[w]={index:w+1,job_ids:window.map(j=>j.id),terminal:done,approved:ok,yield:yieldRate,weak:yieldRate<WEAK_WAVE_YIELD,finished_at:new Date().toISOString()};
      log({wave:w+1,terminal:done,approved:ok,yield:yieldRate});
      if(state.weak_waves>=WEAK_WAVES_TO_STOP){state.circuit_open=true;state.stop_reason='two_consecutive_waves_under_40_percent_yield';checkpoint();log({circuit_open:state.stop_reason,remaining_untouched:jobs.filter(j=>!isTerminal(j)).length});status='circuit_open';break;}
      checkpoint();
    }
  }finally{run.outcome=status;run.finished_at=new Date().toISOString();if(status==='complete')state.stop_reason=state.stop_reason||'complete';checkpoint();}
  return {status,terminal:jobs.filter(isTerminal).length,approved:jobs.filter(j=>j.state==='eligible').length,untouched:jobs.filter(j=>j.state==='queued').length};
}

export function stateSaver(path){return state=>saveAtomicArtifact(path,state);}
