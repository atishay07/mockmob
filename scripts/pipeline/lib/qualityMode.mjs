const THRESHOLDS = {
  speed: {
    score: 0.72,
    exam_quality: 0.70,
    distractor_quality: 0.70,
    conceptual_depth: 0.60,
    answer_confidence: 0,
    allowed_bands: ['A_PLUS', 'A', 'B'],
    strict_required: false,
  },
  balanced: {
    score: 0.80,
    exam_quality: 0.75,
    distractor_quality: 0.75,
    conceptual_depth: 0.68,
    answer_confidence: 0,
    allowed_bands: ['A_PLUS', 'A'],
    strict_required: false,
  },
  premium: {
    score: 0.87,
    exam_quality: 0.85,
    distractor_quality: 0.83,
    conceptual_depth: 0.75,
    answer_confidence: 0.95,
    allowed_bands: ['A_PLUS'],
    strict_required: true,
  },
};

export function normalizeQualityMode(value = process.env.CUET_QUALITY_MODE || 'speed') {
  const mode = String(value || 'speed').trim().toLowerCase();
  return THRESHOLDS[mode] ? mode : 'speed';
}

export function getQualityThresholds(mode = 'speed') {
  return THRESHOLDS[normalizeQualityMode(mode)];
}

function unit(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  if (n > 10) return Math.min(1, n / 100);
  if (n > 1) return Math.min(1, n / 10);
  return Math.max(0, Math.min(1, n));
}

export function classifyQualityBand(validation = {}) {
  const score = unit(validation.score);
  if (score >= 0.90) return 'A_PLUS';
  if (score >= 0.80) return 'A';
  if (score >= 0.70) return 'B';
  return 'C';
}

export function shouldRequireStrictValidation(question = {}, miniValidation = {}, mode = 'speed') {
  const normalized = normalizeQualityMode(mode);
  const score = unit(miniValidation.score);
  const reasons = [];
  if (normalized === 'premium') reasons.push('premium_requires_strict_or_audit');
  if (normalized === 'balanced' && question.anchor_confidence === 'low') reasons.push('balanced_low_anchor_confidence');
  if (normalized === 'balanced' && ['medium', 'high'].includes(String(question.concept_mismatch_risk || '').toLowerCase())) reasons.push('balanced_concept_mismatch');
  if (normalized === 'balanced' && score < 0.85) reasons.push('balanced_mini_score_below_8_5');
  if (question.is_passage_linked === true || question.passage_id || question.temporary_group_key) reasons.push('passage_group_strict_review');
  if (['physics', 'chemistry', 'mathematics'].includes(question.subject) && /numerical|application|case/i.test(question.question_type || '')) {
    reasons.push('stem_subject_high_risk');
  }
  return { required: reasons.length > 0, reasons };
}

export function isPublishAllowedByQuality(validation = {}, question = {}, mode = 'speed', layer = 'mini') {
  const normalized = normalizeQualityMode(mode);
  const thresholds = getQualityThresholds(normalized);
  const band = validation.quality_band || classifyQualityBand(validation);
  const answerConfidence = validation.answer_confidence === undefined ? 1 : unit(validation.answer_confidence);
  const factualAccuracy = validation.factual_accuracy === undefined ? true : validation.factual_accuracy === true;
  const reasons = [];

  if (String(validation.verdict || '').toLowerCase() !== 'accept') reasons.push('validator_not_accept');
  if (unit(validation.score) < thresholds.score) reasons.push('score_below_quality_mode_threshold');
  if (unit(validation.exam_quality) < thresholds.exam_quality) reasons.push('exam_quality_below_quality_mode_threshold');
  if (unit(validation.distractor_quality) < thresholds.distractor_quality) reasons.push('distractor_quality_below_quality_mode_threshold');
  if (unit(validation.conceptual_depth) < thresholds.conceptual_depth) reasons.push('conceptual_depth_below_quality_mode_threshold');
  if (String(validation.trap_quality || '').toLowerCase() === 'low') reasons.push('trap_quality_low');
  if (validation.cuet_alignment !== true) reasons.push('cuet_alignment_false');
  if (!thresholds.allowed_bands.includes(band)) reasons.push(`quality_band_${band}_not_allowed`);
  if (answerConfidence < thresholds.answer_confidence) reasons.push('answer_confidence_below_threshold');
  if (!factualAccuracy) reasons.push('factual_accuracy_failed');
  if (normalized === 'premium' && layer !== 'strict' && layer !== 'premium_audit') reasons.push('premium_requires_strict_or_audit');
  if (normalized === 'premium' && question.anchor_confidence === 'low' && unit(validation.score) < 0.90) reasons.push('premium_low_anchor_requires_9');
  if (normalized === 'premium' && ['medium', 'high'].includes(String(question.concept_mismatch_risk || '').toLowerCase())) {
    reasons.push('premium_concept_mismatch_not_allowed');
  }

  return {
    allowed: reasons.length === 0,
    band,
    reasons,
    thresholds,
  };
}
