// Item-level checks for NTA mode (data/nta_engine.js): what makes one question unfit for a paper that
// must read like a CUET expert's handmade mock, and when two questions are the same question for the
// student. Deterministic and offline: no model, no network. The NTA review of 13 Oct 2026
// (docs/brain/NTA-ENGINE-RUN.md, "Review fixes") lists the defects each check answers.
import { getQuestionText, normalizeOptions, getPassageText } from './nta_question_selector.js';
import { plainOptionTexts } from './option_text.js';
import { ntaAgentScoreEntry } from './nta_agent_scores.js';
import quarantineFile from './nta_quarantine.json' with { type: 'json' };
import objectivesFile from './nta_objectives.json' with { type: 'json' };
import keyDisputesFile from './nta_key_disputes.json' with { type: 'json' };
import difficultyFile from './nta_difficulty.json' with { type: 'json' };

// Two questions whose stem + options + key text overlap this much are the same question.
export const NEAR_DUPLICATE_TEXT_JACCARD = 0.5;
// Stems alone at this overlap are the same question even when options differ.
export const NEAR_DUPLICATE_STEM_JACCARD = 0.8;
// Two questions of one chapter whose stored concept names overlap this much test one concept.
export const SAME_CONCEPT_JACCARD = 0.5;
// Inside one passage set, two children whose correct answers say the same thing ask the same thing.
export const SAME_ANSWER_JACCARD = 0.5;
// Stems whose character 5-grams overlap this much (boilerplate removed; each 5-gram weighted by how
// rare it is in the pool, so a shared template such as "Select the word similar in meaning to" counts
// for little) are the same question in other words, whatever their tags say (review of 13 Oct 2026).
export const NEAR_DUPLICATE_STEM_CHARS = 0.45;
// A concept phrase from the judges' tags is a key concept only while at most this share of the
// subject's judged questions carries it; broader phrases ("percentage change") name a topic. Single
// words are not used: even rare ones ("goodwill", "intensity") span several concepts, and with them
// most subjects could no longer fill a paper (offline check on the 13 Oct export).
export const CONCEPT_KEY_MAX_SHARE = 0.05;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'which', 'what', 'when', 'where', 'does', 'into',
  'only', 'following', 'correct', 'option', 'options', 'choose', 'select', 'given', 'below', 'answer',
  'are', 'was', 'were', 'has', 'have', 'its', 'not', 'one', 'list', 'statement', 'statements', 'their',
  'there', 'these', 'those', 'than', 'then', 'them', 'they', 'his', 'her', 'she', 'him', 'any', 'all',
  'each', 'other', 'such', 'will', 'would', 'should', 'can', 'could', 'may', 'been', 'being', 'but',
]);
// Roman and letter labels are layout, not content.
const LABEL_TOKEN = /^(?:i{1,3}|iv|vi{0,3}|ix|x|[a-e])$/;
// Concept-name words that say nothing about which concept is tested.
const CONCEPT_FILLER = new Set([
  'accountancy', 'economics', 'business', 'studies', 'bst', 'english', 'company', 'accounts', 'concept',
  'definition', 'meaning', 'objective', 'application', 'applied', 'basic', 'identification', 'identify',
  'example', 'case', 'item', 'question', 'mcq', 'calc', 'calculation', 'numerical', 'sequence', 'order',
  'ordering', 'match', 'matching', 'statement', 'statements', 'selection', 'conceptual', 'scenario',
  'nature', 'features', 'feature', 'type', 'types', 'rule', 'rules', 'and', 'the', 'of', 'in', 'to', 'for',
]);

function text(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

export function contentTokens(value) {
  return new Set(text(value).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token) && !LABEL_TOKEN.test(token)));
}

export function jaccard(left, right) {
  if (!left?.size || !right?.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

/** jaccard(left, right) >= threshold, stopping as soon as the answer is known. */
export function jaccardAtLeast(left, right, threshold) {
  if (!left?.size || !right?.size) return false;
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  if (small.size / large.size < threshold) return false;
  // overlap / (|small| + |large| - overlap) >= t  <=>  overlap >= t (|small| + |large|) / (1 + t)
  const needed = Math.ceil((threshold * (small.size + large.size)) / (1 + threshold) - 1e-9);
  let overlap = 0;
  let remaining = small.size;
  for (const token of small) {
    if (large.has(token)) overlap += 1;
    remaining -= 1;
    if (overlap >= needed) return true;
    if (overlap + remaining < needed) return false;
  }
  return overlap >= needed;
}

function overlapCount(left, right) {
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap;
}

// ---------------------------------------------------------------------------------------------
// Labels: (A)-(D) statements or items in the stem, and what the options do with them
// ---------------------------------------------------------------------------------------------

const ROMAN = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'i', 'ii', 'iii', 'iv', 'v', 'vi']);
// Item labels: (A)-(F), (P)-(T), 1-6, and upper or lower case roman numerals.
const LABEL = String.raw`(?:[A-F]|[P-T]|[1-6]|VI|IV|V|I{1,3}|vi|iv|v|i{1,3})`;

/** Labels used as list markers in the stem: "(A)", "(II)", "A." or "II." at a word boundary. */
export function stemLabels(stem) {
  const value = text(stem);
  const letters = new Set();
  const romans = new Set();
  for (const match of value.matchAll(new RegExp(String.raw`\((${LABEL})\)`, 'g'))) {
    const label = match[1];
    (ROMAN.has(label) ? romans : letters).add(label);
  }
  for (const match of value.matchAll(new RegExp(String.raw`(?:^|[\s:;])(${LABEL})\.\s`, 'g'))) {
    const label = match[1];
    (ROMAN.has(label) ? romans : letters).add(label);
  }
  return { letters, romans, all: new Set([...letters, ...romans]) };
}

/** The labels an option lists, in order, if the option is nothing but labels; otherwise null. */
export function optionLabelList(optionText) {
  const value = text(optionText);
  if (!value) return null;
  const rest = value
    .replace(new RegExp(String.raw`\(?\b(${LABEL})\b\)?`, 'g'), ' ')
    .replace(/\b(only|both|and|all|of|neither|nor|statements?|the|above|items?)\b/gi, ' ')
    .replace(/[\s,;&→>\-–—]+/g, '');
  if (rest.length) return null;
  const labels = [...value.matchAll(new RegExp(String.raw`\(?\b(${LABEL})\b\)?`, 'g'))].map((match) => match[1]);
  return labels.length ? labels : null;
}

