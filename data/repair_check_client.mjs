// Mistake Repair, the check, client side: how the fresh question is asked for, answered and shown. Pure logic with the
// network passed in, so node --test covers it (data/tests/repair_check_client.test.mjs). The component is
// src/components/recovery/RepairCheck.jsx; the routes are src/app/api/recovery/check/route.js (contract:
// data/tests/fixtures/repair4/contract_check_v1.json).
//
// The check is part of the repair the student already paid for: nothing here spends a credit and no model is called. Every
// sentence about the answer (the outcome line, the explanation, the key) comes finished from the server; this file only
// lays out what the screen says around it and what each failure means.

export const CHECK_GET_TIMEOUT_MS = 12_000;
export const CHECK_POST_TIMEOUT_MS = 15_000;
export const CHECK_REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;
const LETTERS = 'ABCD';

export const CHECK_COPY = Object.freeze({
  title: 'Check it held',
  lead: 'One new question on the same idea. It comes with this repair, so there is no extra credit.',
  loading: 'Finding a question you have not seen.',
  submit: 'Check my answer',
  marking: 'Marking your answer',
  firstCounts: 'Your first answer counts.',
  retryLoad: 'Try again',
  retryMark: 'Try again',
  another: 'Get another question',
  answeredEarlier: 'You answered this check earlier. The first answer counts.',
  explanation: 'Explanation',
  yourRule: 'Your rule',
  reviseLabel: 'Revise',
  ask: 'Ask Mobi about this question',
  askSees: 'Mobi sees this question, your pick, the key and your rule, and nothing else about you.',
  askCost: 'One written reply',
  loadFailed: 'The question could not be loaded. Nothing was charged.',
  markFailed: 'We could not confirm the marking. Try again: the same request is reused, so your answer counts once.',
  needPick: 'Pick one of the four options.',
});

// The repair response's `check.reason` codes (data/repair_check.js CHECK_REASONS) where trying again can help.
const RETRYABLE_REASONS = Object.freeze(['lookup_failed', 'check_unavailable']);
const FALLBACK_REASON_MESSAGE = 'The check is not available right now. Nothing was charged.';

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** One request id per student action, in the pattern the route accepts. Reused on a retry so an answer counts once. */
export function newCheckRequestId(random = () => Math.random().toString(36).slice(2), uuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  const raw = (uuid ? uuid() : `${Date.now().toString(36)}${random()}${random()}`).replace(/[^A-Za-z0-9_-]/g, '');
  return raw.slice(0, 40).padEnd(16, '0');
}

export const checkHref = (attemptId, questionId) => `/api/recovery/check?attemptId=${encodeURIComponent(attemptId)}&questionId=${encodeURIComponent(questionId)}`;
export const askHrefFor = (attemptId, questionId) => `/mentor?tab=ask&q=${encodeURIComponent(attemptId)}:${encodeURIComponent(questionId)}`;
/** The server sends relative links; anything else (an absolute URL, another path) is ignored and the link is built from the ids. */
export const safeCheckHref = (value, attemptId, questionId) => (typeof value === 'string' && value.startsWith('/api/recovery/check?') ? value : checkHref(attemptId, questionId));
export const safeAskHref = (value, attemptId, questionId) => (typeof value === 'string' && value.startsWith('/mentor?tab=ask&q=') ? value : askHrefFor(attemptId, questionId));

/**
 * What the repair response's `check` field means for the screen. No `check` (a held or unexplained repair, or an older
 * server) shows nothing at all. `ready` and `answered` ask the server for the question or the stored answer; `none` and
 * `unchecked` show the reason as it came, with a retry only where trying again can help.
 */
export function checkAvailability(check) {
  if (!check || typeof check !== 'object') return { show: false };
  const status = check.status;
  if (status === 'ready' || status === 'answered') return { show: true, mode: 'load' };
  if (status === 'none' || status === 'unchecked') {
    const reason = text(check.reason);
    return { show: true, mode: 'message', reason, message: text(check.message) || FALLBACK_REASON_MESSAGE, canRetry: !!reason && RETRYABLE_REASONS.includes(reason) };
  }
  return { show: false };
}

