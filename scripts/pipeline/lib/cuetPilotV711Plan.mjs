// Preparation planning for the single preregistered v7.9 measurement pilot (40 candidates, 10 per subject).
// Mirrors cuetPilotV75Plan.mjs, bound to the V7.11 validator. Differences from V7.5:
//  - English mix: no matching and no ordering (stock exhausted); reading comprehension on DISTINCT registered passages plus
//    correct word usage / synonym / antonym only where an unconsumed registered source exists (gaps are replaced at preparation time).
//  - prior attempts also include the V7.5 pilot directory when it exists.
//  - the contract is bound by a hash recorded at registration (no freeze file).
// Pure planning: no provider call, no ledger write, no network.
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {contentHash} from '../../../data/content_evidence.js';
import {detailedCoverage} from './topicCoverage.mjs';
import {focusedBriefsV7,CUET_FORMAT_PLAN,CUET_DIFFICULTY_PLAN} from './focusedBriefsV7.mjs';
import {diversifyBrief,isIdeaGap} from './briefDiversity.mjs';
import {orderingFormat} from './ideaAllocation.mjs';
import {retrieveFocusedSources} from './focusedSources.mjs';
import {QUOTE_AUTHOR_CONTRACT} from './constrainedAuthoring.mjs';
import {AUTHOR_ADDENDUM_V7_ID} from './authorIntegrityV7.mjs';
import {maximumRequestMicro} from './campaignExecutionV7.mjs';
import {FACTORY_VERIFIER_VERSION_V711,validationContractV711} from './contractV711.mjs';
import {V711_PROMPT_HASH} from './factoryEvidenceV711.mjs';
import {ORIGINAL_AUTHOR_POLICY_V79} from './originalAuthorPolicyV79.mjs';
import {assertPilotRegistration as assertEngineRegistration,PILOT_STATE_CONTRACT} from './cuetPilotV75Run.mjs';
import {PILOT_CONTRACT as ENGINE_PILOT_CONTRACT} from './cuetPilotV75Plan.mjs';
import {assertCandidateCBankDisposed,reassessedStagingInventory,refreshCoverageWithCurrentReassessment,priorCampaignPlanningContext,planningReferenceContext} from './candidateCRegistration.mjs';

export const PILOT_CONTRACT='cuet-pilot-v711-measurement-v1';
export const PILOT_ID='cuet-pilot-v711-40-2026-10-09';
export const V75_PILOT_DIRECTORY='artifacts/question-factory/cuet-pilot-v75-40-2026-10-09';
export const PILOT_DIRECTORY='artifacts/question-factory/'+PILOT_ID;
export const PILOT_SUBJECTS=Object.freeze(['english','accountancy','business_studies','economics']);
export const PILOT_PER_SUBJECT=10;
export const PILOT_DENOMINATOR=40;
export const PILOT_WAVE_SIZE=10;
export const PILOT_CAP_USD_MAX=3;
export const WEAK_WAVE_YIELD=0.4;
export const WEAK_WAVES_TO_STOP=2;
export const SYSTEMIC_ERRORS_TO_STOP=3;
export const STOCK_REASSESSMENT_DIRECTORY='artifacts/question-factory/cuet-readiness-2026-10-08/reassessment';
export const PRIOR_CAMPAIGN_DIRECTORIES=Object.freeze([
  'artifacts/question-factory/cuet-readiness-baseline-100-2026-10-08',
  'artifacts/question-factory/cuet-readiness-improved-100-2026-10-08',
  'artifacts/question-factory/cuet-readiness-cost-source-c-100-2026-10-08']);
export const STIMULI_OVERLAY_PATH='data/question-factory-runtime/original-stimuli-overlay-2026-10-09.json';
export const STOP_FILE_V711='data/question-factory-runtime/STOP_V711_PILOT';
// English 10: no matching, no ordering. 5 reading comprehension (each on its own passage), 5 lexical (word usage / synonym / antonym).
export const PILOT_ENGLISH_FORMAT_PLAN=Object.freeze({reading_comprehension:5,correct_word_usage:2,synonym:2,antonym:1});
export const PILOT_FORMAT_PLAN=Object.freeze({...CUET_FORMAT_PLAN,english:PILOT_ENGLISH_FORMAT_PLAN});

export const sha256File=(path,read=readFileSync)=>createHash('sha256').update(read(path)).digest('hex');
const readJSON=(path,read=readFileSync)=>JSON.parse(read(path,'utf8'));

