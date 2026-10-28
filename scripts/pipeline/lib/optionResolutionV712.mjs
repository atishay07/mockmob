// V7.12 compact option resolution (additive copy of frozen V7.11; V7.11 stays frozen). V7.12 replaces V7.11's compact anchoring fallback,
// which an independent reviewer showed binds "nowhere" to "now here" and "resign" to "re-sign", and enforces question scope deterministically.
// Why: the native V7.8 regression probe (9 Oct, v78-regression-probe/) showed the byte-exact clause matrix
// plus a full re-audit of both matrices exhausting output budgets: a 5,000-token explanation audit returned
// reasoning only, a 7,500-token blind solve truncated, and validation cost ~USD 0.02 per item. The academic
// rule is unchanged: every option is resolved, the key must be fully supported, every other option needs a
// decisive contradiction anchored to an exact stem/source premise, and anything unresolved quarantines.
// Only the representation is smaller: one row per option with the exact false part and one exact premise.
import { validateEvidenceCatalogV78 } from './premiseBindingV78.mjs';
import { readingTaskV712, illustrationTaskV712 } from './questionScopeV712.mjs';

export const KEYS_V712 = Object.freeze(['A', 'B', 'C', 'D']);
const STATUSES = ['supported', 'contradicted', 'unresolved'];
// r2 (9 Oct): passage_scope. In a question about a supplied passage the passage is the question's whole universe, so an option the
// passage neither states nor reasonably implies is a wrong answer. Measured cause: valid V7.7 reading-comprehension controls were
// quarantined because 'not in the passage' was treated as non-decisive source silence. Subject-fact items keep the strict rule.
const SOURCES = ['stem', 'excerpt', 'arithmetic', 'passage_scope', 'case_scope', 'none'];

export function optionResolutionSchemaV712(evidenceIds = []) {
  return { type: 'array', minItems: 4, maxItems: 4, items: { type: 'object', additionalProperties: false,
    required: ['option', 'status', 'false_part', 'premise_source', 'evidence_id', 'premise_quote', 'reason'],
    properties: {
      option: { type: 'string', enum: KEYS_V712 }, status: { type: 'string', enum: STATUSES },
      false_part: { type: 'string' }, premise_source: { type: 'string', enum: SOURCES },
      evidence_id: { type: 'string', enum: ['', ...evidenceIds] }, premise_quote: { type: 'string' }, reason: { type: 'string' },
    } } };
}

// V7.12 representation-only folding: Unicode compatibility form, letter case, typographic quote/apostrophe/dash glyphs, soft hyphens and
// whitespace runs. Words, numbers, negation, punctuation, word boundaries and order stay significant. Space-separated tokens are never merged
// ("now here" is not "nowhere") and in-line hyphens are never dropped ("re-sign" is not "resign"). The ONLY join: a hyphen that ends a
// line in the original source between letters ("inter-" newline "relationship") may match the hyphenated or the joined form of that word.
const LINE_HYPHEN = '\u0001';
function baseFoldV712(value) {
  // NCERT PDFs encode the printed hyphen as U+00AD (mid-line "under\u00ADutilisation", line-end "utili\u00AD" + newline), so it is a hyphen here;
  // the line-end rule in foldSourceV712 then decides whether it may join.
  return value.normalize('NFKC').replace(/\u00AD/gu, '-').toLowerCase().replace(/[\u2018\u2019\u201A\u2032\u0060]/gu, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/gu, '"').replace(/[\u2010-\u2015\u2212]/gu, '-');
}
export function foldV712(value) {
  return typeof value === 'string' ? baseFoldV712(value).replace(/\s+/gu, ' ').trim() : '';
}
export function foldSourceV712(value) {
  return typeof value === 'string' ? baseFoldV712(value).replace(/(\p{L})-[ \t]*\r?\n\s*(?=\p{L})/gu, `$1${LINE_HYPHEN}`).replace(/\s+/gu, ' ').trim() : '';
}
const wordish = /[\p{L}\p{N}_]/u;
// Match needle n starting at h[i]; a LINE_HYPHEN in h matches '-' in n or nothing. Returns the end index in h, or -1.
function matchAt(h, n, i) {
  let j = 0;
  while (j < n.length) {
    if (i >= h.length) return -1;
    if (h[i] === LINE_HYPHEN) { if (n[j] === '-') j++; i++; continue; }
    if (h[i] !== n[j]) return -1;
    i++; j++;
  }
  return i;
}
export function containsAnchoredV712(container, needle) {
  const h = foldSourceV712(container), n = foldV712(needle);
  if (!h || !n) return false;
  for (let i = 0; i < h.length; i++) {
    if (h[i] !== n[0]) continue;
    const end = matchAt(h, n, i);
    if (end < 0) continue;
    const before = i ? h[i - 1] : '', after = h[end] || '';
    if ((!before || !wordish.test(before) || !wordish.test(n[0])) && (!after || !wordish.test(after) || !wordish.test(n.at(-1)))) return true;
  }
  return false;
}
const substantive = quote => { const f = foldV712(quote); return f.length >= 12 || (/\d/u.test(f) && f.length >= 3); };

