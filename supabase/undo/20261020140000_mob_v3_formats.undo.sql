-- Undo for supabase/migrations/20261020140000_mob_v3_formats.sql. NOT a migration (outside supabase/migrations). Apply it
-- before the other v3 undo files (it is the newest). Turn MOB_LIVE_ENABLED off first, and stop starting races and mocks
-- (deploy the code before this change, or keep MOB_V3_ENABLED off).
-- Lost on undo: every race and full-mock game with its runs, answers, traps and fix checks (the members' practice
-- attempts of a full mock stay in attempts), the mark sheets and session ids on runs, and room presence.
-- It puts back the 20261020100100 bodies of mob_run_seal, mob_run_start, mob_game_answer, mob_game_json and
-- mob_game_settle and the 20261020100400 body of mob_room_start, byte for byte; the old checks under the names they had;
-- the Realtime policies of 20261020100300 (receive and presence through public.mob_room_ok). Safe to run twice.
do $undo$
declare c record;
begin
  if to_regclass('public.mob_games') is null then return; end if;
  delete from public.mob_games where format in ('race', 'mock');
  alter table public.mob_games drop constraint if exists mob_games_format_v2;
  alter table public.mob_games drop constraint if exists mob_games_ids_v2;
  alter table public.mob_games drop constraint if exists mob_games_shape_v2;
  alter table public.mob_game_answers drop constraint if exists mob_game_answers_q_v2;
  for c in select key from public.mob_data_moves where key like 'formats_check:%' loop
    if split_part(c.key, ':', 2) = 'format' then
      execute format('alter table public.mob_games add constraint %I check (format in (''sprint'',''round'',''rematch''))', split_part(c.key, ':', 3));
    elsif split_part(c.key, ':', 2) = 'ids' then
      execute format('alter table public.mob_games add constraint %I check (jsonb_typeof(question_ids) = ''array'' and jsonb_array_length(question_ids) between 5 and 20)', split_part(c.key, ':', 3));
    elsif split_part(c.key, ':', 2) = 'q' then
      execute format('alter table public.mob_game_answers add constraint %I check (q between 0 and 19)', split_part(c.key, ':', 3));
    end if;
    delete from public.mob_data_moves where key = c.key;
  end loop;
  alter table public.mob_games drop column if exists minutes;
  alter table public.mob_game_runs drop column if exists sheet;
  alter table public.mob_game_runs drop column if exists session_id;
  if to_regclass('public.mob_room_tickets') is not null then
    alter table public.mob_room_tickets drop constraint if exists mob_room_tickets_presence_v2;
    alter table public.mob_room_tickets drop column if exists presence;
    alter table public.mob_room_tickets drop column if exists seen_at;
  end if;
end $undo$;

drop function if exists public.mob_room_presence(text, uuid, text, timestamptz);
drop function if exists public.mob_room_roster(uuid, timestamptz);
drop function if exists public.mob_mock_record(text, uuid, text, jsonb, jsonb, timestamptz, timestamptz);
drop function if exists public.mob_mock_begin(text, uuid, timestamptz);
drop function if exists public.mob_live_open_v2(text, uuid, text, text, text, jsonb, text, date, uuid, timestamptz, integer, integer, smallint);
drop function if exists public.mob_game_open_v2(text, uuid, text, text, text, text, jsonb, text, date, uuid, timestamptz, integer, smallint);

do $undo$
begin
  if to_regclass('public.mob_games') is null then return; end if;
  execute $f$
create or replace function public.mob_run_seal(p_game_id uuid, p_user_id text, p_at timestamptz)
returns void language plpgsql security invoker set search_path = public as $$
declare r public.mob_game_runs%rowtype; n int; el int;
begin
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id for update;
  if not found or r.finished_at is not null then return; end if;
  select jsonb_array_length(question_ids) into n from public.mob_games where id = p_game_id;
  el := greatest(0, floor(extract(epoch from (least(p_at, r.ends_at) - r.started_at)) * 1000))::int;
  insert into public.mob_game_answers (game_id, user_id, q, pick, correct, answered_at, elapsed_ms)
  select p_game_id, p_user_id, g::smallint, -1, null, p_at, el from generate_series(0, n - 1) g
  where not exists (select 1 from public.mob_game_answers a where a.game_id = p_game_id and a.user_id = p_user_id and a.q = g)
  on conflict do nothing;
  update public.mob_game_runs set
    skipped_n = (select count(*) from public.mob_game_answers a where a.game_id = p_game_id and a.user_id = p_user_id and a.pick < 0),
    finished_at = least(p_at, r.ends_at)
  where game_id = p_game_id and user_id = p_user_id;
  perform public.mob_room_maybe_done(p_game_id);
