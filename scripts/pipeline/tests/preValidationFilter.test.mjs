import test from 'node:test';
import assert from 'node:assert/strict';
import { getInternalRejectionReason } from '../autonomous/worker.mjs';

function baseQuestion(overrides = {}) {
  return {
    subject: 'computer_science',
    chapter: 'Boolean Algebra',
    body: "Read the statements about Boolean identities: Statement I: A + AB = A. Statement II: A + A'B = A + B. Which option is correct?",
    options: [
      { key: 'A', text: 'I and II only' },
      { key: 'B', text: 'I only' },
      { key: 'C', text: 'II only' },
      { key: 'D', text: 'Neither I nor II' },
    ],
    correct_answer: 'A',
    question_type: 'statement_based',
    concept_id: 'computer_science::boolean_algebra',
    pyq_anchor_id: 'structured_computer_science_boolean_algebra_1',
    anchor_tier: 1,
    trap_option: 'B',
    strong_distractors: ['B', 'C'],
    answer_check: 'Both identities follow from absorption and complement expansion.',
    ...overrides,
  };
}

test('Boolean Algebra identities are not hard rejected as advanced', () => {
  assert.equal(getInternalRejectionReason(baseQuestion(), 'computer_science', 'Boolean Algebra'), null);
});

test('weak options are not hard rejected before selfCheck', () => {
  const question = baseQuestion({
    options: [
      { key: 'A', text: 'A' },
      { key: 'B', text: 'B' },
      { key: 'C', text: 'C' },
      { key: 'D', text: 'D' },
    ],
  });
  assert.equal(getInternalRejectionReason(question, 'computer_science', 'Boolean Algebra'), null);
});

test('invalid para-jumble permutation is still hard rejected', () => {
  const question = baseQuestion({
    subject: 'english',
    chapter: 'Para Jumbles',
    body: 'Rearrange the following sentences to form a paragraph:\\nA. One.\\nB. Two.\\nC. Three.\\nD. Four.',
    options: [
      { key: 'A', text: 'CBAA' },
      { key: 'B', text: 'ABCD' },
      { key: 'C', text: 'BACD' },
      { key: 'D', text: 'DCBA' },
    ],
    correct_answer: 'B',
    question_type: 'para_jumble',
    concept_id: 'english::para_jumbles',
  });
  assert.equal(getInternalRejectionReason(question, 'english', 'Para Jumbles'), 'invalid_para_jumble_permutation');
});

test('unsupported figure reference is hard rejected', () => {
  assert.equal(
    getInternalRejectionReason(baseQuestion({ body: 'Using the figure not provided, identify the Boolean gate output.' }), 'computer_science', 'Boolean Algebra'),
    'unsupported_media_reference',
  );
});
