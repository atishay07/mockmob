export const REPAIR_OUTCOMES = ['explained', 'stored', 'held_for_recheck', 'not_explained'];
export function hasExplanation(status) { return status === 'explained' || status === 'stored'; }
// Failures where trying the same repair again cannot help: this month's student-AI budget is used up, or
// PrepOS paid features are switched off. The server's message says so; the screen offers no retry button.
const NO_RETRY_ERRORS = ['budget_reached', 'user_limit_reached', 'paused'];
// `body` is the parsed failure body. `charged: 0` means the server released the credit and the request id,
// so the next attempt needs a fresh id (a released id only answers `operation_released`).
export function repairRetryPolicy(httpStatus, error, body = null) {
  const resetRequest = error === 'operation_released' || body?.charged === 0;
  const canRetry = !NO_RETRY_ERRORS.includes(error) && (resetRequest || error === 'in_progress' || ![401, 402, 409, 404, 422].includes(httpStatus));
  return { resetRequest, canRetry };
}
export function repairLabel(status) {
  if (hasExplanation(status)) return 'Explanation ready';
  if (status === 'held_for_recheck') return 'Held for review';
  if (status === 'not_explained') return 'No explanation';
  return null;
}
export function repairProgress(mistakes, outcomes) {
  const explained = mistakes.filter(r => hasExplanation(outcomes[r.q.id])).length;
  const handled = new Set(mistakes.filter(r => REPAIR_OUTCOMES.includes(outcomes[r.q.id])).map(r => r.q.id));
  return { explained, held: handled.size - explained, handled, next: mistakes.find(r => !handled.has(r.q.id)) || null };
}

// Key Review: a question whose answer key our own checks could not reproduce. These errors from the
// repair route mean the same thing as a fresh dispute (the question is already being re-checked).
export const KEY_REVIEW_ERRORS = ['question_under_review'];
export function isKeyReview(status, error) { return status === 'held_for_recheck' || KEY_REVIEW_ERRORS.includes(error); }
const LETTERS = 'ABCDEFGH';
const letterOf = (i) => (Number.isInteger(i) && i >= 0 && i < LETTERS.length ? LETTERS[i] : null);
// Who said what, in plain rows. `agree` is only ever true against the key; never presented as proof.
export function keyReviewEvidence({ chosenIndex, keyIndex, dispute } = {}) {
  const rows = [
    { id: 'you', label: 'Your pick', letter: letterOf(chosenIndex) },
    { id: 'key', label: 'Answer key', letter: letterOf(keyIndex) },
  ];
  const first = letterOf(dispute?.ourIndex);
  const second = letterOf(dispute?.secondIndex);
  if (first) rows.push({ id: 'check1', label: 'Our first check', letter: first, agree: dispute.ourIndex === keyIndex });
  if (second) rows.push({ id: 'check2', label: 'Blind second check', letter: second, agree: dispute.secondIndex === keyIndex });
  return rows.filter(r => r.letter);
}

// Repair v2 (REPAIR-LAB-AUDIT-2026-10-14 section 5.3). The trap name is a plain label about the option, never
// about the student. An unknown or missing type falls back to neutral wording instead of a raw code.
export const TRAP_LABELS = {
  partly_true: 'A partly true option',
  reversed: 'The relation turned around',
  look_alike_term: 'A look-alike term',
  missed_not_except: 'A missed NOT or EXCEPT',
  not_in_passage: 'Not in the passage',
  calculation_slip: 'A calculation slip',
  wrong_rule: 'The wrong rule applied',
  one_step_short: 'One step short',
  extreme_word: 'An extreme word',
  assertion_reason_link: 'The assertion and reason link',
  other: 'The trap in this option',
};
export function trapLabel(type) {
  return Object.hasOwn(TRAP_LABELS, type) ? TRAP_LABELS[type] : TRAP_LABELS.other;
}
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const LETTERS_V3 = 'ABCDEFGH';
// One shape for the three payload versions (spec A.1):
//   v3 when `why_right` is present: trap, where it breaks, why the key is right (+ contrast), the other options, the
//      rule with its memory hook, and a second explanation revealed in place. No model "next step": the real practice
//      action is the next step.
//   v2 when only `rule` is present (trap, another way, contrast, rule).
//   v1 otherwise (stored repairs written before v2): why it was tempting, where it breaks, the idea to keep.
// Returns null when the payload cannot be shown in full, so the screen asks for a retry instead of half a repair.
export function repairBlocks(repair) {
  if (!repair || typeof repair !== 'object') return null;
  if (text(repair.why_right) !== null) {
    const tempting = text(repair.trap) ?? text(repair.why_tempting);
    const wrong = text(repair.why_wrong);
    const right = text(repair.why_right);
    const rule = text(repair.rule) ?? text(repair.key_idea);
    if (!tempting || !wrong || !right || !rule) return null;
    const others = (Array.isArray(repair.others) ? repair.others : [])
      .filter((o) => Number.isInteger(o?.index) && o.index >= 0 && o.index < LETTERS_V3.length && text(o?.why))
      .sort((a, b) => a.index - b.index)
      .filter((o, i, list) => i === 0 || list[i - 1].index !== o.index)
      .map((o) => ({ letter: LETTERS_V3[o.index], why: text(o.why) }));
    return {
      version: 3,
      heading: trapLabel(repair.trap_type),
      tempting,
      wrong,
      right,
      contrast: text(repair.contrast),
      others,
      rule,
      hook: text(repair.memory_hook),
      anotherWay: text(repair.another_way),
      nextStep: null,
    };
  }
  const v2 = text(repair.rule) !== null;
  if (v2) {
    const tempting = text(repair.trap) ?? text(repair.why_tempting);
    const wrong = text(repair.why_wrong);
    if (!tempting || !wrong) return null;
    return {
      version: 2,
      heading: trapLabel(repair.trap_type),
      tempting,
      wrong,
      anotherWay: text(repair.another_way),
      contrast: text(repair.contrast),
      rule: text(repair.rule),
      nextStep: text(repair.next_step),
    };
  }
  const tempting = text(repair.why_tempting), wrong = text(repair.why_wrong), rule = text(repair.key_idea);
  if (!tempting || !wrong || !rule) return null;
  return { version: 1, heading: null, tempting, wrong, anotherWay: null, contrast: null, rule, nextStep: text(repair.next_step) };
}

