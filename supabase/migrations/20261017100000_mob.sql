-- The Mob: a private group of 2 to 5 students who sit one shared 10-question paper a week
-- (docs/design-decisions/pass-1016e/SOCIAL-SPEC.md, with the owner decisions of 17 Oct in its section 15). Additive and
-- idempotent. Service role only: RLS on, no anon or authenticated policy, every read and write through /api/mob
-- (src/lib/server/mob). users.id is text. Nothing here grants, spends or rewards credits or money.
-- Free and Pro (section 15): the plan is decided by the server and passed in (p_max_mobs: 1 free, 3 Pro), so a student
-- can be in several Mobs and the cap is one number the API owns. Sittings keep seconds and changed answers beside the
-- picks (the Pro side-by-side); Pro extra papers have their own tables; a free student's weekly paper and the one free
-- side-by-side sample are claimed in two small ledgers that survive leaving a Mob, so leaving and re-joining cannot
-- be used to sit a free paper twice.
-- Applied to staging only by this change; never to production before the Mob is turned on. Undo:
-- supabase/undo/20261017100000_mob.undo.sql
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
  primary key (mob_id, user_id)
);
create index if not exists mob_members_mob_idx on public.mob_members (mob_id, joined_at);
create index if not exists mob_members_user_idx on public.mob_members (user_id, joined_at);

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

-- One sitting per member per week. picks: the option index per question in paper order (-1 = blank), kept to compute
-- the Mob's shared trap and the side-by-side. Another member's picks, seconds and changes leave the server only when
-- both of you chose to share your answers (src/lib/mob/compare.mjs), never in the Mob view.
create table if not exists public.mob_sittings (
  mob_id uuid not null,
  week_start date not null,
  user_id text not null,
  session_id text not null,
  score numeric not null,
  max_score numeric not null check (max_score > 0),
  picks smallint[] not null,
  -- Seconds and changed answers per question, in paper order: { "t": [42, 17, -1], "c": [0, 1, 0] } (-1 = unknown).
  detail jsonb check (detail is null or jsonb_typeof(detail) = 'object'),
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

-- Pro extra papers (SOCIAL-SPEC section 15): a paper on a chosen chapter and length, beyond the weekly one. Any member
-- of the Mob can sit it; only Pro can make one (the API checks). It closes 7 days after it was made.
create table if not exists public.mob_extras (
  id uuid primary key default gen_random_uuid(),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  created_by text references public.users(id) on delete set null,
  week_start date not null,
  chapter text check (chapter is null or char_length(chapter) <= 120),
  question_ids jsonb not null check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 5 and 20),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null
);
create index if not exists mob_extras_mob_idx on public.mob_extras (mob_id, week_start);

create table if not exists public.mob_extra_sittings (
  extra_id uuid not null references public.mob_extras(id) on delete cascade,
  mob_id uuid not null,
  user_id text not null,
  session_id text not null,
  score numeric not null,
  max_score numeric not null check (max_score > 0),
  picks smallint[] not null,
  detail jsonb check (detail is null or jsonb_typeof(detail) = 'object'),
  sat_at timestamptz not null default now(),
  primary key (extra_id, user_id),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade
);

