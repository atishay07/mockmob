import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';
import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {focusedBriefs} from '../lib/focusedCoverage.mjs';
import {retrieveFocusedSources} from '../lib/focusedSources.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
import {factoryCalibrationReady,hashJSON} from '../../../data/question_factory_policy.mjs';
try{loadEnvFile('.env.local');}catch{}
const name=process.argv[2];if(!/^[a-z0-9][a-z0-9-]{3,60}$/.test(name||'')||!process.argv.includes('--staging'))throw Error('named_staging_campaign_required');
loadEnvFile('.env.staging');if(process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('wrong_staging_project');
const directory=resolve('artifacts/question-factory',name);if(existsSync(directory))throw Error('campaign_exists_resume_without_regeneration');
const registry=JSON.parse(readFileSync('data/source_registry.json')),manifest=JSON.parse(readFileSync('data/calibration_manifest.json'));
if(!factoryCalibrationReady(manifest,registry,FACTORY_VERIFIER_VERSION))throw Error('current_calibration_required');
const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),ledger=new BudgetLedger('data/pipeline-budget.sqlite');
const save=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
try{
 ledger.assertHistoryReconciled();const inventory=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id'),coverage=detailedCoverage(inventory,registry,{heldFamilies:holds.map(h=>h.family_id)});
 const jobs=focusedBriefs(coverage,registry,{campaignId:name,perSubject:25,branch:process.argv.includes('--computerized')?'computerized':'financial_analysis'}),plannedTopics=new Map();
 for(const j of jobs){const topics=coverage.cells.find(c=>c.subject===j.subject&&c.chapter===j.chapter)?.topics||[];
  const ranked=[...topics].sort((a,b)=>(a.usable+(plannedTopics.get(a.id)||0))-(b.usable+(plannedTopics.get(b.id)||0))||(a.formats[j.format]||0)-(b.formats[j.format]||0)||(a.difficulties[j.difficulty]||0)-(b.difficulties[j.difficulty]||0)||a.id.localeCompare(b.id));
  if(ranked.length){j.topic=ranked[0].text;plannedTopics.set(ranked[0].id,(plannedTopics.get(ranked[0].id)||0)+1);j.topic_coverage_before={id:ranked[0].id,usable:ranked[0].usable};}
  j.source_pack_id=`original-${j.subject}-reference-v1`;j.source_pack_version=registry.packs[j.source_pack_id].version;j.research=retrieveFocusedSources(registry,j,ledger);j.source_refs=j.research.refs;
  registry.families[j.family_id]={state:'active',version:1,source_pack_id:j.source_pack_id,kind:'original_practice'};
 }
 for(const subject of ['english','accountancy','business_studies','economics'])jobs.filter(j=>j.subject===subject).sort((a,b)=>hashJSON({position_seed:a.id}).localeCompare(hashJSON({position_seed:b.id}))).forEach((j,i)=>j.requested_answer_position='ABCD'[i%4]);
 for(const chapter of ['Factual Passage','Narrative Passage','Literary Passage']){
  const siblings=jobs.filter(j=>j.subject==='english'&&j.chapter===chapter);if(!siblings.length)continue;
  const document=Object.values(registry.sources).find(s=>s.id.startsWith('mockmob-original-stimulus-')&&s.state==='active'&&s.chapters?.includes(chapter));
  const source=document?{state:'active',kind:'original_practice',passage_text:document.facts.stimulus.text,source_pack_id:'original-english-reference-v1'}:null,id='original-passage-'+hashJSON({name,chapter}).slice(0,20);
  if(!source)throw Error('complete_original_stimulus_required');
  siblings.forEach(j=>{j.passage_text=source.passage_text;});
  // A lone self-contained passage item has no sibling-group contract. Creating
  // a one-child group would deadlock the two-child atomic publication gate.
  if(siblings.length>=2){
   siblings.forEach((j,i)=>{j.passage_group_id=id;j.order_index=i;});
   registry.passage_groups[id]={...source,id,candidate_ids:siblings.map(j=>j.id),version:1};
  }
 }
 mkdirSync(directory,{recursive:true});save(directory+'/inventory-coverage-before.json',coverage);save(directory+'/registry.json',registry);
 // Appending new families does not alter source versions or the verified model
 // contracts. The existing benchmark remains a dated measurement, never a fresh run.
 save('data/source_registry.json',registry);
 const benchmark=JSON.parse(readFileSync('artifacts/question-factory/execution-2026-10-07/benchmark.json'));save(directory+'/benchmark.json',benchmark);
 save(directory+'/campaign.json',{id:name,preregistered_at:new Date().toISOString(),verifier:FACTORY_VERIFIER_VERSION,registry_version:registry.version,denominator:100,per_subject:25,
  branch:process.argv.includes('--computerized')?'computerized':'financial_analysis',budget_start:ledger.snapshot(),request_ids_before:ledger.db.prepare('SELECT id FROM requests').all().map(r=>r.id),source_retrieval_cost_usd:0,planning_cost_usd:0,maximum_repairs_per_candidate:1,no_regeneration:true,jobs});
 console.log(JSON.stringify({directory,jobs:100,coverage:coverage.total_usable,paid_requests:0,calibration_basis:'Existing completed measurement reused under unchanged content and verification contracts'}));
}finally{ledger.close();}
