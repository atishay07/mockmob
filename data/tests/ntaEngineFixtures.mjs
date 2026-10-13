// Synthetic question banks shaped by each NTA blueprint, for engine tests. Software-generated
// fixtures prove the engine's arithmetic and layout only, never academic quality.
import { getNtaBlueprint } from '../nta_engine.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function hash(value) {
  let h = 2166136261;
  for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// A pronounceable-enough unique word per (id, n), so stems never look alike by accident.
export function word(id, n) {
  let h = hash(`${id}:${n}`);
  let out = '';
  for (let i = 0; i < 7; i += 1) { out += LETTERS[h % 26]; h = Math.floor(h / 26) || hash(`${id}:${n}:${i}`); }
  return out;
}

function words(id, count, from = 0) {
  return Array.from({ length: count }, (_, i) => word(id, from + i));
}

const PERMUTATIONS = ['(B), (A), (D), (C)', '(A), (C), (B), (D)', '(D), (B), (A), (C)', '(C), (D), (A), (B)'];
const MAPPINGS = ['(A)-(II), (B)-(III), (C)-(IV), (D)-(I)', '(A)-(I), (B)-(II), (C)-(III), (D)-(IV)', '(A)-(IV), (B)-(I), (C)-(II), (D)-(III)', '(A)-(III), (B)-(IV), (C)-(I), (D)-(II)'];
const COMBINATIONS = ['(A) and (B) only', '(B) and (C) only', '(A), (C) and (D) only', '(B) and (D) only'];
const ASSERTION = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A)',
  'Both (A) and (R) are true but (R) is not the correct explanation of (A)',
  '(A) is true but (R) is false',
  '(A) is false but (R) is true',
];

export function stemFor(type, id) {
  const w = words(id, 8);
  switch (type) {
    case 'match_the_following':
      return { body: `Match List-I with List-II. List-I (A) ${w[0]} (B) ${w[1]} (C) ${w[2]} (D) ${w[3]} List-II (I) ${w[4]} (II) ${w[5]} (III) ${w[6]} (IV) ${w[7]}`, options: MAPPINGS };
    case 'sequence_ordering':
      return { body: `Arrange the following stages in the correct sequence: (A) ${w[0]} ${w[1]} (B) ${w[2]} ${w[3]} (C) ${w[4]} ${w[5]} (D) ${w[6]} ${w[7]}`, options: PERMUTATIONS };
    case 'sentence_rearrangement':
      return { body: `Rearrange the following parts in the correct sequence to form a meaningful sentence: (A) ${w[0]} ${w[1]} (B) ${w[2]} ${w[3]} (C) ${w[4]} ${w[5]} (D) ${w[6]} ${w[7]}`, options: PERMUTATIONS };
    case 'statement_based':
      return { body: `Consider the following statements on ${w[0]}: (A) ${w[1]} ${w[2]} (B) ${w[3]} ${w[4]} (C) ${w[5]} (D) ${w[6]} ${w[7]}. Choose the correct answer from the options given below.`, options: COMBINATIONS };
    case 'assertion_reason':
      return { body: `Assertion (A): ${w[0]} ${w[1]} ${w[2]} ${w[3]}. Reason (R): ${w[4]} ${w[5]} ${w[6]} ${w[7]}.`, options: ASSERTION };
    case 'synonym':
      return { body: `Select the word similar in meaning to the given word: ${w[0]} (${w[1]} ${w[2]})`, options: words(id, 4, 10) };
    case 'antonym':
      return { body: `Select the word opposite in meaning to the given word: ${w[0]} (${w[1]} ${w[2]})`, options: words(id, 4, 10) };
    case 'idiom_phrase':
      return { body: `Choose the meaning of the idiom "${w[0]} ${w[1]} ${w[2]}".`, options: words(id, 4, 10).map((value, i) => `${value} ${word(id, 20 + i)}`) };
    case 'one_word_substitution':
      return { body: `Choose the one word substitution for: ${w[0]} ${w[1]} ${w[2]} ${w[3]}.`, options: words(id, 4, 10) };
    case 'error_detection':
      return { body: `Identify the part that contains an error: ${w[0]} ${w[1]} ${w[2]} ${w[3]} ${w[4]}.`, options: words(id, 4, 10).map((value) => `(${value})`) };
    case 'fill_in_blank':
      return { body: `Choose the correct option to fill in the blank in the given sentence: The ${w[0]} ______ ${w[1]} ${w[2]} ${w[3]}.`, options: words(id, 4, 10) };
    default:
      return { body: `Which description of ${w[0]} ${w[1]} best explains ${w[2]} ${w[3]} within ${w[4]} ${w[5]}?`, options: words(id, 4, 10).map((value, i) => `${value} ${word(id, 30 + i)}`) };
  }
}

