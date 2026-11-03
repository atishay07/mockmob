import {
  CANONICAL_SYLLABUS,
  TOP_SUBJECTS,
  getCanonicalSubject,
  getCanonicalUnitForChapter,
  isValidTopSyllabusPair,
} from './canonical_syllabus.js';

export const CUET_PUBLIC_ALLOWED_SUBJECTS = Object.freeze([
  'english',
  'general_test',
  'accountancy',
  'business_studies',
  'economics',
  'mathematics',
  'physics',
  'chemistry',
  'biology',
  'history',
  'political_science',
  'geography',
  'psychology',
  'sociology',
  'computer_science',
]);

export const SUBJECT_ALIAS_MAP = Object.freeze({
  gat: 'general_test',
  gt: 'general_test',
  general_test: 'general_test',
});

export const PUBLIC_TO_INTERNAL_SUBJECT = Object.freeze({
  general_test: 'gat',
});

export const INTERNAL_TO_PUBLIC_SUBJECT = Object.freeze({
  gat: 'general_test',
});

export const CUET_ALLOWED_SUBJECTS = Object.freeze(CUET_PUBLIC_ALLOWED_SUBJECTS.map(toInternalSubjectId));
export const CUET_ALLOWED_SUBJECT_SET = new Set(CUET_ALLOWED_SUBJECTS);
export const CUET_PUBLIC_ALLOWED_SUBJECT_SET = new Set(CUET_PUBLIC_ALLOWED_SUBJECTS);

export const CUET_DIFFICULTY_STANDARD = Object.freeze({
  easy: 'Direct, obvious answer from the CUET syllabus.',
  medium: 'One-step reasoning or direct elimination, still CUET-level.',
  hard: 'Slight conceptual twist with close options, never advanced or time-heavy.',
});

export const SUBJECT_ENFORCEMENT = Object.freeze({
  english: {
    allowedPatterns: ['reading_comprehension', 'vocabulary', 'correct_word_usage', 'para_jumble', 'match_the_following'],
    rule: 'Only CUET English patterns. RC must be direct, not analytical. Vocabulary must be common usage.',
  },
  gat: {
    allowedPatterns: ['simple_arithmetic', 'logical_reasoning', 'data_interpretation', 'general_awareness'],
    rule: 'Difficulty capped at CUET PYQ level. No multi-step or time-heavy logic.',
  },
  computer_science: {
    allowedPatterns: ['direct_concept', 'code_output', 'sql_query', 'networking_fact'],
    rule: 'Only CUET Computer Science/Informatics Practices patterns. No advanced software engineering or college algorithms.',
  },
  default: {
    allowedPatterns: ['direct_concept', 'statement_based', 'one_step_application', 'simple_numerical'],
    rule: 'Every question must map to CUET syllabus -> chapter -> topic -> concept.',
  },
});

export function normalizeSubjectSelection(input = {}) {
  const rawSubject = typeof input === 'string' ? input : input.subject;
  if (!rawSubject || !String(rawSubject).trim()) {
    return { valid: false, error: 'SUBJECT_REQUIRED' };
  }

  const normalized = String(rawSubject)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const publicSubject = SUBJECT_ALIAS_MAP[normalized] || normalized;

  if (!CUET_PUBLIC_ALLOWED_SUBJECT_SET.has(publicSubject)) {
    return { valid: false, error: 'SUBJECT_NOT_SUPPORTED', subject: publicSubject };
  }

  return {
    valid: true,
    subject: publicSubject,
    internalSubject: toInternalSubjectId(publicSubject),
  };
}

export function toInternalSubjectId(subjectId) {
  const normalized = SUBJECT_ALIAS_MAP[subjectId] || subjectId;
  return PUBLIC_TO_INTERNAL_SUBJECT[normalized] || normalized;
}

export function toPublicSubjectId(subjectId) {
  return INTERNAL_TO_PUBLIC_SUBJECT[subjectId] || subjectId;
}