end $$;
$f$;
  execute $f$
create or replace function public.mob_run_start(p_user_id text, p_game_id uuid, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare gm public.mob_games%rowtype; r public.mob_game_runs%rowtype; n int; st timestamptz; is_live boolean; s text;
begin
  select * into gm from public.mob_games where id = p_game_id;
  if not found or not exists (select 1 from public.mob_members where mob_id = gm.mob_id and user_id = p_user_id) then
    return jsonb_build_object('status', 'not_member');
  end if;
  n := jsonb_array_length(gm.question_ids);
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  if found then
    if r.finished_at is null and p_now > r.ends_at then perform public.mob_run_seal(p_game_id, p_user_id, r.ends_at); end if;
    select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
    s := case when r.finished_at is not null then 'finished' else 'resumed' end;
  else
    if p_now + make_interval(secs => n * gm.seconds_per_question) > gm.closes_at then return jsonb_build_object('status', 'closed'); end if;
    is_live := gm.room_state = 'running' and gm.room_starts_at is not null and p_now <= gm.room_starts_at + interval '30 seconds';
    st := case when is_live then gm.room_starts_at else p_now end;
    insert into public.mob_game_runs (game_id, mob_id, user_id, live, started_at, ends_at)
    values (p_game_id, gm.mob_id, p_user_id, is_live, st, st + make_interval(secs => n * gm.seconds_per_question + 60))
    on conflict do nothing;
    select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
    s := 'started';
  end if;
  return jsonb_build_object('status', s, 'started_at', r.started_at, 'ends_at', r.ends_at, 'live', r.live, 'finished_at', r.finished_at,
    'marks', r.marks, 'right_n', r.right_n, 'wrong_n', r.wrong_n, 'skipped_n', r.skipped_n,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('q', a.q, 'pick', a.pick, 'correct', a.correct, 'elapsed_ms', a.elapsed_ms) order by a.q)
      from public.mob_game_answers a where a.game_id = p_game_id and a.user_id = p_user_id), '[]'::jsonb));
end $$;
$f$;
  execute $f$
