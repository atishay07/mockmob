import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const llmSource = readFileSync(new URL('../lib/llm.mjs', import.meta.url), 'utf8');

test('DeepSeek generation uses model-specific timeout and message', () => {
  assert.match(llmSource, /DEEPSEEK_PRO_TIMEOUT_MS/);
  assert.match(llmSource, /DEEPSEEK_FLASH_TIMEOUT_MS/);
  assert.match(llmSource, /DEEPSEEK_CHAT_TIMEOUT_MS/);
  assert.match(llmSource, /\$\{generationProvider\} timeout after \$\{timeoutMs\}ms/);
});

test('DeepSeek timeout or empty response retries once with smaller batch before DeepSeek fallback', () => {
  assert.match(llmSource, /generation_retry/);
  assert.match(llmSource, /Math\.floor\(subBatchSize \/ 2\)/);
  assert.match(llmSource, /generation_fallback/);
  assert.match(llmSource, /empty_response/);
});

test('generation model list is DeepSeek-only by default', () => {
  assert.match(llmSource, /ALLOW_OPENAI_GENERATION/);
  assert.match(llmSource, /const GENERATION_MODELS = deepseek \? DEEPSEEK_GENERATION_MODELS : \[\]/);
  assert.doesNotMatch(llmSource, /const OPENAI_GENERATION_MODEL/);
});

test('DeepSeek health disables Pro after repeated empty or timeout responses', () => {
  assert.match(llmSource, /pro_empty_count/);
  assert.match(llmSource, /pro_timeout_count/);
  assert.match(llmSource, /PRO_EMPTY_DISABLE_THRESHOLD/);
  assert.match(llmSource, /PRO_TIMEOUT_DISABLE_THRESHOLD/);
  assert.match(llmSource, /pro_disabled_until/);
});
