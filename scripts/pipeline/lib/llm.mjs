import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { getCanonicalUnitForChapter, isValidCanonicalChapter } from '../../../data/canonical_syllabus.js';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const DIFFICULTY_DISTRIBUTION = { easy: 0.10, medium: 0.60, hard: 0.30 };
const MIN_GENERATION_COUNT = 30;
const MAX_GENERATION_COUNT = 50;
const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];
const GENERATION_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite",
];
const VALIDATION_MODELS = [
  "gemini-2.5-flash",
  "gemini-3-flash",
];
const GENERATION_TIMEOUT_MS = 90_000;
const MODEL_COOLDOWN_MIN_MS = 5 * 60_000;
const MODEL_COOLDOWN_JITTER_MS = 5 * 60_000;
const EMPTY_DIAGNOSTICS = Object.freeze({
  rawParsedCount: 0,
  normalizedCount: 0,
  dropReasons: {
    normalization_failed: 0,
    invalid_options_format: 0,
    missing_required_fields: 0,
    validation_failed: 0,
    low_score: 0,
    difficulty_mismatch: 0,
    cuet_alignment_failed: 0,
    chapter_mismatch: 0,
  },
  sampleFailedRawQuestion: null,
  sampleFailedNormalizedAttempt: null,
});
let lastGenerationDiagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
let activeModel = GENERATION_MODELS[0];
const failedModels = new Map();
let activeValidationModel = VALIDATION_MODELS[0];
const failedValidationModels = new Map();

function getPipelineModelAssignmentError() {
  return GENERATION_MODELS.some((model) => VALIDATION_MODELS.includes(model))
    ? { error: 'invalid_pipeline_same_model_used' }
    : null;
}

/**
 * GENERATION ENGINE
 */
export async function generateQuestions(subject, chapter, count = 10) {
  lastGenerationDiagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
  const modelAssignmentError = getPipelineModelAssignmentError();
  if (modelAssignmentError) return modelAssignmentError;

  if (!subject?.id || !isValidCanonicalChapter(subject.id, chapter)) {
    console.warn('[llm] question_rejected_due_to_invalid_mapping', {
      subject: subject?.id || null,
      chapter,
    });
    return [];
  }

  const safeCount = Math.min(Math.max(count, MIN_GENERATION_COUNT), MAX_GENERATION_COUNT);
  if (process.env.MOCK_AI === 'true') {
    const questions = generateMockQuestions(subject, chapter, safeCount);
    lastGenerationDiagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
    lastGenerationDiagnostics.rawParsedCount = questions.length;
    lastGenerationDiagnostics.normalizedCount = questions.length;
    return questions;
  }
  if (genAI) return generateWithGeminiFallback(subject, chapter, safeCount);
  console.error('[llm] stage_failed no_gemini_api_key');
  return { error: 'stage_failed' };
}

export function getLastGenerationDiagnostics() {
  return cloneDiagnostics(lastGenerationDiagnostics);
}

