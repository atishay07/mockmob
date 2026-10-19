-- Undo for supabase/migrations/20261020100400_mob_v3_live.sql. NOT a migration (outside supabase/migrations). Apply it
-- before the other v3 undo files (it is the newest). Turn MOB_LIVE_ENABLED off first. It drops the cap and tidy functions
-- and the index, and puts back the 20261020100300 bodies of mob_room_ticket, mob_room_start and mob_room_cancel, byte for
-- byte (only while public.mob_games exists, so the whole v3 undo can run twice). Lost on undo: nothing (rooms keep their
-- state). Safe to run twice.
drop function if exists public.mob_live_open(text, uuid, text, text, text, jsonb, text, date, uuid, timestamptz, integer, integer);
drop function if exists public.mob_room_tidy(uuid, timestamptz);
drop index if exists public.mob_games_room_live_idx;

do $undo$
begin
  if to_regclass('public.mob_games') is null or to_regclass('public.mob_room_tickets') is null then return; end if;
  execute $f$
-- A ticket for a member opening a live room. { status: ok | not_member | not_live | closed, expires_at }
create or replace function public.mob_room_ticket(p_user_id text, p_auth_uid uuid, p_game_id uuid, p_member_id text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype; e timestamptz;
begin
  select * into g from public.mob_games where id = p_game_id;
  if not found or not exists (select 1 from public.mob_members where mob_id = g.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if g.mode <> 'live' or g.room_state is null then return jsonb_build_object('status', 'not_live'); end if;
  if p_now >= g.closes_at or g.room_state in ('done', 'cancelled') then return jsonb_build_object('status', 'closed'); end if;
  e := least(coalesce(g.room_ends_at, p_now + interval '45 minutes'), p_now + interval '45 minutes') + interval '5 minutes';
  insert into public.mob_room_tickets (game_id, auth_uid, user_id, member_id, issued_at, expires_at) values (p_game_id, p_auth_uid, p_user_id, p_member_id, p_now, e)
  on conflict (game_id, auth_uid) do update set user_id = excluded.user_id, member_id = excluded.member_id, issued_at = excluded.issued_at,
    expires_at = excluded.expires_at, revoked_at = null;
  return jsonb_build_object('status', 'ok', 'expires_at', e);
end $$;

-- The host starts the room: running, with the start time and the end (n questions plus 60 s grace). ok | not_host | started | closed
create or replace function public.mob_room_start(p_user_id text, p_game_id uuid, p_starts_at timestamptz, p_now timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found or g.created_by is distinct from p_user_id then return 'not_host'; end if;
  if p_now >= g.closes_at or g.room_state in ('done', 'cancelled') then return 'closed'; end if;
  if g.room_state <> 'lobby' then return 'started'; end if;
  update public.mob_games set room_state = 'running', room_starts_at = p_starts_at,
    room_ends_at = p_starts_at + make_interval(secs => jsonb_array_length(g.question_ids) * g.seconds_per_question + 60)
  where id = p_game_id;
  perform public.mob_room_send(p_game_id, 'room.start', jsonb_build_object('startsAt', p_starts_at));
  return 'ok';
end $$;

-- The host cancels in the lobby; the game stays open as a 24-hour game. ok | not_host | started
create or replace function public.mob_room_cancel(p_user_id text, p_game_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found or g.created_by is distinct from p_user_id then return 'not_host'; end if;
  if g.room_state <> 'lobby' then return 'started'; end if;
  update public.mob_games set room_state = 'cancelled' where id = p_game_id;
  perform public.mob_room_send(p_game_id, 'room.cancel', '{}'::jsonb);
  return 'ok';
end $$;
$f$;
  execute $f$
revoke all on function public.mob_room_ticket(text, uuid, uuid, text, timestamptz), public.mob_room_start(text, uuid, timestamptz, timestamptz), public.mob_room_cancel(text, uuid)
  from public, anon, authenticated;
grant execute on function public.mob_room_ticket(text, uuid, uuid, text, timestamptz), public.mob_room_start(text, uuid, timestamptz, timestamptz),
  public.mob_room_cancel(text, uuid) to service_role;
$f$;
end $undo$;
