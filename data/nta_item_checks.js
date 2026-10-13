// Item-level checks for NTA mode (data/nta_engine.js): what makes one question unfit for a paper that
// must read like a CUET expert's handmade mock, and when two questions are the same question for the
// student. Deterministic and offline: no model, no network. The NTA review of 13 Oct 2026
// (docs/brain/NTA-ENGINE-RUN.md, "Review fixes") lists the defects each check answers.
import { getQuestionText, normalizeOptions, getPassageText } from './nta_question_selector.js';
import quarantineFile from './nta_quarantine.json' with { type: 'json' };
import objectivesFile from './nta_objectives.json' with { type: 'json' };

// Two questions whose stem + options + key text overlap this much are the same question.
export const NEAR_DUPLICATE_TEXT_JACCARD = 0.5;
// Stems alone at this overlap are the same question even when options differ.
export const NEAR_DUPLICATE_STEM_JACCARD = 0.8;
// Two questions of one chapter whose stored concept names overlap this much test one concept.
export const SAME_CONCEPT_JACCARD = 0.5;
// Inside one passage set, two children whose correct answers say the same thing ask the same thing.
export const SAME_ANSWER_JACCARD = 0.5;

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
  const pairs = [...value.matchAll(/\(?\b([A-F])\b\)?\s*[-–:→]\s*\(?\b(VI|IV|V|I{1,3}|[1-6]|[P-U])\b\)?/g)].map((match) => [match[1], match[2]]);
  if (pairs.length < 2) return null;
  const rest = value.replace(/\(?\b([A-F])\b\)?\s*[-–:→]\s*\(?\b(VI|IV|V|I{1,3}|[1-6]|[P-U])\b\)?/g, '').replace(/[\s,;]+/g, '');
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

const OBJECTIVES = new Map(Object.entries(objectivesFile.questions || {}));
const OBJECTIVE_CAPS = objectivesFile.caps || {};

/** Learning-objective tag for a question: the index row's tag, else data/nta_objectives.json. */
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

/** Everything the conflict test needs, computed once per question. */
export function itemFeatures(row, { english = false } = {}) {
  const stem = getQuestionText(row);
  const options = normalizeOptions(row?.options, row);
  const keyIndex = Number.isInteger(row?.correct_index) ? row.correct_index : 'ABCD'.indexOf(text(row?.correct_answer).toUpperCase());
  const keyText = text(options[keyIndex]?.text);
  const keyIsLabels = Boolean(optionLabelList(keyText) || optionPairs(keyText));
  return {
    chapter: text(row?.chapter),
    stemKey: stem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    stemTokens: contentTokens(stem),
    textTokens: contentTokens(`${stem} ${options.map((option) => option.text).join(' ')}`),
    stemKeyTokens: contentTokens(`${stem} ${keyIsLabels ? '' : keyText}`),
    keyTokens: keyIsLabels ? new Set() : contentTokens(keyText),
    numbers: significantNumbers(stem),
    concept: conceptTokens(row),
    headwords: english ? headwordsOf(row) : new Set(),
    objective: objectiveTagOf(row),
  };
}

/**
 * Why two questions cannot sit in one paper, or null. sameSet: both are children of one passage.
 * Tags are capped separately (objectiveCap), not here.
 */
export function conflictReason(a, b, { sameSet = false } = {}) {
  if (a.stemKey && a.stemKey === b.stemKey) return 'same_stem';
  if (jaccard(a.stemTokens, b.stemTokens) >= NEAR_DUPLICATE_STEM_JACCARD) return 'near_duplicate_stem';
  if (jaccard(a.textTokens, b.textTokens) >= NEAR_DUPLICATE_TEXT_JACCARD) return 'near_duplicate_text';
  if (jaccard(a.stemKeyTokens, b.stemKeyTokens) >= NEAR_DUPLICATE_TEXT_JACCARD) return 'near_duplicate_text';
  if (sameSet && a.keyTokens.size >= 3 && b.keyTokens.size >= 3 && jaccard(a.keyTokens, b.keyTokens) >= SAME_ANSWER_JACCARD) return 'same_answer_in_set';
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
