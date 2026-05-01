const QUALITY_THRESHOLDS = {
  speed: { passage: 7.0, minChildren: 2, preferredChildren: 4 },
  balanced: { passage: 7.5, minChildren: 2, preferredChildren: 4 },
  premium: { passage: 8.5, minChildren: 3, preferredChildren: 4 },
};

function normalizeMode(mode = 'speed') {
  return ['speed', 'balanced', 'premium'].includes(String(mode || '').toLowerCase())
    ? String(mode).toLowerCase()
    : 'speed';
}

function unit(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  if (n > 10) return Math.min(1, n / 100);
  if (n > 1) return Math.min(1, n / 10);
  return Math.max(0, Math.min(1, n));
}

function ten(value) {
  return Number((unit(value) * 10).toFixed(1));
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function bandForScore(score) {
  if (score >= 9) return 'A_PLUS';
  if (score >= 8) return 'A';
  if (score >= 7) return 'B';
  return 'C';
}

function expectedPassageType(chapter = '') {
  const value = String(chapter || '').toLowerCase();
  if (value.includes('narrative')) return 'narrative';
  if (value.includes('literary')) return 'literary';
  if (value.includes('discursive')) return 'discursive';
  if (value.includes('prose')) return 'prose';
  return 'factual';
}

export function validatePassageQuality(group = {}, mode = 'speed') {
  const normalizedMode = normalizeMode(mode);
  const passageText = String(group?.passage_text || group?.passageText || '').trim();
  const chapter = String(group?.chapter || '').trim();
  const passageType = String(group?.passage_type || group?.passageType || '').trim().toLowerCase();
  const words = countWords(passageText);
  const issues = [];

  if (!passageText) issues.push('missing_passage_text');
  if (words < 300) issues.push('passage_too_short');
  if (words > 500) issues.push('passage_too_long');
  if (/\b(lorem ipsum|copyright|excerpt from|adapted from|famous speech|poem by|chapter from)\b/i.test(passageText)) {
    issues.push('copyright_or_source_risk');
  }
  if (/\b(cookie|picnic|birthday|toy|fairy|magic garden)\b/i.test(passageText) && passageType !== 'narrative') {
    issues.push('childish_simple_story');
  }
  if (!/\b(however|although|therefore|because|suggests|implies|reflects|contrast|purpose|change|response|tension|evidence|attitude)\b/i.test(passageText)) {
    issues.push('insufficient_inferential_material');
  }
  if (passageType && chapter && passageType !== expectedPassageType(chapter) && !(chapter === 'Reading Comprehension' && passageType === 'factual')) {
    issues.push('passage_type_mismatch');
  }

  let score = 9.0;
  if (words >= 300 && words <= 500) score += 0.4;
  if (/\b(however|although|therefore|because|suggests|implies|reflects|contrast|purpose|change|response|tension|evidence|attitude)\b/i.test(passageText)) score += 0.4;
  score -= issues.length * 1.1;
  score = Math.max(0, Math.min(10, score));

  const threshold = QUALITY_THRESHOLDS[normalizedMode].passage;
  const passageVerdict = score >= threshold && issues.length === 0 ? 'accept' : 'reject';

  return {
    passage_verdict: passageVerdict,
    passage_score: Number(score.toFixed(1)),
    passage_quality_band: bandForScore(score),
    passage_issues: issues,
    threshold,
  };
}

function validationBoolean(validation, key, fallback = false) {
  if (validation?.[key] === true) return true;
  if (validation?.[key] === false) return false;
  return fallback;
}

export function evaluatePassageChildAcceptance(question = {}, validation = {}, mode = 'speed') {
  const normalizedMode = normalizeMode(mode);
  const childScore = ten(validation?.score);
  const examQuality = ten(validation?.exam_quality ?? validation?.score);
  const distractorQuality = ten(validation?.distractor_quality ?? validation?.score);
  const answerConfidence = unit(validation?.answer_confidence ?? validation?.score);
  const factualAccuracy = unit(validation?.factual_accuracy === true ? 1 : validation?.factual_accuracy ?? 1);
  const passageDependency = validationBoolean(validation, 'passage_dependency', question?.is_passage_linked === true);
  const answerSupported = validationBoolean(validation, 'answer_supported_by_passage', passageDependency);
  const answerableWithoutPassage = validationBoolean(validation, 'answerable_without_passage', false);
  const multipleCorrectRisk = validationBoolean(validation, 'multiple_correct_risk', false);
  const answerCheck = String(question?.answer_check || question?.answerCheck || question?.explanation || '').trim();
  const hasGroup = Boolean(String(question?.temporary_group_key || question?.passage_group_id || question?.group_id || '').trim());
  const hasPassage = Boolean(String(question?.passage_text || question?.passageText || '').trim());
  const hardReasons = [];

  if (!hasGroup) hardReasons.push('passage_child_missing_group');
  if (!hasPassage) hardReasons.push('missing_passage_text');
  if (!answerCheck) hardReasons.push('answer_check_missing');
  if (!answerSupported) hardReasons.push('answer_not_supported_by_passage');
  if (answerableWithoutPassage) hardReasons.push('answerable_without_passage');
  if (multipleCorrectRisk) hardReasons.push('multiple_correct_risk');
  if (validation?.factual_accuracy === false || factualAccuracy < 0.9) hardReasons.push('factual_accuracy_failed');
  if (String(validation?.verdict || '').toLowerCase() === 'reject') hardReasons.push('validator_reject');

  let scorePass = false;
  if (normalizedMode === 'speed') {
    scorePass = childScore >= 6.0 || (passageDependency && factualAccuracy >= 0.9);
  } else if (normalizedMode === 'balanced') {
    scorePass = childScore >= 6.5 &&
      examQuality >= 6.5 &&
      distractorQuality >= 6.0 &&
      answerConfidence >= 0.85 &&
      passageDependency;
  } else {
    scorePass = childScore >= 8.0 &&
      examQuality >= 8.0 &&
      distractorQuality >= 7.5 &&
      answerConfidence >= 0.95 &&
      passageDependency;
  }

  if (!scorePass) hardReasons.push('passage_child_score_below_threshold');

  return {
    accepted: hardReasons.length === 0,
    reason: hardReasons[0] || null,
    reasons: hardReasons,
    child_score: childScore,
    passage_dependency: passageDependency,
    answer_supported_by_passage: answerSupported,
    answerable_without_passage: answerableWithoutPassage,
    multiple_correct_risk: multipleCorrectRisk,
  };
}

export function getPassageGroupPublishDecision({
  group = {},
  acceptedChildren = [],
  generatedChildren = [],
  mode = 'speed',
  passageQuality = null,
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const thresholds = QUALITY_THRESHOLDS[normalizedMode];
  const passage = passageQuality || validatePassageQuality(group, normalizedMode);
  const acceptedCount = Array.isArray(acceptedChildren) ? acceptedChildren.length : 0;
  const generatedCount = Array.isArray(generatedChildren) ? generatedChildren.length : acceptedCount;
  const passageAccepted = passage.passage_verdict === 'accept';
  const published = passageAccepted && acceptedCount >= thresholds.minChildren;
  const groupStatus = published && acceptedCount >= thresholds.preferredChildren ? 'complete' : published ? 'partial' : 'draft';

  return {
    passage,
    passage_score: passage.passage_score,
    passage_quality_band: passage.passage_quality_band,
    passage_verdict: passage.passage_verdict,
    generated_children: generatedCount,
    accepted_children: acceptedCount,
    min_required_children: thresholds.minChildren,
    preferred_children: thresholds.preferredChildren,
    group_status: groupStatus,
    needs_refill: published && acceptedCount < thresholds.preferredChildren,
    refill_target_children: published && acceptedCount < thresholds.preferredChildren ? Math.max(0, thresholds.preferredChildren - acceptedCount) : 0,
    published,
    draft_reason: !passageAccepted
      ? `passage_quality_failed:${passage.passage_issues.join(';') || 'score_below_threshold'}`
      : acceptedCount < thresholds.minChildren
        ? `passage_group_fewer_than_${thresholds.minChildren}_validated_children`
        : null,
  };
}

export function buildPassageRefillJobPayload({ group = {}, acceptedChildren = [], decision = {}, mode = 'speed' } = {}) {
  return {
    type: 'passage_group_refill',
    passage_group_id: group?.id || group?.passage_group_id || group?.temporary_group_key || null,
    passage_text: group?.passage_text || acceptedChildren?.[0]?.passage_text || '',
    existing_questions: (acceptedChildren || []).map((question) => question.q || question.body || question.question || '').filter(Boolean),
    target_additional_questions: decision.refill_target_children || 0,
    subject: group?.subject || acceptedChildren?.[0]?.subject || 'english',
    chapter: group?.chapter || acceptedChildren?.[0]?.chapter || '',
    quality_mode: normalizeMode(mode),
  };
}
