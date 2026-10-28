// Mistake Repair, "try it once more before the key": the words, the server's marking and the client's call.
// Pure logic with the network passed in, so node --test covers it (data/tests/repair_retry.test.mjs). The website
// (src/components/recovery/RepairTry.jsx, MistakeRepair.jsx) and the app (flutter_app review/widgets/retry_first.dart,
// review/copy.dart) say the same words in the same order. App brief: docs/design-decisions/app-practice-review-1016.md 4.
//
// The order of one mistake: the question comes back with no key and no marks; the student picks and presses "Check my
// answer"; the server marks it at once (POST /api/recovery/retry, free, no model, no credit) and the verdict shows in
// words; the reason is then written under it (the repair, 1 AI credit, which carries the same pick as `retry_pick` and
// stores the verdict with the repair); the key explanation, the rule, "Check it held" and "Ask Mobi" follow. "Show the
// reason now" skips the try and writes the reason with no verdict.
//
// The server marks. Nothing on the client decides right or wrong: the key letter that is on the page is only ever
// shown after the verdict, and the verdict comes from the response. The try never changes what counts as repaired and
// never changes the record: it is the student's own check.
export const RETRY_PATH = '/api/recovery/retry';
export const RETRY_TIMEOUT_MS = 12_000;

const LETTERS = 'ABCDEFGH';
const letterOf = (i) => (Number.isInteger(i) && i >= 0 && i < LETTERS.length ? LETTERS[i] : null);

/** The words, the same as the app's ReviewCopy (copy.dart). */
export const RETRY_COPY = Object.freeze({
  title: 'Try it once more before the reason.',
  hint: 'Pick one. Your first answer here counts.',
  check: 'Check my answer',
  checkNeedsPick: 'Check my answer, pick an option first',
  checking: 'Checking your answer.',
  showReasonNow: 'Show the reason now',
  yourPickIn: (source) => `Your pick in ${source || 'this paper'}`,
  yourPickNow: 'Your pick now',
  yourPickAndKey: 'Your pick and the key',
  key: 'Key',
  checkFailed: 'We could not check that answer. Your pick is kept. Try again, or show the reason now.',
  reopenLead: 'Already repaired. Opening it again is free and changes nothing on your record.',
  keyFree: 'The key explanation is free.',
});

/** The reason's cost line under "Check my answer". An unknown balance says nothing about the balance and never counts as zero. */
export function retryCostLine({ balance = null, usesLine }) {
  return usesLine({ what: 'The reason', cost: 1, pool: 'ai', balance });
}

// ---------- Marking (server) ----------

/** The retry pick from a request body: the app sends `retry_pick`, the site may send `retryPick`. Anything but a whole number is no pick. */
export function retryPickOf(body) {
  const raw = body?.retry_pick ?? body?.retryPick;
  return Number.isInteger(raw) ? raw : null;
}

/**
 * Marks one try against the key the repair would use (the paper's own key, data/mistake_repair.js repairEligibility).
 * Returns { ok:false, reason:'invalid_pick' } or { ok:true, retry } where `retry` is what the student's screen may keep:
 * { pick, right, same, keyIndex, chosenIndex }. `same` is true when the pick is the wrong option chosen in the paper.
 */
export function markRetry({ pick, keyIndex, chosenIndex, optionCount }) {
  if (!Number.isInteger(pick) || pick < 0 || pick >= optionCount || pick >= LETTERS.length) return { ok: false, reason: 'invalid_pick' };
  const right = pick === keyIndex;
  return { ok: true, retry: { pick, right, same: !right && pick === chosenIndex, keyIndex, chosenIndex } };
}

/** The stored form on the repair's receipt: the marking and the day it was made. No question text and no key letter beyond the indexes. */
export function retryReceipt(retry, nowMs) {
  return { pick: retry.pick, right: retry.right, same: retry.same, keyIndex: retry.keyIndex, chosenIndex: retry.chosenIndex, at: new Date(nowMs).toISOString() };
}

// ---------- The verdict (screen) ----------

