-- Mistake Lab slice 5: the cohort table (data/cohort_time.js; spec tmp/mistake-lab-v4/SPEC.md 4.13, section 6 item 7).
-- One row per question holds what other students did on it, as aggregates only: how many chose each option (keyed by a
-- hash of the option's normalised text, as data/option_hash.js and data/cohort/question_picks.v1.json do), how long
-- the students who got it right took, how many changed their answer and how many crossed out the key. No user id, no
-- attempt id and no answer row is stored. Counts about a question, nothing about a student.
--
-- Rules the refresh function applies (public.refresh_question_option_stats, below):
--   * First answers only. Each student's first answered attempt of the question (earliest completed_at, then id; any
--     mode), exactly as scripts/cohort/question_picks.sql counts them. A later try never replaces it.
--   * The same truth guards as that export: a question is left out while its live row is missing, deleted, not live or
--     disputed, while two of today's options read the same, while any counted answer's key text is not today's key
--     text (the key moved), any counted option text is none of today's options (edited), or any counted snapshot's
--     question text differs from today's. Under 10 students a question has no row.
--   * Right is today's key text (the hash of the key option), never the stored isCorrect.
--   * Time is the paper trace's time (data/paper_trace.js, rules 1 to 6): the interval from one event to the next is
--     credited to the question on screen, time away from the paper is not counted, the submit sheet and passage-set
--     pages follow the same rules. It is used only when the record is reliable: a server-scored attempt whose device
--     record matched the submitted answers (telemetry self_reported) and carries an end event (the 15 Oct capture, so
--     time away was being captured and the last question's time is known), and only for a question with 2 seconds or
--     more on it and no gap of over 30 minutes credited to it on a record without away data (a tab left open).
--     An old record (no end event) is never timed.
--   * "Changed" is the ledger's own: the record's observed.answerChanges has an entry for the question. "Moved off the
--     key" is a change that started on the key and ended on something else (another option or blank).
--   * "Strike data" is a captured record that can carry strike-outs: it came from the web runner (client platform web)
--     or it holds at least one strike-out. Crossed out the key: a strike-out that stayed on at any time on the
--     option that is today's key.
--   n_timed is the basis of the changed counts: students whose own time on the question is reliable. Every count has its
--   own denominator, so a reader never divides by a number the measure did not use.
--   right_secs holds the whole seconds of every reliably timed right answer, sorted, so the reader can leave the
--   student's own time out of the median exactly (the median and quartile columns are the whole cohort's).
-- first_answer_from and first_answer_to are the earliest and latest first answers counted for the question (the reader's
-- "{from} to {to}" source line).
-- counted_through is the moment up to which answers were counted (five minutes before the refresh began, so a paper
-- saved a moment late is never subtracted without having been counted); the reader subtracts a student's own first
-- answer only when it was completed at or before it. refreshed_at is when the row was built: a reader treats a table
-- older than 48 hours as missing.
-- Service-role access only. NOT APPLIED to any remote database by this change.
-- Undo: supabase/undo/20261016120000_question_option_stats.undo.sql.
create table if not exists public.question_option_stats (
  qid text primary key references public.questions (id) on delete cascade,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{16}$'),
  n_answered integer not null check (n_answered >= 10),
  option_picks jsonb not null check (jsonb_typeof(option_picks) = 'object'),
  n_first_right integer not null check (n_first_right >= 0),
  n_timed integer not null default 0 check (n_timed >= 0),
  n_timed_right integer not null default 0 check (n_timed_right >= 0),
  median_ms_right integer,
  q1_ms_right integer,
  q3_ms_right integer,
  n_timed_wrong integer not null default 0 check (n_timed_wrong >= 0),
  median_ms_wrong integer,
  right_secs integer[] not null default '{}',
  n_changed integer not null default 0 check (n_changed >= 0),
  n_moved_off_key integer not null default 0 check (n_moved_off_key >= 0),
  n_strike_basis integer not null default 0 check (n_strike_basis >= 0),
  n_struck_key integer not null default 0 check (n_struck_key >= 0),
  first_answer_from timestamptz not null,
  first_answer_to timestamptz not null,
  counted_through timestamptz not null,
  refreshed_at timestamptz not null default now(),
  check (n_first_right <= n_answered and n_timed_right <= n_timed and n_timed_wrong <= n_timed
    and n_timed <= n_answered and n_changed <= n_timed and n_moved_off_key <= n_changed
    and n_struck_key <= n_strike_basis and n_strike_basis <= n_answered)
);
create index if not exists question_option_stats_refreshed_at_idx on public.question_option_stats (refreshed_at);

