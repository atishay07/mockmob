-- The Mob: a private group of 2 to 5 students who sit one shared 10-question paper a week
-- (docs/design-decisions/pass-1016e/SOCIAL-SPEC.md). Additive and idempotent. Service role only: RLS on, no anon
-- or authenticated policy, every read and write through /api/mob (src/lib/server/mob). users.id is text.
-- Nothing here grants, spends or rewards credits or money. Applied to staging only by this change; never to
-- production before the owner answers D-S1. Undo: supabase/undo/20261017100000_mob.undo.sql
--
-- Account deletion keeps the users row as an anonymised tombstone, so the user foreign keys below never fire for
-- it: src/lib/server/accountDeletion.js has explicit steps for every mob_* table that holds a user id.

create table if not exists public.mobs (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject ~ '^[a-z][a-z_]{1,40}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.mob_members (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 18),
  colour smallint not null default 0 check (colour between 0 and 7),
  role text not null default 'member' check (role in ('owner', 'member')),
  show_score boolean not null default false,
  nudges_muted boolean not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  primary key (mob_id, user_id),
  constraint mob_members_one_mob unique (user_id)
);
create index if not exists mob_members_mob_idx on public.mob_members (mob_id, joined_at);

create table if not exists public.mob_invites (
  code text primary key check (code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses smallint not null check (max_uses between 1 and 4),
  uses smallint not null default 0 check (uses >= 0),
  revoked_at timestamptz
);
create index if not exists mob_invites_mob_idx on public.mob_invites (mob_id) where revoked_at is null;

-- One frozen paper per Mob per IST week (Monday). question_ids is the ordered list every member gets.
create table if not exists public.mob_papers (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  week_start date not null,
  subject text not null,
  question_ids jsonb not null check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 5 and 20),
  created_at timestamptz not null default now(),
  primary key (mob_id, week_start)
);

-- One sitting per member per week. picks: the option index per question in paper order (-1 = blank), kept only to
-- compute the Mob's shared trap; never returned to other members.
create table if not exists public.mob_sittings (
  mob_id uuid not null,
  week_start date not null,
  user_id text not null,
  session_id text not null,
  score numeric not null,
  max_score numeric not null check (max_score > 0),
  picks smallint[] not null,
  sat_at timestamptz not null default now(),
  primary key (mob_id, week_start, user_id),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade,
  foreign key (mob_id, week_start) references public.mob_papers(mob_id, week_start) on delete cascade
);

create table if not exists public.mob_nudges (
  mob_id uuid not null,
  week_start date not null,
  from_user text not null,
  sent_at timestamptz not null default now(),
  primary key (mob_id, week_start, from_user),
  foreign key (mob_id, from_user) references public.mob_members(mob_id, user_id) on delete cascade
);

