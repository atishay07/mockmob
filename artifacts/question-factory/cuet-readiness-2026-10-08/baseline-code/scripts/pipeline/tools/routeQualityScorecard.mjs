import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const ROUTE_STATUS = {
  PASS: 'PASS',
  DEGRADED_BUT_USABLE: 'DEGRADED_BUT_USABLE',
  FAIL: 'FAIL_NEEDS_MODEL_OR_ANCHOR_WORK',
};

export function routeKey(subject, chapter) {
  return `${normalizePart(subject)}__${normalizePart(chapter)}`;
}

export function buildRouteScorecard(input = {}) {
  const generatedCount = Number(input.generated_count || 0);
  const validatorAccepted = Number(input.validator_accepted || 0);
  const publishedCount = Number(input.published_count || 0);
  const validatorSent = Number(input.validator_sent || 0);
  const normalizedCount = Number(input.normalized_count || 0);
  const costTotal = Number(input.cost_total || 0);
  const avgLatencyMs = Number(input.avg_latency_ms || input.latency_ms || 0);
  const routeType = input.route_type || (Number(input.passage_groups_generated || 0) > 0 ? 'passage' : 'standalone');
  const qualityMode = input.quality_mode || 'speed';
  const selfcheckPassed = Number(input.selfcheck_passed || 0);
  const draftCount = Number(input.draft_count || 0);
  const passageGroupsPublished = Number(input.passage_groups_published || 0);
  const passageChildrenPublished = Number(input.passage_children_published || 0);
  const avgValidatorScore = roundMetric(input.avg_validator_score);
  const avgExamQuality = roundMetric(input.avg_exam_quality);
  const avgDistractorQuality = roundMetric(input.avg_distractor_quality);
  const avgAnswerConfidence = roundMetric(input.avg_answer_confidence);
  const avgPassageScore = roundMetric(input.avg_passage_score ?? avgValidatorScore);
  const validatorAcceptanceRate = validatorSent > 0 ? validatorAccepted / validatorSent : 0;
  const publishYieldRate = generatedCount > 0 ? publishedCount / generatedCount : 0;
  const selfcheckRejectionRate = normalizedCount > 0 ? Math.max(0, normalizedCount - selfcheckPassed) / normalizedCount : 0;
  const runHours = avgLatencyMs > 0 ? avgLatencyMs / 3600000 : 1;
  const liveQuestionsPerHour = Number(input.live_questions_per_hour ?? (publishedCount / Math.max(runHours, 1 / 3600))).toFixed ? Number(Number(input.live_questions_per_hour ?? (publishedCount / Math.max(runHours, 1 / 3600))).toFixed(1)) : 0;
  const generatedCandidatesPerHour = Number(input.generated_candidates_per_hour ?? (generatedCount / Math.max(runHours, 1 / 3600)));
  const costPerLiveQuestion = publishedCount > 0 ? costTotal / publishedCount : (costTotal > 0 ? Infinity : 0);
  const costPer1000Live = publishedCount > 0 ? costPerLiveQuestion * 1000 : (costTotal > 0 ? Infinity : 0);

  const scorecard = {
    subject: input.subject,
    chapter: input.chapter,
    route_type: routeType,
    generation_mode: input.generation_mode || routeType,
    quality_mode: qualityMode,
    generator_model: input.generator_model || 'unknown',
    validator_models: input.validator_models || [],
    route_status: input.route_status || null,
    generated_count: generatedCount,
    normalized_count: normalizedCount,
    selfcheck_passed: selfcheckPassed,
    validator_sent: validatorSent,
    validator_accepted: validatorAccepted,
    published_count: publishedCount,
    draft_count: draftCount,
    passage_groups_generated: Number(input.passage_groups_generated || 0),
    passage_groups_published: passageGroupsPublished,
    passage_children_published: passageChildrenPublished,
    avg_validator_score: avgValidatorScore,
    avg_exam_quality: avgExamQuality,
    avg_distractor_quality: avgDistractorQuality,
    avg_answer_confidence: avgAnswerConfidence,
    avg_passage_score: avgPassageScore,
    selfcheck_rejection_rate: roundRate(selfcheckRejectionRate),
    validator_acceptance_rate: roundRate(validatorAcceptanceRate),
    publish_yield_rate: roundRate(publishYieldRate),
    avg_latency_ms: Math.round(avgLatencyMs),
    live_questions_per_hour: Number(liveQuestionsPerHour),
    generated_candidates_per_hour: Number(generatedCandidatesPerHour.toFixed(1)),
    cost_total: roundMoney(costTotal),
    cost_per_live_question: Number.isFinite(costPerLiveQuestion) ? roundMoney(costPerLiveQuestion) : null,
    cost_per_1000_live: Number.isFinite(costPer1000Live) ? roundMoney(costPer1000Live) : null,
    expensive_but_acceptable: input.expensive_but_acceptable === true,
    fatal_structural_issue: input.fatal_structural_issue === true,
    main_failure_reason: input.main_failure_reason || null,
    recommended_fix: input.recommended_fix || null,
    sample_question_paths: input.sample_question_paths || [],
    needs_refill: input.needs_refill === true,
  };
  scorecard.route_status = input.route_status || classifyRouteStatus(scorecard);
  return scorecard;
}

export function classifyRouteStatus(scorecard = {}) {
  if (scorecard.fatal_structural_issue) return ROUTE_STATUS.FAIL;
  if (scorecard.route_type === 'passage') return classifyPassageRoute(scorecard);
  return classifyStandaloneRoute(scorecard);
}

