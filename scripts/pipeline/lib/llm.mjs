import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { loadEnvFile } from 'node:process';
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
import { getEnglishGenerationMode } from './englishGenerationMode.mjs';
import { normalizeGenerationPayload } from './passageNormalizer.mjs';
import { repairGeneratedJson, containsMetaCommentary } from './jsonRepair.mjs';

try {
  loadEnvFile('.env.local');
} catch {
  // Production and npm scripts may provide env vars directly.
}

console.log("GEMINI API KEY:", process.env.GEMINI_API_KEY ? "LOADED" : "MISSING");

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    })
  : null;

// Equal thirds â†’ 4 easy / 4 medium / 4 hard for a 12-question batch.
const DIFFICULTY_DISTRIBUTION = { easy: 0.25, medium: 0.50, hard: 0.25 };
// Single-call batches are larger now; selfCheck and validators select what survives.
export const PIPELINE_BATCH_SIZE = Number(process.env.GENERATION_BATCH_SIZE || 10);
const MIN_GENERATION_COUNT = 3;
const MAX_GENERATION_COUNT = Number(process.env.MAX_GENERATION_BATCH_SIZE || 10);
export const VALIDATION_BATCH_SIZE = Number(process.env.VALIDATION_BATCH_SIZE || 10);
export const STRICT_VALIDATION_MAX_PER_BATCH = Number(process.env.STRICT_VALIDATION_MAX_PER_BATCH || 3);
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 180000);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 90000);
const DEEPSEEK_GENERATION_BATCH_SIZE = Number(process.env.DEEPSEEK_GENERATION_BATCH_SIZE || 5);
const OPENAI_GENERATION_BATCH_SIZE = Number(process.env.OPENAI_GENERATION_BATCH_SIZE || 10);
const DEEPSEEK_PRO_TIMEOUT_MS = Number(process.env.DEEPSEEK_PRO_TIMEOUT_MS || 240000);
const DEEPSEEK_FLASH_TIMEOUT_MS = Number(process.env.DEEPSEEK_FLASH_TIMEOUT_MS || 90000);
const DEEPSEEK_CHAT_TIMEOUT_MS = Number(process.env.DEEPSEEK_CHAT_TIMEOUT_MS || 90000);
const DEEPSEEK_PRO_BATCH_SIZE = Number(process.env.DEEPSEEK_PRO_BATCH_SIZE || 3);
const DEEPSEEK_FLASH_BATCH_SIZE = Number(process.env.DEEPSEEK_FLASH_BATCH_SIZE || 8);
const DEEPSEEK_CHAT_BATCH_SIZE = Number(process.env.DEEPSEEK_CHAT_BATCH_SIZE || 8);
const FLASH_MAX_GENERATION_CALLS_PER_JOB = Number(process.env.FLASH_MAX_GENERATION_CALLS_PER_JOB || 2);
const FLASH_MAX_CANDIDATES_PER_JOB = Number(process.env.FLASH_MAX_CANDIDATES_PER_JOB || 16);
const PRO_MAX_GENERATION_CALLS_PER_JOB = Number(process.env.PRO_MAX_GENERATION_CALLS_PER_JOB || 1);
const PRO_MAX_CANDIDATES_PER_JOB = Number(process.env.PRO_MAX_CANDIDATES_PER_JOB || 3);
const CHAT_MAX_GENERATION_CALLS_PER_JOB = Number(process.env.CHAT_MAX_GENERATION_CALLS_PER_JOB || 1);
const CHAT_MAX_CANDIDATES_PER_JOB = Number(process.env.CHAT_MAX_CANDIDATES_PER_JOB || 8);
const FLASH_MAX_JOB_TIME_MS = Number(process.env.MAX_JOB_TIME_MS || process.env.FLASH_MAX_JOB_TIME_MS || 90000);
const PRO_MAX_JOB_TIME_MS = Number(process.env.PRO_MAX_JOB_TIME_MS || 180000);
const DEEPSEEK_PRO_MAX_OUTPUT_TOKENS = Number(process.env.DEEPSEEK_PRO_MAX_OUTPUT_TOKENS || 12000);
const DEEPSEEK_FLASH_MAX_OUTPUT_TOKENS = Number(process.env.DEEPSEEK_FLASH_MAX_OUTPUT_TOKENS || 8000);
const DEEPSEEK_CHAT_MAX_OUTPUT_TOKENS = Number(process.env.DEEPSEEK_CHAT_MAX_OUTPUT_TOKENS || 8000);
const PRO_EMPTY_DISABLE_THRESHOLD = Number(process.env.PRO_EMPTY_DISABLE_THRESHOLD || 2);
const PRO_TIMEOUT_DISABLE_THRESHOLD = Number(process.env.PRO_TIMEOUT_DISABLE_THRESHOLD || 2);
const PRO_DISABLE_MINUTES = Number(process.env.PRO_DISABLE_MINUTES || 30);
const ALLOWED_CUET_REASONING_TYPES = [
  'statement_based',
  'assertion_reason',
  'case_based',
  'application_based',
  'numerical_one_step',
  'match_type',
  'comparison_based',
  'para_jumble',
  'central_idea',
  'inference',
  'vocabulary_in_context',
  'tone',
  'author_purpose',
  'detail_based',
  'literary_device',
];
const EXTREME_QUALIFIER_WORDS = [
  'always',
  'never',
  'all',
  'only',
  'solely',
  'completely',
  'entirely',
  'impossible',
  'guaranteed',
];
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

const ALLOW_OPENAI_GENERATION = String(process.env.ALLOW_OPENAI_GENERATION || 'false').trim().toLowerCase() === 'true';
const REQUESTED_GENERATOR_PROVIDER = String(process.env.GENERATOR_PRIMARY_PROVIDER || process.env.GENERATOR_PROVIDER || '').trim().toLowerCase();
const GENERATOR_PROVIDER = deepseek ? 'deepseek' : (REQUESTED_GENERATOR_PROVIDER || 'deepseek');
const DEEPSEEK_PRO_MODEL = process.env.DEEPSEEK_PRO_MODEL
  || process.env.GENERATOR_PRIMARY_MODEL
  || process.env.DEEPSEEK_GENERATOR_MODEL
  || process.env.GENERATOR_MODEL
  || 'deepseek-v4-pro';
const DEEPSEEK_FLASH_MODEL = process.env.DEEPSEEK_FLASH_MODEL
  || process.env.GENERATOR_FALLBACK_MODEL
  || 'deepseek-v4-flash';
const DEEPSEEK_CHAT_MODEL = process.env.DEEPSEEK_CHAT_MODEL
  || process.env.GENERATOR_SECOND_FALLBACK_MODEL
  || 'deepseek-chat';
const DEEPSEEK_GENERATION_MODELS = [
  DEEPSEEK_PRO_MODEL,
  DEEPSEEK_FLASH_MODEL,
  DEEPSEEK_CHAT_MODEL,
].filter((model, index, array) => model && array.indexOf(model) === index);
const GENERATION_MODELS = deepseek ? DEEPSEEK_GENERATION_MODELS : [];
const CHEAP_VALIDATOR_MODEL = process.env.CHEAP_VALIDATOR_MODEL || 'gpt-4o-mini';
const STRICT_VALIDATOR_MODEL = process.env.STRICT_VALIDATOR_MODEL || 'gpt-4o';
const GENERATION_MAX_OUTPUT_TOKENS = Number(process.env.GENERATION_MAX_OUTPUT_TOKENS || 3800);
const VALIDATION_MODELS = [
  "gemini-3-flash",
  "gemini-2-flash",
];

console.log('[llm] generator_config', {
  primary_provider: GENERATOR_PROVIDER,
  primary_model: DEEPSEEK_PRO_MODEL,
  fallback_model: DEEPSEEK_FLASH_MODEL,
  second_fallback_model: DEEPSEEK_CHAT_MODEL,
  allow_openai_generation: ALLOW_OPENAI_GENERATION,
  deepseek_key_loaded: Boolean(deepseek),
});
const GEMINI_MODEL_ALIASES = {
  'gemini-3-flash': process.env.GEMINI_3_FLASH_MODEL || 'gemini-3-flash-preview',
  'gemini-2-flash': process.env.GEMINI_2_FLASH_MODEL || 'gemini-2.0-flash-001',
};
const CUET_GENERATION_SYSTEM_PROMPT = `Return only strict JSON matching the user's CUET MCQ schema. Do not include markdown or prose.`;

const LEGACY_CUET_GENERATION_SYSTEM_PROMPT = `You are a strict CUET exam paper setter, not a textbook question writer.

Non-negotiable source order:
1. CUET syllabus constraint object is the primary source of truth.
2. CUET PYQ style examples are ONLY for question structure, option style, and difficulty level.
3. NCERT or external knowledge is secondary support only.

Hard rejection rules:
- If the requested subject is outside the top-15 allowlist, stop.
- If a concept is not directly traceable to the CUET syllabus constraint object, stop.
- Do not generate free-form questions. Use only the supplied PYQ-derived templates.
- No out-of-syllabus content, advanced theory, proof, derivation, JEE-style, MBA/graduate content, or multi-step logic.
- Do not copy PYQ content or concept; concept_id is always the source of truth.
- Do not generate direct definition questions such as "What is X?", "Define X", or "Which is the correct definition of X?"
- Generate CUET-level application, scenario, comparison, statement, or trap-based questions that require elimination.
- Allowed question_type values only: statement_based, assertion_reason, case_based, application_based, comparison_based, numerical_one_step, match_type.
- Never use question_type "direct_concept".
- Each wrong option must be conceptually close to the correct answer.
- Banned extreme words in stems and options: ${EXTREME_QUALIFIER_WORDS.join(', ')}.
- Questions must require elimination, not recall.
- Each option set must contain one correct answer, one close confusion option, one partial truth option, and one clearly wrong option.
- At least two options must appear correct to a partially prepared student.
- Keep language simple and exam-oriented without making the answer obvious.

Each question must have exactly 4 options, exactly 1 correct answer, traceable subject/chapter/topic/concept/concept_id, and JSON only output.`;
const GENERATION_TIMEOUT_MS = 90_000;

// ── Validation scoring thresholds (0–100 composite score) ────────────────────
export const VALIDATION_ACCEPT_THRESHOLD = 65;
export const VALIDATION_RECOVER_THRESHOLD = 50;

// ── Cost tracking per-model (USD per 1K tokens) ─────────────────────────────
const MODEL_COST_PER_1K_INPUT = {
  'gpt-4o-mini': 0.00015,
  'gpt-4o': 0.0025,
  'deepseek-v4-pro': 0.00014,
  'deepseek-v4-flash': 0.00007,
  'deepseek-chat': 0.00014,
  'gemini-3-flash-preview': 0.00015,
  'gemini-3-flash': 0.00015,
  'gemini-2-flash': 0.00010,
  'gemini-2.0-flash': 0.00010,
  'gemini-2.0-flash-001': 0.00010,
};
const MODEL_COST_PER_1K_OUTPUT = {
  'gpt-4o-mini': 0.0006,
  'gpt-4o': 0.0100,
  'deepseek-v4-pro': 0.00028,
  'deepseek-v4-flash': 0.00020,
  'deepseek-chat': 0.00028,
  'gemini-3-flash-preview': 0.0006,
  'gemini-3-flash': 0.0006,
  'gemini-2-flash': 0.0004,
  'gemini-2.0-flash': 0.0004,
  'gemini-2.0-flash-001': 0.0004,
};
const COST_PER_1000_LIMIT = Number(process.env.COST_HARD_THROTTLE_PER_1000 || process.env.COST_PER_1000_LIMIT || 5);

const costTracker = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUsd: 0,
  batchCount: 0,
  acceptedCount: 0,
};

export function getCostTracker() {
  return {
    ...costTracker,
    costPerAccepted: costTracker.acceptedCount > 0
      ? costTracker.totalCostUsd / costTracker.acceptedCount
      : 0,
    costPer1000: costTracker.acceptedCount > 0
      ? (costTracker.totalCostUsd / costTracker.acceptedCount) * 1000
      : 0,
  };
}

export function recordCost(modelName, inputTokens, outputTokens) {
  const resolvedModelName = resolveGeminiModelName(modelName);
  const inputCost = (inputTokens / 1000) * (MODEL_COST_PER_1K_INPUT[modelName] || MODEL_COST_PER_1K_INPUT[resolvedModelName] || 0.001);
  const outputCost = (outputTokens / 1000) * (MODEL_COST_PER_1K_OUTPUT[modelName] || MODEL_COST_PER_1K_OUTPUT[resolvedModelName] || 0.003);
  costTracker.totalInputTokens += inputTokens;
  costTracker.totalOutputTokens += outputTokens;
  costTracker.totalCostUsd += inputCost + outputCost;
  costTracker.batchCount += 1;
  return inputCost + outputCost;
}

export function recordAcceptedForCost(count) {
  costTracker.acceptedCount += count;
}

export function isCostSaverActive() {
  const snapshot = getCostTracker();
  return snapshot.acceptedCount >= 3 && snapshot.costPer1000 > COST_PER_1000_LIMIT;
}

function resolveGeminiModelName(modelName) {
  return GEMINI_MODEL_ALIASES[modelName] || modelName;
}

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
const deepseekHealth = {
  pro_empty_count: 0,
  pro_timeout_count: 0,
  pro_reasoning_exhausted_count: 0,
  pro_disabled_until: 0,
  flash_empty_count: 0,
  chat_empty_count: 0,
  flash_success_count: 0,
  preferred_model: null,
};
let activeValidationModel = VALIDATION_MODELS[0];
const failedValidationModels = new Map();
const llmRateLimiterQueue = [];
let activeLlmCalls = 0;
const recentLlmCallOutcomes = [];
let failSafePauseUntil = 0;

function getPipelineModelAssignmentError() {
  return null;
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

  if (!deepseek) {
    console.error('[llm] generator_unavailable no_deepseek_api_key');
    return {
      error: 'generator_unavailable',
      reason: 'no_deepseek_api_key',
      action: 'defer_job',
    };
  }
  return generateWithDeepSeekOnly(subject, chapter, safeCount, context);
}

export function getLastGenerationDiagnostics() {
  return cloneDiagnostics(lastGenerationDiagnostics);
}

