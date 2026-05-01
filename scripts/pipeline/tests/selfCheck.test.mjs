import test from 'node:test';
import assert from 'node:assert/strict';
import { runSelfCheck } from '../lib/selfCheck.mjs';

function baseQuestion(overrides = {}) {
  return {
    body: 'Read the following statements about electromagnetic induction. Statement I: The induced current opposes the change in magnetic flux. Statement II: The induced emf depends on the rate of change of flux. Which option is correct?',
    options: [
      { key: 'A', text: 'Both Statement I and Statement II are correct' },
      { key: 'B', text: 'Statement I only' },
      { key: 'C', text: 'Statement II only' },
      { key: 'D', text: 'Neither Statement I nor Statement II' },
    ],
    correct_answer: 'A',
    subject: 'physics',
    chapter: 'Electromagnetic Induction',
    question_type: 'statement_based',
    trap_option: 'B',
    strong_distractors: ['B', 'C'],
    distractor_rationale: {
      A: 'Correct because both statements capture NCERT-level implications.',
      B: 'Plausible because Lenz law is central but ignores emf dependence.',
      C: 'Plausible because Faraday law is central but ignores opposition.',
      D: 'Wrong because both statements are accepted NCERT ideas.',
    },
    ...overrides,
  };
}

test('selfCheck accepts valid CUET-style Physics statement question', () => {
  const result = runSelfCheck(baseQuestion(), { batchSize: 1 });
  assert.equal(result.pass, true);
  assert.equal(result.cuet_pattern, true);
  assert.notEqual(result.trap_quality, 'low');
});

test('selfCheck rejects direct definitions', () => {
  const result = runSelfCheck(baseQuestion({
    body: 'What is electromagnetic induction?',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('direct_definition'));
});

test('selfCheck rejects missing trap_option', () => {
  const question = baseQuestion();
  delete question.trap_option;
  const result = runSelfCheck(question);
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('missing_trap_option'));
});

test('selfCheck rejects fewer than two strong distractors', () => {
  const result = runSelfCheck(baseQuestion({ strong_distractors: ['B'] }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('missing_strong_distractors'));
});

test('selfCheck does not reject scientifically valid absolute wording by itself', () => {
  const result = runSelfCheck(baseQuestion({
    body: 'Read the following statements about Lenz law. Statement I: The induced current always opposes the change in magnetic flux that produces it. Statement II: This opposition is consistent with conservation of energy. Which option is correct?',
  }));
  assert.equal(result.pass, true);
  assert.equal(result.reasons.includes('absurd_extreme_option'), false);
});

test('selfCheck rejects clearly outside-CUET derivation pattern', () => {
  const result = runSelfCheck(baseQuestion({
    body: 'Derive the complete differential equation for a coupled electromagnetic field using multi-step vector calculus.',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('non_cuet_pattern'));
});