async function generateWithGeminiFallback(subject, chapter, count) {
  const targets = buildDifficultyTargets(count);
  const prompt = buildGenerationPrompt(subject, chapter, count, targets);
  const availableModels = getAvailableGenerationModels();

  for (let modelIndex = 0; modelIndex < availableModels.length; modelIndex += 1) {
    const modelName = availableModels[modelIndex];
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    try {
      console.log(`[llm] active_model=${modelName}`);
      logLlmEvent('active_model', {
        activeModel: modelName,
        stickyModel: activeModel,
        subject: subject.id,
        chapter,
        count,
      });

      const result = await withTimeout(
        model.generateContent(prompt),
        GENERATION_TIMEOUT_MS,
        `timeout after ${GENERATION_TIMEOUT_MS}ms`
      );
      const text = result?.response?.text?.() ?? '';
      if (!String(text).trim()) {
        throw new LlmGenerationError('empty response', 'empty_response');
      }

      console.log(`[llm] Raw Gemini response | model=${modelName}: ${text}`);
      const parsed = parseJsonArrayStrict(text);
      const normalized = normalizeGeneratedQuestions(parsed, subject.id, chapter);
      const diagnostics = getLastGenerationDiagnostics();
      if (diagnostics.dropReasons.chapter_mismatch > 0) {
        throw new LlmGenerationError('chapter mismatch detected; discarded batch for regeneration', 'chapter_mismatch');
      }
      if (normalized.length === 0) {
        throw new LlmGenerationError('empty question array after normalization', 'empty_questions');
      }

      activeModel = modelName;
      failedModels.delete(modelName);
      console.log(`[llm] success ${modelName}`);
      logLlmEvent('success', {
        model: modelName,
        questionCount: normalized.length,
        subject: subject.id,
        chapter,
      });
      return normalized;
    } catch (error) {
      const reason = getLlmFailureReason(error);
      const cooldownUntil = markModelFailed(modelName, reason);
      console.warn(`[llm] failure ${modelName} (${formatFailureReason(error, reason)})`);
      logLlmEvent('model_failure', {
        model: modelName,
        reason,
        message: error.message,
        cooldownUntil: new Date(cooldownUntil).toISOString(),
      }, 'warn');

      const nextModel = availableModels[modelIndex + 1] || getNextAvailableModel(modelName);
      if (nextModel) {
        console.warn(`[llm] switching -> ${nextModel}`);
        logLlmEvent('model_switch', {
          failedModel: modelName,
          nextModel,
          reason,
        }, 'warn');
      }
    }
  }

  lastGenerationDiagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
  logLlmEvent('generation_all_models_failed', {
    models: GENERATION_MODELS,
    subject: subject.id,
    chapter,
    count,
  }, 'error');
  return { error: 'stage_failed' };
}

function getAvailableGenerationModels() {
  clearExpiredModelFailures();
  const ordered = [activeModel, ...GENERATION_MODELS].filter((model, index, array) => (
    GENERATION_MODELS.includes(model) && array.indexOf(model) === index
  ));
  const readyModels = ordered.filter((model) => !failedModels.has(model));
  if (readyModels.length > 0) return readyModels;

  console.warn('[llm] all models in cooldown -> forcing primary retry');
  logLlmEvent('model_switch', {
    reason: 'all_models_in_cooldown_forcing_primary_retry',
    nextModel: GENERATION_MODELS[0],
    failedModels: Object.fromEntries(failedModels),
  }, 'warn');
  return [GENERATION_MODELS[0]];
}

function getNextAvailableModel(currentModel) {
  return getAvailableGenerationModels().find((model) => model !== currentModel) || null;
}

function markModelFailed(modelName, reason) {
  const cooldownMs = getModelCooldownMs(reason);
  const cooldownUntil = Date.now() + cooldownMs;
  failedModels.set(modelName, cooldownUntil);
  if (activeModel === modelName) {
    activeModel = getNextAvailableModel(modelName) || GENERATION_MODELS[0];
  }
  return cooldownUntil;
}

function clearExpiredModelFailures() {
  const now = Date.now();
  for (const [modelName, cooldownUntil] of failedModels.entries()) {
    if (cooldownUntil <= now) failedModels.delete(modelName);
  }
}

function getModelCooldownMs() {
  return MODEL_COOLDOWN_MIN_MS + Math.floor(Math.random() * MODEL_COOLDOWN_JITTER_MS);
}

function getAvailableValidationModels() {
  clearExpiredValidationModelFailures();
  return [activeValidationModel, ...VALIDATION_MODELS].filter((model, index, array) => (
    VALIDATION_MODELS.includes(model) && array.indexOf(model) === index && !failedValidationModels.has(model)
  ));
}

function getNextAvailableValidationModel(currentModel) {
  return getAvailableValidationModels().find((model) => model !== currentModel) || null;
}

function markValidationModelFailed(modelName) {
  const cooldownUntil = Date.now() + getModelCooldownMs();
  failedValidationModels.set(modelName, cooldownUntil);
  if (activeValidationModel === modelName) {
    activeValidationModel = getNextAvailableValidationModel(modelName) || VALIDATION_MODELS[0];
  }
  return cooldownUntil;
}

