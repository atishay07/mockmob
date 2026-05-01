import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { analyzeCoverage } from './analyzer.mjs';
import { getSubjectPriority, planGeneration } from './planner.mjs';
import {
  generateQuestions,
  getLastGenerationDiagnostics,
  validateMiniBatch,
  validateStrictBatch,
  PIPELINE_BATCH_SIZE,
  VALIDATION_BATCH_SIZE,
  STRICT_VALIDATION_MAX_PER_BATCH,
  getCostTracker,
  isCostSaverActive,
  recordAcceptedForCost,
} from '../lib/llm.mjs';
import { runSelfCheck, summarizeSelfCheckResults } from '../lib/selfCheck.mjs';
import { deduplicateBatch, deduplicateAgainst } from '../lib/dedupe.mjs';
import { publishQuestion, publishPassageGroup, saveDraftQuestion } from '../lib/publish.mjs';
import {
  buildPassageRefillJobPayload,
  evaluatePassageChildAcceptance,
  getPassageGroupPublishDecision,
  validatePassageQuality,
} from '../lib/passageQuality.mjs';
import { getEnglishGenerationMode } from '../lib/englishGenerationMode.mjs';
import {
  getCuetOverrideConfig,
  isJobAllowedByOverride,
  filterJobsByOverride,
  logOverrideConfig,
} from '../lib/overrideConfig.mjs';
import {
  classifyQualityBand,
  getQualityThresholds,
  isPublishAllowedByQuality,
  normalizeQualityMode,
  shouldRequireStrictValidation,
} from '../lib/qualityMode.mjs';
import { CUET_SUPPORTED_SUBJECTS } from '../../../data/subjects.js';
import { CANONICAL_SYLLABUS, TOP_SUBJECTS, getCanonicalChapters, getCanonicalUnitForChapter, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { validateTraceability } from '../../../data/cuet_controls.js';
import { PYQ_ANCHORS } from '../../../data/pyq_anchors.js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const API_SECRET = process.env.INTERNAL_API_SECRET || 'test-secret';
const MAX_RETRIES = Number(process.env.MAX_GENERATION_RETRIES || 2);
const MAX_API_CALLS_PER_JOB = Number(process.env.MAX_API_CALLS_PER_JOB || 4);
const VALIDATOR_FEEDBACK_PREFIX = 'validator_feedback:';
const PREMIUM_RETRY_REASONS = new Set([
  'distractor_quality_below_quality_mode_threshold',
  'quality_band_A_not_allowed',
  'answer_confidence_below_threshold',
]);
const VALIDATION_CANDIDATE_LIMIT = VALIDATION_BATCH_SIZE;
const STANDARD_VALIDATION_SAMPLE_RATE = 0.30;
const LOW_COVERAGE_VALIDATION_THRESHOLD = 25;
const MIN_QUESTIONS_PER_CHAPTER = 50;
const TOP_SUBJECT_SET = new Set(TOP_SUBJECTS);
const FOCUSED_QUALITY_JOB_MARKER = 'focused_quality_test_direct_anchor';
const COST_SOFT_ALERT_PER_1000 = Number(process.env.COST_SOFT_ALERT_PER_1000 || 2.0);
const COST_HARD_THROTTLE_PER_1000 = Number(process.env.COST_HARD_THROTTLE_PER_1000 || 5.0);
const COST_VALIDATION_PAUSE_THRESHOLD = Number(process.env.COST_VALIDATION_PAUSE_THRESHOLD || COST_HARD_THROTTLE_PER_1000);
const AUTONOMOUS_JOB_CONCURRENCY = Number(process.env.AUTONOMOUS_JOB_CONCURRENCY || 3);
const GENERATION_CONCURRENCY = Number(process.env.GENERATION_CONCURRENCY || 3);
const VALIDATION_CONCURRENCY = Number(process.env.VALIDATION_CONCURRENCY || 4);
const REPAIR_CONCURRENCY = Number(process.env.REPAIR_CONCURRENCY || 4);
const canonical_syllabus = Object.fromEntries(
  CANONICAL_SYLLABUS
    .filter((subject) => TOP_SUBJECT_SET.has(subject.subject_id))
    .map((subject) => [subject.subject_id, subject])
);
const VALID_SUBJECTS = new Set(Object.keys(canonical_syllabus));
const DEFAULT_GENERATION_COUNT = PIPELINE_BATCH_SIZE;
const CHEAP_MODE_GENERATION_COUNT = 3;
const HEAVY_CHAPTER_GENERATION_COUNT = DEFAULT_GENERATION_COUNT;
const MIN_TIMEOUT_RETRY_COUNT = 3;
const MAX_GENERATION_TIMEOUT_RETRIES = 0;
const ENGLISH_RC_CHAPTERS = new Set(['Factual Passage', 'Narrative Passage', 'Literary Passage']);
const ALLOWED_ANCHOR_TIERS = new Set([1, 2, 3, 4]);
const STALE_PROCESSING_MINUTES = Number(process.env.STALE_PROCESSING_MINUTES || 10);
const HEAVY_GENERATION_CHAPTERS = new Set([
  'Differential Equations',
  'Probability',
  'Integrals',
]);

const args = process.argv.slice(2);
const overrideConfig = getCuetOverrideConfig({ argv: args, env: process.env });
const QUALITY_MODE = normalizeQualityMode(overrideConfig.quality_mode || process.env.CUET_QUALITY_MODE || 'speed');
logOverrideConfig(overrideConfig);
console.log('[quality_mode]', {
  mode: QUALITY_MODE,
  thresholds: getQualityThresholds(QUALITY_MODE),
});
let difficultyOverride = null;
if (args.includes('--easy') || process.env.npm_config_easy === 'true') difficultyOverride = 'easy';
if (args.includes('--medium') || process.env.npm_config_medium === 'true') difficultyOverride = 'medium';
if (args.includes('--hard') || process.env.npm_config_hard === 'true') difficultyOverride = 'hard';
console.log('[config] difficultyOverride:', difficultyOverride);

// ── Subject-loop guard ────────────────────────────────────────────────────────
// Tracks the last N subjects processed.  If the same subject appears SUBJECT_LOOP_MAX
// times in a row the worker tries to find a different-subject job before continuing.
const SUBJECT_LOOP_MAX = 3;
const recentSubjects = [];
let dynamicQualityFeedback = [];
const runMetrics = {
  run_started_at: new Date().toISOString(),
  jobs_started: 0,
  jobs_completed: 0,
  raw_candidates_generated: 0,
  normalized_candidates: 0,
  selfcheck_passed: 0,
  validator_sent: 0,
  validator_accepted: 0,
  live_published: 0,
  drafts_saved: 0,
  total_job_duration_ms: 0,
  model_usage_breakdown: {},
  override_skipped_jobs: 0,
  passage_groups_published: 0,
  standalone_questions_published: 0,
  quality_bands: { A_PLUS: 0, A: 0, B: 0, C: 0 },
  validator_score_sum: 0,
  validator_score_count: 0,
  distractor_quality_sum: 0,
  exam_quality_sum: 0,
  english: {
    passage_groups_generated: 0,
    passage_groups_published: 0,
    passage_children_generated: 0,
    passage_children_published: 0,
    quick_practice_standalone_count: 0,
    nta_grouped_count: 0,
  },
};

function modelMetricsFor(model) {
  const key = model || 'unknown';
  if (!runMetrics.model_usage_breakdown[key]) {
    runMetrics.model_usage_breakdown[key] = {
      model: key,
      calls: 0,
      success_calls: 0,
      failed_calls: 0,
      total_latency_ms: 0,
      candidates: 0,
      selfcheck_passed: 0,
      published: 0,
      cost_usd: 0,
    };
  }
  return runMetrics.model_usage_breakdown[key];
}

export function runMetricsSnapshot() {
  const durationMinutes = Math.max((Date.now() - Date.parse(runMetrics.run_started_at)) / 60000, 1 / 60);
  const costSnapshot = getCostTracker();
  const modelBreakdown = Object.fromEntries(Object.entries(runMetrics.model_usage_breakdown).map(([model, entry]) => [
    model,
    {
      ...entry,
      avg_latency_ms: entry.calls > 0 ? Math.round(entry.total_latency_ms / entry.calls) : 0,
      avg_candidates_per_call: entry.calls > 0 ? Number((entry.candidates / entry.calls).toFixed(2)) : 0,
      avg_selfcheck_passed_per_call: entry.calls > 0 ? Number((entry.selfcheck_passed / entry.calls).toFixed(2)) : 0,
      avg_published_per_call: entry.calls > 0 ? Number((entry.published / entry.calls).toFixed(2)) : 0,
      cost_per_published: entry.published > 0 ? Number((entry.cost_usd / entry.published).toFixed(6)) : null,
    },
  ]));
  return {
    run_started_at: runMetrics.run_started_at,
    run_duration_minutes: Number(durationMinutes.toFixed(2)),
    jobs_started: runMetrics.jobs_started,
    jobs_completed: runMetrics.jobs_completed,
    raw_candidates_generated: runMetrics.raw_candidates_generated,
    normalized_candidates: runMetrics.normalized_candidates,
    selfcheck_passed: runMetrics.selfcheck_passed,
    validator_sent: runMetrics.validator_sent,
    validator_accepted: runMetrics.validator_accepted,
    live_published: runMetrics.live_published,
    drafts_saved: runMetrics.drafts_saved,
    live_questions_per_hour: Number(((runMetrics.live_published / durationMinutes) * 60).toFixed(1)),
    generated_candidates_per_hour: Number(((runMetrics.raw_candidates_generated / durationMinutes) * 60).toFixed(1)),
    jobs_completed_per_hour: Number(((runMetrics.jobs_completed / durationMinutes) * 60).toFixed(1)),
    average_job_duration_ms: runMetrics.jobs_completed > 0 ? Math.round(runMetrics.total_job_duration_ms / runMetrics.jobs_completed) : 0,
    average_publish_per_job: runMetrics.jobs_completed > 0 ? Number((runMetrics.live_published / runMetrics.jobs_completed).toFixed(2)) : 0,
    cost_total: Number(costSnapshot.totalCostUsd.toFixed(6)),
    cost_per_live_question: Number(costSnapshot.costPerAccepted.toFixed(6)),
    cost_per_1000_live: Number(costSnapshot.costPer1000.toFixed(2)),
    model_usage_breakdown: modelBreakdown,
    override_metrics: {
      override_active: overrideConfig.active,
      allowed_subjects: overrideConfig.subjects,
      allowed_chapters: overrideConfig.chapters,
      skipped_jobs: runMetrics.override_skipped_jobs,
      jobs_completed: runMetrics.jobs_completed,
      live_published: runMetrics.live_published,
      passage_groups_published: runMetrics.passage_groups_published,
      standalone_questions_published: runMetrics.standalone_questions_published,
    },
    quality_metrics: {
      mode: QUALITY_MODE,
      a_plus_count: runMetrics.quality_bands.A_PLUS,
      a_count: runMetrics.quality_bands.A,
      b_count: runMetrics.quality_bands.B,
      c_rejected_count: runMetrics.quality_bands.C,
      average_validator_score: runMetrics.validator_score_count > 0 ? Number((runMetrics.validator_score_sum / runMetrics.validator_score_count).toFixed(2)) : 0,
      average_distractor_quality: runMetrics.validator_score_count > 0 ? Number((runMetrics.distractor_quality_sum / runMetrics.validator_score_count).toFixed(2)) : 0,
      average_exam_quality: runMetrics.validator_score_count > 0 ? Number((runMetrics.exam_quality_sum / runMetrics.validator_score_count).toFixed(2)) : 0,
      passage_group_success_rate: runMetrics.english.passage_groups_generated > 0
        ? Number((runMetrics.english.passage_groups_published / runMetrics.english.passage_groups_generated).toFixed(2))
        : 0,
    },
    english_metrics: { ...runMetrics.english },
  };
}

function recordRunMetricsUpdate({
  generatorModel,
  jobDurationMs,
  generatedCount,
  normalizedCount,
  selfcheckPassed,
  validatorSent,
  validatorAccepted,
  livePublished,
  draftsSaved,
}) {
  runMetrics.jobs_completed += 1;
  runMetrics.raw_candidates_generated += Number(generatedCount || 0);
  runMetrics.normalized_candidates += Number(normalizedCount || 0);
  runMetrics.selfcheck_passed += Number(selfcheckPassed || 0);
  runMetrics.validator_sent += Number(validatorSent || 0);
  runMetrics.validator_accepted += Number(validatorAccepted || 0);
  runMetrics.live_published += Number(livePublished || 0);
  runMetrics.drafts_saved += Number(draftsSaved || 0);
  runMetrics.total_job_duration_ms += Number(jobDurationMs || 0);

  const modelEntry = modelMetricsFor(generatorModel);
  modelEntry.calls += 1;
  modelEntry.success_calls += generatedCount > 0 ? 1 : 0;
  modelEntry.failed_calls += generatedCount > 0 ? 0 : 1;
  modelEntry.total_latency_ms += Number(jobDurationMs || 0);
  modelEntry.candidates += Number(generatedCount || 0);
  modelEntry.selfcheck_passed += Number(selfcheckPassed || 0);
  modelEntry.published += Number(livePublished || 0);

  const snapshot = runMetricsSnapshot();
  console.log('[run_metrics]', snapshot);
  for (const entry of Object.values(snapshot.model_usage_breakdown)) {
    console.log('[model_performance]', entry);
  }
  if (snapshot.live_questions_per_hour < 30 && runMetrics.jobs_completed >= 3) {
    console.warn('[throughput_failure_analysis]', {
      top_bottlenecks: [
        selfcheckPassed === 0 ? 'selfcheck_zero_yield' : '',
        validatorSent === 0 ? 'validator_not_reached' : '',
        livePublished === 0 ? 'no_publish_this_job' : '',
      ].filter(Boolean),
      slowest_models: Object.values(snapshot.model_usage_breakdown)
        .sort((a, b) => b.avg_latency_ms - a.avg_latency_ms)
        .slice(0, 3)
        .map((entry) => ({ model: entry.model, avg_latency_ms: entry.avg_latency_ms })),
      highest_rejection_reasons: [],
      validator_mismatch_count: 0,
      avg_batch_size: runMetrics.jobs_completed > 0 ? Number((runMetrics.raw_candidates_generated / runMetrics.jobs_completed).toFixed(2)) : 0,
      worker_selection_mode: 'planner_priority_then_coverage_fallback',
    });
  }
}

// ── Question-type labels used in composite concept keys ───────────────────────
const QUESTION_TYPES = ['conceptual', 'numerical', 'application'];

// ── Persistent concept memory ─────────────────────────────────────────────────
const __workerDir = dirname(fileURLToPath(import.meta.url));
const CONCEPT_MEMORY_PATH = join(__workerDir, '..', 'data', 'concept_memory.json');

// Map<subjectId, Set<baseConceptPattern>>  — used for the AVOID line in prompts
const globalConceptMemory = new Map();

// Map<subjectId, Map<"concept:type", count>>  — used for saturation detection
const subtopicUsageMap = new Map();

let _persistTimer = null;

/**
 * Scales the saturation ceiling by how many chapters the subject has.
 * Subjects with many chapters have broader concept space → higher limit.
 */
function getAdaptiveMaxPerConcept(subject) {
  const n = subject?.chapters?.length ?? 5;
  if (n <= 4) return 2;   // narrow subject (e.g. small language topics)
  if (n <= 10) return 3;  // medium subject
  return 5;               // broad subject (physics, biology, history …)
}

/**
 * Heuristically classify a question body into one of three types.
 * Numerical → contains digits with units or explicit calculation intent.
 * Application → real-world / scenario framing.
 * Conceptual → everything else.
 */
function inferQuestionType(body) {
  const text = String(body || '').toLowerCase();
  if (/\d+\.?\d*\s*(?:rs\.?|₹|%|kg|m\/s|j\b|n\b|mol|atm|v\b|a\b|hz)|calculate|find the value|how much|how many|what is the value|numerical/i.test(text)) {
    return 'numerical';
  }
  if (/\bapplied?\b|\bscenario\b|\bcase study\b|\breal.?world\b|\bsituation\b|\bin practice\b|\bexample\b/i.test(text)) {
    return 'application';
  }
  return 'conceptual';
}

/** Returns the set of base concept_patterns recorded for a subject. */
function getUsedConcepts(subjectId) {
  if (!globalConceptMemory.has(subjectId)) globalConceptMemory.set(subjectId, new Set());
  return globalConceptMemory.get(subjectId);
}

/**
 * Records concept_patterns from newly accepted questions using composite keys
 * (concept:type) so different question styles on the same topic are tracked
 * independently — avoids over-grouping conceptual and numerical variants.
 */
function recordAcceptedConcepts(subjectId, questions) {
  const conceptSet = getUsedConcepts(subjectId);
  if (!subtopicUsageMap.has(subjectId)) subtopicUsageMap.set(subjectId, new Map());
  const usageMap = subtopicUsageMap.get(subjectId);

  for (const q of questions) {
    const base = String(q.concept_pattern || '').trim();
    if (!base) continue;
    conceptSet.add(base);                               // base concept for AVOID list
    const type = inferQuestionType(q.body);
    const compositeKey = `${base}:${type}`;
    usageMap.set(compositeKey, (usageMap.get(compositeKey) || 0) + 1);
  }
  schedulePersist();
}

/**
 * A concept is only marked "saturated" (→ excluded from future generation) when
 * ALL question types (conceptual, numerical, application) have individually
 * reached the adaptive ceiling.  This prevents a burst of conceptual questions
 * from blocking numericals on the same topic.
 */
function getSaturatedSubtopics(subjectId, maxPerConcept) {
  const usageMap = subtopicUsageMap.get(subjectId);
  if (!usageMap) return [];

  // Aggregate per base concept
  const baseCounts = new Map(); // base → Map<type, count>
  for (const [key, count] of usageMap) {
    const colonIdx = key.lastIndexOf(':');
    const base = colonIdx >= 0 ? key.slice(0, colonIdx) : key;
    const type = colonIdx >= 0 ? key.slice(colonIdx + 1) : 'conceptual';
    if (!baseCounts.has(base)) baseCounts.set(base, new Map());
    baseCounts.get(base).set(type, count);
  }

  // Saturated only when EVERY type >= ceiling
  return [...baseCounts.entries()]
    .filter(([, typeCounts]) =>
      QUESTION_TYPES.every((t) => (typeCounts.get(t) || 0) >= maxPerConcept),
    )
    .map(([base]) => base);
}

// ── Concept memory persistence ────────────────────────────────────────────────

/** Load previously persisted concept memory on worker startup. */
function loadConceptMemory() {
  if (!existsSync(CONCEPT_MEMORY_PATH)) {
    console.log('[memory] No saved concept memory found — starting fresh.');
    return;
  }
  try {
    const saved = JSON.parse(readFileSync(CONCEPT_MEMORY_PATH, 'utf-8'));
    if (saved.concepts) {
      for (const [sid, list] of Object.entries(saved.concepts)) {
        globalConceptMemory.set(sid, new Set(Array.isArray(list) ? list : []));
      }
    }
    if (saved.usage) {
      for (const [sid, obj] of Object.entries(saved.usage)) {
        subtopicUsageMap.set(sid, new Map(Object.entries(obj)));
      }
    }
    const total = [...globalConceptMemory.values()].reduce((s, v) => s + v.size, 0);
    console.log(`[memory] Loaded concept memory: ${total} concepts across ${globalConceptMemory.size} subjects (saved ${saved.updatedAt ?? 'unknown'})`);
  } catch (err) {
    console.warn(`[memory] Failed to load concept memory: ${err.message} — starting fresh.`);
  }
}

function schedulePersist() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistConceptMemory, 5000);
}

