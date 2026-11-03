import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonFile } from './routeQualityScorecard.mjs';
import { runRouteAudit } from './auditTopRoutes.mjs';

const defaultReportDir = join(process.cwd(), 'logs', 'model_tests', 'kimi_vs_deepseek');

export async function runGeneratorAbTest(options = {}) {
  const routes = parseRoutes(options);
  const models = String(options.models || 'deepseek-v4-flash,kimi')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  const originalEnv = snapshotEnv([
    'GENERATOR_PROVIDER',
    'GENERATOR_PRIMARY_PROVIDER',
    'GENERATOR_PRIMARY_MODEL',
    'ALLOW_KIMI_GENERATION',
    'KIMI_MODEL',
    'ALLOW_OPENAI_GENERATION',
    'ALLOW_OPENAI_GENERATION_FOR_AUDIT',
    'ALLOW_GEMINI_GENERATION_FOR_AUDIT',
  ]);
  const results = [];

  try {
    for (const route of routes) {
      for (const model of models) {
        const configured = configureModelForAudit(model);
        if (configured.skipped) {
          results.push(skipped(route, model, configured.reason));
          continue;
        }
        const started = Date.now();
        const run = await runRouteAudit(route, {
          quality: options.quality || 'speed',
          auditDir: options.auditDir,
          maxLivePublishAllowed: 0,
          modelOverride: configured.modelOverride,
        });
        results.push(buildModelResult({
          route,
          model,
          configured,
          run,
          latencyMs: Date.now() - started,
        }));
      }
    }
  } finally {
    restoreEnv(originalEnv);
  }

  const report = {
    created_at: new Date().toISOString(),
    no_publish: true,
    routes,
    results,
    winner: chooseWinner(results),
    recommendation: recommendKimi(results),
  };
  writeReports(report, options.auditDir || defaultReportDir);
  return report;
}

function configureModelForAudit(model) {
  const normalized = String(model || '').trim();
  if (/^kimi$/i.test(normalized) || /^kimi-/i.test(normalized)) {
    if (!process.env.KIMI_API_KEY) return { skipped: true, reason: 'missing_kimi_api_key' };
    process.env.GENERATOR_PROVIDER = 'kimi';
    process.env.GENERATOR_PRIMARY_PROVIDER = 'kimi';
    process.env.ALLOW_KIMI_GENERATION = 'true';
    if (/^kimi-/i.test(normalized)) process.env.KIMI_MODEL = normalized;
    return { modelOverride: process.env.KIMI_MODEL || 'kimi-k2.6', provider: 'kimi' };
  }
  if (/gpt|openai/i.test(normalized) && process.env.ALLOW_OPENAI_GENERATION_FOR_AUDIT !== 'true') {
    return { skipped: true, reason: 'openai_generation_for_audit_not_allowed' };
  }
  if (/gemini/i.test(normalized) && process.env.ALLOW_GEMINI_GENERATION_FOR_AUDIT !== 'true') {
    return { skipped: true, reason: 'gemini_generation_for_audit_not_allowed' };
  }
  if (/gpt|openai/i.test(normalized)) process.env.ALLOW_OPENAI_GENERATION = 'true';
  process.env.GENERATOR_PROVIDER = 'deepseek';
  process.env.GENERATOR_PRIMARY_PROVIDER = 'deepseek';
  process.env.ALLOW_KIMI_GENERATION = 'false';
  process.env.GENERATOR_PRIMARY_MODEL = normalized;
  return { modelOverride: normalized, provider: /deepseek/i.test(normalized) ? 'deepseek' : 'experimental' };
}

