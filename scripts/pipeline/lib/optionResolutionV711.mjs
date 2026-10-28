// V7.11 compact option resolution (additive copy of frozen V7.10 with case-insensitive anchoring; V7.10 stays frozen with its failed q2 study).
// Why: the native V7.8 regression probe (9 Oct, v78-regression-probe/) showed the byte-exact clause matrix
// plus a full re-audit of both matrices exhausting output budgets: a 5,000-token explanation audit returned
// reasoning only, a 7,500-token blind solve truncated, and validation cost ~USD 0.02 per item. The academic
// rule is unchanged: every option is resolved, the key must be fully supported, every other option needs a
// decisive contradiction anchored to an exact stem/source premise, and anything unresolved quarantines.
// Only the representation is smaller: one row per option with the exact false part and one exact premise.
import { validateEvidenceCatalogV78 } from './premiseBindingV78.mjs';

export const KEYS_V711 = Object.freeze(['A', 'B', 'C', 'D']);
const STATUSES = ['supported', 'contradicted', 'unresolved'];
// r2 (9 Oct): passage_scope. In a question about a supplied passage the passage is the question's whole universe, so an option the
// passage neither states nor reasonably implies is a wrong answer. Measured cause: valid V7.7 reading-comprehension controls were
// quarantined because 'not in the passage' was treated as non-decisive source silence. Subject-fact items keep the strict rule.
const SOURCES = ['stem', 'excerpt', 'arithmetic', 'passage_scope', 'case_scope', 'none'];

export function optionResolutionSchemaV711(evidenceIds = []) {
  return { type: 'array', minItems: 4, maxItems: 4, items: { type: 'object', additionalProperties: false,
    required: ['option', 'status', 'false_part', 'premise_source', 'evidence_id', 'premise_quote', 'reason'],
    properties: {
      option: { type: 'string', enum: KEYS_V711 }, status: { type: 'string', enum: STATUSES },
      false_part: { type: 'string' }, premise_source: { type: 'string', enum: SOURCES },
      evidence_id: { type: 'string', enum: ['', ...evidenceIds] }, premise_quote: { type: 'string' }, reason: { type: 'string' },
    } } };
}

