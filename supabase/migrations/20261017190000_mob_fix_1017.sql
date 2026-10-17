-- The Mob, fixes from the 17 Oct go/no-go check (CTO decisions, SOCIAL-SPEC section 15). Additive and idempotent,
-- service role only like 20261017100000_mob.sql. Applied to staging only by this change. Undo:
-- supabase/undo/20261017190000_mob_fix_1017.undo.sql
--
--   1. Free may START one Mob and JOIN any number by invite; Pro may start up to 3. The plan cap now counts the Mobs you
--      started and are still in (mobs.created_by), not every membership. Joining has one safety ceiling (12 Mobs a
--      student), passed by the API like before.
--   2. Sharing inside a Mob (picks, times, changed answers, score, to the other members of that Mob only) is ON by
--      default, with a per-member switch to turn it off. Existing rows are moved to the new default once; the undo puts
--      back exactly the rows this moved.
--   3. A full Mob is 'full' on the join page and on join, never 'expired'.
--   4. Leaving and removal are counted with no user id (mob_departures), so the /admin/funnel Mob block can read the
--      7-day leave rate the spec's stop rule names.
--   5. Rate limits that count only successful actions: a request that fails gives its count back
--      (rate_limit_give_back), and a refused request can say the real wait (rate_limit_reset_at).
--   6. mob_metrics: aggregate counts for /admin/funnel (no user ids, no names).

-- ---------- 1. Who started a Mob ----------
alter table public.mobs add column if not exists created_by text references public.users(id) on delete set null;
create index if not exists mobs_created_by_idx on public.mobs (created_by) where created_by is not null;

-- A one-row ledger of one-time data moves, so re-running this file never moves rows a second time.
create table if not exists public.mob_data_moves (
  key text primary key,
  moved_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from public.mob_data_moves where key = 'created_by_1017') then
    -- Rows made before this column: the current owner is the best record of who started the Mob.
    update public.mobs mo set created_by = mm.user_id
    from public.mob_members mm
    where mm.mob_id = mo.id and mm.role = 'owner' and mo.created_by is null;
    insert into public.mob_data_moves (key) values ('created_by_1017');
  end if;
end $$;

-- ---------- 2. Sharing on by default ----------
alter table public.mob_members alter column show_score set default true;
-- Marks the rows this file turned on, so the undo turns off exactly those and nothing a student chose since.
alter table public.mob_members add column if not exists share_moved_1017 boolean not null default false;

do $$
begin
  if not exists (select 1 from public.mob_data_moves where key = 'share_default_1017') then
    update public.mob_members set show_score = true, share_moved_1017 = true where show_score = false;
    insert into public.mob_data_moves (key) values ('share_default_1017');
  end if;
end $$;

-- ---------- 4. Departures, with no user id ----------
create table if not exists public.mob_departures (
  id bigint generated always as identity primary key,
  mob_id uuid,
  kind text not null check (kind in ('left', 'removed')),
  joined_at timestamptz not null,
  left_at timestamptz not null default now()
);
create index if not exists mob_departures_left_idx on public.mob_departures (left_at);

-- ---------- Functions ----------

-- How many Mobs this student started and is still in (the plan cap on starting).
create or replace function public.mob_started_count(p_user_id text)
returns integer language sql security invoker stable set search_path = public as $$
  select count(*)::int from public.mobs mo
  join public.mob_members mm on mm.mob_id = mo.id and mm.user_id = p_user_id
  where mo.created_by = p_user_id
$$;

