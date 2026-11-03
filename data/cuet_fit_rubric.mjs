// CUET-fit rubric: pure functions shared by the validator pipeline and the student-facing evidence gate.
// CUET-fit contract (v1.2). Correctness gates stay binary and mandatory; CUET fit is a set of explicit, anchored criteria whose
// overall score is DERIVED here, never chosen by a model. Easy is not poor: level is judged against authenticated PYQs, not against
// a difficulty ideal. Original practice is judged on CUET fit, not on having a past-paper counterpart.
// v1.1 (7 Oct 2026) changes, each tied to a measured failure of v1.0: time estimate uses counted reasoning steps and measured
// reading load because model-estimated seconds put a nine-step calculation at 70-85 s; discrimination no longer blocks on its own
// (it overlapped level and rejected valid easy items); an adversarial alternative-reading check replaces reliance on the model
// volunteering every hidden assumption (v1.0 accepted two audited conditional-answer items).
// v1.2 (8 Oct 2026): the 132-word observed maximum is descriptive only; time is explicitly a heuristic, with matched subject/format
// PYQ length summaries for context. Convention claims must cite the exact supplied evidence and cannot fill case-specific facts.

export const CUET_FIT_VERSION = 'cuet-fit-v1.2';
export const CUET_FIT_PASS_SCORE = 7;
// Provisional 2026 baseline for 2027: 50 questions, 60 minutes -> 72 s average per question.
export const AVERAGE_SECONDS_PER_QUESTION = 72;
// Historical observed maximum in a small, mixed-format sample; this is a reference point, not an NTA limit or rejection boundary.
export const PYQ_MAX_READING_WORDS = 132;
export const BASE_SECONDS = 8, SECONDS_PER_STEP = 18, WORDS_PER_SECOND = 3.3, PASSAGE_SHARE = 0.2;

export const MANDATORY_DEFECT_CATEGORIES = Object.freeze([
  'wrong_or_uncertain_key', 'multiple_correct_options', 'missing_decisive_assumption', 'unsupported_fact_or_explanation',
  'syllabus_mismatch', 'broken_numerical', 'incomplete_stimulus_or_data', 'unreadable_presentation'
]);

// Answer conditions. Only an assumption the key truly depends on, that the stem does not give and no standard convention supplies, blocks.
// text_reference = pronoun, cohesion or plain-meaning reading of the words actually printed (ordering items, "the listed items are complete").
// inferred_fact = a fact, amount or status the writer concluded rather than the stem gave; it is never a text reference.
export const CONDITION_STATUSES = Object.freeze(['explicit', 'convention', 'text_reference', 'inferred_fact', 'implied_decisive', 'missing']);
export const BLOCKING_CONDITION_STATUSES = Object.freeze(['inferred_fact', 'implied_decisive', 'missing']);
export const READING_STATUSES = Object.freeze(['contradicts_stem', 'strained', 'reasonable_unstated', 'standard_convention', 'stated_by_stem']);
export const BLOCKING_READING_STATUSES = Object.freeze(['reasonable_unstated', 'standard_convention', 'stated_by_stem']);

