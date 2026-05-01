const ANSWER_KEYS = new Set(['A', 'B', 'C', 'D']);
const ENGLISH_CONTEXT_CHAPTERS = new Set([
  'Factual Passage',
  'Narrative Passage',
  'Literary Passage',
  'Reading Comprehension',
  'Prose',
  'Unseen Passage',
  'Discursive Passage',
]);

export function runSelfCheck(question, context = {}) {
  const reasons = [];
  const normalized = normalizeQuestionShape(question);
  const body = normalized.body;
  const bodyLower = body.toLowerCase();
  const optionTexts = normalized.options.map((option) => option.text);
  const correct = normalized.options.find((option) => option.key === normalized.answer);
  const distractors = normalized.options.filter((option) => option.key !== normalized.answer);
  const paraJumble = isParaJumbleQuestion(question, normalized);
  const passageLinked = isPassageLinkedQuestion(question, normalized);
  const passageCheck = passageLinked ? runPassageQuestionSelfCheck(question, context?.passageGroup || context?.passage_group || {}) : null;

  if (!body) reasons.push('missing_question');
  if (normalized.options.length !== 4) reasons.push('invalid_options_count');
  if (!ANSWER_KEYS.has(normalized.answer)) reasons.push('invalid_answer_key');
  if (normalized.options.some((option) => !option.text)) reasons.push('empty_option');
  if (new Set(optionTexts.map(normalizeComparableText)).size !== optionTexts.length) reasons.push('duplicate_options');

  const isEnglishContext = normalized.subject === 'english' && ENGLISH_CONTEXT_CHAPTERS.has(normalized.chapter);
  if (!isEnglishContext && !passageLinked && isDirectDefinition(body)) reasons.push('direct_definition');

  const strongDistractors = normalizeAnswerKeyArray(question?.strong_distractors || question?.strongDistractors);
  const trapOption = normalizeAnswerKey(question?.trap_option || question?.trapOption);
  if (strongDistractors.length < 2) reasons.push('missing_strong_distractors');
  if (!trapOption) reasons.push('missing_trap_option');
  if (trapOption && trapOption === normalized.answer) reasons.push('trap_equals_answer');
  if (trapOption && !normalized.options.some((option) => option.key === trapOption)) reasons.push('trap_option_not_present');
  if (strongDistractors.includes(normalized.answer)) reasons.push('strong_distractor_points_to_answer');
  if (question?.json_repaired === true) {
    if (!String(question?.answer_check || question?.answerCheck || '').trim()) reasons.push('generated_schema_minimal_missing_field');
    if (trapOption && !ANSWER_KEYS.has(trapOption)) reasons.push('invalid_trap_option');
    if (strongDistractors.length < 2 || strongDistractors.some((key) => !ANSWER_KEYS.has(key))) reasons.push('strong_distractors_invalid');
    if (passageLinked && !String(question?.temporary_group_key || question?.passage_group_id || question?.group_id || '').trim()) reasons.push('passage_child_missing_group');
  }

  if (hasLogicallyImpossibleOptions(optionTexts)) reasons.push('logically_impossible_option');
  if (hasAbsurdExtremeDistractor(optionTexts)) reasons.push('absurd_extreme_option');
  if (containsMetaCommentary(question)) reasons.push('meta_commentary_detected');
  if (hasAnswerCheckConflict(question)) reasons.push('answer_check_conflict');
  if (correct && hasExactWordingGiveaway(body, correct.text, distractors)) reasons.push('answer_wording_giveaway');
  if (hasAmbiguousAnswer(normalized, question)) reasons.push('ambiguous_or_mismatched_answer');
  if (isClearlyOutsideCuetScope(body)) reasons.push('non_cuet_pattern');
  if (isPatternSpam(body, context)) reasons.push('pattern_spam');
  if (paraJumble) {
    const invalidPermutationCount = optionTexts.filter((option) => !isValidPermutationOption(option)).length;
    if (invalidPermutationCount > 0) reasons.push('invalid_para_jumble_permutation');
    if (!String(question?.ordering_logic || question?.orderingLogic || '').trim()) reasons.push('missing_ordering_logic');
    if (isChildishParaJumble(body)) reasons.push('obvious_chronological_story');
    if (hasTooSimpleParaJumbleSentences(body)) reasons.push('para_jumble_sentences_too_simple');
  }
  if (passageLinked) {
    reasons.push(...passageCheck.reasons);
  }

  const statementCombination = hasStatementPattern(body) && hasNtaCombinationOptions(optionTexts);
  const symbolicBooleanOptions = normalized.subject === 'computer_science' &&
    /boolean\s+algebra/i.test(normalized.chapter) &&
    optionTexts.filter((text) => /[A-Z][+\-.']|[01]\b|=|\bAND\b|\bOR\b|\bNOT\b/i.test(text)).length >= 3;
  const passagePlausibleOptions = passageLinked && passageCheck?.pass === true;
  const plausibleDistractors = passagePlausibleOptions
    ? 2
    : symbolicBooleanOptions
    ? Math.min(2, distractors.length)
    : paraJumble && optionTexts.every((option) => isValidPermutationOption(option))
    ? 2
    : statementCombination
    ? 2
    : countPlausibleDistractors(correct?.text || '', distractors.map((option) => option.text));
  if (!paraJumble && !statementCombination && !passagePlausibleOptions && plausibleDistractors < 2) reasons.push('weak_distractors');

  const trapQuality = reasons.some((reason) => reason.includes('trap')) || plausibleDistrorsAreVeryWeak(plausibleDistractors)
    ? 'low'
    : plausibleDistractors >= 2 ? 'high' : 'medium';
  const distractorQuality = plausibleDistractors >= 2 ? 'high' : plausibleDistrorsAreVeryWeak(plausibleDistractors) ? 'low' : 'medium';
  const obviousnessRisk = reasons.some((reason) => ['answer_wording_giveaway', 'weak_distractors', 'absurd_extreme_option'].includes(reason))
    ? 'high'
    : statementCombination || hasReasoningPattern(bodyLower) ? 'low' : 'medium';
  const cuetPattern = !isClearlyOutsideCuetScope(body) && (
    paraJumble ||
    passageLinked ||
    statementCombination ||
    /\b(assertion|reason|case|situation|compare|application|match|observation|graph|infer|conclude)\b/i.test(body) ||
    countWords(body) >= 18
  );
  if (!cuetPattern) reasons.push('non_cuet_pattern');

  return {
    pass: reasons.length === 0,
    reasons: [...new Set(reasons)],
    distractor_quality: distractorQuality,
    trap_quality: trapQuality,
    obviousness_risk: obviousnessRisk,
    cuet_pattern: cuetPattern,
  };
}

export function runPassageQuestionSelfCheck(question, passageGroup = {}) {
  const normalized = normalizeQuestionShape(question);
  const reasons = [];
  const passageText = String(
    question?.passage_text ||
    question?.passageText ||
    passageGroup?.passage_text ||
    passageGroup?.passageText ||
    ''
  ).trim();
  const body = normalized.body;
  const bodyLower = body.toLowerCase();
  const questionType = String(question?.question_type || '').toLowerCase();
  const answerCheck = String(question?.answer_check || question?.answerCheck || question?.explanation || '').trim();
  const groupKey = String(question?.temporary_group_key || question?.passage_group_id || question?.group_id || passageGroup?.temporary_group_key || passageGroup?.id || '').trim();

  if (!passageText) reasons.push('missing_passage_text');
  const wordCount = countWords(passageText);
  if (passageText && wordCount < 180) reasons.push('passage_too_short');
  if (wordCount > 550) reasons.push('passage_too_long');
  if (!groupKey) reasons.push('passage_child_missing_group');
  if (!String(question?.passage_id || passageGroup?.passage_id || '').trim()) reasons.push('missing_passage_id');

  const options = normalized.options.map((option) => option.text);
  const invalidOptionCount = options.filter((option) => !option || /\b(unrelated|outside knowledge|none of these|all of these)\b/i.test(option)).length;
  if (invalidOptionCount >= 2) reasons.push('passage_options_unrelated');

  if (/vocabulary/.test(questionType)) {
    const quoted = extractQuotedTerms(body);
    const hasPhraseInPassage = quoted.some((term) => passageContainsTerm(passageText, term));
    const hasContextStem = /\b(as used|in context|in the passage|in the phrase|closest in meaning)\b/i.test(body);
    if (!hasContextStem || quoted.length === 0 || !hasPhraseInPassage) {
      reasons.push('vocabulary_without_passage_context');
    }
  }

  const answerEvidenceOk = Boolean(answerCheck) && (passageEvidenceOverlap(passageText, answerCheck) || /central idea|tone|attitude|purpose|inference|suggests|implies|passage/i.test(answerCheck));
  if (!answerEvidenceOk) reasons.push('answer_check_lacks_passage_evidence');

  const passageRelatedOptions = options.filter((option) => passageEvidenceOverlap(passageText, option) || isPassageInterpretiveOption(option)).length;
  const interpretiveQuestion = /\b(central idea|theme|tone|attitude|purpose|infer|implies|suggests|best captures)\b/i.test(bodyLower + ' ' + questionType);
  if (!interpretiveQuestion && passageRelatedOptions < 2) reasons.push('weak_passage_distractors');

  return {
    pass: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}

export function isValidPermutationOption(option, labels = ['A', 'B', 'C', 'D']) {
  const compact = String(option || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (compact.length !== labels.length) return false;
  const expected = [...labels].sort().join('');
  return compact.split('').sort().join('') === expected;
}

export function summarizeSelfCheckResults(results) {
  const grouped = {};
  let passed = 0;
  for (const result of results || []) {
    if (result?.pass) passed += 1;
    for (const reason of result?.reasons || []) {
      grouped[reason] = (grouped[reason] || 0) + 1;
    }
  }
  return {
    total: Array.isArray(results) ? results.length : 0,
    passed,
    rejected_count: Math.max(0, (Array.isArray(results) ? results.length : 0) - passed),
    reasons: grouped,
  };
}

export function getStemShape(body) {
  const text = String(body || '').toLowerCase();
  if (/read the statements/.test(text)) return 'read_statements';
  if (/\bassertion\b.*\breason\b/.test(text)) return 'assertion_reason';
  if (/\bmatch\b/.test(text)) return 'match_type';
  if (/\bcase|situation|scenario|student|learner|observation\b/.test(text)) return 'case_application';
  return text.split(/\s+/).slice(0, 6).join(' ');
}

export function isClearlyOutsideCuetScope(body) {
  const text = String(body || '').toLowerCase();
  if (/\b(vector space|rank-nullity|heine-borel|cayley-hamilton|functional analysis|abstract algebra|group under|olympiad|graduate|mba|b\.com|econometrics)\b/.test(text)) {
    return true;
  }
  if (/\b(prove|derive|derivation|proof)\b/.test(text) && /\b(equation|formula|expression|theorem)\b/.test(text)) {
    return true;
  }
  if (/\bjee|neet\b/.test(text) && /\bmulti-step|advanced|derivation|complex\b/.test(text)) {
    return true;
  }
  const formulaSignals = (text.match(/[a-z]\s*=\s*[^.;,]+/gi) || []).length +
    (text.match(/\b(?:calculate|derive|integrate|differentiate|solve)\b/gi) || []).length;
  const variableSignals = (text.match(/\b[a-z]\d?\b\s*[=<>]/gi) || []).length;
  return formulaSignals >= 3 || variableSignals >= 5;
}

function normalizeQuestionShape(question) {
  const options = normalizeOptions(question?.options || question?.o || []);
  return {
    body: String(question?.body || question?.question || question?.q || '').trim(),
    options,
    answer: normalizeAnswerKey(question?.correct_answer || question?.answer || question?.a),
    subject: String(question?.subject || '').trim(),
    chapter: String(question?.chapter || '').trim(),
  };
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (typeof option === 'string') {
      const stripped = option.replace(/^[A-D][).:-]\s*/i, '').trim();
      return { key: ['A', 'B', 'C', 'D'][index], text: stripped };
    }
    return {
      key: normalizeAnswerKey(option?.key || ['A', 'B', 'C', 'D'][index]),
      text: String(option?.text || '').replace(/^[A-D][).:-]\s*/i, '').trim(),
    };
  }).filter((option) => option.key);
}

function normalizeAnswerKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return ANSWER_KEYS.has(key) ? key : '';
}

function normalizeAnswerKeyArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(normalizeAnswerKey).filter(Boolean))]
    : [];
}

function isDirectDefinition(body) {
  const text = String(body || '').trim().toLowerCase();
  return /^(what is|define|meaning of|which term|who is|when did)\b/.test(text) ||
    /\b(correct definition|best definition|definition of|is called|meaning of|known as)\b/.test(text) ||
    /\b(refers to)\b/.test(text) && !hasReasoningPattern(text);
}

function hasReasoningPattern(text) {
  return /\b(statement\s+i|assertion|reason|case|situation|scenario|compare|because|whereas|however|infer|conclude|application)\b/i.test(text);
}

function hasStatementPattern(body) {
  return /\bStatement\s+I\b/i.test(body) && /\bStatement\s+II\b/i.test(body);
}

function hasNtaCombinationOptions(optionTexts) {
  return optionTexts.filter(isNtaStatementCombinationOption).length >= 3;
}

function isNtaStatementCombinationOption(text) {
  const value = String(text || '').trim();
  return /^(?:[IVX]+(?:\s*(?:,|and)\s*[IVX]+)*\s+only|[IVX]+(?:\s*,\s*[IVX]+)*(?:\s+and\s+[IVX]+)?|statement\s+[IVX]+\s+only|both\s+statement\s+[IVX]+\s+and\s+statement\s+[IVX]+(?:\s+are\s+correct)?|neither\s+statement\s+[IVX]+\s+nor\s+statement\s+[IVX]+)$/i.test(value);
}