-- Start a Mob as its owner. { status: created | limit | ceiling, mob_id }. 'limit': already started as many Mobs as the
-- plan allows (p_max_mobs, counted over the Mobs you started and are still in). 'ceiling': in 12 Mobs already.
create or replace function public.mob_create(p_user_id text, p_subject text, p_name text, p_colour smallint, p_max_mobs integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m uuid; k int; t int;
begin
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  select count(*) into t from public.mob_members where user_id = p_user_id;
  if t >= 12 then return jsonb_build_object('status', 'ceiling'); end if;
  k := public.mob_started_count(p_user_id);
  if k >= greatest(coalesce(p_max_mobs, 1), 1) then return jsonb_build_object('status', 'limit'); end if;
  insert into public.mobs (subject, created_by) values (p_subject, p_user_id) returning id into m;
  insert into public.mob_members (mob_id, user_id, display_name, colour, role) values (m, p_user_id, p_name, p_colour, 'owner');
  return jsonb_build_object('status', 'created', 'mob_id', m);
end $$;

-- Join by code in one transaction. { status: joined | invalid | expired | full | already | blocked | limit, mob_id }.
-- p_max_mobs is now the ceiling on Mobs a student is in (the API passes 12): joining is not a plan limit.
-- A full Mob is 'full' before anything about the link's uses, so the joiner is told the real reason.
create or replace function public.mob_join(p_user_id text, p_code text, p_name text, p_colour smallint, p_max_mobs integer, p_now timestamptz default now())
returns jsonb language plpgsql security invoker set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; k int;
begin
  select * into inv from public.mob_invites where code = p_code for update;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < p_now then return jsonb_build_object('status', 'expired'); end if;
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  perform pg_advisory_xact_lock(hashtext('mob:' || inv.mob_id::text));
  if exists (select 1 from public.mob_members where mob_id = inv.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'already', 'mob_id', inv.mob_id); end if;
  if exists (select 1 from public.mob_members m join public.mob_blocks b
             on (b.blocker_id = m.user_id and b.blocked_id = p_user_id) or (b.blocker_id = p_user_id and b.blocked_id = m.user_id)
             where m.mob_id = inv.mob_id) then return jsonb_build_object('status', 'blocked'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if n >= 5 then return jsonb_build_object('status', 'full'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('status', 'expired'); end if;
  select count(*) into k from public.mob_members where user_id = p_user_id;
  if k >= greatest(coalesce(p_max_mobs, 1), 1) then return jsonb_build_object('status', 'limit'); end if;
  insert into public.mob_members (mob_id, user_id, display_name, colour) values (inv.mob_id, p_user_id, p_name, p_colour);
  update public.mob_invites set uses = uses + 1 where code = p_code;
  return jsonb_build_object('status', 'joined', 'mob_id', inv.mob_id);
end $$;

-- The join page: status valid | invalid | expired | full. `inviter` as before (signed-in students only, by the API).
create or replace function public.mob_invite_lookup(p_code text, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; s text;
begin
  select * into inv from public.mob_invites where code = p_code;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < p_now then return jsonb_build_object('status', 'expired'); end if;
  if n >= 5 then return jsonb_build_object('status', 'full'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('status', 'expired'); end if;
  select subject into s from public.mobs where id = inv.mob_id;
  return jsonb_build_object('status', 'valid', 'subject', s, 'size', n, 'seats_left', 5 - n, 'expires_at', inv.expires_at,
    'inviter', (select display_name from public.mob_members where mob_id = inv.mob_id and user_id = inv.created_by));
end $$;

-- Leave, as before, and count the departure with no user id.
create or replace function public.mob_leave(p_user_id text, p_mob_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare was_owner boolean; j timestamptz;
begin
  select role = 'owner', joined_at into was_owner, j from public.mob_members where mob_id = p_mob_id and user_id = p_user_id;
  if not found then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  delete from public.mob_members where mob_id = p_mob_id and user_id = p_user_id;
  insert into public.mob_departures (mob_id, kind, joined_at) values (p_mob_id, 'left', j);
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id) then
    delete from public.mobs where id = p_mob_id; return 'left_and_closed';
  end if;
  if was_owner or not exists (select 1 from public.mob_members where mob_id = p_mob_id and role = 'owner') then
    update public.mob_members set role = 'owner'
    where (mob_id, user_id) = (select mob_id, user_id from public.mob_members where mob_id = p_mob_id order by joined_at, user_id limit 1);
  end if;
  return 'left';
end $$;

-- Remove a member, as before, and count the departure with no user id.
create or replace function public.mob_remove(p_actor text, p_mob_id uuid, p_target text)
returns text language plpgsql security invoker set search_path = public as $$
declare r text; j timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  if p_actor is not null then
    select role into r from public.mob_members where mob_id = p_mob_id and user_id = p_actor;
    if r is null then return 'not_member'; end if;
    if r <> 'owner' then return 'not_owner'; end if;
    if p_actor = p_target then return 'not_found'; end if;
  end if;
  delete from public.mob_members where mob_id = p_mob_id and user_id = p_target returning joined_at into j;
  if not found then return 'not_found'; end if;
  insert into public.mob_departures (mob_id, kind, joined_at) values (p_mob_id, 'removed', j);
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id) then
    delete from public.mobs where id = p_mob_id;
  elsif not exists (select 1 from public.mob_members where mob_id = p_mob_id and role = 'owner') then
    update public.mob_members set role = 'owner'
    where (mob_id, user_id) = (select mob_id, user_id from public.mob_members where mob_id = p_mob_id order by joined_at, user_id limit 1);
  end if;
  return 'removed';
end $$;

-- ---------- 5. Rate limits that count only successful actions ----------
-- plpgsql, so creating these never needs public.persistent_rate_limits to exist yet (20261002121000_runtime_ai_guard.sql).

-- Give one count back to a bucket whose window is still open (the request it was taken for did not succeed).
create or replace function public.rate_limit_give_back(p_bucket text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.persistent_rate_limits set count = greatest(count - 1, 0) where bucket = p_bucket and reset_at > now();
  return found;
end $$;

-- When a bucket's window ends, or null when it is not counting anything now.
create or replace function public.rate_limit_reset_at(p_bucket text)
returns timestamptz language plpgsql security invoker stable set search_path = '' as $$
declare r timestamptz;
begin
  select reset_at into r from public.persistent_rate_limits where bucket = p_bucket and reset_at > now();
  return r;
end $$;

-- ---------- 6. Aggregate counts for /admin/funnel (SOCIAL-SPEC section 13) ----------
-- Counts only: no user id, no name, no Mob id leaves this function. The page suppresses any group under 5.
create or replace function public.mob_metrics(p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare
  wk date := date_trunc('week', p_now at time zone 'Asia/Kolkata')::date;
  prev date := (date_trunc('week', p_now at time zone 'Asia/Kolkata') - interval '7 days')::date;
begin
  return jsonb_build_object(
    'week', wk,
    'mobs', (select count(*)::int from public.mobs),
    'active_mobs', (select count(*)::int from (select mob_id from public.mob_members group by mob_id having count(*) >= 2) a),
    'members', (select count(*)::int from public.mob_members),
    'members_in_active', (select count(*)::int from public.mob_members where mob_id in (select mob_id from public.mob_members group by mob_id having count(*) >= 2)),
    'sat_this_week', (select count(*)::int from public.mob_sittings s where s.week_start = wk
      and s.mob_id in (select mob_id from public.mob_members group by mob_id having count(*) >= 2)),
    'sat_last_week', (select count(*)::int from public.mob_sittings s where s.week_start = prev
      and s.mob_id in (select mob_id from public.mob_members group by mob_id having count(*) >= 2)),
    'sittings_7d', (select count(*)::int from public.mob_sittings where sat_at > p_now - interval '7 days'),
    'late_7d', (select count(*)::int from public.mob_sittings where sat_at > p_now - interval '7 days'
      and (extract(hour from sat_at at time zone 'Asia/Kolkata') >= 23 or extract(hour from sat_at at time zone 'Asia/Kolkata') < 5)),
    'reports_7d', (select count(*)::int from public.mob_reports where created_at > p_now - interval '7 days'),
    'blocks_7d', (select count(*)::int from public.mob_blocks where created_at > p_now - interval '7 days'),
    -- The 7-day leave rate: of the members who joined 7 to 14 days ago, how many left within 7 days of joining.
    'joined_cohort', (select count(*)::int from public.mob_members where joined_at > p_now - interval '14 days' and joined_at <= p_now - interval '7 days')
      + (select count(*)::int from public.mob_departures where joined_at > p_now - interval '14 days' and joined_at <= p_now - interval '7 days'),
    'left_within_7d', (select count(*)::int from public.mob_departures where joined_at > p_now - interval '14 days' and joined_at <= p_now - interval '7 days'
      and left_at - joined_at <= interval '7 days')
  );
end $$;

-- ---------- Grants: service role only ----------
alter table public.mob_departures enable row level security;
alter table public.mob_data_moves enable row level security;
revoke all on public.mob_departures, public.mob_data_moves from public, anon, authenticated;
grant all on public.mob_departures, public.mob_data_moves to service_role;
revoke all on function public.mob_started_count(text), public.mob_create(text, text, text, smallint, integer),
  public.mob_join(text, text, text, smallint, integer, timestamptz), public.mob_invite_lookup(text, timestamptz),
  public.mob_leave(text, uuid), public.mob_remove(text, uuid, text), public.rate_limit_give_back(text), public.rate_limit_reset_at(text),
  public.mob_metrics(timestamptz)
  from public, anon, authenticated;
grant execute on function public.mob_started_count(text), public.mob_create(text, text, text, smallint, integer),
  public.mob_join(text, text, text, smallint, integer, timestamptz), public.mob_invite_lookup(text, timestamptz),
  public.mob_leave(text, uuid), public.mob_remove(text, uuid, text), public.rate_limit_give_back(text), public.rate_limit_reset_at(text),
  public.mob_metrics(timestamptz)
  to service_role;