function persistConceptMemory() {
  try {
    const concepts = {};
    for (const [sid, set] of globalConceptMemory) concepts[sid] = [...set];
    const usage = {};
    for (const [sid, map] of subtopicUsageMap) usage[sid] = Object.fromEntries(map);
    const dir = dirname(CONCEPT_MEMORY_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      CONCEPT_MEMORY_PATH,
      JSON.stringify({ concepts, usage, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.warn(`[memory] Failed to persist concept memory: ${err.message}`);
  }
}

function sampleArray(items, limit) {
  if (!Array.isArray(items) || items.length <= limit) return items || [];
  return [...items].sort(() => Math.random() - 0.5).slice(0, limit);
}

function normalizeQuestion(question, expectedSubject, expectedChapter) {
  if (!question || typeof question !== 'object') return null;

  const subject = question.subject || expectedSubject;
  const chapter = question.chapter || expectedChapter;
  const options = normalizeWorkerOptions(question.options || question.o || []);
  const correctAnswer = normalizeWorkerAnswer(question.correct_answer || question.answer || question.a, options);
  const body = String(question.body || question.question || question.q || '').trim();

  return {
    ...question,
    subject,
    chapter,
    body,
    question: body,
    options,
    correct_answer: correctAnswer,
    answer: correctAnswer,
    difficulty: question.difficulty || question.d || 'medium',
    difficulty_weight: getDifficultyWeight(question.difficulty || question.d || 'medium'),
    explanation: question.explanation || '',
    topic: question.topic || '',
    concept: question.concept || '',
    concept_id: question.concept_id || '',
    pyq_anchor_id: question.pyq_anchor_id || '',
    anchor_tier: Number(question.anchor_tier || question.anchorTier || 0),
    anchor_source_quality: question.anchor_source_quality || question.anchorSourceQuality || '',
    anchor_live_publish_allowed: question.anchor_live_publish_allowed === true,
    question_type: question.question_type || question.pattern_type || 'statement_based',
    concept_pattern: question.concept_pattern || '',
    trap_option: normalizeOptionKey(question.trap_option || question.trapOption),
    strong_distractors: normalizeOptionKeyArray(question.strong_distractors || question.strongDistractors),
    why_not_textbook: String(question.why_not_textbook || question.whyNotTextbook || '').trim(),
    why_cuet_level: String(question.why_cuet_level || question.whyCuetLevel || '').trim(),
    distractor_rationale: question.distractor_rationale || question.distractorRationale || {},
    passage_id: String(question.passage_id || question.passageId || '').trim(),
    passage_text: String(question.passage_text || question.passageText || '').trim(),
    passage_title: String(question.passage_title || question.passageTitle || '').trim(),
    passage_type: String(question.passage_type || question.passageType || '').trim(),
    passage_group_id: String(question.passage_group_id || question.passageGroupId || question.group_id || '').trim(),
    group_id: String(question.group_id || question.passage_group_id || '').trim(),
    temporary_group_key: String(question.temporary_group_key || question.temp_group_key || '').trim(),
    order_index: Number(question.order_index || question.orderIndex || 0),
    is_passage_linked: question.is_passage_linked === true || Boolean(question.passage_text || question.passage_id || question.passage_group_id || question.temporary_group_key),
    generation_mode: String(question.generation_mode || question.generationMode || '').trim(),
    ordering_logic: String(question.ordering_logic || question.orderingLogic || '').trim(),
  };
}

function normalizeOptionKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(key) ? key : '';
}

function normalizeOptionKeyArray(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,/ ]+/);
  return Array.from(new Set(raw.map(normalizeOptionKey).filter(Boolean))).slice(0, 4);
}

function buildQuestionHash(question) {
  return createHash('sha1')
    .update([
      question?.subject || '',
      question?.chapter || '',
      question?.body || question?.q || question?.question || '',
      JSON.stringify(question?.options || question?.o || []),
    ].join('|'))
    .digest('hex')
    .slice(0, 16);
}

function assignCandidateIdentity(question, jobId, index) {
  const qHash = question.q_hash || buildQuestionHash(question);
  return {
    ...question,
    job_id: question.job_id || jobId,
    q_hash: qHash,
    candidate_id: question.candidate_id || `${jobId}:${index}:${qHash}`,
  };
}

function normalizeWorkerOptions(options) {
  if (Array.isArray(options)) {
    return options.map((option, index) => {
      if (option && typeof option === 'object') {
        return {
          key: String(option.key || ['A', 'B', 'C', 'D'][index] || '').trim().toUpperCase(),
          text: String(option.text || option.value || option.option || '').trim(),
        };
      }
      return {
        key: ['A', 'B', 'C', 'D'][index] || '',
        text: String(option || '').trim(),
      };
    });
  }

  if (options && typeof options === 'object') {
    return Object.entries(options).map(([key, value]) => ({
      key: String(key || '').trim().toUpperCase(),
      text: String(value || '').trim(),
    }));
  }

  return [];
}

function normalizeWorkerAnswer(answer, options) {
  const raw = String(answer || '').trim();
  const upper = raw.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(upper)) return upper;

  const match = (options || []).find((option) => String(option?.text || '').trim().toLowerCase() === raw.toLowerCase());
  return match?.key || '';
}

function isValidQuestion(question) {
  return Boolean(
    question?.body &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    question.correct_answer
  );
}

/** Removes questions that fail structural integrity before dedup or validation. */
function filterMalformedQuestions(questions) {
  const valid = [];
  const rejected = [];
  let removed = 0;

  for (const question of questions) {
    if (!question || typeof question !== 'object') {
      removed += 1;
      rejected.push({ question, reason: 'invalid_question_object' });
      continue;
    }
    if (!isValidQuestion(question)) {
      removed += 1;
      rejected.push({ question, reason: 'malformed_question_schema' });
      continue;
    }

    valid.push(question);
  }

  return { valid, removed, rejected };
}

function filterInternalQualityQuestions(questions, expectedSubject, expectedChapter) {
  const valid = [];
  const rejected = [];

  for (const question of questions) {
    const reason = getInternalRejectionReason(question, expectedSubject, expectedChapter);
    if (reason) {
      rejected.push({ question, reason });
      continue;
    }
    valid.push(question);
  }

  return { valid, rejected };
}

export function getInternalRejectionReason(question, expectedSubject, expectedChapter) {
  if (!isSchemaValid(question)) return 'invalid_schema';
  if (!isValidSyllabusPair(question.subject, question.chapter)) return 'invalid_syllabus_pair';
  if (question.subject !== expectedSubject || question.chapter !== expectedChapter) return 'subject_or_chapter_mismatch';
  const traceability = validateTraceability(question, expectedSubject, expectedChapter);
  if (!traceability.valid) return traceability.reason;
  if (!String(question.pyq_anchor_id || '').trim()) {
    question.pyq_anchor_id = `synthetic_${expectedSubject}_${expectedChapter.replace(/\s+/g, '_').toLowerCase()}`;
    question.anchor_tier = 4;
    question.anchor_source_quality = 'synthetic';
  }
  if (!ALLOWED_ANCHOR_TIERS.has(Number(question.anchor_tier))) {
    question.anchor_tier = 3;
  }

  const body = String(question.body || '').trim();
  const bodyLower = body.toLowerCase();
  if (hasUnsupportedMediaReference(body)) return 'unsupported_media_reference';
  if (isInvalidParaJumblePermutationQuestion(question, expectedChapter)) return 'invalid_para_jumble_permutation';
  const isEnglishReadingComprehension = expectedSubject === 'english' && ENGLISH_RC_CHAPTERS.has(expectedChapter);
  const maxBodyChars = isEnglishReadingComprehension ? 2200 : 900;
  const maxBodyWords = isEnglishReadingComprehension ? 340 : 140;
  if (body.length > maxBodyChars || countWords(body) > maxBodyWords) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'question_too_long',
      body: body.slice(0, 100),
    });
  }
  if (isClearlyAdvancedOrNonCuet(bodyLower)) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'advanced_or_non_cuet_pattern',
      body: body.slice(0, 100),
    });
  }
  if (isClearlyOutsideChapter(question, expectedChapter, expectedSubject)) return 'outside_chapter';
  if (isDirectDefinitionStem(body)) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'direct_definition_or_textbook_stem',
      body: body.slice(0, 100),
    });
  }
  if (hasExtremeQualifier(body) || question.options.some((option) => hasExtremeQualifier(option.text))) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'extreme_qualifier',
      body: body.slice(0, 100),
    });
  }
  if (hasLogicallyImpossibleOption(question.options)) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'logically_impossible_option',
      body: body.slice(0, 100),
    });
  }
  const answer = normalizeOptionKey(question.correct_answer);
  const trapOption = normalizeOptionKey(question.trap_option);
  const strongDistractors = normalizeOptionKeyArray(question.strong_distractors);
  if (!trapOption || strongDistractors.length < 2) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'missing_trap_or_strong_distractors',
      body: body.slice(0, 100),
    });
  }
  if (trapOption && (trapOption === answer || strongDistractors.includes(answer))) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'trap_metadata_points_to_correct_answer',
      body: body.slice(0, 100),
    });
  }
  if (!question.why_not_textbook || !question.why_cuet_level) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'missing_cuet_rationale',
      body: body.slice(0, 100),
    });
  }
  if (!hasCompleteDistractorRationale(question.distractor_rationale)) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'missing_distractor_rationale',
      body: body.slice(0, 100),
    });
  }
  if (hasWeakOptions(question.options, question.correct_answer)) {
    console.warn('[pipeline] pre_validation_quality_warning_log_only', {
      reason: 'weak_options',
      body: body.slice(0, 100),
    });
  }

  return null;
}

function hasCompleteDistractorRationale(rationale) {
  return ['A', 'B', 'C', 'D'].every((key) => String(rationale?.[key] || '').trim().length >= 8);
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isClearlyAdvancedOrNonCuet(text) {
  const value = String(text || '').toLowerCase();
  const allowedCuetPattern = /\b(statement|assertion|reason|match|ncert|observation|graph|one-step|formula|conceptual|application)\b/.test(value);
  if (allowedCuetPattern && !/\b(jee|neet|olympiad|graduate|functional analysis|abstract algebra|heine-borel|rank-nullity)\b/.test(value)) {
    return false;
  }
  if (/\b(vector space|subspace|basis|rank-nullity|heine-borel|cayley-hamilton|jee|neet|olympiad|graduate|mba|b\.com|econometrics|hypothesis testing|functional analysis|abstract algebra|group under)\b/i.test(value)) {
    return true;
  }
  if (/\b(prove|proof|derive|derivation|multi-step)\b/i.test(value) && !allowedCuetPattern) return true;
  const formulaSignals = (value.match(/[=+\-*/^]/g) || []).length;
  const variableSignals = (value.match(/\b[a-z]\s*=/g) || []).length;
  return formulaSignals > 4 || variableSignals > 3;
}

function hasUnsupportedMediaReference(body) {
  return /\b(figure|diagram|graph|image|table)\b[^.?!]{0,80}\b(not provided|not shown|missing|below|above)\b/i.test(String(body || ''));
}

function isInvalidParaJumblePermutationQuestion(question, expectedChapter) {
  const type = String(question?.question_type || '').toLowerCase();
  const chapter = String(expectedChapter || question?.chapter || '').toLowerCase();
  if (type !== 'para_jumble' && !/\bpara\s*jumbles?\b|sentence\s+rearrangement|sentence\s+reordering|paragraph\s+rearrangement/.test(chapter)) {
    return false;
  }
  const options = question?.options || [];
  if (!Array.isArray(options) || options.length !== 4) return true;
  return options.some((option) => {
    const compact = String(option?.text || option || '').toUpperCase().replace(/[^A-D]/g, '');
    return compact.length !== 4 || compact.split('').sort().join('') !== 'ABCD';
  });
}

function isDirectDefinitionStem(body) {
  const text = String(body || '').trim().toLowerCase();
  return /^(what is|define|meaning of|which term|who is|when did)\b/.test(text) ||
    /\b(correct definition|best definition|definition of|refers to|is known as)\b/.test(text) ||
    /\bwhich of the following (statements )?(is|are) correct\??$/.test(text) ||
    /\bwhich (principle|concept|term) (of management )?(is|has been|is primarily) (being )?(applied|reflected|demonstrated)\b/.test(text) ||
    /\bthis reflects which (concept|principle|term)\b/.test(text);
}

function hasExtremeQualifier(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(solely|entirely|impossible|guaranteed)\b/.test(value)) return true;
  return /\b(always|never|all|only|completely|independent)\b/.test(value) &&
    /\b(no effect|same in every case|direction of motion|environmentally friendly|unrelated|random|absurd|without exception)\b/.test(value);
}

function hasLogicallyImpossibleOption(options) {
  return options.some((option) => /\b(unrelated|none of these|all of these|both a and b|cannot be determined|not possible|impossible in every case|has no relation)\b/i.test(String(option?.text || '')));
}

function hasWeakOptions(options, correctAnswer) {
  if (!Array.isArray(options) || options.length !== 4) return true;
  const keys = options.map((option) => String(option?.key || '').trim().toUpperCase());
  if (!['A', 'B', 'C', 'D'].every((key) => keys.includes(key))) return true;
  if (!keys.includes(String(correctAnswer || '').trim().toUpperCase())) return true;

  const texts = options.map((option) => String(option?.text || '').trim().toLowerCase());
  if (texts.some((text) => text.length < 2)) return true;
  if (new Set(texts).size !== 4) return true;
  if (texts.some((text) => /\b(all of the above|none of the above|both a and b|cannot be determined)\b/i.test(text))) return true;
  if (texts.some(hasExtremeQualifier)) return true;
  if (!hasPlausibleOptionConfusion(options, correctAnswer)) return true;

  const avgLength = texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
  return texts.some((text) => avgLength > 0 && text.length < avgLength * 0.25);
}

function hasPlausibleOptionConfusion(options, correctAnswer) {
  const answerKey = String(correctAnswer || '').trim().toUpperCase();
  const correct = options.find((option) => String(option?.key || '').trim().toUpperCase() === answerKey);
  if (!correct) return false;
  const texts = options.map((option) => String(option?.text || '').trim());
  const numericOptions = texts.filter((text) => /\d/.test(text)).length;
  if (numericOptions >= 3) return true;
  const correctText = String(correct.text || '');
  const distractors = options.filter((option) => String(option?.key || '').trim().toUpperCase() !== answerKey);
  const closeDistractors = distractors.filter((option) => optionSimilarity(correctText, option.text) >= 0.16).length;
  const partialTruthSignals = distractors.filter((option) => /\b(partly|mainly|usually|sometimes|increase|decrease|public|private|both|not all|except|because|while|but|however|whereas|similar|different)\b/i.test(option.text)).length;
  return closeDistractors >= 1 && (partialTruthSignals >= 1 || closeDistractors >= 2);
}

function rankValidationCandidates(questions, limit = VALIDATION_CANDIDATE_LIMIT) {
  return [...questions]
    .map((question, index) => ({
      question,
      index,
      score: scoreCandidateForValidation(question, questions),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.question);
}

function pickValidationSample(questions, coverage, sampleRate = STANDARD_VALIDATION_SAMPLE_RATE) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const selected = questions.filter((question) => (
    question?.difficulty === 'hard' ||
    coverage < LOW_COVERAGE_VALIDATION_THRESHOLD ||
    Math.random() < sampleRate
  ));
  return selected.length > 0 ? selected : [questions[0]];
}

function balanceCorrectAnswerDistribution(questions) {
  const keys = ['A', 'B', 'C', 'D'];
  return questions.map((question, index) => {
    const targetKey = keys[index % keys.length];
    return moveCorrectAnswerToKey(question, targetKey);
  });
}

function moveCorrectAnswerToKey(question, targetKey) {
  const currentKey = String(question.correct_answer || '').trim().toUpperCase();
  if (!keysIncludeAnswer(currentKey) || !keysIncludeAnswer(targetKey) || currentKey === targetKey) return question;

  const options = normalizeWorkerOptions(question.options);
  const currentIndex = options.findIndex((option) => option.key === currentKey);
  const targetIndex = options.findIndex((option) => option.key === targetKey);
  if (currentIndex < 0 || targetIndex < 0) return question;

  const reordered = options.map((option) => ({ ...option }));
  const [correctOption] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, correctOption);
  const rekeyed = reordered.map((option, index) => ({
    ...option,
    key: ['A', 'B', 'C', 'D'][index],
  }));

  return {
    ...question,
    options: rekeyed,
    correct_answer: targetKey,
    answer: targetKey,
  };
}

function keysIncludeAnswer(key) {
  return ['A', 'B', 'C', 'D'].includes(key);
}

function logRejectedQuestion({ subject, chapter, reason, attemptCount = 0, source = 'pipeline', rule = null, details = null }) {
  console.log('[reject]', {
    subject,
    chapter,
    reason,
    source,
    rule: rule || reason,
    details,
    attemptCount,
  });
}

function parseValidatorRetryFeedback(errorMessage) {
  const raw = String(errorMessage || '');
  if (!raw.startsWith(VALIDATOR_FEEDBACK_PREFIX)) {
    return { attempt: 0, reasons: [], previousAttempts: [] };
  }

  try {
    const parsed = JSON.parse(raw.slice(VALIDATOR_FEEDBACK_PREFIX.length));
    return {
      attempt: Math.max(0, Math.min(Number(parsed.attempt || 0), MAX_RETRIES - 1)),
      reasons: collectUniqueFeedbackReasons(parsed.reasons || []),
      previousAttempts: normalizePreviousAttempts(parsed.previous_attempts || parsed.previousAttempts || []),
    };
  } catch {
    return { attempt: 0, reasons: [], previousAttempts: [] };
  }
}

function collectValidationReasons(validation) {
  const reasons = [
    ...(Array.isArray(validation?.reasons) ? validation.reasons : []),
    ...(Array.isArray(validation?.issues) ? validation.issues : []),
  ];

  if (validation?.syllabus_alignment && validation.syllabus_alignment !== 'WITHIN') reasons.push('outside CUET syllabus');
  if (validation?.concept_match && validation.concept_match !== 'EXACT') reasons.push('concept mismatch');
  if (validation?.difficulty_level === 'TOO HARD' || validation?.compared_to_pyqs === 'HARDER') reasons.push('too hard compared to PYQs');
  if (validation?.clarity === 'AMBIGUOUS') reasons.push('ambiguous wording');
  if (validation?.language_level === 'COMPLEX') reasons.push('language too complex');
  if (validation?.option_quality && validation.option_quality !== 'CLEAN') reasons.push('ambiguous or confusing options');
  if (validation?.subject_consistency && validation.subject_consistency !== 'CORRECT') reasons.push('subject mismatch');
  if (validation?.verdict === 'INVALID' && reasons.length === 0) reasons.push('validator marked invalid');

  return collectUniqueFeedbackReasons(reasons);
}

