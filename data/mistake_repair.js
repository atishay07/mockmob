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
  if (!sameKeyOption(q.options, keyIndex, current.options, currentKey, q.optionOrder ?? q.nta_option_order ?? q.option_order)) return { ok: false, code: 'key_changed', http: 409, message: 'This question’s answer was corrected after your session, so the old result is not explained.' };
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

// ---- Repair v3 (build spec 15 Oct 2026, section A) -------------------------------------------------------------
// The model writes only about the question: why the chosen option tempts, where it breaks, why the key is right,
// why each other option is wrong, one rule with a memory hook and a second explanation, all from one call. Nothing
// about the student is sent or written by the model; the personal lines are built on the server from records.

// Rollback switch: REPAIR_PROMPT_VERSION=1 brings back the v1 builder, schema, interpreter and default token cap.
export function repairPromptVersion(env = globalThis.process?.env) {
  return String(env?.REPAIR_PROMPT_VERSION ?? '').trim() === '1' ? 1 : 3;
}
export const REPAIR_PROMPT_VERSION = repairPromptVersion();
// The visible-output cap for v3, with headroom so an over-long answer is not cut into invalid JSON.
export const REPAIR_V3_MAX_TOKENS = 1400;

export const TRAP_TYPES = Object.freeze(['partly_true', 'reversed', 'look_alike_term', 'missed_not_except', 'not_in_passage', 'calculation_slip', 'wrong_rule', 'one_step_short', 'extreme_word', 'assertion_reason_link', 'other']);
// Server caps in characters. The prompt asks for words (30, 35, 35, 35, 18, 15, 12, 60); these leave room for that.
export const LIMITS_V3 = Object.freeze({ trap: 260, why_wrong: 280, why_right: 280, contrast: 280, others: 150, rule: 130, memory_hook: 100, another_way: 460 });
const REQUIRED_V3 = ['trap', 'why_wrong', 'why_right', 'rule'];
const OPTIONAL_V3 = ['contrast', 'memory_hook', 'another_way'];
const MIN_LENGTH_V3 = { trap: 12, why_wrong: 12, why_right: 12, rule: 8 };
export const MISTAKE_REPAIR_SCHEMA_V3 = {
  required: ['solved_index', 'agrees_with_key', 'trap_type', 'trap', 'why_wrong', 'why_right', 'rule'],
  types: { solved_index: 'number', trap: 'string', why_wrong: 'string', why_right: 'string', rule: 'string' },
};

// The reference explanation from the bank: its first 1,200 characters, cut at a sentence end.
export const REFERENCE_EXPLANATION_CAP = 1200;
function referenceExplanation(value, cap = REFERENCE_EXPLANATION_CAP) {
  const raw = typeof value === 'string' ? value : typeof value?.text === 'string' ? value.text : '';
  const text = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!text || text.length <= cap) return text;
  const head = text.slice(0, cap + 1);
  let cut = -1;
  for (const m of head.matchAll(/[.?!](?=\s)/g)) if (m.index + 1 <= cap) cut = m.index + 1;
  if (cut > 0) return text.slice(0, cut);
  const space = head.lastIndexOf(' ', cap);
  return text.slice(0, space > 0 ? space : cap);
}

const optionalLine = (label, value) => (value ? `${label}: ${value}\n` : '');

