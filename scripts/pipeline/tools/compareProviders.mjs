// Evaluation-level comparison of validators on a frozen set (cached results only; no provider call).
// node scripts/pipeline/tools/compareProviders.mjs --set v2|regression|v3 [--luna high] [--gemini medium] [--haiku medium]
import {readFileSync} from 'node:fs';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {applyAdditions} from '../lib/cuetFitBenchmark.mjs';
import {createFactoryEvidenceV7,reservedBenchmarkAnchors} from '../lib/factoryEvidenceV7.mjs';
import {blindView} from '../lib/evidencePipeline.mjs';
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:d;};
const set=arg('--set','v2'),efforts={blind:arg('--luna','high'),explanation:'high',gemini:arg('--gemini','medium'),haiku:arg('--haiku','medium')};
const dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',file={regression:'regression-frozen',v2:'frozen-v2',v3:'frozen-v3'}[set];
const registry=JSON.parse(readFileSync('data/source_registry.json','utf8')),bench=JSON.parse(readFileSync(`${dir}/${file}.json`,'utf8')),scratch=applyAdditions(registry,bench.additions,bench.fixtures);
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),nn={generate:async()=>{throw Error('cache_miss');}};
const approve=(r,f)=>/^[ABCD]$/.test(r.solved_key)&&r.solved_key===f.candidate.correct_answer&&r.single_defensible_answer&&r.source_support&&r.syllabus_entitlement&&r.defects.length===0&&r.challenges_ok&&r.conditions_ok&&r.principle_ok&&r.presentation_ready&&r.cuet_fit_result.pass;
const ev=createFactoryEvidenceV7({registry:scratch,ledger,transport:nn,exemplarExclude:set==='regression'?reservedBenchmarkAnchors():[],calibrationPurpose:true,efforts});
const P=['openai','gemini','anthropic'],stat=Object.fromEntries(P.map(p=>[p,{validOk:0,validN:0,keyOk:0,defAcc:0,defN:0,missing:0,abstain:0,fitPass:0,fitN:0,costless:0}])),rows=[];
for(const f of bench.fixtures){if(f.contested)continue;const v=blindView(f.candidate,f.candidate.source_refs),row={id:f.id,valid:f.expected_valid};
 for(const p of P){let r;try{r=await ev.__evaluation(v,p);}catch{stat[p].missing++;row[p]=null;continue;}const a=approve(r,f);row[p]=a;const s=stat[p];
  if(f.expected_valid){s.validN++;if(a)s.validOk++;if(r.solved_key===f.candidate.correct_answer)s.keyOk++;}else{s.defN++;if(a)s.defAcc++;}
  if(r.solved_key==='abstain')s.abstain++;s.fitN++;if(r.cuet_fit_result.pass)s.fitPass++;}
 rows.push(row);}
const out={set,efforts,providers:Object.fromEntries(P.map(p=>[p,{valid_approved:`${stat[p].validOk}/${stat[p].validN}`,valid_key_agreement:`${stat[p].keyOk}/${stat[p].validN}`,defects_accepted:`${stat[p].defAcc}/${stat[p].defN}`,abstained:stat[p].abstain,fit_pass:`${stat[p].fitPass}/${stat[p].fitN}`,missing:stat[p].missing}]))};
const L=process.argv.includes("--list");const defs=rows.filter(r=>!r.valid&&r.openai!==null&&r.gemini!==null&&r.anthropic!==null);
out.unique_catches_among_defects=Object.fromEntries(P.map(p=>[p,defs.filter(r=>!r[p]&&P.filter(q=>q!==p).every(q=>r[q])).length]));
out.accepted_by_all_three=defs.filter(r=>P.every(p=>r[p])).length;out.accepted_by_none_of_luna_haiku=defs.filter(r=>r.openai&&r.anthropic).length;
console.log(JSON.stringify(out,null,1));ledger.close();
if(process.argv.includes('--list')){const want=(arg('--list','')).split(',');console.log(JSON.stringify(rows.filter(r=>want.some(w=>r.id.includes(w))).map(r=>({id:r.id.slice(0,44),luna:r.openai,gemini:r.gemini,haiku:r.anthropic}))));}
