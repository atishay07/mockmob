// B13: per-answer practice check. The key is read from the server-held session snapshot and the
// current question row; the client sends only {qid, answer}. A checked answer is final:
// the first check is stored in session_check_log (unique session_id + qid) and later checks
// of the same question return that first result, never a new answer.
//
// Submit-side rule (wired in recoverySessions.finishSession and practiceSessions.finishPractice through
// checkedAnswersForSubmit): the logged answer for a checked qid replaces whatever the client or later
// answer events say.
//
// No 'server-only' import and no alias imports, so node:test can load this file. All I/O goes through
// the injected `db` (a supabase client) and the injected ticket and attempt helpers.
import { answerReview } from '../../../data/answer_corrections.mjs';
import { correctIndexOf } from '../../../data/mistake_repair.js';

export const CHECK_MODES = ['quick', 'smart'];
const text = v => String(v ?? '').replace(/\s+/g, ' ').trim();

const fail = (status, error, message) => Object.assign(new Error(message), { status, code: error });
export const isCheckError = e => !!e && typeof e.status === 'number' && typeof e.code === 'string';
export const checkErrorBody = e => ({ error: e.code, message: e.message });
const UNAVAILABLE = () => fail(503, 'unavailable', 'Checking is unavailable right now.');

/** Decided from the server-held row only. Fresh checks (episode) are scored delayed checks: never revealed. */
export function checkAllowed(row) {
  if (!row || !CHECK_MODES.includes(row.mode)) return false;
  if (row.selection_meta?.episodeId) return false;
  // Only ordinary practice reveals keys. Baseline diagnostics, fresh checks and any other purpose do not.
  const purpose = row.selection_meta?.learningPurpose;
  return purpose === undefined || purpose === null || purpose === 'ordinary_practice';
}

/**
 * Same key rule as the result page (answerReview). Only a current, live, non-withdrawn key with unchanged
 * content is used. Returns {keyIndex, explanation} or {unavailable:true}.
 */
export function resolveKey(snapshotQ, currentQ, { evidenceEligible = false } = {}) {
  const review = answerReview(snapshotQ, currentQ, null, { evidenceEligible });
  if (review === null) {
    const keyIndex = correctIndexOf(snapshotQ);
    if (!Number.isInteger(keyIndex) || keyIndex < 0) return { unavailable: true };
    return { keyIndex, explanation: text(snapshotQ.explanation) || null };
  }
  if (review.state === 'corrected') return { keyIndex: review.currentIndex, explanation: review.explanation || null };
  return { unavailable: true };
}

export function checkResult(keyInfo, answer) {
  return { correct: answer === keyInfo.keyIndex, keyIndex: keyInfo.keyIndex, explanation: keyInfo.explanation };
}

/**
 * For the submit path. `checkedRows` are session_check_log rows ({qid, answer}); the logged answer
 * overrides any other answer for that qid (final answers map and answers rebuilt from events).
 */
export function applyCheckedAnswers(answers, checkedRows) {
  const out = { ...(answers || {}) };
  for (const r of checkedRows || []) out[r.qid] = r.answer;
  return out;
}

export async function loadCheckedAnswers(db, sessionId, userId) {
  const { data, error } = await db.from('session_check_log').select('qid,answer').eq('session_id', sessionId).eq('user_id', userId);
  if (error) throw UNAVAILABLE();
  return data || [];
}

/**
 * Checked answers for the submit path. While SESSION_CHECK_ENABLED is on, a failed read stops the
 * submit (it is retryable) because scoring without the log could accept a changed answer after the
 * key was revealed. While the flag is off no check can be made, so a missing table or a read error
 * is treated as "no checked answers" and any rows logged earlier are still honoured when readable.
 */
export async function checkedAnswersForSubmit(db, sessionId, userId, enabled = process.env.SESSION_CHECK_ENABLED === '1') {
  try {
    return await loadCheckedAnswers(db, sessionId, userId);
  } catch (error) {
    if (enabled) throw new Error('SESSION_SUBMIT_FAILED');
    return [];
  }
}

