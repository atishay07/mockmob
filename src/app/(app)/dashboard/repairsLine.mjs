// The pure half of Practice's Repairs and Ask Mobi line (PracticeRepairs.jsx, owner D5; not named after it, so a
// case-blind resolver never takes it for the component), kept apart so a node test can
// hold the counts: they must agree with Your papers' "To repair" (release 11 walk: Practice said 48 where Your papers said 42).
// One number, counted one way: the wrong answers in the newest REVIEW_WINDOW papers, minus the ones holding a saved repair
// (F17). A blank is not repaired: Your papers offers it again, free, so it is counted apart (`blanks`), never in "to repair".
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const dayLabel = (ts) => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
// "your one session", "your 12 sessions": small counts in words, the way the app says them.
export const sessionsWord = (n) => `your ${n <= 10 ? WORDS[n] : n} ${n === 1 ? 'session' : 'sessions'}`;
const keyOf = (attemptId, questionId) => `${attemptId}:${questionId}`;
const REF = /^[A-Za-z0-9_-]{1,80}$/;
/** The newest papers Your papers reads (ATTEMPT_WINDOW in src/lib/server/review.js): Practice counts the same ones. */
export const REVIEW_WINDOW = 40;
const count = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.max(0, Math.trunc(Number(v))) : null);

// Wrong and blank, as Your papers tells them apart (src/lib/server/review.js): wrong is a pick that was not the key; anything
// else not right is a blank. An attempt without details falls back to its saved totals.
export function missesOf(attempt) {
  const details = Array.isArray(attempt?.details) ? attempt.details : null;
  if (details) {
    const missed = details.filter((d) => d && d.isCorrect !== true).length;
    const wrong = details.filter((d) => d && d.isCorrect === false && Number.isInteger(d.givenIndex)).length;
    return { wrong, blank: missed - wrong };
  }
  const total = count(attempt?.total) ?? 0;
  const correct = count(attempt?.correct) ?? 0;
  const wrong = count(attempt?.wrong);
  const blank = count(attempt?.unattempted);
  if (wrong !== null) return { wrong, blank: blank ?? Math.max(0, total - correct - wrong) };
  return { wrong: Math.max(0, total - correct - (blank ?? 0)), blank: blank ?? 0 };
}

/**
 * Pure: what the line says for one subject. attempts: the student's attempts (any order); repairs: rows from
 * /api/me/repair-record (newest first) or null while unknown. Returns the counts and the newest saved repair, which is
 * both what to revisit and what Ask Mobi is asked about: the panel opens on "the mistake you repaired" with its rule, so
 * it is only ever handed a repaired one. A miss still waiting goes to Review and its repair, not to a reply.
 */
export function repairsFor({ attempts = [], repairs = null, subjectId }) {
  const savedByAttempt = new Map();
  for (const row of repairs || []) {
    if (!row?.attemptId) continue;
    savedByAttempt.set(row.attemptId, (savedByAttempt.get(row.attemptId) || 0) + 1);
  }
  const newestFirst = [...attempts].sort((a, b) => (Date.parse(b?.completedAt) || Number(b?.completedAt) || 0) - (Date.parse(a?.completedAt) || Number(a?.completedAt) || 0));
  let open = 0; let openElsewhere = 0; let blanks = 0; let listed = 0;
  const sessions = attempts.filter((a) => a?.subject === subjectId).length;
  for (const attempt of newestFirst.slice(0, REVIEW_WINDOW)) {
    const { wrong, blank } = missesOf(attempt);
    const left = Math.max(0, wrong - (savedByAttempt.get(attempt.id) || 0));
    if (attempt.subject !== subjectId) { openElsewhere += left; continue; }
    listed += 1;
    open += left;
    blanks += blank;
  }
  const saved = (repairs || []).filter((row) => row?.subject === subjectId && row.attemptId);
  const last = saved.find((row) => REF.test(String(row.attemptId)) && REF.test(String(row.questionId || ''))) || null;
  let ask = null;
  if (last) {
    // Its number on the paper ("Q5"), when the paper is among the attempts this page holds.
    const paper = attempts.find((a) => a?.id === last.attemptId);
    const at = Array.isArray(paper?.details) ? paper.details.findIndex((d) => d?.qid === last.questionId) : -1;
    ask = { ref: keyOf(last.attemptId, last.questionId), number: at >= 0 ? at + 1 : null, at: last.repairedAt || paper?.completedAt || null };
  }
  return { sessions, listed, open, openElsewhere, blanks, saved: saved.length, revisit: saved[0] || null, ask };
}

