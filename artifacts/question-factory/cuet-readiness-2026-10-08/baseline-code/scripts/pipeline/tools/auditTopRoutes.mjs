import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_SYLLABUS, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { generateQuestions, getCostTracker, getLastGenerationDiagnostics, validateMiniBatch, validateStrictBatch } from '../lib/llm.mjs';
import { getEnglishGenerationMode } from '../lib/englishGenerationMode.mjs';
import { normalizeGenerationPayload } from '../lib/passageNormalizer.mjs';
import { runSelfCheck, summarizeSelfCheckResults } from '../lib/selfCheck.mjs';
import { analyzeRouteFailure } from './analyzeRouteFailures.mjs';
import { auditPathsForRoute, buildRouteScorecard, writeJsonFile } from './routeQualityScorecard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const defaultAuditDir = join(repoRoot, 'logs', 'audit');
const configPath = join(repoRoot, 'data', 'cuet_top_route_audit.json');

export function loadAuditConfig(path = configPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function resolveAuditRoutes(options = {}) {
  const config = options.config || loadAuditConfig();
  const requestedRoute = options.route ? parseRoute(options.route) : null;
  const subjects = splitList(options.subjects).map(normalizeId);
  const canonicalMap = new Map(CANONICAL_SYLLABUS.map((subject) => [subject.subject_id, subject]));
  let routeSpecs = config.routes || [];
  if (requestedRoute) {
    routeSpecs = [{ subject: requestedRoute.subject, chapter_aliases: [requestedRoute.chapter], route_type: inferRouteType(requestedRoute.subject, requestedRoute.chapter), priority: 999 }];
  }
  if (subjects.length > 0) routeSpecs = routeSpecs.filter((route) => subjects.includes(normalizeId(route.subject)));

  const resolved = [];
  for (const spec of routeSpecs) {
    const subject = canonicalMap.get(normalizeId(spec.subject));
    if (!subject) continue;
    const chapter = resolveChapter(subject, spec.chapter_aliases || []);
    if (!chapter || !isValidTopSyllabusPair(subject.subject_id, chapter)) continue;
    resolved.push({
      subject: subject.subject_id,
      subject_name: subject.subject_name || subject.name || subject.subject_id,
      chapter,
      route_type: spec.route_type || inferRouteType(subject.subject_id, chapter),
      priority: Number(spec.priority || 0),
    });
  }
  const top = Number(options.top || config.default_top || resolved.length);
  return resolved.sort((a, b) => b.priority - a.priority).slice(0, Math.max(1, top));
}

export async function runRouteAudit(route, options = {}) {
  const auditDir = options.auditDir || defaultAuditDir;
  const paths = auditPathsForRoute(auditDir, route.subject, route.chapter);
  mkdirSync(paths.sampleDir, { recursive: true });
  mkdirSync(dirname(paths.failurePath), { recursive: true });

  const started = Date.now();
  const beforeCost = getCostTracker();
  const subject = { id: route.subject, name: route.subject_name || route.subject };
  const englishMode = route.subject === 'english' ? getEnglishGenerationMode(route.chapter) : null;
  const isPassage = route.route_type === 'passage' || englishMode?.requires_passage === true;
  const target = isPassage
    ? Number(options.passageTargetQuestions || 4)
    : Number(options.targetCandidates || 12);
  const qualityMode = options.quality || 'speed';
  const generationContext = {
    audit_mode: true,
    quality_mode: qualityMode,
    generation_mode: englishMode?.mode || route.route_type,
    requires_passage: isPassage,
    max_live_publish_allowed: Number(options.maxLivePublishAllowed || 0),
    modelOverride: options.modelOverride || null,
  };

  let rawGeneration = [];
  let generationError = null;
  try {
    rawGeneration = await generateQuestions(subject, route.chapter, target, generationContext);
  } catch (error) {
    generationError = error;
    rawGeneration = [];
  }
  if (rawGeneration && !Array.isArray(rawGeneration) && rawGeneration.error) {
    generationError = new Error(rawGeneration.reason || rawGeneration.error);
    rawGeneration = [];
  }
  const diagnostics = getLastGenerationDiagnostics();
  const normalizedPayload = Array.isArray(rawGeneration)
    ? { questions: rawGeneration }
    : rawGeneration;
  const normalized = normalizeGenerationPayload(normalizedPayload, {
    subject: route.subject,
    chapter: route.chapter,
    generation_mode: englishMode?.mode || route.route_type,
    requires_passage: isPassage,
  });
  const normalizedCandidates = normalized.questions.map((question, index) => normalizeAuditQuestion(question, route, index));
  const selfCheckEntries = normalizedCandidates.map((question) => ({
    question,
    result: runSelfCheck(question, { subject: route.subject, chapter: route.chapter, batchSize: normalizedCandidates.length }),
  }));
  const selfCheckSummary = summarizeSelfCheckResults(selfCheckEntries.map((entry) => entry.result));
  const selfCheckPassed = selfCheckEntries
    .filter((entry) => entry.result.pass)
    .map((entry, index) => ({
      ...entry.question,
      candidate_id: `${paths.key}_${index}`,
      selfcheck_passed: true,
      selfcheck_reasons: entry.result.reasons,
    }));

  let miniResults = [];
  let strictResults = [];
  let validatorError = null;
  if (selfCheckPassed.length > 0) {
    try {
      miniResults = await validateMiniBatch(selfCheckPassed, subject);
      const strictCandidates = selectStrictAuditCandidates(selfCheckPassed, miniResults, qualityMode, isPassage);
      if (strictCandidates.length > 0) strictResults = await validateStrictBatch(strictCandidates, subject);
    } catch (error) {
      validatorError = error;
    }
  }

  const strictById = new Map(strictResults.map((result) => [result.candidate_id, result]));
  const validatorResults = selfCheckPassed.map((question, index) => {
    const mini = miniResults[index] || null;
    return strictById.get(question.candidate_id) || mini;
  });
  const acceptedQuestions = selfCheckPassed.filter((question, index) => isAuditAccepted(validatorResults[index], qualityMode, isPassage));
  const publishSimulation = simulatePublish(route, acceptedQuestions, normalized.passageGroups, isPassage);
  const afterCost = getCostTracker();
  const latencyMs = Date.now() - started;
  const scoreInput = buildScoreInput({
    route,
    qualityMode,
    englishMode,
    rawGeneration,
    normalizedCandidates,
    selfCheckPassed,
    validatorResults,
    publishSimulation,
    beforeCost,
    afterCost,
    latencyMs,
    generationError,
    validatorError,
    diagnostics,
  });
  const preliminary = buildRouteScorecard(scoreInput);
  const diagnosis = analyzeRouteFailure({
    route,
    metrics: preliminary,
    dumps: { selfCheckSummary, validatorResults, publishSimulation },
    error: generationError?.message || validatorError?.message || '',
  });
  const scorecard = buildRouteScorecard({
    ...scoreInput,
    main_failure_reason: diagnosis.primary_reason,
    recommended_fix: diagnosis.recommended_fix,
    fatal_structural_issue: diagnosis.primary_reason === 'PASSAGE_GROUP_LINKING_BUG' || diagnosis.primary_reason === 'ROUTING_OVERRIDE_BUG',
  });

  const artifacts = {
    route_config: route,
    raw_generation: rawGeneration,
    generation_diagnostics: diagnostics,
    normalized_candidates: normalizedCandidates,
    passage_groups: normalized.passageGroups,
    selfcheck_results: selfCheckEntries,
    validator_results: validatorResults,
    publish_results: publishSimulation,
    published_samples: publishSimulation.published_samples,
    rejected_samples: collectRejectedSamples(selfCheckEntries, validatorResults, selfCheckPassed),
    route_scorecard: scorecard,
    route_failure: diagnosis,
  };
  dumpRouteArtifacts(paths, artifacts, isPassage);
  return { route, scorecard, diagnosis, paths, artifacts };
}

export function dumpRouteArtifacts(paths, artifacts, isPassage = false) {
  writeJsonFile(join(paths.sampleDir, 'route_config.json'), artifacts.route_config);
  writeJsonFile(join(paths.sampleDir, 'raw_generation.json'), artifacts.raw_generation);
  writeJsonFile(join(paths.sampleDir, 'normalized_candidates.json'), artifacts.normalized_candidates);
  writeJsonFile(join(paths.sampleDir, 'selfcheck_results.json'), artifacts.selfcheck_results);
  writeJsonFile(join(paths.sampleDir, 'validator_results.json'), artifacts.validator_results);
  writeJsonFile(join(paths.sampleDir, 'publish_results.json'), artifacts.publish_results);
  writeJsonFile(join(paths.sampleDir, 'published_samples.json'), artifacts.published_samples);
  writeJsonFile(join(paths.sampleDir, 'rejected_samples.json'), artifacts.rejected_samples);
  writeJsonFile(join(paths.sampleDir, 'route_scorecard.json'), artifacts.route_scorecard);
  writeJsonFile(paths.failurePath, artifacts.route_failure);
  if (isPassage) {
    writeJsonFile(join(paths.sampleDir, 'passage_group.json'), artifacts.passage_groups?.[0] || null);
    writeJsonFile(join(paths.sampleDir, 'passage_quality.json'), {
      avg_passage_score: artifacts.route_scorecard.avg_passage_score,
      status: artifacts.route_scorecard.route_status,
    });
    writeJsonFile(join(paths.sampleDir, 'passage_children.json'), artifacts.normalized_candidates);
    writeJsonFile(join(paths.sampleDir, 'refill_jobs.json'), {
      needs_refill: artifacts.route_scorecard.needs_refill,
      reason: artifacts.route_scorecard.needs_refill ? 'fewer_than_4_children_published' : null,
    });
  }
}

function buildScoreInput({ route, qualityMode, englishMode, rawGeneration, normalizedCandidates, selfCheckPassed, validatorResults, publishSimulation, beforeCost, afterCost, latencyMs, generationError, validatorError, diagnostics }) {
  const accepted = validatorResults.filter(Boolean).filter((result) => String(result.verdict || '').toLowerCase() === 'accept');
  const avg = (field) => {
    const values = validatorResults.filter(Boolean).map((result) => normalizeScore(result[field])).filter((value) => value > 0);
    return values.length > 0 ? (values.reduce((sum, value) => sum + value, 0) / values.length) * 10 : 0;
  };
  const costTotal = Math.max(0, Number(afterCost.totalCostUsd || 0) - Number(beforeCost.totalCostUsd || 0));
  const publishedCount = publishSimulation.published_count;
  const hours = Math.max(latencyMs / 3600000, 1 / 3600);
  return {
    subject: route.subject,
    chapter: route.chapter,
    route_type: route.route_type,
    generation_mode: englishMode?.mode || route.route_type,
    quality_mode: qualityMode,
    generator_model: diagnostics?.generatorModel || normalizedCandidates[0]?.generator_model || 'unknown',
    validator_models: [...new Set(validatorResults.map((result) => result?.model).filter(Boolean))],
    generated_count: Array.isArray(rawGeneration) ? rawGeneration.length : 0,
    normalized_count: normalizedCandidates.length,
    selfcheck_passed: selfCheckPassed.length,
    validator_sent: selfCheckPassed.length,
    validator_accepted: accepted.length,
    validator_result_count: validatorResults.filter(Boolean).length,
    published_count: publishedCount,
    draft_count: Math.max(0, normalizedCandidates.length - publishedCount),
    passage_groups_generated: publishSimulation.passage_groups_generated,
    passage_groups_published: publishSimulation.passage_groups_published,
    passage_children_published: publishSimulation.passage_children_published,
    avg_validator_score: avg('score'),
    avg_exam_quality: avg('exam_quality'),
    avg_distractor_quality: avg('distractor_quality'),
    avg_answer_confidence: avg('answer_confidence'),
    avg_passage_score: avg('score'),
    avg_latency_ms: latencyMs,
    live_questions_per_hour: Number((publishedCount / hours).toFixed(1)),
    generated_candidates_per_hour: Number(((Array.isArray(rawGeneration) ? rawGeneration.length : 0) / hours).toFixed(1)),
    cost_total: costTotal,
    sample_question_paths: publishSimulation.sample_question_paths,
    needs_refill: publishSimulation.needs_refill,
    error: generationError?.message || validatorError?.message || null,
  };
}

function normalizeAuditQuestion(question, route, index) {
  const options = normalizeOptions(question.options || question.o || []);
  return {
    ...question,
    subject: question.subject || route.subject,
    chapter: question.chapter || route.chapter,
    body: String(question.body || question.question || question.q || '').trim(),
    question: String(question.body || question.question || question.q || '').trim(),
    options,
    correct_answer: normalizeAnswer(question.correct_answer || question.answer || question.a),
    answer: normalizeAnswer(question.correct_answer || question.answer || question.a),
    candidate_id: `${routeKey(route.subject, route.chapter)}_${index}`,
    q_hash: `${routeKey(route.subject, route.chapter)}_${index}`,
  };
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (typeof option === 'string') return { key: ['A', 'B', 'C', 'D'][index], text: option };
    return { key: option.key || ['A', 'B', 'C', 'D'][index], text: String(option.text || option.label || '') };
  });
}

