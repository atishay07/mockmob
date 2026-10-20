// What the guided plan takes from a student's attempts to point at a lesson (extracted from src/lib/server/learning.js, 20 Oct
// 2026, so a test can drive it). Reads only: attempt details (qid, isCorrect), and per snapshot question id, subject, chapter
// and conceptId; the lean attempt read ('plan' profile of public.attempts_lean) carries exactly these.
export const weakConcepts = (attempts) => attempts.flatMap((attempt) => (attempt.details || [])
  .filter((answer) => answer.isCorrect === false)
  .map((answer) => attempt.questionsSnapshot?.find((q) => q.id === answer.qid)?.conceptId)
  .filter(Boolean));

// Chapters behind recent ordinary mistakes (the newest ten papers) point to the matching lesson, if one is published.
export const weakChapters = (attempts) => attempts.slice(0, 10).flatMap((attempt) => (attempt.details || [])
  .filter((answer) => answer.isCorrect === false)
  .map((answer) => {
    const q = attempt.questionsSnapshot?.find((q) => q.id === answer.qid);
    return q?.chapter ? { subject: q.subject || attempt.subject, chapter: q.chapter } : null;
  })
  .filter(Boolean));
