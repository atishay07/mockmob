// Compares cached validator evaluations of one provider across reasoning-effort settings on a frozen set (no provider call).
// node scripts/pipeline/tools/compareEfforts.mjs --provider openai --set v2|regression --levels high,medium,low [--gemini-effort medium]
import {readFileSync,writeFileSync} from 'node:fs';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {applyAdditions} from '../lib/cuetFitBenchmark.mjs';
import {createFactoryEvidenceV7,TOPOLOGIES,reservedBenchmarkAnchors} from '../lib/factoryEvidenceV7.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
const arg=(n,d=null)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:d;};
const provider=arg('--provider','openai'),set=arg('--set','v2'),levels=arg('--levels','high,medium,low').split(',');
const dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',registry=JSON.parse(readFileSync('data/source_registry.json','utf8'));
const bench=JSON.parse(readFileSync(`${dir}/${set==='regression'?'regression-frozen':'frozen-v2'}.json`,'utf8')),scratch=applyAdditions(registry,bench.additions,bench.fixtures);
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),noNetwork={generate:async()=>{throw Error('cache_miss');}};
const rows={};
for(const level of levels){
  const efforts=provider==='openai'?{blind:level,explanation:level,gemini:'medium'}:{blind:'high',explanation:'high',gemini:level};
  const ev=createFactoryEvidenceV7({registry:scratch,ledger,transport:noNetwork,topology:TOPOLOGIES.dual_blind,exemplarExclude:set==='regression'?reservedBenchmarkAnchors():bench.fixtures.filter(f=>f.anchor_id).map(f=>f.anchor_id),calibrationPurpose:true,efforts});
  for(const f of bench.fixtures){try{const r=await ev.__evaluation(blindView(f.candidate,f.candidate.source_refs),provider);
    const approve=/^[ABCD]$/.test(r.solved_key)&&r.solved_key===f.candidate.correct_answer&&r.single_defensible_answer&&r.source_support&&r.syllabus_entitlement&&r.defects.length===0&&r.challenges_ok&&r.conditions_ok&&r.principle_ok&&r.presentation_ready&&r.cuet_fit_result.pass;
    (rows[f.id]??={})[level]={approve,key:r.solved_key,out:r.cuet_fit?.reasoning_steps};}catch(e){(rows[f.id]??={})[level]={missing:true};}}
}
const summary={provider,set,levels:{}};
for(const level of levels){let validOk=0,validN=0,defectAccepted=0,defectN=0,missing=0,keyOk=0,keyN=0;
  for(const f of bench.fixtures){const r=rows[f.id]?.[level];if(!r||r.missing){missing++;continue;}
   if(f.expected_valid){validN++;if(r.approve)validOk++;keyN++;if(r.key===f.candidate.correct_answer)keyOk++;}else if(!f.contested){defectN++;if(r.approve)defectAccepted++;}}
  summary.levels[level]={valid_approved:`${validOk}/${validN}`,defects_accepted:`${defectAccepted}/${defectN}`,valid_key_agreement:`${keyOk}/${keyN}`,missing};}
const base=levels[0];summary.agreement_with_first=Object.fromEntries(levels.slice(1).map(l=>[l,`${bench.fixtures.filter(f=>rows[f.id]?.[base]&&rows[f.id]?.[l]&&!rows[f.id][base].missing&&!rows[f.id][l].missing&&rows[f.id][base].approve===rows[f.id][l].approve).length}/${bench.fixtures.length}`]));
console.log(JSON.stringify(summary));ledger.close();
