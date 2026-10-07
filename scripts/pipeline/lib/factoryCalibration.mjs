import { canonicalQuestion } from '../../../data/content_evidence.js';
import { FACTORY_SUBJECTS,FACTORY_POLICY,provenanceReasons,hashJSON,inventoryFingerprint,CALIBRATION_RELEASE,routeSurvivalFloor } from '../../../data/question_factory_policy.mjs';
import { calibrate,blindView,structureVerdict } from './evidencePipeline.mjs';
import { createFactoryEvidence,FACTORY_VERIFIER_VERSION } from './factoryEvidence.mjs';
import { validateFactoryCandidate,repairFactoryCandidate } from './factoryCore.mjs';
import { BatchPending } from './factoryTransport.mjs';
import {presentationLint} from '../../../data/question_presentation.mjs';
import {benchmarkEvidence} from './factoryBenchmark.mjs';

export function officialCalibrationUnit(anchor) {
  const passage=canonicalQuestion(anchor).passage.trim().replace(/\s+/g,' ');
  return `cuet-item-v1:${passage?hashJSON({subject:anchor.subject,passage}):inventoryFingerprint(anchor)}`;
}

export function validateCalibrationManifest(manifest,registry) {
  if(!manifest.development?.length || !manifest.held_out?.length)throw new Error('independently_keyed_development_and_held_out_sets_required');
  const fixtures=[...manifest.development,...manifest.held_out];
  if(new Set(fixtures.map(f=>f.id)).size!==fixtures.length)throw new Error('unique_calibration_ids_required');
  if(new Set(fixtures.map(f=>f.question?.id)).size!==fixtures.length || manifest.development.some(f=>f.split!=='development') || manifest.held_out.some(f=>f.split!=='held_out'))throw new Error('distinct_calibration_questions_and_splits_required');
  for(const f of fixtures) {
    const anchor=registry.examples?.find(a=>a.id===f.provenance?.anchor_id);
    if(!anchor || !anchor.final_key_matched || anchor.dropped || f.provenance.source_id!==anchor.source_id || f.provenance.key_locator!==anchor.key_locator ||
      f.provenance.independently_keyed!==true || f.provenance.final_answer!==anchor.correct_answer)throw new Error('fixture_official_key_match_required');
    if(f.valid) {
      if(!structureVerdict(f.question).passed)throw new Error('valid_calibration_structure_required');
      if(provenanceReasons(f.question,registry).includes('current_syllabus_chapter_not_entitled'))throw new Error('valid_calibration_current_syllabus_required');
      if(presentationLint(f.question).includes('english_passage_word_limit'))throw new Error('valid_calibration_current_passage_limit_required');
      const a=canonicalQuestion(anchor),q=canonicalQuestion(f.question);
      if(q.body!==a.body || JSON.stringify(q.options)!==JSON.stringify(a.options) || q.passage!==a.passage || q.key!==a.key)throw new Error('valid_calibration_requires_authentic_keyed_original');
    }
    if(manifest.split_policy==='authenticated_item_and_passage_disjoint_v1' && f.provenance.source_unit_id!==officialCalibrationUnit(anchor))throw new Error('authenticated_calibration_source_unit_required');
  }
  const unit=f=>f.provenance.source_unit_id || f.provenance.source_id;
  const developmentUnits=new Set(manifest.development.map(unit)),developmentFamilies=new Set(manifest.development.map(f=>f.question.family_id));
  if(manifest.held_out.some(f=>developmentUnits.has(unit(f)) || developmentFamilies.has(f.question.family_id)))throw new Error('calibration_source_units_or_families_overlap');
  for(const subject of FACTORY_SUBJECTS)if(!manifest.held_out.some(f=>f.valid && f.question.subject===subject) || !manifest.development.some(f=>f.valid && f.question.subject===subject))throw new Error('four_subject_calibration_required');
  return fixtures;
}
export function calibrationAccuracy(observations) {
  const valid=observations.filter(o=>o.expected_valid);
  const accuracy=provider=>valid.length?valid.filter(o=>o[provider]===o.official_key).length/valid.length:null;
  // Abstention is reported separately: a wrong key is a different failure from declining an ambiguous item.
  const answered=provider=>{const a=valid.filter(o=>/^[ABCD]$/.test(o[provider]||''));return a.length?a.filter(o=>o[provider]===o.official_key).length/a.length:null;};
  const abstained=provider=>valid.length?valid.filter(o=>!/^[ABCD]$/.test(o[provider]||'')).length/valid.length:null;
  return {sample_size:valid.length,luna:accuracy('luna'),gemini:accuracy('gemini'),luna_answered:answered('luna'),gemini_answered:answered('gemini'),luna_abstention:abstained('luna'),gemini_abstention:abstained('gemini')};
}
export async function runFactoryCalibration(manifest,{registry,ledger,transport,concurrency=1,evaluateDevelopment=true,cacheOnly=false,onObservation=()=>{}}) {
  const fixtures=validateCalibrationManifest(manifest,registry),results=new Map(),observations=[],pending=[];
  const calibrationTransport={generate:(provider,body,options)=>transport.generate(provider,body,{...options,purpose:'calibration'})};
  const adapters=createFactoryEvidence({registry,ledger,transport:calibrationTransport});
  // Accepted batches persist in the ledger. A rerun continues cached stages;
  // every independent fixture can enter the queue before any one batch finishes.
  const selected=evaluateDevelopment?fixtures:manifest.held_out;
  async function inspect(f) {
    try {
      let luna=null,gemini=null;
      let waiting=false;
      if(f.valid) {
        const view=blindView(f.question,f.question.source_refs || []);
        // Independent evaluations can both enter their durable batch queues.
        // One provider's accepted/pending request must not starve the other.
        for(const [provider,adapter]of [['luna',adapters.blind_solution],['gemini',adapters.independent_evaluation]]) {
          try {const answer=(await adapter(view)).solved_key;if(provider==='luna')luna=answer;else gemini=answer;}
          catch(error){if(error instanceof BatchPending||cacheOnly&&error.message==='calibration_cache_miss'){pending.push({id:f.id,provider,batch_id:error.batchId||null,not_dispatched:!error.batchId,reason:error.message});waiting=true;}else throw error;}
        }
      }
      if(waiting)return;
      // Official originals certify academic validity; the stricter polish gate is audited separately.
      let result=await validateFactoryCandidate(f.question,{registry,ledger,transport:calibrationTransport,polish:false});
      // Mirror production: an authenticated original gets one explanation repair; its stem, options and key stay immutable.
      if(f.valid && result.state==='quarantined' && result.reasons?.includes('failed:explanation_support')){
        try{
          const repaired=await repairFactoryCandidate(f.question,[...result.reasons,...(result.failure_details||[])],{registry,ledger,transport:calibrationTransport});
          result={...await validateFactoryCandidate(repaired,{registry,ledger,transport:calibrationTransport,polish:false}),explanation_repaired:true};
        }catch(error){if(!/^repair_/.test(error.message))throw error;result={...result,reasons:[...result.reasons,error.message]};}
      }
      results.set(f.id,result);
      if(f.split==='held_out')observations.push({id:f.id,subject:f.question.subject,route:f.question.route,expected_valid:f.valid,
        official_key:f.provenance.final_answer,luna,gemini,state:result.state,reasons:result.reasons || [],failure_details:result.failure_details || []});
    } catch(error) {
      if(error instanceof BatchPending||cacheOnly&&error.message==='calibration_cache_miss')pending.push({id:f.id,batch_id:error.batchId||null,not_dispatched:!error.batchId,reason:error.message});
      else if(['provider_output_incomplete','invalid_provider_json','unmatched_evaluation_identity'].includes(error.message)) {
        const result={state:'quarantined',reasons:[error.message]};results.set(f.id,result);
        if(f.split==='held_out')observations.push({id:f.id,subject:f.question.subject,route:f.question.route,expected_valid:f.valid,
          official_key:f.provenance.final_answer,luna:null,gemini:null,state:result.state,reasons:result.reasons});
      }else throw error;
    }finally{onObservation({id:f.id,expected_valid:f.valid,state:results.get(f.id)?.state || 'waiting',reasons:results.get(f.id)?.reasons || [],failure_details:results.get(f.id)?.failure_details || [],complete:observations.length,pending:pending.length});}
  }
  let cursor=0,failure=null;
  await Promise.allSettled(Array.from({length:Math.max(1,Math.min(6,concurrency))},async()=>{for(;;){
    if(failure)return;const f=selected[cursor++];if(!f)return;
    try{await inspect(f);}catch(error){failure ||= error;return;}
  }}));
  if(failure)throw failure;
  observations.sort((a,b)=>manifest.held_out.findIndex(f=>f.id===a.id)-manifest.held_out.findIndex(f=>f.id===b.id));
  const base={version:FACTORY_POLICY,verifier_version:FACTORY_VERIFIER_VERSION,source_registry_version:registry.version,at:new Date().toISOString(),independent:true};
  if(pending.length)return {...base,benchmark:benchmarkEvidence(manifest,{registry,ledger}),state:'paused',reason:cacheOnly?'calibration_cache_incomplete':'calibration_batches_pending',pending,routes:{},observations};
  const overall=await calibrate(manifest.held_out,q=>results.get(manifest.held_out.find(f=>f.question.id===q.id).id),manifest.development);
  const routes={};
  for(const route of ['conceptual','numerical','passage']) {
    const routeFixtures=manifest.held_out.filter(f=>f.question.route===route);
    const report=await calibrate(routeFixtures,q=>results.get(routeFixtures.find(f=>f.question.id===q.id).id),manifest.development);
    const blind_answer_accuracy=calibrationAccuracy(observations.filter(o=>o.route===route));
    routes[route]={...report,...base,missing_categories:overall.missing_categories,blind_answer_accuracy,
      released:overall.independent && overall.split_disjoint && overall.missing_categories.length===0 && overall.critical_false_accepts===0 &&
        report.valid_sample_size>0 && report.invalid_sample_size>0 && report.valid_survival>=routeSurvivalFloor(report.valid_sample_size) &&
        blind_answer_accuracy.luna_answered>=CALIBRATION_RELEASE.answered_accuracy && blind_answer_accuracy.gemini_answered>=CALIBRATION_RELEASE.answered_accuracy};
  }
  const by_subject=Object.fromEntries(FACTORY_SUBJECTS.map(subject=>[subject,calibrationAccuracy(observations.filter(o=>o.subject===subject))]));
  const all=calibrationAccuracy(observations),abstention={luna:all.luna_abstention,gemini:all.gemini_abstention};
  const benchmark={...benchmarkEvidence(manifest,{registry,ledger}),verifier_version:FACTORY_VERIFIER_VERSION};
  const released=benchmark.unseen_at_freeze===true && Object.values(routes).every(r=>r.released) && Object.values(by_subject).every(a=>a.luna_answered>=CALIBRATION_RELEASE.answered_accuracy && a.gemini_answered>=CALIBRATION_RELEASE.answered_accuracy) &&
    overall.valid_survival>=CALIBRATION_RELEASE.valid_survival_overall && abstention.luna<=CALIBRATION_RELEASE.max_abstention && abstention.gemini<=CALIBRATION_RELEASE.max_abstention && overall.critical_false_accepts===0;
  return {...base,benchmark,state:released?'released':'paused',release_policy:CALIBRATION_RELEASE,valid_survival:overall.valid_survival,abstention,routes,by_subject,observations,critical_false_accepts:overall.critical_false_accepts,missing_categories:overall.missing_categories};
}
