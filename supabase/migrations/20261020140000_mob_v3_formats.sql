-- Mob v3 formats (owner D167, 20 Oct 2:05 pm; D168/D169: two more formats in the one game picker, the same routes) and
-- the live-room fixes the 20 Oct reviews asked for before MOB_LIVE_ENABLED goes on. Additive and idempotent; service
-- role only (RLS untouched, every function security invoker with p_now passed by the API so one clock decides), except
-- the one Realtime check, which moves out of the API schema.
--   - Timed race (format 'race', minutes 5 or 10): as many questions as you can from one frozen pool, the same pool in
--     the same order for everyone, served one at a time (an answer must be for the next question). The clock is the
--     server's: the run starts at /run (a live race at the room's start), ends minutes later, and an answer counts only
--     if it arrives by then (2 s for the network). Questions left in the pool at the end are not skips. CUET marks.
--   - Full mock together (format 'mock', 60 minutes): one 50-question CUET paper for the whole Mob, open 24 hours, sat in
--     the practice runner (mode full) with its answers held until the game closes. mob_mock_begin marks the run as
--     playing; mob_mock_record writes the finished sitting (picks, counts, CUET marks, the mark sheet) on the game.
--   - Every game (web-security 20 Oct #1): a run never ends after the game closes, an answer at or after the close is
--     refused, and the settle seals every open run first, so the review can never show a key to someone still playing.
--   - L-55 (live presence): clients no longer send anything on a room's channel. The presence insert policy is dropped;
--     presence goes through the API (mob_room_presence) and the server broadcasts only { m, st }. mob_room_roster says
--     who is here or ready (heard from in the last 45 s).
--   - web-security #7: the Realtime check runs as mob_private.mob_room_ok (a schema the API does not expose);
--     public.mob_room_ok stays for the undo but nobody but the service role may call it.
-- Needs 20261020100400_mob_v3_live first (it replaces that file's mob_room_start).
-- Applied to staging only by this change. Undo: supabase/undo/20261020140000_mob_v3_formats.undo.sql

-- ---------------------------------------------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------------------------------------------

alter table public.mob_games add column if not exists minutes smallint;
alter table public.mob_game_runs add column if not exists sheet jsonb;
alter table public.mob_game_runs add column if not exists session_id text;
alter table public.mob_room_tickets add column if not exists presence text;
alter table public.mob_room_tickets add column if not exists seen_at timestamptz;

-- The old checks are found by their definition (as 20261020100000 does for the invite code) and their names recorded
-- in mob_data_moves, so the undo puts each back under the name it had.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.mob_games'::regclass and contype = 'c' and conname not like '%\_v2' escape '\'
             and pg_get_constraintdef(oid) like '%format%' and pg_get_constraintdef(oid) like '%rematch%'
  loop
    insert into public.mob_data_moves (key) values ('formats_check:format:' || c.conname) on conflict do nothing;
    execute format('alter table public.mob_games drop constraint %I', c.conname);
  end loop;
  for c in select conname from pg_constraint
           where conrelid = 'public.mob_games'::regclass and contype = 'c' and conname not like '%\_v2' escape '\'
             and pg_get_constraintdef(oid) like '%jsonb_array_length(question_ids)%'
  loop
    insert into public.mob_data_moves (key) values ('formats_check:ids:' || c.conname) on conflict do nothing;
    execute format('alter table public.mob_games drop constraint %I', c.conname);
  end loop;
  for c in select conname from pg_constraint
           where conrelid = 'public.mob_game_answers'::regclass and contype = 'c' and conname not like '%\_v2' escape '\'
             and pg_get_constraintdef(oid) like '%q <= 19%'
  loop
    insert into public.mob_data_moves (key) values ('formats_check:q:' || c.conname) on conflict do nothing;
    execute format('alter table public.mob_game_answers drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.mob_games drop constraint if exists mob_games_format_v2;
alter table public.mob_games add constraint mob_games_format_v2 check (format in ('sprint','round','rematch','race','mock'));
alter table public.mob_games drop constraint if exists mob_games_ids_v2;
alter table public.mob_games add constraint mob_games_ids_v2 check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 5 and 60);
-- A race has 5 or 10 minutes; a full mock is 60 minutes and never live; the question games have no minutes. (coalesce:
-- a null minutes must fail the check, not pass it as unknown; found by the staging dry run.)
alter table public.mob_games drop constraint if exists mob_games_shape_v2;
alter table public.mob_games add constraint mob_games_shape_v2 check (
  (format = 'race' and coalesce(minutes, 0) in (5, 10))
  or (format = 'mock' and coalesce(minutes, 0) = 60 and mode = 'async')
  or (format in ('sprint','round','rematch') and minutes is null));
alter table public.mob_game_answers drop constraint if exists mob_game_answers_q_v2;
alter table public.mob_game_answers add constraint mob_game_answers_q_v2 check (q between 0 and 59);
alter table public.mob_room_tickets drop constraint if exists mob_room_tickets_presence_v2;
alter table public.mob_room_tickets add constraint mob_room_tickets_presence_v2 check (presence is null or presence in ('here','ready'));

-- ---------------------------------------------------------------------------------------------------------------
-- Clock helpers
-- ---------------------------------------------------------------------------------------------------------------

-- A game's playing time in seconds: a race its minutes, a full mock 60 minutes, the question games n * seconds.
create or replace function public.mob_game_secs(p_format text, p_minutes smallint, p_n integer, p_spq smallint)
returns integer language sql immutable security invoker set search_path = public as $$
  select case when p_format = 'race' then p_minutes * 60 when p_format = 'mock' then coalesce(p_minutes, 60) * 60 else p_n * p_spq end
$$;

-- Seal a run: the questions not answered count as skipped at p_at (a race leaves its unserved pool alone); finished.
create or replace function public.mob_run_seal(p_game_id uuid, p_user_id text, p_at timestamptz)
returns void language plpgsql security invoker set search_path = public as $$
declare r public.mob_game_runs%rowtype; n int; el int; fmt text;
begin
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id for update;
  if not found or r.finished_at is not null then return; end if;
  select jsonb_array_length(question_ids), format into n, fmt from public.mob_games where id = p_game_id;
  el := greatest(0, floor(extract(epoch from (least(p_at, r.ends_at) - r.started_at)) * 1000))::int;
  if fmt is distinct from 'race' then
    insert into public.mob_game_answers (game_id, user_id, q, pick, correct, answered_at, elapsed_ms)
    select p_game_id, p_user_id, g::smallint, -1, null, p_at, el from generate_series(0, n - 1) g
    where not exists (select 1 from public.mob_game_answers a where a.game_id = p_game_id and a.user_id = p_user_id and a.q = g)
    on conflict do nothing;
  end if;
  update public.mob_game_runs set
    skipped_n = (select count(*) from public.mob_game_answers a where a.game_id = p_game_id and a.user_id = p_user_id and a.pick < 0),
    finished_at = greatest(r.started_at, least(p_at, r.ends_at))
  where game_id = p_game_id and user_id = p_user_id;
  perform public.mob_room_maybe_done(p_game_id);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Open (with minutes)
-- ---------------------------------------------------------------------------------------------------------------

-- mob_game_open with the race's or the mock's minutes. { status: ok | not_member | rematch_invalid | open_limit |
-- room_open | start_used | mic_none, id }. The claim and the mic are taken under the Mob lock, as in mob_game_open.
create or replace function public.mob_game_open_v2(p_user_id text, p_mob_id uuid, p_format text, p_mode text, p_subject text, p_chapter text,
  p_ids jsonb, p_via text, p_week date, p_rematch_of uuid, p_now timestamptz, p_max_open integer, p_minutes smallint)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare g uuid; n int; mic uuid;
begin
  perform pg_advisory_xact_lock(hashtext('mob:' || p_mob_id::text));
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if p_rematch_of is not null and not exists (select 1 from public.mob_games where id = p_rematch_of and mob_id = p_mob_id) then
    return jsonb_build_object('status', 'rematch_invalid');
  end if;
  select count(*) into n from public.mob_games where mob_id = p_mob_id and closes_at > p_now;
  if n >= greatest(coalesce(p_max_open, 3), 1) then return jsonb_build_object('status', 'open_limit'); end if;
  if p_mode = 'live' and exists (select 1 from public.mob_games where mob_id = p_mob_id and room_state in ('lobby', 'running')) then
    return jsonb_build_object('status', 'room_open');
  end if;
  if p_via = 'free_weekly' then
    insert into public.mob_start_claims (user_id, mob_id, week_start) values (p_user_id, p_mob_id, p_week) on conflict do nothing;
    if not found then return jsonb_build_object('status', 'start_used'); end if;
  elsif p_via = 'mic' then
    select id into mic from public.mob_mics where receiver_id = p_user_id and mob_id = p_mob_id and week_start = p_week and used_game_id is null
      order by given_at, id limit 1 for update;
    if mic is null then return jsonb_build_object('status', 'mic_none'); end if;
  end if;
  insert into public.mob_games (mob_id, created_by, started_via, format, mode, subject, chapter, question_ids, seconds_per_question, minutes,
    week_start, rematch_of, opened_at, closes_at, room_state)
  values (p_mob_id, p_user_id, p_via, p_format, p_mode, p_subject, p_chapter, p_ids, case when p_format = 'mock' then 72 else 60 end,
    case when p_format in ('race', 'mock') then p_minutes end, p_week, p_rematch_of, p_now, p_now + interval '24 hours',
    case when p_mode = 'live' then 'lobby' end)
  returning id into g;
  if p_via = 'free_weekly' then update public.mob_start_claims set game_id = g where user_id = p_user_id and mob_id = p_mob_id and week_start = p_week; end if;
  if mic is not null then update public.mob_mics set used_game_id = g where id = mic; end if;
  return jsonb_build_object('status', 'ok', 'id', g);
end $$;

-- mob_live_open with minutes: the global room cap under one lock, then mob_game_open_v2. { status: busy | ..., id }
create or replace function public.mob_live_open_v2(p_user_id text, p_mob_id uuid, p_format text, p_subject text, p_chapter text,
  p_ids jsonb, p_via text, p_week date, p_rematch_of uuid, p_now timestamptz, p_max_open integer, p_max_rooms integer, p_minutes smallint)
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
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if exists (select 1 from public.mob_games where mob_id = p_mob_id and room_state in ('lobby', 'running')) then return jsonb_build_object('status', 'room_open'); end if;
  select count(*) into n from public.mob_games where room_state in ('lobby', 'running');
  if n >= greatest(coalesce(p_max_rooms, 30), 0) then return jsonb_build_object('status', 'busy'); end if;
  return public.mob_game_open_v2(p_user_id, p_mob_id, p_format, 'live', p_subject, p_chapter, p_ids, p_via, p_week, p_rematch_of, p_now, p_max_open, p_minutes);
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Runs and answers
-- ---------------------------------------------------------------------------------------------------------------

-- Start or resume your run. { status: started | resumed | finished | closed | not_member | not_started | paper,
-- started_at, ends_at, live, minutes, finished_at, marks, right_n, wrong_n, skipped_n, answers (your own) }.
--   - A run never ends after the game closes (ends_at is capped at closes_at), and one that cannot finish is refused.
--   - A live room's run starts at the room's start: asked for before it, the answer is not_started (nothing served).
--   - A full mock is sat in the practice runner: 'paper'.
create or replace function public.mob_run_start(p_user_id text, p_game_id uuid, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare gm public.mob_games%rowtype; r public.mob_game_runs%rowtype; n int; secs int; st timestamptz; is_live boolean; s text;
  grace interval;
begin
  select * into gm from public.mob_games where id = p_game_id;
  if not found or not exists (select 1 from public.mob_members where mob_id = gm.mob_id and user_id = p_user_id) then
    return jsonb_build_object('status', 'not_member');
  end if;
  if gm.format = 'mock' then return jsonb_build_object('status', 'paper'); end if;
  n := jsonb_array_length(gm.question_ids);
  secs := public.mob_game_secs(gm.format, gm.minutes, n, gm.seconds_per_question);
  grace := case when gm.format = 'race' then interval '2 seconds' else interval '0' end;
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  if found then
    if r.finished_at is null and (p_now > r.ends_at + grace or p_now >= gm.closes_at) then
      perform public.mob_run_seal(p_game_id, p_user_id, least(r.ends_at, gm.closes_at));
    end if;
    select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
    s := case when r.finished_at is not null then 'finished' else 'resumed' end;
  else
    if p_now + make_interval(secs => secs) > gm.closes_at then return jsonb_build_object('status', 'closed'); end if;
    if gm.room_state = 'running' and gm.room_starts_at is not null and p_now < gm.room_starts_at then
      return jsonb_build_object('status', 'not_started', 'starts_at', gm.room_starts_at);
    end if;
    is_live := gm.room_state = 'running' and gm.room_starts_at is not null and p_now <= gm.room_starts_at + interval '30 seconds';
    st := case when is_live then gm.room_starts_at else p_now end;
    insert into public.mob_game_runs (game_id, mob_id, user_id, live, started_at, ends_at)
    values (p_game_id, gm.mob_id, p_user_id, is_live, st,
      least(st + make_interval(secs => secs + case when gm.format = 'race' then 0 else 60 end), gm.closes_at))
    on conflict do nothing;
    select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
    s := 'started';
  end if;
  return jsonb_build_object('status', s, 'started_at', r.started_at, 'ends_at', r.ends_at, 'live', r.live, 'minutes', gm.minutes, 'finished_at', r.finished_at,
    'marks', r.marks, 'right_n', r.right_n, 'wrong_n', r.wrong_n, 'skipped_n', r.skipped_n,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('q', a.q, 'pick', a.pick, 'correct', a.correct, 'elapsed_ms', a.elapsed_ms) order by a.q)
      from public.mob_game_answers a where a.game_id = p_game_id and a.user_id = p_user_id), '[]'::jsonb));
