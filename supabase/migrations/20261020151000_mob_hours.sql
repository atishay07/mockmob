-- Mob hours (owner D173 item 1, approved D174; MOB-V4-BUILD.md item 2, 20 Oct 2026). A calm "study time together" figure in the
-- Mob den: how long the members who chose to share it have really practised this week. Additive and idempotent; service role
-- only (RLS untouched, every function security invoker, the clock passed in by the API so one clock decides). Nothing here
-- changes an existing row, function or API answer.
--
--   mob_members.share_study_time  per-member opt-in, default false for everyone, existing rows included. Minors' privacy:
--                                 a member who has not switched it on is never read by the aggregate below, so their time
--                                 never leaves the database.
--   mob_share_study_time_set      set your own switch in one Mob. ok | not_member
--   mob_hours_head                the cheap part, read on every den view: is p_user_id in the Mob, their own switch, and who shares.
--   mob_hours_rows                the heavy part (one Mob, one week, user independent): the sharing members' minutes this week
--                                 (IST week, Monday to Sunday), the days each met their own daily goal, and who answered in the
--                                 last 10 minutes. The API caches it for about a minute, keyed by the Mob, the week and the set of
--                                 sharers, so a switch flipped on any instance recomputes at once.
--   mob_hours                     head and rows in one call: { week_start, sharing, me_sharing, rows, studying } or null (dry runs, ops).
--   mob_hours_events / _dwell / _rec_of_events   the time rule, as small internal functions so a test can compare them with
--                                 data/paper_trace.js on hundreds of random records.
--   recovery_sessions_user_created_idx   (user_id, created_at): the aggregate reads one student's sessions of one week.
--
-- Where the time comes from. The PRIMARY source is public.attempts (index attempts_user_completed_idx): finishing any practice or
-- NTA mock stores the record in attempts.selection_meta->'recovery' ({timeline, marks, presence, strikes, end}, exactly what
-- data/recovery.js scoreSession keeps), for the device-ticket papers that are all there is in production
-- (LEARNING_SESSIONS_ENABLED is off there, so those papers never have a recovery_sessions row) and for durable sessions alike.
-- recovery_sessions.events is read only for a session that has NO attempt yet (a durable paper still running), so a paper is
-- never counted twice (the attempt id equals the session id). Everything stays in SQL; raw events never reach the server.
-- The aggregate applies the SAME time rule as the result screens (data/paper_trace.js readTrace): the time from one event to the
-- next is credited to the question on screen; time away is not counted; the submit sheet and passage-set shows credit nobody; with
-- no away data a gap over 30 minutes is a break. Then, for Mob hours:
--   - only a question the student actually answered counts (an answer event with a chosen option), and
--   - each such question counts at most 180 seconds (3 minutes) in its session.
-- A question is placed in the IST day and week of its last answer. A session row starts at its created_at; an attempt row has
-- only the clock of its submit (completed_at), so its start is completed_at minus the record's last event time (the paper clock
-- in ms), which is exact for a submitted paper to within the seconds between the last event and the submit. Minutes are whole
-- minutes rounded down; a member under a minute is not listed. goal_days: IST days of the week on which the member's capped
-- minutes reached their own daily goal (study_goals.daily_minutes, else the 20-minute default the study plan uses).
-- "Studying now" (studying): a sharing member with an answer in the 10 minutes up to p_now, from three places: a running durable
-- session's events, a submitted paper whose answers fall in the window (an attempt), and session_check_log.checked_at (the per
-- answer check, when it is on and the table exists). A device-ticket paper that is still running has none of these, so such a
-- member shows as studying only after the paper is submitted; the contract says so and the app must not promise more.
-- A session, table or column that is missing reads as zero; the API feature-detects the functions (a missing function means
-- "hours" is absent from the den payload, so code ships first and this is safe to apply later). attempts.selection_meta is
-- from the same migration as recovery_sessions (20261001105920), which this needs anyway.
--
-- Needs 20261017100000_mob and the recovery_sessions table (20261001105920). Applied to NOTHING by this change.
-- Undo: supabase/undo/20261020151000_mob_hours.undo.sql
-- Dry run: PGlite only (data/tests/mob_hours_1020.test.mjs: applied twice, undone twice, after the existing Mob migrations).
-- STAGING AND PRODUCTION DRY RUNS ARE NOT DONE (this build never connects to Supabase). The plan for whoever applies it:
--   1. staging, one transaction ending in a deliberate exception so it rolls back: run this file twice; check the count of
--      mob_members is unchanged and count(*) filter (where share_study_time) = 0; select mob_hours(...) on a real Mob returns
--      { sharing: 0, rows: [], studying: [] }; run the undo twice; check the column, the index and all functions are gone.
--      Then, with a test student sharing in a test Mob: submit one practice paper and one NTA mock on a device-ticket build and
--      check mob_hours shows their minutes (the case that has no recovery_sessions row); EXPLAIN (ANALYZE) mob_hours_rows for a
--      Mob of 8 sharers with a month of attempts and keep it under about 50 ms.
--   2. production in the same shape, after the code is deployed. The index is a plain CREATE INDEX (a brief write lock on
--      recovery_sessions, a small table); run it in a quiet minute.

