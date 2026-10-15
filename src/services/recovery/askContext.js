// Loads the context one question brings to Ask (data/ask_context.js). Dependency-injected like repairCheck.js; the real
// dependencies are buildCheckDeps() (attempt, question and repair-receipt reads).
import { buildAskContext, parseQuestionRef } from '../../../data/ask_context.js';
import { getSubjectById } from '../../../data/subjects.js';
import { mistakeId } from './repairFlow.js';

/** @returns {Promise<{ok:true, context, preview} | {ok:false, http, error, message}>} */
export async function loadQuestionContext({ user, ref, deps }) {
  const parsed = parseQuestionRef(ref);
  if (!parsed) return { ok: false, http: 400, error: 'invalid_question_ref', message: 'That question link was not valid. No credits were used.' };
  const attempt = await deps.loadAttempt(parsed.attemptId).catch(() => null);
  if (!attempt || attempt.userId !== user.id) return { ok: false, http: 404, error: 'not_found', message: 'That session was not found. No credits were used.' };
  const loaded = await deps.loadQuestion(parsed.questionId);
  if (loaded?.error) return { ok: false, http: 503, error: 'question_unavailable', message: 'That question could not be loaded. No credits were used.' };
  let rule = null;
  try {
    const reservation = await deps.findRepairReservation(user.id, mistakeId(user.id, parsed.attemptId, parsed.questionId));
    rule = reservation?.receipt?.repair?.rule ?? null;
  } catch { rule = null; }
  const built = buildAskContext({ attempt, questionId: parsed.questionId, userId: user.id, current: loaded?.data ?? null, repairRule: rule, subjectName: getSubjectById(attempt.subject)?.name || null });
  return built.ok ? built : { ...built, message: `${built.message} No credits were used.` };
}