/** "7 of the 41 questions in this chapter are new to you." Both numbers or no line: a count never stands without its total. */
export function poolLine(pool) {
  const unseen = pool?.unseen;
  const total = pool?.ofChapter;
  if (!Number.isInteger(unseen) || !Number.isInteger(total) || unseen < 0 || total < unseen || total < 1) return null;
  return `${unseen} of the ${total} questions in this chapter ${unseen === 1 ? 'is' : 'are'} new to you.`;
}

/** The Revise sentence under an answer. Nothing when Revise could not be written: it never promises a card that does not exist. */
export function reviseLine(revise, right) {
  if (!revise || revise.scheduled !== true) return null;
  const label = text(revise.whenLabel);
  const when = !label ? 'soon' : label === 'tomorrow' ? 'tomorrow' : `on ${label}`;
  // A missed check already says when ("It is in Revise tomorrow", from the server), so this line adds only which cards.
  // The screen puts the word "Revise" in front of this sentence as its label.
  return right
    ? `This mistake comes back ${when}.`
    : 'This mistake and the question you just missed both come back.';
}

/** The tag on an answered option row. Sentence case, never colour alone. */
export function optionTag({ isKey, isPick }) {
  if (isKey && isPick) return 'Your pick and the key';
  if (isKey) return 'Key';
  if (isPick) return 'Your pick';
  return null;
}

/** The rows of an answered check, in the order the student saw them: one object per option with its state and tag. */
export function answeredRows(check, result) {
  const source = Array.isArray(result?.options) && result.options.length ? result.options : Array.isArray(check?.options) ? check.options : [];
  const keyIndex = Number.isInteger(result?.key?.index) ? result.key.index : null;
  const pickIndex = Number.isInteger(result?.pick) ? result.pick : null;
  return source.map((o, i) => {
    const index = Number.isInteger(o?.index) ? o.index : i;
    const isKey = typeof o?.isKey === 'boolean' ? o.isKey : index === keyIndex;
    const isPick = typeof o?.isPick === 'boolean' ? o.isPick : index === pickIndex;
    return { index, letter: LETTERS[index] || String(index + 1), text: text(o?.text) || 'Option', isKey, isPick, state: isKey ? 'key' : isPick ? 'mine' : null, tag: optionTag({ isKey, isPick }) };
  });
}

/** The rows of an open check: the options as sent, lettered A to D. */
export function openRows(check) {
  return (Array.isArray(check?.options) ? check.options : []).map((o, i) => {
    const index = Number.isInteger(o?.index) ? o.index : i;
    return { index, letter: LETTERS[index] || String(index + 1), text: text(o?.text) || 'Option' };
  });
}

/** Is this a well-formed open question: a stem and exactly four options. Half a question is never shown. */
export function isShowableCheck(check) {
  return !!check && typeof check === 'object' && !!text(check.checkQuestionId) && !!text(check.question) && Array.isArray(check.options) && check.options.length === 4 && check.options.every((o) => text(o?.text));
}

/** An answered result the screen can show: a verdict, the key, and the four rows. */
export function isShowableResult(result) {
  return !!result && typeof result === 'object' && typeof result.right === 'boolean' && !!text(result.line) && Number.isInteger(result?.key?.index) && Array.isArray(result.options) && result.options.length === 4;
}