end $$;

-- Lock in one answer. { status: ok | exists | expired | finished | no_run | q_invalid | not_started, correct, delta,
-- marks, elapsed_ms, finished, answered, count, ends_at }. The key arrives from the bank through the API
-- (p_correct_index); it is never in the request or the response. Every time is the server's.
--   - At or after the game's close nothing is accepted (the run is sealed): the review opens only on finished runs.
--   - A race takes the next question only (q = answers so far), counts an answer that arrives by ends_at + 2 s, and its
--     elapsed time never passes the race's minutes. Its progress broadcast says how many are answered.
create or replace function public.mob_game_answer(p_user_id text, p_game_id uuid, p_q smallint, p_pick smallint, p_correct_index smallint, p_member_id text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare gm public.mob_games%rowtype; r public.mob_game_runs%rowtype; a public.mob_game_answers%rowtype; n int; c boolean; el int; done boolean; k int; st text;
  secs int; is_race boolean; grace interval;
begin
  select * into gm from public.mob_games where id = p_game_id;
  if not found then return jsonb_build_object('status', 'no_run'); end if;
  n := jsonb_array_length(gm.question_ids);
  is_race := gm.format = 'race';
  secs := public.mob_game_secs(gm.format, gm.minutes, n, gm.seconds_per_question);
  grace := case when is_race then interval '2 seconds' else interval '0' end;
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id for update;
  if not found then return jsonb_build_object('status', 'no_run'); end if;
  if p_q is null or p_q < 0 or p_q >= n then return jsonb_build_object('status', 'q_invalid'); end if;
  select * into a from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id and q = p_q;
  if found then
    st := 'exists';
  elsif r.finished_at is not null then
    st := 'finished';
  elsif p_now > r.ends_at + grace or p_now >= gm.closes_at then
    perform public.mob_run_seal(p_game_id, p_user_id, least(r.ends_at, gm.closes_at));
    st := 'expired';
  elsif p_now < r.started_at then
    st := 'not_started';
  elsif is_race and p_q <> (select count(*) from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id) then
    st := 'q_invalid';
  else
    c := case when p_pick < 0 then null else p_pick = p_correct_index end;
    el := greatest(0, floor(extract(epoch from (p_now - r.started_at)) * 1000))::int;
    if is_race then el := least(el, secs * 1000); end if;
    insert into public.mob_game_answers (game_id, user_id, q, pick, correct, answered_at, elapsed_ms) values (p_game_id, p_user_id, p_q, p_pick, c, p_now, el)
    returning * into a;
    select count(*) into k from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id;
    -- Done when the pool or paper is used; a race answer that landed in the 2 s after the end also ends the race.
    done := k >= n or (is_race and p_now >= r.ends_at);
    update public.mob_game_runs set
      right_n = right_n + (case when c is true then 1 else 0 end),
      wrong_n = wrong_n + (case when c is false then 1 else 0 end),
      skipped_n = skipped_n + (case when c is null then 1 else 0 end),
      marks = 5 * (right_n + (case when c is true then 1 else 0 end)) - (wrong_n + (case when c is false then 1 else 0 end)),
      finished_at = case when done then least(p_now, r.ends_at) else finished_at end
    where game_id = p_game_id and user_id = p_user_id;
    if p_pick >= 0 then
      perform public.mob_quest_tick(gm.mob_id, public.mob_ist_week(p_now), 'game', p_game_id::text, p_user_id,
        (select count(*)::int from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id and pick >= 0), p_now);
    end if;
    if r.live and gm.room_state = 'running' then
      perform public.mob_room_send(p_game_id, 'progress', jsonb_build_object('m', p_member_id, 'q', case when is_race then k else p_q + 1 end, 'done', done));
    end if;
    if done then perform public.mob_room_maybe_done(p_game_id); end if;
    st := 'ok';
  end if;
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  if st in ('ok', 'exists') then
    return jsonb_build_object('status', st, 'correct', a.correct, 'delta', case when a.correct is true then 5 when a.correct is false then -1 else 0 end,
      'marks', r.marks, 'elapsed_ms', a.elapsed_ms, 'finished', r.finished_at is not null, 'count', n, 'ends_at', r.ends_at,
      'answered', (select count(*)::int from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id));
  end if;
  return jsonb_build_object('status', st, 'marks', r.marks, 'finished', r.finished_at is not null, 'count', n, 'ends_at', r.ends_at, 'starts_at', r.started_at,
    'answered', (select count(*)::int from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id));
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Full mock together: the sitting is the practice runner's (mode full); these two put it on the game.
-- ---------------------------------------------------------------------------------------------------------------

-- The member opened the paper: the run reads as playing. { status: started | resumed | finished | closed | not_member |
-- not_mock, started_at }. Refused (closed) when the 60 minutes no longer fit before the close.
create or replace function public.mob_mock_begin(p_user_id text, p_game_id uuid, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare gm public.mob_games%rowtype; r public.mob_game_runs%rowtype;
begin
  select * into gm from public.mob_games where id = p_game_id;
  if not found or not exists (select 1 from public.mob_members where mob_id = gm.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if gm.format <> 'mock' then return jsonb_build_object('status', 'not_mock'); end if;
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  if found then
    return jsonb_build_object('status', case when r.finished_at is not null then 'finished' else 'resumed' end, 'started_at', r.started_at);
  end if;
  if p_now + make_interval(secs => public.mob_game_secs(gm.format, gm.minutes, 50, gm.seconds_per_question)) > gm.closes_at then
    return jsonb_build_object('status', 'closed');
  end if;
  -- ends_at: the paper's 60 minutes plus the runner's 2-minute upload grace, never past the close.
  insert into public.mob_game_runs (game_id, mob_id, user_id, live, started_at, ends_at)
  values (p_game_id, gm.mob_id, p_user_id, false, p_now, least(p_now + interval '62 minutes', gm.closes_at))
  on conflict do nothing;
  return jsonb_build_object('status', 'started', 'started_at', p_now);
end $$;

-- A finished full-mock sitting. p_answers: [{ q, pick (-1 = not answered), correct (null for not answered) }] in paper
-- order, scored by the runner from the server's snapshot; p_sheet: the mark sheet (sections) the API built. The time
-- is the server's: finished minus started, at most 60 minutes. { status: recorded | exists | late | not_member |
-- not_mock }. A sitting finished at or after the close is late and not recorded.
create or replace function public.mob_mock_record(p_user_id text, p_game_id uuid, p_session_id text, p_answers jsonb, p_sheet jsonb,
  p_sat_at timestamptz, p_now timestamptz)
returns text language plpgsql security invoker set search_path = public as $$
declare gm public.mob_games%rowtype; r public.mob_game_runs%rowtype; n int; rt int; wr int; sk int; ans int; ms int;
begin
  select * into gm from public.mob_games where id = p_game_id for update;
  if not found or gm.format <> 'mock' then return 'not_mock'; end if;
  if not exists (select 1 from public.mob_members where mob_id = gm.mob_id and user_id = p_user_id) then return 'not_member'; end if;
  if p_sat_at is null or p_sat_at >= gm.closes_at or p_sat_at < gm.opened_at then return 'late'; end if;
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id for update;
  if found and r.finished_at is not null then return 'exists'; end if;
  if not found then
    insert into public.mob_game_runs (game_id, mob_id, user_id, live, started_at, ends_at)
    values (p_game_id, gm.mob_id, p_user_id, false, greatest(gm.opened_at, p_sat_at - interval '60 minutes'), least(p_sat_at + interval '2 minutes', gm.closes_at));
    select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id for update;
  end if;
  n := jsonb_array_length(gm.question_ids);
  insert into public.mob_game_answers (game_id, user_id, q, pick, correct, answered_at, elapsed_ms)
  select p_game_id, p_user_id, s.i::smallint,
    case when (e->>'pick') ~ '^-?[0-9]$' and (e->>'pick')::int between -1 and 3 then (e->>'pick')::smallint else -1 end,
    case when (e->>'pick') ~ '^[0-3]$' and jsonb_typeof(e->'correct') = 'boolean' then (e->>'correct')::boolean end,
    p_sat_at, 0
  from generate_series(0, n - 1) s(i) left join lateral (select p_answers->s.i e) x on true
  on conflict do nothing;
  select count(*) filter (where correct is true), count(*) filter (where correct is false), count(*) filter (where correct is null), count(*) filter (where pick >= 0)
    into rt, wr, sk, ans
  from public.mob_game_answers where game_id = p_game_id and user_id = p_user_id;
  ms := least(3600000, greatest(0, floor(extract(epoch from (p_sat_at - r.started_at)) * 1000)))::int;
  update public.mob_game_runs set right_n = rt, wrong_n = wr, skipped_n = sk, marks = 5 * rt - wr, finished_at = p_sat_at,
    session_id = left(p_session_id, 120), sheet = coalesce(p_sheet, '{}'::jsonb) || jsonb_build_object('timeMs', ms)
  where game_id = p_game_id and user_id = p_user_id;
  if ans > 0 then perform public.mob_quest_tick(gm.mob_id, public.mob_ist_week(p_sat_at), 'game', p_game_id::text, p_user_id, ans, p_now); end if;
  return 'recorded';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Reads and the settle
-- ---------------------------------------------------------------------------------------------------------------

-- The game as the server reads it (as 20261020100100, plus minutes, and each run's mark sheet and session id).
-- Another member's picks are never in this JSON.
create or replace function public.mob_game_json(p_game_id uuid, p_user_id text, p_now timestamptz)
returns jsonb language sql security invoker stable set search_path = public as $$
  select jsonb_build_object('id', g.id, 'mob_id', g.mob_id, 'created_by', g.created_by, 'started_via', g.started_via, 'format', g.format,
    'mode', g.mode, 'subject', g.subject, 'chapter', g.chapter, 'question_ids', g.question_ids, 'seconds_per_question', g.seconds_per_question,
    'minutes', g.minutes,
    'week_start', g.week_start, 'rematch_of', g.rematch_of, 'opened_at', g.opened_at, 'closes_at', g.closes_at, 'room_state', g.room_state,
    'room_starts_at', g.room_starts_at, 'room_ends_at', g.room_ends_at, 'closed_settled_at', g.closed_settled_at, 'closed', p_now >= g.closes_at,
    'runs', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'live', r.live, 'started_at', r.started_at, 'ends_at', r.ends_at,
        'finished_at', r.finished_at, 'marks', r.marks, 'right_n', r.right_n, 'wrong_n', r.wrong_n, 'skipped_n', r.skipped_n,
        'sheet', r.sheet, 'session_id', r.session_id,
        'answered', (select count(*)::int from public.mob_game_answers a where a.game_id = r.game_id and a.user_id = r.user_id),
        'arrivals', coalesce((select jsonb_agg(a.elapsed_ms order by a.elapsed_ms, a.q) from public.mob_game_answers a where a.game_id = r.game_id and a.user_id = r.user_id), '[]'::jsonb))
      order by coalesce(r.finished_at, r.started_at), r.user_id)
      from public.mob_game_runs r where r.game_id = g.id), '[]'::jsonb),
    'mine', coalesce((select jsonb_agg(jsonb_build_object('q', a.q, 'pick', a.pick, 'correct', a.correct, 'elapsed_ms', a.elapsed_ms) order by a.q)
      from public.mob_game_answers a where a.game_id = g.id and a.user_id = p_user_id), '[]'::jsonb))
  from public.mob_games g
  where g.id = p_game_id and exists (select 1 from public.mob_members mm where mm.mob_id = g.mob_id and mm.user_id = p_user_id)
