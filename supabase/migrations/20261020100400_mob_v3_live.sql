-- Mob v3, live rooms (Phase B; MOB-BUILD-SPEC-V3 sections 2.4, 3.2, 4.5 and SV-16). Additive and idempotent; service
-- role only (RLS untouched, every function security invoker, p_now passed by the API so one clock decides). Nothing
-- here is reachable while MOB_LIVE_ENABLED is off: only the room routes and a live open call these.
--   - mob_room_tidy(game, now): a lobby nobody started within 15 minutes closes (room.cancel; the game stays a 24-hour
--     game), and a running room past room_ends_at is done (room.done). The "first read after the end" calls it.
--   - mob_live_open(...): the global cap. Under one lock for every live open it tidies stale rooms, counts the rooms in
--     lobby or running across MockMob, refuses with busy at p_max_rooms (MOB_LIVE_MAX_ROOMS, default 30; 0 refuses
--     all), then opens through mob_game_open. A refused open claims no free start and no mic.
--   - mob_room_ticket, mob_room_start and mob_room_cancel are replaced (same signatures). 20261020100300 let an
--     async game (room_state null) reach the update in start and cancel, because "null <> 'lobby'" is not true; now an
--     async game answers not_live. Each tidies first, and a room that ended answers room_closed (the game itself may
--     still be open), apart from closed (the 24 hours are over).
-- Applied to staging only by this change. Undo: supabase/undo/20261020100400_mob_v3_live.undo.sql (restores the
-- 20261020100300 bodies).

create index if not exists mob_games_room_live_idx on public.mob_games (room_state) where room_state in ('lobby', 'running');

