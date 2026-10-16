-- Undo for supabase/migrations/20261016160100_leaderboard_group_by.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Drops the function only; no data changes. The app falls back to paging the attempts table.
drop function if exists public.mm_leaderboard();
