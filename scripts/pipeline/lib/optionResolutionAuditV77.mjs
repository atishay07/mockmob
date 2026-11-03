const semanticStates = ['support', 'contradiction', 'unresolved'];
const auditStates = ['entailed', 'not_entailed', 'uncertain'];
const premiseBases = ['stem_direct', 'excerpt_direct', 'arithmetic', 'category_only', 'source_silence'];

const exactArray = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);

export function optionResolutionAuditSchemaV77(evidenceIds, frozen) {
  const ids = { type: 'array', items: { type: 'string', enum: evidenceIds } };
  const clauseAudit = { type: 'object', additionalProperties: false,
    required: ['clause', 'claimed_status', 'audited_status', 'claim_audit', 'basis_audit', 'rationale', 'evidence_ids', 'premises'],
    properties: { clause: { type: 'string' }, claimed_status: { type: 'string', enum: semanticStates }, audited_status: { type: 'string', enum: semanticStates },
      claim_audit: { type: 'string', enum: auditStates }, basis_audit: { type: 'string', enum: premiseBases }, rationale: { type: 'string' },
      evidence_ids: ids, premises: { type: 'array', items: { type: 'string' } } } };
  const row = { type: 'object', additionalProperties: false,
    required: ['candidate_id', 'content_hash', 'solver', 'option', 'exact_option_text', 'claimed_whole_status', 'audited_whole_status',
      'whole_claim_audit', 'basis_audit', 'rationale', 'evidence_ids', 'premises', 'clauses'],
    properties: { candidate_id: { type: 'string', enum: [frozen[0]?.candidate_id] }, content_hash: { type: 'string', enum: [frozen[0]?.content_hash] }, solver: { type: 'string', enum: [...new Set(frozen.map(x => x.solver))] },
      option: { type: 'string', enum: ['A', 'B', 'C', 'D'] }, exact_option_text: { type: 'string' },
      claimed_whole_status: { type: 'string', enum: semanticStates }, audited_whole_status: { type: 'string', enum: semanticStates },
      whole_claim_audit: { type: 'string', enum: auditStates }, basis_audit: { type: 'string', enum: premiseBases }, rationale: { type: 'string' },
      evidence_ids: ids, premises: { type: 'array', items: { type: 'string' } }, clauses: { type: 'array', minItems: 1, items: clauseAudit } } };
  const count = frozen.reduce((n, item) => n + 4, 0);
  return { type: 'array', minItems: count, maxItems: count, items: row };
}

export function validateOptionResolutionAuditV77(result, view, { frozen = [], evidenceCatalog = [] } = {}) {
  const audits = result?.option_resolution_audits;
  const fail = reason => ({ ok: false, reason });
  if (!result || typeof view?.candidate_id !== 'string' || !view.candidate_id.trim() || typeof view?.content_hash !== 'string' || !view.content_hash.trim() ||
      result.candidate_id !== view.candidate_id || result.content_hash !== view.content_hash) return fail('resolution_audit_identity_mismatch');
  if (!Array.isArray(frozen) || frozen.length < 2 || new Set(frozen.map(x => x?.solver)).size !== frozen.length || frozen.some(x => x.candidate_id !== view.candidate_id || x.content_hash !== view.content_hash || !x.matrix || !x.solved_key)) return fail('resolution_audit_frozen_matrices_required');
  if (!Array.isArray(audits) || audits.length !== frozen.length * 4) return fail('resolution_audit_all_solver_options_required');
  if (!Array.isArray(result.evidence_ids) || new Set(result.evidence_ids).size !== result.evidence_ids.length || !Array.isArray(result.supporting_spans) || result.supporting_spans.length !== result.evidence_ids.length) return fail('resolution_audit_support_spans_mismatch');
  const evidence = new Map(evidenceCatalog.map(item => [item.id, item]));
  const selected = new Map(result.evidence_ids.map(id => [id, true]));
  for (let i = 0; i < result.evidence_ids.length; i++) {
    const expected = evidence.get(result.evidence_ids[i]), actual = result.supporting_spans[i];
    if (!expected || !actual || actual.source_id !== expected.source_id || actual.locator !== expected.locator || actual.quote !== expected.quote ||
        (expected.start !== undefined && actual.start !== expected.start) || (expected.end !== undefined && actual.end !== expected.end)) return fail('resolution_audit_support_spans_mismatch');
  }
  const byPair = new Map(audits.map(row => [`${row?.solver}\0${row?.option}`, row]));
  if (byPair.size !== frozen.length * 4) return fail('resolution_audit_duplicate_or_missing_pair');
  for (const entry of frozen) {
    if (entry.candidate_id !== view.candidate_id || entry.content_hash !== view.content_hash) return fail('resolution_audit_frozen_identity_mismatch');
    for (const option of ['A', 'B', 'C', 'D']) {
      const source = entry.matrix.find(row => row.option === option), audit = byPair.get(`${entry.solver}\0${option}`);
      if (!source || !audit || audit.candidate_id !== view.candidate_id || audit.content_hash !== view.content_hash || audit.exact_option_text !== source.exact_option_text) return fail(`resolution_audit_option_binding_failed:${entry.solver}:${option}`);
      const expectedWhole = source.clauses.some(c => c.status === 'contradiction') ? 'contradiction'
        : source.clauses.every(c => c.status === 'support') ? 'support' : 'unresolved';
      if (audit.claimed_whole_status !== expectedWhole || audit.audited_whole_status !== expectedWhole || audit.whole_claim_audit !== 'entailed' ||
          ['category_only', 'source_silence'].includes(audit.basis_audit) || !audit.rationale?.trim() ||
          !validPremises(audit, view, selected, evidence)) return fail(`resolution_audit_whole_option_unproved:${entry.solver}:${option}`);
      if (option !== entry.solved_key && expectedWhole !== 'contradiction') return fail(`resolution_audit_alternative_not_decisively_contradicted:${entry.solver}:${option}`);
      if (!Array.isArray(audit.clauses) || audit.clauses.length !== source.clauses.length) return fail(`resolution_audit_clause_coverage_failed:${entry.solver}:${option}`);
      let decisiveContradiction = false;
      for (let i = 0; i < source.clauses.length; i++) {
        const claimed = source.clauses[i], checked = audit.clauses[i];
        if (!checked || checked.clause !== claimed.clause || checked.claimed_status !== claimed.status || checked.audited_status !== claimed.status || !checked.rationale?.trim())
          return fail(`resolution_audit_clause_unproved:${entry.solver}:${option}:${i}`);
        if (claimed.status === 'unresolved') {
          if (!['uncertain', 'entailed'].includes(checked.claim_audit) || !validUnresolvedPremises(checked, view, selected, evidence))
            return fail(`resolution_audit_unresolved_clause_unproved:${entry.solver}:${option}:${i}`);
        } else {
          if (checked.claim_audit !== 'entailed' || ['category_only', 'source_silence'].includes(checked.basis_audit) || !validPremises(checked, view, selected, evidence))
            return fail(`resolution_audit_clause_unproved:${entry.solver}:${option}:${i}`);
          if (claimed.status === 'contradiction' && ['stem_direct', 'excerpt_direct', 'arithmetic'].includes(checked.basis_audit)) decisiveContradiction = true;
        }
      }
      const shouldSupport = option === entry.solved_key;
      if (shouldSupport !== (audit.audited_whole_status === 'support')) return fail(`resolution_audit_key_uniqueness_failed:${entry.solver}:${option}`);
      if (expectedWhole === 'contradiction' && !decisiveContradiction) return fail(`resolution_audit_decisive_contradiction_missing:${entry.solver}:${option}`);
    }
  }
  return { ok: true, reason: null };
}

