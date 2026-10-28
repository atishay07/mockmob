import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {diversifyBrief} from '../lib/briefDiversity.mjs';
import {candidateCSourceViews,C_SOURCE_OVERLAY_PATH} from '../lib/candidateCRegistration.mjs';
import * as Plan from '../lib/cuetPilotV75Plan.mjs';
import {assertPilotRegistration,createPilotGuard,runPilot,loadPilotState,expectedFreshState,applyClosure,repairable,isTerminal} from '../lib/cuetPilotV75Run.mjs';
import {buildPilotExport,positionPatterns,longestRun} from '../lib/cuetPilotV75Export.mjs';

const subjects=Plan.PILOT_SUBJECTS;
const formats={english:'synonym',accountancy:'conceptual_mcq',business_studies:'conceptual_mcq',economics:'conceptual_mcq'};
function makeCampaign(n=Plan.PILOT_PER_SUBJECT){
  const jobs=[];
  for(let i=0;i<n;i++)for(const subject of subjects)jobs.push({id:`${subject}-${i}`,number:jobs.length+1,subject,chapter:`Chapter ${i%3}`,topic:'t',kind:'original_practice',format:formats[subject],difficulty:'medium',
    requested_answer_position:'ABCD'[i%4],family_id:`original:${subject}-${i}`,source_refs:[{id:`src-${subject}`,version:1,locator:'a',support_hash:'h'}],avoidance:[],state:'queued',repair_count:0});
  return {id:'cuet-pilot-v75-40-2026-10-09',denominator:jobs.length,measurement_only:true,publication_policy:'never',maximum_repairs_per_candidate:1,cap_usd:3,jobs};
}
const makePrereg=(campaign,overrides={})=>({contract:Plan.PILOT_CONTRACT,pilot_id:campaign.id,denominator:campaign.jobs.length,measurement_only:true,publication_policy:'never',topology:'dual_blind',
  maximum_repairs_per_candidate:1,no_regeneration:true,no_replacement_after_registration:true,cap_usd:3,
  waves:{size:10,weak_yield_below:0.4,consecutive_weak_waves_stop:2},...overrides});
const candidateOf=job=>({id:job.id,subject:job.subject,chapter:job.chapter,body:`Question ${job.id}`,options:['a '+job.id,'b','c','d'],correct_answer:'A',question_type:job.format,difficulty:'medium',source_refs:job.source_refs,passage_group_id:job.passage_group_id,order_index:job.order_index});
function engine({validate,author,repair,onSave}={}){
  const campaign=makeCampaign(),state=expectedFreshState(campaign),calls={author:[],validate:[],repair:[],saves:0};
  const deps={
    prepare:candidate=>({candidate,notes:[],quote:{passed:true,methods:['exact']}}),
    author:async job=>{calls.author.push(job.id);return author?author(job,calls):candidateOf(job);},
    validate:async(candidate,job)=>{calls.validate.push(candidate.id);return validate?validate(candidate,job,calls):{state:'eligible',question:{...candidate,evidence:{}}};},
    repair:async(candidate,reasons,job)=>{calls.repair.push(candidate.id);return repair?repair(candidate,reasons,job):{...candidate,body:candidate.body+' (repaired)'};}};
  const saveState=s=>{calls.saves++;onSave?.(s);};
  return {campaign,state,deps,calls,run:(extra={})=>runPilot({campaign,state,saveState,deps,concurrency:1,...extra})};
}
const quarantined=(...reasons)=>({state:'quarantined',reasons});

// ------------------------------------------------------------------ fixed denominator and registration

