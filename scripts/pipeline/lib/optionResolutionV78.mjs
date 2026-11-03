import { premiseOriginsSchemaV78, validateEvidenceCatalogV78, validatePremiseBindingsV78 } from './premiseBindingV78.mjs';

const KEYS = ['A', 'B', 'C', 'D'];
const STATUSES = ['support', 'contradiction', 'unresolved'];
const BASIS = ['stem', 'excerpt', 'arithmetic'];
const CONTRADICTION = ['none', 'explicit_stem_negation', 'source_contradiction', 'arithmetic_result'];

export function optionResolutionSchemaV78(evidenceIds = []) {
  const evidence = { type: 'array', items: { type: 'string', enum: evidenceIds } };
  const clause = { type: 'object', additionalProperties: false,
    required: ['clause', 'status', 'decisive_context', 'rationale', 'basis', 'contradiction_basis', 'evidence_ids', 'premises', 'premise_origins'],
    properties: {
      clause: { type: 'string' }, status: { type: 'string', enum: STATUSES }, decisive_context: { type: 'string' },
      rationale: { type: 'string' }, basis: { type: 'string', enum: BASIS },
      contradiction_basis: { type: 'string', enum: CONTRADICTION }, evidence_ids: evidence,
      premises: { type: 'array', items: { type: 'string' } }, premise_origins: premiseOriginsSchemaV78(evidenceIds),
    } };
  return { type: 'array', minItems: 4, maxItems: 4, items: { type: 'object', additionalProperties: false,
    required: ['option', 'exact_option_text', 'clauses'], properties: { option: { type: 'string', enum: KEYS },
      exact_option_text: { type: 'string' }, clauses: { type: 'array', minItems: 1, items: clause } } } };
}

function validOptions(options) {
  return Array.isArray(options) && options.length === 4 && options.every(item => item && typeof item === 'object' && !Array.isArray(item) &&
    KEYS.includes(item.key) && typeof item.text === 'string') && new Set(options.map(item => item.key)).size === 4 && KEYS.every(key => options.some(item => item.key === key));
}

export function validateOptionResolutionV78(result, view, { evidenceCatalog = [] } = {}) {
  const matrix = result?.option_resolution_matrix;
  const fail = reason => ({ ok: false, reason, matrix: Array.isArray(matrix) ? matrix : null });
  if (!validOptions(view?.options)) return fail('resolution_input_options_invalid');
  if (typeof view?.candidate_id !== 'string' || !view.candidate_id.trim() || typeof view?.content_hash !== 'string' || !view.content_hash.trim() ||
      result?.candidate_id !== view.candidate_id || result?.content_hash !== view.content_hash) return fail('resolution_input_identity_mismatch');
  if (!Array.isArray(result?.evidence_ids) || !result.evidence_ids.length || result.evidence_selection_valid === false ||
      result.evidence_ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(result.evidence_ids).size !== result.evidence_ids.length ||
      !Array.isArray(result?.supporting_spans) || result.supporting_spans.length !== result.evidence_ids.length) return fail('resolution_evidence_selection_invalid');
  const catalogCheck = validateEvidenceCatalogV78(evidenceCatalog);
  if (!catalogCheck.ok) return fail(catalogCheck.reason);
  const catalog = catalogCheck.byId;
  for (let i = 0; i < result.evidence_ids.length; i++) {
    const expected = catalog.get(result.evidence_ids[i]), actual = result.supporting_spans[i];
    if (!expected || !actual || typeof actual !== 'object' || Array.isArray(actual) || actual.source_id !== expected.source_id ||
        actual.locator !== expected.locator || actual.quote !== expected.quote ||
        (expected.start !== undefined && actual.start !== expected.start) || (expected.end !== undefined && actual.end !== expected.end)) return fail('resolution_support_spans_mismatch');
  }
  if (!Array.isArray(matrix) || matrix.length !== 4 || matrix.some(row => !row || typeof row !== 'object' || Array.isArray(row)) ||
      new Set(matrix.map(row => row.option)).size !== 4 || !KEYS.every(key => matrix.some(row => row.option === key))) return fail('resolution_all_four_options_required');
  const selectedEvidence = new Set(result.evidence_ids);
  const optionText = new Map(view.options.map(item => [item.key, item.text]));
  if (view.correct_key && result.solved_key !== view.correct_key) return fail('resolution_key_mismatch');
  for (const row of matrix) {
    if (typeof row.exact_option_text !== 'string' || row.exact_option_text !== optionText.get(row.option)) return fail(`resolution_option_text_mismatch:${row.option}`);
    if (!Array.isArray(row.clauses) || !row.clauses.length || row.clauses.some(c => !c || typeof c !== 'object' || Array.isArray(c))) return fail(`resolution_clauses_required:${row.option}`);
    if (row.clauses.some(c => typeof c.clause !== 'string') || row.clauses.map(c => c.clause).join('') !== row.exact_option_text) return fail(`resolution_clause_coverage_mismatch:${row.option}`);
    for (const clause of row.clauses) {
      if (!STATUSES.includes(clause.status) || !BASIS.includes(clause.basis) || typeof clause.decisive_context !== 'string' || !clause.decisive_context.trim() ||
          typeof clause.rationale !== 'string' || !clause.rationale.trim() || !Array.isArray(clause.evidence_ids) ||
          clause.evidence_ids.some(id => typeof id !== 'string') || !Array.isArray(clause.premises) ||
          !CONTRADICTION.includes(clause.contradiction_basis)) return fail(`resolution_clause_incomplete:${row.option}`);
      if ((clause.status === 'contradiction') !== (clause.contradiction_basis !== 'none')) return fail(`resolution_contradiction_basis_required:${row.option}`);
      if (clause.status === 'contradiction' && ((clause.basis === 'stem' && clause.contradiction_basis !== 'explicit_stem_negation') ||
          (clause.basis === 'excerpt' && clause.contradiction_basis !== 'source_contradiction') ||
          (clause.basis === 'arithmetic' && clause.contradiction_basis !== 'arithmetic_result'))) return fail(`resolution_contradiction_basis_mismatch:${row.option}`);
      const binding = validatePremiseBindingsV78({ premises: clause.premises, premise_origins: clause.premise_origins,
        basis: clause.basis, evidence_ids: clause.evidence_ids, selectedEvidenceIds: result.evidence_ids,
        option: row.option, optionText: row.exact_option_text, view, evidenceCatalog });
      if (!binding.ok) return fail(`${binding.reason}:${row.option}`);
    }
  }
  const selected = matrix.find(row => row.option === result.solved_key);
  if (!selected || selected.clauses.some(clause => clause.status !== 'support')) return fail('resolution_selected_key_not_fully_supported');
  for (const row of matrix.filter(item => item.option !== result.solved_key)) {
    const contradiction = row.clauses.some(clause => clause.status === 'contradiction' && clause.decisive_context.trim() && clause.rationale.trim());
    if (!contradiction) return fail(row.clauses.every(clause => clause.status === 'support') ? `resolution_multiple_full_options:${row.option}` : `resolution_unresolved_alternative:${row.option}`);
  }
  return { ok: true, reason: null, matrix };
}

export function applyOptionResolutionV78(result, view, context = {}) {
  const validation = validateOptionResolutionV78(result, view, context);
  return { ...result, option_resolution: { required: true, passed: validation.ok, reason: validation.reason },
    passed: result?.passed === true && validation.ok, reasons: [...(Array.isArray(result?.reasons) ? result.reasons : []), ...(validation.ok ? [] : [validation.reason])] };
}
