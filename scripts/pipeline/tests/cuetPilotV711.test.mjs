import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import * as Plan from '../lib/cuetPilotV711Plan.mjs';
import {runPilot,expectedFreshState,isTerminal} from '../lib/cuetPilotV75Run.mjs';
import {buildPilotExport} from '../lib/cuetPilotV711Export.mjs';
import {buildPilotDepsV711} from '../lib/cuetPilotV711Deps.mjs';
import {V711_OUTPUT_CAPS,V711_PROMPT_HASH} from '../lib/factoryEvidenceV711.mjs';
import {DEFAULT_IDEA_ALLOCATION_V76_PATH} from '../lib/ideaAllocationV76.mjs';
import {DEFAULT_IDEA_ALLOCATION_PATH} from '../lib/ideaAllocation.mjs';

const root=resolve(import.meta.dirname,'../../..');
const prepare=resolve(root,'scripts/pipeline/tools/prepareCuetPilotV711.mjs'),runner=resolve(root,'scripts/pipeline/tools/runCuetPilotV711.mjs');
const inputsPresent=existsSync(resolve(root,Plan.STOCK_REASSESSMENT_DIRECTORY,'profile.json'))&&existsSync(resolve(root,Plan.STIMULI_OVERLAY_PATH));
const node=(args,env={})=>spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,...env},maxBuffer:64*1024*1024});
const scratch=()=>mkdtempSync(join(tmpdir(),'mm-v711-pilot-'));
const stat=path=>existsSync(path)?`${statSync(path).mtimeMs}:${statSync(path).size}`:'absent';
const subjects=Plan.PILOT_SUBJECTS;

// ------------------------------------------------------------------ plan and contract

test('constants bind the V7.11 pilot, the V7.11 evaluation caps and a stop file of its own',()=>{
  assert.equal(Plan.PILOT_CONTRACT,'cuet-pilot-v711-measurement-v1');
  assert.equal(Plan.PILOT_ID,'cuet-pilot-v711-40-2026-10-09');
  assert.equal(Plan.PILOT_DIRECTORY,'artifacts/question-factory/cuet-pilot-v711-40-2026-10-09');
  assert.equal(Plan.V75_PILOT_DIRECTORY,'artifacts/question-factory/cuet-pilot-v75-40-2026-10-09');
  assert.deepEqual({...Plan.STAGE_OUTPUT_CAPS},{author:6500,repair:9000,luna_evaluation:16000,gemini_evaluation:6000,explanation_audit:8000});
  assert.equal(Plan.STAGE_OUTPUT_CAPS.luna_evaluation,V711_OUTPUT_CAPS.blind_solution);
  assert.equal(Plan.STAGE_OUTPUT_CAPS.gemini_evaluation,V711_OUTPUT_CAPS.independent_evaluation);
  assert.equal(Plan.STAGE_OUTPUT_CAPS.explanation_audit,V711_OUTPUT_CAPS.explanation_support);
  assert.equal(Plan.STOP_FILE_V711,'data/question-factory-runtime/STOP_V711_PILOT');
  assert.equal(Plan.PILOT_DENOMINATOR,40);assert.equal(Plan.PILOT_PER_SUBJECT,10);assert.equal(Plan.PILOT_WAVE_SIZE,10);assert.ok(Plan.PILOT_CAP_USD_MAX<=3);
  const english=Plan.PILOT_ENGLISH_FORMAT_PLAN;
  assert.equal(Object.values(english).reduce((a,b)=>a+b,0),10);
  assert.ok(!Object.keys(english).some(k=>/match|order|sequence/.test(k)),'no matching or ordering in the English plan');
  assert.ok(english.reading_comprehension>=4&&english.reading_comprehension<=6);
});
test('every dependency and tooling file the registration will hash exists, including the V7.11 modules, longFetch and the deps',()=>{
  const missing=[...Plan.PILOT_DEPENDENCY_FILES,...Plan.PILOT_TOOLING_FILES].filter(p=>!existsSync(resolve(root,p)));
  assert.deepEqual(missing,[]);
  for(const required of ['scripts/pipeline/lib/contractV711.mjs','scripts/pipeline/lib/optionResolutionV711.mjs','scripts/pipeline/lib/factoryEvidenceV711.mjs','scripts/pipeline/lib/verifyV711.mjs',
    'scripts/pipeline/lib/longFetch.mjs','scripts/pipeline/lib/cuetPilotV711Deps.mjs','scripts/pipeline/lib/originalAuthorPolicyV76.mjs','scripts/pipeline/lib/ideaAllocationV76.mjs'])
    assert.ok(Plan.PILOT_DEPENDENCY_FILES.includes(required),required);
});
test('contract binding refuses a changed V7.11 contract, verifier version or prompt hash',()=>{
  const binding=Plan.currentContractBinding();
  assert.match(binding.validation_contract_hash,/^[a-f0-9]{64}$/);assert.equal(binding.prompt_hash,V711_PROMPT_HASH);
  assert.equal(Plan.assertV711ContractBound(binding),binding);
  assert.throws(()=>Plan.assertV711ContractBound({...binding,validation_contract_hash:'0'.repeat(64)}),/v711_validation_contract_hash_changed/);
  assert.throws(()=>Plan.assertV711ContractBound(binding,{contract:()=>'f'.repeat(64)}),/v711_validation_contract_hash_changed/);
  assert.throws(()=>Plan.assertV711ContractBound({...binding,verifier_version:'cuet-fit-validator-v7.5'}),/v711_verifier_version_changed/);
  assert.throws(()=>Plan.assertV711ContractBound({...binding,prompt_hash:'1'.repeat(64)}),/v711_prompt_hash_changed/);
  assert.throws(()=>Plan.assertV711ContractBound(null),/v711_contract_binding_missing/);
  assert.throws(()=>Plan.assertV711ContractBound({}),/v711_contract_binding_missing/);
});

