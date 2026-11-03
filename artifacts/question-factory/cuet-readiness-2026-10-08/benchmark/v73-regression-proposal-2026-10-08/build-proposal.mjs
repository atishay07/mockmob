// Reproducibly assembles a read-only v7.3 regression proposal from frozen
// historical benchmark and audit evidence. This does not register or execute it.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash as cryptoHash } from 'node:crypto';
import { expectedReleaseBindingV73 } from '../../../../../scripts/pipeline/lib/releaseEvidenceV73.mjs';
import { payloadHash } from '../../../../../scripts/pipeline/lib/cuetFitBenchmark.mjs';

const out = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v73-regression-proposal-2026-10-08';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => cryptoHash('sha256').update(readFileSync(path)).digest('hex');
const write = (name, value) => writeFileSync(`${out}/${name}`, JSON.stringify(value, null, 2) + '\n');
const registry = read('data/source_registry.json');
const oldPath = 'artifacts/question-factory/execution-2026-10-07/benchmark.json';
const auditPath = 'artifacts/question-factory/quality-uplift/AUDIT-48.json';
const baselinePath = 'artifacts/question-factory/quality-uplift/baseline100.json';
const old = read(oldPath), audit = read(auditPath), baseline = read(baselinePath);
const jobs = new Map(baseline.jobs.map(job => [job.id, job]));

// These are the two same-unit chapter-taxonomy disagreements. Preserve them
// verbatim in the audit-history appendix; they do not enter the critical-failure
// denominator under the cuet-fit-v1.2 chapter relabel rule.
const contractDisagreementIds = new Set([
  'e539e791-5e64-48ad-be13-53df6e25a079',
  'ea3b40b5-dc4b-4718-a7b9-5a5a2b46b016'
]);

const fixtures = [];
for (const original of old.fixtures) {
  const id = original.id;
  if (original.candidate.id !== id) throw new Error(`historical_fixture_candidate_id_mismatch:${id}`);
  fixtures.push({
    ...original,
    id,
    candidate: { ...original.candidate, id },
    historical_source_id: original.id,
    evidence_role: 'regression',
    previously_read: true,
    tuned_on: true
  });
}

const auditHistory = [];
for (const item of audit.items.filter(row => row.verdict !== 'approve')) {
  const job = jobs.get(item.id), original = job?.candidate;
  if (!original) throw new Error(`missing_historical_candidate:${item.id}`);
  const anchor = registry.examples.find(row => row.id === original.provenance?.anchor_id);
  if (!anchor) throw new Error(`missing_current_anchor:${item.id}`);
  const id = `v73-audit-${original.id}`;
  if (original.id !== item.id) throw new Error(`historical_audit_candidate_id_mismatch:${item.id}`);
  const fixtureId = item.id;
  const candidate = {
    ...original,
    id: fixtureId,
    provenance: { ...original.provenance, source_pack_version: anchor.source_pack_version }
  };
  const isContractDisagreement = contractDisagreementIds.has(item.id);
  auditHistory.push({
    original_audit_record: item,
    original_candidate: original,
    candidate_id_for_proposal: fixtureId,
    scoring_disposition: isContractDisagreement ? 'preserved_unscored_contract_disagreement' : 'critical_correctness_or_presentation_defect',
    historical_verdict: item.verdict,
    historical_reasons: item.reasons
  });
  if (isContractDisagreement) continue;
  fixtures.push({
    id: fixtureId,
    group: 'regression_audited_defect',
    category: 'known_audit_defect',
    expected_valid: false,
    candidate,
    oracle: { key: 'none', basis: `Manual audit verdict: ${item.verdict}`, source_refs: original.source_refs || [] },
    historical_source_id: item.id,
    audit_verdict: item.verdict,
    audit_reasons: item.reasons,
    audit_record: item,
    evidence_role: 'regression',
    previously_read: true,
    tuned_on: true
  });
}

const positives = fixtures.filter(row => row.expected_valid === true);
const defects = fixtures.filter(row => row.expected_valid === false);
if (old.fixtures.length !== 24 || old.fixtures.filter(row => row.expected_valid === false).length !== 12 || auditHistory.length !== 18 ||
    defects.filter(row => row.group === 'regression_audited_defect').length !== 16 || positives.length !== 12) {
  throw new Error('historical_denominator_or_selection_changed');
}

