export const FAILURE_CATEGORIES = [
  'ROUTING_OVERRIDE_BUG',
  'GENERATION_SCHEMA_BUG',
  'GENERATOR_QUALITY_WEAK',
  'SELF_CHECK_TOO_STRICT',
  'SELF_CHECK_TOO_LOOSE',
  'VALIDATOR_MISMATCH',
  'PASSAGE_GROUP_LINKING_BUG',
  'PUBLISHING_BUG',
  'MODEL_ROUTING_BAD',
  'ANCHOR_MISMATCH',
  'COST_SPEED_BOTTLENECK',
  'NEEDS_STRONGER_GENERATOR',
];

export function analyzeRouteFailure(routeRun = {}) {
  const reasons = [];
  const metrics = routeRun.metrics || routeRun.scorecard || routeRun;
  const route = routeRun.route || {};
  const dumps = routeRun.dumps || {};
  const isPassage = route.route_type === 'passage' || metrics.route_type === 'passage' || Number(metrics.passage_groups_generated || 0) > 0;

  if (metrics.subject && route.subject && normalize(metrics.subject) !== normalize(route.subject)) {
    return diagnosis('ROUTING_OVERRIDE_BUG', ['subject mismatch'], 'Fix override parsing and worker queued-job filtering.');
  }
  if (metrics.chapter && route.chapter && normalize(metrics.chapter) !== normalize(route.chapter)) {
    return diagnosis('ROUTING_OVERRIDE_BUG', ['chapter mismatch'], 'Fix route alias resolution or override chapter filtering.');
  }

  if (isPassage && (metrics.passage_child_missing_group || hasReason(dumps, 'passage_child_missing_group'))) {
    return diagnosis('PASSAGE_GROUP_LINKING_BUG', ['passage child missing group id/key'], 'Fix passage_group_id creation and child assignment before publish.');
  }
  if (isPassage && Number(metrics.published_count || 0) > 0 && Number(metrics.passage_groups_published || 0) === 0) {
    return diagnosis('PASSAGE_GROUP_LINKING_BUG', ['children appear publishable without parent group'], 'Block standalone child publish and publish parent group first.');
  }

  const mismatch = Number(metrics.validator_sent || 0) > 0 && Number(metrics.validator_result_count || metrics.validator_sent || 0) !== Number(metrics.validator_sent || 0);
  if (mismatch || hasReason(dumps, 'validator_count_mismatch')) {
    return diagnosis('VALIDATOR_MISMATCH', ['validator result count mismatch'], 'Retry missing candidate_id results one-by-one; do not discard the whole batch.');
  }

  const selfcheckRate = Number(metrics.selfcheck_rejection_rate || 0);
  if (selfcheckRate > 0.85 && repeatedSelfCheckReason(routeRun, ['central_idea', 'author_purpose', 'vocabulary_without_passage_context', 'weak_distractors'])) {
    return diagnosis('SELF_CHECK_TOO_STRICT', ['valid route pattern rejected by selfCheck'], 'Loosen only the exact subject-mode selfCheck rule and rerun.');
  }

  if (isPassage && Number(metrics.generated_count || 0) > 0 && Number(metrics.passage_groups_generated || 0) === 0) {
    return diagnosis('GENERATION_SCHEMA_BUG', ['passage route produced standalone questions'], 'Force passage_group schema for this English route.');
  }
  if (Number(metrics.normalized_count || 0) === 0 && Number(metrics.generated_count || 0) > 0) {
    return diagnosis('GENERATION_SCHEMA_BUG', ['raw generated output did not normalize'], 'Inspect raw_generation.json and tighten JSON repair or schema prompt.');
  }
  if (Number(metrics.selfcheck_passed || 0) > Number(metrics.validator_accepted || 0) * 4 && Number(metrics.validator_accepted || 0) === 0) {
    reasons.push('SELF_CHECK_TOO_LOOSE');
  }

  if (hasReason(dumps, 'weak_distractors') || hasReason(dumps, 'direct_definition') || hasReason(dumps, 'generic_stem')) {
    reasons.push('GENERATOR_QUALITY_WEAK');
  }

  if (hasReason(dumps, 'wrong_anchor') || metrics.anchor_confidence === 'low' || metrics.main_failure_reason === 'ANCHOR_MISMATCH') {
    reasons.push('ANCHOR_MISMATCH');
  }

  if (route.expected_generator && metrics.generator_model && !String(metrics.generator_model).includes(route.expected_generator)) {
    reasons.push('MODEL_ROUTING_BAD');
  }
  if (/deepseek-v4-pro/i.test(String(metrics.generator_model || '')) && !isPassage && Number(metrics.live_questions_per_hour || 0) < 80) {
    reasons.push('MODEL_ROUTING_BAD');
  }

  const costTooHigh = Number(metrics.cost_per_1000_live || 0) > (isPassage ? 25 : 8);
  const speedTooLow = Number(metrics.live_questions_per_hour || 0) > 0 && Number(metrics.live_questions_per_hour || 0) < (isPassage ? 20 : 80);
  if ((costTooHigh || speedTooLow) && Number(metrics.published_count || 0) > 0) {
    reasons.push('COST_SPEED_BOTTLENECK');
  }
  if (Number(metrics.cost_total || 0) > 0 && Number(metrics.published_count || 0) === 0) {
    reasons.push('COST_SPEED_BOTTLENECK');
  }

  if (Number(metrics.validator_accepted || 0) > 0 && Number(metrics.published_count || 0) === 0) {
    reasons.push('PUBLISHING_BUG');
  }

  if (Number(metrics.generated_count || 0) > 0 && Number(metrics.selfcheck_passed || 0) === 0) {
    reasons.push('GENERATOR_QUALITY_WEAK');
  }
  if (Number(metrics.generated_count || 0) === 0 && /empty|timeout|truncated|model/i.test(String(routeRun.error || metrics.error || ''))) {
    reasons.push('NEEDS_STRONGER_GENERATOR');
  }

  const primary = reasons[0] || (Number(metrics.published_count || 0) === 0 ? 'GENERATOR_QUALITY_WEAK' : null);
  if (!primary) return diagnosis(null, [], 'No immediate fix required.');
  return diagnosis(primary, reasons.slice(1), recommendedFix(primary));
}

