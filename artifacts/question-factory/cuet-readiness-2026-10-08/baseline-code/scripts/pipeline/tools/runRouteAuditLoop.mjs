import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { analyzeRouteFailure } from './analyzeRouteFailures.mjs';
import { defaultAuditDir, resolveAuditRoutes, runRouteAudit } from './auditTopRoutes.mjs';
import { summarizeScorecards, writeJsonFile, writeMarkdownReport } from './routeQualityScorecard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');

export async function runRouteAuditLoop(options = {}) {
  if (options.mock === true) process.env.MOCK_AI = 'true';
  const auditDir = options.auditDir || join(repoRoot, 'logs', 'audit');
  const maxIterations = Math.max(1, Number(options.maxIterations || 1));
  const routes = resolveAuditRoutes(options);
  const routeResults = [];
  const patchesApplied = [];

  for (const route of routes) {
    let latest = null;
    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      latest = await runRouteAuditWithTimeout(route, { ...options, auditDir, iteration });
      latest.iteration = iteration;
      const diagnosis = latest.diagnosis || analyzeRouteFailure({ route, metrics: latest.scorecard, dumps: latest.artifacts });
      if (!shouldRetry(latest.scorecard.route_status, diagnosis, iteration, maxIterations)) break;
      const patch = applySafeRuntimePatch(route, diagnosis, options);
      if (patch) patchesApplied.push(patch);
      else break;
    }
    routeResults.push(latest);
  }

  const scorecards = routeResults.map((result) => result.scorecard);
  const summary = summarizeScorecards(scorecards);
  const report = {
    generated_at: new Date().toISOString(),
    options: sanitizeOptions(options),
    summary,
    scorecards,
    patches_applied: patchesApplied,
  };
  writeJsonFile(join(auditDir, 'latest_route_audit.json'), report);
  writeMarkdownReport({
    scorecards,
    summary,
    patchesApplied,
    reportPath: join(auditDir, 'latest_route_audit.md'),
  });
  return report;
}

async function runRouteAuditWithTimeout(route, options) {
  const timeoutMs = Number(options.maxRouteMs || process.env.ROUTE_AUDIT_MAX_ROUTE_MS || 180000);
  let timeoutId;
  const timeoutResult = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({
        route,
        diagnosis: {
          primary_reason: 'COST_SPEED_BOTTLENECK',
          secondary_reasons: ['route_audit_timeout'],
          recommended_fix: 'Reduce model latency or use a faster generator for this route.',
        },
        scorecard: {
          subject: route.subject,
          chapter: route.chapter,
          route_type: route.route_type,
          generation_mode: route.route_type,
          quality_mode: options.quality || 'speed',
          generator_model: 'timeout',
          validator_models: [],
          route_status: 'FAIL_NEEDS_MODEL_OR_ANCHOR_WORK',
          generated_count: 0,
          normalized_count: 0,
          selfcheck_passed: 0,
          validator_sent: 0,
          validator_accepted: 0,
          published_count: 0,
          draft_count: 0,
          passage_groups_generated: 0,
          passage_groups_published: 0,
          passage_children_published: 0,
          avg_validator_score: 0,
          avg_exam_quality: 0,
          avg_distractor_quality: 0,
          avg_answer_confidence: 0,
          avg_passage_score: 0,
          selfcheck_rejection_rate: 0,
          validator_acceptance_rate: 0,
          publish_yield_rate: 0,
          avg_latency_ms: timeoutMs,
          live_questions_per_hour: 0,
          generated_candidates_per_hour: 0,
          cost_total: 0,
          cost_per_live_question: null,
          cost_per_1000_live: null,
          main_failure_reason: 'COST_SPEED_BOTTLENECK',
          recommended_fix: 'Route audit timed out; prefer Flash or reduce strict validation for this route.',
          sample_question_paths: [],
        },
        paths: null,
        artifacts: {},
      });
    }, timeoutMs);
  });
  const result = await Promise.race([runRouteAudit(route, options), timeoutResult]);
  clearTimeout(timeoutId);
  return result;
}

export function parseAuditArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    const value = rest.length > 0 ? rest.join('=') : 'true';
    if (key === 'top') options.top = Number(value);
    else if (key === 'quality') options.quality = value;
    else if (key === 'max-iterations') options.maxIterations = Number(value);
    else if (key === 'subjects') options.subjects = value;
    else if (key === 'route') options.route = value;
    else if (key === 'all-top-subjects') options.allTopSubjects = true;
    else if (key === 'mock') options.mock = value !== 'false';
    else if (key === 'max-live-publish') options.maxLivePublishAllowed = Number(value);
    else if (key === 'max-route-ms') options.maxRouteMs = Number(value);
  }
  if (!options.quality) options.quality = process.env.CUET_QUALITY_MODE || 'speed';
  if (!options.maxIterations) options.maxIterations = 1;
  return options;
}

function shouldRetry(status, diagnosis, iteration, maxIterations) {
  if (iteration >= maxIterations) return false;
  if (status === 'PASS') return false;
  return ['GENERATOR_QUALITY_WEAK', 'SELF_CHECK_TOO_STRICT', 'MODEL_ROUTING_BAD', 'ANCHOR_MISMATCH'].includes(diagnosis?.primary_reason);
}

function applySafeRuntimePatch(route, diagnosis, options) {
  if (!diagnosis?.primary_reason) return null;
  if (diagnosis.primary_reason === 'SELF_CHECK_TOO_STRICT') {
    options.selfCheckHint = `route_specific_review:${route.subject}::${route.chapter}`;
    return `Runtime hint added for ${route.subject}/${route.chapter}: selfCheck route-specific review`;
  }
  if (diagnosis.primary_reason === 'GENERATOR_QUALITY_WEAK') {
    options.retryPromptHint = `Use closer distractors and avoid generic stems for ${route.subject}/${route.chapter}`;
    return `Runtime prompt hint added for ${route.subject}/${route.chapter}: closer distractors`;
  }
  if (diagnosis.primary_reason === 'MODEL_ROUTING_BAD') {
    options.modelRoutingHint = `review_model_route:${route.subject}::${route.chapter}`;
    return `Runtime model-routing hint recorded for ${route.subject}/${route.chapter}`;
  }
  return null;
}

function sanitizeOptions(options) {
  return {
    top: options.top || null,
    subjects: options.subjects || null,
    route: options.route || null,
    quality: options.quality || 'speed',
    max_iterations: options.maxIterations || 1,
    mock: options.mock === true,
    max_live_publish_allowed: options.maxLivePublishAllowed || 0,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runRouteAuditLoop(parseAuditArgs())
    .then((report) => {
      console.log(JSON.stringify(report.summary, null, 2));
    })
    .catch((error) => {
      console.error('[route_audit_loop] failed', error);
      process.exitCode = 1;
    });
}
