// "Report this AI reply" from the app (Google Play generative-AI policy). Pure rules plus an injected
// handler, so node:test can load this file (it imports nothing server-only). The route adds the real
// auth, rate limit and database.
//
// Payload (POST /api/ai/mentor/report): { reason, reply, requestId, sessionId? }.
//   reason     one of the four reasons the app offers (its label, or the code below). Anything else is refused.
//   reply      the text being reported, cut to MAX_REPLY characters.
//   requestId  the id the app sent with the chat request that produced the reply (16 to 64 of A-Z a-z 0-9 _ -).
//              The server accepts a report only for a reply this student really received: the stored
//              assistant message, or the committed credit operation, for `prepos:<user>:<requestId>`.
// The same reply reported twice is one row per student (the dedupe key comes from the request id; an
// Idempotency-Key header is ignored, so varying it can never add rows). Write-only: nothing here reads reports.

export const MAX_REPLY = 1200;
export const MAX_ID = 100;
export const MAX_BODY_CHARS = 8000;
const REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;

// Code stored in the table, and the label the app shows for it (flutter InsightsCopy.reportReasons).
export const REPORT_REASONS = Object.freeze({
  wrong_about_record: 'It is wrong about my record',
  wrong_about_subject: 'It is wrong about the subject',
  unsafe_or_unkind: 'It is unsafe or unkind',
  other: 'Something else',
});

// Two windows: a burst guard and a daily ceiling. Both are per student (and per network address).
export const REPORT_LIMITS = Object.freeze([
  Object.freeze({ route: '/api/ai/mentor/report', limit: 10, windowMs: 60_000 }),
  Object.freeze({ route: '/api/ai/mentor/report:day', limit: 40, windowMs: 86_400_000 }),
]);

const clean = (v) => String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
const norm = (v) => clean(v).toLowerCase().replace(/\s+/g, ' ');
const BY_TEXT = new Map(Object.entries(REPORT_REASONS).flatMap(([code, label]) => [[code, code], [norm(label), code]]));

/** The reason code for what the app sent, or null when it is not on the list. */
export function reasonCode(value) {
  return typeof value === 'string' && value.length <= 200 ? BY_TEXT.get(norm(value)) || null : null;
}

/** The same key the chat route uses for the student's model request. Null when the id is not valid. */
export function operationKeyFor(userId, requestId) {
  if (!userId || !REQUEST_ID.test(String(requestId || ''))) return null;
  return `prepos:${userId}:${requestId}`.slice(0, 160);
}

/** Returns { ok: true, value } or { ok: false, message }. Never throws. */
export function validateReport(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, message: 'Send a reason, the reply and its request id.' };
  const reason = reasonCode(body.reason);
  if (!reason) return { ok: false, message: 'Choose one of the listed reasons.' };
  if (typeof body.reply !== 'string' || !clean(body.reply)) return { ok: false, message: 'Send the reply being reported.' };
  if (typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)) return { ok: false, message: 'Send the request id of the reply.' };
  let sessionId = null;
  if (body.sessionId !== undefined && body.sessionId !== null && body.sessionId !== '') {
    if (typeof body.sessionId !== 'string' || body.sessionId.length > MAX_ID || !clean(body.sessionId)) return { ok: false, message: 'That session id is not valid.' };
    sessionId = clean(body.sessionId);
  }
  return {
    ok: true,
    value: { reason, replyExcerpt: clean(body.reply).slice(0, MAX_REPLY), sessionId, requestId: body.requestId, dedupeKey: `ai-report-${body.requestId}` },
  };
}

/**
 * Did this student receive a model reply for this request? Owner-bound both ways, so a request id taken
 * from someone else's reply finds nothing. Returns { found, text, sessionId } and throws only on a db error.
 * The stored text wins over what the phone sent, so a report always quotes what the student was shown.
 */
export async function findReceivedReply(db, userId, requestId) {
  const key = operationKeyFor(userId, requestId);
  if (!key) return { found: false };
  const msg = await db.from('mentor_messages').select('content, session_id')
    .eq('user_id', userId).eq('role', 'assistant').eq('structured_payload->>origin', 'model').eq('structured_payload->charge->>reference', key).limit(1).maybeSingle();
  if (msg.error) throw Object.assign(new Error('REPORT_LOOKUP_FAILED'), { cause: msg.error });
  if (msg.data) return { found: true, text: typeof msg.data.content === 'string' ? msg.data.content : null, sessionId: msg.data.session_id || null };
  // The message is saved on a best-effort basis; a committed credit operation is the student's receipt too.
  const op = await db.from('ai_credit_reservations').select('state')
    .eq('user_id', userId).eq('operation_key', key).eq('state', 'committed').limit(1).maybeSingle();
  if (op.error) throw Object.assign(new Error('REPORT_LOOKUP_FAILED'), { cause: op.error });
  return op.data ? { found: true, text: null, sessionId: null } : { found: false };
}

/** Stores one report. A repeat of the same dedupe key is a success that adds nothing. Throws on a db error. */
export async function storeReport(db, userId, value) {
  const row = { user_id: userId, reason: value.reason, reply_excerpt: value.replyExcerpt, session_id: value.sessionId, request_id: value.requestId, dedupe_key: value.dedupeKey };
  const { error } = await db.from('ai_reply_reports').upsert(row, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true });
  if (error) throw Object.assign(new Error('REPORT_UNAVAILABLE'), { cause: error });
  return { ok: true };
}

const NO_STORE = { 'Cache-Control': 'no-store' };
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...NO_STORE, ...headers } });

/**
 * The whole request, with every outside thing injected:
 *   authenticate(request) -> user id or null
 *   rateLimit(request, userId) -> { allowed, headers } (one verdict covering every window)
 *   db() -> a supabase service client
 * Order: signed in, within the limits, a small valid body, a reply this student received, then one write.
 */
export async function handleReportPost(request, { authenticate, rateLimit, db }) {
  const userId = await authenticate(request);
  if (!userId) return json(401, { error: 'unauthorized', message: 'Please sign in.' });
  const limit = await rateLimit(request, userId);
  if (!limit.allowed) return json(429, { error: 'rate_limited', message: 'Please wait a moment before the next report.' }, limit.headers || {});
  let body = null;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return json(413, { error: 'payload_too_large', message: 'That report is too long.' });
    body = JSON.parse(text);
  } catch { body = null; }
  const checked = validateReport(body);
  if (!checked.ok) return json(422, { error: 'invalid_request', message: checked.message });
  try {
    const client = db();
    const received = await findReceivedReply(client, userId, checked.value.requestId);
    if (!received.found) return json(404, { error: 'reply_not_found', message: 'That reply is not in your conversations.' });
    const value = { ...checked.value };
    if (received.text && received.text.trim()) value.replyExcerpt = clean(received.text).slice(0, MAX_REPLY);
    if (received.sessionId) value.sessionId = received.sessionId;
    await storeReport(client, userId, value);
    return json(200, { ok: true });
  } catch {
    return json(503, { error: 'unavailable', message: 'The report could not be saved. Try again shortly.' });
  }
}
