import test from 'node:test';
import assert from 'node:assert/strict';
import { selectNtaQuestionSet, NTA_QUESTION_COUNT } from '../nta_question_selector.js';
import { NTA_PATTERNS, apportion, longestPassageRun, ntaPatternFor } from '../nta_paper_pattern.js';
import { CUET_ALLOWED_SUBJECTS, toInternalSubjectId } from '../cuet_controls.js';
import { getCanonicalChapters } from '../canonical_syllabus.js';

// Software fixtures for paper layout only; they say nothing about academic quality.
const PASSAGE = [
  'A city library changed its reading programme after noticing that students borrowed many books but rarely discussed them.',
  'Instead of measuring success by the number of issued books, the library began asking students to write short notes about one useful idea from each book.',
  'The change helped teachers see whether reading was becoming thoughtful rather than mechanical.',
  'It also encouraged students to connect what they read with classroom questions and daily observations.',
  'The passage shows that a useful educational reform often changes the quality of student response, not just the amount of activity recorded.',
].join(' ');

let serial = 0;
function item(subject, chapter, overrides = {}) {
  serial += 1;
  const n = serial;
  return {
    id: `q${n}`,
    subject,
    chapter,
    body: `Fixture question ${n} for ${chapter}: which option is the precise one in this formal sentence?`,
    options: [
      { key: 'A', text: `Careless choice ${n}` },
      { key: 'B', text: `Precise choice ${n}` },
      { key: 'C', text: `Temporary choice ${n}` },
      { key: 'D', text: `Ordinary choice ${n}` },
    ],
    correct_answer: 'B',
    explanation: `The correct answer is B because precise choice ${n} matches the meaning asked for.`,
    difficulty: 'medium',
    status: 'live',
    verification_state: 'verified',
    quality_score: 0.86,
    anchor_tier: 1,
    pyq_anchor_id: `pyq_${n}`,
    question_type: 'direct_concept',
    concept_id: `${subject}::${n}`,
    ...overrides,
  };
}

function passageSet(subject, groupId, size, chapter) {
  return Array.from({ length: size }, (_, index) => item(subject, chapter, {
    id: `${groupId}_${index + 1}`,
    body: `According to the passage in ${groupId}, which statement is supported by detail ${index + 1}?`,
    question_type: 'reading_comprehension',
    passage_group_id: groupId,
    passage_text: PASSAGE,
    order_index: index + 1,
  }));
}

const ENGLISH_VERBAL = [['Vocabulary', 'vocabulary'], ['Correct Word Usage', 'correct_word_usage'], ['Para Jumbles', 'para_jumble'], ['Match the Following', 'match_the_following']];

function englishBank({ perVerbal = 20, sets = [[5, 'Factual Passage'], [5, 'Narrative Passage'], [5, 'Literary Passage'], [4, 'Factual Passage']] } = {}) {
  const rows = [];
  for (const [chapter, type] of ENGLISH_VERBAL) for (let i = 0; i < perVerbal; i += 1) rows.push(item('english', chapter, { question_type: type }));
  sets.forEach(([size, chapter], index) => rows.push(...passageSet('english', `set${index}`, size, chapter)));
  return rows;
}

function domainBank(subject, perChapter = 6) {
  return getCanonicalChapters(subject).flatMap((chapter) => Array.from({ length: perChapter }, () => item(subject, chapter)));
}

function blocks(rows) {
  const out = [];
  for (const row of rows) {
    const key = row.passage_text ? `p:${row.passage_group_id}` : `s:${row.chapter}`;
    if (out.at(-1)?.key === key) out.at(-1).rows.push(row);
    else out.push({ key, passage: Boolean(row.passage_text), chapter: row.chapter, rows: [row] });
  }
  return out;
}

function assertEnglishPattern(rows, diagnostics) {
  const rules = NTA_PATTERNS.english.passages;
  assert.equal(rows.length, NTA_QUESTION_COUNT);
  const layout = blocks(rows);
  const passageBlocks = layout.filter((block) => block.passage);
  const passageQuestions = passageBlocks.reduce((sum, block) => sum + block.rows.length, 0);
  // Reading comprehension: whole sets, in the official range, never one long run.
  assert.ok(passageBlocks.length >= rules.minSets && passageBlocks.length <= rules.maxSets, `sets ${passageBlocks.length}`);
  assert.ok(passageQuestions >= rules.minQuestions && passageQuestions <= rules.maxQuestions, `passage questions ${passageQuestions}`);
  assert.equal(new Set(passageBlocks.map((block) => block.key)).size, passageBlocks.length, 'each set appears once, together');
  for (const block of passageBlocks) {
    assert.ok(block.rows.length >= rules.minSetSize && block.rows.length <= rules.maxSetSize);
    assert.deepEqual(block.rows.map((row) => row.order_index), block.rows.map((_, index) => index + 1), 'set order kept');
  }
  assert.ok(longestPassageRun(rows) <= rules.maxSetSize, `longest passage run ${longestPassageRun(rows)}`);
  assert.equal(layout[0].passage, false, 'paper opens with verbal ability, not a passage');
  for (let index = 1; index < layout.length; index += 1) assert.ok(!(layout[index].passage && layout[index - 1].passage), 'no two passage sets back to back');
  // Verbal ability: each section present, in order, within its share.
  const verbalOrder = layout.filter((block) => !block.passage).map((block) => block.chapter);
  assert.deepEqual(verbalOrder, ENGLISH_VERBAL.map(([chapter]) => chapter));
  for (const section of diagnostics.pattern.sections.slice(1)) assert.ok(section.selected <= section.cap, `${section.id} over its cap`);
}

