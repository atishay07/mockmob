-- Undo for supabase/migrations/20261016140000_ai_reply_report.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Dropping the table deletes every stored AI reply report (reason, the reported reply text, ids). Nothing else
-- depends on it: the route POST /api/ai/mentor/report would answer 503 "could not be saved" while it is
-- missing, and the app keeps the report on the phone and retries. Export the rows first if they matter:
--   select * from public.ai_reply_reports order by created_at;
drop table if exists public.ai_reply_reports;
