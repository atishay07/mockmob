import { timingSafeEqual } from 'node:crypto';
import { canonicalJSON } from './canonical_json.mjs';
import { canonicalQuestion, contentHash, evidenceSignature } from './content_evidence.js';
import { presentationLint } from './question_presentation.mjs';
import { FACTORY_POLICY, provenanceReasons, needsNumericChecks } from './question_factory_policy.mjs';
import { cuetFitVerdict, conditionVerdict, optionChallengeVerdict, readingWords, CUET_FIT_VERSION, CRITERION_IDS } from './cuet_fit_rubric.mjs';

// CUET-fit evidence contract. Records carry policy_version 'cuet-llm-v3' because the saved publication RPC
// accepts only that literal; this contract is selected by verifier_version and validated here, so nothing in the
// database or in legacy records changes. A topology is usable only once a measured release exists for it.
export const V7_VERIFIER_PREFIX = 'cuet-fit-validator-v7.';
export const isCuetFitRecord = record => typeof record?.verifier_version === 'string' && record.verifier_version.startsWith(V7_VERIFIER_PREFIX);
const LUNA = { provider: 'openai', model: 'gpt-6-luna', effort: 'high' }, GEMINI = { provider: 'gemini', model: 'gemini-3.8-flash', effort: 'medium' };
const HAIKU = { provider: 'anthropic', model: 'claude-haiku-5-5', effort: 'medium' };
export const V7_TOPOLOGIES = Object.freeze({
  haiku_gemini: { primary: HAIKU, secondary: GEMINI, explanation: LUNA },
  luna_haiku: { primary: LUNA, secondary: HAIKU, explanation: LUNA },
  dual_blind: { primary: LUNA, secondary: GEMINI, explanation: LUNA },
  single_luna: { primary: LUNA, secondary: null, explanation: LUNA },
  single_gemini: { primary: GEMINI, secondary: null, explanation: LUNA },
  single_gemini_full: { primary: GEMINI, secondary: null, explanation: GEMINI }
});
// Owner rule (8 Oct 2026): validators are never removed to save money. Only the full topology (Luna blind solve, Gemini blind solve, Luna explanation audit)
// may publish; single-validator topologies remain measurement-only. Cost is reduced by tuning effort per stage, not by dropping a check.
export const PRODUCTION_TOPOLOGIES = Object.freeze(['dual_blind']);
export const FACTORY_CRITERIA_V7 = Object.freeze([
  'syllabus_entitlement', 'source_support', 'independently_solved_key', 'one_correct_answer', 'option_non_overlap', 'decisive_assumptions',
  'numerical_accuracy', 'boundary_cases', 'explanation_correctness', 'explanation_support', 'passage_answerability', 'completeness',
  'cuet_format', 'novelty', 'presentation', 'source_provenance_integrity'
].map(id => Object.freeze({ id, kind: 'mandatory' })));
export const stagesV7 = (route, numeric, topology) => ['schema', 'dedupe', 'source_support', 'syllabus_mapping', 'presentation_quality', 'blind_solution', 'alternatives', 'explanation_support', 'exam_fit',
  ...(topology.secondary ? ['independent_evaluation'] : []), ...(route === 'numerical' || numeric ? ['numeric_solution', 'llm_boundary_cases'] : []), ...(route === 'passage' ? ['passage_integrity', 'passage_answerability'] : [])];