-- Who has seen a nudge (so a recipient's card shows it once, and the sender learns nothing).
create table if not exists public.mob_nudge_seen (
  mob_id uuid not null,
  week_start date not null,
  from_user text not null,
  to_user text not null,
  seen_at timestamptz not null default now(),
  primary key (mob_id, week_start, from_user, to_user),
  foreign key (mob_id, week_start, from_user) references public.mob_nudges(mob_id, week_start, from_user) on delete cascade,
  foreign key (mob_id, to_user) references public.mob_members(mob_id, user_id) on delete cascade
);

create table if not exists public.mob_blocks (
  blocker_id text not null references public.users(id) on delete cascade,
  blocked_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.mob_reports (
  id bigint generated always as identity primary key,
  mob_id uuid references public.mobs(id) on delete set null,
  reporter_id text references public.users(id) on delete set null,
  reported_id text references public.users(id) on delete set null,
  reason text not null check (reason in ('name', 'nudge', 'safety')),
  reported_name text check (char_length(reported_name) <= 18),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists mob_reports_open_idx on public.mob_reports (created_at) where resolved_at is null;

-- ---------------------------------------------------------------------------------------------------------------
-- Functions. Every one is service role only and takes the acting user id from the server, never from a student.
-- A Mob's membership changes under one advisory lock per Mob, so a 6th join or a join racing a leave cannot pass.
-- ---------------------------------------------------------------------------------------------------------------

-- Start a Mob as its owner. 'created' or 'already' (the student is in a Mob).
create or replace function public.mob_create(p_user_id text, p_subject text, p_name text, p_colour smallint)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  if exists (select 1 from public.mob_members where user_id = p_user_id) then return 'already'; end if;
  insert into public.mobs (subject) values (p_subject) returning id into m;
  insert into public.mob_members (mob_id, user_id, display_name, colour, role) values (m, p_user_id, p_name, p_colour, 'owner');
  return 'created';
end $$;

-- Join by code in one transaction. joined | invalid | expired | full | already | blocked.
-- A Mob with no members left (its last member deleted their account) is 'invalid'.
create or replace function public.mob_join(p_user_id text, p_code text, p_name text, p_colour smallint)
returns text language plpgsql security invoker set search_path = public as $$
declare inv public.mob_invites%rowtype; n int;
begin
  select * into inv from public.mob_invites where code = p_code for update;
  if not found or inv.revoked_at is not null then return 'invalid'; end if;
  if inv.expires_at < now() or inv.uses >= inv.max_uses then return 'expired'; end if;
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  perform pg_advisory_xact_lock(hashtext('mob:' || inv.mob_id::text));
  if exists (select 1 from public.mob_members where user_id = p_user_id) then return 'already'; end if;
  if exists (select 1 from public.mob_members m join public.mob_blocks b
             on (b.blocker_id = m.user_id and b.blocked_id = p_user_id) or (b.blocker_id = p_user_id and b.blocked_id = m.user_id)
             where m.mob_id = inv.mob_id) then return 'blocked'; end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return 'invalid'; end if;
  if n >= 5 then return 'full'; end if;
  insert into public.mob_members (mob_id, user_id, display_name, colour) values (inv.mob_id, p_user_id, p_name, p_colour);
  update public.mob_invites set uses = uses + 1 where code = p_code;
  return 'joined';
end $$;

-- Leave. The earliest remaining member becomes owner; an empty Mob is deleted (cascades papers, invites).
-- left | left_and_closed | not_member
create or replace function public.mob_leave(p_user_id text)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid; was_owner boolean;
begin
  select mob_id, role = 'owner' into m, was_owner from public.mob_members where user_id = p_user_id;
  if m is null then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || m::text));
  delete from public.mob_members where user_id = p_user_id;
  if not exists (select 1 from public.mob_members where mob_id = m) then
    delete from public.mobs where id = m; return 'left_and_closed';
  end if;
  if was_owner or not exists (select 1 from public.mob_members where mob_id = m and role = 'owner') then
    update public.mob_members set role = 'owner'
    where (mob_id, user_id) = (select mob_id, user_id from public.mob_members where mob_id = m order by joined_at, user_id limit 1);
  end if;
  return 'left';
end $$;

-- Remove a member (the owner, or the moderation path with p_actor = null). removed | not_owner | not_member | not_found
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

-- A new invite revokes the old one and allows as many uses as there are seats left. ok | not_member | full
create or replace function public.mob_invite_new(p_user_id text, p_code text, p_expires_at timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid; n int;
begin
  select mob_id into m from public.mob_members where user_id = p_user_id;
  if m is null then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || m::text));
  select count(*) into n from public.mob_members where mob_id = m;
  if n >= 5 then return 'full'; end if;
  update public.mob_invites set revoked_at = now() where mob_id = m and revoked_at is null;
  insert into public.mob_invites (code, mob_id, created_by, expires_at, max_uses) values (p_code, m, p_user_id, p_expires_at, 5 - n);
  return 'ok';
end $$;

-- The public join page: never a name. status valid | invalid | expired.
create or replace function public.mob_invite_lookup(p_code text)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; s text;
begin
  select * into inv from public.mob_invites where code = p_code;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < now() or inv.uses >= inv.max_uses or n >= 5 then return jsonb_build_object('status', 'expired'); end if;
  select subject into s from public.mobs where id = inv.mob_id;
  return jsonb_build_object('status', 'valid', 'subject', s, 'size', n, 'seats_left', 5 - n, 'expires_at', inv.expires_at);
end $$;

