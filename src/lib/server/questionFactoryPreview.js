import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { currentRegistry } from '@/../data/evidence_registry';
import { sourceReadiness } from '@/../scripts/pipeline/lib/sourcePacks.mjs';

// Reading saved local receipts is separate from the React rendering boundary.
export function loadFactoryPreview() {
  let snapshot={},jobs=[];
  try {snapshot=JSON.parse(readFileSync(resolve('data/question-factory-runtime/worker-status.json'),'utf8'));}catch{ /* no commissioning receipt yet */ }
  try {jobs=JSON.parse(readFileSync(resolve('data/question-factory-runtime/local-pilot.json'),'utf8')).candidates.slice(-50);}catch{ /* no local queue yet */ }
  let target=800;
  try {
    const campaign=JSON.parse(readFileSync(resolve('artifacts/question-factory/commissioning100-progress.json'),'utf8'));
    const allJobs=campaign.jobs;
    jobs=allJobs.slice(-20).map(({id,subject,chapter,state,stage,candidate,result})=>({id,subject,chapter,state,stage,candidate,result:{reasons:result?.reasons,checks:candidate?.evidence?undefined:result?.checks}}));
    target=100;
    snapshot={...snapshot,blocker:'Local 100-candidate commissioning; production publication remains gated',
      budget:{limit_micro:Math.round((campaign.budget.available_usd+campaign.budget.gross_usd+campaign.budget.held_usd)*1e6),committed_micro:Math.round((campaign.budget.gross_usd+campaign.budget.held_usd)*1e6)},costs:campaign.budget.costs,
      pilot:{target,total:allJobs.length,generated:allJobs.filter(j=>j.candidate).length,eligible:allJobs.filter(j=>j.state==='eligible').length,quarantined:allJobs.filter(j=>j.state==='quarantined').length,complete:allJobs.length===100&&allJobs.every(j=>['eligible','quarantined'].includes(j.state))}};
  }catch{ /* retain the existing commissioning preview */ }
  try {
    const report=JSON.parse(readFileSync(resolve('artifacts/question-factory/commissioning100-report.json'),'utf8'));
    snapshot={...snapshot,forecast_usd:report.cost.batch_forecast_10000_eligible_usd,cost_per_published_usd:report.cost.per_eligible_usd,
      achievable_published:report.cost.prospective_total_eligible_affordable,shortfall_usd:report.cost.shortfall_to_10000_usd,rejection_reasons:report.rejection_reasons};
  }catch{ /* forecast appears once the full commissioning report exists */ }
  try {
    const quality=JSON.parse(readFileSync(resolve('artifacts/question-factory/quality-uplift/final-status.json'),'utf8'));
    snapshot={...snapshot,blocker:'Quality calibration failed; generation and publication remain paused',
      quality_audit:quality.audit,quality_calibration:quality.calibration,
      budget:{limit_micro:Math.round(quality.budget.limit_usd*1e6),committed_micro:Math.round((quality.budget.gross_usd+quality.budget.held_usd)*1e6)},costs:quality.budget.costs,
      forecast_usd:null,cost_per_published_usd:null,achievable_published:null,shortfall_usd:null,pilot:{...snapshot.pilot,historical:true}};
    jobs=jobs.map(job=>({...job,state:job.state==='eligible'?'previously_passed_awaiting_revalidation':job.state}));
  }catch{ /* preserve earlier receipts until the quality audit is recorded */ }
  try {
    const final=JSON.parse(readFileSync(resolve('artifacts/question-factory/final-pass/reconciliation-report.json'),'utf8'));
    const cohort=JSON.parse(readFileSync(resolve('artifacts/question-factory/quality-v5/results.json'),'utf8'));
    target=100;
    snapshot={...snapshot,blocker:'Revised quality policy awaits live calibration; source coverage and staging publication remain incomplete',
      quality_audit:null,quality_calibration:null,reviewed_cohort:final.historical_cohort,
      budget:{limit_micro:Math.round(final.budget.ceiling_usd*1e6),committed_micro:Math.round((final.budget.settled_gross_usd+final.budget.held_usd)*1e6)},costs:final.budget.costs,
      forecast_usd:null,cost_per_published_usd:null,achievable_published:null,shortfall_usd:null,
      pilot:{target,total:100,generated:cohort.generated,eligible:cohort.eligible,quarantined:cohort.quarantined,historical:true}};
    jobs=cohort.jobs.slice(-20).map(j=>({...j,state:j.state==='eligible'?'historical_pass_needs_revalidation':j.state,result:{reasons:j.result?.reasons}}));
  }catch { /* missing report is never replaced with invented counts */ }
  let scopeCoverage=[];
  try {
    const acceptance=JSON.parse(readFileSync(resolve('artifacts/question-factory/implementation-2026-10-07/acceptance.json'),'utf8'));
    scopeCoverage=acceptance.coverage;
    snapshot={...snapshot,blocker:'Publication paused: quality benchmark, complete syllabus coverage, measured batch cost and authenticated staging are still required.'+(acceptance.budget.unresolved_requests?' New paid requests are blocked by an unresolved provider usage receipt.':''),
      acceptance_at:acceptance.at,costs:acceptance.costs,budget:{limit_micro:Math.round(acceptance.budget.ceiling_usd*1e6),committed_micro:Math.round((acceptance.budget.settled_gross_usd+acceptance.budget.held_usd)*1e6)},forecast_usd:null};
  }catch { /* Absent acceptance evidence never creates a release claim. */ }
  try {
    const current=JSON.parse(readFileSync(resolve('artifacts/question-factory/execution-2026-10-07/batch-report.json'),'utf8'));
    const all=JSON.parse(readFileSync(resolve('artifacts/question-factory/execution-2026-10-07/all-100.json'),'utf8'));
    const coverage=JSON.parse(readFileSync(resolve('artifacts/question-factory/execution-2026-10-07/inventory-coverage-before.json'),'utf8'));
    snapshot={...snapshot,blocker:current.complete?'Current batch complete; staging publication requires current evidence and separate credentials':'Current preregistered batch remains incomplete',budget:current.lifetime,forecast_usd:current.conditional_10000_forecast_usd,
      costs:current.costs_by_stage || {stages:[]},pilot:{target:100,total:100,generated:all.filter(j=>j.candidate).length,eligible:current.approved_unique,quarantined:current.rejected,historical:false}};
    jobs=all.slice(-20);scopeCoverage=sourceReadiness(currentRegistry()).map(s=>({subject:s.subject,chapters:coverage.cells.filter(c=>c.subject===s.subject).map(c=>({...c,ready:s.chapters.includes(c.chapter)}))}));
  }catch { /* Current results are unavailable until the persistent runner exports them. */ }
  return {scope_coverage:scopeCoverage,available:false,blocker:snapshot.blocker || 'Local commissioning; publication remains gated',control:{paused:true,phase:'pilot',pilot_target:target,snapshot},sources:sourceReadiness(currentRegistry()),counts:{total:0,by_subject:{}},jobs,disputes:[]};
}
