import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRouteFailure } from '../tools/analyzeRouteFailures.mjs';

test('detects passage_group_linking_bug', () => {
  const result = analyzeRouteFailure({
    route: { subject: 'english', chapter: 'Factual Passage', route_type: 'passage' },
    metrics: { subject: 'english', chapter: 'Factual Passage', route_type: 'passage', generated_count: 4, passage_groups_generated: 1, passage_child_missing_group: true },
  });
  assert.equal(result.primary_reason, 'PASSAGE_GROUP_LINKING_BUG');
});

test('detects generator_quality_weak', () => {
  const result = analyzeRouteFailure({
    route: { subject: 'business_studies', chapter: 'Principles of Management' },
    metrics: { generated_count: 10, normalized_count: 10, selfcheck_passed: 0, published_count: 0 },
    dumps: { selfcheck: ['weak_distractors', 'direct_definition'] },
  });
  assert.equal(result.primary_reason, 'GENERATOR_QUALITY_WEAK');
});

test('detects self_check_too_strict', () => {
  const result = analyzeRouteFailure({
    route: { subject: 'english', chapter: 'Factual Passage', route_type: 'passage' },
    metrics: { route_type: 'passage', generated_count: 4, passage_groups_generated: 1, selfcheck_rejection_rate: 0.9, published_count: 0 },
    selfcheck_reason_counts: { central_idea: 3 },
  });
  assert.equal(result.primary_reason, 'SELF_CHECK_TOO_STRICT');
});

test('detects model_routing_bad', () => {
  const result = analyzeRouteFailure({
    route: { subject: 'economics', chapter: 'Money & Banking', route_type: 'standalone' },
    metrics: { generator_model: 'deepseek-v4-pro', live_questions_per_hour: 20, published_count: 2 },
  });
  assert.equal(result.primary_reason, 'MODEL_ROUTING_BAD');
});

test('detects cost_speed_bottleneck', () => {
  const result = analyzeRouteFailure({
    route: { subject: 'mathematics', chapter: 'Probability', route_type: 'standalone' },
    metrics: { published_count: 3, cost_per_1000_live: 12, live_questions_per_hour: 150 },
  });
  assert.equal(result.primary_reason, 'COST_SPEED_BOTTLENECK');
});
