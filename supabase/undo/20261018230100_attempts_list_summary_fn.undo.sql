-- Undo for supabase/migrations/20261018230100_attempts_list_summary_fn.sql. NOT a migration: it lives outside supabase/migrations
-- on purpose, so the Supabase CLI never applies it by itself. The function is new (nothing existed before), so the undo is a drop.
-- The code (src/lib/server/attemptListSummary.js) notices the missing function within five minutes and reads the table instead:
-- same answer for the app, heavier read. No data is touched either way.
drop function if exists public.attempts_list_summary(text);
