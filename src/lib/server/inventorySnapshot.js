// Pure rules for serving the public question counts from the stored snapshot. No 'server-only'
// import so node:test can load it; inventory.js supplies the database read.
//
// The counts are recomputed once a day by the cron (/api/internal/refresh-inventory, vercel.json), on
// Vercel production only. Counting reads every question (about 41 MB), so a request never does it:
// it serves the stored row, and without a usable row it serves an "unavailable" fallback, which the
// home page, dashboard, practice quote and app already handle.

// The cron runs daily, within its hour on Hobby, so a normal row is at most about 25 hours old.
// Older than 36 hours means a daily run failed: the counts are still served, marked stale, with a log line.
export const SNAPSHOT_STALE_MS = 36 * 60 * 60 * 1000;
// A row stamped further in the future than this is not trusted (clock skew between servers is allowed).
export const SNAPSHOT_CLOCK_SKEW_MS = 5 * 60 * 1000;
// How long one server keeps the row it read in memory before reading it again (one small row).
export const SERVE_MEMO_MS = 5 * 60 * 1000;

/** Serve a stored snapshot whenever one is usable; otherwise the fallback. Never asks for a recount. */
export function snapshotDecision(snapshot, now = Date.now()) {
  const computedAt = snapshot ? Date.parse(snapshot.computed_at) : NaN;
  if (!snapshot || !snapshot.value || snapshot.value.state !== 'available' || !Number.isFinite(computedAt)) return { use: 'fallback', reason: 'snapshot_missing' };
  const age = now - computedAt;
  if (age < -SNAPSHOT_CLOCK_SKEW_MS) return { use: 'fallback', reason: 'snapshot_untrusted' };
  return { use: 'snapshot', stale: age > SNAPSHOT_STALE_MS };
}

/** The safe answer when no stored counts can be served. Clients show "count unavailable"; nothing is invented. */
export function inventoryFallback(reason = 'snapshot_missing') {
  return { state: 'unavailable', reason, note: 'Question counts are refreshed once a day and are not available right now.' };
}

/**
 * The request path. Reads the stored row through readStored() and returns { value, memo }: the stored
 * counts (memo: true, safe to keep in memory) or the fallback (memo: false, read again next time).
 * It has no way to count questions itself.
 */
export async function servedInventory({ readStored, now = Date.now(), warn = console.warn }) {
  let stored = null;
  try { stored = await readStored(); } catch { stored = null; }
  const decision = snapshotDecision(stored, now);
  if (decision.use !== 'snapshot') return { value: inventoryFallback(decision.reason), memo: false };
  if (!decision.stale) return { value: stored.value, memo: true };
  warn(`[inventory] stored question counts are from ${stored.computed_at}, more than 36 hours old: the daily refresh has not run. Serving them marked stale.`);
  return { value: { ...stored.value, stale: true }, memo: true };
}
