-- Undo for supabase/migrations/20261020100200_mob_v3_chains.sql. NOT a migration (outside supabase/migrations). Apply it
-- after 20261020100300_mob_v3_realtime.undo.sql and before 20261020100100_mob_v3_games.undo.sql. It drops exactly what
-- the chains file added. Lost on undo: "Hide my chain", the stored best runs and exam pause days (the chains themselves
-- are computed from answers, which stay). Safe to run twice.
drop function if exists public.mob_unlock_facts(text);
drop function if exists public.mob_chain_best_bump(uuid, integer);
drop function if exists public.chain_best_bump(text, integer);
drop function if exists public.chain_prefs_set(text, boolean);
drop function if exists public.chain_pause_clear(text, date[], date);
drop function if exists public.chain_pause_set(text, date[], date);
drop function if exists public.chain_state(text, date);
drop function if exists public.chain_fixes_held(text);
drop function if exists public.chain_daily(text, date);
drop table if exists public.mob_chain_best;
drop table if exists public.chain_pauses;
drop table if exists public.chain_prefs;