function buildModelResult({ route, model, configured, run, latencyMs }) {
  const scorecard = run.scorecard || {};
  const selfcheckResults = run.artifacts?.selfcheck_results || [];
  const validatorResults = run.artifacts?.validator_results || [];
  const normalizedCandidates = run.artifacts?.normalized_candidates || [];
  const generatedRaw = run.artifacts?.raw_generation || [];
  const diagnostics = run.artifacts?.generation_diagnostics || {};
  const issueStats = countIssues(selfcheckResults, validatorResults);
  const simulatedPublishCount = Number(scorecard.published_count || scorecard.passage_children_published || 0);
  const costTotal = Number(scorecard.cost_total || 0);
  return {
    route: `${route.subject}::${route.chapter}`,
    model,
    provider: configured.provider,
    generation_success: normalizedCandidates.length > 0,
    json_parse_success: Number(diagnostics.rawParsedCount || normalizedCandidates.length || 0) > 0,
    repair_used: normalizedCandidates.some((question) => question.json_repaired || question.repair_provider && question.repair_provider !== 'code'),
    raw_candidates: Array.isArray(generatedRaw) ? generatedRaw.length : 0,
    normalized_candidates: Number(scorecard.normalized_count || normalizedCandidates.length || 0),
    selfcheck_passed: Number(scorecard.selfcheck_passed || 0),
    validator_sent: Number(scorecard.validator_sent || 0),
    validator_accepted: Number(scorecard.validator_accepted || 0),
    simulated_publish_count: simulatedPublishCount,
    average_validator_score: Number(scorecard.avg_validator_score || 0),
    average_exam_quality: Number(scorecard.avg_exam_quality || 0),
    average_distractor_quality: Number(scorecard.avg_distractor_quality || 0),
    average_trap_quality: averageTrapQuality(validatorResults),
    weak_distractor_rate: rate(issueStats.weak_distractor, Math.max(1, normalizedCandidates.length)),
    direct_definition_rate: rate(issueStats.direct_definition, Math.max(1, normalizedCandidates.length)),
    answer_mismatch_rate: rate(issueStats.answer_mismatch, Math.max(1, normalizedCandidates.length)),
    non_cuet_pattern_rate: rate(issueStats.non_cuet_pattern, Math.max(1, normalizedCandidates.length)),
    avg_latency_ms: latencyMs,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_usd: costTotal,
    estimated_cost_per_1000_live: simulatedPublishCount > 0 ? Number(((costTotal / simulatedPublishCount) * 1000).toFixed(6)) : null,
    projected_live_per_hour: Number(scorecard.live_questions_per_hour || 0),
    sample_path: run.paths?.sampleDir || null,
  };
}

function countIssues(selfcheckResults = [], validatorResults = []) {
  const allReasons = [
    ...selfcheckResults.flatMap((entry) => entry?.result?.reasons || []),
    ...validatorResults.flatMap((result) => result?.reasons || result?.issues || []),
  ].map((reason) => String(reason || '').toLowerCase());
  return {
    weak_distractor: allReasons.filter((reason) => /weak.*distractor|weak_options|distractor quality/.test(reason)).length,
    direct_definition: allReasons.filter((reason) => /direct definition|textbook|dictionary-only/.test(reason)).length,
    answer_mismatch: allReasons.filter((reason) => /answer.*mismatch|wrong answer|answer key|factual/.test(reason)).length,
    non_cuet_pattern: allReasons.filter((reason) => /non.?cuet|outside cuet|pattern/.test(reason)).length,
  };
}

function averageTrapQuality(results = []) {
  const values = results.map((result) => {
    const text = String(result?.trap_quality || '').toLowerCase();
    if (text === 'high') return 9;
    if (text === 'medium') return 7;
    if (text === 'low') return 3;
    return 0;
  }).filter(Boolean);
  return values.length > 0 ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
}

function chooseWinner(results) {
  const usable = results.filter((result) => !result.skipped);
  if (usable.length === 0) return null;
  return usable.sort((a, b) => (
    b.validator_accepted - a.validator_accepted ||
    b.average_distractor_quality - a.average_distractor_quality ||
    b.average_validator_score - a.average_validator_score ||
    a.avg_latency_ms - b.avg_latency_ms
  ))[0].model;
}