-- Everything one member's view needs for one week, or null when the student is in no Mob. Other members' picks
-- never leave this function; the server turns the rest into the member's view (src/lib/mob/model.mjs buildView).
create or replace function public.mob_state(p_user_id text, p_week date)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare m uuid;
begin
  select mob_id into m from public.mob_members where user_id = p_user_id;
  if m is null then return null; end if;
  return jsonb_build_object(
    'mob', (select jsonb_build_object('id', id, 'subject', subject, 'created_at', created_at) from public.mobs where id = m),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'display_name', display_name, 'colour', colour,
        'role', role, 'show_score', show_score, 'nudges_muted', nudges_muted, 'joined_at', joined_at) order by joined_at, user_id)
      from public.mob_members where mob_id = m), '[]'::jsonb),
    'paper', (select jsonb_build_object('question_ids', question_ids, 'subject', subject) from public.mob_papers where mob_id = m and week_start = p_week),
    'sittings', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'session_id', session_id, 'score', score,
        'max_score', max_score, 'picks', to_jsonb(picks), 'sat_at', sat_at) order by sat_at)
      from public.mob_sittings where mob_id = m and week_start = p_week), '[]'::jsonb),
    'invite', (select jsonb_build_object('code', code, 'expires_at', expires_at, 'max_uses', max_uses, 'uses', uses)
      from public.mob_invites where mob_id = m and revoked_at is null
      order by created_at desc limit 1),
    'nudges', coalesce((select jsonb_agg(jsonb_build_object('from_user', n.from_user, 'sent_at', n.sent_at,
        'seen', exists (select 1 from public.mob_nudge_seen s where s.mob_id = n.mob_id and s.week_start = n.week_start
                        and s.from_user = n.from_user and s.to_user = p_user_id)) order by n.sent_at)
      from public.mob_nudges n where n.mob_id = m and n.week_start = p_week), '[]'::jsonb)
  );
end $$;

-- Change your own name, colour or switches; a null leaves that field as it is. ok | not_member
create or replace function public.mob_patch_me(p_user_id text, p_name text, p_colour smallint, p_show_score boolean, p_nudges_muted boolean)
returns text language plpgsql security invoker set search_path = public as $$
begin
  update public.mob_members set
    display_name = coalesce(p_name, display_name), colour = coalesce(p_colour, colour),
    show_score = coalesce(p_show_score, show_score), nudges_muted = coalesce(p_nudges_muted, nudges_muted)
  where user_id = p_user_id;
  if not found then return 'not_member'; end if;
  return 'ok';
end $$;

