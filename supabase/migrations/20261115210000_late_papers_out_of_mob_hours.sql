-- Late papers out of Mob hours (bugs-core B8 follow-up, SESS-FOLLOWUP 1, 15 Nov 2026). A device-held paper sent after its upload
-- grace is accepted for 7 days and marked selection_meta.late = true (data/late_paper.js). Its times are the device's word only
-- and it reaches the server days after it was sat, so it counts for its student's own record and never for the Mob: not in the
-- week's minutes, the goal days or "studying now". Exactly public.mob_hours_rows from 20261020151000_mob_hours.sql (applied on
-- production) with one line added in each of its two attempt reads: an attempt whose selection_meta.late is 'true' is skipped.
-- Same signature, so the grants stay; nothing else changes. Until this is applied, a late paper's minutes count in the den on
-- the day it arrives (the code cannot take them off: the minutes are summed here, from the record's own clock).
-- NOT APPLIED to any remote database by this change.
-- Undo: supabase/undo/20261115210000_late_papers_out_of_mob_hours.undo.sql (restores the 20261020151000 body).
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
          and coalesce(a.selection_meta->>'late', '') <> 'true'
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
            and coalesce(a.selection_meta->>'late', '') <> 'true'
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
