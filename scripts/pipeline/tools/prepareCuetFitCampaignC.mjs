// Freeze the cost/source-selection iteration only after both comparison arms
// and the current-bank reassessment finish. Read staging; never edit its bank.
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {focusedBriefsV7} from '../lib/focusedBriefsV7.mjs';
import {diversifyBrief} from '../lib/briefDiversity.mjs';
import {retrieveFocusedSources} from '../lib/focusedSources.mjs';
import {authorOriginal} from '../lib/factoryCore.mjs';
import {constrainedAuthoring,QUOTE_AUTHOR_CONTRACT} from '../lib/constrainedAuthoring.mjs';
import {authoringAddendumV7,AUTHOR_ADDENDUM_V7_ID} from '../lib/authorIntegrityV7.mjs';
import {FACTORY_VERIFIER_VERSION_V7,V7_PROMPT_HASH} from '../lib/factoryEvidenceV7.mjs';
import {validationContractV7} from '../lib/contractV7.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {candidateCSourceViews,reassessedStagingInventory,currentCCodeHashes,priorCampaignPlanningContext,planningReferenceContext,assertCandidateCPrerequisites,assertCandidateCFixedCohort,refreshCoverageWithCurrentReassessment,C_SOURCE_OVERLAY_PATH} from '../lib/candidateCRegistration.mjs';
import {C_TRANSPORT_PROFILE_VNEXT,C_TRANSPORT_PROFILE_VNEXT_HASH} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/candidateTransportProfileC.mjs';
import {authorFormatC,C_AUTHOR_FORMAT_CONTRACT} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/lib/authorFormatC.mjs';

const root='artifacts/question-factory/cuet-readiness-2026-10-08',name='cuet-readiness-cost-source-c-100-2026-10-08',directory='artifacts/question-factory/'+name;
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'}),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(!process.argv.includes('--staging'))throw Error('separate_staging_required');
if(existsSync(directory))throw Error('campaign_exists_resume_saved_ids_without_regeneration');
const dry=process.argv.includes('--dry-run'),branch=process.argv.includes('--computerized')?'computerized':'financial_analysis';
const arms=['baseline','improved'].map(name=>{const dir='artifacts/question-factory/cuet-readiness-'+name+'-100-2026-10-08';return {name,report:read(dir+'/batch-report.json'),campaign:read(dir+'/campaign.json'),items:read(dir+'/all-candidates.json')};});
const reports=arms.map(arm=>arm.report),priorCampaigns=arms.map(({campaign,items})=>({campaign,items}));
const priorAttempts=priorCampaignPlanningContext(priorCampaigns);
if(priorAttempts.length!==200)throw Error('all_prior_comparison_attempts_required_for_novelty');
const reassessment=read(root+'/reassessment/profile.json'),raw=readFileSync(root+'/reassessment/results.jsonl','utf8');
if(raw&&!raw.endsWith('\n'))throw Error('reassessment_writer_must_finish_before_registration');
const results=raw.split('\n').filter(Boolean).map(JSON.parse);
assertCandidateCPrerequisites(arms,reassessment,results);
const privateSourceOverlay=read(C_SOURCE_OVERLAY_PATH);
const registry=read('data/source_registry.json'),sourceViews=candidateCSourceViews(registry,privateSourceOverlay);
// Check completeness before any network access or paid generation.
reassessedStagingInventory([],results,reassessment);
try{loadEnvFile('.env.local');}catch{}loadEnvFile('.env.staging');
if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
  const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),ledger=new BudgetLedger('data/pipeline-budget.sqlite');
