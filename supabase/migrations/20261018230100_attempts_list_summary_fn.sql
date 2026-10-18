-- GET /api/attempts?view=summary, computed inside Postgres (website release 10). NOT applied anywhere by this branch.
-- Companion to src/lib/server/attemptListSummary.js, which uses this function when it exists and reads the table itself when it
-- does not (so deploying the code first, or never applying this file, is safe: same answer, but the heavy column is shipped).
--
-- Why: on 18 Oct 2026 a staging student's list was about 29 MB for 25 attempts and hit statement timeout 57014. The query plan is
-- fine (0.5 ms, attempts_user_completed_idx is used when the planner is not forced off it by a 99-row table); the cost is
-- detoasting, serialising and shipping `questions_snapshot` (each question carries its verification evidence, about 40 KB). This
-- function returns the same twelve columns as the table, with
--   questions_snapshot reduced to id, subject, internalSubject, chapter, difficulty, question, body (only when it differs from
--                      the stem), options, passageText of each question, in paper order, and
--   selection_meta     reduced to mode, sessionId, scoringVersion, durationMinutes, recovery.
-- Measured on staging with the same projection as a plain select: 79 ms for the 26 attempts of the heaviest account, against 245 ms
-- just to render the column as text. The Node code applies the same reduction again (idempotent), so a row from here and a row
-- from the table give the identical list item.
--
-- Security: security invoker, and execute is granted to service_role only. The route passes the signed-in user's id; the function
-- must never be callable by anon or authenticated, or p_user_id would read another student's attempts.
--
-- Rollback: supabase/undo/20261018230100_attempts_list_summary_fn.undo.sql (drops the function; the code falls back to the table).

create or replace function public.attempts_list_summary(p_user_id text)
 returns table (
   id text,
   user_id text,
   subject text,
   score integer,
   correct integer,
   wrong integer,
   unattempted integer,
   total integer,
   details jsonb,
   questions_snapshot jsonb,
   completed_at timestamp with time zone,
   selection_meta jsonb
 )
 language sql
 stable
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
  select
    a.id, a.user_id, a.subject, a.score, a.correct, a.wrong, a.unattempted, a.total, a.details,
    case when jsonb_typeof(a.questions_snapshot) = 'array' then
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', q.value -> 'id',
            'subject', q.value -> 'subject',
            'internalSubject', q.value -> 'internalSubject',
            'chapter', q.value -> 'chapter',
            'difficulty', q.value -> 'difficulty',
            'question', q.value -> 'question',
            'body', case when btrim(q.value ->> 'body') is not distinct from btrim(q.value ->> 'question') then null else q.value -> 'body' end,
            'options', q.value -> 'options',
            'passageText', q.value -> 'passageText'
          ) order by q.ord)
        from jsonb_array_elements(a.questions_snapshot) with ordinality as q(value, ord)
      ), '[]'::jsonb)
    else '[]'::jsonb end as questions_snapshot,
    a.completed_at,
    case when jsonb_typeof(a.selection_meta) = 'object' then
      jsonb_build_object(
        'mode', a.selection_meta -> 'mode',
        'sessionId', a.selection_meta -> 'sessionId',
        'scoringVersion', a.selection_meta -> 'scoringVersion',
        'durationMinutes', a.selection_meta -> 'durationMinutes',
        'recovery', a.selection_meta -> 'recovery')
    else '{}'::jsonb end as selection_meta
  from public.attempts a
  where a.user_id = p_user_id
  order by a.completed_at desc, a.id;
$function$;

revoke all on function public.attempts_list_summary(text) from public, anon, authenticated;
grant execute on function public.attempts_list_summary(text) to service_role;