export const CUET_FIT_CRITERIA = Object.freeze([
  { id: 'syllabus_objective', gate: 2, question: 'How central is the tested idea to an official syllabus unit (entitlement itself is a separate mandatory gate)?',
    anchors: {
      3: 'Core learning objective the syllabus unit names: a central concept, rule, procedure or language skill.',
      2: 'Recognised examinable element of the unit: supporting concept, standard application or standard language skill.',
      1: 'Peripheral or incidental detail of an in-syllabus topic (a name, date, figure or example-specific fact). Low preparation value.',
      0: 'Not tied to any syllabus objective.'
    } },
  { id: 'format_authenticity', gate: 2, question: 'Does it look and work like a CUET UG question of this subject?',
    anchors: {
      3: 'Structure, stem and option style are indistinguishable from authenticated CUET items of this subject and format.',
      2: 'A valid CUET format (objective stem, four options, single answer) with minor differences that do not disadvantage a candidate.',
      1: 'Unusual for CUET (heavy parsing, several sub-questions, unconventional layout) but still answerable as a four-option MCQ.',
      0: 'Not a workable CUET MCQ (needs something not supplied, open-ended judgement, or a format CUET does not use).'
    } },
  { id: 'level_calibration', gate: 1, question: 'Is its cognitive demand within the range of the supplied authenticated PYQ exemplars for this subject and format?',
    anchors: {
      3: 'Central to the PYQ range: recall, comprehension or one- or two-step application as the exemplars pose them. Direct recall at this level scores 3: easy is not poor.',
      2: 'Inside the PYQ range but toward an edge (more recall-only, or more demanding, than most exemplars).',
      1: 'At the very extreme of the range; only just plausible for CUET.',
      0: 'Outside the range: answerable with no subject knowledge at all, or needs beyond Class XII depth.'
    } },
  { id: 'time_suitability', gate: 2, derived: true, question: 'Estimated by a heuristic: 8 s + reading words / 3.3 per second + 18 s per counted reasoning step, compared with the 72-second average. It is not observed student timing.',
    anchors: { 3: 'At most 90 seconds.', 2: '91 to 150 seconds.', 1: '151 to 240 seconds.', 0: 'More than 240 seconds.' } },
  { id: 'discrimination_value', gate: 0, question: 'Insofar as the options and wording affect it, does a right or wrong answer tell us something about preparation? Scored; it never blocks on its own.',
    anchors: {
      3: 'Wrong options correspond to identifiable misconceptions or slips; a wrong choice is informative.',
      2: 'Options are plausible enough that blind guessing is not trivially successful.',
      1: 'Some distractors are implausible, yet the item still needs subject knowledge to answer.',
      0: 'Options or cues let the key be found with little or no subject knowledge.'
    } }
]);
export const CRITERION_IDS = CUET_FIT_CRITERIA.map(c => c.id);
export const MODEL_RATED_IDS = CUET_FIT_CRITERIA.filter(c => !c.derived).map(c => c.id);

const countWords = t => (String(t || '').match(/[\p{L}\p{N}]+/gu) || []).length;
// Reading load of one question: stem and options in full; a shared passage at one fifth (read once for several questions).
export function readingWords(q) {
  const options = Array.isArray(q?.options) ? q.options.map(o => typeof o === 'string' ? o : o?.text) : [];
  return Math.round(countWords(q?.body) + options.reduce((n, o) => n + countWords(o), 0) + PASSAGE_SHARE * countWords(q?.passage_text ?? q?.passage));
}
export const derivedSolveSeconds = (steps, words) => !Number.isInteger(steps) || steps < 1 || !Number.isFinite(words) ? null : Math.round(BASE_SECONDS + words / WORDS_PER_SECOND + SECONDS_PER_STEP * steps);
export const solveSecondsLevel = seconds => !Number.isFinite(seconds) || seconds < 0 ? null : seconds <= 90 ? 3 : seconds <= 150 ? 2 : seconds <= 240 ? 1 : 0;

// Compare against authenticated, key-matched examples of the same subject and question format.
// This is descriptive evidence only: a small observed maximum is never treated as an exam rule.
export function readingLoadReference(words, subject, questionType, examples = []) {
  const matched = examples.filter(e => e?.subject === subject && e?.question_type === questionType && e?.final_key_matched === true && !e?.dropped)
    .map(e => readingWords({ body: e.body, options: e.options, passage_text: e.passage_text }))
    .filter(Number.isFinite).sort((a, b) => a - b);
  if (!matched.length) return { status: 'no_matched_authenticated_examples', sample_size: 0, words };
  const quantile = p => matched[Math.min(matched.length - 1, Math.ceil(p * matched.length) - 1)];
  return { status: matched.length >= 10 ? 'subject_format_sample' : 'thin_subject_format_sample', sample_size: matched.length,
    words, median_words: quantile(0.5), p95_words: quantile(0.95), observed_max_words: matched.at(-1) };
}