function validOptions(options) {
  return Array.isArray(options) && options.length === 4 && KEYS_V712.every(k => options.filter(o => o?.key === k && typeof o.text === 'string').length === 1);
}

// view: the blind view (stem body, optional passage, printed options). evidenceCatalog: trusted catalogue from the
// adapter context (id, source_id, locator, quote). The stem never includes printed options: an option cannot prove itself.
export function validateOptionResolutionV712(result, view, { evidenceCatalog = [] } = {}) {
  // Raw provider rows arrive as option_resolution; once wrapped they are kept as option_resolution_rows.
  const rows = Array.isArray(result?.option_resolution_rows) ? result.option_resolution_rows : result?.option_resolution, fail = reason => ({ ok: false, reason });
  if (!validOptions(view?.options)) return fail('v712_input_options_invalid');
  if (!view?.candidate_id || !view?.content_hash || result?.candidate_id !== view.candidate_id || result?.content_hash !== view.content_hash) return fail('v712_identity_mismatch');
  const catalog = validateEvidenceCatalogV78(evidenceCatalog);
  if (!catalog.ok) return fail('v712_evidence_catalog_invalid');
  if (!Array.isArray(rows) || rows.length !== 4 || !KEYS_V712.every(k => rows.filter(r => r?.option === k).length === 1)) return fail('v712_all_four_options_required');
  const stem = [view.body, view.passage].filter(x => typeof x === 'string').join('\n');
  const optionText = new Map(view.options.map(o => [o.key, o.text]));
  const sourceText = id => { const item = catalog.byId.get(id); if (!item) return null;
    return [item.quote, evidenceCatalog.filter(e => e.source_id === item.source_id).map(e => e.quote).join(' ')]; };
  for (const r of rows) {
    if (!STATUSES.includes(r.status) || !SOURCES.includes(r.premise_source) || typeof r.reason !== 'string' || !r.reason.trim() ||
        typeof r.premise_quote !== 'string' || typeof r.false_part !== 'string' || typeof r.evidence_id !== 'string') return fail(`v712_row_incomplete:${r.option}`);
    if (r.status === 'unresolved') continue;
    if (r.premise_source === 'none' || !substantive(r.premise_quote)) return fail(`v712_decisive_premise_required:${r.option}`);
    if (r.premise_source === 'passage_scope') {
      if (typeof view.passage !== 'string' || !view.passage.trim()) return fail(`v712_passage_scope_without_passage:${r.option}`);
      // V7.12: a passage-scope REFUTATION needs a genuine reading task (deterministic, questionScopeV712); passage presence alone is not enough.
      if (r.status === 'contradicted' && !readingTaskV712(view)) return fail(`v712_passage_scope_not_reading_task:${r.option}`);
      // r3: the passage is often also a registered excerpt, so a valid catalogue ID may accompany it, and a passage-anchored quote may support
      // the key (same check as a stem/passage quote). The quote itself must still be exact passage words.
      if (r.evidence_id && !catalog.byId.has(r.evidence_id)) return fail(`v712_evidence_id_invalid:${r.option}`);
      if (!containsAnchoredV712(view.passage, r.premise_quote)) return fail(`v712_passage_quote_unbound:${r.option}`);
    } else if (r.premise_source === 'case_scope') {
      // Illustration items ("which feature/principle does this case show?"): the printed case is the universe, so an option naming a
      // feature the case does not exhibit is a wrong answer even if the feature is true of management in general. Refutation only,
      // anchored to the exact stem words that describe what the case actually shows. Classification items never use it (instructions,
      // audit basis rule, and the rival-condition check that caught ea03).
      if (r.status !== 'contradicted') return fail(`v712_case_scope_only_refutes:${r.option}`);
      // V7.12: only for deterministically detected illustration questions; never classification questions.
      if (!illustrationTaskV712(view)) return fail(`v712_case_scope_not_illustration_task:${r.option}`);
      if (r.evidence_id && !catalog.byId.has(r.evidence_id)) return fail(`v712_evidence_id_invalid:${r.option}`);
      if (!containsAnchoredV712(view.body, r.premise_quote)) return fail(`v712_case_quote_unbound:${r.option}`);
    } else if (r.premise_source === 'excerpt') {
      const texts = sourceText(r.evidence_id);
      if (!texts) return fail(`v712_evidence_id_invalid:${r.option}`);
      if (!texts.some(t => containsAnchoredV712(t, r.premise_quote))) return fail(`v712_excerpt_quote_unbound:${r.option}`);
    } else {
      if (r.evidence_id) return fail(`v712_stem_premise_with_evidence_id:${r.option}`);
      if (!containsAnchoredV712(stem, r.premise_quote)) return fail(`v712_stem_quote_unbound:${r.option}`);
    }
    if (r.status === 'contradicted' && (!r.false_part.trim() || !containsAnchoredV712(optionText.get(r.option), r.false_part))) return fail(`v712_false_part_not_in_option:${r.option}`);
  }
  const supported = rows.filter(r => r.status === 'supported');
  if (supported.length > 1) return fail(`v712_multiple_supported_options:${supported.map(r => r.option).join('')}`);
  if (supported.length !== 1 || supported[0].option !== result.solved_key) return fail('v712_solved_key_not_supported');
  const open = rows.find(r => r.option !== result.solved_key && r.status !== 'contradicted');
  if (open) return fail(`v712_unresolved_alternative:${open.option}`);
  return { ok: true, reason: null };
}