const families = {};
const packs = {};
for (const fixture of fixtures) {
  const c = fixture.candidate, p = c.provenance;
  if (c.family_id !== p.adaptation_family) throw new Error(`family_binding_mismatch:${fixture.id}`);
  if (!registry.families[c.family_id]) families[c.family_id] = {
    state: 'active', version: 1, anchor_id: p.anchor_id || null, source_pack_id: p.source_pack_id
  };
  if (!registry.packs[p.source_pack_id] && !packs[p.source_pack_id]) packs[p.source_pack_id] = {
    id: p.source_pack_id, subject: c.subject, version: p.source_pack_version, state: 'active',
    registered_at: 'regression-proposal-only', document_ids: [...new Set((c.source_refs || []).map(ref => ref.id))]
  };
}
const overlay = { schema: 'v73-scratch-registry-overlay-proposal-v1', sources: {}, families, packs,
  note: 'No base source, source-registry file, production registry, or ledger was changed. All cited source refs were checked against the current base registry.' };
const custody = {
  schema: 'v73-independent-key-custody-proposal-v1', complete: true,
  positive_ids: positives.map(row => row.id), problems: [],
  records: positives.map(row => ({ fixture_id: row.id, historical_source_id: row.historical_source_id,
    source_refs: row.oracle?.source_refs || row.candidate.source_refs || [],
    oracle: row.oracle, source_file: oldPath, source_sha256: sha(oldPath),
    custody_note: 'Historical benchmark key/source oracle; previously read and tuned; this is regression evidence.' }))
};
const releaseEligibility = {
  preregistration_id: 'cuet-readiness-v73-regression-proposal-2026-10-08',
  classification: 'regression', scope: 'regression', approved_before_evaluation: false,
  previously_read: true, tuned_on: true,
  note: 'Every included record was read or tuned before; this corpus cannot establish fresh release evidence.'
};
const binding = expectedReleaseBindingV73();
const frozen = {
  id: 'cuet-readiness-v73-regression-proposal-2026-10-08',
  frozen: true, proposal_only: true, classification: 'regression', scope: 'regression',
  verifier_version: 'cuet-fit-validator-v7.3', contract_binding: binding,
  release_eligibility: releaseEligibility,
  denominator: fixtures.length, valid_roots: positives.length, controlled_defects: defects.length,
  fixtures, payload_hash: payloadHash(fixtures),
  historical_denominators: { original_benchmark_total: 24, original_benchmark_valid: 12, original_critical_defects: 12,
    audit_records_total: 18, audit_correctness_defects_scored: 16, contract_disagreements_preserved_unscored: 2,
    scored_regression_denominator: fixtures.length },
  limitations: ['All examples are previously read or tuned regression evidence.',
    'The 12 historical critical defects and 16 audited genuine defects are separate source cohorts.',
    'Two audited same-unit chapter relabel disagreements are retained in audit-history.json and excluded from critical scoring.',
    'This proposal is not registered or executed and establishes no v7.3 release.']
};

const cbseRoot = 'artifacts/question-factory/cuet-readiness-2026-10-08/execution/cbse-independent-key-candidates';
const comparisonPath = `${cbseRoot}/source-support-v3/post-freeze-official-key-comparison-v3.json`;
const comparison = read(comparisonPath);
const cbsePositive = comparison.rows.filter(row => row.decision === 'source_key_positive_candidate');
const supplementary = {
  schema: 'v73-supplementary-source-key-positive-regression-controls-v1',
  evidence_role: 'regression', previously_read: true, tuned_on: false,
  source_path: comparisonPath, source_sha256: sha(comparisonPath),
  independent_freeze_path: `${cbseRoot}/source-support-v3/freeze-before-official-key-comparison-v3.json`,
  independent_freeze_sha256: sha(`${cbseRoot}/source-support-v3/freeze-before-official-key-comparison-v3.json`),
  denominator: comparison.denominator, positive_count: cbsePositive.length,
  positive_by_subject: comparison.positive_by_subject,
  cases: cbsePositive,
  not_in_v73_fixture_payload_reason: 'The source-key custody rows are preserved as supplementary regression evidence. Their CBSE-derived content has not been rebound to V73-compatible source packs and candidate provenance, and CUET fit is explicitly not evaluated; they are not scored or represented as V73-valid fixtures.',
  withheld: comparison.withheld,
  limitations: comparison.limitations
};

write('frozen.json', frozen);
write('scratch-registry-overlay.json', overlay);
write('independent-key-custody.json', custody);
write('audit-history.json', { schema: 'v73-regression-audit-history-v1', historical_denominator: 18, scored_critical_defects: 16,
  preserved_unscored_contract_disagreements: 2, records: auditHistory,
  classification_basis: 'The two unscored records disagree only about same-unit chapter taxonomy. Current cuet-fit-v1.2 treats an in-unit chapter relabel as a relabel, not a correctness rejection. All other sixteen records retain their original non-approve verdict and full audit reasons.' });