// Representation-only folding: whitespace (PDF line wraps) and typographic glyph variants of quotes, apostrophes
// and dashes. Words, numbers, negation, order and other punctuation remain significant.
export function foldV711(value) {
  // V7.11: case-insensitive (q2: a false_part began 'the minutes' where the option began 'The minutes'). Letters, digits, negation and order still match exactly.
  return typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/[‘’‚′`]/gu, "'").replace(/[“”„″]/gu, '"')
    .replace(/[‐-―−]/gu, '-').replace(/\s+/gu, ' ').trim() : '';
}
const wordish = /[\p{L}\p{N}_]/u;
export function containsAnchoredV711(container, needle) {
  const h = foldV711(container), n = foldV711(needle);
  if (!h || !n) return false;
  for (let at = h.indexOf(n); at !== -1; at = h.indexOf(n, at + 1)) {
    const before = at ? h[at - 1] : '', after = h[at + n.length] || '';
    if ((!before || !wordish.test(before) || !wordish.test(n[0])) && (!after || !wordish.test(after) || !wordish.test(n.at(-1)))) return true;
  }
  // V7.11: registered NCERT extractions split words ("retail stor e", "differ ent") and break lines with hyphens or soft hyphens
  // ("organ - isations", "inter ­ relationship"). Fresh q1 lost a valid control because Luna correctly quoted "retail store".
  // Compare once more with ALL whitespace and soft hyphens removed and letter-hyphen-letter joined, on BOTH sides. Every letter,
  // digit, negation and their order must still match exactly; nothing is paraphrased, skipped or inferred.
  const hc = compactV711(container), nc = compactV711(needle);
  if (nc.length < 10) return false;
  // A compact match may not begin or end inside a digit run ("by 1" must never bind inside "by 10").
  for (let at = hc.indexOf(nc); at !== -1; at = hc.indexOf(nc, at + 1)) {
    const before = at ? hc[at - 1] : '', after = hc[at + nc.length] || '';
    if (!(/\d/u.test(nc[0]) && /\d/u.test(before)) && !(/\d/u.test(nc.at(-1)) && /\d/u.test(after))) return true;
  }
  return false;
}
export function compactV711(value) {
  return foldV711(value).replace(/­/gu, '').replace(/\s+/gu, '').replace(/(\p{L})-(?=\p{L})/gu, '$1');
}
const substantive = quote => { const f = foldV711(quote); return f.length >= 12 || (/\d/u.test(f) && f.length >= 3); };

function validOptions(options) {
  return Array.isArray(options) && options.length === 4 && KEYS_V711.every(k => options.filter(o => o?.key === k && typeof o.text === 'string').length === 1);
}

// view: the blind view (stem body, optional passage, printed options). evidenceCatalog: trusted catalogue from the
// adapter context (id, source_id, locator, quote). The stem never includes printed options: an option cannot prove itself.
export function validateOptionResolutionV711(result, view, { evidenceCatalog = [] } = {}) {
  // Raw provider rows arrive as option_resolution; once wrapped they are kept as option_resolution_rows.
  const rows = Array.isArray(result?.option_resolution_rows) ? result.option_resolution_rows : result?.option_resolution, fail = reason => ({ ok: false, reason });
  if (!validOptions(view?.options)) return fail('v711_input_options_invalid');
  if (!view?.candidate_id || !view?.content_hash || result?.candidate_id !== view.candidate_id || result?.content_hash !== view.content_hash) return fail('v711_identity_mismatch');
  const catalog = validateEvidenceCatalogV78(evidenceCatalog);
  if (!catalog.ok) return fail('v711_evidence_catalog_invalid');
  if (!Array.isArray(rows) || rows.length !== 4 || !KEYS_V711.every(k => rows.filter(r => r?.option === k).length === 1)) return fail('v711_all_four_options_required');
  const stem = [view.body, view.passage].filter(x => typeof x === 'string').join('\n');
  const optionText = new Map(view.options.map(o => [o.key, o.text]));
  const sourceText = id => { const item = catalog.byId.get(id); if (!item) return null;
    return [item.quote, evidenceCatalog.filter(e => e.source_id === item.source_id).map(e => e.quote).join(' ')]; };
  for (const r of rows) {
    if (!STATUSES.includes(r.status) || !SOURCES.includes(r.premise_source) || typeof r.reason !== 'string' || !r.reason.trim() ||
        typeof r.premise_quote !== 'string' || typeof r.false_part !== 'string' || typeof r.evidence_id !== 'string') return fail(`v711_row_incomplete:${r.option}`);
    if (r.status === 'unresolved') continue;
    if (r.premise_source === 'none' || !substantive(r.premise_quote)) return fail(`v711_decisive_premise_required:${r.option}`);
    if (r.premise_source === 'passage_scope') {
      if (typeof view.passage !== 'string' || !view.passage.trim()) return fail(`v711_passage_scope_without_passage:${r.option}`);
      // r3: the passage is often also a registered excerpt, so a valid catalogue ID may accompany it, and a passage-anchored quote may support
      // the key (same check as a stem/passage quote). The quote itself must still be exact passage words.
      if (r.evidence_id && !catalog.byId.has(r.evidence_id)) return fail(`v711_evidence_id_invalid:${r.option}`);
      if (!containsAnchoredV711(view.passage, r.premise_quote)) return fail(`v711_passage_quote_unbound:${r.option}`);
    } else if (r.premise_source === 'case_scope') {
      // Illustration items ("which feature/principle does this case show?"): the printed case is the universe, so an option naming a
      // feature the case does not exhibit is a wrong answer even if the feature is true of management in general. Refutation only,
      // anchored to the exact stem words that describe what the case actually shows. Classification items never use it (instructions,
      // audit basis rule, and the rival-condition check that caught ea03).
      if (r.status !== 'contradicted') return fail(`v711_case_scope_only_refutes:${r.option}`);
      if (r.evidence_id && !catalog.byId.has(r.evidence_id)) return fail(`v711_evidence_id_invalid:${r.option}`);
      if (!containsAnchoredV711(view.body, r.premise_quote)) return fail(`v711_case_quote_unbound:${r.option}`);
    } else if (r.premise_source === 'excerpt') {
      const texts = sourceText(r.evidence_id);
      if (!texts) return fail(`v711_evidence_id_invalid:${r.option}`);
      if (!texts.some(t => containsAnchoredV711(t, r.premise_quote))) return fail(`v711_excerpt_quote_unbound:${r.option}`);
    } else {
      if (r.evidence_id) return fail(`v711_stem_premise_with_evidence_id:${r.option}`);
      if (!containsAnchoredV711(stem, r.premise_quote)) return fail(`v711_stem_quote_unbound:${r.option}`);
    }
    if (r.status === 'contradicted' && (!r.false_part.trim() || !containsAnchoredV711(optionText.get(r.option), r.false_part))) return fail(`v711_false_part_not_in_option:${r.option}`);
  }
  const supported = rows.filter(r => r.status === 'supported');
  if (supported.length > 1) return fail(`v711_multiple_supported_options:${supported.map(r => r.option).join('')}`);
  if (supported.length !== 1 || supported[0].option !== result.solved_key) return fail('v711_solved_key_not_supported');
  const open = rows.find(r => r.option !== result.solved_key && r.status !== 'contradicted');
  if (open) return fail(`v711_unresolved_alternative:${open.option}`);
  return { ok: true, reason: null };
}

export function applyOptionResolutionV711(result, view, context = {}) {
  const v = validateOptionResolutionV711(result, view, context);
  return { ...result, option_resolution: { required: true, version: 'compact-option-resolution-v711', passed: v.ok, reason: v.reason },
    passed: result?.passed === true && v.ok, reasons: [...(Array.isArray(result?.reasons) ? result.reasons : []), ...(v.ok ? [] : [v.reason])] };
}

// ---- Explanation-stage audit of both frozen resolutions (existing Luna explanation call, no new model) ----
const AUDIT_BASES = ['direct_contradiction', 'arithmetic', 'passage_unsupported', 'not_exhibited_by_case', 'category_only', 'source_silence', 'partial_truth', 'unsupported', 'incorrect'];
export function resolutionAuditSchemaV711() {
  // r5: unexcluded_rival_conditions. Measured false accept (known-bank ea03, r4): an excerpt defined the rival category (capital receipt:
  // creates a liability OR reduces assets) by a condition the stem never excluded; one r2 solver caught it, the r4 solvers and audit did not.
  return { type: 'object', additionalProperties: false, required: ['key', 'key_fully_supported', 'key_reason', 'unexcluded_rival_conditions', 'distractors'], properties: {
    key: { type: 'string', enum: KEYS_V711 }, key_fully_supported: { type: 'boolean' }, key_reason: { type: 'string' },
    unexcluded_rival_conditions: { type: 'array', items: { type: 'string' } },
    distractors: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', additionalProperties: false,
      required: ['option', 'decisively_wrong', 'basis', 'reason'], properties: {
        option: { type: 'string', enum: KEYS_V711 }, decisively_wrong: { type: 'boolean' }, basis: { type: 'string', enum: AUDIT_BASES }, reason: { type: 'string' } } } } } };
}

export function validateResolutionAuditV711(result, view, { frozen = [] } = {}) {
  const audit = result?.resolution_audit, fail = reason => ({ ok: false, reason });
  if (result?.candidate_id !== view?.candidate_id || result?.content_hash !== view?.content_hash) return fail('v711_audit_identity_mismatch');
  if (frozen.length !== 2 || frozen.some(f => f.candidate_id !== view.candidate_id || f.content_hash !== view.content_hash)) return fail('v711_two_frozen_resolutions_required');
  const key = frozen[0].solved_key;
  if (!KEYS_V711.includes(key) || frozen.some(f => f.solved_key !== key)) return fail('v711_frozen_keys_disagree');
  if (!audit || audit.key !== key) return fail('v711_audit_key_mismatch');
  if (audit.key_fully_supported !== true) return fail('v711_audit_key_not_fully_supported');
  if (!Array.isArray(audit.unexcluded_rival_conditions)) return fail('v711_audit_rival_conditions_required');
  const rivals = audit.unexcluded_rival_conditions.filter(x => typeof x === 'string' && x.trim());
  if (rivals.length) return fail(`v711_audit_unexcluded_rival_condition:${rivals[0].slice(0, 120)}`);
  const others = KEYS_V711.filter(k => k !== key), rows = Array.isArray(audit.distractors) ? audit.distractors : [];
  if (rows.length !== 3 || !others.every(k => rows.filter(r => r?.option === k).length === 1)) return fail('v711_audit_all_distractors_required');
  for (const r of rows) {
    // r4: renamed from refutation_entailed, which the native audit read as "a contradiction is entailed" and set false for
    // passage-unsupported options it had itself judged neither stated nor implied.
    if (r.decisively_wrong !== true) return fail(`v711_audit_not_decisively_wrong:${r.option}:${r.basis}`);
    const passageQuestion = typeof view?.passage === 'string' && view.passage.trim().length > 0;
    if (!['direct_contradiction', 'arithmetic', 'not_exhibited_by_case', ...(passageQuestion ? ['passage_unsupported'] : [])].includes(r.basis)) return fail(`v711_audit_nondecisive_basis:${r.option}:${r.basis}`);
  }
  return { ok: true, reason: null };
}

export function applyResolutionAuditV711(result, view, context = {}) {
  const v = validateResolutionAuditV711(result, view, context);
  return { ...result, option_resolution_audit: { required: true, version: 'compact-resolution-audit-v711', passed: v.ok, reason: v.reason },
    passed: result?.passed === true && v.ok, reasons: [...(Array.isArray(result?.reasons) ? result.reasons : []), ...(v.ok ? [] : [v.reason])] };
}
