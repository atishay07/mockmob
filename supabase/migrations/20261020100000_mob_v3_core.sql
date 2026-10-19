-- Mob v3, core (docs/design-decisions/pass-1019pm/mob-v3/MOB-BUILD-SPEC-V3.md section 2.1; owner D127, D133; C-dec 2).
-- Additive and idempotent, in the style of 20261017100000_mob.sql: RLS on, no anon or authenticated policy on any new
-- table, service role only, every function security invoker with the acting user id passed by the API.
--   - 6-character join codes beside the old 8-character ones (which keep working until they expire).
--   - A Mob name from a fixed list of 24 (mobs.name_key; null shows the subject) and the per-Mob podium switch.
--   - The student's seat Fold (mob_profiles) and earned Folds and finishes (fold_unlocks; starters are implicit).
--   - Preset stickers (mob_reactions, an 8-value enum, kept 30 days), one-time moments seen (mob_seen) and
--     anonymous step-outs from the weekly quest (mob_step_outs).
--   - mob_state gains name_key, show_podium, members' Folds, the step-out count, recent stickers and the games
--     (the games part reads 20261020100100_mob_v3_games.sql when it is applied). Old keys are unchanged for build 9.
-- Applied to staging only by this change. Production waits for the owner's yes.
-- Undo: supabase/undo/20261020100000_mob_v3_core.undo.sql
-- Account deletion: src/lib/server/accountDeletion.js has a step for every new table that holds a user id.

-- ---------- Codes ----------
-- The 8-character check is found by its definition, not its name (on staging it is mob_invites_code_check1, because the
-- parked v1 table kept the first name). Each one dropped is recorded in mob_data_moves so the undo puts back that name.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.mob_invites'::regclass and contype = 'c' and conname <> 'mob_invites_code_len'
             and pg_get_constraintdef(oid) like '%{8}%' and pg_get_constraintdef(oid) not like '%{6}%'
  loop
    insert into public.mob_data_moves (key) values ('v3_code_check:' || c.conname) on conflict do nothing;
    execute format('alter table public.mob_invites drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.mob_invites drop constraint if exists mob_invites_code_len;
alter table public.mob_invites add constraint mob_invites_code_len
  check (code ~ '^[0-9A-HJKMNP-TV-Z]{6}$' or code ~ '^[0-9A-HJKMNP-TV-Z]{8}$');

-- ---------- Mob name and the podium switch ----------
alter table public.mobs add column if not exists name_key smallint check (name_key between 0 and 23);
alter table public.mobs add column if not exists show_podium boolean not null default true;

-- ---------- Folds ----------
create table if not exists public.mob_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  fold text not null check (fold in ('dart','dogear','hexa','kandil','hop','crane','stamp','naav','tally','patang','sticky','cutting')),
  finish text not null default 'plain' check (finish in ('plain','foil')),
  updated_at timestamptz not null default now()
);

-- Earned Folds and finishes. Kept forever; mob_id has no foreign key so it outlives the Mob.
create table if not exists public.fold_unlocks (
  user_id text not null references public.users(id) on delete cascade,
  fold text not null check (fold in ('dart','dogear','hexa','kandil','hop','crane','stamp','naav','tally','patang','sticky','cutting')),
  finish text not null default 'plain' check (finish in ('plain','foil')),
  source text not null check (source in ('mob_quest','mob_traps','mob_weeks','first_full_mock','clean_games','beat_best','fixes_held','came_back','chain_30')),
  mob_id uuid,
  earned_at timestamptz not null default now(),
  primary key (user_id, fold, finish)
);

-- ---------- Stickers, seen moments, step-outs ----------
create table if not exists public.mob_reactions (
  id bigint generated always as identity primary key,
  mob_id uuid not null references public.mobs(id) on delete cascade,
  game_id uuid,
  from_user text not null,
  kind text not null check (kind in ('nice_one','so_close','teach_me','again','good_luck','lets_go','one_sec','ready')),
  created_at timestamptz not null default now(),
  foreign key (mob_id, from_user) references public.mob_members(mob_id, user_id) on delete cascade
);
create index if not exists mob_reactions_mob_idx on public.mob_reactions (mob_id, created_at desc);