$$;

-- Once, after close. Every run still open is sealed at the close first (a full mock that was never handed in leaves no
-- run), then the trap (computed in src/lib/mob/games.mjs and passed in) and the 30-day sticker cleanup.
-- settled | already | open | not_found
create or replace function public.mob_game_settle(p_game_id uuid, p_now timestamptz, p_trap jsonb)
returns text language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype; u text;
begin
  select * into g from public.mob_games where id = p_game_id for update;
  if not found then return 'not_found'; end if;
  if p_now < g.closes_at then return 'open'; end if;
  if g.closed_settled_at is not null then return 'already'; end if;
  if g.format = 'mock' then
    delete from public.mob_game_runs where game_id = p_game_id and finished_at is null;
  else
    for u in select user_id from public.mob_game_runs where game_id = p_game_id and finished_at is null loop
      perform public.mob_run_seal(p_game_id, u, g.closes_at);
    end loop;
  end if;
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

-- ---------------------------------------------------------------------------------------------------------------
-- Live rooms
-- ---------------------------------------------------------------------------------------------------------------

-- The host starts the room (as 20261020100400): the end is the game's playing time plus 60 s grace (a race: 10 s).
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
    room_ends_at = p_starts_at + make_interval(secs => public.mob_game_secs(g.format, g.minutes, jsonb_array_length(g.question_ids), g.seconds_per_question)
      + case when g.format = 'race' then 10 else 60 end)
  where id = p_game_id;
  perform public.mob_room_send(p_game_id, 'room.start', jsonb_build_object('startsAt', p_starts_at));
  return 'ok';
