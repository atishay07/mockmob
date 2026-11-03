// Prints a cached validator evaluation (no provider call) for audit: node scripts/pipeline/tools/inspectCuetFitEvaluation.mjs <set> <fixture-id-prefix>
import {readFileSync} from 'node:fs';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {applyAdditions} from '../lib/cuetFitBenchmark.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES,reservedBenchmarkAnchors} from '../lib/factoryEvidenceV7.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
const [set,prefix]=process.argv.slice(2),dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark';
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8')),bench=JSON.parse(readFileSync(`${dir}/${set==='regression'?'regression-frozen':set==='v2'?'frozen-v2':'frozen'}.json`,'utf8'));
const scratch=applyAdditions(registry,bench.additions,bench.fixtures),ledger=new BudgetLedger('data/pipeline-budget.sqlite');
const noNetwork={generate:async()=>{throw Error('cache_miss_no_network');}};
const anchors=set==='regression'?reservedBenchmarkAnchors():bench.fixtures.filter(f=>f.anchor_id).map(f=>f.anchor_id);
const ev=createFactoryEvidenceV7({registry:scratch,ledger,transport:noNetwork,topology:TOPOLOGIES.dual_blind,exemplarExclude:anchors,calibrationPurpose:true});
for(const f of bench.fixtures.filter(f=>f.id.startsWith(prefix)))for(const provider of ['openai','gemini']){
 try{const r=await ev.__evaluation(blindView(f.candidate,f.candidate.source_refs),provider);console.log(JSON.stringify({id:f.id,provider,key:r.solved_key,conditions:r.answer_conditions,challenges:r.option_challenges,defects:r.blocking_defects,style:r.style_notes,principle:[r.principle_applicability,r.decisive_principle_in_excerpts],reasons:r.reasons.slice(0,4)},null,1));}catch(e){console.log(f.id,provider,e.message);}
}
ledger.close();
