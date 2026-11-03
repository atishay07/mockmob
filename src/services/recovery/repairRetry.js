// Mistake Repair, the try before the key: the server marks one pick against the key the repair itself would use. Every
// dependency is injected (no 'server-only', no alias imports), like repairCheck.js, so data/tests/repair_retry.test.mjs
// runs it over fakes. The route is src/app/api/recovery/retry/route.js.
//
// Free: no credit is reserved, charged or released, no model is called and nothing is written. The paid repair carries
// the same pick (`retry_pick`) and stores the marking on its receipt; this call exists so the verdict shows at once,
// not after the reason has been written, and so the verdict never depends on a credit.
import { repairEligibility } from '../../../data/mistake_repair.js';
import { markRetry } from '../../../data/repair_retry.mjs';

const out = (http, body) => ({ http, body });
const ID_LIMIT = 160;
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= ID_LIMIT;

/** POST: marks one try. Returns { http, body }; body.retry is { pick, right, same, keyIndex, chosenIndex } when marked. */
export async function markRetryAnswer({ user, attemptId, questionId, pick, deps }) {
  if (!validId(attemptId) || !validId(questionId)) return out(422, { ok: false, error: 'invalid_request', message: 'That request was incomplete.', charged: 0 });
  const attempt = await deps.loadAttempt(attemptId).catch(() => null);
  const loaded = await deps.loadQuestion(questionId).catch(() => ({ error: true }));
  if (loaded?.error) return out(503, { ok: false, error: 'question_unavailable', message: 'This question could not be loaded.', charged: 0 });
  const eligible = repairEligibility({ attempt, questionId, userId: user.id, current: loaded?.data ?? null });
  if (!eligible.ok) return out(eligible.http, { ok: false, error: eligible.code, message: eligible.message, charged: 0 });
  const marked = markRetry({ pick, keyIndex: eligible.keyIndex, chosenIndex: eligible.chosenIndex, optionCount: eligible.question.options.length });
  if (!marked.ok) return out(422, { ok: false, error: 'invalid_pick', message: 'Pick one of the options.', charged: 0 });
  return out(200, { ok: true, status: 'marked', charged: 0, retry: marked.retry });
}