alter table public.mob_members add column if not exists share_study_time boolean not null default false;

create index if not exists recovery_sessions_user_created_idx on public.recovery_sessions (user_id, created_at);

-- Your own switch in one Mob. ok | not_member
create or replace function public.mob_share_study_time_set(p_user_id text, p_mob_id uuid, p_share boolean)
returns text language plpgsql security invoker set search_path = public as $$
begin
  update public.mob_members set share_study_time = coalesce(p_share, false) where mob_id = p_mob_id and user_id = p_user_id;
  if not found then return 'not_member'; end if;
  return 'ok';
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- The time rule (data/paper_trace.js recordOf and readTrace), in three small functions. A "record" is the object scoreSession
-- keeps: { timeline, marks, presence, strikes, end }.
-- ---------------------------------------------------------------------------------------------------------------------

-- A recovery_sessions.events array (the raw log, one flat array) split into a record, the way scoreSession splits it: visits and
-- answers are the timeline, marks, away/back and strikes beside it, and an end counts only as the last event.
create or replace function public.mob_hours_rec_of_events(p_events jsonb)
returns jsonb language sql immutable parallel safe security invoker set search_path = public as $$
  with a as (select case when jsonb_typeof(p_events) = 'array' then p_events else '[]'::jsonb end as v)
  select jsonb_build_object(
    'timeline', jsonb_path_query_array(a.v, '$[*] ? (@.type == "visit" || @.type == "answer")'),
    'marks',    jsonb_path_query_array(a.v, '$[*] ? (@.type == "mark")'),
    'presence', jsonb_path_query_array(a.v, '$[*] ? (@.type == "away" || @.type == "back")'),
    'strikes',  jsonb_path_query_array(a.v, '$[*] ? (@.type == "strike")'),
    'end',      case when jsonb_typeof(a.v -> -1) = 'object' and (a.v -> -1) ->> 'type' = 'end' then a.v -> -1 end)
  from a
$$;