const validatorChecks = (checks, topology) => [checks.blind_solution, ...(topology.secondary ? [checks.independent_evaluation] : [])];
// The question's own text fixes its reading load, so a verdict can be re-derived from the signed record and the stored question alone.
const ctxOf = (v, question) => { const c = canonicalQuestion(question); return { words: readingWords({ body: c.body, options: c.options, passage: c.passage }), reading_reference: v?.cuet_fit_result?.reading_reference || null }; };
const fitOf = (v, question) => cuetFitVerdict(v?.cuet_fit, ctxOf(v, question));
const conditionOk = v => conditionVerdict(v?.answer_conditions, v?.evidence_ids).ok;
const challengeOk = v => optionChallengeVerdict(v?.option_challenges, v?.solved_key, v?.evidence_ids).ok;
export function criteriaResultsV7(checks, question, topology) {
  const vs = validatorChecks(checks, topology), all = field => vs.every(v => v?.[field] === true), key = question.correct_answer, e = checks.explanation_support;
  const clean = v => v?.defects_valid !== false && Array.isArray(v?.blocking_defects) && v.blocking_defects.length === 0 && challengeOk(v);
  const fields = {
    syllabus_entitlement: all('syllabus_entitlement'), source_support: all('source_support'), independently_solved_key: vs.every(v => v?.solved_key === key),
    one_correct_answer: all('single_defensible_answer') && vs.every(clean), option_non_overlap: all('single_defensible_answer') && vs.every(clean),
    decisive_assumptions: vs.every(v => conditionOk(v) && (v?.principle_applicability === 'skill_from_stem' || v?.decisive_principle_in_excerpts === true)),
    numerical_accuracy: checks.numeric_solution?.passed === true, boundary_cases: checks.llm_boundary_cases?.passed === true,
    explanation_correctness: e?.passed === true, explanation_support: e?.passed === true, passage_answerability: all('passage_answerability'),
    completeness: checks.schema?.passed === true && all('single_defensible_answer') && vs.every(conditionOk), cuet_format: all('question_type_match') && vs.every(v => fitOf(v, question).pass),
    novelty: all('meaningfully_distinct') && checks.dedupe?.passed === true, presentation: all('presentation_ready'), source_provenance_integrity: checks.source_support?.passed === true
  };
  const mandatory = FACTORY_CRITERIA_V7.map(c => ({ ...c, passed: fields[c.id] === true, applicable: !(['numerical_accuracy', 'boundary_cases'].includes(c.id) && !checks.numeric_solution) && !(c.id === 'passage_answerability' && question.route !== 'passage') }));
  const fits = vs.map(v => fitOf(v, question));
  const fit = CRITERION_IDS.map(id => ({ id, kind: 'cuet_fit', level: Math.min(...fits.map(f => f.levels?.[id] ?? 0)),
    basis: vs.length > 1 ? 'Lower of the independent anchored judgments; a rating does not prove correctness' : 'Single anchored judgment; a rating does not prove correctness' }));
  return [...mandatory, ...fit];
}
export const cuetFitSummary = (checks, topology, question) => {
  const fits = validatorChecks(checks, topology).map(v => fitOf(v, question));
  const score = Math.min(...fits.map(f => f.score ?? 0));
  return { contract: CUET_FIT_VERSION, score, pass: fits.every(f => f.pass), validators: fits.length, derived_solve_seconds: Math.max(...fits.map(f => f.derived_solve_seconds ?? 0)) };
};

// Effort is a measured setting, not a constant: any supported level is accepted here and the release (cuetFitReleased) binds the exact levels that were measured.
const EFFORTS = ['low', 'medium', 'high'];
// Reasoning effort per stage (measured 8 Oct 2026, REPORT in cuet-fit-2026-10-07): on the frozen sets, medium matched high at about 55% of the cost except on conditional-answer
// defects, which only high caught. Medium is therefore used only where no hidden assumption can decide the answer (English word-meaning formats); everything else, the
// explanation audit and nothing else, stays high; Gemini stays medium (low caught no defect that Luna missed and was more lenient).
export const EFFORT_POLICY_ID = 'effort-policy-v1';
export const MEDIUM_EFFORT_FORMATS = Object.freeze(['synonym', 'antonym', 'correct_word_usage', 'matching']);
export const blindEffortFor = q => q?.subject === 'english' && MEDIUM_EFFORT_FORMATS.includes(q.question_type) ? 'medium' : 'high';
export const effortsFor = q => ({ blind: blindEffortFor(q), explanation: 'high', gemini: 'medium' });
const sameModel = (check, spec) => check?.provider === spec.provider && check?.model === spec.model && EFFORTS.includes(check?.effort);
export function cuetFitReleased(manifest, registry, record) {
  if (!PRODUCTION_TOPOLOGIES.includes(record?.validation_topology)) return false;
  const release = manifest?.cuet_fit_releases?.[record?.validation_topology];
  return Boolean(release && release.state === 'released' && release.verifier_version === record.verifier_version && release.cuet_fit_contract === CUET_FIT_VERSION &&
    release.source_registry_version === registry?.version && release.critical_false_accepts === 0 && release.benchmark?.state === 'completed' && /^[a-f0-9]{64}$/.test(release.benchmark?.payload_hash || '') &&
    release.prompt_hash === record.checks?.blind_solution?.evaluation_prompt &&
    release.effort_policy === EFFORT_POLICY_ID);
}