-- The free weekly paper: one per student per IST week, whichever Mob it was in. It outlives the membership on purpose.
create table if not exists public.mob_free_claims (
  user_id text not null references public.users(id) on delete cascade,
  week_start date not null,
  mob_id uuid not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

-- The one free side-by-side sample: the first comparison a free student opens. Reopening that same week stays free.
create table if not exists public.mob_samples (
  user_id text primary key references public.users(id) on delete cascade,
  mob_id uuid not null,
  week_start date not null,
  claimed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------------
-- Functions. Every one is service role only and takes the acting user id from the server, never from a student.
-- A Mob's membership changes under one advisory lock per Mob, so a 6th join or a join racing a leave cannot pass.
-- A student is in as many Mobs as the plan allows (p_max_mobs from the API), and every function that acts inside a Mob
-- names it (p_mob_id) and checks that the acting student is a member of it.
-- ---------------------------------------------------------------------------------------------------------------

-- Start a Mob as its owner. { status: created | limit, mob_id }. 'limit': already in as many Mobs as the plan allows.
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

-- Join by code in one transaction. { status: joined | invalid | expired | full | already | blocked | limit, mob_id }.
-- 'already': a member of this Mob. 'limit': in as many Mobs as the plan allows. A Mob with no members left (its last
-- member deleted their account) is 'invalid'.
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

-- Leave. The earliest remaining member becomes owner; an empty Mob is deleted (cascades papers, extras, invites).
-- left | left_and_closed | not_member
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
create or replace function public.mob_invite_new(p_user_id text, p_mob_id uuid, p_code text, p_expires_at timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  select count(*) into n from public.mob_members where mob_id = p_mob_id;
  if n >= 5 then return 'full'; end if;
  update public.mob_invites set revoked_at = now() where mob_id = p_mob_id and revoked_at is null;
  insert into public.mob_invites (code, mob_id, created_by, expires_at, max_uses) values (p_code, p_mob_id, p_user_id, p_expires_at, 5 - n);
  return 'ok';
end $$;

-- The join page: status valid | invalid | expired. `inviter` is the display name of the member who made the link; the
-- API gives it only to a signed-in student (the owner's "Riya invited you"), never to the public page (P1, P3).
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

-- One extra paper with its sittings, as the server reads it. Internal: used by mob_state and mob_extra_get.
create or replace function public.mob_extra_json(p_extra_id uuid)
returns jsonb language sql security invoker stable set search_path = public as $$
  select jsonb_build_object('id', x.id, 'mob_id', x.mob_id, 'week_start', x.week_start, 'chapter', x.chapter,
    'question_ids', x.question_ids, 'created_by', x.created_by, 'created_at', x.created_at, 'closes_at', x.closes_at,
    'sittings', coalesce((select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'session_id', s.session_id, 'score', s.score,
        'max_score', s.max_score, 'picks', to_jsonb(s.picks), 'detail', s.detail, 'sat_at', s.sat_at) order by s.sat_at, s.user_id)
      from public.mob_extra_sittings s where s.extra_id = x.id), '[]'::jsonb))
  from public.mob_extras x where x.id = p_extra_id
$$;

-- Everything one member's view needs for one week, or null when the student is not in that Mob. p_mob_id null reads the
-- student's earliest Mob. p_now is the caller's clock (the API passes its own, so expiry and the open extra papers read
-- one clock). Other members' picks never leave this function for a student; the server turns the rest into
-- the member's view (src/lib/mob/model.mjs buildView) and, only when both sides share, the side-by-side
-- (src/lib/mob/compare.mjs).
create or replace function public.mob_state(p_user_id text, p_week date, p_mob_id uuid default null, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare m uuid;
begin
  select mm.mob_id into m from public.mob_members mm
  where mm.user_id = p_user_id and (p_mob_id is null or mm.mob_id = p_mob_id)
  order by mm.joined_at, mm.mob_id limit 1;
  if m is null then return null; end if;
  return jsonb_build_object(
    'mob', (select jsonb_build_object('id', id, 'subject', subject, 'created_at', created_at) from public.mobs where id = m),
    'mobs', coalesce((select jsonb_agg(jsonb_build_object('id', a.mob_id, 'subject', b.subject, 'joined_at', a.joined_at) order by a.joined_at, a.mob_id)
      from public.mob_members a join public.mobs b on b.id = a.mob_id where a.user_id = p_user_id), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'display_name', display_name, 'colour', colour,
        'role', role, 'show_score', show_score, 'nudges_muted', nudges_muted, 'joined_at', joined_at) order by joined_at, user_id)
      from public.mob_members where mob_id = m), '[]'::jsonb),
    'paper', (select jsonb_build_object('question_ids', question_ids, 'subject', subject) from public.mob_papers where mob_id = m and week_start = p_week),
    'sittings', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'session_id', session_id, 'score', score,
        'max_score', max_score, 'picks', to_jsonb(picks), 'detail', detail, 'sat_at', sat_at) order by sat_at, user_id)
      from public.mob_sittings where mob_id = m and week_start = p_week), '[]'::jsonb),
    'invite', (select jsonb_build_object('code', code, 'expires_at', expires_at, 'max_uses', max_uses, 'uses', uses)
      from public.mob_invites where mob_id = m and revoked_at is null
      order by created_at desc limit 1),
    'nudges', coalesce((select jsonb_agg(jsonb_build_object('from_user', n.from_user, 'sent_at', n.sent_at,
        'seen', exists (select 1 from public.mob_nudge_seen s where s.mob_id = n.mob_id and s.week_start = n.week_start
                        and s.from_user = n.from_user and s.to_user = p_user_id)) order by n.sent_at)
      from public.mob_nudges n where n.mob_id = m and n.week_start = p_week), '[]'::jsonb),
    'extras', coalesce((select jsonb_agg(public.mob_extra_json(x.id) order by x.created_at)
      from public.mob_extras x where x.mob_id = m and (x.week_start = p_week or x.closes_at > p_now)), '[]'::jsonb),
    'past_weeks', (select count(*)::int from public.mob_papers where mob_id = m and week_start < p_week),
    'sample', (select jsonb_build_object('mob_id', mob_id, 'week_start', week_start) from public.mob_samples where user_id = p_user_id),
    'free_claim', (select jsonb_build_object('mob_id', mob_id) from public.mob_free_claims where user_id = p_user_id and week_start = p_week)
  );
