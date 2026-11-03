import { createHash } from 'node:crypto';

const KEYS = ['A', 'B', 'C', 'D'];
const STATUSES = new Set(['support', 'contradiction', 'unresolved']);
const BASES = new Set(['stem', 'excerpt', 'arithmetic']);

function hasText(value) { return typeof value === 'string' && value.trim().length > 0; }
function includesExact(container, premise) { return typeof container === 'string' && container.includes(premise); }
// Line-wrap normalization only: preserves every non-whitespace character, word order, punctuation,
// numbers, and negation. The exact original quote and locator remain bound in the evidence catalog.
function normalizeWhitespace(value) { return String(value).replace(/\s+/gu, ' ').trim(); }
function includesWhitespaceEquivalent(container, premise) {
  return hasText(container) && hasText(premise) && normalizeWhitespace(container).includes(normalizeWhitespace(premise));
}
function hashJSON(value) { return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
function issue(code, detail = '') { return detail ? `${code}:${detail}` : code; }

function bindPremise(premise, row, view, citedEvidence) {
  // Exact source binding takes precedence. Printed options are only hypothetical inputs for arithmetic;
  // the independent semantic audit below must separately verify how those inputs are used.
  const sourceIds = citedEvidence.filter(e => includesWhitespaceEquivalent(e.quote, premise)).map(e => e.id);
  if (sourceIds.length) return { text: premise, kind: 'excerpt', binding: 'exact_or_whitespace_only', evidence_ids: sourceIds };
  if (includesExact(view.body || '', premise)) return { text: premise, kind: 'stem', evidence_ids: [] };
  if (includesExact(row.exact_option_text, premise)) return { text: premise, kind: 'printed_option_input', option: row.option, evidence_ids: [] };
  return null;
}

function validateAudit(semanticAudit, result, view, catalog, selectedEvidence, issues) {
  if (!semanticAudit || typeof semanticAudit !== 'object') {
    issues.push(issue('independent_semantic_audit_required'));
    return { passed: false, unresolved: [] };
  }
  if (semanticAudit.independent_semantic_audit !== true || !hasText(semanticAudit.auditor_id)) issues.push(issue('independent_semantic_audit_identity_required'));
  if (semanticAudit.case_id !== view.candidate_id || semanticAudit.content_hash !== view.content_hash) issues.push(issue('semantic_audit_case_binding_mismatch'));
  if (semanticAudit.option_resolution_matrix_sha256 !== result.matrix_sha256) issues.push(issue('semantic_audit_matrix_binding_mismatch'));
  if (semanticAudit.evidence_catalog_sha256 !== result.evidence_catalog_sha256) issues.push(issue('semantic_audit_evidence_binding_mismatch'));
  if (semanticAudit.whole_option_reviewed !== true || semanticAudit.printed_option_claims_verified !== true) issues.push(issue('whole_option_and_printed_input_audit_required'));
  if (semanticAudit.selected_key !== result.solved_key) issues.push(issue('semantic_audit_selected_key_mismatch'));
  if (semanticAudit.unique_answer !== true) issues.push(issue('semantic_audit_not_unique'));

  const decisions = semanticAudit.option_decisions;
  if (!Array.isArray(decisions) || decisions.length !== 4 || new Set(decisions.map(d => d?.option)).size !== 4 || !KEYS.every(k => decisions.some(d => d?.option === k))) {
    issues.push(issue('semantic_audit_requires_all_four_whole_options'));
    return { passed: false, unresolved: [] };
  }
  const unresolved = [];
  for (const decision of decisions) {
    const key = decision.option;
    if (decision.whole_option_checked !== true || decision.printed_option_claims_verified !== true || !hasText(decision.rationale))
      issues.push(issue('semantic_option_review_incomplete', key));
    if (!STATUSES.has(decision.status)) issues.push(issue('semantic_option_status_invalid', key));
    if (!Array.isArray(decision.evidence_ids) || decision.evidence_ids.some(id => !selectedEvidence.has(id) || !catalog.has(id)))
      issues.push(issue('semantic_option_evidence_unbound', key));
    if (!Array.isArray(decision.stem_premises) || decision.stem_premises.some(p => !hasText(p) || !includesExact(view.body || '', p)))
      issues.push(issue('semantic_option_stem_premise_unbound', key));
    if (decision.status === 'support' && !decision.evidence_ids.length && !decision.stem_premises.length)
      issues.push(issue('semantic_option_support_without_bound_basis', key));
    if (decision.status === 'contradiction' && (decision.direct_conflict_verified !== true || decision.source_silence_used === true ||
        (!decision.evidence_ids.length && !decision.stem_premises.length)))
      issues.push(issue('semantic_contradiction_not_directly_grounded', key));
    if (decision.status === 'unresolved') {
      unresolved.push(key);
      if (!hasText(decision.unresolved_reason)) issues.push(issue('semantic_unresolved_reason_required', key));
    }
    if (decision.source_silence_used === true && decision.status !== 'unresolved')
      issues.push(issue('source_silence_must_remain_unresolved', key));
  }
  const supporting = decisions.filter(d => d.status === 'support').map(d => d.option);
  if (supporting.length !== 1 || supporting[0] !== semanticAudit.selected_key) issues.push(issue('semantic_whole_option_uniqueness_failed'));
  for (const d of decisions) if (d.option !== semanticAudit.selected_key && d.status !== 'contradiction')
    issues.push(issue(d.status === 'unresolved' ? 'semantic_unresolved_alternative' : 'semantic_alternative_not_contradicted', d.option));
  return { passed: issues.length === 0, unresolved };
}

/**
 * Explicit, local-only structural proposal. This is deliberately not imported by any V77 runner,
 * verifier, contract, registration, or publication route. It never returns publication eligibility.
 */
export function reviewOptionResolutionStructuralProposal({ proposalOptIn = false, route = '', result, view, evidenceCatalog = [], semanticAudit = null } = {}) {
  const issues = [];
  if (proposalOptIn !== true) issues.push(issue('proposal_opt_in_required'));
  if (route !== 'local_regression_proposal') issues.push(issue('publication_route_forbidden'));
  if (!result || !view) return { proposal_only: true, publication_eligible: false, structural: { passed: false, issues: [...issues, issue('result_and_view_required')], premise_bindings: [] }, semantic: { passed: false, issues: [issue('independent_semantic_audit_required')], unresolved_options: [] }, passed: false };

  if (!Array.isArray(view.options) || view.options.length !== 4 || new Set(view.options.map(o => o?.key)).size !== 4 || !KEYS.every(k => view.options.some(o => o?.key === k)))
    issues.push(issue('exactly_four_printed_options_required'));
  if (!hasText(view.candidate_id) || !hasText(view.content_hash) || result.candidate_id !== view.candidate_id || result.content_hash !== view.content_hash)
    issues.push(issue('candidate_identity_binding_mismatch'));
  if (!Array.isArray(result.evidence_ids) || !result.evidence_ids.length || new Set(result.evidence_ids).size !== result.evidence_ids.length || result.evidence_selection_valid === false)
    issues.push(issue('selected_evidence_ids_invalid'));

  const catalog = new Map((Array.isArray(evidenceCatalog) ? evidenceCatalog : []).map(e => [e?.id, e]));
  const selectedEvidence = new Set(Array.isArray(result.evidence_ids) ? result.evidence_ids : []);
  if (selectedEvidence.size && (!Array.isArray(result.supporting_spans) || result.supporting_spans.length !== selectedEvidence.size)) issues.push(issue('support_spans_incomplete'));
  if (Array.isArray(result.supporting_spans) && Array.isArray(result.evidence_ids)) {
    for (let i = 0; i < result.evidence_ids.length; i++) {
      const expected = catalog.get(result.evidence_ids[i]), actual = result.supporting_spans[i];
      if (!expected || !actual || actual.source_id !== expected.source_id || actual.locator !== expected.locator || actual.quote !== expected.quote ||
          (expected.start !== undefined && actual.start !== expected.start) || (expected.end !== undefined && actual.end !== expected.end))
        issues.push(issue('supporting_spans_mismatch', result.evidence_ids[i]));
    }
  }

  const matrix = result.option_resolution_matrix;
  if (!Array.isArray(matrix) || matrix.length !== 4 || new Set(matrix.map(r => r?.option)).size !== 4 || !KEYS.every(k => matrix.some(r => r?.option === k)))
    issues.push(issue('matrix_requires_all_four_options'));
  const optionsByKey = new Map((Array.isArray(view.options) ? view.options : []).map(o => [o.key, o.text]));
  const premiseBindings = [];
  if (Array.isArray(matrix)) for (const row of matrix) {
    if (!optionsByKey.has(row?.option)) { issues.push(issue('matrix_option_key_invalid', String(row?.option))); continue; }
    if (row.exact_option_text !== optionsByKey.get(row.option)) issues.push(issue('exact_printed_option_mismatch', row.option));
    if (!Array.isArray(row.clauses) || !row.clauses.length) { issues.push(issue('option_clauses_required', row.option)); continue; }
    if (row.clauses.map(c => c?.clause || '').join('') !== row.exact_option_text) issues.push(issue('whole_option_clause_coverage_mismatch', row.option));
    const cited = (Array.isArray(row.clauses) ? row.clauses : []).flatMap(c => Array.isArray(c?.evidence_ids) ? c.evidence_ids : []);
    for (const clause of row.clauses) {
      if (!STATUSES.has(clause?.status) || !BASES.has(clause?.basis) || !hasText(clause?.clause) || !hasText(clause?.decisive_context) || !hasText(clause?.rationale))
        issues.push(issue('matrix_clause_incomplete', row.option));
      if (!row.exact_option_text?.includes(clause?.clause || '')) issues.push(issue('clause_not_exact_option_substring', row.option));
      if (!Array.isArray(clause?.evidence_ids) || new Set(clause.evidence_ids).size !== clause.evidence_ids.length ||
          clause.evidence_ids.some(eid => !selectedEvidence.has(eid) || !catalog.has(eid))) issues.push(issue('clause_evidence_unbound', row.option));
      if (!Array.isArray(clause?.premises) || !clause.premises.length) { issues.push(issue('exact_premises_required', row.option)); continue; }
      const bound = [];
      for (const premise of clause.premises) {
        if (!hasText(premise)) { issues.push(issue('premise_text_required', row.option)); continue; }
        const binding = bindPremise(premise, row, view, (clause.evidence_ids || []).map(eid => catalog.get(eid)).filter(Boolean));
        if (!binding) issues.push(issue('premise_unbound', `${row.option}:${premise}`));
        else bound.push(binding);
      }
      premiseBindings.push({ option: row.option, clause: clause.clause, bindings: bound });
      if (clause.basis === 'excerpt' && !bound.some(b => b.kind === 'excerpt')) issues.push(issue('excerpt_basis_without_exact_citation_premise', row.option));
      if (clause.basis === 'stem' && (!bound.some(b => b.kind === 'stem') || clause.evidence_ids.length)) issues.push(issue('stem_basis_binding_invalid', row.option));
      if (clause.basis === 'arithmetic' && (!bound.some(b => b.kind === 'printed_option_input' || b.kind === 'stem') || !bound.some(b => b.kind === 'excerpt')))
        issues.push(issue('arithmetic_requires_input_and_exact_rule', row.option));
      const contradictionBasis = clause.contradiction_basis;
      if (!['none', 'explicit_stem_negation', 'source_contradiction', 'arithmetic_result'].includes(contradictionBasis) ||
          ((clause.status === 'contradiction') !== (contradictionBasis !== 'none')) ||
          (clause.status === 'contradiction' && clause.basis === 'excerpt' && contradictionBasis !== 'source_contradiction') ||
          (clause.status === 'contradiction' && clause.basis === 'stem' && contradictionBasis !== 'explicit_stem_negation') ||
          (clause.status === 'contradiction' && clause.basis === 'arithmetic' && contradictionBasis !== 'arithmetic_result'))
        issues.push(issue('contradiction_basis_mismatch', row.option));
      if (clause.status === 'contradiction' && clause.basis === 'excerpt' && !bound.some(b => b.kind === 'excerpt'))
        issues.push(issue('source_contradiction_without_exact_citation', row.option));
      if (clause.status === 'contradiction' && clause.basis === 'stem' && !bound.some(b => b.kind === 'stem'))
        issues.push(issue('stem_contradiction_without_exact_negation', row.option));
    }
  }
  const selectedRow = Array.isArray(matrix) ? matrix.find(r => r?.option === result.solved_key) : null;
  if (!selectedRow || selectedRow.clauses.some(c => c.status !== 'support')) issues.push(issue('selected_option_not_fully_supported'));

  const structuralIssues = [...issues];
  const structural = { passed: structuralIssues.length === 0, issues: structuralIssues, premise_bindings: premiseBindings };
  const semanticIssues = [];
  const auditInput = { ...result, matrix_sha256: hashJSON(matrix), evidence_catalog_sha256: hashJSON(evidenceCatalog) };
  const auditResult = validateAudit(semanticAudit, auditInput, view, catalog, selectedEvidence, semanticIssues);
  return { proposal_only: true, route: 'local_regression_proposal', publication_eligible: false, dispatch_eligible: false,
    structural, semantic: { passed: semanticIssues.length === 0, issues: semanticIssues, unresolved_options: auditResult.unresolved },
    passed: structural.passed && semanticIssues.length === 0 };
}

export const proposalHashJSON = hashJSON;
export const proposalNormalizeWhitespace = normalizeWhitespace;
