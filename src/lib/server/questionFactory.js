import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { currentRegistry } from '@/../data/evidence_registry';
import {syllabusCoverage} from '@/../scripts/pipeline/lib/factoryAcceptance.mjs';
import { sourceReadiness } from '@/../scripts/pipeline/lib/sourcePacks.mjs';
import { mechanicalScreen, reviewBundles, importSubscriptionReview } from '@/../scripts/pipeline/lib/subscriptionScreening.mjs';
import { hashJSON, FACTORY_SUBJECTS,FACTORY_PILOT_TARGET,factoryCalibrationReady } from '@/../data/question_factory_policy.mjs';
import { FACTORY_VERIFIER_VERSION } from '@/../scripts/pipeline/lib/factoryEvidence.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readBankSnapshot,readAllRows } from '@/../scripts/pipeline/lib/bankSnapshot.mjs';
import {detailedCoverage} from '@/../scripts/pipeline/lib/topicCoverage.mjs';
import {phaseBudgetFits,checkpointEvidenceReady} from '@/../data/factory_phase_budget.mjs';

async function readAll(db,table,select='*') {
  const rows=[];
  for(let i=0;;i+=1000) {
    const {data,error}=await db.from(table).select(select).order(table==='question_factory_publications'?'question_id':'id').range(i,i+999);
    if(error)throw new Error(`factory_storage_unavailable:${error.code}`);rows.push(...data);if(data.length<1000)break;
  }
  return rows;
}
export async function factoryOverview() {
  const db=supabaseAdmin(),registry=currentRegistry();
  const base={scope_coverage:syllabusCoverage(registry,JSON.parse(readFileSync(resolve('data/question_factory_scope.json'),'utf8'))),sources:sourceReadiness(registry),target:10000,subject_target:2500,calibration:JSON.parse(readFileSync(resolve('data/calibration_manifest.json'),'utf8')).state};
  try {
    const {data:control,error}=await db.from('question_factory_control').select('*').eq('id',1).single();
    if(error)throw new Error('factory_migration_required');
    const publications=await readAll(db,'question_factory_publications','question_id,subject,chapter,kind');
    const {data:jobs,error:jobsError}=await db.from('question_factory_jobs').select('id,subject,chapter,state,stage,candidate,result,updated_at').order('updated_at',{ascending:false}).limit(50);
    const {data:disputes,error:disputeError}=await db.from('question_content_disputes').select('id,question_id,content_hash,reason,state,created_at').eq('state','open').order('created_at',{ascending:false}).limit(50);
    if(jobsError || disputeError)throw new Error('factory_status_unavailable');
    const [inventory,holds]=await Promise.all([readBankSnapshot(db),readAllRows(db,'recovery_family_holds','family_id','family_id')]);
    const usable=detailedCoverage(inventory,registry,{heldFamilies:holds.map(h=>h.family_id)});
    const coverage=usable.cells.map(c=>({...c,published:publications.filter(p=>p.subject===c.subject && p.chapter===c.chapter).length,reference_available:base.sources.find(s=>s.subject===c.subject)?.chapters.includes(c.chapter)}));
    const scope_coverage=base.sources.map(s=>({subject:s.subject,chapters:coverage.filter(c=>c.subject===s.subject).map(c=>({...c,ready:c.reference_available}))}));
    return {...base,scope_coverage,available:true,control,jobs,disputes,coverage,counts_snapshot_at:usable.inventory_at,counts:{total:publications.length,usable:usable.total_usable,by_subject:Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,publications.filter(p=>p.subject===s).length])),
      authentic:publications.filter(p=>p.kind==='authentic_pyq').length,adapted:publications.filter(p=>p.kind==='pyq_adapted').length,original:publications.filter(p=>p.kind==='original_practice').length}};
  } catch(e) {return {...base,available:false,blocker:e.message,counts:{total:0,by_subject:{}},jobs:[],disputes:[]};}
}
export async function controlFactory(action) {
  if(!['pause','resume','release_1000','release_10000'].includes(action))throw new Error('unknown_factory_action');
  const db=supabaseAdmin(),overview=await factoryOverview();
  if(!overview.available)throw new Error('factory_migration_required');
  const patch={updated_at:new Date().toISOString()};
  if(action==='pause')patch.paused=true;
  else {
    if(overview.sources.some(s=>!s.ready))throw new Error('authoritative_source_coverage_required');
    if(!overview.control.snapshot?.historical_reconciled)throw new Error('historical_spend_reconciliation_required');
    if(!factoryCalibrationReady(JSON.parse(readFileSync(resolve('data/calibration_manifest.json'),'utf8')),currentRegistry(),FACTORY_VERIFIER_VERSION))throw new Error('route_calibration_required');
    if(overview.control.snapshot?.budget?.unbounded_unresolved ?? overview.control.snapshot?.budget?.unresolved)throw new Error('budget_usage_unresolved');
    const heartbeatAt=Date.parse(overview.control.snapshot?.at || '');
    if(!Number.isFinite(heartbeatAt) || Date.now()-heartbeatAt>300000 || heartbeatAt>Date.now()+60000)throw new Error('worker_heartbeat_required');
    if(!phaseBudgetFits(overview.control.snapshot,action,overview.counts.total))throw new Error('checkpoint_forecast_exceeds_lifetime_budget');
    if((overview.control.snapshot?.budget?.committed_micro ?? Infinity)>=50000000)throw new Error('budget_exhausted');
    patch.paused=false;
    if(action!=='resume') {
      if(overview.calibration!=='released')throw new Error('route_calibration_required');
      if(action==='release_1000') {
        if(!checkpointEvidenceReady(overview.control.snapshot,action,overview.counts.total,overview.control.pilot_target || FACTORY_PILOT_TARGET))throw new Error('pilot_quality_and_cost_gate_required');
        patch.phase='1000';patch.publication_enabled=true;
      } else {
        if(!checkpointEvidenceReady(overview.control.snapshot,action,overview.counts.total))throw new Error('thousand_question_checkpoint_required');
        patch.phase='10000';patch.publication_enabled=true;
      }
    }
  }
  const {error}=await db.from('question_factory_control').update(patch).eq('id',1);if(error)throw new Error('factory_control_write_failed');
  // Re-read authoritative controls, but do not download/reclassify the entire
  // bank twice for one action. Inventory counts retain their explicit snapshot
  // time; worker/publication changes continue to appear on the next overview.
  const {data:control,error:readError}=await db.from('question_factory_control').select('*').eq('id',1).single();
  if(readError)throw new Error('factory_control_read_failed');
  return {...overview,control};
}
export async function exportLegacyBundles() {
  const rows=await readBankSnapshot(supabaseAdmin()),receipts=mechanicalScreen(rows),bundles=reviewBundles(rows,receipts,{sources:currentRegistry().sources});
  return {version:'subscription-screen-v1',api_spend_usd:0,rows:rows.length,bundles,local_receipts:receipts};
}
export async function applySubscriptionReview(payload) {
  const bundle=payload.bundle,response=payload.response;
  if(!bundle?.questions?.length || bundle.questions.length>20 || hashJSON(bundle.questions)!==bundle.id)throw new Error('invalid_review_bundle');
  const db=supabaseAdmin(),ids=bundle.questions.map(q=>q.id);
  // Full bank mechanical receipts avoid clearing a duplicate merely because its
  // canonical original is outside this 20-question bundle.
  const allRows=await readBankSnapshot(db),rows=allRows.filter(q=>ids.includes(q.id)),receipts=mechanicalScreen(allRows);
  const imported=importSubscriptionReview(bundle,response,rows,receipts);
  const applied=[];
  for(const receipt of imported) {
    const current=rows.find(q=>q.id===receipt.question_id);
    const {error:writeError}=await db.rpc('apply_factory_screening',{p_question:receipt.question_id,p_expected:current,p_receipt:receipt});
    if(writeError)throw new Error(`screen_import_stopped:${writeError.code}:applied_${applied.length}`);
    applied.push(receipt.question_id);
  }
  return {applied:applied.length,api_spend_usd:0,academically_certified:0};
}
