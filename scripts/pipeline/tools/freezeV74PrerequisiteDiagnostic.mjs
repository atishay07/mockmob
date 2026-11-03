// One fixed historical diagnostic. These already inspected cases cannot release
// the current validator or be reported as new independent reliability evidence.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { payloadHash } from '../lib/cuetFitBenchmark.mjs';
import { expectedReleaseBindingV74 } from '../lib/releaseEvidenceV74.mjs';

const parent = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-official-source-v73-model';
const dir = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/v74-prerequisite-diagnostic-2026-10-08';
const id = 'v74-prerequisite-diagnostic-2026-10-08';
const positiveIds = ['cbse24-ac-q04', 'cbse24-bs-q02', 'cbse24-eco-q02', 'cbse24-eng-q01'];
const negativeIds = ['cbse24-eng-q01--wrong_key', 'cbse24-bs-q02--overlapping_options',
  'cbse24-ac-q04--missing_provision_amount', 'cbse24-eco-q06--numerical_fault',
  'cbse24-eco-q02--unsupported_explanation', 'cbse24-eco-q04--out_of_syllabus'];
const read = file => JSON.parse(readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const original = read(`${parent}/frozen.json`), originalCustody = read(`${parent}/independent-key-custody.json`);
const fixtures = [...positiveIds, ...negativeIds].map(fixtureId => {
  const fixture = original.fixtures.find(row => row.id === fixtureId);
  if (!fixture || fixture.expected_valid !== positiveIds.includes(fixtureId)) throw Error('diagnostic_fixture_lineage_mismatch');
  return fixture;
});
if (existsSync(dir)) throw Error('diagnostic_already_frozen_do_not_overwrite');
const binding = expectedReleaseBindingV74();
const lineage = { source_directory: parent, frozen_sha256: sha(`${parent}/frozen.json`),
  custody_sha256: sha(`${parent}/independent-key-custody.json`),
  candidate_text_options_explanations_keys_changed: false, historical_results_used_to_choose_diagnostic: true };
const frozen = { id, created_at: new Date().toISOString(), fixtures, payload_hash: payloadHash(fixtures),
  denominator: 10, valid_roots: 4, controlled_defects: 6, contract_binding: binding,
  verifier_version: binding.verifier_version,
  release_eligibility: { scope: 'regression', classification: 'regression', approved_before_evaluation: true,
    previously_read: true, tuned_on: true, preregistration_id: id },
  construction_disclosure: 'Fixed historical subset; not new fresh evidence, not a release and not a generation-yield measure.', lineage };
const custody = { at: new Date().toISOString(), complete: originalCustody.complete,
  positive_ids: positiveIds, problems: originalCustody.problems, lineage,
  source_key_records: originalCustody.all_raw_comparison.records.filter(row => positiveIds.includes(row.id)),
  new_independent_keys_established: false };
mkdirSync(dir, { recursive: true });
const save = (name, value) => writeFileSync(`${dir}/${name}`, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
save('frozen.json', frozen);
save('independent-key-custody.json', custody);
writeFileSync(`${dir}/scratch-registry-overlay.json`, readFileSync(`${parent}/scratch-registry-overlay.json`), { flag: 'wx' });
writeFileSync(`${dir}/PREREGISTRATION.md`, `# v7.4 prerequisite diagnostic\n\nFrozen ${frozen.created_at}.\n\nThe fixed denominator is ten: four unchanged source-keyed positives, one per subject, and six unchanged controlled defects. Every candidate, source reference, key and explanation is copied verbatim from the completed historical v7.3 study. This is regression evidence selected after inspecting those results, never fresh release evidence.\n\nPrimary question: does the prospective prompt distinguish a calculated remainder from an independently varying, missing case input? Require Accountancy Q4 to pass without accepting its missing-provision control. The five other controls cover a wrong key, overlapping options, a numerical fault, an unsupported explanation and out-of-syllabus content. Record all other outcomes and provider failures without replacement or retuning. Existing correctness predicates and explanation support remain unchanged.\n\nLuna and Gemini run blinded; Haiku is excluded from this historical diagnostic. No generation, repair, publication or relabelling is allowed. Existing persistent lifetime cap is USD 50; the runner's campaign reservation ceiling is USD 4, not an expected charge. Report actual gross costs including failures and holds. Reuse only current-contract cached decisions.\n`, { flag: 'wx' });
console.log(JSON.stringify({ dir, id, denominator: frozen.denominator, binding, paid_calls: 0, release: false }));
