import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NTA_DURATION_MINUTES,
  NTA_QUESTION_COUNT,
  qualityGateNtaQuestion,
  selectNtaQuestionSet,
  selectNtaQuestionSetWithAnswerVerification,
  verifyNtaAnswerIntegrity,
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

const VERBAL = [
  ['Vocabulary', 'vocabulary'],
  ['Correct Word Usage', 'correct_word_usage'],
  ['Para Jumbles', 'para_jumble'],
  ['Match the Following', 'match_the_following'],
];

// A passage set whose questions are unique to the set (shared bodies would be deduplicated).
function passageSet(groupId, size, chapter = 'Factual Passage', overrides = {}) {
  return Array.from({ length: size }, (_, index) => validPassageQuestion(`${groupId}_${index + 1}`, index + 1, {
    chapter,
    body: `According to the passage in set ${groupId}, which statement is supported by detail ${index + 1}?`,
    options: [
      { key: 'A', text: index === 0 ? 'The library measured only issued books.' : `${groupId} distractor A ${index + 1}` },
      { key: 'B', text: index === 1 ? 'Students were asked to write short notes.' : `${groupId} distractor B ${index + 1}` },
      { key: 'C', text: index === 2 ? 'Teachers could judge whether reading was thoughtful.' : `${groupId} distractor C ${index + 1}` },
      { key: 'D', text: `${groupId} distractor D ${index + 1}` },
    ],
    explanation: `The correct answer is ${index === 0 ? 'A' : index === 1 ? 'B' : 'C'} because the passage states this detail directly.`,
    passage_group_id: groupId,
    passage_id: groupId,
    ...overrides,
  }));
}

// An English bank with every CUET section stocked: four passage sets and plenty of verbal items.
function englishPool({ perVerbal = 20, sets = [['set_f', 5, 'Factual Passage'], ['set_n', 5, 'Narrative Passage'], ['set_l', 5, 'Literary Passage'], ['set_f2', 4, 'Factual Passage']], start = 1, overrides = {} } = {}) {
  const rows = [];
  VERBAL.forEach(([chapter, type], sectionIndex) => {
    for (let i = 0; i < perVerbal; i += 1) rows.push(validQuestion(start + sectionIndex * 1000 + i, { chapter, question_type: type, ...overrides }));
  });
  for (const [groupId, size, chapter] of sets) rows.push(...passageSet(groupId, size, chapter));
  return rows;
}

function blocksOf(rows) {
  const blocks = [];
  for (const row of rows) {
    const key = row.passage_text ? row.passage_group_id : `section:${row.chapter}`;
    const last = blocks.at(-1);
    if (last && last.key === key) last.rows.push(row);
    else blocks.push({ key, passage: Boolean(row.passage_text), chapter: row.chapter, rows: [row] });
  }
  return blocks;
}

test('NTA selector returns exactly 50 when 50+ usable questions exist', () => {
  const { selectedRows, diagnostics } = selectNtaQuestionSet(englishPool(), 25, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.poolStats.selected, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.canBuild50, true);
});

test('NTA selector does not fail because chapter is missing', () => {
  // Chapters missing: verbal items are placed by question type, passages by their set.
  const pool = englishPool({ overrides: { chapter: '' } });
  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.ok(diagnostics.poolStats.tier2 + diagnostics.poolStats.tier3 > 0);
});

