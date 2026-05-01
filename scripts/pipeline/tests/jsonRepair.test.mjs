import test from 'node:test';
import assert from 'node:assert/strict';
import {
  repairGeneratedJson,
  extractJsonCandidates,
  containsMetaCommentary,
  hasInternalContradiction,
  isStructurallyCompleteQuestion,
  isValidStandaloneGenerationShape,
  isValidPassageGroupShape,
} from '../lib/jsonRepair.mjs';

const context = {
  subject: 'computer_science',
  chapter: 'Boolean Algebra',
  concept_id: 'computer_science::boolean_algebra',
  question_type: 'statement_based',
  allowModelRepair: false,
};

function validQuestion(overrides = {}) {
  return {
    q: 'Read the statements about Boolean algebra and choose the option that correctly applies De Morgan laws.',
    o: [
      'The complement of a sum changes to the product of complements.',
      'The complement of a sum remains a sum of complements.',
      'The complement rule applies only to numeric variables.',
      'The law removes the need for logical operators.',
    ],
    a: 'A',
    question_type: 'statement_based',
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    trap_option: 'B',
    strong_distractors: ['B', 'C'],
    answer_check: 'A is correct because De Morgan law changes OR to AND under complement.',
    ...overrides,
  };
}

test('repairs markdown-wrapped JSON and preserves valid question', async () => {
  const raw = `\`\`\`json\n${JSON.stringify({ questions: [validQuestion()] })}\n\`\`\``;
  const result = await repairGeneratedJson(raw, context);
  assert.equal(result.ok, true);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].a, 'A');
});

test('removes commentary outside JSON', async () => {
  const raw = `Here is the JSON:\n${JSON.stringify({ questions: [validQuestion()] })}`;
  const result = await repairGeneratedJson(raw, context);
  assert.equal(result.ok, true);
  assert.equal(result.questions.length, 1);
});

test('drops incomplete truncated question while keeping complete objects', async () => {
  const raw = `{"questions":[${JSON.stringify(validQuestion())},{"q":"unfinished","o":["A","B"`;
  const result = await repairGeneratedJson(raw, context);
  assert.equal(result.ok, true);
  assert.equal(result.questions.length, 1);
});

test('drops question containing meta-commentary', async () => {
  const raw = JSON.stringify({ questions: [validQuestion({ q: 'Actually, let us fix this question before returning it.' })] });
  const result = await repairGeneratedJson(raw, context);
  assert.equal(result.ok, false);
  assert.equal(result.questions.length, 0);
  assert.ok(result.reasons.includes('meta_commentary_detected'));
});

test('drops contradictory answer_check', async () => {
  const raw = JSON.stringify({ questions: [validQuestion({ answer_check: 'However, the answer should be B.' })] });
  const result = await repairGeneratedJson(raw, context);
  assert.equal(result.ok, false);
  assert.equal(result.questions.length, 0);
  assert.ok(result.reasons.includes('answer_check_conflict'));
});

test('returns empty array if no valid questions remain', async () => {
  const result = await repairGeneratedJson('not a question payload', context);
  assert.equal(result.ok, false);
  assert.deepEqual(result.questions, []);
});

test('does not create new questions', async () => {
  const raw = JSON.stringify({ questions: [validQuestion(), validQuestion({ q: 'Actually, replace this.' })] });
  const result = await repairGeneratedJson(raw, context);
  assert.equal(result.questions.length, 1);
});

test('exports structural helpers', () => {
  assert.equal(containsMetaCommentary('Actually, fix it'), true);
  assert.equal(hasInternalContradiction({ answer_check: 'The answer should be C.' }), true);
  assert.equal(isStructurallyCompleteQuestion(validQuestion()), true);
  assert.equal(isValidStandaloneGenerationShape({ questions: [validQuestion()] }), true);
  assert.equal(isValidPassageGroupShape({
    passage_group: {
      passage_id: 'passage_1',
      passage_text: 'A '.repeat(220),
      questions: [validQuestion({ passage_id: 'passage_1' })],
    },
  }), true);
});

test('extractJsonCandidates reports partial object recovery', () => {
  const recovery = extractJsonCandidates(`${JSON.stringify(validQuestion())}\ntrailing broken {"q":`);
  assert.equal(recovery.extracted_objects >= 1, true);
});
