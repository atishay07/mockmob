import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { hashJSON } from '../../../../../data/question_factory_policy.mjs';

// Translate the frozen academic fixture into the canonical factory-validator
// shape. This writes only a benchmark-local adapter artifact and never calls a
// provider or mutates data/source_registry.json.
const root = path.resolve('artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4');
const registry = JSON.parse(fs.readFileSync('data/source_registry.json', 'utf8'));
const freeze = JSON.parse(fs.readFileSync(path.join(root, 'freeze.json'), 'utf8'));
const development = JSON.parse(fs.readFileSync(path.join(root, 'development/cases.json'), 'utf8'));
const release = JSON.parse(fs.readFileSync(path.join(root, 'release-sealed/cases.json'), 'utf8'));
const { payloadHash } = await import(pathToFileURL(path.join(process.cwd(), 'scripts/pipeline/lib/cuetFitBenchmark.mjs')).href);
const { structureVerdict } = await import(pathToFileURL(path.join(process.cwd(), 'scripts/pipeline/lib/evidencePipeline.mjs')).href);
const { provenanceReasons } = await import(pathToFileURL(path.join(process.cwd(), 'data/question_factory_policy.mjs')).href);
const syllabusIds = {
  english: 'cuet2026-english-syllabus', accountancy: 'cuet2026-accountancy-syllabus',
  business_studies: 'cuet2026-business_studies-syllabus', economics: 'cuet2026-economics-syllabus',
};
const rootChapters = {
  EN: ['Factual Passage','Narrative Passage','Factual Passage','Narrative Passage','Factual Passage','Factual Passage','Factual Passage','Narrative Passage','Literary Passage','Factual Passage'],
  AC: ['Partnership Fundamentals','Partnership Fundamentals','Partnership Fundamentals','Partnership Fundamentals','Partnership Fundamentals','Partnership Fundamentals','Partnership Fundamentals','Profit & Loss Appropriation Account','Partnership Fundamentals','Partnership Fundamentals'],
  BS: Array(10).fill('Staffing'),
  EC: ['Employment','Employment','Employment','Employment','Employment','Human Capital Formation','Human Capital Formation','Rural Development','Environment & Sustainable Development','Environment & Sustainable Development'],
};
const sourcePackId = subject => `verified-rule-v4-${subject}-benchmark`;
const scratch = { sources: {}, families: {}, packs: {} };
const createdSources = new Set();

function sourceRef(sourceId, locator, authoredSource = null) {
  let source = registry.sources[sourceId] || scratch.sources[sourceId];
  if (!source && authoredSource) {
    source = {
      id: sourceId, kind: 'reference', state: 'active', version: 1,
      chapters: ['Factual Passage','Narrative Passage','Literary Passage'],
      url: `local://mockmob/verified-rule-v4/${sourceId}`, title: 'Original passage written for verified-rule-v4',
      identity_sha256: authoredSource.identitySha256, extraction_sha256: authoredSource.extractionSha256,
      extraction_checked: true, reuse_permitted: true,
      permission: { basis: 'Original stimulus authored for this benchmark; not an external passage.', reference: 'verified-rule-v4 freeze certificate' },
      facts: {},
      supports: {},
      source_pack_id: sourcePackId('english'),
    };
  }
  assert(source, `missing_source:${sourceId}`);
  if (authoredSource) {
    source.facts[locator] = { text: authoredSource.exactExcerpt };
    source.supports[locator] = hashJSON(authoredSource.exactExcerpt);
  }
  const support = source.supports?.[locator];
  assert(support, `missing_registered_support:${sourceId}:${locator}`);
  assert.equal(source.facts?.[locator]?.text, authoredSource?.exactExcerpt ?? source.facts?.[locator]?.text, `source_text_mismatch:${sourceId}:${locator}`);
  scratch.sources[sourceId] = structuredClone(source);
  createdSources.add(sourceId);
  return { id: sourceId, version: source.version, locator, support_hash: support };
}

