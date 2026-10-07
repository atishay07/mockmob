import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {loadEnvFile} from 'node:process';
import {createClient} from '@supabase/supabase-js';import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {readBankSnapshot,readAllRows} from '../lib/bankSnapshot.mjs';import {detailedCoverage} from '../lib/topicCoverage.mjs';
import {measuredEconomics} from '../lib/cohortEconomics.mjs';import {QUOTE_AUTHOR_CONTRACT} from '../lib/constrainedAuthoring.mjs';
import {inspectBatch} from '../lib/batchInspection.mjs';
loadEnvFile('.env.local');loadEnvFile('.env.staging');
if(!process.argv.includes('--staging')||process.env.STAGING_SUPABASE_URL!=='https://onwkqxmjqjrhfbjjdydu.supabase.co')throw Error('separate_staging_required');
const root='artifacts/question-factory/',out=root+'continuation-500',read=p=>JSON.parse(readFileSync(p)),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const state=read(out+'/state.json'),directories=['execution-2026-10-07',...state.cohorts];
const ledger=new BudgetLedger('data/pipeline-budget.sqlite');
try{
 ledger.assertHistoryReconciled();const registry=read('data/source_registry.json');
 const db=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const inventory=await readBankSnapshot(db),holds=await readAllRows(db,'recovery_family_holds','family_id','family_id');
 const coverage=detailedCoverage(inventory,registry,{heldFamilies:holds.map(h=>h.family_id)});save(out+'/coverage-current.json',coverage);
 const reports=[],items=[],receipts=new Map();
 for(const directory of directories){const path=root+directory,campaign=read(path+'/campaign.json');
  const r=existsSync(path+'/batch-report.json')?read(path+'/batch-report.json'):{id:campaign.id,denominator:100,complete:false,pending:100,approved_unique:0,cost:{gross_usd:0,held_usd:0}};
  reports.push({...r,author_contract:campaign.author_contract||'original-v1',directory:path});
  const rows=existsSync(path+'/all-100.json')?read(path+'/all-100.json'):campaign.jobs.map(j=>({...j,state:'registered'}));
  if(rows.length!==campaign.denominator||new Set(rows.map(j=>j.id)).size!==rows.length)throw Error('frozen_denominator_mismatch:'+directory);
  items.push(...rows.map(j=>({...j,cohort:campaign.id,cohort_complete:r.complete})));
  if(existsSync(path+'/receipts.json'))for(const receipt of read(path+'/receipts.json'))receipts.set(receipt.id,receipt);
 }
 const approved=items.filter(j=>j.state==='published'),candidateIds=new Set(items.map(j=>j.id)),publishedIds=new Set(approved.map(j=>j.id));
 if(candidateIds.size!==items.length||publishedIds.size!==approved.length)throw Error('cross_cohort_identity_duplicate');
 const snapshot=ledger.snapshot(),totals=ledger.db.prepare("SELECT state,sum(actual) actual,sum(reserved) reserved,count(*) requests FROM requests GROUP BY state").all();
 const economics=measuredEconomics(reports,{committedUsd:snapshot.committed_micro/1e6,usable:coverage.total_usable,authorContract:QUOTE_AUTHOR_CONTRACT});
 const inspection=inspectBatch(approved);
 const scoreCounts={};let missingScores=0,belowSevenSubscores=0;
 for(const job of approved){const record=job.candidate?.evidence?.record,checks=record?.checks;
  const scores=[checks?.presentation_quality?.item_quality_score,checks?.independent_evaluation?.item_quality_score];
  if(scores.every(Number.isInteger)){const score=Math.min(...scores);scoreCounts[score]=(scoreCounts[score]||0)+1;}else missingScores++;
  if(record?.criteria?.some(c=>c.kind==='craft'&&c.score<7))belowSevenSubscores++;
 }
 save(out+'/batch-inspection.json',{at:new Date().toISOString(),published_denominator:approved.length,
  ...inspection,ready:undefined,overall_craft_scores:scoreCounts,missing_scores:missingScores,
  questions_with_any_craft_subscore_below_7:belowSevenSubscores,
  interpretation:'Overall item scores 7–10 are permitted after every mandatory gate passes. Individual craft subscores are diagnostic. Ratings do not prove perfect accuracy. This aggregate inspection does not replace cohort publication gates.'});
 const count=key=>Object.fromEntries([...new Set(approved.map(j=>j.candidate[key]))].map(k=>[k,approved.filter(j=>j.candidate[key]===k).length]));
 const report={at:new Date().toISOString(),target:500,target_reached:coverage.total_usable>=500,registered_denominator:items.length,
  completed_denominator:reports.filter(r=>r.complete).reduce((n,r)=>n+r.denominator,0),pending_candidates:reports.reduce((n,r)=>n+r.pending,0),
  unique_published_staging:coverage.total_usable,exported_published:approved.length,exported_quarantined:items.filter(j=>j.state==='quarantined').length,
  economics,lifetime:snapshot,lifetime_settled_usd:totals.filter(r=>r.state==='settled').reduce((n,r)=>n+r.actual,0)/1e6,
  lifetime_conservative_holds_usd:snapshot.committed_micro/1e6-totals.filter(r=>r.state==='settled').reduce((n,r)=>n+r.actual,0)/1e6,
  fully_settled:snapshot.unresolved===0&&totals.every(r=>r.state==='settled'),provider_invoices_obtained:false,
  subjects:count('subject'),formats:count('question_type'),difficulties:count('difficulty'),answer_positions:count('correct_answer'),cohorts:reports,
  production_student_retrieval_verified:false,academic_limit:'The frozen benchmark remains a small dated measurement. Independent gates reduce error; no perfect-accuracy claim.'};
 save(out+'/all-candidates.json',items);save(out+'/approved-published.json',approved);save(out+'/rejected.json',items.filter(j=>j.state==='quarantined'));save(out+'/receipts.json',[...receipts.values()]);save(out+'/aggregate-report.json',report);
 const columns=['cohort','id','cohort_complete','state','subject','body','key','options','explanation','supporting_excerpts','validation_results','rejection_reasons','item_cost'];
 const cell=v=>'"'+String(typeof v==='object'?JSON.stringify(v):v??'').replaceAll('"','""')+'"';
 writeFileSync(out+'/all-candidates.csv',[columns,...items.map(j=>{const q=j.candidate||{};return[j.cohort,j.id,j.cohort_complete,j.state,j.subject,q.body,q.correct_answer,q.options,q.explanation,j.supporting_excerpts,j.result,j.result?.reasons,j.item_cost];})].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n');
 console.log(JSON.stringify({registered:report.registered_denominator,completed:report.completed_denominator,unique_published:report.unique_published_staging,pending:report.pending_candidates,lifetime_committed:snapshot.committed_micro/1e6,economics}));
}finally{ledger.close();}
