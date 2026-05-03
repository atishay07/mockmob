import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOP_15_ANSWER_GUARD_SUBJECTS,
  evaluateGeneratedQuestionAnswerGuard,
  verifyAnswerIntegrity,
} from '../answer_integrity.js';
import {
  buildSafeHidePatch,
  createAnswerIntegrityReport,
  parseArgs,
  resolveSubjectFilter,
} from '../../scripts/answer-integrity-cleanup.mjs';

function validQuestion(overrides = {}) {
  return {
    id: 'q_valid',
    subject: 'english',
    chapter: 'Vocabulary',
    body: 'Choose the word closest in meaning to meticulous.',
    options: [
      { key: 'A', text: 'Careless' },
      { key: 'B', text: 'Precise' },
      { key: 'C', text: 'Temporary' },
      { key: 'D', text: 'Ordinary' },
    ],
    correct_answer: 'B',
    explanation: 'Meticulous means showing great attention to detail, so precise is the best answer.',
    status: 'live',
    verification_state: 'verified',
    exploration_state: 'active',
    is_deleted: false,
    ...overrides,
  };
}

test('top15 answer guard subjects match the popularity rollout list', () => {
  assert.deepEqual(TOP_15_ANSWER_GUARD_SUBJECTS, [
    'english',
    'gat',
    'physics',
    'chemistry',
    'mathematics',
    'biology',
    'economics',
    'accountancy',
    'business_studies',
    'political_science',
    'history',
    'geography',
    'sociology',
    'computer_science',
    'psychology',
  ]);
  assert.deepEqual(resolveSubjectFilter('top15'), TOP_15_ANSWER_GUARD_SUBJECTS);
  assert.throws(() => resolveSubjectFilter('english,environmental_studies'), /limited to top15/);
});

test('answer integrity rejects wrong keys and explanation contradictions', () => {
  const wrongKey = verifyAnswerIntegrity(validQuestion({ correct_answer: 'Z' }));
  assert.equal(wrongKey.accepted, false);
  assert.match(wrongKey.reasons.join(','), /answer_guard_key_unresolved/);

  const contradiction = verifyAnswerIntegrity(validQuestion({
    correct_answer: 'B',
    explanation: 'The correct answer is option C because it is temporary.',
  }));
  assert.equal(contradiction.accepted, false);
  assert.match(contradiction.reasons.join(','), /answer_guard_explanation_contradicts_key/);
});

test('cleanup report scans only top15 subjects and classifies unsafe rows', () => {
  const rows = [
    validQuestion({ id: 'clean_english' }),
    validQuestion({ id: 'bad_key_physics', subject: 'physics', correct_answer: 'Z' }),
    validQuestion({
      id: 'risky_chemistry',
      subject: 'chemistry',
      options: [
        { key: 'A', text: 'Only compound I is correct' },
        { key: 'B', text: 'Only compound II is correct' },
        { key: 'C', text: 'All of the above' },
        { key: 'D', text: 'Neither compound is correct' },
      ],
      correct_answer: 'A',
    }),
    validQuestion({ id: 'bad_non_top15', subject: 'environmental_studies', correct_answer: 'Z' }),
  ];
  const report = createAnswerIntegrityReport(rows, { subjects: 'top15', mode: 'dry-run' });

  assert.equal(report.totals.scanned, 3);
  assert.deepEqual(report.cleanIds, ['clean_english']);
  assert.deepEqual(report.rejections.map((entry) => entry.id), ['bad_key_physics']);
  assert.deepEqual(report.disputes.map((entry) => entry.id), ['risky_chemistry']);
});

test('safe hide patches never mutate answer keys', () => {
  const rejectedPatch = buildSafeHidePatch('reject');
  const disputedPatch = buildSafeHidePatch('dispute');

  assert.equal(rejectedPatch.correct_answer, undefined);
  assert.equal(disputedPatch.correct_answer, undefined);
  assert.equal(rejectedPatch.is_deleted, true);
  assert.equal(disputedPatch.verification_state, 'disputed');
});

test('generator answer guard blocks top15 bad rows and ignores phased-out subjects', () => {
  const badTop15 = evaluateGeneratedQuestionAnswerGuard(validQuestion({
    subject: 'mathematics',
    correct_answer: 'D',
    explanation: 'The correct answer is option B because precise is the intended choice.',
  }));
  assert.equal(badTop15.guarded, true);
  assert.equal(badTop15.accepted, false);
  assert.match(badTop15.error, /answer_integrity_guard/);

  const badNonTop15 = evaluateGeneratedQuestionAnswerGuard(validQuestion({
    subject: 'environmental_studies',
    correct_answer: 'Z',
  }));
  assert.equal(badNonTop15.guarded, false);
  assert.equal(badNonTop15.accepted, true);
});

test('apply mode requires a dry-run report path', () => {
  assert.throws(
    () => parseArgs(['node', 'script', '--mode=apply', '--subjects=top15']),
    /requires --from-report/,
  );
});