async function loadSession({ db, userId, sessionId, sessionTicket, openTicket, attemptExists, now }) {
  if (sessionTicket !== undefined && sessionTicket !== null) {
    if (typeof sessionTicket !== 'string' || !openTicket || !attemptExists) throw fail(422, 'invalid_request', 'The session ticket is not valid.');
    let row;
    try { row = openTicket(sessionTicket, userId, now); }
    catch (e) {
      if (e.message === 'SESSION_EXPIRED') throw fail(409, 'session_expired', 'This session has ended.');
      throw fail(404, 'session_not_found', 'That session was not found.');
    }
    if (row.id !== sessionId) throw fail(404, 'session_not_found', 'That session was not found.');
    if (await attemptExists(row.id)) throw fail(409, 'session_closed', 'This session was already submitted.');
    return row;
  }
  const { data: row, error } = await db.from('recovery_sessions').select('*').eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (error) throw UNAVAILABLE();
  if (!row) throw fail(404, 'session_not_found', 'That session was not found.');
  if (row.state !== 'active') throw fail(409, 'session_closed', 'This session was already submitted.');
  return row;
}

/**
 * deps: { db, userId, sessionId, qid, answer, sessionTicket?, openTicket?(ticket,userId,now), attemptExists?(id), eligible?(currentRow), now? }
 * Throws errors with {status, code}; use isCheckError / checkErrorBody to turn them into a response.
 */
export async function checkSessionAnswer(deps) {
  const { db, userId, sessionId, qid, answer } = deps;
  const now = deps.now ?? Date.now();
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 100) throw fail(404, 'session_not_found', 'That session was not found.');
  if (typeof qid !== 'string' || !qid || qid.length > 100 || !Number.isInteger(answer) || answer < 0 || answer > 9)
    throw fail(422, 'invalid_request', 'Send a question id and an answer index.');
  const row = await loadSession({ ...deps, now });
  // Mode gate first, from the server row, before anything about the question is read or revealed.
  if (!checkAllowed(row)) throw fail(403, 'check_not_available', 'Answers are not checked during this kind of session.');
  const question = (row.questions || []).find(q => q.id === qid);
  if (!question) throw fail(422, 'invalid_request', 'That question is not in this session.');
  if (answer >= (question.options || []).length) throw fail(422, 'invalid_request', 'That option does not exist.');

  const { data: first, error: readError } = await db.from('session_check_log').select('answer').eq('session_id', row.id).eq('qid', qid).eq('user_id', userId).maybeSingle();
  if (readError) throw UNAVAILABLE();
  if (!first && Date.parse(row.expires_at) <= now) throw fail(409, 'session_expired', 'This session has ended.');

  const { data: current, error: qError } = await db.from('questions').select('*').eq('id', qid).maybeSingle();
  if (qError) throw UNAVAILABLE();
  const evidenceEligible = deps.eligible ? !!current && !!deps.eligible(current) : false;
  const keyInfo = resolveKey(question, current, { evidenceEligible });
  if (keyInfo.unavailable) throw fail(409, 'question_under_review', 'This question is being re-checked, so it cannot be checked right now. Your answer is not locked.');

  if (first) return checkResult(keyInfo, first.answer);
  const { error: insertError } = await db.from('session_check_log').upsert(
    { session_id: row.id, qid, user_id: userId, answer, checked_at: new Date(now).toISOString() },
    { onConflict: 'session_id,qid', ignoreDuplicates: true });
  if (insertError) throw UNAVAILABLE();
  // A concurrent first check may have won the race: the stored answer is the only truth.
  const { data: stored, error: storedError } = await db.from('session_check_log').select('answer').eq('session_id', row.id).eq('qid', qid).eq('user_id', userId).maybeSingle();
  if (storedError || !stored) throw UNAVAILABLE();
  return checkResult(keyInfo, stored.answer);
}