function hasLogicallyImpossibleOptions(optionTexts) {
  return optionTexts.some((text) => /\b(none of these|all of these|both a and b|cannot be determined|unrelated|has no relation|not possible in every case)\b/i.test(text));
}

function hasAbsurdExtremeDistractor(optionTexts) {
  return optionTexts.some((text) => {
    const value = String(text || '').toLowerCase();
    return /\b(all|always|never|only|completely)\b/.test(value) &&
      /\b(environmentally friendly|no effect|same in every case|direction of motion|unrelated|random|impossible)\b/.test(value);
  });
}

function hasExactWordingGiveaway(body, correctText, distractors) {
  const bodyTokens = new Set(tokenize(body));
  const correctOverlap = tokenize(correctText).filter((token) => bodyTokens.has(token)).length;
  const distractorOverlap = distractors.map((option) => tokenize(option.text).filter((token) => bodyTokens.has(token)).length);
  const maxDistractorOverlap = Math.max(0, ...distractorOverlap);
  return correctOverlap >= 5 && correctOverlap >= maxDistractorOverlap + 4;
}

function hasAmbiguousAnswer(normalized, question) {
  if (hasStatementPattern(normalized.body) && hasNtaCombinationOptions(normalized.options.map((option) => option.text))) {
    return hasStatementCombinationAnswerMismatch(normalized, question);
  }
  const rationale = question?.distractor_rationale || question?.distractorRationale || {};
  const answerRationale = String(rationale[normalized.answer] || '');
  return /\b(incorrect|incorrectly|wrong|flaw|flawed|invalid|misleading|misrepresents|overlooks|not accurate|inaccurate)\b/i.test(answerRationale);
}

