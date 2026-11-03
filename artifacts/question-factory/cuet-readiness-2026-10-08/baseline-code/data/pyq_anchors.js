import { SEED_QUESTIONS } from './questions.js';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getMicroConceptById,
  getSyllabusConcepts,
  normalizeSubjectSelection,
  toInternalSubjectId,
  toPublicSubjectId,
} from './cuet_controls.js';
import { getEnglishConceptFamily } from '../scripts/pipeline/lib/englishGenerationMode.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STRUCTURED_PYQ_ANCHOR_ROOT = join(__dirname, 'pyq_anchors');
const LIVE_SOURCE_QUALITIES = new Set(['real_pyq', 'manual_seed']);

const LEGACY_CHAPTER_MAP = Object.freeze({
  accountancy: {
    Partnership: 'Partnership Fundamentals',
  },
  economics: {
    'National Income': 'National Income & Related Aggregates',
  },
  business_studies: {
    Management: 'Nature & Significance of Management',
  },
  english: {
    Grammar: 'Correct Word Usage',
  },
  gat: {
    GK: 'General Knowledge',
  },
});

const DIFFICULTY_RANK = Object.freeze({ easy: 0, medium: 1, hard: 2 });
const SIMPLE_STRUCTURE_RANK = Object.freeze({
  short_direct_mcq: 0,
  which_of_the_following_direct_concept: 1,
  choose_correct_usage: 1,
  fill_in_blank_usage: 1,
  one_step_numerical_question: 2,
});

function normalizeDifficulty(value) {
  const difficulty = String(value || '').toLowerCase();
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
}

function normalizeSourceQuality(value) {
  const quality = String(value || '').trim().toLowerCase();
  if (quality === 'real_pyq' || quality === 'manual_seed' || quality === 'synthetic') return quality;
  return 'manual_seed';
}

function slugAnchor(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeOptions(options) {
  return Array.isArray(options)
    ? options.slice(0, 4).map((option, index) => ({
        key: ['A', 'B', 'C', 'D'][index],
        text: typeof option === 'string' ? option : String(option?.text || option || ''),
      }))
    : [];
}

function inferQuestionType(questionText) {
  const text = String(questionText || '').toLowerCase();
  if (/\b(fill|choose the correct sentence|passive voice|synonym|antonym|meaning)\b/.test(text)) return 'correct_word_usage';
  if (/\d|=|\?|₹|rs\.?|%|ratio|calculate|find/.test(text)) return 'simple_numerical';
  if (/\b(which is|which of|is included|credited to|principle of)\b/.test(text)) return 'direct_concept';
  return 'statement_based';
}

function inferStructureTemplate(questionText) {
  const text = String(questionText || '').trim();
  if (/\?$/.test(text) && /\d|=|₹|rs\.?|%/.test(text)) return 'one_step_numerical_question';
  if (/^which\b/i.test(text)) return 'which_of_the_following_direct_concept';
  if (/^choose\b/i.test(text)) return 'choose_correct_usage';
  if (/fill\b/i.test(text)) return 'fill_in_blank_usage';
  return 'short_direct_mcq';
}

function inferOptionPattern(options, correctIndex) {
  const normalized = normalizeOptions(options);
  const lengths = normalized.map((option) => option.text.length);
  const numericCount = normalized.filter((option) => /[\d₹%]/.test(option.text)).length;
  return {
    count: normalized.length,
    correct_key: ['A', 'B', 'C', 'D'][correctIndex] || 'A',
    pattern: numericCount >= 3 ? 'numeric_close_distractors' : 'short_plausible_distractors',
    average_length: lengths.length > 0 ? Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length) : 0,
  };
}

function normalizeLegacyChapter(subject, chapter) {
  return LEGACY_CHAPTER_MAP[subject]?.[chapter] || chapter;
}

function getAnchorEnglishFamily(anchor) {
  return getEnglishConceptFamily([
    anchor?.concept_id,
    anchor?.chapter,
    anchor?.question_type,
    anchor?.structure_template,
    ...(anchor?.option_pattern?.pattern_tags || []),
  ].filter(Boolean).join(' '));
}

