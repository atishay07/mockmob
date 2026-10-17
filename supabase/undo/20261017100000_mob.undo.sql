-- Undo for supabase/migrations/20261017100000_mob.sql. NOT a migration: it lives outside supabase/migrations, so the
-- Supabase CLI never applies it by itself.
-- Dropping these tables loses every Mob, membership, weekly paper, extra paper, sitting, nudge, block, report, free-paper
-- claim and side-by-side sample. Nothing else depends on them: with MOB_ENABLED off every /api/mob route answers 404
-- MOB_DISABLED, and a Mob paper already started finishes as an ordinary quick practice (src/lib/server/mob/deps.js
-- treats a missing table as "nothing to record").
drop function if exists public.mob_report(text, uuid, text, text);
drop function if exists public.mob_block(text, text);
drop function if exists public.mob_nudge_seen_mark(text, uuid, date);
drop function if exists public.mob_nudge(text, uuid, date);
drop function if exists public.mob_sample_claim(text, uuid, date);
drop function if exists public.mob_free_release(text, uuid, date);
drop function if exists public.mob_free_claim(text, uuid, date);
drop function if exists public.mob_history(text, uuid, date, integer);
drop function if exists public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb);
drop function if exists public.mob_extra_get(text, uuid);
drop function if exists public.mob_extra_put(text, uuid, date, text, jsonb, timestamptz, integer);
drop function if exists public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb);
drop function if exists public.mob_paper_put(uuid, date, text, jsonb);
drop function if exists public.mob_patch_me(text, uuid, text, smallint, boolean, boolean);
drop function if exists public.mob_state(text, date, uuid, timestamptz);
drop function if exists public.mob_state(text, date, uuid);
drop function if exists public.mob_extra_json(uuid);
drop function if exists public.mob_invite_lookup(text, timestamptz);
drop function if exists public.mob_invite_lookup(text);
drop function if exists public.mob_invite_new(text, uuid, text, timestamptz);
drop function if exists public.mob_remove(text, uuid, text);
drop function if exists public.mob_leave(text, uuid);
drop function if exists public.mob_join(text, text, text, smallint, integer, timestamptz);
drop function if exists public.mob_join(text, text, text, smallint, integer);
drop function if exists public.mob_create(text, text, text, smallint, integer);
-- The earlier one-Mob signatures, in case a database still carries them from the first version of this migration.
drop function if exists public.mob_report(text, text, text);
drop function if exists public.mob_nudge_seen_mark(text, date);
drop function if exists public.mob_nudge(text, date);
drop function if exists public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz);
drop function if exists public.mob_patch_me(text, text, smallint, boolean, boolean);
drop function if exists public.mob_state(text, date);
drop function if exists public.mob_invite_new(text, text, timestamptz);
drop function if exists public.mob_leave(text);
drop function if exists public.mob_join(text, text, text, smallint);
drop function if exists public.mob_create(text, text, text, smallint);
drop table if exists public.mob_samples;
drop table if exists public.mob_free_claims;
drop table if exists public.mob_extra_sittings;
drop table if exists public.mob_extras;
drop table if exists public.mob_reports;
drop table if exists public.mob_blocks;
drop table if exists public.mob_nudge_seen;
drop table if exists public.mob_nudges;
drop table if exists public.mob_sittings;
drop table if exists public.mob_papers;
drop table if exists public.mob_invites;
drop table if exists public.mob_members;
drop table if exists public.mobs;