export function evaluateEvidenceV7(q, registry = {}) {
  const { secret = process.env.CUET_EVIDENCE_SIGNING_KEY, sources = {}, families = {} } = registry, reasons = [], envelope = q.evidence, record = envelope?.record;
  if (!secret || !record || !envelope?.signature) return { eligible: false, reasons: ['missing_trusted_evidence'] };
  const actual = Buffer.from(String(envelope.signature)), expected = Buffer.from(evidenceSignature(record, secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) reasons.push('untrusted_evidence');
  if (record.candidate_id !== (q.id || q.candidate_id || q.local_id)) reasons.push('candidate_id_mismatch');
  if (record.content_hash !== contentHash(q)) reasons.push('content_changed');
  if (!['eligible', 'published'].includes(record.state)) reasons.push('not_eligible');
  if (record.policy_version !== FACTORY_POLICY || !isCuetFitRecord(record)) reasons.push('unknown_evidence_policy');
  const topology = V7_TOPOLOGIES[record.validation_topology];
  if (!topology) { reasons.push('unknown_validation_topology'); return { eligible: false, reasons }; }
  if (!record.verified_at || !(Date.parse(record.expires_at) > Date.now())) reasons.push('stale_verification');
  if (!['numerical', 'conceptual', 'passage'].includes(record.route)) reasons.push('unknown_route');
  if (!Array.isArray(record.sources) || !record.sources.length) reasons.push('missing_sources');
  for (const ref of record.sources || []) { const s = sources[ref.id]; if (!s || s.state !== 'active' || s.version !== ref.version || !s.reuse_permitted || !ref.locator || !ref.support_hash || s.supports?.[ref.locator] !== ref.support_hash) reasons.push('source_not_verified'); }
  const family = families[record.family_id];
  if (record.family_id !== canonicalQuestion(q).family) reasons.push('family_id_mismatch');
  if (!family || family.state !== 'active' || family.version !== record.family_version) reasons.push('family_not_active');
  reasons.push(...presentationLint(q), ...provenanceReasons(q, registry));
  if (canonicalJSON(record.provenance) !== canonicalJSON(q.provenance)) reasons.push('provenance_changed');
  const numeric = needsNumericChecks(q, registry);
  if (record.numeric_required !== numeric || record.question_type !== q.question_type) reasons.push('validation_requirements_changed');
  const checks = record.checks || {};
  for (const stage of stagesV7(record.route, numeric, topology)) {
    const c = checks[stage];
    if (c?.passed !== true || !c.evidence_hash || c.candidate_id !== record.candidate_id || c.content_hash !== record.content_hash) reasons.push(`missing_${stage}`);
  }
  if (!sameModel(checks.blind_solution, topology.primary)) reasons.push('model_provenance_required');
  if (topology.primary.provider === 'openai' && checks.blind_solution?.effort !== blindEffortFor(q)) reasons.push('effort_policy_mismatch');
  if (checks.explanation_support?.provider === 'openai' && checks.explanation_support?.effort !== 'high') reasons.push('effort_policy_mismatch');
  if (topology.secondary && checks.independent_evaluation?.effort !== 'medium') reasons.push('effort_policy_mismatch');
  if (topology.secondary && !sameModel(checks.independent_evaluation, topology.secondary)) reasons.push('model_provenance_required');
  if (!sameModel(checks.explanation_support, topology.explanation)) reasons.push('explanation_model_provenance_required');
  if (numeric && ['numeric_solution', 'llm_boundary_cases'].some(s => !sameModel(checks[s], topology.primary))) reasons.push('llm_numeric_provenance_required');
  const key = canonicalQuestion(q).key;
  for (const [stage, v] of [['blind_solution', checks.blind_solution], ...(topology.secondary ? [['independent_evaluation', checks.independent_evaluation]] : [])]) {
    if (v?.solved_key !== key) reasons.push(`${stage}_key_mismatch`);
    if (v?.cuet_fit_gate !== true || v?.cuet_fit_contract !== CUET_FIT_VERSION) reasons.push('cuet_fit_gate_required');
    if (!fitOf(v, q).pass) reasons.push('cuet_fit_not_met');
    if (!challengeOk(v)) reasons.push('alternative_reading_check_failed');
    if (!conditionOk(v)) reasons.push('decisive_assumption_not_stated');
    if (!Array.isArray(v?.blocking_defects) || v.blocking_defects.length) reasons.push('blocking_defect_present');
  }
  if (record.solved_key !== key) reasons.push('solver_key_mismatch');
  const expectedCriteria = criteriaResultsV7(checks, q, topology);
  if (canonicalJSON(record.criteria) !== canonicalJSON(expectedCriteria) || expectedCriteria.some(c => c.kind === 'mandatory' && c.applicable !== false && c.passed !== true)) reasons.push('mandatory_criteria_required');
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}
