-- Mistake Lab slice 5, refresh v2: the same public.refresh_question_option_stats() as 20261016120000, rewritten to run
-- in time linear in the number of answers. v1 timed out (57014 at 2 minutes) on production's 1,815 attempts and 35,067
-- answers, so the table could never fill. Same signature, grants, advisory lock, return shape and exactly the same rows;
-- data/tests/cohort_time_sql.test.mjs runs v1 and v2 on the same fixtures and compares the table contents row by row.
-- What changed (no rule changed):
--   * Per attempt, a map from question id to the position of its first occurrence in the snapshot is built once; the
--     question an answer was served is then one array lookup. v1 searched (and detoasted) the whole snapshot again for
--     every answer. The answers carry only narrow columns through the first-answer pick.
--   * "Changed", "any strike-out" and "the key was crossed out" are grouped once per (attempt, question) and joined
--     into per. v1 ran correlated subqueries per answer over the whole event list (quadratic).
--   * first_answer_from / first_answer_to come from min/max carried in the picks group, not two subqueries per question.
--   * enable_nestloop = off for the duration of the function. The joins between intermediate results are equi-joins the
--     planner cannot estimate; left to guess it picked a nested loop (9.7 million row comparisons for 2,700 rows on
--     PGlite, and over two minutes on a staging Postgres), so hash and merge joins are asked for outright.
--   * A snapshot or details value that is not an array is read as empty (v1 raised and failed the whole refresh).
--   * A student who has the same question twice in one attempt keeps the first of the two answers (v1 left the pick
--     between them to chance).
-- Service-role access only, same grants as v1. NOT APPLIED to any remote database by this change.
-- Undo: supabase/undo/20261016130000_question_option_stats_refresh_v2.undo.sql (restores the v1 function body).
create or replace function public.refresh_question_option_stats()
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '120s'
set enable_nestloop = off
as $$
declare
  v_cutoff timestamptz := clock_timestamp() - interval '5 minutes';
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('question_option_stats:refresh')) then
    return jsonb_build_object('skipped', 'refresh_running');
  end if;

  with
  -- Every answered question of every attempt completed by the cutoff. Per attempt, a map from question id to the position
  -- of that id's first occurrence in the snapshot is built once (v1 searched the whole snapshot again for every answer),
  -- so the question an answer was served is one array lookup (ix) and no join between intermediate results is left
  -- for the planner to guess at. Narrow rows go through the first-answer pick; the question is fetched again after it.
  ans as (
    select a.user_id, a.id as aid, a.completed_at, d->>'qid' as qid, (d->>'givenIndex')::int as given, dord, w.ix
    from public.attempts a
    cross join lateral (
      select jsonb_object_agg(z.k, z.mo) as m
      from (select x->>'id' as k, min(ord) as mo
        from jsonb_array_elements(case when jsonb_typeof(a.questions_snapshot) = 'array' then a.questions_snapshot else '[]'::jsonb end)
          with ordinality t(x, ord)
        where x->>'id' is not null group by x->>'id') z
    ) sm
    cross join lateral jsonb_array_elements(case when jsonb_typeof(a.details) = 'array' then a.details else '[]'::jsonb end)
      with ordinality t2(d, dord)
    cross join lateral (select (sm.m->>(d->>'qid'))::int - 1 as ix) w
    where a.completed_at <= v_cutoff and jsonb_typeof(d->'givenIndex') = 'number'
      and jsonb_typeof(a.questions_snapshot->w.ix->'options'->((d->>'givenIndex')::int)) in ('string', 'object')
  ),
  fa as (
    select distinct on (user_id, qid) user_id, qid, aid, completed_at, given, ix
    from ans order by user_id, qid, completed_at, aid, dord
  ),
  deep as (select qid from fa group by qid having count(*) >= 10),
  snapq as (
    select fa.user_id, fa.qid, fa.aid, fa.completed_at as at_, hh.hashes[fa.given + 1] as chosen, hh.hashes as hashes, hh.hashes[kk.k + 1] as snap_key_hash,
      lower(btrim(regexp_replace(coalesce(sx.q->>'question', ''), '\s+', ' ', 'g'))) as qtext
    from fa
    join deep dp on dp.qid = fa.qid
    join public.attempts sa on sa.id = fa.aid
    cross join lateral (select sa.questions_snapshot->fa.ix as q) sx
    cross join lateral (select array_agg(left(encode(sha256(convert_to(lower(btrim(regexp_replace(
        case jsonb_typeof(o) when 'string' then o #>> '{}' else coalesce(o->>'text', o->>'label', o->>'value', o::text) end,
        '\s+', ' ', 'g'))), 'UTF8')), 'hex'), 16) order by ord) as hashes
      from jsonb_array_elements(sx.q->'options') with ordinality t(o, ord)) hh
    cross join lateral (select case when jsonb_typeof(sx.q->'correctIndex') = 'number' then (sx.q->>'correctIndex')::int
        when sx.q->>'correctAnswer' ~ '^[A-E]$' then ascii(sx.q->>'correctAnswer') - 65 end as k) kk
  ),
  live as (
    select q.id as qid, q.status, q.is_deleted, q.verification_state, hh.hashes, hh.hashes[kk.k + 1] as key_hash,
      lower(btrim(regexp_replace(coalesce(q.body, q.question, ''), '\s+', ' ', 'g'))) as qtext,
      (select count(distinct x) from unnest(hh.hashes) x) = cardinality(hh.hashes) as distinct_ok
    from public.questions q
    cross join lateral (select array_agg(left(encode(sha256(convert_to(lower(btrim(regexp_replace(
        case jsonb_typeof(o) when 'string' then o #>> '{}' else coalesce(o->>'text', o->>'label', o->>'value', o::text) end,
        '\s+', ' ', 'g'))), 'UTF8')), 'hex'), 16) order by ord) as hashes
      from jsonb_array_elements(q.options) with ordinality t(o, ord)) hh
    cross join lateral (select coalesce(q.correct_index, case when q.correct_answer ~ '^[A-E]$' then ascii(q.correct_answer) - 65 end) as k) kk
    where q.id in (select qid from deep)
  ),
  judged as (
    select s.qid, count(*) as n,
      bool_or(l.qid is null) as missing,
      bool_or(coalesce(l.is_deleted, false) or coalesce(l.status, '') <> 'live' or l.verification_state = 'disputed') as not_live,
      bool_or(not coalesce(l.distinct_ok, true)) as duplicate_options,
      bool_or(s.snap_key_hash is distinct from l.key_hash) as key_moved,
      bool_or(s.chosen is null or not (s.chosen = any(coalesce(l.hashes, '{}')))) as edited,
      bool_or(s.qtext <> l.qtext) as text_changed
    from snapq s left join live l on l.qid = s.qid
    group by s.qid
  ),
  kept as (
    select j.qid, j.n, l.key_hash from judged j join live l on l.qid = j.qid
    where not (j.missing or j.not_live or j.duplicate_options or j.key_moved or j.edited or j.text_changed)
  ),
  picks as (
    select s.qid, s.chosen, count(*) as c, min(s.at_) as mn, max(s.at_) as mx
    from snapq s join kept k on k.qid = s.qid group by s.qid, s.chosen
  ),
  pickrow as (
    select p.qid, jsonb_object_agg(p.chosen, p.c) as option_picks, sum(p.c) filter (where p.chosen = k.key_hash) as n_right,
      min(p.mn) as first_from, max(p.mx) as first_to
    from picks p join kept k on k.qid = p.qid group by p.qid
  ),

  -- The captured attempts among the first answers: server scored, the device record matched the answers, and it ends
  -- with an end event (the 15 Oct capture). Only these can be timed.
  capt as (
    select a.id as aid, a.selection_meta->'recovery' as rec,
      (a.selection_meta->'client'->>'platform') = 'web' as is_web
    from public.attempts a
    where a.id in (select aid from snapq where qid in (select qid from kept))
      and a.selection_meta->>'scoringVersion' in ('server_practice_v1', 'server_snapshot_v1')
      and a.selection_meta->'recovery'->>'telemetry' = 'self_reported'
      and jsonb_typeof(a.selection_meta->'recovery'->'end') = 'object'
      and nullif(a.selection_meta->'recovery'->'end'->>'qid', '') is not null
      and jsonb_typeof(a.selection_meta->'recovery'->'end'->'at') = 'number'
      and jsonb_typeof(a.selection_meta->'recovery'->'timeline') = 'array'
      and jsonb_array_length(a.selection_meta->'recovery'->'timeline') >= 2
  ),
  -- Every event of those records on one clock (data/paper_trace.js recordOf): the scored timeline, marks, away and
  -- back, strike-outs, and the end last.
  ev0 as (
    select c.aid, x.qid, x.at, x.seq, x.type, x.via, x.ans, x.opt, x.on_, x.isend
    from capt c
    cross join lateral (
      select v->>'qid' as qid, (v->>'at')::numeric as at, coalesce((v->>'seq')::numeric, 0) as seq, v->>'type' as type,
        v->>'via' as via, case when jsonb_typeof(v->'answer') = 'number' then (v->>'answer')::int end as ans,
        null::int as opt, null::boolean as on_, false as isend
      from jsonb_array_elements(c.rec->'timeline') v
      where v->>'type' in ('answer', 'visit') and nullif(v->>'qid', '') is not null and jsonb_typeof(v->'at') = 'number'
      union all
      select v->>'qid', (v->>'at')::numeric, coalesce((v->>'seq')::numeric, 0), 'mark', null, null, null, null, false
      from jsonb_array_elements(case when jsonb_typeof(c.rec->'marks') = 'array' then c.rec->'marks' else '[]'::jsonb end) v
      where jsonb_typeof(v->'marked') = 'boolean' and nullif(v->>'qid', '') is not null and jsonb_typeof(v->'at') = 'number'
      union all
      select v->>'qid', (v->>'at')::numeric, coalesce((v->>'seq')::numeric, 0), v->>'type', null, null, null, null, false
      from jsonb_array_elements(case when jsonb_typeof(c.rec->'presence') = 'array' then c.rec->'presence' else '[]'::jsonb end) v
      where v->>'type' in ('away', 'back') and nullif(v->>'qid', '') is not null and jsonb_typeof(v->'at') = 'number'
      union all
      select v->>'qid', (v->>'at')::numeric, coalesce((v->>'seq')::numeric, 0), 'strike', null, null, (v->>'option')::int, (v->>'on')::boolean, false
      from jsonb_array_elements(case when jsonb_typeof(c.rec->'strikes') = 'array' then c.rec->'strikes' else '[]'::jsonb end) v
      where jsonb_typeof(v->'option') = 'number' and jsonb_typeof(v->'on') = 'boolean'
        and nullif(v->>'qid', '') is not null and jsonb_typeof(v->'at') = 'number'
      union all
      select v->>'qid', (v->>'at')::numeric, coalesce((v->>'seq')::numeric, 0), 'end', null, null, null, null, true
      from jsonb_array_elements(jsonb_build_array(c.rec->'end')) v
    ) x
  ),
  -- The end is the last event by definition; a stray earlier clock is clamped to the one before it.
  ev as (
    select e.*, row_number() over (partition by e.aid order by e.isend, e.at, e.seq) as pos,
      bool_or(e.type in ('away', 'back')) over (partition by e.aid) as away_known
    from (
      select aid, qid, case when isend then greatest(at, max(case when not isend then at end) over (partition by aid)) else at end as at,
        seq, type, via, ans, opt, on_, isend
      from ev0
    ) e
  ),
  -- The question on screen: the last visit or answer that is not a passage-set or submit-sheet visit (rule 1), and the
  -- submit sheet open over it (rule 6). A passage-set visit shows a question without giving it time (rule 5).
  flagged as (
    select ev.*, lead(at) over (partition by aid order by pos) as next_at,
      (type in ('answer', 'visit') and coalesce(via, '') not in ('set', 'sheet')) as focus,
      (type = 'visit' and via = 'sheet') as sheetv,
      (type = 'visit' and via = 'set') as setv
    from ev
  ),
  grp as (
    select f.*,
      count(*) filter (where focus) over (partition by aid order by pos) as fg,
      count(*) filter (where focus or sheetv) over (partition by aid order by pos) as sg
    from flagged f
  ),
  st as (
    select g.*,
      first_value(case when focus then qid end) over (partition by aid, fg order by pos) as onscreen,
      coalesce(first_value(case when sheetv then true when focus then false end) over (partition by aid, sg order by pos), false) as sheet_open
    from grp g
  ),
  owned as (
    select s.*, case when sheet_open then null else coalesce(onscreen, case when setv or sheetv then null else qid end) end as owner
    from st s
  ),
  -- Rules 1 to 4: the gap to the next event goes to the question on screen, unless the paper was away (an away event
  -- opens time away until the next event of any kind), nobody was on screen, or, on a record with no away or back
  -- data at all, the gap is over 30 minutes (a break, never counted).
  gaps as (
    select aid, owner as qid, next_at - at as gap, (not away_known and next_at - at > 1800000) as brk
    from owned
    where next_at is not null and type not in ('end', 'away') and owner is not null
  ),
  dwell as (
    select aid, qid, coalesce(sum(gap) filter (where not brk and gap >= 0), 0) as ms, bool_or(brk) as brk
    from gaps group by aid, qid
  ),
  firstpick as (
    select distinct on (aid, qid) aid, qid, ans from ev where type = 'answer' and ans is not null order by aid, qid, pos
  ),
  anystrike as (select distinct aid from ev where type = 'strike'),
  -- Per (attempt, question), one pass each, joined below (v1 ran a correlated subquery per answer: over the whole event
  -- list for the crossed-out key, over the record's change list for "changed").
  chg as (
    select distinct c.aid, ch->>'qid' as qid
    from capt c
    cross join lateral jsonb_array_elements(case when jsonb_typeof(c.rec->'observed'->'answerChanges') = 'array' then c.rec->'observed'->'answerChanges' else '[]'::jsonb end) ch
    where ch->>'qid' is not null
  ),
  -- A strike-out that stayed on, on the option that is today's key (the option index is read against the hashes of the
  -- paper as it was served, exactly as v1 did).
  keystruck as (
    select distinct s.aid, s.qid
    from (select distinct aid, qid, opt from ev where type = 'strike' and on_) so
    join snapq s on s.aid = so.aid and s.qid = so.qid
    join kept k on k.qid = s.qid
    where s.hashes[so.opt + 1] = k.key_hash
  ),

  -- One row per first answer of a kept question, with its reliable time, whether it was right, changed, moved off the
  -- key and had the key crossed out.
  per as (
    select s.qid, s.aid, (s.chosen = k.key_hash) as is_right,
      (c.aid is not null and d.aid is not null and d.ms >= 2000 and not coalesce(d.brk, false)) as timed, d.ms,
      (ch.aid is not null) as changed,
      (fp.ans is not null and s.hashes[fp.ans + 1] = k.key_hash and s.chosen is distinct from k.key_hash) as off_key,
      (c.aid is not null and (coalesce(c.is_web, false) or xs.aid is not null)) as strike_basis,
      (ks.aid is not null) as key_struck
    from snapq s
    join kept k on k.qid = s.qid
    left join capt c on c.aid = s.aid
    left join dwell d on d.aid = s.aid and d.qid = s.qid
    left join firstpick fp on fp.aid = s.aid and fp.qid = s.qid
    left join chg ch on ch.aid = s.aid and ch.qid = s.qid
    left join anystrike xs on xs.aid = s.aid
    left join keystruck ks on ks.aid = s.aid and ks.qid = s.qid
  ),
  agg as (
    select qid,
      count(*) filter (where timed) as n_timed,
      count(*) filter (where timed and is_right) as n_timed_right,
      percentile_cont(0.5) within group (order by ms) filter (where timed and is_right) as med_right,
      percentile_cont(0.25) within group (order by ms) filter (where timed and is_right) as q1_right,
      percentile_cont(0.75) within group (order by ms) filter (where timed and is_right) as q3_right,
      count(*) filter (where timed and not is_right) as n_timed_wrong,
      percentile_cont(0.5) within group (order by ms) filter (where timed and not is_right) as med_wrong,
      coalesce(array_agg(round(ms / 1000)::int order by ms) filter (where timed and is_right), '{}') as right_secs,
      count(*) filter (where timed and changed) as n_changed,
      count(*) filter (where timed and changed and off_key) as n_off,
      count(*) filter (where strike_basis) as n_strike,
      count(*) filter (where strike_basis and key_struck) as n_struck
    from per group by qid
  ),
  new_rows as (
    select k.qid, k.key_hash, k.n::int as n_answered, p.option_picks, coalesce(p.n_right, 0)::int as n_first_right,
      coalesce(a.n_timed, 0)::int as n_timed, coalesce(a.n_timed_right, 0)::int as n_timed_right,
      round(a.med_right)::int as median_ms_right, round(a.q1_right)::int as q1_ms_right, round(a.q3_right)::int as q3_ms_right,
      coalesce(a.n_timed_wrong, 0)::int as n_timed_wrong, round(a.med_wrong)::int as median_ms_wrong,
      coalesce(case when a.n_timed_right <= 1000 then a.right_secs end, '{}') as right_secs,
      coalesce(a.n_changed, 0)::int as n_changed, coalesce(a.n_off, 0)::int as n_moved_off_key,
      coalesce(a.n_strike, 0)::int as n_strike_basis, coalesce(a.n_struck, 0)::int as n_struck_key,
      p.first_from, p.first_to
    from kept k join pickrow p on p.qid = k.qid left join agg a on a.qid = k.qid
  ),
  up as (
    insert into public.question_option_stats as t (qid, key_hash, n_answered, option_picks, n_first_right, n_timed, n_timed_right,
      median_ms_right, q1_ms_right, q3_ms_right, n_timed_wrong, median_ms_wrong, right_secs, n_changed, n_moved_off_key,
      n_strike_basis, n_struck_key, first_answer_from, first_answer_to, counted_through, refreshed_at)
    select qid, key_hash, n_answered, option_picks, n_first_right, n_timed, n_timed_right, median_ms_right, q1_ms_right,
      q3_ms_right, n_timed_wrong, median_ms_wrong, right_secs, n_changed, n_moved_off_key, n_strike_basis, n_struck_key,
      first_from, first_to, v_cutoff, v_now
    from new_rows
    on conflict (qid) do update set
      key_hash = excluded.key_hash, n_answered = excluded.n_answered, option_picks = excluded.option_picks,
      n_first_right = excluded.n_first_right, n_timed = excluded.n_timed, n_timed_right = excluded.n_timed_right,
      median_ms_right = excluded.median_ms_right, q1_ms_right = excluded.q1_ms_right, q3_ms_right = excluded.q3_ms_right,
      n_timed_wrong = excluded.n_timed_wrong, median_ms_wrong = excluded.median_ms_wrong, right_secs = excluded.right_secs,
      n_changed = excluded.n_changed, n_moved_off_key = excluded.n_moved_off_key,
      n_strike_basis = excluded.n_strike_basis, n_struck_key = excluded.n_struck_key,
      first_answer_from = excluded.first_answer_from, first_answer_to = excluded.first_answer_to,
      counted_through = excluded.counted_through, refreshed_at = excluded.refreshed_at
    returning 1
  ),
  gone as (
    delete from public.question_option_stats t where not exists (select 1 from new_rows n where n.qid = t.qid) returning 1
  )
  select jsonb_build_object(
    'questions', (select count(*) from new_rows),
    'answers', (select coalesce(sum(n_answered), 0) from new_rows),
    'timed_answers', (select coalesce(sum(n_timed), 0) from new_rows),
    'questions_with_time', (select count(*) from new_rows where n_timed_right > 0),
    'removed', (select count(*) from gone),
    'written', (select count(*) from up),
    'counted_through', v_cutoff,
    'refreshed_at', v_now
  ) into v_result;
  return v_result;
end
$$;
revoke all on function public.refresh_question_option_stats() from public, anon, authenticated;
grant execute on function public.refresh_question_option_stats() to service_role;