test('NTA selector does not fail because quality metadata is missing', () => {
  const pool = englishPool().map((row) => ({
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

test('accepts valid direct recall without a depth requirement', () => {
  const result = qualityGateNtaQuestion(validQuestion(5, {
    subject: 'economics',
    chapter: 'Money & Banking',
    body: 'What is money?',
    options: [{key:'A',text:'Any resource with industrial use'},{key:'B',text:'Anything generally accepted as a medium of exchange'},{key:'C',text:'Only government bonds'},{key:'D',text:'Only coins made from precious metals'}],
    correct_answer:'B',
    explanation:'Money is generally accepted as a medium of exchange for goods and services.',
    question_type: 'direct_recall',
    concept_id: 'economics::money_banking',
  }), { subjectId: 'economics' });

  assert.equal(result.accepted, true);
  assert.ok(!result.reasons.includes('generic_textbook_one_liner'));
});

test('NTA selector preserves passage group order', () => {
  const pool = [...englishPool({ sets: [] }), ...passageSet('set_order', 3).reverse(), ...passageSet('set_b', 5, 'Narrative Passage'), ...passageSet('set_c', 5, 'Literary Passage')];

  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.poolStats.passageGroupsSelected, 3);
  const at = selectedRows.findIndex((row) => row.id === 'set_order_1');
  assert.deepEqual(selectedRows.slice(at, at + 3).map((row) => row.id), ['set_order_1', 'set_order_2', 'set_order_3']);
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
  const { selectedRows, diagnostics } = selectNtaQuestionSet(englishPool(), 10, { subjectId: 'english', seed: 'fixed' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.requestedCount, 10);
  assert.equal(diagnostics.finalCount, NTA_QUESTION_COUNT);
});

test('Quick/full modes keep their existing count behavior', () => {
  assert.equal(resolveCount(getMode('quick'), 10), 10);
  assert.equal(resolveCount(getMode('quick'), 25), 10);
  assert.equal(resolveCount(getMode('full'), 25), 50);
});

test('rejects one-line Read the excerpt pseudo-passage', () => {
  const result = qualityGateNtaQuestion(validQuestion(1, {
    id: 'bad_literary_excerpt',
    chapter: 'Literary Passage',
    body: 'Read the excerpt: "The crimson sunset melted into the sea." Which type of imagery is used here?',
    question_type: 'literary_device',
    topic: 'Literary Passage',
  }), { subjectId: 'english' });

  assert.equal(result.accepted, false);
  assert.match(result.reasons.join(','), /orphan_passage_question/);
});

test('rejects passage badge without recoverable passage text', () => {
  const result = qualityGateNtaQuestion(validQuestion(2, {
    id: 'bad_factual_generic',
    chapter: 'Factual Passage',
    body: 'A student is taking notes from a complex philosophical text. Which approach is most useful?',
    question_type: 'reading_comprehension',
    topic: 'Factual Passage',
    passage_group_id: null,
    passage_text: null,
  }), { subjectId: 'english' });

  assert.equal(result.accepted, false);
  assert.match(result.reasons.join(','), /orphan_passage_question/);
});

test('rejects generic paraphrasing assertion-reason English theory without passage context', () => {
  const result = qualityGateNtaQuestion(validQuestion(3, {
    id: 'bad_paraphrase_assertion',
    chapter: 'Vocabulary',
    body: 'Assertion: Paraphrasing always preserves the exact length of the original sentence. Reason: A paraphrase rewrites the same idea in different words.',
    question_type: 'assertion_reason',
    options: [
      { key: 'A', text: 'Both assertion and reason are true and reason explains assertion' },
      { key: 'B', text: 'Both assertion and reason are true but reason does not explain assertion' },
      { key: 'C', text: 'Assertion is false but reason is true' },
      { key: 'D', text: 'Assertion is true but reason is false' },
    ],
    correct_answer: 'C',
  }), { subjectId: 'english' });

  assert.equal(result.accepted, false);
  assert.match(result.reasons.join(','), /generic_english_assertion_reason_without_context/);
});

test('rejects orphan passage-dependent row even when options and answer are valid', () => {
  const result = qualityGateNtaQuestion(validQuestion(4, {
    id: 'orphan_passage_child',
    chapter: 'Reading Comprehension',
    body: 'According to the passage, why did the author describe the policy as gradual?',
    question_type: 'inference',
    passage_group_id: 'missing_parent',
    passage_text: '',
  }), { subjectId: 'english' });

  assert.equal(result.accepted, false);
  assert.match(result.reasons.join(','), /orphan_passage_question/);
});

test('accepts valid English passage groups with real passages and four linked questions each', () => {
  const pool = englishPool({ sets: [['set_a', 4, 'Factual Passage'], ['set_b', 4, 'Narrative Passage'], ['set_c', 4, 'Literary Passage']] });

  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, { subjectId: 'english', seed: 'passage-four' });
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.poolStats.passageGroupsSelected, 3);
  for (const set of ['set_a', 'set_b', 'set_c']) assert.equal(selectedRows.filter((row) => row.passage_group_id === set).length, 4);
});

test('English NTA selection excludes fake passage labels', () => {
  const badRows = [
    validQuestion(1, {
      id: 'bad_literary_excerpt_select',
      chapter: 'Literary Passage',
      body: 'Read the excerpt: "The crimson sunset melted into the sea." Which type of imagery is used here?',
      question_type: 'literary_device',
    }),
    validQuestion(2, {
      id: 'bad_factual_generic_select',
      chapter: 'Factual Passage',
      body: 'A student is taking notes from a complex philosophical text. Which approach is most useful?',
      question_type: 'reading_comprehension',
    }),
    validQuestion(3, {
      id: 'bad_assertion_select',
      chapter: 'Vocabulary',
      body: 'Assertion: Paraphrasing always preserves the exact length of the original sentence. Reason: A paraphrase rewrites the same idea in different words.',
      question_type: 'assertion_reason',
      correct_answer: 'C',
      options: [
        { key: 'A', text: 'Both are true and the reason explains the assertion' },
        { key: 'B', text: 'Both are true but the reason does not explain the assertion' },
        { key: 'C', text: 'Assertion is false but reason is true' },
        { key: 'D', text: 'Assertion is true but reason is false' },
      ],
    }),
  ];
  const { selectedRows, diagnostics } = selectNtaQuestionSet([...englishPool({ start: 20 }), ...badRows], 50, {
    subjectId: 'english',
    seed: 'fake-passage-guard',
  });

  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.canBuild50, true);
  assert.ok(!selectedRows.some((row) => badRows.some((bad) => bad.id === row.id)));
});

test('NTA selector returns fewer than 50 when fewer than 50 acceptable questions exist', () => {
  const { selectedRows, diagnostics } = selectNtaQuestionSet(englishPool({ perVerbal: 8, sets: [['set_a', 5, 'Factual Passage'], ['set_b', 5, 'Narrative Passage'], ['set_c', 5, 'Literary Passage']] }), 50, {
    subjectId: 'english',
    seed: 'forty-seven',
  });

  assert.equal(selectedRows.length, 47);
  assert.equal(diagnostics.canBuild50, false);
  assert.equal(diagnostics.durationMinutes, NTA_DURATION_MINUTES);
  assert.match(diagnostics.message, /50 are required/);
});

test('answer integrity guard rejects explanation that points to another key', () => {
  const result = verifyNtaAnswerIntegrity(validQuestion(1, {
    correct_answer: 'B',
    explanation: 'The correct answer is A because the first option is the closest meaning.',
  }));

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('answer_guard_explanation_contradicts_key'));
});

test('NTA answer integrity excludes bad keyed row and refills to 50', () => {
  const bad = validQuestion(999, {
    id: 'bad_answer_key_runtime',
    correct_answer: 'B',
    explanation: 'The correct answer is A because this explanation contradicts the stored answer.',
    anchor_tier: 1,
    pyq_anchor_id: 'pyq_bad_runtime',
    quality_score: 1,
  });
  const clean = englishPool({ start: 100, overrides: { anchor_tier: 3, pyq_anchor_id: null, quality_band: undefined } });

  const { selectedRows, diagnostics } = selectNtaQuestionSet([bad, ...clean], 50, {
    subjectId: 'english',
    seed: 'answer-refill',
  });

  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.canBuild50, true);
  assert.equal(diagnostics.answerIntegrity.finalVerifiedCount, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.answerIntegrity.refilledCount, 1);
  assert.ok(diagnostics.answerIntegrity.failedQuestionIds.includes('bad_answer_key_runtime'));
  assert.ok(!selectedRows.some((row) => row.id === 'bad_answer_key_runtime'));
});