-- The record's events in the order readTrace walks them: the usable ones only (recordOf's okEvent and per-array filters), sorted by
-- the paper clock, then seq, then timeline before marks before presence before strikes, then the order in the array, with the end
-- last and never earlier than the last event. at, seq: numeric. rank: 0 timeline, 1 marks, 2 presence, 3 strikes, 4 end.
create or replace function public.mob_hours_events(p_rec jsonb)
returns table (qid text, typ text, via text, at numeric, seq numeric, kind text, rank int, ord bigint, is_end int, has_ans boolean)
language sql immutable parallel safe security invoker set search_path = public as $$
  with r as (
    select case when jsonb_typeof(p_rec) = 'object' then p_rec else '{}'::jsonb end as v
  ), raw as (
    select 'timeline'::text as kind, 0 as rank, e.v, e.ord
      from r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.v->'timeline') = 'array' then r.v->'timeline' else '[]'::jsonb end) with ordinality as e(v, ord)
    union all
    select 'marks', 1, e.v, e.ord
      from r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.v->'marks') = 'array' then r.v->'marks' else '[]'::jsonb end) with ordinality as e(v, ord)
    union all
    select 'presence', 2, e.v, e.ord
      from r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.v->'presence') = 'array' then r.v->'presence' else '[]'::jsonb end) with ordinality as e(v, ord)
    union all
    select 'strikes', 3, e.v, e.ord
      from r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.v->'strikes') = 'array' then r.v->'strikes' else '[]'::jsonb end) with ordinality as e(v, ord)
  ), ok as (
    select kind, rank, ord,
           v->>'qid' as qid,
           case kind when 'marks' then 'mark' when 'strikes' then 'strike' else coalesce(v->>'type', '') end as typ,
           coalesce(v->>'via', '') as via,
           (v->>'at')::numeric as at,
           case when jsonb_typeof(v->'seq') = 'number' then (v->>'seq')::numeric else 0 end as seq,
           (jsonb_typeof(v->'answer') = 'number') as has_ans
    from raw
    where jsonb_typeof(v) = 'object'
      and jsonb_typeof(v->'qid') = 'string' and v->>'qid' <> ''
      and jsonb_typeof(v->'at') = 'number'
      and case kind
            when 'timeline' then coalesce(v->>'type', '') not in ('mark', 'strike', 'away', 'back', 'end')
            when 'marks' then jsonb_typeof(v->'marked') = 'boolean'
            when 'presence' then coalesce(v->>'type', '') in ('away', 'back')
            else jsonb_typeof(v->'option') = 'number' and jsonb_typeof(v->'on') = 'boolean'
                 and case when jsonb_typeof(v->'option') = 'number' then (v->>'option')::numeric = trunc((v->>'option')::numeric) else false end
          end
  ), mx as (
    select coalesce(max(at), 0) as m from ok
  ), en as (
    select r.v->'end' as v from r
    where jsonb_typeof(r.v->'end') = 'object'
      and jsonb_typeof(r.v->'end'->'qid') = 'string' and r.v->'end'->>'qid' <> ''
      and jsonb_typeof(r.v->'end'->'at') = 'number'
  )
  select ok.qid, ok.typ, ok.via, ok.at, ok.seq, ok.kind, ok.rank, ok.ord, 0, ok.has_ans from ok
  union all
  select en.v->>'qid', 'end', '', greatest((en.v->>'at')::numeric, mx.m), 0::numeric, 'end', 4, 0::bigint, 1, false
  from en cross join mx
$$;

-- Per question of one record: ms = the time on it under the one rule (uncapped; a question never touched has 0), answered_at = the
-- paper clock of its last answer with a chosen option (null when it was never answered), last_at = the record's last clock (ms).
create or replace function public.mob_hours_dwell(p_rec jsonb)
returns table (qid text, ms numeric, answered_at numeric, last_at numeric)
language sql immutable parallel safe security invoker set search_path = public as $$
  with ev as (
    select e.*,
           (e.typ = 'visit' and e.via = 'set') as is_set,
           (e.typ = 'visit' and e.via = 'sheet') as is_sheet,
           (e.typ in ('visit', 'answer') and not (e.typ = 'visit' and e.via in ('set', 'sheet'))) as is_focus
    from public.mob_hours_events(p_rec) e
  ), gr as (
    select ev.*,
           sum(case when ev.is_focus or ev.is_sheet then 1 else 0 end) over w as grp,
           lead(ev.at) over w as nat,
           bool_or(ev.kind = 'presence') over () as away_known
    from ev
    window w as (order by ev.is_end, ev.at, ev.seq, ev.rank, ev.ord)
  ), ow as (
    -- The question on screen for each event: a focus event is the question it names and every later event up to the next focus
    -- or sheet event shares it; the submit sheet and a set shown before any focus own nothing.
    select gr.*,
           case when gr.grp = 0 then (case when gr.is_set or gr.is_sheet then null else gr.qid end)
                else max(case when gr.is_focus then gr.qid end) over (partition by gr.grp) end as owner
    from gr
  ), dw as (
    select ow.owner as q,
           sum(case when ow.nat is not null and ow.typ <> 'end' and ow.typ <> 'away' and ow.nat >= ow.at
                         and (ow.away_known or ow.nat - ow.at <= 1800000) then ow.nat - ow.at else 0 end) as ms
    from ow where ow.owner is not null group by ow.owner
  ), an as (
    select ev.qid as q, max(ev.at) as at from ev where ev.typ = 'answer' and ev.has_ans group by ev.qid
  ), lx as (
    select coalesce(max(ev.at), 0) as at from ev
  )
  select q.qid, coalesce(dw.ms, 0), an.at, lx.at
  from (select distinct ev.qid from ev) q
  left join dw on dw.q = q.qid
  left join an on an.q = q.qid
  cross join lx
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- The den's Mob hours.
-- ---------------------------------------------------------------------------------------------------------------------