export function applyOptionResolutionV712(result, view, context = {}) {
  const v = validateOptionResolutionV712(result, view, context);
  return { ...result, option_resolution: { required: true, version: 'compact-option-resolution-v712', passed: v.ok, reason: v.reason },
    passed: result?.passed === true && v.ok, reasons: [...(Array.isArray(result?.reasons) ? result.reasons : []), ...(v.ok ? [] : [v.reason])] };
}

// ---- Explanation-stage audit of both frozen resolutions (existing Luna explanation call, no new model) ----
const AUDIT_BASES = ['direct_contradiction', 'arithmetic', 'passage_unsupported', 'not_exhibited_by_case', 'category_only', 'source_silence', 'partial_truth', 'unsupported', 'incorrect'];
export function resolutionAuditSchemaV712() {
  // r5: unexcluded_rival_conditions. Measured false accept (known-bank ea03, r4): an excerpt defined the rival category (capital receipt:
  // creates a liability OR reduces assets) by a condition the stem never excluded; one r2 solver caught it, the r4 solvers and audit did not.
  return { type: 'object', additionalProperties: false, required: ['key', 'key_fully_supported', 'key_reason', 'unexcluded_rival_conditions', 'distractors'], properties: {
    key: { type: 'string', enum: KEYS_V712 }, key_fully_supported: { type: 'boolean' }, key_reason: { type: 'string' },
    unexcluded_rival_conditions: { type: 'array', items: { type: 'string' } },
    distractors: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', additionalProperties: false,
      required: ['option', 'decisively_wrong', 'basis', 'reason'], properties: {
        option: { type: 'string', enum: KEYS_V712 }, decisively_wrong: { type: 'boolean' }, basis: { type: 'string', enum: AUDIT_BASES }, reason: { type: 'string' } } } } } };
}

export function validateResolutionAuditV712(result, view, { frozen = [] } = {}) {
  const audit = result?.resolution_audit, fail = reason => ({ ok: false, reason });
  if (result?.candidate_id !== view?.candidate_id || result?.content_hash !== view?.content_hash) return fail('v712_audit_identity_mismatch');
  if (frozen.length !== 2 || frozen.some(f => f.candidate_id !== view.candidate_id || f.content_hash !== view.content_hash)) return fail('v712_two_frozen_resolutions_required');
  const key = frozen[0].solved_key;
  if (!KEYS_V712.includes(key) || frozen.some(f => f.solved_key !== key)) return fail('v712_frozen_keys_disagree');
  if (!audit || audit.key !== key) return fail('v712_audit_key_mismatch');
  if (audit.key_fully_supported !== true) return fail('v712_audit_key_not_fully_supported');
  if (!Array.isArray(audit.unexcluded_rival_conditions)) return fail('v712_audit_rival_conditions_required');
  const rivals = audit.unexcluded_rival_conditions.filter(x => typeof x === 'string' && x.trim());
  if (rivals.length) return fail(`v712_audit_unexcluded_rival_condition:${rivals[0].slice(0, 120)}`);
  const others = KEYS_V712.filter(k => k !== key), rows = Array.isArray(audit.distractors) ? audit.distractors : [];
  if (rows.length !== 3 || !others.every(k => rows.filter(r => r?.option === k).length === 1)) return fail('v712_audit_all_distractors_required');
  for (const r of rows) {
    // r4: renamed from refutation_entailed, which the native audit read as "a contradiction is entailed" and set false for
    // passage-unsupported options it had itself judged neither stated nor implied.
    if (r.decisively_wrong !== true) return fail(`v712_audit_not_decisively_wrong:${r.option}:${r.basis}`);
    // V7.12: scope bases count only where the task makes the case or passage the universe of the question.
    if (!['direct_contradiction', 'arithmetic', ...(illustrationTaskV712(view) ? ['not_exhibited_by_case'] : []), ...(readingTaskV712(view) ? ['passage_unsupported'] : [])].includes(r.basis)) return fail(`v712_audit_nondecisive_basis:${r.option}:${r.basis}`);
  }
  return { ok: true, reason: null };
}

export function applyResolutionAuditV712(result, view, context = {}) {
  const v = validateResolutionAuditV712(result, view, context);
  return { ...result, option_resolution_audit: { required: true, version: 'compact-resolution-audit-v712', passed: v.ok, reason: v.reason },
    passed: result?.passed === true && v.ok, reasons: [...(Array.isArray(result?.reasons) ? result.reasons : []), ...(v.ok ? [] : [v.reason])] };
}
