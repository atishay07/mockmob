// Practice "Average score": each paper's signed marks (5 per right answer, minus 1 per wrong one) over its
// maximum (5 x questions), averaged, so a paper below zero pulls the average down. The stored `score` is clamped
// at 0, so it is only the fallback for a row that carries no counts.
export function paperMarksPercent(attempt) {
  const correct = Number(attempt?.correct);
  const wrong = Number(attempt?.wrong);
  const total = Number(attempt?.total);
  if (Number.isFinite(correct) && Number.isFinite(wrong) && Number.isFinite(total) && total > 0) {
    return ((correct * 5 - wrong) / (5 * total)) * 100;
  }
  const score = Number(attempt?.score);
  return Number.isFinite(score) ? score : 0;
}

export function averageMarksPercent(attempts) {
  if (!Array.isArray(attempts) || !attempts.length) return 0;
  return Math.round(attempts.reduce((sum, attempt) => sum + paperMarksPercent(attempt), 0) / attempts.length);
}
