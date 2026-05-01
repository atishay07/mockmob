import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractGenerationText, getDeepSeekRawShapeForLog } from '../lib/llm.mjs';
import { repairGeneratedJson } from '../lib/jsonRepair.mjs';
import { runSelfCheck } from '../lib/selfCheck.mjs';

const llmSource = readFileSync(new URL('../lib/llm.mjs', import.meta.url), 'utf8');

function validQuestion(overrides = {}) {
  return {
    q: 'Read the statements about Boolean algebra. Statement I: The complement of a sum becomes the product of complements. Statement II: The complement of a product becomes the sum of complements. Statement III: De Morgan laws mainly apply to decimal arithmetic. Choose the correct option.',
    o: [
      'I and II only',
      'II and III only',
      'I and III only',
      'I, II and III',
    ],
    a: 'A',
    question_type: 'statement_based',
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    trap_option: 'B',
    strong_distractors: ['B', 'C'],
    answer_check: 'A is correct because Statements I and II follow De Morgan logic while III misuses arithmetic.',
    ...overrides,
  };
}

test('content empty plus reasoning_content length finish reason length is not parsed blindly', () => {
  const response = {
    choices: [{
      finish_reason: 'length',
      message: {
        content: '',
        reasoning_content: JSON.stringify({ questions: [validQuestion()] }),
      },
    }],
  };
  assert.throws(() => extractGenerationText(response, 'deepseek'), /exhausted output budget/);
  const shape = getDeepSeekRawShapeForLog(response, 'deepseek-v4-pro');
  assert.equal(shape.has_reasoning_content, true);
  assert.equal(shape.finish_reason, 'length');
});

test('finish_reason length with partial objects extracts complete questions only', async () => {
  const raw = `{"questions":[${JSON.stringify(validQuestion())},{"q":"unfinished","o":["A"`;
  const repaired = await repairGeneratedJson(raw, {
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    finish_reason: 'length',
    allowModelRepair: false,
  });
  assert.equal(repaired.questions.length, 1);
});

test('Flash invalid JSON attempts repair before selfCheck', async () => {
  const raw = `Actually I should return JSON.\n${JSON.stringify({ questions: [validQuestion()] })}`;
  const repaired = await repairGeneratedJson(raw, {
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    allowModelRepair: false,
  });
  assert.equal(repaired.questions.length, 1);
  const selfCheck = runSelfCheck(repaired.questions[0], { subject: 'computer_science', chapter: 'Boolean Algebra' });
  assert.equal(selfCheck.pass, true);
});

test('repaired invalid objects are dropped', async () => {
  const repaired = await repairGeneratedJson(JSON.stringify({
    questions: [validQuestion({ trap_option: 'A' })],
  }), {
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    concept_id: 'computer_science::boolean_algebra',
    allowModelRepair: false,
  });
  assert.equal(repaired.questions.length, 0);
});

test('reasoning exhausted output budget participates in Pro health handling', () => {
  assert.match(llmSource, /reasoning_exhausted_output_budget/);
  assert.match(llmSource, /pro_reasoning_exhausted_count/);
  assert.match(llmSource, /requestedCount: getDeepSeekModelRole\(modelName\) === 'pro' \? 1/);
});
