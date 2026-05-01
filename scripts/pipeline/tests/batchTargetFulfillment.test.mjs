import test from 'node:test';
import assert from 'node:assert/strict';
import { getGenerationLoopConfigForModel, getSubBatchRequestCountsForTarget } from '../lib/llm.mjs';

test('target 10 with Flash batch 8 plans a second sub-batch', () => {
  assert.deepEqual(getSubBatchRequestCountsForTarget(10, 'deepseek-v4-flash'), [8, 2]);
});

test('normal Flash jobs can generate 8-16 candidates while Pro stays small', () => {
  const flash = getGenerationLoopConfigForModel('deepseek-v4-flash');
  const pro = getGenerationLoopConfigForModel('deepseek-v4-pro');
  assert.equal(flash.batchSize, 8);
  assert.equal(flash.maxGenerationCallsPerJob, 2);
  assert.equal(flash.maxCandidatesPerJob, 16);
  assert.equal(pro.batchSize, 3);
  assert.equal(pro.maxGenerationCallsPerJob, 1);
});
