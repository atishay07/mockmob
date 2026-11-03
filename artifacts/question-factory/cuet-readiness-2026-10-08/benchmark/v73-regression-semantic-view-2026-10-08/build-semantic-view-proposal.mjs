// Builds a separate, non-production semantic-view regression diagnostic.
// Never invoke the V73 runner from this builder; no provider or ledger is used.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expectedReleaseBindingV73 } from '../../../../../scripts/pipeline/lib/releaseEvidenceV73.mjs';
import { payloadHash } from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';
import { provenanceReasons } from '../../../../../data/question_factory_policy.mjs';
import { reservedBenchmarkAnchors } from '../../../../../scripts/pipeline/lib/factoryEvidenceV73.mjs';
import { structureVerdict } from '../../../../../scripts/pipeline/lib/evidencePipeline.mjs';
import { presentationLint } from '../../../../../data/question_presentation.mjs';

const out = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-semantic-view-2026-10-08';
const proposalDir = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-proposal-2026-10-08';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name, value) => writeFileSync(`${out}/${name}`, JSON.stringify(value, null, 2) + '\n');
const baseFrozen = read(`${proposalDir}/frozen.json`);
const auditHistory = read(`${proposalDir}/audit-history.json`);
const baseOverlay = read(`${proposalDir}/scratch-registry-overlay.json`);
const custody = read(`${proposalDir}/independent-key-custody.json`);
const registry = read('data/source_registry.json');
const reserved = new Set(reservedBenchmarkAnchors());
const historical = new Map(auditHistory.records.map(row => [row.original_audit_record.id, row]));
const unscored = new Set(['e539e791-5e64-48ad-be13-53df6e25a079', 'ea3b40b5-dc4b-4718-a7b9-5a5a2b46b016']);
const strictById = new Map();
const privatePacks = {}, privateFamilies = {};
const privateRegistry = structuredClone(registry);
privateRegistry.packs = { ...privateRegistry.packs, ...(baseOverlay.packs || {}) };
privateRegistry.families = { ...privateRegistry.families, ...(baseOverlay.families || {}) };

for (const fixture of baseFrozen.fixtures.filter(row => row.group === 'regression_audited_defect')) {
  const c = fixture.candidate, p = c.provenance, pack = registry.packs?.[p.source_pack_id];
  const alignedOriginal = { ...c, provenance: { ...p, source_pack_version: pack?.version ?? p.source_pack_version } };
  strictById.set(fixture.id, {
    provenance_kind: p.kind,
    anchor_id: p.anchor_id,
    anchor_is_reserved_from_exemplars: reserved.has(p.anchor_id),
    base_pack: pack ? { state: pack.state, version: pack.version, subject: pack.subject } : null,
    stored_proposal_selector_reasons: provenanceReasons(c, registry),
    selector_reasons_after_current_pack_version_alignment: provenanceReasons(alignedOriginal, registry),
    interpretation: 'This is the original claim-path local provenance selector result only. It does not include paid source, key, syllabus, explanation, alternative-answer or exam-fit judgments.'
  });
  const privateVersion = p.source_pack_version;
  privatePacks[p.source_pack_id] = {
    ...(pack || {}), id: p.source_pack_id, subject: c.subject, state: 'active', version: privateVersion,
    semantic_view_only: true,
    note: 'Private overlay copy solely to let this diagnostic reach academic semantic checks; base/global source-pack state is unchanged.'
  };
  privateFamilies[c.family_id] = {
    ...(registry.families?.[c.family_id] || {}), state: 'active', version: registry.families?.[c.family_id]?.version || 1,
    anchor_id: p.anchor_id, source_pack_id: p.source_pack_id, semantic_view_only: true
  };
}
privateRegistry.packs = { ...privateRegistry.packs, ...privatePacks };
privateRegistry.families = { ...privateRegistry.families, ...privateFamilies };

const semanticFields = ['subject', 'chapter', 'body', 'options', 'correct_answer', 'explanation', 'route', 'difficulty', 'question_type', 'passage_text', 'source_refs'];
const semanticProjection = candidate => Object.fromEntries(semanticFields.map(key => [key, candidate[key] ?? null]));
const fixtures = baseFrozen.fixtures.map(original => {
  if (original.group !== 'regression_audited_defect') return structuredClone(original);
  const candidate = structuredClone(original.candidate);
  const oldProvenance = structuredClone(candidate.provenance);
  // Diagnostic view changes provenance.kind and anchor_id only. Candidate
  // content, question key, explanation, source refs, label, category, and IDs
  // stay byte-identical; provenance history is retained in the lineage file.
  candidate.provenance.kind = 'original_practice';
  candidate.provenance.anchor_id = null;
  return { ...structuredClone(original), candidate, semantic_view_lineage: {
    original_provenance: oldProvenance,
    view_change: { kind: ['pyq_adapted/authentic_pyq', 'original_practice'], anchor_id: [oldProvenance.anchor_id, null] },
    literal_claim_path_reasons: strictById.get(original.id)
  } };
});