function normalizeAnswer(value) {
  const key = String(value || '').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(key) ? key : '';
}

function selectStrictAuditCandidates(questions, miniResults, qualityMode, isPassage) {
  if (qualityMode === 'premium') return questions.slice(0, 3);
  if (qualityMode === 'balanced' || isPassage) {
    return questions
      .map((question, index) => ({ question, result: miniResults[index] }))
      .filter(({ result }) => !result || result.verdict === 'borderline' || normalizeScore(result.score) < 0.85)
      .slice(0, 3)
      .map((entry) => entry.question);
  }
  return [];
}

function isAuditAccepted(validation, qualityMode, isPassage) {
  if (!validation || String(validation.verdict || '').toLowerCase() !== 'accept') return false;
  const score = normalizeScore(validation.score);
  const exam = normalizeScore(validation.exam_quality);
  const distractor = normalizeScore(validation.distractor_quality);
  const depth = normalizeScore(validation.conceptual_depth);
  const trapOk = String(validation.trap_quality || '').toLowerCase() !== 'low';
  if (qualityMode === 'premium') return score >= 0.87 && exam >= 0.85 && distractor >= 0.83 && depth >= 0.75 && trapOk;
  if (qualityMode === 'balanced') return score >= (isPassage ? 0.75 : 0.78) && exam >= 0.73 && distractor >= 0.70 && depth >= 0.60 && trapOk;
  return score >= 0.72 && exam >= 0.70 && distractor >= 0.68 && depth >= 0.55 && trapOk;
}