/** The v3 prompt (spec A.3). Question data only: no time, history, accuracy, difficulty or anything about the student. */
export function buildRepairPromptV3({ question, chosenIndex, keyIndex, subjectName }) {
  const subject = String(subjectName || '').trim() || 'practice';
  const C = letter(chosenIndex), K = letter(keyIndex);
  const options = question.options.map((o, i) => `${letter(i)} (index ${i}). ${optionTextOf(o)}`).join('\n');
  const system = `You are MockMob's tutor for CUET UG ${subject}. A student chose option ${C} (index ${chosenIndex}).
Work in this order.
1. Solve the question yourself from the question, passage and options. Put the 0-based index of your answer in "solved_index".
2. The platform's answer key is option ${K} (index ${keyIndex}). Set "agrees_with_key" to true only if solved_index is ${keyIndex}. If it is not, set every text field to "", "trap_type" to "other" and "others" to [].
3. If you agree, write for a 17-year-old in plain English. Write about the options and the idea, never about the student's mind or habits: write "This option borrows a true fact", never "You rushed".
- "trap_type": one of ${TRAP_TYPES.join(', ')}.
- "trap": why option ${C} looks right at first. Max 30 words.
- "why_wrong": the exact point where option ${C} fails. Max 35 words.
- "why_right": why option ${K} is right. Max 35 words. When a reference explanation is given, use it as evidence and do not contradict it.
- "contrast": one worked contrast, "If the question said X, option ${C} would fit. It says Y, so option ${K}." Max 35 words. Use "" when no clean contrast exists.
- "others": for each option other than ${C} and ${K}, {"index": n, "why": why it is wrong, max 18 words}. Use [] when there are none.
- "rule": one rule to carry to new questions, as an instruction. Max 15 words.
- "memory_hook": a short way to remember the rule: a contrast pair, an example sentence or a mnemonic. Max 12 words. Not a repeat of the rule. Use "" if none fits.
- "another_way": the same idea explained a second way, more simply than the reference explanation, with one fresh example. Max 60 words.
Name options as "option A", "option B" and so on, using only the letters listed. Use only facts in the question, passage, options and reference explanation. If the reference explanation conflicts with the key, ignore it. If its option letters do not match the options listed, rely on the option text.
Never predict marks, scores, ranks, percentiles, cut-offs or admission chances for the student, and never promise a gain. Words such as rank or percentile are fine when they belong to the subject. Plain sentences. No exclamation marks. No dashes between clauses.
Return JSON only with exactly these keys: solved_index, agrees_with_key, trap_type, trap, why_wrong, why_right, contrast, others, rule, memory_hook, another_way.`;
  const chapter = String(question.chapter || '').trim();
  const topic = String(question.topic || '').trim();
  const questionType = String(question.questionType ?? question.question_type ?? '').trim();
  const passage = passageText(question);
  const title = passageTitle(question);
  const explanation = referenceExplanation(question.explanation);
  const user = `Subject: ${subject}
Chapter: ${chapter || 'unknown'}
${optionalLine('Topic', topic && topic.toLowerCase() !== chapter.toLowerCase() ? topic : '')}${optionalLine('Question type', questionType)}${passage ? `Passage${title ? ` (${title})` : ''}:\n${passage}\n` : ''}Question: ${question.question ?? question.body ?? ''}
Options:
${options}
Student chose option ${C} (index ${chosenIndex}).${explanation ? `\nReference explanation from the question bank (may be brief):\n${explanation}` : ''}`;
  return { system, user };
}

// ---- v3 validation (spec A.4) ----
const LEADING_LABEL = /^(?:answer|explanation|solution|trap|why\s+(?:it\s+is\s+)?(?:wrong|right)|rule|memory\s+hook|hook|contrast|another\s+way|reason|note|tip|key\s+idea)\s*:\s*/i;

// A "!" stays only where it is clearly maths, never at a sentence end:
//   "!=" (not equal);
//   a factorial (a digit, a letter or a closing bracket, then "!") followed, with or without a space, by an operator,
//   "=", a digit or a closing bracket ("5! = 120", "n!/(r!(n-r)!)"), or straight away by an opening bracket;
//   a factorial of a number, a one-letter variable or a bracket in a sentence that goes on ("5! is 120", "4! ways"),
//   or that a full stop then ends ("The count is 5!.").
// Everything else is an exclamation and becomes ".": "The answer is 42!" ends "42.", and so does a factorial at the
// very end of a sentence, which cannot be told apart from an exclamation (the prompt asks for plain sentences).
const MATH_AFTER = /^\s*[+\-−×*/÷=<>≤≥^)\]}0-9]|^[([{]/;
function mathBang(text, at) {
  const before = text.slice(0, at);
  const after = text.slice(at + 1);
  if (after.startsWith('=')) return true;
  if (!/[A-Za-z0-9)\]]$/.test(before)) return false;
  if (MATH_AFTER.test(after)) return true;
  // A full stop straight after the "!" ends the sentence itself, so the "!" is a factorial: "The count is 5!." stays.
  return /(?:^|[^A-Za-z])(?:\d+|[A-Za-z])$|[)\]]$/.test(before) && /^(?:\s+[a-z]|[,;:]\s|\.(?:\s|$))/.test(after);
}

/** Step 3: collapse whitespace, turn dashes between words into commas and "!" into ".", strip a leading label. */
export function cleanRepairText(value) {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  text = text
    .replace(/(\d)\s*–\s*(?=\d)/g, '$1-') // an en dash in a number range is a range, not a clause break
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!+/g, (run, at, whole) => (run.length === 1 && mathBang(whole, at) ? run : '.'))
    .replace(/,\s*,/g, ',')
    .replace(/\.(?:\s*\.)+/g, '.')
    .replace(/,\s*([.?;:])/g, '$1')
    .replace(/^[,\s]+|[,\s]+$/g, '');
  for (let i = 0; i < 2 && LEADING_LABEL.test(text); i += 1) text = text.replace(LEADING_LABEL, '').trim();
  return text;
}

