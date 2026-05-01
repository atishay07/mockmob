function normalizeChapter(chapter) {
  return String(chapter || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getEnglishGenerationMode(chapter) {
  const value = normalizeChapter(chapter);
  let mode = makeMode('grammar', false, null);

  if (/\b(para jumbles?|sentence rearrangement|sentence reordering|paragraph rearrangement)\b/.test(value)) {
    mode = makeMode('para_jumble', false, null);
  } else if (/\b(reading comprehension|narrative passage|factual passage|literary passage|discursive passage|unseen passage|prose|passage)\b/.test(value)) {
    mode = makeMode('passage_rc', true, inferPassageType(value));
  } else if (/\b(vocabulary|synonyms?|antonyms?|word usage|idioms?|phrases?)\b/.test(value)) {
    mode = makeMode('vocabulary', false, null);
  } else if (/\b(grammar|error detection|correction|tenses?|subject verb|prepositions?)\b/.test(value)) {
    mode = makeMode('grammar', false, null);
  }

  console.log('[english_mode]', {
    chapter,
    mode: mode.mode,
    requires_passage: mode.requires_passage,
    passage_type: mode.passage_type,
    allowed_in_quick_practice: mode.allowed_in_quick_practice,
  });
  return mode;
}

function makeMode(mode, requiresPassage, passageType) {
  const passageMode = requiresPassage === true;
  return {
    mode,
    requires_passage: passageMode,
    passage_type: passageType,
    allowed_in_quick_practice: !passageMode,
    allowed_in_full_mock: true,
    allowed_in_nta_mode: true,
  };
}

function inferPassageType(value) {
  if (/\bnarrative\b/.test(value)) return 'narrative';
  if (/\bfactual\b/.test(value)) return 'factual';
  if (/\bliterary\b/.test(value)) return 'literary';
  if (/\bdiscursive\b/.test(value)) return 'discursive';
  if (/\bprose\b/.test(value)) return 'prose';
  return 'factual';
}

export function getEnglishConceptFamily(chapterOrConcept) {
  const value = normalizeChapter(chapterOrConcept).replace(/::/g, ' ');
  if (/\b(para jumbles?|para jumble|sentence reordering|sentence rearrangement|paragraph rearrangement)\b/.test(value)) {
    return 'para_jumble';
  }
  if (/\b(reading comprehension|narrative passage|factual passage|literary passage|discursive passage|unseen passage|prose|passage)\b/.test(value)) {
    return 'passage';
  }
  if (/\b(vocabulary|synonyms?|antonyms?|word usage|idioms?|phrases?)\b/.test(value)) {
    return 'vocabulary';
  }
  if (/\b(grammar|subject verb agreement|tenses?|prepositions?|error detection|sentence correction|correct word usage)\b/.test(value)) {
    return 'grammar';
  }
  return 'subject_style';
}
