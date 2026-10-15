-- How other students answered each question: the read-only export behind data/cohort/question_picks.v1.json.
-- SELECT only, aggregates only: no user id, attempt id or answer row leaves the database. Run it through the
-- Supabase MCP (execute_sql, project isrxrxzjocewrdureyhp), then build the file with
--   node scripts/cohort/build-question-picks.mjs --rows <saved rows> --cutoff <the cutoff below>
--
-- Per question it keeps each student's FIRST answer (earliest completed_at, then attempt id; any mode, practice,
-- Full and NTA alike), reads the chosen option's text from that attempt's own questions_snapshot (so shuffled NTA
-- layouts are read as served), and hashes the text exactly as data/cohort_picks.js optionHash does:
--   sha256 of the text, whitespace runs collapsed to one space, trimmed and lower-cased; first 16 hex characters.
-- A question is dropped (spec tmp/mistake-lab-v4/SPEC.md 4.3) when the live row is missing, deleted, not live or
-- disputed; when two of today's options hash the same; when any counted answer's snapshot key text is not today's
-- key text (the key moved or was corrected); when any counted chosen text is none of today's options (edited); when
-- any counted snapshot's question text differs from today's (the live body, else question); or when fewer than 10 students answered it.
--
-- {cutoff}: the snapshot's builtAt. Answers completed after it are not counted, and data/cohort_picks.js subtracts a
-- student's own first answer only when it was completed at or before it. Use a moment already past (the latest
-- attempt's completed_at at export time, plus a second), never a future time: an attempt finished between the export
-- and a future cutoff would be subtracted without having been counted.
-- 15 Oct 2026 export: cutoff 2026-10-15 02:05:57+00 (latest attempt 02:05:56.96), 619 questions with 10 or more
-- first answers checked, 461 kept (13,877 answers); dropped: not live 88, key moved 99, edited 5, question text
-- changed 11 (a question can fail more than one guard); md5 of all lines 4d1c6afbbac4bd3f0ce0811f1a080544.
-- {part}: 0 for the summary row (counts, drop reasons and the md5 of every line), or 1..4 for a quarter of the lines.
with params as (select timestamptz '{cutoff}' as cutoff),
ans as (
  select a.user_id, a.id as aid, a.completed_at, d->>'qid' as qid, (d->>'givenIndex')::int as given, s.q as snap
  from attempts a cross join params p
  cross join lateral jsonb_array_elements(a.details) d
  cross join lateral (select x as q from jsonb_array_elements(a.questions_snapshot) x where x->>'id' = d->>'qid' limit 1) s
  where a.completed_at <= p.cutoff and jsonb_typeof(d->'givenIndex') = 'number'
    and jsonb_typeof(s.q->'options'->((d->>'givenIndex')::int)) in ('string', 'object')
),
fa as (select distinct on (user_id, qid) qid, given, snap from ans order by user_id, qid, completed_at, aid),
deep as (select qid from fa group by qid having count(*) >= 10),
snapq as (
  select fa.qid, hh.hashes[fa.given + 1] as chosen, hh.hashes[kk.k + 1] as snap_key_hash,
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
  from questions q
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
lines as (
  select k.qid, k.qid || ' ' || k.n || ' ' || k.key_hash || ' ' || string_agg(p.chosen || ':' || p.c, ',' order by p.chosen) as line,
    row_number() over (order by k.qid) as rn, count(*) over () as total
  from kept k join picks p on p.qid = k.qid group by k.qid, k.n, k.key_hash
)
select * from (
  select 0 as part, null::text as line, jsonb_build_object(
      'deep', (select count(*) from deep),
      'kept', (select count(*) from kept),
      'answers', (select coalesce(sum(n), 0) from kept),
      'dropped', jsonb_build_object(
        'missing', (select count(*) from judged where missing),
        'notLive', (select count(*) from judged where not_live),
        'duplicateOptions', (select count(*) from judged where duplicate_options),
        'keyMoved', (select count(*) from judged where key_moved),
        'edited', (select count(*) from judged where edited),
        'textChanged', (select count(*) from judged where text_changed)),
      'firstAnswerFrom', (select min(completed_at) from ans),
      'firstAnswerTo', (select max(completed_at) from ans),
      'md5', (select md5(string_agg(line, E'\n' order by qid)) from lines),
      'md5Parts', (select jsonb_agg(m order by q) from (select ((rn - 1) * 4 / total) + 1 as q, md5(string_agg(line, E'\n' order by qid)) as m from lines group by 1) z)
    ) as summary
  union all
  select ((rn - 1) * 4 / total)::int + 1 as part, line, null from lines
) out where part = {part}
order by line;
