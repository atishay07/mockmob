// Options a student has crossed out (18 Nov 2026, lane runner): MockMob style only. Pure: the runner
// (src/app/(app)/test/TestPageClient.jsx) keeps the state and its own sessionStorage entry; this file says what a cross-out does.
//
// The look is a student's pencil mark and nothing else. It lives for the paper in this tab, in its OWN sessionStorage entry keyed
// by the paper (its generation key, or the session a resume link names), so a reload of the same paper keeps it. It never enters
// the answer draft, is never sent anywhere, and never changes what is saved, scored or resumed: this file does not import the
// draft module and has no answer in it. An answer never changes through it either: crossing out the chosen answer is refused,
// and choosing a crossed-out option (with the tool off) brings it back. Storage that cannot be read or written leaves it in memory.
//
// State: { [questionId]: [option index, ...] } (ascending, no repeats), never mutated: every change returns a new object.

export const CROSS_OUT_PREFIX = 'mm:crossout:v1:';
/** The size cap: more questions than any paper has, five options, a sane question id, and the stored entry's length. */
export const CROSS_OUT_LIMITS = Object.freeze({ questions: 200, options: 5, idLength: 120, bytes: 16000 });
export const NO_CROSS_OUTS = Object.freeze({});
/** The words for a refusal and for the tool being on (on screen under the options). */
export const CROSS_OUT_WORDS = Object.freeze({
  on: 'Tap an option to cross it out. Tap it again to bring it back.',
  refused: 'That is your chosen answer. Choose another option first.',
});

const validId = (qid) => typeof qid === 'string' && qid.length > 0 && qid.length <= CROSS_OUT_LIMITS.idLength;
const validOption = (option, count) => Number.isInteger(option) && option >= 0 && option < Math.min(count, CROSS_OUT_LIMITS.options);
const isState = (state) => !!state && typeof state === 'object' && !Array.isArray(state);

/**
 * The paper's own entry for this student: one per student and paper, so a second paper never shows the first one's marks, and
 * neither does another student's paper with the same key in the same tab (a Sunday Mock's key is the same for everyone that
 * week; review, 18 Nov). Null without a student or a paper key (the marks then stay in the page).
 */
export function crossOutKey({ userId, generationKey, sessionId } = {}) {
  const id = sessionId ? `s.${sessionId}` : generationKey ? `g.${generationKey}` : '';
  return userId && id ? `${CROSS_OUT_PREFIX}${userId}:${id}` : null;
}

/** The options crossed out on a question, ascending. */
export function crossedOn(state, qid) {
  const list = isState(state) && Array.isArray(state[qid]) ? state[qid] : [];
  return list;
}
export const isCrossedOut = (state, qid, option) => crossedOn(state, qid).includes(option);

function withList(state, qid, list) {
  const next = { ...(isState(state) ? state : {}) };
  if (list.length) next[qid] = list; else delete next[qid];
  return next;
}

/**
 * Cross an option out, or bring it back. `chosen` is the question's saved answer (undefined for none); `optionCount` how many
 * options it has. Outcomes:
 *   'crossed'  the option is crossed out now
 *   'restored' it was crossed out and is back
 *   'refused'  it is the chosen answer: nothing changes (the answer is never touched here)
 *   'ignored'  not an option of this question, no question, or the cap is reached: nothing changes
 */
export function toggleCrossOut(state, qid, option, { chosen, optionCount = 0 } = {}) {
  const base = isState(state) ? state : NO_CROSS_OUTS;
  if (!validId(qid) || !validOption(option, optionCount)) return { state: base, outcome: 'ignored' };
  const list = crossedOn(base, qid);
  if (list.includes(option)) return { state: withList(base, qid, list.filter((o) => o !== option)), outcome: 'restored' };
  if (chosen === option) return { state: base, outcome: 'refused' };
  if (!list.length && Object.keys(base).length >= CROSS_OUT_LIMITS.questions) return { state: base, outcome: 'ignored' };
  return { state: withList(base, qid, [...list, option].sort((a, b) => a - b)), outcome: 'crossed' };
}

/** Choosing an option brings it back: the same state when it was not crossed out. */
export function bringBack(state, qid, option) {
  const base = isState(state) ? state : NO_CROSS_OUTS;
  const list = crossedOn(base, qid);
  return list.includes(option) ? withList(base, qid, list.filter((o) => o !== option)) : base;
}

/** The entry's text, or null when there is nothing to keep (the entry is then removed). Capped: never more than the limits. */
export function serialiseCrossOut(state) {
  if (!isState(state)) return null;
  const kept = {};
  let n = 0;
  for (const [qid, list] of Object.entries(state)) {
    if (n >= CROSS_OUT_LIMITS.questions) break;
    if (!validId(qid) || !Array.isArray(list)) continue;
    const options = [...new Set(list.filter((o) => validOption(o, CROSS_OUT_LIMITS.options)))].sort((a, b) => a - b);
    if (!options.length) continue;
    kept[qid] = options; n += 1;
  }
  if (!n) return null;
  const text = JSON.stringify({ v: 1, q: kept });
  return text.length <= CROSS_OUT_LIMITS.bytes ? text : null;
}

/**
 * The state kept for this paper, read back. Anything not understood is dropped: a broken entry, a question not on this paper
 * (when `questions` is given), an option the question does not have, and its chosen answer (`answers`), which is never shown
 * crossed out.
 */
export function parseCrossOut(raw, { questions = null, answers = null } = {}) {
  if (typeof raw !== 'string' || !raw || raw.length > CROSS_OUT_LIMITS.bytes) return NO_CROSS_OUTS;
  let data;
  try { data = JSON.parse(raw); } catch { return NO_CROSS_OUTS; }
  if (!isState(data) || data.v !== 1 || !isState(data.q)) return NO_CROSS_OUTS;
  const counts = Array.isArray(questions) ? new Map(questions.filter((q) => q?.id).map((q) => [q.id, Array.isArray(q.options) ? q.options.length : 0])) : null;
  const out = {};
  let n = 0;
  for (const [qid, list] of Object.entries(data.q)) {
    if (n >= CROSS_OUT_LIMITS.questions) break;
    if (!validId(qid) || !Array.isArray(list) || (counts && !counts.has(qid))) continue;
    const count = counts ? counts.get(qid) : CROSS_OUT_LIMITS.options;
    const chosen = isState(answers) ? answers[qid] : undefined;
    const options = [...new Set(list.filter((o) => validOption(o, count) && o !== chosen))].sort((a, b) => a - b);
    if (!options.length) continue;
    out[qid] = options; n += 1;
  }
  return n ? out : NO_CROSS_OUTS;
}

/**
 * The cross-out entries to remove from a list of storage keys: every other paper's when a paper opens (`keep` is its key), and
 * every one when a paper ends (`keep` null). Keys that are not cross-out entries are never named.
 */
export function crossOutKeysToClear(keys, { keep = null } = {}) {
  return (Array.isArray(keys) ? keys : []).filter((key) => typeof key === 'string' && key.startsWith(CROSS_OUT_PREFIX) && key !== keep);
}