const excludedHistory = auditHistory.records.filter(row => unscored.has(row.original_audit_record.id));
const frozen = {
  ...baseFrozen,
  id: 'cuet-readiness-v73-regression-semantic-view-2026-10-08',
  frozen: true, proposal_only: true, semantic_view: true,
  contract_binding: expectedReleaseBindingV73(),
  fixtures,
  payload_hash: payloadHash(fixtures),
  historical_denominators: {
    original_benchmark_total: 24, original_benchmark_valid: 12, original_critical_defects: 12,
    audit_records_total: 18, audit_correctness_defects_scored: 16, contract_disagreements_preserved_unscored: 2,
    scored_regression_denominator: 40
  },
  limitations: [
    'The sixteen audited records use a private original_practice semantic view so the candidate can reach academic checks without claiming an authentic/adapted PYQ anchor.',
    'This is a module-isolation regression diagnostic, not the literal production provenance path and not eligible for a V7.3 release claim.',
    'The exact historical provenance for all sixteen is retained in diagnostic-view-lineage.json; strict selector outcomes are recorded per ID.',
    'Twelve positive controls are unchanged from the preceding proposal. All twenty-eight negative labels and their academic content remain unchanged.',
    'The two same-unit chapter disagreements remain preserved but unscored.'
  ]
};
const overlay = {
  ...baseOverlay,
  schema: 'v73-semantic-view-private-overlay-proposal-v1',
  packs: { ...(baseOverlay.packs || {}), ...privatePacks },
  families: { ...(baseOverlay.families || {}), ...privateFamilies },
  note: 'Proposal-only overlay: overrides active pack/family metadata for the 16 semantic-view audit copies. It does not write or mutate the global registry.'
};
const lineage = {
  schema: 'v73-regression-semantic-view-lineage-v1',
  status: 'proposal_only_not_registered_not_executed',
  semantic_field_list: semanticFields,
  transformations: 'For exactly 16 scored audit candidates, provenance.kind changed to original_practice and provenance.anchor_id to null. The private overlay provides active pack/family bindings using existing source_pack_id/source_pack_version and family_id. No stem, option, answer, explanation, label, oracle or source_ref changed.',
  records: fixtures.filter(row => row.group === 'regression_audited_defect').map(view => {
    const record = historical.get(view.historical_source_id || view.id);
    const original = record?.original_candidate || view.candidate;
    return {
      id: view.id,
      expected_valid: view.expected_valid,
      category: view.category,
      historical_source_id: record?.original_audit_record.id || view.id,
      historical_verdict: record?.historical_verdict || view.audit_verdict,
      historical_reasons: record?.historical_reasons || view.audit_reasons,
      original_candidate: original,
      original_provenance_exact: record?.original_candidate?.provenance || view.semantic_view_lineage.original_provenance,
      semantic_view_provenance: view.candidate.provenance,
      strict_claim_path_selector: strictById.get(view.id),
      deterministic_local_gate_reasons_before_semantic_stages: [
        ...structureVerdict(view.candidate).reasons,
        ...presentationLint(view.candidate),
        ...provenanceReasons(view.candidate, privateRegistry)
      ],
      content_before: semanticProjection(original),
      content_after: semanticProjection(view.candidate),
      academic_content_byte_equivalent: JSON.stringify(semanticProjection(original)) === JSON.stringify(semanticProjection(view.candidate))
    };
  }),
  unscored_contract_disagreements: excludedHistory.map(row => ({
    original_audit_record: row.original_audit_record,
    original_candidate: row.original_candidate,
    disposition: 'preserved_unscored_same_unit_chapter_taxonomy_disagreement'
  }))
};
const localStops = lineage.records.filter(row => row.deterministic_local_gate_reasons_before_semantic_stages.length).map(row => ({
  id: row.id, reasons: row.deterministic_local_gate_reasons_before_semantic_stages
}));

