import { canonicalJSON } from '../../../data/canonical_json.mjs';
import { cuetFitReleased } from '../../../data/cuet_fit_evidence.mjs';
import { expectedReleaseBinding, RELEASE_POLICY_V7, REQUIRED_SUBJECTS } from './releaseEvidenceV7.mjs';

export function currentCuetCalibrationReadyVNext({ manifest, registry, binding = expectedReleaseBinding() }) {
  const topology = 'dual_blind';
  const release = manifest?.cuet_fit_releases?.[topology];
  if (!release || release.topology !== topology) return false;
  if (release.state !== 'released' || !Array.isArray(release.problems) || release.problems.length !== 0 ||
      !Array.isArray(release.fresh_false_accepts) || release.fresh_false_accepts.length !== 0 ||
      !Array.isArray(release.regression_false_accepts) || release.regression_false_accepts.length !== 0 ||
      !(release.valid_survival >= RELEASE_POLICY_V7.valid_survival_min) ||
      REQUIRED_SUBJECTS.some(subject => !release.valid_by_subject?.[subject] ||
        !(release.valid_by_subject[subject].ok / release.valid_by_subject[subject].n >= RELEASE_POLICY_V7.per_subject_valid_survival_min)) ||
      canonicalJSON(release.release_policy) !== canonicalJSON(RELEASE_POLICY_V7) ||
      release.verifier_version !== binding.verifier_version ||
      release.prompt_hash !== binding.prompt_hash ||
      release.cuet_fit_contract !== binding.cuet_fit_contract ||
      release.effort_policy !== binding.effort_policy ||
      canonicalJSON(release.efforts) !== canonicalJSON(binding.efforts) ||
      release.validation_contract_hash !== binding.validation_contract_hash ||
      release.source_registry_version !== registry?.version) return false;
  const record = {
    validation_topology: topology,
    verifier_version: binding.verifier_version,
    checks: { blind_solution: { evaluation_prompt: binding.prompt_hash } },
  };
  return cuetFitReleased(manifest, registry, record);
}

export function releaseBenchmarkStateVNext(assessment) {
  return assessment?.state === 'released' && Array.isArray(assessment.problems) && assessment.problems.length === 0
    ? 'completed'
    : 'pending';
}

// One canonical producer path keeps the persisted record aligned with the
// runtime predicate. Missing false-accept evidence fails closed.
export function buildCuetFitTopologyReleaseVNext({
  assessment, resultFresh, topology, tag, freshName, binding, sourceRegistryVersion, at,
}) {
  const freshFalseAccepts = assessment?.metrics?.fresh_false_accepts;
  const regressionFalseAccepts = assessment?.metrics?.regression_false_accepts;
  if (!Array.isArray(freshFalseAccepts) || !Array.isArray(regressionFalseAccepts)) {
    throw new Error('release_false_accept_metrics_required');
  }
  const problems = Array.isArray(assessment.problems) ? assessment.problems : ['release_assessment_problems_missing'];
  return {
    state: problems.length ? 'paused' : assessment.state,
    topology,
    effort_policy: binding.effort_policy,
    efforts: binding.efforts,
    verifier_version: binding.verifier_version,
    cuet_fit_contract: binding.cuet_fit_contract,
    prompt_hash: binding.prompt_hash,
    validation_contract_hash: binding.validation_contract_hash,
    source_registry_version: sourceRegistryVersion,
    release_policy: assessment.policy,
    ...assessment.metrics,
    critical_false_accepts: freshFalseAccepts.length + regressionFalseAccepts.length,
    problems,
    tag,
    fresh_set: freshName,
    benchmark: {
      id: resultFresh?.benchmark?.id,
      payload_hash: resultFresh?.benchmark?.payload_hash,
      state: releaseBenchmarkStateVNext({ ...assessment, problems }),
    },
    at,
    limitation: 'A passing measured release is bounded by its preregistered fixture scope. It does not establish perfect accuracy or uniformly premium quality; model agreement is not truth.',
  };
}