let dryRun;
function plannedDryRun(){
  if(dryRun)return dryRun;
  const dir=scratch(),result=node([prepare,'--inventory-file','--dry-run','--out-dir',join(dir,'pilot').replaceAll('\\','/'),'--allocations-path',join(dir,'alloc.json')]);
  assert.equal(result.status,0,result.stderr);
  assert.ok(!existsSync(join(dir,'pilot')),'a dry run writes nothing');assert.ok(!existsSync(join(dir,'alloc.json')),'a dry run never opens the allocator');
  return dryRun=JSON.parse(result.stdout);
}
test('the plan is exactly 40 jobs: 10 per subject in 4 waves of ten, no English matching or ordering, distinct reading passages',{skip:!inputsPresent},()=>{
  const out=plannedDryRun();
  assert.equal(out.briefs.length,40);assert.equal(out.denominator,40);
  for(const subject of subjects)assert.equal(out.briefs.filter(b=>b.subject===subject).length,10,subject);
  assert.equal(new Set(out.briefs.map(b=>b.id)).size,40);
  assert.deepEqual(out.plan.wave_subjects.map(w=>Object.values(w).reduce((a,b)=>a+b,0)),[10,10,10,10]);
  assert.deepEqual(out.plan.requested_answer_positions,{A:10,B:10,C:10,D:10});
  const english=out.briefs.filter(b=>b.subject==='english');
  assert.equal(english.filter(b=>/match|order|sequence|jumble/i.test(b.format)).length,0);
  assert.equal(out.english_mix.matching,0);assert.equal(out.english_mix.ordering,0);
  assert.ok(out.english_mix.reading_passages>=4&&out.english_mix.reading_passages<=6,JSON.stringify(out.english_mix));
  assert.equal(out.english_mix.distinct_passages,out.english_mix.reading_passages,'every reading item prints its own passage');
  assert.ok(english.every(b=>b.passage_group_id===null));
  const lexical=english.filter(b=>b.format!=='reading_comprehension');
  assert.ok(lexical.every(b=>['correct_word_usage','synonym','antonym'].includes(b.format)));
  assert.ok(lexical.every(b=>b.source_refs.length&&b.source_refs.every(r=>r.startsWith('oxford-quality-'))),'lexical items rest on a registered dictionary source');
  assert.equal(out.contract.validation_contract_hash,Plan.currentContractBinding().validation_contract_hash);
  assert.equal(out.paid_calls,0);assert.equal(out.ledger_writes,0);
});
test('planner replaces a gapped brief only at preparation time and never produces matching for English',{skip:!inputsPresent},()=>{
  const out=plannedDryRun();
  for(const gap of out.gaps)assert.ok(gap.replaced_by===null||gap.replaced_by.format!=='matching');
  assert.equal(out.briefs.filter(b=>b.subject==='english').length,10);
});
test('V7.5 pilot attempts, when the directory exists, are loaded as prior attempts (never as stock)',{skip:!inputsPresent},async()=>{
  const dir=scratch(),v75=join(dir,'cuet-pilot-v75-fixture');mkdirSync(v75,{recursive:true});
  const job={id:'v75-fixture-job-1',subject:'accountancy',chapter:'Chapter',format:'conceptual_mcq',difficulty:'easy',source_refs:[{id:'x',version:1,locator:'a',support_hash:'h'}],state:'queued'};
  writeFileSync(join(v75,'campaign.json'),JSON.stringify({id:'cuet-pilot-v75-40-2026-10-09',jobs:[job]}));
  writeFileSync(join(v75,'state.json'),JSON.stringify({jobs:{[job.id]:{...job,state:'quarantined',candidate:{id:job.id,subject:'accountancy',chapter:'Chapter',body:'A fixture stem for novelty only.',options:['a','b','c','d'],correct_answer:'A'}}}}));
  assert.equal(Plan.priorPilotAttempts(join(dir,'does-not-exist')),null);
  const prior=Plan.priorPilotAttempts(v75);assert.equal(prior.source,'state.json');assert.equal(prior.items.length,1);
  const without=Plan.loadOfflineInventoryV711({v75PilotDirectory:join(dir,'absent')}),withPilot=Plan.loadOfflineInventoryV711({v75PilotDirectory:v75});
  assert.equal(without.v75_pilot_attempts,null);assert.equal(withPilot.campaigns.length,without.campaigns.length+1);
  assert.equal(withPilot.inventory.length,without.inventory.length,'attempts never become stock');
  assert.ok(withPilot.eligibleCandidates.every(q=>q.id!==job.id));
  assert.ok(Plan.PRIOR_CAMPAIGN_DIRECTORIES.every(d=>!d.includes('pilot-v75')));
});

