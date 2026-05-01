import test from 'node:test';
import assert from 'node:assert/strict';
import { runMetricsSnapshot } from '../autonomous/worker.mjs';

test('run metrics include live question and candidate rates', () => {
  const snapshot = runMetricsSnapshot();
  assert.equal(typeof snapshot.live_questions_per_hour, 'number');
  assert.equal(typeof snapshot.generated_candidates_per_hour, 'number');
  assert.ok('model_usage_breakdown' in snapshot);
});

test('model performance metrics expose latency and cost fields when present', () => {
  const snapshot = runMetricsSnapshot();
  assert.equal(typeof snapshot.cost_per_1000_live, 'number');
  assert.equal(typeof snapshot.average_job_duration_ms, 'number');
});
