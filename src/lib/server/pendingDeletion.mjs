// When this account asked to be deleted and the request is still pending (app v16, A2): the account keeps working
// until an operator processes it, and the app says so instead of leaving odd credits unexplained. Pure (the query
// builder is passed in) so node:test can load it without the server-only guard.

/** The pending request's time as ISO, else null. Never throws: a read failure reads as no pending request. */
export async function pendingDeletionAt(userId, db) {
  try {
    const { data, error } = await db.from('account_deletion_requests').select('requested_at').eq('user_id', userId).eq('status', 'pending').maybeSingle();
    if (error || !data?.requested_at) return null;
    return new Date(data.requested_at).toISOString();
  } catch {
    return null;
  }
}