for (const fixture of fixtures.filter(row => row.group === 'regression_audited_defect')) {
  const line = lineage.records.find(row => row.id === fixture.id);
  if (!line?.academic_content_byte_equivalent) throw new Error(`semantic_content_changed:${fixture.id}`);
  if (fixture.candidate.id !== fixture.id || fixture.candidate.family_id !== fixture.candidate.provenance.adaptation_family) throw new Error(`identity_or_family_binding_changed:${fixture.id}`);
}
if (fixtures.filter(row => row.expected_valid).length !== 12 || fixtures.filter(row => row.expected_valid === false).length !== 28 || lineage.records.length !== 16) {
  throw new Error('semantic_view_denominator_changed');
}

write('frozen.json', frozen);
write('scratch-registry-overlay.json', overlay);
write('independent-key-custody.json', custody);
write('diagnostic-view-lineage.json', lineage);
write('proposal-manifest.json', {
  schema: 'v73-regression-semantic-view-manifest-v1', status: 'proposal_only_not_registered_not_executed',
  frozen_id: frozen.id, verifier_version: frozen.verifier_version, contract_binding: frozen.contract_binding,
  payload_hash: frozen.payload_hash,
  counts: { denominator: fixtures.length, positives: 12, original_critical_defects: 12, audited_correctness_defects: 16,
    unscored_contract_disagreements: 2, audited_lineage_records: lineage.records.length,
    semantic_content_identical: lineage.records.every(row => row.academic_content_byte_equivalent),
    audit_cases_with_deterministic_local_stops: localStops.length },
  diagnostic_boundary: 'Module-isolation semantic-view study only. The sixteen transformed records are not represented as authentic PYQs or pyq_adapted records. This does not establish the production provenance path or release eligibility.',
  source_hashes: {
    base_frozen: sha(`${proposalDir}/frozen.json`),
    base_audit_history: sha(`${proposalDir}/audit-history.json`),
    base_overlay: sha(`${proposalDir}/scratch-registry-overlay.json`),
    base_custody: sha(`${proposalDir}/independent-key-custody.json`),
    current_source_registry_read_only: sha('data/source_registry.json'),
    current_v73_anchor_selector: sha('scripts/pipeline/lib/factoryEvidenceV73.mjs'),
    current_provenance_policy: sha('data/question_factory_policy.mjs')
  },
  changes: ['New frozen file and private overlay in separate directory.', 'Exactly sixteen provenance-view changes: kind to original_practice, anchor_id to null.',
    'Private source-pack/family metadata overlays align to existing candidate fields; global registry remains untouched.',
    'Strict claim-path selector outcomes and reserved exemplar-anchor flags recorded for all sixteen.',
    'All 12 positives and all 28 negative academic content/oracles/labels unchanged.'],
  deterministic_local_stops: localStops,
  blocked_actions: ['No runner prepare, preflight, execute, or report.', 'No provider or ledger calls.', 'No changes to registered parent, 18 audit rows, contract exclusions, global registry, production state or release files.']
});
writeFileSync(`${out}/PROPOSAL.md`, `# V7.3 semantic-view regression proposal\n\n` +
  `This is a proposal-only module-isolation diagnostic, not the literal production provenance path. Its 40 scored fixture IDs and labels match the preceding proposal: 12 positives and all 28 known negatives (12 original critical controls plus 16 audited correctness/presentation cases).\n\n` +
  `For exactly the 16 audited cases, the diagnostic view changes only \`provenance.kind\` to \`original_practice\` and \`provenance.anchor_id\` to null. A private overlay aligns existing source-pack and family metadata. \`diagnostic-view-lineage.json\` retains each original candidate/provenance, the per-record strict selector outcome, and before/after semantic-field equality.\n\n` +
  `The original 12 positive controls are unchanged. All 28 negatives retain the same question text, choices, answer key, explanation, source references, expected label and oracle. The two same-unit chapter disagreements remain in the lineage appendix and are unscored. Five audit cases have deterministic structure/presentation lint findings; those are disclosed as early local gate outcomes, not independent model/source/key judgments. The semantic view has no early provenance stops.\n\n` +
  `Payload SHA-256: \`${frozen.payload_hash}\`. No runner action, provider call, ledger call, or release write occurred.\n`);

console.log(JSON.stringify({ output: out, denominator: fixtures.length, positives: 12, negatives: 28,
  semantic_view_cases: lineage.records.length, semantic_fields_identical: lineage.records.every(row => row.academic_content_byte_equivalent),
  strict_selector_reasons_by_id: Object.fromEntries([...strictById]), payload_hash: frozen.payload_hash,
  contract_binding: frozen.contract_binding }));