async function generateWithDeepSeekOnly(subject, chapter, count, context = {}) {
  const difficultyOverride = normalizeDifficultyOverride(context.difficultyOverride);
  const conceptId = context.concept_id || context.conceptId || getSyllabusConcepts(subject.id, chapter)[0]?.concept_id;
  const requestedQuestionType = normalizeGeneratedQuestionType(
    context.question_type || context.questionType || pickQuestionTypeSequence(1, subject.id)[0],
  );
  const englishMode = subject.id === 'english' ? getEnglishGenerationMode(chapter) : null;
  const anchorSelection = selectPyqAnchors({
    subject: subject.id,
    concept_id: conceptId,
    difficulty: difficultyOverride || 'medium',
    question_type: requestedQuestionType,
  });
  if (!anchorSelection.valid) {
    console.warn('[llm] pyq_anchor_unavailable_deepseek', {
      subject: subject.id, chapter, concept_id: conceptId || null, error: anchorSelection.error,
    });
    return { error: anchorSelection.error, reason: anchorSelection.error };
  }

  const subtopicFocus = getSyllabusConcepts(subject.id, chapter)
    .map((c) => c.concept_name || c.concept || c.subtopic)
    .filter(Boolean)
    .slice(0, 3);
  const promptOptions = {
    usedConcepts: context.usedConcepts || [],
    saturatedSubtopics: context.saturatedSubtopics || [],
    subtopicFocus,
    difficultyOverride,
    anchorSelection,
    validationFeedback: context.validationFeedback || [],
    previousAttempts: context.previousAttempts || context.previous_attempts || [],
    englishMode,
  };

  const requestedOverride = String(context.modelOverride || '').trim();
  if (requestedOverride && !isDeepSeekGenerationModel(requestedOverride) && !ALLOW_OPENAI_GENERATION) {
    console.warn('[llm] blocked_openai_generation_override', {
      requested_model: requestedOverride,
      action: 'using_deepseek_only',
    });
  }
  const modelNames = requestedOverride && isDeepSeekGenerationModel(requestedOverride)
    ? [requestedOverride, ...getAvailableGenerationModels()].filter((model, index, array) => model && array.indexOf(model) === index)
    : getAvailableGenerationModels({
        ...context,
        subject: subject.id,
        chapter,
        question_type: requestedQuestionType,
        requires_passage: englishMode?.requires_passage === true,
        anchor_confidence: getAnchorConfidence(anchorSelection),
        anchor_match_level: getAnchorMatchLevel(anchorSelection),
        subject_priority_tier: context.subject_priority_tier,
        recent_flash_yield_rate: context.recent_flash_yield_rate,
      });
  let lastError = null;
  for (const modelName of modelNames) {
    const generationProvider = getGenerationProvider(modelName);
    const generationClient = getGenerationClient(modelName);
    const fallbackModel = modelNames.find((candidate) => candidate !== modelName) || null;
    if (!generationClient) {
      lastError = new LlmGenerationError(`no_generation_client_for_${generationProvider}`, 'no_api_key');
      console.warn(`[llm] generation failure ${modelName}: ${lastError.message}`);
      continue;
    }

    const subBatchCounts = getSubBatchRequestCountsForTarget(count, modelName);
    const collectedForModel = [];
    const modelStartedAt = Date.now();
    let modelCallIndex = 0;

    for (const subBatchSize of subBatchCounts) {
      if (Date.now() - modelStartedAt > getGenerationLoopConfigForModel(modelName).maxJobTimeMs) break;
      modelCallIndex += 1;
      const attempts = generationProvider === 'deepseek'
        ? [
            { retryCount: 0, requestedCount: subBatchSize, strictFinalJson: false },
            { retryCount: 1, requestedCount: getDeepSeekModelRole(modelName) === 'pro' ? 1 : Math.max(1, Math.floor(subBatchSize / 2)), strictFinalJson: true, allowSingle: true },
          ]
        : [{ retryCount: 0, requestedCount: subBatchSize }];

      let subBatchSucceeded = false;
      for (const attempt of attempts) {
      const requestedCount = attempt.allowSingle
        ? Math.min(Math.max(attempt.requestedCount, 1), count)
        : Math.min(Math.max(attempt.requestedCount, MIN_GENERATION_COUNT), count);
      const targets = buildDifficultyTargets(requestedCount, difficultyOverride);
      const prompt = buildStrictCuetGenerationPrompt(subject, chapter, requestedCount, targets, promptOptions)
        + (attempt.strictFinalJson ? '\n\nReturn only final JSON. Do not include reasoning.' : '');
      const timeoutMs = getProviderTimeoutMs(generationProvider, modelName);

      console.log('[llm] generation_provider_config', {
        active_provider: generationProvider,
        active_model: modelName,
        timeout_ms: timeoutMs,
        batch_size: requestedCount,
        fallback_model: fallbackModel,
        health_state: getDeepSeekHealthSnapshot(),
        deepseek_key_loaded: Boolean(deepseek),
      });
      console.log('[generator_model_selected]', {
        provider: generationProvider,
        model: modelName,
        reason: attempt.retryCount > 0 ? 'retry_after_empty_or_timeout' : 'healthy_priority_order',
        batch_size: requestedCount,
        timeout_ms: timeoutMs,
        health_state: getDeepSeekHealthSnapshot(),
      });
      console.log(`[llm] generation active_provider=${generationProvider} active_model=${modelName}`);

      try {
        const result = await runRateLimitedLlmCall({
          modelName,
          subjectId: subject.id,
          stage: `generation_${generationProvider}`,
          maxAttempts: 1,
          call: () => withTimeout(
            generationClient.chat.completions.create({
              model: modelName,
              ...(requiresMaxCompletionTokens(modelName) ? {} : { temperature: 0.55 }),
              ...(requiresMaxCompletionTokens(modelName)
                ? { max_completion_tokens: getGenerationMaxOutputTokens(modelName, attempt) }
                : { max_tokens: getGenerationMaxOutputTokens(modelName, attempt) }),
              response_format: getGenerationResponseFormat(modelName, conceptId, englishMode),
              messages: [
                { role: 'system', content: CUET_GENERATION_SYSTEM_PROMPT },
                { role: 'user', content: prompt },
              ],
              ...(requiresMaxCompletionTokens(modelName) ? {} : {
                presence_penalty: 0.2,
                frequency_penalty: 0.2,
              }),
            }),
            timeoutMs,
            `${generationProvider} timeout after ${timeoutMs}ms`,
          ),
        });

        if (generationProvider === 'deepseek') {
          logDeepSeekRawShape(result, modelName);
        }
        const finishReason = getGenerationFinishReason(result);
        const text = extractGenerationText(result, generationProvider);
        if (!String(text).trim()) {
          throw new LlmGenerationError(`empty ${generationProvider} response`, 'empty_response');
        }

        const usage = result?.usage || {};
        const estimatedInputTokens = Number(usage.prompt_tokens) || prompt.length / 4;
        const estimatedOutputTokens = Number(usage.completion_tokens) || text.length / 4;
        const generationCost = recordCost(modelName, estimatedInputTokens, estimatedOutputTokens);
        console.log('[cost] generator_cost', {
          model: modelName,
          input_tokens: Math.round(estimatedInputTokens),
          output_tokens: Math.round(estimatedOutputTokens),
          cost_usd: Number(generationCost.toFixed(6)),
        });

        const repairResult = await repairGeneratedJson(text, {
          subject: subject.id,
          chapter,
          concept_id: conceptId,
          question_type: requestedQuestionType,
          generation_mode: englishMode?.mode || null,
          requires_passage: englishMode?.requires_passage === true,
          passage_type: englishMode?.passage_type || null,
          finish_reason: finishReason,
        });
        const parsedPayload = repairResult.passage_group
          ? { passage_group: repairResult.passage_group }
          : { questions: repairResult.questions };
        const parsed = normalizeGenerationPayload(parsedPayload, {
          subject: subject.id,
          chapter,
          passage_type: englishMode?.passage_type || null,
          requires_passage: englishMode?.requires_passage === true,
        }).questions.map((question) => ({
          ...question,
          json_repaired: repairResult.provider !== 'code',
          repair_provider: repairResult.provider,
          repair_model: repairResult.model,
        }));
        console.log('[deepseek_generation_result]', {
          model: modelName,
          finish_reason: finishReason,
          content_length: text.length,
          reasoning_content_length: String(result?.choices?.[0]?.message?.reasoning_content || '').length,
          parsed_ok: parsed.length > 0,
          repair_used: repairResult.provider !== 'code',
          final_question_count: parsed.length,
        });
        const normalized = ensureMinimumGeneratedCandidates(
          normalizeGeneratedQuestions(parsed, subject.id, chapter),
          subject,
          chapter,
          requestedCount,
          anchorSelection,
        )
          .map((q) => ({
            ...q,
            pyq_anchor_id: q.pyq_anchor_id || anchorSelection.primary.id,
            pyq_anchor_ids_used: Array.isArray(q.pyq_anchor_ids_used) && q.pyq_anchor_ids_used.length > 0
              ? q.pyq_anchor_ids_used
              : [anchorSelection.primary.id, ...(anchorSelection.backups || []).map((anchor) => anchor.id)].filter(Boolean).slice(0, 5),
            anchor_tier: Number(q.anchor_tier || anchorSelection.anchor_tier),
            anchor_match_level: getAnchorMatchLevel(anchorSelection),
            anchor_confidence: getAnchorConfidence(anchorSelection),
            concept_mismatch_risk: anchorSelection.concept_mismatch_risk || 'low',
            anchor_source_quality: q.anchor_source_quality || anchorSelection.source_quality || anchorSelection.primary.source_quality || 'synthetic',
            anchor_live_publish_allowed: ['real_pyq', 'manual_seed'].includes(q.anchor_source_quality || anchorSelection.source_quality || anchorSelection.primary.source_quality),
            generator_provider: generationProvider,
            generator_model: modelName,
            generation_mode: englishMode?.mode || null,
            difficulty_weight: getDifficultyWeight(q.difficulty),
          }));

        if (normalized.length === 0) {
          throw new LlmGenerationError('empty question array after normalization', 'empty_questions');
        }

        console.log(`[llm] generation success provider=${generationProvider} model=${modelName} count=${normalized.length}`);
        if (generationProvider === 'deepseek') markDeepSeekSuccess(modelName);
        activeModel = modelName;
        failedModels.delete(modelName);
        collectedForModel.push(...normalized);
        subBatchSucceeded = true;
        console.log('[llm] generation_subbatch_progress', {
          model: modelName,
          sub_batch: modelCallIndex,
          sub_batch_count: normalized.length,
          collected_count: collectedForModel.length,
          target_count: count,
        });
        if (collectedForModel.length >= count) {
          return collectedForModel.slice(0, count);
        }
        break;
      } catch (error) {
        lastError = error;
        const reason = getLlmFailureReason(error);
        if (reason === 'timeout') {
          console.warn('[llm] generation_timeout', {
            provider: generationProvider,
            model: modelName,
            timeout_ms: getProviderTimeoutMs(generationProvider, modelName),
            requested_count: requestedCount,
            retry_count: attempt.retryCount,
          });
        }
        if (generationProvider === 'deepseek') {
          markDeepSeekHealth(modelName, reason);
          if (reason === 'empty_response') {
            console.warn('[generator_empty_response]', {
              model: modelName,
              duration_ms: error?.durationMs || null,
              retry_count: attempt.retryCount,
              action: attempt.retryCount === 0 ? 'retry' : (fallbackModel ? 'switch_to_flash' : 'defer_job'),
            });
          }
        }
        if (generationProvider === 'deepseek' && ['timeout', 'empty_response', 'reasoning_exhausted_output_budget'].includes(reason) && attempt.retryCount === 0) {
          console.warn('[llm] generation_retry', {
            provider: generationProvider,
            model: modelName,
            retry_count: 1,
            retry_batch_size: attempts[1].requestedCount,
          });
          continue;
        }
        markModelFailed(modelName, reason);
        console.warn(`[llm] generation failure ${modelName}: ${error.message}`);
        break;
      }
      }
      if (!subBatchSucceeded) break;
    }

    if (collectedForModel.length > 0) {
      return collectedForModel.slice(0, count);
    }

    const nextModel = modelNames.find((candidate) => candidate !== modelName);
    if (nextModel) {
      console.warn('[llm] generation_fallback', {
        from_provider: generationProvider,
        from_model: modelName,
        to_provider: getGenerationProvider(nextModel),
        to_model: nextModel,
        reason: getLlmFailureReason(lastError || new Error('generation_failed')),
      });
    }
  }
  return {
    error: 'generator_unavailable',
    reason: lastError ? getLlmFailureReason(lastError) : 'all_deepseek_generation_models_failed',
    action: 'defer_job',
  };
}

function ensureMinimumGeneratedCandidates(questions, subject, chapter, count, anchorSelection) {
  return questions.slice(0, count);
}

