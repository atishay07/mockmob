export const DIFFICULTY_POLICY_V713 = 'cuet-demand-bands-v713';
export const DIFFICULTY_SCHEMA_V713 = Object.freeze({ type: 'object', additionalProperties: false,
  required: ['level', 'reason', 'comparison_basis'], properties: {
    level: { type: 'string', enum: ['easy', 'medium', 'hard'] }, reason: { type: 'string' },
    comparison_basis: { type: 'string', enum: ['authenticated_exemplar', 'heuristic'] },
  } });

// Difficulty never overrides eligibility. Require both independent assessments and retain disagreement.
export function assessDifficultyV713(checks) {
  const names = ['blind_solution', 'independent_evaluation'];
  const levels = ['easy', 'medium', 'hard'];
  const observations = names.map(stage => ({ stage, provider: checks?.[stage]?.provider,
    assessment: checks?.[stage]?.difficulty_assessment }));
  if (observations.some(o => !levels.includes(o.assessment?.level) || typeof o.assessment?.reason !== 'string' ||
      !o.assessment.reason.trim() || !['authenticated_exemplar', 'heuristic'].includes(o.assessment.comparison_basis))) {
    return { passed: false, reason: 'independent_difficulty_assessment_missing', observations };
  }
  if (observations[0].provider === observations[1].provider || !observations[0].provider || !observations[1].provider) {
    return { passed: false, reason: 'difficulty_assessments_not_independent', observations };
  }
  const distinct = new Set(observations.map(o => o.assessment.level));
  // Conservative band: a credible hard assessment keeps the item out of ordinary NTA selection until shortage.
  const level = levels[Math.max(...observations.map(o => levels.indexOf(o.assessment.level)))];
  if (level === 'hard' && distinct.size !== 1) {
    return { passed: false, version: DIFFICULTY_POLICY_V713, reason: 'hard_demand_not_independently_confirmed',
      level, agreement: false, observations };
  }
  return { passed: true, version: DIFFICULTY_POLICY_V713, level, agreement: distinct.size === 1, observations,
    purpose: level === 'easy' ? 'warmup' : level === 'medium' ? 'cuet_core' : 'hard_practice',
    nta_policy: level === 'hard' ? 'fallback_only_after_easy_medium_shortage' : 'preferred_medium_then_easy' };
}