// The chip under the heading. The call is told the key before it explains, so this says "explained from", never
// "checked against": agreement with the key is not proof.
export function checkChip(letter) {
  return letter ? `Explained from the answer key (${letter}).` : 'Explained from the answer key.';
}

// Section words the screen lays out itself (every personal sentence comes finished from the server).
export const REPAIR_COPY = Object.freeze({
  fallbackHeading: 'Mistake Repair',
  whyLooked: (pick) => `Why ${pick || 'your answer'} looked right`,
  whereBreaks: 'Where it breaks',
  whyRight: (key) => (key ? `Why ${key} is right` : 'Why the key is right'),
  otherOptions: 'The other options',
  otherOptionsCount: (n) => `The other options (${n})`,
  keepThis: 'Keep this',
  toRemember: 'To remember it:',
  explainAnother: 'Explain it another way',
  anotherWay: 'Another way to see it',
  fromRecord: 'From your record',
  doThisNext: 'Do this next',
  practise: (chapter) => (chapter ? `Practise 5 on ${chapter}` : 'Practise 5 on this chapter'),
});

// Loading (spec A.8): one line that changes on real elapsed time, never a timer pretending to be stages.
export const REPAIR_LOADING = Object.freeze({
  slowAfterMs: 8000,
  longAfterMs: 45000,
  writing: (number) => (Number.isInteger(number) ? `Writing the repair for Q${number}.` : 'Writing the repair.'),
  slow: 'Still writing. You are charged only if it arrives.',
  long: 'Taking longer than usual. Still trying.',
});
export function repairLoadingLine(elapsedMs, number = null) {
  if (elapsedMs >= REPAIR_LOADING.longAfterMs) return REPAIR_LOADING.long;
  if (elapsedMs >= REPAIR_LOADING.slowAfterMs) return REPAIR_LOADING.slow;
  return REPAIR_LOADING.writing(number);
}

// "From your record": the server's finished sentences for this answer, then the pattern line. Nothing is written here.
export function recordLines(insights, pattern) {
  const lines = (Array.isArray(insights?.lines) ? insights.lines : []).map((l) => text(l?.text)).filter(Boolean);
  const patternLine = text(pattern?.line);
  return patternLine ? [...lines, patternLine] : lines;
}

// What one wrong answer cost in this session, from the marking scheme alone (free, past tense, no forecast).
// Only schemes we know exactly are described; anything else returns null and the line is not shown.
const SCHEMES = { cuet: { right: 5, wrong: -1 } };
export function marksAtStake(scheme) {
  const s = SCHEMES[scheme];
  if (!s) return null;
  const penalty = Math.abs(s.wrong);
  const total = s.right + penalty;
  return {
    total, notEarned: s.right, penalty,
    line: penalty
      ? `This answer cost ${total} marks in this session: ${s.right} not earned and ${penalty} penalty.`
      : `This answer cost ${total} marks in this session: ${s.right} not earned.`,
  };
}

// The folded question once a repair is on screen: "Q7. Your pick B. Key C." Parts that are unknown are left out.
export function foldedQuestionLine({ number, chosen, answer } = {}) {
  return [Number.isInteger(number) ? `Q${number}.` : null, chosen ? `Your pick ${chosen}.` : null, answer ? `Key ${answer}.` : null].filter(Boolean).join(' ');
}

// Which reaction the companion shows for a repair state. Success only after the server acknowledged it.
export function repairMood(status, { slow = false, settledFor = 0 } = {}) {
  if (status === 'loading') return slow ? 'loading' : 'think';
  if (status === 'explained') return 'correct';
  if (status === 'stored') return 'hello';
  if (status === 'error' || status === 'waiting') return settledFor < 1400 ? 'oops' : 'encourage';
  if (status === 'not_explained' || status === 'held_for_recheck' || status === 'answer_review') return 'rest';
  return null;
}