function shouldRestrictEnglishFamily(family) {
  return ['para_jumble', 'passage', 'vocabulary', 'grammar'].includes(family);
}

function anchorMatchLevelForTier(tier, primary) {
  if (!primary) return 'none';
  if (primary.synthetic) return 'synthetic';
  if (primary.structure_only) return 'structure_only';
  if (tier === 1) return 'exact_chapter';
  if (tier === 2) return 'same_unit';
  return 'subject_style_only';
}

function anchorConfidenceForTier(tier, primary) {
  if (!primary) return 'none';
  if (tier === 1 && !primary.synthetic && !primary.structure_only) return 'high';
  if (tier === 2 && !primary.synthetic && !primary.structure_only) return 'medium';
  return 'low';
}

export function extractPyqAnchor(seedQuestion) {
  const subject = toInternalSubjectId(seedQuestion.subject);
  const chapter = normalizeLegacyChapter(subject, seedQuestion.chapter);
  const concept = getSyllabusConcepts(subject, chapter)[0];
  if (!concept) return null;

  const options = normalizeOptions(seedQuestion.options);
  const correctKey = ['A', 'B', 'C', 'D'][seedQuestion.correctIndex] || 'A';
  return {
    id: `seed_pyq_${seedQuestion.id}`,
    subject,
    public_subject: toPublicSubjectId(subject),
    chapter,
    topic: concept.topic,
    concept_id: concept.concept_id,
    question_type: inferQuestionType(seedQuestion.question),
    difficulty: normalizeDifficulty(seedQuestion.difficulty),
    structure_template: inferStructureTemplate(seedQuestion.question),
    option_pattern: inferOptionPattern(seedQuestion.options, seedQuestion.correctIndex),
    question_text: seedQuestion.question,
    options,
    correct_answer: correctKey,
    explanation: seedQuestion.explanation || '',
    source: seedQuestion.source || 'PYQ',
    source_quality: normalizeSourceQuality(seedQuestion.source_quality || 'manual_seed'),
  };
}

export const PYQ_ANCHORS = Object.freeze(
  [
    ...loadStructuredPyqAnchors(),
    ...SEED_QUESTIONS.map(extractPyqAnchor).filter(Boolean),
  ]
);