function recommendKimi(results) {
  const kimiResults = results.filter((result) => /kimi/i.test(result.model) && !result.skipped);
  const baselineResults = results.filter((result) => /deepseek/i.test(result.model) && !result.skipped);
  if (kimiResults.length === 0) return 'do_not_use_kimi_until_health_and_ab_tests_pass';
  const avgKimi = averageResult(kimiResults);
  const avgDeepSeek = averageResult(baselineResults);
  if (avgKimi.cost_per_1000_live && avgKimi.cost_per_1000_live > 8) return 'use_kimi_route_specific_only_due_to_cost';
  const acceptanceImproved = avgDeepSeek.validator_accepted === 0
    ? avgKimi.validator_accepted > 0
    : avgKimi.validator_accepted >= avgDeepSeek.validator_accepted * 1.3;
  const distractorImproved = avgKimi.average_distractor_quality >= avgDeepSeek.average_distractor_quality + 0.5;
  const weakDrops = avgKimi.weak_distractor_rate <= avgDeepSeek.weak_distractor_rate * 0.75;
  if (acceptanceImproved || distractorImproved || weakDrops) return 'use_kimi_route_specific_experimentally';
  return 'keep_deepseek_default_and_continue_kimi_ab_tests';
}

function averageResult(results = []) {
  const avg = (field) => results.length > 0
    ? results.reduce((sum, result) => sum + Number(result[field] || 0), 0) / results.length
    : 0;
  return {
    validator_accepted: avg('validator_accepted'),
    average_distractor_quality: avg('average_distractor_quality'),
    weak_distractor_rate: avg('weak_distractor_rate'),
    cost_per_1000_live: avg('estimated_cost_per_1000_live'),
  };
}

function writeReports(report, dir) {
  mkdirSync(dir, { recursive: true });
  writeJsonFile(join(dir, 'latest.json'), report);
  writeFileSync(join(dir, 'latest.md'), renderMarkdown(report), 'utf8');
}

function renderMarkdown(report) {
  const lines = [
    '# Kimi vs DeepSeek A/B Test',
    '',
    `Recommendation: ${report.recommendation}`,
    '',
    '| Route | Model | Accepted | Score | Distractor | Weak Distractor Rate | Cost/1000 Live | Latency ms |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of report.results) {
    lines.push(`| ${row.route || ''} | ${row.model}${row.skipped ? ` (${row.reason})` : ''} | ${row.validator_accepted || 0} | ${row.average_validator_score || 0} | ${row.average_distractor_quality || 0} | ${row.weak_distractor_rate || 0} | ${row.estimated_cost_per_1000_live ?? 'n/a'} | ${row.avg_latency_ms || 0} |`);
  }
  return `${lines.join('\n')}\n`;
}

function skipped(route, model, reason) {
  return {
    route: `${route.subject}::${route.chapter}`,
    model,
    skipped: true,
    reason,
    generation_success: false,
    json_parse_success: false,
    repair_used: false,
    raw_candidates: 0,
    normalized_candidates: 0,
    selfcheck_passed: 0,
    validator_sent: 0,
    validator_accepted: 0,
    simulated_publish_count: 0,
    average_validator_score: 0,
    average_exam_quality: 0,
    average_distractor_quality: 0,
    average_trap_quality: 0,
    weak_distractor_rate: 0,
    direct_definition_rate: 0,
    answer_mismatch_rate: 0,
    non_cuet_pattern_rate: 0,
    avg_latency_ms: 0,
    estimated_cost_usd: 0,
    estimated_cost_per_1000_live: null,
    projected_live_per_hour: 0,
  };
}

function parseRoutes(options = {}) {
  if (options.routes) return String(options.routes).split(',').map(parseRoute).filter((route) => route.subject && route.chapter);
  return [parseRoute(options.route || 'english::Factual Passage')];
}

function parseRoute(value) {
  const [subject, ...chapterParts] = String(value || '').split('::');
  const chapter = chapterParts.join('::').trim();
  return {
    subject: subject.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    chapter,
    route_type: /passage|reading comprehension|prose/i.test(chapter) ? 'passage' : 'standalone',
    priority: 999,
  };
}

function rate(count, denominator) {
  return Number((Number(count || 0) / Math.max(1, Number(denominator || 0))).toFixed(3));
}

function snapshotEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  }));
  runGeneratorAbTest(args)
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error('[ab_test_generators] failed', error);
      process.exitCode = 1;
    });
}