// base registry + the reviewed stimuli overlay (sources, pack_additions). The base file is never modified.
export function mergeRegistryOverlay(base,overlay){
  const merged={...base,sources:{...base.sources,...(overlay?.sources||{})},packs:structuredClone(base.packs)};
  for(const [packId,ids] of Object.entries(overlay?.pack_additions||{})){
    const pack=merged.packs[packId];if(!pack||!Array.isArray(pack.document_ids))throw Error('overlay_pack_missing:'+packId);
    for(const id of ids){if(!merged.sources[id])throw Error('overlay_pack_source_missing:'+id);if(!pack.document_ids.includes(id))pack.document_ids.push(id);}
  }
  for(const id of Object.keys(overlay?.sources||{}))if(base.sources[id])throw Error('overlay_base_collision:'+id);
  return merged;
}

// ---------------------------------------------------------------- offline inventory

// Latest record per id wins (the file is append-only).
export function latestRecords(text){
  const latest=new Map();
  for(const line of text.split('\n')){if(!line.trim())continue;const row=JSON.parse(line);latest.set(row.id,row);}
  return latest;
}
// A reassessed record carries its full question when eligible; otherwise only the visible fields remain.
export function bankRowFromRecord(record){
  if(record.result?.question)return {...record.result.question};
  return {id:record.id,subject:record.subject,chapter:record.chapter,body:record.body,options:record.options,correct_answer:record.key,
    explanation:record.explanation,source_refs:record.source_refs||[]};
}
export function loadOfflineInventory({reassessmentDirectory=STOCK_REASSESSMENT_DIRECTORY,campaignDirectories=PRIOR_CAMPAIGN_DIRECTORIES,read=readFileSync}={}){
  const profile=readJSON(reassessmentDirectory+'/profile.json',read),text=read(reassessmentDirectory+'/results.jsonl','utf8');
  if(text&&!text.endsWith('\n'))throw Error('reassessment_writer_must_finish_before_offline_inventory');
  const latest=latestRecords(text),results=[...latest.values()];
  assertCandidateCBankDisposed(profile,results);
  const bankRows=results.map(bankRowFromRecord);
  const bank=reassessedStagingInventory(bankRows,results,profile);
  const campaigns=campaignDirectories.map(dir=>({dir,campaign:readJSON(dir+'/campaign.json',read),items:readJSON(dir+'/all-candidates.json',read)}));
  const eligibleCandidates=[],ids=new Set(bank.inventory.map(q=>q.id));
  for(const {dir,items} of campaigns)for(const row of items){
    if(!['eligible','published'].includes(row.state)||!row.candidate?.evidence?.record)continue;
    if(ids.has(row.candidate.id))throw Error('offline_inventory_duplicate_id:'+row.candidate.id);
    ids.add(row.candidate.id);eligibleCandidates.push(row.candidate);
  }
  return {profile,results,bankRows,bank,campaigns,eligibleCandidates,
    inventory:[...bank.inventory,...eligibleCandidates],
    hashes:{reassessment_profile_sha256:sha256File(reassessmentDirectory+'/profile.json',read),reassessment_results_sha256:createHash('sha256').update(text).digest('hex'),
      campaigns:Object.fromEntries(campaignDirectories.map(dir=>[dir,sha256File(dir+'/all-candidates.json',read)]))},
    basis:'Offline inventory: '+bank.inventory.length+' reassessed bank questions with exact terminal eligible reassessment (complete passage units) plus '+eligibleCandidates.length+
      ' eligible measurement candidates of campaigns A/B/C. No network, staging or production access; recovery family holds and the staging withholding journal are not reapplied offline.'};
}