end $$;

-- Change your own name, colour or switches in one Mob; a null leaves that field as it is. ok | not_member
create or replace function public.mob_patch_me(p_user_id text, p_mob_id uuid, p_name text, p_colour smallint, p_show_score boolean, p_nudges_muted boolean)
returns text language plpgsql security invoker set search_path = public as $$
begin
  update public.mob_members set
    display_name = coalesce(p_name, display_name), colour = coalesce(p_colour, colour),
    show_score = coalesce(p_show_score, show_score), nudges_muted = coalesce(p_nudges_muted, nudges_muted)
  where mob_id = p_mob_id and user_id = p_user_id;
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

-- Record one finished weekly Mob paper. recorded | exists | not_member | no_paper
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

-- Make an extra paper (Pro: the API checks the plan). { status: ok | not_member | limit, id }. At most p_max_per_week a
-- Mob and week, so a Mob cannot be flooded.
create or replace function public.mob_extra_put(p_user_id text, p_mob_id uuid, p_week date, p_chapter text, p_ids jsonb,
  p_closes_at timestamptz, p_max_per_week integer)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare x uuid; n int;
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  select count(*) into n from public.mob_extras where mob_id = p_mob_id and week_start = p_week;
  if n >= greatest(coalesce(p_max_per_week, 3), 1) then return jsonb_build_object('status', 'limit'); end if;
  insert into public.mob_extras (mob_id, created_by, week_start, chapter, question_ids, closes_at)
  values (p_mob_id, p_user_id, p_week, p_chapter, p_ids, p_closes_at) returning id into x;
  return jsonb_build_object('status', 'ok', 'id', x);
end $$;

-- One extra paper for a member of its Mob, or null.
create or replace function public.mob_extra_get(p_user_id text, p_extra_id uuid)
returns jsonb language sql security invoker stable set search_path = public as $$
  select public.mob_extra_json(x.id) from public.mob_extras x
  where x.id = p_extra_id and exists (select 1 from public.mob_members mm where mm.mob_id = x.mob_id and mm.user_id = p_user_id)
$$;

-- Record one finished extra paper. recorded | exists | not_member | no_extra
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

