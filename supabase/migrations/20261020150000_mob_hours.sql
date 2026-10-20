-- Mob hours (owner D173 item 1, approved D174; MOB-V4-BUILD.md item 2, 20 Oct 2026). A calm "study time together" figure in the
-- Mob den: how long the members who chose to share it have really practised this week. Additive and idempotent; service role
-- only (RLS untouched, every function security invoker, the clock passed in by the API so one clock decides). Nothing here
-- changes an existing row, function or API answer.
--
--   mob_members.share_study_time  per-member opt-in, default false for everyone, existing rows included. Minors' privacy:
--                                 a member who has not switched it on is never read by the aggregate below, so their time
--                                 never leaves the database.
--   mob_share_study_time_set      set your own switch in one Mob. ok | not_member
--   mob_hours                     ONE read of a few rows for the den: the sharing members' minutes this week (IST week, Monday
--                                 to Sunday), the days each met their own daily goal, and who answered in the last 10 minutes.
--   recovery_sessions_user_created_idx   (user_id, created_at): the aggregate reads one student's sessions of one week.
--
-- Where the time comes from: practice answers live in recovery_sessions.events (the runner's visit/answer events, `at` = ms since
-- the session started, the clock data/paper_trace.js reads). The aggregate applies the SAME time rule as the result screens
-- (data/paper_trace.js): the time from one event to the next is credited to the question on screen; time away is not counted;
-- the submit sheet and passage-set shows credit nobody; with no away data a gap over 30 minutes is a break. Then, for Mob hours:
--   - only a question the student actually answered counts (an answer event with a chosen option), and
--   - each such question counts at most 180 seconds (3 minutes) in its session.
-- A question is placed in the IST day and week of its last answer (session start + the event's `at`). Minutes are whole minutes
-- rounded down; a member under a minute is not listed. goal_days: IST days of the week on which the member's capped minutes
-- reached their own daily goal (study_goals.daily_minutes, else the 20-minute default the study plan uses).
-- A session, table or column that is missing reads as zero; the API feature-detects the functions (a missing function means
-- "hours" is absent from the den payload, so code ships first and this is safe to apply later).
--
-- Needs 20261017100000_mob and the recovery_sessions table (20261001105920). Applied to NOTHING by this change.
-- Undo: supabase/undo/20261020150000_mob_hours.undo.sql
-- Dry run: PGlite only (data/tests/mob_hours_1020.test.mjs: applied twice, undone twice, after the existing Mob migrations).
-- STAGING AND PRODUCTION DRY RUNS ARE NOT DONE (this build never connects to Supabase). The plan for whoever applies it:
--   1. staging, one transaction ending in a deliberate exception so it rolls back: run this file twice; check the count of
--      mob_members is unchanged and count(*) filter (where share_study_time) = 0; select mob_hours(...) on a real Mob returns
--      { sharing: 0, rows: [], studying: [] }; run the undo twice; check the column, the index and both functions are gone.
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

-- The den's Mob hours. Null when p_user_id is not in the Mob. Otherwise
--   { week_start, sharing, me_sharing, rows: [{ user_id, minutes, goal_days }], studying: [{ user_id, since }] }
-- rows: only members who share AND have at least 1 whole minute this week, most minutes first. sharing counts every sharing member
-- (the target is 150 minutes each). studying: sharing members with a practice answer in the 10 minutes up to p_now, `since` their
-- first answer in that window. user_id never reaches a client (the API maps it to a member id).
create or replace function public.mob_hours(p_user_id text, p_mob_id uuid, p_week date, p_now timestamptz)
returns jsonb language plpgsql security invoker stable set search_path = public as $$
declare
  w_from timestamptz := (p_week::timestamp at time zone 'Asia/Kolkata');
  w_to timestamptz := ((p_week + 7)::timestamp at time zone 'Asia/Kolkata');
  me boolean;
  n integer;
  goal_sql text := '20';
  rws jsonb := '[]'::jsonb;
  stu jsonb := '[]'::jsonb;
begin
  select m.share_study_time into me from public.mob_members m where m.mob_id = p_mob_id and m.user_id = p_user_id;
  if me is null then return null; end if;
  select count(*)::int into n from public.mob_members m where m.mob_id = p_mob_id and m.share_study_time;
  if n > 0 and to_regclass('public.recovery_sessions') is not null then
    if exists (select 1 from pg_attribute where attrelid = to_regclass('public.study_goals') and attname = 'daily_minutes' and not attisdropped) then
      goal_sql := 'coalesce((select g.daily_minutes from public.study_goals g where g.user_id = m.user_id), 20)';
    end if;
    execute format($q$
      with sh as (
        select m.user_id, m.joined_at, (%s)::int as goal from public.mob_members m where m.mob_id = $1 and m.share_study_time
      ), ev as (
        select s.user_id, s.id as sid, s.created_at, e.ord,
               e.v->>'qid' as qid, e.v->>'type' as typ, coalesce(e.v->>'via', '') as via,
               case when (e.v->>'at') ~ '^[0-9]+(\.[0-9]+)?$' then (e.v->>'at')::numeric end as at,
               case when (e.v->>'seq') ~ '^[0-9]+$' then (e.v->>'seq')::numeric else 0 end as seq,
               case when jsonb_typeof(e.v->'answer') = 'number' then 1 else 0 end as has_ans
        from sh
        join public.recovery_sessions s on s.user_id = sh.user_id and s.created_at >= $2 - interval '2 days' and s.created_at < $3
        cross join lateral jsonb_array_elements(case when jsonb_typeof(s.events) = 'array' then s.events else '[]'::jsonb end) with ordinality as e(v, ord)
        where jsonb_typeof(e.v) = 'object' and e.v->>'qid' is not null
      ), mk as (
        select ev.*, (typ in ('visit', 'answer') and via not in ('set', 'sheet')) as is_focus, (typ = 'visit' and via = 'sheet') as is_sheet
        from ev where at is not null
      ), gr as (
        select mk.*,
               sum(case when is_focus or is_sheet then 1 else 0 end) over (partition by sid order by at, seq, ord) as g,
               lead(at) over (partition by sid order by at, seq, ord) as nat,
               bool_or(typ in ('away', 'back')) over (partition by sid) as away_known
        from mk
      ), ow as (
        select gr.*,
               case when g = 0 then (case when typ = 'visit' and via in ('set', 'sheet') then null else qid end)
                    else max(case when is_focus then qid end) over (partition by sid, g) end as owner
        from gr
      ), cr as (
        select user_id, sid, created_at, owner as qid,
               case when nat is not null and typ not in ('end', 'away') and owner is not null and nat >= at
                         and (away_known or nat - at <= 1800000) then nat - at else 0 end as ms
        from ow
      ), dw as (
        select user_id, sid, created_at, qid, sum(ms) as ms from cr where qid is not null group by user_id, sid, created_at, qid
      ), an as (
        select sid, qid, max(at) as last_at from mk where typ = 'answer' and has_ans = 1 group by sid, qid
      ), q as (
        select dw.user_id, least(dw.ms, 180000) as ms, dw.created_at + an.last_at::float8 * interval '1 millisecond' as at_abs
        from dw join an on an.sid = dw.sid and an.qid = dw.qid
      ), wk as (
        select user_id, ms, (at_abs at time zone 'Asia/Kolkata')::date as d from q where at_abs >= $2 and at_abs < $3
      ), dy as (
        select user_id, d, sum(ms) as ms from wk group by user_id, d
      ), per as (
        select sh.user_id, sh.joined_at,
               coalesce((select sum(dy.ms) from dy where dy.user_id = sh.user_id), 0) as tms,
               coalesce((select count(*) from dy where dy.user_id = sh.user_id and dy.ms >= sh.goal * 60000), 0)::int as gd
        from sh
      ), st as (
        select mk.user_id, min(mk.created_at + mk.at::float8 * interval '1 millisecond') as since
        from mk
        where typ = 'answer' and has_ans = 1
          and mk.created_at + mk.at::float8 * interval '1 millisecond' >= $4 - interval '10 minutes'
          and mk.created_at + mk.at::float8 * interval '1 millisecond' <= $4
        group by mk.user_id
      )
      select
        coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'minutes', floor(tms / 60000)::int, 'goal_days', gd)
                                   order by tms desc, joined_at, user_id)
                  from per where floor(tms / 60000) >= 1), '[]'::jsonb),
        coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'since', since) order by since, user_id) from st), '[]'::jsonb)
    $q$, goal_sql) into rws, stu using p_mob_id, w_from, w_to, p_now;
  end if;
  return jsonb_build_object('week_start', p_week, 'sharing', n, 'me_sharing', me, 'rows', rws, 'studying', stu);
end $$;

revoke all on function public.mob_share_study_time_set(text, uuid, boolean), public.mob_hours(text, uuid, date, timestamptz) from public, anon, authenticated;
grant execute on function public.mob_share_study_time_set(text, uuid, boolean), public.mob_hours(text, uuid, date, timestamptz) to service_role;
