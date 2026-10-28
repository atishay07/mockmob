import {FACTORY_SUBJECTS,FACTORY_TARGET,inventoryFingerprint,factoryCalibrationReady} from '../../../data/question_factory_policy.mjs';

const chapterName=c=>c==='Dissolution of Partnership'?'Dissolution of Partnership Firm':c;
export function syllabusCoverage(registry,scope) {
  const reserved=new Set(registry.calibration_anchor_ids||[]);
  return FACTORY_SUBJECTS.map(subject=>{
    const anchors=(registry.examples||[]).filter(a=>a.subject===subject&&!a.dropped&&a.final_key_matched&&a.generation_ready!==false&&!reserved.has(a.id)&&registry.packs?.[a.source_pack_id]?.state==='active');
    return {subject,chapters:(scope.subjects?.[subject]?.chapters||[]).map(chapter=>{
      const matching=anchors.filter(a=>chapterName(a.chapter)===chapterName(chapter));
      const supported=matching.filter(a=>a.passage_text?.trim()||a.source_refs?.some(ref=>{const s=registry.sources?.[ref.id];return s?.state==='active'&&s.kind==='reference'&&s.chapters?.some(c=>chapterName(c)===chapterName(chapter))&&s.supports?.[ref.locator]===ref.support_hash;}));
      return {chapter,authenticated_generation_anchors:matching.length,source_supported_generation_anchors:supported.length,ready:supported.length>0};
    }),legacy_chapters_outside_scope:[...new Set(anchors.map(a=>a.chapter))].filter(c=>!scope.subjects?.[subject]?.chapters.some(s=>chapterName(s)===chapterName(c)))};
  });
}
// All jobs remain in the denominator; each distinct accepted item counts once.
// Cohort cost includes planning, authoring, failed attempts, repair and verification.
export function cohortEconomics({jobs=[],cost_usd,held_usd=0,committed_usd,ceiling_usd=50,target=FACTORY_TARGET,published=0,verifier,cohort_verifier,execution_modes=[],preregistered=false}) {
  const pending=jobs.filter(j=>!['eligible','quarantined'].includes(j.state)).length;
  const unique=new Set(jobs.filter(j=>j.state==='eligible'&&j.candidate).map(j=>inventoryFingerprint(j.candidate)));
  const balanced=FACTORY_SUBJECTS.every(s=>jobs.filter(j=>j.subject===s).length>=25)&&new Set(FACTORY_SUBJECTS.map(s=>jobs.filter(j=>j.subject===s).length)).size===1;
  const complete=jobs.length>=100&&balanced&&pending===0&&held_usd===0&&preregistered&&verifier===cohort_verifier&&execution_modes.length>0&&execution_modes.every(m=>m==='batch');
  const measured=complete&&unique.size>0&&Number.isFinite(cost_usd)&&cost_usd>0&&Number.isFinite(committed_usd)&&committed_usd>=cost_usd&&Number.isFinite(ceiling_usd)&&ceiling_usd>0&&Number.isSafeInteger(published)&&published>=0&&Number.isSafeInteger(target)&&target>published;
  const per=measured?cost_usd/unique.size:null;
  const forecast=per===null?null:committed_usd+Math.max(0,target-published)*per;
  return {planned:jobs.length,pending,distinct_automated_eligible:unique.size,eligible_yield:jobs.length?unique.size/jobs.length:0,balanced,complete,
    basis:'Conditional on automated eligibility; independent academic release and publication are separate gates.',
    cost_usd,held_usd,cost_per_eligible_usd:per,forecast_lifetime_usd:forecast,
    required_cost_per_new_question_usd:(ceiling_usd-committed_usd)/Math.max(1,target-published),
    budget_met:measured&&forecast<=ceiling_usd};
}
export function factoryAcceptance({registry,manifest,verifier,scope,cohort,batchProbe,staging}) {
  const coverage=syllabusCoverage(registry,scope);
  const chapters=coverage.flatMap(s=>s.chapters);
  const gates={saved_probe:batchProbe?.verifier===verifier&&batchProbe?.complete===true&&batchProbe.expected_results_met===true,
    academic_release:factoryCalibrationReady(manifest,registry,verifier),
    syllabus_coverage:FACTORY_SUBJECTS.every(s=>coverage.find(c=>c.subject===s)?.chapters.length>0)&&chapters.every(c=>c.ready),
    measured_batch_economics:cohort?.budget_met===true,
    authenticated_staging:Boolean(staging?.project_ref)&&staging.project_ref!==staging.production_project_ref&&staging.signed_in_admin===true&&staging.worker_restart===true&&staging.atomic_publication===true&&staging.dispute_invalidation===true};
  return {ready:Object.values(gates).every(v=>v===true),gates,blockers:Object.entries(gates).filter(([,v])=>v!==true).map(([k])=>k),coverage,
    official_baseline:scope.baseline,final_2027_rules_verified:false,guaranteed_error_free:false};
}
