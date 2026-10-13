// "Report this AI reply" from the app. Pure validation plus one insert through an injected db
// (a supabase client), so node:test can load this file. The route adds auth and rate limiting.
//
// Payload (POST /api/ai/mentor/report): { reason, reply, sessionId?, requestId? } and an optional
// Idempotency-Key header. The same reply reported twice is one row, per student.
export const MAX_REASON = 120;
export const MAX_REPLY = 1200;
const MAX_ID = 100;
const KEY_RE = /^[A-Za-z0-9:_.-]{8,200}$/;

const clean = v => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
const optionalId = v => (v === undefined || v === null || v === '' ? null : typeof v === 'string' && v.length <= MAX_ID && clean(v) ? clean(v) : false);

/** Returns { ok: true, value } or { ok: false, message }. Never throws. */
export function validateReport(body, idempotencyHeader) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send a reason and the reply.' };
  if (typeof body.reason !== 'string' || !clean(body.reason) || clean(body.reason).length > MAX_REASON) return { ok: false, message: 'Send a reason of up to 120 characters.' };
  if (typeof body.reply !== 'string' || !clean(body.reply)) return { ok: false, message: 'Send the reply being reported.' };
  const sessionId = optionalId(body.sessionId);
  const requestId = optionalId(body.requestId);
  if (sessionId === false) return { ok: false, message: 'That session id is not valid.' };
  if (requestId === false) return { ok: false, message: 'That request id is not valid.' };
  let dedupeKey = null;
  if (typeof idempotencyHeader === 'string' && idempotencyHeader) {
    if (!KEY_RE.test(idempotencyHeader)) return { ok: false, message: 'That idempotency key is not valid.' };
    dedupeKey = idempotencyHeader;
  } else if (requestId) {
    dedupeKey = `ai-report-${requestId}`.slice(0, 200);
    if (!KEY_RE.test(dedupeKey)) dedupeKey = null;
  }
  return { ok: true, value: { reason: clean(body.reason), replyExcerpt: clean(body.reply).slice(0, MAX_REPLY), sessionId, requestId, dedupeKey } };
}

/** Stores one report. A repeat of the same dedupe key is a success that adds nothing. Throws on a db error. */
export async function storeReport(db, userId, value) {
  const row = { user_id: userId, reason: value.reason, reply_excerpt: value.replyExcerpt, session_id: value.sessionId, request_id: value.requestId, dedupe_key: value.dedupeKey };
  const query = value.dedupeKey
    ? db.from('ai_reply_reports').upsert(row, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    : db.from('ai_reply_reports').insert(row);
  const { error } = await query;
  if (error) throw Object.assign(new Error('REPORT_UNAVAILABLE'), { cause: error });
  return { ok: true };
}
