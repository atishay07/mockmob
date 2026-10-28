import { createHash } from 'node:crypto';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import * as V1 from '../tools/cuetFitBenchmarkItems.mjs';
import * as V2 from '../tools/cuetFitBenchmarkItemsV2.mjs';
import * as V3 from '../tools/cuetFitBenchmarkItemsV3.mjs';
export const SUITES = {
  v1: { prefix: 'v7b-', id: 'cuet-fit-benchmark-v1-2026-10-07', ...V1 },
  v2: { prefix: 'v7c-', id: 'cuet-fit-benchmark-v2-2026-10-07', PYQ_SELECTION: {}, ...V2 },
  v3: { prefix: 'v7d-', id: 'cuet-fit-benchmark-v3-2026-10-08', PYQ_SELECTION: {}, ...V3 }
};
// Variants whose defect status depends on whether a textbook default or convention supplies the missing condition. They are measured and
// reported but kept out of the primary false-accept denominator, because reasonable setters could keep them.
const CONTESTED = new Set(['acc-collection-period:conditional_answer', 'eco-multiplier-assumption:conditional_answer', 'eco-capital-receipt:stem_wording']);
const KEY_STILL_RIGHT = new Set(['wrong_key', 'unsupported_explanation', 'multiple_correct', 'embedded_unsupported', 'explanation_arithmetic']);

const norm = t => String(t || '').normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').toLowerCase();
const sha = t => createHash('sha256').update(t).digest('hex');
export const BENCHMARK_ID = SUITES.v1.id;
const SPEC_FIELDS = registry => subject => { const s = registry.exam_specs[subject]; return { syllabus_version: s.syllabus_version, pattern_version: s.pattern_version }; };

// Scratch registry: adds benchmark-only stimuli and families IN MEMORY. The saved registry is never modified.
export function benchmarkAdditions(PASSAGES = SUITES.v1.PASSAGES) {
  const sources = {};
  for (const [id, p] of Object.entries(PASSAGES)) {
    const hash = hashJSON(p.text);
    sources[id] = { id, kind: 'reference', state: 'active', version: 1, chapters: [p.chapter], url: 'local://mockmob/cuet-fit-benchmark/' + id, title: 'Original fictional benchmark stimulus', identity_sha256: sha(p.text), extraction_sha256: sha(p.text), extraction_checked: true, reuse_permitted: true,
      permission: { basis: 'Original prose written for the MockMob CUET-fit benchmark; no outside claim', reference: 'scripts/pipeline/tools/cuetFitBenchmarkItems.mjs' }, facts: { stimulus: { text: p.text } }, supports: { stimulus: hash }, source_pack_id: 'original-english-reference-v1' };
  }
  return { sources };
}
export function applyAdditions(registry, additions, fixtures = []) {
  const copy = structuredClone(registry);
  Object.assign(copy.sources, additions.sources);
  for (const f of fixtures) copy.families[f.candidate.family_id] = { state: 'active', version: 1, source_pack_id: f.candidate.provenance.source_pack_id, kind: f.candidate.provenance.kind === 'authentic_pyq' ? 'authentic_pyq' : 'original_practice' };
  return copy;
}
function refOf(registry, additions, id, locator) {
  const source = additions.sources[id] || registry.sources[id];
  if (!source) throw Error('unknown_source:' + id);
  const loc = locator || Object.keys(source.facts).find(l => String(source.facts[l].text).length > 200) || Object.keys(source.facts)[0];
  const support = source.supports?.[loc];
  if (!support) throw Error(`no_support_hash:${id}:${loc}`);
  return { id, version: source.version, locator: loc, support_hash: support };
}
function lintMust(registry, additions, refs, must, id) {
  const text = norm(refs.map(r => (additions.sources[r.id] || registry.sources[r.id]).facts[r.locator].text).join(' '));
  for (const phrase of must || []) if (!text.includes(norm(phrase))) throw Error(`must_phrase_missing:${id}:${phrase}`);
}
function candidate(registry, f, prefix = 'v7b-') {
  const spec = SPEC_FIELDS(registry)(f.subject);
  const packId = `original-${f.subject}-reference-v1`;
  return { id: f.id, subject: f.subject, chapter: f.chapter, body: f.body, options: f.options, correct_answer: f.key, explanation: f.explanation, route: f.route, difficulty: f.difficulty, question_type: f.type,
    passage_text: f.passage_text || '', family_id: prefix + 'family-' + f.id, source_refs: f.refs, concept_id: null,
    provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: prefix + 'family-' + f.id, adaptation_type: null, ...spec, source_pack_id: packId, source_pack_version: registry.packs[packId].version } };
}