/** Step 4: keep text at or under the cap; otherwise cut after the last ". ", "? " or "; " at or past 60% of the cap. */
export function fitSentence(text, cap) {
  const value = String(text ?? '');
  if (value.length <= cap) return value;
  let cut = -1;
  for (const m of value.matchAll(/[.?;](?= )/g)) {
    const end = m.index + 1;
    if (end > cap) break;
    if (end >= Math.ceil(cap * 0.6)) cut = end;
  }
  if (cut < 0) return null;
  const kept = value.slice(0, cut).trim();
  return kept.endsWith(';') ? `${kept.slice(0, -1)}.` : kept;
}

// Step 7: a claim about the student: their mind, their habits, or what they did to get it wrong. The model writes
// about the options, never about the student. Teaching text stays allowed: "If you add 3 to both sides", "When you
// read 'will', expect a verb", "If you were the buyer", "you were asked to find". Words in quotation marks are option
// or passage text being quoted ('Option D uses "you were"'), so they are left out of the check.
// "missed" names a cause ("You missed the word NOT"), except in the record's own fact "you missed this in Mock 2".
const CAUSE_VERBS = String.raw`(?:confused|mixed\s+up|forgot|forgotten|overlooked|missed(?!\s+(?:this|it|that)(?:\s+question)?\s+(?:in|on|before|earlier|last)\b)|misread|misunderstood|ignored|rushed|assumed|panicked|guessed|skimmed|overthought|neglected|thought|fell\s+for|got\s+(?:confused|mixed\s+up)|failed\s+to\s+(?:read|notice|check|see|spot))`;
const HEDGES = String.raw`(?:\s+(?:probably|likely|perhaps|maybe|clearly|simply|just|may|might|must|could|would|have|had|seem\s+to\s+have|seemed\s+to\s+have))*`;
const STUDENT_CLAIMS = [
  // "You confused", "You may have confused", "You forgot", "You probably missed", "You've ignored", "You assumed".
  new RegExp(String.raw`\byou(?:['’]ve|['’]d)?${HEDGES}\s+${CAUSE_VERBS}\b`, 'i'),
  /\byou(?:'re|’re|\s+are|\s+were)\s+(?:careless|rushing|nervous|tired|confused|lazy)\b/i,
  /\byou\s+(?:did\s*n[o'’]?t|didn['’]t|did\s+not)\s+(?:read|think|check|notice)\b/i,
  // "You were thinking of ...", "You were in a hurry". Not a hypothetical ("If you were the seller", "Suppose you were
  // to double it") and not the question's own words ("you were asked / given / told / shown to").
  /(?<!\b(?:if|suppose|supposing|imagine|unless|wish|though|as\s+if|even\s+if)\s+)\byou\s+were\s+(?!(?:asked|given|told|shown|provided|to)\b)[a-z]/i,
  // "Your mistake was ...", "Your error is ...", "the mistake you made".
  /\byour\s+(?:(?:main|real|only|first|big|biggest)\s+)?(?:mistake|error|slip)\s+(?:was|is)\b/i,
  /\bthe\s+(?:mistake|error)\s+you\s+made\b/i,
];
const QUOTED = /"[^"]*"|“[^”]*”|(^|[\s(\[])(?:'[^']*'|‘[^’]*’)(?=$|[\s.,;:?!)\]])/g;
const withoutQuotes = (text) => String(text ?? '').replace(QUOTED, (_, lead) => `${lead || ''} quoted `);
export const claimsAboutStudent = (text) => {
  const plain = withoutQuotes(text);
  return STUDENT_CLAIMS.some((pattern) => pattern.test(plain));
};