const STYLE_PACKS = Object.freeze({
  english: [
    style('reading_comprehension', 'Direct fact or meaning from a short passage', 'Which statement is directly supported by the passage?', 'easy', 'Concrete, non-overlapping options'),
    style('vocabulary', 'Common synonym or meaning in usage', 'Choose the word closest in meaning to the underlined word.', 'easy', 'Common words only'),
    style('correct_word_usage', 'Pick the correct word in a sentence', 'Choose the most appropriate word to complete the sentence.', 'medium', 'Same part of speech, one clearly correct'),
  ],
  gat: [
    style('simple_arithmetic', 'One formula or one arithmetic operation', 'If the value increases by 10%, what is the new value?', 'easy', 'Numerically distinct options'),
    style('logical_reasoning', 'Single-step relation, sequence, analogy, or classification', 'Which number comes next in the series?', 'medium', 'Plausible nearby distractors'),
    style('data_interpretation', 'Read one value or perform one simple comparison', 'Based on the table, which category is highest?', 'medium', 'No long caselet'),
  ],
  default: [
    style('direct_concept', 'Direct definition or feature check', 'Which of the following best describes the given concept?', 'easy', 'One correct option, three close but wrong distractors'),
    style('statement_based', 'Identify correct or incorrect CUET-level statement', 'Which of the following statements is correct?', 'medium', 'Short statement options, no overlap'),
    style('one_step_application', 'Apply one syllabus concept to a familiar situation', 'In this situation, which principle is being applied?', 'medium', 'Simple wording, exam-oriented'),
  ],
});

