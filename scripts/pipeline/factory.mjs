import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from 'node:process';
import { readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync } from 'node:fs';
import { resolve,join,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { BudgetLedger } from './lib/budgetLedger.mjs';
import { FactoryStore } from './lib/factoryStore.mjs';
import { createFactoryTransport,BatchPending,responseJSON } from './lib/factoryTransport.mjs';
import { sourceReadiness,registerSourcePack } from './lib/sourcePacks.mjs';
import { authorCandidate,authorOriginal,validateFactoryCandidate,repairFactoryCandidate,publishFactoryQuestion,publishFactoryGroup } from './lib/factoryCore.mjs';
import { lunaBody,FACTORY_VERIFIER_VERSION } from './lib/factoryEvidence.mjs';
import { currentRegistry } from '../../data/evidence_registry.js';
import { FACTORY_SUBJECTS,FACTORY_PILOT_TARGET,inventoryFingerprint,hashJSON,factoryCalibrationReady } from '../../data/question_factory_policy.mjs';
import { mechanicalScreen,reviewBundles } from './lib/subscriptionScreening.mjs';
import { runFactoryCalibration } from './lib/factoryCalibration.mjs';
import { readBankSnapshot,readAllRows } from './lib/bankSnapshot.mjs';
import { planFactoryJobs,ACTIVE_JOB_STATES } from './lib/factoryQueue.mjs';
import { providerPreflight,providerBlocker } from './tools/providerPreflight.mjs';
import { factoryCostReport } from './lib/factoryCosts.mjs';
import { localPilotStep } from './lib/localFactoryPilot.mjs';
import { createFactoryProfileV73,assertFactoryProfileV73 } from './lib/factoryProfileV73.mjs';
import { createFactoryProfileV74,assertFactoryProfileV74 } from './lib/factoryProfileV74.mjs';
import { validateFactoryCandidateV73 } from './lib/verifyV73.mjs';
import { validateFactoryCandidateV74 } from './lib/verifyV74.mjs';
import { authorOriginalV74,OriginalAuthorAbstentionV74 } from './lib/originalAuthorPolicyV74.mjs';
import { assertQueueStagingTarget,assertPinnedProfiledQueueJob,assertProfiledPublicationV73,assertProfiledPassageGroupV73,prepareProfiledQueueRowsV73,reconstructProfiledOriginalBrief,routeQueueValidation,selectProfiledWaveV73,passagePublicationState,oversizedProfiledPassageGroupsV73,requiresProfiledQueueLeaseV73,hasValidationProfilePinV73,filterProfiledQueueInventoryV73 } from './lib/profiledFactoryQueueV73.mjs';
import { publishInspectedUnit,withheldJobPatch } from './lib/publishTimeInspection.mjs';
import { assertCampaignBudget,maximumRequestMicro,requestNeedsReservation,campaignCommittedMicro } from './lib/campaignExecutionV7.mjs';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const save=(path,value)=>{mkdirSync(dirname(resolve(path)),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2));};
const runtime=resolve('data/question-factory-runtime');
const dbClient=()=>createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function stagingQueueClient() {
  if(!process.argv.includes('--staging'))throw new Error('explicit_staging_target_required');
  if(!existsSync('.env.staging'))throw new Error('staging_credentials_required');
  loadEnvFile('.env.staging');
  const url=process.env.STAGING_SUPABASE_URL,key=process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  assertQueueStagingTarget({staging:true,url,key,productionUrl:process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL});
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function bankRows(db) {
  return readBankSnapshot(db);
}
function assertCurrentV73Profile(profile,{registry=currentRegistry(),manifest=read('data/calibration_manifest.json')}={}) {
  return assertFactoryProfileV73(profile,{manifest,registry});
}
function assertCurrentV74Profile(profile,{registry=currentRegistry(),manifest=read('data/calibration_manifest.json')}={}) {
  return assertFactoryProfileV74(profile,{manifest,registry});
}
function assertCurrentProfile(profile,context) {
  if(profile?.profile_version==='factory-validation-profile-v74-v1')return assertCurrentV74Profile(profile,context);
  return assertCurrentV73Profile(profile,context);
}
async function readProfiledQueueRows(db,states) {
  const rows=[],pageSize=100;for(let offset=0;;offset+=pageSize){
    let query=filterProfiledQueueInventoryV73(db.from('question_factory_jobs').select('*'));
    if(Array.isArray(states))query=query.in('state',states);
    const {data,error}=await query.order('created_at').range(offset,offset+pageSize-1);
    if(error){const code=typeof error.code==='string'?error.code:'unknown';throw new Error(`factory_profiled_job_inventory_required:${code}`);}
    const page=Array.isArray(data)?data:[];rows.push(...page.filter(hasValidationProfilePinV73));if(page.length<pageSize)break;
  }return rows;
}
async function enqueueProfiled(version='v73') {
  const campaignPath=flagValue('--campaign-file'),profilePath=flagValue('--profile-file');
  if(!campaignPath||!profilePath)throw new Error('factory_campaign_and_profile_files_required');
  const campaign=read(campaignPath),profile=read(profilePath),registry=currentRegistry(),manifest=read('data/calibration_manifest.json');
  const assertCurrent=version==='v74'?assertCurrentV74Profile:assertCurrentV73Profile;
  assertCurrent(profile,{registry,manifest});
  const db=stagingQueueClient();
  const existing=await readAllRows(db,'question_factory_jobs');
  const inventory=await readBankSnapshot(db),existingIds=existing.map(row=>row.id),reservedIds=[...(registry.examples||[]).map(row=>row.id),...inventory.map(row=>row.id)];
  const rows=prepareProfiledQueueRowsV73(campaign,profile,{registry,existingIds,reservedIds});
  const {data:already,error:campaignError}=await db.from('question_factory_jobs').select('id').filter('generation_brief->validation_profile->>campaign_id','eq',profile.campaign_id).limit(1);
  if(campaignError)throw new Error('factory_campaign_idempotency_lookup_required');
  if(already?.length)throw new Error('factory_campaign_already_enqueued');
  assertCurrent(profile);
  if(rows.length){const {error:insertError}=await db.from('question_factory_jobs').insert(rows);if(insertError)throw new Error(`factory_profiled_enqueue_failed:${insertError.code}`);}
  console.log(JSON.stringify({campaign_id:profile.campaign_id,queued:rows.length,validation_profile:profile.profile_sha256,staging:true}));
}
function flagValue(name) {const at=process.argv.indexOf(name);return at>=0?process.argv[at+1]||null:null;}
async function runProfiledQueueWorkerV73({once=false}={}) {
  const db=stagingQueueClient(),registry=currentRegistry();
  let stopped=false;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let ledger,store,transport,heartbeat,heartbeatInFlight=null;
  try {
    do {
      if(store)store.claim();
      const {data:control,error:controlError}=await db.from('question_factory_control').select('paused,publication_enabled,phase').eq('id',1).single();
      if(controlError)throw new Error('factory_control_unavailable');
      if(control.paused){console.log(JSON.stringify({queue:'v73',paused:true,paid_calls:0}));break;}
      const scoped=await readProfiledQueueRows(db,['queued','waiting','validating','repairing','eligible']);
      const allProfiled=await readProfiledQueueRows(db);
      const current=[],invalid=[];
      for(const row of scoped){
        try{const profile=assertPinnedProfiledQueueJob(row,{assertProfile:p=>assertCurrentProfile(p)});current.push({row,profile});}
        catch(e){invalid.push({row,error:e.message});}
      }
      const oversizedGroups=oversizedProfiledPassageGroupsV73(allProfiled,registry,10),oversizedIds=new Set([...oversizedGroups.values()].flat().map(row=>row.id));
      const invalidIds=new Set(invalid.map(item=>item.row.id));
      for(const row of scoped)if(oversizedIds.has(row.id)&&!invalidIds.has(row.id))invalid.push({row,error:`factory_passage_group_wave_size_exceeded:${row.passage_group_id}`});
      const validCurrent=current.filter(item=>!oversizedIds.has(item.row.id));
      const wave=selectProfiledWaveV73(validCurrent.map(item=>item.row),10);
      const waveIds=new Set(wave.map(row=>row.id));
      const waveCurrent=validCurrent.filter(item=>waveIds.has(item.row.id));
      if((waveCurrent.length||validCurrent.some(item=>item.row.state==='eligible')||invalid.length)&&!ledger){
        const path=resolve(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');ledger=new BudgetLedger(path);store=new FactoryStore(ledger,path);store.claim();
        transport=createFactoryTransport({ledger,queueOpenAI:true,queueGemini:true});
        store.inventory(await readBankSnapshot(db),inventoryFingerprint);
        heartbeat=setInterval(()=>{
          try{store.claim();}catch{stopped=true;return;}
          if(!heartbeatInFlight)heartbeatInFlight=db.rpc('claim_question_factory',{p_worker:store.identity}).then(({data,error})=>{if(error||!data)stopped=true;}).catch(()=>{stopped=true;}).finally(()=>{heartbeatInFlight=null;});
        },30000);
      }
      if(requiresProfiledQueueLeaseV73({authoringCount:waveCurrent.length,invalidCount:invalid.length,eligibleCount:validCurrent.filter(item=>item.row.state==='eligible').length})){
        const {data:lease,error:leaseError}=await db.rpc('claim_question_factory',{p_worker:store.identity});if(leaseError||!lease)throw new Error('factory_bound_worker_required');
      }
      for(const {row,error} of invalid)await updateJob(db,row.id,{state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:[error]}});
      if(!waveCurrent.length)console.log(JSON.stringify({queue:'v73',profiled_jobs:scoped.length,eligible_profile_jobs:current.filter(item=>item.row.state==='eligible').length,profile_invalid:invalid.length,paid_calls:0}));
      const blockedCampaigns=new Set();
      for(const {row,profile} of waveCurrent){
        if(stopped)break;
        if(blockedCampaigns.has(profile.campaign_id))continue;
        if(row.state==='eligible')continue;
        let job=row,brief,candidate=job.candidate,result,repairState=job.generation_brief?.v73_worker_state?.repair_state||null;
        const briefWithRepairState=state=>({...job.generation_brief,v73_worker_state:{...(job.generation_brief?.v73_worker_state||{}),repair_state:state}});
        try{
          assertCurrentProfile(profile);
          if(job.provider_batch_id)await transport.reconcile(job.provider_batch_id);
          brief=reconstructProfiledOriginalBrief(job,profile);
          const briefCap=Number(job.generation_brief?.campaign_cap_usd),campaignIds=job.generation_brief?.campaign_candidate_ids,denominator=job.generation_brief?.campaign_denominator;
          const persistedCampaign=allProfiled.filter(item=>item.generation_brief?.validation_profile?.campaign_id===profile.campaign_id);
          if(!Number.isFinite(briefCap)||briefCap<=0||briefCap>50||!Array.isArray(campaignIds)||campaignIds.length!==denominator||denominator<1||denominator>100||
             new Set(campaignIds).size!==denominator||persistedCampaign.length!==denominator||campaignIds.some(id=>!persistedCampaign.some(item=>item.id===id))||
             persistedCampaign.some(item=>item.generation_brief?.campaign_denominator!==denominator||item.generation_brief?.campaign_cap_usd!==briefCap||
               JSON.stringify(item.generation_brief?.campaign_candidate_ids)!==JSON.stringify(campaignIds)))throw new Error('factory_campaign_budget_bound_required');
          const priceBook=read('data/pipeline-prices.json');
          const jobTransport={generate:(provider,body,options={})=>{
            if(requestNeedsReservation(ledger,options.key))assertCampaignBudget(campaignCommittedMicro(ledger,campaignIds),maximumRequestMicro(provider,body,priceBook,{batch:true}),briefCap);
            return transport.generate(provider,body,{...options,purpose:'candidate',candidate_id:job.id});
          }};
          if(!candidate){candidate=profile.profile_version==='factory-validation-profile-v74-v1'
              ?await authorOriginalV74(authorOriginal,brief,{registry,transport:jobTransport})
              :await authorOriginal(brief,{registry,transport:jobTransport});
            if(candidate.provenance?.kind!=='original_practice'||candidate.provenance?.anchor_id!==null||candidate.family_id!==brief.family_id)throw new Error('factory_profiled_author_identity_mismatch');await updateJob(db,job.id,{candidate,state:'validating',stage:'validation',provider_batch_id:null,batch_key:null});}
          if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
          store.remember(inventoryFingerprint(candidate),job.id);
          const validate=async value=>{
            return routeQueueValidation(job,value,{assertProfile:p=>assertCurrentProfile(p),
              validateV73:(candidate)=>validateFactoryCandidateV73(candidate,{registry,ledger,transport:jobTransport,calibrationPurpose:false,seen:new Set()}),
              validateV74:(candidate)=>validateFactoryCandidateV74(candidate,{registry,ledger,transport:jobTransport,calibrationPurpose:false,seen:new Set()}),
              validateLegacy:()=>{throw new Error('profiled_queue_legacy_fallback_forbidden');}});
          };
          if(repairState==='pending'){
            candidate=await repairFactoryCandidate(candidate,job.result?.reasons||[],{registry,ledger,transport:jobTransport});
            repairState='complete';
            await updateJob(db,job.id,{candidate,state:'validating',stage:'revalidation',attempt:1,generation_brief:briefWithRepairState('complete'),provider_batch_id:null,batch_key:null});
            result=await validate(candidate);
          }else {
            result=await validate(candidate);
            const repairable=result.state==='quarantined'&&job.attempt===0&&result.reasons?.some(reason=>/failed:|key_contradiction/.test(reason));
            if(repairable){
              repairState='pending';
              await updateJob(db,job.id,{candidate,state:'repairing',stage:'repair',attempt:1,generation_brief:briefWithRepairState('pending'),result});
              candidate=await repairFactoryCandidate(candidate,[...(result.reasons||[]),...(result.failure_details||[])],{registry,ledger,transport:jobTransport});
              repairState='complete';
              await updateJob(db,job.id,{candidate,state:'validating',stage:'revalidation',attempt:1,generation_brief:briefWithRepairState('complete'),provider_batch_id:null,batch_key:null});
              result=await validate(candidate);
            }
          }
          if(result.state==='eligible'){
            const signed=result.question;assertCurrentProfile(profile);assertProfiledPublicationV73(signed,profile,{assertProfile:p=>assertCurrentProfile(p)});
            await updateJob(db,job.id,{candidate:signed,result,state:'eligible',stage:'publication_gate',provider_batch_id:null,batch_key:null});
          }else await updateJob(db,job.id,{candidate,result,state:'quarantined',stage:'complete',provider_batch_id:null,batch_key:null});
        }catch(e){
          if(e instanceof BatchPending)await updateJob(db,job.id,{candidate,state:repairState==='pending'?'repairing':'waiting',stage:e.stage||'provider_pending',generation_brief:briefWithRepairState(repairState),attempt:repairState==='complete'||repairState==='pending'?1:job.attempt,provider_batch_id:e.batchId,batch_key:e.batchId});
          else if(e instanceof OriginalAuthorAbstentionV74){await updateJob(db,job.id,{candidate:e.candidate,state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:['original_author_abstained'],candidate_id:e.candidate_id,author_response:e.candidate}});}
          else if(e.message==='campaign_budget_exhausted'){blockedCampaigns.add(profile.campaign_id);await updateJob(db,job.id,{candidate,state:'waiting',stage:'campaign_budget_cap',result:{reasons:[e.message]}});}
          else if(/budget|pricing|reconciliation|lifetime|worker_already_running/.test(e.message)){await updateJob(db,job.id,{candidate,state:'waiting',stage:'budget_or_worker_guard',result:{reasons:[e.message]}});stopped=true;}
          else await updateJob(db,job.id,{candidate,state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:[e.message]}});
        }
      }
      if(transport&&waveIds.size)await transport.flush({candidateIds:[...waveIds],maxRequests:10});
      const profileRows=await readProfiledQueueRows(db,['eligible']);
      const publicationInventory=await readProfiledQueueRows(db);
      if(!control.paused&&control.publication_enabled&&control.phase!=='pilot'){
        const handled=new Set();
        for(const row of profileRows){
          if(handled.has(row.id))continue;
          if(row.passage_group_id){
            const campaignRows=publicationInventory.filter(member=>member.generation_brief?.validation_profile?.campaign_id===row.generation_brief?.validation_profile?.campaign_id);
            const expected=registry.passage_groups?.[row.passage_group_id]?.candidate_ids||[];
            const readiness=passagePublicationState([row],campaignRows,row.passage_group_id,expected);
            if(readiness.state==='waiting')continue;
            const members=readiness.rows.filter(member=>['eligible','published'].includes(member.state));
            if(readiness.state==='quarantined'){for(const member of readiness.rows.filter(member=>member.state!=='published'))await updateJob(db,member.id,{state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:['passage_group_sibling_quarantined']}});continue;}
            if(readiness.state==='blocked'){for(const member of members.filter(member=>member.state!=='published'))await updateJob(db,member.id,{state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:['passage_group_membership_mismatch']}});continue;}
            let publishError=null,outcome=null;
            try{const p=assertPinnedProfiledQueueJob(row,{assertProfile:x=>assertCurrentProfile(x)});assertProfiledPassageGroupV73(members,p,{assertProfile:x=>assertCurrentProfile(x)});
              // Deterministic idea inspection against the current staging inventory, immediately before the group publishes.
              outcome=await publishInspectedUnit({rows:members,readInventory:()=>readBankSnapshot(db),registry,publish:kept=>publishFactoryGroup(kept.map(m=>m.candidate),db,registry)});}
            catch(e){publishError=e;}
            if(!publishError&&outcome.status==='inspection_failed'){for(const member of members)handled.add(member.id);console.log(JSON.stringify({queue:'v73',publish_time_inspection:'failed_closed',group:row.passage_group_id,reason:outcome.error}));continue;}
            if(!publishError&&outcome.status==='withheld'){for(const member of members){handled.add(member.id);if(member.state!=='published')await updateJob(db,member.id,withheldJobPatch(member,outcome));}continue;}
            if(publishError){
              // The RPC is transactional and idempotent when every job already has a publication.
              // If any row was previously marked published, leave the group recoverable for a full retry.
              if(members.some(member=>member.state==='published'))continue;
              for(const member of members){handled.add(member.id);await updateJob(db,member.id,{state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:[publishError.message]}});}
              continue;
            }
            // Do not quarantine siblings if one redundant queue-state update is interrupted.
            for(const member of members){handled.add(member.id);await updateJob(db,member.id,{state:'published',stage:'complete'});}
          }else{
            try{const p=assertPinnedProfiledQueueJob(row,{assertProfile:x=>assertCurrentProfile(x)});assertProfiledPublicationV73(row.candidate,p,{assertProfile:x=>assertCurrentProfile(x)});
              const outcome=await publishInspectedUnit({rows:[row],readInventory:()=>readBankSnapshot(db),registry,publish:()=>publishFactoryQuestion(row.candidate,row.id,db)});
              handled.add(row.id);
              if(outcome.status==='published')await updateJob(db,row.id,{state:'published',stage:'complete'});
              else if(outcome.status==='withheld')await updateJob(db,row.id,withheldJobPatch(row,outcome));
              else console.log(JSON.stringify({queue:'v73',publish_time_inspection:'failed_closed',id:row.id,reason:outcome.error}));}
            catch(e){handled.add(row.id);await updateJob(db,row.id,{state:'quarantined',stage:'complete',result:{state:'quarantined',reasons:[e.message]}});}
          }
        }
      }
      console.log(JSON.stringify({queue:'v73',campaigns:[...new Set(waveCurrent.map(x=>x.profile.campaign_id))],profiled_jobs:scoped.length,processed:waveCurrent.length,eligible:profileRows.length,publication_enabled:control.publication_enabled,paid_calls:'bounded by persistent ledger; no new dispatch when paused'}));
      if(once||stopped)break;await new Promise(r=>setTimeout(r,30000));
    }while(!stopped);
  }finally{clearInterval(heartbeat);await heartbeatInFlight;process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store?.release();ledger?.close();}
}
async function enqueueJobs(db,registry,phase,perSubject=50,pilotTarget=FACTORY_PILOT_TARGET) {
  const existing=await readAllRows(db,'question_factory_jobs'),publications=await allPublications(db),bank=await bankRows(db);
  const jobs=planFactoryJobs(registry,existing,publications,{phase,perSubject,pilotTarget,inventory:new Set(bank.map(inventoryFingerprint))});
  if(jobs.length){const {error}=await db.from('question_factory_jobs').insert(jobs);if(error)throw new Error(`factory_enqueue_failed:${error.code}`);}
  return jobs.length;
}
async function updateJob(db,id,patch) {
  const {error}=await db.from('question_factory_jobs').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)throw new Error(`factory_job_write_failed:${error.code}`);
}
function publicationCounts(rows) {
  return {total:rows.length,by_subject:Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,rows.filter(q=>q.subject===s).length])),
    pyq:rows.filter(q=>['authentic_pyq','pyq_adapted'].includes(q.kind)).length};
}
async function allPublications(db) {
  const rows=[];
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('question_factory_publications').select('question_id,subject,chapter,kind').order('question_id').range(offset,offset+999);
    if(error)throw new Error('factory_publication_inventory_required');rows.push(...data);if(data.length<1000)break;
  }
  return rows;
}
export async function runWorker({once=false}={}) {
  const path=resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'),ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path),db=dbClient();
  const transport=createFactoryTransport({ledger});store.claim();
  let stopped=false;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let heartbeatInFlight=null;
  const heartbeat=setInterval(()=>{
    try{store.claim();}catch{stopped=true;return;}
    if(!heartbeatInFlight)heartbeatInFlight=db.rpc('claim_question_factory',{p_worker:store.identity}).then(({data,error})=>{if(error || !data)stopped=true;}).catch(()=>{stopped=true;}).finally(()=>{heartbeatInFlight=null;});
  },30000);
  try {
    const providers=await providerPreflight();
    const {data:claimed,error:claimError}=await db.rpc('claim_question_factory',{p_worker:store.identity});
    if(claimError || !claimed)throw new Error('factory_migration_or_bound_worker_required');
    store.inventory(await bankRows(db),inventoryFingerprint);
    do {
      const {data:lease,error:leaseError}=await db.rpc('claim_question_factory',{p_worker:store.identity});
      if(leaseError || !lease)throw new Error('factory_lease_lost');
      const registry=currentRegistry();
      const {data:control,error:controlError}=await db.from('question_factory_control').select('*').eq('id',1).single();
      if(controlError)throw new Error('factory_control_unavailable');
      const publications=await allPublications(db);
      let counts=publicationCounts(publications);
      const workStates=control.phase==='pilot'?['queued','waiting','validating','repairing','eligible']:['queued','waiting','validating','repairing','eligible','pilot_eligible'];
      const jobsResponse=await db.from('question_factory_jobs').select('*').in('state',workStates).order('created_at').limit(200);
      if(jobsResponse.error)throw new Error('factory_job_inventory_required');
      // Profile-bound records are isolated to worker --queue; never silently
      // downgrade a malformed or stale V7.3 pin to the legacy verifier.
      const jobs=jobsResponse.data.filter(job=>job.generation_brief?.validation_profile===undefined);
      let blocker=control.paused?'owner_paused':null;
      if(!blocker)blocker=providerBlocker(providers);
      if(!blocker && (!process.env.CUET_EVIDENCE_SIGNING_KEY || !process.env.CUET_CONTENT_AUTHOR_ID))blocker='publication_configuration_required';
      if(!blocker) {try{ledger.assertHistoryReconciled();}catch(e){blocker=e.message;}}
      if(!blocker && sourceReadiness(registry).some(r=>!r.ready))blocker='four_subject_source_coverage_required';
      if(!blocker && !factoryCalibrationReady(read('data/calibration_manifest.json'),registry,FACTORY_VERIFIER_VERSION))blocker='route_calibration_required';
      const pilotTarget=control.pilot_target || FACTORY_PILOT_TARGET;
      const limit=control.phase==='pilot'?pilotTarget:control.phase==='1000'?1000:10000;
      if(counts.total>=limit)blocker='checkpoint_reached';
      let committed=ledger.snapshot().committed_micro/1e6;
      const {count:accepted,error:acceptedError}=await db.from('question_factory_jobs').select('id',{count:'exact',head:true}).in('state',['published','pilot_eligible']);
      if(acceptedError)throw new Error('factory_yield_count_required');
      let candidateSpend=ledger.db.prepare("SELECT coalesce(sum(actual),0) AS micro FROM requests WHERE state='settled' AND json_extract(receipt_json,'$.purpose')='candidate'").get().micro/1e6;
      let costPerPublished=accepted?candidateSpend/accepted:null;
      let forecast=costPerPublished?committed+Math.max(0,10000-accepted)*costPerPublished:null;
      if(control.phase==='pilot' && jobs.some(j=>['queued','waiting','validating','repairing'].includes(j.state)))forecast=null;
      if(forecast && forecast>50)blocker='forecast_exceeds_lifetime_budget';
      for(const batch of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all()) {
        try{await transport.reconcile(batch.id);}catch(e){blocker=e.message;break;}
      }
      if(!blocker)for(const job of jobs) {
        if(stopped)break;
        let repairing=job.state==='repairing';
        try {
          await updateJob(db,job.id,{lease_owner:store.identity,lease_until:new Date(Date.now()+300000).toISOString()});
          const gates=await db.from('question_factory_control').select('paused').eq('id',1).single();
          if(gates.error || gates.data.paused)break;
          if(job.passage_group_id) {
            const siblings=await db.from('question_factory_jobs').select('state').eq('passage_group_id',job.passage_group_id);
            if(siblings.error)throw new Error('factory_group_inventory_required');
            if(siblings.data.some(s=>s.state==='quarantined')){await updateJob(db,job.id,{state:'quarantined',result:{reasons:['passage_sibling_quarantined']}});continue;}
          }
          const config={registry,ledger,transport};
          let candidate=store.get(job.id)?.candidate || job.candidate;
          if(!candidate) {candidate=await authorCandidate(job,config);store.set(job.id,{candidate});await updateJob(db,job.id,{candidate,stage:'validation',state:'validating'});}
          const fp=inventoryFingerprint(candidate);
          if(store.duplicate(fp,job.id)) {await updateJob(db,job.id,{state:'quarantined',result:{reasons:['duplicate_existing_inventory']}});continue;}
          store.remember(fp,job.id);
          if(repairing) {candidate=await repairFactoryCandidate(candidate,job.result?.reasons || [],config);store.set(job.id,{candidate});await updateJob(db,job.id,{candidate,state:'validating',attempt:1});repairing=false;}
          if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
          store.remember(inventoryFingerprint(candidate),job.id);
          let result=await validateFactoryCandidate(candidate,config);
          if(result.state==='quarantined' && job.attempt===0 && job.kind!=='authentic_pyq' && result.reasons.some(r=>/failed:|key_contradiction/.test(r))) {
            await updateJob(db,job.id,{state:'repairing',result,attempt:1});
            repairing=true;
            candidate=await repairFactoryCandidate(candidate,result.reasons,config);store.set(job.id,{candidate});
            repairing=false;
            await updateJob(db,job.id,{candidate,state:'validating',attempt:1});
            if(store.duplicate(inventoryFingerprint(candidate),job.id))throw new Error('duplicate_existing_inventory');
            store.remember(inventoryFingerprint(candidate),job.id);
            result=await validateFactoryCandidate(candidate,config);
          }
          if(result.state==='eligible') {
            if(job.passage_group_id)await updateJob(db,job.id,{candidate:result.question,state:control.phase==='pilot'?'pilot_eligible':'eligible',stage:'complete_group_gate',result});
            else if(control.phase==='pilot' || !control.publication_enabled)await updateJob(db,job.id,{candidate:result.question,state:'pilot_eligible',stage:'publication_gate',result});
            else {
              const outcome=await publishInspectedUnit({rows:[{id:job.id,state:'eligible',candidate:result.question,result}],readInventory:()=>bankRows(db),registry,publish:()=>publishFactoryQuestion(result.question,job.id,db)});
              if(outcome.status==='published')await updateJob(db,job.id,{state:'published',stage:'complete',result});
              else if(outcome.status==='withheld')await updateJob(db,job.id,withheldJobPatch({id:job.id,result},outcome));
              else {await updateJob(db,job.id,{candidate:result.question,state:'eligible',stage:'publication_gate',result});blocker='publish_time_inspection_unavailable';break;}
            }
          } else await updateJob(db,job.id,{state:'quarantined',result});
        } catch(e) {
          if(e instanceof BatchPending) {
            const batch=ledger.db.prepare('SELECT reservation_id,provider_id FROM provider_batches WHERE id=?').get(e.batchId);
            await updateJob(db,job.id,{state:repairing?'repairing':'waiting',stage:e.stage || 'provider_pending',batch_key:e.batchId,provider_batch_id:batch?.provider_id || null,budget_reservation_id:batch?.reservation_id || null});
          } else if(/budget|pricing|reconciliation|configuration|source|exam_spec|content_author|publication_evidence|passage_group|checkpoint|subject_target/.test(e.message)) {blocker=e.message;break;}
          else await updateJob(db,job.id,{state:'quarantined',result:{reasons:[e.message]}});
        }
      }
      let allJobs=await readAllRows(db,'question_factory_jobs');
      if(!blocker && control.publication_enabled && control.phase!=='pilot') {
        const groupIds=[...new Set(allJobs.filter(j=>j.passage_group_id && j.state==='eligible').map(j=>j.passage_group_id))];
        for(const id of groupIds) {
          const members=allJobs.filter(j=>j.passage_group_id===id);
          if(members.some(j=>j.state!=='eligible'))continue;
          try{
            const outcome=await publishInspectedUnit({rows:members,readInventory:()=>bankRows(db),registry,publish:kept=>publishFactoryGroup(kept.map(j=>j.candidate),db,registry)});
            if(outcome.status==='withheld'){for(const member of members)await updateJob(db,member.id,withheldJobPatch(member,outcome));continue;}
            if(outcome.status==='inspection_failed'){blocker='publish_time_inspection_unavailable';break;}
          }
          catch(error){if(/checkpoint|subject_target|budget|configuration|publication_evidence/.test(error.message)){blocker=error.message;break;}
            for(const member of members)await updateJob(db,member.id,{state:'quarantined',result:{reasons:[error.message]}});}
        }
        allJobs=await readAllRows(db,'question_factory_jobs');counts=publicationCounts(await allPublications(db));
        if(!blocker && counts.total<limit && allJobs.filter(j=>ACTIVE_JOB_STATES.includes(j.state)).length<40) {
          await enqueueJobs(db,registry,control.phase);allJobs=await readAllRows(db,'question_factory_jobs');
        }
      }
      const rejected={};for(const j of allJobs)for(const reason of j.state==='quarantined'?j.result?.reasons || []:[])rejected[reason]=(rejected[reason] || 0)+1;
      const pilotEligible=allJobs.filter(j=>j.state==='pilot_eligible').length;
      const pilotTotal=allJobs.length;
      committed=ledger.snapshot().committed_micro/1e6;
      candidateSpend=ledger.db.prepare("SELECT coalesce(sum(actual),0) AS micro FROM requests WHERE state='settled' AND json_extract(receipt_json,'$.purpose')='candidate'").get().micro/1e6;
      const acceptedNow=allJobs.filter(j=>['published','pilot_eligible'].includes(j.state)).length;
      costPerPublished=acceptedNow?candidateSpend/acceptedNow:null;
      forecast=costPerPublished?committed+Math.max(0,10000-acceptedNow)*costPerPublished:null;
      if(control.phase==='pilot' && (allJobs.length!==pilotTarget || allJobs.some(j=>['queued','waiting','validating','repairing','eligible'].includes(j.state))))forecast=null;
      if(forecast>50)blocker='forecast_exceeds_lifetime_budget';
      const snapshot={at:new Date().toISOString(),worker_id:store.identity,budget:ledger.snapshot(),historical_reconciled:Boolean(ledger.db.prepare("SELECT 1 FROM ledger_metadata WHERE id='history'").get()),
        sources:sourceReadiness(registry),providers,costs:factoryCostReport(ledger),counts,blocker,forecast_usd:forecast,cost_per_published_usd:costPerPublished,
        achievable_published:costPerPublished?Math.min(10000,acceptedNow+Math.max(0,Math.floor((50-committed)/costPerPublished))):null,
        shortfall_usd:forecast?Math.max(0,forecast-50):null,pilot:{target:pilotTarget,total:pilotTotal,eligible:pilotEligible,
        complete:allJobs.length===pilotTarget && !allJobs.some(j=>['queued','waiting','validating','repairing','eligible'].includes(j.state)),cost_per_eligible_usd:costPerPublished},
        jobs:Object.fromEntries([...new Set(allJobs.map(j=>j.state))].map(state=>[state,allJobs.filter(j=>j.state===state).length])),rejection_reasons:rejected};
      save(join(runtime,'worker-status.json'),snapshot);
      const {error:writeError}=await db.from('question_factory_control').update({snapshot,updated_at:new Date().toISOString()}).eq('id',1).eq('worker_id',store.identity);
      if(writeError)throw new Error('factory_snapshot_write_required');
      console.log(JSON.stringify({published:counts.total,pilot_eligible:pilotEligible,blocker,budget:ledger.snapshot()}));
      if(once || stopped)break;
      await new Promise(r=>setTimeout(r,30000));
    } while(!stopped);
  } finally {clearInterval(heartbeat);await heartbeatInFlight;process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store.release();ledger.close();}
}
async function main() {
  try{loadEnvFile('.env.local');}catch{ /* supplied environment */ }
  const [command,arg,output]=process.argv.slice(2);
  // Profile inspection is deliberately before every BudgetLedger constructor.
  if(command==='profile-v73') {
    const campaignId=flagValue('--campaign-id')||arg;
    if(!campaignId||campaignId.startsWith('--'))throw new Error('factory_campaign_id_required');
    const profile=createFactoryProfileV73({campaignId,manifest:read('data/calibration_manifest.json'),registry:currentRegistry()});
    console.log(JSON.stringify(profile,null,2));return;
  }
  if(command==='profile-v74') {
    const campaignId=flagValue('--campaign-id')||arg;
    if(!campaignId||campaignId.startsWith('--'))throw new Error('factory_campaign_id_required');
    const profile=createFactoryProfileV74({campaignId,manifest:read('data/calibration_manifest.json'),registry:currentRegistry()});
    console.log(JSON.stringify(profile,null,2));return;
  }
  if(command==='enqueue-v73')return enqueueProfiled('v73');
  if(command==='enqueue-v74')return enqueueProfiled('v74');
  if(command==='worker'&&process.argv.includes('--queue'))return runProfiledQueueWorkerV73({once:process.argv.includes('--once')});
  if(command==='worker')return (await import('./tools/focusedFactory.mjs')).runFocusedWorker({once:process.argv.includes('--once')});
  if(command==='local-pilot') {
    const calibrationIndex=process.argv.indexOf('--calibration');
    const calibrationPath=calibrationIndex>=0?process.argv[calibrationIndex+1]:null;
    if(calibrationIndex>=0 && (!calibrationPath || calibrationPath.startsWith('--')))throw new Error('calibration_fixture_path_required');
    const path=resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'),ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path),transport=createFactoryTransport({ledger});
    let heartbeat,stopped=false;const stop=()=>{stopped=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
    try {
      store.claim();heartbeat=setInterval(()=>{try{store.claim();}catch{stopped=true;}},30000);
      const gate=providerBlocker(await providerPreflight());
      do {
        const registry=currentRegistry();let calibration=read('data/calibration_manifest.json');
        let report=await localPilotStep({registry,calibration,ledger,store,transport,providerGate:gate,shouldStop:()=>stopped,readInventory:()=>bankRows(dbClient())});
        let calibrationPending=false;
        if(calibrationPath && !gate && !stopped && !factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION)) {
          calibration=await runFactoryCalibration(read(calibrationPath),{registry,ledger,transport});
          save('data/calibration_manifest.json',calibration);
          calibrationPending=Boolean(calibration.pending?.length);
          if(factoryCalibrationReady(calibration,registry,FACTORY_VERIFIER_VERSION))report=await localPilotStep({registry,calibration,ledger,store,transport,shouldStop:()=>stopped,readInventory:()=>bankRows(dbClient())});
          report.calibration={state:calibration.state,pending:calibration.pending?.length||0,verifier_version:calibration.verifier_version};
          if(calibrationPending)report.blocker='calibration_batches_pending';
          report.budget=ledger.snapshot();report.costs=factoryCostReport(ledger);
        }
        const {candidates,...snapshot}=report;
        save(join(runtime,'local-pilot.json'),report);save(join(runtime,'worker-status.json'),snapshot);
        save('artifacts/question-factory/local-pilot-status.json',snapshot);
        console.log(JSON.stringify({...snapshot,job_count:candidates.length},null,2));
        if(process.argv.includes('--once') || stopped || report.blocker && !calibrationPending || report.pilot.complete)break;
        await new Promise(r=>setTimeout(r,30000));
      }while(!stopped);
    } finally {clearInterval(heartbeat);process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);store.release();ledger.close();}
    return;
  }
  if(command==='register-source') {const path=resolve(arg),registry=registerSourcePack(read(path),dirname(path),currentRegistry());save('data/source_registry.json',registry);console.log(JSON.stringify(sourceReadiness(registry)));return;}
  if(command==='screen') {
    const rows=arg==='--database'?await bankRows(dbClient()):read(arg), receipts=mechanicalScreen(rows),bundles=reviewBundles(rows,receipts,{sources:currentRegistry().sources});
    const directory=resolve(output || join(runtime,'legacy'));
    save(join(directory,'bank-snapshot.json'),rows);save(join(directory,'local-receipts.json'),receipts);
    for(const bundle of bundles)save(join(directory,`${bundle.id}.bundle.json`),bundle);
    const report={at:new Date().toISOString(),rows:rows.length,clean_mechanical:receipts.filter(r=>r.verdict==='no_issue_found').length,suspect:receipts.filter(r=>r.verdict==='suspect').length,bundles:bundles.length,api_spend_usd:0,production_changes:0};
    save(join(directory,'screen-report.json'),report);console.log(JSON.stringify(report));return;
  }
  if(command==='catalog') {
    const documents=FACTORY_SUBJECTS.map(subject=>{const path=`data/CUET 2026/${subject}.pdf`;return {subject,path,identity_sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),kind:'syllabus',state:'pending_extraction',source_url:'https://cuet.nta.nic.in/cuetug-2026-syllabus/',year:2026,reuse_permitted:false,reason:'Extraction, permission and 2027 applicability require evidence.'};});
    const foundation=join(runtime,'source-foundation','acquisition.json');
    if(existsSync(foundation))documents.push(...read(foundation));
    save('data/question_factory_sources.json',{created_at:new Date().toISOString(),documents,missing:['authenticated_complete_papers','paper_to_final_key_mapping','reuse_permissions','development_and_held_out_sets']});return;
  }
  const path=resolve(process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite'),ledger=new BudgetLedger(path),transport=createFactoryTransport({ledger});
  let foundationLease;
  let foundationHeartbeat;
  try {
    if(['prepare-pattern','research','calibrate'].includes(command)) {
      const providerGate=providerBlocker(await providerPreflight());if(providerGate)throw new Error(providerGate);
      foundationLease=new FactoryStore(ledger,path);foundationLease.claim();
      // Source preparation/calibration are local commissioning, not publication.
      // They use the same permanent ledger and local process lease before the
      // site migration exists. DB binding remains mandatory in runWorker.
      foundationHeartbeat=setInterval(()=>foundationLease.claim(),30000);
      for(const row of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all())await transport.reconcile(row.id);
    }
    if(command==='doctor') {
      const report={sources:sourceReadiness(currentRegistry()),budget:ledger.snapshot(),historical_reconciled:Boolean(ledger.db.prepare("SELECT 1 FROM ledger_metadata WHERE id='history'").get()),
        signing_key_configured:Boolean(process.env.CUET_EVIDENCE_SIGNING_KEY),author_configured:Boolean(process.env.CUET_CONTENT_AUTHOR_ID),costs:factoryCostReport(ledger),calibration:read('data/calibration_manifest.json').state,api_calls:0};
      save(join(runtime,'doctor.json'),report);console.log(JSON.stringify(report,null,2));
    } else if(command==='reconcile-history') {ledger.reconcileHistory(read(arg));console.log(JSON.stringify(ledger.snapshot()));}
    else if(command==='reconcile-batches') {for(const row of ledger.db.prepare("SELECT id FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all())await transport.reconcile(row.id);}
    else if(command==='attach-batch') {const report=read(arg);await transport.attachAcceptedBatch(report.factory_key,report.provider_batch_id);}
    else if(command==='reconcile-usage') {
      const report=read(arg),row=ledger.db.prepare('SELECT * FROM requests WHERE id=?').get(report.reservation_id);
      if(row?.state!=='unresolved' || !Number.isFinite(report.actual_usd) || report.actual_usd<0 || !report.provider_reference || typeof report.basis!=='string' || report.basis.length<20)throw new Error('confirmed_provider_usage_report_required');
      ledger.settle(row.id,Math.ceil(report.actual_usd*1e6),{...report,purpose:'candidate'});
      console.log(JSON.stringify(ledger.snapshot()));
    }
    else if(command==='prepare-pattern') {
      const input=read(arg),key=hashJSON({input,stage:'pattern',version:FACTORY_VERIFIER_VERSION});
      const spec=responseJSON(await transport.generate('openai',lunaBody('Prepare a CUET source-backed pattern specification from the authenticated syllabus and paper excerpts supplied. Return JSON included_topics, excluded_topics, pattern_rules, syllabus_version, pattern_version, exam_rule_version and uncertainties. Do not infer missing 2027 rules, invent paper examples or assert source permission. This is a draft, not a release.',input,'high',3000),{key,purpose:'source'}));save(output,{state:'draft',...spec});
    } else if(command==='research') {
      const body=lunaBody('Locate official NTA/CUET source documents for the request. Search snippets are not authentication. Return JSON documents [{url,title,year,kind}] and missing_evidence. Do not claim permission, extraction or final-key matching.',{query:arg},'high',2500);
      body.tools=[{type:'web_search',filters:{allowed_domains:['cuet.nta.nic.in','nta.ac.in']}}];body.max_tool_calls=3;
      const result=await transport.generate('openai',body,{batch:false,toolCalls:3,purpose:'source'});save(output,{state:'research_only',result});
    } else if(command==='calibrate') {
      const report=await runFactoryCalibration(read(arg),{registry:currentRegistry(),ledger,transport});
      save('data/calibration_manifest.json',report);console.log(JSON.stringify({state:report.state,pending:report.pending?.length || 0}));
    } else if(command==='enqueue') {
      const registry=currentRegistry(),db=dbClient();
      if(sourceReadiness(registry).some(s=>!s.ready))throw new Error('four_subject_authenticated_sources_required');
      const {data:control,error:controlError}=await db.from('question_factory_control').select('phase,pilot_target').eq('id',1).single();
      if(controlError)throw new Error('factory_migration_required');
      const queued=await enqueueJobs(db,registry,control.phase,Number(arg || 50),control.pilot_target);console.log(JSON.stringify({queued,phase:control.phase}));
    } else if(command==='export-review-bundles') {
      const directory=resolve(arg || join(runtime,'legacy'));console.log(JSON.stringify({directory,bundles:readdirSync(directory).filter(f=>f.endsWith('.bundle.json'))}));
    } else throw new Error('Commands: catalog, screen rows.json|--database [directory], doctor, register-source pack.json, reconcile-history report.json, prepare-pattern input.json output.json, research query output.json, calibrate fixtures.json, enqueue, worker [--once], local-pilot [--once], reconcile-batches');
  } finally {clearInterval(foundationHeartbeat);foundationLease?.release();ledger.close();}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{if(e instanceof BatchPending)console.log(JSON.stringify({state:'waiting',batch_id:e.batchId}));else{console.error(e.message);process.exitCode=1;}});