create table if not exists public.mob_seen (
  user_id text not null references public.users(id) on delete cascade,
  key text not null check (char_length(key) <= 80),
  seen_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.mob_step_outs (
  mob_id uuid not null,
  user_id text not null,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (mob_id, user_id, week_start),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade
);

-- ---------- Functions ----------

-- mob_create (20261017190000) plus the name key. { status: created | limit | ceiling, mob_id }.
create or replace function public.mob_create_named(p_user_id text, p_subject text, p_name text, p_colour smallint, p_max_mobs integer, p_name_key smallint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare m uuid; k int; t int;
begin
  perform pg_advisory_xact_lock(hashtext('mob_user:' || p_user_id));
  select count(*) into t from public.mob_members where user_id = p_user_id;
  if t >= 12 then return jsonb_build_object('status', 'ceiling'); end if;
  k := public.mob_started_count(p_user_id);
  if k >= greatest(coalesce(p_max_mobs, 1), 1) then return jsonb_build_object('status', 'limit'); end if;
  insert into public.mobs (subject, created_by, name_key) values (p_subject, p_user_id, p_name_key) returning id into m;
  insert into public.mob_members (mob_id, user_id, display_name, colour, role) values (m, p_user_id, p_name, p_colour, 'owner');
  return jsonb_build_object('status', 'created', 'mob_id', m);
end $$;

-- Owner only; a null leaves the field as it is. ok | not_member | not_owner
create or replace function public.mob_settings_set(p_user_id text, p_mob_id uuid, p_show_podium boolean, p_name_key smallint)
returns text language plpgsql security invoker set search_path = public as $$
declare r text;
begin
  select role into r from public.mob_members where mob_id = p_mob_id and user_id = p_user_id;
  if r is null then return 'not_member'; end if;
  if r <> 'owner' then return 'not_owner'; end if;
  update public.mobs set show_podium = coalesce(p_show_podium, show_podium), name_key = coalesce(p_name_key, name_key) where id = p_mob_id;
  return 'ok';
end $$;

-- Sit as a Fold you own: a starter, or a fold_unlocks row for that fold and finish. ok | locked
create or replace function public.mob_profile_set(p_user_id text, p_fold text, p_finish text)
returns text language plpgsql security invoker set search_path = public as $$
begin
  if not ((p_fold in ('dart','dogear','hexa','kandil') and coalesce(p_finish, 'plain') = 'plain')
          or exists (select 1 from public.fold_unlocks where user_id = p_user_id and fold = p_fold and finish = coalesce(p_finish, 'plain'))) then
    return 'locked';
  end if;
  insert into public.mob_profiles (user_id, fold, finish, updated_at) values (p_user_id, p_fold, coalesce(p_finish, 'plain'), now())
  on conflict (user_id) do update set fold = excluded.fold, finish = excluded.finish, updated_at = now();
  return 'ok';
end $$;

-- Grant an earned Fold or finish, once. new | had
create or replace function public.mob_fold_grant(p_user_id text, p_fold text, p_finish text, p_source text, p_mob_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
begin
  insert into public.fold_unlocks (user_id, fold, finish, source, mob_id) values (p_user_id, p_fold, coalesce(p_finish, 'plain'), p_source, p_mob_id)
  on conflict (user_id, fold, finish) do nothing;
  if found then return 'new'; end if;
  return 'had';
end $$;

-- A preset sticker. When the game has a live room in lobby or running, it is also broadcast to that room (Phase B).
-- The broadcast carries the member id and the kind only. ok | not_member
create or replace function public.mob_sticker(p_user_id text, p_mob_id uuid, p_game_id uuid, p_kind text, p_member_id text)
returns text language plpgsql security invoker set search_path = public as $$
declare st text;
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return 'not_member'; end if;
  insert into public.mob_reactions (mob_id, game_id, from_user, kind) values (p_mob_id, p_game_id, p_user_id, p_kind);
  if p_game_id is not null and to_regclass('public.mob_games') is not null then
    execute 'select room_state from public.mob_games where id = $1 and mob_id = $2' into st using p_game_id, p_mob_id;
    if st in ('lobby', 'running') then
      begin
        execute 'select realtime.send($1, $2, $3, true)' using jsonb_build_object('m', p_member_id, 'k', p_kind), 'sticker', 'mob-room:' || p_game_id::text;
      exception when others then null; -- Realtime missing or down: the sticker is still saved for the den
      end;
    end if;
  end if;
  return 'ok';
end $$;

-- "Resting this week". ok | not_member | done (the week's quest is already finished, so it cannot change)
create or replace function public.mob_step_out(p_user_id text, p_mob_id uuid, p_week date, p_on boolean)
returns text language plpgsql security invoker set search_path = public as $$
declare d timestamptz;
begin
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  if to_regclass('public.mob_weeks') is not null then
    execute 'select done_at from public.mob_weeks where mob_id = $1 and week_start = $2' into d using p_mob_id, p_week;
    if d is not null then return 'done'; end if;
  end if;
  if p_on then
    insert into public.mob_step_outs (mob_id, user_id, week_start) values (p_mob_id, p_user_id, p_week) on conflict do nothing;
  else
    delete from public.mob_step_outs where mob_id = p_mob_id and user_id = p_user_id and week_start = p_week;
  end if;
  return 'ok';
end $$;

-- Mark one-time moments seen. Returns how many were new.
create or replace function public.mob_seen_mark(p_user_id text, p_keys text[])
returns int language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  insert into public.mob_seen (user_id, key) select p_user_id, k from unnest(p_keys) k where k is not null and char_length(k) between 1 and 80
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- The join page, as in 20261017190000, plus the Mob's name key. Never a member name for the public page.
create or replace function public.mob_invite_lookup(p_code text, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare inv public.mob_invites%rowtype; n int; s text; nk smallint;
begin
  select * into inv from public.mob_invites where code = p_code;
  if not found or inv.revoked_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  select count(*) into n from public.mob_members where mob_id = inv.mob_id;
  if n = 0 then return jsonb_build_object('status', 'invalid'); end if;
  if inv.expires_at < p_now then return jsonb_build_object('status', 'expired'); end if;
  if n >= 5 then return jsonb_build_object('status', 'full'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('status', 'expired'); end if;
  select subject, name_key into s, nk from public.mobs where id = inv.mob_id;
  return jsonb_build_object('status', 'valid', 'subject', s, 'name_key', nk, 'size', n, 'seats_left', 5 - n, 'expires_at', inv.expires_at,
    'inviter', (select display_name from public.mob_members where mob_id = inv.mob_id and user_id = inv.created_by));
end $$;

-- Everything one member's view needs, as in 20261017100000, plus the v3 keys. Other members' picks never leave here.
create or replace function public.mob_state(p_user_id text, p_week date, p_mob_id uuid default null, p_now timestamptz default now())
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare m uuid; g jsonb := '[]'::jsonb;
begin
  select mm.mob_id into m from public.mob_members mm
  where mm.user_id = p_user_id and (p_mob_id is null or mm.mob_id = p_mob_id)
  order by mm.joined_at, mm.mob_id limit 1;
  if m is null then return null; end if;
  if to_regprocedure('public.mob_games_for_state(uuid,text,timestamptz)') is not null then
    execute 'select public.mob_games_for_state($1, $2, $3)' into g using m, p_user_id, p_now;
  end if;
  return jsonb_build_object(
    'mob', (select jsonb_build_object('id', id, 'subject', subject, 'created_at', created_at, 'name_key', name_key, 'show_podium', show_podium) from public.mobs where id = m),
    'mobs', coalesce((select jsonb_agg(jsonb_build_object('id', a.mob_id, 'subject', b.subject, 'joined_at', a.joined_at, 'name_key', b.name_key) order by a.joined_at, a.mob_id)
      from public.mob_members a join public.mobs b on b.id = a.mob_id where a.user_id = p_user_id), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', mm.user_id, 'display_name', mm.display_name, 'colour', mm.colour,
        'role', mm.role, 'show_score', mm.show_score, 'nudges_muted', mm.nudges_muted, 'joined_at', mm.joined_at,
        'fold', p.fold, 'finish', p.finish) order by mm.joined_at, mm.user_id)
      from public.mob_members mm left join public.mob_profiles p on p.user_id = mm.user_id where mm.mob_id = m), '[]'::jsonb),
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
    'free_claim', (select jsonb_build_object('mob_id', mob_id) from public.mob_free_claims where user_id = p_user_id and week_start = p_week),
    -- v3: counts only, never who stepped out.
    'step_outs', (select count(*)::int from public.mob_step_outs where mob_id = m and week_start = p_week),
    'you_stepped_out', exists (select 1 from public.mob_step_outs where mob_id = m and week_start = p_week and user_id = p_user_id),
    'reactions', coalesce((select jsonb_agg(r.j order by r.created_at desc) from (
        select jsonb_build_object('from_user', from_user, 'kind', kind, 'game_id', game_id, 'created_at', created_at) j, created_at
        from public.mob_reactions where mob_id = m and created_at > p_now - interval '7 days' order by created_at desc limit 20) r), '[]'::jsonb),
    'games', g
  );
end $$;

-- ---------- Grants: service role only ----------
alter table public.mob_profiles enable row level security;
alter table public.fold_unlocks enable row level security;
alter table public.mob_reactions enable row level security;
alter table public.mob_seen enable row level security;
alter table public.mob_step_outs enable row level security;
revoke all on public.mob_profiles, public.fold_unlocks, public.mob_reactions, public.mob_seen, public.mob_step_outs from public, anon, authenticated;
grant all on public.mob_profiles, public.fold_unlocks, public.mob_reactions, public.mob_seen, public.mob_step_outs to service_role;
revoke all on function public.mob_create_named(text, text, text, smallint, integer, smallint), public.mob_settings_set(text, uuid, boolean, smallint),
  public.mob_profile_set(text, text, text), public.mob_fold_grant(text, text, text, text, uuid), public.mob_sticker(text, uuid, uuid, text, text),
  public.mob_step_out(text, uuid, date, boolean), public.mob_seen_mark(text, text[]), public.mob_invite_lookup(text, timestamptz),
  public.mob_state(text, date, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mob_create_named(text, text, text, smallint, integer, smallint), public.mob_settings_set(text, uuid, boolean, smallint),
  public.mob_profile_set(text, text, text), public.mob_fold_grant(text, text, text, text, uuid), public.mob_sticker(text, uuid, uuid, text, text),
  public.mob_step_out(text, uuid, date, boolean), public.mob_seen_mark(text, text[]), public.mob_invite_lookup(text, timestamptz),
  public.mob_state(text, date, uuid, timestamptz)
  to service_role;
