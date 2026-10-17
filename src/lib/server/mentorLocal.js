// POST /api/ai/mentor/local saves a reply the browser built on its own (answers about the student's record or the
// page, no model call). That text comes from the client, so it is never stored as an assistant turn (security review
// 17 Oct 2026, group 9): an assistant row is what findReceivedReply (AI reply reports) and the study replay in the chat
// route trust as proof that the model replied.
//
// The exchange is stored as ONE user-role row: the student's message as content, and the local reply inside
// structured_payload.localReply, rebuilt here from a short whitelist (reply text, navigate actions to in-app routes) and
// marked client_sourced. No charge, usage, study or origin field from the body survives. /api/ai/mentor/history shows it
// again as a display-only assistant bubble with clientSourced: true.
// Pure: no Next.js or Supabase imports, so node:test loads it directly.

export const LOCAL_REPLY_MAX = 4000;
const MAX_ACTIONS = 6;

function safeRoute(route) {
  return typeof route === 'string' && route.startsWith('/') && !route.startsWith('//') && !/[\u0000-\u001f\\]/.test(route)
    ? route.slice(0, 200)
    : null;
}

/** The only fields of a client-built reply that are kept. Returns null when there is no reply text. */
export function sanitiseLocalReply(response) {
  if (!response || typeof response !== 'object') return null;
  const reply = typeof response.reply === 'string' ? response.reply.trim().slice(0, LOCAL_REPLY_MAX) : '';
  if (!reply) return null;
  const actions = (Array.isArray(response.actions) ? response.actions : [])
    .slice(0, MAX_ACTIONS)
    .map((action) => ({ label: String(action?.label || '').slice(0, 80), type: 'navigate', route: safeRoute(action?.route) }))
    .filter((action) => action.label && action.route);
  return { reply, origin: 'client_local', actions, cards: [] };
}

/** The single row the local route inserts (user role; the reply is client-sourced data, not an assistant turn). */
export function localExchangeRow({ sessionId, userId, message, response }) {
  const localReply = sanitiseLocalReply(response);
  if (!localReply) return null;
  return {
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: message,
    structured_payload: { kind: 'local_exchange', client_sourced: true, localReply },
  };
}

/** History rows -> messages; a stored local exchange becomes the student's message plus a display-only reply. */
export function historyMessages(rows) {
  const out = [];
  for (const row of rows || []) {
    const payload = row?.structured_payload;
    const local = row?.role === 'user' && payload?.client_sourced === true ? sanitiseLocalReply(payload.localReply) : null;
    out.push({ id: row.id, role: row.role, text: row.content, response: local ? null : payload ?? null, createdAt: row.created_at });
    if (local) {
      out.push({ id: `${row.id}:local`, role: 'assistant', text: local.reply, response: { ...local, origin: 'record' }, clientSourced: true, createdAt: row.created_at });
    }
  }
  return out;
}
