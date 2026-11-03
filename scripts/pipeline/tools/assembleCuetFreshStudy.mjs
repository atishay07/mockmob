// Additive, parameterised copy of assembleV79FreshStudy.mjs (that file is hash-recorded in the frozen V7.9 freeze).
//   STUDY_CONTRACT=<frozen contract> node scripts/pipeline/tools/assembleCuetFreshStudy.mjs <inputDir> <studyDir> <studyId> <casePrefix>
// Assemble the fresh V7.9 qualification study from independently authored, independently blind-keyed cases (9 Oct 2026).
// Inputs: per-subject authored JSON (author role), blind custody JSON (separate reviewer, keys hidden), the adjudication file.
// Output: frozen.json (fixed denominator, labels, candidates) + scratch-registry-overlay.json (families). Sources are the main
// registry's existing hash-custodied facts; nothing is added to data/source_registry.json.
//   node scripts/pipeline/tools/assembleV79FreshStudy.mjs <inputDir> <studyDir>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hashJSON, provenanceReasons } from '../../../data/question_factory_policy.mjs';
import { structureVerdict } from '../lib/evidencePipeline.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';
import { contentHash } from '../../../data/content_evidence.js';

const [inputDir, studyDir, studyId, casePrefix] = process.argv.slice(2);
if (!inputDir || !studyDir || !studyId || !/^[a-z0-9]+$/.test(casePrefix || '')) throw new Error('usage: <inputDir> <studyDir> <studyId> <casePrefix>');
if (existsSync(join(studyDir, 'frozen.json'))) throw new Error('study_already_frozen_never_overwrite');
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const registry = json('data/source_registry.json');
const SUBJECTS = ['accountancy', 'business_studies', 'economics', 'english'];
const adjudication = json(join(inputDir, 'adjudication.json')); // { include: [local_id...], exclusions: [{local_id, reason}] }
const fixtures = [], families = {}, failures = [];
for (const subject of SUBJECTS) {
  const facts = new Map(json(join(inputDir, 'kit', `${subject}-facts.json`)).map(f => [f.ref, f]));
  for (const item of json(join(inputDir, 'sealed', `${subject}-authored.json`)).items) {
    if (!adjudication.include.includes(item.local_id)) continue;
    const id = `${casePrefix}-${item.local_id}`, family_id = `${casePrefix}-family-${item.local_id}`, c = item.candidate;
    const refs = (c.fact_refs || []).map(ref => { const f = facts.get(ref); if (!f) throw new Error(`unknown_fact_ref:${item.local_id}:${ref}`);
      return { id: f.source_id, version: f.version, locator: f.locator, support_hash: f.support_hash }; });
    const candidate = { id, subject, chapter: c.chapter, body: c.body, options: c.options, correct_answer: c.correct_answer, explanation: c.explanation,
      route: c.route, difficulty: c.difficulty, question_type: c.question_type, passage_text: c.passage_text || '', family_id, source_refs: refs,
      learning_objective: c.learning_objective,
      provenance: { kind: 'original_practice', anchor_id: null, adaptation_family: family_id, adaptation_type: 'source-grounded-original-practice',
        syllabus_version: registry.exam_specs[subject].syllabus_version, pattern_version: registry.exam_specs[subject].pattern_version,
        source_pack_id: `original-${subject}-reference-v1`, source_pack_version: registry.packs[`original-${subject}-reference-v1`].version } };
    families[family_id] = { state: 'active', version: 1, subject, kind: 'original_practice', note: 'fresh qualification case (never publishable)' };
    const reg = { ...registry, families: { ...registry.families, ...families } };
    const local = [...structureVerdict(candidate).reasons, ...presentationLint(candidate), ...provenanceReasons(candidate, reg)];
    for (const r of refs) { const s = registry.sources[r.id]; if (s?.state !== 'active' || s.supports?.[r.locator] !== r.support_hash || hashJSON(s.facts?.[r.locator]?.text) !== r.support_hash) local.push(`source_custody:${r.id}`); }
    if (item.expected_valid && local.length) failures.push({ id, local });
    fixtures.push({ id, subject, chapter: c.chapter, expected_valid: item.expected_valid === true, category: item.expected_valid ? 'valid_control' : item.defect_category,
      defect_evidence: item.defect_evidence || null, candidate, content_hash: contentHash(candidate), local_findings: local });
  }
}
if (failures.length) throw new Error(`positive_fixture_local_failures_before_spend:${JSON.stringify(failures)}`);
const valid = fixtures.filter(f => f.expected_valid), defects = fixtures.filter(f => !f.expected_valid);
for (const s of SUBJECTS) if (!valid.some(f => f.subject === s)) throw new Error(`four_subject_valid_coverage_required:${s}`);
mkdirSync(studyDir, { recursive: true });
const frozen = { id: studyId, created_at: new Date().toISOString(), verifier_contract: process.env.STUDY_CONTRACT || null,
  denominator: fixtures.length, valid_roots: valid.length, controlled_defects: defects.length, payload_hash: hashJSON(fixtures), fixtures,
  decision_rule: 'zero eligible controlled defects; valid eligible >= 85% pooled and >= 70% in each subject; every unfinished/error case counts as not eligible; a defect that is unfinished blocks a pass',
  publication: 'never', construction: 'independent Claude Sonnet authors (medium effort) + separate blind Claude custody with keys hidden; root adjudication of disagreements before freeze; no validator has seen any case',
  exclusions: adjudication.exclusions || [] };
writeFileSync(join(studyDir, 'frozen.json'), JSON.stringify(frozen, null, 1));
writeFileSync(join(studyDir, 'scratch-registry-overlay.json'), JSON.stringify({ families }, null, 1));
console.log(JSON.stringify({ denominator: frozen.denominator, valid: valid.length, defects: defects.length, by_subject: Object.fromEntries(SUBJECTS.map(s => [s, `${valid.filter(f => f.subject === s).length}v/${defects.filter(f => f.subject === s).length}d`])), payload_hash: frozen.payload_hash }, null, 1));