/** "(A)-(II)" style pairs in a match option; null when the option is not a set of pairs. */
export function optionPairs(optionText) {
  const value = text(optionText);
  const pairs = [...value.matchAll(/\(?\b([A-F])\b\)?\s*[-–:→]\s*\(?\b(VI|IV|V|I{1,3}|[1-6]|[P-T])\b\)?/g)].map((match) => [match[1], match[2]]);
  if (pairs.length < 2) return null;
  const rest = value.replace(/\(?\b([A-F])\b\)?\s*[-–:→]\s*\(?\b(VI|IV|V|I{1,3}|[1-6]|[P-T])\b\)?/g, '').replace(/[\s,;]+/g, '');
  return rest.length ? null : pairs;
}

// The last heading that is followed by its first entry ("List-II (I) ..."); intro sentences such as
// "Match List-I with List-II" mention the headings too.
function lastHeading(value, pattern, before = value.length) {
  let found = -1;
  let fallback = -1;
  for (const match of value.matchAll(pattern)) {
    if (match.index >= before) break;
    fallback = match.index;
    if (/^\s*[:\-–]?\s*\(/.test(value.slice(match.index + match[0].length, match.index + match[0].length + 6))) found = match.index;
  }
  return found >= 0 ? found : fallback;
}

function listSegments(stem) {
  const value = text(stem);
  const listTwo = lastHeading(value, /list\s*[-–]?\s*(?:ii|2)\b/gi);
  if (listTwo < 0) return null;
  const listOne = lastHeading(value, /list\s*[-–]?\s*(?:i|1)\b(?!i)/gi, listTwo);
  const end = value.slice(listTwo).search(/choose the correct|select the correct|which of the following/i);
  return {
    left: value.slice(listOne >= 0 && listOne < listTwo ? listOne : 0, listTwo),
    right: end > 0 ? value.slice(listTwo, listTwo + end) : value.slice(listTwo),
  };
}

function markersIn(segment) {
  return new Set([...String(segment).matchAll(/\(\s*(VI|IV|V|I{1,3}|[A-F]|[1-6]|[P-U])\s*\)/g)].map((match) => match[1]));
}

/** True when the item has labelled statements and at least three options combine those labels. */
export function isStatementItem(stem, options) {
  const labels = stemLabels(stem).all;
  if (labels.size < 3) return false;
  const combos = options.filter((option) => {
    const list = optionLabelList(option.text);
    return list && list.every((label) => labels.has(label)) && new Set(list).size === list.length
      && (list.length < labels.size || /\b(only|all)\b/i.test(option.text));
  });
  return combos.length >= 3;
}

/** True when at least three options are orderings of the same labels (a sequence item). */
export function isPermutationOptions(options) {
  const lists = options.map((option) => optionLabelList(option.text)).filter(Boolean);
  if (lists.length < 3) return false;
  const key = (list) => [...list].sort().join(',');
  return lists.every((list) => list.length >= 3 && new Set(list).size === list.length && key(list) === key(lists[0]));
}

// ---------------------------------------------------------------------------------------------
// Structural gate: the item's options must fit the item's own stem
// ---------------------------------------------------------------------------------------------

function optionsRepeatedInStem(stem, options) {
  const value = text(stem).toLowerCase();
  let repeated = 0;
  options.forEach((option, index) => {
    const optionText = text(option.text).toLowerCase().replace(/[.\s]+$/, '');
    if (optionText.length < 2) return;
    const letter = 'abcd'[index];
    if (value.includes(`(${letter}) ${optionText}`) || value.includes(`${letter}. ${optionText}`)) repeated += 1;
  });
  return repeated >= 3;
}

/**
 * Reasons an item's layout is broken, given the type the engine assigned it.
 * - sequence: every option must order the same labels, and those labels must be the stem's;
 * - match: every option must pair List-I labels with List-II labels that the stem shows;
 * - statements: option labels must be statements the stem shows;
 * - no item may print its options a second time inside the stem.
 */
export function structuralReasons(row, type) {
  const stem = getQuestionText(row);
  const options = normalizeOptions(row?.options, row);
  const reasons = [];
  if (optionsRepeatedInStem(stem, options)) reasons.push('options_repeated_in_stem');
  const labels = stemLabels(stem).all;
  if (type === 'sequence_ordering' || type === 'sentence_rearrangement') {
    const lists = options.map((option) => optionLabelList(option.text));
    const valid = lists.every((list) => list && list.length >= 3 && new Set(list).size === list.length && list.every((label) => labels.has(label)))
      && isPermutationOptions(options);
    if (!valid) reasons.push('sequence_options_not_orderings_of_stem_items');
  }
  if (type === 'match_the_following') {
    const segments = listSegments(stem);
    const pairs = options.map((option) => optionPairs(option.text));
    if (!segments) reasons.push('match_list_two_missing');
    else if (pairs.some((entry) => !entry)) reasons.push('match_options_not_pairings');
    else {
      const left = markersIn(segments.left);
      const right = markersIn(segments.right);
      const fits = pairs.every((entry) => entry.every(([a, b]) => left.has(a) && right.has(b))
        && new Set(entry.map(([a]) => a)).size === entry.length && new Set(entry.map(([, b]) => b)).size === entry.length);
      if (!fits) reasons.push('match_options_use_labels_not_in_stem');
    }
  }
  if (type === 'statement_based') {
    const lists = options.map((option) => optionLabelList(option.text)).filter(Boolean);
    if (lists.some((list) => list.some((label) => !labels.has(label)))) reasons.push('statement_options_use_labels_not_in_stem');
  }
  return reasons;
}

// ---------------------------------------------------------------------------------------------
// Wording gate: stems that do not read like an NTA paper or hand the student the answer
// ---------------------------------------------------------------------------------------------

const STEM_GIVEAWAYS = [
  // Factory hedges and rule statements: "For this question, define ...", "the stated condition".
  [/\bfor (?:this|the purpose of this) (?:question|calculation|estimate|item|exercise)\b/i, 'stem_states_rule_for_this_question'],
  [/\bin this item\b/i, 'stem_states_rule_for_this_question'],
  [/\bthe stated (?:condition|principle|mechanism|rule|objective)s?\b/i, 'stem_cites_unstated_condition'],
  [/\bthe excerpt\b|\bthe case stipulates\b|\b(?:is|are) stipulated\b/i, 'stem_cites_source_text'],
  [/\b(?:terms|definitions?) (?:defined|given|supplied) here\b|\bas defined here\b|\bin the supplied sense\b|\bused to mean\b/i, 'stem_defines_what_is_tested'],
  [/\bsole (?:stated )?(?:reason|explanation)\b|\bis the complete reason\b/i, 'stem_hedges_options'],
  // "The people named in options B-D are not ..." tells the student which option is right.
  [/\boptions?\s+\(?[A-D]\)?\s*(?:[-–—]|to)\s*\(?[A-D]\)?\b/i, 'stem_refers_to_options'],
  [/\border (?:described|narrated|reported) (?:in|by|above)\b/i, 'sequence_order_given_in_stem'],
  [/\buse this rule\b|\bapply (?:this|the following) rule\b/i, 'stem_states_rule_for_this_question'],
];
const ORDER_CUES = /\b(first(?:ly)?|then|later|next|finally|afterwards|subsequently|thereafter|after that|at a later stage|before that)\b/gi;
const EXPLANATION_META = /\bthe excerpt\b|\bthe source (?:text|passage|material)\b|\bthe stated (?:principle|condition|mechanism|rule)s?\b|\b(?:is|are) stipulated\b|\bthe stem (?:states|says|specifies)\b/i;

function sequencePreamble(stem) {
  const value = text(stem);
  const first = value.search(/\(\s*(?:A|I)\s*\)/);
  return first > 0 ? value.slice(0, first) : '';
}

/** Reasons the stem or explanation is unfit for an NTA paper. */
export function wordingReasons(row, type) {
  const stem = getQuestionText(row);
  const reasons = [];
  for (const [pattern, reason] of STEM_GIVEAWAYS) if (pattern.test(stem)) reasons.push(reason);
  if (type === 'sequence_ordering') {
    // A preamble that already tells the story in order gives the sequence away.
    const cues = sequencePreamble(stem).match(ORDER_CUES) || [];
    if (cues.length >= 2) reasons.push('sequence_order_narrated_in_stem');
    // Ordering a book's modules or a presentation is not a syllabus question.
    if (/\bmodules?\b|\bpresentation\b|\btextbook\b/i.test(stem)) reasons.push('sequence_of_study_material');
  }
  if (EXPLANATION_META.test(text(row?.explanation))) reasons.push('explanation_cites_item_not_concept');
  return [...new Set(reasons)];
}

// ---------------------------------------------------------------------------------------------
// Numerical items
// ---------------------------------------------------------------------------------------------

/** A numerical item: the stem carries figures and at least three options are figures. */
export function isNumericalItem(row) {
  const stem = getQuestionText(row);
  if (!/\d/.test(stem)) return false;
  const options = normalizeOptions(row?.options, row);
  return options.filter((option) => /\d/.test(text(option.text)) && !optionPairs(option.text)).length >= 3;
}

// ---------------------------------------------------------------------------------------------
// Quarantine and learning objectives
// ---------------------------------------------------------------------------------------------

const QUARANTINE = new Map(Object.entries(quarantineFile.questions || {}));

/** NTA-only quarantine (data/nta_quarantine.json). Reversible: delete the entry to lift it. */
export function ntaQuarantine(id) {
  return QUARANTINE.get(String(id)) || null;
}

const KEY_DISPUTES = new Map(Object.entries(keyDisputesFile.questions || {}));

/**
 * Questions where an agent judge's blind answer differed from the stored key (data/nta_key_disputes.json,
 * written by scripts/nta-pass-merge.mjs). Kept out of NTA mode whatever their score source until a
 * reviewer settles the key and removes the entry.
 */
export function ntaKeyDispute(id) {
  return KEY_DISPUTES.get(String(id)) || null;
}

const DIFFICULTY = new Map(Object.entries(difficultyFile.questions || {}));
const DIFFICULTY_LEVELS = new Set(['easy', 'medium', 'hard']);
const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 };