test('NTA answer integrity refuses to start when only 49 clean questions remain', () => {
  const bad = validQuestion(998, {
    id: 'bad_answer_no_refill',
    correct_answer: 'C',
    explanation: 'Option B is correct because the explanation contradicts the stored answer.',
    anchor_tier: 1,
    pyq_anchor_id: 'pyq_bad_no_refill',
  });
  // Exactly the pattern's 50 slots exist (12 vocabulary, 9 word usage, 7, 7, three sets of 5); one is bad.
  const counts = [11, 9, 7, 7];
  const clean = [];
  VERBAL.forEach(([chapter, type], sectionIndex) => {
    for (let i = 0; i < counts[sectionIndex]; i += 1) clean.push(validQuestion(200 + sectionIndex * 100 + i, { chapter, question_type: type }));
  });
  clean.push(...passageSet('set_a', 5), ...passageSet('set_b', 5, 'Narrative Passage'), ...passageSet('set_c', 5, 'Literary Passage'));

  const { selectedRows, diagnostics } = selectNtaQuestionSet([bad, ...clean], 50, {
    subjectId: 'english',
    seed: 'answer-no-refill',
  });

  assert.equal(selectedRows.length, 49);
  assert.equal(diagnostics.canBuild50, false);
  assert.equal(diagnostics.answerIntegrity.finalVerifiedCount, 49);
  assert.match(diagnostics.message, /answer integrity|50 are required/i);
});

