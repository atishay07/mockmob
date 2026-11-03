import { premiseOriginsSchemaV78, validateEvidenceCatalogV78, validatePremiseBindingsV78 } from './premiseBindingV78.mjs';

const KEYS = ['A', 'B', 'C', 'D'];
const SEMANTIC = ['support', 'contradiction', 'unresolved'];
const AUDIT = ['entailed', 'not_entailed', 'uncertain'];
const BASIS = ['stem_direct', 'excerpt_direct', 'arithmetic', 'category_only', 'source_silence'];

export function optionResolutionAuditSchemaV78(evidenceIds = [], frozen = []) {
  const ids = { type: 'array', items: { type: 'string', enum: evidenceIds } };
  const clauseAudit = { type: 'object', additionalProperties: false,
    required: ['clause', 'claimed_status', 'audited_status', 'claim_audit', 'basis_audit', 'rationale', 'evidence_ids', 'premises', 'premise_origins'],
    properties: { clause: { type: 'string' }, claimed_status: { type: 'string', enum: SEMANTIC }, audited_status: { type: 'string', enum: SEMANTIC },
      claim_audit: { type: 'string', enum: AUDIT }, basis_audit: { type: 'string', enum: BASIS }, rationale: { type: 'string' },
      evidence_ids: ids, premises: { type: 'array', items: { type: 'string' } }, premise_origins: premiseOriginsSchemaV78(evidenceIds) } };
  const solverIds = Array.isArray(frozen) ? [...new Set(frozen.map(item => item?.solver).filter(value => typeof value === 'string'))] : [];
  const identity = Array.isArray(frozen) && frozen[0] ? frozen[0] : {};
  const row = { type: 'object', additionalProperties: false,
    required: ['candidate_id', 'content_hash', 'solver', 'option', 'exact_option_text', 'claimed_whole_status', 'audited_whole_status',
      'whole_claim_audit', 'basis_audit', 'rationale', 'evidence_ids', 'premises', 'premise_origins', 'clauses'],
    properties: { candidate_id: { type: 'string', enum: [identity.candidate_id] }, content_hash: { type: 'string', enum: [identity.content_hash] },
      solver: { type: 'string', enum: solverIds }, option: { type: 'string', enum: KEYS }, exact_option_text: { type: 'string' },
      claimed_whole_status: { type: 'string', enum: SEMANTIC }, audited_whole_status: { type: 'string', enum: SEMANTIC },
      whole_claim_audit: { type: 'string', enum: AUDIT }, basis_audit: { type: 'string', enum: BASIS }, rationale: { type: 'string' },
      evidence_ids: ids, premises: { type: 'array', items: { type: 'string' } }, premise_origins: premiseOriginsSchemaV78(evidenceIds),
      clauses: { type: 'array', minItems: 1, items: clauseAudit } } };
  const count = Array.isArray(frozen) ? frozen.length * 4 : 0;
  return { type: 'array', minItems: count, maxItems: count, items: row };
}

function validFrozenEntry(entry, view) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.solver !== 'string' || !entry.solver.trim() ||
      entry.candidate_id !== view.candidate_id || entry.content_hash !== view.content_hash || !KEYS.includes(entry.solved_key) ||
      !Array.isArray(entry.matrix) || entry.matrix.length !== 4) return false;
  const seen = new Set();
  for (const row of entry.matrix) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !KEYS.includes(row.option) || seen.has(row.option) ||
        typeof row.exact_option_text !== 'string' || !Array.isArray(row.clauses) || !row.clauses.length ||
        row.clauses.some(clause => !clause || typeof clause !== 'object' || Array.isArray(clause) || !SEMANTIC.includes(clause.status) || typeof clause.clause !== 'string')) return false;
    if (row.clauses.map(clause => clause.clause).join('') !== row.exact_option_text) return false;
    seen.add(row.option);
  }
  return KEYS.every(key => seen.has(key));
}