// A condition blocks only when it is a concluded fact, merely implied or missing, AND a different reasonable choice changes the key.
export function conditionVerdict(conditions, selectedEvidenceIds = []) {
  const list = Array.isArray(conditions) ? conditions : null;
  if (!list) return { ok: false, blocking: [], reason: 'answer_conditions_required' };
  const selected = new Set(Array.isArray(selectedEvidenceIds) ? selectedEvidenceIds : []);
  const unsupportedConventions = list.filter(c => c.status === 'convention' &&
    (!Array.isArray(c.convention_evidence_ids) || !c.convention_evidence_ids.length || c.convention_evidence_ids.some(id => !selected.has(id))));
  const blocking = list.filter(c => BLOCKING_CONDITION_STATUSES.includes(c.status) && c.alters_key_if_changed === true);
  return { ok: blocking.length === 0 && unsupportedConventions.length === 0, blocking, unsupported_conventions: unsupportedConventions,
    reason: blocking.length ? 'decisive_assumption_not_stated' : unsupportedConventions.length ? 'convention_without_selected_source_evidence' : null };
}

// Adversarial check: for each option the solver did not choose, the strongest honest reading under which it would be correct.
export function optionChallengeVerdict(challenges, solvedKey, selectedEvidenceIds = []) {
  if (!/^[ABCD]$/.test(solvedKey || '') || !Array.isArray(challenges)) return { ok: false, blocking: [], reason: 'option_challenges_required' };
  const expected = [...'ABCD'].filter(k => k !== solvedKey), seen = new Set(challenges.map(c => c?.option));
  if (challenges.length !== 3 || seen.size !== 3 || expected.some(k => !seen.has(k))) return { ok: false, blocking: [], reason: 'option_challenges_incomplete' };
  const selected = new Set(Array.isArray(selectedEvidenceIds) ? selectedEvidenceIds : []);
  const unsupportedConventions = challenges.filter(c => c.reading_status === 'standard_convention' &&
    (!Array.isArray(c.convention_evidence_ids) || !c.convention_evidence_ids.length || c.convention_evidence_ids.some(id => !selected.has(id))));
  const blocking = challenges.filter(c => c.correct_under_reading === true && BLOCKING_READING_STATUSES.includes(c.reading_status));
  return { ok: blocking.length === 0 && unsupportedConventions.length === 0, blocking, unsupported_conventions: unsupportedConventions,
    reason: blocking.length ? 'alternative_reading_makes_another_option_correct' : unsupportedConventions.length ? 'convention_without_selected_source_evidence' : null };
}

// Deterministic verdict. Gates: syllabus objective >= 2, format >= 2, level >= 1, derived time >= 2 (<= 150 s), overall >= 7/10.
export function cuetFitVerdict(fit, ctx = {}) {
  const reasons = [], levels = {};
  for (const id of MODEL_RATED_IDS) {
    const level = fit?.criteria?.[id]?.level;
    if (!Number.isInteger(level) || level < 0 || level > 3) reasons.push(`cuet_fit_criterion_missing:${id}`); else levels[id] = level;
  }
  const seconds = derivedSolveSeconds(fit?.reasoning_steps, ctx.words);
  let time = solveSecondsLevel(seconds);
  if (time === null) reasons.push('cuet_fit_criterion_missing:time_suitability'); else levels.time_suitability = time;
  if (reasons.length) return { pass: false, score: null, levels, reasons };
  const sum = Object.values(levels).reduce((n, v) => n + v, 0);
  const score = 1 + Math.round(9 * sum / (3 * CRITERION_IDS.length));
  for (const c of CUET_FIT_CRITERIA) if (c.gate && levels[c.id] < c.gate) reasons.push(`cuet_fit_${c.id}_below_${c.gate}`);
  if (score < CUET_FIT_PASS_SCORE) reasons.push(`cuet_fit_score_${score}_below_${CUET_FIT_PASS_SCORE}`);
  return { pass: reasons.length === 0, score, levels, sum, derived_solve_seconds: seconds, time_estimate_method: 'heuristic_not_observed',
    reading_words: ctx.words, reading_reference: ctx.reading_reference || null, reasoning_steps: fit.reasoning_steps, reasons };
}