-- Null when p_user_id is not in the Mob. Otherwise { me_sharing, sharers: [user_id] } (every sharing member, by user id: the API
-- turns them into a cache key and a count, and never sends them to a client). One indexed read of a handful of rows.
create or replace function public.mob_hours_head(p_user_id text, p_mob_id uuid)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare
  me boolean;
  sh jsonb;
begin
  select m.share_study_time into me from public.mob_members m where m.mob_id = p_mob_id and m.user_id = p_user_id;
  if me is null then return null; end if;
  select coalesce(jsonb_agg(m.user_id order by m.user_id), '[]'::jsonb) into sh
  from public.mob_members m where m.mob_id = p_mob_id and m.share_study_time;
  return jsonb_build_object('me_sharing', me, 'sharers', sh);
end $$;

-- The heavy part, for one Mob and one IST week (p_week is its Monday): { sharing, rows: [{ user_id, minutes, goal_days }],
-- studying: [{ user_id, since }] }. rows: only members who share AND have at least 1 whole minute this week, most minutes first.
-- sharing counts every sharing member (the target is 150 minutes each). studying: sharing members with an answer in the 10 minutes
-- up to p_now, `since` their first answer in that window. user_id never reaches a client (the API maps it to a member id).
create or replace function public.mob_hours_rows(p_mob_id uuid, p_week date, p_now timestamptz)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare
  w_from timestamptz := (p_week::timestamp at time zone 'Asia/Kolkata');
  w_to timestamptz := ((p_week + 7)::timestamp at time zone 'Asia/Kolkata');
  n integer;
  goal_sql text := '20';
  chk_sql text := '';
  rws jsonb := '[]'::jsonb;
  stu jsonb := '[]'::jsonb;
