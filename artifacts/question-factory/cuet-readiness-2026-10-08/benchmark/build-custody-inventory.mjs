import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { CANONICAL_SYLLABUS } from '../../../../data/canonical_syllabus.js';

const root = resolve('.');
const output = resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/source-inventory.json');
const subjects = ['english', 'accountancy', 'business_studies', 'economics'];
const registry = JSON.parse(readFileSync(resolve('data/source_registry.json'), 'utf8'));
const priorExemplarIds = new Set(registry.calibration_anchor_ids ?? []);
const syllabusBySubject = new Map(CANONICAL_SYLLABUS.map((subject) => [subject.subject_id, subject]));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const entries = [];
const sourceFamilies = new Map();
const summary = {};

for (const subject of subjects) {
  const packPath = resolve(`data/question-factory-runtime/${subject}-authenticated-pack.json`);
  const rawPack = readFileSync(packPath);
  const pack = JSON.parse(rawPack.toString('utf8'));
  const paper = pack.documents.find((doc) => doc.kind === 'paper');
  const key = pack.documents.find((doc) => doc.kind === 'final_key');
  const syllabus = pack.documents.find((doc) => doc.kind === 'syllabus');
  if (!paper || !key || !syllabus || pack.exam_spec?.state !== 'verified') {
    throw new Error(`Incomplete verified pack: ${subject}`);
  }
  const paperSource = registry.sources[paper.id];
  const keySource = registry.sources[key.id];
  const syllabusSource = registry.sources[syllabus.id];
  const familyId = `${pack.exam_spec.pattern_version}:${subject}:bookA`;
  sourceFamilies.set(familyId, { subject, paperSourceId: paper.id, finalKeySourceId: key.id });
  const syllabusMap = syllabusBySubject.get(subject);
  const eligibleChapters = new Set((syllabusMap?.units ?? []).flatMap((unit) => unit.chapters));
  let syllabusChapterMatch = 0;
  let exposed = 0;
  for (const anchor of pack.anchors) {
    const chapter = anchor.chapter ?? '';
    const inSyllabusMap = eligibleChapters.has(chapter);
    if (inSyllabusMap) syllabusChapterMatch += 1;
    const seenAsCalibrationExemplar = priorExemplarIds.has(anchor.id);
    if (seenAsCalibrationExemplar) exposed += 1;
    if (anchor.final_key_matched !== true || !anchor.correct_answer || !Array.isArray(anchor.options) || anchor.options.length !== 4) {
      throw new Error(`Anchor lacks exact-key/four-option evidence: ${anchor.id}`);
    }
    if (!anchor.source_refs?.some((ref) => ref.id === paper.id && ref.locator === anchor.paper_locator)) {
      throw new Error(`Missing exact paper reference: ${anchor.id}`);
    }
    entries.push({
      id: anchor.id,
      subject,
      chapter,
      question_type: anchor.question_type,
      source_difficulty_label: anchor.difficulty ?? null,
      source_difficulty_independently_assessed: anchor.difficulty_assessed === true,
      source_family_id: familyId,
      paper_source_id: paper.id,
      final_key_source_id: key.id,
      official_key_matched: true,
      official_question_locator: anchor.paper_locator,
      official_key_locator: anchor.key_locator,
      current_syllabus_pack_version: pack.version,
      current_syllabus_source_id: syllabus.id,
      syllabus_chapter_map_match: inSyllabusMap,
      prior_calibration_exemplar: seenAsCalibrationExemplar,
      source_record_sha256: sha256(JSON.stringify(anchor)),
    });
  }
  summary[subject] = {
    pack_id: pack.id,
    pack_version: pack.version,
    total_single_key_anchors: pack.anchors.length,
    prior_calibration_exemplars: exposed,
    non_exemplar_anchors: pack.anchors.length - exposed,
    current_syllabus_chapter_map_matches: syllabusChapterMatch,
    distinct_paper_families: 1,
    paper: {
      id: paper.id,
      url: paper.url,
      local_path: paper.file,
      local_sha256: sha256(readFileSync(resolve('data/question-factory-runtime', paper.file))),
      authentication_state: paperSource?.authentication?.type ?? 'pack-recorded-corroboration',
      publisher_group: paperSource?.publisher_group ?? null,
      reuse_permitted_in_pack: paper.reuse_permitted === true,
      permission_independently_verified: paper.permission?.independently_verified_licence === true,
    },
    final_key: {
      id: key.id,
      url: key.url,
      local_path: key.file,
      local_sha256: sha256(readFileSync(resolve('data/question-factory-runtime', key.file))),
      official_source_state: keySource?.state ?? 'pack-recorded-official-nta-final-key',
    },
    current_syllabus: {
      id: syllabus.id,
      url: syllabus.url,
      local_path: syllabus.file,
      local_sha256: sha256(readFileSync(resolve('data/question-factory-runtime', syllabus.file))),
      syllabus_version: pack.exam_spec.syllabus_version,
      source_state: syllabusSource?.state ?? 'pack-recorded-official-syllabus',
    },
  };
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({
  generated_at: '2026-10-08',
  purpose: 'Custody inventory only; contains no question text or answer values.',
  candidate_status: 'CUSTODY_LOCKED; see CUSTODY-DESIGN.md. This inventory contains no question text or answer values.',
  registry_version: registry.version,
  counts: {
    unique_question_records: entries.length,
    source_families: sourceFamilies.size,
    prior_calibration_exemplars: entries.filter((item) => item.prior_calibration_exemplar).length,
    non_exemplar_question_records: entries.filter((item) => !item.prior_calibration_exemplar).length,
    current_syllabus_chapter_map_matches: entries.filter((item) => item.syllabus_chapter_map_match).length,
  },
  subjects: summary,
  source_families: [...sourceFamilies.entries()].map(([id, value]) => ({ id, ...value })),
  candidate_records: entries,
}, null, 2));
console.log(JSON.stringify({ output, ...JSON.parse(readFileSync(output, 'utf8')).counts }, null, 2));
