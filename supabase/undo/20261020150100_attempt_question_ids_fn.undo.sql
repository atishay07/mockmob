-- Undo for supabase/migrations/20261020150100_attempt_question_ids_fn.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself. The function is new (nothing existed before), so the undo is a drop.
-- The code (data/attempt_question_ids.js) notices the missing function within five minutes and reads the snapshots instead:
-- same answer, heavier read. No data is touched either way.
drop function if exists public.attempt_question_ids(text, text, text, integer);
