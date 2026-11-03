import { RELEASE_POLICY_V7, REQUIRED_SUBJECTS, assessReleaseEvidenceV7 } from './releaseEvidenceV7.mjs';
import { expectedReleaseBindingV77, V77_VALIDATION_CONTRACT_HASH } from './freshCuetReadinessV77Guards.mjs';

export const RELEASE_POLICY_V77 = RELEASE_POLICY_V7;
export { REQUIRED_SUBJECTS };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ids = rows => (rows || []).map(row => row?.id);
const clean = value => !value || typeof value !== 'object' ? true : !value.error && !value.error_code && value.state !== 'error' && value.status !== 'error' && Object.values(value).every(clean);

export function expectedReleaseBinding() { return expectedReleaseBindingV77(); }

function setComplete(frozen, result) {
  const expected = (frozen?.fixtures || []).map(f => f.id), rows = result?.topologies?.dual_blind || [];
  const evaluations = result?.evaluations;
  return Boolean(expected.length && rows.length === expected.length && new Set(ids(rows)).size === expected.length && expected.every(id => ids(rows).includes(id)) &&
    rows.every(row => ['eligible', 'quarantined'].includes(row.state) && clean(row)) &&
    evaluations && same(Object.keys(evaluations).sort(), [...expected].sort()) && expected.every(id =>
      clean(evaluations[id]) && ['openai','gemini'].every(provider => evaluations[id]?.[provider]?.status === 'judged' && clean(evaluations[id][provider]))));
}

export function assessReleaseEvidenceV77(inputs) {
  const binding = inputs?.binding || expectedReleaseBindingV77();
  if (!same(binding, expectedReleaseBindingV77()) || binding.validation_contract_hash !== V77_VALIDATION_CONTRACT_HASH)
    return { state: 'paused', topology: 'dual_blind', policy: RELEASE_POLICY_V77, problems: ['v77_release_binding_mismatch'], metrics: {} };

  const fresh = inputs?.frozenFresh?.fixtures || [], regression = inputs?.frozenRegression?.fixtures || [];
  const freshComplete = setComplete(inputs.frozenFresh, inputs.resultFresh), regressionComplete = setComplete(inputs.frozenRegression, inputs.resultRegression);
  if (!freshComplete || !regressionComplete || inputs.executionFinished !== true || inputs.receiptComplete !== true ||
      !inputs.accounting || inputs.accounting.held_micro !== 0) {
    return { state: 'pending', topology: 'dual_blind', policy: RELEASE_POLICY_V77,
      problems: ['qualification_evidence_or_receipts_incomplete'], metrics: { fresh_complete: freshComplete, regression_complete: regressionComplete,
        execution_finished: inputs.executionFinished === true, receipt_complete: inputs.receiptComplete === true,
        held_micro: inputs.accounting?.held_micro ?? null }, academic_assessment: null };
  }

  const inherited = assessReleaseEvidenceV7({ ...inputs, binding: expectedReleaseBindingV77(), policy: RELEASE_POLICY_V77 });
  const problems = [...inherited.problems], freshRows = new Map((inputs.resultFresh.topologies.dual_blind || []).map(row => [row.id, row]));
  for (const [setName, fixtures] of [['fresh', fresh], ['regression', regression]]) for (const fixture of fixtures) {
    if (fixture.expected_valid !== true && fixture.expected_valid !== false) problems.push(`${setName}_expected_valid_required:${fixture.id}`);
    if (setName === 'fresh' && fixture.expected_valid === false && fixture.group !== 'controlled_defect') problems.push(`fresh_invalid_must_be_controlled_defect:${fixture.id}`);
    if (setName === 'fresh' && fixture.contested) problems.push(`fresh_contested_defect_cannot_qualify:${fixture.id}`);
  }
  const allFreshInvalid = fresh.filter(f => f.expected_valid === false);
  const accepted = allFreshInvalid.filter(f => freshRows.get(f.id)?.state === 'eligible').map(f => f.id);
  if (accepted.length > RELEASE_POLICY_V77.fresh_false_accepts_max) problems.push(`fresh_defect_false_accepts_${accepted.length}`);
  if (!allFreshInvalid.length) problems.push('fresh_controlled_defects_required');
  return { ...inherited, state: problems.length ? 'paused' : 'released', problems: [...new Set(problems)],
    metrics: { ...inherited.metrics, fresh_false_accepts: accepted, fresh_defects: allFreshInvalid.length,
      receipt_complete: true, held_micro: 0, execution_finished: true } };
}
