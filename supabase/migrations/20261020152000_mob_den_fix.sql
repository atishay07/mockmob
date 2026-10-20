-- Fix it together on the den (v3.fix; version 15, 20 Oct 2026). The den's Now card has two steps after a game closes with a trap:
-- "Fix question N together" and "Take the check" (the Wednesday check). This is the one small read that tells the API which of
-- the two, if either, is left for ONE member: the Mob's traps whose check window has not closed and that the Mob has not fixed
-- together yet, newest game first, each with that member's own two facts. Read only: it changes no row, table, function or API
-- answer that exists today. Service role only, security invoker, the clock passed in by the API so one clock decides.
--
--   mob_den_fix(p_mob_id, p_user_id, p_now)  jsonb array, newest game first, at most 5 rows of
--       { game_id, q (0-based question index of the trap), check_opens_at, check_closes_at,
--         now_answered (this member answered the fix question), check_answered (this member answered the check) }.
--       Empty for a member who is not in the Mob, and for a Mob with no open trap. A trap that is fixed (fixed_at set: two
--       members passed the Wednesday check) or whose window is over (check_closes_at before p_now) is not listed.
--   mob_traps_mob_idx   (mob_id, check_closes_at): the one Mob's open traps are a range read, not a scan of every Mob's traps.
--
-- Why not the den's own games: the den lists games that closed in the last 7 days, but a trap's check opens up to 7 days after the
-- close (a Wednesday at least 48 hours after it) and stays open to the Sunday after, up to 14 days. Reading the traps directly keeps
-- the card for the whole window. The traps themselves are made once, after a game closes, by the existing settle step on the
-- first den, podium or review read (mob_game_settle); nothing here makes one.
--
-- Needs 20261020100100_mob_v3_games (mob_traps, mob_fix_checks, mob_members). Applied to NOTHING by this change. The API feature-detects the
-- function: without it the den simply has no `fix` key, so the code can ship first and this can be applied later.
-- Undo: supabase/undo/20261020152000_mob_den_fix.undo.sql
-- Dry run: PGlite only (data/tests/mob_den_fix_1020.test.mjs: applied twice, undone twice, with the existing Mob migrations).
-- STAGING AND PRODUCTION DRY RUNS ARE NOT DONE (this build never connects to Supabase). The plan for whoever applies it:
--   1. staging, one transaction ending in a deliberate exception so it rolls back: run this file twice; select
--      mob_den_fix(<a Mob id>, <a member id>, now()) returns [] or the Mob's open traps; run the undo twice and check the
--      function and the index are gone.
--   2. production in the same shape. The index is a plain CREATE INDEX on a small table (one row per trap).

create index if not exists mob_traps_mob_idx on public.mob_traps (mob_id, check_closes_at);

create or replace function public.mob_den_fix(p_mob_id uuid, p_user_id text, p_now timestamptz)
returns jsonb language sql security invoker stable set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.opened_at desc, x.q), '[]'::jsonb)
  from (
    select t.opened_at, t.q, jsonb_build_object(
        'game_id', t.game_id, 'q', t.q, 'check_opens_at', t.check_opens_at, 'check_closes_at', t.check_closes_at,
        'now_answered', exists (select 1 from public.mob_fix_checks c
                                where c.game_id = t.game_id and c.q = t.q and c.user_id = p_user_id and c.stage = 'now' and c.answered_at is not null),
        'check_answered', exists (select 1 from public.mob_fix_checks c
                                  where c.game_id = t.game_id and c.q = t.q and c.user_id = p_user_id and c.stage = 'check' and c.answered_at is not null)
      ) as j
    from public.mob_traps t
    where t.mob_id = p_mob_id and t.fixed_at is null and t.check_closes_at >= p_now and t.opened_at <= p_now
      and exists (select 1 from public.mob_members mm where mm.mob_id = t.mob_id and mm.user_id = p_user_id)
    order by t.opened_at desc, t.q
    limit 5
  ) x
$$;

revoke all on function public.mob_den_fix(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mob_den_fix(uuid, text, timestamptz) to service_role;