function simulatePublish(route, acceptedQuestions, passageGroups, isPassage) {
  if (!isPassage) {
    return {
      published_count: acceptedQuestions.length,
      passage_groups_generated: 0,
      passage_groups_published: 0,
      passage_children_published: 0,
      needs_refill: false,
      sample_question_paths: [],
      published_samples: acceptedQuestions.slice(0, 5),
    };
  }
  const grouped = new Map();
  for (const question of acceptedQuestions) {
    const key = question.temporary_group_key || question.passage_group_id || question.group_id || question.passage_id || 'passage_1';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(question);
  }
  let groupsPublished = 0;
  let childrenPublished = 0;
  const samples = [];
  for (const [key, children] of grouped.entries()) {
    if (children.length >= 2 && children.every((question) => question.temporary_group_key || question.passage_group_id || question.group_id)) {
      groupsPublished += 1;
      childrenPublished += children.length;
      samples.push({ group_key: key, children: children.slice(0, 5) });
    }
  }
  return {
    published_count: childrenPublished,
    passage_groups_generated: Math.max(passageGroups?.length || 0, grouped.size),
    passage_groups_published: groupsPublished,
    passage_children_published: childrenPublished,
    needs_refill: groupsPublished > 0 && childrenPublished < 4,
    sample_question_paths: [],
    published_samples: samples,
  };
}

