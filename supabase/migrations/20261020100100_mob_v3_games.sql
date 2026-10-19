-- Mob v3, games (MOB-BUILD-SPEC-V3 section 2.2; owner D127, D133; C-dec 2). Additive and idempotent; service role
-- only (RLS on, no anon or authenticated policy, every function security invoker with p_now passed by the API so one
-- clock decides).
--   - A game is a frozen paper of 5 to 20 questions a member starts, open for 24 hours. Runs and answers are graded on
--     the server: the key comes from the bank through the API (p_correct_index), never from the client, and no
--     correct option or explanation leaves for a game before closes_at (F1). Another member's picks never leave
--     mob_game_json; mob_game_picks_closed answers only after close.
--   - Free starts: one per member, Mob and IST week (mob_start_claims, outliving the membership), and Pass the mic
--     (mob_mics, 2 to give a week). Both are claimed under the Mob lock, so two taps cannot both start.
--   - The weekly quest: ticks of answered questions with no user id (leaving never lowers a quest, F8), and mob_weeks.
--   - Traps (after close) and Fix it together: the "now" question and the Wednesday check.
--   - mob_record_sitting and mob_extra_record (same signatures) also tick the quest.
-- Live rooms (room_state, realtime.send) are Phase B: the send is guarded, so a missing Realtime never fails an answer.
-- Applied to staging only by this change. Undo: supabase/undo/20261020100100_mob_v3_games.undo.sql

create table if not exists public.mob_games (
  id uuid primary key default gen_random_uuid(),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  created_by text references public.users(id) on delete set null,
  started_via text not null check (started_via in ('open','pro','free_weekly','mic')),
  format text not null check (format in ('sprint','round','rematch')),
  mode text not null check (mode in ('live','async')),
  subject text not null,
  chapter text check (chapter is null or char_length(chapter) <= 120),
  question_ids jsonb not null check (jsonb_typeof(question_ids) = 'array' and jsonb_array_length(question_ids) between 5 and 20),
  seconds_per_question smallint not null default 60 check (seconds_per_question between 30 and 120),
  week_start date not null,
  rematch_of uuid references public.mob_games(id) on delete set null,
  opened_at timestamptz not null default now(),
  closes_at timestamptz not null,
  room_state text check (room_state in ('lobby','running','done','cancelled')),
  room_starts_at timestamptz,
  room_ends_at timestamptz,
  closed_settled_at timestamptz
);
create index if not exists mob_games_mob_idx on public.mob_games (mob_id, opened_at desc);
create index if not exists mob_games_open_idx on public.mob_games (mob_id) where closed_settled_at is null;

create table if not exists public.mob_game_runs (
  game_id uuid not null references public.mob_games(id) on delete cascade,
  mob_id uuid not null,
  user_id text not null,
  live boolean not null default false,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  finished_at timestamptz,
  right_n smallint not null default 0, wrong_n smallint not null default 0, skipped_n smallint not null default 0,
  marks smallint not null default 0,
  primary key (game_id, user_id),
  foreign key (mob_id, user_id) references public.mob_members(mob_id, user_id) on delete cascade
);

create table if not exists public.mob_game_answers (
  game_id uuid not null, user_id text not null, q smallint not null check (q between 0 and 19),
  pick smallint not null check (pick between -1 and 3),
  correct boolean,
  answered_at timestamptz not null default clock_timestamp(),
  elapsed_ms integer not null check (elapsed_ms >= 0),
  primary key (game_id, user_id, q),
  foreign key (game_id, user_id) references public.mob_game_runs(game_id, user_id) on delete cascade
);

create table if not exists public.mob_start_claims (
  user_id text not null references public.users(id) on delete cascade,
  mob_id uuid not null, week_start date not null, game_id uuid,
  claimed_at timestamptz not null default now(),
  primary key (user_id, mob_id, week_start)
);