test('the registration is a fixed 40: 10 per subject, one repair, no replacement, measurement only, cap at most USD 3',()=>{
  const campaign=makeCampaign(),prereg=makePrereg(campaign);
  assert.equal(assertPilotRegistration(prereg,campaign),true);
  const bad=(mutate,pattern)=>{const c=structuredClone(campaign),p=structuredClone(prereg);mutate(c,p);assert.throws(()=>assertPilotRegistration(p,c),pattern);};
  bad(c=>c.jobs.pop(),/denominator_must_be_40/);
  bad(c=>{c.jobs.push({...c.jobs[0],id:'extra'});},/denominator_must_be_40/);
  bad(c=>{c.jobs[1].subject='english';},/per_subject_must_be_10/);
  bad(c=>{c.jobs[1].id=c.jobs[0].id;},/duplicate_ids/);
  bad((c,p)=>{p.cap_usd=3.01;},/cap_must_not_exceed_usd_3/);
  bad((c,p)=>{p.cap_usd=0;},/cap_must_not_exceed_usd_3/);
  bad((c,p)=>{p.maximum_repairs_per_candidate=2;},/one_repair_maximum_required/);
  bad((c,p)=>{p.topology='single_luna';},/topology_must_be_dual_blind/);
  bad((c,p)=>{p.no_replacement_after_registration=false;},/no_replacement_required/);
  bad((c,p)=>{p.waves.size=11;},/wave_rules_changed/);
  bad((c,p)=>{p.waves.weak_yield_below=0.5;},/wave_rules_changed/);
  bad((c,p)=>{p.pilot_id='other';},/contract_or_id/);
});
test('publication is never possible: policy flips are refused and no pilot file has a publication path',()=>{
  const campaign=makeCampaign();
  assert.throws(()=>assertPilotRegistration(makePrereg(campaign,{publication_policy:'released_staging_only'}),campaign),/measurement_only_publication_never_required/);
  assert.throws(()=>assertPilotRegistration(makePrereg(campaign,{measurement_only:false}),campaign),/measurement_only_publication_never_required/);
  const files=['lib/cuetPilotV75Plan.mjs','lib/cuetPilotV75Run.mjs','lib/cuetPilotV75Deps.mjs','lib/cuetPilotV75Export.mjs','tools/prepareCuetPilotV75.mjs','tools/runCuetPilotV75.mjs'].map(f=>readFileSync(new URL('../'+f,import.meta.url),'utf8')).join('\n');
  assert.equal(/publishFactory|publish_factory|prepareFactoryPublication|\.rpc\(|question_factory_jobs|publication_enabled\s*:\s*true/.test(files),false);
  const run=spawnSync(process.execPath,['scripts/pipeline/tools/runCuetPilotV75.mjs','report','--publish'],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/no_publication_registration_or_replacement_path/);
  const prepare=spawnSync(process.execPath,['scripts/pipeline/tools/prepareCuetPilotV75.mjs','--inventory-file','--dry-run','--publish'],{encoding:'utf8'});
  assert.notEqual(prepare.status,0);assert.match(prepare.stderr,/never_publishes_or_executes/);
});
test('preparation refuses to write without an explicit choice and the runner needs --approved',()=>{
  const prepare=spawnSync(process.execPath,['scripts/pipeline/tools/prepareCuetPilotV75.mjs','--inventory-file'],{encoding:'utf8'});
  assert.notEqual(prepare.status,0);assert.match(prepare.stderr,/choose_--dry-run/);
  const run=spawnSync(process.execPath,['scripts/pipeline/tools/runCuetPilotV75.mjs','execute'],{encoding:'utf8'});
  assert.notEqual(run.status,0);assert.match(run.stderr,/authorized_paid_execution_flag_required/);
});

// ------------------------------------------------------------------ gaps are handled at preparation only

const inputsPresent=existsSync(Plan.STOCK_REASSESSMENT_DIRECTORY+'/results.jsonl')&&Plan.PRIOR_CAMPAIGN_DIRECTORIES.every(d=>existsSync(d+'/all-candidates.json'))&&existsSync(C_SOURCE_OVERLAY_PATH);
test('an idea gap is recorded and replaced only at preparation by a different route of the same subject; the plan stays 10 per subject',{skip:!inputsPresent},()=>{
  const base=JSON.parse(readFileSync('data/source_registry.json','utf8')),overlay=JSON.parse(readFileSync(Plan.STIMULI_OVERLAY_PATH,'utf8'));
  const merged=Plan.mergeRegistryOverlay(base,overlay),views=candidateCSourceViews(merged,JSON.parse(readFileSync(C_SOURCE_OVERLAY_PATH,'utf8')));
  const inventory=Plan.loadOfflineInventory(),coverage=Plan.offlineCoverage(inventory,merged),{priorAttempts,context}=Plan.planningContextFor(inventory,views.registry);
  const gapAll=(brief,...rest)=>brief.subject==='english'&&brief.format==='sequence_ordering'?{state:'gap',gap:'ordering_source_pool_exhausted',basis:'test',considered_sources:0,refs:[],excerpts:[]}:diversifyBrief(brief,...rest);
  const plan=Plan.planPilotBriefs({coverage,views,planningContext:context,priorAttempts,allocations:{allocations:{}},diversify:gapAll});
  assert.equal(plan.jobs.length,40);
  for(const subject of subjects)assert.equal(plan.jobs.filter(j=>j.subject===subject).length,10,subject);
  const gaps=plan.gaps.filter(g=>g.gap==='ordering_source_pool_exhausted'&&!g.replacement_candidate_for);
  assert.ok(gaps.length>=1,'the gapped English ordering briefs are listed explicitly');
  for(const gap of gaps){
    assert.equal(gap.subject,'english');assert.ok(gap.replaced_by,'replaced at preparation');
    assert.notEqual(gap.replaced_by.format,'sequence_ordering','a gapped route is never re-offered');
    assert.ok(plan.jobs.some(j=>j.id===gap.replaced_by.id&&j.replaces_gap===gap.brief_id));
    assert.ok(!plan.jobs.some(j=>j.id===gap.brief_id),'the gapped brief itself is not in the plan');
  }
  assert.ok(plan.jobs.every(j=>j.source_refs.length>0&&/^[ABCD]$/.test(j.requested_answer_position)));
  const positions=plan.jobs.reduce((n,j)=>({...n,[j.requested_answer_position]:(n[j.requested_answer_position]||0)+1}),{});
  assert.deepEqual(positions,{A:10,B:10,C:10,D:10});
  for(const subject of subjects){const counts=plan.jobs.filter(j=>j.subject===subject).reduce((n,j)=>({...n,[j.requested_answer_position]:(n[j.requested_answer_position]||0)+1}),{});assert.ok(Math.max(...Object.values(counts))<=3,subject);}
  const english=plan.jobs.filter(j=>j.subject==='english'&&j.passage_text);
  for(const job of english)assert.ok(job.passage_text.trim().split(/\s+/).length<=300);
  for(const job of plan.jobs.filter(j=>j.passage_group_id)){const siblings=plan.jobs.filter(j=>j.passage_group_id===job.passage_group_id);assert.equal(new Set(siblings.map(s=>s.requested_answer_position)).size,siblings.length);}
});
test('after registration there is no replacement path: a brief without a permitted source is refused, and the engine has no planner',()=>{
  const campaign=makeCampaign();campaign.jobs[3].source_refs=[];
  assert.throws(()=>assertPilotRegistration(makePrereg(campaign),campaign),/every_brief_needs_sources/);
  const source=readFileSync(new URL('../lib/cuetPilotV75Run.mjs',import.meta.url),'utf8');
  assert.equal(/diversifyBrief|planPilotBriefs|focusedBriefsV7|retrieveFocusedSources/.test(source),false);
});

// ------------------------------------------------------------------ waves, repair, stop rules

test('two consecutive waves under 40% yield stop the campaign and leave the rest untouched',async()=>{
  const t=engine({validate:async()=>quarantined('source_support_missing')});
  const result=await t.run();
  assert.equal(result.status,'circuit_open');
  assert.equal(t.state.circuit_open,true);assert.equal(t.state.weak_waves,2);
  assert.equal(t.calls.author.length,20);
  assert.equal(t.campaign.jobs.slice(20).every(j=>t.state.jobs[j.id].state==='queued'),true);
  assert.equal(t.state.waves.length,2);assert.equal(t.state.waves.every(w=>w.weak&&w.approved===0),true);
});
test('a weak wave followed by a good one resets the count; 40% exactly is not weak',async()=>{
  const approvedPerWave=[3,6,3,4];
  const t=engine({validate:async(candidate,job)=>{const slot=(job.number-1)%10,wave=Math.floor((job.number-1)/10);return slot<approvedPerWave[wave]?{state:'eligible',question:{...candidate,evidence:{}}}:quarantined('source_support_missing');}});
  const result=await t.run();
  assert.equal(result.status,'complete');assert.equal(t.state.circuit_open,false);assert.equal(t.calls.author.length,40);
  assert.deepEqual(t.state.waves.map(w=>w.weak),[true,false,true,false]);
  assert.equal(t.state.weak_waves,0);
});
test('at most one targeted repair and one revalidation, then quarantine; unrepairable defects are not repaired',async()=>{
  const t=engine({validate:async(candidate,job)=>job.subject==='english'?quarantined('failed:blind_solution'):job.subject==='accountancy'?quarantined('source_support_missing'):
    job.subject==='business_studies'?(candidate.body.includes('(repaired)')?{state:'eligible',question:{...candidate,evidence:{}}}:quarantined('failed:independent_evaluation')):{state:'eligible',question:{...candidate,evidence:{}}}});
  await t.run();
  const per=id=>({validate:t.calls.validate.filter(x=>x===id).length,repair:t.calls.repair.filter(x=>x===id).length});
  assert.deepEqual(per('english-0'),{validate:2,repair:1});assert.equal(t.state.jobs['english-0'].state,'quarantined');assert.equal(t.state.jobs['english-0'].repair_count,1);
  assert.deepEqual(per('accountancy-0'),{validate:1,repair:0});assert.equal(t.state.jobs['accountancy-0'].state,'quarantined');
  assert.deepEqual(per('business_studies-0'),{validate:2,repair:1});assert.equal(t.state.jobs['business_studies-0'].state,'eligible');
  assert.deepEqual(per('economics-0'),{validate:1,repair:0});
  for(const job of Object.values(t.state.jobs))assert.ok(t.calls.repair.filter(x=>x===job.id).length<=1,job.id);
  assert.equal(repairable({reasons:['failed:preparation_value','ordering_cohesion_cue']}),true);
  assert.equal(repairable({reasons:['family_not_active']}),false);
});
test('a preparation-value block at authoring keeps the candidate and consumes the single repair',async()=>{
  const blocked=Object.assign(new Error('preparation_value_blocked:learning_objective_missing'),{code:'preparation_value_blocked'});
  const t=engine({author:async job=>{if(job.number>4)return candidateOf(job);throw Object.assign(blocked,{candidate:candidateOf(job)});},
    validate:async candidate=>candidate.body.includes('(repaired)')?{state:'eligible',question:{...candidate,evidence:{}}}:quarantined('failed:preparation_value','learning_objective_missing')});
  await t.run({concurrency:1});
  for(const id of ['english-0','accountancy-0']){assert.equal(t.state.jobs[id].state,'eligible');assert.equal(t.state.jobs[id].repair_count,1);assert.equal(t.calls.repair.filter(x=>x===id).length,1);}
  const stubborn=engine({author:async job=>{throw Object.assign(new Error('preparation_value_blocked'),{candidate:candidateOf(job)});},validate:async()=>quarantined('failed:preparation_value','stem_discloses_key')});
  await stubborn.run();
  assert.equal(stubborn.calls.repair.length,stubborn.calls.author.length);assert.equal(stubborn.calls.validate.length,2*stubborn.calls.author.length);
});
test('abstention and authoring errors quarantine without replacement, and three provider-transport losses in a row stop the campaign',async()=>{
  const abstain=Object.assign(new Error('original_author_abstained:no unique item'),{code:'original_author_abstained',candidate:{abstain:true}});
  const t=engine({author:async job=>{if(job.number===1)throw abstain;return candidateOf(job);}});
  await t.run();
  assert.equal(t.state.jobs['english-0'].state,'quarantined');assert.match(t.state.jobs['english-0'].result.reasons[0],/original_author_abstained/);assert.equal(t.calls.repair.length,0);
  const down=engine({author:async()=>{throw Error('fetch failed');}});
  const result=await down.run();
  assert.equal(result.status,'systemic_provider_failure');assert.equal(down.calls.author.length,3);
  assert.equal(down.campaign.jobs.slice(3).every(j=>down.state.jobs[j.id].state==='queued'),true);
});
test('avoidance is sealed from earlier waves before a job authors, and closure withholds duplicates and rejected-sibling groups',async()=>{
  const t=engine();await t.run();
  const second=t.state.jobs['english-1'];assert.equal(second.avoidance_sealed,true);
  const later=t.state.jobs['english-3'];assert.ok(later.avoidance.some(body=>body.startsWith('Question english-')),'earlier approvals are avoided');
  const jobs=[{id:'a',state:'eligible',candidate:{id:'a',subject:'english',chapter:'c',body:'same body',options:['1','2','3','4'],correct_answer:'A'}},
    {id:'b',state:'eligible',candidate:{id:'b',subject:'english',chapter:'c',body:'same body',options:['1','2','3','4'],correct_answer:'A'}},
    {id:'g1',state:'eligible',passage_group_id:'G',candidate:{id:'g1',body:'x1',options:['1','2','3','4'],correct_answer:'A',subject:'english',chapter:'c'}},
    {id:'g2',state:'quarantined',passage_group_id:'G',candidate:null}];
  applyClosure(jobs);
  assert.equal(jobs[0].state,'eligible');assert.equal(jobs[1].state,'quarantined');assert.match(jobs[1].result.reasons[0],/duplicate_of:a/);
  assert.equal(jobs[2].state,'quarantined');assert.equal(jobs[2].result.reasons[0],'passage_group_sibling_rejected');
});

// ------------------------------------------------------------------ the guard: reservation, cap and uncertain keys

const prices=()=>({...JSON.parse(readFileSync('data/pipeline-prices.json','utf8')),expires_at:'2099-01-01T00:00:00Z'});
const lunaBody=(id,stage='x',cap=1000)=>({model:'gpt-6-luna',reasoning:{effort:'low'},max_output_tokens:cap,store:false,input:[{role:'system',content:'s'},{role:'user',content:JSON.stringify({candidate_id:id,stage})}]});
function guarded({fetchImpl,capUsd=3,candidateIds=[],stopRequested=()=>false,path}){
  const file=path||join(mkdtempSync(join(tmpdir(),'mm-pilot-')),'budget.sqlite'),ledger=new BudgetLedger(file);
  ledger.reconcileHistory({spent_usd:0,basis:'Isolated pilot test; no provider is contacted',confirmed_at:new Date().toISOString()});
  return wire({ledger,file,fetchImpl,capUsd,candidateIds,stopRequested,keys:new Set()});
}
function wire({ledger,file,fetchImpl,capUsd,candidateIds,stopRequested,keys}){
  const native=createFactoryTransport({ledger,prices,env:{OPENAI_API_KEY:'test-only',GEMINI_API_KEY:'test-only'},fetchImpl,flexStages:['authoring','blind_solution']});
  const persisted=[];
  const guard=createPilotGuard({ledger,native,pilotId:'pilot-test',candidateIds,capUsd,prices,keys,onKey:k=>persisted.push(k),stopRequested});
  return {ledger,file,guard,keys,persisted};
}
const ok=()=>Response.json({id:'resp_test',status:'completed',output_text:'{}',usage:{input_tokens:100,output_tokens:50},service_tier:'default'});

test('a persistent ledger reservation exists before every provider call and settles to the receipt',async()=>{
  const seen=[];let g;
  g=guarded({candidateIds:['c1','c2'],fetchImpl:async()=>{
    const rows=g.ledger.db.prepare("SELECT r.state,r.reserved FROM requests r JOIN provider_requests p ON p.reservation_id=r.id WHERE p.state='dispatching'").all();
    seen.push(rows.map(r=>({state:r.state,reserved:r.reserved})));return ok();}});
  await g.guard.generate('openai',lunaBody('c1'),{key:'k1',stage:'authoring'});
  await g.guard.generate('openai',lunaBody('c2'),{key:'k2',stage:'blind_solution'});
  assert.equal(seen.length,2);
  for(const during of seen){assert.equal(during.length,1,'exactly one open reservation while the request is in flight');assert.equal(during[0].state,'reserved');assert.ok(during[0].reserved>0);}
  const settled=g.ledger.db.prepare("SELECT state,actual,reserved FROM requests WHERE state='settled' AND model='gpt-6-luna'").all();
  assert.equal(settled.length,2);assert.ok(settled.every(r=>r.actual>0&&r.actual<r.reserved));
  assert.equal(g.persisted.length,2);assert.equal(g.guard.cost.committedMicro(),settled.reduce((n,r)=>n+r.actual,0));
  g.ledger.close();
});
test('the campaign cap is checked against exact committed spend plus the next maximum, before any reservation or network call',async()=>{
  let posts=0;const g=guarded({candidateIds:['c1'],capUsd:0.001,fetchImpl:async()=>{posts++;return ok();}});
  const before=g.ledger.snapshot().requests;
  await assert.rejects(g.guard.generate('openai',lunaBody('c1'),{key:'k1',stage:'authoring'}),error=>/campaign_budget_exhausted/.test(error.message)&&error.dispatchState==='guard_blocked');
  assert.equal(posts,0);assert.equal(g.ledger.snapshot().requests,before);assert.equal(g.persisted.length,0);
  assert.throws(()=>createPilotGuard({ledger:g.ledger,native:{},pilotId:'p',candidateIds:['c1'],capUsd:3.5,prices,keys:new Set()}),/must_not_exceed_usd_3/);
  g.ledger.close();
});
test('settled keys replay from the saved receipt, accepted-but-unsettled keys are never resent, and out-of-scope candidates are refused',async()=>{
  let posts=0,fail=false;const g=guarded({candidateIds:['c1','c2'],fetchImpl:async()=>{posts++;if(fail)throw new TypeError('fetch failed');return ok();}});
  const first=await g.guard.generate('openai',lunaBody('c1'),{key:'same',stage:'authoring'});
  const replay=await g.guard.generate('openai',lunaBody('c1'),{key:'same',stage:'authoring'});
  assert.equal(posts,1);assert.deepEqual(replay.usage,first.usage);
  fail=true;
  await assert.rejects(g.guard.generate('openai',lunaBody('c2'),{key:'lost',stage:'authoring'}),/fetch failed/);
  assert.equal(posts,2);
  await assert.rejects(g.guard.generate('openai',lunaBody('c2'),{key:'lost',stage:'authoring'}),error=>/accepted_provider_request_exists_no_resubmit/.test(error.message)&&error.dispatchState==='accepted');
  assert.equal(posts,2,'the uncertain key was not resubmitted');
  assert.ok(g.ledger.db.prepare("SELECT COUNT(*) AS n FROM conservative_holds").get().n>=1,'its maximum hold stays committed');
  await assert.rejects(g.guard.generate('openai',lunaBody('stranger'),{key:'other',stage:'authoring'}),/pilot_candidate_outside_campaign/);
  await assert.rejects(g.guard.generate('openai',{...lunaBody('c1'),tools:[{type:'web_search'}]},{key:'tools',stage:'authoring'}),/pilot_tools_disabled/);
  await assert.rejects(g.guard.generate('anthropic',lunaBody('c1'),{key:'haiku',stage:'authoring'}),/pilot_provider_unsupported/);
  g.ledger.close();
});
test('a stop request drains: no new reservation is made, saved receipts still replay',async()=>{
  let stop=false,posts=0;const g=guarded({candidateIds:['c1','c2'],stopRequested:()=>stop,fetchImpl:async()=>{posts++;return ok();}});
  await g.guard.generate('openai',lunaBody('c1'),{key:'done',stage:'authoring'});
  stop=true;
  await assert.rejects(g.guard.generate('openai',lunaBody('c2'),{key:'new',stage:'authoring'}),/study_draining_stop/);
  await g.guard.generate('openai',lunaBody('c1'),{key:'done',stage:'authoring'});
  assert.equal(posts,1);g.ledger.close();
});

// ------------------------------------------------------------------ resume

test('resume after a stop does not resend any settled or accepted key, and finishes the same fixed 40',async()=>{
  const file=join(mkdtempSync(join(tmpdir(),'mm-pilot-resume-')),'budget.sqlite'),campaign=makeCampaign(),candidateIds=campaign.jobs.map(j=>j.id);
  const sent=new Map();let stopAfter=14,posts=0;
  const fetchImpl=async(url,init)=>{posts++;const input=JSON.parse(JSON.parse(init.body).input[1].content),k=`${input.candidate_id}:${input.stage}`;sent.set(k,(sent.get(k)||0)+1);return ok();};
  let state=expectedFreshState(campaign),saved=null;
  const attempt=async stopWhen=>{
    const ledger=new BudgetLedger(file);if(!saved)ledger.reconcileHistory({spent_usd:0,basis:'Isolated pilot resume test',confirmed_at:new Date().toISOString()});
    const t=wire({ledger,file,fetchImpl,capUsd:3,candidateIds,stopRequested:()=>stopWhen(),keys:new Set(state.request_keys)});
    const deps={prepare:candidate=>({candidate,notes:[],quote:{passed:true,methods:['exact']}}),
      author:async job=>{await t.guard.generate('openai',lunaBody(job.id,'author'),{key:'author:'+job.id,stage:'authoring'});return candidateOf(job);},
      validate:async candidate=>{await t.guard.generate('openai',lunaBody(candidate.id,'validate'),{key:'validate:'+candidate.id,stage:'blind_solution'});return {state:'eligible',question:{...candidate,evidence:{}}};},
      repair:async()=>{throw Error('no repair expected');}};
    try{return await runPilot({campaign,state,saveState:s=>{saved=structuredClone(s);},deps,ledger,concurrency:3,stopRequested:()=>stopWhen()});}
    finally{state.request_keys=[...t.keys];ledger.close();}
  };
  const first=await attempt(()=>posts>=stopAfter);
  assert.ok(['stopped','signal'].includes(first.status),first.status);
  assert.ok(first.terminal<40&&first.terminal>0);
  const postsAfterFirst=posts;
  state=loadStateFrom(saved,campaign);
  const second=await attempt(()=>false);
  assert.equal(second.status,'complete');assert.equal(second.terminal,40);
  for(const [key,n] of sent)assert.equal(n,1,`${key} must be sent exactly once`);
  assert.equal(posts,80,'two requests per candidate, nothing duplicated');assert.ok(posts>postsAfterFirst);
  assert.equal(Object.values(state.jobs).filter(isTerminal).length,40);
});
function loadStateFrom(saved,campaign){const copy=structuredClone(saved);const ids=new Set(campaign.jobs.map(j=>j.id));assert.deepEqual(new Set(Object.keys(copy.jobs)),ids);return copy;}
test('a saved state must belong to the same campaign and denominator',()=>{
  const campaign=makeCampaign(),dir=mkdtempSync(join(tmpdir(),'mm-pilot-state-')),path=join(dir,'state.json');
  assert.equal(loadPilotState(path,campaign).campaign_id,campaign.id);
  writeFileSync(path,JSON.stringify({...expectedFreshState(campaign),campaign_id:'someone-else'}));
  assert.throws(()=>loadPilotState(path,campaign),/pilot_state_binding_mismatch/);
  const short=expectedFreshState(campaign);delete short.jobs['english-0'];writeFileSync(path,JSON.stringify(short));
  assert.throws(()=>loadPilotState(path,campaign),/pilot_state_denominator_mismatch/);
});

// ------------------------------------------------------------------ analysis and cost

test('answer-position analysis reports overall, per subject, per passage group and run lengths',()=>{
  const items=[['english','A',1,'G',0],['english','A',2,'G',1],['english','B',3,null,0],['accountancy','A',4,null,0],['accountancy','A',5,null,0],['accountancy','A',6,null,0]]
    .map(([subject,key,number,group,order])=>({subject,key,number,group,order,requested:'A'}));
  const stats=positionPatterns(items);
  assert.deepEqual(stats.overall,{A:5,B:1});assert.equal(stats.longest_same_key_run.overall,3);
  assert.equal(stats.longest_same_key_run.by_subject.accountancy,3);assert.equal(stats.by_passage_group.G.all_same,true);assert.equal(stats.requested_position_matched,5);
  assert.equal(longestRun(['A','A','B','B','B']),3);
});
test('the conservative maximum is built from the frozen request builders and exceeds the cap only as a theoretical bound',()=>{
  const cost=Plan.conservativeMaximum(prices());
  assert.equal(cost.maximum_requests_per_candidate.total,16);assert.equal(cost.denominator,40);
  assert.ok(cost.per_candidate_maximum_micro>0&&Math.abs(cost.pilot_maximum_micro-40*cost.per_candidate_maximum_micro)<1);
  assert.ok(cost.pilot_maximum_usd>Plan.PILOT_CAP_USD_MAX,'the hard cap, not this bound, limits spending');
  const evidence=readFileSync('scripts/pipeline/lib/factoryEvidenceV7.mjs','utf8'),core=readFileSync('scripts/pipeline/lib/factoryCore.mjs','utf8');
  assert.ok(evidence.includes("output = provider === 'openai' ? 7500 : provider === 'anthropic' ? 9000 : 4500"));
  assert.ok(evidence.includes('efforts.explanation, 5000, schema'));
  assert.ok(core.includes("'high',6500,schema"));assert.ok(core.includes('modern?9000:2000'));
  assert.deepEqual({...Plan.STAGE_OUTPUT_CAPS},{author:6500,repair:9000,luna_evaluation:7500,gemini_evaluation:4500,explanation_audit:5000});
});
test('export of an unstarted pilot reports 40 untouched candidates and publishes nothing',()=>{
  const campaign=makeCampaign(),state=expectedFreshState(campaign);
  const out=buildPilotExport({campaign,prereg:{cap_usd:3,cost:{pilot_maximum_usd:12.4},gaps_at_preparation:[]},state,registry:{sources:{},passage_groups:{},families:{}},inventoryRows:[]});
  assert.equal(out.report.untouched,40);assert.equal(out.report.newly_published,0);assert.equal(out.report.publication_policy,'never');assert.equal(out.approved.length,0);
  assert.equal(out.rows.length,40);assert.equal(out.csv.split('\r\n').length,42);assert.equal(out.inspection.pilot_ready,false);
});

// ------------------------------------------------------------------ production wiring (offline: the transport is a capture stub)

import {buildPilotDeps,composeAuthorTransport} from '../lib/cuetPilotV75Deps.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
test('the production author and validator are the v7.5 stack: learning objective required, abstention fields, blind Luna first, no key leaked',{skip:!inputsPresent},async()=>{
  const base=JSON.parse(readFileSync('data/source_registry.json','utf8')),overlay=JSON.parse(readFileSync(Plan.STIMULI_OVERLAY_PATH,'utf8'));
  const merged=Plan.mergeRegistryOverlay(base,overlay),views=candidateCSourceViews(merged,JSON.parse(readFileSync(C_SOURCE_OVERLAY_PATH,'utf8')));
  const inventory=Plan.loadOfflineInventory(),coverage=Plan.offlineCoverage(inventory,merged),{priorAttempts,context}=Plan.planningContextFor(inventory,views.registry);
  const plan=Plan.planPilotBriefs({coverage,views,planningContext:context,priorAttempts,allocations:{allocations:{}}});
  const job=plan.jobs.find(j=>j.subject==='business_studies'&&j.format==='conceptual_mcq'),registry=plan.registry;
  const excerpt=job.research.excerpts[0].text,quote=excerpt.replace(/\s+/g,' ').trim().slice(0,120);
  const authored=(withObjective)=>({body:'Which of the following best describes the idea the supplied section establishes?',options:['The first idea','The second idea','The third idea','The fourth idea'],correct_answer:job.requested_answer_position,
    explanation:'The supplied section establishes the keyed idea.',difficulty:job.difficulty,route:'conceptual',passage_text:'',question_type:job.format,concept_id:'concept-1',evidence_quotes:[quote],stated_assumptions:[],
    option_analysis:['a','b','c','d'],abstain:false,abstention_reason:'',...(withObjective?{learning_objective:{syllabus_unit:'Unit',objective:'Recall the stated idea.',target_term:'',why_answer_requires_it:'Needs the section.'}}:{})});
  const seen=[];
  const stub=(withObjective)=>({generate:async(provider,body,options)=>{
    seen.push({provider,options,body});
    if(options.stage==='authoring')return {output_text:JSON.stringify(authored(withObjective)),status:'completed'};
    throw Object.assign(new Error('offline_stop_after_capture'),{captured:true});}});
  const secret=process.env.CUET_EVIDENCE_SIGNING_KEY;process.env.CUET_EVIDENCE_SIGNING_KEY='test-only-signing-key';
  try{
    const ledger={getCache:()=>null,setCache:()=>{}};
    const deps=buildPilotDeps({registry,ledger,transport:stub(true)});
    const candidate=await deps.author(job);
    const request=seen.find(r=>r.options.stage==='authoring');
    assert.ok(request.body.text.format.schema.properties.learning_objective,'learning objective is part of the authoring schema');
    assert.ok(request.body.text.format.schema.required.includes('learning_objective')&&request.body.text.format.schema.required.includes('abstain'));
    assert.match(request.body.input[0].content,/Preparation-value contract \(v7\.5\)/);
    assert.deepEqual(request.body.text.format.schema.properties.question_type.enum,[job.format]);
    assert.equal(candidate.learning_objective.objective,'Recall the stated idea.');
    const prepared=deps.prepare(candidate);assert.equal(prepared.quote.passed,true);
    seen.length=0;
    const validating=buildPilotDeps({registry,ledger,transport:stub(true)});
    await assert.rejects(validating.validate(prepared.candidate),/offline_stop_after_capture/);
    const first=seen[0];
    assert.equal(first.provider,'openai');assert.equal(first.options.stage,'blind_solution');
    assert.match(first.body.input[0].content,/V7\.5 preparation-value judging/);
    const user=first.body.input[1].content;
    assert.ok(user.includes('learning_objective'));assert.equal(/correct_answer|"explanation"|proposed_explanation|option_analysis/.test(user),false,'the blind view carries no key or explanation');
    // Without a learning objective the free v7.5 gate blocks before any paid call, and that block is repairable.
    seen.length=0;
    const blocked=await buildPilotDeps({registry,ledger,transport:stub(false)}).author(job).then(()=>null,error=>error);
    assert.equal(blocked?.code,'preparation_value_blocked','authoring itself reports the block and keeps the candidate for the single repair');
    const noObjective=blocked.candidate;seen.length=0;
    const result=await buildPilotDeps({registry,ledger,transport:stub(false)}).validate(noObjective);
    assert.equal(seen.length,0,'no provider call for an item with no preparation value');
    assert.equal(result.state,'quarantined');assert.equal(result.reasons[0],'failed:preparation_value');assert.ok(result.reasons.includes('learning_objective_missing'));assert.equal(repairable(result),true);
    assert.equal(typeof composeAuthorTransport(stub(true),job).generate,'function');assert.ok(hashJSON({ok:true}));
  }finally{if(secret===undefined)delete process.env.CUET_EVIDENCE_SIGNING_KEY;else process.env.CUET_EVIDENCE_SIGNING_KEY=secret;}
});