test('NTA answer integrity refill keeps passage group ordering intact', () => {
  const bad = validQuestion(997, {
    id: 'bad_before_passage',
    correct_answer: 'D',
    explanation: 'The answer is A because this row should be removed before launch.',
    anchor_tier: 1,
    pyq_anchor_id: 'pyq_bad_before_passage',
  });
  const pool = [
    bad,
    ...englishPool({ start: 300, sets: [], overrides: { anchor_tier: 3, pyq_anchor_id: null, quality_band: undefined } }),
    ...passageSet('guard', 3).reverse(),
    ...passageSet('set_b', 5, 'Narrative Passage'),
    ...passageSet('set_c', 5, 'Literary Passage'),
  ];

  const { selectedRows, diagnostics } = selectNtaQuestionSet(pool, 50, {
    subjectId: 'english',
    seed: 'answer-passage-order',
  });

  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.answerIntegrity.finalVerifiedCount, NTA_QUESTION_COUNT);
  assert.ok(!selectedRows.some((row) => row.id === 'bad_before_passage'));
  const at = selectedRows.findIndex((row) => row.id === 'guard_1');
  assert.deepEqual(selectedRows.slice(at, at + 3).map((row) => row.id), ['guard_1', 'guard_2', 'guard_3']);
});

test('NTA AI verifier only checks low-confidence rows and refills rejected answers', async () => {
  const bad = validQuestion(996, {
    id: 'ai_bad_low_confidence',
    correct_answer: 'B',
    explanation: '',
    anchor_tier: 1,
    pyq_anchor_id: 'pyq_ai_bad',
    quality_score: 1,
  });
  // Eleven clean vocabulary items: the twelve-item vocabulary block must include the bad row.
  const clean = englishPool({ start: 400, perVerbal: 11, overrides: {
    explanation: 'The correct answer is B because the option gives the closest precise meaning.',
    anchor_tier: 1,
    quality_score: 0.9,
  } });
  const calls = [];

  const { selectedRows, diagnostics } = await selectNtaQuestionSetWithAnswerVerification([bad, ...clean], 50, {
    subjectId: 'english',
    seed: 'ai-low-confidence-refill',
    aiAnswerVerifier: async (rows) => {
      calls.push(rows.map((row) => row.id));
      return rows.map((row) => row.id === 'ai_bad_low_confidence'
        ? {
            id: row.id,
            verdict: 'fail',
            solved_answer: 'A',
            confidence: 0.97,
            reason: 'ai_solved_answer_mismatch',
          }
        : {
            id: row.id,
            verdict: 'pass',
            solved_answer: row.correct_answer,
            confidence: 0.96,
            reason: 'stored answer matches independent solve',
          });
    },
  });

  // Only low-confidence rows are sent: the bad row and passage questions (which always need a
  // context check), never the well-explained verbal items.
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('ai_bad_low_confidence'));
  assert.ok(calls[0].every((id) => id === 'ai_bad_low_confidence' || id.startsWith('set_')));
  assert.equal(selectedRows.length, NTA_QUESTION_COUNT);
  assert.equal(diagnostics.canBuild50, true);
  assert.equal(diagnostics.answerIntegrity.ai.checkedCount, calls[0].length);
  assert.equal(diagnostics.answerIntegrity.ai.failedCount, 1);
  assert.ok(diagnostics.answerIntegrity.ai.failedQuestionIds.includes('ai_bad_low_confidence'));
  assert.ok(!selectedRows.some((row) => row.id === 'ai_bad_low_confidence'));
});
