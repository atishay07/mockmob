// Add two diagnosed bank failures to unchanged, already observed V74 regressions.
// This is never fresh evidence and never changes the bank or source registry.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expectedReleaseBindingV74 } from '../lib/releaseEvidenceV74.mjs';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';

const parent = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-prerequisite-diagnostic-2026-10-08';
const originalPath = 'artifacts/question-factory/cuet-readiness-2026-10-08/execution/owner-127-review/KNOWN-CRITICAL-REGRESSIONS.json';
const dir = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-known-critical-regression-2026-10-08';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
if (existsSync(dir)) throw Error('immutable_regression_already_exists');
const binding = expectedReleaseBindingV74(), previous = read(parent + '/frozen.json');
const known = read(originalPath), registry = read('data/source_registry.json');
if (JSON.stringify(previous.contract_binding) !== JSON.stringify(binding) || known.validation_contract_hash !== binding.validation_contract_hash || known.classification !== 'regression_only_previously_inspected_cases') throw Error('current_known_regression_binding_required');
const overlay = read(parent + '/scratch-registry-overlay.json');
const fixtures = structuredClone(previous.fixtures);
for (const original of known.cases) {
  const subject = original.metadata.subject, chapter = original.metadata.chapter;
  const id = 'known-bank-' + original.id, pack = 'v74-known-critical-' + subject, family = 'v74-known-critical-family-' + original.id;
  const refs = original.original_selected_excerpts.map(s => {
    const source = registry.sources[s.id];
    if (source?.supports?.[s.locator] !== s.support_hash || hashJSON(source?.facts?.[s.locator]?.text) !== s.support_hash || source.version !== s.version) throw Error('original_registered_source_changed:' + original.id);
    return { id: s.id, version: s.version, locator: s.locator, support_hash: s.support_hash };
  });
  const corroborating = original.corroborating_source;
  if (sha(corroborating.path) !== corroborating.sha256) throw Error('corroborating_source_changed');
  const sourceId = 'v74-known-critical-corroboration-' + original.id;
  const text = corroborating.text;
  overlay.sources[sourceId] = { id: sourceId, state: 'active', version: 1, kind: 'reference', chapters: [chapter], title: 'Previously inspected NCERT corroborating worked entry or full definition', url: 'https://ncert.nic.in/textbook/pdf/' + (subject === 'accountancy' ? 'leac102' : 'leec105') + '.pdf', identity_sha256: corroborating.sha256, extraction_sha256: createHash('sha256').update(text).digest('hex'), extraction_checked: true, reuse_permitted: true, permission: { basis: 'Brief attributed official NCERT excerpts for private educational verification; no unrestricted redistribution claim', reference: corroborating.path }, source_pack_id: pack, supports: { 'corroborating-excerpt': hashJSON(text) }, facts: { 'corroborating-excerpt': { text } } };
  refs.push({ id: sourceId, version: 1, locator: 'corroborating-excerpt', support_hash: hashJSON(text) });
  overlay.packs[pack] = { id: pack, state: 'active', subject, version: 1, document_ids: refs.map(r => r.id) };
  overlay.families[family] = { state: 'active', version: 1, kind: 'original_practice', source_pack_id: pack };
  const spec = registry.exam_specs[subject];
  const candidate = { id, subject, chapter, concept_id: null, body: original.question.stem, options: original.question.options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: original.key, explanation: original.explanation, difficulty: original.metadata.difficulty, question_type: original.metadata.question_type, route: 'conceptual', passage_text: original.question.passage || '', family_id: family, source_refs: refs, provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: family, adaptation_type: null, syllabus_version: spec.syllabus_version, pattern_version: spec.pattern_version, source_pack_id: pack, source_pack_version: 1 } };
  fixtures.push({ id, group: 'controlled_defect', category: original.mandatory_defect, expected_valid: false, candidate, oracle: { key: subject === 'accountancy' ? 'none_correct' : 'indeterminate', basis: original.independent_check, source_refs: refs }, source_custody: { bank_id: original.id, bank_content_hash: original.content_hash, frozen_known_case_sha256: sha(originalPath), original_stem_options_key_explanation_unchanged: true, supplementary_correct_rule_supplied: true }, construction_repairs_used: 0, maximum_additional_repairs: 0 });
}
const id = 'v74-known-critical-regression-2026-10-08';
const frozen = { ...previous, id, created_at: new Date().toISOString(), fixtures, payload_hash: payloadHash(fixtures), denominator: fixtures.length, valid_roots: fixtures.filter(f => f.expected_valid).length, controlled_defects: fixtures.filter(f => !f.expected_valid).length, release_eligibility: { scope: 'regression', classification: 'regression', approved_before_evaluation: true, previously_read: true, tuned_on: true, preregistration_id: id }, construction_disclosure: 'Ten unchanged previously observed controls plus two known bank failures. Exact matching current-contract judgments may be reused; these never become fresh reliability evidence.', lineage: { previous_frozen_sha256: sha(parent + '/frozen.json'), known_regressions_sha256: sha(originalPath), original_bank_unchanged: true, global_source_registry_unchanged: true } };
const oldCustody = read(parent + '/independent-key-custody.json');
mkdirSync(dir, { recursive: true });
const save = (name, value) => writeFileSync(dir + '/' + name, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save('frozen.json', frozen);
save('scratch-registry-overlay.json', overlay);
save('independent-key-custody.json', { ...oldCustody, at: frozen.created_at, lineage: frozen.lineage, positive_ids: fixtures.filter(f => f.expected_valid).map(f => f.id), known_failures: known.cases.map(c => ({ id: c.id, category: c.mandatory_defect, independent_check: c.independent_check })), fresh_evidence: false });
writeFileSync(dir + '/PREREGISTRATION.md', `# Current known-critical regression\n\nFrozen ${frozen.created_at}. The complete denominator is twelve: four previously observed positives, six previously observed controlled failures and two real bank failures independently diagnosed in the owner review. Require every critical failure to remain unavailable. Preserve all outcomes and any positive losses. This is regression evidence, never fresh academic qualification.\n\nThe two bank stems, options, proposed keys and explanations are unchanged. Their original references remain alongside the corroborating correct worked journal/full capital-receipt definition in a private overlay. Both independent solvers see sources but not proposed keys or explanations. The existing Luna explanation check remains. Haiku is excluded from historical regression. No generation, repair, publication, source-registry mutation or benchmark relabelling.\n\nOffline cache inspection must establish reuse of the ten old cases before execution; if it does not, stop and investigate instead of buying another evaluation of those cases. Exact contract/content/source cache hits remain historical evidence and are separately counted. New charged requests should belong only to the two new critical records; the persistent USD50 lifetime guard remains authoritative. The standard study ceiling is USD4 and is a maximum reservation ceiling, not an expected charge. Provider receipts and conservative holds are reported separately from invoices.\n`, { flag: 'wx' });
console.log(JSON.stringify({ dir, denominator: frozen.denominator, reused_historical_cases: 10, new_known_failures: 2, paid_calls: 0 }));