function chapterFor(c) {
  if (c.rootFamily.startsWith('AC-EX-')) return 'Dissolution of Partnership Firm';
  if (c.rootFamily.startsWith('AC-NUM-')) return 'Partnership Fundamentals';
  if (c.rootFamily.startsWith('AC-COND-')) return 'Partnership Fundamentals';
  const match = c.rootFamily.match(/^(EN|AC|BS|EC)-(\d{2})$/);
  assert(match, `unmapped_root:${c.rootFamily}`);
  return rootChapters[match[1]][Number(match[2]) - 1];
}

const allCases = [...development, ...release];
const fixtures = allCases.map(c => {
  const { source, syllabus } = c.certificate;
  const sourceId = source.id;
  const isOriginalEnglish = source.type === 'benchmark-authored stimulus';
  const contentRef = sourceRef(sourceId, source.locator, isOriginalEnglish ? source : null);
  const syllabusSource = registry.sources[syllabus.sourceId];
  assert(syllabusSource, `missing_syllabus_source:${syllabus.sourceId}`);
  const syllabusRef = sourceRef(syllabus.sourceId, 'full-syllabus');
  const sourceRefs = [contentRef, syllabusRef];
  const familyId = `v4-family-${c.rootFamily}`;
  const packId = sourcePackId(c.subject);
  const examSpec = registry.exam_specs[c.subject];
  assert.equal(examSpec?.state, 'verified', `unverified_exam_spec:${c.subject}`);
  scratch.families[familyId] = { state: 'active', version: 1, source_pack_id: packId, kind: 'original_practice' };
  const docs = [...new Set(sourceRefs.map(r => r.id))];
  scratch.packs[packId] = { id: packId, subject: c.subject, version: 1, state: 'active', document_ids: docs, benchmark_only: true };

  const orderedOptions = c.question.options.map((option, index) => ({ key: 'ABCD'[index], text: option.text }));
  const hasPassage = Boolean(c.question.passage);
  const numeric = c.defectCategory === 'numeric_error' || c.defectCategory === 'syllabus_mismatch' && c.rootFamily.startsWith('AC-EX-') || c.rootFamily.startsWith('AC-NUM-');
  const matching = ['AC-07','BS-08'].includes(c.rootFamily);
  const candidateId = c.benchmarkId;
  // The one under-specified case has no authored key. A is retained as the
  // candidate's tentative selection so the validator receives a valid factory
  // candidate; its oracle remains explicitly indeterminate and never leaks to
  // blindView.
  const proposedKey = c.question.proposedKey || (c.defectCategory === 'missing_decisive_condition' ? 'A' : null);
  assert.match(proposedKey || '', /^[ABCD]$/, `candidate_key_missing:${candidateId}`);
  const chapter = chapterFor(c);
  const questionType = hasPassage ? 'passage_based' : numeric ? 'numerical_calculation' : matching ? 'matching' : 'conceptual_mcq';
  const route = hasPassage ? 'passage' : numeric ? 'numerical' : 'conceptual';
  const candidate = {
    id: candidateId,
    subject: c.subject,
    chapter,
    body: c.question.stem,
    options: orderedOptions.map(o => o.text),
    correct_answer: proposedKey,
    explanation: c.question.explanation,
    route,
    difficulty: numeric || matching ? 'medium' : 'easy',
    question_type: questionType,
    passage_text: c.question.passage || '',
    family_id: familyId,
    source_refs: sourceRefs,
    concept_id: c.rootFamily,
    provenance: {
      kind: 'original_practice', anchor_id: null, adaptation_family: familyId, adaptation_type: null,
      syllabus_version: examSpec.syllabus_version, pattern_version: examSpec.pattern_version,
      source_pack_id: packId, source_pack_version: 1,
    },
  };
  const oracleKey = c.certificate.groundTruthKey;
  const oracle = {
    key: oracleKey == null ? 'none_or_indeterminate' : Array.isArray(oracleKey) ? oracleKey.join('|') : oracleKey,
    basis: c.certificate.derivation,
    source_refs: sourceRefs,
    decisive_assumptions: c.certificate.decisiveAssumptions || [],
  };
  return {
    id: candidateId,
    partition: c.partition,
    group: c.label === 'valid' ? 'authored_valid' : 'controlled_defect',
    category: c.label === 'valid' ? 'valid' : c.defectCategory,
    expected_valid: c.label === 'valid',
    candidate,
    oracle,
  };
});