function clearExpiredValidationModelFailures() {
  const now = Date.now();
  for (const [modelName, cooldownUntil] of failedValidationModels.entries()) {
    if (cooldownUntil <= now) failedValidationModels.delete(modelName);
  }
}

function buildGenerationPrompt(subject, chapter, count, targets) {
  const unit = getCanonicalUnitForChapter(subject.id, chapter);
  return `Generate exactly ${count} CUET-level MCQs as JSON. subject="${subject.name}"(${subject.id}); chapter="${chapter}"; unit="${unit?.unit_name || 'UNKNOWN'}"; difficulty: easy=${targets.easy}, medium=${targets.medium}, hard=${targets.hard}.

DIVERSITY RULES (strictly enforced):
- Every question MUST test a DIFFERENT concept or sub-topic within the chapter
- Vary formats across the set: factual recall, cause-effect, application, numerical, statement-based
- No two questions may share more than 40% of their key words
- Self-check for near-duplicates before outputting — remove any redundant questions
- Each wrong option must be plausible but unambiguously incorrect

Output ONLY valid JSON, no markdown, no extra text:
{"questions":[{"q":"question text","o":["A option","B option","C option","D option"],"a":"A","d":"easy|medium|hard","concept":"unique_concept_tag","explanation":"one sentence"}]}`;

async function generateWithClaude(subject, chapter, count) {
  const targets = buildDifficultyTargets(count);
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      console.log(`[llm] Claude attempt ${attempt + 1}/${RETRY_DELAYS_MS.length} | ${subject.id} | ${chapter} | count=${count}`);
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `
Generate exactly ${count} CUET MCQs for ${subject.name} / ${chapter}.

STRICT CHAPTER LOCKING:
- The chapter provided MUST be used exactly: "${chapter}"
- Do NOT create new chapter names.
- Do NOT modify chapter names.
- Do NOT generalize or infer topics outside the given chapter.
- The "chapter" field in output MUST EXACTLY match the provided chapter string.
- If the question does not fit the chapter, DO NOT generate it.

Difficulty distribution:
- easy: ${targets.easy}
- medium: ${targets.medium}
- hard: ${targets.hard}

Rules:
- easy must still be conceptually meaningful, not trivial
- medium must reflect true CUET level
- hard must be 10-20% above CUET PYQ level
- vary theory, numerical, and application formats
- avoid repetitive templates
- return ONLY a JSON array with no markdown and no extra text
- the entire response must be exactly one JSON array, never multiple root objects
- do not include reasoning, self-corrections, or commentary text

Return only a JSON array with:
subject, chapter, body, options[{key,text}], correct_answer, explanation, difficulty, concept_pattern, tags
          `.trim()
        }]
      });

      const raw = response.content?.[0]?.text ?? '[]';
      console.log(`[llm] Raw Claude response: ${raw}`);
      return normalizeGeneratedQuestions(parseJsonArray(raw), subject.id, chapter);
    } catch (error) {
      const retryable = isRetryableLlmError(error);
      console.warn(`[llm] Claude attempt ${attempt + 1} failed: ${error.message}`);
      if (!retryable || attempt === RETRY_DELAYS_MS.length - 1) {
        console.error(`[llm] Claude final failure for ${subject.id}/${chapter}: ${error.message}`);
        return [];
      }
      console.log(`[llm] Retrying Claude in ${RETRY_DELAYS_MS[attempt]}ms`);
      await delay(RETRY_DELAYS_MS[attempt]);
    }
  }

  return [];
}

function generateMockQuestions(subject, chapter, count) {
  const targets = buildDifficultyTargets(count);
  const sequence = [
    ...Array(targets.easy).fill('easy'),
    ...Array(targets.medium).fill('medium'),
    ...Array(targets.hard).fill('hard'),
  ];

  return sequence.map((difficulty, index) => ({
    subject: subject.id,
    chapter,
    body: `[MOCK ${difficulty.toUpperCase()}] ${chapter} Question ${index + 1}`,
    options: [
      { key: "A", text: "Option A" },
      { key: "B", text: "Option B" },
      { key: "C", text: "Option C" },
      { key: "D", text: "Option D" },
    ],
    correct_answer: "A",
    explanation: "Mock explanation aligned to the chosen difficulty.",
    difficulty,
    concept_pattern: `mock_${difficulty}_${index + 1}`,
    tags: ["mock", "cuet"]
  }));
}