/** 'right' | 'still' | 'different', or null when the marking is missing or incomplete. */
export function retryKind(retry) {
  if (!retry || !Number.isInteger(retry.pick) || !Number.isInteger(retry.keyIndex)) return null;
  if (retry.pick === retry.keyIndex) return 'right';
  const before = retry.chosenIndex;
  return Number.isInteger(before) && retry.pick === before ? 'still' : 'different';
}

/**
 * The verdict in words, never colour alone: { kind, title, line }. Right: "Right this time." Still the same wrong pick:
 * "Still B." with the key and the trap. A different wrong pick: "D this time. The key is C."
 */
export function retryVerdict(retry) {
  const kind = retryKind(retry);
  if (!kind) return null;
  const pick = letterOf(retry.pick);
  const key = letterOf(retry.keyIndex);
  if (kind === 'right') return { kind, title: 'Right this time.', line: 'Here is why it holds.' };
  if (kind === 'still') return { kind, title: pick ? `Still ${pick}.` : 'Still the same pick.', line: key ? `The key is ${key}. Here is the trap.` : 'Here is the trap.' };
  return {
    kind,
    title: pick && key ? `${pick} this time. The key is ${key}.` : 'Not this one.',
    line: key ? `Here is why ${key}.` : 'Here is why.',
  };
}

/**
 * The words each option of a checked try carries, by option index: the key, your pick now, your pick in the paper, and
 * your pick that is also the key. Options with no words are not in the map.
 */
export function retryOptionWords(retry, source) {
  const words = {};
  if (!retry || !Number.isInteger(retry.keyIndex)) return words;
  words[retry.keyIndex] = retry.pick === retry.keyIndex ? RETRY_COPY.yourPickAndKey : RETRY_COPY.key;
  if (Number.isInteger(retry.pick) && retry.pick !== retry.keyIndex) words[retry.pick] = RETRY_COPY.yourPickNow;
  const before = retry.chosenIndex;
  if (Number.isInteger(before) && before !== retry.keyIndex && before !== retry.pick) words[before] = RETRY_COPY.yourPickIn(source);
  return words;
}

/** The Mobi state a try earns: listening while the student chooses, then the verdict's own act. */
export function retryMood(kind) {
  return kind === 'right' ? 'retry_right' : kind === 'still' ? 'retry_still' : kind === 'different' ? 'retry_different' : 'try';
}

// ---------- The call (client) ----------

/**
 * POST one try to be marked and say how it ended:
 *   { kind: 'marked', retry }        the server marked it
 *   { kind: 'declined' }             the server answered but would not mark it (a key under review, a question that is not
 *                                    a mistake): the caller goes on to the repair, which says why in its own words
 *   { kind: 'failed' }               nothing usable came back (offline, timed out, a server error): the pick is kept
 */
export async function requestRetry(fetchImpl, payload, { url = RETRY_PATH, timeoutMs = RETRY_TIMEOUT_MS, schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) } = {}) {
  const controller = new AbortController();
  const timer = schedule(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok && body.retry && retryKind(body.retry)) return { kind: 'marked', retry: body.retry };
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429 && body && typeof body === 'object') return { kind: 'declined' };
    return { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  } finally {
    cancel(timer);
  }
}

// ---------- Revise: the rule comes back with the question ----------

/** The words around a rule carried back onto a Revise card. The rule itself is the student's own, from their repair. */
/**
 * The rule as the Revise answer carries it: { text, hook, day }, or null. `repair` is { rule, hook, repairedAt } from the student's own
 * committed repair of this question; `day` is the day it was made, "Wed 14 Oct" in India time. Nothing is invented: no repair, no rule.
 */
export function reviseRuleBody(repair, dayLabelOf = null) {
  const text = typeof repair?.rule === 'string' ? repair.rule.trim() : '';
  if (!text) return null;
  const hook = typeof repair.hook === 'string' && repair.hook.trim() ? repair.hook.trim() : null;
  const at = Date.parse(repair.repairedAt);
  const day = repair.day ?? (dayLabelOf && Number.isFinite(at) ? dayLabelOf(at) : null);
  return { text: text.slice(0, 600), hook: hook ? hook.slice(0, 300) : null, day: day || null };
}

export const REVISE_RULE_COPY = Object.freeze({
  label: 'Your rule',
  hook: 'To remember it:',
  from: (day) => (day ? `From your repair on ${day}.` : 'From your repair.'),
});
