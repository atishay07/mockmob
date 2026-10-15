-- Undo for supabase/migrations/20261013190000_nta_question_index.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- The table holds derived data only (signed slim rows that scripts/nta-index-build.mjs rewrites from the
-- questions' own evidence), so dropping it loses nothing that cannot be rebuilt. While the table is
-- missing, NTA mode reads the full questions (the behaviour before the migration): data/nta_pool.js
-- loadNtaPoolFromIndex treats Postgres 42P01 / PostgREST PGRST205 as "no index" and falls back.
drop table if exists public.nta_question_index;