/**
 * VALIDATOR
 * Returns a stricter moderation summary used by the autonomous worker.
 */
export async function validateAndAlign(question, subjectContext) {
  if (process.env.MOCK_AI === 'true') {
    return {
      score: 9,
      decision: "accept",
      difficulty_correct: true,
      cuet_alignment: true,
      recommended_difficulty: question.difficulty || 'medium',
      issues: [],
    };
  }

  if (genAI) {
    const prompt = `VAL CUET MCQ. Return JSON only: {"score":0-10,"difficulty_correct":true,"cuet_alignment":true,"recommended_difficulty":"easy|medium|hard","issues":[],"decision":"accept|reject"}. Check answer, ambiguity, options, chapter. q=${JSON.stringify(compactQuestionForValidation(question))}`;

    const availableModels = getAvailableValidationModels();
    if (availableModels.length === 0) {
      return fallbackValidationResult(question, 'all_validation_models_in_cooldown');
    }

    for (let modelIndex = 0; modelIndex < availableModels.length; modelIndex += 1) {
      const modelName = availableModels[modelIndex];
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      try {
        console.log(`[llm] validation_model_used=${modelName}`);
        logLlmEvent('validation_model_used', {
          model: modelName,
          stickyModel: activeValidationModel,
          subject: subjectContext?.id,
          questionId: question?.id || null,
        });

        const result = await withTimeout(
          model.generateContent(prompt),
          GENERATION_TIMEOUT_MS,
          `validation timeout after ${GENERATION_TIMEOUT_MS}ms`
        );
        const text = result?.response?.text?.() ?? '';
        if (!String(text).trim()) {
          throw new LlmGenerationError('empty validation response', 'empty_response');
        }

        const parsed = parseJsonObjectStrict(text);
        activeValidationModel = modelName;
        failedValidationModels.delete(modelName);
        logLlmEvent('validation_success', {
          model: modelName,
          subject: subjectContext?.id,
        });
        return normalizeValidationResult(parsed, question);
      } catch (error) {
        const reason = getLlmFailureReason(error);
        const cooldownUntil = markValidationModelFailed(modelName, reason);
        console.warn(`[llm] validation_failure_reason ${modelName} (${formatFailureReason(error, reason)})`);
        logLlmEvent('validation_failure_reason', {
          model: modelName,
          reason,
          message: error.message,
          cooldownUntil: new Date(cooldownUntil).toISOString(),
        }, 'warn');

        const nextModel = availableModels[modelIndex + 1] || getNextAvailableValidationModel(modelName);
        if (nextModel) {
          console.warn(`[llm] validation fallback switch -> ${nextModel}`);
          logLlmEvent('validation_fallback_switch', {
            failedModel: modelName,
            nextModel,
            reason,
          }, 'warn');
        }
      }
    }

    return fallbackValidationResult(question, 'skipped_due_to_llm_failure');
  }

  return fallbackValidationResult(question, 'no_validation_model_available');
}

/**
 * BATCH VALIDATOR
 * Validates all questions in a single API call.
 * Returns an array of validation results aligned by index to the input array.
 *
 * Throws BatchValidationIntegrityError if the LLM returns structurally invalid results
 * (count mismatch, missing/duplicate indices). The worker must catch this and retry once.
 * Throws LlmGenerationError if all models fail with API errors.
 * Never silently falls back on integrity failures.
 */
