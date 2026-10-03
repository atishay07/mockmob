import { readFileSync } from 'node:fs';
import { evaluateEvidence } from './content_evidence.js';
export function currentRegistry() { return JSON.parse(readFileSync(new URL('./source_registry.json', import.meta.url), 'utf8')); }
export function publicationEligibility(question) {
  if (process.env.MOCK_AI === 'true' || question.is_deleted || ['quarantined','pending','invalid','rejected'].includes(question.status) || question.verification_state === 'disputed') return { eligible: false, reasons: ['publication_disabled'] };
  try {
    const manifest=JSON.parse(readFileSync(new URL('./calibration_manifest.json',import.meta.url),'utf8'));
    const report=manifest.routes?.[question.evidence?.record?.route];
    if(manifest.state!=='released' || report?.released!==true || report.independent!==true || report.valid_survival<.95 || report.critical_false_accepts!==0 || report.missing_categories?.length!==0)
      return {eligible:false,reasons:['route_calibration_required']};
    const registry=currentRegistry();
    if(report.verifier_version!==question.evidence?.record?.verifier_version || report.source_registry_version!==registry.version || report.split_disjoint!==true)
      return {eligible:false,reasons:['calibration_version_mismatch']};
    return evaluateEvidence(question, registry);
  }
  catch { return { eligible: false, reasons: ['evidence_unavailable'] }; }
}
