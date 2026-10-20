-- Undo for supabase/migrations/20261020150000_mob_hours.sql. NOT a migration (outside supabase/migrations). Safe to run twice.
-- Lost on undo: every member's "Show my study time to my Mob" choice (the column). Nothing else is stored by Mob hours (the minutes
-- are computed from recovery_sessions on every read and are not kept), so no study data is lost. Deploy the code from before this
-- change, or keep MOB_V3_ENABLED off, first: a PATCH /api/mob/me with share_study_time then answers 503 until the migration is back,
-- and the den simply stops sending "hours".
drop function if exists public.mob_hours(text, uuid, date, timestamptz);
drop function if exists public.mob_share_study_time_set(text, uuid, boolean);
drop index if exists public.recovery_sessions_user_created_idx;
alter table public.mob_members drop column if exists share_study_time;