// V7.11 inventory: the V7.5 loader plus the V7.5 pilot directory (when it exists) as prior ATTEMPTS only. Its candidates are measurement
// output, never stock, so they feed novelty/avoidance and the idea allocator but never coverage. Items come from all-candidates.json
// after an export, otherwise from the live state.json, otherwise from the registered jobs alone.
export function priorPilotAttempts(directory=V75_PILOT_DIRECTORY,{read=readFileSync,exists=existsSync}={}){
  if(!exists(directory+'/campaign.json'))return null;
  const campaign=readJSON(directory+'/campaign.json',read);
  let items,source;
  if(exists(directory+'/all-candidates.json')){items=readJSON(directory+'/all-candidates.json',read);source='all-candidates.json';}
  else if(exists(directory+'/state.json')){const state=readJSON(directory+'/state.json',read);items=Object.values(state.jobs||{}).map(j=>({id:j.id,state:j.state,candidate:j.candidate||undefined}));source='state.json';}
  else{items=[];source='campaign.json';}
  if(!Array.isArray(items))throw Error('v75_pilot_attempts_unreadable');
  const files=[directory+'/campaign.json',...(source==='campaign.json'?[]:[directory+'/'+source])];
  return {dir:directory,campaign,items,source,hashes:Object.fromEntries(files.map(f=>[f,sha256File(f,read)]))};
}
export function loadOfflineInventoryV711({v75PilotDirectory=V75_PILOT_DIRECTORY,read=readFileSync,exists=existsSync,...options}={}){
  const inventory=loadOfflineInventory({...options,read});
  const prior=priorPilotAttempts(v75PilotDirectory,{read,exists});
  if(!prior)return {...inventory,v75_pilot_attempts:null};
  const known=new Set(inventory.campaigns.flatMap(c=>c.campaign.jobs.map(j=>j.id)));
  if(prior.campaign.jobs.some(j=>known.has(j.id)))throw Error('v75_pilot_attempt_id_collision');
  return {...inventory,campaigns:[...inventory.campaigns,{dir:prior.dir,campaign:prior.campaign,items:prior.items}],
    hashes:{...inventory.hashes,v75_pilot:prior.hashes},v75_pilot_attempts:{directory:prior.dir,source:prior.source,jobs:prior.campaign.jobs.length}};
}
// Read-only view of the V7.6 durable allocator (snapshot + immutable intents) as a legacy-shaped ordering ledger for the planner's
// consumed-idea ranking. It never opens the allocator (no lock) and never writes.
export function v76ConsumedAsLegacy(legacy,path,{read=readFileSync,exists=existsSync,list=readdirSync}={}){
  const out={...legacy,allocations:{...(legacy?.allocations||{})}};
  const claims=[];
  if(exists(path)){const snap=readJSON(path,read);for(const r of Object.values(snap.allocations||{}))if(r.claim)claims.push(r.claim);for(const v of Object.values(snap.intents||{}))claims.push(...(v.intent?.claims||[]));}
  if(exists(path+'.intents'))for(const name of list(path+'.intents')){
    if(!/^intent-[a-f0-9]{64}\.json(?:\..+\.tmp)?$/.test(name))continue;
    try{claims.push(...(readJSON(path+'.intents/'+name,read).claims||[]));}catch{throw Error('v76_allocator_intent_unreadable:'+name);}
  }
  for(const claim of claims)for(const key of claim.ordering_keys||[])out.allocations['ordering:'+key]={campaign_id:claim.campaign_id,job_id:claim.job_id,v76:true};
  return out;
}
// Optional staging path: the caller reads staged rows (read-only) and held families; the same exact-reassessment filter is applied.
export function withStagingRows(inventory,staged,heldFamilyIds=[]){
  const bank=reassessedStagingInventory(staged,inventory.results,inventory.profile);
  return {...inventory,bankRows:staged,bank,inventory:[...bank.inventory,...inventory.eligibleCandidates],heldFamilies:heldFamilyIds,
    basis:'Actual staging inventory ('+staged.length+' rows) with exact current terminal reassessment (complete passage units), plus '+inventory.eligibleCandidates.length+' eligible measurement candidates of campaigns A/B/C.'};
}
// Coverage over the offline inventory. Topic attribution uses the latest exact evidence, never legacy tags.
export function offlineCoverage(inventory,registry){
  const eligible=()=>({eligible:true});
  const raw=detailedCoverage(inventory.inventory,registry,{eligible,heldFamilies:inventory.heldFamilies||[]});
  const synthetic=inventory.eligibleCandidates.map(candidate=>({id:candidate.id,verifier:inventory.profile.verifier,contract:inventory.profile.contract,
    content_hash:contentHash(candidate),state:'eligible',result:{question:candidate}}));
  const profile={...inventory.profile,content_hashes:[...inventory.profile.content_hashes,...synthetic.map(row=>[row.id,row.content_hash])]};
  const coverage=refreshCoverageWithCurrentReassessment(raw,[...inventory.results,...synthetic],profile);
  coverage.qualification_basis=inventory.basis;coverage.offline_inventory=!inventory.heldFamilies;
  coverage.staging_raw_count=null;coverage.current_reassessment_excluded=inventory.bank.excluded;
  return coverage;
}
export function planningContextFor(inventory,localRegistry){
  const priorAttempts=priorCampaignPlanningContext(inventory.campaigns.map(({campaign,items})=>({campaign,items})));
  return {priorAttempts,context:planningReferenceContext([...inventory.bankRows,...priorAttempts],localRegistry)};
}

