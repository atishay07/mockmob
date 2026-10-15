-- Undo for supabase/migrations/20261015233000_funnel_daily.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- The table holds only anonymous daily counts (day, step, platform category, count), so dropping it
-- loses no personal data and nothing the product needs to run. While it is missing, POST /api/funnel and
-- the sign-up count catch the database error (the visitor sees nothing), and the admin funnel page shows
-- "not set up yet".
-- The first line also removes the earlier one-argument signature, in case a copy made before the
-- platform column was added is still on a database (staging had one).
drop function if exists public.funnel_increment(text);
drop function if exists public.funnel_increment(text, text);
drop table if exists public.funnel_daily;
