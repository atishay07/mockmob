import factoryScope from './question_factory_scope.json' with {type:'json'};
import { createHash } from 'node:crypto';
import { contentHash, canonicalQuestion } from './content_evidence.js';

export const FACTORY_POLICY = 'cuet-llm-v3';
export const FACTORY_SUBJECTS = ['english', 'accountancy', 'business_studies', 'economics'];
export const FACTORY_TARGET = 10000;
export const FACTORY_SUBJECT_TARGET = 2500;
export const FACTORY_PILOT_TARGET = 800;
export const PYQ_KINDS = ['authentic_pyq', 'pyq_adapted'];
export const hashJSON = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function isEvidenceManaged(row) {return Boolean(row?.evidence || row?.provenance);}
export function needsNumericChecks(question,registry={}) {
  const p=question.provenance || question.evidence?.record?.provenance;
  const anchor=registry.examples?.find(a=>a.id===p?.anchor_id);
  const q=canonicalQuestion(question),text=[q.body,...q.options.map(o=>o.text)].join(' ');
  const calculation=/\b(calculate|compute|how much|determine (?:the )?(?:amount|gain|loss|profit|value)|find (?:the )?(?:amount|ratio|value))\b/i.test(q.body) && /\d|₹|Rs\./i.test(text);
  return calculation || (question.route || question.evidence?.record?.route)==='numerical' ||
    /^numerical(?:_|$)/.test(question.question_type || '') || /^numerical(?:_|$)/.test(anchor?.question_type || '');
}
// Strict-quality release (owner direction, 6 Oct 2026: question quality over yield). Valid survival
// measures false rejection of official items, which a stricter verifier may legitimately raise; wrong
// keys, accepted known-bad fixtures and frequent abstention still block release.
export const CALIBRATION_RELEASE=Object.freeze({policy:'strict-quality-v4',valid_survival_overall:.85,valid_survival_route:.8,small_route_size:3,answered_accuracy:.95,max_abstention:.15});
export const routeSurvivalFloor=n=>n<CALIBRATION_RELEASE.small_route_size?1:CALIBRATION_RELEASE.valid_survival_route;
const accurate=a=>a?.sample_size>0 && a.luna_answered>=CALIBRATION_RELEASE.answered_accuracy && a.gemini_answered>=CALIBRATION_RELEASE.answered_accuracy;
// One route predicate for calibration, worker, publication and dashboard paths.
export function routeCalibrationReleased(r,registry,verifierVersion) {
  return r?.released===true && r.independent===true && r.split_disjoint===true && r.verifier_version===verifierVersion && r.source_registry_version===registry?.version &&
    Number.isInteger(r.valid_sample_size) && r.valid_survival>=routeSurvivalFloor(r.valid_sample_size) && r.critical_false_accepts===0 && r.missing_categories?.length===0 && accurate(r.blind_answer_accuracy);
}
export function factoryCalibrationReady(manifest,registry,verifierVersion) {
  const benchmark=manifest?.benchmark;
  const protocol=benchmark?.protocol==='frozen-unobserved-cuET-v1' || benchmark?.protocol==='frozen-source-keyed-cuET-v2' && benchmark.source_keyed===true && benchmark.independent_oracle===true && /^[a-f0-9]{64}$/.test(benchmark.contract_hash||'') && benchmark.contract_hash===manifest.validation_contract;
  return manifest?.state==='released' && protocol && manifest.benchmark.unseen_at_freeze===true && manifest.benchmark.state==='completed' && /^[a-f0-9]{64}$/.test(manifest.benchmark.payload_hash || '') && manifest.benchmark.registry_version===registry.version && manifest.benchmark.verifier_version===verifierVersion && manifest.version===FACTORY_POLICY && manifest.source_registry_version===registry.version &&
    manifest.quality_regression?.verifier_version===verifierVersion && manifest.quality_regression.source_registry_version===registry.version && manifest.quality_regression.sample_size>=18 && manifest.quality_regression.false_accepts===0 &&
    manifest.verifier_version===verifierVersion && manifest.critical_false_accepts===0 && manifest.missing_categories?.length===0 &&
    ['conceptual','numerical','passage'].every(route=>routeCalibrationReleased(manifest.routes?.[route],registry,verifierVersion)) && FACTORY_SUBJECTS.every(subject=>accurate(manifest.by_subject?.[subject])) && manifest.release_policy?.policy===CALIBRATION_RELEASE.policy &&
    manifest.valid_survival>=CALIBRATION_RELEASE.valid_survival_overall && manifest.abstention?.luna<=CALIBRATION_RELEASE.max_abstention && manifest.abstention?.gemini<=CALIBRATION_RELEASE.max_abstention;
}
const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
// Option order and answer/explanation edits cannot inflate the new inventory count.
export function inventoryFingerprint(question) {
  const q = canonicalQuestion(question);
  return hashJSON({ subject: q.subject, body: normalize(q.body), passage: normalize(q.passage), options: q.options.map(o => normalize(o.text)).sort() });
}
export function screeningMatches(row) {
  const receipt = row?.legacy_screening;
  return receipt?.verdict === 'no_issue_found' && receipt.content_hash === contentHash(row) && receipt.question_id === row.id &&
    receipt.review_version === 'subscription-screen-v1' && Number.isFinite(Date.parse(receipt.reviewed_at)) &&
    ['local_mechanical', 'subscription_academic'].includes(receipt.scope) && Array.isArray(receipt.local_findings) && receipt.local_findings.length === 0;
}
export function provenanceReasons(q, registry) {
  const p = q.provenance || q.evidence?.record?.provenance;
  const reasons = [];
  const chapter=q.chapter==='Dissolution of Partnership'?'Dissolution of Partnership Firm':q.chapter;
  if(p?.syllabus_version==='cuet-2026-provisional-for-2027'&&!factoryScope.subjects[q.subject]?.chapters.includes(chapter))reasons.push('current_syllabus_chapter_not_entitled');
  if (!p || !['authentic_pyq', 'pyq_adapted', 'original_practice'].includes(p.kind)) return ['provenance_required'];
  const spec = registry.exam_specs?.[q.subject];
  if (spec?.state !== 'verified' || spec.syllabus_version !== p.syllabus_version || spec.pattern_version !== p.pattern_version) reasons.push('pattern_version_mismatch');
  const pack = registry.packs?.[p.source_pack_id];
  if (!pack || pack.state !== 'active' || pack.version !== p.source_pack_version || pack.subject !== q.subject) reasons.push('source_pack_not_active');
  if (PYQ_KINDS.includes(p.kind)) {
    const anchor = registry.examples?.find(e => e.id === p.anchor_id);
    if (!anchor || anchor.subject !== q.subject || (p.kind==='authentic_pyq' && anchor.chapter !== q.chapter) || anchor.source_kind !== 'authentic_pyq' || anchor.final_key_matched !== true || anchor.dropped || !/^[ABCD]$/.test(anchor.correct_answer || '')) reasons.push('authenticated_anchor_required');
    if (anchor && p.kind === 'authentic_pyq') {
      const original=canonicalQuestion(anchor),actual=canonicalQuestion(q);
      if(actual.body!==original.body || actual.passage!==original.passage || JSON.stringify(actual.options)!==JSON.stringify(original.options) || actual.key!==original.key)reasons.push('authentic_pyq_changed');
    }
    if (anchor && p.kind === 'pyq_adapted' && (inventoryFingerprint(q) === inventoryFingerprint(anchor) || !p.adaptation_type)) reasons.push('adaptation_not_distinct');
  }
  if (p.adaptation_family !== q.family_id) reasons.push('adaptation_family_mismatch');
  return reasons;
}