begin
  select count(*)::int into n from public.mob_members m where m.mob_id = p_mob_id and m.share_study_time;
  if n > 0 and to_regclass('public.recovery_sessions') is not null then
    if exists (select 1 from pg_attribute where attrelid = to_regclass('public.study_goals') and attname = 'daily_minutes' and not attisdropped) then
      goal_sql := 'coalesce((select g.daily_minutes from public.study_goals g where g.user_id = m.user_id), 20)';
    end if;
    -- The per-answer check log (B13) is a signal that someone is answering right now; it may not be applied yet.
    if to_regclass('public.session_check_log') is not null then
      chk_sql := $c$ union all
        select c.user_id, c.checked_at
        from sh join public.session_check_log c on c.user_id = sh.user_id and c.checked_at >= $4 - interval '10 minutes' and c.checked_at <= $4 $c$;
    end if;
    execute format($q$
      with sh as (
        select m.user_id, m.joined_at, (%s)::int as goal from public.mob_members m where m.mob_id = $1 and m.share_study_time
      ), recs as (
        -- Every finished paper (practice, NTA mock; device-ticket or durable) is an attempt with its record in selection_meta.
        select a.user_id, a.completed_at as t, true as from_attempt, a.selection_meta->'recovery' as rec
        from sh join public.attempts a on a.user_id = sh.user_id and a.completed_at >= $2 and a.completed_at < $3 + interval '2 days'
        where jsonb_typeof(a.selection_meta->'recovery'->'timeline') = 'array'
        union all
        -- A durable session with no attempt yet (still running): its events, started at its created_at.
        select s.user_id, s.created_at, false, public.mob_hours_rec_of_events(s.events)
        from sh join public.recovery_sessions s on s.user_id = sh.user_id and s.created_at >= $2 - interval '2 days' and s.created_at < $3
        where not exists (select 1 from public.attempts x where x.id = s.id)
      ), qq as (
        select r.user_id, d.ms,
               (case when r.from_attempt then r.t - d.last_at::float8 * interval '1 millisecond' else r.t end)
                 + d.answered_at::float8 * interval '1 millisecond' as at_abs
        from recs r cross join lateral public.mob_hours_dwell(r.rec) d
        where d.answered_at is not null
      ), wk as (
        select user_id, least(ms, 180000) as ms, (at_abs at time zone 'Asia/Kolkata')::date as d
        from qq where at_abs >= $2 and at_abs < $3
      ), dy as (
        select user_id, d, sum(ms) as ms from wk group by user_id, d
      ), per as (
        select sh.user_id, sh.joined_at,
               coalesce((select sum(dy.ms) from dy where dy.user_id = sh.user_id), 0) as tms,
               coalesce((select count(*) from dy where dy.user_id = sh.user_id and dy.ms >= sh.goal * 60000), 0)::int as gd
        from sh
      ), st as (
        select z.user_id, min(z.t) as since from (
          -- a running durable session
          select s.user_id, s.created_at + ev.at::float8 * interval '1 millisecond' as t
          from sh join public.recovery_sessions s on s.user_id = sh.user_id and s.created_at >= $4 - interval '2 days' and s.created_at <= $4
          cross join lateral public.mob_hours_events(public.mob_hours_rec_of_events(s.events)) ev
          where ev.typ = 'answer' and ev.has_ans
          union all
          -- a paper submitted in the window (an attempt with no session row: those are timed from the session above)
          select a.user_id, a.completed_at - l.at::float8 * interval '1 millisecond' + ev.at::float8 * interval '1 millisecond'
          from sh join public.attempts a on a.user_id = sh.user_id
                and a.completed_at >= $4 - interval '10 minutes' and a.completed_at <= $4 + interval '1 hour'
          cross join lateral (select max(e2.at) as at from public.mob_hours_events(a.selection_meta->'recovery') e2) l
          cross join lateral public.mob_hours_events(a.selection_meta->'recovery') ev
          where not exists (select 1 from public.recovery_sessions z where z.id = a.id)
            and ev.typ = 'answer' and ev.has_ans
          %s
        ) z
        where z.t >= $4 - interval '10 minutes' and z.t <= $4
        group by z.user_id
      )
      select
        coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'minutes', floor(tms / 60000)::int, 'goal_days', gd)
                                   order by tms desc, joined_at, user_id)
                  from per where floor(tms / 60000) >= 1), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'since', since) order by since, user_id) from st), '[]'::jsonb)
    $q$, goal_sql, chk_sql) into rws, stu using p_mob_id, w_from, w_to, p_now;
  end if;
  return jsonb_build_object('sharing', n, 'rows', rws, 'studying', stu);
end $$;

-- The whole answer in one call. Null when p_user_id is not in the Mob. Otherwise
--   { week_start, sharing, me_sharing, rows: [{ user_id, minutes, goal_days }], studying: [{ user_id, since }] }
create or replace function public.mob_hours(p_user_id text, p_mob_id uuid, p_week date, p_now timestamptz)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare
  h jsonb := public.mob_hours_head(p_user_id, p_mob_id);
  r jsonb;
begin
  if h is null then return null; end if;
  r := public.mob_hours_rows(p_mob_id, p_week, p_now);
  return jsonb_build_object('week_start', p_week, 'sharing', r->'sharing', 'me_sharing', h->'me_sharing',
                            'rows', r->'rows', 'studying', r->'studying');
end $$;

revoke all on function
  public.mob_share_study_time_set(text, uuid, boolean), public.mob_hours(text, uuid, date, timestamptz),
  public.mob_hours_head(text, uuid), public.mob_hours_rows(uuid, date, timestamptz),
  public.mob_hours_events(jsonb), public.mob_hours_dwell(jsonb), public.mob_hours_rec_of_events(jsonb)
from public, anon, authenticated;
grant execute on function
  public.mob_share_study_time_set(text, uuid, boolean), public.mob_hours(text, uuid, date, timestamptz),
  public.mob_hours_head(text, uuid), public.mob_hours_rows(uuid, date, timestamptz),
  public.mob_hours_events(jsonb), public.mob_hours_dwell(jsonb), public.mob_hours_rec_of_events(jsonb)
to service_role;
