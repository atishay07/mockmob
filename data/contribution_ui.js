// UI adapters for the contribution API, with no publication or credit decisions.
export function contributionState(status) {
  if (['live', 'approved'].includes(status)) return 'live';
  if (['rejected', 'quarantined', 'blocked', 'failed'].includes(status)) return 'held';
  return 'pending';
}

export function removeContributionOption(options, correctKey, index) {
  const originalCorrect = options.find((option) => option.key === correctKey);
  const retained = options.filter((_, optionIndex) => optionIndex !== index);
  const correctIndex = retained.indexOf(originalCorrect);
  return { options: retained.map((option, i) => ({ ...option, key: 'ABCDE'[i] })), correctKey: correctIndex < 0 ? '' : 'ABCDE'[correctIndex] };
}

export function contributionErrors(form, options) {
  const errors = {};
  if (!form.subject.trim()) errors.subject = 'Choose a subject.';
  if (!form.chapter.trim()) errors.chapter = 'Choose a chapter.';
  if (form.body.trim().length < 10) errors.body = 'Write the full question (at least 10 characters).';
  if (options.filter((option) => option.text.trim()).length < 2) errors.options = 'Add at least two complete options.';
  if (!options.some((option) => option.key === form.correct_answer && option.text.trim())) errors.correct_answer = 'Mark a filled option as the correct answer.';
  return errors;
}