function diagnosis(primary, secondary, recommendedFix) {
  return {
    primary_reason: primary,
    secondary_reasons: [...new Set(secondary.filter(Boolean))],
    recommended_fix: recommendedFix,
  };
}

function recommendedFix(reason) {
  switch (reason) {
    case 'ROUTING_OVERRIDE_BUG':
      return 'Fix override parsing / worker fallback / queued job filtering and add route selection tests.';
    case 'GENERATION_SCHEMA_BUG':
      return 'Tighten generation schema or JSON repair; do not weaken validation.';
    case 'GENERATOR_QUALITY_WEAK':
      return 'Improve prompt or add exact route anchor; keep validator thresholds intact.';
    case 'SELF_CHECK_TOO_STRICT':
      return 'Loosen only the route-specific selfCheck rule that rejected valid CUET patterns.';
    case 'SELF_CHECK_TOO_LOOSE':
      return 'Tighten selfCheck for the exact weak pattern that validators reject.';
    case 'VALIDATOR_MISMATCH':
      return 'Map validator results by candidate_id and retry only missing candidates.';
    case 'PASSAGE_GROUP_LINKING_BUG':
      return 'Create passage group before child publish and require non-empty passage_group_id.';
    case 'PUBLISHING_BUG':
      return 'Inspect publish_results.json and DB constraints for accepted-but-unpublished rows.';
    case 'MODEL_ROUTING_BAD':
      return 'Adjust generator selection for this route only; prefer Flash for simple routes.';
    case 'ANCHOR_MISMATCH':
      return 'Add or fix exact manual anchor for this route.';
    case 'COST_SPEED_BOTTLENECK':
      return 'Reduce wasted retries or strict validation where quality already passes.';
    case 'NEEDS_STRONGER_GENERATOR':
      return 'Run generator A/B test; do not keep patching selfCheck or validator.';
    default:
      return 'Review route samples.';
  }
}

function hasReason(dumps, reason) {
  const text = JSON.stringify(dumps || {}).toLowerCase();
  return text.includes(String(reason || '').toLowerCase());
}

function repeatedSelfCheckReason(routeRun, candidates) {
  const reasons = routeRun.selfcheck_reason_counts || routeRun.metrics?.selfcheck_reason_counts || {};
  return candidates.some((reason) => Number(reasons[reason] || 0) > 0) || hasReason(routeRun.dumps, candidates[0]);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}