-- Freeze this week's paper. The first writer wins; every caller gets the stored list back.
create or replace function public.mob_paper_put(p_mob_id uuid, p_week date, p_subject text, p_ids jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  insert into public.mob_papers (mob_id, week_start, subject, question_ids) values (p_mob_id, p_week, p_subject, p_ids)
  on conflict (mob_id, week_start) do nothing;
  return (select question_ids from public.mob_papers where mob_id = p_mob_id and week_start = p_week);
end $$;

-- Record one finished Mob paper. recorded | exists | not_member | no_paper
create or replace function public.mob_record_sitting(p_user_id text, p_mob_id uuid, p_week date, p_session_id text,
  p_score numeric, p_max_score numeric, p_picks smallint[], p_sat_at timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return 'not_member'; end if;
  if not exists (select 1 from public.mob_papers where mob_id = p_mob_id and week_start = p_week) then return 'no_paper'; end if;
  insert into public.mob_sittings (mob_id, week_start, user_id, session_id, score, max_score, picks, sat_at)
  values (p_mob_id, p_week, p_user_id, p_session_id, p_score, p_max_score, p_picks, coalesce(p_sat_at, now()))
  on conflict (mob_id, week_start, user_id) do nothing;
  if not found then return 'exists'; end if;
  return 'recorded';
end $$;

-- The one preset "Sit it with me" note, once per sender per week, only after the sender sat. The reply is a count of
-- the members who will see it (not sat, nudges not muted): never who they are.
create or replace function public.mob_nudge(p_user_id text, p_week date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m uuid; n int;
begin
  select mob_id into m from public.mob_members where user_id = p_user_id;
  if m is null then return jsonb_build_object('status', 'not_member'); end if;
  if not exists (select 1 from public.mob_sittings where mob_id = m and week_start = p_week and user_id = p_user_id) then
    return jsonb_build_object('status', 'not_sat');
  end if;
  insert into public.mob_nudges (mob_id, week_start, from_user) values (m, p_week, p_user_id) on conflict do nothing;
  if not found then return jsonb_build_object('status', 'already'); end if;
  select count(*) into n from public.mob_members mm where mm.mob_id = m and mm.user_id <> p_user_id and not mm.nudges_muted
    and not exists (select 1 from public.mob_sittings s where s.mob_id = m and s.week_start = p_week and s.user_id = mm.user_id);
  return jsonb_build_object('status', 'sent', 'to', n);
end $$;

-- Mark this week's nudges to me as seen. Returns how many were newly marked; -1 when not in a Mob.
create or replace function public.mob_nudge_seen_mark(p_user_id text, p_week date)
returns int language plpgsql security invoker set search_path = public as $$
declare m uuid; n int;
begin
  select mob_id into m from public.mob_members where user_id = p_user_id;
  if m is null then return -1; end if;
  insert into public.mob_nudge_seen (mob_id, week_start, from_user, to_user)
  select m, p_week, n2.from_user, p_user_id from public.mob_nudges n2
  where n2.mob_id = m and n2.week_start = p_week and n2.from_user <> p_user_id
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Block another member (used by "Leave and block" and by a report with block). ok | not_found
create or replace function public.mob_block(p_blocker text, p_blocked text)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if p_blocker = p_blocked then return 'not_found'; end if;
  insert into public.mob_blocks (blocker_id, blocked_id) values (p_blocker, p_blocked) on conflict do nothing;
  return 'ok';
end $$;

-- Report a member of your own Mob. The name is copied as it was, so a later rename cannot hide it. reported | not_found
create or replace function public.mob_report(p_reporter text, p_reported text, p_reason text)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid; nm text;
begin
  select a.mob_id, b.display_name into m, nm from public.mob_members a
    join public.mob_members b on b.mob_id = a.mob_id and b.user_id = p_reported
  where a.user_id = p_reporter and p_reporter <> p_reported;
  if m is null then return 'not_found'; end if;
  insert into public.mob_reports (mob_id, reporter_id, reported_id, reason, reported_name) values (m, p_reporter, p_reported, p_reason, nm);
  return 'reported';
end $$;

alter table public.mobs enable row level security;
alter table public.mob_members enable row level security;
alter table public.mob_invites enable row level security;
alter table public.mob_papers enable row level security;
alter table public.mob_sittings enable row level security;
alter table public.mob_nudges enable row level security;
alter table public.mob_nudge_seen enable row level security;
alter table public.mob_blocks enable row level security;
alter table public.mob_reports enable row level security;
revoke all on public.mobs, public.mob_members, public.mob_invites, public.mob_papers, public.mob_sittings,
  public.mob_nudges, public.mob_nudge_seen, public.mob_blocks, public.mob_reports from public, anon, authenticated;
grant all on public.mobs, public.mob_members, public.mob_invites, public.mob_papers, public.mob_sittings,
  public.mob_nudges, public.mob_nudge_seen, public.mob_blocks, public.mob_reports to service_role;
revoke all on function public.mob_create(text, text, text, smallint), public.mob_join(text, text, text, smallint),
  public.mob_leave(text), public.mob_remove(text, uuid, text), public.mob_invite_new(text, text, timestamptz),
  public.mob_invite_lookup(text), public.mob_state(text, date), public.mob_patch_me(text, text, smallint, boolean, boolean),
  public.mob_paper_put(uuid, date, text, jsonb), public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz),
  public.mob_nudge(text, date), public.mob_nudge_seen_mark(text, date), public.mob_block(text, text), public.mob_report(text, text, text)
  from public, anon, authenticated;
grant execute on function public.mob_create(text, text, text, smallint), public.mob_join(text, text, text, smallint),
  public.mob_leave(text), public.mob_remove(text, uuid, text), public.mob_invite_new(text, text, timestamptz),
  public.mob_invite_lookup(text), public.mob_state(text, date), public.mob_patch_me(text, text, smallint, boolean, boolean),
  public.mob_paper_put(uuid, date, text, jsonb), public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz),
  public.mob_nudge(text, date), public.mob_nudge_seen_mark(text, date), public.mob_block(text, text), public.mob_report(text, text, text)
  to service_role;
