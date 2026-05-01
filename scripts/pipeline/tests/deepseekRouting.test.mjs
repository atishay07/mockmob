import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const llmSource = readFileSync(new URL('../lib/llm.mjs', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../autonomous/worker.mjs', import.meta.url), 'utf8');

test('DeepSeek Pro, Flash, Chat are the generation priority order', () => {
  const proIndex = llmSource.indexOf('DEEPSEEK_PRO_MODEL');
  const flashIndex = llmSource.indexOf('DEEPSEEK_FLASH_MODEL');
  const chatIndex = llmSource.indexOf('DEEPSEEK_CHAT_MODEL');
  assert.ok(proIndex > -1);
  assert.ok(flashIndex > proIndex);
  assert.ok(chatIndex > flashIndex);
  assert.match(llmSource, /DEEPSEEK_GENERATION_MODELS = \[/);
});

test('GPT is not present in generation model constants or worker generation fallback', () => {
  assert.doesNotMatch(llmSource, /OPENAI_GENERATION_MODEL/);
  assert.doesNotMatch(workerSource, /GENERATION_FALLBACK_MODEL/);
  assert.doesNotMatch(workerSource, /modelOverride:\s*['"]gpt-4o-mini['"]/);
});

test('OpenAI generation override is blocked when disabled, while GPT validator models remain configured', () => {
  assert.match(llmSource, /blocked_openai_generation_override/);
  assert.match(llmSource, /CHEAP_VALIDATOR_MODEL = process\.env\.CHEAP_VALIDATOR_MODEL \|\| 'gpt-4o-mini'/);
  assert.match(llmSource, /STRICT_VALIDATOR_MODEL = process\.env\.STRICT_VALIDATOR_MODEL \|\| 'gpt-4o'/);
});

test('all DeepSeek generation failures defer the job instead of generating with GPT', () => {
  assert.match(llmSource, /all_deepseek_generation_models_failed|generator_unavailable/);
  assert.match(llmSource, /action: 'defer_job'/);
  assert.match(workerSource, /\[generator_unavailable\]/);
  assert.match(workerSource, /deferred:/);
});
