-- Undo for supabase/migrations/20261020100100_mob_v3_games.sql. NOT a migration (outside supabase/migrations). Apply it
-- after 20261020100200_mob_v3_chains.undo.sql and before 20261020100000_mob_v3_core.undo.sql.
-- It puts back mob_record_sitting and mob_extra_record as 20261017100000_mob.sql made them, then drops exactly what the
-- games file added: its functions and the games, runs, answers, start claims, mics, quest ticks, Mob weeks, traps and
-- fix checks. Lost on undo: every Mob game and its answers, the weekly quests and Fix it together. Safe to run twice.

-- The sittings as before (no quest tick).
create or replace function public.mob_record_sitting(p_user_id text, p_mob_id uuid, p_week date, p_session_id text,
  p_score numeric, p_max_score numeric, p_picks smallint[], p_sat_at timestamptz, p_detail jsonb default null)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return 'not_member'; end if;
  if not exists (select 1 from public.mob_papers where mob_id = p_mob_id and week_start = p_week) then return 'no_paper'; end if;
  insert into public.mob_sittings (mob_id, week_start, user_id, session_id, score, max_score, picks, detail, sat_at)
  values (p_mob_id, p_week, p_user_id, p_session_id, p_score, p_max_score, p_picks, p_detail, coalesce(p_sat_at, now()))
  on conflict (mob_id, week_start, user_id) do nothing;
  if not found then return 'exists'; end if;
  return 'recorded';
end $$;

create or replace function public.mob_extra_record(p_user_id text, p_extra_id uuid, p_session_id text, p_score numeric,
  p_max_score numeric, p_picks smallint[], p_sat_at timestamptz, p_detail jsonb default null)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid;
begin
  select mob_id into m from public.mob_extras where id = p_extra_id;
  if m is null then return 'no_extra'; end if;
  if not exists (select 1 from public.mob_members where mob_id = m and user_id = p_user_id) then return 'not_member'; end if;
  insert into public.mob_extra_sittings (extra_id, mob_id, user_id, session_id, score, max_score, picks, detail, sat_at)
  values (p_extra_id, m, p_user_id, p_session_id, p_score, p_max_score, p_picks, p_detail, coalesce(p_sat_at, now()))
  on conflict (extra_id, user_id) do nothing;
  if not found then return 'exists'; end if;
  return 'recorded';
end $$;

drop function if exists public.mob_weeks_list(uuid);
drop function if exists public.mob_fix_answer(text, uuid, smallint, text, boolean, timestamptz);
drop function if exists public.mob_fix_issue(text, uuid, smallint, text, text, timestamptz);
drop function if exists public.mob_mic_give(text, uuid, text, date, smallint);
drop function if exists public.mob_start_status(text, uuid, date);
drop function if exists public.mob_game_settle(uuid, timestamptz, jsonb);
drop function if exists public.mob_game_picks_closed(uuid, timestamptz);
drop function if exists public.mob_games_for_state(uuid, text, timestamptz);
drop function if exists public.mob_game_marks_detail(uuid);
drop function if exists public.mob_game_json(uuid, text, timestamptz);
drop function if exists public.mob_run_finish(text, uuid, text, timestamptz);
drop function if exists public.mob_game_answer(text, uuid, smallint, smallint, smallint, text, timestamptz);
drop function if exists public.mob_run_start(text, uuid, timestamptz);
drop function if exists public.mob_game_open(text, uuid, text, text, text, text, jsonb, text, date, uuid, timestamptz, integer);
drop function if exists public.mob_run_seal(uuid, text, timestamptz);
drop function if exists public.mob_quest_tick(uuid, date, text, text, text, integer, timestamptz);
drop function if exists public.mob_quest_week(uuid, date, timestamptz);
drop function if exists public.mob_room_maybe_done(uuid);
drop function if exists public.mob_room_send(uuid, text, jsonb);
drop function if exists public.mob_ist_week(timestamptz);

drop table if exists public.mob_fix_checks;
drop table if exists public.mob_traps;
drop table if exists public.mob_weeks;
drop table if exists public.mob_quest_ticks;
drop table if exists public.mob_mics;
drop table if exists public.mob_start_claims;
drop table if exists public.mob_game_answers;
drop table if exists public.mob_game_runs;
drop table if exists public.mob_games;

revoke all on function public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb),
  public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb),
  public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb) to service_role;
