-- Undo for supabase/migrations/20261016100000_app_errors.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- The table holds only scrubbed crash text with no user, device or network identity, so dropping it loses
-- no personal data and nothing the product needs to run. While it is missing, POST /api/app/errors answers
-- 202 with accepted 0 (the app keeps nothing and shows nothing), and /admin/app-errors shows "not set up yet".
drop function if exists public.app_errors_top(int, int);
drop function if exists public.app_error_record(jsonb);
drop table if exists public.app_errors;