function selectedSpanCheck(result, evidence) {
  if (!Array.isArray(result?.evidence_ids) || result.evidence_ids.some(id => typeof id !== 'string' || !id.trim()) ||
      new Set(result.evidence_ids).size !== result.evidence_ids.length || !Array.isArray(result.supporting_spans) ||
      result.supporting_spans.length !== result.evidence_ids.length) return false;
  for (let i = 0; i < result.evidence_ids.length; i++) {
    const expected = evidence.get(result.evidence_ids[i]), actual = result.supporting_spans[i];
    if (!expected || !actual || typeof actual !== 'object' || Array.isArray(actual) || actual.source_id !== expected.source_id ||
        actual.locator !== expected.locator || actual.quote !== expected.quote ||
        (expected.start !== undefined && actual.start !== expected.start) || (expected.end !== undefined && actual.end !== expected.end)) return false;
  }
  return true;
}

function bind(row, view, evidenceCatalog, selectedEvidenceIds, option, optionText, audit = false) {
  return validatePremiseBindingsV78({ premises: row.premises, premise_origins: row.premise_origins, basis: row.basis_audit,
    evidence_ids: row.evidence_ids, selectedEvidenceIds, option, optionText, view, evidenceCatalog, audit });
}

export function validateOptionResolutionAuditV78(result, view, { frozen = [], evidenceCatalog = [] } = {}) {
  const fail = reason => ({ ok: false, reason });
  if (!result || typeof result !== 'object' || Array.isArray(result) || typeof view?.candidate_id !== 'string' || !view.candidate_id.trim() ||
      typeof view?.content_hash !== 'string' || !view.content_hash.trim() || result.candidate_id !== view.candidate_id || result.content_hash !== view.content_hash) return fail('resolution_audit_identity_mismatch');
  if (!Array.isArray(frozen) || frozen.length < 2 || frozen.some(entry => !validFrozenEntry(entry, view)) ||
      new Set(frozen.map(entry => entry.solver)).size !== frozen.length) return fail('resolution_audit_frozen_matrices_required');
  const evidenceCheck = validateEvidenceCatalogV78(evidenceCatalog);
  if (!evidenceCheck.ok) return fail(evidenceCheck.reason);
  const evidence = evidenceCheck.byId;
  if (!selectedSpanCheck(result, evidence)) return fail('resolution_audit_support_spans_mismatch');
  const audits = result.option_resolution_audits;
  if (!Array.isArray(audits) || audits.length !== frozen.length * 4 || audits.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return fail('resolution_audit_all_solver_options_required');
  const byPair = new Map();
  for (const row of audits) {
    if (typeof row.solver !== 'string' || !KEYS.includes(row.option)) return fail('resolution_audit_duplicate_or_missing_pair');
    const key = `${row.solver}\0${row.option}`;
    if (byPair.has(key)) return fail('resolution_audit_duplicate_or_missing_pair');
    byPair.set(key, row);
  }
  if (byPair.size !== frozen.length * 4) return fail('resolution_audit_duplicate_or_missing_pair');
  const optionText = new Map((Array.isArray(view.options) ? view.options : []).map(item => [item?.key, item?.text]));
  const selectedEvidenceIds = result.evidence_ids;
  for (const entry of frozen) {
    for (const key of KEYS) {
      const source = entry.matrix.find(row => row.option === key);
      const audit = byPair.get(`${entry.solver}\0${key}`);
      if (!source || !audit || audit.candidate_id !== view.candidate_id || audit.content_hash !== view.content_hash ||
          audit.exact_option_text !== source.exact_option_text || source.exact_option_text !== optionText.get(key)) return fail(`resolution_audit_option_binding_failed:${entry.solver}:${key}`);
      if (!SEMANTIC.includes(audit.claimed_whole_status) || !SEMANTIC.includes(audit.audited_whole_status) ||
          !AUDIT.includes(audit.whole_claim_audit) || !BASIS.includes(audit.basis_audit) || typeof audit.rationale !== 'string' || !audit.rationale.trim()) return fail(`resolution_audit_whole_option_unproved:${entry.solver}:${key}`);
      const expectedWhole = source.clauses.some(clause => clause.status === 'contradiction') ? 'contradiction'
        : source.clauses.every(clause => clause.status === 'support') ? 'support' : 'unresolved';
      if (audit.claimed_whole_status !== expectedWhole || audit.audited_whole_status !== expectedWhole || audit.whole_claim_audit !== 'entailed' ||
          ['category_only', 'source_silence'].includes(audit.basis_audit) ||
          !Array.isArray(audit.evidence_ids) || audit.evidence_ids.some(id => typeof id !== 'string') ||
          !Array.isArray(audit.premises) || !Array.isArray(audit.premise_origins)) return fail(`resolution_audit_whole_option_unproved:${entry.solver}:${key}`);
      const wholeBind = bind(audit, view, evidenceCatalog, selectedEvidenceIds, key, source.exact_option_text, true);
      if (!wholeBind.ok) return fail(`resolution_audit_whole_option_unproved:${entry.solver}:${key}:${wholeBind.reason}`);
      if (key !== entry.solved_key && expectedWhole !== 'contradiction') return fail(`resolution_audit_alternative_not_decisively_contradicted:${entry.solver}:${key}`);
      if (!Array.isArray(audit.clauses) || audit.clauses.length !== source.clauses.length) return fail(`resolution_audit_clause_coverage_failed:${entry.solver}:${key}`);
      let decisiveContradiction = false;
      for (let i = 0; i < source.clauses.length; i++) {
        const claimed = source.clauses[i], checked = audit.clauses[i];
        if (!checked || typeof checked !== 'object' || Array.isArray(checked) || checked.clause !== claimed.clause ||
            !SEMANTIC.includes(checked.claimed_status) || !SEMANTIC.includes(checked.audited_status) || !AUDIT.includes(checked.claim_audit) ||
            !BASIS.includes(checked.basis_audit) || checked.claimed_status !== claimed.status || checked.audited_status !== claimed.status ||
            typeof checked.rationale !== 'string' || !checked.rationale.trim() || !Array.isArray(checked.evidence_ids) ||
            checked.evidence_ids.some(id => typeof id !== 'string') || !Array.isArray(checked.premises) || !Array.isArray(checked.premise_origins)) return fail(`resolution_audit_clause_unproved:${entry.solver}:${key}:${i}`);
        if (claimed.status === 'unresolved') {
          if (!['uncertain', 'entailed'].includes(checked.claim_audit)) return fail(`resolution_audit_unresolved_clause_unproved:${entry.solver}:${key}:${i}`);
          const unresolvedBind = bind(checked, view, evidenceCatalog, selectedEvidenceIds, key, source.exact_option_text, true);
          if (!unresolvedBind.ok) return fail(`resolution_audit_unresolved_clause_unproved:${entry.solver}:${key}:${i}:${unresolvedBind.reason}`);
        } else {
          if (checked.claim_audit !== 'entailed' || ['category_only', 'source_silence'].includes(checked.basis_audit)) return fail(`resolution_audit_clause_unproved:${entry.solver}:${key}:${i}`);
          const clauseBind = bind(checked, view, evidenceCatalog, selectedEvidenceIds, key, source.exact_option_text, true);
          if (!clauseBind.ok) return fail(`resolution_audit_clause_unproved:${entry.solver}:${key}:${i}:${clauseBind.reason}`);
          if (claimed.status === 'contradiction' && ['stem_direct', 'excerpt_direct', 'arithmetic'].includes(checked.basis_audit)) decisiveContradiction = true;
        }
      }
      if ((key === entry.solved_key) !== (audit.audited_whole_status === 'support')) return fail(`resolution_audit_key_uniqueness_failed:${entry.solver}:${key}`);
      if (expectedWhole === 'contradiction' && !decisiveContradiction) return fail(`resolution_audit_decisive_contradiction_missing:${entry.solver}:${key}`);
    }
  }
  return { ok: true, reason: null };
}

export function applyOptionResolutionAuditV78(result, view, context = {}) {
  const audit = validateOptionResolutionAuditV78(result, view, context);
  return { ...result, option_resolution_audit: { required: true, passed: audit.ok, reason: audit.reason },
    passed: result?.passed === true && audit.ok, reasons: [...(Array.isArray(result?.reasons) ? result.reasons : []), ...(audit.ok ? [] : [audit.reason])] };
}