function validPremises(row, view, selected, evidence) {
  if (!Array.isArray(row.evidence_ids) || !Array.isArray(row.premises) || !row.rationale?.trim()) return false;
  const basis = row.basis_audit;
  if (!premiseBases.includes(basis) || ['category_only', 'source_silence'].includes(basis)) return false;
  if (row.evidence_ids.some(id => !selected.has(id) || !evidence.has(id))) return false;
  const cited = row.evidence_ids.map(id => evidence.get(id)?.quote || '').join('\n');
  if (basis === 'stem_direct') return row.evidence_ids.length === 0 && row.premises.length > 0 && row.premises.every(p => typeof p === 'string' && p.trim() && (view.body || '').includes(p));
  if (!row.premises.length) return false;
  if (basis === 'excerpt_direct') return row.premises.every(p => typeof p === 'string' && p.trim() && cited.includes(p));
  if (basis === 'arithmetic') return row.premises.every(p => typeof p === 'string' && p.trim() && ((view.body || '').includes(p) || cited.includes(p))) &&
    (row.evidence_ids.length > 0 || row.premises.every(p => (view.body || '').includes(p)));
  return false;
}

function validUnresolvedPremises(row, view, selected, evidence) {
  if (!Array.isArray(row.evidence_ids) || !Array.isArray(row.premises) || !row.rationale?.trim() ||
      !premiseBases.includes(row.basis_audit) || row.evidence_ids.some(id => !selected.has(id) || !evidence.has(id))) return false;
  const cited = row.evidence_ids.map(id => evidence.get(id)?.quote || '').join('\n');
  if (row.basis_audit === 'source_silence') return row.evidence_ids.length > 0 && row.premises.every(p => typeof p === 'string' && p.trim() && (cited.includes(p) || (view.body || '').includes(p)));
  if (row.basis_audit === 'stem_direct') return row.evidence_ids.length === 0 && row.premises.every(p => typeof p === 'string' && p.trim() && (view.body || '').includes(p));
  if (row.basis_audit === 'excerpt_direct') return row.evidence_ids.length > 0 && row.premises.every(p => typeof p === 'string' && p.trim() && cited.includes(p));
  if (row.basis_audit === 'arithmetic') return row.premises.every(p => typeof p === 'string' && p.trim() && ((view.body || '').includes(p) || cited.includes(p))) &&
    (row.evidence_ids.length > 0 || row.premises.every(p => (view.body || '').includes(p)));
  return false;
}

export function applyOptionResolutionAuditV77(result, view, context = {}) {
  const audit = validateOptionResolutionAuditV77(result, view, context);
  return { ...result, option_resolution_audit: { required: true, passed: audit.ok, reason: audit.reason },
    passed: result?.passed === true && audit.ok, reasons: [...(result?.reasons || []), ...(audit.ok ? [] : [audit.reason])] };
}
