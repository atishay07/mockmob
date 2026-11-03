// Turns a replayed study into measured findings: false accepts with exact upper bounds, valid survival, rubric behaviour and cost.
// Usage: node scripts/pipeline/tools/analyzeCuetFitStudy.mjs [--tag v7.0]
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const tagIndex=process.argv.indexOf('--tag'),tag=tagIndex>=0?process.argv[tagIndex+1]:'v7.0';
const dir='artifacts/question-factory/cuet-fit-2026-10-07/benchmark',results=JSON.parse(readFileSync(`${dir}/results-${tag}.json`,'utf8')),frozen=JSON.parse(readFileSync(`${dir}/frozen.json`,'utf8'));
const prices=JSON.parse(readFileSync('data/pipeline-prices.json','utf8'));
// One-sided Clopper-Pearson upper bound: smallest p with P(X<=k | n,p) <= alpha.
function cpUpper(k,n,alpha=.05){if(n===0)return null;if(k>=n)return 1;let lo=k/n,hi=1;const cdf=p=>{let s=0,c=1;for(let i=0;i<=k;i++){if(i>0)c=c*(n-i+1)/i;s+=c*p**i*(1-p)**(n-i);}return s;};for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(cdf(mid)>alpha)lo=mid;else hi=mid;}return hi;}
const pct=x=>x===null?null:Math.round(x*10000)/100;
const byGroup=rows=>{const g={};for(const r of rows){(g[r.group]??=[]).push(r);}return g;};
const approved=r=>r.state==='eligible';
const report={tag,benchmark:results.benchmark,verifier_version:results.verifier_version,generated_at:new Date().toISOString(),topologies:{}};
for(const [topology,rows] of Object.entries(results.topologies)){
  const g=byGroup(rows),authored=g.authored_valid||[],pyq=g.authentic_pyq||[],defects=g.controlled_defect||[],poor=g.cuet_fit_judgment||[];
  const falseAccepts=defects.filter(approved),stageFail=list=>list.filter(r=>!approved(r)).reduce((m,r)=>{const k=r.failed_stage||r.reasons?.[0]||'unknown';m[k]=(m[k]||0)+1;return m;},{});
  const cats={};for(const r of defects){const c=(cats[r.category]??={n:0,accepted:0,ids:[]});c.n++;if(approved(r)){c.accepted++;c.ids.push(r.id);}}
  for(const c of Object.values(cats))c.upper_95_pct=pct(cpUpper(c.accepted,c.n));
  report.topologies[topology]={
    authored_valid:{n:authored.length,approved:authored.filter(approved).length,survival_pct:pct(authored.filter(approved).length/Math.max(1,authored.length)),rejected_by:stageFail(authored),rejected_ids:authored.filter(r=>!approved(r)).map(r=>({id:r.id,stage:r.failed_stage,reasons:r.reasons,details:r.details}))},
    authentic_pyq:{n:pyq.length,approved:pyq.filter(approved).length,survival_pct:pct(pyq.filter(approved).length/Math.max(1,pyq.length)),rejected_by:stageFail(pyq),rejected_ids:pyq.filter(r=>!approved(r)).map(r=>({id:r.id,stage:r.failed_stage,reasons:r.reasons,details:r.details}))},
    controlled_defects:{n:defects.length,false_accepts:falseAccepts.length,false_accept_pct:pct(falseAccepts.length/defects.length),upper_95_pct:pct(cpUpper(falseAccepts.length,defects.length)),by_category:cats,accepted_ids:falseAccepts.map(r=>r.id)},
    poor_cuet_fit:{n:poor.length,approved:poor.filter(approved).length,approved_ids:poor.filter(approved).map(r=>r.id),rejected_by:stageFail(poor)}};
  const valid=[...authored,...pyq];report.topologies[topology].valid_survival_pct=pct(valid.filter(approved).length/valid.length);
}
// Standalone validator behaviour (independent of short-circuiting).
const ev=results.evaluations||{},fx=Object.fromEntries(frozen.fixtures.map(f=>[f.id,f]));
const standalone={};
for(const provider of ['openai','gemini']){
  let valid=0,keyOk=0,defects=0,defectKeyFlag=0,pyq=0,pyqKey=0,errors=0;const wrongKeyDetected={n:0,flagged:0};
  for(const [id,e] of Object.entries(ev)){const r=e[provider],f=fx[id];if(!r||r.error){errors++;continue;}
   if(f.group==='authored_valid'||f.group==='authentic_pyq'){valid++;if(r.key===f.oracle.key)keyOk++;if(f.group==='authentic_pyq'){pyq++;if(r.key===f.oracle.key)pyqKey++;}}
   if(f.category==='wrong_key'){wrongKeyDetected.n++;if(r.key!==f.candidate.correct_answer)wrongKeyDetected.flagged++;}}
  standalone[provider]={evaluated:Object.keys(ev).length-errors,errors,key_agreement_with_oracle_on_valid:`${keyOk}/${valid}`,pyq_key_agreement:`${pyqKey}/${pyq}`,wrong_key_defects_contradicted:`${wrongKeyDetected.flagged}/${wrongKeyDetected.n}`};
}
report.standalone_validators=standalone;
// Rubric behaviour: fit levels on authentic PYQs versus deliberately poor items.
const fitStats=group=>{const out={n:0,pass:0,mean_levels:{},mean_seconds:{}};for(const provider of ['openai','gemini']){const rows=Object.entries(ev).filter(([id])=>fx[id].group===group||fx[id].category===group).map(([,e])=>e[provider]).filter(r=>r?.fit);out.mean_seconds[provider]=rows.length?Math.round(rows.reduce((n,r)=>n+r.seconds,0)/rows.length):null;
 out.n=rows.length||out.n;out.pass=Math.max(out.pass,rows.filter(r=>r.fit.pass).length);const sum={};for(const r of rows)for(const [k,v] of Object.entries(r.fit.levels||{}))sum[k]=(sum[k]||0)+v;out.mean_levels[provider]=Object.fromEntries(Object.entries(sum).map(([k,v])=>[k,Math.round(v/rows.length*100)/100]));}return out;};
