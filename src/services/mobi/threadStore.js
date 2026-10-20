// Where a doubt thread lives: the mentor_sessions row of that conversation (metadata.thread). No 'server-only' and no
// alias imports on purpose: the client is injected, so data/tests/mobi_doubt_thread.test.mjs runs every query on a fake.
//
// metadata.thread = { v, state: 'pending'|'open'|'failed', followUpsUsed, followUpsMax, subject, chapter, doubt, reply,
//   openKey, checks: [{ checkQuestionId, optionHashes, result? }], checksAt?, openedAt }
// Writes that must happen once are conditional updates (PostgREST filters on the JSON path), so two requests racing for
// the last follow-up, or for the first answer to a question, cannot both win.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createThreadStore({ db }) {
  const read = async (id, userId) => {
    if (!UUID.test(String(id || ''))) return null;
    const { data, error } = await db.from('mentor_sessions').select('id,metadata').eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) throw new Error('thread_read_failed');
    return data || null;
  };
  const write = async (id, userId, metadata, guard = (q) => q) => {
    const { data, error } = await guard(db.from('mentor_sessions').update({ metadata, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)).select('id');
    if (error) throw new Error('thread_write_failed');
    return Array.isArray(data) && data.length > 0;
  };
  return {
    async createThread({ userId, title, thread }) {
      const { data, error } = await db.from('mentor_sessions').insert({ user_id: userId, title, metadata: { mode: 'mentor', thread } }).select('id').single();
      if (error || !data?.id) throw new Error('thread_create_failed');
      return data.id;
    },
    /**
     * The thread a request opened, by its open key (L-01 replay): the persisted reply first (the chat route stores the
     * whole response on the thread's row, keyed by its charge reference = the open key), else the thread row whose
     * metadata.thread.openKey matches. Returns { threadId, thread, response } or null. Always scoped to the student.
     */
    async findOpened({ userId, openKey }) {
      if (typeof openKey !== 'string' || !openKey) return null;
      const { data: msg, error } = await db.from('mentor_messages').select('session_id,structured_payload').eq('user_id', userId).eq('role', 'assistant')
        .eq('structured_payload->charge->>reference', openKey).limit(1).maybeSingle();
      if (error) throw new Error('thread_read_failed');
      if (msg?.session_id) {
        const row = await read(msg.session_id, userId);
        if (row?.metadata?.thread) return { threadId: row.id, thread: row.metadata.thread, response: msg.structured_payload || null };
      }
      const { data: rows, error: e2 } = await db.from('mentor_sessions').select('id,metadata').eq('user_id', userId)
        .eq('metadata->thread->>openKey', openKey).limit(1);
      if (e2) throw new Error('thread_read_failed');
      const row = Array.isArray(rows) ? rows[0] : null;
      return row?.metadata?.thread ? { threadId: row.id, thread: row.metadata.thread, response: null } : null;
    },
    async loadThread({ id, userId }) {
      const row = await read(id, userId);
      return row ? { id: row.id, thread: row.metadata?.thread || null } : null;
    },
    async updateThread({ id, userId, thread }) {
      const row = await read(id, userId);
      if (!row) throw new Error('thread_not_found');
      const next = { ...thread, ...(Array.isArray(thread.checks) && thread.checks.length ? { checksAt: new Date().toISOString() } : {}) };
      return write(id, userId, { ...(row.metadata || {}), thread: next });
    },
    /** Takes the next follow-up slot only while the count is still `used`. True when this request took it. */
    async claimFollowUp({ id, userId, used }) {
      const row = await read(id, userId);
      const thread = row?.metadata?.thread;
      if (!thread || (Number(thread.followUpsUsed) || 0) !== used) return false;
      return write(id, userId, { ...row.metadata, thread: { ...thread, followUpsUsed: used + 1 } }, (q) => q.eq('metadata->thread->>followUpsUsed', String(used)));
    },
    /** Gives a slot back after a failed follow-up, only while the count is still the one this request set. */
    async returnFollowUp({ id, userId, used }) {
      const row = await read(id, userId);
      const thread = row?.metadata?.thread;
      if (!thread || (Number(thread.followUpsUsed) || 0) !== used) return false;
      return write(id, userId, { ...row.metadata, thread: { ...thread, followUpsUsed: Math.max(0, used - 1) } }, (q) => q.eq('metadata->thread->>followUpsUsed', String(used)));
    },
    /** Attaches the questions once: only while the thread has none (checksAt absent). */
    async attachChecks({ id, userId, checks, subject, chapter }) {
      const row = await read(id, userId);
      const thread = row?.metadata?.thread;
      if (!thread || (thread.checks || []).length) return false;
      return write(id, userId, { ...row.metadata, thread: { ...thread, subject, chapter, checks, checksAt: new Date().toISOString() } }, (q) => q.is('metadata->thread->checksAt', null));
    },
    /** Stores the first answer to one question. Returns { ok:true } | { existing } | null when it could not be written. */
    async claimCheckResult({ id, userId, slot, result }) {
      const row = await read(id, userId);
      const thread = row?.metadata?.thread;
      const offer = thread?.checks?.[slot];
      if (!offer) return null;
      if (offer.result) return { existing: offer.result };
      const checks = thread.checks.map((c, i) => (i === slot ? { ...c, result } : c));
      const won = await write(id, userId, { ...row.metadata, thread: { ...thread, checks } }, (q) => q.is(`metadata->thread->checks->${slot}->result`, null));
      if (won) return { ok: true };
      const again = await read(id, userId);
      const stored = again?.metadata?.thread?.checks?.[slot]?.result;
      return stored ? { existing: stored } : null;
    },
  };
}
