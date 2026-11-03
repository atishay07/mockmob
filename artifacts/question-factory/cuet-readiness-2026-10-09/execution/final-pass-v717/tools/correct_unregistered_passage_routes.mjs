import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/qualification-fresh32/';
if (['registration.json', 'preflight.json', 'state.json', 'worker.lock'].some(name => existsSync(base + name))) throw Error('registered_or_active_case_correction_forbidden');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = readFileSync(base + 'cases.json');
if (sha(original) !== 'f37a0db126da5b207c8e116db491788dcf21238ad953b6cd0baaa1dd30e42508') throw Error('unexpected_original_cases');
writeFileSync(base + 'sealed/runtime-cases-before-passage-route-correction.json', original, { flag: 'wx' });
const cases = JSON.parse(original), changed = [];
for (const row of cases.cases) if (row.candidate.passage_text) {
  if (row.candidate.question_type !== 'reading_comprehension') throw Error('unexpected_passage_format');
  changed.push(row.id); row.candidate.route = 'passage';
}
if (changed.length !== 5) throw Error('unexpected_passage_count');
const corrected = JSON.stringify(cases, null, 2) + '\n';
writeFileSync(base + 'cases.json', corrected);
writeFileSync(base + 'sealed/UNREGISTERED-PASSAGE-ROUTE-CORRECTION.json', JSON.stringify({ created_at: new Date().toISOString(), original_sha256: sha(original), corrected_sha256: sha(Buffer.from(corrected)), changed_ids: changed, changed_field_only: 'candidate.route', blind_stems_options_keys_explanations_labels_unchanged: true, registration_present: false, native_evaluation_calls: 0, original_bytes_preserved: 'sealed/runtime-cases-before-passage-route-correction.json', reason: 'Root sealer incorrectly applied conceptual route to reading items. Explicit passage route makes mandatory passage-answerability gates apply; correct before any registration or evaluation.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ corrected: changed.length, cases_sha256: sha(Buffer.from(corrected)), native_calls: 0 }));
