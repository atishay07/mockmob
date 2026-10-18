// The after-the-mock receipt (FEATURE-ADOPTION-2026-10-17 item 5; owner W-064 and F18): what the student's repairs did on THIS
// paper, said once, from the record and nothing else. PURE: no I/O, no clock, no model.
//
// What it counts, exactly. The repairs are the student's own saved repairs made BEFORE this paper was handed in (GET
// /api/me/repair-record: one row per mistake, with its question, its chapter and when it was repaired), one per question.
// It then asks the paper two things, in this order, and says only the first that applies:
//
//   1. The same question. Did a repaired question come up again on this paper? If any did, the line counts those and how
//      many the student got right: "Of the 6 mistakes you repaired, 2 came up again on this paper. You got both right."
//      Once the same question has come back, the chapter is never used instead: it is the direct evidence. If none of the
//      questions that came up was right, nothing is said (a receipt reports what held; it never scolds, and it never
//      swaps to a kinder count).
//   2. The same chapter. If no repaired question came up, the repaired questions are grouped by subject and chapter. A
//      chapter is "clean" when this paper asked about it, the student answered at least one question there, and got none
//      wrong. The line counts the repaired mistakes that sit in clean chapters: "Of the 6 mistakes you repaired, 4 are in
//      chapters where you got nothing wrong on this paper." A chapter the paper did not ask about, or left blank, is
//      simply not counted either way.
//
// It claims no cause and no marks gained: a count of mistakes whose question or chapter is on this paper, and what happened
// there. Nothing to say is no line: no repair before this paper, a read that did not load (unknown is never zero), a record
// the paper cannot be matched to, no clean chapter, or no right answer among the questions that came back. A page of rows
// as long as the page asked for may hide older repairs, so then the line says "most recently".
export const DEFAULT_LIMIT = 100;

const key = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const stamp = (v) => (typeof v === 'number' ? v : Date.parse(v || ''));
const verdictOf = (d) => (d?.isCorrect === true ? 'right' : d?.isCorrect === false ? 'wrong' : 'blank');
const both = (n) => (n === 2 ? 'both' : `all ${n}`);

/** The repaired questions before this paper, one per question: [{ questionId, subject, chapter }]. */
export function repairedBefore({ attempt, repairs }) {
  const at = Number(attempt?.completedAt);
  if (!Number.isFinite(at) || !Array.isArray(repairs)) return [];
  const seen = new Set();
  const out = [];
  for (const r of repairs) {
    const when = stamp(r?.repairedAt);
    if (typeof r?.questionId !== 'string' || !r.questionId || !Number.isFinite(when) || when >= at) continue;
    if (r.attemptId != null && r.attemptId === attempt.id) continue;
    if (seen.has(r.questionId)) continue;
    seen.add(r.questionId);
    out.push({ questionId: r.questionId, subject: key(r.subject), chapter: key(r.chapter) });
  }
  return out;
}

/**
 * The receipt for one paper, or null.
 *   attempt  the paper: { id, subject, completedAt, questionsSnapshot: [{ id, chapter, subject? }], details: [{ qid, isCorrect }] }
 *   repairs  the repair record's rows, or null when it did not load
 *   limit    the rows asked for (a full page of them may hide older repairs)
 * Returns { kind: 'question' | 'chapter', repaired, count, right, lead, strong, text } or null. `repaired` is the denominator
 * (the repaired mistakes before this paper), `count` the mistakes counted by the rule above, `right` the answers right
 * among the questions that came up (kind 'question'). `lead` and `strong` are the two halves of the sentence, the second
 * drawn in ink; `text` is the whole line.
 */
export function repairReceipt({ attempt, repairs, limit = DEFAULT_LIMIT } = {}) {
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const details = Array.isArray(attempt?.details) ? attempt.details : [];
  if (!questions.length || !details.length) return null;
  const before = repairedBefore({ attempt, repairs });
  if (!before.length) return null;
  const n = before.length;
  const capped = Array.isArray(repairs) && repairs.length >= limit;
  const mistakes = (capped ? `${n} mistakes you repaired most recently` : `${n} ${n === 1 ? 'mistake' : 'mistakes'} you repaired`);

  const byDetail = new Map(details.map((d) => [d?.qid, d]));
  const asked = new Map(questions.map((q) => [q?.id, { subject: key(q?.subject ?? attempt.subject), chapter: key(q?.chapter), verdict: verdictOf(byDetail.get(q?.id)) }]));

  // 1. The same question.
  const again = before.filter((r) => asked.has(r.questionId));
  if (again.length) {
    const right = again.filter((r) => asked.get(r.questionId).verdict === 'right').length;
    if (!right) return null;
    const a = again.length;
    const got = right === a ? (a === 1 ? 'it' : both(a)) : String(right);
    const lead = n === 1 ? `The mistake you repaired${capped ? ' most recently' : ''}` : `Of the ${mistakes},`;
    const strong = n === 1 ? `came up again on this paper. You got ${got} right.` : `${a === n ? (n === 2 ? 'both' : `all ${n}`) : a} came up again on this paper. You got ${got} right.`;
    return { kind: 'question', repaired: n, count: a, right, lead, strong, text: `${lead} ${strong}` };
  }

  // 2. The same chapter: clean = asked, answered at least once, none wrong.
  const chapters = new Map();
  for (const q of asked.values()) {
    if (!q.chapter) continue;
    const id = `${q.subject}|${q.chapter}`;
    const c = chapters.get(id) || { right: 0, wrong: 0 };
    if (q.verdict === 'right') c.right += 1;
    if (q.verdict === 'wrong') c.wrong += 1;
    chapters.set(id, c);
  }
  const clean = before.filter((r) => {
    if (!r.chapter) return false;
    const c = chapters.get(`${r.subject || key(attempt.subject)}|${r.chapter}`);
    return Boolean(c) && c.right + c.wrong >= 1 && c.wrong === 0;
  }).length;
  if (!clean) return null;
  const where = clean === 1 ? 'a chapter where' : 'chapters where';
  const lead = clean === n ? (n === 1 ? `The mistake you repaired${capped ? ' most recently' : ''}` : `All ${mistakes}`) : `Of the ${mistakes},`;
  const strong = clean === n ? `${n === 1 ? 'is' : 'are'} in ${where} you got nothing wrong on this paper.` : `${clean} ${clean === 1 ? 'is' : 'are'} in ${where} you got nothing wrong on this paper.`;
  return { kind: 'chapter', repaired: n, count: clean, right: null, lead, strong, text: `${lead} ${strong}` };
}