function hasStatementCombinationAnswerMismatch(normalized, question) {
  const answerOption = normalized.options.find((option) => option.key === normalized.answer);
  if (!answerOption || !isNtaStatementCombinationOption(answerOption.text)) return false;

  const answerStatements = extractRomanStatementSet(answerOption.text);
  const rationale = question?.distractor_rationale || question?.distractorRationale || {};
  const answerRationale = String(rationale[normalized.answer] || '');
  if (/\b(incorrect|incorrectly|wrong|flaw|flawed|invalid|misleading|misrepresents|overlooks|not accurate|inaccurate)\b/i.test(answerRationale)) {
    return true;
  }
  const claimedCorrect = extractClaimedCorrectStatementSet(answerRationale);
  return claimedCorrect.size > 0 && !areStatementSetsEqual(answerStatements, claimedCorrect);
}

function extractRomanStatementSet(text) {
  const matches = String(text || '').toUpperCase().match(/\b[IVX]+\b/g) || [];
  return new Set(matches);
}

function extractClaimedCorrectStatementSet(text) {
  const value = String(text || '').toUpperCase();
  const onlyMatch = value.match(/\b(?:ONLY\s+)?STATEMENT\s+([IVX]+)\s+IS\s+CORRECT\b/);
  if (onlyMatch) return new Set([onlyMatch[1]]);
  const bothMatch = value.match(/\bBOTH\s+([IVX]+)\s+AND\s+([IVX]+)\s+ARE\s+CORRECT\b/);
  if (bothMatch) return new Set([bothMatch[1], bothMatch[2]]);
  return new Set();
}

function areStatementSetsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function countPlausibleDistractors(correctText, distractorTexts) {
  if (!correctText) return 0;
  const correctTokens = new Set(tokenize(correctText));
  return distractorTexts.filter((text) => {
    const tokens = tokenize(text);
    if (tokens.length < 3) return false;
    const overlap = tokens.filter((token) => correctTokens.has(token)).length;
    return overlap >= 2 || /\b(because|while|but|however|whereas|partly|mainly|usually|under|except|condition|context)\b/i.test(text);
  }).length;
}

function plausibleDistrorsAreVeryWeak(count) {
  return count <= 0;
}