test('apportion splits a total by weight and always sums to it', () => {
  assert.deepEqual(apportion(35, [12, 9, 7, 7]), [12, 9, 7, 7]);
  for (const total of [0, 1, 17, 30, 42, 50]) assert.equal(apportion(total, [12, 9, 7, 7]).reduce((a, b) => a + b, 0), total);
});

test('every supported subject assembles a 50-question paper in its CUET pattern', () => {
  for (const publicId of CUET_ALLOWED_SUBJECTS) {
    const subject = toInternalSubjectId(publicId);
    const pool = subject === 'english' ? englishBank() : domainBank(subject);
    const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: subject, seed: `pattern:${subject}` });
    assert.equal(selectedRows.length, NTA_QUESTION_COUNT, subject);
    assert.equal(diagnostics.canBuild50, true, subject);
    assert.equal(diagnostics.pattern.shortfall, null, subject);
    if (subject === 'english') { assertEnglishPattern(selectedRows, diagnostics); continue; }

    // Domain papers cover the syllabus evenly and follow its chapter order.
    const chapters = getCanonicalChapters(subject);
    const counts = new Map();
    for (const row of selectedRows) counts.set(row.chapter, (counts.get(row.chapter) || 0) + 1);
    const expectedCovered = Math.min(chapters.length, NTA_QUESTION_COUNT);
    assert.equal(counts.size, expectedCovered, `${subject} chapters covered`);
    const values = [...counts.values()];
    assert.ok(Math.max(...values) - Math.min(...values) <= 1, `${subject} spread ${values}`);
    const order = selectedRows.map((row) => chapters.indexOf(row.chapter));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${subject} follows syllabus order`);
    assert.equal(diagnostics.pattern.longestPassageRun, 0);
  }
});

test('English with a production-like passage glut keeps reading comprehension to its share', () => {
  // The 13 Oct production bank: many small sets and fragments that once filled questions 1-32.
  const sizes = [3, 3, 5, 4, 3, 2, 2, 2, 1, 2, 2, 1, 2];
  const kinds = ['Literary Passage', 'Factual Passage', 'Narrative Passage'];
  const pool = englishBank({ sets: sizes.map((size, index) => [size, kinds[index % 3]]) });
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'glut' });
  assertEnglishPattern(selectedRows, diagnostics);
  assert.ok(diagnostics.pattern.notes.fragments >= 8, 'sets under three questions are not used as passages');
  assert.ok(diagnostics.passageQuestionsIncluded <= NTA_PATTERNS.english.passages.maxQuestions);
});

test('English never pads a paper with one question type', () => {
  const pool = Array.from({ length: 80 }, () => item('english', 'Vocabulary', { question_type: 'vocabulary' }));
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'vocab-only' });
  assert.ok(selectedRows.length < NTA_QUESTION_COUNT);
  assert.equal(diagnostics.canBuild50, false);
  assert.equal(diagnostics.pattern.shortfall, 'not_enough_complete_passage_sets');
  assert.match(diagnostics.message, /complete reading passages/);
  const vocabulary = diagnostics.pattern.sections.find((section) => section.id === 'vocabulary');
  assert.ok(vocabulary.selected <= vocabulary.cap);
});

test('English short of verbal items degrades with a clear reason instead of more passages', () => {
  const pool = englishBank({ perVerbal: 5 });
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'thin-verbal' });
  assert.ok(selectedRows.length < NTA_QUESTION_COUNT);
  assert.equal(diagnostics.pattern.shortfall, 'not_enough_verbal_ability_questions');
  assert.ok(diagnostics.passageQuestionsIncluded <= NTA_PATTERNS.english.passages.maxQuestions);
  assert.match(diagnostics.message, /50 are required/);
});

test('a thin domain bank degrades honestly', () => {
  const pool = domainBank('accountancy', 2);
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'accountancy', seed: 'thin' });
  assert.equal(selectedRows.length, pool.length);
  assert.equal(diagnostics.canBuild50, false);
  assert.equal(diagnostics.pattern.shortfall, 'not_enough_questions');
});

test('domain papers keep case or passage sets whole and limited', () => {
  const pool = [...domainBank('economics'), ...passageSet('economics', 'caseA', 4, 'Money & Banking'), ...passageSet('economics', 'caseB', 4, 'Rural Development'), ...passageSet('economics', 'caseC', 4, 'Employment')]
    .map((row) => (row.passage_group_id ? { ...row, score: 5 } : row));
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'economics', seed: 'cases' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  const sets = new Set(selectedRows.filter((row) => row.passage_group_id?.startsWith('case')).map((row) => row.passage_group_id));
  assert.ok(sets.size <= ntaPatternFor('economics').maxPassageSets);
  for (const set of sets) assert.equal(selectedRows.filter((row) => row.passage_group_id === set).length, 4);
  assert.ok(diagnostics.pattern.longestPassageRun <= 8);
});