// ---------------------------------------------------------------- briefs

// Saturated pools (every dictionary word is already used about twenty times in the bank) would otherwise return the same four words for two
// briefs of this pilot, because one extra use does not change the ranking. A planned brief therefore counts as heavy usage for later briefs.
export const PLANNED_SOURCE_WEIGHT=100;
const topicOf=(coverage,job)=>coverage.cells.find(c=>c.subject===job.subject&&c.chapter===job.chapter)?.topics||[];
function prepareBrief(job,{coverage,selection,local,planningContext,priorAttempts,prepared,topicsPlanned,allocations,diversify,ledger,sourceContextContract}){
  const topics=topicOf(coverage,job);
  const ranked=[...topics].sort((a,b)=>(a.usable+(topicsPlanned.get(a.id)||0))-(b.usable+(topicsPlanned.get(b.id)||0))||(a.formats[job.format]||0)-(b.formats[job.format]||0)||a.id.localeCompare(b.id));
  const next={...job};
  if(ranked.length){next.topic=ranked[0].text;next.topic_coverage_before={id:ranked[0].id,usable:ranked[0].usable};}
  next.source_pack_id='original-'+job.subject+'-reference-v1';
  if(!local.packs[next.source_pack_id])throw Error('original_reference_pack_missing:'+next.source_pack_id);
  next.source_pack_version=local.packs[next.source_pack_id].version;next.official_syllabus_topic=next.topic;
  next.author_contract=QUOTE_AUTHOR_CONTRACT;next.author_addendum=AUTHOR_ADDENDUM_V7_ID;
  const priorIdeas=priorAttempts.filter(q=>q.subject===job.subject&&q.chapter===job.chapter).map(q=>q.body||q.topic).filter(Boolean);
  next.avoidance=[...new Set([...priorIdeas,...(job.avoidance||[])])].slice(0,12);
  const research=diversify(next,selection,planningContext,{planned:prepared.flatMap(planned=>Array(PLANNED_SOURCE_WEIGHT).fill(planned)),allocations})||retrieveFocusedSources(selection,next,ledger);
  if(isIdeaGap(research))return {gap:{gap:research.gap,basis:research.basis,considered_sources:research.considered_sources}};
  if(!research?.refs?.length)return {gap:{gap:'source_missing',basis:'No permitted registered section supports this brief.'}};
  next.research=research;next.source_refs=research.refs;
  if(research.topic)next.topic=research.topic;
  if(next.topic_coverage_before)topicsPlanned.set(next.topic_coverage_before.id,(topicsPlanned.get(next.topic_coverage_before.id)||0)+1);
  next.source_context_contract=sourceContextContract;
  next.retrieval_support_status='Pending independent entailment; exact teaching context and ranking do not prove the key.';
  local.families[next.family_id]={state:'active',version:1,source_pack_id:next.source_pack_id,kind:'original_practice'};
  return {job:next};
}

function adjustedCoverage(coverage,jobs){
  const adjusted=structuredClone(coverage);
  for(const job of jobs){
    const cell=adjusted.cells.find(c=>c.subject===job.subject&&c.chapter===job.chapter);if(!cell)continue;
    cell.usable++;cell.formats[job.format]=(cell.formats[job.format]||0)+1;cell.difficulties[job.difficulty]=(cell.difficulties[job.difficulty]||0)+1;
  }
  return adjusted;
}

