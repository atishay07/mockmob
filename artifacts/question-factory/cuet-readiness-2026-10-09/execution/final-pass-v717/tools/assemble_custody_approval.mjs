import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/qualification-fresh32/';
const read = name => JSON.parse(readFileSync(base + name, 'utf8'));
const sha = name => createHash('sha256').update(readFileSync(base + name)).digest('hex');
const author = read('sealed/authored-custody-r2.json'), map = read('sealed/blind-id-map-custody-r1.json').items;
const originalCommerce = read('blind/independent-commerce.json').cases;
const languageRecord = read('blind/independent-language-business.json');
const language = languageRecord.responses;
const revisedCommerce = read('blind/independent-commerce-custody-r1.json').items;
const originalCommerceAudit = read('blind/explanation-commerce.json').cases;
const languageAudit = read('blind/explanation-language-business.json').cases;
const revisedCommerceAudit = read('blind/explanation-commerce-custody-r1.json').items;
const negativeBusinessAudit = read('blind/explanation-business-negative-r1.json');
const evidenceNames = ['sealed/authored.json', 'sealed/authored-custody-r1.json', 'sealed/authored-custody-r2.json',
  'sealed/blind-id-map.json', 'sealed/blind-id-map-custody-r1.json', 'source-registry.json', 'blind/packet.json', 'blind/packet-custody-r1.json',
  'blind/independent-commerce.json', 'blind/independent-language-business.json', 'blind/independent-commerce-custody-r1.json',
  'blind/explanation-commerce.json', 'blind/explanation-language-business.json', 'blind/explanation-commerce-custody-r1.json',
  'blind/explanation-business-negative-r1.json', 'blind/reconciliation-commerce-custody-r1.json',
  'sealed/PRE-REGISTRATION-REVISIONS.json', 'sealed/NEGATIVE-CONTROL-CONSTRUCTION-CORRECTION.json'];
const normalizedAnswers = value => Array.isArray(value) ? value : typeof value === 'string' && /^[ABCD]$/.test(value) ? [value] : [];
const cases = Object.entries(map).map(([id, authoredId]) => {
  const item = author.items.find(row => row.id === authoredId);
  const solution = [...revisedCommerce, ...originalCommerce, ...language].find(row => row.opaque_id === id);
  if (!item || !solution) throw Error('missing_independent_custody:' + id);
  const answer_set = normalizedAnswers(solution.answer_set);
  if (item.expected_valid && (answer_set.length !== 1 || answer_set[0] !== item.candidate.key)) throw Error('positive_key_mismatch:' + id);
  const revised = revisedCommerceAudit.find(row => row.opaque_id === id);
  const commerce = originalCommerceAudit.find(row => row.opaque_id === id);
  const linguistic = languageAudit.find(row => row.opaque_id === id);
  let confirmed = false, audit_file;
  if (revised) {
    confirmed = item.expected_valid ? revised.positive_academic_construction_supported === true : revised.intended_defect_confirmed === true;
    audit_file = 'blind/explanation-commerce-custody-r1.json';
  } else if (item.slot === 'B_D3') {
    confirmed = negativeBusinessAudit.assessment.controlled_false_explanation_defect_is_present === true && negativeBusinessAudit.assessment.all_non_explanation_author_fields_unchanged === true;
    audit_file = 'blind/explanation-business-negative-r1.json';
  } else if (commerce) {
    confirmed = commerce.original_validity_label_confirmed === true && commerce.construction_blockers.length === 0 && (item.expected_valid ? commerce.all_claims_supported_and_correct === true : commerce.declared_defect_confirmation.class_is_decisive === true);
    audit_file = 'blind/explanation-commerce.json';
  } else if (linguistic) {
    confirmed = item.expected_valid ? linguistic.author_key_matches_unique_independent_solution === true && linguistic.construction_assessment.startsWith('Expected-valid;') : linguistic.construction_assessment.startsWith('Controlled ');
    audit_file = 'blind/explanation-language-business.json';
  }
  if (!confirmed) throw Error('construction_not_confirmed:' + id);
  return { id, authored_id: authoredId, slot: item.slot, subject: item.subject, expected_valid: item.expected_valid,
    defect_class: item.defect_class || null, defect_note: item.defect_note || null,
    author_key: item.candidate.key, independently_established_answer_set: answer_set,
    independent_blind: solution, independent_explanation_audit_file: audit_file,
    decisive_source_refs: item.candidate.sources, historical_provenance_refs_used_for_registration: false,
    difficulty_target: item.candidate.difficulty, format: item.candidate.question_type, construction_confirmed: true };
});
if (cases.length !== 32 || cases.filter(row => row.expected_valid).length !== 20) throw Error('denominator_changed');
for (const subject of ['accountancy', 'business_studies', 'economics', 'english']) if (cases.filter(row => row.subject === subject && row.expected_valid).length !== 5 || cases.filter(row => row.subject === subject && !row.expected_valid).length !== 3) throw Error('subject_counts_changed');
for (const letter of 'ABCD') if (cases.filter(row => row.expected_valid && row.author_key === letter).length !== 5 || cases.filter(row => !row.expected_valid && row.author_key === letter).length !== 3) throw Error('key_balance_changed');
const approval = { schema: 'cuet-v717-pre-registration-custody-approval-v1', created_at: new Date().toISOString(), approved_by: '/root',
  approved: true, native_evaluation_calls: 0, case_count: 32, valid_controls: 20, controlled_defects: 12,
  evidence_files: Object.fromEntries(evidenceNames.map(name => [name, sha(name)])),
  reasoning: 'All32 keys/labels independently established before model evaluation. Two positive-source/syllabus flaws and one invalid negative draft independently detected, corrected before registration; associated incidental gaps removed. Originals preserved. Active references come only from corrected candidate.sources. Demand disagreement is a routing measurement, never a truth-gate failure. No native outcome or prior qualification case reused to select survivors.', cases };
writeFileSync(base + 'sealed/CONSTRUCTION-APPROVAL.json', JSON.stringify(approval, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ approved: true, cases: cases.length, valid: 20, defects: 12, native_calls: 0, path: base + 'sealed/CONSTRUCTION-APPROVAL.json', sha256: sha('sealed/CONSTRUCTION-APPROVAL.json') }));
