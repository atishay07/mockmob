-- Undo for supabase/migrations/20261016120000_question_option_stats.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- The table holds derived data only (aggregates rebuilt from attempts by public.refresh_question_option_stats), so
-- dropping it loses nothing that cannot be rebuilt. While the table or the function is missing, the result page reads
-- no cohort time lines and falls back to the committed snapshot of other students' picks
-- (data/cohort/question_picks.v1.json) exactly as before slice 5: src/lib/server/cohortStats.js treats a missing
-- table or function as "no table", and the nightly refresh logs it and moves on.
drop function if exists public.refresh_question_option_stats();
drop table if exists public.question_option_stats;
