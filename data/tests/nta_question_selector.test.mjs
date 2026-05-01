import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NTA_DURATION_MINUTES,
  NTA_QUESTION_COUNT,
  qualityGateNtaQuestion,
  selectNtaQuestionSet,
} from '../nta_question_selector.js';
import { getMode, resolveCount, resolveDurationSec } from '../test_modes.js';

const passageText = [
  'A city library changed its reading programme after noticing that students borrowed many books but rarely discussed them.',
  'Instead of measuring success by the number of issued books, the library began asking students to write short notes about one useful idea from each book.',
  'The change helped teachers see whether reading was becoming thoughtful rather than mechanical.',
  'It also encouraged students to connect what they read with classroom questions and daily observations.',
  'The passage shows that a useful educational reform often changes the quality of student response, not just the amount of activity recorded.',
].join(' ');

function validQuestion(index = 1, overrides = {}) {
  return {
    id: overrides.id || `q_${index}`,
    subject: 'english',
    chapter: overrides.chapter === undefined ? 'Vocabulary' : overrides.chapter,
    body: overrides.body || `Choose the word closest in meaning to "meticulous" in formal sentence number ${index}.`,
    options: overrides.options || [
      { key: 'A', text: `Careless ${index}` },
      { key: 'B', text: `Precise ${index}` },
      { key: 'C', text: `Temporary ${index}` },
      { key: 'D', text: `Ordinary ${index}` },
    ],
    correct_answer: overrides.correct_answer ?? 'B',
    explanation: overrides.explanation ?? 'Meticulous means showing great attention to detail, so precise is the closest option.',
    difficulty: overrides.difficulty ?? 'medium',
    status: overrides.status ?? 'live',
    verification_state: overrides.verification_state ?? 'verified',
    exploration_state: overrides.exploration_state ?? 'active',
    quality_band: overrides.quality_band ?? 'strong',
    quality_score: overrides.quality_score ?? 0.86,
    ai_tier: overrides.ai_tier ?? 'A',
    pyq_anchor_id: overrides.pyq_anchor_id ?? `pyq_english_vocab_${index}`,
    anchor_tier: overrides.anchor_tier ?? 1,
    question_type: overrides.question_type ?? 'vocabulary',
    concept_id: overrides.concept_id ?? `english::vocabulary_${index}`,
    topic: overrides.topic ?? 'Verbal Ability',
    ...overrides,
  };
}

function validPassageQuestion(id, orderIndex, overrides = {}) {
  return validQuestion(orderIndex, {
    id,
    chapter: 'Factual Passage',
    body: `According to the passage, which statement is supported by detail ${orderIndex}?`,
    options: [
      { key: 'A', text: orderIndex === 1 ? 'The library measured only issued books.' : `Distractor A ${orderIndex}` },
      { key: 'B', text: orderIndex === 2 ? 'Students were asked to write short notes.' : `Distractor B ${orderIndex}` },
      { key: 'C', text: orderIndex === 3 ? 'Teachers could judge whether reading was thoughtful.' : `Distractor C ${orderIndex}` },
      { key: 'D', text: `Distractor D ${orderIndex}` },
    ],
    correct_answer: orderIndex === 1 ? 'A' : orderIndex === 2 ? 'B' : 'C',
    question_type: 'reading_comprehension',
    concept_id: 'english::factual_passage',
    topic: 'Reading Comprehension',
    passage_group_id: 'pg_library',
    passage_id: 'pg_library',
    passage_text: passageText,
    passage_title: 'Library Reading Programme',
    order_index: orderIndex,
    ...overrides,
  });
}

function standalonePool(count, start = 1, overrides = {}) {
  return Array.from({ length: count }, (_, index) => validQuestion(start + index, overrides));
}

test('NTA selector returns exactly 50 when 50+ usable questions exist', () => {
  const { selectedRows, diagnostics } = selectNtaQuestionSet(standalonePool(60), 25, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.poolStats.selected, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.canBuild50, true);
});

test('NTA selector does not fail because chapter is missing', () => {
  const pool = standalonePool(55, 1, { chapter: '' });
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.ok(diagnostics.poolStats.tier2 + diagnostics.poolStats.tier3 > 0);
});

test('NTA selector does not fail because quality metadata is missing', () => {
  const pool = standalonePool(55).map((row) => ({
    ...row,
    verification_state: undefined,
    exploration_state: undefined,
    quality_band: undefined,
    quality_score: undefined,
    anchor_tier: undefined,
    pyq_anchor_id: undefined,
  }));
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.poolStats.hardRejected, 0);
});

test('NTA selector rejects truly unusable questions', () => {
  const result = qualityGateNtaQuestion(validQuestion(1, {
    body: 'Question goes here',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: '',
  }), { subjectId: 'english' });

  assert.equal(result.accepted, false);
  assert.match(result.reasons.join(','), /placeholder_question|options_invalid|answer_missing_or_mismatch/);
});

test('NTA selector preserves passage group order', () => {
  const pool = [
    ...standalonePool(47, 10),
    validPassageQuestion('p3', 3),
    validPassageQuestion('p1', 1),
    validPassageQuestion('p2', 2),
  ];

  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.poolStats.passageGroupsSelected, 1);
  assert.deepEqual(selectedRows.slice(0, 3).map((row) => row.id), ['p1', 'p2', 'p3']);
});

test('NTA selector returns passage context for linked questions', () => {
  const inline = validPassageQuestion('inline_p1', 1, {
    passage_group_id: null,
    passage_id: null,
    passage_text: undefined,
    context: passageText,
  });

  const result = qualityGateNtaQuestion(inline, { subjectId: 'english' });
  assert.equal(result.accepted, true);
  assert.ok(result.row.passage_group_id.startsWith('inline:'));
  assert.equal(result.row.passage_text, passageText);
});

test('NTA mode forces 60-minute duration', () => {
  const mode = getMode('nta');
  assert.equal(resolveDurationSec(mode, []), NTA_DURATION_MINUTES * 60);
  assert.equal(resolveDurationSec(mode, standalonePool(10)), NTA_DURATION_MINUTES * 60);
});

test('NTA mode ignores requested count and returns 50', () => {
  const mode = getMode('nta');
  assert.equal(resolveCount(mode, 25), NTA_QUESTION_COUNT);
  const { selectedRows, diagnostics } = selectNtaQuestionSet(standalonePool(55), 10, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.requestedCount, 10);
  assert.equal(diagnostics.finalCount, NTA_QUESTION_COUNT);
});

test('Quick/full modes keep their existing count behavior', () => {
  assert.equal(resolveCount(getMode('quick'), 10), 10);
  assert.equal(resolveCount(getMode('quick'), 25), 10);
  assert.equal(resolveCount(getMode('full'), 25), 50);
});