create table if not exists public.mob_mics (
  id uuid primary key default gen_random_uuid(),
  mob_id uuid not null references public.mobs(id) on delete cascade,
  giver_id text references public.users(id) on delete set null,
  receiver_id text not null references public.users(id) on delete cascade,
  week_start date not null,
  given_at timestamptz not null default now(),
  used_game_id uuid references public.mob_games(id) on delete set null
);
create index if not exists mob_mics_giver_idx on public.mob_mics (giver_id, week_start);
create index if not exists mob_mics_receiver_idx on public.mob_mics (receiver_id, mob_id, week_start) where used_game_id is null;

create table if not exists public.mob_quest_ticks (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  week_start date not null,
  source text not null check (source in ('paper','extra','game','fix')),
  source_id text not null,
  source_key text not null,
  answered smallint not null default 0 check (answered >= 0),
  primary key (mob_id, source_key)
);
create index if not exists mob_quest_ticks_week_idx on public.mob_quest_ticks (mob_id, week_start);

create table if not exists public.mob_weeks (
  mob_id uuid not null references public.mobs(id) on delete cascade,
  week_start date not null,
  target smallint not null,
  answered integer not null default 0,
  done_at timestamptz,
  pass_used boolean not null default false,
  settled_at timestamptz,
  primary key (mob_id, week_start)
);

create table if not exists public.mob_traps (
  game_id uuid not null references public.mob_games(id) on delete cascade,
  q smallint not null, question_id text not null, mob_id uuid not null,
  opened_at timestamptz not null,
  check_opens_at timestamptz not null,
  check_closes_at timestamptz not null,
  fixed_at timestamptz,
  primary key (game_id, q)
);
create table if not exists public.mob_fix_checks (
  game_id uuid not null, q smallint not null, user_id text not null,
  stage text not null check (stage in ('now','check')),
  question_id text not null,
  correct boolean,
  issued_at timestamptz not null default now(), answered_at timestamptz,
  primary key (game_id, q, user_id, stage),
  foreign key (game_id, q) references public.mob_traps(game_id, q) on delete cascade
);

-- ---------------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------------

-- Monday (IST) of the week holding p_at.
create or replace function public.mob_ist_week(p_at timestamptz)
returns date language sql security invoker stable set search_path = public as $$
  select date_trunc('week', p_at at time zone 'Asia/Kolkata')::date
$$;

-- A server broadcast to a live room (Phase B). Never fails the caller: no Realtime, no broadcast.
create or replace function public.mob_room_send(p_game_id uuid, p_event text, p_payload jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  begin
    execute 'select realtime.send($1, $2, $3, true)' using p_payload, p_event, 'mob-room:' || p_game_id::text;
  exception when others then null;
  end;
end $$;

-- When a running room's last live run finishes, the room is done (room.done carries nothing).
create or replace function public.mob_room_maybe_done(p_game_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if exists (select 1 from public.mob_games where id = p_game_id and room_state = 'running')
     and not exists (select 1 from public.mob_game_runs where game_id = p_game_id and live and finished_at is null) then
    update public.mob_games set room_state = 'done' where id = p_game_id;
    perform public.mob_room_send(p_game_id, 'room.done', '{}'::jsonb);
  end if;
end $$;

-- The quest week: target (15 a member not stepped out, at least 15; frozen once settled), answered (true past the
-- goal), done_at (set once, the moment it was reached), by source (games and papers, never people).
create or replace function public.mob_quest_week(p_mob_id uuid, p_week date, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare w public.mob_weeks%rowtype; n int; outs int; tgt int; ans int; ended boolean;
begin
  ended := p_now >= ((p_week + 7)::timestamp at time zone 'Asia/Kolkata');
  select coalesce(sum(answered), 0)::int into ans from public.mob_quest_ticks where mob_id = p_mob_id and week_start = p_week;
  select count(*)::int into n from public.mob_members where mob_id = p_mob_id;
  select count(*)::int into outs from public.mob_step_outs s
    where s.mob_id = p_mob_id and s.week_start = p_week and exists (select 1 from public.mob_members m where m.mob_id = s.mob_id and m.user_id = s.user_id);
  tgt := greatest(15, 15 * (n - outs));
  if n = 0 then return null; end if;
  insert into public.mob_weeks as mw (mob_id, week_start, target, answered, done_at, settled_at)
  values (p_mob_id, p_week, tgt, ans, case when ans >= tgt then p_now end, case when ended then p_now end)
  on conflict (mob_id, week_start) do update set
    target = case when mw.settled_at is null then excluded.target else mw.target end,
    answered = excluded.answered,
    done_at = coalesce(mw.done_at, case when excluded.answered >= (case when mw.settled_at is null then excluded.target else mw.target end) then p_now end),
    settled_at = coalesce(mw.settled_at, excluded.settled_at)
  returning * into w;
  return jsonb_build_object('target', w.target, 'answered', w.answered, 'done_at', w.done_at, 'settled_at', w.settled_at,
    'members', n, 'step_outs', outs,
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('source', t.source, 'source_id', t.source_id, 'answered', t.answered) order by t.source, t.source_id)
      from (select source, source_id, sum(answered)::int answered from public.mob_quest_ticks where mob_id = p_mob_id and week_start = p_week group by source, source_id) t), '[]'::jsonb));