report.rubric={authentic_pyq:fitStats('authentic_pyq'),authored_valid:fitStats('authored_valid'),poor_cuet_fit:fitStats('poor_cuet_fit')};
// Cost: provider usage receipts for this benchmark, plus batch-rate re-pricing of the same token usage.
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
const rows=db.prepare("SELECT model,state,actual,receipt_json FROM requests WHERE receipt_json LIKE '%v7b-%'").all().map(r=>({...r,receipt:JSON.parse(r.receipt_json)})).filter(r=>String(r.receipt.candidate_id||'').startsWith('v7b-')&&r.receipt.purpose==='calibration');
const batchCost=r=>{const u=r.receipt.usage||{},price=prices.models[r.model]?.batch;if(!price)return null;
  if(r.receipt.provider==='openai'){const d=u.input_tokens_details||{},cached=d.cached_tokens||0,writes=d.cache_write_tokens||0;return ((u.input_tokens-cached-writes)*price.input_per_million+cached*(price.cached_input_per_million||price.input_per_million)+writes*(price.cache_write_per_million||price.input_per_million)+u.output_tokens*price.output_per_million)/1e6;}
  return ((u.promptTokenCount||0)*price.input_per_million+((u.candidatesTokenCount||0)+(u.thoughtsTokenCount||0))*price.output_per_million)/1e6;};
const cost={};for(const r of rows){const k=`${r.receipt.provider}/${r.receipt.stage}`;const c=(cost[k]??={calls:0,realtime_usd:0,batch_equivalent_usd:0});c.calls++;c.realtime_usd+=(r.actual||0)/1e6;c.batch_equivalent_usd+=batchCost(r)??0;}
for(const c of Object.values(cost)){c.realtime_usd=Math.round(c.realtime_usd*1e6)/1e6;c.batch_equivalent_usd=Math.round(c.batch_equivalent_usd*1e6)/1e6;}
report.cost_by_provider_stage=cost;
const n=frozen.fixtures.length,evalCost=p=>(cost[`${p}/${p==='openai'?'blind_solution':'independent_evaluation'}`]||{realtime_usd:0,batch_equivalent_usd:0});
const expl=results.explanation_audit_cost_usd||{};
const perTopology={};
for(const [topology,rows2] of Object.entries(results.topologies)){
  const audited=rows2.length,sources={dual_blind:['openai','gemini'],single_luna:['openai'],single_gemini:['gemini']}[topology];
  const realtime=sources.reduce((s,p)=>s+evalCost(p).realtime_usd,0)+(expl[topology]||0),batch=sources.reduce((s,p)=>s+evalCost(p).batch_equivalent_usd,0)+(expl[topology]||0)/2;
  perTopology[topology]={validation_cost_realtime_usd:Math.round(realtime*1e6)/1e6,per_candidate_realtime_usd:Math.round(realtime/audited*1e6)/1e6,validation_cost_batch_equivalent_usd:Math.round(batch*1e6)/1e6,per_candidate_batch_equivalent_usd:Math.round(batch/audited*1e6)/1e6,candidates:audited};
}
report.validation_cost=perTopology;
writeFileSync(`${dir}/study-report-${tag}.json`,JSON.stringify(report,null,1));
console.log(JSON.stringify({...report,topologies:Object.fromEntries(Object.entries(report.topologies).map(([k,v])=>[k,{valid_survival_pct:v.valid_survival_pct,authored_valid:{approved:v.authored_valid.approved,n:v.authored_valid.n,rejected_by:v.authored_valid.rejected_by},authentic_pyq:{approved:v.authentic_pyq.approved,n:v.authentic_pyq.n,rejected_by:v.authentic_pyq.rejected_by},controlled_defects:{false_accepts:v.controlled_defects.false_accepts,n:v.controlled_defects.n,upper_95_pct:v.controlled_defects.upper_95_pct,accepted_ids:v.controlled_defects.accepted_ids},poor_cuet_fit:v.poor_cuet_fit}]))},null,1));