// Idea gaps are explicit. A gapped brief is replaced here, at preparation time and never afterwards, by the next
// coverage-gap brief for the same subject whose (chapter, format) route is not itself gapped.
export function planPilotBriefs({coverage,views,planningContext,priorAttempts,campaignId=PILOT_ID,branch='financial_analysis',perSubject=PILOT_PER_SUBJECT,
  allocations,diversify=diversifyBrief,ledger=null,formatPlan=PILOT_FORMAT_PLAN,difficultyPlan=CUET_DIFFICULTY_PLAN,poolSize=25,maxReadingPassages=PILOT_MAX_READING_PASSAGES}){
  const selection=views.selection_registry,local=views.registry;
  const initial=focusedBriefsV7(coverage,selection,{campaignId,perSubject,branch,formatPlan,difficultyPlan});
  const prepared=[],gaps=[],topicsPlanned=new Map(),context={coverage,selection,local,planningContext,priorAttempts,prepared,topicsPlanned,allocations,diversify,ledger,sourceContextContract:views.contract};
  const slots=[];
  for(const job of initial){
    const outcome=prepareBrief(job,context);
    if(outcome.job){prepared.push(outcome.job);slots.push({subject:job.subject,job:outcome.job});}
    else{const gap={brief_id:job.id,subject:job.subject,chapter:job.chapter,format:job.format,difficulty:job.difficulty,...outcome.gap,replaced_by:null,skipped_same_route:[]};gaps.push(gap);slots.push({subject:job.subject,gap});}
  }
  if(gaps.length){
    const pool=focusedBriefsV7(adjustedCoverage(coverage,prepared),selection,{campaignId:campaignId+':gap-replacement',perSubject:poolSize,branch,formatPlan,difficultyPlan});
    const used=new Set();
    for(const slot of slots.filter(s=>s.gap)){
      const gap=slot.gap,badRoutes=new Set(gaps.filter(g=>g.subject===slot.subject).map(g=>g.chapter+'|'+g.format));
      for(const candidate of pool.filter(j=>j.subject===slot.subject&&!used.has(j.id))){
        used.add(candidate.id);
        // A gapped lexical brief is not silently turned into a flood of reading items: reading stays within the registered passage ceiling.
        if(slot.subject==='english'&&candidate.format==='reading_comprehension'&&prepared.filter(j=>j.subject==='english'&&j.format==='reading_comprehension').length>=maxReadingPassages){gap.skipped_same_route.push({id:candidate.id,chapter:candidate.chapter,format:candidate.format,reason:'reading_passage_ceiling'});continue;}
        if(badRoutes.has(candidate.chapter+'|'+candidate.format)){gap.skipped_same_route.push({id:candidate.id,chapter:candidate.chapter,format:candidate.format});continue;}
        const outcome=prepareBrief(candidate,context);
        if(outcome.job){outcome.job.replaces_gap=gap.brief_id;prepared.push(outcome.job);slot.job=outcome.job;gap.replaced_by={id:outcome.job.id,chapter:outcome.job.chapter,format:outcome.job.format,difficulty:outcome.job.difficulty};break;}
        badRoutes.add(candidate.chapter+'|'+candidate.format);
        gaps.push({brief_id:candidate.id,subject:candidate.subject,chapter:candidate.chapter,format:candidate.format,difficulty:candidate.difficulty,...outcome.gap,replacement_candidate_for:gap.brief_id,replaced_by:null,skipped_same_route:[]});
      }
      if(!slot.job)throw Error('gap_replacement_pool_exhausted:'+slot.subject);
    }
  }
  const bySubject=Object.fromEntries(PILOT_SUBJECTS.map(subject=>[subject,slots.filter(s=>s.subject===subject).map(s=>s.job)]));
  for(const subject of PILOT_SUBJECTS)if(bySubject[subject].length!==perSubject)throw Error('pilot_subject_denominator_mismatch:'+subject);
  assignEnglishPassages({bySubject,local,planningContext,campaignId});
  const noEnglishMatching=bySubject.english.every(j=>!/match|order|sequence|jumble/i.test(j.format));
  if(!noEnglishMatching)throw Error('english_matching_or_ordering_not_allowed_in_v711_pilot');
  assignAnswerPositions(bySubject);
  const ordered=interleave(bySubject,perSubject);
  return {jobs:ordered,gaps,registry:local,initial_count:initial.length};
}