end $$;

-- One sitting's answered questions for the quest. The key hides the user (md5(source_id:user)); the row keeps no user id.
create or replace function public.mob_quest_tick(p_mob_id uuid, p_week date, p_source text, p_source_id text, p_user_id text, p_answered integer, p_now timestamptz)
returns void language plpgsql security invoker set search_path = public as $$
declare k text := md5(p_source_id || ':' || p_user_id); wk date;
begin
  insert into public.mob_quest_ticks as t (mob_id, week_start, source, source_id, source_key, answered)
  values (p_mob_id, p_week, p_source, p_source_id, k, greatest(0, p_answered))
  on conflict (mob_id, source_key) do update set answered = greatest(t.answered, excluded.answered)
  returning week_start into wk;
  perform public.mob_quest_week(p_mob_id, wk, p_now);
end $$;

-- Seal a run: the questions not answered count as skipped at p_at; the run is finished.
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

-- ---------------------------------------------------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------------------------------------------------

-- Open a game. { status: ok | not_member | rematch_invalid | open_limit | room_open | start_used | mic_none, id }.
-- The API decided the start right (src/lib/mob/starts.mjs) from facts it read; the claim and the mic are taken here,
-- under the Mob lock, so two taps cannot both start a game on one free start or one mic.
create or replace function public.mob_game_open(p_user_id text, p_mob_id uuid, p_format text, p_mode text, p_subject text, p_chapter text,
  p_ids jsonb, p_via text, p_week date, p_rematch_of uuid, p_now timestamptz, p_max_open integer)
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
  insert into public.mob_games (mob_id, created_by, started_via, format, mode, subject, chapter, question_ids, week_start, rematch_of, opened_at, closes_at, room_state)
  values (p_mob_id, p_user_id, p_via, p_format, p_mode, p_subject, p_chapter, p_ids, p_week, p_rematch_of, p_now, p_now + interval '24 hours',
    case when p_mode = 'live' then 'lobby' end)
  returning id into g;
  if p_via = 'free_weekly' then update public.mob_start_claims set game_id = g where user_id = p_user_id and mob_id = p_mob_id and week_start = p_week; end if;
  if mic is not null then update public.mob_mics set used_game_id = g where id = mic; end if;
  return jsonb_build_object('status', 'ok', 'id', g);
end $$;

-- Start or resume your run. { status: started | resumed | finished | closed | not_member, started_at, ends_at, live,
-- finished_at, marks, answers: [{ q, pick, correct, elapsed_ms }] (your own) }.
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

-- Lock in one answer. { status: ok | exists | expired | finished | no_run | q_invalid, correct, delta, marks,
-- elapsed_ms, finished, answered, count }. The key arrives from the bank through the API (p_correct_index): it is
-- never in the request or the response. elapsed_ms is from server time only.
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

