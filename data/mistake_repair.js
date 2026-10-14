// Score Recovery: AI "Mistake Repair" for one wrong answer. Pure logic, no I/O.
//
// Order of trust: the stored, current answer key is the fact. The model must first solve the
// question on its own; only if its answer matches the key may it explain the student's mistake.
// A disagreement never produces an explanation: the question is treated as uncertain (withheld
// and re-checked) and the student is not charged. AI text explains; it never changes a score.

import { sameKeyOption } from './option_compare.js';

export const REPAIR_CREDIT_COST = 1;
const LIMITS = { why_tempting: 320, why_wrong: 320, key_idea: 320, next_step: 220 };
export const MISTAKE_REPAIR_SCHEMA = {
  required: ['solved_index', 'agrees_with_key', 'why_tempting', 'why_wrong', 'key_idea', 'next_step'],
  types: { solved_index: 'number', why_tempting: 'string', why_wrong: 'string', key_idea: 'string', next_step: 'string' },
};
// What the repair text must never claim: a predicted mark, score, rank or percentile, a cut-off or admission
// outcome, or a guaranteed gain. These are CLAIMS ABOUT THE STUDENT, so the bare words stay allowed: "rank" in
// Spearman's rank correlation, "percentile" in statistics, "the Constitution guarantees ...", "you will get x = 3".
const METRIC = String.raw`(?:marks?|points?|scores?|ranks?|percentiles?|cut-?offs?)`;
const claim = (source) => new RegExp(String.raw`\b(?:${source})`, 'i');
const BANNED_CLAIMS = [
  // predicted marks or scores: "you will score / gain / earn ...", "you will get 5 more marks"
  claim(String.raw`you(?:'ll|’ll|\s+will|\s+would|\s+are\s+going\s+to|\s+can\s+expect\s+to)\s+(?:score|gain|earn|secure)\b`),
  claim(String.raw`you(?:'ll|’ll|\s+will)\s+get\s+(?:[\w+%.-]+\s+){0,3}?${METRIC}\b`),
  claim(String.raw`marks?\s+you\s+(?:will|can|could|would|should)\s+(?:gain|recover|earn|score|get|win)\b`),
  // a prediction about the student's own result: "your rank will", "your percentile improves", "your expected score"
  claim(String.raw`your\s+(?:\w+\s+)?(?:rank|percentile)\b`),
  claim(String.raw`(?:predicted|projected|expected|likely)\s+(?:\w+\s+)?${METRIC}\b`),
  claim(String.raw`your\s+(?:\w+\s+)?(?:score|marks?)\s+(?:will|would|should|can|could|may|might|is\s+going\s+to|improves?|rises?|goes\s+up|increases?)\b`),
  // guaranteed gains: "guaranteed marks / selection", "this guarantees a better rank"
  claim(String.raw`guarantee[ds]?\s+(?:[\w-]+\s+){0,3}?(?:${METRIC}|selection|admission|seat|improvement|gains?|success|results?)\b`),
  // admission and cut-off outcomes
  claim(String.raw`admission\s+(?:chances?|probability|odds)\b`),
  claim(String.raw`cut-?offs?\s+you\b`),
  claim(String.raw`(?:clear|cross|beat|reach|meet|miss)\w*\s+(?:the\s+|your\s+)?(?:\w+\s+)?cut-?offs?\b`),
];
export const violatesTruthRules = (text) => BANNED_CLAIMS.some((pattern) => pattern.test(text));

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
  // By option identity, not position: an NTA paper serves its options shuffled, so the snapshot's key index can
  // legitimately differ from the live row's while pointing at the same option (data/option_compare.js).
  if (!sameKeyOption(q.options, keyIndex, current.options, currentKey)) return { ok: false, code: 'key_changed', http: 409, message: 'This question’s answer was corrected after your session, so the old result is not explained.' };
  return { ok: true, question: q, chosenIndex: d.givenIndex, keyIndex };
}

// A passage-based question (English reading, case studies) cannot be solved or explained without its passage. Attempt
// snapshots carry it as `passageText` / `passageTitle` (data/db.js questionOut); raw question rows as `passage_text`.
const passageText = (q) => { const t = q?.passageText ?? q?.passage_text; return typeof t === 'string' ? t.trim() : ''; };
const passageTitle = (q) => { const t = q?.passageTitle ?? q?.passage_title; return typeof t === 'string' ? t.trim() : ''; };
const passageBlock = (q) => {
  const text = passageText(q);
  if (!text) return '';
  const title = passageTitle(q);
  return `Passage${title ? ` (${title})` : ''}:\n${text}\n`;
};

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
Never predict marks, scores, ranks, percentiles, cutoffs or admission chances for the student, and never promise a gain. Words such as rank or percentile are fine when they are part of the subject itself. Do not add facts the answer does not need.
Return JSON only: {"solved_index": number, "agrees_with_key": boolean, "why_tempting": string, "why_wrong": string, "key_idea": string, "next_step": string}`;
  const user = `Chapter: ${question.chapter || 'unknown'}\n${passageBlock(question)}Question: ${question.question ?? question.body ?? ''}\nOptions:\n${options}\nStudent chose index ${chosenIndex}.`;
  return { system, user };
}

/** Blind second opinion: the key is not shown. Used only when the first answer disputes the key. */
export function buildBlindSolvePrompt({ question, subject }) {
  const options = question.options.map((o, i) => `${letter(i)} (index ${i}). ${optionTextOf(o)}`).join('\n');
  return {
    system: `You are checking a CUET UG ${subject || ''} multiple-choice question. Solve it carefully. Return JSON only: {"solved_index": number, "confident": boolean}`,
    user: `${passageBlock(question)}Question: ${question.question ?? question.body ?? ''}\nOptions:\n${options}`,
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
  if (Object.values(repair).some(violatesTruthRules)) return { kind: 'unusable' };
  return { kind: 'explained', repair };
}

/** Fresh practice on the same chapter, reusing the existing recovery replay route shape. */
export function practiceHref({ subject, chapter, attemptId }) {
  return `/test?${new URLSearchParams({ subject: subject || '', mode: 'quick', count: '5', ...(chapter ? { chapter } : {}), recoveryFrom: attemptId })}`;
}

