import { toInternalSubjectId } from './cuet_controls.js';

export const TOP_15_ANSWER_GUARD_SUBJECTS = Object.freeze([
  'english',
  'gat',
  'physics',
  'chemistry',
  'mathematics',
  'biology',
  'economics',
  'accountancy',
  'business_studies',
  'political_science',
  'history',
  'geography',
  'sociology',
  'computer_science',
  'psychology',
]);

export const ANSWER_LOCAL_CONFIDENCE_THRESHOLD = Math.min(
  1,
  Math.max(0.5, Number(process.env.NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD || 0.88)),
);

const TOP_15_ANSWER_GUARD_SUBJECT_SET = new Set(TOP_15_ANSWER_GUARD_SUBJECTS);
const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'which', 'what', 'when',
  'where', 'does', 'into', 'only', 'following', 'correct', 'option', 'choose',
]);

function textValue(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstPresent(row, fields) {
  for (const field of fields) {
    const value = field.split('.').reduce((acc, key) => acc?.[key], row);
    if (value != null && typeof value !== 'object' && textValue(value)) return value;
  }
  return '';
}

function normalizeComparable(value) {
  return textValue(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensForSimilarity(value) {
  return normalizeComparable(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function jaccardSimilarity(a, b) {
  const left = new Set(tokensForSimilarity(a));
  const right = new Set(tokensForSimilarity(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function countWords(value) {
  return textValue(value).split(/\s+/).filter(Boolean).length;
}

function optionText(option) {
  if (typeof option === 'string') return textValue(option);
  if (!option || typeof option !== 'object') return '';
  return textValue(option.text ?? option.label ?? option.value ?? option.body ?? option.option ?? option.content ?? '');
}

function optionKey(option, index) {
  if (option && typeof option === 'object' && option.key != null) {
    return String(option.key).trim().toUpperCase();
  }
  return OPTION_KEYS[index] || String(index + 1);
}

export function normalizeAnswerOptions(input, row = {}) {
  const parsed = parseMaybeJson(input);
  let values = [];

  if (Array.isArray(parsed)) {
    values = parsed;
  } else if (parsed && typeof parsed === 'object') {
    values = OPTION_KEYS
      .map((key) => parsed[key] ?? parsed[key.toLowerCase()] ?? parsed[`option_${key.toLowerCase()}`])
      .filter((value) => value != null);
  } else if (typeof parsed === 'string') {
    values = parsed
      .split(/\r?\n| \| |;(?=\s*[A-D][).:-]?\s*)/)
      .map((value) => value.replace(/^[A-D][).:-]\s*/i, '').trim())
      .filter(Boolean);
  }

  if (values.length < 4) {
    const separate = [
      row.option_a ?? row.optionA,
      row.option_b ?? row.optionB,
      row.option_c ?? row.optionC,
      row.option_d ?? row.optionD,
    ].filter((value) => value != null);
    if (separate.length >= 4) values = separate;
  }

  return values.slice(0, 4).map((option, index) => ({
    key: optionKey(option, index),
    text: optionText(option),
  }));
}

export function getAnswerQuestionText(row) {
  return textValue(firstPresent(row, ['question', 'body', 'q', 'prompt', 'stem']));
}

function getAnswerPassageText(row) {
  return textValue(firstPresent(row, [
    'passageText',
    'passage_text',
    'passage.text',
    'passage.passage_text',
    'passage',
    'context',
    'comprehension',
    'shared_context',
    'paragraph',
    'stem_context',
    'group_text',
    'passageGroup.text',
    'passageGroup.passage_text',
    'passage_groups.passage_text',
  ]));
}

function answerRaw(row) {
  return firstPresent(row, [
    'correctAnswer',
    'correct_answer',
    'answer',
    'answer_key',
    'correct_option',
    'correctOption',
    'a',
  ]);
}

export function resolveAnswerCorrectIndex(row, options) {
  const indexFields = [row?.correctIndex, row?.correct_index, row?.correct_option_index, row?.correctOptionIndex];
  for (const value of indexFields) {
    const numeric = Number(value);
    if (Number.isInteger(numeric)) {
      if (numeric >= 0 && numeric < options.length) return numeric;
      if (numeric >= 1 && numeric <= options.length) return numeric - 1;
    }
  }

  const raw = textValue(answerRaw(row));
  if (!raw) return -1;
  const upper = raw.toUpperCase().replace(/^OPTION[_\s-]*/, '').replace(/[).:]+$/, '');
  const keyIndex = options.findIndex((option) => option.key === upper);
  if (keyIndex >= 0) return keyIndex;

  const letterIndex = OPTION_KEYS.indexOf(upper);
  if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (numeric >= 0 && numeric < options.length) return numeric;
    if (numeric >= 1 && numeric <= options.length) return numeric - 1;
  }

  const comparable = normalizeComparable(raw);
  return options.findIndex((option) => normalizeComparable(option.text) === comparable);
}

function optionsAreUsable(options) {
  if (options.length !== 4) return false;
  const texts = options.map((option) => option.text);
  if (texts.some((text) => !text || text.length > 240)) return false;
  if (texts.some((text) => /^(option\s*)?[a-d]$/i.test(text) || /\b(lorem ipsum|todo|insert question|replace this|dummy question|sample question|answer goes here|option goes here)\b/i.test(text))) {
    return false;
  }
  return new Set(texts.map(normalizeComparable)).size === texts.length;
}

function explanationText(row) {
  return textValue(firstPresent(row, [
    'answer_check',
    'answerCheck',
    'explanation',
    'solution',
    'rationale',
  ]));
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function anchorTier(row) {
  const tier = Number(row?.anchor_tier ?? row?.anchorTier);
  return Number.isFinite(tier) ? tier : null;
}

function extractClaimedCorrectKeys(text) {
  const value = String(text || '');
  const claims = new Set();
  const patterns = [
    /\b(?:correct|right)\s+answer\s*(?:is|:|-)\s*(?:option\s*)?([A-D])\b/gi,
    /\banswer\s*(?:is|:|-)\s*(?:option\s*)?([A-D])\b/gi,
    /\b(?:option\s*)?([A-D])\s+is\s+(?:the\s+)?(?:correct|right)\s+(?:answer|option)\b/gi,
    /\b(?:option\s*)?([A-D])\s+is\s+correct\s+because\b/gi,
    /\b(?:option\s*)?([A-D])\s+is\s+the\s+best\s+(?:answer|option|choice)\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(value)) !== null) {
      claims.add(match[1].toUpperCase());
    }
  }
  return claims;
}

function hasNearDuplicateOptions(options) {
  const texts = options.map((option) => normalizeComparable(option.text)).filter(Boolean);
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const left = texts[i];
      const right = texts[j];
      if (left === right) return true;
      if (
        Math.min(left.length, right.length) >= 18 &&
        jaccardSimilarity(left, right) >= 0.92 &&
        (left.includes(right) || right.includes(left))
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasStatementCombinationBody(body) {
  return /\bStatement\s+[IVX]+\b/i.test(String(body || '')) ||
    (/\bAssertion\b/i.test(String(body || '')) && /\bReason\b/i.test(String(body || '')));
}

function hasObviousMultipleCorrectRisk(row, options, correctIndex) {
  const body = getAnswerQuestionText(row);
  const correct = options[correctIndex];
  if (!correct) return true;
  const correctText = normalizeComparable(correct.text);
  if (!correctText) return true;

  const explicitBad = options.some((option) => /\b(all of the above|none of the above|both a and b|both b and c|all statements are correct|more than one)\b/i.test(option.text));
  if (explicitBad) return true;

  if (hasStatementCombinationBody(body)) return false;

  const repeatedTruthyOptions = options.filter((option) => /\b(correct|true|valid|accurate|appropriate)\b/i.test(option.text)).length;
  return repeatedTruthyOptions >= 3 && !/\bincorrect|not true|not valid|false\b/i.test(body);
}

function hasPassageSignal(row) {
  const chapter = textValue(row?.chapter).toLowerCase();
  const type = textValue(row?.questionType ?? row?.question_type).toLowerCase();
  const topic = textValue(row?.topic ?? row?.badge ?? row?.label ?? row?.passage_type ?? row?.passageType).toLowerCase();
  const text = getAnswerQuestionText(row).toLowerCase();
  return Boolean(
    getAnswerPassageText(row) ||
    row?.passage_group_id ||
    row?.passageGroupId ||
    row?.passage_id ||
    row?.passageId ||
    /\b(passage|reading comprehension|prose)\b/i.test(chapter) ||
    /\b(reading_comprehension|comprehension|passage|central_idea|inference|author_purpose|tone|vocabulary_in_context|literary_device)\b/i.test(type) ||
    /\b(passage|reading comprehension|prose)\b/i.test(topic) ||
    /\b(according to|based on|as stated in|read the passage|read the excerpt|the passage|the paragraph|the extract|the excerpt|the author|the narrator)\b/i.test(text)
  );
}

export function verifyAnswerIntegrity(row, context = {}) {
  const reasons = [];
  const options = normalizeAnswerOptions(row?.options, row);
  const correctIndex = resolveAnswerCorrectIndex(row, options);
  const correctKey = correctIndex >= 0 ? options[correctIndex]?.key : '';
  const explanation = explanationText(row);

  if (options.length !== 4) reasons.push('answer_guard_options_count');
  if (!optionsAreUsable(options)) reasons.push('answer_guard_options_invalid');
  if (correctIndex < 0 || !OPTION_KEYS.includes(correctKey)) reasons.push('answer_guard_key_unresolved');
  if (correctIndex >= 0 && !textValue(options[correctIndex]?.text)) reasons.push('answer_guard_correct_option_empty');
  if (hasNearDuplicateOptions(options)) reasons.push('answer_guard_near_duplicate_options');

  const claimedKeys = extractClaimedCorrectKeys(explanation);
  if (claimedKeys.size > 0 && correctKey && !claimedKeys.has(correctKey)) {
    reasons.push('answer_guard_explanation_contradicts_key');
  }
  if (claimedKeys.size > 1) {
    reasons.push('answer_guard_multiple_explanation_claims');
  }
  if (correctIndex >= 0 && hasObviousMultipleCorrectRisk(row, options, correctIndex)) {
    reasons.push('answer_guard_multiple_correct_risk');
  }

  return {
    accepted: reasons.length === 0,
    reasons: [...new Set(reasons)],
    questionId: row?.id || null,
    correctKey: correctKey || null,
    correctOptionText: correctIndex >= 0 ? textValue(options[correctIndex]?.text) : '',
    explanationClaims: [...claimedKeys],
    verification: context?.verification || 'deterministic',
  };
}

export function scoreAnswerLocalConfidence(row) {
  const check = verifyAnswerIntegrity(row);
  if (!check.accepted) {
    return {
      confidence: 0,
      needsAi: false,
      reasons: check.reasons,
      deterministicAccepted: false,
    };
  }

  const reasons = [];
  let confidence = 0.92;
  const explanation = explanationText(row);
  const explanationWords = countWords(explanation);
  const qualityScore = numericValue(row?.quality_score ?? row?.qualityScore);
  const validationConfidence = numericValue(row?.validation_confidence ?? row?.validationConfidence);
  const tier = anchorTier(row);
  const options = normalizeAnswerOptions(row?.options, row);
  const correctText = check.correctOptionText;

  if (!explanation || explanationWords < 8) {
    confidence -= 0.22;
    reasons.push('weak_or_missing_explanation');
  } else if (check.explanationClaims.length === 0) {
    confidence -= 0.07;
    reasons.push('explanation_does_not_name_key');
  }

  if (hasPassageSignal(row)) {
    confidence -= 0.08;
    reasons.push('passage_question_requires_context_check');
  }
  if (hasStatementCombinationBody(getAnswerQuestionText(row))) {
    confidence -= 0.05;
    reasons.push('statement_or_assertion_reason_item');
  }
  if (qualityScore != null && qualityScore < 0.8) {
    confidence -= 0.08;
    reasons.push('low_quality_score');
  }
  if (validationConfidence != null && validationConfidence < 0.85) {
    confidence -= 0.07;
    reasons.push('low_prior_validation_confidence');
  }
  if (tier == null || tier > 2) {
    confidence -= 0.04;
    reasons.push('weak_anchor_tier');
  }
  if (countWords(correctText) <= 2) {
    confidence -= 0.04;
    reasons.push('very_short_correct_option');
  }

  const optionLengths = options.map((option) => textValue(option.text).length).filter(Boolean);
  const maxLength = Math.max(...optionLengths, 0);
  const minLength = Math.min(...optionLengths, 0);
  if (maxLength > 0 && minLength > 0 && minLength / maxLength < 0.25) {
    confidence -= 0.05;
    reasons.push('option_length_skew');
  }

  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
  return {
    confidence,
    needsAi: confidence < ANSWER_LOCAL_CONFIDENCE_THRESHOLD,
    reasons,
    deterministicAccepted: true,
    threshold: ANSWER_LOCAL_CONFIDENCE_THRESHOLD,
  };
}

export function isTop15AnswerGuardSubject(subject) {
  return TOP_15_ANSWER_GUARD_SUBJECT_SET.has(toInternalSubjectId(textValue(subject)));
}

export function evaluateGeneratedQuestionAnswerGuard(question, context = {}) {
  const subject = toInternalSubjectId(textValue(question?.subject ?? context?.subjectId));
  if (!isTop15AnswerGuardSubject(subject)) {
    return {
      guarded: false,
      accepted: true,
      subject,
      check: null,
      error: null,
    };
  }

  const check = verifyAnswerIntegrity(question, { verification: 'generator_publish' });
  return {
    guarded: true,
    accepted: check.accepted,
    subject,
    check,
    error: check.accepted ? null : `answer_integrity_guard:${check.reasons.join(',') || 'failed'}`,
  };
}
