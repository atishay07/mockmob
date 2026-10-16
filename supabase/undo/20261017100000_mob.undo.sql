-- Undo for supabase/migrations/20261017100000_mob.sql. NOT a migration: it lives outside supabase/migrations, so the
-- Supabase CLI never applies it by itself.
-- Dropping these tables loses every Mob, membership, weekly paper, sitting, nudge, block and report. Nothing else
-- depends on them: with MOB_ENABLED off every /api/mob route answers 404 MOB_DISABLED, and a Mob paper already started
-- finishes as an ordinary quick practice (src/lib/server/mob/sitting.js treats a missing table as "nothing to record").
drop function if exists public.mob_report(text, text, text);
drop function if exists public.mob_block(text, text);
drop function if exists public.mob_nudge_seen_mark(text, date);
drop function if exists public.mob_nudge(text, date);
drop function if exists public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz);
drop function if exists public.mob_paper_put(uuid, date, text, jsonb);
drop function if exists public.mob_patch_me(text, text, smallint, boolean, boolean);
drop function if exists public.mob_state(text, date);
drop function if exists public.mob_invite_lookup(text);
drop function if exists public.mob_invite_new(text, text, timestamptz);
drop function if exists public.mob_remove(text, uuid, text);
drop function if exists public.mob_leave(text);
drop function if exists public.mob_join(text, text, text, smallint);
drop function if exists public.mob_create(text, text, text, smallint);
drop table if exists public.mob_reports;
drop table if exists public.mob_blocks;
drop table if exists public.mob_nudge_seen;
drop table if exists public.mob_nudges;
drop table if exists public.mob_sittings;
drop table if exists public.mob_papers;
drop table if exists public.mob_invites;
drop table if exists public.mob_members;
drop table if exists public.mobs;