function getValidationAcceptanceDecision(validation, scoreThreshold) {
  const normalizedDecision = String(validation?.decision || '').trim().toLowerCase();
  if (normalizedDecision === 'accept') {
    const signalMismatches = collectAcceptedSignalMismatches(validation, scoreThreshold);
    return {
      accept: true,
      recover: false,
      source: 'validator_normalized',
      rule: 'validator_decision_accept',
      reasons: [],
      signalMismatches,
    };
  }

  if (normalizedDecision === 'recover') {
    const reasons = collectValidationReasons(validation);
    return {
      accept: false,
      recover: true,
      source: 'validator_normalized',
      rule: 'validator_decision_recover',
      reasons,
      signalMismatches: [],
    };
  }

  const reasons = collectValidationReasons(validation);
  return {
    accept: false,
    recover: false,
    source: 'validator_normalized',
    rule: reasons[0] || normalizedDecision || 'validator_decision_missing',
    reasons: reasons.length > 0 ? reasons : ['validator decision reject'],
    signalMismatches: [],
  };
}

function collectAcceptedSignalMismatches(validation, scoreThreshold) {
  const mismatches = [];
  if (Number(validation?.score ?? 0) < scoreThreshold) mismatches.push('score_below_threshold_but_accepted');
  if (validation?.syllabus_alignment && validation.syllabus_alignment !== 'WITHIN') mismatches.push('outside_syllabus_but_accepted');
  if (validation?.concept_match && validation.concept_match !== 'EXACT') mismatches.push('concept_mismatch_but_accepted');
  if (validation?.subject_consistency && validation.subject_consistency !== 'CORRECT') mismatches.push('subject_mismatch_but_accepted');
  return mismatches;
}

function normalizeUnitScore(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 10) return Math.min(1, n / 100);
  if (n > 1) return Math.min(1, n / 10);
  return Math.min(1, n);
}

function toTenPointScore(value) {
  return Number((normalizeUnitScore(value) * 10).toFixed(1));
}

function normalizeTrapQuality(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') return normalized;
  return 'LOW';
}

function isLayerAccepted(validation, question = {}, layer = validation?.layer || 'mini') {
  return isPublishAllowedByQuality(validation, question, QUALITY_MODE, layer).allowed;
}

function shouldEscalateToStrict(question, validation) {
  const verdict = String(validation?.verdict || '').toLowerCase();
  const score = normalizeUnitScore(validation?.score);
  const issues = Array.isArray(validation?.issues) ? validation.issues.join(' ').toLowerCase() : '';

  const qualityEscalation = shouldRequireStrictValidation(question, validation, QUALITY_MODE);
  return qualityEscalation.required ||
    verdict === 'borderline' ||
    (score >= 0.60 && score < 0.80) ||
    question?.concept_mismatch_risk === 'high' ||
    question?.anchor_confidence === 'low' ||
    question?.selfcheck_obviousness_risk !== 'low' ||
    question?.selfcheck_distractor_quality !== 'high' ||
    /\b(factual|uncertain|answer|concept|alignment)\b/.test(issues);
}

function scoreEscalationCandidate(question, validation) {
  const anchorBonus = question?.anchor_confidence === 'high' ? 0.08 : question?.anchor_confidence === 'medium' ? 0.04 : 0;
  const distractorBonus = question?.selfcheck_distractor_quality === 'high' ? 0.08 : question?.selfcheck_distractor_quality === 'medium' ? 0.04 : 0;
  const trapBonus = question?.selfcheck_trap_quality === 'high' ? 0.08 : question?.selfcheck_trap_quality === 'medium' ? 0.04 : 0;
  const issuePenalty = Array.isArray(validation?.issues) ? Math.min(0.12, validation.issues.length * 0.03) : 0;
  return normalizeUnitScore(validation?.score) + anchorBonus + distractorBonus + trapBonus - issuePenalty;
}

function selectStrictEscalationCandidates(questions, miniResults, maxCount = STRICT_VALIDATION_MAX_PER_BATCH) {
  return questions
    .map((question, index) => ({ question, index, validation: miniResults[index] }))
    .filter(({ question, validation }) => {
      if (!validation) return false;
      const verdict = String(validation?.verdict || '').toLowerCase();
      if (verdict === 'reject' && normalizeUnitScore(validation?.score) < 0.60) return false;
      return shouldEscalateToStrict(question, validation);
    })
    .sort((a, b) => scoreEscalationCandidate(b.question, b.validation) - scoreEscalationCandidate(a.question, a.validation))
    .slice(0, Math.max(0, maxCount));
}

function collectLayerValidationReasons(validation) {
  const reasons = collectUniqueFeedbackReasons([
    ...(Array.isArray(validation?.issues) ? validation.issues : []),
    String(validation?.verdict || '').toLowerCase() === 'reject' ? 'validator rejected' : '',
    validation?.cuet_alignment === false ? 'cuet alignment failed' : '',
    normalizeTrapQuality(validation?.trap_quality) === 'LOW' ? 'trap quality low' : '',
    normalizeUnitScore(validation?.score) < 0.72 ? 'score below final threshold' : '',
    normalizeUnitScore(validation?.exam_quality) < 0.70 ? 'exam quality below threshold' : '',
    normalizeUnitScore(validation?.distractor_quality) < 0.70 ? 'distractor quality below threshold' : '',
    normalizeUnitScore(validation?.conceptual_depth) < 0.60 ? 'conceptual depth below threshold' : '',
  ]);
  return reasons.length > 0 ? reasons : ['not accepted by validation layer'];
}

function buildValidatedQuestion(question, validation, layer) {
  const band = validation?.quality_band || classifyQualityBand(validation);
  return {
    ...question,
    validation_score: toTenPointScore(validation?.score),
    validation_decision: 'accept',
    validation_verdict: 'VALID',
    validation_cuet_alignment: validation?.cuet_alignment === true,
    validation_exam_quality: toTenPointScore(validation?.exam_quality),
    validation_distractor_quality: toTenPointScore(validation?.distractor_quality),
    validation_conceptual_depth: toTenPointScore(validation?.conceptual_depth),
    validation_trap_quality: normalizeTrapQuality(validation?.trap_quality),
    validation_quality_band: band,
    validation_answer_confidence: normalizeUnitScore(validation?.answer_confidence ?? 1),
    validation_factual_accuracy: validation?.factual_accuracy !== false,
    validation_passage_dependency: validation?.passage_dependency === true,
    validation_answer_supported_by_passage: validation?.answer_supported_by_passage === true,
    validation_answerable_without_passage: validation?.answerable_without_passage === true,
    validation_multiple_correct_risk: validation?.multiple_correct_risk === true,
    validation_pyq_style_match: validation?.pyq_style_match !== false,
    validation_layer: layer,
    validation_model: validation?.model || layer,
    validation_sampled: true,
    strict_cuet_validated: true,
    strict_validation_accepted: layer === 'strict' || question?.anchor_confidence !== 'low',
    compositeScore: toTenPointScore(validation?.score) * 10,
    validator_recommended_difficulty: normalizeOptionalDifficulty(validation?.recommended_difficulty),
    anchor_source_quality: getAnchorSourceQuality(question),
  };
}

function countLayerVerdicts(results = []) {
  return results.reduce((counts, result) => {
    const verdict = String(result?.verdict || 'reject').toLowerCase();
    if (verdict === 'accept') counts.accepted += 1;
    else if (verdict === 'borderline') counts.borderline += 1;
    else counts.rejected += 1;
    return counts;
  }, { accepted: 0, borderline: 0, rejected: 0 });
}

function getAnchorSourceQuality(question) {
  const direct = String(question?.anchor_source_quality || '').trim().toLowerCase();
  if (direct) return direct;
  const anchor = PYQ_ANCHORS.find((entry) => entry.id === question?.pyq_anchor_id);
  if (anchor?.source_quality) return String(anchor.source_quality).trim().toLowerCase();
  if (/synthetic|none/i.test(String(question?.pyq_anchor_id || ''))) return 'synthetic';
  return 'unknown';
}

function attachAnchorMetadata(question, expectedSubject, expectedChapter) {
  const anchorSource = getAnchorSourceQuality(question);
  const anchorTier = Number(question?.anchor_tier || 0);
  const anchorId = String(question?.pyq_anchor_id || '');
  const subjectMismatch = question?.subject !== expectedSubject;
  const chapterMismatch = question?.chapter !== expectedChapter;
  const structureOnly = anchorId.startsWith('structure_only_') || anchorTier === 3;
  let anchorMatchLevel = question?.anchor_match_level || 'none';
  let anchorConfidence = question?.anchor_confidence || 'low';

  if (anchorTier === 1 && !structureOnly && ['real_pyq', 'manual_seed'].includes(anchorSource)) {
    anchorMatchLevel = 'exact_chapter';
    anchorConfidence = 'high';
  } else if (anchorTier === 2 && ['real_pyq', 'manual_seed'].includes(anchorSource)) {
    anchorMatchLevel = 'same_unit';
    anchorConfidence = 'medium';
  } else if (structureOnly) {
    anchorMatchLevel = 'structure_only';
    anchorConfidence = 'low';
  } else {
    anchorMatchLevel = anchorMatchLevel === 'none' ? 'none' : anchorMatchLevel;
    anchorConfidence = 'low';
  }

  const conceptMismatchRisk = subjectMismatch || chapterMismatch
    ? 'high'
    : String(question?.concept_mismatch_risk || '').toLowerCase() === 'high'
      ? 'high'
      : anchorConfidence === 'low'
        ? 'medium'
        : 'low';

  return {
    ...question,
    anchor_tier: ALLOWED_ANCHOR_TIERS.has(anchorTier) ? anchorTier : 3,
    anchor_source_quality: anchorSource,
    anchor_match_level: anchorMatchLevel,
    anchor_confidence: anchorConfidence,
    concept_mismatch_risk: conceptMismatchRisk,
  };
}

function getPublishGateRejectReason(question) {
  if (question?.fallback_used === true) return 'fallback_never_publishes';
  if (question?.structural_pool_fallback === true) return 'structural_fallback_never_publishes';
  if (question?.is_passage_linked === true && question?.passage_group_publish_allowed !== true) return 'passage_child_without_parent_group_publish';
  if (question?.concept_mismatch_risk === 'high' && question?.strict_validation_accepted !== true) return 'high_concept_mismatch_risk';
  if (question?.strict_cuet_validated !== true) return 'not_strictly_validated';
  const anchorSource = getAnchorSourceQuality(question);
  if (!['real_pyq', 'manual_seed'].includes(anchorSource)) return `draft_only_anchor_source_${anchorSource || 'unknown'}`;
  const validationDecision = String(question?.validation_decision || '').toLowerCase();
  if (validationDecision !== 'accept' && validationDecision !== 'accept_passage_child') return 'validator_decision_not_accept';
  if (String(question?.validation_verdict || '').toUpperCase() !== 'VALID') return 'validator_verdict_not_valid';
  if (question?.validation_cuet_alignment !== true) return 'validator_cuet_alignment_failed';
  if (Number(question?.validation_score || 0) < 7) return 'validator_score_below_7';
  if (Number(question?.validation_exam_quality || 0) < 7) return 'validator_exam_quality_below_7';
  if (Number(question?.validation_distractor_quality || 0) < 7) return 'validator_distractor_quality_below_7';
  if (Number(question?.validation_conceptual_depth || 0) < 6) return 'validator_conceptual_depth_below_6';
  if (String(question?.validation_trap_quality || '').toUpperCase() === 'LOW') return 'validator_trap_quality_low';
  return null;
}

function isValidationAnchorEligible(question) {
  return question?.fallback_used !== true && question?.structural_pool_fallback !== true;
}

function collectUniqueFeedbackReasons(reasons) {
  const unique = new Set();
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    const clean = String(reason || '').trim();
    if (clean) unique.add(clean);
  }
  return [...unique].slice(0, 12);
}

function shouldUsePremiumFeedbackPrompt(reasons = []) {
  return QUALITY_MODE === 'premium' && collectUniqueFeedbackReasons(reasons)
    .some((reason) => PREMIUM_RETRY_REASONS.has(reason));
}

function withPremiumFeedbackPrompt(reasons = []) {
  const unique = collectUniqueFeedbackReasons(reasons);
  if (!shouldUsePremiumFeedbackPrompt(unique)) return unique;
  return collectUniqueFeedbackReasons([
    ...unique,
    'premium_feedback_prompt: make distractors closer',
    'premium_feedback_prompt: make trap option passage-based when passage is present',
    'premium_feedback_prompt: make answer_check quote passage evidence',
    'premium_feedback_prompt: increase passage inferential depth',
    'premium_feedback_prompt: avoid generic central-theme options',
    'premium_feedback_prompt: for para jumbles, make options closer and logic stronger',
  ]);
}

function normalizePreviousAttempts(attempts) {
  if (!Array.isArray(attempts)) return [];
  return attempts
    .map((attempt) => ({
      question: String(attempt?.question || '').trim().slice(0, 240),
      reasons: collectUniqueFeedbackReasons(attempt?.reasons || []),
    }))
    .filter((attempt) => attempt.question || attempt.reasons.length > 0)
    .slice(-8);
}

function buildPreviousAttemptsFromRejected(entries) {
  return normalizePreviousAttempts(entries.map((entry) => ({
    question: entry.question?.body || entry.question?.question || '',
    reasons: entry.reasons || [],
  })));
}

async function requeueJobWithValidatorFeedback(jobId, attempt, reasons, previousAttempts = []) {
  const feedbackReasons = withPremiumFeedbackPrompt(reasons);
  const feedback = {
    attempt,
    reasons: feedbackReasons,
    previous_attempts: normalizePreviousAttempts(previousAttempts),
    updatedAt: new Date().toISOString(),
  };

  console.warn('[validator-feedback] requeueing_job_with_feedback', {
    job_id: jobId,
    next_attempt: attempt + 1,
    max_attempts: MAX_RETRIES,
    reasons: feedback.reasons,
    previous_attempts: feedback.previous_attempts.length,
  });

  await supabase
    .from('generation_jobs')
    .update({
      status: 'queued',
      error_message: `${VALIDATOR_FEEDBACK_PREFIX}${JSON.stringify(feedback)}`,
    })
    .eq('id', jobId);
}

function scoreCandidateForValidation(question, pool) {
  const body = String(question?.body || '').trim();
  const tokens = body.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2);
  const uniqueTokens = new Set(tokens);
  const optionTexts = Array.isArray(question?.options)
    ? question.options.map((option) => String(option?.text || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const optionTokenSets = optionTexts.map((text) => new Set(text.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)));
  const typeBonus = inferQuestionType(body) === 'conceptual' ? 0 : 0.5;
  const structureBonus = /assertion|reason|match|case|scenario|calculate|find|compare|identify|evaluate/i.test(body) ? 1 : 0;
  const lengthScore = Math.min(tokens.length, 28) / 28;
  const diversityScore = tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;
  const optionScore = scoreOptionDiversity(optionTokenSets);
  const uniquenessScore = 1 - Math.max(0, ...pool.filter((candidate) => candidate !== question).map((candidate) => lexicalOverlap(body, candidate.body)));

  return (lengthScore * 2) + diversityScore + optionScore + uniquenessScore + structureBonus + typeBonus;
}

function scoreOptionDiversity(optionTokenSets) {
  if (optionTokenSets.length !== 4) return 0;
  let totalOverlap = 0;
  let closePairs = 0;
  let pairs = 0;
  for (let i = 0; i < optionTokenSets.length; i += 1) {
    for (let j = i + 1; j < optionTokenSets.length; j += 1) {
      const overlap = setOverlap(optionTokenSets[i], optionTokenSets[j]);
      totalOverlap += overlap;
      if (overlap >= 0.18 && overlap <= 0.75) closePairs += 1;
      pairs += 1;
    }
  }
  const averageOverlap = pairs > 0 ? totalOverlap / pairs : 0;
  const confusionScore = Math.min(closePairs, 3) / 3;
  const separationPenalty = averageOverlap > 0.80 ? 0.5 : 0;
  return Math.max(0, confusionScore - separationPenalty);
}

function lexicalOverlap(left, right) {
  const leftSet = new Set(String(left || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2));
  const rightSet = new Set(String(right || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2));
  return setOverlap(leftSet, rightSet);
}

function filterSimilarQuestions(questions, existingQuestions, recentLimit = 50) {
  const valid = [];
  const rejected = [];
  const recentBodies = (existingQuestions || [])
    .map((question) => question?.body)
    .filter(Boolean)
    .slice(0, recentLimit);

  for (const question of questions || []) {
    const reason = getSimilarityRejectionReason(question, [...recentBodies, ...valid.map((entry) => entry.body)]);
    if (reason) {
      rejected.push({ question, reason, reasons: [reason] });
      continue;
    }
    valid.push(question);
  }

  return { valid, rejected };
}

function getSimilarityRejectionReason(question, recentBodies) {
  const body = String(question?.body || '').trim();
  if (!body) return 'empty_question_for_similarity_check';

  const anchor = PYQ_ANCHORS.find((entry) => entry.id === question.pyq_anchor_id);
  if (anchor?.question_text && isTooSimilar(body, anchor.question_text, { keyword: 0.72, phrase: 0.55 })) {
    return 'too_similar_to_pyq_anchor';
  }

  for (const recentBody of recentBodies || []) {
    if (isTooSimilar(body, recentBody, { keyword: 0.82, phrase: 0.65 })) {
      return 'too_similar_to_recent_question';
    }
  }

  return null;
}

function isTooSimilar(left, right, thresholds) {
  const keywordScore = lexicalOverlapWithoutStopwords(left, right);
  const phraseScore = phraseOverlap(left, right);
  return keywordScore >= thresholds.keyword || phraseScore >= thresholds.phrase;
}

function lexicalOverlapWithoutStopwords(left, right) {
  const leftSet = new Set(tokenizeSignificantWords(left));
  const rightSet = new Set(tokenizeSignificantWords(right));
  return setOverlap(leftSet, rightSet);
}

function phraseOverlap(left, right) {
  const leftPhrases = new Set(extractPhrases(left));
  const rightPhrases = new Set(extractPhrases(right));
  return setOverlap(leftPhrases, rightPhrases);
}

function extractPhrases(text) {
  const tokens = tokenizeSignificantWords(text);
  const phrases = [];
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.push(tokens.slice(index, index + size).join(' '));
    }
  }
  return phrases;
}

