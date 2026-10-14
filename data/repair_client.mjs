// Mistake Repair, client side: how one repair request is sent and how each way it can fail is shown.
// Pure logic with the network and the clock passed in, so node --test covers it. The website component
// (src/components/recovery/MistakeRepair.jsx) and the app's repair client behave the same way.
//
// The server works to a 90 s route budget and finishes all model work by about 78 s (see
// src/services/recovery/repairFlow.js and data/repair_failures.js). The client waits 5 s longer than the
// route, then stops waiting. Every failure body the server sends for a repair it did not deliver carries
// `charged: 0` and a student-ready `message`.
import { repairRetryPolicy } from './repair_presentation.mjs';

export const REPAIR_CLIENT_TIMEOUT_MS = 95_000;
export const REPAIR_TIMEOUT_MESSAGE = 'This took too long. You were not charged.';
export const REPAIR_NETWORK_MESSAGE = 'The connection dropped. Try again: the same request is reused, so you are never charged twice.';
export const REPAIR_UNCONFIRMED_MESSAGE = 'We could not confirm the repair result. Try again.';

const serverMessage = (body) => (typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : null);

/**
 * POST one repair request and say how it ended: { kind: 'response', res, body } when the server answered,
 * { kind: 'timeout' } when nothing came back within `timeoutMs` (the request is aborted), or
 * { kind: 'network' } when the connection failed first. Reading the body is inside the same time limit.
 */
export async function requestRepair(fetchImpl, url, payload, {
  timeoutMs = REPAIR_CLIENT_TIMEOUT_MS,
  schedule = (fn, ms) => setTimeout(fn, ms),
  cancel = (id) => clearTimeout(id),
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = schedule(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const body = await res.json().catch(() => null);
    return timedOut ? { kind: 'timeout' } : { kind: 'response', res, body };
  } catch {
    return { kind: timedOut ? 'timeout' : 'network' };
  } finally {
    cancel(timer);
  }
}

/**
 * What to show after a repair request that did not deliver a repair (the caller handles a delivered repair,
 * an answer-key review and a held question first). Returns the panel state, the message, whether to offer
 * another try, and whether that try needs a FRESH request id.
 *
 * - The server's own `message` is always shown when it sent one, never a generic line in its place.
 * - After a failure body with `charged: 0` the request is released on the server, so the next try must use
 *   a fresh id; reusing it would only hit `operation_released` and waste a click.
 * - A timeout or a dropped connection has no body, so the same id is kept: the server answers a repeated
 *   id with the earlier result or `in_progress`, never a second charge.
 */
export function planRepairFailure(outcome) {
  if (outcome?.kind === 'timeout') return { status: 'error', message: REPAIR_TIMEOUT_MESSAGE, canRetry: true, resetRequest: false };
  if (outcome?.kind === 'network') return { status: 'error', message: REPAIR_NETWORK_MESSAGE, canRetry: true, resetRequest: false };
  const { res, body } = outcome || {};
  const error = body?.error;
  const retry = repairRetryPolicy(res?.status, error, body);
  const fallback = error === 'provider_timeout' ? REPAIR_TIMEOUT_MESSAGE : REPAIR_UNCONFIRMED_MESSAGE;
  return { status: error === 'in_progress' ? 'waiting' : 'error', message: serverMessage(body) || fallback, canRetry: retry.canRetry, resetRequest: retry.resetRequest };
}