export function summarizeScorecards(scorecards = []) {
  const counts = {
    routes_tested: scorecards.length,
    passed: 0,
    degraded_usable: 0,
    failed: 0,
  };
  let costTotal = 0;
  let liveTotal = 0;
  let speedTotal = 0;
  for (const card of scorecards) {
    if (card.route_status === ROUTE_STATUS.PASS) counts.passed += 1;
    else if (card.route_status === ROUTE_STATUS.DEGRADED_BUT_USABLE) counts.degraded_usable += 1;
    else counts.failed += 1;
    costTotal += Number(card.cost_total || 0);
    liveTotal += Number(card.published_count || 0);
    speedTotal += Number(card.live_questions_per_hour || 0);
  }
  return {
    ...counts,
    average_cost_per_1000_live: liveTotal > 0 ? roundMoney((costTotal / liveTotal) * 1000) : null,
    average_live_per_hour: scorecards.length > 0 ? Number((speedTotal / scorecards.length).toFixed(1)) : 0,
  };
}

export function writeMarkdownReport({ scorecards = [], summary = summarizeScorecards(scorecards), patchesApplied = [], reportPath }) {
  const bottlenecks = [...new Set(scorecards.map((card) => card.main_failure_reason).filter(Boolean))].slice(0, 5);
  const lines = [
    '# MockMob CUET Route Audit',
    '',
    '## Summary',
    `- Routes tested: ${summary.routes_tested}`,
    `- Passed: ${summary.passed}`,
    `- Degraded usable: ${summary.degraded_usable}`,
    `- Failed: ${summary.failed}`,
    `- Average cost per 1000 live: ${summary.average_cost_per_1000_live ?? 'n/a'}`,
    `- Average live/hour: ${summary.average_live_per_hour}`,
    `- Main bottlenecks: ${bottlenecks.length > 0 ? bottlenecks.join(', ') : 'none'}`,
    '',
    '## Route Scorecards',
  ];
  for (const card of scorecards) {
    lines.push(
      '',
      `### ${card.subject} / ${card.chapter}`,
      `- Status: ${card.route_status}`,
      `- Quality: score ${card.avg_validator_score}, distractors ${card.avg_distractor_quality}, exam ${card.avg_exam_quality}`,
      `- Speed: ${card.live_questions_per_hour}/hour live, ${card.generated_candidates_per_hour}/hour generated`,
      `- Cost: ${card.cost_per_1000_live ?? 'n/a'} per 1000 live`,
      `- Published count: ${card.published_count}`,
      `- Main failure reason: ${card.main_failure_reason || 'none'}`,
      `- Recommended next action: ${card.recommended_fix || 'none'}`,
      `- Sample output path: ${card.sample_question_paths?.[0] || 'n/a'}`,
    );
  }
  lines.push('', '## Immediate Fixes Applied');
  if (patchesApplied.length === 0) lines.push('- None');
  else for (const patch of patchesApplied) lines.push(`- ${patch}`);
  lines.push('', '## Do Not Fix Yet');
  const degraded = scorecards.filter((card) => card.route_status === ROUTE_STATUS.DEGRADED_BUT_USABLE);
  if (degraded.length === 0) lines.push('- None');
  else for (const card of degraded) lines.push(`- ${card.subject} / ${card.chapter}: ${card.main_failure_reason || 'usable but weak'}`);
  lines.push('', '## Needs Better Generator');
  const stronger = scorecards.filter((card) => card.main_failure_reason === 'NEEDS_STRONGER_GENERATOR' || /stronger generator/i.test(card.recommended_fix || ''));
  if (stronger.length === 0) lines.push('- None');
  else for (const card of stronger) lines.push(`- ${card.subject} / ${card.chapter}`);
  ensureDir(reportPath);
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

export function writeJsonFile(filePath, data) {
  ensureDir(filePath);
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function classifyStandaloneRoute(card) {
  const requiredScore = card.quality_mode === 'balanced' ? 7.8 : 7.2;
  const costOk = card.cost_per_1000_live === null || card.cost_per_1000_live <= 8 || card.expensive_but_acceptable;
  if (
    card.published_count >= 3 &&
    card.avg_validator_score >= requiredScore &&
    card.validator_acceptance_rate >= 0.20 &&
    costOk
  ) return ROUTE_STATUS.PASS;
  if (card.published_count >= 1 && !card.fatal_structural_issue) return ROUTE_STATUS.DEGRADED_BUT_USABLE;
  return ROUTE_STATUS.FAIL;
}

function classifyPassageRoute(card) {
  const requiredPassageScore = card.quality_mode === 'premium' ? 8.5 : 7.5;
  const costOk = card.cost_per_1000_live === null || card.cost_per_1000_live <= 20 || card.expensive_but_acceptable;
  if (
    card.passage_groups_published >= 1 &&
    card.avg_passage_score >= requiredPassageScore &&
    card.passage_children_published >= 2 &&
    costOk
  ) return ROUTE_STATUS.PASS;
  if ((card.published_count >= 1 || card.passage_children_published >= 1) && !card.fatal_structural_issue) {
    return ROUTE_STATUS.DEGRADED_BUT_USABLE;
  }
  return ROUTE_STATUS.FAIL;
}

function normalizePart(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function roundRate(value) {
  return Number(Number(value || 0).toFixed(3));
}

function roundMetric(value) {
  return Number(Number(value || 0).toFixed(2));
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(6));
}

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function auditPathsForRoute(baseDir, subject, chapter) {
  const key = routeKey(subject, chapter);
  return {
    key,
    sampleDir: join(baseDir, 'route_samples', key),
    failurePath: join(baseDir, 'route_failures', `${key}.json`),
    scorecardPath: join(baseDir, 'route_samples', key, 'route_scorecard.json'),
  };
}