-- "Finish now": skip the rest. { status: finished | no_run, marks }
create or replace function public.mob_run_finish(p_user_id text, p_game_id uuid, p_member_id text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r public.mob_game_runs%rowtype;
begin
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  if not found then return jsonb_build_object('status', 'no_run'); end if;
  -- The live ruler hears the finish before the room can be done.
  if r.live and r.finished_at is null then
    perform public.mob_room_send(p_game_id, 'progress', jsonb_build_object('m', p_member_id, 'q', (select jsonb_array_length(question_ids) from public.mob_games where id = p_game_id), 'done', true));
  end if;
  perform public.mob_run_seal(p_game_id, p_user_id, least(p_now, r.ends_at));
  select * into r from public.mob_game_runs where game_id = p_game_id and user_id = p_user_id;
  return jsonb_build_object('status', 'finished', 'marks', r.marks, 'right_n', r.right_n, 'wrong_n', r.wrong_n, 'skipped_n', r.skipped_n);
end $$;

-- The game as the server reads it, for a member of its Mob (null otherwise). runs: every run's user id (the API maps it
-- to a memberId), times, marks and counts, and arrivals (elapsed_ms per answered question, in order). mine: your own
-- picks. Another member's picks are never in this JSON.
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

-- Right or wrong and the time of every answer, with no pick: only the server reads it, for everyone's moment.
create or replace function public.mob_game_marks_detail(p_game_id uuid)
returns jsonb language sql security invoker stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'q', a.q, 'correct', a.correct, 'answered', a.pick >= 0, 'elapsed_ms', a.elapsed_ms) order by a.user_id, a.q), '[]'::jsonb)
  from public.mob_game_answers a join public.mob_game_runs r on r.game_id = a.game_id and r.user_id = a.user_id
  where a.game_id = p_game_id and r.finished_at is not null
$$;

-- The den's games: open, and closed in the last 7 days, newest first.
create or replace function public.mob_games_for_state(p_mob_id uuid, p_user_id text, p_now timestamptz)
returns jsonb language sql security invoker stable set search_path = public as $$
  select coalesce(jsonb_agg(public.mob_game_json(g.id, p_user_id, p_now) order by g.opened_at desc), '[]'::jsonb)
  from (select id, opened_at from public.mob_games where mob_id = p_mob_id and closes_at > p_now - interval '7 days' order by opened_at desc limit 10) g
$$;

-- Every finished run's picks, only once the game has closed (null before). Server-only, for the trap and the review.
create or replace function public.mob_game_picks_closed(p_game_id uuid, p_now timestamptz)
returns jsonb language sql security invoker stable set search_path = public as $$
  select case when p_now < g.closes_at then null else coalesce((
    select jsonb_agg(jsonb_build_object('user_id', r.user_id,
      'picks', (select jsonb_agg(coalesce(a.pick, -1) order by s.i) from generate_series(0, jsonb_array_length(g.question_ids) - 1) s(i)
                left join public.mob_game_answers a on a.game_id = r.game_id and a.user_id = r.user_id and a.q = s.i)) order by r.user_id)
    from public.mob_game_runs r where r.game_id = g.id and r.finished_at is not null), '[]'::jsonb) end
  from public.mob_games g where g.id = p_game_id
$$;

-- Once, after close: the trap (computed in src/lib/mob/games.mjs and passed in) and the 30-day sticker cleanup.
-- settled | already | open | not_found
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

-- Free start and mics for one member, Mob and week: { claim_used, mics, mic_from (giver user id of the oldest unused),
-- mics_given (by this member this week, across Mobs) }.
create or replace function public.mob_start_status(p_user_id text, p_mob_id uuid, p_week date)
returns jsonb language sql security invoker stable set search_path = public as $$
  select jsonb_build_object(
    'claim_used', exists (select 1 from public.mob_start_claims where user_id = p_user_id and mob_id = p_mob_id and week_start = p_week),
    'mics', (select count(*)::int from public.mob_mics where receiver_id = p_user_id and mob_id = p_mob_id and week_start = p_week and used_game_id is null),
    'mic_from', (select giver_id from public.mob_mics where receiver_id = p_user_id and mob_id = p_mob_id and week_start = p_week and used_game_id is null order by given_at, id limit 1),
    'mics_given', (select count(*)::int from public.mob_mics where giver_id = p_user_id and week_start = p_week))
$$;