export function selectPyqAnchors({ subject, concept_id: conceptId, difficulty = 'medium', question_type: questionType = null } = {}) {
  const subjectSelection = normalizeSubjectSelection({ subject });
  if (!subjectSelection.valid) return { valid: false, error: subjectSelection.error };
  if (!conceptId) return { valid: false, error: 'CONCEPT_ID_REQUIRED' };

  const concept = getMicroConceptById(subjectSelection.internalSubject, conceptId);
  if (!concept) return { valid: false, error: 'CONCEPT_NOT_IN_TAXONOMY' };

  const targetRank = DIFFICULTY_RANK[normalizeDifficulty(difficulty)];
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const requestedQuestionType = questionType || concept.allowed_question_types?.[0] || null;
  const subjectAnchors = PYQ_ANCHORS.filter((anchor) => anchor.subject === subjectSelection.internalSubject);
  const requestedEnglishFamily = subjectSelection.internalSubject === 'english'
    ? getEnglishConceptFamily([conceptId, concept.chapter, concept.concept, requestedQuestionType].filter(Boolean).join(' '))
    : null;
  const shouldFilterEnglishFamily = shouldRestrictEnglishFamily(requestedEnglishFamily);
  const familyScopedAnchors = shouldFilterEnglishFamily
    ? subjectAnchors.filter((anchor) => getAnchorEnglishFamily(anchor) === requestedEnglishFamily)
    : subjectAnchors;
  const byClosestDifficulty = (left, right) => (
    Math.abs(DIFFICULTY_RANK[left.difficulty] - targetRank) -
    Math.abs(DIFFICULTY_RANK[right.difficulty] - targetRank)
  );
  const byQuestionTypeMatch = (left, right) => {
    const leftMatch = requestedQuestionType && left.question_type === requestedQuestionType ? 0 : 1;
    const rightMatch = requestedQuestionType && right.question_type === requestedQuestionType ? 0 : 1;
    return leftMatch - rightMatch;
  };
  const bySimpleStructure = (left, right) => (
    getSimpleStructureRank(left.structure_template) - getSimpleStructureRank(right.structure_template)
  );

  if (subjectAnchors.length === 0 || familyScopedAnchors.length === 0) {
    console.warn('[pyq_anchor] no_subject_anchors_available_using_synthetic_fallback', {
      subject: subjectSelection.internalSubject,
      concept_id: conceptId,
      selected_anchor_id: `synthetic_cuet_structure_${subjectSelection.internalSubject}`,
      anchor_tier: 4,
      fallback_used: true,
      concept_mismatch_risk: 'none_no_real_anchor',
      requested_difficulty: normalizedDifficulty,
      requested_question_type: requestedQuestionType,
      requested_english_family: requestedEnglishFamily,
      english_family_match: subjectAnchors.length === 0 ? null : false,
    });
    return buildSyntheticAnchorSelection({
      subjectSelection,
      concept,
      difficulty: normalizedDifficulty,
      requestedQuestionType,
      requestedEnglishFamily,
    });
  }

  const logSelection = (tier, primary, candidates) => {
    const fallbackUsed = tier > 1;
    const conceptMismatchRisk = primary?.concept_id && primary.concept_id !== conceptId
      ? (tier >= 3 ? 'high' : 'medium')
      : 'low';
    const anchorMatchLevel = anchorMatchLevelForTier(tier, primary);
    const anchorConfidence = anchorConfidenceForTier(tier, primary);
    const selectedEnglishFamily = subjectSelection.internalSubject === 'english'
      ? getAnchorEnglishFamily(primary)
      : null;
    const englishFamilyMatch = subjectSelection.internalSubject === 'english'
      ? selectedEnglishFamily === requestedEnglishFamily || !shouldFilterEnglishFamily
      : null;
    const payload = {
      subject: subjectSelection.internalSubject,
      requested_concept_id: conceptId,
      selected_anchor_id: primary?.id || null,
      selected_anchor_concept_id: primary?.concept_id || null,
      anchor_tier: tier,
      anchor_match_level: anchorMatchLevel,
      anchor_confidence: anchorConfidence,
      fallback_used: fallbackUsed,
      concept_mismatch_risk: conceptMismatchRisk,
      candidates: candidates.length,
      requested_difficulty: normalizedDifficulty,
      selected_difficulty: primary?.difficulty || null,
      requested_question_type: requestedQuestionType,
      selected_question_type: primary?.question_type || null,
      requested_english_family: requestedEnglishFamily,
      selected_english_family: selectedEnglishFamily,
      english_family_match: englishFamilyMatch,
    };
    const logger = fallbackUsed ? console.warn : console.log;
    logger('[pyq_anchor] selected_anchor', payload);
    logger('[anchor] selected', {
      requested_subject: subjectSelection.internalSubject,
      requested_chapter: concept.chapter,
      requested_concept_id: conceptId,
      selected_anchor_id: primary?.id || null,
      selected_anchor_concept_id: primary?.concept_id || null,
      anchor_match_level: anchorMatchLevel,
      anchor_confidence: anchorConfidence,
      concept_mismatch_risk: conceptMismatchRisk,
      fallback_used: fallbackUsed,
      english_family_match: englishFamilyMatch,
    });
  };

  const tier1 = familyScopedAnchors
    .filter((anchor) => anchor.concept_id === conceptId)
    .sort(byClosestDifficulty);

  const tier2 = familyScopedAnchors
    .filter((anchor) => (
      anchor.topic === concept.topic &&
      anchor.concept_id !== conceptId &&
      (!requestedQuestionType || anchor.question_type === requestedQuestionType)
    ))
    .sort(byClosestDifficulty);

  const tier3 = [...familyScopedAnchors]
    .sort((left, right) => byClosestDifficulty(left, right) || byQuestionTypeMatch(left, right));

  const tier4 = [...familyScopedAnchors]
    .sort((left, right) => byClosestDifficulty(left, right) || bySimpleStructure(left, right));

  const tieredCandidates = [
    { tier: 1, candidates: tier1 },
    { tier: 2, candidates: tier2 },
    { tier: 3, candidates: tier3 },
    { tier: 4, candidates: tier4 },
  ].find((entry) => entry.candidates.length > 0);

  const primary = tieredCandidates.candidates[0];
  logSelection(tieredCandidates.tier, primary, tieredCandidates.candidates);

  if (tieredCandidates.tier >= 3 && primary.concept_id !== conceptId) {
    console.warn('[pyq_anchor] high_concept_mismatch_risk_mitigated_with_structure_only_anchor', {
      subject: subjectSelection.internalSubject,
      requested_concept_id: conceptId,
      source_anchor_id: primary.id,
      source_anchor_concept_id: primary.concept_id,
      anchor_tier: tieredCandidates.tier,
      requested_difficulty: normalizedDifficulty,
      selected_difficulty: primary.difficulty,
      requested_question_type: requestedQuestionType,
      selected_question_type: primary.question_type,
    });
    return buildStructureOnlyAnchorSelection({
      subjectSelection,
      concept,
      difficulty: normalizedDifficulty,
      requestedQuestionType,
      sourceAnchor: primary,
      exampleAnchors: tieredCandidates.candidates,
      tier: tieredCandidates.tier,
    });
  }

  return {
    valid: true,
    subject: subjectSelection.subject,
    internalSubject: subjectSelection.internalSubject,
    concept,
    anchor_tier: tieredCandidates.tier,
    anchor_match_level: anchorMatchLevelForTier(tieredCandidates.tier, primary),
    anchor_confidence: anchorConfidenceForTier(tieredCandidates.tier, primary),
    fallback_used: tieredCandidates.tier > 1,
    concept_mismatch_risk: primary.concept_id === conceptId ? 'low' : (tieredCandidates.tier >= 3 ? 'high' : 'medium'),
    source_quality: normalizeSourceQuality(primary.source_quality),
    primary,
    backups: tieredCandidates.candidates.slice(1, 5),
    examples: buildPyqExamples(primary, tieredCandidates.candidates, familyScopedAnchors),
    english_family_match: subjectSelection.internalSubject === 'english'
      ? getAnchorEnglishFamily(primary) === requestedEnglishFamily || !shouldFilterEnglishFamily
      : null,
  };
}

