import OpenAI from 'openai';
import { isValidTopSyllabusPair } from './canonical_syllabus.js';
import { toInternalSubjectId } from './cuet_controls.js';
import {
  ANSWER_LOCAL_CONFIDENCE_THRESHOLD,
  scoreAnswerLocalConfidence as scoreNtaAnswerLocalConfidence,
  verifyAnswerIntegrity as verifyNtaAnswerIntegrity,
} from './answer_integrity.js';

export const NTA_QUESTION_COUNT = 50;
export const NTA_DURATION_MINUTES = 60;
export { scoreNtaAnswerLocalConfidence, verifyNtaAnswerIntegrity };

const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const NTA_AI_ANSWER_VERIFIER_MODEL = process.env.NTA_ANSWER_VERIFIER_MODEL || 'gpt-5-nano';
const NTA_AI_ANSWER_VERIFIER_TIMEOUT_MS = Math.min(28_000, Math.max(4_000, Number(process.env.NTA_ANSWER_VERIFIER_TIMEOUT_MS || 24_000)));
const NTA_AI_ANSWER_VERIFIER_MAX_ROWS = Math.min(50, Math.max(1, Number(process.env.NTA_ANSWER_VERIFIER_MAX_ROWS || 50)));
const NTA_AI_ANSWER_CONFIDENCE_THRESHOLD = Math.min(1, Math.max(0.5, Number(process.env.NTA_AI_ANSWER_CONFIDENCE_THRESHOLD || 0.86)));
const NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD = ANSWER_LOCAL_CONFIDENCE_THRESHOLD;
const NTA_AI_REFILL_ATTEMPTS = Math.min(3, Math.max(1, Number(process.env.NTA_AI_REFILL_ATTEMPTS || 2)));
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const GOOD_STATUS = new Set(['live', 'active', 'published']);
const GOOD_VERIFICATION = new Set(['verified']);
const GOOD_QUALITY_BANDS = new Set(['strong', 'exceptional', 'verified', 'high']);
const ACTIVE_EXPLORATION_STATES = new Set(['active', 'fast_track', 'promoted']);
const PASSAGE_CHAPTERS = new Set([
  'Factual Passage',
  'Narrative Passage',
  'Literary Passage',
  'Reading Comprehension',
  'Prose',
  'Discursive Passage',
  'Unseen Passage',
]);
const MIN_REAL_PASSAGE_WORDS = 70;
const MIN_REAL_PASSAGE_SENTENCES = 3;

const PLACEHOLDER_PATTERNS = [
  /\b(lorem ipsum|todo|insert question|replace this|dummy question|sample question)\b/i,
  /\b(question goes here|option goes here|answer goes here)\b/i,
  /^(question|untitled|undefined|null|n\/a)$/i,
];

const MALFORMED_MARKUP_PATTERNS = [
  /<script\b/i,
  /<\/?[a-z][^>]*$/i,
  /\{\{|\}\}/,
  /\[\[|\]\]/,
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'which', 'what', 'when',
  'where', 'does', 'into', 'only', 'following', 'correct', 'option', 'choose',
]);

