import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {factoryCostReport} from '../lib/factoryCosts.mjs';
import {factoryAcceptance,cohortEconomics} from '../lib/factoryAcceptance.mjs';
import {FACTORY_VERIFIER_VERSION} from '../lib/factoryEvidence.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const out='artifacts/question-factory/implementation-2026-10-07';mkdirSync(out,{recursive:true});
const db=new DatabaseSync(process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite',{readOnly:true});
try{
 const requests=db.prepare('SELECT * FROM requests').all();
 const settled=requests.filter(r=>r.state==='settled').reduce((s,r)=>s+r.actual/1e6,0),held=requests.filter(r=>r.state!=='settled').reduce((s,r)=>s+(r.actual??r.reserved)/1e6,0);
 const ceiling=db.prepare('SELECT limit_micro FROM budget WHERE id=1').get().limit_micro/1e6;
 const registry=read('data/source_registry.json'),manifest=read('data/calibration_manifest.json'),scope=read('data/question_factory_scope.json');
 let cohort=null;const campaign=process.argv.find(a=>a.startsWith('--cohort='))?.slice(9);
 if(campaign){if(!/^[a-z0-9.-]+$/.test(campaign))throw Error('invalid_campaign');
   const root=`artifacts/question-factory/${campaign}`,state=read(`${root}/campaign-state.json`),pre=read(`${root}/preregistered.json`),result=read(`${root}/results.json`);
   const before=new Set(state.before_request_ids);const window=requests.filter(r=>!before.has(r.id));
   cohort=cohortEconomics({jobs:result.jobs,cost_usd:window.filter(r=>r.state==='settled').reduce((s,r)=>s+r.actual/1e6,0),held_usd:window.filter(r=>r.state!=='settled').reduce((s,r)=>s+(r.actual??r.reserved)/1e6,0),committed_usd:settled+held,ceiling_usd:ceiling,verifier:FACTORY_VERIFIER_VERSION,cohort_verifier:result.verifier,
     execution_modes:window.filter(r=>r.state==='settled'&&r.actual>0).map(r=>JSON.parse(r.receipt_json||'{}').execution_mode),preregistered:pre.denominator===result.jobs.length&&state.registry_hash===pre.registry_hash});
 }
 const stagingPath=`${out}/staging-evidence.json`,staging=existsSync(stagingPath)?read(stagingPath):null;
 const probe=read('artifacts/question-factory/final-pass/batch-probe.json');
 const acceptance=factoryAcceptance({registry,manifest,verifier:FACTORY_VERIFIER_VERSION,scope,cohort,batchProbe:probe,staging});
 const report={at:new Date().toISOString(),production_changes:0,...acceptance,cohort,costs:factoryCostReport({db}),budget:{ceiling_usd:ceiling,settled_gross_usd:settled,held_usd:held,available_usd:ceiling-settled-held,unresolved_requests:requests.filter(r=>r.state==='unresolved').length},
   probe:{pending:probe.pending,complete:probe.complete,expected_results_met:probe.expected_results_met},staging:staging||{state:'not_verified'},verifier:FACTORY_VERIFIER_VERSION,registry_version:registry.version};
 writeFileSync(`${out}/acceptance.json`,JSON.stringify(report,null,2)+'\n');
 const missing=acceptance.coverage.flatMap(s=>s.chapters.filter(c=>!c.ready).map(c=>`${s.subject}: ${c.chapter}`));
 writeFileSync(`${out}/ACCEPTANCE.md`,[`# Question factory acceptance — 7 October 2026`,'',`Ready: **${report.ready}**. This is a measured gate report, not an error-free-content guarantee.`,'',...Object.entries(report.gates).map(([k,v])=>`- ${k}: ${v===true?'PASS':'NOT MET'}`),'',`Gross settled $${settled.toFixed(6)}; holds $${held.toFixed(6)}; available $${report.budget.available_usd.toFixed(6)} under $${ceiling}.`,'',`Saved probe pending: ${probe.pending}. No new bank publication or production changes.`,'','## Chapters still lacking source-supported generation anchors','',...missing.map(x=>`- ${x}`),'',`Baseline: ${scope.baseline}.`, '', 'Collect saved probe receipts with --reconcile-only; its v5.4 results cannot qualify the current verifier. Do not dispatch while usage is unresolved. Replace the incompatible historical passages and prepare a newly frozen, current-format unseen benchmark before calibration release. Complete a preregistered 100-candidate balanced native-batch cohort before scaling. Authenticated staging evidence must come from a separate project.'].join('\n')+'\n');
 console.log(JSON.stringify({ready:report.ready,gates:report.gates,budget:report.budget,probe:report.probe,missing_chapters:missing.length,cohort},null,2));
}finally{db.close();}
