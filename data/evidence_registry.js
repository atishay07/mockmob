import { readFileSync, statSync } from 'node:fs';
import { URL } from 'node:url';
import { evaluateEvidence } from './content_evidence.js';
import { FACTORY_POLICY,factoryCalibrationReady,routeCalibrationReleased } from './question_factory_policy.mjs';
export function currentRegistry() { return JSON.parse(readFileSync(new URL('./source_registry.json', import.meta.url), 'utf8')); }
/**
 * Registry and calibration read once, for a caller checking many questions in one pass. If either
 * file cannot be read, returns undefined so each check reads (and fails closed) on its own as before.
 */
export function eligibilitySnapshot() {
  try {
    return { manifest: JSON.parse(readFileSync(new URL('./calibration_manifest.json', import.meta.url), 'utf8')), registry: currentRegistry() };
  } catch {
    return undefined;
  }
}
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}
/**
 * The same inputs as eligibilitySnapshot(), parsed at most once per server instance and shared by
 * every request. For request paths that check questions one at a time; parsing both files (4.9 MB)
 * per question cost about 37 ms each. The files ship with the deployment, so on Vercel they cannot
 * change while an instance runs. A changed size or modification time (a local edit or factory run)
 * is read again, so a verdict always equals the one a fresh read gives. The parsed objects are
 * frozen because requests share them. A failed read is never remembered: it returns undefined, and
 * each check then reads (and fails closed) on its own, exactly as with eligibilitySnapshot().
 */
export function createEligibilitySnapshotCache({ manifest, registry }) {
  let cached = null;
  const stamp = file => { const s = statSync(file); return `${s.size}:${s.mtimeMs}`; };
  return function sharedSnapshot() {
    try {
      const key = `${stamp(manifest)}|${stamp(registry)}`;
      if (cached?.key === key) return cached.value;
      const value = deepFreeze({ manifest: JSON.parse(readFileSync(manifest, 'utf8')), registry: JSON.parse(readFileSync(registry, 'utf8')) });
      cached = { key, value };
      return value;
    } catch {
      return undefined;
    }
  };
}
export const sharedEligibilitySnapshot = createEligibilitySnapshotCache({
  manifest: new URL('./calibration_manifest.json', import.meta.url),
  registry: new URL('./source_registry.json', import.meta.url),
});
// A caller checking a whole inventory may bind the registry/calibration it read
// for that request. This shares inputs only: no item verdict is cached, and
// signatures, content, source versions, expiry and disputes are checked anew.
export function publicationEligibility(question, snapshot) {
  if (process.env.MOCK_AI === 'true' || question.is_deleted || ['quarantined','pending','invalid','rejected'].includes(question.status) || question.verification_state === 'disputed') return { eligible: false, reasons: ['publication_disabled'] };
  try {
    const manifest=snapshot?.manifest ?? JSON.parse(readFileSync(new URL('./calibration_manifest.json',import.meta.url),'utf8'));
    const record=question.evidence?.record,report=manifest.routes?.[record?.route],registry=snapshot?.registry ?? currentRegistry();
    // Factory records need the full release predicate used by generation; legacy records keep their route gate.
    if(record?.policy_version===FACTORY_POLICY){
      if(!factoryCalibrationReady(manifest,registry,record.verifier_version))return {eligible:false,reasons:['route_calibration_required']};
    } else if(manifest.state!=='released' || !routeCalibrationReleased(report,registry,record?.verifier_version))return {eligible:false,reasons:['route_calibration_required']};
    return evaluateEvidence(question, registry);
  }
  catch { return { eligible: false, reasons: ['evidence_unavailable'] }; }
}