function buildPyqExamples(primary, candidates = [], subjectAnchors = []) {
  const seen = new Set();
  const examples = [];
  for (const anchor of [primary, ...candidates, ...subjectAnchors]) {
    if (!anchor?.id || seen.has(anchor.id) || !String(anchor.question_text || '').trim()) continue;
    seen.add(anchor.id);
    examples.push(compactPyqExample(anchor));
    if (examples.length >= 5) break;
  }
  return examples;
}

function compactPyqExample(anchor) {
  return {
    id: anchor.id,
    source_quality: normalizeSourceQuality(anchor.source_quality),
    question: anchor.question_text,
    options: (anchor.options || []).map((option) => option.text),
    correct_answer: anchor.correct_answer,
    pattern_tags: anchor.option_pattern?.pattern_tags || [anchor.question_type, anchor.structure_template].filter(Boolean),
    year: anchor.year || null,
    source: anchor.source || normalizeSourceQuality(anchor.source_quality),
  };
}

export function isLivePyqAnchorSourceQuality(value) {
  return LIVE_SOURCE_QUALITIES.has(normalizeSourceQuality(value));
}

function getSimpleStructureRank(structureTemplate) {
  return SIMPLE_STRUCTURE_RANK[structureTemplate] ?? 9;
}

function loadStructuredPyqAnchors() {
  if (!existsSync(STRUCTURED_PYQ_ANCHOR_ROOT)) return [];
  const anchors = [];
  for (const subjectDir of readdirSync(STRUCTURED_PYQ_ANCHOR_ROOT, { withFileTypes: true })) {
    if (!subjectDir.isDirectory()) continue;
    const subjectPath = join(STRUCTURED_PYQ_ANCHOR_ROOT, subjectDir.name);
    for (const file of readdirSync(subjectPath, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      const filePath = join(subjectPath, file.name);
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        anchors.push(...extractStructuredAnchorFile(parsed, filePath));
      } catch (error) {
        console.warn('[pyq_anchor] structured_anchor_load_failed', {
          file: filePath,
          error: error.message,
        });
      }
    }
  }
  return anchors;
}

