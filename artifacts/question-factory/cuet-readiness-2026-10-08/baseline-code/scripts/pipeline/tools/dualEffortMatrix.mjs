// For each Luna/Gemini effort pairing: how many controlled defects survive BOTH blind evaluations (cached, no provider call), and how many valid items do.
import {readFileSync} from 'node:fs';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {applyAdditions} from '../lib/cuetFitBenchmark.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES,reservedBenchmarkAnchors} from '../lib/factoryEvidenceV7.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
const dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',registry=JSON.parse(readFileSync('data/source_registry.json','utf8')),ledger=new BudgetLedger('data/pipeline-budget.sqlite'),nn={generate:async()=>{throw Error('cache_miss');}};
const approve=(r,f)=>/^[ABCD]$/.test(r.solved_key)&&r.solved_key===f.candidate.correct_answer&&r.single_defensible_answer&&r.source_support&&r.syllabus_entitlement&&r.defects.length===0&&r.challenges_ok&&r.conditions_ok&&r.principle_ok&&r.presentation_ready&&r.cuet_fit_result.pass;
const out=[];
for(const set of ['v2','regression']){
 const bench=JSON.parse(readFileSync(`${dir}/${set==='regression'?'regression-frozen':'frozen-v2'}.json`,'utf8')),scratch=applyAdditions(registry,bench.additions,bench.fixtures),ex=set==='regression'?reservedBenchmarkAnchors():[];
 for(const lu of ['high','medium','low'])for(const ge of ['medium','low']){
  const L=createFactoryEvidenceV7({registry:scratch,ledger,transport:nn,exemplarExclude:ex,calibrationPurpose:true,efforts:{blind:lu,explanation:lu,gemini:ge}});let validOk=0,validN=0,acc=0,defN=0,gemOnly=0,lunaOnly=0;
  for(const f of bench.fixtures){if(f.contested)continue;const v=blindView(f.candidate,f.candidate.source_refs);let a,b;try{a=await L.__evaluation(v,'openai');b=await L.__evaluation(v,'gemini');}catch{continue;}
   const x=approve(a,f),y=approve(b,f);if(f.expected_valid){validN++;if(x&&y)validOk++;}else{defN++;if(x&&y)acc++;if(x&&!y)gemOnly++;if(!x&&y)lunaOnly++;}}
  out.push({set,luna:lu,gemini:ge,valid:`${validOk}/${validN}`,defects_accepted_by_both:`${acc}/${defN}`,caught_only_by_gemini:gemOnly,caught_only_by_luna:lunaOnly});}}
for(const o of out)console.log(JSON.stringify(o));ledger.close();
