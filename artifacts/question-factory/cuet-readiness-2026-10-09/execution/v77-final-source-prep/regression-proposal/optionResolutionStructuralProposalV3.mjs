import { createHash } from 'node:crypto';

const KEYS = ['A', 'B', 'C', 'D'];
const STATUSES = new Set(['support', 'contradiction', 'unresolved']);
const BASES = new Set(['stem', 'excerpt', 'arithmetic']);
const CONTRADICTIONS = new Set(['explicit_stem_negation', 'source_contradiction', 'arithmetic_result']);
const HASH = /^[a-f0-9]{64}$/i;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const asArray = value => Array.isArray(value) ? value : [];
const issue = (code, detail = '') => detail ? `${code}:${detail}` : code;
const hashJSON = value => createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

// Canonicalizes whitespace only. Every other code point, including punctuation, numerals,
// apostrophes and negation, remains unchanged and in the same order.
const normalizeWhitespace = value => String(value).replace(/\s+/gu, ' ').trim();
function isWordCharacter(char) { return !!char && /[\p{L}\p{N}_'’]/u.test(char); }
function containsWhitespaceEquivalent(container, premise) {
  if (!hasText(container) || !hasText(premise)) return false;
  const source = normalizeWhitespace(container);
  const target = normalizeWhitespace(premise);
  let from = 0;
  while (from <= source.length - target.length) {
    const at = source.indexOf(target, from);
    if (at < 0) return false;
    const before = at === 0 ? '' : source[at - 1];
    const after = at + target.length === source.length ? '' : source[at + target.length];
    const leftOK = !isWordCharacter(target[0]) || !isWordCharacter(before);
    const rightOK = !isWordCharacter(target.at(-1)) || !isWordCharacter(after);
    if (leftOK && rightOK) return true;
    from = at + 1;
  }
  return false;
}

function bindPremise(premise, row, view, evidenceById, allowedKinds, explicitOrigin, originWasProvided = false) {
  if (!hasText(premise)) return null;
  const cited = asArray(row.clause?.evidence_ids).map(id => evidenceById.get(id)).filter(Boolean);
  const candidates = [];
  if (allowedKinds.has('excerpt')) {
    const sourceIds = cited.filter(e => containsWhitespaceEquivalent(e.quote, premise)).map(e => e.id);
    if (sourceIds.length) candidates.push({ premise, kind: 'excerpt', evidence_ids: sourceIds });
  }
  if (allowedKinds.has('stem') && containsWhitespaceEquivalent(view.body, premise)) candidates.push({ premise, kind: 'stem', evidence_ids: [] });
  if (allowedKinds.has('printed_option_input') && containsWhitespaceEquivalent(row.exact_option_text, premise))
    candidates.push({ premise, kind: 'printed_option_input', option: row.option, evidence_ids: [] });
  if (!candidates.length) return null;
  if (originWasProvided) {
    if (!isRecord(explicitOrigin) || explicitOrigin.premise !== premise || !hasText(explicitOrigin.kind) || !allowedKinds.has(explicitOrigin.kind))
      return { premise, kind: 'invalid_origin', declared_origin: explicitOrigin ?? null };
    if (explicitOrigin.kind === 'excerpt') {
      const ids = explicitOrigin.evidence_ids;
      const sourceCandidate = candidates.find(c => c.kind === 'excerpt');
      if (Object.keys(explicitOrigin).some(k => !['premise', 'kind', 'evidence_ids'].includes(k)) || !Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || !sourceCandidate ||
          ids.some(id => !sourceCandidate.evidence_ids.includes(id)))
        return { premise, kind: 'invalid_origin', declared_origin: explicitOrigin };
      return { premise, kind: 'excerpt', evidence_ids: ids };
    }
    if (explicitOrigin.kind === 'stem') {
      if (Object.keys(explicitOrigin).some(k => !['premise', 'kind'].includes(k)) || !candidates.some(c => c.kind === 'stem'))
        return { premise, kind: 'invalid_origin', declared_origin: explicitOrigin };
      return { premise, kind: 'stem', evidence_ids: [] };
    }
    if (explicitOrigin.kind === 'printed_option_input') {
      if (Object.keys(explicitOrigin).some(k => !['premise', 'kind', 'option'].includes(k)) || explicitOrigin.option !== row.option ||
          !candidates.some(c => c.kind === 'printed_option_input'))
        return { premise, kind: 'invalid_origin', declared_origin: explicitOrigin };
      return { premise, kind: 'printed_option_input', option: row.option, evidence_ids: [] };
    }
    return { premise, kind: 'invalid_origin', declared_origin: explicitOrigin };
  }
  if (new Set(candidates.map(c => c.kind)).size > 1) return { premise, kind: 'ambiguous', candidates };
  return candidates[0];
}

function deriveWholeStatus(clauses) {
  if (clauses.some(c => c.status === 'contradiction')) return 'contradiction';
  if (clauses.some(c => c.status === 'unresolved')) return 'unresolved';
  return clauses.length && clauses.every(c => c.status === 'support') ? 'support' : 'unresolved';
}

function sameJSON(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function validateSemanticAudit(audit, context, issues) {
  const { view, result, matrix, evidenceCatalog, computedBindings } = context;
  if (!isRecord(audit)) { issues.push(issue('independent_semantic_audit_required')); return { unresolved: [] }; }
  if (audit.independent_semantic_audit !== true || !hasText(audit.auditor_id)) issues.push(issue('independent_semantic_audit_identity_required'));
  if (audit.case_id !== view.candidate_id || audit.content_hash !== view.content_hash) issues.push(issue('semantic_audit_case_binding_mismatch'));
  if (audit.option_resolution_matrix_sha256 !== hashJSON(matrix)) issues.push(issue('semantic_audit_matrix_binding_mismatch'));
  if (audit.evidence_catalog_sha256 !== hashJSON(evidenceCatalog)) issues.push(issue('semantic_audit_evidence_binding_mismatch'));
  if (audit.whole_option_reviewed !== true || audit.printed_option_claims_verified !== true) issues.push(issue('whole_option_and_printed_input_audit_required'));

  const reviews = audit.clause_reviews;
  const expectedPairs = [];
  for (const row of matrix) for (const clause of asArray(row?.clauses)) expectedPairs.push({ row, clause });
  if (expectedPairs.some(pair => !isRecord(pair.clause))) {
    issues.push(issue('semantic_matrix_clause_malformed'));
    return { unresolved: [] };
  }
  const keyOf = item => `${item?.option}\u0000${item?.clause}`;
  if (!Array.isArray(reviews) || reviews.length !== expectedPairs.length || new Set(reviews.map(keyOf)).size !== reviews.length) {
    issues.push(issue('semantic_audit_requires_every_matrix_clause_once'));
    return { unresolved: [] };
  }
  const reviewMap = new Map(reviews.map(review => [keyOf(review), review]));
  for (const { row, clause } of expectedPairs) {
    const review = reviewMap.get(`${row.option}\u0000${clause.clause}`);
    if (!review) { issues.push(issue('semantic_clause_missing', row.option)); continue; }
    if (review.exact_option_text !== row.exact_option_text || review.status !== clause.status || review.basis !== clause.basis ||
        review.contradiction_basis !== clause.contradiction_basis || !sameJSON(review.evidence_ids, clause.evidence_ids) ||
        !sameJSON(review.premises, clause.premises) || !sameJSON(review.premise_origins ?? null, clause.premise_origins ?? null) ||
        !sameJSON(review.premise_bindings, computedBindings.get(clause)))
      issues.push(issue('semantic_clause_does_not_match_claimed_matrix', `${row.option}:${clause.clause}`));
    if (review.whole_claim_checked !== true || review.printed_option_claims_verified !== true || !hasText(review.rationale))
      issues.push(issue('semantic_clause_review_incomplete', row.option));
    if (!STATUSES.has(review.status)) issues.push(issue('semantic_clause_status_invalid', row.option));
    if (review.status === 'contradiction' && (review.direct_conflict_verified !== true || review.source_silence_used === true ||
        !CONTRADICTIONS.has(review.contradiction_basis))) issues.push(issue('semantic_contradiction_not_directly_grounded', row.option));
    if (review.status === 'unresolved' && !hasText(review.unresolved_reason)) issues.push(issue('semantic_unresolved_reason_required', row.option));
    if (review.source_silence_used === true && review.status !== 'unresolved') issues.push(issue('source_silence_must_remain_unresolved', row.option));
  }

  const whole = audit.whole_options;
  if (!Array.isArray(whole) || whole.length !== 4 || new Set(whole.map(d => d?.option)).size !== 4 || !KEYS.every(k => whole.some(d => d?.option === k))) {
    issues.push(issue('semantic_audit_requires_all_four_whole_options'));
    return { unresolved: [] };
  }
  const unresolved = [];
  for (const row of matrix) {
    const decision = whole.find(d => d?.option === row.option);
    const expectedStatus = deriveWholeStatus(asArray(row.clauses));
    if (!decision || decision.status !== expectedStatus || !hasText(decision.rationale) || decision.whole_option_checked !== true)
      issues.push(issue('semantic_whole_option_status_mismatch', row.option));
    if (expectedStatus === 'unresolved') unresolved.push(row.option);
  }
  const supported = whole.filter(d => d.status === 'support').map(d => d.option);
  if (!KEYS.includes(audit.selected_key) || supported.length !== 1 || supported[0] !== audit.selected_key || result.solved_key !== audit.selected_key)
    issues.push(issue('semantic_whole_option_uniqueness_failed'));
  for (const d of whole) {
    if (!isRecord(d)) { issues.push(issue('semantic_whole_option_entry_malformed')); continue; }
    if (!STATUSES.has(d?.status)) issues.push(issue('semantic_whole_option_status_invalid', String(d?.option)));
    if (d.option !== audit.selected_key && d.status !== 'contradiction')
      issues.push(issue(d.status === 'unresolved' ? 'semantic_unresolved_alternative' : 'semantic_alternative_not_contradicted', d.option));
  }
  return { unresolved };
}

/**
 * Local-only regression wrapper; deliberately not imported by runtime, verifier, registration or publication code.
 * It can report proposal behavior only and never grants publication or dispatch eligibility.
 */
export function reviewOptionResolutionStructuralProposalV3(input = {}) {
  const { proposalOptIn = false, route = '', result, view, evidenceCatalog = [], semanticAudit = null } = isRecord(input) ? input : {};
  const issues = [];
  if (proposalOptIn !== true) issues.push(issue('proposal_opt_in_required'));
  if (route !== 'local_regression_proposal') issues.push(issue('publication_route_forbidden'));
  if (!isRecord(result) || !isRecord(view)) {
    return { proposal_only: true, publication_eligible: false, dispatch_eligible: false,
      structural: { passed: false, issues: [...issues, issue('result_and_view_required')], premise_bindings: [] },
      semantic: { passed: false, issues: [issue('independent_semantic_audit_required')], unresolved_options: [] }, passed: false };
  }

  const options = asArray(view.options);
  if (options.length !== 4 || new Set(options.filter(isRecord).map(o => o.key)).size !== 4 || !KEYS.every(k => options.some(o => o?.key === k && hasText(o.text))))
    issues.push(issue('exactly_four_printed_options_required'));
  if (!hasText(view.candidate_id) || !HASH.test(view.content_hash || '') || result.candidate_id !== view.candidate_id || result.content_hash !== view.content_hash)
    issues.push(issue('candidate_identity_binding_mismatch'));
  if (!Array.isArray(result.evidence_ids) || !result.evidence_ids.length || new Set(result.evidence_ids).size !== result.evidence_ids.length || result.evidence_selection_valid === false)
    issues.push(issue('selected_evidence_ids_invalid'));
  if (!Array.isArray(evidenceCatalog)) issues.push(issue('evidence_catalog_must_be_array'));
  const catalogRows = asArray(evidenceCatalog).filter(isRecord);
  const evidenceById = new Map(catalogRows.map(e => [e.id, e]));
  if (catalogRows.length !== asArray(evidenceCatalog).length || evidenceById.size !== catalogRows.length || catalogRows.some(e => !hasText(e.id) || !hasText(e.source_id) || !hasText(e.locator) || !hasText(e.quote) || !HASH.test(e.identity_sha256 || '')))
    issues.push(issue('evidence_identity_catalog_invalid'));
  const selected = new Set(asArray(result.evidence_ids));
  for (const id of selected) if (!evidenceById.has(id)) issues.push(issue('selected_evidence_identity_missing', String(id)));
  if (selected.size && (!Array.isArray(result.supporting_spans) || result.supporting_spans.length !== selected.size)) issues.push(issue('support_spans_incomplete'));
  if (Array.isArray(result.supporting_spans) && Array.isArray(result.evidence_ids)) {
    for (let i = 0; i < result.evidence_ids.length; i++) {
      const expected = evidenceById.get(result.evidence_ids[i]);
      const actual = result.supporting_spans[i];
      if (!isRecord(expected) || !isRecord(actual) || actual.source_id !== expected.source_id || actual.locator !== expected.locator || actual.quote !== expected.quote ||
          (expected.start !== undefined && actual.start !== expected.start) || (expected.end !== undefined && actual.end !== expected.end))
        issues.push(issue('supporting_spans_mismatch', String(result.evidence_ids[i])));
    }
  }

  const matrix = result.option_resolution_matrix;
  if (!Array.isArray(matrix) || matrix.length !== 4 || matrix.some(r => !isRecord(r)) || new Set(matrix.map(r => r.option)).size !== 4 || !KEYS.every(k => matrix.some(r => r.option === k)))
    issues.push(issue('matrix_requires_all_four_options'));
  const optionTexts = new Map(options.filter(isRecord).map(o => [o.key, o.text]));
  const premiseBindings = [];
  const computedBindings = new Map();
  const safeMatrix = asArray(matrix).filter(isRecord);
  for (const row of safeMatrix) {
    if (!optionTexts.has(row.option)) { issues.push(issue('matrix_option_key_invalid', String(row.option))); continue; }
    if (row.exact_option_text !== optionTexts.get(row.option)) issues.push(issue('exact_printed_option_mismatch', row.option));
    if (!Array.isArray(row.clauses) || !row.clauses.length || row.clauses.some(c => !isRecord(c))) {
      issues.push(issue('option_clauses_required_or_malformed', row.option));
      continue;
    }
    const joined = row.clauses.map(c => typeof c.clause === 'string' ? c.clause : '').join('');
    if (joined !== row.exact_option_text) issues.push(issue('whole_option_clause_coverage_mismatch', row.option));
    for (const clause of row.clauses) {
      if (!STATUSES.has(clause.status) || !BASES.has(clause.basis) || !hasText(clause.clause) || !hasText(clause.decisive_context) || !hasText(clause.rationale))
        issues.push(issue('matrix_clause_incomplete', row.option));
      if (!hasText(row.exact_option_text) || !row.exact_option_text.includes(clause.clause || '')) issues.push(issue('clause_not_exact_option_substring', row.option));
      if (!Array.isArray(clause.evidence_ids) || new Set(clause.evidence_ids).size !== clause.evidence_ids.length || clause.evidence_ids.some(id => !selected.has(id) || !evidenceById.has(id)))
        issues.push(issue('clause_evidence_unbound', row.option));
      if (!Array.isArray(clause.premises) || !clause.premises.length || clause.premises.some(p => !hasText(p))) {
        issues.push(issue('exact_premises_required', row.option));
        continue;
      }
      if (clause.premise_origins !== undefined && (!Array.isArray(clause.premise_origins) || clause.premise_origins.length !== clause.premises.length))
        issues.push(issue('premise_origins_must_align_one_to_one', row.option));
      const allowed = clause.basis === 'excerpt' ? new Set(['excerpt', 'stem']) : clause.basis === 'stem' ? new Set(['stem']) : new Set(['excerpt', 'stem', 'printed_option_input']);
      const bindingRow = { ...row, clause };
      const hasOrigins = clause.premise_origins !== undefined;
      const bound = clause.premises.map((p, i) => bindPremise(p, bindingRow, view, evidenceById, allowed,
        Array.isArray(clause.premise_origins) ? clause.premise_origins[i] : undefined, hasOrigins));
      if (bound.some(b => !b)) issues.push(issue('premise_unbound', row.option));
      if (bound.some(b => b?.kind === 'invalid_origin')) issues.push(issue('premise_origin_invalid', row.option));
      if (bound.some(b => b?.kind === 'ambiguous')) issues.push(issue('premise_provenance_ambiguous', row.option));
      const normalizedBindings = bound.filter(Boolean);
      computedBindings.set(clause, normalizedBindings);
      premiseBindings.push({ option: row.option, clause: clause.clause, bindings: normalizedBindings });
      if (clause.basis === 'excerpt' && (bound.length !== clause.premises.length || bound.some(b => !['excerpt', 'stem'].includes(b?.kind)) || !bound.some(b => b?.kind === 'excerpt')))
        issues.push(issue('excerpt_requires_bound_source_and_optional_stem_premises', row.option));
      if (clause.basis === 'stem' && (bound.length !== clause.premises.length || bound.some(b => b?.kind !== 'stem') || asArray(clause.evidence_ids).length))
        issues.push(issue('stem_requires_all_premises_from_body', row.option));
      if (clause.basis === 'arithmetic' && (!bound.some(b => b?.kind === 'excerpt') || !bound.some(b => b?.kind === 'stem' || b?.kind === 'printed_option_input')))
        issues.push(issue('arithmetic_requires_exact_rule_and_bound_input', row.option));
      const cb = clause.contradiction_basis;
      if ((clause.status === 'contradiction') !== CONTRADICTIONS.has(cb) || (clause.status !== 'contradiction' && cb !== 'none') ||
          (clause.status === 'contradiction' && clause.basis === 'excerpt' && cb !== 'source_contradiction') ||
          (clause.status === 'contradiction' && clause.basis === 'stem' && cb !== 'explicit_stem_negation') ||
          (clause.status === 'contradiction' && clause.basis === 'arithmetic' && cb !== 'arithmetic_result'))
        issues.push(issue('contradiction_basis_mismatch', row.option));
    }
  }
  const selectedRow = safeMatrix.find(r => r.option === result.solved_key);
  if (!selectedRow || !Array.isArray(selectedRow.clauses) || selectedRow.clauses.some(c => !isRecord(c) || c.status !== 'support'))
    issues.push(issue('selected_option_not_fully_supported'));

  const structuralIssues = [...issues];
  const semanticIssues = [];
  const semanticResult = validateSemanticAudit(semanticAudit, { view, result, matrix: safeMatrix, evidenceCatalog, computedBindings }, semanticIssues);
  return { proposal_only: true, route: 'local_regression_proposal', publication_eligible: false, dispatch_eligible: false,
    structural: { passed: structuralIssues.length === 0, issues: structuralIssues, premise_bindings: premiseBindings },
    semantic: { passed: semanticIssues.length === 0, issues: semanticIssues, unresolved_options: semanticResult.unresolved },
    passed: structuralIssues.length === 0 && semanticIssues.length === 0 };
}

export const proposalV3HashJSON = hashJSON;
export const proposalV3NormalizeWhitespace = normalizeWhitespace;
