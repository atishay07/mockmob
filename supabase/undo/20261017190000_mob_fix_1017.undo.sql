-- Undo for supabase/migrations/20261017190000_mob_fix_1017.sql. NOT a migration: it lives outside supabase/migrations,
-- so the Supabase CLI never applies it by itself. Staging only.
-- It puts back the 17 Oct 10:00 functions (free counts every membership; a full Mob reads as an expired link), turns
-- sharing off again for exactly the members the fix turned on (share_moved_1017), restores the off default, and drops
-- what the fix added: mobs.created_by, the departures count, the data-move ledger, the rate-limit helpers and
-- mob_metrics. Departure counts are lost; nothing else is.

-- Sharing: back to off for the rows the fix moved, and off by default.
-- Safe to run twice, and after the Mob's own undo: every table step checks the table is there.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mob_members' and column_name = 'share_moved_1017') then
    update public.mob_members set show_score = false where share_moved_1017;
    alter table public.mob_members drop column share_moved_1017;
  end if;
  if to_regclass('public.mob_members') is not null then
    alter table public.mob_members alter column show_score set default false;
  end if;
end $$;

drop function if exists public.mob_metrics(timestamptz);
drop function if exists public.rate_limit_reset_at(text);
drop function if exists public.rate_limit_give_back(text);
drop function if exists public.mob_started_count(text);

-- The functions as 20261017100000_mob.sql made them.
create or replace function public.mob_create(p_user_id text, p_subject text, p_name text, p_colour smallint, p_max_mobs integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m uuid; k int;
begin
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  select count(*) into k from public.mob_members where user_id = p_user_id;
  if k >= greatest(coalesce(p_max_mobs, 1), 1) then return jsonb_build_object('status', 'limit'); end if;
  insert into public.mobs (subject) values (p_subject) returning id into m;
  insert into public.mob_members (mob_id, user_id, display_name, colour, role) values (m, p_user_id, p_name, p_colour, 'owner');
  return jsonb_build_object('status', 'created', 'mob_id', m);
end $$;

create or replace function public.mob_join(p_user_id text, p_code text, p_name text, p_colour smallint, p_max_mobs integer, p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; k int;
begin
  select * into inv from public.mob_invites where code = p_code for update;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < p_now or inv.uses >= inv.max_uses then return jsonb_build_object('status', 'expired'); end if;
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  perform pg_advisory_xact_lock(hashtext('mob:' || inv.mob_id::text));
  if exists (select 1 from public.mob_members where mob_id = inv.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'already', 'mob_id', inv.mob_id); end if;
  if exists (select 1 from public.mob_members m join public.mob_blocks b
             on (b.blocker_id = m.user_id and b.blocked_id = p_user_id) or (b.blocker_id = p_user_id and b.blocked_id = m.user_id)
             where m.mob_id = inv.mob_id) then return jsonb_build_object('status', 'blocked'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if n >= 5 then return jsonb_build_object('status', 'full'); end if;
  select count(*) into k from public.mob_members where user_id = p_user_id;
  if k >= greatest(coalesce(p_max_mobs, 1), 1) then return jsonb_build_object('status', 'limit'); end if;
  insert into public.mob_members (mob_id, user_id, display_name, colour) values (inv.mob_id, p_user_id, p_name, p_colour);
  update public.mob_invites set uses = uses + 1 where code = p_code;
  return jsonb_build_object('status', 'joined', 'mob_id', inv.mob_id);
end $$;

create or replace function public.mob_leave(p_user_id text, p_mob_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare was_owner boolean;
begin
  select role = 'owner' into was_owner from public.mob_members where mob_id = p_mob_id and user_id = p_user_id;
  if not found then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  delete from public.mob_members where mob_id = p_mob_id and user_id = p_user_id;
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id) then
    delete from public.mobs where id = p_mob_id; return 'left_and_closed';
  end if;
  if was_owner or not exists (select 1 from public.mob_members where mob_id = p_mob_id and role = 'owner') then
    update public.mob_members set role = 'owner'
    where (mob_id, user_id) = (select mob_id, user_id from public.mob_members where mob_id = p_mob_id order by joined_at, user_id limit 1);
  end if;
  return 'left';
end $$;

create or replace function public.mob_remove(p_actor text, p_mob_id uuid, p_target text)
returns text language plpgsql security invoker set search_path = public as $$
declare r text;
begin
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  if p_actor is not null then
    select role into r from public.mob_members where mob_id = p_mob_id and user_id = p_actor;
    if r is null then return 'not_member'; end if;
    if r <> 'owner' then return 'not_owner'; end if;
    if p_actor = p_target then return 'not_found'; end if;
  end if;
  delete from public.mob_members where mob_id = p_mob_id and user_id = p_target;
  if not found then return 'not_found'; end if;
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id) then
    delete from public.mobs where id = p_mob_id;
  elsif not exists (select 1 from public.mob_members where mob_id = p_mob_id and role = 'owner') then
    update public.mob_members set role = 'owner'
    where (mob_id, user_id) = (select mob_id, user_id from public.mob_members where mob_id = p_mob_id order by joined_at, user_id limit 1);
  end if;
  return 'removed';
end $$;

create or replace function public.mob_invite_lookup(p_code text, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; s text;
begin
  select * into inv from public.mob_invites where code = p_code;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < p_now or inv.uses >= inv.max_uses or n >= 5 then return jsonb_build_object('status', 'expired'); end if;
  select subject into s from public.mobs where id = inv.mob_id;
  return jsonb_build_object('status', 'valid', 'subject', s, 'size', n, 'seats_left', 5 - n, 'expires_at', inv.expires_at,
    'inviter', (select display_name from public.mob_members where mob_id = inv.mob_id and user_id = inv.created_by));
end $$;

drop table if exists public.mob_departures;
drop table if exists public.mob_data_moves;
drop index if exists public.mobs_created_by_idx;
do $$
begin
  if to_regclass('public.mobs') is not null then alter table public.mobs drop column if exists created_by; end if;
end $$;

revoke all on function public.mob_create(text, text, text, smallint, integer), public.mob_join(text, text, text, smallint, integer, timestamptz),
  public.mob_leave(text, uuid), public.mob_remove(text, uuid, text), public.mob_invite_lookup(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mob_create(text, text, text, smallint, integer), public.mob_join(text, text, text, smallint, integer, timestamptz),
  public.mob_leave(text, uuid), public.mob_remove(text, uuid, text), public.mob_invite_lookup(text, timestamptz)
  to service_role;