-- Past weekly papers of a Mob for a member (Pro: the API checks the plan), newest first, before p_before. Null when the
-- student is not in the Mob. Each week: how many sat, and your own sitting if you sat.
create or replace function public.mob_history(p_user_id text, p_mob_id uuid, p_before date, p_limit integer)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return null; end if;
  return coalesce((select jsonb_agg(t.w order by t.ws desc) from (
    select p.week_start as ws, jsonb_build_object('week_start', p.week_start,
      'sat', (select count(*)::int from public.mob_sittings s where s.mob_id = p.mob_id and s.week_start = p.week_start),
      'mine', (select jsonb_build_object('score', s.score, 'max_score', s.max_score, 'session_id', s.session_id)
               from public.mob_sittings s where s.mob_id = p.mob_id and s.week_start = p.week_start and s.user_id = p_user_id),
      'extras', (select count(*)::int from public.mob_extras x where x.mob_id = p.mob_id and x.week_start = p.week_start)) as w
    from public.mob_papers p where p.mob_id = p_mob_id and p.week_start < p_before
    order by p.week_start desc limit greatest(least(coalesce(p_limit, 26), 52), 1)) t), '[]'::jsonb);
end $$;

-- The free weekly paper: new (claimed now) | ok (already yours, in this Mob) | used (already in another Mob this week).
create or replace function public.mob_free_claim(p_user_id text, p_mob_id uuid, p_week date)
returns text language plpgsql security invoker set search_path = public as $$
begin
  insert into public.mob_free_claims (user_id, week_start, mob_id) values (p_user_id, p_week, p_mob_id) on conflict (user_id, week_start) do nothing;
  if found then return 'new'; end if;
  if exists (select 1 from public.mob_free_claims where user_id = p_user_id and week_start = p_week and mob_id = p_mob_id) then return 'ok'; end if;
  return 'used';
end $$;

-- Give the claim back when the paper could not be started. ok
create or replace function public.mob_free_release(p_user_id text, p_mob_id uuid, p_week date)
returns text language plpgsql security invoker set search_path = public as $$
begin
  delete from public.mob_free_claims where user_id = p_user_id and week_start = p_week and mob_id = p_mob_id;
  return 'ok';
end $$;