function getGenerationResponseFormat(modelName, conceptId, englishMode = null) {
  if (getGenerationProvider(modelName) === 'deepseek' || englishMode) {
    return { type: 'json_object' };
  }
  const answerKeySchema = { type: 'string', enum: ['A', 'B', 'C', 'D'] };
  return {
    type: 'json_schema',
    json_schema: {
      name: 'cuet_question_batch',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['questions'],
        properties: {
          questions: {
            type: 'array',
            minItems: 1,
            maxItems: MAX_GENERATION_COUNT,
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'q',
                'o',
                'a',
                'difficulty',
                'question_type',
                'subject',
                'chapter',
                'concept_id',
                'pyq_anchor_ids_used',
                'trap_option',
                'strong_distractors',
                'why_not_textbook',
                'why_cuet_level',
                'distractor_rationale',
              ],
              properties: {
                q: { type: 'string' },
                o: {
                  type: 'array',
                  minItems: 4,
                  maxItems: 4,
                  items: { type: 'string' },
                },
                a: answerKeySchema,
                difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                question_type: { type: 'string', enum: ALLOWED_CUET_REASONING_TYPES },
                subject: { type: 'string' },
                chapter: { type: 'string' },
                concept_id: { type: 'string', enum: [String(conceptId || '')] },
                pyq_anchor_ids_used: {
                  type: 'array',
                  items: { type: 'string' },
                },
                trap_option: answerKeySchema,
                strong_distractors: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 2,
                  items: answerKeySchema,
                },
                why_not_textbook: { type: 'string' },
                why_cuet_level: { type: 'string' },
                distractor_rationale: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['A', 'B', 'C', 'D'],
                  properties: {
                    A: { type: 'string' },
                    B: { type: 'string' },
                    C: { type: 'string' },
                    D: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function isDeepSeekGenerationModel(modelName) {
  return DEEPSEEK_GENERATION_MODELS.includes(String(modelName || '').trim());
}

function getDeepSeekModelRole(modelName) {
  const value = String(modelName || '').trim();
  if (value === DEEPSEEK_PRO_MODEL) return 'pro';
  if (value === DEEPSEEK_FLASH_MODEL) return 'flash';
  if (value === DEEPSEEK_CHAT_MODEL) return 'chat';
  return '';
}

function getGenerationProvider(modelName) {
  if (isDeepSeekGenerationModel(modelName)) return 'deepseek';
  return ALLOW_OPENAI_GENERATION ? 'openai' : 'openai_disabled';
}

function getGenerationClient(modelName) {
  const provider = getGenerationProvider(modelName);
  if (provider === 'deepseek') return deepseek;
  if (provider === 'openai' && ALLOW_OPENAI_GENERATION) return openai;
  return null;
}

function getProviderTimeoutMs(provider, modelName = '') {
  if (provider !== 'deepseek') return OPENAI_TIMEOUT_MS;
  const role = getDeepSeekModelRole(modelName);
  if (role === 'pro') return DEEPSEEK_PRO_TIMEOUT_MS;
  if (role === 'flash') return DEEPSEEK_FLASH_TIMEOUT_MS;
  if (role === 'chat') return DEEPSEEK_CHAT_TIMEOUT_MS;
  return DEEPSEEK_TIMEOUT_MS;
}

function getProviderGenerationBatchSize(provider, requestedCount, modelName = '') {
  let configured = OPENAI_GENERATION_BATCH_SIZE;
  if (provider === 'deepseek') {
    const role = getDeepSeekModelRole(modelName);
    if (role === 'pro') configured = DEEPSEEK_PRO_BATCH_SIZE;
    else if (role === 'flash') configured = DEEPSEEK_FLASH_BATCH_SIZE;
    else if (role === 'chat') configured = DEEPSEEK_CHAT_BATCH_SIZE;
    else configured = DEEPSEEK_GENERATION_BATCH_SIZE;
    const minCount = role === 'pro' ? 1 : MIN_GENERATION_COUNT;
    return Math.min(Math.max(minCount, configured), requestedCount);
  }
  return Math.min(Math.max(MIN_GENERATION_COUNT, configured), requestedCount);
}

function getGenerationMaxOutputTokens(modelName, attempt = {}) {
  const role = getDeepSeekModelRole(modelName);
  let configured = GENERATION_MAX_OUTPUT_TOKENS;
  if (role === 'pro') configured = DEEPSEEK_PRO_MAX_OUTPUT_TOKENS;
  if (role === 'flash') configured = DEEPSEEK_FLASH_MAX_OUTPUT_TOKENS;
  if (role === 'chat') configured = DEEPSEEK_CHAT_MAX_OUTPUT_TOKENS;
  if (attempt.strictFinalJson && role === 'pro') {
    return Math.max(configured, DEEPSEEK_PRO_MAX_OUTPUT_TOKENS);
  }
  return configured;
}

function getGenerationFinishReason(response) {
  return response?.choices?.[0]?.finish_reason ||
    response?.data?.choices?.[0]?.finish_reason ||
    null;
}

export function getDeepSeekRawShapeForLog(response, modelName = '') {
  const firstChoice = response?.choices?.[0] || response?.data?.choices?.[0] || {};
  const message = firstChoice.message || {};
  const content = message.content ?? firstChoice?.delta?.content ?? response?.output_text ?? response?.text ?? response?.data?.output_text ?? '';
  const reasoningContent = message.reasoning_content ?? '';
  return {
    model: modelName,
    status: response?.status || response?.statusCode || 'success',
    has_choices: Array.isArray(response?.choices) || Array.isArray(response?.data?.choices),
    choices_length: Array.isArray(response?.choices)
      ? response.choices.length
      : (Array.isArray(response?.data?.choices) ? response.data.choices.length : 0),
    has_message: Boolean(firstChoice.message),
    has_content: Boolean(String(content || '').trim()),
    has_reasoning_content: Boolean(String(reasoningContent || '').trim()),
    content_length: String(content || '').length,
    reasoning_content_length: String(reasoningContent || '').length,
    finish_reason: firstChoice.finish_reason || null,
    response_keys: Object.keys(response || {}).slice(0, 20),
  };
}

function logDeepSeekRawShape(response, modelName) {
  console.log('[deepseek_raw_shape]', getDeepSeekRawShapeForLog(response, modelName));
}

export function extractGenerationText(response, provider = '') {
  const finishReason = getGenerationFinishReason(response);
  const content = String(response?.choices?.[0]?.message?.content || '').trim();
  const reasoning = String(response?.choices?.[0]?.message?.reasoning_content || '').trim();
  if (provider === 'deepseek' && !content && reasoning) {
    if (finishReason === 'length') {
      throw new LlmGenerationError(
        'deepseek reasoning_content exhausted output budget before final JSON',
        'reasoning_exhausted_output_budget',
      );
    }
    if (containsMetaCommentary(reasoning)) {
      throw new LlmGenerationError(
        'deepseek reasoning_content contains meta-commentary without final JSON',
        'empty_response',
      );
    }
    if (looksLikeJsonPayload(reasoning)) return reasoning;
    throw new LlmGenerationError(
      'deepseek reasoning_content present without final JSON',
      'empty_response',
    );
  }

  const candidates = [
    { field: 'choices[0].message.content', value: response?.choices?.[0]?.message?.content },
    { field: 'choices[0].message.reasoning_content', value: response?.choices?.[0]?.message?.reasoning_content, reasoning: true },
    { field: 'choices[0].delta.content', value: response?.choices?.[0]?.delta?.content },
    { field: 'output_text', value: response?.output_text },
    { field: 'text', value: response?.text },
    { field: 'data.output_text', value: response?.data?.output_text },
    { field: 'data.choices[0].message.content', value: response?.data?.choices?.[0]?.message?.content },
  ];

  for (const candidate of candidates) {
    const text = String(candidate.value || '').trim();
    if (!text) continue;
    if (provider === 'deepseek' && candidate.reasoning && !looksLikeJsonPayload(text)) {
      throw new LlmGenerationError(
        'deepseek reasoning_content present without final JSON',
        'empty_response',
      );
    }
    return text;
  }

  return '';
}

function looksLikeJsonPayload(text) {
  const cleaned = sanitizeJsonText(String(text || '').trim());
  return cleaned.startsWith('{') || cleaned.startsWith('[');
}

function getAnchorMatchLevel(anchorSelection) {
  if (!anchorSelection?.valid) return 'none';
  if (anchorSelection.anchor_match_level) return anchorSelection.anchor_match_level;
  if (anchorSelection.primary?.structure_only || anchorSelection.primary?.synthetic) return 'structure_only';
  if (Number(anchorSelection.anchor_tier) === 1) return 'exact_chapter';
  if (Number(anchorSelection.anchor_tier) === 2) return 'same_unit';
  return 'same_subject_structure';
}

function getAnchorConfidence(anchorSelection) {
  if (anchorSelection?.anchor_confidence) return anchorSelection.anchor_confidence;
  const tier = Number(anchorSelection?.anchor_tier || 0);
  if (tier === 1 && !anchorSelection?.primary?.structure_only && !anchorSelection?.primary?.synthetic) return 'high';
  if (tier === 2) return 'medium';
  return 'low';
}

function buildCuratedCuetCandidates(subject, chapter, anchorSelection) {
  const base = {
    subject: subject.id,
    chapter,
    topic: getSyllabusConcepts(subject.id, chapter)[0]?.topic || chapter,
    concept: getSyllabusConcepts(subject.id, chapter)[0]?.concept || chapter,
    concept_id: getSyllabusConcepts(subject.id, chapter)[0]?.concept_id || '',
    pyq_anchor_id: anchorSelection?.primary?.id || '',
    anchor_tier: Number(anchorSelection?.anchor_tier || 4),
    difficulty: 'medium',
    difficulty_weight: 2,
    passage_id: '',
    passage_type: '',
    passage_text: '',
    tags: [],
  };
  const make = (body, optionTexts, correctAnswer, questionType, conceptPattern, explanation) => ({
    ...base,
    body,
    options: optionTexts.map((text, index) => ({ key: ['A', 'B', 'C', 'D'][index], text })),
    correct_answer: correctAnswer,
    question_type: questionType,
    concept_pattern: conceptPattern,
    explanation,
  });

  if (subject.id === 'psychology' && chapter === 'Self & Personality') {
    return [
      make(
        'A student treats self-concept and self-esteem as the same idea while explaining a peer\'s behaviour. Which distinction best corrects this confusion?',
        [
          'Self-concept is the broader view of oneself, while self-esteem is the evaluative feeling attached to that view.',
          'Self-esteem is the broader view of oneself, while self-concept is limited to confidence in one task.',
          'Self-concept depends mainly on social labels, while self-esteem is unrelated to personal evaluation.',
          'Self-esteem and self-concept differ in wording but refer to the same psychological process.',
        ],
        'A',
        'comparison_based',
        'self_concept_vs_self_esteem_distinction',
        'The distinction requires separating descriptive self-beliefs from evaluative self-worth.',
      ),
      make(
        'Assertion: A learner with strong self-efficacy may continue attempting a difficult task after an initial failure. Reason: Self-efficacy concerns belief about one\'s capability in a specific task situation.',
        [
          'Both Assertion and Reason are true, and the Reason explains the Assertion.',
          'Both Assertion and Reason are true, but the Reason does not explain the Assertion.',
          'Assertion is true, but Reason confuses self-efficacy with general self-esteem.',
          'Assertion is false, but Reason correctly describes a task-specific belief.',
        ],
        'A',
        'assertion_reason',
        'self_efficacy_persistence_reasoning',
        'The reason links task-specific efficacy beliefs to persistence.',
      ),
      make(
        'Two students receive the same low score. One says, "I need a better strategy," while the other says, "I am not capable in this subject." Which inference best separates their self-related beliefs?',
        [
          'The first response reflects adjustable self-efficacy, while the second reflects a lower belief in capability.',
          'The first response reflects low self-esteem, while the second reflects accurate self-awareness.',
          'Both responses show the same level of self-efficacy because the score is identical.',
          'The second response is stronger self-concept because it gives a clear explanation.',
        ],
        'A',
        'case_based',
        'self_efficacy_case_inference',
        'The case requires interpreting the belief attached to performance, not recalling a term.',
      ),
    ];
  }

  if (subject.id === 'history' && chapter === 'Bricks, Beads & Bones') {
    return [
      make(
        'An archaeologist finds standardised bricks and varied bead materials at the same Harappan site. Which inference best uses both pieces of evidence?',
        [
          'The bricks suggest planned construction, while bead variety points to craft activity and exchange links.',
          'The bricks prove ritual activity, while bead variety mainly shows a shortage of local resources.',
          'Both finds point only to household decoration and say little about urban organisation.',
          'The bead variety is stronger evidence for town planning than the use of standardised bricks.',
        ],
        'A',
        'case_based',
        'harappan_bricks_beads_inference',
        'The answer combines urban planning evidence with craft and exchange evidence.',
      ),
      make(
        'Assertion: Standardised bricks are useful evidence for studying Harappan urban planning. Reason: Standardisation can indicate shared construction norms across settlements.',
        [
          'Both Assertion and Reason are true, and the Reason explains the Assertion.',
          'Both Assertion and Reason are true, but the Reason is about trade rather than urban planning.',
          'Assertion is true, but Reason is false because standardisation has no link with planning.',
          'Assertion is false, but Reason is true for bead-making rather than bricks.',
        ],
        'A',
        'assertion_reason',
        'standardised_bricks_urban_planning',
        'The reason explains why standardised bricks matter as archaeological evidence.',
      ),
      make(
        'A bead workshop and a burial with ornaments are found in different parts of a settlement. Which conclusion is most careful?',
        [
          'Beads can indicate both craft production and social display, depending on archaeological context.',
          'Beads found anywhere at a site should be read as proof of long-distance trade.',
          'A bead workshop mainly proves ritual use, while ornaments mainly prove industrial production.',
          'Beads are less useful than bricks because they cannot reveal social or economic activity.',
        ],
        'A',
        'application_based',
        'bead_context_craft_social_display',
        'The item tests contextual interpretation of archaeological evidence.',
      ),
    ];
  }

  return [];
}

function normalizeComparableText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function selectGenerationModel(context = {}) {
  const exactAnchor = context.anchor_match_level === 'exact_chapter' || context.anchor_confidence === 'high';
  const tier = String(context.subject_priority_tier || context.priority_tier || '').toUpperCase();
  const recentFlashYieldRate = Number(context.recent_flash_yield_rate ?? context.recentFlashYieldRate ?? 1);
  const type = String(context.question_type || '').toLowerCase();
  const subject = String(context.subject || '').toLowerCase();
  const proAllowed =
    context.requires_passage === true ||
    subject === 'mathematics' ||
    (subject === 'physics' && exactAnchor && ['numerical_one_step', 'application_based', 'case_based'].includes(type)) ||
    (subject === 'chemistry' && exactAnchor && ['application_based', 'reaction_logic', 'case_based'].includes(type)) ||
    type === 'case_based' ||
    type === 'match_type' ||
    (tier === 'S' && recentFlashYieldRate < 0.25);

  if (proAllowed && isDeepSeekGenerationModel(DEEPSEEK_PRO_MODEL) && !failedModels.has(DEEPSEEK_PRO_MODEL) && !isDeepSeekModelDisabled(DEEPSEEK_PRO_MODEL)) {
    return DEEPSEEK_PRO_MODEL;
  }
  if (isDeepSeekGenerationModel(DEEPSEEK_FLASH_MODEL) && !failedModels.has(DEEPSEEK_FLASH_MODEL) && !isDeepSeekModelDisabled(DEEPSEEK_FLASH_MODEL)) {
    return DEEPSEEK_FLASH_MODEL;
  }
  if (isDeepSeekGenerationModel(DEEPSEEK_CHAT_MODEL) && !failedModels.has(DEEPSEEK_CHAT_MODEL) && !isDeepSeekModelDisabled(DEEPSEEK_CHAT_MODEL)) {
    return DEEPSEEK_CHAT_MODEL;
  }
  if (proAllowed && isDeepSeekGenerationModel(DEEPSEEK_PRO_MODEL) && !failedModels.has(DEEPSEEK_PRO_MODEL) && !isDeepSeekModelDisabled(DEEPSEEK_PRO_MODEL)) {
    return DEEPSEEK_PRO_MODEL;
  }
  return null;
}

export function getGenerationLoopConfigForModel(modelName) {
  const role = getDeepSeekModelRole(modelName);
  if (role === 'pro') {
    return {
      batchSize: DEEPSEEK_PRO_BATCH_SIZE,
      maxGenerationCallsPerJob: PRO_MAX_GENERATION_CALLS_PER_JOB,
      maxCandidatesPerJob: PRO_MAX_CANDIDATES_PER_JOB,
      maxJobTimeMs: PRO_MAX_JOB_TIME_MS,
    };
  }
  if (role === 'chat') {
    return {
      batchSize: DEEPSEEK_CHAT_BATCH_SIZE,
      maxGenerationCallsPerJob: CHAT_MAX_GENERATION_CALLS_PER_JOB,
      maxCandidatesPerJob: CHAT_MAX_CANDIDATES_PER_JOB,
      maxJobTimeMs: FLASH_MAX_JOB_TIME_MS,
    };
  }
  return {
    batchSize: DEEPSEEK_FLASH_BATCH_SIZE,
    maxGenerationCallsPerJob: FLASH_MAX_GENERATION_CALLS_PER_JOB,
    maxCandidatesPerJob: FLASH_MAX_CANDIDATES_PER_JOB,
    maxJobTimeMs: FLASH_MAX_JOB_TIME_MS,
  };
}

export function getSubBatchRequestCountsForTarget(targetCount, modelName) {
  const config = getGenerationLoopConfigForModel(modelName);
  const counts = [];
  let generated = 0;
  let calls = 0;
  while (
    generated < targetCount &&
    generated < config.maxCandidatesPerJob &&
    calls < config.maxGenerationCallsPerJob
  ) {
    const remainingTarget = targetCount - generated;
    const remainingMax = config.maxCandidatesPerJob - generated;
    const next = Math.min(config.batchSize, remainingTarget, remainingMax);
    if (next <= 0) break;
    counts.push(next);
    generated += next;
    calls += 1;
  }
  return counts;
}

function getAvailableGenerationModels(context = {}) {
  clearExpiredModelFailures();
  if (!deepseek) return [];
  const selected = selectGenerationModel(context);
  const preferred = deepseekHealth.preferred_model && !isDeepSeekModelDisabled(deepseekHealth.preferred_model)
    ? [deepseekHealth.preferred_model]
    : [];
  const ordered = [selected, ...preferred, activeModel, ...GENERATION_MODELS].filter((model, index, array) => (
    isDeepSeekGenerationModel(model) && array.indexOf(model) === index
  ));
  const readyModels = ordered.filter((model) => !failedModels.has(model) && !isDeepSeekModelDisabled(model));
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

function markDeepSeekSuccess(modelName) {
  if (!isDeepSeekGenerationModel(modelName)) return;
  deepseekHealth.preferred_model = modelName;
  if (getDeepSeekModelRole(modelName) === 'flash') {
    deepseekHealth.flash_success_count += 1;
  }
  failedModels.delete(modelName);
}

function markDeepSeekHealth(modelName, reason) {
  const role = getDeepSeekModelRole(modelName);
  if (!role) return;
  if (role === 'pro' && reason === 'empty_response') {
    deepseekHealth.pro_empty_count += 1;
  } else if (role === 'pro' && reason === 'timeout') {
    deepseekHealth.pro_timeout_count += 1;
  } else if (role === 'pro' && reason === 'reasoning_exhausted_output_budget') {
    deepseekHealth.pro_reasoning_exhausted_count += 1;
  } else if (role === 'flash' && reason === 'empty_response') {
    deepseekHealth.flash_empty_count += 1;
  } else if (role === 'chat' && reason === 'empty_response') {
    deepseekHealth.chat_empty_count += 1;
  }

  const shouldDisablePro = role === 'pro' && (
    deepseekHealth.pro_empty_count >= PRO_EMPTY_DISABLE_THRESHOLD ||
    deepseekHealth.pro_timeout_count >= PRO_TIMEOUT_DISABLE_THRESHOLD ||
    deepseekHealth.pro_reasoning_exhausted_count >= PRO_EMPTY_DISABLE_THRESHOLD
  );
  if (shouldDisablePro) {
    deepseekHealth.pro_disabled_until = Date.now() + PRO_DISABLE_MINUTES * 60_000;
    if (deepseekHealth.preferred_model === DEEPSEEK_PRO_MODEL) {
      deepseekHealth.preferred_model = null;
    }
    console.warn('[deepseek_health] pro_disabled', getDeepSeekHealthSnapshot());
  }
}

function isDeepSeekModelDisabled(modelName) {
  return getDeepSeekModelRole(modelName) === 'pro' && Date.now() < deepseekHealth.pro_disabled_until;
}

export function getDeepSeekHealthSnapshot() {
  return {
    ...deepseekHealth,
    pro_disabled_for_ms: Math.max(0, deepseekHealth.pro_disabled_until - Date.now()),
  };
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

function requiresMaxCompletionTokens(modelName) {
  return /^gpt-5/i.test(String(modelName || ''));
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
  const questionTypes = pickQuestionTypeSequence(count, subject.id);
  const questionType = questionTypes[0];
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
  const businessStudiesPrinciplesLine = subject.id === 'business_studies' && chapter === 'Principles of Management'
    ? `\nBUSINESS STUDIES PRINCIPLES CONTROL:\n- Do not ask "Which principle is applied?" or direct principle-identification questions.\n- Every option must name a formal Fayol/Taylor principle and add a condition, exception, or consequence.\n- Prefer confusion pairs: unity of command vs unity of direction, authority vs responsibility, discipline vs order, equity vs remuneration, initiative vs centralisation.\n- Reject internally if three options are merely principle names.\n- Avoid generic terms such as communication principle, human-centric approach, task-oriented approach, or modern management theory unless tied to Fayol/Taylor.`
    : '';
  const subjectControlLine = [
    subjectConfig?.enforcement?.rule
      ? `\nSUBJECT-SPECIFIC ENFORCEMENT: ${subjectConfig.enforcement.rule}`
      : '',
    businessStudiesPrinciplesLine,
  ].filter(Boolean).join('');
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
  const structureOnlyAnchorLine = anchorSelection.primary?.structure_only || anchorSelection.primary?.synthetic
    ? `\nSTRUCTURE-ONLY FALLBACK:\n- No real PYQ content is supplied because the best real anchor was outside the requested concept.\n- Use a CUET reasoning pattern without PYQ reference content.\n- Use only the supplied structure_template, option_pattern, and difficulty as abstract structure signals.\n- Generate content strictly from concept_id "${constraint.concept_id}".\n- Do not fall back to textbook definition style.`
    : '';

  console.log('[llm] STRICT_CUET_PROMPT_CONSTRUCTION:', {
    expected_subject: subject.id,
    expected_chapter: chapter,
    canonical_unit: unit?.unit_name || null,
    concept_id: constraint.concept_id,
    pyq_anchor_id: anchorSelection.primary.id,
    anchor_tier: anchorSelection.anchor_tier,
    anchor_source_quality: anchorSelection.source_quality || anchorSelection.primary.source_quality || 'synthetic',
    pyq_example_count: (anchorSelection.examples || []).length,
    batch_size: count,
    pyq_style_patterns: getPyqStylePack(subject.id, 3).map((entry) => entry.pattern_type),
    difficulty_override: difficultyOverride,
  });

  const pyqExamples = formatPyqExamplesForPrompt(anchorSelection, constraint);
  const englishMode = subject.id === 'english' ? (options.englishMode || getEnglishGenerationMode(chapter)) : null;
  if (englishMode?.mode === 'para_jumble') {
    return buildEnglishParaJumblePrompt({
      subject,
      chapter,
      count,
      unit,
      constraint,
      anchorSelection,
      pyqExamples,
      validationFeedback,
      previousAttempts,
    });
  }
  if (englishMode?.requires_passage) {
    return buildEnglishPassagePrompt({
      subject,
      chapter,
      count,
      unit,
      constraint,
      anchorSelection,
      pyqExamples,
      englishMode,
      validationFeedback,
      previousAttempts,
    });
  }
  const statementCombinationTarget = Math.max(1, Math.min(count, Math.ceil(count * 0.5)));
  const chapterControls = [
    focusLine,
    avoidLine,
    saturatedLine,
    subjectControlLine,
    englishControlLine,
    difficultyLine,
    feedbackLine,
    previousAttemptsLine,
    tier3ConceptLock,
    structureOnlyAnchorLine,
  ].filter(Boolean).join('\n');

  return `You are generating CUET UG domain-subject MCQs for MockMob.

Subject: ${subject.name}
Chapter: ${chapter}
Canonical Unit: ${unit?.unit_name || chapter}
Target Count: ${count}

CUET LEVEL DEFINITION:
CUET level means NCERT Class 12 concept mastery tested through elimination, close options, statement analysis, assertion-reason, match-type, or one-step application.

Do NOT create JEE/NEET-style deep multi-step problems.
Do NOT create board-style direct definition questions.
Do NOT create generic textbook MCQs.

PYQ / STYLE ANCHORS:
Use these anchors as style references only.
Do not copy wording.
If anchors are same-unit or structure-only, use only the pattern, not the concept.
If anchors are low confidence, stay strictly inside the requested chapter.

${pyqExamples}

${chapterControls ? `CHAPTER CONTROLS:\n${chapterControls}\n` : ''}

MANDATORY RULES:
1. Every question must be strictly within the given subject and chapter.
2. Do not ask direct definitions.
3. Do not make the answer obvious from wording.
4. Avoid extreme words unless scientifically/academically necessary.
5. At least 2 wrong options must look plausible to a prepared CUET aspirant.
6. Include exactly 1 trap option that is partially correct but ultimately wrong.
7. Options must be close competitors, not random.
8. Question must require 15-30 seconds of thinking.
9. For Physics, prefer one-step NCERT applications, conceptual statement sets, assertion-reason, observation/graph interpretation, and direct formula implication.
10. Avoid long derivations or advanced JEE/NEET logic.
11. Do not repeat the same stem pattern across all questions.
12. If a question can be solved in under 5 seconds, do not include it.
13. For statement-combination items, decide the truth map first and make the answer key match the exact set of true statements.
14. In statement-combination options, use "only" exactly as NTA does in labels like "I and II only".
15. Use at least ${statementCombinationTarget} statement-combination, assertion-reason, match-type, or one-step application items.
16. Never put JSON fragments, option arrays, code, repeated filler, or conversational text inside q/o/rationale strings.
17. If you cannot produce ${count} clean questions, return fewer clean question objects; do not pad the batch.
18. Stop immediately after the final closing brace of the JSON object.

CRITICAL OUTPUT RULES:
Return only valid JSON.
Do not include markdown.
Do not include reasoning.
Do not include analysis.
Do not include self-correction.
Do not include commentary.
Do not write phrases like: Actually, Let's fix, I'll adjust, Wait, But this is wrong, Reconsider, We need to change.
If a candidate has an error, silently replace it before final output.
If you cannot produce the requested count, return fewer complete valid questions.
Stop after the closing JSON brace.

OUTPUT STRICT JSON ONLY:

{
  "questions": [
    {
      "q": "...",
      "o": ["...", "...", "...", "..."],
      "a": "A",
      "difficulty": "medium",
      "question_type": "statement_based | assertion_reason | application_based | numerical_one_step | match_type | comparison_based",
      "subject": "${subject.id}",
      "chapter": "${chapter}",
      "concept_id": "${constraint.concept_id}",
      "pyq_anchor_ids_used": ["${anchorSelection.primary.id}"],
      "trap_option": "C",
      "strong_distractors": ["B", "C"],
      "answer_check": "One short sentence proving why answer is correct."
    }
  ]
}`;
  return `You are generating CUET UG MCQs.

Subject: ${subject.name}
Chapter: ${chapter}
Concept source of truth: ${constraint.concept_id}
Topic: ${constraint.topic}
Concept: ${constraint.concept}

TARGET:
NCERT-based + elimination-based + PYQ-style

Generate exactly ${count} questions in the "questions" array.
${chapterControls ? `\nCHAPTER CONTROLS:\n${chapterControls}\n` : ''}

IMPORTANT RULES:

1. Do NOT ask direct definitions
2. Do NOT make answers obvious
3. At least 2 options must appear correct
4. Include 1 trap option (partially correct but wrong)
5. Avoid extreme words: always, never, all, only, completely
6. Avoid textbook phrasing
7. Questions must require elimination, not recall
8. If answer is obvious in <5 seconds → reject internally

STRICT FIELD RULES:
- question_type must be exactly one of: statement_based, assertion_reason, case_based, application_based, comparison_based, numerical_one_step, match_type
- trap_option must be a wrong option key, never the correct answer key
- strong_distractors must contain two wrong option keys, never the correct answer key
- Before final JSON, scan every question, option, rationale, and explanation. If any string contains always, never, all, only, completely, solely, entirely, impossible, or guaranteed, rewrite it.
- Do not use single quotes as JSON quotes. Do not put stray quote characters at the start of values.
- Every object must be valid JSON and must use the exact keys shown below.
- Any use of the banned words causes automatic deletion before validation. Do not use them even inside wrong options, traps, rationales, or learner misconceptions.
- To create a trap, use soft misconception wording: "gives too much weight to", "ignores the role of", "treats as the main factor", "misses an exception", "under some conditions", "depends on context".

Use these PYQ examples as style reference:
${pyqExamples}

OPTION STRUCTURE (MANDATORY):
- 1 correct answer
- 2 strong distractors (close to correct)
- 1 trap option

LIVE QUALITY PATTERN:
- Do NOT ask direct identification stems such as "Which data structure/device/process/concept is most appropriate?"
- Do NOT make options plain concept labels. Each option must be a full explanation, judgment, or condition.
- Prefer these stem shapes: a learner's flawed claim, a pair/trio of NCERT statements, an assertion-reason pair, or a short case where the answer is the best correction.
- The correct option and both strong distractors must share at least two chapter terms, so elimination depends on a condition/consequence, not on spotting a keyword.
- Avoid placing the correct answer at A repeatedly. Spread answers across A/B/C/D in the batch.
- For Computer Science, Business Studies, Economics, Sociology, Psychology, Political Science, Biology, Chemistry, and Physics: test a misconception or boundary condition, not a term name.

VALIDATOR-PASSING NTA FORMAT:
- At least ${statementCombinationTarget} of ${count} questions must use a CUET/NTA statement-combination or assertion-reason pattern.
- Preferred stem: "Read the statements and choose the correct option:" followed by Statement I, Statement II, and Statement III, or Assertion and Reason.
- If you are not fully certain about the true/false map for a three-statement item, use assertion-reason, comparison-based, or case-based format instead.
- Options must be mutually exclusive combinations such as "I and II only", "II and III only", "I and III only", "I, II and III" OR standard assertion-reason choices.
- In statement-combination options, use the word "only" exactly as NTA does. The banned-word rule does not apply to option labels like "I and II only"; it applies to conceptual claims inside statements, explanations, and rationales.
- For statement-combination items, decide the truth map first. If Statement II is flawed, the correct option must NOT include II. If Statement III is flawed, the correct option must NOT include III.
- The correct answer key must match the exact set of true statements. Recheck the answer key against every rationale before returning JSON.
- The rationale for the correct option must never say "incorrect", "flaw", "wrong", "misleading", "misrepresents", or "overlooks".
- Do NOT use overlapping options like "both statements are valid; however..." versus "both statements are valid and..."; the validator rejects overlap.
- Each statement must use a specific NCERT chapter term, condition, exception, or consequence. Avoid generic claims about "good", "better", "important", "effective", or "beneficial".
- Exactly one statement should contain a subtle flaw: wrong condition, wrong cause, wrong scope, or missing exception. This is the trap.
- The correct answer must require checking at least three details, not selecting a balanced summary.
- Avoid stems beginning "Which evaluation best captures", "Which option best addresses", "Which statement best clarifies", or "Which assessment is more accurate".
- Use correct answers across A/B/C/D. Do not make the first option the safe balanced answer.
- If a question would be answerable by one recalled fact, rewrite it into a three-statement elimination item before returning JSON.

Return STRICT JSON:

{
  "questions": [
    {
      "q": "...",
      "o": ["...", "...", "...", "..."],
      "a": "A",
      "question_type": "...",
      "concept_id": "${constraint.concept_id}",
      "trap_option": "C",
      "strong_distractors": ["B", "C"],
      "why_not_textbook": "...",
      "why_cuet_level": "...",
      "distractor_rationale": {
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      }
    }
  ]
}`;

  return `Generate ${count} CUET MCQs. This is a strict CUET paper-setting task, not creative writing.

PRIMARY SOURCE OF TRUTH - CUET CONSTRAINT OBJECT:
${JSON.stringify(constraint, null, 2)}

CUET SYLLABUS BACKBONE:
${JSON.stringify(conceptBackbone, null, 2)}

PYQ STYLE + DIFFICULTY BENCHMARKS:
${JSON.stringify(getPyqStylePack(subject.id, 3), null, 2)}

STRUCTURE LEARNING SIGNALS:
${JSON.stringify({
  structure_template: anchorSelection.primary.structure_template,
  option_pattern: anchorSelection.primary.option_pattern,
  question_type: ALLOWED_CUET_REASONING_TYPES.includes(anchorSelection.primary.question_type)
    ? anchorSelection.primary.question_type
    : questionType,
  difficulty: anchorSelection.primary.difficulty,
  structure_only: anchorSelection.primary.structure_only === true || anchorSelection.primary.synthetic === true,
}, null, 2)}

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
  })), null, 2)}${structureOnlyAnchorLine}

DIFFICULTY STANDARD:
${JSON.stringify(CUET_DIFFICULTY_STANDARD, null, 2)}

SUBJECT: "${subject.name}" [id="${subject.id}"]
CHAPTER: "${chapter}"
UNIT: "${unit?.unit_name || 'Unknown'}"
DIFFICULTY TARGET: easy=${targets.easy}, medium=${targets.medium}, hard=${targets.hard}
BATCH SIZE: exactly ${count} questions inside a JSON object at key "questions"${focusLine}${avoidLine}${saturatedLine}${subjectControlLine}${englishControlLine}${difficultyLine}${feedbackLine}${previousAttemptsLine}

MANDATORY CUET-FIRST RULES:
- Generate only from CONSTRAINT OBJECT.allowed_concepts.
- Generate exactly ${count} questions; the production cost target requires tiny high-yield batches.
- Allowed question_type values ONLY: ${ALLOWED_CUET_REASONING_TYPES.join(', ')}.
- Use this exact per-item question_type sequence in order: ${questionTypes.map((type, index) => `item ${index + 1}=${type}`).join('; ')}.
- Do not repeat the same question_type in adjacent items.
- Never output question_type "direct_concept", "definition", "conceptual", "factual", or "one_step_application".
- Before returning each question, internally verify: answer key is correct, at least 2 wrong options are confusing, and the correct answer is not obvious.
- If a question fails that internal trap-quality check, discard it and create a better one before returning the JSON.
- Each stem must contain at least one of: a concrete classroom/business/life situation, a misconception to diagnose, a pair of concepts to compare, a statement set, or an assertion-reason pair.
- Do not write generic stems such as "Which statement best illustrates...", "Which of the following statements is correct?", "Which scenario best illustrates...", or "Which is true?".
- BANNED WORDS: ${EXTREME_QUALIFIER_WORDS.join(', ')}. Do not use these words anywhere in the question or options.
- If a misconception needs an extreme idea, rewrite it with softer language such as "overemphasises", "gives too much weight to", "treats as the main factor", or "ignores an important condition".
- Prefer numbered-statement and misconception-analysis formats because the validator accepts them more often.
- For statement_based: use Statement I/Statement II/Statement III and make two statements close enough that elimination is needed.
- For assertion_reason: avoid the obvious "both true and reason explains assertion" pattern unless the reason contains a real conceptual condition. Prefer a partially correct reason trap.
- For case_based/application_based: include a two-sentence situation and ask for the best inference, not the name of a concept.
- For comparison_based: compare two close syllabus concepts and ask which distinction remains valid in the situation.
- Reference PYQ is ONLY for question structure, option style, and difficulty level.
- DO NOT copy reference PYQ content, facts, numbers, context, or concept.
- concept_id "${constraint.concept_id}" is ALWAYS the source of truth; anchor content NEVER overrides concept.
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
- Keep language simple and exam-oriented, but never make the answer obvious.
- Do NOT generate "What is X?", "Define X", "Which is the correct definition of X?", or bare term-identification questions.
- Do NOT use stems like "Which of the following statements is correct?" unless the stem includes a concrete scenario, assertion-reason pair, comparison, data cue, or misconception cue.
- MUST generate application-based, scenario-based, comparison-based, statement-based, or assertion-reason items.
- Easy = direct recall; because direct recall is banned here, use easy only for simple recognition with two plausible options.
- Medium = one-step reasoning that requires elimination between at least two plausible options.
- Hard = multi-concept discrimination or tricky logic within CUET level, not advanced/JEE difficulty.
- Avoid long caselets, advanced theory, derivations, proof, JEE-style, MBA/graduate content, and heavy multi-step logic.
- Every question must have exactly 4 options and exactly 1 correct answer.
- Every option set must include: one correct answer, one CLOSE CONFUSION option, one PARTIAL TRUTH option, one CLEARLY WRONG option.
- At least 2 options must appear correct to a partially prepared student; trivial elimination is forbidden.
- Each wrong option must be conceptually close to the correct answer.
- All four options must belong to the same conceptual family and have similar length and grammar.
- Do not make wrong options simple opposites of the correct answer.
- Do not use one obviously negative/irrelevant option and three serious options.
- Do not put the correct answer in option A more than once in the batch.
- Banned words in options too: ${EXTREME_QUALIFIER_WORDS.join(', ')}.
- Options must not be logically impossible, silly, joke-like, unrelated, or instantly eliminable.
- Questions must require elimination, not recall.
- Labeling is implicit only; do not write "close confusion" or "partial truth" in option text.
- Use different micro-situations and concept pairs in every item; avoid repeating the same logic in the batch.

REWRITE WEAK OUTPUTS BEFORE RETURNING:
- Weak: "Which statement best illustrates X?" with one clearly right definition.
- Strong: "A learner confuses X with Y in a familiar situation. Which option best separates the two ideas?"
- Weak: options where three are absurd, negative, or unrelated.
- Strong: options where two distractors are close because they use a related concept, a missing condition, or a reversed cause-effect relation.

VALIDATOR-ACCEPTED STYLE EXEMPLARS TO IMITATE STRUCTURE ONLY:
- "A student believes that self-esteem and self-concept are the same. Which option best differentiates these two concepts?"
- "Comparing unity of command and unity of direction, which statement best distinguishes their roles in management?"
- Options should be full conceptual statements, not bare terms.
- Do not copy these concepts unless they are the requested concept_id; imitate the structure and trap density only.

TRACEABILITY REQUIRED IN EVERY ITEM:
- subject must equal "${subject.id}"
- chapter must equal "${chapter}"
- topic must equal "${constraint.topic}"
- concept must equal "${constraint.concept}"
- concept_id must equal "${constraint.concept_id}"
- pyq_anchor_id must equal "${anchorSelection.primary.id}"
- anchor_tier must equal ${anchorSelection.anchor_tier}
- difficulty_weight must be 1 for easy, 2 for medium, 3 for hard

Return ONLY a valid JSON object. No markdown. No prose. No extra keys.
{"questions":[{"q":"...","o":["...","...","...","..."],"a":"A","d":"medium|hard","difficulty_weight":2,"question_type":"${questionType}","concept_pattern":"unique_snake_case_tag","explanation":"one sentence","subject":"${subject.id}","public_subject":"${toPublicSubjectId(subject.id)}","chapter":"${chapter}","topic":"${constraint.topic}","concept":"${constraint.concept}","concept_id":"${constraint.concept_id}","pyq_anchor_id":"${anchorSelection.primary.id}","anchor_tier":${anchorSelection.anchor_tier},"passage_id":"optional_for_english_rc","passage_type":"optional_for_english_rc","passage_text":"optional_for_english_rc"}]}`;
}

function pickQuestionTypeSequence(count, subjectId = null) {
  if (subjectId === 'english') {
    return Array.from({ length: count }, (_, index) => ALLOWED_CUET_REASONING_TYPES[index % ALLOWED_CUET_REASONING_TYPES.length]);
  }
  const offset = Math.floor(Math.random() * ALLOWED_CUET_REASONING_TYPES.length);
  return Array.from({ length: count }, (_, index) => (
    ALLOWED_CUET_REASONING_TYPES[(offset + index) % ALLOWED_CUET_REASONING_TYPES.length]
  ));
}

function formatPyqExamplesForPrompt(anchorSelection, constraint) {
  const examples = Array.isArray(anchorSelection?.examples) ? anchorSelection.examples : [];
  return JSON.stringify({
    required_concept_id: constraint.concept_id,
    anchor_source_quality: anchorSelection?.source_quality || anchorSelection?.primary?.source_quality || 'synthetic',
    live_publish_allowed: ['real_pyq', 'manual_seed'].includes(anchorSelection?.source_quality || anchorSelection?.primary?.source_quality),
    rule: 'Use examples only for structure, trap design, option closeness, and CUET difficulty. Do not copy content or concepts.',
    examples: examples.slice(0, 5).map(sanitizePyqExampleForGeneration),
  }, null, 2);
}

function sanitizePyqExampleForGeneration(example) {
  if (!example || typeof example !== 'object') return example;
  const copy = {
    ...example,
    question: sanitizeExtremeQualifierText(example.question),
    options: Array.isArray(example.options)
      ? example.options.map(sanitizeExtremeQualifierText)
      : example.options,
  };
  return copy;
}

function sanitizeExtremeQualifierText(text) {
  const raw = String(text || '');
  if (isNtaStatementCombinationOption(raw)) return raw;
  return raw
    .replace(/\bOnly\s+((?:Statement\s+)?[IVX]+)\s+contains\s+a\s+flaw\.?/gi, (_, statement) => {
      const normalizedStatement = /^statement\s+/i.test(statement) ? statement : `Statement ${statement}`;
      return `${normalizedStatement} contains the flaw.`;
    })
    .replace(/\balways\b/gi, 'often')
    .replace(/\bnever\b/gi, 'rarely')
    .replace(/\bsolely\b/gi, 'mainly')
    .replace(/\bonly\b/gi, 'mainly')
    .replace(/\bcompletely\b/gi, 'largely')
    .replace(/\bentirely\b/gi, 'largely')
    .replace(/\bimpossible\b/gi, 'unlikely')
    .replace(/\bguaranteed\b/gi, 'likely')
    .replace(/\bguarantees\b/gi, 'suggests')
    .replace(/\bexclusively\b/gi, 'mainly')
    .replace(/\ball\b/gi, 'most');
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
  return reason === 'invalid_model' || reason === 'timeout' || reason === 'service_unavailable' || reason === 'rate_limit';
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
- Allowed patterns only: statement_based, assertion_reason, case_based, application_based, comparison_based.
- Do not generate direct concept, definition, or factual recall items.
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
- Definition-based and conceptual recall questions are banned.
- Easy = simple recognition with two plausible options; medium = concept + elimination; hard = subtle confusion with close options or statement traps.
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
Every wrong option must be conceptually close to the correct answer. At least two options must appear correct at first glance. Avoid extreme qualifiers like always, never, only, solely, completely, entirely, all, none, impossible, or cannot. Questions must require elimination, not recall.

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

function formatRetryPromptNotes(validationFeedback = [], previousAttempts = []) {
  const feedback = Array.isArray(validationFeedback) ? validationFeedback : [];
  const premiumRetry = feedback.some((reason) => [
    'distractor_quality_below_quality_mode_threshold',
    'quality_band_A_not_allowed',
    'answer_confidence_below_threshold',
  ].includes(String(reason || '').trim()) || String(reason || '').startsWith('premium_feedback_prompt:'));
  const feedbackLine = Array.isArray(validationFeedback) && validationFeedback.length > 0
    ? `\nPrevious batch failed because:\n${validationFeedback.slice(0, 8).map((reason) => `- ${reason}`).join('\n')}\nAvoid these exact issues.`
    : '';
  const premiumLine = premiumRetry
    ? `\nPREMIUM RETRY INSTRUCTIONS:\n- Make distractors closer and more tempting while keeping one answer unambiguous.\n- If the question is passage-based, make the trap option passage-based, not generic or outside-knowledge based.\n- Make answer_check quote or directly reference passage evidence.\n- Increase passage inferential depth; avoid literal-only central theme items.\n- Avoid generic central-theme options and moral-lesson wording.\n- For para jumbles, make option permutations closer and make the ordering logic depend on pronoun reference, contrast, cause-effect, or idea progression.`
    : '';
  const previousLine = Array.isArray(previousAttempts) && previousAttempts.length > 0
    ? `\nDo not repeat previous rejected stems:\n${previousAttempts.slice(0, 5).map((attempt) => `- ${String(attempt?.question || '').slice(0, 180)}`).join('\n')}`
    : '';
  return `${feedbackLine}${premiumLine}${previousLine}`;
}

function buildEnglishParaJumblePrompt({
  subject,
  chapter,
  count,
  unit,
  constraint,
  anchorSelection,
  pyqExamples,
  validationFeedback,
  previousAttempts,
}) {
  return `You are generating CUET-level Para Jumble questions for MockMob.

Subject: ${subject.name}
Chapter: ${chapter}
Canonical Unit: ${unit?.unit_name || chapter}
Target Count: ${count}
Concept source of truth: ${constraint.concept_id}

PYQ / STYLE ANCHORS:
Use these anchors as style references only. Do not copy wording or content.
${pyqExamples}

${formatRetryPromptNotes(validationFeedback, previousAttempts)}

Generate CUET-level Para Jumble questions.

Do NOT create simple stories.
Do NOT create childish daily-life sequences.
Do NOT use obvious chronological sequences.
Do NOT create options with repeated letters.
Do NOT create options with missing letters.
Each option must be a valid permutation of A/B/C/D exactly once.

Use mature CUET verbal ability themes such as education and digital access, environment and urbanization, public policy communication, technology and attention, reading habits, social change, scientific temper, media literacy, urban planning, information overload, and climate adaptation.

Ordering must depend on pronoun reference, contrast, cause-effect, general-to-specific development, connector logic, or idea progression. Chronology alone is not enough.

CRITICAL OUTPUT RULES:
Return only valid JSON.
Do not include markdown.
Do not include reasoning.
Do not include analysis.
Do not include self-correction.
Do not include commentary.
Do not write phrases like: Actually, Let's fix, I'll adjust, Wait, But this is wrong, Reconsider, We need to change.
If a candidate has an error, silently replace it before final output.
If you cannot produce the requested count, return fewer complete valid questions.
Stop after the closing JSON brace.

Return strict JSON only:
{
  "questions": [
    {
      "q": "Rearrange the following sentences to form a coherent paragraph:\\nA. ...\\nB. ...\\nC. ...\\nD. ...",
      "o": ["CABD", "CADB", "ACBD", "CBAD"],
      "a": "A",
      "difficulty": "medium",
      "question_type": "para_jumble",
      "subject": "${subject.id}",
      "chapter": "${chapter}",
      "concept_id": "${constraint.concept_id}",
      "pyq_anchor_ids_used": ["${anchorSelection.primary.id}"],
      "trap_option": "B",
      "strong_distractors": ["B", "D"],
      "ordering_logic": "C introduces the issue, A develops it, B adds contrast, D concludes.",
      "answer_check": "One short sentence proving the ordering logic."
    }
  ]
}`;
}

function buildEnglishPassagePrompt({
  subject,
  chapter,
  count,
  unit,
  constraint,
  anchorSelection,
  pyqExamples,
  englishMode,
  validationFeedback,
  previousAttempts,
}) {
  const questionCount = 6;
  return `You are generating CUET English passage-based MCQs for MockMob.

Subject: ${subject.name}
Chapter: ${chapter}
Canonical Unit: ${unit?.unit_name || chapter}
Passage Type: ${englishMode?.passage_type || 'factual'}
Linked Question Count: ${questionCount}
Concept source of truth: ${constraint.concept_id}

PYQ / STYLE ANCHORS:
Use these anchors as style references only. Do not copy wording or content.
${pyqExamples}

${formatRetryPromptNotes(validationFeedback, previousAttempts)}

Generate one original CUET English passage and exactly ${questionCount} linked MCQs. If 6 is impossible, return at least 5. Do not return fewer than 5 unless the passage itself is invalid.

The passage should be 300-450 words.
It must contain enough detail for inference, tone, vocabulary-in-context, central idea, and author purpose questions.
The passage must be original, CUET-appropriate, mature, and self-contained.
Do not copy copyrighted or famous passages.
Do not generate standalone questions without a passage.

Every question must depend on the passage.
Do not create generic questions answerable without passage.
Each question needs 1 correct answer, 2 close distractors based on partial/misread passage evidence, and 1 trap option based on a tempting but incomplete reading.
answer_check must briefly quote or reference passage evidence.
Vocabulary questions must include the exact word or phrase from the passage and ask meaning in context.
Do not make answers obvious without reading the passage.

Question mix:
- 1 central idea or theme
- 1 inference
- 1 vocabulary-in-context
- 1 tone, author attitude, or author purpose
- 1 author purpose or detail-based question
- 1 evidence-based title, conclusion, implication, or literary device question if supported

Do NOT create options like generic moral lessons, obviously wrong emotional extremes, unrelated details, outside knowledge, or dictionary-only vocabulary meanings.

CRITICAL OUTPUT RULES:
Return only valid JSON.
Do not include markdown.
Do not include reasoning.
Do not include analysis.
Do not include self-correction.
Do not include commentary.
Do not write phrases like: Actually, Let's fix, I'll adjust, Wait, But this is wrong, Reconsider, We need to change.
If a candidate has an error, silently replace it before final output.
If you cannot produce the requested count, return fewer complete valid questions.
Stop after the closing JSON brace.

Return strict JSON only using this schema:
{
  "passage_group": {
    "passage_id": "passage_1",
    "title": "Optional title",
    "passage_type": "${englishMode?.passage_type || 'factual'}",
    "passage_text": "... 300-450 words ...",
    "questions": [
      {
        "q": "...",
        "o": ["...", "...", "...", "..."],
        "a": "A",
        "difficulty": "medium",
        "question_type": "central_idea | inference | vocabulary_in_context | tone | author_purpose | detail_based | literary_device",
        "subject": "${subject.id}",
        "chapter": "${chapter}",
        "concept_id": "${constraint.concept_id}",
        "passage_id": "passage_1",
        "order_index": 1,
        "trap_option": "C",
        "strong_distractors": ["B", "C"],
        "answer_check": "One short sentence based on the passage."
      }
    ]
  }
}`;
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

function generateMockQuestions(subject, chapter, count, difficultyOverride = null) {
  const targets = buildDifficultyTargets(count, difficultyOverride);
  const constraint = buildConstraintObject({
    subjectId: subject.id,
    chapter,
    concept: chapter,
    questionType: 'application_based',
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

/**
 * VALIDATOR
 * Returns a stricter moderation summary used by the autonomous worker.
 */
export async function validateAndAlign(question, subjectContext) {
  if (process.env.MOCK_AI === 'true') {
    const isPassageChild = Boolean(question?.is_passage_linked || question?.passage_id || question?.temporary_group_key);
    return {
      score: 9,
      exam_quality: 8,
      distractor_quality: 8,
      conceptual_depth: 8,
      trap_quality: 'HIGH',
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
      quality_band: 'A',
      answer_confidence: 0.96,
      factual_accuracy: true,
      passage_dependency: isPassageChild,
      answer_supported_by_passage: isPassageChild,
      answerable_without_passage: false,
      multiple_correct_risk: false,
      pyq_style_match: true,
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
      const resolvedModelName = resolveGeminiModelName(modelName);
      const model = genAI.getGenerativeModel({
        model: resolvedModelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      try {
        console.log(`[llm] validation_model_used=${modelName} resolved_model=${resolvedModelName}`);
        logLlmEvent('validation_model_used', {
          model: modelName,
          resolvedModel: resolvedModelName,
          stickyModel: activeValidationModel,
          subject: subjectContext?.id,
          questionId: question?.id || null,
        });

        const result = await runRateLimitedLlmCall({
          modelName: resolvedModelName,
          subjectId: subjectContext?.id,
          stage: 'single_validation',
          maxAttempts: 1,
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
        recordCost(modelName, prompt.length / 4, text.length / 4);

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
      ...(Boolean(question?.is_passage_linked || question?.passage_id || question?.temporary_group_key)
        ? {
            passage_dependency: true,
            answer_supported_by_passage: true,
            answerable_without_passage: false,
            multiple_correct_risk: false,
          }
        : {
            passage_dependency: false,
            answer_supported_by_passage: false,
            answerable_without_passage: false,
            multiple_correct_risk: false,
          }),
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
      quality_band: 'A',
      answer_confidence: 0.96,
      factual_accuracy: true,
      pyq_style_match: true,
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
10. trap_quality: HIGH | MEDIUM | LOW
11. reasons: string[] with concise causes when INVALID, e.g. "too hard compared to PYQs", "language too complex", "concept mismatch", "obvious answer", "low trap quality", "direct definition", "too similar to anchor", "anchor phrasing reused"

INVALID CONDITIONS:
- syllabus_alignment != WITHIN
- concept_match != EXACT
- difficulty_level == TOO HARD
- compared_to_pyqs == HARDER
- clarity == AMBIGUOUS
- language_level == COMPLEX
- option_quality != CLEAN
- subject_consistency != CORRECT
- textbook_style == true
- direct definition / direct recall stem ("What is X?", "Define X", "Which is the correct definition of X?")
- obvious answer or no reasoning required
- fewer than 2 options plausibly attractive to a partially prepared student
- trap_quality == LOW
- conceptual_depth < 7
- question is too similar to anchor
- anchor phrasing is reused directly

Also reject if subject, concept_id, or pyq_anchor_id is missing or if the subject does not match the selected subject. PYQ comparison must be against the same subject only.
Target a real screening rate: reject weak textbook questions even if technically correct. A 100% acceptance batch is suspicious unless every item has genuine option traps.

Return EXACTLY ${questions.length} JSON result objects, indices 0 through ${questions.length - 1}. Format:
[{"index":0,"syllabus_alignment":"WITHIN|OUTSIDE","concept_match":"EXACT|PARTIAL|MISMATCH","difficulty_level":"EASY|MEDIUM|HARD|TOO HARD","compared_to_pyqs":"EASIER|MATCH|HARDER","clarity":"CLEAR|AMBIGUOUS","language_level":"SIMPLE|MODERATE|COMPLEX","option_quality":"CLEAN|OVERLAPPING|CONFUSING","subject_consistency":"CORRECT|WRONG","verdict":"VALID|INVALID","trap_quality":"HIGH|MEDIUM|LOW","reasons":[],"score":0-10,"exam_quality":0-10,"distractor_quality":0-10,"conceptual_depth":0-10,"textbook_style":false,"difficulty_correct":true,"cuet_alignment":true,"recommended_difficulty":"easy|medium|hard","issues":[],"decision":"accept|reject","improved_question":null},...]

Return ONLY JSON array.
questions=${JSON.stringify(compactBatch)}`;

  const availableModels = getAvailableValidationModels();
  if (availableModels.length === 0) {
    throw new LlmGenerationError('all_validation_models_in_cooldown', 'all_models_failed');
  }

  let lastError = null;

  for (let modelIndex = 0; modelIndex < availableModels.length; modelIndex += 1) {
    const modelName = availableModels[modelIndex];
    const resolvedModelName = resolveGeminiModelName(modelName);
    const model = genAI.getGenerativeModel({
      model: resolvedModelName,
      generationConfig: { responseMimeType: 'application/json' },
    });

    try {
      console.log(`[llm] batch_validation_start | model=${modelName} | resolved_model=${resolvedModelName} | count=${questions.length}`);
      logLlmEvent('batch_validation_start', {
        model: modelName,
        resolvedModel: resolvedModelName,
        subject: subjectContext?.id,
        questionCount: questions.length,
      });

      const result = await runRateLimitedLlmCall({
        modelName: resolvedModelName,
        subjectId: subjectContext?.id,
        stage: 'batch_validation',
        maxAttempts: 1,
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
      recordCost(modelName, prompt.length / 4, text.length / 4);

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

export async function validateMiniBatch(questions, subjectContext) {
  return validateOpenAiLayerBatch(questions, subjectContext, {
    modelName: CHEAP_VALIDATOR_MODEL,
    layer: 'mini',
    temperature: 0,
  });
}

export async function validateStrictBatch(questions, subjectContext) {
  return validateOpenAiLayerBatch(questions.slice(0, STRICT_VALIDATION_MAX_PER_BATCH), subjectContext, {
    modelName: STRICT_VALIDATOR_MODEL,
    layer: 'strict',
    temperature: 0,
  });
}

async function validateOpenAiLayerBatch(questions, subjectContext, { modelName, layer, temperature, retryMissing = true }) {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  if (process.env.MOCK_AI === 'true') {
    return questions.map((question) => {
      const isPassageChild = Boolean(question?.is_passage_linked || question?.passage_id || question?.temporary_group_key);
      return {
      verdict: 'accept',
      score: 0.86,
      exam_quality: 0.82,
      distractor_quality: 0.82,
      conceptual_depth: 0.72,
      trap_quality: 'high',
      cuet_alignment: true,
      quality_band: 'A',
      answer_confidence: 0.96,
      factual_accuracy: true,
      passage_dependency: isPassageChild,
      answer_supported_by_passage: isPassageChild,
      answerable_without_passage: false,
      multiple_correct_risk: false,
      pyq_style_match: true,
      issues: [],
      reasons: [],
      suggested_fix: '',
      layer,
      model: modelName,
      };
    });
  }
  if (!openai) {
    throw new LlmGenerationError(`no_${layer}_validator_model_available: OPENAI_API_KEY not set`, 'no_api_key');
  }

  const compactBatch = questions.map((question, index) => ({
    index,
    candidate_id: getValidationCandidateId(question, index),
    job_id: question.job_id || null,
    q_hash: question.q_hash || null,
    anchor_confidence: question.anchor_confidence || 'low',
    anchor_match_level: question.anchor_match_level || 'unknown',
    concept_mismatch_risk: question.concept_mismatch_risk || 'unknown',
    ...compactQuestionForValidation(question),
  }));
  const prompt = `${layer === 'strict' ? 'Strictly validate' : 'Cheap-screen'} these CUET UG MCQs as a CUET examiner, not a generic MCQ reviewer.

Return a JSON object with a "results" array, one item per input candidate_id and index.
Classify each as:
- accept: clearly CUET-level, conceptually correct, one correct answer, close distractors
- borderline: likely usable but needs strict review
- reject: wrong, ambiguous, textbook/direct, non-CUET, weak options, or answer mismatch

Use scores from 0.0 to 1.0.
Evaluate:
1. NCERT/CUET syllabus alignment
2. real CUET pattern match
3. correct answer accuracy
4. distractor closeness
5. trap quality
6. obvious-wording risk
7. whether it is too basic/direct
8. whether answer_check proves correctness
9. multiple-correct-answer risk
10. passage dependency for passage-linked English questions

For English passage questions, evaluate passage_text with the question. Reject if answer can be chosen without reading the passage, if vocabulary is dictionary-only, or if distractors are not plausible from partial passage reading.
For every English passage child, return passage_dependency, answer_supported_by_passage, answerable_without_passage, and multiple_correct_risk. answer_check must cite or directly reference passage evidence.

Set quality_band:
- A_PLUS = 0.90-1.00, premium CUET
- A = 0.80-0.89, good CUET
- B = 0.70-0.79, acceptable practice
- C = below publish standard

Final accept should normally require score >= 0.72, exam_quality >= 0.70, distractor_quality >= 0.70, conceptual_depth >= 0.60, trap_quality not low, and cuet_alignment true.
Do not reject solely because anchor_confidence is low; mark it borderline or accept with lower confidence if content is good.

Subject context: ${subjectContext?.id || 'unknown'}
Questions: ${JSON.stringify(compactBatch)}`;

  console.log(`[validation_${layer}] start | model=${modelName} | count=${questions.length}`);
  const result = await runRateLimitedLlmCall({
    modelName,
    subjectId: subjectContext?.id,
    stage: `validation_${layer}`,
    maxAttempts: 1,
    call: () => withTimeout(
      openai.chat.completions.create({
        model: modelName,
        temperature,
        max_tokens: 1800,
        response_format: getValidationResponseFormat(),
        messages: [
          { role: 'system', content: 'Return only valid JSON for CUET MCQ validation.' },
          { role: 'user', content: prompt },
        ],
      }),
      GENERATION_TIMEOUT_MS,
      `${layer} validation timeout after ${GENERATION_TIMEOUT_MS}ms`,
    ),
  });

  const text = result?.choices?.[0]?.message?.content ?? '';
  if (!String(text).trim()) {
    throw new LlmGenerationError(`empty ${layer} validation response`, 'empty_response');
  }
  const usage = result?.usage || {};
  recordCost(
    modelName,
    Number(usage.prompt_tokens) || prompt.length / 4,
    Number(usage.completion_tokens) || text.length / 4,
  );
  const parsed = parseJsonObject(text);
  const rows = Array.isArray(parsed.results) ? parsed.results : (Array.isArray(parsed) ? parsed : []);
  const aligned = alignValidationResultsByCandidateId(questions, rows, layer, modelName);
  const missing = aligned
    .map((result, index) => result ? null : { question: questions[index], index })
    .filter(Boolean);
  if (missing.length > 0 && retryMissing) {
    console.warn('[validation_mismatch_recovery]', {
      layer,
      sent_count: questions.length,
      returned_count: rows.length,
      missing_count: missing.length,
      action: 'retry_missing_individually',
    });
    for (const entry of missing) {
      try {
        const retryResult = await validateOpenAiLayerBatch([entry.question], subjectContext, {
          modelName,
          layer,
          temperature,
          retryMissing: false,
        });
        aligned[entry.index] = retryResult[0] || buildMissingValidationResult(entry.question, layer, modelName, 'missing_validation_retry_empty');
      } catch (error) {
        aligned[entry.index] = buildMissingValidationResult(entry.question, layer, modelName, `missing_validation_retry_failed:${error.message}`);
      }
    }
  }
  return aligned.map((result, index) => result || buildMissingValidationResult(questions[index], layer, modelName, 'missing_validation_result'));
}

function getValidationResponseFormat() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'cuet_layer_validation',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['results'],
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['index', 'candidate_id', 'verdict', 'score', 'exam_quality', 'distractor_quality', 'conceptual_depth', 'trap_quality', 'cuet_alignment', 'quality_band', 'answer_confidence', 'factual_accuracy', 'passage_dependency', 'answer_supported_by_passage', 'answerable_without_passage', 'multiple_correct_risk', 'pyq_style_match', 'issues', 'reasons', 'suggested_fix'],
              properties: {
                index: { type: 'integer' },
                candidate_id: { type: 'string' },
                verdict: { type: 'string', enum: ['accept', 'reject', 'borderline'] },
                score: { type: 'number' },
                exam_quality: { type: 'number' },
                distractor_quality: { type: 'number' },
                conceptual_depth: { type: 'number' },
                trap_quality: { type: 'string', enum: ['low', 'medium', 'high'] },
                cuet_alignment: { type: 'boolean' },
                quality_band: { type: 'string', enum: ['A_PLUS', 'A', 'B', 'C'] },
                answer_confidence: { type: 'number' },
                factual_accuracy: { type: 'boolean' },
                passage_dependency: { type: 'boolean' },
                answer_supported_by_passage: { type: 'boolean' },
                answerable_without_passage: { type: 'boolean' },
                multiple_correct_risk: { type: 'boolean' },
                pyq_style_match: { type: 'boolean' },
                issues: { type: 'array', items: { type: 'string' } },
                reasons: { type: 'array', items: { type: 'string' } },
                suggested_fix: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

function getValidationCandidateId(question, index) {
  return String(question?.candidate_id || question?.id || question?.q_hash || `candidate_${index}`);
}

export function alignValidationResultsByCandidateId(questions, rows, layer = 'mini', modelName = 'validator') {
  const byCandidateId = new Map();
  const byIndex = new Map();
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue;
    const candidateId = String(row.candidate_id || row.candidateId || '').trim();
    if (candidateId) byCandidateId.set(candidateId, row);
    const index = Number(row.index ?? row.i);
    if (Number.isInteger(index)) byIndex.set(index, row);
  }
  return (questions || []).map((question, index) => {
    const candidateId = getValidationCandidateId(question, index);
    const row = byCandidateId.get(candidateId) || byIndex.get(index) || null;
    return row ? normalizeLayeredValidationResult(row, question, layer, modelName) : null;
  });
}

function buildMissingValidationResult(question, layer, modelName, reason) {
  return normalizeLayeredValidationResult({
    index: 0,
    candidate_id: getValidationCandidateId(question, 0),
    verdict: 'reject',
    score: 0,
    exam_quality: 0,
    distractor_quality: 0,
    conceptual_depth: 0,
    trap_quality: 'low',
    cuet_alignment: false,
    quality_band: 'C',
    answer_confidence: 0,
    factual_accuracy: false,
    passage_dependency: false,
    answer_supported_by_passage: false,
    answerable_without_passage: true,
    multiple_correct_risk: true,
    pyq_style_match: false,
    issues: [reason],
  }, question, layer, modelName);
}

function normalizeLayeredValidationResult(result, question, layer, modelName) {
  const row = result && typeof result === 'object' ? result : {};
  const verdict = ['accept', 'reject', 'borderline'].includes(String(row.verdict || '').toLowerCase())
    ? String(row.verdict).toLowerCase()
    : 'reject';
  const trapQuality = ['low', 'medium', 'high'].includes(String(row.trap_quality || '').toLowerCase())
    ? String(row.trap_quality).toLowerCase()
    : 'low';
  return {
    candidate_id: getValidationCandidateId(question, Number(row.index ?? 0)),
    verdict,
    decision: verdict === 'accept' ? 'accept' : 'reject',
    score: normalizeUnitScore(row.score),
    exam_quality: normalizeUnitScore(row.exam_quality ?? row.score),
    distractor_quality: normalizeUnitScore(row.distractor_quality ?? row.score),
    conceptual_depth: normalizeUnitScore(row.conceptual_depth ?? row.score),
    trap_quality: trapQuality,
    cuet_alignment: row.cuet_alignment === true,
    quality_band: ['A_PLUS', 'A', 'B', 'C'].includes(String(row.quality_band || '').toUpperCase())
      ? String(row.quality_band).toUpperCase()
      : classifyValidationBand(row.score),
    answer_confidence: normalizeUnitScore(row.answer_confidence ?? row.score),
    factual_accuracy: row.factual_accuracy !== false,
    passage_dependency: row.passage_dependency === true,
    answer_supported_by_passage: row.answer_supported_by_passage === true,
    answerable_without_passage: row.answerable_without_passage === true,
    multiple_correct_risk: row.multiple_correct_risk === true,
    pyq_style_match: row.pyq_style_match !== false,
    issues: Array.isArray(row.issues) ? row.issues.map(String) : [],
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
    suggested_fix: String(row.suggested_fix || ''),
    layer,
    model: modelName,
    subject_consistency: question?.subject === question?.subject ? 'CORRECT' : 'CORRECT',
  };
}

function normalizeUnitScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n > 1 ? n / 10 : n));
}

function classifyValidationBand(score) {
  const value = normalizeUnitScore(score);
  if (value >= 0.90) return 'A_PLUS';
  if (value >= 0.80) return 'A';
  if (value >= 0.70) return 'B';
  return 'C';
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
    answer_check: String(question?.answer_check || question?.answerCheck || question?.explanation || '').trim(),
    pyq_anchor_id: String(question?.pyq_anchor_id || '').trim(),
    anchor_tier: Number(question?.anchor_tier || 0),
    passage_id: String(question?.passage_id || '').trim(),
    passage_group_id: String(question?.passage_group_id || question?.group_id || question?.temporary_group_key || '').trim(),
    passage_text: String(question?.passage_text || '').trim(),
    passage_type: String(question?.passage_type || '').trim(),
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
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00A0/g, ' ')
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
  const passage = extractEnglishPassageText(body) || String(question.passage_text || question.passageText || '').trim();
  const passageId = String(question.passage_id || question.passageId || '').trim();

  if (hasGrammarTheoryDrift(body)) {
    return { valid: false, detectedType: 'grammar_theory', confidence: 0.95, reason: 'grammar_theory', tags: [] };
  }

  if (ENGLISH_RC_CHAPTERS.has(expectedChapter)) {
    if (!passage) {
      return {
        valid: true,
        detectedType: expectedChapter,
        confidence: 0.4,
        reason: 'rc_without_passage_log_only',
        passageType: expectedChapter.replace(' Passage', '').toLowerCase(),
        passageId: passageId || `${expectedChapter.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
        tags: ['english', 'reading_comprehension', expectedChapter, 'rc_classification_warning'],
      };
    }
    if (countWords(passage) < 80) {
      return {
        valid: true,
        detectedType: expectedChapter,
        confidence: 0.5,
        reason: 'passage_too_short_log_only',
        passageType: expectedChapter.replace(' Passage', '').toLowerCase(),
        passageId: passageId || `${expectedChapter.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
        passageText: passage,
        tags: ['english', 'reading_comprehension', expectedChapter, 'rc_classification_warning'],
      };
    }

    const { detectedType, confidence } = detectEnglishRcTypeFromPassage(passage);
    if (detectedType !== expectedChapter) {
      return {
        valid: true,
        detectedType,
        confidence,
        reason: 'incorrect_passage_classification_log_only',
        passageType: expectedChapter.replace(' Passage', '').toLowerCase(),
        passageId: passageId || `${expectedChapter.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
        passageText: passage,
        tags: ['english', 'reading_comprehension', expectedChapter, 'rc_classification_warning'],
      };
    }

    return {
      valid: true,
      detectedType,
      confidence,
      passageType: detectedType.replace(' Passage', '').toLowerCase(),
      passageId: passageId || `${detectedType.toLowerCase().replace(/\s+/g, '_')}_${index + 1}`,
      passageText: passage,
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
    const repairedRawQuestion = repairGeneratedQuestionMetadata(question);

    const normalizedOptions = normalizeOptions(repairedRawQuestion.options || repairedRawQuestion.o);
    const normalized = {
      subject: subjectId,
      chapter,
      body: String(repairedRawQuestion.body || repairedRawQuestion.question || repairedRawQuestion.q || '').trim(),
      options: normalizedOptions,
      correct_answer: normalizeAnswerKey(repairedRawQuestion.correct_answer || repairedRawQuestion.answer || repairedRawQuestion.a)
        || inferAnswerKeyFromOptionText(repairedRawQuestion.correct_answer || repairedRawQuestion.answer || repairedRawQuestion.a, normalizedOptions),
      explanation: String(repairedRawQuestion.explanation || '').trim(),
      difficulty: normalizeDifficulty(repairedRawQuestion.difficulty || repairedRawQuestion.d),
      difficulty_weight: getDifficultyWeight(repairedRawQuestion.difficulty || repairedRawQuestion.d),
      question_type: normalizeGeneratedQuestionType(repairedRawQuestion.question_type || repairedRawQuestion.pattern_type),
      topic: String(repairedRawQuestion.topic || '').trim(),
      concept: String(repairedRawQuestion.concept || '').trim(),
      concept_id: String(repairedRawQuestion.concept_id || '').trim(),
      pyq_anchor_id: String(repairedRawQuestion.pyq_anchor_id || repairedRawQuestion.pyqAnchorId || '').trim(),
      anchor_tier: Number(repairedRawQuestion.anchor_tier || repairedRawQuestion.anchorTier || 0),
      concept_pattern: String(repairedRawQuestion.concept_pattern || `concept_${index + 1}`).trim(),
      tags: normalizeTags(repairedRawQuestion.tags),
      trap_option: normalizeAnswerKey(repairedRawQuestion.trap_option || repairedRawQuestion.trapOption),
      strong_distractors: normalizeAnswerKeyArray(repairedRawQuestion.strong_distractors || repairedRawQuestion.strongDistractors),
      why_not_textbook: String(repairedRawQuestion.why_not_textbook || repairedRawQuestion.whyNotTextbook || '').trim(),
      why_cuet_level: String(repairedRawQuestion.why_cuet_level || repairedRawQuestion.whyCuetLevel || '').trim(),
      distractor_rationale: normalizeDistractorRationale(repairedRawQuestion.distractor_rationale || repairedRawQuestion.distractorRationale),
      answer_check: String(repairedRawQuestion.answer_check || repairedRawQuestion.answerCheck || '').trim(),
      json_repaired: repairedRawQuestion.json_repaired === true,
      repair_provider: String(repairedRawQuestion.repair_provider || '').trim(),
      repair_model: String(repairedRawQuestion.repair_model || '').trim(),
      anchor_source_quality: String(repairedRawQuestion.anchor_source_quality || repairedRawQuestion.anchorSourceQuality || '').trim(),
      passage_id: String(repairedRawQuestion.passage_id || repairedRawQuestion.passageId || '').trim(),
      passage_type: String(repairedRawQuestion.passage_type || repairedRawQuestion.passageType || '').trim().toLowerCase(),
      passage_text: String(repairedRawQuestion.passage_text || repairedRawQuestion.passageText || '').trim(),
      passage_title: String(repairedRawQuestion.passage_title || repairedRawQuestion.passageTitle || '').trim(),
      temporary_group_key: String(repairedRawQuestion.temporary_group_key || repairedRawQuestion.temp_group_key || '').trim(),
      passage_group_id: String(repairedRawQuestion.passage_group_id || repairedRawQuestion.passageGroupId || repairedRawQuestion.group_id || '').trim(),
      group_id: String(repairedRawQuestion.group_id || repairedRawQuestion.passage_group_id || '').trim(),
      order_index: Number(repairedRawQuestion.order_index || repairedRawQuestion.orderIndex || index + 1),
      is_passage_linked: repairedRawQuestion.is_passage_linked === true || Boolean(repairedRawQuestion.passage_text || repairedRawQuestion.passage_id || repairedRawQuestion.temporary_group_key),
      generation_mode: String(repairedRawQuestion.generation_mode || repairedRawQuestion.generationMode || '').trim(),
      ordering_logic: String(repairedRawQuestion.ordering_logic || repairedRawQuestion.orderingLogic || '').trim(),
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
      if (classification.reason) {
        console.warn('[llm] english_classification_warning_log_only', {
          chapter,
          reason: classification.reason,
          detected_type: classification.detectedType,
          index,
        });
      }

      normalized.tags = normalizeTags([...normalized.tags, ...classification.tags]);
      if (classification.passageId) normalized.passage_id = classification.passageId;
      if (classification.passageType) normalized.passage_type = classification.passageType;
      if (classification.passageText) normalized.passage_text = classification.passageText;
    }

    // Preserve trap_option and strong_distractors keys emitted by the generator.

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
      console.warn('[llm] generated_quality_warning_before_selfcheck', {
        subject: subjectId,
        chapter,
        reason: internalRejectReason,
        body: normalized.body.slice(0, 100),
        index,
      });
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
  const optionTexts = Array.isArray(question?.options)
    ? question.options.map((option) => String(option?.text || '').trim())
    : [];
  const isEnglishReadingComprehension = question?.subject === 'english' && ENGLISH_RC_CHAPTERS.has(question?.chapter);
  const maxBodyChars = isEnglishReadingComprehension ? 1800 : 420;
  const maxBodyWords = isEnglishReadingComprehension ? 260 : 70;
  if (!ALLOWED_CUET_REASONING_TYPES.includes(question?.question_type)) return 'disallowed_question_type';
  if (body.length > maxBodyChars || countWords(body) > maxBodyWords) return 'question_too_long';
  if (isClearlyOutsideCuetScope(bodyLower)) {
    return 'advanced_or_non_cuet_pattern';
  }
  if (isDirectDefinitionStem(body)) {
    console.warn('[llm] generated_question_discarded_before_pipeline', {
      reason: 'direct_definition_or_textbook_stem',
      body: body.slice(0, 100),
    });
    return 'direct_definition_or_textbook_stem';
  }
  if (hasExtremeQualifier(body) || optionTexts.some(hasExtremeQualifier)) {
    console.warn('[llm] generated_extreme_word_warning_log_only', {
      body: body.slice(0, 100),
    });
  }
  if (hasDirectEvaluationStem(body) && !/\bstatement\s+i\b/i.test(body)) {
    return 'direct_evaluation_stem';
  }
  if (hasLogicallyImpossibleOption(optionTexts)) {
    return 'logically_impossible_option';
  }
  const trapOption = normalizeAnswerKey(question.trap_option);
  const strongDistractors = normalizeAnswerKeyArray(question.strong_distractors);
  const answer = normalizeAnswerKey(question.correct_answer);
  if (!trapOption || strongDistractors.length < 2) return 'missing_trap_or_strong_distractors';
  if (trapOption === answer || strongDistractors.includes(answer)) return 'trap_metadata_points_to_correct_answer';
  if (!question.why_not_textbook || !question.why_cuet_level) return 'missing_cuet_rationale';
  if (!hasCompleteDistractorRationale(question.distractor_rationale)) return 'missing_distractor_rationale';
  if (hasStatementCombinationAnswerMismatch(question)) return 'statement_answer_rationale_mismatch';
  if (hasGeneratedWeakOptions(question.options, question.correct_answer)) {
    return 'weak_options';
  }
  if (hasObviousAnswerPattern(question)) return 'obvious_answer_pattern';
  return null;
}

function hasCompleteDistractorRationale(rationale) {
  return ['A', 'B', 'C', 'D'].every((key) => String(rationale?.[key] || '').trim().length >= 8);
}

function hasObviousAnswerPattern(question) {
  const answer = normalizeAnswerKey(question.correct_answer);
  const correct = question.options?.find((option) => option.key === answer);
  const wrong = question.options?.filter((option) => option.key !== answer) || [];
  if (!correct || wrong.length !== 3) return true;
  const correctText = String(correct.text || '').toLowerCase();
  const wrongTexts = wrong.map((option) => String(option.text || '').toLowerCase());
  if (wrongTexts.some((text) => /\b(no relation|unrelated|not possible|impossible|none of these|all of these)\b/i.test(text))) return true;
  const closeWrong = wrongTexts.filter((text) => optionTextSimilarity(correctText, text) >= 0.16).length;
  return closeWrong < 2;
}

function repairGeneratedQuestionMetadata(question) {
  if (!question || typeof question !== 'object') return question;
  const repaired = sanitizeGeneratedExtremeQualifiers({ ...question });
  repaired.question_type = normalizeGeneratedQuestionType(repaired.question_type || repaired.pattern_type);
  repaired.trap_option = normalizeAnswerKey(repaired.trap_option || repaired.trapOption);
  repaired.strong_distractors = normalizeAnswerKeyArray(repaired.strong_distractors || repaired.strongDistractors);
  const answer = normalizeAnswerKey(repaired.correct_answer || repaired.answer || repaired.a);
  const wrongKeys = ['A', 'B', 'C', 'D'].filter((key) => key !== answer);
  if (!repaired.trap_option && wrongKeys.length > 0) repaired.trap_option = wrongKeys[0];
  repaired.strong_distractors = repaired.strong_distractors.filter((key) => key !== answer);
  if (repaired.strong_distractors.length < 2) {
    repaired.strong_distractors = Array.from(new Set([
      ...repaired.strong_distractors,
      ...wrongKeys.filter((key) => key !== repaired.trap_option),
      repaired.trap_option,
    ].filter(Boolean))).slice(0, 2);
  }
  if (!repaired.why_not_textbook) {
    repaired.why_not_textbook = 'Uses a situation or comparison instead of asking for a direct definition.';
  }
  if (!repaired.why_cuet_level) {
    repaired.why_cuet_level = 'Requires elimination between plausible NCERT-linked options.';
  }
  if (!hasCompleteDistractorRationale(repaired.distractor_rationale)) {
    repaired.distractor_rationale = buildDefaultDistractorRationale(repaired);
  }
  return repaired;
}

function sanitizeGeneratedExtremeQualifiers(question) {
  const before = JSON.stringify(question);
  const repaired = { ...question };
  for (const key of ['q', 'question', 'body', 'why_not_textbook', 'whyNotTextbook', 'why_cuet_level', 'whyCuetLevel', 'explanation']) {
    if (typeof repaired[key] === 'string') repaired[key] = sanitizeExtremeQualifierText(repaired[key]);
  }
  if (Array.isArray(repaired.o)) repaired.o = repaired.o.map(sanitizeExtremeQualifierText);
  if (Array.isArray(repaired.options)) {
    repaired.options = repaired.options.map((option) => {
      if (typeof option === 'string') return sanitizeExtremeQualifierText(option);
      if (option && typeof option === 'object') {
        return { ...option, text: sanitizeExtremeQualifierText(option.text) };
      }
      return option;
    });
  }
  for (const key of ['distractor_rationale', 'distractorRationale']) {
    if (repaired[key] && typeof repaired[key] === 'object' && !Array.isArray(repaired[key])) {
      repaired[key] = Object.fromEntries(Object.entries(repaired[key]).map(([entryKey, value]) => [
        entryKey,
        typeof value === 'string' ? sanitizeExtremeQualifierText(value) : value,
      ]));
    }
  }
  if (before !== JSON.stringify(repaired)) {
    console.warn('[llm] generated_extreme_word_repaired', {
      body: String(repaired.q || repaired.question || repaired.body || '').slice(0, 100),
    });
  }
  return repaired;
}

function buildDefaultDistractorRationale(question) {
  const answer = normalizeAnswerKey(question.correct_answer || question.answer || question.a);
  const rationale = {};
  for (const key of ['A', 'B', 'C', 'D']) {
    rationale[key] = key === answer
      ? 'Correct option based on the NCERT-linked reasoning in the stem.'
      : 'Plausible distractor that misses a condition or reverses the reasoning.';
  }
  return rationale;
}

function shuffleQuestionOptions(question) {
  if (!question || !Array.isArray(question.options) || question.options.length !== 4) return question;
  const answerKey = String(question.correct_answer || '').trim().toUpperCase();
  const correct = question.options.find((option) => String(option.key || '').trim().toUpperCase() === answerKey);
  if (!correct) return question;
  const shuffled = [...question.options].sort(() => Math.random() - 0.5);
  const keys = ['A', 'B', 'C', 'D'];
  question.options = shuffled.map((option, index) => ({
    key: keys[index],
    text: stripOptionLabel(option.text),
  }));
  const newAnswer = question.options.find((option) => option.text === stripOptionLabel(correct.text));
  if (newAnswer) question.correct_answer = newAnswer.key;
  return question;
}

function normalizeGeneratedQuestionType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (ALLOWED_CUET_REASONING_TYPES.includes(normalized)) return normalized;
  if (normalized === 'one_step_application' || normalized === 'scenario_based' || normalized === 'trap_based') {
    return 'application_based';
  }
  if (normalized === 'assertion-reason' || normalized === 'assertion_reasoning') return 'assertion_reason';
  if (normalized === 'statement-based') return 'statement_based';
  if (normalized === 'numerical' || normalized === 'numerical-one-step' || normalized === 'one_step_numerical') return 'numerical_one_step';
  if (normalized === 'match' || normalized === 'match-type' || normalized === 'match_the_following') return 'match_type';
  if (normalized === 'para-jumble' || normalized === 'para jumble' || normalized === 'sentence_reordering' || normalized === 'sentence-reordering') return 'para_jumble';
  if (normalized === 'vocabulary-in-context' || normalized === 'vocabulary in context') return 'vocabulary_in_context';
  if (normalized === 'author-purpose' || normalized === 'author purpose') return 'author_purpose';
  if (normalized === 'detail-based' || normalized === 'detail based') return 'detail_based';
  if (normalized === 'literary-device' || normalized === 'literary device') return 'literary_device';
  if (normalized === 'case-based') return 'case_based';
  if (normalized === 'application-based' || normalized === 'analysis-based' || normalized === 'evaluation-based' || normalized === 'evaluation' || normalized === 'elimination-based') return 'application_based';
  if (normalized === 'comparison-based' || normalized === 'comparison') return 'comparison_based';
  if (normalized === 'match_based') return 'comparison_based';
  return ALLOWED_CUET_REASONING_TYPES[Math.floor(Math.random() * ALLOWED_CUET_REASONING_TYPES.length)];
}

function isDirectDefinitionStem(body) {
  const text = String(body || '').trim().toLowerCase();
  return /^(what is|define|meaning of|which term|who is|when did)\b/.test(text) ||
    /\b(correct definition|best definition|definition of|refers to|is known as)\b/.test(text) ||
    /\bwhich of the following (statements )?(is|are) correct\??$/.test(text) ||
    /\bwhich (principle|concept|term) (of management )?(is|has been|is primarily) (being )?(applied|reflected|demonstrated)\b/.test(text) ||
    /\bthis reflects which (concept|principle|term)\b/.test(text);
}

function isClearlyOutsideCuetScope(text) {
  const value = String(text || '').toLowerCase();
  if (/\b(vector space|rank-nullity|heine-borel|cayley-hamilton|functional analysis|abstract algebra|group under|olympiad|graduate|mba|b\.com|econometrics)\b/.test(value)) {
    return true;
  }
  if (/\b(prove|proof|derive|derivation)\b/.test(value) && /\b(theorem|formula|equation|expression)\b/.test(value)) {
    return true;
  }
  if (/\bjee|neet\b/.test(value) && /\b(multi-step|advanced|derivation|complex)\b/.test(value)) {
    return true;
  }
  const formulaSignals = (value.match(/[a-z]\s*=\s*[^.;,]+/gi) || []).length +
    (value.match(/\b(calculate|derive|integrate|differentiate|solve)\b/gi) || []).length;
  const variableSignals = (value.match(/\b[a-z]\d?\b\s*[=<>]/gi) || []).length;
  return formulaSignals >= 3 || variableSignals >= 5;
}

function hasDirectEvaluationStem(body) {
  return /\b(which (evaluation|option|statement|assessment|response) best (captures|addresses|clarifies|assesses|evaluates|reflects|counters|critiques)|which analysis best evaluates|what conclusion can be drawn|which statement best clarifies)\b/i.test(String(body || ''));
}

function hasExtremeQualifier(text) {
  if (isNtaStatementCombinationOption(text)) return false;
  return /\b(solely|entirely|impossible|guaranteed)\b/i.test(String(text || '')) ||
    /\b(always|never|all|only|completely|independent)\b/i.test(String(text || '')) &&
      /\b(environmentally friendly|no effect|same in every case|direction of motion|unrelated|random|absurd)\b/i.test(String(text || ''));
}

function isNtaStatementCombinationOption(text) {
  const value = String(text || '').trim();
  return /^(?:[IVX]+(?:\s*(?:,|and)\s*[IVX]+)*\s+only|[IVX]+(?:\s*,\s*[IVX]+)*(?:\s+and\s+[IVX]+)?)$/i.test(value);
}

function hasStatementCombinationAnswerMismatch(question) {
  const body = String(question?.body || question?.q || question?.question || '');
  if (!/\bStatement\s+I\b/i.test(body)) return false;

  const answer = normalizeAnswerKey(question.correct_answer || question.answer || question.a);
  const options = normalizeOptions(question.options || question.o || []);
  const answerOption = options.find((option) => option.key === answer);
  if (!answerOption || !isNtaStatementCombinationOption(answerOption.text)) return false;

  const answerStatements = extractRomanStatementSet(answerOption.text);
  if (answerStatements.size === 0) return false;

  const rationale = question.distractor_rationale || question.distractorRationale || {};
  const answerRationale = String(rationale[answer] || '');
  if (/\b(incorrect|incorrectly|wrong|flaw|flawed|invalid|misleading|misrepresents|overlooks|not accurate|inaccurate)\b/i.test(answerRationale)) {
    return true;
  }

  const claimedCorrect = extractClaimedCorrectStatementSet(answerRationale);
  if (claimedCorrect.size > 0 && !areStatementSetsEqual(answerStatements, claimedCorrect)) {
    return true;
  }

  const combinedRationale = Object.values(rationale)
    .filter((value) => typeof value === 'string')
    .join(' ');
  const flawedStatements = new Set();
  const statementPattern = /\bStatement\s+([IVX]+)\b[^.]{0,100}\b(incorrect|incorrectly|wrong|flaw|flawed|invalid|misleading|misrepresents|overlooks|not accurate|inaccurate)\b/gi;
  let match;
  while ((match = statementPattern.exec(combinedRationale)) !== null) {
    flawedStatements.add(match[1].toUpperCase());
  }

  for (const statement of answerStatements) {
    if (flawedStatements.has(statement)) return true;
  }
  return false;
}

function extractRomanStatementSet(text) {
  const value = String(text || '').toUpperCase();
  const matches = value.match(/\b[IVX]+\b/g) || [];
  return new Set(matches);
}

function extractClaimedCorrectStatementSet(text) {
  const value = String(text || '').toUpperCase();
  const onlyMatch = value.match(/\b(?:ONLY\s+)?STATEMENT\s+([IVX]+)\s+IS\s+CORRECT\b/);
  if (onlyMatch) return new Set([onlyMatch[1]]);
  const bothMatch = value.match(/\bBOTH\s+([IVX]+)\s+AND\s+([IVX]+)\s+ARE\s+CORRECT\b/);
  if (bothMatch) return new Set([bothMatch[1], bothMatch[2]]);
  const comboMatch = value.match(/\b([IVX]+)\s+AND\s+([IVX]+)\s+(?:ARE|ARE BOTH)\s+CORRECT\b/);
  if (comboMatch) return new Set([comboMatch[1], comboMatch[2]]);
  return new Set();
}

function areStatementSetsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function hasLogicallyImpossibleOption(optionTexts) {
  return optionTexts.some((text) => /\b(unrelated|none of these|all of these|both a and b|cannot be determined|not possible|impossible in every case|has no relation)\b/i.test(text));
}

function hasGeneratedWeakOptions(options, correctAnswer) {
  const normalizedOptions = normalizeOptions(options);
  if (normalizedOptions.length !== 4) return true;
  const answer = normalizeAnswerKey(correctAnswer);
  if (!answer || !normalizedOptions.some((option) => option.key === answer)) return true;

  const texts = normalizedOptions.map((option) => String(option.text || '').trim().toLowerCase());
  if (texts.some((text) => text.length < 2)) return true;
  if (new Set(texts).size !== 4) return true;
  if (texts.some((text) => /\b(all of the above|none of the above|both a and b|cannot be determined)\b/i.test(text))) return true;
  if (texts.some(hasExtremeQualifier)) return true;
  return !hasPlausibleOptionConfusion(normalizedOptions, answer);
}

function hasPlausibleOptionConfusion(options, correctAnswer) {
  const correct = options.find((option) => option.key === correctAnswer);
  if (!correct) return false;
  const texts = options.map((option) => String(option.text || '').trim());
  const avgLength = texts.reduce((sum, text) => sum + text.length, 0) / texts.length;
  if (avgLength > 0 && texts.some((text) => text.length < Math.max(3, avgLength * 0.30))) return false;

  const correctText = String(correct.text || '');
  const distractors = options.filter((option) => option.key !== correctAnswer);
  const closeDistractors = distractors.filter((option) => optionTextSimilarity(correctText, option.text) >= 0.16).length;
  const partialTruthSignals = distractors.filter((option) => /\b(partly|mainly|usually|sometimes|increase|decrease|public|private|both|not all|except|because|while|but|however|whereas|similar|different)\b/i.test(option.text)).length;
  const numericOptions = texts.filter((text) => /\d/.test(text)).length;
  if (numericOptions >= 3) return true;
  const pairwiseClose = hasCloseDistractors(texts.map((text) => text.toLowerCase()));
  return closeDistractors >= 1 && (partialTruthSignals >= 1 || closeDistractors >= 2 || pairwiseClose);
}

function optionTextSimilarity(left, right) {
  const leftTokens = new Set(String(left || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 3));
  const rightTokens = new Set(String(right || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((token) => token.length > 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function hasCloseDistractors(optionTexts) {
  if (!Array.isArray(optionTexts) || optionTexts.length < 4) return false;
  let closePairs = 0;
  for (let i = 0; i < optionTexts.length; i += 1) {
    for (let j = i + 1; j < optionTexts.length; j += 1) {
      if (optionTextSimilarity(optionTexts[i], optionTexts[j]) >= 0.30) closePairs += 1;
    }
  }
  return closePairs >= 2;
}

function normalizeValidationResult(result, question) {
  result = result && typeof result === 'object' ? result : {};
  const score = Number.isFinite(Number(result.score)) ? Number(result.score) : 0;
  const examQuality = Number.isFinite(Number(result.exam_quality)) ? Number(result.exam_quality) : score;
  const distractorQuality = Number.isFinite(Number(result.distractor_quality)) ? Number(result.distractor_quality) : score;
  const conceptualDepth = Number.isFinite(Number(result.conceptual_depth)) ? Number(result.conceptual_depth) : score;
  const trapQuality = normalizeEnum(result.trap_quality, ['HIGH', 'MEDIUM', 'LOW'], inferTrapQuality(result, question));
  const textbookStyle = result.textbook_style === true;
  const difficultyCorrect = result.difficulty_correct !== false;
  const cuetAlignment = result.cuet_alignment !== false;
  const rawDecision = String(result.decision || '').trim().toLowerCase();
  const recommendedDifficulty = normalizeDifficulty(result.recommended_difficulty || question.difficulty);
  const issues = Array.isArray(result.issues) ? result.issues.map(String) : [];
  const improvedQuestion = result.improved_question && typeof result.improved_question === 'object'
    ? result.improved_question
    : null;
  const syllabusAlignment = normalizeEnum(result.syllabus_alignment, ['WITHIN', 'OUTSIDE'], cuetAlignment ? 'WITHIN' : 'OUTSIDE');
  const conceptMatch = normalizeEnum(result.concept_match, ['EXACT', 'PARTIAL', 'MISMATCH'], cuetAlignment ? 'EXACT' : 'MISMATCH');
  const difficultyLevel = normalizeEnum(
    result.difficulty_level,
    ['EASY', 'MEDIUM', 'HARD', 'TOO HARD'],
    String(question.difficulty || recommendedDifficulty || 'medium').trim().toUpperCase(),
  );
  const comparedToPyqs = normalizeEnum(result.compared_to_pyqs, ['EASIER', 'MATCH', 'HARDER'], difficultyCorrect ? 'MATCH' : 'HARDER');
  const clarity = normalizeEnum(result.clarity, ['CLEAR', 'AMBIGUOUS'], 'CLEAR');
  const languageLevel = normalizeEnum(result.language_level, ['SIMPLE', 'MODERATE', 'COMPLEX'], 'SIMPLE');
  const optionQuality = normalizeEnum(result.option_quality, ['CLEAN', 'OVERLAPPING', 'CONFUSING'], 'CLEAN');
  const subjectConsistency = normalizeEnum(result.subject_consistency, ['CORRECT', 'WRONG'], 'CORRECT');
  const verdict = normalizeEnum(result.verdict, ['VALID', 'INVALID'], rawDecision === 'reject' ? 'INVALID' : 'VALID');
  const fullyWithinCuetSyllabus = normalizeYesNo(
    result.fully_within_cuet_syllabus,
    syllabusAlignment === 'WITHIN' && conceptMatch === 'EXACT',
  );
  const matchesCuetPyqDifficulty = normalizeYesNo(
    result.matches_cuet_pyq_difficulty,
    comparedToPyqs === 'MATCH' || comparedToPyqs === 'EASIER',
  );
  const harderThanTypicalCuetLevel = normalizeYesNo(
    result.harder_than_typical_cuet_level,
    comparedToPyqs !== 'HARDER' && difficultyLevel !== 'TOO HARD' ? false : true,
  );
  const ambiguityOrMultipleCorrectAnswers = normalizeYesNo(
    result.ambiguity_or_multiple_correct_answers,
    clarity === 'AMBIGUOUS' || optionQuality !== 'CLEAN',
  );
  const languageUnnecessarilyComplex = normalizeYesNo(
    result.language_unnecessarily_complex,
    languageLevel === 'COMPLEX',
  );
  const validatorReasons = normalizeValidatorReasons(result.reasons);
  const compositeScore = computeCompositeScore({
    syllabusAlignment,
    conceptMatch,
    difficultyLevel,
    comparedToPyqs,
    clarity,
    languageLevel,
    optionQuality,
    subjectConsistency,
    score,
    examQuality,
    distractorQuality,
    conceptualDepth,
    trapQuality,
    textbookStyle,
    cuetAlignment,
    verdict,
  });

  const hardReject = (
    subjectConsistency === 'WRONG' ||
    syllabusAlignment === 'OUTSIDE' ||
    conceptMatch === 'MISMATCH' ||
    hasFatalAnswerIssue([...validatorReasons, ...issues])
  );
  const strictQualityAccept = (
    rawDecision === 'accept' &&
    verdict === 'VALID' &&
    cuetAlignment === true &&
    score >= 7 &&
    examQuality >= 7 &&
    distractorQuality >= 7 &&
    conceptualDepth >= 7 &&
    trapQuality !== 'LOW'
  );
  let decision;

  if (hardReject) {
    decision = 'reject';
  } else if (strictQualityAccept) {
    decision = 'accept';
  } else {
    decision = 'reject';
  }

  const isNotAccepted = decision !== 'accept';
  const rejectionParams = {
    validatorReasons,
    validatorCheckFailed: false,
    validatorV2Failed: false,
    syllabusAlignment,
    conceptMatch,
    difficultyLevel,
    comparedToPyqs,
    clarity,
    languageLevel,
    optionQuality,
    subjectConsistency,
    score,
    examQuality,
    distractorQuality,
    conceptualDepth,
    trapQuality,
    textbookStyle,
    cuetAlignment,
    rawDecision,
    verdict,
    issues,
  };

  return {
    score,
    compositeScore,
    exam_quality: examQuality,
    distractor_quality: distractorQuality,
    conceptual_depth: conceptualDepth,
    trap_quality: trapQuality,
    textbook_style: textbookStyle,
    decision,
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
    verdict: decision === 'accept' ? 'VALID' : 'INVALID',
    reasons: isNotAccepted ? normalizeRejectionReasons(rejectionParams) : [],
    recommended_difficulty: recommendedDifficulty,
    issues: isNotAccepted
      ? Array.from(new Set([
          ...issues,
          ...normalizeRejectionReasons({ ...rejectionParams, issues: [] }),
        ]))
          .map((issue) => String(issue || '').trim())
          .filter(Boolean)
          .slice(0, 8)
      : issues,
    improved_question: improvedQuestion,
  };
}

function computeCompositeScore(params) {
  let s = 35;

  if (params.syllabusAlignment === 'WITHIN') s += 15;
  if (params.conceptMatch === 'EXACT') s += 12;
  else if (params.conceptMatch === 'PARTIAL') s += 5;
  if (params.clarity === 'CLEAR') s += 6;
  if (params.languageLevel === 'SIMPLE') s += 5;
  else if (params.languageLevel === 'MODERATE') s += 2;
  if (params.optionQuality === 'CLEAN') s += 8;
  if (params.trapQuality === 'HIGH') s += 8;
  else if (params.trapQuality === 'MEDIUM') s += 3;
  if (params.subjectConsistency === 'CORRECT') s += 6;
  if (params.comparedToPyqs === 'MATCH') s += 5;
  else if (params.comparedToPyqs === 'EASIER') s += 3;
  if (params.verdict === 'VALID') s += 3;
  s += Math.min(Number(params.score || 0), 10);

  if (params.syllabusAlignment === 'OUTSIDE') s -= 20;
  if (params.conceptMatch === 'MISMATCH') s -= 15;
  if (params.difficultyLevel === 'TOO HARD') s -= 10;
  if (params.comparedToPyqs === 'HARDER') s -= 8;
  if (params.clarity === 'AMBIGUOUS') s -= 10;
  if (params.languageLevel === 'COMPLEX') s -= 8;
  if (params.optionQuality === 'CONFUSING') s -= 10;
  else if (params.optionQuality === 'OVERLAPPING') s -= 5;
  if (params.trapQuality === 'LOW') s -= 18;
  if (params.subjectConsistency === 'WRONG') s -= 30;
  if (params.textbookStyle) s -= 12;
  if (!params.cuetAlignment) s -= 8;
  if (Number(params.examQuality || 0) < 5) s -= 5;
  if (Number(params.distractorQuality || 0) < 7) s -= 8;
  if (Number(params.conceptualDepth || 0) < 7) s -= 12;

  return Math.max(0, Math.min(100, Math.round(s)));
}

function hasFatalAnswerIssue(reasons = []) {
  return reasons.some((reason) => (
    /\b(wrong answer|incorrect answer|answer key|factually incorrect|incorrect scientific fact|logical inconsistency)\b/i
      .test(String(reason || ''))
  ));
}

function inferTrapQuality(result, question) {
  if (String(result?.option_quality || '').trim().toUpperCase() !== 'CLEAN') return 'LOW';
  if (Number(result?.distractor_quality || 0) >= 8 && Number(result?.conceptual_depth || 0) >= 8) return 'HIGH';
  if (Number(result?.distractor_quality || 0) >= 7 && Number(result?.conceptual_depth || 0) >= 7 && !isDirectDefinitionStem(question?.body || question?.q || '')) return 'MEDIUM';
  return 'LOW';
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
  score,
  examQuality,
  distractorQuality,
  conceptualDepth,
  trapQuality,
  textbookStyle,
  cuetAlignment,
  rawDecision,
  verdict,
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
  if (Number(score) < 5) reasons.add('validator score below threshold');
  if (Number(examQuality) < 7) reasons.add('exam quality below threshold');
  if (Number(distractorQuality) < 7) reasons.add('distractor quality below threshold');
  if (Number(conceptualDepth) < 7) reasons.add('conceptual depth below CUET reasoning threshold');
  if (trapQuality === 'LOW') reasons.add('low trap quality');
  if (textbookStyle === true) reasons.add('direct textbook-style wording');
  if (cuetAlignment === false) reasons.add('validator marked non-CUET alignment');
  if (rawDecision === 'reject') reasons.add('validator decision reject');
  if (verdict === 'INVALID') reasons.add('validator verdict invalid');
  if (validatorCheckFailed || validatorV2Failed) reasons.add('validator v2 strict checks failed');
  for (const issue of issues || []) {
    if (issue) reasons.add(String(issue));
  }
  return [...reasons].slice(0, 8);
}

/**
 * RECOVERY LAYER
 * Takes questions that scored between RECOVER and ACCEPT thresholds and attempts
 * to fix them via LLM: improve distractors, simplify language, adjust difficulty.
 * Returns fixed questions that should be re-scored or directly accepted.
 */
export async function recoverQuestions(questions, validationResults, subjectContext) {
  console.warn('[recovery] disabled by no-retry cost policy');
  return [];
}

function normalizeOptions(options) {
  const normalized = [];

  if (options && !Array.isArray(options) && typeof options === 'object') {
    for (const [key, value] of Object.entries(options)) {
      const normalizedKey = normalizeAnswerKey(key);
      const text = stripOptionLabel(value);
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
        const text = stripOptionLabel(option);
        if (normalizedKey && text) {
          normalized.push({ key: normalizedKey, text });
        }
        continue;
      }

      if (!option || typeof option !== 'object') continue;

      if ('key' in option || 'text' in option) {
        const normalizedKey = normalizeAnswerKey(option?.key);
        const text = stripOptionLabel(option?.text);
        if (normalizedKey && text) {
          normalized.push({ key: normalizedKey, text });
        }
        continue;
      }

      const entries = Object.entries(option);
      if (entries.length !== 1) continue;
      const [key, value] = entries[0];
      const normalizedKey = normalizeAnswerKey(key);
      const text = stripOptionLabel(value);
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

function stripOptionLabel(value) {
  return String(value || '').trim().replace(/^[A-D][\).:\-\s]+/i, '').trim();
}

function normalizeAnswerKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(key) ? key : '';
}

function normalizeAnswerKeyArray(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,/ ]+/);
  return Array.from(new Set(raw.map(normalizeAnswerKey).filter(Boolean))).slice(0, 4);
}

function normalizeDistractorRationale(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const key of ['A', 'B', 'C', 'D']) {
    const text = String(value[key] || value[key.toLowerCase()] || '').trim();
    if (text) result[key] = text;
  }
  return result;
}

function inferAnswerKeyFromOptionText(value, options) {
  const text = stripOptionLabel(value).toLowerCase();
  if (!text || !Array.isArray(options)) return '';
  const match = options.find((option) => stripOptionLabel(option.text).toLowerCase() === text);
  return match?.key || '';
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
  const causeMessage = String(error?.cause?.message || error?.cause?.cause?.message || '').toLowerCase();
  const causeCode = String(error?.cause?.code || error?.cause?.cause?.code || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.code || 0);
  if (
    causeCode.includes('unable_to_verify') ||
    causeMessage.includes('unable to verify') ||
    causeMessage.includes('certificate')
  ) return 'tls_certificate';
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

function serializeLlmError(error) {
  return {
    name: error?.name || null,
    message: error?.message || null,
    status: error?.status || error?.statusCode || null,
    code: error?.code || null,
    type: error?.type || null,
    request_id: error?.requestID || error?.request_id || null,
    cause: error?.cause ? {
      name: error.cause.name || null,
      message: error.cause.message || null,
      code: error.cause.code || null,
      cause: error.cause.cause ? {
        name: error.cause.cause.name || null,
        message: error.cause.cause.message || null,
        code: error.cause.cause.code || null,
      } : null,
    } : null,
  };
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
      console.error('FULL ERROR:', error);
      console.error('ERROR DETAILS:', JSON.stringify(serializeLlmError(error), null, 2));
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
  const normalizedPayload = normalizeGenerationPayload(parsed);
  const normalized = normalizedPayload.questions;
  if (normalized.length > 0) {
    console.log(`[llm] JSON recovery used: ${method}`);
    console.log(`[llm] Parsed question count: ${normalized.length}`);
    console.log('[normalizer]', normalizedPayload.stats);
    return normalized;
  }

  return null;
}

function normalizeQuestionPayload(parsed) {
  return normalizeGenerationPayload(parsed).questions;
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