function extractStructuredAnchorFile(file, filePath) {
  const subject = toInternalSubjectId(file.subject);
  const chapter = normalizeLegacyChapter(subject, file.chapter || parse(filePath).name);
  const sourceQuality = normalizeSourceQuality(file.source_quality);
  const concept = getSyllabusConcepts(subject, chapter)[0];
  if (!concept) {
    console.warn('[pyq_anchor] structured_anchor_unmapped_chapter', { subject, chapter, file: filePath });
    return [];
  }

  return (Array.isArray(file.questions) ? file.questions : [])
    .map((entry, index) => extractStructuredPyqAnchor({
      entry,
      subject,
      chapter,
      concept,
      sourceQuality,
      index,
      filePath,
    }))
    .filter(Boolean);
}

function extractStructuredPyqAnchor({ entry, subject, chapter, concept, sourceQuality, index, filePath }) {
  const questionText = String(entry?.question || '').trim();
  const options = normalizeOptions(entry?.options);
  const answerKey = normalizeAnswerKey(entry?.correct_answer);
  if (!questionText || options.length !== 4 || !answerKey) {
    console.warn('[pyq_anchor] structured_anchor_invalid_question', { file: filePath, index });
    return null;
  }

  const correctIndex = ['A', 'B', 'C', 'D'].indexOf(answerKey);
  const patternTags = Array.isArray(entry.pattern_tags) ? entry.pattern_tags.map(String) : [];
  return {
    id: `structured_${subject}_${slugAnchor(chapter)}_${index + 1}`,
    subject,
    public_subject: toPublicSubjectId(subject),
    chapter,
    topic: concept.topic,
    concept_id: concept.concept_id,
    question_type: inferStructuredQuestionType(questionText, patternTags),
    difficulty: normalizeDifficulty(entry.difficulty || 'medium'),
    structure_template: inferStructureTemplate(questionText),
    option_pattern: {
      ...inferOptionPattern(entry.options, correctIndex),
      pattern_tags: patternTags,
    },
    question_text: questionText,
    options,
    correct_answer: answerKey,
    explanation: entry.explanation || '',
    source: entry.source || sourceQuality,
    source_quality: sourceQuality,
    year: entry.year || null,
    verified: sourceQuality === 'real_pyq' || entry.source === 'verified',
  };
}

function normalizeAnswerKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return ['A', 'B', 'C', 'D'].includes(key) ? key : '';
}

function inferStructuredQuestionType(questionText, patternTags = []) {
  const tags = patternTags.join(' ').toLowerCase();
  const text = String(questionText || '').toLowerCase();
  if (tags.includes('para') || tags.includes('rearrangement') || /\brearrange\b|\bpara\s*jumble\b/.test(text)) return 'para_jumble';
  if (tags.includes('central idea')) return 'central_idea';
  if (tags.includes('inference')) return 'inference';
  if (tags.includes('vocabulary')) return 'vocabulary_in_context';
  if (tags.includes('tone')) return 'tone';
  if (tags.includes('author purpose')) return 'author_purpose';
  if (tags.includes('assertion') || /\bassertion\b/.test(text)) return 'assertion_reason';
  if (tags.includes('case') || /\bstudent|customer|learner|experiment|situation|scenario\b/.test(text)) return 'case_based';
  if (tags.includes('comparison') || /\bcompare|distinction|differentiate|whereas\b/.test(text)) return 'comparison_based';
  if (tags.includes('statement') || /\bstatement i\b/.test(text)) return 'statement_based';
  return 'application_based';
}

