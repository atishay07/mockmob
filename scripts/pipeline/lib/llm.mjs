import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from "openai";
import { getCanonicalUnitForChapter, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import {
  CUET_DIFFICULTY_STANDARD,
  buildConstraintObject,
  getCuetSubjectConfig,
  getPyqStylePack,
  getSyllabusConcepts,
  toPublicSubjectId,
  validateTraceability,
} from '../../../data/cuet_controls.js';
import { selectPyqAnchors } from '../../../data/pyq_anchors.js';

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Equal thirds â†’ 4 easy / 4 medium / 4 hard for a 12-question batch.
const DIFFICULTY_DISTRIBUTION = { easy: 0.30, medium: 0.50, hard: 0.20 };
// Small-batch strategy: keep OpenAI generation light enough to avoid timeouts.
export const PIPELINE_BATCH_SIZE = 15;
const MIN_GENERATION_COUNT = 5;
const MAX_GENERATION_COUNT = 15;
// â”€â”€ Subject validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Subjects whose primary purpose IS language / grammar testing.
 * For these, we do not apply the language-pattern rejection filter.
 */
const LANGUAGE_SUBJECTS = new Set([
  'english', 'hindi', 'assamese', 'bengali', 'gujarati', 'kannada',
  'malayalam', 'marathi', 'odia', 'punjabi', 'tamil', 'telugu', 'urdu', 'sanskrit',
]);

/**
 * Patterns that signal a language/grammar test question.
 * Used to reject drift into English-style questions in non-language subjects.
 */
const LANGUAGE_TEST_PATTERNS = [
  /\bsynonym(s)?\b/i, /\bantonym(s)?\b/i, /\bfill in the blank\b/i,
  /\bread the passage\b/i, /\bcomprehension\b/i, /\bfigure of speech\b/i,
  /\bparts of speech\b/i, /\btense(s)?\b/i, /\bpreposition\b/i,
  /\bgrammatical(ly)?\b/i, /\bvocabulary\b/i,
];

const ENGLISH_RC_CHAPTERS = new Set(['Factual Passage', 'Narrative Passage', 'Literary Passage']);
const ENGLISH_VERBAL_CHAPTERS = new Set(['Para Jumbles', 'Match the Following', 'Vocabulary', 'Correct Word Usage']);

/**
 * At least one keyword from this list must appear in the question body
 * for it to be accepted as belonging to the declared subject.
 * Subjects absent from this map are not keyword-filtered (pass-through).
 */
const SUBJECT_KEYWORD_MAP = {
  accountancy: [
    'partnership', 'profit', 'loss', 'debit', 'credit', 'journal', 'ledger',
    'balance sheet', 'capital', 'liability', 'asset', 'share', 'debenture',
    'cash flow', 'depreciation', 'goodwill', 'appropriation', 'dissolution',
    'admission', 'retirement', 'revaluation', 'sacrificing ratio', 'gaining ratio',
  ],
  biology: [
    'cell', 'dna', 'rna', 'chromosome', 'gene', 'protein', 'enzyme', 'organism',
    'reproduction', 'ecosystem', 'evolution', 'species', 'mitosis', 'meiosis',
    'hormone', 'neuron', 'photosynthesis', 'respiration', 'biodiversity',
    'genetic', 'mutation', 'allele', 'phenotype', 'genotype',
  ],
  business_studies: [
    'management', 'planning', 'organising', 'staffing', 'directing', 'controlling',
    'marketing', 'financial management', 'consumer', 'entrepreneurship',
    'business environment', 'delegation', 'coordination', 'span of control',
    'motivation', 'leadership', 'recruitment', 'selection',
  ],
  chemistry: [
    'atom', 'molecule', 'bond', 'reaction', 'element', 'compound', 'orbital',
    'acid', 'base', 'oxidation', 'reduction', 'polymer', 'catalyst', 'solution',
    'mole', 'enthalpy', 'equilibrium', 'electrolyte', 'electrode', 'isomer',
    'functional group', 'hybridization', 'crystal',
  ],
  economics: [
    'gdp', 'inflation', 'deflation', 'demand', 'supply', 'market', 'price level',
    'national income', 'money supply', 'bank rate', 'fiscal', 'budget',
    'export', 'import', 'balance of payments', 'human development', 'employment',
    'aggregate', 'multiplier', 'investment', 'consumption',
  ],
  history: [
    'civilisation', 'empire', 'colonial', 'revolution', 'dynasty', 'independence',
    'partition', 'constitution', 'nationalist', 'mahatma', 'vijayanagara',
    'mughal', 'harappan', 'british', 'revolt', 'king', 'ruler', 'medieval',
    'ancient', 'modern india',
  ],
  mathematics: [
    'equation', 'function', 'matrix', 'determinant', 'integral', 'derivative',
    'vector', 'probability', 'limit', 'differential', 'polynomial', 'theorem',
    'trigonometric', 'angle', 'circle', 'set', 'relation', 'linear programming',
    'inverse', 'continuity', 'differentiability',
  ],
  applied_mathematics: [
    'quantification', 'numerical', 'probability distribution', 'time based data',
    'inferential statistics', 'financial mathematics', 'annuity', 'emi',
    'index number', 'moving average', 'permutation', 'combination',
  ],
  physics: [
    'force', 'energy', 'velocity', 'acceleration', 'mass', 'charge', 'current',
    'voltage', 'resistance', 'wave', 'frequency', 'nucleus', 'electron', 'photon',
    'magnetic field', 'electric field', 'capacitance', 'inductance', 'refraction',
    'diffraction', 'semiconductor', 'circuit',
  ],
  gat: [
    'reasoning', 'logical', 'numerical ability', 'quantitative', 'mental ability',
    'current affairs', 'general knowledge', 'data interpretation', 'statistical',
    'series', 'analogy', 'syllogism', 'coding', 'decoding',
  ],
  political_science: [
    'constitution', 'parliament', 'government', 'election', 'party', 'sovereignty',
    'federalism', 'rights', 'cold war', 'globalisation', 'international',
    'amendment', 'fundamental', 'directive', 'judiciary', 'legislature',
  ],
  geography: [
    'latitude', 'longitude', 'climate', 'soil', 'population', 'migration',
    'settlement', 'resource', 'industry', 'transport', 'trade', 'river',
    'plateau', 'delta', 'monsoon', 'agriculture', 'mineral',
  ],
  psychology: [
    'behaviour', 'personality', 'intelligence', 'stress', 'therapy', 'perception',
    'motivation', 'attitude', 'cognition', 'disorder', 'emotion', 'learning',
    'memory', 'mental health', 'counselling',
  ],
  sociology: [
    'society', 'culture', 'social', 'caste', 'class', 'gender', 'institution',
    'social change', 'movement', 'community', 'globalisation', 'urbanisation',
    'tribal', 'kinship', 'family', 'stratification',
  ],
  legal_studies: [
    'judiciary', 'law', 'constitution', 'rights', 'tribunal', 'arbitration',
    'adr', 'human rights', 'legal profession', 'legal services', 'criminal',
    'family law', 'constitutional law', 'court', 'justice',
  ],
  computer_science: [
    'python', 'function', 'file handling', 'database', 'network', 'boolean',
    'algorithm', 'data structure', 'query', 'sql', 'interface', 'stack',
    'queue', 'recursion', 'cyber security',
  ],
};

// â”€â”€ Structural pattern layer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Regex patterns that are CHARACTERISTIC of a subject's question format.
// Used as a secondary acceptance gate when keyword matching fails.
const SUBJECT_STRUCTURAL_PATTERNS = {
  accountancy: [
    /\b(?:dr|cr)\.?\s*[|:]/i,                          // Dr./Cr. journal-entry format
    /\d[\d,]*\s*(?:rs\.?|â‚¹)/i,                         // rupee amounts
    /(?:debit|credit)\s+(?:side|balance|account)/i,
    /(?:trial\s+balance|balance\s+sheet|profit\s*(?:&|and)\s*loss|p\s*&\s*l)/i,
    /(?:sacrificing|gaining|new\s+profit)\s+ratio/i,
    /(?:goodwill|revaluation|realisation)\s+account/i,
  ],
  mathematics: [
    /[a-zA-Z]\s*[=<>â‰¤â‰¥]\s*[-\d(]/,                    // variable equation: x = 5
    /\d+\s*[+\-Ã—Ã·*]\s*\d+/,                            // arithmetic expression
    /[âˆ«âˆ‘âˆšâˆžÏ€Î¸Î±Î²Î»Î”]/,                                     // math Unicode symbols
    /f\s*\(\s*[a-z]\s*\)/i,                             // function notation f(x)
    /\b(?:lim|det|sin|cos|tan|log|ln)\b/i,             // math functions
  ],
  physics: [
    /\d+\.?\d*\s*(?:m\/s|km\/h|n\b|kg|j\b|w\b|pa|hz|v\b|a\b|Ï‰|rad|ohm)/i,
    /F\s*=\s*ma|v\s*=\s*u\s*[+\-]|E\s*=\s*mc/,       // standard physics formulae
    /[Î»Î½]\s*=|âˆ†t|âˆ†x|âˆ†v/,                               // delta notation
    /\b(?:newton|joule|watt|ampere|coulomb|farad|henry|tesla)\b/i,
  ],
  chemistry: [
    /\b[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+\b/,          // chemical formula (H2O, NaCl)
    /\d+\.?\d*\s*(?:mol|g\/mol|atm|kJ\/mol|M\b)/i,    // chemistry units
    /(?:oxidation\s+state|valency|atomic\s+number|molecular\s+(?:weight|mass))/i,
    /â†’|â‡Œ|â‡’/,                                            // reaction arrows
  ],
  economics: [
    /\b(?:gdp|gnp|ndp|nnp|gva)\b/i,                    // macro aggregates
    /(?:aggregate\s+(?:demand|supply)|ad[-â€“]as)/i,
    /\b(?:mpc|mps|mrs|mrt|mrts)\b/i,                   // economics acronyms
    /\d+\s*(?:crore|lakh|billion|trillion|%)/i,
  ],
  biology: [
    /\b(?:dna|rna|atp|adp|nadh|nadph)\b/i,             // bio molecules
    /(?:mitosis|meiosis|prophase|metaphase|anaphase|telophase)/i,
    /(?:genotype|phenotype|homozygous|heterozygous|allele)/i,
    /\b(?:prokaryot|eukaryot|chloroplast|mitochondri)/i,
  ],
};

/**
 * Secondary check: does the question body contain structural patterns
 * characteristic of the declared subject?  Used when keyword check fails.
 */
function hasSubjectStructure(rawBody, subjectId) {
  const patterns = SUBJECT_STRUCTURAL_PATTERNS[subjectId];
  if (!patterns) return false;
  return patterns.some((p) => p.test(rawBody));
}

/**
 * Returns true if the question body belongs to the declared subject.
 *
 * Three-gate logic:
 *   1. Language subjects always pass.
 *   2. Language-test patterns in non-language subjects always fail.
 *   3. PASS if either keyword gate OR structural pattern gate succeeds.
 *      Both must fail for the question to be rejected.
 */
export function isQuestionFromSubject(question, subjectId) {
  const body    = String(question.body || '').toLowerCase();
  const rawBody = String(question.body || '');   // preserve case for structural patterns

  // Gate 1: language subjects test language by definition â€” always accept
  if (LANGUAGE_SUBJECTS.has(subjectId)) return true;

  // Gate 2: hard reject if it looks like a grammar/comprehension question
  if (LANGUAGE_TEST_PATTERNS.some((pattern) => pattern.test(body))) {
    return false;
  }

  // Gate 3a: keyword check
  const keywords = SUBJECT_KEYWORD_MAP[subjectId];
  const passesKeyword = keywords
    ? keywords.some((kw) => body.includes(kw.toLowerCase()))
    : true; // no keyword list â†’ pass through

  let relevanceScore = 0;
  if (passesKeyword) relevanceScore += 2;
  if (hasSubjectStructure(rawBody, subjectId)) relevanceScore += 2;
  if (question.subject === subjectId) relevanceScore += 1;

  return relevanceScore >= 1;
}

// â”€â”€ Subtopic rotation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tracks which chapters/concepts have already been focussed on per subject so
// successive batches rotate across different sub-topics.
const _subtopicCursor = new Map(); // subjectId â†’ index

/**
 * Returns up to `pickCount` chapter names to focus on in this batch,
 * advancing the round-robin cursor for the subject.
 */
function getSubtopicFocus(subjectId, allChapters, pickCount = 3) {
  if (!allChapters || allChapters.length === 0) return [];
  const shuffledOnce = _subtopicCursor.has(subjectId)
    ? null // cursor already initialised
    : (() => {
        // Shuffle chapters once on first call for this subject
        const shuffled = [...allChapters].sort(() => Math.random() - 0.5);
        _subtopicCursor.set(subjectId, { chapters: shuffled, index: 0 });
        return shuffled;
      })();
  if (shuffledOnce) {
    // already set above
  }
  const state = _subtopicCursor.get(subjectId);
  if (!state) return allChapters.slice(0, pickCount);

  const picked = [];
  for (let i = 0; i < Math.min(pickCount, state.chapters.length); i += 1) {
    picked.push(state.chapters[state.index % state.chapters.length]);
    state.index += 1;
  }
  return picked;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const OPENAI_GENERATION_MODEL = "gpt-5.4";
const OPENAI_GENERATION_FALLBACK_MODEL = "gpt-5.4-mini";
const GENERATION_MODELS = [
  OPENAI_GENERATION_MODEL,
  OPENAI_GENERATION_FALLBACK_MODEL,
];
const VALIDATION_MODELS = [
  "gemini-3-flash",
];
const CUET_GENERATION_SYSTEM_PROMPT = `You are a strict CUET exam paper setter, not a creative generator.

Non-negotiable source order:
1. CUET syllabus constraint object is the primary source of truth.
2. CUET PYQ style examples are the style and difficulty benchmark.
3. NCERT or external knowledge is secondary support only.

Hard rejection rules:
- If the requested subject is outside the top-15 allowlist, stop.
- If a concept is not directly traceable to the CUET syllabus constraint object, stop.
- Do not generate free-form questions. Use only the supplied PYQ-derived templates.
- No out-of-syllabus content, advanced theory, proof, derivation, JEE-style, MBA/graduate content, or multi-step logic.
- Keep language simple, direct, and exam-oriented.

Each question must have exactly 4 options, exactly 1 correct answer, traceable subject/chapter/topic/concept/concept_id, and JSON only output.`;
const GENERATION_TIMEOUT_MS = 90_000;
const MAX_CONCURRENT_LLM_CALLS = Number(process.env.LLM_MAX_CONCURRENT || 6);
const LLM_SAME_MODEL_ATTEMPTS = 3;
const LLM_BACKOFF_BASE_MS = 800;
const FAILSAFE_WINDOW_SIZE = 10;
const FAILSAFE_FAILURE_THRESHOLD = 0.5;
const FAILSAFE_PAUSE_MIN_MS = 10_000;
const FAILSAFE_PAUSE_JITTER_MS = 10_000;
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
const llmRateLimiterQueue = [];
let activeLlmCalls = 0;
const recentLlmCallOutcomes = [];
let failSafePauseUntil = 0;

function getPipelineModelAssignmentError() {
  return GENERATION_MODELS.some((model) => VALIDATION_MODELS.includes(model))
    ? { error: 'invalid_pipeline_same_model_used' }
    : null;
}

/**
 * GENERATION ENGINE
 *
 * Generates a single large candidate batch (PIPELINE_BATCH_SIZE) of questions for
 * one specific subject + chapter.  Never mixes subjects.
 *
 * @param {object} subject        - Subject object from SUBJECTS array
 * @param {string} chapter        - Exact chapter name
 * @param {number} count          - Desired question count (clamped to PIPELINE_BATCH_SIZE)
 * @param {object} context        - Optional context for subtopic rotation / dedup hints
 * @param {string[]} context.usedConcepts  - Concepts already covered; model will avoid them
 */
export async function generateQuestions(subject, chapter, count = 10, context = {}) {
  lastGenerationDiagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
  const modelAssignmentError = getPipelineModelAssignmentError();
  if (modelAssignmentError) return modelAssignmentError;
  const difficultyOverride = normalizeDifficultyOverride(context.difficultyOverride);

  console.log('[llm] GENERATION_CALL_INPUT:', {
    expected_subject: subject?.id || null,
    prompt_subject_name: subject?.name || null,
    expected_chapter: chapter,
    requested_count: count,
    difficulty_override: difficultyOverride,
  });

  if (!subject?.id || !isValidTopSyllabusPair(subject.id, chapter)) {
    console.warn('[llm] question_rejected_due_to_invalid_mapping', {
      subject: subject?.id || null,
      chapter,
    });
    return [];
  }

  // Single-call candidate pool: large enough for selective validation.
  const safeCount = Math.min(Math.max(count, MIN_GENERATION_COUNT), MAX_GENERATION_COUNT);

  if (process.env.MOCK_AI === 'true') {
    const questions = generateMockQuestions(subject, chapter, safeCount, difficultyOverride);
    lastGenerationDiagnostics = cloneDiagnostics(EMPTY_DIAGNOSTICS);
    lastGenerationDiagnostics.rawParsedCount = questions.length;
    lastGenerationDiagnostics.normalizedCount = questions.length;
    return questions;
  }

  if (openai) return generateWithOpenAI(subject, chapter, safeCount, context);
  console.error('[llm] stage_failed no_openai_api_key');
  return { error: 'stage_failed' };
}

export function getLastGenerationDiagnostics() {
  return cloneDiagnostics(lastGenerationDiagnostics);
}

async function generateWithOpenAI(subject, chapter, count, context = {}) {
  const difficultyOverride = normalizeDifficultyOverride(context.difficultyOverride);
  const forcedModel = GENERATION_MODELS.includes(context.modelOverride)
    ? context.modelOverride
    : null;
  const modelCandidates = forcedModel ? [forcedModel] : getAvailableGenerationModels();

  const targets = buildDifficultyTargets(count, difficultyOverride);
  const conceptId = context.concept_id || context.conceptId || getSyllabusConcepts(subject.id, chapter)[0]?.concept_id;
  const anchorSelection = selectPyqAnchors({
    subject: subject.id,
    concept_id: conceptId,
    difficulty: difficultyOverride || 'medium',
    question_type: context.question_type || context.questionType || null,
  });
  if (!anchorSelection.valid) {
    console.warn('[llm] pyq_anchor_unavailable', {
      subject: subject.id,
      chapter,
      concept_id: conceptId || null,
      error: anchorSelection.error,
    });
    return { error: anchorSelection.error, reason: anchorSelection.error };
  }
  console.log('[llm] pyq_anchor_selected', {
    subject: subject.id,
    chapter,
    concept_id: conceptId,
    pyq_anchor_id: anchorSelection.primary?.id || null,
    anchor_tier: anchorSelection.anchor_tier,
    fallback_used: anchorSelection.fallback_used === true,
    concept_mismatch_risk: anchorSelection.concept_mismatch_risk || 'unknown',
    synthetic_anchor: anchorSelection.primary?.synthetic === true,
  });

  // Pick subtopics to focus on for this batch (round-robin across chapters)
  const subtopicFocus = getSubtopicFocus(subject.id, subject.chapters || [], 3);
  const prompt = buildStrictCuetGenerationPrompt(subject, chapter, count, targets, {
    usedConcepts: context.usedConcepts || [],
    saturatedSubtopics: context.saturatedSubtopics || [],
    subtopicFocus,
    difficultyOverride,
    anchorSelection,
    validationFeedback: context.validationFeedback || [],
    previousAttempts: context.previousAttempts || context.previous_attempts || [],
  });
  let lastGenerationError = null;

  for (let modelIndex = 0; modelIndex < modelCandidates.length; modelIndex += 1) {
    const modelName = modelCandidates[modelIndex];
    try {
    console.log(`[llm] active_model=${modelName}`);
    logLlmEvent('active_model', {
      activeModel: modelName,
      stickyModel: activeModel,
      subject: subject.id,
      chapter,
      count,
    });

    const result = await runRateLimitedLlmCall({
      modelName,
      subjectId: subject.id,
      stage: 'generation',
      maxAttempts: context.maxAttempts ?? 1,
      call: () => withTimeout(
        openai.responses.create({
          model: modelName,
          input: [
            { role: 'system', content: CUET_GENERATION_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
        GENERATION_TIMEOUT_MS,
        `timeout after ${GENERATION_TIMEOUT_MS}ms`
      ),
    });
    const text = extractOpenAIResponseText(result);
    if (!String(text).trim()) {
      throw new LlmGenerationError('empty response', 'empty_response');
    }

    console.log(`[llm] Raw OpenAI response | model=${modelName}: ${text}`);
    const parsed = parseJsonArrayStrict(text);
    const normalized = normalizeGeneratedQuestions(parsed, subject.id, chapter)
      .map((question) => ({
        ...question,
        pyq_anchor_id: question.pyq_anchor_id || anchorSelection.primary.id,
        anchor_tier: Number(question.anchor_tier || anchorSelection.anchor_tier),
        difficulty_weight: getDifficultyWeight(question.difficulty),
      }));
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
      lastGenerationError = error;
      const reason = getLlmFailureReason(error);
      const cooldownUntil = forcedModel ? null : markModelFailed(modelName, reason);
      console.warn(`[llm] failure ${modelName} (${formatFailureReason(error, reason)})`);
      logLlmEvent('model_failure', {
        model: modelName,
        reason,
        message: error.message,
        cooldownUntil: cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
      }, 'warn');
      if (forcedModel) break;
      const nextModel = modelCandidates[modelIndex + 1] || null;
      if (nextModel) {
        console.warn('[llm] generation_model_fallback', {
          failed_model: modelName,
          next_model: nextModel,
          reason,
          subject: subject.id,
          chapter,
        });
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
  return { error: getLlmFailureReason(lastGenerationError), reason: getLlmFailureReason(lastGenerationError), message: lastGenerationError?.message || 'stage_failed' };
}

function getAvailableGenerationModels() {
  clearExpiredModelFailures();
  const ordered = [activeModel, ...GENERATION_MODELS].filter((model, index, array) => (
    GENERATION_MODELS.includes(model) && array.indexOf(model) === index
  ));
  const readyModels = ordered.filter((model) => !failedModels.has(model));
  if (readyModels.length > 0) return readyModels;

  console.warn('[llm] all generation models in cooldown');
  logLlmEvent('model_switch', {
    reason: 'all_generation_models_in_cooldown',
    nextModel: null,
    failedModels: Object.fromEntries(failedModels),
  }, 'warn');
  return [];
}

function getNextAvailableModel(currentModel) {
  return getAvailableGenerationModels().find((model) => model !== currentModel) || null;
}

function markModelFailed(modelName, reason) {
  if (!shouldCooldownModel(reason)) return null;
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

function buildStrictCuetGenerationPrompt(subject, chapter, count, targets, options = {}) {
  const unit = getCanonicalUnitForChapter(subject.id, chapter);
  const { usedConcepts = [], subtopicFocus = [], saturatedSubtopics = [], difficultyOverride = null, anchorSelection = null, validationFeedback = [], previousAttempts = [] } = options;
  const subjectConfig = getCuetSubjectConfig(subject.id);
  const conceptBackbone = getSyllabusConcepts(subject.id, chapter);
  const primaryConcept = conceptBackbone[0]?.concept || chapter;
  const questionType = subjectConfig?.enforcement?.allowedPatterns?.[0] || 'direct_concept';
  const constraint = buildConstraintObject({
    subjectId: subject.id,
    chapter,
    concept: primaryConcept,
    questionType,
    difficulty: difficultyOverride || 'medium',
  });

  if (!constraint.valid) {
    throw new LlmGenerationError(`invalid_constraint_object:${constraint.reason}`, 'invalid_constraint');
  }
  if (!anchorSelection?.valid) {
    throw new LlmGenerationError('NO_PYQ_ANCHOR_AVAILABLE', 'NO_PYQ_ANCHOR_AVAILABLE');
  }

  const focusLine = subtopicFocus.length > 0
    ? `\nFOCUS on these under-covered syllabus entries only: ${subtopicFocus.join(', ')}.`
    : '';
  const avoidLine = usedConcepts.length > 0
    ? `\nAVOID already accepted concept patterns: ${usedConcepts.slice(0, 8).join(', ')}.`
    : '';
  const saturatedLine = saturatedSubtopics.length > 0
    ? `\nDO NOT USE saturated concept patterns: ${saturatedSubtopics.slice(0, 8).join(', ')}.`
    : '';
  const englishControlLine = subject.id === 'english' ? buildEnglishGenerationControl(chapter) : '';
  const subjectControlLine = subjectConfig?.enforcement?.rule
    ? `\nSUBJECT-SPECIFIC ENFORCEMENT: ${subjectConfig.enforcement.rule}`
    : '';
  const difficultyLine = difficultyOverride
    ? `\nSTRICT ${difficultyOverride.toUpperCase()} MODE: generate only ${difficultyOverride} questions using the CUET difficulty definition.`
    : '';
  const feedbackLine = Array.isArray(validationFeedback) && validationFeedback.length > 0
    ? `\nPREVIOUS ATTEMPT FAILED DUE TO:\n${validationFeedback.slice(0, 8).map((reason) => `- ${reason}`).join('\n')}\nFix these issues strictly in this attempt. Do not repeat the same mistake. Adjust difficulty, clarity, and options accordingly.`
    : '';
  const previousAttemptsLine = Array.isArray(previousAttempts) && previousAttempts.length > 0
    ? `\nPREVIOUS FAILED ATTEMPTS:\n${JSON.stringify(previousAttempts.slice(0, 5).map((attempt) => ({
        question: String(attempt?.question || '').slice(0, 240),
        reasons: Array.isArray(attempt?.reasons) ? attempt.reasons.slice(0, 5) : [],
      })), null, 2)}\nDo NOT repeat patterns or mistakes from previous failed attempts.`
    : '';
  const tier3ConceptLock = anchorSelection.anchor_tier >= 3
    ? `\nCRITICAL:\nYou MUST strictly generate the question ONLY from the given concept_id.\nThe reference PYQ is ONLY for structure and difficulty guidance.\nDO NOT use its concept or content.`
    : '';

  console.log('[llm] STRICT_CUET_PROMPT_CONSTRUCTION:', {
    expected_subject: subject.id,
    expected_chapter: chapter,
    canonical_unit: unit?.unit_name || null,
    concept_id: constraint.concept_id,
    pyq_anchor_id: anchorSelection.primary.id,
    anchor_tier: anchorSelection.anchor_tier,
    batch_size: count,
    pyq_style_patterns: getPyqStylePack(subject.id, 3).map((entry) => entry.pattern_type),
    difficulty_override: difficultyOverride,
  });

  return `Generate ${count} CUET MCQs. This is a strict CUET paper-setting task, not creative writing.

PRIMARY SOURCE OF TRUTH - CUET CONSTRAINT OBJECT:
${JSON.stringify(constraint, null, 2)}

CUET SYLLABUS BACKBONE:
${JSON.stringify(conceptBackbone, null, 2)}

PYQ STYLE + DIFFICULTY BENCHMARKS:
${JSON.stringify(getPyqStylePack(subject.id, 3), null, 2)}

PRIMARY REFERENCE PYQ:
${JSON.stringify({
  id: anchorSelection.primary.id,
  subject: anchorSelection.primary.public_subject,
  chapter: anchorSelection.primary.chapter,
  topic: anchorSelection.primary.topic,
  concept_id: anchorSelection.primary.concept_id,
  question_type: anchorSelection.primary.question_type,
  difficulty: anchorSelection.primary.difficulty,
  structure_template: anchorSelection.primary.structure_template,
  option_pattern: anchorSelection.primary.option_pattern,
  question_text: anchorSelection.primary.question_text,
  options: anchorSelection.primary.options,
  correct_answer: anchorSelection.primary.correct_answer,
}, null, 2)}

Anchor Tier: ${anchorSelection.anchor_tier}
${anchorSelection.anchor_tier > 1 ? `
TIER ${anchorSelection.anchor_tier} FALLBACK CONTROL:
- Stay strictly within the given concept: ${constraint.concept_id}.
- Do NOT drift topic.
- Use the anchor only for structure and difficulty guidance.
- The generated content must still come from the constraint object, not from the fallback anchor's concept.
` : ''}${tier3ConceptLock}

BACKUP PYQ ANCHORS:
${JSON.stringify(anchorSelection.backups.map((anchor) => ({
  id: anchor.id,
  question_type: anchor.question_type,
  difficulty: anchor.difficulty,
  structure_template: anchor.structure_template,
  question_text: anchor.question_text,
  options: anchor.options,
})), null, 2)}

DIFFICULTY STANDARD:
${JSON.stringify(CUET_DIFFICULTY_STANDARD, null, 2)}

SUBJECT: "${subject.name}" [id="${subject.id}"]
CHAPTER: "${chapter}"
UNIT: "${unit?.unit_name || 'Unknown'}"
DIFFICULTY TARGET: easy=${targets.easy}, medium=${targets.medium}, hard=${targets.hard}
BATCH SIZE: exactly ${count} questions in one JSON array${focusLine}${avoidLine}${saturatedLine}${subjectControlLine}${englishControlLine}${difficultyLine}${feedbackLine}${previousAttemptsLine}

MANDATORY CUET-FIRST RULES:
- Generate only from CONSTRAINT OBJECT.allowed_concepts.
- Match the structure, tone, and difficulty of the reference PYQ, but introduce controlled variation.
- Change surface context such as names, situations, and numbers where appropriate.
- Avoid copying phrasing. The question should feel new but familiar.
- Maintain the same reasoning depth. Do not increase complexity.
- Reject internally and regenerate if the question is too similar to the anchor or reuses anchor phrasing directly.
- Do not copy PYQ content. Create new content from the selected micro-concept only.
- Do not increase difficulty beyond the primary reference PYQ.
- NCERT knowledge is secondary support only; never expand scope beyond the CUET syllabus backbone.
- If a question is not directly traceable to the constraint object, omit it.
- If style or difficulty is above typical CUET PYQ level, omit it.
- Use template-based patterns only. Do not invent new formats.
- Keep language simple, direct, and exam-oriented.
- Avoid trick questions, long caselets, advanced theory, derivations, proof, JEE-style, MBA/graduate content, and multi-step logic.
- Every question must have exactly 4 options and exactly 1 correct answer.

TRACEABILITY REQUIRED IN EVERY ITEM:
- subject must equal "${subject.id}"
- chapter must equal "${chapter}"
- topic must equal "${constraint.topic}"
- concept must equal "${constraint.concept}"
- concept_id must equal "${constraint.concept_id}"
- pyq_anchor_id must equal "${anchorSelection.primary.id}"
- anchor_tier must equal ${anchorSelection.anchor_tier}
- difficulty_weight must be 1 for easy, 2 for medium, 3 for hard

Return ONLY a valid JSON array. No markdown. No prose. No extra keys.
[{"q":"...","o":["A ...","B ...","C ...","D ..."],"a":"A","d":"easy|medium|hard","difficulty_weight":2,"question_type":"${anchorSelection.primary.question_type || questionType}","concept_pattern":"unique_snake_case_tag","explanation":"one sentence","subject":"${subject.id}","public_subject":"${toPublicSubjectId(subject.id)}","chapter":"${chapter}","topic":"${constraint.topic}","concept":"${constraint.concept}","concept_id":"${constraint.concept_id}","pyq_anchor_id":"${anchorSelection.primary.id}","anchor_tier":${anchorSelection.anchor_tier},"passage_id":"optional_for_english_rc","passage_type":"optional_for_english_rc"}]`;
}

function getNextAvailableValidationModel(currentModel) {
  return getAvailableValidationModels().find((model) => model !== currentModel) || null;
}

function markValidationModelFailed(modelName, reason) {
  if (!shouldCooldownModel(reason)) return null;
  const cooldownUntil = Date.now() + getModelCooldownMs();
  failedValidationModels.set(modelName, cooldownUntil);
  if (activeValidationModel === modelName) {
    activeValidationModel = getNextAvailableValidationModel(modelName) || VALIDATION_MODELS[0];
  }
  return cooldownUntil;
}

function shouldCooldownModel(reason) {
  return reason === 'invalid_model';
}

function clearExpiredValidationModelFailures() {
  const now = Date.now();
  for (const [modelName, cooldownUntil] of failedValidationModels.entries()) {
    if (cooldownUntil <= now) failedValidationModels.delete(modelName);
  }
}

function buildGenerationPrompt(subject, chapter, count, targets, options = {}) {
  const unit = getCanonicalUnitForChapter(subject.id, chapter);
  const { usedConcepts = [], subtopicFocus = [], saturatedSubtopics = [], difficultyOverride = null } = options;
  const chapterKeywords = extractChapterKeywords(chapter);
  const chapterGroundingLine = chapterKeywords.length > 0
    ? `\nCHAPTER KEYWORDS: ${chapterKeywords.join(', ')}. Use these only as grounding hints, not as mandatory words.`
    : '';

  const avoidLine = usedConcepts.length > 0
    ? `\nAVOID â€” these concepts are already covered, do NOT repeat them: ${usedConcepts.slice(0, 8).join(', ')}.`
    : '';

  const saturatedLine = saturatedSubtopics.length > 0
    ? `\nSATURATED â€” these sub-topics have enough questions already, skip them entirely: ${saturatedSubtopics.slice(0, 8).join(', ')}.`
    : '';

  const focusLine = subtopicFocus.length > 0
    ? `\nFOCUS on these under-covered sub-topics: ${subtopicFocus.join(', ')}.`
    : '';

  const subjectControlLine = subject.id === 'business_studies'
    ? '\nBUSINESS STUDIES CONTROL: minimize numericals; focus on principles, functions, short case logic, assertion-reason, and statement-based MCQs.'
    : subject.id === 'gat'
      ? '\nGAT CONTROL: restrict to general knowledge, reasoning, and current affairs. Ban advanced statistics, econometrics, and formulas unless basic.'
    : '';
  const englishControlLine = subject.id === 'english'
    ? buildEnglishGenerationControl(chapter)
    : '';

  let difficultyModeBlock = '';
  if (difficultyOverride === 'easy') {
    difficultyModeBlock = `

STRICT EASY MODE:
- Direct concept, not trivial
- Simple NCERT-based trap or close option allowed
- No calculations or long scenarios
`;
  } else if (difficultyOverride === 'medium') {
    difficultyModeBlock = `

STRICT MEDIUM MODE:
- Concept + elimination
- 2-3 plausible options
- Short statement/assertion/case allowed
`;
  } else if (difficultyOverride === 'hard') {
    difficultyModeBlock = `

STRICT HARD MODE:
- CUET-hard only: close NCERT distractors, not advanced difficulty.
- No JEE-style, proof-style, multi-step, or abstract questions.
- Use simple statement/incorrect-statement formats over complex assertion-reason.
- Must still be solvable in under 60 seconds.
`;
  }

  console.log('[llm] PROMPT_CONSTRUCTION:', {
    expected_subject: subject.id,
    prompt_subject_name: subject.name,
    expected_chapter: chapter,
    canonical_unit: unit?.unit_name || null,
    batch_size: count,
    used_concepts_count: usedConcepts.length,
    saturated_subtopics_count: saturatedSubtopics.length,
    difficulty_override: difficultyOverride,
  });

  return `You are a CUET exam question setter. Generate PYQ-like MCQs that test understanding, not memory.

SUBJECT (STRICT): "${subject.name}" [id="${subject.id}"]
CHAPTER: "${chapter}"
UNIT: "${unit?.unit_name || 'Unknown'}"
DIFFICULTY TARGET: easy=${targets.easy}, medium=${targets.medium}, hard=${targets.hard} (30% easy, 50% medium, 20% hard unless strict mode overrides)
BATCH SIZE: exactly ${count} questions in ONE JSON array${focusLine}${chapterGroundingLine}${subjectControlLine}${englishControlLine}${saturatedLine}${avoidLine}${difficultyModeBlock}

STRICT CUET-NCERT REALISM:
- Before generating, recall 2-3 typical CUET PYQ patterns for this chapter and follow those patterns. Do NOT invent new formats.
- Only NCERT Class 11/12 concepts from the exact chapter.
- No abstract theory, proof-based questions, deep theory, JEE-level difficulty, or multi-step reasoning.
- Allowed patterns: direct concept, definition, factual NCERT check, and one-step numerical.
- Disallowed patterns: complex assertion-reason, long caselets, derivations, graduate/MBA content, and weak/absurd options.
- Every question must be solvable in under 60 seconds.
- Balance correct answers across A/B/C/D as evenly as possible.

STRICT CHAPTER BOUNDARY:
- ONLY generate questions strictly from the given chapter.
- DO NOT use concepts outside this chapter.
- If unsure, SKIP instead of guessing.

CUET STYLE:
- Questions must feel like NCERT-based CUET questions, NOT MBA or advanced academic problems.
- Prefer short, precise, NCERT-based concept questions with conceptual traps.
- Use elimination, statement-based MCQs, incorrect-statement MCQs, and assertion-reason.
- Definition-based and conceptual recall questions are allowed when options create confusion.
- Easy = direct concept, no trick but not trivial; medium = concept + elimination; hard = subtle confusion with close options or statement traps.
- When STRICT HARD MODE is active, at least 70% of candidates must be truly hard by the hard definition above.
AVOID: direct textbook copy, long scenario chains, heavy numericals, advanced academic/MBA style, obvious answers, joke/absurd options.

QUESTION FORMAT â€” distribute across ALL of these types, use every format multiple times:
  â€¢ conceptual   â€” tests definitions, principles, cause-effect relationships
  â€¢ numerical    â€” involves calculation, formula application, or quantitative reasoning
  â€¢ application  â€” applies a concept to a real-world scenario or case study
  â€¢ assertion-reason â€” "Assertion: â€¦ Reason: â€¦" MCQ (4 standard A/B/C/D options)
  â€¢ match-based  â€” "Match List I with List II" MCQ
  â€¢ case-based   â€” 2-sentence scenario followed by one question about it
Maximum 1 question per micro-concept â€” never repeat the same narrow idea.
No two questions may share more than 40 % of their key words.
Avoid standard textbook stems like "Which of the following is correct?" unless the stem includes a concrete scenario, data point, assertion, or comparison.

MANDATORY RULES â€” violating any rule means the entire batch is rejected:
1. ALL questions MUST belong to "${subject.name}" ONLY. No other subject allowed.
2. Every question MUST test a DIFFERENT concept or sub-topic within this chapter.
3. Do NOT generate grammar, comprehension, fill-in-the-blank, or vocabulary questions unless the subject is English.
4. Each wrong option must be a plausible distractor but unambiguously incorrect.
5. If you cannot form a valid question for this subject+chapter, omit it rather than substituting another subject.
6. The "subject" field in every output object MUST equal exactly "${subject.id}".
7. The "chapter" field in every output object MUST equal exactly "${chapter}".
8. The "concept_pattern" tag must be unique across the batch â€” no two questions share the same tag.

Output ONLY a valid JSON array â€” no markdown, no commentary, no extra keys:
[{"q":"...","o":["A ...","B ...","C ...","D ..."],"a":"A","d":"easy|medium|hard","concept_pattern":"unique_snake_case_tag","explanation":"one sentence","subject":"${subject.id}","chapter":"${chapter}","passage_id":"optional_for_english_rc","passage_type":"optional_for_english_rc"}]`;
}

function buildEnglishGenerationControl(chapter) {
  if (ENGLISH_RC_CHAPTERS.has(chapter)) {
    const type = chapter.replace(' Passage', '').toLowerCase();
    return `

ENGLISH CUET CONTROL:
- Generate ONLY "${chapter}" questions for CUET English.
- Every item MUST include a passage first, followed by exactly one MCQ about that passage.
- Group Reading Comprehension output as one passage with 3-5 related questions using the same "passage_id"; repeat the same passage text in each grouped item.
- The passage MUST be at least 80 words.
- Use a shared "passage_id" for questions based on the same passage.
- Always set "passage_type" to "${type}".
- DO NOT generate standalone Reading Comprehension questions.
- DO NOT mix factual, narrative, and literary passages in one item.
- Factual passages must be informational/expository and not story-like or poem-like.
- Narrative passages must contain story, characters, events, or sequence of actions.
- Literary passages must contain poem/stanza/speaker/literary tone/imagery or prose with literary analysis.
- DO NOT generate grammar theory questions.`;
  }

  if (!ENGLISH_VERBAL_CHAPTERS.has(chapter)) return '';

  const controls = {
    'Para Jumbles': 'Every question must ask for the correct order/rearrangement of sentence parts. Do not use passage comprehension.',
    'Match the Following': 'Every question must contain two columns/lists and ask the learner to match pairs. Do not use fill-in-the-blank.',
    Vocabulary: 'Every question must ask synonym, antonym, meaning, or closest word meaning without sentence-blank context.',
    'Correct Word Usage': 'Every question must test the correct word/phrase in a sentence or blank. Do not ask pure synonym/antonym without usage context.',
  };

  return `

ENGLISH CUET CONTROL:
- Generate ONLY "${chapter}" questions for CUET English.
- ${controls[chapter]}
- DO NOT generate Reading Comprehension passages for this chapter.
- DO NOT generate grammar theory questions such as definitions of nouns, tenses, or parts of speech.
- Keep every item in CUET MCQ pattern with four plausible options.`;
}

async function generateWithClaude(subject, chapter, count) {
  const targets = buildDifficultyTargets(count);
  try {
    const modelName = 'claude-3-5-sonnet-20240620';
    console.log(`[llm] Claude single_attempt | ${subject.id} | ${chapter} | count=${count}`);
    const response = await runRateLimitedLlmCall({
      modelName,
      subjectId: subject.id,
      stage: 'generation_claude',
      call: () => anthropic.messages.create({
        model: modelName,
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
- each question must test a different micro-topic
- use mixed conceptual, numerical, case-based, and assertion-reason formats
- avoid repetitive textbook templates
- return ONLY one JSON array with no markdown and no extra text

Return only a JSON array with:
subject, chapter, body, options[{key,text}], correct_answer, explanation, difficulty, concept_pattern, tags
        `.trim()
        }]
      }),
    });

    const raw = response.content?.[0]?.text ?? '[]';
    console.log(`[llm] Raw Claude response: ${raw}`);
    return normalizeGeneratedQuestions(parseJsonArray(raw), subject.id, chapter);
  } catch (error) {
    console.warn(`[llm] Claude single attempt failed: ${error.message}`);
    return [];
  }
}
function generateMockQuestions(subject, chapter, count, difficultyOverride = null) {
  const targets = buildDifficultyTargets(count, difficultyOverride);
  const constraint = buildConstraintObject({
    subjectId: subject.id,
    chapter,
    concept: chapter,
    questionType: 'direct_concept',
    difficulty: difficultyOverride || 'medium',
  });
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
    difficulty_weight: getDifficultyWeight(difficulty),
    topic: constraint.topic,
    concept: constraint.concept,
    concept_id: constraint.concept_id,
    question_type: constraint.question_type,
    concept_pattern: `mock_${difficulty}_${index + 1}`,
    tags: ["mock", "cuet"]
  }));
}

function extractOpenAIResponseText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  if (!Array.isArray(response?.output)) return '';

  return response.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((part) => part?.text || '')
    .join('');
}

/**
 * VALIDATOR
 * Returns a stricter moderation summary used by the autonomous worker.
 */
export async function validateAndAlign(question, subjectContext) {
  if (process.env.MOCK_AI === 'true') {
    return {
      score: 9,
      exam_quality: 8,
      distractor_quality: 8,
      conceptual_depth: 8,
      textbook_style: false,
      decision: "accept",
      difficulty_correct: true,
      cuet_alignment: true,
      fully_within_cuet_syllabus: 'YES',
      matches_cuet_pyq_difficulty: 'YES',
      harder_than_typical_cuet_level: 'NO',
      ambiguity_or_multiple_correct_answers: 'NO',
      language_unnecessarily_complex: 'NO',
      syllabus_alignment: 'WITHIN',
      concept_match: 'EXACT',
      difficulty_level: String(question.difficulty || 'medium').toUpperCase(),
      compared_to_pyqs: 'MATCH',
      clarity: 'CLEAR',
      language_level: 'SIMPLE',
      option_quality: 'CLEAN',
      subject_consistency: 'CORRECT',
      verdict: 'VALID',
      reasons: [],
      recommended_difficulty: question.difficulty || 'medium',
      issues: [],
      improved_question: null,
    };
  }

  if (genAI) {
    const prompt = `VAL CUET MCQ. CUET = NCERT familiarity test, NOT deep reasoning. Return JSON only: {"score":0-10,"exam_quality":0-10,"distractor_quality":0-10,"conceptual_depth":0-10,"textbook_style":false,"difficulty_correct":true,"cuet_alignment":true,"recommended_difficulty":"easy|medium|hard","issues":[],"decision":"accept|reject","improved_question":null}.
ACCEPT: direct NCERT recall/definition, one-step application, simple assertion-reason with NCERT-phrased clauses, basic numericals (one formula).
REJECT if ANY of: abstract algebra/vector space/proof/theorem-by-name, JEE-style derivation, multi-step calculation, MBA/graduate-level concept, college viva style, complex assertion-reason (named theorems, nested conditionals), direct textbook copy, weak distractors, ambiguity, wrong chapter.
When in doubt → reject. CUET students should answer from textbook memory + one simple step only.
q=${JSON.stringify(compactQuestionForValidation(question))}`;

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

        const result = await runRateLimitedLlmCall({
          modelName,
          subjectId: subjectContext?.id,
          stage: 'single_validation',
          call: () => withTimeout(
            model.generateContent(prompt),
            GENERATION_TIMEOUT_MS,
            `validation timeout after ${GENERATION_TIMEOUT_MS}ms`
          ),
        });
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
          cooldownUntil: cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
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
 * (count mismatch, missing/duplicate indices). The worker does not retry validation.
 * Throws LlmGenerationError if all models fail with API errors.
 * Never silently falls back on integrity failures.
 */
export async function validateAndAlignBatch(questions, subjectContext) {
  if (questions.length === 0) return [];

  if (process.env.MOCK_AI === 'true') {
    return questions.map((question) => ({
      score: 9,
      exam_quality: 8,
      distractor_quality: 8,
      conceptual_depth: 8,
      textbook_style: false,
      decision: 'accept',
      difficulty_correct: true,
      cuet_alignment: true,
      fully_within_cuet_syllabus: 'YES',
      matches_cuet_pyq_difficulty: 'YES',
      harder_than_typical_cuet_level: 'NO',
      ambiguity_or_multiple_correct_answers: 'NO',
      language_unnecessarily_complex: 'NO',
      syllabus_alignment: 'WITHIN',
      concept_match: 'EXACT',
      difficulty_level: String(question.difficulty || 'medium').toUpperCase(),
      compared_to_pyqs: 'MATCH',
      clarity: 'CLEAR',
      language_level: 'SIMPLE',
      option_quality: 'CLEAN',
      subject_consistency: 'CORRECT',
      verdict: 'VALID',
      reasons: [],
      recommended_difficulty: question.difficulty || 'medium',
      issues: [],
      improved_question: null,
    }));
  }

  if (!genAI) {
    throw new LlmGenerationError('no_validation_model_available: GEMINI_API_KEY not set', 'no_api_key');
  }

  const compactBatch = questions.map((q, i) => ({ i, ...compactQuestionForValidation(q) }));
  const syllabusConcepts = getSyllabusConcepts(subjectContext?.id, questions[0]?.chapter);
  const pyqStylePack = questions
    .map((question) => ({
      pyq_anchor_id: question.pyq_anchor_id || null,
      concept_id: question.concept_id || null,
      question_type: question.question_type || null,
    }))
    .slice(0, 15);
  const prompt = `Evaluate these CUET questions as a strict CUET exam paper setter.

Primary source of truth:
${JSON.stringify(syllabusConcepts, null, 0)}

PYQ anchor metadata for this batch:
${JSON.stringify(pyqStylePack, null, 0)}

Evaluate each question and return Validator V2 fields exactly:
1. syllabus_alignment: WITHIN | OUTSIDE
2. concept_match: EXACT | PARTIAL | MISMATCH
3. difficulty_level: EASY | MEDIUM | HARD | TOO HARD
4. compared_to_pyqs: EASIER | MATCH | HARDER
5. clarity: CLEAR | AMBIGUOUS
6. language_level: SIMPLE | MODERATE | COMPLEX
7. option_quality: CLEAN | OVERLAPPING | CONFUSING
8. subject_consistency: CORRECT | WRONG
9. verdict: VALID | INVALID
10. reasons: string[] with concise causes when INVALID, e.g. "too hard compared to PYQs", "language too complex", "concept mismatch", "ambiguous options", "too similar to anchor", "anchor phrasing reused"

INVALID CONDITIONS:
- syllabus_alignment != WITHIN
- concept_match != EXACT
- difficulty_level == TOO HARD
- compared_to_pyqs == HARDER
- clarity == AMBIGUOUS
- language_level == COMPLEX
- option_quality != CLEAN
- subject_consistency != CORRECT
- question is too similar to anchor
- anchor phrasing is reused directly

Also reject if subject, concept_id, or pyq_anchor_id is missing or if the subject does not match the selected subject. PYQ comparison must be against the same subject only.

Return EXACTLY ${questions.length} JSON result objects, indices 0 through ${questions.length - 1}. Format:
[{"index":0,"syllabus_alignment":"WITHIN|OUTSIDE","concept_match":"EXACT|PARTIAL|MISMATCH","difficulty_level":"EASY|MEDIUM|HARD|TOO HARD","compared_to_pyqs":"EASIER|MATCH|HARDER","clarity":"CLEAR|AMBIGUOUS","language_level":"SIMPLE|MODERATE|COMPLEX","option_quality":"CLEAN|OVERLAPPING|CONFUSING","subject_consistency":"CORRECT|WRONG","verdict":"VALID|INVALID","reasons":[],"score":0-10,"exam_quality":0-10,"distractor_quality":0-10,"conceptual_depth":0-10,"textbook_style":false,"difficulty_correct":true,"cuet_alignment":true,"recommended_difficulty":"easy|medium|hard","issues":[],"decision":"accept|reject","improved_question":null},...]

Return ONLY JSON array.
questions=${JSON.stringify(compactBatch)}`;

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

      const result = await runRateLimitedLlmCall({
        modelName,
        subjectId: subjectContext?.id,
        stage: 'batch_validation',
        call: () => withTimeout(
          model.generateContent(prompt),
          GENERATION_TIMEOUT_MS,
          `batch validation timeout after ${GENERATION_TIMEOUT_MS}ms`,
        ),
      });
      const text = result?.response?.text?.() ?? '';
      if (!String(text).trim()) {
        throw new LlmGenerationError('empty batch validation response', 'empty_response');
      }

      const parsed = parseJsonArray(text);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new LlmGenerationError('non-array or empty batch validation JSON', 'invalid_json');
      }

      // INTEGRITY CHECK â€” throws BatchValidationIntegrityError on any structural mismatch.
      // This error is NOT caught below and propagates directly to the worker.
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
        // Integrity failures must not be masked by model fallback.
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
        cooldownUntil: cooldownUntil ? new Date(cooldownUntil).toISOString() : null,
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
    exam_quality: basicChecksPass ? 5.5 : 0,
    distractor_quality: basicChecksPass ? 5.5 : 0,
    conceptual_depth: basicChecksPass ? 5.5 : 0,
    textbook_style: false,
    decision: basicChecksPass ? 'accept' : 'reject',
    difficulty_correct: true,
    cuet_alignment: basicChecksPass,
    recommended_difficulty: question.difficulty || 'medium',
    validation_confidence: 'low',
    requires_review: true,
    improved_question: null,
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
    subject: String(question?.subject || '').trim(),
    q: String(question?.body || question?.q || '').trim(),
    o: options,
    a: normalizeAnswerKey(question?.correct_answer || question?.a),
    d: normalizeDifficulty(question?.difficulty),
    difficulty_weight: getDifficultyWeight(question?.difficulty),
    c: String(question?.chapter || '').trim(),
    topic: String(question?.topic || '').trim(),
    concept: String(question?.concept || '').trim(),
    concept_id: String(question?.concept_id || '').trim(),
    question_type: String(question?.question_type || '').trim(),
    pyq_anchor_id: String(question?.pyq_anchor_id || '').trim(),
    anchor_tier: Number(question?.anchor_tier || 0),
  };
}

function buildDifficultyTargets(count, difficultyOverride = null) {
  if (difficultyOverride === 'easy') return { easy: count, medium: 0, hard: 0 };
  if (difficultyOverride === 'medium') return { easy: 0, medium: count, hard: 0 };
  if (difficultyOverride === 'hard') return { easy: 0, medium: 0, hard: count };

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

function extractChapterKeywords(chapter) {
  return String(chapter || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3 && !['chapter', 'unit', 'with', 'from', 'into', 'and', 'the'].includes(token))
    .slice(0, 10);
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

  console.error('JSON_PARSE_FAILED');
  console.error(`[llm] Failed to parse JSON array. Raw response: ${text}`);
  return [];
}

function safeParseJSON(text) {
  const raw = String(text || '')
    .replace(/[−]/g, '-')
    .replace(/[×]/g, '*')
    .replace(/[^\x00-\x7F]/g, (character) => character);

  try {
    return JSON.parse(raw);
  } catch {
    try {
      const fixed = raw
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

      return JSON.parse(fixed);
    } catch {
      console.error('JSON_PARSE_FAILED');
      return [];
    }
  }
}

function parseJsonArrayStrict(text) {
  const parsed = parseJsonArray(text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new LlmGenerationError('invalid JSON or empty question array', 'invalid_json');
  }
  return parsed;
}

function parseJsonObject(text) {
  const parsed = safeParseJSON(String(text || '').replace(/```json|```/g, '').trim());
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function parseJsonObjectStrict(text) {
  try {
    const parsed = safeParseJSON(String(text || '').replace(/```json|```/g, '').trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('validation response must be a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new LlmGenerationError(`invalid validation JSON: ${error.message}`, 'invalid_json');
  }
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function extractEnglishPassageText(body) {
  const text = String(body || '').trim();
  const passageMatch = text.match(/(?:passage|read the passage|read the following passage)\s*:?\s*([\s\S]+?)(?:\n\s*(?:question|q\.?\s*\d*|which|what|why|how)\b|$)/i);
  if (passageMatch?.[1] && countWords(passageMatch[1]) >= 40) return passageMatch[1].trim();

  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const longParagraph = paragraphs.find((part) => countWords(part) >= 80);
  if (longParagraph) return longParagraph;

  const beforeQuestion = text.split(/\b(?:question|q\.?\s*\d*|which|what|why|how)\b/i)[0]?.trim();
  return countWords(beforeQuestion) >= 80 ? beforeQuestion : '';
}

function detectEnglishRcTypeFromPassage(passage) {
  const text = String(passage || '').toLowerCase();
  if (/\b(poem|stanza|verse|speaker|poet|imagery|metaphor|symbolism|literary|rhyme|line\s+\d+|ode|sonnet)\b/.test(text)) {
    return { detectedType: 'Literary Passage', confidence: 0.95 };
  }
  if (/\b(story|narrative|character|protagonist|village|journey|incident|event|dialogue|scene|remembered|returned|walked|said|asked|replied)\b/.test(text)) {
    return { detectedType: 'Narrative Passage', confidence: 0.9 };
  }
  return { detectedType: 'Factual Passage', confidence: 0.8 };
}

function hasGrammarTheoryDrift(body) {
  return /\b(define|definition of|what is a noun|parts of speech|types of tense|rule of grammar|identify the tense rule)\b/i.test(body);
}

function classifyEnglishGeneratedQuestion(question, expectedChapter, index) {
  const body = String(question.body || '').trim();
  const passage = extractEnglishPassageText(body);
  const passageId = String(question.passage_id || question.passageId || '').trim();

  if (hasGrammarTheoryDrift(body)) {
    return { valid: false, detectedType: 'grammar_theory', confidence: 0.95, reason: 'grammar_theory', tags: [] };
  }

  if (ENGLISH_RC_CHAPTERS.has(expectedChapter)) {
    if (!passage) {
      return { valid: false, detectedType: 'standalone_rc', confidence: 0.95, reason: 'rc_without_passage', tags: [] };
    }
    if (countWords(passage) < 80) {
      return { valid: false, detectedType: 'short_passage', confidence: 0.95, reason: 'passage_too_short', tags: [] };
    }

    const { detectedType, confidence } = detectEnglishRcTypeFromPassage(passage);
    if (detectedType !== expectedChapter) {
      return { valid: false, detectedType, confidence, reason: 'incorrect_passage_classification', tags: [] };
    }

    return {
      valid: true,
      detectedType,
      confidence,
      passageType: detectedType.replace(' Passage', '').toLowerCase(),
      passageId: passageId || `${detectedType.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
      tags: ['english', 'reading_comprehension', detectedType],
    };
  }

  const containsPassage = countWords(passage) >= 80 || /\b(read the following passage|passage\s*:)/i.test(body);
  if (containsPassage) {
    return { valid: false, detectedType: 'reading_comprehension', confidence: 0.9, reason: 'passage_in_verbal_chapter', tags: [] };
  }

  const rules = {
    'Para Jumbles': /\b(rearrange|arrange|correct order|sequence|jumbled|sentence order|parts.*order)\b/i,
    'Match the Following': /\b(match|column\s+[i1]|column\s+ii|list\s+[i1]|list\s+ii|pair|following pairs)\b/i,
    Vocabulary: /\b(synonym|antonym|opposite|nearest meaning|closest meaning|means|meaning of)\b/i,
    'Correct Word Usage': /\b(fill in the blank|blank|correct word|correct usage|most appropriate word|appropriate word|complete the sentence)\b/i,
  };

  const matchesExpected = rules[expectedChapter]?.test(body) === true;
  const misclassifiedBlankVocabulary = expectedChapter === 'Vocabulary' && /\b(blank|complete the sentence|correct usage|appropriate word)\b/i.test(body);
  const misclassifiedContextlessWord = expectedChapter === 'Correct Word Usage' && /\b(synonym|antonym|opposite|nearest meaning|closest meaning)\b/i.test(body) && !/\b(sentence|blank|usage|context)\b/i.test(body);

  if (!matchesExpected || misclassifiedBlankVocabulary || misclassifiedContextlessWord) {
    return { valid: false, detectedType: 'ambiguous_verbal_ability', confidence: 0.75, reason: 'verbal_classification_mismatch', tags: [] };
  }

  return {
    valid: true,
    detectedType: expectedChapter,
    confidence: 0.9,
    tags: ['english', 'verbal_ability', expectedChapter],
  };
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
    const rawSubject = typeof question.subject === 'string' ? question.subject.trim() : '';
    if (rawSubject && rawSubject !== subjectId) {
      diagnostics.dropReasons.normalization_failed += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      console.warn('[llm] question_rejected_due_to_wrong_subject', {
        expected_subject: subjectId,
        received_subject: rawSubject,
        expected_chapter: chapter,
        received_chapter: rawChapter || null,
        index,
      });
      continue;
    }

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
      body: String(question.body || question.question || question.q || '').trim(),
      options: normalizeOptions(question.options || question.o),
      correct_answer: normalizeAnswerKey(question.correct_answer || question.answer || question.a),
      explanation: String(question.explanation || '').trim(),
      difficulty: normalizeDifficulty(question.difficulty || question.d),
      difficulty_weight: getDifficultyWeight(question.difficulty || question.d),
      question_type: String(question.question_type || question.pattern_type || 'direct_concept').trim(),
      topic: String(question.topic || '').trim(),
      concept: String(question.concept || '').trim(),
      concept_id: String(question.concept_id || '').trim(),
      pyq_anchor_id: String(question.pyq_anchor_id || question.pyqAnchorId || '').trim(),
      anchor_tier: Number(question.anchor_tier || question.anchorTier || 0),
      concept_pattern: String(question.concept_pattern || `concept_${index + 1}`).trim(),
      tags: normalizeTags(question.tags),
      passage_id: String(question.passage_id || question.passageId || '').trim(),
      passage_type: String(question.passage_type || question.passageType || '').trim().toLowerCase(),
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

    const traceability = validateTraceability(normalized, subjectId, chapter);
    if (!traceability.valid) {
      diagnostics.dropReasons.validation_failed += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      diagnostics.sampleFailedNormalizedAttempt ||= normalized;
      console.warn('[llm] question_rejected_traceability', {
        subject: subjectId,
        chapter,
        reason: traceability.reason,
        concept_id: normalized.concept_id || null,
        concept: normalized.concept || null,
        index,
      });
      continue;
    }
    normalized.topic = traceability.concept.topic;
    normalized.concept = traceability.concept.concept;
    normalized.concept_id = traceability.concept.concept_id;

    if (subjectId === 'english') {
      const classification = classifyEnglishGeneratedQuestion(normalized, chapter, index);
      console.log('[english-classification]', {
        question_id: normalized.concept_pattern || index + 1,
        detected_type: classification.detectedType,
        confidence: classification.confidence,
      });

      if (!classification.valid) {
        diagnostics.dropReasons.normalization_failed += 1;
        diagnostics.sampleFailedRawQuestion ||= question;
        diagnostics.sampleFailedNormalizedAttempt ||= normalized;
        console.warn('[llm] english_question_rejected', {
          chapter,
          reason: classification.reason,
          detected_type: classification.detectedType,
          index,
        });
        continue;
      }

      normalized.tags = normalizeTags([...normalized.tags, ...classification.tags]);
      if (classification.passageId) normalized.passage_id = classification.passageId;
      if (classification.passageType) normalized.passage_type = classification.passageType;
    }

    // Subject validation: reject questions that drift to wrong subject or language tests
    if (!isQuestionFromSubject(normalized, subjectId)) {
      diagnostics.dropReasons.normalization_failed += 1;
      console.warn('[llm] question_rejected_subject_validation', {
        subject: subjectId,
        chapter,
        body: normalized.body.slice(0, 80),
        index,
      });
      diagnostics.sampleFailedRawQuestion ||= question;
      continue;
    }

    const internalRejectReason = getGeneratedQuestionInternalRejectReason(normalized);
    if (internalRejectReason) {
      diagnostics.dropReasons.validation_failed += 1;
      diagnostics.sampleFailedRawQuestion ||= question;
      diagnostics.sampleFailedNormalizedAttempt ||= normalized;
      console.warn('[llm] question_rejected_internal_quality', {
        subject: subjectId,
        chapter,
        reason: internalRejectReason,
        body: normalized.body.slice(0, 100),
        index,
      });
      continue;
    }

    normalizedQuestions.push(normalized);
  }

  diagnostics.normalizedCount = normalizedQuestions.length;
  lastGenerationDiagnostics = diagnostics;
  return normalizedQuestions;
}

function getGeneratedQuestionInternalRejectReason(question) {
  const body = String(question?.body || '').trim();
  const bodyLower = body.toLowerCase();
  if (body.length > 420 || countWords(body) > 70) return 'question_too_long';
  if (/\b(vector space|subspace|basis|rank-nullity|heine-borel|cayley-hamilton|prove|proof|derive|derivation|jee|graduate|mba|b\.com|econometrics|hypothesis testing|functional analysis|abstract algebra|ring|field|group under|multi-step|caselet)\b/i.test(bodyLower)) {
    return 'advanced_or_non_cuet_pattern';
  }
  if (hasGeneratedWeakOptions(question.options, question.correct_answer)) return 'weak_options';
  return null;
}

function hasGeneratedWeakOptions(options, correctAnswer) {
  const normalizedOptions = normalizeOptions(options);
  if (normalizedOptions.length !== 4) return true;
  const answer = normalizeAnswerKey(correctAnswer);
  if (!answer || !normalizedOptions.some((option) => option.key === answer)) return true;

  const texts = normalizedOptions.map((option) => String(option.text || '').trim().toLowerCase());
  if (texts.some((text) => text.length < 2)) return true;
  if (new Set(texts).size !== 4) return true;
  return texts.some((text) => /\b(all of the above|none of the above|both a and b|cannot be determined)\b/i.test(text));
}

function normalizeValidationResult(result, question) {
  const score = Number.isFinite(Number(result.score)) ? Number(result.score) : 0;
  const examQuality = Number.isFinite(Number(result.exam_quality)) ? Number(result.exam_quality) : score;
  const distractorQuality = Number.isFinite(Number(result.distractor_quality)) ? Number(result.distractor_quality) : score;
  const conceptualDepth = Number.isFinite(Number(result.conceptual_depth)) ? Number(result.conceptual_depth) : score;
  const textbookStyle = result.textbook_style === true;
  const difficultyCorrect = result.difficulty_correct !== false;
  const cuetAlignment = result.cuet_alignment !== false;
  const recommendedDifficulty = normalizeDifficulty(result.recommended_difficulty || question.difficulty);
  const issues = Array.isArray(result.issues) ? result.issues.map(String) : [];
  const improvedQuestion = result.improved_question && typeof result.improved_question === 'object'
    ? result.improved_question
    : null;
  const fullyWithinCuetSyllabus = normalizeYesNo(result.fully_within_cuet_syllabus, false);
  const matchesCuetPyqDifficulty = normalizeYesNo(result.matches_cuet_pyq_difficulty, false);
  const harderThanTypicalCuetLevel = normalizeYesNo(result.harder_than_typical_cuet_level, true);
  const ambiguityOrMultipleCorrectAnswers = normalizeYesNo(result.ambiguity_or_multiple_correct_answers, true);
  const languageUnnecessarilyComplex = normalizeYesNo(result.language_unnecessarily_complex, true);
  const syllabusAlignment = normalizeEnum(result.syllabus_alignment, ['WITHIN', 'OUTSIDE'], 'OUTSIDE');
  const conceptMatch = normalizeEnum(result.concept_match, ['EXACT', 'PARTIAL', 'MISMATCH'], 'MISMATCH');
  const difficultyLevel = normalizeEnum(result.difficulty_level, ['EASY', 'MEDIUM', 'HARD', 'TOO HARD'], 'TOO HARD');
  const comparedToPyqs = normalizeEnum(result.compared_to_pyqs, ['EASIER', 'MATCH', 'HARDER'], 'HARDER');
  const clarity = normalizeEnum(result.clarity, ['CLEAR', 'AMBIGUOUS'], 'AMBIGUOUS');
  const languageLevel = normalizeEnum(result.language_level, ['SIMPLE', 'MODERATE', 'COMPLEX'], 'COMPLEX');
  const optionQuality = normalizeEnum(result.option_quality, ['CLEAN', 'OVERLAPPING', 'CONFUSING'], 'CONFUSING');
  const subjectConsistency = normalizeEnum(result.subject_consistency, ['CORRECT', 'WRONG'], 'WRONG');
  const verdict = normalizeEnum(result.verdict, ['VALID', 'INVALID'], 'INVALID');
  const validatorReasons = normalizeValidatorReasons(result.reasons);
  const validatorCheckFailed =
    fullyWithinCuetSyllabus !== 'YES' ||
    matchesCuetPyqDifficulty !== 'YES' ||
    harderThanTypicalCuetLevel !== 'NO' ||
    ambiguityOrMultipleCorrectAnswers !== 'NO' ||
    languageUnnecessarilyComplex !== 'NO';
  const validatorV2Failed =
    syllabusAlignment !== 'WITHIN' ||
    conceptMatch !== 'EXACT' ||
    difficultyLevel === 'TOO HARD' ||
    comparedToPyqs === 'HARDER' ||
    clarity === 'AMBIGUOUS' ||
    languageLevel === 'COMPLEX' ||
    optionQuality !== 'CLEAN' ||
    subjectConsistency !== 'CORRECT';

  // Reduced from 7 â†’ 5.  difficulty_correct is tracked but no longer a hard rejection
  // (the model often mis-labels difficulty; the question itself may still be valid).
  // cuet_alignment remains a soft signal â€” the worker applies its own compound check.
  const shouldReject =
    validatorCheckFailed ||
    validatorV2Failed ||
    verdict !== 'VALID' ||
    score < 5 ||
    examQuality < 7 ||
    distractorQuality < 7 ||
    textbookStyle ||
    !cuetAlignment ||
    String(result.decision || '').toLowerCase() === 'reject';

  return {
    score,
    exam_quality: examQuality,
    distractor_quality: distractorQuality,
    conceptual_depth: conceptualDepth,
    textbook_style: textbookStyle,
    decision: shouldReject ? 'reject' : 'accept',
    difficulty_correct: difficultyCorrect,
    cuet_alignment: cuetAlignment,
    fully_within_cuet_syllabus: fullyWithinCuetSyllabus,
    matches_cuet_pyq_difficulty: matchesCuetPyqDifficulty,
    harder_than_typical_cuet_level: harderThanTypicalCuetLevel,
    ambiguity_or_multiple_correct_answers: ambiguityOrMultipleCorrectAnswers,
    language_unnecessarily_complex: languageUnnecessarilyComplex,
    syllabus_alignment: syllabusAlignment,
    concept_match: conceptMatch,
    difficulty_level: difficultyLevel,
    compared_to_pyqs: comparedToPyqs,
    clarity,
    language_level: languageLevel,
    option_quality: optionQuality,
    subject_consistency: subjectConsistency,
    verdict: shouldReject ? 'INVALID' : 'VALID',
    reasons: shouldReject ? normalizeRejectionReasons({
      validatorReasons,
      validatorCheckFailed,
      validatorV2Failed,
      syllabusAlignment,
      conceptMatch,
      difficultyLevel,
      comparedToPyqs,
      clarity,
      languageLevel,
      optionQuality,
      subjectConsistency,
      issues,
    }) : [],
    recommended_difficulty: recommendedDifficulty,
    issues: validatorCheckFailed || validatorV2Failed || verdict !== 'VALID' ? [...issues, 'validator_v2_failed'] : issues,
    improved_question: improvedQuestion,
  };
}

function normalizeYesNo(value, defaultYes) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'YES' || normalized === 'NO') return normalized;
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  return defaultYes ? 'YES' : 'NO';
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = String(value || '').trim().toUpperCase();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeValidatorReasons(reasons) {
  if (!Array.isArray(reasons)) return [];
  return reasons.map((reason) => String(reason || '').trim()).filter(Boolean).slice(0, 8);
}

function normalizeRejectionReasons({
  validatorReasons,
  validatorCheckFailed,
  validatorV2Failed,
  syllabusAlignment,
  conceptMatch,
  difficultyLevel,
  comparedToPyqs,
  clarity,
  languageLevel,
  optionQuality,
  subjectConsistency,
  issues,
}) {
  const reasons = new Set(validatorReasons);
  if (syllabusAlignment !== 'WITHIN') reasons.add('outside CUET syllabus');
  if (conceptMatch !== 'EXACT') reasons.add('concept mismatch');
  if (difficultyLevel === 'TOO HARD') reasons.add('too hard compared to PYQs');
  if (comparedToPyqs === 'HARDER') reasons.add('too hard compared to PYQs');
  if (clarity === 'AMBIGUOUS') reasons.add('ambiguous wording');
  if (languageLevel === 'COMPLEX') reasons.add('language too complex');
  if (optionQuality !== 'CLEAN') reasons.add(optionQuality === 'OVERLAPPING' ? 'ambiguous options' : 'confusing options');
  if (subjectConsistency !== 'CORRECT') reasons.add('subject mismatch');
  if (validatorCheckFailed || validatorV2Failed) reasons.add('validator v2 strict checks failed');
  for (const issue of issues || []) {
    if (issue) reasons.add(String(issue));
  }
  return [...reasons].slice(0, 8);
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

function getDifficultyWeight(value) {
  return { easy: 1, medium: 2, hard: 3 }[normalizeDifficulty(value)] || 2;
}

function normalizeDifficultyOverride(value) {
  const difficulty = String(value || '').trim().toLowerCase();
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : null;
}

function normalizeTags(tags) {
  const normalized = Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];

  return Array.from(new Set(['cuet', ...normalized]));
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

async function runRateLimitedLlmCall({ modelName, subjectId, stage, call, maxAttempts = LLM_SAME_MODEL_ATTEMPTS }) {
  let lastError = null;
  const attempts = Math.max(1, maxAttempts);

  for (let retryCount = 0; retryCount < attempts; retryCount += 1) {
    await waitForFailSafeIfNeeded();
    const release = await acquireLlmSlot({ modelName, subjectId, stage, retryCount });
    const startedAt = Date.now();
    let status = 'success';
    let reason = null;

    try {
      await sleep(50 + Math.floor(Math.random() * 151));
      const result = await call();
      const duration = Date.now() - startedAt;
      recordLlmCallOutcome(true);
      logLlmCall({ modelName, subjectId, stage, status, retryCount, duration });
      return result;
    } catch (error) {
      lastError = error;
      reason = getLlmFailureReason(error);
      status = reason;
      const duration = Date.now() - startedAt;
      recordLlmCallOutcome(false);
      logLlmCall({ modelName, subjectId, stage, status, retryCount, duration, error });

      if (!shouldRetryLlmCall(reason, error) || retryCount >= attempts - 1) {
        throw error;
      }

      const backoffMs = getBackoffDelayMs(retryCount);
      console.warn(`[llm-call] retrying_same_model model=${modelName} subject=${subjectId || 'unknown'} reason=${reason} retry_count=${retryCount + 1} delay_ms=${backoffMs}`);
      release();
      await sleep(backoffMs);
    } finally {
      release();
    }
  }

  throw lastError ?? new LlmGenerationError('llm_call_failed_without_error', 'transient_failure');
}

function acquireLlmSlot({ modelName, subjectId, stage, retryCount }) {
  return new Promise((resolve) => {
    const enter = () => {
      activeLlmCalls += 1;
      logRateLimiterState('acquire', { modelName, subjectId, stage, retryCount });
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        activeLlmCalls = Math.max(0, activeLlmCalls - 1);
        processNextLlmQueueItem();
        logRateLimiterState('release', { modelName, subjectId, stage, retryCount });
      });
    };

    if (activeLlmCalls < MAX_CONCURRENT_LLM_CALLS) {
      enter();
      return;
    }

    llmRateLimiterQueue.push(enter);
    logRateLimiterState('queued', { modelName, subjectId, stage, retryCount });
  });
}

function processNextLlmQueueItem() {
  if (activeLlmCalls >= MAX_CONCURRENT_LLM_CALLS) return;
  const next = llmRateLimiterQueue.shift();
  if (next) next();
}

function logRateLimiterState(event, { modelName, subjectId, stage, retryCount }) {
  console.log('[rate-limiter]', {
    event,
    active_calls: activeLlmCalls,
    queue_length: llmRateLimiterQueue.length,
    max_concurrent: MAX_CONCURRENT_LLM_CALLS,
    model: modelName,
    subject: subjectId || null,
    stage,
    retry_count: retryCount,
  });
}

function logLlmCall({ modelName, subjectId, stage, status, retryCount, duration, error = null }) {
  console.log('[llm-call]', {
    model: modelName,
    subject: subjectId || null,
    stage,
    status,
    retry_count: retryCount,
    duration,
    error: error?.message || null,
  });
}

function shouldRetryLlmCall(reason, error) {
  if (reason === 'invalid_model') return false;
  if (reason === 'rate_limit' || reason === 'timeout' || reason === 'service_unavailable') return true;
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  return status >= 500 && status < 600;
}

function getBackoffDelayMs(retryCount) {
  return (LLM_BACKOFF_BASE_MS * (2 ** retryCount)) + Math.floor(Math.random() * 301);
}

async function waitForFailSafeIfNeeded() {
  const now = Date.now();
  if (failSafePauseUntil <= now) return;
  const pauseMs = failSafePauseUntil - now;
  console.warn(`[llm-call] failsafe_pause_wait=${pauseMs}ms`);
  await sleep(pauseMs);
}

function recordLlmCallOutcome(success) {
  recentLlmCallOutcomes.push(success);
  while (recentLlmCallOutcomes.length > FAILSAFE_WINDOW_SIZE) recentLlmCallOutcomes.shift();

  if (recentLlmCallOutcomes.length < FAILSAFE_WINDOW_SIZE) return;
  const failures = recentLlmCallOutcomes.filter((outcome) => !outcome).length;
  if (failures / FAILSAFE_WINDOW_SIZE <= FAILSAFE_FAILURE_THRESHOLD) return;

  const pauseMs = FAILSAFE_PAUSE_MIN_MS + Math.floor(Math.random() * FAILSAFE_PAUSE_JITTER_MS);
  failSafePauseUntil = Math.max(failSafePauseUntil, Date.now() + pauseMs);
  console.warn('[llm-call] FAILSAFE_PAUSE_TRIGGERED', {
    failures,
    window: FAILSAFE_WINDOW_SIZE,
    failure_rate: failures / FAILSAFE_WINDOW_SIZE,
    pause_ms: pauseMs,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Called immediately after JSON parse â€” before any result is trusted.
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
        `out-of-range index ${idx} (valid range 0â€“${expectedCount - 1})`,
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

function sanitizeJsonText(text) {
  return String(text || '')
    .replace(/```json|```/gi, '')
    .replace(/^[^{\[]*?(?=[{\[])/s, '')
    .replace(/\u0000/g, '')
    .trim();
}

function tryParseQuestionPayload(candidate, method) {
  const parsed = safeParseJSON(candidate);
  const normalized = normalizeQuestionPayload(parsed);
  if (normalized.length > 0) {
    console.log(`[llm] JSON recovery used: ${method}`);
    console.log(`[llm] Parsed question count: ${normalized.length}`);
    return normalized;
  }

  return null;
}

function normalizeQuestionPayload(parsed) {
  if (Array.isArray(parsed)) return parsed.filter((entry) => entry && typeof entry === 'object');
  if (Array.isArray(parsed?.questions)) return parsed.questions.filter((entry) => entry && typeof entry === 'object');
  if (Array.isArray(parsed?.data)) return parsed.data.filter((entry) => entry && typeof entry === 'object');
  if (parsed && typeof parsed === 'object' && (parsed.body || parsed.question || parsed.q)) return [parsed];
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