function tokenizeSignificantWords(text) {
  const stopwords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'which', 'what', 'when', 'where', 'will', 'would', 'should', 'could', 'into', 'than', 'then', 'are', 'was', 'were', 'has', 'have', 'had', 'not', 'only', 'one', 'two', 'following', 'correct', 'incorrect']);
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function setOverlap(leftSet, rightSet) {
  if (leftSet.size === 0 && rightSet.size === 0) return 1;
  const intersection = new Set([...leftSet].filter((token) => rightSet.has(token)));
  const union = new Set([...leftSet, ...rightSet]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/** Final schema guard before publish — ensures no corrupt question reaches the DB. */
function isSchemaValid(question) {
  if (!question || typeof question !== 'object') return false;
  if (!String(question.body || '').trim()) return false;
  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  const answer = String(question.correct_answer || '').trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(answer)) return false;
  const keys = question.options.map((o) => String(o?.key || '').trim().toUpperCase());
  return keys.includes(answer);
}

function getInitialGenerationCount(chapter) {
  return HEAVY_GENERATION_CHAPTERS.has(chapter)
    ? HEAVY_CHAPTER_GENERATION_COUNT
    : DEFAULT_GENERATION_COUNT;
}

function isGenerationTimeout(result) {
  return result?.error === 'timeout' ||
    result?.reason === 'timeout' ||
    String(result?.message || '').toLowerCase().includes('timeout');
}

function isValidSyllabusPair(subjectId, chapter) {
  return isValidTopSyllabusPair(subjectId, chapter);
}

function getCoveragePriority(subject, chapter, count, subjectTotal = 0) {
  let priority = 10;
  if (count === 0) priority = 100;
  else if (count < 10) priority = 90;
  else if (count < 25) priority = 75;
  else if (count < MIN_QUESTIONS_PER_CHAPTER) priority = 60;
  else if (count < 60) priority = 50;

  if (subjectTotal < 60) priority += 5;
  return Math.min(priority, 100);
}

async function getCoverageSnapshot() {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('questions')
      .select('subject, chapter')
      .in('subject', TOP_SUBJECTS)
      .eq('is_deleted', false)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  const chapterCounts = new Map();
  const subjectTotals = new Map();

  for (const row of rows) {
    const subject = row.subject;
    const chapter = row.chapter;
    if (!subject || !chapter) continue;
    if (!isValidSyllabusPair(subject, chapter)) continue;

    const chapterKey = `${subject}::${chapter}`;
    chapterCounts.set(chapterKey, (chapterCounts.get(chapterKey) || 0) + 1);
    subjectTotals.set(subject, (subjectTotals.get(subject) || 0) + 1);
  }

  return { chapterCounts, subjectTotals };
}

function annotateJobWithCoverage(job, coverage) {
  const questionCount = coverage.chapterCounts.get(`${job.subject_id}::${job.chapter}`) || 0;
  const subjectTotal = coverage.subjectTotals.get(job.subject_id) || 0;
  const originalPriority = Number(job.original_priority ?? job.priority ?? 0);
  const effectivePriority = getCoveragePriority(job.subject_id, job.chapter, questionCount, subjectTotal);

  return {
    ...job,
    question_count: questionCount,
    subject_question_count: subjectTotal,
    priority: originalPriority,
    original_priority: originalPriority,
    effective_priority: effectivePriority,
  };
}

function compareJobsByCoverage(a, b) {
  return a.question_count - b.question_count ||
    b.effective_priority - a.effective_priority ||
    new Date(a.created_at || 0) - new Date(b.created_at || 0);
}

export function selectPlannerPriorityJobFromRows(jobs = [], preferredJobIds = [], coverage = { chapterCounts: new Map(), subjectTotals: new Map() }, override = null) {
  const preferredSet = new Set((preferredJobIds || []).filter(Boolean));
  if (preferredSet.size === 0) return null;
  const overrideConfigLocal = override || getCuetOverrideConfig({ env: {}, argv: [] });
  const preferredJobs = filterJobsByOverride(jobs || [], overrideConfigLocal)
    .filter((job) => preferredSet.has(job.id) && job.status === 'queued')
    .filter((candidate) => isValidSyllabusPair(candidate.subject_id, candidate.chapter))
    .map((candidate) => annotateJobWithCoverage(candidate, coverage))
    .sort((a, b) => (
      Number(b.original_priority ?? b.priority ?? 0) - Number(a.original_priority ?? a.priority ?? 0) ||
      new Date(a.created_at || 0) - new Date(b.created_at || 0)
    ));
  return preferredJobs[0] || null;
}

export function selectCoverageFallbackJobFromRows(jobs = [], coverage = { chapterCounts: new Map(), subjectTotals: new Map() }, override = null) {
  const overrideConfigLocal = override || getCuetOverrideConfig({ env: {}, argv: [] });
  return filterJobsByOverride(jobs || [], overrideConfigLocal)
    .filter((job) => job.status === 'queued')
    .filter((candidate) => isValidSyllabusPair(candidate.subject_id, candidate.chapter))
    .map((candidate) => annotateJobWithCoverage(candidate, coverage))
    .sort(compareJobsByCoverage)[0] || null;
}

async function markJobAsSkipped(jobId, reason = 'Invalid subject') {
  await supabase
    .from('generation_jobs')
    .update({
      status: 'skipped',
      completed_at: new Date().toISOString(),
      error_message: reason,
    })
    .eq('id', jobId);
}

async function skipInvalidQueuedJobs() {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('id, subject_id, chapter')
    .eq('status', 'queued')
    .limit(1000);

  if (error) throw error;

  const invalidJobs = (data || []).filter((job) => !isValidSyllabusPair(job.subject_id, job.chapter));
  for (const job of invalidJobs) {
    console.warn('[worker] Skipping invalid syllabus job:', {
      subject: job.subject_id,
      chapter: job.chapter,
    });
    await markJobAsSkipped(job.id, `Invalid syllabus pair: ${job.subject_id}/${job.chapter}`);
  }
}

async function recoverStaleProcessingJobs() {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString();
  const { data, error } = await supabase
    .from('generation_jobs')
    .update({
      status: 'queued',
      started_at: null,
      error_message: `requeued stale processing job after ${STALE_PROCESSING_MINUTES} minutes`,
    })
    .eq('status', 'processing')
    .lt('started_at', staleBefore)
    .select('id, subject_id, chapter, started_at');

  if (error) {
    console.warn(`[worker] stale processing recovery failed: ${error.message}`);
    return;
  }

  if (data?.length > 0) {
    console.warn('[worker] recovered stale processing jobs:', data);
  }
}

async function selectCoverageFirstJob({ preferredJobIds = [], coverage, excludeSubject = null, minPriority = null, excludeChapterKeys = new Set(), override = overrideConfig } = {}) {
  const allowedSubjects = override?.subjects?.length > 0
    ? override.subjects.filter((subjectId) => VALID_SUBJECTS.has(subjectId))
    : [...VALID_SUBJECTS];
  let query = supabase
    .from('generation_jobs')
    .select('*')
    .eq('status', 'queued')
    .in('subject_id', allowedSubjects.length > 0 ? allowedSubjects : [...VALID_SUBJECTS])
    .order('created_at', { ascending: true })
    .limit(1000);

  if (preferredJobIds.length > 0) {
    query = query.in('id', preferredJobIds);
  }

  if (excludeSubject) {
    query = query.neq('subject_id', excludeSubject);
  }

  if (minPriority !== null) {
    query = query.gte('priority', minPriority);
  }

  const { data, error } = await query;
  if (error) throw error;
  const overrideSkipped = (data || []).filter((candidate) => !isJobAllowedByOverride(candidate, override).allowed);
  for (const skipped of overrideSkipped.slice(0, 5)) {
    console.log('[override] skipped_job', {
      job_id: skipped.id,
      subject: skipped.subject_id,
      chapter: skipped.chapter,
      reason: isJobAllowedByOverride(skipped, override).reason,
    });
  }
  runMetrics.override_skipped_jobs += overrideSkipped.length;
  const allowedRows = filterJobsByOverride(data || [], override);

  if (preferredJobIds.length > 0) {
    const selected = selectPlannerPriorityJobFromRows(
      allowedRows.filter((candidate) => !excludeChapterKeys.has(`${candidate.subject_id}::${candidate.chapter}`)),
      preferredJobIds,
      coverage,
      override,
    );
    if (selected) {
      console.log('[worker_selection]', {
        mode: 'planner_priority',
        selected_job_id: selected.id,
        selected_subject: selected.subject_id,
        selected_chapter: selected.chapter,
        selected_priority: selected.effective_priority,
        original_priority: selected.original_priority,
        skipped_higher_priority_jobs: allowedRows
          .filter((candidate) => candidate.status === 'queued')
          .filter((candidate) => Number(candidate.priority || 0) > Number(selected.original_priority || 0))
          .length,
      });
    }
    return selected;
  }

  const jobs = allowedRows
    .filter((candidate) => !excludeChapterKeys.has(`${candidate.subject_id}::${candidate.chapter}`))
    .filter((candidate) => isValidSyllabusPair(candidate.subject_id, candidate.chapter))
    .map((candidate) => annotateJobWithCoverage(candidate, coverage))
    .sort(compareJobsByCoverage);

  const selected = jobs[0] || null;
  if (selected) {
    console.log('[worker_selection]', {
      mode: 'coverage_fallback',
      selected_job_id: selected.id,
      selected_subject: selected.subject_id,
      selected_chapter: selected.chapter,
      selected_priority: selected.effective_priority,
      original_priority: selected.original_priority,
      skipped_higher_priority_jobs: 0,
    });
  }
  return selected;
}

async function selectFocusedQualityJob({ coverage } = {}) {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('status', 'queued')
    .eq('error_message', FOCUSED_QUALITY_JOB_MARKER)
    .in('subject_id', [...VALID_SUBJECTS])
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;

  const jobs = filterJobsByOverride(data || [], overrideConfig)
    .filter((candidate) => isValidSyllabusPair(candidate.subject_id, candidate.chapter))
    .map((candidate) => annotateJobWithCoverage(candidate, coverage))
    .sort(compareJobsByCoverage);

  return jobs[0] || null;
}

function isFocusedQualityJob(job) {
  return job?.error_message === FOCUSED_QUALITY_JOB_MARKER;
}

async function workerLoop() {
  console.log('\nAutonomous CUET Question Engine Started');
  if (!supabase) {
    console.error('[worker] supabase_unavailable: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --start');
    return;
  }
  loadConceptMemory();

  let lastPlanTime = 0;
  let preferredPlannedJobIds = [];
  const activeJobs = new Map();
  const activeChapterKeys = new Set();
  const PLAN_INTERVAL = 60 * 60 * 1000;

  while (true) {
    try {
      if (activeJobs.size >= AUTONOMOUS_JOB_CONCURRENCY) {
        await Promise.race(activeJobs.values());
        continue;
      }

      const now = Date.now();

      if (now - lastPlanTime > PLAN_INTERVAL) {
        const { gaps } = await analyzeCoverage();
        const plannedJobs = await planGeneration(gaps);
        preferredPlannedJobIds = (plannedJobs || []).map((plannedJob) => plannedJob.id).filter(Boolean);
        console.log('[worker] PLANNER_OUTPUT_CAPTURED:', (plannedJobs || []).map((plannedJob) => ({
          id: plannedJob.id,
          expected_subject: plannedJob.subject_id,
          expected_chapter: plannedJob.chapter,
          status: plannedJob.status,
          priority: plannedJob.priority,
        })));
        lastPlanTime = now;
      }

      console.log('[queue] WORKER_SELECT_REQUEST:', {
        preferred_planned_job_ids: preferredPlannedJobIds,
        fallback: preferredPlannedJobIds.length === 0 ? 'valid_queued_by_lowest_coverage' : 'planner_inserted_ids_first_coverage_ranked',
      });

      const coverage = await getCoverageSnapshot();
      await recoverStaleProcessingJobs();
      await skipInvalidQueuedJobs();
      let job = await selectFocusedQualityJob({ coverage });
      if (job) {
        console.log('[queue] FOCUSED_QUALITY_JOB_SELECTED');
      }
      if (!job) job = await selectCoverageFirstJob({
        preferredJobIds: preferredPlannedJobIds,
        coverage,
        excludeChapterKeys: activeChapterKeys,
        override: overrideConfig,
      });

      if (!job && preferredPlannedJobIds.length > 0) {
        console.warn('[queue] PREFERRED_PLANNED_JOBS_EMPTY_OR_ALREADY_CLAIMED: falling back to valid queued jobs by lowest coverage');
        preferredPlannedJobIds = [];
        job = await selectCoverageFirstJob({ coverage, excludeChapterKeys: activeChapterKeys, override: overrideConfig });
      }

      console.log('[queue] WORKER_SELECTED_JOB:', job ? {
        id: job.id,
        actual_subject: job.subject_id,
        actual_chapter: job.chapter,
        status: job.status,
        priority: job.priority,
        original_priority: job.original_priority,
        question_count: job.question_count,
        subject_question_count: job.subject_question_count,
        created_at: job.created_at,
        from_planner_capture: preferredPlannedJobIds.includes(job.id),
      } : null);
      console.log('[worker] picking job:', job ? {
        subject: job.subject_id,
        chapter: job.chapter,
        count: job.question_count,
        priority: job.priority,
      } : null);

      if (!job) {
        console.log('[worker] No valid jobs available');
        console.log('No queued jobs. Sleeping for 5 minutes...');
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
        lastPlanTime = 0;
        continue;
      }

      if (!isValidSyllabusPair(job.subject_id, job.chapter)) {
        console.warn('[worker] Skipping invalid syllabus job:', {
          subject: job.subject_id,
          chapter: job.chapter,
        });
        await markJobAsSkipped(job.id, `Invalid syllabus pair: ${job.subject_id}/${job.chapter}`);
        preferredPlannedJobIds = preferredPlannedJobIds.filter((id) => id !== job.id);
        continue;
      }
      const overrideDecision = isJobAllowedByOverride(job, overrideConfig);
      if (!overrideDecision.allowed) {
        console.log('[override] skipped_job', {
          job_id: job.id,
          subject: job.subject_id,
          chapter: job.chapter,
          reason: overrideDecision.reason,
        });
        runMetrics.override_skipped_jobs += 1;
        preferredPlannedJobIds = preferredPlannedJobIds.filter((id) => id !== job.id);
        continue;
      }

      console.log('[worker] coverage-based selection:', {
        subject: job.subject_id,
        chapter: job.chapter,
        count: job.question_count,
      });

      // ── Subject-loop guard ───────────────────────────────────────────────────
      // If the last SUBJECT_LOOP_MAX jobs all processed the same subject, try to
      // pick a job from a DIFFERENT subject to maintain variety.
      if (
        recentSubjects.length >= SUBJECT_LOOP_MAX &&
        recentSubjects.every((s) => s === job.subject_id) &&
        !preferredPlannedJobIds.includes(job.id)
      ) {
        const altJob = await selectCoverageFirstJob({
          coverage,
          excludeSubject: job.subject_id,
          minPriority: job.original_priority,
          excludeChapterKeys: activeChapterKeys,
          override: overrideConfig,
        });

        if (altJob) {
          console.warn(
            `[worker] SUBJECT_LOOP_GUARD: "${job.subject_id}" ran ${SUBJECT_LOOP_MAX} times in a row — ` +
            `switching to "${altJob.subject_id}" for variety.`
          );
          console.warn('[worker] SUBJECT_OVERRIDE_BY_LOOP_GUARD:', {
            original_job_id: job.id,
            original_subject: job.subject_id,
            original_chapter: job.chapter,
            override_job_id: altJob.id,
            override_subject: altJob.subject_id,
            override_chapter: altJob.chapter,
            override_question_count: altJob.question_count,
          });
          job = altJob;
          console.log('[worker] coverage-based selection:', {
            subject: job.subject_id,
            chapter: job.chapter,
            count: job.question_count,
          });
        } else {
          console.warn(
            `[worker] SUBJECT_LOOP_GUARD: "${job.subject_id}" ran ${SUBJECT_LOOP_MAX} times in a row — ` +
            'no alternate subject queued, proceeding anyway.'
          );
        }
      }

      // Record subject before processing so the next iteration can check it
      recentSubjects.push(job.subject_id);
      if (recentSubjects.length > SUBJECT_LOOP_MAX) recentSubjects.shift();

      await supabase
        .from('generation_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id);

      preferredPlannedJobIds = preferredPlannedJobIds.filter((id) => id !== job.id);

      const chapterKey = `${job.subject_id}::${job.chapter}`;
      activeChapterKeys.add(chapterKey);
      const jobPromise = processJob(job)
        .catch((error) => {
          console.error('[worker] async_job_failed', {
            job_id: job.id,
            subject: job.subject_id,
            chapter: job.chapter,
            error: error.message,
          });
          if (error.message?.includes('429') || error.message?.includes('quota')) throw error;
        })
        .finally(() => {
          activeJobs.delete(job.id);
          activeChapterKeys.delete(chapterKey);
        });
      activeJobs.set(job.id, jobPromise);
      console.log('[throughput]', {
        active_jobs: activeJobs.size,
        queued_jobs: null,
        generation_concurrency: GENERATION_CONCURRENCY,
        validation_concurrency: VALIDATION_CONCURRENCY,
        repair_concurrency: REPAIR_CONCURRENCY,
        jobs_completed_per_hour: runMetricsSnapshot().jobs_completed_per_hour,
        live_questions_per_hour: runMetricsSnapshot().live_questions_per_hour,
        generated_candidates_per_hour: runMetricsSnapshot().generated_candidates_per_hour,
      });

      if (activeJobs.size >= AUTONOMOUS_JOB_CONCURRENCY) {
        await Promise.race(activeJobs.values());
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('quota')) {
        console.warn('Rate limit hit. Sleeping for 30s...');
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        console.error('Worker loop error:', err.message);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }
}

async function processJob(job) {
  const jobStartedAt = Date.now();
  runMetrics.jobs_started += 1;
  console.log(`\n[JOB ${job.id.substring(0, 8)}] Starting: [${job.subject_id}] ${job.chapter}`);
  console.log('[worker] RECEIVED_JOB:', {
    job_id: job.id,
    expected_subject: job.subject_id,
    expected_chapter: job.chapter,
    raw_subject_id: job.subject_id,
    raw_chapter: job.chapter,
    status: job.status,
    priority: job.priority,
    created_at: job.created_at,
  });

  if (!isValidSyllabusPair(job.subject_id, job.chapter)) {
    console.warn('[worker] Skipping invalid syllabus job:', {
      subject: job.subject_id,
      chapter: job.chapter,
    });
    await markJobAsSkipped(job.id, `Invalid syllabus pair: ${job.subject_id}/${job.chapter}`);
    return;
  }

  const subject = CUET_SUPPORTED_SUBJECTS.find((entry) => entry.id === job.subject_id);
  console.log('[worker] SUBJECT_RESOLUTION:', {
    job_id: job.id,
    expected_subject: job.subject_id,
    resolved_subject_id: subject?.id || null,
    resolved_subject_name: subject?.name || null,
    chapter: job.chapter,
    subject_found: Boolean(subject),
  });
  const stats = {
    total: 0, accepted: 0, rejected: 0, duplicates: 0,
    preValidationFiltered: 0, retryCount: 0, apiCallsUsed: 0, scores: [],
    crossJobDuplicates: 0,
  };
  const retryFeedback = parseValidatorRetryFeedback(job.error_message);
  if (retryFeedback.reasons.length > 0) {
    stats.retryCount += retryFeedback.attempt;
    console.warn('[validator-feedback] retry_context_loaded', {
      job_id: job.id,
      attempt: retryFeedback.attempt + 1,
      max_attempts: MAX_RETRIES,
      reasons: retryFeedback.reasons,
    });
  }
  const dropReasons = {
    normalization_failed: 0,
    invalid_options_format: 0,
    missing_required_fields: 0,
    validation_failed: 0,
    low_score: 0,
    difficulty_mismatch: 0,
    cuet_alignment_failed: 0,
    chapter_mismatch: 0,
  };

  try {
    if (!subject) {
      throw new Error(`Subject ${job.subject_id} not found in system mapping`);
    }

    const canonicalUnit = getCanonicalUnitForChapter(job.subject_id, job.chapter);
    const canonicalChapters = getCanonicalChapters(job.subject_id);
    const generationSubject = {
      ...subject,
      chapters: canonicalChapters.length > 0 ? canonicalChapters : subject.chapters,
    };
    const englishMode = job.subject_id === 'english' ? getEnglishGenerationMode(job.chapter) : null;
    if (!canonicalUnit) {
      console.warn('[llm] chapter_mismatch_detected', {
        expected: generationSubject.chapters,
        received: job.chapter,
        subject: job.subject_id,
        source: 'generation_job',
      });
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: `Invalid chapter mapping: ${job.chapter}` })
        .eq('id', job.id);
      return;
    }

    // ── Pre-step: Fetch existing questions for cross-job dedup ───────────────
    const { data: existingQsData } = await supabase
      .from('questions')
      .select('body, correct_answer')
      .eq('subject', job.subject_id)
      .eq('chapter', job.chapter)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);
    const existingQuestions = existingQsData || [];
    if (existingQuestions.length > 0) {
      console.log(`[pipeline] cross_job_dedup_pool=${existingQuestions.length} existing questions loaded`);
    }

    // ── Step 1: Generate — API call 1 ────────────────────────────────────────
    stats.apiCallsUsed += 1;
    // Generate one large candidate pool; downstream filters choose what to validate.
    const costSaverMode = isCostSaverActive();
    const targetCount = Math.min(overrideConfig.target_count || job.target_count || PIPELINE_BATCH_SIZE, PIPELINE_BATCH_SIZE);
    let generateCount = getInitialGenerationCount(job.chapter);
    const adaptiveMax = getAdaptiveMaxPerConcept(generationSubject);
    const usedConceptSample = sampleArray([...getUsedConcepts(job.subject_id)], 20);
    let generationContext = {
      usedConcepts: usedConceptSample,
      saturatedSubtopics: getSaturatedSubtopics(job.subject_id, adaptiveMax),
      difficultyOverride,
      validationFeedback: collectUniqueFeedbackReasons([...retryFeedback.reasons, ...dynamicQualityFeedback]),
      previousAttempts: retryFeedback.previousAttempts,
      costSaver: costSaverMode,
      maxAttempts: 1,
      englishMode,
      subject_priority_tier: getSubjectPriority(job.subject_id).tier,
      recent_flash_yield_rate: Number(job.recent_flash_yield_rate ?? job.yield_rate ?? 1),
    };
    console.log('[generation] batch adjusted:', {
      chapter: job.chapter,
      generate_count: generateCount,
    });
    if (shouldUsePremiumFeedbackPrompt(generationContext.validationFeedback)) {
      console.warn('[premium_feedback_prompt] retry_guidance_enabled', {
        job_id: job.id,
        reasons: generationContext.validationFeedback,
      });
    }
    console.log('[worker] GENERATION_INPUT:', {
      job_id: job.id,
      expected_subject: job.subject_id,
      resolved_subject_id: subject.id,
      resolved_subject_name: subject.name,
      expected_chapter: job.chapter,
      canonical_unit: canonicalUnit.unit_name,
      generate_count: generateCount,
      difficulty_override: difficultyOverride,
      used_concepts_sampled: usedConceptSample.length,
      cost_saver_mode: costSaverMode,
      generation_mode: englishMode?.mode || null,
      quality_mode: QUALITY_MODE,
      requires_passage: englishMode?.requires_passage === true,
    });
    console.log(`[pipeline] Generating ${generateCount} candidates... chapter="${job.chapter}" unit="${canonicalUnit.unit_name}" usedConcepts=${generationContext.usedConcepts.length} saturated=${generationContext.saturatedSubtopics.length} (api_call=${stats.apiCallsUsed})`);
    let rawQuestions = await generateQuestions(generationSubject, job.chapter, generateCount, generationContext);
    let generationAttemptCount = 1;
    let bestRawQuestions = Array.isArray(rawQuestions) ? rawQuestions : [];

    let generationRetryCount = 0;
    while (isGenerationTimeout(rawQuestions) && generationRetryCount < MAX_GENERATION_TIMEOUT_RETRIES) {
      generationRetryCount += 1;
      stats.retryCount += 1;
      generateCount = Math.max(MIN_TIMEOUT_RETRY_COUNT, Math.floor(generateCount / 2));
      generationContext = { ...generationContext };
      console.warn('[generation] timeout_batch_reduction:', {
        chapter: job.chapter,
        retry_count: generationRetryCount,
        generate_count: generateCount,
      });
      console.log('[generation] batch adjusted:', {
        chapter: job.chapter,
        generate_count: generateCount,
      });
      stats.apiCallsUsed += 1;
      generationAttemptCount += 1;
      rawQuestions = await generateQuestions(generationSubject, job.chapter, generateCount, generationContext);
      if (Array.isArray(rawQuestions) && rawQuestions.length > bestRawQuestions.length) {
        bestRawQuestions = rawQuestions;
      }
    }

    if (isGenerationTimeout(rawQuestions) && generationRetryCount >= MAX_GENERATION_TIMEOUT_RETRIES) {
      console.warn('Skipping heavy chapter due to repeated timeouts', {
        job_id: job.id,
        subject: job.subject_id,
        chapter: job.chapter,
        retry_count: generationRetryCount,
      });
      await markJobAsSkipped(job.id, 'Skipped: repeated generation timeouts');
      return;
    }

    if (rawQuestions?.error) {
      if (rawQuestions.action === 'defer_job' || rawQuestions.error === 'generator_unavailable') {
        const reason = rawQuestions.reason || rawQuestions.error;
        console.warn('[generator_unavailable]', {
          job_id: job.id,
          subject: job.subject_id,
          chapter: job.chapter,
          reason,
          action: 'defer_job',
        });
        await supabase
          .from('generation_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: `deferred: ${reason}` })
          .eq('id', job.id);
        return;
      }
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: rawQuestions.error })
        .eq('id', job.id);
      return;
    }

    while (
      (!Array.isArray(rawQuestions) || rawQuestions.length === 0) &&
      generationAttemptCount < MAX_RETRIES
    ) {
      generationAttemptCount += 1;
      stats.retryCount += 1;
      stats.apiCallsUsed += 1;
      console.warn('[generation] retrying_empty_or_invalid_generation', {
        subject: job.subject_id,
        chapter: job.chapter,
        attempt_count: generationAttemptCount,
        max_retries: MAX_RETRIES,
      });
      logRejectedQuestion({
        subject: job.subject_id,
        chapter: job.chapter,
        reason: 'empty_or_invalid_generation_attempt',
        source: 'generation',
        rule: 'empty_or_invalid_generation_attempt',
        attemptCount: generationAttemptCount - 1,
      });
      rawQuestions = await generateQuestions(generationSubject, job.chapter, generateCount, generationContext);
      if (Array.isArray(rawQuestions) && rawQuestions.length > bestRawQuestions.length) {
        bestRawQuestions = rawQuestions;
      }
      if (rawQuestions?.error) break;
    }

    if ((!Array.isArray(rawQuestions) || rawQuestions.length === 0) && bestRawQuestions.length > 0) {
      console.warn('[generation] using_best_generation_attempt_after_retries', {
        subject: job.subject_id,
        chapter: job.chapter,
        attempt_count: generationAttemptCount,
        best_count: bestRawQuestions.length,
      });
      rawQuestions = bestRawQuestions;
    }

    if (rawQuestions?.error) {
      if (rawQuestions.action === 'defer_job' || rawQuestions.error === 'generator_unavailable') {
        const reason = rawQuestions.reason || rawQuestions.error;
        console.warn('[generator_unavailable]', {
          job_id: job.id,
          subject: job.subject_id,
          chapter: job.chapter,
          reason,
          action: 'defer_job',
        });
        await supabase
          .from('generation_jobs')
          .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: `deferred: ${reason}` })
          .eq('id', job.id);
        return;
      }
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: rawQuestions.error })
        .eq('id', job.id);
      return;
    }

    const generationDiagnostics = getLastGenerationDiagnostics();
    mergeDropReasons(dropReasons, generationDiagnostics.dropReasons);
    console.log('[pipeline] RAW_PARSED_COUNT', generationDiagnostics.rawParsedCount ?? rawQuestions.length ?? 0);

    if (!rawQuestions || rawQuestions.length === 0) {
      logDropSummary(job, dropReasons, generationDiagnostics);
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: 'Skipped: LLM returned 0 valid questions' })
        .eq('id', job.id);
      return;
    }

    rawQuestions = rawQuestions
      .map((question) => normalizeQuestion(question, job.subject_id, job.chapter))
      .filter(Boolean);
    console.log('[pipeline] NORMALIZED_COUNT', rawQuestions.length);

    stats.total = rawQuestions.length;
    console.log(`[pipeline] generated_count=${rawQuestions.length} | mix=${formatDifficultyCounts(rawQuestions)}`);

    // ── Step 2: Chapter filter — sync ─────────────────────────────────────────
    const chapterFiltered = [];
    for (const question of rawQuestions) {
      if (
        question.chapter !== job.chapter ||
        !getCanonicalUnitForChapter(question.subject, question.chapter) ||
        isClearlyOutsideChapter(question, job.chapter, job.subject_id)
      ) {
        dropReasons.chapter_mismatch += 1;
        stats.rejected += 1;
        console.warn('[llm] question_rejected_due_to_wrong_chapter', {
          expected: job.chapter,
          received: question.chapter || null,
          subject: job.subject_id,
          body: question.body?.slice(0, 100) || null,
        });
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: 'wrong_chapter',
          source: 'chapter_filter',
          rule: 'wrong_chapter',
          attemptCount: generationAttemptCount,
        });
        continue;
      }
      chapterFiltered.push(question);
    }

    // ── Step 3: Structural quality filter — sync ──────────────────────────────
    const { valid: structFiltered, removed: structRemoved, rejected: structRejected } = filterMalformedQuestions(chapterFiltered);
    console.log('[pipeline] STRUCTURAL_VALID_COUNT', structFiltered.length);
    stats.preValidationFiltered = structRemoved;
    dropReasons.missing_required_fields += structRemoved;
    if (structRemoved > 0) {
      console.warn(`[pipeline] pre_validation_filtered=${structRemoved} malformed questions removed (missing fields / bad options)`);
      for (const entry of structRejected) {
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: entry.reason,
          source: 'pre_validation_schema',
          rule: entry.reason,
          details: {
            body: entry.question?.body?.slice?.(0, 100) || null,
          },
          attemptCount: generationAttemptCount,
        });
      }
    }

    // ── Step 4: Pre-validation deduplication (within-batch + cross-job) ───────
    // First dedup within the batch itself, then against the existing DB pool.
    const { valid: internallyFiltered, rejected: internalRejected } = filterInternalQualityQuestions(
      structFiltered,
      job.subject_id,
      job.chapter,
    );
    if (internalRejected.length > 0) {
      stats.rejected += internalRejected.length;
      dropReasons.validation_failed += internalRejected.length;
      stats.preValidationFiltered += internalRejected.length;
      console.warn('[pipeline] INTERNAL_REJECTION', internalRejected.map((entry) => ({
        reason: entry.reason,
        body: entry.question?.body?.slice(0, 100) || null,
      })));
      for (const entry of internalRejected) {
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: entry.reason,
          source: 'pre_validation_internal_quality',
          rule: entry.reason,
          attemptCount: generationAttemptCount,
        });
      }
    }

    const { unique: batchUnique, removed: batchDupCount } = deduplicateBatch(internallyFiltered);
    const { unique: dedupedQuestions, removed: crossJobDupCount } = deduplicateAgainst(batchUnique, existingQuestions);
    const {
      valid: similarityFilteredQuestions,
      rejected: similarityRejected,
    } = filterSimilarQuestions(dedupedQuestions, existingQuestions);
    if (similarityRejected.length > 0) {
      stats.rejected += similarityRejected.length;
      stats.preValidationFiltered += similarityRejected.length;
      dropReasons.validation_failed += similarityRejected.length;
      console.warn('[pipeline] SIMILARITY_REJECTION', similarityRejected.map((entry) => ({
        reason: entry.reason,
        body: entry.question?.body?.slice(0, 100) || null,
      })));
      for (const entry of similarityRejected) {
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: entry.reason,
          source: 'pre_validation_similarity',
          rule: entry.reason,
          attemptCount: generationAttemptCount,
        });
      }
    }
    const dupCount = batchDupCount + crossJobDupCount;
    stats.duplicates = batchDupCount;
    stats.crossJobDuplicates = crossJobDupCount;
    const dupRate = internallyFiltered.length > 0 ? dupCount / internallyFiltered.length : 0;

    const validationPool = similarityFilteredQuestions
      .map((question) => attachAnchorMetadata(question, job.subject_id, job.chapter));
    const stemShapeCounts = new Map();
    for (const question of validationPool) {
      const shape = getStemShape(question.body);
      stemShapeCounts.set(shape, (stemShapeCounts.get(shape) || 0) + 1);
    }

    const selfCheckEntries = validationPool.map((question) => ({
      question,
      result: runSelfCheck(question, {
        subject: job.subject_id,
        chapter: job.chapter,
        stemShapeCounts,
        batchSize: validationPool.length,
      }),
    }));
    const selfCheckSummary = summarizeSelfCheckResults(selfCheckEntries.map((entry) => entry.result));
    const selfCheckPassedEntries = selfCheckEntries.filter((entry) => entry.result.pass);
    const selfCheckRejectedEntries = selfCheckEntries.filter((entry) => !entry.result.pass);
    stats.preValidationFiltered += selfCheckRejectedEntries.length;
    stats.rejected += selfCheckRejectedEntries.length;
    dropReasons.validation_failed += selfCheckRejectedEntries.length;

    console.log('[selfCheck] total', selfCheckEntries.length);
    console.log('[selfCheck] passed', selfCheckPassedEntries.length);
    console.log('[selfCheck] rejected_count', selfCheckRejectedEntries.length);
    console.log('[selfCheck] reasons', selfCheckSummary.reasons);
    const selfCheckRejectionRate = selfCheckEntries.length > 0
      ? selfCheckRejectedEntries.length / selfCheckEntries.length
      : 0;
    console.log('[selfcheck_thresholds]', {
      subject: job.subject_id,
      chapter: job.chapter,
      rejection_rate: Number(selfCheckRejectionRate.toFixed(3)),
      retry_triggered: selfCheckRejectionRate > 0.70 && ['S', 'A'].includes(getSubjectPriority(job.subject_id).tier),
      top_reasons: Object.entries(selfCheckSummary.reasons || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
    });

    const candidatePool = selfCheckPassedEntries.map(({ question, result }) => ({
      ...question,
      selfcheck_passed: true,
      selfcheck_reasons: result.reasons,
      selfcheck_distractor_quality: result.distractor_quality,
      selfcheck_trap_quality: result.trap_quality,
      selfcheck_obviousness_risk: result.obviousness_risk,
      selfcheck_cuet_pattern: result.cuet_pattern,
    }));
    let balancedQuestions = balanceCorrectAnswerDistribution(candidatePool).slice(0, targetCount);
    const rankedForValidation = rankValidationCandidates(balancedQuestions, VALIDATION_CANDIDATE_LIMIT);
    const validationLimit = Math.min(targetCount, VALIDATION_CANDIDATE_LIMIT, rankedForValidation.length);
    let selectedForValidation = rankedForValidation
      .slice(0, validationLimit > 0 ? validationLimit : rankedForValidation.length)
      .map((question, index) => assignCandidateIdentity(question, job.id, index));

    const validatorLoadReduction = rawQuestions.length > 0
      ? 1 - (selectedForValidation.length / rawQuestions.length)
      : 0;
    console.log(`[pipeline] after_chapter_filter=${chapterFiltered.length} | pre_validation_filtered=${structRemoved + internalRejected.length + selfCheckRejectedEntries.length} | batch_duplicates=${batchDupCount} | cross_job_duplicates=${crossJobDupCount} | candidate_pool=${candidatePool.length} | sent_to_validator=${selectedForValidation.length} | sent_for_strict_validation=deferred | validator_load_reduction=${(validatorLoadReduction * 100).toFixed(1)}%`);
    console.log('[pipeline] debug_quality_gate', {
      pyq_anchor_used: selectedForValidation.map((question) => question.pyq_anchor_id),
      anchor_source_quality: selectedForValidation.map((question) => getAnchorSourceQuality(question)),
      anchor_tier: selectedForValidation.map((question) => question.anchor_tier),
      anchor_match_level: selectedForValidation.map((question) => question.anchor_match_level),
      anchor_confidence: selectedForValidation.map((question) => question.anchor_confidence),
      concept_mismatch_risk: selectedForValidation.map((question) => question.concept_mismatch_risk),
      fallback_used: false,
      selfcheck_passed: candidatePool.length,
      sent_to_validator: selectedForValidation.length,
      skipped_for_anchor_quality: 0,
    });

    if (dupRate > 0.30) {
      console.warn(`[pipeline] HIGH_DUPLICATE_RATE=${(dupRate * 100).toFixed(1)}% (threshold=30%)`);
    }

    if (balancedQuestions.length === 0 || selectedForValidation.length === 0) {
      const feedbackReasons = collectUniqueFeedbackReasons([
        ...similarityRejected.map((entry) => entry.reason),
        ...Object.keys(selfCheckSummary.reasons || {}),
      ]);
      if (retryFeedback.attempt < MAX_RETRIES - 1 && feedbackReasons.length > 0) {
        await requeueJobWithValidatorFeedback(
          job.id,
          retryFeedback.attempt + 1,
          feedbackReasons,
          [
            ...retryFeedback.previousAttempts,
            ...buildPreviousAttemptsFromRejected(similarityRejected),
            ...buildPreviousAttemptsFromRejected(selfCheckRejectedEntries.map((entry) => ({
              question: entry.question,
              reasons: entry.result.reasons,
            }))),
          ],
        );
        return;
      }
      let draftCount = 0;
      for (const entry of selfCheckRejectedEntries.slice(0, 5)) {
        if (!isSchemaValid(entry.question)) continue;
        const draftRes = await saveDraftQuestion(
          entry.question,
          `draft_only:selfcheck_rejected:${entry.result.reasons.join(';') || 'no selfcheck pass'}`,
          { expectedChapter: job.chapter },
        );
        if (draftRes.success) draftCount += 1;
      }
      logDropSummary(job, dropReasons, {
        rawParsedCount: generationDiagnostics.rawParsedCount,
        normalizedCount: rawQuestions.length,
        sampleFailedRawQuestion: generationDiagnostics.sampleFailedRawQuestion || rawQuestions[0] || null,
        sampleFailedNormalizedAttempt: generationDiagnostics.sampleFailedNormalizedAttempt || rawQuestions[0] || null,
      });
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: 'draft_only: 0 selfcheck-passed questions' })
        .eq('id', job.id);
      console.log('[pipeline] draft_gate', {
        draft_only_flag: true,
        draft_saved: draftCount,
        draft_candidates: selfCheckRejectedEntries.length,
        publish_count: 0,
        reason: 'selfcheck_rejected_all',
      });
      return;
    }

    // Step 5: Two-layer validation. Mini validator runs for every selfCheck survivor.
    let miniResults = [];
    let validatedQuestions = [];
    const validatorFeedbackReasons = [];
    const rejectedValidationAttempts = [];
    stats.apiCallsUsed += 1;
    if (stats.apiCallsUsed > MAX_API_CALLS_PER_JOB) {
      throw new Error(`api_call_limit_exceeded before mini validation (${stats.apiCallsUsed} calls)`);
    }

    console.log(`[pipeline] Starting mini validation for ${selectedForValidation.length} selfCheck-passed questions... (api_call=${stats.apiCallsUsed})`);

    try {
      miniResults = await validateMiniBatch(selectedForValidation, subject);
    } catch (validationErr) {
      console.error(`[pipeline] Mini validation failed: ${validationErr.message}. Saving candidates as draft only; no live publish.`);
      let draftCount = 0;
      for (const question of selectedForValidation.filter(isSchemaValid).slice(0, 5)) {
        const draftRes = await saveDraftQuestion(question, `validator_unavailable:${validationErr.message}`, { expectedChapter: job.chapter });
        if (draftRes.success) draftCount += 1;
      }
      await supabase
        .from('generation_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          error_message: `draft_only: validator_unavailable:${validationErr.message}`,
        })
        .eq('id', job.id);
      console.log('[pipeline] draft_gate', {
        draft_only_flag: true,
        draft_saved: draftCount,
        draft_candidates: selectedForValidation.length,
        publish_count: 0,
        reason: 'validator_unavailable',
      });
      return;
    }

    const miniCounts = countLayerVerdicts(miniResults);
    console.log('[validation_mini] sent_count', selectedForValidation.length);
    console.log('[validation_mini] accepted', miniCounts.accepted);
    console.log('[validation_mini] borderline', miniCounts.borderline);
    console.log('[validation_mini] rejected', miniCounts.rejected);

    const preValidationCostSnapshot = getCostTracker();
    const shouldLimitStrictForCost =
      preValidationCostSnapshot.acceptedCount >= 5 &&
      preValidationCostSnapshot.costPer1000 >= COST_VALIDATION_PAUSE_THRESHOLD &&
      !isFocusedQualityJob(job);
    const strictMaxForBatch = shouldLimitStrictForCost
      ? Math.min(1, STRICT_VALIDATION_MAX_PER_BATCH)
      : STRICT_VALIDATION_MAX_PER_BATCH;
    const shouldSkipStrictForCost = strictMaxForBatch <= 0;
    const escalationEntries = selectStrictEscalationCandidates(
      selectedForValidation,
      miniResults,
      strictMaxForBatch,
    );
    if (shouldLimitStrictForCost) {
      console.warn('[validation_strict] limited_due_to_cost_pressure', {
        max_for_batch: strictMaxForBatch,
        cost_per_1000: Number(preValidationCostSnapshot.costPer1000.toFixed(2)),
      });
    }
    const strictByQuestionIndex = new Map();
    let strictFailureReason = '';

    if (escalationEntries.length > 0 && shouldSkipStrictForCost) {
      console.warn('[validation_strict] skipped_due_to_cost_limit', {
        escalated_count: escalationEntries.length,
        cost_per_1000: Number(preValidationCostSnapshot.costPer1000.toFixed(2)),
      });
    } else if (escalationEntries.length > 0) {
      stats.apiCallsUsed += 1;
      if (stats.apiCallsUsed > MAX_API_CALLS_PER_JOB) {
        throw new Error(`api_call_limit_exceeded before strict validation (${stats.apiCallsUsed} calls)`);
      }
      try {
        const strictResults = await validateStrictBatch(escalationEntries.map((entry) => entry.question), subject);
        escalationEntries.forEach((entry, strictIndex) => {
          strictByQuestionIndex.set(entry.index, strictResults[strictIndex]);
        });
        const strictCounts = countLayerVerdicts(strictResults);
        console.log('[validation_strict] escalated_count', escalationEntries.length);
        console.log('[validation_strict] accepted', strictCounts.accepted);
        console.log('[validation_strict] rejected', strictCounts.rejected + strictCounts.borderline);
        console.log('[validation_strict] skipped_due_to_cost_limit', 0);
      } catch (strictErr) {
        strictFailureReason = strictErr.message || 'strict validator unavailable';
        console.warn('[validation_strict] failed_draft_only_for_escalated', {
          escalated_count: escalationEntries.length,
          reason: strictFailureReason,
        });
      }
    } else {
      console.log('[validation_strict] escalated_count', 0);
      console.log('[validation_strict] accepted', 0);
      console.log('[validation_strict] rejected', 0);
      console.log('[validation_strict] skipped_due_to_cost_limit', 0);
    }

    const escalationIndexSet = new Set(escalationEntries.map((entry) => entry.index));
    for (let i = 0; i < selectedForValidation.length; i += 1) {
      const question = selectedForValidation[i];
      const miniValidation = miniResults[i];
      const strictValidation = strictByQuestionIndex.get(i);
      const wasEscalated = escalationIndexSet.has(i);
      const finalValidation = strictValidation || miniValidation;
      const finalLayer = strictValidation ? 'strict' : 'mini';

      if (!miniValidation) {
        const reasons = ['missing mini validation result'];
        validatorFeedbackReasons.push(...reasons);
        rejectedValidationAttempts.push({ question, reasons });
        stats.rejected += 1;
        dropReasons.validation_failed += 1;
        continue;
      }

      if (wasEscalated && !strictValidation) {
        const reasons = [
          shouldSkipStrictForCost ? 'strict validation skipped due to cost limit' : `strict validation unavailable:${strictFailureReason || 'no result'}`,
        ];
        validatorFeedbackReasons.push(...reasons);
        rejectedValidationAttempts.push({ question, reasons });
        stats.rejected += 1;
        dropReasons.validation_failed += 1;
        console.log('[pipeline] validator_rejected', {
          layer: 'strict',
          reason: reasons[0],
          pyq_anchor_used: question.pyq_anchor_id,
          anchor_confidence: question.anchor_confidence,
        });
        continue;
      }

      const publishDecision = isPublishAllowedByQuality(finalValidation, question, QUALITY_MODE, finalLayer);
      const passageChildDecision = (question.is_passage_linked === true || question.passage_id || question.temporary_group_key)
        ? evaluatePassageChildAcceptance(question, finalValidation, QUALITY_MODE)
        : null;
      const acceptedByPassagePolicy = passageChildDecision?.accepted === true;
      const qualityBand = publishDecision.band;
      runMetrics.quality_bands[qualityBand] = (runMetrics.quality_bands[qualityBand] || 0) + 1;
      runMetrics.validator_score_sum += toTenPointScore(finalValidation?.score);
      runMetrics.exam_quality_sum += toTenPointScore(finalValidation?.exam_quality);
      runMetrics.distractor_quality_sum += toTenPointScore(finalValidation?.distractor_quality);
      runMetrics.validator_score_count += 1;
      console.log('[validator_quality_band]', {
        candidate_id: question.candidate_id,
        band: qualityBand,
        mode: QUALITY_MODE,
        publish_allowed: publishDecision.allowed,
      });
      if (QUALITY_MODE === 'premium') {
        console.log('[premium_audit]', {
          candidate_id: question.candidate_id,
          score: toTenPointScore(finalValidation?.score),
          answer_confidence: normalizeUnitScore(finalValidation?.answer_confidence ?? 0),
          publish_allowed: publishDecision.allowed,
          reasons: publishDecision.reasons,
        });
      }
      if (passageChildDecision) {
        console.log('[passage_child_validation]', {
          candidate_id: question.candidate_id,
          child_score: passageChildDecision.child_score,
          passage_dependency: passageChildDecision.passage_dependency,
          answer_supported_by_passage: passageChildDecision.answer_supported_by_passage,
          answerable_without_passage: passageChildDecision.answerable_without_passage,
          accepted_as_passage_child: acceptedByPassagePolicy,
          reason: passageChildDecision.reason,
        });
      }

      if (publishDecision.allowed || acceptedByPassagePolicy) {
        const acceptedQuestion = {
          ...buildValidatedQuestion(question, finalValidation, finalLayer),
          passage_child_policy_accepted: acceptedByPassagePolicy,
          passage_child_policy_reason: passageChildDecision?.reason || null,
          validation_decision: acceptedByPassagePolicy && !publishDecision.allowed ? 'accept_passage_child' : 'accept',
        };
        validatedQuestions.push(acceptedQuestion);
        stats.scores.push(acceptedQuestion.validation_score);
        console.log('[pipeline] validator_accepted', {
          layer: finalLayer,
          score: acceptedQuestion.validation_score,
          exam_quality: acceptedQuestion.validation_exam_quality,
          distractor_quality: acceptedQuestion.validation_distractor_quality,
          conceptual_depth: acceptedQuestion.validation_conceptual_depth,
          trap_quality: acceptedQuestion.validation_trap_quality,
          pyq_anchor_used: question.pyq_anchor_id,
          anchor_source_quality: getAnchorSourceQuality(question),
          anchor_confidence: question.anchor_confidence,
        });
        continue;
      }

      const validationReasons = collectUniqueFeedbackReasons([
        ...collectLayerValidationReasons(finalValidation),
        ...publishDecision.reasons,
      ]);
      validatorFeedbackReasons.push(...validationReasons);
      rejectedValidationAttempts.push({ question, reasons: validationReasons });
      stats.rejected += 1;
      dropReasons.validation_failed += 1;
      if (normalizeUnitScore(finalValidation?.score) < 0.72) dropReasons.low_score += 1;
      if (finalValidation?.cuet_alignment === false) dropReasons.cuet_alignment_failed += 1;
      console.log('[pipeline] validator_rejected', {
        layer: finalLayer,
        score: toTenPointScore(finalValidation?.score),
        exam_quality: toTenPointScore(finalValidation?.exam_quality),
        distractor_quality: toTenPointScore(finalValidation?.distractor_quality),
        conceptual_depth: toTenPointScore(finalValidation?.conceptual_depth),
        trap_quality: normalizeTrapQuality(finalValidation?.trap_quality),
        reasons: validationReasons,
      });
      logRejectedQuestion({
        subject: job.subject_id,
        chapter: job.chapter,
        reason: validationReasons.join('; ') || 'validation_failed',
        source: `${finalLayer}_validator`,
        rule: validationReasons[0] || 'validation_failed',
        details: {
          score: toTenPointScore(finalValidation?.score),
          verdict: finalValidation?.verdict,
          cuet_alignment: finalValidation?.cuet_alignment,
          anchor_confidence: question.anchor_confidence,
        },
        attemptCount: generationAttemptCount,
      });
    }

    if (false) {
    // Legacy strict-only validation path disabled; two-layer validation runs above.
    let validationResults;
    stats.apiCallsUsed += 1;
    if (stats.apiCallsUsed > MAX_API_CALLS_PER_JOB) {
      throw new Error(`api_call_limit_exceeded before validation (${stats.apiCallsUsed} calls)`);
    }

    console.log(`[pipeline] Starting batch validation for ${selectedForValidation.length} ranked questions... (api_call=${stats.apiCallsUsed})`);

    try {
      validationResults = await validateAndAlignBatch(selectedForValidation, subject);
    } catch (validationErr) {
      console.error(`[pipeline] Batch validation failed without retry: ${validationErr.message}. Saving candidates as draft only; no live publish.`);
      let draftCount = 0;
      for (const question of selectedForValidation.filter(isSchemaValid).slice(0, 5)) {
        const draftRes = await saveDraftQuestion(question, `validator_unavailable:${validationErr.message}`, { expectedChapter: job.chapter });
        if (draftRes.success) draftCount += 1;
      }
      await supabase
        .from('generation_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          error_message: `draft_only: validator_unavailable:${validationErr.message}`,
        })
        .eq('id', job.id);
      console.log('[pipeline] draft_gate', {
        draft_only_flag: true,
        draft_saved: draftCount,
        draft_candidates: selectedForValidation.length,
        publish_count: 0,
        reason: 'validator_unavailable',
      });
      console.log(
        `[pipeline] SUMMARY | subject=${job.subject_id} | chapter=${job.chapter} | target=${targetCount}` +
        ` | generated_count=${stats.total} | batch_duplicates=${stats.duplicates} | cross_job_duplicates=${stats.crossJobDuplicates}` +
        ` | pre_validation_filtered=${stats.preValidationFiltered} | strict_validation_count=${selectedForValidation.length} | validated_count=0` +
        ` | accepted_count=0 | draft_count=${draftCount} | draft_only_flag=true | shortfall=${targetCount}` +
        ` | yield_rate=0.0%` +
        ` | retry_count=${stats.retryCount} | api_calls_used=${stats.apiCallsUsed}`,
      );
      return;
    }

    // ── Step 6: Three-way validation scoring (accept/recover/reject) ─────────
    let validatedQuestions = [];
    const recoveryCandidates = [];
    const recoveryValidations = [];
    const validatorFeedbackReasons = [];
    const rejectedValidationAttempts = [];
    const allScoredCandidates = [];
    const validationByQuestion = new Map(
      selectedForValidation.map((question, index) => [question, validationResults[index]])
    );

    for (let i = 0; i < balancedQuestions.length; i += 1) {
      const question = balancedQuestions[i];
      const validation = validationByQuestion.get(question);
      if (!validation) {
        dropReasons.validation_failed += 1;
        stats.rejected += 1;
        validatorFeedbackReasons.push('missing strict validation result');
        rejectedValidationAttempts.push({ question, reasons: ['missing strict validation result'] });
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: 'missing_strict_validation_result',
          source: 'validator_batch',
          rule: 'missing_strict_validation_result',
          attemptCount: generationAttemptCount,
        });
        continue;
      }
      const scoreThreshold = getDifficultyThreshold(question.difficulty);
      const improvedQuestion = applyValidationImprovement(question, validation?.improved_question, job.chapter);
      const hasValidatorImprovement = improvedQuestion !== question;
      const acceptanceDecision = getValidationAcceptanceDecision(validation, scoreThreshold);

      allScoredCandidates.push({
        question: improvedQuestion,
        validation,
        compositeScore: validation.compositeScore || 0,
      });

      if (acceptanceDecision.accept) {
        if (acceptanceDecision.accept && acceptanceDecision.signalMismatches.length > 0) {
          console.warn('[pipeline] validation_signal_mismatch_accepted', {
            source: acceptanceDecision.source,
            mismatches: acceptanceDecision.signalMismatches,
            compositeScore: validation.compositeScore,
          });
        }
        if (hasValidatorImprovement) {
          console.log(`[pipeline] Applied validator improvement | index=${i} | issues=${(validation.issues || []).join('; ')}`);
        }
        console.log('[pipeline] validator_accepted', {
          score: validation.score,
          exam_quality: validation.exam_quality,
          distractor_quality: validation.distractor_quality,
          conceptual_depth: validation.conceptual_depth,
          trap_quality: validation.trap_quality,
          pyq_anchor_used: question.pyq_anchor_id,
          anchor_source_quality: getAnchorSourceQuality(question),
        });
        validatedQuestions.push({
          ...improvedQuestion,
          validation_score: validation.score,
          validation_decision: validation.decision,
          validation_verdict: validation.verdict,
          validation_cuet_alignment: validation.cuet_alignment === true,
          validation_exam_quality: Number(validation.exam_quality || 0),
          validation_distractor_quality: Number(validation.distractor_quality || 0),
          validation_conceptual_depth: Number(validation.conceptual_depth || 0),
          validation_trap_quality: validation.trap_quality || 'LOW',
          compositeScore: validation.compositeScore,
          validator_recommended_difficulty: normalizeOptionalDifficulty(validation.recommended_difficulty),
          validation_sampled: true,
          strict_cuet_validated: true,
          anchor_source_quality: getAnchorSourceQuality(improvedQuestion),
        });
        stats.scores.push(validation.score);
        continue;
      }

      if (acceptanceDecision.recover) {
        console.log(`[pipeline] Recovery candidate | compositeScore=${validation.compositeScore} | reasons=${acceptanceDecision.reasons.join('; ')}`);
        recoveryCandidates.push(improvedQuestion);
        recoveryValidations.push(validation);
        continue;
      }

      dropReasons.validation_failed += 1;
      if (validation.score < scoreThreshold) dropReasons.low_score += 1;
      if (validation.difficulty_correct === false) dropReasons.difficulty_mismatch += 1;
      if (validation.cuet_alignment === false) dropReasons.cuet_alignment_failed += 1;
      const validationReasons = acceptanceDecision.reasons;
      validatorFeedbackReasons.push(...validationReasons);
      rejectedValidationAttempts.push({ question, reasons: validationReasons });
      console.warn(
        `[pipeline] Rejected | compositeScore=${validation.compositeScore} | source=${acceptanceDecision.source} | rule=${acceptanceDecision.rule} | reasons=${validationReasons.join('; ')}`,
      );
      console.log('[pipeline] validator_rejected', {
        score: validation.score,
        exam_quality: validation.exam_quality,
        distractor_quality: validation.distractor_quality,
        conceptual_depth: validation.conceptual_depth,
        trap_quality: validation.trap_quality,
        rule: acceptanceDecision.rule,
      });
      logRejectedQuestion({
        subject: job.subject_id,
        chapter: job.chapter,
        reason: validationReasons.join('; ') || validation.decision || 'validation_failed',
        source: acceptanceDecision.source,
        rule: acceptanceDecision.rule,
        details: {
          compositeScore: validation.compositeScore,
          verdict: validation.verdict,
          syllabus_alignment: validation.syllabus_alignment,
          concept_match: validation.concept_match,
          option_quality: validation.option_quality,
        },
        attemptCount: generationAttemptCount,
      });
      stats.rejected += 1;
    }

    // ── Step 6b: Recovery Layer — fix questions scoring 50–65 ─────────────────
    if (false && recoveryCandidates.length > 0) {
      console.log(`[recovery] sending ${recoveryCandidates.length} candidates to recovery layer`);
      stats.apiCallsUsed += 1;
      const recoveredQuestions = await recoverQuestions(recoveryCandidates, recoveryValidations, subject);
      let recoveredAcceptedCount = 0;
      for (const rq of recoveredQuestions) {
        const recoveryRejectReason = isValidQuestion(rq) && isSchemaValid(rq)
          ? getInternalRejectionReason(rq, job.subject_id, job.chapter)
          : 'invalid_recovered_question';
        if (!recoveryRejectReason) {
          validatedQuestions.push({
            ...rq,
            validation_score: 7,
            compositeScore: 70,
            validator_recommended_difficulty: rq.difficulty,
            validation_sampled: true,
            strict_cuet_validated: true,
          });
          stats.scores.push(7);
          recoveredAcceptedCount += 1;
          console.log(`[recovery] accepted recovered question | concept_pattern=${rq.concept_pattern}`);
        } else {
          console.warn(`[recovery] rejected recovered question | reason=${recoveryRejectReason}`);
        }
      }
      console.log(`[recovery] recovered ${recoveredQuestions.length} candidates | accepted=${recoveredAcceptedCount}`);
    }

    }

    // ── Step 6c: Strict zero-acceptance handling ────────────────────────────
    let draftOnlyFlag = false;
    let draftOnlyReason = '';
    let draftCandidates = [];

    if (validatedQuestions.length === 0) {
      const feedbackReasons = collectUniqueFeedbackReasons(validatorFeedbackReasons);
      if (retryFeedback.attempt < MAX_RETRIES - 1 && feedbackReasons.length > 0) {
        await requeueJobWithValidatorFeedback(
          job.id,
          retryFeedback.attempt + 1,
          feedbackReasons,
          [...retryFeedback.previousAttempts, ...buildPreviousAttemptsFromRejected(rejectedValidationAttempts)],
        );
        return;
      }
      draftOnlyFlag = true;
      draftOnlyReason = `validator_rejected_all:${feedbackReasons.join(';') || 'no accepted validator decisions'}`;
      draftCandidates = balancedQuestions.slice(0, Math.min(5, balancedQuestions.length));
      console.warn('[pipeline] strict_mode_no_validated_questions_draft_only', {
        job_id: job.id,
        attempts: retryFeedback.attempt + 1,
        max_attempts: MAX_RETRIES,
        reasons: feedbackReasons,
        draft_only_flag: true,
      });
    }

    const modelDifficultyCounts = countDifficultyMix(validatedQuestions);
    validatedQuestions = validatedQuestions.map((question) => ({
      ...question,
      difficulty: classifyDifficulty(question),
    })).map((question) => ({
      ...question,
      difficulty_weight: getDifficultyWeight(question.difficulty),
    }));
    const systemDifficultyCounts = countDifficultyMix(validatedQuestions);
    console.log('[difficulty distribution]', {
      model: modelDifficultyCounts,
      system: systemDifficultyCounts,
    });

    if (difficultyOverride) {
      const originalValidatedQuestions = validatedQuestions;
      const difficultyMatchedQuestions = originalValidatedQuestions.filter((question) => question.difficulty === difficultyOverride);
      const minDifficultyMatches = Math.ceil(targetCount * 0.30);

      console.log(`[difficulty] matched_override=${difficultyMatchedQuestions.length} | override=${difficultyOverride} | validated_before_filter=${originalValidatedQuestions.length} | min_required=${minDifficultyMatches}`);

      if (difficultyOverride === 'hard') {
        const highScoreMedium = originalValidatedQuestions.filter((question) =>
          question.difficulty === 'medium' && Number(question.validation_score || 0) >= 8.5
        );
        validatedQuestions = [...difficultyMatchedQuestions, ...highScoreMedium];
        console.warn(`[difficulty] hard_override_strict_selection=true | hard=${difficultyMatchedQuestions.length} | high_score_medium=${highScoreMedium.length} | easy_included=0 | accepted=${validatedQuestions.length}`);
      } else if (difficultyMatchedQuestions.length >= minDifficultyMatches) {
        validatedQuestions = difficultyMatchedQuestions;
      } else {
        const fallbackOrder = getDifficultyFallbackOrder(difficultyOverride);
        const bestOthers = fallbackOrder.flatMap((difficulty) =>
          originalValidatedQuestions.filter((question) => question.difficulty === difficulty)
        );
        validatedQuestions = [...difficultyMatchedQuestions, ...bestOthers];
        if (validatedQuestions.length === 0) validatedQuestions = originalValidatedQuestions;
        console.warn(`[difficulty] fallback_to_best_others=true | matched=${difficultyMatchedQuestions.length} | fill_order=${fallbackOrder.join(',')} | min_required=${minDifficultyMatches} | accepted=${validatedQuestions.length}`);
      }
    }
    console.log('[difficulty] override:', difficultyOverride);
    console.log('[difficulty] accepted_count:', validatedQuestions.length);

    const acceptanceRate = balancedQuestions.length > 0 ? validatedQuestions.length / balancedQuestions.length : 0;
    if (false && acceptanceRate < 0.40) {
      console.error(`[pipeline] LOW QUALITY — COST RISK | acceptance_rate=${(acceptanceRate * 100).toFixed(1)}% | threshold=40%`);
      await supabase
        .from('generation_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: `LOW QUALITY — COST RISK: acceptance_rate=${(acceptanceRate * 100).toFixed(1)}%`,
        })
        .eq('id', job.id);
      process.exitCode = 1;
      return;
    }
    if (acceptanceRate < 0.40) {
      console.warn(`[pipeline] LOW QUALITY - COST RISK log_only | acceptance_rate=${(acceptanceRate * 100).toFixed(1)}% | threshold=40% | fallback_or_partial_output_allowed=true`);
    }
    console.log(`[pipeline] validated_count=${validatedQuestions.length} | acceptance_rate=${(acceptanceRate * 100).toFixed(1)}%`);

    const selectedQuestions = selectBalancedQuestions(validatedQuestions);

    // ── Step 7: Final sanity dedup — catches any edge-case survivors ──────────
    const { unique: sanityUnique, removed: sanityDupes } = deduplicateBatch(selectedQuestions);
    if (sanityDupes > 0) {
      console.warn(`[pipeline] FINAL_SANITY_DEDUP removed ${sanityDupes} late-stage duplicates`);
      stats.duplicates += sanityDupes;
    }

    // ── Step 8: Schema guard — last line of defence before DB write ───────────
    const publishReady = [];
    const passageGroupMap = new Map();
    const passagePublishGroups = [];
    const draftReady = [];
    const schemaRejectedEntries = [];
    for (const question of sanityUnique) {
      const schemaReason = !isSchemaValid(question)
        ? 'invalid_schema'
        : question.subject !== job.subject_id || question.chapter !== job.chapter
          ? 'subject_or_chapter_mismatch'
          : !isValidSyllabusPair(question.subject, question.chapter)
            ? 'invalid_syllabus_pair'
            : !validateTraceability(question, job.subject_id, job.chapter).valid
              ? validateTraceability(question, job.subject_id, job.chapter).reason
              : null;
      if (schemaReason) {
        schemaRejectedEntries.push({ question, reason: schemaReason });
      } else {
        if (question.is_passage_linked === true || question.passage_group_id || question.temporary_group_key) {
          const passageGateReason = getPublishGateRejectReason({
            ...question,
            passage_group_publish_allowed: true,
          });
          if (passageGateReason) {
            draftReady.push({ question, reason: passageGateReason });
          } else {
            const groupKey = question.passage_group_id || question.group_id || question.temporary_group_key || question.passage_id || 'passage_group_1';
            if (!passageGroupMap.has(groupKey)) passageGroupMap.set(groupKey, []);
            passageGroupMap.get(groupKey).push(question);
          }
          continue;
        }
        const publishGateReason = getPublishGateRejectReason(question);
        if (publishGateReason) {
          draftReady.push({ question, reason: publishGateReason });
        } else {
          publishReady.push(question);
        }
      }
    }
    for (const [groupKey, groupQuestions] of passageGroupMap.entries()) {
      const validLinkedQuestions = groupQuestions
        .filter((question) => question.passage_text && question.passage_id)
        .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
      const group = {
        id: groupKey,
        subject: job.subject_id,
        chapter: job.chapter,
        passage_id: validLinkedQuestions[0]?.passage_id || groupQuestions[0]?.passage_id || null,
        title: validLinkedQuestions[0]?.passage_title || groupQuestions[0]?.passage_title || null,
        passage_type: validLinkedQuestions[0]?.passage_type || groupQuestions[0]?.passage_type || englishMode?.passage_type || null,
        passage_text: validLinkedQuestions[0]?.passage_text || groupQuestions[0]?.passage_text || '',
      };
      const passageQuality = validatePassageQuality(group, QUALITY_MODE);
      const groupDecision = getPassageGroupPublishDecision({
        group,
        acceptedChildren: validLinkedQuestions,
        generatedChildren: groupQuestions,
        mode: QUALITY_MODE,
        passageQuality,
      });
      runMetrics.english.passage_groups_generated += 1;
      runMetrics.english.passage_children_generated += groupQuestions.length;
      console.log('[passage_quality]', {
        passage_id: group.passage_id,
        passage_score: passageQuality.passage_score,
        passage_quality_band: passageQuality.passage_quality_band,
        passage_verdict: passageQuality.passage_verdict,
        issues: passageQuality.passage_issues,
      });
      console.log('[passage_group] publish_decision', {
        passage_group_id: group.id,
        temporary_group_key: groupKey,
        passage_id: group.passage_id,
        passage_score: groupDecision.passage_score,
        generated_children: groupDecision.generated_children,
        accepted_children: groupDecision.accepted_children,
        min_required_children: groupDecision.min_required_children,
        group_status: groupDecision.group_status,
        needs_refill: groupDecision.needs_refill,
        linked_generated: groupQuestions.length,
        selfcheck_passed: groupQuestions.filter((question) => question.selfcheck_passed === true).length,
        validator_accepted: validLinkedQuestions.length,
        published: groupDecision.published,
        draft_reason: groupDecision.draft_reason,
      });
      if (groupDecision.published) {
        passagePublishGroups.push({
          group: {
            ...group,
            group_status: groupDecision.group_status,
            needs_refill: groupDecision.needs_refill,
            refill_target_children: groupDecision.refill_target_children,
            passage_score: groupDecision.passage_score,
            passage_quality_band: groupDecision.passage_quality_band,
          },
          questions: validLinkedQuestions,
          decision: groupDecision,
        });
      } else {
        for (const question of groupQuestions) {
          draftReady.push({ question, reason: groupDecision.draft_reason || 'passage_group_not_publishable' });
        }
      }
      console.log('[passage_group_publish]', {
        group_id: groupKey,
        passage_id: group.passage_id,
        valid_linked_questions: validLinkedQuestions.length,
        published: groupDecision.published,
        draft_reason: groupDecision.draft_reason,
      });
    }
    if (draftOnlyFlag) {
      for (const question of draftCandidates) {
        if (isSchemaValid(question)) draftReady.push({ question, reason: draftOnlyReason || 'draft_only' });
      }
    }
    const schemaRejected = schemaRejectedEntries.length;
    if (schemaRejected > 0) {
      console.warn(`[pipeline] SCHEMA_GUARD removed ${schemaRejected} questions with invalid schema`);
      for (const entry of schemaRejectedEntries) {
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: entry.reason,
          source: 'final_schema_guard',
          rule: entry.reason,
          details: {
            pyq_anchor_id: entry.question?.pyq_anchor_id || null,
            anchor_tier: entry.question?.anchor_tier || null,
          },
          attemptCount: generationAttemptCount,
        });
      }
      stats.rejected += schemaRejected;
    }

    const passageReadyCount = passagePublishGroups.reduce((sum, group) => sum + group.questions.length, 0);
    console.log('[pipeline] FINAL_ACCEPTED_COUNT', publishReady.length + passageReadyCount);
    console.log('[pipeline] final_publish_count', publishReady.length + passageReadyCount);
    console.log(`[pipeline] selected_count=${publishReady.length + passageReadyCount} | FINAL DISTRIBUTION: ${JSON.stringify(countDifficultyMix([...publishReady, ...passagePublishGroups.flatMap((group) => group.questions)]))}`);

    // ── Step 9: Publish first batch ───────────────────────────────────────────
    const acceptedQuestions = [];
    for (const question of publishReady) {
      const publishRes = await publishQuestion(question, API_SECRET, { expectedChapter: job.chapter });
      if (publishRes.success) {
        acceptedQuestions.push(question);
        stats.accepted += 1;
      } else {
        console.warn('[pipeline] publish_rejected', {
          source: 'publish_guard',
          rule: publishRes.error || 'publish_failed',
          subject: question.subject,
          chapter: question.chapter,
          pyq_anchor_id: question.pyq_anchor_id || null,
          anchor_tier: question.anchor_tier || null,
        });
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: publishRes.error || 'publish_failed',
          source: 'publish_guard',
          rule: publishRes.error || 'publish_failed',
          details: {
            pyq_anchor_id: question.pyq_anchor_id || null,
            anchor_tier: question.anchor_tier || null,
          },
          attemptCount: generationAttemptCount,
        });
        stats.rejected += 1;
      }
    }
    for (const passageGroup of passagePublishGroups) {
      const publishRes = await publishPassageGroup(passageGroup.group, passageGroup.questions, API_SECRET, {
        expectedChapter: job.chapter,
        minValidatedChildren: passageGroup.decision?.min_required_children || 2,
      });
      if (publishRes.success) {
        acceptedQuestions.push(...passageGroup.questions);
        stats.accepted += passageGroup.questions.length;
        runMetrics.passage_groups_published += 1;
        runMetrics.english.passage_groups_published += 1;
        runMetrics.english.passage_children_published += passageGroup.questions.length;
        runMetrics.english.nta_grouped_count += passageGroup.questions.length;
        console.log('[passage_group_publish]', {
          group_id: publishRes.group_id,
          passage_id: passageGroup.group.passage_id,
          valid_linked_questions: passageGroup.questions.length,
          group_status: passageGroup.decision?.group_status || 'complete',
          needs_refill: passageGroup.decision?.needs_refill === true,
          published: true,
          draft_reason: null,
        });
        if (passageGroup.decision?.needs_refill === true) {
          const refillPayload = buildPassageRefillJobPayload({
            group: { ...passageGroup.group, id: publishRes.group_id, passage_group_id: publishRes.group_id },
            acceptedChildren: passageGroup.questions,
            decision: passageGroup.decision,
            mode: QUALITY_MODE,
          });
          const { error: refillError } = await supabase
            .from('generation_jobs')
            .insert({
              subject_id: refillPayload.subject,
              chapter: refillPayload.chapter,
              status: 'queued',
              priority: 2,
              target_count: refillPayload.target_additional_questions,
              error_message: `passage_group_refill:${JSON.stringify(refillPayload)}`,
            });
          if (refillError) {
            console.warn('[passage_group_refill] enqueue_failed', {
              passage_group_id: publishRes.group_id,
              error: refillError.message,
            });
          } else {
            console.log('[passage_group_refill] queued', refillPayload);
          }
        }
      } else {
        for (const question of passageGroup.questions) {
          draftReady.push({ question, reason: `passage_group_publish_failed:${publishRes.error}` });
        }
        console.warn('[passage_group_publish]', {
          group_id: passageGroup.group.id,
          passage_id: passageGroup.group.passage_id,
          valid_linked_questions: passageGroup.questions.length,
          published: false,
          draft_reason: publishRes.error,
        });
      }
    }
    runMetrics.standalone_questions_published += acceptedQuestions.filter((question) => !question.is_passage_linked && !question.passage_group_id && !question.temporary_group_key).length;
    runMetrics.english.quick_practice_standalone_count += acceptedQuestions.filter((question) => (
      question.subject === 'english' &&
      !question.is_passage_linked &&
      !question.passage_group_id &&
      !question.temporary_group_key
    )).length;

    let draftCount = 0;
    const draftSeen = new Set();
    for (const entry of draftReady.slice(0, 5)) {
      const key = entry.question?.body || '';
      if (!key || draftSeen.has(key)) continue;
      draftSeen.add(key);
      const draftRes = await saveDraftQuestion(entry.question, entry.reason, { expectedChapter: job.chapter });
      if (draftRes.success) draftCount += 1;
    }
    console.log('[pipeline] draft_gate', {
      draft_only_flag: draftOnlyFlag,
      draft_saved: draftCount,
      draft_candidates: draftReady.length,
      publish_count: acceptedQuestions.length,
    });

    recordAcceptedConcepts(job.subject_id, acceptedQuestions);

    const finalShortfall = targetCount - acceptedQuestions.length;
    if (finalShortfall > 0) {
      console.warn(
        `[pipeline] TARGET_NOT_MET | target=${targetCount} | accepted=${acceptedQuestions.length} | shortfall=${finalShortfall} | api_calls_used=${stats.apiCallsUsed} | reason=accepted_lower_count_without_retry`,
      );
    }

    if (acceptedQuestions.length === 0) {
      logDropSummary(job, dropReasons, {
        rawParsedCount: generationDiagnostics.rawParsedCount,
        normalizedCount: rawQuestions.length,
        sampleFailedRawQuestion: generationDiagnostics.sampleFailedRawQuestion || rawQuestions[0] || null,
        sampleFailedNormalizedAttempt: generationDiagnostics.sampleFailedNormalizedAttempt || rawQuestions[0] || null,
      });
    }

    const avgScore = stats.scores.length > 0
      ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length
      : 0;

    const jobFinalStatus = acceptedQuestions.length === 0 ? 'completed' : 'completed';
    await supabase
      .from('generation_jobs')
      .update({
        status: jobFinalStatus,
        completed_at: new Date().toISOString(),
        ...(draftOnlyFlag
          ? { error_message: `draft_only: ${draftOnlyReason || 'no publishable validated questions'}` }
          : {}),
        ...(finalShortfall > 0 && acceptedQuestions.length > 0
          ? { error_message: `partial: accepted ${acceptedQuestions.length}/${targetCount}` }
          : {}),
      })
      .eq('id', job.id);

    await supabase
      .from('generation_stats')
      .insert({
        run_id: job.id,
        subject_id: job.subject_id,
        chapter: job.chapter,
        total_attempted: stats.total,
        accepted_count: stats.accepted,
        rejected_count: stats.rejected,
        duplicate_count: stats.duplicates,
        avg_score: avgScore,
      });

    // ── Safety warnings ───────────────────────────────────────────────────────
    const finalTotalDups   = stats.duplicates + stats.crossJobDuplicates;
    const finalDupRate     = stats.total > 0 ? finalTotalDups / stats.total : 0;
    const finalYieldRate   = stats.total > 0 ? stats.accepted  / stats.total : 0;
    const costEfficiencyRatio = stats.apiCallsUsed > 0 ? stats.accepted / stats.apiCallsUsed : 0;
    const jobDurationMinutes = Math.max((Date.now() - jobStartedAt) / 60000, 1 / 60);
    const generatedPerMinute = stats.total / jobDurationMinutes;
    const projectedCandidatesPerHour = generatedPerMinute * 60;
    console.log('[speed] generated_per_minute', Number(generatedPerMinute.toFixed(1)));
    console.log('[speed] projected_candidates_per_hour', Number(projectedCandidatesPerHour.toFixed(0)));
    console.log('[speed] model_latency_breakdown', {
      generator_model: selectedForValidation[0]?.generator_model || null,
      validator_model: miniResults[0]?.model || null,
      job_duration_ms: Date.now() - jobStartedAt,
    });

    if (finalDupRate > 0.50) {
      console.warn(`[pipeline] HIGH_DUPLICATE_RATE=${(finalDupRate * 100).toFixed(1)}% (threshold=50%) — consider raising dedup thresholds further or improving prompt diversity`);
    }
    if (finalYieldRate < 0.30 && stats.total > 0) {
      console.warn(`[pipeline] LOW_YIELD=${(finalYieldRate * 100).toFixed(1)}% (threshold=30%) — less than 30 % of generated questions were accepted`);
    }

    console.log(
      `[pipeline] METRICS | generated_count=${stats.total}` +
      ` | prefiltered_count=${balancedQuestions.length}` +
      ` | sent_to_mini_validator=${selectedForValidation.length}` +
      ` | sent_to_strict_validator=${strictByQuestionIndex.size}` +
      ` | accepted_count=${stats.accepted}` +
      ` | final_publish_count=${acceptedQuestions.length}` +
      ` | api_calls_used=${stats.apiCallsUsed}` +
      ` | cost_efficiency_ratio=${costEfficiencyRatio.toFixed(2)}` +
      ` | generated_per_minute=${generatedPerMinute.toFixed(1)}` +
      ` | projected_candidates_per_hour=${projectedCandidatesPerHour.toFixed(0)}`,
    );

    console.log(
      `[pipeline] SUMMARY | subject=${job.subject_id} | chapter=${job.chapter} | target=${targetCount}` +
      ` | generated_count=${stats.total} | batch_duplicates=${stats.duplicates} | cross_job_duplicates=${stats.crossJobDuplicates}` +
      ` | pre_validation_filtered=${stats.preValidationFiltered} | mini_validation_count=${selectedForValidation.length} | strict_validation_count=${strictByQuestionIndex.size} | validated_count=${validatedQuestions.length}` +
      ` | accepted_count=${stats.accepted} | draft_count=${draftCount} | draft_only_flag=${draftOnlyFlag} | shortfall=${finalShortfall}` +
      ` | yield_rate=${(finalYieldRate * 100).toFixed(1)}%` +
      ` | generated_per_minute=${generatedPerMinute.toFixed(1)} | projected_candidates_per_hour=${projectedCandidatesPerHour.toFixed(0)}` +
      ` | retry_count=${stats.retryCount} | api_calls_used=${stats.apiCallsUsed}`,
    );
    console.log('[pipeline] JOB_SUMMARY', {
      subject: job.subject_id,
      chapter: job.chapter,
      generator_model: selectedForValidation[0]?.generator_model || null,
      generator_provider: selectedForValidation[0]?.generator_provider || null,
      generation_mode: englishMode?.mode || null,
      requires_passage: englishMode?.requires_passage === true,
      cheap_validator_model: miniResults[0]?.model || null,
      strict_validator_model: [...strictByQuestionIndex.values()][0]?.model || null,
      pyq_anchor_ids: selectedForValidation.map((question) => question.pyq_anchor_id).filter(Boolean),
      anchor_tier: selectedForValidation.map((question) => question.anchor_tier),
      anchor_match_level: selectedForValidation.map((question) => question.anchor_match_level),
      anchor_confidence: selectedForValidation.map((question) => question.anchor_confidence),
      concept_mismatch_risk: selectedForValidation.map((question) => question.concept_mismatch_risk),
      fallback_used: false,
      generated_count: stats.total,
      selfcheck_passed: candidatePool.length,
      selfcheck_rejected: selfCheckRejectedEntries.length,
      sent_to_mini_validator: selectedForValidation.length,
      mini_accepted: miniCounts.accepted,
      mini_borderline: miniCounts.borderline,
      mini_rejected: miniCounts.rejected,
      sent_to_strict_validator: strictByQuestionIndex.size,
      strict_accepted: [...strictByQuestionIndex.values()].filter(isLayerAccepted).length,
      strict_rejected: [...strictByQuestionIndex.values()].filter((result) => !isLayerAccepted(result)).length,
      final_published: acceptedQuestions.length,
      draft_saved: draftCount,
      yield_rate: Number((finalYieldRate * 100).toFixed(1)),
      generated_per_minute: Number(generatedPerMinute.toFixed(1)),
      projected_candidates_per_hour: Number(projectedCandidatesPerHour.toFixed(0)),
      blocked_publish_reason: draftReady.map((entry) => entry.reason).slice(0, 8),
    });
    console.log('[override_metrics]', runMetricsSnapshot().override_metrics);
    console.log('[quality_metrics]', runMetricsSnapshot().quality_metrics);
    if (job.subject_id === 'english') console.log('[english_metrics]', runMetricsSnapshot().english_metrics);
    console.log(`[pipeline] Accepted difficulty mix: ${formatDifficultyCounts(acceptedQuestions)}`);
    console.log(`[pipeline] subject_distribution: ${JSON.stringify({ subject: job.subject_id, accepted: stats.accepted, rejected: stats.rejected, target: targetCount, met: finalShortfall === 0 })}`);

    // ── Cost Supervisor ──────────────────────────────────────────────────────
    recordAcceptedForCost(stats.accepted);
    const costSnapshot = getCostTracker();
    console.log(`[supervisor] COST_REPORT | total_tokens_used=${Math.round(costSnapshot.totalInputTokens + costSnapshot.totalOutputTokens)} | total_cost=$${(costSnapshot.totalCostUsd).toFixed(4)} | cost_per_accepted=$${costSnapshot.costPerAccepted.toFixed(4)} | cost_per_1000=$${costSnapshot.costPer1000.toFixed(2)} | total_accepted=${costSnapshot.acceptedCount}`);
    console.log('[cost] validation_cost', {
      total_cost_usd: Number(costSnapshot.totalCostUsd.toFixed(6)),
      accepted_questions: costSnapshot.acceptedCount,
    });
    console.log('[cost] cost_per_live_question', Number(costSnapshot.costPerAccepted.toFixed(6)));
    console.log('[cost] cost_per_1000_live', Number(costSnapshot.costPer1000.toFixed(2)));
    console.log('[cost] model_breakdown', {
      generator_model: selectedForValidation[0]?.generator_model || null,
      cheap_validator_model: miniResults[0]?.model || null,
      strict_validator_model: [...strictByQuestionIndex.values()][0]?.model || null,
    });
    if (costSnapshot.costPer1000 > COST_SOFT_ALERT_PER_1000 && costSnapshot.costPer1000 <= COST_HARD_THROTTLE_PER_1000 && costSnapshot.acceptedCount >= 1) {
      console.warn(`[supervisor] COST_SOFT_ALERT: $${costSnapshot.costPer1000.toFixed(2)}/1000 accepted exceeds soft target; speed-first mode keeps Flash batch size and validation active`);
    }
    if (costSnapshot.costPer1000 > COST_HARD_THROTTLE_PER_1000 && costSnapshot.acceptedCount >= 3) {
      console.warn(`[supervisor] COST_HARD_ALERT: $${costSnapshot.costPer1000.toFixed(2)}/1000 accepted exceeds hard throttle; strict validation cap is reduced before Flash batch size is touched`);
    }

    recordRunMetricsUpdate({
      generatorModel: selectedForValidation[0]?.generator_model || rawQuestions[0]?.generator_model || null,
      jobDurationMs: Date.now() - jobStartedAt,
      generatedCount: stats.total,
      normalizedCount: rawQuestions.length,
      selfcheckPassed: candidatePool.length,
      validatorSent: selectedForValidation.length,
      validatorAccepted: validatedQuestions.length,
      livePublished: acceptedQuestions.length,
      draftsSaved: draftCount,
    });

    const recentQuality = await analyzeRecentAcceptedQuality(job.subject_id, job.chapter);
    dynamicQualityFeedback = recentQuality.feedback;
    console.log('[quality-loop] DB_RECENT_QUALITY', recentQuality.report);

  } catch (err) {
    console.error('Failed:', err.message);

    if (err.message?.includes('429') || err.message?.includes('quota')) {
      await supabase.from('generation_jobs').update({ status: 'queued' }).eq('id', job.id);
      throw err;
    }

    await supabase
      .from('generation_jobs')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', job.id);
  }
}

