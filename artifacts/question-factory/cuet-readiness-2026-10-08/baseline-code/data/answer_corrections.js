import { scoreSession } from './recovery.js';
// Called only after current evidence passes revalidation. Original records stay intact.
export function deriveCorrectedScore(attempt, replacements, eligible) {
  if (!Array.isArray(replacements) || !replacements.length || replacements.some(q=>!eligible(q))) throw new Error('CORRECTION_REVALIDATION_REQUIRED');
  const byId = new Map(replacements.map(q=>[q.id,q]));
  if (byId.size!==replacements.length || replacements.some(q=>!attempt.questionsSnapshot.some(s=>s.id===q.id))) throw new Error('INVALID_CORRECTION_IDS');
  const stem = q => String(q.body ?? q.question ?? q.text ?? '');
  const options = q => (q.options || []).map((o,index) => typeof o==='string' ? {index,text:o} : {index,text:o.text ?? o.label ?? o.value ?? o.body ?? o.option ?? '',key:o.key ?? null});
  // An old selection index cannot be interpreted against reordered answers or
  // changed wording. Preserve the original score and withhold a comparison.
  for (const replacement of replacements) {
    const original=attempt.questionsSnapshot.find(q=>q.id===replacement.id);
    if (stem(original)!==stem(replacement) || JSON.stringify(options(original))!==JSON.stringify(options(replacement)) || (original.passageText ?? '')!==(replacement.passageText ?? '')) throw new Error('CORRECTION_NOT_COMPARABLE');
  }
  const questions=attempt.questionsSnapshot.map(q=>byId.get(q.id)||q);
  const answers=Object.fromEntries(attempt.details.map(d=>[d.qid,d.givenIndex]));
  const result=scoreSession(questions,answers);
  return {rawScore:result.rawScore,score:result.score,correct:result.correct,wrong:result.wrong,unattempted:result.unattempted,total:result.total,details:result.details,originalAttemptId:attempt.id,originalScore:attempt.score,reason:'Current revalidated answer key; original attempt snapshot retained.'};
}