// Every reading-comprehension brief gets its OWN complete registered stimulus (at most 300 words); no two items of this pilot print the same
// passage, so there are no passage groups. Stimuli least used by the bank, earlier attempts and this plan are chosen first; chapters
// (Factual / Narrative / Literary) are visited round-robin by least-used stimulus so the mix of passage types is spread.
export const PILOT_MAX_READING_PASSAGES=6;
export function assignEnglishPassages({bySubject,local,planningContext,campaignId}){
  const english=bySubject.english,assigned=new Map(),usedTexts=new Set();
  const readers=english.filter(j=>j.format==='reading_comprehension');
  const pools=chapter=>Object.values(local.sources).filter(s=>s.state==='active'&&s.id.startsWith('mockmob-original-stimulus-')&&s.chapters?.includes(chapter)&&s.facts?.stimulus?.text&&
    s.facts.stimulus.text.trim().split(/s+/).length<=300);
  const used=s=>planningContext.filter(q=>q.passage_text===s.facts.stimulus.text).length+(assigned.get(s.id)||0);
  for(const job of readers){
    const stimuli=pools(job.chapter).filter(s=>!usedTexts.has(s.facts.stimulus.text));
    stimuli.sort((a,b)=>used(a)-used(b)||hashJSON({campaignId,id:a.id}).localeCompare(hashJSON({campaignId,id:b.id})));
    const document=stimuli[0];
    if(!document)throw Error('distinct_complete_original_stimulus_required:'+job.chapter);
    assigned.set(document.id,(assigned.get(document.id)||0)+1);usedTexts.add(document.facts.stimulus.text);
    const ref={id:document.id,version:document.version,locator:'stimulus',support_hash:document.supports.stimulus};
    job.passage_text=document.facts.stimulus.text;job.source_refs=[ref];
    job.topic=job.chapter+': test a distinct detail, supported inference or textual relationship in this printed fictional passage.';
    job.research={refs:[ref],excerpts:[{...ref,text:job.passage_text}],state:'retrieved_pending_entailment',cost_usd:0};
  }
  // Alternate reading and lexical items so every wave of ten mixes them.
  const lexical=english.filter(j=>j.format!=='reading_comprehension').sort((x,y)=>x.id.localeCompare(y.id));
  readers.sort((x,y)=>x.id.localeCompare(y.id));
  const merged=[];for(let i=0;i<Math.max(readers.length,lexical.length);i++){if(readers[i])merged.push(readers[i]);if(lexical[i])merged.push(lexical[i]);}
  english.splice(0,english.length,...merged);
}

// Requested answer positions rotate per subject so the 40 requests are exactly balanced (10 each) and siblings of a group differ.
export function assignAnswerPositions(bySubject){
  const offsets={english:0,accountancy:2,business_studies:1,economics:3};
  for(const subject of PILOT_SUBJECTS){
    const jobs=bySubject[subject],ranked=[...jobs].sort((a,b)=>hashJSON({position_seed:a.passage_group_id||a.id}).localeCompare(hashJSON({position_seed:b.passage_group_id||b.id}))||(a.order_index??0)-(b.order_index??0));
    ranked.forEach((job,i)=>{job.requested_answer_position='ABCD'[(i+offsets[subject])%4];});
  }
}
export function interleave(bySubject,perSubject){
  const ordered=[];
  for(let i=0;i<perSubject;i++)for(const subject of PILOT_SUBJECTS)ordered.push(bySubject[subject][i]);
  ordered.forEach((job,i)=>{job.number=i+1;job.state='queued';job.repair_count=0;});
  return ordered;
}

// ---------------------------------------------------------------- summary and cost

export function planSummary(jobs){
  const table={};
  for(const subject of PILOT_SUBJECTS){
    const rows=jobs.filter(j=>j.subject===subject),count=key=>rows.reduce((n,j)=>({...n,[j[key]]:(n[j[key]]||0)+1}),{});
    table[subject]={briefs:rows.length,formats:count('format'),difficulties:count('difficulty'),chapters:count('chapter'),requested_answer_positions:count('requested_answer_position'),
      ordering_briefs:rows.filter(j=>orderingFormat(j.format)).length,passage_briefs:rows.filter(j=>j.passage_text).length};
  }
  return {denominator:jobs.length,by_subject:table,english_mix:realizedEnglishMix(jobs),
    requested_answer_positions:jobs.reduce((n,j)=>({...n,[j.requested_answer_position]:(n[j.requested_answer_position]||0)+1}),{}),
    wave_subjects:Array.from({length:Math.ceil(jobs.length/PILOT_WAVE_SIZE)},(_,w)=>jobs.slice(w*PILOT_WAVE_SIZE,(w+1)*PILOT_WAVE_SIZE).reduce((n,j)=>({...n,[j.subject]:(n[j.subject]||0)+1}),{}))};
}