function difficultyCycle(bp) {
  const counts = ['easy', 'medium', 'hard'].map((key) => Math.round(bp.difficulty[key].target * 20));
  const cycle = [];
  for (let i = 0; cycle.length < 20; i += 1) for (const [index, key] of ['easy', 'medium', 'hard'].entries()) if (i < counts[index]) cycle.push(key);
  return cycle.slice(0, 20);
}

const ENGLISH_TYPES = {
  Vocabulary: ['synonym', 'antonym', 'idiom_phrase', 'one_word_substitution', 'synonym', 'antonym'],
  'Correct Word Usage': ['fill_in_blank', 'fill_in_blank', 'fill_in_blank', 'error_detection', 'fill_in_blank'],
  'Para Jumbles': ['sentence_rearrangement'],
  'Match the Following': ['match_the_following'],
};

function typeCycle(bp) {
  const cycle = [];
  for (const [type, range] of Object.entries(bp.typeQuotas)) for (let i = 0; i < range.target; i += 1) cycle.push(type);
  // Interleave so every chapter sees every type.
  return cycle.sort((a, b) => hash(`${a}:${cycle.indexOf(a)}`) % 7 - hash(`${b}:${cycle.indexOf(b)}`) % 7);
}

function passageText(id) {
  const sentences = Array.from({ length: 9 }, (_, i) => `${words(id, 9, i * 9).join(' ')}.`);
  return sentences.join(' ');
}

function baseRow(bp, id, chapter, type, difficulty, extra = {}) {
  const { body, options } = stemFor(type, id);
  return {
    id,
    subject: bp.internalSubject,
    chapter,
    body,
    question: body,
    options: options.map((text, i) => ({ key: 'ABCD'[i], text })),
    correct_answer: 'A',
    correct_index: 0,
    explanation: `The first choice follows from ${word(id, 40)} ${word(id, 41)}.`,
    difficulty,
    status: 'live',
    is_deleted: false,
    verification_state: 'verified',
    quality_score: 0.85,
    family_id: `fam-${id}`,
    question_type: null,
    score: 0,
    order_index: 0,
    ...extra,
  };
}

/**
 * A bank for one subject: `copies` times each chapter's maximum, every blueprint type spread across
 * chapters, and complete passage sets where the blueprint uses them.
 * options: { copies, sets (number of complete sets), setSize, omitTypes:[], scoreFor(row) }
 */
export function makeBank(subject, options = {}) {
  const bp = getNtaBlueprint(subject);
  const copies = options.copies ?? 3;
  const omit = new Set(options.omitTypes || []);
  const rows = [];
  const difficulties = difficultyCycle(bp);
  const types = typeCycle(bp).filter((type) => !omit.has(type));
  const chapters = new Map();
  for (const variant of bp.variants) {
    for (const section of variant.sections) {
      for (const unit of section.units) {
        for (const chapter of unit.chapters) {
          if (chapter.max === 0) continue;
          chapters.set(chapter.name, Math.max(chapters.get(chapter.name) || 0, chapter.max));
        }
      }
    }
  }
  const english = bp.subject === 'english';
  const passageChapters = english ? new Set(['Factual Passage', 'Narrative Passage', 'Literary Passage']) : new Set();
  let chapterIndex = 0;
  for (const [chapter, max] of chapters) {
    chapterIndex += 1;
    if (passageChapters.has(chapter)) continue;
    const n = max * copies + 2;
    for (let i = 0; i < n; i += 1) {
      const id = `${bp.subject}-${chapterIndex}-${i}`;
      const type = english ? ENGLISH_TYPES[chapter][i % ENGLISH_TYPES[chapter].length] : types[(i + chapterIndex * 7) % types.length];
      if (omit.has(type)) continue;
      rows.push(baseRow(bp, id, chapter, type, difficulties[(i + chapterIndex) % difficulties.length]));
    }
  }

  const setCount = options.sets ?? (bp.sets.count.target > 0 ? Math.max(bp.sets.count.target * copies, 2) : 0);
  const setSize = options.setSize ?? bp.sets.size.target;
  const setChapters = english ? ['Factual Passage', 'Narrative Passage', 'Literary Passage'] : [...chapters.keys()];
  for (let s = 0; s < setCount; s += 1) {
    const chapter = setChapters[s % setChapters.length];
    const group = `${bp.subject}-set-${s}`;
    const text = passageText(group);
    for (let i = 0; i < setSize; i += 1) {
      const id = `${group}-q${i}`;
      const w = words(id, 4);
      rows.push({
        ...baseRow(bp, id, chapter, 'single_mcq', difficulties[(s + i) % difficulties.length]),
        body: `Based on the passage, what does ${w[0]} ${w[1]} suggest about ${w[2]} ${w[3]}?`,
        question: `Based on the passage, what does ${w[0]} ${w[1]} suggest about ${w[2]} ${w[3]}?`,
        passage_group_id: group,
        passage_id: group,
        passage_text: text,
        order_index: i + 1,
      });
    }
  }
  if (typeof options.scoreFor === 'function') for (const row of rows) row.quality_score = options.scoreFor(row);
  return rows;
}
