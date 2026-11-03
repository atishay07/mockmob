import { V713_PROMPT_HASH } from './factoryEvidenceV713.mjs';
import { FACTORY_VERIFIER_VERSION_V713, validationContractV713 } from './contractV713.mjs';
import { expectedReleaseBinding, assessReleaseEvidenceV7, RELEASE_POLICY_V7 } from './releaseEvidenceV7.mjs';

export function expectedReleaseBindingV713() {
  return { ...expectedReleaseBinding(), verifier_version: FACTORY_VERIFIER_VERSION_V713,
    prompt_hash: V713_PROMPT_HASH, validation_contract_hash: validationContractV713() };
}

// All frozen expected-invalid rows count, including a disputed old label retained in regression.
// The parent has exact row/provider coverage and unchanged release thresholds; no exclusion can
// erase a frozen failure. Fresh construction must label every invalid as a controlled defect.
export function assessReleaseEvidenceV713(inputs) {
  const verdict = assessReleaseEvidenceV7({ ...inputs, binding: expectedReleaseBindingV713(), policy: RELEASE_POLICY_V7 });
  const problems = [...verdict.problems], topology = inputs.topology || 'dual_blind';
  const fixtures = inputs.frozenFresh?.fixtures || [], rows = inputs.resultFresh?.topologies?.[topology] || [];
  for (const f of fixtures) {
    if (f.expected_valid !== true && f.expected_valid !== false) problems.push(`fresh_expected_valid_required:${f.id}`);
    if (f.expected_valid === false && f.group !== 'controlled_defect') problems.push(`fresh_invalid_must_be_controlled_defect:${f.id}`);
    if (f.expected_valid === true && f.group !== 'authored_valid') problems.push(`fresh_valid_must_be_authored_valid:${f.id}`);
    if (f.contested) problems.push(`fresh_contested_defect_cannot_qualify:${f.id}`);
  }
  const invalid = fixtures.filter(f => f.expected_valid === false), byId = new Map(rows.map(r => [r.id, r]));
  const accepted = invalid.filter(f => byId.get(f.id)?.state === 'eligible').map(f => f.id);
  if (accepted.length > RELEASE_POLICY_V7.fresh_false_accepts_max) problems.push(`fresh_defect_false_accepts_${accepted.length}`);
  if (!invalid.length) problems.push('fresh_controlled_defects_required');
  return { ...verdict, state: problems.length ? 'paused' : 'released', problems: [...new Set(problems)],
    metrics: { ...verdict.metrics, fresh_false_accepts: accepted, fresh_defects: invalid.length } };
}