alter table public.question_option_stats enable row level security;
revoke all on public.question_option_stats from public, anon, authenticated;
grant all on public.question_option_stats to service_role;


-- Rebuild the whole table from attempts, in one statement, under one advisory lock (a second call while one runs
-- returns { skipped } and changes nothing). Idempotent: with no new answers it rewrites the same numbers and moves
-- refreshed_at. Rows of questions that no longer pass the guards are deleted. Returns a small summary.
create or replace function public.refresh_question_option_stats()
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '120s'
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
  -- Every answered question of every attempt completed by the cutoff, with the question as that attempt served it.
  ans as (
    select a.user_id, a.id as aid, a.completed_at, d->>'qid' as qid, (d->>'givenIndex')::int as given, s.q as snap
    from public.attempts a
    cross join lateral jsonb_array_elements(a.details) d
    cross join lateral (select x as q from jsonb_array_elements(a.questions_snapshot) x where x->>'id' = d->>'qid' limit 1) s
    where a.completed_at <= v_cutoff and jsonb_typeof(d->'givenIndex') = 'number'
      and jsonb_typeof(s.q->'options'->((d->>'givenIndex')::int)) in ('string', 'object')
  ),
  fa as (
    select distinct on (user_id, qid) user_id, qid, aid, completed_at, given, snap
    from ans order by user_id, qid, completed_at, aid
  ),
  deep as (select qid from fa group by qid having count(*) >= 10),
  snapq as (
    select fa.user_id, fa.qid, fa.aid, fa.completed_at as at_, hh.hashes[fa.given + 1] as chosen, hh.hashes as hashes, hh.hashes[kk.k + 1] as snap_key_hash,
      lower(btrim(regexp_replace(coalesce(fa.snap->>'question', ''), '\s+', ' ', 'g'))) as qtext
    from fa
    cross join lateral (select array_agg(left(encode(sha256(convert_to(lower(btrim(regexp_replace(
        case jsonb_typeof(o) when 'string' then o #>> '{}' else coalesce(o->>'text', o->>'label', o->>'value', o::text) end,
        '\s+', ' ', 'g'))), 'UTF8')), 'hex'), 16) order by ord) as hashes
      from jsonb_array_elements(fa.snap->'options') with ordinality t(o, ord)) hh
    cross join lateral (select case when jsonb_typeof(fa.snap->'correctIndex') = 'number' then (fa.snap->>'correctIndex')::int
        when fa.snap->>'correctAnswer' ~ '^[A-E]$' then ascii(fa.snap->>'correctAnswer') - 65 end as k) kk
    where fa.qid in (select qid from deep)
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
    select s.qid, s.chosen, count(*) as c from snapq s join kept k on k.qid = s.qid group by s.qid, s.chosen
  ),
  pickrow as (
    select p.qid, jsonb_object_agg(p.chosen, p.c) as option_picks, sum(p.c) filter (where p.chosen = k.key_hash) as n_right,
      (select min(s.at_) from snapq s where s.qid = p.qid) as first_from, (select max(s.at_) from snapq s where s.qid = p.qid) as first_to
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

  -- One row per first answer of a kept question, with its reliable time, whether it was right, changed, moved off the
  -- key and had the key crossed out.
  per as (
    select s.qid, s.aid, (s.chosen = k.key_hash) as is_right,
      (c.aid is not null and d.aid is not null and d.ms >= 2000 and not coalesce(d.brk, false)) as timed, d.ms,
      (c.aid is not null and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(c.rec->'observed'->'answerChanges') = 'array' then c.rec->'observed'->'answerChanges' else '[]'::jsonb end) ch
        where ch->>'qid' = s.qid
      )) as changed,
      (fp.ans is not null and s.hashes[fp.ans + 1] = k.key_hash and s.chosen is distinct from k.key_hash) as off_key,
      (c.aid is not null and (coalesce(c.is_web, false) or exists (select 1 from anystrike x where x.aid = s.aid))) as strike_basis,
      exists (select 1 from ev e2 where e2.aid = s.aid and e2.type = 'strike' and e2.on_ and e2.qid = s.qid
          and s.hashes[e2.opt + 1] = k.key_hash) as key_struck
    from snapq s
    join kept k on k.qid = s.qid
    left join capt c on c.aid = s.aid
    left join dwell d on d.aid = s.aid and d.qid = s.qid
    left join firstpick fp on fp.aid = s.aid and fp.qid = s.qid
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
