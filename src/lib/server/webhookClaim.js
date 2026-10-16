// Claiming a payment webhook event so it is processed once, with an in-flight lease.
// data/db.js wires this to the webhook_events table; the decision is kept here so it can be tested without a database.
//
// Outcomes of claimWebhookEventWith():
//   true         this delivery owns the event: process it.
//   false        already processed: answer "duplicate" and do nothing.
//   'in_flight'  another delivery claimed it less than LEASE_MS ago and has not finished: answer 503 so the sender retries.
//
// An event is also taken over (true) when its row carries a note or an error (a failed run, or "no matching payment
// record" which can match later) or when its lease ran out (the first delivery crashed).

export const LEASE_MS = 120_000;

const UNIQUE_VIOLATION = '23505';
const TABLE_MISSING = '42P01';

// A schema that does not have claimed_at yet (migration 20261016170100 not applied): Postgres 42703, PostgREST PGRST204.
export function isMissingLeaseColumn(error) {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /claimed_at/i.test(String(error.message || ''));
}

/** PostgREST filter for "this event may be taken now": noted or failed, or unprocessed with no live lease. */
export function reclaimFilter(cutoffIso) {
  return `error_message.not.is.null,and(processed_at.is.null,or(claimed_at.is.null,claimed_at.lt.${cutoffIso}))`;
}

/**
 * store.insert(row)                      -> { error }
 * store.read(eventId)                    -> { data: {processed_at, error_message, claimed_at} | null, error }
 * store.reclaim(eventId, patch, filter)  -> { data: rows[], error }   (one conditional UPDATE ... RETURNING)
 * store.legacy()                         -> the pre-lease claim, used until the column exists
 */
export async function claimWebhookEventWith(store, { eventId, eventType, payload, provider = 'razorpay' }, { now = Date.now(), leaseMs = LEASE_MS } = {}) {
  if (!eventId) throw new Error('eventId required');
  const stamp = new Date(now).toISOString();
  const row = { event_id: eventId, provider, event_type: eventType, payload: payload || {}, claimed_at: stamp };

  const first = await store.insert(row);
  if (!first.error) return true;
  if (isMissingLeaseColumn(first.error)) return store.legacy();
  if (first.error.code === TABLE_MISSING) return true; // table not yet migrated: do not block production
  if (first.error.code !== UNIQUE_VIOLATION) throw first.error;

  // Seen before. One conditional UPDATE decides who owns it, so two simultaneous duplicates cannot both win.
  const cutoff = new Date(now - leaseMs).toISOString();
  const taken = await store.reclaim(
    eventId,
    { event_type: eventType, payload: payload || {}, processed_at: null, error_message: null, claimed_at: stamp },
    reclaimFilter(cutoff),
  );
  if (taken.error) {
    if (isMissingLeaseColumn(taken.error)) return store.legacy();
    throw taken.error;
  }
  if (Array.isArray(taken.data) && taken.data.length > 0) return true;

  const seen = await store.read(eventId);
  if (seen.error) throw seen.error;
  if (!seen.data) return true; // the row vanished between the two calls: treat as new
  if (seen.data.processed_at) return false;
  return 'in_flight';
}
