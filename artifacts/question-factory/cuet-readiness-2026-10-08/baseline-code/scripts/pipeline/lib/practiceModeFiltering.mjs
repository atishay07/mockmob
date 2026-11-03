export function shouldIncludeQuestionForPracticeMode(question, mode) {
  const normalizedMode = normalizeMode(mode);
  const isPassageLinked = Boolean(
    question?.group_id ||
    question?.passage_group_id ||
    question?.passage_id ||
    question?.temporary_group_key ||
    question?.is_passage_linked,
  );

  if (normalizedMode === 'quick') return !isPassageLinked;
  if (normalizedMode === 'full' || normalizedMode === 'nta') return true;
  return !isPassageLinked;
}

export function shouldIncludePassageGroupForPracticeMode(_group, mode) {
  const normalizedMode = normalizeMode(mode);
  return normalizedMode === 'full' || normalizedMode === 'nta';
}

function normalizeMode(mode) {
  const value = String(mode || '').toLowerCase();
  if (value === 'quick_practice') return 'quick';
  if (value === 'full_mock') return 'full';
  if (value === 'nta_mode') return 'nta';
  return value;
}
