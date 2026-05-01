import { isValidTopSyllabusPair } from './canonical_syllabus.js';
import { toInternalSubjectId } from './cuet_controls.js';

export const NTA_QUESTION_COUNT = 50;
export const NTA_DURATION_MINUTES = 60;

const OPTION_KEYS = ['A', 'B', 'C', 'D'];
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const GOOD_STATUS = new Set(['live', 'active', 'published']);
const GOOD_VERIFICATION = new Set(['verified']);
const GOOD_QUALITY_BANDS = new Set(['strong', 'exceptional', 'verified', 'high']);
const ACTIVE_EXPLORATION_STATES = new Set(['active', 'fast_track', 'promoted']);
const PASSAGE_CHAPTERS = new Set(['Factual Passage', 'Narrative Passage', 'Literary Passage']);

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
  const text = getQuestionText(row);
  const mentionsPassage = /\b(according to|based on|as stated in|the passage|the paragraph|the extract|the author|the narrator)\b/i.test(text);
  return Boolean(
    getPassageKey(row) ||
    getPassageText(row) ||
    row?.is_passage_linked ||
    type.includes('reading_comprehension') ||
    type.includes('comprehension') ||
    type.includes('passage') ||
    (PASSAGE_CHAPTERS.has(chapter) && mentionsPassage)
  );
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
  if (passageLinked && !passageText) reasons.push('orphan_passage_question');

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

function selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics) {
  if (selectedQuestionCount(selected) + candidate.size > targetCount) return false;
  if (candidateHasDuplicate(candidate, fingerprints)) {
    countReason(diagnostics.hardRejectReasons, 'duplicate_or_near_duplicate');
    return false;
  }
  selected.push(candidate);
  rememberFingerprints(candidate.rows, fingerprints);
  return true;
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

  const { passageGroups, standalone, all } = buildCandidates(usable, diagnostics, subjectId);
  const selected = [];
  const fingerprints = new Set();
  const seed = options.seed || '';

  const rankedPassages = passageGroups
    .filter((candidate) => candidate.size <= targetCount)
    .sort((a, b) => candidateScore(b, seed) - candidateScore(a, seed));
  const rankedStandalone = standalone
    .sort((a, b) => candidateScore(b, seed) - candidateScore(a, seed));

  for (const tier of [1, 2, 3]) {
    for (const candidate of rankedPassages.filter((entry) => entry.tier === tier)) {
      if (selectedQuestionCount(selected) >= targetCount) break;
      selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics);
    }
    for (const candidate of rankedStandalone.filter((entry) => entry.tier === tier)) {
      if (selectedQuestionCount(selected) >= targetCount) break;
      selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics);
    }
  }

  if (selectedQuestionCount(selected) < targetCount) {
    const selectedRows = new Set(selected.flatMap((candidate) => candidate.rows.map((row) => row.id)));
    const remainingPassageRows = all
      .filter((candidate) => candidate.kind === 'passage')
      .flatMap((candidate) => candidate.rows)
      .filter((row) => !selectedRows.has(row.id))
      .map((row) => ({
        kind: 'question',
        rows: [row],
        size: 1,
        tier: 3,
        score: 0.35,
      }));

    for (const candidate of remainingPassageRows) {
      if (selectedQuestionCount(selected) >= targetCount) break;
      selectCandidate(candidate, selected, fingerprints, targetCount, diagnostics);
    }
  }

  const selectedRows = selected.flatMap((candidate) => candidate.rows).slice(0, targetCount);
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
    : `The database has ${diagnostics.poolStats.usable} usable NTA question${diagnostics.poolStats.usable === 1 ? '' : 's'} for this subject after hard rejection; 50 are required.`;

  return { selectedRows, diagnostics };
}
