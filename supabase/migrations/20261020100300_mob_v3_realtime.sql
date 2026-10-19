-- Mob v3, Realtime for live rooms (MOB-BUILD-SPEC-V3 section 2.4). The schema for Phase B: nothing calls these until
-- MOB_LIVE_ENABLED=true and the room routes ship. Additive and idempotent.
--   - mob_room_tickets: the API issues one when a member opens a live room; Realtime checks it on join. auth_uid is the
--     Supabase identity id from the session (it can differ from users.id for old email-keyed rows).
--   - mob_room_ok(topic): the ONLY security definer function in Mob v3, because it runs inside an RLS policy on
--     realtime.messages for authenticated. search_path is empty and every name is qualified.
--   - Policies: receive broadcasts and presence on your room only; clients send presence only (every broadcast comes
--     from the server through realtime.send in SQL).
--   - Leaving, removal and blocking revoke tickets at once (trigger on mob_members delete).
--   - mob_room_ticket, mob_room_start and mob_room_cancel (service role).
-- The Realtime "Allow public access" dashboard switch is a separate step that waits for the owner's yes.
-- Applied to staging only by this change. Undo: supabase/undo/20261020100300_mob_v3_realtime.undo.sql

create table if not exists public.mob_room_tickets (
  game_id uuid not null references public.mob_games(id) on delete cascade,
  auth_uid uuid not null,
  user_id text not null,
  member_id text not null check (member_id ~ '^[0-9A-Z]{12}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  primary key (game_id, auth_uid)
);
create index if not exists mob_room_tickets_user_idx on public.mob_room_tickets (user_id) where revoked_at is null;
alter table public.mob_room_tickets enable row level security;
revoke all on public.mob_room_tickets from public, anon, authenticated;
grant all on public.mob_room_tickets to service_role;

create or replace function public.mob_room_ok(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_topic like 'mob-room:%' and exists (
    select 1 from public.mob_room_tickets t
    where t.game_id::text = substr(p_topic, 10)
      and t.auth_uid = (select auth.uid())
      and t.revoked_at is null and t.expires_at > now())
$$;
revoke all on function public.mob_room_ok(text) from public, anon;
grant execute on function public.mob_room_ok(text) to authenticated, service_role;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists mob_room_receive on realtime.messages;
    create policy mob_room_receive on realtime.messages for select to authenticated
      using ( public.mob_room_ok((select realtime.topic())) );
    drop policy if exists mob_room_presence on realtime.messages;
    create policy mob_room_presence on realtime.messages for insert to authenticated
      with check ( realtime.messages.extension = 'presence' and public.mob_room_ok((select realtime.topic())) );
  end if;
end $$;

create or replace function public.mob_room_revoke_on_leave() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  update public.mob_room_tickets t set revoked_at = now()
  from public.mob_games g where g.id = t.game_id and g.mob_id = old.mob_id and t.user_id = old.user_id and t.revoked_at is null;
  return old;
end $$;
drop trigger if exists mob_room_revoke on public.mob_members;
create trigger mob_room_revoke after delete on public.mob_members for each row execute function public.mob_room_revoke_on_leave();

-- Blocking also revokes the blocker's and the blocked member's tickets in rooms they share.
create or replace function public.mob_room_revoke_on_block() returns trigger language plpgsql security invoker set search_path = public as $$
begin
  update public.mob_room_tickets t set revoked_at = now()
  where t.revoked_at is null and t.user_id in (new.blocker_id, new.blocked_id);
  return new;
end $$;
drop trigger if exists mob_room_revoke_block on public.mob_blocks;
create trigger mob_room_revoke_block after insert on public.mob_blocks for each row execute function public.mob_room_revoke_on_block();

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

revoke all on function public.mob_room_revoke_on_leave(), public.mob_room_revoke_on_block(),
  public.mob_room_ticket(text, uuid, uuid, text, timestamptz), public.mob_room_start(text, uuid, timestamptz, timestamptz), public.mob_room_cancel(text, uuid)
  from public, anon, authenticated;
grant execute on function public.mob_room_ticket(text, uuid, uuid, text, timestamptz), public.mob_room_start(text, uuid, timestamptz, timestamptz),
  public.mob_room_cancel(text, uuid) to service_role;
