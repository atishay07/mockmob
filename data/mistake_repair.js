// Score Recovery: AI "Mistake Repair" for one wrong answer. Pure logic, no I/O.
//
// Order of trust: the stored, current answer key is the fact. The model must first solve the
// question on its own; only if its answer matches the key may it explain the student's mistake.
// A disagreement never produces an explanation: the question is treated as uncertain (withheld
// and re-checked) and the student is not charged. AI text explains; it never changes a score.

export const REPAIR_CREDIT_COST = 1;
const LIMITS = { why_tempting: 320, why_wrong: 320, key_idea: 320, next_step: 220 };
export const MISTAKE_REPAIR_SCHEMA = {
  required: ['solved_index', 'agrees_with_key', 'why_tempting', 'why_wrong', 'key_idea', 'next_step'],
  types: { solved_index: 'number', why_tempting: 'string', why_wrong: 'string', key_idea: 'string', next_step: 'string' },
};
const BANNED = /\b(guarantee[ds]?|you will (?:score|gain|get)|marks? you (?:will|can) (?:gain|recover)|rank|percentile|admission chance|cut-?off you)\b/i;

const letter = i => 'ABCDEFGH'[i] || String(i + 1);
const optionTextOf = o => (typeof o === 'string' ? o : o?.text ?? '');
export const correctIndexOf = q => Number.isInteger(q?.correctIndex) ? q.correctIndex
  : Number.isInteger(q?.correct_index) ? q.correct_index
  : (q?.options || []).findIndex((o, i) => (o?.key || letter(i)) === (q?.correct_answer || q?.correctAnswer));

/** Can this mistake be repaired right now? Reasons are user-safe strings. */
export function repairEligibility({ attempt, questionId, userId, current }) {
  if (!attempt || attempt.userId !== userId) return { ok: false, code: 'not_found', http: 404, message: 'That session was not found.' };
  const q = (attempt.questionsSnapshot || []).find(x => x.id === questionId);
  const d = (attempt.details || []).find(x => x.qid === questionId);
  if (!q || !d) return { ok: false, code: 'not_found', http: 404, message: 'That question is not in this session.' };
  if (d.isCorrect !== false || !Number.isInteger(d.givenIndex)) return { ok: false, code: 'not_a_mistake', http: 422, message: 'Mistake Repair works on questions you answered wrongly.' };
  const keyIndex = correctIndexOf(q);
  if (!Array.isArray(q.options) || q.options.length < 2 || keyIndex < 0 || keyIndex >= q.options.length) return { ok: false, code: 'snapshot_invalid', http: 422, message: 'This question cannot be repaired.' };
  if (!current || current.is_deleted) return { ok: false, code: 'question_withdrawn', http: 409, message: 'This question has been withdrawn, so it is not explained.' };
  if (['pending', 'quarantined', 'rejected', 'invalid'].includes(current.status) || current.verification_state === 'disputed')
    return { ok: false, code: 'question_under_review', http: 409, message: 'This question is being re-checked, so it is not explained right now. You were not charged.' };
  const currentKey = correctIndexOf(current);
  if (currentKey !== keyIndex) return { ok: false, code: 'key_changed', http: 409, message: 'This question’s answer was corrected after your session, so the old result is not explained.' };
  return { ok: true, question: q, chosenIndex: d.givenIndex, keyIndex };
}

export function buildRepairPrompt({ question, chosenIndex, keyIndex, subject }) {
  const options = question.options.map((o, i) => `${letter(i)} (index ${i}). ${optionTextOf(o)}`).join('\n');
  const system = `You are MockMob's Score Recovery tutor for CUET UG ${subject || 'practice'}.
A student chose a wrong option. Work in this order:
1. Solve the question yourself from scratch. Put the 0-based index of the option you believe is correct in "solved_index".
2. The platform's answer key is index ${keyIndex}. Set "agrees_with_key" to true only if your solved_index is ${keyIndex}.
3. Only if you agree, explain for a 17-year-old in plain English:
   - "why_tempting": why the student's option (index ${chosenIndex}) looks right — the specific trap (max 45 words)
   - "why_wrong": the exact reason that option fails (max 45 words)
   - "key_idea": the rule or distinction that picks the correct answer (max 45 words)
   - "next_step": one concrete thing to do in the next 10 minutes (max 30 words)
If you disagree with the key, set every text field to "".
Never mention marks to gain, ranks, percentiles, cutoffs or admission chances. Do not add facts the answer does not need.
Return JSON only: {"solved_index": number, "agrees_with_key": boolean, "why_tempting": string, "why_wrong": string, "key_idea": string, "next_step": string}`;
  const user = `Chapter: ${question.chapter || 'unknown'}\nQuestion: ${question.question ?? question.body ?? ''}\n${question.passage_text ? `Passage: ${question.passage_text}\n` : ''}Options:\n${options}\nStudent chose index ${chosenIndex}.`;
  return { system, user };
}

/** Blind second opinion: the key is not shown. Used only when the first answer disputes the key. */
export function buildBlindSolvePrompt({ question, subject }) {
  const options = question.options.map((o, i) => `${letter(i)} (index ${i}). ${optionTextOf(o)}`).join('\n');
  return {
    system: `You are checking a CUET UG ${subject || ''} multiple-choice question. Solve it carefully. Return JSON only: {"solved_index": number, "confident": boolean}`,
    user: `Question: ${question.question ?? question.body ?? ''}\n${question.passage_text ? `Passage: ${question.passage_text}\n` : ''}Options:\n${options}`,
  };
}

const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Turn model output into one of: explained | disputed | unusable. */
export function interpretRepair(data, { keyIndex, optionCount }) {
  if (!data || typeof data !== 'object') return { kind: 'unusable' };
  const solved = data.solved_index;
  if (!Number.isInteger(solved) || solved < 0 || solved >= optionCount) return { kind: 'unusable' };
  if (solved !== keyIndex || data.agrees_with_key !== true) return { kind: 'disputed', solvedIndex: solved };
  const repair = Object.fromEntries(Object.entries(LIMITS).map(([k, max]) => [k, clean(data[k], max)]));
  if (Object.values(repair).some(v => v.length < 8)) return { kind: 'unusable' };
  if (Object.values(repair).some(v => BANNED.test(v))) return { kind: 'unusable' };
  return { kind: 'explained', repair };
}

/** Fresh practice on the same chapter, reusing the existing recovery replay route shape. */
export function practiceHref({ subject, chapter, attemptId }) {
  return `/test?${new URLSearchParams({ subject: subject || '', mode: 'quick', count: '5', ...(chapter ? { chapter } : {}), recoveryFrom: attemptId })}`;
}