assert.equal(fixtures.length, freeze.cases, 'adapter fixture count matches frozen labels');
assert.equal(new Set(fixtures.map(f => f.id)).size, fixtures.length, 'adapter fixture IDs unique');
assert.equal(fixtures.filter(f => f.group === 'authored_valid').length, 40, '40 source-certified valid roots');
assert.equal(fixtures.filter(f => f.group === 'controlled_defect').length, 154, 'controlled defects remain denominator-visible');
for (const fixture of fixtures) {
  assert(!('oracle' in fixture.candidate), `oracle_leak:${fixture.id}`);
  assert.equal(fixture.candidate.options.length, 4, `four options:${fixture.id}`);
  assert.match(fixture.candidate.correct_answer, /^[ABCD]$/, `candidate key:${fixture.id}`);
  for (const ref of fixture.candidate.source_refs) {
    const s = scratch.sources[ref.id];
    assert.equal(s?.supports?.[ref.locator], ref.support_hash, `support binding:${fixture.id}:${ref.id}:${ref.locator}:${JSON.stringify(Object.keys(s?.supports || {}))}`);
  }
  const structural = structureVerdict(fixture.candidate);
  const provenance = provenanceReasons(fixture.candidate, {
    ...registry,
    sources: { ...registry.sources, ...scratch.sources },
    families: { ...registry.families, ...scratch.families },
    packs: { ...registry.packs, ...scratch.packs },
  });
  const allowedStructural = fixture.category === 'overlapping_options' ? ['option_collision'] : [];
  assert(structural.reasons.every(reason => allowedStructural.includes(reason)), `unexpected local structure rejection:${fixture.id}:${structural.reasons.join(',')}`);
  assert.deepEqual(provenance, [], `provenance must be locally valid:${fixture.id}`);
}

const hash = hashJSON(fixtures.map(f => ({ id: f.id, group: f.group, category: f.category, expected_valid: f.expected_valid, candidate: f.candidate, oracle: f.oracle })));
const computedHelperHash = payloadHash(fixtures);
assert.equal(hash, computedHelperHash, 'payload hash uses canonical helper selection');
const frozen = {
  adapter_version: 'pipeline-view-v2',
  id: 'verified-rule-v4-cuet-readiness-diagnostic-2026-10-08',
  registry_version: registry.version,
  frozen: true,
  payload_hash: computedHelperHash,
  contract_binding: freeze.contract_binding,
  verifier_version: freeze.verifier_version,
  release_eligibility: freeze.release_eligibility,
  fixture_count: fixtures.length,
  valid_root_count: 40,
  root_family_count: 45,
  note: 'Diagnostic academic set only: 45 roots, controlled variants are not independent; same designer contributed to validator design; independent key review and model judgment have not occurred.',
};
const output = { frozen, additions: scratch, fixtures };
fs.writeFileSync(path.join(root, 'pipeline-view.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ result: 'PASS', output: 'pipeline-view.json', fixtures: fixtures.length, valid: 40, controlledDefects: 154, roots: 45, scratch: { sources: Object.keys(scratch.sources).length, families: Object.keys(scratch.families).length, packs: Object.keys(scratch.packs).length }, payload_hash: computedHelperHash, scope: frozen.release_eligibility.scope, noProviderCalls: true }, null, 2));