end $$;

-- Who is in the room: [{ m, st }] for every live ticket heard from in the last 45 seconds, by member id. No names.
create or replace function public.mob_room_roster(p_game_id uuid, p_now timestamptz)
returns jsonb language sql security invoker stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('m', x.member_id, 'st', x.presence) order by x.member_id), '[]'::jsonb)
  from (select distinct on (t.member_id) t.member_id, t.presence from public.mob_room_tickets t
        where t.game_id = p_game_id and t.revoked_at is null and t.expires_at > p_now and t.presence is not null
          and t.seen_at > p_now - interval '45 seconds'
        order by t.member_id, (t.presence = 'ready') desc, t.seen_at desc) x
$$;

-- L-55: presence through the API, never from a client on the channel. p_st: here | ready | left. The member must hold a
-- live ticket for the room. A change (or a member heard from again after 45 s) is broadcast as presence { m, st }, with
-- the member id from the ticket. { status: ok | not_member | not_live | room_closed | no_ticket, roster }
create or replace function public.mob_room_presence(p_user_id text, p_game_id uuid, p_st text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare g public.mob_games%rowtype; t public.mob_room_tickets%rowtype; before text; after text;
begin
  if p_st is null or p_st not in ('here', 'ready', 'left') then return jsonb_build_object('status', 'not_live'); end if;
  select * into g from public.mob_games where id = p_game_id;
  if not found or not exists (select 1 from public.mob_members where mob_id = g.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  if g.mode <> 'live' or g.room_state is null then return jsonb_build_object('status', 'not_live'); end if;
  if public.mob_room_tidy(p_game_id, p_now) in ('done', 'cancelled') and p_st <> 'left' then return jsonb_build_object('status', 'room_closed'); end if;
  select * into t from public.mob_room_tickets
  where game_id = p_game_id and user_id = p_user_id and revoked_at is null and expires_at > p_now
  order by issued_at desc limit 1 for update;
  if not found then return jsonb_build_object('status', 'no_ticket'); end if;
  before := case when t.seen_at > p_now - interval '45 seconds' then t.presence end;
  after := case when p_st = 'left' then null else p_st end;
  update public.mob_room_tickets set presence = after, seen_at = case when after is null then null else p_now end
  where game_id = p_game_id and user_id = p_user_id and revoked_at is null;
  if before is distinct from after then
    perform public.mob_room_send(p_game_id, 'presence', jsonb_build_object('m', t.member_id, 'st', coalesce(after, 'left')));
  end if;
  return jsonb_build_object('status', 'ok', 'roster', public.mob_room_roster(p_game_id, p_now));
end $$;

-- web-security #7: the check the Realtime policy runs lives in a schema PostgREST does not expose. Same body.
create schema if not exists mob_private;
revoke all on schema mob_private from public;
grant usage on schema mob_private to authenticated, service_role;
create or replace function mob_private.mob_room_ok(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_topic like 'mob-room:%' and exists (
    select 1 from public.mob_room_tickets t
    where t.game_id::text = substr(p_topic, 10)
      and t.auth_uid = (select auth.uid())
      and t.revoked_at is null and t.expires_at > now())
$$;
revoke all on function mob_private.mob_room_ok(text) from public, anon;
grant execute on function mob_private.mob_room_ok(text) to authenticated, service_role;
revoke execute on function public.mob_room_ok(text) from authenticated;

-- L-55: receive only. No insert policy for clients on a room: no presence, no broadcast, nothing a client writes reaches
-- another member. Every event comes from the server (realtime.send in SQL).
do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists mob_room_presence on realtime.messages;
    drop policy if exists mob_room_receive on realtime.messages;
    create policy mob_room_receive on realtime.messages for select to authenticated
      using ( mob_private.mob_room_ok((select realtime.topic())) );
  end if;
end $$;

-- ---------- Grants: service role only ----------
revoke all on function public.mob_game_secs(text, smallint, integer, smallint), public.mob_run_seal(uuid, text, timestamptz),
  public.mob_game_open_v2(text, uuid, text, text, text, text, jsonb, text, date, uuid, timestamptz, integer, smallint),
  public.mob_live_open_v2(text, uuid, text, text, text, jsonb, text, date, uuid, timestamptz, integer, integer, smallint),
  public.mob_run_start(text, uuid, timestamptz), public.mob_game_answer(text, uuid, smallint, smallint, smallint, text, timestamptz),
  public.mob_mock_begin(text, uuid, timestamptz), public.mob_mock_record(text, uuid, text, jsonb, jsonb, timestamptz, timestamptz),
  public.mob_game_json(uuid, text, timestamptz), public.mob_game_settle(uuid, timestamptz, jsonb),
  public.mob_room_start(text, uuid, timestamptz, timestamptz), public.mob_room_roster(uuid, timestamptz), public.mob_room_presence(text, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mob_game_secs(text, smallint, integer, smallint), public.mob_run_seal(uuid, text, timestamptz),
  public.mob_game_open_v2(text, uuid, text, text, text, text, jsonb, text, date, uuid, timestamptz, integer, smallint),
  public.mob_live_open_v2(text, uuid, text, text, text, jsonb, text, date, uuid, timestamptz, integer, integer, smallint),
  public.mob_run_start(text, uuid, timestamptz), public.mob_game_answer(text, uuid, smallint, smallint, smallint, text, timestamptz),
  public.mob_mock_begin(text, uuid, timestamptz), public.mob_mock_record(text, uuid, text, jsonb, jsonb, timestamptz, timestamptz),
  public.mob_game_json(uuid, text, timestamptz), public.mob_game_settle(uuid, timestamptz, jsonb),
  public.mob_room_start(text, uuid, timestamptz, timestamptz), public.mob_room_roster(uuid, timestamptz), public.mob_room_presence(text, uuid, text, timestamptz)
  to service_role;
