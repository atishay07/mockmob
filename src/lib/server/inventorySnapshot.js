// Pure rules for serving public inventory aggregates from a stored snapshot. No 'server-only'
// import so node:test can load it; inventory.js applies the decision.
export const SNAPSHOT_FRESH_MS = 15 * 60 * 1000;
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Serve a stored snapshot when it exists and is younger than a day. Ask for a background
 * refresh once it is older than 15 minutes. Without a usable snapshot, compute inline (the
 * original behaviour), which is slow but always correct.
 */
export function snapshotDecision(snapshot, now = Date.now()) {
  const computedAt = snapshot ? Date.parse(snapshot.computed_at) : NaN;
  if (!snapshot || !snapshot.value || snapshot.value.state !== 'available' || !Number.isFinite(computedAt)) return { use: 'compute', refresh: false };
  const age = now - computedAt;
  if (age < 0 || age > SNAPSHOT_MAX_AGE_MS) return { use: 'compute', refresh: false };
  return { use: 'snapshot', refresh: age > SNAPSHOT_FRESH_MS };
}
