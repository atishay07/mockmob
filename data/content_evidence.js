import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

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
export function evidenceSignature(record, secret) { return createHmac('sha256', secret).update(JSON.stringify(record)).digest('hex'); }

export function evaluateEvidence(q, { secret = process.env.CUET_EVIDENCE_SIGNING_KEY, sources = {}, families = {} } = {}) {
  const reasons = [];
  const envelope = q.evidence;
  const record = envelope?.record;
  if (!secret || !record || !envelope?.signature) return { eligible: false, reasons: ['missing_trusted_evidence'] };
  const actual = Buffer.from(String(envelope.signature));
  const expected = Buffer.from(evidenceSignature(record, secret));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) reasons.push('untrusted_evidence');
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
  if (record.route === 'numerical') required.push('independent_solver', 'boundary_cases');
  if (record.route === 'passage') required.push('passage_integrity', 'passage_answerability');
  for (const check of required) {
    if (record.checks?.[check]?.passed !== true || !record.checks[check].evidence_hash || record.checks[check].candidate_id !== record.candidate_id || record.checks[check].content_hash !== record.content_hash) reasons.push(`missing_${check}`);
  }
  if (record.solved_key !== canonicalQuestion(q).key) reasons.push('solver_key_mismatch');
  return { eligible: reasons.length === 0, reasons };
}