export async function validateAndAlignBatch(questions, subjectContext) {
  if (questions.length === 0) return [];

  if (process.env.MOCK_AI === 'true') {
    return questions.map((question) => ({
      score: 9,
      decision: 'accept',
      difficulty_correct: true,
      cuet_alignment: true,
      recommended_difficulty: question.difficulty || 'medium',
      issues: [],
    }));
  }

  if (!genAI) {
    throw new LlmGenerationError('no_validation_model_available: GEMINI_API_KEY not set', 'no_api_key');
  }

  const compactBatch = questions.map((q, i) => ({ i, ...compactQuestionForValidation(q) }));
  const prompt = `VALIDATE CUET MCQ BATCH. Return a JSON array with EXACTLY ${questions.length} result objects, one per input question, using indices 0 through ${questions.length - 1}. Format: [{"index":0,"score":0-10,"difficulty_correct":true,"cuet_alignment":true,"recommended_difficulty":"easy|medium|hard","issues":[],"decision":"accept|reject"},...]. Check: answer correctness, option quality, no ambiguity, chapter alignment, difficulty accuracy. Return ONLY the JSON array, no markdown. questions=${JSON.stringify(compactBatch)}`;

  const availableModels = getAvailableValidationModels();
  if (availableModels.length === 0) {
    throw new LlmGenerationError('all_validation_models_in_cooldown', 'all_models_failed');
  }

  let lastError = null;

  for (let modelIndex = 0; modelIndex < availableModels.length; modelIndex += 1) {
    const modelName = availableModels[modelIndex];
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    try {
      console.log(`[llm] batch_validation_start | model=${modelName} | count=${questions.length}`);
      logLlmEvent('batch_validation_start', {
        model: modelName,
        subject: subjectContext?.id,
        questionCount: questions.length,
      });

      const result = await withTimeout(
        model.generateContent(prompt),
        GENERATION_TIMEOUT_MS,
        `batch validation timeout after ${GENERATION_TIMEOUT_MS}ms`,
      );
      const text = result?.response?.text?.() ?? '';
      if (!String(text).trim()) {
        throw new LlmGenerationError('empty batch validation response', 'empty_response');
      }

      const parsed = parseJsonArray(text);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new LlmGenerationError('non-array or empty batch validation JSON', 'invalid_json');
      }

      // INTEGRITY CHECK — throws BatchValidationIntegrityError on any structural mismatch.
      // This error is NOT caught below and propagates directly to the worker for retry.
      assertBatchIntegrity(parsed, questions.length, subjectContext?.id, modelName);

      activeValidationModel = modelName;
      failedValidationModels.delete(modelName);
      logLlmEvent('batch_validation_success', {
        model: modelName,
        subject: subjectContext?.id,
        resultCount: parsed.length,
      });

      const resultMap = new Map(parsed.map((r) => [Number(r.index ?? r.i ?? -1), r]));
      return questions.map((q, i) => normalizeValidationResult(resultMap.get(i), q));

    } catch (error) {
      if (error instanceof BatchValidationIntegrityError) {
        // Integrity failures must not be masked by model fallback — let the worker retry
        throw error;
      }
      lastError = error;
      const reason = getLlmFailureReason(error);
      const cooldownUntil = markValidationModelFailed(modelName, reason);
      console.warn(`[llm] batch_validation_failure ${modelName} (${formatFailureReason(error, reason)})`);
      logLlmEvent('batch_validation_failure', {
        model: modelName,
        reason,
        message: error.message,
        cooldownUntil: new Date(cooldownUntil).toISOString(),
      }, 'warn');
    }
  }

  logLlmEvent('batch_validation_all_models_failed', {
    subject: subjectContext?.id,
    questionCount: questions.length,
    lastError: lastError?.message,
  }, 'error');
  throw lastError ?? new LlmGenerationError('batch_validation_all_models_failed', 'all_models_failed');
}

export async function checkSemanticSimilarity(q1, q2) {
  return { similarity: 0.1 };
}

