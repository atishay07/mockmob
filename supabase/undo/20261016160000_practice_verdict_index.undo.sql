-- Undo for supabase/migrations/20261016160000_practice_verdict_index.sql. NOT a migration: it lives
-- outside supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- The table holds derived data only (signed verdicts that scripts/practice-verdict-build.mjs rewrites
-- from the questions' own evidence), so dropping it loses nothing that cannot be rebuilt. While the
-- table is missing, a practice start reads the evidence records as it did before: data/db.js treats
-- Postgres 42P01 / PostgREST PGRST205 as "no verdicts".
drop table if exists public.practice_verdict_index;
