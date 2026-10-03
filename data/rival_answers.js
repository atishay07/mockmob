export function validateRivalAnswers(questionIds, answers, questions) {
  if (!Array.isArray(questionIds) || new Set(questionIds).size !== questionIds.length || !Array.isArray(answers) || answers.length > questionIds.length || new Set(answers.map(a=>a.qid)).size !== answers.length) throw new Error('duplicate_or_invalid_question_ids');
  const ids = new Set(questionIds);
  if (questions.length !== ids.size || questions.some(q=>!ids.has(q.id))) throw new Error('incomplete_question_snapshot');
  for (const a of answers) {
    const q = questions.find(q=>q.id===a.qid);
    if (!q || (a.selectedIndex !== null && (!Number.isInteger(a.selectedIndex) || a.selectedIndex<0 || a.selectedIndex>=q.options.length))) throw new Error('invalid_answer');
  }
  return answers;
}