create or replace function public.mob_game_answer(p_user_id text, p_game_id uuid, p_q smallint, p_pick smallint, p_correct_index smallint, p_member_id text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare gm public.mob_games%rowtype; r public.mob_game_runs%rowtype; a public.mob_game_answers%rowtype; n int; c boolean; el int; done boolean; k int; st text;
begin
  select * into gm from public.mob_games where id = p_game_id;
  if not found then return jsonb_build_object('status', 'no_run'); end if;
  n := jsonb_array_length(gm.question_ids);
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('status', 'no_run'); end if;
  if p_q is null or p_q < 0 or p_q >= n then return jsonb_build_object('status', 'q_invalid'); end if;
  select * into a from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id and q = p_q;
  if found then
    st := 'exists';
  elsif r.finished_at is not null then
    st := 'finished';
  elsif p_now > r.ends_at then
    perform public.mob_run_seal(p_game_id, p_user_id, r.ends_at);
    st := 'expired';
  else
    c := case when p_pick < 0 then null else p_pick = p_correct_index end;
    el := greatest(0, floor(extract(epoch from (p_now - r.started_at)) * 1000))::int;
    insert into public.mob_game_answers (game_id, user_id, q, pick, correct, answered_at, elapsed_ms) values (p_game_id, p_user_id, p_q, p_pick, c, p_now, el)
    returning * into a;
    select count(*) into k from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id;
    done := k >= n;
    update public.mob_game_runs set
      right_n = right_n + (case when c is true then 1 else 0 end),
      wrong_n = wrong_n + (case when c is false then 1 else 0 end),
      skipped_n = skipped_n + (case when c is null then 1 else 0 end),
      marks = 5 * (right_n + (case when c is true then 1 else 0 end)) - (wrong_n + (case when c is false then 1 else 0 end)),
      finished_at = case when done then p_now else finished_at end
    where game_id = p_game_id and user_id = p_user_id;
    if p_pick >= 0 then
      perform public.mob_quest_tick(gm.mob_id, public.mob_ist_week(p_now), 'game', p_game_id::text, p_user_id,
        (select count(*)::int from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id and pick >= 0), p_now);
    end if;
    if r.live and gm.room_state = 'running' then
      perform public.mob_room_send(p_game_id, 'progress', jsonb_build_object('m', p_member_id, 'q', p_q + 1, 'done', done));
    end if;
    if done then perform public.mob_room_maybe_done(p_game_id); end if;
    st := 'ok';
  end if;
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  if st in ('ok', 'exists') then
    return jsonb_build_object('status', st, 'correct', a.correct, 'delta', case when a.correct is true then 5 when a.correct is false then -1 else 0 end,
      'marks', r.marks, 'elapsed_ms', a.elapsed_ms, 'finished', r.finished_at is not null, 'count', n,
      'answered', (select count(*)::int from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id));
  end if;
  return jsonb_build_object('status', st, 'marks', r.marks, 'finished', r.finished_at is not null, 'count', n,
    'answered', (select count(*)::int from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id));
end $$;
$f$;
  execute $f$
create or replace function public.mob_game_json(p_game_id uuid, p_user_id text, p_now timestamptz)
returns jsonb language sql security invoker stable set search_path = public as $$
  select jsonb_build_object('id', g.id, 'mob_id', g.mob_id, 'created_by', g.created_by, 'started_via', g.started_via, 'format', g.format,
    'mode', g.mode, 'subject', g.subject, 'chapter', g.chapter, 'question_ids', g.question_ids, 'seconds_per_question', g.seconds_per_question,
    'week_start', g.week_start, 'rematch_of', g.rematch_of, 'opened_at', g.opened_at, 'closes_at', g.closes_at, 'room_state', g.room_state,
    'room_starts_at', g.room_starts_at, 'room_ends_at', g.room_ends_at, 'closed_settled_at', g.closed_settled_at, 'closed', p_now >= g.closes_at,
    'runs', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'live', r.live, 'started_at', r.started_at, 'ends_at', r.ends_at,
        'finished_at', r.finished_at, 'marks', r.marks, 'right_n', r.right_n, 'wrong_n', r.wrong_n, 'skipped_n', r.skipped_n,
        'answered', (select count(*)::int from public.mob_game_answers a where a.game_id = r.game_id and a.user_id = r.user_id),
        'arrivals', coalesce((select jsonb_agg(a.elapsed_ms order by a.elapsed_ms, a.q) from public.mob_game_answers a where a.game_id = r.game_id and a.user_id = r.user_id), '[]'::jsonb))
      order by coalesce(r.finished_at, r.started_at), r.user_id)
      from public.mob_game_runs r where r.game_id = g.id), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object('q', a.q, 'pick', a.pick, 'correct', a.correct, 'elapsed_ms', a.elapsed_ms) order by a.q)
      from public.mob_game_answers a where a.game_id = g.id and a.user_id = p_user_id), '[]'::jsonb))
  from public.mob_games g
  where g.id = p_game_id and exists (select 1 from public.mob_members mm where mm.mob_id = g.mob_id and mm.user_id = p_user_id)
$$;
$f$;
  execute $f$
create or replace function public.mob_game_settle(p_game_id uuid, p_now timestamptz, p_trap jsonb)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found then return 'not_found'; end if;
  if p_now < g.closes_at then return 'open'; end if;
  if g.closed_settled_at is not null then return 'already'; end if;
  if p_trap is not null and jsonb_typeof(p_trap) = 'object' then
    insert into public.mob_traps (game_id, q, question_id, mob_id, opened_at, check_opens_at, check_closes_at)
    values (p_game_id, (p_trap->>'q')::smallint, p_trap->>'question_id', g.mob_id, g.closes_at, (p_trap->>'check_opens_at')::timestamptz, (p_trap->>'check_closes_at')::timestamptz)
    on conflict do nothing;
  end if;
  update public.mob_games set closed_settled_at = p_now,
    room_state = case when room_state in ('lobby', 'running') then 'done' else room_state end
  where id = p_game_id;
  delete from public.mob_reactions where mob_id = g.mob_id and created_at < p_now - interval '30 days';
  return 'settled';
end $$;
$f$;
  execute $f$
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
$f$;
  if to_regclass('public.mob_room_tickets') is not null and to_regprocedure('public.mob_room_ok(text)') is not null then
    grant execute on function public.mob_room_ok(text) to authenticated;
    if to_regclass('realtime.messages') is not null then
      drop policy if exists mob_room_receive on realtime.messages;
      create policy mob_room_receive on realtime.messages for select to authenticated
        using ( public.mob_room_ok((select realtime.topic())) );
      drop policy if exists mob_room_presence on realtime.messages;
      create policy mob_room_presence on realtime.messages for insert to authenticated
        with check ( realtime.messages.extension = 'presence' and public.mob_room_ok((select realtime.topic())) );
    end if;
  end if;
end $undo$;

drop function if exists public.mob_game_secs(text, smallint, integer, smallint);
drop schema if exists mob_private cascade;
