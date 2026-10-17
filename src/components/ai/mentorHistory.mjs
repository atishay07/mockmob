// The earlier questions listed on the /mentor page (ASK-MOBI-1018, P4): the student's saved exchanges with Mobi, newest first,
// each one question, the reply cut to a few lines, and where the reply came from. Pure, so a test holds the pairing, the
// source words and the cut. Nothing is invented: a reply that was never saved shows no reply line, and a reply whose source
// was not recorded says so.

const REPLY_CAP = 260;

/** Where a saved reply came from, in the words the panel uses; null for a service status (it is not an answer). */
export function sourceOf(response) {
  const r = response && typeof response === 'object' ? response : {};
  const origin = r.origin || (r.runtimeState === 'live' || r.charge?.kind === 'prepos_credit' ? 'model' : r.runtimeState === 'record' ? 'record' : r.runtimeState === 'paused' ? 'status' : null);
  if (origin === 'model') return 'Written reply';
  if (origin === 'record') return 'From your record';
  if (origin === 'status') return null;
  return 'Earlier reply, source not recorded';
}

/** The reply cut at a word near `cap` characters, with an ellipsis; short replies are untouched. */
export function clip(text, cap = REPLY_CAP) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (value.length <= cap) return value;
  const cut = value.slice(0, cap);
  const at = cut.lastIndexOf(' ');
  return `${(at > cap * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

/**
 * Pairs each saved question with the reply that followed it: [{ id, ask, reply, source }], newest first, at most `limit`.
 * `messages` is what GET /api/ai/mentor/history returns, oldest first: { id, role: 'user' | 'assistant', text, response? }.
 */
export function exchangesFrom(messages = [], { limit = 8 } = {}) {
  const rows = [];
  const list = Array.isArray(messages) ? messages : [];
  for (let i = 0; i < list.length; i += 1) {
    const m = list[i];
    if (!m || m.role !== 'user') continue;
    const ask = clip(m.text, 160);
    if (!ask) continue;
    const next = list[i + 1];
    const answer = next && next.role === 'assistant' ? next : null;
    const reply = answer ? clip(answer.response?.reply ?? answer.text) : '';
    rows.push({ id: String(m.id ?? i), ask, reply: reply || null, source: answer ? sourceOf(answer.response) : null });
  }
  return rows.reverse().slice(0, Math.max(0, limit));
}