// ------------------------------------------------------------------ registration and the allocator

test('registration refuses to overwrite an existing preregistration or campaign, before any allocator or file is touched',()=>{
  for(const marker of ['PREREGISTRATION.json','campaign.json']){
    const dir=scratch(),out=join(dir,'pilot').replaceAll('\\','/');mkdirSync(out,{recursive:true});writeFileSync(`${out}/${marker}`,'{"keep":true}\n');
    const allocations=join(dir,'alloc.json'),result=node([prepare,'--inventory-file','--register','--out-dir',out,'--allocations-path',allocations]);
    assert.notEqual(result.status,0);assert.match(result.stderr,/pilot_already_preregistered_refusing_to_overwrite/);
    assert.equal(readFileSync(`${out}/${marker}`,'utf8'),'{"keep":true}\n');assert.ok(!existsSync(allocations));assert.ok(!existsSync(allocations+'.lock'));
  }
});
test('preparation needs an explicit mode, never publishes, and a custom directory cannot reach the real allocator',()=>{
  assert.match(node([prepare]).stderr,/choose_--dry-run_to_preview_or_--register/);
  assert.match(node([prepare,'--dry-run','--register','--inventory-file']).stderr,/dry_run_and_register_are_exclusive/);
  assert.match(node([prepare,'--dry-run','--inventory-file','--publish']).stderr,/preparation_never_publishes_or_executes/);
  assert.match(node([prepare,'--dry-run','--inventory-file','--cap-usd','3.5']).stderr,/cap_usd_must_be_positive_and_at_most_3/);
  assert.match(node([prepare,'--dry-run','--inventory-file','--out-dir',join(scratch(),'x').replaceAll('\\','/')]).stderr,/local_factory_artifact_directory_required_or_explicit_--allocations-path/);
});
test('registration reserves every idea in the durable V7.6 allocator (temp path) before the marker, then commits; the real allocator files are untouched',{skip:!inputsPresent,timeout:120000},()=>{
  const dir=scratch(),out=join(dir,'pilot').replaceAll('\\','/'),allocations=join(dir,'alloc.json'),ledgerFile=join(dir,'budget.sqlite');
  new BudgetLedger(ledgerFile).close();
  const guarded=[resolve(root,DEFAULT_IDEA_ALLOCATION_V76_PATH),resolve(root,DEFAULT_IDEA_ALLOCATION_V76_PATH)+'.lock',resolve(root,DEFAULT_IDEA_ALLOCATION_V76_PATH)+'.intents',
    resolve(root,DEFAULT_IDEA_ALLOCATION_PATH),resolve(root,'data/pipeline-budget.sqlite')];
  const before=guarded.map(stat);
  const result=node([prepare,'--inventory-file','--register','--out-dir',out,'--allocations-path',allocations],{CUET_BUDGET_LEDGER:ledgerFile});
  assert.equal(result.status,0,result.stderr);
  const summary=JSON.parse(result.stdout);assert.equal(summary.registered,true);assert.equal(summary.paid_calls,0);
  const markerText=readFileSync(`${out}/PREREGISTRATION.json`,'utf8'),marker=JSON.parse(markerText);
  assert.equal(marker.contract,Plan.PILOT_CONTRACT);assert.equal(marker.denominator,40);assert.equal(marker.publication_policy,'never');
  assert.equal(marker.contract_binding.validation_contract_hash,Plan.currentContractBinding().validation_contract_hash);
  assert.equal(summary.preregistration_sha256,createHash('sha256').update(markerText).digest('hex'));
  // The intent was written before the marker and names the exact bytes of the marker that now exists.
  const intentDir=allocations+'.intents',files=readdirSync(intentDir),intentFile=files.find(f=>f.startsWith('intent-')),commitFile=files.find(f=>f.startsWith('commit-'));
  assert.ok(intentFile&&commitFile);
  const intent=JSON.parse(readFileSync(join(intentDir,intentFile),'utf8'));
  assert.equal(intent.registration.sha256,createHash('sha256').update(markerText).digest('hex'));
  assert.equal(resolve(intent.registration.path),resolve(`${out}/PREREGISTRATION.json`));
  assert.equal(intent.claims.length,40);assert.equal(intent.campaign_id,Plan.PILOT_ID);
  assert.ok(statSync(join(intentDir,intentFile)).mtimeMs<=statSync(`${out}/PREREGISTRATION.json`).mtimeMs+5,'the intent precedes the marker');
  const snapshot=JSON.parse(readFileSync(allocations,'utf8'));
  assert.equal(Object.keys(snapshot.allocations).length,40);assert.ok(Object.values(snapshot.allocations).every(a=>a.state==='committed'));
  assert.ok(!existsSync(allocations+'.lock'),'the allocator lock is released');
  for(const name of ['campaign.json','registry.json','registry-overlay.json','inventory-coverage-before.json','author-preflight.json'])assert.ok(existsSync(`${out}/${name}`),name);
  assert.deepEqual(guarded.map(stat),before,'real allocator, legacy ledger and budget database untouched');
  // A second registration is refused and reserves nothing more.
  const again=node([prepare,'--inventory-file','--register','--out-dir',out,'--allocations-path',allocations],{CUET_BUDGET_LEDGER:ledgerFile});
  assert.notEqual(again.status,0);assert.match(again.stderr,/refusing_to_overwrite/);
  assert.equal(readdirSync(intentDir).filter(f=>f.startsWith('intent-')).length,1);
});