function formatDifficultyCounts(questions) {
  const counts = { easy: 0, medium: 0, hard: 0 };

  for (const question of questions || []) {
    if (question?.difficulty === 'easy' || question?.difficulty === 'medium' || question?.difficulty === 'hard') {
      counts[question.difficulty] += 1;
    }
  }

  return `easy=${counts.easy}, medium=${counts.medium}, hard=${counts.hard}`;
}

async function analyzeRecentAcceptedQuality(subjectId, chapter) {
  const { data, error } = await supabase
    .from('questions')
    .select('body, options, correct_answer, difficulty, tags, created_at')
    .eq('subject', subjectId)
    .eq('chapter', chapter)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.warn(`[quality-loop] failed_to_fetch_recent_questions: ${error.message}`);
    return { feedback: dynamicQualityFeedback, report: { error: error.message } };
  }

  const rows = data || [];
  const directDefinitionCount = rows.filter((question) => isDirectDefinitionStem(question.body)).length;
  const weakOptionCount = rows.filter((question) => hasWeakOptions(question.options, question.correct_answer)).length;
  const repeatedStructureCount = countRepeatedStructure(rows);
  const easyCount = rows.filter((question) => question.difficulty === 'easy').length;
  const feedback = [];

  if (directDefinitionCount > 0) feedback.push('recent DB sample contains direct-definition/textbook stems; use scenario, comparison, statement, or trap formats only');
  if (weakOptionCount > Math.max(1, rows.length * 0.20)) feedback.push('recent DB sample has weak option traps; include close confusion and partial-truth distractors');
  if (repeatedStructureCount > Math.max(2, rows.length * 0.25)) feedback.push('recent DB sample repeats question structure; vary stems and concept_pattern');
  if (easyCount > rows.length * 0.45) feedback.push('recent DB sample is too easy; increase one-step reasoning and option confusion');

  return {
    feedback: feedback.slice(0, 6),
    report: {
      subject: subjectId,
      chapter,
      sample_size: rows.length,
      direct_definition_count: directDefinitionCount,
      weak_option_count: weakOptionCount,
      repeated_structure_count: repeatedStructureCount,
      easy_count: easyCount,
      feedback_count: feedback.length,
    },
  };
}