// Output caps per stage (V7.11 evaluation caps are V711_OUTPUT_CAPS; the test pins them). Author/repair are unchanged from V7.5.
// The continuation retry in completeJSON doubles the cap once per request.
export const STAGE_OUTPUT_CAPS=Object.freeze({author:6500,repair:9000,luna_evaluation:16000,gemini_evaluation:6000,explanation_audit:8000});
const lunaBody=cap=>({max_output_tokens:cap}),geminiBody=cap=>({generationConfig:{maxOutputTokens:cap}});
export function conservativeMaximum(prices,{caps=STAGE_OUTPUT_CAPS,candidates=PILOT_DENOMINATOR}={}){
  const luna=cap=>maximumRequestMicro('openai',lunaBody(cap),prices),gemini=cap=>maximumRequestMicro('gemini',geminiBody(cap),prices);
  const withRetry=(price,cap)=>({first_micro:price(cap),continuation_retry_micro:price(cap*2)});
  const stages={author:{provider:'openai',...withRetry(luna,caps.author)},blind_solution:{provider:'openai',...withRetry(luna,caps.luna_evaluation)},
    independent_evaluation:{provider:'gemini',...withRetry(gemini,caps.gemini_evaluation)},explanation_support:{provider:'openai',...withRetry(luna,caps.explanation_audit)},
    repair:{provider:'openai',...withRetry(luna,caps.repair)}};
  const total=s=>s.first_micro+s.continuation_retry_micro;
  const validation=total(stages.blind_solution)+total(stages.independent_evaluation)+total(stages.explanation_support);
  const perCandidate=total(stages.author)+validation+total(stages.repair)+validation;
  return {basis:'Every request reserved at the full input bound (max_input_tokens) and the stage output cap at standard realtime rates (Flex is billed lower and settles lower), each request with its single bounded continuation retry; one author call, one validation, one repair, one revalidation per candidate.',
    stages,maximum_requests_per_candidate:{author:2,first_validation:6,repair:2,revalidation:6,total:16},validation_maximum_micro:validation,
    per_candidate_maximum_micro:perCandidate,per_candidate_maximum_usd:perCandidate/1e6,denominator:candidates,
    pilot_maximum_micro:perCandidate*candidates,pilot_maximum_usd:perCandidate*candidates/1e6};
}

export function realizedEnglishMix(jobs){
  const english=jobs.filter(j=>j.subject==='english'),count=key=>english.reduce((n,j)=>({...n,[j[key]]:(n[j[key]]||0)+1}),{});
  return {formats:count('format'),chapters:count('chapter'),reading_passages:english.filter(j=>j.passage_text).length,
    distinct_passages:new Set(english.filter(j=>j.passage_text).map(j=>j.passage_text)).size,matching:english.filter(j=>/match/i.test(j.format)).length,
    ordering:english.filter(j=>/order|sequence|jumble/i.test(j.format)).length};
}

// The engine (cuetPilotV75Run.mjs) is version-neutral and reused unchanged, but its registration check compares prereg.contract with the
// V7.5 constant. The V7.11 contract and pilot id are verified here first; the engine then re-checks every structural rule (fixed 40,
// 10 per subject, one repair, no replacement, wave rules, cap <= USD 3, publication never) on the same document.
export function assertV711PilotRegistration(prereg,campaign){
  if(prereg?.contract!==PILOT_CONTRACT||prereg.pilot_id!==PILOT_ID||campaign?.id!==PILOT_ID)throw Error('pilot_registration_invalid:v711_contract_or_id');
  return assertEngineRegistration({...prereg,contract:ENGINE_PILOT_CONTRACT},campaign);
}
export {PILOT_STATE_CONTRACT};

// ---------------------------------------------------------------- contract and code binding