-- The one free side-by-side. { allowed, fresh }: allowed for the sample week (this call made it, or an earlier one did).
create or replace function public.mob_sample_claim(p_user_id text, p_mob_id uuid, p_week date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s public.mob_samples%rowtype;
begin
  insert into public.mob_samples (user_id, mob_id, week_start) values (p_user_id, p_mob_id, p_week) on conflict (user_id) do nothing;
  if found then return jsonb_build_object('allowed', true, 'fresh', true); end if;
  select * into s from public.mob_samples where user_id = p_user_id;
  return jsonb_build_object('allowed', s.mob_id = p_mob_id and s.week_start = p_week, 'fresh', false);
end $$;

-- The one preset "Sit it with me" note, once per sender per week, only after the sender sat. The reply is a count of
-- the members who will see it (not sat, nudges not muted): never who they are.
create or replace function public.mob_nudge(p_user_id text, p_mob_id uuid, p_week date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if not exists (select 1 from public.mob_sittings where mob_id = p_mob_id and week_start = p_week and user_id = p_user_id) then
    return jsonb_build_object('status', 'not_sat');
  end if;
  insert into public.mob_nudges (mob_id, week_start, from_user) values (p_mob_id, p_week, p_user_id) on conflict do nothing;
  if not found then return jsonb_build_object('status', 'already'); end if;
  select count(*) into n from public.mob_members mm where mm.mob_id = p_mob_id and mm.user_id <> p_user_id and not mm.nudges_muted
    and not exists (select 1 from public.mob_sittings s where s.mob_id = p_mob_id and s.week_start = p_week and s.user_id = mm.user_id);
  return jsonb_build_object('status', 'sent', 'to', n);
end $$;

-- Mark this week's nudges to me as seen. Returns how many were newly marked; -1 when not in that Mob.
create or replace function public.mob_nudge_seen_mark(p_user_id text, p_mob_id uuid, p_week date)
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return -1; end if;
  insert into public.mob_nudge_seen (mob_id, week_start, from_user, to_user)
  select p_mob_id, p_week, n2.from_user, p_user_id from public.mob_nudges n2
  where n2.mob_id = p_mob_id and n2.week_start = p_week and n2.from_user <> p_user_id
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
create or replace function public.mob_report(p_reporter text, p_mob_id uuid, p_reported text, p_reason text)
returns text language plpgsql security invoker set search_path = public as $$
declare nm text;
begin
  select b.display_name into nm from public.mob_members a
    join public.mob_members b on b.mob_id = a.mob_id and b.user_id = p_reported
  where a.mob_id = p_mob_id and a.user_id = p_reporter and p_reporter <> p_reported;
  if nm is null then return 'not_found'; end if;
  insert into public.mob_reports (mob_id, reporter_id, reported_id, reason, reported_name) values (p_mob_id, p_reporter, p_reported, p_reason, nm);
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
alter table public.mob_extras enable row level security;
alter table public.mob_extra_sittings enable row level security;
alter table public.mob_free_claims enable row level security;
alter table public.mob_samples enable row level security;
revoke all on public.mobs, public.mob_members, public.mob_invites, public.mob_papers, public.mob_sittings,
  public.mob_nudges, public.mob_nudge_seen, public.mob_blocks, public.mob_reports,
  public.mob_extras, public.mob_extra_sittings, public.mob_free_claims, public.mob_samples from public, anon, authenticated;
grant all on public.mobs, public.mob_members, public.mob_invites, public.mob_papers, public.mob_sittings,
  public.mob_nudges, public.mob_nudge_seen, public.mob_blocks, public.mob_reports,
  public.mob_extras, public.mob_extra_sittings, public.mob_free_claims, public.mob_samples to service_role;
revoke all on function public.mob_create(text, text, text, smallint, integer), public.mob_join(text, text, text, smallint, integer, timestamptz),
  public.mob_leave(text, uuid), public.mob_remove(text, uuid, text), public.mob_invite_new(text, uuid, text, timestamptz),
  public.mob_invite_lookup(text, timestamptz), public.mob_extra_json(uuid), public.mob_state(text, date, uuid, timestamptz),
  public.mob_patch_me(text, uuid, text, smallint, boolean, boolean),
  public.mob_paper_put(uuid, date, text, jsonb), public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb),
  public.mob_extra_put(text, uuid, date, text, jsonb, timestamptz, integer), public.mob_extra_get(text, uuid),
  public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb), public.mob_history(text, uuid, date, integer),
  public.mob_free_claim(text, uuid, date), public.mob_free_release(text, uuid, date), public.mob_sample_claim(text, uuid, date),
  public.mob_nudge(text, uuid, date), public.mob_nudge_seen_mark(text, uuid, date), public.mob_block(text, text), public.mob_report(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.mob_create(text, text, text, smallint, integer), public.mob_join(text, text, text, smallint, integer, timestamptz),
  public.mob_leave(text, uuid), public.mob_remove(text, uuid, text), public.mob_invite_new(text, uuid, text, timestamptz),
  public.mob_invite_lookup(text, timestamptz), public.mob_extra_json(uuid), public.mob_state(text, date, uuid, timestamptz),
  public.mob_patch_me(text, uuid, text, smallint, boolean, boolean),
  public.mob_paper_put(uuid, date, text, jsonb), public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb),
  public.mob_extra_put(text, uuid, date, text, jsonb, timestamptz, integer), public.mob_extra_get(text, uuid),
  public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb), public.mob_history(text, uuid, date, integer),
  public.mob_free_claim(text, uuid, date), public.mob_free_release(text, uuid, date), public.mob_sample_claim(text, uuid, date),
  public.mob_nudge(text, uuid, date), public.mob_nudge_seen_mark(text, uuid, date), public.mob_block(text, text), public.mob_report(text, uuid, text, text)
  to service_role;
