import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alignOfflineQuestion,
  buildOfflineQuestions,
  normalizeRawQuestion,
  runOfflineMiniValidator,
  validateRawQuestionSchema,
} from '../lib/offlineBatchFactory.mjs';

test('offline generator creates unique valid raw questions with required fields', () => {
  const questions = buildOfflineQuestions({
    subject: 'Economics',
    chapter: 'Money & Banking',
    quality: 'balanced',
    count: 100,
  });
  assert.equal(questions.length, 100);
  assert.equal(new Set(questions.map((question) => question.local_id)).size, 100);
  assert.equal(questions.filter((question) => question.question_type === 'simple_numerical').length, 10);
  for (const question of questions) {
    assert.deepEqual(validateRawQuestionSchema(question, { question_count: 10 }), []);
    assert.doesNotMatch(question.question_text, /Which comparison best captures|common error is to treat this area|linked to Money & Banking|Compare the four explanations/i);
  }
});

test('offline schema rejects meta stems and rationale-option mismatch', () => {
  const raw = buildOfflineQuestions({ subject: 'Economics', chapter: 'Money & Banking', quality: 'balanced', count: 1 })[0];
  const metaErrors = validateRawQuestionSchema({
    ...raw,
    question_text: 'Which comparison best captures CRR in Money & Banking?',
  }, { question_count: 10 });
  assert.ok(metaErrors.includes('meta_chapter_classification_stem'));

  const mismatchErrors = validateRawQuestionSchema({
    ...raw,
    distractor_rationales: {
      ...raw.distractor_rationales,
      A: 'This rationale discusses fiscal deficit and not the actual option.',
    },
  }, { question_count: 10 });
  assert.ok(mismatchErrors.includes('rationale_option_mismatch_A'));
});

test('offline mini validator permits direct wording and catches an extreme option giveaway', () => {
  const raw = buildOfflineQuestions({ subject: 'Economics', chapter: 'Money & Banking', quality: 'balanced', count: 1 })[0];
  const alignment = alignOfflineQuestion(raw, { expectedSubject: 'Economics', expectedChapter: 'Money & Banking' });

  const direct = normalizeRawQuestion({
    ...raw,
    question_text: 'What is money supply?',
  }, alignment, 'balanced');
  const directResult = runOfflineMiniValidator(direct, alignment);
  assert.ok(!directResult.issues.includes('direct_definition'));

  const weak = normalizeRawQuestion({
    ...raw,
    options: Object.fromEntries(Object.keys(raw.options).map((key,i)=>[key,key===raw.correct_option?raw.options[key]:['Banana','Orange','Chair','Desk'][i]])),
  }, alignment, 'balanced');
  const weakResult = runOfflineMiniValidator(weak, alignment);
  assert.equal(weakResult.verdict, 'reject');
  assert.ok(weakResult.issues.includes('weak_distractors'));
});
