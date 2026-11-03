// Lists fixtures on which two effort levels of one provider disagree (cached evaluations only).
import {readFileSync} from 'node:fs';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {applyAdditions} from '../lib/cuetFitBenchmark.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES,reservedBenchmarkAnchors} from '../lib/factoryEvidenceV7.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
const arg=(n,d=null)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:d;};
const set=arg('--set','v2'),[a,b]=arg('--levels','high,medium').split(',');
const dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const bench=JSON.parse(readFileSync(`${dir}/${set==='regression'?'regression-frozen':'frozen-v2'}.json`,'utf8')),scratch=applyAdditions(registry,bench.additions,bench.fixtures);
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),nn={generate:async()=>{throw Error('cache_miss');}};
const mk=l=>createFactoryEvidenceV7({registry:scratch,ledger,transport:nn,topology:TOPOLOGIES.dual_blind,exemplarExclude:set==='regression'?reservedBenchmarkAnchors():[],calibrationPurpose:true,efforts:{blind:l,explanation:l,gemini:'medium'}});
const ea=mk(a),eb=mk(b);
const verdict=r=>[r.solved_key,r.single_defensible_answer,r.source_support,r.defects.length?'D':'-',r.challenges_ok?'-':'C',r.conditions_ok?'-':'A',r.cuet_fit_result.pass?'-':'F'].join('');
for(const f of bench.fixtures){const v=blindView(f.candidate,f.candidate.source_refs);let x,y;try{x=await ea.__evaluation(v,'openai');y=await eb.__evaluation(v,'openai');}catch{continue;}
 if(verdict(x)!==verdict(y))console.log(f.id.padEnd(58),f.expected_valid?'VALID ':'defect',a,verdict(x),b,verdict(y),f.contested?'[contested]':'');}
ledger.close();
