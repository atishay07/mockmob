-- In-flight lease for payment webhook events (security review 16 Oct 2026, finding 5).
--
-- Before: claimWebhookEvent let a second delivery of the same event run while the first was still working (the row
-- existed with processed_at null and no error, which it treated as "unprocessed, go ahead"). Harmless today because
-- every handler is idempotent, but it is a race worth closing.
-- Now: the first delivery stamps claimed_at. A duplicate that arrives within the lease (120 s, set in data/db.js) is told
-- "busy" (the route answers 503 and Razorpay retries later). If the first delivery crashed, the lease runs out and a retry takes over.
-- Rows written before this migration have claimed_at null and count as expired, which is the old behaviour.
-- Until this migration is applied the code detects the missing column and falls back to the old claim, so deploy order is free.
-- Undo: supabase/undo/20261016170100_webhook_event_lease.undo.sql.

ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

COMMENT ON COLUMN public.webhook_events.claimed_at IS
  'When a delivery last took this event to process it. While processed_at is null and this is under 120 s old, a duplicate delivery is told to retry later.';
