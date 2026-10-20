-- Undo for supabase/migrations/20261020150000_attempts_lean_fn.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself. The function is new (nothing existed before), so the undo is a drop.
-- The code (data/attempt_reads.js, slim 'plan' and 'history') notices the missing function within five minutes and reads the
-- table instead: same answer, heavier read. No data is touched either way.
drop function if exists public.attempts_lean(text, text);