// Step 8: text that names another listed option as the right one. "Statement (B) is correct" is a statement label, not
// an option, so the word "option" or "answer" is required. A conditional ("option B is correct only if ...") is allowed.
const NOT_CONDITIONAL = String.raw`(?!\s*,?\s*(?:only|if|when|unless|under)\b)`;
const KEY_CLAIMS = [
  // "is also / actually / in fact / indeed / really (the only) correct" names a second right answer just as plainly.
  new RegExp(String.raw`\boption\s+\(?([A-Za-z])\)?\s+is\s+(?:(?:also|actually|in\s+fact|indeed|really)\s+)?(?:the\s+)?(?:only\s+)?(?:correct|right)(?:\s+(?:answer|option|one))?\b${NOT_CONDITIONAL}`, 'gi'),
  new RegExp(String.raw`\b(?:correct|right)\s+(?:answer|option)\s+is\s+(?:option\s+)?\(?([A-Za-z])\)?(?![\w'’])${NOT_CONDITIONAL}`, 'gi'),
];
export function contradictsKey(text, keyLetter, letters) {
  const listed = new Set(Array.from(letters || []));
  for (const pattern of KEY_CLAIMS) {
    for (const m of String(text ?? '').matchAll(pattern)) {
      const named = m[1];
      // Only an upper-case listed letter is an option name: "the right answer is a ratio" names nothing.
      if (named === named.toUpperCase() && listed.has(named) && named !== keyLetter) return true;
    }
  }
  return false;
}

const comparable = (s) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();

/**
 * Turn v3 model output into explained | disputed | unusable (spec A.4).
 * @returns {{kind:'explained', repair:object, dropped:string[]} | {kind:'disputed', solvedIndex:number} | {kind:'unusable', reason:string}}
 */
export function interpretRepairV3(data, { keyIndex, chosenIndex, optionCount }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { kind: 'unusable', reason: 'not_an_object' };
  const solved = data.solved_index;
  if (!Number.isInteger(solved) || solved < 0 || solved >= optionCount) return { kind: 'unusable', reason: 'solved_index' };
  if (solved !== keyIndex || data.agrees_with_key !== true) return { kind: 'disputed', solvedIndex: solved };

  const letters = Array.from({ length: optionCount }, (_, i) => letter(i));
  const keyLetter = letter(keyIndex);
  const breaksRules = (text) => violatesTruthRules(text) || claimsAboutStudent(text) || contradictsKey(text, keyLetter, letters);
  const prepare = (value, cap) => {
    const fitted = fitSentence(cleanRepairText(value), cap);
    return fitted && !breaksRules(fitted) ? fitted : null;
  };
  const dropped = [];
  const repair = { trap_type: TRAP_TYPES.includes(data.trap_type) ? data.trap_type : 'other' };

  for (const field of REQUIRED_V3) {
    const value = prepare(data[field], LIMITS_V3[field]);
    if (!value || value.length < MIN_LENGTH_V3[field]) return { kind: 'unusable', reason: field };
    repair[field] = value;
  }
  for (const field of OPTIONAL_V3) {
    const present = typeof data[field] === 'string' && data[field].trim() !== '';
    const value = present ? prepare(data[field], LIMITS_V3[field]) : null;
    if (value && value.length >= 8) repair[field] = value;
    else if (present) dropped.push(field);
  }
  // A hook that only repeats the rule adds nothing.
  if (repair.memory_hook) {
    const hook = comparable(repair.memory_hook), rule = comparable(repair.rule);
    if (!hook || hook === rule || hook.includes(rule) || rule.includes(hook)) { delete repair.memory_hook; dropped.push('memory_hook'); }
  }

  // Others: all or nothing. Every remaining option exactly once, each line clean.
  const remaining = letters.map((_, i) => i).filter((i) => i !== keyIndex && i !== chosenIndex);
  const given = Array.isArray(data.others) ? data.others : [];
  let others = [];
  if (remaining.length && given.length) {
    const seen = new Set();
    const rows = [];
    let ok = given.length === remaining.length;
    for (const row of ok ? given : []) {
      const index = row?.index;
      const why = prepare(row?.why, LIMITS_V3.others);
      if (!Number.isInteger(index) || !remaining.includes(index) || seen.has(index) || !why || why.length < 8) { ok = false; break; }
      seen.add(index);
      rows.push({ index, why });
    }
    if (ok && seen.size === remaining.length) others = rows.sort((a, b) => a.index - b.index);
    else dropped.push('others');
  } else if (!remaining.length && given.length) dropped.push('others');
  repair.others = others;
  return { kind: 'explained', repair, dropped };
}

/** v3 payloads also answer to the v1 names, for older app builds. The aliases are added on the way out, never stored. */
export function withLegacyAliases(repair) {
  if (!repair || typeof repair !== 'object' || typeof repair.why_right !== 'string') return repair;
  return { ...repair, why_tempting: repair.trap, key_idea: repair.rule };
}

/** Fresh practice on the same chapter, reusing the existing recovery replay route shape. */
export function practiceHref({ subject, chapter, attemptId }) {
  return `/test?${new URLSearchParams({ subject: subject || '', mode: 'quick', count: '5', ...(chapter ? { chapter } : {}), recoveryFrom: attemptId })}`;
}