function fallbackValidationResult(question, reason) {
  const basicChecksPass = hasValidQuestionSchema(question);
  console.warn(`[llm] validation skipped_due_to_llm_failure | reason=${reason} | basic_checks=${basicChecksPass}`);
  logLlmEvent('validation_skipped_due_to_llm_failure', {
    reason,
    basicChecksPass,
    difficulty: question?.difficulty || null,
  }, basicChecksPass ? 'warn' : 'error');

  return {
    score: basicChecksPass ? 5.5 : 0,
    decision: basicChecksPass ? 'accept' : 'reject',
    difficulty_correct: true,
    cuet_alignment: basicChecksPass,
    recommended_difficulty: question.difficulty || 'medium',
    validation_confidence: 'low',
    requires_review: true,
    issues: [basicChecksPass
      ? `skipped_due_to_llm_failure:${reason}`
      : `basic_schema_failed_after_llm_failure:${reason}`],
  };
}

function hasValidQuestionSchema(question) {
  if (!question || typeof question !== 'object') return false;
  if (!String(question.body || '').trim()) return false;

  const options = normalizeOptions(question.options);
  if (options.length !== 4) return false;

  const answer = normalizeAnswerKey(question.correct_answer);
  if (!answer) return false;

  return options.some((option) => option.key === answer);
}

function compactQuestionForValidation(question) {
  const options = normalizeOptions(question?.options).map((option) => option.text);
  return {
    q: String(question?.body || question?.q || '').trim(),
    o: options,
    a: normalizeAnswerKey(question?.correct_answer || question?.a),
    d: normalizeDifficulty(question?.difficulty),
    c: String(question?.chapter || '').trim(),
  };
}

function buildDifficultyTargets(count) {
  if (count <= 1) return { easy: 0, medium: count, hard: 0 };

  let easy = Math.max(1, Math.round(count * DIFFICULTY_DISTRIBUTION.easy));
  let medium = Math.max(1, Math.round(count * DIFFICULTY_DISTRIBUTION.medium));
  let hard = count - easy - medium;

  if (hard < 1 && count >= 3) hard = 1;

  while (easy + medium + hard > count) {
    if (medium > 1) medium -= 1;
    else if (easy > 1) easy -= 1;
    else break;
  }

  while (easy + medium + hard < count) {
    medium += 1;
  }

  return { easy, medium, hard };
}

function parseJsonArray(text) {
  const cleaned = sanitizeJsonText(text);
  console.log(`[llm] Cleaned response: ${cleaned}`);

  const direct = tryParseQuestionPayload(cleaned, 'direct');
  if (direct) return direct;

  const arrayCandidate = extractBalancedArray(cleaned);
  if (arrayCandidate) {
    const recoveredArray = tryParseQuestionPayload(arrayCandidate, 'balanced-array');
    if (recoveredArray) return recoveredArray;
  }

  const objectStream = extractTopLevelObjects(cleaned);
  if (objectStream.length > 0) {
    const recoveredObjects = tryParseQuestionPayload(`[${objectStream.join(',')}]`, 'object-stream');
    if (recoveredObjects) return recoveredObjects;
  }

  console.error(`[llm] Failed to parse JSON array. Raw response: ${text}`);
  return [];
}

function parseJsonArrayStrict(text) {
  const parsed = parseJsonArray(text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new LlmGenerationError('invalid JSON or empty question array', 'invalid_json');
  }
  return parsed;
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return {};
  }
}