function isPatternSpam(body, context) {
  const counts = context?.stemShapeCounts;
  const batchSize = Number(context?.batchSize || 0);
  if (!counts || batchSize < 4) return false;
  const shape = getStemShape(body);
  const count = Number(counts[shape] || counts.get?.(shape) || 0);
  return count >= Math.max(4, Math.ceil(batchSize * 0.75));
}

function isParaJumbleQuestion(question, normalized) {
  const type = String(question?.question_type || '').toLowerCase();
  const chapter = String(normalized?.chapter || '').toLowerCase();
  return type === 'para_jumble' ||
    /\bpara\s*jumbles?\b|\bpara-jumbles?\b|\bsentence\s+rearrangement\b|\bsentence\s+reordering\b|\bparagraph\s+rearrangement\b/.test(chapter);
}

function isPassageLinkedQuestion(question, normalized) {
  const chapter = String(normalized?.chapter || '').toLowerCase();
  return Boolean(question?.is_passage_linked || question?.passage_text || question?.passage_id || question?.passage_group_id || question?.temporary_group_key) ||
    /\b(reading comprehension|narrative passage|factual passage|literary passage|discursive passage|unseen passage|prose)\b/.test(chapter);
}

function extractParaJumbleSentences(body) {
  const matches = [...String(body || '').matchAll(/\b([A-D])\.\s*([^\n]+?)(?=\n[A-D]\.|\s*$)/g)];
  return matches.map((match) => String(match[2] || '').trim()).filter(Boolean);
}

function isChildishParaJumble(body) {
  const text = String(body || '').toLowerCase();
  return /\b(cookie|cookies|cake|picnic|beach|sunset|birds|butterfly|birthday|airport|dream trip|toy|school picnic|baking|garden party)\b/.test(text);
}

function hasTooSimpleParaJumbleSentences(body) {
  const sentences = extractParaJumbleSentences(body);
  if (sentences.length !== 4) return true;
  const averageWords = sentences.reduce((sum, sentence) => sum + countWords(sentence), 0) / sentences.length;
  const hasLogicCue = /\b(however|therefore|instead|while|because|although|this|these|such|consequently|meanwhile|yet|for instance|in contrast)\b/i.test(body);
  return averageWords < 8 || !hasLogicCue;
}

function containsMetaCommentary(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || {});
  return [
    /\bActually\b/i,
    /\bLet's fix\b/i,
    /\bI'll adjust\b/i,
    /\bWait\b/i,
    /\breconsider\b/i,
    /\bthe intended correct answer\b/i,
    /\bwe need to change\b/i,
    /\bthis question is wrong\b/i,
    /\bLet's replace\b/i,
    /\bI will correct\b/i,
    /\bBut wait\b/i,
    /\bHowever,\s+the answer should be\b/i,
  ].some((pattern) => pattern.test(text));
}

function hasAnswerCheckConflict(question) {
  const text = [
    question?.answer_check,
    question?.answerCheck,
    question?.explanation,
    ...(question?.distractor_rationale && typeof question.distractor_rationale === 'object'
      ? Object.values(question.distractor_rationale)
      : []),
  ].join(' ');
  return /\b(answer should be|correct answer should be|intended answer is|key should be|but the answer)\b/i.test(text);
}

function normalizeComparableText(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return normalizeComparableText(text).split(/\s+/).filter((token) => token.length > 3);
}

function extractQuotedTerms(text) {
  const quoted = [...String(text || '').matchAll(/["'“”‘’]([^"'“”‘’]{2,60})["'“”‘’]/g)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (quoted.length > 0) return quoted;
  const wordMatch = String(text || '').match(/\b(?:word|phrase)\s+([A-Za-z][A-Za-z-]{2,})\b/i);
  return wordMatch ? [wordMatch[1]] : [];
}

function passageContainsTerm(passageText, term) {
  const passage = normalizeComparableText(passageText);
  const value = normalizeComparableText(term);
  return Boolean(value) && passage.includes(value);
}

function passageEvidenceOverlap(passageText, value) {
  const passageTokens = new Set(tokenize(passageText));
  const valueTokens = tokenize(value);
  if (valueTokens.length === 0) return false;
  const overlap = valueTokens.filter((token) => passageTokens.has(token)).length;
  return overlap >= Math.min(2, valueTokens.length);
}

function isPassageInterpretiveOption(option) {
  return /\b(suggests|implies|indicates|emphasises|reflects|contrasts|balanced|critical|concern|change|tension|purpose|idea|tone|attitude|partial|incomplete)\b/i.test(String(option || ''));
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}