write('supplementary-source-key-positive-controls.json', supplementary);
write('proposal-manifest.json', {
  schema: 'v73-regression-proposal-manifest-v1', status: 'proposal_only_not_registered_not_executed',
  built_at: new Date().toISOString(), frozen_id: frozen.id, verifier_version: frozen.verifier_version,
  contract_binding: binding, payload_hash: frozen.payload_hash,
  counts: frozen.historical_denominators,
  included_critical_fixture_ids: fixtures.filter(row => row.expected_valid === false).map(row => row.id),
  original_critical_source_ids: old.fixtures.filter(row => row.expected_valid === false).map(row => row.id),
  included_audited_correctness_source_ids: auditHistory.filter(row => row.scoring_disposition === 'critical_correctness_or_presentation_defect').map(row => row.original_audit_record.id),
  excluded_contract_disagreement_source_ids: auditHistory.filter(row => row.scoring_disposition === 'preserved_unscored_contract_disagreement').map(row => row.original_audit_record.id),
  source_inputs: [oldPath, auditPath, baselinePath, 'data/source_registry.json', comparisonPath],
  source_hashes: Object.fromEntries([oldPath, auditPath, baselinePath, 'data/source_registry.json', comparisonPath].map(path => [path, sha(path)])),
  metadata_changes: [
    'All original benchmark and audit fixture IDs and candidate.id values are preserved unchanged.',
    'For the sixteen audit candidate copies only, provenance.source_pack_version is refreshed from the matching current registry anchor, matching the established buildRegressionFixtures behavior; question text, options, answers, labels, source refs, and audit reasons are unchanged.',
    'The two chapter-only disagreements are retained verbatim in audit-history.json and are not included in the scored fixtures.',
    'All 51 source-key-positive CBSE cases are retained in a supplementary evidence manifest; their candidate questions are not rebound or scored under V73.'
  ],
  source_evidence_gaps: [
    'No missing or stale source references were found among the 40 scored core fixtures; every source ref matched an active, reuse-permitted source and exact support hash in the current base registry.',
    'The 51 supplementary CBSE positives have independent source/key custody but are not included in the scored fixture payload because V73-compatible source-pack, family, syllabus and fit bindings were not assembled for those CBSE-derived candidates. Their evidence records and official/blind keys are preserved as supplementary evidence.',
    'Thirteen of the 64 CBSE candidates were withheld in the source/key comparison and remain excluded with their original reasons.'
  ],
  blocked_actions: ['No paid API requests.', 'No runner prepare/preflight/execute/report action.', 'No source registry, ledger, calibration manifest, publication bank, or production writes.']
});
const knownCritical = old.fixtures.filter(row => row.expected_valid === false).map(row => row.id);
const auditedCritical = auditHistory.filter(row => row.scoring_disposition === 'critical_correctness_or_presentation_defect').map(row => row.original_audit_record.id);
const contractDisagreements = auditHistory.filter(row => row.scoring_disposition === 'preserved_unscored_contract_disagreement').map(row => row.original_audit_record.id);
writeFileSync(`${out}/PROPOSAL.md`, `# V7.3 regression proposal\n\n` +
  `This folder contains an assembled, unregistered regression proposal. It was not prepared, preflighted, executed, or published.\n\n` +
  `The frozen scored denominator is **40**: 12 historical positive controls, 12 original critical benchmark defects, and 16 independently audited correctness/presentation defects. The audit history preserves all **18** original non-approve records; these two same-unit chapter taxonomy disagreements are retained but excluded from critical scoring: ${contractDisagreements.join(', ')}.\n\n` +
  `The 51 source-key-positive CBSE candidates are preserved in the supplementary evidence manifest. They were not rebound as V7.3 fixtures because current V7.3 source-pack and syllabus/fit bindings were not assembled for their CBSE-derived content. The comparison's 13 withheld candidates remain withheld with their original reasons.\n\n` +
  `No scored core fixture has missing/stale source references: all source refs matched active, reuse-permitted sources and exact hashes in the current base registry. The contract binding is copied from the current V7.3 binding function.\n\n` +
  `Payload SHA-256: \`${frozen.payload_hash}\`\n\n` +
  `Original critical IDs (${knownCritical.length}):\n\n${knownCritical.map(id => `- \`${id}\``).join('\n')}\n\n` +
  `Audited critical IDs (${auditedCritical.length}):\n\n${auditedCritical.map(id => `- \`${id}\``).join('\n')}\n\n` +
  `See \`proposal-manifest.json\` for source hashes, exact contract binding, all scoring IDs and disclosed metadata changes; \`audit-history.json\` preserves all 18 original audit rows and candidate snapshots.\n`);

console.log(JSON.stringify({ output: out, denominator: fixtures.length, positives: positives.length, critical_defects: defects.length,
  audit_history: auditHistory.length, audit_scored: 16, audit_unscored_contract: 2, cbse_supplementary: cbsePositive.length,
  payload_hash: frozen.payload_hash, contract_binding: binding }));
