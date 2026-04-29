import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCoverage } from './analyzer.mjs';
import { planGeneration } from './planner.mjs';
import { generateQuestions, getLastGenerationDiagnostics, validateAndAlignBatch, PIPELINE_BATCH_SIZE } from '../lib/llm.mjs';
import { deduplicateBatch, deduplicateAgainst } from '../lib/dedupe.mjs';
import { publishQuestion } from '../lib/publish.mjs';
import { CUET_SUPPORTED_SUBJECTS } from '../../../data/subjects.js';
import { CANONICAL_SYLLABUS, TOP_SUBJECTS, getCanonicalUnitForChapter, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { validateTraceability } from '../../../data/cuet_controls.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_SECRET = process.env.INTERNAL_API_SECRET || 'test-secret';
const MAX_RETRIES = 3;
const MAX_API_CALLS_PER_JOB = MAX_RETRIES + 1;
const VALIDATOR_FEEDBACK_PREFIX = 'validator_feedback:';
const VALIDATION_CANDIDATE_LIMIT = 25;
const STANDARD_VALIDATION_SAMPLE_RATE = 0.35;
const LOW_COVERAGE_VALIDATION_THRESHOLD = 25;
const MIN_QUESTIONS_PER_CHAPTER = 50;
const TOP_SUBJECT_SET = new Set(TOP_SUBJECTS);
const canonical_syllabus = Object.fromEntries(
  CANONICAL_SYLLABUS
    .filter((subject) => TOP_SUBJECT_SET.has(subject.subject_id))
    .map((subject) => [subject.subject_id, subject])
);
const VALID_SUBJECTS = new Set(Object.keys(canonical_syllabus));
const DEFAULT_GENERATION_COUNT = PIPELINE_BATCH_SIZE;
const HEAVY_CHAPTER_GENERATION_COUNT = 10;
const MIN_TIMEOUT_RETRY_COUNT = 10;
const MAX_GENERATION_TIMEOUT_RETRIES = 2;
const GENERATION_FALLBACK_MODEL = 'gpt-5.4-mini';
const HEAVY_GENERATION_CHAPTERS = new Set([
  'Differential Equations',
  'Probability',
  'Integrals',
]);

const args = process.argv.slice(2);
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
    explanation: question.explanation || '',
    topic: question.topic || '',
    concept: question.concept || '',
    concept_id: question.concept_id || '',
    pyq_anchor_id: question.pyq_anchor_id || '',
    anchor_tier: Number(question.anchor_tier || question.anchorTier || 0),
    question_type: question.question_type || question.pattern_type || 'direct_concept',
    concept_pattern: question.concept_pattern || '',
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
  let removed = 0;

  for (const question of questions) {
    if (!question || typeof question !== 'object') { removed += 1; continue; }
    if (!isValidQuestion(question)) { removed += 1; continue; }

    valid.push(question);
  }

  return { valid, removed };
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

function getInternalRejectionReason(question, expectedSubject, expectedChapter) {
  if (!isSchemaValid(question)) return 'invalid_schema';
  if (!isValidSyllabusPair(question.subject, question.chapter)) return 'invalid_syllabus_pair';
  if (question.subject !== expectedSubject || question.chapter !== expectedChapter) return 'subject_or_chapter_mismatch';
  const traceability = validateTraceability(question, expectedSubject, expectedChapter);
  if (!traceability.valid) return traceability.reason;
  if (!String(question.pyq_anchor_id || '').trim()) return 'missing_pyq_anchor';
  if (![1, 2, 3].includes(Number(question.anchor_tier))) return 'missing_or_invalid_anchor_tier';

  const body = String(question.body || '').trim();
  const bodyLower = body.toLowerCase();
  if (body.length > 420 || countWords(body) > 70) return 'question_too_long';
  if (isClearlyAdvancedOrNonCuet(bodyLower)) return 'advanced_or_non_cuet_pattern';
  if (hasWeakOptions(question.options, question.correct_answer)) return 'weak_options';
  if (isClearlyOutsideChapter(question, expectedChapter, expectedSubject)) return 'outside_chapter';

  return null;
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isClearlyAdvancedOrNonCuet(text) {
  return /\b(vector space|subspace|basis|rank-nullity|heine-borel|cayley-hamilton|prove|proof|derive|derivation|jee|graduate|mba|b\.com|econometrics|hypothesis testing|functional analysis|abstract algebra|ring|field|group under|multi-step|caselet)\b/i.test(text);
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

  const avgLength = texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
  return texts.some((text) => avgLength > 0 && text.length < avgLength * 0.25);
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

function logRejectedQuestion({ subject, chapter, reason, attemptCount = 0 }) {
  console.log('[reject]', {
    subject,
    chapter,
    reason,
    attemptCount,
  });
}

function parseValidatorRetryFeedback(errorMessage) {
  const raw = String(errorMessage || '');
  if (!raw.startsWith(VALIDATOR_FEEDBACK_PREFIX)) {
    return { attempt: 0, reasons: [] };
  }

  try {
    const parsed = JSON.parse(raw.slice(VALIDATOR_FEEDBACK_PREFIX.length));
    return {
      attempt: Math.max(0, Math.min(Number(parsed.attempt || 0), MAX_RETRIES - 1)),
      reasons: collectUniqueFeedbackReasons(parsed.reasons || []),
    };
  } catch {
    return { attempt: 0, reasons: [] };
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

function collectUniqueFeedbackReasons(reasons) {
  const unique = new Set();
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    const clean = String(reason || '').trim();
    if (clean) unique.add(clean);
  }
  return [...unique].slice(0, 8);
}

async function requeueJobWithValidatorFeedback(jobId, attempt, reasons) {
  const feedback = {
    attempt,
    reasons: collectUniqueFeedbackReasons(reasons),
    updatedAt: new Date().toISOString(),
  };

  console.warn('[validator-feedback] requeueing_job_with_feedback', {
    job_id: jobId,
    next_attempt: attempt + 1,
    max_attempts: MAX_RETRIES,
    reasons: feedback.reasons,
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
  let pairs = 0;
  for (let i = 0; i < optionTokenSets.length; i += 1) {
    for (let j = i + 1; j < optionTokenSets.length; j += 1) {
      totalOverlap += setOverlap(optionTokenSets[i], optionTokenSets[j]);
      pairs += 1;
    }
  }
  return 1 - (pairs > 0 ? totalOverlap / pairs : 1);
}

function lexicalOverlap(left, right) {
  const leftSet = new Set(String(left || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2));
  const rightSet = new Set(String(right || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 2));
  return setOverlap(leftSet, rightSet);
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

  return {
    ...job,
    question_count: questionCount,
    subject_question_count: subjectTotal,
    priority: getCoveragePriority(job.subject_id, job.chapter, questionCount, subjectTotal),
    original_priority: job.priority,
  };
}

function compareJobsByCoverage(a, b) {
  return a.question_count - b.question_count ||
    b.priority - a.priority ||
    new Date(a.created_at || 0) - new Date(b.created_at || 0);
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

async function selectCoverageFirstJob({ preferredJobIds = [], coverage, excludeSubject = null, minPriority = null } = {}) {
  let query = supabase
    .from('generation_jobs')
    .select('*')
    .eq('status', 'queued')
    .in('subject_id', [...VALID_SUBJECTS])
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

  const jobs = (data || [])
    .filter((candidate) => isValidSyllabusPair(candidate.subject_id, candidate.chapter))
    .map((candidate) => annotateJobWithCoverage(candidate, coverage))
    .sort(compareJobsByCoverage);

  return jobs[0] || null;
}

async function workerLoop() {
  console.log('\nAutonomous CUET Question Engine Started');
  loadConceptMemory();

  let lastPlanTime = 0;
  let preferredPlannedJobIds = [];
  const PLAN_INTERVAL = 60 * 60 * 1000;

  while (true) {
    try {
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
      await skipInvalidQueuedJobs();
      let job = await selectCoverageFirstJob({
        preferredJobIds: preferredPlannedJobIds,
        coverage,
      });

      if (!job && preferredPlannedJobIds.length > 0) {
        console.warn('[queue] PREFERRED_PLANNED_JOBS_EMPTY_OR_ALREADY_CLAIMED: falling back to valid queued jobs by lowest coverage');
        preferredPlannedJobIds = [];
        job = await selectCoverageFirstJob({ coverage });
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

      await processJob(job);

      console.log('Cooling down for 15s to respect API limits...');
      await new Promise((resolve) => setTimeout(resolve, 15000));
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
    if (!subject.chapters.includes(job.chapter) || !canonicalUnit) {
      console.warn('[llm] chapter_mismatch_detected', {
        expected: subject.chapters,
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
      .limit(200);
    const existingQuestions = existingQsData || [];
    if (existingQuestions.length > 0) {
      console.log(`[pipeline] cross_job_dedup_pool=${existingQuestions.length} existing questions loaded`);
    }

    // ── Step 1: Generate — API call 1 ────────────────────────────────────────
    stats.apiCallsUsed += 1;
    // Generate one large candidate pool; downstream filters choose what to validate.
    const targetCount = Math.min(job.target_count || PIPELINE_BATCH_SIZE, PIPELINE_BATCH_SIZE);
    let generateCount = getInitialGenerationCount(job.chapter);
    const adaptiveMax = getAdaptiveMaxPerConcept(subject);
    const usedConceptSample = sampleArray([...getUsedConcepts(job.subject_id)], 20);
    let generationContext = {
      usedConcepts: usedConceptSample,
      saturatedSubtopics: getSaturatedSubtopics(job.subject_id, adaptiveMax),
      difficultyOverride,
      validationFeedback: retryFeedback.reasons,
      maxAttempts: 1,
    };
    console.log('[generation] batch adjusted:', {
      chapter: job.chapter,
      generate_count: generateCount,
    });
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
    });
    console.log(`[pipeline] Generating ${generateCount} candidates... chapter="${job.chapter}" unit="${canonicalUnit.unit_name}" usedConcepts=${generationContext.usedConcepts.length} saturated=${generationContext.saturatedSubtopics.length} (api_call=${stats.apiCallsUsed})`);
    let rawQuestions = await generateQuestions(subject, job.chapter, generateCount, generationContext);
    let generationAttemptCount = 1;
    let bestRawQuestions = Array.isArray(rawQuestions) ? rawQuestions : [];

    let generationRetryCount = 0;
    while (isGenerationTimeout(rawQuestions) && generationRetryCount < MAX_GENERATION_TIMEOUT_RETRIES) {
      generationRetryCount += 1;
      stats.retryCount += 1;
      generateCount = Math.max(MIN_TIMEOUT_RETRY_COUNT, Math.floor(generateCount / 2));
      generationContext = {
        ...generationContext,
        modelOverride: GENERATION_FALLBACK_MODEL,
      };
      console.warn('[generation] timeout fallback reduction:', {
        chapter: job.chapter,
        retry_count: generationRetryCount,
        generate_count: generateCount,
        fallback_model: GENERATION_FALLBACK_MODEL,
      });
      console.log('[generation] batch adjusted:', {
        chapter: job.chapter,
        generate_count: generateCount,
      });
      stats.apiCallsUsed += 1;
      generationAttemptCount += 1;
      rawQuestions = await generateQuestions(subject, job.chapter, generateCount, generationContext);
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
        attemptCount: generationAttemptCount - 1,
      });
      rawQuestions = await generateQuestions(subject, job.chapter, generateCount, generationContext);
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
          attemptCount: generationAttemptCount,
        });
        continue;
      }
      chapterFiltered.push(question);
    }

    // ── Step 3: Structural quality filter — sync ──────────────────────────────
    const { valid: structFiltered, removed: structRemoved } = filterMalformedQuestions(chapterFiltered);
    console.log('[pipeline] STRUCTURAL_VALID_COUNT', structFiltered.length);
    stats.preValidationFiltered = structRemoved;
    dropReasons.missing_required_fields += structRemoved;
    if (structRemoved > 0) {
      console.warn(`[pipeline] pre_validation_filtered=${structRemoved} malformed questions removed (missing fields / bad options)`);
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
          attemptCount: generationAttemptCount,
        });
      }
    }

    const { unique: batchUnique, removed: batchDupCount } = deduplicateBatch(internallyFiltered);
    const { unique: dedupedQuestions, removed: crossJobDupCount } = deduplicateAgainst(batchUnique, existingQuestions);
    const dupCount = batchDupCount + crossJobDupCount;
    stats.duplicates = batchDupCount;
    stats.crossJobDuplicates = crossJobDupCount;
    const dupRate = internallyFiltered.length > 0 ? dupCount / internallyFiltered.length : 0;

    const balancedQuestions = balanceCorrectAnswerDistribution(dedupedQuestions).slice(0, targetCount);
    const rankedForValidation = rankValidationCandidates(balancedQuestions, VALIDATION_CANDIDATE_LIMIT);
    const selectedForValidation = rankedForValidation;

    console.log(`[pipeline] after_chapter_filter=${chapterFiltered.length} | pre_validation_filtered=${structRemoved + internalRejected.length} | batch_duplicates=${batchDupCount} | cross_job_duplicates=${crossJobDupCount} | candidate_pool=${balancedQuestions.length} | sent_for_strict_validation=${selectedForValidation.length}`);

    if (dupRate > 0.30) {
      console.warn(`[pipeline] HIGH_DUPLICATE_RATE=${(dupRate * 100).toFixed(1)}% (threshold=30%)`);
    }

    if (balancedQuestions.length === 0) {
      logDropSummary(job, dropReasons, {
        rawParsedCount: generationDiagnostics.rawParsedCount,
        normalizedCount: rawQuestions.length,
        sampleFailedRawQuestion: null,
        sampleFailedNormalizedAttempt: null,
      });
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: 'Skipped: 0 unique valid questions after filtering' })
        .eq('id', job.id);
      return;
    }

    // Step 5: Selective batch validation - API call 2, no retry.
    stats.apiCallsUsed += 1;
    if (stats.apiCallsUsed > MAX_API_CALLS_PER_JOB) {
      throw new Error(`api_call_limit_exceeded before validation (${stats.apiCallsUsed} calls)`);
    }

    console.log(`[pipeline] Starting batch validation for ${selectedForValidation.length} ranked questions... (api_call=${stats.apiCallsUsed})`);
    let validationResults;

    try {
      validationResults = await validateAndAlignBatch(selectedForValidation, subject);
    } catch (validationErr) {
      console.error(`[pipeline] Batch validation failed without retry: ${validationErr.message}. Aborting job within ${MAX_API_CALLS_PER_JOB}-call budget.`);
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: `validation_failed_no_retry: ${validationErr.message}` })
        .eq('id', job.id);
      return;
    }

    // ── Step 6: Filter by validation scores ───────────────────────────────────
    let validatedQuestions = [];
    const validatorFeedbackReasons = [];
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
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: 'missing_strict_validation_result',
          attemptCount: generationAttemptCount,
        });
        continue;
      }
      const scoreThreshold = getDifficultyThreshold(question.difficulty);
      const improvedQuestion = applyValidationImprovement(question, validation?.improved_question, job.chapter);
      const hasValidatorImprovement = improvedQuestion !== question;
      const validationSkippedForReview =
        validation.requires_review === true && validation.validation_confidence === 'low';
      // cuet_alignment alone is not sufficient to reject — the LLM validator is
      // unreliable on this field.  Only reject on alignment failure when the score
      // is ALSO below 7 (compound gate).  Score < scoreThreshold (5) is always fatal.
      const fatalValidationFailure =
        validation.score < scoreThreshold ||
        (validation.cuet_alignment === false && validation.score < 7);
      const qualityValidationFailure =
        validation.decision === 'reject' ||
        validation.exam_quality < 7 ||
        validation.distractor_quality < 7 ||
        validation.textbook_style === true ||
        validation.fully_within_cuet_syllabus !== 'YES' ||
        validation.matches_cuet_pyq_difficulty !== 'YES' ||
        validation.harder_than_typical_cuet_level !== 'NO' ||
        validation.ambiguity_or_multiple_correct_answers !== 'NO' ||
        validation.language_unnecessarily_complex !== 'NO' ||
        validation.syllabus_alignment !== 'WITHIN' ||
        validation.concept_match !== 'EXACT' ||
        validation.difficulty_level === 'TOO HARD' ||
        validation.compared_to_pyqs === 'HARDER' ||
        validation.clarity === 'AMBIGUOUS' ||
        validation.language_level === 'COMPLEX' ||
        validation.option_quality !== 'CLEAN' ||
        validation.subject_consistency !== 'CORRECT';
      const shouldReject =
        !validationSkippedForReview &&
        (fatalValidationFailure || (!hasValidatorImprovement && qualityValidationFailure));

      if (shouldReject) {
        dropReasons.validation_failed += 1;
        if (validation.score < scoreThreshold) dropReasons.low_score += 1;
        if (validation.difficulty_correct === false) dropReasons.difficulty_mismatch += 1;
        if (validation.cuet_alignment === false) dropReasons.cuet_alignment_failed += 1;
        validatorFeedbackReasons.push(...collectValidationReasons(validation));
        console.warn(
          `[pipeline] Rejected | score=${validation.score} | exam_quality=${validation.exam_quality} | distractor_quality=${validation.distractor_quality} | conceptual_depth=${validation.conceptual_depth} | textbook_style=${validation.textbook_style} | difficulty_correct=${validation.difficulty_correct} | cuet_alignment=${validation.cuet_alignment} | issues=${(validation.issues || []).join('; ')}`,
        );
        logRejectedQuestion({
          subject: job.subject_id,
          chapter: job.chapter,
          reason: (validation.issues || []).join('; ') || validation.decision || 'validation_failed',
          attemptCount: generationAttemptCount,
        });
        stats.rejected += 1;
        continue;
      }

      if (hasValidatorImprovement) {
        console.log(`[pipeline] Applied validator improvement | index=${i} | issues=${(validation.issues || []).join('; ')}`);
      }
      validatedQuestions.push({
        ...improvedQuestion,
        validation_score: validation.score,
        validation_sampled: true,
        strict_cuet_validated: true,
      });
      stats.scores.push(validation.score);
    }

    if (validatedQuestions.length === 0) {
      console.warn('[pipeline] strict_mode_no_validated_questions');
      const feedbackReasons = collectUniqueFeedbackReasons(validatorFeedbackReasons);
      if (retryFeedback.attempt < MAX_RETRIES - 1 && feedbackReasons.length > 0) {
        await requeueJobWithValidatorFeedback(job.id, retryFeedback.attempt + 1, feedbackReasons);
        return;
      }
    }

    const modelDifficultyCounts = countDifficultyMix(validatedQuestions);
    validatedQuestions = validatedQuestions.map((question) => ({
      ...question,
      difficulty: classifyDifficulty(question),
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
    if (acceptanceRate < 0.30) {
      console.warn(`[pipeline] LOW_ACCEPTANCE_RATE=${(acceptanceRate * 100).toFixed(1)}% (threshold=30%)`);
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
    const publishReady = sanityUnique.filter((question) => (
      isSchemaValid(question) &&
      !getInternalRejectionReason(question, job.subject_id, job.chapter)
    ));
    const schemaRejected = sanityUnique.length - publishReady.length;
    if (schemaRejected > 0) {
      console.warn(`[pipeline] SCHEMA_GUARD removed ${schemaRejected} questions with invalid schema`);
      stats.rejected += schemaRejected;
    }

    console.log('[pipeline] FINAL_ACCEPTED_COUNT', publishReady.length);
    console.log(`[pipeline] selected_count=${publishReady.length} | FINAL DISTRIBUTION: ${JSON.stringify(countDifficultyMix(publishReady))}`);

    // ── Step 9: Publish first batch ───────────────────────────────────────────
    const acceptedQuestions = [];
    for (const question of publishReady) {
      const publishRes = await publishQuestion(question, API_SECRET, { expectedChapter: job.chapter });
      if (publishRes.success) {
        acceptedQuestions.push(question);
        stats.accepted += 1;
      } else {
        stats.rejected += 1;
      }
    }

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

    if (finalDupRate > 0.50) {
      console.warn(`[pipeline] HIGH_DUPLICATE_RATE=${(finalDupRate * 100).toFixed(1)}% (threshold=50%) — consider raising dedup thresholds further or improving prompt diversity`);
    }
    if (finalYieldRate < 0.30 && stats.total > 0) {
      console.warn(`[pipeline] LOW_YIELD=${(finalYieldRate * 100).toFixed(1)}% (threshold=30%) — less than 30 % of generated questions were accepted`);
    }

    console.log(
      `[pipeline] METRICS | generated_count=${stats.total}` +
      ` | prefiltered_count=${balancedQuestions.length}` +
      ` | strict_validation_count=${selectedForValidation.length}` +
      ` | accepted_count=${stats.accepted}` +
      ` | api_calls_used=${stats.apiCallsUsed}` +
      ` | cost_efficiency_ratio=${costEfficiencyRatio.toFixed(2)}`,
    );

    console.log(
      `[pipeline] SUMMARY | subject=${job.subject_id} | chapter=${job.chapter} | target=${targetCount}` +
      ` | generated_count=${stats.total} | batch_duplicates=${stats.duplicates} | cross_job_duplicates=${stats.crossJobDuplicates}` +
      ` | pre_validation_filtered=${stats.preValidationFiltered} | strict_validation_count=${selectedForValidation.length} | validated_count=${validatedQuestions.length}` +
      ` | accepted_count=${stats.accepted} | shortfall=${finalShortfall}` +
      ` | yield_rate=${(finalYieldRate * 100).toFixed(1)}%` +
      ` | retry_count=${stats.retryCount} | api_calls_used=${stats.apiCallsUsed}`,
    );
    console.log(`[pipeline] Accepted difficulty mix: ${formatDifficultyCounts(acceptedQuestions)}`);
    console.log(`[pipeline] subject_distribution: ${JSON.stringify({ subject: job.subject_id, accepted: stats.accepted, rejected: stats.rejected, target: targetCount, met: finalShortfall === 0 })}`);

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
