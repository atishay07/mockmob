import { SEED_QUESTIONS } from './questions.js';
import {
  getMicroConceptById,
  getSyllabusConcepts,
  normalizeSubjectSelection,
  toInternalSubjectId,
  toPublicSubjectId,
} from './cuet_controls.js';

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

function normalizeDifficulty(value) {
  const difficulty = String(value || '').toLowerCase();
  return ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
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
  };
}

export const PYQ_ANCHORS = Object.freeze(
  SEED_QUESTIONS
    .map(extractPyqAnchor)
    .filter(Boolean)
);

export function selectPyqAnchors({ subject, concept_id: conceptId, difficulty = 'medium', question_type: questionType = null } = {}) {
  const subjectSelection = normalizeSubjectSelection({ subject });
  if (!subjectSelection.valid) return { valid: false, error: subjectSelection.error };
  if (!conceptId) return { valid: false, error: 'CONCEPT_ID_REQUIRED' };

  const concept = getMicroConceptById(subjectSelection.internalSubject, conceptId);
  if (!concept) return { valid: false, error: 'CONCEPT_NOT_IN_TAXONOMY' };

  const targetRank = DIFFICULTY_RANK[normalizeDifficulty(difficulty)];
  const requestedQuestionType = questionType || concept.allowed_question_types?.[0] || null;
  const subjectAnchors = PYQ_ANCHORS.filter((anchor) => anchor.subject === subjectSelection.internalSubject);
  const byClosestDifficulty = (left, right) => (
    Math.abs(DIFFICULTY_RANK[left.difficulty] - targetRank) -
    Math.abs(DIFFICULTY_RANK[right.difficulty] - targetRank)
  );
  const byExactDifficultyThenClosest = (left, right) => {
    const leftExact = left.difficulty === normalizeDifficulty(difficulty) ? 0 : 1;
    const rightExact = right.difficulty === normalizeDifficulty(difficulty) ? 0 : 1;
    return leftExact - rightExact || byClosestDifficulty(left, right);
  };

  const tier1 = subjectAnchors
    .filter((anchor) => anchor.concept_id === conceptId)
    .sort(byClosestDifficulty);

  const tier2 = subjectAnchors
    .filter((anchor) => (
      anchor.topic === concept.topic &&
      anchor.concept_id !== conceptId &&
      (!requestedQuestionType || anchor.question_type === requestedQuestionType)
    ))
    .sort(byClosestDifficulty);

  const tier3 = subjectAnchors
    .filter((anchor) => (
      (!requestedQuestionType || anchor.question_type === requestedQuestionType) &&
      anchor.difficulty === normalizeDifficulty(difficulty)
    ))
    .sort(byExactDifficultyThenClosest);

  const tieredCandidates = [
    { tier: 1, candidates: tier1 },
    { tier: 2, candidates: tier2 },
    { tier: 3, candidates: tier3 },
  ].find((entry) => entry.candidates.length > 0);

  if (!tieredCandidates) {
    return { valid: false, error: 'NO_PYQ_ANCHOR_AVAILABLE' };
  }

  return {
    valid: true,
    subject: subjectSelection.subject,
    internalSubject: subjectSelection.internalSubject,
    concept,
    anchor_tier: tieredCandidates.tier,
    primary: tieredCandidates.candidates[0],
    backups: tieredCandidates.candidates.slice(1, 3),
  };
}

export function getPyqAnchorsForSubject(subject) {
  const selection = normalizeSubjectSelection({ subject });
  if (!selection.valid) return [];
  return PYQ_ANCHORS.filter((anchor) => anchor.subject === selection.internalSubject);
}
