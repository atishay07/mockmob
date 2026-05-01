import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnglishGenerationMode } from '../lib/englishGenerationMode.mjs';
import { normalizeGenerationPayload } from '../lib/passageNormalizer.mjs';
import { shouldIncludePassageGroupForPracticeMode, shouldIncludeQuestionForPracticeMode } from '../lib/practiceModeFiltering.mjs';

function passagePayload(questionCount = 4) {
  return {
    passage_group: {
      passage_id: 'passage_1',
      title: 'Digital Attention',
      passage_type: 'narrative',
      passage_text: Array(70).fill('A researcher noticed how students balanced careful reading with constant digital alerts and changed their study habits through deliberate pauses.').join(' '),
      questions: Array.from({ length: questionCount }, (_, index) => ({
        q: `Which option best captures passage point ${index + 1}?`,
        o: ['A careful adjustment to reading habits', 'A partial concern about alerts', 'A distracting but related classroom detail', 'An unrelated extreme conclusion'],
        a: 'A',
        question_type: index === 2 ? 'vocabulary_in_context' : 'inference',
        subject: 'english',
        chapter: 'Narrative Passage',
        concept_id: 'english::narrative_passage',
        passage_id: 'passage_1',
        order_index: index + 1,
        trap_option: 'B',
        strong_distractors: ['B', 'C'],
        answer_check: 'The passage says students changed study habits through deliberate pauses.',
      })),
    },
  };
}

test('English NTA passage chapters require passage mode', () => {
  const mode = getEnglishGenerationMode('Narrative Passage');
  assert.equal(mode.mode, 'passage_rc');
  assert.equal(mode.requires_passage, true);
  assert.equal(mode.allowed_in_quick_practice, false);
});

test('passage_group normalizes children with temporary group key', () => {
  const normalized = normalizeGenerationPayload(passagePayload(), { subject: 'english', chapter: 'Narrative Passage' });
  assert.equal(normalized.passageGroups.length, 1);
  assert.equal(normalized.questions.length, 4);
  assert.ok(normalized.questions.every((question) => question.temporary_group_key));
  assert.ok(normalized.questions.every((question) => question.passage_text));
});

test('passage groups are excluded from quick practice and included in NTA mode', () => {
  const normalized = normalizeGenerationPayload(passagePayload(), { subject: 'english', chapter: 'Narrative Passage' });
  const child = normalized.questions[0];
  assert.equal(shouldIncludeQuestionForPracticeMode(child, 'quick_practice'), false);
  assert.equal(shouldIncludePassageGroupForPracticeMode(normalized.passageGroups[0], 'quick_practice'), false);
  assert.equal(shouldIncludeQuestionForPracticeMode(child, 'nta_mode'), true);
  assert.equal(shouldIncludePassageGroupForPracticeMode(normalized.passageGroups[0], 'nta_mode'), true);
});

test('passage group publish rule requires at least 3 accepted children', () => {
  const enough = normalizeGenerationPayload(passagePayload(4), { subject: 'english', chapter: 'Narrative Passage' });
  const tooFew = normalizeGenerationPayload(passagePayload(2), { subject: 'english', chapter: 'Narrative Passage' });
  assert.equal(enough.questions.filter((question) => question.passage_text && question.passage_id).length >= 3, true);
  assert.equal(tooFew.questions.filter((question) => question.passage_text && question.passage_id).length >= 3, false);
});
