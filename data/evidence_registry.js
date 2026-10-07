import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { evaluateEvidence } from './content_evidence.js';
import { FACTORY_POLICY,factoryCalibrationReady,routeCalibrationReleased } from './question_factory_policy.mjs';
export function currentRegistry() { return JSON.parse(readFileSync(new URL('./source_registry.json', import.meta.url), 'utf8')); }
export function publicationEligibility(question) {
  if (process.env.MOCK_AI === 'true' || question.is_deleted || ['quarantined','pending','invalid','rejected'].includes(question.status) || question.verification_state === 'disputed') return { eligible: false, reasons: ['publication_disabled'] };
  try {
    const manifest=JSON.parse(readFileSync(new URL('./calibration_manifest.json',import.meta.url),'utf8'));
    const record=question.evidence?.record,report=manifest.routes?.[record?.route],registry=currentRegistry();
    // Factory records need the full release predicate used by generation; legacy records keep their route gate.
    if(record?.policy_version===FACTORY_POLICY){
      if(!factoryCalibrationReady(manifest,registry,record.verifier_version))return {eligible:false,reasons:['route_calibration_required']};
    } else if(manifest.state!=='released' || !routeCalibrationReleased(report,registry,record?.verifier_version))return {eligible:false,reasons:['route_calibration_required']};
    return evaluateEvidence(question, registry);
  }
  catch { return { eligible: false, reasons: ['evidence_unavailable'] }; }
}