function countRepeatedStructure(questions) {
  const counts = new Map();
  for (const question of questions || []) {
    const key = getStemShape(question.body);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 2), 0);
}

function getStemShape(body) {
  return String(body || '')
    .toLowerCase()
    .replace(/\b[a-z][a-z0-9-]{3,}\b/g, 'x')
    .replace(/\d+/g, 'n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

// Uniform floor of 5 — the previous 7 for medium was rejecting too many valid questions.
// cuet_alignment failures are handled separately as a compound (score-gated) check.
function getDifficultyThreshold(_difficulty) {
  return 5;
}

function isClearlyOutsideChapter(question, chapter, subjectId) {
  const body = String(question?.body || '').toLowerCase();
  const chapterKeywords = extractChapterKeywords(chapter);
  const hasChapterSignal = chapterKeywords.some((keyword) => body.includes(keyword));
  if (hasChapterSignal) return false;

  const clearlyOffChapterTerms = {
    business_studies: {
      'nature & significance of management': [
        'working capital', 'financial management', 'capital structure', 'dividend',
        'controlling process', 'marketing mix', 'consumer protection',
      ],
      'nature and significance of management': [
        'working capital', 'financial management', 'capital structure', 'dividend',
        'controlling process', 'marketing mix', 'consumer protection',
      ],
    },
    gat: {
      gat: ['econometrics', 'regression coefficient', 'standard deviation formula', 'hypothesis testing'],
    },
  };

  const subjectRules = clearlyOffChapterTerms[subjectId] || {};
  const chapterRules = subjectRules[String(chapter || '').toLowerCase()] || subjectRules.gat || [];
  return chapterRules.some((term) => body.includes(term));
}

function extractChapterKeywords(chapter) {
  return String(chapter || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3 && !['chapter', 'unit', 'and', 'the', 'with', 'from'].includes(token))
    .slice(0, 10);
}

function applyValidationImprovement(question, improved, expectedChapter) {
  if (!improved || typeof improved !== 'object') return question;

  const optionTexts = Array.isArray(improved.o)
    ? improved.o
    : Array.isArray(improved.options)
      ? improved.options.map((option) => typeof option === 'string' ? option : option?.text)
      : [];
  if (optionTexts.length !== 4) return question;

  const improvedQuestion = {
    ...question,
    body: String(improved.q || improved.body || question.body || '').trim(),
    options: optionTexts.map((text, index) => ({
      key: ['A', 'B', 'C', 'D'][index],
      text: String(text || '').replace(/^[A-D][).]\s*/i, '').trim(),
    })),
    correct_answer: String(improved.a || improved.correct_answer || question.correct_answer || '').trim().toUpperCase(),
    explanation: String(improved.explanation || question.explanation || '').trim(),
    difficulty: improved.d === 'easy' || improved.d === 'medium' || improved.d === 'hard'
      ? improved.d
      : question.difficulty,
    concept_pattern: String(improved.concept_pattern || question.concept_pattern || '').trim(),
    chapter: expectedChapter,
  };

  return isSchemaValid(improvedQuestion) ? improvedQuestion : question;
}

function classifyDifficulty(question) {
  if (isKnownDifficulty(question?.validator_recommended_difficulty)) {
    return question.validator_recommended_difficulty;
  }

  const text = String(question?.question || question?.body || '').toLowerCase();
  let score = 0;

  const optionTexts = Array.isArray(question?.options)
    ? question.options.map((option) => String(option?.text || '').toLowerCase())
    : [];
  const optionText = optionTexts.length > 0
    ? optionTexts.join(' ')
    : '';
  const combinedText = `${text} ${optionText}`;
  const directConcept = /^(what is|define|meaning of|which term|who is|when did|identify the)\b/.test(text);
  const statementCue = /\bstatement|assertion|reason|incorrect|not correct|except|match\b/.test(text);
  const eliminationCue = /\bwhich of the following|identify|choose|select|best|most appropriate|closest\b/.test(text);
  const subtleTrapCue = /\bincorrect|not correct|except|assertion|reason|only|always|never|closest|principle|function\b/.test(combinedText);
  const overComplexCue = /\boptimi[sz]e|multi-step|profit maximization|elasticity calculation|caselet|college|mba\b/.test(text) || text.length > 260;
  const closeOptions = hasCloseDistractors(optionTexts);
  const simpleNumerical = /[=+\-*/]/.test(text) && !statementCue && !subtleTrapCue;
  const modelHardWithTrap =
    question?.difficulty === 'hard' &&
    (statementCue || subtleTrapCue || closeOptions || eliminationCue) &&
    !directConcept &&
    !simpleNumerical &&
    !overComplexCue;

  if (directConcept) score -= 1;
  if (eliminationCue) score += 1;
  if (statementCue) score += 1;
  if (subtleTrapCue) score += 1;
  if (closeOptions) score += 1;
  if (overComplexCue) score -= 1;
  if (simpleNumerical) score -= 1;

  if (modelHardWithTrap) return 'hard';
  if (directConcept && !closeOptions && !subtleTrapCue) return 'easy';
  if (simpleNumerical) return score >= 2 ? 'medium' : 'easy';
  if (closeOptions && (statementCue || subtleTrapCue) && !overComplexCue) return 'hard';
  if (score <= 1) return 'easy';
  return 'medium';
}

function isKnownDifficulty(difficulty) {
  return difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard';
}

function normalizeDifficulty(difficulty) {
  const normalized = String(difficulty || '').trim().toLowerCase();
  return isKnownDifficulty(normalized) ? normalized : 'medium';
}

function normalizeOptionalDifficulty(difficulty) {
  const normalized = String(difficulty || '').trim().toLowerCase();
  return isKnownDifficulty(normalized) ? normalized : null;
}

function hasCloseDistractors(optionTexts) {
  if (!Array.isArray(optionTexts) || optionTexts.length < 4) return false;
  let closePairs = 0;
  for (let i = 0; i < optionTexts.length; i += 1) {
    for (let j = i + 1; j < optionTexts.length; j += 1) {
      if (optionSimilarity(optionTexts[i], optionTexts[j]) >= 0.35) closePairs += 1;
    }
  }
  return closePairs >= 2;
}

function optionSimilarity(left, right) {
  const leftTokens = new Set(String(left || '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 3));
  const rightTokens = new Set(String(right || '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function getDifficultyFallbackOrder(difficultyOverride) {
  if (difficultyOverride === 'hard') return ['medium', 'easy'];
  if (difficultyOverride === 'easy') return ['medium', 'hard'];
  return ['hard', 'easy'];
}

function selectBalancedQuestions(validatedQuestions) {
  const buckets = { easy: [], medium: [], hard: [] };

  for (const question of validatedQuestions) {
    const difficulty = question?.difficulty === 'easy' || question?.difficulty === 'medium' || question?.difficulty === 'hard'
      ? question.difficulty
      : 'medium';
    buckets[difficulty].push(question);
  }

  const total = validatedQuestions.length;
  const targetRatio = { easy: 0.30, medium: 0.50, hard: 0.20 };
  const target = {
    easy: Math.ceil(total * targetRatio.easy),
    medium: Math.ceil(total * targetRatio.medium),
    hard: Math.ceil(total * targetRatio.hard),
  };

  const selected = [];
  const remainingBuckets = {
    easy: [...buckets.easy],
    medium: [...buckets.medium],
    hard: [...buckets.hard],
  };

  for (const difficulty of ['easy', 'medium', 'hard']) {
    const taken = remainingBuckets[difficulty].splice(0, target[difficulty]);
    selected.push(...taken);
  }

  while (selected.length < total) {
    if (remainingBuckets.hard.length > 0) {
      selected.push(remainingBuckets.hard.shift());
    } else if (remainingBuckets.medium.length > 0) {
      selected.push(remainingBuckets.medium.shift());
    } else if (remainingBuckets.easy.length > 0) {
      selected.push(remainingBuckets.easy.shift());
    } else {
      break;
    }
  }

  return selected;
}

function countDifficultyMix(questions) {
  return {
    easy: questions.filter((question) => question.difficulty === 'easy').length,
    medium: questions.filter((question) => question.difficulty === 'medium').length,
    hard: questions.filter((question) => question.difficulty === 'hard').length,
  };
}

function getDifficultyWeight(difficulty) {
  return { easy: 1, medium: 2, hard: 3 }[String(difficulty || '').toLowerCase()] || 2;
}

if (process.argv.includes('--start')) {
  workerLoop();
}

function mergeDropReasons(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += source?.[key] || 0;
  }
}

function logDropSummary(job, dropReasons, diagnostics = {}) {
  console.warn(`No questions returned for ${job.subject_id}/${job.chapter}`);
  console.warn(`RAW_PARSED_COUNT=${diagnostics.rawParsedCount ?? 0}`);
  console.warn(`NORMALIZED_COUNT=${diagnostics.normalizedCount ?? 0}`);
  console.warn(`VALIDATED_COUNT=0`);
  console.warn('Drop summary:');
  for (const [reason, count] of Object.entries(dropReasons)) {
    console.warn(`- ${reason}: ${count}`);
  }
  if (diagnostics.sampleFailedRawQuestion) {
    console.warn(`Sample failed raw question: ${JSON.stringify(diagnostics.sampleFailedRawQuestion)}`);
  }
  if (diagnostics.sampleFailedNormalizedAttempt) {
    console.warn(`Sample normalized attempt: ${JSON.stringify(diagnostics.sampleFailedNormalizedAttempt)}`);
  }
}