-- Pass the mic: 2 to give per giver per IST week, across Mobs. ok | limit | not_member | self
create or replace function public.mob_mic_give(p_giver text, p_mob_id uuid, p_receiver text, p_week date, p_max smallint)
returns text language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if p_giver = p_receiver then return 'self'; end if;
  if not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_giver)
     or not exists (select 1 from public.mob_members where mob_id = p_mob_id and user_id = p_receiver) then return 'not_member'; end if;
  perform pg_advisory_xact_lock(hashtext('mob_mic:' || p_giver));
  select count(*) into n from public.mob_mics where giver_id = p_giver and week_start = p_week;
  if n >= greatest(coalesce(p_max, 2), 1) then return 'limit'; end if;
  insert into public.mob_mics (mob_id, giver_id, receiver_id, week_start) values (p_mob_id, p_giver, p_receiver, p_week);
  return 'ok';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Fix it together
-- ---------------------------------------------------------------------------------------------------------------

-- Issue the "now" question (from close) or the Wednesday check (its window). The API picks the question; a repeat
-- returns the one already issued. { status: ok | had | not_yet | closed | no_trap | not_member, question_id, correct,
-- answered, opens_at, closes_at }
create or replace function public.mob_fix_issue(p_user_id text, p_game_id uuid, p_q smallint, p_stage text, p_question_id text, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare t public.mob_traps%rowtype; c public.mob_fix_checks%rowtype; win jsonb;
begin
  select * into t from public.mob_traps where game_id = p_game_id and q = p_q;
  if not found then return jsonb_build_object('status', 'no_trap'); end if;
  if not exists (select 1 from public.mob_members where mob_id = t.mob_id and user_id = p_user_id) then return jsonb_build_object('status', 'not_member'); end if;
  win := jsonb_build_object('opens_at', case when p_stage = 'check' then t.check_opens_at else t.opened_at end, 'closes_at', t.check_closes_at);
  select * into c from public.mob_fix_checks where game_id = p_game_id and q = p_q and user_id = p_user_id and stage = p_stage;
  if found then return win || jsonb_build_object('status', 'had', 'question_id', c.question_id, 'correct', c.correct, 'answered', c.answered_at is not null); end if;
  if p_stage = 'check' and p_now < t.check_opens_at then return win || jsonb_build_object('status', 'not_yet'); end if;
  if p_now < t.opened_at then return win || jsonb_build_object('status', 'not_yet'); end if;
  if p_now > t.check_closes_at then return win || jsonb_build_object('status', 'closed'); end if;
  if p_question_id is null then return win || jsonb_build_object('status', 'open'); end if;
  insert into public.mob_fix_checks (game_id, q, user_id, stage, question_id, issued_at) values (p_game_id, p_q, p_user_id, p_stage, p_question_id, p_now)
  on conflict do nothing;
  return win || jsonb_build_object('status', 'ok', 'question_id', p_question_id, 'correct', null, 'answered', false);
end $$;

-- Answer an issued fix question once. { status: ok | exists | no_issue | closed, correct, fixed_now, fixed_count }.
-- A trap is fixed together when the second right Wednesday check lands.
create or replace function public.mob_fix_answer(p_user_id text, p_game_id uuid, p_q smallint, p_stage text, p_correct boolean, p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare t public.mob_traps%rowtype; c public.mob_fix_checks%rowtype; fixed_now boolean := false; n int;
begin
  select * into t from public.mob_traps where game_id = p_game_id and q = p_q for update;
  if not found then return jsonb_build_object('status', 'no_issue'); end if;
  select * into c from public.mob_fix_checks where game_id = p_game_id and q = p_q and user_id = p_user_id and stage = p_stage for update;
  if not found then return jsonb_build_object('status', 'no_issue'); end if;
  if c.answered_at is not null then
    return jsonb_build_object('status', 'exists', 'correct', c.correct, 'fixed_now', false,
      'fixed_count', (select count(*)::int from public.mob_traps where mob_id = t.mob_id and fixed_at is not null));
  end if;
  if p_now > t.check_closes_at then return jsonb_build_object('status', 'closed'); end if;
  update public.mob_fix_checks set correct = p_correct, answered_at = p_now where game_id = p_game_id and q = p_q and user_id = p_user_id and stage = p_stage;
  perform public.mob_quest_tick(t.mob_id, public.mob_ist_week(p_now), 'fix', p_game_id::text || ':' || p_q || ':' || p_stage, p_user_id, 1, p_now);
  if p_stage = 'check' and p_correct and t.fixed_at is null then
    select count(*) into n from public.mob_fix_checks where game_id = p_game_id and q = p_q and stage = 'check' and correct;
    if n >= 2 then update public.mob_traps set fixed_at = p_now where game_id = p_game_id and q = p_q; fixed_now := true; end if;
  end if;
  return jsonb_build_object('status', 'ok', 'correct', p_correct, 'fixed_now', fixed_now,
    'fixed_count', (select count(*)::int from public.mob_traps where mob_id = t.mob_id and fixed_at is not null));
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- The weekly paper and extra papers also tick the quest (same signatures as 20261017100000).
-- ---------------------------------------------------------------------------------------------------------------
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
  perform public.mob_quest_tick(p_mob_id, p_week, 'paper', p_week::text, p_user_id,
    (select count(*)::int from unnest(p_picks) x where x >= 0), coalesce(p_sat_at, now()));
  return 'recorded';
end $$;

create or replace function public.mob_extra_record(p_user_id text, p_extra_id uuid, p_session_id text, p_score numeric,
  p_max_score numeric, p_picks smallint[], p_sat_at timestamptz, p_detail jsonb default null)
returns text language plpgsql security invoker set search_path = public as $$
declare m uuid; wk date;
begin
  select mob_id, week_start into m, wk from public.mob_extras where id = p_extra_id;
  if m is null then return 'no_extra'; end if;
  if not exists (select 1 from public.mob_members where mob_id = m and user_id = p_user_id) then return 'not_member'; end if;
  insert into public.mob_extra_sittings (extra_id, mob_id, user_id, session_id, score, max_score, picks, detail, sat_at)
  values (p_extra_id, m, p_user_id, p_session_id, p_score, p_max_score, p_picks, p_detail, coalesce(p_sat_at, now()))
  on conflict (extra_id, user_id) do nothing;
  if not found then return 'exists'; end if;
  perform public.mob_quest_tick(m, wk, 'extra', p_extra_id::text, p_user_id,
    (select count(*)::int from unnest(p_picks) x where x >= 0), coalesce(p_sat_at, now()));
  return 'recorded';
end $$;

-- A game's trap and Fix it together state for one member: { q, question_id, opened_at, check_opens_at,
-- check_closes_at, fixed_at, fixed_count (the Mob's fixed traps), now: { issued, answered, correct }, check: {...} }.
-- Null when the game has no trap or the student is not in its Mob.
create or replace function public.mob_trap_get(p_game_id uuid, p_user_id text)
returns jsonb language sql security invoker stable set search_path = public as $$
  select jsonb_build_object('q', t.q, 'question_id', t.question_id, 'opened_at', t.opened_at, 'check_opens_at', t.check_opens_at,
    'check_closes_at', t.check_closes_at, 'fixed_at', t.fixed_at,
    'fixed_count', (select count(*)::int from public.mob_traps x where x.mob_id = t.mob_id and x.fixed_at is not null),
    'now', (select jsonb_build_object('answered', c.answered_at is not null, 'correct', c.correct) from public.mob_fix_checks c
            where c.game_id = t.game_id and c.q = t.q and c.user_id = p_user_id and c.stage = 'now'),
    'check', (select jsonb_build_object('answered', c.answered_at is not null, 'correct', c.correct) from public.mob_fix_checks c
            where c.game_id = t.game_id and c.q = t.q and c.user_id = p_user_id and c.stage = 'check'))
  from public.mob_traps t
  where t.game_id = p_game_id and exists (select 1 from public.mob_members mm where mm.mob_id = t.mob_id and mm.user_id = p_user_id)
  order by t.q limit 1
$$;

-- The Mob's weeks for the chain (computed in src/lib/mob/mobChain.mjs).
create or replace function public.mob_weeks_list(p_mob_id uuid)
returns jsonb language sql security invoker stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('week_start', week_start, 'done_at', done_at, 'target', target, 'answered', answered) order by week_start), '[]'::jsonb)
  from public.mob_weeks where mob_id = p_mob_id
$$;

-- ---------- Grants: service role only ----------
alter table public.mob_games enable row level security;
alter table public.mob_game_runs enable row level security;
alter table public.mob_game_answers enable row level security;
alter table public.mob_start_claims enable row level security;
alter table public.mob_mics enable row level security;
alter table public.mob_quest_ticks enable row level security;
alter table public.mob_weeks enable row level security;
alter table public.mob_traps enable row level security;
alter table public.mob_fix_checks enable row level security;
revoke all on public.mob_games, public.mob_game_runs, public.mob_game_answers, public.mob_start_claims, public.mob_mics,
  public.mob_quest_ticks, public.mob_weeks, public.mob_traps, public.mob_fix_checks from public, anon, authenticated;
grant all on public.mob_games, public.mob_game_runs, public.mob_game_answers, public.mob_start_claims, public.mob_mics,
  public.mob_quest_ticks, public.mob_weeks, public.mob_traps, public.mob_fix_checks to service_role;
revoke all on function public.mob_ist_week(timestamptz), public.mob_room_send(uuid, text, jsonb), public.mob_room_maybe_done(uuid),
  public.mob_quest_week(uuid, date, timestamptz), public.mob_quest_tick(uuid, date, text, text, text, integer, timestamptz),
  public.mob_run_seal(uuid, text, timestamptz),
  public.mob_game_open(text, uuid, text, text, text, text, jsonb, text, date, uuid, timestamptz, integer),
  public.mob_run_start(text, uuid, timestamptz), public.mob_game_answer(text, uuid, smallint, smallint, smallint, text, timestamptz),
  public.mob_run_finish(text, uuid, text, timestamptz), public.mob_game_json(uuid, text, timestamptz), public.mob_game_marks_detail(uuid),
  public.mob_games_for_state(uuid, text, timestamptz), public.mob_game_picks_closed(uuid, timestamptz), public.mob_game_settle(uuid, timestamptz, jsonb),
  public.mob_start_status(text, uuid, date), public.mob_mic_give(text, uuid, text, date, smallint),
  public.mob_fix_issue(text, uuid, smallint, text, text, timestamptz), public.mob_fix_answer(text, uuid, smallint, text, boolean, timestamptz),
  public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb),
  public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb), public.mob_weeks_list(uuid), public.mob_trap_get(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mob_ist_week(timestamptz), public.mob_room_send(uuid, text, jsonb), public.mob_room_maybe_done(uuid),
  public.mob_quest_week(uuid, date, timestamptz), public.mob_quest_tick(uuid, date, text, text, text, integer, timestamptz),
  public.mob_run_seal(uuid, text, timestamptz),
  public.mob_game_open(text, uuid, text, text, text, text, jsonb, text, date, uuid, timestamptz, integer),
  public.mob_run_start(text, uuid, timestamptz), public.mob_game_answer(text, uuid, smallint, smallint, smallint, text, timestamptz),
  public.mob_run_finish(text, uuid, text, timestamptz), public.mob_game_json(uuid, text, timestamptz), public.mob_game_marks_detail(uuid),
  public.mob_games_for_state(uuid, text, timestamptz), public.mob_game_picks_closed(uuid, timestamptz), public.mob_game_settle(uuid, timestamptz, jsonb),
  public.mob_start_status(text, uuid, date), public.mob_mic_give(text, uuid, text, date, smallint),
  public.mob_fix_issue(text, uuid, smallint, text, text, timestamptz), public.mob_fix_answer(text, uuid, smallint, text, boolean, timestamptz),
  public.mob_record_sitting(text, uuid, date, text, numeric, numeric, smallint[], timestamptz, jsonb),
  public.mob_extra_record(text, uuid, text, numeric, numeric, smallint[], timestamptz, jsonb), public.mob_weeks_list(uuid), public.mob_trap_get(uuid, text)
  to service_role;
