import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyQualityBand,
  isPublishAllowedByQuality,
  shouldRequireStrictValidation,
} from '../lib/qualityMode.mjs';

const goodValidation = {
  verdict: 'accept',
  score: 0.82,
  exam_quality: 0.80,
  distractor_quality: 0.78,
  conceptual_depth: 0.70,
  trap_quality: 'medium',
  cuet_alignment: true,
  answer_confidence: 0.96,
  factual_accuracy: true,
};

test('speed mode publishes A/B if thresholds pass', () => {
  assert.equal(classifyQualityBand(goodValidation), 'A');
  assert.equal(isPublishAllowedByQuality(goodValidation, {}, 'speed', 'mini').allowed, true);
});

test('balanced mode escalates low anchor and mini score below 8.5', () => {
  const decision = shouldRequireStrictValidation({ anchor_confidence: 'low' }, goodValidation, 'balanced');
  assert.equal(decision.required, true);
  assert.ok(decision.reasons.includes('balanced_low_anchor_confidence'));
  assert.ok(decision.reasons.includes('balanced_mini_score_below_8_5'));
});

test('premium mode requires strict/audit validator', () => {
  const premiumValidation = { ...goodValidation, score: 0.91, exam_quality: 0.9, distractor_quality: 0.86, conceptual_depth: 0.8, quality_band: 'A_PLUS' };
  assert.equal(isPublishAllowedByQuality(premiumValidation, {}, 'premium', 'mini').allowed, false);
  assert.equal(isPublishAllowedByQuality(premiumValidation, {}, 'premium', 'strict').allowed, true);
});

test('premium mode rejects score 8.0', () => {
  const decision = isPublishAllowedByQuality({ ...goodValidation, score: 0.80, quality_band: 'A' }, {}, 'premium', 'strict');
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('score_below_quality_mode_threshold'));
});

test('premium mode rejects low anchor unless strict score reaches 9', () => {
  const decision = isPublishAllowedByQuality({
    ...goodValidation,
    score: 0.88,
    exam_quality: 0.88,
    distractor_quality: 0.85,
    conceptual_depth: 0.78,
    quality_band: 'A_PLUS',
  }, { anchor_confidence: 'low' }, 'premium', 'strict');
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes('premium_low_anchor_requires_9'));
});