-- The room's state after tidying (null for an async game or no game).
create or replace function public.mob_room_tidy(p_game_id uuid, p_now timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found or g.room_state is null then return null; end if;
  if g.room_state = 'lobby' and p_now >= g.opened_at + interval '15 minutes' then
    update public.mob_games set room_state = 'cancelled' where id = p_game_id;
    perform public.mob_room_send(p_game_id, 'room.cancel', '{}'::jsonb);
    return 'cancelled';
  end if;
  if g.room_state = 'running' and g.room_ends_at is not null and p_now >= g.room_ends_at then
    update public.mob_games set room_state = 'done' where id = p_game_id;
    perform public.mob_room_send(p_game_id, 'room.done', '{}'::jsonb);
    return 'done';
  end if;
  return g.room_state;
end $$;

-- Open a live game under the global room cap. { status: busy | the statuses of mob_game_open, id }
create or replace function public.mob_live_open(p_user_id text, p_mob_id uuid, p_format text, p_subject text, p_chapter text,
  p_ids jsonb, p_via text, p_week date, p_rematch_of uuid, p_now timestamptz, p_max_open integer, p_max_rooms integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare n int; stale uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mob:live-rooms'));
  for stale in
    select id from public.mob_games
    where (room_state = 'lobby' and opened_at <= p_now - interval '15 minutes')
       or (room_state = 'running' and room_ends_at is not null and room_ends_at <= p_now)
  loop
    perform public.mob_room_tidy(stale, p_now);
  end loop;
  -- The Mob's own answers come first: a student in a Mob with a room open hears that, not that live is busy.
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if exists (select 1 from public.mob_games where mob_id = p_mob_id and room_state in ('lobby', 'running')) then return jsonb_build_object('status', 'room_open'); end if;
  select count(*) into n from public.mob_games where room_state in ('lobby', 'running');
  if n >= greatest(coalesce(p_max_rooms, 30), 0) then return jsonb_build_object('status', 'busy'); end if;
  return public.mob_game_open(p_user_id, p_mob_id, p_format, 'live', p_subject, p_chapter, p_ids, p_via, p_week, p_rematch_of, p_now, p_max_open);
end $$;

-- A ticket for a member opening a live room. { status: ok | not_member | not_live | closed | room_closed, expires_at }
create or replace function public.mob_room_ticket(p_user_id text, p_auth_uid uuid, p_game_id uuid, p_member_id text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype; e timestamptz;
begin
  select * into g from public.mob_games where id = p_game_id;
  if not found or not exists (select 1 from public.mob_members where mob_id = g.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if g.mode <> 'live' or g.room_state is null then return jsonb_build_object('status', 'not_live'); end if;
  if p_now >= g.closes_at then return jsonb_build_object('status', 'closed'); end if;
  perform public.mob_room_tidy(p_game_id, p_now);
  select * into g from public.mob_games where id = p_game_id;
  if g.room_state in ('done', 'cancelled') then return jsonb_build_object('status', 'room_closed'); end if;
  e := least(coalesce(g.room_ends_at, p_now + interval '45 minutes'), p_now + interval '45 minutes') + interval '5 minutes';
  insert into public.mob_room_tickets (game_id, auth_uid, user_id, member_id, issued_at, expires_at) values (p_game_id, p_auth_uid, p_user_id, p_member_id, p_now, e)
  on conflict (game_id, auth_uid) do update set user_id = excluded.user_id, member_id = excluded.member_id, issued_at = excluded.issued_at,
    expires_at = excluded.expires_at, revoked_at = null;
  return jsonb_build_object('status', 'ok', 'expires_at', e);
end $$;

-- The host starts the room: running, with the start time and the end (n questions plus 60 s grace).
-- ok | not_live | not_host | closed | room_closed | started
create or replace function public.mob_room_start(p_user_id text, p_game_id uuid, p_starts_at timestamptz, p_now timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found or g.mode <> 'live' or g.room_state is null then return 'not_live'; end if;
  if g.created_by is distinct from p_user_id or not exists (select 1 from public.mob_members where mob_id = g.mob_id and user_id = p_user_id) then return 'not_host'; end if;
  if p_now >= g.closes_at then return 'closed'; end if;
  if public.mob_room_tidy(p_game_id, p_now) in ('done', 'cancelled') then return 'room_closed'; end if;
  if g.room_state <> 'lobby' then return 'started'; end if;
  if p_starts_at is null or p_starts_at < p_now then return 'not_live'; end if;
  update public.mob_games set room_state = 'running', room_starts_at = p_starts_at,
    room_ends_at = p_starts_at + make_interval(secs => jsonb_array_length(g.question_ids) * g.seconds_per_question + 60)
  where id = p_game_id;
  perform public.mob_room_send(p_game_id, 'room.start', jsonb_build_object('startsAt', p_starts_at));
  return 'ok';
end $$;

-- The host closes the lobby; the game stays open as a 24-hour game. ok | not_live | not_host | room_closed | started
create or replace function public.mob_room_cancel(p_user_id text, p_game_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found or g.mode <> 'live' or g.room_state is null then return 'not_live'; end if;
  if g.created_by is distinct from p_user_id then return 'not_host'; end if;
  if g.room_state in ('done', 'cancelled') then return 'room_closed'; end if;
  if g.room_state <> 'lobby' then return 'started'; end if;
  update public.mob_games set room_state = 'cancelled' where id = p_game_id;
  perform public.mob_room_send(p_game_id, 'room.cancel', '{}'::jsonb);
  return 'ok';
end $$;

revoke all on function public.mob_room_tidy(uuid, timestamptz),
  public.mob_live_open(text, uuid, text, text, text, jsonb, text, date, uuid, timestamptz, integer, integer),
  public.mob_room_ticket(text, uuid, uuid, text, timestamptz), public.mob_room_start(text, uuid, timestamptz, timestamptz), public.mob_room_cancel(text, uuid)
  from public, anon, authenticated;
grant execute on function public.mob_room_tidy(uuid, timestamptz),
  public.mob_live_open(text, uuid, text, text, text, jsonb, text, date, uuid, timestamptz, integer, integer),
  public.mob_room_ticket(text, uuid, uuid, text, timestamptz), public.mob_room_start(text, uuid, timestamptz, timestamptz), public.mob_room_cancel(text, uuid)
  to service_role;
