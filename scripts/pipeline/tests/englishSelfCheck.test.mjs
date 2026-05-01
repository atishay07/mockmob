import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPermutationOption, runSelfCheck } from '../lib/selfCheck.mjs';

function paraQuestion(overrides = {}) {
  return {
    body: 'Rearrange the following sentences to form a coherent paragraph:\nA. This shift has made access easier, but it has also made sustained attention harder to protect.\nB. Schools therefore need to teach students how to pause, verify, and connect information before using it.\nC. Digital platforms now place large amounts of reading material before students at very low cost.\nD. Without such habits, abundance of information can become a reason for shallow understanding.',
    options: [
      { key: 'A', text: 'CABD' },
      { key: 'B', text: 'CADB' },
      { key: 'C', text: 'ACBD' },
      { key: 'D', text: 'CBAD' },
    ],
    correct_answer: 'A',
    subject: 'english',
    chapter: 'Para Jumbles',
    question_type: 'para_jumble',
    trap_option: 'B',
    strong_distractors: ['B', 'D'],
    ordering_logic: 'C introduces the issue, A adds contrast, B gives the needed response, and D concludes.',
    distractor_rationale: {
      A: 'Correct because the paragraph moves from access to risk to response to consequence.',
      B: 'Trap because it keeps the opening pair but weakens the response-consequence link.',
      C: 'Wrong because it starts with a dependent contrast.',
      D: 'Wrong but plausible because it keeps the conclusion near the end.',
    },
    ...overrides,
  };
}

test('permutation helper rejects repeated or missing labels', () => {
  assert.equal(isValidPermutationOption('CABD'), true);
  assert.equal(isValidPermutationOption('CBAA'), false);
  assert.equal(isValidPermutationOption('ABC'), false);
});

test('selfCheck accepts mature para jumble with valid close permutations', () => {
  const result = runSelfCheck(paraQuestion());
  assert.equal(result.pass, true);
  assert.equal(result.cuet_pattern, true);
});

test('selfCheck rejects invalid para jumble permutations and missing ordering logic', () => {
  const result = runSelfCheck(paraQuestion({
    options: [
      { key: 'A', text: 'CBAA' },
      { key: 'B', text: 'CADB' },
      { key: 'C', text: 'ACBD' },
      { key: 'D', text: 'CBAD' },
    ],
    ordering_logic: '',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('invalid_para_jumble_permutation'));
  assert.ok(result.reasons.includes('missing_ordering_logic'));
});

test('selfCheck rejects childish obvious para jumble story', () => {
  const result = runSelfCheck(paraQuestion({
    body: 'Rearrange the following sentences to form a coherent paragraph:\nA. Then the children ate cookies.\nB. Finally they went home.\nC. The children reached the beach in the morning.\nD. After that they watched the sunset.',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('obvious_chronological_story'));
});

test('selfCheck rejects passage child without passage text', () => {
  const result = runSelfCheck({
    body: 'Which option best captures the central idea of the passage?',
    options: [
      { key: 'A', text: 'It presents access as useful but incomplete without judgment.' },
      { key: 'B', text: 'It rejects public access to digital learning material.' },
      { key: 'C', text: 'It focuses mainly on the cost of printed books.' },
      { key: 'D', text: 'It argues that attention is unrelated to reading.' },
    ],
    correct_answer: 'A',
    subject: 'english',
    chapter: 'Narrative Passage',
    question_type: 'central_idea',
    passage_id: 'passage_1',
    trap_option: 'B',
    strong_distractors: ['B', 'C'],
    distractor_rationale: { A: 'Correct because...', B: 'Trap because...', C: 'Wrong because...', D: 'Wrong because...' },
  });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('missing_passage_text'));
});