// There is no freeze file for V7.11: the validation contract hash computed at registration is recorded in the preregistration
// and execution refuses to proceed unless validationContractV711() still equals it (the hash covers the V7.11 files and the V7.8 parent).
export function currentContractBinding({contract=validationContractV711}={}){
  return {verifier_version:FACTORY_VERIFIER_VERSION_V711,validation_contract_hash:contract(),prompt_hash:V711_PROMPT_HASH,author_policy:ORIGINAL_AUTHOR_POLICY_V79};
}
export function assertV711ContractBound(recorded,{contract=validationContractV711}={}){
  if(!recorded?.validation_contract_hash||!recorded.verifier_version||!recorded.prompt_hash)throw Error('v711_contract_binding_missing');
  if(recorded.verifier_version!==FACTORY_VERIFIER_VERSION_V711)throw Error('v711_verifier_version_changed');
  if(contract()!==recorded.validation_contract_hash)throw Error('v711_validation_contract_hash_changed');
  if(V711_PROMPT_HASH!==recorded.prompt_hash)throw Error('v711_prompt_hash_changed');
  return recorded;
}
// Dependencies the pilot's behaviour rests on: execution refuses if any of them changed after registration.
export const PILOT_DEPENDENCY_FILES=Object.freeze([
  'scripts/pipeline/lib/factoryTransport.mjs','scripts/pipeline/lib/longFetch.mjs','scripts/pipeline/lib/budgetLedger.mjs','scripts/pipeline/lib/campaignExecutionV7.mjs','scripts/pipeline/lib/scopedAccounting.mjs',
  'scripts/pipeline/lib/savedRequestBody.mjs','scripts/pipeline/lib/atomicArtifact.mjs','scripts/pipeline/lib/batchInspection.mjs','scripts/pipeline/lib/briefDiversity.mjs',
  'scripts/pipeline/lib/ideaAllocation.mjs','scripts/pipeline/lib/ideaAllocationV76.mjs','scripts/pipeline/lib/focusedBriefsV7.mjs','scripts/pipeline/lib/candidateFormatVNext.mjs','scripts/pipeline/lib/authorIntegrityV7.mjs',
  'scripts/pipeline/lib/constrainedAuthoring.mjs','scripts/pipeline/lib/factoryCore.mjs','scripts/pipeline/lib/factoryEvidence.mjs','scripts/pipeline/lib/factoryEvidenceV7.mjs',
  'scripts/pipeline/lib/factoryEvidenceV73.mjs','scripts/pipeline/lib/factoryEvidenceV74.mjs','scripts/pipeline/lib/factoryEvidenceV75.mjs','scripts/pipeline/lib/factoryEvidenceV76.mjs','scripts/pipeline/lib/factoryEvidenceV711.mjs',
  'scripts/pipeline/lib/contractV7.mjs','scripts/pipeline/lib/contractV73.mjs','scripts/pipeline/lib/contractV74.mjs','scripts/pipeline/lib/contractV75.mjs','scripts/pipeline/lib/contractV76.mjs','scripts/pipeline/lib/contractV77.mjs','scripts/pipeline/lib/contractV78.mjs','scripts/pipeline/lib/contractV711.mjs',
  'scripts/pipeline/lib/optionResolutionV711.mjs','scripts/pipeline/lib/premiseBindingV78.mjs','scripts/pipeline/lib/verifyV75.mjs','scripts/pipeline/lib/verifyV711.mjs',
  'scripts/pipeline/lib/preparationValueV75.mjs','scripts/pipeline/lib/preparationValueV76.mjs','scripts/pipeline/lib/originalAuthorPolicyV74.mjs','scripts/pipeline/lib/originalAuthorPolicyV75.mjs','scripts/pipeline/lib/originalAuthorPolicyV76.mjs','scripts/pipeline/lib/originalAuthorPolicyV79.mjs',
  'scripts/pipeline/lib/factoryStore.mjs','scripts/pipeline/lib/factoryFailure.mjs','scripts/pipeline/lib/measurementInspectionVNext.mjs','scripts/pipeline/lib/freshCuetReadinessV73Guards.mjs','scripts/pipeline/lib/candidateCRegistration.mjs',
  'scripts/pipeline/lib/sourceContextIntegrityVNext.mjs','scripts/pipeline/lib/topicCoverage.mjs','scripts/pipeline/lib/focusedCoverage.mjs','scripts/pipeline/lib/factoryNetworkLaunchPreflight.mjs',
  'scripts/pipeline/lib/cuetPilotV75Deps.mjs','scripts/pipeline/lib/cuetPilotV711Deps.mjs','scripts/pipeline/lib/cuetPilotV75Run.mjs',
  'artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/authorFormatC.mjs','data/cuet_fit_evidence.mjs','data/question_factory_policy.mjs',
  'data/source_registry.json',STIMULI_OVERLAY_PATH,'artifacts/question-factory/cuet-readiness-2026-10-08/c-source-overlay/leac203.private-source.json']);
// The pilot's own tooling is bound too, but a deliberate fix after registration is allowed with --allow-tooling-change and is then recorded in the run state.
// cuetPilotV75Run.mjs is the version-neutral engine and is bound as a dependency above.
export const PILOT_TOOLING_FILES=Object.freeze([
  'scripts/pipeline/tools/prepareCuetPilotV711.mjs','scripts/pipeline/tools/runCuetPilotV711.mjs','scripts/pipeline/lib/cuetPilotV711Plan.mjs','scripts/pipeline/lib/cuetPilotV711Export.mjs']);
export const fileHashes=(paths,read=readFileSync)=>Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(read(path)).digest('hex')]));
export const pricingBinding=prices=>({gpt_6_luna:prices.models?.['gpt-6-luna'],gemini_3_8_flash:prices.models?.['gemini-3.8-flash']});