function style(patternType, questionStructure, phrasingStyle, difficultyLevel, optionStyle) {
  return {
    pattern_type: patternType,
    question_structure: questionStructure,
    phrasing_style: phrasingStyle,
    difficulty_level: difficultyLevel,
    option_style: optionStyle,
  };
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titleTokens(value) {
  return String(value || '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !['and', 'the', 'for', 'with', 'from'].includes(token.toLowerCase()));
}

export function getCuetSubjectConfig(subjectId) {
  const internalSubjectId = toInternalSubjectId(subjectId);
  if (!CUET_ALLOWED_SUBJECT_SET.has(internalSubjectId)) return null;
  const subject = getCanonicalSubject(internalSubjectId);
  if (!subject) return null;
  return {
    subject_id: subject.subject_id,
    public_subject_id: toPublicSubjectId(subject.subject_id),
    subject_name: subject.subject_name,
    enforcement: SUBJECT_ENFORCEMENT[internalSubjectId] || SUBJECT_ENFORCEMENT.default,
    units: subject.units,
  };
}

export function getPyqStylePack(subjectId, limit = 3) {
  const pack = STYLE_PACKS[toInternalSubjectId(subjectId)] || STYLE_PACKS.default;
  return pack.slice(0, limit);
}

export function getSyllabusConcepts(subjectId, chapter) {
  const internalSubjectId = toInternalSubjectId(subjectId);
  if (!isValidTopSyllabusPair(internalSubjectId, chapter)) return [];
  const unit = getCanonicalUnitForChapter(internalSubjectId, chapter);
  if (!unit) return [];

  const baseConcept = {
    subject: internalSubjectId,
    public_subject: toPublicSubjectId(internalSubjectId),
    chapter,
    topic: unit.unit_name,
    subtopic: chapter,
    concept: chapter,
    concept_name: chapter,
    concept_id: `${internalSubjectId}::${slug(chapter)}`,
    description: `Atomic CUET concept for ${chapter}. Testable through one MCQ without external scope.`,
    allowed_question_types: (SUBJECT_ENFORCEMENT[internalSubjectId] || SUBJECT_ENFORCEMENT.default).allowedPatterns,
    expected_difficulty_range: ['easy', 'medium', 'hard'],
    allowed_concepts: [chapter, ...titleTokens(chapter)],
  };

  return [baseConcept];
}

export function getMicroConceptTaxonomy(subjectId, chapter = null) {
  const internalSubjectId = toInternalSubjectId(subjectId);
  const subject = getCanonicalSubject(internalSubjectId);
  if (!subject || !CUET_ALLOWED_SUBJECT_SET.has(internalSubjectId)) return null;

  const chapters = subject.units.flatMap((unit) =>
    unit.chapters
      .filter((entry) => !chapter || entry === chapter)
      .map((entry) => ({
        chapter: entry,
        topic: unit.unit_name,
        micro_concepts: getSyllabusConcepts(internalSubjectId, entry).map((concept) => ({
          concept_id: concept.concept_id,
          concept_name: concept.concept_name,
          description: concept.description,
          allowed_question_types: concept.allowed_question_types,
          expected_difficulty_range: concept.expected_difficulty_range,
        })),
      }))
  );

  return {
    subject: internalSubjectId,
    public_subject: toPublicSubjectId(internalSubjectId),
    chapters,
  };
}

export function getMicroConceptById(subjectId, conceptId) {
  const internalSubjectId = toInternalSubjectId(subjectId);
  const taxonomy = getMicroConceptTaxonomy(internalSubjectId);
  if (!taxonomy) return null;

  for (const chapter of taxonomy.chapters) {
    const match = chapter.micro_concepts.find((concept) => concept.concept_id === conceptId);
    if (match) {
      return {
        subject: taxonomy.subject,
        public_subject: taxonomy.public_subject,
        chapter: chapter.chapter,
        topic: chapter.topic,
        ...match,
      };
    }
  }
  return null;
}

export function buildConstraintObject({
  subjectId,
  chapter,
  concept,
  questionType = 'direct_concept',
  difficulty = 'medium',
}) {
  const internalSubjectId = toInternalSubjectId(subjectId);
  if (!CUET_ALLOWED_SUBJECT_SET.has(internalSubjectId)) {
    return { valid: false, reason: 'subject_not_in_top_15_allowlist' };
  }
  if (!isValidTopSyllabusPair(internalSubjectId, chapter)) {
    return { valid: false, reason: 'chapter_not_in_cuet_syllabus' };
  }

  const concepts = getSyllabusConcepts(internalSubjectId, chapter);
  const requested = String(concept || chapter || '').trim();
  const matched = concepts.find((entry) => (
    requested.length === 0 ||
    entry.concept_id === requested ||
    entry.concept.toLowerCase() === requested.toLowerCase() ||
    entry.allowed_concepts.some((allowed) => String(allowed).toLowerCase() === requested.toLowerCase())
  )) || concepts[0];

  if (!matched) return { valid: false, reason: 'concept_not_found_in_cuet_syllabus' };

  return {
    valid: true,
    subject: internalSubjectId,
    public_subject: toPublicSubjectId(internalSubjectId),
    chapter,
    topic: matched.topic,
    concept: matched.concept,
    concept_id: matched.concept_id,
    question_type: questionType,
    difficulty,
    allowed_scope: 'Strictly CUET syllabus',
    forbidden_scope: 'Anything outside CUET syllabus',
    allowed_concepts: matched.allowed_concepts,
  };
}

export function validateTraceability(question, expectedSubject, expectedChapter) {
  if (!question || typeof question !== 'object') return { valid: false, reason: 'missing_question' };

  const subject = toInternalSubjectId(String(question.subject || '').trim());
  const expectedInternalSubject = toInternalSubjectId(expectedSubject);
  const chapter = String(question.chapter || '').trim();
  if (!CUET_ALLOWED_SUBJECT_SET.has(subject)) return { valid: false, reason: 'subject_not_in_top_15_allowlist' };
  if (subject !== expectedInternalSubject) return { valid: false, reason: 'subject_mismatch' };
  if (chapter !== expectedChapter) return { valid: false, reason: 'chapter_mismatch' };
  if (!isValidTopSyllabusPair(subject, chapter)) return { valid: false, reason: 'chapter_not_in_cuet_syllabus' };

  const concepts = getSyllabusConcepts(subject, chapter);
  const conceptId = String(question.concept_id || '').trim();
  const concept = String(question.concept || question.concept_pattern || '').trim();
  const matched = concepts.find((entry) => (
    conceptId === entry.concept_id ||
    concept.toLowerCase() === entry.concept.toLowerCase() ||
    concept.toLowerCase() === slug(entry.concept)
  ));

  if (!matched) return { valid: false, reason: 'concept_not_traceable_to_cuet_syllabus' };
  return { valid: true, concept: matched };
}

export function getCuetConstraintBackbone() {
  return CANONICAL_SYLLABUS
    .filter((subject) => CUET_ALLOWED_SUBJECT_SET.has(subject.subject_id))
    .flatMap((subject) => subject.units.flatMap((unit) =>
      unit.chapters.map((chapter) => ({
        subject: subject.subject_id,
        public_subject: toPublicSubjectId(subject.subject_id),
        chapter,
        topic: unit.unit_name,
        subtopic: chapter,
        allowed_concepts: getSyllabusConcepts(subject.subject_id, chapter)[0]?.allowed_concepts || [chapter],
      }))
    ));
}