export function buildFixtures(registry, suite = SUITES.v1) {
  const { prefix, BASES, PASSAGES, OUT_OF_SYLLABUS, POOR_FIT, PYQ_SELECTION } = suite, additions = benchmarkAdditions(PASSAGES), fixtures = [];
  const push = (id, group, category, expected_valid, c, oracle, extra = {}) => fixtures.push({ id, group, category, expected_valid, candidate: c, oracle, ...extra });
  for (const b of BASES) {
    const refs = b.refs.map(([id, locator]) => refOf(registry, additions, id, locator));
    lintMust(registry, additions, refs, b.must, b.id);
    const passageText = b.passage && !b.stimulusOnly ? PASSAGES[b.passage].text : '';
    const base = { ...b, refs, passage_text: passageText };
    push(prefix + b.id, 'authored_valid', 'valid', true, candidate(registry, base, prefix), { key: b.key, basis: 'Key established by the author from the cited excerpt and explicit arithmetic', source_refs: refs });
    for (const [category, override] of Object.entries(b.variants || {})) {
      const { why, ...patch } = override, v = { ...base, ...patch, id: `${prefix}${b.id}--${category}` };
      const oracleKey = KEY_STILL_RIGHT.has(category) ? b.key : null, contested = CONTESTED.has(`${b.id}:${category}`);
      push(v.id, 'controlled_defect', category, false, candidate(registry, { ...v, key: patch.key || b.key }, prefix), { key: oracleKey ?? 'none_or_indeterminate', basis: why || `Controlled ${category} mutation of ${b.id}`, correct_key_of_base: b.key, source_refs: refs }, { derived_from: prefix + b.id, ...(contested ? { contested: true } : {}) });
    }
  }
  for (const o of OUT_OF_SYLLABUS) {
    const refs = [refOf(registry, additions, o.ref[0], o.ref[1])];
    const route = 'conceptual';
    push(prefix + o.id, 'controlled_defect', 'out_of_syllabus', false, candidate(registry, { ...o, refs, route, type: 'conceptual_mcq', difficulty: 'medium', passage_text: '' }, prefix), { key: o.key, basis: 'Academically valid, but the topic is excluded from the 2026 syllabus baseline used for 2027 preparation', source_refs: refs });
  }
  for (const p of POOR_FIT) {
    const refs = [refOf(registry, additions, p.ref[0], p.ref[1])];
    push(prefix + p.id, 'cuet_fit_judgment', 'poor_cuet_fit', false, candidate(registry, { ...p, refs, passage_text: '' }, prefix), { key: p.key, basis: 'Correct and in-syllabus, but ' + p.weakness + ' (author judgment, not a correctness defect)', source_refs: refs }, { weakness: p.weakness });
  }
  // Authentic PYQs: official keys from NTA final-key matching; reserved calibration anchors are not used.
  const reserved = new Set(registry.calibration_anchor_ids || []);
  for (const [subject, n] of Object.entries(PYQ_SELECTION)) {
    const pool = registry.examples.filter(e => e.subject === subject && !reserved.has(e.id) && e.final_key_matched && !e.dropped && e.generation_ready === true && !e.passage_text &&
      (e.source_refs || []).some(r => registry.sources[r.id]?.kind === 'reference' && registry.sources[r.id]?.state === 'active') && /^[ABCD]$/.test(e.correct_answer || ''))
      .sort((a, b) => hashJSON(['v7b-select', a.id]).localeCompare(hashJSON(['v7b-select', b.id]))).slice(0, n);
    for (const a of pool) {
      const spec = SPEC_FIELDS(registry)(subject), id = prefix + 'pyq-' + a.id;
      const c = { id, subject, chapter: a.chapter, body: a.body, options: a.options, correct_answer: a.correct_answer, explanation: 'Explanation preparation pending.', route: a.route, difficulty: a.difficulty || 'medium', question_type: a.question_type,
        passage_text: '', family_id: a.family_id || `pyq:${a.id}`, source_refs: a.source_refs, concept_id: a.concept_id || null,
        provenance: { kind: 'authentic_pyq', anchor_id: a.id, adaptation_family: a.family_id || `pyq:${a.id}`, adaptation_type: null, ...spec, source_pack_id: a.source_pack_id, source_pack_version: a.source_pack_version } };
      push(id, 'authentic_pyq', 'authentic_pyq', true, c, { key: a.correct_answer, basis: 'NTA final answer key matched to the authenticated question paper', source_refs: a.source_refs, anchor_id: a.id }, { anchor_id: a.id, needs_explanation: true });
    }
  }
  return { additions, fixtures };
}
export const payloadHash = fixtures => hashJSON(fixtures.map(f => ({ id: f.id, group: f.group, category: f.category, expected_valid: f.expected_valid, candidate: f.candidate, oracle: f.oracle })));

// Regression suite: previously frozen and previously audited items. These are NOT fresh evidence; they guard against re-admitting known failures.
import { readFileSync } from 'node:fs';
export function buildRegressionFixtures(registry) {
  const read = p => JSON.parse(readFileSync(p, 'utf8')), fixtures = [];
  const old = read('artifacts/question-factory/execution-2026-10-07/benchmark.json');
  for (const f of old.fixtures) fixtures.push({ id: 'v7r-' + f.id, group: 'regression_benchmark', category: f.category, expected_valid: f.expected_valid, candidate: { ...f.candidate, id: 'v7r-' + f.id }, oracle: f.oracle });
  const baseline = read('artifacts/question-factory/quality-uplift/baseline100.json'), audit = read('artifacts/question-factory/quality-uplift/AUDIT-48.json');
  for (const item of audit.items.filter(q => q.verdict !== 'approve')) {
    const original = baseline.jobs.find(j => j.id === item.id)?.candidate; if (!original) continue;
    const anchor = registry.examples.find(a => a.id === original.provenance?.anchor_id); if (!anchor) continue;
    fixtures.push({ id: 'v7r-audit-' + original.id, group: 'regression_audit_defect', category: 'known_audit_defect', expected_valid: false, anchor_id: anchor.id,
      candidate: { ...original, id: 'v7r-audit-' + original.id, provenance: { ...original.provenance, source_pack_version: anchor.source_pack_version } }, oracle: { key: 'none', basis: 'Manual audit verdict: ' + item.verdict, source_refs: original.source_refs || [] }, audit: item });
  }
  return fixtures;
}
