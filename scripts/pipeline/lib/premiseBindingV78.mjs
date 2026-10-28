const KEYS = ['A', 'B', 'C', 'D'];
const ORIGIN_KINDS = ['stem', 'excerpt', 'printed_option_input'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export function premiseOriginsSchemaV78(evidenceIds = []) {
  return { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['kind', 'evidence_ids', 'option'], properties: {
      kind: { type: 'string', enum: ORIGIN_KINDS },
      evidence_ids: { type: 'array', items: { type: 'string', enum: evidenceIds } },
      option: { anyOf: [{ type: 'string', enum: KEYS }, { type: 'null' }] },
    } } };
}

// Whitespace folding is the only normalization permitted. Punctuation, case,
// numbers, negation, and word order remain byte-for-byte significant.
export function normalizePremiseWhitespaceV78(value) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

export function containsAnchoredPremiseV78(container, premise) {
  const haystack = normalizePremiseWhitespaceV78(container);
  const needle = normalizePremiseWhitespaceV78(premise);
  if (!haystack || !needle) return false;
  let offset = 0;
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    const before = offset === 0 ? '' : Array.from(haystack.slice(0, offset)).at(-1);
    const after = Array.from(haystack.slice(offset + needle.length))[0] || '';
    if ((!before || !/[\p{L}\p{N}_]/u.test(before)) && (!after || !/[\p{L}\p{N}_]/u.test(after))) return true;
    offset += 1;
  }
  return false;
}

export function validateEvidenceCatalogV78(evidenceCatalog) {
  if (!Array.isArray(evidenceCatalog)) return { ok: false, reason: 'premise_evidence_catalog_invalid' };
  const ids = new Set();
  for (const item of evidenceCatalog) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) ||
        typeof item.source_id !== 'string' || !item.source_id.trim() ||
        typeof item.locator !== 'string' || !item.locator.trim() ||
        typeof item.quote !== 'string' || !item.quote.trim() ||
        (own(item, 'start') && (!Number.isInteger(item.start) || item.start < 0)) ||
        (own(item, 'end') && (!Number.isInteger(item.end) || item.end < 0)) ||
        (own(item, 'start') && own(item, 'end') && item.end < item.start)) {
      return { ok: false, reason: 'premise_evidence_catalog_invalid' };
    }
    ids.add(item.id);
  }
  return { ok: true, byId: new Map(evidenceCatalog.map(item => [item.id, item])) };
}

/**
 * Bind each premise to exactly one declared origin. Origins are positional and
 * cannot be inferred from text when the provider supplies them. The selected
 * origin is returned for the semantic auditor to record in its clause result.
 */
export function validatePremiseBindingsV78({
  premises, premise_origins, basis, evidence_ids = [], selectedEvidenceIds = [],
  option = null, optionText = '', view, evidenceCatalog = [], audit = false,
}) {
  const fail = reason => ({ ok: false, reason, bindings: [] });
  if (!Array.isArray(premises) || premises.some(p => typeof p !== 'string' || !p.trim()) ||
      !Array.isArray(premise_origins) || premise_origins.length !== premises.length ||
      !Array.isArray(evidence_ids) || evidence_ids.some(id => typeof id !== 'string') ||
      !Array.isArray(selectedEvidenceIds) || selectedEvidenceIds.some(id => typeof id !== 'string')) return fail('premise_binding_shape_invalid');
  const catalogCheck = validateEvidenceCatalogV78(evidenceCatalog);
  if (!catalogCheck.ok) return fail(catalogCheck.reason);
  const evidence = catalogCheck.byId;
  const selected = new Set(selectedEvidenceIds);
  const allowedRowEvidence = new Set(evidence_ids);
  if (allowedRowEvidence.size !== evidence_ids.length || evidence_ids.some(id => !selected.has(id) || !evidence.has(id))) return fail('premise_binding_evidence_invalid');
  if (basis === 'source_silence') {
    if (evidence_ids.length === 0) return fail('premise_binding_basis_mismatch');
    if (premises.length === 0) return { ok: true, reason: null, bindings: [] };
  }
  if (premises.length === 0) return fail('premise_binding_shape_invalid');
  const optionByKey = new Map((Array.isArray(view?.options) ? view.options : []).map(entry => [entry?.key, entry?.text]));
  if (!KEYS.includes(option) && option !== null) return fail('premise_binding_option_invalid');
  const viewBody = typeof view?.body === 'string' ? view.body : '';
  const bindings = [];
  for (let i = 0; i < premises.length; i++) {
    const origin = premise_origins[i];
    if (!origin || typeof origin !== 'object' || Array.isArray(origin) ||
        Object.keys(origin).sort().join(',') !== 'evidence_ids,kind,option' ||
        !ORIGIN_KINDS.includes(origin.kind) || !Array.isArray(origin.evidence_ids) ||
        origin.evidence_ids.some(id => typeof id !== 'string') ||
        (origin.option !== null && !KEYS.includes(origin.option))) return fail('premise_origin_shape_invalid');
    const originEvidence = new Set(origin.evidence_ids);
    if (originEvidence.size !== origin.evidence_ids.length) return fail('premise_origin_evidence_invalid');
    if (origin.kind === 'stem') {
      if (origin.option !== null || originEvidence.size !== 0 || !containsAnchoredPremiseV78(viewBody, premises[i])) return fail('premise_stem_origin_mismatch');
    } else if (origin.kind === 'excerpt') {
      if (origin.option !== null || originEvidence.size === 0 ||
          [...originEvidence].some(id => !allowedRowEvidence.has(id) || !selected.has(id) || !evidence.has(id)) ||
          ![...originEvidence].some(id => containsAnchoredPremiseV78(evidence.get(id).quote, premises[i]))) return fail('premise_excerpt_origin_mismatch');
    } else {
      if (basis !== 'arithmetic' || originEvidence.size !== 0 || origin.option !== option ||
          !containsAnchoredPremiseV78(optionByKey.get(origin.option) || '', premises[i])) return fail('premise_printed_option_origin_forbidden');
    }
    bindings.push({ premise: premises[i], kind: origin.kind, evidence_ids: [...originEvidence], option: origin.option });
  }
  const kinds = bindings.map(binding => binding.kind);
  const hasSourcePremise = kinds.some(kind => kind !== 'printed_option_input');
  if (!hasSourcePremise) return fail('premise_binding_hypothetical_input_is_not_proof');
  if (basis === 'stem' || basis === 'stem_direct') {
    if (kinds.some(kind => kind !== 'stem') || evidence_ids.length) return fail('premise_binding_basis_mismatch');
  } else if (basis === 'excerpt' || basis === 'excerpt_direct') {
    if (!kinds.includes('excerpt') || kinds.some(kind => !['stem', 'excerpt'].includes(kind))) return fail('premise_binding_basis_mismatch');
  } else if (basis === 'arithmetic') {
    if (!kinds.includes('stem') && !kinds.includes('excerpt')) return fail('premise_binding_basis_mismatch');
  } else if (basis === 'source_silence') {
    if (kinds.some(kind => kind === 'printed_option_input') || evidence_ids.length === 0 ||
        (premises.length > 0 && !kinds.includes('excerpt'))) return fail('premise_binding_basis_mismatch');
  } else {
    return fail('premise_binding_basis_invalid');
  }
  return { ok: true, reason: null, bindings };
}
