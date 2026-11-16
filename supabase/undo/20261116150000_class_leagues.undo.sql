-- Undo for supabase/migrations/20261116150000_class_leagues.sql. NOT a migration: it lives outside supabase/migrations, so the
-- Supabase CLI never applies it by itself. NOT APPLIED to any remote database.
-- Turn CLASS_LEAGUES_ENABLED off first (unset or anything but 'true'): every /api/class route then answers 404 and no screen
-- reads these tables. Dropping them loses every class, its code and its memberships. Nothing else depends on them: the
-- Sunday Mock, its attempts and the Mob never read them, and a class figure is computed on request, never stored.
drop table if exists public.class_league_members;
drop table if exists public.class_leagues;
