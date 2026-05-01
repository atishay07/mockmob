import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIncludePassageGroupForPracticeMode, shouldIncludeQuestionForPracticeMode } from '../lib/practiceModeFiltering.mjs';

test('Quick Practice excludes passage groups and passage-linked questions', () => {
  assert.equal(shouldIncludePassageGroupForPracticeMode({}, 'quick'), false);
  assert.equal(shouldIncludeQuestionForPracticeMode({ passage_group_id: 'pg1' }, 'quick'), false);
  assert.equal(shouldIncludeQuestionForPracticeMode({ passage_id: 'passage_1' }, 'quick'), false);
});

test('Full Mock and NTA allow passage groups', () => {
  assert.equal(shouldIncludePassageGroupForPracticeMode({}, 'full'), true);
  assert.equal(shouldIncludePassageGroupForPracticeMode({}, 'nta'), true);
  assert.equal(shouldIncludeQuestionForPracticeMode({ passage_group_id: 'pg1' }, 'full'), true);
  assert.equal(shouldIncludeQuestionForPracticeMode({ passage_group_id: 'pg1' }, 'nta'), true);
});

test('standalone English verbal items remain available in Quick Practice', () => {
  assert.equal(shouldIncludeQuestionForPracticeMode({ question_type: 'para_jumble' }, 'quick'), true);
  assert.equal(shouldIncludeQuestionForPracticeMode({ question_type: 'vocabulary' }, 'quick'), true);
});
