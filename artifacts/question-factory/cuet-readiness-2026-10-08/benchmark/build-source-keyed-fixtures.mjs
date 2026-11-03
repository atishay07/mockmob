import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_SYLLABUS } from '../../../../data/canonical_syllabus.js';

const registry = JSON.parse(readFileSync(resolve('data/source_registry.json'), 'utf8'));
const packs = Object.fromEntries(['english', 'accountancy', 'business_studies', 'economics'].map((subject) => [
  subject,
  JSON.parse(readFileSync(resolve(`data/question-factory-runtime/${subject}-authenticated-pack.json`), 'utf8')),
]));
const packAnchors = new Map(Object.values(packs).flatMap((pack) => pack.anchors.map((anchor) => [anchor.id, anchor])));
const output = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/source-keyed-fixtures.json');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const registryExemplars = new Set(registry.calibration_anchor_ids ?? []);
const canonicalSubjects = new Map(CANONICAL_SYLLABUS.map((subject) => [subject.subject_id, subject]));
const fixtures = [];
const partitionCounts = {};

for (const anchor of registry.examples) {
  if (!packAnchors.has(anchor.id)) continue;
  const packAnchor = packAnchors.get(anchor.id);
  const pack = packs[anchor.subject];
  const paper = pack.documents.find((doc) => doc.kind === 'paper');
  const key = pack.documents.find((doc) => doc.kind === 'final_key');
  const syllabus = pack.documents.find((doc) => doc.kind === 'syllabus');
  const syllabusChapters = new Set((canonicalSubjects.get(anchor.subject)?.units ?? []).flatMap((unit) => unit.chapters));
  const syllabusChapterMatch = syllabusChapters.has(anchor.chapter);
  if (!syllabusChapterMatch) throw new Error(`Anchor is outside current syllabus map: ${anchor.id}`);
  if (pack.exam_spec?.state !== 'verified' || !paper || !key || !syllabus || paper.reuse_permitted !== true) throw new Error(`Source pack is not verified/permitted for internal use: ${anchor.id}`);
  if (anchor.final_key_matched !== true || packAnchor.final_key_matched !== true || !/^[ABCD]$/.test(anchor.correct_answer ?? '') || anchor.options?.length !== 4) throw new Error(`Anchor does not have a unique four-option official-key match: ${anchor.id}`);
  const syllabusRef = { id: syllabus.id, version: syllabus.version, locator: 'full-syllabus', support_hash: registry.sources[syllabus.id].supports['full-syllabus'] };
  const keySource = registry.sources[key.id];
  const keyLocator = anchor.key_locator;
  const keyRef = { id: key.id, version: key.version, locator: keyLocator, support_hash: keySource.supports[keyLocator] };
  const refs = [...(anchor.source_refs ?? [])];
  if (!refs.some((ref) => ref.id === syllabus.id)) refs.push(syllabusRef);
  if (!refs.some((ref) => ref.id === key.id)) refs.push(keyRef);

  const priorExemplar = registryExemplars.has(anchor.id);
  const partition = priorExemplar
    ? 'existing_regression'
    : ['business_studies', 'economics'].includes(anchor.subject)
      ? 'limited_heldout'
      : 'reserved_nonexemplar';
  const spec = registry.exam_specs[anchor.subject];
  const candidate = {
    id: `cuet-readiness-${anchor.id}`,
    subject: anchor.subject,
    chapter: anchor.chapter,
    body: anchor.body,
    options: anchor.options,
    correct_answer: anchor.correct_answer,
    explanation: anchor.explanation ?? '',
    route: anchor.route,
    difficulty: anchor.difficulty || 'medium',
    question_type: anchor.question_type,
    passage_text: anchor.passage_text || '',
    family_id: anchor.family_id || `pyq:${anchor.id}`,
    source_refs: refs,
    concept_id: anchor.concept_id ?? null,
    provenance: {
      ...anchor.provenance,
      kind: 'authentic_pyq',
      anchor_id: anchor.id,
      adaptation_family: anchor.family_id || `pyq:${anchor.id}`,
      adaptation_type: null,
      syllabus_version: spec.syllabus_version,
      pattern_version: spec.pattern_version,
      source_pack_id: anchor.source_pack_id || pack.id,
      source_pack_version: anchor.source_pack_version || pack.version,
    },
  };
  fixtures.push({
    id: `v4-${partition}-${anchor.id}`,
    group: 'authentic_pyq',
    category: 'authentic_pyq',
    expected_valid: true,
    case_partition: partition,
    source_family_id: `${pack.exam_spec.pattern_version}:${anchor.subject}:bookA`,
    anchor_id: anchor.id,
    candidate,
    oracle: {
      key: anchor.correct_answer,
      basis: 'Matched to the official NTA final OMR key for this paper/booklet; subject entitlement is in the cited official 2026 syllabus.',
      source_refs: refs.filter((ref) => ref.id === paper.id || ref.id === key.id || ref.id === syllabus.id),
      anchor_id: anchor.id,
      cuet_fit: 'authentic_cuet_pyq',
    },
    custody: {
      prior_calibration_exemplar: priorExemplar,
      key_match: packAnchor.final_key_matched === true && anchor.final_key_matched === true,
      syllabus_chapter_map_match: syllabusChapterMatch,
      record_sha256: hash(JSON.stringify(anchor)),
      scope: 'Authentic format/key/entitlement reference. Explanation support is only complete when explanation_source_matched is true; this is not an automatic full-pipeline pass label.',
    },
  });
  partitionCounts[partition] = (partitionCounts[partition] ?? 0) + 1;
}

const payload = {
  id: 'cuet-readiness-source-keyed-v4-2026-10-08',
  created_at: '2026-10-08',
  registry_version: registry.version,
  frozen: true,
  benchmark_scope: 'CUET format, official key, and syllabus entitlement references; no new independent release qualification.',
  additions: { sources: {} },
  partition_counts: partitionCounts,
  unique_source_keyed_question_families: new Set(fixtures.map((fixture) => fixture.anchor_id)).size,
  distinct_paper_source_families: new Set(fixtures.map((fixture) => fixture.source_family_id)).size,
  non_exemplar_limited_holdout_count: fixtures.filter((fixture) => fixture.case_partition === 'limited_heldout' && !fixture.custody.prior_calibration_exemplar).length,
  source_keyed_question_count: fixtures.length,
  fixture_count: fixtures.length,
  control_cases_in_this_file: 0,
  note: 'All 173 records are unique question roots but only four exam-paper source families. Existing 2024 sources are not new/fresh merely because their fixture IDs are versioned v4. The 42 limited-heldout records are two-subject, non-exemplar evaluation only. Controlled-defect variants are deliberately separate and are not included in these counts.',
  fixtures,
};
writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ output, ...Object.fromEntries(Object.entries(payload).filter(([key]) => key.endsWith('_count') || key.endsWith('_families'))), partition_counts: partitionCounts, sha256: hash(readFileSync(output)) }, null, 2));