function parseJsonObjectStrict(text) {
  try {
    const parsed = JSON.parse(String(text || '').replace(/```json|```/g, '').trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('validation response must be a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new LlmGenerationError(`invalid validation JSON: ${error.message}`, 'invalid_json');
  }
}

function normalizeGeneratedQuestions(questions, subjectId, chapter) {
  const parsedQuestions = Array.isArray(questions) ? questions : [];
  const normalizedQuestions = [];
  const diagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
  diagnostics.rawParsedCount = parsedQuestions.length;

  for (let index = 0; index < parsedQuestions.length; index += 1) {
    const question = parsedQuestions[index];

    if (!question || typeof question !== 'object') {
      diagnostics.dropReasons.normalization_failed += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      continue;
    }

    const rawChapter = typeof question.chapter === 'string' ? question.chapter : '';
    if (rawChapter && rawChapter !== chapter) {
      diagnostics.dropReasons.chapter_mismatch += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      console.warn('[llm] chapter_mismatch_detected', {
        expected: chapter,
        received: rawChapter || null,
        subject: subjectId,
        index,
      });
      console.warn('[llm] question_rejected_due_to_wrong_chapter', {
        expected: chapter,
        received: rawChapter || null,
        subject: subjectId,
        index,
      });
      continue;
    }

    const normalized = {
      subject: subjectId,
      chapter,
      body: String(question.body || question.q || '').trim(),
      options: normalizeOptions(question.options || question.o),
      correct_answer: normalizeAnswerKey(question.correct_answer || question.a),
      explanation: String(question.explanation || '').trim(),
      difficulty: normalizeDifficulty(question.difficulty),
      concept_pattern: String(question.concept_pattern || `concept_${index + 1}`).trim(),
      tags: normalizeTags(question.tags),
    };

    if (!normalized.body || !normalized.correct_answer) {
      diagnostics.dropReasons.missing_required_fields += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      diagnostics.sampleFailedNormalizedAttempt ||= normalized;
      continue;
    }

    if (normalized.options.length !== 4) {
      diagnostics.dropReasons.invalid_options_format += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      diagnostics.sampleFailedNormalizedAttempt ||= normalized;
      continue;
    }

    normalizedQuestions.push(normalized);
  }

  diagnostics.normalizedCount = normalizedQuestions.length;
  lastGenerationDiagnostics = diagnostics;
  return normalizedQuestions;
}

function normalizeValidationResult(result, question) {
  const score = Number.isFinite(Number(result.score)) ? Number(result.score) : 0;
  const difficultyCorrect = result.difficulty_correct !== false;
  const cuetAlignment = result.cuet_alignment !== false;
  const recommendedDifficulty = normalizeDifficulty(result.recommended_difficulty || question.difficulty);
  const issues = Array.isArray(result.issues) ? result.issues.map(String) : [];

  const shouldReject =
    score < 7 ||
    !difficultyCorrect ||
    !cuetAlignment ||
    String(result.decision || '').toLowerCase() === 'reject';

  return {
    score,
    decision: shouldReject ? 'reject' : 'accept',
    difficulty_correct: difficultyCorrect,
    cuet_alignment: cuetAlignment,
    recommended_difficulty: recommendedDifficulty,
    issues,
  };
}

function normalizeOptions(options) {
  const normalized = [];

  if (options && !Array.isArray(options) && typeof options === 'object') {
    for (const [key, value] of Object.entries(options)) {
      const normalizedKey = normalizeAnswerKey(key);
      const text = String(value || '').trim();
      if (normalizedKey && text) {
        normalized.push({ key: normalizedKey, text });
      }
    }
  }

  if (Array.isArray(options)) {
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      if (typeof option === 'string') {
        const normalizedKey = ['A', 'B', 'C', 'D'][index] || '';
        const text = option.trim();
        if (normalizedKey && text) {
          normalized.push({ key: normalizedKey, text });
        }
        continue;
      }

      if (!option || typeof option !== 'object') continue;

      if ('key' in option || 'text' in option) {
        const normalizedKey = normalizeAnswerKey(option?.key);
        const text = String(option?.text || '').trim();
        if (normalizedKey && text) {
          normalized.push({ key: normalizedKey, text });
        }
        continue;
      }

      const entries = Object.entries(option);
      if (entries.length !== 1) continue;
      const [key, value] = entries[0];
      const normalizedKey = normalizeAnswerKey(key);
      const text = String(value || '').trim();
      if (normalizedKey && text) {
        normalized.push({ key: normalizedKey, text });
      }
    }
  }

  return normalized
    .filter((option, index, array) => option.key && option.text && array.findIndex((entry) => entry.key === option.key) === index)
    .sort((a, b) => 'ABCD'.indexOf(a.key) - 'ABCD'.indexOf(b.key))
    .slice(0, 4);
}

function normalizeAnswerKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(key) ? key : '';
}

function normalizeDifficulty(value) {
  const difficulty = String(value || '').trim().toLowerCase();
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
}

function normalizeTags(tags) {
  const normalized = Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];

  return Array.from(new Set(['cuet', ...normalized]));
}

