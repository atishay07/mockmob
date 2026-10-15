-- Undo for supabase/migrations/20261015233000_funnel_daily.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- The table holds only anonymous daily counts, so dropping it loses no personal data and nothing the
-- product needs to run. While it is missing, POST /api/funnel catches the database error and still
-- answers 204 (the visitor sees nothing), and the admin funnel page shows "not set up yet".
drop function if exists public.funnel_increment(text);
drop table if exists public.funnel_daily;