async function send(fetchImpl, url, init, timeoutMs, { schedule = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = schedule(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return timedOut ? { kind: 'timeout' } : { kind: 'response', res, body };
  } catch {
    return { kind: timedOut ? 'timeout' : 'network' };
  } finally {
    cancel(timer);
  }
}

/** GET the check: { kind: 'response', res, body } | { kind: 'timeout' } | { kind: 'network' }. Never throws. */
export function requestCheck(fetchImpl, href, opts = {}) {
  return send(fetchImpl, href, { method: 'GET', cache: 'no-store' }, opts.timeoutMs ?? CHECK_GET_TIMEOUT_MS, opts);
}

/** POST the answer. The same `requestId` on a retry: the server stores the first answer and returns it again. */
export function submitCheck(fetchImpl, payload, opts = {}) {
  return send(fetchImpl, '/api/recovery/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, opts.timeoutMs ?? CHECK_POST_TIMEOUT_MS, opts);
}

/**
 * What the screen shows after GET. States: 'ready' (a question), 'answered' (the stored answer), 'none' (a plain reason),
 * 'error' (the call did not give an answer either way). Every failure says nothing was charged: nothing ever is.
 */
export function planCheckLoad(outcome) {
  if (outcome?.kind !== 'response') return { state: 'error', message: CHECK_COPY.loadFailed, canRetry: true };
  const { res, body } = outcome;
  const message = text(body?.message);
  if (res.ok && body?.ok) {
    if (body.status === 'ready' && isShowableCheck(body.check)) return { state: 'ready', check: body.check };
    if (body.status === 'answered' && isShowableCheck(body.check) && isShowableResult(body.result)) return { state: 'answered', check: body.check, result: body.result, replayed: true };
    if (body.status === 'none') {
      const reason = text(body.reason);
      return { state: 'none', reason, message: message || FALLBACK_REASON_MESSAGE, pool: body.pool ?? null, canRetry: !!reason && RETRYABLE_REASONS.includes(reason) };
    }
    return { state: 'error', message: CHECK_COPY.loadFailed, canRetry: true };
  }
  if (body?.status === 'none' || body?.reason === 'lookup_failed') {
    const reason = text(body.reason) || text(body.error);
    return { state: 'none', reason, message: message || FALLBACK_REASON_MESSAGE, pool: null, canRetry: !!reason && RETRYABLE_REASONS.includes(reason) };
  }
  if (res.status === 429) return { state: 'error', message: message || 'Please wait a moment before the next check.', canRetry: true };
  if (res.status === 401 || res.status === 404 || res.status === 409 || res.status === 422) return { state: 'none', reason: text(body?.error), message: message || FALLBACK_REASON_MESSAGE, pool: null, canRetry: false };
  return { state: 'error', message: message || CHECK_COPY.loadFailed, canRetry: true };
}

/**
 * What the screen shows after POST. 'answered' carries the stored result (`replayed` when it was already stored). A failure
 * keeps the question and the student's pick on screen: `refetch` asks for a new question (the old one is no longer
 * offered), `canRetry` offers the same answer again with the same request id.
 */
export function planCheckAnswer(outcome) {
  if (outcome?.kind !== 'response') return { state: 'error', message: CHECK_COPY.markFailed, canRetry: true, refetch: false };
  const { res, body } = outcome;
  const message = text(body?.message);
  if (res.ok && body?.ok && body.status === 'answered' && isShowableResult(body.result)) return { state: 'answered', result: body.result, replayed: body.replayed === true };
  const error = text(body?.error);
  if (error === 'check_changed') return { state: 'error', message: message || 'That question is no longer available for the check. Open it again to get a new one.', canRetry: false, refetch: true };
  if (error === 'invalid_pick') return { state: 'error', message: message || CHECK_COPY.needPick, canRetry: true, refetch: false };
  if (error === 'repair_first') return { state: 'error', message: message || 'The check comes with the repair. Explain this mistake first.', canRetry: false, refetch: false };
  if (res.status === 429) return { state: 'error', message: message || 'Please wait a moment before the next check.', canRetry: true, refetch: false };
  if (res.status === 401 || res.status === 404 || res.status === 422) return { state: 'error', message: message || CHECK_COPY.markFailed, canRetry: false, refetch: false };
  return { state: 'error', message: message || CHECK_COPY.markFailed, canRetry: true, refetch: false };
}
