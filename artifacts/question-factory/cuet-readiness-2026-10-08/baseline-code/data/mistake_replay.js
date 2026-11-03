export function missedChapters(attempt) {
  if (!['server_practice_v1','server_snapshot_v1'].includes(attempt?.selectionMeta?.scoringVersion)) return [];
  const missed = new Set((attempt.details || []).filter(d=>d.isCorrect !== true).map(d=>d.qid));
  return [...new Set((attempt.questionsSnapshot || []).filter(q=>missed.has(q.id)).map(q=>q.chapter).filter(c=>typeof c === 'string' && c.length <= 200))].slice(0,12);
}
export function replayExposures(attempts) {
  const questions = attempts.flatMap(a=>a.questionsSnapshot || []);
  return { excludeQuestionIds:questions.map(q=>q.id), excludeFamilyIds:questions.map(q=>q.familyId || q.evidence?.record?.family_id).filter(Boolean) };
}
