const keys = ['A', 'B', 'C', 'D'];
const allowed = new Set(['support', 'contradiction', 'unresolved']);

export function optionResolutionSchemaV77(evidenceIds) {
  const evidence = { type: 'array', items: { type: 'string', enum: evidenceIds } };
  const clause = { type: 'object', additionalProperties: false,
    required: ['clause', 'status', 'decisive_context', 'rationale', 'basis', 'contradiction_basis', 'evidence_ids', 'premises'],
    properties: { clause: { type: 'string' }, status: { type: 'string', enum: [...allowed] }, decisive_context: { type: 'string' },
      rationale: { type: 'string' }, basis: { type: 'string', enum: ['stem', 'excerpt', 'arithmetic'] },
      contradiction_basis: { type: 'string', enum: ['none', 'explicit_stem_negation', 'source_contradiction', 'arithmetic_result'] }, evidence_ids: evidence,
      premises: { type: 'array', items: { type: 'string' } } } };
  return { type: 'array', minItems: 4, maxItems: 4, items: { type: 'object', additionalProperties: false,
    required: ['option', 'exact_option_text', 'clauses'], properties: { option: { type: 'string', enum: keys },
      exact_option_text: { type: 'string' }, clauses: { type: 'array', minItems: 1, items: clause } } } };
}