function buildStructureOnlyAnchorSelection({ subjectSelection, concept, difficulty, requestedQuestionType, sourceAnchor, exampleAnchors = [], tier }) {
  const structureAnchor = {
    id: `structure_only_${sourceAnchor.id}_for_${concept.concept_id.replace(/[^a-z0-9_:-]/gi, '_')}`,
    subject: subjectSelection.internalSubject,
    public_subject: subjectSelection.subject,
    chapter: concept.chapter,
    topic: concept.topic,
    concept_id: concept.concept_id,
    question_type: requestedQuestionType || sourceAnchor.question_type || 'one_step_application',
    difficulty: normalizeDifficulty(sourceAnchor.difficulty || difficulty),
    structure_template: sourceAnchor.structure_template || 'statement_based_trap',
    option_pattern: sourceAnchor.option_pattern || {
      count: 4,
      correct_key: 'A',
      pattern: 'correct_close_confusion_partial_truth_wrong',
      average_length: 18,
      roles: ['correct', 'close_confusion', 'partial_truth', 'clearly_wrong'],
    },
    question_text: '',
    options: [],
    correct_answer: 'A',
    explanation: '',
    source: 'STRUCTURE_ONLY_FALLBACK',
    source_anchor_id: sourceAnchor.id,
    source_quality: normalizeSourceQuality(sourceAnchor.source_quality),
    structure_only: true,
  };

  return {
    valid: true,
    subject: subjectSelection.subject,
    internalSubject: subjectSelection.internalSubject,
    concept,
    anchor_tier: tier,
    anchor_match_level: 'structure_only',
    anchor_confidence: 'low',
    fallback_used: true,
    concept_mismatch_risk: 'none_structure_only',
    source_quality: normalizeSourceQuality(sourceAnchor.source_quality),
    primary: structureAnchor,
    backups: [],
    examples: buildPyqExamples(sourceAnchor, exampleAnchors, exampleAnchors),
  };
}

function buildSyntheticAnchorSelection({ subjectSelection, concept, difficulty, requestedQuestionType }) {
  const syntheticAnchor = {
    id: `synthetic_cuet_structure_${subjectSelection.internalSubject}`,
    subject: subjectSelection.internalSubject,
    public_subject: subjectSelection.subject,
    chapter: concept.chapter,
    topic: concept.topic,
    concept_id: concept.concept_id,
    question_type: requestedQuestionType || 'one_step_application',
    difficulty,
    structure_template: 'statement_based_trap',
    option_pattern: {
      count: 4,
      correct_key: 'A',
      pattern: 'correct_close_confusion_partial_truth_wrong',
      average_length: 18,
      roles: ['correct', 'close_confusion', 'partial_truth', 'clearly_wrong'],
    },
    question_text: '',
    options: [],
    correct_answer: 'A',
    explanation: '',
    source: 'SYNTHETIC_CUET_FALLBACK',
    source_quality: 'synthetic',
    synthetic: true,
  };

  return {
    valid: true,
    subject: subjectSelection.subject,
    internalSubject: subjectSelection.internalSubject,
    concept,
    anchor_tier: 4,
    anchor_match_level: 'synthetic',
    anchor_confidence: 'low',
    fallback_used: true,
    concept_mismatch_risk: 'none_no_real_anchor',
    source_quality: 'synthetic',
    primary: syntheticAnchor,
    backups: [],
    examples: [],
  };
}

export function getPyqAnchorsForSubject(subject) {
  const selection = normalizeSubjectSelection({ subject });
  if (!selection.valid) return [];
  return PYQ_ANCHORS.filter((anchor) => anchor.subject === selection.internalSubject);
}