try{
  ledger.assertHistoryReconciled();
  const staged=await readBankSnapshot(db),held=await readAllRows(db,'recovery_family_holds','family_id','family_id'),qualified=reassessedStagingInventory(staged,results,reassessment);
  const local=sourceViews.registry,selection=sourceViews.selection_registry;
  const planningContext=planningReferenceContext([...staged,...priorAttempts],local);
  const coverage=refreshCoverageWithCurrentReassessment(
    detailedCoverage(qualified.inventory,registry,{heldFamilies:held.map(h=>h.family_id)}),results,reassessment);
  coverage.qualification_basis=qualified.basis;coverage.staging_raw_count=staged.length;coverage.current_reassessment_excluded=qualified.excluded;
  const jobs=focusedBriefsV7(coverage,selection,{campaignId:name,perSubject:25,branch}),prepared=[],topicsPlanned=new Map();
  assertCandidateCFixedCohort(jobs);
  for(const j of jobs){
    const topics=coverage.cells.find(c=>c.subject===j.subject&&c.chapter===j.chapter)?.topics||[];
    const ranked=[...topics].sort((a,b)=>(a.usable+(topicsPlanned.get(a.id)||0))-(b.usable+(topicsPlanned.get(b.id)||0))||(a.formats[j.format]||0)-(b.formats[j.format]||0)||a.id.localeCompare(b.id));
    if(ranked.length){j.topic=ranked[0].text;j.topic_coverage_before={id:ranked[0].id,usable:ranked[0].usable};topicsPlanned.set(ranked[0].id,(topicsPlanned.get(ranked[0].id)||0)+1);}
    j.source_pack_id='original-'+j.subject+'-reference-v1';j.source_pack_version=local.packs[j.source_pack_id].version;j.official_syllabus_topic=j.topic;
    j.author_contract=QUOTE_AUTHOR_CONTRACT;j.author_addendum=AUTHOR_ADDENDUM_V7_ID;
    const priorIdeas=priorAttempts.filter(q=>q.subject===j.subject&&q.chapter===j.chapter).map(q=>q.body||q.topic).filter(Boolean);
    j.avoidance=[...new Set([...priorIdeas,...j.avoidance])].slice(0,12);
    j.research=diversifyBrief(j,selection,planningContext,{planned:prepared})||retrieveFocusedSources(selection,j,ledger);j.source_refs=j.research.refs;
    if(j.research.topic)j.topic=j.research.topic;
    j.source_context_contract=sourceViews.contract;j.retrieval_support_status='Pending independent entailment; exact teaching context and ranking do not prove the key.';
    local.families[j.family_id]={state:'active',version:1,source_pack_id:j.source_pack_id,kind:'original_practice'};prepared.push(j);
  }
  for(const chapter of ['Factual Passage','Narrative Passage','Literary Passage']){
    const siblings=jobs.filter(j=>j.subject==='english'&&j.chapter===chapter);if(!siblings.length)continue;
    const stimuli=Object.values(local.sources).filter(s=>s.state==='active'&&s.id.startsWith('mockmob-original-stimulus-')&&s.chapters?.includes(chapter)&&s.facts.stimulus?.text);
    stimuli.sort((a,b)=>planningContext.filter(q=>q.passage_text===a.facts.stimulus.text).length-planningContext.filter(q=>q.passage_text===b.facts.stimulus.text).length||hashJSON({name,id:a.id}).localeCompare(hashJSON({name,id:b.id})));
    const document=stimuli[0];if(!document||document.facts.stimulus.text.trim().split(/\s+/).length>300)throw Error('complete_within_limit_original_stimulus_required');
    const group='original-passage-'+hashJSON({name,chapter}).slice(0,20),ref={id:document.id,version:document.version,locator:'stimulus',support_hash:document.supports.stimulus};
    siblings.forEach((j,i)=>{j.passage_text=document.facts.stimulus.text;j.source_refs=[ref];j.topic=chapter+': test a distinct detail, supported inference or textual relationship in this printed fictional passage.';j.research={refs:[ref],excerpts:[{...ref,text:j.passage_text}],state:'retrieved_pending_entailment',cost_usd:0};if(siblings.length>1){j.passage_group_id=group;j.order_index=i;}});
    if(siblings.length>1)local.passage_groups[group]={state:'active',kind:'original_practice',passage_text:document.facts.stimulus.text,source_pack_id:'original-english-reference-v1',id:group,candidate_ids:siblings.map(j=>j.id),version:1};
  }
  const subjects=['english','accountancy','business_studies','economics'];for(const subject of subjects)jobs.filter(j=>j.subject===subject).sort((a,b)=>hashJSON({position_seed:a.id}).localeCompare(hashJSON({position_seed:b.id}))).forEach((j,i)=>j.requested_answer_position='ABCD'[i%4]);
  const ordered=[];for(let i=0;i<25;i++)for(const subject of subjects)ordered.push(jobs.filter(j=>j.subject===subject)[i]);ordered.forEach((j,i)=>j.number=i+1);
  const captures=[];for(const job of ordered){
    const offline={generate:async(provider,body)=>{captures.push({id:job.id,provider,bytes:Buffer.byteLength(JSON.stringify(body)),has_support:job.source_refs.length>0});throw Error('offline_input_captured');}};
    try{await authorOriginal(job,{registry:local,transport:authorFormatC(constrainedAuthoring(authoringAddendumV7(offline,job),job),job)});}catch(e){if(e.message!=='offline_input_captured')throw e;}
  }
  const price=read('data/pipeline-prices.json').models['gpt-6-luna'];if(captures.length!==100||captures.some(c=>c.bytes>price.max_input_tokens||!c.has_support))throw Error('candidate_c_authoring_preflight_failed');
  const preflight={at:new Date().toISOString(),denominator:100,author_format_contract:C_AUTHOR_FORMAT_CONTRACT,requested_formats:Object.fromEntries(subjects.map(subject=>[subject,ordered.filter(j=>j.subject===subject).reduce((counts,j)=>({...counts,[j.format]:(counts[j.format]||0)+1}),{})])),source_context_reports:sourceViews.reports,prior_attempts_for_novelty:priorAttempts.length,planning_context_hash:hashJSON(planningContext),prior_attempts_added_to_usable_coverage:0,input_captures:captures,paid_calls:0,global_registry_writes:0,staging_writes:0};
  if(dry){console.log(JSON.stringify({...preflight,input_captures:captures.length,maximum_bytes:Math.max(...captures.map(c=>c.bytes)),coverage_usable:coverage.total_usable,ready_to_register:true}));}
  else{
  mkdirSync(directory,{recursive:true});save(directory+'/registry.json',local);save(directory+'/inventory-coverage-before.json',coverage);save(directory+'/preflight.json',preflight);
  const profile={contract:'cuet-fit-v7',topology:'dual_blind',arm:'cost_source_c',measurement_only:true,publication_policy:'never',cap_usd:5,verifier_version:FACTORY_VERIFIER_VERSION_V7,prompt_hash:V7_PROMPT_HASH,contract_hash:validationContractV7(),registry_version:local.version,registry_sha256:sha(directory+'/registry.json'),worker_sha256:sha('artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline/tools/cuetFitFactoryC.mjs'),code_hashes:currentCCodeHashes(),transport_profile:{name:C_TRANSPORT_PROFILE_VNEXT.policy_name,hash:C_TRANSPORT_PROFILE_VNEXT_HASH},source_context_contract:sourceViews.contract,private_source_overlay:sourceViews.overlay_binding};
  save(directory+'/campaign.json',{id:name,preregistered_at:new Date().toISOString(),verifier:profile.verifier_version,topology:'dual_blind',arm:profile.arm,registry_version:local.version,denominator:100,per_subject:25,branch,measurement_only:true,publication_policy:'never',cap_usd:5,budget_start:ledger.snapshot(),request_ids_before:ledger.db.prepare('SELECT id FROM requests').all().map(r=>r.id),maximum_repairs_per_candidate:1,no_regeneration:true,source_retrieval_cost_usd:0,planning_cost_usd:0,jobs:ordered});
  profile.campaign_sha256=sha(directory+'/campaign.json');save(directory+'/verification-profile.json',profile);
  save(directory+'/PREREGISTRATION.json',{...profile,denominator:100,per_subject:25,baseline_and_improved_reports:reports.map(r=>({id:r.id,approved:r.approved_unique,rejected:r.rejected,cost:r.cost})),changed_components:['Verified teaching-only reference selection','NCERT Financial Statements of a Company private C source overlay','Strict statement option display normalization','Repair route/group preservation','Luna realtime/flex with native Gemini batches of at most ten requests'],comparison_scope:'Whole-pipeline iteration; multiple changes prohibit single-variable causal claims.',provider_latency:'Native batch completion may take up to 24 hours; accepted IDs are resumed, never replaced.',publication:'never',budget:'USD 50 lifetime; USD 5 campaign cap; no cap increase authorized.'});
  console.log(JSON.stringify({directory,registered:100,per_subject:25,paid_calls:0,global_registry_writes:0,staging_writes:0}));
  }
}finally{ledger.close();}
