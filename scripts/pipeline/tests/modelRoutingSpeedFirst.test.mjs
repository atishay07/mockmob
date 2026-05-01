import test from 'node:test';
import assert from 'node:assert/strict';
import { selectGenerationModel } from '../lib/llm.mjs';

test('Flash is selected for normal speed-first jobs', () => {
  assert.equal(selectGenerationModel({ subject: 'economics', question_type: 'statement_based', anchor_match_level: 'structure_only' }), 'deepseek-v4-flash');
  assert.equal(selectGenerationModel({ subject: 'computer_science', chapter: 'Boolean Algebra', question_type: 'application_based', anchor_match_level: 'exact_chapter' }), 'deepseek-v4-flash');
  assert.equal(selectGenerationModel({ subject: 'english', question_type: 'para_jumble', requires_passage: false }), 'deepseek-v4-flash');
});

test('Pro is selected only for complex jobs', () => {
  assert.equal(selectGenerationModel({ subject: 'english', requires_passage: true }), 'deepseek-v4-pro');
  assert.equal(selectGenerationModel({ subject: 'mathematics', question_type: 'statement_based' }), 'deepseek-v4-pro');
  assert.equal(selectGenerationModel({ subject: 'physics', question_type: 'application_based', anchor_match_level: 'exact_chapter' }), 'deepseek-v4-pro');
  assert.equal(selectGenerationModel({ subject: 'chemistry', question_type: 'reaction_logic', anchor_match_level: 'exact_chapter' }), 'deepseek-v4-pro');
});

test('GPT is never selected for generation', () => {
  assert.notEqual(selectGenerationModel({ subject: 'english', question_type: 'vocabulary' }), 'gpt-4o-mini');
  assert.notEqual(selectGenerationModel({ subject: 'physics', question_type: 'case_based' }), 'gpt-4o');
});
