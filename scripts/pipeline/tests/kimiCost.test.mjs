import test from 'node:test';
import assert from 'node:assert/strict';
import { getModelCostBreakdown, recordCost } from '../lib/llm.mjs';

test('Kimi cost estimate uses env pricing defaults', () => {
  const before = getModelCostBreakdown()['kimi-k2.6']?.cost_usd || 0;
  const cost = recordCost('kimi-k2.6', 1000, 1000);
  const after = getModelCostBreakdown()['kimi-k2.6'];
  assert.ok(cost > 0);
  assert.ok(after.cost_usd > before);
  assert.equal(after.input_tokens >= 1000, true);
  assert.equal(after.output_tokens >= 1000, true);
});

test('model usage breakdown cost_usd is nonzero when token usage exists', () => {
  recordCost('deepseek-v4-flash', 500, 500);
  const breakdown = getModelCostBreakdown();
  assert.ok(breakdown['deepseek-v4-flash'].cost_usd > 0);
});