export function validateOptionResolutionV77(result, view, { evidenceCatalog = [] } = {}) {
  const matrix = result?.option_resolution_matrix, options = view?.options || [], catalog = evidenceCatalog;
  const fail = reason => ({ ok: false, reason, matrix: Array.isArray(matrix) ? matrix : null });
  if (!Array.isArray(options) || options.length !== 4 || new Set(options.map(o => o.key)).size !== 4 || !keys.every(k => options.some(o => o.key === k))) return fail('resolution_input_options_invalid');
  if (typeof view?.candidate_id !== 'string' || !view.candidate_id.trim() || typeof view?.content_hash !== 'string' || !view.content_hash.trim() ||
      result?.candidate_id !== view.candidate_id || result?.content_hash !== view.content_hash) return fail('resolution_input_identity_mismatch');
  if (!Array.isArray(result?.evidence_ids) || !result.evidence_ids.length || result.evidence_selection_valid === false) return fail('resolution_evidence_selection_invalid');
  if (new Set(result.evidence_ids).size !== result.evidence_ids.length || !Array.isArray(result.supporting_spans) || result.supporting_spans.length !== result.evidence_ids.length) return fail('resolution_support_spans_mismatch');
  const evidenceById = new Map((Array.isArray(catalog) ? catalog : []).map(e => [e.id, e]));
  for (let i = 0; i < result.evidence_ids.length; i++) {
    const expected = evidenceById.get(result.evidence_ids[i]), actual = result.supporting_spans[i];
    if (!expected || !actual || actual.source_id !== expected.source_id || actual.locator !== expected.locator || actual.quote !== expected.quote ||
        (expected.start !== undefined && actual.start !== expected.start) || (expected.end !== undefined && actual.end !== expected.end)) return fail('resolution_support_spans_mismatch');
  }
  if (!Array.isArray(matrix) || matrix.length !== 4 || new Set(matrix.map(x => x?.option)).size !== 4 || !keys.every(k => matrix.some(x => x.option === k))) return fail('resolution_all_four_options_required');
  const byKey = new Map(options.map(o => [o.key, o.text])), allEvidence = new Set(catalog.map(e => e.id)), selectedEvidence = new Set(result.evidence_ids);
  if (result.solved_key !== view.correct_key && view.correct_key) return fail('resolution_key_mismatch');
  for (const row of matrix) {
    if (typeof row.exact_option_text !== 'string' || row.exact_option_text !== byKey.get(row.option)) return fail(`resolution_option_text_mismatch:${row.option}`);
    if (!Array.isArray(row.clauses) || !row.clauses.length) return fail(`resolution_clauses_required:${row.option}`);
    if (row.clauses.map(c => c?.clause).join('') !== row.exact_option_text) return fail(`resolution_clause_coverage_mismatch:${row.option}`);
    for (const clause of row.clauses) {
      if (!clause || !allowed.has(clause.status) || !['stem', 'excerpt', 'arithmetic'].includes(clause.basis) ||
          !clause.clause?.trim() || !clause.decisive_context?.trim() || !clause.rationale?.trim() || !Array.isArray(clause.evidence_ids) || !Array.isArray(clause.premises) ||
          !['none', 'explicit_stem_negation', 'source_contradiction', 'arithmetic_result'].includes(clause.contradiction_basis)) return fail(`resolution_clause_incomplete:${row.option}`);
      if ((clause.status === 'contradiction') !== (clause.contradiction_basis !== 'none')) return fail(`resolution_contradiction_basis_required:${row.option}`);
      if (clause.status === 'contradiction' && ((clause.basis === 'stem' && clause.contradiction_basis !== 'explicit_stem_negation') ||
          (clause.basis === 'excerpt' && clause.contradiction_basis !== 'source_contradiction') ||
          (clause.basis === 'arithmetic' && clause.contradiction_basis !== 'arithmetic_result'))) return fail(`resolution_contradiction_basis_mismatch:${row.option}`);
      if (clause.basis === 'stem') {
        if (clause.evidence_ids.length || !clause.premises.length || clause.premises.some(p => !p.trim() || !(view.body || '').includes(p)) ||
            !clause.premises.some(p => clause.decisive_context.includes(p))) return fail(`resolution_stem_premise_invalid:${row.option}`);
      } else if (clause.basis === 'excerpt') {
        if (!clause.evidence_ids.length || clause.evidence_ids.some(id => !selectedEvidence.has(id) || !allEvidence.has(id))) return fail(`resolution_citation_invalid:${row.option}`);
        const citedText = clause.evidence_ids.map(id => catalog.find(e => e.id === id)?.quote || '').join('\n');
        if (!clause.premises.length || clause.premises.some(p => !p.trim() || !citedText.includes(p)) || !clause.premises.some(p => clause.decisive_context.includes(p))) return fail(`resolution_excerpt_premise_invalid:${row.option}`);
      }
      if (clause.basis === 'arithmetic') {
        if (!clause.premises.length || clause.evidence_ids.some(id => !selectedEvidence.has(id) || !allEvidence.has(id))) return fail(`resolution_arithmetic_premises_required:${row.option}`);
        const citedText = clause.evidence_ids.map(id => catalog.find(e => e.id === id)?.quote || '').join('\n');
        if (clause.premises.some(p => !p.trim() || (!(view.body || '').includes(p) && !citedText.includes(p))) ||
            !clause.premises.some(p => clause.decisive_context.includes(p))) return fail(`resolution_arithmetic_premises_required:${row.option}`);
      }
    }
  }
  const selected = matrix.find(row => row.option === result.solved_key);
  if (!selected || selected.clauses.some(c => c.status !== 'support')) return fail('resolution_selected_key_not_fully_supported');
  const alternatives = matrix.filter(row => row.option !== result.solved_key);
  for (const row of alternatives) {
    const hasContradiction = row.clauses.some(c => c.status === 'contradiction' && c.decisive_context.trim() && c.rationale.trim());
    const allSupported = row.clauses.every(c => c.status === 'support');
    if (!hasContradiction) return fail(allSupported ? `resolution_multiple_full_options:${row.option}` : `resolution_unresolved_alternative:${row.option}`);
  }
  return { ok: true, reason: null, matrix };
}

export function applyOptionResolutionV77(result, view, context = {}) {
  const validation = validateOptionResolutionV77(result, view, context);
  return { ...result, option_resolution: { required: true, passed: validation.ok, reason: validation.reason },
    passed: result?.passed === true && validation.ok, reasons: [...(result?.reasons || []), ...(validation.ok ? [] : [validation.reason])] };
}
