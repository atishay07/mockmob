-- Undo for 20261016170100_webhook_event_lease.sql. The code falls back to the old claim when the column is missing.
ALTER TABLE public.webhook_events DROP COLUMN IF EXISTS claimed_at;