/**
 * The question's difficulty for NTA mode. Policy (owner review, 13 Oct 2026): the stored label stands.
 * The agent judges were told "when unsure between two levels, choose the lower", so their one-level
 * disagreements pushed 612 hard questions to medium and left almost nothing hard. A correction from
 * data/nta_difficulty.json applies only when both judges agreed on one level AND that level is two
 * levels from the stored label (easy labelled hard, or the reverse), and only while the stored label
 * is still the one it corrected, so a later edit in the database wins. options.corrections replaces
 * the committed file ({ [id]: { from, to } }, tests).
 */
export function ntaDifficultyOf(row, { corrections } = {}) {
  const stored = text(row?.difficulty).toLowerCase();
  const id = String(row?.id);
  const correction = corrections ? (Object.hasOwn(corrections, id) ? corrections[id] : undefined) : DIFFICULTY.get(id);
  if (correction && DIFFICULTY_LEVELS.has(correction.to) && DIFFICULTY_LEVELS.has(stored)
    && text(correction.from).toLowerCase() === stored
    && Math.abs(DIFFICULTY_RANK[correction.to] - DIFFICULTY_RANK[stored]) === 2) return correction.to;
  return DIFFICULTY_LEVELS.has(stored) ? stored : 'medium';
}

// Hand-assigned tags (questions) win over the agent pass's tags (agent_questions, scripts/nta-pass-merge.mjs).
const OBJECTIVES = new Map([...Object.entries(objectivesFile.agent_questions || {}), ...Object.entries(objectivesFile.questions || {})]);
const OBJECTIVE_CAPS = objectivesFile.caps || {};

/** Learning-objective tag for a question: the index row's tag, else data/nta_objectives.json (hand tags, then agent tags). */
export function objectiveTagOf(row) {
  return text(row?.nta_objective || row?.nta_index?.objective_tag) || OBJECTIVES.get(String(row?.id)) || null;
}

/** Questions per paper allowed for one tag: 1, or the tag's own cap (broad tags allow 2). */
export function objectiveCap(tag) {
  const cap = Number(OBJECTIVE_CAPS[tag]);
  return Number.isInteger(cap) && cap > 0 ? cap : 1;
}

// ---------------------------------------------------------------------------------------------
// Same-question features and conflicts
// ---------------------------------------------------------------------------------------------

function significantNumbers(value) {
  return new Set((text(value).replace(/(\d),(?=\d)/g, '$1').match(/\d+(?:\.\d+)?/g) || [])
    .filter((number) => Number(number) >= 2 && !/^(?:19|20)\d\d$/.test(number)));
}

const NOT_HEADWORDS = new Set(['because', 'solely', 'only', 'not', 'and', 'but', 'if', 'when', 'although', 'though', 'since']);

function quotedWords(value) {
  return [...text(value).matchAll(/[“"‘]([A-Za-z][A-Za-z\s-]{1,30}?)[”"’]/g)].map((match) => match[1].trim().toLowerCase())
    .filter((word) => word.split(/\s+/).length <= 3 && !NOT_HEADWORDS.has(word));
}

