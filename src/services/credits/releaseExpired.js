// Give back the credits of AI operations that never finished (a function killed mid-call, a crash). The database
// function mm_ai_release_expired releases each open reservation whose ten-minute expiry has passed, restoring exactly
// what was taken, and is safe to run repeatedly (supabase/migrations/20261002130000_prepos_credit_reservations.sql).
//
// No 'server-only' and no alias imports so node:test can load it; the caller injects the Supabase admin client.
// Never throws: a failed sweep must not stop the cron job it rides on.
export async function releaseExpiredAiCredits(db, limit = 100) {
  try {
    const { data, error } = await db.rpc('mm_ai_release_expired', { p_limit: limit });
    if (error) return { ok: false, released: 0 };
    return { ok: true, released: Number.isFinite(Number(data)) ? Number(data) : 0 };
  } catch {
    return { ok: false, released: 0 };
  }
}