function isRetryableLlmError(error) {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  return status === 429 || status === 503 || message.includes('429') || message.includes('503') || message.includes('rate limit') || message.includes('quota') || message.includes('high demand') || message.includes('overloaded') || message.includes('unavailable');
}

function getLlmFailureReason(error) {
  if (error instanceof LlmGenerationError) return error.reason;
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  if (status === 404 || message.includes('404') || message.includes('not found')) return 'invalid_model';
  if (status === 429 || message.includes('429') || message.includes('rate limit') || message.includes('quota')) return 'rate_limit';
  if (status === 503 || message.includes('503') || message.includes('unavailable') || message.includes('overloaded')) return 'service_unavailable';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('json')) return 'invalid_json';
  return 'transient_failure';
}

function formatFailureReason(error, reason) {
  const status = error?.status || error?.statusCode || error?.code;
  if (status) return status;
  return reason;
}

function logLlmEvent(event, payload, level = 'log') {
  const entry = {
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const line = `[llm] ${JSON.stringify(entry)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new LlmGenerationError(message, 'timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

class LlmGenerationError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'LlmGenerationError';
    this.reason = reason;
  }
}

class BatchValidationIntegrityError extends Error {
  constructor(message, reason) {
    super(message);
    this.name = 'BatchValidationIntegrityError';
    this.reason = reason;
  }
}

/**
 * Throws BatchValidationIntegrityError if the parsed batch results are structurally
 * inconsistent with the input: wrong count, out-of-range index, or duplicate index.
 * Called immediately after JSON parse — before any result is trusted.
 */
function assertBatchIntegrity(results, expectedCount, subjectId, modelName) {
  if (results.length !== expectedCount) {
    logLlmEvent('batch_validation_integrity_failure', {
      model: modelName,
      subject: subjectId,
      expectedCount,
      receivedCount: results.length,
      reason: 'count_mismatch',
    }, 'error');
    throw new BatchValidationIntegrityError(
      `received ${results.length} results for ${expectedCount} questions`,
      'count_mismatch',
    );
  }

  const seenIndices = new Set();
  for (const r of results) {
    const idx = Number(r.index ?? r.i ?? -1);
    if (!Number.isInteger(idx) || idx < 0 || idx >= expectedCount) {
      throw new BatchValidationIntegrityError(
        `out-of-range index ${idx} (valid range 0–${expectedCount - 1})`,
        'invalid_index',
      );
    }
    if (seenIndices.has(idx)) {
      throw new BatchValidationIntegrityError(
        `duplicate index ${idx} in batch validation results`,
        'duplicate_index',
      );
    }
    seenIndices.add(idx);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeJsonText(text) {
  return String(text || '')
    .replace(/```json|```/gi, '')
    .replace(/^[^{\[]*?(?=[{\[])/s, '')
    .replace(/\u0000/g, '')
    .trim();
}

function tryParseQuestionPayload(candidate, method) {
  try {
    const parsed = JSON.parse(candidate);
    const normalized = normalizeQuestionPayload(parsed);
    if (normalized.length > 0) {
      console.log(`[llm] JSON recovery used: ${method}`);
      console.log(`[llm] Parsed question count: ${normalized.length}`);
      return normalized;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeQuestionPayload(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((entry) => entry && typeof entry === 'object');
  if (Array.isArray(parsed?.questions)) return parsed.questions.filter((entry) => entry && typeof entry === 'object');
  if (Array.isArray(parsed?.data)) return parsed.data.filter((entry) => entry && typeof entry === 'object');
  if (parsed && typeof parsed === 'object' && parsed.body) return [parsed];
  return [];
}

function extractBalancedArray(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

function extractTopLevelObjects(text) {
  const objects = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function cloneDiagnostics(source) {
  return {
    rawParsedCount: source.rawParsedCount,
    normalizedCount: source.normalizedCount,
    dropReasons: { ...source.dropReasons },
    sampleFailedRawQuestion: source.sampleFailedRawQuestion,
    sampleFailedNormalizedAttempt: source.sampleFailedNormalizedAttempt,
  };
}
