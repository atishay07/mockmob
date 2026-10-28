// Registers one fixed, preregistered CUET-fit campaign from ACTUAL coverage gaps. No provider call is made here.
// Usage: node scripts/pipeline/tools/prepareCuetFitCampaign.mjs <name> --staging --topology single_luna --arm baseline|improved [--per-subject 25]
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {focusedBriefs} from '../lib/focusedCoverage.mjs';
import {focusedBriefsV7} from '../lib/focusedBriefsV7.mjs';
import {retrieveFocusedSources} from '../lib/focusedSources.mjs';
import {diversifyBrief} from '../lib/briefDiversity.mjs';
import {QUOTE_AUTHOR_CONTRACT} from '../lib/constrainedAuthoring.mjs';
import {TOPOLOGIES,FACTORY_VERIFIER_VERSION_V7,V7_PROMPT_HASH} from '../lib/factoryEvidenceV7.mjs';
import {validationContractV7} from '../lib/contractV7.mjs';
import {AUTHOR_ADDENDUM_V7_ID} from '../lib/authorIntegrityV7.mjs';
import {cuetFitReleased,PRODUCTION_TOPOLOGIES} from '../../../data/cuet_fit_evidence.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {registrationPolicy} from '../lib/campaignExecutionV7.mjs';
try{loadEnvFile('.env.local');}catch{}
const arg=(n,d=null)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:d;};
const name=process.argv[2];if(!/^[a-z0-9][a-z0-9-]{3,60}$/.test(name||'')||!process.argv.includes('--staging'))throw Error('named_staging_campaign_required');
loadEnvFile('.env.staging');if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
const topologyId=arg('--topology'),arm=arg('--arm','baseline'),perSubject=Number(arg('--per-subject',25)),branch=process.argv.includes('--computerized')?'computerized':'financial_analysis';
if(!TOPOLOGIES[topologyId]||!['baseline','improved'].includes(arm))throw Error('topology_and_arm_required');
if(!PRODUCTION_TOPOLOGIES.includes(topologyId))throw Error('full_validator_topology_required');
const directory=resolve('artifacts/question-factory',name);if(existsSync(directory))throw Error('campaign_exists_resume_without_regeneration');
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const registry=read('data/source_registry.json'),manifest=read('data/calibration_manifest.json');
const execution=registrationPolicy({measurementOnly:process.argv.includes('--measurement-only'),staging:process.argv.includes('--staging'),capUsd:Number(arg('--cap-usd',4)),releaseAvailable:cuetFitReleased(manifest,registry,{validation_topology:topologyId,verifier_version:FACTORY_VERIFIER_VERSION_V7,checks:{blind_solution:{evaluation_prompt:V7_PROMPT_HASH}}})});
const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),ledger=new BudgetLedger('data/pipeline-budget.sqlite');
try{
 ledger.assertHistoryReconciled();const inventory=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id'),coverage=detailedCoverage(inventory,registry,{heldFamilies:holds.map(h=>h.family_id)});
 const {data:pending,error:pendingError}=await db.from('question_factory_jobs').select('generation_brief,candidate').not('state','in','(quarantined,published)');if(pendingError)throw Error('pending_brief_inventory_unavailable:'+pendingError.code);
 const planningContext=pending.map(j=>j.candidate||j.generation_brief).filter(Boolean);
 const jobs=(arm==='improved'?focusedBriefsV7:focusedBriefs)(coverage,registry,{campaignId:name,perSubject,branch}),plannedTopics=new Map(),prepared=[];
 for(const j of jobs){const topics=coverage.cells.find(c=>c.subject===j.subject&&c.chapter===j.chapter)?.topics||[];
  const ranked=[...topics].sort((a,b)=>(a.usable+(plannedTopics.get(a.id)||0))-(b.usable+(plannedTopics.get(b.id)||0))||(a.formats[j.format]||0)-(b.formats[j.format]||0)||(a.difficulties[j.difficulty]||0)-(b.difficulties[j.difficulty]||0)||a.id.localeCompare(b.id));
  if(ranked.length){j.topic=ranked[0].text;plannedTopics.set(ranked[0].id,(plannedTopics.get(ranked[0].id)||0)+1);j.topic_coverage_before={id:ranked[0].id,usable:ranked[0].usable};}
  j.source_pack_id=`original-${j.subject}-reference-v1`;j.source_pack_version=registry.packs[j.source_pack_id].version;
  j.official_syllabus_topic=j.topic;j.author_contract=QUOTE_AUTHOR_CONTRACT;if(arm==='improved')j.author_addendum=AUTHOR_ADDENDUM_V7_ID;
  j.research=diversifyBrief(j,registry,inventory,{planned:[...planningContext,...prepared]})||retrieveFocusedSources(registry,j,ledger);j.source_refs=j.research.refs;
  if(j.research.topic)j.topic=j.research.topic;
  j.avoidance=coverage.cells.find(c=>c.subject===j.subject&&c.chapter===j.chapter)?.ideas.slice(-30).map(q=>q.body)||[];
  prepared.push(j);registry.families[j.family_id]={state:'active',version:1,source_pack_id:j.source_pack_id,kind:'original_practice'};
 }
 for(const subject of ['english','accountancy','business_studies','economics'])jobs.filter(j=>j.subject===subject).sort((a,b)=>hashJSON({position_seed:a.id}).localeCompare(hashJSON({position_seed:b.id}))).forEach((j,i)=>j.requested_answer_position='ABCD'[i%4]);
 for(const chapter of ['Factual Passage','Narrative Passage','Literary Passage']){
  const siblings=jobs.filter(j=>j.subject==='english'&&j.chapter===chapter);if(!siblings.length)continue;
  const passages=Object.values(registry.sources).filter(s=>s.id.startsWith('mockmob-original-stimulus-')&&s.state==='active'&&s.chapters?.includes(chapter));
  const usage=s=>[...inventory,...planningContext].filter(q=>q.passage_text===s.facts.stimulus.text).length;
  passages.sort((a,b)=>usage(a)-usage(b)||hashJSON({name,id:a.id}).localeCompare(hashJSON({name,id:b.id})));
  const document=passages[0];if(!document)throw Error('complete_original_stimulus_required');
  const id='original-passage-'+hashJSON({name,chapter}).slice(0,20),passageRef={id:document.id,version:document.version,locator:'stimulus',support_hash:document.supports.stimulus};
  siblings.forEach(j=>{j.passage_text=document.facts.stimulus.text;j.source_refs=[passageRef];j.topic=chapter+': test a distinct supported detail, inference or textual relationship in this original fictional stimulus.';j.research={refs:[passageRef],excerpts:[{...passageRef,text:document.facts.stimulus.text}],cost_usd:0,state:'retrieved_pending_entailment'};});
  if(siblings.length>=2){siblings.forEach((j,i)=>{j.passage_group_id=id;j.order_index=i;});registry.passage_groups[id]={state:'active',kind:'original_practice',passage_text:document.facts.stimulus.text,source_pack_id:'original-english-reference-v1',id,candidate_ids:siblings.map(j=>j.id),version:1};}
 }
 // Interleave subjects so every wave of ten mixes subjects; the denominator is unchanged.
 {const bySubject=['english','accountancy','business_studies','economics'].map(x=>jobs.filter(j=>j.subject===x)),mixed=[];for(let i=0;i<perSubject;i++)for(const list of bySubject)if(list[i])mixed.push(list[i]);jobs.splice(0,jobs.length,...mixed);jobs.forEach((j,i)=>{j.number=i+1;});}
 mkdirSync(directory,{recursive:true});save(directory+'/inventory-coverage-before.json',coverage);save(directory+'/registry.json',registry);
 // Atomic update so the retained controller never reads a partial registry.
 writeFileSync('data/source_registry.json.tmp',JSON.stringify(registry,null,2)+'\n');renameSync('data/source_registry.json.tmp','data/source_registry.json');
 save(directory+'/verification-profile.json',{contract:'cuet-fit-v7',topology:topologyId,arm,...execution,verifier_version:FACTORY_VERIFIER_VERSION_V7,prompt_hash:V7_PROMPT_HASH,contract_hash:validationContractV7(),registry_version:registry.version,release:manifest.cuet_fit_releases?.[topologyId]||null});
 const campaign={id:name,preregistered_at:new Date().toISOString(),verifier:FACTORY_VERIFIER_VERSION_V7,topology:topologyId,arm,registry_version:registry.version,denominator:jobs.length,per_subject:perSubject,branch,
  budget_start:ledger.snapshot(),request_ids_before:ledger.db.prepare('SELECT id FROM requests').all().map(r=>r.id),source_retrieval_cost_usd:0,planning_cost_usd:0,author_contract:QUOTE_AUTHOR_CONTRACT,author_addendum:arm==='improved'?AUTHOR_ADDENDUM_V7_ID:null,
  planning_pending_context:planningContext.length,pending_items_counted_as_usable:0,maximum_repairs_per_candidate:1,no_regeneration:true,...execution,jobs};
 save(directory+'/campaign.json',campaign);
 writeFileSync(directory+'/PREREGISTRATION.md',`# ${name}\n\nRegistered ${campaign.preregistered_at} before any provider call.\n\n* Denominator: ${jobs.length} candidates chosen from actual usable-inventory gaps (deterministic coverage plan, hash ${hashJSON(jobs.map(j=>[j.id,j.subject,j.chapter,j.format,j.difficulty])).slice(0,16)}).\n* Contract: cuet-fit-v7, topology ${topologyId}, arm ${arm}${arm==='improved'?` (author addendum ${AUTHOR_ADDENDUM_V7_ID})`:' (legacy authoring prompt, no addendum)'}.\n* Every candidate, repair, failure, hold and cost stays in the denominator. No regeneration or replacement of a rejected candidate. At most one targeted repair.\n* Budget: persistent USD 50 lifetime guard; this campaign is expected to cost under USD 1.\n`);
 console.log(JSON.stringify({directory,jobs:jobs.length,topology:topologyId,arm,coverage_usable:coverage.total_usable,paid_requests:0}));
}finally{ledger.close();}
