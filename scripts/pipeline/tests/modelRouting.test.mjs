import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectGenerationModel } from '../lib/llm.mjs';

const llmSource = readFileSync(new URL('../lib/llm.mjs', import.meta.url), 'utf8');
const repairSource = readFileSync(new URL('../lib/jsonRepair.mjs', import.meta.url), 'utf8');

test('Flash selected for simple standalone questions', () => {
  assert.equal(selectGenerationModel({
    subject: 'sociology',
    question_type: 'statement_based',
    anchor_confidence: 'high',
    requires_passage: false,
  }), 'deepseek-v4-flash');
});

test('Pro selected for passage, mathematics, and exact-anchor Physics numerical/application tasks', () => {
  assert.equal(selectGenerationModel({ subject: 'english', requires_passage: true }), 'deepseek-v4-pro');
  assert.equal(selectGenerationModel({ subject: 'mathematics', question_type: 'statement_based' }), 'deepseek-v4-pro');
  assert.equal(selectGenerationModel({ subject: 'physics', question_type: 'numerical_one_step', anchor_match_level: 'exact_chapter' }), 'deepseek-v4-pro');
});

test('low-confidence anchors no longer force Pro for normal jobs', () => {
  assert.equal(selectGenerationModel({ subject: 'economics', question_type: 'statement_based', anchor_confidence: 'low' }), 'deepseek-v4-flash');
});

test('GPT is never selected for generation', () => {
  assert.doesNotMatch(llmSource, /const OPENAI_GENERATION_MODEL/);
  assert.match(llmSource, /blocked_openai_generation_override/);
  assert.match(llmSource, /ALLOW_OPENAI_GENERATION/);
  assert.match(llmSource, /KIMI_GENERATION_MODELS/);
});

test('Gemini is primary repair provider and GPT-4o-mini is repair fallback or validator only', () => {
  assert.match(repairSource, /JSON_REPAIR_PROVIDER.*gemini/);
  assert.match(repairSource, /gemini-2\.5-flash-lite/);
  assert.match(repairSource, /JSON_REPAIR_FALLBACK_MODEL.*gpt-4o-mini/);
  assert.match(llmSource, /CHEAP_VALIDATOR_MODEL.*gpt-4o-mini/);
});

test('DeepSeek Chat is final repair fallback', () => {
  assert.match(repairSource, /JSON_REPAIR_SECOND_FALLBACK_MODEL.*deepseek-chat/);
  assert.match(repairSource, /response_format:\s*\{\s*type:\s*'json_object'\s*\}/);
});

test('Pro disabled after repeated reasoning exhausted output budget', () => {
  assert.match(llmSource, /pro_reasoning_exhausted_count/);
  assert.match(llmSource, /pro_disabled_until/);
});