let openaiClient = null;

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function textValue(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
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

function fingerprint(value) {
  return normalizeComparable(value).slice(0, 260);
}

function stableHash(value) {
  let hash = 2166136261;
  const str = String(value || '');
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededJitter(seed, id) {
  return (stableHash(`${seed || 'nta'}:${id || ''}`) % 1000) / 1000;
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

export function normalizeOptions(input, row = {}) {
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

export function getQuestionText(row) {
  return textValue(firstPresent(row, ['question', 'body', 'q', 'prompt', 'stem']));
}

export function getPassageText(row) {
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

export function getPassageTitle(row) {
  return textValue(firstPresent(row, ['passageTitle', 'passage_title', 'passage.title', 'title', 'passage_type', 'passageType']));
}

export function getPassageKey(row) {
  const explicit = textValue(firstPresent(row, [
    'passageGroupId',
    'passage_group_id',
    'group_id',
    'set_id',
    'comprehension_id',
    'passageId',
    'passage_id',
  ]));
  if (explicit) return explicit;

  const passageText = getPassageText(row);
  return passageText ? `inline:${fingerprint(passageText).slice(0, 96) || stableHash(passageText)}` : '';
}

export function isPassageLinkedQuestion(row) {
  const chapter = textValue(row?.chapter);
  const type = textValue(row?.questionType ?? row?.question_type).toLowerCase();
  const topic = textValue(row?.topic ?? row?.badge ?? row?.label ?? row?.passage_type ?? row?.passageType).toLowerCase();
  const text = getQuestionText(row);
  const passageChapter = PASSAGE_CHAPTERS.has(chapter) || /\b(passage|reading comprehension|prose)\b/i.test(chapter);
  const passageType = /\b(reading_comprehension|comprehension|passage|central_idea|inference|author_purpose|tone|vocabulary_in_context|literary_device)\b/i.test(type);
  const passageBadge = /\b(passage|reading comprehension|prose)\b/i.test(topic);
  const mentionsPassage = /\b(according to|based on|as stated in|read the passage|read the excerpt|read the extract|read the text|the passage|the paragraph|the extract|the excerpt|the author|the narrator)\b/i.test(text);
  return Boolean(
    getPassageKey(row) ||
    getPassageText(row) ||
    row?.is_passage_linked ||
    passageChapter ||
    passageType ||
    passageBadge ||
    mentionsPassage
  );
}

export function hasRealPassageBlock(row) {
  const passageText = getPassageText(row);
  if (!passageText) return false;
  const wordCount = passageText.split(/\s+/).filter(Boolean).length;
  const sentenceCount = (passageText.match(/[.!?](?:\s|$)/g) || []).length;
  return wordCount >= MIN_REAL_PASSAGE_WORDS && sentenceCount >= MIN_REAL_PASSAGE_SENTENCES;
}

function isEnglishTheoryAssertionWithoutContext(row, subject) {
  if (subject !== 'english') return false;
  const text = getQuestionText(row);
  const type = textValue(row?.questionType ?? row?.question_type).toLowerCase();
  const chapter = textValue(row?.chapter).toLowerCase();
  const assertionReason = type.includes('assertion') || /\bassertion\s*:/i.test(text) || /\breason\s*:/i.test(text);
  if (!assertionReason) return false;
  if (isPassageLinkedQuestion(row) && hasRealPassageBlock(row)) return false;
  return /\b(paraphras|summary|summaris|rewrite|meaning|definition|grammar|phrase|sentence)\b/i.test(`${chapter} ${text}`);
}

function isGenericTextbookOneLiner(row, subject) {
  const text = getQuestionText(row);
  if (!text || isPassageLinkedQuestion(row)) return false;
  if (subject === 'english' && /\b(closest in meaning|opposite in meaning|rearrange|sentence correction|error detection)\b/i.test(text)) return false;
  const directRecall = /\b(what is|define|definition of|meaning of|is called|known as|refers to)\b/i.test(text);
  const hasExamPattern = /\b(statement|assertion|reason|case|scenario|situation|given|data|match|following statements|which of the following)\b/i.test(text);
  return directRecall && !hasExamPattern && text.length < 180;
}

export function getNtaContentWarnings(row, context = {}) {
  const warnings = [];
  const subject = subjectOf(row, context);
  const passageLinked = isPassageLinkedQuestion(row);
  if (passageLinked && !getPassageText(row)) warnings.push('orphan_passage_question');
  if (passageLinked && getPassageText(row) && !hasRealPassageBlock(row)) warnings.push('fake_or_too_short_passage_block');
  if (isEnglishTheoryAssertionWithoutContext(row, subject)) warnings.push('generic_english_assertion_reason_without_context');
  if (isGenericTextbookOneLiner(row, subject)) warnings.push('generic_textbook_one_liner');
  return warnings;
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

function resolveCorrectIndex(row, options) {
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

function hasMalformedText(text) {
  return MALFORMED_MARKUP_PATTERNS.some((pattern) => pattern.test(text));
}

function hasPlaceholderText(text) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function optionsAreUsable(options) {
  if (options.length !== 4) return false;
  const texts = options.map((option) => option.text);
  if (texts.some((text) => !text || text.length > 240)) return false;
  if (texts.some((text) => /^(option\s*)?[a-d]$/i.test(text) || hasPlaceholderText(text))) return false;
  return new Set(texts.map(normalizeComparable)).size === texts.length;
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

function optionFingerprint(options) {
  return options.map((option) => normalizeComparable(option.text)).sort().join('|');
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

function countReason(target, reason) {
  target[reason] = (target[reason] || 0) + 1;
}

function topReasons(reasonMap) {
  return Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }));
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function difficultyOf(row) {
  const difficulty = textValue(row?.difficulty).toLowerCase();
  return VALID_DIFFICULTIES.has(difficulty) ? difficulty : 'medium';
}

function qualityBand(row) {
  return textValue(row?.quality_band ?? row?.qualityBand).toLowerCase();
}

function aiTier(row) {
  return textValue(row?.ai_tier ?? row?.aiTier).toUpperCase();
}

function anchorTier(row) {
  const tier = Number(row?.anchor_tier ?? row?.anchorTier);
  return Number.isFinite(tier) ? tier : null;
}

function conceptKey(row) {
  return textValue(row?.concept_id ?? row?.conceptId ?? row?.topic ?? row?.chapter) || 'unknown';
}

function subjectOf(row, context) {
  return toInternalSubjectId(textValue(row?.internalSubject ?? row?.subject ?? context?.subjectId));
}

function isDeleted(row) {
  return row?.is_deleted === true || row?.deleted === true || textValue(row?.status).toLowerCase() === 'deleted';
}

function isWrongSubject(row, context) {
  const expected = toInternalSubjectId(textValue(context?.subjectId));
  const actual = subjectOf(row, context);
  return Boolean(expected && actual && expected !== actual);
}

function hasValidChapter(row, subject) {
  const chapter = textValue(row?.chapter);
  return Boolean(chapter && subject && isValidTopSyllabusPair(subject, chapter));
}

function scoreMetadata(row, normalized) {
  let score = 0.45;
  const status = textValue(row?.status).toLowerCase();
  const verification = textValue(row?.verification_state ?? row?.verificationState).toLowerCase();
  const exploration = textValue(row?.exploration_state ?? row?.explorationState).toLowerCase();
  const band = qualityBand(row);
  const tier = anchorTier(row);
  const qScore = numericValue(row?.quality_score ?? row?.qualityScore);
  const validationConfidence = numericValue(row?.validation_confidence ?? row?.validationConfidence);

  if (!status || GOOD_STATUS.has(status)) score += 0.08;
  if (GOOD_VERIFICATION.has(verification)) score += 0.12;
  if (GOOD_QUALITY_BANDS.has(band)) score += 0.12;
  if (tier === 1) score += 0.12;
  else if (tier === 2) score += 0.08;
  else if (tier === 3) score += 0.03;
  if (textValue(row?.pyq_anchor_id ?? row?.pyqAnchorId)) score += 0.07;
  if (!exploration || ACTIVE_EXPLORATION_STATES.has(exploration)) score += 0.04;
  if (normalized.chapterValid) score += 0.05;
  if (VALID_DIFFICULTIES.has(textValue(row?.difficulty).toLowerCase())) score += 0.04;
  if (textValue(row?.explanation).length >= 24) score += 0.04;
  if (qScore != null) score += Math.min(0.12, Math.max(0, qScore) * 0.12);
  if (validationConfidence != null) score += Math.min(0.08, Math.max(0, validationConfidence) * 0.08);
  if (aiTier(row) === 'A') score += 0.04;
  else if (aiTier(row) === 'B') score += 0.025;
  if (normalized.text.length >= 36 && tokensForSimilarity(normalized.text).length >= 6) score += 0.04;
  if (normalized.passageLinked && normalized.passageText) score += 0.03;
  score += Math.max(-0.04, Math.min(0.05, Number(row?.score || 0) * 0.01));

  return Math.max(0, Math.min(1, score));
}

function tierFor(row, normalized) {
  const band = qualityBand(row);
  const tier = anchorTier(row);
  const verification = textValue(row?.verification_state ?? row?.verificationState).toLowerCase();
  const status = textValue(row?.status).toLowerCase();
  const anchored = tier === 1 || tier === 2 || textValue(row?.pyq_anchor_id ?? row?.pyqAnchorId);
  const metadataBest =
    (!status || GOOD_STATUS.has(status)) &&
    (!verification || GOOD_VERIFICATION.has(verification)) &&
    (!band || GOOD_QUALITY_BANDS.has(band)) &&
    anchored &&
    normalized.chapterValid &&
    VALID_DIFFICULTIES.has(textValue(row?.difficulty).toLowerCase());

  if (metadataBest) return 1;

  const reasonableText = normalized.text.length >= 24 && tokensForSimilarity(normalized.text).length >= 5;
  const hasSomeQualitySignal =
    GOOD_QUALITY_BANDS.has(band) ||
    GOOD_VERIFICATION.has(verification) ||
    anchored ||
    numericValue(row?.quality_score ?? row?.qualityScore) >= 0.6 ||
    normalized.chapterValid;

  if (reasonableText || hasSomeQualitySignal) return 2;
  return 3;
}

function normalizedRow(row, normalized) {
  const passageKey = normalized.passageKey || null;
  return {
    ...row,
    subject: normalized.subject,
    chapter: textValue(row?.chapter),
    question: row?.question ?? row?.body ?? normalized.text,
    body: row?.body ?? row?.question ?? normalized.text,
    options: normalized.options,
    correct_index: normalized.correctIndex,
    correct_answer: OPTION_KEYS[normalized.correctIndex] || row?.correct_answer || row?.answer,
    difficulty: normalized.difficulty,
    passage_group_id: passageKey || row?.passage_group_id || null,
    passage_id: row?.passage_id || passageKey || null,
    passage_text: normalized.passageText || row?.passage_text || null,
    passage_title: normalized.passageTitle || row?.passage_title || null,
    order_index: normalized.orderIndex,
  };
}

export function qualityGateNtaQuestion(row, context = {}) {
  const reasons = [];
  const subject = subjectOf(row, context);
  const text = getQuestionText(row);
  const options = normalizeOptions(row?.options, row);
  const correctIndex = resolveCorrectIndex(row, options);
  const passageLinked = isPassageLinkedQuestion(row);
  const passageText = getPassageText(row);
  const passageKey = getPassageKey(row);

  if (isDeleted(row)) reasons.push('deleted_question');
  if (isWrongSubject(row, context)) reasons.push('wrong_subject');
  if (!text || text.length < 10 || tokensForSimilarity(text).length < 3) reasons.push('question_missing_or_too_short');
  if (hasMalformedText(text)) reasons.push('malformed_question_text');
  if (hasPlaceholderText(text)) reasons.push('placeholder_question');
  if (!optionsAreUsable(options)) reasons.push('options_invalid');
  if (correctIndex < 0) reasons.push('answer_missing_or_mismatch');
  for (const warning of getNtaContentWarnings(row, { ...context, subjectId: subject })) {
    reasons.push(warning);
  }

  const chapterValid = hasValidChapter(row, subject);
  const normalized = {
    id: row?.id,
    subject,
    chapter: textValue(row?.chapter),
    chapterValid,
    text,
    options,
    correctIndex,
    difficulty: difficultyOf(row),
    passageLinked,
    passageKey,
    passageText,
    passageTitle: getPassageTitle(row),
    orderIndex: Number(row?.order_index ?? row?.orderIndex ?? 0) || 0,
    conceptKey: conceptKey(row),
    fingerprint: fingerprint(`${text} ${optionFingerprint(options)}`),
  };

  const accepted = reasons.length === 0;
  const tier = accepted ? tierFor(row, normalized) : null;
  const score = accepted ? scoreMetadata(row, normalized) : 0;

  return {
    accepted,
    usable: accepted,
    reasons,
    tier,
    score,
    normalized,
    row: accepted ? normalizedRow(row, normalized) : row,
  };
}

function candidateScore(candidate, seed) {
  const rowId = candidate.rows.map((row) => row.id).join(':');
  const tierBonus = candidate.tier === 1 ? 0.24 : candidate.tier === 2 ? 0.10 : 0;
  return candidate.score + tierBonus + (seededJitter(seed, rowId) * 0.01);
}

function candidateHasDuplicate(candidate, fingerprints) {
  for (const row of candidate.rows) {
    const fp = fingerprint(`${getQuestionText(row)} ${optionFingerprint(normalizeOptions(row.options, row))}`);
    if (!fp) continue;
    if (fingerprints.has(fp)) return true;
    for (const existing of fingerprints) {
      if (jaccardSimilarity(fp, existing) >= 0.98 && (fp.includes(existing) || existing.includes(fp))) return true;
    }
  }
  return false;
}

function rememberFingerprints(rows, fingerprints) {
  for (const row of rows) {
    const fp = fingerprint(`${getQuestionText(row)} ${optionFingerprint(normalizeOptions(row.options, row))}`);
    if (fp) fingerprints.add(fp);
  }
}

function buildCandidates(entries, diagnostics, subjectId) {
  const standalone = [];
  const groups = new Map();

  for (const entry of entries) {
    if (entry.normalized.passageLinked) {
      const key = entry.normalized.passageKey || getPassageKey(entry.row);
      const bucket = groups.get(key) || [];
      bucket.push(entry);
      groups.set(key, bucket);
    } else {
      standalone.push({
        kind: 'question',
        rows: [entry.row],
        size: 1,
        tier: entry.tier,
        score: entry.score,
      });
    }
  }

  const passageGroups = [];
  for (const [key, groupEntries] of groups.entries()) {
    const sorted = groupEntries
      .slice()
      .sort((a, b) => a.normalized.orderIndex - b.normalized.orderIndex || String(a.row.id).localeCompare(String(b.row.id)));
    const fingerprints = new Set();
    let duplicate = false;
    for (const entry of sorted) {
      if (fingerprints.has(entry.normalized.fingerprint)) duplicate = true;
      fingerprints.add(entry.normalized.fingerprint);
    }
    if (duplicate) {
      diagnostics.passageQuestionsExcluded += sorted.length;
      countReason(diagnostics.hardRejectReasons, 'duplicate_or_near_duplicate');
      continue;
    }

    const avgScore = sorted.reduce((sum, entry) => sum + entry.score, 0) / sorted.length;
    const bestTier = Math.min(...sorted.map((entry) => entry.tier));
    const idealSizeBonus = sorted.length >= 3 && sorted.length <= 6 ? 0.06 : 0.01;
    const englishBonus = toInternalSubjectId(subjectId) === 'english' ? 0.06 : 0;

    passageGroups.push({
      kind: 'passage',
      passageKey: key,
      rows: sorted.map((entry) => entry.row),
      size: sorted.length,
      tier: bestTier,
      score: avgScore + idealSizeBonus + englishBonus,
    });
  }

  return {
    passageGroups,
    standalone,
    all: [...passageGroups, ...standalone],
  };
}

function selectedQuestionCount(selected) {
  return selected.reduce((sum, candidate) => sum + candidate.size, 0);
}

function candidateAnswerIntegrity(candidate) {
  const checks = candidate.rows.map((row) => verifyNtaAnswerIntegrity(row));
  const failed = checks.filter((check) => !check.accepted);
  return {
    accepted: failed.length === 0,
    checks,
    failed,
    reasons: [...new Set(failed.flatMap((check) => check.reasons))],
  };
}

function recordAnswerIntegrityFailure(diagnostics, candidate, integrity) {
  const failedIds = integrity.failed
    .map((check) => check.questionId)
    .filter(Boolean);

  diagnostics.answerIntegrity.rejectedByAnswerGuard += candidate.size;
  diagnostics.answerIntegrity.failedQuestionIds.push(...failedIds);
  for (const reason of integrity.reasons) {
    countReason(diagnostics.answerIntegrity.rejectReasons, reason);
    countReason(diagnostics.hardRejectReasons, reason);
  }
}

function selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics, opts = {}) {
  if (selectedQuestionCount(selected) + candidate.size > targetCount) return false;
  if (candidateHasDuplicate(candidate, fingerprints)) {
    if (opts.recordDiagnostics !== false) countReason(diagnostics.hardRejectReasons, 'duplicate_or_near_duplicate');
    return false;
  }
  if (opts.answerIntegrity !== false) {
    const integrity = candidateAnswerIntegrity(candidate);
    if (!integrity.accepted) {
      recordAnswerIntegrityFailure(diagnostics, candidate, integrity);
      return false;
    }
  }
  selected.push(candidate);
  rememberFingerprints(candidate.rows, fingerprints);
  return true;
}

function selectRankedCandidates(rankedPassages, rankedStandalone, targetCount, diagnostics, opts = {}) {
  const selected = [];
  const fingerprints = new Set();

  for (const tier of [1, 2, 3]) {
    for (const candidate of rankedPassages.filter((entry) => entry.tier === tier)) {
      if (selectedQuestionCount(selected) >= targetCount) break;
      selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics, opts);
    }
    for (const candidate of rankedStandalone.filter((entry) => entry.tier === tier)) {
      if (selectedQuestionCount(selected) >= targetCount) break;
      selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics, opts);
    }
  }

  return selected;
}

export function selectNtaQuestionSet(rows, requestedCount = NTA_QUESTION_COUNT, options = {}) {
  const targetCount = NTA_QUESTION_COUNT;
  const subjectId = toInternalSubjectId(textValue(options.subjectId));
  const diagnostics = {
    mode: 'nta',
    requestedCount: Number(requestedCount) || targetCount,
    finalCount: targetCount,
    durationMinutes: NTA_DURATION_MINUTES,
    selectionStrategy: 'ranked_quality_fallback',
    totalCandidates: Array.isArray(rows) ? rows.length : 0,
    acceptedCandidates: 0,
    finalSelectedCount: 0,
    passageGroupsIncluded: 0,
    passageQuestionsIncluded: 0,
    passageQuestionsExcluded: 0,
    hardRejectReasons: {},
    poolStats: {
      totalSubjectCandidates: Array.isArray(rows) ? rows.length : 0,
      usable: 0,
      hardRejected: 0,
      tier1: 0,
      tier2: 0,
      tier3: 0,
      selected: 0,
      passageGroupsSelected: 0,
      standaloneSelected: 0,
      topRejectReasons: [],
    },
    answerIntegrity: {
      mode: 'deterministic',
      selectedBeforeVerification: 0,
      rejectedByAnswerGuard: 0,
      refilledCount: 0,
      finalVerifiedCount: 0,
      failedQuestionIds: [],
      rejectReasons: {},
      topRejectReasons: [],
      passed: false,
    },
  };

  const evaluated = (Array.isArray(rows) ? rows : []).map((row) => qualityGateNtaQuestion(row, { ...options, subjectId }));
  const usable = [];
  for (const entry of evaluated) {
    if (entry.accepted) {
      usable.push(entry);
      diagnostics.poolStats[`tier${entry.tier}`] += 1;
    } else {
      diagnostics.poolStats.hardRejected += 1;
      for (const reason of entry.reasons) countReason(diagnostics.hardRejectReasons, reason);
    }
  }

  diagnostics.acceptedCandidates = usable.length;
  diagnostics.poolStats.usable = usable.length;

  const { passageGroups, standalone } = buildCandidates(usable, diagnostics, subjectId);
  const seed = options.seed || '';

  const rankedPassages = passageGroups
    .filter((candidate) => candidate.size <= targetCount)
    .sort((a, b) => candidateScore(b, seed) - candidateScore(a, seed));
  const rankedStandalone = standalone
    .sort((a, b) => candidateScore(b, seed) - candidateScore(a, seed));

  const selectedBeforeVerification = selectRankedCandidates(
    rankedPassages,
    rankedStandalone,
    targetCount,
    diagnostics,
    { answerIntegrity: false, recordDiagnostics: false },
  );
  diagnostics.answerIntegrity.selectedBeforeVerification = selectedQuestionCount(selectedBeforeVerification);

  const selected = selectRankedCandidates(
    rankedPassages,
    rankedStandalone,
    targetCount,
    diagnostics,
    { answerIntegrity: true },
  );

  const selectedRows = selected.flatMap((candidate) => candidate.rows).slice(0, targetCount);
  diagnostics.answerIntegrity.refilledCount = Math.max(
    0,
    selectedRows.filter((row) => !selectedBeforeVerification.some((candidate) => candidate.rows.some((candidateRow) => candidateRow.id === row.id))).length,
  );
  diagnostics.answerIntegrity.finalVerifiedCount = selectedRows.length;
  diagnostics.answerIntegrity.passed = selectedRows.length === targetCount && diagnostics.answerIntegrity.rejectedByAnswerGuard === 0
    ? true
    : selectedRows.length === targetCount;
  diagnostics.answerIntegrity.topRejectReasons = topReasons(diagnostics.answerIntegrity.rejectReasons);

  diagnostics.finalSelectedCount = selectedRows.length;
  diagnostics.passageGroupsIncluded = selected.filter((candidate) => candidate.kind === 'passage').length;
  diagnostics.passageQuestionsIncluded = selected
    .filter((candidate) => candidate.kind === 'passage')
    .reduce((sum, candidate) => sum + candidate.size, 0);
  diagnostics.poolStats.selected = selectedRows.length;
  diagnostics.poolStats.passageGroupsSelected = diagnostics.passageGroupsIncluded;
  diagnostics.poolStats.standaloneSelected = selected
    .filter((candidate) => candidate.kind === 'question')
    .reduce((sum, candidate) => sum + candidate.size, 0);
  diagnostics.poolStats.topRejectReasons = topReasons(diagnostics.hardRejectReasons);
  diagnostics.insufficientUsablePool = selectedRows.length < targetCount;
  diagnostics.insufficientHighQualityPool = false;
  diagnostics.canBuild50 = selectedRows.length === targetCount;
  diagnostics.message = diagnostics.canBuild50
    ? undefined
    : diagnostics.answerIntegrity.rejectedByAnswerGuard > 0
    ? `The database has ${diagnostics.poolStats.usable} structurally usable NTA questions, but only ${selectedRows.length} passed answer integrity; 50 are required.`
    : `The database has ${diagnostics.poolStats.usable} usable NTA question${diagnostics.poolStats.usable === 1 ? '' : 's'} for this subject after hard rejection; 50 are required.`;

  return { selectedRows, diagnostics };
}

function compactQuestionForAi(row) {
  const options = normalizeOptions(row?.options, row);
  const correctIndex = resolveCorrectIndex(row, options);
  return {
    id: String(row?.id || ''),
    subject: subjectOf(row, {}),
    chapter: textValue(row?.chapter),
    question: getQuestionText(row).slice(0, 1200),
    passage: getPassageText(row).slice(0, 1400) || null,
    options: options.map((option) => `${option.key}) ${option.text}`).slice(0, 4),
    stored_correct_answer: correctIndex >= 0 ? options[correctIndex]?.key : textValue(answerRaw(row)),
    explanation: explanationText(row).slice(0, 900) || null,
  };
}

function safeParseJsonObject(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAiAnswerResult(row, result) {
  const check = verifyNtaAnswerIntegrity(row);
  const solvedAnswer = textValue(result?.solved_answer).toUpperCase();
  const verdict = textValue(result?.verdict).toLowerCase();
  const confidence = Math.max(0, Math.min(1, Number(result?.confidence || 0)));
  const reason = textValue(result?.reason || result?.reasons?.join?.(', ') || '');
  const solvedKey = OPTION_KEYS.includes(solvedAnswer) ? solvedAnswer : null;
  const pass = verdict === 'pass' &&
    solvedKey &&
    solvedKey === check.correctKey &&
    confidence >= NTA_AI_ANSWER_CONFIDENCE_THRESHOLD;

  return {
    questionId: row?.id || null,
    pass,
    verdict: pass ? 'pass' : (verdict || 'fail'),
    solvedAnswer: solvedKey,
    storedAnswer: check.correctKey,
    confidence,
    reason: pass
      ? reason
      : reason || (solvedKey && solvedKey !== check.correctKey ? 'ai_solved_answer_mismatch' : 'ai_low_confidence_or_unsure'),
  };
}

async function runOpenAiNtaAnswerVerifier(rows, options = {}) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) {
    return { enabled: true, model: options.model || NTA_AI_ANSWER_VERIFIER_MODEL, results: [], skippedReason: 'no_low_confidence_rows' };
  }

  if (typeof options.aiAnswerVerifier === 'function') {
    const raw = await options.aiAnswerVerifier(list, {
      model: options.model || NTA_AI_ANSWER_VERIFIER_MODEL,
      confidenceThreshold: NTA_AI_ANSWER_CONFIDENCE_THRESHOLD,
    });
    const byId = new Map((Array.isArray(raw) ? raw : []).map((entry) => [String(entry.id || entry.questionId || ''), entry]));
    return {
      enabled: true,
      model: 'injected-test-verifier',
      results: list.map((row) => normalizeAiAnswerResult(row, byId.get(String(row.id)) || { verdict: 'unsure', confidence: 0, reason: 'missing_injected_result' })),
    };
  }

  if (options.aiAnswerVerifier === false) {
    return { enabled: false, model: options.model || NTA_AI_ANSWER_VERIFIER_MODEL, results: [], skippedReason: 'disabled_by_caller' };
  }

  const client = getOpenAiClient();
  if (!client) {
    return { enabled: false, model: options.model || NTA_AI_ANSWER_VERIFIER_MODEL, results: [], skippedReason: 'openai_api_key_missing' };
  }

  const model = options.model || NTA_AI_ANSWER_VERIFIER_MODEL;
  const prompt = `You are verifying CUET NTA-mode MCQ answer keys before a student starts a timed mock.

Solve each question independently. Compare your solved answer with stored_correct_answer.
Return pass only when there is one clear correct option, stored_correct_answer matches it, and confidence is high.
Return fail for a wrong key or multiple-correct risk. Return unsure when evidence is insufficient.

Questions:
${JSON.stringify(list.map(compactQuestionForAi))}

Return JSON only.`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Return only strict JSON for answer-key verification.' },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'nta_answer_verification',
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
                  required: ['id', 'verdict', 'solved_answer', 'confidence', 'reason'],
                  properties: {
                    id: { type: 'string' },
                    verdict: { type: 'string', enum: ['pass', 'fail', 'unsure'] },
                    solved_answer: { type: 'string', enum: ['A', 'B', 'C', 'D', 'UNKNOWN'] },
                    confidence: { type: 'number' },
                    reason: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    }, { timeout: Math.max(4_000, Number(options.timeoutMs || NTA_AI_ANSWER_VERIFIER_TIMEOUT_MS)) });

    const text = response?.choices?.[0]?.message?.content || '';
    const parsed = safeParseJsonObject(text);
    const byId = new Map((Array.isArray(parsed?.results) ? parsed.results : []).map((entry) => [String(entry.id || ''), entry]));
    return {
      enabled: true,
      model,
      usage: response?.usage || null,
      results: list.map((row) => normalizeAiAnswerResult(row, byId.get(String(row.id)) || { verdict: 'unsure', confidence: 0, reason: 'missing_ai_result' })),
    };
  } catch (error) {
    return {
      enabled: true,
      model,
      error: error?.message || 'ai_answer_verifier_failed',
      results: list.map((row) => normalizeAiAnswerResult(row, { verdict: 'unsure', confidence: 0, reason: 'ai_answer_verifier_failed_closed' })),
    };
  }
}

function addAiReason(ai, reason, count = 1) {
  ai.rejectReasons[reason] = (ai.rejectReasons[reason] || 0) + count;
}

function attachAiDiagnostics(result, ai) {
  result.diagnostics.answerIntegrity.ai = {
    ...ai,
    topRejectReasons: topReasons(ai.rejectReasons),
  };
  result.diagnostics.answerIntegrity.topRejectReasons = topReasons({
    ...result.diagnostics.answerIntegrity.rejectReasons,
    ...ai.rejectReasons,
  });
  return result;
}

export async function selectNtaQuestionSetWithAnswerVerification(rows, requestedCount = NTA_QUESTION_COUNT, options = {}) {
  const startedAt = Date.now();
  const ai = {
    enabled: options.aiAnswerVerifier !== false,
    model: options.model || NTA_AI_ANSWER_VERIFIER_MODEL,
    localConfidenceThreshold: NTA_LOCAL_ANSWER_CONFIDENCE_THRESHOLD,
    aiConfidenceThreshold: NTA_AI_ANSWER_CONFIDENCE_THRESHOLD,
    timeBudgetMs: Number(options.timeBudgetMs || NTA_AI_ANSWER_VERIFIER_TIMEOUT_MS),
    checkedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    attempts: 0,
    failedQuestionIds: [],
    rejectReasons: {},
    topRejectReasons: [],
    skippedReason: null,
    elapsedMs: 0,
  };

  const excludedIds = new Set();
  const aiPassedIds = new Set();
  let latest = null;

  for (let attempt = 0; attempt < NTA_AI_REFILL_ATTEMPTS; attempt += 1) {
    ai.attempts = attempt + 1;
    const candidateRows = Array.isArray(rows)
      ? rows.filter((row) => !excludedIds.has(row?.id))
      : [];
    latest = selectNtaQuestionSet(candidateRows, requestedCount, options);

    if (latest.selectedRows.length !== NTA_QUESTION_COUNT) {
      ai.elapsedMs = Date.now() - startedAt;
      return attachAiDiagnostics(latest, ai);
    }

    const lowConfidenceRows = latest.selectedRows
      .map((row) => ({ row, local: scoreNtaAnswerLocalConfidence(row) }))
      .filter((entry) => entry.local.needsAi && !aiPassedIds.has(entry.row.id))
      .sort((a, b) => a.local.confidence - b.local.confidence)
      .slice(0, NTA_AI_ANSWER_VERIFIER_MAX_ROWS);

    ai.skippedCount += Math.max(0, latest.selectedRows.length - lowConfidenceRows.length);
    if (lowConfidenceRows.length === 0) {
      ai.skippedReason = 'all_rows_high_local_confidence';
      ai.elapsedMs = Date.now() - startedAt;
      return attachAiDiagnostics(latest, ai);
    }

    const remainingMs = Math.max(0, ai.timeBudgetMs - (Date.now() - startedAt));
    if (remainingMs < 4_000) {
      ai.skippedReason = 'ai_time_budget_exhausted';
      ai.elapsedMs = Date.now() - startedAt;
      return attachAiDiagnostics(latest, ai);
    }

    const aiResult = await runOpenAiNtaAnswerVerifier(
      lowConfidenceRows.map((entry) => entry.row),
      {
        ...options,
        timeoutMs: Math.min(NTA_AI_ANSWER_VERIFIER_TIMEOUT_MS, remainingMs),
      },
    );

    if (aiResult.enabled === false) {
      ai.enabled = false;
      ai.skippedReason = aiResult.skippedReason;
      ai.elapsedMs = Date.now() - startedAt;
      return attachAiDiagnostics(latest, ai);
    }

    ai.model = aiResult.model || ai.model;
    if (aiResult.error) {
      ai.error = aiResult.error;
      addAiReason(ai, 'ai_answer_verifier_failed_closed', lowConfidenceRows.length);
    }
    ai.checkedCount += lowConfidenceRows.length;

    const failed = aiResult.results.filter((entry) => !entry.pass);
    for (const entry of aiResult.results) {
      if (entry.pass && entry.questionId) aiPassedIds.add(entry.questionId);
    }
    if (failed.length === 0) {
      ai.elapsedMs = Date.now() - startedAt;
      return attachAiDiagnostics(latest, ai);
    }

    ai.failedCount += failed.length;
    for (const entry of failed) {
      if (entry.questionId) {
        excludedIds.add(entry.questionId);
        ai.failedQuestionIds.push(entry.questionId);
      }
      addAiReason(ai, entry.reason || 'ai_answer_verifier_rejected');
    }
  }

  const finalRows = Array.isArray(rows)
    ? rows.filter((row) => !excludedIds.has(row?.id))
    : [];
  latest = selectNtaQuestionSet(finalRows, requestedCount, options);
  ai.elapsedMs = Date.now() - startedAt;
  return attachAiDiagnostics(latest, ai);
}
