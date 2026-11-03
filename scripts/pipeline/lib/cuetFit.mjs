import { CUET_FIT_VERSION, CUET_FIT_PASS_SCORE, AVERAGE_SECONDS_PER_QUESTION, MANDATORY_DEFECT_CATEGORIES, CONDITION_STATUSES, BLOCKING_CONDITION_STATUSES, READING_STATUSES, CUET_FIT_CRITERIA, CRITERION_IDS, MODEL_RATED_IDS, PYQ_MAX_READING_WORDS, solveSecondsLevel, derivedSolveSeconds, readingWords, readingLoadReference, conditionVerdict, optionChallengeVerdict, cuetFitVerdict, SECONDS_PER_STEP, BASE_SECONDS, WORDS_PER_SECOND } from '../../../data/cuet_fit_rubric.mjs';
export { CUET_FIT_VERSION, CUET_FIT_PASS_SCORE, AVERAGE_SECONDS_PER_QUESTION, MANDATORY_DEFECT_CATEGORIES, CONDITION_STATUSES, BLOCKING_CONDITION_STATUSES, READING_STATUSES, CUET_FIT_CRITERIA, CRITERION_IDS, MODEL_RATED_IDS, PYQ_MAX_READING_WORDS, solveSecondsLevel, derivedSolveSeconds, readingWords, readingLoadReference, conditionVerdict, optionChallengeVerdict, cuetFitVerdict };

// Pipeline-only pieces: structured-output schemas, calibration exemplars and the judge prompt.
export const cuetFitSchema = {
  type: 'object', additionalProperties: false,
  required: ['criteria', 'reasoning_steps', 'estimated_difficulty', 'cognitive_level', 'exemplar_ids_compared'],
  properties: {
    criteria: { type: 'object', additionalProperties: false, required: [...MODEL_RATED_IDS],
      properties: Object.fromEntries(MODEL_RATED_IDS.map(id => [id, { type: 'object', additionalProperties: false, required: ['level', 'evidence'],
        properties: { level: { type: 'integer', minimum: 0, maximum: 3 }, evidence: { type: 'string' } } }])) },
    reasoning_steps: { type: 'integer', minimum: 1, maximum: 15 },
    estimated_difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
    cognitive_level: { type: 'string', enum: ['recall', 'comprehension', 'application', 'multi_step_reasoning'] },
    exemplar_ids_compared: { type: 'array', items: { type: 'string' } }
  }
};
export const blockingDefectSchema = {
  type: 'array', items: { type: 'object', additionalProperties: false, required: ['category', 'detail'],
    properties: { category: { type: 'string', enum: [...MANDATORY_DEFECT_CATEGORIES] }, detail: { type: 'string' } } }
};
export const conditionSchema = {
  type: 'array', items: { type: 'object', additionalProperties: false, required: ['condition', 'status', 'alters_key_if_changed', 'convention_evidence_ids'],
    properties: { condition: { type: 'string' }, status: { type: 'string', enum: [...CONDITION_STATUSES] }, alters_key_if_changed: { type: 'boolean' }, convention_evidence_ids: { type: 'array', items: { type: 'string' } } } }
};
export const optionChallengeSchema = {
  type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['option', 'strongest_reading', 'correct_under_reading', 'reading_status', 'convention_evidence_ids'],
    properties: { option: { type: 'string', enum: ['A', 'B', 'C', 'D'] }, strongest_reading: { type: 'string' }, correct_under_reading: { type: 'boolean' }, reading_status: { type: 'string', enum: [...READING_STATUSES] }, convention_evidence_ids: { type: 'array', items: { type: 'string' } } } }
};

// Calibration exemplars: authenticated PYQs, never their keys or explanations.
export function calibrationExemplars(registry, view, { exclude = [], count = 3, byteBudget = 3600 } = {}) {
  const reserved = new Set(exclude);
  const pool = (registry.examples || []).filter(e => e.subject === view.subject && e.final_key_matched && !e.dropped && !reserved.has(e.id) && e.id !== view.anchor_id)
    .sort((a, b) => (Number(b.question_type === view.question_type) - Number(a.question_type === view.question_type)) || (Number(b.chapter === view.chapter) - Number(a.chapter === view.chapter)) || a.id.localeCompare(b.id));
  const out = []; let bytes = 0;
  for (const e of pool) {
    const item = { id: e.id, year: e.year || null, question_type: e.question_type, labelled_difficulty: e.difficulty || null, body: String(e.body || '').slice(0, 700), options: (e.options || []).map(o => String(o).slice(0, 160)), passage_excerpt: String(e.passage_text || '').slice(0, 400) };
    const size = Buffer.byteLength(JSON.stringify(item), 'utf8');
    if (bytes + size > byteBudget) continue;
    out.push(item); bytes += size;
    if (out.length >= count) break;
  }
  return out;
}

export const CUET_FIT_PROMPT = `CUET fit. After solving, judge whether this question genuinely belongs in CUET UG (${AVERAGE_SECONDS_PER_QUESTION}-second average, four options, one correct, Class XII NCERT-based Commerce and English). Rate each criterion in cuet_fit.criteria as an integer 0 to 3 using ONLY these anchors, with a short evidence phrase for each:
${CUET_FIT_CRITERIA.filter(c => !c.derived).map(c => `- ${c.id}: ${c.question} 3 = ${c.anchors[3]} 2 = ${c.anchors[2]} 1 = ${c.anchors[1]} 0 = ${c.anchors[0]}`).join('\n')}
- reasoning_steps: the number of distinct reasoning, reading-inference or calculation steps a prepared candidate must carry out (a direct definition recall is 1; each separate calculation or deduction is one step). The system provides a rough time estimate from this count and measured words; it is not an observed NTA timing rule. Count honestly; do not estimate seconds. Compare reading length with authenticated examples of the same subject and question format when available; the sample is descriptive, never a universal NTA word limit. If no matched examples are supplied, rely on the rough estimate and do not claim a word-limit violation.
Compare level against calibration_exemplars (authenticated CUET 2024 questions) and list the exemplar ids you used in exemplar_ids_compared. An original question needs no past-paper counterpart and must not be called a past paper. Do not lower any rating because a question is easy, direct recall or has an obvious distractor when that is how CUET asks it; judge options and wording only insofar as they change correctness, ambiguity or discrimination. Minor style preferences go in style_notes and never change a rating. Never raise a rating to compensate for a correctness defect, and do not infer correctness from the ratings.
ALTERNATIVE-READING CHALLENGE (option_challenges, exactly three entries, one for each option you did NOT choose): write the strongest honest reading of the stem, under which that option would be the right answer, in at most 30 words (strongest_reading); say whether the option is correct under it (correct_under_reading); and classify the reading: stated_by_stem (the stem as printed already makes the option correct), standard_convention (a named, source-supported standard convention gives that option), reasonable_unstated (a prepared candidate could fairly read the stem this way because a needed condition, status, amount or method is not given), strained (needs a contrived reading), contradicts_stem. For standard_convention, cite matching evidence_catalog IDs in convention_evidence_ids; for every other status, set convention_evidence_ids to []. General definitions and conventions cannot supply missing case-specific values or statuses. Search for conditions the stem leaves unspecified (other instalments or amounts unpaid or paid, status of an enterprise, timing, method, whether a premium or other item was received) before concluding that an option fails. Use strained for contrived arguments over wording; do not mark a reading reasonable_unstated merely because the textbook illustration had assumptions the stem restates.`;