function collectRejectedSamples(selfCheckEntries, validatorResults, validatedQuestions) {
  const rejected = [];
  for (const entry of selfCheckEntries) {
    if (!entry.result.pass) rejected.push({ stage: 'selfCheck', question: entry.question, reasons: entry.result.reasons });
  }
  for (let i = 0; i < validatedQuestions.length; i += 1) {
    const result = validatorResults[i];
    if (result && String(result.verdict || '').toLowerCase() !== 'accept') {
      rejected.push({ stage: 'validator', question: validatedQuestions[i], result });
    }
  }
  return rejected.slice(0, 10);
}

function resolveChapter(subject, aliases) {
  const chapters = subject.units.flatMap((unit) => unit.chapters);
  for (const alias of aliases) {
    const exact = chapters.find((chapter) => normalizeComparable(chapter) === normalizeComparable(alias));
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const loose = chapters.find((chapter) => normalizeComparable(chapter).includes(normalizeComparable(alias)) || normalizeComparable(alias).includes(normalizeComparable(chapter)));
    if (loose) return loose;
  }
  return chapters[0] || null;
}

function inferRouteType(subject, chapter) {
  return subject === 'english' && getEnglishGenerationMode(chapter).requires_passage ? 'passage' : 'standalone';
}

function splitList(value) {
  return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parseRoute(value) {
  const [subject, ...chapterParts] = String(value || '').split('::');
  return { subject: normalizeId(subject), chapter: chapterParts.join('::').trim() };
}

function normalizeId(value) {
  return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeComparable(value) {
  return String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeScore(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  if (n > 1) return Math.min(1, n / 10);
  return Math.max(0, Math.min(1, n));
}

function routeKey(subject, chapter) {
  return `${normalizeId(subject)}__${normalizeId(chapter)}`;
}

export { defaultAuditDir };