function shortEntries(segment) {
  return String(segment || '').split(/\(\s*(?:VI|IV|V|I{1,3}|[A-F]|[1-6])\s*\)/).slice(1)
    .map((entry) => entry.replace(/[.,;:]+\s*$/, '').trim().toLowerCase())
    .filter((entry) => entry && entry.split(/\s+/).length <= 2);
}

/**
 * English vocabulary headwords an item tests or reveals: quoted target words, a one- or two-word
 * key, and the short entries of a match list. Two items that share one give each other away.
 */
export function headwordsOf(row) {
  const stem = getQuestionText(row);
  const options = normalizeOptions(row?.options, row);
  const words = new Set(quotedWords(stem));
  const keyIndex = Number.isInteger(row?.correct_index) ? row.correct_index : 'ABCD'.indexOf(text(row?.correct_answer).toUpperCase());
  const keyText = text(options[keyIndex]?.text).replace(/[.]$/, '');
  if (keyText && keyText.split(/\s+/).length <= 2 && !optionLabelList(keyText) && !optionPairs(keyText)) words.add(keyText.toLowerCase());
  const segments = listSegments(stem);
  if (segments) for (const entry of [...shortEntries(segments.left), ...shortEntries(segments.right)]) words.add(entry.replace(/[“”"'‘’]/g, ''));
  return new Set([...words].map((word) => word.replace(/[^a-z\s-]/g, '').trim()).filter((word) => word.length > 2));
}

function conceptTokens(row) {
  const chapter = contentTokens(row?.chapter);
  const raw = text(row?.concept_id || row?.concept).replace(/[._/]+/g, ' ');
  return new Set([...contentTokens(raw)].filter((token) => !chapter.has(token) && !CONCEPT_FILLER.has(token)));
}

/**
 * Everything the conflict test needs, computed once per question. agentScores replaces the committed
 * agent tables (tests); the judges' tags give the concept keys.
 */
export function itemFeatures(row, { english = false, agentScores, gramWeights = null } = {}) {
  const stem = getQuestionText(row);
  const options = normalizeOptions(row?.options, row);
  const keyIndex = Number.isInteger(row?.correct_index) ? row.correct_index : 'ABCD'.indexOf(text(row?.correct_answer).toUpperCase());
  const keyText = text(options[keyIndex]?.text);
  const keyIsLabels = Boolean(optionLabelList(keyText) || optionPairs(keyText));
  return {
    chapter: text(row?.chapter),
    stemKey: stem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    stemTokens: contentTokens(stem),
    // English vocabulary stems are templates around one headword; the headword rule covers them.
    stemChars: english ? new Set() : stemCharGrams(stem),
    gramWeights,
    textTokens: contentTokens(`${stem} ${options.map((option) => option.text).join(' ')}`),
    stemKeyTokens: contentTokens(`${stem} ${keyIsLabels ? '' : keyText}`),
    keyTokens: keyIsLabels ? new Set() : contentTokens(keyText),
    keyAnswer: keyIsLabels ? null : shortKeyAnswer(plainOptionTexts(options.map((option) => option.text))[keyIndex]),
    numbers: significantNumbers(stem),
    concept: conceptTokens(row),
    conceptKeys: conceptKeysOf(row, { agentScores }),
    headwords: english ? headwordsOf(row) : new Set(),
    objective: objectiveTagOf(row),
  };
}

function sharesAny(left, right) {
  if (!left?.size || !right?.size) return false;
  for (const value of left) if (right.has(value)) return true;
  return false;
}

/**
 * Why two questions cannot sit in one paper, or null. sameSet: both are children of one passage.
 * Tags are capped separately (objectiveCap), not here. The concept guards do not need two questions
 * to carry the same tag: near-identical stem wording (characters), the same short answer, or a shared
 * key concept phrase from either judge's tag is enough (review of 13 Oct 2026: percentage points four
 * times, Lenz's law three times, the meaning of directing four times in one paper).
 */
export function conflictReason(a, b, { sameSet = false } = {}) {
  if (a.stemKey && a.stemKey === b.stemKey) return 'same_stem';
  if (jaccardAtLeast(a.stemTokens, b.stemTokens, NEAR_DUPLICATE_STEM_JACCARD)) return 'near_duplicate_stem';
  if (jaccardAtLeast(a.textTokens, b.textTokens, NEAR_DUPLICATE_TEXT_JACCARD)) return 'near_duplicate_text';
  if (jaccardAtLeast(a.stemKeyTokens, b.stemKeyTokens, NEAR_DUPLICATE_TEXT_JACCARD)) return 'near_duplicate_text';
  if (!sameSet && stemWordingAlike(a, b)) return 'near_duplicate_stem_chars';
  if (sameSet && a.keyTokens.size >= 3 && b.keyTokens.size >= 3 && jaccard(a.keyTokens, b.keyTokens) >= SAME_ANSWER_JACCARD) return 'same_answer_in_set';
  if (!sameSet && a.keyAnswer && a.keyAnswer === b.keyAnswer) return 'same_key_answer';
  if (!sameSet && sharesAny(a.conceptKeys, b.conceptKeys)) return 'same_concept_words';
  if (a.chapter && a.chapter === b.chapter) {
    if (a.concept.size >= 2 && b.concept.size >= 2 && overlapCount(a.concept, b.concept) >= 2
      && jaccard(a.concept, b.concept) >= SAME_CONCEPT_JACCARD) return 'same_concept';
    const shared = overlapCount(a.numbers, b.numbers);
    const smaller = Math.min(a.numbers.size, b.numbers.size);
    if (shared >= 2 && shared >= 0.6 * smaller && jaccard(a.stemTokens, b.stemTokens) >= 0.2) return 'same_figures';
  }
  if (a.headwords.size && b.headwords.size) for (const word of a.headwords) if (b.headwords.has(word)) return 'same_headword';
  return null;
}

/** Words in a passage, for the blueprint's passage-length rule. */
export function passageWordCount(row) {
  const value = text(getPassageText(row));
  return value ? value.split(' ').length : 0;
}

// ---------------------------------------------------------------------------------------------
// Concept guards that do not need matching tags (review of 13 Oct 2026, finding 6)
// ---------------------------------------------------------------------------------------------

// Instructions every paper repeats; they say nothing about what is tested.
const STEM_BOILERPLATE = [
  /\b(?:which|what) (?:one )?of the following\b/g, /\bconsider the following(?: statements?)?\b/g, /\bread the (?:following )?statements?\b/g,
  /\bchoose the (?:most )?(?:correct|appropriate) (?:answer|option)s?(?: from the options given below)?\b/g, /\bselect the correct (?:answer|option)s?\b/g,
  /\bfrom the options given below\b/g, /\bmatch list ?i with list ?ii\b/g, /\blist ?(?:i{1,2}|1|2)\b/g, /\bstatements? (?:i{1,3}|iv|[1-4])\b/g,
  /\bassertion(?: a)?\b/g, /\breason(?: r)?\b/g, /\bbased on the passage\b/g, /\baccording to the passage\b/g,
  /\bis (?:correct|true|incorrect|false)\b/g, /\bbest (?:describes|explains|reflects)\b/g, /\bthe correct (?:option|answer)\b/g,
];

/**
 * Weights for character 5-grams over a pool of rows: log((n + 1) / (df + 1)), so a 5-gram that most
 * stems share weighs almost nothing. One map serves every question of the pool.
 */
export function stemGramWeights(rows) {
  const df = new Map();
  let n = 0;
  for (const row of rows || []) {
    const grams = stemCharGrams(getQuestionText(row));
    if (!grams.size) continue;
    n += 1;
    for (const gram of grams) df.set(gram, (df.get(gram) || 0) + 1);
  }
  const weights = new Map();
  for (const [gram, count] of df) weights.set(gram, Math.log((n + 1) / (count + 1)));
  return weights;
}

const gramTotals = new WeakMap();

function gramTotal(features) {
  if (!gramTotals.has(features.stemChars)) {
    let total = 0;
    for (const gram of features.stemChars) total += features.gramWeights.get(gram) ?? 1;
    gramTotals.set(features.stemChars, total);
  }
  return gramTotals.get(features.stemChars);
}

/** Near-identical stem wording: weighted 5-gram Jaccard when both share one pool's weights, plain otherwise. */
export function stemWordingAlike(a, b) {
  if (!a.stemChars?.size || !b.stemChars?.size) return false;
  if (!a.gramWeights || a.gramWeights !== b.gramWeights) return jaccardAtLeast(a.stemChars, b.stemChars, NEAR_DUPLICATE_STEM_CHARS);
  const totalA = gramTotal(a);
  const totalB = gramTotal(b);
  if (!totalA || !totalB || Math.min(totalA, totalB) / Math.max(totalA, totalB) < NEAR_DUPLICATE_STEM_CHARS) return false;
  const [small, large] = a.stemChars.size <= b.stemChars.size ? [a.stemChars, b.stemChars] : [b.stemChars, a.stemChars];
  let shared = 0;
  for (const gram of small) if (large.has(gram)) shared += a.gramWeights.get(gram) ?? 1;
  return shared / (totalA + totalB - shared) >= NEAR_DUPLICATE_STEM_CHARS;
}

/**
 * Character 5-grams of the stem without instructions and labels; empty for stems under 60 characters,
 * where a short template ("Choose the sentence in which X is used correctly") outweighs the content.
 */
export function stemCharGrams(stem) {
  let value = text(stem).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  for (const pattern of STEM_BOILERPLATE) value = value.replace(pattern, ' ');
  value = value.replace(/\b(?:[a-f]|i{1,3}|iv|vi?)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const grams = new Set();
  if (value.length < 60) return grams;
  for (let i = 0; i + 5 <= value.length; i += 1) grams.add(value.slice(i, i + 5));
  return grams;
}

// Correct answers that every item of a kind shares, so they say nothing about the concept.
const GENERIC_ANSWER = /\b(?:above|below|these|those|assertion|reason|statements?|true|false|correct|incorrect|neither|none|both|all|only)\b|\(\s*[a-dr]\s*\)/i;

/**
 * The correct answer as a short phrase ("Directing", "Lenz's law"), or null when it is long, a figure,
 * a label combination or generic wording. Two questions with the same short answer test one thing.
 */
export function shortKeyAnswer(keyText) {
  const value = text(keyText).toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!value || value.length < 4 || /\d/.test(value) || GENERIC_ANSWER.test(value)) return null;
  return value.split(' ').length <= 5 ? value : null;
}

const SLUG_STOP = new Set(['of', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from', 'vs', 'versus', 'is', 'are', 'as', 'its', 'into', 'between', 'via', 'per']);
const SLUG_SYNONYMS = { definition: 'meaning', define: 'meaning', defined: 'meaning', meant: 'meaning', defining: 'meaning' };

function slugWord(word) {
  let value = word.toLowerCase();
  if (SLUG_SYNONYMS[value]) return SLUG_SYNONYMS[value];
  if (value.length > 4 && value.endsWith('s') && !value.endsWith('ss')) value = value.slice(0, -1);
  return value;
}

/** Order-free word pairs of a tag's concept part ("physics.emi.lenz-law-opposes-flux" gives "law lenz", ...). */
export function conceptPhrases(tag) {
  const parts = text(tag).split('.');
  if (parts.length < 3) return [];
  const words = parts.slice(2).join('-').split(/[-_]+/).map(slugWord).filter((word) => word && !SLUG_STOP.has(word));
  const phrases = [];
  for (let i = 0; i + 1 < words.length; i += 1) if (words[i] !== words[i + 1]) phrases.push([words[i], words[i + 1]].sort().join(' '));
  return [...new Set(phrases)];
}

const phraseCounts = new WeakMap();

// How many of a subject's judged questions carry each concept phrase (either judge), once per table.
function tablePhraseCounts(table) {
  if (!phraseCounts.has(table)) {
    const counts = new Map();
    for (const entry of Object.values(table?.questions || {})) {
      const phrases = new Set((Array.isArray(entry?.judges) ? entry.judges : []).flatMap((judge) => conceptPhrases(judge?.objective_tag)));
      for (const phrase of phrases) counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
    phraseCounts.set(table, { counts, size: Object.keys(table?.questions || {}).length });
  }
  return phraseCounts.get(table);
}

/**
 * Key concept phrases of a question: the word pairs of either judge's objective tag that at most
 * CONCEPT_KEY_MAX_SHARE of the subject's judged questions carry (at least 3). The two judges rarely
 * spell a tag alike (about one tag in five agrees), but they name the concept with the same words.
 */
export function conceptKeysOf(row, { agentScores } = {}) {
  const found = ntaAgentScoreEntry(row?.id, { agentScores });
  if (!found?.entry || !found.table) return new Set();
  const { counts, size } = tablePhraseCounts(found.table);
  const limit = Math.max(3, Math.round(CONCEPT_KEY_MAX_SHARE * size));
  const phrases = (Array.isArray(found.entry.judges) ? found.entry.judges : []).flatMap((judge) => conceptPhrases(judge?.objective_tag));
  return new Set(phrases.filter((phrase) => (counts.get(phrase) || 0) <= limit));
}

// ---------------------------------------------------------------------------------------------
// Rows that are not real bank questions (finding 3)
// ---------------------------------------------------------------------------------------------

// Bank ids are UUIDs; factory candidates store the same 128 bits without hyphens.
const QUESTION_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
// A source or provenance kind that starts with a marker word ("seed", "seed_import", "demo-2026"; an
// underscore is not a word break here), or carries one anywhere ("PYQ 2023 (seed)", "PYQ demo").
const DEMO_MARKER = /^(?:seed|seeded|demo|sample[\s_-]?data|dummy|placeholder|fixture|test[\s_-]?data)(?![a-z0-9])/i;
const DEMO_ANYWHERE = /\(\s*(?:seed|seeded|demo|dummy|placeholder|fixture|sample|test)\s*\)|\b(?:demo|dummy|placeholder)\b/i;
// A tag that starts with a marker word, whatever separates it from the rest ("seed:2026-04", "seed 2026-04").
const DEMO_TAG = /^(?:seed|seeded|demo|dummy|placeholder|fixture)(?![a-z])/i;

/** Bank ids are UUIDs exactly as stored: a padded id would miss every Set and Map keyed by the stored id. */
export function isNtaQuestionId(id) {
  return typeof id === 'string' && QUESTION_ID.test(id);
}

/**
 * Reasons a row is a seed or demo row rather than a bank question: an id that is not a UUID (the 15 old
 * seeds g1-g3, a1-a3, b1-b3, e1-e3, m1-m3 are live with source "PYQ 2023"), or a seed or demo marker.
 */
export function seedOrDemoReasons(row) {
  const reasons = [];
  if (!isNtaQuestionId(row?.id)) reasons.push('id_not_uuid');
  const tags = Array.isArray(row?.tags) ? row.tags : [];
  const labels = [text(row?.source), text(row?.provenance?.kind)];
  if (labels.some((label) => DEMO_MARKER.test(label) || DEMO_ANYWHERE.test(label)) || tags.some((tag) => DEMO_TAG.test(text(tag)))) reasons.push('seed_or_demo_row');
  return reasons;
}

// ---------------------------------------------------------------------------------------------
// Corrupted connectives (finding 4)
// ---------------------------------------------------------------------------------------------

// A text pass replaced "only" with "mainly": "I and III mainly", "if and mainly if", "Statement I is the
// mainly objective", "codes for mainly one amino acid", "induced mainly if", "occurs mainly when", "mainly
// partially". Each pattern below reads wrongly in a stated condition, so it is a corruption, not a style
// choice (all ten "mainly when" items of the 13 Oct export were in the owner-approved corruption hold).
const CORRUPTED_CONNECTIVES = [
  /\bif and (?:mainly|largely|mostly|primarily|chiefly|solely) if\b/i,
  /\bnot (?:mainly|largely|mostly|primarily|chiefly)\b[^.?!]{0,120}\bbut also\b/i,
  /\bthe mainly\b/i,
  /\bmainly (?:one|two|three|four|once|twice|a single|single)\b/i,
  /\bmainly (?:if|when)\b/i,
  /\bmainly (?:partially|partly|slightly|fully|completely|wholly|exclusively|solely)\b/i,
  // A label list closed by "mainly" instead of "only": "I and III mainly", "Statement II mainly".
  // After a comma only a bracketed label or a roman numeral counts: "5 items, 2 mainly for households" and
  // "Vitamin A, B mainly supports vision" are ordinary text.
  /\b(?:and|or|Statements?|Only)\s+\(?(?:I{1,3}|IV|VI?|[A-F]|[1-6])\)?\s+mainly\b/,
  /,\s*(?:\((?:I{1,3}|IV|VI?|[A-F]|[1-6])\)|(?:I{1,3}|IV|VI?))\s+mainly\b/,
  // "mainly" closing a clause where "only" stood: "observation and self-judgment mainly".
  /\bmainly\s*(?=[.,;:!?)\]"”]|$)/i,
];

const CORRUPTED_IN_CONTEXT = CORRUPTED_CONNECTIVES.map((pattern) => new RegExp(String.raw`.{0,40}(?:${pattern.source}).{0,20}`, pattern.flags));
const CORRUPTION_WORD = /\b(?:mainly|largely|mostly|primarily|chiefly|solely)\b/i;

/** The corrupted phrases found in the stem, the options or the explanation. */
export function corruptedConnectives(row) {
  const parts = [getQuestionText(row), ...normalizeOptions(row?.options, row).map((option) => option.text), text(row?.explanation)];
  const found = [];
  for (const part of parts) {
    const value = text(part);
    if (!CORRUPTION_WORD.test(value)) continue;
    CORRUPTED_CONNECTIVES.forEach((pattern, i) => {
      if (!pattern.test(value)) return;
      const match = value.match(CORRUPTED_IN_CONTEXT[i]);
      found.push(match ? match[0] : value.slice(0, 60));
    });
  }
  return [...new Set(found)];
}

export function corruptedWordingReasons(row) {
  return corruptedConnectives(row).length ? ['wording_corrupted_connective'] : [];
}

// ---------------------------------------------------------------------------------------------
// Sequence and match keys in the listed order (finding 8)
// ---------------------------------------------------------------------------------------------

const ROMAN_RANK = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };

function labelRank(label) {
  const value = text(label);
  if (ROMAN_RANK[value]) return ROMAN_RANK[value];
  if (/^[A-F]$/.test(value)) return value.charCodeAt(0) - 64;
  if (/^[P-T]$/.test(value)) return value.charCodeAt(0) - 79;
  if (/^[1-6]$/.test(value)) return Number(value);
  return null;
}

function optionValue(option) {
  return text(typeof option === 'string' ? option : option?.text ?? option?.label ?? option?.value);
}

/** The stored key's option index, resolved the way data/db.js resolveCorrectIndex does; -1 when unknown. */
export function keyIndexOf(row) {
  const options = Array.isArray(row?.options) ? row.options : normalizeOptions(row?.options, row);
  if (Number.isInteger(row?.correct_index) && row.correct_index >= 0 && row.correct_index < options.length) return row.correct_index;
  const answer = text(row?.correct_answer);
  if (!answer || !options.length) return -1;
  const upper = answer.toUpperCase().replace(/^OPTION[_\s-]*/, '').replace(/[).:]+$/, '');
  const keyed = options.findIndex((option) => option && typeof option === 'object' && text(option.key ?? option.id).toUpperCase() === upper);
  if (keyed >= 0) return keyed;
  const letter = 'ABCDE'.indexOf(upper);
  if (upper.length === 1 && letter >= 0 && letter < options.length) return letter;
  if (/^\d+$/.test(answer)) {
    const number = Number(answer);
    if (number === 0) return 0;
    if (number >= 1 && number <= options.length) return number - 1;
  }
  return options.findIndex((option) => optionValue(option).toLowerCase() === answer.toLowerCase());
}

// The stem's own list: "(A) Mauryan empire (B) Gupta empire ..." as [{ label, item }] in the order it is printed.
function stemListItems(stem) {
  const value = text(stem);
  const marks = [...value.matchAll(new RegExp(String.raw`\((${LABEL})\)`, 'g'))];
  const items = [];
  marks.forEach((mark, i) => {
    if (items.some((entry) => entry.label === mark[1])) return;
    const end = i + 1 < marks.length ? marks[i + 1].index : value.length;
    items.push({ label: mark[1], item: value.slice(mark.index + mark[0].length, end).split(/[?]|\.\s/)[0] });
  });
  return items;
}

const plainWords = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** True when a key written as item text restates the stem's items in the order they are printed. */
function keyRestatesItemsInOrder(keyText, items) {
  const key = ` ${plainWords(keyText)} `;
  if (items.length < 3 || key.trim().length < 6) return false;
  let from = 0;
  for (const { item } of items) {
    const words = plainWords(item).split(' ').filter(Boolean).slice(0, 5).join(' ');
    if (words.length < 3) return false;
    const at = key.indexOf(` ${words}`, from);
    if (at < 0) return false;
    from = at + words.length;
  }
  return true;
}

/**
 * An arrange-in-sequence key that is the order the items are listed in ((A), (B), (C), (D); a numbered
 * "1. 2. 3. 4."; or the items' own text in the printed order), or a match key that pairs the lists in
 * their listed order ((A)-(I), (B)-(II), ...), gives the answer away. When the stem prints its items
 * out of alphabetical order ((C) (A) (D) (B)), the printed order is the one that counts.
 */
export function listedOrderKeyReasons(row, type) {
  const options = normalizeOptions(row?.options, row);
  const index = keyIndexOf(row);
  if (index < 0 || index >= options.length) return [];
  const keyText = plainOptionTexts(options.map((option) => option.text))[index];
  const reasons = [];
  const sequenceType = ['sequence_ordering', 'sentence_rearrangement'].includes(type) || isPermutationOptions(options);
  // "1. 2. 3. 4." names labels with full stops; the label list helper reads only bare labels.
  const list = optionLabelList(text(keyText).replace(new RegExp(String.raw`\b(${LABEL})\.(?=\s|$)`, 'g'), '$1'));
  const printed = stemListItems(getQuestionText(row)).map((entry) => entry.label);
  if (list && list.length >= 3 && sequenceType) {
    const sameLabels = printed.length === list.length && printed.every((label) => list.includes(label));
    if (sameLabels) {
      if (list.every((label, i) => label === printed[i])) reasons.push('sequence_key_is_listed_order');
    } else {
      const ranks = list.map(labelRank);
      if (ranks.every((rank, i) => rank !== null && (i === 0 || rank === ranks[i - 1] + 1))) reasons.push('sequence_key_is_listed_order');
    }
  } else if (!list && sequenceType && ['sequence_ordering', 'sentence_rearrangement'].includes(type)
    && keyRestatesItemsInOrder(keyText, stemListItems(getQuestionText(row)))) reasons.push('sequence_key_is_listed_order');
  const pairs = optionPairs(keyText);
  if (pairs && pairs.length >= 2 && pairs.every(([left, right]) => labelRank(left) !== null && labelRank(left) === labelRank(right))) reasons.push('match_key_is_listed_order');
  return reasons;
}

// ---------------------------------------------------------------------------------------------
// Option order for one student (finding 1)
// ---------------------------------------------------------------------------------------------

const LETTERS = 'ABCDE';
// Options that point at other options or at the list as a whole.
const REFERS_TO_LIST = /\b(?:all|none|both|neither|either|any|each)\s+(?:of\s+)?(?:the\s+)?(?:above|below|these|those|preceding|foregoing|options?|choices?)\b|\b(?:above|aforesaid|aforementioned)\b/i;
const NAMES_OPTION = /\b(?:options?|choices?|alternatives?)\s*\(?(?:[A-Ea-e]|[1-5])\)?(?![\w'’-])/;
// Options that stand last by convention in English error and improvement items.
const FIXED_LAST = /^\(?\s*(?:no error|no improvement|no correction|no change|no substitution)\b/i;
const LOWER_LABEL_REF = /^(?:both|only|either|neither)?\s*\(?([a-e])\)?\s*(?:,|and|or|&|nor)\s*\(?([a-e])\)?(?:\s*only)?\s*\.?$/i;
// Single-label options that name parts of the stem ("(B)", "Part C"); bare figures are answers.
const PART_LABEL = /^(?:part\s*)?(?:\(?[A-E]\)?|\([1-6]\)|\(?[a-e]\))\.?$/i;
const OPTION_LETTER = /^(?:[A-E]|[1-5])$/;

/** Labels the stem itself uses: list markers plus "Statement I", "Assertion (A)", "Reason (R)", "Item 2". */
function stemReferenceLabels(stem) {
  const labels = new Set(stemLabels(stem).all);
  for (const match of text(stem).matchAll(/\b(?:statements?|assertion|reason|items?|parts?|lists?|columns?|events?|steps?|stages?)\s*[-:]?\s*\(?\b([A-F]|R|VI|IV|V|I{1,3}|[1-6])\b\)?/gi)) labels.add(match[1]);
  return labels;
}

function seededRandom(seed) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { state ^= seed.charCodeAt(i); state = Math.imul(state, 16777619); }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Explicit references to an option by letter or number: "option C", "options B and D", "answer is A".
// The word may be capitalised ("Option B"); the letters stay upper case, so "an option a student ..." is prose.
// A linking word may stand between the word and the letters: "option is B", "Option B gives", "choice would be C".
const OPTION_WORD = String.raw`(?:[Oo]ptions?|[Cc]hoices?|[Aa]lternatives?)`;
const OPTION_LINK = String.raw`\s+(?:(?:is|are|was|were|has|have|gives?|giving|equals?|becomes?|remains?|seems?)|(?:would|must|should|will|can|could|may|might)\s+be)\s+|\s*[:=]\s*|\s*`;
const OPTION_REFERENCE = new RegExp(String.raw`\b(${OPTION_WORD})(${OPTION_LINK})((?:\(?[A-D1-4]\)?)(?:\s*(?:,|and|or|&|\/)\s*\(?[A-D1-4]\)?)*)(?![\w'’-])`, 'g');
// What is left of an option word and a letter once the rewritable references are taken out. Up to three
// words (and commas, but no full stop) may stand between: "option, as the powers add, B is ...".
const UNMATCHED_OPTION_REFERENCE = new RegExp(String.raw`\b${OPTION_WORD}\b(?:,?\s+[\w'’-]+){0,3}?,?\s*\(?\b[A-D1-4]\b\)?(?![\w'’-])`);
const ANSWER_REFERENCE = /\b((?:[Cc]orrect\s+)?(?:[Aa]nswer|[Kk]ey)(?:\s+is)?)(\s*[:=-]?\s*)(\(?)([A-D])(\)?)(?![\w'’-])/g;
const LETTER_VERDICT = /(?:^|[\s(])\(?([A-D])\)?\s+(?:is|was)\s+(?:the\s+)?(?:correct|incorrect|right|wrong|answer|key)\b/g;

/**
 * Why a question's options must keep their stored order; empty when shuffling is safe. Options that
 * name other options ("Both A and B", "All of the above", "option 2"), single-label options (error
 * spotting parts), a conventional last option ("No error"), a stem that names an option, and an
 * explanation that names an option in a way this module cannot rewrite all keep the stored order.
 */
export function shuffleBlockers(row) {
  if (!Array.isArray(row?.options) || row.options.length < 2 || row.options.length > LETTERS.length) return ['options_not_a_list'];
  if (keyIndexOf(row) < 0) return ['key_unresolved'];
  const stem = getQuestionText(row);
  const labels = stemReferenceLabels(stem);
  const texts = plainOptionTexts(row.options).map(text);
  const reasons = [];
  for (const value of texts) {
    if (REFERS_TO_LIST.test(value) || NAMES_OPTION.test(value)) reasons.push('option_refers_to_other_options');
    // "Both A and B", "A and C only": option letters or numbers the stem does not use name other options.
    // Figures ("+2 D", "(1, 3)") are answers; a qualifier or a joined letter list makes a reference.
    const list = optionLabelList(value);
    const qualified = /\b(?:only|both|neither|either|all)\b/i.test(value);
    const joined = /,|&|\b(?:and|or|nor)\b/i.test(value) && list?.some((label) => /^[A-E]$/.test(label));
    if (list && (qualified || joined) && list.some((label) => OPTION_LETTER.test(label) && !labels.has(label))) reasons.push('option_refers_to_other_options');
    const lower = value.match(LOWER_LABEL_REF);
    if (lower && ![lower[1], lower[2]].every((label) => labels.has(label) || labels.has(label.toUpperCase()))) reasons.push('option_refers_to_other_options');
    if (FIXED_LAST.test(value)) reasons.push('option_fixed_last');
  }
  if (texts.every((value) => PART_LABEL.test(value))) reasons.push('options_are_part_labels');
  if (NAMES_OPTION.test(stem)) reasons.push('stem_names_an_option');
  // "(C) is correct" naming a statement the stem labels (C) is about the statement, not an option, and
  // cannot be told apart from an option reference, so such items keep their order.
  const rest = text(row.explanation).replace(OPTION_REFERENCE, ' ').replace(ANSWER_REFERENCE, ' ');
  if ([...rest.matchAll(LETTER_VERDICT)].some((match) => labels.has(match[1])) || UNMATCHED_OPTION_REFERENCE.test(rest)) reasons.push('explanation_names_an_option');
  return [...new Set(reasons)];
}

function remapExplanation(explanation, newIndexOf) {
  if (explanation === null || explanation === undefined) return explanation;
  // Each reference is rewritten once: the passes write markers, and the markers become letters at the end.
  const mark = (old) => {
    const numeric = /^[1-5]$/.test(old);
    const index = numeric ? Number(old) - 1 : LETTERS.indexOf(old);
    if (index < 0 || newIndexOf[index] === undefined) return old;
    return `\u0000${numeric ? 'N' : 'L'}${newIndexOf[index]}\u0001`;
  };
  return String(explanation)
    .replace(OPTION_REFERENCE, (_, word, space, list) => `${word}${space}${list.replace(/[A-D1-4]/g, mark)}`)
    .replace(ANSWER_REFERENCE, (_, word, space, open, old, close) => `${word}${space}${open}${mark(old)}${close}`)
    .replace(LETTER_VERDICT, (match, old) => match.replace(old, mark(old)))
    .replace(/\u0000([NL])(\d)\u0001/g, (_, kind, index) => (kind === 'N' ? String(Number(index) + 1) : LETTERS[Number(index)]));
}

/**
 * The row a student is served: options in an order seeded by (shuffleKey, question id), the stored
 * self-letter prefixes removed (data/option_text.js), the key and any explicit option references in
 * the explanation remapped, and the permutation kept in nta_option_order (served position i shows
 * stored option nta_option_order[i]). The same key and question always give the same order, so a
 * resumed or reviewed session shows what the student answered. Rows whose options must stay in place
 * (shuffleBlockers) are served in the stored order with their prefixes removed.
 */
export function ntaServedRow(row, shuffleKey) {
  if (!Array.isArray(row?.options)) return { row, shuffled: false, reasons: ['options_not_a_list'] };
  const blockers = shuffleBlockers(row);
  const plain = plainOptionTexts(row.options);
  const count = row.options.length;
  const order = Array.from({ length: count }, (_, i) => i);
  if (!blockers.length) {
    const random = seededRandom(`${text(shuffleKey)}:${text(row.id)}`);
    for (let i = count - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
  }
  const newIndexOf = [];
  order.forEach((original, position) => { newIndexOf[original] = position; });
  const options = order.map((original, position) => {
    const option = row.options[original];
    return option && typeof option === 'object' ? { ...option, key: LETTERS[position], text: plain[original] } : plain[original];
  });
  const key = keyIndexOf(row);
  const served = { ...row, options, nta_option_order: order, nta_options_shuffled: !blockers.length };
  if (key >= 0) {
    served.correct_index = newIndexOf[key];
    served.correct_answer = LETTERS[newIndexOf[key]];
  }
  if (!blockers.length) served.explanation = remapExplanation(row.explanation, newIndexOf);
  return { row: served, shuffled: !blockers.length, reasons: blockers };
}
