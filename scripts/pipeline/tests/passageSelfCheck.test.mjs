import test from 'node:test';
import assert from 'node:assert/strict';
import { runPassageQuestionSelfCheck, runSelfCheck } from '../lib/selfCheck.mjs';

const passageText = Array(10).fill('The passage describes a school library that redesigned its reading programme after students began skimming digital summaries. Teachers noticed that deliberate pauses, peer discussion, and handwritten notes helped learners recover attention. The author presents the change as a balanced response to technology, not as a rejection of digital tools.').join(' ');

function baseQuestion(overrides = {}) {
  return {
    q: 'Which option best captures the central idea of the passage?',
    o: [
      'The library responded to digital skimming by building slower reading habits.',
      'The library rejected digital tools and returned entirely to handwritten work.',
      'Peer discussion partly helped students but did not replace careful reading.',
      'Technology alone solved the attention problem for every learner.',
    ],
    a: 'A',
    subject: 'english',
    chapter: 'Narrative Passage',
    question_type: 'central_idea',
    passage_id: 'passage_1',
    temporary_group_key: 'tmp_passage_1',
    passage_text: passageText,
    trap_option: 'C',
    strong_distractors: ['B', 'C'],
    answer_check: 'The passage presents deliberate pauses, discussion, and notes as a balanced response to digital skimming.',
    ...overrides,
  };
}

test('passage central idea with plausible distractors passes', () => {
  const result = runPassageQuestionSelfCheck(baseQuestion());
  assert.equal(result.pass, true);
  const full = runSelfCheck(baseQuestion());
  assert.equal(full.pass, true);
});

test('vocabulary without passage context fails', () => {
  const result = runPassageQuestionSelfCheck(baseQuestion({
    q: 'What does deliberate mean?',
    question_type: 'vocabulary_in_context',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('vocabulary_without_passage_context'));
});

test('vocabulary-in-context with phrase and evidence passes', () => {
  const result = runPassageQuestionSelfCheck(baseQuestion({
    q: 'As used in the passage, what does the phrase "deliberate pauses" most nearly mean?',
    o: [
      'Intentional breaks used to slow reading and restore attention',
      'Random interruptions that distract students from discussion',
      'A complete rejection of all digital tools',
      'A quick summary copied without reflection',
    ],
    a: 'A',
    question_type: 'vocabulary_in_context',
    answer_check: 'The phrase appears where teachers used pauses to help learners recover attention.',
  }));
  assert.equal(result.pass, true);
});

test('central idea stem is not rejected as direct definition in passage mode', () => {
  const result = runSelfCheck(baseQuestion({
    q: 'What is the central idea of the passage?',
    question_type: 'central_idea',
  }));
  assert.equal(result.reasons.includes('direct_definition'), false);
});

test('author purpose stem is not rejected as direct definition in passage mode', () => {
  const result = runSelfCheck(baseQuestion({
    q: "What is the author's primary purpose in the passage?",
    question_type: 'author_purpose',
    answer_check: 'The passage presents the library change as a balanced response to technology, showing the author’s purpose.',
  }));
  assert.equal(result.reasons.includes('direct_definition'), false);
});

test('vocabulary-in-context fails when quoted phrase is absent from passage', () => {
  const result = runPassageQuestionSelfCheck(baseQuestion({
    q: 'As used in the passage, what does the phrase "ornamental silence" most nearly mean?',
    question_type: 'vocabulary_in_context',
    answer_check: 'The phrase appears in the passage and points to quiet reflection.',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('vocabulary_without_passage_context'));
});

test('passage child without group id cannot pass passage selfCheck', () => {
  const result = runPassageQuestionSelfCheck(baseQuestion({
    temporary_group_key: '',
    passage_group_id: '',
    group_id: '',
  }));
  assert.equal(result.pass, false);
  assert.ok(result.reasons.includes('passage_child_missing_group'));
});
