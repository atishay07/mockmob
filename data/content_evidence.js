import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalJSON } from './canonical_json.mjs';
import { presentationLint } from './question_presentation.mjs';
import { FACTORY_POLICY, provenanceReasons,needsNumericChecks } from './question_factory_policy.mjs';

export function canonicalQuestion(q) {
  const options = q.options || [];
  return {
    subject: q.subject, chapter: q.chapter, concept: q.concept_id || q.concept || '',
    body: q.body || q.question_text || q.question || '',
    options: Array.isArray(options) ? options.map((o, i) => ({ key: o?.key || 'ABCD'[i], text: typeof o === 'string' ? o : o?.text }))
      : Object.entries(options).sort().map(([key, text]) => ({ key, text })),
    key: q.correct_answer || q.correct_option || (Number.isInteger(q.correctIndex ?? q.correct_index) ? 'ABCD'[q.correctIndex ?? q.correct_index] : ''),
    explanation: q.explanation || q.answer_explanation || '',
    passage: q.passage_text || q.passageText || '',
    family: q.family_id || q.template_id || '',
  };
}
export function contentHash(q) { return createHash('sha256').update(JSON.stringify(canonicalQuestion(q))).digest('hex'); }
export function evidenceSignature(record, secret) { return createHmac('sha256', secret).update(canonicalJSON(record)).digest('hex'); }

export function evaluateEvidence(q, registry = {}) {
  const { secret = process.env.CUET_EVIDENCE_SIGNING_KEY, sources = {}, families = {} } = registry;
  const reasons = [];
  const envelope = q.evidence;
  const record = envelope?.record;
  if (!secret || !record || !envelope?.signature) return { eligible: false, reasons: ['missing_trusted_evidence'] };
  const actual = Buffer.from(String(envelope.signature));
  const expected = Buffer.from(evidenceSignature(record, secret));
  const legacy = Buffer.from(createHmac('sha256', secret).update(JSON.stringify(record)).digest('hex'));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) && !timingSafeEqual(actual, legacy)) reasons.push('untrusted_evidence');
  if (record.candidate_id !== (q.id || q.candidate_id || q.local_id)) reasons.push('candidate_id_mismatch');
  if (record.content_hash !== contentHash(q)) reasons.push('content_changed');
  if (record.state !== 'eligible' && record.state !== 'published') reasons.push('not_eligible');
  if (record.mock === true || record.verifier_version === 'mock') reasons.push('mock_verification');
  if (!record.verifier_version || !record.verified_at || !(Date.parse(record.expires_at) > Date.now())) reasons.push('stale_verification');
  if (!['numerical', 'conceptual', 'passage'].includes(record.route)) reasons.push('unknown_route');
  if (!Array.isArray(record.sources) || !record.sources.length) reasons.push('missing_sources');
  for (const ref of record.sources || []) {
    const source = sources[ref.id];
    if (!source || source.state !== 'active' || source.version !== ref.version || !source.reuse_permitted || !ref.locator || !ref.support_hash || source?.supports?.[ref.locator] !== ref.support_hash) reasons.push('source_not_verified');
  }
  const family = families[record.family_id];
  if(record.family_id!==canonicalQuestion(q).family)reasons.push('family_id_mismatch');
  if (!family || family.state !== 'active' || family.version !== record.family_version) reasons.push('family_not_active');
  const required = ['schema', 'dedupe', 'source_support', 'blind_solution', 'alternatives', 'explanation_support', 'exam_fit'];
  const numeric=record.policy_version===FACTORY_POLICY && needsNumericChecks(q,registry);
  if (record.policy_version && record.policy_version !== FACTORY_POLICY) reasons.push('unknown_evidence_policy');
  if (record.policy_version === FACTORY_POLICY) {
    required.push('independent_evaluation','syllabus_mapping','presentation_quality');
    reasons.push(...presentationLint(q));
    reasons.push(...provenanceReasons(q, registry));
    if (canonicalJSON(record.provenance) !== canonicalJSON(q.provenance)) reasons.push('provenance_changed');
    const luna = record.checks?.blind_solution, gemini = record.checks?.independent_evaluation;
    if (luna?.provider !== 'openai' || luna?.model !== 'gpt-6-luna' || luna?.effort !== 'high' || gemini?.provider !== 'gemini' || gemini?.model !== 'gemini-3.8-flash' || gemini?.effort!=='medium') reasons.push('model_provenance_required');
    const explanation=record.checks?.explanation_support;
    if(explanation?.provider!=='openai' || explanation?.model!=='gpt-6-luna' || !['medium','high'].includes(explanation?.effort))reasons.push('explanation_model_provenance_required');
    if(['syllabus_mapping','presentation_quality','independent_evaluation'].some(stage=>record.checks?.[stage]?.polish_gate===false) && registry.allow_academic_only!==true)reasons.push('polish_gate_required');
    // v4+ receipts must positively show the production polish gate; absence is not a pass.
    if(/cuET-v(?:[4-9]|\d{2,})\./.test(record.verifier_version||'') && registry.allow_academic_only!==true && ['syllabus_mapping','presentation_quality','independent_evaluation'].some(stage=>record.checks?.[stage]?.polish_gate!==true))reasons.push('polish_gate_required');
    if(numeric && ['numeric_solution','llm_boundary_cases'].some(stage=>record.checks?.[stage]?.provider!=='openai' || record.checks?.[stage]?.model!=='gpt-6-luna' || record.checks?.[stage]?.effort!=='high'))reasons.push('llm_numeric_provenance_required');
    if(record.numeric_required!==numeric || record.question_type!==q.question_type)reasons.push('validation_requirements_changed');
    if(/^luna-gemini-cuET-v6\./.test(record.verifier_version) && (!Array.isArray(record.criteria)||record.criteria.length!==19||
      record.criteria.some(c=>c.kind==='mandatory'&&c.applicable!==false&&c.passed!==true)))reasons.push('mandatory_criteria_required');
    if(/^luna-gemini-cuET-v6\./.test(record.verifier_version)&&record.criteria?.some(c=>c.kind==='craft'&&(!Number.isInteger(c.score)||c.score<1||c.score>10)))reasons.push('craft_measurement_required');
    if (gemini?.solved_key !== canonicalQuestion(q).key) reasons.push('independent_key_mismatch');
  }
  if (record.route === 'numerical' || numeric) required.push(...(record.policy_version === FACTORY_POLICY ? ['numeric_solution', 'llm_boundary_cases'] : ['independent_solver', 'boundary_cases']));
  if (record.route === 'passage') required.push('passage_integrity', 'passage_answerability');
  for (const check of required) {
    if (record.checks?.[check]?.passed !== true || !record.checks[check].evidence_hash || record.checks[check].candidate_id !== record.candidate_id || record.checks[check].content_hash !== record.content_hash) reasons.push(`missing_${check}`);
  }
  if (record.solved_key !== canonicalQuestion(q).key) reasons.push('solver_key_mismatch');
  return { eligible: reasons.length === 0, reasons };
}
