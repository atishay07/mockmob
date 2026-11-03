// Re-judges the already approved questions under the CUET-fit contract. Read-only with respect to the question bank: it never edits,
// withholds or republishes anything; it writes a report that the owner can act on. Provider calls go through the budget guard.
// Usage: node --use-system-ca scripts/pipeline/tools/reassessApprovals.mjs --topology single_luna [--limit N] [--concurrency 8] [--cap-usd 4]
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {TOPOLOGIES,FACTORY_VERIFIER_VERSION_V7} from '../lib/factoryEvidenceV7.mjs';
import {validateFactoryCandidateV7} from '../lib/verifyV7.mjs';
try{loadEnvFile('.env.local');}catch{}
const arg=(n,d=null)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:d;};
const topology=TOPOLOGIES[arg('--topology','single_luna')],limit=Number(arg('--limit',0)),concurrency=Number(arg('--concurrency',8)),capUsd=Number(arg('--cap-usd',4));
if(!topology)throw Error('unknown_topology');
const out='artifacts/question-factory/cuet-fit-2026-10-07/reassessment',file=`${out}/reassessment-${topology.id}.jsonl`;mkdirSync(out,{recursive:true});
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const all=JSON.parse(readFileSync('artifacts/question-factory/continuation-500/all-candidates.json','utf8'));
const approved=all.filter(c=>c.state==='published').map(c=>({row:c,candidate:(({evidence,...q})=>q)(c.candidate)}));
const done=new Set(existsSync(file)?readFileSync(file,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l).id):[]);
const todo=approved.filter(a=>!done.has(a.row.id)).slice(0,limit||undefined);
const ledger=new BudgetLedger(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite');
const start=ledger.snapshot().committed_micro,spent=()=>(ledger.snapshot().committed_micro-start)/1e6;
const transport=createFactoryTransport({ledger,realtimeStages:['blind_solution','independent_evaluation','explanation_support'],flexStages:['blind_solution','explanation_support']});
const reassess={generate:(p,b,o)=>transport.generate(p,b,{...o,purpose:'reassessment'})};
let index=0,failure,count=0;
try{
 await Promise.all(Array.from({length:concurrency},async()=>{while(!failure){const item=todo[index++];if(!item)return;
  if(spent()>capUsd){failure=Error('reassessment_cap_exceeded');return;}
  try{
   const r=await validateFactoryCandidateV7(item.candidate,{registry,ledger,transport:reassess,topology,seen:new Set()});
   const c=r.checks||r.question?.evidence?.record?.checks||{},b=c.blind_solution,g=c.independent_evaluation;
   const line={id:item.row.id,subject:item.row.subject,chapter:item.row.chapter,format:item.row.format,difficulty:item.row.difficulty,topology:topology.id,state:r.state,failed_stage:r.failed_stage||null,reasons:r.reasons,details:(r.failure_details||[]).slice(0,5),
    fit:b?.cuet_fit_result||null,estimated_seconds:b?.cuet_fit?.estimated_solve_seconds??null,estimated_difficulty:b?.cuet_fit?.estimated_difficulty??null,cognitive_level:b?.cuet_fit?.cognitive_level??null,key_agrees:b?.solved_key===item.candidate.correct_answer,
    blocking_conditions:(b?.answer_conditions||[]).filter(x=>['implied_decisive','missing'].includes(x.status)&&x.alters_key_if_changed).map(x=>x.condition.slice(0,140)),blocking_defects:b?.defects||[],style_notes:(b?.style_notes||[]).slice(0,3),
    legacy:{luna_score:item.row.candidate?.evidence?.record?.checks?.blind_solution?.item_quality_score??null,gemini_score:item.row.candidate?.evidence?.record?.checks?.independent_evaluation?.item_quality_score??null}};
   writeFileSync(file,JSON.stringify(line)+'\n',{flag:'a'});count++;
  }catch(e){if(/budget_|pricing_|history_/.test(e.message)){failure=e;return;}writeFileSync(file,JSON.stringify({id:item.row.id,topology:topology.id,state:'error',reasons:[e.message]})+'\n',{flag:'a'});}
 }}));
 if(failure)throw failure;
}finally{console.log(JSON.stringify({topology:topology.id,reassessed_now:count,remaining:todo.length-count,cost_usd:spent(),verifier:FACTORY_VERIFIER_VERSION_V7}));ledger.close();}
