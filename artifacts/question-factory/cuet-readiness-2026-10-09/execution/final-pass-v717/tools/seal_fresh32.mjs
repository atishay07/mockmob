import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/qualification-fresh32/';
const read = name => JSON.parse(readFileSync(base + name, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const approval = read('sealed/CONSTRUCTION-APPROVAL.json');
if (approval.approved !== true || approval.native_evaluation_calls !== 0 || approval.case_count !== 32) throw Error('construction_custody_approval_required');
for (const [name, hash] of Object.entries(approval.evidence_files)) if (sha(readFileSync(base + name)) !== hash) throw Error('custody_artifact_changed:' + name);
const author = read('sealed/authored-custody-r2.json'), registry = read('source-registry.json');
const map = read('sealed/blind-id-map-custody-r1.json').items;
const packet = read('blind/packet-custody-r1.json');
const created_at = new Date().toISOString(), study_id = author.study_id;
const rows = author.items.map(item => {
  const id = Object.entries(map).find(([, authored]) => authored === item.id)?.[0], c = item.candidate;
  const custody = approval.cases.find(row => row.id === id);
  if (!id || !custody?.construction_confirmed || custody.expected_valid !== item.expected_valid) throw Error('unconfirmed_case:' + item.id);
  const p = packet.items.find(row => row.opaque_id === id);
  if (p.question !== c.body || JSON.stringify(p.options.map(option => option.text)) !== JSON.stringify(c.options)) throw Error('custody_stem_or_option_changed:' + id);
  const family_id = 'fam717-' + sha(Buffer.from(id)).slice(0, 20);
  registry.families[family_id] = { state: 'active', version: 1, subject: item.subject, kind: 'original_practice' };
  const firstSource = registry.sources[c.sources[0][0]], pack_id = firstSource.source_pack_id;
  const source_refs = c.sources.map(([id, locator]) => ({ id, version: registry.sources[id].version, locator, support_hash: registry.sources[id].supports[locator] }));
  // Neutral objective metadata: no defect class, label, slot, proposed answer or diagnostic hints reach a blind reviewer.
  const objectives = {
    accountancy: 'Apply or interpret comparative and common-size financial statements using the printed facts.',
    business_studies: 'Apply the relevant financial management or financial planning principle to the printed question.',
    economics: 'Apply the relevant production, input-choice or short-run cost concept to the printed facts.',
    english: c.passage_text ? 'Understand the supplied factual passage and answer the printed comprehension question.' : 'Choose the appropriate word meaning in the printed context.'
  };
  const candidate = { id, subject: item.subject, chapter: c.chapter,
    concept_id: item.subject + ':' + c.chapter.toLowerCase().replace(/[^a-z0-9]+/g, '-') + ':' + c.question_type,
    body: c.body, options: c.options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: c.key, explanation: c.explanation,
    route: c.passage_text ? 'passage' : 'conceptual', difficulty: c.difficulty, question_type: c.question_type, passage_text: c.passage_text || null, family_id, source_refs,
    learning_objective: { syllabus_unit: c.syllabus_unit, objective: objectives[item.subject], target_term: c.target_term || '' },
    provenance: { kind: 'original_practice', anchor_id: c.sources[0][0], adaptation_family: family_id, adaptation_type: 'source-grounded-original-practice',
      syllabus_version: 'cuet-2026-provisional-for-2027', pattern_version: 'cuet-2024-authenticated-bookA-v1', source_pack_id: pack_id, source_pack_version: registry.packs[pack_id].version }
  };
  return { id, subject: item.subject, measurement_role: 'fresh', candidate };
});
// Deterministic subject interleaving; preserve all20 positives and12 negatives, with no result-dependent selection.
const ordered = [];
for (let i = 0; i < 8; i++) for (const subject of ['accountancy', 'business_studies', 'economics', 'english']) ordered.push(rows.filter(row => row.subject === subject)[i]);
const cases = { schema: 'cuet-v717-cases-v1', study_id, created_at, cases: ordered };
const custody = { schema: 'cuet-v717-custody-v1', study_id, created_at,
  construction_rule: 'Independent keys frozen before explanations/labels; every valid control source-supported with one defensible key and every controlled defect independently confirmed. Six pre-registration construction revisions preserved with original drafts. No paid evaluation informed revisions. All cases fixed after registration.',
  independent_solvers: 'Bounded independent blind derivation and source/explanation subagents; root authored pre-registration construction corrections without any native evaluation results.',
  evidence_files: approval.evidence_files, authored_sha256: sha(readFileSync(base + 'sealed/authored-custody-r2.json')),
  answers: approval.cases };
const study = { schema: 'cuet-v717-study-v1', id: study_id, kind: 'qualification', publication: 'never', cap_usd: 1, created_at,
  execution_freeze_path: 'artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v717/V717-FINAL-EXECUTION-FREEZE.json',
  composition: 'Fixed32 fresh source-grounded cases authored after V717 runtime freeze: each of four subjects5 valid controls +3 controlled defects. Valid proposed key positions5perletter, defects3perletter. No repairs/replacements/relabels after registration.',
  independent_custody: custody.construction_rule,
  decision_rule: 'PASS only if all32 terminal with complete receipts and zero study holds; zero review-incomplete errors; zero controlled false accepts; at least85% valid eligibility pooled and at least70% in each subject. Unfinished items are not rejections or defect detections. No repairs, resampling, relabels, exclusions or threshold changes after registration. One qualification only; a failed result is diagnosed and reported, with accepted requests recovered receipt-only.',
  budget_note: 'USD1 is a guarded STOP cap, not a guarantee of full completion. Preregister all three validation stages and their distinct completion retries using actual full adapter bodies. Conservative standard full bound may exceed cap; budget stops remain in denominator. Lifetime ceiling remainsUSD50, uncertain historical holds retained. Native Flex and batch settlement discounts are counted only from receipts.'
};
const out = (name, object) => { writeFileSync(base + name, JSON.stringify(object, null, 2) + '\n', { flag: 'wx' }); return { path: base + name, sha256: sha(readFileSync(base + name)) }; };
console.log(JSON.stringify({ outputs: [out('registry.json', registry), out('cases.json', cases), out('custody.json', custody), out('study.json', study)], cases: rows.length, native_calls: 0 }));