// ------------------------------------------------------------------ runner

test('the runner refuses paid execution without --approved and exposes no publication, registration or replacement path',()=>{
  const noApproval=node([runner,'execute']);assert.notEqual(noApproval.status,0);assert.match(noApproval.stderr,/authorized_paid_execution_flag_required/);
  for(const flagName of ['--publish','--register','--regenerate','--replace']){
    const r=node([runner,'report',flagName]);assert.notEqual(r.status,0);assert.match(r.stderr,/no_publication_registration_or_replacement_path/);
  }
  assert.match(node([runner,'bogus']).stderr,/unknown_pilot_action/);
  const source=readFileSync(runner,'utf8');
  assert.ok(!/supabase|createClient|publishQuestion|from\(['"]questions|upsert\(|\.insert\(/.test(source),'no database or publication code in the runner');
});
test('the runner wires longFetch, realtime stages, flex stages, the registered cap, the stop file, system CA and the V7.11 stack',()=>{
  const source=readFileSync(runner,'utf8');
  for(const needle of ['fetchImpl:longFetch',"realtimeStages:['authoring','blind_solution','independent_evaluation','explanation_support','repair']","flexStages:['authoring','blind_solution','explanation_support','repair']",
    'capUsd:prereg.cap_usd','Plan.STOP_FILE_V711','--use-system-ca','buildPilotDepsV711','assertV711ContractBound','assertV711PilotRegistration','cuetPilotV711Export'])
    assert.ok(source.includes(needle),needle);
  assert.ok(!/V75Plan|buildPilotDeps\(|assertV75|freeze/.test(source));
  assert.ok(readFileSync(resolve(root,'scripts/pipeline/lib/longFetch.mjs'),'utf8').includes('export function longFetch'));
});
test('the V7.11 deps compose the V7.6 author, V7.11 validator and a single repair',()=>{
  const deps=buildPilotDepsV711({registry:{sources:{}},ledger:{},transport:{generate:async()=>{throw Error('no_network_in_tests');}}});
  assert.deepEqual(Object.keys(deps).sort(),['author','prepare','repair','validate']);
  assert.throws(()=>buildPilotDepsV711({registry:{},ledger:{},transport:{},topology:{id:'single_luna'}}),/pilot_topology_must_be_dual_blind/);
});

// ------------------------------------------------------------------ engine with fake deps (no network)

function makeCampaign(){
  const jobs=[];
  for(let i=0;i<10;i++)for(const subject of subjects)jobs.push({id:`${subject}-${i}`,number:jobs.length+1,subject,chapter:`Chapter ${i%3}`,topic:'t',kind:'original_practice',format:subject==='english'?'synonym':'conceptual_mcq',
    difficulty:'medium',requested_answer_position:'ABCD'[i%4],family_id:`original:${subject}-${i}`,source_refs:[{id:`src-${subject}`,version:1,locator:'a',support_hash:'h'}],avoidance:[],state:'queued',repair_count:0});
  return {id:Plan.PILOT_ID,denominator:40,measurement_only:true,publication_policy:'never',maximum_repairs_per_candidate:1,cap_usd:3,jobs};
}
const prereg=campaign=>({contract:Plan.PILOT_CONTRACT,pilot_id:campaign.id,denominator:40,measurement_only:true,publication_policy:'never',topology:'dual_blind',maximum_repairs_per_candidate:1,
  no_regeneration:true,no_replacement_after_registration:true,cap_usd:3,waves:{size:10,weak_yield_below:0.4,consecutive_weak_waves_stop:2}});
test('registration through the V7.11 gate: right contract and id pass, V7.5 contract or other id is refused, engine rules still apply',()=>{
  const campaign=makeCampaign();
  assert.equal(Plan.assertV711PilotRegistration(prereg(campaign),campaign),true);
  assert.throws(()=>Plan.assertV711PilotRegistration({...prereg(campaign),contract:'cuet-pilot-v75-measurement-v1'},campaign),/v711_contract_or_id/);
  assert.throws(()=>Plan.assertV711PilotRegistration({...prereg(campaign),pilot_id:'cuet-pilot-v75-40-2026-10-09'},{...campaign,id:'cuet-pilot-v75-40-2026-10-09'}),/v711_contract_or_id/);
  assert.throws(()=>Plan.assertV711PilotRegistration({...prereg(campaign),publication_policy:'released'},campaign),/measurement_only_publication_never_required/);
  assert.throws(()=>Plan.assertV711PilotRegistration({...prereg(campaign),cap_usd:3.5},campaign),/cap_must_not_exceed_usd_3/);
  assert.throws(()=>Plan.assertV711PilotRegistration({...prereg(campaign),maximum_repairs_per_candidate:2},campaign),/one_repair_maximum_required/);
  const short={...campaign,jobs:campaign.jobs.slice(0,39)};
  assert.throws(()=>Plan.assertV711PilotRegistration(prereg(campaign),short),/denominator_must_be_40/);
});
test('runPilot with fake deps drives 40 jobs to eligible or quarantined with one repair at most and full revalidation',async()=>{
  const campaign=makeCampaign(),state=expectedFreshState(campaign),calls={author:{},validate:{},repair:{}},bump=(k,id)=>{calls[k][id]=(calls[k][id]||0)+1;};
  const index=id=>Number(id.split('-').pop());
  const deps={
    prepare:candidate=>({candidate,notes:[],quote:{passed:true,methods:['exact']}}),
    author:async job=>{bump('author',job.id);return {id:job.id,subject:job.subject,chapter:job.chapter,body:`Question ${job.id}`,options:['a','b','c','d'],correct_answer:'A',question_type:job.format,source_refs:job.source_refs};},
    validate:async candidate=>{
      bump('validate',candidate.id);const n=index(candidate.id),seen=calls.validate[candidate.id];
      if(n%5===0)return {state:'quarantined',reasons:['failed:resolution_audit']};              // never fixable: repaired once, revalidated, quarantined
      if(n%5===1&&seen===1)return {state:'quarantined',reasons:['failed:key_unique']};          // fixed by the single repair
      if(n%5===2)return {state:'quarantined',reasons:['independent_not_ready']};                // not repairable: no repair is bought
      return {state:'eligible',question:{...candidate,evidence:{}}};
    },
    repair:async candidate=>{bump('repair',candidate.id);return {...candidate,body:candidate.body+' (repaired)'};}};
  const result=await runPilot({campaign,state,saveState:()=>{},deps,concurrency:2});
  assert.equal(result.status,'complete');
  const jobs=campaign.jobs.map(j=>state.jobs[j.id]);
  assert.ok(jobs.every(isTerminal));assert.equal(jobs.length,40);
  for(const job of jobs){
    const n=index(job.id);
    assert.equal(calls.author[job.id],1,'never regenerated');
    assert.ok((calls.repair[job.id]||0)<=1,'at most one repair');assert.ok((calls.validate[job.id]||0)<=2,'at most one revalidation');
    if(n%5===0){assert.equal(job.state,'quarantined');assert.equal(calls.repair[job.id],1);assert.equal(calls.validate[job.id],2);}
    else if(n%5===1){assert.equal(job.state,'eligible');assert.equal(job.repair_count,1);assert.equal(calls.validate[job.id],2);}
    else if(n%5===2){assert.equal(job.state,'quarantined');assert.equal(calls.repair[job.id]||0,0);assert.equal(calls.validate[job.id],1);}
    else{assert.equal(job.state,'eligible');assert.equal(job.repair_count,0);}
  }
  assert.equal(state.waves.length,4);assert.ok(state.waves.every(w=>w.terminal===10));
});
test('the V7.11 export of an unstarted pilot reports 40 untouched candidates, bound to the V7.11 verifier, and publishes nothing',()=>{
  const campaign=makeCampaign(),state=expectedFreshState(campaign);
  const out=buildPilotExport({campaign,prereg:{...prereg(campaign),cost:{pilot_maximum_usd:1},gaps_at_preparation:[]},state,registry:{sources:{},packs:{},families:{},passage_groups:{}},verifyEvidence:false});
  assert.equal(out.report.contract,'cuet-pilot-v711-export-v1');assert.equal(out.report.denominator,40);assert.equal(out.report.untouched,40);
  assert.equal(out.report.newly_published,0);assert.equal(out.report.publication_policy,'never');assert.equal(out.approved.length,0);
});
