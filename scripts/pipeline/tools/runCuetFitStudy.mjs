// Validator-topology study on the frozen CUET-fit benchmark. Every provider call goes through the persistent budget guard.
// Usage: node --use-system-ca scripts/pipeline/tools/runCuetFitStudy.mjs <prepare|evaluate|replay|report> [--cap-usd 3] [--tag v7.0]
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport,BatchPending} from '../lib/factoryTransport.mjs';
import {buildFixtures,buildRegressionFixtures,applyAdditions,payloadHash,SUITES} from '../lib/cuetFitBenchmark.mjs';
import {effortsFor} from '../../../data/cuet_fit_evidence.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES,FACTORY_VERIFIER_VERSION_V7,reservedBenchmarkAnchors} from '../lib/factoryEvidenceV7.mjs';
import {validateFactoryCandidateV7} from '../lib/verifyV7.mjs';
import {authorCandidate} from '../lib/factoryCore.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
try{loadEnvFile('.env.local');}catch{}
const action=process.argv[2]||'report',arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const tag=arg('--tag')||'v7.1',capUsd=Number(arg('--cap-usd')||3),providers=(arg('--providers')||'openai,gemini').split(','),onlyTopologies=arg('--topologies')?arg('--topologies').split(','):null,efforts={blind:arg('--effort-blind')||'high',explanation:arg('--effort-explanation')||'high',gemini:arg('--effort-gemini')||'medium'};
const set=arg('--set')||'fresh',dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',frozenPath=set==='regression'?dir+'/regression-frozen.json':set==='v2'?dir+'/frozen-v2.json':set==='v3'?dir+'/frozen-v3.json':dir+'/frozen.json',resultPath=set==='regression'?`${dir}/results-${tag}-regression.json`:set==='v2'?`${dir}/results-${tag}-v2.json`:set==='v3'?`${dir}/results-${tag}-v3.json`:`${dir}/results-${tag}.json`;
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const registry=read('data/source_registry.json');
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
const startCommitted=ledger.snapshot().committed_micro,startIds=new Set(ledger.db.prepare('SELECT id FROM requests').all().map(r=>r.id));
const transport=createFactoryTransport({ledger,realtimeStages:['authoring','blind_solution','independent_evaluation','explanation_support'],flexStages:process.argv.includes('--flex')?['authoring','blind_solution','explanation_support']:[]});
const calibrationTransport={generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'calibration'})};
const spent=()=>(ledger.snapshot().committed_micro-startCommitted)/1e6;
const guard=()=>{if(spent()>capUsd)throw Error(`study_cap_exceeded:${spent().toFixed(4)}>${capUsd}`);};
async function pool(items,fn,n=4){let i=0,failure;await Promise.all(Array.from({length:n},async()=>{while(!failure){const item=items[i++];if(!item)return;try{guard();await fn(item);}catch(e){failure=e;}}}));if(failure)throw failure;}
function loadFixtures(){
  if(existsSync(frozenPath))return read(frozenPath);
  if(set==='regression'){const fixtures=buildRegressionFixtures(registry);return {id:'cuet-fit-regression-2026-10-07',additions:{sources:{}},fixtures,frozen:true,payload_hash:payloadHash(fixtures),registry_version:registry.version,note:'Regression suite: previously frozen and previously audited items; not fresh evidence.'};}
  const suite=set==='v2'?SUITES.v2:set==='v3'?SUITES.v3:SUITES.v1,{additions,fixtures}=buildFixtures(registry,suite);return {id:suite.id,registry_version:registry.version,additions,fixtures,frozen:false};
}
const bench=loadFixtures();
const scratch=applyAdditions(registry,bench.additions,bench.fixtures);
const pyqAnchors=set==='regression'?reservedBenchmarkAnchors():bench.fixtures.filter(f=>f.anchor_id).map(f=>f.anchor_id);
try{
 if(action==='prepare'){
  // Luna writes the explanations of the authentic PYQs exactly as the production path does; the benchmark is frozen only afterwards.
  const fixtures=bench.fixtures;
  await pool(fixtures.filter(f=>f.needs_explanation&&!f.explanation_prepared),async f=>{
   const job={id:f.id,kind:'authentic_pyq',subject:f.candidate.subject,chapter:f.candidate.chapter,anchor_id:f.anchor_id};
   const authored=await authorCandidate(job,{registry:scratch,transport:calibrationTransport});
   for(const k of ['body','options','correct_answer'])if(JSON.stringify(authored[k])!==JSON.stringify(f.candidate[k]))throw Error('pyq_content_changed:'+f.id);
   f.candidate={...f.candidate,explanation:authored.explanation};f.explanation_prepared=true;
  });
  const frozen={...bench,fixtures,frozen:true,payload_hash:payloadHash(fixtures),frozen_at:new Date().toISOString(),registry_version:registry.version,verifier_version:FACTORY_VERIFIER_VERSION_V7,
   note:'Frozen before any validator evaluated these items. PYQ explanations were written by the production explanation path; all other items were authored and keyed independently of every model.'};
  save(frozenPath,frozen);console.log(JSON.stringify({frozen:true,fixtures:fixtures.length,payload_hash:frozen.payload_hash,cost_usd:spent()}));
 }else if(action==='evaluate'){
  if(!bench.frozen)throw Error('frozen_benchmark_required');
  const adapters=createFactoryEvidenceV7({registry:scratch,ledger,transport:calibrationTransport,topology:TOPOLOGIES.dual_blind,exemplarExclude:pyqAnchors,calibrationPurpose:true,efforts});
  const jobs=[];for(const f of bench.fixtures)for(const provider of providers)jobs.push({f,provider});
  const errors=[];
  await pool(jobs,async({f,provider})=>{
   const view=blindView(f.candidate,f.candidate.source_refs);
   try{const ad=process.argv.some(a=>a.startsWith('--effort-'))?adapters:createFactoryEvidenceV7({registry:scratch,ledger,transport:calibrationTransport,topology:TOPOLOGIES.dual_blind,exemplarExclude:pyqAnchors,calibrationPurpose:true,efforts:effortsFor(f.candidate)});await ad.__evaluation(view,provider);}catch(e){errors.push({id:f.id,provider,error:e.message});}
  });
  save(`${dir}/evaluate-errors-${tag}.json`,errors);console.log(JSON.stringify({evaluated:jobs.length,errors:errors.length,cost_usd:spent()}));
 }else if(action==='replay'){
  if(!bench.frozen)throw Error('frozen_benchmark_required');
  if(set==='regression'&&!existsSync(frozenPath))save(frozenPath,bench);
  const out={tag,set,benchmark:{id:bench.id,payload_hash:bench.payload_hash},verifier_version:FACTORY_VERIFIER_VERSION_V7,at:new Date().toISOString(),topologies:{},explanation_audit_cost_usd:{}};
  // Standalone view of each validator (cached, no spend): what it concluded about every fixture regardless of short-circuiting.
  out.evaluations={};{const ev=createFactoryEvidenceV7({registry:scratch,ledger,transport:calibrationTransport,topology:TOPOLOGIES.dual_blind,exemplarExclude:pyqAnchors,calibrationPurpose:true,efforts});
   for(const f of bench.fixtures){out.evaluations[f.id]={};for(const provider of providers)try{const r=await ev.__evaluation(blindView(f.candidate,f.candidate.source_refs),provider);
    out.evaluations[f.id][provider]={key:r.solved_key,single:r.single_defensible_answer,source_support:r.source_support,entitlement:r.syllabus_entitlement,presentation:r.presentation_ready,qtype:r.question_type_match,principle_ok:r.principle_ok,
     blocking_conditions:(r.answer_conditions||[]).filter(c=>['implied_decisive','missing'].includes(c.status)&&c.alters_key_if_changed).map(c=>c.condition.slice(0,120)),defects:r.defects,style_notes:r.style_notes,fit:r.cuet_fit_result,seconds:r.cuet_fit?.estimated_solve_seconds,difficulty:r.cuet_fit?.estimated_difficulty,cognitive_level:r.cuet_fit?.cognitive_level,chapter:r.syllabus_chapter,numeric:r.numeric_solution,boundary:r.boundary_cases,quotes_valid:r.reference_quotes_valid};}catch(e){out.evaluations[f.id][provider]={error:e.message};}}}
  for(const topo of Object.values(TOPOLOGIES).filter(t=>!onlyTopologies||onlyTopologies.includes(t.id))){
   const rows=[],before=spent();
   await pool(bench.fixtures,async f=>{
    try{
     const r=await validateFactoryCandidateV7(f.candidate,{registry:scratch,ledger,transport:calibrationTransport,topology:topo,exemplarExclude:pyqAnchors,calibrationPurpose:true,efforts:process.argv.some(a=>a.startsWith('--effort-'))?efforts:undefined,seen:new Set()});
     const c=r.checks||r.question?.evidence?.record?.checks||{};
     rows.push({id:f.id,group:f.group,category:f.category,expected_valid:f.expected_valid,state:r.state,failed_stage:r.failed_stage||null,reasons:r.reasons,details:(r.failure_details||[]).slice(0,4),
      luna:c.blind_solution&&{key:c.blind_solution.solved_key,fit:c.blind_solution.cuet_fit_result,conditions:(c.blind_solution.answer_conditions||[]).filter(x=>['implied_decisive','missing'].includes(x.status)).length,defects:c.blind_solution.defects},
      gemini:c.independent_evaluation&&{key:c.independent_evaluation.solved_key,fit:c.independent_evaluation.cuet_fit_result,defects:c.independent_evaluation.defects}});
    }catch(e){rows.push({id:f.id,group:f.group,category:f.category,expected_valid:f.expected_valid,state:'error',reasons:[e.message]});}
   });
   out.topologies[topo.id]=rows;out.explanation_audit_cost_usd[topo.id]=spent()-before;
  }
  out.cost_usd_incremental=spent();save(resultPath,out);console.log(JSON.stringify({saved:resultPath,cost_usd:spent()}));
 }else throw Error('unknown_action');
}finally{ledger.close();}
