import { FACTORY_VERIFIER_VERSION_V7, V7_PROMPT_HASH } from './factoryEvidenceV7.mjs';
import { validationContractV7 } from './contractV7.mjs';
import { payloadHash } from './cuetFitBenchmark.mjs';
import { CUET_FIT_VERSION } from '../../../data/cuet_fit_rubric.mjs';
import { EFFORT_POLICY_ID, MEDIUM_EFFORT_FORMATS, PRODUCTION_TOPOLOGIES } from '../../../data/cuet_fit_evidence.mjs';

export const REQUIRED_SUBJECTS = Object.freeze(['accountancy', 'business_studies', 'economics', 'english']);
export const RELEASE_POLICY_V7 = Object.freeze({ policy: 'cuet-fit-release-v2', fresh_false_accepts_max: 0, regression_false_accepts_max: 0, valid_survival_min: .85, per_subject_valid_survival_min: .7 });

export function expectedReleaseBinding() {
  return {
    topology: 'dual_blind', verifier_version: FACTORY_VERIFIER_VERSION_V7, prompt_hash: V7_PROMPT_HASH,
    cuet_fit_contract: CUET_FIT_VERSION, effort_policy: EFFORT_POLICY_ID, validation_contract_hash: validationContractV7(),
    efforts: { blind: { default: 'high', medium_when: { subject: 'english', formats: [...MEDIUM_EFFORT_FORMATS] } }, explanation: 'high', gemini: 'medium' }
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noError = value => {
  if (!value || typeof value !== 'object') return true;
  if (value.error || value.error_code || value.provider_error || value.state === 'error' || value.status === 'error') return false;
  return Object.values(value).every(noError);
};
const ids = rows => (rows || []).map(r => r?.id);
const exactlyOnce = (actual, wanted) => actual.length === wanted.length && new Set(actual).size === actual.length && wanted.every(id => actual.includes(id));
const bindingProblems = (result, frozen, setName, expectedBinding) => {
  const problems = [];
  if (!same(result?.contract_binding, expectedBinding)) problems.push(`${setName}_contract_binding_mismatch`);
  if (!frozen?.release_eligibility || !result?.release_eligibility) { problems.push(`${setName}_release_preregistration_missing`); return problems; }
  const e = frozen.release_eligibility, r = result.release_eligibility;
  if (setName === 'fresh' && (e.scope !== 'full_cuet_release' || e.classification !== 'fresh' || e.approved_before_evaluation !== true || e.previously_read !== false || e.tuned_on !== false || !e.preregistration_id)) problems.push('fresh_set_not_preregistered_as_unseen_full_release');
  if (setName === 'regression' && (e.scope !== 'regression' || e.classification !== 'regression' || !e.preregistration_id)) problems.push('regression_set_preregistration_invalid');
  if (e.scope === 'official_calibration_only' || e.scope === 'official_only' || e.official_scope === true) problems.push(`${setName}_official_scoped_set_cannot_release`);
  if (!same(r, e)) problems.push(`${setName}_result_preregistration_mismatch`);
  if (result.verifier_version !== expectedBinding.verifier_version) problems.push(`${setName}_verifier_version_mismatch`);
  if (frozen.verifier_version !== expectedBinding.verifier_version) problems.push(`${setName}_frozen_verifier_version_mismatch`);
  if (!frozen.payload_hash || payloadHash(frozen.fixtures || []) !== frozen.payload_hash) problems.push(`${setName}_frozen_payload_hash_invalid`);
  if (result.benchmark?.id !== frozen.id || result.benchmark?.payload_hash !== frozen.payload_hash) problems.push(`${setName}_result_frozen_hash_mismatch`);
  return problems;
};

function inspectSet({ name, result, frozen, topology, binding, problems }) {
  problems.push(...bindingProblems(result, frozen, name, binding));
  const fixtures = frozen?.fixtures || [], expectedIds = ids(fixtures);
  if (!Array.isArray(fixtures) || !expectedIds.length || new Set(expectedIds).size !== expectedIds.length) { problems.push(`${name}_frozen_fixture_ids_invalid`); return { rows: [], fixtures: [] }; }
  const rows = result?.topologies?.[topology];
  if (!Array.isArray(rows) || !exactlyOnce(ids(rows), expectedIds)) problems.push(`${name}_${topology}_rows_not_exact_fixture_coverage`);
  const fixtureById = new Map(fixtures.map(f => [f.id, f]));
  for (const row of rows || []) {
    const f = fixtureById.get(row?.id);
    if (!f) { problems.push(`${name}_unexpected_result_fixture:${row?.id || 'missing_id'}`); continue; }
    if (row.group !== f.group || row.category !== f.category || row.expected_valid !== f.expected_valid) problems.push(`${name}_fixture_label_mismatch:${row.id}`);
    if (!['eligible', 'quarantined'].includes(row.state) || !noError(row)) problems.push(`${name}_invalid_or_error_verdict:${row.id}`);
  }
  const evaluations = result?.evaluations?.[topology] || result?.evaluations;
  if (!evaluations || typeof evaluations !== 'object' || !exactlyOnce(Object.keys(evaluations), expectedIds)) problems.push(`${name}_${topology}_evaluations_not_exact_fixture_coverage`);
  for (const id of expectedIds) {
    const ev = evaluations?.[id];
    if (!ev || !noError(ev) || !['openai', 'gemini'].every(provider => ev[provider] && typeof ev[provider] === 'object' && noError(ev[provider]))) problems.push(`${name}_missing_or_error_provider_evaluation:${id}`);
  }
  return { rows: rows || [], fixtures };
}

export function assessReleaseEvidenceV7({ resultFresh, frozenFresh, resultRegression, frozenRegression, topology = 'dual_blind', binding = expectedReleaseBinding(), policy = RELEASE_POLICY_V7 }) {
  const problems = [];
  if (!PRODUCTION_TOPOLOGIES.includes(topology) || topology !== 'dual_blind') problems.push('topology_not_approved_for_full_release');
  if (frozenFresh?.id === frozenRegression?.id) problems.push('fresh_and_regression_sets_must_be_distinct');
  const fresh = inspectSet({ name: 'fresh', result: resultFresh, frozen: frozenFresh, topology, binding, problems });
  const regression = inspectSet({ name: 'regression', result: resultRegression, frozen: frozenRegression, topology, binding, problems });
  const idsFresh = new Set(ids(fresh.fixtures));
  if (regression.fixtures.some(f => idsFresh.has(f.id))) problems.push('fresh_and_regression_fixture_ids_overlap');
  const rowFresh = new Map(fresh.rows.map(r => [r.id, r])), rowRegression = new Map(regression.rows.map(r => [r.id, r]));
  const fixtureFresh = new Map(fresh.fixtures.map(f => [f.id, f]));
  const freshDefects = fresh.fixtures.filter(f => f.group === 'controlled_defect' && !f.contested).map(f => rowFresh.get(f.id)).filter(Boolean);
  const regDefects = regression.fixtures.filter(f => !f.expected_valid).map(f => rowRegression.get(f.id)).filter(Boolean);
  const valid = [...fresh.fixtures.filter(f => f.group === 'authored_valid').map(f => [f, rowFresh.get(f.id)]), ...regression.fixtures.filter(f => f.expected_valid).map(f => [f, rowRegression.get(f.id)])].filter(([, r]) => r);
  const approved = r => r?.state === 'eligible';
  const freshAccepted = freshDefects.filter(approved), regressionAccepted = regDefects.filter(approved);
  const bySubject = {};
  for (const [f, row] of valid) {
    const subject = f.candidate?.subject;
    if (!subject) { problems.push(`valid_fixture_subject_missing:${f.id}`); continue; }
    (bySubject[subject] ||= { n: 0, ok: 0 }).n++;
    if (approved(row)) bySubject[subject].ok++;
  }
  for (const subject of REQUIRED_SUBJECTS) if (!bySubject[subject]?.n) problems.push(`required_subject_missing:${subject}`);
  const survival = valid.length ? valid.filter(([, r]) => approved(r)).length / valid.length : 0;
  if (freshAccepted.length > policy.fresh_false_accepts_max) problems.push(`fresh_defect_false_accepts_${freshAccepted.length}`);
  if (regressionAccepted.length > policy.regression_false_accepts_max) problems.push(`regression_defect_false_accepts_${regressionAccepted.length}`);
  if (!(survival >= policy.valid_survival_min)) problems.push(`valid_survival_${survival.toFixed(3)}_below_${policy.valid_survival_min}`);
  for (const subject of REQUIRED_SUBJECTS) { const s = bySubject[subject]; if (s && s.ok / s.n < policy.per_subject_valid_survival_min) problems.push(`subject_survival_${subject}_${s.ok}/${s.n}`); }
  return { state: problems.length ? 'paused' : 'released', topology, policy, problems: [...new Set(problems)], metrics: { fresh_false_accepts: freshAccepted.map(r => r.id), regression_false_accepts: regressionAccepted.map(r => r.id), valid_survival: survival, valid_by_subject: bySubject, fresh_defects: freshDefects.length, regression_defects: regDefects.length, valid_items: valid.length } };
}
