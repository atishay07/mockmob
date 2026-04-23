// Exposure budgets per tier (qualified exposures)
export const EXPOSURE_BUDGETS = { A: 24, B: 10, C: 6, REJECT: 0 }

// Exploration lane per tier
export const EXPLORATION_LANES = { A: 'standard', B: 'standard', C: 'shadow', REJECT: 'none' }

/**
 * Assigns the final tier, combining rule violations with LLM scores.
 * Rule hard-violations always override LLM output.
 */
export function assignTier(ruleViolations, llmResult) {
  // Hard rule violations → always REJECT
  if (ruleViolations.some(v => v.severity === 'hard')) {
    return 'REJECT'
  }

  // LLM failed to parse → fall back to C (manual review)
  if (!llmResult) return 'C'

  // LLM explicit reject
  if (llmResult.tier === 'REJECT') return 'REJECT'

  // Duplicate risk threshold — even if LLM says A/B, high dup risk → REJECT
  if ((llmResult.duplicate_risk_score ?? 0) >= 0.90) return 'REJECT'

  // Trust LLM tier for A/B/C, but clamp up for soft violations
  const hasSoftViolations = ruleViolations.some(v => v.severity === 'soft')
  if (hasSoftViolations && llmResult.tier === 'A') return 'B'

  return llmResult.tier ?? 'C'
}

/**
 * Computes the composite ai_score from component scores.
 * Matches the weights used in the system plan.
 */
export function computeAiScore(scores) {
  if (!scores) return 0
  const {
    clarity_score = 0,
    syllabus_relevance_score = 0,
    answerability_score = 0,
    explanation_quality_score = 0,
    duplicate_risk_score = 0,
  } = scores

  return (
    clarity_score            * 0.20 +
    syllabus_relevance_score * 0.20 +
    answerability_score      * 0.20 +
    explanation_quality_score * 0.20 +
    (1 - duplicate_risk_score) * 0.20
  )
}
