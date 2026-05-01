import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workerSource = readFileSync(new URL('../autonomous/worker.mjs', import.meta.url), 'utf8');
const llmSource = readFileSync(new URL('../lib/llm.mjs', import.meta.url), 'utf8');

test('repair layer cannot bypass selfCheck', () => {
  const repairIndex = llmSource.indexOf('repairGeneratedJson');
  const normalizeIndex = llmSource.indexOf('normalizeGeneratedQuestions');
  assert.ok(repairIndex > -1);
  assert.ok(normalizeIndex > repairIndex);
  assert.match(workerSource, /runSelfCheck/);
});

test('repaired question cannot publish without validation', () => {
  assert.match(workerSource, /selectedForValidation/);
  assert.match(workerSource, /validateMiniBatch/);
  assert.match(workerSource, /strict_cuet_validated !== true/);
});

test('no unvalidated publish and no fallback publish are still guarded', () => {
  assert.match(workerSource, /fallback_never_publishes/);
  assert.match(workerSource, /structural_fallback_never_publishes/);
  assert.match(workerSource, /not_strictly_validated/);
});

test('GPT and Gemini are not original generation providers', () => {
  assert.doesNotMatch(llmSource, /generateWithOpenAI/);
  assert.doesNotMatch(llmSource, /genAI\.getGenerativeModel\([^)]*\)[\s\S]{0,300}generateQuestions/);
  assert.match(llmSource, /generateWithDeepSeekOnly/);
});
